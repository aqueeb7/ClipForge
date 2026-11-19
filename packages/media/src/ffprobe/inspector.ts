import fs from "node:fs/promises";
import path from "node:path";
import {
  MediaInspectionResult,
  MediaInspectionResultSchema,
  VideoStreamInfo,
  AudioStreamInfo,
  ContainerInfo,
  ClipForgeError,
  ErrorCode
} from "@clipforge/shared";
import { detectFFprobe } from "./discovery.js";
import { runProcess } from "../ffmpeg/discovery.js";

export interface InspectOptions {
  ffprobePath?: string;
}

interface RawFFprobeOutput {
  streams?: RawStream[];
  format?: RawFormat;
}

interface RawStream {
  index: number;
  codec_name?: string;
  codec_type?: string;
  profile?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  display_aspect_ratio?: string;
  sample_aspect_ratio?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
  bit_rate?: string;
  start_time?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
}

interface RawFormat {
  format_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  start_time?: string;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function calculateAspectRatio(width: number, height: number, displayAspectRatio?: string): string {
  if (
    displayAspectRatio &&
    ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"].includes(displayAspectRatio)
  ) {
    return displayAspectRatio;
  }
  const divisor = gcd(width, height);
  if (divisor > 0) {
    return `${width / divisor}:${height / divisor}`;
  }
  return `${width}:${height}`;
}

function parseFraction(fractionStr?: string): { value: number; fraction: string } {
  if (!fractionStr || fractionStr === "0/0") {
    return { value: 0, fraction: "0/0" };
  }
  const parts = fractionStr.split("/");
  if (parts.length === 2) {
    const num = parseFloat(parts[0] ?? "0");
    const den = parseFloat(parts[1] ?? "1");
    if (den !== 0 && !isNaN(num) && !isNaN(den)) {
      return {
        value: Math.round((num / den) * 1000) / 1000,
        fraction: fractionStr
      };
    }
  }
  const direct = parseFloat(fractionStr);
  return {
    value: isNaN(direct) ? 0 : direct,
    fraction: fractionStr
  };
}

export async function inspectMedia(
  filePath: string,
  options: InspectOptions = {}
): Promise<MediaInspectionResult> {
  const resolvedPath = path.resolve(filePath);

  // 1. Verify file exists
  let stats;
  try {
    stats = await fs.stat(resolvedPath);
  } catch (err: unknown) {
    throw new ClipForgeError({
      code: ErrorCode.FILE_NOT_FOUND,
      message: `Media file not found at path: ${resolvedPath}`,
      targetPath: resolvedPath,
      suggestedAction: "Check that the file path is correct and accessible.",
      cause: err
    });
  }

  if (stats.isDirectory()) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_MEDIA_FILE,
      message: `Expected a media file, but got a directory: ${resolvedPath}`,
      targetPath: resolvedPath,
      suggestedAction: "Provide a path to a video or audio file."
    });
  }

  if (stats.size === 0) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_MEDIA_FILE,
      message: `Media file is empty (0 bytes): ${resolvedPath}`,
      targetPath: resolvedPath,
      suggestedAction: "Provide a valid, non-empty media file."
    });
  }

  // 2. Discover FFprobe
  const ffprobeInfo = await detectFFprobe(options.ffprobePath);
  if (!ffprobeInfo.available || !ffprobeInfo.path) {
    throw new ClipForgeError({
      code: ErrorCode.FFPROBE_NOT_FOUND,
      message: "FFprobe binary not found. Media inspection cannot proceed.",
      suggestedAction: "Install FFprobe and ensure it is available in PATH or configure its location."
    });
  }

  // 3. Run FFprobe with JSON output format without decoding frames
  const { stdout, stderr, exitCode } = await runProcess(ffprobeInfo.path, [
    "-v",
    "error",
    "-show_format",
    "-show_streams",
    "-of",
    "json",
    resolvedPath
  ]);

  if (exitCode !== 0 || !stdout.trim()) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_MEDIA_FILE,
      message: `FFprobe failed to inspect media file: ${resolvedPath}`,
      targetPath: resolvedPath,
      diagnosticContext: { stderr, exitCode },
      suggestedAction: "Verify that the file is a supported and uncorrupted video or audio container."
    });
  }

  let rawData: RawFFprobeOutput;
  try {
    rawData = JSON.parse(stdout) as RawFFprobeOutput;
  } catch (err: unknown) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_MEDIA_FILE,
      message: `Failed to parse FFprobe JSON metadata: ${resolvedPath}`,
      targetPath: resolvedPath,
      diagnosticContext: { stdoutSample: stdout.slice(0, 200) },
      cause: err
    });
  }

  const rawStreams = rawData.streams ?? [];
  const rawFormat = rawData.format ?? {};

  if (rawStreams.length === 0) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_MEDIA_FILE,
      message: `No video or audio streams detected in media file: ${resolvedPath}`,
      targetPath: resolvedPath,
      suggestedAction: "The file might not be a valid media container or contains no recognizable streams."
    });
  }

  const containerDuration = parseFloat(rawFormat.duration ?? "0") || 0;
  const containerBitrate = rawFormat.bit_rate
    ? Math.round(parseFloat(rawFormat.bit_rate) / 1000)
    : undefined;
  const containerStartTime = parseFloat(rawFormat.start_time ?? "0") || 0;

  const container: ContainerInfo = {
    format: rawFormat.format_name ?? "unknown",
    durationSeconds: containerDuration,
    fileSizeBytes: stats.size,
    bitrateKbps: containerBitrate,
    startTimestampSeconds: containerStartTime
  };

  const videoStreams: VideoStreamInfo[] = [];
  const audioStreams: AudioStreamInfo[] = [];

  for (const stream of rawStreams) {
    if (stream.codec_type === "video") {
      const width = stream.width ?? 0;
      const height = stream.height ?? 0;
      if (width > 0 && height > 0) {
        const nominalFps = parseFraction(stream.r_frame_rate);
        const avgFps = parseFraction(stream.avg_frame_rate);

        // VFR vs CFR detection
        const isVFR =
          nominalFps.value > 0 &&
          avgFps.value > 0 &&
          Math.abs(nominalFps.value - avgFps.value) > 0.05;

        const effectiveFps = avgFps.value > 0 ? avgFps.value : nominalFps.value;
        const effectiveFraction =
          avgFps.value > 0 && avgFps.fraction !== "0/0"
            ? avgFps.fraction
            : nominalFps.fraction;

        const streamDuration = stream.duration
          ? parseFloat(stream.duration)
          : containerDuration;

        const streamBitrate = stream.bit_rate
          ? Math.round(parseFloat(stream.bit_rate) / 1000)
          : undefined;

        videoStreams.push({
          index: stream.index,
          codec: stream.codec_name ?? "unknown",
          profile: stream.profile,
          pixelFormat: stream.pix_fmt,
          width,
          height,
          aspectRatio: calculateAspectRatio(width, height, stream.display_aspect_ratio),
          frameRate: effectiveFps > 0 ? effectiveFps : 30,
          frameRateFraction: effectiveFraction,
          isVariableFrameRate: isVFR,
          durationSeconds: streamDuration >= 0 ? streamDuration : 0,
          bitrateKbps: streamBitrate,
          startTimestampSeconds: stream.start_time ? parseFloat(stream.start_time) : 0
        });
      }
    } else if (stream.codec_type === "audio") {
      const sampleRate = stream.sample_rate ? parseInt(stream.sample_rate, 10) : 0;
      const channels = stream.channels ?? 0;
      const streamDuration = stream.duration
        ? parseFloat(stream.duration)
        : containerDuration;
      const streamBitrate = stream.bit_rate
        ? Math.round(parseFloat(stream.bit_rate) / 1000)
        : undefined;

      audioStreams.push({
        index: stream.index,
        codec: stream.codec_name ?? "unknown",
        profile: stream.profile,
        sampleRate: sampleRate > 0 ? sampleRate : 48000,
        channels: channels > 0 ? channels : 2,
        channelLayout: stream.channel_layout,
        bitrateKbps: streamBitrate,
        durationSeconds: streamDuration >= 0 ? streamDuration : 0,
        startTimestampSeconds: stream.start_time ? parseFloat(stream.start_time) : 0
      });
    }
  }

  const result: MediaInspectionResult = {
    filePath: resolvedPath,
    container,
    videoStreams,
    audioStreams,
    primaryVideo: videoStreams[0],
    primaryAudio: audioStreams[0]
  };

  return MediaInspectionResultSchema.parse(result);
}
