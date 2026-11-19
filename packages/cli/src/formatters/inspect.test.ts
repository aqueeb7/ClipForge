import { describe, it, expect } from "vitest";
import { formatInspectionResult, formatSeconds, formatBytes } from "./inspect.js";
import { MediaInspectionResult } from "@clipforge/shared";

describe("CLI Inspect Formatter", () => {
  it("formats seconds into HH:MM:SS.mmm accurately", () => {
    expect(formatSeconds(0)).toBe("00:00:00.000");
    expect(formatSeconds(65.5)).toBe("00:01:05.500");
    expect(formatSeconds(3661.123)).toBe("01:01:01.123");
  });

  it("formats bytes into human readable units", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(15 * 1024 * 1024)).toBe("15.0 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
  });

  it("formats a complete MediaInspectionResult cleanly", () => {
    const mockResult: MediaInspectionResult = {
      filePath: "C:/test/gameplay.mp4",
      container: {
        format: "mov,mp4,m4a,3gp,3g2,mj2",
        durationSeconds: 180,
        fileSizeBytes: 52428800,
        bitrateKbps: 2330,
        startTimestampSeconds: 0
      },
      videoStreams: [
        {
          index: 0,
          codec: "h264",
          profile: "High",
          pixelFormat: "yuv420p",
          width: 1920,
          height: 1080,
          aspectRatio: "16:9",
          frameRate: 60,
          frameRateFraction: "60/1",
          isVariableFrameRate: false,
          durationSeconds: 180,
          bitrateKbps: 2150,
          startTimestampSeconds: 0
        }
      ],
      audioStreams: [
        {
          index: 1,
          codec: "aac",
          profile: "LC",
          sampleRate: 48000,
          channels: 2,
          channelLayout: "stereo",
          bitrateKbps: 180,
          durationSeconds: 180,
          startTimestampSeconds: 0
        }
      ],
      primaryVideo: {
        index: 0,
        codec: "h264",
        profile: "High",
        pixelFormat: "yuv420p",
        width: 1920,
        height: 1080,
        aspectRatio: "16:9",
        frameRate: 60,
        frameRateFraction: "60/1",
        isVariableFrameRate: false,
        durationSeconds: 180,
        bitrateKbps: 2150,
        startTimestampSeconds: 0
      },
      primaryAudio: {
        index: 1,
        codec: "aac",
        profile: "LC",
        sampleRate: 48000,
        channels: 2,
        channelLayout: "stereo",
        bitrateKbps: 180,
        durationSeconds: 180,
        startTimestampSeconds: 0
      }
    };

    const output = formatInspectionResult(mockResult);
    expect(output).toContain("ClipForge Media Inspection");
    expect(output).toContain("1920x1080 (16:9)");
    expect(output).toContain("[CFR - Constant Frame Rate]");
    expect(output).toContain("48,000 Hz");
    expect(output).toContain("stereo");
  });
});
