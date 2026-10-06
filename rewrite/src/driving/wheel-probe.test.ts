import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  probeVehicleWheels,
  type WheelProbeContext,
  type WheelProbeTrack,
  type WheelRayHit,
} from "./wheel-probe";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  probeWheels(", classStart);
const end = release.indexOf("  applySupplementalWheelRecovery(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function Ri("), release.indexOf("function TW(")),
  release.slice(release.indexOf("function O9("), release.indexOf("function qt(")),
  release.slice(release.indexOf("function a1("), release.indexOf("function hd(")),
  release.slice(release.indexOf("function c9("), release.indexOf("function bt(")),
  release.slice(release.indexOf("function wi("), release.indexOf("function ii0(")),
  release.slice(release.indexOf("function V9("), release.indexOf("function d1(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
  release.slice(release.indexOf("function wd("), release.indexOf("const w0 =")),
].join("\n");
const OriginalProbe = new Function("m", `${helpers}
const od=[[1,1],[-1,1],[1,-1],[-1,-1]],x5=m(0.5),ad={x:0,y:1,z:0};
return class OriginalProbe { ${method} };`)(Math.fround) as new () => {
  probeWheels(this: WheelProbeContext, track: WheelProbeTrack, roadOnly: boolean): void;
};
const original = new OriginalProbe();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
type Scenario = WheelProbeContext & { calls: string[] };
function scenario(): Scenario {
  const calls: string[] = [];
  return {
    calls,
    runtime: {
      contactWorking: false, mrContact: false, hwContact: false,
      contactRisingEdge: false, landingMotionTrigger: false,
      shockWaveRequest: false, freeOrientationLatch: true,
    },
    wheels: {
      compression: [0.1, 0.2, 0.3, 0.4], compressionDelta: [1, 1, 1, 1],
      hit: [true, true, true, true], normals: [vector(), vector(), vector(), vector()],
      zeroNormals: [vector(), vector(), vector(), vector()],
      averageNormal: vector(9, 9, 9), grounded: true,
      roadDescriptor: { road: { attributes: [] } },
      railContactDescriptor: { road: { attributes: [] } },
      auxiliaryDirection: vector(7, 8, 9), obstacleRayHit: true,
      surfaceVelocity: vector(1, 2, 3),
    },
    scratch: {
      oldCompression: [0, 0, 0, 0], v0: vector(), v1: vector(), v2: vector(),
      v3: vector(), v4: vector(),
      zeroNormals: [vector(8, 8, 8), vector(8, 8, 8), vector(8, 8, 8), vector(8, 8, 8)],
    },
    body: {
      position: vector(1.2, 0.6, 3.1), right: vector(0.96, 0.2, 0),
      forward: vector(0.1, 0, 0.98), up: vector(0.1, 0.97, -0.1),
    },
    collisionShape: {
      scaleX: 1, scaleY: 1, rawHeight: 1,
      rawHalfWidth: 0.8, rawHalfLength: 1.1,
    },
    tuning: { wheelPosition: 0.81 },
    visualScaleMode() { calls.push("scale"); return 0; },
  };
}

function hit(
  pointY: number,
  rail = false,
  obstacleSource = false,
): WheelRayHit {
  return {
    normal: vector(0.1, 0.97, -0.2), point: vector(1, pointY, 3),
    auxiliaryDirection: vector(0.4, 0.5, 0.6),
    surfaceVelocity: vector(0.1, 0.2, 0.3), obstacleSource,
    roadDescriptor: { road: { attributes: rail ? [{ name: "rail", value: "R" }] : [] } },
  };
}

function snapshot(state: Scenario): unknown {
  const { visualScaleMode: _callback, ...rest } = state;
  return rest;
}

function compare(
  label: string,
  hits: Array<WheelRayHit | undefined>,
  edit: (vehicle: Scenario) => void = () => {},
): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  const expectedRays: unknown[] = [];
  const actualRays: unknown[] = [];
  const trackFor = (rays: unknown[]): WheelProbeTrack => ({
    rayQuery(origin, direction, includeRoad) {
      rays.push({ origin: { ...origin }, direction: { ...direction }, includeRoad });
      return hits[rays.length - 1];
    },
  });
  original.probeWheels.call(expected, trackFor(expectedRays), true);
  probeVehicleWheels(actual, trackFor(actualRays), true);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
  assert.deepEqual(actualRays, expectedRays, `${label}: rays`);
}

test("four-wheel contact probing matches the released vehicle", () => {
  compare("no hits", []);
  compare("one hit", [hit(0.8)]);
  compare("two staggered hits", [undefined, hit(1.1), undefined, hit(0.3)]);
  compare("four hits with rail", [hit(0.4), hit(0.5, true), hit(1.7), hit(0.1, false, true)]);
  compare("already grounded", [hit(0.8)], state => { state.runtime.contactWorking = true; });
  compare("special contact flips road-only ray", [hit(0.8)], state => {
    state.runtime.hwContact = true;
  });
  compare("scaled body, giant presentation", [hit(0.8), hit(1.1)], state => {
    state.collisionShape.scaleY = 1.4;
    state.visualScaleMode = () => { state.calls.push("scale"); return 1; };
  });
});
