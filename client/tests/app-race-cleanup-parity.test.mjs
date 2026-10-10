import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { releaseRaceForReady } from "../src/app/race-cleanup.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "vf0");
const method = declaration?.body.body.find(node =>
  node.type === "ClassMethod" && node.key.name === "releaseRaceForReady");
assert.ok(method);
const context = {};
runInNewContext(`class ReleasedPresenter { ${source.slice(method.start, method.end)} }
globalThis.ReleasedPresenter = ReleasedPresenter;`, context);

const sessionDisposables = [
  "outlineBatch", "vehicleRender", "flyingPet", "characterRender",
  "linkedCharacterRender", "kartEffects", "balloonDecoration", "kartTrails",
  "kartDriftEffects", "kartMotionBlur", "zetAirEffect", "shockWaveEffect",
  "exhaustEffect", "crashEffect", "chargerEffect", "particleModification",
  "particleModificationBanner", "trackEventEffects", "trackEventAudio",
  "trackDummyAudio", "lampFlares", "simpleShadow", "tachometer",
  "pause", "rain", "rainAudio", "snow", "toonEnvironment",
];

function run(kind, populated) {
  const trace = [];
  const disposable = name => ({ dispose: argument => trace.push(`dispose:${name}:${argument}`) });
  const session = {
    track: populated ? {
      ...disposable("track"),
      group: { removeFromParent: () => trace.push("track.removeFromParent") },
    } : undefined,
    physics: populated ? { hardCancelControls: () => trace.push("physics.cancel") } : undefined,
    coordinator: populated ? disposable("coordinator") : undefined,
    ghosts: populated
      ? [{ view: disposable("ghost.1") }, { view: disposable("ghost.2") }]
      : [],
    characterDecorations: populated
      ? [{ render: disposable("decoration.1") }, { render: disposable("decoration.2") }]
      : [],
    pendingCharacterFinishMotion: 8,
    linkedCharacterPresentation: "linked",
    particleModificationBannerRequest: "pending",
    raceAura: "aura",
    trackMetadata: "metadata",
    readyCamera: "ready-camera",
    warpNextCamera: "warp-camera",
    admission: "admission",
  };
  for (const name of sessionDisposables) {
    session[name] = populated ? disposable(name) : undefined;
  }
  const host = {
    session,
    hud: {
      finishPerformanceRace: () => trace.push("hud.finishPerformanceRace"),
      setPaused: paused => trace.push(`hud.setPaused:${paused}`),
    },
    shell: {
      enterReady: () => trace.push("shell.enterReady"),
      clearHalt: () => trace.push("shell.clearHalt"),
    },
    input: { setEnabled: enabled => trace.push(`input.setEnabled:${enabled}`) },
    drivingInput: { cancel: () => trace.push("drivingInput.cancel") },
    autoForward: { cancel: () => trace.push("autoForward.cancel") },
    audio: {
      countdownAudio: populated ? disposable("countdownAudio") : undefined,
      kartAudio: populated ? disposable("kartAudio") : undefined,
    },
    toonStageBinding: {
      retain: environment => trace.push(`toon.retain:${environment === session.toonEnvironment}`),
      prepareCoatingStage: () => {
        trace.push("toon.prepareCoatingStage");
        return { commit: () => trace.push("toon.commit") };
      },
      setLightFactor: factor => trace.push(`toon.light:${factor}`),
    },
    kartView: { clearModel: () => trace.push("kartView.clearModel") },
    scene: { visible: true },
    ghostRecorder: "recorder",
    currentPlayerSlot: 3,
    setPaused: paused => trace.push(`host.setPaused:${paused}`),
  };
  const dependencies = {
    setToonLinesEnabled: enabled => trace.push(`toon.lines:${enabled}`),
    newSpeedResetState: () => { trace.push("newSpeedResetState"); return "reset"; },
    nowMs: () => { trace.push("performance.now"); return 18234; },
  };
  Object.assign(context, {
    Pp: dependencies.setToonLinesEnabled,
    pr: dependencies.newSpeedResetState,
    performance: { now: dependencies.nowMs },
  });
  const presenter = kind === "release" ? new context.ReleasedPresenter() : {};
  presenter.host = host;
  presenter.previousRenderTime = 0;
  presenter.disposeRaceInterface = () => trace.push("presenter.disposeRaceInterface");
  presenter.changeStage = name => trace.push(`presenter.changeStage:${name}`);
  if (kind === "rewrite") {
    presenter.releaseRaceForReady = () => releaseRaceForReady(presenter, dependencies);
  }
  presenter.releaseRaceForReady();
  return {
    trace,
    previousRenderTime: presenter.previousRenderTime,
    currentPlayerSlot: host.currentPlayerSlot,
    ghostRecorder: String(host.ghostRecorder),
    sceneVisible: host.scene.visible,
    sessionFields: Object.keys(session).sort().map(name =>
      `${name}:${session[name] === undefined ? "undefined" :
        Array.isArray(session[name]) ? session[name].length : String(session[name])}`),
    audioFields: Object.keys(host.audio).sort().map(name => `${name}:${String(host.audio[name])}`),
  };
}

test("release race cleanup matches the release client with a populated race", () => {
  assert.deepEqual(run("rewrite", true), run("release", true));
});

test("release race cleanup matches the release client without a loaded track", () => {
  assert.deepEqual(run("rewrite", false), run("release", false));
});
