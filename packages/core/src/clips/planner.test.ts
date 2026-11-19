import { describe, it, expect } from "vitest";
import { generateAutomaticClips, generateClipManifest } from "./planner.js";
import { createDefaultProject } from "../projects/defaults.js";
import { ErrorCode } from "@clipforge/shared";

describe("Automatic Clip Planning Engine", () => {
  it("produces exactly 3 60-second clips from 180s source without gaps", () => {
    const clips = generateAutomaticClips(
      {
        mode: "automatic",
        startSeconds: 0,
        endSeconds: 180,
        durationSeconds: 60,
        overlapSeconds: 0,
        minimumFinalClipSeconds: 5,
        startingEpisode: 1
      },
      180,
      "proj_1",
      "GTA6"
    );

    expect(clips.length).toBe(3);

    expect(clips[0]?.sourceStartSeconds).toBe(0);
    expect(clips[0]?.sourceEndSeconds).toBe(60);
    expect(clips[0]?.outputName).toContain("Part_001");

    expect(clips[1]?.sourceStartSeconds).toBe(60);
    expect(clips[1]?.sourceEndSeconds).toBe(120);
    expect(clips[1]?.outputName).toContain("Part_002");

    expect(clips[2]?.sourceStartSeconds).toBe(120);
    expect(clips[2]?.sourceEndSeconds).toBe(180);
    expect(clips[2]?.outputName).toContain("Part_003");
  });

  it("includes partial final clip when it meets the minimum duration threshold", () => {
    // 190s total: 3 full 60s clips + 10s remainder (threshold is 5s)
    const clips = generateAutomaticClips(
      {
        mode: "automatic",
        startSeconds: 0,
        durationSeconds: 60,
        overlapSeconds: 0,
        minimumFinalClipSeconds: 5,
        startingEpisode: 1
      },
      190,
      "proj_1",
      "GTA6"
    );

    expect(clips.length).toBe(4);
    expect(clips[3]?.sourceStartSeconds).toBe(180);
    expect(clips[3]?.sourceEndSeconds).toBe(190);
  });

  it("discards partial final clip when below the minimum duration threshold", () => {
    // 182s total: 3 full 60s clips + 2s remainder (< 5s threshold)
    const clips = generateAutomaticClips(
      {
        mode: "automatic",
        startSeconds: 0,
        durationSeconds: 60,
        overlapSeconds: 0,
        minimumFinalClipSeconds: 5,
        startingEpisode: 1
      },
      182,
      "proj_1",
      "GTA6"
    );

    expect(clips.length).toBe(3);
    expect(clips[2]?.sourceEndSeconds).toBe(180);
  });

  it("generates overlapping clips correctly", () => {
    // 120s total: 60s duration, 10s overlap -> step is 50s
    // Clip 1: [0, 60]
    // Clip 2: [50, 110]
    // Remaining from 100 to 120 = 20s >= 5s -> Clip 3: [100, 120]
    const clips = generateAutomaticClips(
      {
        mode: "automatic",
        startSeconds: 0,
        durationSeconds: 60,
        overlapSeconds: 10,
        minimumFinalClipSeconds: 5,
        startingEpisode: 1
      },
      120,
      "proj_1",
      "GTA6"
    );

    expect(clips.length).toBe(3);
    expect(clips[0]?.sourceStartSeconds).toBe(0);
    expect(clips[0]?.sourceEndSeconds).toBe(60);
    expect(clips[1]?.sourceStartSeconds).toBe(50);
    expect(clips[1]?.sourceEndSeconds).toBe(110);
    expect(clips[2]?.sourceStartSeconds).toBe(100);
    expect(clips[2]?.sourceEndSeconds).toBe(120);
  });

  it("throws INVALID_CLIP_RANGE on invalid boundaries", () => {
    expect(() =>
      generateAutomaticClips(
        {
          mode: "automatic",
          startSeconds: 100,
          endSeconds: 50,
          durationSeconds: 60,
          overlapSeconds: 0,
          minimumFinalClipSeconds: 5,
          startingEpisode: 1
        },
        120,
        "proj_1",
        "GTA6"
      )
    ).toThrowError(
      expect.objectContaining({
        code: ErrorCode.INVALID_CLIP_RANGE
      })
    );
  });

  it("generates a complete reproducible manifest from a project", () => {
    const project = createDefaultProject({
      id: "proj_manifest",
      name: "My Stream",
      videoPath: "C:/videos/stream.mp4",
      videoDurationSeconds: 180,
      outputDirectory: "C:/exports"
    });

    const manifest = generateClipManifest(project);
    expect(manifest.projectId).toBe("proj_manifest");
    expect(manifest.projectName).toBe("My Stream");
    expect(manifest.totalClips).toBe(3);
    expect(manifest.clips.length).toBe(3);
  });
});
