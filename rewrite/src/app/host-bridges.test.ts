import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  createPresenterHost, createReadyHost,
  getOrCreatePresenter, getOrCreateReadyCoordinator,
} from "./host-bridges";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module" });
const originalClass = ast.program.body.find((node: any) =>
  node.type === "ClassDeclaration" && node.id?.name === "Bf0");
assert.ok(originalClass);
const names = new Set([
  "ready", "presenter", "createReadyHost", "createPresenterHost",
]);
const methods = originalClass.body.body.filter((member: any) =>
  member.key?.type === "Identifier" && names.has(member.key.name));
assert.equal(methods.length, names.size);
const methodSource = methods.map((member: any) => source.slice(member.start, member.end)).join("\n");

function makeApplication(rewritten: boolean) {
  const events: unknown[][] = [];
  const dependencies = {
    Hs0: (configuration: any) => configuration,
    Qc: (_context: unknown, options: unknown) => events.push(["audio-options", options]),
    Pt: { recordKey: (selection: unknown, speed: unknown) => {
      events.push(["record-key", selection, speed]);
      return "record-key";
    } },
    cT: (profile: unknown) => events.push(["save-profile", profile]),
    vf0: class {
      constructor(public host: unknown, public previousTime: number) {
        events.push(["new-presenter", previousTime]);
      }
    },
    ql0: class {
      constructor(public host: unknown) { events.push(["new-ready"]); }
    },
  };
  const Original = new Function(...Object.keys(dependencies),
    `return class { ${methodSource} };`)(...Object.values(dependencies)) as new () => any;
  const app: any = rewritten ? {} : new Original();
  if (rewritten) {
    app.createReadyHost = () => createReadyHost(app, {
      makeMultiplayerRaceLoader: dependencies.Hs0,
      applyAudioOptions: dependencies.Qc,
      recordKey: dependencies.Pt.recordKey,
      saveProfile: dependencies.cT,
    });
    app.createPresenterHost = () => createPresenterHost(app);
    Object.defineProperty(app, "ready", {
      get: () => getOrCreateReadyCoordinator(app, host => new dependencies.ql0(host)),
    });
    Object.defineProperty(app, "presenter", {
      get: () => getOrCreatePresenter(app,
        (host, previousTime) => new dependencies.vf0(host, previousTime)),
    });
  }
  const call = (name: string) => (...args: unknown[]) => {
    events.push([name, ...args]);
    return `${name}-result`;
  };
  Object.assign(app, {
    root: "root", shell: { beginRaceStart: call("begin-race"), endRaceStart: call("end-race") },
    toonStageBinding: "toon", renderer: { info: { programs: [1, 2, 3] } },
    hud: { beginPerformanceRace: call("begin-performance"),
      finishPerformanceRace: call("end-performance"), showDebugText: call("debug") },
    input: { setKeyMap: call("input-map") },
    touchControls: { setKeyMap: call("touch-map") },
    autoForward: "auto", rhoLibrary: "library", userProfile: "profile",
    audio: { context: "context", bgm: "bgm", interfaceAudio: { playSlotChanger: call("slot-sound") } },
    gameOptions: { inGameFlyingPetVisible: true, raceAnonymous: false,
      raceTimeGap: 13, classicHud: true },
    session: { selection: { trackId: "test-track" }, vehicleTitle: "kart" },
    timeAttackReadyOptions: "ready-options", replayLibrary: { record: call("record") },
    raceStartProgramCount: 0, createRaceBuilderHost: call("race-builder-host"),
    releaseRaceForReady: call("release-race"), startRace: call("start-race"),
    enterTimeAttackReady: call("enter-ready"), selectReadyGarage: call("select-garage"),
    previewSettings: call("preview-settings"), confirmSettings: call("confirm-settings"),
    closeSettings: call("close-settings"), saveGameOptions: call("save-options"),
    racePresenter: {
      clientFramerate: 60, frameTimeSeconds: 0.016, presentationClockMs: 200,
      previousRenderTime: 8, maxRafDelayMs: 25,
      publishMultiplayer: call("publish"), releaseMultiplayer: call("release"),
    },
    readyCoordinator: "ready-coordinator", assets: { opfs: { version: "p3553" } },
    scene: "scene", camera: "camera", kartView: "kart-view", lightFactor: 1,
    nitroSeamless: "nitro", drivingInput: "driving-input", tachometerGaugePreserve: "tachometer",
    workProfiler: "profiler", cameras: { drive: "drive-camera", surround: "surround-camera" },
    warpNext: "warp", cameraShake: "shake", cameraWave: "wave", paused: false,
    engineRenderStats: "stats", drawingBufferSize: "buffer", ghostRecorder: "ghost",
    records: { currentEquipment: call("equipment") }, currentPlayerSlot: 1,
    physics: "physics", track: "track", devToolsObjectsOverlayHandle: {
      update: call("overlay-update"),
    },
    drainDrivingInput: call("drain-input"), getDrivingSnapshot: call("snapshot"),
    updateKartBoosterState: call("booster"), haltRuntime: call("halt"),
    updateHud: call("hud"), handleTimeAttackActions: call("actions"),
    handleTimeAttackActionAudio: call("action-audio"), updateTimeAttackRoute: call("route"),
    updateActiveRaceCamera: call("active-camera"), advanceResetCompletion: call("reset"),
    applyWarpNextActions: call("warp-actions"), promoteTimeAttackRecord: call("record-promote"),
    returnToReady: call("return-ready"),
  });
  return { app, events };
}

function readProperties(object: any) {
  return Object.getOwnPropertyNames(object)
    .filter(name => Object.getOwnPropertyDescriptor(object, name)?.get)
    .map(name => [name, object[name]]);
}

function exerciseReady(rewritten: boolean) {
  const { app, events } = makeApplication(rewritten);
  const host = app.createReadyHost();
  const loader = host.multiplayerRaceLoader;
  const loaderKeys = Object.keys(loader);
  const loaderValues = Object.entries(loader).filter(([, value]) => typeof value !== "function");
  const hostKeys = Object.keys(host);
  const hostGetters = readProperties(host);
  loader.assets(); loader.profile(); loader.audio(); loader.flyingPetVisible();
  loader.raceAnonymous(); loader.raceTimeGap(); loader.classicHud(); loader.bgm();
  loader.playSlotChanger(); loader.publish("race"); loader.release("race");
  loader.status("ignored", false); loader.status("failed", true);
  host.getLibrary(); host.getProfile(); host.setProfile("new-profile");
  host.getGameOptions(); host.setGameOptions({ ...app.gameOptions, classicHud: false });
  host.applyInputKeyMap({ keyMap: "controls" }); host.applyAudioOptions("options");
  host.getSelection(); host.setSelection({ trackId: "new-track" });
  host.getVehicleTitle(); host.setVehicleTitle("new-kart");
  host.getReadyOptions(); host.setReadyOptions("new-options");
  host.getBgm(); host.getAudioContext(); host.getInterfaceAudio();
  host.getRecordFor(7); host.saveProfile(); host.releaseRaceForReady();
  host.startRace("selection"); host.enterRaceStart(); host.endRaceStart();
  host.enterTimeAttackReady("selection"); host.selectReadyGarage("selection", "options", "choice");
  host.previewSettings("options"); host.confirmSettings("options", 7, "v");
  host.closeSettings(); host.saveGameOptions();
  return { loaderKeys, loaderValues, hostKeys, hostGetters, events,
    profile: app.userProfile, options: app.gameOptions, session: app.session,
    readyOptions: app.timeAttackReadyOptions, programCount: app.raceStartProgramCount };
}

test("Ready bridge getters and operations match the release", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(exerciseReady(true))),
    JSON.parse(JSON.stringify(exerciseReady(false))));
});

function exercisePresenter(rewritten: boolean) {
  const { app, events } = makeApplication(rewritten);
  const host = app.createPresenterHost();
  const keys = Object.keys(host);
  const getters = readProperties(host);
  host.presentationClockMs = 250; host.ghostRecorder = "new-ghost";
  host.currentPlayerSlot = 2; host.raceStartProgramCount = 9;
  host.previousRenderTime = 10; host.maxRafDelayMs = 45;
  host.currentGhostEquipment(); host.getPhysics(); host.getTrack();
  host.drainDrivingInput(1, 2); host.getDrivingSnapshot();
  host.updateKartBoosterState(1, 2, 3); host.haltRuntime("error", 7);
  host.updateHud(); host.setPaused(true); host.handleTimeAttackActions("action", 5);
  host.handleTimeAttackActionAudio("action", 5); host.updateTimeAttackRoute(1, 2, 3);
  host.updateActiveRaceCamera(6); host.updateDevToolsTrackObjects("track", 7, 8);
  host.advanceResetCompletion(9); host.applyWarpNextActions(10);
  host.promoteTimeAttackRecord(11, 12); host.returnToReady();
  return { keys, getters, events, presenter: app.racePresenter,
    ghostRecorder: app.ghostRecorder, slot: app.currentPlayerSlot,
    programCount: app.raceStartProgramCount, paused: app.paused };
}

test("presenter bridge getters, setters and callbacks match the release", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(exercisePresenter(true))),
    JSON.parse(JSON.stringify(exercisePresenter(false))));
});

test("Ready and presenter instances are cached with release nullish semantics", () => {
  for (const name of ["ready", "presenter"] as const) {
    const original = makeApplication(false);
    const rewritten = makeApplication(true);
    for (const { app } of [original, rewritten]) {
      if (name === "ready") app.readyCoordinator = undefined;
      else { app.racePresenter = undefined; app.presenterInitialPreviousRenderTime = 3.5; }
    }
    const run = ({ app, events }: ReturnType<typeof makeApplication>) => {
      const first = app[name];
      const same = first === app[name];
      if (name === "ready") app.readyCoordinator = null;
      else app.racePresenter = null;
      const replaced = first !== app[name];
      return { same, replaced, events };
    };
    assert.deepEqual(run(rewritten), run(original), name);
  }
});
