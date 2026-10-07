/** Signed-in account panel, nickname edit and logout flow. */

export interface MultiplayerAccount {
  nickname: string;
  admin?: boolean;
  [key: string]: unknown;
}

export interface AccountChoiceDependencies {
  createElement(tag: string): HTMLElement;
  overlayStyle: string;
  panelStyle: string;
  styleButtons(...buttons: HTMLButtonElement[]): void;
  endpoint(path: string, pageUrl: string): string;
  pageUrl(): string;
  requestAccount(action: "nickname", fields: { nickname: string }):
    Promise<MultiplayerAccount>;
  formatError(error: unknown): string;
  authEndpoint(action: "logout"): string;
  authorizationHeaders(): Record<string, string>;
  fetch(url: string, options: Record<string, unknown>): Promise<unknown>;
  backendOrigin(): string;
  clearToken(origin: string): void;
  showLogin(root: HTMLElement, signal?: AbortSignal):
    Promise<MultiplayerAccount | undefined>;
}

export function chooseSignedInAccount(dependencies: AccountChoiceDependencies,
  root: HTMLElement, initialAccount: MultiplayerAccount,
  signal?: AbortSignal): Promise<MultiplayerAccount> {
  return new Promise((resolve, reject) => {
    let account = initialAccount;
    const overlay = dependencies.createElement("div");
    const panel = dependencies.createElement("div");
    overlay.style.cssText = dependencies.overlayStyle;
    panel.style.cssText = dependencies.panelStyle;
    const heading = dependencies.createElement("h2");
    heading.textContent = `欢迎，${account.nickname}`;
    heading.style.margin = "0";
    const nickname = dependencies.createElement("input") as HTMLInputElement;
    nickname.value = account.nickname;
    nickname.maxLength = 16;
    nickname.style.cssText = "padding:9px;font:inherit;background:#fff;color:#152333";
    const status = dependencies.createElement("div");
    status.style.color = "#ffb3a9";
    const enter = dependencies.createElement("button") as HTMLButtonElement;
    enter.textContent = "进入多人大厅";
    const rename = dependencies.createElement("button") as HTMLButtonElement;
    rename.textContent = "修改昵称";
    const logout = dependencies.createElement("button") as HTMLButtonElement;
    logout.textContent = "退出账号";
    const back = dependencies.createElement("button") as HTMLButtonElement;
    back.textContent = "返回车库/单人游戏";
    dependencies.styleButtons(enter, rename, logout, back);
    const adminLink = dependencies.createElement("a") as HTMLAnchorElement;
    adminLink.href = dependencies.endpoint("admin", dependencies.pageUrl());
    adminLink.target = "_blank";
    adminLink.rel = "noopener";
    adminLink.textContent = "打开邀请码管理后台";
    adminLink.style.color = "#a7d6ff";

    const cleanup = () => {
      overlay.remove();
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("ACCOUNT_CANCELLED"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    enter.onclick = () => {
      cleanup();
      resolve(account);
    };
    back.onclick = onAbort;
    rename.onclick = async () => {
      rename.disabled = true;
      try {
        account = await dependencies.requestAccount("nickname",
          { nickname: nickname.value });
        heading.textContent = `欢迎，${account.nickname}`;
        status.textContent = "昵称已更新";
      } catch (error) {
        status.textContent = dependencies.formatError(error);
      } finally {
        rename.disabled = false;
      }
    };
    logout.onclick = async () => {
      logout.disabled = true;
      try {
        await dependencies.fetch(dependencies.authEndpoint("logout"), {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json",
            ...dependencies.authorizationHeaders() },
          body: "{}",
        });
        dependencies.clearToken(dependencies.backendOrigin());
        cleanup();
        const nextAccount = await dependencies.showLogin(root, signal);
        if (nextAccount) resolve(nextAccount);
        else reject(new Error("ACCOUNT_CANCELLED"));
      } catch (error) {
        status.textContent = dependencies.formatError(error);
        logout.disabled = false;
      }
    };
    panel.append(heading, nickname, status, enter, rename, logout, back);
    if (account.admin) panel.append(adminLink);
    overlay.append(panel);
    root.ownerDocument.body.append(overlay);
  });
}
