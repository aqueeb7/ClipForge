export interface FFmpegProgress {
  frame: number;
  fps: number;
  outTimeSeconds: number;
  speed: string;
  progressPercent: number;
  status: "continue" | "end";
}

export function parseProgressBuffer(
  text: string,
  targetDurationSeconds: number
): FFmpegProgress | null {
  if (!text.includes("progress=")) {
    return null;
  }

  const lines = text.split(/\r?\n/);
  let frame = 0;
  let fps = 0;
  let outTimeSeconds = 0;
  let speed = "0x";
  let status: "continue" | "end" = "continue";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [key, ...valParts] = trimmed.split("=");
    const value = valParts.join("=").trim();

    if (key === "frame") {
      frame = parseInt(value, 10) || 0;
    } else if (key === "fps") {
      fps = parseFloat(value) || 0;
    } else if (key === "out_time_us") {
      const us = parseInt(value, 10);
      if (!isNaN(us)) {
        outTimeSeconds = us / 1000000;
      }
    } else if (key === "out_time_ms" && outTimeSeconds === 0) {
      const ms = parseInt(value, 10);
      if (!isNaN(ms)) {
        outTimeSeconds = ms / 1000;
      }
    } else if (key === "speed") {
      speed = value;
    } else if (key === "progress") {
      status = value === "end" ? "end" : "continue";
    }
  }

  let progressPercent = 0;
  if (status === "end") {
    progressPercent = 100;
  } else if (targetDurationSeconds > 0) {
    progressPercent = Math.min(100, Math.max(0, (outTimeSeconds / targetDurationSeconds) * 100));
    progressPercent = Math.round(progressPercent * 10) / 10;
  }

  return {
    frame,
    fps,
    outTimeSeconds: Math.round(outTimeSeconds * 100) / 100,
    speed,
    progressPercent,
    status
  };
}
