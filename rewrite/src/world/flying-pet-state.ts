const f32 = Math.fround;

const IDLE_MOTIONS = [
  { motion: 0, min: 2, max: 5, restore: false, carry: false },
  { motion: 1, min: 2, max: 5, restore: true, carry: false },
  { motion: 21, min: 2, max: 5, restore: true, carry: false },
  { motion: 20, min: 10, max: 60, restore: true, carry: true },
  { motion: 8, min: 1, max: 4, restore: false, carry: false },
  { motion: 6, min: 2, max: 5, restore: true, carry: false },
  { motion: 5, min: 2, max: 5, restore: true, carry: false },
  { motion: 7, min: 2, max: 5, restore: true, carry: false },
];

export const FLYING_PET_RACE_MOTIONS = IDLE_MOTIONS.map(motion => motion.motion);

function nextMotion(random: number): number {
  return Math.max(0, Math.ceil((random % 80) / 10) - 1);
}

export class FlyingPetIdleMotion {
  next = 0;
  remaining = 0;

  constructor(
    readonly clips: Map<number, { header: number[] }>,
    readonly animation: { bind(clip: unknown, blendIn: number, restore: boolean,
      blendOut: number, carry: number): void },
    readonly random: { next(): number },
  ) {}

  reset(): void { this.next = this.remaining = 0; }

  update(elapsed: number): void {
    if (elapsed < this.remaining) {
      this.remaining -= elapsed;
      return;
    }
    const motion = IDLE_MOTIONS[this.next]!;
    this.next = nextMotion(this.random.next());
    const clip = this.clips.get(motion.motion);
    if (!clip) throw new Error("飞宠闲置动作未预载。");
    this.animation.bind(clip, 300, motion.restore, 300,
      motion.carry ? this.remaining : 0);
    this.remaining = Math.imul(
      (this.random.next() % (motion.max - motion.min)) + motion.min,
      clip.header[2]!,
    ) >>> 0;
  }
}

function subtract(left: number[], right: number[]): number[] {
  return left.map((value, index) => f32(value - right[index]!));
}

function dot(left: number[], right: number[]): number {
  return f32(f32(f32(left[0]! * right[0]!) + f32(left[1]! * right[1]!)) +
    f32(left[2]! * right[2]!));
}

/** Release spring integrator for a pet following its kart's head socket. */
export function advanceFlyingPetSpring(
  position: number[], velocity: number[], target: number[], elapsed: number,
): boolean {
  const step = Math.min(f32(0.05), f32(f32(elapsed >>> 0) * f32(0.001)));
  const delta = subtract(position, target);
  const radius = f32(Math.sqrt(dot(delta, delta)));
  if (radius === 0) return false;
  const spring = f32(350 * radius);
  const damping = f32(f32(dot(velocity, delta) * 2) / radius);
  for (let axis = 0; axis < 3; axis += 1) {
    const acceleration = f32(f32(-f32(spring + damping) * delta[axis]!) / radius);
    const force = f32(acceleration - f32(velocity[axis]! * 11));
    velocity[axis] = f32(velocity[axis]! + f32(force * step));
    position[axis] = f32(position[axis]! + f32(velocity[axis]! * step));
  }
  return true;
}

export class FlyingPetRaceState {
  local = [f32(0.59), -0.75, 0.5];
  secondLocal = [0.75, 0.75, 0.5];
  position = [0, 0, 0];
  velocity = [0, 0, 0];
  previous = 0;
  remaining = 0;
  following = false;
  launched = false;
  firstVisible = true;
  secondVisible = false;
  firedVisible = false;
  aliveVisible = false;
  firedStart = 0;
  aliveStart = 0;
  counter = 0;
  aliveDue = 0;
  showDue = 0;
  clearDue = 0;

  launch(): void {
    if (this.launched) return;
    this.launched = true;
    this.remaining = 400;
    this.firstVisible = false;
    this.secondLocal = [...this.local];
    this.disable();
  }

  disable(): void {
    if (!this.launched) return;
    this.counter += 1;
    this.secondVisible = this.aliveVisible = false;
    this.firedVisible = true;
    this.firedStart = this.previous;
  }

  enable(): void {
    if (!this.launched) return;
    if (this.counter > 0) this.counter -= 1;
    this.aliveDue = (Math.imul(this.counter, 700) + this.previous) >>> 0;
  }

  update(now: number, matrix: number[], ancestorScale: number[],
    idle: (elapsed: number) => void): boolean {
    now >>>= 0;
    if (!this.previous) this.previous = now;
    const elapsed = (now - this.previous) >>> 0;
    if (this.remaining) {
      if (elapsed < this.remaining) {
        this.remaining -= elapsed;
      } else {
        this.remaining = 0;
        this.local[1] = f32(this.local[1]! + 1.5);
        this.position = [f32(matrix[12]!), f32(matrix[13]! + 1.5), f32(matrix[14]!)];
        this.enable();
        this.following = true;
      }
    } else {
      idle(elapsed);
    }

    if (this.following) {
      if (!(this.previous < now)) return false;
      const target = [f32(matrix[12]!), f32(matrix[13]! + 1.5), f32(matrix[14]!)];
      if (!advanceFlyingPetSpring(this.position, this.velocity, target, elapsed)) return false;
      const offset = subtract(this.position, target);
      this.secondLocal = [0, 1, 2].map(axis => {
        const scale = ancestorScale[axis]!;
        if (!Number.isFinite(scale) || scale === 0)
          throw new Error("飞宠祖父缩放无效。");
        const row = [0, 1, 2].map(column =>
          f32(f32(matrix[axis * 4 + column]!) * f32(1 / scale)));
        return f32(dot(row, offset) + this.local[axis]!);
      });
    }

    let becameAlive = false;
    if (this.aliveDue && ((now - this.aliveDue) >>> 0) > 500) {
      this.aliveDue = 0;
      this.firedVisible = false;
      this.aliveVisible = true;
      this.aliveStart = now;
      this.showDue = this.clearDue = now;
      becameAlive = true;
    }
    if (this.showDue && ((now - this.showDue) >>> 0) > 166) {
      this.secondVisible = true;
      this.showDue = 0;
    }
    if (this.clearDue && ((now - this.clearDue) >>> 0) > 766) {
      this.clearDue = this.counter = 0;
      this.aliveVisible = this.firedVisible = false;
    }
    this.previous = now;
    return becameAlive;
  }
}

export function visibleFlyingPet(role: string, localVisible: boolean): boolean {
  return role === "local" && localVisible;
}
