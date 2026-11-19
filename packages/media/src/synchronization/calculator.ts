import { AudioSyncPlan, AudioSyncPlanSchema } from "@clipforge/shared";

export interface CalculateAudioSyncOptions {
  clipStartSeconds: number;
  clipEndSeconds: number;
  audioOffsetMs?: number;
  audioDurationSeconds?: number;
  hasAudioSource?: boolean;
}

export function calculateAudioSyncPlan(options: CalculateAudioSyncOptions): AudioSyncPlan {
  const {
    clipStartSeconds,
    clipEndSeconds,
    audioOffsetMs = 0,
    audioDurationSeconds = Number.POSITIVE_INFINITY,
    hasAudioSource = true
  } = options;

  const clipDurationSeconds = Math.max(0, clipEndSeconds - clipStartSeconds);
  if (clipDurationSeconds === 0 || !hasAudioSource) {
    return AudioSyncPlanSchema.parse({
      clipStartSeconds,
      clipEndSeconds,
      clipDurationSeconds,
      audioOffsetMs,
      sourceSeekSeconds: 0,
      sourceDurationSeconds: 0,
      leadPaddingMs: 0,
      trailPaddingMs: Math.round(clipDurationSeconds * 1000),
      hasAudioSource,
      isEntirelySilent: true
    });
  }

  // Delta in seconds: positive offset means audio starts later than video
  const deltaSeconds = audioOffsetMs / 1000;

  // Audio timeline positions corresponding to clip boundaries
  const audioStart = clipStartSeconds - deltaSeconds;
  const audioEnd = clipEndSeconds - deltaSeconds;

  // Case 1: Clip occurs entirely before audio starts
  if (audioEnd <= 0) {
    return AudioSyncPlanSchema.parse({
      clipStartSeconds,
      clipEndSeconds,
      clipDurationSeconds,
      audioOffsetMs,
      sourceSeekSeconds: 0,
      sourceDurationSeconds: 0,
      leadPaddingMs: Math.round(clipDurationSeconds * 1000),
      trailPaddingMs: 0,
      hasAudioSource: true,
      isEntirelySilent: true
    });
  }

  // Case 2: Clip occurs entirely after audio file duration
  if (audioStart >= audioDurationSeconds) {
    return AudioSyncPlanSchema.parse({
      clipStartSeconds,
      clipEndSeconds,
      clipDurationSeconds,
      audioOffsetMs,
      sourceSeekSeconds: 0,
      sourceDurationSeconds: 0,
      leadPaddingMs: 0,
      trailPaddingMs: Math.round(clipDurationSeconds * 1000),
      hasAudioSource: true,
      isEntirelySilent: true
    });
  }

  // Case 3: Overlapping audio
  let leadPaddingSeconds = 0;
  let sourceSeekSeconds = 0;

  if (audioStart < 0) {
    leadPaddingSeconds = -audioStart;
    sourceSeekSeconds = 0;
  } else {
    leadPaddingSeconds = 0;
    sourceSeekSeconds = audioStart;
  }

  // Calculate readable audio duration from source
  const audioAvailableEnd = Math.min(audioEnd, audioDurationSeconds);
  const sourceDurationSeconds = Math.max(0, audioAvailableEnd - sourceSeekSeconds);

  // Trailing silence
  const trailPaddingSeconds = Math.max(
    0,
    clipDurationSeconds - leadPaddingSeconds - sourceDurationSeconds
  );

  const leadPaddingMs = Math.round(leadPaddingSeconds * 1000);
  const trailPaddingMs = Math.round(trailPaddingSeconds * 1000);

  return AudioSyncPlanSchema.parse({
    clipStartSeconds,
    clipEndSeconds,
    clipDurationSeconds,
    audioOffsetMs,
    sourceSeekSeconds: Math.round(sourceSeekSeconds * 1000) / 1000,
    sourceDurationSeconds: Math.round(sourceDurationSeconds * 1000) / 1000,
    leadPaddingMs,
    trailPaddingMs,
    hasAudioSource: true,
    isEntirelySilent: sourceDurationSeconds === 0
  });
}
