# Specification 001: Project Foundation

## Status: Completed

## Objective
Establish the foundational monorepo structure, build configuration, TypeScript strict compiler options, shared data models and schemas, error hierarchy, logging framework, and the initial CLI entry point with `clipforge --help` and `clipforge doctor`.

## Requirements
1. **Monorepo Architecture**:
   - npm workspaces with `packages/shared`, `packages/core`, `packages/media`, and `packages/cli`.
   - NodeNext ESM resolution, TypeScript strict mode with composite project references.
   - Vitest test runner configuration.
2. **Shared Package (`@clipforge/shared`)**:
   - Zod schemas and TypeScript types for `ClipForgeProject`, `MediaSource`, `Clip`, `CompositionSettings`, `ExportSettings`, `RenderJob`, and `DoctorResult`.
   - Typed error system with `ClipForgeError` and `ErrorCode`.
   - Application constants and default configurations.
3. **Core Package (`@clipforge/core`)**:
   - Structured logging interface using Pino.
   - Core configuration and project validation helpers.
4. **Media Package (`@clipforge/media`)**:
   - Diagnostic engine to check Node.js, FFmpeg, FFprobe, video encoders, output writability, and available disk space.
5. **CLI Package (`@clipforge/cli`)**:
   - Commander-based CLI executable (`clipforge`).
   - Implement `clipforge --help` and `clipforge --version`.
   - Implement `clipforge doctor` with human-readable diagnostic checks.
6. **Agent Rules & Workflows**:
   - Documented rules and workflows under `.agents/`.

## Acceptance Criteria
- Clean dependency installation.
- Successful TypeScript compilation across all packages.
- All unit tests pass.
- CLI executable runs `--help` and displays standard commands.
- CLI `doctor` runs and accurately reports local environment state.
