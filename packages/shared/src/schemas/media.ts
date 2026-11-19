import { z } from "zod";

export const MediaSourceSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
  durationSeconds: z.number().nonnegative("Duration must be non-negative"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  frameRate: z.number().positive().optional(),
  codec: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  hasAudio: z.boolean().optional()
});

export type MediaSource = z.infer<typeof MediaSourceSchema>;
