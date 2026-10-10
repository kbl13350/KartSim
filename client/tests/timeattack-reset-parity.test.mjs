import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { restartTimeAttackRace } from "../src/timeattack/race-reset.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
assert.ok(declaration);
const method = declaration.body.body.find(node =>
  node.type === "ClassMethod" && node.key.name === "restartRace",
);
assert.ok(method);
const globals = { Error, H2: "world-axis", $2: "depth-axis", performance: { now: () => 12345 } };
runInNewContext(`
  const pr = () => globalThis.dependencies.newSpeedResetState();
  const pf0 = slots => globalThis.dependencies.selectPlayerSlot(slots);
  const B6 = trackId => globalThis.dependencies.recordingKey(trackId);
  const nG = (time, start) => globalThis.dependencies.ghostRelativeTime(time, start);
  class cf0 {
    constructor(key) { return globalThis.dependencies.createRecorder(key); }
  }
  class ReleasedStage { ${source.slice(method.start, method.end)} }
  globalThis.ReleasedStage = ReleasedStage;
`, globals);

function harness(kind, options = {}) {
  const trace = [];
  const stage = kind === "release" ? new globals.ReleasedStage() : {};
  const reset = name => ({ reset: () => trace.push(`${name}.reset`) });
  const session = {
    pendingCharacterFinishMotion: 99,
    speedResetState: "old",
    pause: { setVisible: visible => trace.push(`pause.visible:${visible}`) },
    physics: options.missingPhysics ? undefined : { hardCancelControls: () => trace.push("physics.cancel") },
    coordinator: { dispose: () => trace.push("coordinator.dispose") },
    kartDriftEffects: reset("drift"),
    kartMotionBlur: reset("blur"),
    zetAirEffect: reset("air"),
    shockWaveEffect: reset("shock"),
    exhaustEffect: reset("exhaust"),
    crashEffect: reset("crash"),
    chargerEffect: reset("charger"),
    flyingPet: reset("pet"),
    characterRender: reset("character"),
    linkedCharacterRender: reset("linked-character"),
    linkedCharacterPresentation: { resetForRacePresentation: () => trace.push("linked-presentation.reset") },
    driveCameraState: {}, surroundCameraState: {}, cameraMode: "drive", warpCameraFrozen: true,
    track: {
      data: {
        trackId: "village_I01",
        weather: options.dry ? {} : { rainEnabled: true, rainOnStart: true, snowEnabled: true },
      },
      resetRender: (time, _camera, first, second) => trace.push(`track.reset:${time}:${first}:${second}`),
    },
    rain: { reset: enabled => trace.push(`rain.reset:${enabled}`) },
    snow: reset("snow"),
    ghosts: [{ startSlot: 2 }, { startSlot: 5 }],
    admission: options.missingAdmission ? undefined : { ticket: 1 },
    lifecycle: {
      startAtMs: 7000,
      reset: () => { trace.push("lifecycle.reset"); return [{ kind: "ready-camera" }]; },
    },
  };
  const host = {
    session,
    presentationClockMs: 120,
    previousRenderTime: 20,
    currentPlayerSlot: -1,
    touchControls: { releaseAll: () => trace.push("touch.release") },
    shell: { clearHalt: () => trace.push("shell.clearHalt") },
    setPaused: paused => trace.push(`host.paused:${paused}`),
    input: { cancelAll: () => trace.push("input.cancel") },
    drivingInput: { cancel: () => trace.push("driving.cancel") },
    autoForward: { cancel: () => trace.push("auto-forward.cancel") },
    tachometerGaugePreserve: reset("gauge"),
    audio: {
      kartAudio: options.missingAudio ? undefined : { resetRace: () => trace.push("kart-audio.reset") },
      countdownAudio: reset("countdown-audio"),
      bgm: { restart: () => trace.push("bgm.restart"), currentRaceName: "race bgm" },
    },
    kartView: { resetAnimation: () => trace.push("kart.animation-reset"), root: { visible: false } },
    driveCameraman: reset("drive-camera"),
    surroundCameraman: reset("surround-camera"),
    warpNext: reset("warp-next"),
    cameraShake: { leave: forced => trace.push(`shake.leave:${forced}`) },
    cameraWave: { leave: () => trace.push("wave.leave") },
    toonStageBinding: { setLightFactor: factor => trace.push(`light:${factor}`) },
    camera: {},
    currentGhostEquipment: () => options.noEquipment ? undefined : { kart: 42 },
    getPhysics: () => ({ setRaceMotionLocked: locked => trace.push(`physics.lock:${locked}`) }),
    handleTimeAttackActions: (actions, now) => trace.push(`actions:${actions[0].kind}:${now}`),
    hud: { setPaused: paused => trace.push(`hud.paused:${paused}`) },
  };
  Object.assign(stage, {
    host,
    lowSpeedResetStartedAtMs: 100,
    ui: {
      result: { hide: () => trace.push("result.hide") },
      gameplayUi: reset("gameplay"),
      action2D: reset("action2d"),
      trackInfoCard: {
        setBgmName: name => trace.push(`track-card.bgm:${name}`),
        setVisible: visible => trace.push(`track-card.visible:${visible}`),
      },
    },
    placeAtStart: () => trace.push("place.start"),
    createCoordinator: (_admission, _track, _physics) => {
      trace.push("coordinator.create");
      return { dispose: () => trace.push("new-coordinator.dispose") };
    },
    captureGhostRuntime: atMs => { trace.push(`ghost.capture:${atMs}`); return atMs; },
  });
  const dependencies = {
    newSpeedResetState: () => { trace.push("reset-state.create"); return { phase: 0 }; },
    worldAxis: "world-axis",
    depthAxis: "depth-axis",
    selectPlayerSlot: slots => { trace.push(`slot.select:${slots.join(",")}`); return 3; },
    recordingKey: trackId => { trace.push(`key:${trackId}`); return `key:${trackId}`; },
    createRecorder: key => {
      trace.push(`recorder.create:${key}`);
      return { addParticipant: participant => { trace.push("recorder.participant"); host.lastParticipant = participant; } };
    },
    ghostRelativeTime: (atMs, start) => { trace.push(`ghost.relative:${atMs}:${start}`); return atMs - start; },
    nowMs: () => 12345,
  };
  globals.dependencies = dependencies;
  return { stage, host, trace, dependencies };
}

function run(kind, options = {}) {
  const { stage, host, trace, dependencies } = harness(kind, options);
  let error;
  try {
    if (kind === "release") stage.restartRace();
    else restartTimeAttackRace(stage, dependencies);
  } catch (caught) { error = caught.message; }
  if (host.lastParticipant) host.lastParticipant.sample(8000);
  return {
    trace,
    error,
    lowSpeedResetStartedAtMs: stage.lowSpeedResetStartedAtMs,
    presentationClockMs: host.presentationClockMs,
    previousRenderTime: host.previousRenderTime,
    currentPlayerSlot: host.currentPlayerSlot,
    coordinatorExists: Boolean(host.session.coordinator),
    recorderExists: Boolean(host.ghostRecorder),
    cameraMode: host.session.cameraMode,
    kartVisible: host.kartView.root.visible,
  };
}

test("race owner reset and fresh recorder initialization match release", () => {
  for (const options of [{}, { dry: true, noEquipment: true }]) {
    assert.deepEqual(run("rewrite", options), run("release", options));
  }
});

test("missing runtime owner guard matches release after cleanup", () => {
  for (const options of [{ missingAdmission: true }, { missingPhysics: true }, { missingAudio: true }]) {
    assert.deepEqual(run("rewrite", options), run("release", options));
  }
});
