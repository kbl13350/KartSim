#!/usr/bin/env node
// Export the track facts the game node's anti-cheat checks racers against
// (server-go/ANTICHEAT.md 2) into server-go/internal/game/anticheat/tracks.json.
//
// Usage, from rewrite/:
//   node --import tsx tools/export-track-data.mjs                     write tracks.json
//   node --import tsx tools/export-track-data.mjs --check             exit 1 if it is stale
//   node --import tsx tools/export-track-data.mjs --out DIR           write elsewhere
//   node --import tsx tools/export-track-data.mjs --mirror CHECKOUT   read mirror/ from another
//                                                                     checkout (a worktree without
//                                                                     mirror/p3553)
//
// Sources (mirror/p3553, read through the browser's resource library):
//   track_/common/track@zz.bml + trackLocale   the track list and laps (trackMetadataCatalog)
//   track_/<folder>/track.1s, track_rvs.1s     the route sections (<id>_rvs: the reverse track),
//                                              extracted by the browser's own route builder
//                                              (formats.YW, as a race does)
// Each row: laps; lap, the shortest route from the first section through the
// last one (the route distance a lap adds at the least); drive, the same with
// warp sections counted as 0 m (the distance a kart drives at the least);
// jump, the longest section (the most a warp, a shortcut over a section or
// a rail landing adds to the route distance at once); warp, the length of
// all warp sections (the most route distance warps add in a lap); warps, where each warp
// puts the kart (its next section's first frame, wire coordinates
// [x, -z, y] in meters, as motion frames carry positions).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadResourceLibrary } from "./economy-export/resource-library.mjs";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const option = name => {
  const index = args.indexOf(name);
  return index >= 0 ? path.resolve(args[index + 1] ?? "") : undefined;
};
const outDir = option("--out") ?? path.join(projectRoot, "server-go/internal/game/anticheat");
const mirrorRoot = option("--mirror") ?? projectRoot;

const round = value => Math.round(value * 10) / 10;

/** The shortest route from first through last, sections weighted by length(section). */
export function shortestRoute(sections, first, last, length) {
  const distance = new Array(sections.length).fill(Infinity);
  const done = new Array(sections.length).fill(false);
  distance[first] = length(sections[first]);
  for (;;) {
    let next = -1;
    for (let i = 0; i < sections.length; i++) {
      if (!done[i] && distance[i] < Infinity && (next < 0 || distance[i] < distance[next])) next = i;
    }
    if (next < 0) break;
    done[next] = true;
    for (const edge of sections[next].outgoing) {
      // A lap ends where it began: going on into the first section is the next lap.
      if (edge.section === first) continue;
      const through = distance[next] + length(sections[edge.section]);
      if (through < distance[edge.section]) distance[edge.section] = through;
    }
  }
  return distance[last];
}

/** The anti-cheat row of one track's route. */
export function trackRow(id, laps, road) {
  const { sections, firstSection, lastSection } = road;
  const warp = section => section.surface === "warpnext";
  const lap = shortestRoute(sections, firstSection, lastSection, section => section.length);
  const drive = shortestRoute(sections, firstSection, lastSection,
    section => warp(section) ? 0 : section.length);
  const warps = [];
  for (const section of sections) {
    if (!warp(section)) continue;
    const target = sections[section.outgoing[0]?.section];
    const frame = target?.frames?.[0];
    if (!frame) throw new Error(`${id}: a warp section without a next section`);
    const { x, y, z } = frame.position;
    warps.push([round(x), round(-z), round(y)]);
  }
  const row = { id, laps };
  if (Number.isFinite(lap)) Object.assign(row, { lap: Math.floor(lap), drive: Math.floor(drive) });
  row.jump = Math.ceil(Math.max(...sections.map(section => section.length)));
  const warpTotal = sections.filter(warp).reduce((sum, section) => sum + section.length, 0);
  if (warpTotal > 0) row.warp = Math.ceil(warpTotal);
  if (warps.length > 0) row.warps = warps;
  return row;
}

async function main() {
  const { library, formats } = await loadResourceLibrary(projectRoot, "p3553", mirrorRoot);
  // The browser's model lookup (src/resources/track-catalog.ts
  // resolveTrackCatalog): the one track.1s of the metadata's folder, and its
  // track_rvs.1s sibling for the reverse track "<id>_rvs" (same laps).
  const folder = file => file.virtualPath.split("/").filter(Boolean).at(-2).toLowerCase();
  const models = new Map(library.mapAssets().map(file => [folder(file), file]));
  const problems = [];
  const tracks = [];
  const add = async (id, laps, file, reverse) => {
    try {
      const road = formats.YW(formats.y9(await file.bytes()), "speed-individual", { forceReverse: reverse });
      tracks.push(trackRow(id, laps, road));
    } catch (error) {
      problems.push(`${id}: ${error.message}`);
    }
  };
  for (const track of await library.trackMetadataCatalog()) {
    const model = models.get((track.folder ?? track.id).toLowerCase());
    // Listed tracks without a model in p3553 cannot be raced.
    if (!model || !Number.isSafeInteger(track.laps) || track.laps < 1) continue;
    await add(track.id, track.laps, model, false);
    const reverse = library.findSibling(model.virtualPath, ["track_rvs.1s"]);
    if (reverse) await add(`${track.id}_rvs`, track.laps, reverse, true);
  }
  if (problems.length > 0) throw new Error(`track data problems:\n${problems.join("\n")}`);
  tracks.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const document = {
    generatedFrom: "mirror/p3553 track metadata (laps) and track.1s routes (formats.YW), by " +
      "rewrite/tools/export-track-data.mjs",
    tracks,
  };
  const text = `{\n  "generatedFrom": ${JSON.stringify(document.generatedFrom)},\n  "tracks": [\n` +
    tracks.map(row => `    ${JSON.stringify(row)}`).join(",\n") + "\n  ]\n}\n";
  const target = path.join(outDir, "tracks.json");
  if (checkOnly) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current !== text) {
      console.error(`${target} is stale; run node --import tsx tools/export-track-data.mjs`);
      process.exit(1);
    }
    console.log(`${target} is up to date (${tracks.length} tracks)`);
    return;
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(target, text);
  console.log(`wrote ${target} (${tracks.length} tracks)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
