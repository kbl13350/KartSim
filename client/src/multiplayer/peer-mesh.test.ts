import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isNewerSequence } from "./motion";
import { GameMotionDecoder, GameMotionEncoder, resolveGameMotion, type DecodedGameMotion } from "./payload";
import { PeerMesh, type PeerSignal } from "./peer-mesh";
import type { RoomSnapshot } from "./protocol";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class pl0 {");
const end = source.indexOf("class gl0 {", start);
assert.ok(start > 0 && end > start);

const roomId = "11111111-1111-4111-8111-111111111111";
const raceId = "22222222-2222-4222-8222-222222222222";
const selfId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

class FakeChannel {
  readyState: RTCDataChannelState = "open";
  bufferedAmount = 0;
  binaryType: BinaryType = "blob";
  onmessage: ((event: MessageEvent) => void) | null = null;
  sent: unknown[] = [];
  send(value: unknown): void { this.sent.push(value); }
  receive(value: unknown): void { this.onmessage?.({ data: value } as MessageEvent); }
}

class FakePeer {
  connectionState: RTCPeerConnectionState = "connected";
  signalingState: RTCSignalingState = "stable";
  iceGatheringState: RTCIceGatheringState = "complete";
  localDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  motion = new FakeChannel();
  control = new FakeChannel();
  config?: RTCConfiguration;
  closed = false;
  createDataChannel(label: string): RTCDataChannel {
    return (label === "peer-motion" ? this.motion : this.control) as unknown as RTCDataChannel;
  }
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "offer-sdp" };
  }
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "answer-sdp" };
  }
  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description;
    this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable";
  }
  setConfiguration(configuration: RTCConfiguration): void { this.config = configuration; }
  async getStats(): Promise<RTCStatsReport> { return new Map() as unknown as RTCStatsReport; }
  close(): void { this.closed = true; this.connectionState = "closed"; }
}

type MeshApi = Pick<PeerMesh,
  "bind" | "updateIceServers" | "send" | "directAvailable" | "receiveSignal" |
  "maintain" | "diagnostics" | "dispose">;

function makeRoom(player = selfId, other = otherId): RoomSnapshot {
  return {
    roomId, revision: 1, name: "test", phase: "racing",
    members: [
      { playerId: player, name: "you", slot: 0, ready: true, team: null },
      { playerId: other, name: "peer", slot: 1, ready: true, team: null },
    ],
    race: { raceId, loadedIds: [player, other] },
  };
}

function harness(released: boolean, playerId = selfId, remoteId = otherId) {
  let tick = 1_000;
  const peers: FakePeer[] = [];
  const commands: Record<string, unknown>[] = [];
  const motions: DecodedGameMotion[] = [];
  const create = () => { const peer = new FakePeer(); peers.push(peer); return peer; };
  const options = {
    playerId, iceServers: [] as RTCIceServer[], now: () => tick,
    peerFactory: () => create() as unknown as RTCPeerConnection,
    send: async (message: Record<string, unknown>) => { commands.push(message); },
    receive: (message: DecodedGameMotion) => { motions.push(message); },
  };
  // The release checks the UUIDs its decoder returns; protocol 40 frames name
  // slots, so its decoder resolves them through the test room first.
  const room = makeRoom(playerId, remoteId);
  const players = new Map(room.members.map(member => [member.slot, member.playerId]));
  class ResolvingDecoder {
    decode(bytes: Uint8Array) {
      const motion = new GameMotionDecoder().decode(bytes);
      return motion && resolveGameMotion(motion, { roomId, raceId, players });
    }
  }
  const ReleasePeerMesh = new Function("RTCPeerConnection", "d6", "No", "kT", "dl0", "fl0", "crypto", "performance",
    `${source.slice(start, end)}; return pl0;`)(
      class extends FakePeer { constructor() { super(); peers.push(this); } },
      ResolvingDecoder, isNewerSequence, 8_192, 3_000, 5_000,
      globalThis.crypto, performance,
    ) as new (configuration: typeof options) => MeshApi;
  const mesh: MeshApi = released ? new ReleasePeerMesh(options) : new PeerMesh(options);
  return { mesh, peers, commands, motions, setTick: (value: number) => { tick = value; }, room };
}

/** A direct frame from the racer in `slot` (makeRoom: 0 is the local racer, 1 the peer). */
function motionFrom(slot: number, sequence: number, frameRaceId = raceId): Uint8Array {
  return new GameMotionEncoder({ raceId: frameRaceId, slot }).encode({
    kind: "kinematic", tick: sequence,
    position: [1, 2, 3], quaternion: [0, 0, 0, 1],
    linearVelocity: [4, 0, 0], angularVelocity: [0, 0, 0],
    vector5C: [0, 0, 0], vector68: [0, 0, 0],
  }, sequence);
}

async function directScenario(released: boolean) {
  const { mesh, peers, commands, motions, setTick, room } = harness(released);
  try {
    mesh.bind(room);
    await new Promise<void>(resolve => setImmediate(resolve));
    const peer = peers[0]!;
    const frame = motionFrom(0, 1);
    const direct = mesh.send(frame, 1, 255);
    mesh.receiveSignal({ type: "p2p-relay", roomId, raceId, playerId: otherId });
    const probing = mesh.send(frame, 2, 255);
    peer.control.receive(JSON.stringify({ type: "motion-ack", sequence: 2 }));
    const restored = mesh.send(frame, 3, 255);
    const remote = motionFrom(1, 7);
    peer.motion.receive(remote.buffer);
    peer.motion.receive(remote.buffer);
    // Another racer's slot and another race are dropped on this link.
    peer.motion.receive(motionFrom(0, 8).buffer);
    peer.motion.receive(motionFrom(1, 9, "33333333-3333-4333-8333-333333333333").buffer);
    setTick(12_000);
    mesh.maintain();
    mesh.updateIceServers([{ urls: "stun:example.org" }]);
    return {
      direct, probing, restored, available: mesh.directAvailable(1),
      sentMotion: peer.motion.sent.length,
      received: motions.length, receivedSequence: motions[0]?.sequence,
      control: peer.control.sent.map(message => JSON.parse(String(message))),
      commands: commands.map(({ generation: _generation, ...rest }) => rest),
      diagnostic: mesh.diagnostics(), config: peer.config,
    };
  } finally { mesh.dispose(); }
}

test("direct motion, relay probe, acknowledgement, validation and upkeep match release", async () => {
  assert.deepEqual(await directScenario(false), await directScenario(true));
});

async function followerScenario(released: boolean) {
  const { mesh, peers, commands, room } = harness(released, otherId, selfId);
  try {
    mesh.bind(room);
    const signal: PeerSignal = { type: "p2p-signal", roomId, raceId,
      playerId: selfId, kind: "offer", sdp: "remote-offer", generation: "g1" };
    await mesh.receiveSignal(signal);
    const first = peers[0]!;
    await mesh.receiveSignal({ ...signal, generation: "g2" });
    const replacement = peers[1]!;
    const result = { firstClosed: first.closed, created: peers.length,
      answers: commands.filter(command => command.kind === "answer")
        .map(({ generation: _generation, ...rest }) => rest),
      connection: mesh.diagnostics()[0]?.connection };
    mesh.bind(undefined);
    return { ...result, replacementClosed: replacement.closed,
      afterClear: mesh.diagnostics() };
  } finally { mesh.dispose(); }
}

test("follower SDP answering, generation replacement and scope clearing match release", async () => {
  assert.deepEqual(await followerScenario(false), await followerScenario(true));
});
