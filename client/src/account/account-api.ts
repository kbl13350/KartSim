/**
 * Data-service account requests (server-go/ECONOMY.md section 6): open
 * registration, login, the account summary, inventory and validation of the
 * server's JSON. Every failure becomes an AccountServiceError whose message is
 * the service error code, so callers can map codes to Chinese text.
 */
import type { AccountSummary, Currency, InventoryItem } from "./account-session";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** A data-service failure; `message` is the error code (or a Chinese message). */
export class AccountServiceError extends Error {
  constructor(readonly code: string, readonly status = 0, readonly body?: unknown) {
    super(code);
    this.name = "AccountServiceError";
  }
}

export const DATA_SERVICE_UNAVAILABLE = "DATA_SERVICE_UNAVAILABLE";

export function errorCode(error: unknown): string | undefined {
  if (error instanceof AccountServiceError) return error.code;
  return error instanceof Error ? error.message : undefined;
}

/** True for failures that a fresh login fixes (expired, revoked or missing token). */
export function isLoginRequired(error: unknown): boolean {
  return error instanceof AccountServiceError
    ? error.code === "LOGIN_REQUIRED" || (error.status === 401 && error.code !== "INVALID_CREDENTIALS")
    : error instanceof Error && error.message === "LOGIN_REQUIRED";
}

/** Read the JSON body (or nothing) and throw the service error code on failure. */
export async function readServiceJson(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    const code = body && typeof body === "object" &&
      typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : response.status === 401 ? "LOGIN_REQUIRED"
        : response.status === 404 ? "NOT_FOUND"
          : response.status === 429 ? "RATE_LIMITED"
            : response.status >= 500 ? DATA_SERVICE_UNAVAILABLE : `HTTP_${response.status}`;
    throw new AccountServiceError(code, response.status, body);
  }
  return body;
}

/** fetch() that reports an unreachable data service with its own code. */
export async function serviceFetch(fetchImpl: FetchLike, url: string,
  init?: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new AccountServiceError(DATA_SERVICE_UNAVAILABLE, 0, error);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function count(value: unknown): number {
  return Math.max(0, Math.floor(finiteNumber(value)));
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Validate `GET /api/account`; unknown fields are ignored, missing numbers read 0. */
export function parseAccountSummary(value: unknown): AccountSummary {
  if (!record(value) || !record(value.account) || !record(value.progress) ||
      !record(value.wallet)) throw new AccountServiceError("INVALID_ACCOUNT_SUMMARY");
  const account = value.account;
  const progress = value.progress;
  const wallet = value.wallet;
  const stats = record(value.stats) ? value.stats : {};
  if (typeof account.username !== "string" || typeof account.nickname !== "string")
    throw new AccountServiceError("INVALID_ACCOUNT_SUMMARY");
  const level = Math.max(1, Math.floor(finiteNumber(progress.level, 1)));
  const next = progress.nextLevelExp;
  return {
    account: {
      username: account.username, nickname: account.nickname,
      admin: account.admin === true, createdAt: finiteNumber(account.createdAt),
    },
    progress: {
      level, exp: count(progress.exp), levelExp: count(progress.levelExp),
      nextLevelExp: typeof next === "number" && Number.isFinite(next) ? Math.max(0, next) : null,
      glove: text(progress.glove), gloveName: text(progress.gloveName),
      maxLevel: Math.max(level, Math.floor(finiteNumber(progress.maxLevel, level))),
      tryLevel: Math.min(5, Math.max(1, Math.floor(finiteNumber(progress.tryLevel, 1)))),
      license: Math.min(6, count(progress.license)),
      proUntil: count(progress.proUntil),
    },
    wallet: {
      coupon: count(wallet.coupon), lucci: count(wallet.lucci), koin: count(wallet.koin),
    } satisfies Record<Currency, number>,
    stats: {
      races: count(stats.races), wins: count(stats.wins),
      podiums: count(stats.podiums), points: Math.floor(finiteNumber(stats.points)),
    },
    onboarded: value.onboarded === true,
  };
}

function inventoryItem(value: unknown): InventoryItem | undefined {
  if (!record(value)) return undefined;
  const { category, itemId } = value;
  if (typeof category !== "number" || !Number.isInteger(category) || category < 0 ||
      typeof itemId !== "number" || !Number.isInteger(itemId) || itemId < 0) return undefined;
  const expiresAt = value.expiresAt;
  const systemKey = typeof value.systemKey === "string" && value.systemKey.trim()
    ? value.systemKey.trim() : undefined;
  return {
    category, itemId,
    ...(systemKey ? { systemKey } : {}),
    quantity: Math.max(0, Math.floor(finiteNumber(value.quantity, 1))),
    expiresAt: typeof expiresAt === "number" && Number.isFinite(expiresAt) ? expiresAt : null,
    source: text(value.source),
  };
}

/** Validate `GET /api/inventory`; malformed rows are dropped. */
export function parseInventory(value: unknown): { items: InventoryItem[]; serverTime?: number } {
  if (!record(value) || !Array.isArray(value.items))
    throw new AccountServiceError("INVALID_INVENTORY");
  const items = value.items.flatMap(item => {
    const parsed = inventoryItem(item);
    return parsed ? [parsed] : [];
  });
  const serverTime = typeof value.serverTime === "number" && Number.isFinite(value.serverTime)
    ? value.serverTime : undefined;
  return { items, ...(serverTime !== undefined ? { serverTime } : {}) };
}

export type RegistrationMode = "open" | "invite" | "closed";

export interface AuthConfig {
  backendOrigin: string | null;
  loginRequired: boolean;
  registration: RegistrationMode;
  guests: boolean;
}

export function parseAuthConfig(value: unknown): AuthConfig {
  if (!record(value)) throw new AccountServiceError("NOT_FOUND");
  const registration = value.registration === "invite" || value.registration === "closed"
    ? value.registration : "open";
  return {
    backendOrigin: typeof value.backendOrigin === "string" ? value.backendOrigin : null,
    loginRequired: value.loginRequired === true,
    registration,
    guests: value.guests === true,
  };
}

export function authEndpoint(origin: string, action: string): string {
  if (!/^[a-z][a-z-]*$/.test(action)) throw new Error("Invalid account action");
  return `${origin}/multiplayer/auth/${action}`;
}

/** `GET /multiplayer/auth/config`, checking that it names the configured data service. */
export async function fetchAuthConfig(fetchImpl: FetchLike, backendOrigin: string,
  pageOrigin: string, signal?: AbortSignal): Promise<AuthConfig> {
  const response = await serviceFetch(fetchImpl, authEndpoint(backendOrigin, "config"),
    { cache: "no-store", ...(signal ? { signal } : {}) });
  const config = parseAuthConfig(await readServiceJson(response));
  if (config.backendOrigin !== backendOrigin &&
      (backendOrigin !== pageOrigin || config.backendOrigin !== null)) {
    throw new AccountServiceError("BACKEND_ORIGIN_MISMATCH");
  }
  return config;
}

export interface AccountCredentials {
  account: { username: string; nickname: string; admin: boolean };
  token: string;
}

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function parseCredentials(value: unknown): AccountCredentials {
  if (!record(value) || !record(value.account) || typeof value.token !== "string" ||
      !TOKEN.test(value.token)) throw new AccountServiceError("TOKEN_MISSING");
  const account = value.account;
  return {
    account: { username: text(account.username), nickname: text(account.nickname),
      admin: account.admin === true },
    token: value.token,
  };
}

async function postAuth(fetchImpl: FetchLike, backendOrigin: string, action: string,
  fields: Record<string, string>): Promise<unknown> {
  const response = await serviceFetch(fetchImpl, authEndpoint(backendOrigin, action), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return readServiceJson(response);
}

export async function loginAccount(fetchImpl: FetchLike, backendOrigin: string,
  fields: { username: string; password: string }): Promise<AccountCredentials> {
  return parseCredentials(await postAuth(fetchImpl, backendOrigin, "login", fields));
}

/**
 * Open registration signs the new account in directly ({account, token}). An
 * older service that returns only the account is followed by a normal login.
 */
export async function registerAccount(fetchImpl: FetchLike, backendOrigin: string,
  fields: { username: string; nickname: string; password: string; invite?: string }):
  Promise<AccountCredentials> {
  const body = await postAuth(fetchImpl, backendOrigin, "register", fields);
  if (record(body) && typeof body.token === "string") return parseCredentials(body);
  return loginAccount(fetchImpl, backendOrigin,
    { username: fields.username, password: fields.password });
}

/** Client checks matching the data service (ECONOMY.md 6; validate.go). */
export const ACCOUNT_FIELD_LIMITS = { username: 24, nickname: 16, password: 128 } as const;
export const PASSWORD_MIN_LENGTH = 8;

export function validateUsername(value: string): string | undefined {
  return /^[A-Za-z0-9_]{3,24}$/.test(value)
    ? undefined : "账号名须为 3–24 位字母、数字或下划线。";
}

export function validateNickname(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed !== value) return "昵称不能为空，且首尾不能有空格。";
  if ([...value].length > ACCOUNT_FIELD_LIMITS.nickname) return "昵称最多 16 个字。";
  // ISO control characters and angle brackets are refused by the service.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f<>]/.test(value)) return "昵称不能包含控制字符或尖括号。";
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (value.length < PASSWORD_MIN_LENGTH) return `密码至少 ${PASSWORD_MIN_LENGTH} 位。`;
  if (value.length > ACCOUNT_FIELD_LIMITS.password) return "密码最多 128 位。";
  return undefined;
}
