import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountServiceError, fetchAuthConfig, isLoginRequired, parseAccountSummary, parseInventory,
  registerAccount, validateNickname, validatePassword, validateUsername,
} from "./account-api";
import { currentAccountSession } from "./account-session";
import {
  accountTokenStore, ACCOUNT_REMEMBER_MS, rememberedTokenStorage, tokenAccess,
} from "./account-token-store";
import {
  accountProfileSync, activeBrowserSession, clearAccountSession, installAccountSession,
} from "./account-runtime";
import { BrowserAccountSession, openStoredSession } from "./browser-session";
import {
  accountService, item, memoryStorage, summaryFixture, TEST_ORIGIN, TEST_TOKEN,
} from "./account-test-fixtures";

function session(service = accountService(), now = () => 1_000_000,
  cleared: string[] = []) {
  return new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: service.fetch, now, clearToken: origin => cleared.push(origin) });
}

test("refresh reads the summary and inventory with the Bearer token and notifies", async () => {
  const service = accountService(summaryFixture({ level: 4 }),
    [item(3, 0, { systemKey: "practiceKart", source: "starter" }), item(1, 3)], 1_000_000);
  const account = session(service);
  let notified = 0;
  const unsubscribe = account.subscribe(() => { notified++; });
  await account.refresh();
  assert.equal(notified, 1);
  assert.equal(account.summary()?.progress.level, 4);
  assert.equal(account.inventory().length, 2);
  assert.deepEqual(service.calls.map(call => call.authorization),
    [`Bearer ${TEST_TOKEN}`, `Bearer ${TEST_TOKEN}`]);
  unsubscribe();
  await account.refresh();
  assert.equal(notified, 1);
});

test("owns() matches system karts by key and drops expired rentals on the service clock", async () => {
  // The service clock is 10 s ahead of the browser.
  const service = accountService(summaryFixture(), [
    item(3, 0, { systemKey: "practiceKart" }),
    item(3, 387, { expiresAt: 1_005_000 }),
    item(1, 2),
  ], 1_010_000);
  const account = session(service, () => 1_000_000);
  await account.refresh();
  assert.equal(account.serverNow(), 1_010_000);
  assert.equal(account.owns(3, 0, "practiceKart"), true);
  assert.equal(account.owns(3, 0, "legacyPracticeX"), false);
  assert.equal(account.owns(1, 2), true);
  // 387 expired at 1_005_000 by the service clock even though the browser is earlier.
  assert.equal(account.owns(3, 387), false);
  assert.equal(account.owns(3, 387, undefined, 1_000_000), true);
  assert.equal(account.ownedItem(1, 2)?.source, "shop");
});

test("concurrent refreshes share one read and run once more for late callers", async () => {
  const service = accountService();
  const account = session(service);
  await Promise.all([account.refresh(), account.refresh(), account.refresh()]);
  assert.deepEqual(service.paths(), ["GET /api/account", "GET /api/inventory",
    "GET /api/account", "GET /api/inventory"]);
});

test("a level gained between reads is reported once with the new summary", async () => {
  let level = 3;
  const service = accountService().on("GET /api/account", () =>
    ({ status: 200, body: summaryFixture({ level }) }));
  const account = session(service);
  const changes: Array<[number, number]> = [];
  account.onLevelUp(change => changes.push([change.from, change.to]));
  await account.refresh();
  level = 5;
  await account.refresh();
  await account.refresh();
  assert.deepEqual(changes, [[3, 5]]);
});

test("a refused token expires the session once and forgets it", async () => {
  const service = accountService().on("GET /api/account",
    { status: 401, body: { error: "LOGIN_REQUIRED" } });
  const cleared: string[] = [];
  const account = session(service, undefined, cleared);
  let expired = 0;
  account.onExpired(() => { expired++; });
  await assert.rejects(account.refresh(), (error: unknown) => isLoginRequired(error));
  await assert.rejects(account.refresh());
  assert.equal(account.expired, true);
  assert.equal(expired, 1);
  assert.deepEqual(cleared, [TEST_ORIGIN]);
});

test("authorizedFetch only reaches data-service API paths", async () => {
  const account = session();
  await assert.rejects(account.authorizedFetch("https://evil.example/api/account"));
  await assert.rejects(account.authorizedFetch("/api/../admin"));
  await assert.rejects(account.authorizedFetch("/other"));
  const response = await account.authorizedFetch("/api/account");
  assert.equal(response.status, 200);
});

test("nickname, starter claim and logout use the service and the token store", async () => {
  const service = accountService(summaryFixture({ onboarded: false }))
    .on("POST /multiplayer/auth/nickname", { status: 200, body: { account: {} } })
    .on("POST /api/account/starter", { status: 200, body: {} })
    .on("POST /multiplayer/auth/logout", { status: 204 });
  const cleared: string[] = [];
  const account = session(service, undefined, cleared);
  await account.refresh();
  await account.updateNickname("新名字");
  assert.equal(account.summary()?.account.nickname, "新名字");
  await account.claimStarter({ character: 3, paint: 6, dye: 7 });
  assert.deepEqual(service.calls.find(call => call.path === "/api/account/starter")?.body,
    { character: 3, paint: 6, dye: 7 });
  await account.logout();
  assert.equal(account.isClosed, true);
  assert.deepEqual(cleared, [TEST_ORIGIN]);
  assert.equal(service.calls.at(-1)?.authorization, `Bearer ${TEST_TOKEN}`);
});

test("openStoredSession reports a refused token as LOGIN_REQUIRED and clears it", async () => {
  const cleared: string[] = [];
  await assert.rejects(openStoredSession({ backendOrigin: TEST_ORIGIN, token: "x".repeat(43),
    fetch: accountService().fetch, clearToken: origin => cleared.push(origin) }),
  { message: "LOGIN_REQUIRED" });
  assert.deepEqual(cleared, [TEST_ORIGIN]);
});

test("installing a session makes it current; clearing it removes the profile writer", async () => {
  const account = session();
  await account.refresh();
  installAccountSession(account);
  assert.equal(currentAccountSession(), account);
  assert.equal(activeBrowserSession(), account);
  assert.ok(accountProfileSync());
  clearAccountSession();
  assert.equal(currentAccountSession(), undefined);
  assert.equal(accountProfileSync(), undefined);
});

test("summary and inventory parsing tolerate extra fields and drop malformed rows", () => {
  const summary = parseAccountSummary({ ...summaryFixture(), extra: true,
    progress: { ...summaryFixture().progress, nextLevelExp: null, level: 0 } });
  assert.equal(summary.progress.level, 1);
  assert.equal(summary.progress.nextLevelExp, null);
  assert.throws(() => parseAccountSummary({ account: {} }), AccountServiceError);
  const inventory = parseInventory({ items: [item(1, 2), { category: "x" }, item(3, 0,
    { systemKey: " practiceKart " })], serverTime: 5 });
  assert.equal(inventory.items.length, 2);
  assert.equal(inventory.items[1]?.systemKey, "practiceKart");
  assert.equal(inventory.serverTime, 5);
});

test("auth config must name this data service", async () => {
  const service = accountService().on("GET /multiplayer/auth/config", { status: 200,
    body: { loginRequired: true, backendOrigin: "http://other.example", registration: "invite" } });
  await assert.rejects(fetchAuthConfig(service.fetch, TEST_ORIGIN, "http://127.0.0.1:8780"),
    { message: "BACKEND_ORIGIN_MISMATCH" });
  const sameOrigin = accountService().on("GET /multiplayer/auth/config", { status: 200,
    body: { loginRequired: true, backendOrigin: null, registration: "invite" } });
  const config = await fetchAuthConfig(sameOrigin.fetch, TEST_ORIGIN, TEST_ORIGIN);
  assert.equal(config.registration, "invite");
  const offline = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(fetchAuthConfig(offline, TEST_ORIGIN, TEST_ORIGIN),
    { message: "DATA_SERVICE_UNAVAILABLE" });
});

test("open registration uses the returned token; an older service is followed by login", async () => {
  const fields = { username: "driver_1", nickname: "车手", password: "password1" };
  const open = accountService().on("POST /multiplayer/auth/register",
    { status: 200, body: { account: { username: "driver_1", nickname: "车手" }, token: TEST_TOKEN } });
  assert.equal((await registerAccount(open.fetch, TEST_ORIGIN, fields)).token, TEST_TOKEN);
  assert.deepEqual(open.paths(), ["POST /multiplayer/auth/register"]);
  const older = accountService()
    .on("POST /multiplayer/auth/register", { status: 200, body: { account: {} } })
    .on("POST /multiplayer/auth/login", { status: 200,
      body: { account: { username: "driver_1", nickname: "车手" }, token: TEST_TOKEN } });
  await registerAccount(older.fetch, TEST_ORIGIN, fields);
  assert.deepEqual(older.paths(), ["POST /multiplayer/auth/register", "POST /multiplayer/auth/login"]);
  const closed = accountService().on("POST /multiplayer/auth/register",
    { status: 403, body: { error: "REGISTRATION_CLOSED" } });
  await assert.rejects(registerAccount(closed.fetch, TEST_ORIGIN, fields),
    { message: "REGISTRATION_CLOSED" });
});

test("client field checks follow the service limits", () => {
  assert.equal(validateUsername("ab"), "账号名须为 3–24 位字母、数字或下划线。");
  assert.equal(validateUsername("driver_1"), undefined);
  assert.equal(validateNickname("甲"), undefined);
  assert.ok(validateNickname(" 甲"));
  assert.ok(validateNickname("一二三四五六七八九十一二三四五六七"));
  assert.ok(validateNickname("<b>"));
  assert.equal(validatePassword("1234567"), "密码至少 8 位。");
  assert.equal(validatePassword("12345678"), undefined);
});

test("the shared token store remembers a login for 30 days in localStorage", () => {
  const storage = memoryStorage();
  let now = 1_000;
  const remembered = rememberedTokenStorage(() => storage, () => now);
  const key = `kartsim.multiplayer.session:${TEST_ORIGIN}`;
  remembered.setItem(key, TEST_TOKEN);
  assert.equal(storage.getItem(`kartsim.multiplayer.session-saved:${TEST_ORIGIN}`), "1000");
  now += ACCOUNT_REMEMBER_MS;
  assert.equal(remembered.getItem(key), TEST_TOKEN);
  now += 1;
  assert.equal(remembered.getItem(key), null);
  assert.equal(storage.getItem(key), null);
  // Without storage the in-memory cache keeps the token for this page.
  const access = tokenAccess({ cache: new Map(), storage: () => { throw new Error("blocked"); } });
  access.save(TEST_ORIGIN, TEST_TOKEN);
  assert.equal(access.load(TEST_ORIGIN), TEST_TOKEN);
  access.clear(TEST_ORIGIN);
  assert.equal(access.load(TEST_ORIGIN), undefined);
  assert.ok(accountTokenStore.cache instanceof Map);
});

test("a 401 answered after logout neither clears the next login's token nor asks for a login", async () => {
  let release!: (response: Response) => void;
  const held = new Promise<Response>(resolve => { release = resolve; });
  const cleared: Array<[string, string]> = [];
  let expiredCalls = 0;
  const account = new BrowserAccountSession({
    backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: async (url: string) => url.endsWith("/api/inventory") ? held
      : new Response("{}", { status: 200 }),
    clearToken: (origin, token) => cleared.push([origin, token]),
  });
  account.onExpired(() => { expiredCalls++; });
  const inFlight = account.authorizedFetch("/api/inventory");
  await account.logout();
  assert.deepEqual(cleared, [[TEST_ORIGIN, TEST_TOKEN]]);
  // Another account signs in here; then the old request comes back 401.
  release(new Response(JSON.stringify({ error: "LOGIN_REQUIRED" }), { status: 401 }));
  await inFlight;
  assert.equal(cleared.length, 1, "the closed session leaves the token store alone");
  assert.equal(expiredCalls, 0, "no second login flow");
  assert.equal(account.expired, false);
});

test("an expired session forgets only its own stored token", () => {
  const storage = memoryStorage();
  const store = { cache: new Map<string, string>(), storage: () => storage };
  const tokens = tokenAccess(store);
  const newer = "n".repeat(43);
  tokens.save(TEST_ORIGIN, newer);
  tokens.clear(TEST_ORIGIN, TEST_TOKEN);
  assert.equal(tokens.load(TEST_ORIGIN), newer, "a newer login's token is kept");
  tokens.clear(TEST_ORIGIN, newer);
  assert.equal(tokens.load(TEST_ORIGIN), undefined);
  tokens.save(TEST_ORIGIN, newer);
  tokens.clear(TEST_ORIGIN);
  assert.equal(tokens.load(TEST_ORIGIN), undefined, "without a token the origin is cleared");
});

test("a refused token still expires a live session and clears its own token", async () => {
  const cleared: Array<[string, string]> = [];
  const account = new BrowserAccountSession({
    backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: async () => new Response(JSON.stringify({ error: "LOGIN_REQUIRED" }), { status: 401 }),
    clearToken: (origin, token) => cleared.push([origin, token]),
  });
  let expiredCalls = 0;
  account.onExpired(() => { expiredCalls++; });
  await account.authorizedFetch("/api/account");
  assert.equal(account.expired, true);
  assert.equal(expiredCalls, 1);
  assert.deepEqual(cleared, [[TEST_ORIGIN, TEST_TOKEN]]);
});

test("a login elsewhere (SESSION_REPLACED) expires the session with its reason", async () => {
  const cleared: Array<[string, string]> = [];
  const account = new BrowserAccountSession({
    backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: async () => new Response(JSON.stringify({ error: "SESSION_REPLACED" }), { status: 401 }),
    clearToken: (origin, token) => cleared.push([origin, token]),
  });
  const reasons: string[] = [];
  account.onExpired(reason => { reasons.push(reason); });
  await account.authorizedFetch("/api/account");
  await account.authorizedFetch("/api/inventory");
  assert.equal(account.expired, true);
  assert.deepEqual(reasons, ["replaced"]);
  assert.deepEqual(cleared, [[TEST_ORIGIN, TEST_TOKEN]]);
});
