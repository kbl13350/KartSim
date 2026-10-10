import { decodeBinaryXml } from "../codecs/binary-xml";
import type { ItemXmlNode } from "./item-bml";
import type { ItemObjectDefinition } from "./item-catalog";

/** three.js position (Y up). */
export interface ItemVec3 { x: number; y: number; z: number }

/** Client (Z up) to three.js, the same `(x, z, -y)` the LTE coins and the release use. */
export function clientToThree(position: ArrayLike<number>): ItemVec3 {
  return { x: position[0]!, y: position[2]!, z: -position[1]! };
}

/** The track object fields this module reads (decoded `track*.1s` TrackContainer). */
export interface ItemTrackObject {
  kind: string;
  name: string;
  instanceOrdinal?: number;
  transform?: { position: number[] };
  property?: ItemXmlNode;
  object?: unknown;
}

export interface ItemTrackModel {
  root: { kind: string; trackObjects: ItemTrackObject[] };
}

/** Moving cubes are numbered after the static ordinals so ids never collide. */
export const MOVING_CUBE_ID_OFFSET = 2048;
/** The `cube` request accepts ids 1..4096. */
export const MAX_CUBE_ID = 4096;

export interface ItemCubeDescriptor {
  /**
   * Network id: a static cube's `instanceOrdinal` (unique and 1..N in every
   * track*.1s), or MOVING_CUBE_ID_OFFSET + the moving cube's movable ordinal.
   */
  readonly id: number;
  readonly name: string;
  /** Client (Z-up) position at load time. */
  readonly clientPosition: readonly [number, number, number];
  readonly position: ItemVec3;
  /** Fixed item of `<property><item name=…/></property>` (flag tracks' supershield). */
  readonly item?: string;
  /** Nested Relement whose world matrix moves a moving cube (a matrix-only track root). */
  readonly anchor?: object;
}

export interface ItemCubeSource {
  readonly trackId: string;
  /** itemCube folder that supplied the model (theme or customItemCube). */
  readonly theme: string;
  readonly modelPath: string;
  readonly eatenModelPath: string;
  readonly eatenSoundPath: string;
  /** Pickup radius `Stay.size`. */
  readonly radius: number;
  /** Hidden time `Eaten.life` before the cube returns. */
  readonly eatenLifeMs: number;
  readonly cubes: readonly ItemCubeDescriptor[];
}

function textBeforeNul(text: string): string {
  const terminator = text.indexOf("\0");
  return terminator < 0 ? text : text.slice(0, terminator);
}

function propertyChild(object: ItemTrackObject, name: string): ItemXmlNode | undefined {
  return object.property?.children.find(child => textBeforeNul(child.name) === name);
}

export function propertyAttribute(object: ItemTrackObject, child: string, name: string): string | undefined {
  const value = propertyChild(object, child)?.attributes
    .find(attribute => textBeforeNul(attribute.name) === name)?.value;
  return value === undefined ? undefined : textBeforeNul(value);
}

/** `property/object@type` of a movable, as `movableObjectType` reads it. */
export function movableType(object: ItemTrackObject): string | undefined {
  return propertyAttribute(object, "object", "type");
}

function isSceneNode(value: unknown): value is object {
  return !!value && typeof value === "object" && (value as { kind?: unknown }).kind === "node";
}

/** The transform position, or undefined when the original data carries NaN. */
export function trackObjectPosition(object: ItemTrackObject): [number, number, number] | undefined {
  const position = object.transform?.position;
  if (!position || position.length !== 3 || !position.every(Number.isFinite)) return undefined;
  return [position[0]!, position[1]!, position[2]!];
}

/**
 * Enumerate the static `ToItemCube` and moving `itemCube` objects of the exact
 * track*.1s that was loaded (reverse and xmas variants carry their own sets).
 * A few original moving cubes (fengshen_I03-I05 mo_ic042/mo_ic044) carry NaN
 * transforms and NaN PRS keys, so they can never be reached; they are skipped.
 */
export function collectItemCubes(model: ItemTrackModel): ItemCubeDescriptor[] {
  if (model.root.kind !== "track") throw Error("道具箱需要 TrackContainer。");
  const cubes: ItemCubeDescriptor[] = [];
  const ids = new Set<number>();
  const add = (cube: ItemCubeDescriptor) => {
    if (!Number.isSafeInteger(cube.id) || cube.id < 1 || cube.id > MAX_CUBE_ID || ids.has(cube.id))
      throw Error(`道具箱 ${cube.name} 缺少唯一原件序号。`);
    ids.add(cube.id);
    cubes.push(cube);
  };
  for (const object of model.root.trackObjects) {
    if (object.kind === "ToItemCube") {
      const position = trackObjectPosition(object);
      if (!position) throw Error(`道具箱 ${object.name} 坐标无效。`);
      const item = propertyAttribute(object, "item", "name");
      add({
        id: object.instanceOrdinal ?? Number.NaN, name: object.name,
        clientPosition: position, position: clientToThree(position),
        ...(item ? { item } : {}),
      });
    } else if (object.kind === "ToMovableObject" && movableType(object) === "itemCube") {
      if (!isSceneNode(object.object)) throw Error(`移动道具箱 ${object.name} 缺少嵌套场景。`);
      const position = trackObjectPosition(object);
      if (!position) continue;
      add({
        id: MOVING_CUBE_ID_OFFSET + (object.instanceOrdinal ?? Number.NaN), name: object.name,
        clientPosition: position, position: clientToThree(position), anchor: object.object,
      });
    }
  }
  return cubes;
}

/** The `customItemCube` of trackLocale@cn (fengshen_dev, fengshen_tail), if any. */
export function customItemCubeTheme(trackLocale: ItemXmlNode, trackId: string): string | undefined {
  const baseId = trackId.replace(/_rvs$/i, "");
  const attribute = (node: ItemXmlNode, name: string) =>
    node.attributes.find(entry => entry.name === name)?.value;
  const rows = trackLocale.children;
  const reverse = baseId !== trackId
    ? rows.find(row => row.name === "track_rvs" && attribute(row, "refId") === baseId &&
      attribute(row, "customItemCube"))
    : undefined;
  const row = reverse ?? rows.find(row => row.name === "track" && attribute(row, "id") === baseId);
  return row ? attribute(row, "customItemCube") || undefined : undefined;
}

/** Theme folder for item cubes when nothing else matches (village has a cn skin). */
export const FALLBACK_CUBE_THEME = "village";

/** Folder order: customItemCube, the track id's theme prefix, then the fallback. */
export function itemCubeThemes(trackId: string, customTheme?: string): string[] {
  const prefix = trackId.replace(/_rvs$/i, "").split("_")[0] ?? "";
  return [...new Set([customTheme, prefix, FALLBACK_CUBE_THEME].filter((theme): theme is string => !!theme))];
}

/** Pick `item/itemCube/<theme>/{cn,zz}/itemCube.1s`, region cn first. */
export function resolveItemCubeModel(exists: (path: string) => boolean, trackId: string,
  customTheme?: string): { theme: string; path: string } {
  for (const theme of itemCubeThemes(trackId, customTheme)) {
    for (const region of ["cn", "zz"]) {
      const path = `item/itemCube/${theme}/${region}/itemCube.1s`;
      if (exists(path)) return { theme, path };
    }
  }
  throw Error(`${trackId} 找不到道具箱模型。`);
}

export function decodeTrackLocale(bytes: Uint8Array): ItemXmlNode {
  const root = decodeBinaryXml(bytes);
  if (root.name !== "trackList") throw Error("trackLocale@cn.bml 根节点必须是 trackList。");
  return root;
}

/** Build the cube source from the parsed track, the cube definition and the locale table. */
export function createItemCubeSource(
  model: ItemTrackModel,
  trackId: string,
  cube: ItemObjectDefinition,
  trackLocale: ItemXmlNode | undefined,
  exists: (path: string) => boolean,
): ItemCubeSource {
  const stay = cube.states.get("Stay");
  const eaten = cube.states.get("Eaten");
  if (!stay || stay.size === undefined || stay.size <= 0 || !eaten || eaten.lifeMs <= 0 ||
    !eaten.fired || !eaten.firedFx)
    throw Error("item/itemCube/item.bml base 0 的 Stay/Eaten 不完整。");
  const eatenModelPath = `item/${cube.folder}/${eaten.fired}.1s`;
  const eatenSoundPath = `sound_/fx/item/${cube.folder}/${eaten.firedFx}.ogg`;
  for (const path of [eatenModelPath, eatenSoundPath])
    if (!exists(path)) throw Error(`道具箱缺少原件 ${path}。`);
  const custom = trackLocale ? customItemCubeTheme(trackLocale, trackId) : undefined;
  const { theme, path } = resolveItemCubeModel(exists, trackId, custom);
  return {
    trackId, theme, modelPath: path, eatenModelPath, eatenSoundPath,
    radius: Math.fround(stay.size), eatenLifeMs: eaten.lifeMs,
    cubes: collectItemCubes(model),
  };
}
