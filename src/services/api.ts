import type {
  ClipForgeProject,
  ClipManifest,
  Clip,
  GpuEncoderInfo,
  AppDiagnostic,
  StreamSummary,
  RenderClipRequest,
  RenderProgressPayload,
  RenderClipResponse
} from "../types/index.js";
import {
  generateAutomaticClips,
  generateManualClips,
  generateClipManifest,
  createDefaultProject,
  addManualClip as coreAddManualClip,
  removeManualClip as coreRemoveManualClip,
  toggleManualClip as coreToggleManualClip
} from "./planner.js";

export type {
  GpuEncoderInfo,
  AppDiagnostic,
  StreamSummary as MediaMetadata,
  RenderClipRequest,
  RenderProgressPayload,
  RenderClipResponse
};

export interface EnvironmentInfo {
  ready: boolean;
  os: string;
  message: string;
  ffmpegFound: boolean;
  ffprobeFound: boolean;
  gpu?: GpuEncoderInfo;
}

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Returns playable asset URL for the video element.
 */
export async function getMediaAssetUrl(filePath: string): Promise<string> {
  if (isTauriEnvironment()) {
    try {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      return convertFileSrc(filePath);
    } catch (err) {
      console.warn("Failed to convert file src:", err);
    }
  }
  return filePath;
}

/**
 * Checks system diagnostics (FFmpeg, FFprobe, GPU, OS).
 */
export async function checkEnvironment(): Promise<EnvironmentInfo> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke<{
        ready: boolean;
        os: string;
        message: string;
        ffmpeg_found: boolean;
        ffprobe_found: boolean;
        gpu?: GpuEncoderInfo;
      }>("get_app_info");
      return {
        ready: res.ready,
        os: res.os,
        message: res.message,
        ffmpegFound: res.ffmpeg_found,
        ffprobeFound: res.ffprobe_found,
        gpu: res.gpu
      };
    } catch (err) {
      console.warn("Tauri invoke failed, falling back to simulated info", err);
    }
  }

  return {
    ready: true,
    os: "browser-dev",
    message: "ClipForge Web Dev Mode (Simulated)",
    ffmpegFound: true,
    ffprobeFound: true,
    gpu: {
      encoder: "libx264",
      name: "CPU (x264)",
      is_hardware: false,
      description: "Software CPU (Simulated)"
    }
  };
}

/**
 * Directly queries active GPU encoder info from Rust backend.
 */
export async function getGpuInfo(): Promise<GpuEncoderInfo> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<GpuEncoderInfo>("get_gpu_info");
  }
  return {
    encoder: "libx264",
    name: "CPU (x264)",
    is_hardware: false,
    description: "Software CPU (Simulated)"
  };
}

/**
 * Inspects a source video/audio file.
 */
export async function inspectSource(filePath: string): Promise<StreamSummary> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke<{
        path: string;
        duration_seconds: number;
        width?: number;
        height?: number;
        fps?: number;
        codec: string;
        has_audio: boolean;
        aspect_ratio: string;
      }>("inspect_media", { path: filePath });

      return {
        path: res.path,
        durationSeconds: res.duration_seconds,
        duration_seconds: res.duration_seconds,
        width: res.width,
        height: res.height,
        fps: res.fps,
        codec: res.codec,
        hasAudio: res.has_audio,
        has_audio: res.has_audio,
        aspectRatio: res.aspect_ratio,
        aspect_ratio: res.aspect_ratio,
        format: res.codec
      };
    } catch (err) {
      console.warn("Tauri inspect_media failed:", err);
    }
  }

  return {
    path: filePath,
    durationSeconds: 120,
    duration_seconds: 120,
    width: 1920,
    height: 1080,
    fps: 60,
    codec: "h264",
    hasAudio: true,
    has_audio: true,
    aspectRatio: "16:9",
    aspect_ratio: "16:9",
    format: "h264"
  };
}

/**
 * Executes real clip render via FFmpeg.
 */
export async function renderClip(req: RenderClipRequest): Promise<RenderClipResponse> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<RenderClipResponse>("render_clip", { req });
  }

  await new Promise((res) => setTimeout(res, 500));
  return {
    success: true,
    output_path: req.output_path,
    duration_seconds: req.duration_seconds,
    file_size_bytes: Math.round(req.duration_seconds * 150000)
  };
}

/**
 * Cancels active clip rendering.
 */
export async function cancelRender(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("cancel_render");
    } catch (err) {
      console.warn("cancel_render failed:", err);
    }
  }
}

/**
 * Opens a file or folder in the native OS file explorer.
 */
export async function openInExplorer(path: string): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_in_explorer", { path });
    } catch (err) {
      console.warn("open_in_explorer failed:", err);
    }
  }
}

/**
 * Opens a native file picker dialog or web fallback.
 */
export async function openFileDialog(options?: {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        directory: false,
        title: options?.title ?? "Select Media File",
        filters: options?.filters
      });
      if (typeof selected === "string") return selected;
      return null;
    } catch (err) {
      console.warn("Tauri file dialog failed:", err);
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (options?.filters?.[0]?.extensions) {
      input.accept = options.filters[0].extensions.map((ext) => `.${ext}`).join(",");
    }
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file.name);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Opens a native save file dialog or web prompt.
 */
export async function saveFileDialog(options?: {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selected = await save({
        title: options?.title ?? "Save Project",
        defaultPath: options?.defaultPath ?? "project.clipforge",
        filters: options?.filters ?? [
          { name: "ClipForge Project (*.clipforge)", extensions: ["clipforge", "json"] }
        ]
      });
      if (typeof selected === "string") return selected;
      return null;
    } catch (err) {
      console.warn("Tauri save dialog failed:", err);
    }
  }

  const name = window.prompt("Project filename to save:", options?.defaultPath ?? "project.clipforge");
  return name ? name.trim() : null;
}

/**
 * Saves project JSON content directly to a file on disk.
 */
export async function saveProjectToDisk(filePath: string, content: string): Promise<void> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_project_file", { path: filePath, content });
  } else {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filePath.split(/[/\\]/).pop() || "project.clipforge";
    a.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Cleans up leftover .part.mp4 or .tmp.mp4 incomplete files from an export directory.
 */
export async function cleanupIncompleteFiles(dirPath: string): Promise<number> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<number>("cleanup_incomplete_files", { dirPath });
  }
  return 0;
}

/**
 * Loads project JSON content directly from a file on disk.
 */
export async function loadProjectFromDisk(filePath: string): Promise<string> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("load_project_file", { path: filePath });
  }
  throw new Error("Local disk load requires desktop environment");
}

/**
 * Opens a native directory picker dialog.
 */
export async function openDirectoryDialog(title?: string): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        directory: true,
        title: title ?? "Select Output Directory"
      });
      if (typeof selected === "string") return selected;
      return null;
    } catch (err) {
      console.warn("Tauri directory dialog failed:", err);
    }
  }

  return "./exports";
}

/**
 * Creates default project configuration.
 */
export function initProject(options: {
  id: string;
  name: string;
  videoPath: string;
  videoDurationSeconds: number;
  width?: number;
  height?: number;
  audioPath?: string;
  audioOffsetMs?: number;
  clipDurationSeconds?: number;
  outputDirectory: string;
}): ClipForgeProject {
  return createDefaultProject(options);
}

/**
 * Validates a project configuration object.
 */
export function validateProjectConfig(project: unknown): {
  success: boolean;
  project?: ClipForgeProject;
  errors?: string[];
} {
  if (!project || typeof project !== "object") {
    return { success: false, errors: ["Invalid project payload"] };
  }

  const p = project as Partial<ClipForgeProject>;
  const errors: string[] = [];

  if (!p.id) errors.push("Project ID cannot be empty");
  if (!p.name) errors.push("Project name cannot be empty");
  if (!p.sources?.video?.path) errors.push("Video source path cannot be empty");
  if (!p.clipSettings) errors.push("Clip settings are missing");
  if (!p.composition) errors.push("Composition settings are missing");
  if (!p.export?.outputDirectory) errors.push("Export directory is missing");

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, project: p as ClipForgeProject };
}

/**
 * Plans clips for the project manifest.
 */
export function planProjectClips(project: ClipForgeProject): ClipManifest {
  return generateClipManifest(project);
}

/**
 * Reveals and highlights the specific file in Windows Explorer, macOS Finder, or Linux file manager.
 */
export async function highlightInFolder(filePath: string): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("highlight_in_folder", { path: filePath });
      return;
    } catch (err) {
      console.warn("highlight_in_folder failed, falling back to open_in_explorer:", err);
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_in_explorer", { path: filePath });
      return;
    }
  }
  console.log("Mock highlight in folder:", filePath);
}

/**
 * Opens a URL in the user's default web browser.
 */
export async function openBrowserUrl(url: string): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_browser_url", { url });
      return;
    } catch (err) {
      console.warn("open_browser_url failed, falling back to window.open:", err);
    }
  }
  window.open(url, "_blank");
}

/**
 * Starts a temporary local loopback HTTP listener to catch the Google OAuth callback.
 */
export async function listenForOAuthCode(port: number = 8085): Promise<string> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("listen_for_oauth_code", { port });
  }
  throw new Error("OAuth listener is only supported in native desktop mode");
}

/**
 * Exchanges Google OAuth authorization code for access and refresh tokens.
 */
export async function exchangeOAuthCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const jsonStr = await invoke<string>("exchange_oauth_code", {
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    return JSON.parse(jsonStr);
  }
  throw new Error("OAuth token exchange is only supported in native desktop mode");
}

/**
 * Refreshes Google OAuth access token using stored refresh token.
 */
export async function refreshOAuthToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{
  access_token: string;
  expires_in?: number;
  token_type?: string;
}> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const jsonStr = await invoke<string>("refresh_oauth_token", {
      clientId,
      clientSecret,
      refreshToken,
    });
    return JSON.parse(jsonStr);
  }
  throw new Error("OAuth token refresh is only supported in native desktop mode");
}

/**
 * Uploads a rendered clip directly to YouTube via resumable upload.
 */
export async function uploadToYouTube(params: {
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  privacy: "public" | "unlisted" | "private";
  accessToken: string;
}): Promise<{
  success: boolean;
  video_id?: string;
  url?: string;
  error?: string;
}> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<{
      success: boolean;
      video_id?: string;
      url?: string;
      error?: string;
    }>("upload_to_youtube", {
      params: {
        file_path: params.filePath,
        title: params.title,
        description: params.description,
        tags: params.tags,
        privacy: params.privacy,
        access_token: params.accessToken,
      },
    });
  }
  return {
    success: true,
    video_id: "mock_yt_12345",
    url: "https://youtube.com/shorts/mock_yt_12345",
  };
}

/**
 * Cancels any active OAuth local listener.
 */
export async function cancelOAuthListener(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("cancel_oauth_listener");
    } catch (err) {
      console.warn("Failed to cancel OAuth listener:", err);
    }
  }
}

/**
 * Saves Google OAuth client credentials securely to .credentials/youtube-secrets.json.
 */
export async function saveStoredSecrets(clientId: string, clientSecret: string): Promise<void> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_stored_secrets", { clientId, clientSecret });
    return;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("clipforge_yt_secrets", JSON.stringify({ client_id: clientId, client_secret: clientSecret }));
  }
}

/**
 * Loads stored Google OAuth client credentials from .credentials/youtube-secrets.json.
 */
export async function loadStoredSecrets(): Promise<{ client_id: string; client_secret: string } | null> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<{ client_id: string; client_secret: string } | null>("load_stored_secrets");
    } catch (err) {
      console.warn("Failed to load stored secrets:", err);
    }
  }
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem("clipforge_yt_secrets");
    return raw ? JSON.parse(raw) : null;
  }
  return null;
}

/**
 * Saves OAuth tokens securely to .credentials/youtube-tokens.json.
 */
export async function saveStoredTokens(tokensJson: string): Promise<void> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_stored_tokens", { tokensJson });
    return;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("clipforge:youtube_tokens", tokensJson);
  }
}

/**
 * Loads OAuth tokens from .credentials/youtube-tokens.json.
 */
export async function loadStoredTokens(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string | null>("load_stored_tokens");
    } catch (err) {
      console.warn("Failed to load stored tokens:", err);
    }
  }
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("clipforge:youtube_tokens");
  }
  return null;
}

/**
 * Clears stored OAuth tokens from disk and memory.
 */
export async function clearStoredCredentials(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_stored_credentials");
    } catch (err) {
      console.warn("Failed to clear stored credentials:", err);
    }
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("clipforge:youtube_tokens");
  }
}

export interface StreamFormatOption {
  format_id: string;
  ext: string;
  resolution: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize_approx?: number;
  is_video: boolean;
  is_audio: boolean;
  quality_label: string;
}

export interface StreamUrlInspection {
  url: string;
  title: string;
  channel: string;
  duration_seconds: number;
  thumbnail_url?: string;
  has_chat_replay: boolean;
  video_formats: StreamFormatOption[];
  audio_formats: StreamFormatOption[];
  recommended_video_id: string;
  recommended_audio_id: string;
}

export interface StreamProjectLayout {
  project_dir: string;
  source_dir: string;
  normalized_dir: string;
  analysis_dir: string;
  highlights_dir: string;
  clips_dir: string;
}

export interface StreamDownloadRequest {
  url: string;
  project_dir: string;
  video_format_id: string;
  audio_format_id: string;
  download_chat: boolean;
}

export interface StreamDownloadProgressPayload {
  stage: string;
  percentage: number;
  speed: string;
  eta: string;
  message: string;
}

export interface StreamDownloadResult {
  success: boolean;
  video_path?: string;
  audio_path?: string;
  chat_path?: string;
  metadata_path?: string;
  error?: string;
}

/**
 * Inspects a YouTube livestream or video URL and extracts available quality renditions and chat replay status.
 */
export async function inspectStreamUrl(url: string): Promise<StreamUrlInspection> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<StreamUrlInspection>("inspect_stream_url", { url });
  }
  throw new Error("Stream URL inspection is only supported in native desktop mode");
}

/**
 * Initializes a ClipForge 2.0 stream intelligence project on disk.
 */
export async function initStreamProject(baseDir: string, projectName: string): Promise<StreamProjectLayout> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<StreamProjectLayout>("init_stream_project", { baseDir, projectName });
  }
  return {
    project_dir: `${baseDir}/${projectName}`,
    source_dir: `${baseDir}/${projectName}/source`,
    normalized_dir: `${baseDir}/${projectName}/normalized`,
    analysis_dir: `${baseDir}/${projectName}/analysis`,
    highlights_dir: `${baseDir}/${projectName}/highlights`,
    clips_dir: `${baseDir}/${projectName}/highlights/clips`,
  };
}

/**
 * Executes background download of video, audio, and chat replay.
 */
export async function downloadStreamAssets(req: StreamDownloadRequest): Promise<StreamDownloadResult> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<StreamDownloadResult>("download_stream_assets", { req });
  }
  throw new Error("Stream downloading is only supported in native desktop mode");
}

/**
 * Cancels active stream download.
 */
export async function cancelStreamDownload(): Promise<void> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("cancel_stream_download");
  }
}

export interface VideoIndex {
  path: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  start_pts: number;
  start_time: number;
  total_frames: number;
  aspect_ratio: string;
}

export interface AudioIndex {
  path: string;
  duration: number;
  sample_rate: number;
  channels: number;
  codec: string;
  start_pts: number;
  start_time: number;
  offset_seconds: number;
}

export interface ChatDensityBucket {
  bin_start: number;
  bin_end: number;
  count: number;
  velocity: number;
}

export interface NormalizedIndexedMessage {
  index: number;
  offset_ms: number;
  time_seconds: number;
  author: string;
  message: string;
  badges: string[];
}

export interface ChatSummaryBrief {
  total_messages: number;
  duration_seconds: number;
  peak_velocity_msg_per_sec: number;
  average_velocity_msg_per_sec: number;
}

export interface ChatIndex {
  total_messages: number;
  start_offset_seconds: number;
  end_offset_seconds: number;
  peak_velocity_msg_per_sec: number;
  average_velocity_msg_per_sec: number;
  density_buckets_5s: ChatDensityBucket[];
  density_buckets_1s: ChatDensityBucket[];
  messages: NormalizedIndexedMessage[];
}

export interface TimelineSummary {
  project_dir: string;
  project_timeline_duration: number;
  video_ready: boolean;
  audio_ready: boolean;
  chat_ready: boolean;
  audio_offset_seconds: number;
  chat_offset_seconds: number;
  synchronized: boolean;
  video_index?: VideoIndex;
  audio_index?: AudioIndex;
  chat_summary?: ChatSummaryBrief;
}

/**
 * Normalizes timestamps across video, audio, and chat replay files into a canonical timeline.
 */
export async function normalizeStreamProject(
  projectDir: string,
  chatOffsetSeconds?: number
): Promise<TimelineSummary> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<TimelineSummary>("normalize_stream_project", {
      projectDir,
      chatOffsetSeconds: chatOffsetSeconds ?? null,
    });
  }
  return {
    project_dir: projectDir,
    project_timeline_duration: 60,
    video_ready: true,
    audio_ready: false,
    chat_ready: false,
    audio_offset_seconds: 0,
    chat_offset_seconds: 0,
    synchronized: true,
  };
}

/**
 * Loads precomputed chat replay index with timestamps and density curve.
 */
export async function loadStreamChatIndex(projectDir: string): Promise<ChatIndex> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<ChatIndex>("load_stream_chat_index", { projectDir });
  }
  return {
    total_messages: 0,
    start_offset_seconds: 0,
    end_offset_seconds: 0,
    peak_velocity_msg_per_sec: 0,
    average_velocity_msg_per_sec: 0,
    density_buckets_5s: [],
    density_buckets_1s: [],
    messages: [],
  };
}

/**
 * Loads stream timeline summary.
 */
export async function loadTimelineSummary(projectDir: string): Promise<TimelineSummary> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<TimelineSummary>("load_timeline_summary", { projectDir });
  }
  return {
    project_dir: projectDir,
    project_timeline_duration: 60,
    video_ready: true,
    audio_ready: false,
    chat_ready: false,
    audio_offset_seconds: 0,
    chat_offset_seconds: 0,
    synchronized: true,
  };
}

/**
 * Recalibrates chat offset against the video anchor timeline.
 */
export async function calibrateChatOffset(
  projectDir: string,
  chatOffsetSeconds: number
): Promise<TimelineSummary> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<TimelineSummary>("calibrate_chat_offset", {
      projectDir,
      chatOffsetSeconds,
    });
  }
  return {
    project_dir: projectDir,
    project_timeline_duration: 60,
    video_ready: true,
    audio_ready: false,
    chat_ready: false,
    audio_offset_seconds: 0,
    chat_offset_seconds: chatOffsetSeconds,
    synchronized: true,
  };
}

// ---------------------------------------------------------------------------
// ClipForge 2.0 Phase 3: Offline Multi-Modal Intelligence Engine (Specs 007 - 010)
// ---------------------------------------------------------------------------

export interface ChatEvent {
  id: string;
  start_time: number;
  end_time: number;
  peak_time: number;
  peak_velocity: number;
  message_count: number;
  sentiment_label: string; // "Hype" | "Humor" | "Shock" | "Chat Surge"
  top_keywords: string[];
  score: number;
}

export interface ChatAnalysisResult {
  total_events: number;
  average_velocity: number;
  peak_velocity: number;
  events: ChatEvent[];
}

export interface AudioEvent {
  id: string;
  start_time: number;
  end_time: number;
  peak_time: number;
  peak_rms_energy: number;
  peak_dbfs: number;
  transient_jump_db: number;
  classification: string;
  score: number;
}

export interface AudioAnalysisResult {
  total_events: number;
  average_rms: number;
  peak_rms: number;
  events: AudioEvent[];
}

export interface VideoEvent {
  id: string;
  timestamp: number;
  scene_score: number;
  event_type: string;
  score: number;
}

export interface VideoAnalysisResult {
  total_events: number;
  events: VideoEvent[];
}

export interface SynchronizedMoment {
  id: string;
  timestamp: number;
  lead_in: number;
  lead_out: number;
  duration: number;
  confidence: number;
  headline: string;
  sentiment: string;
  has_chat_spike: boolean;
  has_audio_peak: boolean;
  has_visual_cut: boolean;
  top_keywords: string[];
}

export interface SynchronizedAnalysisResult {
  project_dir: string;
  total_moments: number;
  moments: SynchronizedMoment[];
  chat_analysis?: ChatAnalysisResult | null;
  audio_analysis?: AudioAnalysisResult | null;
  video_analysis?: VideoAnalysisResult | null;
}

export interface StreamAnalysisProgressPayload {
  stage: string;
  percent: number;
  message: string;
}

/**
 * Runs the complete multi-modal offline intelligence pipeline (Specs 007 - 010)
 */
export async function runStreamIntelligence(
  projectDir: string
): Promise<SynchronizedAnalysisResult> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<SynchronizedAnalysisResult>("run_stream_intelligence", {
      projectDir,
    });
  }
  return {
    project_dir: projectDir,
    total_moments: 0,
    moments: [],
  };
}

/**
 * Loads pre-computed stream analysis and synchronized moments from disk.
 */
export async function loadStreamIntelligence(
  projectDir: string
): Promise<SynchronizedAnalysisResult> {
  if (isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<SynchronizedAnalysisResult>("load_stream_intelligence", {
      projectDir,
    });
  }
  return {
    project_dir: projectDir,
    total_moments: 0,
    moments: [],
  };
}

export {
  coreAddManualClip,
  coreRemoveManualClip,
  coreToggleManualClip
};
