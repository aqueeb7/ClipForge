import pc from "picocolors";
import { DoctorResult, DiagnosticItem } from "@clipforge/shared";

export function formatDoctorResult(result: DoctorResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(pc.bold(pc.cyan("ClipForge Environment Check")));
  lines.push(pc.dim(`OS: ${result.environment.os} | Node: ${result.environment.nodeVersion}`));
  lines.push("");

  for (const item of result.items) {
    lines.push(formatDiagnosticItem(item));
    if (item.remedy && (item.status === "fail" || item.status === "warn")) {
      lines.push(`    ${pc.dim("↳ Suggestion: ")}${pc.yellow(item.remedy)}`);
    }
  }

  lines.push("");
  if (result.passed) {
    lines.push(pc.bold(pc.green("Environment ready.")));
  } else {
    lines.push(pc.bold(pc.red("Environment check failed. Please resolve the missing dependencies above.")));
  }
  lines.push("");

  return lines.join("\n");
}

function formatDiagnosticItem(item: DiagnosticItem): string {
  let badge: string;
  switch (item.status) {
    case "ok":
      badge = pc.green("[OK]");
      break;
    case "warn":
      badge = pc.yellow("[WARN]");
      break;
    case "fail":
      badge = pc.red("[FAIL]");
      break;
    case "info":
      badge = pc.cyan("[INFO]");
      break;
  }

  const name = pc.bold(item.name);
  const message = item.message;
  return `${badge} ${name}: ${message}`;
}
