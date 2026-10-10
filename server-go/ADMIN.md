# 管理后台（Element Plus 版）约定

管理后台仍由数据服务提供：`GET /multiplayer/admin` 返回单页应用，只有管理员（库里 `admin` 标记或 `KART_ADMIN_USERNAMES`）能登录使用。本文是前端（`server-go/admin-ui/`）与后端（数据服务 `/api/admin/*`）的约定。

## 1. 前端

- 工程：`server-go/admin-ui/`，Vite + Vue 3 + Element Plus（Element UI 的 Vue 3 版本）+ `@element-plus/icons-vue`，TypeScript，中文语言包（`zh-cn`）。依赖版本在 `package.json` 里写死，`node_modules/` 不提交。
- 构建：`npm run build` 输出到 `server-go/internal/data/api/adminui/`（`index.html` 与 `assets/`），**构建产物提交进仓库**并由 Go `embed` 打进数据服务，`go build` 不需要 Node。改了前端必须重新构建并提交产物；有一个 Go 测试检查产物存在。
- 安全：模板全部预编译，不用 `eval`；页面安全策略保持 `script-src 'self'`（不放开 `unsafe-eval`），不引用任何 CDN；字体、图标都打进包里。登录 token 只放内存（与旧后台一致），刷新页面要重新登录。
- 布局：顶栏（标题“跑跑卡丁车 管理后台”、当前管理员、刷新、退出）；下面用 `el-tabs`（卡片式）做菜单，每个标签一个功能页，切换时保留各页的搜索条件；当前标签记在 URL hash（`#users`）。
- 标签页：

| 标签 | 内容 |
|---|---|
| 概览 | 统计卡片：注册用户总数、今日新增、今日登录人数、当前在线、游戏节点数（在线/总数）、房间数、今日比赛场次、今日点券消费、今日发放；最近注册、最近登录两张小表 |
| 用户管理 | 表格：账号、昵称、等级、经验、点券、金币、K币、物品数、注册时间、注册 IP、最后登录时间、最后登录 IP、在线（所在节点）、管理员、封禁；搜索：关键字（账号/昵称/IP）、注册时间范围、在线/封禁/管理员筛选；排序；分页。操作：详情（抽屉：基本信息、钱包、物品表、货币流水、登录记录、比赛记录）、编辑（昵称、管理员、封禁到期与原因、重置密码）、赠送（点券/金币/K币/经验，正数发放、负数扣除，备注）、踢下线 |
| 登录记录 | 注册与登录记录：时间、类型、账号、昵称、IP、浏览器；按账号/IP/时间/类型搜索 |
| 在线玩家 | 当前在线的账号与游客：昵称、账号、所在节点、所在房间（有就显示）；按昵称/账号/节点搜索；可踢下线 |
| 服务器节点 | 游戏节点：节点 ID、名称、地址、玩家/容量（进度条）、房间数、启动时间与运行时长、最后心跳、协议版本、状态（正常/超时/满员）、内存、协程数、连接数、进行中的比赛；数据服务自身：版本、启动时间、数据库与 Redis 状态。自动刷新（5 秒） |
| 货币流水 | `wallet_ledger` 与经验流水：时间、账号、货币、变化、余额、原因、关联；按账号/货币/原因/时间搜索 |
| 发放记录 | 管理员发放与扣除（`admin_grants`）：时间、管理员、账号、货币、数量、备注 |
| 比赛记录 | 比赛结算：时间、模式、玩法、赛道、人数、名次与成绩、奖励；按账号/玩法/赛道/时间搜索 |
| 购买记录 | 商城购买：时间、账号、商品、货币、价格 |
| 抽奖与开箱 | 寻宝/精品道具场抽奖记录与开箱记录 |
| 俱乐部 | 俱乐部列表：名称、会长、等级、人数、创建时间 |
| 抽奖活动、奖励箱、公告、邀请码 | 原后台的功能，用 Element Plus 表单与表格重做，接口不变 |

- 所有表格：服务器端分页（每页 20/50/100）、搜索、可排序列；空数据、加载中、出错都有提示；时间统一按北京时间显示 `YYYY-MM-DD HH:mm:ss`；金额千分位。

## 2. 数据

- 新迁移（开发期间用临时版本 **120**，合并到 main 时改成下一个正式编号，并把开发库里的 `schema_migrations` 行同步改号）：
  - `login_records`：`id` 自增、`account_id`、`kind`（`register` | `login`）、`ip` VARCHAR(45)、`user_agent` VARCHAR(255)、`at` BIGINT；索引 `(account_id, at)`、`(at)`、`(ip)`。
  - `accounts` 增加：`register_ip` VARCHAR(45) 默认 ''、`last_login_at` BIGINT 默认 0、`last_login_ip` VARCHAR(45) 默认 ''、`banned_until` BIGINT 默认 0、`ban_reason` VARCHAR(200) 默认 ''。
  - 管理列表用的索引：`accounts(created_at)`、`accounts(last_login_at)`、`wallet_ledger(created_at)`、`exp_ledger(created_at)`、`admin_grants(created_at)`、`purchases(created_at)`、`lottery_draws(created_at)`、`race_results(account_id, created_at)`。`login_records.account_id` 是随账号删除的外键。加列、加索引前先查 `information_schema`，迁移中断后可以重跑。
- 注册、登录成功时记录（IP 用现有的可信代理规则取客户端地址；UA 截到 255）。旧账号没有注册 IP 显示“—”。
- 登录记录保留 180 天（与现有每小时清理一起删旧行）。
- 封禁：`banned_until > now` 的账号登录返回 403 `ACCOUNT_BANNED`（带 `until`、`reason`），封禁时作废该账号所有会话并通知游戏节点断开（复用单点登录踢下线的机制）。检查在密码验证通过之后（密码错误仍是 401 `INVALID_CREDENTIALS`，不暴露封禁），并在创建会话的事务里持有账号行锁进行，封禁取同一把锁，所以不会有封禁之后才建成的会话。作废的会话：删除 `sessions` 行、作废 Redis 会话缓存、以 4001 关闭好友聊天与小屋连接，旧 token 得到 401 `LOGIN_REQUIRED`。重置密码与踢下线做同样的事。
- 游戏节点心跳增加可选 `stats`：`heapMB`、`goroutines`、`connections`、`races`、`version`；数据服务原样存进节点注册信息，旧节点没有就不显示。`heapMB` 是上次 GC 后的存活堆，`connections` 是打开的客户端连接，`races` 是处于载入、倒计时或比赛中的房间，`version` 是构建时的提交（前 12 位，未提交的改动加 `-dirty`），没有版本信息时为 `dev`。心跳的 `players[]` 另有可选 `room`（玩家所在房间的名称，在大厅时没有）；数据服务把最近一次心跳的玩家列表（去掉昵称或账号被别处占用、将被断开的玩家）存为 `node-online:{节点}`，与节点注册同样 15 秒过期。

## 3. 接口（全部要求管理员会话，返回 JSON）

列表接口统一：`?page=1&pageSize=20&q=…&sort=字段&order=asc|desc&from=毫秒&to=毫秒` 加各自筛选；返回 `{"items":[…],"total":N,"page":1,"pageSize":20}`。`pageSize` 最大 100，`q` 最长 64 字符，`sort` 只接受该列表允许的字段，时间都是毫秒时间戳。补充约定：

- `page` 从 1 起，`pageSize` 1–100（默认 20）；`q` 去掉首尾空白后按“包含”匹配，`%`、`_` 没有通配含义；`from`、`to` 都包含端点；`order` 默认 `desc`（在线玩家默认按昵称 `asc`）；`sort` 不写用下表第一个字段。参数不合法（非数字、越界、未知 `sort`、`q` 过长或不是 UTF-8、筛选值不在允许范围）一律 400 `INVALID_QUERY`。翻过最后一页返回空 `items`，`total` 不变。
- `account` 筛选接受账号 ID 或用户名（不区分大小写）；没有这个账号时返回空列表。
- 各列表：

| 列表 | `q` 匹配 | `from`/`to` 作用于 | `sort` | 其他筛选 |
|---|---|---|---|---|
| `accounts` | 用户名、昵称、注册 IP、最后登录 IP | 注册时间 | `createdAt`、`lastLoginAt`、`level`、`coupon`、`lucci`、`koin` | `online=1`、`banned=1`、`admin=1`（值也可写 `true`；`0`/`false` 等于不筛选）。没有 Redis 时 `online=1` 为空 |
| `accounts/{id}/inventory` | 物品名称、物品 ID | 最后变化时间 | `updatedAt`、`createdAt`、`expiresAt`（永久的排最后）、`category`、`quantity` | `category`（类别号）。包括已过期、数量为 0 的行 |
| `logins` | 用户名、昵称、IP | 时间 | `at` | `kind`（`register`/`login`）、`account`、`ip`（完全相同） |
| `online` | 昵称、用户名 | — | `name`、`username`、`node`、`room` | `node`（节点 ID） |
| `ledger` | 关联（`refId`）、备注 | 时间 | `at`、`delta` | `currency`（`coupon`/`lucci`/`koin`/`exp`）、`reason`、`account` |
| `grants` | 管理员、用户名、昵称 | 时间 | `at`、`amount` | `account`、`admin`（管理员用户名）、`currency`（同上） |
| `races` | 赛道 ID、房间 ID、比赛 ID | 时间 | `at` | `gameplay`、`track`（赛道 ID）、`account`（参赛账号） |
| `purchases` | 用户名、昵称、商品 ID（`offerId`） | 时间 | `at`、`price` | `account`、`currency`（`coupon`/`lucci`/`koin`） |
| `lottery-draws` | 用户名、昵称 | 时间 | `at` | `kind`（`treasure` 寻宝 / `gacha` 精品道具场）、`account` |
| `box-openings` | 用户名、昵称 | 时间 | `at` | `box`（宝箱的物品 ID）、`account` |
| `clubs` | 俱乐部名、会长用户名与昵称 | 创建时间 | `createdAt`、`name`、`members`、`cs`、`csWeek`、`budget` | — |

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/me` | 当前管理员 `{id, username, nickname}`（前端登录后调用确认权限） |
| GET | `/api/admin/overview` | 概览统计与最近注册/登录各 10 条 |
| GET | `/api/admin/accounts` | 用户列表；筛选 `online=1`、`banned=1`、`admin=1`；`q` 匹配账号、昵称、注册/最后登录 IP；排序 `createdAt`、`lastLoginAt`、`level`、`coupon`、`lucci`、`koin` |
| GET | `/api/admin/accounts/{id}` | 详情：账号字段、钱包、等级、物品数、在线状态、最近 20 条登录、最近 20 场比赛 |
| PATCH | `/api/admin/accounts/{id}` | 编辑 `{nickname?, admin?, bannedUntil?, banReason?, password?}`；昵称规则与注册相同且不能重名；不能撤销自己的管理员、不能封禁自己 |
| POST | `/api/admin/accounts/{id}/kick` | 作废会话并断开游戏连接；不能踢自己（409 `CANNOT_MODIFY_SELF`，否则当前管理会话也会作废） |
| GET | `/api/admin/accounts/{id}/inventory` | 物品列表（分页、按类别/名称搜索），带商城名称 |
| POST | `/api/admin/grant` | 现有接口（点券/金币/K币/经验发放与扣除），请求与错误不变；响应的 `account` 改为 `AccountRow` 加 `wallet: {coupon, lucci, koin}`（原有的 `wallet`、`level` 等字段仍在） |
| GET | `/api/admin/logins` | 登录记录；筛选 `kind`、`account`、`ip` |
| GET | `/api/admin/online` | 在线玩家（来自游戏节点注册信息）；`q` 匹配昵称/账号 |
| GET | `/api/admin/nodes` | 游戏节点与数据服务状态 |
| GET | `/api/admin/ledger` | 货币流水（含经验）；筛选 `currency`、`reason`、`account` |
| GET | `/api/admin/grants` | 发放记录 |
| GET | `/api/admin/races` | 比赛结算（每场一行，带参赛者名次与奖励）；筛选 `gameplay`、`track`、`account` |
| GET | `/api/admin/purchases` | 购买记录 |
| GET | `/api/admin/lottery-draws` | 抽奖记录 |
| GET | `/api/admin/box-openings` | 开箱记录 |
| GET | `/api/admin/clubs` | 俱乐部列表 |
| 现有 | `/api/admin/lottery`、`/api/admin/reward-box`、`/api/admin/notices`、`/multiplayer/admin/invites` | 保持不变 |

错误统一沿用现有格式 `{"error": "错误码"}`（`ACCOUNT_BANNED` 另带 `until`、`reason`）；未登录 401 `LOGIN_REQUIRED`、非管理员 403 `ADMIN_REQUIRED`，账号不存在 404 `ACCOUNT_NOT_FOUND`。

## 4. 返回字段（JSON 一律小驼峰；时间为毫秒；没有的值给 `null` 或空串，前端显示“—”）

- `AccountRow`：`id, username, nickname, admin, createdAt, registerIp, lastLoginAt, lastLoginIp, bannedUntil, banReason, banned`（`bannedUntil > now`）`, level, exp, coupon, lucci, koin, inventoryCount, onboarded, online`（`null` 或 `{nodeId, nodeName}`）。`lastLoginAt`、`bannedUntil` 为 0 时给 `null`（过期的封禁仍给出到期时间，`banned` 为 `false`）；旧账号的 `registerIp` 为空串；`admin` 含 `KART_ADMIN_USERNAMES`；`online` 在不在线或 Redis 不可用时为 `null`；没用过经济功能的账号 `lucci` 显示将要发放的初始金币。
- `GET /api/admin/me` → `{id, username, nickname}`
- `GET /api/admin/accounts/{id}` → `{account: AccountRow, club: null | {id, name, grade}, sessions: 有效会话数, logins: LoginRow[20], races: RaceParticipantRow[20]}`
- `PATCH /api/admin/accounts/{id}` 请求 `{nickname?, admin?, bannedUntil?`（0 = 解封）`, banReason?, password?}` → `AccountRow`；错误码沿用注册的 409 `NICKNAME_TAKEN`、400 `INVALID_ACCOUNT_FIELDS`（昵称 ≤ 16 字且规则同注册、密码 8–128 位、`banReason` ≤ 200 字且不含控制字符、`bannedUntil` 不为负且不晚于 9999 年），请求体不是 JSON 400 `INVALID_REQUEST`，以及 409 `CANNOT_MODIFY_SELF`（撤销自己的管理员、封禁自己）。`bannedUntil` 早于现在等于 0；解封时不带 `banReason` 就清空原因，封禁时不带则保留原来的。`KART_ADMIN_USERNAMES` 中的账号无论 `admin` 怎么设都仍是管理员（返回的 `admin` 反映这一点）。封禁与重置密码会作废该账号所有会话并断开游戏连接；每次修改都以管理员用户名写日志
- `POST /api/admin/accounts/{id}/kick` → `{sessions: 作废的会话数, game: 是否通知了游戏节点}`
- `InventoryRow`：`id, category, categoryName, itemId, name, systemKey, quantity, expiresAt, source, createdAt, updatedAt`
- `LoginRow`：`id, at, kind, accountId, username, nickname, ip, userAgent`
- `OnlineRow`：`playerId, name, guest, accountId, username, nodeId, nodeName, room`（`room` 是所在房间名，在大厅或旧节点为空串；游客的 `accountId`、`username` 为空串）
- `GET /api/admin/nodes` → `{now, nodes: NodeRow[], data: {version, goVersion, startedAt, goroutines, heapMB, mysql: {ok, latencyMs, error}, redis: {ok, latencyMs, error}}}`；`NodeRow`：`nodeId, name, origin, players, capacity, rooms, full, startedAt, seenAt, protocolVersion, status`（`ok` | `stale`（心跳超过 10 秒）| `full`）`, stats`（`null` 或 `{heapMB, goroutines, connections, races, version}`）。`origin` 为 `null` 表示经数据服务同源访问。节点注册 15 秒没有心跳就过期消失，所以“超时”取 10 秒（漏了两次 5 秒心跳）才能被看到。`mysql`/`redis` 检查失败时 `ok: false`、`latencyMs: null`、`error` 是中文说明（成功时为空串）；Redis 不可用时 `nodes` 为空数组
- `LedgerRow`：`id, at, accountId, username, nickname, currency`（`coupon` | `lucci` | `koin` | `exp`）`, delta, balanceAfter, reason, refId, note`。两张流水表合在一起，`id` 是字符串：`w<编号>`（`wallet_ledger`）或 `e<编号>`（`exp_ledger`），保证唯一；经验行的 `balanceAfter` 是变化后的经验
- `GrantRow`：`at, admin, requestId, accountId, username, nickname, currency, amount, note`（`note` 取自该次发放写的流水行；重复提交等没有改变余额的发放为空串）
- `RaceRow`：`raceId, roomId, at, gameplay, trackId, trackName, players, participants: RaceParticipantRow[]`（按名次）；`RaceParticipantRow`：`raceId, at, gameplay, trackId, trackName, rank, name, accountId, username, elapsedMs, points, exp, lucci`。`trackName` 是赛道表的中文名（不认识的赛道为空串）；`exp`、`lucci` 是这场比赛实际入账的经验与金币（游客或没有入账时为 `null`）；游客的 `accountId`、`username` 为空串；没有完赛的 `elapsedMs` 为 `null`
- `PurchaseRow`：`id, at, accountId, username, nickname, offerId, category, itemId, name, currency, price, days, count`（`days` 为 0 是永久）
- `InventoryRow` 与 `PurchaseRow` 的 `name` 先查原版物品表（与抽奖、开箱用的同一份），再查商城目录，都没有时为空串；`categoryName` 是类别的中文名（不认识的为“类别 N”）
- `LotteryDrawRow`：`at, requestId, accountId, username, nickname, kind, ref, refName, count, summary`（中文物品名拼成的一句话）`, result`（原始结果对象）。`ref` 是寻宝表编号或精品道具场的抽奖物品 ID，`refName` 是“寻宝”或抽奖物品的名称；`count` 是请求的次数，实际抽到的次数见 `summary`，例如“寻宝 10 次：宝宝、蓝色心型气球（7天）×2；保底奖励：…；提前停止（材料不足）”
- `BoxOpeningRow`：`at, requestId, accountId, username, nickname, boxId, boxName, stockId, summary, result`（`summary` 例如“开启 迷你宝箱：宝宝”）
- `ClubRow`：`id, name, masterId, masterUsername, masterNickname, members, hq, racing, rider, bank, budget, cs, csWeek, autoJoin, createdAt, breakAt`（`csWeek` 是本周的活跃点，`breakAt` 是正在解散的俱乐部的解散时间，否则 `null`）
- `GET /api/admin/overview` → `{now, accounts: {total, today, admins, banned}, logins: {today, uniqueToday}, online: {players, accounts, guests}, nodes: {total, healthy}, rooms, races: {today}, coupon: {spentToday, grantedToday}, recentRegistrations: AccountRow[10], recentLogins: LoginRow[10]}`；“今天”指北京时间 0 点起。`logins.today` 是登录次数，`uniqueToday` 是今天登录或注册过的账号数；`admins` 含 `KART_ADMIN_USERNAMES`；`nodes.healthy` 是没有超时的节点；`coupon.spentToday` 是点券的支出（不含管理员扣除），`grantedToday` 是管理员发放的点券；`recentLogins` 只列登录（不含注册）。Redis 不可用时 `online`、`nodes`、`rooms` 为 `null`
