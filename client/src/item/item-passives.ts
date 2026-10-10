/**
 * Equipment passives of the item race (ITEM_MODE.md C.1, C.2): the item
 * abilities of the frozen race equipment — kart `itemIds["3"]`, character
 * `"1"`, pet `"21"`, goggle `"8"`, balloon `"9"`, headband `"11"` and flying
 * pet `"52"` — read from `etc_/itemTable.kml` overlaid per (tag, id) by
 * `etc_/itemTable@cn.xml` (the CN overlay carries every kart, character and
 * pet passive; the base table only goggle/headband/balloon values and the
 * kart `trans` of karts 61 and 182).
 *
 * Probabilities are `"p"` or `"pItemGame,pAiGame"`: the item race uses the
 * first number and `-1` means not set (enchantCatalog.xml:101-106). The victim
 * client rolls them with the shared deterministic roll (item-roll.ts); the
 * game node checks the reported `by` / `variant` with the same roll.
 */
import { decodeBinaryXml } from "../codecs/binary-xml";
import { parseResourceXml } from "../resources/xml-utf16-parser";
import type { ItemXmlNode } from "./item-bml";
import { itemRollSucceeds, type ItemRollKind } from "./item-roll";

export type PassiveTag = "kart" | "character" | "pet" | "goggle" | "balloon" | "headBand" | "flyingPet";

/** Equipment slots (`equipment.itemIds` keys) of each passive holder. */
export const PASSIVE_SLOTS: Readonly<Record<PassiveTag, string>> = Object.freeze({
  kart: "3", character: "1", pet: "21", goggle: "8", balloon: "9", headBand: "11", flyingPet: "52",
});

/** The attributes the item race reads, per holder (research-6 §1; the rest are cosmetic). */
const PASSIVE_ATTRIBUTES: Readonly<Record<PassiveTag, readonly string[]>> = Object.freeze({
  kart: ["rocket", "waterfly", "onlyWaterBomb", "waterflyToWaterBomb", "allflyToAllBomb", "devil",
    "banana", "iceBanana", "mine", "mineWithEggMine", "mineWithKindOfEgg", "eatMine", "forceZone",
    "eatForceZone", "waterMine", "siren", "waterAngel", "useTwoRocket", "useTwoGoldRocket",
    "lucciItemCube", "trans"],
  character: ["lucciUfo", "lucciMine", "lucciForceZone"],
  pet: ["rocket", "waterfly", "waterBomb", "devil", "snowBomb"],
  goggle: ["trans", "cloudTime"],
  balloon: ["prob"],
  headBand: ["probability"],
  flyingPet: ["tuneGroupId"],
});

export interface ItemPassiveTable {
  /** Effective (base overlaid by @cn) passive attributes of one item, raw strings. */
  attributes(tag: PassiveTag, id: number): Readonly<Record<string, string>> | undefined;
  /** Item ids per holder that carry any passive attribute. */
  readonly size: number;
}

function nodeAttributes(node: ItemXmlNode): Record<string, string> {
  return Object.fromEntries(node.attributes.map(attribute => [attribute.name, attribute.value]));
}

/**
 * Overlay the itemTable rows: the CN overlay wins attribute by attribute for
 * the same (tag, id); only the passive attributes are kept.
 */
export function createItemPassiveTable(base: ItemXmlNode, overlay?: ItemXmlNode): ItemPassiveTable {
  for (const root of [base, overlay]) {
    if (root && root.name !== "itemtable") throw Error("itemTable 根节点不是 itemtable。");
  }
  const tables = new Map<string, Map<number, Record<string, string>>>();
  for (const root of [base, overlay]) {
    for (const node of root?.children ?? []) {
      const wanted = PASSIVE_ATTRIBUTES[node.name as PassiveTag];
      if (!wanted) continue;
      const values = nodeAttributes(node);
      const id = Number(values.id);
      if (!/^\d+$/.test(values.id ?? "") || !Number.isSafeInteger(id)) continue;
      const kept = Object.fromEntries(wanted.filter(name => values[name] !== undefined)
        .map(name => [name, values[name]!.trim()]));
      let byId = tables.get(node.name);
      if (!byId) tables.set(node.name, byId = new Map());
      const previous = byId.get(id);
      if (previous) Object.assign(previous, kept);
      else if (Object.keys(kept).length) byId.set(id, kept);
    }
  }
  let size = 0;
  for (const byId of tables.values()) size += byId.size;
  return {
    attributes: (tag, id) => tables.get(tag)?.get(id),
    size,
  };
}

function uniqueEntry<T extends { absenceAuthoritative?: boolean; bytes(): Promise<Uint8Array> }>(
  library: { exactCanonicalCandidates(path: string): T[] }, path: string, optional: boolean): T | undefined {
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length === 0 && optional) return undefined;
  if (candidates.length !== 1) throw Error(`${path} 需要唯一原件，实际 ${candidates.length}。`);
  return candidates[0];
}

export interface ItemPassiveLibrary {
  exactCanonicalCandidates(path: string): Array<{ absenceAuthoritative?: boolean; bytes(): Promise<Uint8Array> }>;
}

/** Load `etc_/itemTable.kml` and its optional `@cn` overlay (UTF-16 XML, like the garage). */
export async function loadItemPassiveTable(library: ItemPassiveLibrary): Promise<ItemPassiveTable> {
  const base = uniqueEntry(library, "etc_/itemTable.kml", false)!;
  const overlay = uniqueEntry(library, "etc_/itemTable@cn.xml", true);
  const [baseRoot, overlayRoot] = await Promise.all([
    base.bytes().then(bytes => parseResourceXml(bytes).root),
    overlay?.bytes().then(bytes => parseResourceXml(bytes).root),
  ]);
  return createItemPassiveTable(baseRoot as ItemXmlNode, overlayRoot as ItemXmlNode | undefined);
}

// ---- animal boosters (item/slot/animalBooster[@cn].bml) ----

export interface AnimalBoosterRow { kartId: number; iconId?: number; prob: number }

/**
 * Special booster rows per kart (research-13 §6): base file overlaid by the
 * @cn rows, keyed by kartId; a missing `prob` is 100, -1 disables the row.
 */
export function createAnimalBoosterTable(base: ItemXmlNode, overlay?: ItemXmlNode):
  ReadonlyMap<number, AnimalBoosterRow> {
  const rows = new Map<number, AnimalBoosterRow>();
  for (const root of [base, overlay]) {
    if (!root) continue;
    if (root.name !== "animalBoosterList") throw Error("animalBooster 根节点不是 animalBoosterList。");
    for (const node of root.children) {
      if (node.name !== "animalBooster") continue;
      const values = nodeAttributes(node);
      const kartId = Number(values.kartId);
      if (!Number.isSafeInteger(kartId) || kartId <= 0) continue;
      const iconId = values.iconId !== undefined && /^\d+$/.test(values.iconId) ? Number(values.iconId) : undefined;
      const prob = values.prob === undefined ? 100 : Number(values.prob);
      rows.set(kartId, { kartId, ...(iconId !== undefined ? { iconId } : {}),
        prob: Number.isFinite(prob) ? prob : 100 });
    }
  }
  return rows;
}

export async function loadAnimalBoosterTable(library: ItemPassiveLibrary):
  Promise<ReadonlyMap<number, AnimalBoosterRow>> {
  const base = uniqueEntry(library, "item/slot/animalBooster.bml", false)!;
  const overlay = uniqueEntry(library, "item/slot/animalBooster@cn.bml", true);
  const [baseRoot, overlayRoot] = await Promise.all([
    base.bytes().then(bytes => decodeBinaryXml(bytes) as ItemXmlNode),
    overlay?.bytes().then(bytes => decodeBinaryXml(bytes) as ItemXmlNode),
  ]);
  return createAnimalBoosterTable(baseRoot, overlayRoot);
}

/** The slot icon of the special booster (idx 31) for this kart, when its row gives one. */
export function animalBoosterIcon(table: ReadonlyMap<number, AnimalBoosterRow> | undefined,
  kartId: number): number | undefined {
  const row = table?.get(kartId);
  return row && row.prob !== -1 ? row.iconId : undefined;
}

// ---- per racer ----

/** First number of `"p"` / `"p,q"`, -1 (not set) as 0, clamped to 0..100. */
export function passivePercent(value: string | undefined): number {
  if (value === undefined) return 0;
  const first = Number(value.split(",")[0]!.trim());
  if (!Number.isFinite(first) || first <= 0) return 0;
  return Math.min(100, first);
}

function fraction(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export interface RacerPassives {
  kartId: number;
  kart: {
    rocket: number; waterfly: number; onlyWaterBomb: number; waterflyToWaterBomb: boolean;
    allflyToAllBomb: boolean; devil: number; banana: number; iceBanana: number; mine: number;
    mineWithEggMine: boolean; mineWithKindOfEgg: boolean; eatMine: boolean; forceZone: number;
    eatForceZone: boolean; waterMine: number;
    siren: number; waterAngel: number; useTwoRocket: boolean; useTwoGoldRocket: boolean;
    lucciItemCube: number; trans: number;
  };
  pet: { rocket: number; waterfly: number; waterBomb: number; devil: number; snowBomb: number };
  character: { lucciUfo: number; lucciMine: number; lucciForceZone: number };
  goggle: { trans: number; cloudTime: number };
  balloon: { prob: number };
  headBand: { probability: number };
  flyingPet: { tuneGroupId: number };
}

export const NO_PASSIVES: RacerPassives = Object.freeze(racerPassives(undefined, undefined));

/** The equipment id of a slot (`itemIds` keys are strings in JSON). */
export function equipmentId(itemIds: unknown, slot: string): number {
  if (!itemIds || typeof itemIds !== "object") return 0;
  const value = (itemIds as Record<string, unknown>)[slot];
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : 0;
}

/** The passives of one racer from its frozen `equipment.itemIds`. */
export function racerPassives(table: ItemPassiveTable | undefined, itemIds: unknown): RacerPassives {
  const read = (tag: PassiveTag) => {
    const id = equipmentId(itemIds, PASSIVE_SLOTS[tag]);
    return (id && table?.attributes(tag, id)) || {};
  };
  const kart = read("kart"), character = read("character"), pet = read("pet");
  const goggle = read("goggle"), balloon = read("balloon"), headBand = read("headBand");
  const flyingPet = read("flyingPet");
  const flag = (value: string | undefined) => passivePercent(value) > 0;
  return {
    kartId: equipmentId(itemIds, PASSIVE_SLOTS.kart),
    kart: {
      rocket: passivePercent(kart.rocket), waterfly: passivePercent(kart.waterfly),
      onlyWaterBomb: passivePercent(kart.onlyWaterBomb),
      waterflyToWaterBomb: flag(kart.waterflyToWaterBomb), allflyToAllBomb: flag(kart.allflyToAllBomb),
      devil: passivePercent(kart.devil), banana: passivePercent(kart.banana),
      iceBanana: passivePercent(kart.iceBanana), mine: passivePercent(kart.mine),
      mineWithEggMine: flag(kart.mineWithEggMine), mineWithKindOfEgg: flag(kart.mineWithKindOfEgg),
      eatMine: flag(kart.eatMine), forceZone: passivePercent(kart.forceZone),
      eatForceZone: flag(kart.eatForceZone), waterMine: passivePercent(kart.waterMine),
      siren: passivePercent(kart.siren), waterAngel: passivePercent(kart.waterAngel),
      useTwoRocket: flag(kart.useTwoRocket), useTwoGoldRocket: flag(kart.useTwoGoldRocket),
      lucciItemCube: passivePercent(kart.lucciItemCube), trans: fraction(kart.trans, 0, 0, 1),
    },
    pet: {
      rocket: passivePercent(pet.rocket), waterfly: passivePercent(pet.waterfly),
      waterBomb: passivePercent(pet.waterBomb), devil: passivePercent(pet.devil),
      snowBomb: passivePercent(pet.snowBomb),
    },
    character: { lucciUfo: passivePercent(character.lucciUfo), lucciMine: passivePercent(character.lucciMine),
      lucciForceZone: passivePercent(character.lucciForceZone) },
    goggle: { trans: fraction(goggle.trans, 0, 0, 1), cloudTime: fraction(goggle.cloudTime, 1, 0, 1) },
    balloon: { prob: passivePercent(balloon.prob) },
    headBand: { probability: passivePercent(headBand.probability) },
    flyingPet: { tuneGroupId: Number(flyingPet.tuneGroupId) || 0 },
  };
}

// ---- item groups the passives cover (ITEM_MODE.md C.2) ----

/** rocket, cokeRocket, goldRocket and its reskins (enchantCatalog.xml:41-47). */
export const ROCKET_DEFENCE_ITEMS: ReadonlySet<number> = new Set([7, 30, 32, 102, 107, 126]);
/** waterFly and the fly variants. */
export const WATER_FLY_ITEMS: ReadonlySet<number> = new Set([4, 118, 119, 120]);
/** The water-bomb family, time bombs included (enchantCatalog.xml:48-62). */
export const WATER_BOMB_ITEMS: ReadonlySet<number> = new Set([9, 13, 20, 21, 27, 28, 34, 35, 44, 47]);
/** devil, drrMine (Dr. R), newDevil (enchant.xml:220 fired='2;23;38'). */
export const DEVIL_ITEMS: ReadonlySet<number> = new Set([2, 23, 38]);
export const SNOW_BOMB_ITEMS: ReadonlySet<number> = new Set([34, 35]);
export const BANANA_ITEMS: ReadonlySet<number> = new Set([8, 85]);
/** mine, springMine, cogWheelMine; the egg kinds need mineWithEggMine / mineWithKindOfEgg. */
export const MINE_ITEMS: ReadonlySet<number> = new Set([17, 129, 130]);
export const EGG_MINE_ITEMS: ReadonlySet<number> = new Set([45, 82, 83]);
export const WATER_MINE_ITEMS: ReadonlySet<number> = new Set([37]);
/** forceZone (弹性陷阱): the kart's forceZone / eatForceZone, like mine / eatMine (enchantCatalog.xml:21-25). */
export const FORCE_ZONE_ITEMS: ReadonlySet<number> = new Set([25]);
export const SIREN_ITEMS: ReadonlySet<number> = new Set([24, 106]);
/** Traps a waterAngel kart leaves quickly: water bombs, flies and the water mine. */
export const WATER_TRAP_ITEMS: ReadonlySet<number> = new Set([...WATER_BOMB_ITEMS, ...WATER_FLY_ITEMS, 37]);
/** Missiles a balloon softens; the gold-rocket family cannot be (itemDescList.xml:350). */
export const BALLOON_ITEMS: ReadonlySet<number> = new Set([7, 33, 127, 30]);
export const UFO_ITEMS: ReadonlySet<number> = new Set([3]);
export const CLOUD_ITEMS: ReadonlySet<number> = new Set([114, 115, 1]);

export interface PassiveRollContext {
  raceId: string;
  useId: number;
  hazardId?: number;
  victimId: string;
  itemId: number;
  /** The race track (iceBanana works on `ice_` tracks only). */
  trackId?: string;
}

export type PassiveBlock =
  | { by: "kart" | "pet"; kind: ItemRollKind }
  | { by: "eat"; kind: ItemRollKind; consumed: boolean; bonus: boolean };

function roll(context: PassiveRollContext, kind: ItemRollKind, percent: number): boolean {
  return itemRollSucceeds({ raceId: context.raceId, useId: context.useId,
    hazardId: context.hazardId, victimId: context.victimId, kind }, percent);
}

/**
 * The equipment's full defence against one item, if a roll succeeds: the
 * kart is asked before the pet with one shared roll per kind, so the better
 * probability decides; bananas and mines a kart defends are eaten.
 */
export function equipmentBlock(passives: RacerPassives, context: PassiveRollContext):
  PassiveBlock | undefined {
  const { kart, pet, character } = passives;
  const item = context.itemId;
  const pair = (kind: ItemRollKind, kartPercent: number, petPercent: number): PassiveBlock | undefined => {
    if (roll(context, kind, kartPercent)) return { by: "kart", kind };
    if (roll(context, kind, petPercent)) return { by: "pet", kind };
    return undefined;
  };
  if (ROCKET_DEFENCE_ITEMS.has(item)) return pair("rocket", kart.rocket, pet.rocket);
  if (WATER_FLY_ITEMS.has(item)) {
    const block = pair("waterfly", kart.waterfly, pet.waterfly);
    if (block) return block;
    const asBomb = kart.allflyToAllBomb || (kart.waterflyToWaterBomb && item === 4);
    return asBomb && roll(context, "waterBomb", kart.onlyWaterBomb) ? { by: "kart", kind: "waterBomb" } : undefined;
  }
  if (SNOW_BOMB_ITEMS.has(item) && roll(context, "snowBomb", pet.snowBomb)) return { by: "pet", kind: "snowBomb" };
  if (WATER_BOMB_ITEMS.has(item)) return pair("waterBomb", item === 9 ? kart.onlyWaterBomb : 0, pet.waterBomb);
  if (DEVIL_ITEMS.has(item)) return pair("devil", kart.devil, pet.devil);
  if (BANANA_ITEMS.has(item)) {
    const ice = /^ice_/.test(context.trackId ?? "") ? kart.iceBanana : 0;
    return roll(context, "banana", Math.max(kart.banana, ice))
      ? { by: "eat", kind: "banana", consumed: true, bonus: false } : undefined;
  }
  if (MINE_ITEMS.has(item) || (EGG_MINE_ITEMS.has(item) && (kart.mineWithEggMine || kart.mineWithKindOfEgg))) {
    if (!roll(context, "mine", kart.mine)) return undefined;
    // The eaten mine pays the 神秘工头 bonus (EatBonus) on its own roll.
    return kart.eatMine
      ? { by: "eat", kind: "mine", consumed: true, bonus: roll(context, "lucciMine", character.lucciMine) }
      : { by: "kart", kind: "mine" };
  }
  if (FORCE_ZONE_ITEMS.has(item)) {
    if (!roll(context, "forceZone", kart.forceZone)) return undefined;
    return kart.eatForceZone
      ? { by: "eat", kind: "forceZone", consumed: true, bonus: roll(context, "lucciForceZone", character.lucciForceZone) }
      : { by: "kart", kind: "forceZone" };
  }
  if (WATER_MINE_ITEMS.has(item)) return roll(context, "waterMine", kart.waterMine) ? { by: "kart", kind: "waterMine" } : undefined;
  if (SIREN_ITEMS.has(item)) return roll(context, "siren", kart.siren) ? { by: "kart", kind: "siren" } : undefined;
  return undefined;
}

export type PassiveVariant = "balloon" | "headband" | "bonus";

/**
 * Partial outcomes after shields and angels (C.2): the balloon softens a
 * missile to AffectSmall, the headband shortens a UFO to HeadBandAffect, the
 * 奇奇 characters turn a UFO hit into BonusAffect (+lucci).
 */
export function partialVariant(passives: RacerPassives, context: PassiveRollContext,
  options: { balloonSpent?: boolean } = {}): PassiveVariant | undefined {
  const item = context.itemId;
  if (BALLOON_ITEMS.has(item) && !options.balloonSpent && roll(context, "balloon", passives.balloon.prob))
    return "balloon";
  if (UFO_ITEMS.has(item)) {
    if (roll(context, "headband", passives.headBand.probability)) return "headband";
    if (roll(context, "lucciUfo", passives.character.lucciUfo)) return "bonus";
  }
  return undefined;
}

/** waterAngel: a water trap lasts only the quick-escape time (variant "quick"). */
export function quickEscape(passives: RacerPassives, context: PassiveRollContext): boolean {
  return WATER_TRAP_ITEMS.has(context.itemId) && roll(context, "waterAngel", passives.kart.waterAngel);
}

/** Cloud cover: opacity factor (1 − best see-through) and duration factor of the goggle. */
export function cloudFactors(passives: RacerPassives): { opacity: number; duration: number } {
  const trans = Math.max(passives.goggle.trans, passives.kart.trans);
  return { opacity: Math.max(0, 1 - trans), duration: passives.goggle.cloudTime };
}

/** Flying pets of tune group 204 lengthen the item booster (enchant.xml:385-387). */
export const FLYING_PET_BOOSTER_GROUP = 204;
export const FLYING_PET_BOOSTER_BONUS_MS = 250;

export function itemBoosterBonusMs(passives: RacerPassives): number {
  return passives.flyingPet.tuneGroupId === FLYING_PET_BOOSTER_GROUP ? FLYING_PET_BOOSTER_BONUS_MS : 0;
}
