<script setup lang="ts">
import { ref, computed } from "vue";
import { useProjectStore } from "../stores/project";
import { useTimelineStore } from "../stores/timeline";
import { openFileDialog, isTauriEnvironment } from "../services/api";

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();

const manualVideoPath = ref("");
const manualAudioPath = ref("");
const fileInputRef = ref<HTMLInputElement | null>(null);
const audioFileInputRef = ref<HTMLInputElement | null>(null);
const isDraggingOver = ref(false);

const videoMetadata = computed(() => projectStore.videoMetadata);
const audioMetadata = computed(() => projectStore.audioMetadata);
const rawDuration = computed(() => projectStore.rawDuration);
const masterIn = computed(() => projectStore.masterInSeconds);
const masterOut = computed(() => projectStore.masterOutSeconds || rawDuration.value);
const activeDuration = computed(() => projectStore.activeStreamDuration);
const audioOffset = computed(() => projectStore.currentProject?.synchronization.audioOffsetMs || 0);

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

async function handleBrowseVideo() {
  if (isTauriEnvironment()) {
    const selected = await openFileDialog({
      title: "Select Master Gameplay / Livestream Video",
      filters: [{ name: "Video Files", extensions: ["mp4", "mkv", "mov", "webm", "avi"] }]
    });
    if (selected) {
      manualVideoPath.value = selected;
      await projectStore.loadVideoSource(selected);
    }
  } else {
    fileInputRef.value?.click();
  }
}

function handleFileInputChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    manualVideoPath.value = file.name;
    const blobUrl = URL.createObjectURL(file);
    projectStore.loadVideoSource(file.name, blobUrl);
  }
}

function handleDrop(e: DragEvent) {
  isDraggingOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    const filePath = (file as unknown as { path?: string }).path || file.name;
    manualVideoPath.value = filePath;
    const blobUrl = URL.createObjectURL(file);
    projectStore.loadVideoSource(filePath, blobUrl);
  }
}

async function handleLoadVideoManual() {
  if (manualVideoPath.value.trim()) {
    await projectStore.loadVideoSource(manualVideoPath.value.trim());
  }
}

async function handleBrowseAudio() {
  if (isTauriEnvironment()) {
    const selected = await openFileDialog({
      title: "Select Dedicated Audio Track (.weba, .wav, .mp3)",
      filters: [
        {
          name: "Audio Files (*.weba, *.wav, *.mp3, *.aac, *.m4a, *.flac, *.ogg, *.opus)",
          extensions: ["weba", "wav", "mp3", "aac", "m4a", "flac", "ogg", "opus", "wma", "mka"]
        },
        {
          name: "All Files (*.*)",
          extensions: ["*"]
        }
      ]
    });
    if (selected) {
      manualAudioPath.value = selected;
      await projectStore.loadAudioSource(selected);
    }
  } else {
    audioFileInputRef.value?.click();
  }
}

function handleAudioFileInputChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    manualAudioPath.value = file.name;
    projectStore.loadAudioSource(file.name);
  }
}

async function handleLoadAudioManual() {
  if (manualAudioPath.value.trim()) {
    await projectStore.loadAudioSource(manualAudioPath.value.trim());
  }
}

function handleDetachAudio() {
  manualAudioPath.value = "";
  projectStore.detachAudioSource();
}

function handleSetInAtPlayhead() {
  projectStore.setMasterIn(timelineStore.currentTime);
}

function handleSetOutAtPlayhead() {
  projectStore.setMasterOut(timelineStore.currentTime);
}

function handleResetTrim() {
  projectStore.resetMasterTrim();
}

function handleAdjustOffset(deltaMs: number) {
  projectStore.adjustAudioOffset(deltaMs);
}

function handleConfirmPatch() {
  projectStore.confirmMasterPatch();
}
</script>

<template>
  <div class="h-full flex flex-col gap-3 p-4 bg-dark-900/40 rounded-xl border border-zinc-800 overflow-y-auto">
    <!-- Hidden Inputs for Web Fallback -->
    <input
      ref="fileInputRef"
      type="file"
      accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
      class="hidden"
      @change="handleFileInputChange"
    />
    <input
      ref="audioFileInputRef"
      type="file"
      accept="audio/*,.weba,.opus,.mka"
      class="hidden"
      @change="handleAudioFileInputChange"
    />

    <!-- Header Section -->
    <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
          📁
        </div>
        <div>
          <h2 class="text-sm font-bold text-white tracking-wide flex items-center gap-2">
            Media Pool & Master Stream Prep
            <span class="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
              DaVinci Resolve Ingest Style
            </span>
          </h2>
          <p class="text-[11px] text-zinc-400">
            Import raw livestream video & separate audio track, establish master in/out bounds, and patch sync before part-wise clipping.
          </p>
        </div>
      </div>

      <button
        v-if="videoMetadata"
        type="button"
        @click="handleConfirmPatch"
        class="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer transition flex items-center gap-1.5"
      >
        <span>⚡ Lock Trim & Divide into Parts</span>
        <span>&rarr;</span>
      </button>
    </div>

    <!-- Media Pool Grid: Primary Video & Audio Assets -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <!-- 1. Master Video Asset Card -->
      <div
        class="p-4 rounded-xl border transition-all flex flex-col justify-between"
        :class="[
          isDraggingOver ? 'border-blue-500 bg-blue-950/20' : 'border-zinc-800 bg-zinc-950/60',
          videoMetadata ? 'ring-1 ring-blue-500/20' : ''
        ]"
        @dragover.prevent="isDraggingOver = true"
        @dragleave.prevent="isDraggingOver = false"
        @drop.prevent="handleDrop"
      >
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-200">Track 1: Primary Video Source</span>
            </div>
            <span
              v-if="videoMetadata"
              class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
            >
              ✓ Loaded
            </span>
            <span v-else class="text-[10px] font-mono text-zinc-500">
              Required
            </span>
          </div>

          <p class="text-xs text-zinc-400 mb-3 truncate" :title="projectStore.currentProject?.sources.video.path">
            {{ projectStore.currentProject?.sources.video.path || 'No video loaded yet' }}
          </p>

          <!-- Input / Browse Controls -->
          <div class="flex gap-2 mb-3">
            <input
              v-model="manualVideoPath"
              type="text"
              placeholder="Paste file path or drag video..."
              class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              @keyup.enter="handleLoadVideoManual"
            />
            <button
              type="button"
              @click="handleBrowseVideo"
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer transition"
            >
              Browse
            </button>
            <button
              v-if="manualVideoPath && !videoMetadata"
              type="button"
              @click="handleLoadVideoManual"
              class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              Load
            </button>
          </div>
        </div>

        <!-- Video Metadata Summary Chips -->
        <div v-if="videoMetadata" class="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80 text-xs font-mono">
          <div class="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/40">
            <div class="text-[9px] text-zinc-500 uppercase">Resolution</div>
            <div class="text-zinc-200 font-bold text-xs">{{ videoMetadata.width }}×{{ videoMetadata.height }}</div>
          </div>
          <div class="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/40">
            <div class="text-[9px] text-zinc-500 uppercase">Framerate</div>
            <div class="text-zinc-200 font-bold text-xs">{{ videoMetadata.fps }} fps</div>
          </div>
          <div class="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/40">
            <div class="text-[9px] text-zinc-500 uppercase">Raw Duration</div>
            <div class="text-zinc-200 font-bold text-xs">{{ formatTime(rawDuration) }}</div>
          </div>
          <div class="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/40">
            <div class="text-[9px] text-zinc-500 uppercase">Codec</div>
            <div class="text-zinc-200 font-bold text-xs uppercase">{{ videoMetadata.codec }}</div>
          </div>
        </div>
      </div>

      <!-- 2. Dedicated Audio Track Card -->
      <div
        class="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col justify-between"
        :class="audioMetadata ? 'ring-1 ring-indigo-500/20' : ''"
      >
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-200">Track 2: Dedicated Audio (.weba / mic)</span>
            </div>
            <span
              v-if="audioMetadata"
              class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
            >
              ✓ Patched
            </span>
            <span v-else class="text-[10px] font-mono text-zinc-500">
              Optional Sync
            </span>
          </div>

          <p class="text-xs text-zinc-400 mb-3 truncate" :title="projectStore.currentProject?.sources.audio?.path">
            {{ projectStore.currentProject?.sources.audio?.path || 'No separate audio attached (using video stream audio)' }}
          </p>

          <!-- Input / Browse Controls -->
          <div class="flex gap-2 mb-3">
            <input
              v-model="manualAudioPath"
              type="text"
              placeholder="Path to audio file (.weba, .wav, .mp3)..."
              class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
              @keyup.enter="handleLoadAudioManual"
            />
            <button
              type="button"
              @click="handleBrowseAudio"
              class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer transition"
            >
              Browse
            </button>
            <button
              v-if="manualAudioPath && !audioMetadata"
              type="button"
              @click="handleLoadAudioManual"
              class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              Load
            </button>
            <button
              v-if="audioMetadata"
              type="button"
              @click="handleDetachAudio"
              class="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded-lg text-xs font-medium cursor-pointer"
              title="Detach audio"
            >
              Detach
            </button>
          </div>
        </div>

        <!-- Audio Sync Offset Controls -->
        <div v-if="audioMetadata" class="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
          <div class="flex items-center gap-1.5">
            <span class="text-zinc-400 text-[11px]">Sync Offset:</span>
            <input
              type="number"
              step="25"
              :value="audioOffset"
              @change="projectStore.setAudioOffset(Number(($event.target as HTMLInputElement).value))"
              class="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-xs text-amber-300 font-bold"
            />
            <span class="text-zinc-500 text-[10px]">ms</span>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="handleAdjustOffset(-50)"
              class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-[10px] cursor-pointer"
            >
              -50ms
            </button>
            <button
              type="button"
              @click="handleAdjustOffset(50)"
              class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-[10px] cursor-pointer"
            >
              +50ms
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Master Stream Trim & Boundary Establishment (Before Part-wise Clipping) -->
    <div v-if="videoMetadata" class="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-200">
            Master Stream Boundary (Trim Intro & Outro Before Part-Wise Clipping)
          </h3>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-mono text-zinc-400">
            Active Stream: <strong class="text-emerald-400">{{ formatTime(activeDuration) }}</strong>
            <span class="text-zinc-500"> / {{ formatTime(rawDuration) }}</span>
          </span>
          <button
            type="button"
            @click="handleResetTrim"
            class="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer transition"
          >
            Reset Master Trim
          </button>
        </div>
      </div>

      <!-- Visual Stream Strip Map -->
      <div class="relative h-10 bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden flex items-center">
        <!-- Trimmed Intro Zone (Hatched) -->
        <div
          v-if="masterIn > 0"
          class="h-full bg-red-950/50 border-r-2 border-red-500 flex items-center justify-center px-2 select-none"
          :style="{ width: `${(masterIn / rawDuration) * 100}%` }"
        >
          <span class="text-[9px] font-mono text-red-300 uppercase font-bold truncate">
            Trimmed Intro (-{{ formatTime(masterIn) }})
          </span>
        </div>

        <!-- Active Content Zone (Glowing) -->
        <div
          class="h-full bg-emerald-950/30 border-y-2 border-emerald-500/50 flex-1 flex items-center justify-center px-2 select-none"
        >
          <span class="text-[10px] font-mono text-emerald-300 font-bold truncate">
            ★ Active Stream Content: {{ formatTime(activeDuration) }} (Parts start here)
          </span>
        </div>

        <!-- Trimmed Outro Zone (Hatched) -->
        <div
          v-if="masterOut < rawDuration"
          class="h-full bg-red-950/50 border-l-2 border-red-500 flex items-center justify-center px-2 select-none"
          :style="{ width: `${((rawDuration - masterOut) / rawDuration) * 100}%` }"
        >
          <span class="text-[9px] font-mono text-red-300 uppercase font-bold truncate">
            Trimmed Outro (-{{ formatTime(rawDuration - masterOut) }})
          </span>
        </div>
      </div>

      <!-- Quick Set Buttons -->
      <div class="flex items-center justify-between text-xs font-mono pt-1">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="handleSetInAtPlayhead"
            class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 rounded text-xs cursor-pointer transition"
          >
            [ Set Master In: {{ formatTime(masterIn) }}
          </button>
          <button
            type="button"
            @click="handleSetOutAtPlayhead"
            class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 rounded text-xs cursor-pointer transition"
          >
            Set Master Out: {{ formatTime(masterOut) }} ]
          </button>
        </div>

        <p class="text-[11px] text-zinc-400">
          Playhead is at: <strong class="text-white">{{ formatTime(timelineStore.currentTime) }}</strong>
        </p>
      </div>
    </div>
  </div>
</template>