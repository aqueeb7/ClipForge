import {
  ClipForgeProject,
  ClipForgeProjectSchema,
  ClipForgeError,
  ErrorCode
} from "@clipforge/shared";

export function validateProject(input: unknown): ClipForgeProject {
  const result = ClipForgeProjectSchema.safeParse(input);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ClipForgeError({
      code: ErrorCode.INVALID_PROJECT_CONFIG,
      message: `Invalid ClipForge project configuration: ${formatted}`,
      diagnosticContext: { issues: result.error.issues },
      suggestedAction: "Check project.json against the ClipForge project schema."
    });
  }
  return result.data;
}
