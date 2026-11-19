# Specification 002: Media Inspection

## Status: Completed

## Objective
Implement fast, non-decoding media inspection for video and audio files using FFprobe, extracting container metadata, video stream parameters (resolution, frame rate, CFR/VFR status, codec, pixel format), and audio stream properties (channels, sample rate, codec, bitrate). Expose this capability through the application layer and the `clipforge inspect` CLI command.

## Requirements
1. **Shared Schemas (`@clipforge/shared`)**:
   - `VideoStreamInfoSchema`:
     - `index`: number
     - `codec`: string
     - `profile`?: string
     - `pixelFormat`?: string
     - `width`: number
     - `height`: number
     - `aspectRatio`: string (e.g. "16:9")
     - `frameRate`: number (floating-point nominal fps)
     - `frameRateFraction`: string (e.g. "60/1" or "30000/1001")
     - `isVariableFrameRate`: boolean
     - `durationSeconds`: number
     - `bitrateKbps`?: number
     - `startTimestampSeconds`: number
   - `AudioStreamInfoSchema`:
     - `index`: number
     - `codec`: string
     - `profile`?: string
     - `sampleRate`: number (Hz)
     - `channels`: number
     - `channelLayout`?: string
     - `bitrateKbps`?: number
     - `durationSeconds`: number
     - `startTimestampSeconds`: number
   - `ContainerInfoSchema`:
     - `format`: string
     - `durationSeconds`: number
     - `fileSizeBytes`: number
     - `bitrateKbps`?: number
     - `startTimestampSeconds`: number
   - `MediaInspectionResultSchema`:
     - `filePath`: string
     - `container`: ContainerInfo
     - `videoStreams`: VideoStreamInfo[]
     - `audioStreams`: AudioStreamInfo[]
     - `primaryVideo`?: VideoStreamInfo
     - `primaryAudio`?: AudioStreamInfo

2. **Media Engine (`@clipforge/media`)**:
   - `ffprobe/inspector.ts`:
     - Function `inspectMedia(filePath: string, options?: { ffprobePath?: string }): Promise<MediaInspectionResult>`
     - Execute FFprobe via safe `spawn` argument array:
       `["-v", "error", "-show_format", "-show_streams", "-of", "json", filePath]`
     - Non-decoding: only parses container and stream headers without reading all video frames into RAM.
     - Detects VFR vs CFR: compares `r_frame_rate` (nominal rate) with `avg_frame_rate`.
     - Validates file existence using `fs.stat`; throws `ClipForgeError(ErrorCode.FILE_NOT_FOUND)`.
     - Rejects non-media or corrupt files with `ClipForgeError(ErrorCode.INVALID_MEDIA_FILE)`.

3. **CLI Interface (`@clipforge/cli`)**:
   - `clipforge inspect --video <path> [--audio <path>] [--json]`
   - Formatter `formatInspectionResult(result: MediaInspectionResult): string`:
     - File path & Container details (Format, Duration, Size, Bitrate)
     - Video details (Resolution, Aspect Ratio, Frame Rate, CFR/VFR, Codec, Pixel Format)
     - Audio details (Codec, Sample Rate, Channels, Layout)
   - Supports inspecting both video and optional separate audio in one command.

4. **Testing**:
   - Test synthetic video created via FFmpeg `lavfi` filter (e.g. 1920x1080 60fps with synthetic audio).
   - Test inspection of video-only media.
   - Test inspection of audio-only media.
   - Test error handling on missing files.
   - Test error handling on invalid text files.
   - Verify CLI formatter and JSON output mode.

## Acceptance Criteria
- Correctly inspects sample media and extracts valid streams, resolution, and duration.
- Correctly detects frame rate and identifies constant vs variable frame rate.
- Handles invalid file paths with typed `FILE_NOT_FOUND`.
- Handles unsupported/non-media formats with typed `INVALID_MEDIA_FILE`.
- Passes all unit and integration tests.
- Passes `npm run typecheck` and `npm run lint`.
