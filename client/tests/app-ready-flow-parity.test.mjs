import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { StageManager } from "../src/app/stage-manager.ts";
import { startSinglePlayerRace, returnToReady } from "../src/app/race-navigation.ts";
import {
  acquireReadyToonEnvironment,
  enterTimeAttackReady,
  openTrackSelect,
  readyStageContext,
  resolveRandomSelection,
  selectReadyChoice,
  selectReadyTrack,
  startRaceFromReady,
} from "../src/timeattack/ready-flow.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module" });

function releasedClass(name, methods, context = {}) {
  const declaration = ast.program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === name,
  );
  assert.ok(declaration, `released class ${name}`);
  const names = new Set(methods);
  const body = declaration.body.body
    .filter(node => node.type === "ClassMethod" && names.has(node.key.name))
    .map(node => source.slice(node.start, node.end));
  assert.equal(body.length, names.size, `released methods of ${name}`);
  const runtime = { ...context };
  runInNewContext(`class Reference {
    constructor(host) { this.host = host; }
    ${body.join("\n")}
  }
  globalThis.Reference = Reference;`, runtime);
  return runtime.Reference;
}

const ReleasedStageManager = releasedClass("wf0", [
  "register", "isRegistered", "changeStage", "enter", "update", "render", "onPacket",
  "currentName",
]);

function stageSequence(Type) {
  const trace = [];
  const manager = new Type();
  // The release class fields are omitted by the method extractor.
  if (Type === ReleasedStageManager) manager.factories = new Map();
  const stage = name => ({
    enter: param => trace.push([name, "enter", param]),
    exit: () => trace.push([name, "exit"]),
    update: frame => trace.push([name, "update", frame]),
    render: () => trace.push([name, "render"]),
    onPacket: packet => trace.push([name, "packet", packet]),
  });
  const before = manager.currentName;
  manager.register("ready", () => stage("ready"));
  manager.register("race", () => stage("race"));
  const known = manager.isRegistered("race");
  const unknown = manager.changeStage("unknown", 0);
  manager.changeStage("race", "discarded");
  manager.changeStage("ready", "profile");
  manager.enter();
  manager.update(1);
  manager.render();
  manager.onPacket("hello");
  const ready = manager.currentName;
  manager.changeStage("race", "track");
  manager.enter();
  manager.update(2);
  const race = manager.currentName;
  let duplicate;
  try { manager.register("race", () => stage("other")); } catch (error) { duplicate = error.message; }
  return { trace, before, known, unknown, ready, race, duplicate };
}

test("stage manager preserves pending transitions, callbacks, and duplicate errors", () => {
  assert.deepEqual(stageSequence(StageManager), stageSequence(ReleasedStageManager));
});

// Evaluate only the release methods under test with replaceable loader bindings.
const readyClass = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "ql0");
const readyNames = new Set([
  "readyStageContext", "acquireReadyToonEnvironment", "enterTimeAttackReady",
  "startRaceFromReady", "openTrackSelect", "selectReadyTrack", "selectReadyChoice",
  "resolveRandomSelection",
]);
const readyMethods = readyClass.body.body
  .filter(node => node.type === "ClassMethod" && readyNames.has(node.key.name))
  .map(node => source.slice(node.start, node.end));
const referenceGlobals = { Error };
runInNewContext(`
  const b4 = (...args) => globalThis.dependencies.findKart(...args);
  const ry = { load: options => globalThis.dependencies.loadTaskbar(options) };
  const ty = { load: options => globalThis.dependencies.loadReadyView(options) };
  const rn = { load: library => globalThis.dependencies.loadEnvironment(library) };
  const _7 = { load: options => globalThis.dependencies.loadTrackSelect(options) };
  const nT = (...args) => globalThis.dependencies.favoriteTrackIds(...args);
  const LR = (...args) => globalThis.dependencies.belongsToGroup(...args);
  class ds { constructor(root) { return globalThis.dependencies.createWindowNotice(root); } }
  class ReadyController {
    constructor(host) { this.host = host; this.disposed = false; }
    ${readyMethods.join("\n")}
  }
  globalThis.ReadyController = ReadyController;
`, referenceGlobals);

function readyHarness(kind, behavior = {}) {
  const trace = [];
  const selection = {
    mapPath: "track/first", trackId: "first", vehiclePath: "kart/a",
    vehicleItemId: 42, vehicleSystemKey: "a", characterPath: "char/a",
    characterItemId: 11,
  };
  const tracks = [
    { id: "first", path: "track/first", gameType: 1 },
    { id: "second", path: "track/second", gameType: 1 },
  ];
  const group = { id: "all", trackIds: ["first", "second"] };
  const environment = { dispose: () => trace.push("environment.dispose") };
  const taskbar = { setVisible: visible => trace.push(`taskbar.visible:${visible}`) };
  const view = {
    show: () => trace.push("ready.show"),
    dispose: () => trace.push("ready.dispose"),
  };
  const trackView = {
    show: () => trace.push("tracks.show"),
    dispose: () => trace.push("tracks.dispose"),
  };
  const state = { selection, readyOptions: { showGhost: true }, readyViewOptions: undefined, trackViewOptions: undefined };
  const library = {
    async timeAttackGarageCatalog() {
      trace.push("catalog.garage");
      return { karts: [{ id: 42 }], characters: [{ itemId: 11, path: "CHAR/A" }] };
    },
    async timeAttackTrackCatalog() { trace.push("catalog.tracks"); return tracks; },
    async timeAttackRandomTrackGroups() { trace.push("catalog.groups"); return [group]; },
    async timeAttackRandomTrackNames() { trace.push("catalog.names"); return new Map(); },
  };
  const host = {
    root: {}, toonStageBinding: {},
    shell: {
      isReadyStageOpening: false, started: false, modal: undefined,
      beginReadyStage() { trace.push("shell.beginReady"); this.isReadyStageOpening = true; },
      endReadyStage() { trace.push("shell.endReady"); this.isReadyStageOpening = false; },
      openModal(name) { trace.push(`shell.open:${name}`); this.modal = name; },
      closeModal(name) { trace.push(`shell.close:${name}`); this.modal = undefined; },
    },
    hud: {
      beginLoading: () => trace.push("hud.beginLoading"),
      finishLoading: () => trace.push("hud.finishLoading"),
      showDebugText: (message, kind) => trace.push(`hud.${kind}:${message}`),
    },
    getSelection: () => state.selection,
    setSelection(value) { state.selection = value; trace.push(`selection:${value.trackId}`); },
    getReadyOptions: () => state.readyOptions,
    setReadyOptions(value) { state.readyOptions = value; trace.push(`options:${JSON.stringify(value)}`); },
    getLibrary: () => behavior.noLibrary ? undefined : library,
    getBgm: () => behavior.noBgm ? undefined : { playReady: () => trace.push("bgm.ready") },
    getProfile: () => ({ favoriteTracks: ["first"] }),
    getRecordFor: key => `record:${key}`,
    getAudioContext: () => ({ resume: async () => { trace.push("audio.resume"); } }),
    getInterfaceAudio: () => undefined,
    releaseRaceForReady: () => trace.push("host.releaseRace"),
    enterRaceStart: () => { trace.push("race.enterStart"); return behavior.rejectStart !== true; },
    endRaceStart: () => trace.push("race.endStart"),
    async startRace(value) {
      trace.push(`race.start:${value.trackId}`);
      if (behavior.raceError) throw new Error(behavior.raceError);
    },
    enterTimeAttackReady: async () => { trace.push("host.enterReady"); },
  };
  const dependencies = {
    findKart(_karts, itemId, path, systemKey) {
      trace.push(`kart:${itemId}:${path}:${systemKey}`);
      return { id: itemId };
    },
    async loadTaskbar(options) { trace.push("taskbar.load"); state.taskbarOptions = options; return taskbar; },
    async loadReadyView(options) { trace.push(`ready.load:${options.trackId}`); state.readyViewOptions = options; return view; },
    async loadEnvironment() { trace.push("environment.load"); return environment; },
    async loadTrackSelect(options) { trace.push("tracks.load"); state.trackViewOptions = options; return trackView; },
    favoriteTrackIds() { trace.push("favorites.normalize"); return ["first"]; },
    belongsToGroup(_group, gameType) { trace.push(`group.match:${gameType}`); return gameType === 1; },
    createWindowNotice() { trace.push("notice.create"); return { show: () => trace.push("notice.show") }; },
  };

  let controller;
  if (kind === "release") {
    referenceGlobals.dependencies = dependencies;
    controller = new referenceGlobals.ReadyController(host);
  } else {
    controller = { host, disposed: false };
    controller.readyStageContext = () => readyStageContext(controller);
    controller.acquireReadyToonEnvironment = lib =>
      acquireReadyToonEnvironment(controller, lib, dependencies.loadEnvironment);
    controller.enterTimeAttackReady = profile =>
      enterTimeAttackReady(controller, profile ?? host.getProfile(), dependencies);
    controller.startRaceFromReady = (value, options) => startRaceFromReady(controller, value, options);
    controller.openTrackSelect = (value, options) => openTrackSelect(controller, value, options, dependencies);
    controller.selectReadyTrack = (value, options, track) => selectReadyTrack(controller, value, options, track);
    controller.selectReadyChoice = (value, options, choice, catalog) =>
      selectReadyChoice(controller, value, options, choice, catalog, dependencies.belongsToGroup);
    controller.resolveRandomSelection = value => resolveRandomSelection(controller, value);
  }
  Object.assign(controller, {
    randomTrackSession: {
      selectGroup: id => trace.push(`group.select:${id}`),
      pick: () => { trace.push("group.pick"); return tracks[1]; },
    },
    readyModalBusy: () => false,
    showTrackSelectError: error => trace.push(`track.error:${error.message}`),
    changeFavoriteTrack: (track, favorite) => trace.push(`favorite:${track?.id}:${favorite}`),
    openSettings: () => trace.push("settings.open"),
    openGarageX: () => trace.push("garage.openX"),
    openGarage: () => trace.push("garage.open"),
    openMultiplayer: () => trace.push("multiplayer.open"),
    returnMultiplayerToSinglePlayer: () => trace.push("multiplayer.return"),
    returnGarageToReady: () => trace.push("garage.return"),
  });
  return { controller, host, dependencies, trace, state, group, tracks };
}

async function runMenuFlow(kind) {
  const harness = readyHarness(kind);
  const { controller, trace, state, group, tracks } = harness;
  await controller.enterTimeAttackReady();
  state.readyViewOptions.onHover();
  state.readyViewOptions.onStartActivate();
  await controller.openTrackSelect(state.selection, state.readyOptions);
  state.trackViewOptions.onFavoriteChange("first", true);
  state.trackViewOptions.onNotice("notice", "info", "detail");
  state.trackViewOptions.onConfirm({ kind: "random", group });
  await controller.startRaceFromReady(state.selection, state.readyOptions);
  controller.selectReadyChoice(state.selection, state.readyOptions, { kind: "track", track: tracks[0] }, tracks);
  return {
    trace,
    selection: state.selection,
    options: state.readyOptions,
    randomGroup: controller.activeRandomGroup?.id,
    trackSelectClosed: controller.activeTrackSelect === undefined,
  };
}

test("Ready menu, track modal, random pool, and race launch match release", async () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(await runMenuFlow("rewrite"))),
    JSON.parse(JSON.stringify(await runMenuFlow("release"))),
  );
});

test("Ready validation, duplicate start, and launch failure match release", async () => {
  for (const behavior of [{ noLibrary: true }, { noBgm: true }, { rejectStart: true }, { raceError: "failed" }]) {
    const output = [];
    for (const kind of ["rewrite", "release"]) {
      const harness = readyHarness(kind, behavior);
      let validation;
      try { harness.controller.readyStageContext(); } catch (error) { validation = error.message; }
      await harness.controller.startRaceFromReady(harness.state.selection, harness.state.readyOptions);
      output.push({ validation, trace: harness.trace });
    }
    assert.deepEqual(output[0], output[1], JSON.stringify(behavior));
  }
});

const applicationGlobals = { Error };
const applicationClass = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "Bf0");
const navigationMethods = applicationClass.body.body
  .filter(node => node.type === "ClassMethod" && ["startRace", "returnToReady"].includes(node.key.name))
  .map(node => source.slice(node.start, node.end));
assert.equal(navigationMethods.length, 2);
runInNewContext(`
  const Af0 = (...args) => globalThis.buildRace(...args);
  const eT = root => globalThis.createCurtain(root);
  class App { ${navigationMethods.join("\n")} }
  globalThis.App = App;
`, applicationGlobals);

async function runNavigation(kind, fail = false) {
  const trace = [];
  const app = kind === "release" ? new applicationGlobals.App() : {};
  const contextFields = {
    session: {}, audio: { context: { resume: async () => trace.push("audio.resume") } },
    cameras: {}, scene: {}, tachometerGaugePreserve: {},
    hud: { showDebugText: (message, level) => trace.push(`hud.${level}:${message}`) },
    input: {}, shell: { started: true }, ready: {}, replayLibrary: {}, presenter: {
      afterNextFrame: async callback => { trace.push("presenter.nextFrame"); return callback(); },
    },
    raceBuilder: {}, timeAttackReadyOptions: {}, localNickname: "driver", paused: false,
    racePageTransition: false, root: {},
    toonStageBinding: {
      prepareCoatingStage() { trace.push("coating.prepare"); return { dispose: () => trace.push("coating.dispose") }; },
    },
    replaceTrack: () => trace.push("track.replace"),
    applyRaceOptions: () => trace.push("options.apply"),
    async enterTimeAttackReady() {
      trace.push("ready.enter");
      if (fail) throw new Error("menu failed");
    },
  };
  Object.assign(app, contextFields);
  const builder = async (services, selected, stage) => {
    trace.push(`race.build:${selected.trackId}`);
    services.setPaused(true);
    services.replaceTrack({});
    services.applyRaceOptions({});
    return "started";
  };
  const curtain = () => { trace.push("curtain.create"); return () => trace.push("curtain.close"); };
  applicationGlobals.buildRace = builder;
  applicationGlobals.createCurtain = curtain;
  if (kind === "rewrite") {
    app.startRace = selection => startSinglePlayerRace(app, selection, builder);
    app.returnToReady = () => returnToReady(app, curtain);
  }
  const result = await app.startRace({ trackId: "first" });
  await app.returnToReady();
  return { trace, result, paused: app.paused, racePageTransition: app.racePageTransition };
}

test("application race preparation and return-to-Ready match release", async () => {
  for (const fail of [false, true]) {
    assert.deepEqual(await runNavigation("rewrite", fail), await runNavigation("release", fail));
  }
});
