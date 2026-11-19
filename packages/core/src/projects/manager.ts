import fs from "node:fs/promises";
import path from "node:path";
import {
  ClipForgeProject,
  ClipManifest,
  ClipForgeError,
  ErrorCode
} from "@clipforge/shared";
import { validateProject } from "./validator.js";

export async function loadProjectFile(filePath: string): Promise<ClipForgeProject> {
  const resolved = path.resolve(filePath);
  let content: string;
  try {
    content = await fs.readFile(resolved, "utf8");
  } catch (err: unknown) {
    throw new ClipForgeError({
      code: ErrorCode.PROJECT_NOT_FOUND,
      message: `Project file not found or unreadable: ${resolved}`,
      targetPath: resolved,
      suggestedAction: "Check that the project JSON file exists.",
      cause: err
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err: unknown) {
    throw new ClipForgeError({
      code: ErrorCode.INVALID_PROJECT_CONFIG,
      message: `Failed to parse project JSON at: ${resolved}`,
      targetPath: resolved,
      cause: err
    });
  }

  return validateProject(parsed);
}

export async function saveProjectFile(filePath: string, project: ClipForgeProject): Promise<void> {
  const resolved = path.resolve(filePath);
  const validated = validateProject(project);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, JSON.stringify(validated, null, 2), "utf8");
}

export async function saveClipManifest(filePath: string, manifest: ClipManifest): Promise<void> {
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, JSON.stringify(manifest, null, 2), "utf8");
}
