<script setup lang="ts">
import { ref, computed } from "vue";
import { useProjectStore } from "../stores/project";
import { useTimelineStore } from "../stores/timeline";

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();

const newClipTitle = ref("");

const isManual = computed(() => projectStore.isManualMode);
const manualClips = computed(() =>
  projectStore.currentProject?.clipSettings.mode === "manual"
    ? projectStore.currentProject.clipSettings.clips
    : []
);

function switchMode(mode: "automatic" | "manual") {
  projectStore.setClippingMode(mode);
}

function handleAddFromSelection() {
  if (timelineStore.inPoint === null || timelineStore.outPoint === null) {
    // If no selection range, make a 60s clip starting at currentTime
    const start = timelineStore.currentTime;
    const end = Math.min(
      projectStore.videoMetadata?.durationSeconds || 120,
      start + 60
    );
    projectStore.addManualClipRange(
      start,
      end,
      newClipTitle.value.trim() || undefined
    );
  } else {
    projectStore.addManualClipRange(
      timelineStore.inPoint,
      timelineStore.outPoint,
      newClipTitle.value.trim() || undefined
    );
  }
  newClipTitle.value = "";
  timelineStore.clearMarkers();
}

function handleRemoveClip(index: number) {
  projectStore.removeManualClipItem(index);
}

function handleToggleClip(index: number) {
  projectStore.toggleManualClipItem(index);
}

function handleDuplicateClip(index: number) {
  const clip = manualClips.value[index - 1];
  if (clip) {
    projectStore.addManualClipRange(
      clip.start,
      clip.end,
      `${clip.title || 'Clip'} (Copy)`
    );
  }
}
</script>

<template>
  <div class="p-4 rounded-xl border border-zinc-800 bg-dark-900/60 flex flex-col gap-3">
    <!-- Mode Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full" :class="isManual ? 'bg-amber-500' : 'bg-blue-500'"></span>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          {{ isManual ? 'Manual Clip Sequencer' : 'Automatic Cadence Mode' }}
        </h3>
      </div>

      <div class="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
        <button
          type="button"
          :class="!isManual ? 'bg-blue-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'"
          class="px-2.5 py-1 text-xs rounded transition cursor-pointer"
          @click="switchMode('automatic')"
        >
          Auto Cadence
        </button>
        <button
          type="button"
          :class="isManual ? 'bg-amber-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'"
          class="px-2.5 py-1 text-xs rounded transition cursor-pointer"
          @click="switchMode('manual')"
        >
          Manual Clips
        </button>
      </div>
    </div>

    <!-- Manual Clips Action Bar -->
    <div v-if="isManual" class="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
      <input
        v-model="newClipTitle"
        type="text"
        placeholder="Custom Clip Title (optional)..."
        class="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
        @keyup.enter="handleAddFromSelection"
      />
      <button
        type="button"
        @click="handleAddFromSelection"
        class="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium cursor-pointer transition flex items-center gap-1"
      >
        <span>+ Add Clip</span>
        <span v-if="timelineStore.hasSelectionRange" class="font-mono text-[10px] text-amber-200">
          ({{ timelineStore.selectionDuration.toFixed(1) }}s)
        </span>
      </button>
    </div>

    <!-- Manual Clips List -->
    <div v-if="isManual" class="max-h-48 overflow-y-auto space-y-1.5 pr-1">
      <div v-if="manualClips.length === 0" class="text-zinc-500 text-xs py-4 text-center">
        No manual clips defined yet. Mark [ In ] and [ Out ] on the preview player and click "+ Add Clip".
      </div>

      <div
        v-for="(clip, idx) in manualClips"
        :key="idx"
        class="flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs font-mono"
      >
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            :checked="clip.enabled ?? true"
            @change="handleToggleClip(idx + 1)"
            class="rounded bg-zinc-900 border-zinc-700 text-blue-600 cursor-pointer"
          />
          <span class="text-zinc-500 w-4">#{{ idx + 1 }}</span>
          <span class="font-medium text-zinc-200">{{ clip.title || `Part ${String(idx + 1).padStart(3, '0')}` }}</span>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-zinc-400">
            {{ clip.start.toFixed(1) }}s &rarr; {{ clip.end.toFixed(1) }}s
          </span>
          <span class="text-amber-400/90 font-semibold">
            ({{ (clip.end - clip.start).toFixed(1) }}s)
          </span>

          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="handleDuplicateClip(idx + 1)"
              class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
              title="Duplicate Clip"
            >
              Dup
            </button>
            <button
              type="button"
              @click="handleRemoveClip(idx + 1)"
              class="px-1.5 py-0.5 rounded bg-red-900/40 hover:bg-red-800/60 text-red-300 text-[10px] cursor-pointer"
              title="Delete Clip"
            >
              Del
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Automatic Mode Explanation -->
    <div v-else class="text-xs text-zinc-400 bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-800/60">
      Clips are being automatically generated using fixed duration intervals. Switch to <strong class="text-amber-400 font-medium">Manual Clips</strong> mode if you want custom time ranges or selective clip extraction.
    </div>
  </div>
</template>
