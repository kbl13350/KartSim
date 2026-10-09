// Unit checks for the item race helpers the smoke and the test bot share; no
// services needed. The motion codec round trip and the event validators use
// the browser's modules through tsx and are skipped without `npm ci` in
// rewrite/.
//   node --test test/lib/item-race.test.mjs        (from server-go/)
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  browserAccepts, browserEventValidation, expectedTargets, groupWeight, ITEM, ItemChannel, itemLife, kartSample,
  loadItemData, MotionPump, othersMask, rankGroup, repoRoot, ServerClock, wireVector,
} from "./item-race.mjs";

const haveTsx = existsSync(join(repoRoot, "rewrite/node_modules/tsx/dist/esm/api/index.mjs"));
const browser = async specifier => {
  const { tsImport } = await import(join(repoRoot, "rewrite/node_modules/tsx/dist/esm/api/index.mjs"));
  return tsImport(join(repoRoot, specifier), import.meta.url);
};

test("the item data the node embeds", () => {
  const data = loadItemData();
  assert.equal(groupWeight(data, "indi", ITEM.banana, "top"), 25);
  assert.equal(groupWeight(data, "team", ITEM.slotLock, "low"), 2);
  assert.equal(groupWeight(data, "indi", ITEM.slotLock, "low"), 0);
  assert.equal(itemLife(data, ITEM.slotLock, "Use"), 2000);
  assert.equal(itemLife(data, ITEM.booster, "Use"), 0);
});

test("rank groups follow itemmode.GroupOf", () => {
  const groups = racers => Array.from({ length: racers }, (_, index) => rankGroup(index + 1, racers));
  assert.deepEqual(groups(1), ["top"]);
  assert.deepEqual(groups(2), ["top", "high"]);
  assert.deepEqual(groups(4), ["top", "high", "mid", "low"]);
  assert.deepEqual(groups(8), ["top", "high", "high", "high", "mid", "mid", "low", "low"]);
});

test("expected targets follow the server's rules", () => {
  // Standings b1, a1, b2, a2 (a = team 1), as in itemmode TestUseTargets.
  const standings = ["b1", "a1", "b2", "a2"];
  const teams = { a1: 1, a2: 1, b1: 2, b2: 2 };
  assert.deepEqual(expectedTargets(ITEM.waterFly, "a2", standings, teams), ["b2"]);
  assert.deepEqual(expectedTargets(ITEM.guideRocket, "a2", standings, teams), ["b1"]);
  assert.deepEqual(expectedTargets(ITEM.guideRocket, "b1", standings, teams), ["a1"]);
  assert.deepEqual(expectedTargets(ITEM.thunderbolt, "a2", standings, teams), ["b1", "b2"]);
  assert.deepEqual(expectedTargets(ITEM.cloud2, "a1", standings, teams), ["b2"]);
  assert.deepEqual(expectedTargets(ITEM.devil, "a1", standings, teams), ["b1", "b2"]);
  assert.deepEqual(expectedTargets(ITEM.angel, "b2", standings, teams), ["b2", "b1"]);
  assert.deepEqual(expectedTargets(ITEM.shield, "b2", standings, teams), ["b2"]);
  assert.deepEqual(expectedTargets(ITEM.rocket, "a1", standings, teams, "b2"), ["b2"]);
  assert.deepEqual(expectedTargets(ITEM.rocket, "a1", standings, teams), []);
  assert.deepEqual(expectedTargets(ITEM.banana, "a1", standings, teams), []);
  assert.deepEqual(expectedTargets(ITEM.waterFly, "b1", standings, teams), []);
  const solo = { p1: 0, p2: 0, p3: 0 };
  assert.deepEqual(expectedTargets(ITEM.angel, "p2", ["p1", "p2", "p3"], solo), ["p2"]);
  assert.deepEqual(expectedTargets(ITEM.randomRocket, "p3", ["p1", "p2", "p3"], solo), ["p1", "p2"]);
});

/** A control socket double: answers each request with replies[type](request). */
function fakeControl(replies) {
  const sent = [];
  return {
    sent,
    async send(request) {
      sent.push(request);
      await new Promise(done => setTimeout(done, Math.random() * 5));
      return replies(request);
    },
    async request(request) {
      return this.send(request);
    },
  };
}

test("item channel: one sequence per accepted request, in call order", async () => {
  const control = fakeControl(request => {
    if (request.action === "swap") return { type: "error", code: "INVALID_SEQUENCE" };
    if (request.action === "change") return { type: "error", code: "ITEM_CHANGER_UNAVAILABLE" };
    return { type: "item", action: "grant", slots: [request.sequence, -1] };
  });
  const items = new ItemChannel(control, { roomId: "r", raceId: "x", validRequest: () => true, ratePerSecond: 1000 });
  const replies = await Promise.all([
    items.send("cube", { cubeId: 1, capacity: 2 }),
    items.send("swap"), // rejected before the sequence check: not used up
    items.send("cube", { cubeId: 2, capacity: 2 }),
    items.send("change"), // rejected after it: used up
    items.send("cube", { cubeId: 3, capacity: 2 }),
  ]);
  assert.deepEqual(control.sent.map(request => [request.action, request.sequence]),
    [["cube", 1], ["swap", 2], ["cube", 2], ["change", 3], ["cube", 4]]);
  assert.deepEqual(items.slots, [4, -1]);
  assert.equal(replies[1].code, "INVALID_SEQUENCE");
  await items.send("cube", { cubeId: 4, capacity: 2 }, { sequence: 9 });
  assert.equal(items.sequence, 4, "an explicit wrong sequence does not move the counter");
  await assert.rejects(new ItemChannel(control, { roomId: "r", raceId: "x", validRequest: () => false })
    .send("cube", { cubeId: 1, capacity: 2 }), /would not send/);
});

test("server clock: the offset of the fastest round trip; ticks are uint32 node milliseconds", async () => {
  let call = 0;
  const control = { async request() {
    call++;
    await new Promise(done => setTimeout(done, call === 2 ? 0 : 20));
    return { type: "clock", serverTick: performance.now() + 1_000_000 };
  } };
  const clock = await ServerClock.sync(control, 3);
  assert.ok(Math.abs(clock.now() - (performance.now() + 1_000_000)) < 15, `offset ${clock.offsetMs}`);
  assert.equal(new ServerClock(0).tick(2 ** 32 + 5.7), 5);
});

test("motion pump: one frame per beat to the other racers' slots", async () => {
  const frames = [];
  const socket = { readyState: 1, send: bytes => frames.push(bytes) };
  const encoder = { encode: (sample, sequence, mask) => ({ tick: sample.tick, sequence, mask }) };
  const room = { members: [{ playerId: "me", slot: 1 }, { playerId: "a", slot: 0 }, { playerId: "b", slot: 5 }] };
  assert.equal(othersMask(room, "me"), 0b100001);
  const pump = new MotionPump({ socket, encoder, clock: new ServerClock(0), mask: othersMask(room, "me"),
    intervalMs: 5, sample: () => ({ kind: "kinematic" }) }).start();
  await new Promise(done => setTimeout(done, 40));
  pump.stop();
  pump.check();
  assert.ok(frames.length >= 3);
  assert.deepEqual(frames.map(frame => frame.sequence), frames.map((_, index) => index + 1));
  assert.ok(frames.every(frame => frame.mask === 0b100001 && Number.isInteger(frame.tick)));
  const failing = new MotionPump({ socket, encoder: { encode() { throw new Error("bad sample"); } },
    clock: new ServerClock(0), mask: 0, sample: () => ({}) }).start();
  assert.throws(() => failing.check(), /bad sample/);
});

test("kart samples encode and decode with the browser's codec", async t => {
  if (!haveTsx) return t.skip("rewrite/node_modules missing");
  const payload = await browser("rewrite/src/multiplayer/payload.ts");
  const ids = { roomId: "00000000-0000-4000-8000-000000000001", raceId: "00000000-0000-4000-8000-000000000002",
    playerId: "00000000-0000-4000-8000-000000000003" };
  const sample = kartSample({ tick: 12_345, observedPlayerId: ids.playerId,
    pose: { position: { x: 1, y: 2, z: -3 }, velocity: { x: 0, y: 0, z: -20 }, quaternion: [1, 0, 0, 0] },
    progress: { distance: 456.5, lap: 2, finishElapsedMs: 61_000 } });
  const bytes = new payload.GameMotionEncoder(ids).encode(sample, 7, 0b10);
  assert.equal(bytes[2], 10, "kind 10: routing and visual scale");
  const decoded = new payload.GameMotionDecoder().decode(bytes);
  assert.deepEqual([decoded.sequence, decoded.recipientMask, decoded.payload.tick], [7, 2, 12_345]);
  assert.deepEqual(decoded.payload.position, wireVector({ x: 1, y: 2, z: -3 }));
  assert.deepEqual(decoded.payload.raceProgress, { distance: 456.5, lap: 2, finishElapsedMs: 61_000 });
  assert.equal(decoded.payload.presentation.forwardSpeed, 20);
  assert.equal(decoded.payload.routing.observedPlayerId, ids.playerId);
});

test("browser validators: item events the browser would drop count as rejected", async t => {
  if (!haveTsx) return t.skip("rewrite/node_modules missing");
  const [{ parseServerEvent }, { isValidRoomSnapshot }] = await Promise.all([
    browser("rewrite/src/multiplayer/server-events.ts"), browser("rewrite/src/multiplayer/room-validation.ts")]);
  const validation = browserEventValidation(isValidRoomSnapshot);
  assert.ok(validation.validChannel("itemTeamCombine", "team", 7));
  assert.ok(!validation.validChannel("itemTeamCombine", "individual", 7));
  assert.ok(validation.validGameplay("item", "itemIndiCombine", "p3553"));
  assert.ok(!validation.validGameplay("item", "speedIndiCombine", "p3553"));
  assert.ok(!validation.validGameplay("ordinary", "itemIndiCombine", "p3553"));
  assert.ok(!validation.validGameplay("item", "itemIndiCombine", "p3543"));
  const hit = { type: "item", roomId: "r", raceId: "x", action: "hit", playerId: "p", useId: 0, itemId: 17,
    result: "hit", hazardId: 3 };
  assert.ok(browserAccepts(parseServerEvent, validation, hit));
  assert.ok(!browserAccepts(parseServerEvent, validation, { ...hit, userId: null }));
  assert.ok(!browserAccepts(parseServerEvent, validation, { type: "mystery" }));
});
