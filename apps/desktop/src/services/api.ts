import type {
  ClipForgeProject,
  ClipManifest,
  Clip
} from "@clipforge/shared";
import { ClipForgeProjectSchema } from "@clipforge/shared";
import { generateAutomaticClips } from "@clipforge/core/dist/clips/planner.js";
import {
  generateManualClips,
  addManualClip as coreAddManualClip,
  removeManualClip as coreRemoveManualClip,
  toggleManualClip as coreToggleManualClip
} from "@clipforge/core/dist/clips/manual.js";
import { createDefaultProject, type CreateProjectOptions } from "@clipforge/core/dist/projects/defaults.js";

export interface EnvironmentInfo {
  ready: boolean;
  os: string;
  message: string;
  ffmpegFound: boolean;
  ffprobeFound: boolean;
}

export interface MediaMetadata {
  path: string;
  durationSeconds: number;
  width?: number;
  height?: number;
  fps?: number;
  codec: string;
  hasAudio: boolean;
  aspectRatio: string;
}

export interface RenderClipRequest {
  clip_id?: string;
  video_path: string;
  audio_path?: string;
  audio_offset_ms?: number;
  start_seconds: number;
  duration_seconds: number;
  output_path: string;
  mode: string;
  bg_color?: string;
  crf?: number;
  preset?: string;
  overlay_enabled?: boolean;
  brand_title?: string;
  episode_label?: string;
  episode_index?: number;
}

export interface RenderProgressPayload {
  clip_id?: string;
  output_path: string;
  progress: number;
  fps: number;
  speed: string;
  eta_seconds?: number | null;
}

export interface RenderClipResponse {
  success: boolean;
  output_path: string;
  duration_seconds: number;
  file_size_bytes: number;
  error?: string;
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
 * Checks system diagnostics (FFmpeg, FFprobe, OS).
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
      }>("get_app_info");
      return {
        ready: res.ready,
        os: res.os,
        message: res.message,
        ffmpegFound: res.ffmpeg_found,
        ffprobeFound: res.ffprobe_found
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
    ffprobeFound: true
  };
}

/**
 * Inspects a source video/audio file.
 */
export async function inspectSource(filePath: string): Promise<MediaMetadata> {
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
        width: res.width,
        height: res.height,
        fps: res.fps,
        codec: res.codec,
        hasAudio: res.has_audio,
        aspectRatio: res.aspect_ratio
      };
    } catch (err) {
      console.warn("Tauri inspect_media failed:", err);
    }
  }

  return {
    path: filePath,
    durationSeconds: 120,
    width: 1920,
    height: 1080,
    fps: 60,
    codec: "h264",
    hasAudio: true,
    aspectRatio: "16:9"
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
export function initProject(options: CreateProjectOptions): ClipForgeProject {
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
  const result = ClipForgeProjectSchema.safeParse(project);
  if (result.success) {
    return { success: true, project: result.data };
  } else {
    return {
      success: false,
      errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    };
  }
}

/**
 * Plans clips for the project manifest.
 */
export function planProjectClips(project: ClipForgeProject): ClipManifest {
  const namingPattern = project.export.namingPattern || "{project}_{episode}_{title}";
  let clips: Clip[] = [];

  if (project.clipSettings.mode === "automatic") {
    clips = generateAutomaticClips(
      project.clipSettings,
      project.sources.video.durationSeconds,
      project.id,
      project.name,
      namingPattern
    );
  } else {
    clips = generateManualClips(
      project.clipSettings,
      project.sources.video.durationSeconds,
      project.id,
      project.name,
      namingPattern
    );
  }

  return {
    projectId: project.id,
    projectName: project.name,
    totalClips: clips.length,
    generatedAt: new Date().toISOString(),
    clips
  };
}

export {
  coreAddManualClip,
  coreRemoveManualClip,
  coreToggleManualClip
};
