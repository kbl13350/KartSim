import type { Camera, Object3D } from "three";
import type { ItemCatalog } from "./item-catalog";
import {
  FxModelBank, FxSoundBank, type FxAudioContext, type FxInstance, type FxModelPool,
  type FxPlayingSound, type ItemFxOps,
} from "./item-fx-assets";
import {
  ITEM_FX_TUNING, buildItemFxPlan, type BarricadeFx, type CloudFx, type CurseFx, type FxModel,
  type FxSound, type ItemFx, type ItemFxPlan, type LockFx, type ProjectileFx, type ThrowFx,
  type TimeBombFx, type UfoFx,
} from "./item-fx-plan";

/**
 * The item race presenter (道具赛表现层, ITEM_MODE.md §7): projectiles, thrown
 * and placed objects, effects on the karts and item sounds, for the local
 * kart and remote karts alike. The race controller calls the event methods;
 * the race presenter calls `update` every frame after the track render
 * update. Coordinates are three.js world space (y-up, the space of the
 * physics `body.position` and the cube field); times are local milliseconds
 * on the race presenter clock (`toLocalTick` results and `nowMs`).
 *
 * Which state's model and sound play when comes from item-fx-plan.ts. Every
 * event is idempotent per visual: a kart effect started from `used` (shield,
 * angel, emp, timeBomb, magnet) and again from `kartEffect` keeps one visual,
 * and the local racer's own effect that `endKartEffect` already ended (a
 * shield spent on a block before the use's reply) is not brought back by the
 * reply's `used`. Visuals that should already be running when an event arrives late start
 * part-way through their animation; sounds more than `soundLateMs` late are
 * dropped.
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

export type ItemKartEffect = "trap" | "spin" | "launch" | "reverse" | "slow" | "shrink" |
  "barrier" | "pull" | "shield" | "angel" | "emp" | "escapeShield" | "timeBomb";

export interface ItemPresenterUse {
  useId: number;
  itemId: number;
  userId: string;
  targets: readonly string[];
  startMs: number;
  etaMs: number;
  point?: ItemPresenterVec3;
}

export interface ItemPresenterPlacement {
  useId: number;
  itemId: number;
  userId: string;
  point: ItemPresenterVec3;
  /** The use's start (its timeline origin). */
  startMs: number;
}

export interface ItemPresenterHit {
  useId: number;
  itemId: number;
  victimId: string;
  userId?: string;
  result: "hit" | "blocked";
  by?: string;
  atMs: number;
  position?: ItemPresenterVec3;
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
   * `target` (pull only) is the racer the magnet pulls toward: its field faces
   * that kart. Without it the field faces the kart's nose until a `used` of the
   * magnet names its target.
   */
  kartEffect(playerId: string, kind: ItemKartEffect, startMs: number, durationMs: number,
    options?: { target?: string }): void;
  endKartEffect(playerId: string, kind: ItemKartEffect): void;
  sound(itemId: number, stem: string,
    options?: { position?: ItemPresenterVec3; key?: string; loop?: boolean }): void;
  stopSound(key: string): void;
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

interface FxVisual {
  readonly group: string;
  readonly pool: FxModelPool;
  /** The animation's time zero (reset time of the model's controllers). */
  anchorMs: number;
  showMs: number;
  endMs: number;
  /** Replaced when a later start of a kart effect knows more (the magnet's target). */
  place: Placer;
  instance?: FxInstance;
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
  /** Victims already reported, so a repeated delivery does not replay the hit. */
  readonly victims: Set<string>;
  placed?: Vec3;
  /** The barricade's sequence once its point is known. */
  barricade?: { active: FxVisual; end: FxVisual; endSound?: SoundRequest };
}

/** A kart effect of the contract, or scanning's radar (no physics kind). */
type SlotKind = ItemKartEffect | "scan";

interface KartSlot {
  readonly playerId: string;
  readonly kind: SlotKind;
  startMs: number;
  endMs: number;
  /** The visual for the effect's duration. */
  main?: FxVisual;
  /** A tail after the effect (ufo PostAffect, devil Escape). */
  after?: { model: FxModel; sound?: FxSound; visual?: FxVisual; request?: SoundRequest };
}

const useGroup = (useId: number) => `use:${useId}`;
const targetGroup = (useId: number, playerId: string) => `use:${useId}:${playerId}`;
const slotKey = (playerId: string, kind: SlotKind) => `kart:${playerId}:${kind}`;

/** Effects whose visual the hit already shows, or physics/the kart's crash effect does. */
const NO_KART_VISUAL: ReadonlySet<ItemKartEffect> = new Set(["spin", "launch", "barrier"]);

export class ItemRacePresenterImpl<Archive> implements ItemRacePresenter {
  readonly visuals: FxVisual[] = [];
  readonly requests: SoundRequest[] = [];
  readonly loops = new Map<string, { playing: FxPlayingSound; anchor: SoundAnchor }>();
  readonly uses = new Map<number, UseRecord>();
  readonly slots = new Map<string, KartSlot>();
  /** The planned span of slots `endKartEffect` cut short, by slot key, until the slot starts again. */
  readonly endedSlots = new Map<string, { startMs: number; endMs: number }>();
  /** The last item that hit each racer (the trap bubble follows it). */
  readonly trapCause = new Map<string, { fx: ItemFx; atMs: number }>();
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
      case "magnet":
        this.slot(user, "pull", s, fx.field.lifeMs, fx.field, {
          target: event.targets[0], fromUse: true,
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
      case "aura": {
        this.play(fx.useSound, s, { kind: "kart", playerId: user }, group);
        const covered = fx.onTargets && event.targets.length > 0 ? event.targets : [user];
        for (const playerId of covered)
          this.slot(playerId, fx.effect, s, fx.durationMs, fx.model, { sound: fx.startSound, fromUse: true });
        return;
      }
      case "hazard":
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
    if (record?.victims.has(victim)) return;
    record?.victims.add(victim);
    const at = event.atMs;
    const anchor: SoundAnchor = { kind: "kart", playerId: victim };
    // A projectile (or the UFO's approach) at this victim is spent by the hit;
    // a blocked attack also drops its warnings and strikes on the victim.
    if (record && (event.result === "blocked" || fx.kind === "projectile" || fx.kind === "ufo"))
      this.cancel(targetGroup(event.useId, victim));
    if (event.result === "blocked") {
      if (event.by === undefined || event.by === "escape") return;
      this.show(`hit:${victim}`, fx.block.model, at, at, at + (fx.block.model?.lifeMs ?? 0), onKart(victim));
      this.play(fx.block.sound, at, anchor);
      return;
    }
    switch (fx.kind) {
      case "projectile":
        this.show(`hit:${victim}`, fx.impact, at, at, at + (fx.impact?.lifeMs ?? 0), onKart(victim));
        this.play(fx.impactSound, at, anchor);
        break;
      case "ufo":
        this.play(fx.arriveSound, at, anchor);
        break;
      case "throw":
      case "timeBomb":
        this.play(fx.hitSound, at, anchor);
        break;
      case "barricade":
        if (record?.barricade) this.breakBarricade(record.barricade, fx, at);
        break;
      case "hazard": {
        this.show(`hit:${victim}`, fx.impact, at, at, at + (fx.impact?.lifeMs ?? 0), onKart(victim));
        this.play(fx.impactSound, at, anchor);
        const where = event.position ? { ...event.position } : undefined;
        const burst = where ? atPoint(() => where, () => undefined) : onKart(victim);
        this.show(`hit:${victim}`, fx.burst, at, at, at + (fx.burst?.lifeMs ?? 0), burst);
        this.play(fx.burstSound, at, where ? { kind: "point", position: where } : anchor);
        this.play(fx.hitSound, at, anchor);
        break;
      }
      default:
        break;
    }
    this.trapCause.set(victim, { fx, atMs: at });
  }

  removed(useId: number): void {
    if (this.disposed) return;
    this.cancel(useGroup(useId));
  }

  kartEffect(playerId: string, kind: ItemKartEffect, startMs: number, durationMs: number,
    options: { target?: string } = {}): void {
    if (this.disposed || NO_KART_VISUAL.has(kind)) return;
    const end = startMs + Math.max(0, durationMs);
    const item = (name: string) => [...this.plan.items.values()].find(fx => fx.name === name);
    switch (kind) {
      case "trap": {
        const cause = this.trapCause.get(playerId);
        const recent = cause && Math.abs(startMs - cause.atMs) <= ITEM_FX_TUNING.trapCauseWindowMs;
        const bubble = (recent && "trap" in cause.fx ? cause.fx.trap : undefined) ?? this.plan.shared.trap;
        this.slot(playerId, kind, startMs, end - startMs, bubble);
        return;
      }
      case "escapeShield":
        this.slot(playerId, kind, startMs, end - startMs, this.plan.shared.escapeShield);
        return;
      case "slow": {
        const ufo = item("ufo") as UfoFx | undefined;
        if (ufo) this.slot(playerId, kind, startMs, end - startMs, ufo.hover, { after: ufo.leave });
        return;
      }
      case "shrink": {
        const thunder = item("thunderbolt") as CurseFx | undefined;
        if (thunder) this.slot(playerId, kind, startMs, end - startMs, thunder.affect, { sound: thunder.affectSound });
        return;
      }
      case "reverse": {
        const devil = item("devil") as CurseFx | undefined;
        if (devil) this.slot(playerId, kind, startMs, end - startMs, devil.affect,
          { after: devil.after, afterSound: devil.afterSound });
        return;
      }
      case "pull": {
        const magnet = item("magnet");
        if (magnet?.kind === "magnet") this.slot(playerId, kind, startMs, end - startMs, magnet.field,
          { target: options.target });
        return;
      }
      case "shield":
      case "angel":
      case "emp": {
        const aura = [...this.plan.items.values()].find(fx => fx.kind === "aura" && fx.effect === kind);
        if (aura?.kind === "aura") this.slot(playerId, kind, startMs, end - startMs, aura.model, { sound: aura.startSound });
        return;
      }
      case "timeBomb": {
        const bomb = item("timeBomb") as TimeBombFx | undefined;
        if (bomb) this.slot(playerId, kind, startMs, end - startMs, bomb.carried, { pulse: true });
        return;
      }
    }
  }

  endKartEffect(playerId: string, kind: ItemKartEffect): void {
    if (this.disposed) return;
    const slot = this.slots.get(slotKey(playerId, kind));
    if (!slot) return;
    const now = this.nowMs;
    if (slot.endMs <= now) return;
    this.endedSlots.set(slotKey(playerId, kind), { startMs: slot.startMs, endMs: slot.endMs });
    this.retimeSlot(slot, Math.max(now, slot.startMs));
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

  // ---- per item --------------------------------------------------------------

  launchProjectiles(record: UseRecord, fx: ProjectileFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    this.play(fx.launchSound, s, { kind: "kart", playerId: user }, useGroup(event.useId));
    const lift = ITEM_FX_TUNING.projectileLiftM;
    if (event.targets.length === 0) {
      // Misfire: straight ahead at the item's speed for Use.life, then gone.
      let origin: Vec3 | undefined, forward: Vec3 | undefined;
      this.show(useGroup(event.useId), fx.flight, s, s, s + fx.flight.lifeMs, (frame, now, out) => {
        if (!origin) {
          const pose = frame.pose(user);
          if (!pose) return false;
          origin = addScaled(vec(), pose.position, pose.up, lift);
          forward = { ...pose.forward };
        }
        addScaled(out.position, origin, forward!, fx.speed * Math.max(0, now - s) / 1000);
        return pointAlong(out, forward!);
      });
      return;
    }
    const eta = event.etaMs > 0 ? event.etaMs : fx.flight.lifeMs;
    for (const target of event.targets) {
      let origin: Vec3 | undefined;
      let goal: Vec3 | undefined;
      const tangent = vec();
      this.show(targetGroup(event.useId, target), fx.flight, s, s, s + eta + ITEM_FX_TUNING.projectileHoldMs,
        (frame, now, out) => {
          const targetPose = frame.pose(target);
          if (targetPose) goal = addScaled(goal ?? vec(), targetPose.position, targetPose.up, lift);
          if (!origin) {
            const pose = frame.pose(user);
            if (!pose) return false;
            origin = addScaled(vec(), pose.position, pose.up, lift);
          }
          if (!goal) return false;
          // Homing: re-aim at the target's current pose every frame, on a slight arc.
          const p = Math.min(1, Math.max(0, (now - s) / eta));
          const height = fx.arcM * 4 * p * (1 - p);
          out.position.x = origin.x + (goal.x - origin.x) * p;
          out.position.y = origin.y + (goal.y - origin.y) * p + height;
          out.position.z = origin.z + (goal.z - origin.z) * p;
          addScaled(tangent, sub(goal, origin), WORLD_UP, fx.arcM * 4 * (1 - 2 * p));
          return pointAlong(out, tangent) || pointAlong(out, targetPose?.forward ?? vec(0, 0, 1));
        });
    }
  }

  launchUfo(record: UseRecord, fx: UfoFx): void {
    const { event } = record;
    const s = event.startMs;
    this.show(useGroup(event.useId), fx.depart, s, s, s + fx.depart.lifeMs, onKart(event.userId));
    this.play(fx.departSound, s, { kind: "kart", playerId: event.userId }, useGroup(event.useId));
    const eta = event.etaMs > 0 ? event.etaMs : fx.approach.lifeMs;
    // The approach ends where the hover starts: anchor it to finish at the arrival.
    for (const target of event.targets)
      this.show(targetGroup(event.useId, target), fx.approach, s + eta - fx.approach.lifeMs, s, s + eta,
        onKart(target));
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
    const target = () => event.point ?? fallback;
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
    this.show(group, fx.set, land, land, land + fx.set.lifeMs,
      atPoint(frame => capture(frame) ? target() : undefined, () => direction));
    this.play(fx.setSound, land, event.point ? { kind: "point", position: { ...event.point } }
      : { kind: "kart", playerId: user }, group);
  }

  launchTimeBomb(record: UseRecord, fx: TimeBombFx): void {
    const { event } = record;
    const s = event.startMs;
    const user = event.userId;
    const group = useGroup(event.useId);
    this.play(fx.launchSound, s, { kind: "kart", playerId: user }, group);
    this.slot(user, "timeBomb", s, fx.carried.lifeMs, fx.carried, { pulse: true, fromUse: true });
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
    this.show(group, fx.launch, s, s, s + fx.launch.lifeMs, onKart(event.userId));
    this.play(fx.bornSound, s, { kind: "kart", playerId: event.userId }, group);
    // Each target's removal is its own: a cloud blocked on that kart never covered it.
    for (const target of event.targets)
      this.play(fx.removeSound, s + fx.coverMs, { kind: "kart", playerId: target, onlyLocal: true },
        targetGroup(event.useId, target));
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

  // ---- kart effect slots -----------------------------------------------------

  /**
   * One visual per racer and effect: a second start while it runs only moves
   * its end (and does not replay its sound); one that names a `target` also
   * turns it toward that kart (the local racer's own magnet starts with the
   * physics pull, before the use's reply names its target). `fromUse` marks a
   * start from a `used` event, which never brings back the local racer's own
   * effect that the controller already ended.
   */
  slot(playerId: string, kind: SlotKind, startMs: number, durationMs: number,
    model: FxModel | undefined, options: { sound?: FxSound; after?: FxModel; afterSound?: FxSound;
      pulse?: boolean; target?: string; fromUse?: boolean } = {}): void {
    const key = slotKey(playerId, kind);
    const end = startMs + Math.max(0, durationMs);
    const existing = this.slots.get(key);
    if (existing && existing.endMs > Math.max(startMs, this.nowMs) && existing.main && !this.ended(existing.main)) {
      this.retimeSlot(existing, end);
      if (options.target) existing.main.place = this.facing(playerId, options.target);
      return;
    }
    if (options.fromUse && this.endedOwnEffect(key, playerId, startMs)) return;
    if (existing) this.cancel(key);
    this.endedSlots.delete(key);
    const slot: KartSlot = { playerId, kind, startMs, endMs: end };
    this.slots.set(key, slot);
    const placer = options.target ? this.facing(playerId, options.target)
      : options.pulse ? this.pulsing(playerId, startMs, () => slot.endMs) : onKart(playerId);
    slot.main = this.show(key, model, startMs, startMs, end, placer);
    this.play(options.sound, startMs, { kind: "kart", playerId }, key);
    if (options.after) {
      slot.after = { model: options.after, sound: options.afterSound };
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
    const ended = this.endedSlots.get(key);
    return ended !== undefined && startMs < ended.endMs;
  }

  scheduleAfter(slot: KartSlot, key: string): void {
    const after = slot.after;
    if (!after) return;
    if (after.visual) this.finish(after.visual);
    if (after.request) this.dropRequest(after.request);
    after.visual = this.show(key, after.model, slot.endMs, slot.endMs, slot.endMs + after.model.lifeMs,
      onKart(slot.playerId));
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
    const visual: FxVisual = { group, pool, anchorMs, showMs, endMs, place };
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
      const { position: p, right: r, up: u, forward: f, scale: k } = out;
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
      if (slot.endMs <= now && (!slot.after?.visual || this.ended(slot.after.visual))) this.slots.delete(key);
    for (const [key, ended] of this.endedSlots)
      if (now - ended.endMs > ITEM_FX_TUNING.useLifetimeMs) this.endedSlots.delete(key);
  }

  /** At the model cap: take the copy of the visual of that model that ends first. */
  steal(visual: FxVisual): FxInstance | undefined {
    if (!visual.pool.full) return undefined;
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
    this.trapCause.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.audio.dispose();
    this.models.dispose();
  }
}

/**
 * Build the presenter of an item race: decode every model and sound of the
 * item set and assemble one copy of each model, so the first use of an item
 * has no hitch. `context` may be omitted to present silently.
 */
export async function loadItemRacePresenter<Archive>(
  archive: Archive,
  catalog: ItemCatalog,
  environment: unknown,
  stageBinding: unknown,
  context: FxAudioContext | undefined,
  ops: ItemFxOps<Archive>,
): Promise<ItemRacePresenterImpl<Archive>> {
  const plan = buildItemFxPlan(catalog);
  const models = new FxModelBank(archive, environment, stageBinding, ops);
  const audio = new FxSoundBank(archive, context, ops);
  try {
    await Promise.all([models.load(plan.models), audio.load(plan.sounds)]);
    return new ItemRacePresenterImpl(plan, models, audio);
  } catch (error) {
    audio.dispose();
    models.dispose();
    throw error;
  }
}
