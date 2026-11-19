import { defineStore } from "pinia";
import type {
  ClipForgeProject,
  ClipManifest,
  AutomaticClipSettings,
  CompositionSettings,
  ExportSettings,
  ManualClipItem
} from "@clipforge/shared";
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
} from "../services/api";
import {
  saveSessionState,
  loadSessionState,
  clearSessionState,
  addRecentProject,
  type SessionSnapshot
} from "../services/persistence";

export interface ProjectState {
  currentProject: ClipForgeProject | null;
  videoMetadata: MediaMetadata | null;
  audioMetadata: MediaMetadata | null;
  currentManifest: ClipManifest | null;
  environmentStatus: EnvironmentInfo | null;
  videoAssetUrl: string | null;
  audioAssetUrl: string | null;
  isLoading: boolean;
  statusMessage: string | null;
  validationErrors: string[];

  // DaVinci Resolve Master Stream Prep & Workflow State
  masterInSeconds: number;
  masterOutSeconds: number;
  isMasterPatched: boolean;
  timelineStage: "master" | "parts"; // "master" = trim & audio patch; "parts" = partitioned into deliverable clips
  activeWorkspaceTab: "media" | "edit" | "deliver";
  isVideoAudioMuted: boolean;
  isDedicatedAudioMuted: boolean;

  // Project File & Persistence State
  projectFilePath: string | null;
  isDirty: boolean;
}

export const useProjectStore = defineStore("project", {
  state: (): ProjectState => ({
    currentProject: null,
    videoMetadata: null,
    audioMetadata: null,
    currentManifest: null,
    environmentStatus: null,
    videoAssetUrl: null,
    audioAssetUrl: null,
    isLoading: false,
    statusMessage: null,
    validationErrors: [],

    masterInSeconds: 0,
    masterOutSeconds: 0,
    isMasterPatched: false,
    timelineStage: "master",
    activeWorkspaceTab: "edit",
    isVideoAudioMuted: false,
    isDedicatedAudioMuted: false,

    projectFilePath: null,
    isDirty: false
  }),

  getters: {
    hasProject: (state) => state.currentProject !== null,
    hasVideo: (state) => state.videoMetadata !== null,
    totalClips: (state) => state.currentManifest?.clips.length ?? 0,
    isManualMode: (state) => state.currentProject?.clipSettings.mode === "manual",
    isMasterStage: (state) => state.timelineStage === "master",
    isPartsStage: (state) => state.timelineStage === "parts",
    hasParts: (state) => Boolean(state.currentManifest && state.currentManifest.clips.length > 0),
    rawDuration: (state) => state.videoMetadata?.durationSeconds || 60,
    activeStreamDuration: (state) =>
      Math.max(
        0,
        (state.masterOutSeconds || state.videoMetadata?.durationSeconds || 60) - state.masterInSeconds
      ),
    trimmedIntroDuration: (state) => state.masterInSeconds,
    trimmedOutroDuration: (state) =>
      Math.max(
        0,
        (state.videoMetadata?.durationSeconds || 60) -
          (state.masterOutSeconds || state.videoMetadata?.durationSeconds || 60)
      ),
    isIntroTrimmed: (state) => state.masterInSeconds > 0.5,
    isOutroTrimmed: (state) =>
      Boolean(
        state.videoMetadata?.durationSeconds &&
          state.masterOutSeconds > 0 &&
          state.masterOutSeconds < state.videoMetadata.durationSeconds - 0.5
      ),
    isAudioAttached: (state) => Boolean(state.audioMetadata)
  },

  actions: {
    async checkSystemEnvironment() {
      try {
        this.environmentStatus = await checkEnvironment();
      } catch (err: unknown) {
        console.error("Environment check error:", err);
      }
    },

    async loadVideoSource(filePath: string, customAssetUrl?: string) {
      this.isLoading = true;
      this.statusMessage = "Inspecting video source...";
      try {
        const metadata = await inspectSource(filePath);
        this.videoMetadata = metadata;
        this.videoAssetUrl = customAssetUrl || (await getMediaAssetUrl(filePath));

        if (!this.currentProject) {
          const baseName = filePath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "clipforge-project";
          this.currentProject = initProject({
            id: `proj_${Date.now()}`,
            name: baseName,
            videoPath: filePath,
            videoDurationSeconds: metadata.durationSeconds,
            width: metadata.width,
            height: metadata.height,
            outputDirectory: "./Exports"
          });
        } else {
          this.currentProject.sources.video = {
            path: filePath,
            durationSeconds: metadata.durationSeconds,
            width: metadata.width,
            height: metadata.height
          };
          if (this.currentProject.clipSettings.mode === "automatic") {
            this.currentProject.clipSettings.endSeconds = metadata.durationSeconds;
          }
        }

        this.masterInSeconds = 0;
        this.masterOutSeconds = metadata.durationSeconds;
        this.isMasterPatched = false;
        this.timelineStage = "master";
        this.currentManifest = null;
        this.statusMessage = "Video loaded. Step 1: Trim intro/outro and align audio before dividing into parts.";
      } catch (err: unknown) {
        this.validationErrors = [err instanceof Error ? err.message : String(err)];
      } finally {
        this.isLoading = false;
      }
    },

    syncVideoElementMetadata(durationSeconds: number, width?: number, height?: number) {
      if (!durationSeconds || !isFinite(durationSeconds) || durationSeconds <= 0) return;
      const rounded = Math.round(durationSeconds * 100) / 100;

      const currentDur = this.videoMetadata?.durationSeconds || 0;
      if (Math.abs(currentDur - rounded) < 0.2) return;

      if (this.videoMetadata) {
        this.videoMetadata.durationSeconds = rounded;
        if (width) this.videoMetadata.width = width;
        if (height) this.videoMetadata.height = height;
      } else {
        this.videoMetadata = {
          path: this.currentProject?.sources.video.path || "source.mp4",
          durationSeconds: rounded,
          width: width || 1920,
          height: height || 1080,
          fps: 60,
          codec: "h264",
          hasAudio: true,
          aspectRatio: width && height ? `${width}:${height}` : "16:9"
        };
      }

      if (this.currentProject) {
        this.currentProject.sources.video.durationSeconds = rounded;
        if (width) this.currentProject.sources.video.width = width;
        if (height) this.currentProject.sources.video.height = height;

        if (this.currentProject.clipSettings.mode === "automatic") {
          this.currentProject.clipSettings.endSeconds = rounded;
        }
      }

      if (this.timelineStage === "parts" && this.isMasterPatched) {
        this.generatePlan();
      }
    },

    async loadAudioSource(filePath: string) {
      this.isLoading = true;
      this.statusMessage = "Inspecting separate audio source...";
      try {
        const metadata = await inspectSource(filePath);
        this.audioMetadata = metadata;
        this.audioAssetUrl = await getMediaAssetUrl(filePath);

        if (this.currentProject) {
          this.currentProject.sources.audio = {
            path: filePath,
            durationSeconds: metadata.durationSeconds
          };
        }
        this.statusMessage = "Audio source attached.";
      } catch (err: unknown) {
        this.validationErrors = [err instanceof Error ? err.message : String(err)];
      } finally {
        this.isLoading = false;
      }
    },

    detachAudioSource() {
      this.audioMetadata = null;
      this.audioAssetUrl = null;
      if (this.currentProject) {
        delete this.currentProject.sources.audio;
      }
      this.statusMessage = "Audio source detached.";
    },

    setAudioOffset(offsetMs: number) {
      if (this.currentProject) {
        this.currentProject.synchronization.audioOffsetMs = offsetMs;
      }
    },

    adjustAudioOffset(deltaMs: number) {
      if (this.currentProject) {
        this.currentProject.synchronization.audioOffsetMs += deltaMs;
      }
    },

    setWorkspaceTab(tab: "media" | "edit" | "deliver") {
      this.activeWorkspaceTab = tab;
    },

    setMasterIn(timeSeconds: number) {
      if (!this.currentProject) return;
      const rawDur = this.videoMetadata?.durationSeconds || 60;
      const currentOut = this.masterOutSeconds || rawDur;
      const t = Math.max(0, Math.min(currentOut - 5, Math.round(timeSeconds * 10) / 10));
      this.masterInSeconds = t;

      if (this.currentProject.clipSettings.mode === "automatic") {
        this.currentProject.clipSettings.startSeconds = t;
      }
      if (this.isMasterPatched && this.timelineStage === "parts") {
        this.generatePlan();
      }
      this.statusMessage = `Master In (Stream Start) set to ${t.toFixed(1)}s. Intro trimmed.`;
    },

    setMasterOut(timeSeconds: number) {
      if (!this.currentProject) return;
      const rawDur = this.videoMetadata?.durationSeconds || 60;
      const t = Math.min(rawDur, Math.max(this.masterInSeconds + 5, Math.round(timeSeconds * 10) / 10));
      this.masterOutSeconds = t;

      if (this.currentProject.clipSettings.mode === "automatic") {
        this.currentProject.clipSettings.endSeconds = t;
      }
      if (this.isMasterPatched && this.timelineStage === "parts") {
        this.generatePlan();
      }
      this.statusMessage = `Master Out (Stream End) set to ${t.toFixed(1)}s. Outro trimmed.`;
    },

    resetMasterTrim() {
      if (!this.currentProject) return;
      const rawDur = this.videoMetadata?.durationSeconds || 60;
      this.masterInSeconds = 0;
      this.masterOutSeconds = rawDur;

      if (this.currentProject.clipSettings.mode === "automatic") {
        this.currentProject.clipSettings.startSeconds = 0;
        this.currentProject.clipSettings.endSeconds = rawDur;
      }
      if (this.isMasterPatched && this.timelineStage === "parts") {
        this.generatePlan();
      }
      this.statusMessage = "Master stream trim reset to full source duration.";
    },

    divideIntoParts() {
      if (!this.currentProject) return;
      this.isMasterPatched = true;
      this.timelineStage = "parts";
      this.activeWorkspaceTab = "edit";

      const rawDur = this.videoMetadata?.durationSeconds || 60;
      if (this.currentProject.clipSettings.mode === "automatic") {
        this.currentProject.clipSettings.startSeconds = this.masterInSeconds;
        this.currentProject.clipSettings.endSeconds = this.masterOutSeconds || rawDur;
      }
      this.generatePlan();
      const count = this.currentManifest?.clips.length || 0;
      this.statusMessage = `Master stream successfully divided into ${count} part clips.`;
    },

    returnToMasterStream() {
      this.timelineStage = "master";
      this.statusMessage = "Returned to Master Stream view. You can adjust intro/outro trim or audio sync.";
    },

    setTimelineStage(stage: "master" | "parts") {
      if (stage === "parts" && !this.isMasterPatched) {
        this.divideIntoParts();
      } else {
        this.timelineStage = stage;
      }
    },

    toggleTimelineStage() {
      if (this.timelineStage === "master") {
        this.divideIntoParts();
      } else {
        this.returnToMasterStream();
      }
    },

    toggleVideoAudioMute() {
      this.isVideoAudioMuted = !this.isVideoAudioMuted;
    },

    toggleDedicatedAudioMute() {
      this.isDedicatedAudioMuted = !this.isDedicatedAudioMuted;
    },

    confirmMasterPatch() {
      this.divideIntoParts();
    },

    setClippingMode(mode: "automatic" | "manual") {
      if (!this.currentProject) return;
      if (this.currentProject.clipSettings.mode === mode) return;

      if (mode === "manual") {
        const initialClips: ManualClipItem[] =
          this.currentManifest?.clips.map((c) => ({
            start: c.sourceStartSeconds,
            end: c.sourceEndSeconds,
            title: c.title,
            enabled: c.enabled
          })) ?? [];

        this.currentProject.clipSettings = {
          mode: "manual",
          clips: initialClips
        };
      } else {
        const rawDur = this.videoMetadata?.durationSeconds || 60;
        this.currentProject.clipSettings = {
          mode: "automatic",
          startSeconds: this.masterInSeconds,
          endSeconds: this.masterOutSeconds || rawDur,
          durationSeconds: 60,
          overlapSeconds: 0,
          minimumFinalClipSeconds: 5,
          startingEpisode: 1
        };
      }
      this.generatePlan();
    },

    addManualClipRange(start: number, end: number, title?: string) {
      if (!this.currentProject) return;
      try {
        if (this.currentProject.clipSettings.mode !== "manual") {
          this.setClippingMode("manual");
        }
        this.currentProject = coreAddManualClip(this.currentProject, {
          start,
          end,
          title,
          enabled: true
        });
        this.generatePlan();
      } catch (err: unknown) {
        this.validationErrors = [err instanceof Error ? err.message : String(err)];
      }
    },

    removeManualClipItem(index: number) {
      if (!this.currentProject || this.currentProject.clipSettings.mode !== "manual") return;
      try {
        this.currentProject = coreRemoveManualClip(this.currentProject, index);
        this.generatePlan();
      } catch (err: unknown) {
        this.validationErrors = [err instanceof Error ? err.message : String(err)];
      }
    },

    toggleManualClipItem(index: number, enabled?: boolean) {
      if (!this.currentProject || this.currentProject.clipSettings.mode !== "manual") return;
      try {
        this.currentProject = coreToggleManualClip(this.currentProject, index, enabled);
        this.generatePlan();
      } catch (err: unknown) {
        this.validationErrors = [err instanceof Error ? err.message : String(err)];
      }
    },

    updateManualClipItem(index: number, updates: Partial<ManualClipItem>) {
      if (!this.currentProject || this.currentProject.clipSettings.mode !== "manual") return;
      const clips = this.currentProject.clipSettings.clips;
      const target = clips[index - 1];
      if (target) {
        Object.assign(target, updates);
        this.generatePlan();
      }
    },

    updateClipSettings(settings: Partial<AutomaticClipSettings>) {
      if (!this.currentProject) return;
      if (this.currentProject.clipSettings.mode === "automatic") {
        Object.assign(this.currentProject.clipSettings, settings);
        this.generatePlan();
      }
    },

    updateComposition(composition: Partial<CompositionSettings>) {
      if (!this.currentProject) return;
      if (composition.background) {
        Object.assign(this.currentProject.composition.background, composition.background);
      }
      if (composition.gameplay) {
        Object.assign(this.currentProject.composition.gameplay, composition.gameplay);
      }
      if (composition.overlay) {
        Object.assign(this.currentProject.composition.overlay, composition.overlay);
      }
      this.generatePlan();
    },

    updateExportSettings(settings: Partial<ExportSettings>) {
      if (!this.currentProject) return;
      Object.assign(this.currentProject.export, settings);
      this.generatePlan();
    },

    splitClipAt(timeSeconds: number) {
      if (!this.currentProject) return;
      const t = Math.round(timeSeconds * 100) / 100;

      if (this.currentProject.clipSettings.mode !== "manual") {
        const manifestClips = this.currentManifest?.clips || [];
        const manualItems: ManualClipItem[] = manifestClips.map((c) => ({
          start: c.sourceStartSeconds,
          end: c.sourceEndSeconds,
          title: c.title,
          enabled: c.enabled
        }));
        this.currentProject.clipSettings = {
          mode: "manual",
          clips: manualItems
        };
      }

      const clips = this.currentProject.clipSettings.clips;
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
        this.generatePlan();
        this.statusMessage = `Segment sliced at ${t.toFixed(1)}s into 2 parts.`;
      }
    },

    trimStreamHead(timeSeconds: number) {
      this.setMasterIn(timeSeconds);
    },

    trimStreamTail(timeSeconds: number) {
      this.setMasterOut(timeSeconds);
    },

    deleteClipAt(timeSeconds: number, clipId?: string | null) {
      if (!this.currentProject) return;

      if (this.currentProject.clipSettings.mode !== "manual") {
        const manifestClips = this.currentManifest?.clips || [];
        this.currentProject.clipSettings = {
          mode: "manual",
          clips: manifestClips.map((c) => ({
            start: c.sourceStartSeconds,
            end: c.sourceEndSeconds,
            title: c.title,
            enabled: c.enabled
          }))
        };
      }

      const clips = this.currentProject.clipSettings.clips;
      let targetIdx = -1;

      if (clipId && this.currentManifest) {
        const found = this.currentManifest.clips.findIndex((c) => c.id === clipId);
        if (found !== -1) targetIdx = found;
      }

      if (targetIdx === -1) {
        targetIdx = clips.findIndex((c) => c.start <= timeSeconds && c.end >= timeSeconds);
      }

      if (targetIdx !== -1) {
        clips.splice(targetIdx, 1);
        this.generatePlan();
        this.statusMessage = "Clip segment deleted.";
      }
    },

    generatePlan() {
      if (!this.currentProject) return;
      const validation = validateProjectConfig(this.currentProject);
      if (!validation.success) {
        this.validationErrors = validation.errors || ["Validation error"];
        return;
      }
      this.validationErrors = [];
      try {
        this.currentManifest = planProjectClips(this.currentProject);
      } catch (err: unknown) {
        this.validationErrors = [err instanceof Error ? err.message : String(err)];
      }
    },

    autoSave(currentTime = 0, zoomLevel = 1, isTimelineExpanded = false) {
      if (!this.currentProject && !this.videoMetadata) return;
      saveSessionState({
        version: 1,
        savedAt: new Date().toISOString(),
        project: this.currentProject,
        videoMetadata: this.videoMetadata,
        audioMetadata: this.audioMetadata,
        masterInSeconds: this.masterInSeconds,
        masterOutSeconds: this.masterOutSeconds,
        isMasterPatched: this.isMasterPatched,
        timelineStage: this.timelineStage,
        activeWorkspaceTab: this.activeWorkspaceTab,
        isVideoAudioMuted: this.isVideoAudioMuted,
        isDedicatedAudioMuted: this.isDedicatedAudioMuted,
        projectFilePath: this.projectFilePath,
        currentTime,
        zoomLevel,
        isTimelineExpanded
      });
    },

    async restoreAutoSavedSession(): Promise<boolean> {
      const snapshot = loadSessionState();
      if (!snapshot || !snapshot.project) {
        return false;
      }
      this.isLoading = true;
      this.statusMessage = "Restoring previous session...";
      try {
        this.currentProject = snapshot.project;
        this.videoMetadata = snapshot.videoMetadata;
        this.audioMetadata = snapshot.audioMetadata;
        this.masterInSeconds = snapshot.masterInSeconds || 0;
        this.masterOutSeconds = snapshot.masterOutSeconds || (snapshot.videoMetadata?.durationSeconds || 60);
        this.isMasterPatched = snapshot.isMasterPatched || false;
        this.timelineStage = snapshot.timelineStage || "master";
        this.activeWorkspaceTab = snapshot.activeWorkspaceTab || "edit";
        this.isVideoAudioMuted = snapshot.isVideoAudioMuted || false;
        this.isDedicatedAudioMuted = snapshot.isDedicatedAudioMuted || false;
        this.projectFilePath = snapshot.projectFilePath || null;
        this.isDirty = false;

        if (snapshot.project.sources.video?.path) {
          this.videoAssetUrl = await getMediaAssetUrl(snapshot.project.sources.video.path);
        }
        if (snapshot.project.sources.audio?.path) {
          this.audioAssetUrl = await getMediaAssetUrl(snapshot.project.sources.audio.path);
        }

        if (this.isMasterPatched && this.timelineStage === "parts") {
          this.generatePlan();
        }

        this.statusMessage = "Session restored successfully.";
        return true;
      } catch (err) {
        console.warn("Failed to restore session snapshot:", err);
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    createNewProject(options?: { name?: string; durationSeconds?: number; outputDirectory?: string }) {
      clearSessionState();
      this.currentProject = null;
      this.videoMetadata = null;
      this.audioMetadata = null;
      this.currentManifest = null;
      this.videoAssetUrl = null;
      this.audioAssetUrl = null;
      this.masterInSeconds = 0;
      this.masterOutSeconds = 0;
      this.isMasterPatched = false;
      this.timelineStage = "master";
      this.activeWorkspaceTab = "media";
      this.projectFilePath = null;
      this.isDirty = false;
      this.statusMessage = "New project started. Ready for media ingest.";
    },

    async saveProject(filePath?: string): Promise<boolean> {
      if (!this.currentProject) {
        this.validationErrors = ["No active project to save."];
        return false;
      }

      const targetPath = filePath || this.projectFilePath;
      if (!targetPath) {
        return await this.saveProjectAs();
      }

      this.isLoading = true;
      this.statusMessage = "Saving project...";
      try {
        const jsonContent = JSON.stringify(this.currentProject, null, 2);
        await saveProjectToDisk(targetPath, jsonContent);
        this.projectFilePath = targetPath;
        this.isDirty = false;
        this.statusMessage = `Project saved: ${targetPath.split(/[/\\]/).pop()}`;
        addRecentProject({
          name: this.currentProject.name,
          filePath: targetPath,
          videoPath: this.currentProject.sources.video?.path,
          audioPath: this.currentProject.sources.audio?.path,
          clipsCount: this.currentManifest?.clips.length || 0
        });
        this.autoSave();
        return true;
      } catch (err: unknown) {
        this.validationErrors = [err instanceof Error ? err.message : String(err)];
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async saveProjectAs(): Promise<boolean> {
      if (!this.currentProject) {
        this.validationErrors = ["No active project to save."];
        return false;
      }

      const defaultName = `${this.currentProject.name || "project"}.clipforge`;
      const selected = await saveFileDialog({
        title: "Save ClipForge Project",
        defaultPath: defaultName,
        filters: [{ name: "ClipForge Project (*.clipforge)", extensions: ["clipforge", "json"] }]
      });

      if (!selected) return false;
      return await this.saveProject(selected);
    },

    async openProject(filePath?: string): Promise<boolean> {
      let targetPath = filePath;
      if (!targetPath) {
        const selected = await openFileDialog({
          title: "Open ClipForge Project",
          filters: [{ name: "ClipForge Project (*.clipforge, *.json)", extensions: ["clipforge", "json"] }]
        });
        if (!selected) return false;
        targetPath = selected;
      }

      this.isLoading = true;
      this.statusMessage = "Opening project file...";
      try {
        const content = await loadProjectFromDisk(targetPath);
        const parsed = JSON.parse(content);
        const validation = validateProjectConfig(parsed);
        if (!validation.success || !validation.project) {
          throw new Error(`Invalid project file format: ${validation.errors?.join(", ")}`);
        }

        const proj = validation.project;
        this.currentProject = proj;
        this.projectFilePath = targetPath;
        this.isDirty = false;

        if (proj.sources.video?.path) {
          await this.loadVideoSource(proj.sources.video.path);
        }

        if (proj.sources.audio?.path) {
          await this.loadAudioSource(proj.sources.audio.path);
        }

        if (proj.clipSettings.mode === "automatic") {
          this.masterInSeconds = proj.clipSettings.startSeconds;
          this.masterOutSeconds = proj.clipSettings.endSeconds;
        }

        this.divideIntoParts();
        addRecentProject({
          name: proj.name,
          filePath: targetPath,
          videoPath: proj.sources.video?.path,
          audioPath: proj.sources.audio?.path,
          clipsCount: this.currentManifest?.clips.length || 0
        });
        this.autoSave();
        this.statusMessage = `Project opened: ${proj.name}`;
        return true;
      } catch (err: unknown) {
        this.validationErrors = [err instanceof Error ? err.message : String(err)];
        return false;
      } finally {
        this.isLoading = false;
      }
    }
  }
});
