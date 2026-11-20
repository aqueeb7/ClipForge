pub mod ffmpeg;
pub mod gpu;
pub mod menu;
pub mod state;

use ffmpeg::{cleanup_incomplete_files_internal, execute_render_task, inspect_media_internal, resolve_project_path};
use gpu::{get_gpu_encoder_info, GpuEncoderInfo};
use menu::setup_native_menu;
use state::{AppDiagnostic, RenderClipRequest, RenderClipResponse, RenderManager, StreamSummary};
use std::process::Command;
use std::sync::atomic::Ordering;

#[tauri::command]
fn get_gpu_info() -> GpuEncoderInfo {
    get_gpu_encoder_info().clone()
}

#[tauri::command]
fn get_app_info() -> Result<AppDiagnostic, String> {
    let ffmpeg_found = Command::new("ffmpeg").arg("-version").output().is_ok();
    let ffprobe_found = Command::new("ffprobe").arg("-version").output().is_ok();
    let gpu = Some(get_gpu_encoder_info().clone());
    Ok(AppDiagnostic {
        ready: ffmpeg_found,
        os: std::env::consts::OS.to_string(),
        message: if ffmpeg_found {
            format!("ClipForge engine ready ({})", gpu.as_ref().map(|g| g.name.as_str()).unwrap_or("CPU"))
        } else {
            "FFmpeg not found in PATH".to_string()
        },
        ffmpeg_found,
        ffprobe_found,
        gpu,
    })
}

#[tauri::command]
fn inspect_media(path: String) -> Result<StreamSummary, String> {
    inspect_media_internal(path)
}

#[tauri::command]
async fn render_clip(
    app: tauri::AppHandle,
    state: tauri::State<'_, RenderManager>,
    req: RenderClipRequest,
) -> Result<RenderClipResponse, String> {
    let old_pid = state.current_pid.swap(0, Ordering::SeqCst);
    if old_pid > 0 {
        state.cancelled.store(true, Ordering::SeqCst);
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &old_pid.to_string()])
                .output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = Command::new("kill")
                .args(["-9", &old_pid.to_string()])
                .output();
        }
        std::thread::sleep(std::time::Duration::from_millis(150));
    }

    let current_pid = state.current_pid.clone();
    let cancelled = state.cancelled.clone();

    cancelled.store(false, Ordering::SeqCst);

    tauri::async_runtime::spawn_blocking(move || {
        execute_render_task(app, req, current_pid, cancelled)
    })
    .await
    .map_err(|e| format!("Worker thread failed: {}", e))?
}

#[tauri::command]
fn cancel_render(state: tauri::State<'_, RenderManager>) -> Result<(), String> {
    state.cancelled.store(true, Ordering::SeqCst);
    let pid = state.current_pid.swap(0, Ordering::SeqCst);
    if pid > 0 {
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
    }
    Ok(())
}

#[tauri::command]
fn cleanup_incomplete_files(dir_path: String) -> Result<u32, String> {
    cleanup_incomplete_files_internal(dir_path)
}

#[tauri::command]
fn save_project_file(path: String, content: String) -> Result<(), String> {
    let resolved = resolve_project_path(&path);
    if let Some(parent) = resolved.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&resolved, content).map_err(|e| format!("Failed to write project file: {}", e))
}

#[tauri::command]
fn load_project_file(path: String) -> Result<String, String> {
    let resolved = resolve_project_path(&path);
    std::fs::read_to_string(&resolved).map_err(|e| format!("Failed to read project file: {}", e))
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    let resolved = resolve_project_path(&path);
    #[cfg(target_os = "windows")]
    {
        let target_dir = if resolved.is_file() {
            resolved.parent().unwrap_or(&resolved).to_path_buf()
        } else {
            resolved
        };
        let _ = Command::new("explorer").arg(target_dir).spawn();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("open").arg(&resolved).spawn();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Err(err) = setup_native_menu(app) {
                eprintln!("Failed to setup native menu: {}", err);
            }
            Ok(())
        })
        .manage(RenderManager::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_gpu_info,
            inspect_media,
            render_clip,
            cancel_render,
            open_in_explorer,
            save_project_file,
            load_project_file,
            cleanup_incomplete_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipForge application");
}
