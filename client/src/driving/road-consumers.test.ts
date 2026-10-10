import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyRoadSurfaceConsumers, type RoadConsumerContext } from "./road-consumers";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  applyRoadConsumers(", classStart);
const end = release.indexOf("  applySlipAlignment(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function VG("), release.indexOf("function Ri(")),
  release.slice(release.indexOf("function F2("), release.indexOf("function ai0(")),
  release.slice(release.indexOf("function Mt("), release.indexOf("function md(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
].join("\n");
const OriginalConsumers = new Function("m", `${helpers}\nconst ad={x:0,y:1,z:0}, UC=m(0.30000001192092896);\nreturn class OriginalConsumers { ${method} };`)(
  Math.fround,
) as new () => { applyRoadConsumers(this: RoadConsumerContext,
  seconds: number, force: { x: number; y: number; z: number }): void };
const original = new OriginalConsumers();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
type Scenario = RoadConsumerContext & { calls: string[] };
function scenario(tag = "normal"): Scenario {
  const calls: string[] = [];
  return {
    calls,
    wheels: {
      roadDescriptor: { road: { attributes: [{ name: "surface", value: tag }] } },
      auxiliaryDirection: vector(1, 0, 0),
    },
    body: { position: vector(1, 2, 3), linearVelocity: vector(3, 4, 5) },
    scratch: { v0: vector(), v1: vector(), v2: vector(), v3: vector(), v4: vector() },
    runtime: { roadCooldown: 0 },
    setRoadActionState(state, milliseconds) { calls.push(`action:${state}/${milliseconds}`); },
    requestMotionMode(allowRail, mode) { calls.push(`mode:${allowRail}/${mode}`); },
  };
}

function snapshot(context: Scenario): unknown {
  return {
    calls: context.calls, wheels: context.wheels, body: context.body,
    scratch: context.scratch, runtime: context.runtime,
  };
}

function compare(tag: string, edit: (state: Scenario) => void = () => {}): void {
  const expected = scenario(tag); edit(expected);
  const actual = scenario(tag); edit(actual);
  const expectedForce = vector(1, 2, 3), actualForce = vector(1, 2, 3);
  original.applyRoadConsumers.call(expected, 0.002, expectedForce);
  applyRoadSurfaceConsumers(actual, 0.002, actualForce);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${tag}: state`);
  assert.deepEqual(actualForce, expectedForce, `${tag}: force`);
}

test("BH, MZ, BS, JM and DJ road commands match release", () => {
  compare("normal");
  compare("BH01.0/02.0/03.0/04.0");
  compare("BH01.0/01.0/02.0/03.0", (state) => {
    state.body.position = vector(1, 3, -2);
  });
  compare("MZ01.0/02.0/03.0");
  compare("BS1.2");
  compare("JM1.2");
  compare("JM1.2/3.4");
  compare("JM1.2", (state) => { state.runtime.roadCooldown = 1; });
  compare("DJ1/2/3");
  compare("DJbad");
});
