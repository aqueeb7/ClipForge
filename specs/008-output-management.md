# Specification 008: Output Organization & Export Management

## Status: Completed

## Objective
Implement structured output organization, supporting both single-folder ("flat") and folder-per-clip ("nested") output layouts. Provide post-export metadata reporting and manifest updates with rendered file sizes, stream characteristics, and durations. Establish the end-to-end CLI workflow tests and project documentation for the CLI MVP release milestone.

## Requirements

1. **Output Organization Layouts (`@clipforge/shared` & `@clipforge/media`)**:
   - Add `structure: "flat" | "nested"` to `ExportSettingsSchema` (default: `"flat"`).
     - **Flat**: `Exports/<ProjectName>/<ClipOutputName>.mp4`
     - **Nested**: `Exports/<ProjectName>/<EpisodeFolder>/<ClipOutputName>.mp4` (e.g. `Exports/GTA6/Part_001/Part_001.mp4`).
   - CLI flag `--structure <flat|nested>` on `clipforge clips export`.

2. **Output Metadata & Export Summary (`@clipforge/media/src/batch/queue.ts`)**:
   - Write an `export-summary.json` in the export root after batch completion.
   - Summarizes:
     - Project metadata and export settings.
     - Total rendered clips, total bytes, total duration, start time, completion time.
     - Detailed list of rendered files with file paths, sizes, and validated stream stats.

3. **Post-Export Media Validation (`@clipforge/media/src/validation/export-validator.ts`)**:
   - Enforce post-render validation criteria:
     - File existence and non-zero size.
     - FFprobe stream validation: primary video stream exists, primary audio stream exists.
     - Exact canvas resolution: 1080 × 1920.
     - Codec check: H.264 video, AAC audio.
     - Duration tolerance check: output duration matches expected clip duration within tolerance ($\pm 1.5\text{s}$).

4. **Documentation & Examples (`docs/` & `examples/`)**:
   - Create `docs/cli-reference.md`: complete command manual.
   - Create `docs/troubleshooting.md`: common environment and FFmpeg issues.
   - Create `examples/basic-project.json` and `examples/manual-clips.json`.

5. **End-to-End Acceptance Scenario (Section 14.3)**:
   - Create an end-to-end integration test verifying the complete CLI workflow from inspection to project planning to batch rendering and output organization.

## Acceptance Criteria
- Both flat and nested folder layouts organize exports predictably.
- Export summary JSON is emitted containing complete output metrics.
- Output validation verifies resolution, codec, streams, and duration before marking jobs completed.
- Full documentation and examples are published.
- All unit, integration, and E2E tests pass; 0 TypeScript or lint errors.
