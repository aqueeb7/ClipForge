# Specification 007: Render Queue & Batch Processing

## Status: Completed

## Objective
Implement a robust, recoverable local rendering engine and batch job queue. Process video clips sequentially by default using FFmpeg streaming, parse real-time progress via `-progress pipe:1`, provide clean process cancellation with partial file cleanup, validate rendered outputs with FFprobe before marking jobs completed, and support the `clipforge clips export` command with `--dry-run` and `--only <indices>`.

## Requirements

1. **Progress Tracker & Stream Parser (`@clipforge/media/src/ffmpeg/progress.ts`)**:
   - Parses key-value output emitted by FFmpeg on stdout via `-progress pipe:1`.
   - Extracts:
     - `out_time_us` or `out_time_ms`: current processed position in microseconds/milliseconds.
     - `fps`: current processing speed in frames per second.
     - `speed`: current processing speed multiplier (e.g. `2.5x`).
     - `progress`: `continue` | `end`.
   - Computes progress percentage: $\min(100, \max(0, \frac{\text{processedSeconds}}{\text{targetDurationSeconds}} \times 100))$.
   - Progress events emitted through typed callback / event emitter.

2. **Render Job & Queue Execution (`@clipforge/core/src/jobs/queue.ts`)**:
   - Sequential processing by default (concurrency = 1).
   - Manages states: `pending` -> `queued` -> `running` -> `completed` / `failed` / `cancelled`.
   - Pre-flight checks:
     - Ensure output directory exists and is writable.
     - Check disk space.
     - Detect existing files (skip if already completed unless `--overwrite`).
   - Post-render validation:
     - Verify output file exists and is nonzero size.
     - Inspect output with FFprobe to ensure valid streams, resolution (1080×1920), and expected duration.
   - Cancellation handling:
     - Terminate FFmpeg child process (`SIGTERM` / `kill()`).
     - Delete partially rendered output files so corrupt files are not left behind.
   - Dry-run mode (`--dry-run`):
     - Simulates job queue execution without spawning FFmpeg, outputting planned commands and paths.

3. **FFmpeg Render Command Formulation (`@clipforge/media/src/ffmpeg/renderer.ts`)**:
   - Combines video seeking (`-ss`, `-t`), composition filter graph (blurred/solid/crop canvas + text overlay), audio sync plan filter (`adelay`, `apad`, `atrim`), and encoding parameters (`-c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart`).
   - Attaches `-progress pipe:1 -nostats`.

4. **CLI Export Command (`@clipforge/cli/src/commands/clips.ts`)**:
   - `clipforge clips export <project>`:
     - `--dry-run`: display execution plan and command array without rendering.
     - `--only <indices>`: render only specified clips (e.g. `1,2`).
     - `--overwrite`: re-render already existing output files.
     - `--concurrency <n>`: default 1.
   - Interactive terminal progress display showing clip progress, overall batch percentage, speed, and status.

5. **Testing**:
   - Unit tests for `-progress pipe:1` key-value parsing and percentage calculations.
   - Job queue state transitions and sequential execution.
   - Output validation with FFprobe.
   - Graceful cancellation cleaning up incomplete files.
   - Integration test rendering a real batch of 2 clips using live FFmpeg and verifying both clips complete and validate successfully.

## Acceptance Criteria
- `-progress pipe:1` accurately parses progress, speed, and time.
- Renders multiple clips in sequence with real progress reporting.
- Output validation verifies files with FFprobe before marking jobs `completed`.
- Cancellation immediately terminates process and deletes partially written files.
- `--dry-run` and `--only` options filter and simulate execution predictably.
- Passes all unit and integration tests; 0 TypeScript or lint errors.
