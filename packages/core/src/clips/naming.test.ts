import { describe, it, expect } from "vitest";
import { resolveClipFilename, sanitizeFilename } from "./naming.js";

describe("Clip Naming & Sanitization", () => {
  it("sanitizes illegal Windows characters", () => {
    expect(sanitizeFilename("Video: Episode 1? *Special*")).toBe("Video_Episode_1_Special");
    expect(sanitizeFilename("GTA VI / Chase <High> | 4K")).toBe("GTA_VI_Chase_High_4K");
  });

  it("replaces pattern placeholders accurately", () => {
    const filename = resolveClipFilename({
      pattern: "{project}_{episode}_{title}",
      projectName: "GTA 6 Gameplay",
      episodeIndex: 1,
      clipIndex: 1,
      title: "First Mission"
    });

    expect(filename).toBe("GTA_6_Gameplay_Part_001_First_Mission.mp4");
  });

  it("handles padded index and custom extension", () => {
    const filename = resolveClipFilename({
      pattern: "{project}_clip_{index}",
      projectName: "Tutorial",
      episodeIndex: 4,
      clipIndex: 4,
      extension: "mov"
    });

    expect(filename).toBe("Tutorial_clip_004.mov");
  });
});
