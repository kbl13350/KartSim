import assert from "node:assert/strict";
import test from "node:test";
import { ActiveRaceCoordinator, type ActiveRaceCoordinatorDependencies } from "./active-race-coordinator";
import { RaceStartCoordinator, type CoordinatedRoom, type RaceStartRules } from "./race-start-coordinator";
import { updateActiveRaceRoom, type ActiveRaceRoom, type RaceRoomDependencies } from "./race-room-coordination";

type Rules = { ruleset: string; forwardTeam: number };
const identity = (): Rules => ({ ruleset: "web-brave-v1", forwardTeam: 1 });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const mode = (value: unknown) => (value as { gameplay?: string })?.gameplay ?? "ordinary";
const clock = (server: number) => server;
const startRules: RaceStartRules = { gameplay: mode, sameRoadblock: same, sameLte: same,
  sameRp: same, toLocalStartTick: clock };
const runtimeRules: RaceRoomDependencies = { modeOf: mode, sameRp: same, sameRoadblock: same,
  sameLte: same, sameGiant: same, toLocalTick: clock, racingState: 3 };

function snapshot(revision: number, brave: unknown = identity()): CoordinatedRoom {
  return { roomId: "room", revision, name: "Brave", phase: "loading", hostId: "me",
    mode: "team", speed: 7, speedVersion: "国服", channelName: "speedTeamCombine",
    resourceVersion: "p3553", gameplay: "brave", members: [
      { playerId: "me", name: "Me", slot: 0, ready: true, team: 1 },
    ], race: { raceId: "race", channelName: "speedTeamCombine", gameplay: "brave",
      loadedIds: [], brave } };
}

const mutations = [
  ["changed direction", { ruleset: "web-brave-v1", forwardTeam: 2 }],
  ["changed ruleset", { ruleset: "future", forwardTeam: 1 }],
  ["missing rules", undefined],
] as const;

test("loading rejects changed or removed Brave direction before scheduling the race", async () => {
  for (const [label, changed] of mutations) {
    const errors: unknown[] = [], commands: unknown[] = [], starts: unknown[] = [];
    let disposed = false;
    const coordinator = new RaceStartCoordinator({
      loader: { async prepare() { return { dispose() { disposed = true; }, scheduleStart(time) { starts.push(time); } }; } },
      captureClock: () => ({}), send: async command => { commands.push(command); },
      onError: error => { errors.push(error); },
    }, startRules);
    coordinator.update(snapshot(1));
    await new Promise<void>(resolve => setImmediate(resolve));
    coordinator.update(snapshot(2));
    assert.equal(coordinator.active?.failed, false, label);
    const update = snapshot(3);
    update.race!.brave = changed;
    update.race!.startAt = 123;
    coordinator.update(update);
    assert.equal(coordinator.active?.failed, true, label);
    assert.equal(disposed, true, label);
    assert.equal(starts.length, 0, label);
    assert.match(String(errors[0]), /频道配置发生变化/);
    assert.ok(commands.some(command => (command as { type: string }).type === "load-failed"));
  }
});

function driver(brave: Rules | null = identity()) {
  const errors: unknown[] = [];
  let propagated = 0;
  const assets = { roomId: "room", raceId: "race", mode: "team", speed: 7,
    channel: { name: "speedTeamCombine", adjustCollision: true },
    drivingMode: { kind: brave ? "brave" : "ordinary" },
    participants: [{ playerId: "me", collisionBalance: {} }], dispose() {} };
  const ops: ActiveRaceCoordinatorDependencies = {
    normalizeRp: value => value,
    createPresentation: () => ({}), createSlipstream: () => ({}),
    createCollisionFramerate: () => ({ dispose() {} }),
    createLocal: () => ({ queueRemoteKart() {}, physics: {}, track: {}, lifecycle: { state: 3 } }),
    createCadence: () => ({ updateRoom() { propagated++; } }),
    createRemotes: () => ({ updateRoom() { propagated++; } }),
    resolveRemoteCollision() {}, bindClock() {}, scheduleStart() {}, updateFrame() {},
    updateRemoteViews() {}, roadblockRemaining() {},
    updateRoom: (host, value) => updateActiveRaceRoom(host, value, runtimeRules),
    dispose: host => { host.disposed = true; },
  };
  const local = new ActiveRaceCoordinator(assets, { channelName: assets.channel.name, brave,
    roster: [{ playerId: "me", team: 1 }] }, { playerId: "me", sendTeamCharge() {},
    subscribeTeamGauge: () => () => {} }, () => 0, error => { errors.push(error); }, false, ops);
  return { local, errors, propagated: () => propagated };
}

test("runtime owns a copied frozen Brave direction and rejects direction drift", () => {
  const rules = identity();
  const first = driver(rules);
  assert.ok(Object.isFrozen(first.local.braveIdentity));
  rules.forwardTeam = 2;
  assert.deepEqual(first.local.braveIdentity, identity());
  for (const [label, changed] of mutations) {
    const { local, errors, propagated } = driver();
    const stable = snapshot(1) as unknown as ActiveRaceRoom;
    local.updateRoom(stable);
    assert.equal(local.disposed, false);
    assert.equal(propagated(), 2);
    const update = snapshot(2) as unknown as ActiveRaceRoom;
    update.race!.brave = changed;
    local.updateRoom(update);
    assert.equal(local.disposed, true, label);
    assert.equal(propagated(), 2, "changed rules must not reach remotes/cadence");
    assert.match(String(errors[0]), /频道身份发生变化/);
  }
});

test("ordinary runtime cannot gain Brave rules during the same race", () => {
  const { local, errors } = driver(null);
  const room = snapshot(1) as unknown as ActiveRaceRoom & { gameplay: string };
  room.gameplay = "ordinary";
  (room.race as unknown as { gameplay: string }).gameplay = "ordinary";
  local.updateRoom(room);
  assert.equal(local.disposed, true);
  assert.match(String(errors[0]), /频道身份发生变化/);
});
