import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  admitMovingObstacle, MovingObstacleAnimator, obstacleBoundsRadius,
  obstacleTriangleCenter, obstacleTriangleNormal, transformObstaclePoint,
  type MovingObstacleObject, type ObstacleTrackNode,
} from "./moving-obstacle";
import { isTrackPrs, validatePrs } from "./track-prs-animation";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseObstacle() {
  const source = await readFile(releaseFile, "utf8");
  const start = source.indexOf("class NW {");
  const end = source.indexOf("\nconst HW =", start);
  assert.ok(start >= 0 && end > start);
  return new Function("P6", "Nm", `${source.slice(start, end)}
    return { NW, Um, OW, e3, $W, WW };`)(isTrackPrs, validatePrs) as {
    NW: typeof MovingObstacleAnimator;
    Um: typeof admitMovingObstacle;
    OW: typeof obstacleBoundsRadius;
    e3: typeof transformObstaclePoint;
    $W: typeof obstacleTriangleNormal;
    WW: typeof obstacleTriangleCenter;
  };
}

function property(name: string, children: Array<{ name: string;
  attributes: Array<{ name: string; value: string }> }> = [],
  attributes: Array<{ name: string; value: string }> = []) {
  return { name, attributes, children: children.map(child =>
    ({ ...child, children: [] })) };
}

function node(className: string, extras: Partial<ObstacleTrackNode> = {}): ObstacleTrackNode {
  return { kind: "node", name: className, className, children: [],
    slotOccurrences: [], ...extras };
}

function fixture(className: "ReTriList" | "ReTriStrip" = "ReTriList",
  cull = 2): MovingObstacleObject {
  const mesh = node(className, {
    slotOccurrences: [undefined, undefined, undefined, undefined,
      { value: { kind: "backface", cull } }],
    vertexData: { positions: [[0, 0, 0], [1, 0, 0], [0, 0, 1],
      [1, 0, 1]], indices: className === "ReTriList"
      ? [0, 1, 2, 1, 3, 2] : [0, 1, 2, 3] },
  });
  const root = node("Relement", { children: [mesh], additionalProperty:
    property("extra", [property("ob", []), property("press", []),
      property("gravity", [])]) });
  return { object: root,
    property: property("root", [{ name: "object\0padding", attributes: [
      { name: "type\0padding", value: "obstacle\0padding" },
      { name: "velFactor", value: "2.25" },
    ] }]) };
}

function simplify(admission: ReturnType<typeof admitMovingObstacle>) {
  if (admission.status === "block") return admission;
  return { status: admission.status, hasPrs: admission.hasPrs,
    pressMode: admission.pressMode,
    collisionTriangleCount: admission.collisionTriangleCount,
    markerProfile: admission.markerProfile,
    velFactor: admission.animator.velFactor,
    bindings: admission.animator.bindings.map(binding => ({
      className: binding.node.className, localA: binding.localA,
      localB: binding.localB, localC: binding.localC,
      normal: binding.normal, motion: binding.motion,
    })) };
}

test("障碍物准入、三角形方向、标记和错误原因与发行版一致", async () => {
  const original = await releaseObstacle();
  const cases = [fixture(), fixture("ReTriList", 3), fixture("ReTriStrip"),
    fixture("ReTriStrip", 3)];
  const notObstacle = fixture();
  notObstacle.property!.children[0]!.attributes[0]!.value = "scenery";
  cases.push(notObstacle);
  const badVelocity = fixture();
  badVelocity.property!.children[0]!.attributes[1]!.value = "NaN";
  cases.push(badVelocity);
  const missingPositions = fixture();
  missingPositions.object.children[0]!.vertexData = undefined;
  cases.push(missingPositions);
  const badIndex = fixture();
  badIndex.object.children[0]!.vertexData!.indices[0] = 99;
  cases.push(badIndex);
  const badPrs = fixture();
  badPrs.object.slotOccurrences[1] = { value: { kind: "unknown" } };
  cases.push(badPrs);
  for (const entry of cases) {
    const actual = admitMovingObstacle(structuredClone(entry));
    const expected = original.Um(structuredClone(entry));
    assert.deepEqual(simplify(actual), simplify(expected),
      `class=${entry.object.children[0]?.className}`);
  }
});

test("移动障碍物的 world matrix、节流、速度及缓存与发行版一致", async () => {
  const original = await releaseObstacle();
  const first = fixture();
  const oldResult = original.Um(structuredClone(first));
  const newResult = admitMovingObstacle(structuredClone(first));
  assert.equal(oldResult.status, "admit");
  assert.equal(newResult.status, "admit");
  if (oldResult.status !== "admit" || newResult.status !== "admit") return;
  const oldAnimator = oldResult.animator;
  const newAnimator = newResult.animator;
  const bounds = { kind: "ordinary" as const,
    min: [-2, -3, -4], max: [2, 3, 4] };
  const matrix = (tx: number) => [1, 0, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, tx, 0, 0, 1];
  for (const [time, x, camera] of [
    [1000, 0, undefined],
    [1200, 2, { x: 1000, y: 0, z: 0 }],
    [1400, 4, { x: 1000, y: 0, z: 0 }],
    [1600, 8, { x: 0, y: 0, z: 0 }],
  ] as const) {
    const oldTriangles = oldAnimator.update(time,
      () => matrix(x), () => bounds, camera);
    const newTriangles = newAnimator.update(time,
      () => matrix(x), () => bounds, camera);
    assert.deepEqual(newTriangles, oldTriangles, `time=${time}`);
    assert.deepEqual(newAnimator.registrationCenter(),
      oldAnimator.registrationCenter());
    assert.deepEqual(newAnimator.modelRadius(), oldAnimator.modelRadius());
    assert.deepEqual(newAnimator.updateSnapshot(), oldAnimator.updateSnapshot());
    assert.equal(newAnimator.lastUpdateMs, oldAnimator.lastUpdateMs);
  }
  for (const animator of [oldAnimator, newAnimator]) {
    assert.throws(() => animator.update(1700, () => undefined,
      () => undefined), /bounds/);
    assert.throws(() => animator.update(1700, () => undefined,
      () => bounds), /matrix/);
  }
});

test("障碍物单精度数学函数与发行版逐值一致", async () => {
  const original = await releaseObstacle();
  const points = [[0.2, -0.4, 1.1], [2.25, 1.5, -3.75],
    [-0.1, 4.5, 2.125]];
  const matrix = [1.125, 0.125, 0.25, 0, -0.25, 1.5, 0.5, 0,
    0.5, -0.75, 2, 0, 3.25, -4.5, 5.75, 1];
  const expected = points.map(point => original.e3(point, matrix));
  const actual = points.map(point => transformObstaclePoint(point, matrix));
  assert.deepEqual(actual, expected);
  assert.deepEqual(obstacleTriangleNormal(...actual as [typeof actual[0],
    typeof actual[0], typeof actual[0]]), original.$W(...expected as
      [typeof expected[0], typeof expected[0], typeof expected[0]]));
  assert.deepEqual(obstacleTriangleCenter(...actual as [typeof actual[0],
    typeof actual[0], typeof actual[0]]), original.WW(...expected as
      [typeof expected[0], typeof expected[0], typeof expected[0]]));
  for (const bounds of [
    { kind: "ordinary" as const, min: [-2.5, 0.1, -8],
      max: [3.1, 3.25, 0.4] },
    { kind: "canonical" as const }, { kind: "invalid" as const },
    { kind: "non-finite" as const },
  ]) assert.deepEqual(obstacleBoundsRadius(bounds), original.OW(bounds));
});
