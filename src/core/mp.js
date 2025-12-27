import path from "node:path";
import { pathExists } from "./fs.js";

export async function detectMpRoot(projectRoot) {
  const miniprogramRoot = path.join(projectRoot, "miniprogram");
  if (await pathExists(path.join(miniprogramRoot, "app.json"))) return miniprogramRoot;

  if (await pathExists(path.join(projectRoot, "app.json"))) return projectRoot;

  return null;
}
