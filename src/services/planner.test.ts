import { describe, it, expect } from "vitest";
import {
  generateAutomaticClips,
  generateManualClips,
  resolveClipFilename,
  generateClipManifest,
  createDefaultProject
} from "./planner.js";

describe("planner service", () => {
  it("resolves clip filenames correctly", () => {
    const filename = resolveClipFilename({
      pattern: "{project}_{episode}_{title}",
      projectName: "Elden Ring Stream",
      episodeIndex: 3,
      clipIndex: 3,
      title: "Boss Fight"
    });

    expect(filename).toBe("Elden_Ring_Stream_Part_003_Boss_Fight.mp4");
  });

  it("generates automatic clips evenly", () => {
    const clips = generateAutomaticClips(
      {
        mode: "automatic",
        startSeconds: 0,
        endSeconds: 150,
        durationSeconds: 60,
        overlapSeconds: 0,
        minimumFinalClipSeconds: 10,
        startingEpisode: 1
      },
      150,
      "proj_1",
      "Test Project"
    );

    // 0-60, 60-120, 120-150 (30s remainder >= 10s min)
    expect(clips).toHaveLength(3);
    expect(clips[0].sourceStartSeconds).toBe(0);
    expect(clips[0].sourceEndSeconds).toBe(60);
    expect(clips[1].sourceStartSeconds).toBe(60);
    expect(clips[1].sourceEndSeconds).toBe(120);
    expect(clips[2].sourceStartSeconds).toBe(120);
    expect(clips[2].sourceEndSeconds).toBe(150);
  });

  it("generates manual clips correctly", () => {
    const clips = generateManualClips(
      {
        mode: "manual",
        clips: [
          { start: 10, end: 40, title: "Highlight 1" },
          { start: 50, end: 90, title: "Highlight 2" }
        ]
      },
      120,
      "proj_2",
      "Manual Proj"
    );

    expect(clips).toHaveLength(2);
    expect(clips[0].title).toBe("Highlight 1");
    expect(clips[0].sourceStartSeconds).toBe(10);
    expect(clips[0].sourceEndSeconds).toBe(40);
  });

  it("creates a complete default project and manifest", () => {
    const project = createDefaultProject({
      id: "test_proj",
      name: "Default Project",
      videoPath: "C:/videos/source.mp4",
      videoDurationSeconds: 120,
      outputDirectory: "./Exports"
    });

    expect(project.id).toBe("test_proj");
    expect(project.composition.background.mode).toBe("blur");
    expect(project.clipSettings.mode).toBe("automatic");

    const manifest = generateClipManifest(project);
    expect(manifest.projectId).toBe("test_proj");
    expect(manifest.totalClips).toBe(2);
  });
});
