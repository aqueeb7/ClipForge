# Media Processing Rules

1. **Process Execution Safety**:
   - Use `child_process.spawn` with an argument array (`string[]`).
   - Never construct shell commands via string concatenation of user-provided paths.

2. **FFmpeg Execution Standards**:
   - Parse machine-readable progress via `-progress pipe:1`.
   - Never estimate job progress by wall-clock time alone.
   - Support graceful cancellation: terminate child process and delete partially written output files.
   - Do not overwrite existing completed renders without explicit permission.

3. **Color, Aspect Ratio & Audio Handling**:
   - Ensure compatible pixel formats (`yuv420p` for broad MP4 compatibility).
   - Guard against odd source dimensions using scaling expressions or padding.
   - Ensure audio is converted to AAC at high quality (e.g. 192k) with proper timestamp alignment.
   - Validate outputs after rendering with FFprobe before marking jobs as complete.
