import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LobbyRoomController, type LobbyRoomControllerDependencies } from
  "./lobby-room-controller";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class py {");
const end = release.indexOf("\nclass gy {", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

async function observe(rewritten: boolean) {
  const events: unknown[][] = [];
  const body = { id: "body" };
  const nowMs = () => 5000;
  const cancelFrame = (id: number) => events.push(["cancel-frame", id]);
  const toLocalStartAt = (serverAt: number, clock: unknown) => {
    events.push(["local-start", serverAt, clock]);
    return serverAt + 100;
  };
  const room = { phase: "open", chat: [{ sequence: 3 }],
    autoStartAt: undefined as number | undefined };
  const clock = { now: 123 };
  const actions = {
    captureClock() { events.push(["capture-clock"]); return clock; },
    async chat(marker: string) { events.push(["chat", marker]); },
  };
  const library = { id: "library" };
  const services = {
    timing: { nowMs, cancelFrame, toLocalStartAt,
      requestFrame(_callback: () => void) { return 123; } },
    documentBody: () => body,
    construction: {}, lifecycle: {}, track: {}, state: {},
  } as unknown as LobbyRoomControllerDependencies;
  const Original = new Function("performance", "Y3", "cancelAnimationFrame",
    "requestAnimationFrame", "document", `${source}\nreturn py;`)(
      { now: nowMs }, toLocalStartAt, cancelFrame, () => 123, { body },
    ) as new (snapshot: { phase: string; chat: { sequence: number }[];
      autoStartAt?: number }, playerId: string,
      callbacks: { captureClock(): unknown; chat(marker: string): Promise<void> },
      library: unknown) => Record<string, unknown>;
  const instance = rewritten
    ? new LobbyRoomController(room, "self", actions, library, services)
    : new Original(room, "self", actions, library);
  const host = instance as unknown as Record<string, unknown>;
  const keys = Object.keys(host);
  const initial = JSON.parse(JSON.stringify(host, (_key, value: unknown) =>
    typeof value === "function" ? "function"
      : value instanceof Map ? [...value]
        : value instanceof Set ? [...value] : value));
  const view = {
    element: { contains(target: unknown) { return target !== body; },
      hidden: false },
    render() { events.push(["render"]); },
    focus(name: string) { events.push(["focus", name]); },
  };
  host.view = view;
  host.countdown = { reset() { events.push(["reset"]); } };
  room.autoStartAt = 1000;
  (instance as LobbyRoomController).updateCountdown(room);
  const countdown = (instance as LobbyRoomController).countdownState();
  const locked = (instance as LobbyRoomController).countdownLocked;
  (instance as LobbyRoomController).setStartPresentation(true);
  await (instance as LobbyRoomController).sendEmotion({ marker: "happy" });
  const emotionEvent = {
    target: { matches() { return false; } }, code: "Backquote",
    preventDefault() { events.push(["prevent-emotion"]); },
    stopPropagation() { events.push(["stop-emotion"]); },
  };
  (host.onEmotionKey as (event: unknown) => void)(emotionEvent);
  const roomEvent = {
    target: body, key: "Enter", code: "Enter",
    preventDefault() { events.push(["prevent-room"]); },
    stopPropagation() { events.push(["stop-room"]); },
  };
  (host.onRoomKey as (event: unknown) => void)(roomEvent);
  room.phase = "finished";
  host.animation = 9;
  (instance as LobbyRoomController).setStartPresentation(false);
  return { keys, initial, events, countdown, locked,
    final: { animation: host.animation, startPresentation: host.startPresentation,
      emotionWheelOpen: host.emotionWheelOpen } };
}

test("room controller construction, clock, chat and keyboard actions match release", async () => {
  assert.deepEqual(await observe(true), await observe(false));
});
