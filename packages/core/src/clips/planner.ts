import {
  Clip,
  ClipForgeProject,
  ClipManifest,
  ClipManifestSchema,
  AutomaticClipSettings,
  ClipForgeError,
  ErrorCode,
  DEFAULT_NAMING_PATTERN
} from "@clipforge/shared";
import { resolveClipFilename } from "./naming.js";
import { generateManualClips } from "./manual.js";

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
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `Invalid clipping range: start (${settings.startSeconds}s) is greater than or equal to end (${maxEndSeconds}s)`,
      diagnosticContext: { startSeconds: settings.startSeconds, endSeconds: maxEndSeconds }
    });
  }

  const durationMs = Math.round(settings.durationSeconds * 1000);
  if (durationMs <= 0) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `Clip duration must be positive: ${settings.durationSeconds}s`
    });
  }

  const overlapMs = Math.round(settings.overlapSeconds * 1000);
  if (overlapMs >= durationMs) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_CLIP_RANGE,
      message: `Overlap (${settings.overlapSeconds}s) cannot be greater than or equal to clip duration (${settings.durationSeconds}s)`
    });
  }

  const stepMs = durationMs - overlapMs;
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

export function generateClipManifest(project: ClipForgeProject): ClipManifest {
  const namingPattern = project.export.namingPattern || DEFAULT_NAMING_PATTERN;
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

  const manifest: ClipManifest = {
    projectId: project.id,
    projectName: project.name,
    totalClips: clips.length,
    generatedAt: new Date().toISOString(),
    clips
  };

  return ClipManifestSchema.parse(manifest);
}
