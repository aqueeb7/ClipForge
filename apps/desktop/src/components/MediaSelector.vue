<script setup lang="ts">
import { ref } from "vue";
import { useProjectStore } from "../stores/project";
import { openFileDialog, isTauriEnvironment } from "../services/api";

const projectStore = useProjectStore();
const manualVideoPath = ref("");
const manualAudioPath = ref("");
const audioOffset = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);
const audioFileInputRef = ref<HTMLInputElement | null>(null);
const isDraggingOver = ref(false);

async function handleBrowseVideo() {
  if (isTauriEnvironment()) {
    const selected = await openFileDialog({
      title: "Select Gameplay Video File",
      filters: [{ name: "Video Files", extensions: ["mp4", "mkv", "mov", "webm", "avi"] }]
    });
    if (selected) {
      manualVideoPath.value = selected;
      await projectStore.loadVideoSource(selected);
    }
  } else {
    // In web browser, trigger native HTML file picker
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

function handleAudioFileInputChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    manualAudioPath.value = file.name;
    projectStore.loadAudioSource(file.name);
  }
}

function handleDrop(e: DragEvent) {
  isDraggingOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    // In Tauri, webkitRelativePath or path might exist on file
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
      title: "Select Dedicated Audio Track (Optional)",
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

async function handleLoadAudioManual() {
  if (manualAudioPath.value.trim()) {
    await projectStore.loadAudioSource(manualAudioPath.value.trim());
  }
}

function handleDetachAudio() {
  manualAudioPath.value = "";
  projectStore.detachAudioSource();
}

function handleUpdateOffset() {
  projectStore.setAudioOffset(Number(audioOffset.value));
}
</script>

<template>
  <div class="space-y-3">
    <!-- Hidden file inputs for web fallback -->
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

    <!-- Video Source Selection -->
    <div
      class="p-3.5 rounded-xl border transition-colors bg-dark-900/50"
      :class="isDraggingOver ? 'border-blue-500 bg-blue-950/20' : 'border-zinc-800'"
      @dragover.prevent="isDraggingOver = true"
      @dragleave.prevent="isDraggingOver = false"
      @drop.prevent="handleDrop"
    >
      <div class="flex items-center justify-between mb-2">
        <label class="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-blue-500"></span>
          Primary Video Source
        </label>
        <span v-if="projectStore.videoMetadata" class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          Loaded
        </span>
      </div>

      <div class="flex gap-2">
        <input
          v-model="manualVideoPath"
          type="text"
          placeholder="File path or drag video here..."
          class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
          @keyup.enter="handleLoadVideoManual"
        />
        <button
          type="button"
          @click="handleBrowseVideo"
          class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
        >
          Browse
        </button>
        <button
          v-if="manualVideoPath && !projectStore.videoMetadata"
          type="button"
          @click="handleLoadVideoManual"
          class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition cursor-pointer"
        >
          Load
        </button>
      </div>

      <!-- Video Inspection Details -->
      <div v-if="projectStore.videoMetadata" class="mt-2.5 grid grid-cols-4 gap-1.5 pt-2 border-t border-zinc-800/60 text-xs">
        <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
          <div class="text-[9px] text-zinc-500 uppercase">Resolution</div>
          <div class="font-mono text-zinc-200 font-medium text-[11px]">
            {{ projectStore.videoMetadata.width }}x{{ projectStore.videoMetadata.height }}
          </div>
        </div>
        <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
          <div class="text-[9px] text-zinc-500 uppercase">Duration</div>
          <div class="font-mono text-zinc-200 font-medium text-[11px]">
            {{ projectStore.videoMetadata.durationSeconds.toFixed(1) }}s
          </div>
        </div>
        <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
          <div class="text-[9px] text-zinc-500 uppercase">Framerate</div>
          <div class="font-mono text-zinc-200 font-medium text-[11px]">
            {{ projectStore.videoMetadata.fps }} fps
          </div>
        </div>
        <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
          <div class="text-[9px] text-zinc-500 uppercase">Codec</div>
          <div class="font-mono text-zinc-200 font-medium text-[11px]">
            {{ projectStore.videoMetadata.codec }}
          </div>
        </div>
      </div>
    </div>

    <!-- Optional Dedicated Audio Track -->
    <div class="p-3.5 rounded-xl border border-zinc-800 bg-dark-900/50">
      <div class="flex items-center justify-between mb-2">
        <label class="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
          Dedicated Audio Track (Optional Sync)
        </label>
        <span v-if="projectStore.audioMetadata" class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          Attached
        </span>
      </div>

      <div class="flex gap-2">
        <input
          v-model="manualAudioPath"
          type="text"
          placeholder="Path to microphone audio track (.weba, .wav, .mp3, .aac)..."
          class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
          @keyup.enter="handleLoadAudioManual"
        />
        <button
          type="button"
          @click="handleBrowseAudio"
          class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
        >
          Browse
        </button>
        <button
          v-if="manualAudioPath && !projectStore.audioMetadata"
          type="button"
          @click="handleLoadAudioManual"
          class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition cursor-pointer"
        >
          Load
        </button>
        <button
          v-if="projectStore.audioMetadata"
          type="button"
          @click="handleDetachAudio"
          class="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded-lg text-xs font-medium transition cursor-pointer"
          title="Detach audio track"
        >
          Detach
        </button>
      </div>

      <!-- Audio Track Inspection Details -->
      <div v-if="projectStore.audioMetadata" class="mt-2.5 grid grid-cols-3 gap-1.5 pt-2 border-t border-zinc-800/60 text-xs">
        <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
          <div class="text-[9px] text-zinc-500 uppercase">Duration</div>
          <div class="font-mono text-zinc-200 font-medium text-[11px]">
            {{ projectStore.audioMetadata.durationSeconds.toFixed(1) }}s
          </div>
        </div>
        <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
          <div class="text-[9px] text-zinc-500 uppercase">Codec / Format</div>
          <div class="font-mono text-zinc-200 font-medium text-[11px] uppercase">
            {{ projectStore.audioMetadata.codec }}
          </div>
        </div>
        <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
          <div class="text-[9px] text-zinc-500 uppercase">Audio Stream</div>
          <div class="font-mono text-emerald-400 font-medium text-[11px]">
            Ready
          </div>
        </div>
      </div>

      <!-- Sync Offset Controller -->
      <div v-if="projectStore.audioMetadata || manualAudioPath" class="mt-2.5 flex items-center gap-2 pt-2 border-t border-zinc-800/60">
        <span class="text-xs text-zinc-400">Offset (ms):</span>
        <input
          v-model.number="audioOffset"
          type="number"
          step="50"
          class="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 font-mono"
          @change="handleUpdateOffset"
        />
        <span class="text-[10px] text-zinc-500 font-mono">Positive: delay | Negative: advance</span>
      </div>
    </div>
  </div>
</template>
