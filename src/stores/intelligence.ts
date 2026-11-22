import { createSignal, createMemo } from "solid-js";
import {
  runStreamIntelligence,
  loadStreamIntelligence,
  generateHighlightCandidates,
  loadHighlightCandidates,
  exportHighlightCandidate,
  type SynchronizedAnalysisResult,
  type SynchronizedMoment,
  type StreamAnalysisProgressPayload,
  type HighlightCandidate,
  type CandidateGenerationSettings,
  type CandidateGenerationResult,
  type RenderClipResponse,
} from "../services/api";
import { projectSignals } from "./project";
import { timelineSignals } from "./timeline";

// State Signals - Phase 3 Intelligence Moments
const [analysisResult, setAnalysisResult] = createSignal<SynchronizedAnalysisResult | null>(null);
const [isAnalyzing, setIsAnalyzing] = createSignal<boolean>(false);
const [analysisProgress, setAnalysisProgress] = createSignal<StreamAnalysisProgressPayload | null>(null);
const [analysisError, setAnalysisError] = createSignal<string | null>(null);
const [selectedMomentId, setSelectedMomentId] = createSignal<string | null>(null);

// State Signals - Phase 4 Candidate Generator & Batch Exporter
const [candidates, setCandidates] = createSignal<HighlightCandidate[]>([]);
const [isGeneratingCandidates, setIsGeneratingCandidates] = createSignal<boolean>(false);
const [isExportingCandidate, setIsExportingCandidate] = createSignal<boolean>(false);
const [activeExportingCandidateId, setActiveExportingCandidateId] = createSignal<string | null>(null);
const [candidateError, setCandidateError] = createSignal<string | null>(null);
const [selectedCandidateId, setSelectedCandidateId] = createSignal<string | null>(null);
const [candidateFilter, setCandidateFilter] = createSignal<string>("");
const [isCandidatesDrawerOpen, setIsCandidatesDrawerOpen] = createSignal<boolean>(false);
const [candidateSettings, setCandidateSettings] = createSignal<CandidateGenerationSettings>({
  target_duration_seconds: 30.0,
  min_duration_seconds: 15.0,
  max_duration_seconds: 60.0,
  lead_in_padding: 5.0,
  lead_out_padding: 20.0,
  min_confidence: 0.45,
  merge_gap_seconds: 8.0,
});

// Memos - Moments
const hasMoments = createMemo(() => {
  const res = analysisResult();
  return Boolean(res && res.moments && res.moments.length > 0);
});

const moments = createMemo<SynchronizedMoment[]>(() => {
  const res = analysisResult();
  if (!res || !res.moments) return [];
  return [...res.moments].sort((a, b) => b.confidence - a.confidence);
});

const momentsChronological = createMemo<SynchronizedMoment[]>(() => {
  const res = analysisResult();
  if (!res || !res.moments) return [];
  return [...res.moments].sort((a, b) => a.timestamp - b.timestamp);
});

const totalMoments = createMemo(() => analysisResult()?.total_moments ?? 0);

const selectedMoment = createMemo<SynchronizedMoment | null>(() => {
  const id = selectedMomentId();
  if (!id) return null;
  return moments().find((m) => m.id === id) ?? null;
});

const activeMoment = createMemo<SynchronizedMoment | null>(() => {
  const curr = timelineSignals.currentTime();
  const list = momentsChronological();
  return list.find((m) => curr >= m.lead_in && curr <= m.lead_out) ?? null;
});

// Memos - Candidates
const hasCandidates = createMemo(() => candidates().length > 0);
const totalCandidates = createMemo(() => candidates().length);

const selectedCandidate = createMemo<HighlightCandidate | null>(() => {
  const id = selectedCandidateId();
  if (!id) return null;
  return candidates().find((c) => c.id === id) ?? null;
});

const filteredCandidates = createMemo<HighlightCandidate[]>(() => {
  const query = candidateFilter().trim().toLowerCase();
  const list = candidates();
  if (!query) return list;
  return list.filter(
    (c) =>
      c.title.toLowerCase().includes(query) ||
      c.sentiment.toLowerCase().includes(query) ||
      c.top_keywords.some((k) => k.toLowerCase().includes(query))
  );
});

// Actions - Phase 3
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
    // Automatically generate candidates from moments
    await generateCandidates(projectDir);
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
      await loadCandidates(projectDir);
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

// Actions - Phase 4 Candidate Generation & Export
async function generateCandidates(
  targetDir?: string,
  customSettings?: CandidateGenerationSettings
): Promise<HighlightCandidate[]> {
  const projectDir = targetDir || projectSignals.streamProjectDir();
  if (!projectDir) {
    setCandidateError("No active project directory");
    return [];
  }

  setIsGeneratingCandidates(true);
  setCandidateError(null);

  try {
    const settings = customSettings || candidateSettings();
    const res = await generateHighlightCandidates(projectDir, settings);
    setCandidates(res.candidates);
    return res.candidates;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setCandidateError(msg);
    return [];
  } finally {
    setIsGeneratingCandidates(false);
  }
}

async function loadCandidates(targetDir?: string): Promise<boolean> {
  const projectDir = targetDir || projectSignals.streamProjectDir();
  if (!projectDir) return false;

  try {
    const res = await loadHighlightCandidates(projectDir);
    if (res && res.candidates.length > 0) {
      setCandidates(res.candidates);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function previewCandidate(candidate: HighlightCandidate) {
  setSelectedCandidateId(candidate.id);
  timelineSignals.setCurrentTime(candidate.start_seconds);
  timelineSignals.setInPoint(candidate.start_seconds);
  timelineSignals.setOutPoint(candidate.end_seconds);
}

function addCandidateToProjectPlan(candidate: HighlightCandidate) {
  projectSignals.addManualClipRange(
    candidate.start_seconds,
    candidate.end_seconds,
    candidate.title
  );
}

function addAllCandidatesToProjectPlan(minConfidence = 0.4) {
  const list = candidates().filter((c) => c.confidence >= minConfidence);
  for (const c of list) {
    addCandidateToProjectPlan(c);
  }
}

async function exportCandidate(
  candidate: HighlightCandidate,
  mode: string = "blur_fill"
): Promise<RenderClipResponse | null> {
  const projectDir = projectSignals.streamProjectDir();
  if (!projectDir) return null;

  setIsExportingCandidate(true);
  setActiveExportingCandidateId(candidate.id);

  // Update candidate status to rendering
  setCandidates((prev) =>
    prev.map((c) => (c.id === candidate.id ? { ...c, status: "rendering" as const } : c))
  );

  try {
    const res = await exportHighlightCandidate(projectDir, candidate.id, mode);
    if (res.success) {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id
            ? { ...c, status: "completed" as const, rendered_path: res.output_path }
            : c
        )
      );
    } else {
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, status: "error" as const } : c))
      );
    }
    return res;
  } catch (err) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidate.id ? { ...c, status: "error" as const } : c))
    );
    return null;
  } finally {
    setIsExportingCandidate(false);
    setActiveExportingCandidateId(null);
  }
}

async function batchExportTopCandidates(count: number = 3, mode: string = "blur_fill"): Promise<void> {
  const list = candidates().slice(0, count);
  for (const candidate of list) {
    await exportCandidate(candidate, mode);
  }
}

function toggleCandidatesDrawer() {
  setIsCandidatesDrawerOpen((prev) => !prev);
}

function openCandidatesDrawer() {
  setIsCandidatesDrawerOpen(true);
}

function closeCandidatesDrawer() {
  setIsCandidatesDrawerOpen(false);
}

function clearAnalysis() {
  setAnalysisResult(null);
  setSelectedMomentId(null);
  setAnalysisError(null);
  setAnalysisProgress(null);
  setCandidates([]);
  setSelectedCandidateId(null);
  setIsCandidatesDrawerOpen(false);
}

export const intelligenceSignals = {
  // Phase 3 Signals & Memos
  analysisResult,
  isAnalyzing,
  analysisProgress,
  analysisError,
  selectedMomentId,
  hasMoments,
  moments,
  momentsChronological,
  totalMoments,
  selectedMoment,
  activeMoment,
  // Phase 4 Signals & Memos
  candidates,
  isGeneratingCandidates,
  isExportingCandidate,
  activeExportingCandidateId,
  candidateError,
  selectedCandidateId,
  candidateFilter,
  setCandidateFilter,
  candidateSettings,
  setCandidateSettings,
  hasCandidates,
  totalCandidates,
  selectedCandidate,
  filteredCandidates,
  isCandidatesDrawerOpen,
  // Actions
  runIntelligence,
  loadIntelligence,
  selectMoment,
  addMomentAsClip,
  addAllMomentsAsClips,
  generateCandidates,
  loadCandidates,
  previewCandidate,
  addCandidateToProjectPlan,
  addAllCandidatesToProjectPlan,
  exportCandidate,
  batchExportTopCandidates,
  toggleCandidatesDrawer,
  openCandidatesDrawer,
  closeCandidatesDrawer,
  clearAnalysis,
};
