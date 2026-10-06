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

async function observeLoading(rewritten: boolean,
  variant: "normal" | "missing-chat" | "no-context" | "font-error") {
  const events: unknown[][] = [];
  let elementId = 0;
  const context = {
    font: "", textBaseline: "", strokeStyle: "", lineWidth: 0,
    lineJoin: "", fillStyle: "",
    putImageData(image: { width: number; height: number }, ...args: number[]) {
      events.push(["pixels", image.width, image.height, ...args]);
    },
    clearRect(...args: number[]) { events.push(["clear", ...args]); },
    drawImage() { events.push(["draw"]); },
    strokeText() { events.push(["stroke"]); },
    fillText() { events.push(["fill"]); },
  };
  function element(tag: string) {
    const id = `${tag}-${++elementId}`;
    return { id, tagName: tag.toUpperCase(), className: "", dataset: {},
      hidden: false, width: 0, height: 0, textContent: "", value: "",
      type: "", maxLength: 0, scrollTop: 0, scrollHeight: 0,
      setAttribute(name: string, value: string) {
        events.push(["attribute", id, name, value]);
      },
      addEventListener(name: string, _listener: unknown, capture?: boolean) {
        events.push(["add", id, name, capture]);
      },
      removeEventListener(name: string) { events.push(["remove-listener", id, name]); },
      append(...children: Array<{ id: string }>) {
        events.push(["append", id, children.map(child => child.id)]);
      },
      remove() { events.push(["remove", id]); },
      focus() { events.push(["focus", id]); },
      blur() { events.push(["blur", id]); },
      getContext(kind: string) {
        events.push(["context", id, kind]);
        return variant === "no-context" && id === "canvas-1" ? null : context;
      },
    };
  }
  const root = element("root");
  const document = { createElement: element };
  const win = {
    addEventListener(name: string, _listener: unknown, capture: boolean) {
      events.push(["window-add", name, capture]);
    },
    setTimeout(_callback: () => void, delay: number) {
      events.push(["timer", delay]); return 1;
    },
    clearTimeout(id: number) { events.push(["clear-timer", id]); },
  };
  class ImageData {
    constructor(readonly data: Uint8ClampedArray,
      readonly width: number, readonly height: number) {}
  }
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = Object.fromEntries(["document", "window", "ImageData"].map(
    key => [key, globals[key]]));
  Object.assign(globals, { document, window: win, ImageData });
  try {
    const library = { id: "library" };
    const select = (_library: unknown, roots: string[], name: string,
      extension?: string) => {
      events.push(["asset", roots, name, extension]);
      return { bytes: async () => { events.push(["bytes", name]);
        return Uint8Array.from([1, 2]); } };
    };
    const decode = async (bytes: Uint8Array) => {
      events.push(["decode", [...bytes]]);
      return { width: 2, height: 2, pixels: [1, 2, 3, 4] };
    };
    const emotions = async (_library: unknown) => {
      events.push(["emotions"]); return [{ marker: ":)" }];
    };
    const registerFont = async (name: string, _bytes: Uint8Array) => {
      events.push(["font", name]);
      if (variant === "font-error") throw new Error("font failed");
      return "font-owner";
    };
    const releaseFont = (font: unknown) => { events.push(["font-release", font]); };
    const dependencies: RaceChatDependencies = {
      loadFrame: async value => decode(await select(value,
        ["stage_/common"], "ingame_chat_Bg").bytes()),
      loadEmotions: emotions,
      loadFontBytes: value => select(value, ["gui_/font"],
        "SourceHanSansCN-Medium", ".otf").bytes(),
      registerFont, releaseFont,
      parseChat: text => ({ text }), nowMs: () => 1000,
      setTimer: win.setTimeout, clearTimer: win.clearTimeout,
    };
    const connection = {
      roomId: "room", raceId: "race", playerId: "self",
      sendRaceChat: variant === "missing-chat" ? undefined :
        async (_text: string) => undefined,
      subscribeRaceChat: variant === "missing-chat" ? undefined :
        (_listener: unknown) => {
          events.push(["subscribe"]); return () => events.push(["unsubscribe"]);
        },
    };
    const originalDeps = {
      U1: select, p2: decode, cP: emotions, f5: registerFont,
      G1: releaseFont, kE: "KartSim Multiplayer Race Chat",
      Qr0: 5000, Ng: dependencies.parseChat,
      performance: { now: dependencies.nowMs }, window: win,
      document, ImageData,
    };
    const Original = new Function(...Object.keys(originalDeps),
      `${originalClass}\nreturn Dv;`)(...Object.values(originalDeps)) as {
        load(library: unknown, root: unknown, connection: unknown,
          status: unknown): Promise<RaceChatOverlay>;
      };
    let loaded: RaceChatOverlay | undefined;
    let error: string | undefined;
    try {
      if (rewritten) {
        class Screen extends RaceChatOverlay {}
        loaded = await Screen.load(library, root as unknown as HTMLElement,
          connection, () => undefined, dependencies);
      } else {
        loaded = await Original.load(library, root, connection, () => undefined);
      }
    } catch (failure) { error = (failure as Error).message; }
    return { events, error, loaded: loaded && {
      elementHidden: loaded.element.hidden,
      inputHidden: loaded.input.hidden,
      canvas: [loaded.canvas.width, loaded.canvas.height],
      font: loaded.font,
    } };
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globals[key];
      else globals[key] = value;
    }
  }
}

test("in-race chat asset loading and font cleanup match release", async () => {
  for (const variant of ["normal", "missing-chat", "no-context",
    "font-error"] as const) {
    assert.deepEqual(await observeLoading(true, variant),
      await observeLoading(false, variant), variant);
  }
});

type KeyVariant = "window-enter" | "window-editing" | "window-repeat" |
  "window-hidden" | "escape" | "blank" | "send" | "rate-limit" |
  "chat-closed" | "send-error" | "composing" | "already-sending";

async function observeKeyboard(rewritten: boolean, variant: KeyVariant) {
  const events: unknown[][] = [];
  const context = {
    clearRect() { events.push(["clear"]); },
    drawImage() { events.push(["draw"]); },
    strokeText() { events.push(["stroke"]); },
    fillText() { events.push(["fill"]); },
  };
  class Element {
    className = "";
    dataset = {};
    hidden = true;
    width = 0;
    height = 0;
    type = "";
    maxLength = 0;
    value = "";
    textContent = "";
    scrollTop = 0;
    scrollHeight = 0;
    isContentEditable = false;
    tagName: string;
    constructor(tag: string) { this.tagName = tag.toUpperCase(); }
    setAttribute() {}
    addEventListener() {}
    append() {}
    getContext() { return context; }
    focus() { events.push(["focus"]); }
    blur() { events.push(["blur"]); }
  }
  const document = { createElement: (tag: string) => new Element(tag) };
  const win = { addEventListener() {}, setTimeout() { return 1; },
    clearTimeout() {} };
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = Object.fromEntries(["document", "window", "HTMLElement"].map(
    key => [key, globals[key]]));
  Object.assign(globals, { document, window: win, HTMLElement: Element });
  try {
    const deps: RaceChatDependencies = {
      loadFrame: async () => ({ width: 1, height: 1, pixels: [] }),
      loadEmotions: async () => [], loadFontBytes: async () => new Uint8Array(),
      registerFont: async () => "font", releaseFont() {},
      parseChat: text => ({ text }), nowMs: () => 1000,
      setTimer: () => 1, clearTimer() {},
    };
    const originalDeps = {
      window: win, document, HTMLElement: Element,
      Ng: deps.parseChat, Qr0: 5000, kE: "KartSim Multiplayer Race Chat",
      PE: (event: { key: string; code: string }) => event.key === "Enter" ||
        event.code === "Enter",
      LE: (message: { name: string; text: string }) =>
        `${message.name} : ${message.text}`,
      performance: { now: deps.nowMs },
    };
    const Original = new Function(...Object.keys(originalDeps),
      `${originalClass}\nreturn Dv;`)(...Object.values(originalDeps)) as
      new (...args: unknown[]) => RaceChatOverlay;
    const connection = {
      roomId: "room", raceId: "race", playerId: "self",
      sendRaceChat(text: string) {
        events.push(["send", text]);
        if (variant === "rate-limit") return Promise.reject(new Error("CHAT_RATE_LIMIT"));
        if (variant === "chat-closed") return Promise.reject(new Error("RACE_CHAT_CLOSED"));
        if (variant === "send-error") return Promise.reject(new Error("network"));
        return Promise.resolve();
      },
      subscribeRaceChat: () => () => undefined,
    };
    const status = (message: string, error?: boolean) => {
      events.push(["status", message, error]);
    };
    const root = new Element("div");
    const frame = new Element("canvas");
    const host = rewritten
      ? new RaceChatOverlay(root as unknown as HTMLElement, connection,
        status, frame as unknown as HTMLCanvasElement, "font", [], deps)
      : new Original(root, connection, status, frame, "font", []);
    events.length = 0;
    host.shown = variant !== "window-hidden";
    host.allowed = true;
    host.sending = variant === "already-sending";
    host.input.hidden = !["escape", "blank", "send", "rate-limit",
      "chat-closed", "send-error", "composing", "already-sending"].includes(variant);
    host.input.value = variant === "blank" ? "   " : "  hello  ";
    const target = new Element(variant === "window-editing" ? "input" : "div");
    const event = {
      target,
      key: variant === "escape" ? "Escape" : "Enter",
      code: variant === "escape" ? "Escape" : "Enter",
      keyCode: 13,
      repeat: variant === "window-repeat",
      isComposing: variant === "composing",
      preventDefault() { events.push(["prevent"]); },
      stopImmediatePropagation() { events.push(["stop"]); },
    } as unknown as KeyboardEvent;
    if (variant.startsWith("window")) host.onWindowKeyDown(event);
    else host.onInputKeyDown(event);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    return { events, shown: host.shown, allowed: host.allowed,
      inputHidden: host.input.hidden, inputValue: host.input.value,
      sending: host.sending };
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globals[key];
      else globals[key] = value;
    }
  }
}

test("in-race chat keyboard gates, send failures and focus match release", async () => {
  for (const variant of ["window-enter", "window-editing", "window-repeat",
    "window-hidden", "escape", "blank", "send", "rate-limit",
    "chat-closed", "send-error", "composing", "already-sending"] as const) {
    assert.deepEqual(await observeKeyboard(true, variant),
      await observeKeyboard(false, variant), variant);
  }
});
