import { tr } from "../i18n/locale";
import { refreshTrackDisplaySettings, trackDisplayEnabled,
  type TrackDisplaySettings } from "../resources/track-display-settings";
import { visibleTrackId } from "../resources/track-duplicates";

interface PickerTrack {
  id: string;
  duplicateAliases?: readonly PickerTrack[];
}
interface PickerGroup { id: string; trackIds: string[]; displayTrackIds?: string[] }
interface PolicyOptions {
  tracks: PickerTrack[];
  randomGroups?: PickerGroup[];
  favoriteTrackIds: Set<string>;
  selectedTrackId: string;
  selectedRandomGroupId?: string;
}

/** Filter copies of picker data; the original catalog still resolves every old ID/path. */
export function applyTrackPickerPolicy<T extends PolicyOptions>(options: T,
  settings: TrackDisplaySettings): T {
  const enabled = (id: string) => trackDisplayEnabled(id, settings);
  const tracks = options.tracks.filter(track => enabled(track.id)).map(track =>
    track.duplicateAliases ? { ...track, duplicateAliases: track.duplicateAliases.filter(alias => enabled(alias.id)) } : track);
  const mountedIds = new Set(tracks.flatMap(track =>
    [track.id, ...(track.duplicateAliases ?? []).map(alias => alias.id)]).map(id => id.toLowerCase()));
  const offered = (id: string) => enabled(id) && mountedIds.has(id.toLowerCase());
  const randomGroups = options.randomGroups?.flatMap(group => {
    const trackIds = group.trackIds.filter(offered);
    return trackIds.length ? [{ ...group, trackIds,
      ...(group.displayTrackIds ? { displayTrackIds: group.displayTrackIds.filter(offered) } : {}),
    }] : [];
  });
  const requested = visibleTrackId(options.selectedTrackId, tracks);
  const selectedTrackId = tracks.some(track => track.id === requested) ? requested : tracks[0]?.id ?? "";
  return { ...options, tracks, randomGroups, selectedTrackId,
    favoriteTrackIds: new Set([...options.favoriteTrackIds].filter(offered)),
    selectedRandomGroupId: randomGroups?.some(group => group.id === options.selectedRandomGroupId)
      ? options.selectedRandomGroupId : undefined,
  } as T;
}

/** Every shared picker load refreshes once; simultaneous callers share the same request. */
export async function prepareTrackPickerOptions<T extends PolicyOptions>(options: T): Promise<T> {
  const settings = await refreshTrackDisplaySettings(true);
  const filtered = applyTrackPickerPolicy(options, settings);
  if (options.tracks.length > 0 && filtered.tracks.length === 0)
    throw new Error(tr("当前没有开放的地图，请稍后再试。"));
  return filtered;
}
