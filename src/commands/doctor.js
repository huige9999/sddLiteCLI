import path from "node:path";
import { pathExists, readText, toPosixPath, walkFiles } from "../core/fs.js";
import { readJson } from "../core/json.js";
import { detectMpRoot } from "../core/mp.js";

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
  const mpRoot = await detectMpRoot(root);
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
    out.push(warn("mp.appJson", `Missing ${toPosixPath(path.relative(root, appJson))} (cannot check page registration)`));
    return out;
  }

  try {
    const obj = await readJson(appJson);
    const pages = Array.isArray(obj.pages) ? obj.pages : [];
    const mustHave = "pages/__sdd__/index";
    if (pages.includes(mustHave)) out.push(ok("mp.pages", `app.json registered ${mustHave}`));
    else out.push(warn("mp.pages", `app.json missing ${mustHave}`, `Add ${mustHave} into pages[]`));
  } catch {
    out.push(warn("mp.appJson", `Failed to parse ${toPosixPath(path.relative(root, appJson))} (cannot check page registration)`));
  }

  const scenarioFiles = (await walkFiles(mpRoot)).filter((p) =>
    /\/__sdd__\/scenarios\/.*\.scenario\.(ts|js)$/.test(toPosixPath(p)),
  );
  out.push(ok("mp.scenario.count", `Scenarios found (mp): ${scenarioFiles.length}`));
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
