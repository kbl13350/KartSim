import assert from "node:assert/strict";
import test from "node:test";

import { AccountServiceError } from "../account/account-api";
import { MessengerApi, parseMessengerState, type ChatMessage, type MessengerState } from "./messenger-api";
import {
  CLOSE_REPLACED, CLOSE_SESSION_ENDED, MessengerConnection, messengerSocketUrl, newClientId,
  type MessengerSocket,
} from "./messenger-connection";
import { MAX_CHAT_ROOMS, MessengerStore } from "./messenger-store";

const ME = "00000000-0000-4000-8000-000000000001";
const BOB = "00000000-0000-4000-8000-000000000002";
const CAT = "00000000-0000-4000-8000-000000000003";

function stateJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    me: { accountId: ME, nickname: "我", level: 3, glove: "노랑1" },
    settings: { blockFriendRequests: false, blockGameInvites: true, invisible: false },
    friends: [
      { accountId: BOB, nickname: "Bob", level: 12, glove: "노랑5", favorite: false, since: 5, presence: "online" },
      { accountId: CAT, nickname: "Cat", level: 2, glove: "", favorite: true, since: 6, presence: "weird" },
    ],
    incoming: [{ accountId: "x", nickname: "Xi", level: 1, glove: "", createdAt: 1, expiresAt: 2 }],
    outgoing: [
      { accountId: "y", nickname: "Yu", level: 1, glove: "", state: "refused", createdAt: 1, resolvedAt: 3, expiresAt: 9 },
      { accountId: "z", nickname: "Ze", level: 1, glove: "", state: "lost", createdAt: 1, expiresAt: 9 },
    ],
    blocks: [],
    conversations: [{ accountId: BOB, nickname: "Bob", lastMessageId: 7, lastMessageAt: 70, unread: 2, lastReadId: 5 }],
    limits: { friends: 100 },
    serverTime: 1234,
    ...overrides,
  };
}

function message(id: number, from: string, to: string, text = `m${id}`): ChatMessage {
  return { id, from, to, text, sentAt: id * 10, clientId: `c${id}` };
}

test("the state is validated: unknown presences read offline, bad rows are dropped", () => {
  const state = parseMessengerState(stateJson());
  assert.equal(state.me.nickname, "我");
  assert.equal(state.friends[1]!.presence, "offline");
  assert.equal(state.friends[1]!.favorite, true);
  assert.deepEqual(state.outgoing.map(request => request.state), ["refused"]);
  assert.equal(state.outgoing[0]!.resolvedAt, 3);
  assert.equal(state.settings.blockGameInvites, true);
  assert.equal(state.limits.messageLength, 30);
  assert.throws(() => parseMessengerState({ friends: [] }), AccountServiceError);
});

test("the API sends the contract's paths and bodies", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const api = new MessengerApi({
    async requestJson(path, init) {
      calls.push({ path, init });
      if (path === "/api/messenger/friends/request")
        return { request: { accountId: BOB, nickname: "Bob", level: 1, glove: "", state: "pending",
          createdAt: 1, resolvedAt: null, expiresAt: 2 } };
      if (path.startsWith("/api/messenger/messages?"))
        return { messages: [message(1, BOB, ME), { id: "bad" }], hasMore: true };
      if (path === "/api/messenger/outbox/clear") return { deleted: 3 };
      return { ok: true };
    },
  });
  const result = await api.requestFriend("Bob");
  assert.equal(result.accepted, false);
  assert.deepEqual(JSON.parse(String(calls[0]!.init!.body)), { nickname: "Bob" });
  assert.equal(calls[0]!.init!.method, "POST");
  const page = await api.messages(BOB, 40, 20);
  assert.equal(calls[1]!.path, `/api/messenger/messages?with=${BOB}&limit=20&before=40`);
  assert.equal(page.messages.length, 1);
  assert.equal(page.hasMore, true);
  assert.equal(await api.clearOutbox(), 3);
  await api.respond(BOB, false);
  assert.deepEqual(JSON.parse(String(calls.at(-1)!.init!.body)), { accountId: BOB, accept: false });
});

test("rooms follow the snapshot's conversations and keep unread counts", () => {
  const store = new MessengerStore();
  let notified = 0;
  store.subscribe(() => notified++);
  store.applyState(parseMessengerState(stateJson()));
  assert.equal(store.rooms.length, 1);
  assert.equal(store.rooms[0]!.unread, 2);
  assert.equal(store.unreadTotal, 2);
  assert.equal(store.alert, true);
  assert.ok(notified > 0);
  assert.equal(store.markRead(BOB), true);
  assert.equal(store.unreadTotal, 0);
  // A room the player closed stays closed until a new message arrives.
  store.closeRoom(BOB);
  store.applyState(parseMessengerState(stateJson()));
  assert.equal(store.rooms.length, 0);
  store.receive(message(8, BOB, ME), () => false);
  assert.equal(store.rooms.length, 1);
  assert.equal(store.rooms[0]!.unread, 1);
});

test("messages merge by id, confirm pending lines and skip erased history", () => {
  const store = new MessengerStore();
  store.applyState(parseMessengerState(stateJson({ conversations: [] })));
  const room = store.openRoom(BOB, "Bob")!;
  store.addHistory(BOB, [message(3, BOB, ME), message(5, ME, BOB)], true, false);
  store.addPending(BOB, "c9", "hi");
  store.receive(message(4, BOB, ME), () => true);
  assert.deepEqual(room.lines.map(line => line.kind === "message" ? line.message.id : line.kind), [3, 4, 5, "pending"]);
  store.receive({ ...message(9, ME, BOB, "hi"), clientId: "c9" }, () => true);
  assert.deepEqual(room.lines.map(line => line.kind === "message" ? line.message.id : line.kind), [3, 4, 5, 9]);
  assert.equal(room.unread, 0, "messages read while viewing and my own never count");
  store.addHistory(BOB, [message(1, BOB, ME), message(2, BOB, ME)], false, true);
  assert.equal(room.lines.length, 6);
  assert.equal(room.hasMore, false);
  store.erase(BOB);
  assert.equal(room.lines.length, 0);
  store.addHistory(BOB, [message(9, ME, BOB), message(10, BOB, ME)], false, false);
  assert.deepEqual(room.lines.map(line => line.kind === "message" && line.message.id), [10]);
});

test("ten rooms at most (chatList maxLine)", () => {
  const store = new MessengerStore();
  store.applyState(parseMessengerState(stateJson({ conversations: [] })));
  for (let index = 0; index < MAX_CHAT_ROOMS; index++) assert.ok(store.openRoom(`p${index}`, `P${index}`));
  assert.equal(store.openRoom("p-extra", "Extra"), undefined);
  assert.equal(store.receive(message(1, "p-extra", ME), () => false), undefined);
  store.closeRoom("p3");
  assert.equal(store.activeRoomId, "p9");
  assert.ok(store.openRoom("p-extra", "Extra"));
});

class FakeSocket implements MessengerSocket {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  closed?: number;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code?: number) { this.closed = code; }
  open() { this.readyState = 1; this.onopen?.({}); }
  push(frame: unknown) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  drop(code: number) { this.readyState = 3; this.onclose?.({ code }); }
}

function harness(state: MessengerState = parseMessengerState(stateJson())) {
  const sockets: FakeSocket[] = [];
  const timers: Array<{ fn: () => void; delay: number; id: number }> = [];
  let timerIds = 0;
  const posted: Array<{ path: string; body?: unknown }> = [];
  const api = new MessengerApi({
    async requestJson(path, init) {
      posted.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (path === "/api/messenger/state") return stateJson({ serverTime: 99 });
      if (path === "/api/messenger/messages") return { message: { ...message(50, ME, BOB, "http"), clientId: "h" } };
      return { messages: [], hasMore: false };
    },
  });
  const store = new MessengerStore();
  let ended = 0;
  const connection = new MessengerConnection({
    api, store, url: "ws://kart.test/api/messenger/ws", token: () => "token-1",
    openSocket: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; },
    viewing: () => false,
    onSessionEnded: () => { ended++; },
    setTimeout: ((fn: () => void, delay: number) => { const id = ++timerIds; timers.push({ fn, delay, id }); return id; }) as never,
    clearTimeout: ((id: number) => { const index = timers.findIndex(timer => timer.id === id); if (index >= 0) timers.splice(index, 1); }) as never,
  });
  const runTimers = (filter?: (delay: number) => boolean) => {
    for (const timer of timers.splice(0).filter(timer => !filter || filter(timer.delay))) timer.fn();
  };
  return { sockets, timers, runTimers, api, store, connection, posted, state, ended: () => ended };
}

test("the socket says hello with the token and applies the welcome", () => {
  const h = harness();
  h.connection.start();
  const socket = h.sockets[0]!;
  socket.open();
  assert.deepEqual(socket.sent[0], { type: "hello", token: "token-1" });
  assert.equal(h.store.connection, "connecting");
  socket.push({ type: "welcome", accountId: ME, serverTime: 1, state: stateJson() });
  assert.equal(h.store.connection, "online");
  assert.equal(h.connection.open, true);
  socket.push({ type: "presence", accountId: BOB, presence: "inGame" });
  assert.equal(h.store.friend(BOB)!.presence, "inGame");
  socket.push({ type: "message", message: message(8, BOB, ME) });
  assert.equal(h.store.room(BOB)!.unread, 3);
  h.connection.stop();
});

test("sends go over the socket and resolve with the stored message", async () => {
  const h = harness();
  h.connection.start();
  const socket = h.sockets[0]!;
  socket.open();
  socket.push({ type: "welcome", accountId: ME, serverTime: 1, state: stateJson() });
  const sending = h.connection.send(BOB, "你好", "client-1");
  const frame = socket.sent.at(-1)!;
  assert.equal(frame.type, "send");
  assert.equal(frame.clientId, "client-1");
  socket.push({ type: "sent", requestId: frame.requestId, message: { ...message(9, ME, BOB, "你好"), clientId: "client-1" } });
  assert.equal((await sending).id, 9);
  const flooding = h.connection.send(BOB, "again", "client-2");
  socket.push({ type: "error", code: "CHAT_FLOOD", requestId: socket.sent.at(-1)!.requestId, mutedUntil: 5 });
  await assert.rejects(flooding, error => error instanceof AccountServiceError && error.code === "CHAT_FLOOD");
  h.connection.stop();
});

test("without a socket chat falls back to HTTP", async () => {
  const h = harness();
  const sent = await h.connection.send(BOB, "http", "h");
  assert.equal(sent.id, 50);
  assert.deepEqual(h.posted.at(-1), { path: "/api/messenger/messages", body: { to: BOB, text: "http", clientId: "h" } });
});

test("sync pushes re-read the state; closes reconnect unless the session ended or was replaced", async () => {
  const h = harness();
  h.connection.start();
  h.sockets[0]!.open();
  h.sockets[0]!.push({ type: "welcome", accountId: ME, serverTime: 1, state: stateJson() });
  h.sockets[0]!.push({ type: "sync" });
  h.sockets[0]!.push({ type: "sync" });
  assert.equal(h.timers.filter(timer => timer.delay < 1_000).length, 1, "pushes in a burst read once");
  h.runTimers(delay => delay < 1_000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.posted.filter(call => call.path === "/api/messenger/state").length, 1);
  assert.equal(h.store.state!.serverTime, 99);

  h.sockets[0]!.drop(1006);
  assert.equal(h.store.connection, "offline");
  h.runTimers();
  assert.equal(h.sockets.length, 2);
  h.sockets[1]!.drop(CLOSE_REPLACED);
  assert.equal(h.store.connection, "replaced");
  h.runTimers();
  assert.equal(h.sockets.length, 2);

  const other = harness();
  other.connection.start();
  other.sockets[0]!.drop(CLOSE_SESSION_ENDED);
  assert.equal(other.store.connection, "stopped");
  assert.equal(other.ended(), 1);
});

test("socket URL and client ids", () => {
  assert.equal(messengerSocketUrl("https://kart.example:8443/"), "wss://kart.example:8443/api/messenger/ws");
  assert.equal(messengerSocketUrl("http://127.0.0.1:8787"), "ws://127.0.0.1:8787/api/messenger/ws");
  assert.match(newClientId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
