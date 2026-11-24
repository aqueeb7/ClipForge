# Workflow: Release Check

1. Confirm clean working tree (`git status`).
2. Run `npm test` and verify 100% of unit/integration test suites pass (93/93 tests).
3. Run `npm run build` and ensure Vite frontend bundle compiles with 0 errors.
4. Run `cd src-tauri; cargo check` and verify Rust backend compiles cleanly.
5. Verify CLI commands run (`node packages/cli/dist/index.js doctor`).
6. Verify synchronized mirror workspace (e.g. `F:\ClipForge`).
7. Confirm all specification items have corresponding acceptance coverage.
