import assert from "node:assert/strict";
import test from "node:test";

import { formatLicenseTime, licenseErrorMessage, parseLicenseState, parseLicenseTable,
  runLicenseStep } from "./license-api";
import { canTakeLicense, channelLicenseWarning, currentLicenseLevel, findOpenStep, judgeLicenseRun,
  licenseComplete, licenseLock, licenseSteps, licenseTaken, licenseTimeLimit } from "./license-model";
import { licenseRemainingMs, missionTimerDigits, updateLicenseTimer } from "./license-race";

const step = (n: number, extra: Record<string, unknown> = {}) => ({ step: n, mission: 20, rule: "time",
  name: `第${n}关`, icon: "missionIcon_x", track: "village_L01_04", laps: 0, speed: 7, timeMs: 13000,
  stockId: 68, ...extra });

const tableBody = {
  version: "v",
  licenses: [1, 2, 3, 4, 5].map(level => ({ level, name: ["新手", "初级", "L3", "L2", "L1"][level - 1],
    steps: [1, 2, 3, 4, 5, 6].map(index => step((level - 1) * 6 + index)) })).concat([{ level: 6, name: "PRO",
    steps: [step(31), step(32, { mission: 21, rule: "rival", timeMs: 0,
      rival: { kartId: 1381, characterId: 380, ksv: "PRO_2_mabi_R01_7" }, rivalMs: 88980 }),
    step(33), step(34, { mission: 21, rule: "rival", timeMs: 0,
      rival: { kartId: 1, characterId: 2, ksv: "x" }, rivalMs: 90000 })] }]),
  pro: { emblemId: 8524, qualify: [{ track: "mine_R01", speed: 7, timeMs: 72000 }] },
  proDays: 90,
  rewards: { "68": "蓝色心型气球(30 个)" },
};

const stateBody = (overrides: Record<string, unknown> = {}) => ({
  level: 0, baseLevel: 0, tryLevel: 1, proUntil: 0, proPeriod: "", proCount: 0, qualified: false,
  period: "2026-09", periodEnd: 1, proSteps: [31, 32], cleared: [], records: [], ...overrides,
});

test("the license table and standing parse and refuse malformed rows", () => {
  const table = parseLicenseTable(tableBody);
  assert.equal(table.licenses.length, 6);
  assert.equal(table.licenses[5]!.steps[1]!.rivalMs, 88980);
  assert.equal(table.rewards.get(68), "蓝色心型气球(30 个)");
  assert.throws(() => parseLicenseTable({ ...tableBody, proDays: 0 }));
  assert.throws(() => parseLicenseTable({ ...tableBody,
    licenses: [{ level: 1, name: "新手", steps: [step(1, { rule: "item" })] }] }));
  const state = parseLicenseState(stateBody({ cleared: [{ step: 1, bestMs: 9000, clearedAt: 5 }],
    records: [{ track: "mine_R01", bestMs: 71000 }] }));
  assert.equal(state.cleared.get(1)?.bestMs, 9000);
  assert.equal(state.records.get("mine_R01"), 71000);
  assert.throws(() => parseLicenseState({ ...stateBody(), level: -1 }));
});

test("steps open one after another within the glove's licenses", () => {
  const table = parseLicenseTable(tableBody);
  let state = parseLicenseState(stateBody());
  assert.deepEqual(licenseSteps(table, state, 1).map(view => view.open), [true, false, false, false, false, false]);
  assert.equal(licenseLock(state, 1), undefined);
  assert.equal(licenseLock(state, 2), "请先获得新手驾照。");
  assert.equal(findOpenStep(table, state, 2), undefined);
  assert.equal(findOpenStep(table, state, 1)?.level, 1);
  state = parseLicenseState(stateBody({ cleared: [1, 2, 3, 4, 5, 6].map(n => ({ step: n, bestMs: 1, clearedAt: 1 })) }));
  assert.ok(licenseComplete(table, state, 1));
  assert.ok(canTakeLicense(table, state, 1));
  state = parseLicenseState(stateBody({ baseLevel: 1, level: 1 }));
  assert.ok(!canTakeLicense(table, state, 1));
  assert.ok(licenseTaken(state, 1));
  assert.equal(licenseLock(state, 2), "等级达到绿色手套后才能挑战初级驾照。");
  assert.equal(currentLicenseLevel(state), 1);
  state = parseLicenseState(stateBody({ baseLevel: 1, level: 1, tryLevel: 3 }));
  assert.equal(licenseLock(state, 2), undefined);
  assert.equal(currentLicenseLevel(state), 2);
});

test("PRO runs the period's set once qualified", () => {
  const table = parseLicenseTable(tableBody);
  let state = parseLicenseState(stateBody({ baseLevel: 4, tryLevel: 5 }));
  assert.equal(licenseLock(state, 6), "获得L1驾照后才能挑战PRO驾照。");
  state = parseLicenseState(stateBody({ baseLevel: 5, level: 5, tryLevel: 5 }));
  assert.equal(currentLicenseLevel(state), 6);
  assert.deepEqual(licenseSteps(table, state, 6).map(view => [view.step.step, view.open]), [[31, false], [32, false]]);
  state = parseLicenseState(stateBody({ baseLevel: 5, level: 5, tryLevel: 5, qualified: true,
    cleared: [{ step: 31, bestMs: 1, clearedAt: 1 }, { step: 32, bestMs: 1, clearedAt: 1 }] }));
  assert.deepEqual(licenseSteps(table, state, 6).map(view => view.open), [true, true]);
  assert.ok(canTakeLicense(table, state, 6));
  state = parseLicenseState({ ...stateBody(), baseLevel: 5, level: 6, qualified: true, proPeriod: "2026-09",
    cleared: [{ step: 31, bestMs: 1, clearedAt: 1 }, { step: 32, bestMs: 1, clearedAt: 1 }] });
  assert.ok(!canTakeLicense(table, state, 6));
  assert.ok(licenseTaken(state, 6));
});

test("clear rules and time limits match the data service", () => {
  const table = parseLicenseTable(tableBody);
  const timed = table.licenses[0]!.steps[0]!;
  const duel = table.licenses[5]!.steps[1]!;
  assert.ok(judgeLicenseRun(timed, 13000));
  assert.ok(!judgeLicenseRun(timed, 13001));
  assert.ok(judgeLicenseRun(duel, 88979));
  assert.ok(!judgeLicenseRun(duel, 88980));
  assert.ok(judgeLicenseRun({ ...timed, rule: "finish", timeMs: 0 }, 500000));
  assert.equal(licenseTimeLimit(timed), 13000);
  assert.equal(licenseTimeLimit(duel), 0);
  assert.equal(formatLicenseTime(65320), "1:05.32");
  assert.equal(licenseErrorMessage("LICENSE_LOCKED").startsWith("还不能挑战"), true);
  assert.match(licenseErrorMessage("SOMETHING"), /SOMETHING/);
  assert.equal(channelLicenseWarning("speedIndiInfinit", 1), "建议初级驾照以上玩家进入该频道。");
  assert.equal(channelLicenseWarning("speedIndiInfinit", 2), undefined);
  assert.equal(channelLicenseWarning("speedIndiCombine", 0), undefined);
});

test("a step run posts the time and applies the returned account", async () => {
  const requests: Array<{ path: string; body: unknown }> = [];
  const applied: unknown[] = [];
  const session = {
    async requestJson(path: string, init?: RequestInit) {
      requests.push({ path, body: JSON.parse(String(init?.body)) });
      return { run: { step: 1, first: true, newBest: true, bestMs: 9000, reward: { stockId: 68,
        name: "蓝色心型气球(30 个)", items: [{ category: 9, itemId: 2, name: "蓝色心型气球", count: 30, days: 0 }] } },
      state: stateBody({ cleared: [{ step: 1, bestMs: 9000, clearedAt: 1 }] }),
      account: { account: { username: "u", nickname: "n" }, progress: { level: 3, license: 1, tryLevel: 1 },
        wallet: { coupon: 0, lucci: 1, koin: 2 } } };
    },
    applySummary(summary: unknown) { applied.push(summary); },
  };
  const result = await runLicenseStep(session, { requestId: "r", step: 1, elapsedMs: 9000.4 });
  assert.deepEqual(requests, [{ path: "/api/license/run", body: { requestId: "r", step: 1, elapsedMs: 9000 } }]);
  assert.equal(result.run.reward?.items[0]?.count, 30);
  assert.equal(result.state.cleared.size, 1);
  assert.equal((applied[0] as { progress: { license: number } }).progress.license, 1);
});

test("the mission timer counts down and fails the race at zero", () => {
  assert.deepEqual(missionTimerDigits(13000), ["00", "13", "00"]);
  assert.deepEqual(missionTimerDigits(65432), ["01", "05", "43"]);
  assert.deepEqual(missionTimerDigits(-5), ["00", "00", "00"]);
  assert.equal(licenseRemainingMs(13000, 4000), 9000);
  assert.equal(licenseRemainingMs(13000, 20000), 0);

  const shown: Array<number | undefined> = [];
  const handled: unknown[] = [];
  const lifecycle = { phase: 2, startAtMs: 1000, finishAtMs: 0, effectiveTime: (now: number) => now,
    forced: undefined as unknown, forceFinish(now: number, result: { failed: boolean }) {
      this.forced = result;
      return [{ kind: "finish", elapsedMs: now - 1000, missionCleared: !result.failed }];
    } };
  const stage = { host: { paused: false, session: { selection: { story: { timeLimitMs: 13000 } }, lifecycle },
    handleTimeAttackActions: (actions: unknown[]) => handled.push(...actions) },
  ui: { action2D: { setMissionTime: (ms: number | undefined) => shown.push(ms) } } };
  updateLicenseTimer(stage, 5000);
  assert.deepEqual(shown, [9000]);
  assert.equal(handled.length, 0);
  updateLicenseTimer(stage, 14000);
  assert.deepEqual(lifecycle.forced, { failed: true });
  assert.equal(handled.length, 1);
  // Without a limit nothing is shown.
  const plain = { ...stage, host: { ...stage.host, session: { selection: { story: {} }, lifecycle } } };
  updateLicenseTimer(plain, 20000);
  assert.equal(shown.length, 2);
});
