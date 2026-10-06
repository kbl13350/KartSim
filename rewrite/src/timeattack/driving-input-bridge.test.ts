import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  drainTimeAttackDrivingInput, resetTimeAttackTachometerInput,
  routeBaseDrivingCommand, routeTimeAttackDrivingCommand,
  routeTimeAttackRaceCommand, setTimeAttackAutoForward,
  setTimeAttackNitroSeamlessMode, timeAttackDrivingSnapshot,
  type DrivingInputBridgeDependencies, type DrivingInputBridgeHost,
} from "./driving-input-bridge";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class n60 {");
const end = release.indexOf("\nfunction i60", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Bridge = DrivingInputBridgeHost & {
  drainDrivingInput(nowMs: number, inputTime: number): void;
  setAutoForwardEnabled(enabled: boolean): void;
  setNitroSeamlessMode(mode: unknown): void;
};

function makeBridge(rewritten: boolean, mode: {
  cancelled?: boolean;
  gamepad?: boolean;
  racing?: boolean;
  boosterWindow?: boolean;
  accepts?: boolean;
  active?: boolean;
  nitroPressed?: boolean;
  tachometer?: boolean;
} = {}) {
  const events: unknown[][] = [];
  const lifecycle = {
    phase: mode.racing === false ? "Ready" : "Racing",
    active: mode.active ?? true,
    accepts: mode.accepts ?? true,
    isStartBoosterWindow(nowMs: number) {
      events.push(["booster-window", nowMs]); return mode.boosterWindow ?? false;
    },
  };
  const dependencies: DrivingInputBridgeDependencies = {
    racingPhase: "Racing", forwardAction: "forward",
    acceptsTimeAttackInput(value) {
      events.push(["accepts", value === lifecycle]);
      return (value as typeof lifecycle).accepts;
    },
    activeRace(value) {
      events.push(["active", value === lifecycle]);
      return (value as typeof lifecycle).active;
    },
    isTachometer(value): value is { resetMode(mode: number): void } {
      return value instanceof Tachometer;
    },
  };
  class Tachometer {
    resetMode(value: number) { events.push(["reset-tachometer", value]); }
  }
  const physics = {
    cancelControls() { events.push(["cancel-controls"]); },
    handleDrivingCommand(command: { kind: string }, snapshot: unknown) {
      events.push(["physics-command", command.kind, snapshot]);
    },
    startRaceBooster() { events.push(["race-booster"]); },
    startPlayBooster(snapshot: unknown) { events.push(["play-booster", snapshot]); },
  };
  const host: DrivingInputBridgeHost["host"] = {
    input: { drain() {
      events.push(["drain"]);
      return { cancelled: mode.cancelled ?? false,
        transitions: [{ sourceKind: "keyboard", down: true,
          action: "forward" }] };
    } },
    drivingInput: {
      cancel() { events.push(["cancel-driving"]); },
      snapshot() { events.push(["snapshot"]); return { held: true }; },
      dispatch(transitions, accept) {
        events.push(["dispatch", transitions]);
        for (const transition of transitions) accept(transition, "state");
      },
    },
    autoForward: {
      cancel() { events.push(["cancel-auto"]); },
      setRaceState(active, moving) { events.push(["race-state", active, moving]); },
      dispatch(transition, state, snapshot, accept) {
        events.push(["auto-dispatch", transition, state, snapshot]);
        accept({ kind: transition.action === "forward"
          ? "forward-down" : "reverse-down" });
      },
      isActive(snapshot) { events.push(["auto-active", snapshot]); return true; },
      setEnabled(enabled) { events.push(["auto-enabled", enabled]); },
      apply(snapshot) { events.push(["auto-apply", snapshot]);
        return { ...snapshot, auto: true }; },
    },
    nitroSeamless: {
      cancel() { events.push(["cancel-nitro"]); },
      setMode(value) { events.push(["nitro-mode", value]); },
      press(owner, snapshot, nowMs) {
        events.push(["nitro-press", owner === physics, snapshot, nowMs]);
        return mode.nitroPressed ?? false;
      },
    },
    gamepad: {
      reset() { events.push(["gamepad-reset"]); },
      poll(pads, mapping) {
        events.push(["gamepad-poll", pads, mapping]);
        return mode.gamepad ? [{ sourceKind: "gamepad", down: true,
          action: "forward" }] : [];
      },
    },
    getPhysics() { events.push(["get-physics"]); return physics; },
    getLampFlares() { events.push(["get-lamps"]); return {
      resetInputVisibility() { events.push(["lamps-reset"]); },
      setInputPair(which, down) { events.push(["lamp-input", which, down]); },
    }; },
    getLifecycle() { events.push(["get-lifecycle"]); return lifecycle; },
    getGamepadPads() { events.push(["pads"]); return "pads"; },
    getGamepadMap() { events.push(["pad-map"]); return "map"; },
    resumeGamepadAutoForward() { events.push(["resume-auto"]); },
    getTachometer() { events.push(["get-tachometer"]);
      return mode.tachometer === false ? {} : new Tachometer(); },
    handleSpeedReset(allow) { events.push(["speed-reset", allow]); },
  };
  const Original = new Function("t60", "e60", "Ne", "l2", "fv",
    `${originalClass}\nreturn n60;`)(
      dependencies.activeRace, dependencies.acceptsTimeAttackInput,
      { Racing: dependencies.racingPhase },
      { Forward: dependencies.forwardAction }, Tachometer,
    ) as new (owner: DrivingInputBridgeHost["host"]) => Bridge;
  const bridge = new Original(host);
  if (rewritten) Object.assign(bridge, {
    drainDrivingInput(nowMs: number, inputTime: number) {
      return drainTimeAttackDrivingInput(bridge, nowMs, inputTime, dependencies);
    },
    handleDrivingCommand(command: { kind: string }, nowMs: number,
      inputTime: number) {
      return routeTimeAttackDrivingCommand(bridge, command, nowMs,
        inputTime, dependencies);
    },
    setAutoForwardEnabled(enabled: boolean) {
      return setTimeAttackAutoForward(bridge, enabled);
    },
    setNitroSeamlessMode(value: unknown) {
      return setTimeAttackNitroSeamlessMode(bridge, value);
    },
    getDrivingSnapshot() { return timeAttackDrivingSnapshot(bridge); },
    handleBaseDrivingCommand(command: { kind: string }) {
      return routeBaseDrivingCommand(bridge, command);
    },
    handleTimeAttackDrivingCommand(command: { kind: string }, nowMs: number,
      inputTime: number) {
      return routeTimeAttackRaceCommand(bridge, command, nowMs,
        inputTime, dependencies);
    },
    resetTacho1InputMode(inputTime: number) {
      return resetTimeAttackTachometerInput(bridge, inputTime, dependencies);
    },
  });
  return { bridge, events };
}

test("input drain cancellation, auto-forward and gamepad mixing match release", () => {
  for (const mode of [
    {}, { cancelled: true }, { gamepad: true },
    { cancelled: true, gamepad: true, boosterWindow: true },
    { racing: false, active: false, accepts: false },
  ]) {
    const inspect = (rewritten: boolean) => {
      const { bridge, events } = makeBridge(rewritten, mode);
      bridge.drainDrivingInput(1200, 99);
      return events;
    };
    assert.deepEqual(inspect(true), inspect(false), JSON.stringify(mode));
  }
});

test("all race driving command branches and readiness gates match release", () => {
  const commands = ["drift-start", "drift-stop", "forward-down", "forward-up",
    "reverse-down", "reverse-up", "reset", "instant-acceleration",
    "use-item-or-booster", "reorder-items", "unknown"];
  for (const mode of [
    {}, { racing: false }, { accepts: false },
    { boosterWindow: true, nitroPressed: true, tachometer: false },
  ]) {
    const inspect = (rewritten: boolean) => {
      const { bridge, events } = makeBridge(rewritten, mode);
      for (const kind of commands) {
        bridge.handleDrivingCommand({ kind }, 1000, -1.4);
      }
      bridge.setAutoForwardEnabled(false);
      bridge.setAutoForwardEnabled(true);
      bridge.setNitroSeamlessMode("hold");
      return { events, snapshot: bridge.getDrivingSnapshot() };
    };
    assert.deepEqual(inspect(true), inspect(false), JSON.stringify(mode));
  }
});
