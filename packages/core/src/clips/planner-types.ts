export type { ClipManifest } from "@clipforge/shared";

export interface GenerateClipsOptions {
  projectId: string;
  projectName: string;
  totalDurationSeconds: number;
  namingPattern?: string;
  outputDirectory?: string;
}
