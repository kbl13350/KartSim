/** Account UI styling, endpoint closures and user-facing service errors. */

export const accountOverlayStyle =
  "position:fixed;inset:0;z-index:10000;display:grid;place-items:center;overflow-y:auto;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:#09182bd9;color:#fff;font:16px sans-serif";

export const accountPanelStyle =
  "box-sizing:border-box;width:min(420px,100%);max-height:100%;overflow-y:auto;overscroll-behavior:contain;padding:clamp(14px,4vw,28px);background:#23364c;border:2px solid #5599d5;box-shadow:0 12px 40px #0008;display:grid;gap:12px";

const buttonStyle =
  "padding:9px 14px;background:#e7edf5;color:#152333;border:1px solid #90a5bc;cursor:pointer;font:inherit";

export function styleAccountButtons(...buttons: { style: { cssText: string } }[]):
  void {
  for (const button of buttons) button.style.cssText = buttonStyle;
}

export const accountErrorMessages: Record<string, string> = {
  INVALID_ACCOUNT_FIELDS: "账号名须为 3–24 位字母、数字或下划线；昵称 1–16 字；密码至少 8 位。",
  INVALID_INVITE: "邀请码无效或已被使用。",
  USERNAME_TAKEN: "账号名已被使用。",
  NICKNAME_TAKEN: "昵称已被使用。",
  INVALID_CREDENTIALS: "账号或密码错误。",
  TOO_MANY_ATTEMPTS: "尝试过于频繁，请稍后再试。",
  ACCOUNTS_UNAVAILABLE: "账号服务尚未启用。",
  NOT_FOUND: "联机后端尚未更新到账号版本。",
  // The data service answers 503 when Redis-backed presence is unavailable.
  DATA_SERVICE_UNAVAILABLE: "数据服务暂时不可用，请稍后再试。",
  // Account economy (server-go/ECONOMY.md 6).
  REGISTRATION_CLOSED: "当前服务器已关闭注册，请联系管理员。",
  LOGIN_REQUIRED: "登录已失效，请重新登录。",
  ONBOARDING_REQUIRED: "请先完成新车手注册，领取新手礼包。",
  ITEM_NOT_OWNED: "装备中有未拥有或已过期的物品，已换回默认装备。",
  INSUFFICIENT_FUNDS: "余额不足。",
  ALREADY_OWNED: "已经永久拥有该物品。",
  EXP_REQUIRED: "经验不足，暂时无法购买该物品。",
  OFFER_NOT_FOUND: "该商品已下架，请刷新商店。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  STORAGE_QUOTA_EXCEEDED: "存储空间已满，请清理后再试。",
  INVALID_NICKNAME: "昵称须为 1–16 字，且不能包含尖括号或控制字符。",
  STARTER_ALREADY_CLAIMED: "新手礼包已经领取过了。",
  INVALID_STARTER: "新手礼包只能选择皮蛋或黑妞，以及蓝、绿、青绿、紫色。",
  ACCOUNT_ONLINE: "该账号已在其他地方在线，请先退出另一处登录。",
  PRICE_CHANGED: "价格已变化，请刷新商店后重试。",
  REQUEST_ID_CONFLICT: "请求编号与之前的请求冲突，请重试。",
  // A ban without its end time and reason (accountBanMessage adds them).
  ACCOUNT_BANNED: "账号已被封禁。",
};

/** Bans ending in 2099 or later are permanent (the admin console's 永久 is 2100-01-01). */
const PERMANENT_BAN_FROM = Date.UTC(2099, 0, 1);

/**
 * Unix ms as Beijing "YYYY-MM-DD HH:mm", whatever the browser's time zone,
 * rounded up to the minute so the shown end is never before the real one.
 */
function beijingMinute(ms: number): string {
  const minute = Math.ceil(ms / 60_000) * 60_000;
  return new Date(minute + 8 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
}

/**
 * The text for a banned account (server-go/ADMIN.md 5): "账号已被封禁，解封时间：
 * 2026-10-11 12:00（原因：外挂）" with the end in Beijing time, "账号已被永久封禁"
 * from 2099 on, and without the parts the refusal did not carry. The reason
 * is an admin's free text: callers show the result as text, never as HTML.
 */
export function formatBanMessage(until: unknown, reason: unknown): string {
  const why = typeof reason === "string" && reason.trim() ? `（原因：${reason.trim()}）` : "";
  if (typeof until !== "number" || !Number.isFinite(until) || until <= 0) {
    return why ? `账号已被封禁${why}` : "账号已被封禁。";
  }
  if (until >= PERMANENT_BAN_FROM) return `账号已被永久封禁${why}`;
  return `账号已被封禁，解封时间：${beijingMinute(until)}${why}`;
}

/**
 * The ban text for an ACCOUNT_BANNED refusal, undefined for other errors.
 * The login's AccountServiceError and the game server's error frame both
 * keep the response as `body`, with `until` (Unix ms) and `reason`.
 */
export function accountBanMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const code = (error as { code?: unknown }).code ?? error.message;
  if (code !== "ACCOUNT_BANNED") return undefined;
  const body = (error as { body?: unknown }).body;
  const fields = body && typeof body === "object" ? body as { until?: unknown; reason?: unknown } : {};
  return formatBanMessage(fields.until, fields.reason);
}

export function formatAccountServiceError(error: unknown,
  messages: Record<string, string> = accountErrorMessages): string {
  const banned = accountBanMessage(error);
  if (banned) return banned;
  return error instanceof Error ? messages[error.message] ?? error.message
    : String(error);
}

export function currentMultiplayerOrigin(pageUrl: () => string,
  resolveOrigin: (url: string) => string): string {
  return resolveOrigin(pageUrl());
}

export function multiplayerAccountEndpoint(action: string,
  pageUrl: () => string,
  endpoint: (path: string, url: string) => string): string {
  return endpoint(`auth/${action}`, pageUrl());
}

export function multiplayerAuthHeaders(origin: () => string,
  token: (origin: string) => string | undefined):
  { Authorization: string } | Record<string, never> {
  const sessionToken = token(origin());
  return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
}
