import { attribute, decodeBinaryXml, type BinaryXmlNode } from "../codecs/binary-xml";

/** A virtual file mounted from a Rho/Rho5 archive or a loose Data file. */
export interface TrackResource {
  readonly name: string;
  readonly extension: string;
  readonly virtualPath: string;
  readonly canonicalPath?: string;
  readonly sourceName: string;
  bytes(): Promise<Uint8Array>;
}

export interface TrackMetadata {
  id: string;
  gameType?: string;
  laps?: number;
  difficulty?: number;
  showLapUi?: boolean;
  folder?: string;
  theme?: string;
  texTheme?: string;
  bgmTheme?: string;
  bgmFile?: string;
  choosable?: boolean;
  blocked?: boolean;
  cnTitle?: string;
  speedPool: boolean;
  crazy?: boolean;
  isOnlyItemTrack?: boolean;
  isOnlyRoadBlockTrack?: boolean;
  isOnlyTraining?: boolean;
}

export interface TrackChoice {
  id: string;
  path: string;
  title: string;
  theme: string;
  gameType: "item" | "speed";
  difficulty: number;
  reverse?: boolean;
}

export interface RandomTrackGroup {
  id: string;
  gameType: "item" | "speed";
  randomType: string;
  level?: number;
  displayTrackIds: string[];
  selectionGameTypes: ("item" | "speed")[];
  trackIds: string[];
  cardToken: string;
}

/** The small part of the legacy resource library that the track business uses. */
export interface TrackLibrary {
  files: TrackResource[];
  trackTitlePromise?: Promise<Map<string, { title: string; trackId: string }>>;
  trackMetadataPromise?: Promise<TrackMetadata[]>;
  mapAssets(): TrackResource[];
  trackTitles(): Promise<Map<string, { title: string; trackId: string }>>;
  trackMetadataCatalog(): Promise<TrackMetadata[]>;
  timeAttackTrackCatalog(): Promise<TrackChoice[]>;
  findSibling(path: string, names: string[]): TrackResource | undefined;
}

const THEMES = [
  "steam", "forest", "desert", "village", "ice", "tomb", "mine", "northeu",
  "factory", "pirate", "fairy", "moonhill", "gold", "china", "castle", "nymph",
  "mechanic", "xyy", "wkc", "brodi", "park", "beach", "transFormer",
  "jurassic", "world", "nemo", "sword", "god", "abyss", "camelot",
  "olympos", "korea", "mabi", "maple", "fengshen",
] as const;

function folderName(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments.length > 1
    ? segments[segments.length - 2]!
    : segments[0]?.replace(/\.[^.]+$/, "") || "Unknown";
}

/** Exclude ambiguous duplicate model paths before building a selectable map list. */
export function uniqueFolderAssets(files: readonly TrackResource[]): TrackResource[] {
  const byFolder = new Map<string, TrackResource[]>();
  for (const file of files) {
    const path = file.canonicalPath ?? file.virtualPath;
    const folder = path.slice(0, Math.max(0, path.lastIndexOf("/"))).toLowerCase();
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
  }
  return [...byFolder.values()].filter(group => group.length === 1).map(group => group[0]!);
}

export function mapAssets(library: Pick<TrackLibrary, "files">): TrackResource[] {
  return uniqueFolderAssets(library.files.filter(file =>
    file.extension === "1s" && file.name.toLowerCase() === "track.1s"));
}

export async function mapCatalog(library: TrackLibrary): Promise<{
  path: string; name: string; internalId: string; subtitle: string; source: string;
}[]> {
  const titles = await library.trackTitles();
  return library.mapAssets().map(file => {
    const internalId = folderName(file.virtualPath).replace(/^track_/, "");
    const title = titles.get(internalId);
    return {
      path: file.virtualPath,
      name: title?.title ?? internalId,
      internalId,
      subtitle: `${title?.trackId ?? internalId} · 结构候选`,
      source: file.sourceName,
    };
  });
}

function booleanAttribute(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  throw new Error(`track metadata boolean 值无效：${value}。`);
}

function localizedTitles(root: BinaryXmlNode | undefined): Map<string, string> {
  const titles = new Map<string, string>();
  root?.children.forEach(node => {
    const id = attribute(node, "id");
    const name = attribute(node, "name")?.trim();
    if (id && name) titles.set(id, name);
  });
  return titles;
}

function speedPoolIds(root: BinaryXmlNode | undefined): Set<string> {
  const ids = new Set<string>();
  root?.children.filter(node => node.name === "RandomTrackSet" &&
    attribute(node, "gameType") === "speed").forEach(set =>
    set.children.forEach(node => {
      const id = attribute(node, "id");
      if (id) ids.add(id);
    }));
  return ids;
}

function metadataFromNode(
  node: BinaryXmlNode,
  titles: Map<string, string>,
  speedPool: Set<string>,
): TrackMetadata | undefined {
  const id = attribute(node, "id");
  if (!id) return undefined;
  const rawLaps = Number(attribute(node, "laps"));
  const rawDifficulty = Number(attribute(node, "difficulty"));
  const showLapUi = attribute(node, "showLapUI");
  return {
    id,
    gameType: attribute(node, "gameType"),
    laps: Number.isInteger(rawLaps) && rawLaps > 0 ? rawLaps : undefined,
    difficulty: Number.isInteger(rawDifficulty) && rawDifficulty >= 0 ? rawDifficulty : undefined,
    showLapUi: showLapUi === undefined ? undefined : showLapUi.toLowerCase() === "true",
    folder: attribute(node, "folder"),
    theme: attribute(node, "theme"),
    texTheme: attribute(node, "texTheme"),
    bgmTheme: attribute(node, "bgmTheme"),
    bgmFile: attribute(node, "bgmFile"),
    choosable: booleanAttribute(attribute(node, "choosable")),
    blocked: booleanAttribute(attribute(node, "blocked")),
    cnTitle: titles.get(id),
    speedPool: speedPool.has(id),
    crazy: booleanAttribute(attribute(node, "crazy")),
    isOnlyItemTrack: booleanAttribute(attribute(node, "isOnlyItemTrack")),
    isOnlyRoadBlockTrack: booleanAttribute(attribute(node, "isOnlyRoadBlockTrack")),
    isOnlyTraining: booleanAttribute(attribute(node, "isOnlyTraining")),
  };
}

/** Read the regional title and random lists once, then parse the first valid track table. */
export function trackMetadataCatalog(library: TrackLibrary): Promise<TrackMetadata[]> {
  return library.trackMetadataPromise ??= (async () => {
    const isCommon = (file: TrackResource) =>
      /track_?\/common\//i.test(file.virtualPath) || /track_common/i.test(file.sourceName);
    const tables = library.files.filter(file => /^track@zz\.bml$/i.test(file.name) && isCommon(file));
    const locale = library.files.find(file => file.name.toLowerCase() === "tracklocale@cn.bml" && isCommon(file));
    const random = library.files.find(file => file.name.toLowerCase() === "randomtrack@cn.bml" && isCommon(file));
    const localeRoot = locale ? decodeBinaryXml(await locale.bytes()) : undefined;
    const randomRoot = random ? decodeBinaryXml(await random.bytes()) : undefined;
    const titles = localizedTitles(localeRoot);
    const pool = speedPoolIds(randomRoot);
    for (const table of tables) {
      try {
        return decodeBinaryXml(await table.bytes()).children
          .filter(node => node.name === "track")
          .flatMap(node => {
            const metadata = metadataFromNode(node, titles, pool);
            return metadata ? [metadata] : [];
          });
      } catch { /* The release tries the next regional table. */ }
    }
    return [];
  })();
}

export function trackTitles(library: TrackLibrary): Promise<Map<string, { title: string; trackId: string }>> {
  return library.trackTitlePromise ??= (async () => {
    const titles = new Map<string, { title: string; trackId: string }>();
    for (const track of await library.trackMetadataCatalog()) {
      const title = { title: track.cnTitle ?? track.id, trackId: track.id };
      titles.set(track.id, title);
      titles.set(track.folder ?? track.id, title);
    }
    return titles;
  })();
}

export async function trackMetadata(library: TrackLibrary, id: string): Promise<TrackMetadata | undefined> {
  const tracks = await library.trackMetadataCatalog();
  const find = (key: string) => tracks.find(track => track.id === key) ??
    tracks.find(track => track.folder === key);
  return find(id) ?? find(id.replace(/_rvs$/i, ""));
}

function selectable(track: TrackMetadata): boolean {
  return track.choosable !== false && track.blocked !== true &&
    track.crazy !== true && track.isOnlyItemTrack !== true &&
    track.isOnlyRoadBlockTrack !== true && track.laps !== undefined;
}

function trackTheme(track: TrackMetadata): string | undefined {
  return track.theme ?? THEMES.find(theme => track.id.startsWith(theme));
}

/** Resolve metadata to exact model assets, including reverse track siblings. */
export async function timeAttackTrackCatalog(library: TrackLibrary): Promise<TrackChoice[]> {
  const models = new Map(library.mapAssets().map(file => [
    folderName(file.virtualPath).replace(/^track_/, "").toLowerCase(), file,
  ]));
  const normal: TrackChoice[] = [];
  const reversed: TrackChoice[] = [];
  for (const metadata of await library.trackMetadataCatalog()) {
    const gameType = metadata.gameType ?? "speed";
    if ((gameType !== "item" && gameType !== "speed") || !selectable(metadata)) continue;
    const model = models.get((metadata.folder ?? metadata.id).toLowerCase());
    const theme = trackTheme(metadata);
    if (!model || !theme || !metadata.cnTitle || metadata.difficulty === undefined) continue;
    normal.push({
      id: metadata.id,
      path: model.virtualPath,
      title: metadata.cnTitle,
      theme,
      gameType,
      difficulty: metadata.difficulty,
    });
    const reverse = library.findSibling(model.virtualPath, ["track_rvs.1s"]);
    if (reverse) reversed.push({
      id: `${metadata.id}_rvs`,
      path: reverse.virtualPath,
      title: `[反]${metadata.cnTitle}`,
      theme,
      gameType,
      difficulty: metadata.difficulty,
      reverse: true,
    });
  }
  return [...normal, ...reversed];
}

const SPECIAL_RANDOM_TYPES = new Set(["hot1", "hot2", "hot3", "hot4", "hot5", "crazy", "clubSpeed"]);
const NEW_TRACK_DISPLAY_LIMIT = 10;

function randomCardToken(type: string, level: number | undefined): string | undefined {
  if (type === "all") return "allRandom_TimeAttack@zz";
  if (type === "speedAll") return "speedAllRandom_TimeAttack@zz";
  if (type === "new" || type === "reverse" || type === "crazy") return `${type}Random_TimeAttack@zz`;
  if (type === "clubSpeed") return "leagueRandom_TimeAttack@zz";
  if (/^hot[1-5]$/.test(type) && level !== undefined) return `${type}Random_TimeAttack@zz`;
  return undefined;
}

/** Preserve card ordering and the release's separate display/selection lists. */
export function randomTrackGroupsFromBml(
  root: BinaryXmlNode,
  tracks: readonly TrackChoice[],
): RandomTrackGroup[] {
  const groups: RandomTrackGroup[] = [];
  const byId = new Map(tracks.map(track => [track.id, track]));
  const add = (
    gameType: "item" | "speed",
    randomType: string,
    level: number | undefined,
    requestedIds: string[],
    selectionGameTypes: ("item" | "speed")[] = [gameType],
    explicitToken?: string,
  ) => {
    const uniqueIds = [...new Set(requestedIds)];
    const displayTrackIds = randomType === "new"
      ? uniqueIds.slice(0, NEW_TRACK_DISPLAY_LIMIT) : uniqueIds;
    const trackIds = uniqueIds.filter(id => {
      const track = byId.get(id);
      return track !== undefined && selectionGameTypes.includes(track.gameType);
    });
    if (trackIds.length === 0) return;
    const cardToken = explicitToken ?? randomCardToken(randomType, level);
    if (!cardToken) return;
    const id = `${gameType}:${randomType}:${level ?? 0}`;
    if (!groups.some(group => group.id === id)) groups.push({
      id, gameType, randomType, level, displayTrackIds,
      selectionGameTypes, trackIds, cardToken,
    });
  };

  for (const list of root.children.filter(node => node.name === "RandomTrackList")) {
    const type = attribute(list, "randomType");
    if (type !== "new" && type !== "reverse") continue;
    const ids = list.children.flatMap(node => {
      const id = attribute(node, "id");
      return id ? [id] : [];
    });
    for (const gameType of ["item", "speed"] as const)
      add(gameType, type, undefined, ids, ["item", "speed"]);
  }
  for (const set of root.children.filter(node => node.name === "RandomTrackSet")) {
    const gameType = attribute(set, "gameType");
    const type = attribute(set, "randomType");
    if ((gameType !== "item" && gameType !== "speed") || !type ||
        !SPECIAL_RANDOM_TYPES.has(type)) continue;
    const rawLevel = Number(attribute(set, "level"));
    const level = Number.isInteger(rawLevel) && rawLevel > 0 ? rawLevel : undefined;
    const ids = set.children.flatMap(node => {
      const id = attribute(node, "id");
      return id ? [id] : [];
    });
    add(gameType, type, level, ids);
  }

  const normal = tracks.filter(track => !track.reverse).map(track => track.id);
  add("item", "all", undefined, normal, ["item"], "allRandom_TimeAttack@zz");
  add("speed", "all", undefined, normal, ["item", "speed"], "allRandom_TimeAttack@zz");
  add("speed", "speedAll", undefined,
    tracks.filter(track => !track.reverse && track.gameType === "speed").map(track => track.id),
    ["speed"], "speedAllRandom_TimeAttack@zz");
  const reverse = tracks.filter(track => track.reverse).map(track => track.id);
  add("item", "reverse", undefined, reverse);
  add("speed", "reverse", undefined, reverse);
  return groups;
}

export async function timeAttackRandomTrackGroups(library: TrackLibrary): Promise<RandomTrackGroup[]> {
  const random = library.files.find(file =>
    file.name.toLowerCase() === "randomtrack@cn.bml" &&
    (/track_?\/common\//i.test(file.virtualPath) || /track_common/i.test(file.sourceName)));
  if (!random) return [];
  const root = decodeBinaryXml(await random.bytes());
  const tracks = await library.timeAttackTrackCatalog();
  return randomTrackGroupsFromBml(root, tracks).filter(group => group.trackIds.length > 0);
}

export async function timeAttackRandomTrackNames(library: TrackLibrary): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const track of await library.trackMetadataCatalog()) {
    const title = track.cnTitle ?? track.id;
    for (const id of [track.id, track.folder].filter((value): value is string => !!value)) {
      names.set(id, title);
      names.set(`${id}_rvs`, `[反]${title}`);
    }
  }
  return names;
}
