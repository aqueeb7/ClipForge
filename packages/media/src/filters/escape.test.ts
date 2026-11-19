import { describe, it, expect } from "vitest";
import { escapeFilterText, escapeFilterPath } from "./escape.js";

describe("Filter Escaping Helpers", () => {
  it("escapes colons, quotes, backslashes, and percentages for drawtext", () => {
    const raw = "Clip: '100%' & [Special]";
    const escaped = escapeFilterText(raw);
    expect(escaped).toContain("\\:");
    expect(escaped).toContain("\\'");
    expect(escaped).toContain("\\%");
    expect(escaped).toContain("\\[");
  });

  it("escapes Windows file paths into valid FFmpeg filter paths", () => {
    const winPath = "C:\\Windows\\Fonts\\arial.ttf";
    const escaped = escapeFilterPath(winPath);
    expect(escaped).toBe("C\\:/Windows/Fonts/arial.ttf");
  });
});
