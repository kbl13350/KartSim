#!/usr/bin/env node
/**
 * 道具赛 test bot: a second racer for testing item races by hand in the
 * browser (rewrite/ITEM_MODE.md, SERVER_PROTOCOL.md "本地新增：道具赛").
 *
 * It logs in with an existing account (the password is read from a JSON file
 * and never printed), enters the game node like the browser (one-time
 * ticket, hello with its starter kit), joins your item room, gets ready and
 * answers `loaded`. During the race it sends motion frames built with the
 * browser's codec, so you see its kart and the node ranks it:
 *   - by default it drives along the race track's course line (the browser's
 *     course graph from mirror/p3553) at --speed m/s, in its own start slot's
 *     lane, counting route distance and laps like the browser, and finishes
 *     after the track's laps;
 *   - with --replay FILE it replays motion you recorded in the browser
 *     (moved onto its own start slot unless --shift 0).
 * It uses the items you ask for at the given race times (--use; it needs the
 * game node's development switch KART_ITEM_TEST_GRANTS=true to be handed
 * them), aiming rockets and magnets at --target (default: your racer). It
 * answers items used on it: a hit report for every item that targets it
 * when it arrives, for bananas, water bombs, time bombs and barricades it
 * drives into, and it places the barricades aimed at it. A hit that would
 * stop or slow a kart stops or slows it too (route mode). After the race it
 * returns to the room and gets ready again (--once: leaves instead).
 * Phase 3 (rewrite/ITEM_MODE.md appendix C): it follows its changer cards
 * (the replies' changers; without a 道具换位卡 or voucher it uses the item in
 * slot 0 instead of swapping), logs the server's slots pushes (the race
 * start, per-kart gains) and in-race lucci, reports both missiles of a
 * double rocket (shot 0 and 1), can claim a perfect start at its finish
 * (--perfect-start, the 完美起步 title) and logs the result titles.
 *
 * Usage, from the repository root (Node.js 22+, `npm ci` in rewrite/):
 *   KART_ITEM_TEST_GRANTS=true ./run-full-local.sh      # your stack, with test grants
 *   # create an item room in the browser, then:
 *   node server-go/test/item-bot.mjs --accounts server-go/data/dev-test-accounts.json --account bob \
 *     --use rocket@20s,banana@30s,devil@45s
 *
 * Options:
 *   --accounts FILE   accounts JSON: {username,password}, an array of them or {accounts:[…]}
 *                     (default server-go/data/dev-test-accounts.json)
 *   --account NAME    username or nickname in the file (default: --index, 0)
 *   --data ORIGIN     data service (default $KART_DATA_ORIGIN or http://127.0.0.1:8787)
 *   --node ID         game node (default: the node that has the room)
 *   --room ID|only    room to join (default "only": the only item room listed)
 *   --password TEXT   room password
 *   --team 1|2        team to switch to in a 组队道具赛 room
 *   --speed M/S       route driving speed (default 25)
 *   --use LIST        items to use: name@seconds after the start, e.g. rocket@20s,devil@25.5s,8@1500ms
 *                     (names: rocket, guideRocket, randomRocket, magnet, banana, waterBomb, waterFly,
 *                     timeBomb, barricade, devil, ufo, thunderbolt, cloud2, slotLock, scanning, shield,
 *                     angel, emp, booster; or an item index)
 *   --target NAME     nickname or playerId to aim at (default: the first opponent)
 *   --defend MODE     hit (default), shield or angel: report items that defence blocks as blocked
 *   --replay FILE     replay a recording instead of driving the course line
 *   --shift auto|0|x,y,z  move a replay (three.js meters; auto: onto the bot's start slot)
 *   --load-delay MS   wait before answering loaded
 *   --perfect-start   say the start boost succeeded when finishing (完美起步)
 *   --once            leave after one race
 *   --print-recorder  print the DevTools snippet that records your motion, then exit
 *   --quiet           log only the race events
 *
 * Recording your driving for --replay: run `node server-go/test/item-bot.mjs
 * --print-recorder`, paste the snippet into the browser's DevTools console
 * before the race, race, then run kartMotionRecording.save() in the console
 * and pass the downloaded kart-motion.json with --replay. Record on the track
 * the bot will race (the course is not checked).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  createPlayer, discoverCluster, enterGameWhenFree,
} from "./lib/kart-client.mjs";
import {
  AREA_ITEMS, clientToThree, distanceBetween, hitDelayMs, hitEffect, hitReport, itemPoint, parseArgs, readAccount,
  RECORDER_SNIPPET, recordedRace, RouteWalker, shotsOf, slotOffset, threeToClient,
} from "./lib/item-bot-lib.mjs";
import {
  browserAccepts, browserEventValidation, ITEM, ITEM_NAMES, ITEM_RULES, ItemChannel, kartSample, loadItemData,
  MotionPump, othersMask, repoRoot, ServerClock, slotOf, wireVector,
} from "./lib/item-race.mjs";

const USAGE = readFileSync(new URL(import.meta.url), "utf8").match(/\/\*\*\n([\s\S]*?)\*\//)[1]
  .replace(/^ \* ?/gm, "");

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`item-bot: ${error.message}`);
  process.exit(2);
}
if (options.help) {
  console.log(USAGE);
  process.exit(0);
}
if (options.printRecorder) {
  console.log(RECORDER_SNIPPET);
  process.exit(0);
}

/* ---------- logging ---------- */

const state = { race: undefined, roomId: undefined, playerId: undefined, room: undefined, names: new Map(),
  readying: false, grantsOff: false };

function stamp() {
  const race = state.race;
  if (race?.startAt !== undefined && race.clock) {
    const seconds = (race.clock.now() - race.startAt) / 1000;
    return `[${seconds >= 0 ? "+" : ""}${seconds.toFixed(1)}s]`;
  }
  return `[${new Date().toTimeString().slice(0, 8)}]`;
}
const log = message => console.log(`${stamp()} ${message}`);
const info = message => { if (!options.quiet) log(message); };
const nameOf = id => state.names.get(id) ?? id?.slice(0, 8) ?? "?";
const itemName = idx => ITEM_NAMES[idx] ?? `item ${idx}`;

/* ---------- browser modules ---------- */

const rewriteModules = resolve(repoRoot, "rewrite/node_modules/tsx/dist/esm/api/index.mjs");
if (!existsSync(rewriteModules)) {
  console.error("item-bot: run `npm ci` in rewrite/ first (the bot uses the browser's own modules through tsx)");
  process.exit(1);
}
const { tsImport } = await import(rewriteModules);
const load = specifier => tsImport(resolve(repoRoot, specifier), import.meta.url);
const [{ parseServerEvent }, { isValidRoomSnapshot }, { isValidItemRequest }, payload, { buildTrackCourseGraph },
  { projectSectionDistance }] = await Promise.all([
  load("rewrite/src/multiplayer/server-events.ts"),
  load("rewrite/src/multiplayer/room-validation.ts"),
  load("rewrite/src/multiplayer/protocol.ts"),
  load("rewrite/src/multiplayer/payload.ts"),
  load("rewrite/src/resources/track-course-graph.ts"),
  load("rewrite/src/world/route.ts"),
]);
const validation = browserEventValidation(isValidRoomSnapshot);
const itemData = loadItemData();

const recording = options.replay
  ? recordedRace(JSON.parse(readFileSync(resolve(options.replay), "utf8")), new payload.GameMotionDecoder())
  : undefined;
if (recording) {
  info(`replaying ${recording.samples.length} motion samples from ${options.replay}` +
    (recording.races > 1 ? ` (the longest of ${recording.races} recorded races)` : ""));
}

/**
 * The browser's resource library and item track catalog (mirror/p3553, here
 * or in the checkout KART_MIRROR_ROOT names), for the course line.
 */
const mirrorRoot = process.env.KART_MIRROR_ROOT ? resolve(process.env.KART_MIRROR_ROOT) : repoRoot;
const haveMirror = existsSync(resolve(mirrorRoot, "mirror/__p3553/archive-index"));
if (!haveMirror && !recording) {
  console.error("item-bot: driving the course line needs mirror/p3553 (or pass --replay FILE)");
  process.exit(1);
}
const courseAssets = haveMirror ? (async () => {
  const { loadResourceLibrary } = await load("rewrite/tools/economy-export/resource-library.mjs");
  const { itemTrackCatalog } = await load("rewrite/src/resources/track-catalog.ts");
  const { library, formats } = await loadResourceLibrary(repoRoot, "p3553", mirrorRoot);
  return { library, formats, catalog: await itemTrackCatalog(library),
    metadata: await library.trackMetadataCatalog() };
})() : undefined;
courseAssets?.catch(() => {});

/** The course graph and lap count of an item track, as the browser builds them. */
async function courseOf(trackId) {
  const assets = await courseAssets;
  const choice = assets.catalog.find(entry => entry.id === trackId);
  if (!choice) throw new Error(`${trackId} is not in the browser's item track catalog`);
  const file = assets.library.files.find(entry => entry.virtualPath === choice.path);
  const model = assets.formats.y9(await file.bytes());
  const route = buildTrackCourseGraph(model.root.trackObjects, /_rvs$/i.test(trackId));
  const laps = assets.metadata.find(entry => entry.id === trackId.replace(/_rvs$/i, ""))?.laps;
  return { route, laps: Number.isInteger(laps) && laps > 0 ? laps : 3, title: choice.title };
}

/* ---------- entering ---------- */

const accountsFile = existsSync(resolve(options.accounts)) ? resolve(options.accounts)
  : resolve(repoRoot, options.accounts);
const credentials = readAccount(accountsFile, options);
const cluster = await discoverCluster({ dataOrigin: options.dataOrigin, timeoutMs: 8000, settleMs: 30_000,
  gameOrigins: [], preferredNode: options.node, accounts: [credentials], forwardedFor: false });
const player = await createPlayer(cluster, credentials.username);
info(`logged in as ${player.nickname} (${credentials.username}) at ${cluster.dataOrigin}`);

/** Every item room listed on a node (list-gameplay item, all pages). */
async function itemRooms(control) {
  const rooms = [];
  for (let page = 0; ; page++) {
    const listed = await control.request({ type: "list-gameplay", gameplay: "item", page });
    rooms.push(...listed.rooms);
    if (rooms.length >= listed.total || listed.rooms.length === 0) return rooms;
  }
}

/**
 * Enters the node that has the room (--node first, then the others) and
 * returns the connection and the room summary.
 */
async function enterRoomNode() {
  const nodes = options.node ? cluster.servers.filter(server => server.nodeId === options.node) : cluster.servers;
  const seen = [];
  for (const server of nodes) {
    const entry = await enterGameWhenFree(cluster, server, player, { timeoutMs: 15_000,
      validate: message => {
        if (!browserAccepts(parseServerEvent, validation, message)) {
          log(`WARNING: the browser would reject this server event: ${JSON.stringify(message)}`);
        }
        return true;
      } });
    const rooms = await itemRooms(entry.control);
    seen.push(...rooms.map(room => ({ ...room, nodeId: server.nodeId })));
    const room = options.room === "only"
      ? (rooms.length === 1 ? rooms[0] : undefined) : rooms.find(candidate => candidate.roomId === options.room);
    if (room) return { ...entry, server, summary: room };
    entry.control.close();
  }
  const listing = seen.map(room => `  ${room.roomId} "${room.name}" ${room.channelName} ${room.count}/${room.capacity}` +
    `${room.gaming ? " (racing)" : ""} on ${room.nodeId}`).join("\n");
  throw new Error(options.room === "only"
    ? `need exactly one item room, found ${seen.length}${listing ? `:\n${listing}\nchoose one with --room ID` : ""}`
    : `item room ${options.room} not found${listing ? `; item rooms:\n${listing}` : ""}`);
}

const entry = await enterRoomNode();
const control = entry.control;
state.playerId = entry.welcome.playerId;
state.roomId = entry.summary.roomId;
info(`entered ${entry.server.nodeId} as ${state.playerId}`);

/** Sends a control request; logs and returns undefined when it fails. */
async function ask(fields, label = fields.type) {
  const reply = await control.send(fields);
  if (reply.type === "error") {
    log(`${label} refused: ${reply.code}`);
    return undefined;
  }
  return reply;
}

const joined = await control.send({ type: "join", roomId: state.roomId, password: options.password,
  equipment: player.equipment });
if (joined.type === "error") {
  console.error(`item-bot: cannot join ${state.roomId}: ${joined.code}`);
  control.close();
  process.exit(1);
}
log(`joined "${joined.room.name}" (${joined.room.channelName === "itemTeamCombine" ? "组队道具赛" : "个人道具赛"}, ` +
  `${joined.room.members.length}/${joined.room.capacity})`);
if (options.team && joined.room.mode === "team") await ask({ type: "team", roomId: state.roomId, team: options.team });

/* ---------- the race ---------- */

/** Starts this race's bot state when the room enters loading with the bot on the roster. */
async function prepareRace(room) {
  const raceId = room.race.raceId;
  const slot = room.race.startSlots?.[state.playerId] ?? 0;
  // Motion frames name racers by room slot (protocol 40), not by start slot.
  const memberSlot = slotOf(room, state.playerId);
  const race = {
    raceId, trackId: room.race.trackId, slot, memberSlot, clock: undefined, startAt: room.race.startAt, room,
    team: room.race.roster.find(member => member.playerId === state.playerId)?.team ?? null,
    items: new ItemChannel(control, { roomId: state.roomId, raceId, validRequest: isValidItemRequest,
      ratePerSecond: 15, label: player.nickname }),
    encoder: new payload.GameMotionEncoder({ raceId, slot: memberSlot }),
    uses: new Map(), areas: [], effects: [], timers: new Set(), finishSent: false, over: false, cube: 4000,
    pose: undefined, scans: new Set(),
  };
  // Set before any await: the next room updates of this race must not prepare it again.
  state.race = race;
  race.clock = await ServerClock.sync(control, 3);
  const clock = race.clock;
  for (const member of room.race.roster) state.names.set(member.playerId, member.name);
  info(`race ${raceId.slice(0, 8)} on ${race.trackId}, start slot ${slot}`);
  if (recording) {
    race.source = await replaySource(race);
  } else {
    const course = await courseOf(race.trackId);
    const walker = new RouteWalker(course.route, { laps: course.laps, offset: slotOffset(slot),
      project: projectSectionDistance });
    race.source = routeSource(race, walker);
    info(`driving the course line of ${course.title} (${course.laps} laps) at ${options.speed} m/s`);
  }
  race.pump = new MotionPump({ socket: control.socket, encoder: race.encoder, clock,
    mask: () => othersMask(state.room ?? room, state.playerId), sample: now => motionSample(race, now) }).start();
  if (options.loadDelayMs) await delay(options.loadDelayMs);
  if (state.race === race && !race.over) {
    await ask({ type: "loaded", roomId: state.roomId, raceId });
    info("loaded");
  }
}

/** The bot's speed factor at node time `now` from the hits holding it up. */
function speedFactor(race, now) {
  race.effects = race.effects.filter(effect => effect.until > now);
  return Math.min(1, ...race.effects.map(effect => effect.factor));
}

/** Course-line driving: advance by the elapsed time at speed × factor, finish after the laps. */
function routeSource(race, walker) {
  let lastAt;
  return {
    sample(now) {
      let speed = 0;
      if (race.startAt !== undefined && now > race.startAt && !walker.finished) {
        const from = Math.max(lastAt ?? race.startAt, race.startAt);
        speed = options.speed * speedFactor(race, now);
        walker.advance(speed * (now - from) / 1000);
        lastAt = now;
      }
      const pose = walker.pose();
      return {
        pose: { ...pose, velocity: { x: pose.forward.x * speed, y: pose.forward.y * speed, z: pose.forward.z * speed } },
        progress: { distance: walker.distance, lap: walker.lap },
        finished: walker.finished,
      };
    },
  };
}

/** Replay: the recorded samples in race time, moved onto the bot's slot (--shift). */
async function replaySource(race) {
  const { samples, startTick } = recording;
  let shift = options.shift;
  if (shift === "auto") {
    shift = { x: 0, y: 0, z: 0 };
    if (courseAssets) {
      const course = await courseOf(race.trackId);
      const walker = new RouteWalker(course.route, { laps: course.laps, offset: slotOffset(race.slot),
        project: projectSectionDistance });
      const [x, y, z] = samples[0].position;
      const recorded = { x, y: z, z: -y };
      const grid = walker.pose().position;
      shift = { x: grid.x - recorded.x, y: grid.y - recorded.y, z: grid.z - recorded.z };
    } else {
      log("WARNING: without mirror/p3553 the replay is not moved onto the bot's start slot");
    }
  }
  const wireShift = wireVector(shift);
  let index = 0;
  return {
    sample(now) {
      const elapsed = race.startAt === undefined ? -Infinity : now - race.startAt;
      while (index + 1 < samples.length && samples[index + 1].tick - startTick <= elapsed) index++;
      const recorded = samples[index];
      const ended = index === samples.length - 1 && elapsed > recorded.tick - startTick;
      const position = recorded.position.map((value, axis) => Math.fround(value + wireShift[axis]));
      const [x, y, z] = position;
      const [vx, vy, vz] = recorded.linearVelocity;
      const speed = Math.hypot(vx, vy, vz);
      const raw = { ...structuredClone(recorded), position,
        ...(recorded.routing ? { routing: { ...recorded.routing, observedSlot: race.memberSlot } } : {}) };
      // A reset start is a tick of the recorded race: move it into this one (at most now).
      if (recorded.resetStartedAt !== undefined) {
        raw.resetStartedAt = Math.min(race.clock.tick(now),
          race.clock.tick(race.startAt + (recorded.resetStartedAt - startTick)));
      }
      return {
        raw,
        pose: { position: { x, y: z, z: -y },
          forward: speed > 0.5 ? { x: vx / speed, y: vz / speed, z: -vy / speed } : { x: 0, y: 0, z: -1 } },
        finishElapsedMs: recorded.raceProgress?.finishElapsedMs,
        finished: ended || recorded.raceProgress?.finishElapsedMs !== undefined,
      };
    },
  };
}

/** The motion sample of one beat; also runs the bot's per-beat checks (finish, areas). */
function motionSample(race, now) {
  if (race.over || !race.source) return undefined;
  const beat = race.source.sample(now);
  race.pose = beat.pose;
  if (beat.finished && !race.finishSent && race.startAt !== undefined && now > race.startAt) {
    race.finishSent = true;
    race.finishElapsedMs = beat.finishElapsedMs ?? Math.max(0, Math.round(now - race.startAt));
    ask({ type: "finish", roomId: state.roomId, raceId: race.raceId, elapsedMs: race.finishElapsedMs,
      ...(options.perfectStart ? { perfectStart: true } : {}) })
      .then(reply => { if (reply) log(`finished in ${(race.finishElapsedMs / 1000).toFixed(2)} s`); })
      .catch(error => log(`finish failed: ${error.message}`));
  }
  checkAreas(race, now);
  if (beat.raw) return beat.raw;
  return kartSample({ tick: 0, pose: beat.pose, observedSlot: race.memberSlot,
    progress: { ...beat.progress, ...(race.finishSent ? { finishElapsedMs: race.finishElapsedMs } : {}) } });
}

/* ---------- items ---------- */

/** The racer to aim at: --target (nickname or playerId), else the first opponent. */
function aimTarget(race) {
  const roster = race.room.race.roster.filter(member => member.playerId !== state.playerId &&
    (race.team === null || member.team !== race.team));
  if (options.target) {
    const target = roster.find(member => member.playerId === options.target || member.name === options.target);
    if (!target) log(`--target ${options.target} is not an opponent in this race; firing without a lock`);
    return target?.playerId;
  }
  return roster[0]?.playerId;
}

/** Runs a callback at node time `at` unless the race is over. */
function at(race, time, callback) {
  const timer = setTimeout(() => {
    race.timers.delete(timer);
    if (!race.over) callback();
  }, Math.max(0, time - race.clock.now()));
  race.timers.add(timer);
}

/** Reports a hit by an item use on the bot (one missile of it: shot) and lets it hold the bot up. */
async function reportHit(race, used, shot) {
  const report = hitReport(used.itemId, options.defend);
  const reply = await race.items.send("hit", { useId: used.useId, itemId: used.itemId, ...report,
    ...(shot === undefined ? {} : { shot }) });
  const what = used.useId === 0 ? `${itemName(used.itemId)} on the track` : `${itemName(used.itemId)} of ${nameOf(used.playerId)}`;
  if (reply.type === "error") {
    log(`hit report on ${what} refused: ${reply.code}`);
    return;
  }
  log(`${reply.result === "hit" ? "hit by" : `blocked (${reply.by})`} ${what}` +
    `${shot === undefined ? "" : ` (missile ${shot + 1} of 2)`}${reply.removed ? ", removed" : ""}`);
  const effect = reply.result === "hit" ? hitEffect(itemData, used.itemId) : undefined;
  if (effect && !recording) {
    const now = race.clock.now();
    race.effects.push({ until: now + effect.ms, factor: effect.factor });
  }
}

/** Whether the bot can be hit by an area item of `userId` (water bombs and barricades spare teammates). */
function canBeHitBy(race, idx, userId) {
  if (ITEM_RULES[idx]?.hit !== "opponents" || race.team === null) return true;
  const user = race.room.race.roster.find(member => member.playerId === userId);
  return user?.team !== race.team;
}

/** Adds a live area item (a dropped banana, a landing water bomb, a placed barricade or time bomb). */
function addArea(race, used, point) {
  const area = AREA_ITEMS[used.itemId];
  if (!area || !point || !canBeHitBy(race, used.itemId, used.playerId)) return;
  race.areas.push({ used, point, from: used.startAt + area.from(itemData), until: used.startAt + area.until(itemData),
    radius: area.radius, reported: false });
}

/** Reports the area items the bot is inside of. */
function checkAreas(race, now) {
  if (!race.pose) return;
  race.areas = race.areas.filter(area => area.until > now && !area.reported);
  for (const area of race.areas) {
    if (now < area.from || distanceBetween(race.pose.position, area.point) > area.radius) continue;
    area.reported = true;
    reportHit(race, area.used);
  }
}

/** Another racer's item event of this race. */
function onItemEvent(race, event) {
  switch (event.action) {
    case "used": {
      race.uses.set(event.useId, event);
      const onMe = event.targets.includes(state.playerId);
      info(`${nameOf(event.playerId)} used ${itemName(event.itemId)}` +
        (event.count === 2 ? " ×2" : "") +
        (event.targets.length ? ` → ${event.targets.map(nameOf).join(", ")}` : "") +
        (event.etaMs ? ` (eta ${event.etaMs} ms)` : ""));
      if (onMe && ITEM_RULES[event.itemId]?.hit === "targets") {
        for (const { delayMs, shot } of shotsOf(event)) {
          at(race, event.startAt + hitDelayMs(itemData, event) + delayMs, () => reportHit(race, event, shot));
        }
      }
      if (event.itemId === ITEM.barricade && event.targets[0] === state.playerId) {
        // The targeted leader works out where the barricade lands.
        at(race, event.startAt + 200, async () => {
          const point = itemPoint(ITEM.barricade, race.pose ?? { position: { x: 0, y: 0, z: 0 },
            forward: { x: 0, y: 0, z: -1 } }, options.speed);
          const reply = await race.items.send("place", { useId: event.useId, point: threeToClient(point) });
          if (reply.type === "error") {
            log(`barricade place refused: ${reply.code}`);
            return;
          }
          info(`placed ${nameOf(event.playerId)}'s barricade 70 m ahead`);
          addArea(race, event, clientToThree(reply.point));
        });
      }
      if (event.point) addArea(race, event, clientToThree(event.point));
      return;
    }
    case "placed": {
      const used = race.uses.get(event.useId);
      info(`${nameOf(event.playerId)}'s ${itemName(event.itemId)} placed`);
      if (used) addArea(race, used, clientToThree(event.point));
      return;
    }
    case "hit": {
      if (event.removed) race.areas = race.areas.filter(area => area.used.useId !== event.useId);
      const what = event.useId === 0 ? `a track ${itemName(event.itemId)}` : `${nameOf(event.userId)}'s ${itemName(event.itemId)}`;
      info(`${nameOf(event.playerId)} ${event.result === "hit" ? "was hit by" : `blocked (${event.by})`} ${what}` +
        `${event.variant ? ` [${event.variant}]` : ""}${event.removed ? " (removed)" : ""}`);
      return;
    }
    case "slots":
      // The server's own push: the race start (changer cards, a 迅 start item) or a per-kart gain.
      race.items.pushed(event);
      if (event.itemId !== undefined) info(`${event.reason === "start" ? "started with" : "gained"} ${itemName(event.itemId)}`);
      return;
    case "lucci":
      info(`earned ${event.amount} lucci (${event.reason})`);
      return;
    case "scan":
      if (!race.scans.has(event.playerId)) {
        race.scans.add(event.playerId);
        info(`scanning ${nameOf(event.playerId)}: ${event.slots.map(itemName).join(", ")}`);
      }
      return;
  }
}

/** The bot's own --use schedule for this race. */
async function runSchedule(race) {
  for (const planned of options.use) {
    // Item requests count from startAt: get the item a second before its use.
    await race.clock.until(race.startAt + Math.max(0, planned.atMs - 1000));
    if (race.over || state.grantsOff) return;
    const slots = race.items.slots ?? [-1, -1];
    if (slots[0] !== planned.idx) {
      if (slots[1] === planned.idx) {
        await swapOrUse(race);
      } else {
        race.cube = race.cube >= 4096 ? 3000 : race.cube + 1;
        const grant = await race.items.send("cube", { cubeId: race.cube, capacity: 2, testItemId: planned.idx });
        if (grant.type === "error") {
          if (grant.code === "ITEM_TEST_GRANTS_DISABLED") {
            state.grantsOff = true;
            log("cannot get items: start the game node with KART_ITEM_TEST_GRANTS=true " +
              "(e.g. KART_ITEM_TEST_GRANTS=true ./run-full-local.sh) to use --use");
            return;
          }
          log(`cannot get ${planned.name}: ${grant.code}` +
            (grant.code === "INVALID_TESTITEMID" ? " (not an item of this race's table)" : ""));
          continue;
        }
        if (grant.itemId === null) {
          log(`cannot get ${planned.name}: ${grant.reason ?? "nothing granted"} (slots ${grant.slots.map(itemName)})`);
          continue;
        }
        if (grant.itemId !== planned.idx) {
          state.grantsOff = true;
          log(`the game node ignored testItemId and drew ${itemName(grant.itemId)}: it predates the test ` +
            "grants (KART_ITEM_TEST_GRANTS); rebuild it from this checkout");
          return;
        }
        if (grant.slots[0] !== planned.idx && grant.slots[1] === planned.idx) await swapOrUse(race);
      }
    }
    await race.clock.until(race.startAt + planned.atMs);
    if (race.over) return;
    await useItem(race, planned.idx);
  }
}

/**
 * Brings slot 1 forward: a swap with a 道具换位卡 or its voucher, otherwise
 * by using the item in slot 0 first.
 */
async function swapOrUse(race) {
  if ((race.items.changers?.slot ?? 0) !== 0) {
    const reply = await race.items.send("swap");
    if (reply.type === "item") return;
    log(`swap refused: ${reply.code}`);
  }
  await useItem(race, race.items.slots[0]);
}

/** Uses the item in slot 0 (retrying through a slot lock for 5 s). */
async function useItem(race, idx) {
  const rule = ITEM_RULES[idx];
  const pose = race.pose ?? { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 } };
  const fields = { itemId: idx };
  if (rule.target === "aimed") {
    const target = aimTarget(race);
    if (target) fields.targetId = target;
  }
  if (rule.point) fields.point = threeToClient(itemPoint(idx, pose, options.speed));
  const until = race.clock.now() + 5000;
  for (;;) {
    const reply = await race.items.send("use", fields);
    if (reply.type === "item") {
      log(`used ${itemName(idx)}` + (reply.targets.length ? ` → ${reply.targets.map(nameOf).join(", ")}` : "") +
        (reply.etaMs ? ` (eta ${reply.etaMs} ms)` : ""));
      race.uses.set(reply.useId, reply);
      if (idx === ITEM.timeBomb) {
        // The user reports where its time bomb explodes, where it is then.
        at(race, reply.startAt + 3000, async () => {
          const placed = await race.items.send("place", { useId: reply.useId, point: threeToClient(race.pose.position) });
          if (placed.type === "error") log(`time bomb place refused: ${placed.code}`);
          else addArea(race, reply, clientToThree(placed.point));
        });
      }
      return;
    }
    if (reply.code !== "ITEM_LOCKED" || race.clock.now() > until) {
      log(`use ${itemName(idx)} refused: ${reply.code}`);
      return;
    }
    await delay(300);
  }
}

function endRace(race) {
  if (race.over) return;
  race.over = true;
  race.pump?.stop();
  for (const timer of race.timers) clearTimeout(timer);
  race.timers.clear();
}

/* ---------- room events ---------- */

let leaving = false;

async function leave(code = 0) {
  if (leaving) return;
  leaving = true;
  if (state.race) endRace(state.race);
  try {
    await Promise.race([control.send({ type: "leave", roomId: state.roomId }), delay(2000)]);
  } catch { /* closing anyway */ }
  control.close();
  process.exit(code);
}
process.on("SIGINT", () => { log("leaving"); leave(0); });
process.on("SIGTERM", () => leave(0));

async function onRoom(room) {
  if (room.roomId !== state.roomId || leaving) return;
  state.room = room;
  const me = room.members.find(member => member.playerId === state.playerId);
  if (!me) {
    log("no longer in the room");
    return leave(0);
  }
  if (room.hostId === state.playerId) {
    log("the bot became the host (everyone else left); leaving");
    return leave(0);
  }
  const race = state.race;
  const inRace = room.race && room.race.roster.some(member => member.playerId === state.playerId);
  if (room.phase === "loading" && inRace && race?.raceId !== room.race.raceId) {
    if (race) endRace(race);
    prepareRace(room).catch(error => {
      log(`cannot race: ${error.message}`);
      ask({ type: "load-failed", roomId: state.roomId, raceId: room.race.raceId });
    });
    return;
  }
  if (race && room.race?.raceId === race.raceId) {
    race.room = room;
    if ((room.phase === "countdown" || room.phase === "racing") && race.startAt === undefined) {
      race.startAt = room.race.startAt;
      log(`countdown: the race starts in ${((race.startAt - race.clock.now()) / 1000).toFixed(1)} s`);
      runSchedule(race).catch(error => log(`item schedule failed: ${error.message}`));
    }
    if (room.phase === "finished" && !race.over) {
      endRace(race);
      const results = room.race.results.map(row => `${row.rank}. ${nameOf(row.playerId)} ` +
        (row.elapsedMs === null ? "—" : `${(row.elapsedMs / 1000).toFixed(2)} s`) +
        (row.titles?.length ? ` [${row.titles.join(", ")}]` : "")).join("  ");
      log(`race over: ${results}${room.race.winningTeam ? `; team ${room.race.winningTeam} wins` : ""}`);
      if (options.once) {
        await delay(3000);
        return leave(0);
      }
      await delay(4000);
      await ask({ type: "return-room", roomId: state.roomId, raceId: race.raceId });
    }
  }
  if (room.phase === "open" && !me.ready && !state.readying) {
    state.readying = true;
    try {
      if (await ask({ type: "ready", roomId: state.roomId, ready: true })) info("ready");
    } finally {
      state.readying = false;
    }
  }
}

control.socket.addEventListener("message", event => {
  if (typeof event.data !== "string") return;
  let message;
  try { message = JSON.parse(event.data); } catch { return; }
  // Replies and broadcasts both carry the room; the ControlSocket buffer is not needed.
  control.events.length = 0;
  if (message.type === "room" && message.room) {
    onRoom(message.room).catch(error => log(`room update failed: ${error.message}`));
  } else if (message.type === "item" && state.race && message.raceId === state.race.raceId &&
      message.requestId === undefined) {
    onItemEvent(state.race, message);
  } else if (message.type === "left" && message.roomId === state.roomId && message.requestId === undefined) {
    log("removed from the room");
    leave(0);
  }
});
control.socket.addEventListener("close", () => {
  if (!leaving) {
    log("connection closed");
    process.exit(1);
  }
});

await onRoom(joined.room);
log(options.use.length ? `waiting for the race; will use ${options.use.map(entry =>
  `${entry.name}@${entry.atMs / 1000}s`).join(", ")}` : "waiting for the race (Ctrl-C leaves)");
