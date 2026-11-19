# TypeScript Rules

1. **Strict Mode Everywhere**:
   - `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`.
   - Never use `any` unless explicitly justified and wrapped with a boundary guard. Use `unknown` with runtime type narrowing.

2. **Validation at External Boundaries**:
   - All external inputs (CLI args, project files, user configs, JSON manifests) must be validated via Zod schemas before being used in application logic.
   - Types must be inferred or synchronized with Zod schemas.

3. **Explicit Return Types & Exports**:
   - Exported functions, public classes, and API methods must declare explicit return types.
   - All modules use NodeNext ESM. Use explicit `.js` extensions in relative imports if compiled directly with `tsc`.
