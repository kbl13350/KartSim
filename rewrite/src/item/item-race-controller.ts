/**
 * The local item race controller (道具赛, ITEM_MODE.md §5–§7): one per local
 * item race. It mirrors the server's item slots, turns the Ctrl/Alt/Z item
 * commands into `item` requests, aims rockets and magnets, schedules every
 * hit on the local kart on the shared `startAt` timeline, decides shields,
 * angels, EMP and escape immunity, checks the area items (banana, water bomb,
 * time bomb, barricade) against the local kart, reports hits and placements,
 * and feeds the item HUD and the item presenter.
 *
 * Nothing here may break the race: every entry point catches and logs. A
 * rejected use restores the last confirmed slots and takes back the effects
 * it started on the key press; a rejection that may mean the slots drifted
 * from the server's asks the server for them again.
 */
import type { ItemCommand, ItemCommandHandler } from "../input/item-input";
import type {
  ItemEscapedEvent, ItemGrantEvent, ItemHitEvent, ItemPlacedEvent, ItemScanEvent, ItemServerEvent,
  ItemSlotsEvent, ItemUsedEvent,
} from "../multiplayer/server-events";
import type {
  ItemAimPhase, ItemHudLogEntry, ItemHudNotice, ItemHudState,
} from "../ui/item-hud-state";
import { ITEM_RULES, ItemIdx, type ItemBehaviour, type ItemCatalog, type ItemDefinition } from "./item-catalog";
import type {
  ItemKartEffect, ItemPresenterPose, ItemRacePresenter,
} from "./item-race-presenter-contract";
import {
  ITEM_RACE_TUNING, bananaPoint, chooseAimTarget, clientToThreePoint, decideHit, distance,
  effectStartOffsetMs, kartEffectOf, physicsEffect, projectToStage, teamColor, threeToClient,
  victimsText, warningOf, waterBombPoint,
  type PhysicsItemEffect, type ProjectionCamera, type Vec3,
} from "./item-race-rules";
import { EMPTY_SLOT, ItemSlotMirror, sameSlots } from "./item-race-slots";

export type ItemRequestAction = "cube" | "use" | "place" | "hit" | "swap" | "change" | "escape" |
  "slots";

/** The race connection's item channel (race-session `sendItem` / `subscribeItem`). */
export interface ItemRaceConnection {
  sendItem(action: ItemRequestAction, fields?: Record<string, unknown>): Promise<unknown>;
  subscribeItem(listener: (event: ItemServerEvent) => void): () => void;
}

export interface ItemRaceEffectEvent {
  kind: string;
  phase: "start" | "end";
  atMs: number;
  reason?: string;
}

/** `physics.itemEffects` (driving/item-effects.ts VehicleItemEffects). */
export interface ItemRaceEffects {
  apply(kind: PhysicsItemEffect, durationMs: number, options?: {
    elapsedMs?: number; escapeImmunityMs?: number; target?: () => Vec3 | undefined;
  }): boolean;
  end(kind: PhysicsItemEffect): boolean;
  readonly immune: boolean;
  readonly canUseItem: boolean;
  readonly escapeShieldRemainingMs: number;
  remainingMs(kind: PhysicsItemEffect): number;
  consumeEvents(): ItemRaceEffectEvent[];
  /** Physics clock and running effects, to place a started effect on the presenter clock. */
  readonly clockMs?: number;
  readonly effects?: ReadonlyMap<string, { startMs: number; endMs: number }>;
}

/** The item-race members of the local AL (driving/item-mode.ts). */
export interface ItemRacePhysics {
  readonly itemSlotCapacity: number;
  setItemSlots(slots: readonly number[]): void;
  startItemBooster(): boolean;
  /** Take back a booster item the server refused (driving/item-mode.ts). */
  cancelItemBooster?(): boolean;
  readonly body: ItemPresenterPose & { linearVelocity: Vec3 };
  readonly itemEffects?: ItemRaceEffects;
}

export interface ItemRaceLocal {
  /** The local racer is racing: after the start, before its own finish. */
  racing(): boolean;
  /** A reset or a warp holds the kart: no item use, no hits, no area checks. */
  suspended(): boolean;
  /** A route point this far ahead of the kart (three.js), if the route has one. */
  routePointAhead?(distanceM: number): Vec3 | undefined;
}

export interface ItemRaceRemotes {
  pose(playerId: string): ItemPresenterPose | undefined;
  /** Still in the race: present, not departed, not finished. */
  racing(playerId: string): boolean;
}

export interface ItemRaceRosterEntry {
  playerId: string;
  name: string;
  team: 1 | 2 | null;
}

export interface ItemRaceControllerOptions {
  playerId: string;
  roster: readonly ItemRaceRosterEntry[];
  teamRace: boolean;
  catalog: Pick<ItemCatalog, "get">;
  physics: ItemRacePhysics;
  connection: ItemRaceConnection;
  local: ItemRaceLocal;
  remotes: ItemRaceRemotes;
  /** Server milliseconds → presenter clock (`toLocalTick`); undefined before the clock is bound. */
  toLocalMs(serverMs: number): number | undefined;
  /** The presenter clock (performance.now). */
  now(): number;
  presenter?: ItemRacePresenter;
  /** three.js position of a track hazard (ItemHazardField.position). */
  hazardPosition?(hazardId: number): Vec3 | undefined;
  log?(message: string, error?: unknown): void;
}

export interface ItemHazardTrigger {
  id: number;
  itemIdx: number;
  position?: Vec3;
}

export interface ItemPresentInput {
  nowMs: number;
  camera: unknown;
  width: number;
  height: number;
}

interface UseRecord {
  useId: number;
  itemId: number;
  userId: string;
  targets: readonly string[];
  startMs: number;
  etaMs: number;
  point?: Vec3;
  goodNotice?: ItemHudNotice;
  victims: string[];
}

interface IncomingHit {
  useId: number;
  itemId: number;
  userId: string;
  behaviour: ItemBehaviour;
  effectAt: number;
  warning?: "rocket" | "waterfly";
}

interface AreaRecord {
  useId: number;
  itemId: number;
  userId: string;
  behaviour: ItemBehaviour;
  point?: Vec3;
  activeFrom: number;
  activeUntil: number;
  radius: number;
  ownerGraceUntil?: number;
  /** Placed after its window: one check on the next frame. */
  lateCheck?: boolean;
}

interface AimState {
  itemId: number;
  phase: ItemAimPhase;
  targetId?: string;
  trackSince: number;
  soundPhase?: ItemAimPhase;
}

interface OwnTimeBomb {
  token: number;
  useId?: number;
  explodeAt: number;
}

interface TimeWindow { from: number; until: number }

/** The trap holding the local kart (for the escape notice). */
interface LocalTrap { useId: number; hazardId?: number }

/** A remote racer's bubble: its blue shield starts at its end, or at its early escape. */
interface RemoteTrap { useId: number; hazardId?: number; untilMs: number; escapeShieldMs: number }

type HitSource = "area" | "targeted" | "hazard";

const NO_UNDO = (): void => {};

/**
 * Rejections after which my slots may differ from the server's (a reply was
 * lost or could not be read, or slot 0 was not what I showed): error replies
 * carry no slots, so the controller asks for them (`slots`).
 */
const LOST_REPLY_CODES: ReadonlySet<string> = new Set(["INVALID_ITEM_EVENT", "INVALID_SEQUENCE"]);
const SLOT_DOUBT_CODES: ReadonlySet<string> = new Set([...LOST_REPLY_CODES, "ITEM_NOT_HELD", "INVALID_USE"]);

const AIM_SOUND_KEY = "item-aim";
const AIM_SOUND_STEMS = ["aiming", "inrange", "ontarget", "misfire"] as const;
const AIM_PHASE_INDEX: Readonly<Record<ItemAimPhase, number>> = { aiming: 0, inrange: 1, ontarget: 2 };
const UNNAMED_RACER = "车手";
/** Shown when Z is pressed: the item changer card comes with phase 3 (ITEM_MODE.md §9). */
export const ITEM_CHANGER_NOTICE = "道具变更卡暂未开放。";

export class ItemRaceController implements ItemCommandHandler {
  readonly playerId: string;
  readonly options: ItemRaceControllerOptions;
  readonly slots: ItemSlotMirror;
  readonly uses = new Map<number, UseRecord>();
  readonly incoming = new Map<number, IncomingHit>();
  readonly areas = new Map<number, AreaRecord>();
  readonly reported = new Set<number>();
  readonly scans = new Map<string, { slots: readonly number[]; until: number }>();
  /** My time bombs by request token, each placed when it explodes. */
  readonly bombs = new Map<number, OwnTimeBomb>();
  readonly remoteTraps = new Map<string, RemoteTrap>();
  readonly notices: ItemHudNotice[] = [];
  readonly log: ItemHudLogEntry[] = [];
  readonly lockWindows: TimeWindow[] = [];
  readonly cloudWindows: TimeWindow[] = [];
  shieldUntil = 0;
  angelUntil = 0;
  empUntil = 0;
  aim: AimState | undefined;
  aimScreen: { x: number; y: number } | undefined;
  localTrap: LocalTrap | undefined;
  infoCard: { itemIdx: number; until: number } | undefined;
  abuseUntil: number | undefined;
  reorderStartedAt: number | undefined;
  nowMs = 0;
  started = false;
  ended = false;
  disposed = false;
  private appliedSlots: number[];
  private slotChangerPending = false;
  private statusMessage: string | undefined;
  private escapeShieldShown = false;
  /** Angel windows covering me (my own by request token, teammates' by use). */
  private readonly angels = new Map<string, number>();
  /** The request whose booster or magnet pull runs now (a rejection only ends its own). */
  private boosterToken: number | undefined;
  private pullToken: number | undefined;
  private resyncing = false;
  private readonly unsubscribe: () => void;

  constructor(options: ItemRaceControllerOptions) {
    this.options = options;
    this.playerId = options.playerId;
    this.slots = new ItemSlotMirror(options.physics.itemSlotCapacity);
    this.appliedSlots = this.slots.slots;
    this.nowMs = options.now();
    this.unsubscribe = options.connection.subscribeItem(event => this.receive(event));
  }

  // ---- entry points -------------------------------------------------------

  /** Ctrl press/release/cancel, Alt and Z from the item input router. */
  handleCommand(command: ItemCommand, nowMs: number): void {
    if (this.disposed) return;
    this.guard("道具按键处理失败", () => {
      this.nowMs = nowMs;
      switch (command.kind) {
        case "use":
          if (command.phase === "press") this.pressUse(nowMs);
          else if (command.phase === "release") this.releaseUse(nowMs);
          else this.cancelAim();
          break;
        case "swap":
          this.swap(nowMs);
          break;
        case "change":
          // No change request: the server answers ITEM_CHANGER_UNAVAILABLE.
          if (this.canAct()) this.statusMessage = ITEM_CHANGER_NOTICE;
          break;
      }
    });
  }

  /** A cube was eaten (ItemCubeField onPickup). */
  cube(cubeId: number): void {
    if (this.disposed) return;
    this.guard("道具箱处理失败", () => {
      if (this.ended || !this.options.local.racing()) return;
      const capacity = this.options.physics.itemSlotCapacity >= 3 ? 3 : 2;
      this.send("cube", { cubeId, capacity }).then(
        reply => this.guard("道具箱回包处理失败", () => this.onGrant(reply as ItemGrantEvent)),
        error => {
          this.warn(`道具箱 ${cubeId} 请求被拒绝`, error);
          this.resyncAfter(error, LOST_REPLY_CODES);
        });
    });
  }

  /** A track hazard fired (ItemHazardField onTrigger). */
  hazard(trigger: ItemHazardTrigger): void {
    if (this.disposed) return;
    this.guard("赛道道具处理失败", () => {
      if (this.ended || !this.options.local.racing()) return;
      const definition = this.options.catalog.get(trigger.itemIdx);
      if (!definition) return;
      const now = this.nowMs;
      this.resolveHit({ useId: 0, itemId: trigger.itemIdx, hazardId: trigger.id,
        behaviour: definition.behaviour, effectAt: now,
        position: trigger.position ?? this.localPose().position }, now, "hazard");
    });
  }

  /** One simulation frame, before the local physics update. */
  update(nowMs: number): void {
    if (this.disposed) return;
    this.guard("道具赛控制器更新失败", () => {
      this.nowMs = nowMs;
      const racing = this.options.local.racing();
      if (racing) this.started = true;
      else if (this.started && !this.ended) this.endLocalRace();
      if (racing && !this.ended) {
        this.updateAim(nowMs);
        this.resolveIncoming(nowMs);
        this.updateTimeBomb(nowMs);
        this.checkAreas(nowMs);
      }
      this.presentLocalEffects(nowMs);
      this.updateRemoteTraps(nowMs);
      this.prune(nowMs);
    });
  }

  /** One presenter frame: the reticle projection and the presenter update. */
  present(input: ItemPresentInput): void {
    if (this.disposed) return;
    this.guard("道具表现层更新失败", () => {
      this.aimScreen = this.aim ? this.projectAim(input.camera as ProjectionCamera) : undefined;
      this.options.presenter?.update({
        nowMs: input.nowMs, camera: input.camera as never, width: input.width,
        height: input.height, pose: id => this.pose(id), localPlayerId: this.playerId,
      });
    });
  }

  /** This frame's item HUD state (MultiplayerRaceHud.setItemState). */
  hudState(nowMs: number): ItemHudState {
    const capacity = this.options.physics.itemSlotCapacity >= 3 ? 3 : 2;
    const state: ItemHudState = {
      slots: this.slots.slots,
      capacity,
      // Phase 3 decides who owns a slot changer card; until then Alt always swaps (∞).
      slotChanger: "infinite",
      itemChanger: 0,
      notices: this.notices.slice(),
      log: this.log.slice(),
    };
    if (this.reorderStartedAt !== undefined) {
      const progress = (nowMs - this.reorderStartedAt) / ITEM_RACE_TUNING.slotReorderMs;
      if (progress >= 0 && progress < 1) state.reorderProgress = progress;
    }
    const lock = this.activeWindow(this.lockWindows, nowMs);
    if (lock) state.lock = { remainingMs: lock.until - nowMs };
    let explodeAt: number | undefined;
    for (const bomb of this.bombs.values()) explodeAt = Math.min(explodeAt ?? Infinity, bomb.explodeAt);
    if (explodeAt !== undefined) state.timeBomb = { remainingMs: Math.max(0, explodeAt - nowMs) };
    if (this.aim && this.aimScreen) state.aim = { phase: this.aim.phase, ...this.aimScreen };
    const warning = this.currentWarning(nowMs);
    if (warning) state.warning = warning;
    if (this.activeWindow(this.cloudWindows, nowMs)) state.cloud = { opacity: 1, variant: 0 };
    if (this.abuseUntil !== undefined && nowMs < this.abuseUntil) state.abuseUntil = this.abuseUntil;
    if (this.infoCard && nowMs < this.infoCard.until) state.infoCard = { itemIdx: this.infoCard.itemIdx };
    const scan = [...this.scans].filter(([, entry]) => nowMs < entry.until)
      .map(([playerId, entry]) => ({ playerId, slots: entry.slots }));
    if (scan.length) state.scan = scan;
    return state;
  }

  /** True once after an Alt swap (race-session-update plays slot_changer.flac). */
  consumeSlotChangerSound(): boolean {
    const pending = this.slotChangerPending;
    this.slotChangerPending = false;
    return pending;
  }

  /** A short notice for the race (the Z item changer). */
  consumeStatusMessage(): string | undefined {
    const message = this.statusMessage;
    this.statusMessage = undefined;
    return message;
  }

  /** Forget every transient state (aim, timelines, areas, windows) and the slots. */
  reset(): void {
    this.cancelAim();
    this.incoming.clear();
    this.areas.clear();
    this.reported.clear();
    this.uses.clear();
    this.scans.clear();
    this.lockWindows.length = 0;
    this.cloudWindows.length = 0;
    this.shieldUntil = 0;
    this.angels.clear();
    this.angelUntil = 0;
    this.empUntil = 0;
    this.bombs.clear();
    this.remoteTraps.clear();
    this.localTrap = undefined;
    this.boosterToken = undefined;
    this.pullToken = undefined;
    this.infoCard = undefined;
    this.abuseUntil = undefined;
    this.reorderStartedAt = undefined;
    this.notices.length = 0;
    this.log.length = 0;
    this.slots.reset();
    this.applySlots(this.nowMs);
    this.presenterCall(presenter => presenter.reset());
  }

  dispose(): void {
    if (this.disposed) return;
    this.guard("道具赛控制器释放失败", () => {
      this.cancelAim();
      this.unsubscribe();
    });
    this.disposed = true;
    this.incoming.clear();
    this.areas.clear();
    this.uses.clear();
    this.bombs.clear();
    this.remoteTraps.clear();
  }

  // ---- local commands -----------------------------------------------------

  private canAct(): boolean {
    return !this.disposed && !this.ended && this.options.local.racing() &&
      !this.options.local.suspended();
  }

  private locked(nowMs: number): boolean {
    return this.activeWindow(this.lockWindows, nowMs) !== undefined;
  }

  /** Trapped, launched or stopped karts cannot use items; a slot lock allows only the angel. */
  private usable(itemId: number, nowMs: number): boolean {
    if (this.options.physics.itemEffects && !this.options.physics.itemEffects.canUseItem) return false;
    return itemId === ItemIdx.angel || !this.locked(nowMs);
  }

  private pressUse(nowMs: number): void {
    if (!this.canAct() || this.aim) return;
    const itemId = this.slots.slots[0] ?? EMPTY_SLOT;
    if (itemId === EMPTY_SLOT || !this.usable(itemId, nowMs)) return;
    const definition = this.options.catalog.get(itemId);
    if (!definition) return;
    if (definition.behaviour.use === "aim") {
      this.aim = { itemId, phase: "aiming", trackSince: nowMs };
      this.updateAim(nowMs);
      return;
    }
    this.useItem(definition, nowMs);
  }

  private releaseUse(nowMs: number): void {
    const aim = this.aim;
    if (!aim) return;
    this.cancelAim();
    if (!this.canAct() || this.slots.slots[0] !== aim.itemId || !this.usable(aim.itemId, nowMs)) return;
    const definition = this.options.catalog.get(aim.itemId);
    if (!definition) return;
    const targetId = aim.phase === "ontarget" ? aim.targetId : undefined;
    if (!targetId) this.playAimSound(definition, 3, false);
    this.useItem(definition, nowMs, targetId);
  }

  private cancelAim(): void {
    if (!this.aim) return;
    this.aim = undefined;
    this.aimScreen = undefined;
    this.presenterCall(presenter => presenter.stopSound(AIM_SOUND_KEY));
  }

  private swap(nowMs: number): void {
    if (!this.canAct() || this.aim) return;
    const slots = this.slots.slots;
    if (slots.length < 2 || slots[0] === EMPTY_SLOT || slots[1] === EMPTY_SLOT) return;
    const token = this.slots.begin("swap");
    this.applySlots(nowMs);
    this.reorderStartedAt = nowMs;
    this.slotChangerPending = true;
    this.send("swap").then(
      reply => this.guard("换位回包处理失败", () => {
        this.slots.confirm((reply as ItemSlotsEvent).slots, token);
        this.applySlots(this.nowMs);
      }),
      error => {
        this.slots.reject(token);
        this.applySlots(this.nowMs);
        this.warn("道具换位被拒绝", error);
        this.resyncAfter(error, SLOT_DOUBT_CODES);
      });
  }

  private useItem(definition: ItemDefinition, nowMs: number, targetId?: string): void {
    const behaviour = definition.behaviour;
    const itemId = definition.idx;
    const fields: Record<string, unknown> = { itemId };
    if (targetId) fields.targetId = targetId;
    const pose = this.localPose();
    if (behaviour.use === "drop") fields.point = threeToClient(bananaPoint(pose, behaviour));
    else if (behaviour.use === "throw") {
      fields.point = threeToClient(waterBombPoint(pose, this.options.physics.body.linearVelocity,
        behaviour, ITEM_RULES.waterBombLeadMs));
    }
    const token = this.slots.begin("use");
    this.applySlots(nowMs);
    const undo = this.startOwnEffect(definition, nowMs, token, targetId);
    if (itemId === ItemIdx.timeBomb) {
      this.bombs.set(token, { token, explodeAt: nowMs + behaviour.delayMs });
      this.kartEffect(this.playerId, "timeBomb", nowMs, behaviour.delayMs);
    }
    this.send("use", fields).then(
      reply => this.guard("道具使用回包处理失败", () => {
        const used = reply as ItemUsedEvent;
        this.slots.confirm(used.slots, token);
        this.applySlots(this.nowMs);
        this.recordUse(used, true);
        // Each time bomb follows its own use's timeline.
        const bomb = this.bombs.get(token);
        if (bomb) {
          bomb.useId = used.useId;
          const startMs = this.uses.get(used.useId)?.startMs;
          if (startMs !== undefined) bomb.explodeAt = startMs + behaviour.delayMs;
        }
      }),
      error => {
        this.slots.reject(token);
        this.applySlots(this.nowMs);
        this.guard("道具使用撤回失败", undo);
        this.dropTimeBomb(token);
        this.warn(`道具 ${itemId} 使用被拒绝`, error);
        this.resyncAfter(error, SLOT_DOUBT_CODES);
      });
  }

  /**
   * Effects of my own items that start at the key press, before the reply.
   * Returns what a rejection takes back: the booster or magnet pull of this
   * request while it still runs, and the shield, angel or EMP window it
   * opened (with its visual), unless a hit already spent it. The UFO slow an
   * EMP ended stays ended.
   */
  private startOwnEffect(definition: ItemDefinition, nowMs: number, token: number,
    targetId?: string): () => void {
    const behaviour = definition.behaviour;
    const effects = this.options.physics.itemEffects;
    switch (behaviour.effect) {
      case "boost": {
        if (!this.options.physics.startItemBooster()) return NO_UNDO;
        this.boosterToken = token;
        return () => {
          // A later booster item restarted the boost: that one keeps it.
          if (this.boosterToken !== token) return;
          this.boosterToken = undefined;
          this.options.physics.cancelItemBooster?.();
        };
      }
      case "shield": {
        const previous = this.shieldUntil;
        const until = nowMs + behaviour.effectMs;
        this.shieldUntil = until;
        this.kartEffect(this.playerId, "shield", nowMs, behaviour.effectMs);
        return () => {
          // Spent on a hit, or replaced by another shield: nothing to take back.
          if (this.shieldUntil !== until) return;
          this.shieldUntil = previous;
          this.restoreOwnWindow("shield", previous);
        };
      }
      case "angel": {
        const key = `own:${token}`;
        this.setAngel(key, nowMs + behaviour.effectMs);
        this.kartEffect(this.playerId, "angel", nowMs, behaviour.effectMs);
        return () => {
          if (!this.angels.delete(key)) return;
          this.refreshAngel();
          this.restoreOwnWindow("angel", this.angelUntil);
        };
      }
      case "emp": {
        const previous = this.empUntil;
        const until = nowMs + behaviour.effectMs;
        this.empUntil = until;
        effects?.end("slow");
        this.kartEffect(this.playerId, "emp", nowMs, behaviour.effectMs);
        return () => {
          if (this.empUntil !== until) return;
          this.empUntil = previous;
          this.restoreOwnWindow("emp", previous);
        };
      }
      case "pull": {
        if (!targetId || !effects) return NO_UNDO;
        const pulled = effects.apply("pull", behaviour.effectMs, {
          target: () => {
            const pose = this.options.remotes.pose(targetId);
            return pose ? { ...pose.position } : undefined;
          },
        });
        if (!pulled) return NO_UNDO;
        this.pullToken = token;
        return () => {
          if (this.pullToken !== token) return;
          this.pullToken = undefined;
          effects.end("pull");
        };
      }
      default:
        return NO_UNDO;
    }
  }

  /** After a refused shield, angel or EMP: the visual ends, or goes back to the window still open. */
  private restoreOwnWindow(kind: "shield" | "angel" | "emp", until: number): void {
    const now = this.nowMs;
    if (until > now) this.kartEffect(this.playerId, kind, now, until - now);
    else this.endKartEffect(this.playerId, kind);
  }

  private setAngel(key: string, until: number): void {
    this.angels.set(key, Math.max(this.angels.get(key) ?? 0, until));
    this.refreshAngel();
  }

  private refreshAngel(): void {
    let until = 0;
    for (const value of this.angels.values()) until = Math.max(until, value);
    this.angelUntil = until;
  }

  /** A refused time bomb: the bomb balloon stays only for my other bombs. */
  private dropTimeBomb(token: number): void {
    if (!this.bombs.delete(token)) return;
    let last: number | undefined;
    for (const bomb of this.bombs.values()) last = Math.max(last ?? -Infinity, bomb.explodeAt);
    if (last !== undefined && last > this.nowMs)
      this.kartEffect(this.playerId, "timeBomb", this.nowMs, last - this.nowMs);
    else this.endKartEffect(this.playerId, "timeBomb");
  }

  /**
   * Ask the server for my slots after a rejection that may mean they drifted
   * apart (`codes`; request timeouts too): error replies carry no slots, so
   * the last confirmed slots could keep showing an item the server no longer
   * holds. One request at a time.
   */
  private resyncAfter(error: unknown, codes: ReadonlySet<string>): void {
    const code = error instanceof Error ? error.message : String(error);
    if (!codes.has(code) && !/timeout/i.test(code)) return;
    if (this.resyncing || this.ended || this.disposed) return;
    this.resyncing = true;
    this.send("slots").then(
      reply => {
        this.resyncing = false;
        this.guard("道具槽同步回包处理失败", () => {
          this.slots.confirm((reply as ItemSlotsEvent).slots);
          this.applySlots(this.nowMs);
        });
      },
      failure => {
        this.resyncing = false;
        this.warn("道具槽同步失败", failure);
      });
  }

  // ---- aiming -------------------------------------------------------------

  private updateAim(nowMs: number): void {
    const aim = this.aim;
    if (!aim) return;
    if (!this.canAct() || this.slots.slots[0] !== aim.itemId || !this.usable(aim.itemId, nowMs)) {
      this.cancelAim();
      return;
    }
    const candidate = chooseAimTarget(this.localPose(), this.aimCandidates());
    if (!candidate) {
      aim.phase = "aiming";
      aim.targetId = undefined;
    } else if (candidate.playerId !== aim.targetId) {
      aim.targetId = candidate.playerId;
      aim.trackSince = nowMs;
      aim.phase = "inrange";
    } else if (nowMs - aim.trackSince >= ITEM_RACE_TUNING.aimLockMs) {
      aim.phase = "ontarget";
    }
    if (aim.soundPhase !== aim.phase) {
      aim.soundPhase = aim.phase;
      const definition = this.options.catalog.get(aim.itemId);
      if (definition) this.playAimSound(definition, AIM_PHASE_INDEX[aim.phase], true);
    }
  }

  private aimCandidates(): { playerId: string; position: Vec3 }[] {
    const candidates: { playerId: string; position: Vec3 }[] = [];
    for (const entry of this.options.roster) {
      if (entry.playerId === this.playerId || this.teammates(this.playerId, entry.playerId) ||
          !this.options.remotes.racing(entry.playerId)) continue;
      const pose = this.options.remotes.pose(entry.playerId);
      if (pose) candidates.push({ playerId: entry.playerId, position: pose.position });
    }
    return candidates;
  }

  private projectAim(camera: ProjectionCamera | undefined): { x: number; y: number } | undefined {
    const aim = this.aim;
    if (!aim || !camera?.matrixWorldInverse || !camera.projectionMatrix) return undefined;
    const target = aim.targetId ? this.options.remotes.pose(aim.targetId) : undefined;
    let point: Vec3;
    if (target) {
      const lift = ITEM_RACE_TUNING.aimReticleLiftM;
      point = { x: target.position.x + target.up.x * lift, y: target.position.y + target.up.y * lift,
        z: target.position.z + target.up.z * lift };
    } else {
      const pose = this.localPose();
      const ahead = ITEM_RACE_TUNING.aimReticleAheadM;
      point = { x: pose.position.x + pose.forward.x * ahead, y: pose.position.y + pose.forward.y * ahead,
        z: pose.position.z + pose.forward.z * ahead };
    }
    return projectToStage(camera, point);
  }

  private playAimSound(definition: ItemDefinition, index: number, loop: boolean): void {
    const stems = definition.states.get("Aim")?.auxFx;
    const stem = stems?.[index] ?? AIM_SOUND_STEMS[index]!;
    this.presenterCall(presenter => presenter.sound(definition.idx, stem, loop
      ? { key: AIM_SOUND_KEY, loop: ITEM_RACE_TUNING.aimSoundsLoop } : undefined));
  }

  // ---- server events ------------------------------------------------------

  private receive(event: ItemServerEvent): void {
    if (this.disposed) return;
    this.guard("道具事件处理失败", () => {
      switch (event.action) {
        case "used":
          this.recordUse(event, event.playerId === this.playerId);
          break;
        case "placed":
          this.onPlaced(event);
          break;
        case "hit":
          this.onRemoteHit(event);
          break;
        case "scan":
          this.onScan(event);
          break;
        case "escaped":
          this.onEscaped(event);
          break;
        default:
          // grant and slots only answer this racer's own requests.
          break;
      }
    });
  }

  private onGrant(reply: ItemGrantEvent): void {
    if (this.disposed) return;
    this.slots.confirm(reply.slots);
    this.applySlots(this.nowMs);
    if (reply.itemId === null && reply.reason === "abusing")
      this.abuseUntil = this.nowMs + ITEM_RACE_TUNING.abuseNoticeMs;
  }

  /** A `used` event: someone else's broadcast, or the reply to my own use. */
  private recordUse(event: ItemUsedEvent, own: boolean): void {
    if (this.disposed || this.uses.has(event.useId)) return;
    const definition = this.options.catalog.get(event.itemId);
    const now = this.options.now();
    const startMs = this.toLocal(event.startAt, now);
    const point = event.point ? clientToThreePoint(event.point) : undefined;
    const record: UseRecord = { useId: event.useId, itemId: event.itemId, userId: event.playerId,
      targets: event.targets, startMs, etaMs: event.etaMs, victims: [],
      ...(point ? { point } : {}) };
    this.uses.set(event.useId, record);
    this.presenterCall(presenter => presenter.used({ useId: record.useId, itemId: record.itemId,
      userId: record.userId, targets: record.targets, startMs, etaMs: record.etaMs,
      ...(point ? { point } : {}) }));
    if (!definition) return;
    const behaviour = definition.behaviour;
    this.presentUseEffects(record, behaviour, own);
    if (this.ended) return;
    this.scheduleVictim(record, behaviour);
  }

  /** Kart-attached effects every client shows for a use (shield, angel, EMP, bomb, magnet). */
  private presentUseEffects(record: UseRecord, behaviour: ItemBehaviour, own: boolean): void {
    const { userId, startMs } = record;
    switch (behaviour.effect) {
      case "shield":
        if (!own) this.kartEffect(userId, "shield", startMs, behaviour.effectMs);
        break;
      case "angel":
        for (const target of record.targets) {
          if (target === this.playerId) {
            this.setAngel(`use:${record.useId}`, startMs + behaviour.effectMs);
            if (own) continue;
          }
          this.kartEffect(target, "angel", startMs, behaviour.effectMs);
        }
        break;
      case "emp":
        if (!own) {
          this.kartEffect(userId, "emp", startMs, behaviour.effectMs);
          this.endKartEffect(userId, "slow");
        }
        break;
      case "pull":
        if (!own && record.targets.length) this.kartEffect(userId, "pull", startMs, behaviour.effectMs);
        break;
      default:
        if (!own && record.itemId === ItemIdx.timeBomb)
          this.kartEffect(userId, "timeBomb", startMs, behaviour.delayMs);
        break;
    }
  }

  /** Put the local kart on the use's timeline: a targeted hit, or an area to check. */
  private scheduleVictim(record: UseRecord, behaviour: ItemBehaviour): void {
    const me = this.playerId;
    const user = record.userId;
    const opponentOfUser = user !== me && !this.teammates(user, me);
    switch (behaviour.effect) {
      case "spin":
        // Banana: everyone, its user after a grace.
        if (behaviour.target === "placed" && record.point) {
          const activeFrom = record.startMs + behaviour.delayMs;
          this.addArea(record, behaviour, record.point, activeFrom,
            activeFrom + (behaviour.lifetimeMs ?? 0),
            user === me ? activeFrom + ITEM_RACE_TUNING.bananaOwnerGraceMs : undefined);
        }
        return;
      case "barrier":
        if (opponentOfUser) this.scheduleBarricade(record, behaviour);
        return;
      case "trap":
        if (behaviour.target === "area") {
          const activeFrom = record.startMs + behaviour.delayMs;
          const until = activeFrom + (behaviour.lifetimeMs ?? 0);
          // Water bomb: opponents at the thrown point; time bomb: everyone, placed later.
          if (record.itemId === ItemIdx.timeBomb) this.addArea(record, behaviour, undefined, activeFrom, until);
          else if (opponentOfUser && record.point) this.addArea(record, behaviour, record.point, activeFrom, until);
          return;
        }
        break;
      default:
        break;
    }
    const attack = ["trap", "launch", "reverse", "slow", "shrink", "cloud", "lock"]
      .includes(behaviour.effect);
    if (!attack || !record.targets.includes(me) || user === me) return;
    if (!behaviour.hitsTeammates && this.teammates(user, me)) return;
    const effectAt = record.startMs + effectStartOffsetMs(behaviour, record.etaMs);
    const warning = warningOf(record.itemId);
    this.incoming.set(record.useId, { useId: record.useId, itemId: record.itemId, userId: user,
      behaviour, effectAt, ...(warning ? { warning } : {}) });
  }

  private scheduleBarricade(record: UseRecord, behaviour: ItemBehaviour): void {
    const activeFrom = record.startMs + behaviour.delayMs + (behaviour.riseMs ?? 0);
    const area = this.addArea(record, behaviour, undefined, activeFrom,
      activeFrom + (behaviour.lifetimeMs ?? 0));
    // The targeted leader decides where it lands and tells everyone.
    if (record.targets[0] !== this.playerId || !this.options.local.racing()) return;
    const ahead = behaviour.distance ?? ITEM_RACE_TUNING.barricadeAheadM;
    let point: Vec3 | undefined;
    try { point = this.options.local.routePointAhead?.(ahead); }
    catch (error) { this.warn("路障落点路线采样失败", error); }
    if (!point) {
      const pose = this.localPose();
      point = { x: pose.position.x + pose.forward.x * ahead, y: pose.position.y + pose.forward.y * ahead,
        z: pose.position.z + pose.forward.z * ahead };
    }
    this.place(record, area, point);
  }

  private addArea(record: UseRecord, behaviour: ItemBehaviour, point: Vec3 | undefined,
    activeFrom: number, activeUntil: number, ownerGraceUntil?: number): AreaRecord {
    const area: AreaRecord = { useId: record.useId, itemId: record.itemId, userId: record.userId,
      behaviour, activeFrom, activeUntil, radius: behaviour.radius ?? 0,
      ...(point ? { point } : {}),
      ...(ownerGraceUntil !== undefined ? { ownerGraceUntil } : {}) };
    this.areas.set(record.useId, area);
    return area;
  }

  /** Report where my barricade or time bomb lands, and show it at once. */
  private place(record: UseRecord, area: AreaRecord | undefined, point: Vec3): void {
    if (area) area.point = point;
    this.presenterCall(presenter => presenter.placed({ useId: record.useId, itemId: record.itemId,
      userId: record.userId, point, startMs: record.startMs }));
    this.send("place", { useId: record.useId, point: threeToClient(point) }).catch(
      error => this.warn(`道具 ${record.itemId} 落点上报被拒绝`, error));
  }

  private onPlaced(event: ItemPlacedEvent): void {
    const point = clientToThreePoint(event.point);
    const record = this.uses.get(event.useId);
    const now = this.options.now();
    this.presenterCall(presenter => presenter.placed({ useId: event.useId, itemId: event.itemId,
      userId: event.playerId, point, startMs: record?.startMs ?? now }));
    const area = this.areas.get(event.useId);
    if (!area || area.point) return;
    area.point = point;
    if (now > area.activeUntil && now - area.activeUntil <= ITEM_RACE_TUNING.areaLateGraceMs)
      area.lateCheck = true;
  }

  private onRemoteHit(event: ItemHitEvent): void {
    const now = this.options.now();
    const definition = this.options.catalog.get(event.itemId);
    const position = event.useId === 0 && event.hazardId !== undefined
      ? this.options.hazardPosition?.(event.hazardId)
      : this.options.remotes.pose(event.playerId)?.position;
    this.presenterCall(presenter => presenter.hit({ useId: event.useId, itemId: event.itemId,
      victimId: event.playerId, ...(event.userId ? { userId: event.userId } : {}),
      result: event.result, ...(event.by ? { by: event.by } : {}), atMs: now,
      ...(position ? { position: { ...position } } : {}) }));
    if (event.removed) this.removeObject(event.useId);
    if (event.result === "blocked" && event.by === "shield")
      this.endKartEffect(event.playerId, "shield");
    const record = this.uses.get(event.useId);
    if (event.result === "hit" && definition) {
      const behaviour = definition.behaviour;
      const kind = kartEffectOf(behaviour.effect);
      if (kind) {
        const start = this.remoteEffectStart(record, behaviour, now);
        this.kartEffect(event.playerId, kind, start, behaviour.effectMs);
        // The blue shield follows the bubble's end, or the racer's early escape.
        if (kind === "trap" && behaviour.escapeShieldMs) {
          this.remoteTraps.set(event.playerId, { useId: event.useId,
            ...(event.hazardId !== undefined ? { hazardId: event.hazardId } : {}),
            untilMs: start + behaviour.effectMs, escapeShieldMs: behaviour.escapeShieldMs });
        }
      }
    }
    if (event.useId === 0 || !event.userId) return;
    this.addLog(event.userId, event.playerId, event.itemId, event.result === "blocked", now);
    if (event.userId === this.playerId && event.result === "hit")
      this.addGoodNotice(record, event.itemId, event.playerId, now);
  }

  /** A remote racer mashed out of its bubble: it ends now and the blue shield starts. */
  private onEscaped(event: ItemEscapedEvent): void {
    const trap = this.remoteTraps.get(event.playerId);
    const now = this.options.now();
    if (!trap || trap.useId !== event.useId || trap.hazardId !== event.hazardId ||
        now >= trap.untilMs) return;
    this.remoteTraps.delete(event.playerId);
    this.endKartEffect(event.playerId, "trap");
    this.kartEffect(event.playerId, "escapeShield", now, trap.escapeShieldMs);
  }

  /** Remote bubbles that ran their full time: the blue shield starts at their end. */
  private updateRemoteTraps(nowMs: number): void {
    for (const [playerId, trap] of this.remoteTraps) {
      if (nowMs < trap.untilMs) continue;
      this.remoteTraps.delete(playerId);
      this.kartEffect(playerId, "escapeShield", trap.untilMs, trap.escapeShieldMs);
    }
  }

  private onScan(event: ItemScanEvent): void {
    const now = this.options.now();
    this.scans.set(event.playerId, { slots: [...event.slots],
      until: this.toLocal(event.until, now) });
  }

  /** A banana that was run over disappears for everyone. */
  private removeObject(useId: number): void {
    this.areas.delete(useId);
    this.presenterCall(presenter => presenter.removed(useId));
  }

  private remoteEffectStart(record: UseRecord | undefined, behaviour: ItemBehaviour, now: number): number {
    if (!record || behaviour.target === "placed" || behaviour.target === "area" ||
        behaviour.effect === "barrier") return now;
    return Math.min(now, record.startMs + effectStartOffsetMs(behaviour, record.etaMs));
  }

  // ---- hits on the local kart ---------------------------------------------

  private resolveIncoming(nowMs: number): void {
    for (const [useId, hit] of this.incoming) {
      if (nowMs < hit.effectAt) continue;
      this.incoming.delete(useId);
      this.resolveHit({ useId, itemId: hit.itemId, userId: hit.userId, behaviour: hit.behaviour,
        effectAt: hit.effectAt, position: this.localPose().position }, nowMs, "targeted");
    }
  }

  private checkAreas(nowMs: number): void {
    if (this.options.local.suspended() || this.options.physics.itemEffects?.immune) return;
    const position = this.localPose().position;
    for (const area of this.areas.values()) {
      if (!area.point || this.reported.has(area.useId)) continue;
      const late = area.lateCheck === true;
      area.lateCheck = false;
      if (!late && (nowMs < area.activeFrom || nowMs > area.activeUntil)) continue;
      if (area.ownerGraceUntil !== undefined && nowMs < area.ownerGraceUntil) continue;
      if (distance(position, area.point) > area.radius) continue;
      this.resolveHit({ useId: area.useId, itemId: area.itemId, userId: area.userId,
        behaviour: area.behaviour, effectAt: nowMs, position: area.point }, nowMs, "area");
    }
  }

  private updateTimeBomb(nowMs: number): void {
    for (const [token, bomb] of this.bombs) {
      if (bomb.useId === undefined || nowMs < bomb.explodeAt) continue;
      this.bombs.delete(token);
      const record = this.uses.get(bomb.useId);
      if (record) this.place(record, this.areas.get(bomb.useId), { ...this.localPose().position });
    }
  }

  /**
   * Decide a hit on the local kart, apply it and report it. When the kart
   * cannot take the physics effect right now (apply() refuses it), nothing is
   * reported that the local physics did not show:
   * - an area item (banana, water or time bomb, barricade) stays live and
   *   unreported while a launch or barricade holds the kart, and lands once the
   *   hold ends if the kart is still inside, as for a kart arriving then;
   * - a track hazard is not reported (the hazard field fires again only after
   *   the kart leaves and re-enters it);
   * - a targeted hit (its timeline is over) is reported as not landed:
   *   `blocked` without a defence.
   */
  private resolveHit(hit: { useId: number; itemId: number; userId?: string; hazardId?: number;
    behaviour: ItemBehaviour; effectAt: number; position?: Vec3 }, nowMs: number,
    source: HitSource): void {
    if (hit.useId > 0 && this.reported.has(hit.useId)) return;
    const effects = this.options.physics.itemEffects;
    let decision = decideHit(hit.itemId, hit.behaviour, {
      immune: effects?.immune ?? false,
      shield: nowMs < this.shieldUntil,
      angel: nowMs < this.angelUntil,
      emp: nowMs < this.empUntil,
      suspended: this.options.local.suspended(),
    });
    if (decision.result === "hit" && !this.applyHit(hit, nowMs)) {
      if (source !== "targeted") return;
      decision = { result: "blocked" };
    }
    if (hit.useId > 0) this.reported.add(hit.useId);
    if (decision.by === "shield") {
      this.shieldUntil = 0;
      this.endKartEffect(this.playerId, "shield");
    }
    const fields: Record<string, unknown> = { useId: hit.useId, itemId: hit.itemId,
      result: decision.result };
    if (decision.by) fields.by = decision.by;
    if (hit.hazardId !== undefined) fields.hazardId = hit.hazardId;
    this.send("hit", fields).then(
      reply => this.guard("命中回包处理失败", () => {
        if ((reply as ItemHitEvent).removed) this.removeObject(hit.useId);
      }),
      error => this.warn(`道具 ${hit.itemId} 命中上报被拒绝`, error));
    if (hit.itemId === ItemIdx.banana && hit.useId > 0) this.areas.delete(hit.useId);
    this.presenterCall(presenter => presenter.hit({ useId: hit.useId, itemId: hit.itemId,
      victimId: this.playerId, ...(hit.userId ? { userId: hit.userId } : {}),
      result: decision.result, ...(decision.by ? { by: decision.by } : {}), atMs: nowMs,
      ...(hit.position ? { position: { ...hit.position } } : {}) }));
    if (hit.useId === 0 || !hit.userId) return;
    this.addLog(hit.userId, this.playerId, hit.itemId, decision.result === "blocked", nowMs);
    if (decision.result === "hit") {
      this.pushNotice({ kind: "bad", itemIdx: hit.itemId, text: this.nameOf(hit.userId), at: nowMs });
    }
  }

  /** Apply a landed hit; false when the kart cannot take its physics effect now. */
  private applyHit(hit: { useId: number; hazardId?: number; behaviour: ItemBehaviour; effectAt: number },
    nowMs: number): boolean {
    const { behaviour, effectAt } = hit;
    const kind = physicsEffect(behaviour.effect);
    if (kind) {
      const effects = this.options.physics.itemEffects;
      if (!effects) return true;
      const applied = effects.apply(kind, behaviour.effectMs, {
        elapsedMs: Math.max(0, nowMs - effectAt),
        ...(behaviour.escapeShieldMs !== undefined ? { escapeImmunityMs: behaviour.escapeShieldMs } : {}),
      });
      if (applied && kind === "trap") {
        this.localTrap = { useId: hit.useId,
          ...(hit.useId === 0 && hit.hazardId !== undefined ? { hazardId: hit.hazardId } : {}) };
      }
      return applied;
    }
    if (behaviour.effect === "cloud")
      this.cloudWindows.push({ from: effectAt, until: effectAt + behaviour.effectMs });
    else if (behaviour.effect === "lock") {
      this.lockWindows.push({ from: effectAt, until: effectAt + behaviour.effectMs });
      if (this.aim && this.aim.itemId !== ItemIdx.angel) this.cancelAim();
    }
    return true;
  }

  // ---- presentation -------------------------------------------------------

  /** Local physics effects (bubble, spin, flip, …) and the blue shield to the presenter. */
  private presentLocalEffects(nowMs: number): void {
    const effects = this.options.physics.itemEffects;
    if (!effects) return;
    for (const event of effects.consumeEvents()) {
      const kind = event.kind as ItemKartEffect;
      if (event.phase === "end") {
        this.endKartEffect(this.playerId, kind);
        if (event.kind === "trap") this.localTrapEnded(event.reason);
        continue;
      }
      const running = effects.effects?.get(event.kind);
      const clock = effects.clockMs;
      if (running && clock !== undefined) {
        this.kartEffect(this.playerId, kind, nowMs - (clock - running.startMs),
          running.endMs - running.startMs);
      } else {
        this.kartEffect(this.playerId, kind, nowMs, effects.remainingMs(event.kind as PhysicsItemEffect));
      }
    }
    const shieldMs = effects.escapeShieldRemainingMs;
    if (shieldMs > 0 && !this.escapeShieldShown) {
      this.escapeShieldShown = true;
      this.kartEffect(this.playerId, "escapeShield", nowMs, shieldMs);
    } else if (shieldMs <= 0 && this.escapeShieldShown) {
      this.escapeShieldShown = false;
      this.endKartEffect(this.playerId, "escapeShield");
    }
  }

  /** My bubble ended: an early escape (left/right mashing) tells the others to end it too. */
  private localTrapEnded(reason: string | undefined): void {
    const trap = this.localTrap;
    this.localTrap = undefined;
    if (!trap || reason !== "escaped" || this.ended) return;
    const fields: Record<string, unknown> = { useId: trap.useId };
    if (trap.useId === 0) {
      if (trap.hazardId === undefined) return;
      fields.hazardId = trap.hazardId;
    }
    this.send("escape", fields).catch(error => this.warn("脱出水泡通知被拒绝", error));
  }

  private kartEffect(playerId: string, kind: ItemKartEffect, startMs: number, durationMs: number): void {
    this.presenterCall(presenter => presenter.kartEffect(playerId, kind, startMs, durationMs));
  }

  private endKartEffect(playerId: string, kind: ItemKartEffect): void {
    this.presenterCall(presenter => presenter.endKartEffect(playerId, kind));
  }

  private presenterCall(call: (presenter: ItemRacePresenter) => void): void {
    const presenter = this.options.presenter;
    if (!presenter) return;
    try { call(presenter); }
    catch (error) { this.warn("道具表现层调用失败", error); }
  }

  private pose(playerId: string): ItemPresenterPose | undefined {
    return playerId === this.playerId ? this.localPose() : this.options.remotes.pose(playerId);
  }

  private localPose(): ItemPresenterPose {
    const body = this.options.physics.body;
    return { position: body.position, right: body.right, forward: body.forward, up: body.up };
  }

  // ---- HUD helpers --------------------------------------------------------

  /** Apply the displayed slots to the physics mirror; a new item in slot 0 shows its card. */
  private applySlots(nowMs: number): void {
    const slots = this.slots.slots;
    if (sameSlots(slots, this.appliedSlots)) return;
    const previousFirst = this.appliedSlots[0];
    this.appliedSlots = slots;
    try { this.options.physics.setItemSlots(slots); }
    catch (error) { this.warn("道具槽同步失败", error); }
    const first = slots[0] ?? EMPTY_SLOT;
    if (first === EMPTY_SLOT) this.infoCard = undefined;
    else if (first !== previousFirst)
      this.infoCard = { itemIdx: first, until: nowMs + ITEM_RACE_TUNING.infoCardMs };
  }

  private currentWarning(nowMs: number): "rocket" | "waterfly" | undefined {
    let warning: { kind: "rocket" | "waterfly"; at: number } | undefined;
    for (const hit of this.incoming.values()) {
      if (!hit.warning || nowMs >= hit.effectAt) continue;
      if (!warning || hit.effectAt < warning.at) warning = { kind: hit.warning, at: hit.effectAt };
    }
    return warning?.kind;
  }

  private addLog(attackerId: string, victimId: string, itemIdx: number, failed: boolean, at: number): void {
    const attacker = this.options.roster.find(entry => entry.playerId === attackerId);
    this.log.push({ attacker: this.nameOf(attackerId), victim: this.nameOf(victimId), itemIdx,
      failed, team: teamColor(attacker?.team, this.options.teamRace), at });
    while (this.log.length > ITEM_RACE_TUNING.logRows) this.log.shift();
  }

  private addGoodNotice(record: UseRecord | undefined, itemIdx: number, victimId: string, at: number): void {
    if (record) {
      if (!record.victims.includes(victimId)) record.victims.push(victimId);
      const notice = record.goodNotice;
      if (notice && at - notice.at <= ITEM_RACE_TUNING.goodNoticeMergeMs && this.notices.includes(notice)) {
        notice.text = victimsText(record.victims.map(id => this.nameOf(id)));
        return;
      }
    }
    const notice: ItemHudNotice = { kind: "good", itemIdx, text: this.nameOf(victimId), at };
    if (record) record.goodNotice = notice;
    this.pushNotice(notice);
  }

  private pushNotice(notice: ItemHudNotice): void {
    this.notices.push(notice);
    while (this.notices.length > ITEM_RACE_TUNING.noticeRows) this.notices.shift();
  }

  private nameOf(playerId: string): string {
    return this.options.roster.find(entry => entry.playerId === playerId)?.name || UNNAMED_RACER;
  }

  private teammates(a: string, b: string): boolean {
    if (a === b) return true;
    if (!this.options.teamRace) return false;
    const teamA = this.options.roster.find(entry => entry.playerId === a)?.team;
    const teamB = this.options.roster.find(entry => entry.playerId === b)?.team;
    return teamA != null && teamA === teamB;
  }

  private activeWindow(windows: readonly TimeWindow[], nowMs: number): TimeWindow | undefined {
    let active: TimeWindow | undefined;
    for (const window of windows) {
      if (window.from <= nowMs && nowMs < window.until && (!active || window.until > active.until))
        active = window;
    }
    return active;
  }

  // ---- lifecycle ----------------------------------------------------------

  /** The local racer finished (or left the Racing state): no more item actions or hits. */
  private endLocalRace(): void {
    this.ended = true;
    this.cancelAim();
    this.incoming.clear();
    this.areas.clear();
    this.lockWindows.length = 0;
    this.cloudWindows.length = 0;
    if (this.shieldUntil > this.nowMs) this.endKartEffect(this.playerId, "shield");
    if (this.angelUntil > this.nowMs) this.endKartEffect(this.playerId, "angel");
    if (this.empUntil > this.nowMs) this.endKartEffect(this.playerId, "emp");
    if (this.bombs.size) this.endKartEffect(this.playerId, "timeBomb");
    this.shieldUntil = 0;
    this.angels.clear();
    this.angelUntil = 0;
    this.empUntil = 0;
    this.bombs.clear();
    this.localTrap = undefined;
    this.infoCard = undefined;
  }

  private prune(nowMs: number): void {
    const keep = (windows: TimeWindow[]) => {
      for (let index = windows.length - 1; index >= 0; index--)
        if (windows[index]!.until <= nowMs) windows.splice(index, 1);
    };
    keep(this.lockWindows);
    keep(this.cloudWindows);
    for (const [useId, area] of this.areas) {
      if (!area.lateCheck && nowMs > area.activeUntil + ITEM_RACE_TUNING.areaLateGraceMs)
        this.areas.delete(useId);
    }
    for (const [useId, record] of this.uses) {
      if (nowMs - record.startMs > ITEM_RACE_TUNING.useLifetimeMs && !this.incoming.has(useId) &&
          !this.areas.has(useId)) this.uses.delete(useId);
    }
    for (const [playerId, scan] of this.scans) if (nowMs >= scan.until) this.scans.delete(playerId);
    let angelsExpired = false;
    for (const [key, until] of this.angels) {
      if (until > nowMs) continue;
      this.angels.delete(key);
      angelsExpired = true;
    }
    if (angelsExpired) this.refreshAngel();
    while (this.notices.length && nowMs - this.notices[0]!.at > ITEM_RACE_TUNING.noticeKeepMs)
      this.notices.shift();
    while (this.log.length && nowMs - this.log[0]!.at > ITEM_RACE_TUNING.logKeepMs) this.log.shift();
    if (this.infoCard && nowMs >= this.infoCard.until) this.infoCard = undefined;
    if (this.reorderStartedAt !== undefined &&
        nowMs - this.reorderStartedAt >= ITEM_RACE_TUNING.slotReorderMs) this.reorderStartedAt = undefined;
  }

  // ---- plumbing -----------------------------------------------------------

  private toLocal(serverMs: number, fallback: number): number {
    const local = this.options.toLocalMs(serverMs);
    return local !== undefined && Number.isFinite(local) ? local : fallback;
  }

  private send(action: ItemRequestAction, fields?: Record<string, unknown>): Promise<unknown> {
    try {
      return Promise.resolve(this.options.connection.sendItem(action, fields));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private guard(message: string, run: () => void): void {
    try { run(); }
    catch (error) { this.warn(message, error); }
  }

  private warn(message: string, error?: unknown): void {
    if (this.disposed) return;
    try {
      if (this.options.log) this.options.log(message, error);
      else console.warn(`[道具赛] ${message}`, error);
    } catch {
      // Logging must never reach the race loop either.
    }
  }
}
