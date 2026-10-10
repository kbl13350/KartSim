import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryItem } from "../account/account-session";
import { remainingLabel } from "../account/ownership";
import { parseShopCatalog } from "./shop-catalog";
import {
  ALL_SUB_TAB, catalogTabId, clampSearch, defaultOffer, defaultShopQuery, displayOffer,
  engineLabel, formatAmount, formatDateTime, formatExpRequirement, formatOfferTerm, formatPeriod,
  formatPrice, formatRemaining, inventoryIndex, kindLabel, lineWindowOf, NOT_OWNED, offerAvailability, orderedOffers,
  ownedForGood, ownedRental, ownershipLabel, ownershipOf, pageOf, queryShop, RECOMMEND_TAB,
  renewalNote, SHOP_PAGE_SIZE, shopTabEntries, ShopIndex, type ShopQuery,
} from "./shop-model";
import { fixtureCatalog, MALL_CATALOG_JSON, mallCatalog, realCatalogJson } from "./shop-test-fixtures";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 7, 12);

function names(list: readonly { item: { name: string } }[]): string[] {
  return list.map(entry => entry.item.name);
}

function query(overrides: Partial<ShopQuery>): ShopQuery {
  return { ...defaultShopQuery(), ...overrides };
}

test("页签按原版 stage_mqShop：推荐在前，子页签以全部开头", () => {
  const tabs = shopTabEntries(fixtureCatalog());
  assert.deepEqual(tabs.map(tab => tab.name), ["推荐", "卡丁车", "角色", "装备"]);
  // 推荐: one sub-tab per card mark the catalog has (shopCat recommand new / hotItem / discount).
  assert.deepEqual(tabs[0]!.subTabs.map(sub => [sub.id, sub.name]),
    [[ALL_SUB_TAB, "全部"], ["new", "新商品"], ["hot", "热门商品"]]);
  const plain = { ...fixtureCatalog(), items: fixtureCatalog().items.map(item => ({ ...item, marks: undefined })) };
  assert.deepEqual(shopTabEntries(plain)[0]!.subTabs, []);
  assert.deepEqual(tabs[1]!.subTabs.map(sub => sub.name), ["全部", "道具车", "竞速车"]);
  assert.deepEqual(tabs[2]!.subTabs.map(sub => sub.id), [ALL_SUB_TAB, "character", "pet", "flyingPet"]);
  assert.equal(catalogTabId("recommand"), RECOMMEND_TAB);
  assert.equal(catalogTabId(undefined), RECOMMEND_TAB);
  assert.equal(catalogTabId("equip"), "equip");
});

test("推荐列出当前卡片与标记物品，分类与子分类各自成表", () => {
  const index = new ShopIndex(fixtureCatalog());
  assert.deepEqual(names(index.list(RECOMMEND_TAB)), ["尖锋6.5", "翠绿炫光"]);
  assert.deepEqual(names(index.list(RECOMMEND_TAB, "new")), ["翠绿炫光"]);
  assert.deepEqual(names(index.list(RECOMMEND_TAB, "hot")), ["尖锋6.5"]);
  assert.deepEqual(names(index.list("kartBody")), ["尖锋6.5", "爆烈 E2", "oldKart (5)"]);
  assert.deepEqual(names(index.list("kartBody", "itemKart")), ["爆烈 E2"]);
  assert.deepEqual(names(index.list("equip", "balloon")), ["粉红色心型气球"]);
  assert.deepEqual(index.list("missing"), []);
  assert.equal(index.entry(3, 10)?.item.name, "尖锋6.5");
  assert.equal(index.get("1:2")?.item.name, "皮蛋");
});

test("默认排序：新品/人气在前，有中文名在前，其余按新到旧", () => {
  const index = new ShopIndex(fixtureCatalog());
  assert.deepEqual(names(queryShop(index, query({ tab: "kartBody" }))), ["尖锋6.5", "爆烈 E2", "oldKart (5)"]);
  assert.deepEqual(names(queryShop(index, query({ tab: "kartBody", sort: "newest" }))),
    ["爆烈 E2", "尖锋6.5", "oldKart (5)"]);
  assert.deepEqual(names(queryShop(index, query({ tab: "equip" }))), ["翠绿炫光", "粉红色心型气球"]);
});

test("价格排序按货币分组（点券、金币、K币），货币筛选后按该货币价格", () => {
  const index = new ShopIndex(fixtureCatalog());
  const all = query({ tab: "kartBody", sort: "priceAsc" });
  assert.deepEqual(names(queryShop(index, all)), ["尖锋6.5", "oldKart (5)", "爆烈 E2"]);
  assert.deepEqual(names(queryShop(index, { ...all, sort: "priceDesc" })), ["oldKart (5)", "尖锋6.5", "爆烈 E2"]);
  const lucci = query({ tab: "kartBody", sort: "priceDesc", currency: "lucci" });
  assert.deepEqual(names(queryShop(index, lucci)), ["爆烈 E2", "尖锋6.5"]);
  assert.equal(displayOffer(index.entry(3, 10)!, "lucci")?.offerId, "s3");
  assert.equal(displayOffer(index.entry(3, 10)!)?.offerId, "s1");
  assert.equal(displayOffer(index.entry(3, 20)!, "koin"), undefined);
});

test("按名称排序：中文名按拼音，未命名物品排在最后", () => {
  const index = new ShopIndex(fixtureCatalog());
  assert.deepEqual(names(queryShop(index, query({ tab: "kartBody", sort: "name" }))),
    ["爆烈 E2", "尖锋6.5", "oldKart (5)"]);
});

test("搜索覆盖全部页签，不区分大小写，可搜内部名，最多 10 个字", () => {
  const index = new ShopIndex(fixtureCatalog());
  assert.deepEqual(names(queryShop(index, query({ tab: "equip", search: "皮蛋" }))), ["皮蛋"]);
  assert.deepEqual(names(queryShop(index, query({ search: "  BURST " }))), ["爆烈 E2"]);
  assert.deepEqual(names(queryShop(index, query({ search: "炫光" }))), ["翠绿炫光"]);
  assert.deepEqual(queryShop(index, query({ search: "不存在的道具" })), []);
  assert.equal(clampSearch("一二三四五六七八九十十一"), "一二三四五六七八九十");
  assert.equal([...clampSearch("😀".repeat(12))].length, 10);
  // A tab list without a search, filter or owned check is returned as is.
  assert.equal(queryShop(index, query({ tab: "kartBody" })), queryShop(index, query({ tab: "kartBody" })));
});

test("隐藏已拥有只用于开启时", () => {
  const index = new ShopIndex(fixtureCatalog());
  const owned = (entry: { key: string }) => entry.key === "3:10";
  assert.equal(queryShop(index, query({ tab: "kartBody" }), owned).length, 3);
  assert.deepEqual(names(queryShop(index, query({ tab: "kartBody", hideOwned: true }), owned)),
    ["爆烈 E2", "oldKart (5)"]);
});

test("分页每页 3×3，页码越界时夹到有效范围", () => {
  const list = Array.from({ length: 20 }, (_, index) => index);
  assert.equal(SHOP_PAGE_SIZE, 9);
  assert.deepEqual(pageOf(list, 0).items, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const last = pageOf(list, 99);
  assert.deepEqual({ page: last.page, count: last.pageCount, items: last.items }, { page: 2, count: 3, items: [18, 19] });
  assert.equal(pageOf(list, -3).page, 0);
  assert.equal(pageOf(list, Number.NaN).page, 0);
  const empty = pageOf([], 4);
  assert.deepEqual({ page: empty.page, pageCount: empty.pageCount, total: empty.total }, { page: 0, pageCount: 1, total: 0 });
  assert.equal(pageOf(list, 1, 6).items.length, 6);
});

test("原版 itemList 按行翻页（linePaging）：每次滚动一行，显示 3 行 × 3 列", () => {
  const list = Array.from({ length: 20 }, (_, index) => index);
  const first = lineWindowOf(list, 0);
  assert.deepEqual(first.items, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  // Seven rows, three visible: five scroll positions.
  assert.equal(first.lineCount, 5);
  assert.deepEqual(lineWindowOf(list, 1).items, [3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const last = lineWindowOf(list, 99);
  assert.deepEqual({ line: last.line, items: last.items }, { line: 4, items: [12, 13, 14, 15, 16, 17, 18, 19] });
  assert.equal(lineWindowOf(list, -2).line, 0);
  assert.equal(lineWindowOf(list, Number.NaN).line, 0);
  assert.deepEqual(lineWindowOf(list.slice(0, 7), 3), { items: [0, 1, 2, 3, 4, 5, 6], line: 0, lineCount: 1, total: 7 });
  assert.deepEqual(lineWindowOf([], 0), { items: [], line: 0, lineCount: 1, total: 0 });
});

test("库存：过期与系统车不算拥有，永久/限时/数量各有标签", () => {
  const inventory: InventoryItem[] = [
    { category: 3, itemId: 10, quantity: 1, expiresAt: null, source: "shop" },
    { category: 1, itemId: 2, quantity: 1, expiresAt: NOW + 2.5 * DAY, source: "shop" },
    { category: 26, itemId: 2, quantity: 1, expiresAt: NOW - 1, source: "shop" },
    { category: 9, itemId: 1, quantity: 150, expiresAt: null, source: "shop" },
    { category: 3, itemId: 0, systemKey: "practiceKart", quantity: 1, expiresAt: null, source: "starter" },
  ];
  const index = inventoryIndex(inventory, NOW);
  assert.deepEqual([...index.keys()].sort(), ["1:2", "3:10", "9:1"]);
  const catalog = fixtureCatalog();
  const item = (category: number, itemId: number) =>
    catalog.items.find(entry => entry.category === category && entry.itemId === itemId)!;
  const kart = ownershipOf(item(3, 10), index, NOW);
  assert.deepEqual(kart, { owned: true, permanent: true, expiresAt: null, quantity: 1 });
  assert.equal(ownershipLabel(item(3, 10), kart, NOW), "已永久拥有");
  assert.equal(ownedForGood(item(3, 10), kart), true);
  const rider = ownershipOf(item(1, 2), index, NOW);
  // 2.5 days left: the garage's text ("剩余 2 天"), not a rounded-up count.
  assert.equal(ownershipLabel(item(1, 2), rider, NOW), "剩余 2 天");
  assert.equal(ownedForGood(item(1, 2), rider), false);
  assert.equal(ownershipOf(item(26, 2), index, NOW), NOT_OWNED);
  const balloon = ownershipOf(item(9, 1), index, NOW);
  assert.equal(ownershipLabel(item(9, 1), balloon, NOW), "已拥有 150个");
  assert.equal(ownedForGood(item(9, 1), balloon), false);
  assert.equal(ownershipLabel(item(26, 2), NOT_OWNED, NOW), "");
  // The session's owns() covers what the snapshot lacks.
  assert.equal(ownershipOf(item(3, 20), index, NOW, (category, itemId) => category === 3 && itemId === 20).owned, true);
  // A rental that ends later wins over an earlier duplicate.
  const twice = inventoryIndex([
    { category: 1, itemId: 2, quantity: 1, expiresAt: NOW + DAY, source: "a" },
    { category: 1, itemId: 2, quantity: 1, expiresAt: NOW + 5 * DAY, source: "b" },
  ], NOW);
  assert.equal(twice.get("1:2")?.source, "b");
});

test("报价可买性：永久拥有、经验不足、余额不足", () => {
  const catalog = fixtureCatalog();
  const kart = catalog.items[0]!;
  const aura = catalog.items.find(item => item.kind === "aura")!;
  const balloon = catalog.items.find(item => item.kind === "balloon")!;
  const wallet = { coupon: 100, lucci: 3000, koin: 0 };
  const permanent = { owned: true, permanent: true, expiresAt: null, quantity: 1 };
  const free = offerAvailability(kart, kart.offers[2]!, { wallet, ownership: NOT_OWNED });
  assert.deepEqual({ blocked: free.blocked, balance: free.balance, after: free.after },
    { blocked: undefined, balance: 3000, after: 500 });
  const poor = offerAvailability(kart, kart.offers[1]!, { wallet, ownership: NOT_OWNED });
  assert.deepEqual({ blocked: poor.blocked, reason: poor.reason, after: poor.after },
    { blocked: "funds", reason: "点券不足", after: -116 });
  assert.equal(offerAvailability(kart, kart.offers[0]!, { wallet, ownership: permanent }).blocked, "owned");
  const exp = offerAvailability(aura, aura.offers[0]!, { wallet, exp: 599, ownership: NOT_OWNED });
  assert.deepEqual({ blocked: exp.blocked, reason: exp.reason }, { blocked: "exp", reason: "经验不足，需要经验 600" });
  assert.equal(offerAvailability(aura, aura.offers[0]!, { wallet, exp: 600, ownership: NOT_OWNED }).blocked, undefined);
  // Count items stack: owning some never blocks buying more.
  assert.equal(offerAvailability(balloon, balloon.offers[0]!, { wallet, ownership: permanent }).blocked, undefined);
  // Without a known wallet the server decides.
  const unknown = offerAvailability(kart, kart.offers[1]!, { ownership: NOT_OWNED });
  assert.deepEqual({ blocked: unknown.blocked, balance: unknown.balance }, { blocked: undefined, balance: undefined });
});

test("默认报价：卡片货币中最便宜且买得起的；都买不起时仍给出卡片报价", () => {
  const index = new ShopIndex(fixtureCatalog());
  const kart = index.entry(3, 10)!;
  const rich = { coupon: 1000, lucci: 9000, koin: 0 };
  assert.equal(defaultOffer(kart, { wallet: rich, ownership: NOT_OWNED }).offerId, "s1");
  assert.equal(defaultOffer(kart, { wallet: rich, ownership: NOT_OWNED }, "lucci").offerId, "s3");
  assert.equal(defaultOffer(kart, { wallet: { coupon: 0, lucci: 9000, koin: 0 }, ownership: NOT_OWNED }).offerId, "s3");
  assert.equal(defaultOffer(kart, { wallet: { coupon: 0, lucci: 0, koin: 0 }, ownership: NOT_OWNED }).offerId, "s1");
  assert.deepEqual(orderedOffers(kart.item).map(offer => offer.offerId), ["s1", "s2", "s3"]);
  const rider = index.entry(1, 2)!;
  assert.deepEqual(orderedOffers(rider.item).map(offer => offer.offerId), ["s5", "s6"]);
});

test("价格、期限、剩余时间与经验门槛的中文格式", () => {
  assert.equal(formatAmount(1234567), "1,234,567");
  assert.equal(formatPrice(1200, "coupon"), "1,200 点券");
  assert.equal(formatPrice(2500, "lucci"), "2,500 金币");
  assert.equal(formatPrice(6, "koin"), "6 K币");
  assert.equal(formatPeriod(0), "永久");
  assert.equal(formatPeriod(30), "30天");
  assert.equal(formatOfferTerm({ days: 7, count: 1 }), "7天");
  assert.equal(formatOfferTerm({ days: 0, count: 100 }, { isAdditional: true }), "100个");
  assert.equal(formatOfferTerm({ days: 30, count: 50 }), "50个·30天");
  assert.equal(formatRemaining(NOW + 3 * DAY, NOW), "剩余 3 天");
  assert.equal(formatRemaining(NOW + DAY + 1, NOW), "剩余 1 天");
  assert.equal(formatRemaining(NOW + 5.5 * 3_600_000, NOW), "剩余 5 小时");
  assert.equal(formatRemaining(NOW + 60_000, NOW), "剩余 1 分钟");
  assert.equal(formatRemaining(NOW - 1, NOW), "已过期");
  assert.equal(formatExpRequirement(9900), "需要经验 9,900");
  const catalog = fixtureCatalog();
  assert.equal(kindLabel(catalog.items[0]!), "竞速车");
  assert.equal(kindLabel(catalog.items[1]!), "道具车");
  assert.equal(kindLabel(catalog.items[4]!), "气球");
  assert.equal(engineLabel(catalog.items[1]!), "迅引擎");
  assert.equal(engineLabel(catalog.items[3]!), undefined);
});

test("真实目录：6,000+ 件全部通过校验，索引、搜索与排序都很快", () => {
  const started = performance.now();
  const catalog = parseShopCatalog(realCatalogJson());
  const index = new ShopIndex(catalog);
  const built = performance.now() - started;
  assert.ok(catalog.items.length > 6000, `${catalog.items.length}`);
  // The original mall layout (shopTabs) drives the shop.
  assert.equal(index.mall, true);
  const tabs = index.tabs;
  assert.deepEqual(tabs.map(tab => tab.id), ["recommend", "kartBody", "character", "package", "equip", "useful"]);
  assert.deepEqual(tabs[4]!.subTabs.map(sub => sub.name),
    ["全部", "气球", "电磁波头带", "防尘眼镜", "喷漆", "染色剂", "情侣", "其它"]);
  // Every item sits in exactly one of the five shop tabs (couple equipment in two of its SubCats).
  let total = 0;
  for (const tab of tabs.slice(1)) total += index.list(tab.id).length;
  assert.equal(total, catalog.items.length);
  assert.ok(index.list(RECOMMEND_TAB).length > 0);
  for (const entry of index.entries) assert.ok(displayOffer(entry), entry.key);
  const searchStarted = performance.now();
  for (const text of ["尖", "尖锋", "气球", "炫光", "zzzz"]) queryShop(index, query({ search: text }));
  const searched = performance.now() - searchStarted;
  const sortStarted = performance.now();
  queryShop(index, query({ tab: "equip", sort: "name" }));
  queryShop(index, query({ tab: "kartBody", sort: "priceAsc" }));
  const sorted = performance.now() - sortStarted;
  assert.ok(queryShop(index, query({ search: "尖锋" })).some(entry => entry.item.name === "尖锋6.5"));
  const pages = pageOf(queryShop(index, query({ tab: "equip" })), 1e9);
  assert.equal(pages.page, pages.pageCount - 1);
  // Generous bounds for slow CI machines; typical runs are a few milliseconds.
  assert.ok(built < 1500, `index ${built}ms`);
  assert.ok(searched < 500, `search ${searched}ms`);
  assert.ok(sorted < 1500, `sort ${sorted}ms`);
});

test("原版商城布局（shopTabs）：推荐无全部、默认新商品；卡片物品在前，其余在后", () => {
  const index = new ShopIndex(mallCatalog());
  assert.equal(index.mall, true);
  const tab = (id: string) => index.tabs.find(entry => entry.id === id)!;
  assert.deepEqual(index.tabs.map(entry => entry.name), ["推荐", "卡丁车", "角色", "礼包", "装备", "使用"]);
  assert.deepEqual(tab(RECOMMEND_TAB).subTabs.map(sub => sub.name), ["新商品", "热门商品", "活动"]);
  assert.equal(tab(RECOMMEND_TAB).defaultSubTab, "new");
  assert.deepEqual(tab("kartBody").subTabs.map(sub => sub.id),
    [ALL_SUB_TAB, "engineXun", "engineV1", "engineEtc", "strengthen", "tunningXun"]);
  assert.equal(tab("kartBody").defaultSubTab, ALL_SUB_TAB);
  assert.deepEqual(tab("character").subTabs, []);
  assert.equal(tab("character").defaultSubTab, ALL_SUB_TAB);
  // 推荐 lists its cards only, in card order.
  assert.deepEqual(names(index.list(RECOMMEND_TAB, "new")), ["尖锋6.5", "SVIP通行证手杖", "翠绿炫光"]);
  assert.deepEqual(names(queryShop(index, query({ tab: RECOMMEND_TAB, subTab: "hotItem" }))), ["SVIP通行证手杖", "尖锋6.5"]);
  // 全部: every SubCat's cards first, then the rest (current cards, named, newest first).
  assert.deepEqual(names(queryShop(index, query({ tab: "kartBody" }))), ["爆烈 E2", "尖锋6.5", "oldKart (5)"]);
  assert.deepEqual(names(index.list("kartBody", "engineEtc")), ["尖锋6.5", "oldKart (5)"]);
  assert.deepEqual(index.list("kartBody", "engineV1"), []);
  assert.deepEqual(names(index.list("equip")), ["粉红色心型气球", "SVIP通行证手杖", "翠绿炫光"]);
  assert.deepEqual(names(index.list("equip", "etc")), ["SVIP通行证手杖", "翠绿炫光"]);
  assert.deepEqual(names(index.list("character")), ["皮蛋"]);
  assert.deepEqual(index.list("package"), []);
  assert.deepEqual(index.list("useful"), []);
  // The card's one price: displayOfferId.
  assert.equal(displayOffer(index.entry(3, 10)!)!.offerId, "s2");
  assert.equal(displayOffer(index.entry(16, 364)!)!.originalPrice, 400);
  assert.equal(displayOffer(index.entry(3, 10)!, "lucci")!.offerId, "s3");
  // Couple equipment lists both of its SubCats.
  const couple = structuredClone(MALL_CATALOG_JSON);
  couple.items.push({ category: 9, itemId: 2, kind: "balloon", name: "钻戒气球", internalId: "ring", tab: "equip",
    subTab: "balloon", shopCategory: "equip", shopSubCategory: "couple", shopSubCategories: ["balloon", "couple"],
    offers: [{ offerId: "c1", currency: "coupon", price: 35, days: 0, count: 100, source: "estimated" }] } as never);
  const coupled = new ShopIndex(parseShopCatalog(couple));
  assert.ok(names(coupled.list("equip", "balloon")).includes("钻戒气球"));
  assert.ok(names(coupled.list("equip", "couple")).includes("钻戒气球"));
  assert.equal(names(coupled.list("equip")).filter(name => name === "钻戒气球").length, 1);
});

test("真实目录的原版布局：卡丁车全部以迅引擎卡片开头，使用页签有双倍卡", () => {
  const index = new ShopIndex(parseShopCatalog(realCatalogJson()));
  assert.deepEqual(names(queryShop(index, query({ tab: "kartBody" })).slice(0, 6)),
    ["概念车I 迅", "概念车S 迅-S", "概念车S 迅-B", "概念车S 迅-L", "棉花糖 迅", "爆烈 迅"]);
  assert.deepEqual(names(index.list(RECOMMEND_TAB, "new")), ["SVIP通行证手杖", "雯雯"]);
  assert.equal(index.list("useful").length, 15);
  // The original useful/card page: the item changer vouchers (cards 3975, 3976), then the double cards.
  assert.deepEqual(names(index.list("useful", "card").slice(0, 4)),
    ["道具变更卡使用券", "道具换位卡使用券", "双倍金币卡", "双倍经验卡"]);
  assert.equal(index.list("package").length, 0);
  assert.equal(index.list("useful", "specialKit").length, 0);
  assert.equal(displayOffer(index.entry(3, 1518)!)!.price, 59);
});

test("剩余期限与车库显示一致（同一个 remainingLabel）", () => {
  const HOUR = 3_600_000;
  // The review's cases: a day and an hour, just under 30 days, just under 2 days.
  for (const left of [DAY + HOUR, 30 * DAY - 5_000, 2 * DAY - 1, 5 * HOUR + 1, 90_000, 0, -DAY])
    assert.equal(formatRemaining(NOW + left, NOW), remainingLabel(NOW + left, NOW), `left ${left}`);
  assert.equal(formatRemaining(NOW + 30 * DAY - 5_000, NOW), "剩余 29 天");
  const catalog = fixtureCatalog();
  const rider = catalog.items.find(entry => entry.category === 1 && entry.itemId === 2)!;
  const ownership = { owned: true, permanent: false, expiresAt: NOW + 2 * DAY - 1, quantity: 1 };
  assert.equal(ownershipLabel(rider, ownership, NOW), remainingLabel(ownership.expiresAt, NOW));
});

test("已拥有限时道具：再次购买说明续期后的到期时间或变为永久", () => {
  const catalog = fixtureCatalog();
  const kart = catalog.items[0]!;
  const balloon = catalog.items.find(item => item.kind === "balloon")!;
  const rental = { owned: true, permanent: false, expiresAt: NOW + 3 * DAY, quantity: 1 };
  assert.equal(ownedRental(kart, rental), true);
  assert.equal(ownedRental(kart, NOT_OWNED), false);
  assert.equal(ownedRental(kart, { ...rental, permanent: true, expiresAt: null }), false);
  assert.equal(ownedRental(balloon, { ...rental, quantity: 50 }), false);
  // 30 more days from the current end (ECONOMY.md 5: max(now, expiresAt)).
  assert.equal(renewalNote(kart, { days: 30 }, rental, NOW),
    `当前剩余 3 天，兑换后到期 ${formatDateTime(NOW + 33 * DAY)}`);
  assert.equal(renewalNote(kart, { days: 0 }, rental, NOW), "当前剩余 3 天，兑换后变为永久");
  assert.equal(renewalNote(kart, { days: 30 }, NOT_OWNED, NOW), undefined);
  assert.equal(renewalNote(balloon, { days: 0 }, { ...rental, quantity: 50 }, NOW), undefined);
  const local = new Date(2026, 10, 6, 9, 5).getTime();
  assert.equal(formatDateTime(local), "2026-11-06 09:05");
});
