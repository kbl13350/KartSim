// The pure parts of ../item-bot.mjs (the item race test bot): command-line
// options, the account file, the --use schedule, the browser recorder
// snippet and recordings, the route walker that drives the bot along a
// track's course graph, and how the bot answers the items used on it.
// Unit tests: node --test test/lib/item-bot-lib.test.mjs (from server-go/).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ITEM, ITEM_NAMES, ITEM_RULES, itemLife } from "./item-race.mjs";

/* ---------- options ---------- */

export const DEFAULT_ACCOUNTS_FILE = "server-go/data/dev-test-accounts.json";

/** Bot driving speed along the route (m/s) when --speed is not given: about 90 km/h. */
export const DEFAULT_SPEED = 25;

const BOOLEAN_FLAGS = new Set(["once", "print-recorder", "quiet", "help", "perfect-start"]);
const VALUE_FLAGS = new Set(["accounts", "account", "index", "data", "node", "room", "password", "team", "speed",
  "use", "target", "defend", "replay", "shift", "load-delay"]);

/** Parses `--name value` / `--name=value` options; throws on unknown ones. */
export function parseArgs(argv, env = process.env) {
  const raw = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`unexpected argument ${JSON.stringify(arg)} (see --help)`);
    const [, name, inline] = match;
    if (BOOLEAN_FLAGS.has(name)) {
      if (inline !== undefined) throw new Error(`--${name} takes no value`);
      raw[name] = true;
    } else if (VALUE_FLAGS.has(name)) {
      const value = inline ?? argv[++index];
      if (value === undefined) throw new Error(`--${name} needs a value`);
      raw[name] = value;
    } else {
      throw new Error(`unknown option --${name} (see --help)`);
    }
  }
  const number = (name, fallback, min, max) => {
    if (raw[name] === undefined) return fallback;
    const value = Number(raw[name]);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`--${name} must be ${min}–${max}`);
    return value;
  };
  const team = raw.team === undefined ? undefined : number("team", undefined, 1, 2);
  if (team !== undefined && !Number.isInteger(team)) throw new Error("--team must be 1 or 2");
  const defend = raw.defend ?? "hit";
  if (!["hit", "shield", "angel"].includes(defend)) throw new Error("--defend must be hit, shield or angel");
  return {
    help: raw.help === true,
    printRecorder: raw["print-recorder"] === true,
    once: raw.once === true,
    quiet: raw.quiet === true,
    perfectStart: raw["perfect-start"] === true,
    accounts: raw.accounts ?? DEFAULT_ACCOUNTS_FILE,
    account: raw.account,
    index: number("index", 0, 0, 1000),
    dataOrigin: (raw.data ?? env.KART_DATA_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/+$/, ""),
    node: raw.node,
    room: raw.room ?? "only",
    password: raw.password ?? "",
    team,
    speed: number("speed", DEFAULT_SPEED, 0, 140),
    use: parseUseSchedule(raw.use ?? ""),
    target: raw.target,
    defend,
    replay: raw.replay,
    shift: parseShift(raw.shift ?? "auto"),
    loadDelayMs: number("load-delay", 0, 0, 80_000),
  };
}

/** --shift: "auto" (move a replay onto the bot's grid slot), "0" or "x,y,z" meters (three.js). */
export function parseShift(text) {
  if (text === "auto") return "auto";
  if (text === "0" || text === "none") return { x: 0, y: 0, z: 0 };
  const parts = text.split(",").map(Number);
  if (parts.length !== 3 || parts.some(value => !Number.isFinite(value))) {
    throw new Error(`--shift must be auto, 0 or x,y,z, got ${JSON.stringify(text)}`);
  }
  return { x: parts[0], y: parts[1], z: parts[2] };
}

/** Item names the bot understands (case-insensitive), plus a few aliases. */
const ITEM_ALIASES = { cloud: ITEM.cloud2, lock: ITEM.slotLock, scan: ITEM.scanning, bomb: ITEM.waterBomb,
  missile: ITEM.rocket, guide: ITEM.guideRocket };

/** An item name or index → its index. */
export function itemIndex(name) {
  const lower = name.trim().toLowerCase();
  if (/^\d+$/.test(lower) && ITEM_NAMES[Number(lower)]) return Number(lower);
  const found = Object.entries(ITEM).find(([key]) => key.toLowerCase() === lower)?.[1] ?? ITEM_ALIASES[lower];
  if (found === undefined || !ITEM_RULES[found]) {
    throw new Error(`unknown item ${JSON.stringify(name)}; use one of ${Object.keys(ITEM)
      .filter(key => ITEM_RULES[ITEM[key]]).join(", ")}`);
  }
  return found;
}

/**
 * --use "rocket@20s,devil@25.5s,8@1500ms": items to use, in race time after
 * startAt (s by default, or ms), sorted by time.
 */
export function parseUseSchedule(text) {
  if (!text.trim()) return [];
  return text.split(",").map(entry => {
    const match = /^\s*([A-Za-z0-9]+)\s*@\s*(\d+(?:\.\d+)?)\s*(ms|s)?\s*$/.exec(entry);
    if (!match) throw new Error(`--use entries look like rocket@20s, got ${JSON.stringify(entry)}`);
    const idx = itemIndex(match[1]);
    const atMs = Math.round(Number(match[2]) * (match[3] === "ms" ? 1 : 1000));
    return { idx, name: ITEM_NAMES[idx], atMs };
  }).sort((a, b) => a.atMs - b.atMs);
}

/**
 * The account to log in with, from a JSON file holding one {username,
 * password} object, an array of them or {accounts: [...]}: the entry named
 * `account` (username or nickname), otherwise entry `index`. The password
 * is returned but never printed.
 */
export function readAccount(file, { account, index = 0 } = {}, read = readFileSync) {
  let data;
  try {
    data = JSON.parse(read(file, "utf8"));
  } catch (error) {
    throw new Error(`cannot read the account file ${file}: ${error.message}`);
  }
  const entries = Array.isArray(data) ? data : Array.isArray(data?.accounts) ? data.accounts : [data];
  const valid = entries.filter(entry => typeof entry?.username === "string" && typeof entry?.password === "string");
  if (valid.length === 0) throw new Error(`${file} holds no {username, password} account`);
  const chosen = account === undefined ? valid[index]
    : valid.find(entry => entry.username === account || entry.nickname === account);
  if (!chosen) {
    throw new Error(`${file} has no account ${account === undefined ? `#${index}` : JSON.stringify(account)} ` +
      `(accounts: ${valid.map(entry => entry.username).join(", ")})`);
  }
  return { username: chosen.username, password: chosen.password };
}

/* ---------- recordings ---------- */

/**
 * Paste into the browser's DevTools console before the race (or run
 * `node server-go/test/item-bot.mjs --print-recorder`): records every motion
 * frame the page sends, over WebRTC or WebSocket (binary messages: protocol
 * 40 motion frames, an 8-byte header with the payload kind 1–10 first), then
 * kartMotionRecording.save() downloads them as JSON for --replay.
 * kartMotionRecording.stop() restores the send methods.
 */
export const RECORDER_SNIPPET = `(() => {
  const frames = [];
  const targets = [WebSocket.prototype, RTCDataChannel.prototype];
  const sends = targets.map(target => target.send);
  targets.forEach((target, index) => {
    target.send = function (data) {
      try {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
          : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : undefined;
        if (bytes && bytes.length >= 88 && bytes[0] >= 1 && bytes[0] <= 10) {
          let text = "";
          for (const byte of bytes) text += String.fromCharCode(byte);
          frames.push(btoa(text));
        }
      } catch {}
      return sends[index].call(this, data);
    };
  });
  window.kartMotionRecording = {
    frames,
    save(name = "kart-motion.json") {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 2, frames })], { type: "application/json" }));
      link.download = name;
      link.click();
    },
    stop() { targets.forEach((target, index) => { target.send = sends[index]; }); },
  };
  console.log("Recording race motion; after the race run kartMotionRecording.save()");
})();`;

/**
 * A version 1 recording frame (the release's 56-byte header: magic 19277,
 * kind, mask, room/race/player UUIDs, sequence) as protocol 40: the same
 * payload with the routed kinds' 16-byte observed UUID cut to a slot byte.
 * Other frames are returned as they are.
 */
export function protocol40Frame(bytes) {
  if (bytes.length < 136 || bytes[0] !== 0x4d || bytes[1] !== 0x4b) return bytes;
  const kind = bytes[2];
  let payload = bytes.subarray(56);
  if ((kind === 8 || kind === 10) && payload.length >= 166) {
    payload = Uint8Array.of(...payload.subarray(0, 150), 0, ...payload.subarray(166));
  }
  const frame = new Uint8Array(8 + payload.length);
  frame.set([kind, bytes[3], 0, bytes[20]]);
  frame.set(bytes.subarray(52, 56), 4);
  frame.set(payload, 8);
  return frame;
}

/**
 * The samples of a recording ({version: 2, frames: [base64 motion frame]},
 * optional startTick; version 1 frames are converted with protocol40Frame),
 * decoded with the browser's GameMotionDecoder: the race with the most
 * frames, in order, with the tick its racer started moving (the recording's
 * startTick when given: the race's startAt on the recorded node's clock).
 * A race ends where the race tag changes or the sequence starts over; a
 * repeated sequence (the same frame on another link) is skipped.
 */
export function recordedRace(recording, decoder) {
  assert.ok(Array.isArray(recording?.frames) && recording.frames.length > 0, "the recording holds no frames");
  const races = [];
  let race;
  let invalid = 0;
  for (const text of recording.frames) {
    const decoded = decoder.decode(protocol40Frame(new Uint8Array(Buffer.from(text, "base64"))));
    if (!decoded || decoded.payload.kind !== "kinematic") { invalid++; continue; }
    // The same frame sent on another link (a direct peer and the relay).
    if (race && decoded.raceTag === race.tag && decoded.sequence === race.sequence) continue;
    if (!race || decoded.raceTag !== race.tag || decoded.sequence < race.sequence) {
      race = { tag: decoded.raceTag, samples: [] };
      races.push(race);
    }
    race.sequence = decoded.sequence;
    race.samples.push(decoded.payload);
  }
  const samples = races.map(entry => entry.samples).sort((a, b) => b.length - a.length)[0] ?? [];
  assert.ok(samples.length > 0, "the recording holds no kinematic race motion");
  let startTick = recording.startTick;
  if (!Number.isFinite(startTick)) {
    const moving = samples.find(sample => Math.hypot(...sample.linearVelocity) > 1);
    startTick = (moving ?? samples[0]).tick - (moving ? 100 : 0);
  }
  return { samples, startTick, invalid, races: races.length };
}

/* ---------- route ---------- */

const f32 = Math.fround;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const lengthOf = a => Math.hypot(a.x, a.y, a.z);
const unit = (a, fallback) => {
  const length = lengthOf(a);
  return length > 1e-6 ? scale(a, 1 / length) : fallback;
};
const crossOf = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/**
 * The browser's multiplayer start slot offset across the road (m)
 * (vehicle/race-start-slots.ts raceStartPosition): slots alternate right
 * and left of the start frame, 2 m apart.
 */
export function slotOffset(slot) {
  return f32(f32(slot & 1 ? -((slot >>> 1) + 1) : slot >>> 1) * f32(2));
}

/**
 * The quaternion [w, x, y, z] of a client-space rotation matrix, as the
 * browser computes a body's motion quaternion (generated world.js PL: IL of
 * the matrix RL rebuilds from the body's right/forward/up).
 */
export function quaternionFromMatrix(m) {
  const [e, t, i] = [m[0].x, m[0].y, m[0].z];
  const [r, s, o] = [m[1].x, m[1].y, m[1].z];
  const [a, c, l] = [m[2].x, m[2].y, m[2].z];
  const trace = f32(f32(e + s) + l);
  if (trace > 0) {
    const b = f32(Math.sqrt(f32(trace + 1)));
    const k = f32(0.5 / b);
    return [f32(b * 0.5), f32(f32(c - o) * k), f32(f32(i - a) * k), f32(f32(r - t) * k)];
  }
  const diagonal = [e, s, l];
  let d = 0;
  if (diagonal[1] > diagonal[d]) d = 1;
  if (diagonal[2] > diagonal[d]) d = 2;
  const f = (d + 1) % 3;
  const p = (f + 1) % 3;
  const v = [[e, t, i], [r, s, o], [a, c, l]];
  const w = f32(Math.sqrt(f32(f32(f32(diagonal[d] - diagonal[f]) - diagonal[p]) + 1)));
  const g = f32(0.5 / w);
  const q = [0, 0, 0];
  q[d] = f32(w * 0.5);
  q[f] = f32(f32(v[f][d] + v[d][f]) * g);
  q[p] = f32(f32(v[p][d] + v[d][p]) * g);
  return [f32(f32(v[p][f] - v[f][p]) * g), q[0], q[1], q[2]];
}

/**
 * The kart body basis on a route frame heading `forward` (three.js world
 * vectors), as the browser's resetFromRouteFrame builds it
 * (driving/reset-runtime.ts resetVehicleFromRoute: a level kart facing the
 * route), with its motion quaternion.
 */
export function routeBasis(forward) {
  const client = { x: forward.x, y: -forward.z, z: forward.y };
  // As in the browser, the reversed heading is not normalized (route headings are unit vectors).
  const reverse = lengthOf(client) > 1e-6 ? { x: -client.x, y: -client.y, z: -client.z } : { x: 0, y: -1, z: 0 };
  const rightClient = unit(crossOf(reverse, { x: 0, y: 0, z: 1 }), { x: 1, y: 0, z: 0 });
  const upClient = unit(crossOf(rightClient, reverse), { x: 0, y: 0, z: 1 });
  const matrix = [
    { x: rightClient.x, y: reverse.x, z: upClient.x },
    { x: rightClient.y, y: reverse.y, z: upClient.y },
    { x: rightClient.z, y: reverse.z, z: upClient.z },
  ];
  // orientation-math.ts setBodyBasis: the client matrix as world vectors.
  return {
    right: { x: matrix[0].x, y: matrix[2].x, z: -matrix[1].x },
    forward: { x: -matrix[0].y, y: -matrix[2].y, z: matrix[1].y },
    up: { x: matrix[0].z, y: matrix[2].z, z: -matrix[1].z },
    quaternion: quaternionFromMatrix(matrix),
  };
}

/**
 * Drives a kart along a track's course graph (resources/track-course-graph.ts
 * buildTrackCourseGraph: sections of frames in three.js world coordinates)
 * the way the browser's route state counts it (world/route-state.ts): it
 * starts in the last section with lap 0 and distance −last.length + its
 * place there, takes each section's first outgoing edge, and gains a lap on
 * entering the first section (or crossing a final gate on the last lap).
 * It has finished once lap > laps. `offset` keeps it that many meters right
 * of the course line (its start slot); `project` is world/route.ts
 * projectSectionDistance.
 */
export class RouteWalker {
  constructor(route, { laps, offset = 0, project }) {
    assert.ok(route.sections.length > 0, "the course has no sections");
    assert.ok(Number.isInteger(laps) && laps >= 1, `invalid lap count ${laps}`);
    this.route = route;
    this.laps = laps;
    this.offset = offset;
    this.cumulative = route.sections.map(section => {
      const sums = [0];
      for (let index = 1; index < section.frames.length; index++) {
        const segment = lengthOf(sub(section.frames[index].position, section.frames[index - 1].position));
        sums.push(f32(sums[index - 1] + f32(segment)));
      }
      return sums;
    });
    const last = route.sections[route.lastSection];
    const start = add(route.start.position, scale(routeBasis(route.start.forward).right, offset));
    this.section = route.lastSection;
    this.local = project(start, last);
    this.completed = -last.length;
    this.lap = 0;
    this.ended = false;
  }

  /** Route distance (m), the progress the browser sends: negative before the start line. */
  get distance() {
    return f32(this.completed + this.local);
  }

  get finished() {
    return this.ended || this.lap > this.laps;
  }

  /** Moves the kart `meters` further along its path. */
  advance(meters) {
    if (this.finished || !(meters > 0)) return;
    this.local += meters;
    let guard = 0;
    for (;;) {
      const section = this.route.sections[this.section];
      if (this.local < section.length) break;
      const edge = section.outgoing[0];
      if (!edge || guard++ > this.route.sections.length * 2) {
        this.local = section.length;
        this.ended = true;
        break;
      }
      this.local -= section.length;
      this.completed = f32(this.completed + section.length);
      if (edge.section === this.route.firstSection || (edge.gate?.final && this.lap === this.laps)) this.lap += 1;
      this.section = edge.section;
      if (this.finished) {
        this.local = 0;
        break;
      }
    }
  }

  /** The kart's pose: position (offset across the road), heading basis and quaternion. */
  pose() {
    const section = this.route.sections[this.section];
    const frames = section.frames;
    const sums = this.cumulative[this.section];
    let index = 0;
    while (index + 2 < frames.length && sums[index + 1] <= this.local) index++;
    const from = frames[index];
    const to = frames[Math.min(index + 1, frames.length - 1)];
    const span = (sums[index + 1] ?? sums[index]) - sums[index];
    const t = span > 1e-6 ? Math.min(1, Math.max(0, (this.local - sums[index]) / span)) : 0;
    const center = add(from.position, scale(sub(to.position, from.position), t));
    const heading = unit(sub(to.position, from.position), from.forward);
    const basis = routeBasis(heading);
    return { position: add(center, scale(basis.right, this.offset)), ...basis };
  }
}

/* ---------- items on the bot ---------- */

/**
 * When an item used on the bot reaches it, from the use's startAt (ms):
 * the tracking eta, or the item's warning and delay states (ITEM_MODE.md
 * appendix B timelines).
 */
export function hitDelayMs(data, used) {
  const life = state => itemLife(data, used.itemId, state);
  switch (used.itemId) {
    case ITEM.devil: return life("Use") + life("Preaffect");
    case ITEM.thunderbolt: return life("Use") + life("Warning") + life("Preaffect");
    case ITEM.cloud2: return life("Use");
    case ITEM.slotLock: return life("Use");
    default: return ITEM_RULES[used.itemId]?.speed ? used.etaMs : life("Use");
  }
}

/**
 * The hit reports of a use on the bot: one per missile ({shot} for a double
 * rocket, used.count 2; the second arrives 200 ms after the first,
 * ITEM_MODE.md C.2), as [{delayMs, shot?}] from the first arrival.
 */
export function shotsOf(used) {
  return used.count === 2 ? [{ delayMs: 0, shot: 0 }, { delayMs: 200, shot: 1 }] : [{ delayMs: 0 }];
}

/**
 * The bot's hit report for an item: result "hit", or "blocked" by the
 * defence `defend` ("shield"/"angel") when that defence blocks the item.
 */
export function hitReport(idx, defend) {
  const blocks = ITEM_RULES[idx]?.blocks ?? [];
  return defend !== "hit" && blocks.includes(defend) ? { result: "blocked", by: defend } : { result: "hit" };
}

/**
 * How a hit holds up the route-driving bot: for `ms` it drives at
 * `factor` of its speed (spins, traps, launches and barriers stop it; the
 * UFO slows it to 40 %, the thunderbolt to 50 %; ITEM_MODE.md appendix B).
 * The devil, cloud and slot lock do not change its driving.
 */
export function hitEffect(data, idx) {
  const affect = (item = idx) => itemLife(data, item, "Affect");
  switch (idx) {
    case ITEM.banana: return { ms: affect(), factor: 0 };
    case ITEM.waterFly: case ITEM.waterBomb: case ITEM.timeBomb: return { ms: affect(), factor: 0 };
    case ITEM.rocket: case ITEM.guideRocket: case ITEM.randomRocket: return { ms: affect(), factor: 0 };
    case ITEM.mine: return { ms: affect(ITEM.rocket), factor: 0 };
    case ITEM.waterMine: return { ms: affect(ITEM.waterBomb), factor: 0 };
    case ITEM.barricade: return { ms: itemLife(data, ITEM.barricade, "StateAffect"), factor: 0 };
    case ITEM.ufo: return { ms: affect(), factor: 0.4 };
    case ITEM.thunderbolt: return { ms: affect(), factor: 0.5 };
    default: return undefined;
  }
}

/**
 * Area items the bot can run into (ITEM_MODE.md appendix B): radius (m),
 * when they are live from the use's startAt (ms).
 */
export const AREA_ITEMS = Object.freeze({
  [ITEM.banana]: { radius: 2.0, from: data => itemLife(data, ITEM.banana, "Use"),
    until: data => itemLife(data, ITEM.banana, "Use") + itemLife(data, ITEM.banana, "Set") },
  [ITEM.waterBomb]: { radius: 10, from: data => itemLife(data, ITEM.waterBomb, "Use"),
    until: data => itemLife(data, ITEM.waterBomb, "Use") + itemLife(data, ITEM.waterBomb, "Set") },
  [ITEM.timeBomb]: { radius: 15, from: data => itemLife(data, ITEM.timeBomb, "Use"),
    until: data => itemLife(data, ITEM.timeBomb, "Use") + itemLife(data, ITEM.timeBomb, "Set") },
  [ITEM.barricade]: { radius: 4.3, from: data => itemLife(data, ITEM.barricade, "StateUse"),
    until: data => itemLife(data, ITEM.barricade, "StateUse") + itemLife(data, ITEM.barricade, "StateActive") },
});

/**
 * Protocol points are client z-up coordinates (rewrite/src/item/item-race-rules.ts
 * threeToClient / clientToThreePoint); the bot works in three.js coordinates.
 */
export const threeToClient = point => ({ x: point.x, y: -point.z || 0, z: point.y });
export const clientToThree = point => ({ x: point.x, y: point.z, z: -point.y || 0 });

/** Three.js distance between two points. */
export const distanceBetween = (a, b) => lengthOf(sub(a, b));

/**
 * The point an item is thrown to or dropped at from a pose (three.js
 * coordinates; convert with threeToClient before sending): a banana 4 m behind the kart, a water bomb
 * where the kart will be in 1 s plus 20 m ahead, a barricade 70 m ahead of
 * its target, a time bomb where the kart is (ITEM_MODE.md appendix B).
 */
export function itemPoint(idx, pose, speed) {
  const ahead = meters => add(pose.position, scale(pose.forward, meters));
  switch (idx) {
    case ITEM.banana: return ahead(-4);
    case ITEM.waterBomb: return ahead(speed * 1 + 20);
    case ITEM.barricade: return ahead(70);
    default: return { ...pose.position };
  }
}
