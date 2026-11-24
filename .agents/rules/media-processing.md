# Media Processing Rules

1. **Process Execution Safety**:
   - In Node/CLI: Use `child_process.spawn` with an argument array (`string[]`).
   - In Rust (`src-tauri`): Use `std::process::Command` with `.args(&[...])`.
   - Never construct shell commands via string concatenation of user-provided paths.

2. **FFmpeg Execution Standards & Hardware Acceleration**:
   - Parse machine-readable progress via `-progress pipe:1` or output lines with regex matching (`time=(\d+):(\d+):([\d.]+)`, `fps=([\d.]+)`, `speed=([\d.]+)x`).
   - Use atomic temporary files (e.g. `<filename>.part.mp4`) during export; only rename to final target upon exit code 0.
   - Clean up partial files immediately if a job is cancelled or errors.
   - Support hardware encoders: Intel QuickSync (`h264_qsv` with `scale_qsv`), NVIDIA NVENC (`h264_nvenc`), Apple VideoToolbox (`h264_videotoolbox`), or CPU fallback (`libx264`).

3. **Color, Aspect Ratio & Audio Handling**:
   - Guarantee broad MP4 compatibility with `pix_fmt yuv420p`.
   - Guard against odd source dimensions using expressions like `trunc(iw/2)*2:trunc(ih/2)*2`.
   - Ensure audio is converted to AAC at high quality (e.g. 192k) with proper timestamp alignment.
   - For audio synchronization, apply positive audio delay using `adelay` and negative offset using `-ss` or `atrim`.

4. **Studio Preview & Canvas Blitting**:
   - Use a single master HTML5 `<video>` decoder surface blitted to a 2D/WebGL canvas via `ctx.drawImage` in a `requestAnimationFrame` loop (60 FPS).
   - During natural video playback, the HTML5 `<video>` is the authoritative master clock. Never micro-seek `videoRef.currentTime` during playback. Only seek when paused (scrubbing) or on explicit large jumps (> 1.2s).
   - Never invoke heavy canvas filters (like `blur()`) multiple times per frame; keep canvas operations GPU-accelerated and lightweight.
