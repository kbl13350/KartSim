// Phase-3 rows of server-go/internal/game/itemmode/itemmode.json
// (client/ITEM_MODE.md appendix C): the special items the per-kart tables
// lead to, the merged per-kart item tables, the global track transforms,
// the item changer tables, the equipment passives, the 迅 item karts that
// start holding an item, and the result titles. Pure functions over parsed
// resource nodes, so the rules can be tested without the resource library.
//
// Sources (all read through the browser's resource library by
// tools/export-item-mode-data.mjs):
//   item/slot/transformByKart.bml + @cn, fired2Gain.bml + @cn,
//   firing2Gain.bml + @cn, animalBooster.bml + @cn   per-kart tables
//   item/slot/transform@zz.bml                        track level / reverse transforms
//   item/slot/itemProb_indiChanger@zz.bml,
//   item/slot/itemProb_teamChanger2@cn.bml            the 道具变更卡 redraw tables
//   item/<folder>/item.bml                            states of each special item's variant
//   etc_/itemTable.kml + etc_/itemTable@cn.xml        equipment passives
//   zeta_/cn/enchant/enchantCatalog.xml               what each passive key covers
//   zeta_/cn/engine/exceedTypeChange.xml,
//   kart_/<folder>/param@cn.xml (param.xml)           迅 item karts (start item)
//   stage_/mqGameFinal/title_icons/namemap@zz.bml     result titles

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;

function integer(raw) {
  const text = (raw ?? "").trim();
  const value = Number(text);
  return text !== "" && Number.isSafeInteger(value) ? value : undefined;
}

/**
 * The 49 special items (non-classic destinations of the CN per-kart tables):
 * idx, item name, item.rho folder and variant base. Anchors: the probability
 * tables (itemProb_flag, itemProb_aprilFool, the *Changer tables), enchant.xml
 * (fired='2;23;38', transform='6;31'); the rest follow etc_/itemDescList.xml
 * key order checked against the slot icons (phase-3 research 13 §10). The
 * exporter re-checks every row against the original files: the folder's
 * item.bml has the variant, item/slot/item<idx>.png exists, and itemDescList
 * names the item.
 */
export const SPECIAL_ITEMS = [
  { idx: 1, name: "darkCloud", folder: "cloud", base: 1 },
  { idx: 17, name: "mine", folder: "mine", base: 0 },
  { idx: 18, name: "superShield", folder: "shield", base: 1 },
  { idx: 20, name: "cokeBomb", folder: "cokeBomb", base: 0 },
  { idx: 21, name: "timeCokeBomb", folder: "timeCokeBomb", base: 0 },
  { idx: 23, name: "drrMine", folder: "drmad", base: 0 },
  { idx: 24, name: "siren", folder: "siren", base: 0 },
  { idx: 25, name: "forceZone", folder: "forceZone", base: 0 },
  { idx: 27, name: "infectedBomb", folder: "infectedBomb", base: 0 },
  { idx: 28, name: "timeInfectedBomb", folder: "timeInfectedBomb", base: 0 },
  { idx: 30, name: "cokeRocket", folder: "cokeRocket", base: 0 },
  // The special booster has no item.bml: its time is the kart's AnimalBoosterTime.
  { idx: 31, name: "animalBooster", folder: undefined, base: 0 },
  { idx: 32, name: "goldRocket", folder: "goldRocket", base: 0 },
  { idx: 34, name: "snowBomb", folder: "snowBomb", base: 0 },
  { idx: 35, name: "timeSnowBomb", folder: "timeSnowBomb", base: 0 },
  { idx: 36, name: "goldShield", folder: "goldShield", base: 0 },
  { idx: 37, name: "waterMine", folder: "waterMine", base: 0 },
  { idx: 38, name: "newDevil", folder: "newDevil", base: 0 },
  { idx: 44, name: "pumpkinBomb", folder: "infectedBomb", base: 1 },
  { idx: 45, name: "duckMine", folder: "mine", base: 2 },
  { idx: 46, name: "oil", folder: "oil", base: 0 },
  { idx: 47, name: "prisonBomb", folder: "waterBomb", base: 2 },
  { idx: 81, name: "protectShield", folder: "goldShield", base: 1 },
  { idx: 82, name: "eggMine", folder: "mine", base: 3 },
  { idx: 83, name: "goldEggMine", folder: "mine", base: 4 },
  { idx: 85, name: "bigBanana", folder: "banana", base: 3 },
  { idx: 99, name: "tigerRocket", folder: "tigerRocket", base: 0 },
  { idx: 101, name: "tigerGhost", folder: "ghost", base: 1 },
  { idx: 102, name: "candyRocket", folder: "goldRocket", base: 1 },
  { idx: 103, name: "superMagnet", folder: "magnet", base: 0 },
  { idx: 104, name: "lockdownRocket", folder: "lockdownRocket", base: 0 },
  { idx: 106, name: "sirenShield", folder: "sirenShield", base: 0 },
  { idx: 107, name: "dinoEggRocket", folder: "goldRocket", base: 2 },
  { idx: 108, name: "dinoClawRocket", folder: "dinoClawRocket", base: 0 },
  { idx: 112, name: "snowman", folder: "snowman", base: 0 },
  { idx: 115, name: "darkCloud2", folder: "cloud2", base: 1 },
  { idx: 117, name: "blockRocket", folder: "lockdownRocket", base: 1 },
  { idx: 118, name: "snowWaterFly", folder: "snowWaterFly", base: 0 },
  { idx: 119, name: "infectedWaterFly", folder: "infectedWaterFly", base: 0 },
  { idx: 120, name: "waterbombFly", folder: "waterbombFly", base: 0 },
  { idx: 126, name: "foxTailRocket", folder: "goldRocket", base: 3 },
  { idx: 129, name: "springMine", folder: "mine", base: 7 },
  { idx: 130, name: "cogWheelMine", folder: "mine", base: 8 },
  { idx: 131, name: "deliveryRocket", folder: "deliveryRocket", base: 0 },
  { idx: 132, name: "honeyBee", folder: "honeyBee", base: 0 },
  { idx: 134, name: "lionMaskRocket", folder: "lionMaskRocket", base: 0 },
  { idx: 135, name: "abyssBarricade", folder: "abyssBarricade", base: 0 },
  { idx: 136, name: "pantherRocket", folder: "pantherRocket", base: 0 },
  { idx: 137, name: "talisman", folder: "talisman", base: 0 },
];

/**
 * Item names of the per-kart tables without an idx of their own: the
 * world-cup coke rocket is cokeRocket base 1, with no slot icon, so it is
 * granted as the coke rocket (transformByKart.bml:21).
 */
export const ITEM_ALIASES = { cokeRocketWorldCup: "cokeRocket" };

/**
 * The states of every variant (base) of an item.bml: a file lists its whole
 * state list once per variant, so a state name seen again starts the next
 * base. Returns [{name: life}] in base order.
 */
export function variantStates(root, source, problem) {
  if (root?.name !== "item") { problem(`${source}: root is ${root?.name}`); return []; }
  const bases = [];
  let current;
  for (const node of root.children) {
    if (node.name !== "state") continue;
    const name = attr(node, "name");
    if (!name) { problem(`${source}: state without a name`); continue; }
    if (!current || Object.hasOwn(current, name)) bases.push(current = {});
    const life = integer(attr(node, "life"));
    if (life === undefined || life < 0) { problem(`${source}: ${name} life ${attr(node, "life")}`); continue; }
    current[name] = life;
  }
  if (bases.length === 0) problem(`${source}: no states`);
  return bases;
}

/** idx by item name: the probability-table items plus the special items, and the aliases. */
export function itemIndex(tableItems, specials = SPECIAL_ITEMS) {
  const index = new Map();
  for (const item of [...tableItems, ...specials]) index.set(item.name, item.idx);
  for (const [alias, name] of Object.entries(ITEM_ALIASES))
    if (index.has(name)) index.set(alias, index.get(name));
  return index;
}

/**
 * Base file rows overlaid by region rows with the same key (the CN tables
 * are the unsuffixed file plus @cn overrides, research 13 §0.1: a 0 or -1
 * @cn row cancels a positive base row). Base order first, new region rows
 * after.
 */
export function overlayRows(baseRows, regionRows, keyOf) {
  const merged = new Map();
  for (const row of baseRows) merged.set(keyOf(row), row);
  for (const row of regionRows) merged.set(keyOf(row), row);
  return [...merged.values()];
}

const rowsOf = (root, tag) => (root?.children ?? []).filter(node => node.name === tag)
  .map(node => Object.fromEntries(node.attributes.map(item => [item.name, item.value])));

/** The item-race chance of a table probability: its first number ("50,80" is 50). */
export function tableProbability(raw) {
  return integer(String(raw ?? "").split(",")[0]);
}

/**
 * transformByKart: an item a kart gets from a cube may turn into another.
 * Key (kartId, srcIdx, gitType), a missing gitType counting as no_flag;
 * bossOnly rows (boss races) and rows cancelled to 0/-1 are dropped, and so
 * are rows whose source no item race produces (cloud, rainbowCloud,
 * rollingBomb). Returns [{kart, src, dst, p}] by kart and source.
 */
export function transformRows(baseRoot, regionRoot, index, problem) {
  const gitType = row => row.gitType ?? "no_flag";
  const rows = overlayRows(rowsOf(baseRoot, "item"), rowsOf(regionRoot, "item"),
    row => `${row.kartId}|${row.srcIdx}|${gitType(row)}`);
  const out = [];
  let dropped = 0;
  for (const row of rows) {
    const kart = integer(row.kartId);
    const p = tableProbability(row.probability);
    if (kart === undefined || kart <= 0 || p === undefined) { problem(`transformByKart: bad row ${JSON.stringify(row)}`); continue; }
    if (gitType(row) === "bossOnly" || p <= 0) continue;
    if (gitType(row) !== "no_flag") { problem(`transformByKart: gitType ${row.gitType}`); continue; }
    const src = index.get(row.srcIdx);
    if (src === undefined) { dropped++; continue; }
    const dst = index.get(row.dstIdx);
    if (dst === undefined) { problem(`transformByKart: kart ${kart} ${row.srcIdx} -> unknown ${row.dstIdx}`); continue; }
    out.push({ kart, src, dst, p: Math.min(p, 100) });
  }
  out.sort((a, b) => a.kart - b.kart || a.src - b.src);
  for (let i = 1; i < out.length; i++)
    if (out[i].kart === out[i - 1].kart && out[i].src === out[i - 1].src)
      problem(`transformByKart: kart ${out[i].kart} transforms ${out[i].src} twice`);
  return { rows: out, dropped };
}

/**
 * fired2Gain / firing2Gain: a kart hit by (fired) or using (firing) an item
 * may gain another. Key (kartId, item) for fired, (kartId, item, gameType)
 * for firing, whose gameType rows (flag races) are dropped after the
 * merge. Rows naming an item no item race has (areaUfo) are dropped.
 * Returns [{kart, item, gain, p}].
 */
export function gainRows(kind, baseRoot, regionRoot, index, problem) {
  const field = kind === "fired" ? "firedItemIdx" : "firingItemIdx";
  const rows = overlayRows(rowsOf(baseRoot, "item"), rowsOf(regionRoot, "item"),
    row => `${row.kartId}|${row[field]}|${kind === "firing" ? row.gameType ?? "" : ""}`);
  const out = [];
  let dropped = 0;
  for (const row of rows) {
    const kart = integer(row.kartId);
    const p = tableProbability(row.probability);
    if (kart === undefined || kart <= 0 || p === undefined) { problem(`${kind}2Gain: bad row ${JSON.stringify(row)}`); continue; }
    if (p <= 0 || (kind === "firing" && row.gameType !== undefined)) continue;
    if (kind === "firing" && row.firingStep !== undefined && row.firingStep !== "1")
      problem(`firing2Gain: kart ${kart} firingStep ${row.firingStep}`);
    const item = index.get(row[field]);
    if (item === undefined) { dropped++; continue; }
    const gain = index.get(row.gainItemIdx);
    if (gain === undefined) { problem(`${kind}2Gain: kart ${kart} ${row[field]} gains unknown ${row.gainItemIdx}`); continue; }
    out.push({ kart, item, gain, p: Math.min(p, 100) });
  }
  out.sort((a, b) => a.kart - b.kart || a.item - b.item);
  for (let i = 1; i < out.length; i++)
    if (out[i].kart === out[i - 1].kart && out[i].item === out[i - 1].item)
      problem(`${kind}2Gain: kart ${out[i].kart} lists ${out[i].item} twice`);
  return { rows: out, dropped };
}

/**
 * animalBooster: a booster this kart gets becomes the special booster (31)
 * with probability prob (missing 100; -1 cancels the kart), shown with the
 * slot icon item/slot/animal<iconId>.png (0: none, the plain item31 icon).
 * Returns [{kart, icon, p}].
 */
export function animalBoosterRows(baseRoot, regionRoot, problem) {
  const rows = overlayRows(rowsOf(baseRoot, "animalBooster"), rowsOf(regionRoot, "animalBooster"),
    row => row.kartId);
  const out = [];
  for (const row of rows) {
    const kart = integer(row.kartId);
    const p = row.prob === undefined ? 100 : integer(row.prob);
    const icon = row.iconId === undefined ? 0 : integer(row.iconId);
    if (kart === undefined || kart <= 0 || p === undefined || icon === undefined || icon < 0) {
      problem(`animalBooster: bad row ${JSON.stringify(row)}`);
      continue;
    }
    if (p <= 0) continue;
    out.push({ kart, icon, p: Math.min(p, 100) });
  }
  return out.sort((a, b) => a.kart - b.kart);
}

/**
 * transform@zz: fixed transforms of a drawn item by the race track's level
 * (track@zz level) and reverse flag. Returns [{src, dst, level, reverse?, p}].
 */
export function trackTransformRows(root, index, problem) {
  const out = [];
  for (const row of rowsOf(root, "item")) {
    const src = integer(row.srcIdx);
    const dst = integer(row.destIdx);
    const level = integer(row.level);
    const p = integer(row.probability);
    if (src === undefined || dst === undefined || level === undefined || p === undefined || p <= 0) {
      problem(`transform@zz: bad row ${JSON.stringify(row)}`);
      continue;
    }
    if (row.name !== undefined && index.get(row.name) !== src) problem(`transform@zz: ${row.name} is not idx ${src}`);
    if (![...index.values()].includes(dst)) problem(`transform@zz: unknown destination ${dst}`);
    out.push({ src, dst, level, reverse: row.isReverse === "true" ? true : undefined, p: Math.min(p, 100) });
  }
  if (out.length === 0) problem("transform@zz: no rows");
  return out;
}

/**
 * Track levels from track@zz: <track id level> and <track_rvs refId level>
 * (an _rvs id). 22 item tracks have no level attribute; like any missing
 * integer attribute it reads as 0.
 */
export function trackLevels(root) {
  const levels = new Map();
  for (const node of root?.children ?? []) {
    const level = attr(node, "level") === undefined ? 0 : integer(attr(node, "level"));
    if (node.name === "track" && attr(node, "id")) levels.set(attr(node, "id"), level);
    else if (node.name === "track_rvs" && attr(node, "refId")) levels.set(`${attr(node, "refId")}_rvs`, level);
  }
  return levels;
}

/**
 * etc_/itemTable.kml overlaid by etc_/itemTable@cn.xml per (tag, id): the
 * effective attributes of every item (research 6 §0.4). Returns
 * Map<tag, Map<id, {attr: value}>>.
 */
export function mergedItemTable(baseRoot, regionRoot) {
  const merged = new Map();
  for (const root of [baseRoot, regionRoot])
    for (const node of root?.children ?? []) {
      const id = integer(attr(node, "id"));
      if (id === undefined) continue;
      if (!merged.has(node.name)) merged.set(node.name, new Map());
      const byId = merged.get(node.name);
      byId.set(id, { ...byId.get(id), ...Object.fromEntries(node.attributes.map(item => [item.name, item.value])) });
    }
  return merged;
}

/**
 * The item-race passives read from the merged item table, by holder tag
 * (ITEM_MODE.md C.2): a value is "p" or "pItem,pAi"; the item race uses the
 * first number and -1 means unset (enchantCatalog.xml:101-106).
 */
export const PASSIVE_ATTRIBUTES = {
  kart: ["rocket", "waterfly", "onlyWaterBomb", "waterflyToWaterBomb", "allflyToAllBomb", "devil", "banana",
    "iceBanana", "mine", "mineWithEggMine", "mineWithKindOfEgg", "eatMine", "forceZone", "eatForceZone",
    "waterMine", "siren", "waterAngel", "useTwoRocket", "useTwoGoldRocket", "lucciItemCube"],
  pet: ["rocket", "waterfly", "waterBomb", "devil", "snowBomb"],
  character: ["lucciUfo", "lucciMine", "lucciForceZone"],
  balloon: ["prob"],
  headBand: ["probability"],
};

/** The item-race chance (0..100) of a passive value; undefined when malformed. */
export function itemRaceChance(raw) {
  const first = integer(String(raw ?? "").split(",")[0]);
  if (first === undefined) return undefined;
  return first === -1 ? 0 : first;
}

/** {tag: {id: {attr: chance}}} with only the non-zero chances. */
export function passiveRows(merged, problem) {
  const out = {};
  for (const [tag, names] of Object.entries(PASSIVE_ATTRIBUTES)) {
    out[tag] = {};
    for (const [id, attrs] of [...(merged.get(tag) ?? new Map())].sort((a, b) => a[0] - b[0])) {
      const values = {};
      for (const name of names) {
        if (attrs[name] === undefined) continue;
        const chance = itemRaceChance(attrs[name]);
        if (chance === undefined || chance < 0 || chance > 100) { problem(`${tag} ${id} ${name}=${attrs[name]}`); continue; }
        if (chance > 0) values[name] = chance;
      }
      if (Object.keys(values).length > 0) out[tag][String(id)] = values;
    }
  }
  return out;
}

/**
 * enchantCatalog.xml: what each passive key defends against. Every Tune with
 * EnchanterShield rows gives {group, tune, key?, items (idx), names}, the
 * vs-AI rows (gameType aiGame) left out; names without an idx (rollingBomb…)
 * are kept in names only.
 */
export function enchantShields(root, index, problem) {
  const out = [];
  if (root?.name !== "CompatibilityList") { problem(`enchantCatalog: root is ${root?.name}`); return out; }
  for (const group of root.children.filter(node => node.name === "TuneGroup"))
    for (const tune of group.children.filter(node => node.name === "Tune")) {
      const shields = tune.children.filter(node => node.name === "EnchanterShield" && attr(node, "gameType") !== "aiGame");
      if (shields.length === 0) continue;
      const names = [...new Set(shields.map(node => attr(node, "itemId")))];
      const items = [...new Set(names.map(name => index.get(name)).filter(idx => idx !== undefined))].sort((a, b) => a - b);
      out.push({ group: integer(attr(group, "id")), tune: integer(attr(tune, "id")), key: attr(tune, "key"), items, names });
    }
  return out;
}

/**
 * The 迅 (engine 12) item karts that start a race holding one item
 * (tip.xml:138; garage 赋能系统（道具）): engine sound 12*, an item kart
 * (ItemSlotCapacity in its param), and a default exceed type whose
 * chargerSystemboosterUseCount is 0 (exceedTypeChange.xml). params maps a
 * kart id to its BodyParam attributes. Returns sorted kart ids.
 */
export function xunItemKarts(params, exceedRoot, problem) {
  const charger = new Map();
  for (const node of exceedRoot?.children?.find(child => child.name === "exceedTypeList")?.children ?? [])
    if (node.name === "exceedType") charger.set(attr(node, "id"), integer(attr(node, "chargerSystemboosterUseCount")));
  if (charger.size === 0) problem("exceedTypeChange: no exceed types");
  const karts = [];
  for (const [id, param] of params) {
    if (!/^12/.test(param.EngineSound ?? "") || param.ItemSlotCapacity === undefined) continue;
    const type = param.defaultExceedType;
    if (!charger.has(type)) { problem(`kart ${id}: exceed type ${type} unknown`); continue; }
    if (charger.get(type) === 0) karts.push(id);
  }
  return karts.sort((a, b) => a - b);
}

/**
 * Result titles (stage_mqGameFinal title_icons/namemap@zz.bml): internal key
 * by Korean name, and the items whose uses count for item="…" titles. The
 * namemap item names are classes; the families are every race item of that
 * class (C.9): 导弹类 all *Rocket items, water flies, thrown water bombs,
 * clouds, magnets, the UFO, boosters.
 */
export const TITLE_KEYS = {
  "백발백중": "perfectAim", "철벽방어": "ironWall", "터렛모드": "turret", "파리대왕": "flyKing",
  "융단폭격": "carpetBomb", "구름낀날": "cloudyDay", "왠지끌려": "magnetic", "지구침공": "invasion",
  "스피드전": "speedWar", "완벽출발": "perfectStart", "유아독존": "onlyOne", "안전제일": "safetyFirst",
};

export const TITLE_FAMILIES = {
  angel: name => name === "angel",
  rocket: name => name === "rocket" || name.endsWith("Rocket"),
  waterFly: name => /^(waterFly|snowWaterFly|infectedWaterFly|waterbombFly)$/.test(name),
  waterBomb: name => /^(waterBomb|cokeBomb|snowBomb|infectedBomb|pumpkinBomb|prisonBomb)$/.test(name),
  cloud: name => /^(cloud2|darkCloud|darkCloud2)$/.test(name),
  magnet: name => name === "magnet" || name === "superMagnet",
  ufo: name => name === "ufo",
  booster: name => name === "booster" || name === "animalBooster",
};

export function titleRows(root, index, problem) {
  const out = [];
  if (root?.name !== "TitleIcons") { problem(`namemap: root is ${root?.name}`); return out; }
  for (const node of root.children.filter(child => child.name === "Title")) {
    const name = attr(node, "name");
    const key = TITLE_KEYS[name];
    if (!key) { problem(`namemap: unknown title ${name}`); continue; }
    const row = { key, name };
    if (attr(node, "fail") !== undefined) row.fail = integer(attr(node, "fail"));
    if (attr(node, "item") !== undefined) {
      const family = TITLE_FAMILIES[attr(node, "item")];
      if (!family) { problem(`namemap: ${name} item ${attr(node, "item")} has no family`); continue; }
      row.item = attr(node, "item");
      row.items = [...index].filter(([itemName]) => family(itemName)).map(([, idx]) => idx)
        .filter((idx, i, all) => all.indexOf(idx) === i).sort((a, b) => a - b);
      row.use = integer(attr(node, "use"));
      if (!(row.use > 0) || row.items.length === 0) problem(`namemap: ${name} use ${attr(node, "use")}`);
    }
    if (attr(node, "custom") !== undefined) row.custom = integer(attr(node, "custom"));
    out.push(row);
  }
  if (out.length !== Object.keys(TITLE_KEYS).length) problem(`namemap: ${out.length} titles`);
  return out;
}

/** The keys of etc_/itemDescList.xml (<k n>), for the special item check. */
export function descriptionKeys(root) {
  return new Set((root?.children ?? []).filter(node => node.name === "k").map(node => attr(node, "n")));
}
