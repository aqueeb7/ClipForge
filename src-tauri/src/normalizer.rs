use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoIndex {
    pub path: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
    pub start_pts: i64,
    pub start_time: f64,
    pub total_frames: u64,
    pub aspect_ratio: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioIndex {
    pub path: String,
    pub duration: f64,
    pub sample_rate: u32,
    pub channels: u32,
    pub codec: String,
    pub start_pts: i64,
    pub start_time: f64,
    pub offset_seconds: f64, // relative to video start_time
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatDensityBucket {
    pub bin_start: f64,
    pub bin_end: f64,
    pub count: u32,
    pub velocity: f64, // messages per second
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NormalizedIndexedMessage {
    pub index: usize,
    pub offset_ms: i64,
    pub time_seconds: f64,
    pub author: String,
    pub message: String,
    pub badges: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSummaryBrief {
    pub total_messages: usize,
    pub duration_seconds: f64,
    pub peak_velocity_msg_per_sec: f64,
    pub average_velocity_msg_per_sec: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatIndex {
    pub total_messages: usize,
    pub start_offset_seconds: f64,
    pub end_offset_seconds: f64,
    pub peak_velocity_msg_per_sec: f64,
    pub average_velocity_msg_per_sec: f64,
    pub density_buckets_5s: Vec<ChatDensityBucket>,
    pub density_buckets_1s: Vec<ChatDensityBucket>,
    pub messages: Vec<NormalizedIndexedMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineSummary {
    pub project_dir: String,
    pub project_timeline_duration: f64,
    pub video_ready: bool,
    pub audio_ready: bool,
    pub chat_ready: bool,
    pub audio_offset_seconds: f64,
    pub chat_offset_seconds: f64,
    pub synchronized: bool,
    pub video_index: Option<VideoIndex>,
    pub audio_index: Option<AudioIndex>,
    pub chat_summary: Option<ChatSummaryBrief>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct RawChatFileItem {
    pub offset_ms: i64,
    pub timestamp_usec: Option<i64>,
    pub author: String,
    pub message: String,
    #[serde(default)]
    pub badges: Vec<String>,
}

fn run_ffprobe_json(file_path: &Path) -> Result<serde_json::Value, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &file_path.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffprobe on {:?}: {}", file_path, e))?;

    if !output.status.success() {
        return Err(format!(
            "ffprobe exited with error for {:?}: {}",
            file_path,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    serde_json::from_slice::<serde_json::Value>(&output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe json output: {}", e))
}

fn index_video_stream(path: &Path) -> Result<VideoIndex, String> {
    let probe = run_ffprobe_json(path)?;

    let streams = probe["streams"]
        .as_array()
        .ok_or_else(|| "No streams found in media".to_string())?;

    let video_stream = streams
        .iter()
        .find(|s| s["codec_type"].as_str() == Some("video"))
        .ok_or_else(|| "No video stream found in file".to_string())?;

    let width = video_stream["width"].as_u64().unwrap_or(1920) as u32;
    let height = video_stream["height"].as_u64().unwrap_or(1080) as u32;
    let codec = video_stream["codec_name"].as_str().unwrap_or("h264").to_string();

    let mut fps = 30.0;
    if let Some(r_fps) = video_stream["r_frame_rate"].as_str() {
        if let Some((n, d)) = r_fps.split_once('/') {
            if let (Ok(num), Ok(den)) = (n.parse::<f64>(), d.parse::<f64>()) {
                if den > 0.0 {
                    fps = (num / den * 100.0).round() / 100.0;
                }
            }
        }
    }

    let mut duration = video_stream["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    if duration <= 0.0 {
        duration = probe["format"]["duration"]
            .as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);
    }

    let start_pts = video_stream["start_pts"]
        .as_i64()
        .or_else(|| {
            video_stream["start_pts"]
                .as_str()
                .and_then(|s| s.parse::<i64>().ok())
        })
        .unwrap_or(0);

    let start_time = video_stream["start_time"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let total_frames = video_stream["nb_frames"]
        .as_str()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or_else(|| (duration * fps).round() as u64);

    let aspect_ratio = format!("{}:{}", width, height);

    Ok(VideoIndex {
        path: path.to_string_lossy().to_string(),
        duration,
        width,
        height,
        fps,
        codec,
        start_pts,
        start_time,
        total_frames,
        aspect_ratio,
    })
}

fn index_audio_stream(path: &Path, video_start_time: f64) -> Result<AudioIndex, String> {
    let probe = run_ffprobe_json(path)?;

    let streams = probe["streams"]
        .as_array()
        .ok_or_else(|| "No streams found in audio file".to_string())?;

    let audio_stream = streams
        .iter()
        .find(|s| s["codec_type"].as_str() == Some("audio"))
        .ok_or_else(|| "No audio stream found in file".to_string())?;

    let sample_rate = audio_stream["sample_rate"]
        .as_str()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(48000);

    let channels = audio_stream["channels"].as_u64().unwrap_or(2) as u32;
    let codec = audio_stream["codec_name"].as_str().unwrap_or("aac").to_string();

    let mut duration = audio_stream["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    if duration <= 0.0 {
        duration = probe["format"]["duration"]
            .as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);
    }

    let start_pts = audio_stream["start_pts"]
        .as_i64()
        .or_else(|| {
            audio_stream["start_pts"]
                .as_str()
                .and_then(|s| s.parse::<i64>().ok())
        })
        .unwrap_or(0);

    let start_time = audio_stream["start_time"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    // Timeline offset: audio_start - video_start
    let offset_seconds = ((start_time - video_start_time) * 1000.0).round() / 1000.0;

    Ok(AudioIndex {
        path: path.to_string_lossy().to_string(),
        duration,
        sample_rate,
        channels,
        codec,
        start_pts,
        start_time,
        offset_seconds,
    })
}

fn index_chat_stream(
    chat_path: &Path,
    duration_seconds: f64,
    chat_offset_seconds: f64,
) -> Result<ChatIndex, String> {
    let content = fs::read_to_string(chat_path)
        .map_err(|e| format!("Failed to read chat file {:?}: {}", chat_path, e))?;

    let raw_messages: Vec<RawChatFileItem> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to deserialize chat messages: {}", e))?;

    if raw_messages.is_empty() {
        return Ok(ChatIndex {
            total_messages: 0,
            start_offset_seconds: 0.0,
            end_offset_seconds: 0.0,
            peak_velocity_msg_per_sec: 0.0,
            average_velocity_msg_per_sec: 0.0,
            density_buckets_5s: Vec::new(),
            density_buckets_1s: Vec::new(),
            messages: Vec::new(),
        });
    }

    let mut indexed_messages: Vec<NormalizedIndexedMessage> = Vec::with_capacity(raw_messages.len());
    let mut min_time = f64::MAX;
    let mut max_time = 0.0f64;

    for (idx, m) in raw_messages.into_iter().enumerate() {
        let time_sec = ((m.offset_ms as f64) / 1000.0) + chat_offset_seconds;
        if time_sec < min_time {
            min_time = time_sec;
        }
        if time_sec > max_time {
            max_time = time_sec;
        }

        indexed_messages.push(NormalizedIndexedMessage {
            index: idx,
            offset_ms: m.offset_ms,
            time_seconds: (time_sec * 1000.0).round() / 1000.0,
            author: m.author,
            message: m.message,
            badges: m.badges,
        });
    }

    indexed_messages.sort_by(|a, b| a.time_seconds.partial_cmp(&b.time_seconds).unwrap());

    // Re-index after sorting
    for (i, m) in indexed_messages.iter_mut().enumerate() {
        m.index = i;
    }

    let timeline_end = duration_seconds.max(max_time).max(1.0);

    // Compute 5-second density buckets
    let bin_size_5s = 5.0;
    let bucket_count_5s = ((timeline_end / bin_size_5s).ceil() as usize).max(1);
    let mut buckets_5s: Vec<ChatDensityBucket> = (0..bucket_count_5s)
        .map(|i| {
            let start = i as f64 * bin_size_5s;
            ChatDensityBucket {
                bin_start: start,
                bin_end: start + bin_size_5s,
                count: 0,
                velocity: 0.0,
            }
        })
        .collect();

    // Compute 1-second density buckets
    let bin_size_1s = 1.0;
    let bucket_count_1s = ((timeline_end / bin_size_1s).ceil() as usize).max(1);
    let mut buckets_1s: Vec<ChatDensityBucket> = (0..bucket_count_1s)
        .map(|i| {
            let start = i as f64 * bin_size_1s;
            ChatDensityBucket {
                bin_start: start,
                bin_end: start + bin_size_1s,
                count: 0,
                velocity: 0.0,
            }
        })
        .collect();

    for m in &indexed_messages {
        if m.time_seconds >= 0.0 && m.time_seconds <= timeline_end {
            let b5 = (m.time_seconds / bin_size_5s) as usize;
            if b5 < buckets_5s.len() {
                buckets_5s[b5].count += 1;
            }

            let b1 = (m.time_seconds / bin_size_1s) as usize;
            if b1 < buckets_1s.len() {
                buckets_1s[b1].count += 1;
            }
        }
    }

    let mut peak_velocity = 0.0f64;
    for b in &mut buckets_5s {
        b.velocity = (b.count as f64) / bin_size_5s;
        if b.velocity > peak_velocity {
            peak_velocity = b.velocity;
        }
    }

    for b in &mut buckets_1s {
        b.velocity = (b.count as f64) / bin_size_1s;
        if b.velocity > peak_velocity {
            peak_velocity = b.velocity;
        }
    }

    let avg_velocity = if timeline_end > 0.0 {
        (indexed_messages.len() as f64) / timeline_end
    } else {
        0.0
    };

    Ok(ChatIndex {
        total_messages: indexed_messages.len(),
        start_offset_seconds: if min_time == f64::MAX { 0.0 } else { (min_time * 100.0).round() / 100.0 },
        end_offset_seconds: (max_time * 100.0).round() / 100.0,
        peak_velocity_msg_per_sec: (peak_velocity * 100.0).round() / 100.0,
        average_velocity_msg_per_sec: (avg_velocity * 100.0).round() / 100.0,
        density_buckets_5s: buckets_5s,
        density_buckets_1s: buckets_1s,
        messages: indexed_messages,
    })
}

fn resolve_source_files(project_dir: &Path) -> (Option<PathBuf>, Option<PathBuf>, Option<PathBuf>) {
    let source_dir = project_dir.join("source");
    let metadata_path = source_dir.join("metadata.json");

    let mut video_path: Option<PathBuf> = None;
    let mut audio_path: Option<PathBuf> = None;
    let mut chat_path: Option<PathBuf> = None;

    if metadata_path.exists() {
        if let Ok(content) = fs::read_to_string(&metadata_path) {
            if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(vp) = meta.get("videoPath").and_then(|v| v.as_str()) {
                    let p = PathBuf::from(vp);
                    if p.exists() {
                        video_path = Some(p);
                    }
                }
                if let Some(ap) = meta.get("audioPath").and_then(|v| v.as_str()) {
                    let p = PathBuf::from(ap);
                    if p.exists() {
                        audio_path = Some(p);
                    }
                }
                if let Some(cp) = meta.get("chatPath").and_then(|v| v.as_str()) {
                    let p = PathBuf::from(cp);
                    if p.exists() {
                        chat_path = Some(p);
                    }
                }
            }
        }
    }

    // Fallback: directory inspection in source/
    if video_path.is_none() {
        for ext in &["mp4", "webm", "mkv", "mov"] {
            let cand = source_dir.join(format!("video.{}", ext));
            if cand.exists() {
                video_path = Some(cand);
                break;
            }
        }
    }

    if audio_path.is_none() {
        for ext in &["m4a", "webm", "opus", "aac", "mp3"] {
            let cand = source_dir.join(format!("audio.{}", ext));
            if cand.exists() {
                audio_path = Some(cand);
                break;
            }
        }
    }

    if chat_path.is_none() {
        let cand = source_dir.join("chat.json");
        if cand.exists() {
            chat_path = Some(cand);
        }
    }

    (video_path, audio_path, chat_path)
}

pub fn normalize_stream_project_internal(
    project_dir_str: &str,
    chat_offset_override: Option<f64>,
) -> Result<TimelineSummary, String> {
    let project_dir = Path::new(project_dir_str);
    if !project_dir.exists() {
        return Err(format!("Project directory does not exist: {}", project_dir_str));
    }

    let normalized_dir = project_dir.join("normalized");
    fs::create_dir_all(&normalized_dir)
        .map_err(|e| format!("Failed to create normalized directory: {}", e))?;

    let (video_file, audio_file, chat_file) = resolve_source_files(project_dir);

    let video_path = video_file
        .ok_or_else(|| "No video source file found in project source directory".to_string())?;

    // 1. Index Video Stream (Spec 005 Video Anchor)
    let video_idx = index_video_stream(&video_path)?;
    let video_index_path = normalized_dir.join("video-index.json");
    fs::write(
        &video_index_path,
        serde_json::to_string_pretty(&video_idx).unwrap(),
    )
    .map_err(|e| format!("Failed to write video-index.json: {}", e))?;

    let project_timeline_duration = video_idx.duration;

    // 2. Index Audio Stream if present
    let mut audio_idx: Option<AudioIndex> = None;
    let mut audio_offset_sec = 0.0;
    if let Some(ref af) = audio_file {
        match index_audio_stream(af, video_idx.start_time) {
            Ok(idx) => {
                audio_offset_sec = idx.offset_seconds;
                let audio_index_path = normalized_dir.join("audio-index.json");
                let _ = fs::write(
                    &audio_index_path,
                    serde_json::to_string_pretty(&idx).unwrap(),
                );
                audio_idx = Some(idx);
            }
            Err(err) => {
                eprintln!("Warning: Audio indexing failed: {}", err);
            }
        }
    }

    // 3. Index Chat Replay Stream if present
    let chat_offset = chat_offset_override.unwrap_or(0.0);
    let mut chat_summary: Option<ChatSummaryBrief> = None;
    let mut chat_ready = false;

    if let Some(ref cf) = chat_file {
        match index_chat_stream(cf, project_timeline_duration, chat_offset) {
            Ok(idx) => {
                chat_summary = Some(ChatSummaryBrief {
                    total_messages: idx.total_messages,
                    duration_seconds: project_timeline_duration,
                    peak_velocity_msg_per_sec: idx.peak_velocity_msg_per_sec,
                    average_velocity_msg_per_sec: idx.average_velocity_msg_per_sec,
                });
                chat_ready = idx.total_messages > 0;

                let chat_index_path = normalized_dir.join("chat-index.json");
                let _ = fs::write(
                    &chat_index_path,
                    serde_json::to_string_pretty(&idx).unwrap(),
                );
            }
            Err(err) => {
                eprintln!("Warning: Chat indexing failed: {}", err);
            }
        }
    }

    // 4. Construct Timeline Summary
    let summary = TimelineSummary {
        project_dir: project_dir_str.to_string(),
        project_timeline_duration,
        video_ready: true,
        audio_ready: audio_idx.is_some(),
        chat_ready,
        audio_offset_seconds: audio_offset_sec,
        chat_offset_seconds: chat_offset,
        synchronized: true,
        video_index: Some(video_idx),
        audio_index: audio_idx,
        chat_summary,
    };

    let summary_path = normalized_dir.join("timeline-summary.json");
    fs::write(
        &summary_path,
        serde_json::to_string_pretty(&summary).unwrap(),
    )
    .map_err(|e| format!("Failed to write timeline-summary.json: {}", e))?;

    Ok(summary)
}

pub fn load_chat_index_internal(project_dir_str: &str) -> Result<ChatIndex, String> {
    let chat_index_path = Path::new(project_dir_str).join("normalized").join("chat-index.json");
    if !chat_index_path.exists() {
        return Err(format!("Chat index does not exist at {:?}", chat_index_path));
    }
    let content = fs::read_to_string(&chat_index_path)
        .map_err(|e| format!("Failed to read chat index: {}", e))?;
    serde_json::from_str::<ChatIndex>(&content)
        .map_err(|e| format!("Failed to deserialize chat index: {}", e))
}

pub fn load_timeline_summary_internal(project_dir_str: &str) -> Result<TimelineSummary, String> {
    let summary_path = Path::new(project_dir_str).join("normalized").join("timeline-summary.json");
    if !summary_path.exists() {
        return Err(format!("Timeline summary does not exist at {:?}", summary_path));
    }
    let content = fs::read_to_string(&summary_path)
        .map_err(|e| format!("Failed to read timeline summary: {}", e))?;
    serde_json::from_str::<TimelineSummary>(&content)
        .map_err(|e| format!("Failed to deserialize timeline summary: {}", e))
}

pub fn calibrate_chat_offset_internal(
    project_dir_str: &str,
    chat_offset_seconds: f64,
) -> Result<TimelineSummary, String> {
    normalize_stream_project_internal(project_dir_str, Some(chat_offset_seconds))
}
