import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  scanSpecialRoadStrip,
  scanSpecialRoadSurfaces,
  type SpecialRoadContext,
  type SpecialRoadHit,
  type SpecialRoadTrack,
} from "./special-road";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  scanSpecialRoad(", classStart);
const end = release.indexOf("  probeWheels(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const methods = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function VG("), release.indexOf("function Ri(")),
  release.slice(release.indexOf("function F2("), release.indexOf("function qt(")),
  release.slice(release.indexOf("function c9("), release.indexOf("function bt(")),
  release.slice(release.indexOf("function wi("), release.indexOf("function ii0(")),
  release.slice(release.indexOf("function V9("), release.indexOf("function ri0(")),
  release.slice(release.indexOf("function si0("), release.indexOf("function oi0(")),
  release.slice(release.indexOf("function Tn("), release.indexOf("function XC(")),
  release.slice(release.indexOf("function Mt("), release.indexOf("function _n(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
].join("\n");
const Original = new Function("m", `${helpers}
const x5=m(0.5),cd=m(0.800000011920929),ld=m(-9.800000190734863);
const VC={x:0,y:m(-58.80000305175781),z:0};
return class Original { ${methods} };`)(Math.fround) as new () => {
  scanSpecialRoad(this: SpecialRoadContext, track: SpecialRoadTrack): void;
  scanSpecialRoadPrefix(this: SpecialRoadContext, track: SpecialRoadTrack,
    prefix: string, rayLength: number): boolean;
};
const original = new Original();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
type Scenario = SpecialRoadContext & { calls: string[] };
function scenario(released: boolean, speed = 70): Scenario {
  const calls: string[] = [];
  return {
    calls,
    body: {
      position: vector(4.1, 2.3, -7.2), right: vector(0.96, 0.07, 0.21),
      forward: vector(-0.2, 0.04, 0.96), up: vector(0.01, 0.99, -0.1),
    },
    wheels: {},
    runtime: {
      mrContact: false, hwContact: false, contactWorking: false,
      specialNormal: vector(3, 4, 5), gravity: vector(0, -58.8, 0),
      cachedDisplaySpeedKmh: speed,
    },
    scratch: {
      v0: vector(), v1: vector(), v2: vector(), v3: vector(),
      v4: vector(), v5: vector(), v6: vector(), v7: vector(),
      v8: vector(), v9: vector(), v10: vector(), v11: vector(),
    },
    collisionShape: { rawHalfWidth: 0.91, rawHalfLength: 1.42 },
    scanSpecialRoadPrefix(track, prefix, rayLength) {
      calls.push(prefix);
      return released
        ? original.scanSpecialRoadPrefix.call(this, track, prefix, rayLength)
        : scanSpecialRoadStrip(this, track, prefix, rayLength);
    },
  };
}

function snapshot(state: Scenario): unknown {
  const { scanSpecialRoadPrefix: _callback, ...rest } = state;
  return rest;
}

function hit(surface: string, normal = vector(0.1, 0.95, 0.2)): SpecialRoadHit {
  return {
    roadDescriptor: { road: { attributes: [{ name: "surface", value: surface }] } },
    normal,
  };
}

function compare(
  label: string,
  prefix: string,
  speed: number,
  initial: SpecialRoadHit | undefined,
  samples: Array<SpecialRoadHit | undefined>,
): void {
  const expected = scenario(true, speed), actual = scenario(false, speed);
  const expectedRays: unknown[] = [], actualRays: unknown[] = [];
  const trackFor = (rays: unknown[]): SpecialRoadTrack => ({
    rayQuery(origin, direction, includeRoad) {
      rays.push({ origin: { ...origin }, direction: { ...direction }, includeRoad });
      return rays.length === 1 ? initial : samples[(rays.length - 2) % Math.max(samples.length, 1)];
    },
  });
  const expectedResult = original.scanSpecialRoadPrefix.call(expected,
    trackFor(expectedRays), prefix, prefix === "MR" ? Math.fround(-2) : Math.fround(-10));
  const actualResult = scanSpecialRoadStrip(actual,
    trackFor(actualRays), prefix, prefix === "MR" ? Math.fround(-2) : Math.fround(-10));
  assert.equal(actualResult, expectedResult, `${label}: result`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
  assert.deepEqual(actualRays, expectedRays, `${label}: ray positions`);
}

test("MR and HW road strip sampling matches release geometry and physics", () => {
  compare("ordinary road", "MR", 70, hit("normal"), []);
  compare("missing road", "MR", 70, undefined, []);
  compare("MR high-density", "MR", 30, hit("MR01"), [hit("MR01"), undefined]);
  compare("MR mid-density", "MR", 75, hit("MR01"), [hit("MR01"), undefined]);
  compare("MR low-density", "MR", 150, hit("MR01"), [hit("MR01"), undefined]);
  compare("MR fastest", "MR", 210, hit("MR01"), [hit("MR01"), undefined]);
  compare("HW wall alignment", "HW", 75, hit("HW01"), [hit("HW01"), undefined]);
  compare("MR no sample hit", "MR", 75, hit("MR01"), []);
});

test("outer scan tries HW after MR fails", () => {
  const expected = scenario(true), actual = scenario(false);
  const expectedRays: unknown[] = [], actualRays: unknown[] = [];
  const trackFor = (rays: unknown[]): SpecialRoadTrack => ({
    rayQuery(origin, direction, includeRoad) {
      rays.push({ origin: { ...origin }, direction: { ...direction }, includeRoad });
      return undefined;
    },
  });
  original.scanSpecialRoad.call(expected, trackFor(expectedRays));
  scanSpecialRoadSurfaces(actual, trackFor(actualRays));
  assert.deepEqual(snapshot(actual), snapshot(expected));
  assert.deepEqual(actualRays, expectedRays);
  assert.deepEqual(actual.calls, ["MR", "HW"]);
});
