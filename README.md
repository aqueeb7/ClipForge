# ClipForge

> Local-first video production engine for converting long-form gameplay recordings into publication-ready vertical short-form content.

## Overview

ClipForge automates the process of transforming long horizontal gameplay videos into numbered, synchronized, vertical (9:16) clips for platforms like YouTube Shorts, TikTok, and Instagram Reels — with zero mandatory cloud services or subscription costs.

### Core Principles

1. **Local-first processing**: Everything runs on your machine.
2. **No mandatory cloud dependencies**: Zero reliance on external servers.
3. **Streaming-based FFmpeg execution**: Never load entire videos into RAM.
4. **CLI-first architecture**: Robust, testable command-line foundation before GUI dashboard.
5. **Strict type safety**: Powered by TypeScript and Zod.

## Repository Structure

```text
clipforge/
├── .agents/          # Antigravity rules, workflows, and personas
├── specs/            # Engineering specifications (Spec 001 - Spec 010)
├── packages/
│   ├── shared/       # Zod schemas, TypeScript types, error hierarchy, constants
│   ├── core/         # Business logic, project planning, job state machine, logger
│   ├── media/        # FFmpeg/FFprobe adapters, filter builder, environment diagnostics
│   └── cli/          # Commander CLI application (`clipforge`)
├── tests/            # Test fixtures and integration suites
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or later (v20+ recommended)
- **FFmpeg & FFprobe**: Accessible on your system `PATH` (e.g. via `winget install Gyan.FFmpeg` or `scoop install ffmpeg`)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ClipForge

# Install dependencies across all workspaces
npm install

# Build all packages
npm run build
```

### Environment Diagnostic

Verify that your system meets all requirements:

```bash
npm run doctor
# Or using the built CLI:
node packages/cli/dist/index.js doctor
```

Output:
```text
ClipForge Environment Check
OS: Windows_NT 10.0.26200 | Node: v24.19.0

[OK] Node.js: v24.19.0
[OK] FFmpeg: version 4.4
[OK] FFprobe: version 4.4
[OK] H.264 encoder: libx264 (software)
[INFO] Hardware Acceleration: unavailable (CPU fallback will be used)
[OK] Output Directory: writable (C:\ClipForge\Exports)
[OK] Disk Space: 142.5 GB available

Environment ready.
```

## CLI Commands

```bash
clipforge doctor                   # Verify local tools, codecs, and storage
clipforge inspect --video <path>   # Inspect media streams and metadata
clipforge project init             # Interactively initialize a project configuration
clipforge project validate <file>  # Validate project JSON schema
clipforge plan <file>              # Generate clip manifest without rendering
clipforge clips generate <file>    # Calculate clip boundaries
clipforge clips list <file>        # List planned clips
clipforge clips export <file>      # Batch render vertical clips
```

## Development

```bash
# Typecheck all packages
npm run typecheck

# Run test suite with Vitest
npm test

# Build all workspaces
npm run build
```

## License

MIT
