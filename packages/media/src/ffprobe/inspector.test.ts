import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { inspectMedia } from "./inspector.js";
import { detectFFmpeg, runProcess } from "../ffmpeg/discovery.js";
import { ErrorCode } from "@clipforge/shared";

describe("Media Inspection (FFprobe)", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_inspect_test_${Date.now()}`);
  const sampleVideoPath = path.join(tempDir, "sample_test.mp4");
  const sampleTextPath = path.join(tempDir, "not_video.txt");

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(sampleTextPath, "This is not a valid video file.", "utf8");

    // Generate small 2-second synthetic video fixture if FFmpeg is available
    const ffmpeg = await detectFFmpeg();
    if (ffmpeg.available && ffmpeg.path) {
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=2:size=320x240:rate=30",
        "-f", "lavfi",
        "-i", "sine=frequency=1000:duration=2",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        sampleVideoPath
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

  it("inspects a synthetic video file and extracts container, video and audio streams", async () => {
    // Check if the synthetic video exists
    try {
      await fs.stat(sampleVideoPath);
    } catch {
      // If ffmpeg was not able to generate, skip the live file assertion
      return;
    }

    const result = await inspectMedia(sampleVideoPath);

    expect(result.filePath).toBe(path.resolve(sampleVideoPath));
    expect(result.container.format).toContain("mp4");
    expect(result.container.durationSeconds).toBeGreaterThan(1.8);
    expect(result.container.fileSizeBytes).toBeGreaterThan(0);

    expect(result.videoStreams.length).toBe(1);
    const video = result.videoStreams[0]!;
    expect(video.width).toBe(320);
    expect(video.height).toBe(240);
    expect(video.aspectRatio).toBe("4:3");
    expect(video.frameRate).toBe(30);
    expect(video.codec).toBe("h264");
    expect(video.pixelFormat).toBe("yuv420p");
    expect(video.isVariableFrameRate).toBe(false);

    expect(result.audioStreams.length).toBe(1);
    const audio = result.audioStreams[0]!;
    expect(audio.codec).toBe("aac");
    expect(audio.channels).toBe(1);
    expect(audio.sampleRate).toBeGreaterThan(0);
  });

  it("throws FILE_NOT_FOUND when file does not exist", async () => {
    const nonExistentPath = path.join(tempDir, "does_not_exist_12345.mp4");
    await expect(inspectMedia(nonExistentPath)).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCode.FILE_NOT_FOUND
      })
    );
  });

  it("throws INVALID_MEDIA_FILE when file is not a valid media file", async () => {
    await expect(inspectMedia(sampleTextPath)).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCode.INVALID_MEDIA_FILE
      })
    );
  });
});
