# Specification 005: Manual Clipping

## Status: Completed

## Objective
Implement manual clipping support allowing users to define arbitrary, decimal timestamp boundaries, custom titles, enabled/disabled clip states, clip reordering, and duplicate clips. Provide robust validation against source media duration and boundary ordering, along with CLI commands to add, remove, and toggle manual clips in a project.

## Requirements

1. **Manual Clipping Engine (`@clipforge/core`)**:
   - `generateManualClips(settings, sourceDuration, projectId, projectName, namingPattern)`:
     - Handles arbitrary clip durations with decimal precision (milliseconds).
     - Validates each clip: `start < end` and `end <= sourceDuration`.
     - Supports optional custom titles (e.g. "First mission", "Police chase").
     - Supports `enabled: boolean` state per clip (disabled clips are kept in the manifest with `enabled: false` and status `pending`).
     - Supports duplicate timestamps / ranges while assigning distinct sequential IDs and output file names.
     - Preserves user-defined clip order.
     - Formats output filenames using `resolveClipFilename`.

2. **Project Mutations (`@clipforge/core`)**:
   - `addManualClip(project, clipItem)`: Adds a new manual clip and saves/validates the project.
   - `removeManualClip(project, clipIndex)`: Removes a clip by 1-based index.
   - `toggleManualClip(project, clipIndex, enabled?)`: Enables or disables a clip by 1-based index.

3. **CLI Commands (`@clipforge/cli`)**:
   - `clipforge clips add <project> --start <seconds> --end <seconds> [--title <title>]`
   - `clipforge clips remove <project> --index <1-based index>`
   - `clipforge clips toggle <project> --index <1-based index> [--enable|--disable]`
   - `clipforge clips list <project>`: Shows enabled/disabled status badge in the list.

4. **Testing**:
   - Arbitrary decimal timestamps (e.g. 12.5s to 73.2s).
   - Custom titles resolved into output filenames.
   - Disabled clips marked properly in manifest.
   - Validation rejects `start >= end`.
   - Validation rejects `start < 0` or `end > sourceDuration`.
   - Adding, removing, and toggling clips mutates project and manifest accurately.

## Acceptance Criteria
- Custom timestamps produce exact clip durations.
- Invalid boundaries (start >= end or out of bounds) are rejected with typed `INVALID_CLIP_RANGE`.
- Enabled/disabled clip state is preserved and reflected in manifests and CLI output.
- All unit and CLI tests pass; 0 TypeScript or lint errors.
