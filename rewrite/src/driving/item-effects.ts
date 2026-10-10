/**
 * Victim-side item effects that act on the local kart in item races (道具赛).
 *
 * The owner is created only for `drivingMode.kind === "item"`. It is advanced
 * once per physics slice: `beginSubstep` from the ordinary substep, or
 * `stepHeldSlice` instead of the substep while an effect holds the body
 * kinematically (trapped, launched, stopped by a barricade, held by a
 * talisman or a lockdown field). Timelines use the physics clock, so a
 * 2000 ms effect lasts exactly 1000 slices of 2 ms.
 *
 * The pose changes are real body changes (position, basis, velocities), so the
 * motion frames that other clients receive already show the spin, the floating
 * bubble, the flip and the stop. Durations come from the caller (`item.bml`
 * `Affect` lives); the shapes below are reconstruction constants ([还原]).
 */
import type { Vector3 } from "./continuous-motion";

export type ItemEffectKind =
  | "spin" | "trap" | "launch" | "reverse" | "slow" | "shrink" | "barrier" | "pull"
  | "knockback" | "hold";

export const ITEM_EFFECT_KINDS: readonly ItemEffectKind[] = Object.freeze([
  "spin", "trap", "launch", "reverse", "slow", "shrink", "barrier", "pull",
  "knockback", "hold",
]);

/**
 * Which keys a reverse effect swaps: left/right (devil 大魔王), forward/back
 * (newDevil 恶魔阿哥, "暂时颠倒对方的前后键"), or all four (drrMine R博士,
 * "暂时颠倒对手的所有方向键"; itemDescList.xml:253,258,408).
 */
export type ItemReverseMode = "steering" | "forwardBack" | "all";
export const ITEM_REVERSE_MODES: readonly ItemReverseMode[] = Object.freeze(
  ["steering", "forwardBack", "all"]);

/** A physical arrow key pressed while a hold lasts (the talisman 符咒 QTE). */
export type ItemEffectDirection = "left" | "right" | "up" | "down";
export interface ItemDirectionPress { direction: ItemEffectDirection; atMs: number }

/** Effects that hold the body on a kinematic path instead of running physics. */
const HELD_KINDS: ReadonlySet<ItemEffectKind> = new Set(["trap", "launch", "barrier", "hold"]);
/** Timed kinds that only scale or remap driving; each source keeps its own end. */
const TIMED_KINDS: ReadonlySet<ItemEffectKind> = new Set(["reverse", "slow", "shrink"]);

/** Reconstructed shapes and scales; item lifetimes are passed to `apply`. */
export const ITEM_EFFECT_TUNING = Object.freeze({
  /**
   * Banana: yaw turns over the effect, with the rate falling linearly to zero.
   * 0: the kart only loses grip and speed here; the eight turns of the
   * original's 당함 are drawn by the hit's kart motion (item-kart-motion.ts).
   */
  spinTurns: 0,
  /** Banana: horizontal speed decay while the tires have no grip, per second. */
  spinSpeedDecayPerSecond: 1.5,
  /**
   * Water bubble: float height, rise time and bob. 0: the bubble model lifts
   * the drawn kart into itself (its firedkart, 2.2–3.65 m, item-kart-motion.ts).
   */
  trapFloatHeight: 0,
  trapRiseMs: 400,
  trapBobHeight: 0,
  trapBobPeriodMs: 1200,
  /** Escape mashing: each left/right press shortens the trap, never below the minimum. */
  escapePressMs: 120,
  escapeMinimumMs: 500,
  /** Blue shield (파란방패) after leaving a bubble; `EscapeAffect.life`. */
  escapeImmunityMs: 2000,
  /** waterAngel fast escape (`EnchanterWaterEscape`): the bubble ends 500 ms after it formed. */
  quickTrapMs: 500,
  /**
   * Escape boost (UseExtendedAfterBooster / useExtendedAfterBoosterMore): a
   * forward press this long after a water bubble ends starts the drift instant
   * boost (ITEM_MODE.md C.5).
   */
  escapeBoostWindowMs: 1000,
  /** Spring trap (弹性陷阱 forceZone): pushed back along the reverse heading, no control. */
  knockbackRestitution: 0.5,
  knockbackMinimumSpeed: 8,
  knockbackMaximumSpeed: 25,
  knockbackSpeedDecayPerSecond: 2,
  /**
   * Missile and mine: airborne arc with full rolls, then a stop until the
   * effect ends. 0: the kart is held where it was hit and the explosion's
   * firedkart throws the drawn kart (~11 m, three flips, item-kart-motion.ts).
   */
  launchHeight: 0,
  launchAirMs: 1000,
  launchTurns: 0,
  /** UFO and thunderbolt scales (Appendix B). */
  slowDriveScale: 0.4,
  slowDragScale: 2,
  shrinkDriveScale: 0.5,
  shrinkPercent: 60,
  /** Magnet: horizontal velocity steered at the target and raised toward a cap. */
  pullMinimumSpeed: 30,
  pullAcceleration: 30,
  pullMaximumSpeed: 60,
  pullArrivalDistance: 6,
  /** Magnet: the kart turns to face the target (yaw rate per radian of error, and its cap). */
  pullTurnGain: 8,
  pullTurnMaximumRate: 3,
  /** Character hit motions: above 30 plays the strong crash clip, 15..30 the medium one. */
  launchImpactStrength: 40,
  barrierImpactStrength: 35,
  spinImpactStrength: 20,
  knockbackImpactStrength: 25,
  maximumDurationMs: 60_000,
  /** Unconsumed QTE presses beyond this many are dropped oldest first. */
  maximumDirectionPresses: 32,
});

export interface ItemEffectOptions {
  /** Time already elapsed on the shared `startAt` timeline when the effect is applied. */
  elapsedMs?: number;
  /** Spin yaw or launch roll direction. */
  direction?: 1 | -1;
  /** Spin or launch rotations. */
  turns?: number;
  /**
   * Trap: blue-shield immunity after release (`EscapeAffect.life`, default
   * 2000). Hold: the same immunity after it ends (default 0).
   */
  escapeImmunityMs?: number;
  /** Trap: the waterAngel fast escape; the bubble lasts `quickTrapMs` (500 ms). */
  quick?: boolean;
  /**
   * Trap: whether the bubble is from the water-bomb / water-fly families, so
   * its end opens the escape boost window on karts with UseExtendedAfterBooster
   * (default true: every trap source is a water bubble).
   */
  afterBoost?: boolean;
  /** Reverse: the keys that are swapped (default "steering", the devil). */
  mode?: ItemReverseMode;
  /**
   * Reverse, slow, shrink: the cause of this effect (for example the item idx).
   * Each source keeps its own end and `end(kind, source)` removes only that
   * one, so EMP lifts a UFO slow without ending a tiger rocket slow.
   */
  source?: string | number;
  /** Knockback: push-back speed in m/s (default from the entry speed). */
  speed?: number;
  /** Launch: peak height in metres and airborne time. */
  height?: number;
  airMs?: number;
  /** Pull: target in physics coordinates (same space as `body.position`), read every slice. */
  target?: () => Vector3 | undefined;
  /** Pull: acceleration toward the target and the speed cap, in m/s² and m/s. */
  acceleration?: number;
  maximumSpeed?: number;
}

export type ItemEffectEndReason =
  | "expired" | "escaped" | "cleared" | "replaced" | "cancelled" | "arrived" | "target-lost";

export interface ItemEffectEvent {
  kind: ItemEffectKind;
  phase: "start" | "end";
  /** Physics clock of the owner when the event happened. */
  atMs: number;
  reason?: ItemEffectEndReason;
}

export interface ItemEffectBasis { right: Vector3; forward: Vector3; up: Vector3 }

/** The AL members an item effect owner reads and drives. */
export interface ItemEffectVehicle {
  body: ItemEffectBasis & {
    position: Vector3;
    linearVelocity: Vector3;
    angularVelocity: Vector3;
  };
  runtime: {
    physicsState: number;
    stateRemainingMs: number;
    fullPhysicsBypass: boolean;
    collisionMotionHit: boolean;
    collisionMotionStrength: number;
    collisionAudioStrength: number;
    localForwardSpeed: number;
    localRightSpeed: number;
    bodySpeed: number;
    stagedExternalForce: Vector3;
    stagedExternalTorque: Vector3;
  };
  scratch: { force: Vector3; torque: Vector3 };
  state: { boostTime: number };
  tuning: {
    mass: number;
    /** Escape boost after a water bubble (old engines / V1 and 迅 item karts). */
    useExtendedAfterBooster?: boolean | number;
    useExtendedAfterBoosterMore?: boolean | number;
  };
  setRuntimeScales(scales: { drive?: number; steering?: number; drag?: number }): void;
  triggerEventScale(percentage: number): boolean;
  hardCancelControls(): void;
  updateStateTimer(seconds: number): void;
  updateDriftLifecycleTimers(seconds: number): void;
}

/** One cause of a timed effect: its own end and, for reverse, the keys it swaps. */
interface TimedSource { endMs: number; mode: ItemReverseMode }

interface ActiveEffect {
  kind: ItemEffectKind;
  startMs: number;
  endMs: number;
  direction: number;
  turns: number;
  height: number;
  airMs: number;
  escapeImmunityMs: number;
  escaped: boolean;
  afterBoost: boolean;
  anchor: Vector3;
  basis: ItemEffectBasis;
  target?: () => Vector3 | undefined;
  acceleration: number;
  maximumSpeed: number;
  speed?: number;
  /** Reverse, slow and shrink: every source's end; the effect lasts until the last. */
  sources: Map<string, TimedSource>;
}

const f32 = Math.fround;
const MAGNET_STATE = 16;
/** Unconsumed events are dropped oldest first beyond this many. */
const MAX_PENDING_EVENTS = 64;
const TAU = Math.PI * 2;

const copy = (vector: Vector3): Vector3 => ({ x: vector.x, y: vector.y, z: vector.z });
const zero = (vector: Vector3): void => { vector.x = 0; vector.y = 0; vector.z = 0; };
function set(target: Vector3, x: number, y: number, z: number): void {
  target.x = f32(x); target.y = f32(y); target.z = f32(z);
}
const basisOf = (body: ItemEffectBasis): ItemEffectBasis => ({
  right: copy(body.right), forward: copy(body.forward), up: copy(body.up),
});

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/**
 * Rotate `basis` about its own forward axis by `angle`. The body integrates
 * dv/dt = ω × v and forward × right = up, so ω = forward·rate rolls right toward up.
 */
function rolledBasis(basis: ItemEffectBasis, angle: number): Pick<ItemEffectBasis, "right" | "up"> {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { right, up } = basis;
  return {
    right: { x: right.x * cos + up.x * sin, y: right.y * cos + up.y * sin,
      z: right.z * cos + up.z * sin },
    up: { x: up.x * cos - right.x * sin, y: up.y * cos - right.y * sin,
      z: up.z * cos - right.z * sin },
  };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

const steeringMode = (mode: ItemReverseMode) => mode === "steering" || mode === "all";
const forwardBackMode = (mode: ItemReverseMode) => mode === "forwardBack" || mode === "all";

/**
 * Timed spin, trap, launch, reverse, slow, shrink, barrier, pull, knockback
 * and hold effects. Hit authority (shield, angel, EMP, immunity, equipment
 * passives) belongs to the item controller; `apply` only refuses effects the
 * kart cannot take in its current state.
 */
export class VehicleItemEffects {
  readonly vehicle: ItemEffectVehicle;
  readonly kinds = new Set<ItemEffectKind>();
  readonly effects = new Map<ItemEffectKind, ActiveEffect>();
  clockMs = 0;
  escapeShieldEndMs = 0;
  /** Escape boost window end (physics clock); 0 when closed. */
  escapeBoostEndMs = 0;
  /** Arrow keys pressed while a hold lasts, for the talisman QTE. */
  directionPresses: ItemDirectionPress[] = [];
  pendingImpact: { strength: number; audio: boolean } | undefined;
  appliedDriveScale = 1;
  appliedDragScale = 1;
  events: ItemEffectEvent[] = [];
  /**
   * A crush (directional press) asked for a reset. Unlike the wall timers it
   * asks only once, so the race owner keeps it until no effect suppresses resets.
   */
  crushResetRequested = false;

  constructor(vehicle: ItemEffectVehicle) {
    this.vehicle = vehicle;
  }

  /** Kinds that are currently running. The set is live; do not mutate it. */
  get active(): ReadonlySet<ItemEffectKind> { return this.kinds; }

  /** Trapped, or inside the blue-shield window after leaving a bubble. */
  get immune(): boolean {
    return this.kinds.has("trap") || this.clockMs < this.escapeShieldEndMs;
  }

  get escapeShieldRemainingMs(): number {
    return this.kinds.has("trap") ? 0 : Math.max(0, this.escapeShieldEndMs - this.clockMs);
  }

  /** Items cannot be used while trapped, launched, stopped or held. */
  get canUseItem(): boolean { return !this.heldEffect(); }

  /** The body follows a kinematic path and the physics substep is skipped. */
  get holdsBody(): boolean { return !!this.heldEffect(); }

  /** Drive and tire grip are suppressed while spinning or knocked back. */
  get suppressesDrive(): boolean { return this.kinds.has("spin") || this.kinds.has("knockback"); }

  get suppressesAutomaticReset(): boolean {
    return this.suppressesDrive || !!this.heldEffect();
  }

  /** Left and right are swapped (devil, drrMine). */
  get steeringInverted(): boolean { return this.reverseActive(steeringMode); }

  /** Forward and back are swapped (newDevil, drrMine). */
  get forwardBackSwapped(): boolean { return this.reverseActive(forwardBackMode); }

  /** The keys a running reverse swaps, or undefined without one. */
  get reverseMode(): ItemReverseMode | undefined {
    const steering = this.steeringInverted;
    const forwardBack = this.forwardBackSwapped;
    return steering && forwardBack ? "all" : steering ? "steering"
      : forwardBack ? "forwardBack" : undefined;
  }

  /** A forward press now starts the escape boost (a water bubble ended moments ago). */
  get escapeBoostReady(): boolean {
    return this.clockMs < this.escapeBoostEndMs && !this.heldEffect();
  }

  get escapeBoostRemainingMs(): number {
    return this.escapeBoostReady ? Math.max(0, this.escapeBoostEndMs - this.clockMs) : 0;
  }

  /**
   * Called on a forward press: true (and the window closes) when the press
   * should start the drift instant boost after an escape. The vehicle command
   * enters physics state 2 exactly like a forward press after a drift.
   */
  consumeEscapeBoost(): boolean {
    if (!this.escapeBoostReady || this.vehicle.runtime.fullPhysicsBypass) return false;
    this.escapeBoostEndMs = 0;
    return true;
  }

  /** Called by the directional press next to its automatic reset request. */
  requestCrushReset(): void { this.crushResetRequested = true; }

  consumeCrushReset(): boolean {
    const requested = this.crushResetRequested;
    this.crushResetRequested = false;
    return requested;
  }

  /**
   * A stable basis for the chase camera while the body spins or flips, so the
   * camera keeps looking down the road instead of turning with the kart.
   */
  get cameraBasis(): ItemEffectBasis | undefined {
    const launch = this.effects.get("launch");
    if (launch) return launch.basis;
    return this.effects.get("spin")?.basis;
  }

  remainingMs(kind: ItemEffectKind): number {
    const effect = this.effects.get(kind);
    return effect ? Math.max(0, effect.endMs - this.clockMs) : 0;
  }

  consumeEvents(): ItemEffectEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  /** Start an effect. Returns false when the kart cannot take it right now. */
  apply(kind: ItemEffectKind, durationMs: number, options: ItemEffectOptions = {}): boolean {
    if (!ITEM_EFFECT_KINDS.includes(kind)) throw new Error(`未知的道具效果 ${String(kind)}。`);
    if (options.mode !== undefined && !ITEM_REVERSE_MODES.includes(options.mode))
      throw new Error(`未知的反向方式 ${String(options.mode)}。`);
    if (!Number.isFinite(durationMs) || durationMs <= 0) return false;
    let duration = Math.min(Math.trunc(durationMs), ITEM_EFFECT_TUNING.maximumDurationMs);
    if (kind === "trap" && options.quick) duration = Math.min(duration, ITEM_EFFECT_TUNING.quickTrapMs);
    const elapsed = Math.max(0, Math.trunc(finiteOr(options.elapsedMs, 0)));
    if (elapsed >= duration) return false;
    if (this.vehicle.runtime.fullPhysicsBypass) return false;
    if (kind !== "pull" && this.immune) return false;
    const startMs = this.clockMs - elapsed;
    const effect = this.createEffect(kind, startMs, startMs + duration, options);
    switch (kind) {
      case "trap":
      case "launch":
      case "barrier":
      case "hold":
        return this.startHeld(effect);
      case "spin":
        return this.startSpin(effect);
      case "knockback":
        return this.startKnockback(effect);
      case "pull":
        return this.startPull(effect);
      default:
        return this.startTimed(effect);
    }
  }

  /**
   * End one effect early (EMP removing a UFO, a booster replacing a magnet
   * pull). With a `source`, a reverse, slow or shrink loses only that cause and
   * keeps running while another one lasts; false when that source is not running.
   */
  end(kind: ItemEffectKind, source?: string | number): boolean {
    const effect = this.effects.get(kind);
    if (!effect) return false;
    if (source !== undefined && TIMED_KINDS.has(kind)) {
      const key = String(source);
      const running = effect.sources.get(key);
      if (!running || running.endMs <= this.clockMs) return false;
      effect.sources.delete(key);
      const remaining = [...effect.sources.values()].filter(item => item.endMs > this.clockMs);
      if (remaining.length > 0) {
        effect.endMs = Math.max(...remaining.map(item => item.endMs));
        return true;
      }
    }
    this.finish(kind, "cancelled");
    return true;
  }

  /** Whether `source` currently causes `kind` (reverse, slow, shrink). */
  hasSource(kind: ItemEffectKind, source: string | number): boolean {
    const running = this.effects.get(kind)?.sources.get(String(source));
    return running !== undefined && running.endMs > this.clockMs;
  }

  /** A left or right press while trapped shortens the bubble. */
  escapePress(): boolean {
    const trap = this.effects.get("trap");
    if (!trap) return false;
    const minimumEnd = trap.startMs + ITEM_EFFECT_TUNING.escapeMinimumMs;
    trap.endMs = Math.max(minimumEnd, trap.endMs - ITEM_EFFECT_TUNING.escapePressMs);
    trap.escaped = true;
    return true;
  }

  /**
   * An arrow key pressed while a hold lasts (the talisman QTE). The presses
   * are queued for the item controller, which judges the sequence and calls
   * `escapeHold`; false (nothing queued) without a hold.
   */
  directionPress(direction: ItemEffectDirection): boolean {
    if (!this.effects.has("hold")) return false;
    if (direction !== "left" && direction !== "right" && direction !== "up" && direction !== "down")
      return false;
    this.directionPresses.push({ direction, atMs: this.clockMs });
    if (this.directionPresses.length > ITEM_EFFECT_TUNING.maximumDirectionPresses)
      this.directionPresses.shift();
    return true;
  }

  consumeDirectionPresses(): ItemDirectionPress[] {
    const presses = this.directionPresses;
    this.directionPresses = [];
    return presses;
  }

  /**
   * End a hold early (the talisman QTE succeeded): it ends `delayMs` from now
   * (the original `EscapeAffect.life`, 500 ms, plays meanwhile), never later
   * than its own end, and reports `escaped`.
   */
  escapeHold(delayMs = 0): boolean {
    const hold = this.effects.get("hold");
    if (!hold) return false;
    const delay = Math.max(0, Math.trunc(finiteOr(delayMs, 0)));
    hold.endMs = Math.min(hold.endMs, this.clockMs + delay);
    hold.escaped = true;
    if (hold.endMs <= this.clockMs) this.finish("hold", "escaped");
    return true;
  }

  /** End every effect and restore the kart (reset, warp, finish, dispose). */
  clear(): void {
    for (const kind of [...this.effects.keys()]) this.finish(kind, "cleared");
    this.escapeShieldEndMs = 0;
    this.escapeBoostEndMs = 0;
    this.directionPresses = [];
    this.pendingImpact = undefined;
    this.crushResetRequested = false;
  }

  /** Forget all effects after the physics runtime was rebuilt by a full reset. */
  resetState(): void {
    for (const kind of this.effects.keys())
      this.record({ kind, phase: "end", atMs: this.clockMs, reason: "cleared" });
    this.effects.clear();
    this.kinds.clear();
    this.escapeShieldEndMs = 0;
    this.escapeBoostEndMs = 0;
    this.directionPresses = [];
    this.pendingImpact = undefined;
    this.crushResetRequested = false;
    this.appliedDriveScale = 1;
    this.appliedDragScale = 1;
  }

  /** Advance timers while the whole vehicle is bypassed (checkpoint reset, giant freeze). */
  advanceWithoutPhysics(elapsedMs: number): void {
    if (elapsedMs > 0) this.advance(elapsedMs);
  }

  /** Called at the start of every ordinary physics substep. */
  beginSubstep(seconds: number): void {
    this.advance(sliceMilliseconds(seconds));
    this.applyPendingImpact();
    const spin = this.effects.get("spin");
    if (spin) this.applySpin(spin, seconds);
    const knockback = this.effects.get("knockback");
    if (knockback) this.applyKnockback(seconds);
    const pull = this.effects.get("pull");
    if (pull) this.applyPull(pull, seconds);
  }

  /** Replaces the physics substep while an effect holds the body. */
  stepHeldSlice(seconds: number): void {
    const vehicle = this.vehicle;
    vehicle.updateStateTimer(seconds);
    vehicle.updateDriftLifecycleTimers(seconds);
    const sliceMs = sliceMilliseconds(seconds);
    this.advance(sliceMs);
    this.applyPendingImpact();
    zero(vehicle.scratch.force);
    zero(vehicle.scratch.torque);
    zero(vehicle.runtime.stagedExternalForce);
    zero(vehicle.runtime.stagedExternalTorque);
    const held = this.heldEffect();
    if (!held) return;
    const runtime = vehicle.runtime;
    runtime.localForwardSpeed = 0;
    runtime.localRightSpeed = 0;
    if (held.kind === "trap") this.holdTrapped(held, sliceMs);
    else if (held.kind === "launch") this.holdLaunched(held);
    else this.placeOnAnchor(held);
    const velocity = vehicle.body.linearVelocity;
    runtime.bodySpeed = f32(Math.hypot(velocity.x, velocity.y, velocity.z));
  }

  private heldEffect(): ActiveEffect | undefined {
    return this.effects.get("trap") ?? this.effects.get("launch") ?? this.effects.get("barrier") ??
      this.effects.get("hold");
  }

  private reverseActive(axis: (mode: ItemReverseMode) => boolean): boolean {
    const reverse = this.effects.get("reverse");
    if (!reverse) return false;
    for (const source of reverse.sources.values())
      if (axis(source.mode) && source.endMs > this.clockMs) return true;
    return false;
  }

  /** The escape boost is a property of the kart (both spellings, ITEM_MODE.md C.5). */
  private get escapeBoostEnabled(): boolean {
    const tuning = this.vehicle.tuning;
    return !!tuning.useExtendedAfterBooster || !!tuning.useExtendedAfterBoosterMore;
  }

  private createEffect(kind: ItemEffectKind, startMs: number, endMs: number,
    options: ItemEffectOptions): ActiveEffect {
    const tuning = ITEM_EFFECT_TUNING;
    const body = this.vehicle.body;
    const direction = options.direction === -1 ? -1
      : options.direction === 1 ? 1
        : kind === "spin" && this.vehicle.runtime.localRightSpeed < 0 ? -1 : 1;
    return {
      kind, startMs, endMs, direction,
      turns: Math.max(0, finiteOr(options.turns,
        kind === "launch" ? tuning.launchTurns : tuning.spinTurns)),
      height: Math.max(0, finiteOr(options.height, tuning.launchHeight)),
      airMs: Math.max(1, Math.min(endMs - startMs,
        Math.trunc(finiteOr(options.airMs, tuning.launchAirMs)))),
      escapeImmunityMs: Math.max(0, Math.trunc(finiteOr(options.escapeImmunityMs,
        kind === "hold" ? 0 : tuning.escapeImmunityMs))),
      escaped: false,
      afterBoost: kind === "trap" && options.afterBoost !== false,
      anchor: copy(body.position),
      basis: basisOf(body),
      target: options.target,
      acceleration: Math.max(0, finiteOr(options.acceleration, tuning.pullAcceleration)),
      maximumSpeed: Math.max(0, finiteOr(options.maximumSpeed, tuning.pullMaximumSpeed)),
      ...(options.speed !== undefined && Number.isFinite(options.speed)
        ? { speed: Math.max(0, options.speed) } : {}),
      sources: TIMED_KINDS.has(kind)
        ? new Map([[String(options.source ?? ""), { endMs, mode: options.mode ?? "steering" }]])
        : new Map(),
    };
  }

  private begin(effect: ActiveEffect): void {
    this.effects.set(effect.kind, effect);
    this.kinds.add(effect.kind);
    this.record({ kind: effect.kind, phase: "start", atMs: this.clockMs });
  }

  private record(event: ItemEffectEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_PENDING_EVENTS) this.events.shift();
  }

  /** A hostile hit cancels drift, boosters, a running magnet pull and an escape boost window. */
  private interrupt(): void {
    const vehicle = this.vehicle;
    vehicle.hardCancelControls();
    const runtime = vehicle.runtime;
    if (runtime.physicsState >= 1 && runtime.physicsState <= 11) {
      runtime.physicsState = 0;
      runtime.stateRemainingMs = 0;
      vehicle.state.boostTime = 0;
    }
    if (this.effects.has("pull")) this.finish("pull", "cancelled");
    this.escapeBoostEndMs = 0;
  }

  /** End the sliding effects (spin, knockback) a new hit replaces. */
  private replaceSliding(): void {
    for (const kind of ["spin", "knockback"] as const)
      if (this.effects.has(kind)) this.finish(kind, "replaced");
  }

  private startHeld(effect: ActiveEffect): boolean {
    const previous = this.heldEffect();
    if (previous) {
      // A bubble cannot be replaced; a barricade never interrupts another hold;
      // a hold does not pull a kart out of the air.
      if (previous.kind === "trap" || effect.kind === "barrier") return false;
      if (effect.kind === "hold" && previous.kind === "launch") return false;
      if (effect.kind === "hold" && previous.kind === "hold") {
        // Two holds (a lockdown field and a talisman): the later end wins.
        previous.endMs = Math.max(previous.endMs, effect.endMs);
        previous.escapeImmunityMs = Math.max(previous.escapeImmunityMs, effect.escapeImmunityMs);
        previous.escaped = false;
        return true;
      }
      effect.anchor = copy(previous.anchor);
      effect.basis = basisOf(previous.basis);
      this.finish(previous.kind, "replaced");
    }
    this.interrupt();
    this.replaceSliding();
    this.begin(effect);
    if (effect.kind === "launch")
      this.pendingImpact = { strength: ITEM_EFFECT_TUNING.launchImpactStrength, audio: false };
    else if (effect.kind === "barrier")
      this.pendingImpact = { strength: ITEM_EFFECT_TUNING.barrierImpactStrength, audio: true };
    return true;
  }

  private startSpin(effect: ActiveEffect): boolean {
    if (this.heldEffect()) return false;
    this.interrupt();
    this.replaceSliding();
    this.begin(effect);
    this.pendingImpact = { strength: ITEM_EFFECT_TUNING.spinImpactStrength, audio: false };
    return true;
  }

  /**
   * Spring trap: the horizontal velocity turns to the reverse heading (half the
   * forward speed, within the minimum and maximum, or `speed`); drive and tire
   * grip stay off and the speed bleeds away until the effect ends. Collisions
   * keep running, so the kart cannot be pushed through a wall.
   */
  private startKnockback(effect: ActiveEffect): boolean {
    if (this.heldEffect()) return false;
    this.interrupt();
    this.replaceSliding();
    this.begin(effect);
    const tuning = ITEM_EFFECT_TUNING;
    const { forward, linearVelocity: velocity } = this.vehicle.body;
    const length = Math.hypot(forward.x, forward.z);
    const headingX = length > 1e-6 ? forward.x / length : 0;
    const headingZ = length > 1e-6 ? forward.z / length : 1;
    const forwardSpeed = velocity.x * headingX + velocity.z * headingZ;
    const speed = effect.speed ?? Math.min(tuning.knockbackMaximumSpeed,
      Math.max(tuning.knockbackMinimumSpeed, Math.abs(forwardSpeed) * tuning.knockbackRestitution));
    velocity.x = f32(-headingX * speed);
    velocity.z = f32(-headingZ * speed);
    this.setYawRate(0);
    this.pendingImpact = { strength: tuning.knockbackImpactStrength, audio: false };
    return true;
  }

  private startPull(effect: ActiveEffect): boolean {
    if (!effect.target) throw new Error("磁铁牵引缺少目标位置。");
    if (!this.canUseItem) return false;
    if (this.effects.has("pull")) this.finish("pull", "replaced");
    this.begin(effect);
    const runtime = this.vehicle.runtime;
    runtime.physicsState = MAGNET_STATE;
    runtime.stateRemainingMs = Math.max(1, Math.ceil(effect.endMs - this.clockMs));
    this.vehicle.state.boostTime = 0;
    return true;
  }

  private startTimed(effect: ActiveEffect): boolean {
    const current = this.effects.get(effect.kind);
    if (current) {
      // A second cause: each source keeps its own end (the same source extends).
      for (const [key, source] of effect.sources) {
        const running = current.sources.get(key);
        current.sources.set(key, running && running.endMs > this.clockMs
          ? { endMs: Math.max(running.endMs, source.endMs),
              mode: running.mode === source.mode ? source.mode : "all" }
          : source);
      }
      current.endMs = Math.max(current.endMs, effect.endMs);
      return true;
    }
    this.begin(effect);
    if (effect.kind === "shrink") this.vehicle.triggerEventScale(ITEM_EFFECT_TUNING.shrinkPercent);
    this.refreshScales();
    return true;
  }

  private advance(milliseconds: number): void {
    this.clockMs += milliseconds;
    for (const effect of [...this.effects.values()]) {
      if (this.clockMs >= effect.endMs)
        this.finish(effect.kind, effect.escaped ? "escaped" : "expired");
    }
  }

  private finish(kind: ItemEffectKind, reason: ItemEffectEndReason): void {
    const effect = this.effects.get(kind);
    if (!effect) return;
    this.effects.delete(kind);
    this.kinds.delete(kind);
    this.record({ kind, phase: "end", atMs: this.clockMs, reason });
    const vehicle = this.vehicle;
    const body = vehicle.body;
    if (HELD_KINDS.has(kind) && reason !== "replaced") {
      zero(body.linearVelocity);
      zero(body.angularVelocity);
      // A launch, barricade stop or hold ends on the ground pose it started from.
      if (kind !== "trap") this.placeOnAnchor(effect);
      const released = reason === "expired" || reason === "escaped";
      // The blue shield starts on the bubble's (or hold's) own timeline end.
      if ((kind === "trap" || kind === "hold") && released && effect.escapeImmunityMs > 0)
        this.escapeShieldEndMs = Math.max(this.escapeShieldEndMs,
          effect.endMs + effect.escapeImmunityMs);
      // A water bubble that ends opens the escape boost window on karts that have it.
      if (kind === "trap" && released && effect.afterBoost && this.escapeBoostEnabled)
        this.escapeBoostEndMs = effect.endMs + ITEM_EFFECT_TUNING.escapeBoostWindowMs;
    }
    if (kind === "hold") this.directionPresses = [];
    if (kind === "pull" && vehicle.runtime.physicsState === MAGNET_STATE) {
      vehicle.runtime.physicsState = 0;
      vehicle.runtime.stateRemainingMs = 0;
      vehicle.state.boostTime = 0;
    }
    if (kind === "shrink") vehicle.triggerEventScale(100);
    if (kind === "slow" || kind === "shrink") this.refreshScales();
  }

  private refreshScales(): void {
    const tuning = ITEM_EFFECT_TUNING;
    const drive = (this.kinds.has("slow") ? tuning.slowDriveScale : 1) *
      (this.kinds.has("shrink") ? tuning.shrinkDriveScale : 1);
    const drag = this.kinds.has("slow") ? tuning.slowDragScale : 1;
    if (drive === this.appliedDriveScale && drag === this.appliedDragScale) return;
    this.appliedDriveScale = drive;
    this.appliedDragScale = drag;
    this.vehicle.setRuntimeScales({ drive, drag });
  }

  private applyPendingImpact(): void {
    const impact = this.pendingImpact;
    if (!impact) return;
    this.pendingImpact = undefined;
    const runtime = this.vehicle.runtime;
    runtime.collisionMotionHit = true;
    runtime.collisionMotionStrength = Math.max(runtime.collisionMotionStrength, impact.strength);
    if (impact.audio)
      runtime.collisionAudioStrength = Math.max(runtime.collisionAudioStrength, impact.strength);
  }

  /** Banana: yaw about the kart's up axis with a falling rate, and bleed off speed. */
  private applySpin(spin: ActiveEffect, seconds: number): void {
    const body = this.vehicle.body;
    const durationMs = spin.endMs - spin.startMs;
    const progress = Math.min(1, Math.max(0, (this.clockMs - spin.startMs) / durationMs));
    // The rate falls linearly to zero, so the turns are covered by half the initial rate.
    const initialRate = (2 * TAU * spin.turns) / (durationMs / 1000);
    this.setYawRate(spin.direction * initialRate * (1 - progress));
    const decay = Math.exp(-ITEM_EFFECT_TUNING.spinSpeedDecayPerSecond * seconds);
    body.linearVelocity.x = f32(body.linearVelocity.x * decay);
    body.linearVelocity.z = f32(body.linearVelocity.z * decay);
  }

  /** Spring trap: the push-back bleeds off; the heading stays put. */
  private applyKnockback(seconds: number): void {
    const velocity = this.vehicle.body.linearVelocity;
    const decay = Math.exp(-ITEM_EFFECT_TUNING.knockbackSpeedDecayPerSecond * seconds);
    velocity.x = f32(velocity.x * decay);
    velocity.z = f32(velocity.z * decay);
    this.setYawRate(0);
  }

  /** Magnet: aim the horizontal velocity at the target, like the `MZ` road, and speed up. */
  private applyPull(pull: ActiveEffect, seconds: number): void {
    const target = pull.target?.();
    if (!target || ![target.x, target.y, target.z].every(Number.isFinite)) {
      this.finish("pull", "target-lost");
      return;
    }
    const body = this.vehicle.body;
    const dx = target.x - body.position.x;
    const dz = target.z - body.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= ITEM_EFFECT_TUNING.pullArrivalDistance) {
      this.finish("pull", "arrived");
      return;
    }
    const velocity = body.linearVelocity;
    const currentSpeed = Math.hypot(velocity.x, velocity.z);
    const speed = Math.max(currentSpeed, Math.min(pull.maximumSpeed,
      Math.max(currentSpeed, ITEM_EFFECT_TUNING.pullMinimumSpeed) + pull.acceleration * seconds));
    const directionX = dx / distance;
    const directionZ = dz / distance;
    velocity.x = f32(directionX * speed);
    velocity.z = f32(directionZ * speed);
    // Turn the nose toward the target instead of crabbing sideways.
    const { forward } = body;
    const error = Math.atan2(forward.z * directionX - forward.x * directionZ,
      forward.x * directionX + forward.z * directionZ);
    const limit = ITEM_EFFECT_TUNING.pullTurnMaximumRate;
    this.setYawRate(Math.max(-limit, Math.min(limit, error * ITEM_EFFECT_TUNING.pullTurnGain)));
  }

  /** Replace the angular velocity about the kart's up axis, keeping pitch and roll. */
  private setYawRate(rate: number): void {
    const { up, angularVelocity: angular } = this.vehicle.body;
    const along = angular.x * up.x + angular.y * up.y + angular.z * up.z;
    angular.x = f32(angular.x + up.x * (rate - along));
    angular.y = f32(angular.y + up.y * (rate - along));
    angular.z = f32(angular.z + up.z * (rate - along));
  }

  /** Water bubble: rise off the ground, bob, and stay in place. */
  private holdTrapped(trap: ActiveEffect, sliceMs: number): void {
    const body = this.vehicle.body;
    const height = (elapsed: number) => {
      const tuning = ITEM_EFFECT_TUNING;
      const rise = smoothstep(elapsed / tuning.trapRiseMs);
      return tuning.trapFloatHeight * rise +
        tuning.trapBobHeight * rise * Math.sin((TAU * elapsed) / tuning.trapBobPeriodMs);
    };
    const elapsed = this.clockMs - trap.startMs;
    const current = height(elapsed);
    this.placeOnAnchor(trap);
    body.position.y = f32(trap.anchor.y + current);
    body.linearVelocity.y = f32((current - height(elapsed - sliceMs)) / (sliceMs / 1000));
  }

  /** Missile or mine: thrown up in a parabola while rolling, then held until the effect ends. */
  private holdLaunched(launch: ActiveEffect): void {
    const body = this.vehicle.body;
    const elapsed = this.clockMs - launch.startMs;
    this.placeOnAnchor(launch);
    if (elapsed >= launch.airMs) return;
    const progress = elapsed / launch.airMs;
    const airSeconds = launch.airMs / 1000;
    const height = 4 * launch.height * progress * (1 - progress);
    const rollRate = (launch.direction * TAU * launch.turns) / airSeconds;
    body.position.y = f32(launch.anchor.y + height);
    const rolled = rolledBasis(launch.basis, rollRate * (elapsed / 1000));
    set(body.right, rolled.right.x, rolled.right.y, rolled.right.z);
    set(body.up, rolled.up.x, rolled.up.y, rolled.up.z);
    body.linearVelocity.y = f32((4 * launch.height * (1 - 2 * progress)) / airSeconds);
    // The network wrench carries the arc's constant acceleration for remote extrapolation.
    this.vehicle.scratch.force.y = f32(this.vehicle.tuning.mass *
      ((-8 * launch.height) / (airSeconds * airSeconds)));
    const forward = launch.basis.forward;
    set(body.angularVelocity, forward.x * rollRate, forward.y * rollRate, forward.z * rollRate);
  }

  /** Stand still on the pose where the effect started (barricade, end of a launch). */
  private placeOnAnchor(effect: ActiveEffect): void {
    const body = this.vehicle.body;
    set(body.position, effect.anchor.x, effect.anchor.y, effect.anchor.z);
    set(body.right, effect.basis.right.x, effect.basis.right.y, effect.basis.right.z);
    set(body.forward, effect.basis.forward.x, effect.basis.forward.y, effect.basis.forward.z);
    set(body.up, effect.basis.up.x, effect.basis.up.y, effect.basis.up.z);
    zero(body.linearVelocity);
    zero(body.angularVelocity);
  }
}

/** Physics slices are float32 seconds; timelines count whole microseconds. */
function sliceMilliseconds(seconds: number): number {
  return Math.round(seconds * 1_000_000) / 1_000;
}
