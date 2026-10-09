import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseItemBml, type ItemXmlNode } from "./item-bml";
import {
  ITEM_REGISTRY, ItemIdx, createItemCatalog, decodeItemBml, itemBehaviour,
  itemModelCandidates, itemSoundCandidates, loadItemCatalog, stringBagTexts,
} from "./item-catalog";
import { ITEM_CONTAINERS, loadMirrorLibrary } from "./item-test-fixtures";

const exported = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/data-full/item.rho");

function node(name: string, attributes: Record<string, string> = {}, children: ItemXmlNode[] = []): ItemXmlNode {
  return { name, attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children };
}

/** The data-full export's `<state …/>` rows, read with a plain pattern. */
function exportedStates(file: string): Array<Record<string, string>> {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/<state\s+([^>]*?)\/>/g)].map(match =>
    Object.fromEntries([...match[1]!.matchAll(/(\w+)="([^"]*)"/g)].map(pair => [pair[1]!, pair[2]!])));
}

function exportedDefinitions(directory = exported, prefix = ""): string[] {
  return readdirSync(directory).flatMap(entry => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return exportedDefinitions(full, `${prefix}${entry}/`);
    return entry === "item.bml.xml" ? [prefix.slice(0, -1)] : [];
  });
}

test("item.bml variants split on the first repeated state name", () => {
  const states = (names: string[]) => names.map(name => node("state", { name, life: "10" }));
  const parsed = parseItemBml(node("item", { name: "lucci" }, [
    ...states(["Stay", "Eaten", "Wait"]), ...states(["Stay", "Eaten", "Wait", "Cached", "Drop"]),
  ]));
  assert.deepEqual(parsed.bases.map(base => base.order.map(state => state.name)),
    [["Stay", "Eaten", "Wait"], ["Stay", "Eaten", "Wait", "Cached", "Drop"]]);
  for (const bad of [
    node("state", { name: "Use" }),
    node("state", { name: "Use", life: "1.5" }),
    node("state", { name: "Use", life: "10", size: "abc" }),
    node("state", { name: "Use", life: "10", item: "../x" }),
    node("state", { life: "10" }),
  ]) assert.throws(() => parseItemBml(node("item", { name: "x" }, [bad])));
  assert.throws(() => parseItemBml(node("item", { name: "x" }, [node("other")])));
  assert.throws(() => parseItemBml(node("items", { name: "x" })));
});

test("every original item.bml parses and keeps all exported attributes", async () => {
  const library = await loadMirrorLibrary(ITEM_CONTAINERS);
  const folders = exportedDefinitions();
  assert.equal(folders.length, 103);
  for (const folder of folders) {
    const [entry] = library.exactCanonicalCandidates(`item/${folder}/item.bml`);
    assert.ok(entry, folder);
    const parsed = decodeItemBml(await entry.bytes());
    const rows = parsed.bases.flatMap(base => base.order);
    const expected = exportedStates(path.join(exported, folder, "item.bml.xml"));
    assert.deepEqual(rows.map(state => state.attributes), expected, folder);
    for (const [index, state] of rows.entries()) {
      assert.equal(state.lifeMs, Number(expected[index]!.life), `${folder} ${state.name}`);
      if (expected[index]!.size) assert.equal(state.size, Number(expected[index]!.size));
    }
    // Every variant of a file repeats the first variant's state names.
    const first = parsed.bases[0]!.order.map(state => state.name);
    for (const base of parsed.bases.slice(0, -1))
      assert.deepEqual(base.order.map(state => state.name), first, folder);
  }
  const waterBomb = decodeItemBml(await library.exactCanonicalCandidates("item/waterBomb/item.bml")[0]!.bytes());
  assert.equal(waterBomb.bases.length, 4);
  assert.equal(waterBomb.repaint.length, 10);
  const rocket = decodeItemBml(await library.exactCanonicalCandidates("item/rocket/item.bml")[0]!.bytes());
  assert.deepEqual(rocket.bases[0]!.states.get("Aim")!.auxFx, ["aiming", "inrange", "ontarget", "misfire"]);
  const cube = decodeItemBml(await library.exactCanonicalCandidates("item/itemCube/item.bml")[0]!.bytes());
  assert.equal(cube.bases.length, 3);
});

test("the catalog maps idx, names, folders, CN texts and icons from the original data", async () => {
  const library = await loadMirrorLibrary(ITEM_CONTAINERS);
  const catalog = await loadItemCatalog(library);
  assert.equal(catalog.items.length, ITEM_REGISTRY.length);
  const titles = Object.fromEntries(catalog.items.map(item => [item.idx, item.title]));
  assert.deepEqual(titles, {
    2: "大魔王", 3: "飞碟", 4: "水苍蝇", 5: "磁铁", 6: "加速器", 7: "导弹", 8: "香蕉皮",
    9: "水炸弹", 10: "盾牌", 11: "天使", 12: "电磁波", 13: "定时水炸弹", 14: "组队加速器",
    17: "地雷", 33: "追踪导弹", 37: "水地雷", 109: "透视镜", 110: "道具锁", 111: "闪电",
    113: "路障", 114: "乌云", 127: "随机导弹",
  });
  assert.equal(catalog.get(ItemIdx.waterBomb)!.description, "向前方丢出水炸弹|将对手困进水里");
  assert.equal(catalog.get(ItemIdx.randomRocket)!.description, "可随机向一名比自己领先的车手发射导弹。");
  assert.equal(catalog.byName("guideRocket")!.folder, "rocket");
  assert.equal(catalog.byName("guideRocket")!.states.get("Use")!.lifeMs, 1500);
  assert.equal(catalog.get(ItemIdx.cloud2)!.bml!.bases.length, 3);
  assert.equal(catalog.get(ItemIdx.booster)!.states.size, 0);
  assert.equal(catalog.get(-1), undefined);
  assert.equal(catalog.cube.states.get("Stay")!.size, 2);
  assert.deepEqual(
    [catalog.cube.states.get("Eaten")!.lifeMs, catalog.cube.states.get("Eaten")!.fired,
      catalog.cube.states.get("Eaten")!.firedFx], [2000, "fired01", "eaten"]);

  for (const item of catalog.items) {
    assert.ok(catalog.has(catalog.slotIcon(item.idx)), `slot ${item.idx}`);
    assert.ok(catalog.has(catalog.smallIcon(item.idx)), `small ${item.idx}`);
    // Boosters never appear in hit notices and have no notice icon.
    assert.equal(catalog.has(catalog.noticeIcon(item.idx)),
      item.idx !== ItemIdx.booster && item.idx !== ItemIdx.teamBooster, `notice ${item.idx}`);
    // Every model and sound the base-0 states name resolves to an original file.
    for (const state of item.states.values()) {
      for (const stem of [state.item, state.firing, state.fired])
        if (stem) assert.ok(catalog.resolveModel(item, stem), `${item.name} ${state.name} ${stem}`);
      for (const stem of [state.itemFx, state.firingFx, state.firedFx, ...(state.auxFx ?? [])])
        if (stem) assert.ok(catalog.resolveSound(item, stem), `${item.name} ${state.name} ${stem}`);
    }
  }
  const banana = catalog.get(ItemIdx.banana)!;
  assert.deepEqual(catalog.modelCandidates(banana, "당함"), ["item/banana/당함.1s", "item/common/당함.1s"]);
  assert.equal(catalog.resolveModel(banana, "item01"), "item/banana/item01.1s");
  assert.equal(catalog.resolveModel(banana, "당함"), "item/common/당함.1s");
  assert.equal(catalog.resolveModel(catalog.cube, "fired01"), "item/itemCube/fired01.1s");
  assert.equal(catalog.resolveSound(catalog.get(ItemIdx.devil)!, "trapped"), "sound_/fx/item/waterBomb/trapped.ogg");
  assert.equal(catalog.resolveSound(catalog.get(ItemIdx.waterFly)!, "trapped"), "sound_/fx/item/waterBomb/trapped.ogg");
  assert.equal(catalog.resolveSound(catalog.get(ItemIdx.barricade)!, "shield"), "sound_/fx/item/shield/shield.ogg");
  assert.equal(catalog.resolveSound(catalog.get(ItemIdx.booster)!, "booster"), "sound_/fx/item/booster/booster.ogg");
  assert.equal(catalog.resolveSound(catalog.cube, "eaten"), "sound_/fx/item/itemCube/eaten.ogg");
  assert.equal(catalog.resolveSound(banana, "missing"), undefined);
});

test("item behaviours reproduce ITEM_MODE.md Appendix B from the parsed durations", async () => {
  const catalog = await loadItemCatalog(await loadMirrorLibrary(ITEM_CONTAINERS));
  const b = (idx: number) => catalog.get(idx)!.behaviour;
  const row = (idx: number, fields: Record<string, unknown>) => {
    const behaviour = b(idx) as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(fields))
      assert.deepEqual(behaviour[key], value, `${catalog.get(idx)!.name}.${key}`);
  };
  row(ItemIdx.booster, { target: "self", effect: "boost", effectMs: 3000 });
  row(ItemIdx.banana, { use: "drop", delayMs: 500, lifetimeMs: 30000, radius: 2, effect: "spin",
    effectMs: 2000, distance: 4, shieldBlocks: true, angelBlocks: true });
  row(ItemIdx.waterBomb, { use: "throw", target: "area", delayMs: 1000, radius: 10, lifetimeMs: 1000,
    effect: "trap", effectMs: 2000, escapeShieldMs: 2000, shieldBlocks: false, angelBlocks: true });
  row(ItemIdx.waterFly, { target: "ahead", maxEtaMs: 2000, speed: 60, effect: "trap", effectMs: 1000,
    escapeShieldMs: 2000, shieldBlocks: true, angelBlocks: true });
  for (const [idx, target, use] of [[ItemIdx.rocket, "locked", "aim"], [ItemIdx.guideRocket, "first", "instant"],
    [ItemIdx.randomRocket, "random-ahead", "instant"]] as const)
    row(idx, { use, target, maxEtaMs: 1500, speed: 100, effect: "launch", effectMs: 1500,
      shieldBlocks: true, angelBlocks: true });
  row(ItemIdx.magnet, { use: "aim", target: "locked", effect: "pull", effectMs: 3000 });
  row(ItemIdx.shield, { target: "self", effect: "shield", effectMs: 2000 });
  row(ItemIdx.angel, { target: "team", effect: "angel", effectMs: 4000 });
  row(ItemIdx.devil, { target: "opponents", delayMs: 500, warningMs: 1000, effect: "reverse",
    effectMs: 3000, shieldBlocks: false, angelBlocks: false });
  row(ItemIdx.ufo, { target: "first", maxEtaMs: 1500, effect: "slow", effectMs: 3000,
    factors: { drive: 0.4, drag: 2 }, shieldBlocks: true, angelBlocks: true });
  row(ItemIdx.emp, { target: "self", effect: "emp", effectMs: 1500 });
  row(ItemIdx.thunderbolt, { target: "all-ahead", delayMs: 500, warningMs: 1600, effect: "shrink",
    effectMs: 1500, factors: { scale: 0.6, drive: 0.5 }, shieldBlocks: false, angelBlocks: true });
  row(ItemIdx.barricade, { target: "first", delayMs: 1000, distance: 70, riseMs: 266,
    lifetimeMs: 5000, radius: 4.3, effect: "barrier", effectMs: 500, shieldBlocks: true, angelBlocks: true });
  row(ItemIdx.cloud2, { target: "all-behind", delayMs: 666, effect: "cloud", effectMs: 10000,
    shieldBlocks: false, angelBlocks: false });
  row(ItemIdx.scanning, { target: "team", effect: "scan", effectMs: 8000 });
  row(ItemIdx.slotLock, { target: "opponents", delayMs: 2000, effect: "lock", effectMs: 3000,
    shieldBlocks: false, angelBlocks: false });
  row(ItemIdx.timeBomb, { use: "attach", target: "area", delayMs: 3000, radius: 15, lifetimeMs: 1000,
    effect: "trap", effectMs: 2000, escapeShieldMs: 2000, hitsTeammates: true,
    shieldBlocks: false, angelBlocks: true });
  row(ItemIdx.mine, { effect: "launch", effectMs: 1500, radius: 2 });
  row(ItemIdx.waterMine, { effect: "trap", effectMs: 2000, radius: 10, escapeShieldMs: 2000 });
  assert.equal(catalog.items.filter(item => item.behaviour.hitsTeammates).length, 1);
  assert.throws(() => itemBehaviour("unknown", new Map()));
  assert.throws(() => itemBehaviour("banana", new Map()), /缺少 Use/);
});

test("paths, string bags and catalog construction follow the original layout", () => {
  assert.deepEqual(itemModelCandidates({ folder: "common" }, "fired03"), ["item/common/fired03.1s"]);
  assert.deepEqual(itemSoundCandidates({ folder: "rocket" }, "shooting"),
    ["sound_/fx/item/rocket/shooting.ogg", "sound_/fx/item/rocket/shooting.flac"]);
  assert.deepEqual(itemSoundCandidates({ folder: "devil" }, "trapped").slice(2),
    ["sound_/fx/item/waterBomb/trapped.ogg", "sound_/fx/item/waterBomb/trapped.flac"]);
  const texts = stringBagTexts(node("StringBag", {}, [
    node("k", { n: "banana" }, [node("m", { c: "kr", v: "바나나" }), node("m", { c: "cn", v: "香蕉皮" })]),
    node("k", { n: "empty" }, [node("m", { c: "cn", v: "" })]),
  ]));
  assert.deepEqual([...texts], [["banana", "香蕉皮"]]);
  assert.throws(() => stringBagTexts(node("Other")));
  assert.throws(() => createItemCatalog(new Map(), new Map(), () => true), /itemCube/);
});
