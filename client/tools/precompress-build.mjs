#!/usr/bin/env node

// Write a gzip copy beside each compressible build file, so Nginx serves it
// with gzip_static instead of compressing on every request (server-go
// README, Nginx example). Game archives (.rho, .rho5, .pk) are compressed
// already, and the symlinked archive directories are not followed.
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { constants, gzipSync } from "node:zlib";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const compressible = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg", ".wasm"]);
// Nginx's gzip_min_length in the README example; smaller files go as they are.
const minBytes = 1024;

async function* buildFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    // Dirent reports symlinks as such, so linked archive directories are skipped.
    if (entry.isDirectory()) yield* buildFiles(file);
    else if (entry.isFile()) yield file;
  }
}

let count = 0;
let before = 0;
let after = 0;
for await (const file of buildFiles(dist)) {
  if (!compressible.has(path.extname(file))) continue;
  const data = await readFile(file);
  const gzipped = gzipSync(data, { level: constants.Z_BEST_COMPRESSION });
  if (data.length < minBytes || gzipped.length > data.length * 0.9) {
    await rm(`${file}.gz`, { force: true });
    continue;
  }
  await writeFile(`${file}.gz`, gzipped);
  count += 1;
  before += data.length;
  after += gzipped.length;
}
const mib = (bytes) => (bytes / (1 << 20)).toFixed(2);
console.log(`Gzipped ${count} build files for gzip_static: ${mib(before)} MiB -> ${mib(after)} MiB.`);
