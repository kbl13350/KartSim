import type { GameplayTransition } from "./gameplay-input-queue";

export interface GamepadActionBinding { index: number; action: number }

export interface GamepadEdgeDependencies<GamepadState, KeyMap extends Array<number>> {
  pressedControls(gamepad: GamepadState): Set<number>;
  bindings: readonly GamepadActionBinding[];
  unmappedControl: number;
}

/** Emits button edge transitions from the current gamepad snapshot. */
export class GamepadEdgePoller<GamepadState = unknown, KeyMap extends Array<number> = number[]> {
  previous = new Set<number>();
  enabled = true;

  constructor(readonly dependencies: GamepadEdgeDependencies<GamepadState, KeyMap>) {}

  setEnabled(enabled: boolean): void {
    if (this.enabled !== enabled) {
      this.enabled = enabled;
      if (!enabled) this.reset();
    }
  }

  reset(): void { this.previous.clear(); }

  poll(gamepad: GamepadState, keyMap: KeyMap): GameplayTransition[] {
    const pressed = this.enabled ? this.dependencies.pressedControls(gamepad) : new Set<number>();
    const transitions: GameplayTransition[] = [];
    for (const binding of this.dependencies.bindings) {
      const control = keyMap[binding.index];
      if (control === undefined || control === this.dependencies.unmappedControl) continue;
      const before = this.previous.has(control);
      const now = pressed.has(control);
      if (before !== now) transitions.push({
        source: `gamepad:${control}`, sourceKind: "gamepad", action: binding.action, down: now,
      });
    }
    this.previous = pressed;
    return transitions;
  }
}
