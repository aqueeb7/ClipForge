import { Component, createSignal, createMemo, createEffect, onCleanup, Show, For } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals, type PreviewViewMode } from "../stores/timeline";
import { getMediaAssetUrl } from "../services/api";
import type { FramingTemplate, CropRegion } from "../types/index.js";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Split,
  Scissors,
  Sliders,
  Sparkles,
  Plus,
  RefreshCw,
  Layers,
} from "./Icons";

export const VideoPreview: Component = () => {
  let videoRef: HTMLVideoElement | undefined;
  let audioRef: HTMLAudioElement | undefined;
  let wideCanvasRef: HTMLDivElement | undefined;
  let verticalCanvasRef: HTMLCanvasElement | undefined;
  let overlayContainerRef: HTMLDivElement | undefined;
  let animationFrameId: number | null = null;

  const [videoLoadError, setVideoLoadError] = createSignal<string | null>(null);
  const [isMasterMuted, setIsMasterMuted] = createSignal(false);
  const [volume, setVolume] = createSignal(1.0);
  const [activeZone, setActiveZone] = createSignal<"top" | "bottom" | "pan">("top");
  const [showCropControls, setShowCropControls] = createSignal(true);

  type DragMode =
    | "move"
    | "resize-se"
    | "resize-e"
    | "resize-s"
    | "resize-w"
    | "resize-n"
    | "resize-nw"
    | "resize-ne"
    | "resize-sw"
    | null;

  interface ActiveDragState {
    zone: "top" | "bottom" | "pan";
    mode: DragMode;
    startMouseX: number;
    startMouseY: number;
    initialRegion: CropRegion;
    containerWidth: number;
    containerHeight: number;
  }

  const [activeDrag, setActiveDrag] = createSignal<ActiveDragState | null>(null);

  const activeFps = createMemo(() => {
    const vFps = projectSignals.videoMetadata()?.fps;
    if (vFps && vFps > 0) return Math.round(vFps);
    return timelineSignals.timelineFps() || 60;
  });

  const videoUrl = projectSignals.videoAssetUrl;
  const audioUrl = projectSignals.audioAssetUrl;
  const hasDedicatedAudio = createMemo(() => Boolean(projectSignals.audioAssetUrl()));
  const audioOffsetMs = createMemo(() => projectSignals.currentProject()?.synchronization.audioOffsetMs || 0);
  const totalDuration = createMemo(() => projectSignals.videoMetadata()?.durationSeconds || 60);
  const composition = createMemo(() => projectSignals.currentProject()?.composition);
  const stacking = createMemo(() => projectSignals.currentProject()?.composition?.stacking);

  const currentTemplate = createMemo<FramingTemplate>(
    () => stacking()?.template || "blur_fill"
  );

  const viewMode = () => timelineSignals.previewViewMode();

  const isVideoMuted = createMemo(() => isMasterMuted() || projectSignals.isVideoAudioMuted());
  const isDedicatedMuted = createMemo(() => isMasterMuted() || projectSignals.isDedicatedAudioMuted());

  const [logoAssetUrl, setLogoAssetUrl] = createSignal<string | null>(null);

  createEffect(() => {
    const rawPath = composition()?.overlay?.logoPath;
    if (rawPath) {
      getMediaAssetUrl(rawPath)
        .then((url) => setLogoAssetUrl(url))
        .catch(() => setLogoAssetUrl(null));
    } else {
      setLogoAssetUrl(null);
    }
  });

  // Crop regions from project stacking
  const topRegion = createMemo<CropRegion>(
    () => stacking()?.topRegion || { x: 2, y: 5, width: 28, height: 35 }
  );

  const bottomRegion = createMemo<CropRegion>(
    () => stacking()?.bottomRegion || { x: 0, y: 15, width: 100, height: 85 }
  );

  const cropRegion = createMemo<CropRegion>(
    () => stacking()?.cropRegion || { x: 21.875, y: 0, width: 56.25, height: 100 }
  );

  const topHeightPct = createMemo<number>(
    () => stacking()?.topHeightPercent ?? (currentTemplate() === "split_50_50" ? 50 : 35)
  );

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
    renderVerticalCanvasFrame();
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
        if (Math.abs(audioRef.currentTime - targetAudioTime) > 0.25) {
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
        .catch(() => {});
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

  function stepFrame(deltaFrames: number) {
    const fps = activeFps();
    const currentF = Math.round(timelineSignals.currentTime() * fps);
    const targetF = Math.max(0, Math.min(Math.round(totalDuration() * fps), currentF + deltaFrames));
    const newTime = targetF / fps;
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

  function handleStartDrag(
    zone: "top" | "bottom" | "pan",
    mode: DragMode,
    e: MouseEvent
  ) {
    e.stopPropagation();
    e.preventDefault();
    if (!overlayContainerRef) return;
    const rect = overlayContainerRef.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    setActiveZone(zone);
    const currentRegion =
      zone === "top" ? topRegion() : zone === "bottom" ? bottomRegion() : cropRegion();

    setActiveDrag({
      zone,
      mode,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      initialRegion: { ...currentRegion },
      containerWidth: rect.width,
      containerHeight: rect.height,
    });

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
  }

  function handleDragMove(e: MouseEvent) {
    const drag = activeDrag();
    if (!drag) return;

    const dxPct = ((e.clientX - drag.startMouseX) / drag.containerWidth) * 100;
    const dyPct = ((e.clientY - drag.startMouseY) / drag.containerHeight) * 100;

    if (drag.zone === "pan") {
      const panWidth = (100 * 9) / 16;
      const maxPanX = 100 - panWidth;
      const newX = Math.max(0, Math.min(maxPanX, drag.initialRegion.x + dxPct));
      projectSignals.updateComposition({
        stacking: {
          cropRegion: {
            ...cropRegion(),
            x: Math.round(newX * 100) / 100,
          },
        },
      });
      return;
    }

    const init = drag.initialRegion;
    let newX = init.x;
    let newY = init.y;
    let newW = init.width;
    let newH = init.height;

    if (drag.mode === "move") {
      newX = Math.max(0, Math.min(100 - init.width, init.x + dxPct));
      newY = Math.max(0, Math.min(100 - init.height, init.y + dyPct));
    } else if (drag.mode === "resize-se") {
      newW = Math.max(5, Math.min(100 - init.x, init.width + dxPct));
      newH = Math.max(5, Math.min(100 - init.y, init.height + dyPct));
    } else if (drag.mode === "resize-e") {
      newW = Math.max(5, Math.min(100 - init.x, init.width + dxPct));
    } else if (drag.mode === "resize-s") {
      newH = Math.max(5, Math.min(100 - init.y, init.height + dyPct));
    } else if (drag.mode === "resize-w") {
      const targetX = Math.max(0, Math.min(init.x + init.width - 5, init.x + dxPct));
      newW = init.width + (init.x - targetX);
      newX = targetX;
    } else if (drag.mode === "resize-n") {
      const targetY = Math.max(0, Math.min(init.y + init.height - 5, init.y + dyPct));
      newH = init.height + (init.y - targetY);
      newY = targetY;
    } else if (drag.mode === "resize-nw") {
      const targetX = Math.max(0, Math.min(init.x + init.width - 5, init.x + dxPct));
      const targetY = Math.max(0, Math.min(init.y + init.height - 5, init.y + dyPct));
      newW = init.width + (init.x - targetX);
      newH = init.height + (init.y - targetY);
      newX = targetX;
      newY = targetY;
    } else if (drag.mode === "resize-ne") {
      const targetY = Math.max(0, Math.min(init.y + init.height - 5, init.y + dyPct));
      newW = Math.max(5, Math.min(100 - init.x, init.width + dxPct));
      newH = init.height + (init.y - targetY);
      newY = targetY;
    } else if (drag.mode === "resize-sw") {
      const targetX = Math.max(0, Math.min(init.x + init.width - 5, init.x + dxPct));
      newW = init.width + (init.x - targetX);
      newH = Math.max(5, Math.min(100 - init.y, init.height + dyPct));
      newX = targetX;
    }

    const updatedRegion: CropRegion = {
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10,
      width: Math.round(newW * 10) / 10,
      height: Math.round(newH * 10) / 10,
    };

    if (drag.zone === "top") {
      projectSignals.updateComposition({
        stacking: { topRegion: updatedRegion },
      });
    } else if (drag.zone === "bottom") {
      projectSignals.updateComposition({
        stacking: { bottomRegion: updatedRegion },
      });
    }
  }

  function handleDragEnd() {
    setActiveDrag(null);
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", handleDragEnd);
  }

  onCleanup(() => {
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", handleDragEnd);
  });

  function setTemplate(template: FramingTemplate) {
    projectSignals.updateComposition({
      stacking: { template }
    });
  }

  function updateRegion(zone: "top" | "bottom" | "pan", field: "x" | "y" | "width" | "height", value: number) {
    if (zone === "top") {
      projectSignals.updateComposition({
        stacking: {
          topRegion: { ...topRegion(), [field]: value }
        }
      });
    } else if (zone === "bottom") {
      projectSignals.updateComposition({
        stacking: {
          bottomRegion: { ...bottomRegion(), [field]: value }
        }
      });
    } else if (zone === "pan") {
      projectSignals.updateComposition({
        stacking: {
          cropRegion: { ...cropRegion(), [field]: value }
        }
      });
    }
  }

  function quickPresetFacecam(pos: "top-left" | "top-right" | "top-center" | "full-width") {
    if (pos === "top-left") {
      projectSignals.updateComposition({
        stacking: { topRegion: { x: 2, y: 5, width: 28, height: 35 } }
      });
    } else if (pos === "top-right") {
      projectSignals.updateComposition({
        stacking: { topRegion: { x: 70, y: 5, width: 28, height: 35 } }
      });
    } else if (pos === "top-center") {
      projectSignals.updateComposition({
        stacking: { topRegion: { x: 36, y: 5, width: 28, height: 35 } }
      });
    } else if (pos === "full-width") {
      projectSignals.updateComposition({
        stacking: { topRegion: { x: 0, y: 0, width: 100, height: 45 } }
      });
    }
  }

  function handleCreateCustomShort() {
    const inp = timelineSignals.inPoint();
    const outp = timelineSignals.outPoint();
    const curr = timelineSignals.currentTime();

    const start = inp !== null ? inp : Math.max(0, curr - 5);
    const end = outp !== null && outp > start ? outp : Math.min(totalDuration(), start + 30);
    const dur = Math.round((end - start) * 10) / 10;
    const title = `Short #${projectSignals.shortClips().length + 1} (${dur}s • ${currentTemplate().replace("_", " ").toUpperCase()})`;

    projectSignals.addShortClip(start, end, {
      title,
      framingTemplate: currentTemplate(),
      stacking: stacking(),
    });
    projectSignals.setWorkspaceTab("edit");
  }

  createEffect(() => {
    const newTime = timelineSignals.currentTime();
    const playing = timelineSignals.isPlaying();

    // Master Clock: When playing, videoRef drives timelineSignals.currentTime naturally.
    // We only seek videoRef if paused (user dragging scrubber) or if there's an explicit jump (> 1.2s drift).
    if (videoRef) {
      const delta = Math.abs(videoRef.currentTime - newTime);
      if (!playing && delta > 0.04) {
        videoRef.currentTime = newTime;
      } else if (playing && delta > 1.2) {
        // User clicked a distant marker/chapter while playing
        videoRef.currentTime = newTime;
      }
    }

    if (audioRef && audioUrl()) {
      const targetAudioTime = newTime + audioOffsetMs() / 1000;
      if (targetAudioTime >= 0) {
        const audioDelta = Math.abs(audioRef.currentTime - targetAudioTime);
        if (!playing && audioDelta > 0.05) {
          audioRef.currentTime = targetAudioTime;
        } else if (playing && audioDelta > 0.35) {
          audioRef.currentTime = targetAudioTime;
        }
      }
    }

    // Only render canvas on static time change when paused (requestAnimationFrame loop handles playing state)
    if (!playing) {
      renderVerticalCanvasFrame();
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

  function drawCover(
    ctx: CanvasRenderingContext2D,
    img: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ) {
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
    const srcRatio = sw / sh;
    const dstRatio = dw / dh;

    let cropW = sw;
    let cropH = sh;
    let cropX = sx;
    let cropY = sy;

    if (srcRatio > dstRatio) {
      cropW = sh * dstRatio;
      cropX = sx + (sw - cropW) / 2;
    } else {
      cropH = sw / dstRatio;
      cropY = sy + (sh - cropH) / 2;
    }

    ctx.drawImage(img, cropX, cropY, cropW, cropH, dx, dy, dw, dh);
  }

  function renderVerticalCanvasFrame() {
    if (!verticalCanvasRef || !videoRef) return;
    if (videoRef.readyState < 2 || !videoRef.videoWidth || !videoRef.videoHeight) return;

    const ctx = verticalCanvasRef.getContext("2d");
    if (!ctx) return;

    const cw = verticalCanvasRef.width;
    const ch = verticalCanvasRef.height;
    const vw = videoRef.videoWidth;
    const vh = videoRef.videoHeight;
    const tmpl = currentTemplate();

    ctx.clearRect(0, 0, cw, ch);

    if (tmpl === "blur_fill") {
      const isBlur = (composition()?.background?.mode || "blur") === "blur";
      if (isBlur) {
        ctx.save();
        ctx.filter = "blur(14px) brightness(0.6)";
        ctx.drawImage(videoRef, 0, 0, cw, ch);
        ctx.restore();
      } else {
        ctx.fillStyle = composition()?.background?.color || "#09090b";
        ctx.fillRect(0, 0, cw, ch);
      }
      const targetH = cw * (vh / vw);
      const targetY = (ch - targetH) / 2;
      ctx.drawImage(videoRef, 0, targetY, cw, targetH);
    } else if (tmpl === "stacked_split" || tmpl === "split_50_50") {
      const topPct = topHeightPct() / 100;
      const topH = Math.round(ch * topPct);
      const btmH = ch - topH;

      // Top Zone: Facecam
      const tr = topRegion();
      const sx = Math.max(0, Math.min(vw, (tr.x / 100) * vw));
      const sy = Math.max(0, Math.min(vh, (tr.y / 100) * vh));
      const sw = Math.max(1, Math.min(vw - sx, (tr.width / 100) * vw));
      const sh = Math.max(1, Math.min(vh - sy, (tr.height / 100) * vh));
      drawCover(ctx, videoRef, sx, sy, sw, sh, 0, 0, cw, topH);

      // Clean divider line
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, topH - 1, cw, 2);

      // Bottom Zone: Gameplay / Screen
      const br = bottomRegion();
      const bx = Math.max(0, Math.min(vw, (br.x / 100) * vw));
      const by = Math.max(0, Math.min(vh, (br.y / 100) * vh));
      const bw = Math.max(1, Math.min(vw - bx, (br.width / 100) * vw));
      const bh = Math.max(1, Math.min(vh - by, (br.height / 100) * vh));
      drawCover(ctx, videoRef, bx, by, bw, bh, 0, topH, cw, btmH);
    } else if (tmpl === "pan_scan") {
      const pan = cropRegion();
      const cropW = (9 / 16) * vh;
      const px = Math.min(Math.max(0, (pan.x / 100) * vw), vw - cropW);
      ctx.drawImage(videoRef, px, 0, cropW, vh, 0, 0, cw, ch);
    }
  }

  function startCanvasRenderLoop() {
    if (animationFrameId !== null) return;
    const loop = () => {
      renderVerticalCanvasFrame();
      if (timelineSignals.isPlaying()) {
        animationFrameId = requestAnimationFrame(loop);
      } else {
        animationFrameId = null;
      }
    };
    animationFrameId = requestAnimationFrame(loop);
  }

  function stopCanvasRenderLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  createEffect(() => {
    // Redraw whenever composition framing settings change while paused
    topRegion();
    bottomRegion();
    cropRegion();
    topHeightPct();
    currentTemplate();
    composition();
    viewMode();
    if (!timelineSignals.isPlaying()) {
      renderVerticalCanvasFrame();
    }
  });

  createEffect(() => {
    if (timelineSignals.isPlaying()) {
      startCanvasRenderLoop();
    } else {
      stopCanvasRenderLoop();
      renderVerticalCanvasFrame();
    }
  });

  onCleanup(() => {
    stopCanvasRenderLoop();
  });

  return (
    <div class="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800/80 overflow-hidden select-none shadow-xl">
      {/* Top Monitor Header Bar: View Modes + Framing Templates */}
      <div class="px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
        {/* Left: View Mode Transform Switcher */}
        <div class="flex items-center gap-1.5 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => timelineSignals.setViewMode("wide")}
            class={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
              viewMode() === "wide"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="16:9 Cinema Widescreen Master Source"
          >
            <span>16:9 Wide</span>
          </button>

          <button
            type="button"
            onClick={() => timelineSignals.setViewMode("dual")}
            class={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
              viewMode() === "dual"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Dual View: 16:9 Source Feed + Live 9:16 Vertical Short Outcome"
          >
            <Split size={12} />
            <span>Dual Split</span>
          </button>

          <button
            type="button"
            onClick={() => timelineSignals.setViewMode("vertical")}
            class={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
              viewMode() === "vertical"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="9:16 Vertical Short Focus Simulator"
          >
            <span>9:16 Short</span>
          </button>
        </div>

        {/* Center: Framing & Stacking Template Selector */}
        <div class="flex items-center gap-1 bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800/80">
          <span class="text-[10px] font-mono text-zinc-500 uppercase px-1.5 pointer-events-none">
            Template:
          </span>

          <button
            type="button"
            onClick={() => setTemplate("blur_fill")}
            class={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              currentTemplate() === "blur_fill"
                ? "bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Standard Blurred Background with Centered 16:9 Video"
          >
            Blur Fill
          </button>

          <button
            type="button"
            onClick={() => setTemplate("stacked_split")}
            class={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
              currentTemplate() === "stacked_split"
                ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="2-Zone Stacked: Facecam / Speaker on Top + Gameplay / Screen on Bottom"
          >
            <Layers size={11} class="text-amber-400" />
            <span>Cam + Game</span>
          </button>

          <button
            type="button"
            onClick={() => setTemplate("pan_scan")}
            class={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              currentTemplate() === "pan_scan"
                ? "bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="9:16 Direct Crop & Drag Pan Window"
          >
            Pan & Scan
          </button>

          <button
            type="button"
            onClick={() => setTemplate("split_50_50")}
            class={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              currentTemplate() === "split_50_50"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="50/50 Dual Camera Split for Interviews / Reactions"
          >
            50/50 Split
          </button>
        </div>

        {/* Right: Toggle Crop Controls */}
        <Show when={currentTemplate() !== "blur_fill" && viewMode() !== "vertical"}>
          <button
            type="button"
            onClick={() => setShowCropControls(!showCropControls())}
            class={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer border ${
              showCropControls()
                ? "bg-zinc-800 border-zinc-700 text-zinc-200"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Toggle Visual Bounding Box Controls"
          >
            <Sliders size={10} class="inline mr-1" />
            <span>{showCropControls() ? "Hide Boxes" : "Edit Boxes"}</span>
          </button>
        </Show>
      </div>

      {/* Main Expansive Monitor Canvas Stage */}
      <div class="flex-1 min-h-0 bg-black flex items-center justify-center p-3 relative overflow-hidden gap-4">
        {/* ==================== VIEW 1: 16:9 WIDE SOURCE FEED ==================== */}
        <div
          ref={wideCanvasRef}
          class={`relative h-full aspect-video bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl items-center justify-center ${
            viewMode() === "vertical" ? "hidden" : "flex"
          } ${
            viewMode() === "dual" ? "max-w-[62%]" : "w-full max-w-5xl"
          }`}
          onClick={togglePlayback}
        >
          <Show
            when={videoUrl()}
            fallback={
              <div class="flex flex-col items-center justify-center gap-1.5 p-6 text-center text-zinc-500 text-xs">
                <span class="font-medium text-zinc-400">No source video loaded</span>
                <span class="text-[10px] text-zinc-600">Import stream or file via Media Pool</span>
              </div>
            }
          >
            <video
              ref={videoRef}
              src={videoUrl()!}
              class="w-full h-full object-contain pointer-events-none"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onError={handleVideoError}
              onEnded={() => {
                timelineSignals.pause();
                syncAudioPlayback(false);
              }}
              playsinline
            />

            <Show when={hasDedicatedAudio()}>
              <audio
                ref={audioRef}
                src={audioUrl()!}
                onEnded={() => {
                  timelineSignals.pause();
                }}
              />
            </Show>

            {/* Interactive Bounding Boxes Overlay for Stacking */}
            <Show when={showCropControls() && currentTemplate() !== "blur_fill"}>
              <div
                ref={overlayContainerRef}
                class="absolute inset-0 pointer-events-none z-20"
              >
                {/* Template: Stacked Split (Cam + Game) */}
                <Show when={currentTemplate() === "stacked_split" || currentTemplate() === "split_50_50"}>
                  {/* Top Zone: Facecam */}
                  <div
                    class={`absolute border-2 border-cyan-400 bg-cyan-500/15 pointer-events-auto cursor-move select-none transition-shadow ${
                      activeZone() === "top" ? "ring-2 ring-cyan-300 shadow-xl z-20" : "opacity-80 z-10"
                    }`}
                    style={{
                      left: `${topRegion().x}%`,
                      top: `${topRegion().y}%`,
                      width: `${topRegion().width}%`,
                      height: `${topRegion().height}%`,
                    }}
                    onMouseDown={(e) => handleStartDrag("top", "move", e)}
                  >
                    {/* Header Label & Live Stats */}
                    <div class="absolute -top-5 left-0 px-1.5 py-0.5 bg-cyan-500 text-black font-mono font-bold text-[9px] uppercase tracking-wider rounded-t flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                      <span>ZONE A: CAM / TOP ({topHeightPct()}%)</span>
                      <span class="opacity-80 font-normal">
                        [{topRegion().x.toFixed(0)}%, {topRegion().y.toFixed(0)}%, {topRegion().width.toFixed(0)}%×{topRegion().height.toFixed(0)}%]
                      </span>
                    </div>

                    {/* Resize Handles (Corner & Edge) */}
                    <Show when={activeZone() === "top"}>
                      <div
                        class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-cyan-900 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Top-Left"
                        onMouseDown={(e) => handleStartDrag("top", "resize-nw", e)}
                      />
                      <div
                        class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-cyan-900 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Top-Right"
                        onMouseDown={(e) => handleStartDrag("top", "resize-ne", e)}
                      />
                      <div
                        class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-cyan-900 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Bottom-Left"
                        onMouseDown={(e) => handleStartDrag("top", "resize-sw", e)}
                      />
                      <div
                        class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-cyan-900 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Bottom-Right (Freeform W/H)"
                        onMouseDown={(e) => handleStartDrag("top", "resize-se", e)}
                      />

                      <div
                        class="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-cyan-300 border border-cyan-900 rounded-full cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Width (Right)"
                        onMouseDown={(e) => handleStartDrag("top", "resize-e", e)}
                      />
                      <div
                        class="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-6 bg-cyan-300 border border-cyan-900 rounded-full cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Height (Bottom)"
                        onMouseDown={(e) => handleStartDrag("top", "resize-s", e)}
                      />
                      <div
                        class="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-cyan-300 border border-cyan-900 rounded-full cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Width (Left)"
                        onMouseDown={(e) => handleStartDrag("top", "resize-w", e)}
                      />
                      <div
                        class="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-6 bg-cyan-300 border border-cyan-900 rounded-full cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Height (Top)"
                        onMouseDown={(e) => handleStartDrag("top", "resize-n", e)}
                      />
                    </Show>
                  </div>

                  {/* Bottom Zone: Gameplay / Screen */}
                  <div
                    class={`absolute border-2 border-amber-400 bg-amber-500/15 pointer-events-auto cursor-move select-none transition-shadow ${
                      activeZone() === "bottom" ? "ring-2 ring-amber-300 shadow-xl z-20" : "opacity-80 z-10"
                    }`}
                    style={{
                      left: `${bottomRegion().x}%`,
                      top: `${bottomRegion().y}%`,
                      width: `${bottomRegion().width}%`,
                      height: `${bottomRegion().height}%`,
                    }}
                    onMouseDown={(e) => handleStartDrag("bottom", "move", e)}
                  >
                    {/* Header Label & Live Stats */}
                    <div class="absolute -top-5 left-0 px-1.5 py-0.5 bg-amber-500 text-black font-mono font-bold text-[9px] uppercase tracking-wider rounded-t flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                      <span>ZONE B: GAME / ACTION ({100 - topHeightPct()}%)</span>
                      <span class="opacity-80 font-normal">
                        [{bottomRegion().x.toFixed(0)}%, {bottomRegion().y.toFixed(0)}%, {bottomRegion().width.toFixed(0)}%×{bottomRegion().height.toFixed(0)}%]
                      </span>
                    </div>

                    {/* Resize Handles (Corner & Edge) */}
                    <Show when={activeZone() === "bottom"}>
                      <div
                        class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-amber-900 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Top-Left"
                        onMouseDown={(e) => handleStartDrag("bottom", "resize-nw", e)}
                      />
                      <div
                        class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-amber-900 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Top-Right"
                        onMouseDown={(e) => handleStartDrag("bottom", "resize-ne", e)}
                      />
                      <div
                        class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-amber-900 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Bottom-Left"
                        onMouseDown={(e) => handleStartDrag("bottom", "resize-sw", e)}
                      />
                      <div
                        class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-amber-900 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Bottom-Right (Freeform W/H)"
                        onMouseDown={(e) => handleStartDrag("bottom", "resize-se", e)}
                      />

                      <div
                        class="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-amber-300 border border-amber-900 rounded-full cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Width (Right)"
                        onMouseDown={(e) => handleStartDrag("bottom", "resize-e", e)}
                      />
                      <div
                        class="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-6 bg-amber-300 border border-amber-900 rounded-full cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Height (Bottom)"
                        onMouseDown={(e) => handleStartDrag("bottom", "resize-s", e)}
                      />
                      <div
                        class="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-amber-300 border border-amber-900 rounded-full cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Width (Left)"
                        onMouseDown={(e) => handleStartDrag("bottom", "resize-w", e)}
                      />
                      <div
                        class="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-6 bg-amber-300 border border-amber-900 rounded-full cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                        title="Resize Height (Top)"
                        onMouseDown={(e) => handleStartDrag("bottom", "resize-n", e)}
                      />
                    </Show>
                  </div>
                </Show>

                {/* Template: Pan & Scan 9:16 Window */}
                <Show when={currentTemplate() === "pan_scan"}>
                  <div
                    class="absolute top-0 bottom-0 border-2 border-purple-400 bg-purple-500/15 pointer-events-auto cursor-ew-resize transition-all shadow-xl select-none"
                    style={{
                      left: `${cropRegion().x}%`,
                      width: `${(100 * 9) / 16}%`,
                    }}
                    onMouseDown={(e) => handleStartDrag("pan", "move", e)}
                  >
                    <div class="absolute top-2 left-2 px-1.5 py-0.5 bg-purple-500 text-white font-mono font-bold text-[9px] uppercase tracking-wider rounded flex items-center gap-1.5 shadow-sm">
                      <span>9:16 CROP FOCUS</span>
                      <span class="opacity-80 font-normal">[{cropRegion().x.toFixed(1)}%]</span>
                    </div>

                    {/* Grip Handles on Edges */}
                    <div class="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-12 bg-purple-400 rounded-full border border-purple-900 shadow-md flex items-center justify-center">
                      <div class="w-0.5 h-6 bg-white/70" />
                    </div>
                    <div class="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-12 bg-purple-400 rounded-full border border-purple-900 shadow-md flex items-center justify-center">
                      <div class="w-0.5 h-6 bg-white/70" />
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Source Label Badge */}
            <div class="absolute left-2.5 top-2.5 px-2 py-0.5 rounded bg-black/75 border border-zinc-700/60 text-zinc-300 font-mono text-[9px] uppercase tracking-wider pointer-events-none">
              Master 16:9 Stream
            </div>
          </Show>
        </div>

        {/* ==================== VIEW 2: 9:16 VERTICAL SIMULATED OUTCOME ==================== */}
        <Show when={viewMode() === "vertical" || viewMode() === "dual"}>
          <div
            class="relative h-full aspect-[9/16] bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800/90 shadow-2xl flex flex-col justify-between items-center cursor-pointer shrink-0"
            onClick={togglePlayback}
          >
            {/* Single High-Performance GPU Canvas Blit (Zero Extra Decoders) */}
            <canvas
              ref={verticalCanvasRef}
              width={720}
              height={1280}
              class="absolute inset-0 w-full h-full object-contain pointer-events-none z-0 bg-black"
            />

            {/* Template Zone Indicators for Cam + Game */}
            <Show when={currentTemplate() === "stacked_split" || currentTemplate() === "split_50_50"}>
              <div class="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
                <div class="w-full flex justify-end p-2" style={{ height: `${topHeightPct()}%` }}>
                  <span class="self-end px-1.5 py-0.5 rounded bg-black/75 text-cyan-300 font-mono text-[9px] uppercase tracking-wider border border-cyan-500/30">
                    Zone A: Cam
                  </span>
                </div>
                <div class="w-full flex justify-end p-2 flex-1">
                  <span class="self-end px-1.5 py-0.5 rounded bg-black/75 text-amber-300 font-mono text-[9px] uppercase tracking-wider border border-amber-500/30">
                    Zone B: Game
                  </span>
                </div>
              </div>
            </Show>

            {/* Overlays: Top Brand Title & Heading Logo */}
            <div class="relative z-20 pt-2.5 px-3 text-center pointer-events-none w-full flex flex-col items-center gap-1">
              <Show when={composition()?.overlay?.enabled}>
                <Show when={composition()?.overlay?.logoPath && logoAssetUrl()}>
                  <div class="max-w-[85%] flex items-center justify-center">
                    <img
                      src={logoAssetUrl()!}
                      alt="Heading Logo"
                      class="object-contain drop-shadow-md select-none transition-all"
                      style={{
                        "max-height": `${Math.round(48 * (composition()?.overlay?.logoScale || 1.0))}px`,
                        "max-width": `${Math.round(260 * (composition()?.overlay?.logoScale || 1.0))}px`,
                      }}
                    />
                  </div>
                </Show>
                <Show when={composition()?.overlay?.brandTitle}>
                  <span class="inline-block px-2 py-0.5 bg-black/80 text-white text-[9px] font-black uppercase tracking-widest rounded border border-white/20 backdrop-blur shadow-sm">
                    {composition()?.overlay?.brandTitle}
                  </span>
                </Show>
              </Show>
            </div>

            {/* Overlays: Bottom Episode Label */}
            <div class="relative z-20 pb-2 px-2 text-center pointer-events-none w-full">
              <Show when={composition()?.overlay?.enabled && composition()?.overlay?.episodeLabel}>
                <span class="inline-block px-2.5 py-0.5 bg-black/85 text-amber-400 font-mono font-black text-[10px] tracking-wider uppercase rounded border border-amber-400/30 backdrop-blur shadow-sm">
                  {composition()?.overlay?.episodeLabel} 001
                </span>
              </Show>
            </div>

            {/* Vertical Indicator Pill */}
            <div class="absolute right-2 top-2 px-1.5 py-0.2 rounded bg-blue-600/80 text-white font-mono text-[8px] font-bold uppercase tracking-wider z-20 pointer-events-none">
              9:16 Output
            </div>
          </div>
        </Show>
      </div>

      {/* Docked Interactive Bounding Box Nudge Bar (When editing Stacking) */}
      <Show when={showCropControls() && currentTemplate() !== "blur_fill" && viewMode() !== "vertical"}>
        <div class="px-3 py-1.5 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono shrink-0 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="text-zinc-500 text-[10px] uppercase font-bold">Active Region:</span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveZone("top")}
                class={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition ${
                  activeZone() === "top"
                    ? "bg-cyan-500 text-black font-bold shadow-sm"
                    : "bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
              >
                Zone A (Cam)
              </button>
              <button
                type="button"
                onClick={() => setActiveZone("bottom")}
                class={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition ${
                  activeZone() === "bottom"
                    ? "bg-amber-500 text-black font-bold shadow-sm"
                    : "bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
              >
                Zone B (Game)
              </button>
            </div>
          </div>

          {/* Quick Presets for Facecam Position */}
          <Show when={activeZone() === "top"}>
            <div class="flex items-center gap-1 text-[10px]">
              <span class="text-zinc-500">Cam Presets:</span>
              <button
                type="button"
                onClick={() => quickPresetFacecam("top-left")}
                class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
              >
                Top-Left
              </button>
              <button
                type="button"
                onClick={() => quickPresetFacecam("top-right")}
                class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
              >
                Top-Right
              </button>
              <button
                type="button"
                onClick={() => quickPresetFacecam("top-center")}
                class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
              >
                Top-Center
              </button>
            </div>
          </Show>

          {/* Sliders for precise crop positioning */}
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5">
              <span class="text-zinc-500 text-[10px]">X:</span>
              <input
                type="range"
                min="0"
                max="80"
                value={activeZone() === "top" ? topRegion().x : bottomRegion().x}
                onInput={(e) => updateRegion(activeZone(), "x", Number(e.currentTarget.value))}
                class="w-16 accent-blue-500 cursor-pointer"
              />
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-zinc-500 text-[10px]">Y:</span>
              <input
                type="range"
                min="0"
                max="80"
                value={activeZone() === "top" ? topRegion().y : bottomRegion().y}
                onInput={(e) => updateRegion(activeZone(), "y", Number(e.currentTarget.value))}
                class="w-16 accent-blue-500 cursor-pointer"
              />
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-zinc-500 text-[10px]">W:</span>
              <input
                type="range"
                min="10"
                max="100"
                value={activeZone() === "top" ? topRegion().width : bottomRegion().width}
                onInput={(e) => updateRegion(activeZone(), "width", Number(e.currentTarget.value))}
                class="w-16 accent-blue-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </Show>

      {/* Docked Studio Transport Control Bar */}
      <div class="h-11 px-4 border-t border-zinc-800/80 bg-zinc-900/80 flex items-center justify-between shrink-0 select-none">
        {/* Left: Step Frame (1f) + Step (1s) + Play/Pause */}
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={() => stepTime(-1)}
            class="w-7 h-7 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center cursor-pointer transition"
            title="Step back 1s (Shift+Left)"
          >
            <SkipBack size={13} />
          </button>

          <button
            type="button"
            onClick={() => stepFrame(-1)}
            class="w-6 h-7 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center cursor-pointer transition"
            title="Step back 1 Frame (Left Arrow)"
          >
            -1f
          </button>

          <button
            type="button"
            onClick={togglePlayback}
            class="w-9 h-7 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer shadow-sm transition"
            title="Play / Pause (Space)"
          >
            <Show when={timelineSignals.isPlaying()} fallback={<Play size={13} />}>
              <Pause size={13} />
            </Show>
          </button>

          <button
            type="button"
            onClick={() => stepFrame(1)}
            class="w-6 h-7 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center cursor-pointer transition"
            title="Step forward 1 Frame (Right Arrow)"
          >
            +1f
          </button>

          <button
            type="button"
            onClick={() => stepTime(1)}
            class="w-7 h-7 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center cursor-pointer transition"
            title="Step forward 1s (Shift+Right)"
          >
            <SkipForward size={13} />
          </button>
        </div>

        {/* Center: DaVinci Resolve Monospaced Precision Timecode */}
        <div class="flex items-center gap-2 font-mono text-xs">
          <span class="text-amber-400 font-bold tabular-nums text-sm tracking-wider">
            {timelineSignals.formatSmpteTimecode(timelineSignals.currentTime(), activeFps())}
          </span>
          <span class="text-zinc-600">/</span>
          <span class="text-zinc-400 tabular-nums">
            {timelineSignals.formatSmpteTimecode(totalDuration(), activeFps())}
          </span>
          <span class="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold">
            {activeFps()} FPS
          </span>
        </div>

        {/* Right: In/Out Markers, Quick "+ Create Short" & Volume */}
        <div class="flex items-center gap-2">
          {/* Trimming In/Out Range */}
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

          {/* Quick Create Custom Vertical Short */}
          <button
            type="button"
            onClick={handleCreateCustomShort}
            class="h-7 px-2.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition shadow-sm"
            title="Create a custom vertical short clip from selection with current template"
          >
            <Plus size={11} />
            <span>+ Create Short</span>
          </button>

          <button
            type="button"
            onClick={() => projectSignals.splitClipAt(timelineSignals.currentTime())}
            class="h-7 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-[10px] font-medium flex items-center gap-1 cursor-pointer transition"
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
