# Specification 003: Audio Synchronization

## Status: Completed

## Objective
Implement reliable audio synchronization for separate audio and embedded audio tracks. Support positive and negative manual millisecond offsets, reference alignment points, drift prevention, short-audio padding, and clip-relative audio window calculations for FFmpeg rendering.

## Requirements

1. **Semantics & Offset Convention**:
   - `audioOffsetMs > 0`: Audio starts **later** than video. (e.g. +1000ms means the audio was started 1 second after video recording began. At video $t=0$, audio has not started yet).
   - `audioOffsetMs < 0`: Audio starts **earlier** than video. (e.g. -1000ms means audio was recording 1 second before video recording began. At video $t=0$, audio is already at $t=1s$).
   - `audioOffsetMs === 0`: Matching start time. Audio and video start simultaneously.

2. **Window Calculation for Any Clip Boundary**:
   - For a clip defined by `[clipStartSeconds, clipEndSeconds]`:
     - Target video duration: $D = \text{clipEndSeconds} - \text{clipStartSeconds}$.
     - Audio timeline reference: $T_{\text{audio}} = T_{\text{video}} - \frac{\text{audioOffsetMs}}{1000}$.
     - Calculate:
       - `leadPaddingMs`: If the clip begins before audio starts ($T_{\text{audioStart}} < 0$), lead silence duration in ms.
       - `sourceSeekSeconds`: Start timestamp in the source audio file to sample from ($\max(0, T_{\text{audioStart}})$).
       - `sourceDurationSeconds`: Duration of audio to extract from the source file.
       - `trailPaddingMs`: If audio ends before the clip finishes, trailing silence duration in ms.
     - In all cases: $\text{leadPadding} + \text{sourceDuration} + \text{trailPadding} = D \pm 0.001\text{s}$ (sample-accurate duration).

3. **FFmpeg Filter & Argument Formulation**:
   - High-fidelity resampling and encoding: preserve original sample rate or resample cleanly to 48000 Hz, encode as AAC 192k for MP4.
   - Support `adelay` for lead delay/silence padding when audio starts later.
   - Support `apad` or `aresample=async=1` to prevent audio drift over long durations.
   - Build safe FFmpeg arguments for combining video stream with synchronized audio stream.

4. **Shared Schemas (`@clipforge/shared`)**:
   - `AudioSyncPlan`:
     - `clipStartSeconds`: number
     - `clipEndSeconds`: number
     - `clipDurationSeconds`: number
     - `audioOffsetMs`: number
     - `leadPaddingMs`: number
     - `sourceSeekSeconds`: number
     - `sourceDurationSeconds`: number
     - `trailPaddingMs`: number
     - `hasAudioSource`: boolean

5. **Testing**:
   - Unit tests covering positive offset, negative offset, zero offset, short audio, audio starting mid-clip, audio ending before clip ends.
   - Integration tests with FFmpeg generating synchronized clips and verifying exact audio duration and stream alignment with FFprobe.

## Acceptance Criteria
- Positive and negative offsets calculate correct source seek and padding parameters.
- Shorter audio files do not fail or truncate video output; silence is padded cleanly.
- Integration tests confirm rendered audio matches video clip duration exactly.
- All unit and integration tests pass; 0 TypeScript or lint errors.
