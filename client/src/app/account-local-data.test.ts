import assert from "node:assert/strict";
import test from "node:test";

import { LOCAL_PROFILE_OWNER_KEY } from "../account/account-profile";
import { clearAccountSession } from "../account/account-runtime";
import {
  accountService, memoryStorage, summaryFixture, TEST_ORIGIN, TEST_TOKEN,
} from "../account/account-test-fixtures";
import { BrowserAccountSession } from "../account/browser-session";
import { CURRENT_SUMMARY_KEY, LEGACY_SUMMARY_KEY } from "../game/ghost-records";
import { LOCAL_PROFILE_KEY, defaultLocalProfile } from "../ui/local-profile";
import { LOCAL_OWNER_KEY, LOCAL_PROFILE_SECRET_KEY } from "../ui/profile-sync";
import {
  claimTimeAttackRecords, clearAccountLocalData, TIME_ATTACK_RECORDS_OWNER_KEY,
} from "./account-local-data";
import { attachAccountSession, logoutAccount, type AccountStartupHost } from "./account-startup";
import { installAccountSession } from "../account/account-runtime";
import { FakeDocument } from "../ui/fake-dom";

const NICKNAME_KEY = "kartsim.local-nickname";

function browserData() {
  const profile = { ...defaultLocalProfile(), myRoom: { environmentId: 16, displayName: "小屋",
    message: "", roomPassword: "secret" } };
  return memoryStorage({
    [LOCAL_PROFILE_KEY]: JSON.stringify(profile),
    [LOCAL_PROFILE_OWNER_KEY]: "driver_1",
    [NICKNAME_KEY]: JSON.stringify("车手甲"),
    [CURRENT_SUMMARY_KEY]: JSON.stringify([["village\u00007\u00000", { elapsedMs: 1 }]]),
    [TIME_ATTACK_RECORDS_OWNER_KEY]: "driver_1",
    "kartrider-web:p3528:game-options-v1": "{}",
    "kartsim.story.v1": "{}",
    "kartsim.touch-layout": "{}",
  });
}

test("logout forgets the account's cached profile (with My Room passwords) and nickname", () => {
  const storage = browserData();
  clearAccountLocalData(storage);
  assert.equal(storage.getItem(LOCAL_PROFILE_KEY), null);
  assert.equal(storage.getItem(LOCAL_PROFILE_OWNER_KEY), null);
  assert.equal(storage.getItem(NICKNAME_KEY), null);
  // Device settings, story progress and the records' owner stay.
  for (const key of ["kartrider-web:p3528:game-options-v1", "kartsim.story.v1",
    "kartsim.touch-layout", CURRENT_SUMMARY_KEY, TIME_ATTACK_RECORDS_OWNER_KEY])
    assert.notEqual(storage.getItem(key), null, key);
});

test("time attack records stay with their account and are cleared for another one", () => {
  const storage = memoryStorage({
    [CURRENT_SUMMARY_KEY]: "[]", [LEGACY_SUMMARY_KEY]: "[]",
    [LOCAL_OWNER_KEY]: "00000000-0000-4000-8000-000000000000",
    [LOCAL_PROFILE_SECRET_KEY]: "s".repeat(43),
  });
  // The first account to sign in on this browser adopts what is there.
  assert.equal(claimTimeAttackRecords(storage, "driver_1"), false);
  assert.equal(storage.getItem(CURRENT_SUMMARY_KEY), "[]");
  assert.equal(storage.getItem(TIME_ATTACK_RECORDS_OWNER_KEY), "driver_1");
  assert.equal(claimTimeAttackRecords(storage, "driver_1"), false);
  assert.equal(storage.getItem(CURRENT_SUMMARY_KEY), "[]");
  // Another account: records and the anonymous mirror identity are cleared.
  assert.equal(claimTimeAttackRecords(storage, "driver_2"), true);
  for (const key of [CURRENT_SUMMARY_KEY, LEGACY_SUMMARY_KEY, LOCAL_OWNER_KEY, LOCAL_PROFILE_SECRET_KEY])
    assert.equal(storage.getItem(key), null, key);
  assert.equal(storage.getItem(TIME_ATTACK_RECORDS_OWNER_KEY), "driver_2");
});

test("signing in as another account drops the records already read at startup", async () => {
  const storage = memoryStorage({
    [CURRENT_SUMMARY_KEY]: "[]", [TIME_ATTACK_RECORDS_OWNER_KEY]: "someone_else",
  });
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true,
    writable: true });
  try {
    const session = new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
      fetch: accountService(summaryFixture()).fetch });
    await session.refresh();
    const summaries = new Map([["village", { elapsedMs: 1 }]]);
    const host = {
      root: { ownerDocument: {} }, hud: { showDebugText() {} }, userProfile: defaultLocalProfile(),
      localNickname: "", session: { vehicleTitle: "" }, toonStageBinding: { retain() {} },
      replayLibrary: { summaries }, enterTimeAttackReady: async () => undefined,
    } as unknown as AccountStartupHost;
    attachAccountSession(host, session);
    assert.equal(summaries.size, 0);
    assert.equal(storage.getItem(CURRENT_SUMMARY_KEY), null);
    assert.equal(storage.getItem(TIME_ATTACK_RECORDS_OWNER_KEY), "driver_1");
    assert.equal(host.localNickname, "车手甲");
  } finally {
    clearAccountSession();
    if (original) Object.defineProperty(globalThis, "localStorage", original);
  }
});

test("logging out clears the account's browser data before the login dialog", async () => {
  const storage = browserData();
  const service = accountService();
  service.on("POST /multiplayer/auth/logout", { status: 200, body: {} });
  const session = new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: service.fetch });
  await session.refresh();
  installAccountSession(session);
  const document = new FakeDocument();
  try {
    // The login dialog that follows stays open; only the logout itself is awaited here.
    void logoutAccount({ ownerDocument: document } as unknown as HTMLElement, storage);
    for (let attempt = 0; attempt < 100 && storage.getItem(LOCAL_PROFILE_KEY) !== null; attempt++)
      await new Promise(resolve => setTimeout(resolve, 1));
    assert.equal(session.isClosed, true);
    assert.equal(storage.getItem(LOCAL_PROFILE_KEY), null);
    assert.equal(storage.getItem(NICKNAME_KEY), null);
    assert.ok(service.paths().includes("POST /multiplayer/auth/logout"));
  } finally {
    clearAccountSession();
  }
});
