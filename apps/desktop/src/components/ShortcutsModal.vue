<script setup lang="ts">
defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const shortcutGroups = [
  {
    title: "Workspace & Navigation",
    shortcuts: [
      { key: "F1", desc: "Switch to Media Pool Workspace" },
      { key: "F2", desc: "Switch to Edit & Studio Workspace" },
      { key: "F3", desc: "Switch to Deliver & Export Workspace" },
      { key: "Space", desc: "Play / Pause Video Preview" },
      { key: "Ctrl + B", desc: "Toggle Stream Inspector Sidebar" }
    ]
  },
  {
    title: "Project & Media",
    shortcuts: [
      { key: "Ctrl + N", desc: "New Project" },
      { key: "Ctrl + O", desc: "Open Saved .clipforge Project" },
      { key: "Ctrl + S", desc: "Save Current Project" },
      { key: "Ctrl + Shift + S", desc: "Save Project As..." },
      { key: "Ctrl + I", desc: "Import Master Video Source" },
      { key: "Ctrl + Shift + I", desc: "Import Dedicated Audio Track (.weba, .wav...)" }
    ]
  },
  {
    title: "Timeline & Stream Trimming",
    shortcuts: [
      { key: "[", desc: "Cut Intro at Current Playhead (Trim Start)" },
      { key: "]", desc: "Cut Outro at Current Playhead (Trim End)" },
      { key: "Ctrl + K", desc: "Split Timeline & Add Part at Playhead" },
      { key: "Ctrl + R", desc: "Reset Trimming to Full Source Bounds" }
    ]
  },
  {
    title: "Render & Delivery",
    shortcuts: [
      { key: "Ctrl + E", desc: "Render All Remaining (Unrendered) Parts" },
      { key: "Ctrl + Shift + E", desc: "Force Re-render All Parts" }
    ]
  }
];
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div class="bg-dark-900 border border-zinc-800 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-dark-950/70 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-mono text-zinc-300">
            ⌘
          </div>
          <h3 class="text-sm font-bold text-zinc-100">Keyboard Shortcuts & Hotkeys</h3>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="text-zinc-400 hover:text-zinc-200 text-lg cursor-pointer leading-none"
        >
          &times;
        </button>
      </div>

      <!-- Shortcuts Body -->
      <div class="p-5 overflow-y-auto flex flex-col gap-5 divide-y divide-zinc-800/60">
        <div
          v-for="group in shortcutGroups"
          :key="group.title"
          class="pt-3 first:pt-0"
        >
          <h4 class="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2.5">
            {{ group.title }}
          </h4>
          <div class="grid grid-cols-1 gap-1.5">
            <div
              v-for="item in group.shortcuts"
              :key="item.key"
              class="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800/40 text-xs"
            >
              <span class="text-zinc-300">{{ item.desc }}</span>
              <kbd class="px-2 py-0.5 bg-zinc-950 border border-zinc-700/80 rounded text-[11px] font-mono text-zinc-200 shadow-sm">
                {{ item.key }}
              </kbd>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 bg-dark-950/80 border-t border-zinc-800 flex items-center justify-between shrink-0">
        <span class="text-[11px] text-zinc-500">ClipForge DaVinci Resolve Edition</span>
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium cursor-pointer transition"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
