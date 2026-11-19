import { describe, it, expect } from "vitest";
import { calculateAudioSyncPlan } from "./calculator.js";
import { buildAudioSyncFilter } from "./filter-builder.js";

describe("Audio Synchronization Calculator", () => {
  it("calculates exact parameters for matching start time (offset 0)", () => {
    const plan = calculateAudioSyncPlan({
      clipStartSeconds: 0,
      clipEndSeconds: 60,
      audioOffsetMs: 0,
      audioDurationSeconds: 120
    });

    expect(plan.clipDurationSeconds).toBe(60);
    expect(plan.sourceSeekSeconds).toBe(0);
    expect(plan.sourceDurationSeconds).toBe(60);
    expect(plan.leadPaddingMs).toBe(0);
    expect(plan.trailPaddingMs).toBe(0);
    expect(plan.isEntirelySilent).toBe(false);
  });

  it("calculates lead silence when audio starts later than video (positive offset)", () => {
    // Audio starts 1.5s after video starts (+1500 ms)
    const plan = calculateAudioSyncPlan({
      clipStartSeconds: 0,
      clipEndSeconds: 10,
      audioOffsetMs: 1500,
      audioDurationSeconds: 60
    });

    expect(plan.clipDurationSeconds).toBe(10);
    expect(plan.leadPaddingMs).toBe(1500); // 1.5s silence at beginning
    expect(plan.sourceSeekSeconds).toBe(0);
    expect(plan.sourceDurationSeconds).toBe(8.5); // reads 8.5s from audio
    expect(plan.trailPaddingMs).toBe(0);
    // Total duration should equal clip duration
    expect(plan.leadPaddingMs / 1000 + plan.sourceDurationSeconds + plan.trailPaddingMs / 1000).toBeCloseTo(10);
  });

  it("calculates source seek when audio starts earlier than video (negative offset)", () => {
    // Audio starts 2.0s before video starts (-2000 ms)
    const plan = calculateAudioSyncPlan({
      clipStartSeconds: 0,
      clipEndSeconds: 10,
      audioOffsetMs: -2000,
      audioDurationSeconds: 60
    });

    expect(plan.clipDurationSeconds).toBe(10);
    expect(plan.leadPaddingMs).toBe(0);
    expect(plan.sourceSeekSeconds).toBe(2.0); // starts reading 2s into the audio file
    expect(plan.sourceDurationSeconds).toBe(10.0);
    expect(plan.trailPaddingMs).toBe(0);
  });

  it("pads trailing silence when audio is shorter than the clip", () => {
    // Audio is only 4s long, clip is 10s long, offset 0
    const plan = calculateAudioSyncPlan({
      clipStartSeconds: 0,
      clipEndSeconds: 10,
      audioOffsetMs: 0,
      audioDurationSeconds: 4
    });

    expect(plan.clipDurationSeconds).toBe(10);
    expect(plan.leadPaddingMs).toBe(0);
    expect(plan.sourceSeekSeconds).toBe(0);
    expect(plan.sourceDurationSeconds).toBe(4);
    expect(plan.trailPaddingMs).toBe(6000); // 6s trailing silence
    expect(plan.leadPaddingMs / 1000 + plan.sourceDurationSeconds + plan.trailPaddingMs / 1000).toBeCloseTo(10);
  });

  it("handles subsequent clips in a long recording accurately", () => {
    // Second clip in timeline [60s, 120s], audio started 1.5s late (+1500ms)
    const plan = calculateAudioSyncPlan({
      clipStartSeconds: 60,
      clipEndSeconds: 120,
      audioOffsetMs: 1500,
      audioDurationSeconds: 180
    });

    expect(plan.clipDurationSeconds).toBe(60);
    expect(plan.leadPaddingMs).toBe(0); // Audio already playing
    expect(plan.sourceSeekSeconds).toBe(58.5); // 60 - 1.5
    expect(plan.sourceDurationSeconds).toBe(60);
    expect(plan.trailPaddingMs).toBe(0);
  });

  it("marks as entirely silent if clip is completely outside audio file boundaries", () => {
    const plan = calculateAudioSyncPlan({
      clipStartSeconds: 100,
      clipEndSeconds: 120,
      audioOffsetMs: 0,
      audioDurationSeconds: 50 // audio ended at 50s
    });

    expect(plan.isEntirelySilent).toBe(true);
    expect(plan.sourceDurationSeconds).toBe(0);
    expect(plan.trailPaddingMs).toBe(20000);
  });

  it("builds valid FFmpeg audio filter graphs with lead delay and apad", () => {
    const plan = calculateAudioSyncPlan({
      clipStartSeconds: 0,
      clipEndSeconds: 10,
      audioOffsetMs: 1500,
      audioDurationSeconds: 60
    });

    const filter = buildAudioSyncFilter({ plan });
    expect(filter.filterGraph).toContain("adelay=1500|1500:all=1");
    expect(filter.filterGraph).toContain("aresample=48000:async=1:first_pts=0");
    expect(filter.filterGraph).toContain("atrim=0:10");
    expect(filter.encodingArgs).toEqual(["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]);
    expect(filter.inputArgs).toEqual(["-t", "8.5"]);
  });
});
