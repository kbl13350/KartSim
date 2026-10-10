import type { Vec3 } from "./route";

export interface RaySurface<Hit> {
  queryBest(origin: Vec3, movement: Vec3, includeWalls: boolean): number;
  buildHit(origin: Vec3, movement: Vec3, fraction: number): Hit;
}

export interface ObbSurface<Hit> {
  queryObb(box: unknown): Hit[] | undefined;
}

export interface TrackCollisionHost<RayHit = unknown, ObbHit = unknown> {
  surface: RaySurface<RayHit> & ObbSurface<ObbHit>;
  movingSurface?: RaySurface<RayHit> & ObbSurface<ObbHit>;
  obstacleSurface?: RaySurface<RayHit> & ObbSurface<ObbHit>;
}

/** The original tie rule gives moving roads precedence over static roads. */
export function queryTrackRay<RayHit>(
  world: TrackCollisionHost<RayHit>, origin: Vec3, movement: Vec3,
  includeWalls: boolean,
): RayHit | undefined {
  const moving = world.movingSurface;
  const movingFraction = moving === undefined ? Number.POSITIVE_INFINITY :
    moving.queryBest(origin, movement, includeWalls);
  const staticFraction = world.surface.queryBest(origin, movement, includeWalls);
  const staticWins = moving === undefined || staticFraction < movingFraction;
  const roadFraction = staticWins ? staticFraction : movingFraction;
  const obstacle = world.obstacleSurface;
  const obstacleFraction = obstacle === undefined ? Number.POSITIVE_INFINITY :
    obstacle.queryBest(origin, movement, includeWalls);
  if (roadFraction === Number.POSITIVE_INFINITY || obstacleFraction < roadFraction) {
    return obstacle === undefined || obstacleFraction === Number.POSITIVE_INFINITY ? undefined :
      obstacle.buildHit(origin, movement, obstacleFraction);
  }
  return staticWins ? world.surface.buildHit(origin, movement, staticFraction) :
    moving!.buildHit(origin, movement, movingFraction);
}

export function queryTrackObb<ObbHit>(world: TrackCollisionHost<unknown, ObbHit>,
  box: unknown): ObbHit[] {
  return [
    ...(world.movingSurface?.queryObb(box) ?? []),
    ...world.surface.queryObb(box)!,
  ];
}

export function queryObstacleObb<ObbHit>(world: TrackCollisionHost<unknown, ObbHit>,
  box: unknown): ObbHit[] {
  return world.obstacleSurface?.queryObb(box) ?? [];
}
