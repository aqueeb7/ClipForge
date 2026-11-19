import { defineStore } from "pinia";
import type { Clip, ClipForgeProject } from "@clipforge/shared";
import {
  renderClip,
  openInExplorer,
  cancelRender,
  cleanupIncompleteFiles,
  type RenderProgressPayload
} from "../services/api";

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

function loadPersistedRenderedClips(): Record<string, RenderedClipInfo> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("clipforge_rendered_clips") : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadPersistedQueueItems(): QueueItem[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("clipforge_persisted_queue_items") : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function persistQueueItems(items: QueueItem[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("clipforge_persisted_queue_items", JSON.stringify(items));
    }
  } catch {
    // ignore
  }
}

export interface QueueState {
  isExporting: boolean;
  showQueueModal: boolean;
  activeItemIndex: number;
  overallProgress: number;
  exportDirectory: string;
  queueItems: QueueItem[];
  renderedClips: Record<string, RenderedClipInfo>;
  singleRenderingClipId: string | null;
}

export const useQueueStore = defineStore("queue", {
  state: (): QueueState => ({
    isExporting: false,
    showQueueModal: false,
    activeItemIndex: 0,
    overallProgress: 0,
    exportDirectory: "./Exports",
    queueItems: loadPersistedQueueItems(),
    renderedClips: loadPersistedRenderedClips(),
    singleRenderingClipId: null
  }),

  getters: {
    totalItems: (state) => state.queueItems.length,
    completedItems: (state) => state.queueItems.filter((i) => i.status === "completed").length,
    activeItem: (state) => state.queueItems[state.activeItemIndex] ?? null,
    isClipRendered: (state) => (clipId: string) => Boolean(state.renderedClips[clipId]),
    getRenderedInfo: (state) => (clipId: string) => state.renderedClips[clipId] ?? null
  },

  actions: {
    openModal() {
      this.showQueueModal = true;
    },

    closeModal() {
      if (!this.isExporting) {
        this.showQueueModal = false;
      }
    },

    openFolder() {
      if (this.exportDirectory) {
        openInExplorer(this.exportDirectory);
      }
    },

    initQueueFromManifest(clips: Clip[], project?: ClipForgeProject) {
      const enabledClips = clips.filter((c) => c.enabled);
      const outDir = (project?.export.outputDirectory || "./Exports").replace(/[\\/]+$/, "");
      this.exportDirectory = outDir;

      const isNested = project?.export.structure === "nested";

      this.queueItems = enabledClips.map((clip) => {
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
      this.activeItemIndex = 0;
      this.overallProgress = 0;
    },

    async runExportQueue(project: ClipForgeProject) {
      if (this.queueItems.length === 0 || this.isExporting) return;

      this.isExporting = true;
      this.showQueueModal = true;
      this.overallProgress = 0;
      this.exportDirectory = project.export.outputDirectory;

      const total = this.queueItems.length;

      // Real-time Tauri progress listener
      let unlisten: (() => void) | null = null;
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<RenderProgressPayload>("render-progress", (event) => {
          const p = event.payload;
          const currentItem = this.queueItems[this.activeItemIndex];
          if (currentItem) {
            currentItem.progress = Math.min(100, Math.round(p.progress));
            currentItem.fps = Math.round(p.fps);
            currentItem.speed = p.speed || "1.0x";
            if (p.eta_seconds != null && p.eta_seconds >= 0) {
              const mins = Math.floor(p.eta_seconds / 60);
              const secs = Math.floor(p.eta_seconds % 60);
              currentItem.eta = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
            } else {
              currentItem.eta = "--:--";
            }
            const completedPortion = this.activeItemIndex / total;
            const currentPortion = (currentItem.progress / 100) * (1 / total);
            this.overallProgress = Math.round((completedPortion + currentPortion) * 100);
          }
        });
      } catch (err) {
        console.warn("Could not attach render-progress event listener:", err);
      }

      try {
        for (let i = 0; i < total; i++) {
          if (!this.isExporting) break;

          this.activeItemIndex = i;
          const item = this.queueItems[i];
          if (!item) continue;
          item.status = "rendering";
          item.progress = 0;

          const bgMode = project.composition.background.mode;
          const gameplayMode = project.composition.gameplay.mode;
          const effectiveMode = gameplayMode === "crop" ? "crop" : bgMode;

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
              overlay_enabled: project.composition.overlay?.enabled ?? true,
              brand_title: project.composition.overlay?.brandTitle || "CLIPFORGE",
              episode_label: project.composition.overlay?.episodeLabel || "PART",
              episode_index: item.episodeIndex
            });

            if (res.success) {
              item.status = "completed";
              item.progress = 100;
              item.eta = "00:00";
              item.fileSizeBytes = res.file_size_bytes;
              item.outputPath = res.output_path;
              this.recordRenderedClip(item.id, res.output_path, res.file_size_bytes);
            } else {
              item.status = "error";
              item.error = res.error || "Encoding failed";
            }
          } catch (err: unknown) {
            item.status = "error";
            item.error = err instanceof Error ? err.message : String(err);
          }

          const completedPortion = (i + 1) / total;
          this.overallProgress = Math.round(completedPortion * 100);
        }
      } finally {
        if (unlisten) {
          unlisten();
        }
        this.isExporting = false;
      }
    },

    recordRenderedClip(clipId: string, outputPath: string, fileSizeBytes: number) {
      this.renderedClips[clipId] = {
        clipId,
        outputPath,
        fileSizeBytes,
        completedAt: new Date().toISOString()
      };
      persistQueueItems(this.queueItems);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("clipforge_rendered_clips", JSON.stringify(this.renderedClips));
        }
      } catch (err) {
        console.warn("Failed to persist rendered clips:", err);
      }
    },

    clearRenderedRecord(clipId?: string) {
      if (clipId) {
        delete this.renderedClips[clipId];
      } else {
        this.renderedClips = {};
      }
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("clipforge_rendered_clips", JSON.stringify(this.renderedClips));
        }
      } catch (err) {
        console.warn("Failed to persist rendered clips:", err);
      }
    },

    async renderSingleClip(clip: Clip, project: ClipForgeProject) {
      if (this.isExporting || this.singleRenderingClipId) return;

      const outDir = (project.export.outputDirectory || "./Exports").replace(/[\\/]+$/, "");
      this.exportDirectory = outDir;
      const isNested = project.export.structure === "nested";
      const clipTitle = clip.title || clip.outputName || `Part ${String(clip.index).padStart(3, "0")}`;
      const subPath = isNested ? `${clipTitle}/${clip.outputName}` : clip.outputName;
      const fullPath = `${outDir}/${subPath}`.replace(/\\/g, "/");

      // On re-render, clear previous rendered record so UI switches to active rendering mode immediately
      this.clearRenderedRecord(clip.id);

      let item = this.queueItems.find((q) => q.id === clip.id);
      if (!item) {
        this.queueItems.push({
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
        });
        item = this.queueItems.find((q) => q.id === clip.id)!;
      } else {
        item.status = "rendering";
        item.progress = 0;
        item.error = undefined;
        item.fps = 0;
        item.speed = "0x";
        item.eta = "--:--";
      }

      this.singleRenderingClipId = clip.id;

      const bgMode = project.composition.background.mode;
      const gameplayMode = project.composition.gameplay.mode;
      const effectiveMode = gameplayMode === "crop" ? "crop" : bgMode;

      let unlisten: (() => void) | null = null;
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<RenderProgressPayload>("render-progress", (event) => {
          const p = event.payload;
          if (p.clip_id === clip.id || !p.clip_id) {
            const currentItem = this.queueItems.find((q) => q.id === clip.id);
            if (currentItem) {
              currentItem.progress = Math.min(100, Math.round(p.progress));
              currentItem.fps = Math.round(p.fps);
              currentItem.speed = p.speed || "1.0x";
              if (p.eta_seconds != null && p.eta_seconds >= 0) {
                const mins = Math.floor(p.eta_seconds / 60);
                const secs = Math.floor(p.eta_seconds % 60);
                currentItem.eta = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
              }
            }
          }
        });

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
          overlay_enabled: project.composition.overlay?.enabled ?? true,
          brand_title: project.composition.overlay?.brandTitle || "CLIPFORGE",
          episode_label: project.composition.overlay?.episodeLabel || "PART",
          episode_index: item.episodeIndex
        });

        if (res.success) {
          item.status = "completed";
          item.progress = 100;
          item.eta = "00:00";
          item.fileSizeBytes = res.file_size_bytes;
          item.outputPath = res.output_path;
          this.recordRenderedClip(item.id, res.output_path, res.file_size_bytes);
        } else {
          item.status = "error";
          item.error = res.error || "Encoding failed";
        }
      } catch (err: unknown) {
        if (item) {
          item.status = "error";
          item.error = err instanceof Error ? err.message : String(err);
        }
      } finally {
        if (unlisten) {
          unlisten();
        }
        this.singleRenderingClipId = null;
      }
    },

    async cancelSingleRender(clipId: string) {
      if (this.singleRenderingClipId === clipId) {
        await cancelRender();
        const item = this.queueItems.find((q) => q.id === clipId);
        if (item) {
          item.status = "cancelled";
          item.progress = 0;
          item.error = "Cancelled by user";
        }
        this.singleRenderingClipId = null;
        persistQueueItems(this.queueItems);
      }
    },

    async cleanupExports(): Promise<number> {
      if (this.exportDirectory) {
        return await cleanupIncompleteFiles(this.exportDirectory);
      }
      return 0;
    },

    async exportRemainingClips(clips: Clip[], project: ClipForgeProject) {
      const remaining = clips.filter((c) => c.enabled && !this.isClipRendered(c.id));
      if (remaining.length === 0) return;
      this.initQueueFromManifest(remaining, project);
      await this.runExportQueue(project);
    },

    async cancelExport() {
      this.isExporting = false;
      this.singleRenderingClipId = null;
      await cancelRender();
      for (const item of this.queueItems) {
        if (item.status === "rendering" || item.status === "queued") {
          item.status = "cancelled";
        }
      }
      persistQueueItems(this.queueItems);
    }
  }
});
