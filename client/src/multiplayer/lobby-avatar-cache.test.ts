import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LobbyAvatarCache, lobbyAvatarKey, type LobbyMember, type LobbyRoster,
} from "./lobby-avatar-cache";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function Cl0(");
const end = release.indexOf("\nclass Tl0", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);
const cosmeticItemSlots = [2, 3, 70];
const original = new Function("t6", `${source}\nreturn { key: Cl0, Cache: El0 };`)(
  cosmeticItemSlots,
) as {
  key(member: LobbyMember, mode: string): string | undefined;
  Cache: new <Value>(
    build: (member: LobbyMember<string>, team: unknown) => Promise<Value>,
    release: (value: Value) => void,
    changed: () => void,
    failed: (error: unknown) => void,
  ) => LobbyAvatarCache<Value, string>;
};

function member(id: string, kartSerial: number, team = 1): LobbyMember<string> {
  return {
    playerId: id,
    team,
    initial: "X",
    equipment: {
      systemKart: 10,
      systemKartVariant: 2,
      kartSerial,
      valueAt3E: 7,
      exceedType: 1,
      itemIds: { 2: 20, 3: 30, 70: 70 },
    },
  };
}

test("lobby avatar identity uses release equipment fields and team mode", () => {
  for (const value of [member("a", 1), member("a", 2),
    { ...member("a", 1), initial: undefined },
    { ...member("a", 1), team: null },
    { playerId: "a" }]) {
    for (const mode of ["team", "ordinary"]) {
      assert.equal(lobbyAvatarKey(value, mode, cosmeticItemSlots),
        original.key(value, mode));
    }
  }
});

interface Pending {
  resolve(value: { label: string }): void;
  reject(error: Error): void;
}

async function inspect(rewritten: boolean): Promise<unknown> {
  const events: unknown[][] = [];
  const pending: Pending[] = [];
  const build = (value: LobbyMember<string>, team: unknown): Promise<{ label: string }> => {
    events.push(["build", value.playerId, value.equipment?.kartSerial, team]);
    return new Promise((resolve, reject) => { pending.push({ resolve, reject }); });
  };
  const releaseValue = (value: { label: string }) => { events.push(["release", value.label]); };
  const changed = () => { events.push(["changed"]); };
  const failed = (error: unknown) => { events.push(["failed", (error as Error).message]); };
  const cache = rewritten
    ? new LobbyAvatarCache(build, releaseValue, changed, failed, cosmeticItemSlots)
    : new original.Cache(build, releaseValue, changed, failed);
  const roster = (members: LobbyMember<string>[], mode = "ordinary"): LobbyRoster<string> =>
    ({ members, mode });
  const snapshots: unknown[] = [];

  cache.update(roster([member("a", 1), member("b", 2)]));
  cache.update(roster([member("a", 1), member("b", 2)]));
  snapshots.push([cache.get("a"), cache.get("b"), pending.length]);
  pending[0]!.resolve({ label: "a-v1" });
  await Promise.resolve();
  snapshots.push([cache.get("a"), cache.get("b")]);

  cache.update(roster([member("a", 3), member("c", 4)]));
  pending[1]!.reject(new Error("stale failure"));
  pending[2]!.resolve({ label: "a-v2" });
  await Promise.resolve();
  snapshots.push([cache.get("a"), cache.get("b"), cache.get("c")]);

  pending[3]!.reject(new Error("active failure"));
  await Promise.resolve();
  cache.update(roster([member("a", 3), member("c", 4)]));
  snapshots.push([pending.length, cache.get("c")]);

  cache.update(roster([member("a", 3, 2)], "team"));
  cache.dispose();
  pending[4]!.resolve({ label: "late-a" });
  await Promise.resolve();
  snapshots.push([cache.get("a"), cache.disposed, cache.entries.size]);
  cache.dispose();
  return { events, snapshots };
}

test("avatar cache releases replaced and late builds, and reports only active failures", async () => {
  assert.deepEqual(await inspect(true), await inspect(false));
});

test("a synchronous builder failure leaves the same pending key as release", () => {
  function inspectFailure(rewritten: boolean): unknown {
    const cache = rewritten
      ? new LobbyAvatarCache(() => { throw new Error("sync build failed"); },
        () => {}, () => {}, () => {}, cosmeticItemSlots)
      : new original.Cache(() => { throw new Error("sync build failed"); },
        () => {}, () => {}, () => {});
    let error: string | undefined;
    try { cache.update({ mode: "ordinary", members: [member("a", 1)] }); }
    catch (failure) { error = (failure as Error).message; }
    return { error, key: cache.entries.get("a")?.key, value: cache.get("a") };
  }
  assert.deepEqual(inspectFailure(true), inspectFailure(false));
});
