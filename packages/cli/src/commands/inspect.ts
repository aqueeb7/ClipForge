import { Command } from "commander";
import pc from "picocolors";
import { inspectMedia } from "@clipforge/media";
import { ClipForgeError } from "@clipforge/shared";
import { formatInspectionResult } from "../formatters/inspect.js";

export function createInspectCommand(): Command {
  const inspect = new Command("inspect")
    .description("Inspect media file streams, resolution, frame rate, codecs, and durations (FFprobe)")
    .requiredOption("--video <path>", "Path to source video file")
    .option("--audio <path>", "Path to optional separate audio file to inspect alongside video")
    .option("--ffprobe <path>", "Custom path to FFprobe executable")
    .option("--json", "Output results in JSON format")
    .action(async (options) => {
      try {
        const videoResult = await inspectMedia(options.video, {
          ffprobePath: options.ffprobe
        });

        let audioResult;
        if (options.audio) {
          audioResult = await inspectMedia(options.audio, {
            ffprobePath: options.ffprobe
          });
        }

        if (options.json) {
          const payload = audioResult
            ? { video: videoResult, audio: audioResult }
            : videoResult;
          console.log(JSON.stringify(payload, null, 2));
        } else {
          console.log(formatInspectionResult(videoResult));
          if (audioResult) {
            console.log(pc.bold(pc.magenta("Separate Audio Source Inspection:")));
            console.log(formatInspectionResult(audioResult));
          }
        }
      } catch (err: unknown) {
        if (err instanceof ClipForgeError) {
          console.error(pc.red(`\n[${err.code}] ${err.message}`));
          if (err.suggestedAction) {
            console.error(`  ↳ ${pc.yellow(err.suggestedAction)}`);
          }
          if (err.diagnosticContext && Object.keys(err.diagnosticContext).length > 0) {
            console.error(pc.dim(`  Context: ${JSON.stringify(err.diagnosticContext)}`));
          }
          console.error("");
          process.exitCode = 1;
        } else {
          console.error(pc.red("\nUnexpected error during inspection:"), err);
          process.exitCode = 1;
        }
      }
    });

  return inspect;
}
