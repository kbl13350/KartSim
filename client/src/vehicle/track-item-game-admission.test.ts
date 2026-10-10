import assert from "node:assert/strict";
import test from "node:test";
import { buildTrackAdmissionLedger, type TrackLedgerOps } from "./track-admission-ledger";
import { itemGameRoots, loadMultiplayerMap, loadTrackMap, type TrackMapOps } from "./load-track-map";
import {
  admitItemGameTrackObject, admitTrackObject, itemGameObjectKind,
  type TrackAdmissionOps, type TrackObjectOccurrence,
} from "./track-object-admission";

function objectProperty(attributes: Record<string, string>) {
  return { children: [{ name: "object",
    attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })) }] };
}

function occurrence(kind: string, name: string, extra: Record<string, unknown> = {}): TrackObjectOccurrence {
  return { encoding: "source-bin", id: 7, value: { kind, name, ...extra } };
}

const movable = (name: string, attributes: Record<string, string>, extra: Record<string, unknown> = {}) =>
  occurrence("ToMovableObject", name, { property: objectProperty(attributes), object: { kind: "node", name }, ...extra });

const ops: TrackAdmissionOps = {
  isItemOnlyMovable: value => value.property?.children.some(child => child.name === "object" &&
    child.attributes.some(attribute => attribute.name === "onlyItemGame" && attribute.value === "true")) ?? false,
  admitObstacle: () => ({ status: "admit", hasPrs: true, pressMode: undefined,
    collisionTriangleCount: 4, markerProfile: ["ob"] }),
  parseEvent: () => ({ status: "parsed", prsNodes: 1, triangleCount: 2, sourceTriangleCount: 2,
    selectedTriangleCount: 2, skippedTriangleCount: 0, degenerateTriangleCount: 0 }),
  unsupportedEventSound: () => undefined,
};

const objects: TrackObjectOccurrence[] = [
  occurrence("TrackObject", "track"),
  occurrence("TrackObject", "extra"),
  occurrence("ToRoad", "road", { records: [] }),
  occurrence("ToDummy", "lensflare"),
  occurrence("ToDummy", "sound01", { property: { children: [{ name: "sound",
    attributes: [{ name: "filename", value: "wind" }] }] } }),
  occurrence("ToDummy", "other"),
  occurrence("ToBlackPlane", "black"),
  occurrence("ToMinimap", "minimap"),
  occurrence("ToLucci", "coin"),
  occurrence("ToMesh", "mesh"),
  occurrence("ToItemCube", "ic01"),
  movable("mo_itemcube", { type: "itemCube" }),
  movable("banana", { type: "banana" }),
  movable("mine", { type: "mine", size: "3.0" }),
  movable("hidden", { type: "mineHidden" }),
  movable("water", { type: "waterMine" }),
  movable("jump", { type: "ltejump" }),
  movable("dummy", { type: "dummy" }),
  movable("missing", {}),
  movable("obstacle", { type: "obstacle" }),
  movable("event", { type: "event" }),
  movable("unknown", { type: "whatever" }),
  movable("onlyBanana", { type: "banana", onlyItemGame: "true" }),
  movable("onlyDummy", { type: "dummy", onlyItemGame: "true" }),
  movable("onlyObstacle", { type: "obstacle", onlyItemGame: "true" }),
];

test("the item flag admits cubes and hazards and keeps every other speed-individual decision", () => {
  const expected: Record<string, string> = {
    ic01: "item-cube-admitted", mo_itemcube: "moving-item-cube-admitted",
    banana: "item-hazard-admitted", mine: "item-hazard-admitted", hidden: "item-hazard-admitted",
    water: "item-hazard-admitted", onlyBanana: "item-hazard-admitted",
  };
  for (const [index, entry] of objects.entries()) {
    const item = admitItemGameTrackObject(entry, index, "src", 1, true, ops);
    const speed = admitTrackObject(entry, index, "speed-individual", "src", 1, true, false, ops);
    const name = entry.value.name;
    assert.equal(item.mode, "speed-individual", name);
    if (expected[name]) {
      assert.equal(item.decision, "admit", name);
      assert.equal(item.reason, expected[name], name);
      assert.notEqual(speed.decision, "admit", name);
    } else if (name === "onlyDummy" || name === "onlyObstacle") {
      // onlyItemGame movables fall through to their own type instead of being omitted.
      assert.equal(speed.reason, "only-item-game-loader-omission");
      const plain = admitTrackObject(movable(name, { type: name === "onlyDummy" ? "dummy" : "obstacle" }),
        index, "speed-individual", "src", 1, true, false, ops);
      assert.deepEqual({ ...item, occurrence: undefined }, { ...plain, occurrence: undefined }, name);
      assert.equal(item.decision, "admit");
    } else {
      assert.deepEqual(item, speed, name);
    }
  }
  assert.equal(admitItemGameTrackObject(movable("jump", { type: "ltejump" }), 0, "s", 1, true, ops).reason,
    "excluded-nonboost-item-runtime");
  assert.equal(admitItemGameTrackObject(occurrence("ToLucci", "coin"), 0, "s", 1, true, ops).decision, "block");
  assert.deepEqual(objects.map(entry => itemGameObjectKind(entry.value) ?? "-"), [
    "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "cube", "moving-cube", "hazard", "hazard", "hazard",
    "hazard", "-", "-", "-", "-", "-", "-", "hazard", "-", "-"]);
});

const ledgerOps: TrackLedgerOps = {
  ...ops,
  routeSurfaceKind: () => undefined,
  descriptorUses: () => ({ descriptorUses: [] }),
  isDeferredRoad: () => false,
  unsupportedRoad: () => undefined,
};

function trackModel() {
  return { root: { kind: "track", trackObjects: objects.map(entry => entry.value),
    trackObjectOccurrences: objects, scene: {} } };
}

test("the ledger takes the item flag only on the speed-individual path", () => {
  const speed = buildTrackAdmissionLedger(trackModel(), "src", "speed-individual", { p3553CourseSound: true }, ledgerOps);
  const item = buildTrackAdmissionLedger(trackModel(), "src", "speed-individual",
    { p3553CourseSound: true, itemGame: true }, ledgerOps);
  assert.equal(item.mode, "speed-individual");
  assert.equal(item.records.length, speed.records.length);
  const changed = item.records.flatMap((record, index) =>
    JSON.stringify(record) === JSON.stringify(speed.records[index]) ? [] : [record.occurrence.name]);
  assert.deepEqual(changed, ["ic01", "mo_itemcube", "banana", "mine", "hidden", "water",
    "onlyBanana", "onlyDummy", "onlyObstacle"]);
  assert.throws(() => buildTrackAdmissionLedger(trackModel(), "src", "time-attack", { itemGame: true }, ledgerOps));
  assert.throws(() => buildTrackAdmissionLedger(trackModel(), "src", "item", { itemGame: true }, ledgerOps));
  assert.throws(() => buildTrackAdmissionLedger(trackModel(), "src", "speed-individual",
    { itemGame: true, lteCoins: true }, ledgerOps));
});

test("multiplayer item maps keep the speed-individual admission with the item flag", () => {
  const calls: unknown[][] = [];
  const owner = { loadMap: (...args: unknown[]) => { calls.push(args); return "map"; } };
  const admit = () => "token";
  const version = (value: string) => () => value;
  assert.equal(loadMultiplayerMap(owner, "p", "factory_I03", "item", version("p3553"), () => false, admit), "map");
  assert.deepEqual(calls.pop(), ["p", "factory_I03", "speed-individual", admit, false, true]);
  assert.equal(loadMultiplayerMap(owner, "p", "forest_I01", undefined as never, version("p3553"), () => false, admit), "map");
  assert.deepEqual(calls.pop(), ["p", "forest_I01", "speed-individual", admit, false]);
  assert.throws(() => loadMultiplayerMap(owner, "p", "factory_I03", "item", version("p3543"), () => false, admit),
    /P3553/);
});

test("item-game roots: hazards render, moving-cube anchors are matrix-only", () => {
  const roots = itemGameRoots(objects.map(entry => entry.value));
  assert.deepEqual(roots.roots.map(root => root.name),
    ["mo_itemcube", "banana", "mine", "hidden", "water", "onlyBanana"]);
  assert.deepEqual(roots.matrixOnly.map(root => root.name), ["mo_itemcube"]);
  assert.throws(() => itemGameRoots([{ ...movable("bad", { type: "banana" }).value, object: undefined }]));
});

function mapFixture() {
  const calls: Array<[string, ...unknown[]]> = [];
  const log = (name: string, result?: unknown) => (...args: unknown[]) => { calls.push([name, ...args]); return result; };
  const anchor = { kind: "node", name: "mo_itemcube" };
  const banana = { kind: "node", name: "banana" };
  const moving = [
    { kind: "ToMovableObject", name: "mo_itemcube", property: objectProperty({ type: "itemCube" }), object: anchor, transform: "t1" },
    { kind: "ToMovableObject", name: "banana", property: objectProperty({ type: "banana" }), object: banana, transform: "t2" },
  ];
  const model = { root: { kind: "track", trackObjects: [{ kind: "ToMinimap", name: "minimap" }] } };
  const disposable = { object: "scene", dispose: () => {} };
  const library = {
    files: [{ sourceName: "stage_common.rho", name: "readyCamera.1s", bytes: async () => new Uint8Array() }],
    trackMetadata: async () => ({ id: "factory_I03", cnTitle: "工厂", laps: 3, gameType: "item" }),
    findSibling: () => undefined,
  };
  const ops: TrackMapOps = {
    decodeModel: () => model,
    assetProvenance: () => "provenance",
    loadLteCoins: async () => undefined,
    loadWeather: async () => ({}),
    loadWarp: async () => undefined,
    validateCourse: log("course", { records: [] }),
    lensFlareAnchor: () => undefined,
    dummySounds: () => [],
    extractRoad: () => ({ collisionTriangles: [], deferredRoadTriangles: [], roadIssues: [],
      containerName: "track", sections: [], firstSection: 0, lastSection: 0, start: {} }),
    mapMovingObjects: () => moving,
    additionalMatrixRoots: () => [],
    admitMovingObject: () => ({ status: "block" }),
    parseEventProjection: () => ({ status: "block" }),
    makeEventRuntime: () => ({}),
    hasDeferredRoad: () => false,
    isDeferredRoadMaterial: () => false,
    unsupportedRoad: () => false,
    hasRail: () => false,
    loadRailConfig: async () => undefined,
    loadRailCapture: async () => undefined,
    resourceVersion: () => "p3553",
    isLteTrack: () => false,
    loadAdmission: () => undefined,
    loadMultiplayerAdmission: () => undefined,
    makeReadyCamera: () => "ready",
    loadAdvertisements: async () => [],
    textureCandidates: () => ({ candidates: [] }),
    textureStatus: () => ({ status: "found" }),
    loadEnvironment: async () => disposable,
    loadScene: async (...args: unknown[]) => { calls.push(["scene", ...args]); return disposable; },
    warpNextCamera: () => undefined,
    configureSkydome: () => {},
    loadItemGame: async (...args: unknown[]) => { calls.push(["item", ...args]);
      return { catalog: "catalog", cubes: "cubes", hazards: "hazards" }; },
  };
  const owner = { assetHost: {
    generationValue: () => 1, isGenerationCurrent: () => true, toonStageBinding: "stage",
    requireAsset: () => ({ extension: "1s", name: "track.1s", bytes: async () => new Uint8Array() }),
    getLibrary: () => library,
  } };
  return { calls, ops, owner, anchor, banana, library, model };
}

test("loadTrackMap with the item flag loads item sources and the item roots", async () => {
  const fixture = mapFixture();
  const map = await loadTrackMap(fixture.owner, "track_/factory_I03/track.1s", "factory_I03",
    "speed-individual", () => "admission", false, fixture.ops, true);
  assert.deepEqual(fixture.calls.find(call => call[0] === "item"),
    ["item", fixture.library, fixture.model, "factory_I03"]);
  const course = fixture.calls.find(call => call[0] === "course")!;
  assert.equal((course[4] as { itemGame?: boolean }).itemGame, true);
  const scene = fixture.calls.find(call => call[0] === "scene")!;
  const options = scene[5] as { additionalRoots: unknown[]; matrixOnlyRoots: unknown[];
    rootPoseOverrides: Map<unknown, unknown> };
  assert.deepEqual(options.additionalRoots, [fixture.anchor, fixture.banana]);
  assert.deepEqual(options.matrixOnlyRoots, [fixture.anchor]);
  assert.equal(options.rootPoseOverrides.get(fixture.anchor), "t1");
  assert.equal(map.itemCatalog, "catalog");
  assert.equal(map.itemCubeSource, "cubes");
  assert.equal(map.itemHazardSource, "hazards");
  assert.equal(map.data.resourceVersion, "p3553");

  const plain = mapFixture();
  const speed = await loadTrackMap(plain.owner, "track_/factory_I03/track.1s", "factory_I03",
    "speed-individual", () => "admission", false, plain.ops);
  assert.equal(plain.calls.some(call => call[0] === "item"), false);
  assert.equal("itemGame" in (plain.calls.find(call => call[0] === "course")![4] as object), false);
  assert.deepEqual((plain.calls.find(call => call[0] === "scene")![5] as { additionalRoots: unknown[] })
    .additionalRoots, []);
  assert.equal("itemCubeSource" in speed, false);

  await assert.rejects(loadTrackMap(plain.owner, "p", "factory_I03", "time-attack", () => "", false, plain.ops, true));
  await assert.rejects(loadTrackMap(plain.owner, "p", "factory_I03", "speed-individual", () => "", true, plain.ops, true));
  const { loadItemGame: _omit, ...withoutItems } = plain.ops;
  await assert.rejects(loadTrackMap(plain.owner, "p", "factory_I03", "speed-individual", () => "", false,
    withoutItems, true), /道具资源库/);
});
