import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { accountBanMessage, accountErrorMessages, accountOverlayStyle, accountPanelStyle,
  currentMultiplayerOrigin, formatAccountServiceError, formatBanMessage,
  multiplayerAccountEndpoint, multiplayerAuthHeaders,
  styleAccountButtons } from "./account-ui-support";
import { AccountServiceError } from "../account/account-api";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("const jo =");
const end = release.indexOf("\nfunction vl0(", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

function observe(rewritten: boolean) {
  const events: unknown[][] = [];
  const browser = { location: { href: "https://kart.example/path" } };
  const origin = (url: string) => {
    events.push(["origin", url]);
    return "https://backend.example";
  };
  const endpoint = (path: string, url: string) => {
    events.push(["endpoint", path, url]);
    return `https://backend.example/${path}`;
  };
  let token: string | undefined = "token-123";
  const sessionToken = (value: string) => {
    events.push(["token", value]);
    return token;
  };
  const original = new Function("ay", "Ko", "xF", "window",
    `${source}\nreturn { jo, ly, nm, G7, B7, R7, uy, C6 };`)(
      origin, endpoint, sessionToken, browser,
    ) as {
      jo(): string; ly(action: string): string;
      nm(): { Authorization?: string };
      G7(...buttons: { style: { cssText: string } }[]): void;
      B7: string; R7: string; uy: Record<string, string>;
      C6(error: unknown): string;
    };
  const currentUrl = () => browser.location.href;
  const currentOrigin = () => rewritten
    ? currentMultiplayerOrigin(currentUrl, origin) : original.jo();
  const currentEndpoint = (action: string) => rewritten
    ? multiplayerAccountEndpoint(action, currentUrl, endpoint)
    : original.ly(action);
  const headers = () => rewritten
    ? multiplayerAuthHeaders(currentOrigin, sessionToken)
    : original.nm();
  const buttons = [{ style: { cssText: "" } },
    { style: { cssText: "" } }];
  if (rewritten) styleAccountButtons(...buttons);
  else original.G7(...buttons);
  const values = [
    currentOrigin(), currentEndpoint("me"), headers(),
  ];
  browser.location.href = "https://kart.example/changed";
  token = undefined;
  values.push(currentEndpoint("login"), headers());
  const format = rewritten ? formatAccountServiceError : original.C6;
  for (const error of [new Error("INVALID_CREDENTIALS"),
    new Error("UNKNOWN"), "offline", null]) {
    values.push(format(error));
  }
  return { events, values, buttons,
    overlay: rewritten ? accountOverlayStyle : original.B7,
    panel: rewritten ? accountPanelStyle : original.R7,
    messages: rewritten ? accountErrorMessages : original.uy };
}

/** Codes added by the data service split and the account economy (ECONOMY.md 6). */
const addedCodes = [
  "DATA_SERVICE_UNAVAILABLE", "REGISTRATION_CLOSED", "LOGIN_REQUIRED", "ONBOARDING_REQUIRED",
  "ITEM_NOT_OWNED", "INSUFFICIENT_FUNDS", "ALREADY_OWNED", "EXP_REQUIRED", "OFFER_NOT_FOUND",
  "RATE_LIMITED", "STORAGE_QUOTA_EXCEEDED", "INVALID_NICKNAME", "STARTER_ALREADY_CLAIMED",
  "INVALID_STARTER", "ACCOUNT_ONLINE", "PRICE_CHANGED", "REQUEST_ID_CONFLICT",
  // An admin's ban (server-go/ADMIN.md 5).
  "ACCOUNT_BANNED",
];

test("multiplayer account URL, headers, style and error text match release", () => {
  const rewritten = observe(true);
  const released = observe(false);
  const messages = { ...rewritten.messages };
  for (const code of addedCodes) {
    assert.match(messages[code] ?? "", /[一-鿿]/u, code);
    delete messages[code];
  }
  // Open registration: nicknames are 1–16 characters and passwords at least 8.
  assert.equal(messages.INVALID_ACCOUNT_FIELDS,
    "账号名须为 3–24 位字母、数字或下划线；昵称 1–16 字；密码至少 8 位。");
  messages.INVALID_ACCOUNT_FIELDS = released.messages.INVALID_ACCOUNT_FIELDS!;
  assert.deepEqual({ ...rewritten, messages }, released);
});

test("a banned account sees until when (Beijing time) and why, never the raw code", () => {
  // 2026-10-11 04:30 UTC is 12:30 in Beijing.
  const until = Date.UTC(2026, 9, 11, 4, 30);
  assert.equal(formatBanMessage(until, "外挂"), "账号已被封禁，解封时间：2026-10-11 12:30（原因：外挂）");
  assert.equal(formatBanMessage(until, " "), "账号已被封禁，解封时间：2026-10-11 12:30");
  // Seconds round up: a ban ending at 12:29:10 is shown as ending at 12:30.
  assert.equal(formatBanMessage(until - 50_000, ""), "账号已被封禁，解封时间：2026-10-11 12:30");
  // The admin console's 永久 is 2100-01-01 Beijing time.
  assert.equal(formatBanMessage(Date.UTC(2099, 11, 31, 16), "刷分"), "账号已被永久封禁（原因：刷分）");
  assert.equal(formatBanMessage(undefined, "外挂"), "账号已被封禁（原因：外挂）");
  assert.equal(formatBanMessage("soon", undefined), "账号已被封禁。");

  // The login's 403 body.
  const login = new AccountServiceError("ACCOUNT_BANNED", 403,
    { error: "ACCOUNT_BANNED", until, reason: "<b>外挂</b>" });
  assert.equal(accountBanMessage(login), "账号已被封禁，解封时间：2026-10-11 12:30（原因：<b>外挂</b>）");
  assert.equal(formatAccountServiceError(login), accountBanMessage(login));
  // A game server error frame kept as the error's body (hello).
  const hello = Object.assign(new Error("ACCOUNT_BANNED"),
    { body: { type: "error", code: "ACCOUNT_BANNED", until, reason: "外挂" } });
  assert.equal(formatAccountServiceError(hello), "账号已被封禁，解封时间：2026-10-11 12:30（原因：外挂）");
  // Without the fields (an older game server) the code still reads as text.
  assert.equal(formatAccountServiceError(new Error("ACCOUNT_BANNED")), "账号已被封禁。");
  assert.equal(accountBanMessage(new Error("ACCOUNT_ONLINE")), undefined);
  assert.equal(accountBanMessage("ACCOUNT_BANNED"), undefined);
});
