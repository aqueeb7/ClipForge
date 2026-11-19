import { describe, it, expect } from "vitest";
import { buildTextOverlayFilters } from "./overlay.js";

describe("Text Overlay Filter Builder", () => {
  it("generates drawtext filters for brand, title, and episode number", () => {
    const filters = buildTextOverlayFilters({
      enabled: true,
      brandTitle: "CLIPFORGE",
      mainTitle: "GTA VI GAMEPLAY",
      episodeLabel: "PART",
      episodeIndex: 1,
      showEpisodeNumber: true
    });

    expect(filters.length).toBe(3);
    expect(filters[0]).toContain("text='CLIPFORGE'");
    expect(filters[1]).toContain("text='GTA VI GAMEPLAY'");
    expect(filters[2]).toContain("text='PART 001'");
    expect(filters[0]).toContain("box=1");
  });

  it("returns empty array when overlays are disabled", () => {
    const filters = buildTextOverlayFilters({
      enabled: false,
      brandTitle: "CLIPFORGE"
    });

    expect(filters.length).toBe(0);
  });
});
