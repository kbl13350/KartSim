/** Action IDs used by the downloaded client and its recorded input events. */
export const DrivingAction = {
  SteerLeft: 0,
  SteerRight: 1,
  Forward: 2,
  Reverse: 3,
  Drift: 4,
  UseItemOrBooster: 5,
  ReorderItems: 6,
  SecondaryItem: 7,
  GaugeState: 8,
  DisplayMode: 9,
  Help: 10,
  Reset: 11,
  ModeImpulsePositive: 25,
  ModeImpulseNegative: 26,
} as const;

export interface DrivingInputEvent {
  action: number;
  down: boolean;
  [metadata: string]: unknown;
}

export type DrivingInputEffect =
  | { kind: "forward-down" | "forward-up" | "reverse-down" | "reverse-up" }
  | { kind: "drift-start"; direction: 1 | -1 }
  | { kind: "drift-stop"; active: boolean }
  | { kind: "use-item-or-booster" | "reorder-items" | "reset" | "instant-acceleration" }
  | { kind: "unsupported-action"; action: number; down: boolean };

export interface DrivingInputSnapshot {
  forward: number;
  reverse: number;
  steer: number;
  rawSteer: number;
  steeringInverted: boolean;
  rawDriftHeld: boolean;
  derivedDriftHeld: boolean;
  actionMarkerWord: number;
}

export type DrivingInputReporter = (effect: DrivingInputEffect, source: DrivingInputEvent) => void;

/** Set one bit of a mutually exclusive pair while clearing its opposite. */
export function setActionBits(word: number, onBit: number, offBit: number, enabled: boolean): number {
  return enabled ? (word & ~offBit) | onBit : (word & ~onBit) | offBit;
}

/**
 * Combines key/button edges into the snapshot consumed by the driving physics.
 * A snapshot reuses one object, matching the released client's allocation pattern.
 */
export class DrivingInputAccumulator {
  leftHeld = false;
  rightHeld = false;
  rawDriftHeld = false;
  derivedDriftHeld = false;
  driftStartedThisHold = false;
  forwardSource = 0;
  reverseSource = 0;
  rawSteer = 0;
  swapForwardReverse = false;
  invertSteering = false;
  actionMarkerWord = 0;
  forwardBatchGate = false;
  forwardBatchDown = false;
  driftPressCount = 0;
  driftReleaseMarker = false;

  readonly snapshotView: DrivingInputSnapshot = {
    forward: 0,
    reverse: 0,
    steer: 0,
    rawSteer: 0,
    steeringInverted: false,
    rawDriftHeld: false,
    derivedDriftHeld: false,
    actionMarkerWord: 0,
  };

  dispatch(events: Iterable<DrivingInputEvent>, report: DrivingInputReporter = () => {}): number {
    let consumed = 0;
    for (const event of events) {
      consumed += 1;
      if (event.action === DrivingAction.Forward) {
        this.forwardBatchDown = event.down;
        if (this.forwardBatchGate) {
          if (event.down) this.forwardBatchGate = false;
          else this.forwardBatchDown = true;
          break;
        }
      }
      this.dispatchOne(event, report);
    }
    return consumed;
  }

  cancel(): void {
    this.leftHeld = false;
    this.rightHeld = false;
    this.rawDriftHeld = false;
    this.derivedDriftHeld = false;
    this.driftStartedThisHold = false;
    this.forwardSource = 0;
    this.reverseSource = 0;
    this.actionMarkerWord = setActionBits(this.actionMarkerWord, 1, 2, false);
    this.actionMarkerWord = setActionBits(this.actionMarkerWord, 4, 8, false);
    this.setRawSteer(0);
  }

  snapshot(): DrivingInputSnapshot {
    const view = this.snapshotView;
    view.forward = this.swapForwardReverse ? this.reverseSource : this.forwardSource;
    view.reverse = this.swapForwardReverse ? this.forwardSource : this.reverseSource;
    view.steer = this.rawSteer * (this.invertSteering ? -1 : 1);
    view.rawSteer = this.rawSteer;
    view.steeringInverted = this.invertSteering;
    view.rawDriftHeld = this.rawDriftHeld;
    view.derivedDriftHeld = this.derivedDriftHeld;
    view.actionMarkerWord = this.actionMarkerWord;
    return view;
  }

  setForwardReverseSwap(enabled: boolean): void {
    this.swapForwardReverse = enabled;
  }

  setSteeringInverted(enabled: boolean): void {
    this.invertSteering = enabled;
  }

  setForwardBatchGate(enabled: boolean): void {
    this.forwardBatchGate = enabled;
  }

  getForwardBatchState(): { gate: boolean; down: boolean } {
    return { gate: this.forwardBatchGate, down: this.forwardBatchDown };
  }

  getDriftEdgeMetadata(): { pressCount: number; released: boolean } {
    return { pressCount: this.driftPressCount, released: this.driftReleaseMarker };
  }

  dispatchOne(event: DrivingInputEvent, report: DrivingInputReporter): void {
    switch (event.action) {
      case DrivingAction.SteerLeft:
        if (event.down) {
          this.setRawSteer(1);
          this.leftHeld = true;
        } else {
          this.leftHeld = false;
          this.setRawSteer(this.rightHeld ? -1 : 0);
        }
        this.updateDriftChord(event.down, report, event);
        return;
      case DrivingAction.SteerRight:
        if (event.down) {
          this.setRawSteer(-1);
          this.rightHeld = true;
        } else {
          this.rightHeld = false;
          this.setRawSteer(this.leftHeld ? 1 : 0);
        }
        this.updateDriftChord(event.down, report, event);
        return;
      case DrivingAction.Forward:
        this.forwardSource = event.down ? 1 : 0;
        this.actionMarkerWord = setActionBits(this.actionMarkerWord, 1, 2, event.down);
        report({ kind: event.down ? "forward-down" : "forward-up" }, event);
        return;
      case DrivingAction.Reverse:
        this.reverseSource = event.down ? 1 : 0;
        this.actionMarkerWord = setActionBits(this.actionMarkerWord, 4, 8, event.down);
        report({ kind: event.down ? "reverse-down" : "reverse-up" }, event);
        return;
      case DrivingAction.Drift:
        this.rawDriftHeld = event.down;
        if (event.down) {
          this.driftPressCount = (this.driftPressCount + 1) & 0xffff;
          this.driftReleaseMarker = false;
        } else {
          this.driftReleaseMarker = true;
          this.driftStartedThisHold = false;
        }
        this.updateDriftChord(event.down, report, event);
        return;
      case DrivingAction.UseItemOrBooster:
        if (event.down) report({ kind: "use-item-or-booster" }, event);
        return;
      case DrivingAction.ReorderItems:
        if (event.down) report({ kind: "reorder-items" }, event);
        return;
      case DrivingAction.Reset:
        if (event.down) report({ kind: "reset" }, event);
        return;
      case DrivingAction.GaugeState:
        if (event.down) report({ kind: "instant-acceleration" }, event);
        return;
      default:
        report({ kind: "unsupported-action", action: event.action, down: event.down }, event);
    }
  }

  updateDriftChord(pressed: boolean, report: DrivingInputReporter, source: DrivingInputEvent): void {
    if (pressed) {
      if (!this.rawDriftHeld || this.rawSteer === 0 || this.driftStartedThisHold) return;
      this.driftStartedThisHold = true;
      this.derivedDriftHeld = true;
      report({ kind: "drift-start", direction: this.rawSteer > 0 ? 1 : -1 }, source);
      return;
    }
    this.derivedDriftHeld = this.rawDriftHeld;
    report({ kind: "drift-stop", active: this.rawDriftHeld }, source);
  }

  setRawSteer(direction: number): void {
    this.rawSteer = direction;
    if (direction > 0) {
      this.actionMarkerWord = setActionBits(this.actionMarkerWord, 16, 32, true);
      this.actionMarkerWord = setActionBits(this.actionMarkerWord, 64, 128, false);
    } else if (direction < 0) {
      this.actionMarkerWord = setActionBits(this.actionMarkerWord, 64, 128, true);
      this.actionMarkerWord = setActionBits(this.actionMarkerWord, 16, 32, false);
    } else {
      this.actionMarkerWord = setActionBits(this.actionMarkerWord, 16, 32, false);
      this.actionMarkerWord = setActionBits(this.actionMarkerWord, 64, 128, false);
    }
  }
}

// Compatibility names for the generated modules while callers are migrated.
export { DrivingAction as l2, DrivingInputAccumulator as sG, setActionBits as Nt };
