import {
  Clip,
  ManualClipItem,
  ManualClipItemSchema,
  ManualClipSettings,
  ClipForgeProject,
  ClipForgeError,
  ErrorCode,
  DEFAULT_NAMING_PATTERN
} from "@clipforge/shared";
import { resolveClipFilename } from "./naming.js";

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
    validateManualClipItem(item, sourceDuration, clipIndex);

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
      status: "pending"
    });
  }

  return clips;
}

export function validateManualClipItem(
  item: ManualClipItem,
  sourceDuration: number,
  index?: number
): void {
  const label = index !== undefined ? `Clip #${index}` : "Clip";

  if (item.start < 0) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `${label} start time cannot be negative: ${item.start}s`,
      diagnosticContext: { item, sourceDuration }
    });
  }

  if (item.end <= item.start) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `${label} end time (${item.end}s) must be greater than start time (${item.start}s)`,
      diagnosticContext: { item, sourceDuration },
      suggestedAction: "Ensure the clip's end timestamp is strictly after its start timestamp."
    });
  }

  if (sourceDuration > 0 && item.end > sourceDuration + 0.05) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `${label} end time (${item.end}s) exceeds source video duration (${sourceDuration}s)`,
      diagnosticContext: { item, sourceDuration },
      suggestedAction: `Adjust the end timestamp to be within 0 to ${sourceDuration}s.`
    });
  }
}

export function addManualClip(
  project: ClipForgeProject,
  item: { start: number; end: number; title?: string; enabled?: boolean }
): ClipForgeProject {
  const parseResult = ManualClipItemSchema.safeParse({
    start: item.start,
    end: item.end,
    title: item.title,
    enabled: item.enabled ?? true
  });

  if (!parseResult.success) {
    const formatted = parseResult.error.issues.map((i) => i.message).join("; ");
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `Invalid clip timestamps: ${formatted}`,
      diagnosticContext: { item, issues: parseResult.error.issues },
      suggestedAction: "Ensure start is non-negative and end is greater than start."
    });
  }

  const validatedItem = parseResult.data;

  validateManualClipItem(
    validatedItem,
    project.sources.video.durationSeconds,
    project.clipSettings.mode === "manual" ? project.clipSettings.clips.length + 1 : 1
  );

  const existingClips =
    project.clipSettings.mode === "manual" ? [...project.clipSettings.clips] : [];

  existingClips.push(validatedItem);

  return {
    ...project,
    clipSettings: {
      mode: "manual",
      clips: existingClips
    }
  };
}

export function removeManualClip(project: ClipForgeProject, index: number): ClipForgeProject {
  if (project.clipSettings.mode !== "manual") {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_PROJECT_CONFIG,
      message: "Cannot remove manual clips from a project configured in automatic mode."
    });
  }

  if (index < 1 || index > project.clipSettings.clips.length) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `Clip index ${index} out of range (1 - ${project.clipSettings.clips.length})`
    });
  }

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
  if (project.clipSettings.mode !== "manual") {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_PROJECT_CONFIG,
      message: "Cannot toggle clips on a project configured in automatic mode."
    });
  }

  if (index < 1 || index > project.clipSettings.clips.length) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `Clip index ${index} out of range (1 - ${project.clipSettings.clips.length})`
    });
  }

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
