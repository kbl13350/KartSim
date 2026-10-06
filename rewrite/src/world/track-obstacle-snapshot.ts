import { ObstacleSurface, type ObstacleTriangle, type TriangleObbQuery } from "./obstacle-surface";

export interface ObstacleSnapshotHost {
  data: { obstacleAnimators?: readonly unknown[] };
  pendingObstacleTriangles?: readonly ObstacleTriangle[];
  obstacleSurface?: ObstacleSurface;
  triangleObbQuery: TriangleObbQuery;
}

/** Commit the obstacle geometry captured during this simulation frame. */
export function commitObstacleSnapshot(host: ObstacleSnapshotHost,
  p3553ObbQuery: TriangleObbQuery): void {
  if (!host.data.obstacleAnimators?.length) return;
  host.obstacleSurface = host.pendingObstacleTriangles?.length
    ? new ObstacleSurface(host.pendingObstacleTriangles, host.triangleObbQuery, p3553ObbQuery)
    : undefined;
  host.pendingObstacleTriangles = undefined;
}
