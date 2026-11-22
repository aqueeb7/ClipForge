import { z } from "zod";

export const CropRegionSchema = z.object({
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  width: z.number().min(1).max(100).default(100),
  height: z.number().min(1).max(100).default(100),
});

export type CropRegion = z.infer<typeof CropRegionSchema>;

export const StackingSettingsSchema = z.object({
  template: z.enum(["blur_fill", "stacked_split", "pan_scan", "split_50_50"]).default("blur_fill"),
  topRegion: CropRegionSchema.default({ x: 2, y: 5, width: 28, height: 35 }),
  bottomRegion: CropRegionSchema.default({ x: 0, y: 15, width: 100, height: 85 }),
  cropRegion: CropRegionSchema.default({ x: 21.875, y: 0, width: 56.25, height: 100 }),
  topHeightPercent: z.number().min(10).max(90).default(35),
});

export type StackingSettings = z.infer<typeof StackingSettingsSchema>;

export const CompositionSettingsSchema = z.object({
  width: z.literal(1080).default(1080),
  height: z.literal(1920).default(1920),

  background: z.object({
    mode: z.enum(["blur", "solid", "image", "none"]).default("blur"),
    blurRadius: z.number().nonnegative().default(25),
    color: z.string().default("#000000")
  }).default({
    mode: "blur",
    blurRadius: 25,
    color: "#000000"
  }),

  gameplay: z.object({
    mode: z.enum(["contain", "cover", "crop", "stretch", "custom"]).default("contain"),
    scale: z.number().positive().default(1.0),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0)
  }).default({
    mode: "contain",
    scale: 1.0,
    offsetX: 0,
    offsetY: 0
  }),

  stacking: StackingSettingsSchema.optional().default({
    template: "blur_fill",
    topRegion: { x: 2, y: 5, width: 28, height: 35 },
    bottomRegion: { x: 0, y: 15, width: 100, height: 85 },
    cropRegion: { x: 21.875, y: 0, width: 56.25, height: 100 },
    topHeightPercent: 35,
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
