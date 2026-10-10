import assert from "node:assert/strict";
import test from "node:test";

import { connectGameClient, type ClientConnectionHost,
  type ServerControlEvent } from "./client-connect";
import { disposeClient, sendControlRequest } from "./client-control";
import { websocketUrlForOffer } from "./client-websocket";
import { ClockSynchronizer, MotionRoundTripTracker } from "./network-timing";
import { GameMotionDecoder } from "./payload";
import { parseServerMessage, PROTOCOL_VERSION } from "./protocol";

class FakeSocket extends EventTarget {
  readyState = 0;
  bufferedAmount = 0;
  binaryType = "blob";
  sent: unknown[] = [];
  constructor(readonly url: string) { super(); }
  open(): void { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  send(data: unknown): void {
    this.sent.push(data);
    if (typeof data !== "string") return;
    const request = JSON.parse(data) as { type: string; requestId: string; clientTick?: number };
    if (request.type === "hello") this.receive({ type: "welcome", requestId: request.requestId,
      playerId: "player-a", protocolVersion: PROTOCOL_VERSION, ruleset: "launcher-room-v1", capabilities: [] });
    if (request.type === "clock") this.receive({ type: "clock", requestId: request.requestId,
      clientTick: request.clientTick, serverTick: 120 });
    if (request.type === "list-ordinary") this.receive({ type: "rooms", requestId: request.requestId,
      page: 0, total: 0, rooms: [] });
  }
  receive(value: unknown): void {
    queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
      data: JSON.stringify(value),
    })));
  }
  binary(value: Uint8Array): void {
    this.dispatchEvent(new MessageEvent("message", { data: value.buffer }));
  }
  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}

function makeHost() {
  const events: unknown[] = [];
  const binary: unknown[] = [];
  let closed = 0;
  const host = {
    peer: undefined, control: undefined, motion: undefined, abort: undefined,
    heartbeat: undefined, iceRefresh: undefined, disconnectTimer: undefined,
    peerTransport: undefined, decoder: new GameMotionDecoder(),
    cancelConnect: undefined, nextId: 0, pending: new Map(),
    clock: new ClockSynchronizer(), raceLatencies: new Map(),
    playerId: undefined, motionListeners: new Set(),
    echoRtt: new MotionRoundTripTracker(),
    listeners: new Set([(value: unknown) => events.push(value)]),
    closeListeners: new Set([() => { closed++; }]),
    request: (value: { type: string }) => sendControlRequest(host, value) as Promise<ServerControlEvent>,
    acceptMotion: (value: unknown) => { binary.push(value); },
    acceptMotionMessage: () => {},
    dispose: () => disposeClient(host),
  } as unknown as ClientConnectionHost;
  return { host, events, binary, closed: () => closed };
}

test("the game server WebSocket uses one channel for the existing hello, clock, room and motion protocol", async () => {
  const socket = new FakeSocket("ws://127.0.0.1:8788/multiplayer/ws");
  const { host, events, binary, closed } = makeHost();
  const connection = connectGameClient(host, "http://127.0.0.1:8788/multiplayer/offer",
    "Tester", "p3553", {}, "", true, "kt1.entry.ticket", {
      transport: "websocket", webSocketFactory: url => {
        assert.equal(url, socket.url);
        queueMicrotask(() => socket.open());
        return socket as unknown as WebSocket;
      },
      now: () => 100,
      validateControlMessage: value => parseServerMessage(value) as ServerControlEvent,
    });
  const welcome = await connection;
  assert.equal(welcome.playerId, "player-a");
  assert.equal(host.playerId, "player-a");
  assert.equal(socket.binaryType, "arraybuffer");
  assert.equal(host.clock.capture(100)?.offsetMs, 20);
  assert.deepEqual(socket.sent.slice(0, 4).map(value => JSON.parse(String(value)).type),
    ["hello", "clock", "clock", "clock"]);
  const hello = JSON.parse(String(socket.sent[0])) as Record<string, unknown>;
  assert.equal(hello.ticket, "kt1.entry.ticket");
  assert.equal("token" in hello, false, "the session token never reaches a game server");
  assert.deepEqual(await host.request({ type: "list-ordinary", page: 0 }),
    { type: "rooms", requestId: "5", page: 0, total: 0, rooms: [] });
  socket.receive({ type: "left", roomId: "room-a" });
  await new Promise<void>(resolve => queueMicrotask(resolve));
  assert.equal((events.at(-1) as { type: string }).type, "left");
  socket.binary(new Uint8Array([1, 2, 3]));
  assert.deepEqual(new Uint8Array(binary[0] as ArrayBuffer), new Uint8Array([1, 2, 3]));
  host.dispose();
  assert.equal(closed(), 1);
  assert.equal(socket.readyState, 3);
});

test("WebSocket URL conversion rejects unexpected endpoints", () => {
  assert.equal(websocketUrlForOffer("https://example.test/multiplayer/offer"),
    "wss://example.test/multiplayer/ws");
  assert.throws(() => websocketUrlForOffer("http://example.test/private/offer"));
  assert.throws(() => websocketUrlForOffer("http://example.test/multiplayer/offer?token=x"));
});

test("hello omits the ticket field when no ticket is supplied", async () => {
  const socket = new FakeSocket("ws://127.0.0.1:8788/multiplayer/ws");
  const { host } = makeHost();
  await connectGameClient(host, "http://127.0.0.1:8788/multiplayer/offer",
    "Tester", "p3553", {}, "", false, undefined, {
      transport: "websocket", webSocketFactory: () => {
        queueMicrotask(() => socket.open());
        return socket as unknown as WebSocket;
      },
      now: () => 100,
      validateControlMessage: value => parseServerMessage(value) as ServerControlEvent,
    });
  const hello = JSON.parse(String(socket.sent[0])) as Record<string, unknown>;
  assert.deepEqual(Object.keys(hello).sort(), ["equipment", "initial", "name", "protocolVersion",
    "raceRuntime", "requestId", "resourceVersion", "ruleset", "type"]);
  host.dispose();
});
