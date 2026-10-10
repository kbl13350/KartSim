import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { captureGhostRuntime } from "../src/timeattack/ghost-capture.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
const method = declaration?.body.body.find(node =>
  node.type === "ClassMethod" && node.key.name === "captureGhostRuntime");
assert.ok(method);
const context = {};
runInNewContext(`class ReleasedStage { ${source.slice(method.start, method.end)} }
globalThis.ReleasedStage = ReleasedStage;`, context);

function run(kind, position, drifting) {
  const trace = [];
  const physics = {
    body: {
      position,
      right: { x: 1, y: 0, z: 0 },
      forward: { x: 0, y: 1, z: 0 },
      up: { x: 0, y: 0, z: 1 },
    },
    driveCameraRuntime: () => {
      trace.push("physics.driveCameraRuntime");
      return { stateCode: 4, action8: 7 };
    },
    driftVisualRuntime: () => {
      trace.push("physics.driftVisualRuntime");
      return { active: drifting };
    },
  };
  const dependencies = {
    bodyQuaternion: axes => {
      trace.push(`bodyQuaternion:${axes.position === position}:${axes.right === physics.body.right}`);
      return { w: 0.4, x: 0.1, y: 0.2, z: 0.3 };
    },
    statusFlags: (camera, active, action) => {
      trace.push(`statusFlags:${camera}:${active}:${action}`);
      return 144;
    },
  };
  Object.assign(context, { PL: dependencies.bodyQuaternion, GD: dependencies.statusFlags });
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  stage.host = { getPhysics: () => { trace.push("host.getPhysics"); return physics; } };
  if (kind === "rewrite") {
    stage.captureGhostRuntime = at => captureGhostRuntime(stage, at, dependencies);
  }
  return { trace, frame: JSON.parse(JSON.stringify(stage.captureGhostRuntime(123.5))) };
}

test("Ghost frame coordinates, quaternion and flags match release", () => {
  for (const [position, drifting] of [
    [{ x: 1.25, y: 3.5, z: -9.125 }, false],
    [{ x: -0.25, y: -8.75, z: 0.123456789 }, true],
  ]) {
    assert.deepEqual(run("rewrite", position, drifting), run("release", position, drifting));
  }
});
