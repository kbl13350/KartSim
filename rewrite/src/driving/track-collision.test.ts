import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveVehicleTrackCollision, resolveVehicleObstacleCollisions,
  applyHighContactAngularResponse, applyWallContactAngularResponse,
  type CollisionDrivingInput, type ObstacleCollision, type ObstacleCollisionContext,
  type TrackCollision } from "./track-collision";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const methodStart = release.indexOf("  resolvePrimaryCollision(", classStart);
const methodEnd = release.indexOf("  countOrdinaryResultCrash(", methodStart);
assert.ok(classStart > 0 && methodStart > classStart && methodEnd > methodStart);
const method = release.slice(methodStart, methodEnd);
const obstacleStart = release.indexOf("  resolveStaticObstacles(", methodEnd);
const obstacleEnd = release.indexOf("  resolveTrackEvents(", obstacleStart);
assert.ok(obstacleStart > methodEnd && obstacleEnd > obstacleStart);
const obstacleMethod = release.slice(obstacleStart, obstacleEnd);
const angularStart = release.indexOf("  applyHighObstacleAngularResponse(", obstacleEnd);
const angularEnd = release.indexOf("  applyCollisionDriftGaugePreserve(", angularStart);
assert.ok(angularStart > obstacleEnd && angularEnd > angularStart);
const angularMethods = release.slice(angularStart, angularEnd);
const vectorHelpers = release.slice(release.indexOf("function F2("), release.indexOf("function ai0("));
const mathHelpers = release.slice(release.indexOf("function JC("), release.indexOf("function vi("));
const clampHelper = release.slice(release.indexOf("function wd("), release.indexOf("const w0 ="));
const OriginalCollision = new Function("m", `${vectorHelpers}\n${mathHelpers}\n${clampHelper}\nreturn class OriginalCollision { ${method} ${obstacleMethod} ${angularMethods} };`)(
  Math.fround,
) as new () => {
  resolvePrimaryCollision(this: ObstacleCollisionContext,
    track: { queryObb(): TrackCollision[] }, input: CollisionDrivingInput): unknown;
  resolveStaticObstacles(this: ObstacleCollisionContext,
    track: { queryObstacleObb?(): ObstacleCollision[] }): boolean;
  applyHighObstacleAngularResponse(this: ObstacleCollisionContext, normal: ReturnType<typeof vector>): void;
  applyWallObstacleAngularResponse(this: ObstacleCollisionContext, normal: ReturnType<typeof vector>): void;
};
const original = new OriginalCollision();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
type Scenario = ObstacleCollisionContext & { calls: string[] };
function scenario(): Scenario {
  const calls: string[] = [];
  return {
    calls,
    giantObstacleLowHit: true,
    collisionShape: {
      rawHeight: 1.2, rawHalfWidth: 0.75, rawHalfLength: 1.3,
      scaleX: 1, scaleY: 1,
    },
    body: {
      position: vector(10, 2, 30), up: vector(0, 1, 0),
      right: vector(1, 0, 0), forward: vector(0, 0, -1),
      linearVelocity: vector(-4, 0, 1), angularVelocity: vector(0.1, 0.2, 0.3),
    },
    wheels: { grounded: true },
    scratch: {
      v0: vector(), obb: { center: vector(), axes: [], halfExtents: [0, 0, 0] },
      primaryResult: { responseHit: false, lowHit: false },
    },
    runtime: {
      steeringEnvelope: 0.5, mrContact: false, hwContact: false,
      collisionResponseMagnitudeB6C: 0, strongLateralCollision: false,
      collisionMotionHit: false, collisionMotionStrength: 0,
      collisionAudioStrength: 0, activeDrift: false,
      steeringCollisionAudioGain: 0,
      obstacleSuppressionLatch: false,
    },
    applyHighObstacleAngularResponse() { calls.push("high angular"); },
    captureRail() { calls.push("capture rail"); },
    countOrdinaryResultCrash() { calls.push("ordinary crash"); },
    applyCollisionDriftGaugePreserve() { calls.push("drift preserve"); },
    applyWallObstacleAngularResponse() { calls.push("wall angular"); },
    secondaryCollisionBox() { calls.push("secondary box"); return this.scratch.obb; },
    activateHardPress() { calls.push("hard press"); },
    visualScaleMode() { calls.push("visual scale"); return 0; },
    activateDirectionalPress(direction) { calls.push(`directional press ${direction}`); },
  };
}

function snapshot(state: Scenario): unknown {
  return {
    calls: state.calls, shape: state.collisionShape, body: state.body,
    wheels: state.wheels, scratch: state.scratch, runtime: state.runtime,
    giantObstacleLowHit: state.giantObstacleLowHit,
  };
}

function compare(label: string, hits: TrackCollision[],
  input: CollisionDrivingInput, edit: (state: Scenario) => void = () => {}): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  const expectedTrack = { queryObb: () => hits };
  const actualTrack = { queryObb: () => hits };
  const originalResult = original.resolvePrimaryCollision.call(expected, expectedTrack, input);
  const rewrittenResult = resolveVehicleTrackCollision(actual, actualTrack, input);
  assert.deepEqual(rewrittenResult, originalResult, `${label}: result`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
}

test("primary track collision normal, high, wall and steering impulses match release", () => {
  const neutral = { forward: 0, rawSteer: 0, steeringInverted: false };
  compare("no contacts", [], neutral);
  compare("departing contact", [{ normal: vector(1, 0, 0) }], neutral,
    (state) => { state.body.linearVelocity.x = 4; });
  compare("high contact", [{ normal: vector(0, 1, 0) }], neutral,
    (state) => { state.body.linearVelocity = vector(1, -5, 2); });
  compare("hover high contact", [{ normal: vector(1, 0, 0) }], neutral,
    (state) => { state.runtime.hwContact = true; });
  compare("ordinary wall", [{ normal: vector(1, 0, 0) }], neutral);
  compare("strong wall", [{ normal: vector(1, 0, 0) }], neutral,
    (state) => { state.body.linearVelocity.x = -15; });
  compare("steered wall", [{ normal: vector(1, 0, 0) }],
    { forward: 1, rawSteer: 1, steeringInverted: false });
  compare("inverted steering", [{ normal: vector(1, 0, 0) }],
    { forward: 1, rawSteer: -1, steeringInverted: true });
  compare("two contacts", [{ normal: vector(0, 1, 0) }, { normal: vector(1, 0, 0) }], neutral,
    (state) => { state.body.linearVelocity.y = -3; });
});

function compareObstacles(label: string, hits: ObstacleCollision[],
  edit: (state: Scenario) => void = () => {}): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  const expectedTrack = { queryObstacleObb: () => hits };
  const actualTrack = { queryObstacleObb: () => hits };
  const originalResult = original.resolveStaticObstacles.call(expected, expectedTrack);
  const rewrittenResult = resolveVehicleObstacleCollisions(actual, actualTrack);
  assert.equal(rewrittenResult, originalResult, `${label}: result`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
}

test("static obstacle rebounds and press patterns match release", () => {
  const obstacle = (normal = vector(1, 0, 0), motion = vector(),
    pressMode?: string): ObstacleCollision => ({ normal, motion, velFactor: 1, pressMode });
  compareObstacles("none", []);
  compareObstacles("suppressed", [obstacle()],
    (state) => { state.runtime.obstacleSuppressionLatch = true; });
  compareObstacles("ordinary wall", [obstacle()]);
  compareObstacles("moving into wall", [obstacle(vector(1, 0, 0), vector(-2, 0, 0))]);
  compareObstacles("relative motion", [obstacle(vector(1, 0, 0), vector(5, 0, 0))],
    (state) => { state.body.linearVelocity.x = 3; });
  compareObstacles("high obstacle", [obstacle(vector(0, 1, 0))],
    (state) => { state.body.linearVelocity.y = -5; });
  compareObstacles("hard stop", [obstacle(vector(1, 0, 0), vector(), "hard-stop")]);
  compareObstacles("directional pair", [
    obstacle(vector(0, 1, 0), vector(0, 0, 1), "directional"),
    obstacle(vector(0, 1, 0), vector(0, 0, -1), "directional"),
  ]);
  compareObstacles("vertical press", [
    obstacle(vector(0, 1, 0), vector(0, -60, 0), "directional"),
  ]);
});

test("high and lateral angular wall responses match release", () => {
  for (const [label, normal, edit] of [
    ["high flat", vector(0, 1, 0), () => {}],
    ["high tilt", vector(0.4, 0.8, 0.2), (state: Scenario) => {
      state.body.up = vector(0.2, 0.9, 0.1);
    }],
  ] as const) {
    const expected = scenario(); edit(expected);
    const actual = scenario(); edit(actual);
    original.applyHighObstacleAngularResponse.call(expected, normal);
    applyHighContactAngularResponse(actual, normal);
    assert.deepEqual(snapshot(actual), snapshot(expected), label);
  }
  for (const [label, normal, edit] of [
    ["right wall", vector(1, 0, 0), () => {}],
    ["front wall", vector(0, 0, 1), () => {}],
    ["yaw suppressed", vector(1, 0, 0), (state: Scenario) => {
      state.body.angularVelocity.y = 20;
    }],
  ] as const) {
    const expected = scenario(); edit(expected);
    const actual = scenario(); edit(actual);
    original.applyWallObstacleAngularResponse.call(expected, normal);
    applyWallContactAngularResponse(actual, normal);
    assert.deepEqual(snapshot(actual), snapshot(expected), label);
  }
});
