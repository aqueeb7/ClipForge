<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { useTimelineStore } from "../stores/timeline";

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();

const timelineTrackRef = ref<HTMLDivElement | null>(null);
const scrollContainerRef = ref<HTMLDivElement | null>(null);
const isDragging = ref(false);

const totalDuration = computed(() => projectStore.videoMetadata?.durationSeconds || 60);
const clips = computed(() => projectStore.currentManifest?.clips ?? []);
const hasAudioTrack = computed(() => Boolean(projectStore.audioMetadata));
const audioOffset = computed(() => projectStore.currentProject?.synchronization.audioOffsetMs || 0);

const masterInPercent = computed(() => {
  if (totalDuration.value <= 0) return 0;
  return Math.min(100, Math.max(0, (projectStore.masterInSeconds / totalDuration.value) * 100));
});

const masterOutPercent = computed(() => {
  const masterOut = projectStore.masterOutSeconds || totalDuration.value;
  if (totalDuration.value <= 0) return 100;
  return Math.min(100, Math.max(0, (masterOut / totalDuration.value) * 100));
});

const isIntroTrimmed = computed(() => projectStore.isIntroTrimmed);
const isOutroTrimmed = computed(() => projectStore.isOutroTrimmed);

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatPreciseTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

function handleSliceAtPlayhead() {
  projectStore.splitClipAt(timelineStore.currentTime);
}

function handleTrimHead() {
  projectStore.trimStreamHead(timelineStore.currentTime);
}

function handleTrimTail() {
  projectStore.trimStreamTail(timelineStore.currentTime);
}

function handleResetTrim() {
  projectStore.resetMasterTrim();
}

function handleDeleteSegment() {
  projectStore.deleteClipAt(timelineStore.currentTime, timelineStore.selectedClipId);
}

function handleMarkIn() {
  timelineStore.setInPoint();
}

function handleMarkOut() {
  timelineStore.setOutPoint();
}

function handleAddSelectionClip() {
  if (timelineStore.hasSelectionRange) {
    projectStore.addManualClipRange(timelineStore.inPoint!, timelineStore.outPoint!);
    timelineStore.clearMarkers();
  }
}

function handleDivideIntoParts() {
  projectStore.divideIntoParts();
}

function handleReturnToMaster() {
  projectStore.returnToMasterStream();
}

const playheadPositionPercent = computed(() => {
  if (totalDuration.value <= 0) return 0;
  return Math.min(100, Math.max(0, (timelineStore.currentTime / totalDuration.value) * 100));
});

const inPointPercent = computed(() => {
  if (timelineStore.inPoint === null || totalDuration.value <= 0) return null;
  return Math.min(100, Math.max(0, (timelineStore.inPoint / totalDuration.value) * 100));
});

const outPointPercent = computed(() => {
  if (timelineStore.outPoint === null || totalDuration.value <= 0) return null;
  return Math.min(100, Math.max(0, (timelineStore.outPoint / totalDuration.value) * 100));
});

function calculateTimeFromEvent(e: MouseEvent): number {
  if (!timelineTrackRef.value) return 0;
  const rect = timelineTrackRef.value.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
  return ratio * totalDuration.value;
}

function handleTrackClick(e: MouseEvent) {
  const time = calculateTimeFromEvent(e);
  timelineStore.setCurrentTime(time);
}

function startDrag(e: MouseEvent) {
  isDragging.value = true;
  handleTrackClick(e);
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", stopDrag);
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return;
  const time = calculateTimeFromEvent(e);
  timelineStore.setCurrentTime(time);
}

function stopDrag() {
  isDragging.value = false;
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", stopDrag);
}

function selectClip(clipId: string, start: number) {
  timelineStore.selectClip(clipId);
  timelineStore.setCurrentTime(start);
}

// Auto-scroll track container when zoomed in and playhead travels
watch(() => timelineStore.currentTime, (time) => {
  if (timelineStore.zoomLevel > 1 && scrollContainerRef.value && timelineTrackRef.value && !isDragging.value) {
    const container = scrollContainerRef.value;
    const trackWidth = timelineTrackRef.value.clientWidth;
    const playheadPx = (time / totalDuration.value) * trackWidth;
    const visibleLeft = container.scrollLeft;
    const visibleRight = container.scrollLeft + container.clientWidth;
    if (playheadPx < visibleLeft + 60 || playheadPx > visibleRight - 60) {
      container.scrollLeft = playheadPx - container.clientWidth / 2;
    }
  }
});
</script>

<template>
  <div class="p-3 rounded-xl border border-zinc-800 bg-dark-900/70 flex flex-col gap-2.5 select-none shrink-0 shadow-lg">
    <!-- Top Bar: Two-Stage Workflow Switcher & Tools -->
    <div class="flex items-center justify-between text-xs gap-2 flex-wrap border-b border-zinc-800/80 pb-2">
      <!-- Left: Two-Stage Workflow Switcher (Master Prep vs Part Clips) -->
      <div class="flex items-center gap-2">
        <div class="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button
            type="button"
            @click="handleReturnToMaster"
            class="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition flex items-center gap-1.5"
            :class="projectStore.isMasterStage
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'"
            title="Step 1: Trim dead air intro/outro and align audio before dividing into parts"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="projectStore.isMasterStage ? 'bg-white' : 'bg-amber-400'"></span>
            <span>1. 🎞 Master Prep (Trim & Audio Sync)</span>
          </button>

          <button
            type="button"
            @click="handleDivideIntoParts"
            class="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition flex items-center gap-1.5"
            :class="projectStore.isPartsStage
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'"
            title="Step 2: Stream divided into part clips for rendering"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="projectStore.isPartsStage ? 'bg-white' : 'bg-blue-400'"></span>
            <span>2. 📑 Part Clips ({{ clips.length > 0 ? `${clips.length} Parts` : 'Divide' }})</span>
          </button>
        </div>

        <span class="text-[11px] font-mono text-zinc-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 shadow-inner">
          Playhead: <strong class="text-white">{{ formatPreciseTime(timelineStore.currentTime) }}</strong> / {{ formatPreciseTime(totalDuration) }}
        </span>
      </div>

      <!-- Center: Contextual Editing Tools -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <!-- Stage 1 Specific Tools: Master Trimming -->
        <template v-if="projectStore.isMasterStage">
          <button
            type="button"
            @click="handleTrimHead"
            class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
            title="Trim and remove all stream footage before current playhead (Cut Intro)"
          >
            <span>[ Cut Intro</span>
          </button>

          <button
            type="button"
            @click="handleTrimTail"
            class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
            title="Trim and remove all stream footage after current playhead (Cut Outro)"
          >
            <span>Cut Outro ]</span>
          </button>

          <button
            v-if="isIntroTrimmed || isOutroTrimmed"
            type="button"
            @click="handleResetTrim"
            class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded text-[11px] font-medium transition cursor-pointer"
            title="Reset Master Trim to full stream duration"
          >
            ↺ Reset Trim
          </button>

          <div class="h-4 w-[1px] bg-zinc-700/60 mx-0.5"></div>

          <!-- Big Action Button to Partition -->
          <button
            type="button"
            @click="handleDivideIntoParts"
            class="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded text-[11px] font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
            title="Lock your intro/outro trim and separate stream into part clips"
          >
            <span>⚡ Lock Trim & Divide into Parts &rarr;</span>
          </button>
        </template>

        <!-- Stage 2 Specific Tools: Part Slicing & Razor -->
        <template v-else>
          <button
            type="button"
            @click="handleSliceAtPlayhead"
            class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-semibold tracking-wide transition cursor-pointer flex items-center gap-1 shadow-sm"
            title="Split active part clip at playhead (Razor Cut)"
          >
            <span>✂ Split Part</span>
          </button>

          <button
            type="button"
            @click="handleDeleteSegment"
            class="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 hover:text-red-200 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
            title="Delete segment under playhead"
          >
            <span>🗑 Delete</span>
          </button>

          <button
            type="button"
            @click="handleReturnToMaster"
            class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
            title="Return to Master Stream to adjust intro/outro trim or audio sync"
          >
            <span>&larr; Adjust Master Trim</span>
          </button>
        </template>

        <div class="h-4 w-[1px] bg-zinc-700/60 mx-0.5"></div>

        <button
          type="button"
          @click="handleMarkIn"
          class="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-blue-300 rounded text-[11px] font-mono cursor-pointer"
          title="Mark In point"
        >
          [ In
        </button>
        <button
          type="button"
          @click="handleMarkOut"
          class="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-blue-300 rounded text-[11px] font-mono cursor-pointer"
          title="Mark Out point"
        >
          Out ]
        </button>
        <button
          v-if="timelineStore.hasSelectionRange"
          type="button"
          @click="handleAddSelectionClip"
          class="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium cursor-pointer shadow-sm"
          title="Add In/Out range as manual clip"
        >
          + Add Range
        </button>
      </div>

      <!-- Right: Detailed Zoom & View Controls -->
      <div class="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
        <span class="text-[10px] uppercase font-mono text-zinc-500 font-bold">Zoom</span>
        
        <button
          type="button"
          @click="timelineStore.zoomOut"
          class="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded flex items-center justify-center text-xs font-mono cursor-pointer"
          title="Zoom Out"
        >
          -
        </button>

        <!-- Zoom Slider -->
        <input
          type="range"
          min="1"
          max="20"
          step="0.5"
          :value="timelineStore.zoomLevel"
          @input="e => timelineStore.setZoomLevel(Number((e.target as HTMLInputElement).value))"
          class="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
          title="Timeline Zoom Multiplier"
        />

        <button
          type="button"
          @click="timelineStore.zoomIn"
          class="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded flex items-center justify-center text-xs font-mono cursor-pointer"
          title="Zoom In"
        >
          +
        </button>

        <span class="text-[10px] font-mono text-zinc-400 w-7 text-center">
          {{ timelineStore.zoomLevel.toFixed(1) }}x
        </span>

        <button
          v-if="timelineStore.zoomLevel > 1"
          type="button"
          @click="timelineStore.resetZoom"
          class="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded text-[10px] font-mono cursor-pointer"
          title="Reset Zoom to 1x (Fit Whole Stream)"
        >
          Fit
        </button>

        <div class="h-3 w-[1px] bg-zinc-800 mx-0.5"></div>

        <!-- Toggle Detailed Height Expansion -->
        <button
          type="button"
          @click="timelineStore.toggleTimelineExpanded"
          class="px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer flex items-center gap-1"
          :class="timelineStore.isTimelineExpanded ? 'bg-violet-600 text-white shadow-sm' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'"
          title="Toggle Expanded Multi-Track View"
        >
          <span>{{ timelineStore.isTimelineExpanded ? '⤡ Compact' : '⤢ Expand' }}</span>
        </button>
      </div>
    </div>

    <!-- Horizontal Overflow Scroll Container for Zooming -->
    <div
      ref="scrollContainerRef"
      class="w-full overflow-x-auto overflow-y-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-inner scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900"
    >
      <div
        ref="timelineTrackRef"
        class="relative cursor-pointer select-none transition-[height] duration-200"
        :style="{
          width: `${timelineStore.zoomLevel * 100}%`,
          minWidth: '100%',
          height: timelineStore.isTimelineExpanded ? '118px' : '62px'
        }"
        @mousedown="startDrag"
      >
        <!-- Time Ruler Bar with Sub-divisions -->
        <div class="absolute inset-x-0 top-0 h-4 bg-zinc-900/90 border-b border-zinc-800/80 flex justify-between px-2 text-[9px] font-mono text-zinc-400 pointer-events-none z-10">
          <span>0:00</span>
          <span>{{ formatTime(totalDuration * 0.125) }}</span>
          <span>{{ formatTime(totalDuration * 0.25) }}</span>
          <span>{{ formatTime(totalDuration * 0.375) }}</span>
          <span>{{ formatTime(totalDuration * 0.5) }}</span>
          <span>{{ formatTime(totalDuration * 0.625) }}</span>
          <span>{{ formatTime(totalDuration * 0.75) }}</span>
          <span>{{ formatTime(totalDuration * 0.875) }}</span>
          <span>{{ formatTime(totalDuration) }}</span>
        </div>

        <!-- Trimmed Intro Zone (Hatched Out Dead Air) -->
        <div
          v-if="isIntroTrimmed && masterInPercent > 0"
          class="absolute top-4 bottom-0 left-0 bg-red-950/40 border-r-2 border-red-500/80 pointer-events-none z-15 flex items-center justify-center overflow-hidden"
          :style="{
            width: `${masterInPercent}%`,
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.15) 0, rgba(239, 68, 68, 0.15) 6px, transparent 6px, transparent 12px)'
          }"
        >
          <span class="text-[9px] font-mono text-red-300 font-bold px-1.5 py-0.5 bg-black/75 rounded border border-red-800/40 truncate">
            ✂ Trimmed Intro (-{{ formatTime(projectStore.masterInSeconds) }})
          </span>
        </div>

        <!-- Trimmed Outro Zone (Hatched Out Dead Air) -->
        <div
          v-if="isOutroTrimmed && masterOutPercent < 100"
          class="absolute top-4 bottom-0 right-0 bg-red-950/40 border-l-2 border-red-500/80 pointer-events-none z-15 flex items-center justify-center overflow-hidden"
          :style="{
            left: `${masterOutPercent}%`,
            width: `${100 - masterOutPercent}%`,
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.15) 0, rgba(239, 68, 68, 0.15) 6px, transparent 6px, transparent 12px)'
          }"
        >
          <span class="text-[9px] font-mono text-red-300 font-bold px-1.5 py-0.5 bg-black/75 rounded border border-red-800/40 truncate">
            ✂ Trimmed Outro
          </span>
        </div>

        <!-- In/Out Selection Range Overlay -->
        <div
          v-if="inPointPercent !== null && outPointPercent !== null && outPointPercent > inPointPercent"
          class="absolute top-4 bottom-0 bg-blue-500/20 border-l-2 border-r-2 border-blue-400 pointer-events-none z-20"
          :style="{
            left: `${inPointPercent}%`,
            width: `${outPointPercent - inPointPercent}%`
          }"
        >
          <span class="absolute top-0.5 left-1 text-[8px] font-mono text-blue-300 uppercase font-bold bg-blue-950/80 px-1 rounded">Selection</span>
        </div>

        <!-- Video Lane Content -->
        <!-- STAGE 1: Single Continuous Master Stream (Before Dividing into Parts) -->
        <div
          v-if="projectStore.isMasterStage"
          class="absolute inset-x-0 flex items-center px-0.5"
          :class="timelineStore.isTimelineExpanded ? 'top-5 h-14' : 'top-4 bottom-4'"
        >
          <div
            class="absolute rounded border border-blue-400/80 bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-blue-950/90 shadow-md flex items-center justify-between px-3 text-[11px] font-mono text-white transition-all overflow-hidden"
            :class="timelineStore.isTimelineExpanded ? 'h-12' : 'h-6'"
            :style="{
              left: `${masterInPercent}%`,
              width: `${Math.max(1, masterOutPercent - masterInPercent)}%`
            }"
          >
            <div class="flex items-center gap-2 truncate">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="font-bold tracking-tight text-zinc-100">Active Livestream Master</span>
              <span class="text-[10px] text-blue-300 font-semibold bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-700/50">
                Duration: {{ formatTime(projectStore.activeStreamDuration) }}
              </span>
            </div>
            <div class="text-[9px] text-zinc-300 font-medium truncate flex items-center gap-1.5">
              <span>{{ formatTime(projectStore.masterInSeconds) }} &rarr; {{ formatTime(projectStore.masterOutSeconds || totalDuration) }}</span>
              <span class="hidden md:inline px-1.5 py-0.5 rounded bg-blue-600/40 border border-blue-500/40 text-blue-200">
                Click "⚡ Divide into Parts" to slice
              </span>
            </div>
          </div>
        </div>

        <!-- STAGE 2: Divided Part-Wise Clips Track -->
        <div
          v-else
          class="absolute inset-x-0 flex items-center px-0.5"
          :class="timelineStore.isTimelineExpanded ? 'top-5 h-14' : 'top-4 bottom-4'"
        >
          <div
            v-for="(clip, index) in clips"
            :key="clip.id"
            class="absolute rounded border transition-all flex flex-col justify-center px-2 overflow-hidden text-[10px] font-mono cursor-pointer shadow-sm group"
            :class="[
              timelineStore.isTimelineExpanded ? 'h-12' : 'h-6',
              clip.id === timelineStore.selectedClipId
                ? 'bg-blue-600/90 border-blue-300 text-white shadow-lg ring-1 ring-blue-300 z-25'
                : index % 2 === 0
                  ? 'bg-violet-900/60 border-violet-500/70 text-violet-100 hover:bg-violet-800/70'
                  : 'bg-indigo-900/60 border-indigo-500/70 text-indigo-100 hover:bg-indigo-800/70'
            ]"
            :style="{
              left: `${(clip.sourceStartSeconds / totalDuration) * 100}%`,
              width: `${Math.max(0.6, ((clip.sourceEndSeconds - clip.sourceStartSeconds) / totalDuration) * 100)}%`
            }"
            @click.stop="selectClip(clip.id, clip.sourceStartSeconds)"
            :title="`${clip.title}: ${formatTime(clip.sourceStartSeconds)} - ${formatTime(clip.sourceEndSeconds)}`"
          >
            <div class="flex items-center justify-between w-full">
              <span class="truncate font-semibold tracking-tight">{{ clip.title }}</span>
              <span v-if="timelineStore.isTimelineExpanded" class="text-[9px] opacity-75 shrink-0 ml-1">
                {{ formatTime(clip.sourceEndSeconds - clip.sourceStartSeconds) }}
              </span>
            </div>
            <div v-if="timelineStore.isTimelineExpanded" class="text-[8px] text-zinc-300/80 truncate">
              {{ formatTime(clip.sourceStartSeconds) }} &rarr; {{ formatTime(clip.sourceEndSeconds) }}
            </div>
          </div>
        </div>

        <!-- Dedicated Audio Track Lane (Track 2) -->
        <div
          v-if="hasAudioTrack"
          class="absolute bottom-0 inset-x-0 bg-emerald-950/50 border-t border-emerald-800/50 flex items-center justify-between px-2 text-[9px] font-mono text-emerald-300 pointer-events-none"
          :class="timelineStore.isTimelineExpanded ? 'h-7' : 'h-3.5'"
        >
          <div class="flex items-center gap-1.5 truncate">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span class="font-bold">A2: Dedicated Audio</span>
            <span class="text-emerald-400/80">({{ projectStore.audioMetadata?.format?.toUpperCase() || '.WEBA' }})</span>
          </div>
          <div class="text-[8px] text-emerald-400 font-semibold bg-emerald-900/40 px-1.5 py-0.5 rounded border border-emerald-700/40">
            Sync Offset: {{ audioOffset >= 0 ? '+' : '' }}{{ audioOffset }}ms
          </div>
        </div>

        <!-- Playhead Line -->
        <div
          class="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none z-30 shadow-sm"
          :style="{ left: `${playheadPositionPercent}%` }"
        >
          <!-- Playhead Handle & Tooltip -->
          <div class="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-[1px] shadow-md border-2 border-white"></div>
        </div>
      </div>
    </div>
  </div>
</template>
