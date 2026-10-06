import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import {
  disposeTimeAttackInterface,
  enterTimeAttackStage,
  exitTimeAttackStage,
  updateTimeAttackRoute,
} from "../src/timeattack/stage-lifecycle.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
assert.ok(declaration);
const wanted = new Set(["enter", "disposeInterface", "exit", "updateTimeAttackRoute"]);
const methods = declaration.body.body
  .filter(node => node.type === "ClassMethod" && wanted.has(node.key.name))
  .map(node => source.slice(node.start, node.end));
assert.equal(methods.length, wanted.size);
const context = {};
runInNewContext(`
  class uf0 { constructor(owners) { return globalThis.createInterface(owners); } }
  class ReleasedStage { ${methods.join("\n")} }
  globalThis.ReleasedStage = ReleasedStage;
`, context);

function run(kind, transition, lapTarget) {
  const trace = [];
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  const createInterface = owners => {
    trace.push(`interface.create:${owners?.id}`);
    return { dispose: () => trace.push("interface.dispose") };
  };
  context.createInterface = createInterface;
  stage.ui = { dispose: () => trace.push("old-interface.dispose") };
  stage.ghostRouteProgress = { old: true };
  stage.ghostPoses = [1, 2];
  stage.ghostPoseBuffer = [3, 4];
  stage.host = {
    getTrack: () => ({ data: { lapTarget } }),
    session: {
      lifecycle: {
        tick(input) {
          trace.push(`tick:${JSON.stringify(input)}`);
          return [{ kind: "lap", value: input.currentLap }];
        },
      },
    },
    handleTimeAttackActions(actions, now) {
      trace.push(`dispatch:${actions[0].kind}:${now}`);
    },
  };
  stage.setInterface = value => { trace.push(`interface.set:${value ? "view" : "none"}`); stage.ui = value; };
  stage.restartRace = () => trace.push("race.restart");
  if (kind === "rewrite") {
    stage.enter = value => enterTimeAttackStage(stage, value, createInterface);
    stage.disposeInterface = () => disposeTimeAttackInterface(stage);
    stage.exit = () => exitTimeAttackStage(stage);
    stage.updateTimeAttackRoute = (now, before, after) =>
      updateTimeAttackRoute(stage, now, before, after);
  }
  stage.enter(transition);
  stage.updateTimeAttackRoute(10000, 1, 1);
  stage.updateTimeAttackRoute(12000, 1, 2);
  const timeAttackParam = stage.timeAttackParam;
  stage.exit();
  return {
    trace,
    timeAttackParam,
    clearedParam: stage.timeAttackParam,
    clearedRoute: stage.ghostRouteProgress,
    ghostPoses: stage.ghostPoses,
    ghostPoseBuffer: stage.ghostPoseBuffer,
  };
}

test("time attack stage entry, route lap changes and exit match release", () => {
  for (const transition of [undefined, { param: "solo", owners: { id: 7 } }]) {
    for (const lapTarget of [undefined, 3]) {
      const normalize = value => JSON.parse(JSON.stringify(value));
      assert.deepEqual(normalize(run("rewrite", transition, lapTarget)),
        normalize(run("release", transition, lapTarget)));
    }
  }
});
