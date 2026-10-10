#!/usr/bin/env node
// End-to-end check of the item race test bot (item-bot.mjs) on a temporary
// local cluster (lib/local-cluster.mjs) whose game node has the development
// switch KART_ITEM_TEST_GRANTS=true. A scripted "human" (one account, every
// event checked with the browser's validators) creates a 个人道具赛 room on
// abyss_I03 (3 laps of about 1.3 km); the bot (a second account, read from a
// temporary accounts file) joins, gets ready and loads; then:
//   - the bot's motion frames decode with the browser's codec as kind 10
//     samples (routing, collision, visual scale) whose route distance grows
//     at its --speed along the course line, starting from its slot;
//   - it uses a rocket at the human (--use rocket@3s) and drops a banana
//     behind it (banana@5s) at the planned race times;
//   - it reports the human's rocket and devil as hits when they arrive and
//     the rocket stops it for the launch;
//   - it finishes after its laps, and leaves after the race (--once).
//
//   KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 \
//     node test/item-bot-check.mjs            (from server-go/)
//
// Needs mirror/p3553 and `npm ci` in rewrite/ (skipped otherwise); the other
// settings are those of lib/local-cluster.mjs.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPlayer, enterGameWhenFree } from "./lib/kart-client.mjs";
import {
  browserAccepts, browserEventValidation, ITEM, ItemChannel, kartSample, MotionInbox, motionRace, MotionPump,
  othersMask, repoRoot, ServerClock, slotOf,
} from "./lib/item-race.mjs";
import { runLocalCluster } from "./lib/local-cluster.mjs";

const TRACK = "abyss_I03";
const BOT_SPEED = 120; // m/s, under the node's 140 m/s progress cap: a ~32 s race

if (!existsSync(join(repoRoot, "mirror/__p3553/archive-index")) ||
    !existsSync(join(repoRoot, "rewrite/node_modules/tsx"))) {
  console.log("SKIP item-bot-check: needs mirror/p3553 and `npm ci` in rewrite/");
  process.exit(0);
}
const { tsImport } = await import(join(repoRoot, "rewrite/node_modules/tsx/dist/esm/api/index.mjs"));
const load = specifier => tsImport(join(repoRoot, specifier), import.meta.url);
const [{ parseServerEvent }, { isValidRoomSnapshot }, { isValidItemRequest }, payload] = await Promise.all([
  load("rewrite/src/multiplayer/server-events.ts"), load("rewrite/src/multiplayer/room-validation.ts"),
  load("rewrite/src/multiplayer/protocol.ts"), load("rewrite/src/multiplayer/payload.ts"),
]);
const validation = browserEventValidation(isValidRoomSnapshot);
const validate = message => browserAccepts(parseServerEvent, validation, message);

let bot;
let pump;
let botOutput = "";
let accountsDir;
process.on("exit", () => bot?.kill("SIGTERM"));

await runLocalCluster("item-bot-check", {
  dataEnv: { KART_REGISTRATION: "open", KART_ALLOW_GUESTS: "false" },
  // The scripted human finishes without driving, which the anti-cheat
  // would kick (ANTICHEAT.md): it only records here (the bot drives).
  gameEnv: { KART_ALLOW_GUESTS: "false", KART_ITEM_TEST_GRANTS: "true", KART_ANTICHEAT: "log" },
  nodes: [{ nodeId: "game-1", name: "游戏服 1" }],
}, async ctx => {
  const cluster = ctx.cluster;
  const node = cluster.servers[0];
  const human = await createPlayer(cluster, `Hu${ctx.id}`.slice(0, 16));
  // The bot's account: registered here (the bot claims its starter kit), its
  // password only in a 0600 file.
  const botName = `Bo${ctx.id}`.slice(0, 16);
  const botAccount = await createPlayer(cluster, botName, { claim: false });
  const password = botAccount.password;
  accountsDir = await mkdtemp(join(tmpdir(), "item-bot-check-"));
  const accountsFile = join(accountsDir, "accounts.json");
  await writeFile(accountsFile, JSON.stringify([{ username: botAccount.username, password, nickname: botName }]),
    { mode: 0o600 });

  const { control, welcome } = await enterGameWhenFree(cluster, node, human, { validate, timeoutMs: 15_000 });
  ctx.track(control);
  let room = (await control.request({ type: "create", name: `Bot${ctx.id}`, password: "", capacity: 2,
    channelName: "itemIndiCombine", gameplay: "item", mode: "individual", speed: 7, speedVersion: "国服",
    equipment: human.equipment })).room;
  room = (await control.request({ type: "track", roomId: room.roomId, trackId: TRACK })).room;
  const roomId = room.roomId;
  // Relayed frames name their sender by slot, resolved through the latest room snapshot.
  const inbox = new MotionInbox(control.socket, new payload.GameMotionDecoder(),
    wire => room.race && payload.resolveGameMotion(wire, motionRace(room)));

  bot = spawn(process.execPath, [join(repoRoot, "server-go/test/item-bot.mjs"), "--accounts", accountsFile,
    "--data", cluster.dataOrigin, "--use", "rocket@3s,banana@5s", "--speed", String(BOT_SPEED), "--once"],
  { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
  const exited = new Promise(done => bot.once("exit", code => done(code)));
  for (const stream of [bot.stdout, bot.stderr]) {
    stream.on("data", chunk => {
      botOutput += chunk;
      if (process.env.KART_SMOKE_VERBOSE === "1") process.stdout.write(`[bot] ${chunk}`);
    });
  }

  const ready = await control.waitFor(message => message?.type === "room" && message.room?.roomId === roomId &&
    message.room.members.some(member => member.playerId !== welcome.playerId && member.ready), "the bot ready");
  const botId = ready.room.members.find(member => member.playerId !== welcome.playerId).playerId;
  console.log(`✓ the bot logged in, found the only item room, joined and got ready`);

  room = (await control.request({ type: "start", roomId, revision: ready.room.revision })).room;
  const raceId = room.race.raceId;
  room = (await control.request({ type: "loaded", roomId, raceId })).room;
  if (room.phase === "loading") {
    room = (await control.waitFor(message => message?.type === "room" && message.room?.roomId === roomId &&
      message.room.phase === "countdown", "the bot loaded")).room;
  }
  const startAt = room.race.startAt;
  const clock = await ServerClock.sync(control);
  console.log("✓ the bot answered loaded");

  // The human stays near the start.
  pump = new MotionPump({ socket: control.socket, clock, mask: othersMask(room, welcome.playerId),
    encoder: new payload.GameMotionEncoder({ raceId, slot: slotOf(room, welcome.playerId) }),
    sample: () => kartSample({ tick: 0, observedSlot: slotOf(room, welcome.playerId),
      pose: { position: { x: 0, y: 0, z: 0 } }, progress: { distance: 5, lap: 1 } }) }).start();
  const items = new ItemChannel(control, { roomId, raceId, validRequest: isValidItemRequest, label: "human" });
  const progressAt = () => {
    const latest = inbox.latest.get(botId);
    return latest?.payload.raceProgress?.distance;
  };

  // The bot's own items, at their race times.
  const rocket = await control.waitFor(message => message?.type === "item" && message.action === "used" &&
    message.playerId === botId && message.itemId === ITEM.rocket, "the bot's rocket");
  assert.deepEqual(rocket.targets, [welcome.playerId]);
  assert.ok(Math.abs(rocket.startAt - (startAt + 3000)) < 600, `rocket at +${rocket.startAt - startAt} ms`);
  await items.request("hit", { useId: rocket.useId, itemId: ITEM.rocket, result: "blocked", by: "shield" });
  const banana = await control.waitFor(message => message?.type === "item" && message.action === "used" &&
    message.playerId === botId && message.itemId === ITEM.banana, "the bot's banana");
  assert.ok(banana.point && Math.abs(banana.startAt - (startAt + 5000)) < 600);
  console.log(`✓ the bot used its rocket at the human (+${rocket.startAt - startAt} ms) and dropped a banana ` +
    `(+${banana.startAt - startAt} ms)`);

  // The motion: kind 10 samples on the course line, distance at the bot's speed.
  const frame = inbox.latest.get(botId);
  assert.ok(frame, "no motion from the bot");
  const sample = frame.payload;
  assert.equal(sample.routing?.observedSlot, slotOf(room, botId));
  assert.equal(sample.collision?.active, true);
  assert.ok(sample.visualScale && sample.presentation?.animation);
  assert.ok(Math.abs(Math.hypot(...sample.quaternion) - 1) < 1e-3, "the quaternion is not a unit");
  const elapsed = (clock.now() - startAt) / 1000;
  assert.ok(Math.abs(sample.raceProgress.distance - BOT_SPEED * elapsed) < BOT_SPEED * 0.6,
    `distance ${sample.raceProgress.distance} after ${elapsed.toFixed(1)} s`);
  assert.equal(inbox.invalid, 0);
  console.log(`✓ the bot's motion decodes with the browser's codec: ${Math.round(sample.raceProgress.distance)} m, ` +
    `lap ${sample.raceProgress.lap} after ${elapsed.toFixed(1)} s`);

  // The human's rocket: the bot reports the hit when it arrives and stops for the launch.
  await items.request("cube", { cubeId: 1, capacity: 2, testItemId: ITEM.rocket });
  const shot = await items.request("use", { itemId: ITEM.rocket, targetId: botId });
  const hit = await control.waitFor(message => message?.type === "item" && message.action === "hit" &&
    message.useId === shot.useId, "the bot's hit report");
  assert.deepEqual([hit.playerId, hit.userId, hit.result], [botId, welcome.playerId, "hit"]);
  const hitAt = clock.now();
  assert.ok(hitAt - shot.startAt >= shot.etaMs - 100, `reported ${hitAt - shot.startAt} ms after the use`);
  const before = progressAt();
  await delay(1000);
  const during = progressAt() - before;
  assert.ok(during < BOT_SPEED * 0.3, `the bot drove ${during} m while launched`);
  await items.request("cube", { cubeId: 2, capacity: 2, testItemId: ITEM.devil });
  const devil = await items.request("use", { itemId: ITEM.devil });
  const reversed = await control.waitFor(message => message?.type === "item" && message.action === "hit" &&
    message.useId === devil.useId, "the bot's devil report");
  assert.equal(reversed.playerId, botId);
  console.log(`✓ the bot reported the human's rocket (eta ${shot.etaMs} ms, stopped for the launch) and devil`);

  // The bot finishes after its laps; the human then finishes too.
  // No room update comes before the bot's finish (about 35 s): wait in
  // several of the socket's (8 s) waits.
  const finished = await (async () => {
    const deadline = performance.now() + 90_000;
    for (;;) {
      try {
        const message = await control.waitFor(event => event?.type === "room" && event.room?.roomId === roomId &&
          event.room.race?.finishes?.some(entry => entry.playerId === botId), "the bot's finish");
        return message.room.race.finishes.find(entry => entry.playerId === botId);
      } catch (error) {
        if (!/timed out/.test(error.message) || performance.now() > deadline) throw error;
      }
    }
  })();
  console.log(`✓ the bot finished in ${(finished.elapsedMs / 1000).toFixed(1)} s`);
  pump.stop();
  await delay(1000);
  room = (await control.request({ type: "finish", roomId, raceId,
    elapsedMs: Math.trunc(clock.now() - startAt) })).room;
  assert.equal(room.phase, "finished");
  assert.equal(room.race.results[0].playerId, botId);
  assert.equal(await Promise.race([exited, delay(20_000).then(() => "running")]), 0, "the bot did not leave");
  await control.drain();
  assert.ok(!botOutput.includes(password), "the bot printed its password");
  console.log("✓ the bot left after the race (--once) without printing its password");
  console.log("PASS: item-bot.mjs joined, raced, used and answered items on a local cluster");
}).finally(async () => {
  pump?.stop();
  bot?.kill("SIGTERM");
  if (accountsDir) await rm(accountsDir, { recursive: true, force: true });
  if (process.exitCode && botOutput) console.error(`----- bot output -----\n${botOutput}`);
});
