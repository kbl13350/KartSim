import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { AutoForwardAssist } from "./auto-forward";
import { GamepadEdgePoller } from "./gamepad-edges";
import { NitroSeamlessQueue } from "./nitro-seamless";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function between(start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first);
  return source.slice(first, last);
}

test("touch auto-forward and keyboard takeover match Xl0", () => {
  const Original = new Function(`${between("class Xl0 {", "const Yl0 = 200;")}; return Xl0;`)() as typeof AutoForwardAssist;
  const run = (Forward: typeof AutoForwardAssist) => {
    const forward = new Forward();
    const emitted: unknown[] = [];
    const states: unknown[] = [];
    const capture = (label: string, reverse = 0) => states.push({ label,
      enabled: forward.enabled, armed: forward.armed, ready: forward.ready,
      engaged: forward.isEngaged(), active: forward.isActive({ forward: 0, reverse }),
      applied: forward.apply({ forward: 0, reverse, marker: "same" }),
      emitted: [...emitted],
    });
    const emit = (effect: unknown) => emitted.push(effect);
    capture("initial");
    forward.setEnabled(true);
    forward.setRaceState(true, true);
    forward.dispatch({ kind: "forward-down" }, { source: "touch:2", sourceKind: "touch",
      action: 2, down: true }, { forward: 0, reverse: 0 }, emit);
    capture("touch-press");
    forward.dispatch({ kind: "forward-up" }, { source: "touch:2", sourceKind: "touch",
      action: 2, down: false }, { forward: 0, reverse: 0 }, emit);
    capture("touch-release");
    forward.dispatch({ kind: "reverse-down" }, { source: "touch:3", sourceKind: "touch",
      action: 3, down: true }, { forward: 0, reverse: 1 }, emit);
    capture("reverse", 1);
    forward.dispatch({ kind: "forward-down" }, { source: "keyboard:KeyW",
      sourceKind: "keyboard", action: 2, down: true }, { forward: 0, reverse: 0 }, emit);
    capture("keyboard-takeover");
    forward.setRaceState(false, false); capture("race-stop");
    forward.setEnabled(false); capture("disabled");
    return states;
  };
  assert.deepEqual(run(AutoForwardAssist), run(Original));
});

test("manual nitro grace window and wraparound match Zl0", () => {
  const Original = new Function(`${between("const Yl0 = 200;", "class Ql0 {")}; return Zl0;`)() as typeof NitroSeamlessQueue;
  const run = (Nitro: typeof NitroSeamlessQueue) => {
    const nitro = new Nitro();
    const calls: string[] = [];
    let available = false;
    const vehicle = {
      tryConsumeNormalBooster: () => { calls.push("consume"); return available; },
      cancelNitroSeamless: () => calls.push("cancel"),
      queueNitroSeamless: () => calls.push("queue"),
    };
    const states: unknown[] = [];
    const capture = (label: string, result?: unknown) => states.push({ label, result,
      mode: nitro.getMode(), buffered: nitro.buffered, bufferedAtMs: nitro.bufferedAtMs,
      calls: [...calls],
    });
    capture("off-press", nitro.press(vehicle, {}, 100));
    nitro.update(vehicle, 100); capture("off-update");
    nitro.setMode("manual");
    capture("buffered-press", nitro.press(vehicle, {}, 100.9));
    nitro.update(vehicle, 299); capture("within-window");
    nitro.update(vehicle, 301); capture("expired");
    available = true;
    capture("consumed", nitro.press(vehicle, {}, 500));
    nitro.setMode("auto"); nitro.update(vehicle, 500); capture("auto");
    nitro.setMode("manual"); available = false;
    nitro.press(vehicle, {}, 0xfffffff0);
    nitro.update(vehicle, 0x100000010); capture("wrapped-clock");
    nitro.cancel(); capture("cancelled");
    return states;
  };
  assert.deepEqual(run(NitroSeamlessQueue), run(Original));
});

test("gamepad press/release edges, disabled state and unmapped controls match Ql0", () => {
  const bindings = [{ index: 0, action: 2 }, { index: 1, action: 4 },
    { index: 2, action: 5 }, { index: 3, action: 11 }];
  const pressedControls = (values: number[]) => new Set(values);
  const Original = new Function("Hg", "ut", "Ga", `${between("class Ql0 {", "var Ne =")}; return Ql0;`)(
    pressedControls, bindings, -1) as new () => GamepadEdgePoller<number[]>;
  const run = (released: boolean) => {
    const poller = released ? new Original() : new GamepadEdgePoller({
      pressedControls, bindings, unmappedControl: -1,
    });
    const map = [0, 1, -1, 3];
    const states: unknown[] = [];
    const capture = (label: string, events: unknown) => states.push({ label, events,
      enabled: poller.enabled, previous: [...poller.previous] });
    capture("first", poller.poll([0, 1], map));
    capture("held", poller.poll([0, 1], map));
    capture("released", poller.poll([1, 3], map));
    poller.setEnabled(false); capture("disabled", poller.poll([0], map));
    poller.setEnabled(true); capture("re-enabled", poller.poll([0, 3], map));
    poller.reset(); capture("reset", poller.poll([], map));
    return states;
  };
  assert.deepEqual(run(false), run(true));
});
