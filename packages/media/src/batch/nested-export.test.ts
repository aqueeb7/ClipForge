import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createDefaultProject, generateClipManifest } from "@clipforge/core";
import { RenderQueueManager } from "./queue.js";

describe("Export Directory Layouts (Flat vs Nested)", () => {
  const tempDir = path.join(os.tmpdir(), `clipforge_nested_test_${Date.now()}`);

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

  it("organizes jobs into nested episode folders when structure='nested'", async () => {
    const project = createDefaultProject({
      id: "proj_nested",
      name: "Nested Test",
      videoPath: "C:/test.mp4",
      videoDurationSeconds: 120,
      outputDirectory: tempDir
    });

    const manifest = generateClipManifest(project);
    const queue = new RenderQueueManager();

    const summary = await queue.runBatch({
      project,
      manifest,
      structure: "nested",
      dryRun: true
    });

    expect(summary.structure).toBe("nested");
    expect(summary.jobs.length).toBe(2);

    const job1 = summary.jobs[0]!;
    const job2 = summary.jobs[1]!;

    expect(job1.outputPath).toContain("Part_001");
    expect(job2.outputPath).toContain("Part_002");
    expect(path.dirname(job1.outputPath!)).toContain("Part_001");
  });

  it("organizes jobs directly in root export folder when structure='flat'", async () => {
    const project = createDefaultProject({
      id: "proj_flat",
      name: "Flat Test",
      videoPath: "C:/test.mp4",
      videoDurationSeconds: 120,
      outputDirectory: tempDir
    });

    const manifest = generateClipManifest(project);
    const queue = new RenderQueueManager();

    const summary = await queue.runBatch({
      project,
      manifest,
      structure: "flat",
      dryRun: true
    });

    expect(summary.structure).toBe("flat");
    expect(path.dirname(summary.jobs[0]!.outputPath!)).toBe(path.resolve(tempDir));
  });
});
