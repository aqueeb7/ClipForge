import { Command } from "commander";
import path from "node:path";
import pc from "picocolors";
import { loadProjectFile, generateClipManifest } from "@clipforge/core";
import { ClipForgeError } from "@clipforge/shared";
import { formatClipManifest } from "../formatters/plan.js";

export function createPlanCommand(): Command {
  const plan = new Command("plan")
    .description("Generate and preview a clip manifest without rendering")
    .argument("<file>", "Path to project configuration file")
    .option("--json", "Output plan as JSON")
    .action(async (file: string, options) => {
      try {
        const resolved = path.resolve(file);
        const project = await loadProjectFile(resolved);
        const manifest = generateClipManifest(project);

        if (options.json) {
          console.log(JSON.stringify(manifest, null, 2));
        } else {
          console.log(formatClipManifest(manifest));
        }
      } catch (err: unknown) {
        if (err instanceof ClipForgeError) {
          console.error(pc.red(`\n[${err.code}] ${err.message}`));
          if (err.suggestedAction) {
            console.error(`  ↳ ${pc.yellow(err.suggestedAction)}`);
          }
          console.error("");
          process.exitCode = 1;
        } else {
          console.error(pc.red("\nUnexpected error during planning:"), err);
          process.exitCode = 1;
        }
      }
    });

  return plan;
}
