import { z } from "zod";

export const ClipStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);
export type ClipStatus = z.infer<typeof ClipStatusSchema>;

export const ClipSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().positive(),
  title: z.string().optional(),
  sourceStartSeconds: z.number().nonnegative(),
  sourceEndSeconds: z.number().positive(),
  enabled: z.boolean().default(true),
  outputName: z.string().min(1),
  status: ClipStatusSchema.default("pending")
}).refine((data) => data.sourceEndSeconds > data.sourceStartSeconds, {
  message: "sourceEndSeconds must be greater than sourceStartSeconds",
  path: ["sourceEndSeconds"]
});

export type Clip = z.infer<typeof ClipSchema>;

export const AutomaticClipSettingsSchema = z.object({
  mode: z.literal("automatic"),
  startSeconds: z.number().nonnegative().default(0),
  endSeconds: z.number().positive().optional(),
  durationSeconds: z.number().positive().default(60),
  overlapSeconds: z.number().nonnegative().default(0),
  minimumFinalClipSeconds: z.number().positive().default(5),
  startingEpisode: z.number().int().positive().default(1)
});

export type AutomaticClipSettings = z.infer<typeof AutomaticClipSettingsSchema>;

export const ManualClipItemSchema = z.object({
  title: z.string().optional(),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  enabled: z.boolean().default(true)
}).refine((data) => data.end > data.start, {
  message: "end must be greater than start",
  path: ["end"]
});

export type ManualClipItem = z.infer<typeof ManualClipItemSchema>;

export const ManualClipSettingsSchema = z.object({
  mode: z.literal("manual"),
  clips: z.array(ManualClipItemSchema).default([])
});

export type ManualClipSettings = z.infer<typeof ManualClipSettingsSchema>;

export const ClipSettingsSchema = z.discriminatedUnion("mode", [
  AutomaticClipSettingsSchema,
  ManualClipSettingsSchema
]);

export type ClipSettings = z.infer<typeof ClipSettingsSchema>;

export const ClipManifestSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  totalClips: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  clips: z.array(ClipSchema)
});

export type ClipManifest = z.infer<typeof ClipManifestSchema>;
