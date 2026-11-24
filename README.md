# Clyptik

> **Local-First Desktop Video Production Studio** for transforming long-form gameplay streams and VODs into viral, publication-ready vertical short-form content.

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue.svg)](https://tauri.app/)
[![SolidJS](https://img.shields.io/badge/SolidJS-1.8+-2c4f7c.svg)](https://www.solidjs.com/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![Vitest](https://img.shields.io/badge/Tests-93%20Passed-brightgreen.svg)](https://vitest.dev/)
[![Hardware Acceleration](https://img.shields.io/badge/Hardware-Tri--Engine%20Decoupled-purple.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

**Clyptik** (formerly ClipForge) is an open-source, local-first desktop NLE studio engineered specifically for streamers and content creators. It automates slicing multi-hour horizontal broadcasts into sequential episodic chapters ("Stream Parts") and viral stacked vertical (9:16) clips for YouTube Shorts, TikTok, and Instagram Reels — with **zero mandatory cloud services, zero recurring API fees, and complete data privacy**.

Everything executes on your local machine using a high-performance **Tauri v2 + Rust** media engine, a modern **SolidJS** reactive studio interface, and a **Decoupled Tri-Engine Hardware Architecture**.

---

## Key Features

### 1. Tri-Engine Decoupled Hardware Architecture
Traditional video tools lock all processing into a single GPU, causing VRAM starvation or thermal throttling on dual-GPU laptops (e.g. Intel Iris Xe + NVIDIA GeForce MX350). Clyptik decouples hardware allocation into three independent compute tiers:
- **Tier 1 (Video Decoding & Preview)**: Primary Display / Integrated GPU (Intel Iris Xe via `d3d11va` / DirectX 11) or CPU. Leverages high-capacity unified system RAM to decode 2K/4K streams smoothly without consuming discrete GPU memory.
- **Tier 2 (AI Inference)**: Dedicated GPU (NVIDIA CUDA) or ONNX/CPU. Powers Whisper speech-to-text auto-captions, face tracking, and chat/transcript RAG vector embeddings.
- **Tier 3 (Video Export & Encoding)**: Hardware Video Encoder silicon (Intel QuickSync via `h264_qsv` / `scale_qsv`) or NVENC/AMF/CPU. Enables blazingly fast background batch export while keeping the timeline responsive.

### 2. 3-Zone Studio Workbench Layout
Designed from the ground up to eliminate UI disorientation and deliver a clutter-free NLE editing workflow:
- **Zone 1: Expansive Hero Monitor Stage**:
  - Cinema 16:9 Widescreen, 9:16 Vertical, and Dual Split preview modes.
  - **60 FPS GPU Canvas Blit Engine**: Replaces multi-video-element architectures with a single master hardware decoder blitted onto a 2D/WebGL canvas, guaranteeing buttery-smooth 2K/4K preview.
  - Interactive on-screen bounding boxes for repositioning and scaling Facecam and Gameplay zones.
- **Zone 2: Unified Studio Sidebar**:
  - **Framing & Canvas**: Stacking templates (`stacked_split`, `split_50_50`, `pan_scan`, `blur_fill`), quick facecam positioning presets (Top-Left, Top-Right, Center), and customizable channel branding overlays.
  - **Clips & Shorts Deck**: Two-tier command hub for Stream Parts and 9:16 Shorts, filter pills (`All`, `Ready`, `Queued`), single-pass active playhead tracking, and batch rendering.
  - **AI & Chat Intelligence**: Ranked viral highlight cards and real-time synchronized live chat replay.
  - **Audio Track & Synchronization**: Embedded stream audio, high-fidelity dedicated audio tracks, millisecond-precision audio delay compensation (`adelay`), and live waveforms.
- **Zone 3: Full-Width Multi-Track Timeline**:
  - Sequential Part clips track with interactive trim handles (`Ctrl+K` to split at playhead).
  - 9:16 Shorts track with custom In/Out range markers.
  - Master stream prep trim boundaries (In-Point / Out-Point / Patch Master).
  - AI highlight heatbars and chat density distribution graphs.

### 3. Local Offline AI & Live Chat Intelligence
- Ingests synchronized chat replay logs (`.jsonl`, `.json`, `.txt`, `.srt`) from YouTube, Twitch, and Kick.
- Computes rolling message density and multi-modal composite heat scores based on message velocity, laugh tokens (`OMEGALUL`, `KEKW`, `LMAO`, `LOL`), and sentiment spikes.
- Visual heatmap rendered directly onto the timeline with click-to-seek navigation.
- One-click viral short generation from detected peak moments.

### 4. Stateful Undo/Redo Engine
- Full snapshot history stack (`src/stores/history.ts`) capturing timeline trims, clip splits, deletes, in/out marker shifts, and framing template changes.
- Global desktop shortcuts: `Ctrl+Z` (Undo), `Ctrl+Y` / `Ctrl+Shift+Z` (Redo).
- Studio header indicators with visual step depth tooltips.

### 5. Direct Multi-Platform Publishing Hub
- In-app publishing modal (`PublishModal.tsx`) for direct upload to **YouTube Shorts**, **Instagram Reels**, and **TikTok**.
- Persistent local publishing audit log (`publishHistory.ts`) tracking upload timestamps, platform URLs, and direct "View on Platform" links.

---

## Repository Structure

```text
Clyptik/
├── src-tauri/                 # High-Performance Native Rust Desktop Engine (Tauri v2)
│   ├── src/
│   │   ├── gpu.rs             # Multi-GPU hardware discovery & Tri-Engine profile manager
│   │   ├── ffmpeg.rs          # Streaming FFmpeg process manager, atomic .part.mp4 staging
│   │   ├── intelligence.rs    # Offline AI moment detection & multi-modal density scoring
│   │   ├── downloader.rs      # Integrated stream & VOD downloading with real-time ETA
│   │   ├── publish.rs         # Direct publishing hub (YouTube Shorts, Instagram, TikTok)
│   │   ├── normalizer.rs      # Chat replay parser (.jsonl, .json, .txt, .srt)
│   │   ├── menu.rs            # Native desktop menus & keyboard accelerators
│   │   └── lib.rs             # Tauri command registration & lifecycle handlers
│   └── Cargo.toml             # Rust dependencies
├── src/                       # Desktop Studio Workbench (SolidJS + TailwindCSS + Vite)
│   ├── components/
│   │   ├── Header.tsx                 # Studio header, Tri-Engine badge, undo/redo controls
│   │   ├── VideoPreview.tsx           # 60fps GPU canvas blit preview, interactive cropping
│   │   ├── UnifiedStudioSidebar.tsx   # 4-tab studio workbench sidebar
│   │   ├── TimelineScrubber.tsx       # Multi-track timeline, trim handles, AI heatbars
│   │   ├── ClipPlanList.tsx           # High-performance structured clip cards & batch actions
│   │   ├── HighlightCandidatesDrawer.tsx # AI viral highlight cards
│   │   ├── ChatReplayDrawer.tsx       # Live synchronized chat replay view
│   │   ├── MediaPool.tsx              # Media ingest, stream prep, and metadata cards
│   │   └── Modals/                    # Settings, Publish, New Project, Render Queue modals
│   ├── stores/                        # Fine-grained reactive signals (project, timeline, history)
│   ├── services/                      # Tauri IPC bridge & local persistence
│   └── types/                         # TypeScript interfaces
├── packages/                  # Modular TypeScript Core & CLI Workspaces
│   ├── shared/                # Zod schemas, TypeScript types, error hierarchy, constants
│   ├── core/                  # Business logic, clip planning, job state machine, logger
│   ├── media/                 # FFmpeg filter builder, environment diagnostics
│   └── cli/                   # Standalone Commander CLI application (`clipforge`)
├── specs/                     # Engineering specifications (Spec 001 - Spec 012)
├── .agents/                   # Customization rules, workflows, and personas
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or later (v20+ recommended)
- **Rust**: 1.75+ with Cargo (`rustup default stable`)
- **FFmpeg & FFprobe**: Accessible on your system `PATH` (e.g. via `winget install Gyan.FFmpeg` or `scoop install ffmpeg`)

### Installation

```bash
# Clone the repository
git clone https://github.com/aqueeb7/ClipForge.git Clyptik
cd Clyptik

# Install frontend and workspace dependencies
npm install
```

### Running the Desktop Studio App

```bash
# Start in desktop development mode (Tauri v2 + Vite Hot Reload)
npm run tauri dev

# Or run frontend-only preview in browser
npm run dev
```

### Building for Production

```bash
# Build frontend web assets
npm run build

# Check Rust backend compilation
cd src-tauri
cargo check

# Compile standalone desktop installer / executable (.exe on Windows)
cd ..
npm run tauri build
```

---

## Automated Test Suite

Clyptik maintains a 100% passing automated test suite with 93 unit and integration tests across all workspace packages and frontend stores:

```bash
# Run complete test suite with Vitest
npm test

# Run type checking across all workspace packages
npm run typecheck
```

---

## CLI Engine Usage

Clyptik also provides a full-featured command-line interface for headless server workflows and scripting:

```bash
# Run system diagnostic
node packages/cli/dist/index.js doctor

# Inspect media file streams & metadata
node packages/cli/dist/index.js inspect --video <path>

# Generate clip manifest without rendering
node packages/cli/dist/index.js plan <project.json>

# Batch render vertical clips via CLI
node packages/cli/dist/index.js clips export <project.json>
```

---

## Specifications

Complete architectural specifications are maintained in [`specs/`](file:///c:/Users/DELL/OneDrive/Desktop/ClipForge/specs):
- **Spec 001**: Project Foundation & Monorepo Structure
- **Spec 002**: Media Inspection & Metadata Extraction
- **Spec 003**: Audio Synchronization & Delay Compensation
- **Spec 004**: Automatic Cadence-Based Clipping
- **Spec 005**: Manual Timeline Clipping & Region Definition
- **Spec 006**: Vertical 9:16 Video Composition & Stacking
- **Spec 007**: Render Queue & Job Execution State Machine
- **Spec 008**: Output Management & Atomic Export
- **Spec 009**: Desktop Application Integration (Tauri Bridge)
- **Spec 010**: Desktop Dashboard & Interactive Timeline
- **Spec 011**: Offline Intelligence & Chat Replay Engine
- **Spec 012**: Tri-Engine Decoupled Hardware Architecture & 3-Zone Studio Workbench

---

## License

MIT © Clyptik Contributors
