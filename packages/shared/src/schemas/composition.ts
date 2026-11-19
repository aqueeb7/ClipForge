import { z } from "zod";

export const CompositionSettingsSchema = z.object({
  width: z.literal(1080).default(1080),
  height: z.literal(1920).default(1920),

  background: z.object({
    mode: z.enum(["blur", "solid", "image"]).default("blur"),
    blurRadius: z.number().nonnegative().default(25),
    color: z.string().default("#000000")
  }).default({
    mode: "blur",
    blurRadius: 25,
    color: "#000000"
  }),

  gameplay: z.object({
    mode: z.enum(["contain", "crop", "custom"]).default("contain"),
    scale: z.number().positive().default(1.0),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0)
  }).default({
    mode: "contain",
    scale: 1.0,
    offsetX: 0,
    offsetY: 0
  }),

  overlay: z.object({
    enabled: z.boolean().default(true),
    brandTitle: z.string().default("CLIPFORGE"),
    episodeLabel: z.string().default("PART"),
    showEpisodeNumber: z.boolean().default(true)
  }).default({
    enabled: true,
    brandTitle: "CLIPFORGE",
    episodeLabel: "PART",
    showEpisodeNumber: true
  })
});

export type CompositionSettings = z.infer<typeof CompositionSettingsSchema>;
export type CompositionConfig = CompositionSettings;
