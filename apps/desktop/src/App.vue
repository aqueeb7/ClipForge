<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useProjectStore } from "./stores/project";
import { useTimelineStore } from "./stores/timeline";
import { useQueueStore } from "./stores/queue";
import { setupSleepAndLifecycleWatchers } from "./services/persistence";

import AppMenuBar from "./components/AppMenuBar.vue";
import Header from "./components/Header.vue";
import MediaSelector from "./components/MediaSelector.vue";
import ProjectConfig from "./components/ProjectConfig.vue";
import ClipPlanList from "./components/ClipPlanList.vue";
import VideoPreview from "./components/VideoPreview.vue";
import TimelineScrubber from "./components/TimelineScrubber.vue";
import ManualClipEditor from "./components/ManualClipEditor.vue";
import MediaPool from "./components/MediaPool.vue";
import RenderQueueModal from "./components/RenderQueueModal.vue";
import SettingsModal from "./components/SettingsModal.vue";
import NewProjectModal from "./components/NewProjectModal.vue";
import ShortcutsModal from "./components/ShortcutsModal.vue";

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();
const queueStore = useQueueStore();

const showSettings = ref(false);
const showNewProject = ref(false);
const showShortcuts = ref(false);
const isSidebarOpen = ref(true);

let cleanupLifecycle: (() => void) | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

function triggerDebouncedAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    projectStore.autoSave();
  }, 1000);
}

// Watch key reactive states to trigger persistence automatically
watch(
  () => [
    projectStore.currentProject?.name,
    projectStore.currentProject?.videoPath,
    projectStore.currentProject?.audioPath,
    projectStore.streamTrimStart,
    projectStore.streamTrimEnd,
    projectStore.isMasterPatched,
    projectStore.timelineStage,
    projectStore.activeWorkspaceTab,
    projectStore.audioOffsetMs,
    projectStore.currentManifest?.clips.length
  ],
  () => {
    triggerDebouncedAutoSave();
  },
  { deep: true }
);

onMounted(async () => {
  await projectStore.checkSystemEnvironment();

  // Rehydrate auto-saved session if present across sleep, reload, or crash
  await projectStore.restoreAutoSavedSession();

  // Setup OS sleep/wake and visibility lifecycle watchers
  cleanupLifecycle = setupSleepAndLifecycleWatchers(
    () => {
      // System going to sleep or app hidden
      projectStore.autoSave();
    },
    () => {
      // System resuming or tab active again
      if (!projectStore.currentProject) {
        projectStore.restoreAutoSavedSession();
      }
    }
  );
});

onUnmounted(() => {
  if (cleanupLifecycle) {
    cleanupLifecycle();
    cleanupLifecycle = null;
  }
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
});
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-dark-950 text-zinc-100 select-none">
    <!-- Desktop Native-Grade Menu Bar (File, Edit, View, Render, Help) -->
    <AppMenuBar
      class="shrink-0"
      @open-new-project="showNewProject = true"
      @open-shortcuts="showShortcuts = true"
      @open-settings="showSettings = true"
      @toggle-inspector="isSidebarOpen = !isSidebarOpen"
    />

    <!-- Top DaVinci Resolve Style Navigation Header -->
    <Header class="shrink-0" @open-settings="showSettings = true" />

    <!-- Error / Notice Banner -->
    <div
      v-if="projectStore.validationErrors.length > 0"
      class="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-red-400 shrink-0 z-30"
    >
      <div class="flex items-center gap-2">
        <span class="font-bold uppercase tracking-wider text-[11px]">Notice:</span>
        <span class="truncate">{{ projectStore.validationErrors.join("; ") }}</span>
      </div>
      <button @click="projectStore.validationErrors = []" class="text-zinc-400 hover:text-zinc-200 cursor-pointer ml-2">
        &times;
      </button>
    </div>

    <!-- Workspace View Switcher -->
    <main class="flex-1 min-h-0 overflow-hidden p-3 bg-dark-950">
      <!-- 1. Media Pool & Master Prep Workspace -->
      <section v-show="projectStore.activeWorkspaceTab === 'media'" class="h-full min-h-0">
        <MediaPool />
      </section>

      <!-- 2. Edit & Timeline Studio Workspace (Hero Monitor + Detailed Timeline) -->
      <section v-show="projectStore.activeWorkspaceTab === 'edit'" class="h-full min-h-0 flex gap-3 overflow-hidden">
        <!-- Collapsible Side Tools Panel (Inspector, Manual Cut & Auto-Partitioner) -->
        <aside
          v-show="isSidebarOpen"
          class="w-[360px] shrink-0 flex flex-col gap-3 overflow-y-auto pr-1 h-full min-h-0 transition-all duration-200"
        >
          <div class="flex items-center justify-between px-1">
            <span class="text-xs font-bold uppercase tracking-wider text-zinc-400">Stream Tools & Inspector</span>
            <button
              type="button"
              @click="isSidebarOpen = false"
              class="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
              title="Hide Side Inspector for Maximum Monitor View (Ctrl+B)"
            >
              ◀ Hide
            </button>
          </div>
          <MediaSelector />
          <ManualClipEditor />
          <ProjectConfig />
        </aside>

        <!-- Right/Center Main Studio: Preview Monitor, Zoomable Timeline, and Clip Manifest -->
        <div class="flex-1 flex flex-col gap-2.5 h-full min-h-0 overflow-hidden">
          <!-- Top Tool Strip with Sidebar Toggle -->
          <div v-if="!isSidebarOpen" class="flex items-center justify-between shrink-0 bg-dark-900/60 border border-zinc-800/80 px-3 py-1 rounded-lg">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-zinc-300">Timeline Focused Studio</span>
              <span class="text-[10px] font-mono text-zinc-400">Sidebar Collapsed</span>
            </div>
            <button
              type="button"
              @click="isSidebarOpen = true"
              class="text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40"
            >
              <span>▶ Show Inspector</span>
            </button>
          </div>

          <!-- Video Preview Monitor -->
          <div class="h-[270px] shrink-0">
            <VideoPreview />
          </div>

          <!-- Visual Timeline & Stream Slicer (With 1x-20x Zoom & Intro/Outro Zones) -->
          <div class="shrink-0">
            <TimelineScrubber />
          </div>

          <!-- Clip Manifest Table with Per-Clip Render Buttons -->
          <div class="flex-1 min-h-[140px] overflow-hidden">
            <ClipPlanList />
          </div>
        </div>
      </section>

      <!-- 3. Deliver & Export Workspace (Full-Width Render Console & Queue) -->
      <section v-show="projectStore.activeWorkspaceTab === 'deliver'" class="h-full min-h-0 flex flex-col gap-3">
        <div class="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-dark-900/80 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-base font-bold">
              🚀
            </div>
            <div>
              <h2 class="text-sm font-bold text-white tracking-wide">Delivery & Render Console</h2>
              <p class="text-[11px] text-zinc-400">
                Render individual parts on-demand or batch render remaining parts with persistent cache memory.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="projectStore.setWorkspaceTab('edit')"
              class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
            >
              <span>&larr; Back to Timeline</span>
            </button>
          </div>
        </div>

        <!-- Full Delivery Clip Manifest -->
        <div class="flex-1 min-h-0 overflow-hidden">
          <ClipPlanList />
        </div>
      </section>
    </main>

    <!-- Modals -->
    <RenderQueueModal />
    <SettingsModal :open="showSettings" @close="showSettings = false" />
    <NewProjectModal :open="showNewProject" @close="showNewProject = false" />
    <ShortcutsModal :open="showShortcuts" @close="showShortcuts = false" />
  </div>
</template>
