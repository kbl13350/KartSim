// A dev-only fake of the admin API (`npm run dev:mock` / `npm run
// preview:mock`) for checking layouts without the Go services. Any
// username/password signs in as "admin"; the account "player" is not an
// admin, and "rider7" stands for a KART_ADMIN_USERNAMES account (another
// admin's PATCH or kick gets 409 PROTECTED_ADMIN). A kicked account is
// leaving for 5 seconds, then offline; resetting the admin's own password
// ends its console sessions. MOCK_REDIS_DOWN=1 answers as if the cluster
// registry were unavailable.
// Only vite.config.ts imports this in mock mode; it never reaches the build.

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

type Row = Record<string, unknown>

const now = Date.now()
const minute = 60_000
const day = 86_400_000
const pick = <T>(list: T[], i: number): T => list[i % list.length]!
const redisDown = process.env.MOCK_REDIS_DOWN === '1'

const nodes = [
  { nodeId: 'node-a', name: '一区', origin: 'https://a.example.test', players: 37, capacity: 100, rooms: 6, full: false,
    startedAt: now - 3 * day - 4 * 3600_000, seenAt: now - 3000, protocolVersion: 7, status: 'ok',
    stats: { heapMB: 84.3, goroutines: 412, connections: 39, races: 3, version: 'v1.8.2' } },
  { nodeId: 'node-b', name: '二区', origin: 'https://b.example.test', players: 100, capacity: 100, rooms: 14, full: true,
    startedAt: now - 5 * 3600_000, seenAt: now - 2000, protocolVersion: 7, status: 'full',
    stats: { heapMB: 160, goroutines: 980, connections: 104, races: 9, version: 'v1.8.2' } },
  { nodeId: 'node-old', name: '', origin: null, players: 0, capacity: 50, rooms: 0, full: false,
    startedAt: now - 20 * day, seenAt: now - 11_000, protocolVersion: 6, status: 'stale', stats: null },
  { nodeId: 'node-idle-0a1b2c3d4e5f', name: '三区（备用）', origin: 'https://c.example.test', players: 0, capacity: 100, rooms: 0,
    full: false, startedAt: now - 2 * day, seenAt: now - 3000, protocolVersion: 7, status: 'ok',
    stats: { heapMB: 0.6, goroutines: 21, connections: 0, races: 0, version: 'v1.8.2-dirty' } },
]

// Nodes gone from the registry but seen in the last 24 hours.
const offlineNodes = [
  { nodeId: 'node-d', name: '四区', origin: 'https://d.example.test', players: 12, capacity: 100, rooms: 2, full: false,
    startedAt: now - 30 * 3600_000, seenAt: now - 3 * 3600_000, protocolVersion: 7, status: 'offline',
    stats: { heapMB: 61.2, goroutines: 233, connections: 13, races: 1, version: 'v1.8.1' } },
]

const accounts: Row[] = Array.from({ length: 137 }, (_, i) => {
  const banned = i % 23 === 5
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    username: i === 0 ? 'admin' : i === 1 ? 'player' : `rider${i}`,
    nickname: i === 0 ? '管理员' : `车手${i}号`,
    admin: i === 0 || i === 7,
    createdAt: now - i * 7 * 3600_000,
    registerIp: i % 9 === 3 ? '' : `192.168.1.${i % 250}`,
    lastLoginAt: i % 11 === 4 ? 0 : now - i * 50 * minute,
    lastLoginIp: i % 11 === 4 ? '' : `10.0.${i % 7}.${i % 200}`,
    lastSeenAt: i % 11 === 4 ? 0 : now - i * 13 * minute,
    lastSeenIp: i % 11 === 4 ? '' : i % 6 === 1 ? '2408:8207:1866:2b30:a1b2:c3d4:e5f6:7a8b' : `10.0.${i % 5}.${i % 200}`,
    bannedUntil: banned ? (i % 2 ? Date.UTC(2100, 0, 1, -8) : now + 3 * day) : 0,
    banReason: banned ? '外挂' : '',
    banned,
    level: 1 + (i * 7) % 70,
    exp: i * 12345,
    coupon: (i * 7919) % 100000,
    lucci: (i * 104729) % 5000000,
    koin: (i * 31) % 3000,
    inventoryCount: (i * 13) % 200,
    onboarded: i % 5 !== 2,
    online: i % 4 === 0
      ? { nodeId: pick(nodes, i).nodeId, nodeName: pick(nodes, i).name || pick(nodes, i).nodeId, leaving: i % 24 === 8 }
      : null,
  }
})
const superAdmin = 'rider7'
const isSelfAccount = (account: Row) => account.username === 'admin'

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50',
]

const logins: Row[] = Array.from({ length: 260 }, (_, i) => {
  const account = pick(accounts, i * 3)
  return { id: 1000 - i, at: now - i * 17 * minute, kind: i % 9 === 0 ? 'register' : i % 4 === 1 ? 'resume' : 'login', accountId: account.id,
    username: account.username, nickname: account.nickname, ip: `10.1.${i % 9}.${i % 254}`, userAgent: pick(userAgents, i) }
})

const reasons = ['race', 'purchase', 'admin', 'lottery', 'levelup', 'clubdonate', 'rewardbox', 'mystery']
const currencies = ['coupon', 'lucci', 'koin', 'exp']
const ledger: Row[] = Array.from({ length: 330 }, (_, i) => {
  const account = pick(accounts, i * 5)
  const delta = (i % 3 === 0 ? -1 : 1) * ((i * 97) % 5000 + 1)
  return { id: 9000 - i, at: now - i * 9 * minute, accountId: account.id, username: account.username,
    nickname: account.nickname, currency: pick(currencies, i), delta, balanceAfter: (i * 7717) % 900000,
    reason: pick(reasons, i), refId: `ref-${i}`, note: i % 4 === 0 ? '活动补偿' : '' }
})

const grants: Row[] = Array.from({ length: 45 }, (_, i) => {
  const account = pick(accounts, i * 7 + 2)
  return { at: now - i * 3 * 3600_000, admin: 'admin', requestId: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`,
    accountId: account.id, username: account.username, nickname: account.nickname, currency: pick(currencies, i),
    amount: i % 5 === 0 ? -100 * i - 1 : 1000 * (i + 1), note: '测试发放' }
})

const tracks = ['village_R01', 'jurassic_R02', 'beach_R05', 'moonhill_R06', 'forest_R03']
const trackNames: Record<string, string> = { village_R01: '城镇高速公路', jurassic_R02: '侏罗纪公园', beach_R05: '海滨环形道',
  forest_R03: '森林木桥' }
const gameplays = ['ordinary', 'item', 'grip', 'roadblock', 'giant']
const races: Row[] = Array.from({ length: 120 }, (_, i) => {
  const count = 2 + (i % 7)
  const at = now - i * 23 * minute
  const participants = Array.from({ length: count }, (_, rank) => {
    const account = rank === count - 1 && i % 3 === 0 ? null : pick(accounts, i + rank * 11)
    const trackId = pick(tracks, i)
    return { raceId: `race-${i}`, at, gameplay: pick(gameplays, i), trackId, trackName: trackNames[trackId] ?? '',
      rank: rank + 1, name: account ? account.nickname : `游客${rank}`, accountId: account?.id ?? '',
      username: account?.username ?? '', elapsedMs: rank === count - 1 && i % 4 === 0 ? null : 95_000 + rank * 1789 + i * 13,
      points: Math.max(0, 10 - rank * 2), exp: account ? 120 - rank * 10 : null, lucci: account ? 300 - rank * 30 : null }
  })
  const trackId = pick(tracks, i)
  return { raceId: `race-${i}`, roomId: i % 2 ? `5f2c9a1e-7b3d-4c8e-9a6f-${String(i).padStart(12, '0')}` : String(100 + (i % 30)),
    at, gameplay: pick(gameplays, i), trackId,
    trackName: trackNames[trackId] ?? '', players: count, participants }
})

const purchases: Row[] = Array.from({ length: 77 }, (_, i) => {
  const account = pick(accounts, i * 3 + 1)
  return { id: 500 - i, at: now - i * 41 * minute, accountId: account.id, username: account.username,
    nickname: account.nickname, offerId: 3000 + i, category: 1 + (i % 4), itemId: 100 + i, name: pick(['棉花糖', '小绿龙', '金色车牌', '神秘礼盒'], i),
    currency: pick(['coupon', 'lucci'], i), price: 1000 + (i % 9) * 500, days: pick([0, 7, 30], i), count: 1 }
})

const draws: Row[] = Array.from({ length: 64 }, (_, i) => {
  const account = pick(accounts, i * 2 + 3)
  return { at: now - i * 29 * minute, requestId: `draw-${i}`, accountId: account.id, username: account.username,
    nickname: account.nickname, kind: pick(['treasure', 'gacha'], i), ref: pick([1, 862, 863], i),
    refName: i % 2 === 0 ? '寻宝' : pick(['白银扭蛋', '黄金扭蛋', ''], i), count: pick([1, 10], i),
    summary: '小绿龙（30天）、金币 ×500、改装零件 ×3', result: { items: [{ category: 24, itemId: 862, name: '小绿龙', count: 1, days: 30 }] } }
})

const openings: Row[] = Array.from({ length: 33 }, (_, i) => {
  const account = pick(accounts, i * 4 + 1)
  return { at: now - i * 53 * minute, requestId: `box-${i}`, accountId: account.id, username: account.username,
    nickname: account.nickname, boxId: 70 + (i % 3), boxName: pick(['幸运宝箱', '黄金宝箱'], i), stockId: 4000 + i,
    summary: '金币 ×1000', result: { stock: 4000 + i, items: [{ name: '金币', count: 1000 }] } }
})

const clubs: Row[] = Array.from({ length: 26 }, (_, i) => {
  const master = pick(accounts, i * 5 + 2)
  return { id: i + 1, name: `俱乐部${i + 1}`, masterId: master.id, masterUsername: master.username, masterNickname: master.nickname,
    members: 1 + (i * 7) % 100, hq: 1 + (i % 5), racing: 1 + (i % 3), rider: 1 + (i % 4), bank: 1 + (i % 2),
    budget: (i * 123457) % 3_000_000, cs: (i * 937) % 20000, csWeek: (i * 37) % 1000, autoJoin: i % 2 === 0,
    createdAt: now - i * 2 * day, breakAt: i === 3 ? now + 5 * day : i === 5 ? now - 2 * day : null,
    state: i === 3 ? 'breaking' : i === 5 ? 'disbanded' : 'active' }
})

function clubMembers(club: Row): Row[] {
  const id = Number(club.id)
  return Array.from({ length: Number(club.members) }, (_, i) => {
    const account = i === 0 ? accounts.find((row) => row.id === club.masterId)! : pick(accounts, id * 3 + i * 7)
    return { accountId: account.id, username: account.username, nickname: account.nickname,
      grade: i === 0 ? 1 : i < 3 ? 2 : i < 8 ? 3 : 4, joinedAt: Number(club.createdAt) + i * 3600_000,
      csWeek: (i * 53 + id) % 300, csTotal: (i * 977 + id) % 9000, donatedTotal: (i * 10_007) % 500_000 }
  })
}

const invites: Row[] = Array.from({ length: 42 }, (_, i) => {
  const user = i % 3 === 0 ? null : pick(accounts, i * 3 + 2)
  return { hash: (i * 2654435761 + 0x9e3779b9).toString(16).padStart(12, 'a').slice(0, 12), createdAt: now - i * 11 * 3600_000,
    used: !!user, usedBy: user ? { accountId: user.id, username: user.username, nickname: user.nickname } : null }
})

const boxNames: Record<string, string> = { lucci: '金币', koin: '酷币', coupon: '点券' }
let rewardBox: Row[] = Array.from({ length: 58 }, (_, i) => {
  const account = pick(accounts, i * 5 + 1)
  const currency = pick(['lucci', '', 'coupon', '', 'koin'], i)
  const createdAt = now - i * 17 * 3600_000
  const expiresAt = createdAt + 30 * day
  const state = expiresAt < now ? 'expired' : i % 3 === 0 ? 'claimed' : 'unclaimed'
  return { id: 900 - i, accountId: account.id, username: account.username, nickname: account.nickname,
    source: pick(['quest', 'club', 'admin'], i), message: pick(['任务：完成 3 场比赛', '俱乐部福利', '管理员赠送'], i),
    name: currency ? boxNames[currency] : pick(['小绿龙', '棉花糖', '金色车牌'], i), category: currency ? 0 : 24,
    itemId: currency ? 0 : 860 + (i % 5), count: currency ? 500 * (1 + (i % 4)) : 1 + (i % 2), days: currency ? 0 : pick([0, 7, 30], i),
    currency, createdAt, expiresAt, claimedAt: state === 'claimed' ? createdAt + 3600_000 : null, state }
})

function gameData(account: Row): Row {
  const n = Number(String(account.id).slice(-4))
  return {
    stats: n % 6 === 2 ? null : { races: n * 17 % 900, wins: n * 3 % 120, podiums: n * 7 % 300, points: n * 131 % 20000 },
    license: n % 5 === 2 ? null : { level: 1 + n % 6, proUntil: n % 6 === 5 ? now + 40 * day : n % 4 === 1 ? now - 9 * day : null,
      proCount: n % 3, lastRunAt: now - n * 3600_000 },
    licenseClears: Array.from({ length: n % 9 }, (_, i) => ({ step: i + 1, period: i > 5 ? '2026-Q4' : '', bestMs: 60_000 + i * 4321,
      clearedAt: now - (i + 1) * day })),
    licenseRecords: Array.from({ length: n % 4 }, (_, i) => ({ trackId: pick(tracks, i), trackName: trackNames[pick(tracks, i)] ?? '',
      bestMs: 88_000 + i * 2345, updatedAt: now - i * 5 * day })),
    timeAttack: Array.from({ length: n % 7 }, (_, i) => ({ trackId: pick(tracks, i + 1), trackName: trackNames[pick(tracks, i + 1)] ?? '',
      bestMs: 91_000 + i * 1789, updatedAt: now - i * 2 * day })),
    quests: Array.from({ length: n % 6 }, (_, i) => ({ questId: 1001 + i, period: i % 3 === 0 ? '' : i % 3 === 1 ? '2026-10-10' : '2026-W41',
      value: i * 2 + 1, completedAt: i % 2 ? now - i * 3600_000 : null, updatedAt: now - i * 1800_000 })),
    counters: ['race.finish', 'race.win', 'timeattack.finish', 'license.level', 'race.distance.camera'].slice(0, n % 6)
      .map((counter, i) => ({ counter, value: (n + 1) * (i + 3) * 7, updatedAt: now - i * day })),
    friends: n % 23,
    club: n % 3 === 0 ? null : { id: 3, name: '俱乐部3', grade: 2, joinedAt: now - 20 * day, csWeek: 120, csTotal: 4321, donatedTotal: 150_000 },
  }
}

const inventory: Row[] = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1, category: 1 + (i % 5), categoryName: pick(['车辆', '角色', '头饰', '车牌', '消耗道具'], i), itemId: 100 + i,
  name: `物品 ${i + 1}`, systemKey: `item_${i}`, quantity: 1 + (i % 3), expiresAt: i % 4 === 0 ? now + 7 * day : null,
  source: pick(['shop', 'lottery', 'rewardbox', 'starter'], i), createdAt: now - i * day, updatedAt: now - i * 3600_000,
}))

let notices: Row[] = [
  { id: 2, title: '周末双倍金币', message: '本周末所有比赛|金币奖励翻倍！', startAt: now - day, endAt: now + 2 * day, updatedBy: 'admin', updatedAt: now - day },
  { id: 1, title: '欢迎来到跑跑卡丁车', message: '祝大家游戏愉快', updatedBy: 'admin', updatedAt: now - 9 * day },
]

const lottery = {
  activities: [
    { activity: 'treasureHunt', name: '寻宝活动（海盗）', enabled: true, open: true, start: null, end: null,
      daily: [{ category: 24, itemId: 862, name: '寻宝铲', count: 3, days: 0 }],
      defaultDaily: [{ category: 24, itemId: 862, name: '寻宝铲', count: 3, days: 0 }], hasDaily: true, custom: false,
      originalStart: '2012-07-01 00:00:00', originalEnd: '2012-08-01 00:00:00' },
    { activity: 'gacha', name: '精品道具场（全部扭蛋）', enabled: true, open: true, start: null, end: null,
      daily: [{ category: 24, itemId: 900, name: '扭蛋币', count: 1, days: 0 }], defaultDaily: [{ category: 24, itemId: 900, name: '扭蛋币', count: 1, days: 0 }],
      hasDaily: true, custom: true, updatedBy: 'admin', updatedAt: now - day },
    { activity: 'lottery:863', name: '黄金扭蛋', enabled: false, open: false, start: now + day, end: now + 9 * day,
      daily: [], defaultDaily: [], hasDaily: false, custom: true, updatedBy: 'admin', updatedAt: now - 3600_000,
      originalStart: '2013-01-01', originalEnd: '2013-02-01' },
  ],
  lotteries: [{ itemId: 862, name: '白银扭蛋' }, { itemId: 863, name: '黄金扭蛋' }, { itemId: 864, name: '钻石扭蛋' }],
  serverTime: now,
}

// Console sessions: "admin-token-N"; a password reset of the admin's own
// account ends every one issued so far.
let adminTokens = 0
let firstValidToken = 1

function validToken(auth: string): boolean {
  if (auth === 'Bearer player-token') return true
  const match = /^Bearer admin-token-(\d+)$/.exec(auth)
  return !!match && Number(match[1]) >= firstValidToken
}

/** Kicked or banned: leaving until the node's next heartbeat (5 s here), then offline. */
function disconnect(account: Row) {
  if (!account.online) return false
  account.online = { ...(account.online as Row), leaving: true }
  setTimeout(() => {
    account.online = null
  }, 5000)
  return true
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<Row> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Row
  } catch {
    return {}
  }
}

/** Generic list handling: q over a few fields, equality filters, from/to on `timeKey`, sort, paging. */
function list(rows: Row[], params: URLSearchParams, options: { search: string[]; filters?: string[]; timeKey?: string }) {
  let result = rows
  const q = params.get('q')?.toLowerCase()
  if (q) result = result.filter((row) => options.search.some((key) => String(row[key] ?? '').toLowerCase().includes(q)))
  for (const key of options.filters ?? []) {
    const value = params.get(key)
    if (!value) continue
    result = result.filter((row) => {
      if (typeof row[key] === 'boolean') return row[key] === (value === '1' || value === 'true')
      if (key === 'online') return !!row.online
      if (key === 'account') {
        return row.username === value || row.accountId === value ||
          (row.participants as Row[] | undefined)?.some((p) => p.username === value)
      }
      if (key === 'track') return String(row.trackId) === value
      if (key === 'node') return row.nodeId === value
      if (key === 'box') return String(row.boxId) === value
      return String(row[key]) === value
    })
  }
  const timeKey = options.timeKey ?? 'at'
  const from = Number(params.get('from') || 0)
  const to = Number(params.get('to') || 0)
  if (from) result = result.filter((row) => Number(row[timeKey]) >= from)
  if (to) result = result.filter((row) => Number(row[timeKey]) <= to)
  const sort = params.get('sort')
  if (sort) {
    const direction = params.get('order') === 'asc' ? 1 : -1
    const key = sort === 'node' ? 'nodeName' : sort
    result = [...result].sort((a, b) => {
      const x = a[key]
      const y = b[key]
      const order = typeof x === 'string' || typeof y === 'string'
        ? String(x ?? '').localeCompare(String(y ?? ''), 'zh-CN')
        : Number(x ?? 0) - Number(y ?? 0)
      return order * direction
    })
  }
  const page = Math.max(1, Number(params.get('page') || 1))
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') || 20)))
  return { items: result.slice((page - 1) * pageSize, page * pageSize), total: result.length, page, pageSize }
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'
  const params = url.searchParams
  if (!path.startsWith('/api/') && !path.startsWith('/multiplayer/auth/') && path !== '/multiplayer/admin/invites') {
    next()
    return
  }
  await new Promise((resolve) => setTimeout(resolve, 150))
  if (path === '/multiplayer/auth/login' && method === 'POST') {
    const body = await readBody(req)
    if (!body.username || !body.password) return send(res, 401, { error: 'INVALID_CREDENTIALS' })
    const admin = body.username !== 'player'
    const token = admin ? `admin-token-${++adminTokens}` : 'player-token'
    return send(res, 200, { token, account: { id: 'x', username: body.username, nickname: String(body.username), admin } })
  }
  const auth = req.headers.authorization
  if (path === '/multiplayer/auth/logout') {
    return auth && validToken(auth) ? send(res, 200, { ok: true }) : send(res, 401, { error: 'LOGIN_REQUIRED' })
  }
  if (!auth || !validToken(auth)) return send(res, 401, { error: 'LOGIN_REQUIRED' })
  if (auth === 'Bearer player-token') return send(res, 403, { error: 'ADMIN_REQUIRED' })

  if (path === '/api/admin/me') return send(res, 200, { id: accounts[0]!.id, username: 'admin', nickname: '管理员' })
  if (path === '/api/admin/overview') {
    return send(res, 200, { now: Date.now(), accounts: { total: accounts.length, today: 4, admins: 2, banned: 6 },
      logins: { today: 230, uniqueToday: 88 }, online: redisDown ? null : { players: 137, accounts: 120, guests: 17 },
      nodes: redisDown ? null : { total: nodes.length, healthy: nodes.filter((node) => node.status !== 'stale').length,
        offline: offlineNodes.length },
      rooms: redisDown ? null : 20, races: { today: 512 },
      coupon: { spentToday: 123456, grantedToday: 5000 },
      recentRegistrations: accounts.slice(0, 10), recentLogins: logins.filter((row) => row.kind === 'login').slice(0, 10) })
  }
  if (path === '/api/admin/accounts') {
    return send(res, 200, list(accounts, params, { search: ['username', 'nickname', 'registerIp', 'lastLoginIp', 'lastSeenIp'],
      filters: ['online', 'banned', 'admin'], timeKey: 'createdAt' }))
  }
  const accountMatch = /^\/api\/admin\/accounts\/([^/]+)(?:\/(inventory|kick|game))?$/.exec(path)
  if (accountMatch) {
    const account = accounts.find((row) => row.id === decodeURIComponent(accountMatch[1]!))
    if (!account) return send(res, 404, { error: 'ACCOUNT_NOT_FOUND' })
    if (accountMatch[2] === 'inventory') return send(res, 200, list(inventory, params, { search: ['name', 'itemId'], filters: ['category'], timeKey: 'updatedAt' }))
    if (accountMatch[2] === 'game') return send(res, 200, gameData(account))
    if (accountMatch[2] === 'kick') {
      if (isSelfAccount(account)) return send(res, 409, { error: 'CANNOT_MODIFY_SELF' })
      if (account.username === superAdmin) return send(res, 409, { error: 'PROTECTED_ADMIN' })
      return send(res, 200, { sessions: 2, game: disconnect(account) })
    }
    if (method === 'PATCH') {
      const body = await readBody(req)
      if (account.username === superAdmin) return send(res, 409, { error: 'PROTECTED_ADMIN' })
      if (body.nickname === 'taken') return send(res, 409, { error: 'NICKNAME_TAKEN' })
      if (typeof body.banReason === 'string' && /[\u0000-\u001f\u007f-\u009f]/.test(body.banReason)) {
        return send(res, 400, { error: 'INVALID_ACCOUNT_FIELDS' })
      }
      if (account.username === 'admin' && (body.admin === false || Number(body.bannedUntil) > 0)) {
        return send(res, 409, { error: 'CANNOT_MODIFY_SELF' })
      }
      if (typeof body.nickname === 'string') account.nickname = body.nickname
      if (typeof body.admin === 'boolean') account.admin = body.admin
      if (typeof body.bannedUntil === 'number') {
        const until = body.bannedUntil > Date.now() ? body.bannedUntil : 0
        account.bannedUntil = until || null
        account.banned = until > 0
        // Lifting a ban clears its reason unless the request brings a new one.
        if (!until && typeof body.banReason !== 'string') account.banReason = ''
        if (until) disconnect(account)
      }
      if (typeof body.banReason === 'string') account.banReason = body.banReason
      if (typeof body.password === 'string') {
        if (isSelfAccount(account)) firstValidToken = adminTokens + 1
        disconnect(account)
      }
      return send(res, 200, account)
    }
    return send(res, 200, { account, club: { id: 3, name: '俱乐部3', grade: 2 }, sessions: 1,
      logins: logins.filter((row) => row.accountId === account.id).slice(0, 20),
      races: races.flatMap((race) => (race.participants as Row[]).filter((p) => p.accountId === account.id)).slice(0, 20) })
  }
  if (path === '/api/admin/logins') return send(res, 200, list(logins, params, { search: ['username', 'nickname', 'ip'], filters: ['kind', 'account', 'ip'] }))
  if (path === '/api/admin/online') {
    if (redisDown) return send(res, 200, { items: [], total: 0, page: 1, pageSize: Number(params.get('pageSize') || 20) })
    const online = accounts.filter((row) => row.online).map((row, i) => ({ playerId: `p-${i}`, name: row.nickname, guest: false,
      accountId: row.id, username: row.username, nodeId: (row.online as Row).nodeId, nodeName: (row.online as Row).nodeName,
      room: i % 3 ? `快来一起玩 ${100 + i}` : '', leaving: !!(row.online as Row).leaving }))
      .concat([{ playerId: 'g-1', name: '游客甲', guest: true, accountId: '', username: '', nodeId: 'node-a', nodeName: '一区', room: '新手房', leaving: false }])
    return send(res, 200, list(online, params, { search: ['name', 'username'], filters: ['node'] }))
  }
  if (path === '/api/admin/nodes') {
    const live = nodes.map((node) => ({ ...node, seenAt: node.status === 'stale' ? node.seenAt : Date.now() - 2000,
      players: Math.max(0, node.players + (node.players ? Math.round(Math.random() * 4 - 2) : 0)) }))
    return send(res, 200, { now: Date.now(), nodes: redisDown ? [] : [...offlineNodes, ...live],
      data: { version: 'dev', goVersion: 'go1.26.1', startedAt: now - 2 * day, goroutines: 88, heapMB: 42.7,
        mysql: { ok: true, latencyMs: 1, error: null }, redis: { ok: false, latencyMs: null, error: 'dial tcp 127.0.0.1:6379: connect: connection refused' } } })
  }
  if (path === '/api/admin/ledger') return send(res, 200, list(ledger, params, { search: ['refId', 'note'], filters: ['currency', 'reason', 'account'] }))
  if (path === '/api/admin/grants') return send(res, 200, list(grants, params, { search: ['username', 'nickname', 'admin'] }))
  if (path === '/api/admin/races') return send(res, 200, list(races, params, { search: ['trackId', 'roomId', 'raceId'], filters: ['gameplay', 'track', 'account'] }))
  if (path === '/api/admin/purchases') return send(res, 200, list(purchases, params, { search: ['username', 'nickname', 'offerId'] }))
  if (path === '/api/admin/lottery-draws') return send(res, 200, list(draws, params, { search: ['username', 'nickname'], filters: ['kind'] }))
  if (path === '/api/admin/box-openings') return send(res, 200, list(openings, params, { search: ['username', 'nickname'], filters: ['box'] }))
  if (path === '/api/admin/clubs') {
    return send(res, 200, list(clubs, params, { search: ['name', 'masterUsername', 'masterNickname'], filters: ['state'], timeKey: 'createdAt' }))
  }
  const membersMatch = /^\/api\/admin\/clubs\/([^/]+)\/members$/.exec(path)
  if (membersMatch) {
    const club = clubs.find((row) => String(row.id) === decodeURIComponent(membersMatch[1]!))
    if (!club) return send(res, 404, { error: 'CLUB_NOT_FOUND' })
    if (!params.get('sort')) params.set('sort', 'joinedAt')
    return send(res, 200, list(clubMembers(club), params, { search: ['username', 'nickname'], timeKey: 'joinedAt' }))
  }
  if (path === '/api/admin/invites' && method === 'GET') {
    return send(res, 200, list(invites, params, { search: [], filters: ['used'], timeKey: 'createdAt' }))
  }
  if (path === '/api/admin/reward-box' && method === 'GET') {
    return send(res, 200, list(rewardBox, params, { search: ['username', 'nickname', 'name'], filters: ['source', 'state', 'account'],
      timeKey: 'createdAt' }))
  }
  if (path === '/api/admin/grant' && method === 'POST') {
    const body = await readBody(req)
    const account = accounts.find((row) => row.username === body.username)
    if (!account) return send(res, 404, { error: 'ACCOUNT_NOT_FOUND' })
    const key = String(body.currency)
    const amount = Number(body.amount)
    if (Number(account[key]) + amount < 0) return send(res, 409, { error: key === 'exp' ? 'INSUFFICIENT_EXP' : 'INSUFFICIENT_FUNDS' })
    account[key] = Number(account[key]) + amount
    return send(res, 200, { applied: amount, levelUps: [], duplicate: false, requestId: body.requestId,
      account: { ...account, wallet: { coupon: account.coupon, lucci: account.lucci, koin: account.koin } } })
  }
  if (path === '/api/admin/lottery') {
    if (method === 'PUT') {
      const body = await readBody(req)
      const found = lottery.activities.find((row) => row.activity === body.activity)
      return send(res, 200, { ...(found ?? { activity: body.activity, name: String(body.activity), hasDaily: false }),
        enabled: body.reset ? true : body.enabled, open: body.reset ? true : !!body.enabled, custom: !body.reset })
    }
    return send(res, 200, { ...lottery, serverTime: Date.now() })
  }
  if (path === '/api/admin/reward-box' && method === 'POST') {
    const body = await readBody(req)
    const account = accounts.find((row) => row.username === body.username)
    if (!account) return send(res, 404, { error: 'ACCOUNT_NOT_FOUND' })
    const currency = typeof body.currency === 'string' ? body.currency : ''
    const name = currency ? boxNames[currency] : '小绿龙'
    const at = Date.now()
    rewardBox = [{ id: Math.max(0, ...rewardBox.map((row) => Number(row.id))) + 1, accountId: account.id, username: account.username,
      nickname: account.nickname, source: 'admin', message: String(body.message || '管理员赠送'), name, category: Number(body.category ?? 0),
      itemId: Number(body.itemId ?? 0), count: Number(body.count), days: Number(body.days ?? 0), currency, createdAt: at,
      expiresAt: at + 30 * day, claimedAt: null, state: 'unclaimed' }, ...rewardBox]
    return send(res, 200, { ok: true, entry: { name, count: body.count } })
  }
  if (path === '/api/admin/notices') {
    if (method === 'PUT') {
      const body = await readBody(req)
      const id = Number(body.id) || Math.max(0, ...notices.map((row) => Number(row.id))) + 1
      notices = [{ ...body, id, updatedBy: 'admin', updatedAt: Date.now() }, ...notices.filter((row) => row.id !== id)]
      return send(res, 200, { id })
    }
    return send(res, 200, { notices })
  }
  const noticeMatch = /^\/api\/admin\/notices\/(\d+)$/.exec(path)
  if (noticeMatch && method === 'DELETE') {
    notices = notices.filter((row) => row.id !== Number(noticeMatch[1]))
    return send(res, 200, { ok: true })
  }
  if (path === '/multiplayer/admin/invites' && method === 'POST') {
    invites.unshift({ hash: Math.random().toString(16).slice(2, 14).padEnd(12, '0'), createdAt: Date.now(), used: false, usedBy: null })
    return send(res, 200, { invite: Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 11) })
  }
  return send(res, 404, { error: 'NOT_FOUND' })
}

export function mockApi(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    handle(req, res, next).catch((error: unknown) => send(res, 500, { error: 'INTERNAL_ERROR', detail: String(error) }))
  }
  return {
    name: 'kartsim-admin-mock',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
