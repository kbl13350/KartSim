// Item race (道具赛, rewrite/ITEM_MODE.md) helpers shared by the end-to-end
// scripts: ../../../server-special-smoke.mjs (the item scenarios) and
// ../item-bot.mjs (the test bot for manual browser testing).
//
// - The item data the game node runs (server-go/internal/game/itemmode/
//   itemmode.json): probability tables, item names, tracks and pools.
// - The node's race clock (`clock` round trips; every race time, startAt
//   included, is on it) and motion ticks on it, as the browser's
//   MotionClockMapping produces them.
// - Binary motion frames built with the browser's own codec
//   (rewrite/src/multiplayer/payload.ts GameMotionEncoder, passed in by the
//   caller through tsx): kind 10 kinematic samples with race progress, like
//   OutgoingRaceMotionSender sends in a non-ordinary race.
// - ItemChannel: the racer's `item` requests with the strict per-racer
//   sequence, checked with the browser's request validator
//   (protocol.ts isValidItemRequest) and paced below the node's text rate
//   limit (30/s per connection).
//
// No npm packages here; callers load the browser modules with tsx and pass
// them in.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const ITEM_DATA_PATH = join(repoRoot, "server-go/internal/game/itemmode/itemmode.json");

/** Item indices (ITEM_MODE.md appendix B; server-go/internal/game/itemmode/items.go). */
export const ITEM = Object.freeze({
  devil: 2, ufo: 3, waterFly: 4, magnet: 5, booster: 6, rocket: 7, banana: 8, waterBomb: 9,
  shield: 10, angel: 11, emp: 12, timeBomb: 13, mine: 17, drrMine: 23, guideRocket: 33, waterMine: 37,
  scanning: 109, slotLock: 110, thunderbolt: 111, barricade: 113, cloud2: 114, randomRocket: 127,
});
/** Item names by idx: the table items above, and every special item of itemmode.json (C.4). */
export const ITEM_NAMES = Object.freeze(Object.fromEntries([
  ...JSON.parse(readFileSync(ITEM_DATA_PATH, "utf8")).items.map(item => [item.idx, item.name]),
  ...Object.entries(ITEM).map(([name, idx]) => [idx, name]),
]));

/**
 * How the server picks each item's targets and who may report a hit
 * (items.go rules, ITEM_MODE.md appendix B).
 */
export const ITEM_RULES = Object.freeze({
  [ITEM.booster]: { target: "self" },
  [ITEM.banana]: { target: "area", point: true, hit: "anyone", blocks: ["shield", "angel"] },
  [ITEM.waterBomb]: { target: "area", point: true, hit: "opponents", blocks: ["angel"] },
  [ITEM.waterFly]: { target: "aheadOne", speed: 60, hit: "targets", blocks: ["shield", "angel"] },
  [ITEM.rocket]: { target: "aimed", speed: 100, hit: "targets", blocks: ["shield", "angel"] },
  [ITEM.guideRocket]: { target: "leader", speed: 100, hit: "targets", blocks: ["shield", "angel"] },
  [ITEM.randomRocket]: { target: "randomAhead", speed: 100, hit: "targets", blocks: ["shield", "angel"] },
  [ITEM.magnet]: { target: "aimed" },
  [ITEM.shield]: { target: "self" },
  [ITEM.angel]: { target: "ownTeam" },
  [ITEM.devil]: { target: "allOpponents", hit: "targets", blocks: [] },
  // A transform@zz destination: a devil drawn on a reverse track of level 0/2/3/4.
  [ITEM.drrMine]: { target: "allOpponents", hit: "targets", blocks: [] },
  // Neither the shield nor the angel blocks a UFO; only an EMP cures it (C.1, C.5).
  [ITEM.ufo]: { target: "leader", speed: 60, hit: "targets", blocks: [] },
  // The EMP takes the user's team members under a UFO slow when it takes effect.
  [ITEM.emp]: { target: "ufoSlowed" },
  [ITEM.thunderbolt]: { target: "allAhead", hit: "targets", blocks: ["angel"] },
  [ITEM.barricade]: { target: "leader", place: "target", hit: "opponents", blocks: ["shield", "angel"] },
  [ITEM.cloud2]: { target: "allBehind", hit: "targets", blocks: [] },
  [ITEM.scanning]: { target: "ownTeam" },
  [ITEM.slotLock]: { target: "allOpponents", hit: "targets", blocks: [] },
  [ITEM.timeBomb]: { target: "area", place: "user", hit: "anyone", blocks: ["angel"] },
});

/** The node's item data (itemmode.json). */
export function loadItemData(path = ITEM_DATA_PATH) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  assert.ok(data.tables?.indi && data.tables?.team && Array.isArray(data.tracks), `${path} is not item data`);
  return data;
}

/** The base-0 life (ms) of an item.bml state, 0 when the item has none. */
export function itemLife(data, idx, state) {
  return data.items.find(item => item.idx === idx)?.states?.[state] ?? 0;
}

/**
 * The rank group of a 1-based rank among `racers` (itemmode.GroupOf,
 * ITEM_MODE.md 4): 1st is top; any other rank r has p = (r-2)/(N-1) and is
 * high below 1/3, mid below 2/3, low otherwise.
 */
export function rankGroup(rank, racers) {
  if (rank <= 1 || racers <= 1) return "top";
  const scaled = 3 * (rank - 2);
  const span = racers - 1;
  return scaled < span ? "high" : scaled < 2 * span ? "mid" : "low";
}

/** The weight of an item in a rank group of table "indi" or "team" (0 when it cannot be drawn). */
export function groupWeight(data, table, idx, group) {
  return data.tables[table].items.find(item => item.idx === idx)?.[group] ?? 0;
}

/**
 * The targets the server must pick for a use (itemmode targets()):
 * `standings` are the racing player IDs best first, `teams` maps player ID →
 * team (0 in an individual race), `aimed` is the targetId sent.
 */
export function expectedTargets(idx, user, standings, teams, aimed) {
  const mates = (a, b) => a === b || (teams[a] !== 0 && teams[a] === teams[b]);
  const position = standings.indexOf(user);
  const opponents = (from, to) => standings.slice(from, to).filter(id => !mates(user, id));
  switch (ITEM_RULES[idx]?.target) {
    case "self": return [user];
    case "ownTeam": return [user, ...standings.filter(id => id !== user && mates(user, id))];
    case "aheadOne": return opponents(0, position).slice(-1);
    case "leader": return opponents(0, standings.length).slice(0, 1);
    case "randomAhead": return opponents(0, position); // one of these (or none)
    case "allAhead": return opponents(0, position);
    case "allBehind": return opponents(position + 1, standings.length);
    case "allOpponents": return opponents(0, standings.length);
    case "aimed": return aimed ? [aimed] : [];
    // ufoSlowed: nobody unless a teammate reported a UFO hit (callers that
    // report one work out the cure themselves).
    default: return [];
  }
}

/**
 * Whether a cube grant of `idx` fits the racer's rank group `group` of
 * `table`: an item with weight there, or the transform@zz destination of
 * one on this track (a time bomb is a water bomb on level-0/1 tracks; a
 * devil is Dr. R on reverse tracks of level 0/2/3/4). The starter practice
 * kart has no per-kart transforms.
 */
export function grantable(data, table, idx, group, trackId) {
  if (groupWeight(data, table, idx, group) > 0) return true;
  const track = data.tracks.find(entry => entry.id === trackId);
  return Boolean(track) && data.trackTransforms.some(row => row.dst === idx && row.level === track.level &&
    (!row.reverse || track.reverse) && groupWeight(data, table, row.src, group) > 0);
}

/** The track transform destination of a drawn `idx` on `trackId`, or idx itself. */
export function transformedOnTrack(data, idx, trackId) {
  const track = data.tracks.find(entry => entry.id === trackId);
  const row = track && data.trackTransforms.find(entry => entry.src === idx && entry.level === track.level &&
    (!entry.reverse || track.reverse));
  return row ? row.dst : idx;
}

/* ---------- the browser's event validators ---------- */

/** Channels of the browser's room tables (generated formats.js He / W6, room-validation.ts). */
export const CHANNEL_RULES = Object.freeze({
  speedIndiCombine: { mode: "individual", speed: 7 },
  speedTeamCombine: { mode: "team", speed: 7 },
  speedIndiInfinit: { mode: "individual", speed: 4 },
  speedTeamInfinit: { mode: "team", speed: 4 },
  itemIndiCombine: { mode: "individual", speed: 7 },
  itemTeamCombine: { mode: "team", speed: 7 },
});
const ITEM_CHANNELS = new Set(["itemIndiCombine", "itemTeamCombine"]);
const RANDOM_TRACK_CODES = new Set([0, 3, 4, 5, 6, 7, 8, 30, 40]);

/**
 * The ServerEventValidation the browser passes to parseServerEvent
 * (server-events.ts) for room lists: generated W6 channels and To gameplay
 * rules (item channels carry only gameplay item, on p3553), with
 * room-validation.ts isValidRoomSnapshot for snapshots.
 */
export function browserEventValidation(isValidRoomSnapshot) {
  return {
    validRoom: isValidRoomSnapshot,
    validChannel: (channel, mode, speed) =>
      Object.hasOwn(CHANNEL_RULES, channel) && CHANNEL_RULES[channel].mode === mode &&
      CHANNEL_RULES[channel].speed === speed,
    validGameplay: (gameplay, channel, version) => {
      if (ITEM_CHANNELS.has(channel) || gameplay === "item")
        return gameplay === "item" && ITEM_CHANNELS.has(channel) && version === "p3553";
      if (gameplay === undefined || gameplay === "ordinary") return true;
      if (version !== "p3553" || !Object.hasOwn(CHANNEL_RULES, channel)) return false;
      if (gameplay === "roadblock" || gameplay === "giant") return channel === "speedIndiCombine";
      if (gameplay === "rp" || gameplay === "shadow") return true;
      return (gameplay === "lte" || gameplay === "grip") && CHANNEL_RULES[channel].speed === 7;
    },
    validRandomTrackCode: code => RANDOM_TRACK_CODES.has(code),
  };
}

/**
 * Whether the browser accepts a server event. An invalid item event does
 * not close the browser's connection: parseServerEvent turns it into an
 * INVALID_ITEM_EVENT error, which counts as a rejection here.
 */
export function browserAccepts(parseServerEvent, validation, message) {
  const parsed = parseServerEvent(message, validation);
  return parsed !== undefined && !(message?.type === "item" && parsed.type === "error");
}

/* ---------- clock ---------- */

/**
 * The node's race clock as seen from this process: `clock` round trips give
 * the offset between performance.now() and the node's monotonic
 * milliseconds (startAt, finishDeadline and every item time are on it).
 */
export class ServerClock {
  constructor(offsetMs) {
    this.offsetMs = offsetMs;
  }

  /** Best of `samples` round trips (smallest round trip wins), like the browser's ClockSynchronizer. */
  static async sync(control, samples = 5) {
    let best;
    for (let index = 0; index < samples; index++) {
      const sentAt = performance.now();
      const reply = await control.request({ type: "clock", clientTick: Math.trunc(sentAt) });
      const receivedAt = performance.now();
      assert.ok(Number.isFinite(reply.serverTick), `clock reply without serverTick: ${JSON.stringify(reply)}`);
      const rtt = receivedAt - sentAt;
      if (!best || rtt < best.rtt) best = { rtt, offset: reply.serverTick - (sentAt + receivedAt) / 2 };
    }
    return new ServerClock(best.offset);
  }

  /** The node's current time (ms). */
  now() {
    return performance.now() + this.offsetMs;
  }

  /** A motion sample tick (uint32 node milliseconds, MotionClockMapping.encode). */
  tick(at = this.now()) {
    return Math.trunc(at) >>> 0;
  }

  /** Waits until the node's clock reaches `at`. */
  async until(at) {
    const wait = at - this.now();
    if (wait > 0) await delay(wait);
  }
}

/* ---------- motion ---------- */

const f32 = Math.fround;

/** A three.js world vector (y up) as the wire's client coordinates (z up), outgoing-race-motion.ts wireVector. */
export function wireVector(vector) {
  return [f32(vector.x), f32(-vector.z), f32(vector.y)];
}

/**
 * The kind 10 kinematic sample a browser racer sends in a special-mode race
 * (OutgoingRaceMotionSender with presentation, progress, collision, routing
 * and visual scale). `pose` holds three.js world vectors: position,
 * velocity (m/s) and, optionally, quaternion [w, x, y, z] of the body
 * (world.js PL); `progress` is {distance, lap, finishElapsedMs?}.
 */
export function kartSample({ tick, pose, progress, observedPlayerId, speedKmh = 0,
  collisionActive = true }) {
  const velocity = pose.velocity ?? { x: 0, y: 0, z: 0 };
  const forwardSpeed = Math.hypot(velocity.x, velocity.y, velocity.z);
  return {
    kind: "kinematic",
    tick,
    position: wireVector(pose.position),
    quaternion: pose.quaternion ?? [1, 0, 0, 0],
    linearVelocity: wireVector(velocity),
    angularVelocity: [0, 0, 0],
    vector5C: [0, 0, 0],
    vector68: [0, 0, 0],
    presentation: {
      forwardSpeed: f32(forwardSpeed), rawSteer: 0, tireTransient: 0, collisionStrength: 0,
      boosterState: 0, visualScaleMode: 0, frontLamp: false, rearLamp: false, motorcycle: false,
      instantAccelerationActive: false, landingSequence: 0, collisionSequence: 0,
      animation: {
        physicsState: 0, dualMode: 0, dualBoosterState: 0, dualTeam: false, chargerActive: false,
        displaySpeedKmh: f32(speedKmh || forwardSpeed * 3.6), dualReadyRemainingMs: 0,
      },
    },
    raceProgress: {
      distance: progress.distance, lap: progress.lap,
      ...(progress.finishElapsedMs === undefined ? {} : { finishElapsedMs: progress.finishElapsedMs }),
    },
    collision: { active: collisionActive, scaleX: 1, scaleY: 1 },
    routing: { motionMode: 0, observedPlayerId },
    visualScale: { x: 1, y: 1, z: 1 },
  };
}

/** The recipient mask of every other member of a room snapshot (by slot). */
export function othersMask(room, playerId) {
  return room.members.filter(member => member.playerId !== playerId)
    .reduce((mask, member) => mask | (1 << member.slot), 0);
}

/**
 * Sends one racer's motion frames every `intervalMs` (the browser sends one
 * per 64 ms bucket) until stop(). `sample(nodeNow)` returns the kinematic
 * sample to send (its tick is filled in) or undefined to skip a beat;
 * `encoder` is a browser GameMotionEncoder for the racer's identity.
 */
export class MotionPump {
  constructor({ socket, encoder, clock, sample, mask, intervalMs = 64 }) {
    Object.assign(this, { socket, encoder, clock, sample, mask, intervalMs });
    this.sequence = 0;
    this.sent = 0;
    this.timer = undefined;
    this.error = undefined;
  }

  start() {
    if (this.timer) return this;
    const beat = () => {
      try {
        const now = this.clock.now();
        const sample = this.sample(now);
        if (!sample || this.socket.readyState !== 1) return;
        const mask = typeof this.mask === "function" ? this.mask() : this.mask;
        this.socket.send(this.encoder.encode({ ...sample, tick: this.clock.tick(now) }, ++this.sequence >>> 0, mask));
        this.sent++;
      } catch (error) {
        this.error ??= error;
        this.stop();
      }
    };
    beat();
    this.timer = setInterval(beat, this.intervalMs);
    return this;
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Throws the first error a beat ran into. */
  check() {
    if (this.error) throw this.error;
  }
}

/**
 * Collects the binary motion frames a socket receives, decoded with the
 * browser's GameMotionDecoder (`decoder`); invalid frames are counted.
 */
export class MotionInbox {
  constructor(socket, decoder) {
    this.frames = [];
    this.invalid = 0;
    this.latest = new Map();
    socket.binaryType = "arraybuffer";
    socket.addEventListener("message", event => {
      if (typeof event.data === "string") return;
      const decoded = decoder.decode(new Uint8Array(event.data));
      if (!decoded) { this.invalid++; return; }
      this.frames.push(decoded);
      this.latest.set(decoded.playerId, decoded);
      for (const listener of this.listeners) listener(decoded);
    });
    this.listeners = new Set();
  }

  /** Calls `listener(decoded)` for every later frame; returns the unsubscribe function. */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/* ---------- item requests ---------- */

/** Rejections the node returns before it checks (and uses up) the sequence. */
export const CHECKED_BEFORE_SEQUENCE = new Set(["INVALID_SEQUENCE", "ITEM_UNAVAILABLE", "NOT_RACE_PARTICIPANT",
  "RACE_NOT_FOUND", "NOT_IN_ROOM", "NOT_ROOM_MEMBER", "ROOM_NOT_FOUND", "INVALID_ROOMID", "INVALID_RACEID",
  "RATE_LIMITED"]);

/**
 * One racer's `item` requests in one race. Every request carries the next
 * sequence number (a sequence the server accepted is used up even when the
 * request is then rejected) and must pass the browser's isValidItemRequest
 * (`validRequest`). Requests are paced at `ratePerSecond`, under the node's
 * 30/s text limit.
 */
export class ItemChannel {
  constructor(control, { roomId, raceId, validRequest, ratePerSecond = 20, label = "racer" }) {
    Object.assign(this, { control, roomId, raceId, validRequest, label });
    this.sequence = 0;
    this.gapMs = 1000 / ratePerSecond;
    this.lastAt = 0;
    this.slots = undefined;
    /** The racer's changer cards from the last reply carrying them ({slot, item, itemArmed}). */
    this.changers = undefined;
    this.queue = Promise.resolve();
  }

  /**
   * Takes the slots and changers of a server push ({"action":"slots"}
   * without a sequence: the race start, a per-kart gain).
   */
  pushed(event) {
    if (event?.type !== "item" || event.raceId !== this.raceId || event.action !== "slots" ||
      event.sequence !== undefined) return;
    if (Array.isArray(event.slots)) this.slots = event.slots;
    if (event.changers) this.changers = event.changers;
  }

  /**
   * Sends {type:"item", action, ...fields}; returns the reply (an item event
   * or {type:"error", code}). Requests go out one at a time in call order,
   * so concurrent callers never share a sequence number. `sequence`
   * overrides the next number (to test INVALID_SEQUENCE). The number is used
   * up unless the server rejected the request before checking it
   * (CHECKED_BEFORE_SEQUENCE); RACE_NOT_RUNNING comes both before (racer not
   * loaded: pass consumed false) and after it (race not started yet: the
   * default).
   */
  send(action, fields = {}, options = {}) {
    const sent = this.queue.then(() => this.sendNow(action, fields, options));
    this.queue = sent.catch(() => {});
    return sent;
  }

  async sendNow(action, fields, { sequence, consumed } = {}) {
    const wait = this.lastAt + this.gapMs - performance.now();
    if (wait > 0) await delay(wait);
    this.lastAt = performance.now();
    const number = sequence ?? this.sequence + 1;
    const request = { type: "item", roomId: this.roomId, raceId: this.raceId, sequence: number, action, ...fields };
    assert.ok(this.validRequest(request), `${this.label}: the browser would not send ${JSON.stringify(request)}`);
    const reply = await this.control.send(request);
    const used = consumed ?? !(reply.type === "error" && CHECKED_BEFORE_SEQUENCE.has(reply.code));
    if (used && number === this.sequence + 1) this.sequence = number;
    if (reply.type === "item" && Array.isArray(reply.slots)) this.slots = reply.slots;
    if (reply.type === "item" && reply.changers) this.changers = reply.changers;
    return reply;
  }

  /** send() that must succeed with an item reply of `action`. */
  async request(action, fields = {}) {
    const reply = await this.send(action, fields);
    assert.equal(reply.type, "item", `${this.label}: item ${action} ${JSON.stringify(fields)} failed: ` +
      `${reply.code ?? JSON.stringify(reply)}`);
    return reply;
  }

  /** send() that must fail with `code`. */
  async expectError(action, fields, code, options) {
    const reply = await this.send(action, fields, options);
    assert.equal(reply.type, "error", `${this.label}: item ${action} should fail with ${code}, got ` +
      JSON.stringify(reply));
    assert.equal(reply.code, code, `${this.label}: item ${action} failed with ${reply.code}, expected ${code}`);
    return reply;
  }
}
