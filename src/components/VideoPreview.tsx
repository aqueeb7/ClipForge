import { Component, createSignal, createMemo, createEffect, onCleanup, Show } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Split, Scissors } from "./Icons";

export const VideoPreview: Component = () => {
  let videoRef: HTMLVideoElement | undefined;
  let audioRef: HTMLAudioElement | undefined;

  const [videoLoadError, setVideoLoadError] = createSignal<string | null>(null);
  const [isMasterMuted, setIsMasterMuted] = createSignal(false);
  const [volume, setVolume] = createSignal(1.0);

  const videoUrl = projectSignals.videoAssetUrl;
  const audioUrl = projectSignals.audioAssetUrl;
  const hasDedicatedAudio = createMemo(() => Boolean(projectSignals.audioAssetUrl()));
  const audioOffsetMs = createMemo(() => projectSignals.currentProject()?.synchronization.audioOffsetMs || 0);
  const totalDuration = createMemo(() => projectSignals.videoMetadata()?.durationSeconds || 60);
  const composition = createMemo(() => projectSignals.currentProject()?.composition);

  const isVideoMuted = createMemo(() => isMasterMuted() || projectSignals.isVideoAudioMuted());
  const isDedicatedMuted = createMemo(() => isMasterMuted() || projectSignals.isDedicatedAudioMuted());

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  }

  function handleLoadedMetadata(e: Event) {
    setVideoLoadError(null);
    const vid = e.target as HTMLVideoElement;
    if (vid && vid.duration && isFinite(vid.duration) && vid.duration > 0) {
      projectSignals.syncVideoElementMetadata(vid.duration, vid.videoWidth, vid.videoHeight);
    }
    if (vid) {
      vid.muted = isVideoMuted();
      vid.volume = volume();
    }
  }

  function handleVideoError(e: Event) {
    const vid = e.target as HTMLVideoElement;
    if (vid && vid.error) {
      console.warn("HTML5 Video playback error:", vid.error);
      setVideoLoadError(`Playback note (code ${vid.error.code})`);
    }
  }

  function handleTimeUpdate() {
    if (videoRef && timelineSignals.isPlaying()) {
      timelineSignals.setCurrentTime(videoRef.currentTime);
    }
  }

  function syncAudioPlayback(playing: boolean) {
    if (!audioRef || !audioUrl()) return;
    const offsetSec = audioOffsetMs() / 1000;
    const targetAudioTime = timelineSignals.currentTime() + offsetSec;

    if (playing) {
      if (targetAudioTime >= 0) {
        if (Math.abs(audioRef.currentTime - targetAudioTime) > 0.08) {
          audioRef.currentTime = targetAudioTime;
        }
        audioRef.muted = isDedicatedMuted();
        audioRef.volume = volume();
        audioRef.play().catch(() => {});
      } else {
        audioRef.pause();
      }
    } else {
      audioRef.pause();
    }
  }

  function togglePlayback() {
    if (!videoRef) {
      timelineSignals.togglePlay();
      return;
    }
    if (videoRef.paused) {
      videoRef.muted = isVideoMuted();
      videoRef.volume = volume();
      videoRef
        .play()
        .then(() => {
          timelineSignals.play();
          syncAudioPlayback(true);
        })
        .catch(() => {
          if (videoRef) {
            videoRef
              .play()
              .then(() => {
                timelineSignals.play();
                syncAudioPlayback(true);
              })
              .catch(() => {});
          }
        });
    } else {
      videoRef.pause();
      timelineSignals.pause();
      syncAudioPlayback(false);
    }
  }

  function toggleMasterMute() {
    const next = !isMasterMuted();
    setIsMasterMuted(next);
    if (videoRef) {
      videoRef.muted = next || projectSignals.isVideoAudioMuted();
    }
    if (audioRef) {
      audioRef.muted = next || projectSignals.isDedicatedAudioMuted();
    }
  }

  function handleVolumeChange(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    setVolume(val);
    if (videoRef) {
      videoRef.volume = val;
      videoRef.muted = val === 0 ? true : isVideoMuted();
    }
    if (audioRef) {
      audioRef.volume = val;
      audioRef.muted = val === 0 ? true : isDedicatedMuted();
    }
  }

  function stepTime(deltaSeconds: number) {
    const newTime = Math.max(0, Math.min(totalDuration(), timelineSignals.currentTime() + deltaSeconds));
    timelineSignals.setCurrentTime(newTime);
    if (videoRef) {
      videoRef.currentTime = newTime;
    }
    if (audioRef && audioUrl()) {
      const targetAudioTime = newTime + audioOffsetMs() / 1000;
      if (targetAudioTime >= 0) {
        audioRef.currentTime = targetAudioTime;
      }
    }
  }

  createEffect(() => {
    const newTime = timelineSignals.currentTime();
    if (videoRef && Math.abs(videoRef.currentTime - newTime) > 0.3) {
      videoRef.currentTime = newTime;
    }
    if (audioRef && audioUrl()) {
      const targetAudioTime = newTime + audioOffsetMs() / 1000;
      if (targetAudioTime >= 0 && Math.abs(audioRef.currentTime - targetAudioTime) > 0.15) {
        audioRef.currentTime = targetAudioTime;
      }
    }
  });

  createEffect(() => {
    const playing = timelineSignals.isPlaying();
    if (videoRef) {
      if (playing && videoRef.paused) {
        videoRef.muted = isVideoMuted();
        videoRef.play().catch(() => {});
      } else if (!playing && !videoRef.paused) {
        videoRef.pause();
      }
    }
    syncAudioPlayback(playing);
  });

  return (
    <div class="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800/80 overflow-hidden select-none">
      {/* Top Monitor Header Bar */}
      <div class="px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs shrink-0">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
            Preview Monitor
          </span>
          <span class="text-[10px] font-mono text-zinc-500">
            {timelineSignals.isVerticalSimulated() ? "1080×1920 (9:16)" : "Source Canvas"}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              timelineSignals.isVerticalSimulated()
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={timelineSignals.toggleVerticalSimulated}
          >
            {timelineSignals.isVerticalSimulated() ? "9:16 Portrait" : "16:9 Raw"}
          </button>
        </div>
      </div>

      {/* Cinema Stage */}
      <div class="flex-1 min-h-0 bg-black flex items-center justify-center p-3 relative overflow-hidden">
        {/* Stage Frame */}
        <div
          class={`relative h-full overflow-hidden transition-all duration-200 flex flex-col justify-between items-center rounded-lg shadow-2xl border border-zinc-800/80 cursor-pointer ${
            timelineSignals.isVerticalSimulated()
              ? "aspect-[9/16] bg-zinc-950"
              : "aspect-video w-full max-w-[540px] bg-zinc-950"
          }`}
          onClick={togglePlayback}
        >
          {/* Background Layer in 9:16 mode */}
          <Show when={timelineSignals.isVerticalSimulated()}>
            <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
              <Show
                when={composition()?.background?.mode === "blur"}
                fallback={
                  <div
                    class="w-full h-full"
                    style={{ "background-color": composition()?.background?.color || "#000000" }}
                  />
                }
              >
                <div class="w-full h-full bg-zinc-900/90 backdrop-blur-md" style={{ "background-color": "#121216" }} />
              </Show>
            </div>
          </Show>

          {/* Top Brand Title Overlay */}
          <Show when={timelineSignals.isVerticalSimulated()}>
            <div class="relative z-20 pt-2 px-2 text-center pointer-events-none">
              <Show when={composition()?.overlay?.enabled && composition()?.overlay?.brandTitle}>
                <span class="inline-block px-2 py-0.5 bg-black/80 text-white text-[9px] font-black uppercase tracking-widest rounded border border-white/20 backdrop-blur shadow-sm">
                  {composition()?.overlay?.brandTitle}
                </span>
              </Show>
            </div>
          </Show>

          {/* Center Video Element */}
          <div class="relative w-full flex-1 flex items-center justify-center overflow-hidden z-10">
            <Show
              when={videoUrl()}
              fallback={
                <div class="flex flex-col items-center justify-center gap-1.5 p-4 text-center text-zinc-500 text-xs">
                  <span class="font-medium">No source video loaded</span>
                  <span class="text-[10px] text-zinc-600">Import gameplay via Media Pool or File menu</span>
                </div>
              }
            >
              <video
                ref={videoRef}
                src={videoUrl()!}
                class={`transition-transform duration-100 pointer-events-none ${
                  timelineSignals.isVerticalSimulated()
                    ? composition()?.gameplay?.mode === "cover"
                      ? "w-full h-full object-cover"
                      : composition()?.gameplay?.mode === "stretch"
                      ? "w-full h-full object-fill"
                      : "w-full h-auto max-h-full object-contain"
                    : "w-full h-full object-contain"
                }`}
                style={{
                  transform: `scale(${composition()?.gameplay?.scale || 1.0})`
                }}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onError={handleVideoError}
                playsinline
              />

              {/* Dedicated Audio Element */}
              <Show when={hasDedicatedAudio()}>
                <audio ref={audioRef} src={audioUrl()!} />
              </Show>
            </Show>
          </div>

          {/* Bottom Episode Label Overlay */}
          <Show when={timelineSignals.isVerticalSimulated()}>
            <div class="relative z-20 pb-2 px-2 text-center pointer-events-none">
              <Show when={composition()?.overlay?.enabled && composition()?.overlay?.episodeLabel}>
                <span class="inline-block px-2.5 py-0.5 bg-black/85 text-amber-400 font-mono font-black text-[10px] tracking-wider uppercase rounded border border-amber-400/30 backdrop-blur shadow-sm">
                  {composition()?.overlay?.episodeLabel} 001
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      {/* Docked Studio Transport Control Bar */}
      <div class="h-10 px-4 border-t border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between shrink-0 select-none">
        {/* Left: Step Frame + Play/Pause */}
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={() => stepTime(-1)}
            class="w-7 h-7 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center cursor-pointer transition"
            title="Step back 1s (Left Arrow)"
          >
            <SkipBack size={13} />
          </button>

          <button
            type="button"
            onClick={togglePlayback}
            class="w-8 h-7 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer shadow-sm transition"
            title="Play / Pause (Space)"
          >
            <Show when={timelineSignals.isPlaying()} fallback={<Play size={13} />}>
              <Pause size={13} />
            </Show>
          </button>

          <button
            type="button"
            onClick={() => stepTime(1)}
            class="w-7 h-7 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center cursor-pointer transition"
            title="Step forward 1s (Right Arrow)"
          >
            <SkipForward size={13} />
          </button>
        </div>

        {/* Center: Monospaced Precision Timecode */}
        <div class="flex items-center gap-2 font-mono text-xs">
          <span class="text-zinc-100 font-semibold tabular-nums text-sm">
            {formatTime(timelineSignals.currentTime())}
          </span>
          <span class="text-zinc-600">/</span>
          <span class="text-zinc-400 tabular-nums">
            {formatTime(totalDuration())}
          </span>
        </div>

        {/* Right: In/Out Markers, Split & Volume Slider */}
        <div class="flex items-center gap-2">
          <div class="flex items-center rounded bg-zinc-950 border border-zinc-800 p-0.5">
            <button
              type="button"
              onClick={() => timelineSignals.setInPoint()}
              class="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer transition"
              title="Set In Point ([)"
            >
              [ In
            </button>
            <button
              type="button"
              onClick={() => timelineSignals.setOutPoint()}
              class="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer transition"
              title="Set Out Point (])"
            >
              Out ]
            </button>
          </div>

          <button
            type="button"
            onClick={() => projectSignals.splitClipAt(timelineSignals.currentTime())}
            class="h-6 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-[10px] font-medium flex items-center gap-1 cursor-pointer transition"
            title="Split Part at Playhead (Ctrl+K)"
          >
            <Scissors size={11} />
            <span>Cut</span>
          </button>

          <div class="h-3 w-px bg-zinc-800" />

          {/* Volume Control */}
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMasterMute}
              class="text-zinc-400 hover:text-zinc-200 cursor-pointer"
              title="Mute / Unmute (M)"
            >
              <Show when={isMasterMuted()} fallback={<Volume2 size={13} />}>
                <VolumeX size={13} class="text-red-400" />
              </Show>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume()}
              onInput={handleVolumeChange}
              class="w-14 accent-blue-500 cursor-pointer"
              title={`Volume ${Math.round(volume() * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
