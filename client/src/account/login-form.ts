import type { AccountLoginOptions } from "../multiplayer/account-login-dialog";

/**
 * The startup login / register form without its look: which fields show,
 * the 有邀请码？ toggle, client checks and the requests. The game-style
 * window (ui/game-login.ts) draws it; the rules are AccountLoginDialog's
 * account mode.
 */

export type LoginField = "username" | "nickname" | "password" | "confirm" | "invite";
export type LoginMode = "login" | "register";

export const LOGIN_FIELD_LABELS: Readonly<Record<LoginField, string>> = {
  username: "账号名", nickname: "游戏昵称", password: "密码", confirm: "确认密码", invite: "邀请码",
};

export interface LoginFormRequests {
  requestAccount(action: LoginMode, fields: Record<string, string>): Promise<unknown>;
  formatError(error: unknown): string;
}

export class LoginForm {
  mode: LoginMode = "login";
  readonly values: Record<LoginField, string> = { username: "", nickname: "", password: "", confirm: "", invite: "" };
  inviteRevealed = false;
  error = "";
  busy = false;

  constructor(readonly options: AccountLoginOptions, readonly requests: LoginFormRequests) {}

  private get inviteMode(): NonNullable<AccountLoginOptions["invite"]> {
    return this.options.invite ?? "required";
  }

  get canRegister(): boolean {
    return !this.options.registrationClosed;
  }

  /** The fields shown in the current mode, in order. */
  fields(): LoginField[] {
    if (this.mode === "login") return ["username", "password"];
    const fields: LoginField[] = ["username", "nickname", "password"];
    if (this.options.confirmPassword) fields.push("confirm");
    if (this.inviteShown()) fields.push("invite");
    return fields;
  }

  inviteShown(): boolean {
    return this.mode === "register" && this.inviteMode !== "hidden" &&
      (this.inviteMode !== "collapsed" || this.inviteRevealed);
  }

  /** Open registration keeps the code behind 有邀请码？ until asked for. */
  inviteToggleShown(): boolean {
    return this.mode === "register" && this.inviteMode === "collapsed" && !this.inviteRevealed;
  }

  maxLength(field: LoginField): number {
    const limits = this.options.fieldLimits;
    if (!limits) return 128;
    return field === "username" ? limits.username : field === "nickname" ? limits.nickname
      : field === "invite" ? 128 : limits.password;
  }

  set(field: LoginField, value: string): void {
    this.values[field] = value;
  }

  toggleMode(): void {
    if (!this.canRegister || this.busy) return;
    this.mode = this.mode === "login" ? "register" : "login";
    this.error = "";
  }

  revealInvite(): void {
    this.inviteRevealed = true;
  }

  /**
   * Checks and sends the form. Resolves with the signed-in account, or
   * undefined with `error` set (the form stays open).
   */
  async submit(): Promise<unknown | undefined> {
    if (this.busy) return undefined;
    this.busy = true;
    this.error = "";
    try {
      if (this.mode === "register") {
        const fields: Record<string, string> = {
          username: this.values.username, nickname: this.values.nickname, password: this.values.password,
        };
        if (this.inviteMode !== "hidden" && (this.inviteMode === "required" || this.values.invite))
          fields.invite = this.values.invite;
        const problem = this.options.confirmPassword && this.values.confirm !== this.values.password
          ? "两次输入的密码不一致。" : this.options.validate?.("register", fields);
        if (problem) {
          this.error = problem;
          return undefined;
        }
        const account = await this.requests.requestAccount("register", fields);
        if (this.options.registerSignsIn) return account;
        this.mode = "login";
      }
      const fields = { username: this.values.username, password: this.values.password };
      const problem = this.options.validate?.("login", fields);
      if (problem) {
        this.error = problem;
        return undefined;
      }
      return await this.requests.requestAccount("login", fields);
    } catch (error) {
      this.error = this.requests.formatError(error);
      return undefined;
    } finally {
      this.busy = false;
    }
  }
}
