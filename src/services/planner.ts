import {
  Clip,
  ClipForgeProject,
  ClipManifest,
  AutomaticClipSettings,
  ManualClipSettings,
  ManualClipItem,
  DEFAULT_NAMING_PATTERN,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CLIP_DURATION,
  DEFAULT_FRAME_RATE,
  DEFAULT_VIDEO_CRF,
  DEFAULT_PRESET
} from "../types/index.js";

export interface ResolveFilenameOptions {
  pattern: string;
  projectName: string;
  episodeIndex: number;
  clipIndex: number;
  title?: string;
  extension?: string;
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\r\n\t]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveClipFilename(options: ResolveFilenameOptions): string {
  const { pattern, projectName, episodeIndex, clipIndex, title, extension = "mp4" } = options;

  const episodePad = String(episodeIndex).padStart(3, "0");
  const indexPad = String(clipIndex).padStart(3, "0");
  const safeProject = sanitizeFilename(projectName);
  const safeTitle = title ? sanitizeFilename(title) : `Part_${episodePad}`;
  const safeEpisode = `Part_${episodePad}`;

  let filename = pattern
    .replace(/\{project\}/gi, safeProject)
    .replace(/\{episode\}/gi, safeEpisode)
    .replace(/\{index\}/gi, indexPad)
    .replace(/\{title\}/gi, safeTitle);

  filename = sanitizeFilename(filename);
  if (!filename) {
    filename = `${safeProject}_Part_${episodePad}`;
  }

  const cleanExt = extension.replace(/^\./, "");
  return `${filename}.${cleanExt}`;
}

export function generateAutomaticClips(
  settings: AutomaticClipSettings,
  totalSourceDuration: number,
  projectId: string,
  projectName: string,
  namingPattern: string = DEFAULT_NAMING_PATTERN
): Clip[] {
  const startMs = Math.round(settings.startSeconds * 1000);
  const maxEndSeconds =
    settings.endSeconds !== undefined
      ? Math.min(settings.endSeconds, totalSourceDuration)
      : totalSourceDuration;
  const endMs = Math.round(maxEndSeconds * 1000);

  if (startMs >= endMs) {
    return [];
  }

  const durationMs = Math.round(settings.durationSeconds * 1000);
  if (durationMs <= 0) {
    return [];
  }

  const overlapMs = Math.round(settings.overlapSeconds * 1000);
  const stepMs = Math.max(durationMs - overlapMs, 1000);
  const minFinalMs = Math.round(settings.minimumFinalClipSeconds * 1000);

  const clips: Clip[] = [];
  let currentStartMs = startMs;
  let episodeIndex = settings.startingEpisode;
  let clipIndex = 1;

  while (currentStartMs < endMs) {
    const targetEndMs = currentStartMs + durationMs;

    if (targetEndMs >= endMs) {
      const remainderMs = endMs - currentStartMs;
      if (remainderMs >= minFinalMs) {
        const sourceStartSeconds = currentStartMs / 1000;
        const sourceEndSeconds = endMs / 1000;
        const episodePad = String(episodeIndex).padStart(3, "0");
        const title = `Part ${episodePad}`;

        const outputName = resolveClipFilename({
          pattern: namingPattern,
          projectName,
          episodeIndex,
          clipIndex,
          title
        });

        clips.push({
          id: `${projectId}_clip_${clipIndex}`,
          index: clipIndex,
          title,
          sourceStartSeconds,
          sourceEndSeconds,
          enabled: true,
          outputName,
          status: "pending"
        });
      }
      break;
    } else {
      const sourceStartSeconds = currentStartMs / 1000;
      const sourceEndSeconds = targetEndMs / 1000;
      const episodePad = String(episodeIndex).padStart(3, "0");
      const title = `Part ${episodePad}`;

      const outputName = resolveClipFilename({
        pattern: namingPattern,
        projectName,
        episodeIndex,
        clipIndex,
        title
      });

      clips.push({
        id: `${projectId}_clip_${clipIndex}`,
        index: clipIndex,
        title,
        sourceStartSeconds,
        sourceEndSeconds,
        enabled: true,
        outputName,
        status: "pending"
      });

      currentStartMs += stepMs;
      episodeIndex++;
      clipIndex++;
    }
  }

  return clips;
}

export function generateManualClips(
  settings: ManualClipSettings,
  sourceDuration: number,
  projectId: string,
  projectName: string,
  namingPattern: string = DEFAULT_NAMING_PATTERN
): Clip[] {
  const clips: Clip[] = [];

  for (let i = 0; i < settings.clips.length; i++) {
    const item = settings.clips[i];
    if (!item) continue;

    const clipIndex = i + 1;
    const episodePad = String(clipIndex).padStart(3, "0");
    const title = item.title ? item.title.trim() : `Part ${episodePad}`;

    const outputName = resolveClipFilename({
      pattern: namingPattern,
      projectName,
      episodeIndex: clipIndex,
      clipIndex,
      title
    });

    clips.push({
      id: `${projectId}_manual_clip_${clipIndex}`,
      index: clipIndex,
      title,
      sourceStartSeconds: Math.round(item.start * 1000) / 1000,
      sourceEndSeconds: Math.round(item.end * 1000) / 1000,
      enabled: item.enabled ?? true,
      outputName,
      status: "pending",
      framingTemplate: item.framingTemplate,
      stacking: item.stacking
    });
  }

  return clips;
}

export function generateClipManifest(project: ClipForgeProject): ClipManifest {
  const namingPattern = project.export?.namingPattern || DEFAULT_NAMING_PATTERN;
  let clips: Clip[] = [];

  if (project.clipSettings.mode === "automatic") {
    clips = generateAutomaticClips(
      project.clipSettings,
      project.sources.video.durationSeconds,
      project.id,
      project.name,
      namingPattern
    );
  } else {
    clips = generateManualClips(
      project.clipSettings,
      project.sources.video.durationSeconds,
      project.id,
      project.name,
      namingPattern
    );
  }

  return {
    projectId: project.id,
    projectName: project.name,
    totalClips: clips.length,
    generatedAt: new Date().toISOString(),
    clips
  };
}

export function createDefaultProject(options: {
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
}): ClipForgeProject {
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

export function addManualClip(
  project: ClipForgeProject,
  item: { start: number; end: number; title?: string; enabled?: boolean }
): ClipForgeProject {
  const existingClips =
    project.clipSettings.mode === "manual" ? [...project.clipSettings.clips] : [];

  existingClips.push({
    start: item.start,
    end: item.end,
    title: item.title,
    enabled: item.enabled ?? true
  });

  return {
    ...project,
    clipSettings: {
      mode: "manual",
      clips: existingClips
    }
  };
}

export function removeManualClip(project: ClipForgeProject, index: number): ClipForgeProject {
  if (project.clipSettings.mode !== "manual") return project;

  const updatedClips = project.clipSettings.clips.filter((_, i) => i !== index - 1);

  return {
    ...project,
    clipSettings: {
      mode: "manual",
      clips: updatedClips
    }
  };
}

export function toggleManualClip(
  project: ClipForgeProject,
  index: number,
  enabled?: boolean
): ClipForgeProject {
  if (project.clipSettings.mode !== "manual") return project;

  const updatedClips = project.clipSettings.clips.map((clip, i) => {
    if (i === index - 1) {
      return {
        ...clip,
        enabled: enabled !== undefined ? enabled : !clip.enabled
      };
    }
    return clip;
  });

  return {
    ...project,
    clipSettings: {
      mode: "manual",
      clips: updatedClips
    }
  };
}
