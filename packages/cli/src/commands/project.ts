import { Command } from "commander";
import path from "node:path";
import pc from "picocolors";
import { createDefaultProject, loadProjectFile, saveProjectFile } from "@clipforge/core";
import { inspectMedia } from "@clipforge/media";
import { ClipForgeError } from "@clipforge/shared";

export function createProjectCommand(): Command {
  const project = new Command("project").description("Manage ClipForge project files");

  project
    .command("init")
    .description("Initialize a new project configuration file")
    .option("--name <name>", "Project name", "My Gameplay Project")
    .option("--video <path>", "Path to source video file")
    .option("--audio <path>", "Path to optional separate audio file")
    .option("--offset <ms>", "Audio offset in milliseconds", "0")
    .option("--duration <seconds>", "Clip duration in seconds", "60")
    .option("--out-dir <path>", "Output directory for rendered clips", "./Exports")
    .option("--config <path>", "Destination project config path", "./project.json")
    .action(async (options) => {
      try {
        let videoDuration = 180;
        let videoWidth = 1920;
        let videoHeight = 1080;

        if (options.video) {
          try {
            const inspection = await inspectMedia(options.video);
            videoDuration = inspection.container.durationSeconds;
            if (inspection.primaryVideo) {
              videoWidth = inspection.primaryVideo.width;
              videoHeight = inspection.primaryVideo.height;
            }
          } catch {
            // If file doesn't exist yet, proceed with standard defaults
          }
        }

        const projectId = `proj_${Date.now()}`;
        const newProject = createDefaultProject({
          id: projectId,
          name: options.name,
          videoPath: options.video ?? "./gameplay.mp4",
          videoDurationSeconds: videoDuration,
          width: videoWidth,
          height: videoHeight,
          audioPath: options.audio,
          audioOffsetMs: parseInt(options.offset, 10) || 0,
          clipDurationSeconds: parseFloat(options.duration) || 60,
          outputDirectory: options.outDir
        });

        const destPath = path.resolve(options.config);
        await saveProjectFile(destPath, newProject);

        console.log(pc.green(`\n[OK] Project initialized successfully:`));
        console.log(`  File:     ${pc.bold(destPath)}`);
        console.log(`  Project:  ${newProject.name} (${newProject.id})`);
        console.log(`  Duration: ${newProject.clipSettings.mode === "automatic" ? newProject.clipSettings.durationSeconds : "manual"}s per clip\n`);
      } catch (err: unknown) {
        handleCliError(err);
      }
    });

  project
    .command("validate <file>")
    .description("Validate an existing project configuration against the schema")
    .action(async (file: string) => {
      try {
        const resolved = path.resolve(file);
        const loaded = await loadProjectFile(resolved);
        console.log(pc.green(`\n[OK] Project configuration is valid:`));
        console.log(`  File:     ${pc.bold(resolved)}`);
        console.log(`  Project:  ${loaded.name} (version ${loaded.version})`);
        console.log(`  Mode:     ${loaded.clipSettings.mode}`);
        console.log(`  Video:    ${loaded.sources.video.path} (${loaded.sources.video.durationSeconds}s)\n`);
      } catch (err: unknown) {
        handleCliError(err);
      }
    });

  return project;
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
