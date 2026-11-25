import { describe, it, expect, beforeEach } from "vitest";
import {
  snapToFrame,
  timeToFrames,
  formatSmpteTimecode,
  stepFrame,
  currentTime,
  setCurrentTime,
  setTimelineFps,
  timelineFps
} from "./timeline.js";

describe("DaVinci Resolve SMPTE Timecode and Fixed Frame Rate Engine", () => {
  beforeEach(() => {
    setCurrentTime(0);
    setTimelineFps(60);
  });

  it("snaps continuous float seconds to exact frame boundaries at 60 fps", () => {
    // 1 frame at 60fps is ~0.016666...s
    expect(snapToFrame(0.012, 60)).toBeCloseTo(1 / 60, 5);
    expect(snapToFrame(0.025, 60)).toBeCloseTo(2 / 60, 5);
    expect(snapToFrame(1.004, 60)).toBeCloseTo(1.0, 5);
  });

  it("snaps continuous float seconds to exact frame boundaries at 30 fps", () => {
    // 1 frame at 30fps is ~0.033333...s
    expect(snapToFrame(0.02, 30)).toBeCloseTo(1 / 30, 5);
    expect(snapToFrame(0.07, 30)).toBeCloseTo(2 / 30, 5);
  });

  it("converts seconds to absolute frame count accurately", () => {
    expect(timeToFrames(0, 60)).toBe(0);
    expect(timeToFrames(1.0, 60)).toBe(60);
    expect(timeToFrames(60.0, 60)).toBe(3600);
    expect(timeToFrames(3600.0, 60)).toBe(216000);
  });

  it("formats time into SMPTE standard HH:MM:SS:FF timecode", () => {
    // 0s -> 00:00:00:00
    expect(formatSmpteTimecode(0, 60)).toBe("00:00:00:00");

    // 1.5s at 60 fps -> 1 second + 30 frames -> 00:00:01:30
    expect(formatSmpteTimecode(1.5, 60)).toBe("00:00:01:30");

    // 65.25s at 60 fps -> 1 minute, 5 seconds, 15 frames -> 00:01:05:15
    expect(formatSmpteTimecode(65.25, 60)).toBe("00:01:05:15");

    // 3661.1s at 30 fps -> 1 hour, 1 minute, 1 second, 3 frames -> 01:01:01:03
    expect(formatSmpteTimecode(3661.1, 30)).toBe("01:01:01:03");
  });

  it("steps forward and backward by single frames", () => {
    setTimelineFps(60);
    setCurrentTime(0);

    stepFrame(1);
    expect(currentTime()).toBeCloseTo(1 / 60, 5);

    stepFrame(4);
    expect(currentTime()).toBeCloseTo(5 / 60, 5);

    stepFrame(-2);
    expect(currentTime()).toBeCloseTo(3 / 60, 5);

    stepFrame(-10); // clamped to 0
    expect(currentTime()).toBe(0);
  });
});
