/**
 * The local mirror of the server's item slots (道具槽). The server owns the
 * slots; every accepted reply carries them. A use or a swap shows at once
 * (optimistically) and stays applied on top of the confirmed slots until its
 * reply arrives; a rejection drops it and the last confirmed slots return.
 * Requests are answered in order, so pending operations resolve first in,
 * first out.
 */

export const EMPTY_SLOT = -1;

export type PendingSlotOperation = "use" | "swap";

export class ItemSlotMirror {
  readonly capacity: number;
  confirmed: number[];
  readonly pending: Array<{ token: number; operation: PendingSlotOperation }> = [];
  private nextToken = 1;

  constructor(capacity: number) {
    this.capacity = capacity >= 3 ? 3 : 2;
    this.confirmed = Array<number>(this.capacity).fill(EMPTY_SLOT);
  }

  /** Confirmed slots with the pending operations applied; exactly `capacity` entries. */
  get slots(): number[] {
    let slots = [...this.confirmed];
    for (const { operation } of this.pending) slots = applyOperation(slots, operation);
    return slots;
  }

  /** Start an optimistic operation; returns the token of its reply. */
  begin(operation: PendingSlotOperation): number {
    const token = this.nextToken++;
    this.pending.push({ token, operation });
    return token;
  }

  /** The server's slots from any accepted reply (cube, use, swap). */
  confirm(slots: readonly number[] | undefined, token?: number): void {
    if (token !== undefined) this.drop(token);
    if (slots) this.confirmed = normalizeSlots(slots, this.capacity);
  }

  /** A rejected or failed request: its optimistic change is undone. */
  reject(token: number): void {
    this.drop(token);
  }

  reset(): void {
    this.pending.length = 0;
    this.confirmed = Array<number>(this.capacity).fill(EMPTY_SLOT);
  }

  private drop(token: number): void {
    const index = this.pending.findIndex(entry => entry.token === token);
    if (index >= 0) this.pending.splice(index, 1);
  }
}

/** Pad or cut a slot list to the capacity; anything but an item index is empty. */
export function normalizeSlots(slots: readonly number[], capacity: number): number[] {
  const result: number[] = [];
  for (let index = 0; index < capacity; index++) {
    const value = slots[index];
    result.push(Number.isInteger(value) && value! >= 0 ? value! : EMPTY_SLOT);
  }
  return result;
}

function applyOperation(slots: number[], operation: PendingSlotOperation): number[] {
  if (operation === "use") return [...slots.slice(1), EMPTY_SLOT];
  if (slots.length < 2 || slots[0] === EMPTY_SLOT || slots[1] === EMPTY_SLOT) return slots;
  return [slots[1]!, slots[0]!, ...slots.slice(2)];
}

export function sameSlots(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
