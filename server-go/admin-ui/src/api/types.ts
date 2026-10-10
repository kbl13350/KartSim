// Response shapes of the admin API (ADMIN.md section 4). Times are
// millisecond timestamps; missing values are null or ''.

export type Currency = 'coupon' | 'lucci' | 'koin'
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
}

export interface NodesResponse {
  now: number
  nodes: NodeRow[]
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
