import assert from "node:assert/strict";
import test from "node:test";

import { AccountServiceError, type AccountCredentials, type RegistrationMode } from "./account-api";
import { accountService, summaryFixture, TEST_ORIGIN, TEST_TOKEN } from "./account-test-fixtures";
import {
  ensureAccountSession, loginGateErrorMessage, showStartupLogin, startupLoginOptions,
  type LoginGateDependencies,
} from "./login-gate";
import { FakeDocument, type FakeElement } from "../ui/fake-dom";

function gate(service = accountService(), stored?: string,
  signIn?: (registration: RegistrationMode) => Promise<AccountCredentials>) {
  const events: unknown[] = [];
  const tokens = new Map<string, string>(stored ? [[TEST_ORIGIN, stored]] : []);
  const deps: LoginGateDependencies = {
    backendOrigin: () => TEST_ORIGIN,
    pageOrigin: () => "http://127.0.0.1:8780",
    fetch: service.fetch,
    tokens: {
      load: origin => tokens.get(origin),
      save: (origin, token) => { events.push(["save", token]); tokens.set(origin, token); },
      clear: origin => { events.push(["clear"]); tokens.delete(origin); },
    },
    signIn: async registration => {
      events.push(["signIn", registration]);
      return signIn ? signIn(registration) :
        { account: { username: "driver_1", nickname: "车手甲", admin: false }, token: TEST_TOKEN };
    },
    retry: async message => { events.push(["retry", message]); },
    progress: message => {
      events.push(["progress", message]);
      return { close: () => events.push(["progress.close"]) };
    },
  };
  return { deps, events, tokens, service };
}

test("a remembered valid token signs in without showing the dialog", async () => {
  const { deps, events } = gate(accountService(), TEST_TOKEN);
  const session = await ensureAccountSession(deps);
  assert.equal(session.summary()?.account.username, "driver_1");
  assert.deepEqual(events, [["progress", "正在连接数据服务…"], ["progress.close"]]);
});

test("a refused remembered token is forgotten and the login dialog opens", async () => {
  const { deps, events, tokens } = gate(accountService(), "x".repeat(43));
  const session = await ensureAccountSession(deps);
  assert.equal(session.sessionToken, TEST_TOKEN);
  assert.equal(tokens.get(TEST_ORIGIN), TEST_TOKEN);
  assert.deepEqual(events.filter(event => (event as unknown[])[0] !== "progress" &&
    (event as unknown[])[0] !== "progress.close"),
  [["clear"], ["signIn", "open"], ["save", TEST_TOKEN]]);
});

test("an unreachable data service shows a Chinese error with retry, then continues", async () => {
  let down = true;
  const service = accountService().on("GET /multiplayer/auth/config", () => down
    ? new TypeError("fetch failed")
    : { status: 200, body: { loginRequired: true, backendOrigin: TEST_ORIGIN, registration: "invite" } });
  const { deps, events } = gate(service);
  deps.retry = async message => {
    events.push(["retry", message]);
    down = false;
  };
  const session = await ensureAccountSession(deps);
  assert.ok(session);
  assert.deepEqual(events.find(event => (event as unknown[])[0] === "retry"),
    ["retry", "无法连接数据服务。请确认数据服务（kart-data）已经启动、网络正常，然后重试。"]);
  assert.ok(events.some(event => JSON.stringify(event) === JSON.stringify(["signIn", "invite"])));
});

test("gate errors read in Chinese", () => {
  assert.match(loginGateErrorMessage(new AccountServiceError("BACKEND_ORIGIN_MISMATCH")), /地址配置/);
  assert.match(loginGateErrorMessage(new AccountServiceError("NOT_FOUND", 404)), /尚未更新/);
  assert.equal(loginGateErrorMessage(new AccountServiceError("REGISTRATION_CLOSED", 403)),
    "无法登录：当前服务器已关闭注册，请联系管理员。");
});

test("a banned login shows the end time and reason as text", async () => {
  // 2026-10-11 04:30 UTC is 12:30 in Beijing.
  const until = Date.UTC(2026, 9, 11, 4, 30);
  const banned = new AccountServiceError("ACCOUNT_BANNED", 403, { error: "ACCOUNT_BANNED", until, reason: "外挂" });
  assert.equal(loginGateErrorMessage(banned), "账号已被封禁，解封时间：2026-10-11 12:30（原因：外挂）");

  const document = new FakeDocument();
  const root = { ownerDocument: document } as unknown as HTMLElement;
  const service = accountService().on("POST /multiplayer/auth/login", () => ({ status: 403,
    body: { error: "ACCOUNT_BANNED", until: Date.UTC(2100, 0, 1) - 8 * 3_600_000, reason: "<i>刷分</i>" } }));
  void showStartupLogin(root, "open", TEST_ORIGIN, service.fetch);
  const parts = dialogParts(document);
  parts.username.value = "driver_1";
  parts.password.value = "password1";
  await parts.form.fire("submit");
  assert.equal(parts.errorText.textContent, "账号已被永久封禁（原因：<i>刷分</i>）");
});

test("startup options: open registration collapses the invite and checks fields first", () => {
  const open = startupLoginOptions("open");
  assert.equal(open.invite, "collapsed");
  assert.equal(open.allowBack, false);
  assert.equal(open.registerSignsIn, true);
  assert.deepEqual(open.fieldLimits, { username: 24, nickname: 16, password: 128 });
  assert.equal(open.validate?.("register", { username: "a", nickname: "甲", password: "12345678" }),
    "账号名须为 3–24 位字母、数字或下划线。");
  assert.equal(open.validate?.("register",
    { username: "driver_1", nickname: "甲", password: "1234567" }), "密码至少 8 位。");
  assert.equal(open.validate?.("register",
    { username: "driver_1", nickname: "甲", password: "12345678" }), undefined);
  assert.equal(startupLoginOptions("invite").invite, "required");
  assert.equal(startupLoginOptions("closed").registrationClosed, true);
});

function dialogParts(document: FakeDocument) {
  const overlay = document.body.children.at(-1)!;
  const form = overlay.children[0]!;
  // Open registration adds the 有邀请码？ toggle before the invite input.
  const inviteToggle = (form.children as FakeElement[]).find(child =>
    "accountInviteToggle" in child.dataset);
  const [heading, hint, username, nickname, password, confirm, invite, errorText,
    submit, mode, back] = (form.children as FakeElement[]).filter(child => child !== inviteToggle);
  return { overlay, form, heading, hint, username: username!, nickname: nickname!,
    password: password!, confirm: confirm!, invite: invite!, errorText: errorText!,
    submit: submit!, mode: mode!, back: back!, inviteToggle };
}

test("the startup dialog registers with nickname and confirmed password and signs in directly", async () => {
  const document = new FakeDocument();
  const root = { ownerDocument: document } as unknown as HTMLElement;
  const service = accountService().on("POST /multiplayer/auth/register", call => ({
    status: 200, body: { account: { username: (call.body as { username: string }).username,
      nickname: "车手甲" }, token: TEST_TOKEN },
  }));
  const pending = showStartupLogin(root, "open", TEST_ORIGIN, service.fetch);
  const parts = dialogParts(document);
  assert.equal(parts.heading?.textContent, "跑跑卡丁车 · 账号登录");
  assert.equal(parts.back.hidden, true);
  assert.equal(parts.username.maxLength, 24);
  assert.equal(parts.nickname.maxLength, 16);
  assert.equal(parts.password.maxLength, 128);
  assert.equal(parts.password.placeholder, "密码（至少 8 位）");
  parts.mode.click();
  assert.equal(parts.nickname.hidden, false);
  assert.equal(parts.confirm.hidden, false);
  assert.equal(parts.invite.hidden, true, "open registration collapses the invite code");
  assert.equal(parts.inviteToggle?.hidden, false);
  assert.equal(parts.inviteToggle?.textContent, "有邀请码？");
  assert.equal(parts.password.autocomplete, "new-password");
  parts.username.value = "driver_1";
  parts.nickname.value = "车手甲";
  parts.password.value = "password1";
  parts.confirm.value = "password2";
  await parts.form.fire("submit");
  assert.equal(parts.errorText.textContent, "两次输入的密码不一致。");
  assert.equal(service.calls.length, 0);
  parts.confirm.value = "password1";
  await parts.form.fire("submit");
  const credentials = await pending;
  assert.equal(credentials.token, TEST_TOKEN);
  assert.deepEqual(service.paths(), ["POST /multiplayer/auth/register"]);
  assert.deepEqual(service.calls[0]?.body,
    { username: "driver_1", nickname: "车手甲", password: "password1" });
  assert.equal(parts.overlay.removed, true);
});

test("the startup dialog logs in and shows service errors in Chinese", async () => {
  const document = new FakeDocument();
  const root = { ownerDocument: document } as unknown as HTMLElement;
  let attempts = 0;
  const service = accountService().on("POST /multiplayer/auth/login", () => ++attempts === 1
    ? { status: 401, body: { error: "INVALID_CREDENTIALS" } }
    : { status: 200, body: { account: { username: "driver_1", nickname: "车手甲" }, token: TEST_TOKEN } });
  const pending = showStartupLogin(root, "closed", TEST_ORIGIN, service.fetch);
  const parts = dialogParts(document);
  assert.equal(parts.mode.hidden, true, "closed registration hides 注册");
  parts.username.value = "driver_1";
  parts.password.value = "wrong-password";
  await parts.form.fire("submit");
  assert.equal(parts.errorText.textContent, "账号或密码错误。");
  parts.password.value = "password1";
  await parts.form.fire("submit");
  assert.equal((await pending).account.username, "driver_1");
  assert.equal(summaryFixture().account.username, "driver_1");
});

test("open registration: 有邀请码？ reveals an optional invite that is sent only when filled", async () => {
  const document = new FakeDocument();
  const root = { ownerDocument: document } as unknown as HTMLElement;
  let attempts = 0;
  const service = accountService().on("POST /multiplayer/auth/register", call => {
    attempts++;
    // Admin usernames need an invite even in open registration.
    return (call.body as { invite?: string }).invite
      ? { status: 200, body: { account: { username: "admin", nickname: "管理员" }, token: TEST_TOKEN } }
      : { status: 400, body: { error: "INVALID_INVITE" } };
  });
  const pending = showStartupLogin(root, "open", TEST_ORIGIN, service.fetch);
  const parts = dialogParts(document);
  assert.equal(parts.inviteToggle?.hidden, true, "nothing to show while logging in");
  parts.mode.click();
  assert.equal(parts.inviteToggle?.hidden, false);
  assert.equal(parts.invite.hidden, true);
  parts.username.value = "admin";
  parts.nickname.value = "管理员";
  parts.password.value = parts.confirm.value = "password1";
  await parts.form.fire("submit");
  assert.deepEqual(service.calls[0]?.body,
    { username: "admin", nickname: "管理员", password: "password1" }, "no empty invite is sent");
  assert.equal(parts.errorText.textContent,
    "该账号名需要有效的邀请码，请点击「有邀请码？」填写后再注册。");
  parts.inviteToggle!.click();
  assert.equal(parts.invite.hidden, false);
  assert.equal(parts.inviteToggle!.hidden, true);
  assert.equal(parts.invite.placeholder, "邀请码（可不填）");
  // Back to login and register again: the revealed field stays revealed.
  parts.mode.click();
  assert.equal(parts.invite.hidden, true);
  parts.mode.click();
  assert.equal(parts.invite.hidden, false);
  parts.invite.value = "ADMIN-CODE";
  await parts.form.fire("submit");
  assert.equal((await pending).token, TEST_TOKEN);
  assert.equal(attempts, 2);
  assert.deepEqual(service.calls[1]?.body,
    { username: "admin", nickname: "管理员", password: "password1", invite: "ADMIN-CODE" });
});

test("invite registration keeps its required invite field without a toggle", () => {
  const document = new FakeDocument();
  const root = { ownerDocument: document } as unknown as HTMLElement;
  void showStartupLogin(root, "invite", TEST_ORIGIN, accountService().fetch);
  const parts = dialogParts(document);
  assert.equal(parts.inviteToggle, undefined);
  parts.mode.click();
  assert.equal(parts.invite.hidden, false);
  assert.equal(parts.invite.placeholder, "邀请码");
});
