import { Component, Show, createMemo } from "solid-js";
import { projectSignals } from "../stores/project";
import { queueSignals } from "../stores/queue";
import { Cpu, Settings, HelpCircle, Plus, Film, Scissors, Download, CheckCircle2, FolderOpen, Save, Undo, Redo } from "./Icons";

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenNewProject: () => void;
  onOpenShortcuts: () => void;
  onOpenProjectManager: () => void;
}

export const Header: Component<HeaderProps> = (props) => {
  const envStatus = projectSignals.environmentStatus;
  const gpu = createMemo(() => envStatus()?.gpu);
  const currentProject = projectSignals.currentProject;
  const clips = createMemo(() => projectSignals.currentManifest()?.clips || []);
  const clipsCount = createMemo(() => clips().length);
  const renderedCount = createMemo(() => {
    return clips().filter((c) => queueSignals.isClipRendered(c.id)).length;
  });

  return (
    <header class="h-12 border-b border-zinc-800/80 bg-zinc-950 px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left: Brand + Project Title + GPU Encoder Badge */}
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-black text-xs text-white tracking-wider">
            CK
          </div>
          <span class="text-xs font-bold tracking-wider text-zinc-100 uppercase">
            Clyptik
          </span>
        </div>

        <div class="h-4 w-px bg-zinc-800" />

        {/* Project Title / Quick Status */}
        <div class="flex items-center gap-2">
          <Show
            when={currentProject()}
            fallback={<span class="text-xs text-zinc-500 italic">No Active Project</span>}
          >
            <input
              type="text"
              value={currentProject()?.name || "Untitled"}
              onInput={(e) => projectSignals.updateProjectName((e.target as HTMLInputElement).value)}
              class="text-xs font-semibold text-zinc-200 bg-transparent hover:bg-zinc-900 focus:bg-zinc-900 border border-transparent focus:border-zinc-700 rounded px-1.5 py-0.5 outline-none transition max-w-[200px] truncate"
              title="Click to rename project"
            />
            <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              Saved
            </span>
            <span
              class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-950/70 border border-blue-800/60 text-blue-300 font-semibold"
              title={`Active Project Workflow Mode: ${projectSignals.workflowMode()}`}
            >
              {projectSignals.workflowMode()}
            </span>

            {/* Undo / Redo Toolbar */}
            <div class="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 ml-1">
              <button
                type="button"
                disabled={!projectSignals.canUndo()}
                onClick={() => projectSignals.undo()}
                class="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 disabled:cursor-not-allowed cursor-pointer transition"
                title={projectSignals.canUndo() ? `Undo: ${projectSignals.undoLabel()} (Ctrl+Z)` : "Undo (Ctrl+Z)"}
              >
                <Undo size={12} />
              </button>
              <button
                type="button"
                disabled={!projectSignals.canRedo()}
                onClick={() => projectSignals.redo()}
                class="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 disabled:cursor-not-allowed cursor-pointer transition"
                title={projectSignals.canRedo() ? `Redo: ${projectSignals.redoLabel()} (Ctrl+Y)` : "Redo (Ctrl+Y)"}
              >
                <Redo size={12} />
              </button>
            </div>
          </Show>
        </div>

        {/* GPU Hardware Acceleration Indicator */}
        <Show when={gpu()}>
          <div
            class="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border border-zinc-800/90 bg-zinc-900/60 text-zinc-400"
            title={gpu()?.description}
          >
            <Cpu size={12} class={gpu()?.is_hardware ? "text-emerald-400" : "text-amber-400"} />
            <span>{gpu()?.name}</span>
          </div>
        </Show>
      </div>

      {/* Center: Segmented Workspace Navigation */}
      <nav class="flex items-center bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800/80">
        <button
          type="button"
          onClick={() => projectSignals.setWorkspaceTab("media")}
          class={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            projectSignals.activeWorkspaceTab() === "media"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <Film size={13} />
          <span>Media</span>
          <Show when={projectSignals.videoMetadata()}>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </Show>
        </button>

        <button
          type="button"
          onClick={() => projectSignals.setWorkspaceTab("edit")}
          class={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            projectSignals.activeWorkspaceTab() === "edit"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <Scissors size={13} />
          <span>Studio</span>
          <Show when={clipsCount() > 0}>
            <span
              class={`px-1 rounded text-[10px] font-mono tabular-nums ${
                projectSignals.activeWorkspaceTab() === "edit"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {clipsCount()}
            </span>
          </Show>
        </button>

        <button
          type="button"
          onClick={() => projectSignals.setWorkspaceTab("deliver")}
          class={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            projectSignals.activeWorkspaceTab() === "deliver"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <Download size={13} />
          <span>Export</span>
          <Show when={clipsCount() > 0}>
            <span
              class={`px-1 rounded text-[10px] font-mono tabular-nums ${
                renderedCount() === clipsCount() && clipsCount() > 0
                  ? "text-emerald-400 bg-emerald-950/60 border border-emerald-800/40"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {renderedCount()}/{clipsCount()}
            </span>
          </Show>
        </button>
      </nav>

      {/* Right: Actions (Save & Close, Projects, New Project, Settings, Shortcuts) */}
      <div class="flex items-center gap-1.5">
        <Show when={currentProject() || projectSignals.videoMetadata()}>
          <button
            type="button"
            onClick={() => projectSignals.saveAndCloseProject(() => props.onOpenProjectManager())}
            class="h-7 px-2.5 rounded bg-emerald-950/70 hover:bg-emerald-900/90 border border-emerald-700/60 text-emerald-300 hover:text-white text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-sm"
            title="Save and close current session at exact playhead frame, then switch projects"
          >
            <Save size={13} class="text-emerald-400" />
            <span class="hidden sm:inline">Save & Close</span>
          </button>
        </Show>

        <button
          type="button"
          onClick={props.onOpenProjectManager}
          class="h-7 px-2.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
          title="Open Project Manager & Saved Drafts"
        >
          <FolderOpen size={13} class="text-blue-400" />
          <span class="hidden md:inline">Projects</span>
        </button>

        <button
          type="button"
          onClick={props.onOpenNewProject}
          class="h-7 px-2.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
          title="Create New Project (Ctrl+N)"
        >
          <Plus size={13} />
          <span class="hidden md:inline">New</span>
        </button>

        <button
          type="button"
          onClick={props.onOpenShortcuts}
          class="w-7 h-7 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center cursor-pointer transition"
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle size={14} />
        </button>

        <button
          type="button"
          onClick={props.onOpenSettings}
          class="w-7 h-7 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center cursor-pointer transition"
          title="Project & Encoding Settings"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
};
