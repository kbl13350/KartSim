/** Canonical archive discovery for the P3528 TimeAttack music playlist. */
export const RACE_BGM_THEMES = [
  "steam", "forest", "desert", "village", "ice", "tomb", "mine",
  "northeu", "factory", "pirate", "fairy", "moonhill", "gold",
  "china", "castle", "nymph", "mechanic", "xyy", "wkc", "brodi",
  "park", "beach", "transFormer", "jurassic", "world", "nemo",
  "sword", "god", "abyss", "camelot", "olympos", "korea",
  "mabi", "maple", "fengshen",
] as const;

export const GARAGE_MUSIC_PATHS = ["sound_/bgm/main/shop.ogg"] as const;

export interface BgmResource {
  name: string;
  extension: string;
  sourceOrdinal?: number;
  containerId?: unknown;
  absenceAuthoritative?: boolean;
  bytes(): Promise<Uint8Array>;
}

export interface BgmArchiveLibrary {
  manifestAvailable: boolean;
  archives: Array<{ mountPath: string }>;
  hasManifestMount(path: string): boolean;
  entriesUnderCanonicalPrefix(path: string): BgmResource[];
  exactCanonicalCandidates(path: string): BgmResource[];
}

export interface BgmTrackMetadata {
  id: string;
  folder?: string;
  texTheme?: string;
  bgmTheme?: string;
  theme?: string;
}

export function canonicalBgmPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").toLowerCase();
}

export function selectRaceBgmTheme(track: BgmTrackMetadata): string {
  const folder = track.folder || track.id;
  const folderTheme = RACE_BGM_THEMES.find(theme => folder.startsWith(theme));
  const textureTheme = track.texTheme?.split("|").find(theme =>
    RACE_BGM_THEMES.includes(theme as typeof RACE_BGM_THEMES[number]));
  const theme = track.bgmTheme || track.theme || folderTheme || textureTheme;
  if (!theme)
    throw new Error(`${track.id} 无法形成 P3528 TimeAttack BGM theme。`);
  return theme;
}

export function raceBgmArchiveTracks(library: BgmArchiveLibrary,
  theme: string): BgmResource[] {
  const mountPath = `sound_/bgm/${theme}`;
  if (!library.manifestAvailable)
    throw new Error("P3528 TimeAttack BGM 需要 aaa.pk canonical mounts。");
  if (!library.hasManifestMount(mountPath)) return [];
  const archives = library.archives.filter(archive =>
    canonicalBgmPath(archive.mountPath) === canonicalBgmPath(mountPath));
  if (archives.length !== 1)
    throw new Error(`${mountPath} selected archive 数量 ${archives.length}。`);
  const entries = library.entriesUnderCanonicalPrefix(mountPath);
  const containers = new Set(entries.map(entry => entry.containerId));
  if (entries.length > 0 && (containers.size !== 1 ||
      containers.has(undefined) ||
      !entries.every(entry => entry.absenceAuthoritative))) {
    throw new Error(`${mountPath} 的 P3528 archive provenance 不唯一。`);
  }
  return entries.filter(entry => entry.extension === "ogg")
    .sort((left, right) => (left.sourceOrdinal ?? -1) -
      (right.sourceOrdinal ?? -1));
}

export async function decodeBgmResource(resource: BgmResource,
  context: unknown, decode: (context: unknown,
    bytes: Uint8Array) => Promise<unknown>): Promise<unknown> {
  return decode(context, await resource.bytes());
}

export async function loadRaceBgmPlaylist(library: BgmArchiveLibrary,
  track: BgmTrackMetadata, context: unknown,
  decode: (context: unknown, bytes: Uint8Array) => Promise<unknown>):
  Promise<{ buffers: unknown[]; names: string[] }> {
  const theme = selectRaceBgmTheme(track);
  const resources = [theme, `${theme}2`].flatMap(name =>
    raceBgmArchiveTracks(library, name));
  if (!resources.length)
    throw new Error(`${track.id} 的 P3528 TimeAttack BGM 候选为空。`);
  return {
    buffers: await Promise.all(resources.map(resource =>
      decodeBgmResource(resource, context, decode))),
    names: resources.map(resource => resource.name.replace(/\.ogg$/i, "")),
  };
}

export function requiredBgmResource(library: BgmArchiveLibrary,
  path: string): BgmResource {
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`${path} source 数量 ${candidates.length}。`);
  return candidates[0]!;
}

export function garageBgmResource(library: BgmArchiveLibrary,
  fallback: BgmResource): BgmResource {
  for (const path of GARAGE_MUSIC_PATHS) {
    const candidates = library.exactCanonicalCandidates(path);
    if (candidates.length > 1)
      throw new Error(`${path} source 数量 ${candidates.length}。`);
    if (candidates.length === 1) return candidates[0]!;
  }
  return fallback;
}
