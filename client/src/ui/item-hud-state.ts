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
/** Cards owned (x<n>, at most three digits drawn), "infinite" (a valid voucher) or 0 (none: row hidden). */
export type ItemChangerCount = number | "infinite";

/**
 * The 道具换位卡 (Alt) and 道具变更卡 (Z) rows (ITEM_MODE.md C.6): what the
 * server's `changers` says the racer holds, and whether the key would act
 * now (a row that cannot is drawn with its disableUv frames).
 */
export interface ItemHudChangers {
  slot: ItemChangerCount;
  item: ItemChangerCount;
  slotUsable: boolean;
  itemUsable: boolean;
}

/** Screen covers of the special items (ITEM_MODE.md C.4); darkCloud is cloud2Effect_1. */
export type ItemHudOverlayKind =
  | "tiger" | "panther" | "delivery" | "dinoClaw" | "honey" | "oil" | "lion" | "darkCloud";

export interface ItemHudOverlay {
  kind: ItemHudOverlayKind;
  /** HUD clock time the cover is released (it then plays its own fade out). */
  untilMs: number;
  /** 0..1; the goggles' see-through factor applies to the dark cloud. */
  opacity: number;
}

/** talisman (符咒) escape keys, shown with its uiEffect arrows. */
export type ItemTalismanKey = "up" | "down" | "left" | "right";

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
  /** 1 only in a 驾照考试 step (itemSlotCnt 1). */
  capacity: 1 | 2 | 3;
  /** 0..1 of the Alt swap; omitted, the HUD runs its own 350 ms animation. */
  reorderProgress?: number;
  /** Slots locked (slotLock): freeze overlay and countdown. */
  lock?: { remainingMs: number };
  /** Time bomb on my kart: countdown. */
  timeBomb?: { remainingMs: number };
  /** Alt (换位卡) and Z (变更卡) rows from the server's `changers`. */
  changers?: ItemHudChangers;
  /**
   * Phase-2 rows without a usable flag (drawn usable); `changers` wins.
   * @deprecated feed `changers`.
   */
  slotChanger?: ItemChangerCount;
  /** @deprecated feed `changers`. */
  itemChanger?: ItemChangerCount;
  /** Lock-on reticle at a 1600×900 stage position. */
  /** The reticle on the 1600×900 stage; `progress` (0–1) of the lock while in range. */
  aim?: { phase: ItemAimPhase; x: number; y: number; progress?: number };
  /** I am targeted. */
  warning?: "rocket" | "waterfly";
  /**
   * cloud2 screen cover; variant is the item.bml base (0 rainbow, 1 ink, 2
   * fairy). `opacity` (0..1) is the cover's strength: 1 − the goggles' (or
   * kart's) `trans`, ITEM_MODE.md C.2.
   */
  cloud?: { opacity: number; variant?: 0 | 1 | 2 };
  /** A special item's screen cover (tiger claws, honey, oil, the dark cloud …). */
  overlay?: ItemHudOverlay;
  /**
   * Per slot, the special booster's icon (`animalBooster` iconId → item/slot/
   * animal<iconId>.png) for a slot holding item 31; undefined keeps item<idx>.png.
   */
  slotIcons?: readonly (number | undefined)[];
  /** HUD clock time the XUN start item reached slot 0 (12thEngineEffect flash). */
  startItemFlash?: number;
  /** The latest in-race lucci gain (the server's `lucci` event). */
  lucci?: { amount: number; atMs: number };
  /** Bottom-left tutorial board during the countdown (changerTuto / avoidTeamkill). */
  tutorial?: "changer" | "avoidTeamkill";
  /** talisman: the escape keys to press in order and how many are done. */
  talisman?: { keys: readonly ItemTalismanKey[]; done: number; failedAtMs?: number };
  /** The item box abuse message shows until this time. */
  abuseUntil?: number;
  notices: readonly ItemHudNotice[];
  log: readonly ItemHudLogEntry[];
  /**
   * Item description balloon over the current slot. The HUD shows the
   * race's first card as the 查看道具说明 prompt (itemDescList first /
   * first_desc) and every later one as name, icon and Ctrl, then description.
   */
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

export function emptyItemHudState(capacity: 1 | 2 | 3 = 2): ItemHudState {
  return {
    slots: Array<number>(capacity).fill(-1),
    capacity,
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
