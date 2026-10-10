import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initializeRacePresenter,
  type RacePresenterInitializationDependencies,
  type RacePresenterInitializationHost,
  type RacePresenterInitializationInputs } from "./race-presenter-initialize";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);
const constructorStart = originalClass.indexOf("  constructor(");
const fieldsStart = originalClass.indexOf("\n  assets;", constructorStart);
assert.ok(constructorStart >= 0 && fieldsStart > constructorStart);
const emptyConstructorClass = originalClass.slice(0, constructorStart) +
  "  constructor() {}" + originalClass.slice(fieldsStart);

type Scenario = "ordinary" | "linked" | "giant" | "shadow" |
  "missing-rider" | "missing-socket" | "missing-giant-material" |
  "unmounted-giant";

function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const sourceByModel = new Map<unknown, {
    root: { children: Array<{ value?: unknown }> };
    rider: { children: unknown[] };
    bySource: Map<unknown, unknown>;
  }>();
  const mount = (name: string) => ({
    name,
    clear() { events.push(["mount-clear", name]); },
    add(object: unknown) { events.push(["mount-add", name,
      typeof object === "object" && object !== null && "name" in object
        ? object.name : object]); },
    scale: { setScalar(value: number) { events.push(["scale", name, value]); } },
  });
  class Scene {
    add(...objects: unknown[]) { events.push(["scene-add", ...objects]); }
    clear() { events.push(["scene-clear"]); }
  }
  class View {
    constructor(_scene: unknown) { events.push(["new-view"]); }
    setModel(object: unknown, _visual: unknown, _animation: unknown,
      model: unknown, scene: unknown) {
      events.push(["set-model", object, model, scene]);
    }
    getAttachment(index: number) { events.push(["attachment", index]);
      return mount("balloon"); }
    updatePose(pose: unknown) { events.push(["pose", pose]); }
  }
  class GaugePreserve { configure(folder: unknown) {
    events.push(["gauge-configure", folder]);
  } }
  const dependencies = {
    createCameraShake(_random: unknown, anchor: unknown) {
      events.push(["camera-shake", anchor]); return { kind: "camera-shake" };
    },
    createRankRoster(roster: unknown, playerId: unknown) {
      events.push(["rank-roster", roster, playerId]); return { kind: "rank-roster" };
    },
    createLightFactor(random: unknown) {
      events.push(["light-factor", random]); return { kind: "light-factor" };
    },
    createAction2d(assets: unknown) {
      events.push(["action-2d", assets]);
      return { enableUiSmoothing() { events.push(["action-smoothing"]); } };
    },
    applyTrackFog(_scene: unknown, track: unknown) {
      events.push(["track-fog", (track as { group: string }).group]);
    },
    createRacerView(scene: unknown) { return new View(scene); },
    vehicleParts(vehicle: unknown) { events.push(["vehicle-parts",
      (vehicle as { name: string }).name]);
      return [`${(vehicle as { name: string }).name}-part`]; },
    serializedRoot(model: unknown) { events.push(["source-root", model]);
      return sourceByModel.get(model)!.root; },
    accessorySockets: { headBand: ["head", "slot"] },
    createLinkedPresentation(_root: unknown, _rider: unknown,
      _character: unknown, always: boolean) {
      events.push(["linked-presentation", always]);
      return { resetForRacePresentation() { events.push(["linked-reset"]); } };
    },
    attachAura(_socket: unknown, _vehicleRoot: unknown, aura: unknown) {
      events.push(["attach-aura", aura]);
    },
    createGiantAppearance(local: boolean, vehicleBindings: unknown,
      characterBindings: unknown) {
      events.push(["giant-appearance", local, vehicleBindings,
        characterBindings]); return { local };
    },
    startPosition(position: { x: number; y: number; z: number },
      right: unknown, slot: unknown,
      ground: (from: unknown, to: unknown) => unknown) {
      events.push(["start-position", position, right, slot,
        ground("from", "to")]);
      return { x: position.x + Number(slot), y: position.y, z: position.z };
    },
    createShadowPresentation(vehicleObject: unknown) {
      events.push(["shadow-presentation", vehicleObject]);
      return { vehicleObject };
    },
  };
  const classDependencies = {
    D1: Scene, Z9: class {}, Ol: class { constructor(_mode: unknown) {}
      configureP3528ResolutionMode() { events.push(["drive-configure"]); } },
    KL: class { configureP3528ResolutionMode() {
      events.push(["surround-configure"]);
    } },
    iP: class { constructor(_anchor: unknown) {} },
    bE: class {}, vr0: class {}, B2: class {}, Rr0: class {},
    tP: GaugePreserve,
    nP: class { constructor(random: unknown, anchor: unknown) {
      return dependencies.createCameraShake(random, anchor) as object;
    } },
    Tr0: class { constructor(roster: unknown, id: unknown) {
      return dependencies.createRankRoster(roster, id) as object;
    } },
    sP: class { constructor(random: unknown) {
      return dependencies.createLightFactor(random) as object;
    } },
    dI: class { constructor(assets: unknown) {
      return dependencies.createAction2d(assets);
    } },
    kv: dependencies.applyTrackFog,
    Vg: View, lc: dependencies.vehicleParts,
    J5: dependencies.serializedRoot,
    _a: class { constructor(root: unknown, rider: unknown,
      character: unknown, always: boolean) {
      return dependencies.createLinkedPresentation(root, rider, character, always);
    } },
    oP: dependencies.accessorySockets,
    ev: dependencies.attachAura,
    Kr0: class { constructor(local: boolean, vehicleBindings: unknown,
      characterBindings: unknown) {
      return dependencies.createGiantAppearance(local, vehicleBindings,
        characterBindings);
    } },
    rL: dependencies.startPosition,
    $i0: class { constructor(vehicleObject: unknown) {
      return dependencies.createShadowPresentation(vehicleObject);
    } },
    zB: "camera-mode",
  };
  const dependencyNames = Object.keys(classDependencies);
  const Class = new Function(...dependencyNames,
    `${rewritten ? emptyConstructorClass : originalClass}\nreturn jr0;`)(
    ...Object.values(classDependencies)) as new (...args: unknown[]) =>
      RacePresenterInitializationHost;
  Class.prototype.dispose = function () { events.push(["dispose-on-failure"]); };
  function participant(id: "local" | "remote") {
    const rider = { children: [] };
    const root = { children: Array.from({ length: 7 }, (_, index) => index === 6
      ? { value: scenario === "missing-rider" && id === "remote"
        ? undefined : rider } : {}) };
    const bySource = new Map<unknown, unknown>([[root, mount(`${id}-vehicle-root`)],
      [rider, mount(`${id}-rider`)]]);
    sourceByModel.set(`${id}-model`, { root, rider, bySource });
    const characterObject = mount(`${id}-character`);
    const character = {
      scene: {
        object: characterObject,
        rootMaterialBindings: scenario === "missing-giant-material"
          && id === "remote" ? undefined : `${id}-character-material`,
        getDecorationSocket(part: unknown, slot: unknown) {
          events.push(["decoration-socket", id, part, slot]);
          return scenario === "missing-socket" && id === "remote"
            ? undefined : mount(`${id}-socket`);
        },
        getDecorationOwner() { events.push(["decoration-owner", id]);
          return mount(`${id}-owner`); },
      },
      award: "award",
    };
    return {
      playerId: id,
      vehicle: {
        name: id,
        tachometerRenderer: { enableUiSmoothing() {
          events.push(["tachometer-smoothing", id]);
        } },
        tachometerSelection: { folder: "folder" },
        trails: { object: `${id}-trails` },
        imported: {
          object: `${id}-object`, animation: `${id}-animation`,
          model: `${id}-model`, scene: `${id}-scene`,
          renderScene: { bySource, rootMaterialBindings: `${id}-vehicle-material` },
        },
        visual: { onCharacterSize: 1.25 },
        kartItem: { alwaysLinkCharacter: true },
        accessories: scenario === "unmounted-giant" && id === "remote" ? [] : [{ kind: "headBand", render: { scene: {
          object: `${id}-headband`,
        } } }, { kind: "aura", render: { scene: {
          object: `${id}-aura`,
        } } }],
        decoration: { scene: { object: `${id}-balloon` } },
      },
      characters: scenario === "unmounted-giant" && id === "remote"
        ? {} : scenario === "linked" && id === "remote"
          ? { linked: character } : { ordinary: character },
    };
  }
  const assets = {
    participants: [participant("local"), participant("remote")],
    drivingMode: scenario === "giant" || scenario === "missing-giant-material" ||
      scenario === "unmounted-giant"
      ? { kind: "giant" } : scenario === "shadow" ? { kind: "shadow" }
        : { kind: "ordinary" },
    rain: { object: "rain" }, snow: { object: "snow" },
  };
  const track = { group: "track-group", rayQuery(from: unknown,
    to: unknown, walls: boolean) { events.push(["ray-query", from, to, walls]);
    return { point: { x: 0, y: 1, z: 0 } }; } };
  const runtime = { local: { track, startPose: {
    position: { x: 10, y: 20, z: 30 }, right: "right", tick: 10,
  } } };
  const race = { roster: ["local", "remote"],
    startSlots: { local: 1, remote: 2 } };
  const inputs = {
    assets, runtime, race, playerId: "local", actionAssets: "action-assets",
    hud: "hud", random: "random", countdown: "countdown", award: "award",
    resultView: "result-view", bgm: "bgm", banner: "banner",
    bannerRequest: "banner-request", petVisible: () => false,
    trackInfoCard: "track-card", roadblockHud: "roadblock-hud",
  };
  let host: RacePresenterInitializationHost | undefined;
  let error: string | undefined;
  try {
    if (rewritten) {
      host = new Class();
      initializeRacePresenter(host, inputs as unknown as RacePresenterInitializationInputs,
        dependencies as unknown as RacePresenterInitializationDependencies);
    } else {
      host = new Class(assets, runtime, race, "local", "action-assets", "hud",
        "random", "countdown", "award", "result-view", "bgm", "banner",
        "banner-request", inputs.petVisible, "track-card", "roadblock-hud");
    }
  } catch (failure) { error = (failure as Error).message; }
  if (error) return { events, error };
  return { events, error, views: host?.views.size,
    linked: host?.linkedPresentations.size,
    giant: host?.giantAppearances.size,
    shadows: host?.shadowPresentations.size,
    poses: host ? [...host.initialPoses.entries()] : undefined,
    playerId: host?.playerId };
}

test("multiplayer race presenter scene construction and failure cleanup match release", () => {
  for (const scenario of ["ordinary", "linked", "giant", "shadow",
    "missing-rider", "missing-socket", "missing-giant-material"] as const) {
    assert.deepEqual(observe(true, scenario), observe(false, scenario), scenario);
  }
});

test("giant races keep kart effects when a peer has no character equipped", () => {
  const result = observe(true, "unmounted-giant");
  assert.equal(result.error, undefined);
  assert.equal(result.giant, 2);
  assert.deepEqual(result.events.find(event => event[0] === "giant-appearance" &&
    event[1] === false), ["giant-appearance", false,
    "remote-vehicle-material", []]);
  assert.match(observe(false, "unmounted-giant").error ?? "", /巨人模型缺少/);
  const generated = readFileSync(new URL("../generated/world.js", import.meta.url), "utf8");
  assert.match(generated, /import \{ initializeRacePresenter \}/);
  assert.match(generated, /initializeRacePresenter\(this,/);
});
