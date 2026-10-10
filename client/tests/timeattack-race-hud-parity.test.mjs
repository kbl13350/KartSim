import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { rankBoardValues, renderGameplayUi } from "../src/timeattack/race-hud.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
assert.ok(declaration);
const names = new Set(["renderGameplayUi", "rankBoardValues"]);
const methods = declaration.body.body.filter(node =>
  node.type === "ClassMethod" && names.has(node.key.name));
assert.equal(methods.length, 2);
const context = {};
runInNewContext(`class ReleasedStage { ${methods.map(method =>
  source.slice(method.start, method.end)).join("\n")} }
globalThis.ReleasedStage = ReleasedStage;`, context);

function run(kind, operation, options = {}) {
  const trace = [];
  const physics = {
    body: "body",
    timeAttackTachometerGauges: () => {
      trace.push("physics.timeAttackTachometerGauges");
      return { mainRatio: 0.3, teamRatio: 0.8, teamBooster: true };
    },
    timeAttackSpeedSlots: () => { trace.push("physics.timeAttackSpeedSlots"); return [1, 3]; },
    timeAttackSpeedSlotDisabled: () => { trace.push("physics.timeAttackSpeedSlotDisabled"); return false; },
    timeAttackSpeedSlotWindowStartMs: () => {
      trace.push("physics.timeAttackSpeedSlotWindowStartMs"); return 900;
    },
  };
  const track = {
    data: { lapTarget: options.missingLapTarget ? undefined : 3 },
    getRouteState: value => {
      trace.push(`track.getRouteState:${value === physics}`);
      return { lap: 2, distance: 47.5 };
    },
  };
  const session = {
    lifecycle: { bestLapMs: 12345, finished: options.finished ?? false },
    ghosts: [{ name: "ghost-a" }, { name: "ghost-b" }],
    rankColors: ["red", "blue", "green"],
    localName: options.localName ?? "player",
    warpHud: options.warpHidden ? { hidden: true } : undefined,
  };
  const host = {
    session,
    renderer: "renderer",
    getPhysics: () => { trace.push("host.getPhysics"); return physics; },
    getTrack: () => { trace.push("host.getTrack"); return track; },
  };
  const dependencies = {
    rankParticipants: participants => {
      trace.push(`rankParticipants:${JSON.stringify(participants)}`);
      if (options.omitPlayer) return participants.slice(1).map((value, index) => ({ ...value, rank: index + 1 }));
      return participants.slice().sort((a, b) => b.progress - a.progress)
        .map((value, index) => ({ ...value, rank: index + 1 }));
    },
    elapsedRaceMs: (lifecycle, nowMs) => {
      trace.push(`elapsedRaceMs:${lifecycle === session.lifecycle}:${nowMs}`);
      return 2345;
    },
    isRaceFinished: lifecycle => {
      trace.push(`isRaceFinished:${lifecycle === session.lifecycle}`);
      return lifecycle.finished;
    },
    worldAxis: "world-axis",
    depthAxis: "depth-axis",
  };
  Object.assign(context, {
    XL: dependencies.rankParticipants,
    ff0: dependencies.elapsedRaceMs,
    Un: dependencies.isRaceFinished,
    H2: dependencies.worldAxis,
    $2: dependencies.depthAxis,
  });
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  stage.host = host;
  stage.ghostRouteProgress = {
    distance: ghost => {
      trace.push(`ghostRouteProgress.distance:${ghost.name}`);
      return ghost.name === "ghost-a" ? 55 : 39;
    },
  };
  stage.interface = options.noUi ? undefined : {
    gameplayUi: {
      update: (values, nowMs, worldAxis, depthAxis) =>
        trace.push(`ui.update:${JSON.stringify(values)}:${nowMs}:${worldAxis}:${depthAxis}`),
      render: (renderer, worldAxis, depthAxis) =>
        trace.push(`ui.render:${renderer}:${worldAxis}:${depthAxis}`),
    },
  };
  if (kind === "rewrite") {
    stage.rankBoardValues = () => rankBoardValues(stage, dependencies);
    stage.renderGameplayUi = (nowMs, ghostPoses) =>
      renderGameplayUi(stage, nowMs, ghostPoses, dependencies);
  }
  let result;
  let error;
  try {
    result = operation === "rank"
      ? stage.rankBoardValues()
      : stage.renderGameplayUi(12000, ["ghost-pose"]);
  } catch (caught) { error = caught.message; }
  return { trace, result: JSON.parse(JSON.stringify(result ?? null)), error };
}

test("player and Ghost rank projection matches release", () => {
  for (const options of [{}, { localName: "" }, { omitPlayer: true }]) {
    assert.deepEqual(run("rewrite", "rank", options), run("release", "rank", options));
  }
});

test("HUD data, render gates and missing lap target match release", () => {
  for (const options of [
    {}, { finished: true }, { warpHidden: true },
    { missingLapTarget: true }, { noUi: true },
  ]) {
    assert.deepEqual(run("rewrite", "render", options), run("release", "render", options));
  }
});
