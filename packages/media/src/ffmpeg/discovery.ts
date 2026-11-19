import { spawn } from "node:child_process";
import { KNOWN_HARDWARE_ENCODERS } from "@clipforge/shared";

export interface FFmpegInfo {
  available: boolean;
  path?: string;
  version?: string;
  encoders: string[];
  hardwareEncoders: {
    nvenc: boolean;
    qsv: boolean;
    amf: boolean;
  };
}

export function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", () => {
        resolve({ stdout, stderr, exitCode: -1 });
      });

      child.on("close", (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
    } catch {
      resolve({ stdout: "", stderr: "", exitCode: -1 });
    }
  });
}

export async function detectFFmpeg(customPath?: string): Promise<FFmpegInfo> {
  const binary = customPath ?? process.env["FFMPEG_PATH"] ?? "ffmpeg";

  const { stdout, stderr, exitCode } = await runProcess(binary, ["-version"]);
  if (exitCode !== 0 && stderr === "" && stdout === "") {
    return {
      available: false,
      encoders: [],
      hardwareEncoders: { nvenc: false, qsv: false, amf: false }
    };
  }

  const output = stdout || stderr;
  const versionMatch = output.match(/ffmpeg version\s+([^\s]+)/i);
  const version = versionMatch ? (versionMatch[1] ?? "unknown") : "unknown";

  // Check encoders
  const encodersResult = await runProcess(binary, ["-encoders"]);
  const encodersText = encodersResult.stdout || encodersResult.stderr;

  const encoders: string[] = [];
  const lines = encodersText.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*V[A-Z.]{5}\s+([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      encoders.push(match[1]);
    }
  }

  return {
    available: true,
    path: binary,
    version,
    encoders,
    hardwareEncoders: {
      nvenc: encoders.includes(KNOWN_HARDWARE_ENCODERS.NVENC_H264),
      qsv: encoders.includes(KNOWN_HARDWARE_ENCODERS.QSV_H264),
      amf: encoders.includes(KNOWN_HARDWARE_ENCODERS.AMF_H264)
    }
  };
}
