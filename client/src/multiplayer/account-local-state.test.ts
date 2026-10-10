import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearLocalRiderNickname, clearMultiplayerSessionToken,
  loadLocalRiderNickname, loadMultiplayerSessionToken,
  saveLocalRiderNickname, saveMultiplayerSessionToken } from
  "./account-local-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const tokenStart = release.indexOf("const cy =");
const tokenEnd = release.indexOf("\nconst jo =", tokenStart);
const nicknameStart = release.indexOf("const hy =");
const nicknameEnd = release.indexOf("\nfunction Ml0(", nicknameStart);
assert.ok(tokenStart >= 0 && tokenEnd > tokenStart &&
  nicknameStart > tokenEnd && nicknameEnd > nicknameStart);

async function observe(rewritten: boolean, storageFails: boolean) {
  const events: unknown[][] = [];
  const disk = new Map<string, string>();
  const memory = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      events.push(["get", key]);
      if (storageFails) throw new Error("storage blocked");
      return disk.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      events.push(["set", key, value]);
      if (storageFails) throw new Error("storage blocked");
      disk.set(key, value);
    },
    removeItem(key: string) {
      events.push(["remove", key]);
      if (storageFails) throw new Error("storage blocked");
      disk.delete(key);
    },
  };
  const originalTokens = new Function("sessionStorage",
    `${release.slice(tokenStart, tokenEnd)}\nreturn { xF, wl0, SF, S6 };`,
  )(storage) as {
    xF(origin: string): string | undefined;
    wl0(origin: string, token: string): void;
    SF(origin: string): void;
    S6: Map<string, string>;
  };
  const originalNickname = new Function("localStorage",
    `${release.slice(nicknameStart, nicknameEnd)}\nreturn { im, EF, bl0 };`,
  )(storage) as {
    im(): string; EF(nickname: string): void; bl0(): void;
  };
  const store = { cache: memory, storage: () => storage };
  const origin = "https://kart.example";
  const validToken = "A".repeat(43);
  const key = `kartsim.multiplayer.session:${origin}`;
  const tokenRead = () => rewritten
    ? loadMultiplayerSessionToken(origin, store)
    : originalTokens.xF(origin);
  const tokenSave = (token: string) => rewritten
    ? saveMultiplayerSessionToken(origin, token, store)
    : originalTokens.wl0(origin, token);
  const tokenClear = () => rewritten
    ? clearMultiplayerSessionToken(origin, store)
    : originalTokens.SF(origin);
  const nicknameRead = () => rewritten
    ? loadLocalRiderNickname(() => storage) : originalNickname.im();
  const nicknameSave = (name: string) => rewritten
    ? saveLocalRiderNickname(name, () => storage) : originalNickname.EF(name);
  const nicknameClear = () => rewritten
    ? clearLocalRiderNickname(() => storage) : originalNickname.bl0();
  const values: unknown[] = [];
  values.push(tokenRead());
  tokenSave(validToken);
  values.push(tokenRead());
  disk.set(key, "bad");
  values.push(tokenRead());
  let invalid: string | undefined;
  try { tokenSave("bad"); } catch (error) { invalid = (error as Error).message; }
  values.push(invalid);
  tokenClear();
  values.push(tokenRead());
  values.push(nicknameRead());
  nicknameSave("车手甲");
  values.push(nicknameRead());
  disk.set("kartsim.local-nickname", "broken JSON");
  values.push(nicknameRead());
  nicknameClear();
  values.push(nicknameRead());
  return { events, values, disk: [...disk],
    cache: [...(rewritten ? memory : originalTokens.S6)] };
}

test("multiplayer session and rider nickname persistence match release", async () => {
  for (const storageFails of [false, true]) {
    assert.deepEqual(await observe(true, storageFails),
      await observe(false, storageFails), `storageFails=${storageFails}`);
  }
});
