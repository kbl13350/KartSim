import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { FormulaChampionship, FormulaRaceEngine, FORMULA_RULES, isInsideFormulaPit,
  type FormulaPlayer, type FormulaRaceOptions, type FormulaRoundResult } from "./formula-engine";
import type { RouteFrame, RouteSection, Vec3 } from "../world/route";
import { resetRouteState, updateRoute } from "../world/route-state";
import { RhoReader } from "../codecs/rho";
import type { RhoArchiveIndex } from "../resources/archive-index";
import { buildTrackCourseGraph } from "../resources/track-course-graph";

const radius = 400;
function frame(angle: number): RouteFrame {
  return { position: { x: Math.sin(angle) * radius, y: 0, z: -Math.cos(angle) * radius },
    forward: { x: Math.cos(angle), y: 0, z: Math.sin(angle) }, up: { x: 0, y: 1, z: 0 } };
}

/** A four-section circuit stored out of traversal order, with real curved
 * geometry and gates; this catches assumptions that section index is progress. */
function options(extra: Partial<FormulaRaceOptions> = {}): FormulaRaceOptions {
  const order = [2, 0, 3, 1];
  const sections: RouteSection[] = Array.from({ length: 4 });
  for (let i = 0; i < 4; i++) {
    const frames = Array.from({ length: 17 }, (_, f) => frame((i + f / 16) * Math.PI / 2));
    const gate = { triangles: [[], []] as const, normal: frames[0]!.forward, final: i === 3, name: `gate-${i}` };
    sections[order[i]!] = { frames, length: Math.PI * radius / 2, surface: "road",
      outgoing: [{ gate, section: order[(i + 1) % 4]! }], incoming: [{ gate, section: order[(i + 3) % 4]! }] };
  }
  return { sections, firstSection: 2, lastSection: 1, start: frame(-5 / radius),
    laps: 1, difficulty: "normal", groupId: 1, round: 1, ...extra };
}

const farPlayer = (): FormulaPlayer => ({ position: { x: 5000, y: 50, z: 5000 },
  forward: { x: 1, y: 0, z: 0 }, progress: 0, speedKmh: 0 });
const minusForward = (position: Vec3, forward: Vec3, metres: number): Vec3 => ({
  x: position.x - forward.x * metres, y: position.y - forward.y * metres, z: position.z - forward.z * metres,
});

test("the field contains the original 19 distinct NPCs on a connected 20-kart grid", () => {
  const engine = new FormulaRaceEngine(options());
  const snapshot = engine.snapshot;
  assert.equal(snapshot.npcs.length, 19);
  assert.equal(new Set(snapshot.npcs.map(npc => npc.id)).size, 19);
  assert.equal(snapshot.npcs[0]!.name, "尼欧");
  assert.equal(engine.standings().length, 20);
  assert.equal(snapshot.npcs[0]!.distance - snapshot.npcs[1]!.distance, 5);
  assert.equal(snapshot.npcs[1]!.distance, snapshot.npcs[2]!.distance);
  for (const npc of snapshot.npcs) {
    assert.ok(Math.abs(Math.hypot(npc.position.x, npc.position.z) - radius) < 5);
    assert.ok(Math.abs(npc.forward.x * npc.up.x + npc.forward.y * npc.up.y + npc.forward.z * npc.up.z) < 1e-9);
    assert.ok(Math.abs(Math.hypot(npc.right.x, npc.right.y, npc.right.z) - 1) < 1e-9);
    const determinant = npc.right.x * (npc.up.y * npc.forward.z - npc.up.z * npc.forward.y) +
      npc.right.y * (npc.up.z * npc.forward.x - npc.up.x * npc.forward.z) +
      npc.right.z * (npc.up.x * npc.forward.y - npc.up.y * npc.forward.x);
    assert.ok(Math.abs(determinant - 1) < 1e-9, "render basis must be right-handed, never a reflection");
  }
  const broken = options();
  broken.sections[broken.lastSection]!.outgoing = [];
  assert.throws(() => new FormulaRaceEngine(broken), /闭合/);
});

test("paused elapsed time is inert and a delayed frame gives the same race as small steps", () => {
  const delayed = new FormulaRaceEngine(options());
  const stepped = new FormulaRaceEngine(options());
  delayed.update(0, farPlayer()); stepped.update(0, farPlayer());
  delayed.update(20_000, farPlayer());
  for (let time = 50; time <= 20_000; time += 50) stepped.update(time, farPlayer());
  const snapshot = delayed.snapshot;
  assert.deepEqual(delayed.update(20_000, farPlayer()), snapshot);
  assert.deepEqual(delayed.update(19_000, farPlayer()), snapshot);
  for (const npc of snapshot.npcs) {
    const other = stepped.sampleNpc(npc.id)!;
    assert.ok(Math.abs(npc.distance - other.distance) < 1e-8);
    assert.ok(Math.abs(npc.speedKmh - other.speedKmh) < 1e-8);
    assert.ok(npc.distance > 400 && npc.distance < 1500);
  }
});

test("following a moving NPC charges the accelerator; facing away never drafts", () => {
  const engine = new FormulaRaceEngine(options());
  for (let time = 0; time <= 9000; time += 50) {
    const target = engine.sampleNpc(1)!;
    engine.update(time, { position: minusForward(target.position, target.forward, 12),
      forward: target.forward, progress: target.distance - 12, speedKmh: 180 });
  }
  assert.equal(engine.snapshot.charge, 1);
  assert.ok(engine.snapshot.draftingNpcId);
  const backward = new FormulaRaceEngine(options());
  for (let time = 0; time <= 9000; time += 50) {
    const target = backward.sampleNpc(1)!;
    backward.update(time, { position: minusForward(target.position, target.forward, 12),
      forward: { x: -target.forward.x, y: -target.forward.y, z: -target.forward.z },
      progress: target.distance - 12, speedKmh: 180 });
  }
  assert.equal(backward.snapshot.charge, 0);
});

test("pit charging, original boost/stun lifetimes, NPC-only hits and hit cooldown work together", () => {
  const engine = new FormulaRaceEngine(options({ isPit: () => true }));
  assert.equal(engine.activate(), false);
  engine.update(0, farPlayer());
  engine.update(2000, farPlayer());
  assert.equal(engine.snapshot.charge, 1);
  assert.equal(engine.snapshot.inPit, true);
  assert.equal(engine.activate(), true);
  assert.equal(engine.snapshot.boostRemainingMs, 2400);
  assert.equal(engine.stunNpc(0), false, "the local player can never be a stun target");
  assert.equal(engine.stunNpc(99), false);
  assert.equal(engine.stunNpc(1), true);
  assert.equal(engine.stunNpc(1), false, "a continuing contact is only one hit");
  assert.equal(engine.snapshot.hits, 1);
  engine.update(3950, farPlayer());
  assert.equal(engine.sampleNpc(1)!.stunned, true);
  assert.equal(engine.snapshot.charge, 0, "boost use cannot refill itself in a pit");
  engine.update(4000, farPlayer());
  assert.equal(engine.sampleNpc(1)!.stunned, false);
  engine.update(4400, farPlayer());
  assert.equal(engine.snapshot.boosting, false);
  assert.equal(engine.stunNpc(2), false);
  engine.update(6500, farPlayer());
  assert.equal(engine.activate(), true);
  assert.equal(engine.stunNpc(1), true, "the same NPC can be hit after recovery and a new charge");
  assert.equal(engine.snapshot.hits, 2);
  engine.reset();
  assert.equal(engine.snapshot.timeMs, 0);
  assert.equal(engine.snapshot.charge, 0);
  assert.equal(engine.snapshot.hits, 0);
  assert.ok(engine.snapshot.npcs.every(npc => !npc.stunned && npc.speedKmh === 0));
});

test("actual overlap stuns an NPC only while the accelerator is running", () => {
  const engine = new FormulaRaceEngine(options({ isPit: () => true }));
  engine.update(0, farPlayer()); engine.update(2000, farPlayer());
  const target = engine.sampleNpc(1)!;
  const contact: FormulaPlayer = { position: target.position, forward: target.forward, progress: target.distance, speedKmh: 180 };
  engine.update(2000, contact);
  assert.equal(engine.snapshot.hits, 0);
  engine.activate();
  engine.update(2010, contact);
  assert.equal(engine.sampleNpc(1)!.stunned, true);
  assert.ok(engine.snapshot.hits >= 1);
  const hits = engine.snapshot.hits;
  engine.update(2020, contact);
  assert.equal(engine.snapshot.hits, hits);
});

test("pit boxes support rotated geometry and a live road descriptor overrides a fallback", () => {
  const zone = { center: { x: 0, y: 0, z: 0 }, halfSize: { x: 1, y: 2, z: 10 },
    right: { x: 0, y: 0, z: 1 }, forward: { x: 1, y: 0, z: 0 } };
  assert.equal(isInsideFormulaPit({ x: 9, y: 1, z: 0.5 }, [zone]), true);
  assert.equal(isInsideFormulaPit({ x: 0, y: 0, z: 2 }, [zone]), false);
  assert.equal(isInsideFormulaPit({ x: 9, y: 3, z: 0.5 }, [zone]), false);
  const engine = new FormulaRaceEngine(options({ isPit: () => true }));
  engine.update(2000, { ...farPlayer(), inPit: false });
  assert.equal(engine.snapshot.charge, 0);
  assert.equal(engine.snapshot.inPit, false);
});

test("NPCs traverse the circuit and finish; the 30-second grace produces a single immutable DNF result", () => {
  const engine = new FormulaRaceEngine(options());
  engine.update(0, farPlayer());
  engine.update(200_000, farPlayer());
  const snapshot = engine.snapshot;
  assert.equal(snapshot.raceOver, true);
  assert.ok(snapshot.finishedCount > 0);
  assert.equal(snapshot.timeMs, snapshot.finishDeadlineMs);
  assert.ok(snapshot.timeMs < 200_000);
  for (const npc of snapshot.npcs.filter(npc => npc.finishedMs !== undefined)) {
    assert.equal(npc.distance, engine.raceDistance);
    assert.equal(npc.speedKmh, 0);
    assert.ok(Math.abs(Math.hypot(npc.position.x, npc.position.z) - radius) < 3);
  }
  const result = engine.settle();
  assert.equal(result.standings.length, 20);
  assert.equal(result.standings.find(row => row.id === 0)!.dnf, true);
  assert.equal(result.standings.find(row => row.id === 0)!.points, 0);
  assert.equal(result.standings[0]!.points, 20);
  assert.equal(engine.settle(), result);
  assert.equal(Object.isFrozen(result.standings), true);
  engine.update(999_999, { ...farPlayer(), finished: true });
  assert.equal(engine.settle(), result);
});

test("the human finish time remains fixed while NPCs finish during the grace window", () => {
  const engine = new FormulaRaceEngine(options());
  engine.update(0, farPlayer());
  engine.update(40_000, { ...farPlayer(), progress: engine.raceDistance, finished: true, finishedMs: 40_000 });
  assert.equal(engine.standings().find(row => row.id === 0)!.finishedMs, 40_000);
  engine.update(100_000, { ...farPlayer(), progress: engine.raceDistance, finished: true, finishedMs: 40_000 });
  const result = engine.settle();
  assert.equal(result.standings.find(row => row.id === 0)!.finishedMs, 40_000);
  assert.equal(result.standings.find(row => row.id === 0)!.dnf, false);
  assert.ok(result.standings.filter(row => !row.dnf).length > 1);
  assert.equal(engine.activate(), false);
});

test("the hard race limit produces DNF and a late finish event cannot reverse it", () => {
  const engine = new FormulaRaceEngine(options({ laps: 100 }));
  engine.update(0, farPlayer());
  engine.update(600_000, farPlayer());
  assert.equal(engine.snapshot.timeMs, 480_000);
  assert.equal(engine.snapshot.raceOver, true);
  engine.update(610_000, { ...farPlayer(), finished: true, finishedMs: 610_000 });
  assert.equal(engine.standings().find(row => row.id === 0)!.dnf, true);
  assert.equal(engine.settle().standings.every(row => row.points === 0), true);
});

function result(round: number, winner: number): FormulaRoundResult {
  const order = [winner, ...Array.from({ length: 20 }, (_, id) => id).filter(id => id !== winner)];
  return { round, hits: 0, elapsedMs: 60_000, playerRank: order.indexOf(0) + 1,
    standings: order.map((id, index) => ({ id, name: id ? `NPC ${id}` : "玩家", rank: index + 1,
      distance: 1000, finishedMs: 30_000 + index * 1000, dnf: false, points: 20 - index })) };
}

test("the championship accumulates exactly three rounds without duplicate scoring", () => {
  const championship = new FormulaChampionship();
  const first = result(1, 0);
  championship.record(first);
  assert.equal(championship.complete, false);
  assert.equal(championship.completedRounds, 1);
  const firstBoard = championship.standings;
  assert.deepEqual(championship.record(first), firstBoard);
  assert.throws(() => championship.record(result(3, 0)), /依次/);
  championship.record(result(2, 1)); championship.record(result(3, 0));
  assert.equal(championship.complete, true);
  assert.equal(championship.completedRounds, FORMULA_RULES.rounds);
  assert.equal(championship.standings[0]!.id, 0);
  assert.equal(championship.standings[0]!.points, 59);
  assert.deepEqual(championship.standings[0]!.roundPoints, [20, 19, 20]);
  assert.equal(championship.standings[0]!.wins, 2);
  assert.throws(() => championship.record(result(4, 0)), /依次/);
  championship.reset(); assert.equal(championship.complete, false); assert.deepEqual(championship.standings, []);
});

const mirror = fileURLToPath(new URL("../../../mirror/", import.meta.url));
const wkcTracks = ["wkc_R01", "wkc_R03", "wkc_R04"];
const hasOriginalTracks = existsSync(`${mirror}__p3553/archive-index`) && wkcTracks.every(id =>
  existsSync(`${mirror}p3553/track_${id}.rho`) && readFileSync(`${mirror}p3553/track_${id}.rho`).byteLength > 200);

test("original p3553 WKC circuits support all 19 NPCs from the start grid through actual route gates", { skip: !hasOriginalTracks }, async context => {
  const index = JSON.parse(inflateSync(readFileSync(`${mirror}__p3553/archive-index`)).toString()) as { rho: RhoArchiveIndex[] };
  const { y9 } = await import("../generated/formats.js");
  for (const trackId of wkcTracks) {
    const name = `track_${trackId}.rho`;
    const bytes = readFileSync(`${mirror}p3553/${name}`);
    const buffer = (data: Uint8Array) => Uint8Array.from(data).buffer;
    const reader = new RhoReader({ name, size: bytes.length, arrayBuffer: async () => buffer(bytes),
      slice: (a = 0, b = bytes.length) => ({ arrayBuffer: async () => buffer(bytes.subarray(a, b)) }) }, index.rho.find(archive => archive.name === name)!);
    const parsed = y9(await reader.read("track.1s"));
    const route = buildTrackCourseGraph(parsed.root.trackObjects, false);
    const race = new FormulaRaceEngine({ ...route as unknown as Pick<FormulaRaceOptions, "sections" | "firstSection" | "lastSection" | "start">,
      laps: 1, round: 1, groupId: 1, difficulty: "normal", trackId });
    const host = { sections: route.sections, data: { firstSection: route.firstSection, lastSection: route.lastSection, lapTarget: 1 },
      routeStates: new WeakMap() } as unknown as Parameters<typeof resetRouteState>[0];
    const vehicles = new Map(race.snapshot.npcs.map(npc => [npc.id, { position: npc.position }]));
    for (const npc of race.snapshot.npcs) {
      const vehicle = vehicles.get(npc.id)!;
      resetRouteState(host, vehicle, npc.position);
      const along = (npc.position.x - route.start.position.x) * route.start.forward.x +
        (npc.position.y - route.start.position.y) * route.start.forward.y + (npc.position.z - route.start.position.z) * route.start.forward.z;
      assert.ok(Math.abs(along + Math.floor(npc.id / 2) * 5) < 0.01, `${trackId}: exact 5m grid rows`);
    }
    let snapshot = race.update(0, farPlayer());
    for (let time = 100; time <= 180_000 && !snapshot.raceOver; time += 100) {
      snapshot = race.update(time, farPlayer());
      for (const npc of snapshot.npcs) {
        const vehicle = vehicles.get(npc.id)!;
        updateRoute(host, vehicle, vehicle.position, npc.position);
        assert.ok(Number.isFinite(npc.position.x) && Number.isFinite(npc.position.y) && Number.isFinite(npc.position.z));
        assert.ok(Math.hypot(npc.position.x - vehicle.position.x, npc.position.y - vehicle.position.y,
          npc.position.z - vehicle.position.z) < 12, `${trackId}: no route jump for NPC ${npc.id}`);
        vehicle.position = npc.position;
      }
    }
    const finishers = snapshot.npcs.filter(npc => npc.finishedMs !== undefined);
    assert.ok(finishers.length >= 10, `${trackId}: original route must permit a real race finish`);
    for (const npc of finishers) {
      const state = host.routeStates.get(vehicles.get(npc.id)!)!;
      assert.ok(state.lap > 1, `${trackId}: NPC ${npc.id} traversed the original finish gate`);
      assert.ok(Math.abs(state.distance - race.raceDistance) < 8, `${trackId}: NPC ${npc.id} original route distance agrees with simulation (${state.distance} / ${race.raceDistance})`);
    }
    context.diagnostic(`${trackId}: ${route.sections.length} sections, ${race.lapLength.toFixed(1)}m, ${finishers.length} finishers, leader ${(finishers[0]!.finishedMs! / 1000).toFixed(1)}s, gate laps ${[...new Set(finishers.map(npc => host.routeStates.get(vehicles.get(npc.id)!)!.lap))].join(",")}`);
  }
});
