import { createSignal, createMemo } from "solid-js";

// Fine-grained timeline signals for 60-120fps playhead animation without VDOM
export const [currentTime, setCurrentTime] = createSignal(0);
export const [isPlaying, setIsPlaying] = createSignal(false);
export const [inPoint, setInPointState] = createSignal<number | null>(null);
export const [outPoint, setOutPointState] = createSignal<number | null>(null);
export const [selectedClipId, setSelectedClipId] = createSignal<string | null>(null);
export const [zoomLevel, setZoomLevel] = createSignal(1.0);
export const [isTimelineExpanded, setIsTimelineExpanded] = createSignal(false);
export const [isVerticalSimulated, setIsVerticalSimulated] = createSignal(true);

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

export function toggleVerticalSimulated() {
  setIsVerticalSimulated((prev) => !prev);
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
  toggleVerticalSimulated
};
