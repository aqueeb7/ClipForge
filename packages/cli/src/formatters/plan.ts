import pc from "picocolors";
import { ClipManifest, Clip } from "@clipforge/shared";
import { formatSeconds } from "./inspect.js";

export function formatClipManifest(manifest: ClipManifest): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(pc.bold(pc.cyan("ClipForge Clip Plan")));
  lines.push(`${pc.dim("Project:")}     ${pc.bold(manifest.projectName)} (${pc.dim(manifest.projectId)})`);
  lines.push(`${pc.dim("Total Clips:")} ${pc.bold(pc.green(String(manifest.totalClips)))}`);
  lines.push(`${pc.dim("Generated:")}   ${manifest.generatedAt}`);
  lines.push("");

  if (manifest.clips.length === 0) {
    lines.push(pc.yellow("No clips planned for this project configuration."));
    lines.push("");
    return lines.join("\n");
  }

  lines.push(pc.bold(pc.yellow("Planned Clips:")));
  lines.push(
    `  ${pc.dim("#".padEnd(4))} ${"Status".padEnd(8)} ${"Start".padEnd(14)} ${"End".padEnd(14)} ${"Duration".padEnd(10)} ${"Output File"}`
  );
  lines.push(`  ${"-".repeat(80)}`);

  for (const clip of manifest.clips) {
    lines.push(formatClipRow(clip));
  }

  lines.push("");
  return lines.join("\n");
}

function formatClipRow(clip: Clip): string {
  const indexStr = String(clip.index).padEnd(4);
  const statusStr = clip.enabled ? pc.green("[ON]  ") : pc.dim("[OFF] ");
  const startStr = formatSeconds(clip.sourceStartSeconds).padEnd(14);
  const endStr = formatSeconds(clip.sourceEndSeconds).padEnd(14);
  const duration = (clip.sourceEndSeconds - clip.sourceStartSeconds).toFixed(1) + "s";
  const durationStr = duration.padEnd(10);
  const titlePart = clip.title && !clip.title.startsWith("Part ") ? ` (${clip.title})` : "";
  const outputName = clip.enabled ? pc.bold(clip.outputName) : pc.dim(clip.outputName);

  return `  ${pc.cyan(indexStr)} ${statusStr} ${startStr} ${endStr} ${pc.green(durationStr)} ${outputName}${pc.dim(titlePart)}`;
}
