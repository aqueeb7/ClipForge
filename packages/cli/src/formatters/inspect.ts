import pc from "picocolors";
import { MediaInspectionResult, VideoStreamInfo, AudioStreamInfo } from "@clipforge/shared";

export function formatSeconds(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const pad = (n: number, z = 2) => String(n).padStart(z, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function formatInspectionResult(result: MediaInspectionResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(pc.bold(pc.cyan("ClipForge Media Inspection")));
  lines.push(`${pc.dim("File:")} ${pc.bold(result.filePath)}`);
  lines.push("");

  // Container
  lines.push(pc.bold(pc.yellow("Container:")));
  lines.push(`  Format:       ${result.container.format}`);
  lines.push(`  Duration:     ${formatSeconds(result.container.durationSeconds)} (${result.container.durationSeconds.toFixed(2)}s)`);
  lines.push(`  Size:         ${formatBytes(result.container.fileSizeBytes)} (${result.container.fileSizeBytes.toLocaleString()} bytes)`);
  if (result.container.bitrateKbps !== undefined) {
    lines.push(`  Bitrate:      ${result.container.bitrateKbps.toLocaleString()} kbps`);
  }
  lines.push(`  Start Time:   ${result.container.startTimestampSeconds.toFixed(3)}s`);

  // Video streams
  if (result.videoStreams.length > 0) {
    lines.push("");
    lines.push(pc.bold(pc.yellow(`Video Streams (${result.videoStreams.length}):`)));
    for (const v of result.videoStreams) {
      lines.push(formatVideoStream(v));
    }
  } else {
    lines.push("");
    lines.push(pc.dim("No video streams detected."));
  }

  // Audio streams
  if (result.audioStreams.length > 0) {
    lines.push("");
    lines.push(pc.bold(pc.yellow(`Audio Streams (${result.audioStreams.length}):`)));
    for (const a of result.audioStreams) {
      lines.push(formatAudioStream(a));
    }
  } else {
    lines.push("");
    lines.push(pc.dim("No audio streams detected."));
  }

  lines.push("");
  return lines.join("\n");
}

function formatVideoStream(v: VideoStreamInfo): string {
  const lines: string[] = [];
  const vfrStatus = v.isVariableFrameRate
    ? pc.yellow("[VFR - Variable Frame Rate]")
    : pc.green("[CFR - Constant Frame Rate]");

  const profileStr = v.profile ? ` (${v.profile})` : "";
  lines.push(`  Stream #${v.index}:`);
  lines.push(`    Codec:        ${v.codec}${profileStr}`);
  lines.push(`    Resolution:   ${v.width}x${v.height} (${v.aspectRatio})`);
  if (v.pixelFormat) {
    lines.push(`    Pixel Format: ${v.pixelFormat}`);
  }
  lines.push(`    Frame Rate:   ${v.frameRate} fps (${v.frameRateFraction}) ${vfrStatus}`);
  lines.push(`    Duration:     ${formatSeconds(v.durationSeconds)} (${v.durationSeconds.toFixed(2)}s)`);
  if (v.bitrateKbps !== undefined) {
    lines.push(`    Bitrate:      ${v.bitrateKbps.toLocaleString()} kbps`);
  }
  lines.push(`    Start Time:   ${v.startTimestampSeconds.toFixed(3)}s`);
  return lines.join("\n");
}

function formatAudioStream(a: AudioStreamInfo): string {
  const lines: string[] = [];
  const layout = a.channelLayout ? ` (${a.channelLayout})` : "";
  const profileStr = a.profile ? ` (${a.profile})` : "";

  lines.push(`  Stream #${a.index}:`);
  lines.push(`    Codec:        ${a.codec}${profileStr}`);
  lines.push(`    Sample Rate:  ${a.sampleRate.toLocaleString()} Hz`);
  lines.push(`    Channels:     ${a.channels}${layout}`);
  lines.push(`    Duration:     ${formatSeconds(a.durationSeconds)} (${a.durationSeconds.toFixed(2)}s)`);
  if (a.bitrateKbps !== undefined) {
    lines.push(`    Bitrate:      ${a.bitrateKbps.toLocaleString()} kbps`);
  }
  lines.push(`    Start Time:   ${a.startTimestampSeconds.toFixed(3)}s`);
  return lines.join("\n");
}
