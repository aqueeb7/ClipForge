use super::gpu::get_gpu_encoder_info;
use super::state::{RenderClipRequest, RenderClipResponse, RenderProgressPayload, StreamSummary};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tauri::Emitter;

pub fn escape_drawtext(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace(':', "\\:")
        .replace('%', "\\%")
        .replace('[', "\\[")
        .replace(']', "\\]")
        .replace(';', "\\;")
        .replace(',', "\\,")
}

pub fn resolve_project_path(p: &str) -> std::path::PathBuf {
    let trimmed = p.trim();
    #[cfg(target_os = "windows")]
    let normalized = trimmed.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let normalized = trimmed.replace('\\', "/");

    let path = std::path::Path::new(&normalized);
    if path.exists() {
        return path.to_path_buf();
    }

    // Remove accidental /apps/ or \apps\ from legacy paths
    let de_apped = normalized
        .replace("\\apps\\Exports\\", "\\Exports\\")
        .replace("/apps/Exports/", "/Exports/")
        .replace("\\apps\\", "\\")
        .replace("/apps/", "/");
    let de_apped_path = std::path::Path::new(&de_apped);
    if de_apped_path.exists() {
        return de_apped_path.to_path_buf();
    }

    if path.is_absolute() {
        return de_apped_path.to_path_buf();
    }

    let stripped = de_apped.trim_start_matches("./").trim_start_matches(".\\").to_string();

    if let Ok(cwd) = std::env::current_dir() {
        if cwd.ends_with("src-tauri") {
            if let Some(root) = cwd.parent() {
                let cand = root.join(&stripped);
                if cand.exists() {
                    return cand;
                }
                return cand;
            }
        }
        let cand = cwd.join(&stripped);
        if cand.exists() {
            return cand;
        }
        return cand;
    }

    std::path::PathBuf::from(de_apped)
}

pub fn inspect_with_ffmpeg(path: &str) -> Option<StreamSummary> {
    let output = Command::new("ffmpeg").args(["-i", path]).output().ok()?;
    let text = String::from_utf8_lossy(&output.stderr);

    let mut duration_seconds = 0.0;
    if let Some(dur_idx) = text.find("Duration: ") {
        let sub = &text[dur_idx + 10..];
        if let Some(comma) = sub.find(',') {
            let dur_str = sub[..comma].trim();
            let parts: Vec<&str> = dur_str.split(':').collect();
            if parts.len() == 3 {
                if let (Ok(h), Ok(m), Ok(s)) = (
                    parts[0].parse::<f64>(),
                    parts[1].parse::<f64>(),
                    parts[2].parse::<f64>(),
                ) {
                    duration_seconds = h * 3600.0 + m * 60.0 + s;
                }
            }
        }
    }

    if duration_seconds <= 0.0 {
        return None;
    }

    let mut width = None;
    let mut height = None;
    let mut fps = None;
    let mut codec = "h264".to_string();
    let has_audio = text.contains("Audio: ");

    for line in text.lines() {
        if line.contains("Video: ") {
            if line.contains("h264") {
                codec = "h264".to_string();
            } else if line.contains("hevc") || line.contains("h265") {
                codec = "h265".to_string();
            } else if line.contains("vp9") {
                codec = "vp9".to_string();
            }

            for token in line.split(&[',', ' '][..]) {
                if let Some((w_s, h_s)) = token.split_once('x') {
                    if let (Ok(w), Ok(h)) = (w_s.parse::<u32>(), h_s.parse::<u32>()) {
                        if (240..=7680).contains(&w) && (240..=4320).contains(&h) {
                            width = Some(w);
                            height = Some(h);
                            break;
                        }
                    }
                }
            }

            if let Some(fps_idx) = line.find(" fps") {
                let prefix = line[..fps_idx].trim_end();
                if let Some(last_space) = prefix.rfind(' ') {
                    if let Ok(f) = prefix[last_space + 1..].parse::<f64>() {
                        fps = Some(f);
                    }
                }
            }
            break;
        }
    }

    if width.is_none() && has_audio {
        for line in text.lines() {
            if let Some(idx) = line.find("Audio: ") {
                let rest = &line[idx + 7..];
                if let Some(tok) = rest.split(&[',', ' '][..]).next() {
                    codec = tok.to_string();
                }
                break;
            }
        }
    }

    let aspect_ratio = match (width, height) {
        (Some(w), Some(h)) => format!("{}:{}", w, h),
        _ => "16:9".to_string(),
    };

    Some(StreamSummary {
        path: path.to_string(),
        duration_seconds,
        width,
        height,
        fps,
        codec,
        has_audio,
        aspect_ratio,
    })
}

pub fn inspect_media_internal(path: String) -> Result<StreamSummary, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &path,
        ])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
                let duration_seconds = val["format"]["duration"]
                    .as_str()
                    .and_then(|s| s.parse::<f64>().ok())
                    .unwrap_or(0.0);

                if duration_seconds > 0.0 {
                    let streams = val["streams"].as_array();
                    let mut width = None;
                    let mut height = None;
                    let mut fps = None;
                    let mut codec = "unknown".to_string();
                    let mut has_audio = false;

                    if let Some(stream_list) = streams {
                        for s in stream_list {
                            let codec_type = s["codec_type"].as_str().unwrap_or("");
                            if codec_type == "video" && width.is_none() {
                                width = s["width"].as_u64().map(|v| v as u32);
                                height = s["height"].as_u64().map(|v| v as u32);
                                codec = s["codec_name"].as_str().unwrap_or("h264").to_string();
                                if let Some(r_fps) = s["r_frame_rate"].as_str() {
                                    if let Some((num, den)) = r_fps.split_once('/') {
                                        if let (Ok(n), Ok(d)) = (num.parse::<f64>(), den.parse::<f64>()) {
                                            if d > 0.0 {
                                                fps = Some((n / d * 100.0).round() / 100.0);
                                            }
                                        }
                                    }
                                }
                            } else if codec_type == "audio" {
                                has_audio = true;
                                if width.is_none() {
                                    codec = s["codec_name"].as_str().unwrap_or("aac").to_string();
                                }
                            }
                        }
                    }

                    let aspect_ratio = match (width, height) {
                        (Some(w), Some(h)) => format!("{}:{}", w, h),
                        _ => "16:9".to_string(),
                    };

                    return Ok(StreamSummary {
                        path,
                        duration_seconds,
                        width,
                        height,
                        fps,
                        codec,
                        has_audio,
                        aspect_ratio,
                    });
                }
            }
        }
    }

    if let Some(summary) = inspect_with_ffmpeg(&path) {
        return Ok(summary);
    }

    Ok(StreamSummary {
        path,
        duration_seconds: 60.0,
        width: Some(1920),
        height: Some(1080),
        fps: Some(60.0),
        codec: "h264".to_string(),
        has_audio: true,
        aspect_ratio: "16:9".to_string(),
    })
}

pub fn execute_render_task(
    app: tauri::AppHandle,
    req: RenderClipRequest,
    current_pid: Arc<AtomicU32>,
    cancelled: Arc<AtomicBool>,
) -> Result<RenderClipResponse, String> {
    if cancelled.load(Ordering::SeqCst) {
        return Err("Render cancelled before start".into());
    }

    let resolved_target = resolve_project_path(&req.output_path);

    if let Some(parent) = resolved_target.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    // Atomic temporary output target: write to <filename>.part.mp4 first
    let temp_target = resolved_target.with_extension("part.mp4");

    // Clean up any stale partial files before starting
    if temp_target.exists() {
        let _ = std::fs::remove_file(&temp_target);
    }

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-nostdin");
    cmd.arg("-y");
    cmd.arg("-ss").arg(format!("{:.3}", req.start_seconds));
    cmd.arg("-t").arg(format!("{:.3}", req.duration_seconds));
    cmd.arg("-i").arg(&req.video_path);

    let has_separate_audio = req.audio_path.is_some();
    if let Some(ref audio) = req.audio_path {
        let offset_sec = (req.audio_offset_ms.unwrap_or(0) as f64) / 1000.0;
        let audio_seek = (req.start_seconds - offset_sec).max(0.0);
        cmd.arg("-ss").arg(format!("{:.3}", audio_seek));
        cmd.arg("-t").arg(format!("{:.3}", req.duration_seconds));
        cmd.arg("-i").arg(audio);
    }

    let has_logo = req.overlay_enabled.unwrap_or(true)
        && req.logo_path.as_ref().map(|p| !p.trim().is_empty() && std::path::Path::new(p).exists()).unwrap_or(false);
    let logo_input_idx = if has_logo {
        let idx = if has_separate_audio { 2 } else { 1 };
        cmd.arg("-i").arg(req.logo_path.as_ref().unwrap());
        Some(idx)
    } else {
        None
    };

    let width = 1080;
    let height = 1920;

    let font_arg = if std::path::Path::new("C:\\Windows\\Fonts\\arial.ttf").exists() {
        "fontfile='C\\:/Windows/Fonts/arial.ttf':"
    } else {
        ""
    };

    let mut overlay_filters: Vec<String> = Vec::new();
    if req.overlay_enabled.unwrap_or(true) {
        if let Some(ref brand) = req.brand_title {
            if !brand.trim().is_empty() {
                let escaped_brand = escape_drawtext(&brand.trim().to_uppercase());
                let brand_y = if has_logo { 240 } else { 120 };
                overlay_filters.push(format!(
                    "drawtext={}text='{}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y={}:box=1:boxcolor=black@0.6:boxborderw=10",
                    font_arg, escaped_brand, brand_y
                ));
            }
        }

        if let Some(ref raw_label) = req.episode_label {
            let label = raw_label.trim().to_uppercase();
            if !label.is_empty() {
                let ep_num_str = req.episode_index.map(|idx| format!("{:03}", idx)).unwrap_or_default();
                let episode_text = if !ep_num_str.is_empty() {
                    format!("{} {}", label, ep_num_str)
                } else {
                    label
                };

                if !episode_text.is_empty() {
                    let escaped_ep = escape_drawtext(&episode_text);
                    overlay_filters.push(format!(
                        "drawtext={}text='{}':fontcolor=yellow:fontsize=44:x=(w-text_w)/2:y=1720:box=1:boxcolor=black@0.6:boxborderw=10",
                        font_arg, escaped_ep
                    ));
                }
            }
        }
    }

    let overlay_chain = if !overlay_filters.is_empty() {
        format!(",{}", overlay_filters.join(","))
    } else {
        String::new()
    };

    let base_graph = match req.mode.as_str() {
        "crop" => format!(
            "[0:v]scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}:(in_w-{})/2:(in_h-{})/2[base_v]",
            width, height, width, height, width, height
        ),
        "solid" => {
            let color = req.bg_color.as_deref().unwrap_or("#000000");
            format!(
                "[0:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:({}-iw)/2:({}-ih)/2:color={}[base_v]",
                width, height, width, height, width, height, color
            )
        },
        "stacked_split" | "split_50_50" => {
            let top_pct = req.top_height_pct.unwrap_or(if req.mode == "split_50_50" { 50.0 } else { 35.0 });
            let raw_top_h = (((height as f64) * (top_pct / 100.0)).round() as u32).max(100).min(height - 100);
            let top_h = (raw_top_h / 2) * 2;
            let bot_h = height - top_h;

            let tx = req.top_crop_x.unwrap_or(2.0) / 100.0;
            let ty = req.top_crop_y.unwrap_or(5.0) / 100.0;
            let tw = (req.top_crop_w.unwrap_or(28.0) / 100.0).clamp(0.05, 1.0);
            let th = (req.top_crop_h.unwrap_or(35.0) / 100.0).clamp(0.05, 1.0);

            let bx = req.bot_crop_x.unwrap_or(0.0) / 100.0;
            let by = req.bot_crop_y.unwrap_or(15.0) / 100.0;
            let bw = (req.bot_crop_w.unwrap_or(100.0) / 100.0).clamp(0.05, 1.0);
            let bh = (req.bot_crop_h.unwrap_or(85.0) / 100.0).clamp(0.05, 1.0);

            format!(
                "[0:v]split=2[in_top][in_bot];\
                 [in_top]crop=in_w*{tw:.4}:in_h*{th:.4}:in_w*{tx:.4}:in_h*{ty:.4},scale={width}:{top_h}:force_original_aspect_ratio=increase,crop={width}:{top_h}[top];\
                 [in_bot]crop=in_w*{bw:.4}:in_h*{bh:.4}:in_w*{bx:.4}:in_h*{by:.4},scale={width}:{bot_h}:force_original_aspect_ratio=increase,crop={width}:{bot_h}[bot];\
                 [top][bot]vstack=inputs=2[base_v]"
            )
        },
        "pan_scan" => {
            let px = (req.pan_crop_x.unwrap_or(21.875) / 100.0).clamp(0.0, 0.4375);
            format!(
                "[0:v]crop=trunc(in_h*9/32)*2:in_h:trunc(in_w*{px:.4}/2)*2:0,scale={width}:{height}[base_v]"
            )
        },
        "blur_fill" | "blur" | _ => format!(
            "[0:v]split=2[bg_in][fg_in];\
             [bg_in]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=8:2,scale={}:{}:flags=bicubic,eq=brightness=-0.15[bg];\
             [fg_in]scale={}:{}:force_original_aspect_ratio=decrease[fg];\
             [bg][fg]overlay=(W-w)/2:(H-h)/2[base_v]",
            width, height, width, height
        ),
    };

    let video_filter_graph = if let Some(logo_idx) = logo_input_idx {
        let logo_y = req.logo_offset_y.unwrap_or(90);
        let max_w = (720.0 * req.logo_scale.unwrap_or(1.0).clamp(0.3, 2.5)).round() as u32;
        format!(
            "{};\
             [{}:v]scale='min({},iw)':-1:force_original_aspect_ratio=decrease[logo_s];\
             [base_v][logo_s]overlay=(W-w)/2:{}:eof_action=repeat{},setsar=1,format=yuv420p[vout]",
            base_graph, logo_idx, max_w, logo_y, overlay_chain
        )
    } else {
        format!(
            "{};\
             [base_v]null{},setsar=1,format=yuv420p[vout]",
            base_graph, overlay_chain
        )
    };

    // Audio synchronization
    let full_filter_graph = if has_separate_audio {
        format!(
            "{};[1:a]aresample=48000:async=1:first_pts=0,apad,atrim=0:{:.3}[aout]",
            video_filter_graph, req.duration_seconds
        )
    } else {
        video_filter_graph
    };

    cmd.arg("-filter_complex").arg(&full_filter_graph);
    cmd.arg("-map").arg("[vout]");
    if has_separate_audio {
        cmd.arg("-map").arg("[aout]");
    } else {
        cmd.arg("-map").arg("0:a:0?");
    }

    let gpu_info = get_gpu_encoder_info();
    match gpu_info.encoder.as_str() {
        "h264_nvenc" => {
            cmd.args([
                "-c:v", "h264_nvenc",
                "-preset", "p4",
                "-tune", "hq",
                "-rc", "vbr",
                "-cq", "21",
                "-b:v", "20M",
                "-maxrate", "35M",
                "-bufsize", "50M",
                "-pix_fmt", "yuv420p",
            ]);
        }
        "h264_qsv" => {
            cmd.args([
                "-c:v", "h264_qsv",
                "-preset", "fast",
                "-global_quality", "22",
                "-look_ahead", "1",
                "-pix_fmt", "nv12",
            ]);
        }
        "h264_amf" => {
            cmd.args([
                "-c:v", "h264_amf",
                "-quality", "speed",
                "-rc", "cbr",
                "-b:v", "20M",
                "-pix_fmt", "yuv420p",
            ]);
        }
        "h264_videotoolbox" => {
            cmd.args([
                "-c:v", "h264_videotoolbox",
                "-b:v", "20M",
                "-pix_fmt", "yuv420p",
            ]);
        }
        _ => {
            let crf = req.crf.unwrap_or(21);
            let preset = req.preset.as_deref().unwrap_or("veryfast");
            cmd.args([
                "-c:v", "libx264",
                "-preset", preset,
                "-crf", &crf.to_string(),
                "-threads", "0",
                "-pix_fmt", "yuv420p",
            ]);
        }
    }
    cmd.args(["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]);
    cmd.args(["-movflags", "+faststart"]);
    cmd.args(["-t", &format!("{:.3}", req.duration_seconds)]);
    cmd.args(["-progress", "pipe:1", "-nostats"]);
    cmd.arg(&temp_target);

    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;
    current_pid.store(child.id(), Ordering::SeqCst);

    let stdout = child.stdout.take().ok_or("Failed to open child stdout pipe")?;
    let stderr = child.stderr.take().ok_or("Failed to open child stderr pipe")?;

    let stderr_handle = std::thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        let reader = BufReader::new(stderr);
        let mut lines_buf = std::collections::VecDeque::with_capacity(40);
        for line in reader.lines() {
            if let Ok(l) = line {
                if lines_buf.len() >= 40 {
                    lines_buf.pop_front();
                }
                lines_buf.push_back(l);
            }
        }
        lines_buf.into_iter().collect::<Vec<_>>().join("\n")
    });

    use std::io::{BufRead, BufReader};

    let reader = BufReader::new(stdout);
    let mut current_fps = 0.0;
    let mut current_speed = "0.0x".to_string();
    let mut last_emit = std::time::Instant::now();
    let mut max_progress: f64 = 0.0;
    let target_duration = req.duration_seconds.max(0.1);

    for line in reader.lines() {
        if cancelled.load(Ordering::SeqCst) {
            let _ = child.kill();
            break;
        }

        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        let trimmed = line.trim();
        if let Some((k, v)) = trimmed.split_once('=') {
            match k {
                "fps" => {
                    if let Ok(f) = v.parse::<f64>() {
                        current_fps = f;
                    }
                }
                "speed" => {
                    let s = v.trim();
                    if !s.is_empty() && s != "N/A" {
                        current_speed = s.to_string();
                    }
                }
                "out_time" => {
                    let parts: Vec<&str> = v.split(':').collect();
                    if parts.len() == 3 {
                        if let (Ok(h), Ok(m), Ok(s)) = (
                            parts[0].parse::<f64>(),
                            parts[1].parse::<f64>(),
                            parts[2].parse::<f64>(),
                        ) {
                            let sec = h * 3600.0 + m * 60.0 + s;
                            let mut progress = ((sec / target_duration) * 100.0).clamp(0.0, 99.0);
                            // Strictly monotonic
                            if progress < max_progress {
                                progress = max_progress;
                            } else {
                                max_progress = progress;
                            }

                            let eta = if current_fps > 0.0 && progress > 5.0 {
                                let speed_num = current_speed
                                    .trim_end_matches('x')
                                    .parse::<f64>()
                                    .unwrap_or(1.0);
                                let remaining_sec = (target_duration - sec).max(0.0);
                                let eta_calc = if speed_num > 0.05 {
                                    remaining_sec / speed_num
                                } else {
                                    remaining_sec
                                };
                                Some(eta_calc)
                            } else {
                                None
                            };

                            if last_emit.elapsed().as_millis() >= 100 {
                                last_emit = std::time::Instant::now();
                                let _ = app.emit("render-progress", RenderProgressPayload {
                                    clip_id: req.clip_id.clone(),
                                    output_path: req.output_path.clone(),
                                    progress: (progress * 10.0).round() / 10.0,
                                    fps: (current_fps * 10.0).round() / 10.0,
                                    speed: current_speed.clone(),
                                    eta_seconds: eta,
                                });
                            }
                        }
                    }
                }
                "progress" => {
                    if v == "end" {
                        let _ = app.emit("render-progress", RenderProgressPayload {
                            clip_id: req.clip_id.clone(),
                            output_path: req.output_path.clone(),
                            progress: 100.0,
                            fps: current_fps,
                            speed: current_speed.clone(),
                            eta_seconds: Some(0.0),
                        });
                    }
                }
                _ => {}
            }
        }
    }

    let status = child.wait().map_err(|e| format!("FFmpeg process wait error: {}", e))?;
    current_pid.store(0, Ordering::SeqCst);

    let stderr_logs = stderr_handle.join().unwrap_or_default();

    if cancelled.load(Ordering::SeqCst) {
        let _ = std::fs::remove_file(&temp_target);
        return Err("Render cancelled by user".to_string());
    }

    if !status.success() {
        let _ = std::fs::remove_file(&temp_target);
        return Err(format!("FFmpeg failed: {}", stderr_logs));
    }

    let file_size_bytes = std::fs::metadata(&temp_target)
        .map(|m| m.len())
        .unwrap_or(0);

    if file_size_bytes == 0 {
        let _ = std::fs::remove_file(&temp_target);
        return Err("Render produced an empty file".to_string());
    }

    // Atomically promote temporary .part.mp4 to final output target
    if resolved_target.exists() {
        let _ = std::fs::remove_file(&resolved_target);
    }
    std::fs::rename(&temp_target, &resolved_target)
        .map_err(|e| format!("Failed to finalize output file: {}", e))?;

    let final_path_str = resolved_target.to_string_lossy().to_string();

    let _ = app.emit("render-progress", RenderProgressPayload {
        clip_id: req.clip_id.clone(),
        output_path: req.output_path.clone(),
        progress: 100.0,
        fps: current_fps,
        speed: current_speed.clone(),
        eta_seconds: Some(0.0),
    });

    Ok(RenderClipResponse {
        success: true,
        output_path: final_path_str,
        duration_seconds: req.duration_seconds,
        file_size_bytes,
        error: None,
    })
}

pub fn cleanup_incomplete_files_internal(dir_path: String) -> Result<u32, String> {
    let resolved = resolve_project_path(&dir_path);
    let mut cleaned_count = 0;
    if resolved.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&resolved) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if file_name.ends_with(".part.mp4") || file_name.ends_with(".tmp.mp4") {
                        if std::fs::remove_file(&path).is_ok() {
                            cleaned_count += 1;
                        }
                    }
                }
            }
        }
    }
    Ok(cleaned_count)
}
