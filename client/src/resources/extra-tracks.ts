import { PRACTICE_SCENE_IDS } from "./practice-scene";
import type { TrackChoice, TrackLibrary, TrackMetadata, TrackResource } from "./track-catalog";
import { trackDisplayTitle } from "./track-names";

export const EXTRA_TRACK_CATEGORIES = {
  "resource:mission": "任务关卡",
  "resource:training": "驾照训练",
  "resource:special": "特殊模式",
  "resource:extra": "扩展赛道",
  "resource:variant": "地图变体",
} as const;
export type ExtraTrackCategory = keyof typeof EXTRA_TRACK_CATEGORIES;

export interface ResourceTrack {
  id: string;
  folder: string;
  model: TrackResource;
  reverse: boolean;
  variant: string;
}

/** Race containers only: myRoom's track.1s files are room scenery, not courses. */
export function resourceTracks(library: Pick<TrackLibrary, "files">): ResourceTrack[] {
  const result: ResourceTrack[] = [];
  const paths = new Set<string>();
  for (const model of library.files) {
    const path = model.canonicalPath ?? model.virtualPath;
    const match = /^(?:track_\/|track_)([^/]+)\/track((?:_[a-z0-9]+)*|0)\.1s$/i.exec(path);
    if (!match || paths.has(path.toLowerCase())) continue;
    paths.add(path.toLowerCase());
    const [, folder, variant = ""] = match;
    const reverse = /(?:^|_)rvs(?:_|$)/i.test(variant);
    // Saved replays and settlement data identify reverse tracks by the _rvs suffix.
    const variantName = variant.replace(/^_/, "").split("_").filter(part => part !== "rvs").join("_");
    const id = variant === "" ? folder! : variant === "_rvs" ? `${folder}_rvs`
      : `${folder}__${variantName}${reverse ? "_rvs" : ""}`;
    result.push({ id, folder: folder!, model, variant, reverse });
  }
  return result;
}

export function extraTrackCategory(track: ResourceTrack): ExtraTrackCategory {
  if (track.variant && track.variant !== "_rvs") return "resource:variant";
  if (/_S\d|_sn\d/i.test(track.folder)) return "resource:mission";
  if (/_[LC]\d/i.test(track.folder)) return "resource:training";
  if (/_[FBKDP]\d/i.test(track.folder) || track.folder === "kartcity") return "resource:special";
  return "resource:extra";
}

export function resourceTrackMetadata(track: ResourceTrack, source?: TrackMetadata): TrackMetadata {
  const baseTitle = source?.cnTitle ?? trackDisplayTitle(track.folder, track.folder, "zh-CN");
  const suffix = track.variant && track.variant !== "_rvs" ? ` (${track.variant.replace(/^_/, "")})` : "";
  return {
    ...source,
    id: track.id,
    folder: track.folder,
    theme: source?.theme ?? track.folder.split("_")[0],
    cnTitle: `${PRACTICE_SCENE_IDS.has(track.folder) ? "[自由探索]" : ""}${track.reverse ? "[反]" : ""}${baseTitle}${suffix}`,
    gameType: source?.gameType === "item" ? "item" : "speed",
    laps: PRACTICE_SCENE_IDS.has(track.folder) ? 99999 : source?.laps ?? 1,
    difficulty: source?.difficulty ?? 0,
    blocked: false,
    choosable: true,
    speedPool: false,
    resourceCategory: extraTrackCategory(track),
  };
}

/** Add every indexed course/variant omitted by the release's selectable table. */
export function extraTrackChoices(library: TrackLibrary, metadata: readonly TrackMetadata[],
  existing: readonly TrackChoice[]): TrackChoice[] {
  const used = new Set(existing.map(track => track.path.toLowerCase()));
  const ids = new Set(existing.map(track => track.id.toLowerCase()));
  const byFolder = new Map(metadata.map(track => [(track.folder ?? track.id).toLowerCase(), track]));
  return resourceTracks(library).flatMap(track => {
    if (used.has(track.model.virtualPath.toLowerCase()) || ids.has(track.id.toLowerCase())) return [];
    ids.add(track.id.toLowerCase());
    used.add(track.model.virtualPath.toLowerCase());
    const source = byFolder.get(track.folder.toLowerCase());
    const normalized = resourceTrackMetadata(track, source);
    const base = trackDisplayTitle(track.folder, source?.cnTitle ?? track.folder);
    const title = PRACTICE_SCENE_IDS.has(track.folder) ? `[自由探索]${base}` : track.variant && track.variant !== "_rvs"
      ? `${base} (${track.variant.replace(/^_/, "")})`
      : trackDisplayTitle(track.id, `${track.reverse ? "[反]" : ""}${base}`);
    return [{ id: track.id, path: track.model.virtualPath, title,
      theme: normalized.theme!, gameType: normalized.gameType as "item" | "speed",
      difficulty: normalized.difficulty!, reverse: track.reverse || undefined,
      resourceCategory: normalized.resourceCategory }];
  });
}
