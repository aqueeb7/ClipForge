import { createSignal, createMemo } from "solid-js";

export type PreviewViewMode = "wide" | "vertical" | "dual";

// Fine-grained timeline signals for 60-120fps playhead animation without VDOM
export const [currentTime, setCurrentTime] = createSignal(0);
export const [isPlaying, setIsPlaying] = createSignal(false);
export const [inPoint, setInPointState] = createSignal<number | null>(null);
export const [outPoint, setOutPointState] = createSignal<number | null>(null);
export const [selectedClipId, setSelectedClipId] = createSignal<string | null>(null);
export const [zoomLevel, setZoomLevel] = createSignal(1.0);
export const [isTimelineExpanded, setIsTimelineExpanded] = createSignal(false);
export const [isVerticalSimulated, setIsVerticalSimulated] = createSignal(true);
export const [previewViewMode, setPreviewViewMode] = createSignal<PreviewViewMode>("dual");
export const [timelineFps, setTimelineFps] = createSignal<number>(60);

export function snapToFrame(seconds: number, fps: number = timelineFps()): number {
  const validFps = fps > 0 ? fps : 60;
  const frame = Math.round(seconds * validFps);
  return Math.max(0, frame / validFps);
}

export function timeToFrames(seconds: number, fps: number = timelineFps()): number {
  const validFps = fps > 0 ? fps : 60;
  return Math.max(0, Math.round(seconds * validFps));
}

export function formatSmpteTimecode(seconds: number, fps: number = timelineFps()): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const validFps = fps > 0 ? fps : 60;
  const intFps = Math.max(1, Math.round(validFps));
  const totalFrames = Math.round(seconds * validFps);
  const f = totalFrames % intFps;
  const totalSecs = Math.floor(totalFrames / intFps);
  const s = totalSecs % 60;
  const m = Math.floor((totalSecs % 3600) / 60);
  const h = Math.floor(totalSecs / 3600);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
}

export function stepFrame(deltaFrames: number) {
  const fps = timelineFps();
  const currentF = Math.round(currentTime() * fps);
  const targetF = Math.max(0, currentF + deltaFrames);
  setCurrentTime(targetF / fps);
}

export const hasSelectionRange = createMemo(() => {
  const inp = inPoint();
  const outp = outPoint();
  return inp !== null && outp !== null && outp > inp;
});

export const selectionDuration = createMemo(() => {
  const inp = inPoint();
  const outp = outPoint();
  return inp !== null && outp !== null && outp > inp ? outp - inp : 0;
});

export function seek(time: number) {
  setCurrentTime(Math.max(0, time));
}

export function play() {
  setIsPlaying(true);
}

export function pause() {
  setIsPlaying(false);
}

export function togglePlay() {
  setIsPlaying((prev) => !prev);
}

export function setInPoint(time?: number) {
  const val = time !== undefined ? time : currentTime();
  const rounded = Math.round(val * 100) / 100;
  setInPointState(rounded);
  const outp = outPoint();
  if (outp !== null && outp <= rounded) {
    setOutPointState(null);
  }
}

export function setOutPoint(time?: number) {
  const val = time !== undefined ? time : currentTime();
  const rounded = Math.round(val * 100) / 100;
  setOutPointState(rounded);
}

export function clearMarkers() {
  setInPointState(null);
  setOutPointState(null);
}

export function selectClip(id: string | null) {
  setSelectedClipId(id);
}

export function zoomIn() {
  setZoomLevel((prev) => Math.min(25.0, Math.round(prev * 1.4 * 10) / 10));
}

export function zoomOut() {
  setZoomLevel((prev) => Math.max(1.0, Math.round((prev / 1.4) * 10) / 10));
}

export function resetZoom() {
  setZoomLevel(1.0);
}

export function toggleTimelineExpanded() {
  setIsTimelineExpanded((prev) => !prev);
}

export function setViewMode(mode: PreviewViewMode) {
  setPreviewViewMode(mode);
  setIsVerticalSimulated(mode !== "wide");
}

export function toggleVerticalSimulated() {
  const current = previewViewMode();
  if (current === "dual") {
    setViewMode("wide");
  } else if (current === "wide") {
    setViewMode("vertical");
  } else {
    setViewMode("dual");
  }
}

export const timelineSignals = {
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  inPoint,
  setInPoint,
  outPoint,
  setOutPoint,
  selectedClipId,
  setSelectedClipId,
  zoomLevel,
  setZoomLevel,
  isTimelineExpanded,
  setIsTimelineExpanded,
  isVerticalSimulated,
  setIsVerticalSimulated,
  previewViewMode,
  setPreviewViewMode,
  setViewMode,
  hasSelectionRange,
  selectionDuration,
  seek,
  play,
  pause,
  togglePlay,
  clearMarkers,
  selectClip,
  zoomIn,
  zoomOut,
  resetZoom,
  toggleTimelineExpanded,
  toggleVerticalSimulated,
  timelineFps,
  setTimelineFps,
  snapToFrame,
  timeToFrames,
  formatSmpteTimecode,
  stepFrame
};
