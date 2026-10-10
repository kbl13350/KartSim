import type { SelectableRandomGroup, SelectableTrack } from "./track-picker";

export type TrackPickerConfirmation =
  | { kind: "track"; track: SelectableTrack }
  | { kind: "random"; group: SelectableRandomGroup };

export interface TrackPickerActionHost {
  options: {
    tracks: SelectableTrack[];
    randomGroups?: SelectableRandomGroup[];
    favoriteTrackIds: Set<string>;
    onConfirm(selection: TrackPickerConfirmation): void;
    getFavoriteCount(): number;
    onFavoriteChange(id: string, favorite: boolean): void;
    /** Game types the room offers; a type outside it cannot be switched on. */
    gameTypes?: readonly string[];
  };
  assets: { themes: Array<{ id: string }> };
  selectedTheme?: string;
  selectedTrackId?: string;
  selectedRandomGroupId?: string;
  itemEnabled: boolean;
  speedEnabled: boolean;
  search: Pick<HTMLInputElement, "value" | "blur">;
  searchQuery: string;
  themeOffset: number;
  trackOffset: number;
  pageSize(name: string): number;
  resetTrackScrollbar(): void;
  render(): void;
  remapRandomSelection(gameType: string): void;
  selectTheme(theme: string): void;
  searchTracks(query: string): void;
}

/** Initially place the selected theme on a visible page. */
export function placeInitialThemeOffset(host: TrackPickerActionHost): void {
  const pageSize = host.pageSize("selectTheme");
  const selected = host.assets.themes.findIndex(theme => theme.id === host.selectedTheme);
  const first = selected < 0 ? 0 : Math.floor(selected / pageSize) * pageSize;
  host.themeOffset = Math.min(first, Math.max(0, host.assets.themes.length - pageSize));
  host.trackOffset = 0;
}

/** Confirm a concrete track or, on the random tab, its selected group. */
export function confirmTrackSelection(host: TrackPickerActionHost): void {
  if (host.selectedTheme === "1024" && host.selectedRandomGroupId !== undefined) {
    const group = host.options.randomGroups?.find(item => item.id === host.selectedRandomGroupId);
    if (group) host.options.onConfirm({ kind: "random", group });
    return;
  }
  const track = host.options.tracks.find(item => item.id === host.selectedTrackId);
  if (track) host.options.onConfirm({ kind: "track", track });
}

/** Changing tabs resets the list, search field and selection filters in order. */
export function selectTrackTheme(host: TrackPickerActionHost, theme: string): void {
  const previous = host.selectedTheme;
  host.resetTrackScrollbar();
  host.selectedTheme = theme;
  if (theme === "1024" && previous !== "1024") {
    const track = host.options.tracks.find(item => item.id === host.selectedTrackId);
    const gameType = track?.gameType === "item" ? "item" : "speed";
    // The random tab shows one game type: the selected track's, if the room offers it.
    const shown = trackGameTypeOffered(host.options, gameType)
      ? gameType : host.options.gameTypes?.[0] ?? gameType;
    host.itemEnabled = shown === "item";
    host.speedEnabled = shown !== "item";
  }
  host.search.value = "";
  host.searchQuery = "";
  host.search.blur();
  host.trackOffset = 0;
  host.render();
}

/** A 道具赛 room offers only 道具; other pickers offer both game types. */
export function trackGameTypeOffered(options: { gameTypes?: readonly string[] },
  gameType: string): boolean {
  return !options.gameTypes || options.gameTypes.includes(gameType);
}

/** Radio buttons are exclusive on the random tab and independent elsewhere. */
export function toggleTrackGameType(host: TrackPickerActionHost, gameType: string): void {
  if (!trackGameTypeOffered(host.options, gameType)) return;
  if (host.selectedTheme === "1024") {
    host.itemEnabled = gameType === "item";
    host.speedEnabled = gameType === "speed";
    host.remapRandomSelection(gameType);
  } else if (gameType === "item") {
    host.itemEnabled = !host.itemEnabled;
  } else {
    host.speedEnabled = !host.speedEnabled;
  }
  if (host.selectedTheme !== undefined) host.selectTheme(host.selectedTheme);
  else host.searchTracks(host.search.value);
}

export function searchTracks(host: TrackPickerActionHost, query: string): void {
  host.resetTrackScrollbar();
  host.searchQuery = query;
  host.selectedTheme = undefined;
  host.trackOffset = 0;
  host.render();
}

const releaseWhitespace =
  /^[\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g;

/** Enter commits a non-empty query; empty text restores the current theme. */
export function commitTrackSearch(host: TrackPickerActionHost): void {
  const query = host.search.value.replace(releaseWhitespace, "");
  if (query) {
    host.searchTracks(query);
    return;
  }
  host.search.value = "";
  host.search.blur();
  if (host.selectedTheme !== undefined) host.selectTheme(host.selectedTheme);
}

/** Apply the official 50-track favorite cap and notify the owner. */
export function changeFavoriteTrack(host: TrackPickerActionHost,
  trackId: string, favorite: boolean): string {
  const favorites = host.options.favoriteTrackIds;
  if (favorite) {
    if (host.options.getFavoriteCount() >= 50) return "AddFavoriteTrackError2";
    favorites.add(trackId);
    host.options.onFavoriteChange(trackId, true);
    return "AddFavoriteTrack";
  }
  favorites.delete(trackId);
  host.options.onFavoriteChange(trackId, false);
  return "DeleteFavoriteTrack";
}
