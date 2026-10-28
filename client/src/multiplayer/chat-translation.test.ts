import assert from "node:assert/strict";
import test from "node:test";
import { RoomChatTranslations } from "./chat-translation";
const tick = () => new Promise(resolve => setImmediate(resolve));

test("room translation keeps originals while pending and deduplicates repeated snapshots", async () => {
  let resolve!: (text: string) => void;
  let calls = 0, renders = 0;
  const translations = new RoomChatTranslations(() => { calls++; return new Promise(done => { resolve = done; }); });
  translations.sync(["hello", "hello"], "zh-CN", () => renders++);
  translations.sync(["hello"], "zh-CN", () => renders++);
  assert.equal(calls, 1);
  assert.equal(translations.get("hello", "zh-CN"), undefined);
  resolve("你好"); await tick();
  assert.equal(translations.get("hello", "zh-CN"), "你好");
  assert.equal(renders, 1);
});

test("language changes and removed messages discard late translations", async () => {
  const pending: ((text: string) => void)[] = [];
  let renders = 0;
  const translations = new RoomChatTranslations(() => new Promise(done => pending.push(done)));
  translations.sync(["hello"], "zh-CN", () => renders++);
  translations.sync(["hello"], "ko", () => renders++);
  pending[0]!("你好"); await tick();
  assert.equal(renders, 0);
  assert.equal(translations.get("hello", "zh-CN"), undefined);
  pending[1]!("안녕하세요"); await tick();
  assert.equal(renders, 1);
  assert.equal(translations.get("hello", "ko"), "안녕하세요");
  translations.sync([], "ko", () => renders++);
  assert.equal(translations.get("hello", "ko"), undefined);
});

test("translation failure retains original, has bounded retries, and same-language text needs no repaint", async () => {
  let now = 0, calls = 0, renders = 0;
  const translations = new RoomChatTranslations(async text => { if (++calls === 1) throw Error("offline"); return text; }, () => now);
  translations.sync(["hi"], "en", () => renders++); await tick();
  assert.equal(translations.get("hi", "en"), undefined);
  translations.sync(["hi"], "en", () => renders++); await tick();
  assert.equal(calls, 1);
  now = 30001;
  translations.sync(["hi"], "en", () => renders++); await tick();
  assert.equal(calls, 2);
  assert.equal(translations.get("hi", "en"), "hi");
  assert.equal(renders, 0);
  translations.sync(["", "x".repeat(121)], "en", () => renders++);
  assert.equal(calls, 2);
});

test("room presentation translates only others, preserves originals and ignores disposed rooms", async () => {
  const { syncRoomChatTranslations, translatedRoomChat } = await import("./chat-translation");
  const { lobbyRoomNodeState } = await import("./lobby-room-state");
  let renders = 0;
  const calls: string[] = [];
  const host = {
    playerId: "self", visible: true, connected: true, disposed: false, emotions: [],
    room: { id: "room1", hostId: "self", phase: "open", chat: [
      { playerId: "self", name: "Me", text: "my words" },
      { playerId: "other", name: "Other", text: "hello" },
      { playerId: "other", name: "Other", text: "<emotion>" },
    ] }, view: { render() { renders++; } },
  };
  const parse = (text: string) => text === "<emotion>" ? "" : text;
  syncRoomChatTranslations(host, parse, async (text, target) => {
    calls.push(`${target}:${text}`); return "你好";
  });
  await tick();
  assert.deepEqual(calls, ["zh-CN:hello"]);
  assert.equal(translatedRoomChat(host, "hello"), "你好");
  const state = lobbyRoomNodeState(host as any, "chat", {
    nodeName: (node: unknown) => node, decodeChat: (text: string) => ({ text: parse(text) }),
    colors: { ownChat: "own", otherChat: "other" }, gameplayMode: () => "speed",
  } as any);
  assert.deepEqual(state.lines, [
    { text: "Me: my words", color: "own" },
    { text: "Other: hello", color: "other" },
    { text: "[AI] 你好", color: "other" },
  ]);
  let finish!: (text: string) => void;
  host.room.id = "room2";
  syncRoomChatTranslations(host, parse, () => new Promise(resolve => { finish = resolve; }));
  host.disposed = true;
  finish("你好"); await tick();
  assert.equal(renders, 1);
});

test("room history limits concurrent requests and drains queued messages", async () => {
  const pending: (() => void)[] = [];
  let active = 0, peak = 0, count = 0;
  const translations = new RoomChatTranslations(text => {
    count++; peak = Math.max(peak, ++active);
    return new Promise(resolve => pending.push(() => { active--; resolve(text); }));
  });
  const texts = Array.from({ length: 12 }, (_, index) => `message ${index}`);
  translations.sync(texts, "en", () => {});
  assert.equal(count, 3);
  while (pending.length) { pending.shift()!(); await tick(); }
  assert.equal(count, 12);
  assert.equal(peak, 3);
  for (const text of texts) assert.equal(translations.get(text, "en"), text);
});
