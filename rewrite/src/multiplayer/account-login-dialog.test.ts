import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { AccountLoginDialog, type AccountLoginDependencies } from
  "./account-login-dialog";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class CF {");
const end = release.indexOf("\nasync function yl0(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "login" | "register" | "login-error" | "register-error" |
  "back" | "abort" | "dispose" | "toggle-twice";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  class ElementStub {
    style = { cssText: "", margin: "" };
    children: ElementStub[] = [];
    textContent = "";
    placeholder = "";
    autocomplete = "";
    type = "";
    value = "";
    hidden = false;
    disabled = false;
    maxLength = 0;
    onclick?: () => void;
    onsubmit?: (event: { preventDefault(): void }) => Promise<void>;
    removed = false;
    constructor(readonly tag: string) { events.push(["element", tag]); }
    append(...children: ElementStub[]) {
      events.push(["append", this.tag, children.map(child => child.tag)]);
      this.children.push(...children);
    }
    focus() { events.push(["focus", this.tag]); }
    remove() { this.removed = true; events.push(["remove", this.tag]); }
  }
  const documentStub = { createElement: (tag: string) => new ElementStub(tag) };
  const body = new ElementStub("body");
  const root = { ownerDocument: { body } } as unknown as HTMLElement;
  const controller = new AbortController();
  const requestAccount = async (action: "register" | "login",
    fields: Record<string, string>) => {
    events.push(["request", action, fields]);
    if (variant === "register-error" && action === "register") {
      throw new Error("register failed");
    }
    if (variant === "login-error" && action === "login") {
      throw new Error("login failed");
    }
    return { nickname: "玩家甲" };
  };
  const formatError = (error: unknown) => `显示：${(error as Error).message}`;
  const styleButtons = (...buttons: HTMLButtonElement[]) => {
    events.push(["buttons", buttons.length]);
    for (const button of buttons) button.style.cssText = "button-style";
  };
  const deps = {
    createElement: documentStub.createElement as unknown as (tag: string) => HTMLElement,
    overlayStyle: "overlay-style",
    panelStyle: "panel-style",
    styleButtons,
    requestAccount,
    formatError,
  } satisfies AccountLoginDependencies;
  const Original = new Function("document", "B7", "R7", "G7", "Xo", "C6",
    `${originalClass}\nreturn CF;`)(documentStub, deps.overlayStyle,
      deps.panelStyle, styleButtons, requestAccount, formatError) as unknown as
      new (root: HTMLElement, signal?: AbortSignal) => AccountLoginDialog;
  const dialog = rewritten
    ? new AccountLoginDialog(root, controller.signal, deps)
    : new Original(root, controller.signal);
  const form = (dialog.element as unknown as ElementStub).children[0]!;
  const [, username, nickname, password, invite, errorText, submit, mode, back] =
    form.children;
  const initial = {
    heading: form.children[0]!.textContent,
    placeholders: [username, nickname, password, invite].map(node => node!.placeholder),
    hidden: [nickname!.hidden, invite!.hidden],
    submit: submit!.textContent, mode: mode!.textContent,
    focused: events.some(event => event[0] === "focus"),
  };
  username!.value = "driver";
  nickname!.value = "玩家甲";
  password!.value = "strong-password";
  invite!.value = "INVITE";
  const waiting = dialog.wait();
  if (variant === "register" || variant === "register-error" ||
    variant === "toggle-twice") mode!.onclick?.();
  if (variant === "toggle-twice") mode!.onclick?.();
  if (["login", "register", "login-error", "register-error",
    "toggle-twice"].includes(variant)) {
    await form.onsubmit?.({ preventDefault() { events.push(["prevent-default"]); } });
  }
  const errorBeforeClose = errorText!.textContent;
  if (variant === "back" || variant === "login-error" ||
    variant === "register-error") back!.onclick?.();
  if (variant === "abort") controller.abort();
  if (variant === "dispose") dialog.dispose();
  const account = await waiting;
  dialog.dispose();
  return { events, initial, account, errorBeforeClose,
    state: { disposed: dialog.disposed,
      removed: (dialog.element as unknown as ElementStub).removed,
      nicknameHidden: nickname!.hidden, inviteHidden: invite!.hidden,
      submitText: submit!.textContent, modeText: mode!.textContent,
      submitDisabled: submit!.disabled, resolve: !!dialog.resolve },
  };
}

test("account login, invite registration, failures and cancellation match release", async () => {
  for (const variant of ["login", "register", "login-error",
    "register-error", "back", "abort", "dispose", "toggle-twice"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});
