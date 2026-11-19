import { z } from "zod";

export const VideoStreamInfoSchema = z.object({
  index: z.number().int().nonnegative(),
  codec: z.string(),
  profile: z.string().optional(),
  pixelFormat: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatio: z.string(),
  frameRate: z.number().positive(),
  frameRateFraction: z.string(),
  isVariableFrameRate: z.boolean(),
  durationSeconds: z.number().nonnegative(),
  bitrateKbps: z.number().nonnegative().optional(),
  startTimestampSeconds: z.number().default(0)
});

export type VideoStreamInfo = z.infer<typeof VideoStreamInfoSchema>;

export const AudioStreamInfoSchema = z.object({
  index: z.number().int().nonnegative(),
  codec: z.string(),
  profile: z.string().optional(),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().positive(),
  channelLayout: z.string().optional(),
  bitrateKbps: z.number().nonnegative().optional(),
  durationSeconds: z.number().nonnegative(),
  startTimestampSeconds: z.number().default(0)
});

export type AudioStreamInfo = z.infer<typeof AudioStreamInfoSchema>;

export const ContainerInfoSchema = z.object({
  format: z.string(),
  durationSeconds: z.number().nonnegative(),
  fileSizeBytes: z.number().int().nonnegative(),
  bitrateKbps: z.number().nonnegative().optional(),
  startTimestampSeconds: z.number().default(0)
});

export type ContainerInfo = z.infer<typeof ContainerInfoSchema>;

export const MediaInspectionResultSchema = z.object({
  filePath: z.string(),
  container: ContainerInfoSchema,
  videoStreams: z.array(VideoStreamInfoSchema),
  audioStreams: z.array(AudioStreamInfoSchema),
  primaryVideo: VideoStreamInfoSchema.optional(),
  primaryAudio: AudioStreamInfoSchema.optional()
});

export type MediaInspectionResult = z.infer<typeof MediaInspectionResultSchema>;
