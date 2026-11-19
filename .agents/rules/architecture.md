# Architecture Rules

1. **Layer Separation**:
   - `packages/shared`: Pure schemas, types, constants, error definitions. No runtime dependencies on media or core logic.
   - `packages/core`: Pure business logic, clip planning, job tracking, project management, logging configuration. No direct spawning of FFmpeg or direct shell commands.
   - `packages/media`: FFmpeg/FFprobe process execution, filter-graph builders, hardware encoder probing, media validation.
   - `packages/cli`: User interface, CLI argument parsing, interactive prompts, formatted output. Must never construct FFmpeg filters directly.
   - `apps/desktop` (future): UI layer consuming the same application services as the CLI. No duplicated clipping or media logic.

2. **Local-First & Streaming**:
   - Never load entire video or audio files into Node.js buffers or memory.
   - Process streams via FFmpeg pipelines.
   - Concurrency defaults to 1 (sequential rendering).

3. **No Premature Abstraction**:
   - Keep implementations modular and concrete.
   - Do not create empty or speculative packages until required by a specification.
