/** Multiplayer account API requests and the account entry gate. */

interface AccountResponse {
  ok: boolean;
  json(): Promise<{ account?: unknown; token?: string; error?: string;
    loginRequired?: boolean; backendOrigin?: string | null }>;
}

export interface AccountRequestDependencies {
  authEndpoint(action: string): string;
  authorizationHeaders(): Record<string, string>;
  fetch(url: string, options: Record<string, unknown>): Promise<AccountResponse>;
  backendOrigin(): string;
  clearToken(origin: string): void;
  saveToken(origin: string, token: string): void;
  errorMessages: Record<string, string>;
}

export async function requestMultiplayerAccount(
  dependencies: AccountRequestDependencies, action: string,
  fields?: Record<string, string>): Promise<unknown> {
  const response = await dependencies.fetch(dependencies.authEndpoint(action),
    fields ? {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json",
        ...dependencies.authorizationHeaders() },
      body: JSON.stringify(fields),
    } : { credentials: "same-origin",
      headers: dependencies.authorizationHeaders() });
  const payload = await response.json();
  if (!response.ok || !payload.account) {
    const code = payload.error ?? "账号服务暂不可用";
    if (code === "LOGIN_REQUIRED") {
      dependencies.clearToken(dependencies.backendOrigin());
    }
    throw new Error(code === "LOGIN_REQUIRED" ? code :
      dependencies.errorMessages[code] ?? code);
  }
  if (action === "login") {
    if (!payload.token) {
      throw new Error("联机后端尚未更新到跨域账号版本。");
    }
    dependencies.saveToken(dependencies.backendOrigin(), payload.token);
  }
  return payload.account;
}

export interface AccountEntryDependencies {
  backendOrigin(): string;
  pageUrl(): string;
  pageOrigin(): string;
  endpoint(path: string, pageUrl: string): string;
  fetch(url: string, options: { credentials: "same-origin" }):
    Promise<AccountResponse>;
  loadAccount(): Promise<unknown>;
  chooseAccount(root: unknown, account: unknown,
    signal: AbortSignal | undefined): Promise<unknown>;
  showLogin(root: unknown, signal: AbortSignal | undefined):
    Promise<unknown | undefined>;
}

export async function enterMultiplayerAccount(
  dependencies: AccountEntryDependencies, root: unknown,
  signal?: AbortSignal): Promise<unknown | undefined> {
  const backendOrigin = dependencies.backendOrigin();
  const response = await dependencies.fetch(
    dependencies.endpoint("auth/config", dependencies.pageUrl()),
    { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error("联机后端尚未更新到账号版本。");
  }
  const { loginRequired, backendOrigin: configuredOrigin } = await response.json();
  if (configuredOrigin !== backendOrigin &&
    (backendOrigin !== dependencies.pageOrigin() || configuredOrigin !== null)) {
    throw new Error("联机前后端地址配置不匹配，请联系站点管理员。");
  }
  if (!loginRequired) {
    try {
      return await dependencies.loadAccount();
    } catch (error) {
      if (error instanceof Error && error.message === "LOGIN_REQUIRED") {
        return undefined;
      }
      throw error;
    }
  }
  try {
    const account = await dependencies.loadAccount();
    if (signal?.aborted) throw new Error("ACCOUNT_CANCELLED");
    return await dependencies.chooseAccount(root, account, signal);
  } catch (error) {
    if (signal?.aborted) throw new Error("ACCOUNT_CANCELLED");
    if (error instanceof Error && error.message !== "LOGIN_REQUIRED") {
      throw error;
    }
    const account = await dependencies.showLogin(root, signal);
    if (!account) throw new Error("ACCOUNT_CANCELLED");
    return account;
  }
}

/** The account part of a signed-in data-service session that multiplayer needs. */
export interface MultiplayerAccountSession {
  refresh(): Promise<void>;
  summary(): { account: { nickname: string }; onboarded: boolean } | undefined;
}

/**
 * Multiplayer entry for the startup account (ECONOMY.md 0, 7): every player is
 * already signed in, so no dialog is shown. The session is re-read to check
 * that the token is still valid and the starter kit was claimed; the game node
 * uses the account nickname from the ticket.
 */
export async function multiplayerAccountFromSession(
  session: MultiplayerAccountSession | undefined): Promise<{ nickname: string }> {
  if (!session) throw new Error("LOGIN_REQUIRED");
  await session.refresh();
  const summary = session.summary();
  if (!summary) throw new Error("LOGIN_REQUIRED");
  if (!summary.onboarded) throw new Error("ONBOARDING_REQUIRED");
  return { nickname: summary.account.nickname };
}
