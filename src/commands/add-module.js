import path from "node:path";
import { ensureDir, writeIfAbsent } from "../core/fs.js";
import { createReport, printReport } from "../core/report.js";
import { detectPreferredLangExt } from "../core/project.js";
import {
  tplModuleMocksIndex,
  tplModuleScenariosReadmeMd,
  tplModuleSddTools,
} from "../templates/module.js";

export async function cmdAddModule(ctx, parsed) {
  const modulePath = parsed.args[0];
  if (!modulePath) throw new Error("Missing <modulePath>");

  const report = createReport({ title: "add-module" });
  const projectRoot = ctx.cwd;
  const explicitLang = parsed.flags.ts ? "ts" : parsed.flags.js ? "js" : undefined;
  const ext = await detectPreferredLangExt(projectRoot, { explicit: explicitLang });

  const absModule = path.resolve(projectRoot, modulePath);
  await ensureModuleScaffold({ absModule, ext, report });

  printReport(report);
}

export async function ensureModuleScaffold({ absModule, ext, report }) {
  const sddRoot = path.join(absModule, "__sdd__");

  await ensureDir(path.join(sddRoot, "helpers"));
  await ensureDir(path.join(sddRoot, "mocks"));
  await ensureDir(path.join(sddRoot, "scenarios"));

  await writeIfAbsent(path.join(sddRoot, "helpers", `sddTools.${ext}`), tplModuleSddTools(ext), report);
  await writeIfAbsent(path.join(sddRoot, "mocks", `index.${ext}`), tplModuleMocksIndex(ext), report);
  await writeIfAbsent(path.join(sddRoot, "scenarios", "README.md"), tplModuleScenariosReadmeMd(), report);

  return { sddRoot };
}
