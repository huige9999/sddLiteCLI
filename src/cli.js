import { cmdInit } from "./commands/init.js";
import { cmdAddModule } from "./commands/add-module.js";
import { cmdAddScenario } from "./commands/add-scenario.js";
import { cmdDoctor } from "./commands/doctor.js";
import { parseArgs } from "./core/args.js";

const HELP = `
Usage:
  sdd-lite <command> [args] [options]

Commands:
  init                    Init SDD-lite infrastructure
  add-module <modulePath> Create <modulePath>/__sdd__/ skeleton
  add-scenario <modulePath>  Create a scenario under modulePath
  doctor                  Check current project status

Options:
  --type <vue2|vue3|mp-wechat>   Project type for init
  --entry <path>                Entry file for web init (e.g. src/main.ts)
  --ts | --js                   Preferred output language (default: auto)
  --id <id>                     Scenario id (add-scenario)
  --title <title>               Scenario title (add-scenario)
  --template <basic|api-variants> Scenario template (add-scenario)
  --json                         JSON output (doctor)
  -h, --help                     Show help
`;

export async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help || !parsed.command) {
    process.stdout.write(HELP);
    return;
  }

  const ctx = { cwd: process.cwd() };
  switch (parsed.command) {
    case "init":
      await cmdInit(ctx, parsed);
      return;
    case "add-module":
      await cmdAddModule(ctx, parsed);
      return;
    case "add-scenario":
      await cmdAddScenario(ctx, parsed);
      return;
    case "doctor":
      await cmdDoctor(ctx, parsed);
      return;
    default:
      process.stderr.write(`Unknown command: ${parsed.command}\n`);
      process.stdout.write(HELP);
  }
}

