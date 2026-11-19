# Workflow: Release Check

1. Confirm clean working tree.
2. Run `npm run typecheck` across all workspace packages.
3. Run `npm test` and verify 100% of unit/integration test suites pass.
4. Run `npm run lint`.
5. Run `npm run build` and ensure all packages build output dist bundles.
6. Verify CLI runs `clipforge --help` and `clipforge doctor`.
7. Verify all specification items have corresponding acceptance coverage.
