// Unit tests for the license exporter's pure rules.
// Run from rewrite/: node --test tools/license-export/license.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import { licenseRows, localeRows, missionRows, outRunRow, ruleOf } from "./license.mjs";

const node = (name, attributes = {}, children = []) => ({
  name, text: "", children,
  attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value: String(value) })),
});

test("mission ids map to the Web build's clear rules", () => {
  assert.equal(ruleOf(20), "time");
  assert.equal(ruleOf(0), "drill");
  assert.equal(ruleOf(22), "time");
  assert.equal(ruleOf(21), "rival");
  for (const item of [1, 2, 3, 5, 6, 7, 8, 9, 11]) assert.equal(ruleOf(item), "item");
  // The missions with AI karts only ask for the finish.
  for (const npc of [4, 12, 13]) assert.equal(ruleOf(npc), "finish");
});

test("steps join the locale, rivals and reward stocks", () => {
  const problems = [];
  const problem = message => problems.push(message);
  const missions = missionRows(node("itemList", {}, [
    node("item", { step: 1, id: 20, icon: "missionIcon_a", track: "village_L01_04", time: 13000 }),
    node("item", { step: 2, id: 3, icon: "missionIcon_b", track: "village_C005", time: 30000,
      itemSlotCnt: 1, itemslot0: "rocket", targetName: "target2", targetArrow: "TRUE", hideMiniMap: "TRUE",
      nonLimitItem: "TRUE", startTutoScene: "아이템_미사일", showTimeUI: "FALSE" }),
    node("item", { step: 3, id: 21, icon: "missionIcon_c", track: "world_R01" }),
  ]), problem);
  const locale = localeRows(node("itemList", {}, [
    node("category", { catLevel: 0 }, [node("item", { step: 1 })]),
    node("category", { catLevel: 1 }, [
      node("item", { step: 1, name: "弯道练习  1", rewardStockId: 68 }),
      node("item", { step: 2, name: "导弹练习", rewardStockId: 590 }),
      node("item", { step: 3, name: "与克莉丝的对决", rewardStockId: 68 }),
    ]),
    node("proCategory", { emblemId: 8524 }, [node("item", { track: "mine_R01", gameSpeed: 7, timeLimit: 72000 })]),
  ]), problem);
  const outRun = outRunRow(node("OutRun", { kartId: 1430, characterId: 190, track: "world_R01", gameSpeed: 7 },
    [node("LevelContent", { level: 7, ksv: "L2_3_world_R01_7" })]), problem);
  const stocks = new Map([[68, { name: "气球", items: [{ category: 9, itemId: 2, count: 30, days: 0 }] }],
    [590, { name: "头饰", items: [{ category: 11, itemId: 95, count: 1, days: 30 }] }]]);
  const tracks = new Set(["village_l01_04", "village_c005", "world_r01", "mine_r01"]);
  const rows = licenseRows({ missions, locale, outRuns: new Map([[3, { ...outRun, rivalMs: 95300 }]]), stocks, tracks },
    problem);
  assert.deepEqual(problems, []);
  const [timed, item, duel] = rows.licenses[0].steps;
  assert.equal(timed.name, "弯道练习 1");
  assert.equal(timed.timeMs, 13000);
  // Item missions keep their release limit; their set-up travels along in setup.
  assert.equal(item.rule, "item");
  assert.equal(item.timeMs, 30000);
  assert.deepEqual(item.setup, { limitMs: 30000, slotCount: 1, slots: ["rocket"], targetName: "target2",
    startTutoScene: "아이템_미사일", targetArrow: true, nonLimitItem: true, showTimeUI: false, hideMiniMap: true });
  assert.deepEqual(timed.setup, { limitMs: 13000 });
  assert.deepEqual(duel.rival, { kartId: 1430, characterId: 190, ksv: "L2_3_world_R01_7" });
  assert.equal(duel.rivalMs, 95300);
  assert.deepEqual(Object.keys(rows.rewardStocks).sort(), ["590", "68"]);
  assert.equal(rows.pro.emblemId, 8524);

  licenseRows({ missions, locale, outRuns: new Map(), stocks: new Map(), tracks: new Set() }, problem);
  assert.ok(problems.some(message => /no rival ghost/.test(message)));
  assert.ok(problems.some(message => /not in stock.kml/.test(message)));
  assert.ok(problems.some(message => /has no track.1s/.test(message)));
});
