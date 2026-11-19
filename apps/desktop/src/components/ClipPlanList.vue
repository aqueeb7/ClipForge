<script setup lang="ts">
import { computed } from "vue";
import type { Clip } from "@clipforge/shared";
import { useProjectStore } from "../stores/project";
import { useTimelineStore } from "../stores/timeline";
import { useQueueStore } from "../stores/queue";
import { openInExplorer } from "../services/api";

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();
const queueStore = useQueueStore();

const manifest = computed(() => projectStore.currentManifest);
const clips = computed(() => manifest.value?.clips ?? []);
const project = computed(() => projectStore.currentProject);

const renderedCount = computed(() => clips.value.filter((c) => queueStore.isClipRendered(c.id)).length);
const unrenderedCount = computed(() => clips.value.length - renderedCount.value);

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function playClip(start: number) {
  timelineStore.setCurrentTime(start);
  timelineStore.play();
}

async function handleRenderSingleClip(clip: Clip) {
  if (!project.value) return;
  await queueStore.renderSingleClip(clip, project.value);
}

function handleOpenFile(clipId: string) {
  const info = queueStore.getRenderedInfo(clipId);
  if (info?.outputPath) {
    openInExplorer(info.outputPath);
  }
}

function handleStartExport() {
  if (!project.value || clips.value.length === 0) return;
  queueStore.initQueueFromManifest(clips.value, project.value);
  queueStore.runExportQueue(project.value);
}

async function handleExportRemaining() {
  if (!project.value) return;
  await queueStore.exportRemainingClips(clips.value, project.value);
}

function getActiveQueueItem(clipId: string) {
  return queueStore.queueItems.find((q) => q.id === clipId);
}
</script>

<template>
  <div class="rounded-xl border border-zinc-800 bg-dark-900/50 flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <div class="p-3 border-b border-zinc-800/80 flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-violet-500"></span>
          Clip Manifest
        </h3>
        <span v-if="clips.length > 0" class="text-xs font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
          {{ clips.length }} clips
        </span>
        <span v-if="renderedCount > 0" class="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ✓ {{ renderedCount }} / {{ clips.length }} Rendered
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-1.5" v-if="clips.length > 0">
        <button
          v-if="unrenderedCount > 0 && renderedCount > 0"
          type="button"
          @click="handleExportRemaining"
          :disabled="queueStore.isExporting"
          class="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1 shadow-sm"
          title="Export only clips that haven't been rendered yet"
        >
          <span>Render Remaining ({{ unrenderedCount }})</span>
        </button>

        <button
          type="button"
          @click="handleStartExport"
          :disabled="queueStore.isExporting"
          class="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold tracking-wide shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5 transition"
        >
          <span>Export All ({{ clips.length }})</span>
        </button>
      </div>
    </div>

    <!-- Table of Planned Clips -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="clips.length === 0" class="h-full flex flex-col items-center justify-center p-6 text-center">
        <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 text-amber-400 text-xl font-bold shadow-inner">
          🎞
        </div>
        <h3 class="text-sm font-bold text-white mb-1">Step 1: Master Stream Preparation Active</h3>
        <p class="text-xs text-zinc-400 max-w-md mb-3">
          Your video is loaded as a continuous master stream. Trim intro fluff, outro fluff, and align audio on the timeline first.
        </p>

        <div class="flex items-center gap-2 mb-4 text-xs font-mono bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
          <span class="text-zinc-500">Active Stream:</span>
          <span class="text-white font-semibold">{{ formatTime(projectStore.masterInSeconds) }}</span>
          <span class="text-zinc-600">&rarr;</span>
          <span class="text-white font-semibold">{{ formatTime(projectStore.masterOutSeconds || projectStore.rawDuration) }}</span>
          <span class="text-blue-400 font-bold">({{ formatTime(projectStore.activeStreamDuration) }})</span>
        </div>

        <button
          v-if="projectStore.videoMetadata"
          type="button"
          @click="projectStore.divideIntoParts"
          class="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer transition flex items-center gap-2"
        >
          <span>⚡ Lock Trim & Divide into Parts Now</span>
          <span>&rarr;</span>
        </button>
      </div>

      <table v-else class="w-full text-left border-collapse text-xs">
        <thead class="bg-zinc-950/80 text-[10px] uppercase tracking-wider text-zinc-400 sticky top-0 border-b border-zinc-800 z-10">
          <tr>
            <th class="py-2 px-2.5 w-8 text-center">#</th>
            <th class="py-2 px-2.5">Title</th>
            <th class="py-2 px-2.5">Time Range</th>
            <th class="py-2 px-2.5">Duration</th>
            <th class="py-2 px-2.5">Status & Output</th>
            <th class="py-2 px-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800/40">
          <tr
            v-for="clip in clips"
            :key="clip.id"
            class="hover:bg-zinc-800/30 transition-colors font-mono text-[11px] cursor-pointer"
            :class="clip.id === timelineStore.selectedClipId ? 'bg-blue-950/40' : ''"
            @click="timelineStore.selectClip(clip.id)"
          >
            <td class="py-2 px-2.5 text-center text-zinc-500">{{ clip.index }}</td>
            <td class="py-2 px-2.5 font-medium text-zinc-200">
              <span class="truncate block max-w-[140px]" :title="clip.title">{{ clip.title }}</span>
            </td>
            <td class="py-2 px-2.5 text-zinc-400 whitespace-nowrap">
              {{ formatTime(clip.sourceStartSeconds) }} &rarr; {{ formatTime(clip.sourceEndSeconds) }}
            </td>
            <td class="py-2 px-2.5 text-zinc-300">
              {{ (clip.sourceEndSeconds - clip.sourceStartSeconds).toFixed(1) }}s
            </td>

            <!-- Render Status & Output Badge -->
            <td class="py-2 px-2.5">
              <!-- Actively Rendering Status (Priority) -->
              <div v-if="queueStore.singleRenderingClipId === clip.id || getActiveQueueItem(clip.id)?.status === 'rendering'" class="flex items-center gap-1.5">
                <div class="flex flex-col gap-0.5 w-28">
                  <div class="flex items-center justify-between text-[10px] text-blue-400 font-semibold">
                    <span class="animate-pulse">Rendering...</span>
                    <span>{{ getActiveQueueItem(clip.id)?.progress || 0 }}%</span>
                  </div>
                  <div class="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-blue-500 transition-all duration-150"
                      :style="{ width: `${getActiveQueueItem(clip.id)?.progress || 0}%` }"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Rendered Status -->
              <div v-else-if="queueStore.isClipRendered(clip.id)" class="flex items-center gap-1.5">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span>✓</span>
                  <span>Rendered</span>
                  <span v-if="queueStore.getRenderedInfo(clip.id)?.fileSizeBytes" class="text-emerald-300/80 font-normal">
                    ({{ formatFileSize(queueStore.getRenderedInfo(clip.id)!.fileSizeBytes) }})
                  </span>
                </span>
              </div>

              <!-- Error or Cancelled Status -->
              <div v-else-if="getActiveQueueItem(clip.id)?.status === 'error' || getActiveQueueItem(clip.id)?.status === 'cancelled'" class="flex items-center gap-1.5">
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  :class="getActiveQueueItem(clip.id)?.status === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700/40'"
                  :title="getActiveQueueItem(clip.id)?.error || 'Render cancelled'"
                >
                  {{ getActiveQueueItem(clip.id)?.status === 'error' ? 'Failed' : 'Cancelled' }}
                </span>
              </div>

              <!-- Ready Status -->
              <div v-else>
                <span class="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
                  Ready
                </span>
              </div>
            </td>

            <!-- Action Buttons -->
            <td class="py-2 px-2.5 text-right whitespace-nowrap">
              <div class="flex items-center justify-end gap-1" @click.stop>
                <button
                  type="button"
                  @click="playClip(clip.sourceStartSeconds)"
                  class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
                  title="Play from clip start"
                >
                  Play
                </button>

                <!-- Cancel Button for Actively Rendering Single Clip -->
                <button
                  v-if="queueStore.singleRenderingClipId === clip.id"
                  type="button"
                  @click="queueStore.cancelSingleRender(clip.id)"
                  class="px-2 py-0.5 rounded bg-red-600/90 hover:bg-red-600 text-white font-medium text-[10px] cursor-pointer transition shadow-sm"
                  title="Cancel active render"
                >
                  Cancel
                </button>

                <!-- Single Clip Render Button (When not rendering) -->
                <button
                  v-else-if="!queueStore.isClipRendered(clip.id)"
                  type="button"
                  @click="handleRenderSingleClip(clip)"
                  :disabled="queueStore.isExporting || Boolean(queueStore.singleRenderingClipId)"
                  class="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-[10px] cursor-pointer transition shadow-sm"
                  title="Render this clip immediately"
                >
                  Render
                </button>

                <!-- Open File & Re-render for Rendered Clips -->
                <template v-else-if="queueStore.isClipRendered(clip.id)">
                  <button
                    type="button"
                    @click="handleOpenFile(clip.id)"
                    class="px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/50 text-emerald-300 text-[10px] cursor-pointer transition"
                    title="Open exported clip in Windows Explorer"
                  >
                    Open File
                  </button>
                  <button
                    type="button"
                    @click="handleRenderSingleClip(clip)"
                    :disabled="queueStore.isExporting || Boolean(queueStore.singleRenderingClipId)"
                    class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-400 hover:text-zinc-200 text-[10px] cursor-pointer"
                    title="Re-render clip"
                  >
                    ↻
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer Summary -->
    <div v-if="clips.length > 0" class="p-2 border-t border-zinc-800/80 bg-zinc-950/50 flex items-center justify-between text-xs text-zinc-400 font-mono">
      <span>{{ renderedCount }} of {{ clips.length }} clips rendered</span>
      <span class="text-emerald-400 font-medium">9:16 Vertical 1080×1920</span>
    </div>
  </div>
</template>
