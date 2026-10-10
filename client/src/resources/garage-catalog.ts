import { normalizeCanonicalPath } from "./resource-lookup";
import type { GarageItemDefinition, GarageItemLibrary, GarageResource } from "./timeattack-items";
import { vehicleFolderName } from "./vehicle-identity";

export interface GarageCatalogDependencies {
  parseShopXml(text: string, path: string): Document;
  resolveModel(library: GarageCatalogLibrary, modelPath: string): Promise<{
    find(names: string[]): GarageResource | undefined;
  }>;
  legacyFamilies: unknown;
}

export interface GarageCatalogLibrary extends GarageItemLibrary {
  exactCanonicalCandidates(path: string): GarageResource[];
}

export interface GarageCatalogEntry {
  kind: string;
  itemId: number;
  path: string;
  title: string;
  internalId: string;
  systemKey?: string;
  identityClass: string;
  kartType?: number;
  engineGrade?: number;
  enchant?: boolean;
  defaultOpenSocket?: number;
  uniqueLevel?: number;
  vehicleRarityLevel?: number;
  textureKey?: string;
  orgColorId?: number;
  fixedPlateId?: number;
  linkCharacterId?: number;
  alwaysLinkCharacter?: boolean;
  hideChar?: boolean;
  characterAniType?: number;
  uniform?: string;
  goggleType?: string;
}

export interface EquipmentCatalogEntry {
  kind: string;
  category: number;
  itemId: number;
  internalId: string;
  title: string;
  tuneGroupId?: number;
}

const SHOP_CATEGORIES = new Set([
  "1", "2", "3", "4", "52", "70", "8", "9", "11", "16", "26", "27",
  "21", "18", "20", "31", "71", "12", "32", "58", "61",
]);
const EQUIPMENT_CATEGORY: Record<string, number> = {
  color: 2, plate: 4, dye: 70, goggle: 8, balloon: 9,
  headBand: 11, handGearL: 16, aura: 26, skidMark: 27, flyingPet: 52,
  pet: 21, uniform: 18, decal: 20, ridColor: 31, slotBg: 71,
  headPhone: 12, rpLucciBonus: 32, goItemSkinCard: 58, tachometer: 61,
};

/** Duplicate shop keys with conflicting titles become unusable. */
function shopNames(document: Document): Map<string, string | null> {
  const names = new Map<string, string | null>();
  for (const item of [...document.getElementsByTagName("item")]) {
    const category = item.getAttribute("itemCatId");
    if (!SHOP_CATEGORIES.has(category ?? "")) continue;
    const itemId = item.getAttribute("itemId");
    const title = item.getAttribute("itemName")?.trim();
    if (!itemId || !title) continue;
    const key = `${category}:${itemId}`;
    const previous = names.get(key);
    names.set(key, previous === undefined || previous === title ? title : null);
  }
  return names;
}

/** Only one resource is accepted for each model identity. */
function uniqueByIdentity<Entry>(files: Entry[], identify: (file: Entry) => string): Map<string, Entry> {
  const grouped = new Map<string, Entry[]>();
  for (const file of files) {
    const id = identify(file).toLowerCase();
    grouped.set(id, [...(grouped.get(id) ?? []), file]);
  }
  return new Map([...grouped].flatMap(([id, candidates]) =>
    candidates.length === 1 ? [[id, candidates[0]!] as const] : []));
}

/** A unique param folder may provide a model absent from direct model assets. */
function parameterModelPaths(files: GarageResource[]): Map<string, string> {
  const paths = new Map<string, Set<string>>();
  for (const file of files) {
    const canonicalPath = normalizeCanonicalPath(file.canonicalPath ?? file.virtualPath);
    const slash = canonicalPath.lastIndexOf("/");
    if (slash < 0) continue;
    const directory = canonicalPath.slice(0, slash);
    const model = `${directory}/model.1s`;
    const id = vehicleFolderName(model).toLowerCase();
    const candidates = paths.get(id) ?? new Set<string>();
    candidates.add(model);
    paths.set(id, candidates);
  }
  return new Map([...paths].flatMap(([id, candidates]) =>
    candidates.size === 1 ? [[id, [...candidates][0]!] as const] : []));
}

function sourceRelativeName(file: GarageResource): string {
  const path = (file.canonicalPath ?? file.virtualPath).replaceAll("\\", "/");
  const costume = path.toLowerCase().lastIndexOf("/costume/");
  return costume >= 0 ? path.slice(costume + 1) : path.slice(path.lastIndexOf("/") + 1);
}

function catalogEntries(
  kind: "kart" | "character",
  definitions: GarageItemDefinition[],
  names: Map<string, string | null>,
  models: Map<string, GarageResource | string>,
): GarageCatalogEntry[] {
  const category = kind === "kart" ? 3 : 1;
  return definitions.flatMap(definition => {
    if (definition.kind !== kind) return [];
    const model = models.get(definition.internalId.toLowerCase());
    const title = definition.title ?? names.get(`${category}:${definition.itemId}`);
    if (!model || (kind === "character" && title === null)) return [];
    return [{
      kind,
      itemId: definition.itemId,
      path: typeof model === "string" ? model : model.virtualPath,
      title: title ?? `${definition.internalId} (${definition.itemId})`,
      internalId: definition.internalId,
      systemKey: definition.systemKey,
      identityClass: definition.identityClass ?? "catalog-vehicle",
      kartType: definition.kartType,
      engineGrade: definition.engineGrade,
      enchant: definition.enchant,
      defaultOpenSocket: definition.defaultOpenSocket,
      uniqueLevel: definition.uniqueLevel,
      vehicleRarityLevel: definition.vehicleRarityLevel,
      textureKey: definition.textureKey,
      orgColorId: definition.orgColorId,
      fixedPlateId: definition.fixedPlateId,
      linkCharacterId: definition.linkCharacterId,
      alwaysLinkCharacter: definition.alwaysLinkCharacter,
      hideChar: definition.hideChar,
      characterAniType: definition.characterAniType,
      uniform: definition.uniform,
      goggleType: definition.goggleType,
    }];
  });
}

/** Check the original asset location before exposing a selectable catalog identity. */
function hasReadyAsset(definition: GarageItemDefinition,
  library: GarageCatalogLibrary, uniformAssets: ReadonlySet<string>): boolean {
  const exact = (path: string): boolean => library.exactCanonicalCandidates(path).length === 1;
  const inStuff = (path: string): boolean =>
    ["stuff2_", "stuff"].reduce((count, root) =>
      count + library.exactCanonicalCandidates(`${root}/${path}`).length, 0) === 1;
  const name = definition.internalId;
  switch (definition.kind) {
    case "color": case "dye": case "ridColor":
      return true; // ItemTable itself supplies their color values.
    case "plate": return exact(`stuff2_/plate/texture/${name}.png`);
    case "flyingPet": return exact(`flyingPet_/${name}/param.bml`);
    case "pet": return exact(`pet_/${name}/param.bml`);
    case "uniform": return uniformAssets.has(name.toLowerCase());
    case "decal": return exact(`stuff/decal/${name}.1s`);
    case "slotBg": return exact(`stuff2_/slotBG/${name}.1s`);
    case "headPhone": return exact(`stuff/headPhone/${name}.1s`);
    case "rpLucciBonus": return exact(`stuff/card/${name}.1s`);
    case "goItemSkinCard": return exact(`stuff/goItemSkinCard/${name}.1s`);
    case "tachometer": return exact(`stuff/card/${name}.1s`);
    case "balloon": return inStuff(`balloon/${name}/balloon.1s`);
    case "goggle": return inStuff(`goggle/${name}.1s`);
    case "headBand": return ["0", "1", "2", "3"].every(slot =>
      inStuff(`headBand/${name}_${slot}.1s`));
    case "handGearL": return inStuff(`handGearL/${name}.1s`);
    case "aura": return ["1", "2"].every(slot => inStuff(`aura/${name}_${slot}.1s`));
    case "skidMark": return inStuff(`skidMark/model/${name}.1s`);
    default: return false;
  }
}

function equipmentEntries(
  definitions: GarageItemDefinition[],
  names: Map<string, string | null>,
  library: GarageCatalogLibrary,
): EquipmentCatalogEntry[] {
  const uniformAssets = new Set<string>();
  for (const file of library.files) {
    const path = file.canonicalPath ?? file.virtualPath;
    const match = /^character_\/[^/]+\/costume\/(?:model\/([^/]+)\.1s|texture\/([^/]+)\.png|set\/([^/]+)\/model\.1s)$/i.exec(path);
    if (match) uniformAssets.add((match[1] ?? match[2] ?? match[3]!).toLowerCase());
  }
  return definitions.flatMap(definition => {
    const category = EQUIPMENT_CATEGORY[definition.kind];
    if (category === undefined) return [];
    const shopTitle = names.get(`${category}:${definition.itemId}`);
    if (shopTitle === null) return [];
    if (!hasReadyAsset(definition, library, uniformAssets)) return [];
    if (definition.kind === "plate" &&
        library.exactCanonicalCandidates(`stuff2_/plate/texture/${definition.internalId}.png`).length !== 1)
      return [];
    return [{
      kind: definition.kind,
      category,
      itemId: definition.itemId,
      internalId: definition.internalId,
      title: shopTitle ?? `${definition.internalId} (${definition.itemId})`,
      tuneGroupId: definition.tuneGroupId,
    }];
  });
}

/** Merge authoritative item definitions, localized shop names, and model files. */
export async function loadTimeAttackGarageCatalog(
  library: GarageCatalogLibrary,
  dependencies: GarageCatalogDependencies,
): Promise<{
  karts: GarageCatalogEntry[];
  characters: GarageCatalogEntry[];
  equipment: EquipmentCatalogEntry[];
  legacyFamilies: unknown;
}> {
  const shops = library.files.filter(file =>
    file.name.toLowerCase() === "item.kml" &&
    /(^|\/)zeta_\/cn\/shop\/data\//i.test(file.virtualPath));
  if (shops.length !== 1)
    throw new Error(`P3528 CN shop item.kml source 数量必须为 1，实际 ${shops.length}。`);

  const [definitions, shop] = await Promise.all([
    library.itemTableGarageDefinitions(),
    shops[0]!.text().then(text => dependencies.parseShopXml(text, shops[0]!.virtualPath)),
  ]);
  const names = shopNames(shop);
  for (const definition of definitions)
    if (definition.title) names.set(`3:${definition.itemId}`, definition.title);

  const directModels = uniqueByIdentity(
    library.files.filter(file => file.extension === "1s" &&
      file.name.toLowerCase() === "model.1s" &&
      /(^|\/)kart[^/]*\//i.test(file.virtualPath)),
    file => vehicleFolderName(file.virtualPath),
  );
  const kartModels = new Map<string, GarageResource | string>(directModels);
  const fallbackModels = parameterModelPaths(library.files.filter(file =>
    /(^|\/)kart[^/]*\//i.test(file.virtualPath) &&
    /^param(?:@cn)?\.(?:bml|eml|kml|xml)$/i.test(file.name)));
  for (const definition of definitions) {
    if (definition.kind !== "kart") continue;
    const id = definition.internalId.toLowerCase();
    if (kartModels.has(id)) continue;
    const modelPath = fallbackModels.get(id);
    if (!modelPath) continue;
    if ((await dependencies.resolveModel(library, modelPath)).find(["model.1s"]))
      kartModels.set(id, modelPath);
  }

  const characterModels = uniqueByIdentity(
    library.files.filter(file => file.extension === "1s" &&
      file.name.toLowerCase() === "model.1s" &&
      /^character_[^/]+\.rho$/i.test(file.sourceName) &&
      file.sourceName.toLowerCase() !== "character_common.rho" &&
      sourceRelativeName(file).toLowerCase() === "model.1s"),
    file => file.sourceName.replace(/^character_/i, "").replace(/\.rho$/i, ""),
  );
  return {
    karts: catalogEntries("kart", definitions, names, kartModels)
      .sort((left, right) => right.itemId - left.itemId),
    characters: catalogEntries("character", definitions, names, characterModels),
    equipment: equipmentEntries(definitions, names, library),
    legacyFamilies: dependencies.legacyFamilies,
  };
}
