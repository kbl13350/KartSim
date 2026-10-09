import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountProfileSync, fetchAccountProfile, loadAccountProfile, LOCAL_PROFILE_OWNER_KEY,
  migratedPreferences,
} from "./account-profile";
import { AccountServiceError } from "./account-api";
import { memoryStorage, summaryFixture } from "./account-test-fixtures";
import { defaultLocalProfile, LOCAL_PROFILE_KEY, type LocalProfile } from "../ui/local-profile";

function session(responses: Record<string, unknown>, summary = summaryFixture()) {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  return {
    calls,
    summary: () => summary,
    requestJson: async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      const key = `${init?.method ?? "GET"} ${path}`;
      const answer = responses[key];
      if (answer instanceof Error) throw answer;
      if (typeof answer === "function") return (answer as () => unknown)();
      return answer;
    },
  };
}

function anonymousProfile(): LocalProfile {
  const profile = defaultLocalProfile();
  profile.equipment.itemIds[3] = 1200;
  profile.equipment.itemIds[8] = 9;
  profile.initial = "京A88";
  profile.favoriteTracks = [{ themeId: 1, trackId: 2 }];
  profile.favoriteItems = [{ category: 3, itemId: 1200, serial: 0 }];
  profile.myRoom = { environmentId: 3, displayName: "老车库", message: "欢迎" };
  profile.garage = { version: 1, builds: { "1200:0": { engine: 1 } } };
  return profile;
}

const options = (storage: ReturnType<typeof memoryStorage>, local?: LocalProfile) => ({
  storage, profileKey: LOCAL_PROFILE_KEY,
  loadLocal: () => local,
  parse: (serialized: string) => JSON.parse(serialized) as LocalProfile,
  defaultProfile: defaultLocalProfile,
});

test("the account's server profile wins over the browser copy", async () => {
  const remote = defaultLocalProfile();
  remote.initial = "服务器";
  const storage = memoryStorage();
  const result = await loadAccountProfile(session({ "GET /api/account/profile": remote }),
    options(storage, anonymousProfile()));
  assert.equal(result.fromServer, true);
  assert.equal(result.migrated, false);
  assert.equal(result.profile.initial, "服务器");
  assert.equal(JSON.parse(storage.getItem(LOCAL_PROFILE_KEY)!).initial, "服务器");
  assert.equal(storage.getItem(LOCAL_PROFILE_OWNER_KEY), "driver_1");
});

test("a first login migrates preferences only; equipment comes from the inventory", async () => {
  const storage = memoryStorage();
  const local = anonymousProfile();
  const result = await loadAccountProfile(session({
    "GET /api/account/profile": new AccountServiceError("NOT_FOUND", 404) }),
  options(storage, local));
  assert.equal(result.fromServer, false);
  assert.equal(result.migrated, true);
  assert.deepEqual(result.profile.equipment, defaultLocalProfile().equipment);
  assert.equal(result.profile.initial, "京A88");
  assert.deepEqual(result.profile.favoriteTracks, local.favoriteTracks);
  assert.deepEqual(result.profile.favoriteItems, local.favoriteItems);
  assert.deepEqual(result.profile.myRoom, local.myRoom);
  assert.deepEqual(result.profile.garage, local.garage);
  assert.equal(storage.getItem(LOCAL_PROFILE_OWNER_KEY), "driver_1");
});

test("another account's cached profile is never migrated", async () => {
  const storage = memoryStorage({ [LOCAL_PROFILE_OWNER_KEY]: "someone_else" });
  const result = await loadAccountProfile(session({ "GET /api/account/profile": undefined }),
    options(storage, anonymousProfile()));
  assert.equal(result.migrated, false);
  assert.deepEqual(result.profile, defaultLocalProfile());
});

test("an outage right after login keeps this account's own cached copy", async () => {
  const storage = memoryStorage({ [LOCAL_PROFILE_OWNER_KEY]: "driver_1" });
  const cached = anonymousProfile();
  const result = await loadAccountProfile(session({
    "GET /api/account/profile": new AccountServiceError("DATA_SERVICE_UNAVAILABLE") }),
  options(storage, cached));
  assert.equal(result.profile, cached);
  await assert.rejects(loadAccountProfile(session({
    "GET /api/account/profile": new AccountServiceError("DATA_SERVICE_UNAVAILABLE") }),
  options(memoryStorage(), cached)), { message: "DATA_SERVICE_UNAVAILABLE" });
});

test("both the raw document and a {profile} envelope are accepted", async () => {
  const profile = defaultLocalProfile();
  assert.deepEqual(await fetchAccountProfile(session({ "GET /api/account/profile": profile })),
    profile);
  assert.deepEqual(await fetchAccountProfile(session({
    "GET /api/account/profile": { profile, updatedAt: 1 } })), profile);
  assert.equal(await fetchAccountProfile(session({
    "GET /api/account/profile": { profile: null } })), undefined);
});

test("profile writes are ordered, wait for onboarding and repair ITEM_NOT_OWNED", async () => {
  let onboarded = false;
  const repaired: unknown[] = [];
  const order: string[] = [];
  let attempt = 0;
  const writer = session({
    "PUT /api/account/profile": () => {
      attempt++;
      order.push(`put-${attempt}`);
      if (attempt === 2) throw new AccountServiceError("ITEM_NOT_OWNED", 409);
      return {};
    },
  });
  const sync = new AccountProfileSync(writer, {
    canWrite: () => onboarded,
    onItemNotOwned: profile => { repaired.push(profile); },
  });
  sync.enqueue({ initial: "before onboarding" });
  await sync.flush();
  assert.equal(writer.calls.length, 0);
  onboarded = true;
  sync.enqueue({ initial: "a" });
  sync.enqueue({ initial: "b" });
  sync.enqueue({ initial: "c" });
  await sync.flush();
  assert.deepEqual(order, ["put-1", "put-2", "put-3"]);
  assert.deepEqual(writer.calls.map(call => JSON.parse(String(call.init?.body)).initial),
    ["a", "b", "c"]);
  assert.deepEqual(repaired, [{ initial: "b" }]);
});

test("migrated preferences keep the base equipment", () => {
  const base = defaultLocalProfile();
  const merged = migratedPreferences(anonymousProfile(), base);
  assert.equal(merged.equipment, base.equipment);
});

test("a profile write the service could not take is retried with backoff", async () => {
  let attempt = 0;
  const waits: number[] = [];
  const writer = session({
    "PUT /api/account/profile": () => {
      attempt++;
      if (attempt < 3) throw new AccountServiceError("DATA_SERVICE_UNAVAILABLE", 503);
      return {};
    },
  });
  const sync = new AccountProfileSync(writer, {
    canWrite: () => true, retryDelaysMs: [10, 20, 30],
    sleep: async ms => { waits.push(ms); },
  });
  sync.enqueue({ initial: "a" });
  assert.equal(await sync.settled(), true);
  assert.equal(attempt, 3);
  assert.deepEqual(waits, [10, 20]);
});

test("retries stop when the service keeps refusing; settled() reports the failure", async () => {
  const errors: unknown[] = [];
  const writer = session({
    "PUT /api/account/profile": new AccountServiceError("DATA_SERVICE_UNAVAILABLE", 503),
  });
  const sync = new AccountProfileSync(writer, {
    canWrite: () => true, retryDelaysMs: [1, 1], sleep: async () => {},
    onError: error => errors.push(error),
  });
  sync.enqueue({ initial: "a" });
  assert.equal(await sync.settled(), false);
  assert.equal(writer.calls.length, 3);
  assert.equal(errors.length, 1);
  // A rejected document (not a passing outage) is not retried.
  const invalid = session({ "PUT /api/account/profile": new AccountServiceError("INVALID_PROFILE", 400) });
  const strict = new AccountProfileSync(invalid, { canWrite: () => true, sleep: async () => {} });
  strict.enqueue({ initial: "b" });
  assert.equal(await strict.settled(), false);
  assert.equal(invalid.calls.length, 1);
});

test("a newer write replaces a failing one instead of waiting behind its retries", async () => {
  let release!: () => void;
  const slept = new Promise<void>(resolve => { release = resolve; });
  const bodies: string[] = [];
  const writer = session({
    "PUT /api/account/profile": () => {
      const body = JSON.parse(String(writer.calls.at(-1)?.init?.body)).initial as string;
      bodies.push(body);
      if (body === "old") throw new AccountServiceError("DATA_SERVICE_UNAVAILABLE", 503);
      return {};
    },
  });
  const sync = new AccountProfileSync(writer, {
    canWrite: () => true, retryDelaysMs: [5_000], sleep: () => slept,
  });
  sync.enqueue({ initial: "old" });
  await new Promise(resolve => setTimeout(resolve, 0));
  sync.enqueue({ initial: "new" });
  release();
  assert.equal(await sync.settled(), true);
  assert.deepEqual(bodies, ["old", "new"]);
});

test("a server profile without preferences takes this account's cached ones", async () => {
  const storage = memoryStorage({ [LOCAL_PROFILE_OWNER_KEY]: "driver_1" });
  const cached = anonymousProfile();
  // The starter claim stored the equipment only; the first full save never landed.
  const remote = { equipment: { ...defaultLocalProfile().equipment } };
  const result = await loadAccountProfile(session({ "GET /api/account/profile": remote }),
    options(storage, cached));
  assert.equal(result.fromServer, true);
  assert.equal(result.mergedLocal, true);
  assert.deepEqual(result.profile.equipment, remote.equipment);
  assert.deepEqual(result.profile.favoriteTracks, cached.favoriteTracks);
  assert.deepEqual(result.profile.myRoom, cached.myRoom);
  assert.equal(result.profile.initial, "京A88");
  assert.deepEqual(JSON.parse(storage.getItem(LOCAL_PROFILE_KEY)!).favoriteTracks,
    cached.favoriteTracks, "the local copy keeps them too");
  // Preferences the server has are its own, even when they are empty.
  const full = { ...defaultLocalProfile(), favoriteTracks: [] };
  const kept = await loadAccountProfile(session({ "GET /api/account/profile": full }),
    options(memoryStorage({ [LOCAL_PROFILE_OWNER_KEY]: "driver_1" }), cached));
  assert.equal(kept.mergedLocal, undefined);
  assert.deepEqual(kept.profile.favoriteTracks, []);
});

test("another account's or an anonymous cached copy never fills a server profile", async () => {
  for (const owner of ["someone_else", undefined]) {
    const storage = memoryStorage(owner ? { [LOCAL_PROFILE_OWNER_KEY]: owner } : {});
    const result = await loadAccountProfile(session({
      "GET /api/account/profile": { equipment: defaultLocalProfile().equipment } }),
    options(storage, anonymousProfile()));
    assert.equal(result.mergedLocal, undefined, String(owner));
    assert.equal(result.profile.favoriteTracks, undefined);
  }
});

test("an invalid server section falls back alone; the valid sections are kept", async () => {
  const strictParse = (serialized: string) => {
    const value = JSON.parse(serialized) as LocalProfile;
    if (value.garage !== undefined && (value.garage as { version?: unknown }).version !== 1)
      throw new Error("车库改装无效");
    if (!Array.isArray(value.favoriteTracks)) throw new Error("收藏无效");
    return value;
  };
  const remote = { ...anonymousProfile(), garage: { version: 99 } };
  const storage = memoryStorage();
  const result = await loadAccountProfile(session({ "GET /api/account/profile": remote }),
    { ...options(storage), parse: strictParse });
  assert.equal(result.salvaged, true);
  assert.equal(result.profile.garage, undefined, "the invalid garage falls back");
  assert.deepEqual(result.profile.favoriteTracks, remote.favoriteTracks);
  assert.deepEqual(result.profile.myRoom, remote.myRoom);
  assert.deepEqual(result.profile.equipment, remote.equipment);
});
