import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DrivingAction } from "./driving-input";
import {
  actionBindings, browserScanCode, defaultKeyMap, keyboardActionsForCode,
} from "./action-bindings";
import { gamepadAxisControl, pressedGamepadControls, type GamepadState } from "./gamepad-controls";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function sourceBetween(start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first, `missing release source: ${start}`);
  return source.slice(first, last);
}

const bindingDeclaration = sourceBetween("const ut = [", "  MP = {").trim().replace(/,\s*$/, ";");
const releasedBindings = new Function("l2", `${bindingDeclaration} return { ut, Br };`)(DrivingAction) as {
  ut: typeof actionBindings;
  Br: Record<number, number>;
};
const keyCodeDeclaration = sourceBetween("  ea0 = {", "function xP(n) {").trim();
const releasedCodeMap = new Function(`const ${keyCodeDeclaration} return ea0;`)() as Record<string, number>;
const releaseActions = new Function("ut", "Br", "ea0", `
  function xP(code) { return ea0[code]; }
  ${sourceBetween("function xl(n, e = Br) {", "const Kl0 = 31;")}
  return xl;
`)(releasedBindings.ut, releasedBindings.Br, releasedCodeMap) as
  (code: string, keyMap?: Record<number, number>) => number[];

test("action slots, default keys and browser scan codes match the release", () => {
  assert.deepEqual(actionBindings, releasedBindings.ut);
  assert.deepEqual(defaultKeyMap(), releasedBindings.Br);
  for (const code of [...Object.keys(releasedCodeMap), "Unidentified", "GamepadButton1"]) {
    assert.equal(browserScanCode(code), releasedCodeMap[code], code);
    assert.deepEqual(keyboardActionsForCode(code), releaseActions(code), code);
  }
  const remapped = { ...defaultKeyMap(), 0: 44, 1: 44, 2: 57, 3: 57 };
  for (const code of ["KeyZ", "Space", "ArrowLeft", "KeyW", "Unidentified"]) {
    assert.deepEqual(keyboardActionsForCode(code, remapped), releaseActions(code, remapped), code);
  }
});

const releasedGamepad = new Function("ut", `
  ${sourceBetween("const Ga = -1,", "function aa0(n) {")}
  return { Hg, v6 };
`)(releasedBindings.ut) as {
  Hg(gamepads: Array<GamepadState | null | undefined>): Set<number>;
  v6(axis: number, value: number): number;
};

test("gamepad button and axis thresholds match the release", () => {
  for (const axis of [0, 1, 7]) {
    for (const direction of [-1, 1]) {
      assert.equal(gamepadAxisControl(axis, direction), releasedGamepad.v6(axis, direction));
    }
  }
  const makeGamepad = (connected: boolean, values: number[], axes: number[], pressed = -1): GamepadState => ({
    connected,
    buttons: values.map((value, index) => ({ value, pressed: index === pressed })),
    axes,
  });
  const cases: Array<Array<GamepadState | null | undefined>> = [
    [],
    [null, undefined],
    [makeGamepad(false, [1, 1], [-1, 1])],
    [makeGamepad(true, [0.49, 0.5, 0], [-0.49, -0.5, 0.5], 2)],
    [makeGamepad(true, [0, 0.9], [1, 0]), makeGamepad(true, [0.8], [-1, 0.49])],
  ];
  for (const gamepads of cases) {
    assert.deepEqual(pressedGamepadControls(gamepads), releasedGamepad.Hg(gamepads));
  }
});
