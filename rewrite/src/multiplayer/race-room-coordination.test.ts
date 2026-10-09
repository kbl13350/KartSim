import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { bindActiveRaceClock, disposeActiveRace, roadblockRemaining,
  scheduleActiveRaceStart, updateActiveRaceRoom,
  type ActiveRaceRoom, type RaceRoomDependencies,
  type RaceClockHost, type RaceRoomRuntimeHost } from "./race-room-coordination";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class Ui0 {");
const end = source.indexOf("const NL = 0.6796875;", start);
assert.ok(start > 0 && end > start);
const sameIdentity = (first: unknown, second: unknown) =>
  JSON.stringify(first) === JSON.stringify(second);
const modeOf = (value: any) => value.mode ?? "ordinary";
const toLocalTick = (serverTick: number, mapping: any) => serverTick + mapping.offsetMs;
const states = { Racing: 3 };
class LegacyClock {
  constructor(public mapping: unknown) {}
}
class LegacySender {
  disposed = false;
  constructor(public physics: unknown, public clock: LegacyClock,
    public connection: unknown, public routing: any) {}
  dispose() { this.disposed = true; }
}
const original = new Function("G2", "t7", "oR", "Nw", "yI", "Y3", "X2", "ki0", "BL",
  `${source.slice(start, end)}\nreturn Ui0;`)(modeOf, sameIdentity, sameIdentity,
  sameIdentity, sameIdentity, toLocalTick, states, LegacySender, LegacyClock) as {
    prototype: Record<string, any>;
  };
const dependencies: RaceRoomDependencies = {
  modeOf, sameRp: sameIdentity, sameRoadblock: sameIdentity,
  sameLte: sameIdentity, sameGiant: sameIdentity, toLocalTick,
  racingState: states.Racing,
};

function room(): ActiveRaceRoom {
  return {
    roomId: "room-1", channelName: "channel-a", phase: "racing",
    members: [{ playerId: "me" }, { playerId: "peer" }],
    race: {
      raceId: "race-1", channelName: "channel-a",
      rp: { code: "rp" }, roadblock: { runnerId: "me", limitMs: 10_000 },
      lte: { type: "normal" }, giant: { enabled: false },
      startAt: 10_000, finishDeadline: 30_000,
      roadblockOutcome: { endAt: 18_000 }, raceOverAt: 31_000,
    },
  };
}

function fixture(released: boolean, mapping: unknown = { offsetMs: 75 }) {
  const events: unknown[] = [];
  const host = released ? Object.create(original.prototype) : {};
  const values: RaceRoomRuntimeHost = {
    disposed: false,
    assets: { channel: { name: "channel-a" }, drivingMode: { kind: "ordinary" },
      roomId: "room-1", raceId: "race-1", dispose: () => events.push("assets.dispose") },
    connection: { playerId: "me", resetMotionRtt: () => events.push("rtt.reset") },
    onError: error => events.push(["error", error.message]),
    rpIdentity: { code: "rp" },
    roadblockIdentity: { runnerId: "me", limitMs: 10_000 },
    lteIdentity: { type: "normal" }, giantIdentity: { enabled: false },
    mapping,
    cadence: { updateRoom: value => events.push(["cadence.room", value.race?.raceId]),
      dispose: () => events.push("cadence.dispose") },
    remotes: { updateRoom: value => events.push(["remotes.room", value.race?.raceId]),
      dispose: () => events.push("remotes.dispose") },
    local: {
      lifecycle: { state: 3 },
      acceptEndTiming: (...args) => events.push(["timing", ...args]),
      physics: { setMultiplayerDrivingScales: value => events.push(["scales", value]) },
      dispose: () => events.push("local.dispose"),
    },
    sender: { dispose: () => events.push("sender.dispose") },
    offTeam: () => events.push("team.off"),
    teamCharge: 4.5,
    slipstream: { reset: () => events.push("slipstream.reset") },
    remoteSlipstreams: new Map([["peer", {}]]),
    collisionFramerate: { dispose: () => events.push("collision.dispose") },
    dispose: () => {},
  };
  Object.assign(host, values);
  if (released) {
    host.dispose = original.prototype.dispose;
  } else {
    host.dispose = () => disposeActiveRace(host);
    host.updateRoom = (value: ActiveRaceRoom) => updateActiveRaceRoom(host, value, dependencies);
    host.roadBlockRemaining = (nowMs: number) => roadblockRemaining(host, nowMs, toLocalTick);
  }
  function snapshot() {
    return {
      disposed: host.disposed,
      room: host.room,
      finishDeadline: host.finishDeadline,
      teamCharge: host.teamCharge,
      senderCleared: host.sender === undefined,
      offTeamCleared: host.offTeam === undefined,
      remoteDraftCount: host.remoteSlipstreams.size,
      events: [...events],
    };
  }
  return { host, events, snapshot };
}

function runRoomTransitions(released: boolean) {
  const { host, snapshot } = fixture(released);
  const first = room();
  const snapshots: unknown[] = [];
  host.updateRoom(first);
  snapshots.push(snapshot());
  first.race!.finishDeadline = 99_999;
  snapshots.push(snapshot()); // The accepted room must be a clone.
  const second = room();
  second.race!.results = { winner: "peer" };
  host.updateRoom(second);
  snapshots.push(snapshot());
  const open = room();
  open.phase = "open";
  host.updateRoom(open);
  snapshots.push(snapshot());
  host.dispose();
  host.dispose();
  snapshots.push(snapshot());
  return snapshots;
}

test("race room timing, snapshots, result handoff and disposal match release", () => {
  assert.deepEqual(runRoomTransitions(false), runRoomTransitions(true));
});

test("identity drift, membership loss and open room rules match release", () => {
  const changed: Array<(value: ActiveRaceRoom) => void> = [
    value => { value.channelName = "channel-b"; },
    value => { value.race!.channelName = "channel-b"; },
    value => { value.race!.rp = { code: "other" }; },
    value => { value.race!.roadblock = { runnerId: "peer", limitMs: 10_000 }; },
    value => { value.roomId = "other"; },
    value => { value.race!.raceId = "other"; },
    value => { value.members = [{ playerId: "peer" }]; },
    value => { value.phase = "open"; },
  ];
  for (const mutate of changed) {
    const run = (released: boolean) => {
      const { host, snapshot } = fixture(released);
      const value = room();
      mutate(value);
      host.updateRoom(value);
      return snapshot();
    };
    assert.deepEqual(run(false), run(true));
  }
});

test("roadblock countdown clamping and missing-clock cases match release", () => {
  const variants = [
    { identity: false, mapping: true, start: true, end: true },
    { identity: true, mapping: false, start: true, end: true },
    { identity: true, mapping: true, start: false, end: true },
    { identity: true, mapping: true, start: true, end: false },
    { identity: true, mapping: true, start: true, end: true },
  ];
  for (const variant of variants) {
    const run = (released: boolean) => {
      const { host } = fixture(released, variant.mapping ? { offsetMs: 75 } : null);
      host.room = room();
      if (!variant.identity) host.roadblockIdentity = undefined;
      if (!variant.start) host.room.race!.startAt = undefined;
      if (!variant.end) host.room.race!.roadblockOutcome = undefined;
      return [8_000, 10_000, 15_000, 20_000, 30_000]
        .map(nowMs => host.roadBlockRemaining(nowMs));
    };
    assert.deepEqual(run(false), run(true));
  }
});

test("missing clock and throwing identity callback retain release cleanup order", () => {
  const withoutClock = (released: boolean) => {
    const { host, snapshot } = fixture(released, null);
    host.updateRoom(room());
    return snapshot();
  };
  assert.deepEqual(withoutClock(false), withoutClock(true));

  const throwingCallback = (released: boolean) => {
    const { host, snapshot } = fixture(released);
    const originalOnError = host.onError;
    host.onError = (error: Error) => {
      originalOnError(error);
      throw new Error("UI callback failed");
    };
    const changed = room();
    changed.channelName = "channel-b";
    let errorMessage: string | undefined;
    try { host.updateRoom(changed); }
    catch (error) { errorMessage = (error as Error).message; }
    return { errorMessage, state: snapshot() };
  };
  assert.deepEqual(throwingCallback(false), throwingCallback(true));
});

function runClock(released: boolean, missingCadence = false, disposed = false) {
  const events: unknown[] = [];
  const host: RaceClockHost & { bindClock(mapping: unknown): void;
    scheduleStart(startAtMs: number): void } = released
    ? Object.create(original.prototype) : {} as any;
  host.disposed = disposed;
  host.clockBound = false;
  host.remotes = {
    bindClock: mapping => { events.push(["remote.clock", mapping]); },
    copyWebPose: id => { events.push(["remote.pose", id]);
      return { position: { x: 1, y: 2, z: 3 } }; },
  };
  host.cadence = missingCadence ? undefined : { id: "cadence" };
  host.local = { physics: { id: "physics" },
    scheduleStart: startAtMs => { events.push(["local.start", startAtMs]); } };
  host.connection = { playerId: "me" };
  if (!released) {
    host.bindClock = mapping => bindActiveRaceClock(host, mapping, {
      makeClock: value => new LegacyClock(value),
      makeSender: (physics, clock, connection, routing) =>
        new LegacySender(physics, clock as LegacyClock, connection, routing),
    });
    host.scheduleStart = startAtMs => scheduleActiveRaceStart(host, startAtMs);
  }
  const results: unknown[] = [];
  const invoke = (name: string, action: () => void) => {
    let error: string | undefined;
    try { action(); }
    catch (failure) { error = (failure as Error).message; }
    results.push([name, error, host.clockBound, host.mapping, [...events]]);
    events.length = 0;
  };
  const mapping = { offsetMs: 70 };
  invoke("start before clock", () => host.scheduleStart(10_000));
  invoke("bind clock", () => host.bindClock(mapping));
  invoke("start", () => host.scheduleStart(11_000));
  invoke("bind again", () => host.bindClock(mapping));
  const sender = host.sender as LegacySender | undefined;
  if (sender) {
    results.push(["sender", sender.physics, sender.clock.mapping,
      sender.connection, sender.routing.cadence, sender.routing.playerId,
      sender.routing.position("peer"), [...events]]);
  }
  return results;
}

test("race clock binding and start scheduling match release", () => {
  assert.deepEqual(runClock(false), runClock(true));
  assert.deepEqual(runClock(false, true), runClock(true, true));
  assert.deepEqual(runClock(false, false, true), runClock(true, false, true));
});

test("an item race fails when race.item changes or disappears", () => {
  for (const [label, item, failed] of [
    ["same rules", { ruleset: "web-item-v1", table: "team" }, false],
    ["other table", { ruleset: "web-item-v1", table: "indi" }, true],
    ["missing", undefined, true],
  ] as const) {
    const { host, snapshot } = fixture(false);
    host.itemIdentity = Object.freeze({ ruleset: "web-item-v1", table: "team" });
    const value = room();
    value.race!.item = item;
    host.updateRoom(value);
    const events = snapshot().events;
    assert.equal(events.some(event => Array.isArray(event) && event[0] === "error" &&
      event[1] === "比赛期间频道身份发生变化。"), failed, label);
  }
  // A speed race must not gain race.item either.
  const speed = fixture(false);
  const value = room();
  value.race!.item = { ruleset: "web-item-v1", table: "indi" };
  speed.host.updateRoom(value);
  assert.equal(speed.snapshot().disposed, true);
});
