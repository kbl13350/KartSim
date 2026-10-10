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

/**
 * Startup account gate settings (server-go/ECONOMY.md 7.1). Leaving them out
 * keeps the release multiplayer dialog exactly.
 */
export interface AccountLoginOptions {
  heading?: string;
  /**
   * "required": release invite registration; "optional": shown but may be
   * empty; "collapsed": open registration with a 有邀请码？ toggle that reveals
   * an optional code (admin usernames need one); "hidden": no invite at all.
   */
  invite?: "required" | "optional" | "collapsed" | "hidden";
  /** Registration is closed on the service: no register mode at all. */
  registrationClosed?: boolean;
  /** Register asks for the password twice. */
  confirmPassword?: boolean;
  /** Per-field length limits (username 24, nickname 16, password 128). */
  fieldLimits?: { username: number; nickname: number; password: number };
  /** Client checks before sending; returns a message to show instead. */
  validate?(mode: "login" | "register", fields: Record<string, string>): string | undefined;
  /** `register` already signs the account in; no second login request. */
  registerSignsIn?: boolean;
  /** No 返回: the player must sign in (no guest path). */
  allowBack?: boolean;
  /** A line under the heading, e.g. why the account is needed. */
  hint?: string;
}

const inputStyle = "box-sizing:border-box;width:100%;padding:9px;background:#fff;color:#152333;border:0;font:inherit";

export class AccountLoginDialog {
  readonly element: HTMLElement;
  resolve?: (account?: unknown) => void;
  disposed = false;

  constructor(root: HTMLElement, signal: AbortSignal | undefined,
    readonly dependencies: AccountLoginDependencies,
    readonly options?: AccountLoginOptions) {
    const element = dependencies.createElement("div");
    this.element = element;
    element.style.cssText = dependencies.overlayStyle;
    const form = dependencies.createElement("form") as HTMLFormElement;
    form.style.cssText = dependencies.panelStyle;
    const heading = dependencies.createElement("h2");
    heading.textContent = options?.heading ?? "多人游戏账号";
    heading.style.margin = "0 0 8px";

    const accountMode = options !== undefined;
    const inviteMode = options?.invite ?? "required";
    const username = dependencies.createElement("input") as HTMLInputElement;
    const nickname = dependencies.createElement("input") as HTMLInputElement;
    const password = dependencies.createElement("input") as HTMLInputElement;
    const invite = dependencies.createElement("input") as HTMLInputElement;
    // Only the startup gate asks twice; the release dialog has four inputs.
    const confirm = options?.confirmPassword
      ? dependencies.createElement("input") as HTMLInputElement : undefined;
    username.placeholder = "账号名（3–24 位字母、数字或下划线）";
    username.autocomplete = "username";
    nickname.placeholder = accountMode ? "游戏昵称（1–16 字）" : "游戏昵称（注册时填写）";
    nickname.hidden = true;
    password.placeholder = accountMode ? "密码（至少 8 位）" : "密码（至少 12 位）";
    password.type = "password";
    password.autocomplete = "current-password";
    if (confirm) {
      confirm.placeholder = "再次输入密码";
      confirm.type = "password";
      confirm.autocomplete = "new-password";
      confirm.hidden = true;
    }
    invite.placeholder = inviteMode === "optional" || inviteMode === "collapsed"
      ? "邀请码（可不填）" : "邀请码";
    invite.hidden = true;
    // Open registration keeps the code out of the way until it is asked for.
    const inviteToggle = inviteMode === "collapsed"
      ? dependencies.createElement("button") as HTMLButtonElement : undefined;
    let inviteRevealed = false;
    const inputs = [username, nickname, password, ...(confirm ? [confirm] : []), invite];
    for (const input of inputs) {
      input.style.cssText = inputStyle;
      input.maxLength = 128;
    }
    if (options?.fieldLimits) {
      username.maxLength = options.fieldLimits.username;
      nickname.maxLength = options.fieldLimits.nickname;
      password.maxLength = options.fieldLimits.password;
      if (confirm) confirm.maxLength = options.fieldLimits.password;
    }

    const errorText = dependencies.createElement("div");
    errorText.style.cssText = "min-height:20px;color:#ffb3a9";
    const submit = dependencies.createElement("button") as HTMLButtonElement;
    submit.type = "submit";
    submit.textContent = "登录";
    const mode = dependencies.createElement("button") as HTMLButtonElement;
    mode.type = "button";
    const registerLabel = accountMode && inviteMode !== "required" ? "注册新账号" : "用邀请码注册";
    mode.textContent = registerLabel;
    const back = dependencies.createElement("button") as HTMLButtonElement;
    back.type = "button";
    back.textContent = "返回";
    dependencies.styleButtons(submit, mode, back);
    if (inviteToggle) {
      inviteToggle.type = "button";
      inviteToggle.textContent = "有邀请码？";
      inviteToggle.dataset.accountInviteToggle = "";
      inviteToggle.hidden = true;
      inviteToggle.style.cssText = "justify-self:start;padding:0;background:none;border:0;" +
        "color:#9fd0ff;text-decoration:underline;cursor:pointer;font:inherit;font-size:14px";
      inviteToggle.onclick = () => {
        inviteRevealed = true;
        inviteToggle.hidden = true;
        invite.hidden = false;
        invite.focus();
      };
    }
    if (options?.registrationClosed) mode.hidden = true;
    if (options && options.allowBack === false) back.hidden = true;

    let registering = false;
    const showMode = () => {
      nickname.hidden = !registering;
      invite.hidden = !registering || inviteMode === "hidden" ||
        (inviteMode === "collapsed" && !inviteRevealed);
      if (inviteToggle) inviteToggle.hidden = !registering || inviteRevealed;
      if (confirm) confirm.hidden = !registering;
      if (accountMode)
        password.autocomplete = registering ? "new-password" : "current-password";
      submit.textContent = registering ? "注册并登录" : "登录";
      mode.textContent = registering ? "已有账号，去登录" : registerLabel;
    };
    mode.onclick = () => {
      registering = !registering;
      showMode();
      errorText.textContent = "";
    };
    back.onclick = () => this.finish(undefined);
    form.onsubmit = async event => {
      event.preventDefault();
      submit.disabled = true;
      errorText.textContent = "";
      try {
        if (registering) {
          const fields: Record<string, string> = {
            username: username.value, nickname: nickname.value,
            password: password.value,
          };
          if (inviteMode !== "hidden" && (inviteMode === "required" || invite.value))
            fields.invite = invite.value;
          if (accountMode) {
            const problem = confirm && confirm.value !== password.value
              ? "两次输入的密码不一致。" : options.validate?.("register", fields);
            if (problem) {
              errorText.textContent = problem;
              return;
            }
          }
          const account = await dependencies.requestAccount("register", fields);
          if (options?.registerSignsIn) {
            this.finish(account);
            return;
          }
          registering = false;
          nickname.hidden = invite.hidden = true;
          if (inviteToggle) inviteToggle.hidden = true;
          if (confirm) confirm.hidden = true;
          submit.textContent = "登录";
          mode.textContent = registerLabel;
        }
        const fields = { username: username.value, password: password.value };
        const problem = options?.validate?.("login", fields);
        if (problem) {
          errorText.textContent = problem;
          return;
        }
        const account = await dependencies.requestAccount("login", fields);
        this.finish(account);
      } catch (error) {
        errorText.textContent = dependencies.formatError(error);
      } finally {
        submit.disabled = false;
      }
    };
    const hint = options?.hint ? dependencies.createElement("p") : undefined;
    if (hint) {
      hint.textContent = options!.hint!;
      hint.style.cssText = "margin:-4px 0 4px;color:#c9d8ea;font-size:14px";
    }
    form.append(heading, ...(hint ? [hint] : []), username, nickname, password,
      ...(confirm ? [confirm] : []), ...(inviteToggle ? [inviteToggle] : []), invite,
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
