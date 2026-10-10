import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chooseSignedInAccount, type AccountChoiceDependencies } from
  "./account-choice-dialog";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function Al0(");
const end = release.indexOf("\nconst hy =", start);
assert.ok(start >= 0 && end > start);
const originalFunction = release.slice(start, end);

type Variant = "enter" | "admin" | "rename" | "rename-error" |
  "logout" | "logout-cancel" | "logout-error" | "back" | "abort";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  class ElementStub {
    style = { cssText: "", margin: "", color: "" };
    children: ElementStub[] = [];
    textContent = "";
    value = "";
    maxLength = 0;
    href = "";
    target = "";
    rel = "";
    disabled = false;
    removed = false;
    onclick?: () => void | Promise<void>;
    constructor(readonly tag: string) { events.push(["element", tag]); }
    append(...children: ElementStub[]) {
      events.push(["append", this.tag, children.map(child => child.tag)]);
      this.children.push(...children);
    }
    remove() { this.removed = true; events.push(["remove", this.tag]); }
  }
  const documentStub = { createElement: (tag: string) => new ElementStub(tag) };
  const body = new ElementStub("body");
  const root = { ownerDocument: { body } } as unknown as HTMLElement;
  const controller = new AbortController();
  const account = { nickname: "玩家甲", admin: variant === "admin" };
  const renamed = { nickname: "玩家乙", admin: false };
  const requestAccount = async (action: "nickname", fields: { nickname: string }) => {
    events.push(["request", action, fields]);
    if (variant === "rename-error") throw new Error("rename failed");
    return renamed;
  };
  const fetchStub = async (url: string, options: Record<string, unknown>) => {
    events.push(["fetch", url, options]);
    if (variant === "logout-error") throw new Error("logout failed");
  };
  const formatError = (error: unknown) => `显示：${(error as Error).message}`;
  const showLogin = async (_root: HTMLElement, signal?: AbortSignal) => {
    events.push(["login-dialog", _root === root, signal === controller.signal]);
    return variant === "logout-cancel" ? undefined : { nickname: "玩家丙" };
  };
  const deps = {
    createElement: documentStub.createElement as unknown as
      (tag: string) => HTMLElement,
    overlayStyle: "overlay-style", panelStyle: "panel-style",
    styleButtons(...buttons: HTMLButtonElement[]) {
      events.push(["buttons", buttons.length]);
    },
    endpoint(path: string, pageUrl: string) {
      events.push(["endpoint", path, pageUrl]);
      return `https://api.example.com/${path}`;
    },
    pageUrl: () => "https://game.example.com/room",
    requestAccount,
    formatError,
    authEndpoint(action: "logout") {
      events.push(["auth-url", action]);
      return "https://api.example.com/auth/logout";
    },
    authorizationHeaders() { events.push(["headers"]);
      return { Authorization: "Bearer token" }; },
    fetch: fetchStub,
    backendOrigin() { events.push(["origin"]); return "https://api.example.com"; },
    clearToken(origin: string) { events.push(["clear-token", origin]); },
    showLogin,
  } satisfies AccountChoiceDependencies;
  const Original = new Function("document", "B7", "R7", "G7", "Ko",
    "window", "Xo", "C6", "fetch", "ly", "nm", "SF", "jo", "CF",
    `${originalFunction}\nreturn Al0;`)(
      documentStub, deps.overlayStyle, deps.panelStyle, deps.styleButtons,
      deps.endpoint, { location: { href: deps.pageUrl() } },
      requestAccount, formatError, fetchStub, deps.authEndpoint,
      deps.authorizationHeaders, deps.clearToken, deps.backendOrigin,
      class { constructor(readonly loginRoot: HTMLElement,
        readonly signal: AbortSignal | undefined) {}
        wait() { return showLogin(this.loginRoot, this.signal); }
      },
    ) as (root: HTMLElement, account: unknown,
      signal: AbortSignal) => Promise<unknown>;
  const pending = rewritten
    ? chooseSignedInAccount(deps, root, account, controller.signal)
    : Original(root, account, controller.signal);
  const settlement = pending.then(value => ({ value }), error =>
    ({ error: (error as Error).message }));
  const overlay = body.children[0]!;
  const panel = overlay.children[0]!;
  const [heading, nickname, status, enter, rename, logout, back] = panel.children;
  const initial = { heading: heading!.textContent, input: nickname!.value,
    links: panel.children.length, adminHref: panel.children[7]?.href };
  if (variant === "rename" || variant === "rename-error") {
    nickname!.value = "玩家乙";
    await rename!.onclick?.();
  }
  if (variant === "logout" || variant === "logout-cancel" ||
    variant === "logout-error") await logout!.onclick?.();
  if (variant === "enter" || variant === "admin" || variant === "rename" ||
    variant === "rename-error" || variant === "logout-error") enter!.onclick?.();
  if (variant === "back") back!.onclick?.();
  if (variant === "abort") controller.abort();
  return { events, initial, settlement: await settlement,
    final: { heading: heading!.textContent, status: status!.textContent,
      renameDisabled: rename!.disabled, logoutDisabled: logout!.disabled,
      removed: overlay.removed } };
}

test("signed-in account choice, rename, logout and abort match release", async () => {
  for (const variant of ["enter", "admin", "rename", "rename-error",
    "logout", "logout-cancel", "logout-error", "back", "abort"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});
