import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { handleLobbyEmotionKey, handleLobbyRoomKey,
  initializeLobbyRoom, loadLobbyRoom,
  type ConstructedLobbyRoom, type LobbyRoomConstructionDependencies,
} from "./lobby-room-construction";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class py {");
const end = release.indexOf("\nclass gy {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type RoomClass = new (room: unknown, playerId: unknown, actions: unknown,
  library: unknown) => ConstructedLobbyRoom & { state(node: unknown): unknown };

test("room view constructor keeps room owners and latest chat sequence", () => {
  const Original = new Function(`${originalClass}\nreturn py;`)() as RoomClass;
  for (const chat of [undefined, [], [{ sequence: 3 }, { sequence: 8 }]]) {
    const room = { phase: "open", chat };
    const actions = { leave: () => undefined };
    const library = {};
    const original = new Original(room, "player", actions, library);
    const rewritten = Object.create(Original.prototype) as ConstructedLobbyRoom;
    initializeLobbyRoom(rewritten, room, "player", actions, library);
    assert.deepEqual([rewritten.room, rewritten.playerId, rewritten.actions,
      rewritten.library, rewritten.lastChatSequence],
    [original.room, original.playerId, original.actions,
      original.library, original.lastChatSequence]);
  }
});

type LoadVariant = "normal" | "roadblock" | "roles-error" |
  "emotions-error" | "countdown-error" | "definition-error" |
  "view-error" | "notice-error";

async function observeLoad(rewritten: boolean, variant: LoadVariant) {
  const events: unknown[][] = [];
  const room = { phase: "open", chat: [{ sequence: 4 }],
    mode: variant === "roadblock" ? "roadblock" : "ordinary" };
  const library = { id: "library" };
  const root = { id: "root" };
  const countdown = { dispose() { events.push(["countdown-dispose"]); },
    reset() { events.push(["countdown-reset"]); } };
  const view = { element: {
    hidden: false,
    contains() { return true; },
    addEventListener(type: string, _listener: unknown, capture: boolean) {
      events.push(["view-key", type, capture]);
    },
  }, comboOpen: false,
  focus(name: string) { events.push(["focus", name]); },
  render() { events.push(["render"]); },
  dispose() { events.push(["view-dispose"]); },
  };
  const notice = { dispose() { events.push(["notice-dispose"]); } };
  const dependencies: LobbyRoomConstructionDependencies = {
    mode(snapshot) { events.push(["mode", snapshot === room]); return room.mode; },
    async loadRoleTeams(value) {
      events.push(["roles", value === library]);
      if (variant === "roles-error") throw new Error("roles failed");
      return ["team"];
    },
    async loadEmotions(value) {
      events.push(["emotions", value === library]);
      if (variant === "emotions-error") throw new Error("emotions failed");
      return [{ marker: ":)" }];
    },
    async loadCountdown(value) {
      events.push(["countdown", value === library]);
      if (variant === "countdown-error") throw new Error("countdown failed");
      return countdown;
    },
    async loadDefinition(value, roadblock) {
      events.push(["definition", value === library, roadblock]);
      if (variant === "definition-error") throw new Error("definition failed");
      return { id: "definition" };
    },
    withEmotions(definition, emotions) {
      events.push(["with-emotions", definition, emotions]);
      return { id: "with-emotions" };
    },
    async loadView(options) {
      events.push(["view-load", options.library === library,
        options.root === root, options.preserveDisplayPixels,
        options.smoothImages, options.definition, options.roots,
        options.label, typeof options.state,
        typeof options.onActivate, typeof options.onHover]);
      if (variant === "view-error") throw new Error("view failed");
      return view;
    },
    async loadTrackChangeNotice(value, element, snapshot, playerId) {
      events.push(["notice", value === library, element === root,
        snapshot === room, playerId]);
      if (variant === "notice-error") throw new Error("notice failed");
      return notice;
    },
    createPreviews(value, render, onError, emotions, audioContext) {
      events.push(["previews", value === library, emotions, audioContext]);
      render();
      onError(new Error("preview warning"));
      return { id: "previews" };
    },
  };
  const classDeps = {
    G2: dependencies.mode, fa: dependencies.loadRoleTeams,
    cP: dependencies.loadEmotions,
    dy: { load: dependencies.loadCountdown },
    Ll0: dependencies.loadDefinition,
    Fl0: dependencies.withEmotions,
    te: { load: dependencies.loadView },
    fy: { load: dependencies.loadTrackChangeNotice },
    Tl0: class {
      constructor(value: unknown, render: () => void,
        onError: (error: unknown) => void, emotions: unknown,
        audioContext: unknown) {
        return dependencies.createPreviews(value, render, onError,
          emotions as [{ marker: string }], audioContext) as object;
      }
    },
  };
  const Original = new Function(...Object.keys(classDeps),
    `${originalClass}\nreturn py;`)(...Object.values(classDeps)) as
    RoomClass & { load(library: unknown, root: unknown, room: unknown,
      playerId: unknown, actions: unknown, audioContext: unknown):
      Promise<ConstructedLobbyRoom> };
  Original.prototype.state = () => ({ visible: true });
  Original.prototype.installRoomKeyboard = function () {
    events.push(["keyboard-install"]);
  };
  Original.prototype.updateCountdown = function (snapshot: unknown) {
    events.push(["countdown-update", snapshot === room]);
  };
  const actions = { onActivate() {}, onHover() {},
    onError(error: unknown) { events.push(["error", (error as Error).message]); } };
  let loaded: ConstructedLobbyRoom | undefined;
  let error: string | undefined;
  try {
    loaded = rewritten
      ? await loadLobbyRoom((snapshot, playerId, callbacks, value) =>
        new Original(snapshot, playerId, callbacks, value),
      library, root, room, "player", actions, "audio", dependencies)
      : await Original.load(library, root, room, "player", actions, "audio");
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, loaded: loaded && {
    playerId: loaded.playerId, latestChat: loaded.lastChatSequence,
    roleTeams: loaded.roleTeams, emotions: loaded.emotions,
    previews: loaded.previews,
  } };
}

test("room view loading, callbacks and each failure cleanup match release", async () => {
  for (const variant of ["normal", "roadblock", "roles-error",
    "emotions-error", "countdown-error", "definition-error",
    "view-error", "notice-error"] as const) {
    assert.deepEqual(await observeLoad(true, variant),
      await observeLoad(false, variant), variant);
  }
});

type KeyboardVariant = "backquote" | "escape" | "digit1" | "digit9" |
  "ctrl-digit" | "editing" | "alt" | "repeat" | "outside" |
  "busy" | "disconnected" | "loading" | "enter" | "body-enter" |
  "input-enter" | "combo-enter" | "composing" | "hidden";

function observeKeyboard(rewritten: boolean, variant: KeyboardVariant) {
  const events: unknown[][] = [];
  const body = { id: "body", matches: () => false };
  const Original = new Function("document", `${originalClass}\nreturn py;`)(
    { body }) as RoomClass;
  const room = { phase: variant === "loading" ? "loading" : "open" };
  const host = new Original(room, "player", {}, {});
  const target = { matches: () => variant === "editing" ||
    variant === "input-enter" };
  host.view = {
    element: {
      hidden: variant === "hidden",
      contains(value) { return variant !== "outside" && value === target; },
      addEventListener() {},
    },
    comboOpen: variant === "combo-enter",
    dispose() {}, render() {},
    focus(name) { events.push(["focus", name]); },
  };
  host.connected = variant !== "disconnected";
  host.busy = variant === "busy";
  host.disposed = false;
  host.emotionWheelOpen = true;
  host.emotions = [{ marker: ":)" }];
  host.toggleEmotionWheel = () => { events.push(["toggle"]); };
  host.sendEmotion = emotion => { events.push(["emotion", emotion.marker]); };
  const enter = ["enter", "body-enter", "input-enter", "combo-enter",
    "composing", "hidden"].includes(variant);
  const event = {
    key: enter ? "Enter" : "",
    code: variant === "backquote" ? "Backquote"
      : variant === "escape" ? "Escape"
        : variant === "digit9" ? "Digit9" : "Digit1",
    target: variant === "body-enter" ? body : target,
    altKey: variant === "alt", metaKey: false,
    ctrlKey: variant === "ctrl-digit", repeat: variant === "repeat",
    isComposing: variant === "composing",
    preventDefault() { events.push(["prevent"]); },
    stopPropagation() { events.push(["stop"]); },
  };
  if (rewritten) {
    handleLobbyEmotionKey(host, event);
    handleLobbyRoomKey(host, event, body);
  } else {
    host.onEmotionKey(event);
    host.onRoomKey(event);
  }
  return events;
}

test("room keyboard emotion and Enter gates match release", () => {
  for (const variant of ["backquote", "escape", "digit1", "digit9",
    "ctrl-digit", "editing", "alt", "repeat", "outside", "busy",
    "disconnected", "loading", "enter", "body-enter", "input-enter",
    "combo-enter", "composing", "hidden"] as const) {
    assert.deepEqual(observeKeyboard(true, variant), observeKeyboard(false, variant), variant);
  }
});
