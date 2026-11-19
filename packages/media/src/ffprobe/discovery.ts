import { runProcess } from "../ffmpeg/discovery.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export interface FFprobeInfo {
  available: boolean;
  path?: string;
  version?: string;
}

export async function detectFFprobe(customPath?: string): Promise<FFprobeInfo> {
  // 1. Check custom path or environment variable
  const explicitPath = customPath ?? process.env["FFPROBE_PATH"];
  if (explicitPath) {
    const res = await probeBinary(explicitPath);
    if (res.available) return res;
  }

  // 2. Check system PATH
  const systemRes = await probeBinary("ffprobe");
  if (systemRes.available) {
    return systemRes;
  }

  // 3. Fallback to @ffprobe-installer/ffprobe if installed
  try {
    const installer = require("@ffprobe-installer/ffprobe") as { path?: string; version?: string };
    if (installer && installer.path) {
      const fallbackRes = await probeBinary(installer.path);
      if (fallbackRes.available) {
        return fallbackRes;
      }
    }
  } catch {
    // Optional fallback unavailable
  }

  return {
    available: false
  };
}

async function probeBinary(binaryPath: string): Promise<FFprobeInfo> {
  const { stdout, stderr, exitCode } = await runProcess(binaryPath, ["-version"]);
  if (exitCode !== 0 && stderr === "" && stdout === "") {
    return { available: false };
  }

  const output = stdout || stderr;
  const versionMatch = output.match(/ffprobe version\s+([^\s]+)/i);
  const version = versionMatch ? (versionMatch[1] ?? "unknown") : "unknown";

  return {
    available: true,
    path: binaryPath,
    version
  };
}
