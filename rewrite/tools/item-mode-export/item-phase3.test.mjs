// Unit tests for the phase-3 rows of the item mode export (item-phase3.mjs),
// and a cross-check of the committed itemmode.json against the decoded
// original files in recovered/data-full (and, when mirror/p3553 is present,
// against etc_/itemTable.kml read through the resource library).
// Run from rewrite/:
//   node --import tsx --test tools/item-mode-export/item-phase3.test.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { animalBoosterRows, enchantShields, gainRows, itemIndex, itemRaceChance, mergedItemTable, overlayRows,
  passiveRows, SPECIAL_ITEMS, tableProbability, titleRows, trackLevels, trackTransformRows, transformRows,
  variantStates, xunItemKarts } from "./item-phase3.mjs";

const node = (name, attributes = {}, children = []) => ({
  name, text: "", children,
  attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value: String(value) })),
});
const collect = () => {
  const problems = [];
  return { problems, problem: message => problems.push(message) };
};
const index = itemIndex([{ name: "rocket", idx: 7 }, { name: "banana", idx: 8 }, { name: "booster", idx: 6 },
  { name: "magnet", idx: 5 }, { name: "ufo", idx: 3 }, { name: "shield", idx: 10 }, { name: "devil", idx: 2 },
  { name: "timeBomb", idx: 13 }, { name: "waterBomb", idx: 9 }]);

test("variant states split an item.bml at each repeated state name", () => {
  const { problems, problem } = collect();
  const bases = variantStates(node("item", { name: "rocket" }, [
    node("repaint"),
    node("state", { name: "Aim", life: 0 }), node("state", { name: "Use", life: 1500 }),
    node("state", { name: "Aim", life: 0 }), node("state", { name: "Use", life: 1600 }),
    node("state", { name: "Shield", life: 1000 }),
  ]), "item/goldRocket/item.bml", problem);
  assert.deepEqual(problems, []);
  assert.deepEqual(bases, [{ Aim: 0, Use: 1500 }, { Aim: 0, Use: 1600, Shield: 1000 }]);
  variantStates(node("item", {}, [node("state", { name: "Use", life: "x" })]), "bad", problem);
  assert.equal(problems.length, 1);
});

test("the special items are 49 distinct idx values, names and variants", () => {
  assert.equal(SPECIAL_ITEMS.length, 49);
  assert.equal(new Set(SPECIAL_ITEMS.map(item => item.idx)).size, 49);
  assert.equal(new Set(SPECIAL_ITEMS.map(item => item.name)).size, 49);
  assert.equal(index.get("cokeRocketWorldCup"), 30); // the world-cup coke rocket has no idx of its own
  assert.equal(index.get("animalBooster"), 31);
});

test("region rows override base rows with the same key, new ones append", () => {
  const rows = overlayRows([{ k: 1, v: "a" }, { k: 2, v: "b" }], [{ k: 2, v: "c" }, { k: 3, v: "d" }], row => row.k);
  assert.deepEqual(rows, [{ k: 1, v: "a" }, { k: 2, v: "c" }, { k: 3, v: "d" }]);
  assert.equal(tableProbability("50,80"), 50);
  assert.equal(itemRaceChance("-1,80"), 0);
  assert.equal(itemRaceChance("0,100"), 0);
  assert.equal(itemRaceChance("20,80"), 20);
  assert.equal(itemRaceChance("x"), undefined);
});

test("transformByKart keeps item-race rows: no bossOnly, no cancelled rows, no dead sources", () => {
  const { problems, problem } = collect();
  const row = attributes => node("item", attributes);
  const { rows, dropped } = transformRows(node("transformByKart", {}, [
    row({ kartId: 10, srcIdx: "rocket", gitType: "no_flag", dstIdx: "cokeRocket", probability: 20 }),
    row({ kartId: 10, srcIdx: "rocket", gitType: "bossOnly", dstIdx: "rocket", probability: 100 }),
    row({ kartId: 11, srcIdx: "banana", dstIdx: "mine", probability: 100 }),
    row({ kartId: 12, srcIdx: "rollingBomb", gitType: "no_flag", dstIdx: "rollingCokeBomb", probability: 100 }),
    row({ kartId: 13, srcIdx: "magnet", gitType: "no_flag", dstIdx: "superMagnet", probability: 100 }),
  ]), node("transformByKart", {}, [
    row({ kartId: 10, srcIdx: "rocket", gitType: "no_flag", dstIdx: "goldRocket", probability: 100 }),
    row({ kartId: 11, srcIdx: "banana", gitType: "no_flag", dstIdx: "mine", probability: 0 }), // cancels the base row
  ]), index, problem);
  assert.deepEqual(problems, []);
  assert.equal(dropped, 1);
  assert.deepEqual(rows, [{ kart: 10, src: 7, dst: 32, p: 100 }, { kart: 13, src: 5, dst: 103, p: 100 }]);
  transformRows(node("t", {}, [row({ kartId: 1, srcIdx: "rocket", dstIdx: "nothing", probability: 5 })]), undefined,
    index, problem);
  assert.match(problems[0], /unknown nothing/);
});

test("gain tables: fired by item, firing without flag-race rows", () => {
  const { problems, problem } = collect();
  const row = attributes => node("item", attributes);
  const fired = gainRows("fired", node("fired2Gain", {}, [
    row({ kartId: 31, firedItemIdx: "ufo", gainItemIdx: "shield", probability: 100 }),
    row({ kartId: 31, firedItemIdx: "areaUfo", gainItemIdx: "shield", probability: 100 }),
    row({ kartId: 441, firedItemIdx: "banana", gainItemIdx: "booster", probability: "50,80" }),
  ]), node("fired2Gain", {}, [row({ kartId: 113, firedItemIdx: "banana", gainItemIdx: "booster", probability: 0 })]),
  index, problem);
  assert.deepEqual(fired, { rows: [{ kart: 31, item: 3, gain: 10, p: 100 }, { kart: 441, item: 8, gain: 6, p: 50 }],
    dropped: 1 });
  const firing = gainRows("firing", node("firing2Gain", {}, [
    row({ kartId: 108, firingItemIdx: "magnet", firingStep: 1, gainItemIdx: "booster", probability: 33 }),
    row({ kartId: 108, firingItemIdx: "magnet", firingStep: 1, gainItemIdx: "booster", gameType: "FlagIndi", probability: 0 }),
    row({ kartId: 109, firingItemIdx: "rocket", firingStep: 1, gainItemIdx: "booster", gameType: "FlagTeam", probability: 50 }),
  ]), undefined, index, problem);
  assert.deepEqual(firing.rows, [{ kart: 108, item: 5, gain: 6, p: 33 }]);
  assert.deepEqual(problems, []);
});

test("animal boosters: missing prob is 100, -1 cancels, missing icon is 0", () => {
  const { problems, problem } = collect();
  const rows = animalBoosterRows(node("animalBoosterList", {}, [
    node("animalBooster", { kartId: 80, iconId: 80, prob: 50 }),
    node("animalBooster", { kartId: 97, iconId: 97 }),
    node("animalBooster", { kartId: 112, iconId: 266 }),
  ]), node("animalBoosterList", {}, [node("animalBooster", { kartId: 112, iconId: 266, prob: -1 }),
    node("animalBooster", { kartId: 268, prob: 100 })]), problem);
  assert.deepEqual(problems, []);
  assert.deepEqual(rows, [{ kart: 80, icon: 80, p: 50 }, { kart: 97, icon: 97, p: 100 }, { kart: 268, icon: 0, p: 100 }]);
});

test("track transforms and levels", () => {
  const { problems, problem } = collect();
  const rows = trackTransformRows(node("transforms", {}, [
    node("item", { name: "timeBomb", srcIdx: 13, level: 0, destIdx: 9, probability: 100 }),
    node("item", { name: "devil", srcIdx: 2, isReverse: "true", level: 2, destIdx: 9, probability: 100 }),
  ]), index, problem);
  assert.deepEqual(problems, []);
  assert.deepEqual(rows, [{ src: 13, dst: 9, level: 0, reverse: undefined, p: 100 },
    { src: 2, dst: 9, level: 2, reverse: true, p: 100 }]);
  const levels = trackLevels(node("trackList", {}, [node("track", { id: "a", level: 2 }), node("track", { id: "b" }),
    node("track_rvs", { refId: "a", level: 3 })]));
  assert.deepEqual([...levels], [["a", 2], ["b", 0], ["a_rvs", 3]]);
});

test("passives: the region overlay per (tag, id), first numbers, only the chances that count", () => {
  const { problems, problem } = collect();
  const merged = mergedItemTable(node("itemtable", {}, [
    node("kart", { id: 75, name: "kart75" }), node("headBand", { id: 3, probability: 50 }),
    node("goggle", { id: 1, trans: "0.7" }),
  ]), node("itemtable", {}, [
    node("kart", { id: 75, devil: 100 }), node("kart", { id: 432, waterfly: "-1,80" }),
    node("pet", { id: 3, rocket: 20 }), node("pet", { id: 110, devil: "0,100" }), node("headBand", { id: 3, probability: 70 }),
    node("character", { id: 10, lucciUfo: 100 }), node("balloon", { id: 9, prob: "x" }),
  ]));
  assert.deepEqual(merged.get("kart").get(75), { id: "75", name: "kart75", devil: "100" });
  const rows = passiveRows(merged, problem);
  assert.deepEqual(rows, { kart: { 75: { devil: 100 } }, pet: { 3: { rocket: 20 } }, character: { 10: { lucciUfo: 100 } },
    balloon: {}, headBand: { 3: { probability: 70 } } });
  assert.deepEqual(problems, ["balloon 9 prob=x"]);
});

test("enchant shields leave out the vs-AI rows", () => {
  const { problems, problem } = collect();
  const rows = enchantShields(node("CompatibilityList", {}, [node("TuneGroup", { id: 1 }, [
    node("Tune", { id: 6, key: "waterfly" }, [node("EnchanterShield", { itemId: "waterFly", prob: 80, gameType: "aiGame" })]),
    node("Tune", { id: 7, key: "rocket" }, [node("EnchanterShield", { itemId: "rocket", prob: 20 }),
      node("EnchanterShield", { itemId: "goldRocket", prob: 20 })]),
  ])]), itemIndex([{ name: "rocket", idx: 7 }]), problem);
  assert.deepEqual(rows, [{ group: 1, tune: 7, key: "rocket", items: [7, 32], names: ["rocket", "goldRocket"] }]);
  assert.deepEqual(problems, []);
});

test("迅 item karts: engine 12 item karts whose default exceed type has no charger boosters", () => {
  const { problems, problem } = collect();
  const exceed = node("exceedType", {}, [node("exceedTypeList", {}, [
    node("exceedType", { id: 1, chargerSystemboosterUseCount: 0 }), node("exceedType", { id: 4, chargerSystemboosterUseCount: 6 }),
    node("exceedType", { id: 5, chargerSystemboosterUseCount: 0 }),
  ])]);
  const karts = xunItemKarts(new Map([
    [1513, { EngineSound: "12", ItemSlotCapacity: "3", defaultExceedType: "1" }],
    [1522, { EngineSound: "12_rudolf", ItemSlotCapacity: "3", defaultExceedType: "1" }],
    [1605, { EngineSound: "12", ItemSlotCapacity: "3", defaultExceedType: "4" }], // hybrid
    [1700, { EngineSound: "12", defaultExceedType: "5" }],                         // a speed kart
    [900, { EngineSound: "V1", ItemSlotCapacity: "3", defaultExceedType: "1" }],
  ]), exceed, problem);
  assert.deepEqual(karts, [1513, 1522]);
  assert.deepEqual(problems, []);
});

test("titles map the namemap to keys and item families", () => {
  const { problems, problem } = collect();
  const names = itemIndex([{ name: "rocket", idx: 7 }, { name: "guideRocket", idx: 33 }, { name: "angel", idx: 11 }]);
  const rows = titleRows(node("TitleIcons", {}, [
    node("Title", { name: "백발백중", fail: 0 }), node("Title", { name: "터렛모드", item: "rocket", use: 10 }),
    node("Title", { name: "철벽방어", item: "angel", use: 5 }), node("Title", { name: "완벽출발", custom: 1 }),
  ]), names, problem);
  assert.deepEqual(rows.map(row => row.key), ["perfectAim", "turret", "ironWall", "perfectStart"]);
  assert.ok(rows[1].items.includes(7) && rows[1].items.includes(33) && rows[1].items.includes(32));
  assert.equal(rows[0].fail, 0);
  assert.match(problems[0], /4 titles/);
});

// The committed export against the decoded original files.

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const exported = path.join(projectRoot, "server-go/internal/game/itemmode/itemmode.json");
const dataFull = path.join(projectRoot, "recovered/data-full");
const xmlRows = (file, tag) => [...readFileSync(file, "utf8").matchAll(new RegExp(`<${tag}\\s([^>]*?)/?>`, "g"))]
  .map(match => Object.fromEntries([...match[1].matchAll(/([\w]+)=['"]([^'"]*)['"]/g)]
    .map(([, key, value]) => [key, value])));
const haveOriginals = existsSync(exported) && existsSync(path.join(dataFull, "item.rho/slot"));
const slot = name => path.join(dataFull, "item.rho/slot", name);

test("itemmode.json special items have their variant's original states and icons",
  { skip: !haveOriginals }, () => {
    const data = JSON.parse(readFileSync(exported, "utf8"));
    for (const special of SPECIAL_ITEMS) {
      const item = data.items.find(entry => entry.idx === special.idx);
      assert.ok(item, `${special.name} exported`);
      assert.equal(item.name, special.name);
      if (!special.folder) { assert.deepEqual(item.states, {}); continue; }
      const bases = [];
      for (const row of xmlRows(path.join(dataFull, "item.rho", special.folder, "item.bml.xml"), "state")) {
        if (bases.length === 0 || Object.hasOwn(bases[bases.length - 1], row.name)) bases.push({});
        bases[bases.length - 1][row.name] = Number(row.life);
      }
      assert.deepEqual(item.states, bases[special.base], `${special.name} = ${special.folder}:${special.base}`);
    }
  });

test("itemmode.json kart tables are the base files overlaid by @cn", { skip: !haveOriginals }, () => {
  const data = JSON.parse(readFileSync(exported, "utf8"));
  const names = new Map(data.items.map(item => [item.name, item.idx]));
  names.set("cokeRocketWorldCup", 30);
  const first = value => Number(String(value).split(",")[0]);
  const merged = (file, key) => {
    const rows = new Map();
    for (const name of [`${file}.bml.xml`, `${file}@cn.bml.xml`])
      for (const row of xmlRows(slot(name), file === "animalBooster" ? "animalBooster" : "item")) rows.set(key(row), row);
    return [...rows.values()];
  };
  const transform = merged("transformByKart", row => `${row.kartId}|${row.srcIdx}|${row.gitType ?? "no_flag"}`)
    .filter(row => (row.gitType ?? "no_flag") === "no_flag" && first(row.probability) > 0 && names.has(row.srcIdx))
    .map(row => ({ kart: Number(row.kartId), src: names.get(row.srcIdx), dst: names.get(row.dstIdx),
      p: first(row.probability) }));
  const sort = rows => [...rows].sort((a, b) => a.kart - b.kart || (a.src ?? a.item) - (b.src ?? b.item));
  assert.deepEqual(data.kartTables.transform, sort(transform));
  const fired = merged("fired2Gain", row => `${row.kartId}|${row.firedItemIdx}`)
    .filter(row => first(row.probability) > 0 && names.has(row.firedItemIdx))
    .map(row => ({ kart: Number(row.kartId), item: names.get(row.firedItemIdx), gain: names.get(row.gainItemIdx),
      p: first(row.probability) }));
  assert.deepEqual(data.kartTables.fired, sort(fired));
  const firing = merged("firing2Gain", row => `${row.kartId}|${row.firingItemIdx}|${row.gameType ?? ""}`)
    .filter(row => row.gameType === undefined && first(row.probability) > 0 && names.has(row.firingItemIdx))
    .map(row => ({ kart: Number(row.kartId), item: names.get(row.firingItemIdx), gain: names.get(row.gainItemIdx),
      p: first(row.probability) }));
  assert.deepEqual(data.kartTables.firing, sort(firing));
  const animal = merged("animalBooster", row => row.kartId)
    .map(row => ({ kart: Number(row.kartId), icon: Number(row.iconId ?? 0), p: row.prob === undefined ? 100 : Number(row.prob) }))
    .filter(row => row.p > 0).sort((a, b) => a.kart - b.kart);
  assert.deepEqual(data.kartTables.animalBooster, animal);
  // Research 13 §0.1: kart 799 keeps its base magnet row, kart 584's transforms are cancelled.
  assert.ok(data.kartTables.transform.some(row => row.kart === 799 && row.src === 5 && row.dst === 103));
  assert.ok(!data.kartTables.transform.some(row => row.kart === 584));
  assert.deepEqual(data.trackTransforms, xmlRows(slot("transform@zz.bml.xml"), "item").map(row => {
    const out = { dst: Number(row.destIdx), level: Number(row.level), p: Number(row.probability), src: Number(row.srcIdx) };
    if (row.isReverse === "true") out.reverse = true;
    return out;
  }));
});

test("itemmode.json changer tables, track levels and titles are the original ones", { skip: !haveOriginals }, () => {
  const data = JSON.parse(readFileSync(exported, "utf8"));
  for (const [kind, file] of [["indiChanger", "itemProb_indiChanger@zz.bml.xml"], ["teamChanger", "itemProb_teamChanger2@cn.bml.xml"]])
    assert.deepEqual(data.tables[kind].items, xmlRows(slot(file), "item").map(row => ({
      high: Number(row.highrank), idx: Number(row.idx), low: Number(row.lowrank), mid: Number(row.midrank),
      name: row.name, top: Number(row.toprank) })), kind);
  const common = path.join(dataFull, "track_common.rho/track@zz.bml.xml");
  const levels = new Map(xmlRows(common, "track").map(row => [row.id, Number(row.level ?? 0)]));
  for (const row of xmlRows(common, "track_rvs")) levels.set(`${row.refId}_rvs`, Number(row.level ?? 0));
  for (const track of data.tracks) assert.equal(track.level, levels.get(track.id), track.id);
  const namemap = xmlRows(path.join(dataFull, "stage_mqGameFinal.rho/title_icons/namemap@zz.bml.xml"), "Title");
  assert.deepEqual(data.titles.map(title => title.name), namemap.map(row => row.name));
  assert.deepEqual(data.titles.filter(title => title.use).map(title => [title.item, title.use]),
    namemap.filter(row => row.use).map(row => [row.item, Number(row.use)]));
});

test("itemmode.json passives follow itemTable@cn (kart, pet and character passives live there only)",
  { skip: !haveOriginals }, () => {
    const data = JSON.parse(readFileSync(exported, "utf8"));
    const cn = path.join(dataFull, "DataPack1/etc_/itemTable@cn.xml");
    const chance = value => { const first = Number(String(value).split(",")[0]); return first === -1 ? 0 : first; };
    for (const [tag, attributes] of [["kart", ["devil", "banana", "mine", "rocket", "waterfly", "waterAngel", "useTwoRocket",
      "onlyWaterBomb", "lucciItemCube"]], ["pet", ["rocket", "waterfly", "waterBomb", "devil", "snowBomb"]],
    ["character", ["lucciUfo", "lucciMine"]]]) {
      const expected = {};
      for (const row of xmlRows(cn, tag)) for (const name of attributes) if (row[name] !== undefined && chance(row[name]) > 0)
        (expected[row.id] ??= {})[name] = chance(row[name]);
      const got = {};
      for (const [id, values] of Object.entries(data.passives[tag]))
        for (const name of attributes) if (values[name] !== undefined) (got[id] ??= {})[name] = values[name];
      assert.deepEqual(got, expected, tag);
    }
    // The 46 迅 item karts of the CN capture (research 13 §13).
    assert.deepEqual(data.xunKarts, [1513, 1522, 1524, 1526, 1536, 1543, 1548, 1551, 1554, 1555, 1557, 1561, 1563,
      1565, 1567, 1569, 1571, 1573, 1575, 1579, 1581, 1585, 1588, 1590, 1591, 1592, 1593, 1594, 1597, 1600, 1601, 1607,
      1610, 1612, 1613, 1615, 1620, 1622, 1625, 1627, 1630, 1631, 1633, 1635, 1637, 1638]);
  });

const haveMirror = existsSync(exported) && existsSync(path.join(projectRoot, "mirror/__p3553/archive-index"));

test("itemmode.json headband and balloon chances overlay the base itemTable.kml", { skip: !haveMirror }, async () => {
  const data = JSON.parse(readFileSync(exported, "utf8"));
  const { loadResourceLibrary, parseNormalizedXml, uniqueBytes } = await import("../economy-export/resource-library.mjs");
  const { library, xml } = await loadResourceLibrary(projectRoot);
  const read = async file => parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, file)).root;
  const merged = mergedItemTable(await read("etc_/itemTable.kml"), await read("etc_/itemTable@cn.xml"));
  for (const [tag, attribute] of [["headBand", "probability"], ["balloon", "prob"]]) {
    const expected = {};
    for (const [id, values] of merged.get(tag))
      if (itemRaceChance(values[attribute]) > 0) expected[id] = { [attribute]: itemRaceChance(values[attribute]) };
    assert.deepEqual(data.passives[tag], expected, tag);
  }
  // CN re-assigns base ids: 284 道具换位卡头饰 is an ordinary 50 % UFO headband (research 5 §1.1).
  assert.equal(data.passives.headBand["284"].probability, 50);
});
