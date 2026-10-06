import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CollisionFramerateHistory, RacePeerCadence,
  type CadenceRace, type CadenceRoom } from "./race-peer-cadence";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("const h1 = Math.fround;");
const end = source.indexOf("const M9 = Math.fround,", start);
assert.ok(start > 0 && end > start);
const original = new Function("G2", `${source.slice(start, end)}\nreturn { Vi0, Ni0 };`)(
  (race: { mode?: string }) => race.mode ?? "ordinary",
) as {
  Vi0: new (race: CadenceRace, localId: string) => RacePeerCadence;
  Ni0: typeof CollisionFramerateHistory;
};

const race = {
  raceId: "race-1",
  mode: "ordinary",
  roster: [
    { playerId: "me", slot: 0, equipment: { itemIds: Array(13).fill(0) } },
    { playerId: "a", slot: 1, equipment: { itemIds: Array(13).fill(0) } },
    { playerId: "b", slot: 2, equipment: { itemIds: [...Array(12).fill(0), 3] } },
    { playerId: "c", slot: 3, equipment: { itemIds: Array(13).fill(0) } },
  ],
} satisfies CadenceRace & { mode: string };

function cadenceState(cadence: RacePeerCadence) {
  return {
    peers: [...cadence.peers].map(([id, peer]) => [id, { ...peer }]),
    lastTick: cadence.lastTick,
    previousMode: cadence.previousMode,
    previousSuspended: cadence.previousSuspended,
    disposed: cadence.disposed,
    raceId: cadence.raceId,
    special: cadence.special,
  };
}

function runCadence(released: boolean, mode = "ordinary") {
  const selectedRace = { ...race, mode };
  const cadence = released
    ? new original.Vi0(selectedRace, "me")
    : new RacePeerCadence(selectedRace, "me", mode !== "ordinary");
  const out: unknown[] = [];
  const record = (value: unknown) => out.push([value, cadenceState(cadence)]);
  const room: CadenceRoom = {
    race: { raceId: "race-1", loadedIds: ["a", "b", "c"] },
    members: [{ playerId: "me", slot: 0 }, { playerId: "a", slot: 1 },
      { playerId: "b", slot: 2 }, { playerId: "c", slot: 3 }],
  };
  cadence.updateRoom(room); record("room");
  cadence.observe("a", { kind: "kinematic", routing: { observedPlayerId: "me", motionMode: 0 } });
  cadence.observe("b", { kind: "kinematic", routing: { observedPlayerId: "me", motionMode: 0 } });
  cadence.observe("c", { kind: "kinematic", routing: { observedPlayerId: "a", motionMode: 0 } });
  cadence.recordReceipt("a", 4_294_967_100);
  cadence.recordReceipt("a", 42);
  cadence.recordReceipt("b", 1_000);
  cadence.recordReceipt("b", 1_240);
  record("motion");
  const local = { x: 0, y: 1, z: 2 };
  const remotePosition = (id: string) => id === "a" ? { x: 5, y: 1, z: 2 } : undefined;
  const direct = (slot: number) => slot !== 3;
  for (const [tick, motionMode, suspended] of [
    [32, 0, false], [64, 0, false], [128, 0, false], [192, 0, false],
    [256, 1, false], [320, 0, false], [384, 0, true], [448, 0, false],
  ] as const) {
    record(["select", tick, cadence.select(tick, motionMode, suspended,
      local, remotePosition, direct)]);
    record(["collision", tick, cadence.collisionScale("a", 50),
      cadence.collisionScale("b", 50), cadence.collisionScale("c", 150)]);
  }
  cadence.updateRoom({ ...room, race: { raceId: "race-1", loadedIds: ["a", "c"] },
    members: [{ playerId: "me", slot: 0 }, { playerId: "a", slot: 4 },
      { playerId: "c", slot: 3 }] });
  record("departure and slot change");
  cadence.observe("a", { kind: "legacy" });
  record(["select", 512, cadence.select(512, 0, false, local, remotePosition, direct)]);
  cadence.updateRoom({ race: { raceId: "another", loadedIds: [] }, members: [] });
  record("race changed");
  record(["select", 576, cadence.select(576, 0, false, local, remotePosition, direct)]);
  return out;
}

test("peer send cadence, collision scaling, roster edits and cleanup match release", () => {
  assert.deepEqual(runCadence(false), runCadence(true));
  assert.deepEqual(runCadence(false, "giant"), runCadence(true, "giant"));
});

test("peer cadence rejects incomplete or duplicate equipment like release", () => {
  for (const roster of [
    [{ playerId: "me", slot: 0 }, { playerId: "a", slot: 1 }],
    [{ playerId: "a", slot: 1, equipment: { itemIds: [...Array(12).fill(0), 65_536] } }],
    [race.roster[1]!, { ...race.roster[1]!, slot: 2 }],
  ]) {
    const invalidRace = { ...race, roster };
    const create = (released: boolean) => released
      ? new original.Vi0(invalidRace, "me")
      : new RacePeerCadence(invalidRace, "me", false);
    assert.throws(() => create(false), { message: "Distance cadence requires frozen participant equipment" });
    assert.throws(() => create(true), { message: "Distance cadence requires frozen participant equipment" });
  }
});

function runCollisionHistory(released: boolean, enabled: boolean) {
  const counter = { fps: 60 };
  const history = released
    ? new original.Ni0(enabled, ["a", "b"], counter)
    : new CollisionFramerateHistory(enabled, ["a", "b"], counter);
  const out: unknown[] = [];
  for (const [fps, scheduled, colliding] of [
    [20, false, false], [20, false, true], [45, false, true],
    [60, false, true], [90, false, true], [90, true, true],
    [Number.NaN, false, true], [0, false, true],
  ] as const) {
    counter.fps = fps;
    history.record("a", colliding);
    out.push([history.factor("a", scheduled), history.factor("b", scheduled),
      [...history.previous]]);
  }
  for (const operation of [() => history.factor("unknown", false),
    () => history.record("unknown", true)]) {
    try { operation(); out.push("no error"); }
    catch (error) { out.push((error as Error).message); }
  }
  history.dispose();
  out.push([...history.previous]);
  return out;
}

test("collision frame-rate adjustment and opponent validation match release", () => {
  assert.deepEqual(runCollisionHistory(false, true), runCollisionHistory(true, true));
  assert.deepEqual(runCollisionHistory(false, false), runCollisionHistory(true, false));
  for (const ids of [Array(8).fill("same"), ["a", "a"]]) {
    assert.throws(() => new CollisionFramerateHistory(true, ids, { fps: 60 }),
      { message: "碰撞帧率历史缺少唯一的本局对手身份。" });
    assert.throws(() => new original.Ni0(true, ids, { fps: 60 }),
      { message: "碰撞帧率历史缺少唯一的本局对手身份。" });
  }
});
