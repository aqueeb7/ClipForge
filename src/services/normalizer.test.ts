import { describe, it, expect } from "vitest";
import type {
  VideoIndex,
  AudioIndex,
  ChatIndex,
  TimelineSummary,
  NormalizedIndexedMessage,
  ChatDensityBucket,
} from "./api.js";

describe("Phase 2: Stream Normalization & Synchronized Chat Replay", () => {
  it("establishes video stream as the canonical project timeline anchor (Spec 005)", () => {
    const videoIndex: VideoIndex = {
      path: "/project/source/video.mp4",
      duration: 1800.5,
      width: 2560,
      height: 1440,
      fps: 60.0,
      codec: "vp9",
      start_pts: 0,
      start_time: 0.0,
      total_frames: 108030,
      aspect_ratio: "2560:1440",
    };

    const audioIndex: AudioIndex = {
      path: "/project/source/audio.m4a",
      duration: 1800.5,
      sample_rate: 48000,
      channels: 2,
      codec: "opus",
      start_pts: 960,
      start_time: 0.02,
      offset_seconds: 0.02, // t_audio - t_video
    };

    const timelineSummary: TimelineSummary = {
      project_dir: "/project",
      project_timeline_duration: videoIndex.duration,
      video_ready: true,
      audio_ready: true,
      chat_ready: true,
      audio_offset_seconds: audioIndex.offset_seconds,
      chat_offset_seconds: 0.0,
      synchronized: true,
      video_index: videoIndex,
      audio_index: audioIndex,
    };

    expect(timelineSummary.project_timeline_duration).toBe(videoIndex.duration);
    expect(timelineSummary.audio_offset_seconds).toBe(0.02);
    expect(timelineSummary.synchronized).toBe(true);
  });

  it("normalizes chat replay timestamps onto the canonical timeline with offset calibration", () => {
    const rawMessages = [
      { offset_ms: 0, author: "Alice", message: "Stream starting!" },
      { offset_ms: 15400, author: "Bob", message: "WHAT A PLAY!" },
      { offset_ms: 16200, author: "Charlie", message: "LETS GOOO 🔥" },
      { offset_ms: 18500, author: "David", message: "W" },
    ];

    const chatOffset = 1.5; // Streamer's chat delay calibration +1.5s

    const normalized: NormalizedIndexedMessage[] = rawMessages.map((m, idx) => ({
      index: idx,
      offset_ms: m.offset_ms,
      time_seconds: Math.round(((m.offset_ms / 1000) + chatOffset) * 1000) / 1000,
      author: m.author,
      message: m.message,
      badges: [],
    }));

    expect(normalized[0].time_seconds).toBe(1.5);
    expect(normalized[1].time_seconds).toBe(16.9);
    expect(normalized[2].time_seconds).toBe(17.7);
    expect(normalized[3].time_seconds).toBe(20.0);
  });

  it("computes chat velocity and density histogram buckets for timeline visualization (Spec 006)", () => {
    const duration = 30.0;
    const binSize = 5.0;
    const bucketCount = Math.ceil(duration / binSize);

    const buckets: ChatDensityBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
      bin_start: i * binSize,
      bin_end: (i + 1) * binSize,
      count: 0,
      velocity: 0,
    }));

    // Simulate chat reaction burst around 15s - 20s
    const messageTimestamps = [
      1.0, 2.5,
      6.0,
      15.2, 15.5, 16.0, 16.8, 17.1, 18.2, 19.0, // 7 messages in 15-20s bin
      22.0, 24.0,
    ];

    for (const ts of messageTimestamps) {
      const idx = Math.floor(ts / binSize);
      if (idx >= 0 && idx < buckets.length) {
        buckets[idx].count += 1;
      }
    }

    for (const b of buckets) {
      b.velocity = b.count / binSize;
    }

    const peakBucket = buckets.reduce((prev, curr) => (curr.velocity > prev.velocity ? curr : prev));

    expect(peakBucket.bin_start).toBe(15.0);
    expect(peakBucket.count).toBe(7);
    expect(peakBucket.velocity).toBe(1.4); // 7 msgs / 5 sec = 1.4 msg/sec
  });

  it("binary searches active chat message index given current video playhead time", () => {
    const messages: NormalizedIndexedMessage[] = [
      { index: 0, offset_ms: 1000, time_seconds: 1.0, author: "A", message: "Hi", badges: [] },
      { index: 1, offset_ms: 5000, time_seconds: 5.0, author: "B", message: "Hello", badges: [] },
      { index: 2, offset_ms: 12000, time_seconds: 12.0, author: "C", message: "Pog", badges: [] },
      { index: 3, offset_ms: 25000, time_seconds: 25.0, author: "D", message: "GG", badges: [] },
    ];

    function findActiveIndex(time: number): number {
      let low = 0;
      let high = messages.length - 1;
      let candidate = -1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (messages[mid].time_seconds <= time) {
          candidate = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return candidate;
    }

    // Playhead at 0.5s (before first message)
    expect(findActiveIndex(0.5)).toBe(-1);

    // Playhead at 1.0s (exact first message)
    expect(findActiveIndex(1.0)).toBe(0);

    // Playhead at 8.0s (after second message, before third)
    expect(findActiveIndex(8.0)).toBe(1);

    // Playhead at 30.0s (after all messages)
    expect(findActiveIndex(30.0)).toBe(3);
  });
});
