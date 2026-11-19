# Coding Standards

1. **Naming Conventions**:
   - Files: `kebab-case.ts`.
   - Classes and Types: `PascalCase`.
   - Functions and Variables: `camelCase`.
   - Constants: `UPPER_SNAKE_CASE` or `as const` objects in `camelCase`/`UPPER_SNAKE_CASE`.

2. **Errors**:
   - Throw structured `ClipForgeError` with typed `ErrorCode`.
   - Include actionable diagnostic suggestions and relevant paths.

3. **Logging**:
   - Use Pino structured logger.
   - Never use raw `console.log` in library code (`packages/core`, `packages/media`, `packages/shared`).
   - CLI uses structured formatters and designated stdout/stderr writers.
