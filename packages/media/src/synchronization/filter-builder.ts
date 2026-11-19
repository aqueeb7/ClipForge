import { AudioSyncPlan } from "@clipforge/shared";

export interface AudioFilterBuildOptions {
  plan: AudioSyncPlan;
  targetSampleRate?: number;
  outputBitrate?: string;
}

export interface AudioFilterResult {
  filterGraph: string;
  encodingArgs: string[];
  inputArgs: string[];
}

export function buildAudioSyncFilter(options: AudioFilterBuildOptions): AudioFilterResult {
  const { plan, targetSampleRate = 48000, outputBitrate = "192k" } = options;

  const filters: string[] = [];

  // If entirely silent, generate silence
  if (plan.isEntirelySilent || !plan.hasAudioSource) {
    return {
      filterGraph: `aevalsrc=0:d=${plan.clipDurationSeconds}:s=${targetSampleRate}[aout]`,
      encodingArgs: ["-c:a", "aac", "-b:a", outputBitrate, "-ar", String(targetSampleRate)],
      inputArgs: []
    };
  }

  // 1. Resample to standard rate and prevent drift
  filters.push(`aresample=${targetSampleRate}:async=1:first_pts=0`);

  // 2. Lead silence padding if audio starts later than video
  if (plan.leadPaddingMs > 0) {
    filters.push(`adelay=${plan.leadPaddingMs}|${plan.leadPaddingMs}:all=1`);
  }

  // 3. Trailing silence padding if audio ends before clip finishes
  if (plan.trailPaddingMs > 0) {
    filters.push(`apad=pad_dur=${(plan.trailPaddingMs / 1000).toFixed(3)}`);
  }

  // 4. Trim to exact clip duration
  filters.push(`atrim=0:${plan.clipDurationSeconds}`);

  // Input seeking options
  const inputArgs: string[] = [];
  if (plan.sourceSeekSeconds > 0) {
    inputArgs.push("-ss", String(plan.sourceSeekSeconds));
  }
  if (plan.sourceDurationSeconds > 0) {
    inputArgs.push("-t", String(plan.sourceDurationSeconds));
  }

  return {
    filterGraph: filters.join(","),
    encodingArgs: ["-c:a", "aac", "-b:a", outputBitrate, "-ar", String(targetSampleRate)],
    inputArgs
  };
}
