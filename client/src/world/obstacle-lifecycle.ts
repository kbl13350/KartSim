import { ObstacleSurface, type ObstacleTriangle } from "./obstacle-surface";
import type { Vec3 } from "./route";

const f32 = Math.fround;

export interface ObstacleAnimator {
  update(timeMs: number, worldElements: unknown, worldBounds: unknown,
    pairedPosition?: Vec3): void;
  registrationCenter(): Vec3;
  modelRadius(): number;
  updateSnapshot(): ObstacleTriangle[];
}

export interface WorldObstacleHost {
  data: { resourceVersion: string; obstacleAnimators?: readonly ObstacleAnimator[] };
  obstacleClientWorldElements?: unknown;
  obstacleClientWorldBounds?: unknown;
  obstacleKartPaired: boolean;
  obstacleKartPairs: WeakSet<ObstacleAnimator>;
  pendingObstacleTriangles?: ObstacleTriangle[];
  obstacleSurface?: ObstacleSurface;
  triangleObbQuery: (triangle: ObstacleTriangle, box: unknown) => boolean;
}

export function updateWorldObstacles(world: WorldObstacleHost,
  timeMs: number, pairedPosition: Vec3): void {
  const animators = world.data.obstacleAnimators;
  if (!animators?.length) return;
  world.pendingObstacleTriangles = undefined;
  for (const animator of animators) {
    const paired = world.data.resourceVersion === "p3553" ?
      world.obstacleKartPairs.has(animator) : world.obstacleKartPaired;
    animator.update(timeMs, world.obstacleClientWorldElements,
      world.obstacleClientWorldBounds, paired ? pairedPosition : undefined);
  }
}

/** Captures at most eight nearby animator triangle sets for the next frame. */
export function registerWorldObstaclePair(world: WorldObstacleHost,
  position: Vec3): void {
  const animators = world.data.obstacleAnimators;
  if (!animators?.length) return;
  world.obstacleKartPaired = true;
  const pending: ObstacleTriangle[] = [];
  let registered = 0;
  for (const animator of animators) {
    if (world.data.resourceVersion === "p3553") {
      world.obstacleKartPairs.add(animator);
    } else if (registered >= 8) break;
    const center = animator.registrationCenter();
    const radius = f32(animator.modelRadius() * 4);
    const dx = f32(center.x - position.x);
    const dy = f32(center.y - position.y);
    const dz = f32(center.z - position.z);
    const distanceSquared = f32(f32(f32(dx * dx) + f32(dz * dz)) + f32(dy * dy));
    if (distanceSquared < f32(radius * radius) && registered < 8) {
      pending.push(...animator.updateSnapshot());
      registered += 1;
    }
  }
  world.pendingObstacleTriangles = pending;
}

export function commitWorldObstacleSnapshot(world: WorldObstacleHost): void {
  if (!world.data.obstacleAnimators?.length) return;
  world.obstacleSurface = world.pendingObstacleTriangles?.length ?
    new ObstacleSurface(world.pendingObstacleTriangles, world.triangleObbQuery,
      world.data.resourceVersion === "p3553") : undefined;
  world.pendingObstacleTriangles = undefined;
}
