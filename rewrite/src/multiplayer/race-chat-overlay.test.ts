import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RaceChatOverlay, type RaceChatDependencies } from "./race-chat-overlay";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Dv {");
const end = release.indexOf("\nconst es0 =", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type ChatHost = RaceChatOverlay & {
  updateRoom(room: unknown): void;
  append(message: unknown): void;
};

function observe(rewritten: boolean, variant: "room" | "race" |
  "mismatch" | "loading" | "messages" | "dispose" | "controls") {
  const events: unknown[][] = [];
  let now = 1000;
  let timer = 0;
  const win = {
    setTimeout(callback: () => void, delay: number) {
      events.push(["timer", delay, typeof callback]);
      return ++timer;
    },
    clearTimeout(id: number) { events.push(["clear-timer", id]); },
    removeEventListener(type: string, _listener: unknown, capture: boolean) {
      events.push(["remove-window-key", type, capture]);
    },
  };
  const dependencies: RaceChatDependencies = {
    loadFrame: async () => ({ width: 2, height: 2, pixels: [1, 2] }),
    loadEmotions: async () => [],
    loadFontBytes: async () => new Uint8Array(),
    registerFont: async () => "font",
    releaseFont: value => { events.push(["release-font", value]); },
    parseChat: text => ({ text: text.startsWith("#") ? "" : text }),
    nowMs: () => now++,
    setTimer: win.setTimeout,
    clearTimer: win.clearTimeout,
  };
  const originalDeps = {
    Ng: dependencies.parseChat,
    Qr0: 5000,
    kE: "KartSim Multiplayer Race Chat",
    PE: (event: { key: string; code: string }) =>
      event.key === "Enter" || event.code === "Enter",
    LE: (message: { name: string; text: string }) =>
      `${message.name} : ${message.text}`,
    Jr0: (room: { phase: string; race?: { loadedIds: unknown[] };
      members: unknown[] }) => room.phase === "loading" && room.race
      ? `已加载 ${room.race.loadedIds.length}/${room.members.length} 人，等待统一起跑`
      : undefined,
    performance: { now: dependencies.nowMs }, window: win,
    G1: dependencies.releaseFont,
  };
  const Original = new Function(...Object.keys(originalDeps),
    `${originalClass}\nreturn Dv;`)(...Object.values(originalDeps)) as
      new () => ChatHost;
  const host = Object.create(rewritten ? RaceChatOverlay.prototype :
    Original.prototype) as ChatHost;
  const context = {
    font: "", textBaseline: "", strokeStyle: "", lineWidth: 0,
    lineJoin: "", fillStyle: "",
    clearRect(...args: number[]) { events.push(["clear", ...args]); },
    drawImage(_image: unknown, ...args: number[]) {
      events.push(["frame", ...args]);
    },
    strokeText(text: string, ...args: number[]) {
      events.push(["stroke", text, ...args, this.font, this.fillStyle]);
    },
    fillText(text: string, ...args: number[]) {
      events.push(["fill", text, ...args, this.font, this.fillStyle]);
    },
  };
  const canvas = { width: 520, height: 156,
    getContext: () => context };
  const input = { hidden: true, value: "",
    focus() { events.push(["focus-input"]); },
    blur() { events.push(["blur-input"]); },
    removeEventListener(type: string) { events.push(["remove-input-key", type]); },
  };
  const log = { textContent: "", scrollTop: 0, scrollHeight: 3 };
  const element = { hidden: true,
    remove() { events.push(["remove-element"]); } };
  Object.assign(host, {
    connection: { roomId: "room", raceId: "race", playerId: "self" },
    status: () => undefined, frame: {}, font: "font", emotions: [],
    dependencies, element, log, canvas, input,
    off: () => { events.push(["unsubscribe"]); },
    allowed: false, shown: false, sending: false, disposed: false,
    messages: new Map(), hideTimer: undefined, roomChannel: false,
    loadingLine: undefined,
    onWindowKeyDown: () => undefined,
    onInputKeyDown: () => undefined,
  });
  if (variant === "room" || variant === "race" || variant === "loading" ||
    variant === "mismatch") {
    const open = variant === "room";
    const room = {
      roomId: variant === "mismatch" ? "other" : "room",
      phase: open ? "open" : "loading", members: [1, 2],
      chat: [{ sequence: 3, playerId: "self", name: "我", text: "hello" }],
      race: { raceId: "race", loadedIds: [1],
        chat: [{ sequence: 4, playerId: "other", name: "客", text: "race" }] },
    };
    host.updateRoom(room);
    host.updateRoom(room);
  } else if (variant === "messages") {
    for (let index = 1; index <= 35; index++) host.append({ sequence: index,
      playerId: index % 2 ? "self" : "other", name: `P${index}`,
      text: index % 10 ? `message ${index}` : "#hidden" });
  } else if (variant === "controls") {
    host.show();
    host.setAllowed(true);
    host.open();
    host.close();
    host.setAllowed(false);
  } else {
    host.show();
    host.append({ sequence: 1, playerId: "self", name: "我", text: "hi" });
    const globals = globalThis as unknown as { window?: unknown };
    const previousWindow = globals.window;
    globals.window = win;
    try {
      host.dispose();
      host.dispose();
    } finally {
      if (previousWindow === undefined) delete globals.window;
      else globals.window = previousWindow;
    }
    host.append({ sequence: 2, playerId: "self", name: "我", text: "later" });
  }
  return { events, shown: host.shown, allowed: host.allowed,
    disposed: host.disposed, roomChannel: host.roomChannel,
    loadingLine: host.loadingLine, inputHidden: input.hidden,
    elementHidden: element.hidden, logText: log.textContent,
    keys: [...host.messages.keys()], hideTimer: host.hideTimer };
}

test("in-race chat room/race selection, drawing, expiry and controls match release", () => {
  for (const variant of ["room", "race", "mismatch", "loading", "messages",
    "dispose", "controls"] as const) {
    assert.deepEqual(observe(true, variant), observe(false, variant), variant);
  }
});
