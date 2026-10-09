// Unit tests for the economy exporter's pure rules.
// Run from rewrite/: node --test tools/economy-export/economy-export.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import { canonicalize, contentVersion, formatDocument } from "./canonical.mjs";
import { diffRewards, koinRewardsByRule, koinRewardsFromData } from "./levels.mjs";
import { beijingPeriod, spendEvents } from "./events.mjs";
import { compareOffers, currentCardRefs, discountLabel, discountPercentOf, dominates, estimateOffers,
  latestRecommendGroup, markFor, median, selectOriginalOffers, stockRejection } from "./offers.mjs";
import { normalizeAttributeWhitespace } from "./resource-library.mjs";
import { parseShopCats, parseStockCards, parseStringBag, parseTcCashEvents } from "./shop-data.mjs";
import { coupleItems, isCoupleRestriction, kartEngineSubCategory, layoutShop, shopPlacement } from "./shop-layout.mjs";
import { MAX_TRACK_ID_LENGTH, timeAttackTrackRows } from "./tracks.mjs";

const stock = (stockId, overrides = {}, item = {}) => ({
  stockId, name: "", price: 100, priceType: 0, isOnSale: true, isOnceADay: false,
  restriction: "", onBuyOk: "", rpLimit: 0,
  items: [{ category: 3, itemId: 1, count: 1, days: 0, ...item }],
  ...overrides,
});

test("stock filters follow ECONOMY.md 3.2", () => {
  assert.equal(stockRejection(stock(1)), undefined);
  assert.equal(stockRejection(stock(1, { items: [stock(1).items[0], stock(1).items[0]] })), "bundle");
  assert.equal(stockRejection(stock(1, { isOnSale: false })), "notOnSale");
  assert.equal(stockRejection(stock(1, { price: undefined })), "noPrice");
  assert.equal(stockRejection(stock(1, { priceType: 2 })), "luccon");
  assert.equal(stockRejection(stock(1, { price: 0 })), "zeroPrice");
  assert.equal(stockRejection(stock(1, { priceType: 1, price: 1_000_000 })), "lucciPlaceholder");
  assert.equal(stockRejection(stock(1, { priceType: 1, price: 999_999 })), undefined);
  assert.equal(stockRejection(stock(1, { priceType: 1, price: 1 })), "lucciTokenPrice");
  assert.equal(stockRejection(stock(1, { priceType: 0, price: 100_000 })), "couponPlaceholder");
  assert.equal(stockRejection(stock(1, { priceType: 3, price: 1 })), undefined);
  assert.equal(stockRejection(stock(1, { isOnceADay: true })), "onceADay");
  assert.equal(stockRejection(stock(1, { restriction: "couple3" })), "coupleRestriction");
  assert.equal(stockRejection(stock(1, { restriction: "8" })), "specialRestriction");
  assert.equal(stockRejection(stock(1, { restriction: "1|notLucconBuy" })), "specialRestriction");
  assert.equal(stockRejection(stock(1, { restriction: "notLucconBuy" })), undefined);
});

test("duplicate (currency, days, count) prefers current cards, then the highest stockId", () => {
  const sellable = new Map([["3:1", {}], ["3:2", {}]]);
  const stocks = new Map([
    [10, stock(10, { price: 300 })],
    [11, stock(11, { price: 200 })],
    [12, stock(12, { price: 100 })],
    [20, stock(20, { price: 50 }, { itemId: 2, days: 30 })],
    [21, stock(21, { price: 60 }, { itemId: 2, days: 30 })],
    [30, stock(30, { price: 9 }, { itemId: 99 })], // not sellable
  ]);
  const cards = new Map([[1, { cardId: 1, isOnSale: true, saleFlag: "", stockIds: [11] }],
    [2, { cardId: 2, isOnSale: true, saleFlag: "", stockIds: [21] }]]);
  const refs = currentCardRefs([
    { group: "kartBody", subCat: "x", cardId: 1, shopMark: "discount40" },
    { group: "hide", subCat: "", cardId: 2, shopMark: "hot" },
    { group: "kartBody", subCat: "", cardId: 404, shopMark: "new" },
  ], cards);
  assert.deepEqual(refs.map(ref => ref.cardId), [1]);
  const result = selectOriginalOffers(sellable, stocks, refs);
  assert.deepEqual(result.offers.get("3:1").map(offer => offer.offerId), ["s11"]);
  assert.deepEqual(result.offers.get("3:2").map(offer => offer.offerId), ["s21"]);
  assert.equal(result.duplicateGroups, 2);
});

test("only the open-ended (latest) recommand page is current", () => {
  const cards = new Map([1, 2, 3, 4].map(cardId => [cardId, { cardId, isOnSale: true, saleFlag: "", stockIds: [] }]));
  const page = (group, salePeriod, cardId) => ({ group, subCat: "new", salePeriod, cardId, shopMark: "new" });
  const refs = [
    page("recommand230", "2026-09-17T06:00:00~2026-09-24T05:59:59", 1),
    page("recommand233", "2026-10-08T06:00:00~*", 2),
    page("recommand232", "2026-10-01T06:00:00~2026-10-08T05:59:59", 3),
    { group: "kartBody", subCat: "engineXun", salePeriod: "", cardId: 4, shopMark: "" },
  ];
  assert.equal(latestRecommendGroup(refs), "recommand233");
  assert.deepEqual(currentCardRefs(refs, cards).map(ref => ref.cardId), [2, 4]);
  // Without an open-ended page the latest start wins.
  assert.equal(latestRecommendGroup(refs.filter(ref => ref.group !== "recommand233")), "recommand232");
  assert.equal(latestRecommendGroup(refs.slice(3)), undefined);
});

test("shopMark badges and the 折 label", () => {
  assert.deepEqual(["new", "hot", "discount10", "discount44", "eventBuyCount", "event", "", "discount0"].map(markFor),
    ["new", "hot", "discount", "discount", "limited", undefined, undefined, undefined]);
  assert.equal(discountPercentOf("discount40"), 40);
  assert.equal(discountPercentOf("discount100"), undefined);
  assert.deepEqual([10, 40, 44, 5].map(percent => discountLabel(percent)), ["9折", "6折", "5.6折", "9.5折"]);
});

test("kart engine family and couple placement", () => {
  assert.deepEqual([9, 8, 7, 0, undefined].map(kartEngineSubCategory),
    ["engineXun", "engineV1", "engineEtc", "engineEtc", "engineEtc"]);
  const order = new Map([["equip", ["balloon", "headband", "goggle", "color", "dye", "couple", "etc"]]]);
  assert.deepEqual(shopPlacement({ kind: "kart", engineGrade: 9 }, false, order),
    { shopCategory: "kartBody", shopSubCategory: "engineXun" });
  assert.deepEqual(shopPlacement({ kind: "pet" }, true, order), { shopCategory: "character" });
  assert.deepEqual(shopPlacement({ kind: "headBand" }, false, order),
    { shopCategory: "equip", shopSubCategory: "headband" });
  assert.deepEqual(shopPlacement({ kind: "balloon" }, true, order),
    { shopCategory: "equip", shopSubCategory: "couple", shopSubCategories: ["balloon", "couple"] });
  assert.deepEqual(shopPlacement({ kind: "handGearL" }, true, order),
    { shopCategory: "equip", shopSubCategory: "couple", shopSubCategories: ["couple", "etc"] });
  assert.deepEqual(shopPlacement({ kind: "rpLucciBonus" }, false, order), { shopCategory: "useful", shopSubCategory: "card" });
  assert.deepEqual(shopPlacement({ kind: "headPhone" }, false, order), { shopCategory: "useful", shopSubCategory: "etc" });
  assert.equal(shopPlacement({ kind: "lottery" }, false, order), undefined);
  assert.ok(isCoupleRestriction("couple") && isCoupleRestriction("notLucconBuy|couple5"));
  assert.ok(!isCoupleRestriction("8") && !isCoupleRestriction("coupleX") && !isCoupleRestriction(""));
  const sellable = new Map([["9:1", {}], ["3:1", {}]]);
  const stocks = new Map([[1, stock(1, { restriction: "couple3" }, { category: 9, itemId: 1 })],
    [2, stock(2, { restriction: "couple" }, { category: 9, itemId: 2 })],
    [3, stock(3, { restriction: "couple", items: [{ category: 3, itemId: 1 }, { category: 9, itemId: 1 }] })]]);
  assert.deepEqual([...coupleItems(sellable, stocks)], ["9:1"]);
});

test("the shop layout lists card items in order with badges, discounts, 限购 and the card price", () => {
  const sellable = new Map([
    ["3:1", { kind: "kart", engineGrade: 9 }], ["3:2", { kind: "kart", engineGrade: 8 }],
    ["3:3", { kind: "kart", engineGrade: 2 }], ["1:2", { kind: "character" }], ["16:7", { kind: "handGearL" }],
    ["9:5", { kind: "balloon" }],
  ]);
  const stocks = new Map([
    [10, stock(10, {}, { itemId: 1 })], [20, stock(20, {}, { itemId: 2, days: 7 })],
    [21, stock(21, {}, { itemId: 2, days: 30 })], [30, stock(30, {}, { category: 1, itemId: 2, days: 7 })],
    [31, stock(31, {}, { category: 1, itemId: 2 })], [40, stock(40, { price: 360 }, { category: 16, itemId: 7, days: 14 })],
    [50, stock(50, { restriction: "couple" }, { category: 9, itemId: 5, count: 50 })],
    [60, stock(60, { items: [{ category: 3, itemId: 3, count: 1, days: 0 }, { category: 24, itemId: 1, count: 1, days: 0 }] })],
  ]);
  const card = (cardId, stockIds, extra = {}) => [cardId, { cardId, isOnSale: true, saleFlag: "", eventBuyCount: 0,
    stockIds, ...extra }];
  const cards = new Map([card(1, [10], { eventBuyCount: 5 }), card(2, [20, 21]), card(3, [30, 31]),
    card(4, [40], { eventBuyCount: 1 }), card(5, [50]), card(6, [60])]);
  const ref = (group, subCat, cardId, shopMark = "", originalPrice = undefined) =>
    ({ group, subCat, cardId, shopMark, originalPrice, salePeriod: group.startsWith("recommand") ? "2026-10-08T06:00:00~*" : "" });
  const shopCatRefs = [
    { ...ref("recommand1", "new", 3, "hot"), salePeriod: "2026-10-01T06:00:00~2026-10-08T05:59:59" },
    ref("recommand2", "new", 4, "discount10", 400), ref("recommand2", "new", 3, "new"),
    ref("recommand2", "hotItem", 3, "hot"), ref("recommand2", "hotItem", 6, "hot"),
    ref("hide", "", 2), ref("kartBody", "engineXun", 1), ref("kartBody", "engineV1", 2),
    ref("kartBody", "engineEtc", 99), ref("character", "", 3), ref("kartPass", "", 2),
    ref("equip", "balloon", 5), ref("equip", "couple", 5), ref("equip", "etc", 4),
  ];
  const offer = (offerId, price, days = 0, currency = "coupon", count = 1) => ({ offerId, currency, price, days, count });
  const offers = new Map([
    ["3:1", [offer("s10", 10000, 0, "lucci")]], ["3:2", [offer("s21", 250, 30), offer("e3-2-0", 700)]],
    ["3:3", [offer("e3-3-30", 90, 30), offer("e3-3-0", 300), offer("s9", 50, 0, "koin")]],
    ["1:2", [offer("s30", 29, 7), offer("s31", 399)]], ["16:7", [offer("s40", 360, 14)]],
    ["9:5", [offer("e9-5-0", 35, 0, "coupon", 100)]],
  ]);
  const labels = { recommand: "推荐", new: "新商品", hotItem: "热门商品", kartBody: "卡丁车", engineXun: "迅 引擎",
    engineV1: "V1 引擎", engineEtc: "其他引擎", character: "角色", equip: "装备", balloon: "气球", couple: "情侣",
    etc: "其它", whole: "全部", discount: "折" };
  const problems = [];
  const layout = layoutShop({ sellable, stocks, cards, shopCatRefs, offers, couple: new Set(["9:5"]),
    label: key => labels[key], problem: message => problems.push(message) });
  assert.deepEqual(problems, []);
  assert.equal(layout.latest, "recommand2");
  assert.deepEqual(layout.tabs, [
    { id: "recommand", name: "推荐", defaultSubTab: "new", subTabs: [
      { id: "new", name: "新商品", cardItems: ["16:7", "1:2"] }, { id: "hotItem", name: "热门商品", cardItems: ["1:2"] }] },
    { id: "kartBody", name: "卡丁车", allSubTab: "全部", subTabs: [
      { id: "engineXun", name: "迅 引擎", cardItems: ["3:1"] }, { id: "engineV1", name: "V1 引擎", cardItems: ["3:2"] },
      { id: "engineEtc", name: "其他引擎", cardItems: [] }] },
    { id: "character", name: "角色", subTabs: [], cardItems: ["1:2"] },
    { id: "equip", name: "装备", allSubTab: "全部", subTabs: [
      { id: "balloon", name: "气球", cardItems: ["9:5"] }, { id: "couple", name: "情侣", cardItems: ["9:5"] },
      { id: "etc", name: "其它", cardItems: ["16:7"] }] },
  ]);
  assert.deepEqual(layout.placements.get("9:5"),
    { shopCategory: "equip", shopSubCategory: "couple", shopSubCategories: ["balloon", "couple"] });
  assert.deepEqual(layout.placements.get("3:3"), { shopCategory: "kartBody", shopSubCategory: "engineEtc" });
  assert.deepEqual(Object.fromEntries(layout.recommend), { "16:7": ["new"], "1:2": ["new", "hotItem"] });
  assert.deepEqual(Object.fromEntries(layout.marks), { "3:1": ["limited"], "1:2": ["new", "hot"],
    "16:7": ["discount", "limited"] });
  assert.deepEqual(Object.fromEntries(layout.offerNotes), {
    s10: { limited: true, buyLimit: 5 },
    s40: { limited: true, buyLimit: 1, originalPrice: 400, discountPercent: 10, discountLabel: "9折" },
  });
  // Card stock first (2: its first stock s20 is not an offer, the next one is), then permanent, then cheapest.
  assert.deepEqual(Object.fromEntries(layout.displayOffers), { "3:1": "s10", "3:2": "s21", "3:3": "e3-3-0",
    "1:2": "s30", "16:7": "s40", "9:5": "e9-5-0" });
  assert.deepEqual(layout.stats.displayRules, { card: 3, cardFallback: 1, permanent: 2, cheapest: 0 });
  assert.deepEqual(layout.stats.engineCards, { engineXun: { 9: 1 }, engineV1: { 8: 1 } });

  // A card the derived placement disagrees with, a discount that does not
  // match its price and an unknown badge are inconsistencies.
  const broken = [...shopCatRefs, ref("kartBody", "engineV1", 1), ref("recommand2", "new", 4, "discount30", 400),
    ref("recommand2", "event", 3, "sale")];
  const errors = [];
  layoutShop({ sellable, stocks, cards, shopCatRefs: broken, offers, couple: new Set(["9:5"]),
    label: key => labels[key] ?? (key === "event" ? "活动" : undefined), problem: message => errors.push(message) });
  assert.deepEqual(errors, [
    "3:1 (kart) is on card 1 in kartBody/engineV1, derived kartBody/engineXun",
    "card 4: s40 costs 360, originalPrice 400 is 10.0% off, discount30 says 30%",
    "s40: discountPercent 10 and 30 from two cards",
    "s40: discountLabel 9折 and 7折 from two cards",
    "shopCat recommand2/event card 3: unknown shopMark sale",
  ]);
});

test("shop table parsers keep card limits, original prices, string bags and tcCash events", () => {
  const node = (name, attributes = {}, children = []) => ({ name, text: "",
    attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children });
  const refs = parseShopCats(node("Shop", {}, [
    node("ShopCat", { name: "recommand233", salePeriod: "2026-10-08T06:00:00~*" }, [
      node("SubCat", { name: "new" }, [node("stockCard", { stockCardId: "3917", originalPrice: "400", shopMark: "discount10" })])]),
    node("ShopCat", { name: "character", salePeriod: "" }, [node("stockCard", { stockCardId: "3525" })]),
  ]));
  assert.deepEqual(refs, [
    { group: "recommand233", subCat: "new", salePeriod: "2026-10-08T06:00:00~*", cardId: 3917, shopMark: "discount10",
      originalPrice: 400 },
    { group: "character", subCat: "", salePeriod: "", cardId: 3525, shopMark: "", originalPrice: undefined },
  ]);
  const cards = parseStockCards(node("stockCardList", {}, [
    node("stockCard", { stockCardId: "3917", isOnSale: "1", saleFlag: "2", eventBuyCount: "1" },
      [node("stock", { stockId: "26914" })]),
    node("stockCard", { stockCardId: "3525", isOnSale: "1" }, [node("stock", { stockId: "23292" })]),
  ]));
  assert.equal(cards.get(3917).eventBuyCount, 1);
  assert.equal(cards.get(3525).eventBuyCount, 0);
  const bag = parseStringBag(node("StringBag", {}, [
    node("k", { n: "new" }, [node("m", { c: "kr", v: "NEW" }), node("m", { c: "cn", v: "新商品" })]),
    node("k", { n: "lucci" }, [node("m", { c: "cn", v: "金币" })]),
    node("k", { n: "lucci" }, [node("m", { c: "cn", v: "金币" })]),
    node("k", { n: "krOnly" }, [node("m", { c: "kr", v: "x" })]),
  ]));
  assert.deepEqual([...bag], [["new", "新商品"], ["lucci", "金币"]]);
  assert.throws(() => parseStringBag(node("StringBag", {}, [
    node("k", { n: "a" }, [node("m", { c: "cn", v: "1" })]), node("k", { n: "a" }, [node("m", { c: "cn", v: "2" })])])),
  /string bag key a/);
  const events = parseTcCashEvents(node("tcCashEventList", {}, [
    node("tcCashEvent", { eventPeriod: "2026-09-17T06:00:00~2026-10-15T05:59:59",
      rewardPeriod: "2026-09-17T06:00:00~2026-10-22T05:59:59", eventType: "use" }, [
      node("reward", { step: "1", value: "1000", stockId: "32336" }),
      node("reward", { step: "2", value: "2000", stockId: "29631" }),
    ]),
  ]));
  assert.deepEqual(events, [{ eventPeriod: "2026-09-17T06:00:00~2026-10-15T05:59:59",
    rewardPeriod: "2026-09-17T06:00:00~2026-10-22T05:59:59", eventType: "use",
    steps: [{ step: 1, value: 1000, stockId: 32336 }, { step: 2, value: 2000, stockId: 29631 }] }]);
});

test("the tcCash spend event resolves its reward stocks in Beijing time", () => {
  assert.deepEqual(beijingPeriod("2026-09-17T06:00:00~2026-10-15T05:59:59"),
    { start: "2026-09-17T06:00:00+08:00", end: "2026-10-15T05:59:59+08:00" });
  for (const bad of ["2026-09-17T06:00:00~*", "2026-10-15T05:59:59~2026-09-17T06:00:00", "2026-09-17", ""])
    assert.equal(beijingPeriod(bad), undefined, bad);
  const stocks = new Map([
    [32336, stock(32336, { name: "[活动]光明骑士幸运宝石(10 个)" }, { category: 24, itemId: 1242, count: 10 })],
    [32344, stock(32344, { name: "孔明灯车手栏背景(无限制)" }, { category: 71, itemId: 16 })],
  ]);
  const shopItems = new Map([["71:16", { name: "孔明灯车手栏背景" }]]);
  const sellable = new Map([["71:16", { kind: "slotBg" }]]);
  const raw = { eventPeriod: "2026-09-17T06:00:00~2026-10-15T05:59:59",
    rewardPeriod: "2026-09-17T06:00:00~2026-10-22T05:59:59", eventType: "use",
    steps: [{ step: 2, value: 8000, stockId: 32344 }, { step: 1, value: 1000, stockId: 32336 }] };
  const problems = [];
  assert.deepEqual(spendEvents([raw], { stocks, shopItems, sellable, problem: message => problems.push(message) }), [{
    eventType: "use",
    eventPeriod: { start: "2026-09-17T06:00:00+08:00", end: "2026-10-15T05:59:59+08:00" },
    rewardPeriod: { start: "2026-09-17T06:00:00+08:00", end: "2026-10-22T05:59:59+08:00" },
    steps: [
      { step: 1, value: 1000, stockId: 32336, reward: { name: "[活动]光明骑士幸运宝石(10 个)", category: 24, itemId: 1242,
        count: 10, days: 0, iconHint: "etc" } },
      { step: 2, value: 8000, stockId: 32344, reward: { name: "孔明灯车手栏背景", category: 71, itemId: 16, count: 1,
        days: 0, iconHint: "slotBg" } },
    ],
  }]);
  assert.deepEqual(problems, []);
  const errors = [];
  spendEvents([{ ...raw, eventType: "charge" }, { ...raw, steps: [{ step: 1, value: 5, stockId: 1 }] },
    { ...raw, rewardPeriod: "2026-09-18T06:00:00~2026-10-22T05:59:59" }],
  { stocks, shopItems, sellable, problem: message => errors.push(message) });
  assert.deepEqual(errors.map(message => message.replace(/^tcCashEvent \d+:? ?/, "")), [
    'eventType "charge", only "use" (累计消费) is supported',
    "step 1: stock 1 is not in stock.kml",
    "rewardPeriod 2026-09-18T06:00:00~2026-10-22T05:59:59 does not cover eventPeriod 2026-09-17T06:00:00~2026-10-15T05:59:59",
  ]);
});

test("event-hook stocks far below the ordinary median are event tokens", () => {
  const sellable = new Map([["3:1", {}], ["3:2", {}], ["3:3", {}], ["3:4", {}], ["1:1", {}]]);
  const hook = { onBuyOk: "setEventTemp12" };
  const stocks = new Map([
    [1, stock(1, { price: 300 }, { itemId: 1 })],
    [2, stock(2, { price: 200 }, { itemId: 2 })],
    // 3:3: ordinary 350 and a later event price of 70 (< 25% of median 300).
    [3, stock(3, { price: 350 }, { itemId: 3 })],
    [4, stock(4, { price: 70, ...hook }, { itemId: 3 })],
    // 3:4: event stock at 75 = exactly 25% of the median: kept.
    [5, stock(5, { price: 75, ...hook }, { itemId: 4 })],
    // Event stock with no ordinary price for its terms: kept.
    [6, stock(6, { price: 1, priceType: 3, ...hook }, { itemId: 4, days: 7 })],
    [7, stock(7, { price: 10, ...hook }, { category: 1, itemId: 1 })],
  ]);
  const result = selectOriginalOffers(sellable, stocks, []);
  assert.deepEqual(result.offers.get("3:3").map(offer => [offer.offerId, offer.price]), [["s3", 350]]);
  assert.deepEqual(result.offers.get("3:4").map(offer => offer.offerId).sort(), ["s5", "s6"]);
  assert.deepEqual(result.offers.get("1:1").map(offer => offer.offerId), ["s7"]);
  assert.equal(result.rejections.eventTokenPrice, 1);
  assert.deepEqual(result.eventTokens.map(entry => [entry.offer.offerId, entry.reference]), [["s4", 300]]);
});

test("offers another offer of the item dominates are dropped", () => {
  const sellable = new Map([["2:7", {}], ["9:126", {}]]);
  const stocks = new Map([
    [1, stock(1, { price: 700, priceType: 1 }, { category: 2, itemId: 7 })],
    [2, stock(2, { price: 2000, priceType: 1 }, { category: 2, itemId: 7, days: 30 })], // dearer than permanent
    [3, stock(3, { price: 49, priceType: 3 }, { category: 2, itemId: 7, days: 7 })], // same price, shorter
    [4, stock(4, { price: 49, priceType: 3 }, { category: 2, itemId: 7, days: 15 })],
    [5, stock(5, { price: 33 }, { category: 2, itemId: 7, days: 100 })],
    [6, stock(6, { price: 120 }, { category: 2, itemId: 7, days: 7 })], // longer and cheaper exists
    [7, stock(7, { price: 50, rpLimit: 600 }, { category: 2, itemId: 7, days: 365 })], // needs exp: kept
    [8, stock(8, { price: 10000 }, { category: 9, itemId: 126, count: 30 })],
    [9, stock(9, { price: 20 }, { category: 9, itemId: 126, count: 50 })],
  ]);
  const result = selectOriginalOffers(sellable, stocks, []);
  assert.deepEqual(result.offers.get("2:7").map(offer => offer.offerId).sort(), ["s1", "s4", "s5", "s7"]);
  assert.deepEqual(result.offers.get("9:126").map(offer => offer.offerId), ["s9"]);
  assert.deepEqual(result.dominated.map(entry => [entry.offer.offerId, entry.by.offerId]).sort(),
    [["s2", "s1"], ["s3", "s4"], ["s6", "s5"], ["s8", "s9"]]);
  const offer = (price, days, extra = {}) => ({ currency: "coupon", price, days, count: 1, ...extra });
  assert.ok(dominates(offer(100, 0), offer(100, 30)));
  assert.ok(!dominates(offer(100, 30), offer(100, 0)));
  assert.ok(!dominates(offer(101, 0), offer(100, 30)));
  assert.ok(!dominates(offer(10, 0, { currency: "koin" }), offer(100, 30)));
  assert.ok(!dominates(offer(10, 0, { minExp: 600 }), offer(100, 30)));
  const self = offer(1, 0);
  assert.ok(!dominates(self, self));
});

test("estimates use category medians, kart grades, packs and the rental ratio", () => {
  const offer = (currency, price, days = 0, count = 1) => ({ offerId: `s${price}`, currency, price, days,
    count, source: "original" });
  const sellable = new Map([
    ["3:1", { category: 3, grade: 1 }], ["3:2", { category: 3, grade: 1 }], ["3:3", { category: 3, grade: 2 }],
    ["3:4", { category: 3, grade: 1 }], ["3:5", { category: 3, grade: 7 }],
    ["9:1", { category: 9 }], ["9:2", { category: 9 }], ["9:3", { category: 9 }],
  ]);
  const originalOffers = new Map([
    ["3:1", [offer("coupon", 100), offer("coupon", 40, 30)]],
    ["3:2", [offer("coupon", 300), offer("coupon", 90, 30), offer("lucci", 5000, 7)]],
    ["3:3", [offer("coupon", 500)]],
    ["9:1", [offer("coupon", 30, 0, 50), offer("coupon", 50, 0, 100)]],
    ["9:2", [offer("coupon", 35, 0, 100)]],
  ]);
  const poolOf = key => {
    const item = sellable.get(key);
    return [...(item.category === 3 ? [`grade:${item.grade}`] : []), `cat:${item.category}`, "all"];
  };
  const { estimates, rentalRatio } = estimateOffers({
    sellable, originalOffers, poolOf, isCountBased: key => key.startsWith("9:"),
  });
  assert.equal(rentalRatio, median([0.4, 0.3]));
  // Grade 1 median of 100 and 300; 30-day = 200 x 0.35.
  assert.deepEqual(estimates.get("3:4").map(o => [o.offerId, o.currency, o.price, o.days, o.count]),
    [["e3-4-0", "coupon", 200, 0, 1], ["e3-4-30", "coupon", 70, 30, 1]]);
  // Grade 7 has no prices: falls back to the category median (100, 300, 500).
  assert.equal(estimates.get("3:5")[0].price, 300);
  // Balloons: most frequent pack (100), median price of that pack, no rental.
  assert.deepEqual(estimates.get("9:3").map(o => [o.price, o.days, o.count]), [[43, 0, 100]]);
  assert.ok(!estimates.has("3:1"));
});

test("rental-only categories get the most common original rental, never a permanent", () => {
  const offer = (currency, price, days = 0) => ({ offerId: `s${price}`, currency, price, days, count: 1,
    source: "original" });
  const sellable = new Map([["32:1", {}], ["32:2", {}], ["32:4", {}], ["61:1", {}], ["3:1", {}]]);
  const originalOffers = new Map([
    ["32:1", [offer("coupon", 30, 3), offer("coupon", 50, 7), offer("lucci", 100000, 7)]],
    ["32:2", [offer("coupon", 15, 3), offer("coupon", 30, 7)]],
    ["3:1", [offer("coupon", 300), offer("coupon", 99, 30)]],
  ]);
  const poolOf = key => [`cat:${key.split(":")[0]}`, "all"];
  const { estimates, pools } = estimateOffers({ sellable, originalOffers, poolOf,
    isCountBased: () => false, isRentalOnly: key => !key.startsWith("3:") });
  // 3- and 7-day rentals tie (2 items each): the longer wins, median of 50 and 30.
  assert.deepEqual(estimates.get("32:4"), [{ offerId: "e32-4-7", currency: "coupon", price: 40, days: 7,
    count: 1, source: "estimated" }]);
  assert.equal(pools.get("32:4"), "cat:32");
  // No rentals in its own category: the next pool (all) has 3- and 7-day rentals twice, 30-day once.
  assert.deepEqual(estimates.get("61:1").map(o => [o.offerId, o.price, o.days]), [["e61-1-7", 40, 7]]);
  assert.equal(pools.get("61:1"), "all");
});

test("attribute values get XML whitespace normalization, character references do not", () => {
  const text = "<?xml version='1.0'?>\n<!-- a\tb -->\n<list>\n\t<item a='x&#xD;&#xA;\t\ty' " +
    "b=\"p\r\nq\" c='\"\t>'/>\n\t<t>keep\ttext</t><![CDATA[\t]]>\n</list>\n";
  assert.equal(normalizeAttributeWhitespace(text), "<?xml version='1.0'?>\n<!-- a\tb -->\n<list>\n" +
    "\t<item a='x&#xD;&#xA;  y' b=\"p q\" c='\" >'/>\n\t<t>keep\ttext</t><![CDATA[\t]]>\n</list>\n");
});

test("offers sort by currency, rentals before permanent, then pack size", () => {
  const offers = [
    { offerId: "a", currency: "koin", days: 7, count: 1 },
    { offerId: "b", currency: "coupon", days: 0, count: 1 },
    { offerId: "c", currency: "coupon", days: 30, count: 1 },
    { offerId: "d", currency: "lucci", days: 0, count: 1 },
    { offerId: "e", currency: "coupon", days: 7, count: 1 },
  ].sort(compareOffers);
  assert.deepEqual(offers.map(offer => offer.offerId), ["e", "c", "b", "d", "a"]);
});

test("koin rewards come from category-56 stocks and are checked against comments", () => {
  const stocks = new Map([[12092, stock(12092, {}, { category: 56, count: 20 })],
    [10775, stock(10775, {}, { category: 56, count: 30 })], [5, stock(5)]]);
  const text = [
    "<Level curLevel='0'>", "<stock stockId='12092'/> <!-- 酷币 (20个) -->",
    "<Level curLevel='3' glove='x'>", "<stock stockId='5'/>", "<stock stockId='12092'/> <!-- 酷币 (20个) -->",
    "<Level curLevel='115'>", "<stock stockId='10775 '/> <!-- 酷币(30 个) -->",
    "<Level curLevel='121'>", "<stock stockId='7915'/> <!-- 酷币(50 个) -->",
  ].join("\n");
  const { rewards, issues } = koinRewardsFromData(text, stocks);
  assert.deepEqual(rewards, { 3: 20, 115: 30, 121: 50 });
  assert.equal(issues.length, 1); // 7915 missing from stocks: comment used
  const bad = koinRewardsFromData("<Level curLevel='3'>\n<stock stockId='12092'/> <!-- 酷币 (25个) -->", stocks);
  assert.match(bad.issues[0], /!= comment 25/);
  const rule = koinRewardsByRule(126);
  assert.equal(rule[3], 20);
  assert.equal(rule[105], 20);
  assert.equal(rule[109], 20);
  assert.equal(rule[111], undefined);
  assert.equal(rule[115], 30);
  assert.equal(rule[121], 50);
  assert.equal(Object.keys(rule).length, 21);
  assert.deepEqual(diffRewards({ 3: 20 }, { 3: 20, 9: 20 }), ["L9: data 0 / rule 20"]);
});

test("canonical JSON sorts keys, keeps integers only and versions the content", () => {
  assert.deepEqual(JSON.stringify(canonicalize({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })),
    '{"a":{"d":[2,{"y":2,"z":1}]},"b":1}');
  assert.throws(() => canonicalize({ price: 1.5 }), /safe integers/);
  const document = { items: [{ b: 1, a: 2 }], name: "x" };
  const { text, version } = formatDocument(document);
  assert.equal(version, contentVersion(document));
  assert.equal(version, contentVersion({ ...JSON.parse(text) }));
  assert.equal(text, '{\n  "items": [\n    {"a":2,"b":1}\n  ],\n  "name": "x",\n' +
    `  "version": "${version}"\n}\n`);
});

test("time-attack track rows keep the catalog order and reject bad ids", () => {
  const problems = [];
  const rows = timeAttackTrackRows([
    { id: "village_R01", title: "城镇 高速公路", gameType: "speed", difficulty: 1 },
    { id: "forest_I01", title: "森林 木桶", gameType: "item", difficulty: 1 },
    { id: "village_R01_rvs", title: "[反]城镇 高速公路", gameType: "speed", difficulty: 1, reverse: true },
    { id: "village_R01", title: "dup", gameType: "speed" },
    { id: "bad id", title: "x", gameType: "speed" },
    { id: "x".repeat(MAX_TRACK_ID_LENGTH + 1), title: "x", gameType: "speed" },
  ], message => problems.push(message));
  assert.deepEqual(rows, [
    { id: "village_R01", title: "城镇 高速公路", gameType: "speed", reverse: undefined },
    { id: "forest_I01", title: "森林 木桶", gameType: "item", reverse: undefined },
    { id: "village_R01_rvs", title: "[反]城镇 高速公路", gameType: "speed", reverse: true },
  ]);
  assert.equal(problems.length, 3);
  const empty = [];
  assert.deepEqual(timeAttackTrackRows([], message => empty.push(message)), []);
  assert.deepEqual(empty, ["time-attack track catalog is empty"]);
});
