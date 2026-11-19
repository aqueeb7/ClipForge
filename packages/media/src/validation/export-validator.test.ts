import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { validateExportedClip } from "./export-validator.js";
import { detectFFmpeg, runProcess } from "../ffmpeg/discovery.js";
import { createDefaultProject } from "@clipforge/core";
import { Clip, ErrorCode } from "@clipforge/shared";

describe("Export Validator", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_val_test_${Date.now()}`);
  const validVerticalPath = path.join(tempDir, "valid_vertical.mp4");
  const invalidResPath = path.join(tempDir, "invalid_res.mp4");
  const emptyPath = path.join(tempDir, "empty.mp4");

  const project = createDefaultProject({
    id: "proj_val",
    name: "Validation Test",
    videoPath: "C:/test.mp4",
    videoDurationSeconds: 10,
    outputDirectory: tempDir
  });

  const clip: Clip = {
    id: "clip_1",
    index: 1,
    title: "Part 001",
    sourceStartSeconds: 0,
    sourceEndSeconds: 2,
    enabled: true,
    outputName: "valid_vertical.mp4",
    status: "pending"
  };

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(emptyPath, Buffer.alloc(0));

    const ffmpeg = await detectFFmpeg();
    if (ffmpeg.available && ffmpeg.path) {
      // 1. Generate valid 1080x1920 2-second vertical video
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=2:size=1080x1920:rate=30",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        validVerticalPath
      ]);

      // 2. Generate 320x240 video (invalid resolution)
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=2:size=320x240:rate=30",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        invalidResPath
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

  it("passes validation on valid 1080x1920 vertical video", async () => {
    const ffmpeg = await detectFFmpeg();
    if (!ffmpeg.available || !ffmpeg.path) return;

    const validated = await validateExportedClip({
      outputPath: validVerticalPath,
      clip,
      project
    });

    expect(validated.outputPath).toBe(validVerticalPath);
    expect(validated.durationSeconds).toBeGreaterThan(1.8);
    expect(validated.fileSizeBytes).toBeGreaterThan(0);
    expect(validated.inspection.primaryVideo?.width).toBe(1080);
    expect(validated.inspection.primaryVideo?.height).toBe(1920);
  });

  it("rejects file with incorrect resolution", async () => {
    const ffmpeg = await detectFFmpeg();
    if (!ffmpeg.available || !ffmpeg.path) return;

    await expect(
      validateExportedClip({
        outputPath: invalidResPath,
        clip,
        project
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCode.OUTPUT_VALIDATION_FAILED
      })
    );
  });

  it("rejects empty 0-byte file", async () => {
    await expect(
      validateExportedClip({
        outputPath: emptyPath,
        clip,
        project
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCode.OUTPUT_VALIDATION_FAILED
      })
    );
  });
});
