import assert from "node:assert/strict";
import test from "node:test";

import { AccountServiceError } from "../account/account-api";
import { LotteryApi, lotteryErrorMessage, parseDrawResult, parseGachaDetail, parseGachaList,
  parseTreasureHunt } from "./lottery-api";
import { affordable, chanceText, fillString, grantedItems, itemLine, itemsLine, packPrice, periodLine,
  stopMessage } from "./lottery-model";

const wallet = { coupon: 100, lucci: 5000, koin: 3 };

const huntBody = {
  activity: { open: true, enabled: true, start: null, end: null },
  huntId: 3, theme: "summer",
  slots: [
    { slot: 1, rarity: "ultimate", stockId: 31988, chance: 666, acquireCount: 750, counter: 10, remaining: 740,
      items: [{ category: 3, itemId: 1528, name: "天蝎 迅", count: 1, days: 0 }] },
    { slot: 5, rarity: "rare", stockId: 30132, chance: 5000, items: [{ category: 3, itemId: 1, name: "部件", count: 1, days: 0 }] },
  ],
  others: { rewards: 165, chance: 959805 },
  materials: {
    material: { category: 34, itemId: 883, name: "海洋寻宝放大镜", owned: 2 },
    eventMaterial: { category: 34, itemId: 884, name: "[活动]海洋寻宝放大镜", owned: 5 },
    other: { category: 34, itemId: 834, name: "幸运藏宝图", owned: 7 },
  },
  packs: [{ stockId: 32023, name: "海洋寻宝放大镜礼包(1 个)", currency: "coupon", price: 47,
    items: [{ category: 34, itemId: 883, name: "海洋寻宝放大镜", count: 1, days: 0 }] }],
  daily: { available: true, claimed: false, items: [{ category: 34, itemId: 884, name: "[活动]海洋寻宝放大镜", count: 5, days: 0 }] },
  rewards: 174,
};

test("treasure hunt state parses slots, 保底, materials, packs and daily items", () => {
  const state = parseTreasureHunt(huntBody);
  assert.equal(state.slots.length, 2);
  assert.deepEqual([state.slots[0]!.rarity, state.slots[0]!.acquireCount, state.slots[0]!.remaining], ["ultimate", 750, 740]);
  assert.equal(state.slots[1]!.acquireCount, undefined);
  assert.equal(state.materials.eventMaterial?.owned, 5);
  assert.equal(state.activity.start, undefined);
  assert.equal(state.packs[0]!.currency, "coupon");
  assert.equal(state.daily.items[0]!.count, 5);
  assert.throws(() => parseTreasureHunt({ ...huntBody, slots: "x" }),
    (error: unknown) => error instanceof AccountServiceError && error.code === "INVALID_RESPONSE");
});

test("draw results parse draws, stops, prizes, holdings and counters", () => {
  const result = parseDrawResult({
    draws: [{ stocks: [7], items: [{ category: 62, itemId: 1, name: "电池", count: 2, days: 0, currency: "coupon" }],
      slot: 0, rarity: "normal", event: true }],
    stopped: { code: "INSUFFICIENT_ITEMS", item: { category: 34, itemId: 883, name: "海洋寻宝放大镜", count: 1, days: 0 } },
    prizes: [{ stocks: [4], items: [{ category: 56, itemId: 1, name: "酷币", count: 5, days: 0, currency: "koin" }] }],
    wallet, holdings: { "34:883": 0, "34:884": 4 }, counters: { "hunt:3:31988": 11 },
  });
  assert.equal(result.draws[0]!.event, true);
  assert.equal(result.draws[0]!.items[0]!.currency, "coupon");
  assert.equal(result.holdings.get("34:884"), 4);
  assert.equal(result.counters.get("hunt:3:31988"), 11);
  assert.equal(result.stopped?.item?.itemId, 883);
  assert.equal(grantedItems(result).length, 2);
  assert.equal(stopMessage(result), "海洋寻宝放大镜不足，已停止。");
  assert.equal(stopMessage({ ...result, draws: [] }), "海洋寻宝放大镜持有数量不足，无法使用。");
  assert.match(stopMessage({ draws: [], stopped: { code: "ALREADY_OWNED", item: result.stopped!.item! } })!,
    /已永久持有的「海洋寻宝放大镜」，本次未消耗道具/);
  assert.equal(stopMessage({ draws: [] }), undefined);
});

test("the 精品道具场 list and detail parse", () => {
  const list = parseGachaList({ activity: { open: true, enabled: true }, daily: { available: false, claimed: true, items: [] },
    lotteries: [{ itemId: 1241, name: "光明骑士幸运宝石", owned: 3, featured: true, open: true,
      key: { category: 24, itemId: 862, name: "幸运车胎", owned: 99 } }] });
  assert.equal(list.lotteries[0]!.key?.owned, 99);
  const detail = parseGachaDetail({
    lottery: { itemId: 1233, name: "启程加速箱", caption: "", desc: "", effect: "可获得…", dialog: "", sets: 1, rewards: 205 },
    activity: { open: true, enabled: true, end: 1_800_000_000_000 }, owned: 2,
    summary: [{ stockId: 1, notice: true, items: [{ category: 3, itemId: 2, name: "车", count: 1, days: 0 }] }],
    mileage: { points: 120, event: false, prizes: [{ points: 500, items: [{ category: 3, itemId: 5, name: "奖", count: 1, days: 0 }] }] },
    packs: [], daily: { available: true, claimed: false, items: [] },
  });
  assert.equal(detail.mileage?.points, 120);
  assert.equal(detail.activity.end, 1_800_000_000_000);
  assert.equal(detail.key, undefined);
});

test("the api posts draw, pack and daily requests", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const api = new LotteryApi({ async requestJson(path, init) {
    calls.push({ path, ...(init ? { init } : {}) });
    if (path === "/api/lottery/packs/buy") return { wallet, items: [], purchaseId: 7 };
    if (path === "/api/lottery/daily") return { wallet, items: [] };
    if (path === "/api/lottery/items") return { version: "v", items: [{ category: 24, itemId: 1241, name: "光明骑士幸运宝石", count: true }] };
    return { draws: [], prizes: [], wallet, holdings: {}, counters: {} };
  } });
  await api.treasureDraw(10, "00000000-0000-4000-8000-000000000001");
  await api.gachaDraw(1241, 3, "00000000-0000-4000-8000-000000000002");
  assert.equal((await api.buyPack({ stockId: 32023, price: 47, currency: "coupon" })).purchaseId, 7);
  await api.claimDaily("gacha");
  const names = await api.itemNames();
  await api.itemNames();
  assert.equal(names.get("24:1241")?.count, true);
  assert.deepEqual(calls.map(call => call.path), ["/api/lottery/treasure-hunt/draw", "/api/lottery/gacha/draw",
    "/api/lottery/packs/buy", "/api/lottery/daily", "/api/lottery/items"]);
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), { requestId: "00000000-0000-4000-8000-000000000001", count: 10 });
  assert.deepEqual(JSON.parse(String(calls[2]!.init?.body)).expectedPrice, 47);
});

test("lines, prices, periods and original strings", () => {
  assert.equal(itemLine({ name: "天蝎 迅", count: 1, days: 0 }), "天蝎 迅");
  assert.equal(itemLine({ name: "测试气球", count: 10, days: 0 }), "测试气球 ×10");
  assert.equal(itemLine({ name: "角色", count: 1, days: 30 }), "角色（30天）");
  assert.equal(itemLine({ name: "酷币", count: 1, days: 0, currency: "koin" }), "酷币 ×1");
  assert.equal(itemsLine([{ category: 1, itemId: 1, name: "A", count: 1, days: 0 },
    { category: 9, itemId: 2, name: "B", count: 5, days: 0 }]), "A + B ×5");
  assert.equal(packPrice({ price: 1269, currency: "coupon" }), "1,269 点券");
  assert.equal(affordable({ price: 47, currency: "coupon" }, wallet), true);
  assert.equal(affordable({ price: 101, currency: "coupon" }, wallet), false);
  const start = new Date(2026, 9, 1, 6).getTime();
  const end = new Date(2026, 9, 22, 6).getTime();
  assert.equal(periodLine({ start, end }), "2026.10.1 ~ 2026.10.22");
  assert.equal(periodLine({ end }), "2026.10.22截止");
  assert.equal(periodLine({}), "");
  assert.equal(chanceText(666), "0.0666%");
  assert.equal(chanceText(10_000), "1%");
  assert.equal(chanceText(959_805), "95.98%");
  assert.equal(fillString("[color:255 0 221 254]%d[/color]次以内可获得", 740), "740次以内可获得");
  assert.equal(fillString("消耗%s和%s道具", "放大镜", "藏宝图"), "消耗放大镜和藏宝图道具");
  assert.equal(fillString("恭喜!獲得“%1!s!” “%2!s!”", "A", "B"), "恭喜!獲得“A” “B”");
  assert.equal(lotteryErrorMessage("LOTTERY_CLOSED"), "活动当前未开放。");
  assert.equal(lotteryErrorMessage(new AccountServiceError("ALREADY_CLAIMED", 409)), "今天的免费道具已经领取过了。");
});
