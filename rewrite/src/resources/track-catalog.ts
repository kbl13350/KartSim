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

/**
 * Resolve accepted metadata to exact model assets, followed by the reverse
 * siblings `reverseAllowed` keeps.
 */
async function resolveTrackCatalog(library: TrackLibrary,
  accept: (metadata: TrackMetadata) => "item" | "speed" | undefined,
  reverseAllowed: (metadata: TrackMetadata) => boolean): Promise<TrackChoice[]> {
  const models = new Map(library.mapAssets().map(file => [
    folderName(file.virtualPath).replace(/^track_/, "").toLowerCase(), file,
  ]));
  const normal: TrackChoice[] = [];
  const reversed: TrackChoice[] = [];
  for (const metadata of await library.trackMetadataCatalog()) {
    const gameType = accept(metadata);
    if (!gameType) continue;
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
    const reverse = reverseAllowed(metadata)
      ? library.findSibling(model.virtualPath, ["track_rvs.1s"]) : undefined;
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

/** Resolve metadata to exact model assets, including reverse track siblings. */
export async function timeAttackTrackCatalog(library: TrackLibrary): Promise<TrackChoice[]> {
  return resolveTrackCatalog(library, metadata => {
    const gameType = metadata.gameType ?? "speed";
    return (gameType === "item" || gameType === "speed") && selectable(metadata)
      ? gameType : undefined;
  }, () => true);
}

/** Regional availability from trackLocale@cn; only item rooms apply it. */
export interface TrackLocaleRule {
  blocked?: boolean;
  choosable?: boolean;
  /** The practice track (城镇 自由练习场) is marked here, not in track@zz. */
  isOnlyTraining?: boolean;
  /** Item cube theme folder that replaces the track's own theme. */
  customItemCube?: string;
}

export interface TrackLocaleRules {
  /** `<track id>` rows. */
  tracks: ReadonlyMap<string, TrackLocaleRule>;
  /** `<track_rvs refId>` rows: the reverse tracks this region offers. */
  reverse: ReadonlyMap<string, TrackLocaleRule>;
}

const trackLocaleRuleCache = new WeakMap<object, Promise<TrackLocaleRules>>();

function lenientBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" ? true : normalized === "false" ? false : undefined;
}

function localeRule(node: BinaryXmlNode): TrackLocaleRule {
  const blocked = lenientBoolean(attribute(node, "blocked"));
  const choosable = lenientBoolean(attribute(node, "choosable"));
  const isOnlyTraining = lenientBoolean(attribute(node, "isOnlyTraining"));
  const customItemCube = attribute(node, "customItemCube")?.trim();
  return {
    ...(blocked === undefined ? {} : { blocked }),
    ...(choosable === undefined ? {} : { choosable }),
    ...(isOnlyTraining === undefined ? {} : { isOnlyTraining }),
    ...(customItemCube ? { customItemCube } : {}),
  };
}

/** Parse the `blocked`, `choosable`, `isOnlyTraining` and `customItemCube` rows of trackLocale@cn. */
export function trackLocaleRulesFromBml(root: BinaryXmlNode): TrackLocaleRules {
  const tracks = new Map<string, TrackLocaleRule>();
  const reverse = new Map<string, TrackLocaleRule>();
  for (const node of root.children) {
    if (node.name === "track") {
      const id = attribute(node, "id");
      if (id) tracks.set(id, localeRule(node));
    } else if (node.name === "track_rvs") {
      const id = attribute(node, "refId");
      if (id) reverse.set(id, localeRule(node));
    }
  }
  return { tracks, reverse };
}

/** The trackLocale@cn rules of a library, read once. */
export function trackLocaleRules(library: Pick<TrackLibrary, "files">): Promise<TrackLocaleRules> {
  let rules = trackLocaleRuleCache.get(library);
  if (!rules) {
    rules = (async () => {
      const locale = library.files.find(file =>
        file.name.toLowerCase() === "tracklocale@cn.bml" &&
        (/track_?\/common\//i.test(file.virtualPath) || /track_common/i.test(file.sourceName)));
      return locale ? trackLocaleRulesFromBml(decodeBinaryXml(await locale.bytes()))
        : { tracks: new Map(), reverse: new Map() };
    })();
    trackLocaleRuleCache.set(library, rules);
  }
  return rules;
}

function available(rule: TrackLocaleRule | undefined): boolean {
  return rule?.blocked !== true && rule?.choosable !== false && rule?.isOnlyTraining !== true;
}

/**
 * Whether an item room may race on a track: `gameType="item"` (the five
 * `isOnlyItemTrack` tracks included), not blocked or unchoosable in track@zz
 * or trackLocale@cn, and not a crazy, roadblock-only or training track. On
 * p3553 every track this keeps has item cubes in its track.1s; the only
 * cube-less item track with a model is the training track village_I11.
 */
export function itemTrackSelectable(metadata: TrackMetadata, rule?: TrackLocaleRule): boolean {
  return metadata.gameType === "item" && metadata.laps !== undefined &&
    metadata.choosable !== false && metadata.blocked !== true && metadata.crazy !== true &&
    metadata.isOnlyRoadBlockTrack !== true && metadata.isOnlyTraining !== true &&
    available(rule);
}

/**
 * Tracks of 道具赛 rooms (ITEM_MODE.md 2). A reverse track needs its
 * trackLocale@cn `track_rvs` row, which lists the region's reverse tracks.
 */
export async function itemTrackCatalog(library: TrackLibrary): Promise<TrackChoice[]> {
  const rules = await trackLocaleRules(library);
  return resolveTrackCatalog(library,
    metadata => itemTrackSelectable(metadata, rules.tracks.get(metadata.id)) ? "item" : undefined,
    metadata => rules.reverse.has(metadata.id) && available(rules.reverse.get(metadata.id)));
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

/** Random cards of 道具赛 rooms: the item groups drawn from the item track catalog. */
export async function itemRandomTrackGroups(library: TrackLibrary): Promise<RandomTrackGroup[]> {
  const random = library.files.find(file =>
    file.name.toLowerCase() === "randomtrack@cn.bml" &&
    (/track_?\/common\//i.test(file.virtualPath) || /track_common/i.test(file.sourceName)));
  if (!random) return [];
  const root = decodeBinaryXml(await random.bytes());
  return randomTrackGroupsFromBml(root, await itemTrackCatalog(library))
    .filter(group => group.gameType === "item" && group.trackIds.length > 0);
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
