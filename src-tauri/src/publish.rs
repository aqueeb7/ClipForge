use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

static OAUTH_CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize, Deserialize)]
pub struct YouTubeUploadParams {
    pub file_path: String,
    pub title: String,
    pub description: String,
    pub tags: Vec<String>,
    pub privacy: String,
    pub access_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YouTubeUploadResult {
    pub success: bool,
    pub video_id: Option<String>,
    pub url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
    pub token_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YouTubeSecrets {
    pub client_id: String,
    pub client_secret: String,
}

fn get_credentials_dir() -> PathBuf {
    let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let creds = base.join(".credentials");
    let _ = std::fs::create_dir_all(&creds);
    creds
}

pub fn save_stored_secrets_internal(client_id: &str, client_secret: &str) -> Result<(), String> {
    let dir = get_credentials_dir();
    let file = dir.join("youtube-secrets.json");
    let data = serde_json::json!({
        "client_id": client_id,
        "client_secret": client_secret
    });
    std::fs::write(&file, data.to_string())
        .map_err(|e| format!("Failed to save secrets: {}", e))
}

pub fn load_stored_secrets_internal() -> Result<Option<YouTubeSecrets>, String> {
    let dir = get_credentials_dir();
    let file = dir.join("youtube-secrets.json");
    if !file.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&file)
        .map_err(|e| format!("Failed to read secrets: {}", e))?;
    let val: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse secrets: {}", e))?;
    if let (Some(cid), Some(sec)) = (
        val.get("client_id").and_then(|v| v.as_str()),
        val.get("client_secret").and_then(|v| v.as_str()),
    ) {
        return Ok(Some(YouTubeSecrets {
            client_id: cid.to_string(),
            client_secret: sec.to_string(),
        }));
    }
    Ok(None)
}

pub fn save_stored_tokens_internal(tokens_json: &str) -> Result<(), String> {
    let dir = get_credentials_dir();
    let file = dir.join("youtube-tokens.json");
    std::fs::write(&file, tokens_json)
        .map_err(|e| format!("Failed to save tokens: {}", e))
}

pub fn load_stored_tokens_internal() -> Result<Option<String>, String> {
    let dir = get_credentials_dir();
    let file = dir.join("youtube-tokens.json");
    if !file.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&file)
        .map_err(|e| format!("Failed to read tokens: {}", e))?;
    Ok(Some(content))
}

pub fn clear_stored_credentials_internal() -> Result<(), String> {
    let dir = get_credentials_dir();
    let token_file = dir.join("youtube-tokens.json");
    if token_file.exists() {
        let _ = std::fs::remove_file(token_file);
    }
    Ok(())
}

pub fn cancel_oauth_listener_internal() {
    OAUTH_CANCELLED.store(true, Ordering::SeqCst);
}

pub fn resolve_existing_video_path(raw: &str) -> Result<PathBuf, String> {
    let raw_trimmed = raw.trim();
    if raw_trimmed.is_empty() {
        return Err("No video file path provided".to_string());
    }

    // 1. Direct check
    let direct = PathBuf::from(raw_trimmed);
    if direct.exists() {
        return Ok(direct);
    }

    // 2. Normalized slashes check
    #[cfg(target_os = "windows")]
    let normalized_str = raw_trimmed.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let normalized_str = raw_trimmed.replace('\\', "/");

    let normalized_path = PathBuf::from(&normalized_str);
    if normalized_path.exists() {
        return Ok(normalized_path);
    }

    // 3. Remove accidental /apps/ or \apps\ from path
    let de_apped = normalized_str
        .replace("\\apps\\Exports\\", "\\Exports\\")
        .replace("/apps/Exports/", "/Exports/")
        .replace("\\apps\\", "\\")
        .replace("/apps/", "/");

    let de_apped_path = PathBuf::from(&de_apped);
    if de_apped_path.exists() {
        return Ok(de_apped_path);
    }

    // 4. Check relative to current working directory & parent (src-tauri root)
    let filename = PathBuf::from(raw_trimmed)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    if !filename.is_empty() {
        if let Ok(cwd) = std::env::current_dir() {
            let cand_exp = cwd.join("Exports").join(&filename);
            if cand_exp.exists() {
                return Ok(cand_exp);
            }
            let cand_cwd = cwd.join(&filename);
            if cand_cwd.exists() {
                return Ok(cand_cwd);
            }
            if let Some(parent) = cwd.parent() {
                let cand_parent_exp = parent.join("Exports").join(&filename);
                if cand_parent_exp.exists() {
                    return Ok(cand_parent_exp);
                }
                let cand_parent = parent.join(&filename);
                if cand_parent.exists() {
                    return Ok(cand_parent);
                }
            }
        }
    }

    Err(format!("File does not exist: {}", raw_trimmed))
}

pub fn highlight_in_folder_internal(path: &str) -> Result<(), String> {
    let path_buf = resolve_existing_video_path(path)?;

    #[cfg(target_os = "windows")]
    {
        let canonical = path_buf.canonicalize().unwrap_or(path_buf);
        let path_str = canonical.to_string_lossy().to_string();
        let clean_path = path_str.trim_start_matches(r"\\?\");
        Command::new("explorer")
            .arg(format!("/select,\"{}\"", clean_path))
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&path_buf)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let target_dir = if path_buf.is_file() {
            path_buf.parent().unwrap_or(&path_buf)
        } else {
            &path_buf
        };
        Command::new("xdg-open")
            .arg(target_dir)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

pub fn open_browser_url_internal(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Use PowerShell Start-Process with single quotes to safely pass arbitrary URLs
        // with query strings and percent-encoding to the default Windows browser, avoiding
        // cmd.exe ampersand splitting and rundll32 ANSI truncation.
        let escaped_url = url.replace("'", "''");
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-WindowStyle", "Hidden",
                "-Command",
                &format!("Start-Process '{}'", escaped_url),
            ])
            .spawn()
            .map_err(|e| format!("Failed to launch browser: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to launch browser: {}", e))?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to launch browser: {}", e))?;
    }

    Ok(())
}

fn url_decode(input: &str) -> String {
    let mut result = String::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""),
                16,
            ) {
                result.push(byte as char);
                i += 3;
                continue;
            }
        } else if bytes[i] == b'+' {
            result.push(' ');
            i += 1;
            continue;
        }
        result.push(bytes[i] as char);
        i += 1;
    }
    result
}

pub fn listen_for_oauth_code_internal(port: u16) -> Result<String, String> {
    OAUTH_CANCELLED.store(false, Ordering::SeqCst);
    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr)
        .map_err(|e| format!("Port {} is unavailable or in use: {}", port, e))?;

    // Enable non-blocking mode to prevent freezing the entire app
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to set non-blocking mode: {}", e))?;

    // Wait up to 120 seconds (1200 * 100ms) with cancellation support
    let max_ticks = 1200;
    for _ in 0..max_ticks {
        if OAUTH_CANCELLED.load(Ordering::SeqCst) {
            return Err("Authorization cancelled by user.".to_string());
        }

        match listener.accept() {
            Ok((mut stream, _)) => {
                // Return to blocking for reading the single HTTP request
                let _ = stream.set_nonblocking(false);
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));

                let mut reader = BufReader::new(&mut stream);
                let mut request_line = String::new();
                let _ = reader.read_line(&mut request_line);

                let mut auth_code = None;
                let mut auth_error = None;

                if let Some(query_start) = request_line.find('?') {
                    let query_end = request_line[query_start..]
                        .find(' ')
                        .map(|i| query_start + i)
                        .unwrap_or(request_line.len());
                    let query = &request_line[query_start + 1..query_end];

                    for part in query.split('&') {
                        let mut kv = part.splitn(2, '=');
                        let key = kv.next().unwrap_or("");
                        let val = kv.next().unwrap_or("");
                        if key == "code" {
                            auth_code = Some(url_decode(val));
                        } else if key == "error" {
                            auth_error = Some(url_decode(val));
                        }
                    }
                }

                let html_body = if auth_code.is_some() {
                    r#"<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Clyptik • Connected to YouTube</title>
  <style>
    body { background-color: #090d16; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); max-width: 440px; }
    .icon { width: 56px; height: 56px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: #10b981; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 28px; }
    h1 { font-size: 22px; font-weight: 600; margin: 0 0 10px; }
    p { color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 0; }
    .badge { margin-top: 24px; display: inline-block; font-size: 12px; padding: 6px 14px; border-radius: 9999px; background: #1f2937; color: #38bdf8; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Authorization Successful</h1>
    <p>Clyptik has connected to your YouTube account. You can now close this tab and return to Clyptik.</p>
    <div class="badge">Clyptik Studio Engine</div>
  </div>
</body>
</html>"#
                } else {
                    r#"<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Clyptik • Authorization Failed</title>
  <style>
    body { background-color: #090d16; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background-color: #111827; border: 1px solid #ef4444; border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; }
    .icon { width: 56px; height: 56px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); color: #ef4444; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 28px; }
    h1 { font-size: 22px; font-weight: 600; margin: 0 0 10px; }
    p { color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10005;</div>
    <h1>Authorization Failed</h1>
    <p>Google authorization was not completed. Please return to Clyptik and try again.</p>
  </div>
</body>
</html>"#
                };

                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    html_body.len(),
                    html_body
                );

                let _ = stream.write_all(response.as_bytes());
                let _ = stream.flush();

                if let Some(err) = auth_error {
                    return Err(format!("Authorization error from Google: {}", err));
                }

                return match auth_code {
                    Some(code) => Ok(code),
                    None => Err("No authorization code received in callback".to_string()),
                };
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                return Err(format!("TCP accept error on port {}: {}", port, e));
            }
        }
    }

    Err("OAuth authorization timed out after 2 minutes. Please verify your redirect URI in Google Console is set to http://localhost:8085".to_string())
}

pub fn exchange_oauth_code_internal(
    client_id: &str,
    client_secret: &str,
    code: &str,
    redirect_uri: &str,
) -> Result<String, String> {
    let curl_cmd = if cfg!(target_os = "windows") { "curl.exe" } else { "curl" };

    let output = Command::new(curl_cmd)
        .args([
            "-s",
            "-X", "POST",
            "https://oauth2.googleapis.com/token",
            "--data-urlencode", &format!("code={}", code),
            "--data-urlencode", &format!("client_id={}", client_id),
            "--data-urlencode", &format!("client_secret={}", client_secret),
            "--data-urlencode", &format!("redirect_uri={}", redirect_uri),
            "--data-urlencode", "grant_type=authorization_code",
        ])
        .output()
        .map_err(|e| format!("Failed to execute token request: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Token exchange failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let response_str = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(response_str)
}

pub fn refresh_oauth_token_internal(
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> Result<String, String> {
    let curl_cmd = if cfg!(target_os = "windows") { "curl.exe" } else { "curl" };

    let output = Command::new(curl_cmd)
        .args([
            "-s",
            "-X", "POST",
            "https://oauth2.googleapis.com/token",
            "--data-urlencode", &format!("client_id={}", client_id),
            "--data-urlencode", &format!("client_secret={}", client_secret),
            "--data-urlencode", &format!("refresh_token={}", refresh_token),
            "--data-urlencode", "grant_type=refresh_token",
        ])
        .output()
        .map_err(|e| format!("Failed to execute token refresh request: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Token refresh failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let response_str = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(response_str)
}

pub fn upload_to_youtube_internal(params: YouTubeUploadParams) -> Result<YouTubeUploadResult, String> {
    let path = match resolve_existing_video_path(&params.file_path) {
        Ok(p) => p,
        Err(e) => {
            return Ok(YouTubeUploadResult {
                success: false,
                video_id: None,
                url: None,
                error: Some(e),
            });
        }
    };

    let file_size = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?
        .len();

    let path_str = path.to_string_lossy().to_string();

    let curl_cmd = if cfg!(target_os = "windows") { "curl.exe" } else { "curl" };

    let metadata_json = serde_json::json!({
        "snippet": {
            "title": params.title,
            "description": params.description,
            "tags": params.tags,
            "categoryId": "20"
        },
        "status": {
            "privacyStatus": params.privacy,
            "selfDeclaredMadeForKids": false
        }
    });

    let init_output = Command::new(curl_cmd)
        .args([
            "-s",
            "-i",
            "-X", "POST",
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
            "-H", &format!("Authorization: Bearer {}", params.access_token),
            "-H", "Content-Type: application/json; charset=UTF-8",
            "-H", "X-Upload-Content-Type: video/mp4",
            "-H", &format!("X-Upload-Content-Length: {}", file_size),
            "-d", &metadata_json.to_string(),
        ])
        .output()
        .map_err(|e| format!("Failed to initiate YouTube upload: {}", e))?;

    let init_header_str = String::from_utf8_lossy(&init_output.stdout);
    let mut location_url = None;

    for line in init_header_str.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("location:") {
            if let Some(val) = line.splitn(2, ':').nth(1) {
                location_url = Some(val.trim().to_string());
                break;
            }
        }
    }

    let upload_url = match location_url {
        Some(url) => url,
        None => {
            let error_msg = if let Some(start) = init_header_str.find('{') {
                if let Some(end) = init_header_str.rfind('}') {
                    let json_str = &init_header_str[start..=end];
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                        let reason = parsed.pointer("/error/errors/0/reason").and_then(|r| r.as_str());
                        let message = parsed.pointer("/error/message").and_then(|m| m.as_str()).unwrap_or("Upload initiation rejected by YouTube.");

                        match reason {
                            Some("uploadLimitExceeded") => {
                                "YouTube Daily Upload Limit Reached: Your channel has exceeded the maximum number of daily video uploads allowed by YouTube. YouTube limits daily uploads per account until verified with Advanced Features in YouTube Studio. The limit automatically resets in 24 hours.".to_string()
                            }
                            Some("quotaExceeded") => {
                                "YouTube API Quota Exceeded: Your Google Cloud project quota has been reached for today. Quota resets at midnight Pacific Time.".to_string()
                            }
                            _ => format!("YouTube API Error: {}", message),
                        }
                    } else {
                        format!("Could not acquire upload location URL. Response: {}", init_header_str)
                    }
                } else {
                    format!("Could not acquire upload location URL. Response: {}", init_header_str)
                }
            } else {
                format!("Could not acquire upload location URL. Response: {}", init_header_str)
            };

            return Ok(YouTubeUploadResult {
                success: false,
                video_id: None,
                url: None,
                error: Some(error_msg),
            });
        }
    };

    let upload_output = Command::new(curl_cmd)
        .args([
            "-s",
            "-X", "PUT",
            &upload_url,
            "-H", "Content-Type: video/mp4",
            "-H", &format!("Content-Length: {}", file_size),
            "--upload-file", &path_str,
        ])
        .output()
        .map_err(|e| format!("Failed to stream video to YouTube: {}", e))?;

    let response_body = String::from_utf8_lossy(&upload_output.stdout);
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&response_body) {
        if let Some(vid_id) = val.get("id").and_then(|v| v.as_str()) {
            return Ok(YouTubeUploadResult {
                success: true,
                video_id: Some(vid_id.to_string()),
                url: Some(format!("https://youtube.com/shorts/{}", vid_id)),
                error: None,
            });
        }
    }

    Ok(YouTubeUploadResult {
        success: false,
        video_id: None,
        url: None,
        error: Some(format!("YouTube upload response error: {}", response_body)),
    })
}
