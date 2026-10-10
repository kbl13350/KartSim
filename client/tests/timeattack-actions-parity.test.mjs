import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import {
  dispatchTimeAttackActions,
  handleTimeAttackFinishAction,
  playTimeAttackActionAudio,
  showTimeAttackResult,
} from "../src/timeattack/action-dispatch.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
assert.ok(declaration);
const names = new Set([
  "handleTimeAttackActions", "handleTimeAttackActionAudio",
  "handleTimeAttackFinishAction", "showTimeAttackResult",
]);
const methods = declaration.body.body
  .filter(node => node.type === "ClassMethod" && names.has(node.key.name))
  .map(node => source.slice(node.start, node.end));
assert.equal(methods.length, names.size);
const context = { Error };
runInNewContext(`class ReleasedActionStage { ${methods.join("\n")} }
globalThis.ReleasedActionStage = ReleasedActionStage;`, context);

const actions = [
  { kind: "schedule-start-effect", atMs: 4000 },
  { kind: "ready-camera" },
  { kind: "countdown-number", value: 3 },
  { kind: "countdown-number", value: 2 },
  { kind: "countdown-number", value: 1 },
  { kind: "switch-drive-camera" },
  { kind: "release-race", startAtMs: 7000 },
  { kind: "countdown-go" },
  { kind: "lap", value: 2 },
  { kind: "final-lap" },
  { kind: "finish", elapsedMs: 13000 },
  { kind: "switch-surround-camera" },
  { kind: "play-result-bgm", beatTarget: true },
  { kind: "show-result", elapsedMs: 13000, previousBestMs: 14000, bestMs: 13000, isNewRecord: true },
  { kind: "return-to-ready" },
];

function createStage(kind, fail = false) {
  const trace = [];
  const stage = kind === "release" ? new context.ReleasedActionStage() : {};
  const action2D = {
    scheduleStart: value => trace.push(`start:${value}`),
    showLap: (lap, now) => trace.push(`lap:${lap}:${now}`),
    showFinalLap: now => trace.push(`final-lap:${now}`),
    showFinish: now => trace.push(`finish:${now}`),
    showNewRecord: now => trace.push(`new-record:${now}`),
  };
  const countdownAudio = {
    playNumber: () => trace.push("audio.number"),
    playGo: () => trace.push("audio.go"),
    playLap: () => trace.push("audio.lap"),
    playFinalLap: () => trace.push("audio.final-lap"),
  };
  const host = {
    session: {
      flyingPet: { launch: () => trace.push("pet.launch") },
      linkedCharacterPresentation: { setMode: value => trace.push(`linked.mode:${value}`) },
      raceAura: { requestDespawn: () => trace.push("aura.despawn") },
      readyCamera: { start: () => trace.push("camera.ready") },
      pendingCharacterFinishMotion: 0,
      lifecycle: {
        effectiveTime: raw => raw - 300,
        resultBeatTarget: () => true,
        acceptLocalCompletion: () => trace.push("lifecycle.accept"),
      },
    },
    scene: { visible: false },
    input: { setEnabled: enabled => trace.push(`input:${enabled}`) },
    driveCameraman: { reset: () => trace.push("camera.drive") },
    surroundCameraman: { reset: () => trace.push("camera.surround") },
    getPhysics: () => ({
      setRaceMotionLocked: locked => trace.push(`physics.lock:${locked}`),
      timeAttackResultCounts: () => ({ collisions: 3, boosts: 2 }),
    }),
    hud: {
      finishPerformanceRace: () => trace.push("hud.finish"),
      showDebugText: (message, level) => trace.push(`hud.${level}:${message}`),
    },
    audio: { bgm: { playResult: beat => trace.push(`bgm.result:${beat}`) } },
    async returnToReady() {
      trace.push("ready.return");
      if (fail) throw new Error("ready failed");
    },
    async promoteTimeAttackRecord(time, counts) {
      trace.push(`record.promote:${time}:${counts.collisions}`);
      if (fail) throw new Error("save failed");
    },
  };
  Object.assign(stage, {
    action2D,
    countdownAudio,
    host,
    ui: {
      trackInfoCard: { slideOut: () => trace.push("track-card.slide") },
      result: { show: result => trace.push(`result:${JSON.stringify(result)}`) },
    },
  });
  if (kind === "rewrite") {
    stage.handleTimeAttackActions = (value, now) => dispatchTimeAttackActions(stage, value, now);
    stage.handleTimeAttackActionAudio = (value, now) => playTimeAttackActionAudio(stage, value, now);
    stage.handleTimeAttackFinishAction = (value, now) => handleTimeAttackFinishAction(stage, value, now);
    stage.showTimeAttackResult = (value, now) => showTimeAttackResult(stage, value, now);
  }
  host.handleTimeAttackActionAudio = (value, now) => stage.handleTimeAttackActionAudio(value, now);
  return { stage, host, trace };
}

async function run(kind, fail) {
  const { stage, host, trace } = createStage(kind, fail);
  stage.handleTimeAttackActions(actions, 15500);
  await Promise.resolve();
  await Promise.resolve();
  return {
    trace,
    cameraMode: host.session.cameraMode,
    pendingCharacterFinishMotion: host.session.pendingCharacterFinishMotion,
    sceneVisible: host.scene.visible,
  };
}

test("time attack countdown, finish and result action order matches release", async () => {
  for (const fail of [false, true]) {
    assert.deepEqual(await run("rewrite", fail), await run("release", fail));
  }
});

test("result renderer validation and non-record result match release", () => {
  const action = { kind: "show-result", elapsedMs: 15000, previousBestMs: 14000, bestMs: 14000, isNewRecord: false };
  const outputs = [];
  for (const kind of ["rewrite", "release"]) {
    const { stage, trace } = createStage(kind);
    stage.showTimeAttackResult(action, 20000);
    outputs.push([...trace]);
    stage.ui.result = undefined;
    let error;
    try { stage.showTimeAttackResult(action, 20000); } catch (caught) { error = caught.message; }
    outputs.push(error);
  }
  assert.deepEqual(outputs[0], outputs[2]);
  assert.equal(outputs[1], outputs[3]);
});
