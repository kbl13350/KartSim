import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { updateRaceSession, type RaceSessionUpdateHost } from "./race-session-update";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Yr0 extends aP {");
const end = release.indexOf("\nfunction fc(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);
const states = { Ready: 0, Countdown: 1, Racing: 2, PostFinish: 3, Result: 4 };
const lteKeys = { KeyZ: ["dodge-left"] };

type Scenario = "inactive" | "disposed" | "normal" | "lte" |
  "cancelled" | "reset-notice" | "results" | "publish-result" |
  "notice-visible" | "instant-gated" | "unsupported" |
  "disposed-during" | "update-error";

function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const Original = new Function("aP", "sG", "performance", "Xr0", "X2",
    `${originalClass}\nreturn Yr0;`)(class {}, class {},
    { now: () => 1200 }, lteKeys, states) as new () => {
      update(frame: unknown): void;
    };
  const session = Object.create(Original.prototype) as RaceSessionUpdateHost;
  const command = scenario === "reset-notice" ? { kind: "reset" }
    : scenario === "instant-gated" ? { kind: "instant-acceleration" }
      : scenario === "unsupported" ? { kind: "unsupported-action" }
        : { kind: "forward-down" };
  const inputTransitions = [{ code: "KeyUp", pressed: true }];
  const notice = {
    visible: scenario === "notice-visible",
    showRoadBlockReset(nowMs: number) { events.push(["reset-notice", nowMs]);
      this.visible = true; },
    hide() { events.push(["notice-hide"]); this.visible = false; },
  };
  const physics = {
    speedRaceMode: { kind: scenario === "lte" ? "lte" : "ordinary" },
    hardCancelControls() { events.push(["hard-cancel"]); },
    handleDrivingCommand(received: unknown, applied: unknown) {
      events.push(["driving-command", received, applied]);
    },
    startRaceBooster() { events.push(["start-race-booster"]); },
    startPlayBooster(applied: unknown) {
      events.push(["play-booster", applied]);
    },
    consumeSpeedSlotReordered() { events.push(["consume-slot-reorder"]);
      return true; },
  };
  const lifecycle = { state: scenario === "instant-gated" ? states.Ready
    : states.Racing, countdownStep: 2 };
  const local = {
    physics,
    lifecycle,
    cancelModeDrivingInput() { events.push(["cancel-mode-input"]); },
    isStartBoosterWindow(nowMs: number) { events.push(["start-window", nowMs]);
      return true; },
    requestReset() { events.push(["request-reset"]); },
    consumeRoadBlockResetNotice() { events.push(["consume-reset-notice"]);
      return scenario === "reset-notice"; },
    handleModeDrivingCommand(received: unknown, nowMs: number) {
      events.push(["mode-command", received, nowMs]);
      return scenario === "unsupported";
    },
    boostGaugeFull: true,
  };
  Object.assign(session, {
    active: scenario !== "inactive",
    disposed: scenario === "disposed",
    resultVisible: scenario === "results",
    now: 0,
    runtime: {
      local,
      update(nowMs: number, applied: unknown, suspended: boolean) {
        events.push(["runtime-update", nowMs, applied, suspended]);
        if (scenario === "disposed-during") session.disposed = true;
        return scenario === "publish-result" ? [{ kind: "publish-result" }]
          : [{ kind: "race-action" }];
      },
    },
    host: {
      input: {
        drain(keyMap: unknown) { events.push(["drain", keyMap === lteKeys
          ? "lte-keys" : keyMap]);
          return { transitions: inputTransitions,
            cancelled: scenario === "cancelled" }; },
        cancelAll() { events.push(["input-cancel"]); },
      },
      autoForward: {
        cancel() { events.push(["auto-cancel"]); },
        setRaceState(active: boolean, pendingStart: boolean) {
          events.push(["auto-race-state", active, pendingStart]);
        },
        dispatch(code: unknown, pressed: unknown, snapshot: unknown,
          handle: (command: unknown) => void) {
          events.push(["auto-dispatch", code, pressed, snapshot]);
          handle(command);
        },
        apply(snapshot: unknown) { events.push(["auto-apply", snapshot]);
          return "applied"; },
        isActive(snapshot: unknown) { events.push(["auto-active", snapshot]);
          return true; },
      },
      clientFramerate: { sample(nowMs: number) {
        events.push(["frame-sample", nowMs]);
      } },
      touchControls: { setAutoForwardActive(active: boolean) {
        events.push(["touch-auto", active]);
      } },
      playSlotChanger() { events.push(["slot-changer"]); },
      renderer: "renderer",
      status(message: string) { events.push(["status", message]); },
    },
    controls: {
      cancel() { events.push(["controls-cancel"]); },
      dispatch(transitions: unknown[], handle: (code: unknown,
        pressed: unknown) => void) {
        events.push(["controls-dispatch", transitions]);
        for (const transition of transitions as typeof inputTransitions) {
          handle(transition.code, transition.pressed);
        }
      },
      snapshot() { events.push(["snapshot"]); return "snapshot"; },
    },
    notice,
    chat: { setAllowed(allowed: boolean) {
      events.push(["chat-allowed", allowed]);
    } },
    scene: {
      awardInput(transitions: unknown, cancelled: boolean) {
        events.push(["award-input", transitions, cancelled]);
      },
      startBoostGaugeFull() { events.push(["boost-full"]); },
      update(renderer: unknown, nowMs: number, actions: unknown) {
        events.push(["scene-update", renderer, nowMs, actions]);
        if (scenario === "update-error") throw new Error("scene failed");
      },
      resultComplete: scenario === "results",
    },
    requestLeave() { events.push(["request-leave"]); },
    fail(error: unknown) { events.push(["fail", (error as Error).message]); },
  });
  if (rewritten) updateRaceSession(session, {
    nowMs: () => 1200, lteKeyMap: lteKeys, states,
  });
  else (session as unknown as InstanceType<typeof Original>).update(null);
  return { events, now: session.now,
    disposed: session.disposed, resultVisible: session.resultVisible,
    noticeVisible: notice.visible };
}

test("multiplayer session input, reset, publish and failure ticks match release", () => {
  const scenarios: Scenario[] = ["inactive", "disposed", "normal", "lte",
    "cancelled", "reset-notice", "results", "publish-result",
    "notice-visible", "instant-gated", "unsupported",
    "disposed-during", "update-error"];
  for (const scenario of scenarios) {
    assert.deepEqual(observe(true, scenario), observe(false, scenario), scenario);
  }
});
