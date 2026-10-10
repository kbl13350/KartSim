import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  captureVehicleRail,
  type RailCaptureContext,
  type RailCaptureTrack,
} from "./rail-capture";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  captureRail(", classStart);
const end = release.indexOf("  produceRailFrame(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function Ri("), release.indexOf("function TW(")),
  release.slice(release.indexOf("function hd("), release.indexOf("function c9(")),
  release.slice(release.indexOf("function V9("), release.indexOf("function ri0(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
].join("\n");
const Original = new Function("m", `${helpers}\nconst x5=m(0.5);
return class Original { ${method} };`)(Math.fround) as new () => {
  captureRail(this: RailCaptureContext, seconds: number, track: RailCaptureTrack): void;
};
const original = new Original();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
const descriptor = (rail?: string) => ({ road: {
  attributes: rail ? [{ name: "rail", value: rail }] : [],
} });
type Scenario = RailCaptureContext & { calls: string[] };
function scenario(frameAccepted = true): Scenario {
  const calls: string[] = [];
  return {
    calls,
    body: { position: vector(1.2, 2.4, 3.1), up: vector(0.1, 0.98, -0.03) },
    wheels: {
      grounded: true, railContactDescriptor: descriptor("rail_1"), roadDescriptor: descriptor(),
    },
    runtime: {
      motionMode: 1, railCaptureTimeout: 0.01, railCaptureDelay: 0.001,
      railEntryTimerA: 0, railEntryTimerB: 0, bodySpeed: 14.3,
    },
    tuning: { driftTrigTime: 0.25 },
    requestMotionMode(lift, mode) { calls.push(`mode:${lift}/${mode}`); },
    produceRailFrame(seconds) { calls.push(`frame:${seconds}`); return frameAccepted; },
  };
}

function snapshot(state: Scenario): unknown {
  const { requestMotionMode: _mode, produceRailFrame: _frame, ...rest } = state;
  return rest;
}

type Options = {
  sample?: { sampled: boolean; point: { x: number; y: number; z: number } };
  captureDistance?: number;
  railHit?: string;
  lookup?: boolean;
};
function trackFor(state: Scenario, options: Options): RailCaptureTrack {
  const track: RailCaptureTrack = {
    rayQuery(origin, direction, includeRoad) {
      state.calls.push(`ray:${origin.x}/${direction.y}/${includeRoad}`);
      return { roadDescriptor: descriptor(options.railHit) };
    },
    sampleRoute(_vehicle, lookAhead, lane) {
      state.calls.push(`sample:${lookAhead}/${lane}`);
      return options.sample;
    },
    railCaptureDistance() {
      state.calls.push("distance");
      return options.captureDistance;
    },
  };
  if (options.lookup !== false) track.lookupRailConfig = id => {
    state.calls.push(`lookup:${id}`);
    return { id, grip: 0.7 };
  };
  return track;
}

function compare(
  label: string,
  edit: (state: Scenario) => void = () => {},
  options: Options = {},
  accepted = true,
): void {
  const defaults: Options = {
    sample: { sampled: true, point: vector(1.25, 2.45, 3.15) },
    captureDistance: 1,
    railHit: "rail_1",
  };
  const choices = { ...defaults, ...options };
  const expected = scenario(accepted), actual = scenario(accepted);
  edit(expected); edit(actual);
  let expectedError: unknown, actualError: unknown;
  try { original.captureRail.call(expected, 0.002, trackFor(expected, choices)); }
  catch (error) { expectedError = error; }
  try { captureVehicleRail(actual, 0.002, trackFor(actual, choices)); }
  catch (error) { actualError = error; }
  assert.equal((actualError as Error | undefined)?.message,
    (expectedError as Error | undefined)?.message, `${label}: error`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state and calls`);
}

test("rail capture gates and successful transition match release", () => {
  compare("capture success");
  compare("not in entry mode", state => { state.runtime.motionMode = 0; });
  compare("waiting for capture delay", state => { state.runtime.railCaptureDelay = 0.1; });
  compare("missing rail", state => {
    state.wheels.railContactDescriptor = undefined;
  }, { railHit: undefined });
  compare("timeout requests return", state => {
    state.wheels.railContactDescriptor = undefined;
    state.runtime.railCaptureTimeout = 0.001;
  }, { railHit: undefined });
  compare("route sample unavailable", () => {}, { sample: undefined });
  compare("theme distance unavailable", () => {}, { captureDistance: undefined });
  compare("sample unsampled", () => {}, {
    sample: { sampled: false, point: vector(1.25, 2.45, 3.15) },
  });
  compare("point far away", () => {}, {
    sample: { sampled: true, point: vector(100, 2.45, 3.15) },
  });
  compare("point too high", () => {}, {
    sample: { sampled: true, point: vector(1.2, 5.2, 3.1) }, captureDistance: 10,
  });
  compare("rail config unavailable", () => {}, { lookup: false });
  compare("frame declined", () => {}, {}, false);
  compare("airborne rail ray", state => {
    state.wheels.grounded = false;
  });
});
