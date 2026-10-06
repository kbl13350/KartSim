import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deriveGhostVisualMotion, isGhostDualTeam, updateGhostVisualAnimation,
  type GhostVisualMotionHost, type GhostVisualSample, type GhostVisualVelocity,
  type Vec3Like,
} from "./ghost-visual-motion";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Xd0 {");
const end = release.indexOf("\nconst J_", start);
assert.ok(start >= 0 && end > start);
const Original = new Function(`${release.slice(start, end)}\nreturn Xd0;`)() as {
  new (): GhostVisualMotionHost;
};

type Visual = GhostVisualMotionHost & {
  deriveMotion(pose: GhostVisualSample, forward: Vec3Like, timeMs: number,
    telemetry?: GhostVisualVelocity): unknown;
  updateAnimation(timeMs: number, booster: number, secondary: number,
    speed: number): void;
  ghostDualTeam(booster: number): boolean;
};

function makeVisual(rewritten: boolean, withAnimation = true) {
  const visual = Object.create(Original.prototype) as Visual;
  const events: unknown[][] = [];
  visual.hasLastPose = false;
  visual.lastPosePosition = { x: 0, y: 0, z: 0 };
  visual.lastPoseHeading = 0;
  visual.lastPoseTimeMs = 0;
  visual.burstTeam = false;
  if (withAnimation) {
    visual.visual = {
      isTransformAutoCharge: true, autoChargeLowSpeed: 30,
      transformTime: 550,
    };
    visual.animation = {
      update(...args) { events.push(["animation", ...args]); },
    };
  }
  if (rewritten) Object.assign(visual, {
    deriveMotion(pose: GhostVisualSample, forward: Vec3Like,
      timeMs: number, telemetry?: GhostVisualVelocity) {
      return deriveGhostVisualMotion(visual, pose, forward, timeMs, telemetry);
    },
    updateAnimation(timeMs: number, booster: number, secondary: number,
      speed: number) {
      return updateGhostVisualAnimation(visual, timeMs, booster, secondary, speed);
    },
    ghostDualTeam(booster: number) { return isGhostDualTeam(visual, booster); },
  });
  return { visual, events };
}

test("Ghost visual motion handles first pose, heading wrap, time reversal and telemetry like release", () => {
  const samples: Array<{
    pose: GhostVisualSample; forward: Vec3Like; timeMs: number;
    telemetry?: GhostVisualVelocity;
  }> = [
    { pose: { position: { x: 0, y: 0, z: 0 } },
      forward: { x: 0, y: 0, z: 1 }, timeMs: 1000 },
    { pose: { position: { x: 2, y: 1, z: 0 } },
      forward: { x: 0.1, y: 0, z: -1 }, timeMs: 1200 },
    { pose: { position: { x: 3, y: 1, z: -1 } },
      forward: { x: -0.1, y: 0, z: -1 }, timeMs: 1400 },
    { pose: { position: { x: 4, y: 2, z: -2 } },
      forward: { x: 0, y: 1, z: 0 }, timeMs: 1400 },
    { pose: { position: { x: 5, y: 2, z: -3 } },
      forward: { x: 1, y: 0, z: 0 }, timeMs: 1300,
      telemetry: { velocity: { x: 3, y: 4, z: 5 }, speedKmh: 72 } },
    { pose: { position: { x: 6, y: 2, z: -4 } },
      forward: { x: 0, y: 0, z: 1 }, timeMs: 1800,
      telemetry: { velocity: { x: -2, y: -3, z: 4 }, speedKmh: 40 } },
  ];
  const inspect = (rewritten: boolean) => {
    const { visual } = makeVisual(rewritten);
    const results = samples.map(sample => visual.deriveMotion(
      sample.pose, sample.forward, sample.timeMs, sample.telemetry));
    return { results, hasLastPose: visual.hasLastPose,
      position: visual.lastPosePosition, heading: visual.lastPoseHeading,
      timeMs: visual.lastPoseTimeMs };
  };
  assert.deepEqual(inspect(true), inspect(false));
});

test("Ghost animation charge and dual team states match release", () => {
  for (const withAnimation of [true, false]) {
    const inspect = (rewritten: boolean) => {
      const { visual, events } = makeVisual(rewritten, withAnimation);
      visual.updateAnimation(-1, 0, 5, 31);
      visual.updateAnimation(2000, 4, 6, 10);
      visual.updateAnimation(2001, 12, 7, 30);
      visual.visual && (visual.visual.isTransformAutoCharge = false);
      visual.updateAnimation(2002, 10, 8, 50);
      const team = [0, 4, 10, 12].map(state => visual.ghostDualTeam(state));
      visual.burstTeam = true;
      const burstTeam = [0, 4, 10, 12].map(state => visual.ghostDualTeam(state));
      return { events, team, burstTeam };
    };
    assert.deepEqual(inspect(true), inspect(false), String(withAnimation));
  }
});
