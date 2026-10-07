/** Login and invite registration dialog for the multiplayer account service. */

export interface AccountLoginDependencies {
  createElement(tag: string): HTMLElement;
  overlayStyle: string;
  panelStyle: string;
  styleButtons(...buttons: HTMLButtonElement[]): void;
  requestAccount(action: "register" | "login",
    fields: Record<string, string>): Promise<unknown>;
  formatError(error: unknown): string;
}

export class AccountLoginDialog {
  readonly element: HTMLElement;
  resolve?: (account?: unknown) => void;
  disposed = false;

  constructor(root: HTMLElement, signal: AbortSignal | undefined,
    readonly dependencies: AccountLoginDependencies) {
    const element = dependencies.createElement("div");
    this.element = element;
    element.style.cssText = dependencies.overlayStyle;
    const form = dependencies.createElement("form") as HTMLFormElement;
    form.style.cssText = dependencies.panelStyle;
    const heading = dependencies.createElement("h2");
    heading.textContent = "多人游戏账号";
    heading.style.margin = "0 0 8px";

    const username = dependencies.createElement("input") as HTMLInputElement;
    const nickname = dependencies.createElement("input") as HTMLInputElement;
    const password = dependencies.createElement("input") as HTMLInputElement;
    const invite = dependencies.createElement("input") as HTMLInputElement;
    username.placeholder = "账号名（3–24 位字母、数字或下划线）";
    username.autocomplete = "username";
    nickname.placeholder = "游戏昵称（注册时填写）";
    nickname.hidden = true;
    password.placeholder = "密码（至少 12 位）";
    password.type = "password";
    password.autocomplete = "current-password";
    invite.placeholder = "邀请码";
    invite.hidden = true;
    for (const input of [username, nickname, password, invite]) {
      input.style.cssText = "box-sizing:border-box;width:100%;padding:9px;background:#fff;color:#152333;border:0;font:inherit";
      input.maxLength = 128;
    }

    const errorText = dependencies.createElement("div");
    errorText.style.cssText = "min-height:20px;color:#ffb3a9";
    const submit = dependencies.createElement("button") as HTMLButtonElement;
    submit.type = "submit";
    submit.textContent = "登录";
    const mode = dependencies.createElement("button") as HTMLButtonElement;
    mode.type = "button";
    mode.textContent = "用邀请码注册";
    const back = dependencies.createElement("button") as HTMLButtonElement;
    back.type = "button";
    back.textContent = "返回";
    dependencies.styleButtons(submit, mode, back);

    let registering = false;
    mode.onclick = () => {
      registering = !registering;
      nickname.hidden = invite.hidden = !registering;
      submit.textContent = registering ? "注册并登录" : "登录";
      mode.textContent = registering ? "已有账号，去登录" : "用邀请码注册";
      errorText.textContent = "";
    };
    back.onclick = () => this.finish(undefined);
    form.onsubmit = async event => {
      event.preventDefault();
      submit.disabled = true;
      errorText.textContent = "";
      try {
        if (registering) {
          await dependencies.requestAccount("register", {
            username: username.value, nickname: nickname.value,
            password: password.value, invite: invite.value,
          });
          registering = false;
          nickname.hidden = invite.hidden = true;
          submit.textContent = "登录";
          mode.textContent = "用邀请码注册";
        }
        const account = await dependencies.requestAccount("login", {
          username: username.value, password: password.value,
        });
        this.finish(account);
      } catch (error) {
        errorText.textContent = dependencies.formatError(error);
      } finally {
        submit.disabled = false;
      }
    };
    form.append(heading, username, nickname, password, invite,
      errorText, submit, mode, back);
    element.append(form);
    root.ownerDocument.body.append(element);
    username.focus();
    signal?.addEventListener("abort", () => this.finish(undefined),
      { once: true });
  }

  wait(): Promise<unknown | undefined> {
    return new Promise(resolve => { this.resolve = resolve; });
  }

  finish(account?: unknown): void {
    this.resolve?.(account);
    this.resolve = undefined;
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.element.remove();
    this.resolve?.(undefined);
    this.resolve = undefined;
  }
}
