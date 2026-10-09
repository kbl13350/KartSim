// Unit tests for the item mode exporter's pure rules, and a cross-check of
// the committed server-go/internal/game/itemmode/itemmode.json against the
// decoded original files in recovered/data-full.
// Run from rewrite/: node --test tools/item-mode-export/item-mode.test.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { baseStates, closedLocaleTracks, cubeCount, defaultTrack, itemFolder, itemTrackMetadata,
  probabilityTable, RANDOM_CODES, randomPools, restrictionRows, trackRows } from "./item-mode.mjs";

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

test("trackLocale closes blocked and unchoosable tracks and reverse variants", () => {
  const closed = closedLocaleTracks(node("trackList", {}, [
    node("track", { id: "tomb_I05", name: "墓地", blocked: "true" }),
    node("track", { id: "desert_I09", choosable: "false" }),
    node("track", { id: "tomb_I09", blocked: "false" }),
    node("track_rvs", { refId: "forest_I03", blocked: "true" }),
    node("track_crz", { refId: "desert_I03", blocked: "true" }),
  ]));
  assert.deepEqual([...closed].sort(), ["desert_I09", "forest_I03_rvs", "tomb_I05"]);
});

test("item metadata keeps item-only tracks for the client catalog rules", () => {
  assert.deepEqual(itemTrackMetadata([
    { id: "village_C01", gameType: "item", isOnlyItemTrack: true },
    { id: "village_R01", gameType: "speed" },
    { id: "forest_I01", gameType: "item" },
  ]), [{ id: "village_C01", gameType: "item", isOnlyItemTrack: undefined },
    { id: "forest_I01", gameType: "item", isOnlyItemTrack: undefined }]);
});

test("track rows need cubes in their exact model and an open locale row", () => {
  const { problems, problem } = collect();
  const choice = (id, extra = {}) => ({ id, title: id, gameType: "item", ...extra });
  const rows = trackRows([
    choice("desert_I03"), choice("tomb_I05"), choice("ice_I01"), choice("village_C01"),
    choice("desert_I03_rvs", { reverse: true }), choice("tomb_I05_rvs", { reverse: true }),
    choice("forest_I03_rvs", { reverse: true }), choice("village_R01", { gameType: "speed" }),
    choice("desert_I03"),
  ], {
    closed: new Set(["tomb_I05", "forest_I03_rvs"]),
    cubes: new Map([["desert_I03", 39], ["tomb_I05", 38], ["village_C01", 70], ["desert_I03_rvs", 39],
      ["tomb_I05_rvs", 38], ["forest_I03_rvs", 40], ["village_R01", 4]]),
    onlyItem: new Set(["village_C01"]),
  }, problem);
  assert.deepEqual(rows, [
    { id: "desert_I03", title: "desert_I03", cubes: 39, onlyItem: undefined, reverse: undefined },
    { id: "village_C01", title: "village_C01", cubes: 70, onlyItem: true, reverse: undefined },
    { id: "desert_I03_rvs", title: "desert_I03_rvs", cubes: 39, onlyItem: undefined, reverse: true },
  ]);
  assert.deepEqual(problems, ["track desert_I03 listed twice"]);
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
  assert.equal(problems.length, RANDOM_CODES.length - 2);
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
  for (const row of xmlRows(path.join(common, "trackLocale@cn.bml.xml"), "track_rvs"))
    if (row.blocked === "true") assert.ok(!ids.has(`${row.refId}_rvs`), row.refId);
  for (const id of ["village_C01", "mine_C04", "china_C01", "world_C02", "nemo_C02"])
    assert.equal(data.tracks.find(track => track.id === id)?.onlyItem, true, id);
  assert.ok(data.tracks.every(track => track.cubes > 0));
  const random = readFileSync(path.join(common, "randomTrack@cn.bml.xml"), "utf8");
  const hot1 = random.slice(random.indexOf('<RandomTrackSet gameType="item" randomType="hot1"'));
  const firstHot1 = [...hot1.slice(0, hot1.indexOf("</RandomTrackSet>")).matchAll(/id="([^"]+)"/g)]
    .map(match => match[1]).find(id => ids.has(id));
  assert.equal(data.defaultTrack, firstHot1);
  for (const pool of data.randomPools) for (const id of pool.tracks) assert.ok(ids.has(id), `${pool.code} ${id}`);
});
