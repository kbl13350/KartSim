import type { ResourceEntry } from "./resource-lookup";
import { vehicleFolderName } from "./vehicle-identity";

export interface GarageResource extends ResourceEntry {
  name: string;
  extension: string;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface GarageItemDefinition {
  kind: string;
  itemId: number;
  internalId: string;
  title?: string;
  systemKey?: string;
  identityClass?: string;
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
  fontName?: string;
  fontColor?: string;
  tuneGroupId?: number;
  balloonPos?: number[];
  balloonWireLengthLimit?: number;
  balloonFloatingForce?: number;
  balloonViscousDrag?: number;
  decorationTrans?: number;
}

export interface GarageItemLibrary {
  files: GarageResource[];
  timeAttackGarageCatalogPromise?: Promise<unknown>;
  itemTableGarageDefinitions(): Promise<GarageItemDefinition[]>;
  exactCanonicalCandidates(path: string): GarageResource[];
  loadTimeAttackGarageCatalog(): Promise<unknown>;
}

const DECORATION_CATEGORY: Record<string, number> = {
  goggle: 8, balloon: 9, headBand: 11, handGearL: 16, aura: 26, skidMark: 27,
};

export async function bodyParams(library: GarageItemLibrary): Promise<GarageResource[]> {
  return library.files.filter(file =>
    /(^|\/)param(?:@cn)?\.(bml|eml|kml|xml)$/i.test(file.virtualPath));
}

export async function timeAttackGarageCatalog(library: GarageItemLibrary): Promise<unknown> {
  library.timeAttackGarageCatalogPromise ??= library.loadTimeAttackGarageCatalog();
  return library.timeAttackGarageCatalogPromise;
}

/** Resolve one category-3 kart identity for a particular model folder. */
export async function timeAttackKartItem(
  library: GarageItemLibrary, itemId: number, modelPath: string,
): Promise<GarageItemDefinition> {
  const modelName = vehicleFolderName(modelPath);
  const identity = (await library.itemTableGarageDefinitions()).find(item =>
    item.kind === "kart" && item.itemId === itemId &&
    item.internalId.toLowerCase() === modelName.toLowerCase());
  if (!identity) throw new Error(`P3528 车辆身份目录缺少 category-3 id ${itemId}。`);
  if (identity.internalId.toLowerCase() !== modelName.toLowerCase())
    throw new Error(`kart item id ${itemId} 的模型目录是 ${identity.internalId}，不是 ${modelName}。`);
  if (identity.fixedPlateId === undefined || identity.hideChar === undefined ||
      identity.characterAniType === undefined)
    throw new Error(`kart item id ${itemId} 的 ItemKart metadata 不完整。`);
  return {
    ...identity,
    fixedPlateId: identity.fixedPlateId,
    hideChar: identity.hideChar,
    characterAniType: identity.characterAniType,
  };
}

export async function timeAttackPlateItem(
  library: GarageItemLibrary, itemId: number,
): Promise<{ texture: GarageResource; fontName: string; fontColor: string }> {
  const plate = (await library.itemTableGarageDefinitions()).find(item =>
    item.kind === "plate" && item.itemId === itemId);
  if (!plate) throw new Error(`P3528 ItemTable 缺少 plate item id ${itemId}。`);
  const textures = library.exactCanonicalCandidates(`stuff2_/plate/texture/${plate.internalId}.png`);
  if (textures.length !== 1)
    throw new Error(`plate item id ${itemId} texture source 数量必须为 1，实际 ${textures.length}。`);
  return {
    texture: textures[0]!,
    fontName: plate.fontName ?? "",
    fontColor: plate.fontColor ?? "255 0 0 0",
  };
}

export async function timeAttackCharacterItem(
  library: GarageItemLibrary, itemId: number, modelPath: string,
): Promise<{ itemId: number; internalId: string; uniform: string; goggleType: string }> {
  const character = (await library.itemTableGarageDefinitions()).find(item =>
    item.kind === "character" && item.itemId === itemId);
  if (!character) throw new Error(`P3528 ItemTable 缺少 character item id ${itemId}。`);
  if (character.internalId.toLowerCase() !== vehicleFolderName(modelPath).toLowerCase())
    throw new Error(`character item id ${itemId} 的模型目录是 ${character.internalId}，不是 ${vehicleFolderName(modelPath)}。`);
  return {
    itemId: character.itemId,
    internalId: character.internalId,
    uniform: character.uniform ?? "1",
    goggleType: character.goggleType ?? "",
  };
}

function sourceRelativeModelName(file: GarageResource): string {
  const path = (file.canonicalPath ?? file.virtualPath).replaceAll("\\", "/");
  const costume = path.toLowerCase().lastIndexOf("/costume/");
  return costume >= 0 ? path.slice(costume + 1) : path.slice(path.lastIndexOf("/") + 1);
}

export async function timeAttackLinkedCharacterItem(
  library: GarageItemLibrary, itemId: number,
): Promise<{ itemId: number; internalId: string; uniform: string; goggleType: string; path: string }> {
  const character = (await library.itemTableGarageDefinitions()).find(item =>
    item.kind === "character" && item.itemId === itemId);
  if (!character) throw new Error(`P3528 ItemTable 缺少 linked character item id ${itemId}。`);
  const sourceName = `character_${character.internalId}.rho`;
  const models = library.files.filter(file =>
    file.sourceName === sourceName && sourceRelativeModelName(file) === "model.1s");
  if (models.length !== 1)
    throw new Error(`${sourceName} base model source 数量必须为 1，实际 ${models.length}。`);
  return {
    itemId: character.itemId,
    internalId: character.internalId,
    uniform: character.uniform ?? "1",
    goggleType: character.goggleType ?? "",
    path: models[0]!.virtualPath,
  };
}

export async function timeAttackDecorationItem(
  library: GarageItemLibrary, category: number, itemId: number,
): Promise<{
  kind: string; category: number; itemId: number; internalId: string;
  balloonPos?: number[]; balloonWireLengthLimit?: number;
  balloonFloatingForce?: number; balloonViscousDrag?: number; decorationTrans?: number;
}> {
  const kind = Object.keys(DECORATION_CATEGORY).find(key => DECORATION_CATEGORY[key] === category);
  if (!kind) throw new Error(`P3528 未知装饰类别 ${category}。`);
  const item = (await library.itemTableGarageDefinitions()).find(candidate =>
    candidate.kind === kind && candidate.itemId === itemId);
  if (!item) throw new Error(`P3528 ItemTable 缺少 ${kind} item id ${itemId}。`);
  return {
    kind,
    category,
    itemId: item.itemId,
    internalId: item.internalId,
    balloonPos: item.balloonPos,
    balloonWireLengthLimit: item.balloonWireLengthLimit,
    balloonFloatingForce: item.balloonFloatingForce,
    balloonViscousDrag: item.balloonViscousDrag,
    decorationTrans: item.decorationTrans,
  };
}
