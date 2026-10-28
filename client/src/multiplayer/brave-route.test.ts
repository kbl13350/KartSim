import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { RhoReader } from "../codecs/rho";
import type { RhoArchiveIndex } from "../resources/archive-index";
import { extractTrackRoute } from "../resources/track-model-admission";
import { buildTrackCourseGraph } from "../resources/track-course-graph";
import { loadMultiplayerMap, loadTrackMap, type TrackMapOps } from "../vehicle/load-track-map";
import { raceStartPosition, validateRaceStartGrid } from "../vehicle/race-start-slots";
import { createVehicleBody } from "../driving/initial-state";
import { resetVehicleFromRoute } from "../driving/reset-runtime";
import { currentRouteSurface, prepareCurrentSectionReset, requireRouteState,
  resetRouteState, updateRoute, type RouteWorldHost } from "../world/route-state";
import { sampleRoute } from "../world/route";
import { drivingWrongWay } from "../ui/wrong-way-warning";
import { bravePlayerStart, braveRouteSelection } from "./brave-route";
import { initializeLocalRace } from "./local-race-construction";
import { initializeRacePresenter } from "./race-presenter-initialize";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const modelPath = "track_/village_A07/track.1s";
const dot = (a: any, b: any) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (v: any, s: number) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const add = (a: any, b: any) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

function race(forwardTeam = 1) {
  return { raceId: "brave-1", trackId: "village_R07",
    brave: { ruleset: "web-brave-v1", forwardTeam },
    roster: Array.from({ length: 8 }, (_, slot) => ({ playerId: `p${slot}`, team: slot < 4 ? 1 : 2 })),
    startSlots: Object.fromEntries(Array.from({ length: 8 }, (_, slot) => [`p${slot}`, slot])) };
}

/** The same original archive works when the checkout retains its LFS pointer. */
let parsed: Promise<any> | undefined;
function originalModel(): Promise<any> {
  return parsed ??= (async () => {
    const filename = "track_village_A07.rho";
    const indexFile = path.join(root, "mirror/__p3553/archive-index");
    const archiveFile = path.join(root, "mirror/p3553", filename);
    if (!existsSync(indexFile) || !existsSync(archiveFile)) return undefined;
    let bytes = readFileSync(archiveFile);
    if (bytes.length < 200) {
      const oid = /oid sha256:([a-f0-9]+)/.exec(bytes.toString())?.[1];
      const cached = oid && path.join(root, ".git/lfs/objects", oid.slice(0, 2), oid.slice(2, 4), oid);
      if (!cached || !existsSync(cached)) return undefined;
      bytes = readFileSync(cached);
    }
    const index = JSON.parse(inflateSync(readFileSync(indexFile)).toString()) as { rho: RhoArchiveIndex[] };
    const archive = index.rho.find(entry => entry.name === filename)!;
    assert.ok(archive);
    const copy = (data: Uint8Array) => Uint8Array.from(data).buffer;
    const reader = new RhoReader({ name: filename, size: bytes.length,
      arrayBuffer: async () => copy(bytes),
      slice: (a = 0, b = bytes.length) => ({ arrayBuffer: async () => copy(bytes.subarray(a, b)) }),
    }, archive);
    const { y9 } = await import("../generated/formats.js");
    return y9(await reader.read("track.1s"));
  })();
}

test("勇者方向来自冻结名单，红蓝起跑位不能串队", () => {
  const room = race(2);
  assert.deepEqual(braveRouteSelection(room, "p0"),
    { ruleset: "web-brave-v1", forwardTeam: 2, localTeam: 1 });
  const pose = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 } };
  assert.equal(bravePlayerStart(room, "p7", { 1: pose, 2: pose }).slot, 3);
  assert.throws(() => bravePlayerStart({ ...room, startSlots: { ...room.startSlots, p7: 3 } },
    "p7", { 1: pose, 2: pose }), /起跑位/);
  for (const invalid of [{ ...room, brave: undefined }, { ...room, trackId: "ice_R01" },
    { ...room, brave: { ...room.brave, forwardTeam: 0 } }])
    assert.throws(() => braveRouteSelection(invalid, "p0"), /冻结/);
  assert.throws(() => braveRouteSelection(room, "absent"), /身份/);
});

test("勇者 loadMultiplayerMap 转发冻结方向并保留普通模式默认参数", () => {
  const selection = braveRouteSelection(race(), "p0");
  const calls: unknown[][] = [];
  const owner = { loadMap: (...args: unknown[]) => calls.push(args) };
  const admit = () => undefined;
  loadMultiplayerMap(owner, modelPath, "village_R07", "brave", () => "p3553", () => false, admit, selection);
  assert.deepEqual(calls.pop(), [modelPath, "village_R07", "speed-individual", admit, false, false, selection]);
  assert.throws(() => loadMultiplayerMap(owner, modelPath, "village_R07", "brave",
    () => "p3553", () => false, admit), /冻结/);
  assert.throws(() => loadMultiplayerMap(owner, modelPath, "village_R07", "brave",
    () => "p3528", () => false, admit, selection), /P3553/);
});

async function assembleMap(model: any, room: ReturnType<typeof race>, playerId: string) {
  let scenes = 0, collisionExtractions = 0;
  const library = { files: [{ sourceName: "stage_common.rho", name: "readyCamera.1s",
    bytes: async () => new Uint8Array() }],
    trackMetadata: async () => ({ id: "village_R07", cnTitle: "城镇 命运之桥", laps: 2,
      gameType: "speed", choosable: false }), findSibling: () => undefined };
  const disposable = () => ({ object: {}, dispose() {} });
  const ops: TrackMapOps = {
    decodeModel: () => model, assetProvenance: () => ({}),
    loadLteCoins: async () => undefined, loadWeather: async () => ({}), loadWarp: async () => undefined,
    validateCourse: () => ({ records: [] }), lensFlareAnchor: () => undefined, dummySounds: () => [],
    extractRoad: (...args) => { collisionExtractions++; return extractTrackRoute(...args); },
    mapMovingObjects: () => [], additionalMatrixRoots: () => [], admitMovingObject: () => ({ status: "block" }),
    parseEventProjection: () => ({ status: "block" }), makeEventRuntime: () => undefined,
    hasDeferredRoad: () => false, isDeferredRoadMaterial: () => false, unsupportedRoad: () => false,
    hasRail: () => false, loadRailConfig: async () => undefined, loadRailCapture: async () => undefined,
    resourceVersion: () => "p3553", isLteTrack: () => false, loadAdmission: () => ({}),
    loadMultiplayerAdmission: () => ({}), makeReadyCamera: () => ({}), loadAdvertisements: async () => [],
    textureCandidates: () => ({ candidates: [] }), textureStatus: () => ({ status: "found" }),
    loadEnvironment: async () => disposable(),
    loadScene: async () => { scenes++; return disposable(); },
    warpNextCamera: () => undefined, configureSkydome() {},
  };
  const owner = { assetHost: { generationValue: () => 1, isGenerationCurrent: () => true,
    toonStageBinding: {}, getLibrary: () => library,
    requireAsset: () => ({ name: "track.1s", extension: "1s", bytes: async () => new Uint8Array() }) } };
  const map = await loadTrackMap(owner, modelPath, "village_R07", "speed-individual", () => ({}), false,
    ops, false, braveRouteSelection(room, playerId));
  assert.equal(scenes, 1, "each client builds one shared scene");
  assert.equal(collisionExtractions, 1, "the other team's graph does not duplicate collision geometry");
  assert.equal(map.data.collisionTriangles.length, 27448);
  return map;
}

/** Actual reset basis, without creating a second physics simulation or world. */
function physicsFixture() {
  return { body: createVehicleBody(), state: { trackProgress: 0 },
    reset(x: number, y: number, z: number) { this.body = createVehicleBody(); this.body.position = { x, y, z }; },
    syncPresentationFields() {}, setRaceMotionLocked() {},
    resetFromRouteFrame(frame: any) { resetVehicleFromRoute(this as any, frame); } };
}

/** Downward start-grid ray against the original collision triangles. */
function groundPoint(triangles: any[], from: any) {
  let best = -Infinity;
  for (const { a, b, c, normal } of triangles) {
    if (normal.y <= 0.2) continue;
    const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(denominator) < 1e-10) continue;
    const u = ((b.z - c.z) * (from.x - c.x) + (c.x - b.x) * (from.z - c.z)) / denominator;
    const v = ((c.z - a.z) * (from.x - c.x) + (a.x - c.x) * (from.z - c.z)) / denominator;
    if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
    const y = a.y * u + b.y * v + c.y * (1 - u - v);
    if (y <= from.y && y >= from.y - 100 && y > best) best = y;
  }
  assert.ok(Number.isFinite(best), "a start place must stand on original road");
  return { x: from.x, y: Math.fround(best), z: from.z };
}

function localRace(map: any, room: ReturnType<typeof race>, playerId: string) {
  const assets = { raceId: room.raceId, mode: "team", speed: 7, channel: {}, drivingMode: { kind: "brave" },
    map, participants: room.roster.map(entry => ({ ...entry, vehicle: {}, characters: {} })) };
  const owner: any = {};
  initializeLocalRace(owner, assets, room, playerId, {
    validateStartSlots: validateRaceStartGrid, hasLteMode: () => false, validRpDraws: () => false,
    sameRp: () => true, hasGiantMode: () => false, makeLte: () => undefined, makeGiant: () => undefined,
    makePhysics: physicsFixture,
    makeTrack: (data: any) => {
      const world: any = { data, sections: data.sections, routeStates: new WeakMap(), group: { add() {} },
        getStart: () => data.start, setLensFlareEnabled() {},
        rayQuery: (from: any) => ({ point: groundPoint(data.collisionTriangles, from) }) };
      world.resetRouteState = (kart: any, position: any) => resetRouteState(world, kart, position);
      world.getRouteState = (kart: any) => requireRouteState(world, kart);
      world.currentRouteSurface = (kart: any) => currentRouteSurface(world, kart);
      return world;
    }, placeAtStart: raceStartPosition, makeCoordinator: () => ({}), racingState: "racing",
  });
  return owner;
}

function presenter(owner: any, room: ReturnType<typeof race>, playerId: string) {
  const noop = () => {};
  const host: any = { scene: { add: noop }, views: new Map(), initialPoses: new Map(),
    linkedPresentations: new Map(), giantAppearances: new Map(), shadowPresentations: new Map(),
    gaugePreserve: { configure: noop }, drive: { configureP3528ResolutionMode: noop },
    surround: { configureP3528ResolutionMode: noop }, dispose: noop };
  const assets = { ...owner.assets, participants: owner.assets.participants.map((entry: any) => ({ ...entry,
    vehicle: { tachometerRenderer: { enableUiSmoothing: noop }, tachometerSelection: {},
      trails: {}, imported: {}, visual: {}, kartItem: {}, accessories: [] } })) };
  initializeRacePresenter(host, { assets, runtime: { local: owner }, race: room, playerId } as any, {
    createCameraShake: noop, createRankRoster: noop, createLightFactor: noop,
    createAction2d: () => ({ enableUiSmoothing: noop }), applyTrackFog: noop,
    createRacerView: () => ({ setModel: noop, updatePose: noop }), vehicleParts: () => [],
    serializedRoot: () => ({ children: [] }), startPosition: raceStartPosition,
  } as any);
  return host;
}

test("真实命运之桥：红蓝客户端共享场景，八车的本地与远端出生一致且相向", async context => {
  const model = await originalModel();
  if (!model) return context.skip("需要原始 track_village_A07.rho（可从本地 Git LFS cache 读取）");
  for (const forwardTeam of [1, 2]) {
    const room = race(forwardTeam);
    const maps = await Promise.all([assembleMap(model, room, "p0"), assembleMap(model, room, "p4")]);
    assert.deepEqual(maps[0].data.brave.starts, maps[1].data.brave.starts);
    assert.ok(dot(maps[0].data.start.forward, maps[1].data.start.forward) < -0.999);
    const reference = presenter(localRace(maps[0], room, "p0"), room, "p0");
    for (const entry of room.roster) {
      const local = localRace(maps[entry.team === 1 ? 0 : 1], room, entry.playerId);
      const view = presenter(local, room, entry.playerId);
      assert.deepEqual([...view.initialPoses], [...reference.initialPoses], entry.playerId);
      const pose = view.initialPoses.get(entry.playerId);
      assert.deepEqual(local.physics.body.position, pose.position);
      assert.deepEqual(local.physics.body.forward, pose.forward);
      assert.equal(local.track.getRouteState(local.physics).lap, 0);
    }
    assert.ok(dot(reference.initialPoses.get("p0").forward, reference.initialPoses.get("p4").forward) < -0.999);
    assert.equal(new Set([...reference.initialPoses.values()].map((pose: any) => JSON.stringify(pose.position))).size, 8);
    const bad = { ...room, brave: { ...room.brave, forwardTeam: forwardTeam === 1 ? 2 : 1 } };
    assert.throws(() => localRace(maps[0], bad, "p0"), /冻结方向/);
  }
});

test("真实命运之桥：两向均穿过77段计圈，复位与逆向提示沿各自路线", async context => {
  const model = await originalModel();
  if (!model) return context.skip("需要原始 track_village_A07.rho");
  for (const reverse of [false, true]) {
    const route = buildTrackCourseGraph(model.root.trackObjects, reverse);
    assert.equal(route.sections.length, 77);
    const world: RouteWorldHost = { sections: route.sections as any,
      data: { firstSection: route.firstSection, lastSection: route.lastSection, lapTarget: 2 },
      routeStates: new WeakMap() };
    const kart = {};
    resetRouteState(world, kart, route.start.position);
    for (let step = 0; step <= 154; step++) {
      const before = requireRouteState(world, kart);
      const edge = world.sections[before.section]!.outgoing[0]!;
      const triangle = edge.gate.triangles[0]!;
      const center = scale(triangle.reduce(add, { x: 0, y: 0, z: 0 }), 1 / 3);
      const state = updateRoute(world, kart, add(center, scale(edge.gate.normal, -0.1)),
        add(center, scale(edge.gate.normal, 0.1)));
      assert.equal(state.section, edge.section, `${reverse} section at step ${step}`);
      assert.equal(state.lap, 1 + Math.floor(step / 77), `${reverse} lap at step ${step}`);
      assert.ok(state.distance >= before.distance, `${reverse} progress at step ${step}`);
    }
    const state = requireRouteState(world, kart);
    const section = world.sections[state.section]!;
    const reset = prepareCurrentSectionReset(world, kart);
    assert.ok(dot(reset.forward, section.frames[0]!.forward) > 0.999);
    const sampled = sampleRoute(world.sections, { section: state.section, localDistance: section.length / 2 }, 0);
    assert.ok(sampled.sampled);
    if (!sampled.sampled) throw new Error("unreachable");
    assert.equal(drivingWrongWay({ racing: true, direction: sampled.direction,
      forward: sampled.direction, velocity: scale(sampled.direction, 20) }), false);
    assert.equal(drivingWrongWay({ racing: true, direction: sampled.direction,
      forward: scale(sampled.direction, -1), velocity: scale(sampled.direction, -20) }), true);
  }
});
