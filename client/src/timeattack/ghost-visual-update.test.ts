import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  updateGhostVisualFrame,
  type GhostVisualUpdateDependencies, type GhostVisualUpdateHost,
} from "./ghost-visual-update";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Xd0 {");
const end = release.indexOf("\nconst J_", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Visual = GhostVisualUpdateHost & {
  update(input: unknown, timeMs: number, renderTime: number,
    frameSeconds: number, clock: number,
    mark?: (stage: string) => void): void;
};

function makeVisual(rewritten: boolean, full: boolean,
  speedRace: boolean): { visual: Visual; events: unknown[][] } {
  const events: unknown[][] = [];
  const dependencies: GhostVisualUpdateDependencies = {
    decodePose(frame, scratch) {
      events.push(["decode-pose", frame.status, scratch]);
      return {
        position: { x: frame.timeMs / 100, y: 2, z: 3 },
        right: { x: 1, y: 0, z: 0 },
        forward: { x: 0, y: 0, z: 1 },
        up: { x: 0, y: 1, z: 0 },
      };
    },
    decodeBasis(basis, scratch) {
      events.push(["decode-basis", basis, scratch]);
      return { right: { x: 2, y: 0, z: 0 },
        forward: { x: 0, y: 0, z: 2 }, up: { x: 0, y: 2, z: 0 } };
    },
    boosterState(status) { events.push(["booster", status]); return status; },
    secondaryState(status) { events.push(["secondary", status]); return status + 1; },
    instantAcceleration(status) { events.push(["instant", status]); return status >= 10; },
    copyToon(source, clone) { events.push(["copy-toon", source, clone]); },
    nextTrailState(status, previous, vehicle) {
      events.push(["next-trail", status, previous, vehicle]);
      return previous + 1;
    },
  };
  const Original = new Function("LL", "xv", "RD", "ID", "P_", "f6", "Kd0",
    `${originalClass}\nreturn Xd0;`)(
      dependencies.decodePose, dependencies.decodeBasis,
      dependencies.boosterState, dependencies.secondaryState,
      dependencies.instantAcceleration, dependencies.copyToon,
      dependencies.nextTrailState,
    ) as new () => Visual;
  const visual = Object.create(Original.prototype) as Visual;
  const vector = (name: string) => ({
    set(x: number, y: number, z: number) {
      events.push([name, x, y, z]);
    },
  });
  visual.poseScratch = "pose-scratch";
  visual.basisScratch = "basis-scratch";
  visual.root = {
    position: vector("position"),
    quaternion: { setFromRotationMatrix(matrix) {
      events.push(["quaternion", matrix === visual.orientationMatrix]);
    } },
  };
  visual.basisRight = vector("right");
  visual.basisUp = vector("up");
  visual.basisForward = vector("forward");
  visual.orientationMatrix = {
    makeBasis(right, up, forward) {
      events.push(["make-basis", right === visual.basisRight,
        up === visual.basisUp, forward === visual.basisForward]);
    },
  };
  visual.lastBoosterState = 0;
  visual.burstTeam = false;
  visual.usesP3553NonDualLinkedState = speedRace;
  visual.trailState = 3;
  visual.toonPairs = [{ source: "source-1", clone: "clone-1" }];
  visual.accessories = full ? [
    { kind: "headBand", render: {
      setOwnerState(booster, timeMs) {
        events.push(["head-state", booster, timeMs]);
      },
      scene: { update(...args) { events.push(["head-update", ...args]); } },
    } },
    { kind: "goggle", render: {
      scene: { update(...args) { events.push(["goggle-update", ...args]); } },
    } },
  ] : [];
  visual.motorcycle = true;
  visual.deriveMotion = (pose, forward, timeMs, telemetry) => {
    events.push(["motion", pose.position, forward, timeMs,
      telemetry && "velocity" in Object(telemetry)]);
    return { forwardSpeed: 12, rawSteer: 0.25, displaySpeedKmh: 43 };
  };
  visual.updateAnimation = (timeMs, booster, secondary, speed) => {
    events.push(["animation", timeMs, booster, secondary, speed]);
  };
  visual.ghostDualTeam = booster => {
    events.push(["dual-team", booster]);
    return booster === 10 && visual.burstTeam;
  };
  if (full) {
    visual.linkedPresentation = {
      updateSpeedRace(booster, timeMs) {
        events.push(["linked-speed", booster, timeMs]); return "speed-motion";
      },
      update(booster, timeMs) {
        events.push(["linked-normal", booster, timeMs]); return "normal-motion";
      },
    };
    visual.character = { update(timeMs, renderTime, frameSeconds, clock, state) {
      events.push(["character", timeMs, renderTime, frameSeconds, clock, state]);
    } };
    visual.imported = { renderScene: {
      update(...args) { events.push(["render-scene", ...args]); },
    } };
    visual.effects = {
      setState(booster, secondary, dualTeam, instant, timeMs) {
        events.push(["effect-state", booster, secondary, dualTeam, instant, timeMs]);
        return booster === 10;
      },
      update(...args) { events.push(["effect-update", ...args]); },
    };
    visual.animation = { enterDualUse() { events.push(["enter-dual"]); } };
    visual.trailVehicle = "vehicle";
    visual.trails = {
      setState(state, timeMs) { events.push(["trail-state", state, timeMs]); },
      update(...args) { events.push(["trail-update", ...args]); },
    };
    visual.balloon = { scene: {
      update(...args) { events.push(["balloon-update", ...args]); },
    } };
  }
  if (rewritten) Object.assign(visual, {
    update(input: never, timeMs: number, renderTime: number,
      frameSeconds: number, clock: number,
      mark?: (stage: string) => void) {
      return updateGhostVisualFrame(visual, input, timeMs, renderTime,
        frameSeconds, clock, mark, dependencies);
    },
  });
  return { visual, events };
}

test("Ghost visual full frame update preserves call order, burst team and render basis", () => {
  const inputs = [
    { status: 4, timeMs: 1000 },
    { sample: { status: 10, timeMs: 1100 }, renderBasisClient: "client-basis",
      velocity: { x: 1, y: 2, z: 3 }, speedKmh: 60 },
    { status: 10, timeMs: 1200 },
    { status: 2, timeMs: 1300 },
  ];
  const inspect = (rewritten: boolean, speedRace: boolean) => {
    const { visual, events } = makeVisual(rewritten, true, speedRace);
    for (const input of inputs) {
      visual.update(input, 2000, 0.016, 1 / 60, 123,
        stage => events.push(["mark", stage]));
    }
    return { events, burstTeam: visual.burstTeam,
      lastBoosterState: visual.lastBoosterState,
      trailState: visual.trailState };
  };
  for (const speedRace of [true, false]) {
    assert.deepEqual(inspect(true, speedRace), inspect(false, speedRace));
  }
});

test("Ghost visual sparse frame skips optional owners but retains markers", () => {
  const inspect = (rewritten: boolean) => {
    const { visual, events } = makeVisual(rewritten, false, false);
    visual.update({ status: 0, timeMs: 10 }, 20, 30, 40, 50,
      stage => events.push(["mark", stage]));
    return { events, trailState: visual.trailState };
  };
  assert.deepEqual(inspect(true), inspect(false));
});
