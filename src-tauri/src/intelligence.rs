use super::normalizer::{load_chat_index_internal, resolve_source_files, ChatIndex};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatEvent {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub peak_time: f64,
    pub peak_velocity: f64,      // messages per second
    pub message_count: usize,
    pub sentiment_label: String, // "Hype" | "Humor" | "Shock" | "Chat Surge"
    pub top_keywords: Vec<String>,
    pub score: f64,              // 0.0 to 1.0
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatAnalysisResult {
    pub total_events: usize,
    pub average_velocity: f64,
    pub peak_velocity: f64,
    pub events: Vec<ChatEvent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioEvent {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub peak_time: f64,
    pub peak_db: f64,        // e.g. -4.5 dBFS
    pub energy_jump_db: f64, // relative to local baseline
    pub duration: f64,
    pub score: f64,          // 0.0 to 1.0
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioAnalysisResult {
    pub total_events: usize,
    pub baseline_db: f64,
    pub peak_db: f64,
    pub events: Vec<AudioEvent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoEvent {
    pub id: String,
    pub timestamp: f64,
    pub scene_change_score: f64,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoAnalysisResult {
    pub total_events: usize,
    pub events: Vec<VideoEvent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SynchronizedMoment {
    pub id: String,
    pub timestamp: f64,          // Video timeline anchor
    pub chat_peak_time: Option<f64>,
    pub audio_peak_time: Option<f64>,
    pub visual_cut_time: Option<f64>,
    pub duration_suggested: f64, // Suggested vertical short duration (e.g. 30s)
    pub lead_in_seconds: f64,    // Buildup before peak (e.g. 5s)
    pub lead_out_seconds: f64,   // Aftermath & celebration (e.g. 25s)
    pub composite_score: f64,    // 0.0 to 1.0
    pub primary_trigger: String, // "multi_modal" | "chat_burst" | "audio_spike" | "scene_change"
    pub label: String,
    pub keywords: Vec<String>,
    pub chat_velocity: f64,
    pub audio_jump_db: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SynchronizedAnalysisResult {
    pub project_dir: String,
    pub analyzed_at: String,
    pub video_duration: f64,
    pub total_candidates: usize,
    pub chat_analysis: Option<ChatAnalysisResult>,
    pub audio_analysis: Option<AudioAnalysisResult>,
    pub video_analysis: Option<VideoAnalysisResult>,
    pub moments: Vec<SynchronizedMoment>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamAnalysisProgressPayload {
    pub stage: String, // "chat" | "audio" | "video" | "correlation" | "complete"
    pub percentage: f64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HighlightCandidate {
    pub id: String,
    pub rank: usize,
    pub title: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub duration_seconds: f64,
    pub peak_timestamp: f64,
    pub confidence: f64,
    pub sentiment: String,
    pub top_keywords: Vec<String>,
    pub hook_duration_seconds: f64,
    pub has_immediate_hook: bool,
    pub source_moment_id: String,
    pub output_filename: String,
    pub status: String, // "pending" | "rendering" | "completed" | "error"
    pub rendered_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CandidateGenerationSettings {
    pub target_duration_seconds: Option<f64>,
    pub min_duration_seconds: Option<f64>,
    pub max_duration_seconds: Option<f64>,
    pub lead_in_padding: Option<f64>,
    pub lead_out_padding: Option<f64>,
    pub min_confidence: Option<f64>,
    pub merge_gap_seconds: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CandidateGenerationResult {
    pub project_dir: String,
    pub total_candidates: usize,
    pub candidates: Vec<HighlightCandidate>,
}

// ---------------------------------------------------------------------------
// SPEC 007: Chat Reaction Analytics
// ---------------------------------------------------------------------------

pub fn analyze_chat_events_internal(
    chat_index: &ChatIndex,
    _video_duration: f64,
) -> Result<ChatAnalysisResult, String> {
    if chat_index.messages.is_empty() {
        return Ok(ChatAnalysisResult {
            total_events: 0,
            average_velocity: 0.0,
            peak_velocity: 0.0,
            events: Vec::new(),
        });
    }

    let avg_vel = chat_index.average_velocity_msg_per_sec;
    let threshold_vel = (avg_vel * 1.8).max(1.2);

    // Identify candidate 5-second bins above threshold
    let mut hot_bins: Vec<&super::normalizer::ChatDensityBucket> = chat_index
        .density_buckets_5s
        .iter()
        .filter(|b| b.velocity >= threshold_vel && b.count >= 2)
        .collect();

    // Group adjacent hot bins (< 8 seconds apart) into single cohesive events
    let mut clusters: Vec<Vec<&super::normalizer::ChatDensityBucket>> = Vec::new();
    for b in hot_bins.drain(..) {
        if let Some(last_cluster) = clusters.last_mut() {
            if let Some(prev) = last_cluster.last() {
                if b.bin_start - prev.bin_end <= 8.0 {
                    last_cluster.push(b);
                    continue;
                }
            }
        }
        clusters.push(vec![b]);
    }

    let hype_words = [
        "w", "pog", "poggers", "sheesh", "lets go", "let's go", "insane",
        "holy", "omg", "goat", "🔥", "clip", "clutch", "win", "dub",
    ];
    let humor_words = [
        "lmao", "lmfao", "lol", "hahaha", "haha", "kekw", "💀", "😭", "bruh", "dead",
    ];
    let shock_words = [
        "nooo", "noo", "no way", "f", "rip", "whaaat", "what", "unreal", "ouch", "omfg",
    ];

    let mut events: Vec<ChatEvent> = Vec::new();

    for (idx, cluster) in clusters.iter().enumerate() {
        let start_time = cluster.first().unwrap().bin_start;
        let end_time = cluster.last().unwrap().bin_end;

        // Find peak within this cluster
        let mut peak_time = start_time;
        let mut peak_vel = 0.0;
        let mut total_msgs = 0;

        for b in cluster {
            if b.velocity > peak_vel {
                peak_vel = b.velocity;
                peak_time = b.bin_start + 2.5;
            }
            total_msgs += b.count as usize;
        }

        // Tally sentiment keywords from messages in [start_time, end_time]
        let mut hype_count = 0;
        let mut humor_count = 0;
        let mut shock_count = 0;
        let mut keyword_freq: Vec<(String, usize)> = Vec::new();

        let cluster_msgs = chat_index
            .messages
            .iter()
            .filter(|m| m.time_seconds >= start_time - 1.0 && m.time_seconds <= end_time + 1.0);

        for m in cluster_msgs {
            let lower = m.message.to_lowercase();
            for w in &hype_words {
                if lower.contains(w) {
                    hype_count += 1;
                    record_keyword(&mut keyword_freq, w.to_uppercase());
                }
            }
            for w in &humor_words {
                if lower.contains(w) {
                    humor_count += 1;
                    record_keyword(&mut keyword_freq, w.to_uppercase());
                }
            }
            for w in &shock_words {
                if lower.contains(w) {
                    shock_count += 1;
                    record_keyword(&mut keyword_freq, w.to_uppercase());
                }
            }
        }

        keyword_freq.sort_by(|a, b| b.1.cmp(&a.1));
        let top_keywords: Vec<String> = keyword_freq
            .into_iter()
            .take(3)
            .map(|(k, _)| k)
            .collect();

        let sentiment_label = if hype_count >= humor_count && hype_count >= shock_count && hype_count > 0 {
            "Hype".to_string()
        } else if humor_count >= shock_count && humor_count > 0 {
            "Humor".to_string()
        } else if shock_count > 0 {
            "Shock".to_string()
        } else {
            "Chat Surge".to_string()
        };

        let sentiment_bonus = 1.0 + (0.05 * (hype_count + humor_count + shock_count).min(6) as f64);
        let vel_ratio = if avg_vel > 0.0 { peak_vel / avg_vel } else { 1.0 };
        let score = ((vel_ratio / 4.0) * sentiment_bonus).clamp(0.40, 1.0);

        events.push(ChatEvent {
            id: format!("chat_evt_{:03}", idx + 1),
            start_time,
            end_time,
            peak_time: (peak_time * 100.0).round() / 100.0,
            peak_velocity: (peak_vel * 100.0).round() / 100.0,
            message_count: total_msgs,
            sentiment_label,
            top_keywords,
            score: (score * 100.0).round() / 100.0,
        });
    }

    events.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

    Ok(ChatAnalysisResult {
        total_events: events.len(),
        average_velocity: (avg_vel * 100.0).round() / 100.0,
        peak_velocity: chat_index.peak_velocity_msg_per_sec,
        events,
    })
}

fn record_keyword(freq: &mut Vec<(String, usize)>, word: String) {
    if let Some(item) = freq.iter_mut().find(|(k, _)| *k == word) {
        item.1 += 1;
    } else {
        freq.push((word, 1));
    }
}

// ---------------------------------------------------------------------------
// SPEC 008: Audio Event Detection (High-Speed PCM RMS Sampling)
// ---------------------------------------------------------------------------

pub fn analyze_audio_events_internal(
    audio_path: &Path,
    _video_duration: f64,
) -> Result<AudioAnalysisResult, String> {
    // 8000 Hz, 16-bit mono PCM stream
    let mut child = Command::new("ffmpeg")
        .args([
            "-v",
            "error",
            "-i",
            &audio_path.to_string_lossy(),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "8000",
            "-f",
            "s16le",
            "-",
        ])
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg for audio analysis: {}", e))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture ffmpeg stdout".to_string())?;

    // Window size: 200ms = 1600 samples = 3200 bytes
    let window_samples = 1600usize;
    let window_bytes = window_samples * 2;
    let mut buf = vec![0u8; window_bytes];

    let mut window_index = 0usize;
    let mut slice_energies: Vec<(f64, f64)> = Vec::new(); // (time_sec, dbfs)

    let mut raw_samples = vec![0i16; window_samples];

    while let Ok(bytes_read) = stdout.read(&mut buf) {
        if bytes_read == 0 {
            break;
        }

        let samples_count = bytes_read / 2;
        if samples_count == 0 {
            break;
        }

        // Convert u8 to i16
        for i in 0..samples_count {
            raw_samples[i] = i16::from_le_bytes([buf[i * 2], buf[i * 2 + 1]]);
        }

        // Calculate RMS
        let mut sum_sq: f64 = 0.0;
        for &s in &raw_samples[0..samples_count] {
            let val = s as f64;
            sum_sq += val * val;
        }
        let rms = (sum_sq / samples_count as f64).sqrt();
        let dbfs = 20.0 * ((rms / 32768.0).max(1e-7)).log10();
        let time_sec = window_index as f64 * 0.20;

        slice_energies.push((time_sec, dbfs));
        window_index += 1;
    }

    let _ = child.wait();

    if slice_energies.is_empty() {
        return Ok(AudioAnalysisResult {
            total_events: 0,
            baseline_db: -50.0,
            peak_db: -50.0,
            events: Vec::new(),
        });
    }

    // Compute rolling 5-second baseline (25 windows)
    let baseline_window = 25usize;
    let mut raw_events: Vec<AudioEvent> = Vec::new();
    let mut max_db = -100.0f64;
    let mut avg_sum = 0.0f64;

    for (i, &(t, db)) in slice_energies.iter().enumerate() {
        if db > max_db {
            max_db = db;
        }
        avg_sum += db;

        let start_idx = i.saturating_sub(baseline_window);
        let slice = &slice_energies[start_idx..=i];
        let local_baseline = slice.iter().map(|s| s.1).sum::<f64>() / slice.len() as f64;

        let jump = db - local_baseline;

        // Transient criteria: jump >= 11 dB and current level >= -26 dBFS (audible)
        if jump >= 11.0 && db >= -26.0 {
            let score = ((jump / 20.0) * 0.7 + (1.0 + db / 30.0) * 0.3).clamp(0.40, 1.0);
            raw_events.push(AudioEvent {
                id: format!("audio_evt_{}", raw_events.len() + 1),
                start_time: (t * 100.0).round() / 100.0,
                end_time: ((t + 0.5) * 100.0).round() / 100.0,
                peak_time: (t * 100.0).round() / 100.0,
                peak_db: (db * 10.0).round() / 10.0,
                energy_jump_db: (jump * 10.0).round() / 10.0,
                duration: 0.5,
                score: (score * 100.0).round() / 100.0,
            });
        }
    }

    // Merge adjacent audio events within 2.5s
    let mut merged: Vec<AudioEvent> = Vec::new();
    for ev in raw_events {
        if let Some(prev) = merged.last_mut() {
            if ev.peak_time - prev.end_time <= 2.5 {
                if ev.peak_db > prev.peak_db {
                    prev.peak_time = ev.peak_time;
                    prev.peak_db = ev.peak_db;
                    prev.energy_jump_db = prev.energy_jump_db.max(ev.energy_jump_db);
                    prev.score = prev.score.max(ev.score);
                }
                prev.end_time = ev.end_time;
                prev.duration = prev.end_time - prev.start_time;
                continue;
            }
        }
        merged.push(ev);
    }

    for (i, m) in merged.iter_mut().enumerate() {
        m.id = format!("audio_evt_{:03}", i + 1);
    }

    merged.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

    let overall_baseline = avg_sum / slice_energies.len() as f64;

    Ok(AudioAnalysisResult {
        total_events: merged.len(),
        baseline_db: (overall_baseline * 10.0).round() / 10.0,
        peak_db: (max_db * 10.0).round() / 10.0,
        events: merged,
    })
}

// ---------------------------------------------------------------------------
// SPEC 009: Visual Shift Detection (Scene Transitions & Keyframe Motion)
// ---------------------------------------------------------------------------

pub fn analyze_video_events_internal(
    video_path: &Path,
    video_duration: f64,
) -> Result<VideoAnalysisResult, String> {
    let output = Command::new("ffmpeg")
        .args([
            "-v",
            "info",
            "-i",
            &video_path.to_string_lossy(),
            "-vf",
            "select='gt(scene,0.35)',showinfo",
            "-f",
            "null",
            "-",
        ])
        .output()
        .map_err(|e| format!("Failed to run scene detection: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut events: Vec<VideoEvent> = Vec::new();

    for line in stderr.lines() {
        if line.contains("pts_time:") && line.contains("Parsed_showinfo") {
            if let Some(idx) = line.find("pts_time:") {
                let rest = &line[idx + 9..];
                if let Some(token) = rest.split_whitespace().next() {
                    if let Ok(pts_time) = token.parse::<f64>() {
                        if pts_time >= 0.0 && pts_time <= video_duration {
                            events.push(VideoEvent {
                                id: format!("vid_evt_{:03}", events.len() + 1),
                                timestamp: (pts_time * 100.0).round() / 100.0,
                                scene_change_score: 0.45,
                                score: 0.60,
                            });
                        }
                    }
                }
            }
        }
    }

    // Deduplicate scene cuts occurring within 3s
    let mut deduped: Vec<VideoEvent> = Vec::new();
    for ev in events {
        if let Some(prev) = deduped.last() {
            if (ev.timestamp - prev.timestamp).abs() <= 3.0 {
                continue;
            }
        }
        deduped.push(ev);
    }

    for (i, e) in deduped.iter_mut().enumerate() {
        e.id = format!("vid_evt_{:03}", i + 1);
    }

    Ok(VideoAnalysisResult {
        total_events: deduped.len(),
        events: deduped,
    })
}

// ---------------------------------------------------------------------------
// SPEC 010: Multi-Modal Reaction-to-Event Correlation
// ---------------------------------------------------------------------------

pub fn correlate_synchronized_events_internal(
    project_dir: &str,
    video_duration: f64,
    chat_res: Option<&ChatAnalysisResult>,
    audio_res: Option<&AudioAnalysisResult>,
    video_res: Option<&VideoAnalysisResult>,
) -> Result<SynchronizedAnalysisResult, String> {
    let mut moments: Vec<SynchronizedMoment> = Vec::new();
    let mut claimed_times: Vec<f64> = Vec::new();

    let chat_events = chat_res.map(|c| c.events.as_slice()).unwrap_or(&[]);
    let audio_events = audio_res.map(|a| a.events.as_slice()).unwrap_or(&[]);
    let video_events = video_res.map(|v| v.events.as_slice()).unwrap_or(&[]);

    // 1. Multi-Modal Matches: Audio Peak (t_a) followed by Chat Reaction Burst (t_c in [t_a + 0.5, t_a + 5.5])
    for a in audio_events {
        let matching_chat = chat_events.iter().find(|c| {
            c.peak_time >= a.peak_time + 0.5 && c.peak_time <= a.peak_time + 5.5
        });

        let matching_video = video_events.iter().find(|v| {
            (v.timestamp - a.peak_time).abs() <= 2.0
        });

        if let Some(c) = matching_chat {
            let composite = if matching_video.is_some() {
                // Triple coincidence (Audio + Chat + Visual)
                (a.score * 0.45 + c.score * 0.45 + 0.10).min(0.98)
            } else {
                // Audio + Chat
                (a.score * 0.50 + c.score * 0.50).min(0.95)
            };

            let label = format!(
                "🔥 Hype Peak: {} ({} msgs/s) + Audio Spike (+{}dB)",
                c.sentiment_label, c.peak_velocity, a.energy_jump_db
            );

            moments.push(SynchronizedMoment {
                id: format!("moment_{:03}", moments.len() + 1),
                timestamp: a.peak_time,
                chat_peak_time: Some(c.peak_time),
                audio_peak_time: Some(a.peak_time),
                visual_cut_time: matching_video.map(|v| v.timestamp),
                duration_suggested: 30.0,
                lead_in_seconds: 5.0,
                lead_out_seconds: 25.0,
                composite_score: (composite * 100.0).round() / 100.0,
                primary_trigger: if matching_video.is_some() { "multi_modal".to_string() } else { "chat_audio".to_string() },
                label,
                keywords: c.top_keywords.clone(),
                chat_velocity: c.peak_velocity,
                audio_jump_db: a.energy_jump_db,
            });

            claimed_times.push(a.peak_time);
        }
    }

    // 2. Standalone Chat Reaction Bursts (Audience burst where audio wasn't loud, e.g. subtle humor, shock)
    for c in chat_events {
        let is_claimed = claimed_times.iter().any(|&t| (t - c.peak_time).abs() <= 12.0);
        if !is_claimed && c.score >= 0.55 {
            let anchor = (c.peak_time - 3.0).max(0.0);
            let label = if !c.top_keywords.is_empty() {
                format!("💬 Audience Reaction: {} ({})", c.sentiment_label, c.top_keywords.join(", "))
            } else {
                format!("💬 Audience Reaction: {} ({} msgs/s)", c.sentiment_label, c.peak_velocity)
            };

            moments.push(SynchronizedMoment {
                id: format!("moment_{:03}", moments.len() + 1),
                timestamp: (anchor * 100.0).round() / 100.0,
                chat_peak_time: Some(c.peak_time),
                audio_peak_time: None,
                visual_cut_time: None,
                duration_suggested: 30.0,
                lead_in_seconds: 4.0,
                lead_out_seconds: 26.0,
                composite_score: (c.score * 0.85 * 100.0).round() / 100.0,
                primary_trigger: "chat_burst".to_string(),
                label,
                keywords: c.top_keywords.clone(),
                chat_velocity: c.peak_velocity,
                audio_jump_db: 0.0,
            });

            claimed_times.push(anchor);
        }
    }

    // 3. Standalone Extreme Audio Spikes (Audience didn't type, but streamer had a massive shout/jump scare)
    for a in audio_events {
        let is_claimed = claimed_times.iter().any(|&t| (t - a.peak_time).abs() <= 12.0);
        if !is_claimed && a.energy_jump_db >= 14.0 {
            moments.push(SynchronizedMoment {
                id: format!("moment_{:03}", moments.len() + 1),
                timestamp: a.peak_time,
                chat_peak_time: None,
                audio_peak_time: Some(a.peak_time),
                visual_cut_time: None,
                duration_suggested: 30.0,
                lead_in_seconds: 5.0,
                lead_out_seconds: 25.0,
                composite_score: (a.score * 0.78 * 100.0).round() / 100.0,
                primary_trigger: "audio_spike".to_string(),
                label: format!("🔊 Volume Spike: Streamer Transient (+{}dB)", a.energy_jump_db),
                keywords: Vec::new(),
                chat_velocity: 0.0,
                audio_jump_db: a.energy_jump_db,
            });

            claimed_times.push(a.peak_time);
        }
    }

    // Sort descending by composite score
    moments.sort_by(|a, b| b.composite_score.partial_cmp(&a.composite_score).unwrap());

    // Re-index moment IDs
    for (i, m) in moments.iter_mut().enumerate() {
        m.id = format!("moment_{:03}", i + 1);
    }

    let analysis_dir = Path::new(project_dir).join("analysis");
    fs::create_dir_all(&analysis_dir)
        .map_err(|e| format!("Failed to create analysis dir: {}", e))?;

    let res = SynchronizedAnalysisResult {
        project_dir: project_dir.to_string(),
        analyzed_at: chrono_like_now(),
        video_duration,
        total_candidates: moments.len(),
        chat_analysis: chat_res.cloned(),
        audio_analysis: audio_res.cloned(),
        video_analysis: video_res.cloned(),
        moments,
    };

    let sync_path = analysis_dir.join("synchronized-events.json");
    fs::write(&sync_path, serde_json::to_string_pretty(&res).unwrap())
        .map_err(|e| format!("Failed to write synchronized-events.json: {}", e))?;

    Ok(res)
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    format!("timestamp_{}", now)
}

// ---------------------------------------------------------------------------
// MASTER PIPELINE ENTRY POINT
// ---------------------------------------------------------------------------

pub fn run_stream_intelligence_pipeline<F>(
    project_dir_str: &str,
    on_progress: F,
) -> Result<SynchronizedAnalysisResult, String>
where
    F: Fn(StreamAnalysisProgressPayload) + Send + Sync + 'static,
{
    let project_dir = Path::new(project_dir_str);
    if !project_dir.exists() {
        return Err(format!("Project directory does not exist: {}", project_dir_str));
    }

    let analysis_dir = project_dir.join("analysis");
    fs::create_dir_all(&analysis_dir)
        .map_err(|e| format!("Failed to create analysis directory: {}", e))?;

    let (video_file, audio_file, _chat_file) = resolve_source_files(project_dir);

    let video_path = video_file
        .ok_or_else(|| "No video file found in project source".to_string())?;

    // Determine duration from video index or fallback
    let video_index_path = project_dir.join("normalized").join("video-index.json");
    let video_duration = if video_index_path.exists() {
        let content = fs::read_to_string(&video_index_path).unwrap_or_default();
        let val: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
        val["duration"].as_f64().unwrap_or(60.0)
    } else {
        60.0
    };

    // 1. Stage: Chat Reaction Analytics (Spec 007)
    on_progress(StreamAnalysisProgressPayload {
        stage: "chat".to_string(),
        percentage: 15.0,
        message: "Scanning chat replay for velocity bursts and sentiment spikes...".to_string(),
    });

    let mut chat_analysis: Option<ChatAnalysisResult> = None;
    if let Ok(chat_idx) = load_chat_index_internal(project_dir_str) {
        if let Ok(chat_res) = analyze_chat_events_internal(&chat_idx, video_duration) {
            let chat_events_path = analysis_dir.join("chat-events.json");
            let _ = fs::write(
                &chat_events_path,
                serde_json::to_string_pretty(&chat_res).unwrap(),
            );
            chat_analysis = Some(chat_res);
        }
    }

    // 2. Stage: Audio Event Detection (Spec 008)
    on_progress(StreamAnalysisProgressPayload {
        stage: "audio".to_string(),
        percentage: 45.0,
        message: "Analyzing audio energy transients and volume spikes...".to_string(),
    });

    let mut audio_analysis: Option<AudioAnalysisResult> = None;
    let target_audio = audio_file.as_ref().unwrap_or(&video_path);
    if let Ok(audio_res) = analyze_audio_events_internal(target_audio, video_duration) {
        let audio_events_path = analysis_dir.join("audio-events.json");
        let _ = fs::write(
            &audio_events_path,
            serde_json::to_string_pretty(&audio_res).unwrap(),
        );
        audio_analysis = Some(audio_res);
    }

    // 3. Stage: Visual Shift Detection (Spec 009)
    on_progress(StreamAnalysisProgressPayload {
        stage: "video".to_string(),
        percentage: 75.0,
        message: "Detecting visual scene changes and keyframe transitions...".to_string(),
    });

    let mut video_analysis: Option<VideoAnalysisResult> = None;
    if let Ok(vid_res) = analyze_video_events_internal(&video_path, video_duration) {
        let video_events_path = analysis_dir.join("video-events.json");
        let _ = fs::write(
            &video_events_path,
            serde_json::to_string_pretty(&vid_res).unwrap(),
        );
        video_analysis = Some(vid_res);
    }

    // 4. Stage: Multi-Modal Reaction-to-Event Correlation (Spec 010)
    on_progress(StreamAnalysisProgressPayload {
        stage: "correlation".to_string(),
        percentage: 90.0,
        message: "Correlating streamer actions with audience reactions...".to_string(),
    });

    let sync_res = correlate_synchronized_events_internal(
        project_dir_str,
        video_duration,
        chat_analysis.as_ref(),
        audio_analysis.as_ref(),
        video_analysis.as_ref(),
    )?;

    on_progress(StreamAnalysisProgressPayload {
        stage: "complete".to_string(),
        percentage: 100.0,
        message: format!(
            "Intelligence analysis complete. Found {} high-potential moments.",
            sync_res.moments.len()
        ),
    });

    Ok(sync_res)
}

pub fn load_stream_analysis_internal(
    project_dir_str: &str,
) -> Result<SynchronizedAnalysisResult, String> {
    let sync_path = Path::new(project_dir_str)
        .join("analysis")
        .join("synchronized-events.json");

    if !sync_path.exists() {
        return Err(format!(
            "Synchronized events analysis not found at {:?}",
            sync_path
        ));
    }

    let content = fs::read_to_string(&sync_path)
        .map_err(|e| format!("Failed to read analysis result: {}", e))?;

    serde_json::from_str::<SynchronizedAnalysisResult>(&content)
        .map_err(|e| format!("Failed to parse analysis result: {}", e))
}

// ---------------------------------------------------------------------------
// SPEC 011: Highlight Candidate Generator & Ranking
// ---------------------------------------------------------------------------

pub fn generate_highlight_candidates_internal(
    project_dir_str: &str,
    settings_opt: Option<CandidateGenerationSettings>,
) -> Result<CandidateGenerationResult, String> {
    let sync_res = load_stream_analysis_internal(project_dir_str)?;
    let video_duration = sync_res.video_duration;

    let settings = settings_opt.unwrap_or(CandidateGenerationSettings {
        target_duration_seconds: Some(30.0),
        min_duration_seconds: Some(15.0),
        max_duration_seconds: Some(60.0),
        lead_in_padding: Some(5.0),
        lead_out_padding: Some(20.0),
        min_confidence: Some(0.40),
        merge_gap_seconds: Some(8.0),
    });

    let _target_dur = settings.target_duration_seconds.unwrap_or(30.0);
    let min_dur = settings.min_duration_seconds.unwrap_or(15.0);
    let max_dur = settings.max_duration_seconds.unwrap_or(60.0);
    let lead_in = settings.lead_in_padding.unwrap_or(5.0);
    let lead_out = settings.lead_out_padding.unwrap_or(20.0);
    let min_conf = settings.min_confidence.unwrap_or(0.40);
    let merge_gap = settings.merge_gap_seconds.unwrap_or(8.0);

    // Filter moments meeting min confidence
    let mut eligible_moments: Vec<&SynchronizedMoment> = sync_res
        .moments
        .iter()
        .filter(|m| m.composite_score >= min_conf)
        .collect();

    if eligible_moments.is_empty() {
        return Ok(CandidateGenerationResult {
            project_dir: project_dir_str.to_string(),
            total_candidates: 0,
            candidates: Vec::new(),
        });
    }

    // Sort chronologically to detect overlap and merge adjacent peaks
    eligible_moments.sort_by(|a, b| a.timestamp.partial_cmp(&b.timestamp).unwrap());

    struct CandidateCluster {
        start: f64,
        end: f64,
        peak_timestamp: f64,
        max_score: f64,
        sentiment: String,
        keywords: Vec<String>,
        source_id: String,
        label: String,
    }

    let mut clusters: Vec<CandidateCluster> = Vec::new();

    for moment in eligible_moments {
        let proposed_start = (moment.timestamp - lead_in).max(0.0);
        let proposed_end = (moment.timestamp + lead_out).min(video_duration);

        if let Some(last) = clusters.last_mut() {
            // Check if proposed window overlaps or is within merge_gap of the previous cluster
            if proposed_start <= last.end + merge_gap {
                let merged_end = last.end.max(proposed_end);
                if merged_end - last.start <= max_dur {
                    last.end = merged_end;
                    if moment.composite_score > last.max_score {
                        last.max_score = moment.composite_score;
                        last.peak_timestamp = moment.timestamp;
                        last.sentiment = moment.label.clone();
                        last.label = moment.label.clone();
                    }
                    for kw in &moment.keywords {
                        if !last.keywords.contains(kw) && last.keywords.len() < 5 {
                            last.keywords.push(kw.clone());
                        }
                    }
                    continue;
                }
            }
        }

        clusters.push(CandidateCluster {
            start: proposed_start,
            end: proposed_end,
            peak_timestamp: moment.timestamp,
            max_score: moment.composite_score,
            sentiment: moment.label.clone(),
            keywords: moment.keywords.clone(),
            source_id: moment.id.clone(),
            label: moment.label.clone(),
        });
    }

    let mut candidates: Vec<HighlightCandidate> = Vec::new();

    for cluster in clusters {
        let mut start = cluster.start;
        let mut end = cluster.end;
        let mut duration = end - start;

        // Ensure within min_duration and max_duration
        if duration < min_dur {
            let diff = min_dur - duration;
            start = (start - diff / 2.0).max(0.0);
            end = (start + min_dur).min(video_duration);
            duration = end - start;
        }

        if duration > max_dur {
            end = start + max_dur;
            duration = max_dur;
        }

        let hook_duration = (cluster.peak_timestamp - start).clamp(3.0, 5.0);
        let has_immediate_hook = (cluster.peak_timestamp - start) <= 6.0;

        let safe_title = if !cluster.keywords.is_empty() {
            format!("{} ({})", cluster.label, cluster.keywords.join(" "))
        } else {
            format!("{} Highlight @ {}s", cluster.label, cluster.peak_timestamp.round() as u64)
        };

        candidates.push(HighlightCandidate {
            id: format!("candidate-{}", candidates.len() + 1),
            rank: 0,
            title: safe_title,
            start_seconds: (start * 100.0).round() / 100.0,
            end_seconds: (end * 100.0).round() / 100.0,
            duration_seconds: (duration * 100.0).round() / 100.0,
            peak_timestamp: (cluster.peak_timestamp * 100.0).round() / 100.0,
            confidence: (cluster.max_score * 1000.0).round() / 1000.0,
            sentiment: cluster.sentiment,
            top_keywords: cluster.keywords,
            hook_duration_seconds: hook_duration,
            has_immediate_hook,
            source_moment_id: cluster.source_id,
            output_filename: String::new(),
            status: "pending".to_string(),
            rendered_path: None,
        });
    }

    // Sort by confidence descending and assign ranks
    candidates.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());

    for (idx, candidate) in candidates.iter_mut().enumerate() {
        candidate.rank = idx + 1;
        let slug = candidate
            .title
            .to_lowercase()
            .replace(|c: char| !c.is_alphanumeric() && c != ' ', "")
            .split_whitespace()
            .take(4)
            .collect::<Vec<&str>>()
            .join("_");
        candidate.output_filename = format!("{:02}_{}.mp4", candidate.rank, slug);
    }

    let highlights_dir = Path::new(project_dir_str).join("highlights");
    let _ = fs::create_dir_all(&highlights_dir);
    let candidates_path = highlights_dir.join("candidates.json");
    let res = CandidateGenerationResult {
        project_dir: project_dir_str.to_string(),
        total_candidates: candidates.len(),
        candidates,
    };

    let _ = fs::write(
        &candidates_path,
        serde_json::to_string_pretty(&res).map_err(|e| e.to_string())?,
    );

    Ok(res)
}

pub fn load_highlight_candidates_internal(
    project_dir_str: &str,
) -> Result<CandidateGenerationResult, String> {
    let candidates_path = Path::new(project_dir_str)
        .join("highlights")
        .join("candidates.json");

    if !candidates_path.exists() {
        return generate_highlight_candidates_internal(project_dir_str, None);
    }

    let content = fs::read_to_string(&candidates_path)
        .map_err(|e| format!("Failed to read candidates file: {}", e))?;

    serde_json::from_str::<CandidateGenerationResult>(&content)
        .map_err(|e| format!("Failed to parse candidates: {}", e))
}

// ---------------------------------------------------------------------------
// SPEC 012: Batch Vertical Clip Exporter
// ---------------------------------------------------------------------------

pub fn export_highlight_candidate_internal(
    app: tauri::AppHandle,
    project_dir_str: &str,
    candidate_id: &str,
    mode_opt: Option<String>,
) -> Result<super::state::RenderClipResponse, String> {
    let project_dir = Path::new(project_dir_str);
    let candidates_res = load_highlight_candidates_internal(project_dir_str)?;

    let candidate = candidates_res
        .candidates
        .into_iter()
        .find(|c| c.id == candidate_id)
        .ok_or_else(|| format!("Highlight candidate not found: {}", candidate_id))?;

    let (video_file, audio_file, _) = resolve_source_files(project_dir);
    let video_path = video_file
        .ok_or_else(|| "Source video file not found in project".to_string())?
        .to_string_lossy()
        .to_string();

    let audio_path = audio_file.map(|p| p.to_string_lossy().to_string());

    let summary_path = project_dir.join("normalized").join("timeline-summary.json");
    let audio_offset_ms = if summary_path.exists() {
        if let Ok(content) = fs::read_to_string(&summary_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                let off_sec = val["audio_offset_seconds"].as_f64().unwrap_or(0.0);
                Some((off_sec * 1000.0).round() as i64)
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let clips_dir = project_dir.join("highlights").join("clips");
    fs::create_dir_all(&clips_dir)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;

    let output_path = clips_dir
        .join(&candidate.output_filename)
        .to_string_lossy()
        .to_string();
    let mode = mode_opt.unwrap_or_else(|| "blur_fill".to_string());

    let req = super::state::RenderClipRequest {
        clip_id: Some(candidate.id.clone()),
        video_path,
        audio_path,
        audio_offset_ms,
        start_seconds: candidate.start_seconds,
        duration_seconds: candidate.duration_seconds,
        output_path: output_path.clone(),
        mode,
        bg_color: Some("#000000".to_string()),
        crf: Some(18),
        preset: Some("fast".to_string()),
        overlay_enabled: Some(true),
        brand_title: Some("CLYPTIK".to_string()),
        episode_label: Some(format!("#{:02}", candidate.rank)),
        episode_index: Some(candidate.rank as u32),
        ..Default::default()
    };

    let current_pid = Arc::new(AtomicU32::new(0));
    let cancelled = Arc::new(AtomicBool::new(false));

    let res = super::ffmpeg::execute_render_task(app, req, current_pid, cancelled)?;

    if res.success {
        let sidecar_path = clips_dir.join(format!("{}.json", candidate.output_filename));
        let now_sec = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let sidecar_data = serde_json::json!({
            "candidate_id": candidate.id,
            "rank": candidate.rank,
            "title": candidate.title,
            "start_seconds": candidate.start_seconds,
            "end_seconds": candidate.end_seconds,
            "duration_seconds": candidate.duration_seconds,
            "peak_timestamp": candidate.peak_timestamp,
            "confidence": candidate.confidence,
            "sentiment": candidate.sentiment,
            "top_keywords": candidate.top_keywords,
            "has_immediate_hook": candidate.has_immediate_hook,
            "output_file": candidate.output_filename,
            "rendered_unix": now_sec,
        });
        let _ = fs::write(&sidecar_path, serde_json::to_string_pretty(&sidecar_data).unwrap());

        if let Ok(mut updated) = load_highlight_candidates_internal(project_dir_str) {
            for c in &mut updated.candidates {
                if c.id == candidate.id {
                    c.status = "completed".to_string();
                    c.rendered_path = Some(res.output_path.clone());
                }
            }
            let _ = fs::write(
                project_dir.join("highlights").join("candidates.json"),
                serde_json::to_string_pretty(&updated).unwrap(),
            );
        }
    }

    Ok(res)
}

