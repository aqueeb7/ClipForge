<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { useTimelineStore } from "../stores/timeline";

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();

const videoRef = ref<HTMLVideoElement | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
const videoLoadError = ref<string | null>(null);
const isMasterMuted = ref(false);
const volume = ref(1.0);

const videoUrl = computed(() => projectStore.videoAssetUrl);
const audioUrl = computed(() => projectStore.audioAssetUrl);
const hasDedicatedAudio = computed(() => Boolean(projectStore.audioAssetUrl));
const audioOffsetMs = computed(() => projectStore.currentProject?.synchronization.audioOffsetMs || 0);
const totalDuration = computed(() => projectStore.videoMetadata?.durationSeconds || 60);
const composition = computed(() => projectStore.currentProject?.composition);

const isVideoMuted = computed(() => isMasterMuted.value || projectStore.isVideoAudioMuted);
const isDedicatedMuted = computed(() => isMasterMuted.value || projectStore.isDedicatedAudioMuted);

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

function handleLoadedMetadata(e: Event) {
  videoLoadError.value = null;
  const vid = e.target as HTMLVideoElement;
  if (vid && vid.duration && isFinite(vid.duration) && vid.duration > 0) {
    projectStore.syncVideoElementMetadata(vid.duration, vid.videoWidth, vid.videoHeight);
  }
  if (vid) {
    vid.muted = isVideoMuted.value;
    vid.volume = volume.value;
  }
}

function handleVideoError(e: Event) {
  const vid = e.target as HTMLVideoElement;
  if (vid && vid.error) {
    console.warn("HTML5 Video playback error:", vid.error);
    videoLoadError.value = `Playback note (code ${vid.error.code})`;
  }
}

function handleTimeUpdate() {
  if (videoRef.value && timelineStore.isPlaying) {
    timelineStore.setCurrentTime(videoRef.value.currentTime);
  }
}

function handlePlay() {
  timelineStore.play();
}

function handlePause() {
  timelineStore.pause();
}

function syncAudioPlayback(playing: boolean) {
  if (!audioRef.value || !audioUrl.value) return;
  const offsetSec = audioOffsetMs.value / 1000;
  const targetAudioTime = timelineStore.currentTime + offsetSec;

  if (playing) {
    if (targetAudioTime >= 0) {
      if (Math.abs(audioRef.value.currentTime - targetAudioTime) > 0.08) {
        audioRef.value.currentTime = targetAudioTime;
      }
      audioRef.value.muted = isDedicatedMuted.value;
      audioRef.value.volume = volume.value;
      audioRef.value.play().catch(() => {});
    } else {
      audioRef.value.pause();
    }
  } else {
    audioRef.value.pause();
  }
}

function togglePlayback() {
  if (!videoRef.value) {
    timelineStore.togglePlay();
    return;
  }
  if (videoRef.value.paused) {
    videoRef.value.muted = isVideoMuted.value;
    videoRef.value.volume = volume.value;
    videoRef.value
      .play()
      .then(() => {
        timelineStore.play();
        syncAudioPlayback(true);
      })
      .catch((err) => {
        console.warn("Play error, trying fallback:", err);
        if (videoRef.value) {
          videoRef.value
            .play()
            .then(() => {
              timelineStore.play();
              syncAudioPlayback(true);
            })
            .catch(() => {});
        }
      });
  } else {
    videoRef.value.pause();
    timelineStore.pause();
    syncAudioPlayback(false);
  }
}

function toggleMasterMute() {
  isMasterMuted.value = !isMasterMuted.value;
  if (videoRef.value) {
    videoRef.value.muted = isVideoMuted.value;
  }
  if (audioRef.value) {
    audioRef.value.muted = isDedicatedMuted.value;
  }
}

function toggleVideoAudioTrackMute() {
  projectStore.toggleVideoAudioMute();
  if (videoRef.value) {
    videoRef.value.muted = isVideoMuted.value;
  }
}

function toggleDedicatedAudioTrackMute() {
  projectStore.toggleDedicatedAudioMute();
  if (audioRef.value) {
    audioRef.value.muted = isDedicatedMuted.value;
  }
}

function handleVolumeChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  volume.value = val;
  if (videoRef.value) {
    videoRef.value.volume = val;
    videoRef.value.muted = val === 0 ? true : isVideoMuted.value;
  }
  if (audioRef.value) {
    audioRef.value.volume = val;
    audioRef.value.muted = val === 0 ? true : isDedicatedMuted.value;
  }
}

function adjustOffset(deltaMs: number) {
  projectStore.adjustAudioOffset(deltaMs);
}

function stepTime(deltaSeconds: number) {
  const newTime = Math.max(0, Math.min(totalDuration.value, timelineStore.currentTime + deltaSeconds));
  timelineStore.setCurrentTime(newTime);
  if (videoRef.value) {
    videoRef.value.currentTime = newTime;
  }
  if (audioRef.value && audioUrl.value) {
    const targetAudioTime = newTime + audioOffsetMs.value / 1000;
    if (targetAudioTime >= 0) {
      audioRef.value.currentTime = targetAudioTime;
    }
  }
}

watch(
  () => timelineStore.currentTime,
  (newTime) => {
    if (videoRef.value && Math.abs(videoRef.value.currentTime - newTime) > 0.3) {
      videoRef.value.currentTime = newTime;
    }
    if (audioRef.value && audioUrl.value) {
      const targetAudioTime = newTime + audioOffsetMs.value / 1000;
      if (targetAudioTime >= 0 && Math.abs(audioRef.value.currentTime - targetAudioTime) > 0.15) {
        audioRef.value.currentTime = targetAudioTime;
      }
    }
  }
);

watch(
  () => timelineStore.isPlaying,
  (playing) => {
    if (videoRef.value) {
      if (playing && videoRef.value.paused) {
        videoRef.value.muted = isMuted.value;
        videoRef.value.play().catch(() => {});
      } else if (!playing && !videoRef.value.paused) {
        videoRef.value.pause();
      }
    }
    syncAudioPlayback(playing);
  }
);

watch(audioOffsetMs, (newOffset) => {
  if (audioRef.value && audioUrl.value) {
    const targetAudioTime = timelineStore.currentTime + newOffset / 1000;
    if (targetAudioTime >= 0) {
      audioRef.value.currentTime = targetAudioTime;
    }
  }
});
</script>

<template>
  <div class="flex flex-col h-full bg-dark-900/60 rounded-xl border border-zinc-800 overflow-hidden">
    <!-- Header / Mode Switch -->
    <div class="px-4 py-1.5 border-b border-zinc-800/80 flex items-center justify-between text-xs shrink-0">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-blue-500"></span>
        <span class="font-semibold uppercase tracking-wider text-zinc-300">Preview Monitor</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          :class="timelineStore.isVerticalSimulated ? 'bg-blue-600 text-white font-medium' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'"
          class="px-2.5 py-0.5 rounded text-[11px] transition cursor-pointer"
          @click="timelineStore.toggleVerticalSimulated"
        >
          {{ timelineStore.isVerticalSimulated ? '9:16 Vertical Canvas' : '16:9 Raw Source' }}
        </button>
      </div>
    </div>

    <!-- Video Canvas Stage -->
    <div class="flex-1 min-h-0 bg-black/90 flex items-center justify-center p-2 relative overflow-hidden select-none">
      <!-- Outer Stage Frame -->
      <div
        class="relative h-full overflow-hidden transition-all duration-200 flex flex-col justify-between items-center rounded-lg shadow-2xl border border-zinc-800"
        :class="timelineStore.isVerticalSimulated ? 'aspect-[9/16] bg-zinc-950' : 'aspect-video w-full max-w-[520px] bg-zinc-950'"
        @click="togglePlayback"
      >
        <!-- Background Blur/Solid Layer (in 9:16 mode) -->
        <div
          v-if="timelineStore.isVerticalSimulated"
          class="absolute inset-0 overflow-hidden pointer-events-none z-0"
        >
          <div
            v-if="composition?.background.mode === 'blur'"
            class="w-full h-full bg-zinc-900/80 backdrop-blur-md"
            :style="{ backgroundColor: '#14141c' }"
          ></div>
          <div
            v-else
            class="w-full h-full"
            :style="{ backgroundColor: composition?.background.color || '#000000' }"
          ></div>
        </div>

        <!-- Top Overlay Brand Title (9:16 mode) -->
        <div
          v-if="timelineStore.isVerticalSimulated"
          class="relative z-20 pt-2 px-2 text-center pointer-events-none"
        >
          <span
            v-if="composition?.overlay?.enabled && composition?.overlay?.brandTitle"
            class="inline-block px-2.5 py-0.5 bg-black/80 text-white text-[9px] font-black uppercase tracking-widest rounded border border-white/20 backdrop-blur shadow-sm"
          >
            {{ composition.overlay.brandTitle }}
          </span>
        </div>

        <!-- Video Center Stage -->
        <div class="relative z-10 w-full my-auto flex items-center justify-center flex-1 min-h-0 overflow-hidden">
          <video
            v-if="videoUrl"
            ref="videoRef"
            :src="videoUrl"
            :muted="isVideoMuted"
            class="w-full h-full object-contain cursor-pointer"
            :class="timelineStore.isVerticalSimulated && composition?.gameplay.mode === 'crop' ? 'scale-175' : ''"
            playsinline
            @loadedmetadata="handleLoadedMetadata"
            @error="handleVideoError"
            @timeupdate="handleTimeUpdate"
            @play="handlePlay"
            @pause="handlePause"
          ></video>

          <!-- Synchronized Dedicated Audio Element -->
          <audio
            v-if="audioUrl"
            ref="audioRef"
            :src="audioUrl"
            preload="auto"
            class="hidden"
          ></audio>

          <div v-if="!videoUrl" class="text-zinc-600 text-xs font-mono text-center py-8">
            <div class="font-medium text-zinc-500">No Video Loaded</div>
            <div class="text-[10px] text-zinc-600 mt-0.5">Select a video file to begin</div>
          </div>

          <!-- Play Icon Overlay when paused -->
          <div
            v-if="videoUrl && !timelineStore.isPlaying"
            class="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none transition-opacity"
          >
            <div class="w-10 h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg pl-0.5">
              ▶
            </div>
          </div>
        </div>

        <!-- Bottom Overlay Episode Label (9:16 mode) -->
        <div
          v-if="timelineStore.isVerticalSimulated"
          class="relative z-20 pb-2 px-2 text-center pointer-events-none"
        >
          <span
            v-if="composition?.overlay?.enabled && composition?.overlay?.episodeLabel"
            class="inline-block px-2.5 py-0.5 bg-yellow-400 text-black text-[9px] font-black uppercase tracking-widest rounded shadow"
          >
            {{ composition.overlay.episodeLabel }} #01
          </span>
        </div>
      </div>
    </div>

    <!-- Audio Track Ingest & Sync Strip -->
    <div class="px-3 py-1.5 bg-zinc-950/90 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-300 gap-2 flex-wrap">
      <!-- Left: Track 1 & Track 2 Mute / Solo Controls -->
      <div class="flex items-center gap-2">
        <!-- Track 1: Embedded Video Audio -->
        <button
          type="button"
          @click="toggleVideoAudioTrackMute"
          class="px-2 py-0.5 rounded text-[10px] cursor-pointer font-medium flex items-center gap-1 transition"
          :class="projectStore.isVideoAudioMuted
            ? 'bg-red-950/60 border border-red-800/60 text-red-300'
            : 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'"
          title="Toggle Track 1 (Audio inside video file)"
        >
          <span>{{ projectStore.isVideoAudioMuted ? '🔇 T1 Video Audio: Muted' : '🔊 T1 Video Audio: Audible' }}</span>
        </button>

        <!-- Track 2: Dedicated Audio Track (.WEBA / .WAV) -->
        <button
          v-if="hasDedicatedAudio"
          type="button"
          @click="toggleDedicatedAudioTrackMute"
          class="px-2 py-0.5 rounded text-[10px] cursor-pointer font-medium flex items-center gap-1 transition"
          :class="projectStore.isDedicatedAudioMuted
            ? 'bg-red-950/60 border border-red-800/60 text-red-300'
            : 'bg-indigo-950/60 border border-indigo-800/60 text-indigo-300'"
          title="Toggle Track 2 (.WEBA / Separate Audio)"
        >
          <span>{{ projectStore.isDedicatedAudioMuted ? '🔇 T2 .WEBA: Muted' : '🎙 T2 .WEBA: Audible' }}</span>
        </button>
      </div>

      <!-- Right: Audio Sync Fine Tuning (if dedicated audio present) -->
      <div v-if="hasDedicatedAudio" class="flex items-center gap-1">
        <span class="text-zinc-400 text-[10px]">A2 Sync:</span>
        <button
          type="button"
          @click="adjustOffset(-100)"
          class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-[10px] cursor-pointer"
          title="Delay audio by 100ms"
        >
          -100ms
        </button>
        <button
          type="button"
          @click="adjustOffset(-25)"
          class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-[10px] cursor-pointer"
          title="Delay audio by 25ms"
        >
          -25ms
        </button>
        <span class="px-2 py-0.5 bg-zinc-900 rounded border border-zinc-800 text-amber-300 font-bold text-[10px]">
          {{ audioOffsetMs >= 0 ? '+' : '' }}{{ audioOffsetMs }}ms
        </span>
        <button
          type="button"
          @click="adjustOffset(25)"
          class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-[10px] cursor-pointer"
          title="Advance audio by 25ms"
        >
          +25ms
        </button>
        <button
          type="button"
          @click="adjustOffset(100)"
          class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-[10px] cursor-pointer"
          title="Advance audio by 100ms"
        >
          +100ms
        </button>
      </div>
    </div>

    <!-- Transport Controls Bar -->
    <div class="px-3 py-2 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between shrink-0">
      <!-- Step & Playback Buttons -->
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          @click="stepTime(-5)"
          class="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs font-mono cursor-pointer"
          title="Back 5s"
        >
          -5s
        </button>
        <button
          type="button"
          @click="stepTime(-1)"
          class="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs font-mono cursor-pointer"
          title="Back 1s"
        >
          -1s
        </button>
        <button
          type="button"
          @click="togglePlayback"
          class="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold tracking-wide cursor-pointer transition"
        >
          {{ timelineStore.isPlaying ? 'Pause' : 'Play' }}
        </button>
        <button
          type="button"
          @click="stepTime(1)"
          class="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs font-mono cursor-pointer"
          title="Forward 1s"
        >
          +1s
        </button>
        <button
          type="button"
          @click="stepTime(5)"
          class="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs font-mono cursor-pointer"
          title="Forward 5s"
        >
          +5s
        </button>

        <!-- Master Audio Volume / Mute Controls -->
        <div class="flex items-center gap-1.5 ml-1.5 pl-2 border-l border-zinc-800">
          <button
            type="button"
            @click="toggleMasterMute"
            class="p-1 rounded hover:bg-zinc-800 text-xs cursor-pointer flex items-center justify-center w-6 h-6"
            :title="isMasterMuted ? 'Unmute Master' : 'Mute Master'"
          >
            <span v-if="isMasterMuted" class="text-red-400 font-bold text-[11px]">🔇</span>
            <span v-else class="text-emerald-400 font-bold text-[11px]">🔊</span>
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="isMasterMuted ? 0 : volume"
            @input="handleVolumeChange"
            class="w-14 h-1.5 accent-blue-500 bg-zinc-800 rounded cursor-pointer"
            title="Master Volume"
          />
        </div>
      </div>

      <!-- Timecode Display -->
      <div class="font-mono text-xs text-zinc-300 flex items-center gap-1">
        <span class="text-white font-semibold">{{ formatTime(timelineStore.currentTime) }}</span>
        <span class="text-zinc-600">/</span>
        <span class="text-zinc-400">{{ formatTime(totalDuration) }}</span>
      </div>

      <!-- In / Out Marker Shortcuts -->
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          @click="timelineStore.setInPoint()"
          class="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-blue-400 border border-blue-500/30 rounded text-xs font-mono cursor-pointer"
          title="Set In-Point (I)"
        >
          [ In: {{ timelineStore.inPoint !== null ? formatTime(timelineStore.inPoint) : '--' }} ]
        </button>
        <button
          type="button"
          @click="timelineStore.setOutPoint()"
          class="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-emerald-500/30 rounded text-xs font-mono cursor-pointer"
          title="Set Out-Point (O)"
        >
          [ Out: {{ timelineStore.outPoint !== null ? formatTime(timelineStore.outPoint) : '--' }} ]
        </button>
        <button
          v-if="timelineStore.inPoint !== null || timelineStore.outPoint !== null"
          type="button"
          @click="timelineStore.clearMarkers()"
          class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded text-xs cursor-pointer"
          title="Clear Markers"
        >
          &times;
        </button>
      </div>
    </div>
  </div>
</template>
