import { Command } from "commander";
import { runEnvironmentDiagnostic } from "@clipforge/media";
import { formatDoctorResult } from "../formatters/doctor.js";

export function createDoctorCommand(): Command {
  const doctor = new Command("doctor")
    .description("Verify local environment dependencies, FFmpeg tools, codecs, and storage")
    .option("--ffmpeg <path>", "Custom path to FFmpeg executable")
    .option("--ffprobe <path>", "Custom path to FFprobe executable")
    .option("--output-dir <path>", "Output directory to test writability")
    .option("--json", "Output results in JSON format")
    .action(async (options) => {
      const result = await runEnvironmentDiagnostic({
        ffmpegPath: options.ffmpeg,
        ffprobePath: options.ffprobe,
        outputDirectory: options.outputDir
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatDoctorResult(result));
      }

      if (!result.passed) {
        process.exitCode = 1;
      }
    });

  return doctor;
}
