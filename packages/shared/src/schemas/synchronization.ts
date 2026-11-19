import { z } from "zod";

export const AudioSyncModeSchema = z.enum(["matching", "offset", "reference"]);
export type AudioSyncMode = z.infer<typeof AudioSyncModeSchema>;

export const AudioSyncPlanSchema = z.object({
  clipStartSeconds: z.number().nonnegative(),
  clipEndSeconds: z.number().positive(),
  clipDurationSeconds: z.number().positive(),
  audioOffsetMs: z.number().int(),

  // Source audio extraction parameters
  sourceSeekSeconds: z.number().nonnegative(),
  sourceDurationSeconds: z.number().nonnegative(),

  // Padding parameters
  leadPaddingMs: z.number().nonnegative(),
  trailPaddingMs: z.number().nonnegative(),

  // Flags
  hasAudioSource: z.boolean().default(true),
  isEntirelySilent: z.boolean().default(false)
});

export type AudioSyncPlan = z.infer<typeof AudioSyncPlanSchema>;
