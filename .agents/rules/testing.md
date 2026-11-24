# Testing Rules

1. **Test-Driven & Multi-Tier Verification**:
   - Write tests alongside each module, store, and specification milestone.
   - Run unit tests on all data transformations, schema validations, boundary algorithms, and error scenarios.
   - Run Rust backend checks (`cargo check`) whenever Tauri code or IPC signatures change.

2. **Fixtures & Isolation**:
   - Use small synthetic test fixtures generated programmatically with FFmpeg or mocked.
   - Never use massive real-world footage (e.g. 19GB files) in automated CI or unit test suites.
   - Tests must run deterministically and clean up any temporary directories.

3. **Coverage & Boundary Conditions**:
   - Test happy paths and boundary conditions: 0 duration, partial final clip, negative audio offset, unicode paths, spaces in paths, seek drift tolerances, and undo/redo stacks.
   - Current benchmark: All 93 Vitest test suites (in `packages/` and `src/`) must pass with 100% success rate.
