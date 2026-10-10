import type { Camera, Matrix4, Object3D } from "three";
import { decodeItemBml, type ItemBml, type ItemCatalog } from "./item-catalog";
import {
  FxModelBank, FxSoundBank, type FxAudioContext, type FxInstance, type FxModelPool,
  type FxPlayingSound, type ItemFxOps,
} from "./item-fx-assets";
import {
  ITEM_FX_TUNING, buildItemFxPlan, type AuraFx, type BarricadeFx, type BeamFx, type CloudFx, type CurseFx,
  type BlockFx, type FxModel, type FxSound, type ItemFx, type ItemFxPlan, type ItemKartEffect, type KartMotionKey, type KartVisual,
  type LockFx,
  type ProjectileFx, type ThrowFx, type TimeBombFx, type UfoFx,
} from "./item-fx-plan";
import { KartMotion, atRest, fallingMotion, kartMotionTrack, rigidMotion, type KartMotionTrack } from "./item-kart-motion";

export type { ItemKartEffect } from "./item-fx-plan";

/**
 * The item race presenter (道具赛表现层, ITEM_MODE.md §7 and C.4): projectiles,
 * thrown and placed objects, effects on the karts and item sounds, for the
 * local kart and remote karts alike. The race controller calls the event
 * methods; the race presenter calls `update` every frame after the track
 * render update. Coordinates are three.js world space (y-up, the space of the
 * physics `body.position` and the cube field); times are local milliseconds
 * on the race presenter clock (`toLocalTick` results and `nowMs`).
 *
 * Which state's model and sound play when comes from item-fx-plan.ts, which
 * reads every item from its own folder and variant. Every event is idempotent
 * per visual: a kart effect started from `used` (shield, angel, timeBomb,
 * magnet, …) and again from `kartEffect` keeps one visual, and the local
 * racer's own effect that `endKartEffect` already ended (a shield spent on a
 * block before the use's reply) is not brought back by the reply's `used`.
 * A kart effect that starts right after a hit takes the hitting item's look
 * (the snow bomb's ice, the lockdown's hold, a tiger missile's slow without a
 * UFO). Visuals that should already be running when an event arrives late
 * start part-way through their animation; sounds more than `soundLateMs`
 * late are dropped.
 */

export interface ItemPresenterVec3 { x: number; y: number; z: number }

export interface ItemPresenterPose {
  position: ItemPresenterVec3;
  right: ItemPresenterVec3;
  forward: ItemPresenterVec3;
  up: ItemPresenterVec3;
}

export interface ItemPresenterFrame {
  nowMs: number;
  camera: Camera;
  width: number;
  height: number;
  /** Local and remote karts; undefined for a racer without a pose this frame. */
  pose(playerId: string): ItemPresenterPose | undefined;
  localPlayerId: string;
}

export interface ItemPresenterUse {
  useId: number;
  itemId: number;
  userId: string;
  targets: readonly string[];
  startMs: number;
  etaMs: number;
  point?: ItemPresenterVec3;
  /** Missiles fired at once (`used.count`: 2 for a two-missile kart, the second 200 ms later). */
  count?: number;
}

export interface ItemPresenterPlacement {
  useId: number;
  itemId: number;
  userId: string;
  point: ItemPresenterVec3;
  /** The use's start (its timeline origin). */
  startMs: number;
}

/** Hit variants of ITEM_MODE.md C.2/C.7. */
export type ItemHitVariant = "small" | "headband" | "bonus" | "quick" | "balloon";

export interface ItemPresenterHit {
  useId: number;
  itemId: number;
  victimId: string;
  userId?: string;
  result: "hit" | "blocked";
  /** shield, angel, emp, escape; kart/pet (an equipment passive, SpecialShield); eat (Eat). */
  by?: string;
  atMs: number;
  position?: ItemPresenterVec3;
  /** Which missile of a two-missile use (0 or 1); omitted for one. */
  shot?: number;
  variant?: ItemHitVariant;
}

export interface ItemKartEffectOptions {
  /** pull: the racer the magnet pulls toward; its field faces that kart. */
  target?: string;
  /** invisible: this client may see the kart (its own racer and teammates see it translucent). */
  visibleToMe?: boolean;
  /** The item that causes the effect, when the caller knows it (a gold vs a protect shield). */
  itemId?: number;
}

/** How the race presenter draws one racer's kart this frame (`kartPresentation`). */
export interface ItemKartPresentationState {
  /** 1 normal, 0 hidden (invisible to other teams), between: translucent. */
  opacity: number;
  /** The balloon accessory: hidden while it pops. */
  balloonVisible: boolean;
}

export interface ItemRacePresenter {
  /** Added to the track group once. */
  readonly object: Object3D;
  /** Every `used` event, the local racer's own uses included. */
  used(event: ItemPresenterUse): void;
  placed(event: ItemPresenterPlacement): void;
  hit(event: ItemPresenterHit): void;
  /** A placed object is gone (a banana that was run over). */
  removed(useId: number): void;
  /**
   * `options.target` (pull only) is the racer the magnet pulls toward: its
   * field faces that kart. Without it the field faces the kart's nose until a
   * `used` of the magnet names its target. `options.visibleToMe` decides how
   * an invisible kart shows here; `options.itemId` names the causing item.
   */
  kartEffect(playerId: string, kind: ItemKartEffect, startMs: number, durationMs: number,
    options?: ItemKartEffectOptions): void;
  endKartEffect(playerId: string, kind: ItemKartEffect, options?: { tail?: boolean }): void;
  sound(itemId: number, stem: string,
    options?: { position?: ItemPresenterVec3; key?: string; loop?: boolean }): void;
  stopSound(key: string): void;
  /** How a racer's kart shows now (invisibility, the balloon popping); undefined = as usual. */
  kartPresentation?(playerId: string, nowMs: number): ItemKartPresentationState | undefined;
  /**
   * How an item hit moves this racer's drawn kart now (its `firedkart`
   * motion, item-kart-motion.ts), in the kart's own frame; undefined when it
   * does not move.
   */
  kartMotion?(playerId: string, nowMs: number): Matrix4 | undefined;
  /** The XUN start item reached the slots: the charger sound (`sound_/fx/charger`). */
  startItemFlash?(atMs: number): void;
  update(frame: ItemPresenterFrame): void;
  /** Forget all transient visuals (e.g. on race restart). */
  reset(): void;
  dispose(): void;
}

type Vec3 = ItemPresenterVec3;

const WORLD_UP: Vec3 = Object.freeze({ x: 0, y: 1, z: 0 });
const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const copy = (out: Vec3, from: Vec3): Vec3 => { out.x = from.x; out.y = from.y; out.z = from.z; return out; };
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const addScaled = (out: Vec3, a: Vec3, b: Vec3, scale: number): Vec3 => {
  out.x = a.x + b.x * scale; out.y = a.y + b.y * scale; out.z = a.z + b.z * scale;
  return out;
};
const cross = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
  out.x = x; out.y = y; out.z = z;
  return out;
};
const normalize = (out: Vec3): boolean => {
  const size = length(out);
  if (!(size > 1e-6)) return false;
  out.x /= size; out.y /= size; out.z /= size;
  return true;
};

/** Where and how a model shows: the kart-like basis (right, up, forward) at a point. */
interface Placement { position: Vec3; right: Vec3; up: Vec3; forward: Vec3; scale: number }

/** Writes a frame's placement; false hides the visual this frame. */
type Placer = (frame: ItemPresenterFrame, nowMs: number, out: Placement) => boolean;

/**
 * Right-handed basis like the physics body (right = up × forward) whose
 * forward is `direction` levelled against `up`; false when it has no level part.
 */
function faceAlong(out: Placement, direction: Vec3, up: Vec3): boolean {
  copy(out.up, up);
  addScaled(out.forward, direction, up, -dot(direction, up));
  if (!normalize(out.forward)) return false;
  cross(out.right, out.up, out.forward);
  return normalize(out.right);
}

/** Direction-only basis (projectiles): forward along `direction`, up as close to world up as it allows. */
function pointAlong(out: Placement, direction: Vec3): boolean {
  copy(out.forward, direction);
  if (!normalize(out.forward)) return false;
  cross(out.right, WORLD_UP, out.forward);
  if (!normalize(out.right)) cross(out.right, vec(0, 0, 1), out.forward), normalize(out.right);
  cross(out.up, out.forward, out.right);
  return true;
}

function poseBasis(out: Placement, pose: ItemPresenterPose): void {
  copy(out.right, pose.right);
  copy(out.up, pose.up);
  copy(out.forward, pose.forward);
}

/** On a kart, with its basis, `lift` up its own up axis. */
function onKart(playerId: string, lift = 0): Placer {
  return (frame, _now, out) => {
    const pose = frame.pose(playerId);
    if (!pose) return false;
    poseBasis(out, pose);
    addScaled(out.position, pose.position, pose.up, lift);
    return true;
  };
}

/** At a point, levelled, facing `facing()` (asked each frame until it answers, then kept). */
function atPoint(point: (frame: ItemPresenterFrame) => Vec3 | undefined,
  facing: (frame: ItemPresenterFrame) => Vec3 | undefined): Placer {
  let direction: Vec3 | undefined;
  return (frame, _now, out) => {
    const position = point(frame);
    if (!position) return false;
    direction ??= facing(frame);
    copy(out.position, position);
    if (!direction || !faceAlong(out, direction, WORLD_UP)) {
      copy(out.right, vec(1, 0, 0)); copy(out.up, WORLD_UP); copy(out.forward, vec(0, 0, 1));
    }
    return true;
  };
}

/** Where a kart is when the visual first shows, kept there afterwards. */
function whereKartWas(playerId: string, fallback?: Vec3): Placer {
  let point: Vec3 | undefined;
  let facing: Vec3 | undefined;
  return atPoint(frame => {
    if (!point) {
      const pose = frame.pose(playerId);
      if (pose) {
        point = { ...pose.position };
        facing = { ...pose.forward };
      } else if (fallback) point = { ...fallback };
    }
    return point;
  }, () => facing);
}

interface FxVisual {
  readonly group: string;
  readonly pool: FxModelPool;
  /** The model's own scale (FxModel.scale). */
  readonly scale: number;
  /** The animation's time zero (reset time of the model's controllers). */
  anchorMs: number;
  showMs: number;
  endMs: number;
  /** Replaced when a later start of a kart effect knows more (the magnet's target). */
  place: Placer;
  instance?: FxInstance;
  /** Finished: out of `visuals` for good (a pass over a copy of the list skips it). */
  done?: boolean;
}

type SoundAnchor =
  | { kind: "kart"; playerId: string; onlyLocal?: boolean }
  | { kind: "point"; position: Vec3 }
  | { kind: "screen" };

interface SoundRequest {
  path: FxSound;
  atMs: number;
  anchor: SoundAnchor;
  group?: string;
  key?: string;
  loop?: boolean;
}

interface UseRecord {
  readonly event: ItemPresenterUse;
  readonly fx: ItemFx;
  /** Victims (and shots) already reported, so a repeated delivery does not replay the hit. */
  readonly victims: Set<string>;
  placed?: Vec3;
  /** The barricade's sequence once its point is known. */
  barricade?: { active: FxVisual; end: FxVisual; endSound?: SoundRequest };
  /** A dropped mine went off: later hits of the same use only show on their victim. */
  spent?: boolean;
}

/** A kart effect of the contract, or scanning's radar / siren lights (no physics kind). */
type SlotKind = ItemKartEffect | "scan" | "siren";

interface KartSlot {
  readonly playerId: string;
  readonly kind: SlotKind;
  startMs: number;
  endMs: number;
  /** The model the slot shows (a refreshed start with another model replaces it). */
  model?: FxModel;
  /** The visual for the effect's duration. */
  main?: FxVisual;
  /** A tail after the effect (ufo PostAffect, devil Escape, the infected bombs' lock). */
  after?: { model: FxModel; sound?: FxSound; visual?: FxVisual; request?: SoundRequest };
  /** The item whose look the slot shows (the trap's item gives its escape shield). */
  cause?: ItemFx;
  /** invisible: whether this client may see the kart. */
  visibleToMe?: boolean;
}

/** The last hit on each racer: a kart effect starting close to it takes its item's look. */
interface HitCause { fx: ItemFx; atMs: number; variant?: ItemHitVariant }

const useGroup = (useId: number) => `use:${useId}`;
const targetGroup = (useId: number, playerId: string) => `use:${useId}:${playerId}`;
const shotGroup = (useId: number, playerId: string, shot: number) => `use:${useId}:${playerId}:shot:${shot}`;
const slotKey = (playerId: string, kind: SlotKind) => `kart:${playerId}:${kind}`;

/** The default look of each kart effect: the classic item that causes it (appendix B). */
const DEFAULT_SOURCE: Partial<Record<ItemKartEffect, number>> = {
  trap: 9, slow: 3, shrink: 111, reverse: 2, pull: 5, shield: 10, angel: 11, emp: 12,
  invincible: 36, timeBomb: 13,
};

/** Effects of the user's own items: their look follows the user's latest use. */
const OWN_EFFECTS: ReadonlySet<ItemKartEffect> = new Set(["shield", "angel", "emp", "invincible", "invisible"]);

interface KartMotionEntry {
  readonly kind: ItemKartEffect;
  readonly motion: KartMotion;
  readonly startMs: number;
  endMs: number;
  /** Where the motion left the kart when it ended (the fall starts from it). */
  landing?: Matrix4;
}

export class ItemRacePresenterImpl<Archive> implements ItemRacePresenter {
  readonly visuals: FxVisual[] = [];
  readonly requests: SoundRequest[] = [];
  readonly loops = new Map<string, { playing: FxPlayingSound; anchor: SoundAnchor }>();
  readonly uses = new Map<number, UseRecord>();
  readonly slots = new Map<string, KartSlot>();
  /** The planned end of slots `endKartEffect` cut short, by slot key, until the slot starts again. */
  readonly endedSlots = new Map<string, number>();
  /** The last item that hit each racer (the next kart effect takes its look). */
  readonly causes = new Map<string, HitCause>();
  /** Balloons popping: hidden from the hit until Reborn. */
  readonly balloonPops = new Map<string, { fromMs: number; untilMs: number }>();
  /** Item hits moving karts (oldest first), by racer. */
  readonly kartMotions = new Map<string, KartMotionEntry[]>();
  readonly placement: Placement = {
    position: vec(), right: vec(), up: vec(), forward: vec(), scale: 1,
  };
  readonly listener = { position: vec(), right: vec(1, 0, 0), known: false };
  nowMs = 0;
  localPlayerId = "";
  frame: ItemPresenterFrame | undefined;
  disposed = false;

  constructor(
    readonly plan: ItemFxPlan,
    readonly models: FxModelBank<Archive>,
    readonly audio: FxSoundBank<Archive>,
    /** The `firedkart` tracks of the plan's motion models, by path. */
    readonly motionTracks: ReadonlyMap<string, KartMotionTrack> = new Map(),
  ) {}

  get object(): Object3D { return this.models.root; }

  // ---- events --------------------------------------------------------------

  used(event: ItemPresenterUse): void {
    if (this.disposed || this.uses.has(event.useId)) return;
    const fx = this.plan.items.get(event.itemId);
    if (!fx) return;
    const record: UseRecord = { event: { ...event, targets: [...event.targets] }, fx, victims: new Set() };
    this.uses.set(event.useId, record);
    const s = event.startMs;
    const user = event.userId;
    const group = useGroup(event.useId);
    switch (fx.kind) {
      case "projectile": return this.launchProjectiles(record, fx);
      case "ufo": return this.launchUfo(record, fx);
      case "beam": return this.launchBeam(record, fx);
      case "magnet":
        this.slot(user, "pull", s, fx.field.lifeMs, fx.field, {
          target: event.targets[0], fromUse: true, cause: fx,
        });
        return;
      case "throw": return this.launchThrow(record, fx);
      case "timeBomb": return this.launchTimeBomb(record, fx);
      case "barricade":
        this.show(group, fx.launch, s, s, s + fx.launch.lifeMs, onKart(user));
        this.play(fx.launchSound, s, { kind: "kart", playerId: user }, group);
        if (event.point) this.placeBarricade(record, fx, event.point);
        return;
      case "cloud": return this.launchCloud(record, fx);
      case "curse": return this.launchCurse(record, fx);
      case "lock": return this.launchLock(record, fx);
      case "aura": return this.launchAura(record, fx);
      case "none":
        return;
    }
  }

  placed(event: ItemPresenterPlacement): void {
    if (this.disposed) return;
    const record = this.uses.get(event.useId);
    if (!record) return;
    record.placed = { ...event.point };
    if (record.fx.kind === "barricade") this.placeBarricade(record, record.fx, record.placed);
  }

  hit(event: ItemPresenterHit): void {
    if (this.disposed) return;
    const record = event.useId !== 0 ? this.uses.get(event.useId) : undefined;
    const fx = record?.fx ?? this.plan.items.get(event.itemId);
    if (!fx) return;
    const victim = event.victimId;
    const shot = event.shot === 0 || event.shot === 1 ? event.shot : undefined;
    const report = shot === undefined ? victim : `${victim}#${shot}`;
    if (record?.victims.has(report)) return;
    record?.victims.add(report);
    const at = event.atMs;
    const anchor: SoundAnchor = { kind: "kart", playerId: victim };
    const where = event.position ? { ...event.position } : undefined;
    // A projectile (or the UFO's approach) at this victim is spent by the hit;
    // a blocked attack also drops its warnings, strikes and its attached bomb.
    if (record) {
      if (event.result === "blocked" || event.by === "eat") this.cancel(targetGroup(event.useId, victim));
      else if (fx.kind === "projectile") this.cancel(shot === undefined
        ? `${targetGroup(event.useId, victim)}:shot` : shotGroup(event.useId, victim, shot));
      else if (fx.kind === "ufo" || fx.kind === "beam") this.cancel(targetGroup(event.useId, victim));
    }
    if (event.by === "eat") {
      // Eaten by an equipment passive: Eat (바나나먹기) on the eater, EatBonus's lucci.
      this.show(`hit:${victim}`, fx.eat?.model, at, at, at + (fx.eat?.model?.lifeMs ?? 0), onKart(victim));
      this.play(fx.eat?.sound, at, anchor);
      if (event.variant === "bonus")
        this.show(`hit:${victim}`, fx.eat?.bonus, at, at, at + (fx.eat?.bonus?.lifeMs ?? 0), onKart(victim));
      if (record && fx.kind === "throw" && fx.consumed) this.spend(record);
      return;
    }
    if (event.result === "blocked") {
      // A mine that met a shield went off all the same.
      if (record && fx.kind === "throw" && fx.consumed && event.by !== "escape") this.spend(record);
      if (event.by === undefined || event.by === "escape") return;
      const look = event.by === "kart" || event.by === "pet" ? fx.special
        : (event.by === "shield" ? this.invincibleDefend(victim, at) : undefined) ?? fx.block;
      this.show(`hit:${victim}`, look.model, at, at, at + (look.model?.lifeMs ?? 0), onKart(victim));
      this.play(look.sound, at, anchor);
      return;
    }
    const small = event.variant === "small" || event.variant === "balloon" ? fx.small : undefined;
    switch (fx.kind) {
      case "projectile": {
        const impact = small ?? { model: fx.impact, sound: fx.impactSound };
        this.show(`hit:${victim}`, impact.model, at, at, at + (impact.model?.lifeMs ?? 0), onKart(victim));
        this.play(impact.sound, at, anchor);
        if (record && fx.field && victim === record.event.targets[0]) this.lockdownField(record, fx, victim, at);
        break;
      }
      case "throw": {
        this.play(fx.hitSound, at, anchor);
        this.show(`hit:${victim}`, fx.impact, at, at, at + (fx.impact?.lifeMs ?? 0), onKart(victim));
        this.play(fx.impactSound, at, anchor);
        const point = record?.placed ?? record?.event.point ?? where;
        if (!record?.spent) {
          const object = point ? atPoint(() => point, () => undefined) : onKart(victim);
          this.show(`hit:${victim}`, fx.itemImpact, at, at, at + (fx.itemImpact?.lifeMs ?? 0), object);
          this.show(`hit:${victim}`, fx.burst, at, at, at + (fx.burst?.lifeMs ?? 0), object);
          this.play(fx.burstSound, at, point ? { kind: "point", position: point } : anchor);
        }
        if (record && fx.consumed) this.spend(record);
        break;
      }
      case "timeBomb":
        this.play(fx.hitSound, at, anchor);
        break;
      case "barricade":
        if (record?.barricade && fx.breaks) this.breakBarricade(record.barricade, fx, at);
        break;
      case "aura":
        // A siren knocked this kart aside.
        this.play(fx.hitSound, at, anchor);
        break;
      default:
        break;
    }
    if (event.variant === "bonus" && fx.bonus) {
      this.show(`hit:${victim}`, fx.bonus.model, at, at, at + (fx.bonus.model?.lifeMs ?? 0), onKart(victim));
      this.play(fx.bonus.sound, at, anchor);
    }
    if (event.variant === "balloon") this.popBalloon(victim, at);
    this.causes.set(victim, { fx, atMs: at, variant: event.variant });
  }

  /** A running gold or protect shield's own block look on this racer at `at`. */
  invincibleDefend(playerId: string, at: number): BlockFx | undefined {
    const slot = this.slots.get(slotKey(playerId, "invincible"));
    if (!slot || at < slot.startMs || at >= slot.endMs || slot.cause?.kind !== "aura") return undefined;
    return slot.cause.defend;
  }

  removed(useId: number): void {
    if (this.disposed) return;
    const record = this.uses.get(useId);
    // A broken barricade plays its StateEnd (from the hit, or now) instead of vanishing.
    if (record?.fx.kind === "barricade" && record.barricade) {
      this.breakBarricade(record.barricade, record.fx, this.nowMs);
      return;
    }
    this.cancel(useGroup(useId));
  }

  kartEffect(playerId: string, kind: ItemKartEffect, startMs: number, durationMs: number,
    options: ItemKartEffectOptions = {}): void {
    if (this.disposed) return;
    const end = startMs + Math.max(0, durationMs);
    const { fx, visual } = this.lookOf(playerId, kind, startMs, options.itemId);
    this.startKartMotion(playerId, kind, fx, startMs, end);
    if (kind === "invisible") {
      this.slot(playerId, kind, startMs, end - startMs, undefined, { cause: fx });
      const slot = this.slots.get(slotKey(playerId, kind));
      if (slot) slot.visibleToMe = options.visibleToMe === true;
      return;
    }
    if (kind === "escapeShield") {
      // The trap that just ended names its blue shield (none for the snow bombs).
      const trap = this.slots.get(slotKey(playerId, "trap"));
      const look = trap?.cause?.kart.escapeShield ??
        (trap?.cause ? undefined : visual) ?? { model: this.plan.shared.escapeShield };
      this.slot(playerId, kind, startMs, end - startMs, look.model, { cause: trap?.cause });
      return;
    }
    if (!visual) return;
    const fallbackTrap = kind === "trap" && !visual.model ? this.plan.shared.trap : undefined;
    this.slot(playerId, kind, startMs, end - startMs, visual.model ?? fallbackTrap, {
      sound: visual.sound, after: visual.after, afterSound: visual.afterSound,
      pulse: visual.pulse || kind === "timeBomb", target: options.target, cause: fx,
    });
  }

  endKartEffect(playerId: string, kind: ItemKartEffect, options: { tail?: boolean } = {}): void {
    if (this.disposed) return;
    const slot = this.slots.get(slotKey(playerId, kind));
    if (!slot) return;
    if (options.tail === false && slot.after) {
      // The EMP's own fired01 blows the UFO away: its ordinary leave (fired02) does not play too.
      if (slot.after.visual) this.finish(slot.after.visual);
      if (slot.after.request) this.dropRequest(slot.after.request);
      slot.after = undefined;
    }
    const now = this.nowMs;
    if (slot.endMs <= now) return;
    this.endedSlots.set(slotKey(playerId, kind), slot.endMs);
    this.retimeSlot(slot, Math.max(now, slot.startMs));
    this.endKartMotion(playerId, kind, now);
  }

  /**
   * The hit's kart motion starts with its kart effect, on the effect model's
   * clock: the item's own model for the effect (a small or balloon missile
   * hit: its AffectSmall), else the common water bubble for a trap.
   */
  startKartMotion(playerId: string, kind: ItemKartEffect, fx: ItemFx | undefined, startMs: number,
    endMs: number): void {
    const cause = this.causes.get(playerId);
    const small = kind === "launch" && !!cause && Math.abs(startMs - cause.atMs) <= ITEM_FX_TUNING.trapCauseWindowMs &&
      (cause.variant === "small" || cause.variant === "balloon");
    const key = (small ? "small" : kind) as KartMotionKey;
    const path = fx?.motions?.[key] ?? (kind === "trap" ? this.plan.shared.trap.path : undefined);
    const track = path ? this.motionTracks.get(path) : undefined;
    if (!track || !(endMs > startMs)) return;
    const list = this.kartMotions.get(playerId) ?? [];
    list.push({ kind, motion: new KartMotion(track, startMs), startMs, endMs });
    this.kartMotions.set(playerId, list);
  }

  /** An effect cut short (an escape, a reset): its kart comes down from where it is. */
  endKartMotion(playerId: string, kind: ItemKartEffect, nowMs: number): void {
    const list = this.kartMotions.get(playerId);
    if (!list) return;
    for (const entry of list) {
      if (entry.kind !== kind || entry.endMs <= nowMs) continue;
      entry.endMs = Math.max(nowMs, entry.startMs);
      entry.landing = undefined;
    }
  }

  kartMotion(playerId: string, nowMs: number): Matrix4 | undefined {
    if (this.disposed) return undefined;
    const list = this.kartMotions.get(playerId);
    if (!list) return undefined;
    // The newest hit that has started moves the kart; a finished one falls back, then goes.
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const entry = list[index]!;
      if (nowMs < entry.startMs) continue;
      if (nowMs < entry.endMs) return rigidMotion(entry.motion.at(nowMs));
      entry.landing ??= rigidMotion(entry.motion.at(entry.endMs));
      const falling = atRest(entry.landing) ? undefined : fallingMotion(entry.landing, nowMs - entry.endMs);
      if (falling) return falling;
      list.splice(index, 1);
    }
    if (!list.length) this.kartMotions.delete(playerId);
    return undefined;
  }

  kartPresentation(playerId: string, nowMs: number): ItemKartPresentationState | undefined {
    if (this.disposed) return undefined;
    const invisible = this.slots.get(slotKey(playerId, "invisible"));
    const hidden = invisible && invisible.startMs <= nowMs && nowMs < invisible.endMs;
    const pop = this.balloonPops.get(playerId);
    const popping = pop !== undefined && pop.fromMs <= nowMs && nowMs < pop.untilMs;
    if (!hidden && !popping) return undefined;
    return {
      opacity: !hidden ? 1 : invisible.visibleToMe ? ITEM_FX_TUNING.ghostOpacity : 0,
      balloonVisible: !popping,
    };
  }

  startItemFlash(atMs: number): void {
    if (this.disposed) return;
    this.play(this.plan.shared.chargerSound, atMs, { kind: "screen" }, "startItem");
  }

  sound(itemId: number, stem: string,
    options: { position?: ItemPresenterVec3; key?: string; loop?: boolean } = {}): void {
    if (this.disposed) return;
    const path = this.plan.sound(itemId, stem);
    if (!path) return;
    if (options.key) this.stopSound(options.key);
    const anchor: SoundAnchor = options.position
      ? { kind: "point", position: { ...options.position } } : { kind: "screen" };
    this.requests.push({ path, atMs: this.nowMs, anchor, key: options.key, loop: options.loop });
    // Lazily decoded sounds (not part of the preloaded set) start once decoded.
    void this.audio.fetch(path);
  }

  stopSound(key: string): void {
    for (let index = this.requests.length - 1; index >= 0; index -= 1)
      if (this.requests[index]!.key === key) this.requests.splice(index, 1);
    const loop = this.loops.get(key);
    if (loop) {
      this.audio.stop(loop.playing);
      this.loops.delete(key);
    }
  }

  /**
   * The look of a kart effect on a racer: the named item's, else the item
   * that just hit it, else (the user's own effects) the item of its latest
   * use, else the classic item that causes this effect. Spin, launch,
   * barrier, hold and knockback have no default look (the hit, the physics or
   * the kart's crash effect already shows them).
   */
  lookOf(playerId: string, kind: ItemKartEffect, startMs: number, itemId?: number):
  { fx?: ItemFx; visual?: KartVisual } {
    const named = itemId !== undefined ? this.plan.items.get(itemId) : undefined;
    if (named) return { fx: named, visual: named.kart[kind] ?? this.defaultLook(kind) };
    const cause = this.causes.get(playerId);
    if (cause && Math.abs(startMs - cause.atMs) <= ITEM_FX_TUNING.trapCauseWindowMs) {
      const variant = cause.variant === "headband" ? cause.fx.headband?.[kind] : undefined;
      const visual = variant ?? cause.fx.kart[kind];
      if (visual) return { fx: cause.fx, visual };
    }
    if (OWN_EFFECTS.has(kind)) {
      const own = this.latestOwnUse(playerId, kind, startMs);
      if (own?.kart[kind]) return { fx: own, visual: own.kart[kind] };
    }
    return { visual: this.defaultLook(kind) };
  }

  defaultLook(kind: ItemKartEffect): KartVisual | undefined {
    if (kind === "invisible") return {};
    const source = DEFAULT_SOURCE[kind];
    const fx = source === undefined ? undefined : this.plan.items.get(source);
    if (kind === "timeBomb") {
      const bomb = fx?.kind === "timeBomb" ? fx : undefined;
      return bomb ? { model: bomb.carried, pulse: true } : undefined;
    }
    return fx?.kart[kind] ?? (kind === "trap" ? { model: this.plan.shared.trap } : undefined);
  }

  /** The user's (or, for angel, the covered racer's) latest use of an item with that effect. */
  latestOwnUse(playerId: string, kind: ItemKartEffect, startMs: number): ItemFx | undefined {
    let best: UseRecord | undefined;
    for (const record of this.uses.values()) {
      if (!record.fx.kart[kind]) continue;
      const mine = record.event.userId === playerId ||
        (kind === "angel" && record.event.targets.includes(playerId));
      if (!mine || record.event.startMs > startMs + ITEM_FX_TUNING.trapCauseWindowMs) continue;
      if (!best || record.event.startMs > best.event.startMs) best = record;
    }
    return best?.fx;
  }

  // ---- per item --------------------------------------------------------------

  launchProjectiles(record: UseRecord, fx: ProjectileFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    const shots = Math.max(1, Math.min(2, Math.trunc(event.count ?? 1)));
    this.show(useGroup(event.useId), fx.launch, s, s, s + (fx.launch?.lifeMs ?? 0), onKart(user));
    const lift = ITEM_FX_TUNING.projectileLiftM;
    for (let shot = 0; shot < shots; shot += 1) {
      const fired = s + shot * ITEM_FX_TUNING.secondShotDelayMs;
      this.play(fx.launchSound, fired, { kind: "kart", playerId: user }, useGroup(event.useId));
      if (event.targets.length === 0) {
        // Misfire: straight ahead at the item's speed for Use.life, then gone.
        let origin: Vec3 | undefined, forward: Vec3 | undefined;
        this.show(useGroup(event.useId), fx.flight, fired, fired, fired + fx.flight.lifeMs, (frame, now, out) => {
          if (!origin) {
            const pose = frame.pose(user);
            if (!pose) return false;
            origin = addScaled(vec(), pose.position, pose.up, lift);
            forward = { ...pose.forward };
          }
          addScaled(out.position, origin, forward!, fx.speed * Math.max(0, now - fired) / 1000);
          return pointAlong(out, forward!);
        });
        continue;
      }
      const eta = event.etaMs > 0 ? event.etaMs : fx.flight.lifeMs;
      for (const target of event.targets) {
        let origin: Vec3 | undefined;
        let goal: Vec3 | undefined;
        const tangent = vec();
        this.show(shotGroup(event.useId, target, shot), fx.flight, fired, fired,
          fired + eta + ITEM_FX_TUNING.projectileHoldMs, (frame, now, out) => {
            const targetPose = frame.pose(target);
            if (targetPose) goal = addScaled(goal ?? vec(), targetPose.position, targetPose.up, lift);
            if (!origin) {
              const pose = frame.pose(user);
              if (!pose) return false;
              origin = addScaled(vec(), pose.position, pose.up, lift);
            }
            if (!goal) return false;
            // Homing: re-aim at the target's current pose every frame, on a slight arc.
            const p = Math.min(1, Math.max(0, (now - fired) / eta));
            const height = fx.arcM * 4 * p * (1 - p);
            out.position.x = origin.x + (goal.x - origin.x) * p;
            out.position.y = origin.y + (goal.y - origin.y) * p + height;
            out.position.z = origin.z + (goal.z - origin.z) * p;
            addScaled(tangent, sub(goal, origin), WORLD_UP, fx.arcM * 4 * (1 - 2 * p));
            return pointAlong(out, tangent) || pointAlong(out, targetPose?.forward ?? vec(0, 0, 1));
          });
      }
    }
    if (fx.attach) for (const target of event.targets) this.attachBomb(record, fx, target);
  }

  /**
   * waterbombFly: on arrival it ticks on its target for CountDown (the time
   * bomb's balloon, faster toward the end), then bursts there for Active. A
   * blocked arrival cancels it with the target's group.
   */
  attachBomb(record: UseRecord, fx: ProjectileFx, target: string): void {
    const attach = fx.attach!;
    const { event } = record;
    const arrival = event.startMs + (event.etaMs > 0 ? event.etaMs : fx.flight.lifeMs);
    const blast = arrival + attach.countdownMs;
    const group = `${targetGroup(event.useId, target)}:attach`;
    this.show(group, attach.carried, arrival, arrival, blast,
      this.pulsing(target, arrival, () => blast));
    this.show(group, attach.burst, blast, blast, blast + (attach.burst?.lifeMs ?? 0), whereKartWas(target));
    this.play(attach.burstSound, blast, { kind: "kart", playerId: target }, group);
  }

  /** lockdown / block missile: CountDown on the target, then its field (SetEmp) where the target is. */
  lockdownField(record: UseRecord, fx: ProjectileFx, target: string, at: number): void {
    const field = fx.field!;
    const group = `${targetGroup(record.event.useId, target)}:field`;
    this.play(field.countdownSound, at, { kind: "kart", playerId: target }, group);
    const open = at + field.countdownMs;
    this.show(group, field.model, open, open, open + (field.model?.lifeMs ?? 0), whereKartWas(target));
    this.play(field.sound, open, { kind: "kart", playerId: target }, group);
  }

  launchUfo(record: UseRecord, fx: UfoFx): void {
    const { event } = record;
    const s = event.startMs;
    this.show(useGroup(event.useId), fx.depart, s, s, s + fx.depart.lifeMs, onKart(event.userId));
    this.play(fx.departSound, s, { kind: "kart", playerId: event.userId }, useGroup(event.useId));
    // Use (1500 ms) is the whole approach: fired00 descends over the victim from the use on,
    // ending at the hover height, with `affecting` (1501 ms) under it.
    for (const target of event.targets) {
      const group = targetGroup(event.useId, target);
      this.show(group, fx.approach, s, s, s + fx.approach.lifeMs, onKart(target));
      this.play(fx.arriveSound, s, { kind: "kart", playerId: target }, group);
    }
  }

  /** snowman, talisman: thrown from the user (Use firing), landing on the target at the ETA. */
  launchBeam(record: UseRecord, fx: BeamFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    const group = useGroup(event.useId);
    this.show(group, fx.depart, s, s, s + (fx.depart?.lifeMs ?? 0), onKart(user));
    this.play(fx.departSound, s, { kind: "kart", playerId: user }, group);
    const eta = event.etaMs > 0 ? event.etaMs : fx.approach?.lifeMs ?? fx.depart?.lifeMs ?? 0;
    for (const target of event.targets) {
      const approach = fx.approach;
      const span = Math.min(approach?.lifeMs ?? 0, eta);
      this.show(targetGroup(event.useId, target), approach, s + eta - (approach?.lifeMs ?? 0),
        s + eta - span, s + eta, onKart(target));
      this.play(fx.arriveSound, s + eta, { kind: "kart", playerId: target }, targetGroup(event.useId, target));
    }
  }

  launchThrow(record: UseRecord, fx: ThrowFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    const group = useGroup(event.useId);
    this.play(fx.launchSound, s, { kind: "kart", playerId: user }, group);
    let start: Vec3 | undefined;
    let fallback: Vec3 | undefined;
    let direction: Vec3 | undefined;
    const target = () => record.placed ?? event.point ?? fallback;
    const capture = (frame: ItemPresenterFrame) => {
      if (start) return true;
      const pose = frame.pose(user);
      if (!pose) return false;
      start = { ...pose.position };
      fallback = addScaled(vec(), pose.position, pose.forward, fx.fallbackDistanceM);
      direction = sub(target()!, start);
      if (!(length(direction) > 1e-3)) direction = { ...pose.forward };
      return true;
    };
    const land = s + fx.flight.lifeMs;
    // The model carries the toss height; the mount slides from the user to the point.
    this.show(group, fx.flight, s, s, land, (frame, now, out) => {
      if (!capture(frame)) return false;
      const p = Math.min(1, Math.max(0, (now - s) / fx.flight.lifeMs));
      const goal = target()!;
      out.position.x = start!.x + (goal.x - start!.x) * p;
      out.position.y = start!.y + (goal.y - start!.y) * p;
      out.position.z = start!.z + (goal.z - start!.z) * p;
      return faceAlong(out, direction!, WORLD_UP) || pointAlong(out, direction!);
    });
    this.show(`${group}:set`, fx.set, land, land, land + fx.set.lifeMs,
      atPoint(frame => capture(frame) ? target() : undefined, () => direction));
    this.play(fx.setSound, land, event.point ? { kind: "point", position: { ...event.point } }
      : { kind: "kart", playerId: user }, `${group}:set`);
  }

  /** A mine went off (or was eaten): the object leaves the track. */
  spend(record: UseRecord): void {
    record.spent = true;
    this.cancel(`${useGroup(record.event.useId)}:set`);
  }

  launchTimeBomb(record: UseRecord, fx: TimeBombFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    const group = useGroup(event.useId);
    this.play(fx.launchSound, s, { kind: "kart", playerId: user }, group);
    this.slot(user, "timeBomb", s, fx.carried.lifeMs, fx.carried, { pulse: true, fromUse: true, cause: fx });
    const blast = s + fx.carried.lifeMs;
    let fallback: Vec3 | undefined;
    // The user reports the blast point at the blast; until then it is where the user is.
    this.show(group, fx.burst, blast, blast, blast + fx.burst.lifeMs, atPoint(frame => {
      if (!record.placed && !fallback) {
        const pose = frame.pose(user);
        if (pose) fallback = { ...pose.position };
      }
      return record.placed ?? fallback;
    }, () => undefined));
    this.play(fx.burstSound, blast, { kind: "kart", playerId: user }, group);
  }

  placeBarricade(record: UseRecord, fx: BarricadeFx, point: Vec3): void {
    if (record.barricade) return;
    const { event } = record;
    const group = useGroup(event.useId);
    const rise = event.startMs + fx.launch.lifeMs;
    const stand = rise + fx.rise.lifeMs;
    const fall = stand + fx.active.lifeMs;
    const where = { ...point };
    const target = event.targets[0];
    let facing: Vec3 | undefined;
    // The wall stands across its target's road: facing the way the target drives.
    const face = (frame: ItemPresenterFrame) => {
      const pose = (target && frame.pose(target)) || frame.pose(event.userId);
      if (pose) facing ??= { ...pose.forward };
      return facing;
    };
    const placer = () => atPoint(() => where, face);
    this.show(group, fx.rise, rise, rise, stand, placer());
    this.play(fx.riseSound, rise, { kind: "point", position: where }, group);
    const active = this.show(group, fx.active, stand, stand, fall, placer());
    const end = this.show(group, fx.end, fall, fall, fall + fx.end.lifeMs, placer());
    const endSound = this.play(fx.endSound, fall, { kind: "point", position: where }, group);
    if (active && end) record.barricade = { active, end, endSound };
  }

  /** A kart ran into the barricade: it breaks now. */
  breakBarricade(barricade: NonNullable<UseRecord["barricade"]>, fx: BarricadeFx, at: number): void {
    const { active, end } = barricade;
    if (at < active.showMs || at >= active.endMs) return;
    active.endMs = at;
    end.anchorMs = at;
    end.showMs = at;
    end.endMs = at + fx.end.lifeMs;
    if (barricade.endSound) barricade.endSound.atMs = at;
  }

  launchCloud(record: UseRecord, fx: CloudFx): void {
    const { event } = record;
    const s = event.startMs;
    const group = useGroup(event.useId);
    this.show(group, fx.launch, s, s, s + (fx.launch?.lifeMs ?? 0), onKart(event.userId));
    if (!event.point) {
      this.play(fx.bornSound, s, { kind: "kart", playerId: event.userId }, group);
      return;
    }
    // It stands where its user was, across the road: facing the way the user drove.
    const where = { ...event.point };
    let facing: Vec3 | undefined;
    const face = (frame: ItemPresenterFrame) => {
      const pose = frame.pose(event.userId);
      if (pose) facing ??= { ...pose.forward };
      return facing;
    };
    const placer = () => atPoint(() => where, face);
    const stand = s + (fx.born?.lifeMs ?? 0);
    const remove = stand + (fx.stand?.lifeMs ?? 0);
    this.show(group, fx.born, s, s, stand, placer());
    this.play(fx.bornSound, s, { kind: "point", position: where }, group);
    this.show(group, fx.stand, stand, stand, remove, placer());
    this.show(group, fx.remove, remove, remove, remove + (fx.remove?.lifeMs ?? 0), placer());
    this.play(fx.removeSound, remove, { kind: "point", position: where }, group);
  }

  launchCurse(record: UseRecord, fx: CurseFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    this.show(useGroup(event.useId), fx.launch, s, s, s + fx.launch.lifeMs, onKart(user));
    this.play(fx.launchSound, s, { kind: "kart", playerId: user }, useGroup(event.useId));
    const warn = s + fx.launch.lifeMs;
    const strike = warn + fx.warning.lifeMs;
    for (const target of event.targets) {
      const group = targetGroup(event.useId, target);
      this.show(group, fx.warning, warn, warn, strike, onKart(target));
      this.play(fx.warningSound, warn, { kind: "kart", playerId: target }, group);
      if (fx.strike) {
        this.show(group, fx.strike, strike, strike, strike + fx.strike.lifeMs, onKart(target));
        this.play(fx.strikeSound, strike, { kind: "kart", playerId: target }, group);
      }
    }
  }

  launchLock(record: UseRecord, fx: LockFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    this.show(useGroup(event.useId), fx.launch, s, s, s + fx.launch.lifeMs, onKart(user));
    this.play(fx.launchSound, s, { kind: "kart", playerId: user }, useGroup(event.useId));
    const lock = s + fx.launch.lifeMs;
    for (const target of event.targets) {
      const group = targetGroup(event.useId, target);
      this.show(group, fx.affect, lock, lock, lock + fx.affect.lifeMs, onKart(target));
      this.play(fx.affectSound, lock, { kind: "kart", playerId: target }, group);
    }
  }

  /**
   * Self items: the use sound and intro on the user, then the model on the
   * covered karts from the Affect state on. EMP (only on racers it freed)
   * and invisibility (depends on who looks) wait for the controller's
   * `kartEffect`.
   */
  launchAura(record: UseRecord, fx: AuraFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    const group = useGroup(event.useId);
    this.play(fx.useSound, s, { kind: "kart", playerId: user }, group);
    this.show(group, fx.intro, s, s, s + (fx.intro?.lifeMs ?? 0), onKart(user));
    this.play(fx.introSound, s, { kind: "kart", playerId: user }, group);
    if (!fx.fromUse) return;
    const begin = s + fx.delayMs;
    const kind: SlotKind = fx.effect;
    const covered = fx.onTargets && event.targets.length > 0 ? event.targets : [user];
    for (const playerId of covered)
      this.slot(playerId, kind, begin, fx.durationMs, fx.model, { sound: fx.startSound, fromUse: true, cause: fx });
  }

  /** A balloon took a missile: it pops (hidden) for Affect, then Reborn pays lucci (루찌획득). */
  popBalloon(victim: string, at: number): void {
    const balloon = this.plan.shared.balloon;
    if (!balloon) return;
    const reborn = at + balloon.popMs;
    this.balloonPops.set(victim, { fromMs: at, untilMs: reborn });
    const anchor: SoundAnchor = { kind: "kart", playerId: victim };
    this.play(balloon.popSound, at, anchor);
    this.show(`hit:${victim}`, balloon.reborn, reborn, reborn, reborn + (balloon.reborn?.lifeMs ?? 0),
      onKart(victim));
    this.play(balloon.rebornSound, reborn, anchor);
    this.play(balloon.eatenSound, reborn, anchor);
  }

  // ---- kart effect slots -----------------------------------------------------

  /**
   * One visual per racer and effect: a second start while it runs only moves
   * its end (and does not replay its sound); one that names a `target` also
   * turns it toward that kart (the local racer's own magnet starts with the
   * physics pull, before the use's reply names its target), and a use that
   * shows another model (a protect shield after the default gold one)
   * replaces it. `fromUse` marks a start from a `used` event, which never
   * brings back the local racer's own effect that the controller already
   * ended.
   */
  slot(playerId: string, kind: SlotKind, startMs: number, durationMs: number,
    model: FxModel | undefined, options: { sound?: FxSound; after?: FxModel; afterSound?: FxSound;
      pulse?: boolean; target?: string; fromUse?: boolean; cause?: ItemFx } = {}): void {
    const key = slotKey(playerId, kind);
    const end = startMs + Math.max(0, durationMs);
    const existing = this.slots.get(key);
    const running = existing && existing.endMs > Math.max(startMs, this.nowMs) &&
      (existing.main ? !this.ended(existing.main) : existing.model === undefined);
    if (running && existing && (!options.fromUse || existing.model?.key === model?.key)) {
      this.retimeSlot(existing, Math.max(existing.endMs, end));
      if (options.target && existing.main) existing.main.place = this.facing(playerId, options.target);
      if (options.cause && !existing.cause) existing.cause = options.cause;
      return;
    }
    if (options.fromUse && !running && this.endedOwnEffect(key, playerId, startMs)) return;
    const begin = running && existing ? Math.min(existing.startMs, startMs) : startMs;
    if (existing) this.cancel(key);
    this.endedSlots.delete(key);
    const slot: KartSlot = { playerId, kind, startMs: begin, endMs: end, model, cause: options.cause };
    this.slots.set(key, slot);
    const placer = options.target ? this.facing(playerId, options.target)
      : options.pulse ? this.pulsing(playerId, begin, () => slot.endMs) : onKart(playerId);
    slot.main = this.show(key, model, begin, begin, end, placer);
    if (!running) this.play(options.sound, begin, { kind: "kart", playerId }, key);
    if (options.after || options.afterSound) {
      slot.after = { model: options.after!, sound: options.afterSound };
      this.scheduleAfter(slot, key);
    }
  }

  /**
   * The local racer's own effects start at the key press (`kartEffect`), a
   * round trip before the use's reply: when the controller has ended that one
   * since (a shield spent on a block, a pull that arrived, the end of the
   * race), a use starting inside its planned span is the same use.
   */
  endedOwnEffect(key: string, playerId: string, startMs: number): boolean {
    if (playerId !== this.localPlayerId) return false;
    const plannedEnd = this.endedSlots.get(key);
    return plannedEnd !== undefined && startMs < plannedEnd;
  }

  scheduleAfter(slot: KartSlot, key: string): void {
    const after = slot.after;
    if (!after) return;
    if (after.visual) this.finish(after.visual);
    if (after.request) this.dropRequest(after.request);
    after.visual = after.model ? this.show(key, after.model, slot.endMs, slot.endMs,
      slot.endMs + after.model.lifeMs, onKart(slot.playerId)) : undefined;
    after.request = this.play(after.sound, slot.endMs, { kind: "kart", playerId: slot.playerId }, key);
  }

  /** Move a slot's end (an early end, or a refreshed start), and its tail with it. */
  retimeSlot(slot: KartSlot, endMs: number): void {
    slot.endMs = endMs;
    if (slot.main) slot.main.endMs = endMs;
    if (slot.after) this.scheduleAfter(slot, slotKey(slot.playerId, slot.kind));
  }

  /** On the user's kart, its forward turned toward the target while the target has a pose. */
  facing(playerId: string, targetId: string): Placer {
    const direction = vec();
    return (frame, _now, out) => {
      const pose = frame.pose(playerId);
      if (!pose) return false;
      copy(out.position, pose.position);
      const target = frame.pose(targetId);
      if (target && faceAlong(out, copy(direction, sub(target.position, pose.position)), pose.up)) return true;
      poseBasis(out, pose);
      return true;
    };
  }

  /** The time bomb's balloon above the kart, ticking faster toward the blast ([还原]). */
  pulsing(playerId: string, startMs: number, endMs: () => number): Placer {
    const ride = onKart(playerId, ITEM_FX_TUNING.timeBombLiftM);
    let phase = 0;
    let last = startMs;
    return (frame, now, out) => {
      if (!ride(frame, now, out)) return false;
      const span = Math.max(1, endMs() - startMs);
      const progress = Math.min(1, Math.max(0, (now - startMs) / span));
      const period = ITEM_FX_TUNING.timeBombPulseStartMs +
        (ITEM_FX_TUNING.timeBombPulseEndMs - ITEM_FX_TUNING.timeBombPulseStartMs) * progress;
      phase += Math.max(0, now - last) / period;
      last = now;
      out.scale = 1 + ITEM_FX_TUNING.timeBombPulseScale * Math.max(0, Math.sin(phase * 2 * Math.PI));
      return true;
    };
  }

  // ---- visuals and sounds -----------------------------------------------------

  show(group: string, model: FxModel | undefined, anchorMs: number, showMs: number, endMs: number,
    place: Placer): FxVisual | undefined {
    const pool = this.models.pool(model);
    if (!pool || !(endMs > showMs)) return undefined;
    const visual: FxVisual = { group, pool, scale: model?.scale ?? 1, anchorMs, showMs, endMs, place };
    this.visuals.push(visual);
    // Copies for overlapping visuals are assembled now, before they are due.
    pool.reserve(this.demand(pool));
    return visual;
  }

  /** How many visuals of a pool are waiting or showing. */
  demand(pool: FxModelPool): number {
    let count = 0;
    for (const visual of this.visuals) if (visual.pool === pool) count += 1;
    return count;
  }

  play(path: FxSound | undefined, atMs: number, anchor: SoundAnchor, group?: string): SoundRequest | undefined {
    if (!path) return undefined;
    const request: SoundRequest = { path, atMs, anchor, group };
    this.requests.push(request);
    return request;
  }

  dropRequest(request: SoundRequest): void {
    const index = this.requests.indexOf(request);
    if (index >= 0) this.requests.splice(index, 1);
  }

  ended(visual: FxVisual): boolean {
    return !this.visuals.includes(visual) || visual.endMs <= this.nowMs;
  }

  /** End every visual and pending sound of a group (prefix `use:7` also ends `use:7:p2`). */
  cancel(group: string): void {
    const matches = (name: string | undefined) => name !== undefined &&
      (name === group || name.startsWith(`${group}:`));
    for (const visual of [...this.visuals]) if (matches(visual.group)) this.finish(visual);
    for (let index = this.requests.length - 1; index >= 0; index -= 1)
      if (matches(this.requests[index]!.group)) this.requests.splice(index, 1);
    for (const [key, slot] of this.slots) if (matches(key)) {
      this.slots.delete(key);
      if (slot.after?.visual) this.finish(slot.after.visual);
    }
  }

  finish(visual: FxVisual): void {
    visual.done = true;
    const index = this.visuals.indexOf(visual);
    if (index >= 0) this.visuals.splice(index, 1);
    if (visual.instance) visual.pool.release(visual.instance);
    visual.instance = undefined;
  }

  update(frame: ItemPresenterFrame): void {
    if (this.disposed) return;
    const now = frame.nowMs;
    this.nowMs = now;
    this.frame = frame;
    this.localPlayerId = frame.localPlayerId;
    this.readListener(frame.camera);
    const out = this.placement;
    for (const visual of [...this.visuals]) {
      // Taken over by an earlier visual of this pass (steal): it must not take a copy again.
      if (visual.done) continue;
      if (now >= visual.endMs) {
        this.finish(visual);
        continue;
      }
      if (now < visual.showMs) continue;
      if (!visual.instance) {
        visual.instance = visual.pool.acquire() ?? this.steal(visual);
        if (!visual.instance) {
          visual.pool.reserve(this.demand(visual.pool));
          continue;
        }
        // Late starts run part-way into the animation; the assembler's clock is u32.
        const anchor = Math.max(1, Math.trunc(visual.anchorMs));
        visual.instance.scene.reset(anchor);
        visual.instance.scene.playControllers?.(anchor, 0);
      }
      out.scale = 1;
      const mount = visual.instance.mount;
      if (!visual.place(frame, now, out)) {
        mount.visible = false;
        continue;
      }
      const { position: p, right: r, up: u, forward: f } = out;
      const k = out.scale * visual.scale;
      mount.matrix.set(
        r.x * k, u.x * k, f.x * k, p.x,
        r.y * k, u.y * k, f.y * k, p.y,
        r.z * k, u.z * k, f.z * k, p.z,
        0, 0, 0, 1,
      );
      // The scene's update refreshes its parents' world matrices (this mount included).
      mount.matrixWorldNeedsUpdate = true;
      mount.visible = true;
      visual.instance.scene.update(now, frame.camera, frame.width, frame.height);
    }
    this.playDue(frame, now);
    this.steerLoops(frame);
    for (const [useId, record] of this.uses)
      if (now - record.event.startMs > ITEM_FX_TUNING.useLifetimeMs) this.uses.delete(useId);
    for (const [key, slot] of this.slots)
      if (slot.endMs <= now && (!slot.after?.visual || this.ended(slot.after.visual)) &&
        !(slot.kind === "trap" && now - slot.endMs < ITEM_FX_TUNING.trapCauseWindowMs)) this.slots.delete(key);
    for (const [key, plannedEnd] of this.endedSlots)
      if (now - plannedEnd > ITEM_FX_TUNING.useLifetimeMs) this.endedSlots.delete(key);
    for (const [playerId, pop] of this.balloonPops) if (pop.untilMs <= now) this.balloonPops.delete(playerId);
  }

  /**
   * At the model cap: take the copy of the visual of that model that ends
   * first. A placed object (a banana still live on the track) is never taken
   * over; the newcomer waits for a free copy.
   */
  steal(visual: FxVisual): FxInstance | undefined {
    if (!visual.pool.full || visual.pool.model.placed) return undefined;
    let victim: FxVisual | undefined;
    for (const other of this.visuals)
      if (other !== visual && other.pool === visual.pool && other.instance &&
        (!victim || other.endMs < victim.endMs)) victim = other;
    if (!victim?.instance) return undefined;
    const instance = victim.instance;
    victim.instance = undefined;
    this.finish(victim);
    instance.busy = true;
    return instance;
  }

  readListener(camera: Camera | undefined): void {
    const elements = (camera as { matrixWorld?: { elements: ArrayLike<number> } } | undefined)
      ?.matrixWorld?.elements;
    if (!elements) return;
    this.listener.position.x = elements[12]!;
    this.listener.position.y = elements[13]!;
    this.listener.position.z = elements[14]!;
    this.listener.right.x = elements[0]!;
    this.listener.right.y = elements[1]!;
    this.listener.right.z = elements[2]!;
    normalize(this.listener.right);
    this.listener.known = true;
  }

  /** Volume and pan of a sound at its anchor; undefined to skip it. */
  spatial(frame: ItemPresenterFrame, anchor: SoundAnchor): { volume: number; pan: number } | undefined {
    if (anchor.kind === "screen") return { volume: 1, pan: 0 };
    if (anchor.kind === "kart") {
      if (anchor.playerId === frame.localPlayerId) return { volume: 1, pan: 0 };
      if (anchor.onlyLocal) return undefined;
    }
    const position = anchor.kind === "point" ? anchor.position : frame.pose(anchor.playerId)?.position;
    if (!position) return undefined;
    if (!this.listener.known) return { volume: 1, pan: 0 };
    const delta = sub(position, this.listener.position);
    const distance = length(delta);
    const { soundNearM: near, soundFarM: far, soundPan } = ITEM_FX_TUNING;
    const volume = distance <= near ? 1 : distance >= far ? 0 : 1 - (distance - near) / (far - near);
    const pan = distance > 0 ? Math.max(-1, Math.min(1, dot(this.listener.right, delta) / distance)) * soundPan : 0;
    return { volume, pan };
  }

  playDue(frame: ItemPresenterFrame, now: number): void {
    for (let index = 0; index < this.requests.length;) {
      const request = this.requests[index]!;
      if (request.atMs > now) {
        index += 1;
        continue;
      }
      this.requests.splice(index, 1);
      if (now - request.atMs > ITEM_FX_TUNING.soundLateMs) continue;
      const spatial = this.spatial(frame, request.anchor);
      if (!spatial || (spatial.volume <= 0 && !request.loop)) continue;
      const playing = this.audio.play(request.path, spatial.volume, spatial.pan, request.loop === true);
      if (!playing && this.audio.decoding(request.path)) {
        // Still decoding: try again next frame (a loop never becomes late).
        this.requests.splice(index, 0, request.loop ? { ...request, atMs: now } : request);
        index += 1;
        continue;
      }
      if (playing && request.key && request.loop) {
        playing.key = request.key;
        this.loops.set(request.key, { playing, anchor: request.anchor });
      }
    }
  }

  steerLoops(frame: ItemPresenterFrame): void {
    for (const [key, loop] of this.loops) {
      if (!this.audio.playing.has(loop.playing)) {
        this.loops.delete(key);
        continue;
      }
      const spatial = this.spatial(frame, loop.anchor) ?? { volume: 0, pan: 0 };
      this.audio.steer(loop.playing, spatial.volume, spatial.pan);
    }
  }

  reset(): void {
    for (const visual of [...this.visuals]) this.finish(visual);
    this.visuals.length = 0;
    this.requests.length = 0;
    this.loops.clear();
    this.audio.stopAll();
    this.uses.clear();
    this.slots.clear();
    this.endedSlots.clear();
    this.causes.clear();
    this.balloonPops.clear();
    this.kartMotions.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.audio.dispose();
    this.models.dispose();
  }
}

/** `item/balloon/item.bml`: the balloon accessory's states (its pop when it takes a missile). */
export const BALLOON_ITEM_BML = "item/balloon/item.bml";

async function loadOptionalBml<Archive>(archive: Archive, path: string,
  ops: ItemFxOps<Archive>): Promise<ItemBml | undefined> {
  try {
    const bytes = await ops.originalAsset(archive, path).bytes();
    return bytes instanceof Uint8Array ? decodeItemBml(bytes) : undefined;
  } catch (error) {
    console.warn(`道具表现：${path} 未载入，气球爆开只播放导弹的小爆炸。`, error);
    return undefined;
  }
}

/**
 * Build the presenter of an item race: decode every model and sound of the
 * item set and assemble one copy of each model, so the first use of an item
 * has no hitch. `context` may be omitted to present silently.
 */
/** The `firedkart` tracks of the motion models (a model that fails to load moves no kart). */
async function loadKartMotions<Archive>(archive: Archive, paths: readonly string[], ops: ItemFxOps<Archive>):
  Promise<Map<string, KartMotionTrack>> {
  const tracks = new Map<string, KartMotionTrack>();
  await Promise.all(paths.map(async path => {
    try {
      const track = kartMotionTrack(path, ops.decodeModel(await ops.originalAsset(archive, path).bytes()) as never);
      if (track) tracks.set(path, track);
    } catch (error) {
      console.warn(`道具车身动作 ${path} 未载入`, error);
    }
  }));
  return tracks;
}

export async function loadItemRacePresenter<Archive>(
  archive: Archive,
  catalog: ItemCatalog,
  environment: unknown,
  stageBinding: unknown,
  context: FxAudioContext | undefined,
  ops: ItemFxOps<Archive>,
): Promise<ItemRacePresenterImpl<Archive>> {
  const balloon = await loadOptionalBml(archive, BALLOON_ITEM_BML, ops);
  const plan = buildItemFxPlan(catalog, { balloon });
  const models = new FxModelBank(archive, environment, stageBinding, ops);
  const audio = new FxSoundBank(archive, context, ops);
  try {
    const [, , motions] = await Promise.all([models.load(plan.models), audio.load(plan.sounds),
      loadKartMotions(archive, plan.motionPaths, ops)]);
    return new ItemRacePresenterImpl(plan, models, audio, motions);
  } catch (error) {
    audio.dispose();
    models.dispose();
    throw error;
  }
}
