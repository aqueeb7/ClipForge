import { describe, it, expect } from "vitest";
import {
  generateManualClips,
  addManualClip,
  removeManualClip,
  toggleManualClip
} from "./manual.js";
import { createDefaultProject } from "../projects/defaults.js";
import { ErrorCode } from "@clipforge/shared";

describe("Manual Clipping Engine", () => {
  it("processes arbitrary decimal timestamps and custom titles accurately", () => {
    const clips = generateManualClips(
      {
        mode: "manual",
        clips: [
          { title: "First mission", start: 12.5, end: 73.25, enabled: true },
          { title: "Police chase", start: 105.0, end: 164.5, enabled: true },
          { title: "Car escape", start: 230.125, end: 290.875, enabled: false }
        ]
      },
      300,
      "proj_manual",
      "GTA6_Story"
    );

    expect(clips.length).toBe(3);

    // Clip 1
    expect(clips[0]?.index).toBe(1);
    expect(clips[0]?.title).toBe("First mission");
    expect(clips[0]?.sourceStartSeconds).toBe(12.5);
    expect(clips[0]?.sourceEndSeconds).toBe(73.25);
    expect(clips[0]?.enabled).toBe(true);
    expect(clips[0]?.outputName).toContain("First_mission");

    // Clip 2
    expect(clips[1]?.index).toBe(2);
    expect(clips[1]?.title).toBe("Police chase");
    expect(clips[1]?.sourceStartSeconds).toBe(105);
    expect(clips[1]?.sourceEndSeconds).toBe(164.5);
    expect(clips[1]?.enabled).toBe(true);

    // Clip 3 (disabled)
    expect(clips[2]?.index).toBe(3);
    expect(clips[2]?.enabled).toBe(false);
    expect(clips[2]?.sourceStartSeconds).toBe(230.125);
    expect(clips[2]?.sourceEndSeconds).toBe(290.875);
  });

  it("rejects clip with start greater than or equal to end", () => {
    expect(() =>
      generateManualClips(
        {
          mode: "manual",
          clips: [{ title: "Broken clip", start: 50, end: 40, enabled: true }]
        },
        100,
        "proj_1",
        "Test"
      )
    ).toThrowError(
      expect.objectContaining({
        code: ErrorCode.INVALID_CLIP_RANGE
      })
    );
  });

  it("rejects clip exceeding source video duration", () => {
    expect(() =>
      generateManualClips(
        {
          mode: "manual",
          clips: [{ title: "Out of bounds", start: 80, end: 150, enabled: true }]
        },
        100, // source duration is only 100s
        "proj_1",
        "Test"
      )
    ).toThrowError(
      expect.objectContaining({
        code: ErrorCode.INVALID_CLIP_RANGE
      })
    );
  });

  it("allows duplicate timestamp clips with unique IDs and indices", () => {
    const clips = generateManualClips(
      {
        mode: "manual",
        clips: [
          { title: "Highlight", start: 10, end: 20, enabled: true },
          { title: "Highlight Alt", start: 10, end: 20, enabled: true }
        ]
      },
      100,
      "proj_1",
      "Test"
    );

    expect(clips.length).toBe(2);
    expect(clips[0]?.id).not.toBe(clips[1]?.id);
    expect(clips[0]?.index).toBe(1);
    expect(clips[1]?.index).toBe(2);
  });

  it("mutates project by adding, toggling, and removing manual clips", () => {
    const project = createDefaultProject({
      id: "proj_mutation",
      name: "Mutations",
      videoPath: "C:/test.mp4",
      videoDurationSeconds: 180,
      outputDirectory: "C:/exports"
    });

    // 1. Add clip
    const withClip1 = addManualClip(project, { start: 10, end: 30, title: "Clip 1" });
    expect(withClip1.clipSettings.mode).toBe("manual");
    if (withClip1.clipSettings.mode === "manual") {
      expect(withClip1.clipSettings.clips.length).toBe(1);
    }

    // 2. Add second clip
    const withClip2 = addManualClip(withClip1, { start: 40, end: 70, title: "Clip 2" });
    if (withClip2.clipSettings.mode === "manual") {
      expect(withClip2.clipSettings.clips.length).toBe(2);
    }

    // 3. Toggle clip 1 to disabled
    const toggled = toggleManualClip(withClip2, 1, false);
    if (toggled.clipSettings.mode === "manual") {
      expect(toggled.clipSettings.clips[0]?.enabled).toBe(false);
      expect(toggled.clipSettings.clips[1]?.enabled).toBe(true);
    }

    // 4. Remove clip 1
    const removed = removeManualClip(toggled, 1);
    if (removed.clipSettings.mode === "manual") {
      expect(removed.clipSettings.clips.length).toBe(1);
      expect(removed.clipSettings.clips[0]?.title).toBe("Clip 2");
    }
  });
});
