import assert from "node:assert/strict";
import test from "node:test";
import { resolveBackendOrigin, multiplayerEndpoint } from "./config";
import { MultiplayerHttpClient, sanitizeIceServers } from "./http";
import { decodeMotionFrame, encodeMotionFrame, isNewerSequence, motionRaceTag } from "./motion";
import { GameMotionEncoder } from "./payload";
import { MultiplayerTransport } from "./transport";
import { PROTOCOL_VERSION } from "./protocol";

const ROOM = "11111111-1111-1111-1111-111111111111";
const RACE = "22222222-2222-2222-2222-222222222222";
const SELF = "33333333-3333-3333-3333-333333333333";
const OTHER = "44444444-4444-4444-4444-444444444444";

test("backend configuration checks exact origins and safe paths", () => {
  const config = { frontendOrigins: ["http://localhost:5173"], backendOrigin: "https://example.test" };
  assert.equal(resolveBackendOrigin(config, "http://localhost:5173/game"), "https://example.test");
  assert.equal(multiplayerEndpoint("https://example.test", "auth/login"),
    "https://example.test/multiplayer/auth/login");
  assert.throws(() => resolveBackendOrigin(config, "http://127.0.0.1:5173"));
  assert.throws(() => resolveBackendOrigin({ ...config, frontendOrigins: ["http://localhost:5173/"] },
    "http://localhost:5173"));
  assert.throws(() => multiplayerEndpoint("https://example.test", "../admin"));
});

test("motion framing preserves slot, race tag, mask, kind, sequence and payload", () => {
  const payload = Uint8Array.from({ length: 80 }, (_, index) => index);
  assert.equal(motionRaceTag(RACE), 0x22);
  const bytes = encodeMotionFrame({ slot: 7, raceTag: motionRaceTag(RACE),
    sequence: 0xffff_ffff, recipientMask: 4, kind: 2, payload });
  assert.equal(bytes.length, 88);
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), [2, 4, 7, 0x22, 0xff, 0xff, 0xff, 0xff]);
  const frame = decodeMotionFrame(bytes);
  assert.deepEqual({ ...frame, payload: Array.from(frame.payload) }, {
    slot: 7, raceTag: 0x22, sequence: 0xffff_ffff,
    recipientMask: 4, kind: 2, payload: Array.from(payload),
  });
  assert.equal(isNewerSequence(0, 0xffff_ffff), true);
  assert.equal(isNewerSequence(0xffff_ffff, 0), false);
  assert.throws(() => encodeMotionFrame({ ...frame, slot: 8 }));
  assert.throws(() => encodeMotionFrame({ ...frame, payload: new Uint8Array(164) }));
  assert.throws(() => decodeMotionFrame(bytes.subarray(0, 87)));
  assert.throws(() => decodeMotionFrame(new Uint8Array(172)));
  const badSlot = bytes.slice();
  badSlot[2] = 8;
  assert.throws(() => decodeMotionFrame(badSlot));
  bytes[0] = 0;
  assert.throws(() => decodeMotionFrame(bytes));
  // A release frame (magic 19277 first) is rejected by its kind byte.
  const release = new Uint8Array(136);
  release.set([0x4d, 0x4b, 2]);
  assert.throws(() => decodeMotionFrame(release));
});

test("ICE configuration discards unknown servers and credentials", () => {
  const servers = sanitizeIceServers([
    { urls: "turn:evil.test:443", username: "u", credential: "p" },
    { urls: "turn:turn.cloudflare.com:443?transport=udp", username: "u", credential: "p" },
    { urls: "turn:turn.cloudflare.com:443?transport=udp", username: "u", credential: "p" },
  ]);
  assert.deepEqual(servers, [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: ["turn:turn.cloudflare.com:443?transport=udp"], username: "u", credential: "p" },
  ]);
});

class FakeChannel extends EventTarget {
  readyState: RTCDataChannelState = "connecting";
  bufferedAmount = 0;
  binaryType: BinaryType = "blob";
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];
  constructor(readonly label: string, private readonly reply: (value: string) => void) { super(); }
  open(): void { this.readyState = "open"; this.dispatchEvent(new Event("open")); }
  send(value: string | Uint8Array): void {
    this.sent.push(value);
    if (typeof value === "string") this.reply(value);
  }
  receive(value: unknown): void { this.onmessage?.(new MessageEvent("message", { data: value })); }
  close(): void {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.onclose?.();
  }
}

class FakePeer extends EventTarget {
  iceGatheringState: RTCIceGatheringState = "complete";
  connectionState: RTCPeerConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  channels = new Map<string, FakeChannel>();
  replyClock = true;
  welcomeCapabilities: string[] = [];

  createDataChannel(label: string): FakeChannel {
    const channel = new FakeChannel(label, (json) => {
      const request = JSON.parse(json) as { type: string; requestId: string; clientTick?: number };
      queueMicrotask(() => {
        if (request.type === "hello") channel.receive(JSON.stringify({
          type: "welcome", playerId: SELF, protocolVersion: PROTOCOL_VERSION,
          ruleset: "launcher-room-v1", capabilities: this.welcomeCapabilities,
          requestId: request.requestId,
        }));
        if (request.type === "clock" && this.replyClock) channel.receive(JSON.stringify({
          type: "clock", clientTick: request.clientTick,
          serverTick: request.clientTick, requestId: request.requestId,
        }));
        if (request.type === "p2p-signal") channel.receive(JSON.stringify({
          type: "p2p-accepted", requestId: request.requestId,
        }));
      });
    });
    this.channels.set(label, channel);
    return channel;
  }
  async createOffer(): Promise<RTCSessionDescriptionInit> { return { type: "offer", sdp: "v=0\r\nm=application 1 UDP/DTLS/SCTP webrtc-datachannel" }; }
  async setLocalDescription(offer: RTCSessionDescriptionInit): Promise<void> { this.localDescription = offer; }
  async setRemoteDescription(): Promise<void> {
    this.connectionState = "connected";
    this.channels.forEach((channel) => channel.open());
  }
  close(): void { this.connectionState = "closed"; this.channels.forEach((channel) => channel.close()); }
}

class FakeDirectPeer extends FakePeer {
  signalingState: RTCSignalingState = "stable";
  constructor() { super(); this.connectionState = "connected"; }
  override createDataChannel(label: string): FakeChannel {
    const channel = super.createDataChannel(label);
    channel.open();
    return channel;
  }
  override async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    await super.setLocalDescription(description);
    this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
  }
  setConfiguration(): void {}
}

test("transport handshakes, correlates requests and sends scoped motion", async () => {
  const peer = new FakePeer();
  const http = new MultiplayerHttpClient({ backendOrigin: "https://example.test",
    fetchImpl: async () => new Response(JSON.stringify({ type: "answer", sdp: "v=0\r\nm=application 1" }),
      { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  const transport = new MultiplayerTransport({ http, peerFactory: () => peer as unknown as RTCPeerConnection });
  const welcome = await transport.connect({ resourceVersion: "p3553", name: "Test",
    equipment: {}, initial: "", raceRuntime: true });
  assert.equal(welcome.playerId, SELF);
  assert.equal(transport.connected, true);
  assert.ok(transport.captureClock());
  transport.bindRoom({ roomId: ROOM, revision: 1, name: "Room", phase: "racing",
    members: [
      { playerId: SELF, name: "Test", slot: 0, ready: true, team: null },
      { playerId: OTHER, name: "Other", slot: 2, ready: true, team: null },
    ], race: { raceId: RACE, loadedIds: [SELF, OTHER] },
  });
  assert.equal(transport.sendMotion(2, new Uint8Array(80)), true);
  const wire = peer.channels.get("motion")?.sent[0] as Uint8Array;
  assert.equal(decodeMotionFrame(wire).recipientMask, 4);
  let seen = 0;
  transport.subscribeMotion(() => { seen++; });
  peer.channels.get("motion")?.receive(encodeMotionFrame({ slot: 2, raceTag: motionRaceTag(RACE),
    sequence: 1, recipientMask: 0, kind: 2, payload: new Uint8Array(80) }));
  assert.equal(seen, 1);
  // Our own slot, an empty slot and another race are not delivered.
  for (const [slot, raceTag] of [[0, 0x22], [5, 0x22], [2, 0x23]] as const) {
    peer.channels.get("motion")?.receive(encodeMotionFrame({ slot, raceTag,
      sequence: 2, recipientMask: 0, kind: 2, payload: new Uint8Array(80) }));
  }
  assert.equal(seen, 1);
  transport.close();
  assert.equal(transport.connected, false);
});

test("transport routes direct frames, relay probes and received peer motion", async () => {
  const server = new FakePeer();
  server.welcomeCapabilities = ["p2p-motion"];
  const direct = new FakeDirectPeer();
  const http = new MultiplayerHttpClient({ backendOrigin: "https://example.test",
    fetchImpl: async (_url, init) => new Response(JSON.stringify(
      init?.method === "POST" ? { type: "answer", sdp: "v=0" } : { iceServers: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  let created = 0;
  const transport = new MultiplayerTransport({ http,
    peerFactory: () => (++created === 1 ? server : direct) as unknown as RTCPeerConnection });
  try {
    await transport.connect({ resourceVersion: "p3553", name: "Test", equipment: {},
      initial: "", raceRuntime: true });
    transport.bindRoom({ roomId: ROOM, revision: 1, name: "Room", phase: "racing",
      members: [
        { playerId: SELF, name: "Test", slot: 0, ready: true, team: null },
        { playerId: OTHER, name: "Other", slot: 2, ready: true, team: null },
      ], race: { raceId: RACE, loadedIds: [SELF, OTHER] },
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    const sample = { kind: "kinematic" as const, tick: 100,
      position: [1, 2, 3] as const, quaternion: [0, 0, 0, 1] as const,
      linearVelocity: [1, 0, 0] as const, angularVelocity: [0, 0, 0] as const,
      vector5C: [0, 0, 0] as const, vector68: [0, 0, 0] as const };
    const outgoing = new GameMotionEncoder({ raceId: RACE, slot: 0 }).encode(sample, 1);
    assert.equal(transport.sendMotion(2, decodeMotionFrame(outgoing).payload), true);
    assert.equal(direct.channels.get("peer-motion")?.sent.length, 1);
    assert.equal(server.channels.get("motion")?.sent.length, 0);
    let received = 0;
    transport.subscribeMotion(() => { received++; });
    const incoming = new GameMotionEncoder({ raceId: RACE, slot: 2 }).encode(sample, 7);
    direct.channels.get("peer-motion")?.receive(incoming.buffer);
    assert.equal(received, 1);
    server.channels.get("control")?.receive(JSON.stringify({ type: "p2p-relay",
      roomId: ROOM, raceId: RACE, playerId: OTHER }));
    assert.equal(transport.sendMotion(2, decodeMotionFrame(outgoing).payload), true);
    assert.equal(decodeMotionFrame(server.channels.get("motion")?.sent[0] as Uint8Array).recipientMask, 4);
    assert.equal(direct.channels.get("peer-motion")?.sent.length, 2);
    direct.channels.get("peer-control")?.receive(JSON.stringify({ type: "motion-ack", sequence: 2 }));
    assert.equal(transport.sendMotion(2, decodeMotionFrame(outgoing).payload), true);
    assert.equal(server.channels.get("motion")?.sent.length, 1);
    assert.equal(direct.channels.get("peer-motion")?.sent.length, 3);
  } finally { transport.close(); }
});

test("request timeout clears outstanding request", async () => {
  const peer = new FakePeer();
  const http = new MultiplayerHttpClient({ backendOrigin: "https://example.test",
    fetchImpl: async () => new Response(JSON.stringify({ type: "answer", sdp: "v=0\r\nm=application 1" })) });
  const transport = new MultiplayerTransport({ http,
    peerFactory: () => peer as unknown as RTCPeerConnection, requestTimeoutMs: 20 });
  await transport.connect({ resourceVersion: "p3553", name: "Test", equipment: {}, initial: "", raceRuntime: true });
  await assert.rejects(transport.request({ type: "list-ordinary", page: 0 }), /timed out/);
  transport.close();
});

test("connect deadline cancels a WebRTC operation that never settles", async () => {
  const peer = new FakePeer();
  peer.setLocalDescription = async () => new Promise<void>(() => {});
  const http = new MultiplayerHttpClient({ backendOrigin: "https://example.test",
    fetchImpl: async () => new Response("{}") });
  const transport = new MultiplayerTransport({ http,
    peerFactory: () => peer as unknown as RTCPeerConnection, connectTimeoutMs: 20 });
  await assert.rejects(transport.connect({ resourceVersion: "p3553", name: "Test",
    equipment: {}, initial: "", raceRuntime: true }), /cancelled/);
  assert.equal(transport.connected, false);
  assert.equal(peer.connectionState, "closed");
});
