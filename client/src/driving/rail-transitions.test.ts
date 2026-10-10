import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  enterVehicleRailMode,
  requestVehicleMotionMode,
  returnVehicleToRoad,
  type RailTransitionContext,
  type RailTransitionTrack,
} from "./rail-transitions";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
function method(name: string, next: string): string {
  const start = release.indexOf(`  ${name}(`, classStart);
  const end = release.indexOf(`  ${next}(`, start);
  assert.ok(classStart > 0 && start > classStart && end > start);
  return release.slice(start, end);
}
const helpers = [
  release.slice(release.indexOf("function Ri("), release.indexOf("function TW(")),
  release.slice(release.indexOf("function O9("), release.indexOf("function qt(")),
  release.slice(release.indexOf("function hd("), release.indexOf("function Ze(")),
  release.slice(release.indexOf("function s9("), release.indexOf("function c9(")),
  release.slice(release.indexOf("function ic("), release.indexOf("function ci0(")),
].join("\n");
const Original = new Function("m", `${helpers}
const x5=m(0.5),qC=[{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}];
return class Original {
${method("enterRailMode", "requestMotionMode")}
${method("requestMotionMode", "captureRail")}
${method("returnToStandard", "integrateFull3D")}
};`)(Math.fround) as new () => {
  enterRailMode(this: RailTransitionContext): void;
  requestMotionMode(this: RailTransitionContext, lift: boolean, mode: number): void;
  returnToStandard(this: RailTransitionContext, seconds: number, track: RailTransitionTrack): void;
};
const original = new Original();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
type Scenario = RailTransitionContext & { calls: string[] };
function scenario(): Scenario {
  return {
    calls: [],
    body: { position: vector(4.5, 3.2, -2), up: vector(0.1, 0.98, -0.04) },
    wheels: { grounded: true, roadDescriptor: { road: { attributes: [] } } },
    runtime: {
      motionMode: 1,
      bodySpeed: 23.4,
      railCaptureDelay: 0.1,
      railCaptureTimeout: 1,
      railRelativeOrientation: [vector(), vector(), vector()],
      railScalar0: 3, railScalar1: 4, railScalar2: 5, railBadGeometryTimer: 6,
      stagedExternalForce: vector(), railReturnTimer: 0.1, railResetRequest: false,
    },
  };
}

function compare(
  label: string,
  originalCall: (state: Scenario) => void,
  migratedCall: (state: Scenario) => void,
  edit: (state: Scenario) => void = () => {},
): void {
  const expected = scenario(), actual = scenario();
  edit(expected); edit(actual);
  originalCall(expected); migratedCall(actual);
  assert.deepEqual(actual, expected, label);
}

test("rail entry and mode change match released timing and impulse", () => {
  for (const speed of [0, 23.4, 28, 50]) {
    compare(`entry speed ${speed}`, state => original.enterRailMode.call(state),
      enterVehicleRailMode, state => { state.runtime.bodySpeed = speed; });
  }
  compare("already captured", state => original.enterRailMode.call(state),
    enterVehicleRailMode, state => { state.runtime.motionMode = 2; });
  for (const mode of [0, 1, 2, 3]) {
    compare(`lift from ${mode}`, state => original.requestMotionMode.call(state, true, 5),
      state => requestVehicleMotionMode(state, true, 5), state => {
        state.runtime.motionMode = mode;
      });
  }
  compare("return mode 6", state => original.requestMotionMode.call(state, false, 6),
    state => requestVehicleMotionMode(state, false, 6), state => {
      state.runtime.motionMode = 3;
    });
});

test("rail exit waits for ordinary road and route association", () => {
  function run(label: string, edit: (state: Scenario) => void,
    road: { rail?: string } | undefined, associated: boolean): void {
    const expected = scenario(), actual = scenario();
    edit(expected); edit(actual);
    const expectedRays: unknown[] = [], actualRays: unknown[] = [];
    const trackFor = (rays: unknown[]): RailTransitionTrack => ({
      rayQuery(origin, direction, includeRoad) {
        rays.push({ origin: { ...origin }, direction: { ...direction }, includeRoad });
        return road ? { roadDescriptor: { road: { attributes: road.rail
          ? [{ name: "rail", value: road.rail }] : [] } } } : undefined;
      },
      associateRoute(vehicle, position) {
        (vehicle as Scenario).calls.push(`route:${position.x}`);
        return associated;
      },
    });
    original.returnToStandard.call(expected, 0.2, trackFor(expectedRays));
    returnVehicleToRoad(actual, 0.2, trackFor(actualRays));
    assert.deepEqual(actual, expected, `${label}: state`);
    assert.deepEqual(actualRays, expectedRays, `${label}: ray`);
  }
  run("mode not returning", state => { state.runtime.motionMode = 2; }, {}, true);
  run("grounded ordinary road", state => {
    state.runtime.motionMode = 5;
  }, {}, false);
  run("mode 6 ordinary road", state => { state.runtime.motionMode = 6; }, {}, false);
  run("rail retains mode", state => {
    state.runtime.motionMode = 5;
    state.wheels.roadDescriptor = { road: { attributes: [{ name: "rail", value: "R" }] } };
  }, {}, true);
  run("airborne road ray", state => {
    state.runtime.motionMode = 5;
    state.wheels.grounded = false;
  }, {}, true);
  run("airborne no road", state => {
    state.runtime.motionMode = 5;
    state.wheels.grounded = false;
  }, undefined, true);
});
