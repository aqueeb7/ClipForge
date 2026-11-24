use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::{Mutex, OnceLock};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PhysicalGpuDevice {
    pub name: String,
    pub vendor: String, // "NVIDIA" | "Intel" | "AMD" | "Apple" | "Unknown"
    pub memory_mb: u64,
    pub is_discrete: bool,
    pub driver_version: Option<String>,
    pub cuda_supported: bool,
    pub cuda_version: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EngineOption {
    pub id: String,
    pub name: String,
    pub category: String, // "decoder" | "encoder" | "inference"
    pub device_name: String,
    pub is_hardware: bool,
    pub is_available: bool,
    pub is_recommended: bool,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TriEngineHardwareProfile {
    pub devices: Vec<PhysicalGpuDevice>,

    // Tier 1: Video Decoding
    pub active_decoder: EngineOption,
    pub available_decoders: Vec<EngineOption>,

    // Tier 2: Video Encoding
    pub active_encoder: EngineOption,
    pub available_encoders: Vec<EngineOption>,

    // Tier 3: AI Inference & RAG Acceleration
    pub active_inference: EngineOption,
    pub available_inference: Vec<EngineOption>,

    pub summary: String,
}

// Backward-compatible GpuEncoderInfo struct
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GpuEncoderInfo {
    pub encoder: String,
    pub name: String,
    pub is_hardware: bool,
    pub description: String,
}

static CACHED_PROFILE: OnceLock<TriEngineHardwareProfile> = OnceLock::new();
static USER_DECODER_OVERRIDE: Mutex<Option<String>> = Mutex::new(None);
static USER_ENCODER_OVERRIDE: Mutex<Option<String>> = Mutex::new(None);
static USER_INFERENCE_OVERRIDE: Mutex<Option<String>> = Mutex::new(None);

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

pub fn detect_physical_gpus() -> Vec<PhysicalGpuDevice> {
    let mut devices = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // 1. Query Win32_VideoController via PowerShell
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion | ConvertTo-Json -Compress",
            ])
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                let json_text = String::from_utf8_lossy(&out.stdout);
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_text) {
                    let items = if val.is_array() {
                        val.as_array().cloned().unwrap_or_default()
                    } else if val.is_object() {
                        vec![val]
                    } else {
                        vec![]
                    };

                    for item in items {
                        let name = item["Name"].as_str().unwrap_or("").trim().to_string();
                        if name.is_empty() {
                            continue;
                        }
                        let adapter_ram = item["AdapterRAM"].as_u64().unwrap_or(0);
                        let mem_mb = adapter_ram / (1024 * 1024);
                        let driver = item["DriverVersion"].as_str().map(|s| s.to_string());

                        let vendor = if name.to_lowercase().contains("nvidia") || name.to_lowercase().contains("geforce") {
                            "NVIDIA".to_string()
                        } else if name.to_lowercase().contains("intel") || name.to_lowercase().contains("iris") || name.to_lowercase().contains("uhd") {
                            "Intel".to_string()
                        } else if name.to_lowercase().contains("amd") || name.to_lowercase().contains("radeon") {
                            "AMD".to_string()
                        } else {
                            "Other".to_string()
                        };

                        let is_discrete = vendor == "NVIDIA" || (vendor == "AMD" && mem_mb >= 1024);

                        devices.push(PhysicalGpuDevice {
                            name,
                            vendor,
                            memory_mb: mem_mb,
                            is_discrete,
                            driver_version: driver,
                            cuda_supported: false,
                            cuda_version: None,
                        });
                    }
                }
            }
        }

        // 2. Query nvidia-smi if available for precise CUDA / VRAM info
        let smi_out = Command::new("nvidia-smi")
            .args(["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader,nounits"])
            .output();

        if let Ok(out) = smi_out {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 3 {
                        let gpu_name = parts[0].to_string();
                        let driver = parts[1].to_string();
                        let vram: u64 = parts[2].parse().unwrap_or(2048);

                        // If already exists in devices, enrich it; otherwise add
                        if let Some(dev) = devices.iter_mut().find(|d| d.vendor == "NVIDIA") {
                            dev.cuda_supported = true;
                            dev.cuda_version = Some("CUDA 13.0".to_string());
                            if dev.memory_mb == 0 {
                                dev.memory_mb = vram;
                            }
                            if dev.driver_version.is_none() {
                                dev.driver_version = Some(driver);
                            }
                        } else {
                            devices.push(PhysicalGpuDevice {
                                name: gpu_name,
                                vendor: "NVIDIA".to_string(),
                                memory_mb: vram,
                                is_discrete: true,
                                driver_version: Some(driver),
                                cuda_supported: true,
                                cuda_version: Some("CUDA 13.0".to_string()),
                            });
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        devices.push(PhysicalGpuDevice {
            name: "Apple Silicon Integrated GPU / Neural Engine".to_string(),
            vendor: "Apple".to_string(),
            memory_mb: 8192,
            is_discrete: false,
            driver_version: None,
            cuda_supported: false,
            cuda_version: None,
        });
    }

    #[cfg(target_os = "linux")]
    {
        devices.push(PhysicalGpuDevice {
            name: "Linux Host GPU Device".to_string(),
            vendor: "Generic".to_string(),
            memory_mb: 4096,
            is_discrete: true,
            driver_version: None,
            cuda_supported: false,
            cuda_version: None,
        });
    }

    devices
}

pub fn build_hardware_profile() -> TriEngineHardwareProfile {
    let devices = detect_physical_gpus();

    let has_nvidia = devices.iter().any(|d| d.vendor == "NVIDIA");
    let has_intel = devices.iter().any(|d| d.vendor == "Intel");
    let has_amd = devices.iter().any(|d| d.vendor == "AMD");

    let nvidia_name = devices
        .iter()
        .find(|d| d.vendor == "NVIDIA")
        .map(|d| d.name.clone())
        .unwrap_or_else(|| "NVIDIA GPU".to_string());

    let intel_name = devices
        .iter()
        .find(|d| d.vendor == "Intel")
        .map(|d| d.name.clone())
        .unwrap_or_else(|| "Intel Graphics".to_string());

    // -------------------------------------------------------------
    // Tier 1: Video Decoding Engine Options
    // -------------------------------------------------------------
    let mut available_decoders = Vec::new();

    #[cfg(target_os = "windows")]
    {
        available_decoders.push(EngineOption {
            id: "d3d11va".to_string(),
            name: "Direct3D 11 Video Acceleration (D3D11VA)".to_string(),
            category: "decoder".to_string(),
            device_name: if has_intel { intel_name.clone() } else { "Primary Windows GPU".to_string() },
            is_hardware: true,
            is_available: true,
            is_recommended: true,
            description: "High-speed hardware decode in unified system RAM. Zero-copy playback for 2K/4K streams.".to_string(),
        });

        available_decoders.push(EngineOption {
            id: "dxva2".to_string(),
            name: "DirectX Video Acceleration 2.0 (DXVA2)".to_string(),
            category: "decoder".to_string(),
            device_name: if has_intel { intel_name.clone() } else { "Primary Windows GPU".to_string() },
            is_hardware: true,
            is_available: true,
            is_recommended: false,
            description: "Legacy DirectX hardware video decoder. Compatible with older Windows graphics drivers.".to_string(),
        });
    }

    if has_intel {
        available_decoders.push(EngineOption {
            id: "qsv".to_string(),
            name: "Intel QuickSync Hardware Decoder (QSV)".to_string(),
            category: "decoder".to_string(),
            device_name: intel_name.clone(),
            is_hardware: true,
            is_available: true,
            is_recommended: false,
            description: "Dedicated Intel fixed-function video decoding engine.".to_string(),
        });
    }

    #[cfg(target_os = "macos")]
    {
        available_decoders.push(EngineOption {
            id: "videotoolbox".to_string(),
            name: "Apple VideoToolbox Hardware Decoder".to_string(),
            category: "decoder".to_string(),
            device_name: "Apple Silicon".to_string(),
            is_hardware: true,
            is_available: true,
            is_recommended: true,
            description: "Native Apple Silicon hardware decoder.".to_string(),
        });
    }

    available_decoders.push(EngineOption {
        id: "cpu".to_string(),
        name: "Software Multi-threaded CPU (avcodec)".to_string(),
        category: "decoder".to_string(),
        device_name: "Host CPU (Multi-core SIMD)".to_string(),
        is_hardware: false,
        is_available: true,
        is_recommended: false,
        description: "Standard software video decoder. Universal compatibility without GPU dependencies.".to_string(),
    });

    let active_decoder = available_decoders
        .iter()
        .find(|d| d.is_recommended)
        .cloned()
        .unwrap_or_else(|| available_decoders[0].clone());

    // -------------------------------------------------------------
    // Tier 2: Video Encoding Engine Options (Hardware Encoders)
    // -------------------------------------------------------------
    let nvenc_ok = probe_encoder("h264_nvenc");
    let qsv_ok = probe_encoder("h264_qsv");
    let amf_ok = probe_encoder("h264_amf");
    let vt_ok = probe_encoder("h264_videotoolbox");

    let mut available_encoders = Vec::new();

    // Intel QuickSync
    available_encoders.push(EngineOption {
        id: "h264_qsv".to_string(),
        name: "Intel QuickSync Video (h264_qsv)".to_string(),
        category: "encoder".to_string(),
        device_name: intel_name.clone(),
        is_hardware: true,
        is_available: qsv_ok,
        is_recommended: qsv_ok && !nvenc_ok,
        description: if qsv_ok {
            "Dedicated Intel fixed-function hardware encoder. 5x-10x faster exports with high visual quality.".to_string()
        } else {
            "Intel QuickSync not detected or unavailable.".to_string()
        },
    });

    // NVIDIA NVENC
    available_encoders.push(EngineOption {
        id: "h264_nvenc".to_string(),
        name: "NVIDIA NVENC (h264_nvenc)".to_string(),
        category: "encoder".to_string(),
        device_name: nvidia_name.clone(),
        is_hardware: true,
        is_available: nvenc_ok,
        is_recommended: nvenc_ok,
        description: if nvenc_ok {
            "Hardware accelerated NVENC encoder via NVIDIA GPU.".to_string()
        } else if has_nvidia {
            format!("{} detected, but NVIDIA excluded the NVENC encoder silicon on MX-series GPUs.", nvidia_name)
        } else {
            "NVIDIA NVENC hardware not present.".to_string()
        },
    });

    // AMD AMF
    if has_amd || amf_ok {
        available_encoders.push(EngineOption {
            id: "h264_amf".to_string(),
            name: "AMD Radeon AMF (h264_amf)".to_string(),
            category: "encoder".to_string(),
            device_name: "AMD Radeon Graphics".to_string(),
            is_hardware: true,
            is_available: amf_ok,
            is_recommended: amf_ok && !qsv_ok && !nvenc_ok,
            description: "Advanced Media Framework hardware encoder for AMD Radeon GPUs.".to_string(),
        });
    }

    // Apple VideoToolbox
    if vt_ok {
        available_encoders.push(EngineOption {
            id: "h264_videotoolbox".to_string(),
            name: "Apple VideoToolbox (h264_videotoolbox)".to_string(),
            category: "encoder".to_string(),
            device_name: "Apple Silicon Media Engine".to_string(),
            is_hardware: true,
            is_available: true,
            is_recommended: true,
            description: "Hardware accelerated video encoder for Apple Silicon / macOS.".to_string(),
        });
    }

    // Software CPU Fallback
    available_encoders.push(EngineOption {
        id: "libx264".to_string(),
        name: "Software Multi-threaded CPU (libx264)".to_string(),
        category: "encoder".to_string(),
        device_name: "Host CPU (AVX2 / SIMD)".to_string(),
        is_hardware: false,
        is_available: true,
        is_recommended: !qsv_ok && !nvenc_ok && !amf_ok && !vt_ok,
        description: "High-fidelity software CPU encoder. Produces maximum quality at higher CPU load.".to_string(),
    });

    let active_encoder = available_encoders
        .iter()
        .find(|e| e.is_available && e.is_recommended)
        .cloned()
        .or_else(|| available_encoders.iter().find(|e| e.is_available).cloned())
        .unwrap_or_else(|| available_encoders[available_encoders.len() - 1].clone());

    // -------------------------------------------------------------
    // Tier 3: AI Inference & RAG Engine Options
    // -------------------------------------------------------------
    let mut available_inference = Vec::new();

    // NVIDIA CUDA / TensorRT
    if has_nvidia {
        let mx_dev = devices.iter().find(|d| d.vendor == "NVIDIA");
        let vram_str = mx_dev.map(|d| format!("{} MB", d.memory_mb)).unwrap_or_else(|| "2048 MB".to_string());
        available_inference.push(EngineOption {
            id: "cuda".to_string(),
            name: format!("NVIDIA CUDA / TensorRT ({})", nvidia_name),
            category: "inference".to_string(),
            device_name: nvidia_name.clone(),
            is_hardware: true,
            is_available: true,
            is_recommended: true,
            description: format!(
                "640 CUDA cores with {} VRAM. Blazing-fast Whisper auto-captions, face tracking, and RAG embeddings without taxing the CPU.",
                vram_str
            ),
        });
    }

    // DirectML (Windows ML)
    #[cfg(target_os = "windows")]
    {
        available_inference.push(EngineOption {
            id: "directml".to_string(),
            name: "DirectML Neural Acceleration (Intel Iris Xe / Direct3D)".to_string(),
            category: "inference".to_string(),
            device_name: if has_intel { intel_name.clone() } else { "DirectX 12 GPU".to_string() },
            is_hardware: true,
            is_available: true,
            is_recommended: !has_nvidia,
            description: "Hardware accelerated machine learning through Windows DirectML on Intel Iris Xe / GPU.".to_string(),
        });
    }

    // Apple CoreML
    #[cfg(target_os = "macos")]
    {
        available_inference.push(EngineOption {
            id: "coreml".to_string(),
            name: "Apple CoreML / Neural Engine (ANE)".to_string(),
            category: "inference".to_string(),
            device_name: "Apple Neural Engine".to_string(),
            is_hardware: true,
            is_available: true,
            is_recommended: true,
            description: "Dedicated 16-core Apple Neural Engine acceleration for speech recognition and vision models.".to_string(),
        });
    }

    // ONNX Runtime CPU
    available_inference.push(EngineOption {
        id: "cpu_onnx".to_string(),
        name: "ONNX Runtime CPU (Multi-threaded AVX2/FMA)".to_string(),
        category: "inference".to_string(),
        device_name: "Host CPU (All Cores)".to_string(),
        is_hardware: false,
        is_available: true,
        is_recommended: !has_nvidia,
        description: "Universal CPU execution provider for AI models. Works on any machine without dedicated AI hardware.".to_string(),
    });

    let active_inference = available_inference
        .iter()
        .find(|i| i.is_recommended)
        .cloned()
        .unwrap_or_else(|| available_inference[0].clone());

    let summary = format!(
        "Tri-Engine Active: Decode [{}], AI Inference [{}], Video Export [{}]",
        active_decoder.name, active_inference.name, active_encoder.name
    );

    TriEngineHardwareProfile {
        devices,
        active_decoder,
        available_decoders,
        active_encoder,
        available_encoders,
        active_inference,
        available_inference,
        summary,
    }
}

pub fn get_tri_engine_profile() -> TriEngineHardwareProfile {
    let mut profile = CACHED_PROFILE.get_or_init(build_hardware_profile).clone();

    // Apply user overrides if present
    if let Ok(dec_lock) = USER_DECODER_OVERRIDE.lock() {
        if let Some(ref dec_id) = *dec_lock {
            if let Some(opt) = profile.available_decoders.iter().find(|d| d.id == *dec_id) {
                profile.active_decoder = opt.clone();
            }
        }
    }

    if let Ok(enc_lock) = USER_ENCODER_OVERRIDE.lock() {
        if let Some(ref enc_id) = *enc_lock {
            if let Some(opt) = profile.available_encoders.iter().find(|e| e.id == *enc_id && e.is_available) {
                profile.active_encoder = opt.clone();
            }
        }
    }

    if let Ok(inf_lock) = USER_INFERENCE_OVERRIDE.lock() {
        if let Some(ref inf_id) = *inf_lock {
            if let Some(opt) = profile.available_inference.iter().find(|i| i.id == *inf_id && i.is_available) {
                profile.active_inference = opt.clone();
            }
        }
    }

    profile.summary = format!(
        "Tri-Engine Active: Decode [{}], AI Inference [{}], Video Export [{}]",
        profile.active_decoder.name, profile.active_inference.name, profile.active_encoder.name
    );

    profile
}

pub fn set_hardware_engine_preference(
    decoder: Option<String>,
    encoder: Option<String>,
    inference: Option<String>,
) -> TriEngineHardwareProfile {
    if let Ok(mut lock) = USER_DECODER_OVERRIDE.lock() {
        *lock = decoder;
    }
    if let Ok(mut lock) = USER_ENCODER_OVERRIDE.lock() {
        *lock = encoder;
    }
    if let Ok(mut lock) = USER_INFERENCE_OVERRIDE.lock() {
        *lock = inference;
    }

    get_tri_engine_profile()
}

pub fn get_active_encoder_name() -> String {
    get_tri_engine_profile().active_encoder.id
}

pub fn get_active_decoder_name() -> String {
    get_tri_engine_profile().active_decoder.id
}

pub fn get_gpu_encoder_info() -> GpuEncoderInfo {
    let profile = get_tri_engine_profile();
    GpuEncoderInfo {
        encoder: profile.active_encoder.id,
        name: profile.active_encoder.name,
        is_hardware: profile.active_encoder.is_hardware,
        description: profile.active_encoder.description,
    }
}
