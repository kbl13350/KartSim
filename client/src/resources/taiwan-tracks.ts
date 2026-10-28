import data from "./taiwan-tracks.json";
import type { TrackMetadata } from "./track-catalog";

/** Imported TW models live in isolated folders; their original IDs stay stable. */
export interface TaiwanTrack {
  id: string;
  sourceFolder: string;
  folder: string;
  modelFile: string;
  canonicalPath: string;
  title: string;
  gameType: "item" | "speed";
  laps: number;
  difficulty: number;
  theme: string;
  reverse: boolean;
  texTheme?: string;
  bgmTheme?: string;
  bgmFile?: string;
  showLapUi?: boolean;
}

export const TAIWAN_TRACKS: readonly TaiwanTrack[] = data.tracks as TaiwanTrack[];
const byId = new Map(TAIWAN_TRACKS.map(track => [track.id.toLowerCase(), track]));
const byPath = new Map(TAIWAN_TRACKS.map(track => [track.canonicalPath.toLowerCase(), track]));
const folders = new Set(TAIWAN_TRACKS.map(track => track.folder.toLowerCase()));

export function isTaiwanTrackFolder(folder: string): boolean {
  return folders.has(folder.toLowerCase());
}

export function taiwanTrack(id: string): TaiwanTrack | undefined {
  return byId.get(id.toLowerCase());
}

/** The archive-only exporter uses track_tw_x/..., Sw uses track_/tw_x/.... */
export function taiwanTrackForPath(path: string): TaiwanTrack | undefined {
  const canonical = path.replaceAll("\\", "/").replace(/^track_([^/]+)\//i, "track_/$1/");
  return byPath.get(canonical.toLowerCase());
}

export function taiwanTrackMetadata(id: string): TrackMetadata | undefined {
  const track = taiwanTrack(id);
  if (!track) return;
  return {
    // Legacy texture lookup tries metadata.id before folder. Both must name
    // the isolated import, or a same-named CN source can shadow TW textures.
    // The selectable TrackChoice retains track.id for favorites and settlement.
    id: track.folder, folder: track.folder, cnTitle: track.title,
    gameType: track.gameType, laps: track.laps, difficulty: track.difficulty,
    theme: track.theme, texTheme: track.texTheme, bgmTheme: track.bgmTheme,
    bgmFile: track.bgmFile, showLapUi: track.showLapUi,
    blocked: false, choosable: true, speedPool: false,
  };
}
