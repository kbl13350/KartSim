/**
 * The data service's lottery endpoints (server-go/LOTTERY.md 6): the 寻宝
 * board (GET /api/lottery/treasure-hunt, POST …/draw), the 精品道具场
 * (GET /api/lottery/gacha, /api/lottery/gacha/{itemId}, POST …/draw), the
 * original material packs (POST /api/lottery/packs/buy), the daily free
 * materials (POST /api/lottery/daily) and the names of the items the shop
 * catalog does not list (GET /api/lottery/items). Responses are validated
 * here; every failure is an AccountServiceError whose code maps to Chinese
 * text with lotteryErrorMessage.
 */
import { AccountServiceError, errorCode } from "../account/account-api";
import type { Currency } from "../account/account-session";

/** The session members the lottery requests use. */
export interface LotterySession {
  requestJson(path: string, init?: RequestInit): Promise<unknown>;
}

export interface LotteryItem {
  category: number;
  itemId: number;
  name: string;
  count: number;
  /** Rental days; 0 is permanent. */
  days: number;
  /** Set when the item credited the wallet (酷币 / 电池). */
  currency?: Currency;
  /** A pack item skipped because it is owned permanently. */
  owned?: boolean;
}

export interface LotteryActivity {
  open: boolean;
  enabled: boolean;
  /** Unix ms; undefined when open-ended. */
  start?: number;
  end?: number;
}

export interface LotteryPack {
  stockId: number;
  name: string;
  currency: Currency;
  price: number;
  minExp?: number;
  items: LotteryItem[];
}

export interface LotteryDaily {
  /** Open, not claimed today and something to claim. */
  available: boolean;
  claimed: boolean;
  items: LotteryItem[];
}

export interface OwnedItemRef {
  category: number;
  itemId: number;
  name: string;
  owned: number;
}

export type HuntRarity = "normal" | "rare" | "epic" | "unique" | "legend" | "special" | "ultimate";

export interface HuntSlot {
  slot: number;
  rarity: HuntRarity;
  stockId: number;
  items: LotteryItem[];
  /** Parts per million. */
  chance: number;
  /** 保底: granted at the latest on this many counted draws. */
  acquireCount?: number;
  counter?: number;
  /** Counted draws left until the 保底 grant. */
  remaining?: number;
}

export interface TreasureHuntState {
  activity: LotteryActivity;
  huntId: number;
  theme: string;
  slots: HuntSlot[];
  /** The 神秘魔方 pool: the rewards outside the board slots. */
  others: { rewards: number; chance: number };
  materials: { material: OwnedItemRef; other: OwnedItemRef; eventMaterial?: OwnedItemRef };
  packs: LotteryPack[];
  daily: LotteryDaily;
  rewards: number;
}

export interface LotteryDraw {
  stocks: number[];
  items: LotteryItem[];
  slot?: number;
  rarity?: HuntRarity;
  /** Granted by 保底. */
  pity?: boolean;
  /** The [活动] material was used. */
  event?: boolean;
  /** A premium (needToNotice) win. */
  notice?: boolean;
}

export type DrawStopCode = "INSUFFICIENT_ITEMS" | "ALREADY_OWNED" | "LOTTERY_EMPTY";

export interface DrawResult {
  draws: LotteryDraw[];
  stopped?: { code: DrawStopCode | string; item?: LotteryItem };
  /** Mileage prizes reached. */
  prizes: LotteryDraw[];
  wallet: Record<Currency, number>;
  /** Active quantities after the request, "category:itemId" keys. */
  holdings: Map<string, number>;
  counters: Map<string, number>;
  /** 寻宝: the board slots with their 保底 progress after the request. */
  slots?: HuntSlot[];
}

export interface GachaEntry {
  itemId: number;
  name: string;
  owned: number;
  /** An original pack sells it. */
  featured: boolean;
  open: boolean;
  key?: OwnedItemRef;
}

export interface GachaList {
  activity: LotteryActivity;
  daily: LotteryDaily;
  lotteries: GachaEntry[];
}

export interface GachaDetail {
  lottery: {
    itemId: number; name: string; caption: string; desc: string; effect: string; dialog: string;
    /** Reward sets: one reward is drawn from each. */
    sets: number;
    rewards: number;
  };
  activity: LotteryActivity;
  owned: number;
  key?: OwnedItemRef;
  summary: Array<{ stockId: number; notice: boolean; items: LotteryItem[] }>;
  mileage?: { points: number; event: boolean; prizes: Array<{ points: number; items: LotteryItem[] }> };
  packs: LotteryPack[];
  daily: LotteryDaily;
}

export interface PackResult {
  wallet: Record<Currency, number>;
  items: LotteryItem[];
  purchaseId: number;
}

export interface DailyResult {
  wallet: Record<Currency, number>;
  items: LotteryItem[];
}

export interface LotteryItemName {
  category: number;
  itemId: number;
  name: string;
  count?: boolean;
  effect?: string;
}

const MESSAGES: Record<string, string> = {
  LOTTERY_CLOSED: "活动当前未开放。",
  LOTTERY_NOT_FOUND: "找不到这个抽奖道具。",
  PACK_NOT_FOUND: "该礼包已下架。",
  INVALID_COUNT: "使用数量无效。",
  INVALID_ACTIVITY: "活动无效。",
  NOTHING_TO_CLAIM: "今天没有可领取的免费道具。",
  ALREADY_CLAIMED: "今天的免费道具已经领取过了。",
  INSUFFICIENT_FUNDS: "余额不足，无法兑换。",
  EXP_REQUIRED: "经验不足，暂时无法兑换该礼包。",
  PRICE_CHANGED: "价格已变化，请重新打开后再试。",
  REQUEST_ID_CONFLICT: "请求冲突，请重新操作。",
  INVALID_REQUEST_ID: "请求无效，请重新操作。",
  INVALID_REQUEST: "请求无效，请重新操作。",
  LOGIN_REQUIRED: "登录已失效，请重新登录。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  TOO_MANY_ATTEMPTS: "操作过于频繁，请稍后再试。",
  DATA_SERVICE_UNAVAILABLE: "数据服务暂时不可用，请稍后再试。",
  INTERNAL_ERROR: "服务器内部错误，请稍后再试。",
  NOT_FOUND: "抽奖服务暂未开放。",
  INVALID_RESPONSE: "服务器返回的数据无效，请稍后再试。",
};

/** Chinese text for a lottery error (or its code). */
export function lotteryErrorMessage(error: unknown): string {
  const code = typeof error === "string" ? error : errorCode(error) ?? "";
  return MESSAGES[code] ?? `操作失败（${code || "未知错误"}），请稍后再试。`;
}

/* ---------- validation ---------- */

type Json = Record<string, unknown>;

function invalid(what: string): never {
  throw new AccountServiceError("INVALID_RESPONSE", 0, what);
}

function record(value: unknown, what: string): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(what);
  return value as Json;
}

function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) invalid(what);
  return value;
}

function int(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) invalid(what);
  return value;
}

function optionalInt(value: unknown, what: string): number | undefined {
  return value === undefined || value === null ? undefined : int(value, what);
}

function text(value: unknown, what: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") invalid(what);
  return value;
}

const CURRENCIES = new Set<string>(["coupon", "lucci", "koin"]);

function currency(value: unknown, what: string): Currency {
  if (typeof value !== "string" || !CURRENCIES.has(value)) invalid(what);
  return value as Currency;
}

function wallet(value: unknown): Record<Currency, number> {
  const body = record(value, "钱包");
  return { coupon: int(body.coupon, "点券"), lucci: int(body.lucci, "金币"), koin: int(body.koin, "K币") };
}

export function parseLotteryItem(value: unknown): LotteryItem {
  const body = record(value, "道具");
  const item: LotteryItem = {
    category: int(body.category, "道具分类"), itemId: int(body.itemId, "道具编号"),
    name: text(body.name, "道具名称"), count: int(body.count ?? 1, "道具数量"), days: int(body.days ?? 0, "道具期限"),
  };
  if (body.currency !== undefined) item.currency = currency(body.currency, "道具货币");
  if (body.owned === true) item.owned = true;
  return item;
}

function items(value: unknown): LotteryItem[] {
  return list(value ?? [], "道具列表").map(parseLotteryItem);
}

function activity(value: unknown): LotteryActivity {
  const body = record(value, "活动");
  const start = optionalInt(body.start, "开始时间");
  const end = optionalInt(body.end, "结束时间");
  return { open: body.open === true, enabled: body.enabled === true,
    ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}) };
}

function packs(value: unknown): LotteryPack[] {
  return list(value ?? [], "礼包").map(raw => {
    const body = record(raw, "礼包");
    const minExp = optionalInt(body.minExp, "礼包经验");
    return { stockId: int(body.stockId, "礼包编号"), name: text(body.name, "礼包名称"),
      currency: currency(body.currency, "礼包货币"), price: int(body.price, "礼包价格"),
      ...(minExp ? { minExp } : {}), items: items(body.items) };
  });
}

function daily(value: unknown): LotteryDaily {
  const body = record(value, "每日免费");
  return { available: body.available === true, claimed: body.claimed === true, items: items(body.items) };
}

function ownedRef(value: unknown): OwnedItemRef {
  const body = record(value, "材料");
  return { category: int(body.category, "材料分类"), itemId: int(body.itemId, "材料编号"),
    name: text(body.name, "材料名称"), owned: int(body.owned ?? 0, "材料数量") };
}

const RARITIES = new Set(["normal", "rare", "epic", "unique", "legend", "special", "ultimate"]);

function rarity(value: unknown): HuntRarity | undefined {
  return typeof value === "string" && RARITIES.has(value) ? value as HuntRarity : undefined;
}

function slots(value: unknown): HuntSlot[] {
  return list(value, "寻宝格子").map(raw => {
    const body = record(raw, "寻宝格子");
    const slot: HuntSlot = { slot: int(body.slot, "格子"), rarity: rarity(body.rarity) ?? "normal",
      stockId: int(body.stockId, "格子奖励"), items: items(body.items), chance: int(body.chance ?? 0, "概率") };
    const acquire = optionalInt(body.acquireCount, "保底次数");
    if (acquire) {
      slot.acquireCount = acquire;
      slot.counter = optionalInt(body.counter, "保底计数") ?? 0;
      slot.remaining = optionalInt(body.remaining, "保底剩余") ?? acquire;
    }
    return slot;
  });
}

function numberMap(value: unknown, what: string): Map<string, number> {
  const body = record(value ?? {}, what);
  return new Map(Object.entries(body).map(([key, amount]) => [key, int(amount, what)]));
}

function draws(value: unknown): LotteryDraw[] {
  return list(value ?? [], "抽奖结果").map(raw => {
    const body = record(raw, "抽奖结果");
    const draw: LotteryDraw = { stocks: list(body.stocks ?? [], "奖励").map(id => int(id, "奖励")), items: items(body.items) };
    const slot = optionalInt(body.slot, "格子");
    if (slot) draw.slot = slot;
    const kind = rarity(body.rarity);
    if (kind) draw.rarity = kind;
    if (body.pity === true) draw.pity = true;
    if (body.event === true) draw.event = true;
    if (body.notice === true) draw.notice = true;
    return draw;
  });
}

export function parseDrawResult(value: unknown): DrawResult {
  const body = record(value, "抽奖结果");
  const result: DrawResult = {
    draws: draws(body.draws), prizes: draws(body.prizes), wallet: wallet(body.wallet),
    holdings: numberMap(body.holdings, "持有数量"), counters: numberMap(body.counters, "保底计数"),
  };
  if (body.stopped !== undefined && body.stopped !== null) {
    const stopped = record(body.stopped, "停止原因");
    result.stopped = { code: text(stopped.code, "停止原因"),
      ...(stopped.item ? { item: parseLotteryItem(stopped.item) } : {}) };
  }
  if (body.slots !== undefined) result.slots = slots(body.slots);
  return result;
}

export function parseTreasureHunt(value: unknown): TreasureHuntState {
  const body = record(value, "寻宝");
  const materials = record(body.materials, "寻宝材料");
  const others = record(body.others ?? {}, "神秘魔方");
  return {
    activity: activity(body.activity), huntId: int(body.huntId, "寻宝编号"), theme: text(body.theme, "主题"),
    slots: slots(body.slots),
    others: { rewards: int(others.rewards ?? 0, "神秘魔方"), chance: int(others.chance ?? 0, "神秘魔方概率") },
    materials: { material: ownedRef(materials.material), other: ownedRef(materials.other),
      ...(materials.eventMaterial ? { eventMaterial: ownedRef(materials.eventMaterial) } : {}) },
    packs: packs(body.packs), daily: daily(body.daily), rewards: int(body.rewards ?? 0, "奖励数量"),
  };
}

export function parseGachaList(value: unknown): GachaList {
  const body = record(value, "精品道具场");
  return {
    activity: activity(body.activity), daily: daily(body.daily),
    lotteries: list(body.lotteries, "扭蛋列表").map(raw => {
      const entry = record(raw, "扭蛋");
      return { itemId: int(entry.itemId, "扭蛋编号"), name: text(entry.name, "扭蛋名称"),
        owned: int(entry.owned ?? 0, "持有数量"), featured: entry.featured === true, open: entry.open === true,
        ...(entry.key ? { key: ownedRef(entry.key) } : {}) };
    }),
  };
}

export function parseGachaDetail(value: unknown): GachaDetail {
  const body = record(value, "扭蛋");
  const lottery = record(body.lottery, "扭蛋");
  const detail: GachaDetail = {
    lottery: { itemId: int(lottery.itemId, "扭蛋编号"), name: text(lottery.name, "扭蛋名称"),
      caption: text(lottery.caption, "标题"), desc: text(lottery.desc, "说明"), effect: text(lottery.effect, "效果"),
      dialog: text(lottery.dialog, "窗口"), sets: int(lottery.sets ?? 1, "奖池数"), rewards: int(lottery.rewards ?? 0, "奖励数") },
    activity: activity(body.activity), owned: int(body.owned ?? 0, "持有数量"),
    summary: list(body.summary ?? [], "可获得道具").map(raw => {
      const row = record(raw, "可获得道具");
      return { stockId: int(row.stockId, "奖励"), notice: row.notice === true, items: items(row.items) };
    }),
    packs: packs(body.packs), daily: daily(body.daily),
  };
  if (body.key) detail.key = ownedRef(body.key);
  if (body.mileage) {
    const mileage = record(body.mileage, "保底");
    detail.mileage = { points: int(mileage.points ?? 0, "保底积分"), event: mileage.event === true,
      prizes: list(mileage.prizes ?? [], "保底奖励").map(raw => {
        const prize = record(raw, "保底奖励");
        return { points: int(prize.points, "保底积分"), items: items(prize.items) };
      }) };
  }
  return detail;
}

/** A fresh request id for one draw or purchase. */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = bytes[6]! & 0x0f | 0x40;
  bytes[8] = bytes[8]! & 0x3f | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The lottery endpoints for one session. */
export class LotteryApi {
  private names?: Promise<Map<string, LotteryItemName>>;

  constructor(readonly session: LotterySession) {}

  private post(path: string, body: unknown): Promise<unknown> {
    return this.session.requestJson(path, { method: "POST", body: JSON.stringify(body) });
  }

  async treasureHunt(): Promise<TreasureHuntState> {
    return parseTreasureHunt(await this.session.requestJson("/api/lottery/treasure-hunt"));
  }

  async treasureDraw(count: 1 | 10, requestId = newRequestId()): Promise<DrawResult> {
    return parseDrawResult(await this.post("/api/lottery/treasure-hunt/draw", { requestId, count }));
  }

  async gachaList(): Promise<GachaList> {
    return parseGachaList(await this.session.requestJson("/api/lottery/gacha"));
  }

  async gacha(itemId: number): Promise<GachaDetail> {
    return parseGachaDetail(await this.session.requestJson(`/api/lottery/gacha/${encodeURIComponent(String(itemId))}`));
  }

  async gachaDraw(itemId: number, count: number, requestId = newRequestId()): Promise<DrawResult> {
    return parseDrawResult(await this.post("/api/lottery/gacha/draw", { requestId, itemId, count }));
  }

  async buyPack(pack: Pick<LotteryPack, "stockId" | "price" | "currency">, requestId = newRequestId()): Promise<PackResult> {
    const body = record(await this.post("/api/lottery/packs/buy", { requestId, stockId: pack.stockId,
      expectedPrice: pack.price, expectedCurrency: pack.currency }), "礼包");
    return { wallet: wallet(body.wallet), items: items(body.items), purchaseId: int(body.purchaseId, "购买编号") };
  }

  async claimDaily(activity: "treasureHunt" | "gacha"): Promise<DailyResult> {
    const body = record(await this.post("/api/lottery/daily", { activity }), "每日免费");
    return { wallet: wallet(body.wallet), items: items(body.items) };
  }

  /** Names of the items outside the shop catalog, loaded once per api. */
  itemNames(): Promise<Map<string, LotteryItemName>> {
    this.names ??= this.session.requestJson("/api/lottery/items").then(value => {
      const body = record(value, "道具名称");
      const names = new Map<string, LotteryItemName>();
      for (const raw of list(body.items, "道具名称")) {
        const row = record(raw, "道具名称");
        const item: LotteryItemName = { category: int(row.category, "分类"), itemId: int(row.itemId, "编号"),
          name: text(row.name, "名称") };
        if (row.count === true) item.count = true;
        if (typeof row.effect === "string" && row.effect) item.effect = row.effect;
        names.set(`${item.category}:${item.itemId}`, item);
      }
      return names;
    });
    this.names.catch(() => { this.names = undefined; });
    return this.names;
  }
}
