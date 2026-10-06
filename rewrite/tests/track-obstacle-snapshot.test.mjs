import assert from "node:assert/strict";
import { test } from "node:test";
import { ObstacleSurface } from "../src/world/obstacle-surface.ts";
import { commitObstacleSnapshot } from "../src/world/track-obstacle-snapshot.ts";

test("obstacle snapshots commit only when track animators exist", () => {
  const triangle = {
    a: { x: 0, y: 0, z: 0 },
    b: { x: 1, y: 0, z: 0 },
    c: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: 1, z: 0 },
  };
  const query = () => true;
  const host = {
    data: { obstacleAnimators: [] },
    pendingObstacleTriangles: [triangle],
    triangleObbQuery: query,
    obstacleSurface: undefined,
  };
  commitObstacleSnapshot(host, query);
  assert.equal(host.pendingObstacleTriangles.length, 1);
  assert.equal(host.obstacleSurface, undefined);

  host.data.obstacleAnimators.push({});
  commitObstacleSnapshot(host, query);
  assert.ok(host.obstacleSurface instanceof ObstacleSurface);
  assert.equal(host.obstacleSurface.triangles[0], triangle);
  assert.equal(host.pendingObstacleTriangles, undefined);

  commitObstacleSnapshot(host, query);
  assert.equal(host.obstacleSurface, undefined);
});
