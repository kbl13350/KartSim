import { loadItemCatalog, type ItemCatalog, type ItemCatalogLibrary } from "./item-catalog";
import {
  createItemCubeSource, decodeTrackLocale, type ItemCubeSource, type ItemTrackModel,
} from "./item-cube-source";
import {
  loadItemCubeField, type CubeAudioContext, type ItemCubeField, type ItemCubeFieldOps,
  type ItemWorldMatrix,
} from "./item-cubes";
import { createItemHazardField, createItemHazardSource, type ItemHazardField, type ItemHazardSource } from "./item-hazards";

/**
 * Map-loading glue for item races: which rooms load the item-game admission,
 * what the map result carries, and the race-side cube and hazard owners.
 */

/** Item rooms: gameplay "item", or an original item channel (itemIndiCombine/itemTeamCombine). */
export function isItemRaceRoom(room: { gameplay?: unknown; channelName?: unknown }): boolean {
  return room.gameplay === "item" ||
    (typeof room.channelName === "string" && /^item/.test(room.channelName));
}

const catalogs = new WeakMap<object, Promise<ItemCatalog>>();

/** One catalog per resource library; a failed load is retried next time. */
export function itemCatalogFor(library: ItemCatalogLibrary): Promise<ItemCatalog> {
  let catalog = catalogs.get(library);
  if (!catalog) {
    catalog = loadItemCatalog(library);
    catalogs.set(library, catalog);
    catalog.catch(() => catalogs.delete(library));
  }
  return catalog;
}

export interface ItemGameTrackSources {
  catalog: ItemCatalog;
  cubes: ItemCubeSource;
  hazards: ItemHazardSource;
}

export const TRACK_LOCALE_PATH = "track_/common/trackLocale@cn.bml";

/** Read the catalog, the trackLocale cube skin and the cube/hazard placements of a track. */
export async function loadItemGameTrackSources(library: ItemCatalogLibrary, model: ItemTrackModel,
  trackId: string): Promise<ItemGameTrackSources> {
  const catalog = await itemCatalogFor(library);
  const locales = library.exactCanonicalCandidates(TRACK_LOCALE_PATH);
  if (locales.length > 1) throw Error(`${TRACK_LOCALE_PATH} 不唯一。`);
  const locale = locales[0] ? decodeTrackLocale(await locales[0].bytes()) : undefined;
  const exists = (path: string) => catalog.has(path);
  return {
    catalog,
    cubes: createItemCubeSource(model, trackId, catalog.cube, locale, exists),
    hazards: createItemHazardSource(model, catalog),
  };
}

/** The item part of a loaded map result (`loadTrackMap` with the item flag). */
export interface ItemRaceMap {
  itemCatalog?: ItemCatalog;
  itemCubeSource?: ItemCubeSource;
  itemHazardSource?: ItemHazardSource;
  environment: unknown;
  stageBinding: unknown;
  renderScene?: { clientWorldElements?(node: object): ArrayLike<number> | undefined };
}

export interface ItemRaceFields {
  catalog: ItemCatalog;
  cubes: ItemCubeField;
  hazards: ItemHazardField;
  dispose(): void;
}

/** Build the cube and hazard owners of an item race map; undefined for other maps. */
export async function loadItemRaceFields<Archive>(
  archive: Archive,
  map: ItemRaceMap,
  context: CubeAudioContext | undefined,
  ops: ItemCubeFieldOps<Archive>,
): Promise<ItemRaceFields | undefined> {
  if (!map.itemCubeSource || !map.itemHazardSource || !map.itemCatalog) return undefined;
  const scene = map.renderScene;
  const worldMatrix: ItemWorldMatrix | undefined = scene?.clientWorldElements
    ? node => scene.clientWorldElements!(node) : undefined;
  const cubes = await loadItemCubeField(archive, map.itemCubeSource, map.environment,
    map.stageBinding, context, worldMatrix, ops);
  const hazards = createItemHazardField(map.itemHazardSource, worldMatrix);
  return {
    catalog: map.itemCatalog,
    cubes,
    hazards,
    dispose: () => {
      cubes.dispose();
      hazards.dispose();
    },
  };
}
