import { gamepadAxisControl, UNMAPPED_GAMEPAD_CONTROL } from "../input/gamepad-controls";
import { SWITCH_BUILD } from "./platform";

/**
 * Brewser's Gamepad API (runtime/shims/gamepad-shim.js) reports a Joy-Con
 * pair or Pro Controller in standard order with the physical Switch labels:
 * 0 A, 1 B, 2 X, 3 Y, 4 L, 5 R, 6 ZL, 7 ZR, 8 −, 9 +, 10 left stick click,
 * 11 right stick click, 12–15 D-pad up/down/left/right; axis 0/1 is the left
 * stick (up is negative).
 */
export const SwitchButton = {
  A: 0, B: 1, X: 2, Y: 3, L: 4, R: 5, ZL: 6, ZR: 7, Minus: 8, Plus: 9,
  LeftStick: 10, RightStick: 11, Up: 12, Down: 13, Left: 14, Right: 15,
} as const;

/**
 * The Switch defaults, by action slot (input/action-bindings.ts): stick or
 * D-pad steers, ZR (or A) drives, ZL (or D-pad down) reverses, B drifts,
 * Y uses the item or booster, X reorders items, R the second item, L the
 * gauge key, the stick clicks reset the kart and change the view. + pauses
 * (switch-input.ts sends Escape). Players can change any of them in 设置.
 */
const SWITCH_GAMEPAD_DEFAULTS: Readonly<Record<number, number>> = {
  0: gamepadAxisControl(0, -1),
  1: gamepadAxisControl(0, 1),
  2: SwitchButton.ZR,
  3: SwitchButton.ZL,
  4: SwitchButton.B,
  5: SwitchButton.Y,
  6: SwitchButton.X,
  7: SwitchButton.R,
  8: SwitchButton.L,
  9: SwitchButton.LeftStick,
  10: SwitchButton.Left,
  11: SwitchButton.Right,
  12: SwitchButton.A,
  13: SwitchButton.Down,
  21: SwitchButton.RightStick,
};

/** The release defaults on the web; the Joy-Con layout above in the Switch build. */
export function platformDefaultGamepadMap<Binding extends { index: number }>(
  bindings: readonly Binding[], releaseControl: (binding: Binding) => number,
): Record<number, number> {
  return Object.fromEntries(bindings.map(binding => [binding.index,
    SWITCH_BUILD ? SWITCH_GAMEPAD_DEFAULTS[binding.index] ?? UNMAPPED_GAMEPAD_CONTROL : releaseControl(binding)]));
}
