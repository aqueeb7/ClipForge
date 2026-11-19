import { z } from "zod";

export const ExportSettingsSchema = z.object({
  container: z.literal("mp4").default("mp4"),
  videoCodec: z.enum(["h264", "hevc"]).default("h264"),
  audioCodec: z.literal("aac").default("aac"),

  frameRate: z.number().positive().default(60),
  videoBitrate: z.string().optional(),
  crf: z.number().int().min(0).max(51).default(21),
  preset: z.string().default("veryfast"),

  outputDirectory: z.string().min(1, "Output directory is required"),
  namingPattern: z.string().default("{project}_{episode}_{title}"),
  structure: z.enum(["flat", "nested"]).default("flat")
});

export type ExportSettings = z.infer<typeof ExportSettingsSchema>;
