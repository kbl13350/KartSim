#!/usr/bin/env node
// Export the item race data the game node runs (client/ITEM_MODE.md: the
// rank-group probability tables, the per-race caps, the base-0 item state
// lifetimes, the item track list, its random pools and the default track)
// into server-go/internal/game/itemmode/itemmode.json.
//
// Usage, from client/:
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
// Phase 3 (ITEM_MODE.md appendix C; rules in item-mode-export/item-phase3.mjs):
//   item/slot/itemProb_indiChanger@zz.bml, itemProb_teamChanger2@cn.bml   道具变更卡 tables
//   item/slot/transformByKart, fired2Gain, firing2Gain, animalBooster (.bml + @cn)
//                                         per-kart tables, base file overlaid by @cn rows
//   item/slot/transform@zz.bml            track level / reverse transforms (track@zz level)
//   item/<folder>/item.bml                the 49 special items' variant states
//   etc_/itemTable.kml + etc_/itemTable@cn.xml   equipment passives
//   zeta_/cn/enchant/enchantCatalog.xml   what each passive key covers
//   zeta_/cn/engine/exceedTypeChange.xml, kart_/<folder>/param@cn.xml   迅 item karts
//   stage_/mqGameFinal/title_icons/namemap@zz.bml   result titles
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, normalizeAttributeWhitespace, parseNormalizedXml, uniqueBytes, utf16Bytes }
  from "./economy-export/resource-library.mjs";
import { baseStates, cubeCount, defaultTrack, itemFolder, probabilityTable, randomPools,
  restrictionRows, trackRows } from "./item-mode-export/item-mode.mjs";
import { animalBoosterRows, descriptionKeys, enchantShields, gainRows, itemIndex, mergedItemTable,
  passiveRows, SPECIAL_ITEMS, titleRows, trackLevels, trackTransformRows, transformRows, variantStates,
  xunItemKarts } from "./item-mode-export/item-phase3.mjs";

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
  catalog: "client/src/resources/track-catalog.ts",
  indiChanger: "item/slot/itemProb_indiChanger@zz.bml",
  teamChanger: "item/slot/itemProb_teamChanger2@cn.bml",
  slot: "item/slot/",
  trackTransforms: "item/slot/transform@zz.bml",
  itemTable: "etc_/itemTable.kml",
  itemTableRegion: "etc_/itemTable@cn.xml",
  enchant: "zeta_/cn/enchant/enchantCatalog.xml",
  descriptions: "etc_/itemDescList.xml",
  exceed: "zeta_/cn/engine/exceedTypeChange.xml",
  titles: "stage_/mqGameFinal/title_icons/namemap@zz.bml",
};

const problems = [];
const problem = message => problems.push(message);

const { library, formats, xml, manifest } = await loadResourceLibrary(projectRoot);
const { itemTrackCatalog, itemRandomTrackGroups } =
  await import(pathToFileURL(path.join(projectRoot, SOURCES.catalog)).href);
const parseBmlAt = async canonical => formats.s2(await uniqueBytes(library, canonical));
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;
// Kart params are UTF-16LE (BOM) or UTF-8 XML, some with a line break
// before the declaration; the resource parser wants the declaration right
// after a UTF-16LE BOM.
const parseAnyXmlAt = async canonical => {
  const bytes = new Uint8Array(await uniqueBytes(library, canonical));
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe;
  const text = new TextDecoder(utf16 ? "utf-16le" : "utf-8", { fatal: true }).decode(utf16 ? bytes.subarray(2) : bytes)
    .replace(/^\uFEFF/, "").replace(/^\s*<\?xml[^>]*\?>/, "");
  return xml.parseResourceXml(utf16Bytes(`<?xml version="1.0" encoding="UTF-16"?>${normalizeAttributeWhitespace(text)}`)).root;
};

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

/* ---------- phase 3: special items ---------- */

// The changer tables are the race tables plus zero-weight rows (oil,
// rainbowCloud2): items a 道具变更卡 can change from but never draws.
tables.indiChanger = probabilityTable(await parseBmlAt(SOURCES.indiChanger), SOURCES.indiChanger, problem);
tables.teamChanger = probabilityTable(await parseBmlAt(SOURCES.teamChanger), SOURCES.teamChanger, problem);
const descriptions = descriptionKeys(await parseXmlAt(SOURCES.descriptions));
for (const special of SPECIAL_ITEMS) {
  if (idxByName.has(special.name) || items.some(item => item.idx === special.idx)) {
    problem(`special item ${special.name} (${special.idx}) is a table item`);
    continue;
  }
  if (library.exactCanonicalCandidates(`item/slot/item${special.idx}.png`).length !== 1)
    problem(`special item ${special.name}: no item/slot/item${special.idx}.png`);
  if (!descriptions.has(special.name) && !descriptions.has(`${special.name}_desc`))
    problem(`special item ${special.name}: not in ${SOURCES.descriptions}`);
  if (special.folder === undefined) { items.push({ idx: special.idx, name: special.name, states: {} }); continue; }
  const source = `item/${special.folder}/item.bml`;
  const bases = variantStates(await parseBmlAt(source), source, problem);
  if (bases.length <= special.base) { problem(`${source} has no base ${special.base}`); continue; }
  items.push({ idx: special.idx, name: special.name, folder: special.folder === special.name ? undefined : special.folder,
    base: special.base || undefined, states: bases[special.base] });
}
items.sort((a, b) => a.idx - b.idx);
const index = itemIndex([...idxByName].map(([name, idx]) => ({ name, idx })));
for (const kind of ["indiChanger", "teamChanger"]) {
  const race = tables[kind === "indiChanger" ? "indi" : "team"].items;
  for (const row of tables[kind].items) {
    const weighted = row.top + row.high + row.mid + row.low > 0;
    if (weighted && !race.some(item => item.idx === row.idx && item.name === row.name))
      problem(`${kind}: weighted ${row.name} is not a race table item`);
    if (index.has(row.name) && index.get(row.name) !== row.idx) problem(`${kind}: ${row.name} is idx ${row.idx}`);
  }
}

/* ---------- phase 3: per-kart tables and track transforms ---------- */

const slotPair = async name => [await parseBmlAt(`${SOURCES.slot}${name}.bml`), await parseBmlAt(`${SOURCES.slot}${name}@cn.bml`)];
const transforms = transformRows(...await slotPair("transformByKart"), index, problem);
const fired = gainRows("fired", ...await slotPair("fired2Gain"), index, problem);
const firing = gainRows("firing", ...await slotPair("firing2Gain"), index, problem);
const animalBooster = animalBoosterRows(...await slotPair("animalBooster"), problem);
for (const row of animalBooster)
  if (row.icon > 0 && library.exactCanonicalCandidates(`item/slot/animal${row.icon}.png`).length !== 1)
    problem(`animalBooster kart ${row.kart}: no item/slot/animal${row.icon}.png`);
const known = new Set(items.map(item => item.idx));
for (const row of [...transforms.rows, ...fired.rows, ...firing.rows])
  for (const idx of [row.src, row.dst, row.item, row.gain])
    if (idx !== undefined && !known.has(idx)) problem(`kart ${row.kart}: item ${idx} has no item row`);
const kartTables = { transform: transforms.rows, fired: fired.rows, firing: firing.rows, animalBooster };
const trackTransforms = trackTransformRows(await parseBmlAt(SOURCES.trackTransforms), index, problem);

/* ---------- phase 3: passives, 迅 item karts, titles ---------- */

const itemTable = mergedItemTable(await parseXmlAt(SOURCES.itemTable), await parseXmlAt(SOURCES.itemTableRegion));
const passives = passiveRows(itemTable, problem);
const enchantKeys = enchantShields(await parseXmlAt(SOURCES.enchant), index, problem);
const params = new Map();
for (const [id, kart] of itemTable.get("kart") ?? []) {
  const folder = kart.name?.trim();
  if (!folder || /[/\\]|\.\./.test(folder)) continue;
  for (const file of [`kart_/${folder}/param@cn.xml`, `kart_/${folder}/param.xml`]) {
    if (library.exactCanonicalCandidates(file).length !== 1) continue;
    params.set(id, Object.fromEntries((await parseAnyXmlAt(file)).attributes.map(item => [item.name, item.value])));
    break;
  }
}
const xunKarts = xunItemKarts(params, await parseXmlAt(SOURCES.exceed), problem);
const titles = titleRows(await parseBmlAt(SOURCES.titles), index, problem);

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
// transform@zz keys on the track level: track@zz <track level> or <track_rvs level>.
const levels = trackLevels(await parseBmlAt(SOURCES.tracks));
for (const track of tracks) {
  track.level = levels.get(track.id);
  if (!Number.isSafeInteger(track.level) || track.level < 0) problem(`track ${track.id}: level ${track.level}`);
}
const pools = randomPools(await itemRandomTrackGroups(library), tracks, problem);
const fallbackTrack = defaultTrack(pools, problem);

/* ---------- write ---------- */

if (problems.length > 0) {
  for (const message of problems.slice(0, 50)) console.error(`problem: ${message}`);
  console.error(`${problems.length} problems`);
  process.exit(1);
}
const document = formatDocument({
  generatedFrom: `client/tools/export-item-mode-data.mjs over mirror/${manifest.version} revision ` +
    `${manifest.revision}: weights from ${SOURCES.indi} (indi) and ${SOURCES.team} (team), caps from ` +
    `${SOURCES.restriction}, base-0 state lifetimes (ms) from item/<folder>/item.bml, item tracks: the ` +
    `client's itemTrackCatalog (${SOURCES.catalog}: ${SOURCES.tracks} gameType="item" rows, isOnlyItemTrack ` +
    `kept, with ${SOURCES.locale} rules; a reverse track needs its track_rvs row), each with item cubes in ` +
    `its model; random pools: the client's itemRandomTrackGroups (${SOURCES.random}); defaultTrack is the ` +
    "first hot1 track, each track with its track@zz level. Phase 3: changer tables from " +
    `${SOURCES.indiChanger} and ${SOURCES.teamChanger}; special items (idx, folder, variant base) with that ` +
    "variant's state lifetimes; kartTables: item/slot/transformByKart, fired2Gain, firing2Gain and animalBooster, " +
    "base file overlaid by @cn rows (bossOnly, flag-race and cancelled rows dropped); trackTransforms from " +
    `${SOURCES.trackTransforms}; passives: the item-race chance (first number, -1 = 0) of ${SOURCES.itemTable} ` +
    `overlaid by ${SOURCES.itemTableRegion}; enchantKeys: the EnchanterShield items of ${SOURCES.enchant}; ` +
    `xunKarts: engine-12 item karts whose default exceed type has chargerSystemboosterUseCount 0 (${SOURCES.exceed}); ` +
    `titles from ${SOURCES.titles}. Do not edit by hand.`,
  tables, restrictions, items, tracks, randomPools: pools, defaultTrack: fallbackTrack,
  kartTables, trackTransforms, passives, enchantKeys, xunKarts, titles,
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
console.log(`phase 3: ${SPECIAL_ITEMS.length} special items, kart tables transform ${transforms.rows.length} ` +
  `(${transforms.dropped} dead sources) / fired ${fired.rows.length} / firing ${firing.rows.length} / animal ` +
  `${animalBooster.length}, ${trackTransforms.length} track transforms, passives ` +
  Object.entries(passives).map(([tag, rows]) => `${tag} ${Object.keys(rows).length}`).join(" ") +
  `, ${xunKarts.length} 迅 item karts, ${titles.length} titles`);
console.log(`tables indi ${tables.indi.items.length} / team ${tables.team.items.length} items, ` +
  `caps ${restrictions.caps.length}, item states ${items.length}, tracks ${tracks.length} ` +
  `(${reverse} reverse, ${tracks.filter(track => track.onlyItem).length} item-only), pools ` +
  `${pools.map(pool => `${pool.code}:${pool.tracks.length}`).join(" ")}, default ${fallbackTrack}, ` +
  `version ${document.version}`);
