import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DrivingAction, DrivingInputAccumulator } from "../input/driving-input";
import { ItemInputRouter } from "../input/item-input";
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

function itemRaceSession(transitions: Array<{ action: number; down: boolean }>,
  options: { cancelled?: boolean; state?: number; inverted?: boolean; router?: ItemInputRouter;
    slotChanger?: boolean; notice?: string; forwardBack?: boolean; qte?: boolean } = {}) {
  const events: unknown[][] = [];
  const effects = {
    steeringInverted: options.inverted ?? false,
    escapePress() { events.push(["escape"]); return true; },
    ...(options.forwardBack !== undefined ? { forwardBackSwapped: options.forwardBack } : {}),
    ...(options.qte ? {
      directionPress(direction: string) { events.push(["qte", direction]); return true; },
    } : {}),
  };
  const controls = new DrivingInputAccumulator();
  const session = {
    active: true, disposed: false, resultVisible: false, now: 0,
    runtime: {
      local: {
        physics: {
          itemMode: true,
          itemEffects: effects,
          speedRaceMode: { kind: "item" },
          hardCancelControls() { events.push(["hard-cancel"]); },
          handleDrivingCommand(command: { kind: string }) { events.push(["driving", command.kind]); },
          startRaceBooster() {},
          startPlayBooster() {},
          consumeSpeedSlotReordered() { return false; },
        },
        lifecycle: { state: options.state ?? states.Racing, countdownStep: 9 },
        itemInput: options.router ?? new ItemInputRouter(),
        items: {
          handleCommand(command: unknown, nowMs: number) { events.push(["item", command, nowMs]); },
        },
        itemRace: {
          consumeSlotChangerSound() { return options.slotChanger ?? false; },
          consumeStatusMessage() { return options.notice; },
        },
        cancelModeDrivingInput() {},
        isStartBoosterWindow() { return false; },
        requestReset() {},
        consumeRoadBlockResetNotice() { return false; },
        handleModeDrivingCommand() { return false; },
        boostGaugeFull: false,
      },
      update(_nowMs: number, applied: { steer: number; steeringInverted: boolean }) {
        events.push(["physics-input", applied.steer, applied.steeringInverted]);
        return [];
      },
    },
    host: {
      input: {
        drain() { return { transitions, cancelled: options.cancelled ?? false }; },
        cancelAll() {},
      },
      autoForward: {
        cancel() {},
        setRaceState() {},
        dispatch(effect: unknown, _transition: unknown, _snapshot: unknown,
          emit: (command: unknown) => void) { emit(effect); },
        apply<T>(snapshot: T) { return { ...snapshot }; },
        isActive() { return false; },
      },
      clientFramerate: { sample() {} },
      touchControls: { setAutoForwardActive() {} },
      playSlotChanger() { events.push(["slot-changer"]); },
      renderer: undefined,
      status() {},
    },
    controls,
    chat: { setAllowed() {}, notice(text: string) { events.push(["notice", text]); } },
    scene: { awardInput() {}, startBoostGaugeFull() {}, update() {}, resultComplete: false },
    requestLeave() {},
    fail(error: unknown) { throw error; },
  };
  updateRaceSession(session as unknown as RaceSessionUpdateHost,
    { nowMs: () => 4321, lteKeyMap: lteKeys, states });
  return { events, session };
}

test("item races send Ctrl, Alt and Z to the item controller instead of the nitro slots", () => {
  const { events } = itemRaceSession([
    { action: DrivingAction.UseItemOrBooster, down: true },
    { action: DrivingAction.ReorderItems, down: true },
    { action: DrivingAction.SecondaryItem, down: true },
    { action: DrivingAction.SteerLeft, down: true },
    { action: DrivingAction.Forward, down: true },
    { action: DrivingAction.UseItemOrBooster, down: false },
  ]);
  assert.deepEqual(events, [
    ["item", { kind: "use", phase: "press" }, 4321],
    ["item", { kind: "swap" }, 4321],
    ["item", { kind: "change" }, 4321],
    ["escape"],
    ["item", { kind: "use", phase: "release" }, 4321],
    ["driving", "forward-down"],
    ["physics-input", 1, false],
  ]);
});

test("a devil hit inverts the steering snapshot; cancelled input drops a held aim", () => {
  const inverted = itemRaceSession([{ action: DrivingAction.SteerLeft, down: true }],
    { inverted: true });
  assert.deepEqual(inverted.events.at(-1), ["physics-input", -1, true]);

  const router = new ItemInputRouter();
  const held = itemRaceSession([{ action: DrivingAction.UseItemOrBooster, down: true }], { router });
  assert.deepEqual(held.events[0], ["item", { kind: "use", phase: "press" }, 4321]);
  const blurred = itemRaceSession([], { router, cancelled: true });
  assert.deepEqual(blurred.events.filter(event => event[0] === "item"),
    [["item", { kind: "use", phase: "cancel" }, 4321]]);

  const countdown = itemRaceSession([
    { action: DrivingAction.UseItemOrBooster, down: true },
    { action: DrivingAction.ReorderItems, down: true },
  ], { state: states.Countdown });
  assert.deepEqual(countdown.events.filter(event => event[0] === "item" || event[0] === "driving"), []);
});

test("an item swap plays the slot changer sound and item notices reach the race chat", () => {
  const quiet = itemRaceSession([]);
  assert.ok(!quiet.events.some(event => event[0] === "slot-changer" || event[0] === "notice"));
  const { events } = itemRaceSession([], { slotChanger: true, notice: "道具变更卡暂未开放。" });
  assert.deepEqual(events.filter(event => event[0] === "slot-changer" || event[0] === "notice"),
    [["slot-changer"], ["notice", "道具变更卡暂未开放。"]]);
});

test("a newDevil swaps the pedals and a held kart's arrow presses feed the talisman QTE", () => {
  const swapped = itemRaceSession([{ action: DrivingAction.Reverse, down: true }],
    { forwardBack: true });
  assert.deepEqual(swapped.events.filter(event => event[0] === "driving"), [["driving", "forward-down"]],
    "the back key is the forward pedal");
  const snapshot = swapped.session.controls.snapshot();
  assert.equal(snapshot.forward, 1);
  assert.equal(snapshot.reverse, 0);
  const plain = itemRaceSession([{ action: DrivingAction.Reverse, down: true }], { forwardBack: false });
  assert.deepEqual(plain.events.filter(event => event[0] === "driving"), [["driving", "reverse-down"]]);

  const held = itemRaceSession([
    { action: DrivingAction.Forward, down: true },
    { action: DrivingAction.SteerRight, down: true },
    { action: DrivingAction.Reverse, down: true },
    { action: DrivingAction.SteerLeft, down: true },
  ], { qte: true });
  assert.deepEqual(held.events.filter(event => event[0] === "qte"),
    [["qte", "up"], ["qte", "right"], ["qte", "down"], ["qte", "left"]]);
});

test("an item race remembers a start boost for the 完美起步 title", () => {
  let noted = 0;
  let state = 0;
  const transitions = [{ action: DrivingAction.Forward, down: true }];
  const run = (window: boolean) => {
    const host = itemRaceSession([]).session as unknown as RaceSessionUpdateHost;
    const local = host.runtime.local as unknown as Record<string, unknown>;
    const physics = local.physics as Record<string, unknown>;
    physics.runtime = { physicsState: 0 };
    physics.startRaceBooster = () => {
      (physics.runtime as { physicsState: number }).physicsState = state;
    };
    local.isStartBoosterWindow = () => window;
    local.noteStartBooster = () => { noted += 1; };
    (host.host.input as unknown as { drain(): unknown }).drain =
      () => ({ transitions, cancelled: false });
    updateRaceSession(host, { nowMs: () => 4321, lteKeyMap: lteKeys, states });
  };
  state = 1;
  run(true);
  assert.equal(noted, 1, "pressed in the window: state 1 started");
  run(false);
  assert.equal(noted, 1, "outside the window");
  state = 0;
  run(true);
  assert.equal(noted, 1, "the booster did not start");
});
