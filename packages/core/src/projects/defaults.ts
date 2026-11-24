import {
  ClipForgeProject,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CLIP_DURATION,
  DEFAULT_FRAME_RATE,
  DEFAULT_VIDEO_CRF,
  DEFAULT_PRESET,
  DEFAULT_NAMING_PATTERN
} from "@clipforge/shared";

export interface CreateProjectOptions {
  id: string;
  name: string;
  videoPath: string;
  videoDurationSeconds: number;
  width?: number;
  height?: number;
  audioPath?: string;
  audioOffsetMs?: number;
  clipDurationSeconds?: number;
  outputDirectory: string;
}

export function createDefaultProject(options: CreateProjectOptions): ClipForgeProject {
  return {
    id: options.id,
    name: options.name,
    version: 1,
    sources: {
      video: {
        path: options.videoPath,
        durationSeconds: options.videoDurationSeconds,
        width: options.width,
        height: options.height
      },
      audio: options.audioPath
        ? {
            path: options.audioPath,
            durationSeconds: options.videoDurationSeconds
          }
        : undefined
    },
    synchronization: {
      audioOffsetMs: options.audioOffsetMs ?? 0
    },
    clipSettings: {
      mode: "automatic",
      startSeconds: 0,
      endSeconds: options.videoDurationSeconds,
      durationSeconds: options.clipDurationSeconds ?? DEFAULT_CLIP_DURATION,
      overlapSeconds: 0,
      minimumFinalClipSeconds: 5,
      startingEpisode: 1
    },
    composition: {
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
      background: {
        mode: "blur",
        blurRadius: 25,
        color: "#000000"
      },
      gameplay: {
        mode: "contain",
        scale: 1.0,
        offsetX: 0,
        offsetY: 0
      },
      stacking: {
        template: "blur_fill",
        topRegion: { x: 2, y: 5, width: 28, height: 35 },
        bottomRegion: { x: 0, y: 15, width: 100, height: 85 },
        cropRegion: { x: 21.875, y: 0, width: 56.25, height: 100 },
        topHeightPercent: 35
      },
      overlay: {
        enabled: true,
        brandTitle: "CLYPTIK",
        episodeLabel: "PART",
        showEpisodeNumber: true
      }
    },
    export: {
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      frameRate: DEFAULT_FRAME_RATE,
      crf: DEFAULT_VIDEO_CRF,
      preset: DEFAULT_PRESET,
      outputDirectory: options.outputDirectory,
      namingPattern: DEFAULT_NAMING_PATTERN,
      structure: "flat"
    }
  };
}
