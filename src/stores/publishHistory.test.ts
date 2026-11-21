import { describe, it, expect, beforeEach } from "vitest";
import {
  publishHistorySignals,
  recordPublish,
  getClipPublishHistory,
  hasPublishedTo,
  clearPublishHistory,
} from "./publishHistory.js";

describe("Publish History Store", () => {
  beforeEach(() => {
    clearPublishHistory();
  });

  it("records a publication to YouTube Shorts with URL", () => {
    recordPublish("clip_001", "youtube", "https://youtube.com/shorts/test1234", "Part 1");

    const history = getClipPublishHistory("clip_001");
    expect(history.length).toBe(1);
    expect(history[0].platform).toBe("youtube");
    expect(history[0].url).toBe("https://youtube.com/shorts/test1234");
    expect(history[0].clipTitle).toBe("Part 1");
    expect(hasPublishedTo("clip_001", "youtube")).toBe(true);
    expect(hasPublishedTo("clip_001", "instagram")).toBe(false);
  });

  it("records multiple platforms for the same clip", () => {
    recordPublish("clip_002", "youtube", "https://youtube.com/shorts/test999");
    recordPublish("clip_002", "instagram");
    recordPublish("clip_002", "tiktok");

    const history = getClipPublishHistory("clip_002");
    expect(history.length).toBe(3);
    expect(hasPublishedTo("clip_002", "youtube")).toBe(true);
    expect(hasPublishedTo("clip_002", "instagram")).toBe(true);
    expect(hasPublishedTo("clip_002", "tiktok")).toBe(true);
    expect(hasPublishedTo("clip_002", "youtube_studio")).toBe(false);
  });

  it("clears history for a specific clip", () => {
    recordPublish("clip_003", "instagram");
    recordPublish("clip_004", "tiktok");

    clearPublishHistory("clip_003");
    expect(getClipPublishHistory("clip_003").length).toBe(0);
    expect(getClipPublishHistory("clip_004").length).toBe(1);
  });
});
