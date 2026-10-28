import data from "./track-duplicates.json";
import { isCustomTrackId } from "../mapeditor/design";

/** Only reviewed equivalent scenes belong here; reverse routes have separate groups. */
export interface TrackDuplicateGroup {
  canonicalId: string;
  aliasIds: readonly string[];
  reason?: string;
  evidence?: unknown;
}

export interface DuplicateAwareTrack {
  id: string;
  reverse?: boolean;
  /** Mounted original choices retained for replay, room and favorite compatibility. */
  duplicateAliases?: readonly DuplicateAwareTrack[];
}

export const TRACK_DUPLICATE_GROUPS: readonly TrackDuplicateGroup[] = data.groups;

const key = (id: string) => id.toLowerCase();
const reverse = (id: string) => /_rvs$/i.test(id);

function duplicateGroups(groups: readonly TrackDuplicateGroup[]): Map<string, TrackDuplicateGroup> {
  const byId = new Map<string, TrackDuplicateGroup>();
  for (const group of groups) {
    const ids = [group.canonicalId, ...group.aliasIds];
    if (!group.canonicalId || ids.some(id => !id || isCustomTrackId(id) || reverse(id) !== reverse(group.canonicalId)))
      throw new Error(`Invalid reviewed track duplicate group: ${group.canonicalId}`);
    for (const id of ids) {
      if (byId.has(key(id))) throw new Error(`Track duplicate groups overlap: ${id}`);
      byId.set(key(id), group);
    }
  }
  return byId;
}

/** Collapse the picker only. Missing canonical resources leave one mounted alias visible. */
export function deduplicateTrackChoices<T extends DuplicateAwareTrack>(tracks: readonly T[],
  groups: readonly TrackDuplicateGroup[] = TRACK_DUPLICATE_GROUPS): T[] {
  if (groups.length === 0) return [...tracks];
  const byId = duplicateGroups(groups);
  const mounted = new Map<TrackDuplicateGroup, T[]>();
  for (const track of tracks) {
    if (isCustomTrackId(track.id)) continue;
    const group = byId.get(key(track.id));
    // A malformed choice cannot make a forward/reverse route disappear.
    if (!group || !!track.reverse !== reverse(group.canonicalId)) continue;
    const members = mounted.get(group) ?? [];
    members.push(track);
    mounted.set(group, members);
  }
  const selected = new Map<TrackDuplicateGroup, T>();
  for (const [group, members] of mounted)
    selected.set(group, members.find(track => key(track.id) === key(group.canonicalId)) ?? members[0]!);
  return tracks.flatMap(track => {
    const group = byId.get(key(track.id)), members = group && mounted.get(group);
    if (isCustomTrackId(track.id) || !group || !members?.includes(track)) return [track];
    if (selected.get(group) !== track) return [];
    const aliases = members.filter(member => member !== track);
    return aliases.length ? [{ ...track, duplicateAliases: aliases }] : [track];
  });
}

/** Exact original ID/path, including hidden aliases; never substitute a different replay map. */
export function findTrackChoice<T extends DuplicateAwareTrack>(tracks: readonly T[], id: string): T | undefined {
  const wanted = key(id);
  for (const track of tracks) {
    if (key(track.id) === wanted) return track;
    const alias = track.duplicateAliases?.find(candidate => key(candidate.id) === wanted);
    if (alias) return alias as T;
  }
  return undefined;
}

/** Restore exact mounted choices for scripted races and existing random pools. */
export function expandTrackChoices<T extends DuplicateAwareTrack>(tracks: readonly T[]): T[] {
  return tracks.flatMap(track => [track, ...(track.duplicateAliases ?? []) as readonly T[]]);
}

/** Highlight the surviving picker card when the current race still uses an old alias. */
export function visibleTrackId(id: string, tracks: readonly DuplicateAwareTrack[]): string {
  const wanted = key(id);
  return tracks.find(track => key(track.id) === wanted ||
    track.duplicateAliases?.some(alias => key(alias.id) === wanted))?.id ?? id;
}

export function equivalentTrackChoices(track: unknown): unknown[] {
  const aliases = (track as DuplicateAwareTrack | undefined)?.duplicateAliases;
  return [track, ...(aliases ?? [])];
}

/** Keep the legacy favorite wire keys; a star on a hidden alias marks its visible card. */
export function duplicateAwareFavoriteTrackIds(
  favorites: readonly { themeId: unknown; trackId: unknown }[],
  tracks: readonly DuplicateAwareTrack[],
  encode: (track: unknown) => { themeId: unknown; trackId: unknown },
): Set<string> {
  return new Set(tracks.filter(track => equivalentTrackChoices(track).some(candidate => {
    const saved = encode(candidate);
    return favorites.some(entry => entry.themeId === saved.themeId && entry.trackId === saved.trackId);
  })).map(track => track.id));
}
