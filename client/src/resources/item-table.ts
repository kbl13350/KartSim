import type { GarageItemDefinition, GarageResource } from "./timeattack-items";

export interface ItemTableNode {
  name: string;
  attributes: { name: string; value: string }[];
  children: ItemTableNode[];
}

export interface LegacyVehicleFamily {
  key: string;
  title: string;
  engineGrade: number;
  defaultLevel: string;
  states: { level: string; resource: string; parameterSource: {
    status: string; resource?: string;
  } }[];
}

export interface ItemTableDependencies {
  parseXml(bytes: Uint8Array): { root: ItemTableNode };
  legacyFamilies: readonly LegacyVehicleFamily[];
}

export interface ItemTableLibrary {
  garageDefinitionsPromise?: Promise<GarageItemDefinition[]>;
  exactCanonicalCandidates(path: string): GarageResource[];
  get(path: string): GarageResource | undefined;
}

const ITEM_KINDS = new Set([
  "kart", "character", "color", "plate", "dye", "flyingPet", "goggle",
  "balloon", "headBand", "handGearL", "aura", "skidMark", "pet", "uniform",
  "decal", "ridColor", "slotBg", "headPhone", "rpLucciBonus",
  "goItemSkinCard", "tachometer",
]);
const DECORATIONS_WITH_TRANS = new Set([
  "goggle", "balloon", "headBand", "handGearL", "aura", "skidMark",
]);

function attribute(node: ItemTableNode, name: string): string | undefined {
  return node.attributes.find(item => item.name === name)?.value;
}

function unsigned(node: ItemTableNode, name: string, max: number, fallback = 0): number {
  const raw = attribute(node, name) ?? String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`itemTable ${node.name} ${name}=${raw} 无效。`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > max)
    throw new Error(`itemTable ${node.name} ${name}=${raw} 超出范围。`);
  return value;
}

function metadataBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  throw new Error(`track metadata boolean 值无效：${value}。`);
}

function boolean(node: ItemTableNode, name: string): boolean {
  return metadataBoolean(attribute(node, name)) ?? false;
}

function finiteNumber(node: ItemTableNode, name: string): number | undefined {
  const raw = attribute(node, name)?.trim();
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value))
    throw new Error(`itemTable ${node.name} ${name}=${raw} 不是有限数。`);
  return value;
}

function vector3(node: ItemTableNode, name: string): number[] | undefined {
  const raw = attribute(node, name)?.trim();
  if (raw === undefined || raw === "") return undefined;
  const parts = raw.split(/\s+/);
  if (parts.length !== 3)
    throw new Error(`itemTable ${node.name} ${name}=${raw} 不是三分量。`);
  const values = parts.map(Number);
  if (values.some(value => !Number.isFinite(value)))
    throw new Error(`itemTable ${node.name} ${name}=${raw} 含非有限数。`);
  return [values[0]!, values[1]!, values[2]!];
}

/** Parse catalog identities while retaining release defaults and optional fields. */
export function parseItemDefinitions(nodes: ItemTableNode[]): GarageItemDefinition[] {
  return nodes.flatMap(node => {
    if (!ITEM_KINDS.has(node.name)) return [];
    const rawId = attribute(node, "id");
    const internalId = attribute(node, "name")?.trim();
    if (!rawId || !/^\d+$/.test(rawId) || !internalId) return [];
    const itemId = Number(rawId);
    if (!Number.isSafeInteger(itemId))
      throw new Error(`itemTable ${node.name} id=${rawId} 超出安全整数范围。`);
    const rawKartType = node.name === "kart" ? attribute(node, "kartType") : undefined;
    if (rawKartType !== undefined && !/^\d+$/.test(rawKartType))
      throw new Error(`itemTable kart ${internalId} 的 kartType=${rawKartType} 无效。`);
    return [{
      kind: node.name,
      tuneGroupId: node.name === "flyingPet" ? unsigned(node, "tuneGroupId", 65535) : undefined,
      itemId,
      internalId,
      identityClass: "catalog-vehicle",
      kartType: rawKartType === undefined ? undefined : Number(rawKartType),
      engineGrade: node.name === "kart" ? unsigned(node, "engineGrade", 65535) : undefined,
      enchant: node.name === "kart" ? boolean(node, "enchant") : undefined,
      defaultOpenSocket: node.name === "kart" ? unsigned(node, "defaultOpenSocket", 65535) : undefined,
      uniqueLevel: node.name === "kart" ? unsigned(node, "uniqueLevel", 255, 4) : undefined,
      vehicleRarityLevel: node.name === "kart" && attribute(node, "uniqueLevel") !== undefined
        ? unsigned(node, "uniqueLevel", 255) : undefined,
      textureKey: node.name === "kart" ? attribute(node, "t1ImageName")?.trim() || "1" : undefined,
      orgColorId: node.name === "kart" ? unsigned(node, "orgColorId", 65535) : undefined,
      fixedPlateId: node.name === "kart" ? unsigned(node, "fixedPlateId", 65535) : undefined,
      linkCharacterId: node.name === "kart" ? unsigned(node, "linkCharacterId", 65535) : undefined,
      alwaysLinkCharacter: node.name === "kart" ? boolean(node, "alwaysLinkCharacter") : undefined,
      hideChar: node.name === "kart" ? boolean(node, "hideChar") : undefined,
      characterAniType: node.name === "kart" ? unsigned(node, "characterAniType", 255) : undefined,
      uniform: node.name === "character" ? attribute(node, "uniform") ?? "1" : undefined,
      goggleType: node.name === "character" ? attribute(node, "goggleType")?.trim() ?? "" : undefined,
      fontName: node.name === "plate" ? attribute(node, "fontName") ?? "" : undefined,
      fontColor: node.name === "plate" ? attribute(node, "fontColor") ?? "255 0 0 0" : undefined,
      balloonPos: node.name === "balloon" ? vector3(node, "pos") : undefined,
      balloonWireLengthLimit: node.name === "balloon" ? finiteNumber(node, "wireLengthLimit") : undefined,
      balloonFloatingForce: node.name === "balloon" ? finiteNumber(node, "floatingForce") : undefined,
      balloonViscousDrag: node.name === "balloon" ? finiteNumber(node, "viscousDrag") : undefined,
      decorationTrans: DECORATIONS_WITH_TRANS.has(node.name) ? finiteNumber(node, "trans") : undefined,
    }];
  });
}

function localizedRarity(root: ItemTableNode): Map<number, number> {
  const levels = new Map<number, number>();
  for (const kart of root.children.filter(node => node.name === "kart")) {
    const rawId = attribute(kart, "id");
    if (attribute(kart, "uniqueLevel") === undefined) continue;
    if (!rawId || !/^\d+$/.test(rawId))
      throw new Error(`itemTable@cn kart id=${rawId ?? "<missing>"} 无效。`);
    const id = Number(rawId);
    if (!Number.isSafeInteger(id))
      throw new Error(`itemTable@cn kart id=${rawId} 超出安全整数范围。`);
    const level = unsigned(kart, "uniqueLevel", 255);
    const previous = levels.get(id);
    if (previous !== undefined && previous !== level)
      throw new Error(`itemTable@cn kart id=${id} 存在冲突 uniqueLevel。`);
    levels.set(id, level);
  }
  return levels;
}

function systemKart(
  internalId: string, title: string, engineGrade: number, systemKey: string,
  identityClass: string,
): GarageItemDefinition {
  return {
    kind: "kart", itemId: 0, internalId, systemKey, identityClass, title,
    kartType: 2, engineGrade, enchant: false, defaultOpenSocket: 0,
    uniqueLevel: 4, textureKey: "1", orgColorId: 1, fixedPlateId: 0,
    linkCharacterId: 0, alwaysLinkCharacter: false, hideChar: false,
    characterAniType: 0,
  };
}

async function systemVehicleDefinitions(
  library: ItemTableLibrary,
  dependencies: ItemTableDependencies,
): Promise<GarageItemDefinition[]> {
  const configs = library.exactCanonicalCandidates("zeta_/cn/content/config.xml");
  if (configs.length === 0) return [];
  if (configs.length !== 1)
    throw new Error(`content/config.xml source 数量必须为 1，实际 ${configs.length}。`);
  const content = dependencies.parseXml(await configs[0]!.bytes()).root.children.find(node =>
    node.name === "content" && attribute(node, "name") === "practiceKart");
  const internalId = content && attribute(content, "kartName")?.trim();
  if (!internalId) return [];

  const bags = library.exactCanonicalCandidates("etc_/baseStringBag.xml");
  if (bags.length !== 1)
    throw new Error(`practiceKart 需要唯一的 etc_/baseStringBag.xml，实际 ${bags.length}。`);
  const titleNode = dependencies.parseXml(await bags[0]!.bytes()).root.children.find(node =>
    node.name === "k" && attribute(node, "n") === "practiceKart")
    ?.children.find(node => node.name === "m" && attribute(node, "c") === "cn");
  const title = titleNode && attribute(titleNode, "v")?.trim();
  if (!title) throw new Error("baseStringBag.xml 缺少 practiceKart 的 CN 名称。");
  const vehicles = [systemKart(internalId, title, 8, "practiceKart", "system-vehicle")];

  if (["model.1s", "param.xml", "f00.1s", "f01.1s", "f02.1s",
    "f03.1s", "f04.1s", "f05.1s", "f06.1s"].every(name =>
    library.get(`kart_/practiceX/${name}`)))
    vehicles.push(systemKart("practiceX", "练习用卡丁车 X", 7,
      "legacyPracticeX", "legacy-system-family"));

  for (const family of dependencies.legacyFamilies) {
    const defaultState = family.states.find(state => state.level === family.defaultLevel);
    if (!defaultState)
      throw new Error(`${family.key} 缺少默认等级 ${family.defaultLevel}。`);
    const required = [
      `kart_/${defaultState.resource}/model.1s`,
      `kart_/${defaultState.resource}/0.png`,
      `kart_/${defaultState.resource}/1.png`,
    ];
    if (defaultState.parameterSource.status === "family-resource")
      required.push(`kart_/${defaultState.parameterSource.resource}/param.xml`);
    if (required.every(path => library.get(path)))
      vehicles.push(systemKart(defaultState.resource, family.title, family.engineGrade,
        family.key, "legacy-system-family"));
  }
  return vehicles;
}

/** Cache the authoritative item table and apply the CN rarity overlay. */
export async function itemTableGarageDefinitions(
  library: ItemTableLibrary,
  dependencies: ItemTableDependencies,
): Promise<GarageItemDefinition[]> {
  library.garageDefinitionsPromise ??= (async () => {
    const baseFiles = library.exactCanonicalCandidates("etc_/itemTable.kml");
    if (baseFiles.length !== 1)
      throw new Error(`etc_/itemTable.kml source 数量必须为 1，实际 ${baseFiles.length}。`);
    const base = dependencies.parseXml(await baseFiles[0]!.bytes()).root;
    if (base.name !== "itemtable")
      throw new Error("etc_/itemTable.kml 根节点不是 itemtable。");
    const localizedFiles = library.exactCanonicalCandidates("etc_/itemTable@cn.xml");
    if (localizedFiles.length > 1)
      throw new Error(`etc_/itemTable@cn.xml source 数量必须为 0 或 1，实际 ${localizedFiles.length}。`);
    let rarity = new Map<number, number>();
    if (localizedFiles.length === 1) {
      const localized = dependencies.parseXml(await localizedFiles[0]!.bytes()).root;
      if (localized.name !== "itemtable")
        throw new Error("etc_/itemTable@cn.xml 根节点不是 itemtable。");
      rarity = localizedRarity(localized);
    }
    const definitions = parseItemDefinitions(base.children).map(definition => {
      if (definition.kind !== "kart") return definition;
      const level = rarity.get(definition.itemId);
      return level === undefined ? definition : { ...definition, vehicleRarityLevel: level };
    });
    return [...definitions, ...(await systemVehicleDefinitions(library, dependencies))];
  })();
  return library.garageDefinitionsPromise;
}
