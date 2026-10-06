import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  activateLobbyReadyShortcut, closeLobbyEmotionWheel,
  disposeLobbyRoom, hideLobbyRoom, installLobbyRoomKeyboard,
  removeLobbyRoomKeyboard, showLobbyRoom, toggleLobbyEmotionWheel,
  updateLobbyRoom,
  type LobbyRoomLifecycleDependencies, type LobbyRoomLifecycleHost,
  type LobbyRoomSnapshot,
} from "./lobby-room-lifecycle";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class py {");
const end = release.indexOf("\nclass gy {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Room = LobbyRoomLifecycleHost & {
  show(): void;
  hide(): void;
  activateReadyShortcut(): void;
  update(room: LobbyRoomSnapshot, busy: boolean, connected: boolean): void;
  dispose(): void;
  installRoomKeyboard(): void;
  toggleEmotionWheel(): void;
};

function makeFixture(rewritten: boolean, options: {
  countdown?: boolean;
  host?: boolean;
  ready?: boolean;
  disabled?: boolean;
  canAnimate?: boolean;
  canStart?: boolean;
  disposed?: boolean;
} = {}) {
  const events: unknown[][] = [];
  let now = 1000;
  const dependencies: LobbyRoomLifecycleDependencies = {
    previewMembers(room, teams) {
      events.push(["preview-members", room.phase, teams]);
      return { count: room.members.length };
    },
    parseChat(text, emotions) {
      events.push(["parse-chat", text, emotions]);
      return { text: text === "emote" ? "" : text,
        action: text === "emote" ? "dance" : undefined };
    },
    chatBubbleDurationMs: 500,
    nowMs() { events.push(["now", now]); return now++; },
    cancelFrame(frame) { events.push(["cancel-frame", frame]); },
    keyboard: {
      addEventListener(type, listener, capture) {
        events.push(["add-keyboard", type, listener, capture]);
      },
      removeEventListener(type, listener, capture) {
        events.push(["remove-keyboard", type, listener, capture]);
      },
    },
  };
  const Original = new Function("DT", "Ng", "Il0", "performance",
    "cancelAnimationFrame", "window",
    `${originalClass}\nreturn py;`)(
      dependencies.previewMembers, dependencies.parseChat,
      dependencies.chatBubbleDurationMs,
      { now: dependencies.nowMs }, dependencies.cancelFrame,
      dependencies.keyboard,
    ) as new () => Room;
  const room = Object.create(Original.prototype) as Room;
  room.playerId = "self";
  room.room = { phase: "open", hostId: options.host === false ? "other" : "self",
    members: [{ playerId: "self", ready: options.ready ?? false },
      { playerId: "other" }] };
  room.actions = { canStart() { events.push(["can-start"]);
    return options.canStart ?? true; } };
  room.busy = false;
  room.connected = true;
  room.disposed = options.disposed ?? false;
  room.visible = false;
  room.animation = undefined;
  room.previews = {
    update(value) { events.push(["previews-update", value]); },
    play(playerId, action) { events.push(["previews-play", playerId, action]); },
    dispose() { events.push(["previews-dispose"]); },
  };
  room.roleTeams = ["red"];
  room.bubbles = new Map();
  room.lastChatSequence = 1;
  room.lastManualStartAllowed = true;
  room.lastCountdownLocked = false;
  room.emotionWheelOpen = false;
  room.trackLoad = 3;
  room.trackImage = "image";
  room.trackReverseStamp = "reverse";
  room.onEmotionKey = "emotion-handler";
  room.onRoomKey = "room-handler";
  room.trackChangeNotice = {
    update(snapshot, visible) { events.push(["notice-update", snapshot.phase, visible]); },
    hide() { events.push(["notice-hide"]); },
    dispose() { events.push(["notice-dispose"]); },
  };
  room.countdown = { dispose() { events.push(["countdown-dispose"]); } };
  room.view = {
    element: {
      contains(target) { events.push(["contains", target]); return true; },
      removeEventListener(type, listener, capture) {
        events.push(["view-remove-key", type, listener, capture]);
      },
    },
    show() { events.push(["view-show"]); },
    hide() { events.push(["view-hide"]); },
    focus(name) { events.push(["view-focus", name]); },
    render() { events.push(["view-render"]); },
    state(node) { events.push(["view-state", node]); return {}; },
    dispose() { events.push(["view-dispose"]); },
  };
  room.state = node => {
    events.push(["state", node]);
    return { visible: true, disabled: options.disabled ?? false,
      action: () => events.push(["shortcut-action"]),
      onActivate: () => events.push(["shortcut-activate"]) };
  };
  room.countdownState = () => {
    events.push(["countdown-state"]);
    return { active: options.countdown ?? false };
  };
  Object.defineProperty(room, "countdownLocked", {
    get() { events.push(["countdown-locked"]); return false; },
    configurable: true,
  });
  room.updateCountdown = snapshot => events.push(["update-countdown", snapshot.phase]);
  room.roomCanAnimate = () => {
    events.push(["can-animate"]); return options.canAnimate ?? true;
  };
  room.animate = () => { events.push(["animate"]); room.animation = 99; };
  room.loadTrack = async () => { events.push(["load-track"]); };
  if (rewritten) Object.assign(room, {
    show() { return showLobbyRoom(room, dependencies); },
    hide() { return hideLobbyRoom(room, dependencies); },
    activateReadyShortcut() { return activateLobbyReadyShortcut(room); },
    update(snapshot: LobbyRoomSnapshot, busy: boolean, connected: boolean) {
      return updateLobbyRoom(room, snapshot, busy, connected,
        ["smile"], dependencies);
    },
    dispose() { return disposeLobbyRoom(room, dependencies); },
    installRoomKeyboard() { return installLobbyRoomKeyboard(room, dependencies); },
    removeRoomKeyboard() { return removeLobbyRoomKeyboard(room, dependencies); },
    toggleEmotionWheel() { return toggleLobbyEmotionWheel(room); },
    closeEmotionWheel() { return closeLobbyEmotionWheel(room); },
  });
  (room as Room & { emotions: unknown[] }).emotions = ["smile"];
  return { room, events };
}

test("room show, hide, keyboard and emotion-wheel state match release", () => {
  for (const mode of [{}, { disposed: true }, { canAnimate: false }]) {
    const inspect = (rewritten: boolean) => {
      const { room, events } = makeFixture(rewritten, mode);
      room.show();
      room.installRoomKeyboard();
      room.toggleEmotionWheel();
      room.hide();
      return { events, visible: room.visible,
        emotionWheelOpen: room.emotionWheelOpen,
        animation: room.animation };
    };
    assert.deepEqual(inspect(true), inspect(false), JSON.stringify(mode));
  }
});

test("ready shortcut resolves host/member state and respects disabled or closed room", () => {
  for (const mode of [{}, { host: false, ready: true, countdown: true },
    { disabled: true }, { disposed: true }]) {
    const inspect = (rewritten: boolean) => {
      const { room, events } = makeFixture(rewritten, mode);
      room.activateReadyShortcut();
      return events;
    };
    assert.deepEqual(inspect(true), inspect(false), JSON.stringify(mode));
  }
});

test("room update handles chat, expiry, previews and disconnection like release", () => {
  for (const connected of [true, false]) {
    for (const canAnimate of [true, false]) {
      const inspect = (rewritten: boolean) => {
        const { room, events } = makeFixture(rewritten, { canAnimate });
        room.visible = true;
        room.emotionWheelOpen = true;
        room.bubbles.set("gone", { sequence: 0, text: "old", until: 900 });
        const snapshot: LobbyRoomSnapshot = {
          phase: "open", hostId: "self",
          members: [{ playerId: "self" }, { playerId: "other" }],
          chat: [
            { sequence: 1, playerId: "self", text: "old" },
            { sequence: 2, playerId: "other", text: "hello" },
            { sequence: 3, playerId: "self", text: "emote" },
          ],
        };
        room.update(snapshot, !connected, connected);
        return { events, bubbles: [...room.bubbles],
          lastChatSequence: room.lastChatSequence,
          animation: room.animation, connected: room.connected,
          busy: room.busy, hasPreviews: !!room.previews };
      };
      assert.deepEqual(inspect(true), inspect(false),
        `${connected}:${canAnimate}`);
    }
  }
});

test("room disposal invalidates track load and releases owners in release order", () => {
  const inspect = (rewritten: boolean) => {
    const { room, events } = makeFixture(rewritten);
    room.animation = 55;
    room.dispose();
    return { events, disposed: room.disposed, visible: room.visible,
      trackLoad: room.trackLoad, trackImage: room.trackImage,
      reverse: room.trackReverseStamp, animation: room.animation };
  };
  assert.deepEqual(inspect(true), inspect(false));
});
