import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { connectGameClient, type ClientConnectionHost, type ServerControlEvent } from "./client-connect";
import { ClockSynchronizer, MotionRoundTripTracker } from "./network-timing";
import { GameMotionDecoder } from "./payload";
import { sanitizeIceServers } from "./http";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const first = source.indexOf("class LT {");
const start = source.indexOf("  async connect(", first);
const end = source.indexOf("  request(", start);
assert.ok(first > 0 && start > first && end > start);

class FakeChannel {
  readyState: RTCDataChannelState = "connecting";
  bufferedAmount = 0;
  binaryType: BinaryType = "blob";
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onopen: (() => void) | null = null;
  close(): void { this.readyState = "closed"; this.onclose?.(); }
  send(): void {}
  open(): void { this.readyState = "open"; this.onopen?.(); }
}

class FakePeer extends EventTarget {
  connectionState: RTCPeerConnectionState = "new";
  iceGatheringState: RTCIceGatheringState = "complete";
  localDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  channels = new Map<string, FakeChannel>();
  createDataChannel(label: string): RTCDataChannel {
    const channel = new FakeChannel();
    this.channels.set(label, channel);
    return channel as unknown as RTCDataChannel;
  }
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "offer-sdp" };
  }
  async setLocalDescription(value: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = value;
  }
  async setRemoteDescription(): Promise<void> {
    this.connectionState = "connected";
    this.channels.forEach(channel => channel.open());
  }
  close(): void { this.connectionState = "closed"; this.channels.forEach(channel => channel.close()); }
}

const roomId = "11111111-1111-4111-8111-111111111111";
const raceId = "22222222-2222-4222-8222-222222222222";
const playerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function harness(released: boolean, answer: unknown = { type: "answer", sdp: "answer-sdp" },
  capabilities: string[] = [], ticket?: string) {
  const requests: unknown[] = [];
  const fetches: unknown[] = [];
  // Kept apart from `fetches` so the release comparisons above stay unchanged.
  const headers: Array<{ url: string; headers: RequestInit["headers"] }> = [];
  const messages: unknown[] = [];
  const peer = new FakePeer();
  let closed = 0;
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    fetches.push({ url: _url, body: init?.body, credentials: init?.credentials });
    headers.push({ url: String(_url), headers: init?.headers });
    return new Response(JSON.stringify(String(_url).endsWith("/ice")
      ? { iceServers: [] } : answer), { status: 200 });
  };
  const host = {
    peer: undefined,
    control: undefined,
    motion: undefined,
    abort: undefined,
    heartbeat: undefined,
    iceRefresh: undefined,
    disconnectTimer: undefined,
    peerTransport: undefined,
    decoder: new GameMotionDecoder(),
    cancelConnect: undefined,
    nextId: 0, pending: new Map(), clock: new ClockSynchronizer(),
    raceLatencies: new Map(), playerId: undefined,
    motionListeners: new Set(), echoRtt: new MotionRoundTripTracker(),
    listeners: new Set([(message: unknown) => messages.push(message)]),
    closeListeners: new Set(),
    motionScope: { roomId, raceId, members: new Set([playerId]),
      sequence: 0, received: new Map(), enabled: true, recipientMask: 0 },
    request: async (message: { type: string }) => {
      requests.push(message);
      if (message.type === "hello") return { type: "welcome", playerId,
        capabilities };
      if (message.type === "clock") return { type: "clock" };
      return { type: "latency-ack" };
    },
    acceptMotion: () => {}, acceptMotionMessage: () => {},
    dispose: function (this: ClientConnectionHost) {
      closed++;
      const current = this.peer;
      this.peer = undefined;
      this.abort?.abort();
      clearInterval(this.heartbeat);
      clearInterval(this.iceRefresh);
      clearTimeout(this.disconnectTimer);
      current?.close();
    },
  } as unknown as ClientConnectionHost;
  const Original = new Function("RTCPeerConnection", "fetch", "zo0", "Uo", "yP", "vf", "pl0", "performance",
    `return class { ${source.slice(start, end)} };`)(
      class { constructor() { return peer; } }, fetchImpl,
      (value: unknown) => value as ServerControlEvent,
      39, "launcher-room-v1", sanitizeIceServers, class {}, { now: () => 140 },
    ) as new () => ClientConnectionHost & {
      connect(url: string, name: string, version: string, equipment: unknown,
        initial: string, raceRuntime: boolean, token?: string): Promise<ServerControlEvent>;
    };
  const target = released ? Object.assign(new Original(), host) : host;
  const connect = () => released
    ? (target as InstanceType<typeof Original>).connect("https://example.org/multiplayer/offer",
      "Tester", "p3553", {}, "", true)
    : connectGameClient(target, "https://example.org/multiplayer/offer",
      "Tester", "p3553", {}, "", true, ticket, {
        validateControlMessage: value => value as ServerControlEvent,
        peerFactory: () => peer as unknown as RTCPeerConnection,
        fetchImpl: fetchImpl as typeof fetch,
        now: () => 140,
      });
  return { target, peer, requests, fetches, headers, messages, connect, closed: () => closed };
}

test("server SDP handshake, welcome, clocks and control dispatch match LT", async () => {
  const run = async (released: boolean) => {
    const { target, peer, requests, fetches, messages, connect, closed } = harness(released);
    const welcome = await connect();
    peer.channels.get("control")!.onmessage?.({ data: JSON.stringify({ type: "latency",
      roomId, raceId, playerId, latencyMs: 27 }) });
    peer.channels.get("control")!.onmessage?.({ data: JSON.stringify({ type: "latency-probe",
      roomId, raceId, nonce: "n1" }) });
    const result = { welcome, requests, fetches, messages,
      playerId: target.playerId, latency: target.raceLatencies.get(playerId),
      control: peer.channels.get("control")?.readyState,
      motion: peer.channels.get("motion")?.readyState };
    target.dispose();
    return { ...result, closed: closed() };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("invalid SDP answer closes the partial connection like LT", async () => {
  const run = async (released: boolean) => {
    const { target, connect, closed } = harness(released, { type: "offer", sdp: "wrong" });
    let error = "";
    try { await connect(); } catch (caught) { error = String(caught); }
    const result = { error, closed: closed(), peer: target.peer };
    target.dispose();
    return result;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("P2P capability, ICE lookup and correlated clock reply match LT", async () => {
  const run = async (released: boolean) => {
    const { target, peer, fetches, connect } = harness(released,
      { type: "answer", sdp: "answer-sdp" }, ["p2p-motion"]);
    await connect();
    const settled: string[] = [];
    target.echoRtt.begin("42", 100);
    target.pending.set("42", { resolve: () => { settled.push("resolved"); },
      reject: () => { settled.push("rejected"); },
      timer: setTimeout(() => {}, 10_000), clockTick: 100 });
    peer.channels.get("control")!.onmessage?.({ data: JSON.stringify({ type: "clock",
      requestId: "42", clientTick: 100, serverTick: 130 }) });
    const result = { hasMesh: !!target.peerTransport,
      urls: fetches.map(value => (value as { url: string }).url),
      clock: target.clock.capture(140),
      rtt: target.echoRtt.milliseconds, settled };
    target.dispose();
    return result;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("WebRTC sends the entry ticket in hello and no bearer token to the game server", async () => {
  const { target, requests, headers, connect } = harness(false,
    { type: "answer", sdp: "answer-sdp" }, ["p2p-motion"], "kt1.entry.ticket");
  await connect();
  const hello = requests.find(request => (request as { type: string }).type === "hello") as
    Record<string, unknown>;
  assert.equal(hello.ticket, "kt1.entry.ticket");
  assert.equal("token" in hello, false);
  assert.deepEqual(headers.map(entry => entry.url), [
    "https://example.org/multiplayer/offer", "https://example.org/multiplayer/ice"]);
  for (const entry of headers) {
    // Headers lowercases names, so any spelling of Authorization is caught.
    assert.equal(new Headers(entry.headers).has("authorization"), false, entry.url);
  }
  assert.deepEqual(headers.map(entry => entry.headers), [
    { "Content-Type": "application/json" }, {}]);
  target.dispose();

  const anonymous = harness(false, { type: "answer", sdp: "answer-sdp" }, []);
  await anonymous.connect();
  assert.equal("ticket" in (anonymous.requests[0] as Record<string, unknown>), false);
  anonymous.target.dispose();
});

class FakeSocket extends EventTarget {
  readyState = 0;
  binaryType = "blob";
  bufferedAmount = 0;
  sent: unknown[] = [];
  constructor(readonly url: string) {
    super();
    queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event("open")); });
  }
  send(data: unknown): void { this.sent.push(data); }
  close(): void { this.readyState = 3; this.dispatchEvent(new Event("close")); }
}

function autoHarness(offerStatus: number) {
  const peer = new FakePeer();
  const sockets: FakeSocket[] = [];
  const events: string[] = [];
  const host = {
    peer: undefined, control: undefined, motion: undefined, abort: undefined, heartbeat: undefined,
    iceRefresh: undefined, disconnectTimer: undefined, peerTransport: undefined,
    decoder: new GameMotionDecoder(), cancelConnect: undefined,
    nextId: 0, pending: new Map(), clock: new ClockSynchronizer(),
    raceLatencies: new Map(), playerId: undefined,
    motionListeners: new Set(), echoRtt: new MotionRoundTripTracker(),
    listeners: new Set([() => events.push("message")]),
    closeListeners: new Set([() => events.push("closed")]),
    request: async (message: { type: string }) => {
      events.push(`request:${message.type}`);
      return message.type === "hello" ? { type: "welcome", playerId, capabilities: [] } : { type: message.type };
    },
    acceptMotion: () => {}, acceptMotionMessage: () => {},
    dispose: () => { events.push("dispose"); },
  } as unknown as ClientConnectionHost;
  const connect = () => connectGameClient(host, "https://example.org/multiplayer/offer", "Tester", "p3553", {}, "",
    true, "kt1.entry.ticket", {
      transport: "auto",
      validateControlMessage: value => value as ServerControlEvent,
      peerFactory: () => peer as unknown as RTCPeerConnection,
      webSocketFactory: url => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      fetchImpl: (async () => new Response(JSON.stringify(offerStatus === 200
        ? { type: "answer", sdp: "answer-sdp" } : { error: "USE_WEBSOCKET" }), { status: offerStatus })) as typeof fetch,
      now: () => 140,
    });
  return { host, peer, sockets, events, connect };
}

test("auto uses the WebRTC channels when the node answers the offer", async () => {
  const { host, peer, sockets, events, connect } = autoHarness(200);
  const welcome = await connect();
  assert.equal(welcome.type, "welcome");
  assert.equal(sockets.length, 0);
  assert.equal(host.peer, peer as unknown as RTCPeerConnection);
  assert.equal(events.filter(event => event === "request:hello").length, 1);
  clearInterval(host.heartbeat);
});

test("auto falls back to the WebSocket with the unused ticket and keeps the client's listeners", async () => {
  const { host, peer, sockets, events, connect } = autoHarness(501);
  const welcome = await connect();
  assert.equal(welcome.type, "welcome");
  assert.equal(peer.connectionState, "closed", "the WebRTC attempt is closed");
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0]!.url, "wss://example.org/multiplayer/ws");
  // Hello went once, over the WebSocket; the attempt neither disposed the client nor ran its close listeners.
  assert.deepEqual(events.filter(event => event.startsWith("request:hello") || event === "dispose" ||
    event === "closed"), ["request:hello"]);
  assert.equal(host.listeners.size, 1);
  assert.equal(host.closeListeners.size, 1);
  clearInterval(host.heartbeat);
});
