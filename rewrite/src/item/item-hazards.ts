import { ITEM_RULES, ItemIdx, type ItemCatalog } from "./item-catalog";
import {
  clientToThree, movableType, propertyAttribute, trackObjectPosition,
  type ItemTrackModel, type ItemTrackObject, type ItemVec3,
} from "./item-cube-source";
import type { ItemPairObject, ItemPairWorld, ItemWorldMatrix } from "./item-cubes";
import { sweepOrigin, sweptThrough } from "./item-race-rules";

/**
 * Pre-placed item hazards (track bananas, mines, hidden mines and water
 * mines). Their visuals are the movables' own nested scenes, which the item
 * race admits into the track scene; this module only tracks where they are and
 * reports when the local kart enters one — also when it crossed one between
 * two frames (a fast kart or a long frame), but not across a reset or warp jump.
 */

export type ItemHazardKind = "banana" | "mine" | "mineHidden" | "waterMine";

export const HAZARD_ITEM_IDX: Readonly<Record<ItemHazardKind, number>> = {
  banana: ItemIdx.banana,
  mine: ItemIdx.mine,
  mineHidden: ItemIdx.mine,
  waterMine: ItemIdx.waterMine,
};

export interface ItemHazardDescriptor {
  /** The movable's `instanceOrdinal`, the `hazardId` of a `hit` report. */
  readonly id: number;
  readonly name: string;
  readonly kind: ItemHazardKind;
  readonly itemIdx: number;
  /** Trigger radius: the object's `size`, else the item's Set size (water mine: Explode size). */
  readonly radius: number;
  readonly clientPosition: readonly [number, number, number];
  readonly position: ItemVec3;
  /** Nested Relement rendered by the track scene; its world matrix moves the hazard. */
  readonly anchor: object;
  /** `object@model` override (gold_I06 mines use item/mine/item01_trans). */
  readonly model?: string;
  /** Ambient `<sound filename=…>` of the movable (factory robots' propellers). */
  readonly sound?: string;
  readonly onlyItemGame: boolean;
}

export interface ItemHazardSource {
  readonly hazards: readonly ItemHazardDescriptor[];
  readonly cooldownMs: number;
}

export interface ItemHazardHit {
  id: number;
  itemIdx: number;
  kind: ItemHazardKind;
  /** three.js position of the hazard when it fired. */
  position: ItemVec3;
}

export interface ItemHazardField {
  readonly count: number;
  readonly hazards: readonly ItemHazardDescriptor[];
  attach(world: ItemPairWorld, kartPosition: () => ItemVec3, canTrigger: () => boolean,
    onTrigger: (hazard: ItemHazardHit) => void): void;
  /** Call once per rendered frame after the track scene update. */
  update(nowMs: number): void;
  position(id: number): ItemVec3 | undefined;
  dispose(): void;
}

function isHazardKind(type: string | undefined): type is ItemHazardKind {
  return type === "banana" || type === "mine" || type === "mineHidden" || type === "waterMine";
}

function hazardRadius(object: ItemTrackObject, kind: ItemHazardKind, catalog: ItemCatalog): number {
  const size = propertyAttribute(object, "object", "size");
  if (size !== undefined) {
    const value = Number(size);
    if (!/^\d+(?:\.\d+)?$/.test(size) || !(value > 0)) throw Error(`道具陷阱 ${object.name} size=${size} 无效。`);
    return Math.fround(value);
  }
  const radius = catalog.get(HAZARD_ITEM_IDX[kind])?.behaviour.radius;
  if (radius === undefined) throw Error(`道具 ${kind} 缺少触发半径。`);
  return Math.fround(radius);
}

/** Enumerate the item hazards of the exact track*.1s that was loaded. */
export function createItemHazardSource(model: ItemTrackModel, catalog: ItemCatalog): ItemHazardSource {
  if (model.root.kind !== "track") throw Error("道具陷阱需要 TrackContainer。");
  const hazards: ItemHazardDescriptor[] = [];
  const ids = new Set<number>();
  for (const object of model.root.trackObjects) {
    if (object.kind !== "ToMovableObject") continue;
    const kind = movableType(object);
    if (!isHazardKind(kind)) continue;
    const id = object.instanceOrdinal;
    if (id === undefined || !Number.isSafeInteger(id) || ids.has(id))
      throw Error(`道具陷阱 ${object.name} 缺少唯一原件序号。`);
    ids.add(id);
    const anchor = object.object;
    if (!anchor || typeof anchor !== "object" || (anchor as { kind?: unknown }).kind !== "node")
      throw Error(`道具陷阱 ${object.name} 缺少嵌套场景。`);
    // Like the moving cubes, a hazard without a finite transform cannot be placed.
    const clientPosition = trackObjectPosition(object);
    if (!clientPosition) continue;
    const modelStem = propertyAttribute(object, "object", "model");
    const sound = propertyAttribute(object, "sound", "filename");
    hazards.push({
      id, name: object.name, kind, itemIdx: HAZARD_ITEM_IDX[kind],
      radius: hazardRadius(object, kind, catalog),
      clientPosition, position: clientToThree(clientPosition), anchor,
      ...(modelStem ? { model: modelStem } : {}),
      ...(sound ? { sound } : {}),
      onlyItemGame: propertyAttribute(object, "object", "onlyItemGame")?.toLowerCase() === "true",
    });
  }
  return { hazards, cooldownMs: ITEM_RULES.hazardCooldownMs };
}

interface HazardEntry {
  descriptor: ItemHazardDescriptor;
  position: ItemVec3;
  inside: boolean;
  triggered: boolean;
  triggeredAt: number;
}

class HazardField implements ItemHazardField {
  readonly entries: HazardEntry[];
  readonly byId = new Map<number, HazardEntry>();
  attached = false;
  disposed = false;

  constructor(readonly source: ItemHazardSource, readonly worldMatrix: ItemWorldMatrix | undefined) {
    this.entries = source.hazards.map(descriptor => ({
      descriptor, position: { ...descriptor.position }, inside: false, triggered: false, triggeredAt: 0,
    }));
    for (const entry of this.entries) this.byId.set(entry.descriptor.id, entry);
  }

  get count(): number { return this.entries.length; }
  get hazards(): readonly ItemHazardDescriptor[] { return this.source.hazards; }

  attach(world: ItemPairWorld, kartPosition: () => ItemVec3, canTrigger: () => boolean,
    onTrigger: (hazard: ItemHazardHit) => void): void {
    if (this.disposed || this.attached) throw Error("道具陷阱已释放或重复绑定。");
    this.attached = true;
    if (this.entries.length === 0) return;
    const cooldown = this.source.cooldownMs;
    let last: { position: ItemVec3; atMs: number } | undefined;
    const contact: ItemPairObject = {
      name: "GoItemHazard[]",
      category: 2,
      active: true,
      removeRequested: false,
      slot12: () => {},
      slot13: (peer, nowMs) => {
        if (this.disposed || !world.isKartPeer(peer)) return;
        const now = nowMs >>> 0;
        const kart = { ...kartPosition() };
        const from = last ? sweepOrigin(last.position, kart, (now - last.atMs) >>> 0) : undefined;
        last = { position: kart, atMs: now };
        const allowed = canTrigger();
        for (const entry of this.entries) {
          const dx = Math.fround(kart.x - entry.position.x);
          const dy = Math.fround(kart.y - entry.position.y);
          const dz = Math.fround(kart.z - entry.position.z);
          const distance = Math.fround(Math.sqrt(Math.fround(
            Math.fround(Math.fround(dx * dx) + Math.fround(dy * dy)) + Math.fround(dz * dz))));
          const inside = Number.isFinite(distance) && distance <= entry.descriptor.radius;
          const entered = !entry.inside &&
            (inside || sweptThrough(from, kart, entry.position, entry.descriptor.radius));
          // The inside flag follows the kart even while triggers are suppressed,
          // so a kart released inside a hazard has to leave and re-enter it.
          entry.inside = inside;
          if (!entered || !allowed) continue;
          if (entry.triggered && ((now - entry.triggeredAt) >>> 0) < cooldown) continue;
          entry.triggered = true;
          entry.triggeredAt = now;
          onTrigger({ id: entry.descriptor.id, itemIdx: entry.descriptor.itemIdx,
            kind: entry.descriptor.kind, position: { ...entry.position } });
        }
      },
      commit: () => {},
      destroy: () => { contact.active = false; },
    };
    world.queueKartPairObject(contact);
  }

  update(_nowMs: number): void {
    if (this.disposed || !this.worldMatrix) return;
    for (const entry of this.entries) {
      const matrix = this.worldMatrix(entry.descriptor.anchor);
      if (!matrix) continue;
      const client = [matrix[12]!, matrix[13]!, matrix[14]!];
      if (client.every(Number.isFinite)) entry.position = clientToThree(client);
    }
  }

  position(id: number): ItemVec3 | undefined {
    const entry = this.byId.get(id);
    return entry ? { ...entry.position } : undefined;
  }

  dispose(): void { this.disposed = true; }
}

/** `worldMatrix` reads the track scene's client world matrices (`renderScene.clientWorldElements`). */
export function createItemHazardField(source: ItemHazardSource,
  worldMatrix: ItemWorldMatrix | undefined): ItemHazardField {
  return new HazardField(source, worldMatrix);
}
