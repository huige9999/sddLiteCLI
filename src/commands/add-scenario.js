import path from "node:path";
import { ensureDir, pathExists, writeGenerated, writeIfAbsent } from "../core/fs.js";
import { promptSelect, promptText } from "../core/io.js";
import { createReport, printReport } from "../core/report.js";
import { detectPreferredLangExt } from "../core/project.js";
import { detectMpRoot } from "../core/mp.js";
import {
  tplHelperApiPatch,
  tplScenarioApiVariants,
  tplScenarioBasic,
} from "../templates/module.js";
import { ensureModuleScaffold } from "./add-module.js";
import { generateMpManifest } from "./manifest.js";

export async function cmdAddScenario(ctx, parsed) {
  const modulePath = parsed.args[0];
  if (!modulePath) throw new Error("Missing <modulePath>");

  const report = createReport({ title: "add-scenario" });
  const projectRoot = ctx.cwd;
  const explicitLang = parsed.flags.ts ? "ts" : parsed.flags.js ? "js" : undefined;
  const ext = await detectPreferredLangExt(projectRoot, { explicit: explicitLang });

  // Ensure module skeleton exists (idempotent).
  const absModule = path.resolve(projectRoot, modulePath);
  const { sddRoot } = await ensureModuleScaffold({ absModule, ext, report });
  await ensureDir(path.join(sddRoot, "scenarios"));
  await ensureDir(path.join(sddRoot, "helpers"));

  const id = (parsed.flags.id && String(parsed.flags.id)) || (await promptText("Scenario id"));
  if (!id) throw new Error("Scenario id required");

  const title =
    (parsed.flags.title && String(parsed.flags.title)) || (await promptText("Scenario title", { defaultValue: id }));

  const template = normalizeTemplate(parsed.flags.template)
    ? normalizeTemplate(parsed.flags.template)
    : await promptSelect("Select template", ["basic", "api-variants"]);

  const scenarioFile = path.join(sddRoot, "scenarios", `${id}.scenario.${ext}`);
  if (await pathExists(scenarioFile)) {
    report.skipped.push(scenarioFile);
    printReport(report);
    return;
  }

  if (template === "api-variants") {
    await writeIfAbsent(path.join(sddRoot, "helpers", `apiPatch.${ext}`), tplHelperApiPatch(ext), report);
    await writeIfAbsent(scenarioFile, tplScenarioApiVariants({ id, title, ext }), report);
  } else {
    await writeIfAbsent(scenarioFile, tplScenarioBasic({ id, title, ext }), report);
  }

  await maybeRefreshMpManifest({ projectRoot, scenarioFile, ext, report });
  printReport(report);
}

function normalizeTemplate(t) {
  if (!t) return "";
  if (t === "basic" || t === "api-variants") return t;
  return "";
}

async function maybeRefreshMpManifest({ projectRoot, scenarioFile, ext, report }) {
  const mpRoot = await detectMpRoot(projectRoot);
  if (!mpRoot) return;

  const rel = path.relative(mpRoot, scenarioFile);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return;

  const sddDir = path.join(mpRoot, "__sdd__");
  await writeGenerated(path.join(sddDir, `manifest.${ext}`), await generateMpManifest(mpRoot, ext), report, {
    updateGenerated: true,
  });
}
