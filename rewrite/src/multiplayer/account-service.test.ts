import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { enterMultiplayerAccount, requestMultiplayerAccount,
  type AccountEntryDependencies, type AccountRequestDependencies } from
  "./account-service";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const requestStart = release.indexOf("async function Xo(");
const requestEnd = release.indexOf("\nclass CF {", requestStart);
const entryStart = release.indexOf("async function yl0(");
const entryEnd = release.indexOf("\nasync function PT(", entryStart);
assert.ok(requestStart >= 0 && requestEnd > requestStart &&
  entryStart >= 0 && entryEnd > entryStart);
const requestSource = release.slice(requestStart, requestEnd);
const entrySource = release.slice(entryStart, entryEnd);

type RequestVariant = "me" | "login" | "register" | "no-account" |
  "not-ok" | "login-required" | "missing-token" | "unmapped-error" |
  "fetch-error" | "json-error";

async function observeRequest(rewritten: boolean, variant: RequestVariant) {
  const events: unknown[][] = [];
  const action = variant === "login" || variant === "missing-token"
    ? "login" : variant === "register" ? "register" : "me";
  const fields = action === "me" ? undefined :
    { username: "driver", password: "secret" };
  const payload = variant === "no-account" ? { error: "INVALID_CREDENTIALS" }
    : variant === "login-required" ? { error: "LOGIN_REQUIRED" }
      : variant === "unmapped-error" ? { error: "UNKNOWN_CODE" }
        : { account: { id: 7 },
          token: variant === "missing-token" ? undefined : "token-value" };
  const fetchStub = async (url: string, options: Record<string, unknown>) => {
    events.push(["fetch", url, options]);
    if (variant === "fetch-error") throw new Error("fetch failed");
    return { ok: variant !== "not-ok",
      async json() { events.push(["json"]);
        if (variant === "json-error") throw new Error("json failed");
        return payload;
      } };
  };
  const deps = {
    authEndpoint(name: string) { events.push(["auth-url", name]);
      return `https://api.example.com/auth/${name}`; },
    authorizationHeaders() { events.push(["headers"]);
      return { Authorization: "Bearer token" }; },
    fetch: fetchStub,
    backendOrigin() { events.push(["origin"]); return "https://api.example.com"; },
    clearToken(origin: string) { events.push(["clear-token", origin]); },
    saveToken(origin: string, token: string) {
      events.push(["save-token", origin, token]);
    },
    errorMessages: { INVALID_CREDENTIALS: "凭据错误" },
  } satisfies AccountRequestDependencies;
  const Original = new Function("fetch", "ly", "nm", "SF", "jo", "wl0", "uy",
    `${requestSource}\nreturn Xo;`)(fetchStub,
      deps.authEndpoint, deps.authorizationHeaders, deps.clearToken,
      deps.backendOrigin, deps.saveToken, deps.errorMessages,
    ) as (action: string, fields?: Record<string, string>) => Promise<unknown>;
  try {
    return { events, value: rewritten
      ? await requestMultiplayerAccount(deps, action, fields)
      : await Original(action, fields) };
  } catch (error) { return { events, error: (error as Error).message }; }
}

test("multiplayer account request, token changes and errors match release", async () => {
  for (const variant of ["me", "login", "register", "no-account", "not-ok",
    "login-required", "missing-token", "unmapped-error", "fetch-error",
    "json-error"] as const) {
    assert.deepEqual(await observeRequest(true, variant),
      await observeRequest(false, variant), variant);
  }
});

type EntryVariant = "guest-account" | "guest-login-required" |
  "guest-error" | "config-error" | "origin-error" | "null-same-origin" |
  "required-account" | "required-login" | "required-login-cancel" |
  "required-account-error" | "required-choose-error" | "aborted";

async function observeEntry(rewritten: boolean, variant: EntryVariant) {
  const events: unknown[][] = [];
  const root = { id: "root" };
  const controller = new AbortController();
  if (variant === "aborted") controller.abort();
  const backend = variant === "null-same-origin"
    ? "https://game.example.com" : "https://api.example.com";
  const config = { loginRequired: !variant.startsWith("guest") &&
    variant !== "null-same-origin",
  backendOrigin: variant === "origin-error" ? "https://wrong.example.com"
    : variant === "null-same-origin" ? null : backend };
  const account = { nickname: "玩家甲" };
  const fetchStub = async (url: string, options: { credentials: "same-origin" }) => {
    events.push(["fetch", url, options]);
    return { ok: variant !== "config-error",
      async json() { events.push(["json"]); return config; } };
  };
  const loadAccount = async () => {
    events.push(["load-account"]);
    if (["guest-login-required", "required-login", "required-login-cancel"]
      .includes(variant)) throw new Error("LOGIN_REQUIRED");
    if (variant === "guest-error" || variant === "required-account-error") {
      throw new Error("account failed");
    }
    return account;
  };
  const chooseAccount = async (_root: unknown, found: unknown,
    _signal: AbortSignal | undefined) => {
    events.push(["choose", _root === root, found === account,
      _signal === controller.signal]);
    if (variant === "required-choose-error") throw new Error("choose failed");
    return { chosen: true };
  };
  const showLogin = async (_root: unknown, _signal: AbortSignal | undefined) => {
    events.push(["login-dialog", _root === root,
      _signal === controller.signal]);
    return variant === "required-login-cancel" ? undefined : { loggedIn: true };
  };
  const deps = {
    backendOrigin() { events.push(["origin"]); return backend; },
    pageUrl() { return "https://game.example.com/room"; },
    pageOrigin() { return "https://game.example.com"; },
    endpoint(path: string, pageUrl: string) {
      events.push(["endpoint", path, pageUrl]);
      return "https://api.example.com/multiplayer/auth/config";
    },
    fetch: fetchStub,
    loadAccount,
    chooseAccount,
    showLogin,
  } satisfies AccountEntryDependencies;
  const Original = new Function("jo", "fetch", "Ko", "window", "Xo", "Al0",
    "CF", `${entrySource}\nreturn yl0;`)(
      deps.backendOrigin, deps.fetch, deps.endpoint,
      { location: { href: "https://game.example.com/room",
        origin: "https://game.example.com" } },
      loadAccount, chooseAccount,
      class { constructor(readonly loginRoot: unknown,
        readonly signal: AbortSignal | undefined) {}
        wait() { return showLogin(this.loginRoot, this.signal); }
      },
    ) as (root: unknown, signal?: AbortSignal) => Promise<unknown>;
  try {
    return { events, value: rewritten
      ? await enterMultiplayerAccount(deps, root, controller.signal)
      : await Original(root, controller.signal) };
  } catch (error) { return { events, error: (error as Error).message }; }
}

test("account gate, guest fallback and cancellation match release", async () => {
  for (const variant of ["guest-account", "guest-login-required", "guest-error",
    "config-error", "origin-error", "null-same-origin", "required-account",
    "required-login", "required-login-cancel", "required-account-error",
    "required-choose-error", "aborted"] as const) {
    assert.deepEqual(await observeEntry(true, variant),
      await observeEntry(false, variant), variant);
  }
});
