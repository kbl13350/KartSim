import assert from "node:assert/strict";
import test from "node:test";

import { MyRoomApi, parseCareerSummary } from "./myroom-api";
import { MyRoomConnection, MyRoomError, myRoomSocketUrl, type RoomEvent,
  type RoomSocket } from "./myroom-connection";

class FakeSocket implements RoomSocket {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  send(data: string): void { this.sent.push(JSON.parse(data)); }
  close(): void { this.closed = true; }
  open(): void { this.readyState = 1; this.onopen?.({}); }
  push(frame: unknown): void { this.onmessage?.({ data: JSON.stringify(frame) }); }
  drop(code = 1006): void { this.readyState = 3; this.onclose?.({ code }); }
  last(): Record<string, unknown> { return this.sent.at(-1)!; }
}

const room = (owner = "o1", nickname = "Owner") => ({
  ownerId: owner, ownerNickname: nickname, ownerExp: 3,
  ownerAppearance: { equipment: { itemIds: { 1: 2, 3: 0 }, systemKart: "practiceKart" }, initial: "", garage: {} },
  settings: { environmentId: 20, displayName: "家", message: "", displayKarts: [{ kind: "kart", itemId: 9 }],
    chatAllowed: true, locked: false, etcLocked: true },
  mainEmblems: [8196, 0],
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const sockets: FakeSocket[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const connection = new MyRoomConnection({
    url: "ws://x/api/myroom/ws", token: () => "tok",
    openSocket: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; },
    setTimeout: ((fn: () => void, ms: number) => { timers.push({ fn, ms }); return timers.length as never; }) as never,
    clearTimeout: (() => {}) as never,
  });
  const events: RoomEvent[] = [];
  connection.onEvent(event => events.push(event));
  return { connection, sockets, timers, events };
}

test("socket URL follows the data service origin", () => {
  assert.equal(myRoomSocketUrl("https://data.example:8443"), "wss://data.example:8443/api/myroom/ws");
  assert.equal(myRoomSocketUrl("http://127.0.0.1:8787"), "ws://127.0.0.1:8787/api/myroom/ws");
});

test("hello, enter and room events", async () => {
  const { connection, sockets, events } = setup();
  connection.start();
  const socket = sockets[0]!;
  socket.open();
  assert.deepEqual(socket.last(), { type: "hello", token: "tok" });
  const entering = connection.enter({ nickname: "Owner" });
  socket.push({ type: "welcome", accountId: "me" });
  await flush();
  const request = socket.last();
  assert.equal(request.type, "enter");
  assert.equal(request.nickname, "Owner");
  socket.push({ type: "room", requestId: request.requestId, room: room(), self: "me", members: [
    { accountId: "o1", nickname: "Owner", exp: 3, level: 2, glove: "노랑1", owner: true, slot: 0,
      appearance: room().ownerAppearance, pose: { x: 1, y: 0, z: 2, yaw: 0.5, moving: false } },
    { accountId: "me", nickname: "Me", exp: 0, level: 1, glove: "", owner: false, slot: 1, appearance: null, pose: null },
  ] });
  const snapshot = await entering;
  assert.equal(snapshot.room.settings.environmentId, 20);
  assert.equal(snapshot.room.settings.etcLocked, true);
  assert.deepEqual(snapshot.room.mainEmblems, [8196, 0]);
  assert.equal(snapshot.members.length, 2);
  assert.deepEqual(snapshot.members[0]!.pose, { x: 1, y: 0, z: 2, yaw: 0.5, moving: false });
  assert.equal(snapshot.members[1]!.appearance, undefined);

  socket.push({ type: "joined", member: { accountId: "v2", nickname: "V2", owner: false, slot: 2 } });
  socket.push({ type: "moved", accountId: "v2", x: 3, y: 0, z: 1, yaw: 1, moving: true });
  socket.push({ type: "chat", accountId: "v2", nickname: "V2", text: "hi", at: 5 });
  socket.push({ type: "left", accountId: "v2", nickname: "V2" });
  assert.deepEqual(events.map(event => event.type), ["connection", "joined", "moved", "chat", "left"]);

  connection.move({ x: 1, y: 2, z: 3, yaw: 0, moving: true });
  assert.deepEqual(socket.last(), { type: "move", x: 1, y: 2, z: 3, yaw: 0, moving: true });
  assert.ok(connection.chat("你好"));
  const chat = socket.last();
  socket.push({ type: "error", code: "CHAT_DISABLED", requestId: chat.requestId });
  assert.deepEqual(events.at(-1), { type: "chat-error", code: "CHAT_DISABLED", mutedUntil: undefined });
});

test("refused enters reject with the service code", async () => {
  const { connection, sockets } = setup();
  connection.start();
  const socket = sockets[0]!;
  socket.open();
  socket.push({ type: "welcome", accountId: "me" });
  const entering = connection.enter({ nickname: "Owner" });
  await flush();
  socket.push({ type: "error", code: "PASSWORD_REQUIRED", nickname: "Owner", requestId: socket.last().requestId });
  await assert.rejects(entering, (error: unknown) => error instanceof MyRoomError &&
    error.code === "PASSWORD_REQUIRED" && error.nickname === "Owner");
  const random = connection.enter({ random: true });
  await flush();
  assert.equal(socket.last().random, true);
  socket.push({ type: "error", code: "RANDOM_FAILED", requestId: socket.last().requestId });
  await assert.rejects(random, /RANDOM_FAILED/);
});

test("a dropped socket reconnects and re-enters the last room", async () => {
  const { connection, sockets, timers, events } = setup();
  connection.start();
  let socket = sockets[0]!;
  socket.open();
  socket.push({ type: "welcome", accountId: "me" });
  const entering = connection.enter({ own: true }, undefined);
  await flush();
  assert.equal(socket.last().nickname, undefined);
  socket.push({ type: "room", requestId: socket.last().requestId, room: room("me", "Me"), self: "me", members: [] });
  await entering;
  socket.drop();
  assert.deepEqual(events.at(-1), { type: "connection", open: false });
  timers.at(-1)!.fn();
  socket = sockets[1]!;
  socket.open();
  socket.push({ type: "welcome", accountId: "me" });
  await flush();
  const rejoin = socket.last();
  assert.equal(rejoin.type, "enter");
  assert.equal(rejoin.nickname, "Me");
  socket.push({ type: "room", requestId: rejoin.requestId, room: room("me", "Me"), self: "me", members: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.at(-1)!.type, "rejoined");

  socket.push({ type: "kicked", ownerNickname: "Me" });
  assert.deepEqual(events.at(-1), { type: "kicked", ownerNickname: "Me" });
  connection.stop();
  assert.ok(socket.closed);
});

test("career and emblem responses are validated", async () => {
  const calls: Array<[string, RequestInit | undefined]> = [];
  const replies: unknown[] = [];
  const api = new MyRoomApi({ requestJson: async (path, init) => { calls.push([path, init]); return replies.shift(); } });
  replies.push({ nickname: "Me", owner: true, points: 5, progress: { level: 3, glove: "노랑1" },
    careers: [{ id: 1, value: 0, state: "rewarded" }, { id: 2, value: 10, state: "playing", locked: true }],
    recent: [{ id: 1, completedAt: 9 }] });
  const summary = await api.careers();
  assert.equal(calls[0]![0], "/api/careers");
  assert.equal(summary.level, 3);
  assert.equal(summary.careers[1]!.locked, true);
  replies.push({ career: { id: 2, value: 10, state: "rewarded" }, point: 5, points: 10, emblem: 8196 });
  assert.deepEqual(await api.completeCareer(2), { career: { id: 2, value: 10, state: "rewarded",
    locked: false, untracked: false }, point: 5, points: 10, emblem: 8196 });
  replies.push({ nickname: "Owner", owner: false, emblems: [{ id: 8196, acquiredAt: 1 }], main: [8196, 0] });
  const emblems = await api.emblems({ nickname: "Owner", password: "pw" });
  assert.equal(calls.at(-1)![0], "/api/myroom/emblems");
  assert.equal(calls.at(-1)![1]!.body, JSON.stringify({ nickname: "Owner", password: "pw" }));
  assert.deepEqual(emblems.main, [8196, 0]);
  assert.throws(() => parseCareerSummary({ nickname: "x", careers: [{ id: 1, value: 0, state: "odd" }] }));
});
