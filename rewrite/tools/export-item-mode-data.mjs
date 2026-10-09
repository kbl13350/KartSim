#!/usr/bin/env node
// Export the item race data the game node runs (rewrite/ITEM_MODE.md: the
// rank-group probability tables, the per-race caps, the base-0 item state
// lifetimes, the item track list, its random pools and the default track)
// into server-go/internal/game/itemmode/itemmode.json.
//
// Usage, from rewrite/:
//   node --import tsx tools/export-item-mode-data.mjs            write itemmode.json
//   node --import tsx tools/export-item-mode-data.mjs --check    exit 1 if it is stale
//   node --import tsx tools/export-item-mode-data.mjs --out DIR  write elsewhere
//
// Sources (mirror/p3553, read through the browser's resource library):
//   item/slot/itemProb_indi@zz.bml        道具个人赛 weights (top/high/mid/low)
//   item/slot/itemProb_team2@cn.bml       组队道具赛 weights
//   zeta_/cn/content/itemGameRestrictionItemCount.xml   per-race caps
//   item/<folder>/item.bml                base-0 state lifetimes of the table items
//   track_/common/track@zz.bml,           the item track list: exactly the client's
//   track_/common/trackLocale@cn.bml      itemTrackCatalog (src/resources/track-catalog.ts),
//                                         the tracks a 道具赛 room offers in the browser;
//                                         a server track missing there makes the race
//                                         loader fail ("本局赛道不在当前资源目录中。")
//   track_/<id>/track.1s, track_rvs.1s    ToItemCube and moving itemCube objects (every
//                                         catalog track must have some)
//   track_/common/randomTrack@cn.bml      the random pools: the client's
//                                         itemRandomTrackGroups
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";
import { baseStates, cubeCount, defaultTrack, itemFolder, probabilityTable, randomPools,
  restrictionRows, trackRows } from "./item-mode-export/item-mode.mjs";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1] ?? "")
  : path.join(projectRoot, "server-go/internal/game/itemmode");

const SOURCES = {
  indi: "item/slot/itemProb_indi@zz.bml",
  team: "item/slot/itemProb_team2@cn.bml",
  restriction: "zeta_/cn/content/itemGameRestrictionItemCount.xml",
  tracks: "track_/common/track@zz.bml",
  locale: "track_/common/trackLocale@cn.bml",
  random: "track_/common/randomTrack@cn.bml",
  catalog: "rewrite/src/resources/track-catalog.ts",
};

const problems = [];
const problem = message => problems.push(message);

const { library, formats, xml, manifest } = await loadResourceLibrary(projectRoot);
const { itemTrackCatalog, itemRandomTrackGroups } =
  await import(pathToFileURL(path.join(projectRoot, SOURCES.catalog)).href);
const parseBmlAt = async canonical => formats.s2(await uniqueBytes(library, canonical));
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;

/* ---------- tables, caps and lifetimes ---------- */

const tables = {
  indi: probabilityTable(await parseBmlAt(SOURCES.indi), SOURCES.indi, problem),
  team: probabilityTable(await parseBmlAt(SOURCES.team), SOURCES.team, problem),
};
const idxByName = new Map();
for (const table of Object.values(tables))
  for (const item of table.items) {
    if (idxByName.has(item.name) && idxByName.get(item.name) !== item.idx)
      problem(`${item.name} is idx ${idxByName.get(item.name)} and ${item.idx}`);
    idxByName.set(item.name, item.idx);
  }
const restrictions = restrictionRows(await parseXmlAt(SOURCES.restriction), idxByName,
  SOURCES.restriction, problem);

const items = [];
for (const [name, idx] of [...idxByName].sort((a, b) => a[1] - b[1])) {
  const folder = itemFolder(name);
  if (folder === undefined) { items.push({ idx, name, states: {} }); continue; }
  const states = baseStates(await parseBmlAt(`item/${folder}/item.bml`), folder, problem);
  items.push({ idx, name, folder: folder === name ? undefined : folder, states });
}

/* ---------- tracks ---------- */

// The client's own item catalog and random groups, so the server offers
// exactly the tracks the browser lists and can load.
const allMetadata = await library.trackMetadataCatalog();
const onlyItem = new Set(allMetadata.filter(track => track.gameType === "item" && track.isOnlyItemTrack === true)
  .map(track => track.id));
const choices = await itemTrackCatalog(library);
const filesByPath = new Map(library.files.map(file => [file.virtualPath, file]));
const cubes = new Map();
for (const choice of choices) {
  const asset = filesByPath.get(choice.path);
  if (!asset) { problem(`track ${choice.id}: model ${choice.path} not found`); continue; }
  cubes.set(choice.id, cubeCount(formats.y9(await asset.bytes())));
}
const tracks = trackRows(choices, { cubes, onlyItem }, problem);
const pools = randomPools(await itemRandomTrackGroups(library), tracks, problem);
const fallbackTrack = defaultTrack(pools, problem);

/* ---------- write ---------- */

if (problems.length > 0) {
  for (const message of problems.slice(0, 50)) console.error(`problem: ${message}`);
  console.error(`${problems.length} problems`);
  process.exit(1);
}
const document = formatDocument({
  generatedFrom: `rewrite/tools/export-item-mode-data.mjs over mirror/${manifest.version} revision ` +
    `${manifest.revision}: weights from ${SOURCES.indi} (indi) and ${SOURCES.team} (team), caps from ` +
    `${SOURCES.restriction}, base-0 state lifetimes (ms) from item/<folder>/item.bml, item tracks: the ` +
    `client's itemTrackCatalog (${SOURCES.catalog}: ${SOURCES.tracks} gameType="item" rows, isOnlyItemTrack ` +
    `kept, with ${SOURCES.locale} rules; a reverse track needs its track_rvs row), each with item cubes in ` +
    `its model; random pools: the client's itemRandomTrackGroups (${SOURCES.random}); defaultTrack is the ` +
    "first hot1 track. Do not edit by hand.",
  tables, restrictions, items, tracks, randomPools: pools, defaultTrack: fallbackTrack,
});
const file = path.join(outDir, "itemmode.json");
if (checkOnly) {
  if (!existsSync(file) || readFileSync(file, "utf8") !== document.text) {
    console.error("itemmode.json stale; run tools/export-item-mode-data.mjs");
    process.exit(1);
  }
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, document.text);
}
const reverse = tracks.filter(track => track.reverse).length;
console.log(`tables indi ${tables.indi.items.length} / team ${tables.team.items.length} items, ` +
  `caps ${restrictions.caps.length}, item states ${items.length}, tracks ${tracks.length} ` +
  `(${reverse} reverse, ${tracks.filter(track => track.onlyItem).length} item-only), pools ` +
  `${pools.map(pool => `${pool.code}:${pool.tracks.length}`).join(" ")}, default ${fallbackTrack}, ` +
  `version ${document.version}`);
