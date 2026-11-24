# Specification 012: Tri-Engine Decoupled Hardware Architecture & 3-Zone Studio Workbench

## Status: Completed

## Objective
Implement Clyptik's professional NLE desktop editing environment. Introduce the Decoupled Tri-Engine Hardware Architecture to maximize dual-GPU laptops (Intel + NVIDIA) and desktop workstations, a 60 FPS GPU canvas blit engine for stutter-free 2K/4K dual-split playback, an expansive 3-Zone Studio Workbench, a stateful Undo/Redo engine, and a native Publishing Hub.

## Architecture & Principles
1. **Tri-Engine Decoupled Hardware Architecture**:
   - Instead of routing all video tasks through a single GPU, Clyptik decouples execution across 3 independent hardware decisions:
     - **Tier 1 (Video Decoding & Preview)**: Primary Display / Integrated GPU (Intel Iris Xe via D3D11VA / DirectX 11) or CPU. Leverages unified system RAM and avoids discrete VRAM bottlenecks.
     - **Tier 2 (AI Inference)**: Dedicated GPU (NVIDIA GeForce MX350 via CUDA) or ONNX/CPU. Powers Whisper speech-to-text, facial tracking, and RAG embeddings.
     - **Tier 3 (Video Export & Encoding)**: Hardware Video Encoder silicon (Intel QuickSync via `h264_qsv` / `scale_qsv`) or NVENC/AMF/CPU. Enables blazingly fast background batch export without stalling the UI.
2. **60 FPS GPU Canvas Blit Engine**:
   - Replaces multi-video-element DOM architectures with a single master HTML5 video decoder blitted onto a 2D/WebGL canvas via `drawImage` in a `requestAnimationFrame` loop.
   - Prevents decoder resource exhaustion and guarantees smooth 60 FPS playback on 1440p and 4K footage.
3. **3-Zone Studio Workbench**:
   - **Zone 1: Expansive Hero Monitor Stage** (left/center) with 16:9 Widescreen, 9:16 Vertical, and Dual Split preview modes; interactive cropping bounds for Facecam and Gameplay.
   - **Zone 2: Unified Studio Sidebar** (right) hosting 4 tabs: Framing & Canvas, Clips & Shorts Deck, AI & Chat Intelligence, and Audio & Sync.
   - **Zone 3: Full-Width Multi-Track Timeline** (bottom) with sequential Part clips, 9:16 Shorts track, master in/out trim bounds, and AI highlight heatbars.

## Functional Requirements
1. **Hardware Discovery & Settings**:
   - Native WMI & `nvidia-smi` hardware discovery in `src-tauri/src/gpu.rs`.
   - Settings Modal with visual hardware topology cards, driver versions, VRAM capacity, and engine selector overrides.
2. **Undo/Redo Engine**:
   - Full snapshot-based stack (`src/stores/history.ts`) recording timeline trims, clip splits, deletes, marker adjustments, and framing changes.
   - Global keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`) and studio header buttons with undo/redo depth tooltips.
3. **Publishing Hub**:
   - In-app publishing modal (`src/components/Modals/PublishModal.tsx`) supporting direct upload to YouTube Shorts, Instagram Reels, and TikTok.
   - Persistent publication history audit log (`publishHistory.ts`) tracking URLs, platforms, timestamps, and status chips on clip cards.
4. **Resilient Studio Cards & Clip Deck**:
   - Fast single-pass `activeClipId` memo preventing per-frame reactive storm over 100+ clips.
   - Structured cards with index badge, timecode range, duration, status badge, output filename, published badges, and action buttons (`Render`, `Open`, `Publish`, `Re-render`).

## Acceptance Criteria
- Hardware profile accurately detects physical GPUs and assigns recommended decode/AI/export engines.
- Video playback remains smooth and synchronized without seek-stalling or freezing during natural playback.
- Dual-split canvas blit runs at 60 FPS with zero extra decoder processes.
- Undo and Redo accurately restore project state across all timeline operations.
- All workspace unit tests (93/93) and Vite production build pass without errors.
