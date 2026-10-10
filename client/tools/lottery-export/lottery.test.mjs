// Unit tests for the lottery exporter's pure rules.
// Run from client/: node --test tools/lottery-export/lottery.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import { itemRows, lotteryPeriod, lotteryRows, mileageRows, packRejection, packRows,
  treasureHuntRows } from "./lottery.mjs";

const node = (name, attributes = {}, children = []) => ({
  name, text: "", children,
  attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value: String(value) })),
});

const stock = (stockId, items, overrides = {}) => ({
  stockId, name: `stock ${stockId}`, price: 47, priceType: 0, isOnSale: true, isOnceADay: false,
  restriction: "", onBuyOk: "", rpLimit: 0,
  items: items.map(([category, itemId, count = 1, days = 0]) => ({ category, itemId, count, days })),
  ...overrides,
});

const items = new Map([
  ["24:1241", { category: 24, itemId: 1241, name: "光明骑士幸运宝石", effect: "可获得…", count: true }],
  ["24:862", { category: 24, itemId: 862, name: "幸运车胎", effect: "", count: true }],
  ["34:883", { category: 34, itemId: 883, name: "海洋寻宝放大镜", effect: "", count: true }],
  ["34:834", { category: 34, itemId: 834, name: "幸运藏宝图", effect: "", count: true }],
  ["3:1", { category: 3, itemId: 1, name: "车", effect: "", count: false }],
  ["3:2", { category: 3, itemId: 2, name: "", effect: "", count: false }],
]);

test("periods are Beijing time with open ends omitted", () => {
  assert.deepEqual(lotteryPeriod("2026-07-16T06:00:00~2026-08-13T05:59:59"),
    { start: "2026-07-16T06:00:00+08:00", end: "2026-08-13T05:59:59+08:00" });
  assert.deepEqual(lotteryPeriod("*~*"), {});
  assert.deepEqual(lotteryPeriod("2014-06-12T06:00:00~*"), { start: "2014-06-12T06:00:00+08:00" });
  assert.equal(lotteryPeriod("2026-08-13T05:59:59~2026-07-16T06:00:00"), undefined);
  assert.equal(lotteryPeriod("soon"), undefined);
});

test("lotteries keep every listed set, the needOther key and skip unknown items", () => {
  const problems = [], warnings = [];
  const stocks = new Map([[1, stock(1, [[3, 1]])], [2, stock(2, [[3, 2]])]]);
  const root = node("lotteryTable", {}, [
    node("lottery", { id: 1241, needOther: 862, clientNeedOther: 999, dialogCaption: "光明骑士幸运宝石",
      retryCount: 3, rpLimit: 500 }, [
      node("rewardSet", { id: 10 }, [node("reward", { stockId: 1, prob: 3, summary: 1, needToNotice: "true" })]),
      node("rewardSet", { id: 11 }, [node("reward", { stockId: 2, prob: 0 })]),
      node("rewardList", { period: "*~2026-10-22T05:59:59", refRewardSetId: "10,11" }),
    ]),
    node("lottery", { id: 799 }, [node("rewardList", { period: "*~*", refRewardSetId: "10" })]),
  ]);
  const { lotteries, rewardSets } = lotteryRows(root, { items, stocks, problem: m => problems.push(m),
    warn: m => warnings.push(m) });
  assert.deepEqual(problems, []);
  assert.equal(lotteries.length, 1);
  assert.deepEqual(lotteries[0], { itemId: 1241, name: "光明骑士幸运宝石", sets: [10, 11], effect: "可获得…",
    end: "2026-10-22T05:59:59+08:00", retry: 3, rpLimit: 500, key: 862 });
  assert.deepEqual(rewardSets, [{ id: 10, rewards: [{ stockId: 1, weight: 3, notice: true, summary: 1 }] },
    { id: 11, rewards: [{ stockId: 2, weight: 0 }] }]);
  assert.ok(warnings.some(m => m.includes("799")) && warnings.some(m => m.includes("rewardSet 11")));
});

test("treasure hunts need materials and summary slots 1..n", () => {
  const problems = [];
  const stocks = new Map([[1, stock(1, [[3, 1]])], [2, stock(2, [[3, 2]])]]);
  const root = node("TreasureHuntRewardTable", {}, [node("rewardSet", { id: 3,
    openPeriod: "2026-07-16T06:00:00~2026-08-13T05:59:59", needMaterialId: 883, needOtherMaterialId: 834,
    themeName: "summer" }, [node("reward", { stockId: 1, summary: 1, acquireCount: 50, effect: "true" }),
    node("reward", { stockId: 2 })])]);
  const [hunt] = treasureHuntRows(root, { stocks, items, problem: m => problems.push(m) });
  assert.deepEqual(problems, []);
  assert.deepEqual(hunt.rewards, [{ stockId: 1, summary: 1, acquireCount: 50, effect: true }, { stockId: 2 }]);
  assert.equal(hunt.material, 883);
  assert.equal(hunt.eventMaterial, undefined);
  const bad = node("TreasureHuntRewardTable", {}, [node("rewardSet", { id: 4,
    openPeriod: "*~*", needMaterialId: 883, needOtherMaterialId: 834, themeName: "x" },
  [node("reward", { stockId: 1, summary: 2 })])]);
  treasureHuntRows(bad, { stocks, items, problem: m => problems.push(m) });
  assert.ok(problems.some(m => m.includes("summary slots")));
});

test("mileage keeps lottery prizes in point order", () => {
  const problems = [], warnings = [];
  const stocks = new Map([[5, stock(5, [[3, 1]])], [6, stock(6, [[3, 2]])]]);
  const root = node("lotteryMileage", {}, [
    node("lottery", { type: "lottery", itemCatId: 24, itemId: 1241, eventItemId: 1242 },
      [node("prize", { points: 500, stockId: 6 }), node("prize", { points: 250, stockId: 5 })]),
    node("lottery", { type: "bingoSet", itemId: 1241 }),
    node("lottery", { type: "lottery", itemCatId: 24, itemId: 1216 }, [node("prize", { points: 1, stockId: 5 })]),
  ]);
  const rows = mileageRows(root, { stocks, lotteries: [{ itemId: 1241 }], problem: m => problems.push(m),
    warn: m => warnings.push(m) });
  assert.deepEqual(problems, []);
  assert.deepEqual(rows, [{ itemId: 1241, eventItemId: 1242,
    prizes: [{ points: 250, stockId: 5 }, { points: 500, stockId: 6 }] }]);
  assert.equal(warnings.length, 1);
});

test("packs: on-sale bundles of lottery items, materials or the key alone", () => {
  const stocks = new Map([
    [1, stock(1, [[24, 1241, 1], [9, 1491, 1]])],
    [2, stock(2, [[24, 862, 100]], { price: 10, priceType: 1 })],
    [3, stock(3, [[24, 862, 888], [24, 910, 8]])],
    [4, stock(4, [[34, 883, 30]], { isOnSale: false })],
    [5, stock(5, [[34, 834, 888]], { price: 1, priceType: 1 })],
    [6, stock(6, [[34, 883, 1]], { onBuyOk: "setEventTemp(1)" })],
  ]);
  const packs = packRows(stocks, { lotteries: [{ itemId: 1241, key: 862 }],
    treasureHunts: [{ material: 883, otherMaterial: 834 }] });
  assert.deepEqual(packs.map(pack => pack.stockId), [1, 2]);
  assert.deepEqual(packs[1], { stockId: 2, name: "stock 2", currency: "lucci", price: 10 });
  assert.equal(packRejection(stocks.get(5)), "lucciTokenPrice");
  assert.equal(packRejection(stocks.get(6)), "eventHook");
});

test("item names cover every named item", () => {
  const rows = itemRows(items);
  assert.deepEqual(rows.map(row => `${row.category}:${row.itemId}`), ["3:1", "24:862", "24:1241", "34:834", "34:883"]);
  assert.equal(rows.find(row => row.itemId === 1241).effect, "可获得…");
  assert.equal(rows.find(row => row.itemId === 1).count, undefined);
});
