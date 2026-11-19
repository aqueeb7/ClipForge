import { describe, it, expect } from "vitest";
import { runEnvironmentDiagnostic } from "./environment.js";
import { checkDirectoryWritable, getDiskSpace } from "../validation/system.js";

describe("Media Environment Diagnostic", () => {
  it("runs diagnostic without throwing and inspects Node environment", async () => {
    const result = await runEnvironmentDiagnostic();
    expect(result).toBeDefined();
    expect(result.environment.nodeVersion).toBe(process.version);
    expect(result.items.length).toBeGreaterThan(0);

    const nodeItem = result.items.find((i) => i.name === "Node.js");
    expect(nodeItem).toBeDefined();
    expect(nodeItem?.status).toBe("ok");
  });

  it("checks directory writability for a temporary path", async () => {
    const isWritable = await checkDirectoryWritable(process.cwd());
    expect(isWritable).toBe(true);
  });

  it("measures disk space on current directory", async () => {
    const space = await getDiskSpace(process.cwd());
    if (space) {
      expect(space.availableBytes).toBeGreaterThan(0);
      expect(space.availableGb).toBeGreaterThan(0);
    }
  });
});
