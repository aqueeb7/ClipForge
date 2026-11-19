# Specification 010: Desktop Dashboard & Timeline

## Status: Completed

## Objective
Implement Phase 9: Desktop Dashboard & Timeline for the ClipForge desktop application. Provide an interactive visual timeline scrubber, clip preview player, visual manual clip editor, real-time render queue monitor with progress feedback, and advanced export settings panel.

## Architecture & Principles
1. **Separation of Concerns**:
   - Pure business logic in `@clipforge/core` (planning, manual mutations, schema validation).
   - Render execution orchestration in Tauri IPC backend or mock execution bridge.
   - Vue 3 + Pinia for reactive UI state.
2. **Local-First & Streaming**:
   - Never load entire video files into webview memory; video preview uses streaming `<video>` elements with native file URLs.
   - Progress events are received via typed event listeners (`render-progress`, `render-complete`).

## Functional Requirements
1. **Interactive Visual Timeline**:
   - Timeline bar scaled to total video duration.
   - Draggable playhead scrubber with current timestamp display.
   - Visual clip block segments showing start/end ranges, active selection, and enabled/disabled states.
   - Zoom/pan or proportional segment widths.
2. **Video & Canvas Preview Player**:
   - HTML5 video playback of source video with playhead synchronization.
   - Simulated 9:16 vertical canvas framing mode (shows 1080x1920 preview with blur/solid pillars and text overlays).
   - Play/pause, step controls, and timestamp display.
3. **Manual Clip Editor**:
   - In-point (`I`) and Out-point (`O`) controls based on playhead position.
   - Add new clip, delete clip, duplicate clip, rename clip title.
   - Switch between Automatic Cadence mode and Manual Clipping mode.
4. **Live Export Queue Monitor**:
   - Export triggering ("Export Clips") with pre-flight validation.
   - Real-time progress bars: overall queue progress and active clip progress.
   - Displays encoding metrics: percentage, elapsed time, current fps/speed.
   - Status indicators: `queued`, `rendering`, `completed`, `error`.
5. **Settings Management**:
   - Encoder tuning: CRF, encoding preset, framerate, flat vs nested structure.
   - Overlay font sizing and color options.

## Acceptance Criteria
- Timeline scrubber smoothly synchronizes with video playback.
- Clip segments render accurately on the timeline corresponding to manifest start/end times.
- Manual clip editor allows adding, editing, and deleting clips with immediate manifest recalculation.
- Render queue simulates or executes clip export with live progress updates.
- All workspace builds, TypeScript typechecks, and automated tests pass with 0 errors.
