import os from "node:os";
import path from "node:path";
import { DoctorResult, DiagnosticItem } from "@clipforge/shared";
import { detectFFmpeg } from "../ffmpeg/discovery.js";
import { detectFFprobe } from "../ffprobe/discovery.js";
import { checkDirectoryWritable, getDiskSpace } from "../validation/system.js";

export interface DoctorOptions {
  ffmpegPath?: string;
  ffprobePath?: string;
  outputDirectory?: string;
}

export async function runEnvironmentDiagnostic(options: DoctorOptions = {}): Promise<DoctorResult> {
  const items: DiagnosticItem[] = [];
  let allRequiredPassed = true;

  // 1. Node.js check
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace(/^v/, "").split(".")[0] ?? "0", 10);
  if (majorVersion >= 18) {
    items.push({
      name: "Node.js",
      status: "ok",
      message: `${nodeVersion}`
    });
  } else {
    allRequiredPassed = false;
    items.push({
      name: "Node.js",
      status: "fail",
      message: `${nodeVersion} (Node.js 18+ required)`,
      remedy: "Upgrade Node.js to v18, v20, or v22+"
    });
  }

  // 2. FFmpeg check
  const ffmpeg = await detectFFmpeg(options.ffmpegPath);
  if (ffmpeg.available) {
    items.push({
      name: "FFmpeg",
      status: "ok",
      message: `version ${ffmpeg.version}`,
      details: ffmpeg.path
    });
  } else {
    allRequiredPassed = false;
    items.push({
      name: "FFmpeg",
      status: "fail",
      message: "FFmpeg executable not found in PATH or configured location",
      remedy: "Install FFmpeg (e.g. `winget install Gyan.FFmpeg` or `scoop install ffmpeg`) and ensure it is in PATH."
    });
  }

  // 3. FFprobe check
  const ffprobe = await detectFFprobe(options.ffprobePath);
  if (ffprobe.available) {
    items.push({
      name: "FFprobe",
      status: "ok",
      message: `version ${ffprobe.version}`,
      details: ffprobe.path
    });
  } else {
    allRequiredPassed = false;
    items.push({
      name: "FFprobe",
      status: "fail",
      message: "FFprobe executable not found in PATH or configured location",
      remedy: "Install FFprobe (included with standard FFmpeg releases) and ensure it is in PATH."
    });
  }

  // 4. H.264 encoder check
  if (ffmpeg.available) {
    const hasH264 = ffmpeg.encoders.some((enc) =>
      ["libx264", "h264_nvenc", "h264_qsv", "h264_amf"].includes(enc)
    );
    if (hasH264) {
      const details = ffmpeg.encoders.includes("libx264") ? "libx264 (software)" : "hardware encoder only";
      items.push({
        name: "H.264 encoder",
        status: "ok",
        message: details
      });
    } else {
      allRequiredPassed = false;
      items.push({
        name: "H.264 encoder",
        status: "fail",
        message: "No H.264 video encoder found in FFmpeg build",
        remedy: "Install a full FFmpeg build compiled with --enable-libx264"
      });
    }

    // 5. Hardware encoders check (informational, not failing)
    const hwList: string[] = [];
    if (ffmpeg.hardwareEncoders.nvenc) hwList.push("NVIDIA NVENC");
    if (ffmpeg.hardwareEncoders.qsv) hwList.push("Intel Quick Sync");
    if (ffmpeg.hardwareEncoders.amf) hwList.push("AMD AMF");

    if (hwList.length > 0) {
      items.push({
        name: "Hardware Acceleration",
        status: "info",
        message: `available (${hwList.join(", ")})`
      });
    } else {
      items.push({
        name: "Hardware Acceleration",
        status: "info",
        message: "unavailable (CPU fallback will be used)"
      });
    }
  }

  // 6. Output directory check
  const targetDir = options.outputDirectory ?? path.resolve(process.cwd(), "Exports");
  const isWritable = await checkDirectoryWritable(targetDir);
  if (isWritable) {
    items.push({
      name: "Output Directory",
      status: "ok",
      message: `writable (${targetDir})`
    });
  } else {
    allRequiredPassed = false;
    items.push({
      name: "Output Directory",
      status: "fail",
      message: `cannot write to destination: ${targetDir}`,
      remedy: "Check write permissions or configure a different output directory."
    });
  }

  // 7. Disk space check
  const diskSpace = await getDiskSpace(process.cwd());
  if (diskSpace) {
    if (diskSpace.availableGb >= 5) {
      items.push({
        name: "Disk Space",
        status: "ok",
        message: `${diskSpace.availableGb} GB available`
      });
    } else {
      items.push({
        name: "Disk Space",
        status: "warn",
        message: `low space: ${diskSpace.availableGb} GB available (minimum 5 GB recommended)`,
        remedy: "Free up disk space on target drive before running large renders."
      });
    }
  }

  return {
    passed: allRequiredPassed,
    timestamp: new Date().toISOString(),
    items,
    environment: {
      os: `${os.type()} ${os.release()} (${os.platform()})`,
      nodeVersion,
      arch: os.arch(),
      cwd: process.cwd()
    }
  };
}
