import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearAccountSession, installAccountSession, multiplayerSessionToken } from "./account-runtime";
import { BrowserAccountSession } from "./browser-session";
import { accountService, TEST_ORIGIN, TEST_TOKEN } from "./account-test-fixtures";

const OTHER_TOKEN = "o".repeat(43);

async function signedIn() {
  const session = new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: accountService().fetch });
  await session.refresh();
  installAccountSession(session);
  return session;
}

test("multiplayer tickets use the signed-in session's token, not another login's stored one", async () => {
  await signedIn();
  try {
    // The shared store holds another account's token (saved by a later login elsewhere).
    assert.equal(multiplayerSessionToken(TEST_ORIGIN, () => OTHER_TOKEN), TEST_TOKEN);
    assert.equal(multiplayerSessionToken(`${TEST_ORIGIN}/`, () => undefined), TEST_TOKEN);
  } finally {
    clearAccountSession();
  }
});

test("a stored token is used for another origin only when it is the session's own", async () => {
  await signedIn();
  try {
    const elsewhere = "http://localhost:8787";
    assert.equal(multiplayerSessionToken(elsewhere, () => TEST_TOKEN), TEST_TOKEN);
    assert.equal(multiplayerSessionToken(elsewhere, () => OTHER_TOKEN), undefined);
    assert.equal(multiplayerSessionToken(elsewhere, () => undefined), undefined);
  } finally {
    clearAccountSession();
  }
});

test("without a usable session no stored token is sent", async () => {
  clearAccountSession();
  assert.equal(multiplayerSessionToken(TEST_ORIGIN, () => OTHER_TOKEN), undefined);
  const session = await signedIn();
  await session.logout();
  try {
    assert.equal(multiplayerSessionToken(TEST_ORIGIN, () => TEST_TOKEN), undefined);
  } finally {
    clearAccountSession();
  }
});

test("the generated lobby asks the active session for its ticket token", () => {
  const generated = readFileSync(new URL("../generated/multiplayer.js", import.meta.url), "utf8");
  assert.match(generated, /sessionToken: url => multiplayerSessionToken\(ay\(url\), xF\)/);
  assert.doesNotMatch(generated, /sessionToken: url => xF\(ay\(url\)\)/);
});
