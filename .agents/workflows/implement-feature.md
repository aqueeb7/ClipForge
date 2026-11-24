# Workflow: Implement Feature

1. Read the relevant specification in `specs/`.
2. Inspect affected modules across `src/`, `src-tauri/`, and `packages/`.
3. If data models change: update schemas in `packages/shared` and types in `src/types/`.
4. If native capabilities change: implement Tauri IPC commands in `src-tauri/src/` and register in `src-tauri/src/lib.rs`.
5. Implement frontend stores/components in `src/stores/` and `src/components/`.
6. Write unit and integration tests.
7. Verify all checks:
   - `npm test` (all Vitest suites)
   - `npm run build` (Vite production bundle)
   - `cd src-tauri; cargo check` (Rust compilation)
8. Verify acceptance criteria before considering the feature done.
