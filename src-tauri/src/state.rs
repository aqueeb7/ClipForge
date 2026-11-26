use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32};
use std::sync::Arc;

pub struct RenderManager {
    pub current_pid: Arc<AtomicU32>,
    pub cancelled: Arc<AtomicBool>,
}

impl Default for RenderManager {
    fn default() -> Self {
        Self {
            current_pid: Arc::new(AtomicU32::new(0)),
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StreamSummary {
    pub path: String,
    pub duration_seconds: f64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub codec: String,
    pub has_audio: bool,
    pub aspect_ratio: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct RenderClipRequest {
    pub clip_id: Option<String>,
    pub video_path: String,
    pub audio_path: Option<String>,
    pub audio_offset_ms: Option<i64>,
    pub start_seconds: f64,
    pub duration_seconds: f64,
    pub output_path: String,
    pub mode: String,
    pub bg_color: Option<String>,
    pub crf: Option<u32>,
    pub preset: Option<String>,
    pub overlay_enabled: Option<bool>,
    pub brand_title: Option<String>,
    pub episode_label: Option<String>,
    pub episode_index: Option<u32>,
    pub top_crop_x: Option<f64>,
    pub top_crop_y: Option<f64>,
    pub top_crop_w: Option<f64>,
    pub top_crop_h: Option<f64>,
    pub bot_crop_x: Option<f64>,
    pub bot_crop_y: Option<f64>,
    pub bot_crop_w: Option<f64>,
    pub bot_crop_h: Option<f64>,
    pub pan_crop_x: Option<f64>,
    pub top_height_pct: Option<f64>,
    pub logo_path: Option<String>,
    pub logo_scale: Option<f64>,
    pub logo_offset_y: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RenderProgressPayload {
    pub clip_id: Option<String>,
    pub output_path: String,
    pub progress: f64,
    pub fps: f64,
    pub speed: String,
    pub eta_seconds: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RenderClipResponse {
    pub success: bool,
    pub output_path: String,
    pub duration_seconds: f64,
    pub file_size_bytes: u64,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppDiagnostic {
    pub ready: bool,
    pub os: String,
    pub message: String,
    pub ffmpeg_found: bool,
    pub ffprobe_found: bool,
    pub gpu: Option<super::gpu::GpuEncoderInfo>,
}
