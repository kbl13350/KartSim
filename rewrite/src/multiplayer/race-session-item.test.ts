import assert from "node:assert/strict";
import test from "node:test";

import { createRaceConnection, type RaceSessionHost } from "./race-session";

const roomId = "11111111-1111-4111-8111-111111111111";
const raceId = "22222222-2222-4222-8222-222222222222";
const self = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const peer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Message = { type: string; [key: string]: unknown };

function fixture() {
  const requests: Message[] = [];
  const pending: Array<{ message: Message; resolve(value: unknown): void;
    reject(error: Error): void }> = [];
  const listeners = new Set<(event: any) => void>();
  const host: RaceSessionHost = {
    playerId: self, raceLatencies: new Map(),
    echoRtt: { milliseconds: 1, reportAndReset: () => {} },
    request: message => new Promise((resolve, reject) => {
      requests.push(message);
      pending.push({ message, resolve, reject });
    }),
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    subscribeMotion: () => () => {},
    sendMotion: () => true,
    motionScope: { roomId, raceId, members: new Set([self, peer]), sequence: 0,
      received: new Map(), enabled: true, recipientMask: 4 },
  };
  const abort = new AbortController();
  const connection = createRaceConnection(host, roomId, raceId, abort.signal);
  const answer = async (outcome: unknown) => {
    await Promise.resolve();
    await Promise.resolve();
    const next = pending.shift();
    assert.ok(next, "a request is waiting");
    if (outcome instanceof Error) next.reject(outcome);
    else next.resolve(outcome ?? { type: "item", action: "slots", slots: [-1, -1] });
    await Promise.resolve();
  };
  return { host, connection, requests, pending, listeners, abort, answer };
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

test("item requests go one at a time with the sequence rising by one", async () => {
  const { connection, requests, answer } = fixture();
  const first = connection.sendItem("cube", { cubeId: 3, capacity: 2 });
  const second = connection.sendItem("use", { itemId: 7, targetId: peer });
  await flush();
  assert.equal(requests.length, 1, "the second waits for the first reply");
  assert.deepEqual(requests[0], { cubeId: 3, capacity: 2, type: "item", roomId, raceId,
    sequence: 1, action: "cube" });
  const reply = { type: "item", action: "grant", cubeId: 3, itemId: 7, slots: [7, -1] };
  await answer(reply);
  assert.deepEqual(await first, reply);
  await flush();
  assert.deepEqual(requests[1], { itemId: 7, targetId: peer, type: "item", roomId, raceId,
    sequence: 2, action: "use" });
  await answer(new Error("ITEM_NOT_HELD"));
  await assert.rejects(second, /ITEM_NOT_HELD/);
  // A rejection after the sequence check used the number up.
  const third = connection.sendItem("swap");
  await flush();
  assert.equal(requests[2]!.sequence, 3);
  await answer(undefined);
  await third;
});

test("failures before the sequence check keep the number; timeouts use it up", async () => {
  const { connection, requests, answer } = fixture();
  const busy = connection.sendItem("swap");
  await flush();
  await answer(new Error("Connection busy"));
  await assert.rejects(busy, /Connection busy/);
  const again = connection.sendItem("swap");
  await flush();
  assert.equal(requests[1]!.sequence, 1);
  await answer(new Error("Request timeout; synchronize room before retrying"));
  await assert.rejects(again, /timeout/);
  const next = connection.sendItem("swap");
  await flush();
  assert.equal(requests[2]!.sequence, 2);
  await answer(undefined);
  await next;
});

test("rate-limited and non-member rejections come before the sequence check and keep the number", async () => {
  const { connection, requests, answer } = fixture();
  // The WebSocket layer answers RATE_LIMITED before the lobby sees the request.
  for (const code of ["RATE_LIMITED", "RATE_LIMITED", "NOT_ROOM_MEMBER"]) {
    const refused = connection.sendItem("swap");
    await flush();
    await answer(new Error(code));
    await assert.rejects(refused, new RegExp(code));
  }
  assert.deepEqual(requests.map(request => request.sequence), [1, 1, 1]);
  const next = connection.sendItem("swap");
  await flush();
  assert.equal(requests.at(-1)!.sequence, 1);
  await answer(undefined);
  await next;
});

test("an INVALID_SEQUENCE answer probes one ahead, then one behind", async () => {
  const { connection, requests, answer } = fixture();
  for (let index = 0; index < 2; index++) {
    const request = connection.sendItem("swap");
    await flush();
    await answer(undefined);
    await request;
  }
  // The server is one ahead (a lost reply it had accepted).
  const ahead = connection.sendItem("hit", { useId: 4, itemId: 7, result: "hit" });
  await flush();
  assert.equal(requests[2]!.sequence, 3);
  await answer(new Error("INVALID_SEQUENCE"));
  await flush();
  assert.equal(requests[3]!.sequence, 4);
  await answer({ type: "item", action: "hit" });
  await ahead;
  // The server is one behind.
  const behind = connection.sendItem("swap");
  await flush();
  assert.equal(requests[4]!.sequence, 5);
  await answer(new Error("INVALID_SEQUENCE"));
  await flush();
  assert.equal(requests[5]!.sequence, 6);
  await answer(new Error("INVALID_SEQUENCE"));
  await flush();
  assert.equal(requests[6]!.sequence, 4);
  await answer(undefined);
  await behind;
  const after = connection.sendItem("swap");
  await flush();
  assert.equal(requests[7]!.sequence, 5);
  await answer(undefined);
  await after;
  // Every probe rejected: the request fails, the race goes on.
  const lost = connection.sendItem("swap");
  for (const sequence of [6, 7, 5]) {
    await flush();
    assert.equal(requests.at(-1)!.sequence, sequence);
    await answer(new Error("INVALID_SEQUENCE"));
  }
  await assert.rejects(lost, /INVALID_SEQUENCE/);
});

test("invalid item requests are refused locally without a sequence", async () => {
  const { connection, requests, answer } = fixture();
  await assert.rejects(connection.sendItem("cube", { cubeId: 3, capacity: 5 }), /INVALID_ITEM_REQUEST/);
  await assert.rejects(connection.sendItem("hit", { useId: 1, itemId: 7, result: "hit", by: "shield" }),
    /INVALID_ITEM_REQUEST/);
  await assert.rejects(connection.sendItem("place", { useId: 1, point: { x: Number.NaN, y: 0, z: 0 } }),
    /INVALID_ITEM_REQUEST/);
  // Fields cannot override the envelope.
  const request = connection.sendItem("swap", { type: "finish", roomId: "x", sequence: 99 });
  await flush();
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], { type: "item", roomId, raceId, sequence: 1, action: "swap" });
  await answer(undefined);
  await request;
});

test("item events reach subscribers by room and race, without the replies", async () => {
  const { host, connection, listeners, abort } = fixture();
  const events: unknown[] = [];
  connection.subscribeItem(event => events.push(event));
  const base = { type: "item", roomId, raceId };
  for (const listener of listeners) {
    listener({ ...base, action: "used", playerId: peer, useId: 1 });
    listener({ ...base, action: "used", playerId: peer, useId: 2, requestId: "7" });
    listener({ ...base, raceId: "other", action: "used", playerId: peer, useId: 3 });
    listener({ type: "giant-state", roomId, raceId, playerId: peer });
    listener({ ...base, action: "scan", playerId: peer, slots: [7, -1], until: 5 });
  }
  assert.deepEqual(events, [
    { ...base, action: "used", playerId: peer, useId: 1 },
    { ...base, action: "scan", playerId: peer, slots: [7, -1], until: 5 },
  ]);
  abort.abort();
  assert.equal(listeners.size, 0);
  await assert.rejects(connection.sendItem("swap"), /scope expired/);
  host.motionScope = undefined;
  assert.equal(typeof connection.subscribeItem(() => {}), "function");
});

test("the finish report carries perfectStart only when the race gives it (完美起步)", async () => {
  const { connection, requests, answer } = fixture();
  const plain = connection.reportFinish(12345);
  await answer({});
  await plain;
  const perfect = connection.reportFinish(12000, { perfectStart: true });
  await answer({});
  await perfect;
  const missed = connection.reportFinish(13000, { perfectStart: false });
  await answer({});
  await missed;
  const ignored = connection.reportFinish(14000, { perfectStart: "yes" as unknown as boolean });
  await answer({});
  await ignored;
  assert.deepEqual(requests, [
    { type: "finish", elapsedMs: 12345, roomId, raceId },
    { type: "finish", elapsedMs: 12000, perfectStart: true, roomId, raceId },
    { type: "finish", elapsedMs: 13000, perfectStart: false, roomId, raceId },
    { type: "finish", elapsedMs: 14000, roomId, raceId },
  ]);
});
