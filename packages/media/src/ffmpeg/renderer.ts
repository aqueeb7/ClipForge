import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  Clip,
  ClipForgeProject,
  ClipForgeError,
  ErrorCode
} from "@clipforge/shared";
import { detectFFmpeg } from "./discovery.js";
import { parseProgressBuffer, FFmpegProgress } from "./progress.js";
import { buildCompositionFilter } from "../filters/composition.js";
import { calculateAudioSyncPlan } from "../synchronization/calculator.js";
import { buildAudioSyncFilter } from "../synchronization/filter-builder.js";
import { validateExportedClip } from "../validation/export-validator.js";

export interface RenderClipOptions {
  project: ClipForgeProject;
  clip: Clip;
  outputPath: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  onProgress?: (progress: FFmpegProgress) => void;
  onStderr?: (chunk: string) => void;
}

export interface RenderClipResult {
  outputPath: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

export interface RenderJobController {
  promise: Promise<RenderClipResult>;
  cancel: () => Promise<void>;
  process?: ChildProcess;
}

export function buildRenderArguments(
  project: ClipForgeProject,
  clip: Clip,
  outputPath: string
): { args: string[]; targetDuration: number } {
  const clipDuration = Math.max(0.1, clip.sourceEndSeconds - clip.sourceStartSeconds);
  const args: string[] = ["-y"];

  // 1. Primary video input with seek
  args.push("-ss", String(clip.sourceStartSeconds));
  args.push("-t", String(clipDuration));
  args.push("-i", project.sources.video.path);

  // 2. Audio input & synchronization
  const hasSeparateAudio = Boolean(project.sources.audio?.path);
  let audioInputIndex = 0;

  if (hasSeparateAudio && project.sources.audio?.path) {
    audioInputIndex = 1;
    const syncPlan = calculateAudioSyncPlan({
      clipStartSeconds: clip.sourceStartSeconds,
      clipEndSeconds: clip.sourceEndSeconds,
      audioOffsetMs: project.synchronization.audioOffsetMs,
      audioDurationSeconds: project.sources.audio.durationSeconds,
      hasAudioSource: true
    });

    const audioFilter = buildAudioSyncFilter({ plan: syncPlan });
    if (audioFilter.inputArgs.length > 0) {
      args.push(...audioFilter.inputArgs);
    }
    args.push("-i", project.sources.audio.path);
  }

  // 3. Complex filter graphs
  const filterParts: string[] = [];

  // Video composition
  const compResult = buildCompositionFilter({
    composition: project.composition,
    mainTitle: project.name,
    episodeIndex: clip.index,
    inputLabel: "0:v",
    outputLabel: "vout"
  });
  filterParts.push(compResult.filterGraph);

  // Audio filter
  let audioMapLabel = `${audioInputIndex}:a:0?`;
  if (hasSeparateAudio) {
    const syncPlan = calculateAudioSyncPlan({
      clipStartSeconds: clip.sourceStartSeconds,
      clipEndSeconds: clip.sourceEndSeconds,
      audioOffsetMs: project.synchronization.audioOffsetMs,
      audioDurationSeconds: project.sources.audio?.durationSeconds,
      hasAudioSource: true
    });
    const audioFilter = buildAudioSyncFilter({ plan: syncPlan });
    filterParts.push(`[1:a]${audioFilter.filterGraph}[aout]`);
    audioMapLabel = "[aout]";
  }

  args.push("-filter_complex", filterParts.join(";"));
  args.push("-map", `[${compResult.outputLabel}]`);
  args.push("-map", audioMapLabel);

  // 4. Video encoding options
  const crf = project.export.crf ?? 21;
  const preset = project.export.preset ?? "veryfast";
  args.push("-c:v", "libx264", "-preset", preset, "-crf", String(crf), "-pix_fmt", "yuv420p");

  // 5. Audio encoding options
  args.push("-c:a", "aac", "-b:a", "192k", "-ar", "48000");

  // 6. Streaming & progress options
  args.push("-movflags", "+faststart");
  args.push("-progress", "pipe:1");
  args.push("-nostats");

  // 7. Output target
  args.push(outputPath);

  return { args, targetDuration: clipDuration };
}

export function executeRenderClip(options: RenderClipOptions): RenderJobController {
  let child: ChildProcess | undefined;
  let isCancelled = false;
  let progressBuffer = "";

  const promise = (async (): Promise<RenderClipResult> => {
    const ffmpegInfo = await detectFFmpeg(options.ffmpegPath);
    if (!ffmpegInfo.available || !ffmpegInfo.path) {
      throw new ClipForgeError({
        code: ErrorCode.FFMPEG_NOT_FOUND,
        message: "FFmpeg executable not found. Cannot render clip."
      });
    }

    await fs.mkdir(path.dirname(options.outputPath), { recursive: true });

    const { args, targetDuration } = buildRenderArguments(
      options.project,
      options.clip,
      options.outputPath
    );

    return new Promise<RenderClipResult>((resolve, reject) => {
      let stderrAccum = "";

      try {
        child = spawn(ffmpegInfo.path!, args, {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (err: unknown) {
        return reject(
          new ClipForgeError({
            code: ErrorCode.ENCODING_FAILED,
            message: `Failed to spawn FFmpeg process: ${String(err)}`,
            cause: err
          })
        );
      }

      child.stdout?.on("data", (chunk: Buffer) => {
        progressBuffer += chunk.toString();
        const progress = parseProgressBuffer(progressBuffer, targetDuration);
        if (progress) {
          options.onProgress?.(progress);
          // Keep only trailing partial buffer
          const lastIdx = progressBuffer.lastIndexOf("\n");
          if (lastIdx !== -1) {
            progressBuffer = progressBuffer.slice(lastIdx + 1);
          }
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderrAccum += text;
        if (stderrAccum.length > 50000) {
          stderrAccum = stderrAccum.slice(-50000); // keep tail
        }
        options.onStderr?.(text);
      });

      child.on("error", (err) => {
        if (!isCancelled) {
          reject(
            new ClipForgeError({
              code: ErrorCode.ENCODING_FAILED,
              message: `FFmpeg process error: ${err.message}`,
              targetPath: options.outputPath,
              cause: err
            })
          );
        }
      });

      child.on("close", async (code) => {
        if (isCancelled) {
          return reject(
            new ClipForgeError({
              code: ErrorCode.JOB_CANCELLED,
              message: `Render job was cancelled for clip: ${options.clip.outputName}`,
              targetPath: options.outputPath
            })
          );
        }

        if (code !== 0) {
          return reject(
            new ClipForgeError({
              code: ErrorCode.ENCODING_FAILED,
              message: `FFmpeg exited with non-zero code ${code} for clip: ${options.clip.outputName}`,
              targetPath: options.outputPath,
              diagnosticContext: { stderr: stderrAccum.slice(-1000) }
            })
          );
        }

        // Validate output with FFprobe
        try {
          const validated = await validateExportedClip({
            outputPath: options.outputPath,
            clip: options.clip,
            project: options.project,
            ffprobePath: options.ffprobePath
          });

          resolve({
            outputPath: validated.outputPath,
            durationSeconds: validated.durationSeconds,
            fileSizeBytes: validated.fileSizeBytes
          });
        } catch (err: unknown) {
          reject(err);
        }
      });
    });
  })();

  const cancel = async (): Promise<void> => {
    isCancelled = true;
    if (child && !child.killed) {
      try {
        child.kill("SIGTERM");
      } catch {
        // Fallback
      }
    }
    // Clean up partial output file
    try {
      await fs.unlink(options.outputPath);
    } catch {
      // Best effort cleanup
    }
  };

  return {
    promise,
    cancel,
    process: child
  };
}
