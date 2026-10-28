import assert from "node:assert/strict";
import test from "node:test";
import { acceptServerMotion, sendGameMotion, type ClientMotionHost } from "./client-motion";
import { GameMotionDecoder, GameMotionEncoder, type DecodedGameMotion,
  type GameMotionSample } from "./payload";
import { PeerMesh } from "./peer-mesh";
import { raceMotionSlot } from "./race-motion-slots";
import { RacePeerCadence } from "./race-peer-cadence";
import { bindRaceScope, type RaceSessionHost } from "./race-session";
import type { RoomSnapshot } from "./protocol";
import { MultiplayerTransport } from "./transport";
import { MultiplayerHttpClient } from "./http";
import { decodeMotionFrame } from "./motion";

const roomId = "11111111-1111-4111-8111-111111111111";
const raceId = "22222222-2222-4222-8222-222222222222";
const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd"];
const seats = [0, 4, 1, 5];
const starts = [3, 7, 2, 6];

function room(brave = true) {
  return {
    roomId, revision: 1, name: "motion test", phase: "racing" as const,
    gameplay: brave ? "brave" : "speed",
    members: ids.map((playerId, i) => ({ playerId, slot: seats[i]!,
      name: `player${i}`, ready: true, team: (i % 2 === 0 ? 1 : 2) as 1 | 2 })),
    race: { raceId, loadedIds: [...ids],
      ...(brave ? { brave: { ruleset: "web-brave-v1", forwardTeam: 1 },
        startSlots: Object.fromEntries(ids.map((id, i) => [id, starts[i]!])) } : {}),
      roster: ids.map((playerId, i) => ({ playerId, slot: brave ? starts[i]! : seats[i]!,
        equipment: { itemIds: Array(13).fill(0) as number[] } })),
    },
  };
}

function sample(sequence: number): GameMotionSample {
  return { kind: "kinematic", tick: sequence, position: [1, 2, 3], quaternion: [0, 0, 0, 1],
    linearVelocity: [4, 0, 0], angularVelocity: [0, 0, 0],
    vector5C: [0, 0, 0], vector68: [0, 0, 0] };
}
const frame = (slot: number, sequence = 1) =>
  new GameMotionEncoder({ raceId, slot }).encode(sample(sequence), sequence);

function sessionHost(playerId = ids[0]!) {
  const received: DecodedGameMotion[] = [];
  const sent: Uint8Array[] = [];
  const host = {
    playerId, raceLatencies: new Map(),
    echoRtt: { reportAndReset() {} }, request: async () => undefined,
    subscribe: () => () => {}, subscribeMotion: () => () => {}, sendMotion: () => true,
    decoder: new GameMotionDecoder(),
    motionListeners: new Set([(motion: DecodedGameMotion) => received.push(motion)]),
    motion: { readyState: "open", bufferedAmount: 0,
      send(bytes: Uint8Array) { sent.push(bytes.slice()); } },
    clock: {}, dispose() { assert.fail("valid race motion must not dispose the connection"); },
  } as unknown as RaceSessionHost & ClientMotionHost;
  return { host, received, sent };
}

test("brave server motion stamps and resolves frozen race slots for every racer", () => {
  const snapshot = room();
  for (const [i, id] of ids.entries()) {
    const { host, sent, received } = sessionHost(id);
    bindRaceScope(host, snapshot);
    assert.equal(host.motionScope!.slot, starts[i]);
    assert.deepEqual([...host.motionScope!.players], ids.map((value, j) => [starts[j], value]));
    const mask = starts.reduce((result, slot, j) => result | (j === i ? 0 : 1 << slot), 0);
    assert.equal(host.motionScope!.recipientMask, mask);
    assert.equal(sendGameMotion(host, sample(1)), true);
    const encoded = new GameMotionDecoder().decode(sent[0]!)!;
    assert.equal(encoded.slot, starts[i]);
    assert.equal(encoded.recipientMask, mask);
    for (const [j, otherId] of ids.entries()) {
      if (j === i) continue;
      acceptServerMotion(host, frame(starts[j]!, 10 + j));
      assert.equal(received.at(-1)!.playerId, otherId);
    }
    // A later room snapshot still has lobby seats, not the shuffled grid.
    bindRaceScope(host, structuredClone(snapshot));
    assert.equal(host.motionScope!.slot, starts[i]);
    assert.equal(host.motionScope!.sequence, 1);
  }
});

test("brave cadence retains frozen routing through room updates and departures", () => {
  const snapshot = room();
  const cadence = new RacePeerCadence(snapshot.race, ids[0]!, false);
  cadence.updateRoom(snapshot);
  ids.forEach((id, i) => assert.equal(cadence.slotOf(id), starts[i]));
  cadence.observe(ids[1]!, { kind: "kinematic", routing: { observedSlot: 3, motionMode: 0 } });
  assert.equal(cadence.peers.get(ids[1]!)!.target, ids[0]);
  assert.equal(cadence.select(64, 0, false, { x: 0, y: 0, z: 0 }, () => undefined,
    () => true), (1 << 7) | (1 << 2) | (1 << 6));
  const updated = structuredClone(snapshot);
  updated.members = updated.members.filter(member => member.playerId !== ids[2]);
  cadence.updateRoom(updated);
  assert.equal(cadence.slotOf(ids[0]!), 3);
  assert.equal(cadence.slotOf(ids[1]!), 7);
  assert.equal(cadence.slotOf(ids[2]!), undefined);
  assert.equal(cadence.select(128, 0, false, { x: 0, y: 0, z: 0 }, () => undefined,
    () => true), (1 << 7) | (1 << 6));
});

class FakeChannel {
  readyState = "open";
  bufferedAmount = 0;
  binaryType = "blob";
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sent: unknown[] = [];
  send(value: unknown) { this.sent.push(value); }
  receive(data: unknown) { this.onmessage?.({ data }); }
}
class FakePeer {
  connectionState = "connected";
  signalingState = "stable";
  iceGatheringState = "complete";
  localDescription: RTCSessionDescriptionInit | null = null;
  motion = new FakeChannel();
  control = new FakeChannel();
  createDataChannel(label: string) { return label === "peer-motion" ? this.motion : this.control; }
  async createOffer() { return { type: "offer", sdp: "test-offer" }; }
  async setLocalDescription(value: RTCSessionDescriptionInit) {
    this.localDescription = value; this.signalingState = "have-local-offer";
  }
  async getStats() { return new Map(); }
  close() { this.connectionState = "closed"; }
}

test("brave P2P routes, validates peer identities and falls back using frozen slots", async () => {
  const snapshot = room();
  const peers: FakePeer[] = [];
  const received: DecodedGameMotion[] = [];
  const mesh = new PeerMesh({ playerId: ids[0]!, iceServers: [], now: () => 1_000,
    peerFactory: () => {
      const peer = new FakePeer(); peers.push(peer);
      return peer as unknown as RTCPeerConnection;
    }, send: async () => {}, receive: motion => received.push(motion) });
  try {
    mesh.bind(snapshot as RoomSnapshot);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(peers.length, 3);
    assert.equal(mesh.directAvailable(7), true);
    assert.equal(mesh.directAvailable(4), false);
    assert.deepEqual(mesh.send(frame(3), 1, 1 << 7), { relayMask: 0, sent: true });
    assert.deepEqual(peers.map(peer => peer.motion.sent.length), [1, 0, 0]);
    peers[0]!.motion.receive(frame(7, 2));
    assert.equal(received[0]?.playerId, ids[1]);
    // Old lobby slot and another frozen racer's slot cannot impersonate this peer.
    peers[0]!.motion.receive(frame(4, 3));
    peers[0]!.motion.receive(frame(6, 4));
    assert.equal(received.length, 1);
    mesh.bind(structuredClone(snapshot) as RoomSnapshot);
    peers[0]!.motion.readyState = "closed";
    assert.deepEqual(mesh.send(frame(3, 5), 5, 1 << 7), { relayMask: 1 << 7, sent: false });
    assert.deepEqual(mesh.send(frame(3, 6), 6, 1 << 4), { relayMask: 0, sent: false });
  } finally { mesh.dispose(); }
});

test("ordinary scope and cadence continue following lobby seats", () => {
  const snapshot = room(false);
  const { host } = sessionHost();
  const cadence = new RacePeerCadence(snapshot.race, ids[0]!, false);
  bindRaceScope(host, snapshot);
  cadence.updateRoom(snapshot);
  assert.equal(host.motionScope!.slot, 0);
  assert.equal(cadence.slotOf(ids[1]!), 4);
  snapshot.members[0]!.slot = 3;
  snapshot.members[1]!.slot = 7;
  bindRaceScope(host, snapshot);
  cadence.updateRoom(snapshot);
  assert.equal(host.motionScope!.slot, 3);
  assert.equal(cadence.slotOf(ids[1]!), 7);
});

test("members waiting for the next brave race have no motion identity or peer link", () => {
  const snapshot = room();
  const spectator = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  snapshot.members.push({ playerId: spectator, slot: 2, name: "waiting", ready: false, team: 1 });
  // Even a stale loadedIds entry cannot place a non-racer in the frozen motion roster.
  snapshot.race.loadedIds.push(spectator);
  const { host } = sessionHost();
  bindRaceScope(host, snapshot);
  assert.equal(host.motionScope!.members.has(spectator), false);
  assert.equal(host.motionScope!.players.get(2), ids[2]);
  assert.equal(host.motionScope!.players.size, 4);
  const waiting = sessionHost(spectator).host;
  bindRaceScope(waiting, snapshot);
  assert.equal(waiting.motionScope, undefined);
  const peers: FakePeer[] = [];
  const makeMesh = (playerId: string) => new PeerMesh({ playerId, iceServers: [],
    peerFactory: () => { const peer = new FakePeer(); peers.push(peer);
      return peer as unknown as RTCPeerConnection; }, send: async () => {}, receive: () => {} });
  const activeMesh = makeMesh(ids[0]!);
  const waitingMesh = makeMesh(spectator);
  try {
    activeMesh.bind(snapshot as RoomSnapshot);
    assert.equal(peers.length, 3);
    waitingMesh.bind(snapshot as RoomSnapshot);
    assert.equal(peers.length, 3);
    assert.equal(waitingMesh.directAvailable(7), false);
  } finally { activeMesh.dispose(); waitingMesh.dispose(); }
});

test("brave motion rejects absent or invalid frozen slots instead of using lobby seats", () => {
  const snapshot = room();
  const member = snapshot.members[0]!;
  assert.throws(() => raceMotionSlot({ brave: snapshot.race.brave }, member), /冻结起跑位/);
  for (const slot of [-1, 8, 2.5, "3"]) {
    assert.throws(() => raceMotionSlot({ brave: snapshot.race.brave,
      startSlots: { [member.playerId]: slot } }, member), /冻结起跑位/);
  }
  assert.equal(raceMotionSlot(undefined, member), member.slot);
});

test("standalone multiplayer transport uses the same brave slot map", () => {
  const transport = new MultiplayerTransport({ http: {} as MultiplayerHttpClient });
  const channel = new FakeChannel();
  Object.assign(transport, { motion: channel });
  transport.playerId = ids[0];
  const snapshot = room();
  const spectator = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  snapshot.members.push({ playerId: spectator, slot: 2, name: "waiting", ready: false, team: 1 });
  snapshot.race.loadedIds.push(spectator);
  transport.bindRoom(snapshot as RoomSnapshot);
  const sampleFrame = decodeMotionFrame(frame(3));
  assert.equal(transport.sendMotion(sampleFrame.kind, sampleFrame.payload, 1 << 7), true);
  const sent = decodeMotionFrame(channel.sent[0] as Uint8Array);
  assert.equal(sent.slot, 3);
  assert.equal(sent.recipientMask, 1 << 7);
  transport.playerId = spectator;
  transport.bindRoom(snapshot as RoomSnapshot);
  assert.equal(transport.sendMotion(sampleFrame.kind, sampleFrame.payload), false);
});
