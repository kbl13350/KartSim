import { Group, type Camera, type Object3D } from "three";
import { ITEM_REGISTRY, decodeItemBml, itemModelCandidates, uniqueBytes, type ItemCatalogLibrary } from "./item-catalog";
import { movableType, propertyAttribute, type ItemTrackObject } from "./item-cube-source";
import { ITEM_COMMON_TEXTURE_SOURCE } from "./item-cubes";
import { convertUnmappedColorKeys, type FxModelData, type FxRenderedScene } from "./item-fx-assets";
import { HAZARD_ITEM_IDX, type ItemHazardKind } from "./item-hazards";

/**
 * Speed races and time attack fly the item hazards' carriers as scenery
 * (`item-hazard-scenery-admitted`, not release behaviour). A hazard whose
 * nested scene holds a carrier model (the factory propeller robots, ice_I10's
 * penguins, tomb_I09's pumpkin ghost) also shows the item it carries, the way
 * the item race presenter shows it (`trackHazards`): the item's Set model, or
 * the `object@model` Set model of the same folder, standing at the anchor.
 * Carried water mines also trap karts (hazard-traps.ts); bananas and mines
 * only show. A bare hazard (a banana or mine lying on the road,
 * only a hidden marker mesh) stays item-race only: it would look like a trap
 * that does nothing.
 */

export interface CarriedHazard {
  readonly name: string;
  readonly kind: ItemHazardKind;
  /** The movable's nested root; its world matrix moves the item. */
  readonly anchor: object;
  /** `object@model` override in the item's folder. */
  readonly model?: string;
}

interface SceneNode { className?: string; children?: readonly SceneNode[] }

/**
 * The scenery hazards that carry a model: the nested root has an `Relement`
 * child, not just its own (hidden) marker geometry. Hidden mines without a
 * model show nothing, as in the item race.
 */
export function carriedHazards(objects: readonly ItemTrackObject[]): CarriedHazard[] {
  const carried: CarriedHazard[] = [];
  for (const object of objects) {
    const kind = movableType(object);
    if (kind !== "banana" && kind !== "mine" && kind !== "mineHidden" && kind !== "waterMine" && kind !== "forceZone") continue;
    const root = object.object as SceneNode | undefined;
    // Factory's legacy spring traps are bare Relement anchors. Their Set model
    // and knockback are both active in speed/time attack, so they must be visible.
    if (!root || (kind !== "forceZone" && !root.children?.some(child => child.className === "Relement"))) continue;
    const model = propertyAttribute(object, "object", "model");
    if (kind === "mineHidden" && !model) continue;
    carried.push({ name: object.name, kind, anchor: root, ...(model ? { model } : {}) });
  }
  return carried;
}

/** The model a hazard item stands as: the Set state's `item` (its `itemSize` scale), or `object@model`. */
export async function hazardItemModel(library: ItemCatalogLibrary, kind: ItemHazardKind, override?: string):
Promise<{ path: string; scale: number } | undefined> {
  const entry = ITEM_REGISTRY.find(item => item.idx === HAZARD_ITEM_IDX[kind]);
  if (!entry) throw Error(`道具陷阱 ${kind} 不在道具登记表。`);
  const bml = decodeItemBml(await uniqueBytes(library, `item/${entry.folder}/item.bml`));
  const set = bml.bases[entry.base]?.states.get("Set");
  const exists = (path: string) => library.exactCanonicalCandidates(path).length > 0;
  const path = set?.item ? itemModelCandidates(entry, set.item).find(exists) : undefined;
  if (!path) return undefined;
  if (override) {
    const sibling = `${path.slice(0, path.lastIndexOf("/") + 1)}${override}.1s`;
    return exists(sibling) ? { path: sibling, scale: 1 } : undefined;
  }
  return { path, scale: set!.itemSize ?? 1 };
}

export interface HazardItemScenery {
  readonly count: number;
  /** Call right after the track scene's update (the anchors' world matrices are current). */
  update(timeMs: number, camera?: Camera, width?: number, height?: number): void;
  dispose(): void;
}

export interface HazardItemSceneryOps {
  decodeModel(bytes: Uint8Array): FxModelData;
  loadScene(model: FxModelData, library: unknown, path: string, metadata: { id: string },
    options: Record<string, unknown>): Promise<FxRenderedScene>;
}

interface TrackScene {
  object: Object3D;
  clientWorldElements(node: object): ArrayLike<number> | undefined;
}

interface Entry { hazard: CarriedHazard; scale: number; mount: Group; scene: FxRenderedScene }

/**
 * Assemble one copy of each carried item under the track scene object (client
 * space), each in a mount that follows its anchor's world position.
 */
export async function loadHazardItemScenery(
  library: ItemCatalogLibrary,
  hazards: readonly CarriedHazard[],
  track: TrackScene,
  environment: unknown,
  stageBinding: unknown,
  ops: HazardItemSceneryOps,
): Promise<HazardItemScenery> {
  const textureCache = new Map<unknown, { dispose(): void }>();
  const looks = new Map<string, Promise<{ path: string; scale: number } | undefined>>();
  const models = new Map<string, Promise<FxModelData>>();
  const entries: Entry[] = [];
  const dispose = () => {
    for (const entry of entries) {
      entry.mount.removeFromParent();
      entry.scene.dispose();
    }
    entries.length = 0;
    for (const texture of textureCache.values()) texture.dispose();
    textureCache.clear();
  };
  try {
    for (const hazard of hazards) {
      const lookKey = `${hazard.kind}|${hazard.model ?? ""}`;
      let look = looks.get(lookKey);
      if (!look) looks.set(lookKey, look = hazardItemModel(library, hazard.kind, hazard.model));
      const item = await look;
      if (!item) continue;
      let model = models.get(item.path);
      if (!model) models.set(item.path, model = uniqueBytes(library, item.path).then(bytes => {
        const decoded = ops.decodeModel(bytes);
        convertUnmappedColorKeys(decoded.root);
        return decoded;
      }));
      const scene = await ops.loadScene(await model, library, item.path, { id: "item" }, {
        environment, stageBinding, advanceEnvironment: false, textureCache,
        // Item models borrow textures from item/common, like the item race presenter's.
        advertisementSources: [ITEM_COMMON_TEXTURE_SOURCE],
        // Mounted inside the track scene object, which already turns client space into three's.
        convertClientCoordinates: false,
      });
      const mount = new Group();
      mount.name = `hazardItem:${hazard.name}`;
      mount.matrixAutoUpdate = false;
      mount.visible = false;
      mount.add(scene.object);
      track.object.add(mount);
      entries.push({ hazard, scale: item.scale, mount, scene });
      // The presenter starts a track hazard's item at tick 1 and lets it run.
      scene.reset(1);
      scene.playControllers?.(1, 0);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    get count() { return entries.length; },
    update(timeMs, camera, width, height) {
      // Billboards in the item models (the water mine's) need a camera to update.
      if (!camera) return;
      for (const { hazard, scale: k, mount, scene } of entries) {
        const world = track.clientWorldElements(hazard.anchor);
        const x = world?.[12], y = world?.[13], z = world?.[14];
        if (x === undefined || y === undefined || z === undefined ||
          !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          mount.visible = false;
          continue;
        }
        // Position only, upright in the world, like the presenter's atPoint.
        mount.matrix.set(k, 0, 0, x, 0, k, 0, y, 0, 0, k, z, 0, 0, 0, 1);
        mount.matrixWorldNeedsUpdate = true;
        mount.visible = true;
        scene.update(timeMs, camera, width, height);
      }
    },
    dispose,
  };
}
