#!/usr/bin/env node

// Keep the local production build runnable without copying 3.49 GiB of archives.
import { copyFile, lstat, mkdir, readlink, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mirror = path.resolve(project, "../mirror");
const dist = path.resolve(project, "dist");

async function linkDirectory(name) {
  const destination = path.join(dist, name);
  const relativeTarget = path.relative(dist, path.join(mirror, name));
  try {
    const stat = await lstat(destination);
    if (!stat.isSymbolicLink() || (await readlink(destination)) !== relativeTarget) {
      throw new Error(`Refusing to replace unexpected build path ${destination}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await symlink(relativeTarget, destination, "dir");
  }
}

for (const name of ["p3553", "__p3553", "ui", "classic-hud"]) {
  await linkDirectory(name);
}

await mkdir(path.join(dist, "assets"), { recursive: true });
for (const name of ["sw.js", "manifest.webmanifest"]) {
  await copyFile(path.join(mirror, name), path.join(dist, name));
}
for (const name of ["index-mDCnV9Uo.css", "motor-vorbis-B0OpSz3w.wasm"]) {
  await copyFile(path.join(mirror, "assets", name), path.join(dist, "assets", name));
}
console.log("Linked local game archives and copied small runtime assets into dist/.");
