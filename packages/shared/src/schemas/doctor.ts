import { z } from "zod";

export const DiagnosticStatusSchema = z.enum(["ok", "warn", "fail", "info"]);
export type DiagnosticStatus = z.infer<typeof DiagnosticStatusSchema>;

export const DiagnosticItemSchema = z.object({
  name: z.string(),
  status: DiagnosticStatusSchema,
  message: stringFallback(z.string()),
  details: z.string().optional(),
  remedy: z.string().optional()
});

function stringFallback(schema: z.ZodString) {
  return schema;
}

export type DiagnosticItem = z.infer<typeof DiagnosticItemSchema>;

export const DoctorResultSchema = z.object({
  passed: z.boolean(),
  timestamp: z.string(),
  items: z.array(DiagnosticItemSchema),
  environment: z.object({
    os: z.string(),
    nodeVersion: z.string(),
    arch: z.string(),
    cwd: z.string()
  })
});

export type DoctorResult = z.infer<typeof DoctorResultSchema>;
