# Specification 006: Vertical Composition

## Status: Completed

## Objective
Implement high-fidelity 9:16 vertical composition (1080×1920) for converting horizontal gameplay footage into short-form content. Support three composition modes:
1. Centered gameplay with Gaussian blurred background (default).
2. Centered gameplay with solid background (fast pad mode).
3. Full-screen crop with adjustable positioning.
Include configurable text overlays for brand name, project title, and episode numbering with safe margins.

## Requirements

1. **Canvas & Geometry Specifications**:
   - Canvas output dimensions: exactly 1080 × 1920 (`width = 1080`, `height = 1920`).
   - Aspect ratio: 9:16.
   - Pixel format: `yuv420p` (compatible with all mobile and web players).
   - In contain mode, original video aspect ratio must be strictly preserved without stretching or squishing.

2. **Composition Modes (`@clipforge/media/src/filters/composition.ts`)**:
   - **Mode A: Blurred Background (`blur`)**:
     - Split source stream: `split=2[bg_src][fg_src]`
     - Background stream: scale to fill 1080×1920, center crop, apply Gaussian blur (`gblur=sigma=25`), and darken (`eq=brightness=-0.15`).
     - Foreground stream: scale to fit 1080×1920 without cropping (`force_original_aspect_ratio=decrease`).
     - Overlay: center foreground on blurred background `overlay=(W-w)/2:(H-h)/2`.
   - **Mode B: Solid Background (`solid`)**:
     - Scale gameplay to fit 1080×1920 (`force_original_aspect_ratio=decrease`).
     - Pad canvas to 1080×1920 with background color (e.g. `#000000` or custom hex).
   - **Mode C: Full-Screen Crop (`crop`)**:
     - Scale footage to fill 1080×1920 (`force_original_aspect_ratio=increase`).
     - Crop to 1080×1920 with adjustable horizontal and vertical offset anchors.

3. **Text & Episode Branding Overlays (`@clipforge/media/src/filters/overlay.ts`)**:
   - Configurable brand title, episode label, and episode index.
   - Text escaping: properly escape colons, single quotes, backslashes, and special filter characters.
   - Box background support: optional semi-transparent bounding box (`box=1:boxcolor=black@0.5`) for maximum legibility against bright gameplay.
   - Safe margin placement: header text in top safe area ($y \approx 120\text{px}$) and episode badge ($y \approx 180\text{px}$ or above gameplay).

4. **Integration with Media Engine**:
   - `buildVideoFilterGraph(options)`: Compiles the full video filter graph combining composition mode and overlay filters.
   - Fully testable without executing FFmpeg.
   - Integration tests executing FFmpeg on synthetic fixtures and inspecting the output dimensions (1080×1920) with FFprobe.

## Acceptance Criteria
- All three composition modes generate valid, syntax-clean FFmpeg filter graphs.
- Output resolution is verified to be 1080 × 1920 with `yuv420p` pixel format.
- Original gameplay aspect ratio is preserved in `blur` and `solid` modes.
- Text overlays render cleanly within safe margins without FFmpeg syntax errors.
- Unit and integration tests pass; 0 TypeScript or lint errors.
