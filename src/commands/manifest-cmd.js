import path from "node:path";
import { createReport, printReport } from "../core/report.js";
import { detectPreferredLangExt } from "../core/project.js";
import { ensureDir, writeGenerated } from "../core/fs.js";
import { detectMpRoot } from "../core/mp.js";
import { generateMpManifest } from "./manifest.js";

export async function cmdManifest(ctx, parsed) {
  const report = createReport({ title: "manifest" });
  const projectRoot = ctx.cwd;

  const explicitLang = parsed.flags.ts ? "ts" : parsed.flags.js ? "js" : undefined;
  const ext = await detectPreferredLangExt(projectRoot, { explicit: explicitLang });

  const mpRoot = await detectMpRoot(projectRoot);
  if (!mpRoot) {
    report.notes.push("miniprogram/ not found; nothing to regenerate.");
    printReport(report);
    return;
  }

  const sddDir = path.join(mpRoot, "__sdd__");
  await ensureDir(sddDir);
  await writeGenerated(path.join(sddDir, `manifest.${ext}`), await generateMpManifest(mpRoot, ext), report, {
    updateGenerated: true,
  });

  printReport(report);
}
