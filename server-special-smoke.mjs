#!/usr/bin/env node
/**
 * Exercise special modes against the real frontend room/event validators.
 *
 * Players enter like the browser: there are no guests, so the script
 * registers five accounts (open registration, starter kit claimed) and every
 * player enters with game-server list → one-time Bearer ticket from the data
 * service → WebSocket hello {ticket, starter equipment} on one game node. All
 * players of a mode join the same node (rooms live in that node's memory);
 * the accounts are reused from mode to mode. Settings are the same as
 * server-smoke.mjs: KART_DATA_ORIGIN, KART_GAME_ORIGINS, KART_GAME_NODE,
 * KART_SMOKE_TIMEOUT_MS, KART_SMOKE_SETTLE_TIMEOUT_MS, KART_SMOKE_ACCOUNTS
 * (five existing onboarded accounts instead of registering) and
 * KART_SMOKE_FORWARDED_FOR=0. Registration is rate limited (5 per hour per
 * client IP): each account sends its own X-Forwarded-For, honoured by
 * kart-data from KART_TRUSTED_PROXIES (default loopback). Requires `npm ci`
 * in client/ and Node.js 22+.
 *
 * The 道具赛 scenarios (个人道具赛 and 组队道具赛, client/ITEM_MODE.md,
 * SERVER_PROTOCOL.md "本地新增：道具赛") race four accounts: create in the
 * item channel with gameplay item, item track and random-track rules, join,
 * start, loaded, binary motion frames with race progress encoded by the
 * browser's payload codec (so the node ranks the racers and draws by rank
 * group, with the track transforms of transform@zz), the race start's
 * slots push with the racer's changer cards, cube grants (abusing, full, 3
 * slots), swap and change (道具换位卡 / 道具变更卡: with the cards or vouchers
 * the cluster gives, KART_ITEM_CHANGERS=infinite under
 * server-go/test/run-cluster-smokes.mjs, else refused for card-less
 * accounts), slots, uses of the items with the targets the server must pick,
 * place, hit/blocked, escape, the removed banana, track hazards, scans, the
 * slot lock, finish (perfectStart; the item team result: the first
 * finisher's team wins), result titles, and the settlement and item careers. Every item request passes the browser's request validator and
 * every server event the browser's event validators (an item event the
 * browser would turn into INVALID_ITEM_EVENT fails the smoke). Items come
 * from the real rank-group draws, so a scenario farms cubes until a racer
 * holds the item it needs (KART_SMOKE_ITEM_BUDGET_MS, default 90000, per
 * item). With mirror/p3553 present every race track is also checked against
 * the browser's item track catalog. KART_SMOKE_ITEM_ONLY=1 runs only the
 * item scenarios.
 *
 * Run it against a temporary local cluster built from this checkout:
 *   KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 \
 *     node server-go/test/run-cluster-smokes.mjs special
 * or against a running cluster: KART_DATA_ORIGIN=http://127.0.0.1:8787 node server-special-smoke.mjs
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertRaceRewards, createPlayer, discoverCluster, enterGameWhenFree, expectSettlement, readSettings,
  waitUntilRaceCounts,
} from "./server-go/test/lib/kart-client.mjs";
import {
  browserAccepts, browserEventValidation, expectedTargets, grantable, ITEM, ITEM_NAMES, ITEM_RULES, ItemChannel,
  itemLife, kartSample, loadItemData, MotionInbox, motionRace, MotionPump, othersMask, rankGroup, ServerClock, slotOf,
} from "./server-go/test/lib/item-race.mjs";

const settings = readSettings();
const { tsImport } = await import("./client/node_modules/tsx/dist/esm/api/index.mjs");
const { isValidRoomSnapshot } = await tsImport(
  "./client/src/multiplayer/room-validation.ts", import.meta.url);
const { parseServerEvent } = await tsImport(
  "./client/src/multiplayer/server-events.ts", import.meta.url);
const { isValidItemRequest } = await tsImport("./client/src/multiplayer/protocol.ts", import.meta.url);
const { GameMotionDecoder, GameMotionEncoder, resolveGameMotion } = await tsImport(
  "./client/src/multiplayer/payload.ts", import.meta.url);
const validation = browserEventValidation(isValidRoomSnapshot);
/**
 * The browser's acceptance of a server event; an item event it would turn
 * into INVALID_ITEM_EVENT counts as a rejection.
 */
const validate = message => browserAccepts(parseServerEvent, validation, message);
const verifiedRpKarts = new Set([387, 390, 378, 361]);

/** Every racer earned the same reward (all unfinished, ECONOMY.md 2.1). */
function assertSameRewards(rewards, label) {
  const values = Object.values(rewards).map(({ exp, lucci }) => JSON.stringify({ exp, lucci }));
  assert.equal(new Set(values).size, 1, `${label}: everyone earns the unfinished reward: ${JSON.stringify(rewards)}`);
}

function assertStartSlots(race) {
  const entries = Object.entries(race.startSlots ?? {});
  assert.deepEqual(entries.map(([id]) => id).sort(),
    race.roster.map(member => member.playerId).sort(), "Incomplete startSlots");
  assert.equal(new Set(entries.map(([, slot]) => slot)).size, entries.length,
    "Duplicate start slot");
  for (const [, slot] of entries)
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot <= 7,
      `Invalid start slot ${slot}`);
}

/**
 * A connected account: request/waitFor on its control socket plus its
 * playerId. The account may have been online in the previous mode, so wait
 * until its nickname is released.
 */
async function connectPeer(cluster, node, account) {
  const { control, welcome } = await enterGameWhenFree(cluster, node, account,
    { validate, timeoutMs: Math.min(settings.settleMs, 20_000) });
  return {
    account,
    control,
    playerId: welcome.playerId,
    request: fields => control.request(fields),
    expectError: (fields, code) => control.expectError(fields, code),
    waitFor: (predicate, description) => control.waitFor(predicate, description),
    drain: () => control.drain(),
    close: () => control.close(),
  };
}

const cluster = await discoverCluster(settings);
const node = cluster.servers[0];
console.log(`Using game server ${node.nodeId} (${node.connectOrigin}) via data service ${cluster.dataOrigin}`);

const suffix = randomBytes(4).toString("hex");
const accounts = [];
for (let index = 0; index < 5; index++) {
  accounts.push(await createPlayer(cluster, `Sp${index}${suffix}`,
    { starter: { character: index % 2 === 0 ? 2 : 3, paint: [6, 4, 5, 7][index % 4], dye: [7, 5, 4, 6][index % 4] } }));
}
console.log(`Accounts ${accounts.map(account => account.nickname).join(", ")} registered with their starter kits`);
const modes = [
  { gameplay: "roadblock", count: 5, channelName: "speedIndiCombine", speed: 7 },
  { gameplay: "giant", count: 2, channelName: "speedIndiCombine", speed: 7 },
  { gameplay: "rp", count: 2, channelName: "speedIndiInfinit", speed: 4 },
  { gameplay: "lte", count: 2, channelName: "speedIndiCombine", speed: 7 },
];

for (const mode of process.env.KART_SMOKE_ITEM_ONLY === "1" ? [] : modes) {
  const peers = [];
  try {
    for (let index = 0; index < mode.count; index++) {
      peers.push(await connectPeer(cluster, node, accounts[index]));
    }
    const host = peers[0];
    const created = await host.request({ type: "create", name: `${mode.gameplay}${suffix}`,
      password: "", capacity: mode.count, channelName: mode.channelName,
      gameplay: mode.gameplay, mode: "individual", speed: mode.speed,
      speedVersion: "国服", equipment: host.account.equipment });
    assert.equal(created.room.gameplay, mode.gameplay);
    assert.equal(created.room.phase, "open");
    const roomId = created.room.roomId;
    if (mode.gameplay === "roadblock" || mode.gameplay === "lte") {
      assert.equal(created.room.randomTrackCode, 0);
      assert.equal(created.room.trackId, undefined);
    }
    const listed = await peers[1].request({ type: "list-gameplay",
      gameplay: mode.gameplay, page: 0 });
    assert.ok(listed.rooms.some(room => room.roomId === roomId));

    let room = created.room;
    for (const peer of peers.slice(1)) {
      room = (await peer.request({ type: "join", roomId, password: "", equipment: peer.account.equipment })).room;
      assert.equal(room.members.length, peers.indexOf(peer) + 1);
    }
    for (const peer of peers.slice(1)) {
      room = (await peer.request({ type: "ready", roomId,
        revision: room.revision, ready: true })).room;
    }
    room = (await host.request({ type: "start", roomId, revision: room.revision })).room;
    assert.equal(room.phase, "loading");
    const raceId = room.race.raceId;
    assertStartSlots(room.race);
    if (mode.gameplay === "roadblock") {
      assert.equal(room.race.roadblock.limitMs, 180_000);
      assert.ok(peers.some(peer => peer.playerId === room.race.roadblock.runnerId));
    } else if (mode.gameplay === "giant") {
      assert.equal(room.race.giant.ruleset, "p948-giant-p3553-web-v1");
    } else if (mode.gameplay === "rp") {
      assert.equal(Object.keys(room.race.rp.draws).length, peers.length);
      for (const draw of Object.values(room.race.rp.draws)) {
        assert.ok(verifiedRpKarts.has(draw.kartId), `Unverified RP kart ${draw.kartId}`);
        assert.equal(draw.flyingPetId, 0);
      }
    } else {
      assert.equal(room.race.lte.ruleset, "web-lte-v1");
      assert.equal(room.race.lte.featureSet, "dodge-trial");
    }
    for (const peer of peers) {
      room = (await peer.request({ type: "loaded", roomId, raceId })).room;
    }
    assert.equal(room.phase, "countdown");
    const racing = await host.waitFor(message => message.type === "room" &&
      message.room?.roomId === roomId && message.room?.phase === "racing");
    assert.equal(racing.room.race.raceId, raceId);

    if (mode.gameplay === "roadblock") {
      const runner = peers.find(peer => peer.playerId === room.race.roadblock.runnerId);
      assert.ok(runner);
      await delay(1100);
      const finished = await runner.request({ type: "finish", roomId, raceId, elapsedMs: 1000 });
      assert.equal(finished.room.phase, "finished");
      assert.equal(finished.room.race.roadblockOutcome.reason, "finish");
      assert.equal(finished.room.race.roadblockOutcome.runnerWon, true);
      // Roadblock has no ranked results, but every racer is rewarded; a race
      // that ended within 10 s of its start earns everyone the unfinished reward.
      const rewards = assertRaceRewards(finished.room.race, peers.map(peer => peer.playerId), { label: "roadblock" });
      assertSameRewards(rewards, "roadblock ended within 10 s");
    } else {
      if (mode.gameplay === "giant") {
        // Item requests belong to item races only.
        const item = { type: "item", roomId, raceId, sequence: 1, action: "cube", cubeId: 1, capacity: 2 };
        assert.ok(isValidItemRequest(item));
        await host.expectError(item, "ITEM_UNAVAILABLE");
        await host.request({ type: "giant-state", roomId, raceId,
          sequence: 1, main: 1, extra: 0, status: 0 });
        const state = await peers[1].waitFor(message => message.type === "giant-state" &&
          message.roomId === roomId && message.raceId === raceId);
        assert.equal(state.playerId, host.playerId);
        assert.equal(state.main, 1);
      }
      for (const [index, peer] of peers.entries()) {
        room = (await peer.request({ type: "finish", roomId, raceId,
          elapsedMs: 60_000 + index * 1000 })).room;
      }
      assert.equal(room.phase, "finished");
      assert.equal(room.race.results.length, peers.length);
      const rewards = assertRaceRewards(room.race, peers.map(peer => peer.playerId), { label: mode.gameplay });
      // Every finish came within 10 s of the start: ranked as reported, rewarded as unfinished.
      assertSameRewards(rewards, `${mode.gameplay} finished within 10 s`);
    }
    for (const [index, peer] of peers.entries()) {
      const returned = await peer.request({ type: "return-room", roomId, raceId });
      assert.equal(returned.room.phase,
        index === peers.length - 1 ? "open" : "finished");
    }
    // Settlement travels game node → outbox → data service → MySQL, so poll.
    const { outcome: saved } = await expectSettlement(cluster, {
      raceId, roomId, gameplay: mode.gameplay, timeoutMs: settings.settleMs,
    });
    assert.equal(saved.snapshot.race.gameplay, mode.gameplay);
    if (mode.gameplay === "roadblock")
      assert.equal(saved.snapshot.race.roadblockOutcome.runnerWon, true);
    // The final broadcasts (e.g. return-room) reach the other peers after their
    // own last request; make sure the validator accepted those too.
    for (const peer of peers) await peer.drain();
    console.log(`✓ ${mode.gameplay}: validated lobby, race and result snapshots; outcome stored`);
  } finally {
    for (const peer of peers) peer.close();
  }
}

/* ---------- 道具赛: 个人道具赛 and 组队道具赛 ---------- */

const itemData = loadItemData();
const itemBudgetMs = Number(process.env.KART_SMOKE_ITEM_BUDGET_MS ?? 90_000);
assert.ok(Number.isFinite(itemBudgetMs) && itemBudgetMs >= 1000, "Invalid KART_SMOKE_ITEM_BUDGET_MS");
const itemName = idx => `${ITEM_NAMES[idx] ?? "item"}(${idx})`;
/** Every item racer advances at this speed (m/s); its start distance decides its rank. */
const ITEM_RACE_SPEED = 30;
/** Start distances (m) of the four item racers, best first. */
const ITEM_RACE_BASES = [80, 60, 40, 20];
/** A throw, drop or landing point (three.js coordinates, protocol.ts ItemRequest). */
const ITEM_POINT = { x: 12.5, y: 3.25, z: -40 };
/** Item careers (server-go/internal/data/career/careers.json, gameType 2/4/6). */
const ITEM_CAREERS = { indiFinish: 682, indiWin: 688, teamFinish: 694, teamWin: 700, itemRetire: 718 };

/**
 * The browser's item track catalog (track IDs) when mirror/p3553 is present
 * (here, or in the checkout KART_MIRROR_ROOT names: a worktree checked out
 * without mirror/p3553).
 */
const clientItemTracks = await (async () => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const mirrorRoot = process.env.KART_MIRROR_ROOT ? `${process.env.KART_MIRROR_ROOT.replace(/\/$/, "")}/` : root;
  if (!existsSync(`${mirrorRoot}mirror/__p3553/archive-index`) || !existsSync(`${mirrorRoot}mirror/__p3553/resources`)) {
    console.log("- mirror/p3553 not found: item race tracks are checked against itemmode.json only");
    return undefined;
  }
  const { loadResourceLibrary } = await tsImport("./client/tools/economy-export/resource-library.mjs",
    import.meta.url);
  const { itemTrackCatalog } = await tsImport("./client/src/resources/track-catalog.ts", import.meta.url);
  const { library } = await loadResourceLibrary(root.replace(/\/$/, ""), "p3553", mirrorRoot.replace(/\/$/, ""));
  return new Set((await itemTrackCatalog(library)).map(choice => choice.id));
})();

/** Career values ({careerId: value}) of an account (GET /api/careers). */
async function careerValues(account) {
  const body = await account.callOk("/api/careers");
  assert.ok(Array.isArray(body.careers), `/api/careers lacks careers: ${JSON.stringify(body)}`);
  return Object.fromEntries(body.careers.map(entry => [entry.id, entry.value]));
}

/** One racer of an item scenario: its peer, item channel, motion and slot capacity. */
class ItemRacer {
  constructor(peer, { roomId, raceId, base, capacity, race }) {
    this.peer = peer;
    this.id = peer.playerId;
    this.label = peer.account.nickname;
    this.base = base;
    this.capacity = capacity;
    this.cube = 0;
    this.items = new ItemChannel(peer.control, { roomId, raceId, validRequest: isValidItemRequest,
      label: this.label });
    // Relayed frames name their sender by slot (protocol 40), resolved through the race's members.
    this.inbox = new MotionInbox(peer.control.socket, new GameMotionDecoder(), wire => resolveGameMotion(wire, race));
    // The server's own slots pushes (the race start, per-kart gains).
    peer.control.socket.addEventListener("message", event => {
      if (typeof event.data !== "string") return;
      try { this.items.pushed(JSON.parse(event.data)); } catch { /* not JSON */ }
    });
  }

  /** Whether the racer can swap (a 道具换位卡 or its voucher). */
  get canSwap() {
    return (this.items.changers?.slot ?? 0) !== 0;
  }

  /** The racer's slots as the server keeps them (two empty slots before its first cube). */
  get slots() {
    return this.items.slots ?? [-1, -1];
  }

  /** The next cube ID, never the one eaten last (a repeat within 10 s is abusing). */
  nextCube() {
    this.cube = (this.cube % 4000) + 1;
    return this.cube;
  }
}

/** The racer's slots after a draw of `itemId` into the first empty slot. */
function slotsWith(slots, itemId) {
  const next = [...slots];
  next[next.indexOf(-1)] = itemId;
  return next;
}

/**
 * Eats a cube: the grant's item must have weight in the racer's rank group
 * of the race's table and go into the first empty slot.
 */
async function drawCube(race, racer) {
  const before = racer.slots;
  const cubeId = racer.nextCube();
  const grant = await racer.items.request("cube", { cubeId, capacity: racer.capacity });
  assert.equal(grant.action, "grant");
  assert.equal(grant.cubeId, cubeId);
  assert.equal(grant.slots.length, racer.capacity, `${racer.label}: ${racer.capacity} slots`);
  const rank = race.standings.indexOf(racer.id) + 1;
  const group = rankGroup(rank, race.standings.length);
  if (grant.itemId === null) {
    assert.equal(grant.reason, "full", `${racer.label}: nothing granted: ${JSON.stringify(grant)}`);
    assert.ok(!before.includes(-1));
    return grant;
  }
  assert.equal(grant.reason, undefined);
  assert.ok(grantable(itemData, race.table, grant.itemId, group, race.trackId),
    `${racer.label} (rank ${rank} of ${race.standings.length}: ${group}) drew ${itemName(grant.itemId)}, ` +
    `which has no ${group} weight in the ${race.table} table (nor is a transform of one on ${race.trackId})`);
  assert.deepEqual(Object.keys(grant.changers ?? {}).sort(), ["item", "itemArmed", "slot"]);
  assert.equal(grant.changers.itemArmed, true, "a new item arms the item changer");
  assert.deepEqual(grant.slots, slotsWith(before.length === racer.capacity ? before :
    Array(racer.capacity).fill(-1), grant.itemId));
  race.draws[group] = (race.draws[group] ?? 0) + 1;
  return grant;
}

/** The node's tracking eta for a use (itemmode EtaMs, ITEM_MODE.md appendix B). */
function expectedEta(race, idx, user, target) {
  const rule = ITEM_RULES[idx];
  const etaItem = [ITEM.guideRocket, ITEM.randomRocket].includes(idx) ? ITEM.rocket : idx;
  const maxMs = Math.max(itemLife(itemData, etaItem, "Use"), 300);
  const gap = Math.abs(race.distance(target) - race.distance(user));
  return Math.min(Math.max(Math.round(gap / rule.speed * 1000), 300), maxMs);
}

/**
 * Uses the item in slot 0 (with the point the item needs) and checks the
 * reply against the rules: the targets the server must pick, the point,
 * etaMs, startAt and the slots shifted forward. Returns the reply, or the
 * error reply of a rejected use.
 */
async function useItem(race, racer, fields = {}) {
  const before = racer.slots;
  const idx = fields.itemId ?? before[0];
  const rule = ITEM_RULES[idx];
  assert.ok(rule, `${racer.label}: no rule for ${itemName(idx)}`);
  const used = await racer.items.send("use", { itemId: idx, ...(rule.point ? { point: ITEM_POINT } : {}),
    ...fields });
  if (used.type === "error") return used;
  assert.equal(used.action, "used");
  assert.equal(used.playerId, racer.id);
  assert.equal(used.itemId, idx);
  assert.ok(Number.isSafeInteger(used.useId) && used.useId >= 1);
  assert.deepEqual(used.slots, [...before.slice(1), -1], `${racer.label}: slots after ${itemName(idx)}`);
  const expected = expectedTargets(idx, racer.id, race.standings, race.teams, fields.targetId);
  if (rule.target === "randomAhead") {
    assert.ok(expected.length === 0 ? used.targets.length === 0
      : used.targets.length === 1 && expected.includes(used.targets[0]),
    `${racer.label}: ${itemName(idx)} targets ${JSON.stringify(used.targets)}, expected one of ${expected}`);
  } else {
    assert.deepEqual(used.targets, expected, `${racer.label} (rank ${race.standings.indexOf(racer.id) + 1}): ` +
      `${itemName(idx)} targets`);
  }
  if (rule.point) assert.deepEqual(used.point, ITEM_POINT);
  else assert.equal(used.point, undefined);
  if (rule.speed && used.targets.length === 1) {
    const eta = expectedEta(race, idx, racer.id, used.targets[0]);
    assert.ok(Math.abs(used.etaMs - eta) <= 80, `${itemName(idx)} etaMs ${used.etaMs}, expected about ${eta}`);
  } else {
    assert.equal(used.etaMs, 0, `${itemName(idx)} etaMs`);
  }
  assert.ok(Math.abs(used.startAt - race.clock.now()) < 1000, `startAt ${used.startAt} is not the node's now`);
  if (idx === ITEM.slotLock) {
    const from = used.startAt + itemLife(itemData, ITEM.slotLock, "Use");
    const until = from + itemLife(itemData, ITEM.slotLock, "Affect") + itemLife(itemData, ITEM.slotLock, "Postaffect");
    for (const id of used.targets) race.locks.push({ id, from, until });
  }
  race.used.add(idx);
  return used;
}

/** When the racer's slot locks end (0 when it was never locked). */
function lockedUntil(race, racer) {
  return Math.max(0, ...race.locks.filter(lock => lock.id === racer.id).map(lock => lock.until));
}

/** Uses up the item in slot 0, waiting out slot locks. */
async function discard(race, racer, deadline) {
  for (;;) {
    const reply = await useItem(race, racer);
    if (reply.type !== "error") return reply;
    assert.equal(reply.code, "ITEM_LOCKED", `${racer.label}: use ${itemName(racer.slots[0])} failed: ${reply.code}`);
    assert.ok(lockedUntil(race, racer) > race.clock.now() - 200, `${racer.label}: ITEM_LOCKED without a slot lock`);
    assert.ok(performance.now() < deadline, `${race.label}: ${racer.label} stayed locked`);
    await delay(200);
  }
}

/**
 * Farms cubes with `candidates` in parallel (real rank-group draws, items
 * used up as they come, each use checked) until one of them holds `idx` in
 * slot 0; returns that racer.
 */
async function obtain(race, candidates, idx) {
  const deadline = performance.now() + itemBudgetMs;
  let holder;
  let failed = false;
  const farm = async racer => {
    while (!holder && !failed) {
      assert.ok(performance.now() < deadline, `${race.label}: no ${itemName(idx)} for ` +
        `${candidates.map(entry => entry.label).join("/")} within ${itemBudgetMs} ms`);
      const slots = racer.slots;
      if (slots[0] === idx) {
        holder ??= racer;
        return;
      }
      if (slots[1] === idx && racer.canSwap) {
        const swapped = await racer.items.request("swap");
        assert.deepEqual(swapped.slots, [slots[1], slots[0], ...slots.slice(2)]);
      } else if (slots.includes(-1)) {
        await drawCube(race, racer);
      } else {
        await discard(race, racer, deadline);
      }
    }
  };
  await Promise.all(candidates.map(racer => farm(racer).catch(error => {
    failed = true;
    throw error;
  })));
  return holder;
}

/** Waits for the broadcast of an item event (`action`, `useId`) on a peer. */
const itemEventOn = (racer, action, useId, extra = () => true) => racer.peer.waitFor(message =>
  message?.type === "item" && message.action === action && message.useId === useId && extra(message),
`${action} ${useId} at ${racer.label}`);

/** A broadcast copy of a reply: no requestId, sequence, slots or changer cards. */
function assertBroadcastOf(event, reply) {
  assert.equal(event.requestId, undefined);
  assert.equal(event.sequence, undefined);
  assert.equal(event.slots, undefined);
  assert.equal(event.changers, undefined);
  const { requestId, sequence, slots, slotIcons, changers, ...shared } = reply;
  assert.deepEqual({ ...event }, shared);
}

/** The individual scenario's items: rockets, banana, barricade, water fly, a track hazard. */
async function individualItems(race) {
  const [first, second, third, fourth] = race.racers;
  // An aimed rocket: only an opponent can be aimed at; only its target reports.
  const shooter = await obtain(race, [second, third], ITEM.rocket);
  await shooter.items.expectError("use", { itemId: ITEM.rocket, targetId: shooter.id }, "INVALID_TARGET");
  const rocket = await useItem(race, shooter, { targetId: first.id });
  assertBroadcastOf(await itemEventOn(first, "used", rocket.useId), rocket);
  const bystander = race.racers.find(racer => racer !== first && racer !== shooter);
  await bystander.items.expectError("hit", { useId: rocket.useId, itemId: ITEM.rocket, result: "hit" },
    "INVALID_TARGET");
  await first.items.expectError("hit", { useId: rocket.useId, itemId: ITEM.rocket, result: "blocked", by: "emp" },
    "INVALID_BY");
  const blocked = await first.items.request("hit", { useId: rocket.useId, itemId: ITEM.rocket,
    result: "blocked", by: "shield" });
  assert.deepEqual([blocked.action, blocked.playerId, blocked.userId, blocked.result, blocked.by, blocked.removed],
    ["hit", first.id, shooter.id, "blocked", "shield", undefined]);
  assertBroadcastOf(await itemEventOn(shooter, "hit", rocket.useId), blocked);
  // A repeated report answers the first one again and is not broadcast again.
  const repeated = await first.items.request("hit", { useId: rocket.useId, itemId: ITEM.rocket, result: "hit" });
  assert.deepEqual([repeated.result, repeated.by], ["blocked", "shield"]);
  await shooter.peer.drain();
  assert.ok(!shooter.peer.control.events.some(message => message?.type === "item" && message.action === "hit" &&
    message.useId === rocket.useId), "a repeated hit report was broadcast again");
  console.log(`  ✓ rocket aimed at the leader (etaMs ${rocket.etaMs}), blocked by the shield, reported once`);

  // A banana needs its drop point; its first hit removes it.
  const dropper = await obtain(race, [first], ITEM.banana);
  await dropper.items.expectError("use", { itemId: ITEM.banana }, "INVALID_POINT");
  const banana = await useItem(race, dropper);
  assertBroadcastOf(await itemEventOn(third, "used", banana.useId), banana);
  const slipped = await third.items.request("hit", { useId: banana.useId, itemId: ITEM.banana, result: "hit" });
  assert.deepEqual([slipped.playerId, slipped.userId, slipped.result, slipped.removed],
    [third.id, dropper.id, "hit", true]);
  for (const racer of race.racers.filter(entry => entry !== third)) {
    assertBroadcastOf(await itemEventOn(racer, "hit", banana.useId), slipped);
  }
  await fourth.items.expectError("hit", { useId: banana.useId, itemId: ITEM.banana, result: "hit" }, "INVALID_USE");
  const again = await third.items.request("hit", { useId: banana.useId, itemId: ITEM.banana, result: "hit" });
  assert.equal(again.removed, true);
  console.log("  ✓ banana dropped at its point, removed by the first hit, later hits refused");

  // A barricade goes to the leader, which reports where it lands.
  const builder = await obtain(race, [third, fourth], ITEM.barricade);
  const barricade = await useItem(race, builder);
  const notLeader = race.racers.find(racer => racer !== first && racer !== builder);
  await notLeader.items.expectError("place", { useId: barricade.useId, point: ITEM_POINT }, "INVALID_USE");
  const landing = { x: -3.5, y: 1, z: -250.25 };
  const placed = await first.items.request("place", { useId: barricade.useId, point: landing });
  assert.deepEqual([placed.action, placed.useId, placed.itemId, placed.playerId, placed.point],
    ["placed", barricade.useId, ITEM.barricade, builder.id, landing]);
  assertBroadcastOf(await itemEventOn(builder, "placed", barricade.useId), placed);
  await first.items.expectError("place", { useId: barricade.useId, point: landing }, "INVALID_USE");
  const crash = await notLeader.items.request("hit", { useId: barricade.useId, itemId: ITEM.barricade,
    result: "hit" });
  assert.equal(crash.userId, builder.id);
  console.log("  ✓ barricade placed by the leader it targets and hit by an opponent");

  // A water fly goes to the racer directly ahead.
  const flyer = await obtain(race, [second, third], ITEM.waterFly);
  const fly = await useItem(race, flyer);
  assert.equal(fly.targets.length, 1);
  console.log(`  ✓ water fly to the racer ahead (etaMs ${fly.etaMs})`);

  // A track hazard: useId 0 with its hazardId, no user, one report per 3 s.
  const mine = await third.items.request("hit", { useId: 0, itemId: ITEM.mine, hazardId: 7, result: "hit" });
  assert.deepEqual([mine.playerId, mine.useId, mine.itemId, mine.hazardId, mine.result, mine.userId],
    [third.id, 0, ITEM.mine, 7, "hit", undefined]);
  assertBroadcastOf(await itemEventOn(first, "hit", 0, message => message.hazardId === 7), mine);
  const mineAgain = await third.items.request("hit", { useId: 0, itemId: ITEM.mine, hazardId: 7,
    result: "blocked", by: "shield" });
  assert.deepEqual([mineAgain.result, mineAgain.by], ["hit", undefined]);
  await third.items.expectError("hit", { useId: 0, itemId: ITEM.rocket, hazardId: 8, result: "hit" }, "INVALID_USE");
  console.log("  ✓ track hazard hit reported without a user and kept for 3 s");
}

/** The team scenario's items: scan, slot lock, time bomb, water bomb, random rocket. */
async function teamItems(race) {
  const [first, second, third, fourth] = race.racers;
  const mateOf = racer => race.racers.find(entry => entry !== racer && race.teams[entry.id] === race.teams[racer.id]);
  const opponentsOf = racer => race.racers.filter(entry => race.teams[entry.id] !== race.teams[racer.id]);

  // 透视镜: the scanning team sees every racing opponent's slots, then each change.
  const scanner = await obtain(race, [first, second], ITEM.scanning);
  const scan = await useItem(race, scanner);
  // It takes effect after Use and lasts Affect (ITEM_MODE.md C.5).
  const until = scan.startAt + itemLife(itemData, ITEM.scanning, "Use") + itemLife(itemData, ITEM.scanning, "Affect");
  const viewers = [scanner, mateOf(scanner)];
  const watched = opponentsOf(scanner);
  for (const viewer of viewers) {
    for (const opponent of watched) {
      const notice = await viewer.peer.waitFor(message => message?.type === "item" && message.action === "scan" &&
        message.playerId === opponent.id && message.until === until, `scan of ${opponent.label}`);
      assert.deepEqual(notice.slots, opponent.slots);
    }
  }
  const changer = watched[0];
  if (changer.slots.includes(-1)) await drawCube(race, changer);
  else await discard(race, changer, performance.now() + itemBudgetMs);
  for (const viewer of viewers) {
    const notice = await viewer.peer.waitFor(message => message?.type === "item" && message.action === "scan" &&
      message.playerId === changer.id && message.until === until &&
      JSON.stringify(message.slots) === JSON.stringify(changer.slots), `scan update of ${changer.label}`);
    assert.deepEqual(notice.slots, changer.slots);
  }
  console.log(`  ✓ scanning: ${viewers.length} viewers saw ${watched.length} opponents' slots and a change`);

  // 道具锁: every opponent is locked from Use.life after the use for Affect + Postaffect.
  const locker = await obtain(race, [second, third, fourth], ITEM.slotLock);
  const lock = await useItem(race, locker);
  const victims = opponentsOf(locker);
  assert.deepEqual([...lock.targets].sort(), victims.map(victim => victim.id).sort());
  for (const victim of victims) if (victim.slots[0] === -1) await drawCube(race, victim);
  const from = lock.startAt + itemLife(itemData, ITEM.slotLock, "Use");
  await race.clock.until(from + 150);
  for (const victim of victims) {
    const idx = victim.slots[0];
    const reply = await useItem(race, victim);
    if (idx === ITEM.angel && reply.type !== "error") continue; // the angel is always usable
    assert.equal(reply.type, "error", `${victim.label} used ${itemName(idx)} under a slot lock`);
    assert.equal(reply.code, "ITEM_LOCKED");
    // Cubes still work under the lock.
    if (victim.slots.includes(-1)) await drawCube(race, victim);
  }
  for (const victim of victims) {
    await race.clock.until(lockedUntil(race, victim) + 150);
    if (victim.slots[0] === -1) await drawCube(race, victim);
    const reply = await useItem(race, victim);
    assert.equal(reply.type, "item", `${victim.label}: still locked after the slot lock: ${reply.code}`);
  }
  console.log("  ✓ slot lock refused the opponents' items (ITEM_LOCKED) for its window only");

  // 定时水炸弹: the user reports where it explodes; it traps teammates too.
  const bomber = await obtain(race, [second, third], ITEM.timeBomb);
  const bomb = await useItem(race, bomber);
  const blast = { x: 4, y: 0.5, z: -120 };
  const placed = await bomber.items.request("place", { useId: bomb.useId, point: blast });
  assert.deepEqual([placed.playerId, placed.itemId, placed.point], [bomber.id, ITEM.timeBomb, blast]);
  assertBroadcastOf(await itemEventOn(mateOf(bomber), "placed", bomb.useId), placed);
  const trapped = await mateOf(bomber).items.request("hit", { useId: bomb.useId, itemId: ITEM.timeBomb,
    result: "hit" });
  assert.equal(trapped.userId, bomber.id);
  // The trapped teammate leaves the bubble early: the others end it then.
  const escaped = await mateOf(bomber).items.request("escape", { useId: bomb.useId });
  assert.deepEqual([escaped.action, escaped.playerId, escaped.useId, escaped.itemId],
    ["escaped", mateOf(bomber).id, bomb.useId, ITEM.timeBomb]);
  assertBroadcastOf(await itemEventOn(bomber, "escaped", bomb.useId), escaped);
  const opponent = opponentsOf(bomber)[0];
  await opponent.items.expectError("hit", { useId: bomb.useId, itemId: ITEM.timeBomb, result: "blocked",
    by: "shield" }, "INVALID_BY");
  await opponent.items.request("hit", { useId: bomb.useId, itemId: ITEM.timeBomb, result: "blocked", by: "angel" });
  await opponent.items.expectError("escape", { useId: bomb.useId }, "INVALID_USE");
  console.log("  ✓ time bomb placed by its user, trapping a teammate who escapes; only the angel blocks it");

  // 水炸弹: opponents only (avoidItemTeamKill), only the angel blocks it.
  const thrower = await obtain(race, [second, third], ITEM.waterBomb);
  const waterBomb = await useItem(race, thrower);
  await mateOf(thrower).items.expectError("hit", { useId: waterBomb.useId, itemId: ITEM.waterBomb,
    result: "hit" }, "INVALID_TARGET");
  const wet = opponentsOf(thrower)[0];
  await wet.items.expectError("hit", { useId: waterBomb.useId, itemId: ITEM.waterBomb, result: "blocked",
    by: "shield" }, "INVALID_BY");
  await wet.items.request("hit", { useId: waterBomb.useId, itemId: ITEM.waterBomb, result: "blocked", by: "angel" });
  console.log("  ✓ water bomb hits opponents only; the shield does not block it");

  // 随机导弹: one of the opponents ahead.
  const launcher = await obtain(race, [second, third], ITEM.randomRocket);
  const random = await useItem(race, launcher);
  console.log(`  ✓ random rocket to ${race.racers.find(racer => racer.id === random.targets[0])?.label ?? "nobody"}`);

  await first.peer.expectError({ type: "team-charge", roomId: race.roomId, raceId: race.raceId, sequence: 1,
    charge: 4000 }, "TEAM_GAUGE_UNAVAILABLE");
}

/** 个人道具赛 (team false) or 组队道具赛 (team true) with four racers. */
async function itemRace(team) {
  const label = team ? "组队道具赛" : "个人道具赛";
  const channelName = team ? "itemTeamCombine" : "itemIndiCombine";
  const table = team ? "team" : "indi";
  const peers = [];
  const racers = [];
  try {
    for (let index = 0; index < 4; index++) peers.push(await connectPeer(cluster, node, accounts[index]));
    const careersBefore = new Map();
    for (const peer of peers) careersBefore.set(peer.playerId, await careerValues(peer.account));
    const [host] = peers;
    const created = await host.request({ type: "create", name: `${team ? "ItemT" : "ItemI"}${suffix}`,
      password: "", capacity: 4, channelName, gameplay: "item", mode: team ? "team" : "individual", speed: 7,
      speedVersion: "国服", equipment: host.account.equipment });
    let room = created.room;
    const roomId = room.roomId;
    assert.deepEqual([room.gameplay, room.channelName, room.trackId, room.randomTrackCode],
      ["item", channelName, itemData.defaultTrack, undefined]);
    const listed = await peers[1].request({ type: "list-gameplay", gameplay: "item", page: 0 });
    assert.ok(listed.rooms.some(entry => entry.roomId === roomId && entry.channelName === channelName));
    const ordinary = await peers[1].request({ type: "list-ordinary", page: 0 });
    assert.ok(!ordinary.rooms.some(entry => entry.roomId === roomId), "item rooms are not ordinary rooms");
    // Item rooms take only the exported item tracks (exactly the browser's
    // item catalog): speed tracks, blocked tracks and reverse tracks without
    // a cn track_rvs row are refused; 40 (竞速随机) has no item pool.
    for (const trackId of ["village_R01", "tomb_I05", "desert_I03_rvs"]) {
      await host.expectError({ type: "track", roomId, trackId }, "TRACK_NOT_ITEM");
    }
    await host.expectError({ type: "random-track", roomId, randomTrackCode: 40 }, "INVALID_TRACK");
    if (team) {
      room = (await host.request({ type: "random-track", roomId, randomTrackCode: 30 })).room;
      assert.deepEqual([room.trackId, room.randomTrackCode], [undefined, 30]);
    }
    // A level-2 track, where transform@zz keeps the time bomb (levels 0/1 make
    // it a water bomb); on the reverse one a devil is Dr. R.
    const raceTrack = team ? "forest_I05_rvs" : "village_C01";
    room = (await host.request({ type: "track", roomId, trackId: raceTrack })).room;
    assert.deepEqual([room.trackId, room.randomTrackCode], [raceTrack, undefined]);
    for (const peer of peers.slice(1)) {
      room = (await peer.request({ type: "join", roomId, password: "", equipment: peer.account.equipment })).room;
    }
    for (const peer of peers.slice(1)) {
      room = (await peer.request({ type: "ready", roomId, revision: room.revision, ready: true })).room;
    }
    // Ranks alternate the teams (1st and 3rd of the host's team), so every
    // targeting rule crosses both teams.
    const teams = Object.fromEntries(room.members.map(member => [member.playerId, team ? member.team : 0]));
    const ordered = team ? (() => {
      const own = peers.filter(peer => teams[peer.playerId] === teams[host.playerId]);
      const other = peers.filter(peer => teams[peer.playerId] !== teams[host.playerId]);
      assert.deepEqual([own.length, other.length], [2, 2], `teams ${JSON.stringify(teams)}`);
      return [own[0], other[0], own[1], other[1]];
    })() : peers;

    room = (await host.request({ type: "start", roomId, revision: room.revision })).room;
    assert.equal(room.phase, "loading");
    const raceId = room.race.raceId;
    assertStartSlots(room.race);
    assert.deepEqual(room.race.item, { ruleset: "web-item-v1", table });
    assert.equal(room.race.trackId, raceTrack);
    if (team) assert.ok(itemData.randomPools.find(entry => entry.code === 30).tracks.includes(raceTrack));
    if (clientItemTracks) {
      assert.ok(clientItemTracks.has(room.race.trackId),
        `${room.race.trackId} is not in the browser's item track catalog (本局赛道不在当前资源目录中。)`);
    }
    racers.push(...ordered.map((peer, index) => new ItemRacer(peer, { roomId, raceId,
      base: ITEM_RACE_BASES[index], capacity: index === 0 ? 3 : 2, race: motionRace(room) })));
    const [first, second, third, fourth] = racers;
    // Not loaded yet: refused before the sequence check.
    await second.items.expectError("cube", { cubeId: 1, capacity: 2 }, "RACE_NOT_RUNNING", { consumed: false });
    for (const peer of peers) room = (await peer.request({ type: "loaded", roomId, raceId })).room;
    assert.equal(room.phase, "countdown");
    const startAt = room.race.startAt;
    // After the countdown snapshot each racer is told its slots and changer
    // cards (the practice kart is no 迅 item kart: no start item).
    for (const racer of racers) {
      const pushed = await racer.peer.waitFor(message => message?.type === "item" && message.raceId === raceId &&
        message.action === "slots" && message.sequence === undefined, `${racer.label}: start slots`);
      assert.deepEqual([pushed.slots, pushed.reason, pushed.itemId], [[-1, -1], undefined, undefined]);
      assert.equal(pushed.changers.itemArmed, false);
      racer.items.pushed(pushed);
    }
    const changers = first.items.changers;
    const vouchers = changers.slot === -1 && changers.item === -1;
    assert.ok(vouchers || (changers.slot >= 0 && changers.item >= 0), `changers ${JSON.stringify(changers)}`);
    // Before startAt the sequence is used up and the request refused.
    await first.items.expectError("cube", { cubeId: 1, capacity: 3 }, "RACE_NOT_RUNNING");
    await first.items.expectError("cube", { cubeId: 1, capacity: 3 }, "INVALID_SEQUENCE", { sequence: 1 });

    const clock = await ServerClock.sync(host.control);
    const race = {
      label, table, roomId, raceId, startAt, clock, teams, racers, trackId: raceTrack,
      standings: racers.map(racer => racer.id), draws: {}, used: new Set(), locks: [],
      /** A racer's route distance at node time `at` (every racer moves at ITEM_RACE_SPEED). */
      distance(id, at = clock.now()) {
        const racer = racers.find(entry => entry.id === id);
        return racer.base + ITEM_RACE_SPEED * Math.max(0, at - startAt) / 1000;
      },
    };
    for (const [index, racer] of racers.entries()) {
      racer.pump = new MotionPump({
        socket: racer.peer.control.socket, clock, mask: othersMask(room, racer.id),
        encoder: new GameMotionEncoder({ raceId, slot: slotOf(room, racer.id) }),
        sample: at => kartSample({ tick: 0, observedSlot: slotOf(room, racer.id),
          pose: { position: { x: index * 2, y: 0, z: -race.distance(racer.id, at) },
            velocity: { x: 0, y: 0, z: -ITEM_RACE_SPEED } },
          progress: { distance: race.distance(racer.id, at), lap: 1 } }),
      }).start();
    }
    await host.waitFor(message => message?.type === "room" && message.room?.roomId === roomId &&
      message.room?.phase === "racing", "racing");
    await clock.until(startAt + 400);
    // The node relays the frames with their race progress.
    const relayed = fourth.inbox.latest.get(first.id);
    assert.ok(relayed?.payload.raceProgress, `${fourth.label} received no motion of ${first.label}`);
    assert.ok(Math.abs(relayed.payload.raceProgress.distance - race.distance(first.id)) < 10);
    assert.equal(fourth.inbox.invalid, 0, "the browser decoder rejected relayed motion frames");
    assert.equal(fourth.inbox.unresolved, 0, "relayed motion frames named no racer of this race");
    console.log(`✓ ${label}: room, item tracks and random tracks, loading and motion frames on ${room.race.trackId}`);

    // Grants: the first cube fixes the slot count (3 here), the same cube
    // again is abusing, full slots get nothing; swap, change, wrong item.
    const opening = await drawCube(race, first);
    assert.equal(opening.slots.length, 3);
    const abusing = await first.items.request("cube", { cubeId: first.cube, capacity: 3 });
    assert.deepEqual([abusing.itemId, abusing.reason, abusing.slots], [null, "abusing", opening.slots]);
    await drawCube(race, second);
    await drawCube(race, second);
    const held = second.slots;
    const full = await second.items.request("cube", { cubeId: second.nextCube(), capacity: 2 });
    assert.deepEqual([full.itemId, full.reason, full.slots], [null, "full", held]);
    let current = held;
    if (vouchers) {
      // 道具换位卡使用券: swaps for free; 道具变更卡使用券: redraws slot 0 once per new item.
      const swapped = await second.items.request("swap");
      assert.deepEqual([swapped.slots, swapped.changers], [[held[1], held[0]], { slot: -1, item: -1, itemArmed: true }]);
      await fourth.items.expectError("swap", {}, "INVALID_USE");
      await fourth.items.expectError("change", {}, "INVALID_USE");
      const changed = await second.items.request("change");
      assert.deepEqual([changed.action, changed.slots[1], changed.changers], ["slots", held[0],
        { slot: -1, item: -1, itemArmed: false }]);
      await second.items.expectError("change", {}, "ITEM_CHANGER_USED");
      current = changed.slots;
    } else {
      // Accounts without cards or vouchers have no changer.
      await second.items.expectError("swap", {}, "ITEM_CHANGER_UNAVAILABLE");
      await second.items.expectError("change", {}, "ITEM_CHANGER_UNAVAILABLE");
    }
    const notHeld = current[0] === ITEM.booster ? ITEM.rocket : ITEM.booster;
    await second.items.expectError("use", { itemId: notHeld }, "ITEM_NOT_HELD");
    // The browser asks for its slots again after a rejection that may have left it apart.
    const resync = await second.items.request("slots");
    assert.deepEqual([resync.action, resync.slots], ["slots", current]);
    await third.items.expectError("swap", {}, "INVALID_SEQUENCE", { sequence: third.items.sequence + 5 });
    console.log(`  ✓ start push, grants by rank group, abusing, full slots, 3 slots, ` +
      `${vouchers ? "swap and change with vouchers" : "no changer without cards"}, slots and wrong items refused`);

    if (team) await teamItems(race);
    else await individualItems(race);
    for (const racer of racers) racer.pump.check();

    // Finish after the race counts for the rewards. In the team race the
    // host's teammate retires (leaves the room): the host's team then has
    // fewer points (10 against 8 + 6) but still wins, because its racer
    // finished first.
    await waitUntilRaceCounts(host.control, { startAt });
    const retired = team ? third : undefined;
    if (retired) {
      retired.pump.stop();
      await retired.peer.request({ type: "leave", roomId });
      race.standings = race.standings.filter(id => id !== retired.id);
    }
    const finishers = racers.filter(racer => racer !== retired);
    const elapsedBase = Math.trunc(clock.now() - startAt);
    for (const [index, racer] of finishers.entries()) {
      // The first finisher says its start boost succeeded (完美起步).
      room = (await racer.peer.request({ type: "finish", roomId, raceId, elapsedMs: elapsedBase + index * 1000,
        ...(index === 0 ? { perfectStart: true } : {}) })).room;
      racer.pump.stop();
      if (index === 0) {
        // A finished racer draws and uses nothing any more.
        await racer.items.expectError("cube", { cubeId: racer.nextCube(), capacity: racer.capacity }, "INVALID_USE");
      }
    }
    assert.equal(room.phase, "finished");
    const results = room.race.results;
    assert.deepEqual(results.map(row => row.playerId), [...finishers, ...(retired ? [retired] : [])]
      .map(racer => racer.id));
    // Result titles (ITEM_MODE.md C.9): every row has them; the first
    // finisher's perfect start is one.
    for (const row of results) assert.ok(Array.isArray(row.titles), `${row.playerId}: titles ${row.titles}`);
    assert.ok(results[0].titles.includes("perfectStart"), `first finisher's titles ${results[0].titles}`);
    if (team) {
      const winner = teams[first.id];
      const loser = winner === 1 ? 2 : 1;
      assert.equal(room.race.winningTeam, winner, "the first finisher's team wins an item team race");
      assert.deepEqual([room.race.teamScores[winner], room.race.teamScores[loser]], [10, 14]);
    }
    const rewards = assertRaceRewards(room.race, finishers.map(racer => racer.id), { label });
    assert.ok(Object.values(rewards).some(reward => reward.exp > 0), `${label}: finished racers earn exp`);
    for (const racer of finishers) {
      const returned = await racer.peer.request({ type: "return-room", roomId, raceId });
      assert.equal(returned.room.phase, racer === finishers.at(-1) ? "open" : "finished");
    }
    const { outcome } = await expectSettlement(cluster, { raceId, roomId, gameplay: "item",
      racers: results.map(row => ({ name: racers.find(racer => racer.id === row.playerId).label,
        playerId: row.playerId, rank: row.rank })), timeoutMs: settings.settleMs });
    assert.deepEqual(outcome.snapshot.race.item, { ruleset: "web-item-v1", table });
    assert.deepEqual(outcome.snapshot.race.results.map(row => row.titles), results.map(row => row.titles));
    if (team) assert.equal(outcome.snapshot.race.winningTeam, teams[first.id]);

    // Item careers: finishes and wins of gameType 2 (个人) / 4 (组队), item retires (gameType 6).
    const [finishCareer, winCareer] = team ? [ITEM_CAREERS.teamFinish, ITEM_CAREERS.teamWin]
      : [ITEM_CAREERS.indiFinish, ITEM_CAREERS.indiWin];
    for (const racer of racers) {
      const won = team ? teams[racer.id] === teams[first.id] : racer === first;
      const expected = {
        [finishCareer]: racer === retired ? 0 : 1, [winCareer]: won ? 1 : 0,
        [ITEM_CAREERS.itemRetire]: racer === retired ? 1 : 0,
      };
      const before = careersBefore.get(racer.id);
      const after = await careerValues(racer.peer.account);
      assert.deepEqual(Object.fromEntries(Object.keys(expected).map(id => [id, after[id] - before[id]])), expected,
        `${label}: item careers of ${racer.label}`);
    }
    for (const peer of peers) await peer.drain();
    const draws = Object.entries(race.draws).map(([group, count]) => `${group} ${count}`).join(", ");
    console.log(`✓ ${label}: ${draws} draws, ${race.used.size} item kinds used ` +
      `(${[...race.used].map(itemName).join(" ")}), finish, ${team ? "first finisher's team won, " : ""}` +
      "settlement and item careers");
  } finally {
    for (const racer of racers) racer.pump?.stop();
    for (const peer of peers) peer.close();
  }
}

for (const team of [false, true]) await itemRace(team);

console.log("PASS: all special modes accepted by the real frontend validators");
