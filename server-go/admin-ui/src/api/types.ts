// Response shapes of the admin API (ADMIN.md section 4). Times are
// millisecond timestamps; missing values are null or ''.

export type Currency = 'coupon' | 'lucci' | 'koin'

export interface ManagedTrack {
  id: string
  title: string
  theme: string
  themeTitle: string
  gameType: string
  reverse: boolean
  aliases: string[]
  enabled: boolean
}

export interface TrackDirectory {
  tracks: ManagedTrack[]
  themes: Array<{ id: string; title: string; total: number; enabledCount: number }>
  version: string
  updatedAt: number
}
export type GrantCurrency = Currency | 'exp'

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AdminMe {
  id: string
  username: string
  nickname: string
}

export interface LoginResult {
  token: string
  account: { id: string; username: string; nickname: string; admin?: boolean }
}

export interface AccountRow {
  id: string
  username: string
  nickname: string
  admin: boolean
  gm: boolean
  createdAt: number
  registerIp: string | null
  lastLoginAt: number | null
  lastLoginIp: string | null
  /** The last request made with one of the account's sessions (written at most every 5 minutes). */
  lastSeenAt: number | null
  lastSeenIp: string | null
  bannedUntil: number | null
  banReason: string | null
  banned: boolean
  level: number
  exp: number
  coupon: number
  lucci: number
  koin: number
  inventoryCount: number
  onboarded: boolean
  /**
   * leaving: kicked, banned or replaced by a newer login elsewhere; the node
   * drops the session at its next heartbeat (断开中).
   */
  online: { nodeId: string; nodeName: string; leaving?: boolean } | null
}

export interface LoginRow {
  id: number
  at: number
  /** resume: the first activity of a Beijing day on a saved token (自动登录). */
  kind: 'register' | 'login' | 'resume' | string
  accountId: string
  username: string
  nickname: string
  ip: string
  userAgent: string
}

/** One anti-cheat record of a game node (ANTICHEAT.md 4). */
export interface AntiCheatRow {
  id: number
  at: number
  /** The failed check: TELEPORT, SPEED, CLOCK, PROGRESS, LAP, FINISH_*, CUBE_RATE, BAD_FRAME. */
  code: string
  /** The measured values, in Chinese. */
  detail: string
  /** kick: the racer was kicked; log: only recorded (KART_ANTICHEAT=log). */
  action: 'kick' | 'log' | string
  /** '' for a guest. */
  accountId: string
  username: string
  nickname: string
  /** The racer's name at the time. */
  name: string
  playerId: string
  nodeId: string
  roomId: string
  raceId: string
  trackId: string
  trackName: string
  gameplay: string
}

export interface RaceParticipantRow {
  raceId: string
  at: number
  gameplay: string
  trackId: string
  /** The track's Chinese title ('' when unknown). */
  trackName: string
  rank: number | null
  name: string
  accountId: string | null
  username: string | null
  elapsedMs: number | null
  points: number | null
  /** What the race credited the account; null for guests or nothing credited. */
  exp: number | null
  lucci: number | null
}

export interface AccountDetail {
  account: AccountRow
  club: { id: string | number; name: string; grade: number | string } | null
  sessions: number
  logins: LoginRow[]
  races: RaceParticipantRow[]
}

export interface AccountPatch {
  nickname?: string
  admin?: boolean
  gm?: boolean
  bannedUntil?: number
  banReason?: string
  password?: string
}

export interface KickResult {
  sessions: number
  game: boolean
}

export interface InventoryRow {
  id: number | string
  category: number
  categoryName: string
  itemId: number
  name: string
  systemKey: string
  quantity: number
  expiresAt: number | null
  source: string
  createdAt: number
  updatedAt: number
}

export interface OnlineRow {
  playerId: string
  name: string
  guest: boolean
  accountId: string | null
  username: string | null
  nodeId: string
  nodeName: string
  /** The room's name; '' in the lobby or on a node that does not report it. */
  room: string
  /**
   * Kicked, banned or replaced by a newer login elsewhere: the node drops
   * the player at its next heartbeat (断开中).
   */
  leaving?: boolean
}

export interface ProbeStatus {
  ok: boolean
  latencyMs: number | null
  error: string | null
}

export interface NodeStats {
  /** Live heap after the last GC, in MB with one decimal. */
  heapMB: number
  goroutines: number
  connections: number
  races: number
  version: string
}

export interface NodeRow {
  nodeId: string
  name: string
  /** null: reached through the data service's own origin. */
  origin: string | null
  players: number
  capacity: number
  rooms: number
  full: boolean
  startedAt: number
  seenAt: number
  protocolVersion: number | string
  /** offline: no longer registered but seen in the last 24 hours (seenAt is its last heartbeat). */
  status: 'ok' | 'stale' | 'full' | 'offline' | string
  stats: NodeStats | null
  /** Players in its 卡丁城 (0 offline; absent from older data services). */
  cityPlayers?: number
}

/** A game node added in the console (GET /api/admin/game-nodes). */
export interface GameNodeRow {
  id: string
  name: string
  /** Set in the console; empty: the node decides. */
  origin?: string
  note?: string
  disabled: boolean
  createdBy: string
  createdAt: number
  keyCreatedAt: number
  registeredAt?: number
  registeredIp?: string
  status: 'online' | 'offline' | 'never' | 'disabled' | string
  players: number
  capacity: number
  /** The origin the running node reports. */
  liveOrigin?: string | null
  seenAt?: number
}

export interface GameNodesResponse {
  nodes: GameNodeRow[]
}

/** A player of a node pick: its latency report (node ID → ms; null: none yet) and whether it counted. */
export interface NodeChoicePlayer {
  name: string
  counted: boolean
  latency: Record<string, number> | null
}

/** A node at the time of a pick: its score as a candidate (worst counted ms), or why it was not one. */
export interface NodeChoiceNode {
  nodeId: string
  name: string
  players: number
  capacity: number
  score: number | null
  excluded?: 'protocol' | 'full' | string
  /** Players in its 卡丁城 at the time (city picks). */
  cityPlayers?: number
}

/** One of the global lobby's latest node picks (GLOBAL_LOBBY.md 4). */
export interface NodeChoice {
  at: number
  kind: 'race' | 'city' | string
  roomId?: string
  roomName?: string
  /** Empty when no node could take the players. */
  nodeId: string
  nodeName: string
  error?: string
  players: NodeChoicePlayer[]
  nodes: NodeChoiceNode[]
  /** How a city node was chosen (CityRule). */
  rule?: CityRule
  /** The console's city node when one was set, and why it could not take the player. */
  setting?: string
  settingExcluded?: CityExcluded
}

/**
 * How the 卡丁城 node is chosen (GLOBAL_LOBBY.md 卡丁城): setting = the node set
 * here; crowd = the node most city players are on; last = the city is
 * empty, the node the last player went to; latency = the city is empty,
 * by the player's latency (by load without a report).
 */
export type CityRule = 'setting' | 'crowd' | 'last' | 'latency' | string
export type CityExcluded = 'offline' | 'protocol' | 'full' | string

/** The 卡丁城服务器 setting (PUT /api/admin/city-server). */
export interface CityServer {
  /** Empty: automatic. */
  nodeId: string
  updatedAt: number
  updatedBy: string
  /** Where a player entering the city now would go. */
  next: {
    /** Empty when no node can take players (error NO_GAME_SERVER). */
    nodeId: string
    nodeName: string
    rule: CityRule
    settingExcluded?: CityExcluded
    error?: string
  }
}

export interface NodesResponse {
  now: number
  nodes: NodeRow[]
  /** Newest first; absent from older data services. */
  choices?: NodeChoice[]
  /** null when MySQL cannot say; absent from older data services. */
  city?: CityServer | null
  data: {
    version: string
    goVersion: string
    startedAt: number
    goroutines: number
    heapMB: number
    mysql: ProbeStatus
    redis: ProbeStatus
  }
}

export interface LedgerRow {
  id: number | string
  at: number
  accountId: string
  username: string
  nickname: string
  currency: GrantCurrency | string
  delta: number
  balanceAfter: number
  reason: string
  refId: string
  note: string
}

export interface GrantRow {
  at: number
  admin: string
  requestId: string
  accountId: string
  username: string
  nickname: string
  currency: GrantCurrency | string
  amount: number
  note: string
}

export interface RaceRow {
  raceId: string
  roomId: string | number
  at: number
  gameplay: string
  trackId: string
  trackName: string
  players: number
  participants: RaceParticipantRow[]
}

export interface PurchaseRow {
  id: number | string
  at: number
  accountId: string
  username: string
  nickname: string
  offerId: number | string
  category: number
  itemId: number
  name: string
  currency: Currency | string
  price: number
  days: number
  count: number
}

export interface LotteryDrawRow {
  at: number
  requestId: string
  accountId: string
  username: string
  nickname: string
  kind: string
  /** The 寻宝 board, or the 精品道具场 lottery's item id. */
  ref: number
  /** "寻宝" or the lottery's name. */
  refName: string
  count: number
  summary: string
  result: unknown
}

export interface BoxOpeningRow {
  at: number
  requestId: string
  accountId: string
  username: string
  nickname: string
  boxId: number | string
  boxName: string
  stockId: number | string
  summary: string
  result: unknown
}

export interface ClubRow {
  id: number | string
  name: string
  masterId: string
  masterUsername: string
  masterNickname: string
  members: number
  hq: number
  racing: number
  rider: number
  bank: number
  budget: number
  cs: number
  csWeek: number
  autoJoin: boolean
  createdAt: number
  breakAt: number | null
  /** active, breaking (解散倒计时中) or disbanded (break_at has passed). */
  state: 'active' | 'breaking' | 'disbanded' | string
}

/** GET /api/admin/clubs/{id}/members. */
export interface ClubMemberRow {
  accountId: string
  username: string
  nickname: string
  /** 1 会长 … (the club code's grades). */
  grade: number | string
  joinedAt: number | null
  csWeek: number
  csTotal: number
  donatedTotal: number
}

/** A best time on a track (time attack, PRO qualification). */
export interface TrackBest {
  trackId: string
  trackName: string
  bestMs: number | null
  updatedAt: number | null
}

/** GET /api/admin/accounts/{id}/game. */
export interface AccountGame {
  stats: { races: number; wins: number; podiums: number; points: number } | null
  license: { level: number; proUntil: number | null; proCount: number; lastRunAt: number | null } | null
  licenseClears: { step: number; period: string; bestMs: number | null; clearedAt: number | null }[] | null
  licenseRecords: TrackBest[] | null
  timeAttack: TrackBest[] | null
  /** title: the quest's name ('' when the quest table does not know it). */
  quests: {
    questId: number | string
    title: string
    period: string
    value: number
    completedAt: number | null
    updatedAt: number | null
  }[] | null
  counters: { counter: string; value: number; updatedAt: number | null }[] | null
  friends: number
  club: {
    id: number | string
    name: string
    grade: number | string
    joinedAt: number | null
    csWeek: number
    csTotal: number
    donatedTotal: number
  } | null
}

/** GET /api/admin/invites. Codes are stored hashed: hash is the digest's first 12 characters. */
export interface InviteRow {
  hash: string
  createdAt: number
  used: boolean
  usedBy: { accountId: string; username: string; nickname: string } | null
  /** The using account's registration time (no separate use time is stored); null while unused. */
  usedAt: number | null
}

/** GET /api/admin/reward-box. An item (category, itemId, days) or a currency amount. */
export interface RewardBoxRow {
  id: number | string
  accountId: string
  username: string
  nickname: string
  source: 'quest' | 'club' | 'admin' | string
  message: string
  name: string
  category: number
  itemId: number
  count: number
  days: number
  currency: Currency | '' | string
  createdAt: number
  expiresAt: number | null
  claimedAt: number | null
  state: 'unclaimed' | 'claimed' | 'expired' | string
}

export interface Overview {
  now: number
  accounts: { total: number; today: number; admins: number; banned: number }
  logins: { today: number; uniqueToday: number }
  // online, nodes and rooms are null while the cluster registry (Redis) is unavailable.
  online: { players: number; accounts: number; guests: number } | null
  /** offline: nodes gone from the registry but seen in the last 24 hours. */
  nodes: { total: number; healthy: number; offline?: number } | null
  rooms: number | null
  races: { today: number }
  coupon: { spentToday: number; grantedToday: number }
  recentRegistrations: AccountRow[]
  recentLogins: LoginRow[]
}

/* ---------- endpoints kept from the old console ---------- */

export interface LevelReward {
  level: number
}

/** POST /api/admin/grant. The account is the old console's view (wallet) or an AccountRow. */
export interface GrantResult {
  applied: number
  levelUps: LevelReward[] | null
  duplicate: boolean
  requestId: string
  account: {
    username: string
    level: number
    exp: number
    wallet?: { coupon: number; lucci: number; koin: number }
    coupon?: number
    lucci?: number
    koin?: number
  }
}

export interface DrawnItem {
  category: number
  itemId: number
  name: string
  count: number
  days: number
}

export interface LotteryActivity {
  activity: string
  name: string
  enabled: boolean
  open: boolean
  start: number | null
  end: number | null
  daily: DrawnItem[] | null
  defaultDaily: DrawnItem[] | null
  hasDaily: boolean
  custom: boolean
  updatedBy?: string
  updatedAt?: number
  originalStart?: string
  originalEnd?: string
}

export interface LotteryAdmin {
  activities: LotteryActivity[]
  lotteries: { itemId: number; name: string }[] | null
  serverTime: number
}

export interface StockItem {
  category: number
  itemId: number
  count: number
  days: number
}

export interface LotterySave {
  activity: string
  enabled?: boolean
  start?: number
  end?: number
  daily?: StockItem[]
  reset?: boolean
}

export interface RewardBoxGift {
  username: string
  count: number
  message: string
  currency?: Currency
  category?: number
  itemId?: number
  days?: number
}

export interface RewardBoxEntry {
  name: string
  count: number
}

export interface Notice {
  id: number
  title: string
  message: string
  startAt?: number
  endAt?: number
  updatedBy?: string
  updatedAt?: number
}

/** GET/PUT /api/admin/economy: the registration and per-race grants (ECONOMY.md 2.3/2.4). */
export interface CurrencyGrant {
  coupon: number
  lucci: number
  koin: number
}

/** The shop's 点击获取点券 button (ECONOMY.md 2.5). */
export interface ShopClaimSettings extends CurrencyGrant {
  enabled: boolean
}

/** 卡丁城加油 (FUEL.md 4): prices of fuel and of the tow, and the burn rate. */
export interface CityFuelSettings {
  enabled: boolean
  pricePerLiter: number
  rescueFee: number
  /** Percent of the FUEL.md burn rate; 0 means the default 100. */
  consumptionPercent: number
}

export interface EconomySettings {
  register: CurrencyGrant
  race: CurrencyGrant
  shopClaim: ShopClaimSettings
  cityFuel: CityFuelSettings
  updatedAt: number
  updatedBy: string
  defaults: { register: CurrencyGrant; race: CurrencyGrant; shopClaim: ShopClaimSettings; cityFuel: CityFuelSettings }
  serverTime: number
}

/** 大厅宣传 (ADMIN.md 10): one carousel picture or promotion board. */
export interface LobbyPromo {
  /** The uploaded picture's id; '' for none (a board keeps its drawn look). */
  image: string
  /** The picture's path ('' for none). */
  url: string
  width: number
  height: number
  /** http(s) URL or a path of the game's site; '' for none. */
  link: string
  title: string
}

export interface LobbyPromos {
  /** Seconds per carousel picture. */
  interval: number
  carousel: LobbyPromo[]
  /** Blue, then purple. */
  boards: LobbyPromo[]
  updatedAt: number
  updatedBy?: string
}

/** POST /api/admin/lobby-promos/images. */
export interface UploadedPromoImage {
  image: string
  url: string
  contentType: string
  width: number
  height: number
  size: number
}

/** 联赛回放 (TIMEATTACK.md 4): a published copy of a ranked replay. */
export interface FeaturedReplay {
  id: number
  title: string
  note?: string
  trackId: string
  trackName: string
  speed: number
  booster: number
  accountId: string
  nickname: string
  kartName: string
  bestMs: number
  byteSize: number
  createdBy: string
  createdAt: number
}

/** A stored ranked replay (GET /api/admin/timeattack-replays). */
export interface TimeAttackReplayRow {
  trackId: string
  trackName: string
  speed: number
  booster: number
  accountId: string
  username: string
  nickname: string
  kartName: string
  bestMs: number
  byteSize: number
  updatedAt: number
  /** How many 联赛回放 entries were published from it. */
  featured: number
}

/**
 * A published 地图工坊 map (GET /api/admin/maps, MAPS.md 3). author is the
 * author's nickname, username the account name; size is the track
 * container's bytes, files how many files it holds.
 */
export interface MapRow {
  id: string
  name: string
  ownerId: string
  username: string
  author: string
  theme: string
  laps: number
  difficulty: number
  roadExtent: number
  /** Item boxes; 0: speed races only. */
  items: number
  files: number
  size: number
  sha256: string
  /** Hidden from players (the public list, rooms and downloads). */
  hidden: boolean
  createdAt: number
  updatedAt: number
}
