import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createDefaultProject, generateClipManifest } from "@clipforge/core";
import { detectFFmpeg, runProcess } from "../ffmpeg/discovery.js";
import { inspectMedia } from "../ffprobe/inspector.js";
import { RenderQueueManager } from "./queue.js";

describe("Batch Render Integration", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_batch_test_${Date.now()}`);
  const inputVideoPath = path.join(tempDir, "source_sample.mp4");
  const outputDir = path.join(tempDir, "exports");

  beforeAll(async () => {
    await fs.mkdir(outputDir, { recursive: true });

    const ffmpeg = await detectFFmpeg();
    if (ffmpeg.available && ffmpeg.path) {
      // 1. Generate 3-second horizontal test video
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=3:size=320x240:rate=30",
        "-f", "lavfi",
        "-i", "sine=frequency=440:duration=3",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        inputVideoPath
      ]);
    }
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  it("renders a batch of 2 vertical clips in sequence with real FFmpeg and validates outputs", async () => {
    const ffmpeg = await detectFFmpeg();
    if (!ffmpeg.available || !ffmpeg.path) return;

    const project = createDefaultProject({
      id: "proj_batch_run",
      name: "Batch Test",
      videoPath: inputVideoPath,
      videoDurationSeconds: 3,
      clipDurationSeconds: 1, // 1s per clip -> 3 clips
      outputDirectory: outputDir
    });

    const manifest = generateClipManifest(project);
    const queue = new RenderQueueManager();

    // Render only clips #1 and #2 to keep test fast
    const summary = await queue.runBatch({
      project,
      manifest,
      onlyIndices: [1, 2],
      outputDirectory: outputDir
    });

    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(2);
    expect(summary.failed).toBe(0);

    // Inspect each output file
    for (const job of summary.jobs) {
      expect(job.status).toBe("completed");
      expect(job.outputPath).toBeDefined();

      const inspection = await inspectMedia(job.outputPath!);
      expect(inspection.videoStreams.length).toBe(1);
      const v = inspection.videoStreams[0]!;
      expect(v.width).toBe(1080);
      expect(v.height).toBe(1920);
      expect(v.aspectRatio).toBe("9:16");
      expect(v.pixelFormat).toBe("yuv420p");
    }
  });
});
