import { DrivingAction } from "./driving-input";

/**
 * Item-race (道具赛) key commands. Ctrl press and release are separate so the
 * controller can aim while the key is held (rocket, magnet) and fire on
 * release; `cancel` drops an aim without firing (window blur, result screen).
 * Alt asks the server to swap the first two slots and Z to change slot 0.
 */
export type ItemCommand =
  | { kind: "use"; phase: "press" | "release" | "cancel" }
  | { kind: "swap" }
  | { kind: "change" };

/** Receives item commands; the local race owner exposes it as `items`. */
export interface ItemCommandHandler {
  handleCommand(command: ItemCommand, nowMs: number): void;
}

export interface ItemInputTransition {
  action: number;
  down: boolean;
}

export interface ItemInputSink {
  /** Only while racing do presses, swaps and changes become commands. */
  racing: boolean;
  command(command: ItemCommand): void;
  /** A left or right press, used to break out of a water bubble. */
  escape(): void;
}

const itemActions: ReadonlySet<number> = new Set([
  DrivingAction.UseItemOrBooster, DrivingAction.ReorderItems, DrivingAction.SecondaryItem,
]);

export function isItemAction(action: number): boolean {
  return itemActions.has(action);
}

/**
 * Splits a drained input batch for item races. Item keys are taken out so they
 * never reach the nitro and slot-reorder commands of speed races; every other
 * transition is returned unchanged and in order for the driving accumulator.
 */
export class ItemInputRouter {
  /** Physical sources (keys, touch, gamepad) currently holding the use action. */
  useHeld = 0;

  route<T extends ItemInputTransition>(transitions: readonly T[], sink: ItemInputSink): T[] {
    const driving: T[] = [];
    for (const transition of transitions) {
      if (!isItemAction(transition.action)) {
        if (transition.down && (transition.action === DrivingAction.SteerLeft ||
            transition.action === DrivingAction.SteerRight)) sink.escape();
        driving.push(transition);
        continue;
      }
      if (transition.action === DrivingAction.UseItemOrBooster) {
        this.routeUse(transition.down, sink);
      } else if (transition.down && sink.racing) {
        sink.command(transition.action === DrivingAction.ReorderItems
          ? { kind: "swap" } : { kind: "change" });
      }
    }
    return driving;
  }

  /** Drop a held use key without firing (input cancelled or driving stopped). */
  cancel(sink: Pick<ItemInputSink, "command">): void {
    if (this.useHeld === 0) return;
    this.useHeld = 0;
    sink.command({ kind: "use", phase: "cancel" });
  }

  routeUse(down: boolean, sink: ItemInputSink): void {
    if (down) {
      this.useHeld += 1;
      if (this.useHeld > 1) return;
      if (!sink.racing) {
        // A key held through the start or a reset never fires on its release.
        this.useHeld = 0;
        return;
      }
      sink.command({ kind: "use", phase: "press" });
      return;
    }
    if (this.useHeld === 0) return;
    this.useHeld -= 1;
    if (this.useHeld === 0) sink.command({ kind: "use", phase: "release" });
  }
}
