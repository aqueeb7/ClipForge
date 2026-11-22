import { createSignal, createMemo } from "solid-js";
import {
  runStreamIntelligence,
  loadStreamIntelligence,
  type SynchronizedAnalysisResult,
  type SynchronizedMoment,
  type StreamAnalysisProgressPayload,
} from "../services/api";
import { projectSignals } from "./project";
import { timelineSignals } from "./timeline";

// State Signals
const [analysisResult, setAnalysisResult] = createSignal<SynchronizedAnalysisResult | null>(null);
const [isAnalyzing, setIsAnalyzing] = createSignal<boolean>(false);
const [analysisProgress, setAnalysisProgress] = createSignal<StreamAnalysisProgressPayload | null>(null);
const [analysisError, setAnalysisError] = createSignal<string | null>(null);
const [selectedMomentId, setSelectedMomentId] = createSignal<string | null>(null);

// Memos
const hasMoments = createMemo(() => {
  const res = analysisResult();
  return Boolean(res && res.moments && res.moments.length > 0);
});

const moments = createMemo<SynchronizedMoment[]>(() => {
  const res = analysisResult();
  if (!res || !res.moments) return [];
  // Sorted by confidence descending
  return [...res.moments].sort((a, b) => b.confidence - a.confidence);
});

const momentsChronological = createMemo<SynchronizedMoment[]>(() => {
  const res = analysisResult();
  if (!res || !res.moments) return [];
  // Sorted by timestamp ascending
  return [...res.moments].sort((a, b) => a.timestamp - b.timestamp);
});

const totalMoments = createMemo(() => analysisResult()?.total_moments ?? 0);

const selectedMoment = createMemo<SynchronizedMoment | null>(() => {
  const id = selectedMomentId();
  if (!id) return null;
  return moments().find((m) => m.id === id) ?? null;
});

// Currently active moment under the playhead (within lead_in and lead_out)
const activeMoment = createMemo<SynchronizedMoment | null>(() => {
  const curr = timelineSignals.currentTime();
  const list = momentsChronological();
  return list.find((m) => curr >= m.lead_in && curr <= m.lead_out) ?? null;
});

// Actions
async function runIntelligence(targetDir?: string): Promise<SynchronizedAnalysisResult | null> {
  const projectDir = targetDir || projectSignals.streamProjectDir();
  if (!projectDir) {
    setAnalysisError("No stream project directory active");
    return null;
  }

  setIsAnalyzing(true);
  setAnalysisError(null);
  setAnalysisProgress({
    stage: "initializing",
    percent: 0,
    message: "Initializing offline multi-modal intelligence...",
  });

  let unlisten: (() => void) | null = null;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    unlisten = await listen<StreamAnalysisProgressPayload>("analysis-progress", (e) => {
      setAnalysisProgress(e.payload);
    });
  } catch (err) {
    console.warn("Could not attach analysis-progress listener:", err);
  }

  try {
    const result = await runStreamIntelligence(projectDir);
    setAnalysisResult(result);
    setAnalysisProgress({
      stage: "done",
      percent: 100,
      message: `Analysis completed: detected ${result.total_moments} highlight moments`,
    });
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setAnalysisError(msg);
    return null;
  } finally {
    setIsAnalyzing(false);
    if (unlisten) unlisten();
  }
}

async function loadIntelligence(targetDir?: string): Promise<boolean> {
  const projectDir = targetDir || projectSignals.streamProjectDir();
  if (!projectDir) return false;

  try {
    const result = await loadStreamIntelligence(projectDir);
    if (result && result.total_moments > 0) {
      setAnalysisResult(result);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function selectMoment(moment: SynchronizedMoment) {
  setSelectedMomentId(moment.id);
  timelineSignals.setCurrentTime(moment.timestamp);
  timelineSignals.setInPoint(moment.lead_in);
  timelineSignals.setOutPoint(moment.lead_out);
}

function addMomentAsClip(moment: SynchronizedMoment) {
  const title = moment.headline || `Highlight @ ${Math.round(moment.timestamp)}s`;
  projectSignals.addManualClipRange(moment.lead_in, moment.lead_out, title);
}

function addAllMomentsAsClips(minConfidence = 0.5) {
  const list = moments().filter((m) => m.confidence >= minConfidence);
  for (const moment of list) {
    addMomentAsClip(moment);
  }
}

function clearAnalysis() {
  setAnalysisResult(null);
  setSelectedMomentId(null);
  setAnalysisError(null);
  setAnalysisProgress(null);
}

export const intelligenceSignals = {
  // Signals
  analysisResult,
  isAnalyzing,
  analysisProgress,
  analysisError,
  selectedMomentId,
  // Memos
  hasMoments,
  moments,
  momentsChronological,
  totalMoments,
  selectedMoment,
  activeMoment,
  // Actions
  runIntelligence,
  loadIntelligence,
  selectMoment,
  addMomentAsClip,
  addAllMomentsAsClips,
  clearAnalysis,
};
