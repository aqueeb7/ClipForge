<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useProjectStore } from "../stores/project";
import { useTimelineStore } from "../stores/timeline";
import { useQueueStore } from "../stores/queue";
import { getRecentProjects, clearRecentProjects, type RecentProjectItem } from "../services/persistence";
import { openFileDialog } from "../services/api";

const emit = defineEmits<{
  (e: "open-new-project"): void;
  (e: "open-shortcuts"): void;
  (e: "open-settings"): void;
  (e: "toggle-inspector"): void;
}>();

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();
const queueStore = useQueueStore();

const activeMenu = ref<string | null>(null);
const recentProjects = ref<RecentProjectItem[]>([]);

function refreshRecents() {
  recentProjects.value = getRecentProjects();
}

const projectName = computed(() => projectStore.currentProject?.name || "Untitled Project");
const isDirty = computed(() => projectStore.isDirty);

function toggleMenu(menu: string) {
  if (activeMenu.value === menu) {
    activeMenu.value = null;
  } else {
    activeMenu.value = menu;
    if (menu === "file") refreshRecents();
  }
}

function closeMenus() {
  activeMenu.value = null;
}

// File Menu Actions
function handleNewProject() {
  closeMenus();
  emit("open-new-project");
}

async function handleOpenProject() {
  closeMenus();
  await projectStore.openProject();
}

async function handleSaveProject() {
  closeMenus();
  await projectStore.saveProject();
}

async function handleSaveProjectAs() {
  closeMenus();
  await projectStore.saveProjectAs();
}

async function handleImportVideo() {
  closeMenus();
  const selected = await openFileDialog({
    title: "Import Master Video Source",
    filters: [{ name: "Video Files", extensions: ["mp4", "mkv", "mov", "webm", "avi"] }]
  });
  if (selected) {
    await projectStore.loadVideoSource(selected);
  }
}

async function handleImportAudio() {
  closeMenus();
  const selected = await openFileDialog({
    title: "Import Dedicated Audio Track",
    filters: [{ name: "Audio Files", extensions: ["weba", "wav", "mp3", "aac", "m4a", "flac", "ogg", "opus"] }]
  });
  if (selected) {
    await projectStore.loadAudioSource(selected);
  }
}

async function handleOpenRecent(item: RecentProjectItem) {
  closeMenus();
  await projectStore.openProject(item.filePath);
}

function handleClearRecents() {
  clearRecentProjects();
  recentProjects.value = [];
  closeMenus();
}

// Edit Menu Actions
function handleCutIntro() {
  closeMenus();
  projectStore.trimStreamHead(timelineStore.currentTime);
}

function handleCutOutro() {
  closeMenus();
  projectStore.trimStreamTail(timelineStore.currentTime);
}

function handleSplitPart() {
  closeMenus();
  projectStore.splitClipAt(timelineStore.currentTime);
}

function handleResetTrim() {
  closeMenus();
  projectStore.resetMasterTrim();
}

// View Menu Actions
function setTab(tab: "media" | "edit" | "deliver") {
  closeMenus();
  projectStore.setWorkspaceTab(tab);
}

function handleToggleInspector() {
  closeMenus();
  emit("toggle-inspector");
}

function handleZoomIn() {
  closeMenus();
  timelineStore.zoomIn();
}

function handleZoomOut() {
  closeMenus();
  timelineStore.zoomOut();
}

function handleZoomFit() {
  closeMenus();
  timelineStore.resetZoom();
}

function handleToggleExpand() {
  closeMenus();
  timelineStore.toggleTimelineExpanded();
}

// Render Menu Actions
function handleRenderAll() {
  closeMenus();
  if (!projectStore.currentProject) return;
  const clips = projectStore.currentManifest?.clips || [];
  if (clips.length === 0) return;
  queueStore.initQueueFromManifest(clips, projectStore.currentProject);
  queueStore.runExportQueue(projectStore.currentProject);
}

function handleRenderRemaining() {
  closeMenus();
  if (!projectStore.currentProject) return;
  const clips = projectStore.currentManifest?.clips || [];
  queueStore.exportRemainingClips(clips, projectStore.currentProject);
}

function handleOpenExports() {
  closeMenus();
  queueStore.openFolder();
}

async function handleCleanIncompleteFiles() {
  closeMenus();
  const count = await queueStore.cleanupExports();
  if (count > 0) {
    projectStore.statusMessage = `Cleaned up ${count} incomplete render file(s)`;
  } else {
    projectStore.statusMessage = "No incomplete or temporary render files found";
  }
}

// Global Click-Outside Handler
function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".app-menu-bar")) {
    closeMenus();
  }
}

// Global Keyboard Shortcut Handler
function onGlobalKeyDown(e: KeyboardEvent) {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;

  if (isCtrlOrCmd && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (e.shiftKey) {
      projectStore.saveProjectAs();
    } else {
      projectStore.saveProject();
    }
  } else if (isCtrlOrCmd && e.key.toLowerCase() === "o") {
    e.preventDefault();
    projectStore.openProject();
  } else if (isCtrlOrCmd && e.key.toLowerCase() === "n") {
    e.preventDefault();
    emit("open-new-project");
  } else if (isCtrlOrCmd && e.key.toLowerCase() === "i") {
    e.preventDefault();
    if (e.shiftKey) {
      handleImportAudio();
    } else {
      handleImportVideo();
    }
  } else if (isCtrlOrCmd && e.key.toLowerCase() === "k") {
    e.preventDefault();
    handleSplitPart();
  } else if (isCtrlOrCmd && e.key.toLowerCase() === "b") {
    e.preventDefault();
    emit("toggle-inspector");
  } else if (isCtrlOrCmd && e.key.toLowerCase() === "e") {
    e.preventDefault();
    handleOpenExports();
  } else if (e.key === "F1") {
    e.preventDefault();
    projectStore.setWorkspaceTab("media");
  } else if (e.key === "F2") {
    e.preventDefault();
    projectStore.setWorkspaceTab("edit");
  } else if (e.key === "F3") {
    e.preventDefault();
    projectStore.setWorkspaceTab("deliver");
  }
}

onMounted(() => {
  refreshRecents();
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("keydown", onGlobalKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  window.removeEventListener("keydown", onGlobalKeyDown);
});
</script>

<template>
  <div class="app-menu-bar h-7 bg-zinc-950 border-b border-zinc-800/80 px-3 flex items-center justify-between text-xs select-none z-50 text-zinc-300">
    <!-- Left: Top Menus -->
    <div class="flex items-center gap-0.5">
      <!-- 1. FILE MENU -->
      <div class="relative">
        <button
          type="button"
          @click.stop="toggleMenu('file')"
          class="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium"
          :class="activeMenu === 'file' ? 'bg-zinc-800 text-white' : ''"
        >
          File
        </button>

        <div
          v-if="activeMenu === 'file'"
          class="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col"
        >
          <button
            type="button"
            @click="handleNewProject"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>📄</span> New Project...</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+N</span>
          </button>

          <button
            type="button"
            @click="handleOpenProject"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>📂</span> Open Project...</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+O</span>
          </button>

          <button
            type="button"
            @click="handleSaveProject"
            :disabled="!projectStore.currentProject"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white disabled:opacity-40 flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>💾</span> Save Project</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+S</span>
          </button>

          <button
            type="button"
            @click="handleSaveProjectAs"
            :disabled="!projectStore.currentProject"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white disabled:opacity-40 flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>💾</span> Save Project As...</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+Shift+S</span>
          </button>

          <div class="h-[1px] bg-zinc-800 my-1"></div>

          <button
            type="button"
            @click="handleImportVideo"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>🎥</span> Import Master Video...</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+I</span>
          </button>

          <button
            type="button"
            @click="handleImportAudio"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>🎙</span> Import Dedicated Audio...</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+Shift+I</span>
          </button>

          <div class="h-[1px] bg-zinc-800 my-1"></div>

          <!-- Recents Submenu -->
          <div class="px-3 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Recent Projects</div>
          <template v-if="recentProjects.length > 0">
            <button
              v-for="rec in recentProjects"
              :key="rec.id"
              type="button"
              @click="handleOpenRecent(rec)"
              class="px-3 py-1 hover:bg-zinc-800 flex items-center justify-between cursor-pointer text-left"
              :title="rec.filePath"
            >
              <span class="truncate text-[11px] text-zinc-300">{{ rec.name }}</span>
              <span class="text-[9px] text-zinc-500 font-mono shrink-0 ml-2">
                {{ new Date(rec.lastOpened).toLocaleDateString() }}
              </span>
            </button>
            <button
              type="button"
              @click="handleClearRecents"
              class="px-3 py-1 text-[10px] text-zinc-500 hover:text-red-400 text-left hover:bg-zinc-800 cursor-pointer"
            >
              Clear Recent Projects
            </button>
          </template>
          <div v-else class="px-3 py-1 text-[10px] text-zinc-600 italic">No recent projects</div>
        </div>
      </div>

      <!-- 2. EDIT MENU -->
      <div class="relative">
        <button
          type="button"
          @click.stop="toggleMenu('edit')"
          class="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium"
          :class="activeMenu === 'edit' ? 'bg-zinc-800 text-white' : ''"
        >
          Edit
        </button>

        <div
          v-if="activeMenu === 'edit'"
          class="absolute top-full left-0 mt-1 w-60 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col"
        >
          <button
            type="button"
            @click="handleCutIntro"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>[ Cut Intro at Playhead</span>
            <span class="text-[10px] text-zinc-400 font-mono">[</span>
          </button>

          <button
            type="button"
            @click="handleCutOutro"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>Cut Outro at Playhead ]</span>
            <span class="text-[10px] text-zinc-400 font-mono">]</span>
          </button>

          <button
            type="button"
            @click="handleSplitPart"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>✂ Split Part at Playhead</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+K</span>
          </button>

          <button
            type="button"
            @click="handleResetTrim"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>↺ Reset Master Trim</span>
          </button>
        </div>
      </div>

      <!-- 3. VIEW MENU -->
      <div class="relative">
        <button
          type="button"
          @click.stop="toggleMenu('view')"
          class="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium"
          :class="activeMenu === 'view' ? 'bg-zinc-800 text-white' : ''"
        >
          View
        </button>

        <div
          v-if="activeMenu === 'view'"
          class="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col"
        >
          <button
            type="button"
            @click="setTab('media')"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>📁</span> Media Pool & Ingest</span>
            <span class="text-[10px] text-zinc-400 font-mono">F1</span>
          </button>

          <button
            type="button"
            @click="setTab('edit')"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>✂</span> Edit & Timeline Studio</span>
            <span class="text-[10px] text-zinc-400 font-mono">F2</span>
          </button>

          <button
            type="button"
            @click="setTab('deliver')"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>🚀</span> Deliver & Export Console</span>
            <span class="text-[10px] text-zinc-400 font-mono">F3</span>
          </button>

          <div class="h-[1px] bg-zinc-800 my-1"></div>

          <button
            type="button"
            @click="handleToggleInspector"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>Toggle Side Inspector</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+B</span>
          </button>

          <button
            type="button"
            @click="handleToggleExpand"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>Toggle Expanded Timeline</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+T</span>
          </button>

          <div class="h-[1px] bg-zinc-800 my-1"></div>

          <button
            type="button"
            @click="handleZoomIn"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>Zoom In Timeline</span>
            <span class="text-[10px] text-zinc-400 font-mono">+</span>
          </button>

          <button
            type="button"
            @click="handleZoomOut"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>Zoom Out Timeline</span>
            <span class="text-[10px] text-zinc-400 font-mono">-</span>
          </button>

          <button
            type="button"
            @click="handleZoomFit"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>Fit Whole Stream</span>
            <span class="text-[10px] text-zinc-400 font-mono">Fit</span>
          </button>
        </div>
      </div>

      <!-- 4. RENDER MENU -->
      <div class="relative">
        <button
          type="button"
          @click.stop="toggleMenu('render')"
          class="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium"
          :class="activeMenu === 'render' ? 'bg-zinc-800 text-white' : ''"
        >
          Render
        </button>

        <div
          v-if="activeMenu === 'render'"
          class="absolute top-full left-0 mt-1 w-60 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col"
        >
          <button
            type="button"
            @click="handleRenderRemaining"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>Render Remaining Parts</span>
          </button>

          <button
            type="button"
            @click="handleRenderAll"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span>Render All Parts</span>
          </button>

          <div class="h-[1px] bg-zinc-800 my-1"></div>

          <button
            type="button"
            @click="handleOpenExports"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>📂</span> Open Exports Directory</span>
            <span class="text-[10px] text-zinc-400 font-mono">Ctrl+E</span>
          </button>

          <button
            type="button"
            @click="handleCleanIncompleteFiles"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>🧹</span> Clean Incomplete Files</span>
          </button>
        </div>
      </div>

      <!-- 5. HELP MENU -->
      <div class="relative">
        <button
          type="button"
          @click.stop="toggleMenu('help')"
          class="px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition text-[11px] font-medium"
          :class="activeMenu === 'help' ? 'bg-zinc-800 text-white' : ''"
        >
          Help
        </button>

        <div
          v-if="activeMenu === 'help'"
          class="absolute top-full left-0 mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs flex flex-col"
        >
          <button
            type="button"
            @click="closeMenus(); emit('open-shortcuts')"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>⌨</span> Keyboard Shortcuts</span>
          </button>

          <button
            type="button"
            @click="closeMenus(); emit('open-settings')"
            class="px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer text-left"
          >
            <span class="flex items-center gap-2"><span>⚙</span> Settings & System Diagnostics</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Center: Project Title / Active File Indicator -->
    <div class="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 truncate max-w-sm">
      <span class="text-zinc-500 font-sans font-semibold">Project:</span>
      <span class="text-zinc-200 font-medium truncate">{{ projectName }}</span>
      <span v-if="projectStore.projectFilePath" class="text-[9px] text-zinc-500 truncate" :title="projectStore.projectFilePath">
        ({{ projectStore.projectFilePath.split(/[/\\]/).pop() }})
      </span>
      <span v-if="isDirty" class="text-amber-400 font-bold" title="Unsaved changes">*</span>
    </div>

    <!-- Right: Quick Save Action & Auto-Save Badge -->
    <div class="flex items-center gap-2">
      <span class="text-[9px] font-mono text-emerald-400/90 flex items-center gap-1" title="Changes auto-persisted against sleep/reloads">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>Auto-Save Active</span>
      </span>

      <button
        v-if="projectStore.currentProject"
        type="button"
        @click="handleSaveProject"
        class="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[10px] font-medium cursor-pointer transition flex items-center gap-1"
        title="Save project to disk (Ctrl+S)"
      >
        <span>💾 Save</span>
      </button>
    </div>
  </div>
</template>
