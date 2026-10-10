export interface TetherParameters {
  pos: [number, number, number] | number[];
  wireLengthLimit: number;
  floatingForce: number;
  viscousDrag: number;
}

/** Twelve entries of a row-major affine transform. */
export type Affine3x4 = readonly number[];

const f32 = Math.fround;
const MAX_FRAME_SECONDS = 0.05;
const SUBSTEP_SECONDS = 0.01;
const MASS = 1;
const MILLISECONDS_TO_SECONDS = f32(0.001);

function transformPoint(matrix: Affine3x4, row: number, point: readonly number[]): number {
  const offset = row * 4;
  return f32(f32(f32(f32(matrix[offset]! * point[0]!)
    + f32(matrix[offset + 1]! * point[1]!))
    + f32(matrix[offset + 2]! * point[2]!))
    + matrix[offset + 3]!);
}

/** Spring-like decoration movement attached to a kart, matching the released H10. */
export class TetherMotion {
  anchorPoint: number[];
  restLength: number;
  wireLengthLimit: number;
  floatingForce: number;
  viscousDrag: number;
  initialLocal: number[];
  world = [0, 0, 0];
  velocity = [0, 0, 0];
  output = [0, 0, 0];
  recentFrameSeconds: number[] = [];
  lastTime = 0;

  constructor(parameters: TetherParameters) {
    this.anchorPoint = [parameters.pos[0]!, parameters.pos[1]!, 0];
    this.restLength = parameters.pos[2]!;
    this.wireLengthLimit = parameters.wireLengthLimit;
    this.floatingForce = parameters.floatingForce;
    this.viscousDrag = parameters.viscousDrag;
    this.initialLocal = [parameters.pos[0]!, parameters.pos[1]!, parameters.pos[2]!];
  }

  reset(): number[] {
    this.lastTime = 0;
    this.recentFrameSeconds.length = 0;
    this.world[0] = 0; this.world[1] = 0; this.world[2] = 0;
    this.velocity[0] = 0; this.velocity[1] = 0; this.velocity[2] = 0;
    return this.initialLocal;
  }

  update(transform: Affine3x4, localPosition: number[], nowMs: number): number[] {
    const now = nowMs >>> 0;
    if (this.lastTime !== 0) {
      if (this.lastTime < now) {
        const elapsed = this.filterHitch(f32(f32((now - this.lastTime) >>> 0) * MILLISECONDS_TO_SECONDS));
        const local = this.integrate(transform, elapsed);
        this.lastTime = now;
        return local;
      }
      return localPosition;
    }
    this.world[0] = transformPoint(transform, 0, localPosition);
    this.world[1] = transformPoint(transform, 1, localPosition);
    this.world[2] = transformPoint(transform, 2, localPosition);
    this.velocity[0] = 0; this.velocity[1] = 0; this.velocity[2] = 0;
    this.lastTime = now;
    return localPosition;
  }

  filterHitch(seconds: number): number {
    this.recentFrameSeconds.push(seconds);
    if (this.recentFrameSeconds.length > 30) this.recentFrameSeconds.shift();
    const sorted = [...this.recentFrameSeconds].sort((left, right) => left - right);
    const median = sorted[sorted.length >> 1]!;
    return seconds > median * 4 + 0.004 ? median : seconds;
  }

  integrate(transform: Affine3x4, seconds: number): number[] {
    const anchor = [
      transformPoint(transform, 0, this.anchorPoint),
      transformPoint(transform, 1, this.anchorPoint),
      transformPoint(transform, 2, this.anchorPoint),
    ];
    let remaining = Math.min(seconds, MAX_FRAME_SECONDS);
    while (remaining > 0) {
      const step = Math.min(remaining, SUBSTEP_SECONDS);
      remaining = f32(remaining - step);
      this.substep(anchor, step);
    }
    const dx = f32(this.world[0]! - transform[3]!);
    const dy = f32(this.world[1]! - transform[7]!);
    const dz = f32(this.world[2]! - transform[11]!);
    this.output[0] = f32(f32(f32(dy * transform[4]!) + f32(dx * transform[0]!)) + f32(dz * transform[8]!));
    this.output[1] = f32(f32(f32(dy * transform[5]!) + f32(dx * transform[1]!)) + f32(dz * transform[9]!));
    this.output[2] = f32(f32(f32(dy * transform[6]!) + f32(dx * transform[2]!)) + f32(dz * transform[10]!));
    return this.output;
  }

  substep(anchor: readonly number[], seconds: number): void {
    const rest = this.restLength;
    const diameter = f32(rest + rest);
    const dx = f32(this.world[0]! - anchor[0]!);
    const dy = f32(this.world[1]! - anchor[1]!);
    const dz = f32(this.world[2]! - anchor[2]!);
    const distance = f32(Math.sqrt(f32(f32(f32(dx * dx) + f32(dy * dy)) + f32(dz * dz))));
    const reciprocal = f32(1 / distance);
    let offsetX = dx, offsetY = dy, offsetZ = dz;
    let forceScale = reciprocal;
    if (distance >= diameter) {
      const projectedX = f32(f32(dx * reciprocal) * rest);
      const projectedY = f32(f32(dy * reciprocal) * rest);
      const projectedZ = f32(f32(dz * reciprocal) * rest);
      offsetX = f32(projectedX + projectedX);
      offsetY = f32(projectedY + projectedY);
      offsetZ = f32(projectedZ + projectedZ);
      this.world[0] = f32(anchor[0]! + offsetX);
      this.world[1] = f32(anchor[1]! + offsetY);
      this.world[2] = f32(anchor[2]! + offsetZ);
      forceScale = f32(1 / diameter);
    }
    const constrainedDistance = distance >= diameter ? diameter : distance;
    let forceX = 0, forceY = 0, forceZ = 0;
    if (constrainedDistance >= rest) {
      let stretch = f32(Math.min(f32(this.wireLengthLimit * rest), constrainedDistance) - rest);
      if (diameter <= stretch) stretch = diameter;
      stretch = f32(stretch * -1000);
      forceX = f32(f32(offsetX * forceScale) * stretch);
      forceY = f32(f32(offsetY * forceScale) * stretch);
      forceZ = f32(f32(offsetZ * forceScale) * stretch);
    }
    const velocity = this.velocity;
    const nextX = f32(f32(f32(f32(forceX - f32(this.viscousDrag * velocity[0]!)) / MASS) * seconds) + velocity[0]!);
    const nextY = f32(f32(f32(f32(f32(forceY + this.floatingForce) - f32(this.viscousDrag * velocity[1]!)) / MASS) * seconds) + velocity[1]!);
    const nextZ = f32(f32(f32(f32(forceZ - f32(this.viscousDrag * velocity[2]!)) / MASS) * seconds) + velocity[2]!);
    velocity[0] = nextX; velocity[1] = nextY; velocity[2] = nextZ;
    this.world[0] = f32(f32(nextX * seconds) + this.world[0]!);
    this.world[1] = f32(f32(nextY * seconds) + this.world[1]!);
    this.world[2] = f32(f32(nextZ * seconds) + this.world[2]!);
  }
}
