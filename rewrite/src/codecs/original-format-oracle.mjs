import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const releaseFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js",
);

let original;

/** Test-only oracle: evaluate the immutable release's vendor and formats region. */
export async function originalFormats() {
  if (original) return original;
  globalThis.document ??= {
    createElement: () => ({ relList: { supports: () => true } }),
  };
  const release = await readFile(releaseFile, "utf8");
  const libraryStart = release.indexOf("\nclass Sw {");
  if (libraryStart < 0) throw new Error("发行版资源库边界已改变。");
  original = new Function(
    `${release.slice(0, libraryStart)}\nreturn { PX, MY, KX, lR, gR, bY };`,
  )();
  return original;
}
