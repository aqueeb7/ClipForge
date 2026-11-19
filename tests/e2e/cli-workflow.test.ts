import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import {
  detectFFmpeg,
  runProcess,
  inspectMedia,
  RenderQueueManager
} from "@clipforge/media";
import {
  createDefaultProject,
  generateClipManifest,
  saveProjectFile,
  loadProjectFile
} from "@clipforge/core";

describe("E2E Acceptance Scenario: End-to-End Production Pipeline", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_e2e_${Date.now()}`);
  const videoInputPath = path.join(tempDir, "gameplay_180s.mp4");
  const audioInputPath = path.join(tempDir, "commentary.wav");
  const projectFilePath = path.join(tempDir, "project.json");
  const exportsDir = path.join(tempDir, "Exports");

  beforeAll(async () => {
    await fs.mkdir(exportsDir, { recursive: true });

    const ffmpeg = await detectFFmpeg();
    if (ffmpeg.available && ffmpeg.path) {
      // 1. Generate 3-second synthetic gameplay video (scalable proxy for 180s in fast tests)
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=3:size=1920x1080:rate=60",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-an",
        videoInputPath
      ]);

      // 2. Generate separate audio file
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "sine=frequency=440:duration=3",
        audioInputPath
      ]);
    }
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it("executes the complete production workflow from inspection to export", async () => {
    const ffmpeg = await detectFFmpeg();
    if (!ffmpeg.available || !ffmpeg.path) return;

    // Step 1: Media Inspection
    const inspection = await inspectMedia(videoInputPath);
    expect(inspection.primaryVideo?.width).toBe(1920);
    expect(inspection.primaryVideo?.height).toBe(1080);
    expect(inspection.container.durationSeconds).toBeGreaterThan(2.8);

    // Step 2: Project Creation & Persistence
    const project = createDefaultProject({
      id: "e2e_gameplay_prod",
      name: "GTA VI E2E",
      videoPath: videoInputPath,
      videoDurationSeconds: inspection.container.durationSeconds,
      width: inspection.primaryVideo?.width,
      height: inspection.primaryVideo?.height,
      audioPath: audioInputPath,
      audioOffsetMs: 0,
      clipDurationSeconds: 1, // 1s clips
      outputDirectory: exportsDir
    });

    await saveProjectFile(projectFilePath, project);
    const loadedProject = await loadProjectFile(projectFilePath);
    expect(loadedProject.id).toBe("e2e_gameplay_prod");
    if (loadedProject.clipSettings.mode === "automatic") {
      loadedProject.clipSettings.minimumFinalClipSeconds = 0.5;
    }

    // Step 3: Clip Planning Manifest
    const manifest = generateClipManifest(loadedProject);
    expect(manifest.totalClips).toBe(3);

    // Step 4: Batch Render Execution (Nested layout)
    const queue = new RenderQueueManager();
    const summary = await queue.runBatch({
      project: loadedProject,
      manifest,
      structure: "nested",
      outputDirectory: exportsDir
    });

    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(3);
    expect(summary.failed).toBe(0);

    // Step 5: Verify Output Validation & Nested Structure
    for (const job of summary.jobs) {
      expect(job.status).toBe("completed");
      expect(job.outputPath).toBeDefined();

      // Nested check: path contains episode folder
      expect(job.outputPath).toMatch(/Part_\d{3}/);

      const clipInspection = await inspectMedia(job.outputPath!);
      expect(clipInspection.videoStreams.length).toBe(1);
      expect(clipInspection.audioStreams.length).toBe(1);

      const v = clipInspection.videoStreams[0]!;
      expect(v.width).toBe(1080);
      expect(v.height).toBe(1920);
      expect(v.aspectRatio).toBe("9:16");
      expect(v.pixelFormat).toBe("yuv420p");
    }

    // Step 6: Verify export-summary.json exists and contains details
    const summaryFilePath = path.join(exportsDir, "export-summary.json");
    const summaryContent = await fs.readFile(summaryFilePath, "utf8");
    const parsedSummary = JSON.parse(summaryContent);

    expect(parsedSummary.projectId).toBe("e2e_gameplay_prod");
    expect(parsedSummary.completed).toBe(3);
    expect(parsedSummary.outputs.length).toBe(3);
  });
});
