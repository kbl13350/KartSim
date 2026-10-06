import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import {
  advanceCheckpointReset, warpToCheckpoint, warpToPoint,
} from "../src/timeattack/checkpoint-reset.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
assert.ok(declaration);
const names = new Set(["advanceResetCompletion", "warpToCheckpoint", "warpToPoint"]);
const methods = declaration.body.body.filter(node =>
  node.type === "ClassMethod" && names.has(node.key.name));
assert.equal(methods.length, 3);
const context = {};
runInNewContext(`class ReleasedStage { ${methods.map(method =>
  source.slice(method.start, method.end)).join("\n")} }
globalThis.ReleasedStage = ReleasedStage;`, context);

function run(kind, method, options = {}) {
  const trace = [];
  const pose = { surface: options.surface ?? "asphalt" };
  const physics = {
    canHandleRouteSurfaceTag: tag => {
      trace.push(`physics.canHandleRouteSurfaceTag:${tag}`);
      return options.canHandle ?? true;
    },
    completeCheckpointPose: (value, align) =>
      trace.push(`physics.completeCheckpointPose:${value === pose}:${align}`),
    prepareRailCheckpointReentry: () => trace.push("physics.prepareRailCheckpointReentry"),
    setFullPhysicsBypass: enabled => trace.push(`physics.setFullPhysicsBypass:${enabled}`),
    restoreResetInteraction: () => trace.push("physics.restoreResetInteraction"),
    warpPosition: position => trace.push(`physics.warpPosition:${position}`),
  };
  const track = {
    warpRouteToSection: (value, section) => trace.push(`track.warpRouteToSection:${value === physics}:${section}`),
    prepareCurrentSectionReset: value => {
      trace.push(`track.prepareCurrentSectionReset:${value === physics}`);
      return pose;
    },
    commitCurrentSectionReset: value => trace.push(`track.commitCurrentSectionReset:${value === physics}`),
  };
  const session = {
    speedResetState: "old",
    coordinator: options.coordinator === false ? undefined : {
      synchronizePositionAnchor: () => trace.push("coordinator.synchronizePositionAnchor"),
    },
  };
  const host = {
    session,
    kartView: { root: { visible: true } },
    getPhysics: () => { trace.push("host.getPhysics"); return physics; },
    getTrack: () => { trace.push("host.getTrack"); return track; },
  };
  const dependencies = {
    advanceState: (state, nowMs) => {
      trace.push(`advanceState:${state}:${nowMs}`);
      return { state: "next", actions: options.actions ?? [] };
    },
    kartVisible: (state, nowMs) => {
      trace.push(`kartVisible:${state}:${nowMs}`);
      return false;
    },
  };
  Object.assign(context, { wL: dependencies.advanceState, gL: dependencies.kartVisible });
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  stage.host = host;
  stage.handleRouteSurfaceTag = (tag, value) =>
    trace.push(`stage.handleRouteSurfaceTag:${tag}:${value === pose}`);
  if (kind === "rewrite") {
    stage.advanceResetCompletion = at => advanceCheckpointReset(stage, at, dependencies);
    stage.warpToCheckpoint = section => warpToCheckpoint(stage, section);
    stage.warpToPoint = position => warpToPoint(stage, position);
  }
  let error;
  try { stage[method](method === "warpToPoint" ? "point" : 123); }
  catch (caught) { error = caught.message; }
  return {
    trace,
    error,
    visible: host.kartView.root.visible,
    speedResetState: session.speedResetState,
  };
}

test("timed reset actions and rail checkpoints match release", () => {
  for (const options of [
    { actions: [] },
    { actions: ["suspend-physics", "resume-physics", "restore"] },
    { actions: ["complete-checkpoint-pose"] },
    { actions: ["complete-checkpoint-pose"], surface: "rail:main" },
    { actions: ["complete-checkpoint-pose"], surface: "" },
    { actions: ["complete-checkpoint-pose"], surface: "rail:main", canHandle: false },
    { actions: ["complete-checkpoint-pose"], coordinator: false },
  ]) {
    assert.deepEqual(run("rewrite", "advanceResetCompletion", options),
      run("release", "advanceResetCompletion", options));
  }
});

test("checkpoint and free-point warps match release", () => {
  for (const method of ["warpToCheckpoint", "warpToPoint"]) {
    for (const options of [{}, { surface: "" }, { canHandle: false }, { coordinator: false }]) {
      assert.deepEqual(run("rewrite", method, options), run("release", method, options));
    }
  }
});
