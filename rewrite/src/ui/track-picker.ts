export interface SelectableTrack {
  id: string;
  title: string;
  theme: string;
  gameType: string;
}

export interface SelectableRandomGroup {
  id: string;
  cardToken: string;
  randomType: string;
  gameType: string;
  level?: number | string;
}

export interface TrackPickerState<
  Track extends SelectableTrack = SelectableTrack,
  Group extends SelectableRandomGroup = SelectableRandomGroup,
> {
  options: {
    tracks: Track[];
    favoriteTrackIds: Set<string>;
    randomGroups?: Group[];
  };
  searchQuery: string;
  selectedTheme?: string;
  itemEnabled: boolean;
  speedEnabled: boolean;
}

/** Shared game type switch for tracks and random group cards. */
export function gameTypeEnabled(
  state: Pick<TrackPickerState, "itemEnabled" | "speedEnabled">,
  candidate: { gameType: string },
): boolean {
  return candidate.gameType === "item" ? state.itemEnabled : state.speedEnabled;
}

/** Search applies only in the all-theme search view, matching the packaged UI. */
export function filteredTracks<Track extends SelectableTrack>(
  state: TrackPickerState<Track>,
): Track[] {
  const terms = state.searchQuery.split(" ").filter(Boolean);
  return state.options.tracks.filter(track => {
    if (!gameTypeEnabled(state, track)) return false;
    if (state.selectedTheme === "favorite") return state.options.favoriteTrackIds.has(track.id);
    if (state.selectedTheme === undefined) return terms.every(term => track.title.includes(term));
    return state.selectedTheme === "0" || track.theme === state.selectedTheme;
  });
}

const randomGroupOrder = [
  "hot1", "hot2", "hot3", "hot4", "hot5", "all", "speedAll",
  "clubSpeed", "new", "reverse",
];

function randomGroupSortPosition(group: SelectableRandomGroup): number {
  const category = group.cardToken.startsWith("speedAll")
    ? "speedAll"
    : group.randomType === "all" && group.cardToken.startsWith("allRandom")
      ? "all"
      : group.randomType;
  const position = randomGroupOrder.indexOf(category);
  return position < 0 ? 99 : position;
}

/** Select one representative per card token, preferring speed mode duplicates. */
export function randomGroupsForDisplay<Group extends SelectableRandomGroup>(
  state: TrackPickerState<SelectableTrack, Group>,
): Group[] {
  const groups = state.options.randomGroups ?? [];
  const byCard = new Map<string, Group>();
  const selectedMode = state.speedEnabled ? "speed" : "item";
  for (const group of groups) {
    if (group.randomType === "all") {
      if (group.gameType !== selectedMode) continue;
    } else if (group.randomType !== "speedAll" && !gameTypeEnabled(state, group)) {
      continue;
    }
    const existing = byCard.get(group.cardToken);
    if (!existing || (group.gameType === "speed" && existing.gameType !== "speed")) {
      byCard.set(group.cardToken, group);
    }
  }
  return [...byCard.values()].sort((left, right) =>
    randomGroupSortPosition(left) - randomGroupSortPosition(right));
}

/** Keep the same random card selected when switching item/speed mode. */
export function matchingRandomGroup<Group extends SelectableRandomGroup>(
  groups: Group[] | undefined,
  selectedGroupId: string | undefined,
  gameType: string,
): Group | undefined {
  const selected = groups?.find(group => group.id === selectedGroupId);
  if (!selected) return undefined;
  return groups?.find(group => group.gameType === gameType &&
    group.cardToken === selected.cardToken &&
    group.randomType === selected.randomType && group.level === selected.level);
}
