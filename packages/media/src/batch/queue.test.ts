import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createDefaultProject, generateClipManifest } from "@clipforge/core";
import { RenderQueueManager } from "./queue.js";

describe("Render Queue Manager", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_queue_unit_${Date.now()}`);

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

  it("simulates dry-run batch processing without errors", async () => {
    const project = createDefaultProject({
      id: "proj_dry",
      name: "Dry Run Test",
      videoPath: "C:/fake/gameplay.mp4",
      videoDurationSeconds: 180,
      outputDirectory: tempDir
    });

    const manifest = generateClipManifest(project);
    const queue = new RenderQueueManager();

    const summary = await queue.runBatch({
      project,
      manifest,
      dryRun: true
    });

    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.jobs.every((j) => j.status === "completed")).toBe(true);
  });

  it("filters jobs with onlyIndices option", async () => {
    const project = createDefaultProject({
      id: "proj_only",
      name: "Only Filter Test",
      videoPath: "C:/fake/gameplay.mp4",
      videoDurationSeconds: 180,
      outputDirectory: tempDir
    });

    const manifest = generateClipManifest(project);
    const queue = new RenderQueueManager();

    const summary = await queue.runBatch({
      project,
      manifest,
      onlyIndices: [2],
      dryRun: true
    });

    expect(summary.total).toBe(1);
    expect(summary.jobs[0]?.id).toContain("_2");
  });
});
