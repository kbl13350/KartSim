// A dev-only fake of the admin API (`npm run dev:mock` / `npm run
// preview:mock`) for checking layouts without the Go services. Any
// username/password signs in; the account "player" is not an admin. Only
// vite.config.ts imports this in mock mode; it never reaches the build.

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

type Row = Record<string, unknown>

const now = Date.now()
const minute = 60_000
const day = 86_400_000
const pick = <T>(list: T[], i: number): T => list[i % list.length]!

const nodes = [
  { nodeId: 'node-a', name: '一区', origin: 'https://a.example.test', players: 37, capacity: 100, rooms: 6, full: false,
    startedAt: now - 3 * day - 4 * 3600_000, seenAt: now - 3000, protocolVersion: 7, status: 'ok',
    stats: { heapMB: 84, goroutines: 412, connections: 39, races: 3, version: 'v1.8.2' } },
  { nodeId: 'node-b', name: '二区', origin: 'https://b.example.test', players: 100, capacity: 100, rooms: 14, full: true,
    startedAt: now - 5 * 3600_000, seenAt: now - 2000, protocolVersion: 7, status: 'full',
    stats: { heapMB: 160, goroutines: 980, connections: 104, races: 9, version: 'v1.8.2' } },
  { nodeId: 'node-old', name: '', origin: 'http://10.0.0.9:8800', players: 0, capacity: 50, rooms: 0, full: false,
    startedAt: now - 20 * day, seenAt: now - 47_000, protocolVersion: 6, status: 'stale', stats: null },
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
    online: i % 4 === 0 ? { nodeId: pick(nodes, i).nodeId, nodeName: pick(nodes, i).name || pick(nodes, i).nodeId } : null,
  }
})

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50',
]

const logins: Row[] = Array.from({ length: 260 }, (_, i) => {
  const account = pick(accounts, i * 3)
  return { id: 1000 - i, at: now - i * 17 * minute, kind: i % 9 === 0 ? 'register' : 'login', accountId: account.id,
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
const gameplays = ['ordinary', 'item', 'grip', 'roadblock', 'giant']
const races: Row[] = Array.from({ length: 120 }, (_, i) => {
  const count = 2 + (i % 7)
  const at = now - i * 23 * minute
  const participants = Array.from({ length: count }, (_, rank) => {
    const account = rank === count - 1 && i % 3 === 0 ? null : pick(accounts, i + rank * 11)
    return { raceId: `race-${i}`, at, gameplay: pick(gameplays, i), trackId: pick(tracks, i), rank: rank + 1,
      name: account ? account.nickname : `游客${rank}`, accountId: account?.id ?? null, username: account?.username ?? null,
      elapsedMs: rank === count - 1 && i % 4 === 0 ? 0 : 95_000 + rank * 1789 + i * 13, points: Math.max(0, 10 - rank * 2) }
  })
  return { raceId: `race-${i}`, roomId: 100 + (i % 30), at, gameplay: pick(gameplays, i), trackId: pick(tracks, i),
    players: count, participants }
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
    nickname: account.nickname, kind: pick(['treasure', 'gacha'], i), ref: pick([1, 862, 863], i), count: pick([1, 10], i),
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
    createdAt: now - i * 2 * day, breakAt: i === 3 ? now + 5 * day : 0 }
})

const inventory: Row[] = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1, category: 1 + (i % 5), categoryName: pick(['车辆', '角色', '头饰', '车牌', '消耗道具'], i), itemId: 100 + i,
  name: `物品 ${i + 1}`, systemKey: `item_${i}`, quantity: 1 + (i % 3), expiresAt: i % 4 === 0 ? now + 7 * day : 0,
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
      if (value === '1' && typeof row[key] === 'boolean') return row[key] === true
      if (key === 'online') return !!row.online
      if (key === 'account') return row.username === value || (row.participants as Row[] | undefined)?.some((p) => p.username === value)
      if (key === 'track') return String(row.trackId) === value
      if (key === 'node') return row.nodeId === value
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
    result = [...result].sort((a, b) => (Number(a[sort]) - Number(b[sort])) * direction)
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
    const token = body.username === 'player' ? 'player-token' : 'admin-token'
    return send(res, 200, { token, account: { id: 'x', username: body.username, nickname: String(body.username), admin: token === 'admin-token' } })
  }
  if (path === '/multiplayer/auth/logout') return send(res, 200, { ok: true })
  const auth = req.headers.authorization
  if (!auth) return send(res, 401, { error: 'LOGIN_REQUIRED' })
  if (auth === 'Bearer player-token') return send(res, 403, { error: 'ADMIN_REQUIRED' })

  if (path === '/api/admin/me') return send(res, 200, { id: accounts[0]!.id, username: 'admin', nickname: '管理员' })
  if (path === '/api/admin/overview') {
    return send(res, 200, { now: Date.now(), accounts: { total: accounts.length, today: 4, admins: 2, banned: 6 },
      logins: { today: 230, uniqueToday: 88 }, online: { players: 137, accounts: 120, guests: 17 },
      nodes: { total: 3, healthy: 2 }, rooms: 20, races: { today: 512 }, coupon: { spentToday: 123456, grantedToday: 5000 },
      recentRegistrations: accounts.slice(0, 10), recentLogins: logins.slice(0, 10) })
  }
  if (path === '/api/admin/accounts') {
    return send(res, 200, list(accounts, params, { search: ['username', 'nickname', 'registerIp', 'lastLoginIp'],
      filters: ['online', 'banned', 'admin'], timeKey: 'createdAt' }))
  }
  const accountMatch = /^\/api\/admin\/accounts\/([^/]+)(?:\/(inventory|kick))?$/.exec(path)
  if (accountMatch) {
    const account = accounts.find((row) => row.id === decodeURIComponent(accountMatch[1]!))
    if (!account) return send(res, 404, { error: 'ACCOUNT_NOT_FOUND' })
    if (accountMatch[2] === 'inventory') return send(res, 200, list(inventory, params, { search: ['name', 'categoryName'], filters: ['category'], timeKey: 'createdAt' }))
    if (accountMatch[2] === 'kick') return send(res, 200, { sessions: 2, game: !!account.online })
    if (method === 'PATCH') {
      const body = await readBody(req)
      if (body.nickname === 'taken') return send(res, 409, { error: 'NICKNAME_TAKEN' })
      if (account.username === 'admin' && (body.admin === false || Number(body.bannedUntil) > 0)) {
        return send(res, 400, { error: 'CANNOT_MODIFY_SELF' })
      }
      if (typeof body.nickname === 'string') account.nickname = body.nickname
      if (typeof body.admin === 'boolean') account.admin = body.admin
      if (typeof body.bannedUntil === 'number') {
        account.bannedUntil = body.bannedUntil
        account.banned = body.bannedUntil > Date.now()
      }
      if (typeof body.banReason === 'string') account.banReason = body.banReason
      return send(res, 200, account)
    }
    return send(res, 200, { account, club: { id: 3, name: '俱乐部3', grade: 2 }, sessions: 1,
      logins: logins.filter((row) => row.accountId === account.id).slice(0, 20),
      races: races.flatMap((race) => (race.participants as Row[]).filter((p) => p.accountId === account.id)).slice(0, 20) })
  }
  if (path === '/api/admin/logins') return send(res, 200, list(logins, params, { search: ['username', 'nickname', 'ip'], filters: ['kind', 'account', 'ip'] }))
  if (path === '/api/admin/online') {
    const online = accounts.filter((row) => row.online).map((row, i) => ({ playerId: `p-${i}`, name: row.nickname, guest: false,
      accountId: row.id, username: row.username, nodeId: (row.online as Row).nodeId, nodeName: (row.online as Row).nodeName,
      roomId: i % 3 ? 100 + i : null }))
      .concat([{ playerId: 'g-1', name: '游客甲', guest: true, accountId: null as never, username: null as never, nodeId: 'node-a', nodeName: '一区', roomId: null }])
    return send(res, 200, list(online, params, { search: ['name', 'username'], filters: ['node'] }))
  }
  if (path === '/api/admin/nodes') {
    return send(res, 200, { now: Date.now(), nodes: nodes.map((node) => ({ ...node, players: Math.max(0, node.players + Math.round(Math.random() * 4 - 2)) })),
      data: { version: 'dev', goVersion: 'go1.26.1', startedAt: now - 2 * day, goroutines: 88, heapMB: 42,
        mysql: { ok: true, latencyMs: 1, error: null }, redis: { ok: false, latencyMs: null, error: 'dial tcp 127.0.0.1:6379: connect: connection refused' } } })
  }
  if (path === '/api/admin/ledger') return send(res, 200, list(ledger, params, { search: ['username', 'nickname', 'refId', 'note'], filters: ['currency', 'reason', 'account'] }))
  if (path === '/api/admin/grants') return send(res, 200, list(grants, params, { search: ['username', 'nickname', 'admin', 'note'] }))
  if (path === '/api/admin/races') return send(res, 200, list(races, params, { search: ['trackId'], filters: ['gameplay', 'track', 'account'] }))
  if (path === '/api/admin/purchases') return send(res, 200, list(purchases, params, { search: ['username', 'nickname', 'name'] }))
  if (path === '/api/admin/lottery-draws') return send(res, 200, list(draws, params, { search: ['username', 'nickname', 'summary'] }))
  if (path === '/api/admin/box-openings') return send(res, 200, list(openings, params, { search: ['username', 'nickname', 'boxName', 'summary'] }))
  if (path === '/api/admin/clubs') return send(res, 200, list(clubs, params, { search: ['name', 'masterUsername', 'masterNickname'], timeKey: 'createdAt' }))
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
    if (!accounts.some((row) => row.username === body.username)) return send(res, 404, { error: 'ACCOUNT_NOT_FOUND' })
    const name = body.currency ? ({ lucci: '金币', koin: '酷币', coupon: '点券' } as Row)[String(body.currency)] : '小绿龙'
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
