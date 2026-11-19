<script setup lang="ts">
import { ref, computed } from "vue";
import { useProjectStore } from "../stores/project";
import type { VideoPreset } from "@clipforge/shared";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const projectStore = useProjectStore();
const project = computed(() => projectStore.currentProject);

const presets: VideoPreset[] = ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow"];

function onSave() {
  projectStore.generatePlan();
  emit("close");
}
</script>

<template>
  <div
    v-if="open && project"
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 select-none"
  >
    <div class="w-full max-w-md bg-dark-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-blue-500"></span>
          <h2 class="text-xs font-bold uppercase tracking-wider text-white">Export & Encoder Settings</h2>
        </div>
        <button @click="$emit('close')" class="text-zinc-400 hover:text-white text-lg p-1">
          &times;
        </button>
      </div>

      <!-- Settings Content -->
      <div class="p-5 space-y-4 text-xs">
        <!-- CRF Quality -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[11px] text-zinc-400 uppercase tracking-wider">Quality (CRF): {{ project.export.crf }}</label>
            <span class="text-[10px] text-zinc-500 font-mono">{{ project.export.crf <= 18 ? 'Near Lossless' : project.export.crf <= 23 ? 'Balanced' : 'Small File' }}</span>
          </div>
          <input
            v-model.number="project.export.crf"
            type="range"
            min="15"
            max="30"
            step="1"
            class="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        <!-- Encoding Preset -->
        <div>
          <label class="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1.5">FFmpeg Encoding Preset</label>
          <select
            v-model="project.export.preset"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
          >
            <option v-for="p in presets" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>

        <!-- Framerate -->
        <div>
          <label class="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1.5">Target Framerate</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              :class="project.export.frameRate === 30 ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'"
              class="py-1.5 rounded font-mono font-medium transition cursor-pointer"
              @click="project.export.frameRate = 30"
            >
              30 FPS
            </button>
            <button
              type="button"
              :class="project.export.frameRate === 60 ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'"
              class="py-1.5 rounded font-mono font-medium transition cursor-pointer"
              @click="project.export.frameRate = 60"
            >
              60 FPS
            </button>
          </div>
        </div>

        <!-- Directory Structure -->
        <div>
          <label class="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1.5">Output Directory Structure</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              :class="project.export.structure === 'flat' ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'"
              class="py-1.5 rounded font-mono font-medium transition cursor-pointer"
              @click="project.export.structure = 'flat'"
            >
              Flat (all in folder)
            </button>
            <button
              type="button"
              :class="project.export.structure === 'nested' ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'"
              class="py-1.5 rounded font-mono font-medium transition cursor-pointer"
              @click="project.export.structure = 'nested'"
            >
              Nested (folder/clip)
            </button>
          </div>
        </div>

        <!-- Naming Pattern -->
        <div>
          <label class="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1.5">Filename Pattern</label>
          <input
            v-model="project.export.namingPattern"
            type="text"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
          />
          <span class="text-[10px] text-zinc-500 mt-1 block">Tokens: {project}, {episode}, {title}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-2">
        <button
          type="button"
          @click="$emit('close')"
          class="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="onSave"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
        >
          Save Settings
        </button>
      </div>
    </div>
  </div>
</template>
