import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { buildSoloRaceAssets } from "../src/timeattack/race-asset-builder.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const builderNode = parse(release, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id.name === "if0");
assert.ok(builderNode);
const builderSource = release.slice(builderNode.start, builderNode.end);

async function run(kind, scenario) {
  const events = [];
  const selection = {
    mapPath: "track/map", trackId: "track",
    vehiclePath: "kart/path", vehicleItemId: 71,
    characterPath: "character/path", characterItemId: 37,
  };
  if (scenario === "incomplete") selection.characterPath = "";
  const catalog = scenario === "no-catalog" ? undefined : {
    karts: [{ itemId: 71, path: "kart/path" }],
    characters: scenario === "no-character" ? [] :
      [{ itemId: 37, path: "character/path" }],
  };
  const library = {
    async timeAttackGarageCatalog() {
      events.push("catalog");
      return catalog;
    },
    async timeAttackCharacterItem() {
      events.push("character-item");
      return undefined;
    },
  };
  const host = {
    gameOptions: { classicHud: false },
    generationValue() { events.push("generation"); return 3; },
    async preloadContainers(...paths) { events.push(["preload", ...paths]); },
    getLibrary() { events.push("library"); return library; },
  };
  const validateItemId = value => events.push(["item", value]);
  const findKart = entries => { events.push("find-kart"); return entries[0]; };
  const Original = new Function("ul", "j6", "b4",
    `${builderSource}; return if0;`)(class {}, validateItemId, findKart);
  const builder = kind === "readable" ? { host } : new Original(host);
  let error;
  try {
    if (kind === "readable")
      await buildSoloRaceAssets(builder, selection, { booster: 0 }, undefined,
        { validateItemId, findKart });
    else await builder.build(selection, { booster: 0 }, undefined);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return { events, error };
}

test("solo race asset selection and identity checks match the release", async () => {
  for (const scenario of ["incomplete", "no-catalog", "no-character",
    "no-character-item"]) {
    assert.deepEqual(await run("readable", scenario),
      await run("original", scenario), scenario);
  }
});

async function runBgmFailure(kind, failureStage = "bgm", hasSky = true) {
  const events = [];
  const selection = {
    mapPath: "track/map", trackId: "track",
    vehiclePath: "kart/path", vehicleItemId: 71,
    characterPath: "character/path", characterItemId: 37,
  };
  const catalog = {
    karts: [{ itemId: 71, path: "kart/path", engineGrade: 0,
      title: "Kart" }],
    characters: [{ itemId: 37, path: "character/path" }],
  };
  const library = {
    async timeAttackGarageCatalog() { events.push("catalog"); return catalog; },
    async timeAttackCharacterItem() { events.push("character-item"); return {}; },
  };
  const map = {
    metadata: { id: "track" },
    data: {},
    scene: { removeFromParent() {} },
    renderScene: { dispose: () => events.push("dispose-render") },
    skydome: hasSky ? { object: {},
      dispose: () => events.push("dispose-sky") } : undefined,
    environment: { dispose: () => events.push("dispose-environment") },
  };
  const host = {
    gameOptions: { classicHud: false },
    userProfile: { equipment: { itemIds: { 3: 71 }, kartSerial: 17 },
      garage: {} },
    audio: {},
    scene: { add() {} },
    renderer: {},
    timeAttackRecordKey() { return "track"; },
    generationValue() { events.push("generation"); return 3; },
    async preloadContainers(...paths) { events.push(["preload", ...paths]); },
    getLibrary() { events.push("library"); return library; },
    setVehicleTitle(title) { events.push(["title", title]); },
  };
  class AudioContextStub {
    state = "running";
    constructor() { events.push("new-audio"); }
    async resume() { events.push("resume-audio"); }
    close() { events.push("close-audio"); this.state = "closed"; }
  }
  const validateItemId = value => events.push(["item", value]);
  const findKart = entries => { events.push("find-kart"); return entries[0]; };
  const parameterFactory = () => ({ spec: { speed: 1 } });
  const speed = () => { events.push("speed"); return 2; };
  const garageState = () => { events.push("garage-state"); return {}; };
  const tuneSpec = () => { events.push("tune"); return {}; };
  const flyingPetItem = async () => { events.push("pet"); return undefined; };
  const finalizeSpec = () => { events.push("finalize"); return {}; };
  const particleModification = () => { events.push("particle"); return undefined; };
  const configureAudio = () => events.push("configure-audio");
  const loadRaceBgm = async () => {
    events.push("load-bgm");
    if (failureStage === "bgm") throw new Error("missing BGM");
    return { dispose: () => events.push("dispose-bgm") };
  };
  const disposable = { dispose() {} };
  const vehicle = {
    imported: { renderScene: disposable, object: {} },
    kartItem: {}, visual: {}, physicsParams: {}, accessories: [],
    effects: disposable, trails: disposable, driftEffects: disposable,
    zetAirEffect: disposable, shockWaveEffect: disposable,
    exhaustEffect: disposable, crashEffect: disposable,
    chargerEffect: disposable, lampFlares: disposable,
    simpleShadow: disposable, tachometerRenderer: disposable, audio: disposable,
  };
  const Original = new Function("ul", "j6", "b4", "El", "AS", "y6",
    "ze", "p5", "e6", "Ma", "h6", "uP", "Qc", "AudioContext", "P7",
    `${builderSource}; return if0;`)(
      class { async loadAssetMap() { events.push("load-map"); return map; } },
      validateItemId, findKart, async loader => loader(),
      { createVehicleTimeAttackParameters: parameterFactory }, speed,
      "v39", garageState, tuneSpec, flyingPetItem, finalizeSpec,
      particleModification, configureAudio, AudioContextStub,
      { load: loadRaceBgm });
  const builder = kind === "readable"
    ? { host, async loadAssetMap() { events.push("load-map"); return map; },
        async loadVehicleAsset() { return vehicle; },
        async loadRaceCharacters() { return {}; } }
    : new Original(host);
  let error;
  try {
    if (kind === "readable") {
      await buildSoloRaceAssets(builder, selection, { booster: 0 }, undefined, {
        validateItemId, findKart,
        loadParameterFactory: async () => parameterFactory,
        speed, defaultVersion: "v39", garageState, tuneSpec,
        flyingPetItem, finalizeSpec, particleModification,
        configureAudio, createAudioContext: () => new AudioContextStub(),
        loadRaceBgm,
        createBoosterVisuals: () => ({}),
        createOutlineBatch: () => ({ ...disposable, object: {} }),
        createPhysics: () => ({}),
        createTrack: () => disposable,
        applyTrackFog: () => events.push("apply-fog"),
        prepareScene(renderer, scene, target, uploadGeometry) {
          assert.equal(renderer, host.renderer);
          assert.equal(target, host.scene);
          events.push(["prepare", scene === map.scene ? "map" : "sky",
            uploadGeometry]);
        },
        loadTachometer: () => { throw new Error("stop after scene warmup"); },
        disposeImportedObject() {},
      });
    } else await builder.build(selection, { booster: 0 }, undefined);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return { events, error };
}

test("solo race audio and map cleanup on BGM failure matches the release", async () => {
  assert.deepEqual(await runBgmFailure("readable"),
    await runBgmFailure("original"));
});

test("solo map and optional sky upload geometry after fog setup before race UI loading", async () => {
  for (const hasSky of [false, true]) {
    const { events, error } = await runBgmFailure("readable", "after-warm", hasSky);
    assert.equal(error, "stop after scene warmup");
    const fogIndex = events.indexOf("apply-fog");
    assert.ok(fogIndex >= 0);
    assert.deepEqual(events.slice(fogIndex, fogIndex + (hasSky ? 3 : 2)),
      ["apply-fog", ["prepare", "map", true],
        ...(hasSky ? [["prepare", "sky", true]] : [])]);
    assert.ok(events.includes("dispose-bgm"));
    assert.ok(events.includes("close-audio"));
  }
});
