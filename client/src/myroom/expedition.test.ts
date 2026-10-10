import assert from "node:assert/strict";
import test from "node:test";

import {
  crewBonus, crewDeparts, kartBonus, missionDuration, missionPayout, parseExpeditionView, type ExpeditionRules,
} from "./expedition-api";

/** The server's rules (expedition.json) as GET /api/expedition sends them. */
const view = parseExpeditionView({
  missions: [{ slot: 1, mission: 1, specific: 2, trackId: "village_R03", theme: 3, bonusType: 1, difficulty: 1,
    hours: 8, state: "ready", crew: [], bonus: { time: 0, reward: 0 }, exp: 0, lucci: 960,
    reward: { stockId: 31900, name: "探险队补给箱(3 个)", items: [{ category: 24, itemId: 1228, count: 3, days: 0,
      name: "探险队补给箱" }] } }],
  started: 0, limit: 10, added: 0, canAdd: false, tokens: 10, weekStart: 1, weekEnds: 2, dayEnds: 3, serverTime: 4,
  rules: {
    basic: { weeklyMissions: 10, buyableMissions: 10, addMissionTokens: 3, reduceTimeTokens: 1, reduceMinutes: 30,
      changeMissionTokens: 2, token: { category: 34, item: 879 } },
    constants: { rp: 1000, lucci: 8000, rpLucci: 500, kartBody: 6, character: 50, characterMatched: 1000,
      characterUnmatched: 0 },
    kartTuning: { 0: [45, 43, 41, 39, 38], 5: [270, 259, 248, 236, 225] },
    parts: { 40: [27, 51, 73, 93, 111] },
    rewards: { 1: 120, 2: 230, 3: 330, 4: 420, 5: 500 },
    maxTimeBonus: 500, weeklyTokens: 10,
  },
});
const rules: ExpeditionRules = view.rules;

test("expedition views are validated", () => {
  assert.equal(view.missions[0]!.reward.items[0]!.name, "探险队补给箱");
  assert.equal(rules.kartTuning.get(5)![0], 270);
  assert.throws(() => parseExpeditionView({ missions: [{ slot: 1, state: "odd" }], rules: {} }));
});

// The same vectors as server-go/internal/data/expedition/expedition_test.go.
test("the crew preview follows the server's bonus rules", () => {
  const mission = { specific: 2, difficulty: 1, hours: 8, bonusType: 1 };
  assert.deepEqual(kartBonus(rules, mission, 9, 40), { time: 270, reward: 0, points: 27 });
  const matched = { characterSpecific: 2, kartSpecific: 5, kartLevel: 0, kartParts: 0 };
  const bonus = crewBonus(rules, mission, [matched, { characterSpecific: 1, kartSpecific: 2, kartLevel: 5,
    kartParts: 0 }], 4);
  assert.deepEqual(bonus, { time: 45 + 270, reward: 50 + 25, points: 0 });
  assert.equal(crewBonus(rules, mission, [{ characterSpecific: 0, kartSpecific: 0, kartLevel: 5, kartParts: 0 },
    { characterSpecific: 0, kartSpecific: 0, kartLevel: 5, kartParts: 0 },
    { characterSpecific: 0, kartSpecific: 0, kartLevel: 5, kartParts: 0 }]).time, 500);
  assert.equal(crewDeparts(mission, [matched]), false);
  assert.equal(crewDeparts(mission, [matched, { characterSpecific: 0, kartSpecific: 2, kartLevel: 0, kartParts: 0 }]),
    true);
  assert.equal(missionDuration(mission, { time: 500, reward: 0, points: 0 }), 4 * 3_600_000);
  assert.deepEqual(missionPayout(rules, mission, { time: 0, reward: 100, points: 10 }), { exp: 0, lucci: 1144 });
  assert.deepEqual(missionPayout(rules, { difficulty: 5, bonusType: 2 }, { time: 0, reward: 0, points: 0 }),
    { exp: 250, lucci: 2000 });
});
