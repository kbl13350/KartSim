import { decodeBinaryXml } from "../codecs/binary-xml";
import { parseResourceXml } from "../resources/xml-utf16-parser";
import { parseItemBml, type ItemBml, type ItemState, type ItemXmlNode } from "./item-bml";

export type { ItemBase, ItemBml, ItemState } from "./item-bml";

/**
 * Original item indices. They name the slot icons (`item/slot/item<idx>.png`),
 * the probability rows (`itemProb_*`) and the HUD notices. Anchors come from
 * `item/slot/itemProb_*@zz.bml`; 14 is the release's team booster constant.
 */
export const ItemIdx = {
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
  guideRocket: 33,
  waterMine: 37,
  scanning: 109,
  slotLock: 110,
  thunderbolt: 111,
  barricade: 113,
  cloud2: 114,
  randomRocket: 127,
} as const;

export interface ItemRegistryEntry {
  readonly idx: number;
  readonly name: string;
  /** Folder under `item/` (models, item.bml) and `sound_/fx/item/` (sounds). */
  readonly folder: string;
  /** Variant inside the folder's item.bml; the item race uses base 0 throughout. */
  readonly base: number;
  /** Booster and team booster have sounds but no item.rho definition. */
  readonly definition: boolean;
}

/**
 * The classic item-race set (spec Appendix B), plus the team booster and the
 * track-placed mine and water mine. guideRocket and randomRocket have no folder
 * of their own and reuse the rocket resources.
 */
export const ITEM_REGISTRY: readonly ItemRegistryEntry[] = [
  { idx: ItemIdx.devil, name: "devil", folder: "devil", base: 0, definition: true },
  { idx: ItemIdx.ufo, name: "ufo", folder: "ufo", base: 0, definition: true },
  { idx: ItemIdx.waterFly, name: "waterFly", folder: "waterFly", base: 0, definition: true },
  { idx: ItemIdx.magnet, name: "magnet", folder: "magnet", base: 0, definition: true },
  { idx: ItemIdx.booster, name: "booster", folder: "booster", base: 0, definition: false },
  { idx: ItemIdx.rocket, name: "rocket", folder: "rocket", base: 0, definition: true },
  { idx: ItemIdx.banana, name: "banana", folder: "banana", base: 0, definition: true },
  { idx: ItemIdx.waterBomb, name: "waterBomb", folder: "waterBomb", base: 0, definition: true },
  { idx: ItemIdx.shield, name: "shield", folder: "shield", base: 0, definition: true },
  { idx: ItemIdx.angel, name: "angel", folder: "angel", base: 0, definition: true },
  { idx: ItemIdx.emp, name: "emp", folder: "emp", base: 0, definition: true },
  { idx: ItemIdx.timeBomb, name: "timeBomb", folder: "timeBomb", base: 0, definition: true },
  { idx: ItemIdx.teamBooster, name: "teamBooster", folder: "booster", base: 0, definition: false },
  { idx: ItemIdx.mine, name: "mine", folder: "mine", base: 0, definition: true },
  { idx: ItemIdx.guideRocket, name: "guideRocket", folder: "rocket", base: 0, definition: true },
  { idx: ItemIdx.waterMine, name: "waterMine", folder: "waterMine", base: 0, definition: true },
  { idx: ItemIdx.scanning, name: "scanning", folder: "scanning", base: 0, definition: true },
  { idx: ItemIdx.slotLock, name: "slotLock", folder: "slotLock", base: 0, definition: true },
  { idx: ItemIdx.thunderbolt, name: "thunderbolt", folder: "thunderbolt", base: 0, definition: true },
  { idx: ItemIdx.barricade, name: "barricade", folder: "barricade", base: 0, definition: true },
  { idx: ItemIdx.cloud2, name: "cloud2", folder: "cloud2", base: 0, definition: true },
  { idx: ItemIdx.randomRocket, name: "randomRocket", folder: "rocket", base: 0, definition: true },
];

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
} as const;

export type ItemUseStyle = "instant" | "aim" | "drop" | "throw" | "attach" | "placed";
export type ItemTargetRule =
  | "self" | "team" | "placed" | "area" | "ahead" | "locked" | "first"
  | "random-ahead" | "opponents" | "all-ahead" | "all-behind";
export type ItemEffectKind =
  | "boost" | "spin" | "trap" | "launch" | "reverse" | "slow" | "shrink"
  | "barrier" | "pull" | "shield" | "angel" | "emp" | "cloud" | "scan" | "lock";

/**
 * Behaviour of one item (spec Appendix B). Times count from the server's
 * `startAt`: the effect's warning starts at `startAt + delayMs` (projectiles
 * use their ETA, at most `maxEtaMs`), and the effect itself starts `warningMs`
 * later and lasts `effectMs`.
 */
export interface ItemBehaviour {
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
  /** Blue shield after a trap (`EscapeAffect.life`). */
  readonly escapeShieldMs?: number;
  /** Trigger, blast or obstacle radius in track units. */
  readonly radius?: number;
  /** How long a placed object or area exists. */
  readonly lifetimeMs?: number;
  /** Barricade rise time (`StateSet.life`). */
  readonly riseMs?: number;
  /** Placement distance: barricade ahead of its target, banana behind, water bomb forward. */
  readonly distance?: number;
  readonly factors?: { readonly drive?: number; readonly drag?: number; readonly scale?: number };
  /** The shield blocks items whose item.bml has a Shield/StateShield/RocketShield state. */
  readonly shieldBlocks: boolean;
  /** The angel blocks every attack except devil, cloud and slot lock. */
  readonly angelBlocks: boolean;
  /** Only the time bomb also catches teammates (`avoidItemTeamKill` covers the rest). */
  readonly hitsTeammates: boolean;
}

export interface ItemObjectDefinition {
  readonly name: string;
  readonly folder: string;
  readonly base: number;
  /** Base-`base` states of the folder's item.bml (empty for booster/teamBooster). */
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

/** Missing original sounds and their stand-ins (spec Appendix B, last line). */
export const ITEM_SOUND_FALLBACKS: Readonly<Record<string, string>> = {
  "devil/trapped": "waterBomb/trapped",
  "waterFly/trapped": "waterBomb/trapped",
  "barricade/shield": "shield/shield",
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

/** The CN list leaves randomRocket's name empty (KR 랜덤 미사일). */
const TITLE_FALLBACKS: Readonly<Record<string, string>> = { randomRocket: "随机导弹" };

function requireState(name: string, states: ReadonlyMap<string, ItemState>, state: string): ItemState {
  const value = states.get(state);
  if (!value) throw Error(`${name} item.bml base 0 缺少 ${state} 状态。`);
  return value;
}

function requireSize(name: string, states: ReadonlyMap<string, ItemState>, state: string): number {
  const size = requireState(name, states, state).size;
  if (size === undefined) throw Error(`${name} item.bml ${state} 缺少 size。`);
  return size;
}

const SHIELD_STATES = ["Shield", "StateShield", "RocketShield"];
const ANGEL_EXEMPT = new Set(["devil", "cloud2", "slotLock"]);

/**
 * Derive the behaviour of one item from its base-0 states. Durations come from
 * item.bml as ITEM_MODE.md Appendix B prescribes; the rest is ITEM_RULES.
 */
export function itemBehaviour(name: string, states: ReadonlyMap<string, ItemState>,
  itemBoosterTimeMs: number = ITEM_RULES.itemBoosterTimeMs): ItemBehaviour {
  const life = (state: string) => requireState(name, states, state).lifeMs;
  const size = (state: string) => requireSize(name, states, state);
  const attack = (shape: Omit<ItemBehaviour, "shieldBlocks" | "angelBlocks" | "hitsTeammates" | "warningMs"> &
    { warningMs?: number; hitsTeammates?: boolean }): ItemBehaviour => ({
    warningMs: 0,
    ...shape,
    shieldBlocks: SHIELD_STATES.some(state => states.has(state)),
    angelBlocks: !ANGEL_EXEMPT.has(name),
    hitsTeammates: shape.hitsTeammates ?? false,
  });
  const own = (shape: Omit<ItemBehaviour, "shieldBlocks" | "angelBlocks" | "hitsTeammates" | "warningMs" | "delayMs"> &
    { delayMs?: number }): ItemBehaviour => ({
    delayMs: 0, warningMs: 0, ...shape, shieldBlocks: false, angelBlocks: false, hitsTeammates: false,
  });
  const rocket = (target: ItemTargetRule, use: ItemUseStyle) => attack({
    use, target, delayMs: 0, maxEtaMs: life("Use"), speed: ITEM_RULES.rocketSpeed,
    effect: "launch", effectMs: life("Affect"),
  });
  switch (name) {
    case "booster":
    case "teamBooster":
      return own({ use: "instant", target: "self", effect: "boost", effectMs: itemBoosterTimeMs });
    case "banana":
      return attack({ use: "drop", target: "placed", delayMs: life("Use"), effect: "spin",
        effectMs: life("Affect"), radius: size("Set"), lifetimeMs: life("Set"),
        distance: ITEM_RULES.bananaDropDistance });
    case "waterBomb":
      return attack({ use: "throw", target: "area", delayMs: life("Use"), effect: "trap",
        effectMs: life("Affect"), escapeShieldMs: life("EscapeAffect"), radius: size("Set"),
        lifetimeMs: life("Set"), distance: ITEM_RULES.waterBombForwardDistance });
    case "waterFly":
      return attack({ use: "instant", target: "ahead", delayMs: 0, maxEtaMs: life("Use"),
        speed: ITEM_RULES.flyerSpeed, effect: "trap", effectMs: life("Affect"),
        escapeShieldMs: life("EscapeAffect") });
    case "rocket": return rocket("locked", "aim");
    case "guideRocket": return rocket("first", "instant");
    case "randomRocket": return rocket("random-ahead", "instant");
    case "magnet":
      return own({ use: "aim", target: "locked", effect: "pull", effectMs: life("Use") });
    case "shield":
      return own({ use: "instant", target: "self", effect: "shield", effectMs: life("Use") });
    case "angel":
      return own({ use: "instant", target: "team", effect: "angel", effectMs: life("Affect") });
    case "devil":
      return attack({ use: "instant", target: "opponents", delayMs: life("Use"),
        warningMs: life("Preaffect"), effect: "reverse", effectMs: life("Affect") });
    case "ufo":
      return attack({ use: "instant", target: "first", delayMs: 0, maxEtaMs: life("Use"),
        speed: ITEM_RULES.flyerSpeed, effect: "slow", effectMs: life("Affect"),
        factors: { drive: ITEM_RULES.ufoDriveFactor, drag: ITEM_RULES.ufoDragFactor } });
    case "emp":
      return own({ use: "instant", target: "self", effect: "emp", effectMs: life("Affect") });
    case "thunderbolt":
      return attack({ use: "instant", target: "all-ahead", delayMs: life("Use"),
        warningMs: life("Warning") + life("Preaffect"), effect: "shrink", effectMs: life("Affect"),
        factors: { scale: ITEM_RULES.thunderboltScale, drive: ITEM_RULES.thunderboltDriveFactor } });
    case "barricade":
      return attack({ use: "instant", target: "first", delayMs: life("StateUse"),
        distance: size("StateUse"), riseMs: life("StateSet"), lifetimeMs: life("StateActive"),
        radius: size("StateActive"), effect: "barrier", effectMs: life("StateAffect") });
    case "cloud2":
      return attack({ use: "instant", target: "all-behind", delayMs: life("Use"),
        effect: "cloud", effectMs: life("Set") });
    case "scanning":
      return own({ use: "instant", target: "team", effect: "scan", effectMs: life("Affect") });
    case "slotLock":
      return attack({ use: "instant", target: "opponents", delayMs: life("Use"),
        effect: "lock", effectMs: life("Affect") + life("Postaffect") });
    case "timeBomb":
      return attack({ use: "attach", target: "area", delayMs: life("Use"), effect: "trap",
        effectMs: life("Affect"), escapeShieldMs: life("EscapeAffect"), radius: size("Set"),
        lifetimeMs: life("Set"), hitsTeammates: true });
    case "mine":
      return attack({ use: "placed", target: "placed", delayMs: 0, effect: "launch",
        effectMs: life("Affect"), radius: size("Set"), lifetimeMs: life("Set") });
    case "waterMine":
      // Track water mines trap everyone inside the explosion radius.
      return attack({ use: "placed", target: "placed", delayMs: 0, effect: "trap",
        effectMs: life("Affect"), escapeShieldMs: life("EscapeAffect"), radius: size("Explode"),
        lifetimeMs: life("Set") });
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

/** Build the catalog from parsed definitions, descriptions and a path existence probe. */
export function createItemCatalog(
  definitions: ReadonlyMap<string, ItemBml>,
  texts: ReadonlyMap<string, string>,
  exists: (path: string) => boolean,
): ItemCatalog {
  const cubeBml = definitions.get(ITEM_CUBE_ENTRY.folder);
  if (!cubeBml) throw Error("道具目录缺少 item/itemCube/item.bml。");
  const cube: ItemObjectDefinition = { ...ITEM_CUBE_ENTRY,
    states: baseStates(cubeBml, ITEM_CUBE_ENTRY.base, ITEM_CUBE_ENTRY.folder), bml: cubeBml };
  const items = ITEM_REGISTRY.map(entry => {
    const bml = entry.definition ? definitions.get(entry.folder) : undefined;
    if (entry.definition && !bml) throw Error(`道具目录缺少 item/${entry.folder}/item.bml。`);
    const states = bml ? baseStates(bml, entry.base, entry.folder) : new Map<string, ItemState>();
    const definition: ItemDefinition = {
      idx: entry.idx, name: entry.name, folder: entry.folder, base: entry.base,
      title: texts.get(entry.name) || TITLE_FALLBACKS[entry.name] || entry.name,
      description: texts.get(`${entry.name}_desc`) ?? "",
      states, bml, behaviour: itemBehaviour(entry.name, states),
    };
    return definition;
  });
  const byIdx = new Map(items.map(item => [item.idx, item]));
  const byName = new Map(items.map(item => [item.name, item]));
  const first = (paths: string[]) => paths.find(exists);
  return {
    items,
    cube,
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

/** Load every registered item.bml, the cube definition and the CN descriptions. */
export async function loadItemCatalog(library: ItemCatalogLibrary): Promise<ItemCatalog> {
  const folders = [...new Set([ITEM_CUBE_ENTRY.folder,
    ...ITEM_REGISTRY.filter(entry => entry.definition).map(entry => entry.folder)])];
  const [definitions, descriptions] = await Promise.all([
    Promise.all(folders.map(async folder =>
      [folder, decodeItemBml(await uniqueBytes(library, `item/${folder}/item.bml`))] as const)),
    uniqueBytes(library, "etc_/itemDescList.xml"),
  ]);
  const texts = stringBagTexts(parseResourceXml(descriptions).root);
  return createItemCatalog(new Map(definitions), texts,
    path => library.exactCanonicalCandidates(path).length > 0);
}
