<script setup lang="ts">
import { ref, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { openDirectoryDialog } from "../services/api";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const projectStore = useProjectStore();

const projectName = ref("New Project");
const outputDir = ref("");
const overwriteWarning = ref(false);

watch(
  () => props.open,
  (val) => {
    if (val) {
      projectName.value = "New Project " + new Date().toISOString().slice(0, 10);
      outputDir.value = projectStore.outputDirectory || "";
      overwriteWarning.value = projectStore.isDirty || !!projectStore.videoPath;
    }
  }
);

async function handleBrowseOutputDir() {
  const selected = await openDirectoryDialog("Select Default Export Directory");
  if (selected) {
    outputDir.value = selected;
  }
}

function handleCreate() {
  projectStore.createNewProject(projectName.value.trim() || "Untitled Project", outputDir.value || undefined);
  emit("close");
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div class="bg-dark-900 border border-zinc-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
      <!-- Modal Header -->
      <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-dark-950/60">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            ✨
          </div>
          <div>
            <h3 class="text-sm font-bold text-zinc-100">Create New Project</h3>
            <p class="text-[11px] text-zinc-400">Initialize a clean workspace for video clipping</p>
          </div>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="text-zinc-400 hover:text-zinc-200 text-lg cursor-pointer leading-none"
        >
          &times;
        </button>
      </div>

      <!-- Warning if unsaved changes exist -->
      <div
        v-if="overwriteWarning"
        class="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-start gap-2.5 text-xs text-amber-300"
      >
        <span class="text-base leading-none">⚠️</span>
        <div class="flex-1">
          <p class="font-semibold">Unsaved Work Detected</p>
          <p class="text-[11px] text-amber-400/80 mt-0.5">
            Creating a new project will clear the current video, timeline trims, and render manifest.
          </p>
        </div>
      </div>

      <!-- Form Body -->
      <div class="p-5 flex flex-col gap-4">
        <div>
          <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Project Name</label>
          <input
            v-model="projectName"
            type="text"
            placeholder="e.g., Stream Highlights Part 1"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500 transition"
            autofocus
            @keydown.enter="handleCreate"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Default Export Directory</label>
          <div class="flex items-center gap-2">
            <input
              v-model="outputDir"
              type="text"
              readonly
              placeholder="Select folder for exported clips..."
              class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 truncate focus:outline-none"
            />
            <button
              type="button"
              @click="handleBrowseOutputDir"
              class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium cursor-pointer transition shrink-0"
            >
              Browse
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3.5 bg-dark-950/80 border-t border-zinc-800 flex items-center justify-end gap-2.5">
        <button
          type="button"
          @click="emit('close')"
          class="px-3.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 cursor-pointer transition font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="handleCreate"
          class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-sm shadow-blue-500/20 transition"
        >
          Create Project
        </button>
      </div>
    </div>
  </div>
</template>
