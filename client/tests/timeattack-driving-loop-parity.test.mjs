import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { updateTimeAttackDriving } from "../src/timeattack/driving-loop.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
const method = declaration?.body.body.find(node =>
  node.type === "ClassMethod" && node.key.name === "updateDriving");
assert.ok(method);
const context = {};
runInNewContext(`class ReleasedStage { ${source.slice(method.start, method.end)} }
globalThis.ReleasedStage = ReleasedStage;`, context);

function run(kind, options = {}) {
  const trace = [];
  const physics = {
    body: { position: "body-position" },
    synchronizeClock: at => trace.push(`physics.synchronizeClock:${at}`),
    consumeRailResetRequest: () => {
      const requested = (options.railRequests ?? []).shift() ?? false;
      trace.push(`physics.consumeRailResetRequest:${requested}`);
      return requested;
    },
    consumeSpeedSlotReordered: () => {
      trace.push("physics.consumeSpeedSlotReordered");
      return options.reordered ?? false;
    },
    updateModeInventory: () => {
      trace.push("physics.updateModeInventory");
      return options.gaugeFull ?? false;
    },
    timeAttackTeamGaugeSettledAtMs: () => {
      trace.push("physics.timeAttackTeamGaugeSettledAtMs");
      return options.teamGaugeAtMs ?? 0;
    },
  };
  const track = {
    data: { lapTarget: options.lapTarget },
    getRouteState: value => {
      trace.push(`track.getRouteState:${value === physics}`);
      return { lap: 2 };
    },
    updateObstacles: (at, position) => trace.push(`track.updateObstacles:${at}:${position}`),
    registerObstaclePair: position => trace.push(`track.registerObstaclePair:${position}`),
    commitObstacleSnapshot: () => trace.push("track.commitObstacleSnapshot"),
  };
  const lifecycle = {
    phase: options.phase ?? 4,
    finished: options.finished ?? false,
    effectiveTime: at => { trace.push(`lifecycle.effectiveTime:${at}`); return at - 15; },
    tick: input => { trace.push(`lifecycle.tick:${JSON.stringify(input)}`); return "actions"; },
  };
  const session = {
    lifecycle,
    coordinator: options.noCoordinator ? undefined : {
      run: (at, snapshot) => {
        trace.push(`coordinator.run:${at}:${snapshot}`);
        return { schedule: { nowMs: at + 1 }, route: { lap: 3 } };
      },
    },
    tachometer: options.tachometer === false ? undefined : "tachometer",
    warpBlackBar: options.blackBar === false ? undefined : {
      setRatio: ratio => trace.push(`blackBar.setRatio:${ratio}`),
    },
    warpCameraFrozen: options.cameraFrozen ?? false,
  };
  const host = {
    session,
    shell: { started: options.started ?? true, halted: options.halted ?? false },
    ghostRecorder: options.recorder === false ? undefined : {
      update: at => trace.push(`ghostRecorder.update:${at}`),
    },
    audio: { interfaceAudio: options.audio === false ? undefined : {
      playSlotChanger: () => trace.push("interfaceAudio.playSlotChanger"),
    } },
    warpNext: {
      tick: at => { trace.push(`warpNext.tick:${at}`); return "warp-actions"; },
      presentationVisible: at => {
        trace.push(`warpNext.presentationVisible:${at}`);
        return options.warpVisible ?? true;
      },
      blackBarRatio: at => { trace.push(`warpNext.blackBarRatio:${at}`); return 0.25; },
    },
    presentationClockMs: 900,
    kartView: { root: { visible: true } },
    getPhysics: () => { trace.push("host.getPhysics"); return physics; },
    getTrack: () => { trace.push("host.getTrack"); return track; },
    getDrivingSnapshot: () => { trace.push("host.getDrivingSnapshot"); return "snapshot"; },
    advanceResetCompletion: at => trace.push(`host.advanceResetCompletion:${at}`),
    handleTimeAttackActions: (actions, at) => trace.push(`host.handleTimeAttackActions:${actions}:${at}`),
    drainDrivingInput: (effective, raw) => trace.push(`host.drainDrivingInput:${effective}:${raw}`),
    updateActiveRaceCamera: at => trace.push(`host.updateActiveRaceCamera:${at}`),
    updateTimeAttackRoute: (at, before, after) => trace.push(`host.updateTimeAttackRoute:${at}:${before}:${after}`),
    applyWarpNextActions: actions => trace.push(`host.applyWarpNextActions:${actions}`),
  };
  const dependencies = {
    isDrivingPhase: phase => { trace.push(`isDrivingPhase:${phase}`); return phase >= 4; },
    isRaceFinished: value => { trace.push("isRaceFinished"); return value.finished; },
    countdownPhase: 3,
    finishAcceptedPhase: 6,
    refreshTachometer: value => trace.push(`refreshTachometer:${value}`),
  };
  Object.assign(context, {
    Jl0: dependencies.isDrivingPhase,
    Un: dependencies.isRaceFinished,
    eP: dependencies.refreshTachometer,
    Ne: { Countdown: dependencies.countdownPhase, FinishAccepted: dependencies.finishAcceptedPhase },
  });
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  stage.host = host;
  stage.lastTeamGaugeSettledAtMs = options.previousTeamGaugeAtMs ?? 0;
  stage.ui = options.ui === false ? undefined : {
    gameplayUi: {
      startSlotReorder: () => trace.push("ui.startSlotReorder"),
      startBoostGaugeFull: () => trace.push("ui.startBoostGaugeFull"),
      startTeamBoostGaugeFull: () => trace.push("ui.startTeamBoostGaugeFull"),
    },
  };
  stage.checkLowHeightReset = at => trace.push(`stage.checkLowHeightReset:${at}`);
  stage.checkAutomaticReset = at => trace.push(`stage.checkAutomaticReset:${at}`);
  stage.initiateSpeedReset = allow => trace.push(`stage.initiateSpeedReset:${allow}`);
  if (kind === "rewrite") {
    stage.updateDriving = at => updateTimeAttackDriving(stage, at, dependencies);
  }
  let error;
  try { stage.updateDriving(500); } catch (caught) { error = caught.message; }
  return {
    trace,
    error,
    visible: host.kartView.root.visible,
    lastTeamGaugeSettledAtMs: stage.lastTeamGaugeSettledAtMs,
  };
}

test("inactive shell, countdown and halted paths match release", () => {
  for (const options of [
    { started: false }, { phase: 2 }, { phase: 2, lapTarget: 2 },
    { halted: true, railRequests: [true] },
  ]) {
    assert.deepEqual(run("rewrite", structuredClone(options)),
      run("release", structuredClone(options)));
  }
});

test("active driving, Ghost, gauges and camera branches match release", () => {
  for (const options of [
    {},
    { railRequests: [true, true], reordered: true, gaugeFull: true,
      teamGaugeAtMs: 100, warpVisible: false, lapTarget: 3 },
    { finished: true, recorder: false, audio: false, tachometer: false,
      ui: false, cameraFrozen: true, blackBar: false },
    { phase: 7, teamGaugeAtMs: 0, previousTeamGaugeAtMs: 100 },
    { noCoordinator: true },
  ]) {
    assert.deepEqual(run("rewrite", structuredClone(options)),
      run("release", structuredClone(options)));
  }
});
