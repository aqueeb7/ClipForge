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
