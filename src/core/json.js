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

