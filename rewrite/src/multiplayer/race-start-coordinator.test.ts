import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RaceStartCoordinator, type CoordinatedRoom, type RaceStartOptions,
  type RaceStartRules } from "./race-start-coordinator";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class ll0 {");
const end = source.indexOf("const ul0 =", start);
assert.ok(start > 0 && end > start);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const rules: RaceStartRules = {
  gameplay: value => String(value.gameplay ?? "ordinary"),
  sameRoadblock: same, sameLte: same, sameRp: same,
  toLocalStartTick: (startTick, mapping) => startTick - Number(mapping.offset),
};
const Original = new Function("G2", "oR", "Nw", "t7", "Y3",
  `${source.slice(start, end)}\nreturn ll0;`)(
    rules.gameplay, same, same, same, rules.toLocalStartTick,
  ) as new (options: RaceStartOptions) => RaceStartCoordinator;

function room(revision: number, phase: CoordinatedRoom["phase"] = "loading",
  changes: Partial<CoordinatedRoom> = {}): CoordinatedRoom {
  return { roomId: "room-1", revision, name: "Room", phase,
    hostId: "me", mode: "individual", speed: 7, speedVersion: "国服",
    channelName: "speedIndiCombine", resourceVersion: "p3553",
    members: [{ playerId: "me", name: "Me", slot: 0, ready: false, team: null }],
    race: { raceId: "race-1", channelName: "speedIndiCombine",
      loadedIds: [], gameplay: "ordinary" },
    ...changes };
}

function fixture() {
  const events: unknown[] = [];
  let presentingResults = false;
  const options: RaceStartOptions = {
    loader: { prepare: async (current, race, signal) => {
      events.push(["prepare", current.revision, race.raceId, signal.aborted]);
      return { dispose: () => events.push("race.dispose"),
        bindClock: mapping => events.push(["clock", mapping.offset]),
        updateRoom: next => events.push(["room", next.revision]),
        showWaiting: () => events.push("waiting"),
        scheduleStart: localTick => events.push(["start", localTick]),
        presentingResults: () => presentingResults };
    } },
    captureClock: () => ({ offset: 10 }),
    send: async command => { events.push(["send", command]); },
    onError: error => events.push(["error", error instanceof Error ? error.message : String(error)]),
  };
  return { events, options, setPresenting: (value: boolean) => { presentingResults = value; } };
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const summarize = (coordinator: RaceStartCoordinator) => ({
  roomId: coordinator.roomId, revision: coordinator.revision,
  activeRace: coordinator.active?.raceId,
  failed: coordinator.active?.failed, scheduled: coordinator.active?.scheduled,
  disposed: coordinator.disposed,
});

test("loading, clock binding, start and room return match release", async () => {
  const run = async (released: boolean) => {
    const { events, options, setPresenting } = fixture();
    const coordinator = released ? new Original(options) : new RaceStartCoordinator(options, rules);
    coordinator.update(room(1));
    await settle();
    coordinator.update(room(2, "countdown", { race: {
      raceId: "race-1", channelName: "speedIndiCombine",
      loadedIds: ["me"], gameplay: "ordinary", startAt: 100,
    } }));
    coordinator.update(room(2, "countdown"));
    setPresenting(true);
    coordinator.update(room(3, "open", { race: undefined }));
    const presenting = summarize(coordinator);
    setPresenting(false);
    coordinator.releasePresentedRace();
    return { events, presenting, after: summarize(coordinator) };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("missed loading and changed race rules fail identically", async () => {
  const run = async (released: boolean) => {
    const { events, options } = fixture();
    const coordinator = released ? new Original(options) : new RaceStartCoordinator(options, rules);
    coordinator.update(room(1, "countdown"));
    await settle();
    const missed = summarize(coordinator);
    coordinator.update(room(2, "loading", { race: {
      raceId: "race-2", channelName: "speedIndiCombine", loadedIds: [],
      gameplay: "ordinary",
    } }));
    await settle();
    coordinator.update(room(3, "loading", { name: "Changed", race: {
      raceId: "race-2", channelName: "speedIndiCombine", loadedIds: [],
      gameplay: "ordinary",
    } }));
    await settle();
    return { events, missed, after: summarize(coordinator) };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("a changed race.item fails the loading item race", async () => {
  const { events, options } = fixture();
  const coordinator = new RaceStartCoordinator(options, rules);
  const item = (revision: number, table: string) => room(revision, "loading", {
    gameplay: "item", channelName: "itemIndiCombine", race: {
      raceId: "race-1", channelName: "itemIndiCombine", loadedIds: [], gameplay: "item",
      item: { ruleset: "web-item-v1", table } } });
  coordinator.update(item(1, "indi"));
  await settle();
  coordinator.update(item(2, "indi"));
  assert.equal(coordinator.active?.failed, false);
  coordinator.update(item(3, "team"));
  await settle();
  assert.equal(coordinator.active?.failed, true);
  assert.ok(events.some(event => Array.isArray(event) && event[0] === "error" &&
    event[1] === "比赛加载期间频道配置发生变化。"));
});
