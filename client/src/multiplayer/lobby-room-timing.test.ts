import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  animateLobbyRoom, canAnimateLobbyRoom, isLobbyCountdownLocked,
  lobbyCountdownState, sendLobbyChat, sendLobbyEmotion,
  setLobbyStartPresentation, updateLobbyCountdown,
  type LobbyRoomTimingHost, type LobbyTimingDependencies,
} from "./lobby-room-timing";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class py {");
const end = release.indexOf("\nclass gy", start);
assert.ok(start >= 0 && end > start);
const classSource = release.slice(start, end);
const members = new Set([
  "setStartPresentation", "roomCanAnimate", "updateCountdown", "countdownState",
  "countdownLocked", "sendEmotion", "animate", "sendChat",
]);
const originalMembers = parse(classSource, { sourceType: "script" }).program.body[0]
  .body.body.filter((member: any) => member.type === "ClassMethod" &&
    members.has(member.key.name));
assert.equal(originalMembers.length, members.size);
const originalSource = originalMembers.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type TestedHost = LobbyRoomTimingHost & {
  setStartPresentation(enabled: boolean): void;
  updateCountdown(room: LobbyRoomTimingHost["room"]): void;
  sendEmotion(emotion: { marker: string }): Promise<void>;
  sendChat(): Promise<void>;
};

function makeFixture(rewritten: boolean) {
  const events: unknown[][] = [];
  const frames = new Map<number, () => void>();
  let nextFrame = 1;
  let now = 5_000;
  let clock: unknown = { offset: 500 };
  let manualStartAllowed = true;
  let canStartThrows = false;
  let chatResult: unknown = true;
  let chatThrows = false;
  const dependencies: LobbyTimingDependencies = {
    nowMs: () => { events.push(["now"]); return now; },
    requestFrame(callback) {
      const id = nextFrame++;
      events.push(["request-frame", id]);
      frames.set(id, callback);
      return id;
    },
    cancelFrame(id) { events.push(["cancel-frame", id]); frames.delete(id); },
    toLocalStartAt(serverTime, capturedClock) {
      events.push(["local-start", serverTime, capturedClock]);
      return serverTime + 9_000;
    },
  };
  const Original = new Function("Y3", "performance", "requestAnimationFrame",
    "cancelAnimationFrame", `return class { ${originalSource} };`)(
      dependencies.toLocalStartAt, { now: dependencies.nowMs },
      dependencies.requestFrame, dependencies.cancelFrame,
    ) as new () => TestedHost;
  const host = new Original();
  Object.assign(host, {
    room: { phase: "open", autoStartAt: undefined, hostId: "host" },
    playerId: "host",
    startPresentation: false,
    animation: undefined,
    visible: true,
    disposed: false,
    connected: true,
    busy: false,
    chatSending: false,
    chatDraft: "  hi everyone  ",
    autoStartAt: undefined,
    autoStartLocalAt: undefined,
    lastCountdownNumber: 10,
    lastManualStartAllowed: true,
    lastCountdownLocked: false,
    previews: { dispose() { events.push(["dispose-previews"]); } },
    countdown: {
      reset() { events.push(["countdown-reset"]); },
      playTick() { events.push(["countdown-tick"]); },
    },
    trackChangeNotice: {
      tick() { events.push(["notice-tick"]); },
      hide() { events.push(["notice-hide"]); },
    },
    view: {
      render() { events.push(["render"]); },
      repaint() { events.push(["repaint"]); },
    },
    actions: {
      captureClock() { events.push(["capture-clock"]); return clock; },
      canStart() {
        events.push(["can-start"]);
        if (canStartThrows) throw new Error("cannot inspect readiness");
        return manualStartAllowed;
      },
      onCountdownLocked() { events.push(["locked"]); },
      onError(error: unknown) { events.push(["error", (error as Error).message]); },
      async chat(message: string) {
        events.push(["chat", message]);
        if (chatThrows) throw new Error("network failure");
        return chatResult;
      },
    },
  });
  if (rewritten) {
    Object.assign(host, {
      setStartPresentation(enabled: boolean) {
        return setLobbyStartPresentation(host, enabled, dependencies);
      },
      roomCanAnimate() { return canAnimateLobbyRoom(host); },
      updateCountdown(room: LobbyRoomTimingHost["room"]) {
        return updateLobbyCountdown(host, room, dependencies);
      },
      countdownState() { return lobbyCountdownState(host, dependencies); },
      sendEmotion(emotion: { marker: string }) { return sendLobbyEmotion(host, emotion); },
      animate() { return animateLobbyRoom(host, dependencies); },
      sendChat() { return sendLobbyChat(host); },
    });
    Object.defineProperty(host, "countdownLocked", {
      configurable: true, get: () => isLobbyCountdownLocked(host),
    });
  }
  return {
    host, events, frames,
    setNow(value: number) { now = value; },
    setClock(value: unknown) { clock = value; },
    setManualStart(value: boolean) { manualStartAllowed = value; },
    throwCanStart() { canStartThrows = true; },
    setChatResult(value: unknown) { chatResult = value; },
    throwChat() { chatThrows = true; },
    frame() {
      const [id, callback] = frames.entries().next().value ?? [];
      if (id === undefined || !callback) throw new Error("No pending frame");
      frames.delete(id);
      callback();
    },
  };
}

test("room countdown and animation scheduling match release", () => {
  function inspect(rewritten: boolean): unknown {
    const fixture = makeFixture(rewritten);
    const { host, events } = fixture;
    const states: unknown[] = [];
    host.updateCountdown({ phase: "open", autoStartAt: 1_000 });
    host.updateCountdown({ phase: "open", autoStartAt: 1_000 });
    states.push(host.countdownState(), host.countdownLocked);
    host.setStartPresentation(true);
    fixture.setNow(6_500);
    fixture.setManualStart(false);
    fixture.frame();
    states.push(host.countdownState(), host.lastCountdownNumber, host.lastCountdownLocked);
    fixture.setNow(10_500);
    fixture.frame();
    states.push(host.countdownState(), host.lastCountdownNumber, host.lastCountdownLocked);
    host.room = { phase: "loading", autoStartAt: 1_000, hostId: "host" };
    host.setStartPresentation(false);
    states.push(host.roomCanAnimate(), host.animation, fixture.frames.size);
    fixture.setClock(undefined);
    host.updateCountdown({ phase: "open", autoStartAt: 2_000 });
    states.push(host.autoStartLocalAt, host.countdownState());
    return { states, events };
  }
  assert.deepEqual(inspect(true), inspect(false));
});

test("room frame failures and stale frame guards match release", () => {
  function inspect(rewritten: boolean): unknown {
    const fixture = makeFixture(rewritten);
    const { host, events } = fixture;
    host.animate();
    host.animation = 999;
    fixture.frame();
    host.animation = undefined;
    fixture.throwCanStart();
    host.animate();
    fixture.frame();
    return { events, previews: host.previews, pending: fixture.frames.size };
  }
  assert.deepEqual(inspect(true), inspect(false));
});

test("emotion and chat submission gates, success, failure and cleanup match release", async () => {
  async function inspect(rewritten: boolean): Promise<unknown> {
    const fixture = makeFixture(rewritten);
    const { host, events } = fixture;
    await host.sendEmotion({ marker: "wave" });
    await host.sendChat();
    const afterSuccess = host.chatDraft;
    host.chatDraft = "  keep  ";
    fixture.setChatResult(false);
    await host.sendChat();
    const afterFalse = host.chatDraft;
    fixture.throwChat();
    let error: string | undefined;
    try { await host.sendEmotion({ marker: "laugh" }); }
    catch (failure) { error = (failure as Error).message; }
    host.disposed = true;
    try { await host.sendChat(); } catch {}
    host.busy = true;
    await host.sendEmotion({ marker: "blocked" });
    host.busy = false;
    host.connected = false;
    await host.sendChat();
    return { events, afterSuccess, afterFalse, finalDraft: host.chatDraft,
      chatSending: host.chatSending, error };
  }
  assert.deepEqual(await inspect(true), await inspect(false));
});
