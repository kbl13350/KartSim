/**
 * 道具赛 frame presentation: the item cubes, the track hazards and the item
 * presenter follow the track scene update (moving cubes and hazards read its
 * matrices), and the item HUD gets the controller's state.
 */
import type { ItemRacePresenter } from "../item/item-race-presenter-contract";
import type { ItemHudState } from "../ui/item-hud-state";

export interface RacePresenterItemsHost {
  camera: unknown;
  assets: {
    itemCubes?: { update(nowMs: number, camera: unknown, width: number, height: number): void };
    itemHazards?: { update(nowMs: number): void };
    /** item-mode(fx): the kart looks (invisibility, balloons) and the start item's charger sound. */
    itemPresenter?: Pick<ItemRacePresenter, "kartPresentation" | "startItemFlash">;
  };
  runtime: {
    itemRace?: {
      present(input: { nowMs: number; camera: unknown; width: number; height: number }): void;
    };
  };
}

/** Call right after the track render update, in the race and in the result frames. */
export function updateRacePresenterItems(host: RacePresenterItemsHost, nowMs: number,
  width: number, height: number): void {
  host.assets.itemCubes?.update(nowMs, host.camera, width, height);
  host.assets.itemHazards?.update(nowMs);
  host.runtime.itemRace?.present({ nowMs, camera: host.camera, width, height });
}

export interface RacePresenterItemHudHost {
  runtime: { itemRace?: { hudState(nowMs: number): ItemHudState } };
  hud: { setItemState?(state: ItemHudState): void };
  /** item-mode(fx): the start item flash the charger sound already played for. */
  itemStartFlashMs?: number;
}

/** The race presenter's assets as the charger sound needs them (any host may omit them). */
type ItemFlashAssets = { assets?: { itemPresenter?: Pick<ItemRacePresenter, "startItemFlash"> } };

/** Feed this frame's item state to the HUD before it updates. */
export function feedRacePresenterItemHud(host: RacePresenterItemHudHost, nowMs: number): void {
  const itemRace = host.runtime.itemRace;
  if (!itemRace || !host.hud.setItemState) return;
  const state = itemRace.hudState(nowMs);
  host.hud.setItemState(state);
  // The XUN start item's slot flash sounds the charger once (ITEM_MODE.md C.3).
  const flash = state.startItemFlash;
  if (flash !== undefined && flash !== host.itemStartFlashMs) {
    host.itemStartFlashMs = flash;
    (host as ItemFlashAssets).assets?.itemPresenter?.startItemFlash?.(flash);
  }
}
