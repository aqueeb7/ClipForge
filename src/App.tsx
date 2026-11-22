import { Component, createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { projectSignals } from "./stores/project";
import { chatReplaySignals } from "./stores/chatReplay";
import { intelligenceSignals } from "./stores/intelligence";
import { setupSleepAndLifecycleWatchers } from "./services/persistence";

import { Header } from "./components/Header";
import { Inspector } from "./components/Inspector";
import { VideoPreview } from "./components/VideoPreview";
import { ChatReplayDrawer } from "./components/ChatReplayDrawer";
import { HighlightCandidatesDrawer } from "./components/HighlightCandidatesDrawer";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { ClipPlanList } from "./components/ClipPlanList";
import { MediaPool } from "./components/MediaPool";
import { RenderQueueModal } from "./components/Modals/RenderQueueModal";
import { SettingsModal } from "./components/Modals/SettingsModal";
import { NewProjectModal } from "./components/Modals/NewProjectModal";
import { ShortcutsModal } from "./components/Modals/ShortcutsModal";
import { PublishModal } from "./components/Modals/PublishModal";
import { ProjectManagerModal } from "./components/Modals/ProjectManagerModal";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Scissors } from "./components/Icons";
import type { Clip } from "./types/index.js";

export const App: Component = () => {
  const [showSettings, setShowSettings] = createSignal(false);
  const [showNewProject, setShowNewProject] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const [showPublish, setShowPublish] = createSignal(false);
  const [showProjectManager, setShowProjectManager] = createSignal(false);
  const [isInspectorOpen, setIsInspectorOpen] = createSignal(true);
  const [isClipDeckCollapsed, setIsClipDeckCollapsed] = createSignal(false);
  const [selectedClipForPublish, setSelectedClipForPublish] = createSignal<Clip | null>(null);

  function handleOpenPublish(clip: Clip) {
    setSelectedClipForPublish(clip);
    setShowPublish(true);
  }

  let cleanupLifecycle: (() => void) | null = null;
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function triggerDebouncedAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      projectSignals.autoSave();
    }, 1000);
  }

  // Reactive effect to trigger persistence when key states change
  createEffect(() => {
    projectSignals.currentProject()?.name;
    projectSignals.currentProject()?.sources.video?.path;
    projectSignals.currentProject()?.sources.audio?.path;
    projectSignals.masterInSeconds();
    projectSignals.masterOutSeconds();
    projectSignals.isMasterPatched();
    projectSignals.timelineStage();
    projectSignals.activeWorkspaceTab();
    projectSignals.currentProject()?.synchronization.audioOffsetMs;
    projectSignals.currentManifest()?.clips.length;

    triggerDebouncedAutoSave();
  });

  onMount(async () => {
    await projectSignals.checkSystemEnvironment();
    await projectSignals.restoreAutoSavedSession();

    cleanupLifecycle = setupSleepAndLifecycleWatchers(
      () => {
        projectSignals.autoSave();
      },
      () => {
        if (!projectSignals.currentProject()) {
          projectSignals.restoreAutoSavedSession();
        }
      }
    );
  });

  onCleanup(() => {
    if (cleanupLifecycle) {
      cleanupLifecycle();
      cleanupLifecycle = null;
    }
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
  });

  return (
    <div class="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      {/* Precision Studio Header Bar */}
      <Header
        onOpenSettings={() => setShowSettings(true)}
        onOpenNewProject={() => setShowNewProject(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenProjectManager={() => setShowProjectManager(true)}
      />

      {/* Notice / Validation Banner */}
      <Show when={projectSignals.validationErrors().length > 0}>
        <div class="bg-red-950/40 border-b border-red-800/40 px-4 py-1.5 flex items-center justify-between text-xs text-red-300 shrink-0 z-30">
          <div class="flex items-center gap-2">
            <span class="font-bold uppercase tracking-wider text-[10px]">Notice:</span>
            <span class="truncate">{projectSignals.validationErrors().join("; ")}</span>
          </div>
          <button
            type="button"
            onClick={() => projectSignals.clearErrors()}
            class="text-zinc-400 hover:text-zinc-200 cursor-pointer ml-2"
          >
            &times;
          </button>
        </div>
      </Show>

      {/* Main Workspace Stage */}
      <main class="flex-1 min-h-0 overflow-hidden bg-zinc-950">
        {/* WORKSPACE 1: Media Pool & Ingest */}
        <div
          class="h-full min-h-0"
          style={{ display: projectSignals.activeWorkspaceTab() === "media" ? "block" : "none" }}
        >
          <MediaPool onOpenProjectManager={() => setShowProjectManager(true)} />
        </div>

        {/* WORKSPACE 2: Studio Workbench (Inspector + Monitor + Timeline + Clip Deck) */}
        <div
          class="h-full min-h-0 flex overflow-hidden"
          style={{ display: projectSignals.activeWorkspaceTab() === "edit" ? "flex" : "none" }}
        >
          {/* Left Contextual Inspector (Collapsible to maximize Preview Canvas) */}
          <Show
            when={isInspectorOpen()}
            fallback={
              <div
                onClick={() => setIsInspectorOpen(true)}
                class="w-7 h-full border-r border-zinc-800 bg-zinc-950 hover:bg-zinc-900 cursor-pointer flex flex-col items-center py-3 gap-3 shrink-0 transition"
                title="Expand Inspector"
              >
                <ChevronRight size={14} class="text-zinc-400" />
                <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                  Inspector
                </span>
              </div>
            }
          >
            <div class="relative shrink-0 flex h-full">
              <Inspector />
              <button
                type="button"
                onClick={() => setIsInspectorOpen(false)}
                class="absolute top-2 -right-3 z-30 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer shadow-md transition"
                title="Collapse Inspector"
              >
                <ChevronLeft size={13} />
              </button>
            </div>
          </Show>

          {/* Right Main Studio Stage: Hero Transformative Monitor + Docked Transport */}
          <div class="flex-1 flex flex-col p-3 gap-2 h-full min-h-0 overflow-hidden">
            {/* Top / Hero Focus: Expansive Preview Monitor (Transforms between 16:9, 9:16 & Dual Split) */}
            <div class="flex-1 min-h-[320px] flex gap-2.5 overflow-hidden">
              <div class="flex-1 min-w-0 h-full">
                <VideoPreview />
              </div>
              <Show when={chatReplaySignals.isDrawerOpen()}>
                <div class="w-80 shrink-0 h-full">
                  <ChatReplayDrawer />
                </div>
              </Show>
              <Show when={intelligenceSignals.isCandidatesDrawerOpen()}>
                <div class="w-84 shrink-0 h-full">
                  <HighlightCandidatesDrawer />
                </div>
              </Show>
            </div>

            {/* Center: Precision Multi-track Timeline */}
            <div class="shrink-0">
              <TimelineScrubber />
            </div>

            {/* Bottom: Clip Deck Docked Tray (Collapsible) */}
            <div class={`transition-all duration-200 flex flex-col shrink-0 ${isClipDeckCollapsed() ? "h-8" : "h-44"}`}>
              <div
                class="h-8 px-3 bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800/90 rounded-t-lg flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsClipDeckCollapsed(!isClipDeckCollapsed())}
              >
                <div class="flex items-center gap-2">
                  <Scissors size={12} class="text-blue-400" />
                  <span class="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
                    Clip Deck & Cuts
                  </span>
                  <span class="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px]">
                    {projectSignals.currentManifest()?.clips.length || 0}
                  </span>
                </div>

                <div class="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-xs">
                  <span class="text-[10px] font-medium">{isClipDeckCollapsed() ? "Expand Tray" : "Collapse Tray"}</span>
                  <Show when={isClipDeckCollapsed()} fallback={<ChevronDown size={13} />}>
                    <ChevronUp size={13} />
                  </Show>
                </div>
              </div>

              <Show when={!isClipDeckCollapsed()}>
                <div class="flex-1 min-h-0 overflow-hidden border-x border-b border-zinc-800/90 rounded-b-lg bg-zinc-950/60">
                  <ClipPlanList onPublishClip={handleOpenPublish} />
                </div>
              </Show>
            </div>
          </div>
        </div>

        {/* WORKSPACE 3: Deliver & Export Console */}
        <div
          class="h-full min-h-0 p-4 max-w-5xl mx-auto flex flex-col gap-4 overflow-hidden"
          style={{ display: projectSignals.activeWorkspaceTab() === "deliver" ? "flex" : "none" }}
        >
          <div class="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <div>
              <h2 class="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Export & Delivery Console
              </h2>
              <p class="text-[11px] text-zinc-400 mt-0.5">
                Batch render all pending vertical clips with Intel QuickSync / hardware acceleration.
              </p>
            </div>

            <button
              type="button"
              onClick={() => projectSignals.setWorkspaceTab("edit")}
              class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition"
            >
              &larr; Back to Studio
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-hidden">
            <ClipPlanList onPublishClip={handleOpenPublish} />
          </div>
        </div>
      </main>

      {/* Studio Modals */}
      <RenderQueueModal />
      <SettingsModal open={showSettings()} onClose={() => setShowSettings(false)} />
      <NewProjectModal open={showNewProject()} onClose={() => setShowNewProject(false)} />
      <ShortcutsModal open={showShortcuts()} onClose={() => setShowShortcuts(false)} />
      <ProjectManagerModal
        open={showProjectManager()}
        onClose={() => setShowProjectManager(false)}
        onStartNewProject={() => {
          setShowProjectManager(false);
          setShowNewProject(true);
        }}
      />
      <PublishModal
        open={showPublish()}
        clip={selectedClipForPublish()}
        onClose={() => {
          setShowPublish(false);
          setSelectedClipForPublish(null);
        }}
      />
    </div>
  );
};
export default App;
