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
  /** Physical source (`keyboard:ControlLeft`, `touch:5`); edges without one share a source. */
  source?: string;
  /** `keyboard`, `touch` or `gamepad`; defaults to the source prefix. */
  sourceKind?: string;
}

/** A physical arrow key (driving actions SteerLeft/Right, Forward, Reverse). */
export type ItemDirectionKey = "left" | "right" | "up" | "down";

export interface ItemInputSink {
  /** Only while racing do presses, swaps and changes become commands. */
  racing: boolean;
  command(command: ItemCommand): void;
  /** A left or right press, used to break out of a water bubble. */
  escape(): void;
  /**
   * Every arrow key press, by physical key (not remapped by a reverse), for
   * the talisman (符咒) QTE while the kart is held.
   */
  direction?(direction: ItemDirectionKey): void;
}

const directionKeys: ReadonlyMap<number, ItemDirectionKey> = new Map([
  [DrivingAction.SteerLeft, "left"], [DrivingAction.SteerRight, "right"],
  [DrivingAction.Forward, "up"], [DrivingAction.Reverse, "down"],
]);

/** The arrow key of a driving action, if it is one. */
export function itemDirectionKey(action: number): ItemDirectionKey | undefined {
  return directionKeys.get(action);
}

/** The keys an item race reverse swaps right now (physics `itemEffects`). */
export interface ItemReverseState {
  steeringInverted: boolean;
  forwardBackSwapped: boolean;
}

const swappedPedals: Readonly<Record<string, string>> = {
  "forward-down": "reverse-down", "forward-up": "reverse-up",
  "reverse-down": "forward-down", "reverse-up": "forward-up",
};

/**
 * The driving command an accumulator effect means under an item race reverse.
 * The released accumulator (`DrivingInputAccumulator`, kept identical for the
 * input parity test) swaps the snapshot's pedals and steering but reports the
 * raw keys. With forward and back swapped the back key is the forward pedal,
 * so its press must start the drift-exit and escape boosts and its release
 * end a boost; with steering inverted the drift starts toward the side the
 * kart actually turns. Other effects pass through unchanged (same object).
 */
export function itemReverseDrivingEffect<T extends { kind: string; direction?: number }>(
  effect: T, reverse: ItemReverseState): T {
  if (reverse.forwardBackSwapped) {
    const kind = swappedPedals[effect.kind];
    if (kind) return { ...effect, kind };
  }
  if (reverse.steeringInverted && effect.kind === "drift-start" &&
      (effect.direction === 1 || effect.direction === -1))
    return { ...effect, direction: -effect.direction };
  return effect;
}

/** Source kinds whose holds of one action GameplayInputQueue merges. */
const queueMergedKinds: ReadonlySet<string> = new Set(["keyboard", "touch"]);

/**
 * The input queue passes a keyboard edge only while no touch source holds the
 * action, and a touch edge only while no key holds it.
 */
function mergedByQueue(kind: string, otherKind: string): boolean {
  return kind !== otherKind && queueMergedKinds.has(kind) && queueMergedKinds.has(otherKind);
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
  /** Physical sources (keys, touch, gamepad) holding the use action, with their kind. */
  readonly useSources = new Map<string, string>();

  route<T extends ItemInputTransition>(transitions: readonly T[], sink: ItemInputSink): T[] {
    const driving: T[] = [];
    for (const transition of transitions) {
      if (!isItemAction(transition.action)) {
        if (transition.down && (transition.action === DrivingAction.SteerLeft ||
            transition.action === DrivingAction.SteerRight)) sink.escape();
        const direction = transition.down ? itemDirectionKey(transition.action) : undefined;
        if (direction) sink.direction?.(direction);
        driving.push(transition);
        continue;
      }
      if (transition.action === DrivingAction.UseItemOrBooster) {
        const source = transition.source ?? "unknown";
        this.routeUse(source, transition.sourceKind ?? source.split(":")[0]!, transition.down, sink);
      } else if (transition.down && sink.racing) {
        sink.command(transition.action === DrivingAction.ReorderItems
          ? { kind: "swap" } : { kind: "change" });
      }
    }
    return driving;
  }

  /** Drop a held use key without firing (input cancelled or driving stopped). */
  cancel(sink: Pick<ItemInputSink, "command">): void {
    if (this.useSources.size === 0) return;
    this.useSources.clear();
    sink.command({ kind: "use", phase: "cancel" });
  }

  /**
   * Press on the first held source, release when the last one lets go. A
   * keyboard edge also ends touch holds and a touch edge ends keyboard holds:
   * the input queue lets the edge through only when the other kind holds
   * nothing, so it swallowed their releases.
   */
  routeUse(source: string, kind: string, down: boolean, sink: ItemInputSink): void {
    const held = this.useSources;
    if (down) {
      // A held source pressed again, or a stale hold of the other queue kind,
      // means a release was lost (the key went up while another window had
      // focus): drop the stale hold and start over with a fresh press.
      if (held.has(source) || [...held.values()].some(heldKind => mergedByQueue(kind, heldKind)))
        this.cancel(sink);
      const first = held.size === 0;
      // A key held through the start or a reset never fires on its release.
      if (first && !sink.racing) return;
      held.set(source, kind);
      if (first) sink.command({ kind: "use", phase: "press" });
      return;
    }
    if (held.size === 0) return;
    for (const [heldSource, heldKind] of held)
      if (mergedByQueue(kind, heldKind)) held.delete(heldSource);
    held.delete(source);
    if (held.size === 0) sink.command({ kind: "use", phase: "release" });
  }
}
