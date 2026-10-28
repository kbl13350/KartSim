import { deduplicateTrackChoices } from "../../src/resources/track-duplicates.ts";
import { THEME_TITLES } from "../../src/resources/resource-groups.ts";
import { isCustomTrackId } from "../../src/mapeditor/design.ts";

export function trackDirectoryDocument(allChoices) {
  return {
    generatedFrom: "client/tools/export-track-catalog.mjs --directory: mounted built-in time-attack tracks, reviewed duplicate aliases and resource theme metadata. Do not edit by hand.",
    tracks: trackDirectoryRows(allChoices),
  };
}

/** Admin inventory is independent of visibility settings, so disabled maps can be enabled again. */
export function trackDirectoryRows(allChoices) {
  const builtins = allChoices.filter(track => !isCustomTrackId(track.id));
  return deduplicateTrackChoices(builtins).map(track => ({
    id: track.id,
    title: track.title,
    theme: track.theme,
    themeTitle: THEME_TITLES[track.theme] ?? track.theme,
    gameType: track.gameType,
    reverse: !!track.reverse,
    ...(Number.isSafeInteger(track.difficulty) ? { difficulty: track.difficulty } : {}),
    aliases: (track.duplicateAliases ?? []).map(alias => alias.id).sort(),
  })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
