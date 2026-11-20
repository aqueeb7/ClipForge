use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::OnceLock;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GpuEncoderInfo {
    pub encoder: String,
    pub name: String,
    pub is_hardware: bool,
    pub description: String,
}

static CACHED_GPU_INFO: OnceLock<GpuEncoderInfo> = OnceLock::new();

pub fn probe_encoder(name: &str) -> bool {
    let output = Command::new("ffmpeg")
        .args([
            "-nostdin",
            "-v",
            "quiet",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=256x256:d=0.05",
            "-c:v",
            name,
            "-f",
            "null",
            "-",
        ])
        .output();

    if let Ok(out) = output {
        out.status.success()
    } else {
        false
    }
}

pub fn get_gpu_encoder_info() -> &'static GpuEncoderInfo {
    CACHED_GPU_INFO.get_or_init(|| {
        // Priority 1: NVIDIA NVENC
        if probe_encoder("h264_nvenc") {
            return GpuEncoderInfo {
                encoder: "h264_nvenc".to_string(),
                name: "NVIDIA NVENC".to_string(),
                is_hardware: true,
                description: "Hardware Accelerated (NVIDIA CUDA / NVENC)".to_string(),
            };
        }

        // Priority 2: Intel QuickSync (QSV)
        if probe_encoder("h264_qsv") {
            return GpuEncoderInfo {
                encoder: "h264_qsv".to_string(),
                name: "Intel QuickSync".to_string(),
                is_hardware: true,
                description: "Hardware Accelerated (Intel QSV)".to_string(),
            };
        }

        // Priority 3: AMD AMF
        if probe_encoder("h264_amf") {
            return GpuEncoderInfo {
                encoder: "h264_amf".to_string(),
                name: "AMD AMF".to_string(),
                is_hardware: true,
                description: "Hardware Accelerated (AMD Radeon AMF)".to_string(),
            };
        }

        // Priority 4: Apple VideoToolbox
        if probe_encoder("h264_videotoolbox") {
            return GpuEncoderInfo {
                encoder: "h264_videotoolbox".to_string(),
                name: "Apple VideoToolbox".to_string(),
                is_hardware: true,
                description: "Hardware Accelerated (Apple Silicon)".to_string(),
            };
        }

        // Priority 5: Fallback to Multi-threaded CPU libx264
        GpuEncoderInfo {
            encoder: "libx264".to_string(),
            name: "CPU (x264)".to_string(),
            is_hardware: false,
            description: "Software CPU (Multi-threaded AVX2/SIMD)".to_string(),
        }
    })
}
