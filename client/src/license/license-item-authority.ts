/**
 * The 驾照考试 item missions' stand-in for the game node's item authority
 * (server-go internal/game/itemmode, ITEM_MODE.md §5–§7): a license race has
 * one racer and its course's targets, so the browser decides what the node
 * would. It answers the item race controller's requests (cube, use, place,
 * hit, swap, change, slots) on the controller's own clock, gives the step's
 * release set-up (riderSchool@cn.xml itemslot0/1, itemSlotCnt, cubeItem,
 * nonLimitItem, oneTime), resolves hits on the targets (the pirate boards and
 * the iron), and fires the course's scripted attacks at the player.
 */
import type { ItemRaceConnection, ItemRequestAction } from "../item/item-race-controller";
import type { ItemCatalog, ItemDefinition } from "../item/item-catalog";
import { clientToThreePoint, distance, threeToClient, type Vec3 } from "../item/item-race-rules";
import type { ItemChangers, ItemServerEvent } from "../multiplayer/server-events";

const EMPTY = -1;
/** server-go itemmode EtaMs: a tracking item takes at least this long. */
const MIN_ETA_MS = 300;

/** A target the items may hit: a pirate board (target<N>) or the iron (magnet). */
export interface LicenseItemTarget {
  id: string;
  /** three.js pose. */
  pose: { position: Vec3 };
  /** Gone after a hit (a board that was shot down). */
  alive: boolean;
}

export interface LicenseItemAuthorityOptions<Target extends LicenseItemTarget = LicenseItemTarget> {
  playerId: string;
  catalog: Pick<ItemCatalog, "get">;
  /** itemSlotCnt (1 or 2). */
  capacity: number;
  /** itemslot0/1 as item idx: the slots at GO. */
  startSlots: readonly number[];
  /** cubeItem: what every item box gives (none: boxes give nothing). */
  cubeItem?: number;
  /** nonLimitItem: the slot-0 item comes back after it is used. */
  refill?: boolean;
  /** 道具换位卡 / 道具变更卡 counts (-1 unlimited, 0 none). */
  changers?: { slot: number; item: number };
  /** What 道具变更卡 (Z) turns slot 0 into (itemslot1 of a one-slot step). */
  changeTo?: number;
  /** The controller's clock (the race's effective time). */
  now(): number;
  /** The local kart (three.js). */
  position(): Vec3;
  targets?: readonly Target[];
  /** A target was hit (the mission counts it). */
  onTargetHit?(target: Target, itemId: number): void;
  /** Where a thrown item lands instead of the thrower's point (three.js), if anywhere. */
  landing?(itemId: number, point: Vec3): Vec3 | undefined;
  /** Every request, for the mission (a use of a given item…). */
  onRequest?(action: ItemRequestAction, fields: Record<string, unknown>): void;
}

interface PendingHit { at: number; useId: number; itemId: number; targetIds: string[] }
interface PendingArea { at: number; useId: number; itemId: number; point: Vec3; radius: number }

export class LicenseItemAuthority<Target extends LicenseItemTarget = LicenseItemTarget>
  implements ItemRaceConnection {
  private slots: number[];
  private changerCards: { slot: number; item: number };
  private itemArmed = false;
  private useId = 0;
  private listener?: (event: ItemServerEvent) => void;
  private readonly hits: PendingHit[] = [];
  private readonly areas: PendingArea[] = [];
  /** useId → item, for the place report of a time bomb. */
  private readonly uses = new Map<number, number>();
  private started = false;
  private cubeItem?: number;

  constructor(readonly options: LicenseItemAuthorityOptions<Target>) {
    this.slots = new Array(Math.max(1, options.capacity)).fill(EMPTY);
    this.changerCards = { ...(options.changers ?? { slot: 0, item: 0 }) };
    this.cubeItem = options.cubeItem;
  }

  get currentSlots(): readonly number[] { return this.slots; }

  /** What the item boxes give from now on (连续导弹: the magnet once every board is down). */
  setCubeItem(itemId: number | undefined): void { this.cubeItem = itemId; }

  private changers(): ItemChangers {
    return { slot: this.changerCards.slot, item: this.changerCards.item, itemArmed: this.itemArmed };
  }

  private event<T extends Record<string, unknown>>(fields: T): ItemServerEvent {
    return { type: "item", roomId: "license", raceId: "license", ...fields } as unknown as ItemServerEvent;
  }

  private emit(fields: Record<string, unknown>): void {
    const event = this.event(fields);
    // The node pushes after the request that caused it has been answered.
    queueMicrotask(() => this.listener?.(event));
  }

  subscribeItem(listener: (event: ItemServerEvent) => void): () => void {
    this.listener = listener;
    return () => { if (this.listener === listener) this.listener = undefined; };
  }

  /** At GO: the step's items in the slots (not reason "start", which flashes 迅). */
  start(): void {
    if (this.started) return;
    this.started = true;
    const slots = this.slots.map((_slot, index) => this.options.startSlots[index] ?? EMPTY);
    this.slots = slots;
    this.itemArmed = this.slots[0] !== EMPTY && this.changerCards.item !== 0;
    this.emit({ action: "slots", slots: [...this.slots], changers: this.changers() });
  }

  sendItem(action: ItemRequestAction, fields: Record<string, unknown> = {}): Promise<unknown> {
    try {
      this.options.onRequest?.(action, fields);
      return Promise.resolve(this.handle(action, fields));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private handle(action: ItemRequestAction, fields: Record<string, unknown>): unknown {
    switch (action) {
      case "cube": return this.cube(Number(fields.cubeId));
      case "use": return this.use(fields);
      case "place": return this.place(fields);
      case "hit": return this.event({ action: "hit", playerId: this.options.playerId, useId: 0, itemId: 0,
        result: "hit", ...fields });
      case "swap": return this.swap();
      case "change": return this.change();
      case "escape": return this.event({ action: "slots", slots: [...this.slots], changers: this.changers() });
      case "slots":
      default:
        return this.event({ action: "slots", slots: [...this.slots], changers: this.changers() });
    }
  }

  private cube(cubeId: number): unknown {
    const free = this.slots.indexOf(EMPTY);
    const itemId = free >= 0 && this.cubeItem !== undefined ? this.cubeItem : null;
    if (itemId !== null) this.slots[free] = itemId;
    if (free === 0 && itemId !== null) this.itemArmed = this.changerCards.item !== 0;
    return this.event({ action: "grant", cubeId, itemId, ...(free < 0 ? { reason: "full" } : {}),
      slots: [...this.slots], changers: this.changers() });
  }

  private definition(itemId: number): ItemDefinition {
    const definition = this.options.catalog.get(itemId);
    if (!definition) throw new Error("ITEM_UNKNOWN");
    return definition;
  }

  private use(fields: Record<string, unknown>): unknown {
    const itemId = Number(fields.itemId);
    if (this.slots[0] !== itemId) throw new Error("ITEM_NOT_HELD");
    const definition = this.definition(itemId);
    const behaviour = definition.behaviour;
    // Slot 0 leaves; nonLimitItem puts the same item back (导弹练习, 磁铁练习).
    this.slots = this.options.refill ? [...this.slots] : [...this.slots.slice(1), EMPTY];
    this.itemArmed = this.slots[0] !== EMPTY && this.itemArmed && this.changerCards.item !== 0;
    const useId = ++this.useId;
    this.uses.set(useId, itemId);
    const now = this.options.now();
    const me = this.options.playerId;
    const target = typeof fields.targetId === "string"
      ? this.options.targets?.find(entry => entry.id === fields.targetId && entry.alive) : undefined;
    let targets: string[] = [];
    let etaMs = 0;
    switch (behaviour.target) {
      case "self":
      case "team":
        targets = [me];
        break;
      case "locked":
        // No lock: a misfire with no target (TargetAimed).
        if (target) {
          targets = [target.id];
          if (behaviour.speed) {
            const gap = distance(this.options.position(), target.pose.position);
            etaMs = Math.round(Math.min(Math.max(gap / behaviour.speed * 1000, MIN_ETA_MS),
              Math.max(behaviour.maxEtaMs ?? MIN_ETA_MS, MIN_ETA_MS)));
          }
        }
        break;
      default:
        targets = [];
    }
    if (target && behaviour.family !== "magnet")
      this.hits.push({ at: now + etaMs, useId, itemId, targetIds: [target.id] });
    let point = fields.point && typeof fields.point === "object" ? fields.point as Vec3 : undefined;
    if (point && behaviour.family === "waterBomb") {
      const landing = this.options.landing?.(itemId, clientToThreePoint(point));
      if (landing) point = threeToClient(landing);
      this.areas.push({ at: now + behaviour.delayMs, useId, itemId, point: clientToThreePoint(point),
        radius: behaviour.radius ?? 0 });
    }
    return this.event({ action: "used", playerId: me, useId, itemId, targets, startAt: now, etaMs,
      ...(point ? { point } : {}), slots: [...this.slots], changers: this.changers() });
  }

  private place(fields: Record<string, unknown>): unknown {
    const useId = Number(fields.useId);
    const point = fields.point as Vec3 | undefined;
    if (!point) throw new Error("ITEM_POINT_REQUIRED");
    const itemId = this.uses.get(useId) ?? 0;
    const behaviour = this.options.catalog.get(itemId)?.behaviour;
    // The time bomb goes off where it is reported: whatever stands around it.
    if (behaviour?.family === "timeBomb")
      this.areas.push({ at: this.options.now(), useId, itemId, point: clientToThreePoint(point),
        radius: behaviour.radius ?? 0 });
    return this.event({ action: "placed", playerId: this.options.playerId, useId, itemId, point });
  }

  private swap(): unknown {
    if (this.slots.length < 2 || this.changerCards.slot === 0) throw new Error("NO_SLOT_CHANGER");
    this.slots = [this.slots[1]!, this.slots[0]!, ...this.slots.slice(2)];
    if (this.changerCards.slot > 0) this.changerCards.slot -= 1;
    return this.event({ action: "slots", slots: [...this.slots], changers: this.changers() });
  }

  private change(): unknown {
    if (this.changerCards.item === 0 || !this.itemArmed || this.slots[0] === EMPTY)
      throw new Error("NO_ITEM_CHANGER");
    if (this.options.changeTo !== undefined) this.slots[0] = this.options.changeTo;
    if (this.changerCards.item > 0) this.changerCards.item -= 1;
    this.itemArmed = false;
    return this.event({ action: "slots", slots: [...this.slots], changers: this.changers() });
  }

  /**
   * A scripted attack on the player (an event:* point of the course): the
   * use of `itemId` by `from` (an NPC that is not drawn), arriving after `etaMs`.
   */
  attack(itemId: number, from: string, etaMs: number, extra: Record<string, unknown> = {}): void {
    this.emit({ action: "used", useId: ++this.useId, itemId, playerId: from,
      targets: [this.options.playerId], startAt: this.options.now(), etaMs, ...extra });
  }

  /** Lands the items in flight on the targets. Call every frame with the controller's clock. */
  update(nowMs: number): void {
    for (let index = this.hits.length - 1; index >= 0; index--) {
      const hit = this.hits[index]!;
      if (hit.at > nowMs) continue;
      this.hits.splice(index, 1);
      for (const id of hit.targetIds) {
        const target = this.options.targets?.find(entry => entry.id === id);
        if (target?.alive) this.hitTarget(target, hit.useId, hit.itemId);
      }
    }
    for (let index = this.areas.length - 1; index >= 0; index--) {
      const area = this.areas[index]!;
      if (area.at > nowMs) continue;
      this.areas.splice(index, 1);
      for (const target of this.options.targets ?? [])
        if (target.alive && distance(target.pose.position, area.point) <= area.radius)
          this.hitTarget(target, area.useId, area.itemId);
    }
  }

  private hitTarget(target: Target, useId: number, itemId: number): void {
    this.emit({ action: "hit", playerId: target.id, useId, itemId, userId: this.options.playerId,
      result: "hit" });
    this.options.onTargetHit?.(target, itemId);
  }
}
