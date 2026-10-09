/**
 * Startup login gate (ECONOMY.md 7.1): every player signs in before the home
 * lobby. A remembered token is checked first; otherwise the login/register
 * dialog stays up until an account is signed in. There is no guest or offline
 * path: an unreachable data service shows a Chinese error with 重试.
 */
import {
  ACCOUNT_FIELD_LIMITS, AccountServiceError, errorCode, fetchAuthConfig, isLoginRequired,
  loginAccount, registerAccount, validateNickname, validatePassword, validateUsername,
  type AccountCredentials, type FetchLike, type RegistrationMode,
} from "./account-api";
import { showAccountMessage, showAccountStatus, type OverlayDocument } from "./account-dialogs";
import { tokenAccess, type AccountTokenAccess } from "./account-token-store";
import { BrowserAccountSession, openStoredSession } from "./browser-session";
import { AccountLoginDialog, type AccountLoginOptions } from "../multiplayer/account-login-dialog";
import {
  accountErrorMessages, accountOverlayStyle, accountPanelStyle, formatAccountServiceError,
  styleAccountButtons,
} from "../multiplayer/account-ui-support";
import { multiplayerBackendOrigin } from "../multiplayer/backend-origin";

export interface LoginGateDependencies {
  backendOrigin(): string;
  pageOrigin(): string;
  fetch: FetchLike;
  tokens: AccountTokenAccess;
  /** Show the login/register dialog until it signs an account in. */
  signIn(registration: RegistrationMode, backendOrigin: string): Promise<AccountCredentials>;
  /** Show a blocking error; resolves when the player chooses 重试. */
  retry(message: string): Promise<void>;
  progress?(message: string): { close(): void };
}

/** Chinese text for a failure before an account is signed in. */
export function loginGateErrorMessage(error: unknown): string {
  const code = errorCode(error);
  switch (code) {
    case "DATA_SERVICE_UNAVAILABLE":
      return "无法连接数据服务。请确认数据服务（kart-data）已经启动、网络正常，然后重试。";
    case "BACKEND_ORIGIN_MISMATCH":
      return "游戏页面与数据服务的地址配置不匹配，请联系站点管理员。";
    case "NOT_FOUND":
    case "INVALID_ACCOUNT_SUMMARY":
    case "INVALID_INVENTORY":
      return "数据服务尚未更新到账号版本，请更新服务端后重试。";
    case "RATE_LIMITED":
    case "TOO_MANY_ATTEMPTS":
      return "请求过于频繁，请稍后重试。";
    default:
      return `无法登录：${code && accountErrorMessages[code] ? accountErrorMessages[code]
        : error instanceof Error ? error.message : String(error)}`;
  }
}

/** Resolve with a signed-in, refreshed session. Never resolves without one. */
export async function ensureAccountSession(deps: LoginGateDependencies):
  Promise<BrowserAccountSession> {
  for (;;) {
    let progress = deps.progress?.("正在连接数据服务…");
    try {
      const origin = deps.backendOrigin();
      const config = await fetchAuthConfig(deps.fetch, origin, deps.pageOrigin());
      const options = (token: string) => ({
        backendOrigin: origin, token, fetch: deps.fetch,
        clearToken: (target: string, token: string) => deps.tokens.clear(target, token),
      });
      const stored = deps.tokens.load(origin);
      if (stored) {
        try {
          const session = await openStoredSession(options(stored));
          progress?.close();
          return session;
        } catch (error) {
          if (!isLoginRequired(error)) throw error;
        }
      }
      progress?.close();
      progress = undefined;
      const credentials = await deps.signIn(config.registration, origin);
      deps.tokens.save(origin, credentials.token);
      progress = deps.progress?.("正在读取账号…");
      const session = new BrowserAccountSession(options(credentials.token));
      await session.refresh();
      progress?.close();
      return session;
    } catch (error) {
      progress?.close();
      await deps.retry(loginGateErrorMessage(error));
    }
  }
}

/** Open registration refused the name without a valid code (admin usernames need one). */
export const OPEN_REGISTRATION_INVITE_MESSAGE =
  "该账号名需要有效的邀请码，请点击「有邀请码？」填写后再注册。";

/**
 * Startup dialog settings for a registration mode (open: optional invite
 * behind 有邀请码？, confirm password).
 */
export function startupLoginOptions(registration: RegistrationMode): AccountLoginOptions {
  return {
    heading: "跑跑卡丁车 · 账号登录",
    hint: registration === "closed"
      ? "请使用已有账号登录后进入游戏。"
      : "登录或注册账号后进入游戏，等级、金币和车库都保存在账号中。",
    // Open registration: admin usernames still need an invite (400 INVALID_INVITE).
    invite: registration === "invite" ? "required" : registration === "open" ? "collapsed" : "hidden",
    registrationClosed: registration === "closed",
    confirmPassword: true,
    fieldLimits: ACCOUNT_FIELD_LIMITS,
    registerSignsIn: true,
    allowBack: false,
    validate: (mode, fields) => {
      if (mode === "login") {
        if (!fields.username) return "请输入账号名。";
        if (!fields.password) return "请输入密码。";
        return undefined;
      }
      return validateUsername(fields.username ?? "") ??
        validateNickname(fields.nickname ?? "") ??
        validatePassword(fields.password ?? "") ??
        (registration === "invite" && !fields.invite ? "请输入邀请码。" : undefined);
    },
  };
}

function pageDocument(root: HTMLElement): OverlayDocument {
  return root.ownerDocument as unknown as OverlayDocument;
}

/** The login/register dialog over `root`; resolves once an account signs in. */
export function showStartupLogin(root: HTMLElement, registration: RegistrationMode,
  backendOrigin: string, fetchImpl: FetchLike): Promise<AccountCredentials> {
  const document = root.ownerDocument;
  const dialog = new AccountLoginDialog(root, undefined, {
    createElement: tag => document.createElement(tag),
    overlayStyle: accountOverlayStyle,
    panelStyle: accountPanelStyle,
    styleButtons: (...buttons) => styleAccountButtons(...buttons),
    requestAccount: (action, fields) => action === "register"
      ? registerAccount(fetchImpl, backendOrigin, {
        username: fields.username ?? "", nickname: fields.nickname ?? "",
        password: fields.password ?? "",
        ...(fields.invite ? { invite: fields.invite } : {}),
      })
      : loginAccount(fetchImpl, backendOrigin,
        { username: fields.username ?? "", password: fields.password ?? "" }),
    formatError: error => error instanceof AccountServiceError
      ? (error.code === "INVALID_INVITE" && registration === "open"
        ? OPEN_REGISTRATION_INVITE_MESSAGE
        : accountErrorMessages[error.code] ?? loginGateErrorMessage(error))
      : formatAccountServiceError(error),
  }, startupLoginOptions(registration));
  return dialog.wait().then(value => {
    if (!value) throw new AccountServiceError("ACCOUNT_CANCELLED");
    return value as AccountCredentials;
  });
}

/** The browser wiring: window config origin, fetch, localStorage token and DOM overlays. */
export function browserLoginGateDependencies(root: HTMLElement): LoginGateDependencies {
  const document = pageDocument(root);
  const fetchImpl: FetchLike = (url, init) => fetch(url, init);
  return {
    backendOrigin: () => multiplayerBackendOrigin(window.location.href,
      window.__KART_MULTIPLAYER_CONFIG__),
    pageOrigin: () => window.location.origin,
    fetch: fetchImpl,
    tokens: tokenAccess(),
    signIn: (registration, origin) => showStartupLogin(root, registration, origin, fetchImpl),
    retry: message => showAccountMessage(document, "账号服务", message, "重试"),
    progress: message => showAccountStatus(document, "账号服务", message),
  };
}
