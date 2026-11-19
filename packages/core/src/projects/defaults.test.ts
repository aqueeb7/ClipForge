import { describe, it, expect } from "vitest";
import { createDefaultProject } from "./defaults.js";
import { validateProject } from "./validator.js";
import { canTransitionJob } from "../jobs/state-machine.js";

describe("Core Business Logic", () => {
  it("creates a valid default project and validates successfully", () => {
    const project = createDefaultProject({
      id: "proj_gta6",
      name: "GTA VI Gameplay",
      videoPath: "C:/media/gameplay.mp4",
      videoDurationSeconds: 300,
      width: 1920,
      height: 1080,
      outputDirectory: "C:/media/exports"
    });

    expect(project.id).toBe("proj_gta6");
    if (project.clipSettings.mode === "automatic") {
      expect(project.clipSettings.durationSeconds).toBe(60);
    } else {
      expect.fail("Expected automatic mode");
    }
    expect(project.composition.background.mode).toBe("blur");

    const validated = validateProject(project);
    expect(validated.name).toBe("GTA VI Gameplay");
  });

  it("validates job state transitions correctly", () => {
    expect(canTransitionJob("pending", "queued")).toBe(true);
    expect(canTransitionJob("queued", "running")).toBe(true);
    expect(canTransitionJob("running", "completed")).toBe(true);
    expect(canTransitionJob("completed", "running")).toBe(false);
    expect(canTransitionJob("failed", "queued")).toBe(true);
  });
});
