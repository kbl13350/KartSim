import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RemoteFleet, type GiantStatePacket, type MotionPacket,
  type RemoteFleetDependencies } from "./remote-fleet";
import { MotionClockMapping, RemoteMotionPredictor } from "./remote-motion";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class Bi0 {");
const end = source.indexOf("const us =", start);
assert.ok(start > 0 && end > start);
const bi0Source = source.slice(start, end);

function fixture(released: boolean, giant = false) {
  const events: unknown[] = [];
  let now = 1_000;
  let receiveMotion!: (packet: MotionPacket) => void;
  let receiveGiant!: (packet: GiantStatePacket) => void;
  class Presentation {
    value: unknown;
    receive(value: unknown) { this.value = value; events.push(["presentation.receive", value]); }
    consume() { events.push("presentation.consume"); const value = this.value;
      this.value = undefined; return value; }
  }
  class Giant {
    mainScale = { x: 1.3, y: 1.4 };
    receive(packet: GiantStatePacket, tick: number) { events.push(["giant.receive", packet.sequence, tick]); }
    updateEffects(tick: number) { events.push(["giant.effects", tick]); }
    updateVehicle(tick: number, _callback: () => void) { events.push(["giant.vehicle", tick]); }
    nativeFlattenMode(mode: unknown) { events.push(["giant.flatten", mode]); }
    visualScale() { return { x: 1.3, y: 1.4, z: 1.5 }; }
    reset() { events.push("giant.reset"); }
    dispose() { events.push("giant.dispose"); }
  }
  const newer = (sequence: number, previous: number) => sequence > previous;
  const visible = (elapsed: number) => elapsed < 500;
  const deps: RemoteFleetDependencies = {
    createPresentation: () => new Presentation(),
    createGiant: () => new Giant(),
    validateGiantState: () => true,
    newerSequence: newer,
    resetVisible: visible,
  };
  const webBasis = (matrix: Array<{ x: number; y: number; z: number }>) => ({
    right: { x: matrix[0]!.x, y: matrix[2]!.x, z: Math.fround(-matrix[1]!.x) },
    forward: { x: Math.fround(-matrix[0]!.y), y: Math.fround(-matrix[2]!.y), z: matrix[1]!.y },
    up: { x: matrix[0]!.z, y: matrix[2]!.z, z: Math.fround(-matrix[1]!.z) },
  });
  const Original = new Function("Gi0", "BL", "k40", "pL", "n20", "No", "gv", "Ei0",
    `${bi0Source}\nreturn Bi0;`)(
      RemoteMotionPredictor, MotionClockMapping, Presentation, Giant,
      deps.validateGiantState, newer, visible, webBasis,
    ) as new (...args: any[]) => RemoteFleet;
  const assets = { roomId: "room", raceId: "race",
    participants: [
      { playerId: "me", slot: 1, remoteParameters: { mass: 2 } },
      { playerId: "peer-b", slot: 2, remoteParameters: { mass: 2.5 } },
      { playerId: "peer-a", slot: 0, remoteParameters: { mass: 3 } },
    ], drivingMode: { kind: giant ? "giant" : "ordinary" } };
  const connection = {
    roomId: "room", raceId: "race", playerId: "me", motionRoundTripMs: 23,
    subscribeMotion: (listener: typeof receiveMotion) => {
      receiveMotion = listener; events.push("motion.subscribe");
      return () => events.push("motion.unsubscribe");
    },
    subscribeGiantState: (listener: typeof receiveGiant) => {
      receiveGiant = listener; events.push("giant.subscribe");
      return () => events.push("giant.unsubscribe");
    },
  };
  const cadence = {
    recordReceipt: (id: string, tick: number) => events.push(["receipt", id, tick]),
    observe: (id: string, packet: unknown) => events.push(["observe", id, (packet as MotionPacket["payload"]).tick]),
    collisionScale: (id: string, rtt: number | undefined) => {
      events.push(["scale", id, rtt]); return 0.9; },
  };
  const fleet = released
    ? new Original(assets, connection, () => now,
      (error: unknown) => events.push(["error", (error as Error).message]), cadence)
    : new RemoteFleet(assets, connection, () => now,
      (error: unknown) => events.push(["error", (error as Error).message]), cadence, deps);
  return { fleet, events, setNow: (value: number) => { now = value; },
    emitMotion: (packet: MotionPacket) => receiveMotion(packet),
    emitGiant: (packet: GiantStatePacket) => receiveGiant(packet) };
}

function packet(playerId: string, sequence: number,
  changes: Partial<MotionPacket["payload"]> = {}): MotionPacket {
  return {
    roomId: "room", raceId: "race", playerId, sequence,
    payload: {
      kind: "kinematic", tick: 1_000, flags: [1, 0],
      position: [5, 0, -2], quaternion: [1, 0, 0, 0],
      linearVelocity: [1, 0, 0], angularVelocity: [0, 0, 0],
      vector5C: [0, 0, 0], vector68: [0, 0, 0],
      collision: { active: true, scaleX: 1, scaleY: 1 },
      presentation: { visualScaleMode: "flat" },
      visualScale: { x: 1, y: 1, z: 1 },
      raceProgress: { distance: 12, lap: 0 }, ...changes,
    },
  };
}

function snapshot(fleet: RemoteFleet) {
  return {
    disposed: fleet.disposed, collisionOrder: fleet.collisionOrder,
    departed: [...fleet.departed],
    remotes: [...fleet.remotes].map(([id, peer]) => [id, {
      sequence: peer.sequence, receivedAt: peer.receivedAt,
      resetStartedAt: peer.resetStartedAt, progress: peer.progress,
      visualScale: peer.visualScale, motion: peer.motion.copyPose(),
    }]),
    giants: [...fleet.giants.keys()], giantFinished: fleet.giantFinished,
  };
}

test("remote fleet packet, prediction, collision and departure match release", () => {
  function run(released: boolean) {
    const item = fixture(released);
    const { fleet, events } = item;
    fleet.bindClock({ offsetMs: 0 });
    item.emitMotion(packet("peer-a", 1));
    item.emitMotion(packet("peer-a", 1));
    item.emitMotion(packet("peer-b", 1, { resetStartedAt: 995 }));
    item.setNow(1_010);
    fleet.update(1_010, { bypass: false, locked: false });
    const collision: unknown[] = [];
    fleet.forEachCollisionBody(undefined, (body, scale, playerId) =>
      collision.push([body, scale, playerId]));
    const fresh: unknown[] = [];
    fleet.forEachFreshRacePeer(1_010, (...values) => fresh.push(values));
    const pose = fleet.copyWebPose("peer-a");
    const presentation = fleet.consumePresentation("peer-a");
    const visible = fleet.presentationVisible("peer-a", 1_010);
    const rankDisconnected = fleet.rankDisconnected("peer-a");
    fleet.updateRoom({ roomId: "room", race: { raceId: "race" },
      members: [{ playerId: "me" }, { playerId: "peer-a" }] });
    const state = snapshot(fleet);
    fleet.dispose();
    return { events, collision, fresh, pose, presentation, visible,
      rankDisconnected, state, disposed: snapshot(fleet) };
  }
  assert.deepEqual(run(false), run(true));
});

// Not in the release, whose server cancelled the race when a racer left: a
// racer who leaves the room mid-race disappears and stops colliding.
test("a racer who left the room is hidden and no longer collides", () => {
  const item = fixture(false);
  const { fleet } = item;
  fleet.bindClock({ offsetMs: 0 });
  item.emitMotion(packet("peer-a", 1));
  item.emitMotion(packet("peer-b", 1));
  item.setNow(1_010);
  fleet.update(1_010, { bypass: false, locked: false });
  const colliding = () => {
    const ids: string[] = [];
    fleet.forEachCollisionBody(undefined, (_body, _scale, id) => ids.push(id));
    return ids;
  };
  assert.deepEqual(colliding(), ["peer-a", "peer-b"]);
  assert.equal(fleet.presentationVisible("peer-b", 1_010), true);
  assert.equal(fleet.hasDeparted("peer-b"), false);

  fleet.updateRoom({ roomId: "room", race: { raceId: "race" },
    members: [{ playerId: "me" }, { playerId: "peer-a" }] });
  assert.deepEqual(colliding(), ["peer-a"]);
  assert.equal(fleet.presentationVisible("peer-b", 1_010), false);
  assert.equal(fleet.presentationVisible("peer-a", 1_010), true);
  assert.equal(fleet.hasDeparted("peer-b"), true);
  fleet.dispose();
});

// Not in the release: past loading, a racer who has not loaded was dropped
// by the server; it stays in the room but is out of the race.
test("a racer dropped while loading is out of the race", () => {
  const { fleet } = fixture(false);
  const members = [{ playerId: "me" }, { playerId: "peer-a" }, { playerId: "peer-b" }];
  fleet.updateRoom({ roomId: "room", phase: "loading",
    race: { raceId: "race", loadedIds: ["me"] }, members });
  assert.deepEqual([...fleet.departed], []);
  fleet.updateRoom({ roomId: "room", phase: "countdown",
    race: { raceId: "race", loadedIds: ["me", "peer-a"] }, members });
  assert.deepEqual([...fleet.departed], ["peer-b"]);
  assert.equal(fleet.presentationVisible("peer-b", 1_000), false);
  fleet.dispose();
});

test("giant ordered state and reset match release", () => {
  function run(released: boolean) {
    const item = fixture(released, true);
    const { fleet, events } = item;
    fleet.bindClock({ offsetMs: 0 });
    item.emitGiant({ roomId: "room", raceId: "race", playerId: "peer-a", sequence: 1 });
    item.emitMotion(packet("peer-a", 1));
    fleet.updateGiantEffects(1_010);
    fleet.update(1_010, { bypass: false, locked: true });
    const giant = !!fleet.giant("peer-a");
    const collision: unknown[] = [];
    fleet.forEachCollisionBody(undefined, (body, scale, id) => collision.push([body, scale, id]));
    const pose = fleet.copyWebPose("peer-a");
    fleet.resetGiants();
    fleet.dispose();
    return { events, giant, collision, pose, state: snapshot(fleet) };
  }
  assert.deepEqual(run(false), run(true));
});
