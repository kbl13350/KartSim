/**
 * The in-race item options of the settings dialog (dialog.rho
 * view_gameOption@cn: itemStateNotice, itemStateTotalNotice,
 * dispIngameItemInfoCard). The release showed them as fixed checked boxes;
 * they are now ordinary game options, saved with the others under the game
 * options key, on by default like the original (config.xml itemStateNotice
 * and inGameDispItemInfo are enabled).
 */

import type { ItemHudOptions } from "./item-hud-state";

export const ITEM_HUD_OPTION_FIELDS = Object.freeze([
  "itemStateNotice", "itemStateTotalNotice", "dispIngameItemInfoCard",
] as const satisfies ReadonlyArray<keyof ItemHudOptions>);

/** Release GP (world.js): where la0/ua0 keep the game options. */
export const GAME_OPTIONS_STORAGE_KEY = "kartrider-web:p3528:game-options-v1";

export function defaultItemHudOptions(): ItemHudOptions {
  return { itemStateNotice: true, itemStateTotalNotice: true, dispIngameItemInfoCard: true };
}

/** The item options of a game options record; a missing or invalid value is on. */
export function itemHudOptions(options: Readonly<Record<string, unknown>> | undefined): ItemHudOptions {
  const result = defaultItemHudOptions();
  for (const field of ITEM_HUD_OPTION_FIELDS) {
    const value = options?.[field];
    if (typeof value === "boolean") result[field] = value;
  }
  return result;
}

/** The record with all three item options present (a settings draft). */
export function withItemHudOptions<Options extends Record<string, unknown>>(
  options: Options): Options & ItemHudOptions {
  return { ...options, ...itemHudOptions(options) };
}

/** The saved options (the HUD reads them when a race loads). */
export function readStoredItemHudOptions(
  storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): ItemHudOptions {
  try {
    const saved = storage?.getItem(GAME_OPTIONS_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : undefined;
    return itemHudOptions(parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown> : undefined);
  } catch {
    return defaultItemHudOptions();
  }
}
