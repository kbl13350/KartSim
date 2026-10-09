/**
 * Victim-side item effects that act on the local kart in item races (道具赛).
 *
 * The owner is created only for `drivingMode.kind === "item"`. It is advanced
 * once per physics slice: `beginSubstep` from the ordinary substep, or
 * `stepHeldSlice` instead of the substep while an effect holds the body
 * kinematically (trapped, launched, stopped by a barricade). Timelines use the
 * physics clock, so a 2000 ms effect lasts exactly 1000 slices of 2 ms.
 *
 * The pose changes are real body changes (position, basis, velocities), so the
 * motion frames that other clients receive already show the spin, the floating
 * bubble, the flip and the stop. Durations come from the caller (`item.bml`
 * `Affect` lives); the shapes below are reconstruction constants ([还原]).
 */
import type { Vector3 } from "./continuous-motion";

export type ItemEffectKind =
  | "spin" | "trap" | "launch" | "reverse" | "slow" | "shrink" | "barrier" | "pull";

export const ITEM_EFFECT_KINDS: readonly ItemEffectKind[] = Object.freeze([
  "spin", "trap", "launch", "reverse", "slow", "shrink", "barrier", "pull",
]);

/** Effects that hold the body on a kinematic path instead of running physics. */
const HELD_KINDS: ReadonlySet<ItemEffectKind> = new Set(["trap", "launch", "barrier"]);

/** Reconstructed shapes and scales; item lifetimes are passed to `apply`. */
export const ITEM_EFFECT_TUNING = Object.freeze({
  /** Banana: yaw turns over the effect, with the rate falling linearly to zero. */
  spinTurns: 2,
  /** Banana: horizontal speed decay while the tires have no grip, per second. */
  spinSpeedDecayPerSecond: 1.5,
  /** Water bubble: float height, rise time and bob. */
  trapFloatHeight: 0.8,
  trapRiseMs: 400,
  trapBobHeight: 0.08,
  trapBobPeriodMs: 1200,
  /** Escape mashing: each left/right press shortens the trap, never below the minimum. */
  escapePressMs: 120,
  escapeMinimumMs: 500,
  /** Blue shield (파란방패) after leaving a bubble; `EscapeAffect.life`. */
  escapeImmunityMs: 2000,
  /** Missile and mine: airborne arc with full rolls, then a stop until the effect ends. */
  launchHeight: 2.5,
  launchAirMs: 1000,
  launchTurns: 1,
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
  maximumDurationMs: 60_000,
});

export interface ItemEffectOptions {
  /** Time already elapsed on the shared `startAt` timeline when the effect is applied. */
  elapsedMs?: number;
  /** Spin yaw or launch roll direction. */
  direction?: 1 | -1;
  /** Spin or launch rotations. */
  turns?: number;
  /** Trap: blue-shield immunity after release (`EscapeAffect.life`). */
  escapeImmunityMs?: number;
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
  tuning: { mass: number };
  setRuntimeScales(scales: { drive?: number; steering?: number; drag?: number }): void;
  triggerEventScale(percentage: number): boolean;
  hardCancelControls(): void;
  updateStateTimer(seconds: number): void;
  updateDriftLifecycleTimers(seconds: number): void;
}

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
  anchor: Vector3;
  basis: ItemEffectBasis;
  target?: () => Vector3 | undefined;
  acceleration: number;
  maximumSpeed: number;
}

const f32 = Math.fround;
const MAGNET_STATE = 16;
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

/**
 * Timed spin, trap, launch, reverse, slow, shrink, barrier and pull effects.
 * Hit authority (shield, angel, EMP, immunity) belongs to the item controller;
 * `apply` only refuses effects the kart cannot take in its current state.
 */
export class VehicleItemEffects {
  readonly vehicle: ItemEffectVehicle;
  readonly kinds = new Set<ItemEffectKind>();
  readonly effects = new Map<ItemEffectKind, ActiveEffect>();
  clockMs = 0;
  escapeShieldEndMs = 0;
  pendingImpact: { strength: number; audio: boolean } | undefined;
  appliedDriveScale = 1;
  appliedDragScale = 1;
  events: ItemEffectEvent[] = [];

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

  /** Items cannot be used while trapped, launched or stopped by a barricade. */
  get canUseItem(): boolean { return !this.heldEffect(); }

  /** The body follows a kinematic path and the physics substep is skipped. */
  get holdsBody(): boolean { return !!this.heldEffect(); }

  /** Drive and tire grip are suppressed while spinning. */
  get suppressesDrive(): boolean { return this.kinds.has("spin"); }

  get suppressesAutomaticReset(): boolean {
    return this.kinds.has("spin") || !!this.heldEffect();
  }

  get steeringInverted(): boolean { return this.kinds.has("reverse"); }

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
    if (!Number.isFinite(durationMs) || durationMs <= 0) return false;
    const duration = Math.min(Math.trunc(durationMs), ITEM_EFFECT_TUNING.maximumDurationMs);
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
        return this.startHeld(effect);
      case "spin":
        return this.startSpin(effect);
      case "pull":
        return this.startPull(effect);
      default:
        return this.startTimed(effect);
    }
  }

  /** End one effect early (EMP removing a UFO, a booster replacing a magnet pull). */
  end(kind: ItemEffectKind): boolean {
    if (!this.effects.has(kind)) return false;
    this.finish(kind, "cancelled");
    return true;
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

  /** End every effect and restore the kart (reset, warp, finish, dispose). */
  clear(): void {
    for (const kind of [...this.effects.keys()]) this.finish(kind, "cleared");
    this.escapeShieldEndMs = 0;
    this.pendingImpact = undefined;
  }

  /** Forget all effects after the physics runtime was rebuilt by a full reset. */
  resetState(): void {
    for (const kind of this.effects.keys())
      this.events.push({ kind, phase: "end", atMs: this.clockMs, reason: "cleared" });
    this.effects.clear();
    this.kinds.clear();
    this.escapeShieldEndMs = 0;
    this.pendingImpact = undefined;
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
    return this.effects.get("trap") ?? this.effects.get("launch") ?? this.effects.get("barrier");
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
        tuning.escapeImmunityMs))),
      escaped: false,
      anchor: copy(body.position),
      basis: basisOf(body),
      target: options.target,
      acceleration: Math.max(0, finiteOr(options.acceleration, tuning.pullAcceleration)),
      maximumSpeed: Math.max(0, finiteOr(options.maximumSpeed, tuning.pullMaximumSpeed)),
    };
  }

  private begin(effect: ActiveEffect): void {
    this.effects.set(effect.kind, effect);
    this.kinds.add(effect.kind);
    this.events.push({ kind: effect.kind, phase: "start", atMs: this.clockMs });
  }

  /** A hostile hit cancels drift, boosters and a running magnet pull. */
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
  }

  private startHeld(effect: ActiveEffect): boolean {
    const previous = this.heldEffect();
    if (previous) {
      // A bubble cannot be replaced; a barricade never interrupts another hold.
      if (previous.kind === "trap" || effect.kind === "barrier") return false;
      effect.anchor = copy(previous.anchor);
      effect.basis = basisOf(previous.basis);
      this.finish(previous.kind, "replaced");
    }
    this.interrupt();
    if (this.effects.has("spin")) this.finish("spin", "replaced");
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
    if (this.effects.has("spin")) this.finish("spin", "replaced");
    this.begin(effect);
    this.pendingImpact = { strength: ITEM_EFFECT_TUNING.spinImpactStrength, audio: false };
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
        this.finish(effect.kind, effect.kind === "trap" && effect.escaped ? "escaped" : "expired");
    }
  }

  private finish(kind: ItemEffectKind, reason: ItemEffectEndReason): void {
    const effect = this.effects.get(kind);
    if (!effect) return;
    this.effects.delete(kind);
    this.kinds.delete(kind);
    this.events.push({ kind, phase: "end", atMs: this.clockMs, reason });
    const vehicle = this.vehicle;
    const body = vehicle.body;
    if (HELD_KINDS.has(kind) && reason !== "replaced") {
      zero(body.linearVelocity);
      zero(body.angularVelocity);
      // A launch or barricade stop ends on the ground pose it started from.
      if (kind !== "trap") this.placeOnAnchor(effect);
      // The blue shield starts on the bubble's own timeline end.
      if (kind === "trap" && (reason === "expired" || reason === "escaped"))
        this.escapeShieldEndMs = effect.endMs + effect.escapeImmunityMs;
    }
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
