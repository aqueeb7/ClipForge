# Workflow: Implement Feature

1. Read the relevant specification in `specs/`.
2. Inspect affected modules across `packages/`.
3. Create or update types/schemas in `packages/shared`.
4. Implement business logic in `packages/core` or media processing in `packages/media`.
5. Expose commands or interface in `packages/cli`.
6. Write unit and integration tests.
7. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
8. Verify acceptance criteria before considering the feature done.
