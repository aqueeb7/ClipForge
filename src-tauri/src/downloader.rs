use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};

static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamProjectLayout {
    pub project_dir: String,
    pub source_dir: String,
    pub normalized_dir: String,
    pub analysis_dir: String,
    pub highlights_dir: String,
    pub clips_dir: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamFormatOption {
    pub format_id: String,
    pub ext: String,
    pub resolution: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub filesize_approx: Option<u64>,
    pub is_video: bool,
    pub is_audio: bool,
    pub quality_label: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamUrlInspection {
    pub url: String,
    pub title: String,
    pub channel: String,
    pub duration_seconds: f64,
    pub thumbnail_url: Option<String>,
    pub has_chat_replay: bool,
    pub video_formats: Vec<StreamFormatOption>,
    pub audio_formats: Vec<StreamFormatOption>,
    pub recommended_video_id: String,
    pub recommended_audio_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamDownloadRequest {
    pub url: String,
    pub project_dir: String,
    pub video_format_id: String,
    pub audio_format_id: String,
    pub download_chat: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamDownloadProgressPayload {
    pub stage: String, // "inspecting" | "video" | "audio" | "chat" | "complete" | "error"
    pub percentage: f64,
    pub speed: String,
    pub eta: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamDownloadResult {
    pub success: bool,
    pub video_path: Option<String>,
    pub audio_path: Option<String>,
    pub chat_path: Option<String>,
    pub metadata_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NormalizedChatMessage {
    pub offset_ms: i64,
    pub timestamp_usec: Option<i64>,
    pub author: String,
    pub message: String,
    pub badges: Vec<String>,
}

pub fn resolve_ytdlp_binary() -> Result<PathBuf, String> {
    let exe_name = if cfg!(target_os = "windows") { "yt-dlp.exe" } else { "yt-dlp" };

    // 1. Check relative to current working dir bin/
    if let Ok(cwd) = std::env::current_dir() {
        let p1 = cwd.join("bin").join(exe_name);
        if p1.exists() {
            return Ok(p1);
        }
        if let Some(parent) = cwd.parent() {
            let p2 = parent.join("bin").join(exe_name);
            if p2.exists() {
                return Ok(p2);
            }
        }
    }

    // 2. Check relative to current executable dir
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(dir) = exe_path.parent() {
            let p = dir.join(exe_name);
            if p.exists() {
                return Ok(p);
            }
            let p_bin = dir.join("bin").join(exe_name);
            if p_bin.exists() {
                return Ok(p_bin);
            }
        }
    }

    // 3. Check system PATH
    let path_output = Command::new(exe_name).arg("--version").output();
    if let Ok(out) = path_output {
        if out.status.success() {
            return Ok(PathBuf::from(exe_name));
        }
    }

    Err(format!(
        "{} was not found in ./bin or system PATH. Please ensure the binary is installed in bin/.",
        exe_name
    ))
}

pub fn cancel_download_internal() {
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);
}

pub fn init_stream_project_internal(
    base_dir: &str,
    project_name: &str,
) -> Result<StreamProjectLayout, String> {
    let root = Path::new(base_dir).join(project_name);
    let source_dir = root.join("source");
    let normalized_dir = root.join("normalized");
    let analysis_dir = root.join("analysis");
    let highlights_dir = root.join("highlights");
    let clips_dir = highlights_dir.join("clips");

    std::fs::create_dir_all(&source_dir)
        .map_err(|e| format!("Failed to create source directory: {}", e))?;
    std::fs::create_dir_all(&normalized_dir)
        .map_err(|e| format!("Failed to create normalized directory: {}", e))?;
    std::fs::create_dir_all(&analysis_dir)
        .map_err(|e| format!("Failed to create analysis directory: {}", e))?;
    std::fs::create_dir_all(&clips_dir)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;

    let project_manifest = serde_json::json!({
        "id": format!("stream_proj_{}", project_name),
        "name": project_name,
        "createdAt": chrono_like_now(),
        "version": "2.0.0",
        "type": "stream_intelligence",
        "paths": {
            "root": root.to_string_lossy(),
            "source": source_dir.to_string_lossy(),
            "normalized": normalized_dir.to_string_lossy(),
            "analysis": analysis_dir.to_string_lossy(),
            "highlights": highlights_dir.to_string_lossy(),
            "clips": clips_dir.to_string_lossy()
        }
    });

    let manifest_file = root.join("project.json");
    std::fs::write(&manifest_file, serde_json::to_string_pretty(&project_manifest).unwrap())
        .map_err(|e| format!("Failed to write project manifest: {}", e))?;

    Ok(StreamProjectLayout {
        project_dir: root.to_string_lossy().to_string(),
        source_dir: source_dir.to_string_lossy().to_string(),
        normalized_dir: normalized_dir.to_string_lossy().to_string(),
        analysis_dir: analysis_dir.to_string_lossy().to_string(),
        highlights_dir: highlights_dir.to_string_lossy().to_string(),
        clips_dir: clips_dir.to_string_lossy().to_string(),
    })
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}.{}", now.as_secs(), now.subsec_millis())
}

pub fn inspect_stream_url_internal(url: &str) -> Result<StreamUrlInspection, String> {
    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err("Stream URL cannot be empty".to_string());
    }

    if !clean_url.contains("youtube.com/") && !clean_url.contains("youtu.be/") {
        return Err("Currently only YouTube livestream and video URLs are supported.".to_string());
    }

    let ytdlp = resolve_ytdlp_binary()?;

    let output = Command::new(&ytdlp)
        .args([
            "--dump-json",
            "--no-playlist",
            "--no-warnings",
            clean_url,
        ])
        .output()
        .map_err(|e| format!("Failed to execute yt-dlp inspector: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("URL inspection failed: {}", err_msg.trim()));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let json_val: serde_json::Value = serde_json::from_str(&stdout_str)
        .map_err(|e| format!("Failed to parse stream metadata JSON: {}", e))?;

    let title = json_val.get("title").and_then(|v| v.as_str()).unwrap_or("Livestream").to_string();
    let channel = json_val.get("channel").or_else(|| json_val.get("uploader")).and_then(|v| v.as_str()).unwrap_or("Unknown Streamer").to_string();
    let duration_seconds = json_val.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let thumbnail_url = json_val.get("thumbnail").and_then(|v| v.as_str()).map(|s| s.to_string());

    // Check if live chat replay is available in subtitles or automatic_captions
    let mut has_chat_replay = false;
    if let Some(subtitles) = json_val.get("subtitles").and_then(|v| v.as_object()) {
        if subtitles.contains_key("live_chat") {
            has_chat_replay = true;
        }
    }
    if !has_chat_replay {
        if let Some(auto_subs) = json_val.get("automatic_captions").and_then(|v| v.as_object()) {
            if auto_subs.contains_key("live_chat") {
                has_chat_replay = true;
            }
        }
    }

    let raw_formats = json_val.get("formats").and_then(|v| v.as_array());
    let mut video_formats: Vec<StreamFormatOption> = Vec::new();
    let mut audio_formats: Vec<StreamFormatOption> = Vec::new();

    if let Some(formats) = raw_formats {
        for f in formats {
            let fid = match f.get("format_id").and_then(|v| v.as_str()) {
                Some(id) => id.to_string(),
                None => continue,
            };
            let ext = f.get("ext").and_then(|v| v.as_str()).unwrap_or("mp4").to_string();
            let vcodec = f.get("vcodec").and_then(|v| v.as_str()).map(|s| s.to_string());
            let acodec = f.get("acodec").and_then(|v| v.as_str()).map(|s| s.to_string());
            let height = f.get("height").and_then(|v| v.as_u64()).map(|v| v as u32);
            let width = f.get("width").and_then(|v| v.as_u64()).map(|v| v as u32);
            let fps = f.get("fps").and_then(|v| v.as_f64());
            let filesize = f.get("filesize").or_else(|| f.get("filesize_approx")).and_then(|v| v.as_u64());

            let is_v = vcodec.as_deref().unwrap_or("none") != "none";
            let is_a = acodec.as_deref().unwrap_or("none") != "none";

            if is_v && !is_a {
                // Video-only track (DASH format)
                let res_label = match height {
                    Some(2160) => "4K (2160p)",
                    Some(1440) => "2K (1440p)",
                    Some(1080) => "1080p",
                    Some(720) => "720p",
                    Some(480) => "480p",
                    Some(h) => &format!("{}p", h),
                    None => "Video",
                };
                let fps_str = if let Some(fps_val) = fps {
                    if fps_val > 45.0 { " 60fps" } else { "" }
                } else {
                    ""
                };
                let quality_label = format!("{} • {}{}", res_label, ext.to_uppercase(), fps_str);

                video_formats.push(StreamFormatOption {
                    format_id: fid,
                    ext,
                    resolution: res_label.to_string(),
                    width,
                    height,
                    fps,
                    vcodec,
                    acodec: None,
                    filesize_approx: filesize,
                    is_video: true,
                    is_audio: false,
                    quality_label,
                });
            } else if is_a && !is_v {
                // Audio-only track
                let abr = f.get("abr").and_then(|v| v.as_f64()).unwrap_or(128.0) as u32;
                let quality_label = format!("Audio ({}kbps • {})", abr, ext.to_uppercase());

                audio_formats.push(StreamFormatOption {
                    format_id: fid,
                    ext,
                    resolution: "Audio".to_string(),
                    width: None,
                    height: None,
                    fps: None,
                    vcodec: None,
                    acodec,
                    filesize_approx: filesize,
                    is_video: false,
                    is_audio: true,
                    quality_label,
                });
            }
        }
    }

    // Sort video formats descending by height, then fps
    video_formats.sort_by(|a, b| {
        let ha = a.height.unwrap_or(0);
        let hb = b.height.unwrap_or(0);
        if ha != hb {
            hb.cmp(&ha)
        } else {
            let fa = (a.fps.unwrap_or(0.0) * 10.0) as i64;
            let fb = (b.fps.unwrap_or(0.0) * 10.0) as i64;
            fb.cmp(&fa)
        }
    });

    // Pick 1440p (2K) as first choice if available, otherwise highest resolution
    let recommended_video = video_formats
        .iter()
        .find(|f| f.height == Some(1440))
        .or_else(|| video_formats.first())
        .map(|f| f.format_id.clone())
        .unwrap_or_else(|| "bestvideo".to_string());

    let recommended_audio = audio_formats
        .iter()
        .find(|f| f.ext == "m4a")
        .or_else(|| audio_formats.first())
        .map(|f| f.format_id.clone())
        .unwrap_or_else(|| "bestaudio".to_string());

    Ok(StreamUrlInspection {
        url: clean_url.to_string(),
        title,
        channel,
        duration_seconds,
        thumbnail_url,
        has_chat_replay,
        video_formats,
        audio_formats,
        recommended_video_id: recommended_video,
        recommended_audio_id: recommended_audio,
    })
}

pub fn download_stream_pipeline<F>(
    req: StreamDownloadRequest,
    mut on_progress: F,
) -> Result<StreamDownloadResult, String>
where
    F: FnMut(StreamDownloadProgressPayload),
{
    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);
    let ytdlp = resolve_ytdlp_binary()?;
    let project_path = Path::new(&req.project_dir);
    let source_dir = project_path.join("source");
    std::fs::create_dir_all(&source_dir)
        .map_err(|e| format!("Failed to create source dir: {}", e))?;

    // 1. Download Video
    on_progress(StreamDownloadProgressPayload {
        stage: "video".to_string(),
        percentage: 0.0,
        speed: "Connecting...".to_string(),
        eta: "--:--".to_string(),
        message: "Starting high-resolution video stream download...".to_string(),
    });

    let video_out_template = source_dir.join("video.%(ext)s").to_string_lossy().to_string();
    let mut video_child = Command::new(&ytdlp)
        .args([
            "-f", &req.video_format_id,
            "--newline",
            "-o", &video_out_template,
            &req.url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start video download: {}", e))?;

    if let Some(stdout) = video_child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
                let _ = video_child.kill();
                return Err("Download cancelled by user".to_string());
            }
            if let Some(payload) = parse_ytdlp_progress(&line, "video") {
                on_progress(payload);
            }
        }
    }

    let video_status = video_child.wait().map_err(|e| format!("Video download error: {}", e))?;
    if !video_status.success() {
        return Err("Video stream download failed".to_string());
    }

    // Locate downloaded video file in source_dir (video.mp4, video.webm, etc.)
    let mut resolved_video = None;
    if let Ok(entries) = std::fs::read_dir(&source_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if let Some(stem) = p.file_stem() {
                if stem == "video" {
                    resolved_video = Some(p.to_string_lossy().to_string());
                    break;
                }
            }
        }
    }

    // 2. Download Dedicated Audio
    on_progress(StreamDownloadProgressPayload {
        stage: "audio".to_string(),
        percentage: 0.0,
        speed: "Connecting...".to_string(),
        eta: "--:--".to_string(),
        message: "Starting separate audio stream download...".to_string(),
    });

    let audio_out_template = source_dir.join("audio.%(ext)s").to_string_lossy().to_string();
    let mut audio_child = Command::new(&ytdlp)
        .args([
            "-f", &req.audio_format_id,
            "--newline",
            "-o", &audio_out_template,
            &req.url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start audio download: {}", e))?;

    if let Some(stdout) = audio_child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
                let _ = audio_child.kill();
                return Err("Download cancelled by user".to_string());
            }
            if let Some(payload) = parse_ytdlp_progress(&line, "audio") {
                on_progress(payload);
            }
        }
    }

    let audio_status = audio_child.wait().map_err(|e| format!("Audio download error: {}", e))?;
    if !audio_status.success() {
        return Err("Audio stream download failed".to_string());
    }

    let mut resolved_audio = None;
    if let Ok(entries) = std::fs::read_dir(&source_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if let Some(stem) = p.file_stem() {
                if stem == "audio" {
                    resolved_audio = Some(p.to_string_lossy().to_string());
                    break;
                }
            }
        }
    }

    // 3. Download Chat Replay (if requested)
    let mut resolved_chat = None;
    if req.download_chat {
        on_progress(StreamDownloadProgressPayload {
            stage: "chat".to_string(),
            percentage: 50.0,
            speed: "--".to_string(),
            eta: "--".to_string(),
            message: "Extracting historical live chat replay...".to_string(),
        });

        let chat_template = source_dir.join("chat").to_string_lossy().to_string();
        let chat_output = Command::new(&ytdlp)
            .args([
                "--skip-download",
                "--write-subs",
                "--sub-langs", "live_chat",
                "-o", &chat_template,
                &req.url,
            ])
            .output();

        if let Ok(out) = chat_output {
            if out.status.success() {
                // Find chat.live_chat.json and parse it into normalized chat.json
                let raw_chat_file = source_dir.join("chat.live_chat.json");
                if raw_chat_file.exists() {
                    let normalized_chat = source_dir.join("chat.json");
                    let _ = normalize_live_chat_file(&raw_chat_file, &normalized_chat);
                    resolved_chat = Some(normalized_chat.to_string_lossy().to_string());
                }
            }
        }
    }

    // 4. Save metadata summary
    let metadata_path = source_dir.join("metadata.json");
    let summary = serde_json::json!({
        "url": req.url,
        "videoFormat": req.video_format_id,
        "audioFormat": req.audio_format_id,
        "videoPath": resolved_video,
        "audioPath": resolved_audio,
        "chatPath": resolved_chat,
        "downloadedAt": chrono_like_now()
    });
    let _ = std::fs::write(&metadata_path, serde_json::to_string_pretty(&summary).unwrap());

    on_progress(StreamDownloadProgressPayload {
        stage: "complete".to_string(),
        percentage: 100.0,
        speed: "Done".to_string(),
        eta: "00:00".to_string(),
        message: "Stream assets successfully downloaded and indexed into project.".to_string(),
    });

    Ok(StreamDownloadResult {
        success: true,
        video_path: resolved_video,
        audio_path: resolved_audio,
        chat_path: resolved_chat,
        metadata_path: Some(metadata_path.to_string_lossy().to_string()),
        error: None,
    })
}

fn parse_ytdlp_progress(line: &str, stage: &str) -> Option<StreamDownloadProgressPayload> {
    if !line.contains("[download]") {
        return None;
    }

    // Example line: [download]  45.2% of ~ 150.00MiB at  4.50MiB/s ETA 00:18
    let parts: Vec<&str> = line.split_whitespace().collect();
    let mut percentage = 0.0;
    let mut speed = "--".to_string();
    let mut eta = "--:--".to_string();

    for (i, p) in parts.iter().enumerate() {
        if p.ends_with('%') {
            if let Ok(val) = p.trim_end_matches('%').parse::<f64>() {
                percentage = val;
            }
        }
        if *p == "at" && i + 1 < parts.len() {
            speed = parts[i + 1].to_string();
        }
        if *p == "ETA" && i + 1 < parts.len() {
            eta = parts[i + 1].to_string();
        }
    }

    Some(StreamDownloadProgressPayload {
        stage: stage.to_string(),
        percentage,
        speed,
        eta,
        message: format!("Downloading {} ({:.1}%)", stage, percentage),
    })
}

fn normalize_live_chat_file(raw_path: &Path, output_path: &Path) -> Result<(), String> {
    let file = std::fs::File::open(raw_path)
        .map_err(|e| format!("Failed to open raw chat replay: {}", e))?;
    let reader = BufReader::new(file);

    let mut messages: Vec<NormalizedChatMessage> = Vec::new();

    for line in reader.lines().flatten() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
            if let Some(action) = val.get("replayChatItemAction") {
                if let Some(actions) = action.get("actions").and_then(|v| v.as_array()) {
                    for a in actions {
                        if let Some(add_item) = a.get("addChatItemAction").and_then(|v| v.get("item")) {
                            if let Some(renderer) = add_item.get("liveChatTextMessageRenderer") {
                                let author = renderer
                                    .get("authorName")
                                    .and_then(|v| v.get("simpleText"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Anonymous")
                                    .to_string();

                                let mut text = String::new();
                                if let Some(runs) = renderer.get("message").and_then(|v| v.get("runs")).and_then(|v| v.as_array()) {
                                    for r in runs {
                                        if let Some(t) = r.get("text").and_then(|v| v.as_str()) {
                                            text.push_str(t);
                                        }
                                    }
                                }

                                let offset_ms = action
                                    .get("videoOffsetTimeMsec")
                                    .and_then(|v| v.as_str())
                                    .and_then(|v| v.parse::<i64>().ok())
                                    .unwrap_or(0);

                                messages.push(NormalizedChatMessage {
                                    offset_ms,
                                    timestamp_usec: None,
                                    author,
                                    message: text,
                                    badges: Vec::new(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    messages.sort_by_key(|m| m.offset_ms);

    let json_data = serde_json::to_string_pretty(&messages)
        .map_err(|e| format!("Failed to serialize normalized chat: {}", e))?;

    std::fs::write(output_path, json_data)
        .map_err(|e| format!("Failed to write normalized chat: {}", e))?;

    Ok(())
}
