import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { finishRacePresenterFrame, type RacePresenterHudDependencies,
  type RacePresenterHudHost } from "./race-presenter-hud";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class jr0 {");
const start = release.indexOf("    const d = _r0(", classStart);
const end = release.indexOf("\n  }\n  awardInput", start);
assert.ok(classStart >= 0 && start > classStart && end > start);
const originalHud = release.slice(start, end);

interface Scenario {
  ranked?: boolean;
  results?: boolean;
  timeGap?: boolean;
  hiddenGap?: boolean;
  audio?: boolean;
  giant?: boolean;
  racing?: boolean;
  skydome?: boolean;
  departed?: string[];
  rosters?: unknown[];
}

function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const roster = [{ playerId: "local", name: "L" },
    { playerId: "remote", name: "R" },
    { playerId: "missing", name: "M" }];
  const finishes = [{ playerId: "local", elapsedMs: 1200 }];
  let gaugeChecks = 0;
  const physics = {
    giant: scenario.giant === false ? undefined : {
      setRank(value: unknown) { events.push(["giant-rank", value]); },
    },
    consumeTeamGaugeFullAnimation() {
      events.push(["team-gauge-check", gaugeChecks]);
      return gaugeChecks++ === 0;
    },
    consumeTimeAttackTachometerGaugePreserve() {
      events.push(["gauge-preserve-source"]); return 4;
    },
    consumeTimeAttackTachometerNormalBooster() {
      events.push(["normal-booster"]); return 2;
    },
  };
  const local = {
    physics,
    lifecycle: { state: scenario.racing === false ? "Ready" : "Racing" },
    track: { skydome: scenario.skydome === false ? undefined : "sky" },
    raceProgress() { events.push(["local-progress"]);
      return { distance: 100, lap: 2 }; },
  };
  const runtime = {
    local,
    remotes: {
      rankDisconnected(id: unknown) { events.push(["disconnected", id]);
        return id === "missing"; },
      hasDeparted(id: unknown) { return scenario.departed?.includes(id as string) ?? false; },
      raceProgress(id: unknown) { events.push(["remote-progress", id]);
        return { distance: 80, lap: 1 }; },
    },
    finishDeadline: 5_000,
    finishSnapshot() { events.push(["finish-snapshot"]); return finishes; },
    resultSnapshot() { events.push(["result-snapshot"]);
      return scenario.results === false ? undefined : finishes; },
    latencyMs(id: unknown) { events.push(["latency", id]); return 35; },
    localDraftHudActive() { events.push(["local-draft"]); return true; },
    draftPresentationVisible(id: unknown) {
      events.push(["draft-visible", id]); return false;
    },
  };
  const hud = {
    markerTints() { events.push(["marker-tints"]); return ["red"]; },
    startTeamBoostGaugeFull() { events.push(["team-gauge-full"]); },
    update(_local: unknown, nowMs: number, remotePoses: unknown,
      board: unknown) { events.push(["hud-update", nowMs, remotePoses, board]); },
    timeGapEnabled: scenario.timeGap ?? true,
    hideTimeGap() { events.push(["hide-gap"]); this.timeGapEnabled = false; },
    updateTimeGap(_local: unknown, nowMs: number, progress: unknown,
      playerId: unknown) { events.push(["update-gap", nowMs, progress, playerId]); },
  };
  const host = {
    playerId: "local",
    race: { roster },
    runtime,
    rankRoster: {
      progress(id: unknown) { events.push(["rank-progress", id]);
        return id === "missing" ? undefined : 4; },
      out(id: unknown) { events.push(["rank-out", id]); return id === "missing"; },
    },
    views: new Map([["local", {}], ["remote", {}]]),
    hud,
    action2d: { setFinishDeadline(value: unknown) {
      events.push(["deadline", value]);
    } },
    warpHudHidden: scenario.hiddenGap ?? false,
    gaugePreserve: { update(nowMs: number, value: unknown) {
      events.push(["preserve", nowMs, value]); return 6;
    } },
    tachometer: "tachometer",
    audioStarted: scenario.audio ?? true,
    assets: { draftAudio: { update(visible: boolean, active: boolean) {
      events.push(["draft-audio", visible, active]);
    } } },
    scene: "scene",
    camera: "camera",
  };
  const dependencies = {
    rankByProgress(roster: unknown, playerId: unknown,
      progress: (id: unknown) => unknown, tints: unknown,
      finish: unknown, latency: (id: unknown) => unknown) {
      scenario.rosters?.push(roster);
      events.push(["rank-by-progress", playerId, tints, finish,
        progress("remote"), latency("remote"), latency("missing")]);
      return scenario.ranked === false ? undefined
        : { rank: 2, rows: [{ participantId: "local" },
          { participantId: "remote" }] };
    },
    rankFallback(roster: unknown, playerId: unknown, tints: unknown,
      latency: (id: unknown) => unknown) {
      scenario.rosters?.push(roster);
      events.push(["rank-fallback", playerId, tints, latency("missing")]);
      return { rank: 3, rows: [{ participantId: "local" },
        { participantId: "missing" }] };
    },
    rankWithResults(board: unknown, results: unknown) {
      events.push(["rank-with-results", board, results]);
      return { ...board as object, result: true };
    },
    updateTachometer(_tachometer: unknown, _physics: unknown,
      nowMs: number, unsigned: number, secondUnsigned: number, elapsed: number,
      preserve: unknown, normalBooster: unknown, draft: boolean) {
      events.push(["tachometer", nowMs, unsigned, secondUnsigned,
        elapsed, preserve, normalBooster, draft]);
    },
    prepareScene(scene: unknown, camera: unknown, force?: boolean) {
      events.push(["prepare-scene", scene, camera, force]);
    },
    racingState: "Racing",
  };
  const original = new Function("_r0", "Gr0", "Br0", "QL", "e4", "X2",
    "o", "a", "t", "u", originalHud);
  const remotePoses = [{ playerId: "remote", pose: { x: 1 } }];
  let error: string | undefined;
  try {
    if (rewritten) finishRacePresenterFrame(host as unknown as RacePresenterHudHost,
      1200.75, remotePoses,
      dependencies as unknown as RacePresenterHudDependencies);
    else original.call(host, dependencies.rankByProgress,
      dependencies.rankFallback, dependencies.rankWithResults,
      dependencies.updateTachometer, dependencies.prepareScene,
      { Racing: "Racing" }, physics, local.track, 1200.75, remotePoses);
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, timeGapEnabled: hud.timeGapEnabled };
}

test("multiplayer rank, time gap, gauge, audio and scene publication match release", () => {
  for (const scenario of [{}, { ranked: false, results: false },
    { timeGap: false, audio: false, giant: false, skydome: false },
    { hiddenGap: true, racing: false }]) {
    assert.deepEqual(observe(true, scenario), observe(false, scenario),
      JSON.stringify(scenario));
  }
});

// Not in the release: racers out of the race stay on the rank board, whose
// racers and slots the release requires to stay the same for a race.
test("racers out of the race keep the rank board roster", () => {
  const rosters: unknown[] = [];
  observe(true, { ranked: false, departed: ["remote", "missing"], rosters });
  const roster = [{ playerId: "local", name: "L" }, { playerId: "remote", name: "R" },
    { playerId: "missing", name: "M" }];
  assert.deepEqual(rosters, [roster, roster]);
});

// The release rank functions and rank board, fed frame by frame as the race
// HUD does.
const rankCode = release.slice(release.indexOf("function XL(n) {"),
  release.indexOf("class Rr0 {"));
const boardCode = release.slice(release.indexOf("class UQ {"),
  release.indexOf("const $Q = ["));
assert.ok(rankCode.includes("function _r0(") && rankCode.includes("function Br0(") &&
  boardCode.endsWith("}\n"));
const releaseRank = new Function(`${rankCode}\n${boardCode}\n` +
  "return { rankByProgress: _r0, rankFallback: Gr0, rankWithResults: Br0, RankBoard: UQ };")();

function raceHud(roster: Array<{ playerId: string; name: string }>) {
  const board = new releaseRank.RankBoard();
  const samples = new Map<string, { distance: number; lap: number }>();
  const departed = new Set<string>();
  let results: Array<{ playerId: string; rank: number; elapsedMs: number | null }> | undefined;
  let rows: Array<{ participantId: string; rank: number; out: boolean }> = [];
  const host = {
    playerId: "local",
    race: { roster },
    runtime: {
      local: {
        physics: {
          consumeTeamGaugeFullAnimation: () => false,
          consumeTimeAttackTachometerGaugePreserve: () => 0,
          consumeTimeAttackTachometerNormalBooster: () => 0,
        },
        lifecycle: { state: "Racing" },
        track: {},
        raceProgress: () => undefined,
      },
      remotes: {
        rankDisconnected: () => false,
        hasDeparted: (id: string) => departed.has(id),
        raceProgress: () => undefined,
      },
      finishDeadline: undefined,
      finishSnapshot: () => [],
      resultSnapshot: () => results,
      latencyMs: () => undefined,
      localDraftHudActive: () => false,
      draftPresentationVisible: () => false,
    },
    rankRoster: {
      progress: (id: string) => samples.get(id),
      out: (id: string) => departed.has(id),
    },
    views: new Map(),
    hud: {
      markerTints: () => new Map(),
      update(_local: unknown, nowMs: number, _poses: unknown,
        next: { rows: Array<{ participantId: string; rank: number; out: boolean }> }) {
        rows = board.update(next.rows, nowMs, () => 20);
      },
      timeGapEnabled: false,
    },
    action2d: { setFinishDeadline() {} },
    warpHudHidden: false,
    gaugePreserve: { update: () => 0 },
    audioStarted: false,
  };
  const dependencies = { ...releaseRank, updateTachometer() {}, prepareScene() {},
    racingState: "Racing" };
  let now = 0;
  return {
    samples, departed,
    set results(value: typeof results) { results = value; },
    frame() {
      now += 600;
      finishRacePresenterFrame(host as unknown as RacePresenterHudHost, now, [],
        dependencies as unknown as RacePresenterHudDependencies);
      return rows.slice().sort((a, b) => a.rank - b.rank)
        .map(row => `${row.rank}:${row.participantId}${row.out ? " out" : ""}`);
    },
  };
}

const startRoster = [{ playerId: "local", name: "L" }, { playerId: "bob", name: "B" },
  { playerId: "carol", name: "C" }];

test("a racer leaving while the race starts stays on the board as out", () => {
  const hud = raceHud(startRoster);
  // Waiting for the start: nobody has progress yet, the board lists the roster.
  assert.deepEqual(hud.frame(), ["1:local", "2:bob", "3:carol"]);
  hud.departed.add("bob");
  assert.deepEqual(hud.frame(), ["1:local", "2:bob out", "3:carol"]);
  // Racing: the progress board forms without bob, who ranks last.
  hud.samples.set("local", { distance: 50, lap: 0 });
  hud.samples.set("carol", { distance: 80, lap: 0 });
  assert.deepEqual(hud.frame(), ["1:carol", "2:local", "3:bob out"]);
  hud.results = [{ playerId: "carol", rank: 1, elapsedMs: 60_000 },
    { playerId: "local", rank: 2, elapsedMs: 61_000 }];
  assert.deepEqual(hud.frame(), ["1:carol", "2:local", "3:bob out"]);
});

test("a racer leaving mid-race before reporting progress stays on the board", () => {
  const hud = raceHud(startRoster);
  hud.samples.set("local", { distance: 50, lap: 0 });
  hud.samples.set("bob", { distance: 70, lap: 0 });
  assert.deepEqual(hud.frame(), ["1:local", "2:bob", "3:carol"]);
  hud.departed.add("carol");
  assert.deepEqual(hud.frame(), ["1:bob", "2:local", "3:carol out"]);
});
