import { describe, it, expect } from "vitest";
import { resolveClipFraming } from "./queue.js";
import type { ClipForgeProject } from "../types/index.js";

describe("resolveClipFraming", () => {
  const baseProject: ClipForgeProject = {
    id: "test_proj",
    name: "Test Project",
    version: 1,
    sources: {
      video: {
        path: "/videos/stream.mp4",
        durationSeconds: 3600,
        width: 1920,
        height: 1080
      }
    },
    synchronization: {
      audioOffsetMs: 0
    },
    clipSettings: {
      mode: "automatic",
      startSeconds: 0,
      durationSeconds: 60,
      overlapSeconds: 0,
      minimumFinalClipSeconds: 10,
      startingEpisode: 1
    },
    composition: {
      width: 1080,
      height: 1920,
      background: { mode: "blur" },
      gameplay: { mode: "contain" },
      overlay: { enabled: true },
      stacking: {
        template: "stacked_split",
        topHeightPercent: 35,
        topRegion: { x: 2, y: 5, width: 28, height: 35 },
        bottomRegion: { x: 0, y: 15, width: 100, height: 85 },
        cropRegion: { x: 21.875, y: 0, width: 56.25, height: 100 }
      }
    },
    shorts: [
      {
        id: "short_1",
        title: "Pan Scan Short",
        start: 100,
        end: 130,
        duration: 30,
        framingTemplate: "pan_scan",
        stacking: {
          template: "pan_scan",
          cropRegion: { x: 30, y: 0, width: 56.25, height: 100 }
        }
      },
      {
        id: "short_2",
        title: "50-50 Split Short",
        start: 200,
        end: 230,
        duration: 30,
        framingTemplate: "split_50_50",
        stacking: {
          template: "split_50_50",
          topHeightPercent: 50,
          topRegion: { x: 5, y: 5, width: 90, height: 45 },
          bottomRegion: { x: 0, y: 50, width: 100, height: 50 }
        }
      }
    ],
    export: {
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      frameRate: 60,
      crf: 18,
      preset: "fast",
      outputDirectory: "./Exports",
      namingPattern: "{title}.mp4",
      structure: "flat"
    }
  };

  it("resolves stacked_split template and coordinates for regular part clips", () => {
    const item = { id: "clip_1", title: "Part 001" };
    const framing = resolveClipFraming(item, baseProject);

    expect(framing.isShort).toBe(false);
    expect(framing.mode).toBe("stacked_split");
    expect(framing.top_height_pct).toBe(35);
    expect(framing.top_crop_x).toBe(2);
    expect(framing.top_crop_y).toBe(5);
    expect(framing.top_crop_w).toBe(28);
    expect(framing.top_crop_h).toBe(35);
    expect(framing.bot_crop_x).toBe(0);
    expect(framing.bot_crop_y).toBe(15);
    expect(framing.bot_crop_w).toBe(100);
    expect(framing.bot_crop_h).toBe(85);
  });

  it("resolves pan_scan template and coordinates for short_1", () => {
    const item = { id: "short_1", title: "Pan Scan Short" };
    const framing = resolveClipFraming(item, baseProject);

    expect(framing.isShort).toBe(true);
    expect(framing.mode).toBe("pan_scan");
    expect(framing.pan_crop_x).toBe(30);
  });

  it("resolves split_50_50 template and coordinates for short_2", () => {
    const item = { id: "short_2", title: "50-50 Split Short" };
    const framing = resolveClipFraming(item, baseProject);

    expect(framing.isShort).toBe(true);
    expect(framing.mode).toBe("split_50_50");
    expect(framing.top_height_pct).toBe(50);
    expect(framing.top_crop_x).toBe(5);
    expect(framing.bot_crop_y).toBe(50);
  });

  it("falls back to blur_fill if composition template is blur_fill", () => {
    const proj: ClipForgeProject = {
      ...baseProject,
      composition: {
        ...baseProject.composition,
        stacking: {
          template: "blur_fill"
        }
      }
    };
    const item = { id: "clip_2", title: "Part 002" };
    const framing = resolveClipFraming(item, proj);

    expect(framing.mode).toBe("blur_fill");
  });

  it("respects per-clip framing template overrides on Part clips", () => {
    const item = {
      id: "clip_3",
      title: "Part 003",
      framingTemplate: "split_50_50" as const,
      stacking: {
        template: "split_50_50" as const,
        topHeightPercent: 50
      }
    };
    const framing = resolveClipFraming(item, baseProject);

    expect(framing.mode).toBe("split_50_50");
    expect(framing.top_height_pct).toBe(50);
  });
});
