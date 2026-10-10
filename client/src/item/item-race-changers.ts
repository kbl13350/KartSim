/**
 * The changer cards of the local racer (ITEM_MODE.md C.6): 道具换位卡 (Alt,
 * swap slots 0 and 1) and 道具变更卡 (Z, redraw slot 0). The server owns them
 * and reports `changers {slot, item, itemArmed}` with every grant, use and
 * slots reply (-1 = a voucher, unlimited while it lasts). The client only
 * gates the keys on the last report minus its own requests still in flight,
 * so a second Alt with one card left does nothing.
 */
import type { ItemChangers } from "../multiplayer/server-events";
import type { ItemHudChangers, ItemHudChangerValue } from "./item-race-p3-contract";
import { EMPTY_SLOT } from "./item-race-slots";

export const CHANGER_VOUCHER = -1;

export class ItemChangerState {
  /** The server's last report; undefined until the first reply that carries one. */
  confirmed: ItemChangers | undefined;
  /** Swaps / changes sent and not answered yet (cards they will spend). */
  pendingSwaps = 0;
  pendingChange = false;

  constructor(initial?: ItemChangers) {
    if (initial) this.confirmed = { ...initial };
  }

  confirm(changers: ItemChangers | undefined): void {
    if (changers) this.confirmed = { ...changers };
  }

  /** Cards left after the requests in flight; -1 for a voucher. */
  get slotCards(): number {
    const count = this.confirmed?.slot ?? 0;
    return count === CHANGER_VOUCHER ? count : Math.max(0, count - this.pendingSwaps);
  }

  get itemCards(): number {
    const count = this.confirmed?.item ?? 0;
    return count === CHANGER_VOUCHER ? count : Math.max(0, count - (this.pendingChange ? 1 : 0));
  }

  get itemArmed(): boolean {
    return (this.confirmed?.itemArmed ?? false) && !this.pendingChange;
  }

  /** Alt: a card or voucher, and items in slots 0 and 1 (allowed under a slot lock). */
  canSwap(slots: readonly number[]): boolean {
    return this.slotCards !== 0 && slots.length >= 2 && slots[0] !== EMPTY_SLOT && slots[1] !== EMPTY_SLOT;
  }

  /** Z: a card or voucher, an unchanged new item in slot 0, no slot lock, nothing else in flight. */
  canChange(slots: readonly number[], locked: boolean): boolean {
    return this.itemCards !== 0 && this.itemArmed && !locked && slots[0] !== undefined &&
      slots[0] !== EMPTY_SLOT;
  }

  beginSwap(): void { this.pendingSwaps += 1; }
  endSwap(changers?: ItemChangers): void {
    this.pendingSwaps = Math.max(0, this.pendingSwaps - 1);
    this.confirm(changers);
  }
  beginChange(): void { this.pendingChange = true; }
  endChange(changers?: ItemChangers): void {
    this.pendingChange = false;
    this.confirm(changers);
  }

  /** Any card or voucher of either kind is known to be held. */
  get holdsAny(): boolean {
    return (this.confirmed?.slot ?? 0) !== 0 || (this.confirmed?.item ?? 0) !== 0;
  }

  hud(slots: readonly number[], locked: boolean, acting: boolean): ItemHudChangers {
    const value = (count: number): ItemHudChangerValue => count === CHANGER_VOUCHER ? "infinite" : count;
    return {
      slot: value(this.slotCards),
      item: value(this.itemCards),
      slotUsable: acting && this.canSwap(slots),
      itemUsable: acting && this.canChange(slots, locked),
    };
  }

  reset(): void {
    this.pendingSwaps = 0;
    this.pendingChange = false;
  }
}
