#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { createDoctorCommand } from "./commands/doctor.js";
import { createInspectCommand } from "./commands/inspect.js";
import { createProjectCommand } from "./commands/project.js";
import { createPlanCommand } from "./commands/plan.js";
import { createClipsCommand } from "./commands/clips.js";

const program = new Command();

program
  .name("clipforge")
  .description("ClipForge — Local-first video production engine for converting gameplay recordings into vertical clips")
  .version("0.1.0");

// 1. Doctor command (Spec 001)
program.addCommand(createDoctorCommand());

// 2. Inspect command (Spec 002)
program.addCommand(createInspectCommand());

// 3. Project command group (Spec 004)
program.addCommand(createProjectCommand());

// 4. Plan command (Spec 004)
program.addCommand(createPlanCommand());

// 5. Clips command group (Spec 004)
program.addCommand(createClipsCommand());

// Global error handler
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(pc.red("Error:"), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
