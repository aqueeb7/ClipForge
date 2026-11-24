import { describe, it, expect, beforeEach } from "vitest";
import {
  historySignals,
  initHistoryProvider,
  recordHistory,
  undo,
  redo,
  clearHistory,
  type HistoryStateData
} from "./history.js";
import type { ClipForgeProject } from "../types/index.js";

function createMockProject(name: string): ClipForgeProject {
  return {
    id: "proj_test",
    name,
    version: 1,
    workflowMode: "hybrid",
    sources: {
      video: { path: "C:/test.mp4", durationSeconds: 120 }
    },
    synchronization: { audioOffsetMs: 0 },
    clipSettings: {
      mode: "manual",
      clips: [
        { start: 0, end: 60, title: "Part 1" }
      ]
    },
    composition: {
      width: 1080,
      height: 1920,
      background: { mode: "blur" },
      gameplay: { mode: "contain" },
      overlay: { enabled: true, brandTitle: "CLYPTIK", episodeLabel: "PART" }
    },
    export: {
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      frameRate: 60,
      crf: 21,
      preset: "veryfast",
      outputDirectory: "./exports",
      namingPattern: "{project}_{episode}_{title}",
      structure: "flat"
    }
  };
}

describe("History (Undo / Redo) Store", () => {
  let currentState: HistoryStateData;
  let statusMessage = "";

  beforeEach(() => {
    clearHistory();
    currentState = {
      project: createMockProject("Initial Version"),
      masterInSeconds: 0,
      masterOutSeconds: 120,
      isMasterPatched: false,
      timelineStage: "master",
      shortClips: [],
      workflowMode: "hybrid"
    };
    initHistoryProvider(
      () => currentState,
      (data) => {
        currentState = { ...data };
      },
      (msg) => {
        statusMessage = msg;
      }
    );
  });

  it("starts with empty undo and redo stacks", () => {
    expect(historySignals.canUndo()).toBe(false);
    expect(historySignals.canRedo()).toBe(false);
    expect(historySignals.undoLabel()).toBeNull();
  });

  it("records state and enables undo", () => {
    recordHistory("Cut Intro");
    currentState.masterInSeconds = 15;

    expect(historySignals.canUndo()).toBe(true);
    expect(historySignals.canRedo()).toBe(false);
    expect(historySignals.undoLabel()).toBe("Cut Intro");
  });

  it("undoes an edit and enables redo", () => {
    recordHistory("Split Part");
    currentState.project.clipSettings = {
      mode: "manual",
      clips: [
        { start: 0, end: 30, title: "Part 1" },
        { start: 30, end: 60, title: "Part 2" }
      ]
    };

    const didUndo = undo();
    expect(didUndo).toBe(true);
    expect(statusMessage).toContain("Undid: Split Part");
    expect(currentState.project.clipSettings.mode === "manual" && currentState.project.clipSettings.clips.length).toBe(1);
    expect(historySignals.canUndo()).toBe(false);
    expect(historySignals.canRedo()).toBe(true);
    expect(historySignals.redoLabel()).toBe("Current State");
  });

  it("redoes an undone edit", () => {
    recordHistory("Change Workflow");
    currentState.workflowMode = "shorts";

    undo();
    expect(currentState.workflowMode).toBe("hybrid");

    const didRedo = redo();
    expect(didRedo).toBe(true);
    expect(currentState.workflowMode).toBe("shorts");
    expect(historySignals.canUndo()).toBe(true);
    expect(historySignals.canRedo()).toBe(false);
  });

  it("clears redo stack when a new mutation is recorded after undo", () => {
    recordHistory("Action 1");
    currentState.masterInSeconds = 10;

    recordHistory("Action 2");
    currentState.masterInSeconds = 20;

    undo();
    expect(currentState.masterInSeconds).toBe(10);
    expect(historySignals.canRedo()).toBe(true);

    recordHistory("Action 3 (Branch)");
    currentState.masterInSeconds = 15;
    expect(historySignals.canRedo()).toBe(false);
  });
});
