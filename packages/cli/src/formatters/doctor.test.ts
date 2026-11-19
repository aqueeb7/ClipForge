import { describe, it, expect } from "vitest";
import { formatDoctorResult } from "./doctor.js";
import { DoctorResult } from "@clipforge/shared";

describe("CLI Doctor Formatter", () => {
  it("formats passing doctor results cleanly", () => {
    const mockResult: DoctorResult = {
      passed: true,
      timestamp: new Date().toISOString(),
      items: [
        { name: "Node.js", status: "ok", message: "v24.19.0" },
        { name: "FFmpeg", status: "ok", message: "version 4.4" }
      ],
      environment: {
        os: "Windows",
        nodeVersion: "v24.19.0",
        arch: "x64",
        cwd: "C:/ClipForge"
      }
    };

    const output = formatDoctorResult(mockResult);
    expect(output).toContain("ClipForge Environment Check");
    expect(output).toContain("[OK]");
    expect(output).toContain("Node.js");
    expect(output).toContain("Environment ready.");
  });

  it("formats failing doctor results with remedies", () => {
    const mockResult: DoctorResult = {
      passed: false,
      timestamp: new Date().toISOString(),
      items: [
        {
          name: "FFprobe",
          status: "fail",
          message: "not found",
          remedy: "Install FFprobe via package manager"
        }
      ],
      environment: {
        os: "Windows",
        nodeVersion: "v24.19.0",
        arch: "x64",
        cwd: "C:/ClipForge"
      }
    };

    const output = formatDoctorResult(mockResult);
    expect(output).toContain("[FAIL]");
    expect(output).toContain("FFprobe");
    expect(output).toContain("Install FFprobe via package manager");
    expect(output).toContain("Environment check failed");
  });
});
