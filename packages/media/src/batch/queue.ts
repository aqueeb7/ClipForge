import path from "node:path";
import fs from "node:fs/promises";
import {
  Clip,
  ClipForgeProject,
  ClipManifest,
  RenderJob,
  RenderJobSchema,
  ClipForgeError,
  ErrorCode
} from "@clipforge/shared";
import {
  executeRenderClip,
  buildRenderArguments,
  RenderClipResult
} from "../ffmpeg/renderer.js";
import { FFmpegProgress } from "../ffmpeg/progress.js";
import { checkDirectoryWritable, getDiskSpace } from "../validation/system.js";

export interface BatchRenderOptions {
  project: ClipForgeProject;
  manifest: ClipManifest;
  onlyIndices?: number[];
  dryRun?: boolean;
  overwrite?: boolean;
  structure?: "flat" | "nested";
  outputDirectory?: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  onJobStart?: (job: RenderJob, clip: Clip) => void;
  onJobProgress?: (job: RenderJob, progress: FFmpegProgress) => void;
  onJobComplete?: (job: RenderJob, result: RenderClipResult) => void;
  onJobFail?: (job: RenderJob, error: Error) => void;
}

export interface RenderedOutputDetail {
  clipId: string;
  index: number;
  outputPath: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

export interface BatchRenderSummary {
  projectId: string;
  projectName: string;
  structure: "flat" | "nested";
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  startedAt: string;
  completedAt: string;
  outputDirectory: string;
  outputs: RenderedOutputDetail[];
  jobs: RenderJob[];
}

export class RenderQueueManager {
  private isCancelled = false;
  private currentCancelFn?: () => Promise<void>;

  public async runBatch(options: BatchRenderOptions): Promise<BatchRenderSummary> {
    const { project, manifest, onlyIndices, dryRun = false, overwrite = false } = options;
    const structure = options.structure ?? project.export.structure ?? "flat";
    const startedAt = new Date().toISOString();

    const baseOutputDir = options.outputDirectory
      ? path.resolve(options.outputDirectory)
      : path.resolve(project.export.outputDirectory);

    // 1. Pre-flight checks
    const isWritable = await checkDirectoryWritable(baseOutputDir);
    if (!isWritable) {
      throw new ClipForgeError({
        code: ErrorCode.DESTINATION_NOT_WRITABLE,
        message: `Output destination is not writable: ${baseOutputDir}`,
        targetPath: baseOutputDir,
        suggestedAction: "Check directory permissions or specify a different output path."
      });
    }

    const disk = await getDiskSpace(baseOutputDir);
    if (disk && disk.availableGb < 1.0) {
      throw new ClipForgeError({
        code: ErrorCode.INSUFFICIENT_DISK_SPACE,
        message: `Critically low disk space: only ${disk.availableGb} GB available on destination drive.`,
        targetPath: baseOutputDir,
        suggestedAction: "Free up disk space before initiating batch render."
      });
    }

    // 2. Filter target clips
    let targetClips = manifest.clips.filter((c) => c.enabled);
    if (onlyIndices && onlyIndices.length > 0) {
      const indexSet = new Set(onlyIndices);
      targetClips = targetClips.filter((c) => indexSet.has(c.index));
    }

    if (targetClips.length === 0) {
      return {
        projectId: project.id,
        projectName: project.name,
        structure,
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        startedAt,
        completedAt: new Date().toISOString(),
        outputDirectory: baseOutputDir,
        outputs: [],
        jobs: []
      };
    }

    // Determine paths based on structure (flat vs nested)
    const jobs: RenderJob[] = targetClips.map((clip) => {
      let clipOutputPath: string;
      if (structure === "nested") {
        const episodeFolder = `Part_${String(clip.index).padStart(3, "0")}`;
        clipOutputPath = path.join(baseOutputDir, episodeFolder, clip.outputName);
      } else {
        clipOutputPath = path.join(baseOutputDir, clip.outputName);
      }

      return RenderJobSchema.parse({
        id: `job_${project.id}_${clip.index}`,
        clipId: clip.id,
        status: "pending",
        progress: 0,
        outputPath: clipOutputPath
      });
    });

    let completedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const outputs: RenderedOutputDetail[] = [];

    for (let i = 0; i < targetClips.length; i++) {
      if (this.isCancelled) {
        for (let j = i; j < jobs.length; j++) {
          const jb = jobs[j];
          if (jb) jb.status = "cancelled";
        }
        break;
      }

      const clip = targetClips[i]!;
      const job = jobs[i]!;
      const outputPath = job.outputPath!;

      // Check if file already exists
      let fileExists = false;
      let existingSize = 0;
      try {
        const stat = await fs.stat(outputPath);
        if (stat.size > 0) {
          fileExists = true;
          existingSize = stat.size;
        }
      } catch {
        fileExists = false;
      }

      if (fileExists && !overwrite) {
        job.status = "completed";
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        skippedCount++;
        const duration = clip.sourceEndSeconds - clip.sourceStartSeconds;
        outputs.push({
          clipId: clip.id,
          index: clip.index,
          outputPath,
          durationSeconds: duration,
          fileSizeBytes: existingSize
        });
        options.onJobComplete?.(job, {
          outputPath,
          durationSeconds: duration,
          fileSizeBytes: existingSize
        });
        continue;
      }

      // Dry run simulation
      if (dryRun) {
        job.status = "completed";
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        completedCount++;
        buildRenderArguments(project, clip, outputPath);
        const duration = clip.sourceEndSeconds - clip.sourceStartSeconds;
        outputs.push({
          clipId: clip.id,
          index: clip.index,
          outputPath,
          durationSeconds: duration,
          fileSizeBytes: 0
        });
        options.onJobComplete?.(job, {
          outputPath,
          durationSeconds: duration,
          fileSizeBytes: 0
        });
        continue;
      }

      // Live FFmpeg execution
      job.status = "running";
      job.startedAt = new Date().toISOString();
      options.onJobStart?.(job, clip);

      const controller = executeRenderClip({
        project,
        clip,
        outputPath,
        ffmpegPath: options.ffmpegPath,
        ffprobePath: options.ffprobePath,
        onProgress: (p: FFmpegProgress) => {
          job.progress = p.progressPercent;
          options.onJobProgress?.(job, p);
        }
      });

      this.currentCancelFn = controller.cancel;

      try {
        const renderResult = await controller.promise;
        job.status = "completed";
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        completedCount++;
        outputs.push({
          clipId: clip.id,
          index: clip.index,
          outputPath: renderResult.outputPath,
          durationSeconds: renderResult.durationSeconds,
          fileSizeBytes: renderResult.fileSizeBytes
        });
        options.onJobComplete?.(job, renderResult);
      } catch (err: unknown) {
        job.status = this.isCancelled ? "cancelled" : "failed";
        job.error = err instanceof Error ? err.message : String(err);
        failedCount++;
        options.onJobFail?.(job, err instanceof Error ? err : new Error(String(err)));
      } finally {
        this.currentCancelFn = undefined;
      }
    }

    const completedAt = new Date().toISOString();
    const summary: BatchRenderSummary = {
      projectId: project.id,
      projectName: project.name,
      structure,
      total: jobs.length,
      completed: completedCount,
      failed: failedCount,
      skipped: skippedCount,
      startedAt,
      completedAt,
      outputDirectory: baseOutputDir,
      outputs,
      jobs
    };

    // Save export summary JSON if any jobs ran and not dry-run
    if (!dryRun) {
      try {
        const summaryPath = path.join(baseOutputDir, "export-summary.json");
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
      } catch {
        // Non-critical
      }
    }

    return summary;
  }

  public async cancel(): Promise<void> {
    this.isCancelled = true;
    if (this.currentCancelFn) {
      await this.currentCancelFn();
    }
  }
}
