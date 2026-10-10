// Unit tests for the item mode exporter's pure rules, a cross-check of the
// committed server-go/internal/game/itemmode/itemmode.json against the
// decoded original files in recovered/data-full, and a check that its track
// list, random pools and default track are exactly the browser's item track
// catalog (the server must never pick a track the client cannot load).
// Run from rewrite/:
//   node --import tsx --test tools/item-mode-export/item-mode.test.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { baseStates, cubeCount, defaultTrack, itemFolder, probabilityTable, RANDOM_CODES,
  randomPools, restrictionRows, trackRows } from "./item-mode.mjs";

const node = (name, attributes = {}, children = []) => ({
  name, text: "", children,
  attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value: String(value) })),
});
const collect = () => {
  const problems = [];
  return { problems, problem: message => problems.push(message) };
};

test("probability tables keep the file order and every rank column", () => {
  const { problems, problem } = collect();
  const table = probabilityTable(node("items", {}, [
    node("item", { name: "banana", idx: 8, toprank: 25, highrank: 0, midrank: 0, lowrank: 0 }),
    node("item", { name: "booster", idx: 6, toprank: 0, highrank: 3, midrank: 24, lowrank: 51 }),
    node("comment"),
  ]), "itemProb_indi@zz", problem);
  assert.deepEqual(problems, []);
  assert.deepEqual(table, { source: "itemProb_indi@zz", items: [
    { idx: 8, name: "banana", top: 25, high: 0, mid: 0, low: 0 },
    { idx: 6, name: "booster", top: 0, high: 3, mid: 24, low: 51 },
  ] });
});

test("probability tables report bad rows, repeats and empty columns", () => {
  const { problems, problem } = collect();
  const table = probabilityTable(node("items", {}, [
    node("item", { name: "banana", idx: 8, toprank: 25, highrank: "x", midrank: 0, lowrank: 0 }),
    node("item", { name: "again", idx: 8, toprank: 1, highrank: 1, midrank: 1, lowrank: 1 }),
    node("item", { name: "noIdx", toprank: 1 }),
  ]), "t", problem);
  assert.equal(table.items.length, 1);
  assert.equal(table.items[0].high, 0);
  assert.ok(problems.some(message => message.includes("highrank x")));
  assert.ok(problems.some(message => message.includes("idx 8 listed twice")));
  assert.ok(problems.some(message => message.includes("without name or idx")));
  assert.ok(problems.some(message => message.includes("no weight in highrank")));
  probabilityTable(node("other"), "u", problem);
  assert.ok(problems.some(message => message.includes("root is other")));
});

test("restrictions resolve names to table idx values", () => {
  const { problems, problem } = collect();
  const idx = new Map([["slotLock", 110], ["angel", 11], ["booster", 6]]);
  const rows = restrictionRows(node("itemGameRestrictionItemcount", {}, [
    node("targetItemList", {}, [node("item", { name: "slotLock", allowCount: 2 }),
      node("item", { name: "angel", allowCount: 2 }), node("item", { name: "ghost", allowCount: 2 })]),
    node("disableItemList", {}, [node("item", { name: "booster" })]),
  ]), idx, "restriction", problem);
  assert.deepEqual(rows, {
    caps: [{ idx: 110, name: "slotLock", allowCount: 2 }, { idx: 11, name: "angel", allowCount: 2 }],
    unlimited: [{ idx: 6, name: "booster" }],
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ghost/);
});

test("base-0 states stop at the first repeated state name", () => {
  const { problems, problem } = collect();
  const states = baseStates(node("item", { name: "shield" }, [
    node("state", { name: "Use", life: 2000, firing: "firing00" }),
    node("state", { name: "Shield", life: 1000 }),
    node("state", { name: "Disappear", life: 500 }),
    node("state", { name: "Use", life: 3000 }),
    node("state", { name: "Extra", life: 1 }),
  ]), "shield", problem);
  assert.deepEqual(problems, []);
  assert.deepEqual(states, { Use: 2000, Shield: 1000, Disappear: 500 });
  baseStates(node("item", { name: "rocket" }, [node("state", { name: "Use", life: "1.5" })]), "ufo", problem);
  assert.equal(problems.length, 3); // name, life and no states
});

test("item folders reuse the missile for guide and random rockets", () => {
  assert.equal(itemFolder("guideRocket"), "rocket");
  assert.equal(itemFolder("randomRocket"), "rocket");
  assert.equal(itemFolder("booster"), undefined);
  assert.equal(itemFolder("waterFly"), "waterFly");
});

test("cubes count static and moving item cubes only", () => {
  const property = type => node("property", {}, [node("object\0pad", { "type\0": `${type}\0junk` })]);
  const model = { root: { kind: "track", trackObjects: [
    { kind: "ToItemCube" }, { kind: "ToItemCube" }, { kind: "ToLucci" },
    { kind: "ToMovableObject", property: property("itemCube") },
    { kind: "ToMovableObject", property: property("banana") },
    { kind: "ToMovableObject" },
  ] } };
  assert.equal(cubeCount(model), 3);
  assert.equal(cubeCount({ root: { kind: "scene" } }), 0);
});

test("track rows keep the client catalog order and need cubes in the exact model", () => {
  const { problems, problem } = collect();
  const choice = (id, extra = {}) => ({ id, title: id, gameType: "item", ...extra });
  const rows = trackRows([
    choice("desert_I03"), choice("ice_I01"), choice("village_C01"),
    choice("desert_I03_rvs", { reverse: true }), choice("tomb_I05_rvs", { reverse: true }),
    choice("village_R01", { gameType: "speed" }), choice("desert_I03"),
  ], {
    cubes: new Map([["desert_I03", 39], ["village_C01", 70], ["desert_I03_rvs", 39],
      ["tomb_I05_rvs", 38], ["village_R01", 4]]),
    onlyItem: new Set(["village_C01"]),
  }, problem);
  assert.deepEqual(rows, [
    { id: "desert_I03", title: "desert_I03", cubes: 39, onlyItem: undefined, reverse: undefined },
    { id: "village_C01", title: "village_C01", cubes: 70, onlyItem: true, reverse: undefined },
    { id: "desert_I03_rvs", title: "desert_I03_rvs", cubes: 39, onlyItem: undefined, reverse: true },
    { id: "tomb_I05_rvs", title: "tomb_I05_rvs", cubes: 38, onlyItem: undefined, reverse: true },
  ]);
  // The server offers exactly the client's tracks: any track it would drop is an error.
  assert.deepEqual(problems, ["track ice_I01 has no item cube", "track village_R01 is not an item track",
    "track desert_I03 listed twice"]);
});

test("random pools map the codes to item groups and the default is the first hot1 track", () => {
  const { problems, problem } = collect();
  const rows = ["a", "b", "c"].map(id => ({ id }));
  const groups = [
    { id: "item:hot1:1", trackIds: ["x", "b", "a"] },
    { id: "speed:hot1:1", trackIds: ["c"] },
    { id: "item:all:0", trackIds: ["a", "b", "c"] },
  ];
  const pools = randomPools(groups, rows, problem);
  assert.deepEqual(pools.map(pool => pool.code), RANDOM_CODES.map(entry => entry.code));
  assert.deepEqual(pools.find(pool => pool.code === 3).tracks, ["b", "a"]);
  assert.deepEqual(pools.find(pool => pool.code === 0).tracks, ["a", "b", "c"]);
  // x is not an exported track; the six other codes have no group.
  assert.equal(problems.length, 1 + RANDOM_CODES.length - 2);
  assert.match(problems[0], /code 3 .* x is not an exported track/);
  assert.equal(defaultTrack(pools, problem), "b");
  assert.equal(defaultTrack([], problem), undefined);
});

// The committed export against the decoded original files.

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const exported = path.join(projectRoot, "server-go/internal/game/itemmode/itemmode.json");
const dataFull = path.join(projectRoot, "recovered/data-full");
const xmlRows = (file, tag) => [...readFileSync(file, "utf8").matchAll(new RegExp(`<${tag}\\s([^>]*?)/?>`, "g"))]
  .map(match => Object.fromEntries([...match[1].matchAll(/([\w]+)=['"]([^'"]*)['"]/g)]
    .map(([, key, value]) => [key, value])));
const haveOriginals = existsSync(exported) && existsSync(path.join(dataFull, "item.rho"));

test("itemmode.json matches the original tables, caps and lifetimes", { skip: !haveOriginals }, () => {
  const data = JSON.parse(readFileSync(exported, "utf8"));
  for (const [kind, file] of [["indi", "itemProb_indi@zz.bml.xml"], ["team", "itemProb_team2@cn.bml.xml"]]) {
    const rows = xmlRows(path.join(dataFull, "item.rho/slot", file), "item").map(row => ({
      idx: Number(row.idx), name: row.name, top: Number(row.toprank), high: Number(row.highrank),
      mid: Number(row.midrank), low: Number(row.lowrank) }));
    assert.deepEqual(data.tables[kind].items, rows, kind);
  }
  assert.equal(data.tables.indi.items.length, 14);
  assert.equal(data.tables.team.items.length, 19);
  const restriction = xmlRows(path.join(dataFull, "DataPack4/zeta_/cn/content/itemGameRestrictionItemCount.xml"), "item");
  assert.deepEqual(data.restrictions.caps.map(cap => [cap.name, cap.allowCount]),
    restriction.filter(row => row.allowCount).map(row => [row.name, Number(row.allowCount)]));
  assert.deepEqual(data.restrictions.unlimited.map(entry => entry.name),
    restriction.filter(row => !row.allowCount).map(row => row.name));
  for (const item of data.items) {
    // The special items' variants are checked by item-phase3.test.mjs.
    if (!data.tables.indi.items.concat(data.tables.team.items).some(row => row.idx === item.idx)) continue;
    const folder = item.folder ?? item.name;
    const file = path.join(dataFull, "item.rho", folder, "item.bml.xml");
    if (item.name === "booster") { assert.ok(!existsSync(file)); continue; }
    const states = {};
    for (const row of xmlRows(file, "state")) {
      if (Object.hasOwn(states, row.name)) break;
      states[row.name] = Number(row.life);
    }
    assert.deepEqual(item.states, states, item.name);
  }
});

test("itemmode.json tracks honour trackLocale@cn and the hot1 default", { skip: !haveOriginals }, () => {
  const data = JSON.parse(readFileSync(exported, "utf8"));
  const ids = new Set(data.tracks.map(track => track.id));
  const common = path.join(dataFull, "track_common.rho");
  const types = new Map(xmlRows(path.join(common, "track@zz.bml.xml"), "track").map(row => [row.id, row.gameType]));
  for (const id of ids) assert.equal(types.get(id.replace(/_rvs$/, "")), "item", id);
  for (const row of xmlRows(path.join(common, "trackLocale@cn.bml.xml"), "track"))
    if (row.blocked === "true" || row.choosable === "false") assert.ok(!ids.has(row.id), row.id);
  // A reverse track needs an open trackLocale@cn track_rvs row.
  const reverseRows = new Map(xmlRows(path.join(common, "trackLocale@cn.bml.xml"), "track_rvs")
    .map(row => [`${row.refId}_rvs`, row]));
  for (const track of data.tracks.filter(entry => entry.reverse)) {
    const row = reverseRows.get(track.id);
    assert.ok(row && row.blocked !== "true" && row.choosable !== "false", track.id);
  }
  for (const id of ["village_C01", "mine_C04", "china_C01", "world_C02", "nemo_C02"])
    assert.equal(data.tracks.find(track => track.id === id)?.onlyItem, true, id);
  assert.equal(data.tracks.filter(track => !track.reverse).length, 158);
  assert.equal(data.tracks.filter(track => track.reverse).length, 29);
  assert.ok(data.tracks.every(track => track.cubes > 0));
  const random = readFileSync(path.join(common, "randomTrack@cn.bml.xml"), "utf8");
  const hot1 = random.slice(random.indexOf('<RandomTrackSet gameType="item" randomType="hot1"'));
  const firstHot1 = [...hot1.slice(0, hot1.indexOf("</RandomTrackSet>")).matchAll(/id="([^"]+)"/g)]
    .map(match => match[1]).find(id => ids.has(id));
  assert.equal(data.defaultTrack, firstHot1);
  for (const pool of data.randomPools) for (const id of pool.tracks) assert.ok(ids.has(id), `${pool.code} ${id}`);
});

// The committed export against the browser's item track catalog: the server
// draws and accepts tracks from itemmode.json, the race loader resolves them
// in itemTrackCatalog and throws "本局赛道不在当前资源目录中。" for any other.

const haveMirror = existsSync(exported) &&
  existsSync(path.join(projectRoot, "mirror/__p3553/archive-index")) &&
  existsSync(path.join(projectRoot, "mirror/__p3553/resources"));

test("itemmode.json tracks, random pools and default are the client's item catalog",
  { skip: !haveMirror }, async () => {
    const data = JSON.parse(readFileSync(exported, "utf8"));
    const { loadResourceLibrary } = await import("../economy-export/resource-library.mjs");
    const { itemRandomTrackGroups, itemTrackCatalog } = await import(
      pathToFileURL(path.join(projectRoot, "rewrite/src/resources/track-catalog.ts")).href);
    const { library } = await loadResourceLibrary(projectRoot);
    const catalog = await itemTrackCatalog(library);
    assert.deepEqual(data.tracks.map(track => [track.id, track.title, track.reverse === true]),
      catalog.map(choice => [choice.id, choice.title, choice.reverse === true]),
      "server item tracks differ from the client's itemTrackCatalog; run tools/export-item-mode-data.mjs");
    const groups = await itemRandomTrackGroups(library);
    for (const { code, group } of RANDOM_CODES) {
      assert.deepEqual(data.randomPools.find(pool => pool.code === code)?.tracks,
        groups.find(candidate => candidate.id === group)?.trackIds, `random code ${code} (${group})`);
    }
    const hot1 = groups.find(candidate => candidate.id === "item:hot1:1");
    assert.equal(data.defaultTrack, hot1?.trackIds[0]);
    assert.ok(catalog.some(choice => choice.id === data.defaultTrack));
  });
