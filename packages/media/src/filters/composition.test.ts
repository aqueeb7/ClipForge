import { describe, it, expect } from "vitest";
import { buildCompositionFilter } from "./composition.js";
import { CompositionSettingsSchema } from "@clipforge/shared";

describe("Vertical Composition Filter Builder", () => {
  it("generates blurred background filter graph with 1080x1920 canvas", () => {
    const composition = CompositionSettingsSchema.parse({
      background: { mode: "blur", blurRadius: 30, color: "#000000" },
      gameplay: { mode: "contain", scale: 1, offsetX: 0, offsetY: 0 },
      overlay: { enabled: true, brandTitle: "CLIPFORGE", episodeLabel: "PART", showEpisodeNumber: true }
    });

    const result = buildCompositionFilter({
      composition,
      mainTitle: "MISSION 1",
      episodeIndex: 1
    });

    expect(result.filterGraph).toContain("split=2[bg_in][fg_in]");
    expect(result.filterGraph).toContain("gblur=sigma=30:steps=2");
    expect(result.filterGraph).toContain("scale=1080:1920:force_original_aspect_ratio=decrease");
    expect(result.filterGraph).toContain("overlay=(W-w)/2:(H-h)/2");
    expect(result.filterGraph).toContain("format=yuv420p[vout]");
    expect(result.filterGraph).toContain("text='CLIPFORGE'");
    expect(result.filterGraph).toContain("text='MISSION 1'");
  });

  it("generates solid background filter graph with pad filter", () => {
    const composition = CompositionSettingsSchema.parse({
      background: { mode: "solid", blurRadius: 0, color: "#111111" },
      gameplay: { mode: "contain", scale: 1, offsetX: 0, offsetY: 0 },
      overlay: { enabled: false }
    });

    const result = buildCompositionFilter({ composition });

    expect(result.filterGraph).toContain("scale=1080:1920:force_original_aspect_ratio=decrease");
    expect(result.filterGraph).toContain("pad=1080:1920:(1080-iw)/2:(1920-ih)/2:color=#111111");
    expect(result.filterGraph).toContain("format=yuv420p[vout]");
  });

  it("generates crop mode filter graph", () => {
    const composition = CompositionSettingsSchema.parse({
      gameplay: { mode: "crop", scale: 1, offsetX: 0, offsetY: 0 },
      overlay: { enabled: false }
    });

    const result = buildCompositionFilter({ composition });

    expect(result.filterGraph).toContain("scale=1080:1920:force_original_aspect_ratio=increase");
    expect(result.filterGraph).toContain("crop=1080:1920:(in_w-1080)/2:(in_h-1920)/2");
    expect(result.filterGraph).toContain("format=yuv420p[vout]");
  });

  it("generates stacked split filter graph for dual zone vertical short", () => {
    const composition = CompositionSettingsSchema.parse({
      overlay: { enabled: false },
      stacking: {
        template: "stacked_split",
        topHeightPercent: 35,
        topRegion: { x: 5, y: 5, width: 30, height: 35 },
        bottomRegion: { x: 0, y: 20, width: 100, height: 80 }
      }
    });

    const result = buildCompositionFilter({ composition });

    expect(result.filterGraph).toContain("split=2[in_top][in_bot]");
    expect(result.filterGraph).toContain("[in_top]crop=");
    expect(result.filterGraph).toContain("[in_bot]crop=");
    expect(result.filterGraph).toContain("[top][bot]vstack=inputs=2");
    expect(result.filterGraph).toContain("format=yuv420p[vout]");
  });

  it("generates 50/50 split filter graph with equal vertical halves", () => {
    const composition = CompositionSettingsSchema.parse({
      overlay: { enabled: false },
      stacking: {
        template: "split_50_50",
        topHeightPercent: 50,
        topRegion: { x: 0, y: 0, width: 100, height: 50 },
        bottomRegion: { x: 0, y: 50, width: 100, height: 50 }
      }
    });

    const result = buildCompositionFilter({ composition });

    expect(result.filterGraph).toContain("split=2[in_top][in_bot]");
    expect(result.filterGraph).toContain("scale=1080:960");
    expect(result.filterGraph).toContain("[top][bot]vstack=inputs=2");
  });

  it("generates pan and scan filter graph with 9:16 crop window", () => {
    const composition = CompositionSettingsSchema.parse({
      overlay: { enabled: false },
      stacking: {
        template: "pan_scan",
        cropRegion: { x: 25, y: 0, width: 56.25, height: 100 }
      }
    });

    const result = buildCompositionFilter({ composition });

    expect(result.filterGraph).toContain("crop=in_h*9/16:in_h:in_w*0.2500:0");
    expect(result.filterGraph).toContain("scale=1080:1920");
    expect(result.filterGraph).toContain("format=yuv420p[vout]");
  });
});
