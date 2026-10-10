const float32 = Math.fround;
const dodgeForceMultiplier = 4;

export interface DodgeAction {
  kind: string;
  action: unknown;
}

export interface LteDodgeInputOps {
  positiveAction: unknown;
  negativeAction: unknown;
  lockMs: number;
}

/** A 600 ms lateral impulse, integrated at the game's 2 ms physics step. */
export class LteDodgeMotion {
  direction = 0;
  pending = false;
  elapsed = 0;
  disposed = false;
  interrupted = false;

  get active(): boolean { return this.direction !== 0; }

  begin(direction: number): boolean {
    if (this.disposed || this.active) return false;
    this.direction = direction;
    this.pending = true;
    this.elapsed = 0;
    return true;
  }

  step(stepSeconds: number, right: { x: number; y: number; z: number }, speed: number,
    impulse: number, slowed: boolean, velocity: { x: number; y: number; z: number }): void {
    if (this.disposed || !this.active) return;
    const step = float32(stepSeconds);
    if (!(step > 0) || step > float32(0.002))
      throw new Error("LTE 躲闪子步必须位于 (0, 2ms]。");
    if (![right.x, right.y, right.z, speed, impulse].every(Number.isFinite))
      throw new Error("LTE 躲闪缺少有限的同车物理参数。");
    if (this.pending) {
      this.pending = false;
      return;
    }
    const decay = float32(1 - float32(float32(this.elapsed / float32(0.6)) * float32(1.2)));
    this.elapsed = float32(this.elapsed + step);
    if (this.elapsed > float32(0.6)) {
      this.cancel();
      return;
    }
    const force = float32(float32(float32(speed * impulse) * float32(1.5)) * float32(dodgeForceMultiplier));
    const scaled = float32(float32(decay * force) * float32(slowed ? 0.05 : 1));
    const signed = float32(scaled * this.direction);
    velocity.x = float32(velocity.x + float32(right.x * signed));
    velocity.y = float32(velocity.y + float32(right.y * signed));
    velocity.z = float32(velocity.z + float32(right.z * signed));
  }

  cancel(): void {
    this.direction = 0;
    this.pending = false;
    this.elapsed = 0;
  }

  interrupt(): void {
    this.cancel();
    this.interrupted = true;
  }

  consumeInterrupted(): boolean {
    const interrupted = this.interrupted;
    this.interrupted = false;
    return interrupted;
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.interrupted = false;
    this.disposed = true;
  }
}

/** Input lock and race-availability owner for LTE dodge actions. */
export class LteDodgeInput {
  motion = new LteDodgeMotion();
  lockTick: number | undefined;
  disposed = false;

  constructor(private readonly ops: LteDodgeInputOps) {}

  dispatch(action: DodgeAction, nowMs: number, available: boolean): boolean {
    if (action.kind !== "unsupported-action" ||
      (action.action !== this.ops.positiveAction && action.action !== this.ops.negativeAction))
      return false;
    if (!this.disposed) {
      this.updateAvailability(available);
      if (available) this.start(action.action, nowMs);
    }
    return true;
  }

  update(nowMs: number, available: boolean): void {
    if (this.disposed) return;
    this.updateAvailability(available);
    if (this.lockTick !== undefined &&
      ((Math.trunc(nowMs) - this.lockTick) >>> 0) >= this.ops.lockMs)
      this.lockTick = undefined;
  }

  start(action: unknown, nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error("LTE 输入时钟无效。");
    const now = Math.trunc(nowMs) >>> 0;
    if (this.lockTick !== undefined && ((now - this.lockTick) >>> 0) < this.ops.lockMs)
      return;
    if (this.motion.begin(action === this.ops.positiveAction ? 1 : -1))
      this.lockTick = now;
  }

  updateAvailability(available: boolean): void {
    const interrupted = this.motion.consumeInterrupted();
    if (!available || interrupted) this.cancel();
  }

  cancel(): void {
    this.motion.cancel();
    this.lockTick = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
    this.motion.dispose();
  }
}
