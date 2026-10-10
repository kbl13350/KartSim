import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { placeAtStart, seedGhostStart, snapStartToGround } from "../src/timeattack/start-grid.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
assert.ok(declaration);
const names = new Set(["placeAtStart", "snapStartToGround", "seedGhostStart"]);
const methods = declaration.body.body.filter(node =>
  node.type === "ClassMethod" && names.has(node.key.name));
assert.equal(methods.length, 3);
const context = {};
runInNewContext(`class ReleasedStage { ${methods.map(method =>
  source.slice(method.start, method.end)).join("\n")} }
globalThis.ReleasedStage = ReleasedStage;`, context);

function run(kind, operation, options = {}) {
  const trace = [];
  const start = { position: { x: 1.125, y: 2.375, z: -3.875 } };
  const body = {
    position: { x: 0, y: 0, z: 0 },
    right: { x: 0.25, y: 0, z: 0.75 },
    forward: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
  };
  const physics = {
    body,
    state: { trackProgress: 0 },
    resetFromRouteFrame: frame => {
      trace.push(`physics.resetFromRouteFrame:${frame === start}`);
      body.position = { ...frame.position };
    },
  };
  const track = {
    getStart: () => { trace.push("track.getStart"); return start; },
    resetRouteState: (value, point) =>
      trace.push(`track.resetRouteState:${value === physics}:${JSON.stringify(point)}`),
    getRouteState: value => {
      trace.push(`track.getRouteState:${value === physics}`);
      return { distance: 64.5 };
    },
  };
  const ghosts = options.noGhosts ? [] : [1, 3].map((slot, index) => ({
    startSlot: slot,
    view: { seedStart: (point, right, forward, up) =>
      trace.push(`ghost${index}.seedStart:${JSON.stringify(point)}:${right === body.right}:${forward === body.forward}:${up === body.up}`) },
  }));
  const host = {
    currentPlayerSlot: 2,
    session: {
      ghosts,
      coordinator: options.noCoordinator ? undefined : {
        synchronizePositionAnchor: () => trace.push("coordinator.synchronizePositionAnchor"),
      },
    },
    getTrack: () => { trace.push("host.getTrack"); return track; },
    getPhysics: () => { trace.push("host.getPhysics"); return physics; },
  };
  const dependencies = {
    slotOffset: slot => { trace.push(`slotOffset:${slot}`); return slot * 1.25; },
    createGhostRouteProgress: value => {
      trace.push(`createGhostRouteProgress:${value === track}`);
      return { seed: (ghost, point) =>
        trace.push(`ghostRouteProgress.seed:${ghost.startSlot}:${JSON.stringify(point)}`) };
    },
  };
  context.iG = dependencies.slotOffset;
  context.hf0 = class {
    constructor(value) { return dependencies.createGhostRouteProgress(value); }
  };
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  stage.host = host;
  stage.ghostPoses = ["old-pose"];
  stage.traceGround = (origin, direction) => {
    trace.push(`traceGround:${JSON.stringify(origin)}:${JSON.stringify(direction)}`);
    return options.noGround ? undefined : { x: origin.x, y: 3.5, z: origin.z };
  };
  if (kind === "rewrite") {
    stage.placeAtStart = () => placeAtStart(stage, dependencies);
    stage.snapStartToGround = point => snapStartToGround(stage, point);
    stage.seedGhostStart = frame => seedGhostStart(stage, frame, dependencies);
  }
  const result = operation === "place"
    ? stage.placeAtStart()
    : operation === "seed"
      ? stage.seedGhostStart(start)
      : stage.snapStartToGround(start.position);
  return {
    trace,
    result: JSON.parse(JSON.stringify(result ?? null)),
    position: JSON.parse(JSON.stringify(body.position)),
    trackProgress: physics.state.trackProgress,
    ghostPoses: JSON.parse(JSON.stringify(stage.ghostPoses)),
  };
}

test("local and Ghost start-grid placement matches release", () => {
  for (const operation of ["place", "seed", "snap"]) {
    for (const options of [{}, { noGround: true }, { noGhosts: true }, { noCoordinator: true }]) {
      assert.deepEqual(run("rewrite", operation, options), run("release", operation, options));
    }
  }
});
