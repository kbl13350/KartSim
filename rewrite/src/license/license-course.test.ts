import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inflateSync } from "node:zlib";

import { RhoReader } from "../codecs/rho";
import { y9, YW } from "../generated/formats.js";
import type { RhoArchiveIndex } from "../resources/archive-index";
import type { RouteSection, Vec3 } from "../world/route";
import { prepareCurrentSectionReset, resetRouteState, updateRoute } from "../world/route-state";
import { routeSurfaceKind, routeTagFamily } from "../world/route-tag";
import { alignLicenseFrames, alignLicenseSections, licenseEventScenes, markLicenseGoal } from "./license-course";
import { DRILL_HOLD_MS, DRILL_PROMPTS, KeyDrill, licenseSceneNames, type DrillInput } from "./license-mission";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** The 20 courses only the 驾照考试 uses (none is in track@zz.bml). */
const LICENSE_COURSES = [
  "village_C005", "village_C107", "village_C108", "village_C110", "village_C114", "village_C115",
  "village_C116", "village_L01_02", "village_L01_04", "village_L02_01", "village_L02_03",
  "village_L03_01", "village_L03_02", "village_L03_03_short", "village_L03_04", "village_L04_01",
  "village_L04_02", "village_L04_03", "village_L04_05", "ice_C001",
];

async function trackModel(id: string): Promise<any> {
  const archiveIndex = JSON.parse(inflateSync(await readFile(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8")) as { rho: RhoArchiveIndex[] };
  const archive = archiveIndex.rho.find(entry => entry.name === `track_${id}.rho`);
  assert.ok(archive, `track_${id}.rho`);
  const source = await readFile(path.resolve(project, "../mirror/p3553", archive.name));
  const copy = (chunk: Uint8Array): ArrayBuffer => Uint8Array.from(chunk).buffer as ArrayBuffer;
  const reader = new RhoReader({
    name: archive.name, size: source.length,
    arrayBuffer: async () => copy(source),
    slice: (start = 0, end = source.length) => ({ arrayBuffer: async () => copy(source.subarray(start, end)) }),
  }, archive);
  return y9(await reader.read("track.1s"));
}

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Drives the centre line from the start, as the kart would, and reports where the race finishes. */
function driveCourse(summary: unknown, laps: number, until?: (position: Vec3) => boolean) {
  const route = summary as { sections: RouteSection[]; firstSection: number; lastSection: number;
    start: { position: Vec3 } };
  const points: Vec3[] = [route.start.position];
  // From the section the start stands in (the first one, or C005's traded last one).
  const starting = route.sections.map((section, index) => ({ index,
    gap: distance(section.frames[0]!.position, route.start.position) }))
    .sort((a, b) => a.gap - b.gap)[0]!.index;
  let index = starting;
  const seen = new Set<number>();
  for (;;) {
    seen.add(index);
    for (const frame of route.sections[index]!.frames) points.push(frame.position);
    const next = route.sections[index]!.outgoing[0]!.section;
    if (seen.has(next)) break;
    index = next;
  }
  const last = route.sections[index]!.frames.at(-1)!;
  const first = route.sections[starting]!;
  if (distance(last.position, first.frames[0]!.position) < 1) {
    // A loop: over the start line again.
    for (const frame of first.frames) points.push(frame.position);
  } else {
    points.push({ x: last.position.x + last.forward.x * 40, y: last.position.y + last.forward.y * 40,
      z: last.position.z + last.forward.z * 40 });
  }
  const world = { sections: route.sections,
    data: { firstSection: route.firstSection, lastSection: route.lastSection, lapTarget: laps },
    routeStates: new WeakMap<object, never>() } as never;
  const vehicle = {};
  resetRouteState(world, vehicle, points[0]!);
  const unclosed: string[] = [];
  const tags = new Set<string>();
  let previous = points[0]!;
  let finish: Vec3 | undefined;
  for (let k = 1; k < points.length && !finish; k++) {
    const steps = Math.max(1, Math.ceil(distance(points[k - 1]!, points[k]!) / 0.5));
    for (let j = 1; j <= steps; j++) {
      const current = lerp(points[k - 1]!, points[k]!, j / steps);
      const state = updateRoute(world, vehicle, previous, current, tag => {
        tags.add(routeTagFamily(tag));
        if (routeSurfaceKind(routeTagFamily(tag)) === "unclosed") unclosed.push(tag);
      });
      previous = current;
      if (state.lap > laps || until?.(current)) {
        finish = current;
        break;
      }
    }
  }
  // Where a checkpoint reset would put the kart now.
  const reset = prepareCurrentSectionReset(world, vehicle).position;
  return { finish, unclosed, tags, reset };
}

test("every 驾照考试 course runs to its goal without stopping the race", async () => {
  const license = JSON.parse(await readFile(path.resolve(project,
    "../server-go/internal/data/license/license.json"), "utf8")) as
    { licenses: Array<{ steps: Array<{ track: string; laps: number }> }> };
  const steps = license.licenses.flatMap(entry => entry.steps);
  for (const id of LICENSE_COURSES) {
    const parsed = await trackModel(id);
    const route = YW(parsed, "time-attack", { forceReverse: false });
    markLicenseGoal(route);
    // Only C005's first frame looks back up its road; the start turns with it.
    assert.equal(alignLicenseFrames(route), id === "village_C005" ? 1 : 0, id);
    const first = route.sections[route.firstSection]!.frames;
    const run = { x: first[1]!.position.x - first[0]!.position.x, z: first[1]!.position.z - first[0]!.position.z };
    assert.ok(route.start.forward.x * run.x + route.start.forward.z * run.z > 0, `${id}: the start faces down the road`);
    // And only C005's two sections trade frames to meet their own way out.
    assert.equal(alignLicenseSections(route), id === "village_C005", id);
    const laps = steps.find(step => step.track === id)?.laps || 1;
    const { finish, unclosed, tags } = driveCourse(route, laps);
    assert.ok(finish, `${id}: the race never finishes`);
    assert.deepEqual(unclosed, [], `${id}: route tags without a listener`);
    for (const tag of tags) if (tag.startsWith("event")) assert.equal(routeSurfaceKind(tag), "rider-school", tag);
    if (id === "village_C005") {
      // The open 行驶练习 course ends at its physical end, the "end" gate (x≈103.5).
      assert.ok(Math.abs(finish!.x - 103.5) < 2, `C005 finish x=${finish!.x}`);
    }
  }
});

let c005Model: unknown;

test("a checkpoint reset on village_C005 puts the kart where it is on the road", async () => {
  c005Model ??= await trackModel("village_C005");
  const course = () => {
    const route = YW(c005Model, "time-attack", { forceReverse: false });
    markLicenseGoal(route);
    alignLicenseFrames(route);
    alignLicenseSections(route);
    return route;
  };
  // Still before the start gate (x 345.6): back to the start line.
  const early = driveCourse(course(), 1, position => position.x < 370);
  assert.ok(Math.abs(early.reset.x - 393.6) < 1, `reset x=${early.reset.x}`);
  // Down the practice road: the start gate, not the start line 190 back.
  const late = driveCourse(course(), 1, position => position.x < 200);
  assert.ok(Math.abs(late.reset.x - 345.5) < 1, `reset x=${late.reset.x}`);
  // The goal still counts at the end gate.
  assert.ok(Math.abs(driveCourse(course(), 1).finish!.x - 103.5) < 2);
});

test("only the open course without a final gate gets one", async () => {
  const c005 = YW(await trackModel("village_C005"), "time-attack", { forceReverse: false });
  assert.equal(markLicenseGoal(c005), true);
  assert.equal(markLicenseGoal(c005), false, "a marked course keeps its goal");
  // A loop without final (追击海盗船长) finishes on its start line.
  assert.equal(markLicenseGoal(YW(await trackModel("village_C110"), "time-attack", { forceReverse: false })), false);
  // Courses naming final="end" are left alone.
  assert.equal(markLicenseGoal(YW(await trackModel("village_L01_04"), "time-attack", { forceReverse: false })), false);
});

test("a course's eventList names the hint scene of each tutorial point", async () => {
  const scenes = licenseEventScenes((await trackModel("village_L01_04")).root.trackObjects);
  assert.deepEqual(Object.fromEntries(scenes), { turnLeft: "좌회전", turnRight: "우회전", blink: "전진깜박" });
  assert.deepEqual([...licenseEventScenes((await trackModel("village_C005")).root.trackObjects)], []);
});

test("行驶练习 asks 向前, 向后, 右转, 左转 in turn and then clears", () => {
  const drill = new KeyDrill(500);
  const idle: DrillInput = { forward: false, reverse: false, steer: 0, speed: 0 };
  const inputs: DrillInput[] = [
    { forward: true, reverse: false, steer: 0, speed: 20 },
    { forward: false, reverse: true, steer: 0, speed: -8 },
    { forward: true, reverse: false, steer: -1, speed: 15 },
    { forward: true, reverse: false, steer: 1, speed: 15 },
  ];
  let now = 0;
  const events: string[] = [];
  const run = (input: DrillInput, ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      now += 50;
      const event = drill.update(input, now);
      if (event) events.push(event.kind === "done" ? "done" : `${event.kind}${event.index}`);
    }
  };
  run(idle, 200);
  // The wrong keys answer nothing.
  run(inputs[1]!, DRILL_HOLD_MS * 2);
  assert.deepEqual(events, []);
  for (const [index, input] of inputs.entries()) {
    run(input, DRILL_HOLD_MS + 100);
    assert.equal(events.at(-1), `ok${index}`);
    run(idle, 600);
    if (index < inputs.length - 1) assert.equal(events.at(-1), `prompt${index + 1}`);
  }
  assert.equal(events.at(-1), "done");
  assert.equal(drill.done, true);
  assert.equal(DRILL_PROMPTS.map(prompt => prompt.text).join(""), "向前向后右转左转");
});

test("a license race preloads its prompts, hints and start scene", () => {
  const progress = { objective: false };
  assert.deepEqual(licenseSceneNames({ step: 1, mission: 0, setup: {}, progress }, new Map()),
    ["앞으로1@zz", "뒤로1@zz", "오른쪽1@zz", "왼쪽1@zz", "ok@zz"]);
  assert.deepEqual(licenseSceneNames({ step: 4, mission: 3, setup: { startTutoScene: "아이템_미사일" }, progress },
    new Map([["booster", "아이템"]])), ["아이템", "아이템_미사일"]);
});
