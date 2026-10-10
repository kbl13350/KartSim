/**
 * The deterministic passive roll of the item race (ITEM_MODE.md C.1): the
 * victim's client and the game node compute the same number, so the node can
 * check a `by` / `variant` the victim reports against the frozen equipment.
 *
 *   roll = fnv1a32(`${raceId}|${useId}|${hazardId}|${victimId}|${kind}`) % 100
 *
 * over the UTF-8 bytes, 32-bit FNV-1a, with a missing use or hazard written as
 * 0. A passive with probability p succeeds when roll < p. The Go side
 * (server-go itemmode) implements the same function; both test against
 * item-roll-vectors.json.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const encoder = new TextEncoder();

/** 32-bit FNV-1a over the UTF-8 bytes of `text`, as an unsigned integer. */
export function fnv1a32(text: string): number {
  let hash = FNV_OFFSET;
  for (const byte of encoder.encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * What a roll is for. The kinds name the defended item family or the
 * equipment ability; kart and pet share one roll per kind (the kart is asked
 * first), so the better of the two probabilities decides.
 */
export type ItemRollKind =
  | "rocket" | "waterfly" | "waterBomb" | "devil" | "snowBomb" | "banana" | "mine" | "forceZone"
  | "waterMine" | "siren" | "waterAngel" | "balloon" | "headband" | "lucciUfo" | "lucciMine"
  | "lucciForceZone";

export interface ItemRollInput {
  raceId: string;
  /** The use; 0 or absent for a track hazard. */
  useId?: number;
  /** The track hazard; 0 or absent for a use. */
  hazardId?: number;
  victimId: string;
  kind: ItemRollKind | string;
}

export function itemRollKey(input: ItemRollInput): string {
  return `${input.raceId}|${input.useId ?? 0}|${input.hazardId ?? 0}|${input.victimId}|${input.kind}`;
}

/** 0..99 */
export function itemRoll(input: ItemRollInput): number {
  return fnv1a32(itemRollKey(input)) % 100;
}

/** A passive of probability `percent` (0..100) succeeds on this roll. */
export function itemRollSucceeds(input: ItemRollInput, percent: number): boolean {
  return percent > 0 && itemRoll(input) < percent;
}
