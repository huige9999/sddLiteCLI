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
