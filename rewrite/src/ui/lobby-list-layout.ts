/**
 * Categories, filters and view state of the multiplayer room list page: three
 * tabs across the top (竞速赛, 道具赛, ETC), a category column on the left and
 * a filtered room table on the right. The server lists rooms per gameplay;
 * categories and filter boxes narrow that page by room mode and speed.
 */

export type LobbyGameplay = "ordinary" | "grip" | "shadow" | "roadblock" | "lte" | "giant" | "rp";

/** Room summary fields the list shows; the server sends these per room. */
export interface LobbyListRoom {
  roomId?: string;
  name?: string;
  mode?: string;
  speed?: number;
  gameplay?: string;
  locked?: boolean;
  gaming?: boolean;
  count: number;
  capacity: number;
  trackId?: string;
  randomTrackCode?: number;
}

export type LobbyFilterKey = "indi" | "team" | "indiInfinit" | "teamInfinit";

export interface LobbyCategory {
  id: string;
  title: string;
  subtitle: string;
  gameplay: LobbyGameplay;
  /** Channel listed and offered first when creating a room. */
  channel: string;
  /** Channels whose rooms this category shows. */
  channels: readonly string[];
  /** Fixed room filter; custom categories use the filter boxes instead. */
  filter?: readonly LobbyFilterKey[];
  /** Shows the 个人赛/团体赛/无限 filter boxes. */
  custom?: boolean;
}

export interface LobbyTab {
  id: "speed" | "item" | "etc";
  title: string;
  /** Mode tile whose art decorates the tab when its own picture is missing. */
  art: string;
  /** Tab picture file under /ui/multiplayer/. */
  picture: string;
  categories: readonly LobbyCategory[];
  /** Tabs the Web build does not run yet open this notice instead. */
  unavailable?: string;
  /** Needs the P3553 resource version. */
  p3553Only?: boolean;
}

const ORDINARY = ["speedIndiCombine", "speedTeamCombine", "speedIndiInfinit", "speedTeamInfinit"];
const PAIR = ["speedIndiCombine", "speedTeamCombine"];

export const LOBBY_TABS: readonly LobbyTab[] = [
  { id: "speed", title: "竞速赛", art: "ordinaryRace", picture: "tab-speed.webp", categories: [
    { id: "speedIndi", title: "竞速个人赛", subtitle: "个人", gameplay: "ordinary",
      channel: "speedIndiCombine", channels: ["speedIndiCombine"], filter: ["indi"] },
    { id: "speedTeam", title: "竞速组队赛", subtitle: "团体", gameplay: "ordinary",
      channel: "speedTeamCombine", channels: ["speedTeamCombine"], filter: ["team"] },
    { id: "speedCustom", title: "竞速自订", subtitle: "一般/无限", gameplay: "ordinary",
      channel: "speedIndiCombine", channels: ORDINARY, custom: true },
    { id: "speedInfinit", title: "无限加速赛", subtitle: "个人赛/团体赛", gameplay: "ordinary",
      channel: "speedIndiInfinit", channels: ["speedIndiInfinit", "speedTeamInfinit"],
      filter: ["indiInfinit", "teamInfinit"] },
  ] },
  { id: "item", title: "道具赛", art: "rpRace", picture: "tab-item.webp", categories: [],
    unavailable: "道具赛暂未开放，请先体验竞速赛或 ETC 里的娱乐模式。" },
  { id: "etc", title: "ETC", art: "giantRace", picture: "tab-etc.webp", p3553Only: true, categories: [
    { id: "grip", title: "抓地模式", subtitle: "个人/团体", gameplay: "grip",
      channel: "speedIndiCombine", channels: PAIR },
    { id: "shadow", title: "幽灵模式", subtitle: "标准/无限", gameplay: "shadow",
      channel: "speedIndiCombine", channels: ORDINARY },
    { id: "roadblock", title: "挡人模式", subtitle: "五人以上", gameplay: "roadblock",
      channel: "speedIndiCombine", channels: ["speedIndiCombine"] },
    { id: "giant", title: "巨人模式", subtitle: "个人", gameplay: "giant",
      channel: "speedIndiCombine", channels: ["speedIndiCombine"] },
    { id: "rp", title: "RP竞速", subtitle: "个人/团体", gameplay: "rp",
      channel: "speedIndiCombine", channels: PAIR },
  ] },
];

/** The room list opens on 竞速自订, which shows every ordinary room. */
export const DEFAULT_LOBBY_CATEGORY = "speedCustom";

export const LOBBY_FILTERS: ReadonlyArray<{ key: LobbyFilterKey; label: string }> = [
  { key: "indi", label: "个人赛" },
  { key: "team", label: "团体赛" },
  { key: "indiInfinit", label: "无限个人" },
  { key: "teamInfinit", label: "无限团体" },
];

export interface LobbyListUiState {
  tab: LobbyTab["id"];
  category: string;
  filters: Record<LobbyFilterKey, boolean>;
  /** The first list request was sent by the view. */
  requested: boolean;
  /** A list the view asked for has not arrived yet. */
  loading: boolean;
  loadingSince: number;
  /** Inside the synchronous part of a list request, which clears the old rows. */
  listing: boolean;
}

export function createLobbyListUiState(): LobbyListUiState {
  return { tab: "speed", category: DEFAULT_LOBBY_CATEGORY, requested: false,
    loading: false, loadingSince: 0, listing: false,
    filters: { indi: true, team: true, indiInfinit: true, teamInfinit: true } };
}

/** Longest time rows read as loading; a failed request then shows the list as is. */
export const LOBBY_LOADING_MS = 6_000;

/**
 * Send a list request and mark rows loading until the next list arrives. The
 * request clears the old rows synchronously; that update is not the answer.
 */
export function requestLobbyList(state: LobbyListUiState, request: () => void,
  now = Date.now()): void {
  state.loading = true;
  state.loadingSince = now;
  state.listing = true;
  try { request(); } finally { state.listing = false; }
}

export function lobbyListLoading(state: LobbyListUiState, now = Date.now()): boolean {
  return state.loading && now - state.loadingSince < LOBBY_LOADING_MS;
}

export function lobbyCategory(id: string): { tab: LobbyTab; category: LobbyCategory } | undefined {
  for (const tab of LOBBY_TABS) {
    const category = tab.categories.find(candidate => candidate.id === id);
    if (category) return { tab, category };
  }
  return undefined;
}

export function lobbyTab(id: string): LobbyTab | undefined {
  return LOBBY_TABS.find(tab => tab.id === id);
}

export function lobbyTabAvailable(tab: LobbyTab, version: string | undefined): boolean {
  return !tab.unavailable && tab.categories.length > 0 &&
    (!tab.p3553Only || version === undefined || version === "p3553");
}

/** The category a channel and gameplay open on: an exact channel match first. */
export function categoryForChannel(channel: string | undefined,
  gameplay: string = "ordinary"): LobbyCategory | undefined {
  const all = LOBBY_TABS.flatMap(tab => tab.categories)
    .filter(category => category.gameplay === gameplay);
  if (gameplay === "ordinary" && !channel) return lobbyCategory(DEFAULT_LOBBY_CATEGORY)?.category;
  // Exact single-channel categories first, then the narrower shared ones;
  // 竞速自订 lists every channel and only catches what is left.
  return all.find(category => !category.custom && channel !== undefined &&
    category.channels.length === 1 && category.channels[0] === channel) ??
    all.find(category => !category.custom && channel !== undefined &&
      category.channels.includes(channel)) ??
    all.find(category => channel !== undefined && category.channels.includes(channel)) ??
    all[0];
}

/**
 * Keep the chosen category while the listed channel and gameplay still belong
 * to it; otherwise follow the list to the category it was opened for.
 */
export function reconcileLobbyCategory(state: LobbyListUiState,
  channel: string | undefined, gameplay: string): void {
  if (!channel) return;
  const current = lobbyCategory(state.category);
  if (current && current.category.gameplay === gameplay &&
      current.category.channels.includes(channel)) {
    state.tab = current.tab.id;
    return;
  }
  const next = categoryForChannel(channel, gameplay);
  const found = next && lobbyCategory(next.id);
  if (!found) return;
  state.category = found.category.id;
  state.tab = found.tab.id;
}

export function roomFilterKey(room: LobbyListRoom): LobbyFilterKey {
  const team = room.mode === "team";
  if (room.speed === 4) return team ? "teamInfinit" : "indiInfinit";
  return team ? "team" : "indi";
}

/** Indexes into `rooms` of the rows the current category and filters show. */
export function visibleLobbyRooms(state: LobbyListUiState,
  rooms: readonly LobbyListRoom[]): number[] {
  const category = lobbyCategory(state.category)?.category;
  const allowed = category?.custom
    ? new Set(LOBBY_FILTERS.filter(filter => state.filters[filter.key]).map(filter => filter.key))
    : category?.filter ? new Set(category.filter) : undefined;
  return rooms.flatMap((room, index) =>
    !allowed || allowed.has(roomFilterKey(room)) ? [index] : []);
}

const GAMEPLAY_NAMES: Record<string, string> = {
  grip: "抓地", shadow: "幽灵", roadblock: "挡人", giant: "巨人", rp: "RP", lte: "LTE",
};

/** 模式 column: 个人赛, 团体赛, 无限个人, 无限团体, or the special mode name. */
export function lobbyRoomModeLabel(room: LobbyListRoom): string {
  const team = room.mode === "team";
  const infinit = room.speed === 4;
  const special = room.gameplay && room.gameplay !== "ordinary"
    ? GAMEPLAY_NAMES[room.gameplay] : undefined;
  if (special) return `${team ? "组队" : "个人"}${special}${infinit ? "无限" : ""}`;
  if (infinit) return team ? "无限团体" : "无限个人";
  return team ? "团体赛" : "个人赛";
}

export function lobbyRoomJoinable(room: LobbyListRoom): boolean {
  return room.count < room.capacity;
}

/** 快速开始 picks the first open, public, not-full room the page shows. */
export function quickStartRoom(rooms: readonly LobbyListRoom[],
  visible: readonly number[]): number | undefined {
  return visible.find(index => {
    const room = rooms[index]!;
    return !room.locked && !room.gaming && lobbyRoomJoinable(room);
  });
}

/** Theme name before the first space of a "城镇 高速公路" style track title. */
export function trackThemeName(title: string | undefined): string | undefined {
  const theme = title?.trim().split(/\s+/)[0];
  return theme && theme !== title?.trim() ? theme : undefined;
}

/** 1600x900 stage; the bottom 7.333% belongs to the shared taskbar. */
export const LOBBY_LAYOUT = {
  width: 1600,
  height: 900,
  visibleHeight: 834,
  tabs: { x: 40, y: 54, width: 1520, height: 78 },
  categories: { x: 0, y: 168, width: 380, itemHeight: 74, gap: 6 },
  title: { x: 422, y: 150, width: 1138, height: 48 },
  header: { x: 422, y: 204, width: 1122, height: 32 },
  rows: { x: 422, y: 242, width: 1122, height: 44, gap: 5, count: 10 },
  scrollbar: { x: 1550, y: 242, width: 7 },
  columns: { mode: 140, title: 460, track: 370 },
  create: { x: 422, y: 748, width: 96, height: 78 },
  quickStart: { x: 1250, y: 748, width: 310, height: 78 },
} as const;

export function lobbyRowRect(index: number): { x: number; y: number; width: number; height: number } {
  const rows = LOBBY_LAYOUT.rows;
  return { x: rows.x, y: rows.y + index * (rows.height + rows.gap),
    width: rows.width, height: rows.height };
}

export function lobbyRowsHeight(): number {
  const rows = LOBBY_LAYOUT.rows;
  return rows.count * rows.height + (rows.count - 1) * rows.gap;
}
