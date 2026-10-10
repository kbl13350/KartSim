import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseItemBml, type ItemXmlNode } from "./item-bml";
import {
  ITEM_REGISTRY, ItemIdx, SPECIAL_ITEM_IDS, SPECIAL_ITEM_REGISTRY, animalSlotIcon, createItemCatalog,
  decodeItemBml, itemBehaviour, itemModelCandidates, itemSoundCandidates, loadItemCatalog, stringBagTexts,
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
    // The special items (C.4); 119, 126 and 137 have no CN name in itemDescList.xml.
    1: "黑云", 18: "超级盾牌", 20: "可口可乐水炸弹", 21: "可口可乐定时炸弹", 23: "R博士", 24: "警灯",
    25: "弹性陷阱", 27: "毒性水炸弹", 28: "定时毒性水炸弹", 30: "可口可乐导弹", 31: "特殊加速器",
    32: "黄金导弹", 34: "冰冻水炸弹", 35: "定时冰冻水炸弹", 36: "黄金盾牌", 38: "恶魔阿哥",
    44: "南瓜水炸弹", 45: "丫丫炸弹", 46: "废油弹", 47: "铁网水炸弹", 81: "保护盾", 82: "蛋蛋弹",
    83: "黄金蛋蛋弹", 85: "巨型香蕉皮", 99: "老虎导弹", 101: "隐身", 102: "糖果导弹", 103: "黄金磁铁",
    104: "电磁导弹", 106: "防护警灯", 107: "恐龙导弹", 108: "恐龙爪牙导弹", 112: "雪精灵", 115: "黑云",
    117: "像素导弹", 118: "冰冻水苍蝇", 119: "毒性水苍蝇", 120: "定时水炸弹苍蝇", 126: "狐尾导弹",
    129: "发条炸弹", 130: "锯齿地雷", 131: "特快导弹", 132: "蜜蜂", 134: "舞狮车导弹", 135: "龙卷风",
    136: "黑豹导弹", 137: "符咒",
  });
  assert.equal(catalog.get(ItemIdx.talisman)!.description, "阻止第一名使用道具|使其无法移动。");
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
    // The booster and the team booster never appear in hit notices and have no notice icon.
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
  row(ItemIdx.angel, { target: "team", delayMs: 500, effect: "angel", effectMs: 4000 });
  row(ItemIdx.devil, { target: "opponents", delayMs: 500, warningMs: 1000, effect: "reverse",
    effectMs: 3000, shieldBlocks: false, angelBlocks: false });
  // The UFO has a Shield state, but neither shield nor angel stops it (Appendix B, tip.xml:28).
  row(ItemIdx.ufo, { target: "first", maxEtaMs: 1500, effect: "slow", effectMs: 3000,
    factors: { drive: 0.4, drag: 2 }, shieldBlocks: false, angelBlocks: false });
  // EMP covers the team from the end of Use (C.1, C.5).
  row(ItemIdx.emp, { target: "team", delayMs: 500, effect: "emp", effectMs: 1500 });
  row(ItemIdx.thunderbolt, { target: "all-ahead", delayMs: 500, warningMs: 1600, effect: "shrink",
    effectMs: 1500, factors: { scale: 0.6, drive: 0.5 }, shieldBlocks: false, angelBlocks: true });
  row(ItemIdx.barricade, { target: "first", delayMs: 1000, distance: 70, riseMs: 266,
    lifetimeMs: 5000, radius: 4.3, effect: "barrier", effectMs: 500, shieldBlocks: true, angelBlocks: true });
  row(ItemIdx.cloud2, { target: "all-behind", delayMs: 666, effect: "cloud", effectMs: 10000,
    shieldBlocks: false, angelBlocks: false });
  row(ItemIdx.scanning, { target: "team", delayMs: 500, effect: "scan", effectMs: 8000 });
  row(ItemIdx.slotLock, { target: "opponents", delayMs: 2000, effect: "lock", effectMs: 3000,
    shieldBlocks: false, angelBlocks: false });
  row(ItemIdx.timeBomb, { use: "attach", target: "area", delayMs: 3000, radius: 15, lifetimeMs: 1000,
    effect: "trap", effectMs: 2000, escapeShieldMs: 2000, hitsTeammates: true,
    shieldBlocks: false, angelBlocks: true });
  row(ItemIdx.mine, { use: "drop", delayMs: 500, effect: "launch", effectMs: 1500, radius: 2 });
  row(ItemIdx.waterMine, { effect: "trap", effectMs: 2000, radius: 10, triggerRadius: 2, escapeShieldMs: 2000 });
  // Only the time bombs catch teammates.
  assert.deepEqual(catalog.items.filter(item => item.behaviour.hitsTeammates).map(item => item.idx).sort(),
    [13, 21, 28, 35]);
  assert.throws(() => itemBehaviour("unknown", new Map()));
  assert.throws(() => itemBehaviour("banana", new Map()), /item.bml 缺少 \w+ 状态/);
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

test("the special item registry resolves against item.rho and the slot icons", async () => {
  const library = await loadMirrorLibrary(ITEM_CONTAINERS);
  const catalog = await loadItemCatalog(library);
  assert.equal(SPECIAL_ITEM_IDS.length, 49);
  assert.equal(new Set(ITEM_REGISTRY.map(item => item.idx)).size, ITEM_REGISTRY.length);
  // special-item-registry.json (research-13 §10): idx, folder and base, re-checked here.
  const registry = Object.fromEntries(SPECIAL_ITEM_REGISTRY.map(item =>
    [item.idx, `${item.name}:${item.folder}:${item.base}`]));
  assert.deepEqual(registry, {
    1: "darkCloud:cloud:1", 18: "superShield:shield:1", 20: "cokeBomb:cokeBomb:0",
    21: "timeCokeBomb:timeCokeBomb:0", 23: "drrMine:drmad:0", 24: "siren:siren:0",
    25: "forceZone:forceZone:0", 27: "infectedBomb:infectedBomb:0",
    28: "timeInfectedBomb:timeInfectedBomb:0", 30: "cokeRocket:cokeRocket:0",
    31: "animalBooster:booster:0", 32: "goldRocket:goldRocket:0", 34: "snowBomb:snowBomb:0",
    35: "timeSnowBomb:timeSnowBomb:0", 36: "goldShield:goldShield:0", 38: "newDevil:newDevil:0",
    44: "pumpkinBomb:infectedBomb:1", 45: "duckMine:mine:2", 46: "oil:oil:0", 47: "prisonBomb:waterBomb:2",
    81: "protectShield:goldShield:1", 82: "eggMine:mine:3", 83: "goldEggMine:mine:4",
    85: "bigBanana:banana:3", 99: "tigerRocket:tigerRocket:0", 101: "tigerGhost:ghost:1",
    102: "candyRocket:goldRocket:1", 103: "superMagnet:magnet:0", 104: "lockdownRocket:lockdownRocket:0",
    106: "sirenShield:sirenShield:0", 107: "dinoEggRocket:goldRocket:2", 108: "dinoClawRocket:dinoClawRocket:0",
    112: "snowman:snowman:0", 115: "darkCloud2:cloud2:1", 117: "blockRocket:lockdownRocket:1",
    118: "snowWaterFly:snowWaterFly:0", 119: "infectedWaterFly:infectedWaterFly:0",
    120: "waterbombFly:waterbombFly:0", 126: "foxTailRocket:goldRocket:3", 129: "springMine:mine:7",
    130: "cogWheelMine:mine:8", 131: "deliveryRocket:deliveryRocket:0", 132: "honeyBee:honeyBee:0",
    134: "lionMaskRocket:lionMaskRocket:0", 135: "abyssBarricade:abyssBarricade:0",
    136: "pantherRocket:pantherRocket:0", 137: "talisman:talisman:0",
  });
  // Each variant's own models: the base was picked by its model, not base 0.
  const model = (idx: number, state: string, field: "item" | "fired" | "firing") =>
    catalog.get(idx)!.states.get(state)![field];
  assert.equal(model(ItemIdx.candyRocket, "Use", "item"), "missile_pinkcandy");
  assert.equal(model(ItemIdx.dinoEggRocket, "Use", "item"), "missile_dinoEgg");
  assert.equal(model(ItemIdx.foxTailRocket, "Use", "item"), "missile_fox");
  assert.equal(model(ItemIdx.duckMine, "Set", "item"), "duckbomb_제자리");
  assert.equal(model(ItemIdx.eggMine, "Set", "item"), "치킨bomb");
  assert.equal(model(ItemIdx.goldEggMine, "Set", "item"), "치킨bomb2");
  assert.equal(model(ItemIdx.springMine, "Set", "item"), "태엽폭탄");
  assert.equal(model(ItemIdx.cogWheelMine, "Set", "item"), "톱니지뢰");
  assert.equal(model(ItemIdx.bigBanana, "Set", "item"), "왕바나나");
  assert.equal(model(ItemIdx.prisonBomb, "Affect", "fired"), "감옥_즐");
  assert.equal(model(ItemIdx.pumpkinBomb, "PostAffect", "fired"), "호박물폭탄_열쇠");
  assert.equal(model(ItemIdx.blockRocket, "Use", "item"), "네모미사일");
  assert.equal(model(ItemIdx.darkCloud2, "Use", "firing"), "먹물구름_사용");
  assert.equal(model(ItemIdx.darkCloud, "Use", "firing"), "firing00_black");
  assert.equal(model(ItemIdx.superShield, "Use", "firing"), "GoldS");
  assert.equal(model(ItemIdx.protectShield, "Affect", "fired"), "fired02");
  assert.equal(catalog.get(ItemIdx.tigerGhost)!.states.get("Use")!.fired, "effect_tigerEye");
  // The missing sounds use the C.4 stand-ins.
  const sound = (idx: number, stem: string) => catalog.resolveSound(catalog.get(idx)!, stem);
  for (const idx of [ItemIdx.snowWaterFly, ItemIdx.infectedWaterFly, ItemIdx.waterbombFly, ItemIdx.drrMine,
    ItemIdx.newDevil]) assert.equal(sound(idx, "trapped"), "sound_/fx/item/waterBomb/trapped.ogg", String(idx));
  assert.equal(sound(ItemIdx.oil, "eat"), "sound_/fx/item/banana/eat.ogg");
  assert.equal(sound(ItemIdx.oil, "firing"), "sound_/fx/item/banana/firing.ogg");
  assert.equal(sound(ItemIdx.abyssBarricade, "shield"), "sound_/fx/item/shield/shield.ogg");
  assert.equal(sound(ItemIdx.talisman, "shield"), "sound_/fx/item/shield/shield.ogg");
  assert.equal(sound(ItemIdx.talisman, "입력성공"), "sound_/fx/item/talisman/입력성공.ogg");
  // The special booster's per-kart icons exist (250 黄金龙车SR → animal241.png).
  assert.equal(catalog.animalBoosters?.get(250)?.iconId, 241);
  assert.ok(catalog.has(animalSlotIcon(241)));
  for (const row of catalog.animalBoosters!.values())
    if (row.iconId !== undefined && row.prob !== -1) assert.ok(catalog.has(animalSlotIcon(row.iconId)), String(row.iconId));
});

test("special item behaviours follow ITEM_MODE.md C.4 with each base's durations", async () => {
  const catalog = await loadItemCatalog(await loadMirrorLibrary(ITEM_CONTAINERS));
  const row = (idx: number, fields: Record<string, unknown>) => {
    const behaviour = catalog.get(idx)!.behaviour as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(fields))
      assert.deepEqual(behaviour[key], value, `${catalog.get(idx)!.name}.${key}`);
  };
  for (const idx of [32, 102, 107, 126, 30])
    row(idx, { family: "rocket", use: "aim", target: "locked", maxEtaMs: 1500, effect: "launch",
      effectMs: 1500, shieldBlocks: true, angelBlocks: true });
  for (const [idx, overlay] of [[99, "tiger"], [136, "panther"], [131, "delivery"], [108, "dinoClaw"]] as const)
    row(idx, { family: "blindRocket", use: "aim", effect: "slow", effectMs: 4000, overlay,
      factors: { drive: 0.4, drag: 2 }, shieldBlocks: true, angelBlocks: true });
  row(134, { family: "lionRocket", effect: "spin", effectMs: 2000, overlay: "lion", noWarning: true });
  for (const idx of [104, 117])
    row(idx, { family: "lockdownRocket", effect: "hold", effectMs: 2000, shieldBlocks: true, angelBlocks: true,
      field: { delayMs: 500, radius: 15, lifetimeMs: 1000, effect: "slow", effectMs: 3000 } });
  for (const [idx, trap, postLock] of [[34, 3000, undefined], [20, 2500, undefined], [47, 2000, undefined],
    [27, 2000, 5000], [44, 2000, 5000]] as const)
    row(idx, { family: "waterBomb", use: "throw", target: "area", effect: "trap", effectMs: trap,
      postLockMs: postLock, radius: 10, shieldBlocks: false, angelBlocks: true, hitsTeammates: false });
  // The infected bombs have no EscapeAffect (no blue shield) and no AfterBoost (no escape boost).
  row(27, { escapeShieldMs: undefined, afterBoost: false });
  row(34, { escapeShieldMs: 2000, afterBoost: true });
  for (const [idx, trap, postLock] of [[21, 2500, undefined], [35, 3000, undefined], [28, 2000, 5000]] as const)
    row(idx, { family: "timeBomb", use: "attach", delayMs: 3000, radius: 15, effectMs: trap,
      postLockMs: postLock, hitsTeammates: true, shieldBlocks: false, angelBlocks: true });
  row(118, { family: "waterFly", target: "ahead", effectMs: 1500, escapeShieldMs: 2000, shieldBlocks: true });
  row(119, { family: "waterFly", effectMs: 1000, postLockMs: 2000, shieldBlocks: true });
  row(120, { family: "waterbombFly", target: "ahead", maxEtaMs: 2000, effect: "trap", effectMs: 2000,
    escapeShieldMs: 1000, blast: { delayMs: 2000, radius: 15 }, shieldBlocks: true, angelBlocks: true });
  row(132, { family: "honeyBee", target: "ahead", effect: "slow", effectMs: 4000, overlay: "honey",
    shieldBlocks: true, angelBlocks: true });
  for (const idx of [17, 45, 82, 83, 129, 130])
    row(idx, { family: "mine", use: "drop", target: "placed", delayMs: 500, radius: 2, lifetimeMs: 30000,
      effect: "launch", effectMs: 1500, shieldBlocks: true, angelBlocks: true });
  row(37, { family: "waterMine", use: "drop", triggerRadius: 2, radius: 10, effect: "trap", effectMs: 2000 });
  row(85, { family: "banana", radius: 7.5, effect: "spin", effectMs: 2000, shieldBlocks: true });
  row(25, { family: "forceZone", radius: 3, effect: "knockback", effectMs: 500, shieldBlocks: true });
  row(46, { family: "oil", radius: 2, effect: "overlay", overlay: "oil", effectMs: 2000, shieldBlocks: true });
  row(36, { family: "invincible", target: "self", delayMs: 500, effect: "invincible", effectMs: 2500 });
  row(81, { family: "invincible", effectMs: 4000 });
  row(18, { family: "superShield", effect: "shield", effectMs: 3000, shieldMs: 3000, boosterKind: "super" });
  row(24, { family: "siren", effect: "siren", effectMs: 3000, boosterKind: "item", angelBlocks: true,
    shieldBlocks: false, touch: { delayMs: 0, lifetimeMs: 3000, radius: 3, effect: "spin", effectMs: 2000 } });
  row(106, { family: "siren", effectMs: 2200, shieldMs: 2200,
    touch: { delayMs: 200, lifetimeMs: 2000, radius: 3, effect: "spin", effectMs: 2000 } });
  row(103, { family: "magnet", use: "aim", effect: "pull", effectMs: 3000, shieldMs: 3000 });
  row(101, { family: "ghost", effect: "invisible", delayMs: 500, effectMs: 7000 });
  row(31, { family: "booster", effect: "boost", boosterKind: "animal", effectMs: 4000 });
  row(112, { family: "snowman", use: "aim", effect: "shrink", effectMs: 2000, shieldBlocks: false,
    angelBlocks: true });
  row(1, { family: "cloud", target: "all-behind", delayMs: 666, effectMs: 30000, overlay: "darkCloud",
    shieldBlocks: false, angelBlocks: false });
  row(115, { family: "cloud", effectMs: 10000, overlay: "darkCloud", angelBlocks: false });
  row(38, { family: "devil", reverseMode: "forwardBack", effectMs: 5000, warningMs: 1000,
    shieldBlocks: false, angelBlocks: false });
  row(23, { family: "devil", reverseMode: "all", effectMs: 5000, angelBlocks: false });
  row(2, { reverseMode: "steering" });
  row(135, { family: "barricade", target: "first", radius: 4.5, effect: "barrier", effectMs: 2000,
    shieldBlocks: true, angelBlocks: true });
  row(137, { family: "talisman", target: "first", maxEtaMs: 1500, effect: "hold", effectMs: 4000,
    lockMs: 4000, escapeShieldMs: 500, shieldBlocks: true, angelBlocks: true });
  row(ItemIdx.booster, { boosterKind: "item" });
  for (const item of catalog.items) assert.ok(item.behaviour.family, item.name);
});
