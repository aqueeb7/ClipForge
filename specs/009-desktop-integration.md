# Specification 009: Desktop Foundation & Tauri Integration

## Status: Completed

## Objective
Establish the desktop application shell using Tauri 2, Vue 3, TypeScript, Pinia, and Tailwind CSS. Implement the typed command bridge between the desktop frontend and application services, configure native file/directory dialogs, and provide project creation, validation, and media inspection within the desktop shell.

## Requirements

1. **Monorepo Integration (`apps/desktop`)**:
   - Update root `package.json` workspaces to include `"apps/*"`.
   - Setup `apps/desktop` with:
     - `package.json`
     - `vite.config.ts`
     - `tailwind.config.js` & `postcss.config.js`
     - `tsconfig.json` & `tsconfig.node.json`
     - `index.html` & `src/` (Vue 3, Pinia, Tailwind CSS, Lucide icons)
     - `src-tauri/` (Tauri 2 Rust crate, `tauri.conf.json`, `Cargo.toml`, `src/lib.rs`, `src/main.rs`)

2. **Typed Command Bridge (`apps/desktop/src/services/api.ts`)**:
   - Provides strongly typed wrapper functions:
     - `doctorCheck()`: verifies environment status.
     - `inspectSource(filePath)`: retrieves media container and stream info.
     - `initProject(options)`: initializes and validates project configuration.
     - `validateProjectFile(project)`: validates project schema.
     - `planProjectClips(project)`: calculates clip manifest boundaries.
     - `openFileDialog(options)` & `openDirectoryDialog(options)`: native file picker dialogs.
   - Dual-mode support: Seamlessly invokes Tauri IPC (`@tauri-apps/api/core`) in the desktop shell, with web/dev mock fallback for fast UI iteration.

3. **State Management (`apps/desktop/src/stores/project.ts`)**:
   - Pinia store:
     - `currentProject`: reactive `ClipForgeProject | null`.
     - `currentInspection`: `MediaInspectionResult | null`.
     - `currentManifest`: `ClipManifest | null`.
     - `environmentStatus`: `DoctorResult | null`.
     - Actions: `loadMedia`, `createProject`, `updateSettings`, `generatePlan`.

4. **Security & Permissions (Section 13.7)**:
   - Restrict filesystem access to user-selected paths.
   - Never expose arbitrary shell execution or raw FFmpeg strings to the frontend.
   - Typed application commands only.

## Acceptance Criteria
- Desktop app workspace builds cleanly with Vite and Vue 3.
- Tauri 2 Rust crate compiles cleanly with Cargo.
- Native or web dialog allows selecting local media files.
- Project creation and validation work through the UI.
- Clip manifest planning generates and displays planned clips.
- All workspace typechecks and tests pass.
