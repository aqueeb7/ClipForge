<script setup lang="ts">
import { computed } from "vue";
import { useProjectStore } from "../stores/project";
import { useQueueStore } from "../stores/queue";

defineEmits<{
  (e: "open-settings"): void;
}>();

const projectStore = useProjectStore();
const queueStore = useQueueStore();

const envStatus = computed(() => projectStore.environmentStatus);
const isReady = computed(() => envStatus.value?.ready ?? false);

const clipsCount = computed(() => projectStore.currentManifest?.clips.length || 0);
const renderedCount = computed(() => {
  const clips = projectStore.currentManifest?.clips || [];
  return clips.filter(c => queueStore.isClipRendered(c.id)).length;
});
</script>

<template>
  <header class="h-14 border-b border-zinc-800 bg-dark-900/90 backdrop-blur px-5 flex items-center justify-between z-40">
    <!-- Brand / App Info -->
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
        CF
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-sm font-bold tracking-wide text-zinc-100">CLIPFORGE</h1>
          <span class="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">Resolve Studio</span>
        </div>
        <p class="text-[10px] text-zinc-400 font-medium">Local-First Vertical Video Engine</p>
      </div>
    </div>

    <!-- Center: DaVinci Resolve Style Workspace Navigation Bar -->
    <nav class="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 shadow-inner">
      <!-- 1. Media Pool & Ingest Tab -->
      <button
        type="button"
        @click="projectStore.setWorkspaceTab('media')"
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
        :class="projectStore.activeWorkspaceTab === 'media'
          ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'"
      >
        <span>📁 Media Pool</span>
        <span
          v-if="projectStore.videoMetadata"
          class="w-1.5 h-1.5 rounded-full bg-emerald-400"
          title="Source media attached"
        ></span>
      </button>

      <!-- 2. Edit & Timeline Studio Tab -->
      <button
        type="button"
        @click="projectStore.setWorkspaceTab('edit')"
        class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
        :class="projectStore.activeWorkspaceTab === 'edit'
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 border border-blue-500/50'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'"
      >
        <span>✂ Edit & Studio</span>
        <span
          v-if="clipsCount > 0"
          class="px-1.5 py-0.2 rounded text-[10px] font-mono"
          :class="projectStore.activeWorkspaceTab === 'edit' ? 'bg-blue-800/80 text-blue-100' : 'bg-zinc-800 text-zinc-400'"
        >
          {{ clipsCount }}
        </span>
      </button>

      <!-- 3. Deliver & Export Tab -->
      <button
        type="button"
        @click="projectStore.setWorkspaceTab('deliver')"
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
        :class="projectStore.activeWorkspaceTab === 'deliver'
          ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'"
      >
        <span>🚀 Deliver & Export</span>
        <span
          v-if="clipsCount > 0"
          class="px-1.5 py-0.2 rounded text-[10px] font-mono"
          :class="renderedCount === clipsCount && clipsCount > 0
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : projectStore.activeWorkspaceTab === 'deliver' ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-400'"
        >
          {{ renderedCount }}/{{ clipsCount }}
        </span>
      </button>
    </nav>

    <!-- Right: Engine Status & Settings -->
    <div class="flex items-center gap-2.5">
      <!-- Diagnostic Pill -->
      <div
        class="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono"
        :class="isReady ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'"
      >
        <span class="w-2 h-2 rounded-full" :class="isReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"></span>
        <span>{{ envStatus ? (isReady ? `Engine Ready (${envStatus.os})` : envStatus.message) : 'Checking System...' }}</span>
      </div>

      <!-- Settings Button -->
      <button
        type="button"
        @click="$emit('open-settings')"
        class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
      >
        <span>⚙ Settings</span>
      </button>
    </div>
  </header>
</template>
