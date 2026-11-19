import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createDefaultProject } from "./defaults.js";
import { loadProjectFile, saveProjectFile, saveClipManifest } from "./manager.js";
import { generateClipManifest } from "../clips/planner.js";
import { ErrorCode } from "@clipforge/shared";

describe("Project Manager", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_project_test_${Date.now()}`);
  const projectFilePath = path.join(tempDir, "project.json");
  const manifestFilePath = path.join(tempDir, "manifest.json");

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  it("saves and loads a project file with schema preservation", async () => {
    const project = createDefaultProject({
      id: "test_proj_1",
      name: "Speedrun Part 1",
      videoPath: "C:/media/speedrun.mp4",
      videoDurationSeconds: 240,
      outputDirectory: "C:/media/exports"
    });

    await saveProjectFile(projectFilePath, project);
    const loaded = await loadProjectFile(projectFilePath);

    expect(loaded.id).toBe("test_proj_1");
    expect(loaded.name).toBe("Speedrun Part 1");
    expect(loaded.clipSettings.mode).toBe("automatic");
    expect(loaded.sources.video.durationSeconds).toBe(240);
  });

  it("saves a valid clip manifest to disk", async () => {
    const project = createDefaultProject({
      id: "test_proj_2",
      name: "Manifest Test",
      videoPath: "C:/media/gameplay.mp4",
      videoDurationSeconds: 120,
      outputDirectory: "C:/media/exports"
    });

    const manifest = generateClipManifest(project);
    await saveClipManifest(manifestFilePath, manifest);

    const content = await fs.readFile(manifestFilePath, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.totalClips).toBe(2);
    expect(parsed.clips.length).toBe(2);
  });

  it("throws PROJECT_NOT_FOUND when file does not exist", async () => {
    const nonExistent = path.join(tempDir, "not_found.json");
    await expect(loadProjectFile(nonExistent)).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCode.PROJECT_NOT_FOUND
      })
    );
  });
});
