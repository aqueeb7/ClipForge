# TypeScript Rules

1. **Strict Mode Everywhere**:
   - `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`.
   - Never use `any` unless explicitly justified and wrapped with a boundary guard. Use `unknown` with runtime type narrowing.

2. **Validation at External Boundaries**:
   - All external inputs (CLI args, project files, user configs, JSON manifests, Tauri IPC payloads) must be validated via Zod schemas or typed guards before being used in application logic.
   - Types must be inferred or synchronized with Zod schemas (`z.infer<typeof Schema>`).

3. **Explicit Return Types & Exports**:
   - Exported functions, public classes, and API service methods must declare explicit return types.
   - All modules use NodeNext ESM. Use explicit `.js` extensions in relative imports if compiled directly with `tsc`.

4. **Tauri IPC Typing**:
   - Keep IPC command wrappers in `src/services/api.ts` strictly typed with matching payloads in `src/types/index.ts` and `src-tauri/src/`.
