export type BackgroundMode = "blur" | "solid" | "none";
export type GameplayFitMode = "contain" | "cover" | "crop" | "stretch";
export type ClipMode = "automatic" | "manual";
export type ExportContainer = "mp4" | "mov" | "mkv";
export type VideoCodec = "h264" | "hevc" | "vp9";
export type AudioCodec = "aac" | "mp3" | "opus";
export type VideoPreset = "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" | "medium" | "slow" | "slower" | "veryslow";
export type ExportStructure = "flat" | "dated" | "by-clip" | "nested";
export type FramingTemplate = "blur_fill" | "stacked_split" | "pan_scan" | "split_50_50";

export interface CropRegion {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

export interface StackingSettings {
  template: FramingTemplate;
  topRegion?: CropRegion;
  bottomRegion?: CropRegion;
  cropRegion?: CropRegion;
  topHeightPercent?: number;
}

export interface BackgroundSettings {
  mode: BackgroundMode;
  blurRadius?: number;
  color?: string;
}

export interface GameplaySettings {
  mode: GameplayFitMode;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface OverlaySettings {
  enabled: boolean;
  brandTitle?: string;
  titleX?: number; // 0-100% (default 50)
  titleY?: number; // 0-100% (default 13.5 with logo, 6.5 without)
  titleFontSize?: number; // px on 1080p canvas, 20-72 (default 36)
  episodeLabel?: string;
  episodeY?: number; // 0-100% (default 90)
  showEpisodeNumber?: boolean;
  logoPath?: string;
  logoX?: number; // 0-100% (default 50)
  logoY?: number; // 0-100% (default 5.5)
  logoWidth?: number; // 10-90% of frame width (default 45)
  logoScale?: number;
  logoOffsetY?: number;
}

export interface CompositionSettings {
  width: number;
  height: number;
  background: BackgroundSettings;
  gameplay: GameplaySettings;
  stacking?: StackingSettings;
  overlay: OverlaySettings;
}

export interface MediaSource {
  path: string;
  durationSeconds: number;
  width?: number;
  height?: number;
}

export interface ProjectSources {
  video: MediaSource;
  audio?: MediaSource;
}

export interface SynchronizationSettings {
  audioOffsetMs: number;
}

export interface AutomaticClipSettings {
  mode: "automatic";
  startSeconds: number;
  endSeconds?: number;
  durationSeconds: number;
  overlapSeconds: number;
  minimumFinalClipSeconds: number;
  startingEpisode: number;
}

export interface ManualClipItem {
  start: number;
  end: number;
  title?: string;
  enabled?: boolean;
  framingTemplate?: FramingTemplate;
  stacking?: StackingSettings;
}

export interface ManualClipSettings {
  mode: "manual";
  clips: ManualClipItem[];
}

export type ClipSettings = AutomaticClipSettings | ManualClipSettings;

export interface ExportSettings {
  container: ExportContainer;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  frameRate: number;
  crf: number;
  preset: VideoPreset;
  outputDirectory: string;
  namingPattern: string;
  structure: ExportStructure;
}

export type WorkflowMode = "episodic" | "shorts" | "hybrid";

export interface ShortClipItem {
  id: string;
  title: string;
  start: number;
  end: number;
  duration: number;
  framingTemplate: FramingTemplate;
  stacking?: StackingSettings;
  headerTitle?: string;
  brandTitle?: string;
  source?: "manual" | "intelligence" | "chat_spike";
  confidence?: number;
  outputName?: string;
  status?: "pending" | "rendering" | "completed" | "failed";
  outputPath?: string;
  renderedBytes?: number;
}

export interface ClipForgeProject {
  id: string;
  name: string;
  version: 1;
  workflowMode?: WorkflowMode;
  sources: ProjectSources;
  synchronization: SynchronizationSettings;
  clipSettings: ClipSettings;
  composition: CompositionSettings;
  shorts?: ShortClipItem[];
  export: ExportSettings;
}

export interface Clip {
  id: string;
  index: number;
  title: string;
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  enabled: boolean;
  outputName: string;
  status: "pending" | "rendering" | "completed" | "failed";
  progress?: number;
  error?: string;
  framingTemplate?: FramingTemplate;
  stacking?: StackingSettings;
}

export interface ClipManifest {
  projectId: string;
  projectName: string;
  totalClips: number;
  generatedAt: string;
  clips: Clip[];
}

export interface StreamSummary {
  path: string;
  durationSeconds: number;
  duration_seconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  codec: string;
  hasAudio: boolean;
  has_audio?: boolean;
  aspectRatio: string;
  aspect_ratio?: string;
  format?: string;
}

export type MediaMetadata = StreamSummary;

export interface GpuEncoderInfo {
  encoder: string;
  name: string;
  is_hardware: boolean;
  description: string;
}

export interface PhysicalGpuDevice {
  name: string;
  vendor: "NVIDIA" | "Intel" | "AMD" | "Apple" | "Other" | string;
  memory_mb: number;
  is_discrete: boolean;
  driver_version?: string;
  cuda_supported: boolean;
  cuda_version?: string;
}

export interface EngineOption {
  id: string;
  name: string;
  category: "decoder" | "encoder" | "inference" | string;
  device_name: string;
  is_hardware: boolean;
  is_available: boolean;
  is_recommended: boolean;
  description: string;
}

export interface TriEngineHardwareProfile {
  devices: PhysicalGpuDevice[];
  active_decoder: EngineOption;
  available_decoders: EngineOption[];
  active_encoder: EngineOption;
  available_encoders: EngineOption[];
  active_inference: EngineOption;
  available_inference: EngineOption[];
  summary: string;
}

export interface AppDiagnostic {
  ready: bool_or_boolean;
  os: string;
  message: string;
  ffmpeg_found: bool_or_boolean;
  ffprobe_found: bool_or_boolean;
  gpu?: GpuEncoderInfo;
}

type bool_or_boolean = boolean;

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
  top_crop_x?: number;
  top_crop_y?: number;
  top_crop_w?: number;
  top_crop_h?: number;
  bot_crop_x?: number;
  bot_crop_y?: number;
  bot_crop_w?: number;
  bot_crop_h?: number;
  pan_crop_x?: number;
  top_height_pct?: number;
  logo_path?: string;
  logo_x?: number;
  logo_y?: number;
  logo_width_pct?: number;
  logo_scale?: number;
  logo_offset_y?: number;
  title_x?: number;
  title_y?: number;
  title_font_size?: number;
  episode_y?: number;
}

export interface RenderProgressPayload {
  clip_id?: string;
  output_path: string;
  progress: number;
  fps: number;
  speed: string;
  eta_seconds?: number;
}

export interface RenderClipResponse {
  success: boolean;
  output_path: string;
  duration_seconds: number;
  file_size_bytes: number;
  error?: string;
}

export const DEFAULT_CANVAS_WIDTH = 1080;
export const DEFAULT_CANVAS_HEIGHT = 1920;
export const DEFAULT_CLIP_DURATION = 60;
export const DEFAULT_FRAME_RATE = 60;
export const DEFAULT_VIDEO_CRF = 21;
export const DEFAULT_PRESET: VideoPreset = "veryfast";
export const DEFAULT_NAMING_PATTERN = "{project}_{episode}";
