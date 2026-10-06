import { DrivingAction } from "./driving-input";

export interface ActionBinding {
  index: number;
  action: number;
  defaultKeyCode: number;
}

/** The client's 22 configurable keyboard and gamepad action slots. */
export const actionBindings: readonly ActionBinding[] = [
  { index: 0, action: DrivingAction.SteerLeft, defaultKeyCode: 203 },
  { index: 1, action: DrivingAction.SteerRight, defaultKeyCode: 205 },
  { index: 2, action: DrivingAction.Forward, defaultKeyCode: 200 },
  { index: 3, action: DrivingAction.Reverse, defaultKeyCode: 208 },
  { index: 4, action: DrivingAction.Drift, defaultKeyCode: 42 },
  { index: 5, action: DrivingAction.UseItemOrBooster, defaultKeyCode: 29 },
  { index: 6, action: DrivingAction.ReorderItems, defaultKeyCode: 56 },
  { index: 7, action: DrivingAction.SecondaryItem, defaultKeyCode: 44 },
  { index: 8, action: DrivingAction.GaugeState, defaultKeyCode: 57 },
  { index: 9, action: DrivingAction.Reset, defaultKeyCode: 19 },
  { index: 10, action: DrivingAction.SteerLeft, defaultKeyCode: 75 },
  { index: 11, action: DrivingAction.SteerRight, defaultKeyCode: 77 },
  { index: 12, action: DrivingAction.Forward, defaultKeyCode: 72 },
  { index: 13, action: DrivingAction.Reverse, defaultKeyCode: 80 },
  { index: 14, action: DrivingAction.Drift, defaultKeyCode: 54 },
  { index: 15, action: DrivingAction.UseItemOrBooster, defaultKeyCode: 157 },
  { index: 16, action: DrivingAction.ReorderItems, defaultKeyCode: 184 },
  { index: 18, action: DrivingAction.ModeImpulsePositive, defaultKeyCode: 44 },
  { index: 19, action: DrivingAction.ModeImpulseNegative, defaultKeyCode: 45 },
  { index: 20, action: DrivingAction.GaugeState, defaultKeyCode: 45 },
  { index: 21, action: DrivingAction.DisplayMode, defaultKeyCode: 23 },
  { index: 22, action: DrivingAction.Help, defaultKeyCode: 59 },
];

export type KeyMap = Record<number, number>;

export function defaultKeyMap(bindings: readonly ActionBinding[] = actionBindings): KeyMap {
  return Object.fromEntries(bindings.map(({ index, defaultKeyCode }) => [index, defaultKeyCode]));
}

export const DEFAULT_KEY_MAP = defaultKeyMap();

/** Browser KeyboardEvent.code to the original client's keyboard scan code. */
const scanCodeByBrowserCode: Record<string, number> = {
  Escape: 1,
  Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6,
  Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11,
  Minus: 12, Equal: 13, Backspace: 14, Tab: 15,
  KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20,
  KeyY: 21, KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25,
  BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
  KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34,
  KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38,
  Semicolon: 39, Quote: 40, Backquote: 41, ShiftLeft: 42,
  Backslash: 43, KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47,
  KeyB: 48, KeyN: 49, KeyM: 50,
  Comma: 51, Period: 52, Slash: 53, ShiftRight: 54,
  NumpadMultiply: 55, AltLeft: 56, Space: 57, CapsLock: 58,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63,
  F6: 64, F7: 65, F8: 66, F9: 67, F10: 68,
  NumLock: 69, ScrollLock: 70,
  Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74,
  Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78,
  Numpad1: 79, Numpad2: 80, Numpad3: 81,
  Numpad0: 82, NumpadDecimal: 83,
  F11: 87, F12: 88, F13: 100, F14: 101, F15: 102,
  KanaMode: 112, Convert: 121, NonConvert: 123, IntlYen: 125,
  NumpadEqual: 141, NumpadEnter: 156, ControlRight: 157,
  NumpadComma: 179, NumpadDivide: 181, PrintScreen: 183,
  AltRight: 184, Pause: 197,
  Home: 199, ArrowUp: 200, PageUp: 201,
  ArrowLeft: 203, ArrowRight: 205, End: 207,
  ArrowDown: 208, PageDown: 209, Insert: 210, Delete: 211,
  MetaLeft: 219, MetaRight: 220, ContextMenu: 221, Power: 222, Sleep: 223,
};

export function browserScanCode(code: string): number | undefined {
  return scanCodeByBrowserCode[code];
}

/** One physical key may trigger multiple bound action slots. */
export function keyboardActionsForCode(
  code: string,
  keyMap: KeyMap = DEFAULT_KEY_MAP,
  bindings: readonly ActionBinding[] = actionBindings,
): number[] {
  const scanCode = browserScanCode(code);
  return scanCode === undefined ? []
    : bindings.filter(({ index }) => keyMap[index] === scanCode).map(({ action }) => action);
}
