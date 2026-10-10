import { decodeBinaryXml } from "../codecs/binary-xml";
import { parseResourceXml } from "../resources/xml-utf16-parser";
import { parseItemBml, type ItemBml, type ItemState, type ItemXmlNode } from "./item-bml";
import {
  loadAnimalBoosterTable, loadItemPassiveTable, type AnimalBoosterRow, type ItemPassiveTable,
} from "./item-passives";

export type { ItemBase, ItemBml, ItemState } from "./item-bml";

/**
 * Original item indices. They name the slot icons (`item/slot/item<idx>.png`),
 * the probability rows (`itemProb_*`) and the HUD notices. Anchors come from
 * `item/slot/itemProb_*@zz.bml`; 14 is the release's team booster constant.
 * The special items (ITEM_MODE.md C.4) follow the phase-3 registry: anchors
 * from the probability and changer tables (17, 18, 25, 38, 46) and
 * enchant.xml (23 / 38 `fired='2;23;38'`, 31 `transform='6;31'`), the rest
 * from the `etc_/itemDescList.xml` key order checked against the slot icons.
 */
export const ItemIdx = {
  darkCloud: 1,
  devil: 2,
  ufo: 3,
  waterFly: 4,
  magnet: 5,
  booster: 6,
  rocket: 7,
  banana: 8,
  waterBomb: 9,
  shield: 10,
  angel: 11,
  emp: 12,
  timeBomb: 13,
  teamBooster: 14,
  mine: 17,
  superShield: 18,
  cokeBomb: 20,
  timeCokeBomb: 21,
  drrMine: 23,
  siren: 24,
  forceZone: 25,
  infectedBomb: 27,
  timeInfectedBomb: 28,
  cokeRocket: 30,
  animalBooster: 31,
  goldRocket: 32,
  guideRocket: 33,
  snowBomb: 34,
  timeSnowBomb: 35,
  goldShield: 36,
  waterMine: 37,
  newDevil: 38,
  pumpkinBomb: 44,
  duckMine: 45,
  oil: 46,
  prisonBomb: 47,
  protectShield: 81,
  eggMine: 82,
  goldEggMine: 83,
  bigBanana: 85,
  tigerRocket: 99,
  tigerGhost: 101,
  candyRocket: 102,
  superMagnet: 103,
  lockdownRocket: 104,
  sirenShield: 106,
  dinoEggRocket: 107,
  dinoClawRocket: 108,
  scanning: 109,
  slotLock: 110,
  thunderbolt: 111,
  snowman: 112,
  barricade: 113,
  cloud2: 114,
  darkCloud2: 115,
  blockRocket: 117,
  snowWaterFly: 118,
  infectedWaterFly: 119,
  waterbombFly: 120,
  foxTailRocket: 126,
  randomRocket: 127,
  springMine: 129,
  cogWheelMine: 130,
  deliveryRocket: 131,
  honeyBee: 132,
  lionMaskRocket: 134,
  abyssBarricade: 135,
  pantherRocket: 136,
  talisman: 137,
} as const;

export interface ItemRegistryEntry {
  readonly idx: number;
  readonly name: string;
  /** Folder under `item/` (models, item.bml) and `sound_/fx/item/` (sounds). */
  readonly folder: string;
  /** Variant inside the folder's item.bml; durations come from this base's states. */
  readonly base: number;
  /** Booster, team booster and the special booster have sounds but no item.rho definition. */
  readonly definition: boolean;
}

const entry = (idx: number, name: string, folder: string, base = 0, definition = true): ItemRegistryEntry =>
  ({ idx, name, folder, base, definition });

/**
 * The classic item-race set (spec Appendix B), plus the team booster and the
 * track-placed mine and water mine. guideRocket and randomRocket have no folder
 * of their own and reuse the rocket resources.
 */
export const CLASSIC_ITEM_REGISTRY: readonly ItemRegistryEntry[] = [
  entry(ItemIdx.devil, "devil", "devil"),
  entry(ItemIdx.ufo, "ufo", "ufo"),
  entry(ItemIdx.waterFly, "waterFly", "waterFly"),
  entry(ItemIdx.magnet, "magnet", "magnet"),
  entry(ItemIdx.booster, "booster", "booster", 0, false),
  entry(ItemIdx.rocket, "rocket", "rocket"),
  entry(ItemIdx.banana, "banana", "banana"),
  entry(ItemIdx.waterBomb, "waterBomb", "waterBomb"),
  entry(ItemIdx.shield, "shield", "shield"),
  entry(ItemIdx.angel, "angel", "angel"),
  entry(ItemIdx.emp, "emp", "emp"),
  entry(ItemIdx.timeBomb, "timeBomb", "timeBomb"),
  entry(ItemIdx.teamBooster, "teamBooster", "booster", 0, false),
  entry(ItemIdx.mine, "mine", "mine"),
  entry(ItemIdx.guideRocket, "guideRocket", "rocket"),
  entry(ItemIdx.waterMine, "waterMine", "waterMine"),
  entry(ItemIdx.scanning, "scanning", "scanning"),
  entry(ItemIdx.slotLock, "slotLock", "slotLock"),
  entry(ItemIdx.thunderbolt, "thunderbolt", "thunderbolt"),
  entry(ItemIdx.barricade, "barricade", "barricade"),
  entry(ItemIdx.cloud2, "cloud2", "cloud2"),
  entry(ItemIdx.randomRocket, "randomRocket", "rocket"),
];

/**
 * The special items the per-kart tables reach from the classic set (ITEM_MODE.md
 * C.4; research-13 §10, special-item-registry.json re-checked against
 * item.rho: every folder/base resolves, every idx has `item/slot/item<idx>.png`
 * and `item/itemStateNotice/item<idx>.png`, see item-catalog.test.ts). mine 17
 * and waterMine 37 are classic entries already. superMagnet has no folder of
 * its own (`superMag` is a movingUfo definition) and uses magnet base 0;
 * cokeRocketWorldCup (cokeRocket base 1) has no idx and is not registered.
 */
export const SPECIAL_ITEM_REGISTRY: readonly ItemRegistryEntry[] = [
  entry(ItemIdx.darkCloud, "darkCloud", "cloud", 1),
  entry(ItemIdx.superShield, "superShield", "shield", 1),
  entry(ItemIdx.cokeBomb, "cokeBomb", "cokeBomb"),
  entry(ItemIdx.timeCokeBomb, "timeCokeBomb", "timeCokeBomb"),
  entry(ItemIdx.drrMine, "drrMine", "drmad"),
  entry(ItemIdx.siren, "siren", "siren"),
  entry(ItemIdx.forceZone, "forceZone", "forceZone"),
  entry(ItemIdx.infectedBomb, "infectedBomb", "infectedBomb"),
  entry(ItemIdx.timeInfectedBomb, "timeInfectedBomb", "timeInfectedBomb"),
  entry(ItemIdx.cokeRocket, "cokeRocket", "cokeRocket"),
  entry(ItemIdx.animalBooster, "animalBooster", "booster", 0, false),
  entry(ItemIdx.goldRocket, "goldRocket", "goldRocket"),
  entry(ItemIdx.snowBomb, "snowBomb", "snowBomb"),
  entry(ItemIdx.timeSnowBomb, "timeSnowBomb", "timeSnowBomb"),
  entry(ItemIdx.goldShield, "goldShield", "goldShield"),
  entry(ItemIdx.newDevil, "newDevil", "newDevil"),
  entry(ItemIdx.pumpkinBomb, "pumpkinBomb", "infectedBomb", 1),
  entry(ItemIdx.duckMine, "duckMine", "mine", 2),
  entry(ItemIdx.oil, "oil", "oil"),
  entry(ItemIdx.prisonBomb, "prisonBomb", "waterBomb", 2),
  entry(ItemIdx.protectShield, "protectShield", "goldShield", 1),
  entry(ItemIdx.eggMine, "eggMine", "mine", 3),
  entry(ItemIdx.goldEggMine, "goldEggMine", "mine", 4),
  entry(ItemIdx.bigBanana, "bigBanana", "banana", 3),
  entry(ItemIdx.tigerRocket, "tigerRocket", "tigerRocket"),
  entry(ItemIdx.tigerGhost, "tigerGhost", "ghost", 1),
  entry(ItemIdx.candyRocket, "candyRocket", "goldRocket", 1),
  entry(ItemIdx.superMagnet, "superMagnet", "magnet"),
  entry(ItemIdx.lockdownRocket, "lockdownRocket", "lockdownRocket"),
  entry(ItemIdx.sirenShield, "sirenShield", "sirenShield"),
  entry(ItemIdx.dinoEggRocket, "dinoEggRocket", "goldRocket", 2),
  entry(ItemIdx.dinoClawRocket, "dinoClawRocket", "dinoClawRocket"),
  entry(ItemIdx.snowman, "snowman", "snowman"),
  entry(ItemIdx.darkCloud2, "darkCloud2", "cloud2", 1),
  entry(ItemIdx.blockRocket, "blockRocket", "lockdownRocket", 1),
  entry(ItemIdx.snowWaterFly, "snowWaterFly", "snowWaterFly"),
  entry(ItemIdx.infectedWaterFly, "infectedWaterFly", "infectedWaterFly"),
  entry(ItemIdx.waterbombFly, "waterbombFly", "waterbombFly"),
  entry(ItemIdx.foxTailRocket, "foxTailRocket", "goldRocket", 3),
  entry(ItemIdx.springMine, "springMine", "mine", 7),
  entry(ItemIdx.cogWheelMine, "cogWheelMine", "mine", 8),
  entry(ItemIdx.deliveryRocket, "deliveryRocket", "deliveryRocket"),
  entry(ItemIdx.honeyBee, "honeyBee", "honeyBee"),
  entry(ItemIdx.lionMaskRocket, "lionMaskRocket", "lionMaskRocket"),
  entry(ItemIdx.abyssBarricade, "abyssBarricade", "abyssBarricade"),
  entry(ItemIdx.pantherRocket, "pantherRocket", "pantherRocket"),
  entry(ItemIdx.talisman, "talisman", "talisman"),
];

/** Every registered item: the classic set first, then the special items. */
export const ITEM_REGISTRY: readonly ItemRegistryEntry[] = [...CLASSIC_ITEM_REGISTRY, ...SPECIAL_ITEM_REGISTRY];

/** The 49 special destinations of C.4: the special registry plus the classic mine and water mine. */
export const SPECIAL_ITEM_IDS: readonly number[] = Object.freeze(
  [...SPECIAL_ITEM_REGISTRY.map(item => item.idx), ItemIdx.mine, ItemIdx.waterMine].sort((a, b) => a - b));

/** The item box is a track object, not an item; it has no idx. */
export const ITEM_CUBE_ENTRY = { name: "itemCube", folder: "itemCube", base: 0 } as const;

/**
 * Tuning that no original file carries ([还原] in ITEM_MODE.md). Kept together
 * so the controller, presenter and physics read the same numbers.
 */
export const ITEM_RULES = {
  /** Projectile ETA = rank-distance gap / speed, clamped to [minEtaMs, Use.life]. */
  minEtaMs: 300,
  rocketSpeed: 100,
  flyerSpeed: 60,
  /** Banana: dropped this far behind the kart. */
  bananaDropDistance: 4,
  /** Water bomb: position + velocity × lead + forward × distance. */
  waterBombLeadMs: 1000,
  waterBombForwardDistance: 20,
  ufoDriveFactor: 0.4,
  ufoDragFactor: 2,
  thunderboltScale: 0.6,
  thunderboltDriveFactor: 0.5,
  /** Trapped karts shorten the trap by this much per left/right press, down to the minimum. */
  trapEscapePressMs: 120,
  trapMinimumMs: 500,
  /** Re-eating the same cube within this window (no other cube between) grants nothing. */
  cubeAbuseWindowMs: 10_000,
  /** A track hazard re-arms for the same kart after this long. */
  hazardCooldownMs: 3_000,
  /** Kart parameter default `ItemBoosterTime`; the kart's own value wins at runtime. */
  itemBoosterTimeMs: 3_000,
  /** Kart parameter defaults `AnimalBoosterTime` / `SuperBoosterTime` (body-param.ts:88-89). */
  animalBoosterTimeMs: 4_000,
  superBoosterTimeMs: 3_500,
  /** waterAngel: a quick escape ends the water trap after this long (C.2). */
  quickEscapeMs: 500,
  /** useTwoRocket: the second missile lands this much after the first (C.2). */
  doubleRocketDelayMs: 200,
  /** Siren: an opponent this close to the siren kart is knocked (touch, [还原]). */
  sirenTouchRadiusM: 3,
} as const;

export type ItemUseStyle = "instant" | "aim" | "drop" | "throw" | "attach" | "placed";
export type ItemTargetRule =
  | "self" | "team" | "placed" | "area" | "ahead" | "locked" | "first"
  | "random-ahead" | "opponents" | "all-ahead" | "all-behind";
export type ItemEffectKind =
  | "boost" | "spin" | "trap" | "launch" | "reverse" | "slow" | "shrink"
  | "barrier" | "pull" | "shield" | "angel" | "emp" | "cloud" | "scan" | "lock"
  | "hold" | "knockback" | "overlay" | "invincible" | "invisible" | "siren";

/**
 * Behaviour families (ITEM_MODE.md Appendix B and C.4): items of one family
 * share use flow, timeline and presentation shape; durations come from each
 * item's own base.
 */
export type ItemFamily =
  | "booster" | "banana" | "mine" | "waterMine" | "forceZone" | "oil"
  | "waterBomb" | "timeBomb" | "waterFly" | "waterbombFly" | "honeyBee"
  | "rocket" | "blindRocket" | "lionRocket" | "lockdownRocket" | "snowman"
  | "magnet" | "shield" | "superShield" | "angel" | "invincible" | "devil" | "ufo" | "emp"
  | "thunderbolt" | "barricade" | "cloud" | "scanning" | "slotLock" | "siren" | "ghost" | "talisman";

/** Screen covers of the special items (HUD `overlay.kind`). */
export type ItemOverlayKind =
  | "tiger" | "panther" | "delivery" | "dinoClaw" | "honey" | "oil" | "lion" | "darkCloud";

/** Which keys a reverse effect swaps: devil left/right, newDevil forward/back, Dr. R all. */
export type ItemReverseMode = "steering" | "forwardBack" | "all";

export type ItemBoosterKind = "item" | "animal" | "super";

/**
 * Behaviour of one item (spec Appendix B / C.4). Times count from the
 * server's `startAt`: the effect's warning starts at `startAt + delayMs`
 * (projectiles use their ETA, at most `maxEtaMs`), and the effect itself
 * starts `warningMs` later and lasts `effectMs`.
 */
export interface ItemBehaviour {
  readonly family: ItemFamily;
  readonly use: ItemUseStyle;
  readonly target: ItemTargetRule;
  readonly delayMs: number;
  readonly warningMs: number;
  /** Projectile flight cap (`Use.life`). */
  readonly maxEtaMs?: number;
  /** Projectile speed in track units per second, for the ETA. */
  readonly speed?: number;
  readonly effect: ItemEffectKind;
  readonly effectMs: number;
  /** Blue shield after a trap (`EscapeAffect.life`); absent when the item has none. */
  readonly escapeShieldMs?: number;
  /**
   * The trap's end opens the escape boost of UseExtendedAfterBooster karts:
   * the water-bomb / water-fly families that carry an `AfterBoost` state
   * (the infected bombs have none).
   */
  readonly afterBoost?: boolean;
  /** Trigger, blast or obstacle radius in track units. */
  readonly radius?: number;
  /** A dropped water mine triggers at its Set size (its `radius` is the blast). */
  readonly triggerRadius?: number;
  /** How long a placed object or area exists. */
  readonly lifetimeMs?: number;
  /** Barricade rise time (`StateSet.life`). */
  readonly riseMs?: number;
  /** Placement distance: barricade ahead of its target, banana behind, water bomb forward. */
  readonly distance?: number;
  readonly factors?: { readonly drive?: number; readonly drag?: number; readonly scale?: number };
  /** The shield blocks items whose item.bml has a Shield/StateShield/RocketShield state (not the UFO). */
  readonly shieldBlocks: boolean;
  /** The angel blocks every attack except the devil family, clouds, the slot lock and the UFO. */
  readonly angelBlocks: boolean;
  /** Only the time bombs also catch teammates (`avoidItemTeamKill` covers the rest). */
  readonly hitsTeammates: boolean;
  /** Booster physics of a self boost (booster, special booster, super shield). */
  readonly boosterKind?: ItemBoosterKind;
  /** Screen cover shown with the effect, for `overlayMs` (default `effectMs`). */
  readonly overlay?: ItemOverlayKind;
  readonly overlayMs?: number;
  readonly reverseMode?: ItemReverseMode;
  /** No incoming warning on the victim (lionMaskRocket, itemDescList.xml:1148). */
  readonly noWarning?: boolean;
  /** Items locked after the trap ends (infected bombs `PostAffect`, infectedWaterFly `AfterBoost`). */
  readonly postLockMs?: number;
  /** Items locked while the effect lasts (talisman). */
  readonly lockMs?: number;
  /** A one-hit shield that lasts `shieldMs` from the use (super shield, siren shield, gold magnet). */
  readonly shieldMs?: number;
  /** Lockdown field: `delayMs` after the hit, `radius`, `lifetimeMs`; other opponents get `effect`. */
  readonly field?: { readonly delayMs: number; readonly radius: number; readonly lifetimeMs: number;
    readonly effect: "slow"; readonly effectMs: number };
  /** waterbombFly: rides its target for `delayMs`, then bursts at `radius` (time bomb Set size). */
  readonly blast?: { readonly delayMs: number; readonly radius: number };
  /** Siren: opponents touching the user from `delayMs` for `lifetimeMs` spin `effectMs`. */
  readonly touch?: { readonly delayMs: number; readonly lifetimeMs: number; readonly radius: number;
    readonly effect: "spin"; readonly effectMs: number };
}

export interface ItemObjectDefinition {
  readonly name: string;
  readonly folder: string;
  readonly base: number;
  /** Base-`base` states of the folder's item.bml (empty for the boosters). */
  readonly states: ReadonlyMap<string, ItemState>;
  /** The whole parsed item.bml, all variants. */
  readonly bml?: ItemBml;
}

export interface ItemDefinition extends ItemObjectDefinition {
  readonly idx: number;
  /** Chinese name and description from `etc_/itemDescList.xml`; `|` marks a line break. */
  readonly title: string;
  readonly description: string;
  readonly behaviour: ItemBehaviour;
}

export interface ItemCatalog {
  readonly items: readonly ItemDefinition[];
  readonly cube: ItemObjectDefinition;
  /** Equipment passives (`etc_/itemTable.kml` + `@cn`), loaded with the catalog. */
  readonly passives?: ItemPassiveTable;
  /** Special booster rows per kart (`item/slot/animalBooster.bml` + `@cn`). */
  readonly animalBoosters?: ReadonlyMap<number, AnimalBoosterRow>;
  get(idx: number): ItemDefinition | undefined;
  byName(name: string): ItemDefinition | undefined;
  /** Canonical model paths in priority order. */
  modelCandidates(definition: ItemObjectDefinition, stem: string): string[];
  /** Canonical sound paths in priority order, including the spec's fallbacks. */
  soundCandidates(definition: ItemObjectDefinition, stem: string): string[];
  /** First candidate that exists in the loaded library. */
  resolveModel(definition: ItemObjectDefinition, stem: string): string | undefined;
  resolveSound(definition: ItemObjectDefinition, stem: string): string | undefined;
  slotIcon(idx: number): string;
  smallIcon(idx: number): string;
  noticeIcon(idx: number): string;
  has(path: string): boolean;
}

export interface ItemCatalogEntry {
  absenceAuthoritative?: boolean;
  bytes(): Promise<Uint8Array>;
}

/** The resource-lookup subset the catalog needs (`Sw.exactCanonicalCandidates`). */
export interface ItemCatalogLibrary {
  exactCanonicalCandidates(path: string): ItemCatalogEntry[];
}

export function itemModelCandidates(definition: Pick<ItemObjectDefinition, "folder">, stem: string): string[] {
  const own = `item/${definition.folder}/${stem}.1s`;
  const common = `item/common/${stem}.1s`;
  return own === common ? [own] : [own, common];
}

/** Missing original sounds and their stand-ins (spec Appendix B and C.4, last lines). */
export const ITEM_SOUND_FALLBACKS: Readonly<Record<string, string>> = {
  "devil/trapped": "waterBomb/trapped",
  "waterFly/trapped": "waterBomb/trapped",
  "barricade/shield": "shield/shield",
  "snowWaterFly/trapped": "waterBomb/trapped",
  "infectedWaterFly/trapped": "waterBomb/trapped",
  "waterbombFly/trapped": "waterBomb/trapped",
  "drmad/trapped": "waterBomb/trapped",
  "newDevil/trapped": "waterBomb/trapped",
  "oil/eat": "banana/eat",
  "oil/firing": "banana/firing",
  "abyssBarricade/shield": "shield/shield",
  "talisman/shield": "shield/shield",
};

export function itemSoundCandidates(definition: Pick<ItemObjectDefinition, "folder">, stem: string): string[] {
  const base = `sound_/fx/item/${definition.folder}/${stem}`;
  const candidates = [`${base}.ogg`, `${base}.flac`];
  const fallback = ITEM_SOUND_FALLBACKS[`${definition.folder}/${stem}`];
  if (fallback) candidates.push(`sound_/fx/item/${fallback}.ogg`, `sound_/fx/item/${fallback}.flac`);
  return candidates;
}

export const itemSlotIcon = (idx: number): string => `item/slot/item${idx}.png`;
export const itemSmallIcon = (idx: number): string => `item/slot/item_s${idx}.png`;
export const itemNoticeIcon = (idx: number): string => `item/itemStateNotice/item${idx}.png`;
/** The special booster's per-kart slot icon (`animalBooster` iconId). */
export const animalSlotIcon = (iconId: number): string => `item/slot/animal${iconId}.png`;

/** Read `<k n=…><m c='cn' v=…/></k>` rows of a StringBag. */
export function stringBagTexts(root: ItemXmlNode, language = "cn"): Map<string, string> {
  if (root.name !== "StringBag") throw Error("道具说明必须是 StringBag。");
  const texts = new Map<string, string>();
  for (const key of root.children) {
    if (key.name !== "k") continue;
    const name = key.attributes.find(attribute => attribute.name === "n")?.value;
    const message = key.children.find(child => child.name === "m" &&
      child.attributes.some(attribute => attribute.name === "c" && attribute.value === language));
    const value = message?.attributes.find(attribute => attribute.name === "v")?.value;
    if (name && value) texts.set(name, value);
  }
  return texts;
}

/**
 * Names the CN list leaves empty or lacks ([还原]): randomRocket (KR 랜덤 미사일),
 * infectedWaterFly (KR 독성물파리, like 毒性水炸弹), foxTailRocket (KR 여우꼬리
 * 미사일) and talisman (only `talisman_desc` exists; spec C.4 calls it 符咒).
 */
const TITLE_FALLBACKS: Readonly<Record<string, string>> = {
  randomRocket: "随机导弹",
  infectedWaterFly: "毒性水苍蝇",
  foxTailRocket: "狐尾导弹",
  talisman: "符咒",
};

function requireState(name: string, states: ReadonlyMap<string, ItemState>, state: string): ItemState {
  const value = states.get(state);
  if (!value) throw Error(`${name} item.bml 缺少 ${state} 状态。`);
  return value;
}

function requireSize(name: string, states: ReadonlyMap<string, ItemState>, state: string): number {
  const size = requireState(name, states, state).size;
  if (size === undefined) throw Error(`${name} item.bml ${state} 缺少 size。`);
  return size;
}

const SHIELD_STATES = ["Shield", "StateShield", "RocketShield"];
/**
 * Attacks the angel does not stop: the devil family and the clouds (tip.xml:27),
 * the slot lock, and the UFO, which only EMP can clear (tip.xml:28,
 * bonusStageProperty@tw.xml:53).
 */
const ANGEL_EXEMPT = new Set(["devil", "newDevil", "drrMine", "cloud2", "darkCloud", "darkCloud2",
  "slotLock", "ufo"]);
/** The UFO has a Shield state, but neither the shield nor the angel stops it (Appendix B). */
const SHIELD_EXEMPT = new Set(["ufo"]);

const BLIND_ROCKET_OVERLAYS: Readonly<Record<string, ItemOverlayKind>> = {
  tigerRocket: "tiger", pantherRocket: "panther", deliveryRocket: "delivery", dinoClawRocket: "dinoClaw",
};

export interface ItemBehaviourOptions {
  itemBoosterTimeMs?: number;
  /** Base states of another registered item (waterbombFly bursts like the time bomb). */
  statesOf?(name: string): ReadonlyMap<string, ItemState> | undefined;
}

/**
 * Derive the behaviour of one item from its base states. Durations come from
 * item.bml as ITEM_MODE.md Appendix B / C.4 prescribe; the rest is ITEM_RULES.
 */
export function itemBehaviour(name: string, states: ReadonlyMap<string, ItemState>,
  options: number | ItemBehaviourOptions = {}): ItemBehaviour {
  const { itemBoosterTimeMs = ITEM_RULES.itemBoosterTimeMs, statesOf } =
    typeof options === "number" ? { itemBoosterTimeMs: options, statesOf: undefined } : options;
  const life = (state: string) => requireState(name, states, state).lifeMs;
  const optionalLife = (state: string) => states.get(state)?.lifeMs;
  const size = (state: string) => requireSize(name, states, state);
  type Shape = Omit<ItemBehaviour, "shieldBlocks" | "angelBlocks" | "hitsTeammates" | "warningMs"> &
    { warningMs?: number; hitsTeammates?: boolean };
  const attack = (shape: Shape): ItemBehaviour => ({
    warningMs: 0,
    ...shape,
    shieldBlocks: !SHIELD_EXEMPT.has(name) && SHIELD_STATES.some(state => states.has(state)),
    angelBlocks: !ANGEL_EXEMPT.has(name),
    hitsTeammates: shape.hitsTeammates ?? false,
  });
  const own = (shape: Omit<Shape, "delayMs"> & { delayMs?: number }): ItemBehaviour => ({
    delayMs: 0, warningMs: 0, ...shape, shieldBlocks: false, angelBlocks: false, hitsTeammates: false,
  });
  const ufoFactors = { drive: ITEM_RULES.ufoDriveFactor, drag: ITEM_RULES.ufoDragFactor };
  const missile = (family: ItemFamily, target: ItemTargetRule, use: ItemUseStyle,
    effect: Pick<ItemBehaviour, "effect" | "effectMs"> & Partial<ItemBehaviour>) => attack({
    family, use, target, delayMs: 0, maxEtaMs: life("Use"), speed: ITEM_RULES.rocketSpeed, ...effect,
  });
  const throwBomb = (family: "waterBomb" | "timeBomb") => attack({
    family, use: family === "timeBomb" ? "attach" : "throw", target: "area", delayMs: life("Use"),
    effect: "trap", effectMs: life("Affect"), radius: size("Set"), lifetimeMs: life("Set"),
    ...(states.has("EscapeAffect") ? { escapeShieldMs: life("EscapeAffect") } : {}),
    afterBoost: states.has("AfterBoost"),
    ...(optionalLife("PostAffect") ? { postLockMs: life("PostAffect") } : {}),
    ...(family === "waterBomb" ? { distance: ITEM_RULES.waterBombForwardDistance } : { hitsTeammates: true }),
  });
  const fly = () => attack({
    family: "waterFly", use: "instant", target: "ahead", delayMs: 0, maxEtaMs: life("Use"),
    speed: ITEM_RULES.flyerSpeed, effect: "trap", effectMs: life("Affect"),
    escapeShieldMs: life("EscapeAffect"), afterBoost: states.has("AfterBoost"),
    // infectedWaterFly: its AfterBoost (녹색열쇠, `locked`) is the item lock after the bubble.
    ...(optionalLife("AfterBoost") ? { postLockMs: life("AfterBoost") } : {}),
  });
  const dropped = (family: ItemFamily, effect: Pick<ItemBehaviour, "effect" | "effectMs"> &
    Partial<ItemBehaviour>) => attack({
    family, use: "drop", target: "placed", delayMs: life("Use"), radius: size("Set"),
    lifetimeMs: life("Set"), distance: ITEM_RULES.bananaDropDistance, ...effect,
  });
  const curse = (reverseMode: ItemReverseMode) => attack({
    family: "devil", use: "instant", target: "opponents", delayMs: life("Use"),
    warningMs: life("Preaffect"), effect: "reverse", effectMs: life("Affect"), reverseMode,
  });
  const barricade = () => attack({
    family: "barricade", use: "instant", target: "first", delayMs: life("StateUse"),
    distance: size("StateUse"), riseMs: life("StateSet"), lifetimeMs: life("StateActive"),
    radius: size("StateActive"), effect: "barrier", effectMs: life("StateAffect"),
  });
  const cloud = (overlay?: ItemOverlayKind) => attack({
    family: "cloud", use: "instant", target: "all-behind", delayMs: life("Use"),
    effect: "cloud", effectMs: life("Set"), ...(overlay ? { overlay } : {}),
  });
  switch (name) {
    case "booster":
    case "teamBooster":
      return own({ family: "booster", use: "instant", target: "self", effect: "boost",
        effectMs: itemBoosterTimeMs, boosterKind: "item" });
    case "animalBooster":
      return own({ family: "booster", use: "instant", target: "self", effect: "boost",
        effectMs: ITEM_RULES.animalBoosterTimeMs, boosterKind: "animal" });
    case "superShield":
      // shield base 1 (`GoldS`): a 3000 ms shield, and the super booster (C.4).
      return own({ family: "superShield", use: "instant", target: "self", effect: "shield",
        effectMs: life("Use"), shieldMs: life("Use"), boosterKind: "super" });
    case "banana":
    case "bigBanana":
      return dropped("banana", { effect: "spin", effectMs: life("Affect") });
    case "mine":
    case "duckMine":
    case "eggMine":
    case "goldEggMine":
    case "springMine":
    case "cogWheelMine":
      return dropped("mine", { effect: "launch", effectMs: life("Affect") });
    case "waterMine":
      // Track water mines trap everyone inside the explosion radius; a dropped one triggers at Set size.
      return dropped("waterMine", { effect: "trap", effectMs: life("Affect"),
        escapeShieldMs: life("EscapeAffect"), afterBoost: states.has("AfterBoost"),
        radius: size("Explode"), triggerRadius: size("Set") });
    case "forceZone":
      return dropped("forceZone", { effect: "knockback", effectMs: life("Affect") });
    case "oil":
      return dropped("oil", { effect: "overlay", effectMs: life("Affect"), overlay: "oil" });
    case "waterBomb":
    case "snowBomb":
    case "cokeBomb":
    case "prisonBomb":
    case "infectedBomb":
    case "pumpkinBomb":
      return throwBomb("waterBomb");
    case "timeBomb":
    case "timeCokeBomb":
    case "timeSnowBomb":
    case "timeInfectedBomb":
      return throwBomb("timeBomb");
    case "waterFly":
    case "snowWaterFly":
    case "infectedWaterFly":
      return fly();
    case "waterbombFly": {
      // It rides its target for CountDown, then bursts like the time bomb (its
      // Set size and Affect life); the trapped get this item's EscapeAffect.
      const timeBomb = statesOf?.("timeBomb");
      if (!timeBomb) throw Error("waterbombFly 需要 timeBomb 的状态。");
      return attack({ family: "waterbombFly", use: "instant", target: "ahead", delayMs: 0,
        maxEtaMs: life("Use"), speed: ITEM_RULES.flyerSpeed, effect: "trap",
        effectMs: requireState("timeBomb", timeBomb, "Affect").lifeMs,
        escapeShieldMs: life("EscapeAffect"), afterBoost: states.has("AfterBoost"),
        blast: { delayMs: life("CountDown"), radius: requireSize("timeBomb", timeBomb, "Set") } });
    }
    case "honeyBee":
      return attack({ family: "honeyBee", use: "instant", target: "ahead", delayMs: 0,
        maxEtaMs: life("Use"), speed: ITEM_RULES.flyerSpeed, effect: "slow",
        effectMs: life("Affect"), factors: ufoFactors, overlay: "honey" });
    case "rocket":
    case "goldRocket":
    case "candyRocket":
    case "dinoEggRocket":
    case "foxTailRocket":
    case "cokeRocket":
      return missile("rocket", "locked", "aim", { effect: "launch", effectMs: life("Affect") });
    case "guideRocket":
      return missile("rocket", "first", "instant", { effect: "launch", effectMs: life("Affect") });
    case "randomRocket":
      return missile("rocket", "random-ahead", "instant", { effect: "launch", effectMs: life("Affect") });
    case "tigerRocket":
    case "pantherRocket":
    case "deliveryRocket":
    case "dinoClawRocket":
      return missile("blindRocket", "locked", "aim", { effect: "slow", effectMs: life("Affect"),
        factors: ufoFactors, overlay: BLIND_ROCKET_OVERLAYS[name]! });
    case "lionMaskRocket":
      return missile("lionRocket", "locked", "aim", { effect: "spin", effectMs: life("Affect"),
        overlay: "lion", noWarning: true });
    case "lockdownRocket":
    case "blockRocket":
      return missile("lockdownRocket", "locked", "aim", { effect: "hold", effectMs: life("AffectMain"),
        field: { delayMs: life("CountDown"), radius: size("SetEmp"), lifetimeMs: life("SetEmp"),
          effect: "slow", effectMs: life("AffectSub") } });
    case "snowman":
      return missile("snowman", "locked", "aim", { effect: "shrink", effectMs: life("Affect"),
        factors: { scale: ITEM_RULES.thunderboltScale } });
    case "magnet":
      return own({ family: "magnet", use: "aim", target: "locked", effect: "pull", effectMs: life("Use") });
    case "superMagnet":
      return own({ family: "magnet", use: "aim", target: "locked", effect: "pull", effectMs: life("Use"),
        shieldMs: life("Use") });
    case "shield":
      return own({ family: "shield", use: "instant", target: "self", effect: "shield", effectMs: life("Use") });
    case "goldShield":
    case "protectShield":
      return own({ family: "invincible", use: "instant", target: "self", delayMs: life("Use"),
        effect: "invincible", effectMs: life("Affect") });
    case "angel":
      return own({ family: "angel", use: "instant", target: "team", delayMs: life("Use"),
        effect: "angel", effectMs: life("Affect") });
    case "devil":
      return curse("steering");
    case "newDevil":
      return curse("forwardBack");
    case "drrMine":
      return curse("all");
    case "ufo":
      return attack({ family: "ufo", use: "instant", target: "first", delayMs: 0, maxEtaMs: life("Use"),
        speed: ITEM_RULES.flyerSpeed, effect: "slow", effectMs: life("Affect"), factors: ufoFactors });
    case "emp":
      // Team-wide, from the end of Use; it only clears a UFO slow that is running (C.1).
      return own({ family: "emp", use: "instant", target: "team", delayMs: life("Use"), effect: "emp",
        effectMs: life("Affect") });
    case "thunderbolt":
      return attack({ family: "thunderbolt", use: "instant", target: "all-ahead", delayMs: life("Use"),
        warningMs: life("Warning") + life("Preaffect"), effect: "shrink", effectMs: life("Affect"),
        factors: { scale: ITEM_RULES.thunderboltScale, drive: ITEM_RULES.thunderboltDriveFactor } });
    case "barricade":
    case "abyssBarricade":
      return barricade();
    case "cloud2":
      return cloud();
    case "darkCloud":
    case "darkCloud2":
      return cloud("darkCloud");
    case "scanning":
      return own({ family: "scanning", use: "instant", target: "team", delayMs: life("Use"),
        effect: "scan", effectMs: life("Affect") });
    case "slotLock":
      return attack({ family: "slotLock", use: "instant", target: "opponents", delayMs: life("Use"),
        effect: "lock", effectMs: life("Affect") + life("Postaffect") });
    case "siren":
      return attack({ family: "siren", use: "instant", target: "self", delayMs: 0, effect: "siren",
        effectMs: life("Use"), boosterKind: "item",
        touch: { delayMs: 0, lifetimeMs: life("Use"), radius: ITEM_RULES.sirenTouchRadiusM,
          effect: "spin", effectMs: life("Affect") } });
    case "sirenShield":
      return attack({ family: "siren", use: "instant", target: "self", delayMs: 0, effect: "siren",
        effectMs: life("Use") + life("Siren"), boosterKind: "item", shieldMs: life("Use") + life("Siren"),
        touch: { delayMs: life("Use"), lifetimeMs: life("Siren"), radius: ITEM_RULES.sirenTouchRadiusM,
          effect: "spin", effectMs: life("Affect") } });
    case "tigerGhost":
      return own({ family: "ghost", use: "instant", target: "self", delayMs: life("Use"),
        effect: "invisible", effectMs: life("Affect") });
    case "talisman":
      return attack({ family: "talisman", use: "instant", target: "first", delayMs: 0,
        maxEtaMs: life("Use"), speed: ITEM_RULES.rocketSpeed, effect: "hold", effectMs: life("Affect"),
        lockMs: life("Affect"), escapeShieldMs: life("EscapeAffect") });
    default:
      throw Error(`道具 ${name} 尚无行为定义。`);
  }
}

async function uniqueBytes(library: ItemCatalogLibrary, path: string): Promise<Uint8Array> {
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length !== 1 || candidates[0]!.absenceAuthoritative !== true)
    throw Error(`${path} 需要唯一完整原件。`);
  return candidates[0]!.bytes();
}

/** Parse `item/<folder>/item.bml` bytes (binary XML). */
export function decodeItemBml(bytes: Uint8Array): ItemBml {
  return parseItemBml(decodeBinaryXml(bytes));
}

function baseStates(bml: ItemBml, base: number, folder: string): ReadonlyMap<string, ItemState> {
  const variant = bml.bases[base];
  if (!variant) throw Error(`item/${folder}/item.bml 缺少 base ${base}。`);
  return variant.states;
}

export interface ItemCatalogExtras {
  passives?: ItemPassiveTable;
  animalBoosters?: ReadonlyMap<number, AnimalBoosterRow>;
}

/** Build the catalog from parsed definitions, descriptions and a path existence probe. */
export function createItemCatalog(
  definitions: ReadonlyMap<string, ItemBml>,
  texts: ReadonlyMap<string, string>,
  exists: (path: string) => boolean,
  extras: ItemCatalogExtras = {},
): ItemCatalog {
  const cubeBml = definitions.get(ITEM_CUBE_ENTRY.folder);
  if (!cubeBml) throw Error("道具目录缺少 item/itemCube/item.bml。");
  const cube: ItemObjectDefinition = { ...ITEM_CUBE_ENTRY,
    states: baseStates(cubeBml, ITEM_CUBE_ENTRY.base, ITEM_CUBE_ENTRY.folder), bml: cubeBml };
  const resolved = ITEM_REGISTRY.map(entry => {
    const bml = entry.definition ? definitions.get(entry.folder) : undefined;
    if (entry.definition && !bml) throw Error(`道具目录缺少 item/${entry.folder}/item.bml。`);
    const states = bml ? baseStates(bml, entry.base, entry.folder) : new Map<string, ItemState>();
    return { entry, bml, states };
  });
  const statesByName = new Map(resolved.map(({ entry, states }) => [entry.name, states]));
  const items = resolved.map(({ entry, bml, states }) => {
    const definition: ItemDefinition = {
      idx: entry.idx, name: entry.name, folder: entry.folder, base: entry.base,
      title: texts.get(entry.name) || TITLE_FALLBACKS[entry.name] || entry.name,
      description: texts.get(`${entry.name}_desc`) ?? "",
      states, bml, behaviour: itemBehaviour(entry.name, states, { statesOf: name => statesByName.get(name) }),
    };
    return definition;
  });
  const byIdx = new Map(items.map(item => [item.idx, item]));
  const byName = new Map(items.map(item => [item.name, item]));
  const first = (paths: string[]) => paths.find(exists);
  return {
    items,
    cube,
    ...(extras.passives ? { passives: extras.passives } : {}),
    ...(extras.animalBoosters ? { animalBoosters: extras.animalBoosters } : {}),
    get: idx => byIdx.get(idx),
    byName: name => byName.get(name),
    modelCandidates: itemModelCandidates,
    soundCandidates: itemSoundCandidates,
    resolveModel: (definition, stem) => first(itemModelCandidates(definition, stem)),
    resolveSound: (definition, stem) => first(itemSoundCandidates(definition, stem)),
    slotIcon: itemSlotIcon,
    smallIcon: itemSmallIcon,
    noticeIcon: itemNoticeIcon,
    has: exists,
  };
}

/**
 * Load every registered item.bml, the cube definition, the CN descriptions,
 * and the race tables the item race reads with them: the equipment passives
 * (`etc_/itemTable.kml` + `@cn`) and the special booster icons.
 */
export async function loadItemCatalog(library: ItemCatalogLibrary): Promise<ItemCatalog> {
  const folders = [...new Set([ITEM_CUBE_ENTRY.folder,
    ...ITEM_REGISTRY.filter(entry => entry.definition).map(entry => entry.folder)])];
  const [definitions, descriptions, passives, animalBoosters] = await Promise.all([
    Promise.all(folders.map(async folder =>
      [folder, decodeItemBml(await uniqueBytes(library, `item/${folder}/item.bml`))] as const)),
    uniqueBytes(library, "etc_/itemDescList.xml"),
    loadItemPassiveTable(library),
    loadAnimalBoosterTable(library),
  ]);
  const texts = stringBagTexts(parseResourceXml(descriptions).root);
  return createItemCatalog(new Map(definitions), texts,
    path => library.exactCanonicalCandidates(path).length > 0, { passives, animalBoosters });
}
