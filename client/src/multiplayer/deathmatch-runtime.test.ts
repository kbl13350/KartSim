import assert from "node:assert/strict";
import test from "node:test";
import { DEATHMATCH_RULES, type DeathmatchState } from "./deathmatch-rules";
import { DeathmatchRuntime, noteDeathmatchKartContact } from "./deathmatch-runtime";

function state(): DeathmatchState {
  return { ...DEATHMATCH_RULES, fallY: -10, eventSequence: 0, scores: { 1: 0, 2: 0 },
    spawns: Array.from({ length: 8 }, (_, slot) => ({ slot,
      position: { x: slot * 10, y: 10, z: 0 }, forward: { x: 0, y: 0, z: 1 } })),
    players: Object.fromEntries(["local", "opponent", "teammate"].map((id, spawnSlot) => [id,
      { lifeSeq: 0, alive: true, spawnSlot, protectedUntil: 0, respawnAt: null, kills: 0, deaths: 0 }])) };
}

function fixture(initial = state(), playerId = "local") {
  const sent: unknown[][] = [], resets: unknown[][] = [];
  const locks = { motion: false, bypass: false, cancel: 0 };
  const physics = { body: { position: { x: 0, y: 10, z: 0 } },
    setRaceMotionLocked(value: boolean) { locks.motion = value; },
    setFullPhysicsBypass(value: boolean) { locks.bypass = value; },
    hardCancelControls() { locks.cancel++; },
    completeCheckpointPose(frame: { position: { x: number; y: number; z: number } }, restart: boolean) {
      resets.push(["pose", frame, restart]); physics.body.position = { ...frame.position };
    } };
  const local: any = { physics, lifecycle: { state: 2 },
    deathmatchStartPoses: initial.spawns.map(spawn => ({ position: spawn.position })),
    track: { resetRouteState(...args: unknown[]) { resets.push(["route", ...args]); } },
    coordinator: { synchronizePositionAnchor() { resets.push(["anchor"]); } } };
  const remotes: { collisionAllowed?: (id: string) => boolean } = {};
  const create = () => new DeathmatchRuntime(local, remotes, { playerId,
    async sendDeathmatchContact(...args: [string, number, number, number]) { sent.push(args); } },
  { deathmatch: initial, roster: [{ playerId: "local", team: 1 },
    { playerId: "opponent", team: 2 }, { playerId: "teammate", team: 1 }] });
  return { create, local, physics, remotes, locks, sent, resets };
}

test("deathmatch rejects an absent local racer before attaching physics callbacks", () => {
  const f = fixture(state(), "spectator");
  assert.throws(f.create, /冻结名单缺少本机车手/);
  assert.equal(f.local.deathmatch, undefined);
  assert.equal(f.remotes.collisionAllowed, undefined);
});

test("deathmatch contacts ignore unknown racers and teammates, throttle repeats, and detach on disposal", () => {
  const f = fixture(), runtime = f.create();
  runtime.update(1000);
  assert.equal(f.remotes.collisionAllowed!("unknown"), false);
  for (const target of [undefined, 3, "unknown", "teammate", "opponent", "opponent"])
    noteDeathmatchKartContact(f.physics, target);
  assert.deepEqual(f.sent, [["opponent", 1, 0, 0]]);
  runtime.update(1349);
  noteDeathmatchKartContact(f.physics, "opponent");
  assert.equal(f.sent.length, 1);
  runtime.update(1350);
  noteDeathmatchKartContact(f.physics, "opponent");
  assert.deepEqual(f.sent[1], ["opponent", 2, 0, 0]);
  runtime.dispose();
  noteDeathmatchKartContact(f.physics, "opponent");
  assert.equal(f.sent.length, 2);
  assert.equal(f.remotes.collisionAllowed, undefined);
});

test("deathmatch holds fallen karts until the server respawns them and restores the frozen pose", () => {
  const f = fixture(), runtime = f.create();
  runtime.bindClock({ offsetMs: 500 });
  f.physics.body.position.y = -11;
  runtime.update(1000);
  assert.equal(runtime.suspended, true);
  assert.equal(runtime.opacity("local"), 0);
  assert.deepEqual(f.locks, { motion: true, bypass: true, cancel: 1 });
  const dead = state(); dead.eventSequence = 1;
  Object.assign(dead.players.local!, { alive: false, respawnAt: 4500, deaths: 1 });
  runtime.updateRoom({ deathmatch: dead, startAt: 500 }, "racing");
  assert.equal(runtime.hudState(1000).respawnRemainingMs, 3000);
  runtime.updateRoom({ deathmatch: state() }, "racing");
  assert.equal(runtime.self.alive, false, "stale room snapshots must not revive the racer");
  const respawned = state(); respawned.eventSequence = 2;
  Object.assign(respawned.players.local!, { lifeSeq: 1, protectedUntil: 6500, deaths: 1 });
  runtime.updateRoom({ deathmatch: respawned }, "racing");
  assert.equal(runtime.suspended, false);
  assert.equal(runtime.protected, true);
  assert.equal(runtime.opacity("local"), 0.4);
  assert.deepEqual(f.physics.body.position, respawned.spawns[0]!.position);
  assert.deepEqual(f.resets.map(entry => entry[0]), ["pose", "route", "anchor"]);
  assert.equal(f.locks.bypass, false);
  assert.equal(f.locks.motion, false);
  noteDeathmatchKartContact(f.physics, "opponent");
  assert.deepEqual(f.sent, [], "respawn protection must prevent contact scoring");
  runtime.dispose();
});

test("deathmatch rejects changed frozen rosters without replacing the accepted state", () => {
  const f = fixture(), runtime = f.create();
  const accepted = runtime.state;
  const changed = state(); delete changed.players.local;
  assert.throws(() => runtime.updateRoom({ deathmatch: changed }, "racing"), /规则或出生点发生变化/);
  assert.equal(runtime.state, accepted);
  assert.equal(runtime.self.alive, true);
  runtime.dispose();
});
