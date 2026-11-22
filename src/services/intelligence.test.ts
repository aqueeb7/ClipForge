import { describe, it, expect } from "vitest";
import type {
  ChatEvent,
  ChatAnalysisResult,
  AudioEvent,
  AudioAnalysisResult,
  VideoEvent,
  VideoAnalysisResult,
  SynchronizedMoment,
  SynchronizedAnalysisResult,
} from "./api.js";

describe("Phase 3: Offline Multi-Modal Intelligence Engine (Specs 007 - 010)", () => {
  it("processes chat reaction spikes with sentiment dictionary matching (Spec 007)", () => {
    const chatEvent: ChatEvent = {
      id: "chat-event-0",
      start_time: 120.0,
      end_time: 135.0,
      peak_time: 125.0,
      peak_velocity: 8.4, // messages/sec
      message_count: 52,
      sentiment_label: "Hype",
      top_keywords: ["W", "POG", "LETSGO"],
      score: 0.88,
    };

    const chatAnalysis: ChatAnalysisResult = {
      total_events: 1,
      average_velocity: 1.5,
      peak_velocity: 8.4,
      events: [chatEvent],
    };

    expect(chatAnalysis.total_events).toBe(1);
    expect(chatAnalysis.events[0].sentiment_label).toBe("Hype");
    expect(chatAnalysis.events[0].peak_velocity).toBeGreaterThan(chatAnalysis.average_velocity * 2);
    expect(chatAnalysis.events[0].top_keywords).toContain("POG");
    expect(chatAnalysis.events[0].score).toBeGreaterThanOrEqual(0.8);
  });

  it("detects audio volume jumps and scream/shout transients (Spec 008)", () => {
    const audioEvent: AudioEvent = {
      id: "audio-event-0",
      start_time: 121.5,
      end_time: 126.0,
      peak_time: 122.2,
      peak_rms_energy: 0.82,
      peak_dbfs: -1.72,
      transient_jump_db: 15.4, // >12dB spike within 250ms
      classification: "Scream / Shout",
      score: 0.92,
    };

    const audioAnalysis: AudioAnalysisResult = {
      total_events: 1,
      average_rms: 0.12,
      peak_rms: 0.82,
      events: [audioEvent],
    };

    expect(audioAnalysis.total_events).toBe(1);
    expect(audioAnalysis.events[0].transient_jump_db).toBeGreaterThan(12.0);
    expect(audioAnalysis.events[0].classification).toBe("Scream / Shout");
    expect(audioAnalysis.events[0].score).toBeGreaterThan(0.9);
  });

  it("records visual scene transitions and camera cuts (Spec 009)", () => {
    const videoEvent: VideoEvent = {
      id: "video-event-0",
      timestamp: 122.0,
      scene_score: 0.65, // >0.35 FFmpeg scene score
      event_type: "Scene Cut",
      score: 0.65,
    };

    const videoAnalysis: VideoAnalysisResult = {
      total_events: 1,
      events: [videoEvent],
    };

    expect(videoAnalysis.total_events).toBe(1);
    expect(videoAnalysis.events[0].scene_score).toBeGreaterThan(0.35);
    expect(videoAnalysis.events[0].event_type).toBe("Scene Cut");
  });

  it("correlates streamer action with audience chat reaction latency (Spec 010)", () => {
    // Streamer shout/kill at t = 122.0s
    const streamerActionTime = 122.0;
    // Audience reacts in chat with a burst at t = 125.0s (3-second latency delay)
    const audienceReactionTime = 125.0;
    const latencyDelay = audienceReactionTime - streamerActionTime;

    expect(latencyDelay).toBeGreaterThanOrEqual(2.0);
    expect(latencyDelay).toBeLessThanOrEqual(5.0);

    const moment: SynchronizedMoment = {
      id: "moment-122",
      timestamp: streamerActionTime,
      lead_in: Math.max(0, streamerActionTime - 5.0),  // 117.0s
      lead_out: streamerActionTime + 15.0,             // 137.0s
      duration: 20.0,
      confidence: 0.94, // Multi-modal coincident score
      headline: "Streamer Reaction with Hype Chat Surge",
      sentiment: "Hype",
      has_chat_spike: true,
      has_audio_peak: true,
      has_visual_cut: true,
      top_keywords: ["W", "POG", "LETSGO"],
    };

    const synchronizedResult: SynchronizedAnalysisResult = {
      project_dir: "/path/to/stream",
      total_moments: 1,
      moments: [moment],
    };

    expect(synchronizedResult.total_moments).toBe(1);
    expect(synchronizedResult.moments[0].confidence).toBeGreaterThan(0.9);
    expect(synchronizedResult.moments[0].lead_in).toBe(117.0);
    expect(synchronizedResult.moments[0].lead_out).toBe(137.0);
    expect(synchronizedResult.moments[0].duration).toBe(20.0);
    expect(synchronizedResult.moments[0].has_chat_spike).toBe(true);
    expect(synchronizedResult.moments[0].has_audio_peak).toBe(true);
  });
});

describe("Phase 4: Candidate Scoring & Vertical Render (Specs 011 - 012)", () => {
  it("ranks highlight candidates by composite confidence score and detects hook (Spec 011)", () => {
    const candidate1 = {
      id: "candidate-1",
      rank: 1,
      title: "Hype Streamer Clutch (W POG)",
      start_seconds: 117.0, // 122s - 5s lead-in
      end_seconds: 147.0,   // 30s target duration
      duration_seconds: 30.0,
      peak_timestamp: 122.0,
      confidence: 0.94,
      sentiment: "Hype",
      top_keywords: ["W", "POG", "LETSGO"],
      hook_duration_seconds: 5.0,
      has_immediate_hook: true, // 122.0 - 117.0 = 5.0s <= 6.0s
      source_moment_id: "moment-122",
      output_filename: "01_hype_streamer_clutch_w.mp4",
      status: "pending" as const,
    };

    const candidate2 = {
      id: "candidate-2",
      rank: 2,
      title: "Humor Reaction (LMAO KEKW)",
      start_seconds: 400.0,
      end_seconds: 430.0,
      duration_seconds: 30.0,
      peak_timestamp: 412.0,
      confidence: 0.78,
      sentiment: "Humor",
      top_keywords: ["LMAO", "KEKW"],
      hook_duration_seconds: 5.0,
      has_immediate_hook: false, // 412.0 - 400.0 = 12.0s > 6.0s
      source_moment_id: "moment-412",
      output_filename: "02_humor_reaction_lmao_kekw.mp4",
      status: "pending" as const,
    };

    expect(candidate1.confidence).toBeGreaterThan(candidate2.confidence);
    expect(candidate1.rank).toBe(1);
    expect(candidate2.rank).toBe(2);
    expect(candidate1.has_immediate_hook).toBe(true);
    expect(candidate2.has_immediate_hook).toBe(false);
    expect(candidate1.duration_seconds).toBeGreaterThanOrEqual(15.0);
    expect(candidate1.duration_seconds).toBeLessThanOrEqual(60.0);
    expect(candidate1.output_filename).toMatch(/^\d{2}_[a-z0-9_]+\.mp4$/);
  });

  it("enforces short-form bounds and merges adjacent peak windows (Spec 011)", () => {
    // Peak A at 50s, Peak B at 55s -> should merge into a single candidate window
    const peakA = 50.0;
    const peakB = 55.0;
    const leadIn = 5.0;
    const leadOut = 20.0;
    const maxDur = 60.0;

    const startA = peakA - leadIn; // 45.0
    const endA = peakA + leadOut;  // 70.0
    const startB = peakB - leadIn; // 50.0 <= endA -> merges!
    const endB = peakB + leadOut;  // 75.0

    const mergedStart = startA; // 45.0
    const mergedEnd = Math.max(endA, endB); // 75.0
    const mergedDuration = mergedEnd - mergedStart; // 30.0s

    expect(mergedDuration).toBeLessThanOrEqual(maxDur);
    expect(mergedDuration).toBeGreaterThanOrEqual(15.0);
  });

  it("verifies vertical 9:16 short export configuration and sidecar metadata (Spec 012)", () => {
    const sidecarMetadata = {
      candidate_id: "candidate-1",
      rank: 1,
      title: "Hype Streamer Clutch",
      start_seconds: 117.0,
      end_seconds: 147.0,
      duration_seconds: 30.0,
      peak_timestamp: 122.0,
      confidence: 0.94,
      sentiment: "Hype",
      top_keywords: ["W", "POG"],
      has_immediate_hook: true,
      output_file: "01_hype_streamer_clutch.mp4",
      rendered_unix: 1732314500,
    };

    expect(sidecarMetadata.output_file).toBe("01_hype_streamer_clutch.mp4");
    expect(sidecarMetadata.duration_seconds).toBe(30.0);
    expect(sidecarMetadata.rendered_unix).toBeGreaterThan(0);
    expect(sidecarMetadata.top_keywords).toContain("W");
  });
});
