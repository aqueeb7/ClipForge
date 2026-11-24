import { createSignal, createMemo } from "solid-js";
import type { ClipForgeProject, ShortClipItem, WorkflowMode } from "../types/index.js";

export interface HistoryStateData {
  project: ClipForgeProject;
  masterInSeconds: number;
  masterOutSeconds: number;
  isMasterPatched: boolean;
  timelineStage: "master" | "parts";
  shortClips: ShortClipItem[];
  workflowMode: WorkflowMode;
}

export interface HistorySnapshot extends HistoryStateData {
  description: string;
  timestamp: number;
}

const MAX_HISTORY_STEPS = 50;

const [undoStack, setUndoStack] = createSignal<HistorySnapshot[]>([]);
const [redoStack, setRedoStack] = createSignal<HistorySnapshot[]>([]);
const [isRestoring, setIsRestoring] = createSignal(false);

let stateGetter: (() => HistoryStateData | null) | null = null;
let stateSetter: ((data: HistoryStateData) => void) | null = null;
let statusNotifier: ((msg: string) => void) | null = null;

export function initHistoryProvider(
  getter: () => HistoryStateData | null,
  setter: (data: HistoryStateData) => void,
  setStatus?: (msg: string) => void
) {
  stateGetter = getter;
  stateSetter = setter;
  statusNotifier = setStatus || null;
}

const canUndo = () => undoStack().length > 0;
const canRedo = () => redoStack().length > 0;

const undoLabel = () => {
  const stack = undoStack();
  if (stack.length === 0) return null;
  return stack[stack.length - 1].description;
};

const redoLabel = () => {
  const stack = redoStack();
  if (stack.length === 0) return null;
  return stack[stack.length - 1].description;
};

function captureCurrent(description: string): HistorySnapshot | null {
  if (!stateGetter) return null;
  const current = stateGetter();
  if (!current || !current.project) return null;

  return {
    description,
    timestamp: Date.now(),
    project: JSON.parse(JSON.stringify(current.project)),
    masterInSeconds: current.masterInSeconds,
    masterOutSeconds: current.masterOutSeconds,
    isMasterPatched: current.isMasterPatched,
    timelineStage: current.timelineStage,
    shortClips: JSON.parse(JSON.stringify(current.shortClips)),
    workflowMode: current.workflowMode
  };
}

/**
 * Records the current project state into the undo stack before a mutation occurs.
 */
export function recordHistory(description: string): void {
  if (isRestoring()) return;
  const snap = captureCurrent(description);
  if (!snap) return;

  setUndoStack((prev) => {
    const updated = [...prev, snap];
    if (updated.length > MAX_HISTORY_STEPS) {
      return updated.slice(updated.length - MAX_HISTORY_STEPS);
    }
    return updated;
  });
  // Any new action invalidates the redo branch
  setRedoStack([]);
}

/**
 * Reverts to the previous recorded history state.
 */
export function undo(): boolean {
  if (!stateSetter) return false;
  const uStack = undoStack();
  if (uStack.length === 0) return false;

  const currentSnap = captureCurrent("Current State");
  if (!currentSnap) return false;

  const targetSnap = uStack[uStack.length - 1];
  setUndoStack((prev) => prev.slice(0, prev.length - 1));
  setRedoStack((prev) => [...prev, currentSnap]);

  setIsRestoring(true);
  try {
    stateSetter({
      project: targetSnap.project,
      masterInSeconds: targetSnap.masterInSeconds,
      masterOutSeconds: targetSnap.masterOutSeconds,
      isMasterPatched: targetSnap.isMasterPatched,
      timelineStage: targetSnap.timelineStage,
      shortClips: targetSnap.shortClips,
      workflowMode: targetSnap.workflowMode
    });
    if (statusNotifier) {
      statusNotifier(`Undid: ${targetSnap.description}`);
    }
  } finally {
    setIsRestoring(false);
  }
  return true;
}

/**
 * Redoes the previously undone state.
 */
export function redo(): boolean {
  if (!stateSetter) return false;
  const rStack = redoStack();
  if (rStack.length === 0) return false;

  const currentSnap = captureCurrent("Current State");
  if (!currentSnap) return false;

  const targetSnap = rStack[rStack.length - 1];
  setRedoStack((prev) => prev.slice(0, prev.length - 1));
  setUndoStack((prev) => [...prev, currentSnap]);

  setIsRestoring(true);
  try {
    stateSetter({
      project: targetSnap.project,
      masterInSeconds: targetSnap.masterInSeconds,
      masterOutSeconds: targetSnap.masterOutSeconds,
      isMasterPatched: targetSnap.isMasterPatched,
      timelineStage: targetSnap.timelineStage,
      shortClips: targetSnap.shortClips,
      workflowMode: targetSnap.workflowMode
    });
    if (statusNotifier) {
      statusNotifier(`Redid: ${targetSnap.description}`);
    }
  } finally {
    setIsRestoring(false);
  }
  return true;
}

/**
 * Clears undo and redo stacks (called on New Project or project load).
 */
export function clearHistory(): void {
  setUndoStack([]);
  setRedoStack([]);
}

export const historySignals = {
  undoStack,
  redoStack,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  record: recordHistory,
  undo,
  redo,
  clear: clearHistory,
  initHistoryProvider
};
