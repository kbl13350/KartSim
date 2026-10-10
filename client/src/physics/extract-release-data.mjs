#!/usr/bin/env node

// Recreate the editable physics files from the immutable, hash-checked release
// extraction. Run explicitly when refreshing the captured data; normal builds
// read the editable copies and never overwrite them.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.resolve(here, "../../../recovered/embedded-data");
const dataDir = path.resolve(here, "data");
const manifest = JSON.parse(await readFile(path.join(releaseDir, "manifest.json"), "utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");

async function checkedSource(filename, expectedHash) {
  const bytes = await readFile(path.join(releaseDir, filename));
  if (sha256(bytes) !== expectedHash) throw new Error(`${filename} differs from release manifest`);
  return bytes;
}

function assertJsonSafe(map) {
  if (!(map instanceof Map) || map.size !== manifest.overrides.finalKeys) {
    throw new Error("release override Map has unexpected size");
  }
  for (const [key, fields] of map) {
    if (typeof key !== "string" || Object.getPrototypeOf(fields) !== Object.prototype ||
        Reflect.ownKeys(fields).length !== Object.keys(fields).length) {
      throw new Error(`override ${key} has unsupported JSON shape`);
    }
    for (const field of Object.keys(fields)) {
      const descriptor = Object.getOwnPropertyDescriptor(fields, field);
      if (!descriptor || !descriptor.enumerable || !descriptor.writable ||
          !descriptor.configurable || typeof descriptor.value !== "number" ||
          !Number.isFinite(descriptor.value) || Object.is(descriptor.value, -0)) {
        throw new Error(`override ${key}.${field} cannot round-trip through JSON`);
      }
    }
  }
  if (JSON.stringify([...map.keys()]) !== JSON.stringify(Object.keys(Object.fromEntries(map)))) {
    throw new Error("JSON object property order would change Map iteration order");
  }
}

const [captured, supplemental] = await Promise.all([
  checkedSource(manifest.tables.h10.file, manifest.tables.h10.sha256),
  checkedSource(manifest.tables.d10.file, manifest.tables.d10.sha256),
]);
await checkedSource(manifest.overrides.file, manifest.overrides.sha256);
const moduleUrl = pathToFileURL(path.join(releaseDir, manifest.overrides.file));
const { vehiclePhysicsOverrides: map } = await import(moduleUrl.href);
assertJsonSafe(map);

const firstKey = new Map();
const aliases = {};
for (const [key, fields] of map) {
  const target = firstKey.get(fields);
  if (target === undefined) firstKey.set(fields, key);
  else aliases[key] = target;
}

await Promise.all([
  writeFile(path.join(dataDir, "vehicle-physics-h10.csv"), captured),
  writeFile(path.join(dataDir, "vehicle-physics-d10.csv"), supplemental),
  writeFile(path.join(dataDir, "vehicle-physics-overrides.json"),
    `${JSON.stringify(Object.fromEntries(map), null, 2)}\n`),
  writeFile(path.join(dataDir, "vehicle-physics-aliases.json"),
    `${JSON.stringify(aliases, null, 2)}\n`),
]);
console.log(`Recovered two CSV tables, ${map.size} override keys and ${Object.keys(aliases).length} aliases.`);
