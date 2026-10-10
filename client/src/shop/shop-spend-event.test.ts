import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchSpendEvent, formatSpendEventTime, parseSpendEventStatus, SHOP_SPEND_EVENT_PATH, spendEventPeriodText,
  spendEventShown, spendProgressWidth, spendRewardLabel, SpendEventError,
} from "./shop-spend-event";
import { fakeSession, json, realEventsJson, requestHeader, spendEventJson } from "./shop-test-fixtures";

test("累计消费活动：解析数据服务的回答，时间按原版的北京时间显示", () => {
  const status = parseSpendEventStatus(spendEventJson(1500));
  assert.equal(status.spent, 1500);
  assert.equal(status.active, true);
  const event = status.event!;
  assert.equal(event.steps.length, 4);
  assert.deepEqual(event.steps.map(step => step.value), [1000, 2000, 5000, 8000]);
  assert.equal(event.eventPeriod.startMs, Date.parse("2026-09-17T06:00:00+08:00"));
  // The end second is included: the period lasts until 06:00:00.
  assert.equal(event.eventPeriod.endMs, Date.parse("2026-10-15T06:00:00+08:00"));
  assert.equal(spendEventPeriodText(event), "活动期间 : 2026-9-17 6:00 ~ 2026-10-15 5:59");
  assert.equal(formatSpendEventTime("2026-10-15T05:59:59+08:00"), "2026-10-15 5:59");
  assert.equal(spendEventShown(status), true);
  // Shown until the reward period ends.
  assert.equal(spendEventShown({ ...status, serverTime: Date.parse("2026-10-22T05:59:59+08:00") }), true);
  assert.equal(spendEventShown({ ...status, serverTime: Date.parse("2026-10-22T06:00:00+08:00") }), false);
  assert.equal(spendEventShown({ ...status, serverTime: Date.parse("2026-09-17T05:59:59+08:00") }), false);
  assert.deepEqual(parseSpendEventStatus({ event: null, spent: 0, active: false, serverTime: 1 }),
    { event: null, spent: 0, active: false, serverTime: 1 });
});

test("累计消费活动：严格校验，形状不对就拒绝", () => {
  const broken: Array<(body: ReturnType<typeof spendEventJson>) => unknown> = [
    body => ({ ...body, spent: -1 }),
    body => ({ ...body, spent: 1.5 }),
    body => ({ ...body, active: "yes" }),
    body => ({ ...body, serverTime: "now" }),
    body => ({ ...body, event: { ...body.event, eventType: "charge" } }),
    body => ({ ...body, event: { ...body.event, eventPeriod: { start: "2026-09-17 06:00", end: "2026-10-15T05:59:59+08:00" } } }),
    body => ({ ...body, event: { ...body.event, eventPeriod: { start: "2026-09-17T06:00:00", end: "2026-10-15T05:59:59+08:00" } } }),
    body => ({ ...body, event: { ...body.event, eventPeriod: { start: "2026-10-16T06:00:00+08:00", end: "2026-10-15T05:59:59+08:00" } } }),
    body => ({ ...body, event: { ...body.event, rewardPeriod: { start: "2026-09-17T06:00:00+08:00", end: "2026-10-01T05:59:59+08:00" } } }),
    body => ({ ...body, event: { ...body.event, steps: [] } }),
    body => ({ ...body, event: { ...body.event, steps: [body.event.steps[1], body.event.steps[0]] } }),
    body => ({ ...body, event: { ...body.event, steps: [{ ...body.event.steps[0], reward: { ...body.event.steps[0]!.reward, count: 0 } }] } }),
    body => ({ ...body, event: { ...body.event, steps: [{ ...body.event.steps[0], reward: { ...body.event.steps[0]!.reward, name: "" } }] } }),
    () => [],
    () => null,
  ];
  for (const [index, change] of broken.entries())
    assert.throws(() => parseSpendEventStatus(change(spendEventJson())), SpendEventError, `case ${index}`);
});

test("真实 events.json 的活动通过校验", () => {
  const [event] = realEventsJson().tcCashEvents;
  const status = parseSpendEventStatus({ event, spent: 0, active: true, serverTime: Date.parse("2026-10-09T12:00:00Z") });
  assert.deepEqual(status.event!.steps.map(step => spendRewardLabel(step.reward)), ["10 个", "200 个", "40 个", "无限制"]);
});

test("奖励数量、期限与进度条", () => {
  assert.equal(spendRewardLabel({ count: 10, days: 0 }), "10 个");
  assert.equal(spendRewardLabel({ count: 1, days: 7 }), "7 天");
  assert.equal(spendRewardLabel({ count: 1, days: 0 }), "无限制");
  const steps = [{ value: 1000 }, { value: 2000 }, { value: 5000 }, { value: 8000 }];
  // Step i under the middle of its slot: right edge at 440·(i+1)/4, slot 80 wide.
  assert.equal(spendProgressWidth(steps, 0, 440, 80), 0);
  assert.equal(spendProgressWidth(steps, 1000, 440, 80), 70);
  assert.equal(spendProgressWidth(steps, 500, 440, 80), 35);
  assert.equal(spendProgressWidth(steps, 2000, 440, 80), 180);
  assert.equal(spendProgressWidth(steps, 6500, 440, 80), 345);
  assert.equal(spendProgressWidth(steps, 8000, 440, 80), 440);
  assert.equal(spendProgressWidth(steps, 99999, 440, 80), 440);
});

test("请求带 Bearer 会话、不走缓存；旧数据服务 404、网络错误或无效回答时不显示", async () => {
  const session = fakeSession([() => json(spendEventJson(10))]);
  const status = await fetchSpendEvent(session);
  assert.equal(status?.spent, 10);
  assert.equal(session.calls[0]!.path, SHOP_SPEND_EVENT_PATH);
  assert.equal(session.calls[0]!.init?.cache, "no-store");
  assert.equal(requestHeader(session.calls[0]!, "Accept"), "application/json");
  assert.equal(await fetchSpendEvent(fakeSession([() => json({ error: "NOT_FOUND" }, 404)])), undefined);
  assert.equal(await fetchSpendEvent(fakeSession([() => { throw new TypeError("offline"); }])), undefined);
  assert.equal(await fetchSpendEvent(fakeSession([() => new Response("{", { status: 200 })])), undefined);
  assert.equal(await fetchSpendEvent(fakeSession([() => json(spendEventJson(0, { event: null }))])), undefined);
  assert.equal(await fetchSpendEvent(fakeSession([() => json(spendEventJson(0,
    { serverTime: Date.parse("2026-11-01T00:00:00+08:00") }))])), undefined, "after the reward period");
});
