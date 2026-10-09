/**
 * The signed-in data-service session (ECONOMY.md 7-8): account summary,
 * inventory with server-time expiry, Bearer requests and change listeners.
 */
import {
  AccountServiceError, authEndpoint, isLoginRequired, parseAccountSummary, parseInventory,
  readServiceJson, serviceFetch, type FetchLike,
} from "./account-api";
import type { AccountSession, AccountSummary, InventoryItem } from "./account-session";

export interface LevelChange {
  from: number;
  to: number;
  summary: AccountSummary;
}

export interface BrowserAccountSessionOptions {
  backendOrigin: string;
  token: string;
  fetch: FetchLike;
  /** Client clock in Unix milliseconds. */
  now?: () => number;
  /**
   * Forget the stored token after logout or when the service refuses it.
   * `token` is this session's token: the store keeps a token saved later by
   * another login (a late 401 of a logged-out session must not sign it out).
   */
  clearToken?(origin: string, token: string): void;
}

function itemMatches(item: InventoryItem, category: number, itemId: number,
  systemKey: string | undefined): boolean {
  if (item.category !== category || item.itemId !== itemId) return false;
  // System karts share itemId 0 and differ only by their content key.
  return itemId !== 0 || (item.systemKey ?? "") === (systemKey?.trim() ?? "");
}

export class BrowserAccountSession implements AccountSession {
  readonly backendOrigin: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly clearToken?: (origin: string, token: string) => void;
  private summaryValue?: AccountSummary;
  private items: InventoryItem[] = [];
  /** serverTime − client time when the inventory was read. */
  private clockOffset = 0;
  private readonly listeners = new Set<() => void>();
  private readonly levelListeners = new Set<(change: LevelChange) => void>();
  private readonly expiryListeners = new Set<() => void>();
  private pendingRefresh?: Promise<void>;
  private refreshAgain = false;
  private expiredValue = false;
  private closed = false;

  constructor(options: BrowserAccountSessionOptions) {
    this.backendOrigin = options.backendOrigin;
    this.token = options.token;
    this.fetchImpl = options.fetch;
    this.now = options.now ?? (() => Date.now());
    this.clearToken = options.clearToken;
  }

  /** The Bearer token; multiplayer tickets use it too (account-runtime multiplayerSessionToken). */
  get sessionToken(): string { return this.token; }

  /** The service refused the token; a new login is required. */
  get expired(): boolean { return this.expiredValue; }

  summary(): AccountSummary | undefined { return this.summaryValue; }

  inventory(): readonly InventoryItem[] { return this.items; }

  /** Unix milliseconds on the data service clock. */
  serverNow(): number { return this.now() + this.clockOffset; }

  /** The inventory row of an owned, unexpired item. */
  ownedItem(category: number, itemId: number, systemKey?: string,
    now = this.serverNow()): InventoryItem | undefined {
    return this.items.find(item => itemMatches(item, category, itemId, systemKey) &&
      (item.expiresAt === null || item.expiresAt > now));
  }

  owns(category: number, itemId: number, systemKey?: string, now?: number): boolean {
    return this.ownedItem(category, itemId, systemKey, now) !== undefined;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Called once per level gained between two account reads. */
  onLevelUp(listener: (change: LevelChange) => void): () => void {
    this.levelListeners.add(listener);
    return () => { this.levelListeners.delete(listener); };
  }

  /** Called once when the service refuses the token (LOGIN_REQUIRED). */
  onExpired(listener: () => void): () => void {
    this.expiryListeners.add(listener);
    return () => { this.expiryListeners.delete(listener); };
  }

  async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (!/^\/(api|multiplayer)\//.test(path) || path.includes(".."))
      throw new Error(`数据服务路径无效：${path}`);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    const response = await serviceFetch(this.fetchImpl, this.backendOrigin + path,
      { ...init, headers });
    if (response.status === 401) {
      let code: unknown;
      try { code = (await response.clone().json() as { error?: unknown })?.error; }
      catch { code = undefined; }
      if (code === undefined || code === "LOGIN_REQUIRED") this.expire();
    }
    return response;
  }

  /** GET/POST JSON with the Bearer token, throwing the service error code. */
  async requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    return readServiceJson(await this.authorizedFetch(path,
      { cache: "no-store", ...init, headers }));
  }

  /** Re-read the summary and inventory; concurrent calls share one read and one follow-up. */
  refresh(): Promise<void> {
    if (this.pendingRefresh) {
      this.refreshAgain = true;
      return this.pendingRefresh;
    }
    const run = async (): Promise<void> => {
      try {
        do {
          this.refreshAgain = false;
          const startedAt = this.now();
          const [summary, inventory] = await Promise.all([
            this.requestJson("/api/account"), this.requestJson("/api/inventory"),
          ]);
          const parsedInventory = parseInventory(inventory);
          if (parsedInventory.serverTime !== undefined) {
            // The midpoint of the request is the best local estimate of serverTime.
            this.clockOffset = parsedInventory.serverTime - (startedAt + this.now()) / 2;
          }
          this.items = parsedInventory.items;
          this.applySummary(parseAccountSummary(summary), false);
          this.notify();
        } while (this.refreshAgain && !this.closed);
      } finally {
        this.pendingRefresh = undefined;
      }
    };
    this.pendingRefresh = run();
    return this.pendingRefresh;
  }

  /** Install a summary returned by another call (settle, purchase) and notify. */
  applySummary(summary: AccountSummary, notify = true): void {
    const previous = this.summaryValue;
    this.summaryValue = summary;
    if (previous && previous.account.username === summary.account.username &&
        summary.progress.level > previous.progress.level) {
      const change = { from: previous.progress.level, to: summary.progress.level, summary };
      for (const listener of [...this.levelListeners]) {
        try { listener(change); } catch (error) { console.error(error); }
      }
    }
    if (notify) this.notify();
  }

  /** Replace one inventory row after a purchase without a full refresh. */
  applyInventoryItem(item: InventoryItem): void {
    this.items = [...this.items.filter(existing =>
      !itemMatches(existing, item.category, item.itemId, item.systemKey)), item];
    this.notify();
  }

  async updateNickname(nickname: string): Promise<void> {
    await this.requestJson("/multiplayer/auth/nickname", {
      method: "POST", body: JSON.stringify({ nickname }),
    });
    const summary = this.summaryValue;
    if (summary) {
      this.summaryValue = { ...summary, account: { ...summary.account, nickname } };
      this.notify();
    }
  }

  /** `POST /api/account/starter`; the service grants the kit once and equips it. */
  async claimStarter(choice: { character: number; paint: number; dye: number }): Promise<void> {
    await this.requestJson("/api/account/starter", {
      method: "POST", body: JSON.stringify(choice),
    });
    await this.refresh();
  }

  /** Revoke the token on the service (best effort) and forget it locally. */
  async logout(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await serviceFetch(this.fetchImpl, authEndpoint(this.backendOrigin, "logout"), {
        method: "POST", headers: { Authorization: `Bearer ${this.token}` },
      });
    } catch {
      // The token is forgotten locally either way.
    }
    this.clearToken?.(this.backendOrigin, this.token);
    this.notify();
  }

  get isClosed(): boolean { return this.closed; }

  private expire(): void {
    // A request of a logged-out session may come back 401 after another
    // account signed in; that answer concerns nobody any more.
    if (this.expiredValue || this.closed) return;
    this.expiredValue = true;
    this.clearToken?.(this.backendOrigin, this.token);
    for (const listener of [...this.expiryListeners]) {
      try { listener(); } catch (error) { console.error(error); }
    }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try { listener(); } catch (error) { console.error(error); }
    }
  }
}

/** Check a stored token by reading the account; refused tokens report LOGIN_REQUIRED. */
export async function openStoredSession(options: BrowserAccountSessionOptions):
  Promise<BrowserAccountSession> {
  const session = new BrowserAccountSession(options);
  try {
    await session.refresh();
  } catch (error) {
    if (isLoginRequired(error)) {
      // A 401 already expired the session, which forgot the token.
      if (!session.expired) options.clearToken?.(options.backendOrigin, options.token);
      throw new AccountServiceError("LOGIN_REQUIRED", 401);
    }
    throw error;
  }
  return session;
}
