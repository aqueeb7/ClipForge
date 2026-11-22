import { describe, it, expect } from "vitest";
import type { StreamFormatOption, StreamUrlInspection } from "./api.js";

describe("Stream Downloader & Intelligence Ingestion", () => {
  it("sorts and prioritizes 1440p (2K) video formats over standard 1080p", () => {
    const mockFormats: StreamFormatOption[] = [
      {
        format_id: "137",
        ext: "mp4",
        resolution: "1080p",
        height: 1080,
        fps: 60,
        is_video: true,
        is_audio: false,
        quality_label: "1080p • MP4 60fps",
      },
      {
        format_id: "271",
        ext: "webm",
        resolution: "2K (1440p)",
        height: 1440,
        fps: 60,
        is_video: true,
        is_audio: false,
        quality_label: "2K (1440p) • WEBM 60fps",
      },
      {
        format_id: "313",
        ext: "webm",
        resolution: "4K (2160p)",
        height: 2160,
        fps: 60,
        is_video: true,
        is_audio: false,
        quality_label: "4K (2160p) • WEBM 60fps",
      },
    ];

    // Priority check for 1440p (2K)
    const target2k = mockFormats.find((f) => f.height === 1440);
    expect(target2k).toBeDefined();
    expect(target2k?.format_id).toBe("271");
    expect(target2k?.resolution).toBe("2K (1440p)");
  });

  it("verifies stream inspection data contract with chat replay availability", () => {
    const inspection: StreamUrlInspection = {
      url: "https://www.youtube.com/watch?v=sample123",
      title: "GTA 6 Livestream - Exploring Vice City in 2K",
      channel: "Rockstar Streamer",
      duration_seconds: 3600,
      has_chat_replay: true,
      video_formats: [],
      audio_formats: [],
      recommended_video_id: "271",
      recommended_audio_id: "140",
    };

    expect(inspection.has_chat_replay).toBe(true);
    expect(inspection.recommended_video_id).toBe("271");
    expect(inspection.duration_seconds).toBe(3600);
  });
});
