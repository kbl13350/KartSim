#!/usr/bin/env node
/** Run from client/: node --import tsx tools/export-deathmatch-tracks.mjs [--check]. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadResourceLibrary } from "./economy-export/resource-library.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const destination = new URL("../../server-go/internal/game/lobby/deathmatch-tracks.json", import.meta.url);
const trackIDs = ["ice_D01", "factory_D01", "god_D01", "northeu_D01", "wkc_D01"];
const { library, formats } = await loadResourceLibrary(root);
const world = ([x, y, z]) => ({ x, y: z, z: -y });
const normalize = value => {
  const length = Math.hypot(...value);
  if (!Number.isFinite(length) || length <= 0) throw new Error("Invalid deathmatch spawn direction");
  return value.map(axis => axis / length);
};
const tracks = [];
for (const id of trackIDs) {
  const canonicalPath = `track_/${id}/track.1s`;
  const candidates = library.canonicalCandidates(canonicalPath);
  if (candidates.length !== 1) throw new Error(`${id}: expected one original track model`);
  const file = candidates[0];
  const bytes = await file.bytes();
  const model = formats.y9(bytes);
  if (model.root.kind !== "track") throw new Error(`${id}: not a track model`);
  const spawns = model.root.trackObjects.filter(item => item.kind === "ToDummy" && /^sp0[0-7]$/.test(item.name))
    .map(item => ({ slot: Number(item.name.slice(2)), position: world(item.transform.position),
      forward: world(normalize(item.transform.basis[1])) })).sort((a, b) => a.slot - b.slot);
  if (spawns.length !== 8 || spawns.some((spawn, index) => spawn.slot !== index))
    throw new Error(`${id}: expected all eight original sp00–sp07 poses`);
  const roads = formats.qG(model.root.scene);
  if (roads.issues.length) throw new Error(`${id}: unsupported collision geometry`);
  const resetTriangles = roads.triangles.filter(triangle => triangle.roadDescriptor.road.attributes
    .some(attribute => attribute.name === "surface" && attribute.value === "리셋"))
    .map(({ a, b, c }) => ({ a, b, c }));
  if (!resetTriangles.length) throw new Error(`${id}: original reset surfaces are missing`);
  // Original reset surfaces decide losses. This reconstructed safety plane
  // catches falling outside the entire model, including its lowest platforms.
  const lowestCollisionY = Math.min(...roads.triangles.flatMap(({ a, b, c }) => [a.y, b.y, c.y]));
  if (!Number.isFinite(lowestCollisionY)) throw new Error(`${id}: collision geometry is empty`);
  tracks.push({ id, modelArchive: file.sourceName, modelPath: canonicalPath,
    modelSha256: createHash("sha256").update(bytes).digest("hex"),
    fallY: lowestCollisionY - 10, spawns, resetTriangles });
}
const output = JSON.stringify({ schemaVersion: 1, sourceVersion: "p3553",
  coordinates: "web Y-up: native (x,y,z) becomes (x,z,-y)",
  fallYPolicy: "Minimum original collision Y minus 10 metres; original resetTriangles remain authoritative",
  tracks }, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (await readFile(destination, "utf8") !== output) throw new Error("deathmatch-tracks.json is stale");
} else await writeFile(destination, output);
console.log(`${process.argv.includes("--check") ? "Verified" : "Exported"} ${tracks.length} original deathmatch arenas`);
