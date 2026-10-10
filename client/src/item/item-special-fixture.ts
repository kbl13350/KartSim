import { parseResourceXml } from "../resources/xml-utf16-parser";
import {
  decodeItemBml, itemModelCandidates, stringBagTexts,
  type ItemBehaviour, type ItemBml, type ItemCatalog, type ItemCatalogLibrary, type ItemDefinition,
  type ItemState,
} from "./item-catalog";

/**
 * The 49 special items of ITEM_MODE.md C.4 (idx, name, item.rho folder,
 * variant base) as the phase-3 research registry gives them
 * (`special-item-registry.json`; cokeRocketWorldCup has no idx and is left
 * out). The item catalog owns the authoritative registry and the behaviours;
 * this list only lets the presenter tests and the dev preview stage every
 * special item on the real data before (or without) that registry:
 * `withSpecialItems` adds the rows a catalog does not have yet.
 */
export const SPECIAL_ITEM_ROWS: ReadonlyArray<{ idx: number; name: string; folder: string; base: number }> = [
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
  { idx: 31, name: "animalBooster", folder: "booster", base: 0 },
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

/** Missing original sounds of the special items and their stand-ins (ITEM_MODE.md C.4). */
export const SPECIAL_SOUND_FALLBACKS: Readonly<Record<string, string>> = {
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

/** Placeholder behaviour: the presenter reads states, never this. */
const PRESENTER_ONLY: ItemBehaviour = Object.freeze({
  family: "booster", use: "instant", target: "self", delayMs: 0, warningMs: 0, effect: "boost", effectMs: 0,
  shieldBlocks: false, angelBlocks: false, hitsTeammates: false,
});

async function unique(library: ItemCatalogLibrary, path: string): Promise<Uint8Array> {
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length !== 1) throw Error(`${path} 需要唯一原件。`);
  return candidates[0]!.bytes();
}

/** A catalog with every special item the given one does not register yet. */
export async function withSpecialItems(catalog: ItemCatalog, library: ItemCatalogLibrary): Promise<ItemCatalog> {
  const missing = SPECIAL_ITEM_ROWS.filter(row => !catalog.get(row.idx));
  if (missing.length === 0) return catalog;
  const texts = stringBagTexts(parseResourceXml(await unique(library, "etc_/itemDescList.xml")).root);
  const bmls = new Map<string, ItemBml>();
  for (const folder of new Set(missing.map(row => row.folder))) {
    if (folder === "booster") continue;
    bmls.set(folder, decodeItemBml(await unique(library, `item/${folder}/item.bml`)));
  }
  const added: ItemDefinition[] = missing.map(row => {
    const bml = bmls.get(row.folder);
    const states: ReadonlyMap<string, ItemState> = bml
      ? bml.bases[row.base]?.states ?? (() => { throw Error(`item/${row.folder}/item.bml 缺少 base ${row.base}。`); })()
      : new Map();
    return { idx: row.idx, name: row.name, folder: row.folder, base: row.base,
      title: texts.get(row.name) ?? row.name, description: texts.get(`${row.name}_desc`) ?? "",
      states, bml, behaviour: PRESENTER_ONLY };
  });
  const items = [...catalog.items, ...added];
  const byIdx = new Map(items.map(item => [item.idx, item]));
  const sounds = (definition: Pick<ItemDefinition, "folder">, stem: string) => {
    const candidates = catalog.soundCandidates(definition as ItemDefinition, stem);
    const fallback = SPECIAL_SOUND_FALLBACKS[`${definition.folder}/${stem}`];
    if (fallback) candidates.push(`sound_/fx/item/${fallback}.ogg`, `sound_/fx/item/${fallback}.flac`);
    return candidates;
  };
  return {
    ...catalog,
    items,
    get: idx => byIdx.get(idx),
    byName: name => items.find(item => item.name === name),
    soundCandidates: sounds,
    resolveModel: (definition, stem) => itemModelCandidates(definition, stem).find(path => catalog.has(path)),
    resolveSound: (definition, stem) => sounds(definition, stem).find(path => catalog.has(path)),
  };
}

