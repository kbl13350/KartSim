import { appendTaiwanVehicleDefinitions } from "./taiwan-vehicles";
import { translateItemName } from "../i18n/item-names";
import type { GarageItemDefinition, GarageResource } from "./timeattack-items";
import { resourceText, tr } from "../i18n/locale";

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

/**
 * Parse catalog identities while retaining release defaults and optional fields.
 * Unlike the release, `trans` is not read as decorationTrans: in the original
 * tables it is only on goggles (and karts) and is the item race's cloud cover
 * reduction (item/item-passives.ts), while the release previews drew it as
 * model opacity and left goggles see-through outside races.
 */
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
    }];
  });
}

/** Balloon tether attributes @cn may not override (see overlayItemTable). */
const BALLOON_ROPE = new Set(["pos", "floatingForce", "wireLengthLimit", "viscousDrag"]);

/**
 * Overlay `etc_/itemTable@cn.xml` on the base rows the way the CN client
 * does: for the same (tag, id) every attribute the overlay carries wins. CN
 * items keep their own folders, grades, kart types and paints this way; CN
 * 580 暴走飓风Z7+ is zeno5 with paint 8, where the base row still names
 * scooter3 (超迷你踏板车 Z7). `keepName` may refuse an overlay folder the
 * catalog cannot load, and that row keeps its base folder.
 *
 * Balloon ropes are the exception: @cn gives 16 balloons (粉红色/蓝色心型气球
 * …) pos 0 0.7 1.5, floatingForce 120 and wireLengthLimit 1.5, which hangs the
 * balloon half again as high as the original does (the user's screenshot of
 * 蓝色心型气球 at the 城镇 高速公路 start, 2026-10-13). The base table names
 * none, so those rows keep the engine's default rope, as the release did.
 */
export function overlayItemTable(
  base: ItemTableNode[], overlay: ItemTableNode[],
  keepName: (tag: string, name: string) => boolean = () => true,
): ItemTableNode[] {
  const rows = new Map<string, Map<string, string>>();
  for (const node of overlay) {
    const rawId = attribute(node, "id");
    if (!rawId || !/^\d+$/.test(rawId)) continue;
    const key = `${node.name}:${Number(rawId)}`;
    const values = rows.get(key) ?? new Map<string, string>();
    for (const { name, value } of node.attributes) {
      if (name === "uniqueLevel" && values.has(name) && values.get(name) !== value)
        throw new Error(`itemTable@cn ${node.name} id=${rawId} 存在冲突 uniqueLevel。`);
      if (name !== "id") values.set(name, value);
    }
    rows.set(key, values);
  }
  return base.map(node => {
    const rawId = attribute(node, "id");
    const values = rawId && /^\d+$/.test(rawId) ? rows.get(`${node.name}:${Number(rawId)}`) : undefined;
    if (!values) return node;
    const merged = new Map(node.attributes.map(item => [item.name, item.value]));
    for (const [name, value] of values) {
      if (node.name === "balloon" && BALLOON_ROPE.has(name)) continue;
      if (name !== "name" || keepName(node.name, value.trim())) merged.set(name, value);
    }
    return { ...node, attributes: [...merged].map(([name, value]) => ({ name, value })) };
  });
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
  const names = dependencies.parseXml(await bags[0]!.bytes()).root.children.find(node =>
    node.name === "k" && attribute(node, "n") === "practiceKart")?.children;
  const title = names && resourceText(names, attribute)?.trim();
  if (!title) throw new Error("baseStringBag.xml 缺少 practiceKart 的 CN 名称。");
  const vehicles = [systemKart(internalId, title, 8, "practiceKart", "system-vehicle")];

  if (["model.1s", "param.xml", "f00.1s", "f01.1s", "f02.1s",
    "f03.1s", "f04.1s", "f05.1s", "f06.1s"].every(name =>
    library.get(`kart_/practiceX/${name}`)))
    vehicles.push(systemKart("practiceX", tr("练习用卡丁车 X"), 7,
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
      vehicles.push(systemKart(defaultState.resource, translateItemName(family.title), family.engineGrade,
        family.key, "legacy-system-family"));
  }
  return vehicles;
}

/** Cache the authoritative item table with the CN overlay applied. */
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
    let rows = base.children;
    if (localizedFiles.length === 1) {
      const localized = dependencies.parseXml(await localizedFiles[0]!.bytes()).root;
      if (localized.name !== "itemtable")
        throw new Error("etc_/itemTable@cn.xml 根节点不是 itemtable。");
      // A CN character skin without a model of its own (homrunDao_cn only
      // carries textures over addModelFolder=homrunDao, which the character
      // loader does not read) keeps the base character.
      rows = overlayItemTable(base.children, localized.children, (tag, name) =>
        tag !== "character" || library.exactCanonicalCandidates(`character_/${name}/model.1s`).length > 0);
    }
    const definitions = parseItemDefinitions(rows);
    return appendTaiwanVehicleDefinitions(
      [...definitions, ...(await systemVehicleDefinitions(library, dependencies))], library);
  })();
  return library.garageDefinitionsPromise;
}
