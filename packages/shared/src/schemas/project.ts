import { z } from "zod";
import { MediaSourceSchema } from "./media.js";
import { ClipSettingsSchema } from "./clip.js";
import { CompositionSettingsSchema } from "./composition.js";
import { ExportSettingsSchema } from "./export.js";

export const SynchronizationSettingsSchema = z.object({
  audioOffsetMs: z.number().int().default(0)
});

export type SynchronizationSettings = z.infer<typeof SynchronizationSettingsSchema>;

export const ClipForgeProjectSchema = z.object({
  id: z.string().min(1, "Project ID cannot be empty"),
  name: z.string().min(1, "Project name cannot be empty"),
  version: z.literal(1).default(1),
  workflowMode: z.enum(["episodic", "shorts", "hybrid"]).optional().default("hybrid"),

  sources: z.object({
    video: MediaSourceSchema,
    audio: MediaSourceSchema.optional()
  }),

  synchronization: SynchronizationSettingsSchema.default({ audioOffsetMs: 0 }),
  clipSettings: ClipSettingsSchema,
  composition: CompositionSettingsSchema.default({}),
  shorts: z.array(z.any()).optional().default([]),
  export: ExportSettingsSchema
});

export type ClipForgeProject = z.infer<typeof ClipForgeProjectSchema>;
