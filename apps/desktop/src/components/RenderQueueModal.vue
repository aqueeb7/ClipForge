<script setup lang="ts">
import { computed } from "vue";
import { useQueueStore } from "../stores/queue";

const queueStore = useQueueStore();

const show = computed(() => queueStore.showQueueModal);
const isExporting = computed(() => queueStore.isExporting);
const activeItem = computed(() => queueStore.activeItem);

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 select-none"
  >
    <div class="w-full max-w-xl bg-dark-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <!-- Modal Header -->
      <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full" :class="isExporting ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'"></div>
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-white">
              {{ isExporting ? 'Rendering Vertical 9:16 Video Clips...' : 'Batch Export Completed' }}
            </h2>
            <p class="text-xs text-zinc-400">
              {{ queueStore.completedItems }} of {{ queueStore.totalItems }} clips exported to:
              <span class="font-mono text-zinc-300 font-medium">{{ queueStore.exportDirectory }}</span>
            </p>
          </div>
        </div>

        <button
          v-if="!isExporting"
          @click="queueStore.closeModal"
          class="text-zinc-400 hover:text-white text-lg p-1 cursor-pointer"
        >
          &times;
        </button>
      </div>

      <!-- Overall Queue Progress -->
      <div class="p-4 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-col gap-2">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-zinc-400 uppercase tracking-wider text-[11px]">Overall Queue Progress</span>
          <span class="text-blue-400 font-bold">{{ queueStore.overallProgress }}%</span>
        </div>
        <div class="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <div
            class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
            :style="{ width: `${queueStore.overallProgress}%` }"
          ></div>
        </div>

        <!-- Active Item Metrics (FPS, Speed, ETA) -->
        <div v-if="isExporting && activeItem" class="mt-2 grid grid-cols-4 gap-2 text-xs">
          <div class="bg-dark-900/80 p-2 rounded border border-zinc-800/60">
            <div class="text-[9px] text-zinc-500 uppercase">Active Clip</div>
            <div class="font-mono text-zinc-200 truncate font-medium text-[11px]">{{ activeItem.title }}</div>
          </div>
          <div class="bg-dark-900/80 p-2 rounded border border-zinc-800/60">
            <div class="text-[9px] text-zinc-500 uppercase">Encoding FPS</div>
            <div class="font-mono text-emerald-400 font-medium text-[11px]">{{ activeItem.fps }} fps</div>
          </div>
          <div class="bg-dark-900/80 p-2 rounded border border-zinc-800/60">
            <div class="text-[9px] text-zinc-500 uppercase">Speed Multiplier</div>
            <div class="font-mono text-blue-400 font-medium text-[11px]">{{ activeItem.speed }}</div>
          </div>
          <div class="bg-dark-900/80 p-2 rounded border border-zinc-800/60">
            <div class="text-[9px] text-zinc-500 uppercase">Estimated ETA</div>
            <div class="font-mono text-yellow-400 font-medium text-[11px]">{{ activeItem.eta }}</div>
          </div>
        </div>
      </div>

      <!-- Queue List -->
      <div class="max-h-60 overflow-y-auto p-4 space-y-2">
        <div
          v-for="(item, index) in queueStore.queueItems"
          :key="item.id"
          class="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-xs font-mono"
        >
          <div class="flex flex-col truncate max-w-[320px]">
            <div class="flex items-center gap-2">
              <span class="text-zinc-500 w-4 font-semibold">#{{ index + 1 }}</span>
              <span class="font-medium text-zinc-200 truncate">{{ item.outputName }}</span>
              <span v-if="item.fileSizeBytes > 0" class="text-emerald-400 text-[10px]">
                ({{ formatBytes(item.fileSizeBytes) }})
              </span>
            </div>
            <span class="text-[10px] text-zinc-500 truncate pl-6 font-mono">
              {{ item.outputPath }}
            </span>
            <span v-if="item.error" class="text-[10px] text-red-400 pl-6">
              {{ item.error }}
            </span>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <span v-if="item.status === 'rendering'" class="text-blue-400 font-bold">
              {{ item.progress }}%
            </span>

            <span
              class="px-2 py-0.5 rounded text-[10px] uppercase font-bold"
              :class="{
                'bg-zinc-800 text-zinc-400': item.status === 'queued',
                'bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse': item.status === 'rendering',
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40': item.status === 'completed',
                'bg-red-500/20 text-red-400 border border-red-500/40': item.status === 'error',
                'bg-zinc-900 text-zinc-600': item.status === 'cancelled'
              }"
            >
              {{ item.status }}
            </span>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="p-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
        <button
          type="button"
          @click="queueStore.openFolder"
          class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
          title="Open Destination Folder"
        >
          <span>📂 Open in Explorer</span>
        </button>

        <div class="flex gap-2">
          <button
            v-if="isExporting"
            @click="queueStore.cancelExport"
            class="px-4 py-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
          >
            Cancel
          </button>
          <button
            v-else
            @click="queueStore.closeModal"
            class="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
