<script setup lang="ts">
import { computed } from "vue";
import { useProjectStore } from "../stores/project";
import { openDirectoryDialog } from "../services/api";

const projectStore = useProjectStore();
const project = computed(() => projectStore.currentProject);

async function handleBrowseOutputDir() {
  const selected = await openDirectoryDialog("Select Export Output Directory");
  if (selected && project.value) {
    project.value.export.outputDirectory = selected;
  }
}

function onDurationChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  if (val > 0) {
    projectStore.updateClipSettings({ durationSeconds: val });
  }
}

function onOverlapChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  if (val >= 0) {
    projectStore.updateClipSettings({ overlapSeconds: val });
  }
}

function onBackgroundModeChange(mode: "blur" | "solid") {
  if (project.value) {
    project.value.composition.background.mode = mode;
    projectStore.generatePlan();
  }
}

function onGameplayModeChange(mode: "contain" | "crop") {
  if (project.value) {
    project.value.composition.gameplay.mode = mode;
    projectStore.generatePlan();
  }
}
</script>

<template>
  <div v-if="project" class="p-4 rounded-xl border border-zinc-800 bg-dark-900/50 space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        Project & Composition Settings
      </h3>
      <span class="text-[11px] font-mono text-zinc-400">1080×1920 (9:16) Vertical</span>
    </div>

    <!-- Project Name & Output Dir -->
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">Project Name</label>
        <input
          v-model="project.name"
          type="text"
          class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-medium focus:outline-none focus:border-blue-500"
          @change="projectStore.generatePlan"
        />
      </div>
      <div>
        <label class="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">Output Directory</label>
        <div class="flex gap-1.5">
          <input
            v-model="project.export.outputDirectory"
            type="text"
            class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            @click="handleBrowseOutputDir"
            class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium cursor-pointer"
          >
            Folder
          </button>
        </div>
      </div>
    </div>

    <!-- Clip Cadence Settings -->
    <div class="pt-2 border-t border-zinc-800/60">
      <div class="text-[11px] text-zinc-400 uppercase tracking-wider mb-2 font-medium">Automatic Clipping Cadence</div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-[10px] text-zinc-500 uppercase mb-1">Duration (s)</label>
          <input
            v-if="project.clipSettings.mode === 'automatic'"
            :value="project.clipSettings.durationSeconds"
            type="number"
            min="5"
            max="300"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono"
            @change="onDurationChange"
          />
        </div>
        <div>
          <label class="block text-[10px] text-zinc-500 uppercase mb-1">Overlap (s)</label>
          <input
            v-if="project.clipSettings.mode === 'automatic'"
            :value="project.clipSettings.overlapSeconds"
            type="number"
            min="0"
            max="30"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono"
            @change="onOverlapChange"
          />
        </div>
        <div>
          <label class="block text-[10px] text-zinc-500 uppercase mb-1">Starting Ep #</label>
          <input
            v-if="project.clipSettings.mode === 'automatic'"
            v-model.number="project.clipSettings.startingEpisode"
            type="number"
            min="1"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono"
            @change="projectStore.generatePlan"
          />
        </div>
      </div>
    </div>

    <!-- Composition & Overlays -->
    <div class="pt-2 border-t border-zinc-800/60">
      <div class="text-[11px] text-zinc-400 uppercase tracking-wider mb-2 font-medium">Vertical Layout & Canvas Mode</div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] text-zinc-500 uppercase mb-1">Background Mode</label>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              :class="project.composition.background.mode === 'blur' ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'"
              class="py-1 text-xs rounded font-medium transition cursor-pointer"
              @click="onBackgroundModeChange('blur')"
            >
              Blurred Video
            </button>
            <button
              type="button"
              :class="project.composition.background.mode === 'solid' ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'"
              class="py-1 text-xs rounded font-medium transition cursor-pointer"
              @click="onBackgroundModeChange('solid')"
            >
              Solid Color
            </button>
          </div>
        </div>

        <div>
          <label class="block text-[10px] text-zinc-500 uppercase mb-1">Gameplay Layout</label>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              :class="project.composition.gameplay.mode === 'contain' ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'"
              class="py-1 text-xs rounded font-medium transition cursor-pointer"
              @click="onGameplayModeChange('contain')"
            >
              Contain (Pillar)
            </button>
            <button
              type="button"
              :class="project.composition.gameplay.mode === 'crop' ? 'bg-blue-600 text-white' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'"
              class="py-1 text-xs rounded font-medium transition cursor-pointer"
              @click="onGameplayModeChange('crop')"
            >
              Full Crop
            </button>
          </div>
        </div>
      </div>

      <!-- Overlay Brand Text -->
      <div class="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label class="block text-[10px] text-zinc-500 uppercase mb-1">Top Brand Title</label>
          <input
            v-if="project.composition.overlay"
            v-model="project.composition.overlay.brandTitle"
            type="text"
            class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
            @change="projectStore.generatePlan"
          />
        </div>
        <div>
          <label class="block text-[10px] text-zinc-500 uppercase mb-1">Bottom Episode Label</label>
          <input
            v-if="project.composition.overlay"
            v-model="project.composition.overlay.episodeLabel"
            type="text"
            class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
            @change="projectStore.generatePlan"
          />
        </div>
      </div>
    </div>
  </div>
</template>
