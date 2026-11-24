import { createSignal, createMemo } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type { Clip, ClipForgeProject } from "../types/index.js";
import {
  renderClip,
  openInExplorer,
  cancelRender,
  cleanupIncompleteFiles,
  type RenderProgressPayload
} from "../services/api.js";

export interface QueueItem {
  id: string;
  title: string;
  episodeIndex: number;
  outputName: string;
  outputPath: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  status: "queued" | "rendering" | "completed" | "error" | "cancelled";
  progress: number;
  fps: number;
  speed: string;
  eta: string;
  fileSizeBytes: number;
  error?: string;
}

export interface RenderedClipInfo {
  clipId: string;
  outputPath: string;
  fileSizeBytes: number;
  completedAt: string;
}

export function sanitizeCleanPath(p: string): string {
  if (!p) return "";
  return p
    .replace(/[\\/]apps[\\/]Exports[\\/]/gi, "/Exports/")
    .replace(/[\\/]apps[\\/]/gi, "/")
    .replace(/\\/g, "/");
}

function loadPersistedQueueItems(): QueueItem[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("clipforge_persisted_queue_v1") : null;
    if (!raw) return [];
    const parsed: QueueItem[] = JSON.parse(raw);
    return parsed.map((item) => ({
      ...item,
      outputPath: sanitizeCleanPath(item.outputPath)
    }));
  } catch {
    return [];
  }
}

function loadPersistedRenderedClips(): Record<string, RenderedClipInfo> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("clipforge_rendered_clips") : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const cleaned: Record<string, RenderedClipInfo> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === "object" && "outputPath" in v) {
        const item = v as RenderedClipInfo;
        cleaned[k] = {
          ...item,
          outputPath: sanitizeCleanPath(item.outputPath)
        };
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function persistQueue(items: QueueItem[]) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("clipforge_persisted_queue_v1", JSON.stringify(items));
    }
  } catch (err) {
    console.warn("Failed to persist queue items:", err);
  }
}

export const [queueItems, setQueueItems] = createStore<QueueItem[]>(loadPersistedQueueItems());
export const [renderedClips, setRenderedClips] = createStore<Record<string, RenderedClipInfo>>(loadPersistedRenderedClips());
export const [isExporting, setIsExporting] = createSignal(false);
export const [showQueueModal, setShowQueueModal] = createSignal(false);
export const [activeItemIndex, setActiveItemIndex] = createSignal(0);
export const [overallProgress, setOverallProgress] = createSignal(0);
export const [exportDirectory, setExportDirectory] = createSignal("./Exports");
export const [singleRenderingClipId, setSingleRenderingClipId] = createSignal<string | null>(null);

export const totalQueueItems = createMemo(() => queueItems.length);
export const completedQueueItems = createMemo(() => queueItems.filter((i) => i.status === "completed").length);
export const activeQueueItem = createMemo(() => queueItems[activeItemIndex()] ?? null);
export const isClipRendered = (clipId: string) => Boolean(renderedClips[clipId]);
export const getRenderedInfo = (clipId: string) => renderedClips[clipId] ?? null;

export function recordRenderedClip(clipId: string, outputPath: string, fileSizeBytes: number) {
  const clean = sanitizeCleanPath(outputPath);
  setRenderedClips(clipId, {
    clipId,
    outputPath: clean,
    fileSizeBytes,
    completedAt: new Date().toISOString()
  });
  persistQueue(queueItems);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("clipforge_rendered_clips", JSON.stringify(renderedClips));
    }
  } catch (err) {
    console.warn("Failed to persist rendered clips:", err);
  }
}

export function clearRenderedRecord(clipId?: string) {
  if (clipId) {
    setRenderedClips(clipId, undefined!);
  } else {
    setRenderedClips(reconcile({}));
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("clipforge_rendered_clips", JSON.stringify(renderedClips));
    }
  } catch (err) {
    console.warn("Failed to clear rendered clips:", err);
  }
}

export function initQueueFromManifest(clips: Clip[], project?: ClipForgeProject) {
  const enabledClips = clips.filter((c) => c.enabled);
  const outDir = (project?.export.outputDirectory || "./Exports").replace(/[\\/]+$/, "");
  setExportDirectory(outDir);

  const isNested = project?.export.structure === "by-clip";

  const newItems: QueueItem[] = enabledClips.map((clip) => {
    const clipTitle = clip.title || clip.outputName || `Part ${String(clip.index).padStart(3, "0")}`;
    const subPath = isNested ? `${clipTitle}/${clip.outputName}` : clip.outputName;
    const fullPath = `${outDir}/${subPath}`.replace(/\\/g, "/");
    return {
      id: clip.id,
      title: clipTitle,
      episodeIndex: clip.index,
      outputName: clip.outputName,
      outputPath: fullPath,
      startSeconds: clip.sourceStartSeconds,
      endSeconds: clip.sourceEndSeconds,
      durationSeconds: clip.sourceEndSeconds - clip.sourceStartSeconds,
      status: "queued",
      progress: 0,
      fps: 0,
      speed: "0x",
      eta: "--:--",
      fileSizeBytes: 0
    };
  });

  setQueueItems(reconcile(newItems));
  setActiveItemIndex(0);
  setOverallProgress(0);
}

export async function runExportQueue(project: ClipForgeProject) {
  if (queueItems.length === 0 || isExporting()) return;

  setIsExporting(true);
  setShowQueueModal(true);
  setOverallProgress(0);
  setExportDirectory(project.export.outputDirectory);

  const total = queueItems.length;
  let unlisten: (() => void) | null = null;

  try {
    const { listen } = await import("@tauri-apps/api/event");
    unlisten = await listen<RenderProgressPayload>("render-progress", (event) => {
      const p = event.payload;
      const idx = activeItemIndex();
      if (queueItems[idx]) {
        const prog = Math.min(100, Math.round(p.progress));
        setQueueItems(idx, "progress", prog);
        setQueueItems(idx, "fps", Math.round(p.fps));
        setQueueItems(idx, "speed", p.speed || "1.0x");
        if (p.eta_seconds != null && p.eta_seconds >= 0) {
          const mins = Math.floor(p.eta_seconds / 60);
          const secs = Math.floor(p.eta_seconds % 60);
          setQueueItems(idx, "eta", `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
        } else {
          setQueueItems(idx, "eta", "--:--");
        }
        const completedPortion = idx / total;
        const currentPortion = (prog / 100) * (1 / total);
        setOverallProgress(Math.round((completedPortion + currentPortion) * 100));
      }
    });
  } catch (err) {
    console.warn("Could not attach render-progress event listener:", err);
  }

  try {
    for (let i = 0; i < total; i++) {
      if (!isExporting()) break;

      setActiveItemIndex(i);
      const item = queueItems[i];
      if (!item) continue;
      setQueueItems(i, "status", "rendering");
      setQueueItems(i, "progress", 0);

      const bgMode = project.composition.background.mode;
      const gameplayMode = project.composition.gameplay.mode;
      const effectiveMode = gameplayMode === "cover" ? "crop" : bgMode;

      const isShort = Boolean(
        project.shorts?.some((s) => s.id === item.id) ||
        item.id.startsWith("short_") ||
        item.title.toLowerCase().includes("short")
      );
      const overlayEnabled = isShort ? false : (project.composition.overlay?.enabled ?? true);

      try {
        const res = await renderClip({
          clip_id: item.id,
          video_path: project.sources.video.path,
          audio_path: project.sources.audio?.path,
          audio_offset_ms: project.synchronization?.audioOffsetMs || 0,
          start_seconds: item.startSeconds,
          duration_seconds: item.durationSeconds,
          output_path: item.outputPath,
          mode: effectiveMode,
          bg_color: project.composition.background.color,
          crf: project.export.crf,
          preset: project.export.preset,
          overlay_enabled: overlayEnabled,
          brand_title: isShort ? undefined : (project.composition.overlay?.brandTitle || "CLIPFORGE"),
          episode_label: isShort ? undefined : (project.composition.overlay?.episodeLabel || "PART"),
          episode_index: isShort ? undefined : item.episodeIndex
        });

        if (res.success) {
          setQueueItems(i, "status", "completed");
          setQueueItems(i, "progress", 100);
          setQueueItems(i, "eta", "00:00");
          setQueueItems(i, "fileSizeBytes", res.file_size_bytes);
          setQueueItems(i, "outputPath", res.output_path);
          recordRenderedClip(item.id, res.output_path, res.file_size_bytes);
        } else {
          setQueueItems(i, "status", "error");
          setQueueItems(i, "error", res.error || "Encoding failed");
        }
      } catch (err: unknown) {
        setQueueItems(i, "status", "error");
        setQueueItems(i, "error", err instanceof Error ? err.message : String(err));
      }

      const completedPortion = (i + 1) / total;
      setOverallProgress(Math.round(completedPortion * 100));
    }
  } finally {
    if (unlisten) unlisten();
    setIsExporting(false);
  }
}

export async function renderSingleClip(clip: Clip, project: ClipForgeProject) {
  if (isExporting() || singleRenderingClipId()) return;

  const outDir = (project.export.outputDirectory || "./Exports").replace(/[\\/]+$/, "");
  setExportDirectory(outDir);
  const isNested = project.export.structure === "by-clip";
  const clipTitle = clip.title || clip.outputName || `Part ${String(clip.index).padStart(3, "0")}`;
  const subPath = isNested ? `${clipTitle}/${clip.outputName}` : clip.outputName;
  const fullPath = `${outDir}/${subPath}`.replace(/\\/g, "/");

  clearRenderedRecord(clip.id);

  let idx = queueItems.findIndex((q) => q.id === clip.id);
  if (idx === -1) {
    const newItem: QueueItem = {
      id: clip.id,
      title: clipTitle,
      episodeIndex: clip.index,
      outputName: clip.outputName,
      outputPath: fullPath,
      startSeconds: clip.sourceStartSeconds,
      endSeconds: clip.sourceEndSeconds,
      durationSeconds: clip.sourceEndSeconds - clip.sourceStartSeconds,
      status: "rendering",
      progress: 0,
      fps: 0,
      speed: "0x",
      eta: "--:--",
      fileSizeBytes: 0
    };
    setQueueItems([...queueItems, newItem]);
    idx = queueItems.length - 1;
  } else {
    setQueueItems(idx, {
      status: "rendering",
      progress: 0,
      error: undefined,
      fps: 0,
      speed: "0x",
      eta: "--:--"
    });
  }

  setSingleRenderingClipId(clip.id);

  const bgMode = project.composition.background.mode;
  const gameplayMode = project.composition.gameplay.mode;
  const effectiveMode = gameplayMode === "cover" ? "crop" : bgMode;

  let unlisten: (() => void) | null = null;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    unlisten = await listen<RenderProgressPayload>("render-progress", (event) => {
      const p = event.payload;
      if (p.clip_id === clip.id || !p.clip_id) {
        const itemIndex = queueItems.findIndex((q) => q.id === clip.id);
        if (itemIndex !== -1) {
          setQueueItems(itemIndex, "progress", Math.min(100, Math.round(p.progress)));
          setQueueItems(itemIndex, "fps", Math.round(p.fps));
          setQueueItems(itemIndex, "speed", p.speed || "1.0x");
          if (p.eta_seconds != null && p.eta_seconds >= 0) {
            const mins = Math.floor(p.eta_seconds / 60);
            const secs = Math.floor(p.eta_seconds % 60);
            setQueueItems(itemIndex, "eta", `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
          }
        }
      }
    });

    const isShort = Boolean(
      project.shorts?.some((s) => s.id === clip.id) ||
      clip.id.startsWith("short_") ||
      clip.title.toLowerCase().includes("short")
    );
    const overlayEnabled = isShort ? false : (project.composition.overlay?.enabled ?? true);

    const item = queueItems[idx];
    const res = await renderClip({
      clip_id: item.id,
      video_path: project.sources.video.path,
      audio_path: project.sources.audio?.path,
      audio_offset_ms: project.synchronization?.audioOffsetMs || 0,
      start_seconds: item.startSeconds,
      duration_seconds: item.durationSeconds,
      output_path: item.outputPath,
      mode: effectiveMode,
      bg_color: project.composition.background.color,
      crf: project.export.crf,
      preset: project.export.preset,
      overlay_enabled: overlayEnabled,
      brand_title: isShort ? undefined : (project.composition.overlay?.brandTitle || "CLIPFORGE"),
      episode_label: isShort ? undefined : (project.composition.overlay?.episodeLabel || "PART"),
      episode_index: isShort ? undefined : item.episodeIndex
    });

    if (res.success) {
      setQueueItems(idx, "status", "completed");
      setQueueItems(idx, "progress", 100);
      setQueueItems(idx, "eta", "00:00");
      setQueueItems(idx, "fileSizeBytes", res.file_size_bytes);
      setQueueItems(idx, "outputPath", res.output_path);
      recordRenderedClip(item.id, res.output_path, res.file_size_bytes);
    } else {
      setQueueItems(idx, "status", "error");
      setQueueItems(idx, "error", res.error || "Encoding failed");
    }
  } catch (err: unknown) {
    if (idx !== -1) {
      setQueueItems(idx, "status", "error");
      setQueueItems(idx, "error", err instanceof Error ? err.message : String(err));
    }
  } finally {
    if (unlisten) unlisten();
    setSingleRenderingClipId(null);
  }
}

export async function cancelSingleRender(clipId: string) {
  if (singleRenderingClipId() === clipId) {
    await cancelRender();
    const idx = queueItems.findIndex((q) => q.id === clipId);
    if (idx !== -1) {
      setQueueItems(idx, "status", "cancelled");
      setQueueItems(idx, "progress", 0);
      setQueueItems(idx, "error", "Cancelled by user");
    }
    setSingleRenderingClipId(null);
    persistQueue(queueItems);
  }
}

export async function cleanupExports(): Promise<number> {
  const dir = exportDirectory();
  if (dir) {
    return await cleanupIncompleteFiles(dir);
  }
  return 0;
}

export async function exportRemainingClips(clips: Clip[], project: ClipForgeProject) {
  const remaining = clips.filter((c) => c.enabled && !isClipRendered(c.id));
  if (remaining.length === 0) return;
  initQueueFromManifest(remaining, project);
  await runExportQueue(project);
}

export async function cancelExport() {
  setIsExporting(false);
  setSingleRenderingClipId(null);
  await cancelRender();
  queueItems.forEach((item, i) => {
    if (item.status === "rendering" || item.status === "queued") {
      setQueueItems(i, "status", "cancelled");
    }
  });
  persistQueue(queueItems);
}

export function openExportFolder() {
  const dir = exportDirectory();
  if (dir) {
    openInExplorer(dir);
  }
}

export const queueSignals = {
  queueItems: () => queueItems,
  renderedClips: () => renderedClips,
  isExporting,
  setIsExporting,
  showQueueModal,
  setShowQueueModal,
  openFolder: openExportFolder,
  closeModal: () => setShowQueueModal(false),
  activeItemIndex,
  overallProgress,
  exportDirectory,
  singleRenderingClipId,
  totalItems: totalQueueItems,
  completedItems: completedQueueItems,
  activeItem: activeQueueItem,
  isClipRendered,
  getRenderedInfo,
  initQueueFromManifest,
  runExportQueue,
  renderSingleClip,
  cancelSingleRender,
  cleanupExports,
  exportRemainingClips,
  cancelExport
};
