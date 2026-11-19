# Specification 004: Automatic Clipping

## Status: Completed

## Objective
Implement automatic episode generation and clip manifest planning. Translate project configurations into sequential, zero-gap (or configurable overlap) clip manifests using integer-millisecond precision. Implement project file management and the CLI commands `clipforge project init`, `clipforge project validate`, `clipforge plan`, `clipforge clips generate`, and `clipforge clips list`.

## Requirements

1. **Clip Planning Engine (`@clipforge/core`)**:
   - `generateAutomaticClips(options)`:
     - Calculates clip boundaries from `startSeconds` to `endSeconds` (or total video duration).
     - Integer-millisecond timeline precision (`startMs`, `durationMs`, `overlapMs`, `stepMs`) to prevent floating-point drift.
     - Supports optional `overlapSeconds` for narrative continuity.
     - Handles partial final clip: if the final segment length meets or exceeds `minimumFinalClipSeconds`, it is included in the manifest.
     - Sequential episode numbering starting at `startingEpisode` (default 1).
     - Output filename resolution: formats `{project}`, `{episode}` (zero-padded, e.g. `Part_001`), `{index}`, and `{title}` according to `namingPattern`.
   - `generateClipManifest(project: ClipForgeProject)`:
     - Dispatches between automatic mode and manual mode.
     - Produces a versioned, reproducible `ClipManifest`.

2. **Project File Operations (`@clipforge/core`)**:
   - `loadProjectFile(filePath: string)`: Reads and validates a JSON project file with `validateProject`.
   - `saveProjectFile(filePath: string, project: ClipForgeProject)`: Writes formatted JSON.
   - `saveClipManifest(filePath: string, manifest: ClipManifest)`: Saves `manifest.json`.

3. **Shared Models (`@clipforge/shared`)**:
   - `ClipManifestSchema`:
     - `projectId`: string
     - `projectName`: string
     - `totalClips`: number
     - `generatedAt`: string
     - `clips`: Clip[]

4. **CLI Commands (`@clipforge/cli`)**:
   - `clipforge project init`: Creates a new project JSON file with options or interactive defaults.
   - `clipforge project validate <file>`: Validates project schema with helpful feedback.
   - `clipforge plan <file>`: Previews total clips, durations, and boundaries without rendering.
   - `clipforge clips generate <file>`: Generates and persists `manifest.json`.
   - `clipforge clips list <file>`: Displays table of planned clips.

5. **Testing**:
   - 180-second input with 60-second clips produces exactly 3 clips: [0, 60], [60, 120], [120, 180].
   - Partial final clip included when $\ge \text{minimumFinalClipSeconds}$ (e.g. 190s produces 4 clips: [0, 60], [60, 120], [120, 180], [180, 190]).
   - Partial final clip discarded when $< \text{minimumFinalClipSeconds}$ (e.g. 182s with 5s threshold produces 3 clips).
   - Overlap functionality (e.g. 60s clips with 5s overlap: [0, 60], [55, 115], etc.).
   - Filename template substitution and padding (`Part_001`, `Part_002`).
   - Project file read/write roundtrip and validation error handling.

## Acceptance Criteria
- 180-second input produces three 60-second clips with sequential numbering and no unintended gaps.
- Final partial clips are handled predictably according to minimum duration policy.
- All CLI commands (`project init`, `project validate`, `plan`, `clips generate`, `clips list`) are operational.
- Unit and CLI tests pass; 0 TypeScript or lint errors.
