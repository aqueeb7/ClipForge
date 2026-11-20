import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ["src/**/*.test.ts", "packages/**/src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "html"]
    }
  }
});
