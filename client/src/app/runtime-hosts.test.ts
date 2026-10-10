import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  createDrivingPipelineHost, createRaceBuilderHost,
  getOrCreateDrivingPipeline, getOrCreateRaceBuilder,
  type DrivingPipelineHost, type RaceBuilderHost, type RuntimeHostApplication,
} from "./runtime-hosts";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const selected = new Set([
  "raceBuilder", "createRaceBuilderHost", "drivingPipeline", "createDrivingPipelineHost",
]);
const members = ast.program.body[0].body.body.filter((member: any) =>
  member.key?.type === "Identifier" && selected.has(member.key.name));
assert.equal(members.length, selected.size);
const originalSource = members.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type Event = unknown[];
type TestedHost = RuntimeHostApplication & {
  readonly raceBuilder: Builder;
  readonly drivingPipeline: Pipeline;
};

class Builder {
  constructor(readonly host: RaceBuilderHost) {}
}
class Pipeline {
  constructor(readonly host: DrivingPipelineHost) {}
}

function makeHost(rewritten: boolean): {
  host: TestedHost;
  events: Event[];
  navigatorMock: { getGamepads?: () => string[] };
} {
  const events: Event[] = [];
  const navigatorMock: { getGamepads?: () => string[] } = {
    getGamepads() { events.push(["navigator-gamepads", this === navigatorMock]); return ["pad-a"]; },
  };
  class OriginalBuilder extends Builder {
    constructor(host: RaceBuilderHost) {
      super(host);
      events.push(["new-builder"]);
    }
  }
  class OriginalPipeline extends Pipeline {
    constructor(host: DrivingPipelineHost) {
      super(host);
      events.push(["new-pipeline"]);
    }
  }
  const recordKey = (selection: unknown, options: unknown) => {
    events.push(["record-key", selection, options]);
    return "record-id";
  };
  const Original = new Function("if0", "n60", "_f0", "Pt", "navigator",
    `return class { ${originalSource} };`)(
      OriginalBuilder, OriginalPipeline, 0, { recordKey }, navigatorMock,
    ) as new () => TestedHost;
  const host = new Original();
  host.importer = "importer-1";
  host.targetRandom = "random-1";
  host.toonStageBinding = "toon-1";
  host.renderer = "renderer-1";
  host.scene = "scene-1";
  host.userProfile = "profile-1";
  host.gameOptions = { shadow: true, gamepadMap: "map-1" };
  host.hud = "hud-1";
  host.root = "root-1";
  host.kartView = "kart-view-1";
  host.replayLibrary = { store: "store-1", records: "records-1" };
  host.audio = "audio-1";
  host.ghostSamplingMode = "sample-1";
  host.rhoLibrary = "library-1";
  host.assets = {
    generationValue: 5,
    isCurrent: generation => { events.push(["is-current", generation]); return generation === 5; },
    require: asset => { events.push(["require", asset]); return `loaded-${String(asset)}`; },
    preloadContainers: (...args) => {
      events.push(["preload", ...args]);
      return "preloaded";
    },
  };
  host.session = {
    vehicleTitle: "old-kart", lifecycle: "lifecycle-1",
    tachometer: "tachometer-1", lampFlares: "lamps-1",
  };
  host.input = "input-1";
  host.drivingInput = "driving-input-1";
  host.autoForward = "auto-forward-1";
  host.nitroSeamless = "nitro-1";
  host.gamepad = "gamepad-1";
  host.touchControls = {
    resumeAutoForwardForGamepad: () => { events.push(["resume-auto-forward"]); return "resumed"; },
  };
  host.physics = "physics-1";
  host.togglePause = () => { events.push(["toggle-pause"]); return "paused"; };
  host.restartRaceFromPause = () => { events.push(["restart-race"]); return "restarted"; };
  host.returnToReady = () => { events.push(["return-ready"]); return "returned"; };
  host.initiateSpeedReset = allowCurrentSpeed => {
    events.push(["speed-reset", allowCurrentSpeed]);
    return "reset-requested";
  };

  if (rewritten) {
    host.createRaceBuilderHost = () => createRaceBuilderHost(host, 0, recordKey);
    host.createDrivingPipelineHost = () => createDrivingPipelineHost(host,
      () => navigatorMock.getGamepads?.());
    Object.defineProperties(host, {
      raceBuilder: { configurable: true, get: () => getOrCreateRaceBuilder(host,
        bridge => new OriginalBuilder(bridge)) },
      drivingPipeline: { configurable: true, get: () => getOrCreateDrivingPipeline(host,
        bridge => new OriginalPipeline(bridge)) },
    });
  }
  return { host, events, navigatorMock };
}

function inspect(rewritten: boolean): unknown {
  const { host, events, navigatorMock } = makeHost(rewritten);
  const builder = host.createRaceBuilderHost();
  const driving = host.createDrivingPipelineHost();

  // Original hosts use accessors. Every value below should reflect changes
  // made after the bridge was created, not a construction-time snapshot.
  host.importer = "importer-2";
  host.gameOptions = { shadow: false, gamepadMap: "map-2" };
  host.replayLibrary = { store: "store-2", records: "records-2" };
  host.session.lifecycle = "lifecycle-2";
  host.session.tachometer = "tachometer-2";
  host.session.lampFlares = "lamps-2";
  host.physics = "physics-2";
  const getters = {
    builderKeys: Object.keys(builder),
    importer: builder.importer,
    targetRandom: builder.targetRandom,
    toonStageBinding: builder.toonStageBinding,
    renderer: builder.renderer,
    scene: builder.scene,
    userProfile: builder.userProfile,
    shadow: builder.shadow,
    hud: builder.hud,
    root: builder.root,
    kartView: builder.kartView,
    ghostStore: builder.ghostStore,
    timeAttackRecords: builder.timeAttackRecords,
    sameGameOptions: builder.gameOptions === host.gameOptions,
    audio: builder.audio,
    webTimeAttackAiDyeId: builder.webTimeAttackAiDyeId,
    ghostSamplingMode: builder.ghostSamplingMode,
    drivingKeys: Object.keys(driving),
    input: driving.input,
    drivingInput: driving.drivingInput,
    autoForward: driving.autoForward,
    nitroSeamless: driving.nitroSeamless,
    gamepad: driving.gamepad,
  };
  const actions = {
    library: builder.getLibrary(),
    generation: builder.generationValue(),
    current: builder.isGenerationCurrent(5),
    missing: builder.isGenerationCurrent(7),
    asset: builder.requireAsset("car.rho"),
    preload: (builder.preloadContainers as (...args: unknown[]) => unknown)(
      "a", "b", "c", "d", "ignored-extra",
    ),
    vehicleTitle: (builder.setVehicleTitle("new-kart"), host.session.vehicleTitle),
    pause: builder.togglePause(),
    restart: builder.restartRaceFromPause(),
    returnReady: builder.returnToReady(),
    recordKey: builder.timeAttackRecordKey("race", "options"),
    pads: driving.getGamepadPads(),
    gamepadMap: driving.getGamepadMap(),
    resumeAutoForward: driving.resumeGamepadAutoForward(),
    physics: driving.getPhysics(),
    lifecycle: driving.getLifecycle(),
    tachometer: driving.getTachometer(),
    lampFlares: driving.getLampFlares(),
    speedReset: driving.handleSpeedReset(true),
  };
  navigatorMock.getGamepads = undefined;
  const missingPads = driving.getGamepadPads();

  const firstBuilder = host.raceBuilder;
  const secondBuilder = host.raceBuilder;
  host.raceBuilderInstance = null;
  const thirdBuilder = host.raceBuilder;
  const firstPipeline = host.drivingPipeline;
  const secondPipeline = host.drivingPipeline;
  host.drivingPipelineInstance = null;
  const thirdPipeline = host.drivingPipeline;
  const lazy = {
    builderCached: firstBuilder === secondBuilder,
    builderRecreatedAfterNull: thirdBuilder !== firstBuilder,
    builderUsesLiveHost: thirdBuilder.host.importer,
    pipelineCached: firstPipeline === secondPipeline,
    pipelineRecreatedAfterNull: thirdPipeline !== firstPipeline,
    pipelineUsesLiveHost: thirdPipeline.host.getPhysics(),
  };
  return { getters, actions, missingPads, lazy, events };
}

test("race builder and input pipeline hosts retain release accessors and callbacks", () => {
  assert.deepEqual(inspect(true), inspect(false));
});
