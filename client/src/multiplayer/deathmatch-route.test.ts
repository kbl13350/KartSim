import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { y9 } from "../generated/formats.js";
import { mirrorArchives } from "../resources/mirror-archives.test-support";
import { extractTrackRoute, itemGameOnly } from "../resources/track-model-admission";
import { extractTrackRoads } from "../resources/track-road-extraction";
import { anyRoadIssue, isMovableRoad } from "../resources/track-road-descriptor";
import { admitMovingObstacle } from "../resources/moving-obstacle";
import { buildTrackAdmissionLedger, type TrackLedgerOps } from "../vehicle/track-admission-ledger";
import { loadMultiplayerMap, loadTrackMap, type TrackMapOps } from "../vehicle/load-track-map";
import { routeSurfaceKind } from "../world/route-tag";
import { DEATHMATCH_RULES, type DeathmatchState } from "./deathmatch-rules";
import { deathmatchMapRoute } from "./deathmatch-route";

const native = JSON.parse(readFileSync(new URL("../../../server-go/internal/game/lobby/deathmatch-tracks.json", import.meta.url), "utf8"))
  .tracks as Array<{ id: string; fallY: number; spawns: DeathmatchState["spawns"] }>;
const frozen = (track = native[0]!): DeathmatchState => ({ ...DEATHMATCH_RULES,
  fallY: track.fallY, spawns: structuredClone(track.spawns), scores: { 1: 0, 2: 0 }, eventSequence: 0,
  players: Object.fromEntries(Array.from({ length: 8 }, (_, slot) => [`p${slot}`, {
    lifeSeq: 0, alive: true, spawnSlot: slot, protectedUntil: 0, respawnAt: null, kills: 0, deaths: 0,
  }])) });

async function model(id: string): Promise<any> {
  const mirror = mirrorArchives();
  const path = `track_/${id}/track.1s`;
  const pack = mirror.index.rho5.find(group => group.files.some(file =>
    !!file && typeof file === "object" && "path" in file && file.path === path));
  assert.ok(pack, `${id}: original model must be indexed`);
  return y9(await mirror.read(pack.name, path));
}

const ledgerOps: TrackLedgerOps = {
  routeSurfaceKind,
  descriptorUses: scene => extractTrackRoads(scene as any, () => undefined) as unknown as ReturnType<TrackLedgerOps["descriptorUses"]>,
  isDeferredRoad: descriptor => isMovableRoad(descriptor as any),
  unsupportedRoad: (descriptor, mesh) => anyRoadIssue(descriptor as any, mesh as any),
  isItemOnlyMovable: value => itemGameOnly(value as any),
  admitObstacle: object => admitMovingObstacle(object as any),
  // None of the five original arenas has a scripted event object; unexpected ones fail closed.
  parseEvent: () => ({ status: "block", reason: "unexpected-event-in-original-arena" }),
  unsupportedEventSound: () => "unexpected-event-sound-in-original-arena",
};

test("all five original arenas produce eight spawn poses matching the frozen Go geometry", async () => {
  for (const track of native) {
    const parsed = await model(track.id);
    const route = deathmatchMapRoute(frozen(track), parsed, track.id);
    assert.equal(route.starts.length, 8);
    assert.equal(new Set(route.starts.map(start => JSON.stringify(start.position))).size, 8);
    route.starts.forEach((start, slot) => {
      assert.deepEqual(start.position, track.spawns[slot]!.position);
      assert.deepEqual(start.forward, track.spawns[slot]!.forward);
      assert.ok(Math.abs(Math.hypot(start.up.x, start.up.y, start.up.z) - 1) < 1e-6);
    });
    const originalRoad = extractTrackRoute(parsed, "speed-individual");
    assert.ok(originalRoad.collisionTriangles.length > 0);
    const ledger = buildTrackAdmissionLedger(parsed, {}, "speed-individual", { p3553CourseSound: true }, ledgerOps);
    assert.deepEqual(ledger.records.filter(record => record.decision === "block"), [], track.id);
  }
});

test("arena map boundary rejects missing, duplicated or server-divergent native spawn poses", async () => {
  const track = native[0]!, parsed = await model(track.id), state = frozen(track);
  const missing = { root: { ...parsed.root, trackObjects: parsed.root.trackObjects.filter((entry: any) => entry.name !== "sp07") } };
  assert.throws(() => deathmatchMapRoute(state, missing, track.id), /八个原版出生点/);
  const duplicate = { root: { ...parsed.root, trackObjects: [...parsed.root.trackObjects,
    parsed.root.trackObjects.find((entry: any) => entry.name === "sp00")] } };
  assert.throws(() => deathmatchMapRoute(state, duplicate, track.id), /八个原版出生点/);
  state.spawns[0]!.position.x += 1;
  assert.throws(() => deathmatchMapRoute(state, parsed, track.id), /与原版赛道不一致/);
  assert.throws(() => deathmatchMapRoute(frozen(track), parsed, "village_R01"), /冻结赛道与规则/);
});

test("deathmatch map entry forwards its own frozen state without confusing Brave or item modes", () => {
  const calls: unknown[][] = [], owner = { loadMap: (...args: unknown[]) => calls.push(args) };
  const state = frozen(), admit = () => undefined;
  loadMultiplayerMap(owner, "arena/track.1s", native[0]!.id, "deathmatch", () => "p3553", () => false, admit, undefined, state);
  assert.deepEqual(calls.pop(), ["arena/track.1s", native[0]!.id, "speed-individual", admit, false, false, undefined, state]);
  assert.throws(() => loadMultiplayerMap(owner, "arena/track.1s", native[0]!.id, "deathmatch",
    () => "p3528", () => false, admit, undefined, state), /P3553/);
  assert.throws(() => loadMultiplayerMap(owner, "arena/track.1s", native[0]!.id, "item",
    () => "p3553", () => false, admit, undefined, state), /普通比赛不能附带死斗规则/);
});

test("real arena map assembly retains original collision and creates the required deathmatch starts", async () => {
  for (const track of native) {
    const parsed = await model(track.id), state = frozen(track);
    let extracted = 0;
    const library = { files: [{ sourceName: "stage_common.rho", name: "readyCamera.1s", bytes: async () => new Uint8Array() }],
      trackMetadata: async () => ({ id: track.id, cnTitle: track.id, gameType: "death", choosable: false }),
      findSibling: () => undefined };
    const disposable = () => ({ object: {}, dispose() {} });
    const ops: TrackMapOps = { decodeModel: () => parsed, assetProvenance: () => ({}),
      loadLteCoins: async () => undefined, loadWeather: async () => ({}), loadWarp: async () => undefined,
      validateCourse: (model, source, mode, options) => buildTrackAdmissionLedger(model, source, mode, options, ledgerOps),
      lensFlareAnchor: () => undefined, dummySounds: () => [],
      extractRoad: (...args) => { extracted++; return extractTrackRoute(...args); },
      mapMovingObjects: () => [], additionalMatrixRoots: () => [], admitMovingObject: () => ({ status: "block" }),
      parseEventProjection: () => ({ status: "block" }), makeEventRuntime: () => undefined,
      hasDeferredRoad: () => false, isDeferredRoadMaterial: () => false, unsupportedRoad: () => false,
      hasRail: () => false, loadRailConfig: async () => undefined, loadRailCapture: async () => undefined,
      resourceVersion: () => "p3553", isLteTrack: () => false, loadAdmission: () => ({}), loadMultiplayerAdmission: () => ({}),
      makeReadyCamera: () => ({}), loadAdvertisements: async () => [], textureCandidates: () => ({ candidates: [] }),
      textureStatus: () => ({ status: "found" }), loadEnvironment: async () => disposable(), loadScene: async () => disposable(),
      warpNextCamera: () => undefined, configureSkydome() {},
    };
    const owner = { assetHost: { generationValue: () => 1, isGenerationCurrent: () => true,
      toonStageBinding: {}, getLibrary: () => library,
      requireAsset: () => ({ name: "track.1s", extension: "1s", bytes: async () => new Uint8Array() }) } };
    const map = await loadTrackMap(owner, `track_/${track.id}/track.1s`, track.id, "speed-individual",
      () => ({}), false, ops, false, undefined, state);
    assert.equal(extracted, 1, "arena route keeps a single original collision world");
    assert.equal(map.data.deathmatch.starts.length, 8);
    assert.deepEqual(map.data.start, map.data.deathmatch.starts[0]);
    assert.equal(map.metadata.laps, 1);
    assert.equal(map.metadata.showLapUi, false);
    assert.equal(map.metadata.gameType, "death");
  }
});
