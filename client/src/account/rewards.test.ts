import assert from "node:assert/strict";
import test from "node:test";

import { formatRaceReward, parseRaceRewards, settleTimeAttack } from "./rewards";
import { summaryFixture } from "./account-test-fixtures";

test("race.rewards are read per player and malformed entries are skipped", () => {
  const rewards = parseRaceRewards({
    "member-1": { exp: 121, lucci: 180 },
    "member-2": { exp: 10, lucci: 10 },
    "member-3": { exp: -1, lucci: 5 },
    "member-4": { exp: 1.5, lucci: 5 },
    "member-5": "nope",
  });
  assert.deepEqual([...rewards], [["member-1", { exp: 121, lucci: 180 }],
    ["member-2", { exp: 10, lucci: 10 }]]);
  assert.equal(parseRaceRewards(undefined).size, 0);
  assert.equal(parseRaceRewards([]).size, 0);
  assert.equal(formatRaceReward({ exp: 121, lucci: 180 }), "+121经验 +180金币");
});

test("time attack settlement posts the run and applies the returned account", async () => {
  const applied: unknown[] = [];
  const requests: Array<{ path: string; body: unknown }> = [];
  const summary = summaryFixture({ level: 4 });
  const result = await settleTimeAttack({
    requestJson: async (path, init) => {
      requests.push({ path, body: JSON.parse(String(init?.body)) });
      return { exp: 30, lucci: 70, newRecord: true, capped: false, account: summary };
    },
    applySummary: value => applied.push(value),
  }, { trackId: "village_R01", elapsedMs: 83_456.4, requestId: "req-1" });
  assert.deepEqual(requests, [{ path: "/api/timeattack/settle",
    body: { trackId: "village_R01", elapsedMs: 83_456, requestId: "req-1" } }]);
  assert.equal(result.exp, 30);
  assert.equal(result.lucci, 70);
  assert.equal(result.newRecord, true);
  assert.equal((applied[0] as typeof summary).progress.level, 4);
});
