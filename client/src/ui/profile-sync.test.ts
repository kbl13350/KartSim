import assert from "node:assert/strict";
import test from "node:test";
import { defaultLocalProfile, LOCAL_PROFILE_KEY } from "./local-profile";
import { LOCAL_OWNER_KEY, LOCAL_PROFILE_SECRET_KEY, ProfileSync,
  profileCredentials } from "./profile-sync";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
}

const owner = "11111111-1111-4111-8111-111111111111";
const secret = "A".repeat(43);

test("profile credentials remain stable in local storage", () => {
  const local = storage();
  const first = profileCredentials(local, () => owner,
    bytes => { bytes.fill(7); return bytes; });
  const second = profileCredentials(local, () => "should-not-run",
    () => { throw new Error("should-not-run"); });
  assert.deepEqual(first, second);
  assert.equal(local.getItem(LOCAL_OWNER_KEY), owner);
  assert.equal(local.getItem(LOCAL_PROFILE_SECRET_KEY), first.secret);
});

test("existing local progress wins and uploads in order using the profile key", async () => {
  const local = storage();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const existing = defaultLocalProfile();
  existing.initial = "local-progress";
  const sync = new ProfileSync({ backendOrigin: "http://127.0.0.1:8787", storage: local,
    ownerId: () => owner, profileSecret: () => secret,
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(existing));
    }) as typeof fetch });
  assert.equal(await sync.load(() => existing, JSON.parse), existing);
  await sync.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.init?.method, "PUT");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)["X-Profile-Key"], secret);
  assert.equal((JSON.parse(String(calls[0]?.init?.body)) as { initial: string }).initial, "local-progress");
});

test("a new browser imports a valid server profile without creating duplicate writes", async () => {
  const local = storage();
  const remote = defaultLocalProfile();
  remote.initial = "server-progress";
  const sync = new ProfileSync({ backendOrigin: "http://127.0.0.1:8787", storage: local,
    ownerId: () => owner, profileSecret: () => secret,
    fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
      assert.equal(init?.method, undefined);
      return new Response(JSON.stringify(remote));
    }) as typeof fetch });
  assert.deepEqual(await sync.load(() => undefined, JSON.parse), remote);
  assert.equal(JSON.parse(local.getItem(LOCAL_PROFILE_KEY)!).initial, "server-progress");
});

test("record documents use the same owner key and a URL-safe stable ID", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const sync = new ProfileSync({ backendOrigin: "http://127.0.0.1:8787", storage: storage(),
    ownerId: () => owner, profileSecret: () => secret,
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ entries: [["track\0speed", { elapsedMs: 1000 }]] }));
    }) as typeof fetch });
  const document = await sync.loadRecord("ghost-summary-index");
  assert.deepEqual(document, { entries: [["track\0speed", { elapsedMs: 1000 }]] });
  sync.enqueueRecord("ghost-summary-index", document!);
  await sync.flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url,
    `http://127.0.0.1:8787/api/records/${owner}/ghost-summary-index`);
  assert.equal((calls[1]?.init?.headers as Record<string, string>)["X-Profile-Key"], secret);
  assert.throws(() => sync.enqueueRecord("track\0speed", {}));
});
