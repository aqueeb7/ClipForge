# Workflow: Add FFmpeg Filter

1. Define the filter specification and options schema in `packages/shared`.
2. Implement the filter builder function in `packages/media/src/filters/`.
3. Ensure all filter graph arguments escape special characters (e.g. `\`, `:`, `,`, `[`).
4. Provide unit tests validating exact filter string generation across parameter combinations.
5. Provide an integration test verifying FFmpeg parses the filter graph cleanly without syntax errors.
