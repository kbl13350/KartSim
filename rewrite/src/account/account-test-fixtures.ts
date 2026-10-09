/** Test helpers for the account modules: a scripted data service and summaries. */
import type { AccountSummary, InventoryItem } from "./account-session";

export const TEST_ORIGIN = "http://127.0.0.1:8787";
export const TEST_TOKEN = "t".repeat(43);

export function summaryFixture(overrides: {
  nickname?: string; level?: number; exp?: number; onboarded?: boolean;
  wallet?: Partial<AccountSummary["wallet"]>; glove?: string;
} = {}): AccountSummary {
  const level = overrides.level ?? 3;
  return {
    account: { username: "driver_1", nickname: overrides.nickname ?? "车手甲", admin: false,
      createdAt: Date.UTC(2026, 9, 7, 4) },
    progress: { level, exp: overrides.exp ?? 250, levelExp: 148, nextLevelExp: 300,
      glove: overrides.glove ?? "노랑3", gloveName: "黄色手套3", maxLevel: 126 },
    wallet: { coupon: 0, lucci: 10_000, koin: 20, ...overrides.wallet },
    stats: { races: 12, wins: 3, podiums: 7, points: 66 },
    onboarded: overrides.onboarded ?? true,
  };
}

export function item(category: number, itemId: number,
  extra: Partial<InventoryItem> = {}): InventoryItem {
  return { category, itemId, quantity: 1, expiresAt: null, source: "shop", ...extra };
}

export interface ServiceCall {
  method: string;
  path: string;
  authorization?: string;
  body?: unknown;
}

type Handler = (call: ServiceCall) => { status: number; body?: unknown } | Error;

/** A data service answering by "METHOD /path"; unknown routes are 404 NOT_FOUND. */
export class FakeDataService {
  readonly calls: ServiceCall[] = [];
  readonly routes = new Map<string, Handler | Array<Handler>>();

  on(route: string, handler: Handler | { status: number; body?: unknown }): this {
    this.routes.set(route, typeof handler === "function" ? handler : () => handler);
    return this;
  }

  /** Answers in order, repeating the last one. */
  sequence(route: string, answers: Array<{ status: number; body?: unknown } | Error>): this {
    let index = 0;
    this.routes.set(route, () => answers[Math.min(index++, answers.length - 1)]!);
    return this;
  }

  readonly fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const parsed = new URL(url);
    const headers = new Headers(init.headers);
    const body = typeof init.body === "string" && init.body ? JSON.parse(init.body) : undefined;
    const call: ServiceCall = {
      method: init.method ?? "GET", path: parsed.pathname,
      ...(headers.get("Authorization") ? { authorization: headers.get("Authorization")! } : {}),
      ...(body !== undefined ? { body } : {}),
    };
    this.calls.push(call);
    const handler = this.routes.get(`${call.method} ${call.path}`) as Handler | undefined;
    const answer = handler ? handler(call) : { status: 404, body: { error: "NOT_FOUND" } };
    if (answer instanceof Error) throw answer;
    return new Response(answer.body === undefined ? null : JSON.stringify(answer.body),
      { status: answer.status, headers: { "Content-Type": "application/json" } });
  };

  paths(): string[] {
    return this.calls.map(call => `${call.method} ${call.path}`);
  }
}

/** A service with a valid account, inventory and profile routes. */
export function accountService(summary = summaryFixture(),
  inventory: InventoryItem[] = [], serverTime?: number): FakeDataService {
  return new FakeDataService()
    .on("GET /multiplayer/auth/config", { status: 200, body: {
      loginRequired: true, backendOrigin: TEST_ORIGIN, registration: "open", guests: false } })
    .on("GET /api/account", call => call.authorization === `Bearer ${TEST_TOKEN}`
      ? { status: 200, body: summary } : { status: 401, body: { error: "LOGIN_REQUIRED" } })
    .on("GET /api/inventory", { status: 200, body: {
      items: inventory, ...(serverTime !== undefined ? { serverTime } : {}) } });
}

/** In-memory Storage. */
export function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
