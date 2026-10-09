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
 * in rewrite/ and Node.js 22+.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  assertRaceRewards, createPlayer, discoverCluster, enterGameWhenFree, expectSettlement, readSettings,
} from "./server-go/test/lib/kart-client.mjs";

const settings = readSettings();
const { tsImport } = await import("./rewrite/node_modules/tsx/dist/esm/api/index.mjs");
const { isValidRoomSnapshot } = await tsImport(
  "./rewrite/src/multiplayer/room-validation.ts", import.meta.url);
const { parseServerEvent } = await tsImport(
  "./rewrite/src/multiplayer/server-events.ts", import.meta.url);
const channelRules = {
  speedIndiCombine: { mode: "individual", speed: 7 },
  speedTeamCombine: { mode: "team", speed: 7 },
  speedIndiInfinit: { mode: "individual", speed: 4 },
  speedTeamInfinit: { mode: "team", speed: 4 },
};
const randomTrackCodes = new Set([0, 3, 4, 5, 6, 7, 8, 30, 40]);
const verifiedRpKarts = new Set([387, 390, 378, 361]);
const validation = {
  validRoom: isValidRoomSnapshot,
  validChannel: (channel, mode, speed) =>
    channel in channelRules && channelRules[channel].mode === mode &&
    channelRules[channel].speed === speed,
  validGameplay: (gameplay, channel, version) => {
    if (gameplay === undefined || gameplay === "ordinary") return true;
    if (version !== "p3553" || !(channel in channelRules)) return false;
    if (gameplay === "roadblock" || gameplay === "giant")
      return channel === "speedIndiCombine";
    if (gameplay === "rp" || gameplay === "shadow") return true;
    return (gameplay === "lte" || gameplay === "grip") &&
      channelRules[channel].speed === 7;
  },
  validRandomTrackCode: code => randomTrackCodes.has(code),
};
const validate = message => parseServerEvent(message, validation) !== undefined;

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
    playerId: welcome.playerId,
    request: fields => control.request(fields),
    waitFor: predicate => control.waitFor(predicate),
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

for (const mode of modes) {
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

console.log("PASS: all special modes accepted by the real frontend validators");
