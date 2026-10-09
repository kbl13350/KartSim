import assert from "node:assert/strict";
import test from "node:test";

import { AccountServiceError } from "../account/account-api";
import { settleErrorMessage, settleTimeAttackRun } from "./timeattack-settle";
import { timeAttackRewardText } from "./result-rewards";

test("a finished run fills the result panel's RP and Lucci slots", async () => {
  const patches: unknown[] = [];
  let refreshed = 0;
  const settlement = await settleTimeAttackRun({
    session: {
      requestJson: async () => ({ exp: 30, lucci: 70, newRecord: true, capped: false }),
      refresh: async () => { refreshed++; },
    },
    trackId: "village_R01", elapsedMs: 90_000,
    result: { patch: values => patches.push(values) },
  });
  assert.equal(settlement?.exp, 30);
  assert.deepEqual(patches, [{ rewardExp: 30, rewardLucci: 70 }]);
  // Without an account summary in the response the session is re-read.
  assert.equal(refreshed, 1);
});

test("an unreachable service is retried once with the same request ID", async () => {
  const requestIds: string[] = [];
  const settlement = await settleTimeAttackRun({
    session: {
      requestJson: async (_path, init) => {
        requestIds.push(JSON.parse(String(init?.body)).requestId);
        if (requestIds.length === 1) throw new AccountServiceError("DATA_SERVICE_UNAVAILABLE");
        return { exp: 10, lucci: 20 };
      },
    },
    trackId: "village_R01", elapsedMs: 90_000, retryDelayMs: 0,
  });
  assert.equal(settlement?.lucci, 20);
  assert.equal(requestIds.length, 2);
  assert.equal(requestIds[0], requestIds[1]);
});

test("the daily cap, failures and missing accounts are reported without throwing", async () => {
  const notices: string[] = [];
  const reports: string[] = [];
  await settleTimeAttackRun({
    session: { requestJson: async () => ({ exp: 0, lucci: 0, capped: true }) },
    trackId: "village_R01", elapsedMs: 90_000, notify: message => notices.push(message),
  });
  assert.deepEqual(notices, ["今日计时赛奖励次数已用完，明天再来吧。"]);
  const failed = await settleTimeAttackRun({
    session: { requestJson: async () => { throw new AccountServiceError("RATE_LIMITED", 429); } },
    trackId: "village_R01", elapsedMs: 90_000, report: message => reports.push(message),
  });
  assert.equal(failed, undefined);
  assert.deepEqual(reports, ["计时赛奖励结算失败：操作过于频繁，请稍后再试。"]);
  assert.equal(await settleTimeAttackRun({ trackId: "village_R01", elapsedMs: 1 }), undefined);
  // A run under 10 s earns nothing and is not sent (the service refuses it).
  let sent = false;
  assert.equal(await settleTimeAttackRun({
    session: { requestJson: async () => { sent = true; return {}; } },
    trackId: "village_R01", elapsedMs: 9_999, report: message => reports.push(message),
  }), undefined);
  assert.equal(sent, false);
  assert.deepEqual(reports, ["计时赛奖励结算失败：操作过于频繁，请稍后再试。"]);
});

test("reward slot text keeps the release ' +0' until an amount is known", () => {
  assert.equal(timeAttackRewardText(undefined), " +0");
  assert.equal(timeAttackRewardText(-5), " +0");
  assert.equal(timeAttackRewardText(30), " +30");
});

test("the result overlay redraws with the settled reward", async () => {
  const { TimeAttackResultOverlay } = await import("./race-display-state");
  const built: Array<Record<string, unknown>> = [];
  const overlay = new TimeAttackResultOverlay("definition", {
    createRenderer: () => ({ update: () => {}, render: () => {}, dispose: () => {} }),
    buildItems: (_definition: unknown, values: Record<string, unknown>) => {
      built.push(values);
      return [];
    },
  } as unknown as ConstructorParameters<typeof TimeAttackResultOverlay>[1]);
  const context = {} as CanvasRenderingContext2D;
  overlay.patch({ rewardExp: 1 });
  assert.equal(overlay.values, undefined, "nothing to patch before show");
  overlay.show({ elapsedMs: 90_000, bestMs: 90_000 });
  overlay.render(context, 1600, 900);
  overlay.render(context, 1600, 900);
  overlay.patch({ rewardExp: 30, rewardLucci: 70 });
  overlay.render(context, 1600, 900);
  assert.deepEqual(built, [{ elapsedMs: 90_000, bestMs: 90_000 },
    { elapsedMs: 90_000, bestMs: 90_000, rewardExp: 30, rewardLucci: 70 }]);
});

test("settle failures are shown in Chinese, not as service codes", () => {
  for (const code of ["RATE_LIMITED", "TOO_MANY_ATTEMPTS", "DATA_SERVICE_UNAVAILABLE",
    "LOGIN_REQUIRED", "ONBOARDING_REQUIRED", "INVALID_ELAPSED_MS", "INVALID_TRACK",
    "INVALID_REQUEST_ID"]) {
    const message = settleErrorMessage(new AccountServiceError(code, 400));
    assert.notEqual(message, code);
    assert.match(message, /[一-鿿]/u, code);
  }
  assert.equal(settleErrorMessage(new Error("中文原因")), "中文原因");
});

test("a run the service does not reward (too soon, too fast, unknown track) stays quiet at +0", async () => {
  for (const [code, status] of [["TOO_MANY_ATTEMPTS", 429], ["INVALID_TRACK", 400]] as const) {
    const reports: string[] = [];
    const patches: unknown[] = [];
    const result = await settleTimeAttackRun({
      session: { requestJson: async () => { throw new AccountServiceError(code, status); } },
      trackId: "village_R01", elapsedMs: 90_000, retryDelayMs: 0,
      report: message => reports.push(message), result: { patch: values => patches.push(values) },
    });
    assert.equal(result, undefined);
    assert.deepEqual(reports, [], code);
    assert.deepEqual(patches, [], "the panel keeps the release \" +0\"");
  }
  // A genuine retry (unreachable service) still reuses the request ID, then stays quiet if refused.
  const ids: string[] = [];
  const reports: string[] = [];
  await settleTimeAttackRun({
    session: { requestJson: async (_path, init) => {
      ids.push(JSON.parse(String(init?.body)).requestId);
      throw new AccountServiceError(ids.length === 1 ? "DATA_SERVICE_UNAVAILABLE" : "TOO_MANY_ATTEMPTS");
    } },
    trackId: "village_R01", elapsedMs: 90_000, retryDelayMs: 0,
    report: message => reports.push(message),
  });
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  assert.deepEqual(reports, []);
  assert.equal(settleErrorMessage(new AccountServiceError("REQUEST_ID_CONFLICT", 409)),
    "结算请求编号冲突，本次不发放奖励。");
});
