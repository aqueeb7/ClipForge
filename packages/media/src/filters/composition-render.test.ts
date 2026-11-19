import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { detectFFmpeg, runProcess } from "../ffmpeg/discovery.js";
import { inspectMedia } from "../ffprobe/inspector.js";
import { buildCompositionFilter } from "./composition.js";
import { CompositionSettingsSchema } from "@clipforge/shared";

describe("Vertical Composition Rendering Integration", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_comp_test_${Date.now()}`);
  const inputVideoPath = path.join(tempDir, "horizontal_input.mp4");
  const outputVerticalPath = path.join(tempDir, "vertical_output.mp4");

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });

    const ffmpeg = await detectFFmpeg();
    if (ffmpeg.available && ffmpeg.path) {
      // 1. Generate 1-second 320x240 horizontal test video
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=1:size=320x240:rate=30",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
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

  it("renders a 1080x1920 9:16 vertical video with blurred background and branding overlay", async () => {
    const ffmpeg = await detectFFmpeg();
    if (!ffmpeg.available || !ffmpeg.path) return;

    const composition = CompositionSettingsSchema.parse({
      background: { mode: "blur", blurRadius: 20, color: "#000000" },
      gameplay: { mode: "contain", scale: 1, offsetX: 0, offsetY: 0 },
      overlay: {
        enabled: true,
        brandTitle: "CLIPFORGE",
        episodeLabel: "PART",
        showEpisodeNumber: true
      }
    });

    const filterResult = buildCompositionFilter({
      composition,
      mainTitle: "TEST RUN",
      episodeIndex: 1
    });

    const ffmpegArgs = [
      "-y",
      "-i", inputVideoPath,
      "-filter_complex", filterResult.filterGraph,
      "-map", `[${filterResult.outputLabel}]`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "22",
      "-pix_fmt", "yuv420p",
      outputVerticalPath
    ];

    const { exitCode, stderr } = await runProcess(ffmpeg.path, ffmpegArgs);
    expect(exitCode, `FFmpeg composition failed: ${stderr}`).toBe(0);

    // Inspect the rendered vertical video
    const inspection = await inspectMedia(outputVerticalPath);
    expect(inspection.videoStreams.length).toBe(1);

    const video = inspection.videoStreams[0]!;
    expect(video.width).toBe(1080);
    expect(video.height).toBe(1920);
    expect(video.aspectRatio).toBe("9:16");
    expect(video.pixelFormat).toBe("yuv420p");
    expect(video.codec).toBe("h264");
  });
});
