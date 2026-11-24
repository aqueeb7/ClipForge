import { Component, createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { projectSignals } from "./stores/project";
import { chatReplaySignals } from "./stores/chatReplay";
import { intelligenceSignals } from "./stores/intelligence";
import { setupSleepAndLifecycleWatchers } from "./services/persistence";

import { Header } from "./components/Header";
import { VideoPreview } from "./components/VideoPreview";
import { UnifiedStudioSidebar } from "./components/UnifiedStudioSidebar";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { ClipPlanList } from "./components/ClipPlanList";
import { MediaPool } from "./components/MediaPool";
import { RenderQueueModal } from "./components/Modals/RenderQueueModal";
import { SettingsModal } from "./components/Modals/SettingsModal";
import { NewProjectModal } from "./components/Modals/NewProjectModal";
import { ShortcutsModal } from "./components/Modals/ShortcutsModal";
import { PublishModal } from "./components/Modals/PublishModal";
import { ProjectManagerModal } from "./components/Modals/ProjectManagerModal";
import type { Clip } from "./types/index.js";

export const App: Component = () => {
  const [showSettings, setShowSettings] = createSignal(false);
  const [showNewProject, setShowNewProject] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const [showPublish, setShowPublish] = createSignal(false);
  const [showProjectManager, setShowProjectManager] = createSignal(false);
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

        {/* WORKSPACE 2: Studio Workbench (3-Zone Studio Layout) */}
        <div
          class="h-full min-h-0 flex flex-col overflow-hidden"
          style={{ display: projectSignals.activeWorkspaceTab() === "edit" ? "flex" : "none" }}
        >
          {/* Zone 1 & 2: Top Stage - Expansive Hero Monitor (Left) & Unified Studio Sidebar (Right) */}
          <div class="flex-1 min-h-0 flex gap-2.5 p-3 pb-1.5 overflow-hidden">
            {/* Zone 1: Expansive Video Monitor Stage */}
            <div class="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
              <VideoPreview />
            </div>

            {/* Zone 2: Unified Studio Sidebar (Framing, Clips & Shorts, AI Intelligence, Audio & Sync) */}
            <UnifiedStudioSidebar onPublishClip={handleOpenPublish} />
          </div>

          {/* Zone 3: Full-Width Multi-Track Timeline Stage */}
          <div class="shrink-0 px-3 pb-3 w-full">
            <TimelineScrubber />
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
