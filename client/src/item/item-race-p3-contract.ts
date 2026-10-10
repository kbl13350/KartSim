/**
 * Phase-3 additions to the presenter and HUD contracts (ITEM_MODE.md C,
 * shared contracts of the phase-3 split). The FX area implements them in
 * item-race-presenter.ts and ui/item-hud-state.ts; this file is the view the
 * controller feeds, so the controller compiles on its own branch. Once both
 * branches are merged these types should match (or be replaced by) the FX
 * definitions.
 */
import type { ItemHudState } from "../ui/item-hud-state";
import type { ItemOverlayKind } from "./item-catalog";
import type {
  ItemKartEffect, ItemPresenterHit, ItemPresenterUse, ItemRacePresenter,
} from "./item-race-presenter-contract";
import type { ItemHitBy, ItemHitVariant } from "./item-race-rules";

/** Kart effects with the phase-3 kinds: gold/protect shield, tigerGhost, lockdown/talisman, forceZone. */
export type ItemRaceKartEffect = ItemKartEffect | "invincible" | "invisible" | "hold" | "knockback";

export interface ItemRaceKartEffectOptions {
  /** pull: the racer the magnet pulls toward. */
  target?: string;
  /** invisible: the local racer sees this kart (itself or a teammate), translucent. */
  visibleToMe?: boolean;
  /** The item causing the effect (gold vs protect shield, super shield, the bomb a fly carries). */
  itemId?: number;
}

export interface ItemRaceUse extends ItemPresenterUse {
  /** 2 when two missiles fly (useTwoRocket / useTwoGoldRocket). */
  count?: number;
}

export interface ItemRaceHit extends Omit<ItemPresenterHit, "by"> {
  by?: ItemHitBy;
  variant?: ItemHitVariant;
  /** Which missile of a double-rocket use. */
  shot?: 0 | 1;
}

/** The presenter with the phase-3 signatures (a superset of ItemRacePresenter's). */
export interface ItemRacePresenterP3 extends Omit<ItemRacePresenter, "kartEffect" | "endKartEffect" | "hit" | "used"> {
  used(event: ItemRaceUse): void;
  hit(event: ItemRaceHit): void;
  kartEffect(playerId: string, kind: ItemRaceKartEffect, startMs: number, durationMs: number,
    options?: ItemRaceKartEffectOptions): void;
  /** `tail: false`: no closing tail (an EMP blows the UFO away instead of letting it leave). */
  endKartEffect(playerId: string, kind: ItemRaceKartEffect, options?: { tail?: boolean }): void;
  /** The 迅 start item reached the slots (the charger sound). */
  startItemFlash?(atMs: number): void;
}

/** Changer card rows: a count, ∞ for a voucher, 0 hides the row. */
export type ItemHudChangerValue = number | "infinite" | 0;

export interface ItemHudChangers {
  slot: ItemHudChangerValue;
  item: ItemHudChangerValue;
  /** The key would act now (otherwise the row draws `disableUv`). */
  slotUsable: boolean;
  itemUsable: boolean;
}

export interface ItemHudOverlay {
  kind: ItemOverlayKind;
  /** HUD clock time the cover ends. */
  untilMs: number;
  /** 0..1; dark clouds take the goggle factor. */
  opacity: number;
}

/** The talisman QTE (符咒): the arrows to press in order, how many are done, the last miss. */
export interface ItemHudTalisman {
  keys: readonly ("left" | "right" | "up" | "down")[];
  done: number;
  failedAtMs?: number;
}

/** What the controller feeds the HUD: ItemHudState plus the phase-3 fields. */
export interface ItemHudFeed extends ItemHudState {
  changers?: ItemHudChangers;
  overlay?: ItemHudOverlay;
  /** Per slot: the special booster's `animal<iconId>.png` icon id; undefined keeps item<idx>.png. */
  slotIcons?: readonly (number | undefined)[];
  /** The 迅 start item arrived (HUD clock); the slot flash plays from here. */
  startItemFlash?: number;
  /** In-race lucci notice. */
  lucci?: { amount: number; atMs: number };
  /** Bottom-left tutorial board during the countdown. */
  tutorial?: "changer" | "avoidTeamkill";
  talisman?: ItemHudTalisman;
}
