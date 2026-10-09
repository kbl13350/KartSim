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
//   track_/common/track@zz.bml            gameType="item" rows (through the client's
//                                         trackMetadataCatalog and timeAttackTrackCatalog
//                                         rules, item-only tracks kept)
//   track_/common/trackLocale@cn.bml      blocked / choosable="false" rows
//   track_/<id>/track.1s, track_rvs.1s    ToItemCube and moving itemCube objects
//   track_/common/randomTrack@cn.bml      item hot1-hot5 and new lists (through the
//                                         client's randomTrackGroupsFromBml)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";
import { baseStates, closedLocaleTracks, cubeCount, defaultTrack, itemFolder, itemTrackMetadata,
  probabilityTable, randomPools, restrictionRows, trackRows } from "./item-mode-export/item-mode.mjs";

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
};

const problems = [];
const problem = message => problems.push(message);

const { library, formats, xml, manifest } = await loadResourceLibrary(projectRoot);
const { timeAttackTrackCatalog, randomTrackGroupsFromBml } =
  await import(pathToFileURL(path.join(rewriteDir, "src/resources/track-catalog.ts")).href);
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

const allMetadata = await library.trackMetadataCatalog();
const onlyItem = new Set(allMetadata.filter(track => track.gameType === "item" && track.isOnlyItemTrack === true)
  .map(track => track.id));
const metadata = itemTrackMetadata(allMetadata);
const choices = await timeAttackTrackCatalog({
  mapAssets: () => library.mapAssets(),
  trackMetadataCatalog: async () => metadata,
  findSibling: (file, names) => library.findSibling(file, names),
});
const filesByPath = new Map(library.files.map(file => [file.virtualPath, file]));
const cubes = new Map();
for (const choice of choices) {
  const asset = filesByPath.get(choice.path);
  if (!asset) { problem(`track ${choice.id}: model ${choice.path} not found`); continue; }
  cubes.set(choice.id, cubeCount(formats.y9(await asset.bytes())));
}
const closed = closedLocaleTracks(await parseBmlAt(SOURCES.locale));
const tracks = trackRows(choices, { closed, cubes, onlyItem }, problem);
const exported = new Set(tracks.map(track => track.id));
const groups = randomTrackGroupsFromBml(await parseBmlAt(SOURCES.random),
  choices.filter(choice => exported.has(choice.id)));
const pools = randomPools(groups, tracks, problem);
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
    `${SOURCES.restriction}, base-0 state lifetimes (ms) from item/<folder>/item.bml, item tracks from ` +
    `${SOURCES.tracks} gameType="item" rows with a track model (client catalog rules, isOnlyItemTrack kept) ` +
    `minus ${SOURCES.locale} blocked / choosable="false" rows, keeping models with item cubes; random pools ` +
    `from ${SOURCES.random} (client random groups over those tracks); defaultTrack is the first hot1 track. ` +
    "Do not edit by hand.",
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
