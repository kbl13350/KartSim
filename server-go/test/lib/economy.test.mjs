// Unit checks for the economy rules the end-to-end scripts predict with;
// the vectors are those of internal/shared/rewards/rewards_test.go and the
// committed levels.json. No services needed.
//   node --test test/lib/economy.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RACE, afterEarning, finishCounts, levelForExp, levelUpRewards, loadLevels, maxLevel, raceRewards,
  timeAttackPacingMs, timeAttackRewards,
} from "./economy.mjs";

const ranked = n => Array.from({ length: n }, (_, index) =>
  ({ playerId: `p${index + 1}`, rank: index + 1, finished: true }));
const values = rewards => Object.values(rewards).map(({ exp, lucci }) => [exp, lucci]);

test("race rewards match internal/shared/rewards", () => {
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine", racers: ranked(8) })),
    [[121, 180], [113, 169], [105, 157], [97, 146], [90, 134], [82, 123], [74, 111], [66, 100]]);
  assert.deepEqual(values(raceRewards({ channel: "speedIndiInfinit", racers: ranked(8) })),
    [[110, 180], [103, 169], [96, 157], [89, 146], [81, 134], [74, 123], [67, 111], [60, 100]]);
  const withDnf = ranked(8);
  withDnf[7].finished = false;
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine", racers: withDnf })).at(-1), [11, 10]);
  assert.deepEqual(values(raceRewards({ channel: "speedIndiInfinit", racers: ranked(2) })),
    [[80, 120], [30, 40]]);
  // The two-racer Combine race of economy-smoke.
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine", racers: ranked(2) })),
    [[88, 120], [33, 40]]);
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine", racers: ranked(1) })), [[88, 120]]);
  const team = [
    { playerId: "a", rank: 1, finished: true, team: 1 }, { playerId: "b", rank: 2, finished: true, team: 2 },
    { playerId: "c", rank: 3, finished: true, team: 1 }, { playerId: "d", rank: 4, finished: false, team: 2 },
  ];
  assert.deepEqual(values(raceRewards({ channel: "speedTeamCombine", mode: "team", winningTeam: 1, racers: team })),
    [[119, 168], [81, 113], [75, 104], [11, 10]]);
  assert.deepEqual(values(raceRewards({ channel: "speedTeamCombine", winningTeam: 1, racers: team })),
    [[99, 140], [81, 113], [62, 87], [11, 10]]);
  const five = ["runner", "b1", "b2", "b3", "b4"].map(playerId => ({ playerId }));
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine", racers: five,
    roadblock: { runnerId: "runner", runnerWon: true } })),
  [[105, 150], [84, 120], [84, 120], [84, 120], [84, 120]]);
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine", racers: five,
    roadblock: { runnerId: "runner", runnerWon: false } })),
  [[50, 70], [105, 150], [105, 150], [105, 150], [105, 150]]);
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine", racers: ranked(1),
    rates: { exp: 2, lucci: 0.5 } })), [[176, 60]]);
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine", racers: ranked(2),
    rates: { exp: Number.NaN, lucci: -1 } })), [[0, 0], [0, 0]]);
  // Rates scale the rounded base amounts (rewards.ApplyRate): 3 racers in a
  // Combine channel earn 93.5 → 94 / 130, 66 / 90 and 11 / 10 at rate 1.
  assert.deepEqual(values(raceRewards({ channel: "speedIndiCombine",
    racers: [...ranked(2), { playerId: "p3", rank: 3, finished: false }],
    rates: { exp: 1.5, lucci: 2 } })), [[141, 260], [99, 180], [17, 20]]);
  assert.deepEqual(values(raceRewards({ channel: "speedIndiInfinit",
    racers: [{ playerId: "x", rank: 0, finished: true }, { playerId: "y", rank: 9, finished: true }] })),
  [[30, 40], [30, 40]]);
});

test("the per-entry cap is the formula maximum; a team tie earns no team bonus", () => {
  // 8 racers, *Combine channel, winning team, rank 1 (internal/data/api maxRaceReward).
  const team = Array.from({ length: 8 }, (_, index) =>
    ({ playerId: `p${index + 1}`, rank: index + 1, finished: true, team: 1 + (index % 2) }));
  const won = raceRewards({ channel: "speedTeamCombine", mode: "team", winningTeam: 1, racers: team });
  assert.deepEqual(won.p1, { exp: RACE.maxEntryExp, lucci: RACE.maxEntryLucci });
  for (const reward of Object.values(won)) {
    assert.ok(reward.exp <= RACE.maxEntryExp && reward.lucci <= RACE.maxEntryLucci);
  }
  // Tie (winningTeam 0): nobody gets x1.2, so team 1's winner earns the individual amount.
  const tie = raceRewards({ channel: "speedTeamCombine", mode: "team", winningTeam: 0, racers: team });
  assert.deepEqual(tie.p1, raceRewards({ channel: "speedIndiCombine", racers: ranked(8) }).p1);
});

test("finishes count for rewards after 10 s of server time, within 3 s of it", () => {
  assert.equal(finishCounts(9_999, 60_000), false, "under 10 s of racing");
  assert.equal(finishCounts(10_000, 60_000), true);
  assert.equal(finishCounts(12_000, 9_000), true, "3 s of latency allowed");
  assert.equal(finishCounts(12_000, 8_999), false, "reported time too short");
});

test("time-attack pacing", () => {
  assert.equal(timeAttackPacingMs(10_000), 10_000);
  assert.equal(timeAttackPacingMs(13_000), 10_000);
  assert.equal(timeAttackPacingMs(14_000), 11_000);
  assert.equal(timeAttackPacingMs(60_000), 57_000);
});

test("time-attack rewards", () => {
  assert.deepEqual(timeAttackRewards(false), { exp: 10, lucci: 20 });
  assert.deepEqual(timeAttackRewards(true), { exp: 30, lucci: 70 });
  assert.deepEqual(timeAttackRewards(false, { exp: 1.5, lucci: 2 }), { exp: 15, lucci: 40 });
  assert.deepEqual(timeAttackRewards(true, { exp: 1.5, lucci: 2 }), { exp: 45, lucci: 140 });
});

test("levels follow levels.json", () => {
  const table = loadLevels();
  assert.equal(maxLevel(table), table.levels.length - 1);
  const first = table.levels[1].nextExp;
  assert.equal(levelForExp(table, 0).level, 1);
  assert.equal(levelForExp(table, -5).exp, 0);
  assert.equal(levelForExp(table, first - 1).level, 1);
  assert.deepEqual({ ...levelForExp(table, first) },
    { level: 2, exp: first, levelExp: first, nextLevelExp: table.levels[2].nextExp,
      glove: table.levels[2].glove, gloveName: table.levels[2].gloveName, maxLevel: maxLevel(table) });
  assert.equal(levelForExp(table, table.rpLimit * 2).level, maxLevel(table));
  assert.equal(levelForExp(table, table.rpLimit * 2).exp, table.rpLimit);
  assert.deepEqual(levelUpRewards(table, 1, 1), { lucci: 0, koin: 0, coupon: 0 });
  assert.deepEqual(levelUpRewards(table, 1, 2), { lucci: 200, koin: 0, coupon: 0 });
  // Levels 2..10: lucci 100 x (2+…+10), koin at 3 and 9, 50 coupons at 10.
  assert.deepEqual(levelUpRewards(table, 1, 10),
    { lucci: 5400, koin: (table.koinRewards[3] ?? 0) + (table.koinRewards[9] ?? 0), coupon: 50 });
});

test("afterEarning adds level-up gifts", () => {
  const table = loadLevels();
  const before = { progress: { exp: 0 }, wallet: { coupon: 0, lucci: 10_000, koin: 0 } };
  const first = table.levels[1].nextExp;
  const after = afterEarning(table, before, { exp: first, lucci: 120 });
  assert.equal(after.progress.level, 2);
  assert.equal(after.levelUps, 1);
  assert.deepEqual(after.wallet, { coupon: 0, lucci: 10_000 + 120 + 200, koin: 0 });
  assert.deepEqual(afterEarning(table, before, { exp: 1, lucci: 5 }).wallet,
    { coupon: 0, lucci: 10_005, koin: 0 });
});
