/**
 * The per-frame input of the item race HUD (道具赛, ITEM_MODE.md §7 H).
 *
 * The item race controller owns the item state machine and hands the HUD a
 * fresh `ItemHudState` (MultiplayerRaceHud.setItemState) whenever something
 * changes. Every time stamp (`at`, `abuseUntil`) is on the HUD clock: the
 * `time` the presenter passes to MultiplayerRaceHud.update.
 */

export type ItemAimPhase = "aiming" | "inrange" | "ontarget";
export type ItemTeamColor = "solo" | "red" | "blue";
export type ItemChangerCount = number | "infinite";

/** One row of itemStateNotice: "bad" = I was hit, "good" = my item took effect. */
export interface ItemHudNotice {
  kind: "bad" | "good";
  itemIdx: number;
  /** The other rider(s), already formatted (for example "车手A 等2人"). */
  text: string;
  at: number;
}

/** One row of itemStateTotalNotice: attacker, item icon, victim. */
export interface ItemHudLogEntry {
  attacker: string;
  victim: string;
  itemIdx: number;
  /** Blocked (shield, angel, …): drawn with itemInfo_failIcon. */
  failed: boolean;
  /** The attacker's team; solo in individual races. */
  team?: ItemTeamColor;
  at: number;
}

export interface ItemHudScan {
  playerId: unknown;
  slots: readonly number[];
}

export interface ItemHudState {
  /** Item idx per slot, -1 for empty; slot 0 is the current (largest) slot. */
  slots: readonly number[];
  capacity: 2 | 3;
  /** 0..1 of the Alt swap; omitted, the HUD runs its own 350 ms animation. */
  reorderProgress?: number;
  /** Slots locked (slotLock): freeze overlay and countdown. */
  lock?: { remainingMs: number };
  /** Time bomb on my kart: countdown. */
  timeBomb?: { remainingMs: number };
  /** Alt (换位卡) and Z (变更卡) cards; 0 hides the row. */
  slotChanger: ItemChangerCount;
  itemChanger: ItemChangerCount;
  /** Lock-on reticle at a 1600×900 stage position. */
  aim?: { phase: ItemAimPhase; x: number; y: number };
  /** I am targeted. */
  warning?: "rocket" | "waterfly";
  /** cloud2 screen cover; variant is the item.bml base (0 rainbow, 1 ink, 2 fairy). */
  cloud?: { opacity: number; variant?: 0 | 1 | 2 };
  /** The item box abuse message shows until this time. */
  abuseUntil?: number;
  notices: readonly ItemHudNotice[];
  log: readonly ItemHudLogEntry[];
  /** Item description balloon over the current slot. */
  infoCard?: { itemIdx: number };
  /** scanning (透视镜): opponents' slots next to their rank rows. */
  scan?: readonly ItemHudScan[];
}

/** The persisted item options of the settings dialog (dialog_stringBag keys). */
export interface ItemHudOptions {
  itemStateNotice: boolean;
  itemStateTotalNotice: boolean;
  dispIngameItemInfoCard: boolean;
}

/** Items of the item race probability tables (ITEM_MODE.md appendix A). */
export const ITEM_RACE_ITEM_IDS: readonly number[] = Object.freeze([
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 33, 109, 110, 111, 113, 114, 127,
]);

export function emptyItemHudState(capacity: 2 | 3 = 2): ItemHudState {
  return {
    slots: Array<number>(capacity).fill(-1),
    capacity,
    slotChanger: 0,
    itemChanger: 0,
    notices: [],
    log: [],
  };
}

/** The slot row the HUD draws: exactly `capacity` entries, -1 for empty. */
export function itemHudSlots(state: Pick<ItemHudState, "slots" | "capacity">): number[] {
  const slots: number[] = [];
  for (let index = 0; index < state.capacity; index++) {
    const value = state.slots[index];
    slots.push(Number.isInteger(value) && value! >= 0 ? value! : -1);
  }
  return slots;
}

export function itemSlotCapacity(value: unknown): 2 | 3 {
  return value === 3 ? 3 : 2;
}
