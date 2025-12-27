import path from "node:path";
import { pathExists } from "./fs.js";

export async function detectPreferredLangExt(projectRoot, { explicit } = {}) {
  if (explicit === "ts" || explicit === "js") return explicit;
  if (await pathExists(path.join(projectRoot, "tsconfig.json"))) return "ts";
  if (await pathExists(path.join(projectRoot, "src", "main.ts"))) return "ts";
  if (await pathExists(path.join(projectRoot, "miniprogram", "tsconfig.json"))) return "ts";
  return "js";
}

