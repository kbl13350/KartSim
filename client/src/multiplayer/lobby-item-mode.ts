/**
 * 道具赛 (item race) identity shared by the lobby, the room validator, the
 * generated mode tables and race start. Item rooms use the two original
 * combined item channels (zeta_/cn/content/channel.xml:72-73) with gameplay
 * "item"; the channel fixes individual or team, as in the original client.
 */

import type { RoomMode } from "./room-validation";

export const ITEM_GAMEPLAY = "item";

/** The original combined item channels: createSpeed 7, gameType 2 / 4. */
export const ITEM_CHANNELS = Object.freeze({
  itemIndiCombine: Object.freeze({ mode: "individual" as const, speed: 7 as const, gameType: 2 as const }),
  itemTeamCombine: Object.freeze({ mode: "team" as const, speed: 7 as const, gameType: 4 as const }),
});
export type ItemChannelName = keyof typeof ITEM_CHANNELS;

export function isItemChannel(value: unknown): value is ItemChannelName {
  return typeof value === "string" && Object.hasOwn(ITEM_CHANNELS, value);
}

export function itemChannelForMode(mode: RoomMode): ItemChannelName {
  return mode === "team" ? "itemTeamCombine" : "itemIndiCombine";
}

/**
 * Item gameplay runs only on the item channels and the item channels carry
 * only item gameplay; `undefined` gameplay means ordinary.
 */
export function itemChannelMismatch(gameplay: unknown, channel: unknown): boolean {
  return isItemChannel(channel) !== (gameplay === ITEM_GAMEPLAY);
}

/** Original game type of an item race: kItemIndi = 2, kItemTeam = 4. */
export function itemGameType(team: boolean): 2 | 4 {
  return team ? 4 : 2;
}

/** baseStringBag itemIndiCombine / itemTeamCombine (and ItemIndi / ItemTeam). */
export function itemModeLabel(team: boolean): "个人道具赛" | "组队道具赛" {
  return team ? "组队道具赛" : "个人道具赛";
}

/** Room title suffix of an item room on either item channel. */
export function itemRoomLabel(channel: unknown): string {
  return itemModeLabel(channel === "itemTeamCombine");
}

/** Track info card `modeKey`, resolved through baseStringBag ItemIndi / ItemTeam. */
export function itemTrackCardModeKey(team: boolean): "ItemIndi" | "ItemTeam" {
  return team ? "ItemTeam" : "ItemIndi";
}

/** Frozen per-race rules the game node appends as `race.item`. */
export const ITEM_RACE_RULESET = "web-item-v1";
export type ItemRaceTable = "indi" | "team";
export interface ItemRaceRules { ruleset: typeof ITEM_RACE_RULESET; table: ItemRaceTable }

/**
 * A valid `race.item`: the web item ruleset with the probability table of the
 * room's mode (itemProb_indi@zz for individual, itemProb_team2@cn for team).
 */
export function isItemRaceRules(value: unknown, team?: boolean): value is ItemRaceRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rules = value as Record<string, unknown>;
  return rules.ruleset === ITEM_RACE_RULESET &&
    (rules.table === "indi" || rules.table === "team") &&
    (team === undefined || rules.table === (team ? "team" : "indi"));
}

export function freezeItemRaceRules(value: unknown): Readonly<ItemRaceRules> | undefined {
  return isItemRaceRules(value)
    ? Object.freeze({ ruleset: value.ruleset, table: value.table }) : undefined;
}

/** Both absent, or both valid with the same ruleset and table. */
export function sameItemRaceRules(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return left === right;
  return isItemRaceRules(left) && isItemRaceRules(right) &&
    left.ruleset === right.ruleset && left.table === right.table;
}

/** The driving mode the race assets carry (generated `vI`). */
export interface DrivingModeKind { kind?: string }

export function isItemRace(drivingMode: DrivingModeKind | undefined): boolean {
  return drivingMode?.kind === ITEM_GAMEPLAY;
}

/**
 * 组队集气 runs in standard-speed team races only. Item team races have no
 * team gauge: stage_itemTeamGame does not load stage/speedTeamGame, whose
 * teamBoostGauge resources the gauge needs.
 */
export function teamGaugeEnabled(race: { mode?: unknown; speed?: unknown;
  drivingMode?: DrivingModeKind }): boolean {
  return race.mode === "team" && race.speed !== 4 && !isItemRace(race.drivingMode);
}
