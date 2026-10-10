export interface GameplayTransition {
  source: string;
  sourceKind: "keyboard" | "touch" | "gamepad";
  action: number;
  down: boolean;
}

type KeyboardRecord = { code: string; down: boolean };
type TouchRecord = { action: number; down: boolean };

export interface GameplayInputDependencies<KeyMap> {
  keyMap: KeyMap;
  resolveActions(code: string, keyMap: KeyMap): number[];
  editableTarget(target: EventTarget | null): boolean;
}

/** Keep gameplay hotkeys away from text fields and contenteditable controls. */
export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    ? target.isContentEditable ||
      target.matches("input, textarea, select, [contenteditable='true']")
    : false;
}

/** Records keyboard/touch edges until the next simulation frame drains them. */
export class GameplayInputQueue<KeyMap = unknown> {
  records: Array<KeyboardRecord | TouchRecord> = [];
  keyboardRecordCount = 0;
  transitions: GameplayTransition[] = [];
  releasedKeys = new Set<string>();
  keyboardActions = new Set<number>();
  touchActions = new Set<number>();
  cancelled = false;
  enabled = true;
  keyMap: KeyMap;
  readonly resolveActions: GameplayInputDependencies<KeyMap>["resolveActions"];
  readonly editableTarget: GameplayInputDependencies<KeyMap>["editableTarget"];

  constructor(dependencies: GameplayInputDependencies<KeyMap>) {
    this.keyMap = dependencies.keyMap;
    this.resolveActions = dependencies.resolveActions;
    this.editableTarget = dependencies.editableTarget;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: false });
    document.addEventListener("focusin", this.onFocusIn);
  }

  drain(overrides?: Record<string, number[]>): { transitions: GameplayTransition[]; cancelled: boolean } {
    for (const record of this.records.splice(0)) {
      if ("code" in record) {
        const source = `keyboard:${record.code}`;
        for (const action of overrides?.[record.code] ??
          this.resolveActions(record.code, this.keyMap)) {
          this.append(source, action, record.down);
        }
      } else {
        this.applyTouchAction(record.action, record.down);
      }
    }
    this.keyboardRecordCount = 0;
    const transitions = this.transitions.splice(0);
    const cancelled = this.cancelled;
    this.cancelled = false;
    return { transitions, cancelled };
  }

  get isEnabled(): boolean { return this.enabled; }

  setKeyMap(keyMap: KeyMap): void { this.keyMap = keyMap; }

  setTouchAction(action: number, down: boolean): void {
    if (this.enabled) this.records.push({ action, down });
  }

  applyTouchAction(action: number, down: boolean): void {
    if (this.touchActions.has(action) === down) return;
    if (down) this.touchActions.add(action);
    else this.touchActions.delete(action);
    if (!this.keyboardActions.has(action)) {
      this.transitions.push({ source: `touch:${action}`, sourceKind: "touch", action, down });
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled !== enabled) {
      this.enabled = enabled;
      if (!enabled) this.cancelAll();
    }
  }

  cancelAll(): void {
    this.cancelGameplayInput();
    this.releasedKeys.clear();
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("focusin", this.onFocusIn);
    this.enabled = false;
    this.cancelAll();
  }

  onKeyDown = (event: KeyboardEvent): void => {
    const repeated = this.isKeyboardRepeat(event);
    if (!this.enabled || this.editableTarget(event.target)) return;
    if (this.resolveActions(event.code, this.keyMap).length > 0) event.preventDefault();
    if (!repeated) this.appendKeyboardRecord(event.code, true);
  };

  onKeyUp = (event: KeyboardEvent): void => {
    this.releasedKeys.add(event.code);
    if (!this.enabled || this.editableTarget(event.target)) return;
    if (this.resolveActions(event.code, this.keyMap).length > 0) event.preventDefault();
    this.appendKeyboardRecord(event.code, false);
  };

  onFocusIn = (event: FocusEvent): void => {
    if (this.editableTarget(event.target)) this.cancelGameplayInput();
  };

  isKeyboardRepeat(event: KeyboardEvent): boolean {
    const wasReleased = this.releasedKeys.delete(event.code);
    return event.repeat && !wasReleased;
  }

  cancelGameplayInput(): void {
    this.records.length = 0;
    this.keyboardRecordCount = 0;
    this.transitions.length = 0;
    this.keyboardActions.clear();
    this.touchActions.clear();
    this.cancelled = true;
  }

  appendKeyboardRecord(code: string, down: boolean): void {
    if (this.keyboardRecordCount === 31) {
      this.records.splice(this.records.findIndex(record => "code" in record), 1);
    } else {
      this.keyboardRecordCount++;
    }
    this.records.push({ code, down });
  }

  append(source: string, action: number, down: boolean): void {
    if (down) this.keyboardActions.add(action);
    else this.keyboardActions.delete(action);
    if (this.touchActions.has(action)) return;
    this.transitions.push({ source, sourceKind: "keyboard", action, down });
  }
}
