import { EventCollisionLatch, type TrackEventProjection } from "./event-collision-latch";

export interface EventEffect {
  tickMs: number;
  [key: string]: unknown;
}

export interface EventProjection extends TrackEventProjection {
  renderRoot: unknown;
  effect?: EventEffect;
}

export interface EventAnimator<Position, Transform> {
  shouldThrottle(nowMs: number, kartPosition: Position | undefined): boolean;
  update(nowMs: number, transform: Transform): void;
  isInsideRegistrationRadius(position: Position): boolean;
  firstOverlap(hitbox: unknown): boolean;
  reset(): void;
}

export interface EventOwnerOps<Position, Transform> {
  createAnimator(root: unknown, projection: EventProjection): EventAnimator<Position, Transform>;
  copyPosition(position: Position): Position;
}

/** A moving track event, including its collision latch and effect cooldown. */
export class TrackEventOwner<Position, Transform> {
  projection: EventProjection;
  state: EventCollisionLatch;
  animator: EventAnimator<Position, Transform>;
  cachedKartPosition: Position | undefined;
  effectTimesMs: number[] = [];
  #ops: EventOwnerOps<Position, Transform>;

  constructor(projection: EventProjection, ops: EventOwnerOps<Position, Transform>) {
    this.projection = projection;
    this.state = new EventCollisionLatch(projection);
    this.animator = ops.createAnimator(projection.renderRoot, projection);
    this.#ops = ops;
  }

  slot12(nowMs: number, transform: Transform): string {
    const throttled = this.animator.shouldThrottle(nowMs, this.cachedKartPosition);
    const result = this.state.slot21(nowMs, throttled);
    if (!throttled) this.animator.update(nowMs, transform);
    return result;
  }

  registerKartPair(position: Position): boolean {
    this.cachedKartPosition = this.#ops.copyPosition(position);
    return this.animator.isInsideRegistrationRadius(position);
  }

  firstOverlap(hitbox: unknown, nowMs: number) {
    if (!this.state.isCollisionReady() || !this.animator.firstOverlap(hitbox)) return;
    const hit = this.state.firstOverlap();
    return hit?.effect
      ? { ...hit, effect: this.consumeEffect(hit.effect as EventEffect, nowMs) }
      : hit;
  }

  expireEffects(nowMs: number): EventEffect[] {
    const effect = this.projection.effect;
    if (!effect) return [];
    const now = Math.trunc(nowMs) >>> 0;
    const expired: EventEffect[] = [];
    this.effectTimesMs = this.effectTimesMs.filter(start => {
      if (now <= (start + effect.tickMs) >>> 0) return true;
      expired.push(effect);
      return false;
    });
    return expired;
  }

  reset(): void {
    this.state = new EventCollisionLatch(this.projection);
    this.cachedKartPosition = undefined;
    this.effectTimesMs = [];
    this.animator.reset();
  }

  consumeEffect(effect: EventEffect, nowMs: number): EventEffect | undefined {
    const now = Math.trunc(nowMs) >>> 0;
    const duration = Math.trunc(effect.tickMs) >>> 0;
    if (!this.effectTimesMs.some(start => ((now - start) >>> 0) < duration)) {
      this.effectTimesMs.push(now);
      return effect;
    }
  }
}
