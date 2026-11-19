import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { detectFFmpeg, runProcess } from "../ffmpeg/discovery.js";
import { inspectMedia } from "../ffprobe/inspector.js";
import { calculateAudioSyncPlan } from "./calculator.js";
import { buildAudioSyncFilter } from "./filter-builder.js";

describe("Audio Synchronization Rendering Integration", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_sync_test_${Date.now()}`);
  const videoInputPath = path.join(tempDir, "source_video.mp4");
  const audioInputPath = path.join(tempDir, "separate_audio.wav");
  const outputPath = path.join(tempDir, "synced_output.mp4");

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });

    const ffmpeg = await detectFFmpeg();
    if (ffmpeg.available && ffmpeg.path) {
      // 1. Generate 4-second synthetic video
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=4:size=320x240:rate=30",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-an",
        videoInputPath
      ]);

      // 2. Generate 2-second synthetic audio (shorter than video)
      await runProcess(ffmpeg.path, [
        "-y",
        "-f", "lavfi",
        "-i", "sine=frequency=440:duration=2",
        audioInputPath
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

  it("muxes video with separate audio applying positive offset and padding shorter audio", async () => {
    const ffmpeg = await detectFFmpeg();
    if (!ffmpeg.available || !ffmpeg.path) return;

    // Plan for 4s clip, audio started 1s late (+1000ms), audio is only 2s long
    const plan = calculateAudioSyncPlan({
      clipStartSeconds: 0,
      clipEndSeconds: 4,
      audioOffsetMs: 1000,
      audioDurationSeconds: 2
    });

    // 1s lead padding, 2s audio from file, 1s trailing padding = 4s total
    expect(plan.leadPaddingMs).toBe(1000);
    expect(plan.sourceDurationSeconds).toBe(2);
    expect(plan.trailPaddingMs).toBe(1000);

    const filterResult = buildAudioSyncFilter({ plan });

    // Spawn FFmpeg to render output
    const ffmpegArgs = [
      "-y",
      "-i", videoInputPath,
      ...filterResult.inputArgs,
      "-i", audioInputPath,
      "-c:v", "copy",
      "-filter_complex", `[1:a]${filterResult.filterGraph}[aout]`,
      "-map", "0:v:0",
      "-map", "[aout]",
      ...filterResult.encodingArgs,
      outputPath
    ];

    const { exitCode, stderr } = await runProcess(ffmpeg.path, ffmpegArgs);
    expect(exitCode, `FFmpeg failed: ${stderr}`).toBe(0);

    // Inspect the rendered file
    const inspection = await inspectMedia(outputPath);
    expect(inspection.videoStreams.length).toBe(1);
    expect(inspection.audioStreams.length).toBe(1);

    const audioStream = inspection.audioStreams[0]!;
    expect(audioStream.codec).toBe("aac");
    expect(audioStream.sampleRate).toBe(48000);
    // Duration should match full 4-second clip duration within 0.1s tolerance
    expect(audioStream.durationSeconds).toBeGreaterThan(3.9);
    expect(audioStream.durationSeconds).toBeLessThan(4.1);
  });
});
