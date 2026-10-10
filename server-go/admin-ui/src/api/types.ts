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
  online: { nodeId: string; nodeName: string } | null
}

export interface LoginRow {
  id: number
  at: number
  kind: 'register' | 'login' | string
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
  rank: number | null
  name: string
  accountId: string | null
  username: string | null
  elapsedMs: number | null
  points: number | null
  // Optional reward fields some settlements carry.
  lucci?: number | null
  exp?: number | null
  koin?: number | null
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
  // Shown when the node reports it.
  roomId?: string | number | null
  roomName?: string | null
}

export interface ProbeStatus {
  ok: boolean
  latencyMs: number | null
  error: string | null
}

export interface NodeStats {
  heapMB: number
  goroutines: number
  connections: number
  races: number
  version: string
}

export interface NodeRow {
  nodeId: string
  name: string
  origin: string
  players: number
  capacity: number
  rooms: number
  full: boolean
  startedAt: number
  seenAt: number
  protocolVersion: number | string
  status: 'ok' | 'stale' | 'full' | string
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
  ref: number
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
}

export interface Overview {
  now: number
  accounts: { total: number; today: number; admins: number; banned: number }
  logins: { today: number; uniqueToday: number }
  online: { players: number; accounts: number; guests: number }
  nodes: { total: number; healthy: number }
  rooms: number
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
