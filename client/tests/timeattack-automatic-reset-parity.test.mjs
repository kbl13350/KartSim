import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import {
  checkAutomaticReset, checkLowHeightReset, initiateSpeedReset,
} from "../src/timeattack/automatic-reset.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
assert.ok(declaration);
const names = new Set(["checkLowHeightReset", "checkAutomaticReset", "initiateSpeedReset"]);
const methods = declaration.body.body.filter(node =>
  node.type === "ClassMethod" && names.has(node.key.name));
assert.equal(methods.length, 3);
const context = {};
runInNewContext(`class ReleasedStage { ${methods.map(method =>
  source.slice(method.start, method.end)).join("\n")} }
globalThis.ReleasedStage = ReleasedStage;`, context);

function run(kind, method, options = {}) {
  const trace = [];
  const lifecycle = {
    phase: options.phase ?? 4,
    countdownSubstate: options.countdownSubstate ?? 4,
    startAtMs: options.startAtMs ?? 100,
    finished: options.finished ?? false,
  };
  const physics = {
    body: { position: { y: options.y ?? -6 } },
    prepareLowHeightResetPose: () => trace.push("physics.prepareLowHeightResetPose"),
    consumeAutomaticResetRequest: () => {
      trace.push("physics.consumeAutomaticResetRequest");
      return options.explicitRequest ?? false;
    },
    lowSpeedAutomaticResetActive: snapshot => {
      trace.push(`physics.lowSpeedAutomaticResetActive:${snapshot}`);
      return options.lowSpeedActive ?? false;
    },
    beginResetInitiation: allow => {
      trace.push(`physics.beginResetInitiation:${allow}`);
      return options.beginAccepted ?? true;
    },
  };
  const host = {
    resourceVersion: options.version ?? "p3553",
    session: {
      lifecycle,
      speedResetState: "initial",
      coordinator: options.coordinator === false ? undefined : {
        synchronizePositionAnchor: () => trace.push("coordinator.synchronizePositionAnchor"),
      },
    },
    audio: { kartAudio: options.audio === false ? undefined : {
      playReset: () => trace.push("audio.playReset"),
    } },
    getPhysics: () => { trace.push("host.getPhysics"); return physics; },
    getDrivingSnapshot: () => { trace.push("host.getDrivingSnapshot"); return "snapshot"; },
  };
  const dependencies = {
    racingPhase: 4,
    isRaceFinished: value => { trace.push("isRaceFinished"); return value.finished; },
    beginResetState: previous => {
      trace.push(`beginResetState:${previous}`);
      return options.sameState ? previous : "next";
    },
  };
  Object.assign(context, {
    Ne: { Racing: dependencies.racingPhase },
    Un: dependencies.isRaceFinished,
    mL: dependencies.beginResetState,
  });
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  stage.host = host;
  stage.lowSpeedResetStartedAtMs = options.timer ?? 0;
  if (kind === "rewrite") {
    stage.checkLowHeightReset = nowMs => checkLowHeightReset(stage, nowMs, dependencies);
    stage.checkAutomaticReset = nowMs => checkAutomaticReset(stage, nowMs, dependencies);
    stage.initiateSpeedReset = allow => initiateSpeedReset(stage, allow, dependencies);
  }
  for (const argument of options.arguments ?? [200]) stage[method](argument);
  return {
    trace,
    state: host.session.speedResetState,
    timer: stage.lowSpeedResetStartedAtMs,
  };
}

test("low-height reset gates and reset initiation match release", () => {
  for (const options of [
    {}, { y: -4 }, { version: "legacy" }, { phase: 2 },
    { countdownSubstate: 3 }, { startAtMs: 300 },
    { finished: true }, { sameState: true }, { beginAccepted: false },
    { coordinator: false, audio: false },
  ]) {
    assert.deepEqual(run("rewrite", "checkLowHeightReset", options),
      run("release", "checkLowHeightReset", options));
  }
});

test("automatic reset requests and low-speed timer match release", () => {
  for (const options of [
    { explicitRequest: true }, { lowSpeedActive: false, timer: 100 },
    { lowSpeedActive: true, arguments: [200] },
    { lowSpeedActive: true, arguments: [200, 2201] },
    { lowSpeedActive: true, timer: 100, arguments: [2101] },
    { phase: 2, lowSpeedActive: true },
    { countdownSubstate: 3, explicitRequest: true },
    { startAtMs: 300, explicitRequest: true },
  ]) {
    assert.deepEqual(run("rewrite", "checkAutomaticReset", options),
      run("release", "checkAutomaticReset", options));
  }
});

test("reset transition and optional audio match release", () => {
  for (const options of [
    {}, { finished: true }, { sameState: true },
    { beginAccepted: false }, { audio: false },
  ]) {
    assert.deepEqual(run("rewrite", "initiateSpeedReset", options),
      run("release", "initiateSpeedReset", options));
  }
});
