import fs from "node:fs/promises";
import {
  Clip,
  ClipForgeProject,
  ClipForgeError,
  ErrorCode,
  MediaInspectionResult
} from "@clipforge/shared";
import { inspectMedia } from "../ffprobe/inspector.js";

export interface ValidateExportOptions {
  outputPath: string;
  clip: Clip;
  project: ClipForgeProject;
  ffprobePath?: string;
  durationToleranceSeconds?: number;
}

export interface ValidatedExportInfo {
  outputPath: string;
  durationSeconds: number;
  fileSizeBytes: number;
  inspection: MediaInspectionResult;
}

export async function validateExportedClip(
  options: ValidateExportOptions
): Promise<ValidatedExportInfo> {
  const { outputPath, clip, ffprobePath, durationToleranceSeconds = 1.5 } = options;

  // 1. Verify physical file on disk
  let stats;
  try {
    stats = await fs.stat(outputPath);
  } catch (err: unknown) {
    throw new ClipForgeError({
      code: ErrorCode.OUTPUT_VALIDATION_FAILED,
      message: `Rendered file does not exist on disk: ${outputPath}`,
      targetPath: outputPath,
      cause: err
    });
  }

  if (stats.size === 0) {
    throw new ClipForgeError({
      code: ErrorCode.OUTPUT_VALIDATION_FAILED,
      message: `Rendered file has 0 bytes: ${outputPath}`,
      targetPath: outputPath
    });
  }

  // 2. Inspect with FFprobe
  const inspection = await inspectMedia(outputPath, { ffprobePath });

  // 3. Verify video stream & resolution
  const primaryVideo = inspection.primaryVideo;
  if (!primaryVideo) {
    throw new ClipForgeError({
      code: ErrorCode.OUTPUT_VALIDATION_FAILED,
      message: `Rendered file contains no valid video stream: ${outputPath}`,
      targetPath: outputPath
    });
  }

  if (primaryVideo.width !== 1080 || primaryVideo.height !== 1920) {
    throw new ClipForgeError({
      code: ErrorCode.OUTPUT_VALIDATION_FAILED,
      message: `Invalid resolution: expected 1080x1920, but got ${primaryVideo.width}x${primaryVideo.height}`,
      targetPath: outputPath,
      diagnosticContext: { expected: "1080x1920", actual: `${primaryVideo.width}x${primaryVideo.height}` }
    });
  }

  // 4. Verify duration against expected segment duration
  const expectedDuration = clip.sourceEndSeconds - clip.sourceStartSeconds;
  const actualDuration = inspection.container.durationSeconds;
  const diff = Math.abs(actualDuration - expectedDuration);

  if (diff > durationToleranceSeconds) {
    throw new ClipForgeError({
      code: ErrorCode.OUTPUT_VALIDATION_FAILED,
      message: `Output duration mismatch: expected ${expectedDuration.toFixed(2)}s, but got ${actualDuration.toFixed(2)}s (diff: ${diff.toFixed(2)}s > ${durationToleranceSeconds}s)`,
      targetPath: outputPath,
      diagnosticContext: { expectedDuration, actualDuration, diff }
    });
  }

  return {
    outputPath,
    durationSeconds: actualDuration,
    fileSizeBytes: stats.size,
    inspection
  };
}
