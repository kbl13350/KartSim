import assert from "node:assert/strict";
import test from "node:test";

import {
  cachedShopCatalog, clearShopCatalogCache, fetchShopCatalog, newRequestId, parsePurchaseResult,
  PURCHASE_TIMEOUT_MS, ShopApiError, shopErrorMessage, ShopPurchaser, SHOP_CATALOG_PATH,
  SHOP_PURCHASE_PATH, type ShopOfferRef,
} from "./shop-api";
import { parseShopCatalog, ShopCatalogError } from "./shop-catalog";
import {
  CATALOG_JSON, fakeSession, json, realCatalogJson, requestBody, requestHeader,
} from "./shop-test-fixtures";

const PURCHASED = {
  wallet: { coupon: 80, lucci: 3000, koin: 2 },
  item: { category: 3, itemId: 10, quantity: 1, expiresAt: 1_800_000_000_000, source: "shop" },
  purchaseId: 41,
};

const S1: ShopOfferRef = { offerId: "s1", currency: "coupon", price: 120 };
const S2: ShopOfferRef = { offerId: "s2", currency: "coupon", price: 216 };

/**
 * AbortSignal.timeout timers do not keep node alive; hold the loop open while
 * waiting on one (for at most 5 s, so a regression fails instead of hanging).
 */
function keepAlive(): () => void {
  const timer = setTimeout(() => {}, 5_000);
  return () => clearTimeout(timer);
}

function catalog(version = "v1"): typeof CATALOG_JSON {
  return { ...structuredClone(CATALOG_JSON), version };
}

test.beforeEach(() => clearShopCatalogCache());

test("目录首次 GET，之后带 If-None-Match，304 时复用同一对象", async () => {
  const session = fakeSession([
    () => json(catalog("v1"), 200, { ETag: '"v1"' }),
    () => new Response(null, { status: 304 }),
    () => json(catalog("v2"), 200, { ETag: '"v2"' }),
  ]);
  const first = await fetchShopCatalog(session);
  assert.equal(first.version, "v1");
  assert.equal(first.items.length, 6);
  assert.equal(session.calls[0]!.path, SHOP_CATALOG_PATH);
  assert.equal(requestHeader(session.calls[0]!, "If-None-Match"), undefined);
  const second = await fetchShopCatalog(session);
  assert.equal(second, first);
  assert.equal(requestHeader(session.calls[1]!, "If-None-Match"), '"v1"');
  assert.equal(cachedShopCatalog(session), first);
  const third = await fetchShopCatalog(session);
  assert.equal(third.version, "v2");
  assert.notEqual(third, first);
});

test("读不到 ETag 头（跨域未暴露）时用目录版本号作为 ETag；同版本保持同一对象", async () => {
  const session = fakeSession([
    () => json(catalog("v7")),
    () => json(catalog("v7")),
  ]);
  const first = await fetchShopCatalog(session);
  const second = await fetchShopCatalog(session);
  assert.equal(requestHeader(session.calls[1]!, "If-None-Match"), '"v7"');
  assert.equal(second, first);
});

test("条件请求在网络层失败（CORS 不允许 If-None-Match）时本次改为普通 GET，下次仍先发条件请求", async () => {
  const session = fakeSession([
    () => json(catalog("v1"), 200, { ETag: '"v1"' }),
    () => { throw new TypeError("Failed to fetch"); },
    () => json(catalog("v1"), 200, { ETag: '"v1"' }),
    () => new Response(null, { status: 304 }),
  ]);
  const first = await fetchShopCatalog(session);
  assert.equal(await fetchShopCatalog(session), first);
  assert.equal(requestHeader(session.calls[1]!, "If-None-Match"), '"v1"');
  assert.equal(requestHeader(session.calls[2]!, "If-None-Match"), undefined);
  // One failure (perhaps a passing network error) does not turn revalidation off for good.
  assert.equal(await fetchShopCatalog(session), first);
  assert.equal(requestHeader(session.calls[3]!, "If-None-Match"), '"v1"');
});

test("目录请求总是向服务器验证（cache: no-cache），浏览器缓存不会留下旧价格", async () => {
  const session = fakeSession([
    () => json(catalog("v1"), 200, { ETag: '"v1"' }),
    () => new Response(null, { status: 304 }),
    () => { throw new TypeError("Failed to fetch"); },
    () => json(catalog("v2"), 200, { ETag: '"v2"' }),
  ]);
  await fetchShopCatalog(session);
  await fetchShopCatalog(session);
  assert.equal((await fetchShopCatalog(session)).version, "v2");
  assert.equal(session.calls.length, 4);
  for (const call of session.calls) assert.equal(call.init?.cache, "no-cache");
});

test("没有本地副本却收到 304 时只再普通请求一次", async () => {
  const session = fakeSession([
    () => new Response(null, { status: 304 }),
    () => new Response(null, { status: 304 }),
  ]);
  await assert.rejects(fetchShopCatalog(session), (error: unknown) =>
    error instanceof ShopApiError && error.code === "HTTP_304");
  assert.equal(session.calls.length, 2);
});

test("目录网络错误、服务错误与登录失效映射为中文错误", async () => {
  const offline = fakeSession([() => { throw new TypeError("offline"); }]);
  await assert.rejects(fetchShopCatalog(offline), (error: unknown) =>
    error instanceof ShopApiError && error.code === "NETWORK_ERROR" && error.retryable &&
    error.message === "网络连接失败，请检查网络后重试。");
  const expired = fakeSession([() => json({ error: "LOGIN_REQUIRED" }, 401)]);
  await assert.rejects(fetchShopCatalog(expired), (error: unknown) =>
    error instanceof ShopApiError && error.code === "LOGIN_REQUIRED" && !error.retryable &&
    error.message === "登录已失效，请重新登录。");
  const down = fakeSession([() => json({ error: "DATA_SERVICE_UNAVAILABLE" }, 503)]);
  await assert.rejects(fetchShopCatalog(down), (error: unknown) =>
    error instanceof ShopApiError && error.code === "DATA_SERVICE_UNAVAILABLE" && error.retryable);
  const html = fakeSession([() => new Response("<html>", { status: 502 })]);
  await assert.rejects(fetchShopCatalog(html), (error: unknown) =>
    error instanceof ShopApiError && error.code === "HTTP_502" && error.retryable);
  const aborted = new AbortController();
  aborted.abort();
  const abortSession = fakeSession([call => {
    if (call.init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    return json(catalog());
  }]);
  await assert.rejects(fetchShopCatalog(abortSession, { signal: aborted.signal }),
    (error: unknown) => (error as Error).name === "AbortError");
});

test("目录严格校验：结构错误拒绝，未知货币的报价被丢弃", async () => {
  const broken = catalog();
  (broken.items[0]!.offers[0] as { price: unknown }).price = "120";
  const session = fakeSession([() => json(broken)]);
  await assert.rejects(fetchShopCatalog(session), (error: unknown) =>
    error instanceof ShopApiError && error.code === "INVALID_CATALOG" &&
    error.cause instanceof ShopCatalogError && /items\[0\]\.offers\[0\]\.price/.test(error.cause.message));
  const notJson = fakeSession([() => new Response("{", { status: 200 })]);
  await assert.rejects(fetchShopCatalog(notJson), (error: unknown) =>
    error instanceof ShopApiError && error.code === "INVALID_CATALOG");

  assert.throws(() => parseShopCatalog({ version: "v", tabs: [] }), /items/);
  assert.throws(() => parseShopCatalog([]), /必须是对象/);
  const duplicateOffer = catalog();
  duplicateOffer.items[1]!.offers[0]!.offerId = "s1";
  assert.throws(() => parseShopCatalog(duplicateOffer), /重复：s1/);
  const duplicateItem = catalog();
  const copy = structuredClone(duplicateItem.items[0]!);
  copy.offers = copy.offers.map(offer => ({ ...offer, offerId: `${offer.offerId}-copy` }));
  duplicateItem.items.push(copy);
  assert.throws(() => parseShopCatalog(duplicateItem), /物品重复：3:10/);
  const negative = catalog();
  (negative.items[0]!.offers[0] as { days: number }).days = -1;
  assert.throws(() => parseShopCatalog(negative), /days/);

  const luccon = catalog();
  luccon.items[0]!.offers.push({ offerId: "s99", currency: "luccon", price: 220, days: 0, count: 1, source: "original" });
  luccon.items[1]!.offers = [{ offerId: "s98", currency: "luccon", price: 450, days: 0, count: 1, source: "original" }];
  const parsed = parseShopCatalog(luccon);
  assert.deepEqual(parsed.items[0]!.offers.map(offer => offer.offerId), ["s1", "s2", "s3"]);
  assert.equal(parsed.items.some(item => item.itemId === 20), false);
  assert.deepEqual(parsed.currencies.map(currency => currency.id), ["coupon", "lucci", "koin"]);
});

test("真实 catalog.json 通过严格校验且不丢任何报价", () => {
  const raw = realCatalogJson() as { items: { offers: unknown[] }[] };
  const parsed = parseShopCatalog(raw);
  assert.equal(parsed.items.length, raw.items.length);
  assert.equal(parsed.items.reduce((sum, item) => sum + item.offers.length, 0),
    raw.items.reduce((sum, item) => sum + item.offers.length, 0));
});

test("真实目录带原版商城布局：分类、推荐子页、角标、折扣、限购与卡片价格", () => {
  const catalog = parseShopCatalog(realCatalogJson());
  assert.deepEqual(catalog.shopTabs.map(tab => [tab.id, tab.name]), [["recommand", "推荐"], ["kartBody", "卡丁车"],
    ["character", "角色"], ["package", "礼包"], ["equip", "装备"], ["useful", "使用"]]);
  const recommand = catalog.shopTabs[0]!;
  assert.equal(recommand.defaultSubTab, "new");
  assert.equal(recommand.allSubTab, undefined);
  assert.deepEqual(recommand.subTabs.map(sub => sub.name), ["新商品", "热门商品", "活动"]);
  assert.deepEqual(catalog.shopTabs[1]!.subTabs.map(sub => sub.name),
    ["迅 引擎", "V1 引擎", "其他引擎", "改装部件", "强化材料"]);
  assert.equal(catalog.shopTabs[1]!.allSubTab, "全部");
  const item = (category: number, itemId: number) =>
    catalog.items.find(entry => entry.category === category && entry.itemId === itemId)!;
  for (const entry of catalog.items) {
    assert.ok(entry.shopCategory && entry.displayOfferId, `${entry.category}:${entry.itemId}`);
    if (entry.kind === "kart")
      assert.equal(entry.shopSubCategory,
        entry.engineGrade === 9 ? "engineXun" : entry.engineGrade === 8 ? "engineV1" : "engineEtc");
  }
  const svip = item(16, 364);
  assert.deepEqual(svip.recommend, ["new", "hotItem", "event"]);
  assert.deepEqual(svip.marks, ["discount", "limited"]);
  assert.deepEqual(svip.offers.find(offer => offer.offerId === svip.displayOfferId), {
    offerId: "s26914", currency: "coupon", price: 360, days: 14, count: 1, source: "original",
    originalPrice: 400, discountPercent: 10, discountLabel: "9折", limited: true, buyLimit: 1,
  });
  assert.deepEqual([item(9, 1483).shopSubCategory, item(9, 1483).shopSubCategories], ["couple", ["balloon", "couple"]]);
  // An older catalog's recommend: true names no 推荐 page.
  const legacy = structuredClone(CATALOG_JSON) as { items: Record<string, unknown>[] };
  legacy.items[0]!.recommend = true;
  assert.equal(parseShopCatalog(legacy).items[0]!.recommend, undefined);
  assert.deepEqual(parseShopCatalog(legacy).shopTabs, []);
});

test("购买成功：POST {offerId, requestId, expectedPrice, expectedCurrency}，解析钱包与物品", async () => {
  const session = fakeSession([() => json(PURCHASED)]);
  const purchaser = new ShopPurchaser(session, { randomUUID: () => "req-1" });
  const result = await purchaser.purchase(S1);
  assert.equal(session.calls[0]!.path, SHOP_PURCHASE_PATH);
  assert.equal(session.calls[0]!.init?.method, "POST");
  assert.equal(requestHeader(session.calls[0]!, "Content-Type"), "application/json");
  assert.deepEqual(requestBody(session.calls[0]!),
    { offerId: "s1", requestId: "req-1", expectedPrice: 120, expectedCurrency: "coupon" });
  assert.deepEqual(result, {
    wallet: { coupon: 80, lucci: 3000, koin: 2 },
    item: { category: 3, itemId: 10, quantity: 1, expiresAt: 1_800_000_000_000, source: "shop" },
    purchaseId: "41",
  });
  assert.equal(purchaser.pendingRequestId(S1), undefined);
});

test("购买结果未知时自动重试并沿用同一个 requestId，不会重复扣费", async () => {
  const session = fakeSession([
    () => { throw new TypeError("connection reset"); },
    () => json({ error: "DATA_SERVICE_UNAVAILABLE" }, 503),
    () => json(PURCHASED),
  ]);
  const delays: number[] = [];
  let ids = 0;
  const purchaser = new ShopPurchaser(session, {
    randomUUID: () => `req-${++ids}`, sleep: async ms => { delays.push(ms); },
  });
  await purchaser.purchase(S1);
  assert.deepEqual(session.calls.map(call => requestBody(call).requestId), ["req-1", "req-1", "req-1"]);
  assert.deepEqual(delays, [500, 1500]);
});

test("自动重试用尽后由玩家重试：同一报价沿用 requestId，换报价才生成新的", async () => {
  const unavailable = () => json({ error: "INTERNAL_ERROR" }, 500);
  const session = fakeSession([unavailable, unavailable, unavailable, unavailable, () => json(PURCHASED),
    () => json(PURCHASED)]);
  let ids = 0;
  const purchaser = new ShopPurchaser(session, {
    randomUUID: () => `req-${++ids}`, retryDelaysMs: [0, 0], sleep: async () => {},
  });
  await assert.rejects(purchaser.purchase(S1), (error: unknown) =>
    error instanceof ShopApiError && error.code === "INTERNAL_ERROR" && error.retryable);
  assert.equal(purchaser.pendingRequestId(S1), "req-1");
  await purchaser.purchase(S1);
  await purchaser.purchase(S2);
  assert.deepEqual(session.calls.map(call => requestBody(call).requestId),
    ["req-1", "req-1", "req-1", "req-1", "req-1", "req-2"]);
  assert.equal(requestBody(session.calls[5]!).offerId, "s2");
});

test("明确的拒绝不自动重试，下一次购买换新 requestId", async () => {
  const session = fakeSession([
    () => json({ error: "INSUFFICIENT_FUNDS" }, 409),
    () => json({ error: "ALREADY_OWNED" }, 409),
    () => json({ error: "TOO_MANY_ATTEMPTS" }, 429),
    () => json(PURCHASED),
  ]);
  let ids = 0;
  const purchaser = new ShopPurchaser(session, { randomUUID: () => `req-${++ids}`, sleep: async () => {} });
  await assert.rejects(purchaser.purchase(S1), (error: unknown) =>
    error instanceof ShopApiError && error.code === "INSUFFICIENT_FUNDS" && !error.retryable &&
    error.message === "余额不足，无法购买该道具。");
  await assert.rejects(purchaser.purchase(S1), (error: unknown) =>
    error instanceof ShopApiError && error.code === "ALREADY_OWNED" && error.status === 409);
  // Rate limits are not repeated automatically but keep the request id.
  await assert.rejects(purchaser.purchase(S1), (error: unknown) =>
    error instanceof ShopApiError && error.code === "TOO_MANY_ATTEMPTS" && error.retryable);
  await purchaser.purchase(S1);
  assert.deepEqual(session.calls.map(call => requestBody(call).requestId), ["req-1", "req-2", "req-3", "req-3"]);
});

test("成功响应体无效时报 INVALID_RESPONSE（可用同一 requestId 重试）", async () => {
  const session = fakeSession([() => json({ wallet: {}, item: null }), () => json(PURCHASED)]);
  const purchaser = new ShopPurchaser(session, { randomUUID: () => "req-x", sleep: async () => {} });
  await assert.rejects(purchaser.purchase(S1), (error: unknown) =>
    error instanceof ShopApiError && error.code === "INVALID_RESPONSE" && error.retryable);
  assert.equal(session.calls.length, 1);
  assert.equal(purchaser.pendingRequestId(S1), "req-x");
  await purchaser.purchase(S1);
  assert.equal(requestBody(session.calls[1]!).requestId, "req-x");
  assert.throws(() => parsePurchaseResult({ ...PURCHASED, purchaseId: null }), /无效/);
  assert.throws(() => parsePurchaseResult({ ...PURCHASED, item: { ...PURCHASED.item, expiresAt: "x" } }), /无效/);
  assert.equal(parsePurchaseResult({ ...PURCHASED, item: { ...PURCHASED.item, systemKey: "k" } }).item.systemKey, "k");
});

test("错误码中文文案", () => {
  assert.equal(shopErrorMessage("EXP_REQUIRED"), "经验不足，暂时无法购买该道具。");
  assert.equal(shopErrorMessage("OFFER_NOT_FOUND"), "该商品已下架或价格已变更，请刷新商店后重试。");
  assert.equal(shopErrorMessage("TOO_MANY_ATTEMPTS"), "操作过于频繁，请稍后再试。");
  assert.equal(shopErrorMessage("DATA_SERVICE_UNAVAILABLE"), "数据服务暂时不可用，请稍后再试。");
  assert.equal(shopErrorMessage("WHATEVER"), "操作失败（WHATEVER），请稍后再试。");
});

test("requestId 是 UUID v4 形式", () => {
  const id = newRequestId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(newRequestId(), id);
});

test("服务端价格与所见不同：409 PRICE_CHANGED 提示刷新商店，不自动重试", async () => {
  const session = fakeSession([
    () => json({ error: "PRICE_CHANGED" }, 409),
    () => json(PURCHASED),
  ]);
  let ids = 0;
  const purchaser = new ShopPurchaser(session, { randomUUID: () => `req-${++ids}`, sleep: async () => {} });
  await assert.rejects(purchaser.purchase(S1), (error: unknown) =>
    error instanceof ShopApiError && error.code === "PRICE_CHANGED" && error.status === 409 &&
    !error.retryable && error.staleCatalog && error.message === "价格已变化，请刷新商店后重试。");
  assert.equal(session.calls.length, 1);
  // The refreshed price is a new purchase with a new requestId.
  await purchaser.purchase({ ...S1, price: 130 });
  assert.deepEqual(requestBody(session.calls[1]!),
    { offerId: "s1", requestId: "req-2", expectedPrice: 130, expectedCurrency: "coupon" });
  assert.equal(new ShopApiError("OFFER_NOT_FOUND", 409).staleCatalog, true);
  assert.equal(new ShopApiError("INSUFFICIENT_FUNDS", 409).staleCatalog, false);
});

test("同一报价换了价格不沿用未完成的 requestId", async () => {
  const session = fakeSession([() => json({ error: "INTERNAL_ERROR" }, 500), () => json(PURCHASED)]);
  let ids = 0;
  const purchaser = new ShopPurchaser(session, {
    randomUUID: () => `req-${++ids}`, retryDelaysMs: [], sleep: async () => {},
  });
  await assert.rejects(purchaser.purchase(S1));
  assert.equal(purchaser.pendingRequestId(S1), "req-1");
  assert.equal(purchaser.pendingRequestId({ ...S1, price: 99 }), undefined);
  await purchaser.purchase({ ...S1, price: 99 });
  assert.equal(requestBody(session.calls[1]!).requestId, "req-2");
});

test("购买请求超时（默认 15 秒）按网络错误处理：不自动重试，重试沿用 requestId", { timeout: 5_000 }, async () => {
  assert.equal(PURCHASE_TIMEOUT_MS, 15_000);
  const signals: AbortSignal[] = [];
  // The first request never answers and ignores its signal; the second honours it.
  const session = fakeSession([
    call => { signals.push(call.init!.signal!); return new Promise<Response>(() => {}); },
    call => new Promise<Response>((_, reject) => {
      const signal = call.init!.signal!;
      signals.push(signal);
      signal.addEventListener("abort", () => reject(signal.reason));
    }),
    () => json(PURCHASED),
  ]);
  let ids = 0;
  const sleeps: number[] = [];
  const purchaser = new ShopPurchaser(session, {
    randomUUID: () => `req-${++ids}`, timeoutMs: 20, sleep: async ms => { sleeps.push(ms); },
  });
  const alive = keepAlive();
  try {
    for (let round = 0; round < 2; round++) {
      await assert.rejects(purchaser.purchase(S1), (error: unknown) =>
        error instanceof ShopApiError && error.code === "NETWORK_ERROR" && error.retryable && error.timedOut &&
        error.message === "网络连接失败，请检查网络后重试。");
    }
  } finally {
    alive();
  }
  assert.equal(session.calls.length, 2, "a timed-out attempt is not repeated automatically");
  assert.deepEqual(sleeps, []);
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(purchaser.pendingRequestId(S1), "req-1");
  await purchaser.purchase(S1);
  assert.deepEqual(session.calls.map(call => requestBody(call).requestId), ["req-1", "req-1", "req-1"]);
  assert.equal(new ShopApiError("NETWORK_ERROR", 0, { cause: new TypeError("offline") }).timedOut, false);
});

test("响应体读取超时同样按网络错误处理", { timeout: 5_000 }, async () => {
  const stalled = new Response(new ReadableStream({ start() { /* never sends */ } }), { status: 200 });
  const session = fakeSession([() => stalled]);
  const purchaser = new ShopPurchaser(session, { randomUUID: () => "req-1", timeoutMs: 20 });
  const alive = keepAlive();
  try {
    await assert.rejects(purchaser.purchase(S1), (error: unknown) =>
      error instanceof ShopApiError && error.code === "NETWORK_ERROR" && error.timedOut);
  } finally {
    alive();
  }
  assert.equal(purchaser.pendingRequestId(S1), "req-1");
});
