/**
 * The local item race controller (道具赛, ITEM_MODE.md §5–§7, Appendix C): one
 * per local item race. It mirrors the server's item slots and changer cards,
 * turns the Ctrl/Alt/Z item commands into `item` requests, aims the aimed
 * items, schedules every hit on the local kart on the shared `startAt`
 * timeline, decides escape immunity, equipment passives (deterministic roll),
 * the invincible, shield and angel defences and the partial outcomes, checks
 * the area items, fields, blasts and siren touches against the local kart,
 * reports hits and placements, and feeds the item HUD and the item presenter.
 *
 * Nothing here may break the race: every entry point catches and logs. A
 * rejected use restores the last confirmed slots and takes back the effects
 * it started on the key press; a rejection that may mean the slots drifted
 * from the server's asks the server for them again.
 */
import type { ItemCommand, ItemCommandHandler } from "../input/item-input";
import type {
  ItemChangers, ItemEscapedEvent, ItemGrantEvent, ItemHitEvent, ItemLucciEvent, ItemPlacedEvent,
  ItemScanEvent, ItemServerEvent, ItemSlotsEvent, ItemUsedEvent,
} from "../multiplayer/server-events";
import type { ItemAimPhase, ItemHudLogEntry, ItemHudNotice } from "../ui/item-hud-state";
import {
  ITEM_RULES, ItemIdx, type ItemBehaviour, type ItemBoosterKind, type ItemCatalog, type ItemDefinition,
  type ItemOverlayKind, type ItemReverseMode,
} from "./item-catalog";
import { ItemChangerState } from "./item-race-changers";
import type {
  ItemHudFeed, ItemRaceHit, ItemRaceKartEffect, ItemRaceKartEffectOptions, ItemRacePresenterP3,
  ItemRaceUse,
} from "./item-race-p3-contract";
import {
  animalBoosterIcon, cloudFactors, equipmentBlock, NO_PASSIVES, partialVariant, quickEscape,
  racerPassives, type PassiveRollContext, type RacerPassives,
} from "./item-passives";
import type { ItemPresenterPose, ItemRacePresenter } from "./item-race-presenter-contract";
import {
  ITEM_RACE_TUNING, bananaPoint, chooseAimTarget, clientToThreePoint, decideHit, distance,
  effectStartOffsetMs, kartEffectOf, physicsEffect, projectToStage, sweepOrigin, sweptThrough,
  teamColor, threeToClient, victimsText, warningOf, waterBombPoint,
  type EquipmentOutcome, type HitDecision, type ItemHitVariant, type PhysicsItemEffect,
  type ProjectionCamera, type Vec3,
} from "./item-race-rules";
import { fnv1a32 } from "./item-roll";
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

export interface ItemRaceEffectOptions {
  elapsedMs?: number;
  escapeImmunityMs?: number;
  target?: () => Vec3 | undefined;
  /** reverse: which keys swap (devil left/right, newDevil forward/back, Dr. R all). */
  mode?: ItemReverseMode;
  /** trap: the waterAngel quick escape (the bubble ends at 500 ms). */
  quick?: boolean;
  /** trap: its end opens the escape boost of UseExtendedAfterBooster karts. */
  afterBoost?: boolean;
  /** reverse, slow, shrink: the cause (item idx), so EMP can end only a UFO slow. */
  source?: string | number;
}

export type ItemDirection = "left" | "right" | "up" | "down";

/** `physics.itemEffects` (driving/item-effects.ts VehicleItemEffects). */
export interface ItemRaceEffects {
  apply(kind: PhysicsItemEffect, durationMs: number, options?: ItemRaceEffectOptions): boolean;
  end(kind: PhysicsItemEffect, source?: string | number): boolean;
  readonly immune: boolean;
  readonly canUseItem: boolean;
  readonly escapeShieldRemainingMs: number;
  remainingMs(kind: PhysicsItemEffect): number;
  consumeEvents(): ItemRaceEffectEvent[];
  /** Physics clock and running effects, to place a started effect on the presenter clock. */
  readonly clockMs?: number;
  readonly effects?: ReadonlyMap<string, { startMs: number; endMs: number }>;
  /** Whether `source` currently causes `kind` (a UFO slow under other slows). */
  hasSource?(kind: PhysicsItemEffect, source: string | number): boolean;
  /** Talisman QTE: arrow presses queued while held, and the early end of the hold. */
  consumeDirectionPresses?(): Array<{ direction: ItemDirection; atMs: number }>;
  escapeHold?(delayMs?: number): boolean;
}

/** The item-race members of the local AL (driving/item-mode.ts). */
export interface ItemRacePhysics {
  readonly itemSlotCapacity: number;
  setItemSlots(slots: readonly number[]): void;
  /**
   * Booster item (`itemBoosterTime`, flying pets of group 204 included),
   * special booster (`animalBoosterTime`) or super shield (`superBoosterTime`);
   * `durationMs` overrides the tuning time (the siren's Use.life).
   */
  startItemBooster(kind?: ItemBoosterKind, options?: { durationMs?: number }): boolean;
  /** Take back a booster item the server refused (driving/item-mode.ts). */
  cancelItemBooster?(): boolean;
  readonly body: ItemPresenterPose & { linearVelocity: Vec3 };
  readonly itemEffects?: ItemRaceEffects;
  /** Physics state 1 is the start booster (完美起步). */
  readonly runtime?: { readonly physicsState: number };
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
  /** The frozen race equipment `itemIds` (room snapshot `race.roster[i].equipment.itemIds`). */
  itemIds?: unknown;
}

export interface ItemRaceControllerOptions {
  playerId: string;
  roster: readonly ItemRaceRosterEntry[];
  teamRace: boolean;
  /** The race (roll seed, C.1) and its track (iceBanana works on `ice_` tracks). */
  raceId?: string;
  trackId?: string;
  catalog: Pick<ItemCatalog, "get"> & Partial<Pick<ItemCatalog, "passives" | "animalBoosters">>;
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
  /** The changer cards known before the first reply (the countdown tutorial board). */
  changers?: ItemChangers;
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
  count: number;
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
  shot?: 0 | 1;
  warning?: "rocket" | "waterfly";
  /** Only a warning (a waterbombFly riding to me); its blast is a proximity check. */
  warnOnly?: boolean;
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

/**
 * A hit that lands when the local kart is near a moving centre: the
 * lockdown rocket's field, the waterbombFly's burst and an opponent's siren.
 */
interface ProximityCheck {
  key: string;
  useId: number;
  itemId: number;
  userId: string;
  behaviour: ItemBehaviour;
  from: number;
  until: number;
  radius: number;
  center(): Vec3 | undefined;
  /** The lockdown field: the hit is the field's AffectSub, not the item's own effect. */
  field?: boolean;
  /** Checked once at `from` (the burst), else every frame of the window. */
  once: boolean;
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
  delayMs: number;
}

interface TimeWindow { from: number; until: number }
interface TaggedWindow extends TimeWindow { tag?: string }
interface OverlayWindow extends TimeWindow { kind: ItemOverlayKind; opacity: number }

/** The trap holding the local kart (for the escape notice). */
interface LocalTrap { useId: number; hazardId?: number }

/** A remote racer's bubble: its blue shield starts at its end, or at its early escape. */
interface RemoteTrap { useId: number; hazardId?: number; untilMs: number; escapeShieldMs: number }

interface TalismanQte {
  useId: number;
  sequence: ItemDirection[];
  progress: number;
  untilMs: number;
  escapeMs: number;
  failedAtMs?: number;
}

type HitSource = "area" | "targeted" | "hazard";

interface HitInput {
  useId: number;
  itemId: number;
  userId?: string;
  hazardId?: number;
  shot?: 0 | 1;
  behaviour: ItemBehaviour;
  effectAt: number;
  position?: Vec3;
  /** The lockdown field's AffectSub (behaviour already carries its effect): no passive applies. */
  field?: boolean;
}

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
const DIRECTIONS: readonly ItemDirection[] = ["left", "right", "up", "down"];
/** Targeted attacks scheduled on the victim's own timeline. */
const TARGETED_EFFECTS: ReadonlySet<string> = new Set(
  ["trap", "launch", "reverse", "slow", "shrink", "cloud", "lock", "hold", "spin"]);

export class ItemRaceController implements ItemCommandHandler {
  readonly playerId: string;
  readonly options: ItemRaceControllerOptions;
  readonly slots: ItemSlotMirror;
  readonly changers: ItemChangerState;
  readonly uses = new Map<number, UseRecord>();
  /** Hits scheduled on me, by `useId:shot`. */
  readonly incoming = new Map<string, IncomingHit>();
  readonly areas = new Map<number, AreaRecord>();
  readonly proximity = new Map<string, ProximityCheck>();
  /** Reported hits, by `useId:shot`. */
  readonly reported = new Set<string>();
  readonly scans = new Map<string, { slots: readonly number[]; until: number }>();
  /** My time bombs by request token, each placed when it explodes. */
  readonly bombs = new Map<number, OwnTimeBomb>();
  readonly remoteTraps = new Map<string, RemoteTrap>();
  /** Remote talisman holds, which a QTE may end early (escaped). */
  readonly remoteHolds = new Map<string, { useId: number; startMs: number; untilMs: number; escapeMs: number }>();
  /** Remote UFO slows (for EMP) and tigerGhost windows (aiming), by racer. */
  readonly remoteUfoSlows = new Map<string, number>();
  readonly invisible = new Map<string, TimeWindow>();
  readonly notices: ItemHudNotice[] = [];
  readonly log: ItemHudLogEntry[] = [];
  readonly lockWindows: TaggedWindow[] = [];
  readonly cloudWindows: TimeWindow[] = [];
  readonly overlays: OverlayWindow[] = [];
  /** Things to do later on the presenter clock (EMP checks, a fly reaching its target). */
  readonly timed: Array<{ at: number; run: () => void }> = [];
  shieldUntil = 0;
  angelUntil = 0;
  /** My gold / protect shield. */
  invincible: TimeWindow | undefined;
  /** When my UFO slow ends (EMP clears it while it runs). */
  localUfoSlowUntil = 0;
  aim: AimState | undefined;
  aimScreen: { x: number; y: number } | undefined;
  localTrap: LocalTrap | undefined;
  talisman: TalismanQte | undefined;
  infoCard: { itemIdx: number; until: number } | undefined;
  abuseUntil: number | undefined;
  reorderStartedAt: number | undefined;
  startItemFlashAt: number | undefined;
  lucciNotice: { amount: number; atMs: number } | undefined;
  /** The special booster icon the server reported for my kart's item 31 (`slotIcons`). */
  serverAnimalIcon: number | undefined;
  /** The start boost succeeded (physics state 1 seen while racing): 完美起步. */
  perfectStart = false;
  nowMs = 0;
  started = false;
  ended = false;
  disposed = false;
  private appliedSlots: number[];
  private slotChangerPending = false;
  private statusMessage: string | undefined;
  private escapeShieldShown = false;
  /** Angel windows covering me (my own by request token, teammates' by use). */
  private readonly angels = new Map<string, TimeWindow>();
  /** The request whose booster or magnet pull runs now (a rejection only ends its own). */
  private boosterToken: number | undefined;
  private pullToken: number | undefined;
  private resyncing = false;
  /** The kart at the last area check, for the swept check. */
  private areaSweep: { position: Vec3; atMs: number } | undefined;
  /** Uses whose first missile already popped my balloon. */
  private readonly balloonSpent = new Set<number>();
  private readonly passivesById = new Map<string, RacerPassives>();
  private readonly unsubscribe: () => void;

  constructor(options: ItemRaceControllerOptions) {
    this.options = options;
    this.playerId = options.playerId;
    this.slots = new ItemSlotMirror(options.physics.itemSlotCapacity);
    this.changers = new ItemChangerState(options.changers);
    this.appliedSlots = this.slots.slots;
    this.nowMs = options.now();
    for (const entry of options.roster)
      this.passivesById.set(entry.playerId, racerPassives(options.catalog.passives, entry.itemIds));
    this.unsubscribe = options.connection.subscribeItem(event => this.receive(event));
  }

  /** The local racer's equipment passives (frozen race equipment). */
  get passives(): RacerPassives {
    return this.passivesById.get(this.playerId) ?? NO_PASSIVES;
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
          this.change(nowMs);
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
      if (racing) {
        this.started = true;
        if (this.options.physics.runtime?.physicsState === 1) this.perfectStart = true;
      } else if (this.started && !this.ended) this.endLocalRace();
      this.runTimed(nowMs);
      if (racing && !this.ended) {
        this.updateAim(nowMs);
        this.resolveIncoming(nowMs);
        this.updateTimeBomb(nowMs);
        this.checkAreas(nowMs);
        this.checkProximity(nowMs);
        this.updateTalisman(nowMs);
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
  hudState(nowMs: number): ItemHudFeed {
    const capacity = this.options.physics.itemSlotCapacity >= 3 ? 3 : 2;
    const slots = this.slots.slots;
    const locked = this.locked(nowMs);
    const changers = this.changers.hud(slots, locked, this.canAct() && !this.aim);
    const state: ItemHudFeed = {
      slots,
      capacity,
      slotChanger: changers.slot,
      itemChanger: changers.item,
      changers,
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
    if (this.activeWindow(this.cloudWindows, nowMs))
      state.cloud = { opacity: cloudFactors(this.passives).opacity, variant: 0 };
    const overlay = this.currentOverlay(nowMs);
    if (overlay) state.overlay = { kind: overlay.kind, untilMs: overlay.until, opacity: overlay.opacity };
    if (this.abuseUntil !== undefined && nowMs < this.abuseUntil) state.abuseUntil = this.abuseUntil;
    if (this.infoCard && nowMs < this.infoCard.until) state.infoCard = { itemIdx: this.infoCard.itemIdx };
    const scan = [...this.scans].filter(([, entry]) => nowMs < entry.until)
      .map(([playerId, entry]) => ({ playerId, slots: entry.slots }));
    if (scan.length) state.scan = scan;
    const icons = this.slotIcons(slots);
    if (icons) state.slotIcons = icons;
    if (this.startItemFlashAt !== undefined &&
        nowMs - this.startItemFlashAt < ITEM_RACE_TUNING.startItemFlashKeepMs)
      state.startItemFlash = this.startItemFlashAt;
    if (this.lucciNotice && nowMs - this.lucciNotice.atMs < ITEM_RACE_TUNING.lucciNoticeMs)
      state.lucci = { ...this.lucciNotice };
    const tutorial = this.tutorial();
    if (tutorial) state.tutorial = tutorial;
    if (this.talisman && nowMs < this.talisman.untilMs) {
      state.talisman = { keys: this.talisman.sequence.slice(), done: this.talisman.progress,
        ...(this.talisman.failedAtMs !== undefined ? { failedAtMs: this.talisman.failedAtMs } : {}) };
    }
    return state;
  }

  /** True once after an Alt swap or a Z change (race-session-update plays slot_changer.flac). */
  consumeSlotChangerSound(): boolean {
    const pending = this.slotChangerPending;
    this.slotChangerPending = false;
    return pending;
  }

  /** A short notice for the race chat area (none in phase 3; kept for the session). */
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
    this.proximity.clear();
    this.reported.clear();
    this.uses.clear();
    this.scans.clear();
    this.timed.length = 0;
    this.lockWindows.length = 0;
    this.cloudWindows.length = 0;
    this.overlays.length = 0;
    this.shieldUntil = 0;
    this.angels.clear();
    this.angelUntil = 0;
    this.invincible = undefined;
    this.localUfoSlowUntil = 0;
    this.remoteUfoSlows.clear();
    this.remoteHolds.clear();
    this.invisible.clear();
    this.bombs.clear();
    this.remoteTraps.clear();
    this.balloonSpent.clear();
    this.localTrap = undefined;
    this.talisman = undefined;
    this.boosterToken = undefined;
    this.pullToken = undefined;
    this.areaSweep = undefined;
    this.infoCard = undefined;
    this.abuseUntil = undefined;
    this.reorderStartedAt = undefined;
    this.startItemFlashAt = undefined;
    this.lucciNotice = undefined;
    this.serverAnimalIcon = undefined;
    this.notices.length = 0;
    this.log.length = 0;
    this.changers.reset();
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
    this.proximity.clear();
    this.uses.clear();
    this.bombs.clear();
    this.remoteTraps.clear();
    this.timed.length = 0;
  }

  // ---- local commands -----------------------------------------------------

  private canAct(): boolean {
    return !this.disposed && !this.ended && this.options.local.racing() &&
      !this.options.local.suspended();
  }

  private locked(nowMs: number): boolean {
    return this.activeWindow(this.lockWindows, nowMs) !== undefined;
  }

  /** Trapped, launched, stopped or held karts cannot use items; a slot lock allows only the angel. */
  private usable(itemId: number, nowMs: number): boolean {
    if (this.options.physics.itemEffects && !this.options.physics.itemEffects.canUseItem) return false;
    return itemId === ItemIdx.angel || !this.locked(nowMs);
  }

  private pressUse(nowMs: number): void {
    if (!this.canAct() || this.aim || this.changers.pendingChange) return;
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

  /** Alt (道具换位卡): needs a card or voucher and two items (C.6). */
  private swap(nowMs: number): void {
    if (!this.canAct() || this.aim || this.changers.pendingChange) return;
    const slots = this.slots.slots;
    if (!this.changers.canSwap(slots)) return;
    const token = this.slots.begin("swap");
    this.changers.beginSwap();
    this.applySlots(nowMs);
    this.reorderStartedAt = nowMs;
    this.slotChangerPending = true;
    this.send("swap").then(
      reply => this.guard("换位回包处理失败", () => {
        const event = reply as ItemSlotsEvent;
        this.changers.endSwap(event.changers);
        this.noteIcons(event.slots, event.slotIcons);
        this.slots.confirm(event.slots, token);
        this.applySlots(this.nowMs);
      }),
      error => {
        this.changers.endSwap();
        this.slots.reject(token);
        this.applySlots(this.nowMs);
        this.warn("道具换位被拒绝", error);
        this.resyncAfter(error, SLOT_DOUBT_CODES);
      });
  }

  /**
   * Z (道具变更卡): the server redraws slot 0 from the changer table, once per
   * newly obtained item, never under a slot lock (C.6). The result is random,
   * so nothing changes before the reply.
   */
  private change(nowMs: number): void {
    if (!this.canAct() || this.aim || this.changers.pendingChange || this.slots.pending.length) return;
    if (!this.changers.canChange(this.slots.slots, this.locked(nowMs))) return;
    this.changers.beginChange();
    this.slotChangerPending = true;
    this.send("change").then(
      reply => this.guard("道具变更回包处理失败", () => {
        const event = reply as ItemSlotsEvent;
        this.changers.endChange(event.changers);
        this.noteIcons(event.slots, event.slotIcons);
        this.slots.confirm(event.slots);
        this.applySlots(this.nowMs);
      }),
      error => {
        this.changers.endChange();
        this.warn("道具变更被拒绝", error);
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
    if (behaviour.family === "timeBomb") {
      this.bombs.set(token, { token, explodeAt: nowMs + behaviour.delayMs, delayMs: behaviour.delayMs });
      this.kartEffect(this.playerId, "timeBomb", nowMs, behaviour.delayMs, causeOf(itemId, ItemIdx.timeBomb));
    }
    this.send("use", fields).then(
      reply => this.guard("道具使用回包处理失败", () => {
        const used = reply as ItemUsedEvent;
        this.changers.confirm(used.changers);
        if (used.slots) this.noteIcons(used.slots, used.slotIcons);
        this.slots.confirm(used.slots, token);
        this.applySlots(this.nowMs);
        this.recordUse(used, true);
        // Each time bomb follows its own use's timeline.
        const bomb = this.bombs.get(token);
        if (bomb) {
          bomb.useId = used.useId;
          const startMs = this.uses.get(used.useId)?.startMs;
          if (startMs !== undefined) bomb.explodeAt = startMs + bomb.delayMs;
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
   * Returns what a rejection takes back: the boost or magnet pull of this
   * request while it still runs, and the shield, angel or invincible window
   * it opened (with its visual), unless a hit already spent it.
   */
  private startOwnEffect(definition: ItemDefinition, nowMs: number, token: number,
    targetId?: string): () => void {
    const behaviour = definition.behaviour;
    const effects = this.options.physics.itemEffects;
    const undos: Array<() => void> = [];
    const boost = (kind: ItemBoosterKind, durationMs?: number) => {
      const started = durationMs === undefined ? this.options.physics.startItemBooster(kind)
        : this.options.physics.startItemBooster(kind, { durationMs });
      if (!started) return;
      this.boosterToken = token;
      undos.push(() => {
        // A later booster item restarted the boost: that one keeps it.
        if (this.boosterToken !== token) return;
        this.boosterToken = undefined;
        this.options.physics.cancelItemBooster?.();
      });
    };
    const shield = (durationMs: number) => {
      const previous = this.shieldUntil;
      const until = nowMs + durationMs;
      this.shieldUntil = Math.max(previous, until);
      const own = this.shieldUntil;
      this.kartEffect(this.playerId, "shield", nowMs, this.shieldUntil - nowMs,
        causeOf(definition.idx, ItemIdx.shield));
      undos.push(() => {
        // Spent on a hit, or replaced by another shield: nothing to take back.
        if (this.shieldUntil !== own) return;
        this.shieldUntil = previous;
        this.restoreOwnWindow("shield", previous);
      });
    };
    switch (behaviour.effect) {
      case "boost":
        boost(behaviour.boosterKind ?? "item");
        break;
      case "shield":
        shield(behaviour.shieldMs ?? behaviour.effectMs);
        if (behaviour.boosterKind) boost(behaviour.boosterKind);
        break;
      case "invincible": {
        const window = { from: nowMs + behaviour.delayMs, until: nowMs + behaviour.delayMs + behaviour.effectMs };
        const previous = this.invincible;
        this.invincible = window;
        this.kartEffect(this.playerId, "invincible", window.from, behaviour.effectMs, { itemId: definition.idx });
        undos.push(() => {
          if (this.invincible !== window) return;
          this.invincible = previous;
          if (previous && previous.until > this.nowMs)
            this.kartEffect(this.playerId, "invincible", previous.from, previous.until - previous.from);
          else this.endKartEffect(this.playerId, "invincible");
        });
        break;
      }
      case "angel": {
        const key = `own:${token}`;
        const from = nowMs + behaviour.delayMs;
        this.setAngel(key, from, from + behaviour.effectMs);
        this.kartEffect(this.playerId, "angel", from, behaviour.effectMs);
        undos.push(() => {
          if (!this.angels.delete(key)) return;
          this.refreshAngel();
          const other = this.ownAngelWindow();
          if (other && other.until > this.nowMs)
            this.kartEffect(this.playerId, "angel", other.from, other.until - other.from);
          else this.endKartEffect(this.playerId, "angel");
        });
        break;
      }
      case "pull": {
        if (behaviour.shieldMs) shield(behaviour.shieldMs);
        if (!targetId || !effects) break;
        const pulled = effects.apply("pull", behaviour.effectMs, {
          target: () => {
            const pose = this.options.remotes.pose(targetId);
            return pose ? { ...pose.position } : undefined;
          },
        });
        if (!pulled) break;
        // Face the field at the locked target from the release frame, not only from the reply.
        this.kartEffect(this.playerId, "pull", nowMs, behaviour.effectMs,
          { target: targetId, ...causeOf(definition.idx, ItemIdx.magnet) });
        this.pullToken = token;
        undos.push(() => {
          if (this.pullToken !== token) return;
          this.pullToken = undefined;
          effects.end("pull");
        });
        break;
      }
      case "siren":
        boost(behaviour.boosterKind ?? "item", behaviour.effectMs);
        if (behaviour.shieldMs) shield(behaviour.shieldMs);
        break;
      case "invisible": {
        const from = nowMs + behaviour.delayMs;
        this.kartEffect(this.playerId, "invisible", from, behaviour.effectMs,
          { visibleToMe: true, itemId: definition.idx });
        undos.push(() => this.endKartEffect(this.playerId, "invisible"));
        break;
      }
      default:
        break;
    }
    return undos.length === 0 ? NO_UNDO : () => { for (const undo of undos) undo(); };
  }

  /** After a refused shield: the visual ends, or goes back to the window still open. */
  private restoreOwnWindow(kind: "shield", until: number): void {
    const now = this.nowMs;
    if (until > now) this.kartEffect(this.playerId, kind, now, until - now);
    else this.endKartEffect(this.playerId, kind);
  }

  private setAngel(key: string, from: number, until: number): void {
    const previous = this.angels.get(key);
    this.angels.set(key, previous ? { from: Math.min(previous.from, from), until: Math.max(previous.until, until) }
      : { from, until });
    this.refreshAngel();
  }

  private refreshAngel(): void {
    let until = 0;
    for (const window of this.angels.values()) until = Math.max(until, window.until);
    this.angelUntil = until;
  }

  private angelActive(nowMs: number): boolean {
    for (const window of this.angels.values()) if (window.from <= nowMs && nowMs < window.until) return true;
    return false;
  }

  /** The angel window shown on my kart: the latest one covering me. */
  private ownAngelWindow(): TimeWindow | undefined {
    let best: TimeWindow | undefined;
    for (const window of this.angels.values()) if (!best || window.until > best.until) best = window;
    return best;
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
          const event = reply as ItemSlotsEvent;
          this.changers.confirm(event.changers);
          this.noteIcons(event.slots, event.slotIcons);
          this.slots.confirm(event.slots);
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
    const candidate = chooseAimTarget(this.localPose(), this.aimCandidates(nowMs));
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

  /** Opponents still racing, except those a tigerGhost hides (隐身: cannot be locked on). */
  private aimCandidates(nowMs: number): { playerId: string; position: Vec3 }[] {
    const candidates: { playerId: string; position: Vec3 }[] = [];
    for (const entry of this.options.roster) {
      if (entry.playerId === this.playerId || this.teammates(this.playerId, entry.playerId) ||
          !this.options.remotes.racing(entry.playerId) || this.hidden(entry.playerId, nowMs)) continue;
      const pose = this.options.remotes.pose(entry.playerId);
      if (pose) candidates.push({ playerId: entry.playerId, position: pose.position });
    }
    return candidates;
  }

  private hidden(playerId: string, nowMs: number): boolean {
    const window = this.invisible.get(playerId);
    return !!window && window.from <= nowMs && nowMs < window.until;
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
        case "slots":
          this.onSlotsPush(event);
          break;
        case "lucci":
          this.onLucci(event);
          break;
        default:
          // grant only answers this racer's own requests.
          break;
      }
    });
  }

  private onGrant(reply: ItemGrantEvent): void {
    if (this.disposed) return;
    this.changers.confirm(reply.changers);
    this.noteIcons(reply.slots, reply.slotIcons);
    this.slots.confirm(reply.slots);
    this.applySlots(this.nowMs);
    if (reply.itemId === null && reply.reason === "abusing")
      this.abuseUntil = this.nowMs + ITEM_RACE_TUNING.abuseNoticeMs;
  }

  /**
   * The server's own slot changes (C.3, C.7): an item gained from the per-kart
   * gain tables (`gain`) or the 迅 start item (`start`). The server sends it
   * after the reply of the request that caused it, so my pending operations
   * still apply on top.
   */
  private onSlotsPush(event: ItemSlotsEvent): void {
    this.changers.confirm(event.changers);
    this.noteIcons(event.slots, event.slotIcons);
    this.slots.confirm(event.slots);
    this.applySlots(this.nowMs);
    if (event.reason === "start") {
      const at = this.options.now();
      this.startItemFlashAt = at;
      this.p3(presenter => presenter.startItemFlash?.(at));
    }
  }

  private onLucci(event: ItemLucciEvent): void {
    this.lucciNotice = { amount: event.amount, atMs: this.options.now() };
  }

  /** A `used` event: someone else's broadcast, or the reply to my own use. */
  private recordUse(event: ItemUsedEvent, own: boolean): void {
    if (this.disposed || this.uses.has(event.useId)) return;
    const definition = this.options.catalog.get(event.itemId);
    const now = this.options.now();
    const startMs = this.toLocal(event.startAt, now);
    const point = event.point ? clientToThreePoint(event.point) : undefined;
    const count = event.count === 2 ? 2 : 1;
    const record: UseRecord = { useId: event.useId, itemId: event.itemId, userId: event.playerId,
      targets: event.targets, startMs, etaMs: event.etaMs, count, victims: [],
      ...(point ? { point } : {}) };
    this.uses.set(event.useId, record);
    const use: ItemRaceUse = { useId: record.useId, itemId: record.itemId, userId: record.userId,
      targets: record.targets, startMs, etaMs: record.etaMs, ...(point ? { point } : {}),
      ...(count === 2 ? { count } : {}) };
    this.p3(presenter => presenter.used(use));
    if (!definition) return;
    const behaviour = definition.behaviour;
    this.presentUseEffects(record, behaviour, own);
    if (this.ended) return;
    this.scheduleVictim(record, behaviour);
  }

  /** Kart-attached effects every client shows for a use (shields, angel, EMP, bomb, magnet, ghost). */
  private presentUseEffects(record: UseRecord, behaviour: ItemBehaviour, own: boolean): void {
    const { userId, startMs, useId } = record;
    const me = this.playerId;
    switch (behaviour.effect) {
      case "shield":
        if (!own) this.kartEffect(userId, "shield", startMs, behaviour.shieldMs ?? behaviour.effectMs,
          causeOf(record.itemId, ItemIdx.shield));
        break;
      case "invincible":
        if (!own) {
          this.kartEffect(userId, "invincible", startMs + behaviour.delayMs, behaviour.effectMs,
            { itemId: record.itemId });
        }
        break;
      case "angel": {
        const from = startMs + behaviour.delayMs;
        for (const target of record.targets) {
          if (target === me) {
            this.setAngel(`use:${useId}`, from, from + behaviour.effectMs);
            if (own) continue;
          }
          this.kartEffect(target, "angel", from, behaviour.effectMs);
        }
        break;
      }
      case "emp":
        // C.1: it acts only on teammates under a UFO slow when Use ends.
        this.at(startMs + behaviour.delayMs, () => this.resolveEmp(record, behaviour));
        break;
      case "pull":
        if (!own && record.targets.length)
          this.kartEffect(userId, "pull", startMs, behaviour.effectMs,
            { target: record.targets[0]!, ...causeOf(record.itemId, ItemIdx.magnet) });
        if (!own && behaviour.shieldMs)
          this.kartEffect(userId, "shield", startMs, behaviour.shieldMs, { itemId: record.itemId });
        break;
      case "siren":
        if (!own && behaviour.shieldMs)
          this.kartEffect(userId, "shield", startMs, behaviour.shieldMs, { itemId: record.itemId });
        break;
      case "invisible": {
        const from = startMs + behaviour.delayMs;
        if (!own) {
          this.kartEffect(userId, "invisible", from, behaviour.effectMs,
            { visibleToMe: this.teammates(userId, me), itemId: record.itemId });
        }
        if (userId !== me) this.invisible.set(userId, { from, until: from + behaviour.effectMs });
        break;
      }
      default:
        if (!own && behaviour.family === "timeBomb")
          this.kartEffect(userId, "timeBomb", startMs, behaviour.delayMs, causeOf(record.itemId, ItemIdx.timeBomb));
        break;
    }
  }

  /** Put the local kart on the use's timeline: a targeted hit, an area or a proximity check. */
  private scheduleVictim(record: UseRecord, behaviour: ItemBehaviour): void {
    const me = this.playerId;
    const user = record.userId;
    const opponentOfUser = user !== me && !this.teammates(user, me);
    if (behaviour.target === "placed") {
      // Dropped traps catch everyone, their user after a grace.
      if (record.point) {
        const activeFrom = record.startMs + behaviour.delayMs;
        this.addArea(record, behaviour, record.point, activeFrom, activeFrom + (behaviour.lifetimeMs ?? 0),
          user === me ? activeFrom + ITEM_RACE_TUNING.bananaOwnerGraceMs : undefined,
          behaviour.triggerRadius);
      }
      return;
    }
    switch (behaviour.family) {
      case "barricade":
        if (opponentOfUser) this.scheduleBarricade(record, behaviour);
        return;
      case "waterBomb":
      case "timeBomb": {
        const activeFrom = record.startMs + behaviour.delayMs;
        const until = activeFrom + (behaviour.lifetimeMs ?? 0);
        // Water bombs: opponents at the thrown point; time bombs: everyone, placed later.
        if (behaviour.family === "timeBomb") this.addArea(record, behaviour, undefined, activeFrom, until);
        else if (opponentOfUser && record.point) this.addArea(record, behaviour, record.point, activeFrom, until);
        return;
      }
      case "siren":
        if (opponentOfUser && behaviour.touch) this.scheduleSiren(record, behaviour);
        return;
      case "waterbombFly":
        this.scheduleWaterbombFly(record, behaviour, opponentOfUser);
        return;
      case "lockdownRocket":
        if (opponentOfUser) this.scheduleLockdownField(record, behaviour);
        break;
      default:
        break;
    }
    if (!TARGETED_EFFECTS.has(behaviour.effect) || !record.targets.includes(me) || user === me) return;
    if (!behaviour.hitsTeammates && this.teammates(user, me)) return;
    const effectAt = record.startMs + effectStartOffsetMs(behaviour, record.etaMs);
    const warning = warningOf(record.itemId, behaviour);
    for (let shot = 0; shot < record.count; shot++) {
      const shotAt = effectAt + shot * ITEM_RULES.doubleRocketDelayMs;
      this.incoming.set(hitKey(record.useId, shot), { useId: record.useId, itemId: record.itemId,
        userId: user, behaviour, effectAt: shotAt, ...(record.count > 1 ? { shot: shot as 0 | 1 } : {}),
        ...(warning ? { warning } : {}) });
    }
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

  /** An opponent's siren: touching its kart while it runs spins me (I report it, like a hazard). */
  private scheduleSiren(record: UseRecord, behaviour: ItemBehaviour): void {
    const touch = behaviour.touch!;
    const from = record.startMs + touch.delayMs;
    this.proximity.set(`siren:${record.useId}`, { key: `siren:${record.useId}`, useId: record.useId,
      itemId: record.itemId, userId: record.userId,
      behaviour: { ...behaviour, effect: touch.effect, effectMs: touch.effectMs },
      from, until: from + touch.lifetimeMs, radius: touch.radius, once: false,
      center: () => this.options.remotes.pose(record.userId)?.position });
  }

  /**
   * waterbombFly (C.4): it flies to the racer ahead, rides it for CountDown and
   * bursts there; the target and the user's opponents within the burst radius
   * are trapped. Every client shows the bomb riding the target.
   */
  private scheduleWaterbombFly(record: UseRecord, behaviour: ItemBehaviour, opponentOfUser: boolean): void {
    const targetId = record.targets[0];
    const blast = behaviour.blast;
    if (!targetId || !blast) return;
    const attachAt = record.startMs + effectStartOffsetMs(behaviour, record.etaMs);
    const blastAt = attachAt + blast.delayMs;
    this.at(attachAt, () => this.kartEffect(targetId, "timeBomb", attachAt, blast.delayMs,
      { itemId: record.itemId }));
    const me = this.playerId;
    if (targetId === me && record.userId !== me) {
      const warning = warningOf(record.itemId, behaviour);
      this.incoming.set(hitKey(record.useId, 0), { useId: record.useId, itemId: record.itemId,
        userId: record.userId, behaviour, effectAt: attachAt, warnOnly: true, ...(warning ? { warning } : {}) });
    }
    if (targetId !== me && !opponentOfUser) return;
    this.proximity.set(`blast:${record.useId}`, { key: `blast:${record.useId}`, useId: record.useId,
      itemId: record.itemId, userId: record.userId, behaviour, from: blastAt, until: blastAt,
      radius: blast.radius, once: true,
      center: () => targetId === me ? this.localPose().position : this.options.remotes.pose(targetId)?.position });
  }

  /**
   * Lockdown / block rocket (C.4): the target is held (AffectMain, its own hit);
   * CountDown after the impact a field opens at the target and slows the
   * user's other opponents inside it for AffectSub. Field victims report a
   * plain hit; the others tell it from the main hit because the victim is not
   * the use's target.
   */
  private scheduleLockdownField(record: UseRecord, behaviour: ItemBehaviour): void {
    const field = behaviour.field;
    const targetId = record.targets[0];
    if (!field || !targetId || targetId === this.playerId) return;
    const from = record.startMs + effectStartOffsetMs(behaviour, record.etaMs) + field.delayMs;
    this.proximity.set(`field:${record.useId}`, { key: `field:${record.useId}`, useId: record.useId,
      itemId: record.itemId, userId: record.userId,
      behaviour: { ...behaviour, effect: field.effect, effectMs: field.effectMs,
        factors: { drive: ITEM_RULES.ufoDriveFactor, drag: ITEM_RULES.ufoDragFactor } },
      from, until: from + field.lifetimeMs, radius: field.radius, once: false, field: true,
      center: () => this.options.remotes.pose(targetId)?.position });
  }

  private addArea(record: UseRecord, behaviour: ItemBehaviour, point: Vec3 | undefined,
    activeFrom: number, activeUntil: number, ownerGraceUntil?: number, radius?: number): AreaRecord {
    const area: AreaRecord = { useId: record.useId, itemId: record.itemId, userId: record.userId,
      behaviour, activeFrom, activeUntil, radius: radius ?? behaviour.radius ?? 0,
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

  /**
   * The landed effect's length on a victim, by the hit's variant (C.2): the
   * balloon's AffectSmall, the headband's HeadBandAffect, the 奇奇 BonusAffect,
   * the waterAngel quick escape, the lockdown field's AffectSub.
   */
  private variantEffectMs(definition: ItemDefinition | undefined, behaviour: ItemBehaviour,
    variant: ItemHitVariant | undefined): number {
    const life = (state: string) => definition?.states.get(state)?.lifeMs;
    switch (variant) {
      case "balloon": return life("AffectSmall") ?? behaviour.effectMs;
      case "headband": return life("HeadBandAffect") ?? behaviour.effectMs;
      case "bonus": return life("BonusAffect") ?? behaviour.effectMs;
      case "quick": return ITEM_RULES.quickEscapeMs;
      // The reduced missile (AffectSmall) without a balloon.
      case "small": return life("AffectSmall") ?? behaviour.effectMs;
      default: return behaviour.effectMs;
    }
  }

  private onRemoteHit(event: ItemHitEvent): void {
    const now = this.options.now();
    const definition = this.options.catalog.get(event.itemId);
    const position = event.useId === 0 && event.hazardId !== undefined
      ? this.options.hazardPosition?.(event.hazardId)
      : this.options.remotes.pose(event.playerId)?.position;
    const hit: ItemRaceHit = { useId: event.useId, itemId: event.itemId,
      victimId: event.playerId, ...(event.userId ? { userId: event.userId } : {}),
      result: event.result, ...(event.by ? { by: event.by } : {}),
      ...(event.variant ? { variant: event.variant } : {}),
      ...(event.shot !== undefined ? { shot: event.shot } : {}), atMs: now,
      ...(position ? { position: { ...position } } : {}) };
    this.p3(presenter => presenter.hit(hit));
    if (event.removed) this.removeObject(event.useId);
    if (event.result === "blocked" && event.by === "shield")
      this.endKartEffect(event.playerId, "shield");
    const record = this.uses.get(event.useId);
    if (event.result === "hit" && definition) {
      const behaviour = definition.behaviour;
      // The siren's victims spin; the lockdown field's slow.
      const fieldHit = !!behaviour.field && (event.variant === "small" ||
        (!!record && !record.targets.includes(event.playerId)));
      const effect = fieldHit ? behaviour.field!.effect
        : behaviour.family === "siren" ? behaviour.touch?.effect ?? behaviour.effect : behaviour.effect;
      const kind = kartEffectOf(effect);
      const durationMs = behaviour.family === "siren" ? behaviour.touch?.effectMs ?? behaviour.effectMs
        : fieldHit ? behaviour.field!.effectMs : this.variantEffectMs(definition, behaviour, event.variant);
      if (kind) {
        const start = fieldHit ? now : this.remoteEffectStart(record, behaviour, now, event);
        this.kartEffect(event.playerId, kind, start, durationMs, causeOf(definition.idx, classicCause(kind)));
        if (definition.idx === ItemIdx.ufo) this.remoteUfoSlows.set(event.playerId, start + durationMs);
        if (behaviour.family === "talisman" && effect === "hold") {
          this.remoteHolds.set(event.playerId, { useId: event.useId, startMs: start, untilMs: start + durationMs,
            escapeMs: behaviour.escapeShieldMs ?? 0 });
        }
        // The blue shield follows the bubble's end, or the racer's early escape.
        if (kind === "trap" && behaviour.escapeShieldMs) {
          this.remoteTraps.set(event.playerId, { useId: event.useId,
            ...(event.hazardId !== undefined ? { hazardId: event.hazardId } : {}),
            untilMs: start + durationMs, escapeShieldMs: behaviour.escapeShieldMs });
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
    const now = this.options.now();
    const hold = this.remoteHolds.get(event.playerId);
    if (hold && hold.useId === event.useId && now < hold.untilMs) {
      // A talisman's QTE succeeded: the hold ends after its EscapeAffect.
      this.remoteHolds.delete(event.playerId);
      this.kartEffect(event.playerId, "hold", hold.startMs, now + hold.escapeMs - hold.startMs,
        { itemId: event.itemId });
      return;
    }
    const trap = this.remoteTraps.get(event.playerId);
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

  /** A banana or mine that was run over (or eaten) disappears for everyone. */
  private removeObject(useId: number): void {
    this.areas.delete(useId);
    this.presenterCall(presenter => presenter.removed(useId));
  }

  private remoteEffectStart(record: UseRecord | undefined, behaviour: ItemBehaviour, now: number,
    event: ItemHitEvent): number {
    if (!record || behaviour.target === "placed" || behaviour.target === "area" ||
        behaviour.effect === "barrier" || behaviour.family === "siren" || behaviour.family === "waterbombFly")
      return now;
    const shotDelay = event.shot === 1 ? ITEM_RULES.doubleRocketDelayMs : 0;
    return Math.min(now, record.startMs + effectStartOffsetMs(behaviour, record.etaMs) + shotDelay);
  }

  /**
   * EMP (C.1, Appendix B): when Use ends, every teammate it covers that is
   * under a UFO slow right then loses it (EMP `fired01` on its kart for
   * Affect); anyone else is left alone, and with no UFO nothing happens.
   */
  private resolveEmp(record: UseRecord, behaviour: ItemBehaviour): void {
    const at = record.startMs + behaviour.delayMs;
    const now = this.nowMs;
    for (const target of record.targets) {
      if (target === this.playerId) {
        if (this.ended || !this.localUfoSlowActive(now)) continue;
        const effects = this.options.physics.itemEffects;
        const ended = effects?.hasSource ? effects.end("slow", ItemIdx.ufo) : effects?.end("slow");
        if (effects && !ended) continue;
        this.localUfoSlowUntil = 0;
        this.endKartEffect(target, "slow");
        this.kartEffect(target, "emp", at, behaviour.effectMs);
        continue;
      }
      const until = this.remoteUfoSlows.get(target);
      if (until === undefined || until <= now) continue;
      this.remoteUfoSlows.delete(target);
      this.endKartEffect(target, "slow");
      this.kartEffect(target, "emp", at, behaviour.effectMs);
    }
  }

  private localUfoSlowActive(nowMs: number): boolean {
    if (nowMs >= this.localUfoSlowUntil) return false;
    const effects = this.options.physics.itemEffects;
    if (!effects) return true;
    return effects.hasSource ? effects.hasSource("slow", ItemIdx.ufo) : effects.remainingMs("slow") > 0;
  }

  // ---- hits on the local kart ---------------------------------------------

  private resolveIncoming(nowMs: number): void {
    for (const [key, hit] of this.incoming) {
      if (nowMs < hit.effectAt) continue;
      this.incoming.delete(key);
      if (hit.warnOnly) continue;
      this.resolveHit({ useId: hit.useId, itemId: hit.itemId, userId: hit.userId, behaviour: hit.behaviour,
        effectAt: hit.effectAt, position: this.localPose().position,
        ...(hit.shot !== undefined ? { shot: hit.shot } : {}) }, nowMs, "targeted");
    }
  }

  /**
   * Area items against the local kart, once per frame before the physics. The
   * kart's path since the last check counts, not only where it is now, so a
   * fast kart or a long frame cannot step over a banana (a reset or warp jump
   * is not a path: `sweepOrigin`).
   */
  private checkAreas(nowMs: number): void {
    const position = { ...this.localPose().position };
    const previous = this.areaSweep;
    this.areaSweep = { position, atMs: nowMs };
    if (this.options.local.suspended() || this.options.physics.itemEffects?.immune) return;
    const from = previous ? sweepOrigin(previous.position, position, nowMs - previous.atMs) : undefined;
    for (const area of this.areas.values()) {
      if (!area.point || this.reported.has(hitKey(area.useId, 0))) continue;
      const late = area.lateCheck === true;
      area.lateCheck = false;
      if (!late && (nowMs < area.activeFrom || nowMs > area.activeUntil)) continue;
      if (area.ownerGraceUntil !== undefined && nowMs < area.ownerGraceUntil) continue;
      if (distance(position, area.point) > area.radius &&
          !sweptThrough(from, position, area.point, area.radius)) continue;
      this.resolveHit({ useId: area.useId, itemId: area.itemId, userId: area.userId,
        behaviour: area.behaviour, effectAt: nowMs, position: area.point }, nowMs, "area");
    }
  }

  /**
   * Fields, bursts and sirens near the local kart (their centre moves with a
   * kart). A burst is checked once (a reset or warp at that moment misses it);
   * a field or siren keeps checking while the kart is held or immune, like an
   * area item.
   */
  private checkProximity(nowMs: number): void {
    const suspended = this.options.local.suspended();
    const immune = this.options.physics.itemEffects?.immune ?? false;
    const position = this.localPose().position;
    for (const [key, check] of this.proximity) {
      if (nowMs < check.from) continue;
      if (this.reported.has(hitKey(check.useId, 0)) || (!check.once && nowMs > check.until)) {
        this.proximity.delete(key);
        continue;
      }
      if (check.once) this.proximity.delete(key);
      else if (suspended || immune) continue;
      const center = check.center();
      if (!center || distance(position, center) > check.radius) continue;
      this.resolveHit({ useId: check.useId, itemId: check.itemId, userId: check.userId,
        behaviour: check.behaviour, effectAt: check.once ? check.from : nowMs, position: { ...center },
        ...(check.field ? { field: true } : {}) }, nowMs, check.once ? "targeted" : "area");
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

  /** The equipment passives of this hit, rolled (C.1, C.2). */
  private equipmentOutcome(hit: HitInput): EquipmentOutcome {
    const passives = this.passives;
    if (passives === NO_PASSIVES) return {};
    const context: PassiveRollContext = { raceId: this.options.raceId ?? "", useId: hit.useId,
      ...(hit.hazardId !== undefined ? { hazardId: hit.hazardId } : {}), victimId: this.playerId,
      itemId: hit.itemId, ...(this.options.trackId ? { trackId: this.options.trackId } : {}) };
    const outcome: EquipmentOutcome = {};
    const block = equipmentBlock(passives, context);
    if (block) {
      outcome.block = block.by === "eat" ? { by: "eat", bonus: block.bonus } : { by: block.by };
      return outcome;
    }
    const variant = partialVariant(passives, context, { balloonSpent: this.balloonSpent.has(hit.useId) });
    if (variant) outcome.variant = variant;
    return outcome;
  }

  /**
   * Decide a hit on the local kart, apply it and report it. When the kart
   * cannot take the physics effect right now (apply() refuses it), nothing is
   * reported that the local physics did not show:
   * - an area item (banana, water or time bomb, barricade, field, siren) stays
   *   live and unreported while a launch or barricade holds the kart, and lands
   *   once the hold ends if the kart is still inside;
   * - a track hazard is not reported (the hazard field fires again only after
   *   the kart leaves and re-enters it);
   * - a targeted hit (its timeline is over) is reported as not landed:
   *   `blocked` without a defence.
   */
  private resolveHit(hit: HitInput, nowMs: number, source: HitSource): void {
    const key = hitKey(hit.useId, hit.shot ?? 0);
    if (hit.useId > 0 && this.reported.has(key)) return;
    const effects = this.options.physics.itemEffects;
    const passives = this.passives;
    const equipment = hit.field ? {} : this.equipmentOutcome(hit);
    let decision: HitDecision = decideHit(hit.itemId, hit.behaviour, {
      immune: effects?.immune ?? false,
      shield: nowMs < this.shieldUntil,
      angel: this.angelActive(nowMs),
      invincible: !!this.invincible && this.invincible.from <= nowMs && nowMs < this.invincible.until,
      suspended: this.options.local.suspended(),
    }, equipment);
    if (decision.result === "hit" && !decision.variant && hit.behaviour.effect === "trap" &&
        quickEscape(passives, { raceId: this.options.raceId ?? "", useId: hit.useId,
          ...(hit.hazardId !== undefined ? { hazardId: hit.hazardId } : {}),
          victimId: this.playerId, itemId: hit.itemId })) decision = { ...decision, variant: "quick" };
    if (decision.result === "hit" && !this.applyHit(hit, nowMs, decision.variant)) {
      if (source !== "targeted") return;
      decision = { result: "blocked" };
    }
    if (hit.useId > 0) this.reported.add(key);
    if (decision.variant === "balloon") this.balloonSpent.add(hit.useId);
    if (decision.by === "shield" && !decision.invincible) {
      this.shieldUntil = 0;
      this.endKartEffect(this.playerId, "shield");
    }
    const fields: Record<string, unknown> = { useId: hit.useId, itemId: hit.itemId,
      result: decision.result };
    if (decision.by) fields.by = decision.by;
    if (decision.variant) fields.variant = decision.variant;
    if (hit.hazardId !== undefined) fields.hazardId = hit.hazardId;
    if (hit.shot !== undefined) fields.shot = hit.shot;
    this.send("hit", fields).then(
      reply => this.guard("命中回包处理失败", () => {
        if ((reply as ItemHitEvent).removed) this.removeObject(hit.useId);
      }),
      error => this.warn(`道具 ${hit.itemId} 命中上报被拒绝`, error));
    // A dropped trap (banana, mine, …) is spent on its first victim or eater.
    if (hit.behaviour.target === "placed" && hit.useId > 0 &&
        (decision.result === "hit" || decision.by === "eat")) this.areas.delete(hit.useId);
    const presented: ItemRaceHit = { useId: hit.useId, itemId: hit.itemId,
      victimId: this.playerId, ...(hit.userId ? { userId: hit.userId } : {}),
      result: decision.result, ...(decision.by ? { by: decision.by } : {}),
      ...(decision.variant ? { variant: decision.variant } : {}),
      ...(hit.shot !== undefined ? { shot: hit.shot } : {}), atMs: nowMs,
      ...(hit.position ? { position: { ...hit.position } } : {}) };
    this.p3(presenter => presenter.hit(presented));
    if (hit.useId === 0 || !hit.userId) return;
    this.addLog(hit.userId, this.playerId, hit.itemId, decision.result === "blocked", nowMs);
    if (decision.result === "hit") {
      this.pushNotice({ kind: "bad", itemIdx: hit.itemId, text: this.nameOf(hit.userId), at: nowMs });
    }
  }

  /** Apply a landed hit; false when the kart cannot take its physics effect now. */
  private applyHit(hit: HitInput, nowMs: number, variant: ItemHitVariant | undefined): boolean {
    const { behaviour, effectAt } = hit;
    const durationMs = hit.field ? behaviour.effectMs
      : this.variantEffectMs(this.options.catalog.get(hit.itemId), behaviour, variant);
    const kind = physicsEffect(behaviour.effect);
    if (kind) {
      const effects = this.options.physics.itemEffects;
      if (effects) {
        const options: ItemRaceEffectOptions = { elapsedMs: Math.max(0, nowMs - effectAt) };
        if (kind === "trap") {
          options.escapeImmunityMs = behaviour.escapeShieldMs ?? 0;
          options.afterBoost = behaviour.afterBoost !== false;
          if (variant === "quick") options.quick = true;
        }
        if (kind === "reverse" && behaviour.reverseMode) options.mode = behaviour.reverseMode;
        if (kind === "reverse" || kind === "slow" || kind === "shrink") options.source = hit.itemId;
        const applied = effects.apply(kind, durationMs, options);
        if (!applied) return false;
      }
      if (kind === "trap") {
        this.localTrap = { useId: hit.useId,
          ...(hit.useId === 0 && hit.hazardId !== undefined ? { hazardId: hit.hazardId } : {}) };
      }
      if (hit.itemId === ItemIdx.ufo && kind === "slow") this.localUfoSlowUntil = effectAt + durationMs;
      if (behaviour.family === "talisman" && kind === "hold") this.startTalisman(hit, effectAt, durationMs);
    } else if (behaviour.effect === "cloud") {
      const factors = cloudFactors(this.passives);
      const until = effectAt + behaviour.effectMs * factors.duration;
      if (behaviour.overlay) this.overlays.push({ kind: behaviour.overlay, from: effectAt, until, opacity: factors.opacity });
      else this.cloudWindows.push({ from: effectAt, until });
    } else if (behaviour.effect === "lock") {
      this.lockWindows.push({ from: effectAt, until: effectAt + behaviour.effectMs });
      if (this.aim && this.aim.itemId !== ItemIdx.angel) this.cancelAim();
    }
    // Screen covers that come with the effect (blind rockets, bee, lion mask, oil).
    if (behaviour.overlay && behaviour.effect !== "cloud") {
      this.overlays.push({ kind: behaviour.overlay, from: effectAt,
        until: effectAt + (behaviour.overlayMs ?? durationMs), opacity: 1 });
    }
    // Item locks: during a talisman hold, and after an infected bubble.
    if (behaviour.lockMs)
      this.lockWindows.push({ from: effectAt, until: effectAt + behaviour.lockMs, tag: `talisman:${hit.useId}` });
    if (behaviour.postLockMs) {
      const from = effectAt + durationMs;
      this.lockWindows.push({ from, until: from + behaviour.postLockMs });
    }
    if ((behaviour.lockMs || behaviour.postLockMs) && this.aim && this.aim.itemId !== ItemIdx.angel &&
        this.locked(nowMs)) this.cancelAim();
    return true;
  }

  // ---- talisman QTE (符咒) ------------------------------------------------

  /**
   * The talisman holds me and locks my items; pressing its five arrows in
   * order (uiEffect.bml panels 0–4, `talisman_<dir>_normal/press`) ends the
   * hold early ([还原]: the sequence comes from the use, a wrong arrow
   * restarts it, `입력성공` / `입력실패` sounds).
   */
  private startTalisman(hit: HitInput, effectAt: number, durationMs: number): void {
    const seed = fnv1a32(`${this.options.raceId ?? ""}|${hit.useId}|talisman`);
    const sequence: ItemDirection[] = [];
    for (let index = 0; index < ITEM_RACE_TUNING.talismanArrows; index++)
      sequence.push(DIRECTIONS[(seed >>> (index * 2)) & 3]!);
    this.talisman = { useId: hit.useId, sequence, progress: 0, untilMs: effectAt + durationMs,
      escapeMs: hit.behaviour.escapeShieldMs ?? 0 };
    // Arrows pressed before the hold do not count.
    this.options.physics.itemEffects?.consumeDirectionPresses?.();
  }

  private updateTalisman(nowMs: number): void {
    const talisman = this.talisman;
    const effects = this.options.physics.itemEffects;
    if (!talisman || !effects?.consumeDirectionPresses) return;
    if (nowMs >= talisman.untilMs) {
      this.talisman = undefined;
      return;
    }
    for (const press of effects.consumeDirectionPresses()) {
      if (press.direction === talisman.sequence[talisman.progress]) {
        talisman.progress += 1;
        this.presenterCall(presenter => presenter.sound(ItemIdx.talisman, "입력성공"));
        if (talisman.progress < talisman.sequence.length) continue;
        effects.escapeHold?.(talisman.escapeMs);
        this.endTalismanLock(talisman.useId, nowMs + talisman.escapeMs);
        this.talisman = undefined;
        // The node ends its lock too, and the others end the hold (escape → escaped).
        if (!this.ended) {
          this.send("escape", { useId: talisman.useId }).catch(
            error => this.warn("符咒脱出通知被拒绝", error));
        }
        return;
      }
      talisman.progress = 0;
      talisman.failedAtMs = nowMs;
      this.presenterCall(presenter => presenter.sound(ItemIdx.talisman, "입력실패"));
    }
  }

  private endTalismanLock(useId: number, untilMs: number): void {
    for (const window of this.lockWindows)
      if (window.tag === `talisman:${useId}`) window.until = Math.min(window.until, untilMs);
  }

  // ---- presentation -------------------------------------------------------

  /** Local physics effects (bubble, spin, flip, …) and the blue shield to the presenter. */
  private presentLocalEffects(nowMs: number): void {
    const effects = this.options.physics.itemEffects;
    if (!effects) return;
    for (const event of effects.consumeEvents()) {
      const kind = event.kind as ItemRaceKartEffect;
      if (event.phase === "end") {
        this.endKartEffect(this.playerId, kind);
        if (event.kind === "trap") this.localTrapEnded(event.reason);
        if (event.kind === "slow") this.localUfoSlowUntil = Math.min(this.localUfoSlowUntil, nowMs);
        if (event.kind === "hold" && this.talisman) {
          if (event.reason === "escaped") this.endTalismanLock(this.talisman.useId, nowMs);
          this.talisman = undefined;
        }
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

  private kartEffect(playerId: string, kind: ItemRaceKartEffect, startMs: number, durationMs: number,
    options?: ItemRaceKartEffectOptions): void {
    this.p3(presenter => options ? presenter.kartEffect(playerId, kind, startMs, durationMs, options)
      : presenter.kartEffect(playerId, kind, startMs, durationMs));
  }

  private endKartEffect(playerId: string, kind: ItemRaceKartEffect): void {
    this.p3(presenter => presenter.endKartEffect(playerId, kind));
  }

  private presenterCall(call: (presenter: ItemRacePresenter) => void): void {
    const presenter = this.options.presenter;
    if (!presenter) return;
    try { call(presenter); }
    catch (error) { this.warn("道具表现层调用失败", error); }
  }

  /** The presenter with the phase-3 contract (item-race-p3-contract.ts). */
  private p3(call: (presenter: ItemRacePresenterP3) => void): void {
    this.presenterCall(presenter => call(presenter as unknown as ItemRacePresenterP3));
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

  /**
   * The special booster shows the kart's own `animal<iconId>` icon (C.3): the
   * one the server sends with the slots, else the kart's animalBooster row.
   */
  private slotIcons(slots: readonly number[]): (number | undefined)[] | undefined {
    if (!slots.includes(ItemIdx.animalBooster)) return undefined;
    const icon = this.serverAnimalIcon ??
      animalBoosterIcon(this.options.catalog.animalBoosters, this.passives.kartId);
    if (icon === undefined) return undefined;
    return slots.map(slot => slot === ItemIdx.animalBooster ? icon : undefined);
  }

  /** Remember the server's icon for a special booster in these slots. */
  private noteIcons(slots: readonly number[] | undefined, icons: readonly number[] | undefined): void {
    if (!slots || !icons) return;
    slots.forEach((slot, index) => {
      if (slot === ItemIdx.animalBooster && icons[index]) this.serverAnimalIcon = icons[index];
    });
  }

  /** Bottom-left boards before the start (C.10): team races first, then the changer cards. */
  private tutorial(): "changer" | "avoidTeamkill" | undefined {
    if (this.started || this.ended) return undefined;
    if (this.options.teamRace) return "avoidTeamkill";
    return this.changers.holdsAny ? "changer" : undefined;
  }

  private currentWarning(nowMs: number): "rocket" | "waterfly" | undefined {
    let warning: { kind: "rocket" | "waterfly"; at: number } | undefined;
    for (const hit of this.incoming.values()) {
      if (!hit.warning || nowMs >= hit.effectAt) continue;
      if (!warning || hit.effectAt < warning.at) warning = { kind: hit.warning, at: hit.effectAt };
    }
    return warning?.kind;
  }

  /** The most recent screen cover still running. */
  private currentOverlay(nowMs: number): OverlayWindow | undefined {
    let current: OverlayWindow | undefined;
    for (const overlay of this.overlays) {
      if (overlay.from <= nowMs && nowMs < overlay.until && (!current || overlay.from >= current.from))
        current = overlay;
    }
    return current;
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

  private activeWindow<T extends TimeWindow>(windows: readonly T[], nowMs: number): T | undefined {
    let active: T | undefined;
    for (const window of windows) {
      if (window.from <= nowMs && nowMs < window.until && (!active || window.until > active.until))
        active = window;
    }
    return active;
  }

  // ---- lifecycle ----------------------------------------------------------

  /** Run `run` once the presenter clock reaches `at` (now when it already has). */
  private at(at: number, run: () => void): void {
    if (at <= this.nowMs) this.guard("道具定时处理失败", run);
    else this.timed.push({ at, run });
  }

  private runTimed(nowMs: number): void {
    if (!this.timed.length) return;
    const due = this.timed.filter(entry => entry.at <= nowMs);
    if (!due.length) return;
    for (let index = this.timed.length - 1; index >= 0; index--)
      if (this.timed[index]!.at <= nowMs) this.timed.splice(index, 1);
    for (const entry of due.sort((a, b) => a.at - b.at)) this.guard("道具定时处理失败", entry.run);
  }

  /** The local racer finished (or left the Racing state): no more item actions or hits. */
  private endLocalRace(): void {
    this.ended = true;
    this.cancelAim();
    for (const hit of this.incoming.values()) {
      // A cloud still on its way never covers a finished racer: the presenter
      // drops what it queued for me (the cover's removal sound).
      if (hit.behaviour.effect !== "cloud") continue;
      this.p3(presenter => presenter.hit({ useId: hit.useId, itemId: hit.itemId,
        victimId: this.playerId, userId: hit.userId, result: "blocked", atMs: this.nowMs }));
    }
    this.incoming.clear();
    this.areas.clear();
    this.proximity.clear();
    this.lockWindows.length = 0;
    this.cloudWindows.length = 0;
    this.overlays.length = 0;
    if (this.shieldUntil > this.nowMs) this.endKartEffect(this.playerId, "shield");
    if (this.angelUntil > this.nowMs) this.endKartEffect(this.playerId, "angel");
    if (this.invincible && this.invincible.until > this.nowMs) this.endKartEffect(this.playerId, "invincible");
    if (this.bombs.size) this.endKartEffect(this.playerId, "timeBomb");
    this.shieldUntil = 0;
    this.angels.clear();
    this.angelUntil = 0;
    this.invincible = undefined;
    this.localUfoSlowUntil = 0;
    this.bombs.clear();
    this.localTrap = undefined;
    this.talisman = undefined;
    this.areaSweep = undefined;
    this.infoCard = undefined;
  }

  private prune(nowMs: number): void {
    const keep = (windows: TimeWindow[]) => {
      for (let index = windows.length - 1; index >= 0; index--)
        if (windows[index]!.until <= nowMs) windows.splice(index, 1);
    };
    keep(this.lockWindows);
    keep(this.cloudWindows);
    keep(this.overlays);
    for (const [useId, area] of this.areas) {
      if (!area.lateCheck && nowMs > area.activeUntil + ITEM_RACE_TUNING.areaLateGraceMs)
        this.areas.delete(useId);
    }
    for (const [useId, record] of this.uses) {
      if (nowMs - record.startMs > ITEM_RACE_TUNING.useLifetimeMs &&
          ![...this.incoming.values()].some(hit => hit.useId === useId) &&
          !this.areas.has(useId)) {
        this.uses.delete(useId);
        this.balloonSpent.delete(useId);
      }
    }
    for (const [playerId, scan] of this.scans) if (nowMs >= scan.until) this.scans.delete(playerId);
    for (const [playerId, until] of this.remoteUfoSlows) if (until <= nowMs) this.remoteUfoSlows.delete(playerId);
    for (const [playerId, hold] of this.remoteHolds) if (hold.untilMs <= nowMs) this.remoteHolds.delete(playerId);
    for (const [playerId, window] of this.invisible) if (window.until <= nowMs) this.invisible.delete(playerId);
    let angelsExpired = false;
    for (const [key, window] of this.angels) {
      if (window.until > nowMs) continue;
      this.angels.delete(key);
      angelsExpired = true;
    }
    if (angelsExpired) this.refreshAngel();
    if (this.invincible && this.invincible.until <= nowMs) this.invincible = undefined;
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

/**
 * `{ itemId }` when a kart effect comes from another item than the classic
 * ones that define its look (a super shield, a snow bomb's ice, the bomb a fly
 * carries), so the presenter can show that item; nothing for a classic one.
 */
function causeOf(itemId: number, classic: number | readonly number[] | undefined):
  ItemRaceKartEffectOptions | undefined {
  const classics = classic === undefined ? [] : typeof classic === "number" ? [classic] : classic;
  return classics.includes(itemId) ? undefined : { itemId };
}

/** The classic (Appendix B) items behind each kart effect. */
function classicCause(kind: ItemRaceKartEffect): readonly number[] {
  switch (kind) {
    case "trap": return [ItemIdx.waterBomb, ItemIdx.waterFly, ItemIdx.timeBomb, ItemIdx.waterMine];
    case "spin": return [ItemIdx.banana];
    case "launch": return [ItemIdx.rocket, ItemIdx.guideRocket, ItemIdx.randomRocket, ItemIdx.mine];
    case "reverse": return [ItemIdx.devil];
    case "slow": return [ItemIdx.ufo];
    case "shrink": return [ItemIdx.thunderbolt];
    case "barrier": return [ItemIdx.barricade];
    default: return [];
  }
}

/** Reported/incoming key of one missile of a use (shot 1 only for double rockets). */
function hitKey(useId: number, shot: number): string {
  return `${useId}:${shot}`;
}
