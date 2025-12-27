import path from "node:path";
import {
  ensureDir,
  pathExists,
  readText,
  patchTextFile,
  toPosixPath,
  writeGenerated,
  writeIfAbsent,
} from "../core/fs.js";
import { patchJsonFile } from "../core/json.js";
import { promptSelect } from "../core/io.js";
import { createReport, printReport } from "../core/report.js";
import { detectPreferredLangExt } from "../core/project.js";
import { detectMpRoot } from "../core/mp.js";
import {
  tplAgentGuideMd,
  tplWebBoot,
  tplWebDiscoverVite,
  tplWebDiscoverWebpack,
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
const ENTRY_MARK_VITE = "/* sdd-lite:boot:vite */";
const ENTRY_MARK_WEBPACK = "/* sdd-lite:boot:webpack */";

function normalizeType(type) {
  if (!type) return "";
  if (type === "mp" || type === "wechat" || type === "mp-wechat") return "mp-wechat";
  if (type === "vue2" || type === "vue3") return type;
  return "";
}

export async function cmdInit(ctx, parsed) {
  const report = createReport({ title: "init" });
  const projectRoot = ctx.cwd;

  let type = normalizeType(parsed.flags.type);
  if (!type) {
    type = await promptSelect("Select project type", ["vue2", "vue3", "mp-wechat"]);
  }

  const explicitLang = parsed.flags.ts ? "ts" : parsed.flags.js ? "js" : undefined;
  const ext = await detectPreferredLangExt(projectRoot, { explicit: explicitLang });
  const updateGenerated = Boolean(parsed.flags.update || parsed.flags.force);

  if (type === "mp-wechat") {
    await initMpWechat(projectRoot, { ext, report, updateGenerated });
    printReport(report);
    return;
  }

  await initWeb(projectRoot, {
    type,
    ext,
    report,
    entryPath: parsed.flags.entry,
    bundler: parsed.flags.bundler,
    updateGenerated,
  });
  printReport(report);
}

async function initWeb(projectRoot, { ext, report, entryPath, bundler, updateGenerated }) {
  const sddDir = path.join(projectRoot, "src", "__sdd__");
  await ensureDir(sddDir);

  await writeGenerated(path.join(sddDir, `runtime.${ext}`), tplWebRuntime(ext), report, { updateGenerated });

  const pickedBundler = await detectWebBundler(projectRoot, bundler);
  const discoverTpl = pickedBundler === "vite" ? tplWebDiscoverVite(ext) : tplWebDiscoverWebpack(ext);
  await writeGenerated(path.join(sddDir, `discover.${ext}`), discoverTpl, report, { updateGenerated });
  await writeGenerated(path.join(sddDir, `boot.${ext}`), tplWebBoot(ext), report, { updateGenerated });
  await writeGenerated(path.join(sddDir, "README.md"), tplWebReadmeMd(), report, { updateGenerated });
  await writeGenerated(path.join(sddDir, "AGENT_GUIDE.md"), tplAgentGuideMd(), report, { updateGenerated });

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
      `Entry not found. Manually add (dev-only) import in your entry file:\n${ENTRY_MARK_WEBPACK}\nif (process.env.NODE_ENV !== 'production') { require('./__sdd__/boot') }`,
    );
    return;
  }

  const bootImportPath = "./__sdd__/boot";
  const patch =
    pickedBundler === "vite"
      ? { mark: ENTRY_MARK_VITE, snippet: makeWebEntrySnippetVite(bootImportPath) }
      : { mark: ENTRY_MARK_WEBPACK, snippet: makeWebEntrySnippetWebpack(bootImportPath) };
  await patchTextFile(
    entry,
    (prev) => {
      if (
        prev.includes(ENTRY_MARK) ||
        prev.includes(ENTRY_MARK_VITE) ||
        prev.includes(ENTRY_MARK_WEBPACK)
      )
        return null;
      if (prev.includes(bootImportPath) && prev.includes("__sdd__")) return null;

      const lines = prev.split("\n");
      const insertAt = findInsertAfterImports(lines);
      lines.splice(insertAt, 0, patch.mark, patch.snippet, "");
      return lines.join("\n");
    },
    report,
  );
}

function makeWebEntrySnippetVite(bootImportPath) {
  return ["if (import.meta.env?.DEV) {", `  void import(${JSON.stringify(bootImportPath)});`, "}"].join(
    "\n",
  );
}

function makeWebEntrySnippetWebpack(bootImportPath) {
  // [优化] 简化判断逻辑，只要不是生产环境就引入
  // 如果是 Vue CLI，process.env.NODE_ENV 通常是可用的
  return [
    `if (process.env.NODE_ENV !== 'production') {`,
    `  try { require(${JSON.stringify(bootImportPath)}); } catch (e) { console.warn('[SDD] Boot failed', e); }`,
    "}",
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

async function initMpWechat(projectRoot, { ext, report, updateGenerated }) {
  const mpRoot = (await detectMpRoot(projectRoot)) || projectRoot;

  const sddDir = path.join(mpRoot, "__sdd__");
  await ensureDir(sddDir);

  await writeGenerated(path.join(sddDir, `runtime.${ext}`), tplMpRuntime(ext), report, { updateGenerated });
  await writeGenerated(path.join(sddDir, `boot.${ext}`), tplMpBoot(ext), report, { updateGenerated });
  await writeGenerated(path.join(sddDir, "README.md"), tplMpReadmeMd(), report, { updateGenerated });
  await writeGenerated(path.join(sddDir, "AGENT_GUIDE.md"), tplMpAgentGuideMd(), report, { updateGenerated });

  const pageDir = path.join(mpRoot, "pages", "__sdd__");
  await ensureDir(pageDir);
  await writeGenerated(path.join(pageDir, `index.${ext}`), tplMpDebugPage(ext), report, { updateGenerated });
  await writeGenerated(path.join(pageDir, "index.wxml"), tplMpDebugPageWxml(), report, { updateGenerated });
  await writeGenerated(path.join(pageDir, "index.wxss"), tplMpDebugPageWxss(), report, { updateGenerated });
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
  await writeGenerated(path.join(sddDir, `manifest.${ext}`), await generateMpManifest(mpRoot, ext), report, {
    updateGenerated: true,
  });

  // Optional: if there are scenarios outside mpRoot, we ignore by design.
}

async function detectWebBundler(projectRoot, bundlerFlag) {
  const normalized = String(bundlerFlag || "auto");
  if (normalized === "vite" || normalized === "webpack") return normalized;

  // 1. Check Vite config files
  const viteConfigs = ["vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.cjs"].map((f) =>
    path.join(projectRoot, f),
  );
  if (await findFirstExisting(viteConfigs)) return "vite";

  // 2. Check package.json dependencies
  const pkgJson = path.join(projectRoot, "package.json");
  if (await pathExists(pkgJson)) {
    try {
      const pkg = JSON.parse(await readText(pkgJson));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      
      if (typeof deps.vite === "string") return "vite";
      
      // [新增] 显式检测 Vue CLI (基于 Webpack)
      if (typeof deps["@vue/cli-service"] === "string") return "webpack";
      
    } catch {
      // ignore
    }
  }

  // 3. Default fallback
  // [优化] 如果是自动模式且没有任何特征，给个提示
  if (normalized === "auto") {
    console.log("  [info] No specific bundler detected, defaulting to Webpack.");
  }
  return "webpack";
}

async function findFirstExisting(candidates) {
  for (const p of candidates) {
    if (await pathExists(p)) return p;
  }
  return "";
}
