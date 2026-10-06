export const UNMAPPED_GAMEPAD_CONTROL = -1;

export interface GamepadButtonState {
  pressed: boolean;
  value: number;
}

export interface GamepadState {
  connected: boolean;
  buttons: readonly GamepadButtonState[];
  axes: readonly number[];
}

/** Axis controls occupy pairs of IDs above the first 64 button IDs. */
export function gamepadAxisControl(axis: number, value: number): number {
  return 64 + axis * 2 + (value < 0 ? 0 : 1);
}

/** Read all currently pressed buttons and half-depressed axis directions. */
export function pressedGamepadControls(
  gamepads: Iterable<GamepadState | null | undefined>,
): Set<number> {
  const pressed = new Set<number>();
  for (const gamepad of gamepads) {
    if (!gamepad?.connected) continue;
    gamepad.buttons.forEach((button, index) => {
      if (button.pressed || button.value >= 0.5) pressed.add(index);
    });
    gamepad.axes.forEach((axis, index) => {
      if (axis <= -0.5) pressed.add(gamepadAxisControl(index, -1));
      if (axis >= 0.5) pressed.add(gamepadAxisControl(index, 1));
    });
  }
  return pressed;
}
