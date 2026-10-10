/** Shared fixtures for the shop tests. */
import { readFileSync } from "node:fs";

import type { AccountSession, AccountSummary, InventoryItem } from "../account/account-session";
import { parseShopCatalog, type ShopCatalog } from "./shop-catalog";

export const CATALOG_JSON = {
  version: "v1",
  currencies: [
    { id: "coupon", name: "点券", priceType: 0 },
    { id: "lucci", name: "金币", priceType: 1 },
    { id: "koin", name: "K币", priceType: 3 },
  ],
  tabs: [
    { id: "recommend", name: "推荐", subTabs: [] },
    { id: "kartBody", name: "卡丁车", subTabs: [{ id: "itemKart", name: "道具车" }, { id: "speedKart", name: "竞速车" }] },
    { id: "character", name: "角色", subTabs: [
      { id: "character", name: "角色" }, { id: "pet", name: "宠物" }, { id: "flyingPet", name: "飞行宠物" }] },
    { id: "equip", name: "装备", subTabs: [{ id: "balloon", name: "气球" }, { id: "aura", name: "光环" }] },
  ],
  starter: { characters: [2, 3] },
  items: [
    { category: 3, itemId: 10, kind: "kart", name: "尖锋6.5", internalId: "saber10", tab: "kartBody",
      subTab: "speedKart", engineGrade: 2, kartType: 2, marks: ["hot"], recommend: ["hotItem"], desc: "快",
      offers: [
        { offerId: "s1", currency: "coupon", price: 120, days: 30, count: 1, source: "original" },
        { offerId: "s2", currency: "coupon", price: 216, days: 0, count: 1, source: "original" },
        { offerId: "s3", currency: "lucci", price: 2500, days: 30, count: 1, source: "original" },
      ] },
    { category: 3, itemId: 20, kind: "kart", name: "爆烈 E2", internalId: "burst2", tab: "kartBody",
      subTab: "itemKart", engineGrade: 9, kartType: 1,
      offers: [{ offerId: "s4", currency: "lucci", price: 5000, days: 0, count: 1, source: "original" }] },
    { category: 3, itemId: 5, kind: "kart", name: "oldKart (5)", internalId: "oldKart", tab: "kartBody",
      subTab: "speedKart", engineGrade: 1, kartType: 2,
      offers: [{ offerId: "e3-5-0", currency: "coupon", price: 195, days: 0, count: 1, source: "estimated" }] },
    { category: 1, itemId: 2, kind: "character", name: "皮蛋", internalId: "dao", tab: "character",
      subTab: "character",
      offers: [
        { offerId: "s5", currency: "coupon", price: 29, days: 7, count: 1, source: "original" },
        { offerId: "s6", currency: "lucci", price: 1500, days: 0, count: 1, source: "original" },
      ] },
    { category: 9, itemId: 1, kind: "balloon", name: "粉红色心型气球", internalId: "핑크하트풍선", tab: "equip",
      subTab: "balloon", isAdditional: true,
      offers: [
        { offerId: "s7", currency: "coupon", price: 20, days: 0, count: 50, source: "original" },
        { offerId: "s8", currency: "coupon", price: 35, days: 0, count: 100, source: "original" },
      ] },
    { category: 26, itemId: 2, kind: "aura", name: "翠绿炫光", internalId: "aura2", tab: "equip", subTab: "aura",
      marks: ["new"],
      offers: [
        { offerId: "s9", currency: "coupon", price: 30, days: 10, count: 1, minExp: 600, source: "original" },
        { offerId: "s10", currency: "koin", price: 6, days: 7, count: 1, source: "original" },
      ] },
  ],
};

export function fixtureCatalog(): ShopCatalog {
  return parseShopCatalog(structuredClone(CATALOG_JSON));
}

/** Where each fixture item sits in the original mall (catalog shopTabs, ECONOMY.md 3.2.1). */
const MALL_PLACES: Record<string, Record<string, unknown>> = {
  "3:10": { shopCategory: "kartBody", shopSubCategory: "engineEtc", displayOfferId: "s2" },
  "3:20": { shopCategory: "kartBody", shopSubCategory: "engineXun", displayOfferId: "s4" },
  "3:5": { shopCategory: "kartBody", shopSubCategory: "engineEtc", displayOfferId: "e3-5-0" },
  "1:2": { shopCategory: "character", displayOfferId: "s5" },
  "9:1": { shopCategory: "equip", shopSubCategory: "balloon", displayOfferId: "s7" },
  "26:2": { shopCategory: "equip", shopSubCategory: "etc", displayOfferId: "s9" },
};

/**
 * The fixture with the original mall layout the data service now serves:
 * shopTabs (推荐 without 全部, 卡丁车 by engine, 礼包 and 使用 empty), card
 * items, a discounted 限购 offer and the card prices (displayOfferId).
 */
export const MALL_CATALOG_JSON = {
  ...structuredClone(CATALOG_JSON),
  shopTabs: [
    { id: "recommand", name: "推荐", defaultSubTab: "new", subTabs: [
      { id: "new", name: "新商品", cardItems: ["3:10", "16:364", "26:2"] },
      { id: "hotItem", name: "热门商品", cardItems: ["16:364", "3:10"] },
      { id: "event", name: "活动", cardItems: ["16:364"] }] },
    { id: "kartBody", name: "卡丁车", allSubTab: "全部", subTabs: [
      { id: "engineXun", name: "迅 引擎", cardItems: ["3:20"] },
      { id: "engineV1", name: "V1 引擎", cardItems: [] },
      { id: "engineEtc", name: "其他引擎", cardItems: [] },
      { id: "strengthen", name: "改装部件", cardItems: [] },
      { id: "tunningXun", name: "强化材料", cardItems: [] }] },
    { id: "character", name: "角色", subTabs: [], cardItems: ["1:2"] },
    { id: "package", name: "礼包", subTabs: [], cardItems: [] },
    { id: "equip", name: "装备", allSubTab: "全部", subTabs: [
      { id: "balloon", name: "气球", cardItems: ["9:1"] },
      { id: "headband", name: "电磁波头带", cardItems: [] },
      { id: "goggle", name: "防尘眼镜", cardItems: [] },
      { id: "color", name: "喷漆", cardItems: [] },
      { id: "dye", name: "染色剂", cardItems: [] },
      { id: "couple", name: "情侣", cardItems: [] },
      { id: "etc", name: "其它", cardItems: ["16:364"] }] },
    { id: "useful", name: "使用", allSubTab: "全部", subTabs: [
      { id: "specialKit", name: "必杀技", cardItems: [] },
      { id: "card", name: "卡片类", cardItems: [] },
      { id: "etc", name: "其它", cardItems: [] }] },
  ],
  items: [
    ...CATALOG_JSON.items.map(item => ({ ...item, ...MALL_PLACES[`${item.category}:${item.itemId}`] })),
    { category: 16, itemId: 364, kind: "handGearL", name: "SVIP通行证手杖", internalId: "svip", tab: "equip",
      subTab: "handGear", shopCategory: "equip", shopSubCategory: "etc", recommend: ["new", "hotItem", "event"],
      marks: ["discount", "limited"], displayOfferId: "s12",
      offers: [
        { offerId: "s11", currency: "coupon", price: 200, days: 7, count: 1, source: "original" },
        { offerId: "s12", currency: "coupon", price: 360, days: 14, count: 1, source: "original",
          originalPrice: 400, discountPercent: 10, discountLabel: "9折", limited: true, buyLimit: 1 },
      ] },
  ],
};

export function mallCatalog(): ShopCatalog {
  return parseShopCatalog(structuredClone(MALL_CATALOG_JSON));
}

/** GET /api/shop/spend-event as the data service answers it (ECONOMY.md 6), with the exported event. */
export function spendEventJson(spent = 0, overrides: Record<string, unknown> = {}) {
  return {
    event: {
      eventType: "use",
      eventPeriod: { start: "2026-09-17T06:00:00+08:00", end: "2026-10-15T05:59:59+08:00" },
      rewardPeriod: { start: "2026-09-17T06:00:00+08:00", end: "2026-10-22T05:59:59+08:00" },
      steps: [
        { step: 1, value: 1000, stockId: 32336, reward: { name: "[活动]光明骑士幸运宝石", category: 24, itemId: 1242, count: 10, days: 0, iconHint: "etc" } },
        { step: 2, value: 2000, stockId: 29631, reward: { name: "迅 部件碎片", category: 67, itemId: 3, count: 200, days: 0, iconHint: "etc" } },
        { step: 3, value: 5000, stockId: 32396, reward: { name: "[活动]光明骑士幸运宝石", category: 24, itemId: 1242, count: 40, days: 0, iconHint: "etc" } },
        { step: 4, value: 8000, stockId: 32344, reward: { name: "孔明灯车手栏背景", category: 71, itemId: 16, count: 1, days: 0, iconHint: "slotBg" } },
      ],
    },
    spent, active: true, serverTime: Date.parse("2026-10-09T12:00:00+08:00"),
    ...overrides,
  };
}

const REAL_EVENTS = new URL("../../../server-go/internal/data/economy/events.json", import.meta.url);

/** The exported events.json (the data service's 累计消费活动). */
export function realEventsJson(): { tcCashEvents: unknown[] } {
  return JSON.parse(readFileSync(REAL_EVENTS, "utf8")) as { tcCashEvents: unknown[] };
}

const REAL_CATALOG = new URL("../../../server-go/internal/data/economy/catalog.json", import.meta.url);

/** The exported catalog served by the data service. */
export function realCatalogJson(): unknown {
  return JSON.parse(readFileSync(REAL_CATALOG, "utf8"));
}

export function summary(wallet: AccountSummary["wallet"], exp = 0): AccountSummary {
  return {
    account: { username: "rider", nickname: "车手", admin: false, createdAt: 0 },
    progress: { level: 1, exp, levelExp: 0, nextLevelExp: 100, glove: "", gloveName: "", maxLevel: 127 },
    wallet,
    stats: { races: 0, wins: 0, podiums: 0, points: 0 },
    onboarded: true,
  };
}

export interface FetchCall { path: string; init: RequestInit | undefined }

/** A session whose authorizedFetch answers from a queue of handlers. */
export function fakeSession(handlers: ((call: FetchCall) => Response | Promise<Response>)[],
  state: { summary?: AccountSummary; inventory?: InventoryItem[] } = {}):
  AccountSession & { calls: FetchCall[]; refreshes: number } {
  const calls: FetchCall[] = [];
  const session = {
    backendOrigin: `https://data.test/${Math.random()}`,
    calls,
    refreshes: 0,
    summary: () => state.summary,
    inventory: () => state.inventory ?? [],
    owns: () => false,
    refresh: async () => { session.refreshes++; },
    subscribe: () => () => {},
    authorizedFetch: async (path: string, init?: RequestInit) => {
      const call = { path, init };
      calls.push(call);
      const handler = handlers.shift();
      if (!handler) throw new Error(`unexpected request ${path}`);
      return handler(call);
    },
  };
  return session;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...headers },
  });
}

export function requestHeader(call: FetchCall, name: string): string | undefined {
  const headers = new Headers(call.init?.headers);
  return headers.get(name) ?? undefined;
}

export function requestBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}
