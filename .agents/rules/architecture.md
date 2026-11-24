# Architecture Rules

1. **System Topology & Layer Separation**:
   - `src-tauri/` (Rust Engine): High-performance native desktop backend. Handles multi-GPU hardware discovery (`gpu.rs`), streaming FFmpeg process management (`ffmpeg.rs`), offline AI & chat replay intelligence (`intelligence.rs`, `normalizer.rs`), stream downloading (`downloader.rs`), multi-platform publishing (`publish.rs`), and native menus (`menu.rs`).
   - `src/` (Frontend Studio Workbench): Desktop studio interface built with SolidJS, Vite, and TailwindCSS. Uses fine-grained reactive signals and store slices (`src/stores/`).
   - `packages/shared`: Pure schemas (Zod), TypeScript interfaces, typed error hierarchies, and shared constants.
   - `packages/core`: Pure business logic, manifest planning, job state machine, project persistence helpers.
   - `packages/media`: Node/CLI FFmpeg filter builders, stream inspection, and environment diagnostics.
   - `packages/cli`: CLI commands (`clipforge doctor`, `inspect`, `clips export`, etc.).

2. **Tri-Engine Decoupled Hardware Architecture**:
   - Hardware decisions are decoupled into 3 independent tiers:
     - **Tier 1 (Video Decode)**: Intel Iris Xe / Integrated GPU via D3D11VA or CPU fallback.
     - **Tier 2 (AI Inference)**: Dedicated GPU (NVIDIA CUDA) or CPU.
     - **Tier 3 (Video Export)**: Hardware video encoding silicon (Intel QuickSync `h264_qsv` or NVENC/AMF/CPU).
   - Never force all workloads onto a single GPU if an integrated or dedicated accelerator is better suited for a specific stage.

3. **3-Zone Studio Workbench Layout**:
   - **Zone 1: Expansive Hero Monitor Stage** (`VideoPreview.tsx`): 16:9 Cinema Wide, 9:16 Vertical, and Dual Split preview modes; interactive cropping bounds; 60 FPS GPU canvas blit engine.
   - **Zone 2: Unified Studio Sidebar** (`UnifiedStudioSidebar.tsx`): 4 tabs (Framing & Canvas, Clips & Shorts Deck, AI & Chat Intelligence, Audio Track & Sync).
   - **Zone 3: Full-Width Multi-Track Timeline** (`TimelineScrubber.tsx`): Sequential Part clips, 9:16 Shorts track, master trim bounds, AI highlight heatbars.

4. **Local-First & Streaming**:
   - Never load entire video or audio files into RAM.
   - Video preview uses streaming `<video>` elements with native Tauri `asset://` URLs.
   - Background rendering executes via FFmpeg pipelines with atomic `.part.mp4` staging and real-time regex progress tracking.

5. **State Management & Persistence**:
   - Use fine-grained SolidJS signals. Memos must be used for collection lookups (e.g. `activeClipId`) to avoid triggering hundreds of reactive re-evaluations during playback.
   - Undo/Redo Engine (`src/stores/history.ts`) captures state snapshots for all timeline mutations, splits, trims, and framing edits.
   - Auto-save sessions debounced to local disk for crash resilience.
