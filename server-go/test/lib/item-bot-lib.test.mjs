// Unit checks for the item test bot's pure parts; no services needed. The
// checks against the browser's own modules (start slots, kart basis and
// quaternion, motion codec) load them through tsx and are skipped without
// `npm ci` in rewrite/.
//   node --test test/lib/item-bot-lib.test.mjs        (from server-go/)
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  AREA_ITEMS, distanceBetween, hitDelayMs, hitEffect, hitReport, itemIndex, itemPoint, parseArgs, parseShift,
  parseUseSchedule, protocol40Frame, quaternionFromMatrix, readAccount, RECORDER_SNIPPET, recordedRace, routeBasis,
  RouteWalker, shotsOf, slotOffset,
} from "./item-bot-lib.mjs";
import { ITEM, loadItemData, repoRoot } from "./item-race.mjs";

const haveTsx = existsSync(join(repoRoot, "rewrite/node_modules/tsx/dist/esm/api/index.mjs"));
const browser = async specifier => {
  const { tsImport } = await import(join(repoRoot, "rewrite/node_modules/tsx/dist/esm/api/index.mjs"));
  return tsImport(join(repoRoot, specifier), import.meta.url);
};
const data = loadItemData();

test("options: defaults, values and refusals", () => {
  const defaults = parseArgs([], {});
  assert.deepEqual([defaults.room, defaults.speed, defaults.defend, defaults.dataOrigin, defaults.index,
    defaults.accounts, defaults.shift, defaults.use, defaults.once],
  ["only", 25, "hit", "http://127.0.0.1:8787", 0, "server-go/data/dev-test-accounts.json", "auto", [], false]);
  assert.equal(parseArgs([], { KART_DATA_ORIGIN: "http://h:1/" }).dataOrigin, "http://h:1");
  const options = parseArgs(["--room", "r1", "--speed=40", "--team", "2", "--use", "devil@25s,rocket@20s",
    "--defend", "shield", "--once", "--shift", "1,2,3", "--account", "bob"]);
  assert.deepEqual([options.room, options.speed, options.team, options.defend, options.once, options.shift,
    options.account], ["r1", 40, 2, "shield", true, { x: 1, y: 2, z: 3 }, "bob"]);
  assert.deepEqual(options.use.map(entry => [entry.name, entry.atMs]), [["rocket", 20_000], ["devil", 25_000]]);
  for (const argv of [["--speed", "200"], ["--team", "3"], ["--defend", "dodge"], ["--nope"], ["stray"],
    ["--room"], ["--once=1"], ["--shift", "1,2"]]) {
    assert.throws(() => parseArgs(argv, {}), Error, argv.join(" "));
  }
  assert.deepEqual(parseShift("0"), { x: 0, y: 0, z: 0 });
  assert.equal(defaults.perfectStart, false);
  assert.equal(parseArgs(["--perfect-start"], {}).perfectStart, true);
});

test("a double rocket is reported missile by missile", () => {
  assert.deepEqual(shotsOf({ count: 2 }), [{ delayMs: 0, shot: 0 }, { delayMs: 200, shot: 1 }]);
  assert.deepEqual(shotsOf({}), [{ delayMs: 0 }]);
});

test("--use: item names, aliases, indices and times", () => {
  assert.deepEqual(parseUseSchedule("banana@1.5s, 7@500ms ,cloud@2"), [
    { idx: ITEM.rocket, name: "rocket", atMs: 500 },
    { idx: ITEM.banana, name: "banana", atMs: 1500 },
    { idx: ITEM.cloud2, name: "cloud2", atMs: 2000 },
  ]);
  assert.equal(itemIndex("GuideRocket"), ITEM.guideRocket);
  assert.equal(itemIndex("lock"), ITEM.slotLock);
  assert.deepEqual(parseUseSchedule(""), []);
  assert.throws(() => itemIndex("mine"), /unknown item/); // a track hazard, never in a slot
  assert.throws(() => parseUseSchedule("rocket"), /rocket@20s/);
  assert.throws(() => parseUseSchedule("rocket@soon"), /rocket@20s/);
});

test("accounts: one, many or {accounts}; never the password in errors", () => {
  const files = {
    one: JSON.stringify({ username: "solo", password: "s3cret-one" }),
    many: JSON.stringify([{ username: "a", password: "s3cret-a", nickname: "Ann" },
      { username: "b", password: "s3cret-b" }]),
    nested: JSON.stringify({ accounts: [{ username: "c", password: "s3cret-c" }] }),
    broken: "{",
    empty: JSON.stringify([{ username: "x" }]),
  };
  const read = file => files[file];
  assert.deepEqual(readAccount("one", {}, read), { username: "solo", password: "s3cret-one" });
  assert.equal(readAccount("many", { index: 1 }, read).username, "b");
  assert.equal(readAccount("many", { account: "Ann" }, read).username, "a");
  assert.equal(readAccount("nested", {}, read).username, "c");
  for (const [file, options] of [["many", { account: "zed" }], ["many", { index: 5 }], ["broken", {}], ["empty", {}]]) {
    assert.throws(() => readAccount(file, options, read), error => !/s3cret/.test(error.message));
  }
});

test("start slots alternate 2 m right and left of the start, like the browser", async t => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(slotOffset), [0, -2, 2, -4, 4, -6, 6, -8]);
  if (!haveTsx) return t.skip("rewrite/node_modules missing");
  const { raceStartPosition } = await browser("rewrite/src/vehicle/race-start-slots.ts");
  for (let slot = 0; slot < 8; slot++) {
    const placed = raceStartPosition({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, slot, () => undefined);
    assert.equal(placed.x, slotOffset(slot), `slot ${slot}`);
  }
});

test("kart basis and quaternion on a route frame match the browser's reset and motion quaternion", async t => {
  // The browser's body "right" of a kart heading -z is -x: start slots on the
  // negative side (odd slots) are placed at +x.
  const level = routeBasis({ x: 0, y: 0, z: -1 });
  const plain = vector => Object.values(vector).map(value => value + 0); // -0 → 0
  assert.deepEqual([level.right, level.forward, level.up].map(plain), [[-1, 0, 0], [0, 0, -1], [0, 1, 0]]);
  assert.ok(Math.abs(Math.hypot(...level.quaternion) - 1) < 1e-6);
  if (!haveTsx) return t.skip("rewrite/node_modules missing");
  const { resetVehicleFromRoute } = await browser("rewrite/src/driving/reset-runtime.ts");
  const orientation = await browser("rewrite/src/driving/orientation-math.ts");
  const headings = [{ x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }, { x: -0.6, y: 0.1, z: 0.79 },
    { x: 0.3, y: -0.2, z: -0.93 }, { x: -1, y: 0, z: 0.001 }, { x: 0, y: 0, z: 1 }];
  for (const heading of headings) {
    const body = {};
    resetVehicleFromRoute({ body, reset() {}, syncPresentationFields() {} },
      { position: { x: 0, y: 0, z: 0 }, forward: heading });
    const basis = routeBasis(heading);
    for (const axis of ["right", "forward", "up"]) {
      for (const component of ["x", "y", "z"]) {
        assert.ok(Math.abs(basis[axis][component] - body[axis][component]) < 1e-5,
          `${JSON.stringify(heading)} ${axis}.${component}: ${basis[axis][component]} vs ${body[axis][component]}`);
      }
    }
    // world.js PL = IL(RL(body)): orientation-math quaternionFromMatrix(bodyBasisMatrix(body)).
    const q = orientation.quaternionFromMatrix(orientation.bodyBasisMatrix(body));
    const expected = [q.w, q.x, q.y, q.z];
    basis.quaternion.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-5,
      `${JSON.stringify(heading)} q[${index}] ${value} vs ${expected[index]}`));
    const matrix = orientation.bodyBasisMatrix(body);
    assert.deepEqual(quaternionFromMatrix(matrix), expected);
  }
});

/** A loop of two straight sections (60 m and 40 m) along -z, then back. */
function loopCourse({ finalGate = false, open = false } = {}) {
  const frames = (from, to, step) => {
    const list = [];
    for (let z = from; step > 0 ? z <= to : z >= to; z += step) {
      list.push({ position: { x: 0, y: 0, z }, forward: { x: 0, y: 0, z: Math.sign(step) }, up: { x: 0, y: 1, z: 0 } });
    }
    return list;
  };
  const sections = [
    { frames: frames(0, -60, -10), length: 60, outgoing: open ? [] : [{ section: 1, gate: {} }] },
    { frames: frames(-60, -100, -10), length: 40, outgoing: [{ section: 0, gate: { final: finalGate } }] },
  ];
  return { sections, firstSection: 0, lastSection: 1,
    start: { position: { x: 0, y: 0, z: -100 }, forward: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 } } };
}
/** world/route.ts projectSectionDistance for the straight test sections. */
const project = (position, section) => Math.min(section.length,
  Math.max(0, Math.abs(position.z - section.frames[0].position.z)));

test("the route walker counts distance and laps like the browser's route state", () => {
  const walker = new RouteWalker(loopCourse(), { laps: 2, offset: -2, project });
  // The start frame ends the last section: distance 0, lap 0.
  assert.deepEqual([walker.distance, walker.lap, walker.section], [0, 0, 1]);
  assert.deepEqual(walker.pose().position, { x: 2, y: 0, z: -100 });
  walker.advance(25);
  assert.deepEqual([walker.distance, walker.lap, walker.section], [25, 1, 0]);
  assert.deepEqual(walker.pose().position, { x: 2, y: 0, z: -25 });
  assert.deepEqual(walker.pose().forward, { x: 0, y: 0, z: -1 });
  walker.advance(70); // 95: on the second section
  assert.deepEqual([walker.distance, walker.lap, walker.section], [95, 1, 1]);
  assert.equal(walker.finished, false);
  walker.advance(104); // 199: lap 2 runs 100..200
  assert.deepEqual([Math.round(walker.distance), walker.lap, walker.finished], [199, 2, false]);
  walker.advance(5);
  assert.equal(walker.lap, 3);
  assert.equal(walker.finished, true);
  assert.equal(walker.distance, 200);
  walker.advance(50);
  assert.equal(walker.distance, 200, "a finished kart stays at the line");
});

test("the route walker ends on a course with no way on, and counts a final gate on the last lap", () => {
  const open = new RouteWalker(loopCourse({ open: true }), { laps: 3, project });
  open.advance(500);
  assert.deepEqual([open.finished, open.lap, open.distance], [true, 1, 60]);
  // A one-lap course whose last edge is a final gate: entering the first
  // section is lap 1, the final gate on lap 1 finishes.
  const sprint = new RouteWalker(loopCourse({ finalGate: true }), { laps: 1, project });
  sprint.advance(99);
  assert.deepEqual([sprint.lap, sprint.finished], [1, false]);
  sprint.advance(2);
  assert.deepEqual([sprint.lap, sprint.finished, sprint.distance], [2, true, 100]);
});

/** Base64 motion frames, as the browser recorder snippet stores them. */
async function recorded(encoder, samples) {
  return samples.map((sample, index) => Buffer.from(encoder.encode(sample, index + 1)).toString("base64"));
}

test("recordings: the longest race, decoded, from the moment the kart moved", async t => {
  assert.match(RECORDER_SNIPPET, /bytes\[0\] >= 1 && bytes\[0\] <= 10/); // protocol 40: the kind comes first
  assert.match(RECORDER_SNIPPET, /RTCDataChannel\.prototype/);
  if (!haveTsx) return t.skip("rewrite/node_modules missing");
  const payload = await browser("rewrite/src/multiplayer/payload.ts");
  const { kartSample } = await import("./item-race.mjs");
  const sample = (tick, speed) => kartSample({ tick, observedSlot: 2,
    pose: { position: { x: 0, y: 0, z: -tick / 100 }, velocity: { x: 0, y: 0, z: -speed } },
    progress: { distance: tick / 100, lap: 1 } });
  const encoder = raceId => new payload.GameMotionEncoder({ raceId, slot: 2 });
  const long = await recorded(encoder("aa000000-0000-4000-8000-0000000000aa"),
    [sample(1000, 0), sample(1064, 0), sample(1128, 5), sample(1192, 10)]);
  const short = await recorded(encoder("bb000000-0000-4000-8000-0000000000bb"), [sample(9000, 3)]);
  // A later race with the same tag starts its sequence over.
  const again = await recorded(encoder("aa111111-0000-4000-8000-0000000000aa"), [sample(500, 1), sample(564, 1)]);
  const race = recordedRace({ version: 2, frames: [...short, ...long, long[3], ...again, "AAAA"] },
    new payload.GameMotionDecoder());
  assert.deepEqual([race.samples.length, race.races, race.invalid, race.startTick], [4, 3, 1, 1028]);
  assert.equal(recordedRace({ frames: long, startTick: 1100 }, new payload.GameMotionDecoder()).startTick, 1100);
  assert.throws(() => recordedRace({ frames: [] }, new payload.GameMotionDecoder()), /no frames/);
});

test("recordings: version 1 frames (the release's 56-byte header) are converted", async t => {
  if (!haveTsx) return t.skip("rewrite/node_modules missing");
  const payload = await browser("rewrite/src/multiplayer/payload.ts");
  const { kartSample } = await import("./item-race.mjs");
  const sample = kartSample({ tick: 4000, observedSlot: 0, pose: { position: { x: 0, y: 0, z: -40 } },
    progress: { distance: 40, lap: 1 } });
  const current = new payload.GameMotionEncoder({ raceId: "cc000000-0000-4000-8000-0000000000cc", slot: 0 })
    .encode(sample, 9, 4);
  // The release's layout of the same frame: magic, kind, mask, three UUIDs, sequence, a 16-byte observed UUID.
  const body = current.subarray(8);
  const release = new Uint8Array(56 + body.length + 15);
  release.set([0x4d, 0x4b, current[0], current[1]]);
  release.set([0xcc], 20);
  release.set(current.subarray(4, 8), 52);
  release.set(body.subarray(0, 150), 56);
  release.set(body.subarray(151), 56 + 166);
  assert.deepEqual([...protocol40Frame(release)], [...current.slice(0, 2), 0, 0xcc, ...current.subarray(4)]);
  assert.equal(protocol40Frame(current), current);
  const race = recordedRace({ version: 1, frames: [Buffer.from(release).toString("base64")] },
    new payload.GameMotionDecoder());
  assert.deepEqual([race.samples.length, race.invalid, race.samples[0].raceProgress.distance], [1, 0, 40]);
});

test("items on the bot: arrival, report, hold-up and points", () => {
  assert.equal(hitDelayMs(data, { itemId: ITEM.rocket, etaMs: 700 }), 700);
  assert.equal(hitDelayMs(data, { itemId: ITEM.devil, etaMs: 0 }), 1500);
  assert.equal(hitDelayMs(data, { itemId: ITEM.thunderbolt, etaMs: 0 }), 2100);
  assert.equal(hitDelayMs(data, { itemId: ITEM.cloud2, etaMs: 0 }), 666);
  assert.equal(hitDelayMs(data, { itemId: ITEM.slotLock, etaMs: 0 }), 2000);
  assert.deepEqual(hitReport(ITEM.rocket, "shield"), { result: "blocked", by: "shield" });
  assert.deepEqual(hitReport(ITEM.waterBomb, "shield"), { result: "hit" }); // only the angel blocks it
  assert.deepEqual(hitReport(ITEM.devil, "angel"), { result: "hit" });
  assert.deepEqual(hitReport(ITEM.ufo, "hit"), { result: "hit" });
  assert.deepEqual(hitEffect(data, ITEM.rocket), { ms: 1500, factor: 0 });
  assert.deepEqual(hitEffect(data, ITEM.ufo), { ms: 3000, factor: 0.4 });
  assert.deepEqual(hitEffect(data, ITEM.barricade), { ms: 500, factor: 0 });
  assert.equal(hitEffect(data, ITEM.devil), undefined);
  assert.deepEqual([AREA_ITEMS[ITEM.banana].from(data), AREA_ITEMS[ITEM.banana].until(data)], [500, 30_500]);
  assert.deepEqual([AREA_ITEMS[ITEM.barricade].from(data), AREA_ITEMS[ITEM.barricade].until(data)], [1000, 6000]);
  const pose = { position: { x: 1, y: 2, z: 3 }, forward: { x: 0, y: 0, z: -1 } };
  assert.deepEqual(itemPoint(ITEM.banana, pose, 30), { x: 1, y: 2, z: 7 });
  assert.deepEqual(itemPoint(ITEM.waterBomb, pose, 30), { x: 1, y: 2, z: -47 });
  assert.deepEqual(itemPoint(ITEM.barricade, pose, 30), { x: 1, y: 2, z: -67 });
  assert.equal(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 5);
});
