import { describe, it, expect } from "vitest";
import { formatCaption, buildGoogleAuthUrl, PublishMetadata } from "./publisher.js";
import { sanitizeCleanPath } from "../stores/queue.js";

describe("Publisher Service", () => {
  it("formats captions with cleaned tags and linebreaks", () => {
    const meta: PublishMetadata = {
      title: "Epic Victory Royale",
      description: "Insane clutch with 1 HP remaining!",
      tags: ["#Shorts", "gaming", "#Fortnite", "gaming"],
      privacy: "public",
    };

    const formatted = formatCaption(meta);
    expect(formatted).toContain("Epic Victory Royale");
    expect(formatted).toContain("Insane clutch with 1 HP remaining!");
    expect(formatted).toContain("#Shorts #gaming #Fortnite");
    // Ensure duplicates are removed
    const occurrences = (formatted.match(/#gaming/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("handles empty title or description cleanly", () => {
    const meta: PublishMetadata = {
      title: "Only Title",
      description: "",
      tags: ["Shorts"],
      privacy: "unlisted",
    };

    const formatted = formatCaption(meta);
    expect(formatted).toBe("Only Title\n\n#Shorts");
  });

  it("builds compliant Google OAuth URL with %20 scope separators", () => {
    const authUrl = buildGoogleAuthUrl("test-client-id-123.apps.googleusercontent.com", 8085);
    expect(authUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth?");
    expect(authUrl).toContain("response_type=code");
    expect(authUrl).toContain("client_id=test-client-id-123.apps.googleusercontent.com");
    expect(authUrl).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A8085");
    // Crucial: scopes must use %20 and NOT +
    expect(authUrl).toContain("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.readonly");
    expect(authUrl).not.toContain("+");
  });

  it("sanitizes legacy /apps/Exports paths and normalizes slashes", () => {
    const legacyPath = "C:\\Users\\DELL\\OneDrive\\Desktop\\ClipForge\\apps\\Exports/GTA-6-LIVE-SnapYT.App_Part_003_Part_003.mp4";
    const cleaned = sanitizeCleanPath(legacyPath);
    expect(cleaned).toBe("C:/Users/DELL/OneDrive/Desktop/ClipForge/Exports/GTA-6-LIVE-SnapYT.App_Part_003_Part_003.mp4");
    expect(cleaned).not.toContain("apps");
  });
});
