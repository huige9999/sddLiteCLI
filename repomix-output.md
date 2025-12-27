This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: bin, package.json, src
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
bin/
  sdd-lite.js
src/
  commands/
    add-module.js
    add-scenario.js
    doctor.js
    init.js
    manifest-cmd.js
    manifest.js
  core/
    args.js
    fs.js
    io.js
    json.js
    mp.js
    project.js
    report.js
  templates/
    module.js
    mp.js
    web.js
  cli.js
package.json
```

# Files

## File: src/commands/manifest-cmd.js
```javascript
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
```

## File: src/core/mp.js
```javascript
import path from "node:path";
import { pathExists } from "./fs.js";

export async function detectMpRoot(projectRoot) {
  const miniprogramRoot = path.join(projectRoot, "miniprogram");
  if (await pathExists(path.join(miniprogramRoot, "app.json"))) return miniprogramRoot;

  if (await pathExists(path.join(projectRoot, "app.json"))) return projectRoot;

  return "";
}
```

## File: bin/sdd-lite.js
```javascript
#!/usr/bin/env node
import { main } from "../src/cli.js";

main(process.argv.slice(2)).catch((err) => {
  const message = err instanceof Error ? err.stack || err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
```

## File: src/commands/add-module.js
```javascript
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
```

## File: src/commands/add-scenario.js
```javascript
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
```

## File: src/commands/doctor.js
```javascript
import path from "node:path";
import { pathExists, readText, toPosixPath, walkFiles } from "../core/fs.js";
import { readJson } from "../core/json.js";

function ok(id, message, fix) {
  return { id, level: "ok", message, fix };
}
function warn(id, message, fix) {
  return { id, level: "warn", message, fix };
}
function fail(id, message, fix) {
  return { id, level: "fail", message, fix };
}

export async function cmdDoctor(ctx, parsed) {
  const checks = [];
  const root = ctx.cwd;

  const type = String(parsed.flags.type || "auto");
  const runWeb = type === "auto" || type === "web" || type === "vue2" || type === "vue3";
  const runMp = type === "auto" || type === "mp-wechat" || type === "mp" || type === "wechat";

  if (runWeb) checks.push(...(await doctorWeb(root)));
  if (runMp) checks.push(...(await doctorMp(root)));

  if (parsed.flags.json) {
    process.stdout.write(JSON.stringify({ checks }, null, 2) + "\n");
    return;
  }

  for (const c of checks) {
    const tag = c.level === "ok" ? "[OK]" : c.level === "warn" ? "[WARN]" : "[FAIL]";
    process.stdout.write(`${tag} ${c.message}\n`);
    if (c.fix) process.stdout.write(`      fix: ${c.fix}\n`);
  }
}

async function doctorWeb(root) {
  /** @type {any[]} */
  const out = [];
  const sddDir = path.join(root, "src", "__sdd__");
  const boot = path.join(sddDir, "boot.ts");
  const bootJs = path.join(sddDir, "boot.js");

  if (await pathExists(sddDir)) out.push(ok("web.sddDir", `Found ${toPosixPath("src/__sdd__")}`));
  else {
    out.push(warn("web.sddDir", `Missing ${toPosixPath("src/__sdd__")}`, "Run: sdd-lite init --type vue3"));
    return out;
  }

  if ((await pathExists(boot)) || (await pathExists(bootJs))) out.push(ok("web.boot", "Found web boot file"));
  else out.push(fail("web.boot", "Missing web boot file", "Re-run: sdd-lite init"));

  const entryCandidates = [
    path.join(root, "src", "main.ts"),
    path.join(root, "src", "main.js"),
    path.join(root, "src", "index.ts"),
    path.join(root, "src", "index.js"),
  ];
  const entry = await firstExisting(entryCandidates);
  if (!entry) out.push(warn("web.entry", "Entry file not found (checked src/main.* and src/index.*)."));
  else {
    const text = await readText(entry);
    if (text.includes("sdd-lite:boot") || text.includes("./__sdd__/boot")) out.push(ok("web.entryPatch", `Entry patched: ${toPosixPath(path.relative(root, entry))}`));
    else out.push(warn("web.entryPatch", `Entry not patched: ${toPosixPath(path.relative(root, entry))}`, "Add dev-only import of ./__sdd__/boot"));
  }

  const scenarioFiles = (await walkFiles(path.join(root, "src"))).filter((p) =>
    /\/__sdd__\/scenarios\/.*\.scenario\.(ts|js)$/.test(toPosixPath(p)),
  );
  const ids = new Map();
  for (const file of scenarioFiles) {
    const text = await readText(file);
    const id = extractField(text, "id");
    const title = extractField(text, "title");
    const hasSetup = /setup\s*\(/.test(text) || /setup\s*:\s*\(/.test(text);

    if (!id) out.push(warn("web.scenario.id", `Scenario missing id: ${toPosixPath(path.relative(root, file))}`));
    else {
      const prev = ids.get(id);
      if (prev) out.push(fail("web.scenario.dup", `Duplicate scenario id: ${id}`, `${toPosixPath(path.relative(root, prev))} and ${toPosixPath(path.relative(root, file))}`));
      else ids.set(id, file);
    }
    if (!title) out.push(warn("web.scenario.title", `Scenario missing title: ${toPosixPath(path.relative(root, file))}`));
    if (!hasSetup) out.push(warn("web.scenario.setup", `Scenario missing setup(): ${toPosixPath(path.relative(root, file))}`));
  }

  out.push(ok("web.scenario.count", `Scenarios found (src): ${scenarioFiles.length}`));
  return out;
}

async function doctorMp(root) {
  /** @type {any[]} */
  const out = [];
  const mpRoot = (await pathExists(path.join(root, "miniprogram"))) ? path.join(root, "miniprogram") : "";
  if (!mpRoot) return out;

  const sddDir = path.join(mpRoot, "__sdd__");
  const manifestTs = path.join(sddDir, "manifest.ts");
  const manifestJs = path.join(sddDir, "manifest.js");
  const pageDir = path.join(mpRoot, "pages", "__sdd__");

  if (await pathExists(sddDir)) out.push(ok("mp.sddDir", `Found ${toPosixPath(path.relative(root, sddDir))}`));
  else {
    out.push(warn("mp.sddDir", `Missing ${toPosixPath(path.relative(root, sddDir))}`, "Run: sdd-lite init --type mp-wechat"));
    return out;
  }

  if ((await pathExists(manifestTs)) || (await pathExists(manifestJs))) out.push(ok("mp.manifest", "Found mp manifest"));
  else out.push(fail("mp.manifest", "Missing mp manifest", "Re-run: sdd-lite init --type mp-wechat"));

  if (await pathExists(pageDir)) out.push(ok("mp.page", "Found mp debug page directory"));
  else out.push(warn("mp.page", "Missing mp debug page", "Re-run: sdd-lite init --type mp-wechat"));

  const appJson = path.join(mpRoot, "app.json");
  if (!(await pathExists(appJson))) {
    out.push(warn("mp.appJson", "Missing miniprogram/app.json (cannot check page registration)"));
    return out;
  }

  try {
    const obj = await readJson(appJson);
    const pages = Array.isArray(obj.pages) ? obj.pages : [];
    const mustHave = "pages/__sdd__/index";
    if (pages.includes(mustHave)) out.push(ok("mp.pages", `app.json registered ${mustHave}`));
    else out.push(warn("mp.pages", `app.json missing ${mustHave}`, `Add ${mustHave} into pages[]`));
  } catch {
    out.push(warn("mp.appJson", "Failed to parse miniprogram/app.json (cannot check page registration)"));
  }

  const scenarioFiles = (await walkFiles(mpRoot)).filter((p) =>
    /\/__sdd__\/scenarios\/.*\.scenario\.(ts|js)$/.test(toPosixPath(p)),
  );
  out.push(ok("mp.scenario.count", `Scenarios found (miniprogram): ${scenarioFiles.length}`));
  return out;
}

async function firstExisting(candidates) {
  for (const c of candidates) if (await pathExists(c)) return c;
  return "";
}

function extractField(text, field) {
  const m = text.match(new RegExp(`${field}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`));
  return m?.[1] || "";
}
```

## File: src/commands/init.js
```javascript
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
  return [
    "if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {",
    `  try { require(${JSON.stringify(bootImportPath)}); } catch {}`,
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

  const viteConfigs = ["vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.cjs"].map((f) =>
    path.join(projectRoot, f),
  );
  if (await findFirstExisting(viteConfigs)) return "vite";

  const pkgJson = path.join(projectRoot, "package.json");
  if (await pathExists(pkgJson)) {
    try {
      const pkg = JSON.parse(await readText(pkgJson));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (typeof deps.vite === "string") return "vite";
    } catch {
      // ignore
    }
  }

  // Default: webpack/unknown-safe
  return "webpack";
}

async function findFirstExisting(candidates) {
  for (const p of candidates) {
    if (await pathExists(p)) return p;
  }
  return "";
}
```

## File: src/commands/manifest.js
```javascript
import path from "node:path";
import { toPosixPath, walkFiles } from "../core/fs.js";

export async function generateMpManifest(mpRoot, ext) {
  const scenarioFiles = (await walkFiles(mpRoot)).filter((p) =>
    /\/__sdd__\/scenarios\/.*\.scenario\.(ts|js)$/.test(toPosixPath(p)),
  );

  const manifestDir = path.join(mpRoot, "__sdd__");
  const imports = [];
  const items = [];

  scenarioFiles.sort((a, b) => a.localeCompare(b));
  scenarioFiles.forEach((absPath, idx) => {
    const rel = toPosixPath(path.relative(manifestDir, absPath));
    const importPath = rel.startsWith(".") ? rel : `./${rel}`;
    const varName = `s${idx}`;
    imports.push(`import ${varName} from ${JSON.stringify(importPath)};`);
    items.push(varName);
  });

  if (ext === "js") {
    return [...imports, "", `export const scenarios = [${items.join(", ")}];`, ""].join("\n");
  }

  return [
    `import type { Runtime } from "./runtime";`,
    "",
    `export type Scenario = {`,
    `  id: string;`,
    `  title: string;`,
    `  note?: string;`,
    `  setup(ctx: { runtime: Runtime; options?: any }): void | Promise<void>;`,
    `};`,
    "",
    ...imports,
    "",
    `export const scenarios: Scenario[] = [${items.join(", ")}];`,
    "",
  ].join("\n");
}
```

## File: src/core/args.js
```javascript
export function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  /** @type {string[]} */
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;

    if (token === "-h" || token === "--help") {
      flags.help = true;
      continue;
    }

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }

    positionals.push(token);
  }

  const command = positionals[0] || "";
  const args = positionals.slice(1);

  return {
    command,
    args,
    flags,
    help: Boolean(flags.help),
  };
}
```

## File: src/core/fs.js
```javascript
import fs from "node:fs/promises";
import path from "node:path";

export async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readText(filePath) {
  return await fs.readFile(filePath, "utf8");
}

export async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

export async function writeIfAbsent(filePath, content, report) {
  if (await pathExists(filePath)) {
    report?.skipped?.push(filePath);
    return { wrote: false, reason: "exists" };
  }
  await writeText(filePath, content);
  report?.added?.push(filePath);
  return { wrote: true };
}

const GENERATED_MARK = "@generated by sdd-lite";

function generatedHeaderForPath(filePath) {
  const lower = String(filePath).toLowerCase();
  if (
    lower.endsWith(".md") ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".wxml")
  ) {
    return `<!-- ${GENERATED_MARK} -->\n`;
  }
  if (
    lower.endsWith(".css") ||
    lower.endsWith(".wxss") ||
    lower.endsWith(".scss") ||
    lower.endsWith(".less")
  ) {
    return `/* ${GENERATED_MARK} */\n`;
  }
  if (lower.endsWith(".json")) return "";
  return `// ${GENERATED_MARK}\n`;
}

function isGeneratedText(text) {
  return (
    text.startsWith(`// ${GENERATED_MARK}`) ||
    text.startsWith(`<!-- ${GENERATED_MARK}`) ||
    text.startsWith(`/* ${GENERATED_MARK}`)
  );
}

export async function writeGenerated(filePath, content, report, { updateGenerated = false } = {}) {
  const header = generatedHeaderForPath(filePath);
  if (!header) throw new Error(`writeGenerated does not support file type: ${filePath}`);
  const next = `${header}${content}`;
  if (!(await pathExists(filePath))) {
    await writeText(filePath, next);
    report?.added?.push(filePath);
    return { wrote: true, kind: "add" };
  }

  const prev = await readText(filePath);
  if (!isGeneratedText(prev)) {
    const examplePath = `${filePath}.example`;
    if (!(await pathExists(examplePath))) {
      await writeText(examplePath, next);
      report?.added?.push(examplePath);
      report?.notes?.push(`Existing file kept, wrote example: ${examplePath}`);
      return { wrote: true, kind: "example" };
    }
    report?.skipped?.push(filePath);
    report?.notes?.push(`Existing file kept, example already exists: ${examplePath}`);
    return { wrote: false, kind: "skip" };
  }

  if (!updateGenerated) {
    report?.skipped?.push(filePath);
    report?.notes?.push(`Generated file exists; re-run with --update to refresh: ${filePath}`);
    return { wrote: false, kind: "skip" };
  }

  if (prev === next) {
    report?.skipped?.push(filePath);
    return { wrote: false, kind: "skip" };
  }
  await writeText(filePath, next);
  report?.modified?.push(filePath);
  return { wrote: true, kind: "mod" };
}

export async function patchTextFile(filePath, patcher, report) {
  if (!(await pathExists(filePath))) {
    report?.notes?.push(`Patch skipped, file missing: ${filePath}`);
    return { patched: false, reason: "missing" };
  }
  const prev = await readText(filePath);
  const next = patcher(prev);
  if (next == null || next === prev) {
    report?.skipped?.push(filePath);
    return { patched: false, reason: "no-change" };
  }
  await writeText(filePath, next);
  report?.modified?.push(filePath);
  return { patched: true };
}

export async function walkFiles(rootDir, { ignoreDirs } = {}) {
  /** @type {string[]} */
  const results = [];
  const ignores = new Set(ignoreDirs || ["node_modules", ".git", "dist"]);

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ignores.has(ent.name)) continue;
        await walk(full);
        continue;
      }
      if (ent.isFile()) results.push(full);
    }
  }

  if (await pathExists(rootDir)) await walk(rootDir);
  return results;
}

export function toPosixPath(p) {
  return p.split(path.sep).join("/");
}
```

## File: src/core/io.js
```javascript
import readline from "node:readline";

export async function promptText(message, { defaultValue } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const q = defaultValue ? `${message} (${defaultValue}): ` : `${message}: `;
    const answer = await new Promise((resolve) => rl.question(q, resolve));
    const trimmed = String(answer).trim();
    return trimmed || defaultValue || "";
  } finally {
    rl.close();
  }
}

export async function promptSelect(message, options) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.stdout.write(`${message}\n`);
    options.forEach((opt, idx) => {
      process.stdout.write(`  ${idx + 1}) ${opt}\n`);
    });
    const answer = await new Promise((resolve) => rl.question(`Select 1-${options.length}: `, resolve));
    const n = Number(String(answer).trim());
    if (!Number.isFinite(n) || n < 1 || n > options.length) {
      throw new Error(`Invalid selection: ${answer}`);
    }
    return options[n - 1];
  } finally {
    rl.close();
  }
}
```

## File: src/core/json.js
```javascript
import { patchTextFile, readText } from "./fs.js";

export async function readJson(filePath) {
  const text = await readText(filePath);
  return JSON.parse(text);
}

export async function patchJsonFile(filePath, patcher, report) {
  return await patchTextFile(
    filePath,
    (prevText) => {
      let prevObj;
      try {
        prevObj = JSON.parse(prevText);
      } catch {
        return null;
      }
      const nextObj = patcher(prevObj);
      if (nextObj == null) return null;
      const nextText = JSON.stringify(nextObj, null, 2) + "\n";
      return nextText === prevText ? null : nextText;
    },
    report,
  );
}
```

## File: src/core/project.js
```javascript
import path from "node:path";
import { pathExists } from "./fs.js";

export async function detectPreferredLangExt(projectRoot, { explicit } = {}) {
  if (explicit === "ts" || explicit === "js") return explicit;
  if (await pathExists(path.join(projectRoot, "tsconfig.json"))) return "ts";
  if (await pathExists(path.join(projectRoot, "src", "main.ts"))) return "ts";
  if (await pathExists(path.join(projectRoot, "miniprogram", "tsconfig.json"))) return "ts";
  return "js";
}
```

## File: src/core/report.js
```javascript
export function createReport({ title } = {}) {
  return /** @type {{ title?: string, added: string[], modified: string[], skipped: string[], notes: string[] }} */ ({
    title,
    added: [],
    modified: [],
    skipped: [],
    notes: [],
  });
}

export function printReport(report) {
  const lines = [];
  if (report.title) lines.push(`== ${report.title} ==`);
  const pushGroup = (label, items) => {
    if (!items.length) return;
    lines.push(`${label} (${items.length})`);
    for (const p of items) lines.push(`  - ${p}`);
  };

  pushGroup("ADD", report.added);
  pushGroup("MOD", report.modified);
  pushGroup("SKIP", report.skipped);
  pushGroup("NOTE", report.notes);

  process.stdout.write(`${lines.join("\n")}\n`);
}
```

## File: src/templates/module.js
```javascript
export function tplModuleSddTools(ext) {
  if (ext === "js") {
    return `
export function logScope(scope) {
  return (...args) => console.log(\`[SDD:\${scope}]\`, ...args);
}
`.trimStart();
  }

  return `
export function logScope(scope: string) {
  return (...args: any[]) => console.log(\`[SDD:\${scope}]\`, ...args);
}
`.trimStart();
}

export function tplModuleMocksIndex(ext) {
  if (ext === "js") {
    return `
export const mocks = {};
`.trimStart();
  }

  return `
export const mocks = {};
`.trimStart();
}

export function tplModuleScenariosReadmeMd() {
  return `
# SDD Scenarios (module)

每个场景文件必须：

\`\`\`ts
export default {
  id: string,
  title: string,
  note?: string,
  setup({ runtime, options }): void
}
\`\`\`

注意：任何副作用都必须通过 \`runtime.onReset\` 登记清理，保证切换场景不污染环境。
`.trimStart();
}

export function tplScenarioBasic({ id, title, ext }) {
  const setupSig = ext === "js" ? "setup({ runtime, options })" : "setup({ runtime, options }: any)";
  return `
export default {
  id: ${JSON.stringify(id)},
  title: ${JSON.stringify(title)},
  note: [
    "人工验证：",
    "1) 打开目标页面/模块",
    "2) 运行 window.SDD.run(\\"${id}\\")",
    "3) 观察 console log / UI 变化是否符合预期",
  ].join("\\n"),
  ${setupSig} {
    console.log("[SDD] setup", ${JSON.stringify(id)}, { options });

    const timer = setInterval(() => {
      console.log("[SDD] tick", ${JSON.stringify(id)});
    }, 1000);

    runtime.onReset(() => {
      clearInterval(timer);
    });
  },
};
`.trimStart();
}

export function tplScenarioApiVariants({ id, title, ext }) {
  const setupSig = ext === "js" ? "setup({ runtime, options })" : "setup({ runtime, options }: any)";
  return `
import { installApiPatch } from "../helpers/apiPatch";

export default {
  id: ${JSON.stringify(id)},
  title: ${JSON.stringify(title)},
  note: [
    "人工验证：",
    "1) 运行该场景后，触发页面里的接口请求动作",
    "2) 在 console/Network 面板观察不同 variant 的效果",
    "3) 切换场景后，拦截必须被清理（不污染其他场景）",
  ].join("\\n"),
  ${setupSig} {
    const uninstall = installApiPatch({
      runtime,
      variant: options?.variant ?? "happy-path",
    });
    runtime.onReset(uninstall);
  },
};
`.trimStart();
}

export function tplHelperApiPatch(ext) {
  const sig = ext === "js" ? "export function installApiPatch({ runtime, variant })" : "export function installApiPatch({ runtime, variant }: any)";
  return `
${sig} {
  void runtime;
  console.log("[SDD] installApiPatch", { variant });

  // TODO: 在这里做你项目里的 API 拦截/patch（不要绑定 axios/fetch，保持轻量）
  // TODO: 必须返回可逆的 uninstall（并在 reset 时调用）

  return () => {
    console.log("[SDD] uninstallApiPatch", { variant });
  };
}
`.trimStart();
}
```

## File: src/templates/mp.js
```javascript
export function tplMpRuntime(ext) {
  if (ext === "js") {
    return `
export function createRuntime() {
  const hooks = [];
  return {
    onReset(fn) {
      hooks.push(fn);
    },
    async resetEnv() {
      const toRun = hooks.splice(0, hooks.length);
      const errors = [];
      for (const fn of toRun) {
        try {
          await fn();
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length) console.warn("[SDD] resetEnv: hook errors", errors);
    },
  };
}
`.trimStart();
  }

  return `
export type ResetHook = () => void | Promise<void>;

export type Runtime = {
  onReset(fn: ResetHook): void;
  resetEnv(): Promise<void>;
};

export function createRuntime(): Runtime {
  const hooks: ResetHook[] = [];

  return {
    onReset(fn) {
      hooks.push(fn);
    },
    async resetEnv() {
      const toRun = hooks.splice(0, hooks.length);
      const errors: unknown[] = [];
      for (const fn of toRun) {
        try {
          await fn();
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length) console.warn("[SDD] resetEnv: hook errors", errors);
    },
  };
}
`.trimStart();
}

export function tplMpBoot(ext) {
  if (ext === "js") {
    return `
import { createRuntime } from "./runtime";
import { scenarios } from "./manifest";

const runtime = createRuntime();

export async function listScenarios() {
  return scenarios.map((s) => ({ id: s.id, title: s.title, note: s.note }));
}

export async function runScenario(id, options) {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error(\`Scenario not found: \${id}\`);
  await runtime.resetEnv();
  await scenario.setup({ runtime, options });
}

export function getRuntime() {
  return runtime;
}

function attachGlobal() {
  const g =
    (typeof globalThis !== "undefined" && globalThis) ||
    (typeof getApp === "function" && getApp()) ||
    {};
  if (g.SDD?.__inited) return;
  g.SDD = {
    __inited: true,
    list: listScenarios,
    run: runScenario,
    runtime,
  };
}

attachGlobal();
`.trimStart();
  }

  return `
import { createRuntime } from "./runtime";
import { scenarios } from "./manifest";

const runtime = createRuntime();

export async function listScenarios() {
  return scenarios.map((s) => ({ id: s.id, title: s.title, note: s.note }));
}

export async function runScenario(id: string, options?: any) {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error(\`Scenario not found: \${id}\`);

  await runtime.resetEnv();
  await scenario.setup({ runtime, options });
}

export function getRuntime() {
  return runtime;
}

function attachGlobal() {
  const g: any =
    (typeof globalThis !== "undefined" && (globalThis as any)) ||
    ((typeof getApp === "function" ? getApp() : undefined) as any) ||
    {};
  if (g.SDD?.__inited) return;
  g.SDD = {
    __inited: true,
    list: listScenarios,
    run: runScenario,
    runtime,
  };
}

attachGlobal();
`.trimStart();
}

export function tplMpReadmeMd() {
  return `
# SDD-lite（小程序）

推荐用调试页运行场景：\`pages/__sdd__/index\`

- 列表：页面自动渲染 manifest 中的场景
- 运行：点击运行前会先 resetEnv，确保不污染
`.trimStart();
}

export function tplMpAgentGuideMd() {
  return `
# AGENT_GUIDE (SDD-lite / 小程序)

规则同 Web：

1. 全局极薄：只放 runtime/boot/manifest
2. 模块自治：helpers/mocks/scenarios 必须在模块内
3. 场景结构固定 + onReset 清理优先
`.trimStart();
}

export function tplMpDebugPage(ext) {
  if (ext === "js") {
    return `
import { listScenarios, runScenario } from "../../__sdd__/boot";

Page({
  data: {
    scenarios: [],
    runningId: "",
    note: "",
    error: "",
  },
  async onLoad() {
    const scenarios = await listScenarios();
    this.setData({ scenarios });
  },
  async onRunTap(e) {
    const id = e?.currentTarget?.dataset?.id;
    if (!id) return;

    this.setData({ runningId: id, error: "", note: "" });
    try {
      await runScenario(id);
      const list = await listScenarios();
      const s = list.find((x) => x.id === id);
      this.setData({ note: s?.note || "" });
    } catch (err) {
      this.setData({ error: String(err?.message || err) });
    }
  },
});
`.trimStart();
  }

  return `
import { listScenarios, runScenario } from "../../__sdd__/boot";

Page({
  data: {
    scenarios: [] as any[],
    runningId: "",
    note: "",
    error: "",
  },
  async onLoad() {
    const scenarios = await listScenarios();
    this.setData({ scenarios });
  },
  async onRunTap(e: any) {
    const id = e?.currentTarget?.dataset?.id;
    if (!id) return;

    this.setData({ runningId: id, error: "", note: "" });
    try {
      await runScenario(id);
      const list = await listScenarios();
      const s = list.find((x) => x.id === id);
      this.setData({ note: s?.note || "" });
    } catch (err: any) {
      this.setData({ error: String(err?.message || err) });
    }
  },
});
`.trimStart();
}

export function tplMpDebugPageWxml() {
  return `
<view class="page">
  <view class="title">SDD-lite</view>

  <view wx:if="{{error}}" class="error">{{error}}</view>
  <view wx:if="{{note}}" class="note">{{note}}</view>

  <view class="list">
    <view wx:for="{{scenarios}}" wx:key="id" class="item">
      <view class="meta">
        <view class="id">{{item.id}}</view>
        <view class="t">{{item.title}}</view>
      </view>
      <button data-id="{{item.id}}" bindtap="onRunTap" size="mini">运行</button>
    </view>
  </view>
</view>
`.trimStart();
}

export function tplMpDebugPageWxss() {
  return `
.page { padding: 16px; }
.title { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
.error { color: #b91c1c; margin-bottom: 12px; white-space: pre-wrap; }
.note { color: #374151; margin-bottom: 12px; white-space: pre-wrap; }
.item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
.id { font-family: monospace; color: #111827; }
.t { color: #6b7280; font-size: 12px; }
`.trimStart();
}

export function tplMpDebugPageJson() {
  return JSON.stringify({ navigationBarTitleText: "SDD-lite" }, null, 2) + "\n";
}
```

## File: src/templates/web.js
```javascript
export function tplWebRuntime(ext) {
  if (ext === "js") {
    return `
export function createRuntime() {
  const hooks = [];
  return {
    onReset(fn) {
      hooks.push(fn);
    },
    async resetEnv() {
      const toRun = hooks.splice(0, hooks.length);
      const errors = [];
      for (const fn of toRun) {
        try {
          await fn();
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length) {
        console.warn("[SDD] resetEnv: hook errors", errors);
      }
    },
  };
}
`.trimStart();
  }

  return `
export type ResetHook = () => void | Promise<void>;

export type Runtime = {
  onReset(fn: ResetHook): void;
  resetEnv(): Promise<void>;
};

export function createRuntime(): Runtime {
  const hooks: ResetHook[] = [];

  return {
    onReset(fn) {
      hooks.push(fn);
    },
    async resetEnv() {
      const toRun = hooks.splice(0, hooks.length);
      const errors: unknown[] = [];
      for (const fn of toRun) {
        try {
          await fn();
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length) {
        console.warn("[SDD] resetEnv: hook errors", errors);
      }
    },
  };
}
`.trimStart();
}

export function tplWebDiscoverVite(ext) {
  if (ext === "js") {
    return `
function isScenario(x) {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.setup === "function"
  );
}

export async function discoverScenarios() {
  const out = [];
  const modules = import.meta.glob("../**/__sdd__/scenarios/**/*.scenario.{ts,js}", { eager: true });
  for (const mod of Object.values(modules)) {
    const scenario = mod?.default;
    if (isScenario(scenario)) out.push(scenario);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
`.trimStart();
  }

  return `
import type { Runtime } from "./runtime";

export type Scenario = {
  id: string;
  title: string;
  note?: string;
  setup(ctx: { runtime: Runtime; options?: any }): void | Promise<void>;
};

function isScenario(x: any): x is Scenario {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.setup === "function"
  );
}

export async function discoverScenarios(): Promise<Scenario[]> {
  const out: Scenario[] = [];
  const modules = import.meta.glob("../**/__sdd__/scenarios/**/*.scenario.{ts,js}", { eager: true });
  for (const mod of Object.values(modules) as any[]) {
    const scenario = mod?.default;
    if (isScenario(scenario)) out.push(scenario);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
`.trimStart();
}

export function tplWebDiscoverWebpack(ext) {
  if (ext === "js") {
    return `
function isScenario(x) {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.setup === "function"
  );
}

export async function discoverScenarios() {
  const out = [];
  if (typeof require !== "undefined" && typeof require.context === "function") {
    const ctx = require.context("..", true, /__sdd__\\/scenarios\\/.*\\.scenario\\.(ts|js)$/);
    for (const key of ctx.keys()) {
      const mod = ctx(key);
      const scenario = mod?.default;
      if (isScenario(scenario)) out.push(scenario);
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
`.trimStart();
  }

  return `
import type { Runtime } from "./runtime";

export type Scenario = {
  id: string;
  title: string;
  note?: string;
  setup(ctx: { runtime: Runtime; options?: any }): void | Promise<void>;
};

declare const require: any;

function isScenario(x: any): x is Scenario {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.setup === "function"
  );
}

export async function discoverScenarios(): Promise<Scenario[]> {
  const out: Scenario[] = [];
  if (typeof require?.context === "function") {
    const ctx = require.context("..", true, /__sdd__\\/scenarios\\/.*\\.scenario\\.(ts|js)$/);
    for (const key of ctx.keys()) {
      const mod = ctx(key);
      const scenario = mod?.default;
      if (isScenario(scenario)) out.push(scenario);
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
`.trimStart();
}

export function tplWebBoot(ext) {
  if (ext === "js") {
    return `
import { createRuntime } from "./runtime";
import { discoverScenarios } from "./discover";

const runtime = createRuntime();

function ensureBooted() {
  const w = window;
  if (w.SDD?.__inited) return;

  w.SDD = {
    __inited: true,
    list: async () => {
      const scenarios = await discoverScenarios();
      return scenarios.map((s) => ({ id: s.id, title: s.title, note: s.note }));
    },
    run: async (id, options) => {
      const scenarios = await discoverScenarios();
      const scenario = scenarios.find((s) => s.id === id);
      if (!scenario) throw new Error(\`Scenario not found: \${id}\`);
      await runtime.resetEnv();
      await scenario.setup({ runtime, options });
    },
    runtime,
  };
}

ensureBooted();
`.trimStart();
  }

  return `
import { createRuntime } from "./runtime";
import { discoverScenarios } from "./discover";

declare global {
  interface Window {
    SDD?: any;
  }
}

const runtime = createRuntime();

function ensureBooted() {
  const w = window as any;
  if (w.SDD?.__inited) return;

  const api = {
    __inited: true,
    list: async () => {
      const scenarios = await discoverScenarios();
      return scenarios.map((s) => ({ id: s.id, title: s.title, note: s.note }));
    },
    run: async (id: string, options?: any) => {
      const scenarios = await discoverScenarios();
      const scenario = scenarios.find((s) => s.id === id);
      if (!scenario) throw new Error(\`Scenario not found: \${id}\`);

      await runtime.resetEnv();
      await scenario.setup({ runtime, options });
    },
    runtime,
  };

  w.SDD = api;
}

ensureBooted();
`.trimStart();
}

export function tplWebReadmeMd() {
  return `
# SDD-lite (Web)

## 用法（开发环境）

- 查看场景列表：\`window.SDD.list()\`
- 运行场景：\`window.SDD.run("<id>")\`

## 场景目录

- 全局只放基础设施：\`src/__sdd__/\`
- 所有 helpers/mocks/scenarios 必须放在模块内：\`<module>/__sdd__/\`
`.trimStart();
}

export function tplAgentGuideMd() {
  return `
# AGENT_GUIDE (SDD-lite)

必须遵守：

1. 全局极薄：只放扫描/boot/runtime，禁止把业务 helpers/mocks 放到 \`src/__sdd__/\`
2. 模块自治：helpers/mocks/scenarios 都必须在 \`<module>/__sdd__/\`
3. 场景结构固定：

\`\`\`ts
export default {
  id: string,
  title: string,
  note?: string,
  setup({ runtime, options }): void
}
\`\`\`

4. 清理机制优先级最高：任何副作用必须 \`runtime.onReset(fn)\` 登记；切场景会先 \`runtime.resetEnv()\`
5. 不追求断言/自动化：以“人工验证步骤 + 可观察输出”为主
6. 可复现输入：固定数据/固定 seed，避免随机
`.trimStart();
}
```

## File: src/cli.js
```javascript
import { cmdInit } from "./commands/init.js";
import { cmdAddModule } from "./commands/add-module.js";
import { cmdAddScenario } from "./commands/add-scenario.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdManifest } from "./commands/manifest-cmd.js";
import { parseArgs } from "./core/args.js";

const HELP = `
Usage:
  sdd-lite <command> [args] [options]

Commands:
  init                    Init SDD-lite infrastructure
  add-module <modulePath> Create <modulePath>/__sdd__/ skeleton
  add-scenario <modulePath>  Create a scenario under modulePath
  manifest                Regenerate mp-wechat manifest
  doctor                  Check current project status

Options:
  --type <vue2|vue3|mp-wechat>   Project type for init
  --bundler <vite|webpack|auto>  Web bundler (init, default: auto)
  --entry <path>                Entry file for web init (e.g. src/main.ts)
  --update                       Update generated infra files
  --force                        Alias of --update
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
    case "manifest":
      await cmdManifest(ctx, parsed);
      return;
    case "doctor":
      await cmdDoctor(ctx, parsed);
      return;
    default:
      process.stderr.write(`Unknown command: ${parsed.command}\n`);
      process.stdout.write(HELP);
  }
}
```

## File: package.json
```json
{
  "name": "sdd-lite-cli",
  "private": true,
  "type": "module",
  "bin": {
    "sdd-lite": "bin/sdd-lite.js"
  },
  "scripts": {
    "sdd-lite": "node bin/sdd-lite.js",
    "doctor": "node bin/sdd-lite.js doctor",
    "init": "node bin/sdd-lite.js init"
  },
  "engines": {
    "node": ">=18"
  }
}
```
