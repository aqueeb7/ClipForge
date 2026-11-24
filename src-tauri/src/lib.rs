pub mod downloader;
pub mod ffmpeg;
pub mod gpu;
pub mod intelligence;
pub mod menu;
pub mod normalizer;
pub mod publish;
pub mod state;

use downloader::{
    cancel_download_internal, download_stream_pipeline, init_stream_project_internal,
    inspect_stream_url_internal, StreamDownloadRequest, StreamDownloadResult,
    StreamProjectLayout, StreamUrlInspection,
};
use intelligence::{
    export_highlight_candidate_internal, generate_highlight_candidates_internal,
    load_highlight_candidates_internal, load_stream_analysis_internal,
    run_stream_intelligence_pipeline, CandidateGenerationResult,
    CandidateGenerationSettings, SynchronizedAnalysisResult,
};
use normalizer::{
    calibrate_chat_offset_internal, load_chat_index_internal, load_timeline_summary_internal,
    normalize_stream_project_internal, ChatIndex, TimelineSummary,
};
use ffmpeg::{cleanup_incomplete_files_internal, execute_render_task, inspect_media_internal, resolve_project_path};
use gpu::{
    get_gpu_encoder_info, get_tri_engine_profile, set_hardware_engine_preference as set_pref,
    GpuEncoderInfo, TriEngineHardwareProfile,
};
use menu::setup_native_menu;
use publish::{
    cancel_oauth_listener_internal, clear_stored_credentials_internal, exchange_oauth_code_internal,
    highlight_in_folder_internal, listen_for_oauth_code_internal, load_stored_secrets_internal,
    load_stored_tokens_internal, open_browser_url_internal, refresh_oauth_token_internal,
    save_stored_secrets_internal, save_stored_tokens_internal, upload_to_youtube_internal,
    YouTubeSecrets, YouTubeUploadParams, YouTubeUploadResult,
};
use state::{AppDiagnostic, RenderClipRequest, RenderClipResponse, RenderManager, StreamSummary};
use std::process::Command;
use std::sync::atomic::Ordering;
use tauri::Emitter;

#[tauri::command]
fn get_gpu_info() -> GpuEncoderInfo {
    get_gpu_encoder_info()
}

#[tauri::command]
fn get_tri_engine_hardware_info() -> TriEngineHardwareProfile {
    get_tri_engine_profile()
}

#[tauri::command]
fn set_hardware_tri_engine_preference(
    decoder: Option<String>,
    encoder: Option<String>,
    inference: Option<String>,
) -> TriEngineHardwareProfile {
    set_pref(decoder, encoder, inference)
}

#[tauri::command]
fn get_app_info() -> Result<AppDiagnostic, String> {
    let ffmpeg_found = Command::new("ffmpeg").arg("-version").output().is_ok();
    let ffprobe_found = Command::new("ffprobe").arg("-version").output().is_ok();
    let gpu = Some(get_gpu_encoder_info());
    Ok(AppDiagnostic {
        ready: ffmpeg_found,
        os: std::env::consts::OS.to_string(),
        message: if ffmpeg_found {
            format!("Clyptik engine ready ({})", gpu.as_ref().map(|g| g.name.as_str()).unwrap_or("CPU"))
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

#[tauri::command]
fn highlight_in_folder(path: String) -> Result<(), String> {
    highlight_in_folder_internal(&path)
}

#[tauri::command]
fn open_browser_url(url: String) -> Result<(), String> {
    open_browser_url_internal(&url)
}

#[tauri::command]
async fn listen_for_oauth_code(port: u16) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        listen_for_oauth_code_internal(port)
    })
    .await
    .map_err(|e| format!("Worker failed: {}", e))?
}

#[tauri::command]
fn cancel_oauth_listener() -> Result<(), String> {
    cancel_oauth_listener_internal();
    Ok(())
}

#[tauri::command]
fn exchange_oauth_code(
    client_id: String,
    client_secret: String,
    code: String,
    redirect_uri: String,
) -> Result<String, String> {
    exchange_oauth_code_internal(&client_id, &client_secret, &code, &redirect_uri)
}

#[tauri::command]
fn refresh_oauth_token(
    client_id: String,
    client_secret: String,
    refresh_token: String,
) -> Result<String, String> {
    refresh_oauth_token_internal(&client_id, &client_secret, &refresh_token)
}

#[tauri::command]
fn save_stored_secrets(client_id: String, client_secret: String) -> Result<(), String> {
    save_stored_secrets_internal(&client_id, &client_secret)
}

#[tauri::command]
fn load_stored_secrets() -> Result<Option<YouTubeSecrets>, String> {
    load_stored_secrets_internal()
}

#[tauri::command]
fn save_stored_tokens(tokens_json: String) -> Result<(), String> {
    save_stored_tokens_internal(&tokens_json)
}

#[tauri::command]
fn load_stored_tokens() -> Result<Option<String>, String> {
    load_stored_tokens_internal()
}

#[tauri::command]
fn clear_stored_credentials() -> Result<(), String> {
    clear_stored_credentials_internal()
}

#[tauri::command]
async fn upload_to_youtube(params: YouTubeUploadParams) -> Result<YouTubeUploadResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        upload_to_youtube_internal(params)
    })
    .await
    .map_err(|e| format!("Upload worker failed: {}", e))?
}

#[tauri::command]
async fn inspect_stream_url(url: String) -> Result<StreamUrlInspection, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect_stream_url_internal(&url)
    })
    .await
    .map_err(|e| format!("Inspection worker failed: {}", e))?
}

#[tauri::command]
fn init_stream_project(base_dir: String, project_name: String) -> Result<StreamProjectLayout, String> {
    init_stream_project_internal(&base_dir, &project_name)
}

#[tauri::command]
async fn download_stream_assets(
    app: tauri::AppHandle,
    req: StreamDownloadRequest,
) -> Result<StreamDownloadResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        download_stream_pipeline(req, |progress| {
            let _ = app.emit("download-progress", progress);
        })
    })
    .await
    .map_err(|e| format!("Download pipeline worker failed: {}", e))?
}

#[tauri::command]
fn cancel_stream_download() -> Result<(), String> {
    cancel_download_internal();
    Ok(())
}

#[tauri::command]
fn normalize_stream_project(
    project_dir: String,
    chat_offset_seconds: Option<f64>,
) -> Result<TimelineSummary, String> {
    normalize_stream_project_internal(&project_dir, chat_offset_seconds)
}

#[tauri::command]
fn load_stream_chat_index(project_dir: String) -> Result<ChatIndex, String> {
    load_chat_index_internal(&project_dir)
}

#[tauri::command]
fn load_timeline_summary(project_dir: String) -> Result<TimelineSummary, String> {
    load_timeline_summary_internal(&project_dir)
}

#[tauri::command]
fn calibrate_chat_offset(
    project_dir: String,
    chat_offset_seconds: f64,
) -> Result<TimelineSummary, String> {
    calibrate_chat_offset_internal(&project_dir, chat_offset_seconds)
}

#[tauri::command]
async fn run_stream_intelligence(
    app: tauri::AppHandle,
    project_dir: String,
) -> Result<SynchronizedAnalysisResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_stream_intelligence_pipeline(&project_dir, move |progress| {
            let _ = app.emit("analysis-progress", progress);
        })
    })
    .await
    .map_err(|e| format!("Analysis pipeline worker failed: {}", e))?
}

#[tauri::command]
fn load_stream_intelligence(project_dir: String) -> Result<SynchronizedAnalysisResult, String> {
    load_stream_analysis_internal(&project_dir)
}

#[tauri::command]
fn generate_highlight_candidates(
    project_dir: String,
    settings: Option<CandidateGenerationSettings>,
) -> Result<CandidateGenerationResult, String> {
    generate_highlight_candidates_internal(&project_dir, settings)
}

#[tauri::command]
fn load_highlight_candidates(project_dir: String) -> Result<CandidateGenerationResult, String> {
    load_highlight_candidates_internal(&project_dir)
}

#[tauri::command]
async fn export_highlight_candidate(
    app: tauri::AppHandle,
    project_dir: String,
    candidate_id: String,
    mode: Option<String>,
) -> Result<RenderClipResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        export_highlight_candidate_internal(app, &project_dir, &candidate_id, mode)
    })
    .await
    .map_err(|e| format!("Highlight export worker failed: {}", e))?
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
            get_tri_engine_hardware_info,
            set_hardware_tri_engine_preference,
            inspect_media,
            render_clip,
            cancel_render,
            open_in_explorer,
            highlight_in_folder,
            open_browser_url,
            listen_for_oauth_code,
            cancel_oauth_listener,
            exchange_oauth_code,
            refresh_oauth_token,
            save_stored_secrets,
            load_stored_secrets,
            save_stored_tokens,
            load_stored_tokens,
            clear_stored_credentials,
            upload_to_youtube,
            inspect_stream_url,
            init_stream_project,
            download_stream_assets,
            cancel_stream_download,
            normalize_stream_project,
            load_stream_chat_index,
            load_timeline_summary,
            calibrate_chat_offset,
            run_stream_intelligence,
            load_stream_intelligence,
            generate_highlight_candidates,
            load_highlight_candidates,
            export_highlight_candidate,
            save_project_file,
            load_project_file,
            cleanup_incomplete_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running Clyptik application");
}
