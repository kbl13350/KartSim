// Unit checks for the shared smoke-test client; no services needed.
//   node --test test/lib/kart-client.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ControlSocket, EQUIPMENT_SLOTS, equipmentFromInventory, equipmentWith, parseAccountList, randomForwardedFor,
  readSettings, starterEquipment, unownedEquipment,
} from "./kart-client.mjs";

/** Stands in for a WebSocket: answers clock requests like kart-game. */
class FakeSocket extends EventTarget {
  constructor() {
    super();
    this.sent = [];
  }

  send(text) {
    const request = JSON.parse(text);
    this.sent.push(request);
    if (request.type === "clock") {
      setImmediate(() => this.emit({ type: "clock", requestId: request.requestId,
        clientTick: request.clientTick, serverTick: 1 }));
    }
  }

  close() {
    this.dispatchEvent(new Event("close"));
  }

  emit(message) {
    this.dispatchEvent(new MessageEvent("message",
      { data: typeof message === "string" ? message : JSON.stringify(message) }));
  }
}

// Accepts everything except room snapshots without a room, standing in for
// the frontend's parseServerEvent.
const validate = message => message.type !== "room" || typeof message.room === "object";

test("drain() reports an invalid event that arrived while nobody was waiting", async () => {
  const socket = new FakeSocket();
  const control = new ControlSocket(socket, { validate, timeoutMs: 1000, label: "peer" });
  socket.emit({ type: "room" });
  await assert.rejects(control.drain(), /peer: frontend rejected server event \{"type":"room"\}/);
  // Cleanup stays safe: close() never throws, so finally blocks keep the real error.
  assert.doesNotThrow(() => control.close());
});

test("drain() reports invalid JSON from the server", async () => {
  const socket = new FakeSocket();
  const control = new ControlSocket(socket, { validate, timeoutMs: 1000, label: "peer" });
  socket.emit("{not json");
  await assert.rejects(control.drain(), /peer: server sent invalid JSON/);
});

test("drain() round-trips a clock request and passes when every event was valid", async () => {
  const socket = new FakeSocket();
  const control = new ControlSocket(socket, { validate, timeoutMs: 1000, label: "peer" });
  socket.emit({ type: "room", room: { roomId: "r1" } });
  await control.drain();
  assert.deepEqual(socket.sent.map(request => request.type), ["clock"]);
  // The valid broadcast is still buffered for waitFor().
  assert.equal((await control.waitFor(message => message.type === "room")).room.roomId, "r1");
  control.close();
});

test("drain() catches an invalid event queued before the clock reply", async () => {
  const socket = new FakeSocket();
  const control = new ControlSocket(socket, { validate, timeoutMs: 1000, label: "peer" });
  const send = socket.send.bind(socket);
  socket.send = text => {
    // The server delivers a broadcast it queued earlier, then the reply.
    setImmediate(() => socket.emit({ type: "room" }));
    send(text);
  };
  await assert.rejects(control.drain(), /frontend rejected server event/);
});

test("a socket closed by the test is not a protocol failure", async () => {
  const socket = new FakeSocket();
  const control = new ControlSocket(socket, { validate, timeoutMs: 1000, label: "peer" });
  control.close();
  assert.equal(control.protocolFailure, undefined);
  await assert.rejects(control.drain(), /peer: closed by the test/);
});

test("starter equipment is a complete practice-kart loadout", () => {
  const equipment = starterEquipment({ character: 3, paint: 5, dye: 7 });
  assert.deepEqual(Object.keys(equipment.itemIds).map(Number).sort((a, b) => a - b),
    [...EQUIPMENT_SLOTS].sort((a, b) => a - b));
  assert.equal(equipment.itemIds[1], 3);
  assert.equal(equipment.itemIds[2], 5);
  assert.equal(equipment.itemIds[3], 0);
  assert.equal(equipment.itemIds[70], 7);
  assert.equal(equipment.systemKart, "practiceKart");
  assert.equal(Object.values(equipment.itemIds).filter(item => item !== 0).length, 3);
  // The old guest defaults (kart 387, paint/dye 1) are not part of any starter kit.
  assert.equal(unownedEquipment().itemIds[3], 387);
  assert.equal(unownedEquipment().systemKart, undefined);
});

test("equipmentWith swaps items and keeps systemKart consistent", () => {
  const base = starterEquipment();
  const kart = equipmentWith(base, { 3: 387 });
  assert.equal(kart.itemIds[3], 387);
  assert.equal(kart.systemKart, undefined);
  assert.equal(base.systemKart, "practiceKart", "the original is not modified");
  const character = equipmentWith(base, { 1: 4 });
  assert.equal(character.itemIds[1], 4);
  assert.equal(character.systemKart, "practiceKart");
});

test("equipmentFromInventory picks owned starter items", () => {
  const items = [
    { category: 3, itemId: 0, systemKey: "practiceKart", quantity: 1, expiresAt: null, source: "starter" },
    { category: 1, itemId: 3, quantity: 1, expiresAt: null, source: "starter" },
    { category: 2, itemId: 4, quantity: 1, expiresAt: null, source: "starter" },
    { category: 70, itemId: 7, quantity: 1, expiresAt: null, source: "starter" },
    { category: 2, itemId: 5, quantity: 1, expiresAt: Date.now() - 1000, source: "shop" },
  ];
  const equipment = equipmentFromInventory(items, { character: 2, paint: 5, dye: 7 });
  assert.deepEqual([equipment.itemIds[1], equipment.itemIds[2], equipment.itemIds[70]], [3, 4, 7]);
  assert.throws(() => equipmentFromInventory(items.slice(1)), /practice kart/);
});

test("account list and forwarded addresses", () => {
  assert.deepEqual(parseAccountList(" a_user:pass:word , b_user:x "),
    [{ username: "a_user", password: "pass:word" }, { username: "b_user", password: "x" }]);
  assert.deepEqual(parseAccountList(""), []);
  assert.throws(() => parseAccountList("nopassword"), /username:password/);
  const settings = readSettings({ KART_SMOKE_ACCOUNTS: "u1:p1", KART_SMOKE_FORWARDED_FOR: "0" });
  assert.deepEqual(settings.accounts, [{ username: "u1", password: "p1" }]);
  assert.equal(settings.forwardedFor, false);
  assert.equal(readSettings({}).forwardedFor, true);
  for (let index = 0; index < 50; index++) {
    const address = randomForwardedFor();
    const [a, b, c, d] = address.split(".").map(Number);
    assert.ok(a === 198 && (b === 18 || b === 19) && c >= 0 && c <= 255 && d >= 1 && d <= 254, address);
  }
});
