export const DEFAULT_CANVAS_WIDTH = 1080;
export const DEFAULT_CANVAS_HEIGHT = 1920;
export const DEFAULT_ASPECT_RATIO = "9:16";

export const DEFAULT_FRAME_RATE = 60;
export const DEFAULT_CLIP_DURATION = 60; // seconds
export const DEFAULT_MIN_FINAL_CLIP_DURATION = 5; // seconds
export const DEFAULT_AUDIO_BITRATE = "192k";
export const DEFAULT_VIDEO_CRF = 21;
export const DEFAULT_PRESET = "veryfast";
export const DEFAULT_PIXEL_FORMAT = "yuv420p";

export const DEFAULT_NAMING_PATTERN = "{project}_{episode}_{title}";

export const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".mkv", ".webm"] as const;
export const SUPPORTED_AUDIO_EXTENSIONS = [
  ".wav",
  ".mp3",
  ".aac",
  ".m4a",
  ".flac",
  ".ogg",
  ".weba",
  ".opus",
  ".wma",
  ".mka"
] as const;

export const KNOWN_HARDWARE_ENCODERS = {
  NVENC_H264: "h264_nvenc",
  NVENC_HEVC: "hevc_nvenc",
  QSV_H264: "h264_qsv",
  QSV_HEVC: "hevc_qsv",
  AMF_H264: "h264_amf",
  AMF_HEVC: "hevc_amf"
} as const;
