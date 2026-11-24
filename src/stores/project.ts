import { createSignal, createMemo } from "solid-js";
import type {
  ClipForgeProject,
  ClipManifest,
  AutomaticClipSettings,
  CompositionSettings,
  ExportSettings,
  ManualClipItem,
  StackingSettings,
  ShortClipItem,
  WorkflowMode
} from "../types/index.js";
import { timelineSignals } from "./timeline.js";
import {
  checkEnvironment,
  inspectSource,
  initProject,
  planProjectClips,
  validateProjectConfig,
  getMediaAssetUrl,
  coreAddManualClip,
  coreRemoveManualClip,
  coreToggleManualClip,
  saveFileDialog,
  openFileDialog,
  saveProjectToDisk,
  loadProjectFromDisk,
  type EnvironmentInfo,
  type MediaMetadata
} from "../services/api.js";
import {
  saveSessionState,
  loadSessionState,
  clearSessionState,
  addRecentProject,
  saveProjectDraft,
  getSavedDrafts,
  deleteProjectDraft,
  type SavedProjectDraft
} from "../services/persistence.js";

// Core Signals
const [currentProject, setCurrentProject] = createSignal<ClipForgeProject | null>(null);
const [videoMetadata, setVideoMetadata] = createSignal<MediaMetadata | null>(null);
const [audioMetadata, setAudioMetadata] = createSignal<MediaMetadata | null>(null);
const [currentManifest, setCurrentManifest] = createSignal<ClipManifest | null>(null);
const [environmentStatus, setEnvironmentStatus] = createSignal<EnvironmentInfo | null>(null);
const [videoAssetUrl, setVideoAssetUrl] = createSignal<string | null>(null);
const [audioAssetUrl, setAudioAssetUrl] = createSignal<string | null>(null);
const [isLoading, setIsLoading] = createSignal<boolean>(false);
const [statusMessage, setStatusMessage] = createSignal<string | null>(null);
const [validationErrors, setValidationErrors] = createSignal<string[]>([]);

// Master Stream Prep & Workflow State
const [masterInSeconds, setMasterInSecondsState] = createSignal<number>(0);
const [masterOutSeconds, setMasterOutSecondsState] = createSignal<number>(0);
const [isMasterPatched, setIsMasterPatched] = createSignal<boolean>(false);
const [timelineStage, setTimelineStageState] = createSignal<"master" | "parts">("master");
const [workflowMode, setWorkflowModeState] = createSignal<WorkflowMode>("hybrid");
const [shortClips, setShortClips] = createSignal<ShortClipItem[]>([]);
const [activeWorkspaceTab, setActiveWorkspaceTabState] = createSignal<"media" | "edit" | "deliver">("edit");
const [isVideoAudioMuted, setIsVideoAudioMuted] = createSignal<boolean>(false);
const [isDedicatedAudioMuted, setIsDedicatedAudioMuted] = createSignal<boolean>(false);

// Project File & Persistence State
const [projectFilePath, setProjectFilePath] = createSignal<string | null>(null);
const [streamProjectDir, setStreamProjectDirState] = createSignal<string | null>(null);
const [isDirty, setIsDirty] = createSignal<boolean>(false);

// Derived Accessors (Memos)
const hasProject = createMemo(() => currentProject() !== null);
const hasVideo = createMemo(() => videoMetadata() !== null);
const totalClips = createMemo(() => currentManifest()?.clips.length ?? 0);
const isManualMode = createMemo(() => currentProject()?.clipSettings.mode === "manual");
const isMasterStage = createMemo(() => timelineStage() === "master");
const isPartsStage = createMemo(() => timelineStage() === "parts");
const hasParts = createMemo(() => Boolean(currentManifest() && (currentManifest()?.clips.length ?? 0) > 0));
const rawDuration = createMemo(() => videoMetadata()?.durationSeconds || currentProject()?.sources.video?.durationSeconds || 60);
const activeStreamDuration = createMemo(() =>
  Math.max(0, (masterOutSeconds() || videoMetadata()?.durationSeconds || currentProject()?.sources.video?.durationSeconds || 60) - masterInSeconds())
);
const trimmedIntroDuration = createMemo(() => masterInSeconds());
const trimmedOutroDuration = createMemo(() => {
  const dur = videoMetadata()?.durationSeconds || currentProject()?.sources.video?.durationSeconds || 60;
  const out = masterOutSeconds() || dur;
  return Math.max(0, dur - out);
});
const isIntroTrimmed = createMemo(() => masterInSeconds() > 0.5);
const isOutroTrimmed = createMemo(() => {
  const dur = videoMetadata()?.durationSeconds || currentProject()?.sources.video?.durationSeconds;
  return Boolean(dur && masterOutSeconds() > 0 && masterOutSeconds() < dur - 0.5);
});
const isAudioAttached = createMemo(() => Boolean(audioMetadata()));

// Action Functions
async function checkSystemEnvironment() {
  try {
    const env = await checkEnvironment();
    setEnvironmentStatus(env);
  } catch (err: unknown) {
    console.error("Environment check error:", err);
  }
}

function generatePlan() {
  const proj = currentProject();
  if (!proj) return;
  const validation = validateProjectConfig(proj);
  if (!validation.success) {
    setValidationErrors(validation.errors || ["Validation error"]);
    return;
  }
  setValidationErrors([]);
  try {
    const manifest = planProjectClips(proj);
    setCurrentManifest(manifest);
  } catch (err: unknown) {
    setValidationErrors([err instanceof Error ? err.message : String(err)]);
  }
}

async function loadVideoSource(filePath: string, customAssetUrl?: string) {
  setIsLoading(true);
  setStatusMessage("Inspecting video source...");
  try {
    const metadata = await inspectSource(filePath);
    setVideoMetadata(metadata);
    const assetUrl = customAssetUrl || (await getMediaAssetUrl(filePath));
    setVideoAssetUrl(assetUrl);

    let proj = currentProject();
    if (!proj) {
      const baseName = filePath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "clipforge-project";
      proj = initProject({
        id: `proj_${Date.now()}`,
        name: baseName,
        videoPath: filePath,
        videoDurationSeconds: metadata.durationSeconds,
        width: metadata.width,
        height: metadata.height,
        outputDirectory: "./Exports"
      });
      setCurrentProject(proj);
    } else {
      const updatedProj: ClipForgeProject = {
        ...proj,
        sources: {
          ...proj.sources,
          video: {
            path: filePath,
            durationSeconds: metadata.durationSeconds,
            width: metadata.width,
            height: metadata.height
          }
        }
      };
      if (updatedProj.clipSettings.mode === "automatic") {
        updatedProj.clipSettings.endSeconds = metadata.durationSeconds;
      }
      setCurrentProject(updatedProj);
    }

    setMasterInSecondsState(0);
    setMasterOutSecondsState(metadata.durationSeconds);
    setIsMasterPatched(false);
    setTimelineStageState("master");
    setCurrentManifest(null);
    setStatusMessage("Video loaded. Step 1: Trim intro/outro and align audio before dividing into parts.");
  } catch (err: unknown) {
    setValidationErrors([err instanceof Error ? err.message : String(err)]);
  } finally {
    setIsLoading(false);
  }
}

function syncVideoElementMetadata(durationSeconds: number, width?: number, height?: number) {
  if (!durationSeconds || !isFinite(durationSeconds) || durationSeconds <= 0) return;
  const rounded = Math.round(durationSeconds * 100) / 100;

  const currentDur = videoMetadata()?.durationSeconds || 0;
  if (Math.abs(currentDur - rounded) < 0.2) return;

  const curMeta = videoMetadata();
  if (curMeta) {
    setVideoMetadata({
      ...curMeta,
      durationSeconds: rounded,
      width: width || curMeta.width,
      height: height || curMeta.height
    });
  } else {
    setVideoMetadata({
      path: currentProject()?.sources.video.path || "source.mp4",
      durationSeconds: rounded,
      width: width || 1920,
      height: height || 1080,
      fps: 60,
      codec: "h264",
      hasAudio: true,
      aspectRatio: width && height ? `${width}:${height}` : "16:9"
    });
  }

  const proj = currentProject();
  if (proj) {
    const updatedProj: ClipForgeProject = {
      ...proj,
      sources: {
        ...proj.sources,
        video: {
          ...proj.sources.video,
          durationSeconds: rounded,
          width: width || proj.sources.video.width,
          height: height || proj.sources.video.height
        }
      }
    };
    if (updatedProj.clipSettings.mode === "automatic") {
      updatedProj.clipSettings.endSeconds = rounded;
    }
    setCurrentProject(updatedProj);
  }

  if (timelineStage() === "parts" && isMasterPatched()) {
    generatePlan();
  }
}

async function loadAudioSource(filePath: string) {
  setIsLoading(true);
  setStatusMessage("Inspecting separate audio source...");
  try {
    const metadata = await inspectSource(filePath);
    setAudioMetadata(metadata);
    const assetUrl = await getMediaAssetUrl(filePath);
    setAudioAssetUrl(assetUrl);

    const proj = currentProject();
    if (proj) {
      setCurrentProject({
        ...proj,
        sources: {
          ...proj.sources,
          audio: {
            path: filePath,
            durationSeconds: metadata.durationSeconds
          }
        }
      });
    }
    setStatusMessage("Audio source attached.");
  } catch (err: unknown) {
    setValidationErrors([err instanceof Error ? err.message : String(err)]);
  } finally {
    setIsLoading(false);
  }
}

function detachAudioSource() {
  setAudioMetadata(null);
  setAudioAssetUrl(null);
  const proj = currentProject();
  if (proj) {
    const nextSources = { ...proj.sources };
    delete nextSources.audio;
    setCurrentProject({
      ...proj,
      sources: nextSources
    });
  }
  setStatusMessage("Audio source detached.");
}

function updateProjectName(name: string) {
  const proj = currentProject();
  if (proj) {
    setCurrentProject({
      ...proj,
      name
    });
  }
}

function setAudioOffset(offsetMs: number) {
  const proj = currentProject();
  if (proj) {
    setCurrentProject({
      ...proj,
      synchronization: {
        ...proj.synchronization,
        audioOffsetMs: offsetMs
      }
    });
  }
}

function adjustAudioOffset(deltaMs: number) {
  const proj = currentProject();
  if (proj) {
    setAudioOffset((proj.synchronization.audioOffsetMs || 0) + deltaMs);
  }
}

function setWorkspaceTab(tab: "media" | "edit" | "deliver") {
  setActiveWorkspaceTabState(tab);
}

function setMasterIn(timeSeconds: number) {
  const proj = currentProject();
  if (!proj) return;
  const rawDur = videoMetadata()?.durationSeconds || 60;
  const currentOut = masterOutSeconds() || rawDur;
  const t = Math.max(0, Math.min(currentOut - 5, Math.round(timeSeconds * 10) / 10));
  setMasterInSecondsState(t);

  if (proj.clipSettings.mode === "automatic") {
    proj.clipSettings.startSeconds = t;
    setCurrentProject({ ...proj });
  }
  if (isMasterPatched() && timelineStage() === "parts") {
    generatePlan();
  }
  setStatusMessage(`Master In (Stream Start) set to ${t.toFixed(1)}s. Intro trimmed.`);
}

function setMasterOut(timeSeconds: number) {
  const proj = currentProject();
  if (!proj) return;
  const rawDur = videoMetadata()?.durationSeconds || 60;
  const t = Math.min(rawDur, Math.max(masterInSeconds() + 5, Math.round(timeSeconds * 10) / 10));
  setMasterOutSecondsState(t);

  if (proj.clipSettings.mode === "automatic") {
    proj.clipSettings.endSeconds = t;
    setCurrentProject({ ...proj });
  }
  if (isMasterPatched() && timelineStage() === "parts") {
    generatePlan();
  }
  setStatusMessage(`Master Out (Stream End) set to ${t.toFixed(1)}s. Outro trimmed.`);
}

function resetMasterTrim() {
  const proj = currentProject();
  if (!proj) return;
  const rawDur = videoMetadata()?.durationSeconds || 60;
  setMasterInSecondsState(0);
  setMasterOutSecondsState(rawDur);

  if (proj.clipSettings.mode === "automatic") {
    proj.clipSettings.startSeconds = 0;
    proj.clipSettings.endSeconds = rawDur;
    setCurrentProject({ ...proj });
  }
  if (isMasterPatched() && timelineStage() === "parts") {
    generatePlan();
  }
  setStatusMessage("Master stream trim reset to full source duration.");
}

function divideIntoParts() {
  const proj = currentProject();
  if (!proj) return;
  setIsMasterPatched(true);
  setTimelineStageState("parts");
  setActiveWorkspaceTabState("edit");

  const rawDur = videoMetadata()?.durationSeconds || 60;
  if (proj.clipSettings.mode === "automatic") {
    proj.clipSettings.startSeconds = masterInSeconds();
    proj.clipSettings.endSeconds = masterOutSeconds() || rawDur;
    setCurrentProject({ ...proj });
  }
  generatePlan();
  const count = currentManifest()?.clips.length || 0;
  setStatusMessage(`Master stream successfully divided into ${count} part clips.`);
}

function returnToMasterStream() {
  setTimelineStageState("master");
  setStatusMessage("Returned to Master Stream view. You can adjust intro/outro trim or audio sync.");
}

function setTimelineStage(stage: "master" | "parts") {
  if (stage === "parts" && !isMasterPatched()) {
    divideIntoParts();
  } else {
    setTimelineStageState(stage);
  }
}

function toggleTimelineStage() {
  if (timelineStage() === "master") {
    divideIntoParts();
  } else {
    returnToMasterStream();
  }
}

function toggleVideoAudioMute() {
  setIsVideoAudioMuted((prev) => !prev);
}

function toggleDedicatedAudioMute() {
  setIsDedicatedAudioMuted((prev) => !prev);
}

function confirmMasterPatch() {
  divideIntoParts();
}

function setClippingMode(mode: "automatic" | "manual") {
  const proj = currentProject();
  if (!proj || proj.clipSettings.mode === mode) return;

  if (mode === "manual") {
    const initialClips: ManualClipItem[] =
      currentManifest()?.clips.map((c) => ({
        start: c.sourceStartSeconds,
        end: c.sourceEndSeconds,
        title: c.title,
        enabled: c.enabled
      })) ?? [];

    setCurrentProject({
      ...proj,
      clipSettings: {
        mode: "manual",
        clips: initialClips
      }
    });
  } else {
    const rawDur = videoMetadata()?.durationSeconds || 60;
    setCurrentProject({
      ...proj,
      clipSettings: {
        mode: "automatic",
        startSeconds: masterInSeconds(),
        endSeconds: masterOutSeconds() || rawDur,
        durationSeconds: 60,
        overlapSeconds: 0,
        minimumFinalClipSeconds: 5,
        startingEpisode: 1
      }
    });
  }
  generatePlan();
}

function addManualClipRange(start: number, end: number, title?: string) {
  const proj = currentProject();
  if (!proj) return;
  try {
    let baseProj = proj;
    if (baseProj.clipSettings.mode !== "manual") {
      setClippingMode("manual");
      baseProj = currentProject()!;
    }
    const updated = coreAddManualClip(baseProj, {
      start,
      end,
      title,
      enabled: true
    });
    setCurrentProject(updated);
    generatePlan();
  } catch (err: unknown) {
    setValidationErrors([err instanceof Error ? err.message : String(err)]);
  }
}

function removeManualClipItem(index: number) {
  const proj = currentProject();
  if (!proj || proj.clipSettings.mode !== "manual") return;
  try {
    const updated = coreRemoveManualClip(proj, index);
    setCurrentProject(updated);
    generatePlan();
  } catch (err: unknown) {
    setValidationErrors([err instanceof Error ? err.message : String(err)]);
  }
}

function toggleManualClipItem(index: number, enabled?: boolean) {
  const proj = currentProject();
  if (!proj || proj.clipSettings.mode !== "manual") return;
  try {
    const updated = coreToggleManualClip(proj, index, enabled);
    setCurrentProject(updated);
    generatePlan();
  } catch (err: unknown) {
    setValidationErrors([err instanceof Error ? err.message : String(err)]);
  }
}

function updateManualClipItem(index: number, updates: Partial<ManualClipItem>) {
  const proj = currentProject();
  if (!proj || proj.clipSettings.mode !== "manual") return;
  const clips = [...proj.clipSettings.clips];
  const target = clips[index - 1];
  if (target) {
    clips[index - 1] = { ...target, ...updates };
    setCurrentProject({
      ...proj,
      clipSettings: {
        mode: "manual",
        clips
      }
    });
    generatePlan();
  }
}

function updateClipSettings(settings: Partial<AutomaticClipSettings>) {
  const proj = currentProject();
  if (!proj || proj.clipSettings.mode !== "automatic") return;
  setCurrentProject({
    ...proj,
    clipSettings: {
      ...proj.clipSettings,
      ...settings
    }
  });
  generatePlan();
}

function setWorkflowMode(mode: WorkflowMode) {
  setWorkflowModeState(mode);
  const proj = currentProject();
  if (proj) {
    setCurrentProject({ ...proj, workflowMode: mode });
  }
  setIsDirty(true);
}

function addShortClip(start: number, end: number, options?: Partial<ShortClipItem>): ShortClipItem {
  const dur = Math.max(1, end - start);
  const id = `short_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = options?.title || `Short #${shortClips().length + 1} (${Math.round(dur)}s)`;
  const template = options?.framingTemplate || currentProject()?.composition?.stacking?.template || "blur_fill";
  const stacking = options?.stacking || currentProject()?.composition?.stacking;

  const newShort: ShortClipItem = {
    id,
    title,
    start,
    end,
    duration: dur,
    framingTemplate: template,
    stacking,
    headerTitle: options?.headerTitle || currentProject()?.composition?.overlay?.brandTitle || "CLIPFORGE",
    brandTitle: options?.brandTitle || "#Shorts",
    source: options?.source || "manual",
    confidence: options?.confidence,
    outputName: options?.outputName || `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp4`,
    status: "pending",
  };

  setShortClips((prev) => [...prev, newShort]);
  const proj = currentProject();
  if (proj) {
    setCurrentProject({ ...proj, shorts: shortClips() });
  }
  setIsDirty(true);
  autoSave(timelineSignals.currentTime(), timelineSignals.zoomLevel());
  return newShort;
}

function removeShortClip(id: string) {
  setShortClips((prev) => prev.filter((s) => s.id !== id));
  const proj = currentProject();
  if (proj) {
    setCurrentProject({ ...proj, shorts: shortClips() });
  }
  setIsDirty(true);
}

function updateShortClip(id: string, updates: Partial<ShortClipItem>) {
  setShortClips((prev) =>
    prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
  );
  const proj = currentProject();
  if (proj) {
    setCurrentProject({ ...proj, shorts: shortClips() });
  }
  setIsDirty(true);
}

function clearShortClips() {
  setShortClips([]);
  const proj = currentProject();
  if (proj) {
    setCurrentProject({ ...proj, shorts: [] });
  }
  setIsDirty(true);
}

function updateComposition(composition: {
  width?: 1080;
  height?: 1920;
  background?: Partial<CompositionSettings["background"]>;
  gameplay?: Partial<CompositionSettings["gameplay"]>;
  stacking?: Partial<StackingSettings>;
  overlay?: Partial<CompositionSettings["overlay"]>;
}) {
  const proj = currentProject();
  if (!proj) return;
  setCurrentProject({
    ...proj,
    composition: {
      ...proj.composition,
      width: composition.width ?? proj.composition.width ?? 1080,
      height: composition.height ?? proj.composition.height ?? 1920,
      background: composition.background
        ? { ...proj.composition.background, ...composition.background }
        : proj.composition.background,
      gameplay: composition.gameplay
        ? { ...proj.composition.gameplay, ...composition.gameplay }
        : proj.composition.gameplay,
      stacking: composition.stacking
        ? {
            template: composition.stacking.template ?? proj.composition.stacking?.template ?? "blur_fill",
            topRegion: composition.stacking.topRegion ?? proj.composition.stacking?.topRegion ?? { x: 2, y: 5, width: 28, height: 35 },
            bottomRegion: composition.stacking.bottomRegion ?? proj.composition.stacking?.bottomRegion ?? { x: 0, y: 15, width: 100, height: 85 },
            cropRegion: composition.stacking.cropRegion ?? proj.composition.stacking?.cropRegion ?? { x: 21.875, y: 0, width: 56.25, height: 100 },
            topHeightPercent: composition.stacking.topHeightPercent ?? proj.composition.stacking?.topHeightPercent ?? 35,
          }
        : proj.composition.stacking,
      overlay: composition.overlay
        ? { ...proj.composition.overlay, ...composition.overlay }
        : proj.composition.overlay
    }
  });
  generatePlan();
}

function updateExportSettings(settings: Partial<ExportSettings>) {
  const proj = currentProject();
  if (!proj) return;
  setCurrentProject({
    ...proj,
    export: {
      ...proj.export,
      ...settings
    }
  });
  generatePlan();
}

function splitClipAt(timeSeconds: number) {
  const proj = currentProject();
  if (!proj) return;
  const t = Math.round(timeSeconds * 100) / 100;

  let workingProj = proj;
  if (workingProj.clipSettings.mode !== "manual") {
    const manifestClips = currentManifest()?.clips || [];
    const manualItems: ManualClipItem[] = manifestClips.map((c) => ({
      start: c.sourceStartSeconds,
      end: c.sourceEndSeconds,
      title: c.title,
      enabled: c.enabled
    }));
    workingProj = {
      ...workingProj,
      clipSettings: {
        mode: "manual",
        clips: manualItems
      }
    };
  }

  const clips = [...(workingProj.clipSettings.mode === "manual" ? workingProj.clipSettings.clips : [])];
  const targetIdx = clips.findIndex((c) => c.start < t && c.end > t);
  if (targetIdx !== -1) {
    const original = clips[targetIdx];
    const clip1: ManualClipItem = {
      start: original.start,
      end: t,
      title: original.title ? `${original.title} (Part A)` : undefined,
      enabled: original.enabled
    };
    const clip2: ManualClipItem = {
      start: t,
      end: original.end,
      title: original.title ? `${original.title} (Part B)` : undefined,
      enabled: original.enabled
    };
    clips.splice(targetIdx, 1, clip1, clip2);
    setCurrentProject({
      ...workingProj,
      clipSettings: {
        mode: "manual",
        clips
      }
    });
    generatePlan();
    setStatusMessage(`Segment sliced at ${t.toFixed(1)}s into 2 parts.`);
  }
}

function deleteClipAt(timeSeconds: number, clipId?: string | null) {
  const proj = currentProject();
  if (!proj) return;

  let workingProj = proj;
  if (workingProj.clipSettings.mode !== "manual") {
    const manifestClips = currentManifest()?.clips || [];
    workingProj = {
      ...workingProj,
      clipSettings: {
        mode: "manual",
        clips: manifestClips.map((c) => ({
          start: c.sourceStartSeconds,
          end: c.sourceEndSeconds,
          title: c.title,
          enabled: c.enabled
        }))
      }
    };
  }

  const clips = [...(workingProj.clipSettings.mode === "manual" ? workingProj.clipSettings.clips : [])];
  let targetIdx = -1;

  const manifest = currentManifest();
  if (clipId && manifest) {
    const found = manifest.clips.findIndex((c) => c.id === clipId);
    if (found !== -1) targetIdx = found;
  }

  if (targetIdx === -1) {
    targetIdx = clips.findIndex((c) => c.start <= timeSeconds && c.end >= timeSeconds);
  }

  if (targetIdx !== -1) {
    clips.splice(targetIdx, 1);
    setCurrentProject({
      ...workingProj,
      clipSettings: {
        mode: "manual",
        clips
      }
    });
    generatePlan();
    setStatusMessage("Clip segment deleted.");
  }
}

function autoSave(currentTime = 0, zoomLevel = 1, isTimelineExpanded = false) {
  const proj = currentProject();
  const vMeta = videoMetadata();
  if (!proj && !vMeta) return;

  saveSessionState({
    version: 1,
    savedAt: new Date().toISOString(),
    project: proj,
    videoMetadata: vMeta,
    audioMetadata: audioMetadata(),
    masterInSeconds: masterInSeconds(),
    masterOutSeconds: masterOutSeconds(),
    isMasterPatched: isMasterPatched(),
    timelineStage: timelineStage(),
    workflowMode: workflowMode(),
    shortClips: shortClips(),
    activeWorkspaceTab: activeWorkspaceTab(),
    isVideoAudioMuted: isVideoAudioMuted(),
    isDedicatedAudioMuted: isDedicatedAudioMuted(),
    projectFilePath: projectFilePath(),
    currentTime,
    zoomLevel,
    isTimelineExpanded
  });

  if (proj) {
    saveProjectDraft({
      id: proj.id,
      name: proj.name,
      filePath: projectFilePath() || (streamProjectDir() ? `${streamProjectDir()}/project.json` : `draft_${proj.id}`),
      projectDir: streamProjectDir() || undefined,
      videoPath: proj.sources.video?.path,
      audioPath: proj.sources.audio?.path,
      clipsCount: currentManifest()?.clips?.length || (proj.clipSettings.mode === "manual" ? proj.clipSettings.clips.length : 0),
      shortsCount: shortClips().length,
      workflowMode: workflowMode(),
      resumeTime: currentTime,
      candidatesCount: 0,
      hasChat: false,
      status: "in_progress",
      lastSaved: new Date().toISOString(),
    });
  }
}

async function restoreAutoSavedSession(): Promise<boolean> {
  const snapshot = loadSessionState();
  if (!snapshot || !snapshot.project) {
    return false;
  }
  setIsLoading(true);
  setStatusMessage("Restoring previous session...");
  try {
    setCurrentProject(snapshot.project);
    setVideoMetadata(snapshot.videoMetadata);
    setAudioMetadata(snapshot.audioMetadata);
    setMasterInSecondsState(snapshot.masterInSeconds || 0);
    setMasterOutSecondsState(snapshot.masterOutSeconds || snapshot.videoMetadata?.durationSeconds || 60);
    setIsMasterPatched(snapshot.isMasterPatched || false);
    setTimelineStageState(snapshot.timelineStage || "master");
    if (snapshot.workflowMode) {
      setWorkflowModeState(snapshot.workflowMode);
    }
    if (snapshot.shortClips && Array.isArray(snapshot.shortClips)) {
      setShortClips(snapshot.shortClips);
    }
    setActiveWorkspaceTabState(snapshot.activeWorkspaceTab || "edit");
    setIsVideoAudioMuted(snapshot.isVideoAudioMuted || false);
    setIsDedicatedAudioMuted(snapshot.isDedicatedAudioMuted || false);
    setProjectFilePath(snapshot.projectFilePath || null);
    setIsDirty(false);

    if (snapshot.project.sources.video?.path) {
      const vUrl = await getMediaAssetUrl(snapshot.project.sources.video.path);
      setVideoAssetUrl(vUrl);
    }
    if (snapshot.project.sources.audio?.path) {
      const aUrl = await getMediaAssetUrl(snapshot.project.sources.audio.path);
      setAudioAssetUrl(aUrl);
    }

    if (snapshot.isMasterPatched && snapshot.timelineStage === "parts") {
      generatePlan();
    }

    if (snapshot.currentTime !== undefined && snapshot.currentTime > 0) {
      timelineSignals.setCurrentTime(snapshot.currentTime);
    }
    if (snapshot.zoomLevel !== undefined) {
      timelineSignals.setZoomLevel(snapshot.zoomLevel);
    }

    setStatusMessage("Session restored successfully.");
    return true;
  } catch (err) {
    console.warn("Failed to restore session snapshot:", err);
    return false;
  } finally {
    setIsLoading(false);
  }
}

async function saveAndCloseProject(onClosed?: () => void) {
  const t = timelineSignals.currentTime();
  const z = timelineSignals.zoomLevel();
  const exp = timelineSignals.isTimelineExpanded();
  autoSave(t, z, exp);

  // Clear active workspace
  clearSessionState();
  setCurrentProject(null);
  setVideoMetadata(null);
  setAudioMetadata(null);
  setCurrentManifest(null);
  setVideoAssetUrl(null);
  setAudioAssetUrl(null);
  setMasterInSecondsState(0);
  setMasterOutSecondsState(0);
  setIsMasterPatched(false);
  setTimelineStageState("master");
  setShortClips([]);
  setProjectFilePath(null);
  setStreamProjectDirState(null);
  setIsDirty(false);
  timelineSignals.setCurrentTime(0);

  setStatusMessage("Project saved and closed.");
  if (onClosed) {
    onClosed();
  }
}

function createNewProject(options?: { name?: string; durationSeconds?: number; outputDirectory?: string; workflowMode?: WorkflowMode }) {
  clearSessionState();
  setCurrentProject(null);
  setVideoMetadata(null);
  setAudioMetadata(null);
  setCurrentManifest(null);
  setVideoAssetUrl(null);
  setAudioAssetUrl(null);
  setMasterInSecondsState(0);
  setMasterOutSecondsState(0);
  setIsMasterPatched(false);
  setTimelineStageState("master");
  setWorkflowModeState(options?.workflowMode || "hybrid");
  setShortClips([]);
  setActiveWorkspaceTabState("media");
  setProjectFilePath(null);
  setIsDirty(false);
  setStatusMessage("New project started. Ready for media ingest.");
}

async function saveProject(filePath?: string): Promise<boolean> {
  const proj = currentProject();
  if (!proj) {
    setValidationErrors(["No active project to save."]);
    return false;
  }

  const targetPath = filePath || projectFilePath();
  if (!targetPath) {
    return await saveProjectAs();
  }

  setIsLoading(true);
  setStatusMessage("Saving project...");
  try {
    const jsonContent = JSON.stringify(proj, null, 2);
    await saveProjectToDisk(targetPath, jsonContent);
    setProjectFilePath(targetPath);
    setIsDirty(false);
    setStatusMessage(`Project saved: ${targetPath.split(/[/\\]/).pop()}`);
    addRecentProject({
      name: proj.name,
      filePath: targetPath,
      videoPath: proj.sources.video?.path,
      audioPath: proj.sources.audio?.path,
      clipsCount: currentManifest()?.clips.length || 0
    });
    autoSave();
    return true;
  } catch (err: unknown) {
    setValidationErrors([err instanceof Error ? err.message : String(err)]);
    return false;
  } finally {
    setIsLoading(false);
  }
}

async function saveProjectAs(): Promise<boolean> {
  const proj = currentProject();
  if (!proj) {
    setValidationErrors(["No active project to save."]);
    return false;
  }

  const defaultName = `${proj.name || "project"}.clipforge`;
  const selected = await saveFileDialog({
    title: "Save ClipForge Project",
    defaultPath: defaultName,
    filters: [{ name: "ClipForge Project (*.clipforge)", extensions: ["clipforge", "json"] }]
  });

  if (!selected) return false;
  return await saveProject(selected);
}

async function openProject(filePath?: string): Promise<boolean> {
  let targetPath = filePath;
  if (!targetPath) {
    const selected = await openFileDialog({
      title: "Open ClipForge Project",
      filters: [{ name: "ClipForge Project (*.clipforge, *.json)", extensions: ["clipforge", "json"] }]
    });
    if (!selected) return false;
    targetPath = selected;
  }

  setIsLoading(true);
  setStatusMessage("Opening project file...");
  try {
    const content = await loadProjectFromDisk(targetPath);
    const parsed = JSON.parse(content);
    const validation = validateProjectConfig(parsed);
    if (!validation.success || !validation.project) {
      throw new Error(`Invalid project file format: ${validation.errors?.join(", ")}`);
    }

    const proj = validation.project;
    setCurrentProject(proj);
    setProjectFilePath(targetPath);
    setIsDirty(false);

    if (proj.sources.video?.path) {
      await loadVideoSource(proj.sources.video.path);
    }

    if (proj.sources.audio?.path) {
      await loadAudioSource(proj.sources.audio.path);
    }

    if (proj.workflowMode) {
      setWorkflowModeState(proj.workflowMode);
    }

    if (proj.shorts && Array.isArray(proj.shorts)) {
      setShortClips(proj.shorts);
    }

    if (proj.clipSettings.mode === "automatic") {
      setMasterInSecondsState(proj.clipSettings.startSeconds ?? 0);
      setMasterOutSecondsState(
        proj.clipSettings.endSeconds ??
        videoMetadata()?.durationSeconds ??
        proj.sources.video?.durationSeconds ??
        60
      );
    }

    divideIntoParts();
    addRecentProject({
      name: proj.name,
      filePath: targetPath,
      videoPath: proj.sources.video?.path,
      audioPath: proj.sources.audio?.path,
      clipsCount: currentManifest()?.clips.length || 0
    });
    autoSave();
    setStatusMessage(`Project opened: ${proj.name}`);
    return true;
  } catch (err: unknown) {
    setValidationErrors([err instanceof Error ? err.message : String(err)]);
    return false;
  } finally {
    setIsLoading(false);
  }
}

function clearErrors() {
  setValidationErrors([]);
}

export const projectSignals = {
  // Signals
  currentProject,
  setCurrentProject,
  videoMetadata,
  setVideoMetadata,
  audioMetadata,
  setAudioMetadata,
  currentManifest,
  setCurrentManifest,
  environmentStatus,
  videoAssetUrl,
  audioAssetUrl,
  isLoading,
  statusMessage,
  validationErrors,
  clearErrors,

  masterInSeconds,
  masterOutSeconds,
  isMasterPatched,
  timelineStage,
  activeWorkspaceTab,
  isVideoAudioMuted,
  isDedicatedAudioMuted,
  projectFilePath,
  streamProjectDir,
  setStreamProjectDir: setStreamProjectDirState,
  isDirty,
  workflowMode,
  setWorkflowMode,
  shortClips,
  addShortClip,
  removeShortClip,
  updateShortClip,
  clearShortClips,
  saveAndCloseProject,

  // Memos
  hasProject,
  hasVideo,
  totalClips,
  isManualMode,
  isMasterStage,
  isPartsStage,
  hasParts,
  rawDuration,
  activeStreamDuration,
  trimmedIntroDuration,
  trimmedOutroDuration,
  isIntroTrimmed,
  isOutroTrimmed,
  isAudioAttached,

  // Actions
  checkSystemEnvironment,
  loadVideoSource,
  syncVideoElementMetadata,
  loadAudioSource,
  detachAudioSource,
  setAudioOffset,
  adjustAudioOffset,
  setWorkspaceTab,
  setMasterIn,
  setMasterOut,
  trimStreamHead: setMasterIn,
  trimStreamTail: setMasterOut,
  resetMasterTrim,
  divideIntoParts,
  returnToMasterStream,
  setTimelineStage,
  toggleTimelineStage,
  toggleVideoAudioMute,
  toggleDedicatedAudioMute,
  confirmMasterPatch,
  setClippingMode,
  addManualClipRange,
  removeManualClipItem,
  toggleManualClipItem,
  updateManualClipItem,
  updateClipSettings,
  updateComposition,
  updateExportSettings,
  splitClipAt,
  deleteClipAt,
  generatePlan,
  autoSave,
  restoreAutoSavedSession,
  createNewProject,
  updateProjectName,
  saveProject,
  saveProjectAs,
  openProject
};
