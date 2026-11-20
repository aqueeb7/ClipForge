import { Component, createSignal, createMemo, onMount, onCleanup, For, Show } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";
import { queueSignals } from "../stores/queue";
import { getRecentProjects, clearRecentProjects, type RecentProjectItem } from "../services/persistence";
import { openFileDialog } from "../services/api";

interface AppMenuBarProps {
  onOpenNewProject: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  onToggleInspector: () => void;
}

export const AppMenuBar: Component<AppMenuBarProps> = (props) => {
  const [activeMenu, setActiveMenu] = createSignal<string | null>(null);
  const [recentProjects, setRecentProjects] = createSignal<RecentProjectItem[]>([]);

  function refreshRecents() {
    setRecentProjects(getRecentProjects());
  }

  const projectName = createMemo(() => projectSignals.currentProject()?.name || "Untitled Project");
  const isDirty = createMemo(() => projectSignals.isDirty());

  function toggleMenu(menu: string) {
    if (activeMenu() === menu) {
      setActiveMenu(null);
    } else {
      setActiveMenu(menu);
      if (menu === "file") refreshRecents();
    }
  }

  function closeMenus() {
    setActiveMenu(null);
  }

  // File Menu Actions
  function handleNewProject() {
    closeMenus();
    props.onOpenNewProject();
  }

  async function handleOpenProject() {
    closeMenus();
    await projectSignals.openProject();
  }

  async function handleSaveProject() {
    closeMenus();
    await projectSignals.saveProject();
  }

  async function handleSaveProjectAs() {
    closeMenus();
    await projectSignals.saveProjectAs();
  }

  async function handleImportVideo() {
    closeMenus();
    const selected = await openFileDialog({
      title: "Import Master Video Source",
      filters: [{ name: "Video Files", extensions: ["mp4", "mkv", "mov", "webm", "avi"] }]
    });
    if (selected) {
      await projectSignals.loadVideoSource(selected);
    }
  }

  async function handleImportAudio() {
    closeMenus();
    const selected = await openFileDialog({
      title: "Import Dedicated Audio Track",
      filters: [
        { name: "Audio Files", extensions: ["weba", "wav", "mp3", "aac", "m4a", "flac", "ogg", "opus"] }
      ]
    });
    if (selected) {
      await projectSignals.loadAudioSource(selected);
    }
  }

  async function handleOpenRecent(item: RecentProjectItem) {
    closeMenus();
    await projectSignals.openProject(item.filePath);
  }

  function handleClearRecents() {
    clearRecentProjects();
    setRecentProjects([]);
    closeMenus();
  }

  // Edit Menu Actions
  function handleCutIntro() {
    closeMenus();
    projectSignals.trimStreamHead(timelineSignals.currentTime());
  }

  function handleCutOutro() {
    closeMenus();
    projectSignals.trimStreamTail(timelineSignals.currentTime());
  }

  function handleSplitPart() {
    closeMenus();
    projectSignals.splitClipAt(timelineSignals.currentTime());
  }

  function handleResetTrim() {
    closeMenus();
    projectSignals.resetMasterTrim();
  }

  // View Menu Actions
  function setTab(tab: "media" | "edit" | "deliver") {
    closeMenus();
    projectSignals.setWorkspaceTab(tab);
  }

  function handleToggleInspector() {
    closeMenus();
    props.onToggleInspector();
  }

  function handleZoomIn() {
    closeMenus();
    timelineSignals.zoomIn();
  }

  function handleZoomOut() {
    closeMenus();
    timelineSignals.zoomOut();
  }

  function handleZoomFit() {
    closeMenus();
    timelineSignals.resetZoom();
  }

  function handleToggleExpand() {
    closeMenus();
    timelineSignals.toggleTimelineExpanded();
  }

  // Render Menu Actions
  function handleRenderAll() {
    closeMenus();
    const proj = projectSignals.currentProject();
    if (!proj) return;
    const clips = projectSignals.currentManifest()?.clips || [];
    if (clips.length === 0) return;
    queueSignals.initQueueFromManifest(clips, proj);
    queueSignals.runExportQueue(proj);
  }

  function handleRenderRemaining() {
    closeMenus();
    const proj = projectSignals.currentProject();
    if (!proj) return;
    const clips = projectSignals.currentManifest()?.clips || [];
    queueSignals.exportRemainingClips(clips, proj);
  }

  function handleOpenExports() {
    closeMenus();
    queueSignals.openFolder();
  }

  async function handleCleanIncompleteFiles() {
    closeMenus();
    const count = await queueSignals.cleanupExports();
    if (count > 0) {
      projectSignals.statusMessage();
    }
  }

  // Global Click-Outside Handler
  function onDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".app-menu-bar")) {
      closeMenus();
    }
  }

  // Global Keyboard Shortcut Handler
  function onGlobalKeyDown(e: KeyboardEvent) {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (e.shiftKey) {
        projectSignals.saveProjectAs();
      } else {
        projectSignals.saveProject();
      }
    } else if (isCtrlOrCmd && e.key.toLowerCase() === "o") {
      e.preventDefault();
      projectSignals.openProject();
    } else if (isCtrlOrCmd && e.key.toLowerCase() === "n") {
      e.preventDefault();
      props.onOpenNewProject();
    } else if (isCtrlOrCmd && e.key.toLowerCase() === "i") {
      e.preventDefault();
      if (e.shiftKey) {
        handleImportAudio();
      } else {
        handleImportVideo();
      }
    } else if (isCtrlOrCmd && e.key.toLowerCase() === "k") {
      e.preventDefault();
      handleSplitPart();
    } else if (isCtrlOrCmd && e.key.toLowerCase() === "b") {
      e.preventDefault();
      props.onToggleInspector();
    } else if (isCtrlOrCmd && e.key.toLowerCase() === "e") {
      e.preventDefault();
      handleOpenExports();
    } else if (e.key === "F1") {
      e.preventDefault();
      projectSignals.setWorkspaceTab("media");
    } else if (e.key === "F2") {
      e.preventDefault();
      projectSignals.setWorkspaceTab("edit");
    } else if (e.key === "F3") {
      e.preventDefault();
      projectSignals.setWorkspaceTab("deliver");
    }
  }

  let unlistenNativeMenu: (() => void) | null = null;

  async function setupNativeMenuListener() {
    try {
      const { listen } = await import("@tauri-apps/api/event");
      unlistenNativeMenu = await listen<string>("native-menu-action", (event) => {
        const action = event.payload;
        switch (action) {
          case "menu_new_project":
            handleNewProject();
            break;
          case "menu_open_project":
            handleOpenProject();
            break;
          case "menu_save_project":
            handleSaveProject();
            break;
          case "menu_save_as":
            handleSaveProjectAs();
            break;
          case "menu_import_video":
            handleImportVideo();
            break;
          case "menu_import_audio":
            handleImportAudio();
            break;
          case "menu_cut_intro":
            handleCutIntro();
            break;
          case "menu_cut_outro":
            handleCutOutro();
            break;
          case "menu_split_part":
            handleSplitPart();
            break;
          case "menu_reset_trim":
            handleResetTrim();
            break;
          case "menu_view_media":
            projectSignals.setWorkspaceTab("media");
            break;
          case "menu_view_edit":
            projectSignals.setWorkspaceTab("edit");
            break;
          case "menu_view_deliver":
            projectSignals.setWorkspaceTab("deliver");
            break;
          case "menu_toggle_sidebar":
            props.onToggleInspector();
            break;
          case "menu_render_remaining":
            handleRenderRemaining();
            break;
          case "menu_render_all":
            handleRenderAll();
            break;
          case "menu_clean_temp":
            handleCleanIncompleteFiles();
            break;
          case "menu_open_exports":
            handleOpenExports();
            break;
          case "menu_shortcuts":
            props.onOpenShortcuts();
            break;
          case "menu_diagnostics":
            props.onOpenSettings();
            break;
        }
      });
    } catch (err) {
      console.warn("Could not listen to native-menu-action:", err);
    }
  }

  onMount(() => {
    refreshRecents();
    setupNativeMenuListener();
    document.addEventListener("click", onDocumentClick);
    window.addEventListener("keydown", onGlobalKeyDown);
  });

  onCleanup(() => {
    if (unlistenNativeMenu) {
      unlistenNativeMenu();
      unlistenNativeMenu = null;
    }
    document.removeEventListener("click", onDocumentClick);
    window.removeEventListener("keydown", onGlobalKeyDown);
  });

  return (
    <div class="app-menu-bar h-7 bg-zinc-950 border-b border-zinc-800/80 px-3 flex items-center justify-between text-xs select-none z-50 text-zinc-300">
      {/* Left: Top Menus */}
      <div class="flex items-center gap-0.5">
        {/* 1. FILE MENU */}
        <div class="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu("file");
            }}
            class={`px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium ${
              activeMenu() === "file" ? "bg-zinc-800 text-white" : ""
            }`}
          >
            File
          </button>

          <Show when={activeMenu() === "file"}>
            <div class="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col">
              <button
                type="button"
                onClick={handleNewProject}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>📄</span> New Project...</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+N</span>
              </button>

              <button
                type="button"
                onClick={handleOpenProject}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>📂</span> Open Project...</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+O</span>
              </button>

              <button
                type="button"
                onClick={handleSaveProject}
                disabled={!projectSignals.currentProject()}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white disabled:opacity-40 flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>💾</span> Save Project</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+S</span>
              </button>

              <button
                type="button"
                onClick={handleSaveProjectAs}
                disabled={!projectSignals.currentProject()}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white disabled:opacity-40 flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>💾</span> Save Project As...</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+Shift+S</span>
              </button>

              <div class="h-[1px] bg-zinc-800 my-1"></div>

              <button
                type="button"
                onClick={handleImportVideo}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>🎥</span> Import Master Video...</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+I</span>
              </button>

              <button
                type="button"
                onClick={handleImportAudio}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>🎙</span> Import Dedicated Audio...</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+Shift+I</span>
              </button>

              <div class="h-[1px] bg-zinc-800 my-1"></div>

              {/* Recents Submenu */}
              <div class="px-3 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Recent Projects
              </div>
              <Show
                when={recentProjects().length > 0}
                fallback={<div class="px-3 py-1 text-[10px] text-zinc-600 italic">No recent projects</div>}
              >
                <For each={recentProjects()}>
                  {(rec) => (
                    <button
                      type="button"
                      onClick={() => handleOpenRecent(rec)}
                      class="px-3 py-1 hover:bg-zinc-800 flex items-center justify-between cursor-pointer text-left"
                      title={rec.filePath}
                    >
                      <span class="truncate text-[11px] text-zinc-300">{rec.name}</span>
                      <span class="text-[9px] text-zinc-500 font-mono shrink-0 ml-2">
                        {new Date(rec.lastOpened).toLocaleDateString()}
                      </span>
                    </button>
                  )}
                </For>
                <button
                  type="button"
                  onClick={handleClearRecents}
                  class="px-3 py-1 text-[10px] text-zinc-500 hover:text-red-400 text-left hover:bg-zinc-800 cursor-pointer"
                >
                  Clear Recent Projects
                </button>
              </Show>
            </div>
          </Show>
        </div>

        {/* 2. EDIT MENU */}
        <div class="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu("edit");
            }}
            class={`px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium ${
              activeMenu() === "edit" ? "bg-zinc-800 text-white" : ""
            }`}
          >
            Edit
          </button>

          <Show when={activeMenu() === "edit"}>
            <div class="absolute top-full left-0 mt-1 w-60 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col">
              <button
                type="button"
                onClick={handleCutIntro}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>[ Cut Intro at Playhead</span>
                <span class="text-[10px] text-zinc-400 font-mono">[</span>
              </button>

              <button
                type="button"
                onClick={handleCutOutro}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>Cut Outro at Playhead ]</span>
                <span class="text-[10px] text-zinc-400 font-mono">]</span>
              </button>

              <button
                type="button"
                onClick={handleSplitPart}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>✂ Split Part at Playhead</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+K</span>
              </button>

              <button
                type="button"
                onClick={handleResetTrim}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>↺ Reset Master Trim</span>
              </button>
            </div>
          </Show>
        </div>

        {/* 3. VIEW MENU */}
        <div class="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu("view");
            }}
            class={`px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium ${
              activeMenu() === "view" ? "bg-zinc-800 text-white" : ""
            }`}
          >
            View
          </button>

          <Show when={activeMenu() === "view"}>
            <div class="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col">
              <button
                type="button"
                onClick={() => setTab("media")}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>📁</span> Media Pool & Ingest</span>
                <span class="text-[10px] text-zinc-400 font-mono">F1</span>
              </button>

              <button
                type="button"
                onClick={() => setTab("edit")}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>✂</span> Edit & Timeline Studio</span>
                <span class="text-[10px] text-zinc-400 font-mono">F2</span>
              </button>

              <button
                type="button"
                onClick={() => setTab("deliver")}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>🚀</span> Deliver & Export Console</span>
                <span class="text-[10px] text-zinc-400 font-mono">F3</span>
              </button>

              <div class="h-[1px] bg-zinc-800 my-1"></div>

              <button
                type="button"
                onClick={handleToggleInspector}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>Toggle Side Inspector</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+B</span>
              </button>

              <button
                type="button"
                onClick={handleToggleExpand}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>Toggle Expanded Timeline</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+T</span>
              </button>

              <div class="h-[1px] bg-zinc-800 my-1"></div>

              <button
                type="button"
                onClick={handleZoomIn}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>Zoom In Timeline</span>
                <span class="text-[10px] text-zinc-400 font-mono">+</span>
              </button>

              <button
                type="button"
                onClick={handleZoomOut}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>Zoom Out Timeline</span>
                <span class="text-[10px] text-zinc-400 font-mono">-</span>
              </button>

              <button
                type="button"
                onClick={handleZoomFit}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>Fit Whole Stream</span>
                <span class="text-[10px] text-zinc-400 font-mono">Fit</span>
              </button>
            </div>
          </Show>
        </div>

        {/* 4. RENDER MENU */}
        <div class="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu("render");
            }}
            class={`px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium ${
              activeMenu() === "render" ? "bg-zinc-800 text-white" : ""
            }`}
          >
            Render
          </button>

          <Show when={activeMenu() === "render"}>
            <div class="absolute top-full left-0 mt-1 w-60 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col">
              <button
                type="button"
                onClick={handleRenderRemaining}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>Render Remaining Parts</span>
              </button>

              <button
                type="button"
                onClick={handleRenderAll}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span>Render All Parts</span>
              </button>

              <div class="h-[1px] bg-zinc-800 my-1"></div>

              <button
                type="button"
                onClick={handleOpenExports}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>📂</span> Open Exports Directory</span>
                <span class="text-[10px] text-zinc-400 font-mono">Ctrl+E</span>
              </button>

              <button
                type="button"
                onClick={handleCleanIncompleteFiles}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>🧹</span> Clean Incomplete Files</span>
              </button>
            </div>
          </Show>
        </div>

        {/* 5. HELP MENU */}
        <div class="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu("help");
            }}
            class={`px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium ${
              activeMenu() === "help" ? "bg-zinc-800 text-white" : ""
            }`}
          >
            Help
          </button>

          <Show when={activeMenu() === "help"}>
            <div class="absolute top-full left-0 mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col">
              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  props.onOpenShortcuts();
                }}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>⌨</span> Keyboard Shortcuts</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  props.onOpenSettings();
                }}
                class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
              >
                <span class="flex items-center gap-2"><span>⚙</span> Settings & System Diagnostics</span>
              </button>
            </div>
          </Show>
        </div>
      </div>

      {/* Center: Project Title / Active File Indicator */}
      <div class="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 truncate max-w-sm">
        <span class="text-zinc-500 font-sans font-semibold">Project:</span>
        <span class="text-zinc-200 font-medium truncate">{projectName()}</span>
        <Show when={projectSignals.projectFilePath()}>
          {(path) => (
            <span class="text-[9px] text-zinc-500 truncate" title={path()}>
              ({path().split(/[/\\]/).pop()})
            </span>
          )}
        </Show>
        <Show when={isDirty()}>
          <span class="text-amber-400 font-bold" title="Unsaved changes">*</span>
        </Show>
      </div>

      {/* Right: Quick Save Action & Auto-Save Badge */}
      <div class="flex items-center gap-2">
        <span
          class="text-[9px] font-mono text-emerald-400/90 flex items-center gap-1"
          title="Changes auto-persisted against sleep/reloads"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Auto-Save Active</span>
        </span>

        <Show when={projectSignals.currentProject()}>
          <button
            type="button"
            onClick={handleSaveProject}
            class="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[10px] font-medium cursor-pointer transition flex items-center gap-1"
            title="Save project to disk (Ctrl+S)"
          >
            <span>💾 Save</span>
          </button>
        </Show>
      </div>
    </div>
  );
};
