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
  INVALID_ACCOUNT_FIELDS: "账号名须为 3–24 位字母、数字或下划线；昵称 2–16 字；密码至少 12 位。",
  INVALID_INVITE: "邀请码无效或已被使用。",
  USERNAME_TAKEN: "账号名已被使用。",
  NICKNAME_TAKEN: "昵称已被使用。",
  INVALID_CREDENTIALS: "账号或密码错误。",
  TOO_MANY_ATTEMPTS: "尝试过于频繁，请稍后再试。",
  ACCOUNTS_UNAVAILABLE: "账号服务尚未启用。",
  NOT_FOUND: "联机后端尚未更新到账号版本。",
};

export function formatAccountServiceError(error: unknown,
  messages: Record<string, string> = accountErrorMessages): string {
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
