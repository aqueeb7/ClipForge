import { Command } from "commander";
import path from "node:path";
import pc from "picocolors";
import {
  loadProjectFile,
  saveProjectFile,
  generateClipManifest,
  saveClipManifest,
  addManualClip,
  removeManualClip,
  toggleManualClip
} from "@clipforge/core";
import { RenderQueueManager } from "@clipforge/media";
import { ClipForgeError } from "@clipforge/shared";
import { formatClipManifest } from "../formatters/plan.js";
import { formatSeconds } from "../formatters/inspect.js";

export function createClipsCommand(): Command {
  const clips = new Command("clips").description("Manage and export clips");

  // 1. clips add
  clips
    .command("add <file>")
    .description("Add a custom manual clip to the project")
    .requiredOption("--start <seconds>", "Clip start timestamp in seconds (decimal accepted)")
    .requiredOption("--end <seconds>", "Clip end timestamp in seconds (decimal accepted)")
    .option("--title <title>", "Optional title for the clip")
    .action(async (file: string, options) => {
      try {
        const resolved = path.resolve(file);
        const project = await loadProjectFile(resolved);
        const start = parseFloat(options.start);
        const end = parseFloat(options.end);

        const updated = addManualClip(project, {
          start,
          end,
          title: options.title
        });

        await saveProjectFile(resolved, updated);

        console.log(pc.green(`\n[OK] Added manual clip:`));
        console.log(`  Project: ${updated.name}`);
        console.log(`  Range:   ${start}s -> ${end}s (${(end - start).toFixed(2)}s)`);
        if (options.title) console.log(`  Title:   ${options.title}`);

        const manifest = generateClipManifest(updated);
        console.log(formatClipManifest(manifest));
      } catch (err: unknown) {
        handleCliError(err);
      }
    });

  // 2. clips remove
  clips
    .command("remove <file>")
    .description("Remove a manual clip by its 1-based index")
    .requiredOption("--index <number>", "1-based index of clip to remove")
    .action(async (file: string, options) => {
      try {
        const resolved = path.resolve(file);
        const project = await loadProjectFile(resolved);
        const index = parseInt(options.index, 10);

        const updated = removeManualClip(project, index);
        await saveProjectFile(resolved, updated);

        console.log(pc.green(`\n[OK] Removed clip #${index} from project.`));
        const manifest = generateClipManifest(updated);
        console.log(formatClipManifest(manifest));
      } catch (err: unknown) {
        handleCliError(err);
      }
    });

  // 3. clips toggle
  clips
    .command("toggle <file>")
    .description("Toggle or explicitly enable/disable a manual clip")
    .requiredOption("--index <number>", "1-based index of clip to toggle")
    .option("--enable", "Explicitly enable the clip")
    .option("--disable", "Explicitly disable the clip")
    .action(async (file: string, options) => {
      try {
        const resolved = path.resolve(file);
        const project = await loadProjectFile(resolved);
        const index = parseInt(options.index, 10);

        let explicitState: boolean | undefined = undefined;
        if (options.enable) explicitState = true;
        if (options.disable) explicitState = false;

        const updated = toggleManualClip(project, index, explicitState);
        await saveProjectFile(resolved, updated);

        console.log(pc.green(`\n[OK] Updated clip #${index} state.`));
        const manifest = generateClipManifest(updated);
        console.log(formatClipManifest(manifest));
      } catch (err: unknown) {
        handleCliError(err);
      }
    });

  // 4. clips generate
  clips
    .command("generate <file>")
    .description("Calculate clip intervals from project configuration and persist manifest.json")
    .option("--out <path>", "Destination manifest path (defaults to manifest.json in project dir)")
    .action(async (file: string, options) => {
      try {
        const resolved = path.resolve(file);
        const project = await loadProjectFile(resolved);
        const manifest = generateClipManifest(project);

        const outPath = options.out
          ? path.resolve(options.out)
          : path.join(path.dirname(resolved), "manifest.json");

        await saveClipManifest(outPath, manifest);

        console.log(pc.green(`\n[OK] Generated manifest with ${manifest.totalClips} clips:`));
        console.log(`  Saved to: ${pc.bold(outPath)}`);
        console.log(formatClipManifest(manifest));
      } catch (err: unknown) {
        handleCliError(err);
      }
    });

  // 5. clips list
  clips
    .command("list <file>")
    .description("List planned clips for a project")
    .action(async (file: string) => {
      try {
        const resolved = path.resolve(file);
        const project = await loadProjectFile(resolved);
        const manifest = generateClipManifest(project);
        console.log(formatClipManifest(manifest));
      } catch (err: unknown) {
        handleCliError(err);
      }
    });

  // 6. clips export (Spec 007 / 008)
  clips
    .command("export <file>")
    .description("Render and export planned clips through FFmpeg")
    .option("--only <indices>", "Export only specific clip indices (comma-separated, e.g. 1,2,3)")
    .option("--dry-run", "Simulate export without spawning FFmpeg")
    .option("--overwrite", "Overwrite existing output files")
    .option("--structure <flat|nested>", "Output directory layout: 'flat' or 'nested' (folder-per-clip)")
    .option("--out-dir <path>", "Custom destination output directory")
    .option("--json", "Output batch result as JSON")
    .action(async (file: string, options) => {
      try {
        const resolved = path.resolve(file);
        const project = await loadProjectFile(resolved);
        const manifest = generateClipManifest(project);

        let onlyIndices: number[] | undefined;
        if (options.only) {
          onlyIndices = String(options.only)
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));
        }

        if (!options.json) {
          console.log("");
          console.log(pc.bold(pc.cyan("ClipForge Batch Render Queue")));
          console.log(`${pc.dim("Project:")}   ${pc.bold(project.name)}`);
          console.log(`${pc.dim("Target:")}    ${options.outDir ?? project.export.outputDirectory}`);
          if (options.dryRun) {
            console.log(pc.yellow("Mode:      DRY RUN (Simulation only)"));
          }
          console.log("");
        }

        const queue = new RenderQueueManager();
        let currentClipNum = 0;

        const summary = await queue.runBatch({
          project,
          manifest,
          onlyIndices,
          dryRun: options.dryRun,
          overwrite: options.overwrite,
          structure: options.structure,
          outputDirectory: options.outDir,
          onJobStart: (_job, clip) => {
            currentClipNum++;
            const startStr = formatSeconds(clip.sourceStartSeconds);
            const endStr = formatSeconds(clip.sourceEndSeconds);
            console.log(
              `\n${pc.bold(pc.cyan(`[${currentClipNum}]`))} ${pc.bold(clip.outputName)} (${startStr} -> ${endStr})`
            );
          },
          onJobProgress: (_job, p) => {
            if (!options.json) {
              process.stdout.write(
                `\r  ${pc.yellow("Rendering:")} ${p.progressPercent.toFixed(1)}% | Speed: ${p.speed} | FPS: ${p.fps}`
              );
            }
          },
          onJobComplete: (_job, res) => {
            if (!options.json) {
              console.log(
                `\r  ${pc.green("[OK]")} Finished -> ${pc.bold(res.outputPath)}`
              );
            }
          },
          onJobFail: (job, err) => {
            if (!options.json) {
              console.log(`\r  ${pc.red("[FAIL]")} Job ${job.id} failed: ${err.message}`);
            }
          }
        });

        if (options.json) {
          console.log(JSON.stringify(summary, null, 2));
        } else {
          console.log("");
          console.log(pc.bold(pc.yellow("Batch Summary:")));
          console.log(`  Total:     ${summary.total}`);
          console.log(`  Completed: ${pc.green(String(summary.completed))}`);
          console.log(`  Skipped:   ${pc.dim(String(summary.skipped))}`);
          console.log(`  Failed:    ${summary.failed > 0 ? pc.red(String(summary.failed)) : "0"}`);
          console.log("");
        }

        if (summary.failed > 0) {
          process.exitCode = 1;
        }
      } catch (err: unknown) {
        handleCliError(err);
      }
    });

  return clips;
}

function handleCliError(err: unknown) {
  if (err instanceof ClipForgeError) {
    console.error(pc.red(`\n[${err.code}] ${err.message}`));
    if (err.suggestedAction) {
      console.error(`  ↳ ${pc.yellow(err.suggestedAction)}`);
    }
    console.error("");
    process.exitCode = 1;
  } else {
    console.error(pc.red("\nUnexpected error:"), err);
    process.exitCode = 1;
  }
}
