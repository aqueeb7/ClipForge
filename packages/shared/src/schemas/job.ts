import { z } from "zod";

export const JobStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const RenderJobSchema = z.object({
  id: z.string().min(1),
  clipId: z.string().min(1),
  status: JobStatusSchema.default("pending"),
  progress: z.number().min(0).max(100).default(0),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  outputPath: z.string().optional(),
  error: z.string().optional()
});

export type RenderJob = z.infer<typeof RenderJobSchema>;
