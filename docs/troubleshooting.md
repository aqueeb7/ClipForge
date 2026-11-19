# Troubleshooting Guide

Common issues and solutions when running ClipForge.

## 1. Toolchain & Environment

### `FFMPEG_NOT_FOUND` or `FFPROBE_NOT_FOUND`
- **Cause**: FFmpeg or FFprobe binaries are not found in your system's `PATH`.
- **Solution**:
  - Run `winget install Gyan.FFmpeg` or `scoop install ffmpeg`.
  - Alternatively, configure explicit paths via environment variables:
    ```bash
    set FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
    set FFPROBE_PATH=C:\ffmpeg\bin\ffprobe.exe
    ```
  - Verify with: `clipforge doctor`.

## 2. Storage & Permissions

### `DESTINATION_NOT_WRITABLE`
- **Cause**: The export destination directory cannot be created or written to due to operating system permission restrictions.
- **Solution**: Ensure your user account has write permissions to the destination folder, or pass `--out-dir` pointing to a local user folder (such as `C:\Users\<User>\Videos\ClipForge`).

### `INSUFFICIENT_DISK_SPACE`
- **Cause**: The destination drive has less than 1.0 GB of free space available.
- **Solution**: Free up disk space on the target drive before exporting long 4K/60fps batches.

## 3. Media & Processing

### `INVALID_CLIP_RANGE`
- **Cause**: Clip end timestamp is less than or equal to start timestamp, or exceeds source media duration.
- **Solution**: Inspect the source video duration first with `clipforge inspect --video <path>` and verify that manual clip boundaries fall strictly within `0` to the total source duration.

### Audio Synchronization Offset
- **Positive Offset (`audioOffsetMs > 0`)**: Audio started later than video. Silence will be padded at the beginning.
- **Negative Offset (`audioOffsetMs < 0`)**: Audio started earlier than video. The audio track will seek into the recording to synchronize with video start.
