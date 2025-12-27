import path from "node:path";
import {
  ensureDir,
  pathExists,
  patchTextFile,
  toPosixPath,
  writeGenerated,
  writeIfAbsent,
} from "../core/fs.js";
import { patchJsonFile } from "../core/json.js";
import { promptSelect } from "../core/io.js";
import { createReport, printReport } from "../core/report.js";
import { detectPreferredLangExt } from "../core/project.js";
import {
  tplAgentGuideMd,
  tplWebBoot,
  tplWebDiscover,
  tplWebReadmeMd,
  tplWebRuntime,
} from "../templates/web.js";
import {
  tplMpAgentGuideMd,
  tplMpBoot,
  tplMpDebugPageJson,
  tplMpDebugPage,
  tplMpDebugPageWxml,
  tplMpDebugPageWxss,
  tplMpReadmeMd,
  tplMpRuntime,
} from "../templates/mp.js";
import { generateMpManifest } from "./manifest.js";

const ENTRY_MARK = "/* sdd-lite:boot */";

function normalizeType(type) {
  if (!type) return "";
  if (type === "mp" || type === "wechat" || type === "mp-wechat") return "mp-wechat";
  if (type === "vue2" || type === "vue3") return type;
  return "";
}

export async function cmdInit(ctx, parsed) {
  const report = createReport();
  const projectRoot = ctx.cwd;

  let type = normalizeType(parsed.flags.type);
  if (!type) {
    type = await promptSelect("Select project type", ["vue2", "vue3", "mp-wechat"]);
  }

  const explicitLang = parsed.flags.ts ? "ts" : parsed.flags.js ? "js" : undefined;
  const ext = await detectPreferredLangExt(projectRoot, { explicit: explicitLang });

  if (type === "mp-wechat") {
    await initMpWechat(projectRoot, { ext, report });
    printReport(report);
    return;
  }

  await initWeb(projectRoot, { type, ext, report, entryPath: parsed.flags.entry });
  printReport(report);
}

async function initWeb(projectRoot, { ext, report, entryPath }) {
  const sddDir = path.join(projectRoot, "src", "__sdd__");
  await ensureDir(sddDir);

  await writeIfAbsent(path.join(sddDir, `runtime.${ext}`), tplWebRuntime(ext), report);
  await writeIfAbsent(path.join(sddDir, `discover.${ext}`), tplWebDiscover(ext), report);
  await writeIfAbsent(path.join(sddDir, `boot.${ext}`), tplWebBoot(ext), report);
  await writeIfAbsent(path.join(sddDir, "README.md"), tplWebReadmeMd(), report);
  await writeIfAbsent(path.join(sddDir, "AGENT_GUIDE.md"), tplAgentGuideMd(), report);

  const entryCandidates = entryPath
    ? [path.join(projectRoot, entryPath)]
    : [
        path.join(projectRoot, "src", "main.ts"),
        path.join(projectRoot, "src", "main.js"),
        path.join(projectRoot, "src", "index.ts"),
        path.join(projectRoot, "src", "index.js"),
      ];

  const entry = await findFirstExisting(entryCandidates);
  if (!entry) {
    report.notes.push(
      `Entry not found. Manually add (dev-only) import in your entry file:\n${ENTRY_MARK}\nif (process.env.NODE_ENV !== 'production') { require('./__sdd__/boot') }`,
    );
    return;
  }

  const bootImportPath = "./__sdd__/boot";
  const patchSnippet = makeWebEntrySnippet(bootImportPath);
  await patchTextFile(
    entry,
    (prev) => {
      if (prev.includes(ENTRY_MARK)) return null;
      if (prev.includes(bootImportPath) && prev.includes("__sdd__")) return null;

      const lines = prev.split("\n");
      const insertAt = findInsertAfterImports(lines);
      lines.splice(insertAt, 0, ENTRY_MARK, patchSnippet, "");
      return lines.join("\n");
    },
    report,
  );
}

function makeWebEntrySnippet(bootImportPath) {
  return [
    "(() => {",
    "  try {",
    "    // Vite",
    "    if ((import.meta).env?.DEV) { void import(" + JSON.stringify(bootImportPath) + "); return; }",
    "  } catch {}",
    "  // Webpack/others",
    "  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {",
    "    try { require(" + JSON.stringify(bootImportPath) + "); } catch {}",
    "  }",
    "})();",
  ].join("\n");
}

function findInsertAfterImports(lines) {
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const l = lines[i];
    if (/^\s*import\s/.test(l) || /^\s*require\(/.test(l)) lastImport = i;
  }
  return lastImport >= 0 ? lastImport + 1 : 0;
}

async function initMpWechat(projectRoot, { ext, report }) {
  const mpRoot = (await pathExists(path.join(projectRoot, "miniprogram")))
    ? path.join(projectRoot, "miniprogram")
    : projectRoot;

  const sddDir = path.join(mpRoot, "__sdd__");
  await ensureDir(sddDir);

  await writeIfAbsent(path.join(sddDir, `runtime.${ext}`), tplMpRuntime(ext), report);
  await writeIfAbsent(path.join(sddDir, `boot.${ext}`), tplMpBoot(ext), report);
  await writeIfAbsent(path.join(sddDir, "README.md"), tplMpReadmeMd(), report);
  await writeIfAbsent(path.join(sddDir, "AGENT_GUIDE.md"), tplMpAgentGuideMd(), report);

  const pageDir = path.join(mpRoot, "pages", "__sdd__");
  await ensureDir(pageDir);
  await writeIfAbsent(path.join(pageDir, `index.${ext}`), tplMpDebugPage(ext), report);
  await writeIfAbsent(path.join(pageDir, "index.wxml"), tplMpDebugPageWxml(), report);
  await writeIfAbsent(path.join(pageDir, "index.wxss"), tplMpDebugPageWxss(), report);
  await writeIfAbsent(path.join(pageDir, "index.json"), tplMpDebugPageJson(), report);

  const appJsonCandidates = [path.join(mpRoot, "app.json"), path.join(projectRoot, "app.json")];
  const appJson = await findFirstExisting(appJsonCandidates);
  if (!appJson) {
    report.notes.push(`app.json not found. Please add page manually: ${toPosixPath(path.join("pages", "__sdd__", "index"))}`);
    return;
  }

  const pagePath = toPosixPath(path.relative(mpRoot, path.join(mpRoot, "pages", "__sdd__", "index")));
  const normalized = pagePath.replace(/\\.(ts|js)$/, "");
  const target = normalized.endsWith("/index") ? normalized : `${normalized}/index`;

  const patched = await patchJsonFile(
    appJson,
    (obj) => {
      if (!obj || typeof obj !== "object") return null;
      if (!Array.isArray(obj.pages)) obj.pages = [];
      if (obj.pages.includes(target)) return null;
      obj.pages = [target, ...obj.pages];
      return obj;
    },
    report,
  );

  if (!patched.patched && patched.reason !== "no-change") {
    report.notes.push(`Failed to patch ${appJson}. Please ensure pages includes: ${target}`);
  }

  // Generate/refresh manifest after potential new files.
  await writeGenerated(path.join(sddDir, `manifest.${ext}`), await generateMpManifest(mpRoot, ext), report);

  // Optional: if there are scenarios outside mpRoot, we ignore by design.
}

async function findFirstExisting(candidates) {
  for (const p of candidates) {
    if (await pathExists(p)) return p;
  }
  return "";
}
