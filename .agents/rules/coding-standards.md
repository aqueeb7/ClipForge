# Coding Standards

1. **Naming Conventions**:
   - TypeScript Files: `kebab-case.ts` or `PascalCase.tsx` for SolidJS components.
   - Rust Files: `snake_case.rs`.
   - Classes and Types: `PascalCase`.
   - Functions and Variables: `camelCase` (TypeScript), `snake_case` (Rust).
   - Constants: `UPPER_SNAKE_CASE` or `as const` objects.
   - Tauri IPC Commands: `snake_case` in Rust (`#[tauri::command] fn get_tri_engine_hardware_info(...)`), invoked via matching string in TypeScript.

2. **Error Handling**:
   - TypeScript: Throw structured `ClipForgeError` with typed `ErrorCode`. Include actionable diagnostic suggestions and relevant paths.
   - Rust: Return `Result<T, String>` for all Tauri IPC commands with descriptive error messages. Never use `unwrap()` or `expect()` in production paths that handle external I/O or media files.

3. **Reactivity & Performance Standards (SolidJS)**:
   - Avoid creating signals inside loops or frequently rendered lists.
   - For collections of 100+ items (like clips or chat messages), compute active states via a single top-level memo (e.g. `const activeClipId = createMemo(...)`) rather than subscribing every individual item to rapid signals like `currentTime()`.
   - Use `shrink-0` and `whitespace-nowrap` on badges and timestamps to prevent visual card disorientation.

4. **Logging**:
   - Use Pino structured logger in Node/CLI packages.
   - In Rust, use `println!` or structured tracing with timestamps.
   - In the frontend, avoid noisy `console.log` in render paths.
