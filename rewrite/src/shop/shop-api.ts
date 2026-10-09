/**
 * Shop requests to the data service (server-go/ECONOMY.md 6): the catalog
 * with an in-memory ETag cache, and idempotent purchases.
 */
import type { AccountSession, Currency, InventoryItem } from "../account/account-session";
import { parseShopCatalog, ShopCatalogError, type ShopCatalog, type ShopOffer } from "./shop-catalog";

export const SHOP_CATALOG_PATH = "/api/shop/catalog";
export const SHOP_PURCHASE_PATH = "/api/shop/purchase";

/** The session members the shop requests use. */
export type ShopApiSession = Pick<AccountSession, "backendOrigin" | "authorizedFetch">;

/** Chinese messages for the data service's stable error codes. */
const ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_FUNDS: "余额不足，无法购买该道具。",
  ALREADY_OWNED: "你已永久拥有该道具，无需重复购买。",
  EXP_REQUIRED: "经验不足，暂时无法购买该道具。",
  OFFER_NOT_FOUND: "该商品已下架或价格已变更，请刷新商店后重试。",
  PRICE_CHANGED: "价格已变化，请刷新商店后重试。",
  QUANTITY_LIMIT: "该道具的数量已达上限，无法继续购买。",
  REQUEST_ID_CONFLICT: "购买请求冲突，请重新选择后再试。",
  INVALID_REQUEST_ID: "购买请求无效，请刷新商店后重试。",
  LOGIN_REQUIRED: "登录已失效，请重新登录。",
  TOO_MANY_ATTEMPTS: "操作过于频繁，请稍后再试。",
  DATA_SERVICE_UNAVAILABLE: "数据服务暂时不可用，请稍后再试。",
  NETWORK_ERROR: "网络连接失败，请检查网络后重试。",
  INVALID_RESPONSE: "服务器返回的数据无效，请稍后再试。",
  INVALID_CATALOG: "商店目录数据无效，请稍后再试。",
  INVALID_REQUEST: "购买请求无效，请刷新商店后重试。",
  NOT_FOUND: "商店服务暂未开放。",
  METHOD_NOT_ALLOWED: "商店服务暂未开放。",
  INTERNAL_ERROR: "服务器内部错误，请稍后再试。",
};

export function shopErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? `操作失败（${code}），请稍后再试。`;
}

/**
 * Codes whose outcome is unknown or temporary: the request may be repeated
 * with the same requestId. (A 200 with an unreadable body may already have
 * charged, so it is retryable too: the server answers the same requestId
 * with the original result.)
 */
const RETRYABLE_CODES = new Set([
  "NETWORK_ERROR", "TOO_MANY_ATTEMPTS", "DATA_SERVICE_UNAVAILABLE", "INTERNAL_ERROR",
  "INVALID_RESPONSE",
]);

/** A failed shop request with the server's error code (or a client code). */
export class ShopApiError extends Error {
  constructor(readonly code: string, readonly status = 0, options?: { cause?: unknown }) {
    super(shopErrorMessage(code), options);
    this.name = "ShopApiError";
  }

  /** The outcome is unknown or temporary; retrying is safe and useful. */
  get retryable(): boolean { return RETRYABLE_CODES.has(this.code) || this.status >= 500; }

  /** The shop's catalog is out of date for this offer; reload it before buying again. */
  get staleCatalog(): boolean { return this.code === "OFFER_NOT_FOUND" || this.code === "PRICE_CHANGED"; }

  /** A network failure because the request took longer than the purchase time limit. */
  get timedOut(): boolean {
    return this.code === "NETWORK_ERROR" && typeof this.cause === "object" && this.cause !== null &&
      (this.cause as { name?: unknown }).name === "TimeoutError";
  }
}

export function isShopApiError(error: unknown): error is ShopApiError {
  return error instanceof ShopApiError;
}

function abortError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    (error as { name?: unknown }).name === "AbortError";
}

async function errorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const code = (body as { error?: unknown; code?: unknown }).error ??
        (body as { code?: unknown }).code;
      if (typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code)) return code;
    }
  } catch { /* Not a JSON error body. */ }
  if (response.status === 401) return "LOGIN_REQUIRED";
  if (response.status === 429) return "TOO_MANY_ATTEMPTS";
  if (response.status === 503) return "DATA_SERVICE_UNAVAILABLE";
  return `HTTP_${response.status}`;
}

// --- Catalog --------------------------------------------------------------

interface CatalogCacheEntry { etag: string; catalog: ShopCatalog }

const catalogCache = new Map<string, CatalogCacheEntry>();

/** Forget cached catalogs (tests, logout). */
export function clearShopCatalogCache(): void {
  catalogCache.clear();
}

/** The catalog already fetched for this data service, if any. */
export function cachedShopCatalog(session: Pick<AccountSession, "backendOrigin">):
  ShopCatalog | undefined {
  return catalogCache.get(session.backendOrigin)?.catalog;
}

export interface CatalogRequestOptions { signal?: AbortSignal }

async function catalogResponse(session: ShopApiSession, etag: string | undefined,
  signal: AbortSignal | undefined): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (etag) headers["If-None-Match"] = etag;
  // Always revalidate (a 304 is cheap): a copy the browser cached must not
  // keep showing old prices.
  return session.authorizedFetch(SHOP_CATALOG_PATH, { method: "GET", headers, signal, cache: "no-cache" });
}

/**
 * The catalog response, conditional when etag is given. A conditional request
 * that fails at the network level (perhaps a cross-origin data service whose
 * CORS policy does not allow If-None-Match) is repeated once without the
 * header; the next fetch tries the conditional request again, so a passing
 * network failure does not turn revalidation off for good.
 */
async function requestCatalog(session: ShopApiSession, etag: string | undefined,
  signal: AbortSignal | undefined): Promise<Response> {
  try {
    return await catalogResponse(session, etag, signal);
  } catch (error) {
    if (abortError(error)) throw error;
    if (!etag) throw new ShopApiError("NETWORK_ERROR", 0, { cause: error });
  }
  try {
    return await catalogResponse(session, undefined, signal);
  } catch (error) {
    if (abortError(error)) throw error;
    throw new ShopApiError("NETWORK_ERROR", 0, { cause: error });
  }
}

/**
 * GET /api/shop/catalog, always revalidated: a cached copy is sent with
 * If-None-Match and reused on 304.
 */
export async function fetchShopCatalog(session: ShopApiSession,
  options: CatalogRequestOptions = {}): Promise<ShopCatalog> {
  const origin = session.backendOrigin;
  const cached = catalogCache.get(origin);
  let response = await requestCatalog(session, cached?.etag, options.signal);
  if (response.status === 304) {
    if (cached) return cached.catalog;
    // A 304 without a copy of ours (a header added elsewhere): ask for the body once.
    response = await requestCatalog(session, undefined, options.signal);
  }
  if (!response.ok) throw new ShopApiError(await errorCode(response), response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (abortError(error)) throw error;
    throw new ShopApiError("INVALID_CATALOG", response.status, { cause: error });
  }
  let catalog: ShopCatalog;
  try {
    catalog = parseShopCatalog(body);
  } catch (error) {
    if (error instanceof ShopCatalogError)
      throw new ShopApiError("INVALID_CATALOG", response.status, { cause: error });
    throw error;
  }
  // Keep the same object for an unchanged version so derived indexes stay valid.
  if (cached && cached.catalog.version === catalog.version) catalog = cached.catalog;
  const etag = response.headers.get("ETag") ?? `"${catalog.version}"`;
  catalogCache.set(origin, { etag, catalog });
  return catalog;
}

// --- Purchase -------------------------------------------------------------

export interface ShopPurchaseResult {
  wallet: Record<Currency, number>;
  item: InventoryItem;
  purchaseId: string;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validates the POST /api/shop/purchase body {wallet, item, purchaseId}. */
export function parsePurchaseResult(value: unknown): ShopPurchaseResult {
  const invalid = () => new ShopApiError("INVALID_RESPONSE", 200);
  if (typeof value !== "object" || value === null) throw invalid();
  const body = value as Record<string, unknown>;
  const wallet = body.wallet as Record<string, unknown> | null | undefined;
  const item = body.item as Record<string, unknown> | null | undefined;
  if (typeof wallet !== "object" || wallet === null || typeof item !== "object" || item === null)
    throw invalid();
  if (!finiteNumber(wallet.coupon) || !finiteNumber(wallet.lucci) || !finiteNumber(wallet.koin))
    throw invalid();
  if (!Number.isSafeInteger(item.category) || !Number.isSafeInteger(item.itemId) ||
      !Number.isSafeInteger(item.quantity) ||
      !(item.expiresAt === null || finiteNumber(item.expiresAt)) ||
      (item.systemKey !== undefined && item.systemKey !== null &&
        typeof item.systemKey !== "string") ||
      (item.source !== undefined && typeof item.source !== "string"))
    throw invalid();
  const purchaseId = body.purchaseId;
  if (typeof purchaseId !== "string" && !finiteNumber(purchaseId)) throw invalid();
  const inventoryItem: InventoryItem = {
    category: item.category as number,
    itemId: item.itemId as number,
    quantity: item.quantity as number,
    expiresAt: item.expiresAt as number | null,
    source: (item.source as string | undefined) ?? "shop",
    ...(typeof item.systemKey === "string" && item.systemKey ? { systemKey: item.systemKey } : {}),
  };
  return {
    wallet: { coupon: wallet.coupon, lucci: wallet.lucci, koin: wallet.koin },
    item: inventoryItem,
    purchaseId: String(purchaseId),
  };
}

/** A random request id; crypto.randomUUID needs a secure context. */
export function newRequestId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** What a purchase names: the offer and the price the player was shown. */
export type ShopOfferRef = Pick<ShopOffer, "offerId" | "price" | "currency">;

/** POST /api/shop/purchase body; the server answers 409 PRICE_CHANGED when the price differs. */
export interface ShopPurchaseRequest {
  offerId: string;
  requestId: string;
  expectedPrice: number;
  expectedCurrency: ShopOffer["currency"];
}

/** One purchase attempt longer than this counts as a network failure. */
export const PURCHASE_TIMEOUT_MS = 15_000;

export interface ShopPurchaserOptions {
  randomUUID?: () => string;
  /** Delays before automatic retries of an unknown outcome (same requestId). */
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Time limit of one attempt (PURCHASE_TIMEOUT_MS). */
  timeoutMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("请求超时", "TimeoutError")), ms);
  (timer as { unref?(): void }).unref?.();
  return controller.signal;
}

/** Rejects with the signal's reason once it aborts. */
function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => reject(signal.reason ?? new DOMException("请求超时", "TimeoutError"));
    if (signal.aborted) fail();
    else signal.addEventListener("abort", fail, { once: true });
  });
}

function offerKey(offer: ShopOfferRef): string {
  return `${offer.offerId}|${offer.currency}|${offer.price}`;
}

/**
 * POST /api/shop/purchase with retry-safe idempotency: one requestId per
 * logical purchase. Network failures (including an attempt slower than the
 * time limit) and 5xx/429 answers keep the requestId, so a retry of the same
 * offer (automatic or by the player) can never charge twice; a definitive
 * rejection or a success starts a new purchase next time. The shop uses one
 * purchaser per buy dialog: a later, deliberate purchase of the same offer in
 * a new dialog is a new purchase, never a replay of an old unknown outcome.
 */
export class ShopPurchaser {
  private pending?: { key: string; requestId: string };
  private readonly randomUUID: () => string;
  private readonly retryDelaysMs: readonly number[];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;

  constructor(readonly session: ShopApiSession, options: ShopPurchaserOptions = {}) {
    this.randomUUID = options.randomUUID ?? newRequestId;
    this.retryDelaysMs = options.retryDelaysMs ?? [500, 1500];
    this.sleep = options.sleep ?? defaultSleep;
    this.timeoutMs = options.timeoutMs ?? PURCHASE_TIMEOUT_MS;
  }

  /** The requestId the next purchase of this offer will use, if one is pending. */
  pendingRequestId(offer: ShopOfferRef): string | undefined {
    return this.pending?.key === offerKey(offer) ? this.pending.requestId : undefined;
  }

  /** Drop an unfinished purchase: the next one gets a new requestId. */
  reset(): void { this.pending = undefined; }

  async purchase(offer: ShopOfferRef): Promise<ShopPurchaseResult> {
    const key = offerKey(offer);
    if (this.pending?.key !== key) this.pending = { key, requestId: this.randomUUID() };
    const requestId = this.pending.requestId;
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.attempt(offer, requestId);
        if (this.pending?.requestId === requestId) this.pending = undefined;
        return result;
      } catch (error) {
        const failure = error instanceof ShopApiError ? error :
          new ShopApiError("NETWORK_ERROR", 0, { cause: error });
        if (!failure.retryable) {
          if (this.pending?.requestId === requestId) this.pending = undefined;
          throw failure;
        }
        const delay = this.retryDelaysMs[attempt];
        // Rate limits, unreadable success bodies and timeouts are left to the
        // player (with the same requestId), who may also cancel; repeating
        // them at once would not help.
        if (delay === undefined || failure.code === "TOO_MANY_ATTEMPTS" ||
            failure.code === "INVALID_RESPONSE" || failure.timedOut) throw failure;
        await this.sleep(delay);
      }
    }
  }

  private async attempt(offer: ShopOfferRef, requestId: string): Promise<ShopPurchaseResult> {
    const signal = timeoutSignal(this.timeoutMs);
    // The race also covers a fetch (or a body) that ignores the signal.
    const timedOut = whenAborted(signal);
    let response: Response;
    try {
      const body: ShopPurchaseRequest = {
        offerId: offer.offerId, requestId, expectedPrice: offer.price, expectedCurrency: offer.currency,
      };
      response = await Promise.race([this.session.authorizedFetch(SHOP_PURCHASE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal,
      }), timedOut]);
    } catch (error) {
      throw new ShopApiError("NETWORK_ERROR", 0, { cause: signal.aborted ? signal.reason ?? error : error });
    }
    if (!response.ok) {
      let code: string;
      try {
        code = await Promise.race([errorCode(response), timedOut]);
      } catch (error) {
        throw new ShopApiError("NETWORK_ERROR", 0, { cause: error });
      }
      throw new ShopApiError(code, response.status);
    }
    let body: unknown;
    try {
      body = await Promise.race([response.json(), timedOut]);
    } catch (error) {
      // A body cut off by the time limit: the outcome is unknown, like any network failure.
      if (signal.aborted) throw new ShopApiError("NETWORK_ERROR", 0, { cause: signal.reason ?? error });
      throw new ShopApiError("INVALID_RESPONSE", response.status, { cause: error });
    }
    return parsePurchaseResult(body);
  }
}
