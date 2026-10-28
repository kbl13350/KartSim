# 管理后台（Element Plus 版）约定

管理后台仍由数据服务提供：`GET /multiplayer/admin` 返回单页应用（带斜杠的 `/multiplayer/admin/` 是同一页面，前端构建的 base 即为它，资源在 `/multiplayer/admin/assets/`），只有管理员（库里 `admin` 标记或 `KART_ADMIN_USERNAMES`）能登录使用。本文是前端（`server-go/admin-ui/`）与后端（数据服务 `/api/admin/*`）的约定。

## 1. 前端

- 工程：`server-go/admin-ui/`，Vite + Vue 3 + Element Plus（Element UI 的 Vue 3 版本）+ `@element-plus/icons-vue`，TypeScript，中文语言包（`zh-cn`）。依赖版本在 `package.json` 里写死，`node_modules/` 不提交。
- 构建：`npm run build` 输出到 `server-go/internal/data/api/adminui/`（`index.html` 与 `assets/`），**构建产物提交进仓库**并由 Go `embed` 打进数据服务，`go build` 不需要 Node。改了前端必须重新构建并提交产物；有一个 Go 测试检查产物存在。
- 安全：模板全部预编译，不用 `eval`；页面安全策略保持 `script-src 'self'`（不放开 `unsafe-eval`），不引用任何 CDN；字体、图标都打进包里。登录 token 只放内存（与旧后台一致），刷新页面要重新登录。
- 布局：顶栏（标题“跑跑卡丁车 管理后台”、当前管理员、刷新、退出）；下面用 `el-tabs`（卡片式）做菜单，每个标签一个功能页，切换时保留各页的搜索条件；当前标签记在 URL hash（`#users`）。
- 标签页：

| 标签 | 内容 |
|---|---|
| 概览 | 统计卡片：注册用户总数、今日新增、今日登录人数、当前在线、游戏节点数（在线/总数）、房间数、今日比赛场次、今日点券消费、今日发放；最近注册、最近登录两张小表 |
| 用户管理 | 表格：账号、昵称、等级、经验、点券、金币、K币、物品数、注册时间、注册 IP、最后登录时间、最后登录 IP、在线（所在节点）、管理员、封禁；搜索：关键字（账号/昵称/IP）、注册时间范围、在线/封禁/管理员筛选；排序；分页。操作：详情（抽屉：基本信息、钱包、物品表、货币流水、登录记录、比赛记录）、编辑（昵称、管理员、GM 玩家、封禁到期与原因、重置密码）、赠送（点券/金币/K币/经验，正数发放、负数扣除，备注）、踢下线 |
| 登录记录 | 注册与登录记录：时间、类型、账号、昵称、IP、浏览器；按账号/IP/时间/类型搜索 |
| 在线玩家 | 当前在线的账号与游客：昵称、账号、所在节点、所在房间（有就显示）；按昵称/账号/节点搜索；可踢下线 |
| 服务器节点 | 卡丁城服务器（所有进城玩家去的节点，或自动：跟着城里人最多的节点；`GLOBAL_LOBBY.md`“卡丁城”）；节点管理（后台添加的节点与节点密钥，第 8 节）；游戏节点：节点 ID、名称、地址、玩家/容量（进度条）、房间数、卡丁城人数、启动时间与运行时长、最后心跳、协议版本、状态（正常/超时/满员）、内存、协程数、连接数、进行中的比赛；数据服务自身：版本、启动时间、数据库与 Redis 状态。自动刷新（5 秒） |
| 货币流水 | `wallet_ledger` 与经验流水：时间、账号、货币、变化、余额、原因、关联；按账号/货币/原因/时间搜索 |
| 发放记录 | 管理员发放与扣除（`admin_grants`）：时间、管理员、账号、货币、数量、备注 |
| 比赛记录 | 比赛结算：时间、模式、玩法、赛道、人数、名次与成绩、奖励；按账号/玩法/赛道/时间搜索 |
| 购买记录 | 商城购买：时间、账号、商品、货币、价格 |
| 抽奖与开箱 | 寻宝/精品道具场抽奖记录与开箱记录 |
| 俱乐部 | 俱乐部列表：名称、会长、等级、人数、创建时间 |
| 抽奖活动、奖励箱、公告、邀请码 | 原后台的功能，用 Element Plus 表单与表格重做，接口不变 |
| 经济设置 | 注册赠送与每场比赛赠送的点券/金币/K币，以及商城“点击获取点券”按钮的开关与每次数额（`GET`/`PUT /api/admin/economy`，`ECONOMY.md` 2.4/2.5）：表单、默认值提示、最后修改人与时间 |
| 大厅宣传 | 大厅首页右侧轮播图与两块宣传板的图片上传、点击链接与标题（第 10 节）：轮播图可增删排序、设切换间隔，宣传板可只改链接和文字 |
| 联赛回放 | 游戏 回放 → 联赛回放 的列表（`TIMEATTACK.md` 4）：已发布的联赛回放（标题、说明、赛道、设置、车手、卡丁车、成绩、大小、发布人与时间，删除），下方是排位录像池（各赛道、设置的前 10 名录像：时间、赛道、设置、车手、卡丁车、成绩、已发布次数；按账号/昵称/赛道搜索，赛道筛选），每行“发布为联赛回放”弹出标题与说明 |
| 自制地图 | 地图工坊发布的全部地图（含隐藏的，第 9 节）：缩略图、名称与地图 ID、作者（点开是账号详情抽屉）、主题、圈数、难度（星级）、道具箱数、赛道包大小、状态（公开/已隐藏）、更新与发布时间；按地图名/作者/地图 ID 搜索，状态、作者、更新时间筛选；操作：预览（选图卡片与缩略图大图和全部字段）、隐藏/恢复（确认框）、删除（危险确认框，不可恢复） |

- 所有表格：服务器端分页（每页 20/50/100）、搜索、可排序列；空数据、加载中、出错都有提示；时间统一按北京时间显示 `YYYY-MM-DD HH:mm:ss`；金额千分位。

## 2. 数据

- 新迁移（schema 版本 **12**）：
  - `login_records`：`id` 自增、`account_id`、`kind`（`register` | `login`）、`ip` VARCHAR(45)、`user_agent` VARCHAR(255)、`at` BIGINT；索引 `(account_id, at)`、`(at)`、`(ip)`。
  - `accounts` 增加：`register_ip` VARCHAR(45) 默认 ''、`last_login_at` BIGINT 默认 0、`last_login_ip` VARCHAR(45) 默认 ''、`banned_until` BIGINT 默认 0、`ban_reason` VARCHAR(200) 默认 ''。
  - 管理列表用的索引：`accounts(created_at)`、`accounts(last_login_at)`、`wallet_ledger(created_at)`、`exp_ledger(created_at)`、`admin_grants(created_at)`、`purchases(created_at)`、`lottery_draws(created_at)`、`race_results(account_id, created_at)`。`login_records.account_id` 是随账号删除的外键。加列、加索引前先查 `information_schema`，迁移中断后可以重跑。
- 注册、登录成功时记录（IP 用现有的可信代理规则取客户端地址；UA 截到 255）。旧账号没有注册 IP 显示“—”。
- 登录记录保留 180 天（与现有每小时清理一起删旧行）。
- 封禁：`banned_until > now` 的账号登录返回 403 `ACCOUNT_BANNED`（带 `until`、`reason`），封禁时作废该账号所有会话并通知游戏节点断开（复用单点登录踢下线的机制）。检查在密码验证通过之后（密码错误仍是 401 `INVALID_CREDENTIALS`，不暴露封禁），并在创建会话的事务里持有账号行锁进行，封禁取同一把锁，所以不会有封禁之后才建成的会话。作废的会话：删除 `sessions` 行、作废 Redis 会话缓存、以 4001 关闭好友聊天与小屋连接，旧 token 得到 401 `LOGIN_REQUIRED`。重置密码与踢下线做同样的事。入场票据有 2 分钟有效期，所以游戏节点为账号占用在线（`hello`）时数据服务也检查封禁，封禁中的账号得到 `ACCOUNT_BANNED`。
- 游戏节点心跳增加可选 `stats`：`heapMB`、`goroutines`、`connections`、`races`、`version`；数据服务原样存进节点注册信息，旧节点没有就不显示。`heapMB` 是当前堆上对象占用的内存（runtime/metrics `/memory/classes/heap/objects:bytes`，含尚未回收的对象；上次 GC 后的存活堆在第一次 GC 前一直是 0，不适合显示），`connections` 是打开的客户端连接，`races` 是处于载入、倒计时或比赛中的房间，`version` 是构建时的提交（前 12 位，未提交的改动加 `-dirty`），没有版本信息时为 `dev`。心跳的 `players[]` 另有可选 `room`（玩家所在房间的名称，在大厅时没有）；数据服务把最近一次心跳的玩家列表（去掉昵称或账号被别处占用、将被断开的玩家）存为 `node-online:{节点}`，与节点注册同样 15 秒过期。

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
| PATCH | `/api/admin/accounts/{id}` | 编辑 `{nickname?, admin?, gm?, bannedUntil?, banReason?, password?}`；昵称规则与注册相同且不能重名；不能撤销自己的管理员、不能封禁自己 |
| POST | `/api/admin/accounts/{id}/kick` | 作废会话并断开游戏连接；不能踢自己（409 `CANNOT_MODIFY_SELF`，否则当前管理会话也会作废） |
| GET | `/api/admin/accounts/{id}/inventory` | 物品列表（分页、按类别/名称搜索），带商城名称 |
| POST | `/api/admin/grant` | 现有接口（点券/金币/K币/经验发放与扣除），请求与错误不变；响应的 `account` 改为 `AccountRow` 加 `wallet: {coupon, lucci, koin}`（原有的 `wallet`、`level` 等字段仍在） |
| GET | `/api/admin/logins` | 登录记录；筛选 `kind`、`account`、`ip` |
| GET | `/api/admin/online` | 在线玩家（来自游戏节点注册信息）；`q` 匹配昵称/账号 |
| GET | `/api/admin/nodes` | 游戏节点与数据服务状态，卡丁城服务器设置 |
| PUT | `/api/admin/city-server` | 卡丁城服务器：所有进城玩家去的节点，或自动 |
| GET | `/api/admin/ledger` | 货币流水（含经验）；筛选 `currency`、`reason`、`account` |
| GET | `/api/admin/grants` | 发放记录 |
| GET | `/api/admin/races` | 比赛结算（每场一行，带参赛者名次与奖励）；筛选 `gameplay`、`track`、`account` |
| GET | `/api/admin/purchases` | 购买记录 |
| GET | `/api/admin/lottery-draws` | 抽奖记录 |
| GET | `/api/admin/box-openings` | 开箱记录 |
| GET | `/api/admin/clubs` | 俱乐部列表 |
| 现有 | `/api/admin/lottery`、`/api/admin/reward-box`、`/api/admin/notices`、`/multiplayer/admin/invites` | 保持不变 |
| `timeattack-replays` | 用户名、昵称、赛道编号 | 录像时间 | `updatedAt`、`bestMs`、`track` | `track`（赛道编号，完全相同）、`account`；行：`trackId, trackName, speed, booster, accountId, username, nickname, kartName, bestMs, byteSize, updatedAt, featured`（已发布为联赛回放的次数） |
| `featured-replays` | `GET` 列出已发布的联赛回放 `{replays: FeaturedReplay[]}`（新的在前）；`POST {trackId, speed, booster, accountId, title, note?}` 复制该排位录像并发布 → `{replay}`（400 `INVALID_FEATURED`：标题 1–60 字、说明 ≤ 200 字；404 `REPLAY_NOT_FOUND`：没有这条录像）；`DELETE /api/admin/featured-replays/{id}`（404 `FEATURED_NOT_FOUND`）。`FeaturedReplay`：`id, title, note, trackId, trackName, speed, booster, accountId, nickname, kartName, bestMs, byteSize, createdBy, createdAt`。表 `featured_replays`（schema v18）存录像副本，车手昵称是发布时的快照，不随账号删除 | | | |

错误统一沿用现有格式 `{"error": "错误码"}`（`ACCOUNT_BANNED` 另带 `until`、`reason`）；未登录 401 `LOGIN_REQUIRED`、非管理员 403 `ADMIN_REQUIRED`，账号不存在 404 `ACCOUNT_NOT_FOUND`。

## 4. 返回字段（JSON 一律小驼峰；时间为毫秒；没有的值给 `null` 或空串，前端显示“—”）

- `AccountRow`：`id, username, nickname, admin, gm, createdAt, registerIp, lastLoginAt, lastLoginIp, bannedUntil, banReason, banned`（`bannedUntil > now`）`, level, exp, coupon, lucci, koin, inventoryCount, onboarded, online`（`null` 或 `{nodeId, nodeName}`）。`lastLoginAt`、`bannedUntil` 为 0 时给 `null`（过期的封禁仍给出到期时间，`banned` 为 `false`）；旧账号的 `registerIp` 为空串；`admin` 含 `KART_ADMIN_USERNAMES`；`online` 在不在线或 Redis 不可用时为 `null`；没用过经济功能的账号 `lucci` 显示将要发放的初始金币。
- `GET /api/admin/me` → `{id, username, nickname}`
- `GET /api/admin/accounts/{id}` → `{account: AccountRow, club: null | {id, name, grade}, sessions: 有效会话数, logins: LoginRow[20], races: RaceParticipantRow[20]}`
- `PATCH /api/admin/accounts/{id}` 请求 `{nickname?, admin?, gm?, bannedUntil?`（0 = 解封）`, banReason?, password?}` → `AccountRow`；错误码沿用注册的 409 `NICKNAME_TAKEN`、400 `INVALID_ACCOUNT_FIELDS`（昵称 ≤ 16 字且规则同注册、密码 8–128 位、`banReason` ≤ 200 字且不含控制字符、`bannedUntil` 不为负且不晚于 9999 年），请求体不是 JSON 400 `INVALID_REQUEST`，以及 409 `CANNOT_MODIFY_SELF`（撤销自己的管理员、封禁自己）。`bannedUntil` 早于现在等于 0；解封时不带 `banReason` 就清空原因，封禁时不带则保留原来的。`KART_ADMIN_USERNAMES` 中的账号无论 `admin` 怎么设都仍是管理员（返回的 `admin` 反映这一点）。封禁与重置密码会作废该账号所有会话并断开游戏连接；每次修改都以管理员用户名写日志
- `POST /api/admin/accounts/{id}/kick` → `{sessions: 作废的会话数, game: 是否通知了游戏节点}`
- `InventoryRow`：`id, category, categoryName, itemId, name, systemKey, quantity, expiresAt, source, createdAt, updatedAt`
- `LoginRow`：`id, at, kind, accountId, username, nickname, ip, userAgent`
- `OnlineRow`：`playerId, name, guest, accountId, username, nodeId, nodeName, room`（`room` 是所在房间名，在大厅或旧节点为空串；游客的 `accountId`、`username` 为空串）
- `GET /api/admin/nodes` → `{now, nodes: NodeRow[], data: {version, goVersion, startedAt, goroutines, heapMB, mysql: {ok, latencyMs, error}, redis: {ok, latencyMs, error}}}`；`NodeRow`：`nodeId, name, origin, players, capacity, rooms, full, startedAt, seenAt, protocolVersion, status`（`ok` | `stale`（心跳超过 10 秒）| `full`）`, stats`（`null` 或 `{heapMB, goroutines, connections, races, version}`）`, cityPlayers`（在它卡丁城里的人数，大厅送去的也算；离线节点为 0）。`origin` 为 `null` 表示经数据服务同源访问。节点注册 15 秒没有心跳就过期消失，所以“超时”取 10 秒（漏了两次 5 秒心跳）才能被看到。`mysql`/`redis` 检查失败时 `ok: false`、`latencyMs: null`、`error` 是中文说明（成功时为空串）；Redis 不可用时 `nodes` 为空数组。`choices` 是全局大厅最近 100 次选节点（新的在前，只在内存里，数据服务重启后清空）：`{at, kind`（`race` | `city`）`, roomId?, roomName?, nodeId, nodeName, error?`（没有可用节点时 `NO_GAME_SERVER`，`nodeId` 为空）`, players: [{name, counted, latency`（节点 ID → 毫秒；`null` 未测速）`}], nodes: [{nodeId, name, players, capacity, score`（候选节点的分数；非候选为 `null`）`, excluded?`（`protocol` | `full`）`, cityPlayers?`（卡丁城的选择：当时在它城里的人数）`}], rule?`（卡丁城：`setting` 后台指定 | `crowd` 城里人最多 | `last` 城里没人、跟上一位进城的玩家 | `latency` 城里没人、按延迟）`, setting?, settingExcluded?`（指定的节点没能接收时：`offline` | `full` | `protocol`）`}`，`nodes` 按分数从低到高、非候选排最后；规则见 [`GLOBAL_LOBBY.md`](GLOBAL_LOBBY.md) 第 4 步与“卡丁城”。`city` 是卡丁城服务器设置（MySQL 不可用时为 `null`）：`{nodeId`（空串 = 自动）`, updatedAt, updatedBy, next: {nodeId, nodeName, rule, settingExcluded?, error?}}`，`next` 是现在一位没测速的玩家进城会分到的节点（没有可用节点时 `nodeId` 为空、`error: "NO_GAME_SERVER"`），不写进最近分配
- `PUT /api/admin/city-server` `{nodeId}`：空串为自动，否则是节点 ID（`[A-Za-z0-9_-]{1,64}`，不能是 `lobby`；可以是当前不在线的节点，它上线前按自动分配），否则 400 `INVALID_CITY_SERVER`；存进 `app_settings` 的 `cityServer` 行，返回与 `GET /api/admin/nodes` 的 `city` 相同的对象，写日志 `admin city server`。只影响之后进城的玩家
- `LedgerRow`：`id, at, accountId, username, nickname, currency`（`coupon` | `lucci` | `koin` | `exp`）`, delta, balanceAfter, reason, refId, note`。两张流水表合在一起，`id` 是字符串：`w<编号>`（`wallet_ledger`）或 `e<编号>`（`exp_ledger`），保证唯一；经验行的 `balanceAfter` 是变化后的经验
- `GrantRow`：`at, admin, requestId, accountId, username, nickname, currency, amount, note`（`note` 取自该次发放写的流水行；重复提交等没有改变余额的发放为空串）
- `RaceRow`：`raceId, roomId, at, gameplay, trackId, trackName, players, participants: RaceParticipantRow[]`（按名次）；`RaceParticipantRow`：`raceId, at, gameplay, trackId, trackName, rank, name, accountId, username, elapsedMs, points, exp, lucci`。`trackName` 是赛道表的中文名（不认识的赛道为空串）；`exp`、`lucci` 是这场比赛实际入账的经验与金币（游客或没有入账时为 `null`）；游客的 `accountId`、`username` 为空串；没有完赛的 `elapsedMs` 为 `null`
- `PurchaseRow`：`id, at, accountId, username, nickname, offerId, category, itemId, name, currency, price, days, count`（`days` 为 0 是永久）
- `InventoryRow` 与 `PurchaseRow` 的 `name` 先查原版物品表（与抽奖、开箱用的同一份），再查商城目录，都没有时为空串；`categoryName` 是类别的中文名（不认识的为“类别 N”）
- `LotteryDrawRow`：`at, requestId, accountId, username, nickname, kind, ref, refName, count, summary`（中文物品名拼成的一句话）`, result`（原始结果对象）。`ref` 是寻宝表编号或精品道具场的抽奖物品 ID，`refName` 是“寻宝”或抽奖物品的名称；`count` 是请求的次数，实际抽到的次数见 `summary`，例如“寻宝 10 次：宝宝、蓝色心型气球（7天）×2；保底奖励：…；提前停止（材料不足）”
- `BoxOpeningRow`：`at, requestId, accountId, username, nickname, boxId, boxName, stockId, summary, result`（`summary` 例如“开启 迷你宝箱：宝宝”）
- `ClubRow`：`id, name, masterId, masterUsername, masterNickname, members, hq, racing, rider, bank, budget, cs, csWeek, autoJoin, createdAt, breakAt`（`csWeek` 是本周的活跃点，`breakAt` 是正在解散的俱乐部的解散时间，否则 `null`）
- `GET /api/admin/overview` → `{now, accounts: {total, today, admins, banned}, logins: {today, uniqueToday}, online: {players, accounts, guests}, nodes: {total, healthy}, rooms, races: {today}, coupon: {spentToday, grantedToday}, recentRegistrations: AccountRow[10], recentLogins: LoginRow[10]}`；“今天”指北京时间 0 点起。`logins.today` 是登录次数，`uniqueToday` 是今天登录或注册过的账号数；`admins` 含 `KART_ADMIN_USERNAMES`；`nodes.healthy` 是没有超时的节点；`coupon.spentToday` 是点券的支出（不含管理员扣除），`grantedToday` 是管理员发放的点券；`recentLogins` 只列登录（不含注册）。Redis 不可用时 `online`、`nodes`、`rooms` 为 `null`

## 5. 第二轮（审查与浏览器验收后的补充）

- **活跃时间**：`accounts` 增加 `last_seen_at` BIGINT 默认 0、`last_seen_ip` VARCHAR(45) 默认 ''，以及索引 `accounts(last_seen_at)`。这两列放在迁移 **13**（`ensureColumn`/`ensureIndex`，可以重跑），同一迁移还给 `reward_box(created_at)` 加了索引供奖励箱列表使用。任何带会话令牌、处理成功（2xx）的请求都更新它们，同一账号最多每 5 分钟写一次（Redis `SET NX EX`，键按账号和北京日区分，所以零点后的第一个请求不会被节流挡住；没有 Redis 或 Redis 出错时用进程内节流）；注册与登录成功时也一并写入。每个账号每个北京日第一次用已保存的令牌活动、而当天还没有 `register`/`login`/`resume` 记录时，写一条 `login_records`，`kind` = `resume`（带当时的 IP 与浏览器，前端显示“自动登录”）。概览的“今日登录人数”`logins.uniqueToday` 统计今天有 `register`/`login`/`resume` 记录的不同账号；`logins.today` 仍是今天的 `login` 次数；`recentLogins` 仍只列 `login`。`AccountRow` 增加 `lastSeenAt`（没有为 `null`）`, lastSeenIp`（没有为空串）；用户列表排序增加 `lastSeenAt`，`q` 也匹配 `last_seen_ip`；登录记录的 `kind` 筛选接受 `resume`。
- **物品数**：`inventoryCount` 只算数量大于 0 且未过期的物品（与玩家自己的“我的物品”一致）；物品列表接口仍列出全部行。
- **解封**：`bannedUntil: 0`（或早于现在）解封时同时清空 `banReason`，除非同一请求里给了新原因；请求里带回的原因与库里的相同时不算新原因，照样清空。
- **超级管理员**：`KART_ADMIN_USERNAMES` 里的账号只能由自己修改；其他管理员对它们的 PATCH / 踢下线返回 409 `PROTECTED_ADMIN`（先判断 `CANNOT_MODIFY_SELF`：自己踢自己、撤销自己的管理员、封禁自己仍是那个错误）。
- **节点离线**：每次心跳后数据服务把节点信息存为 `node-seen:{node}`（24 小时过期，内容为最后一份节点信息；集合 `nodes-seen` 记录有哪些）。`GET /api/admin/nodes` 在注册表里的节点之后，列出 24 小时内见过、但注册表中已没有的节点，`status: "offline"`（字段同 `NodeRow`，`seenAt` 为最后心跳，`stats` 等为最后一份）；节点正常退出（`leave`）也算离线。概览 `nodes` 增加 `offline` 计数（`total` 仍只算注册表里的节点）。`NodeRow.stats.heapMB` 与数据服务的 `heapMB` 改为保留一位小数的数字（例如 `0.6`）；契约里是浮点数，旧节点发的整数照样能解析。新节点发出的小数旧数据服务无法解析，所以先升级数据服务再升级游戏节点。`node-online` 与 `node-seen` 在心跳刷新在线状态之后写入，写失败只记日志，心跳照常成功并返回冲突列表。
- **心跳里的账号**：心跳的 `players[]` 另有可选 `accountId`（游客与旧节点没有）。Redis 丢了账号映射（重启、清空）时，数据服务据此补回 `node-accounts` 与账号占用（账号键空着或就是该玩家时）；账号被别人占用时该玩家记为冲突，节点断开它。后台把玩家对应到账号时优先用心跳里的 `accountId`，旧节点用 `node-accounts`。
- **踢下线后的在线状态**：被踢 / 被封 / 被新登录顶替的会话，在游戏节点下次心跳断开前仍在节点的在线列表里，但它的账号占用（`presence-account`）已不是“该节点|该玩家”。这样的行在在线列表里带 `leaving: true`，`AccountRow.online` 为 `{nodeId, nodeName, leaving: true}`（前端显示“断开中”），不再显示为普通在线；概览的 `online` 计数与用户列表的 `online=1` 都不算它们。`OnlineRow` 与 `AccountRow.online` 一律带 `leaving`（平时为 `false`）。下一次心跳后节点断开它，行就消失。
- **进入游戏时的封禁检查**：游戏节点为账号占用在线（`hello`）时，数据服务先查封禁、写入占用后**再查一次**：封禁先提交、再标记在线占用，所以与封禁同时发生的 `hello` 要么被封禁的标记踢掉，要么在第二次检查时被拒绝并释放占用。拒绝时游戏节点把数据服务错误体里的其他字段原样放进 WebSocket 错误帧，即 `{"type":"error","code":"ACCOUNT_BANNED","reason":…,"until":…}`。
- **新接口**（列表接口都遵守 §3 的分页约定）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/accounts/{id}/game` | `{stats: null \| {races, wins, podiums, points}, license: null \| {level, proUntil, proCount, lastRunAt}, licenseClears: [{step, period, bestMs, clearedAt}], licenseRecords: [{trackId, trackName, bestMs, updatedAt}], timeAttack: [{trackId, trackName, bestMs, updatedAt}], quests: [{questId, title, period, value, completedAt, updatedAt}], counters: [{counter, value, updatedAt}], friends: 好友数, club: null \| {id, name, grade, joinedAt, csWeek, csTotal, donatedTotal}}`。`license.level` 是现在持有的驾照：1 新手 … 5 L1，PRO 有效期内为 6，0 为没有；`proUntil`、`lastRunAt` 为 0 时给 `null`；`licenseClears` 新的在前，`period` 对新手到 L1 为空串；`quests` 按最后变化新的在前，`title` 是任务名（任务表里没有的为空串），`completedAt` 未完成为 `null`；`counters` 按名称；`club` 不在俱乐部或俱乐部已解散时为 `null`，`csWeek` 是本周活跃点；账号不存在 404 `ACCOUNT_NOT_FOUND` |
| GET | `/api/admin/clubs/{id}/members` | 分页；`MemberRow`：`accountId, username, nickname, grade`（1 会长、2 管理层、3 优秀会员、4 会员）`, joinedAt, csWeek, csTotal, donatedTotal`（`csWeek` 是本周的活跃点）；`q` 匹配用户名、昵称，`from`/`to` 作用于加入时间；排序 `joinedAt, grade, csWeek, csTotal, donatedTotal`；任何状态的俱乐部都能查；俱乐部不存在 404 `CLUB_NOT_FOUND` |
| GET | `/api/admin/invites` | 分页；`InviteRow`：`hash`（摘要前 12 位，邀请码本身不存）`, createdAt, used, usedBy: null \| {accountId, username, nickname}, usedAt`（`usedAt` 是使用者的注册时间，未使用为 `null`；表里没有单独的使用时间）；筛选 `used=1\|0`（也可写 `true`/`false`）；`q` 匹配摘要开头与使用者的用户名、昵称；`from`/`to` 作用于创建时间；排序 `createdAt` |
| GET | `/api/admin/reward-box` | 分页；`RewardBoxRow`：`id, accountId, username, nickname, source, message, name, category, itemId, count, days, currency, createdAt, expiresAt, claimedAt, state`（`unclaimed` \| `claimed` \| `expired`；`claimedAt` 未领取为 `null`；货币奖励的 `currency` 为 `coupon`/`lucci`/`koin`，物品为空串）；筛选 `source`（`quest`/`club`/`admin`）、`state`、`account`；`q` 匹配账号、昵称、物品名；`from`/`to` 作用于发放时间；排序 `createdAt`。已领取与已过期的条目在领取或过期 30 天后由每小时的清理删除。`POST` 不变 |

- **俱乐部**：已解散（`break_at` 不晚于现在）的俱乐部 `ClubRow.state = "disbanded"`，解散倒计时中为 `"breaking"`，否则 `"active"`；列表筛选 `state`（`active`/`breaking`/`disbanded`），默认全部。已解散的俱乐部在任意玩家下一次俱乐部操作时才从库里删除，在那之前列表里仍能看到（标为已解散），玩家端与账号详情的 `club` 已不显示它。
- **抽奖摘要**：寻宝里由保底触发的抽取归入“保底奖励”，与精品道具场的里程保底奖励写法相同，例如“寻宝 10 次：宝宝、…；保底奖励：…”。
- **游戏客户端**：登录或进入游戏得到 `ACCOUNT_BANNED` 时显示“账号已被封禁，解封时间：YYYY-MM-DD HH:mm（原因：…）”（时间按北京时间），永久封禁（到期在 2099 年及以后，与后台的“永久”一致）显示“账号已被永久封禁（原因：…）”；没有原因时省略括号，拿不到时间（旧游戏节点）时显示“账号已被封禁（原因：…）”或“账号已被封禁。”，不再显示原始错误码。原因按文本显示，不当作 HTML。

## 7. 经济设置（schema v15 `app_settings`，规则见 [`ECONOMY.md`](ECONOMY.md) 2.3–2.5）

- `GET /api/admin/economy` → `{register{coupon,lucci,koin}, race{coupon,lucci,koin}, shopClaim{enabled,coupon,lucci,koin}, updatedAt, updatedBy, defaults{register, race, shopClaim}, serverTime}`；没有保存过时 `updatedAt` 为 0、`updatedBy` 为空，数值等于 `defaults`（`shopClaim` 默认开启、每次 10,000 点券）。
- `PUT /api/admin/economy` `{register{coupon,lucci,koin}, race{coupon,lucci,koin}, shopClaim{enabled,coupon,lucci,koin}}`：每项 0–1,000,000,000 的整数，否则 400 `INVALID_ECONOMY_SETTINGS`；不带 `shopClaim` 时按钮设置保持原样；成功返回与 GET 相同的对象，并写日志 `admin economy settings`。注册赠送对之后建立的钱包生效；每场比赛赠送在游戏节点下一次心跳后显示、由数据服务按结算时的设置入账；商城按钮在玩家下次打开商城时按新设置显示，每次点击按点击时的设置入账（`ECONOMY.md` 2.5，流水原因“商城领取”）。

## 8. 节点管理（schema v19 `game_nodes`，部署见 [`NODE.md`](NODE.md)）

“服务器节点”页最上面的“节点管理”卡片：添加节点得到只显示一次的节点密钥（以及 `KART_DATA_URL=<后台网址>`、`KART_NODE_KEY=…` 两行配置和一条 `kart-node init` 命令，可复制），表格列出后台添加的节点：名称与 ID、状态（在线 + 人数/容量、离线、未连接、已停用）、对外地址（后台设置的，否则节点上报的）、最后注册时间与 IP、备注、添加时间与添加者；操作：编辑（名称、对外地址、备注）、重置密钥、停用 / 启用、删除（都要确认）。下面原有的“游戏节点”表照常列出所有在线与离线节点（包括用共享密钥的节点）。

- `GET /api/admin/game-nodes` → `{nodes: GameNodeRow[]}`；`GameNodeRow`：`id, name, origin?, note?, disabled, createdBy, createdAt, keyCreatedAt, registeredAt?, registeredIp?, status`（`online` | `offline`（24 小时内见过）| `never` | `disabled`）`, players, capacity, liveOrigin?, seenAt?`
- `POST /api/admin/game-nodes` `{name, id?, origin?, note?}` → `{node, key}`：`id` 留空生成 `node-<6 位十六进制>`；名称 1–32 字，`id` 为 `[A-Za-z0-9_-]{1,64}`，`origin` 为空或 `http(s)://主机[:端口]`，备注最多 200 字，否则 400 `INVALID_NODE`；ID 已存在 409 `NODE_EXISTS`。密钥 `kn1.<id>.<32 字节 base64url>` 只在这里返回，数据库只存摘要
- `PATCH /api/admin/game-nodes/{id}` `{name?, origin?, note?, disabled?}` → `{node}`；停用时同时把节点从注册表移除（选服列表立即消失、在线占用释放），之后节点的调用得到 403 `NODE_DISABLED`；启用后节点下一次心跳就回来
- `POST /api/admin/game-nodes/{id}/key` → `{key}`：新密钥，旧密钥立即失效（节点得到 401 `NODE_KEY_INVALID`），节点从注册表移除
- `DELETE /api/admin/game-nodes/{id}` → `{ok: true}`；不存在 404 `NODE_NOT_FOUND`

每次添加、修改、重置与删除都写数据服务日志（`admin added a game node` 等，带管理员用户名）。节点每次注册（启动或 `kart-node check`）更新 `registered_at`/`registered_ip`。

## 6. 反作弊记录（schema v14，规则见 [`ANTICHEAT.md`](ANTICHEAT.md)）

- 标签页“反作弊记录”（登录记录之后）：时间、检测项（中文名，悬停看代码）、处理（已踢出 / 仅记录）、账号（点开是账号详情抽屉，可编辑封禁、赠送、踢下线；游客显示“游客”）、当时昵称、详情（测得的数值）、赛道、玩法、节点、比赛（悬停看房间、比赛、车手 ID）。搜索：关键字、账号、检测项、处理、节点、时间范围。
- 数据：迁移 **14** 新建 `anti_cheat_events`（`event_id` 唯一，游戏节点重投不重复；`account_id` 游客为空串，不设外键），与登录记录一样保留 180 天。
- 接口：

| 列表 | `q` 匹配 | `from`/`to` 作用于 | `sort` | 其他筛选 |
|---|---|---|---|---|
| `anti-cheat` | 当时昵称、用户名、昵称、详情；ASCII 时还有车手、房间、比赛 ID | 时间 | `at` | `code`（检测项）、`action`（`kick`/`log`）、`account`、`node`（节点 ID，完全相同） |

`GET /api/admin/anti-cheat` 返回 `AntiCheatRow`：`id, at, code, detail, action, accountId, username, nickname, name, playerId, nodeId, roomId, raceId, trackId, trackName, gameplay`（`name` 是被记录时的昵称；`username`、`nickname` 是账号现在的，游客与已删除账号为空串；`trackName` 是赛道中文名，没有为空串）。

## 9. 自制地图（地图工坊，接口与存储见 [`MAPS.md`](MAPS.md) 第 2、3 节）

- 标签页“自制地图”（联赛回放之后）列出 `GET /api/admin/maps`：

| 列表 | `q` 匹配 | `from`/`to` 作用于 | `sort` | 其他筛选 |
|---|---|---|---|---|
| `maps` | 地图名、作者用户名与昵称；ASCII 时还有地图 ID、作者账号 ID | 更新时间 | `updatedAt`、`createdAt`、`name`、`size`、`items` | `state`（`public`/`hidden`，默认全部）、`account`（作者） |

- `MapRow`：`id, name, ownerId, username, author`（作者昵称）`, theme, laps, difficulty, roadExtent, items`（道具箱数，0 只能竞速）`, files`（赛道包里的文件数）`, size`（赛道包字节数）`, sha256, hidden, createdAt, updatedAt`。主题按地图工坊的 `THEME_TITLES` 显示中文名。
- 图片：`<img>` 带不了会话令牌，页面 CSP 也不允许 `blob:`，所以前端用带令牌的 `fetch` 取 `GET /api/admin/maps/{id}/{thumb|card}?v=<sha256>`（隐藏的地图也返回），转成 `data:` URL 显示，并按路径缓存（`MapPicture.vue`）。
- 隐藏/恢复：`POST /api/admin/maps/{id}/hidden {hidden}`。隐藏后地图从公开列表、地图工坊、多人与道具房选图里消失，公开的文件接口 404（已经选了它的房间开赛时载入不了），作者的“我的地图”仍能看到。
- 删除：`DELETE /api/admin/maps/{id}` → `{ok: true}`，连同赛道包、设计与图片永久删除；不存在 404 `MAP_NOT_FOUND`。
- 隐藏、恢复、删除都写数据服务日志（`admin map hidden` / `admin map deleted`，带管理员用户名），并立即刷新道具房可选的地图表。

## 10. 大厅宣传（schema v23 `lobby_promo_images` + `app_settings` 的 `lobbyPromos` 行）

- 标签页“大厅宣传”（经济设置之后）配置大厅首页右侧的三个位置：上面的**轮播图**和下面的**蓝色、紫色两块宣传板**。每个位置可上传图片、填点击跳转的链接和标题。
  - 轮播图 0–8 张，每张必须有图片，切换间隔 2–60 秒（默认 5）。一张都没配置时游戏显示原版的 4 张加载插画（没有链接）。
  - 宣传板可以只填链接不传图：游戏保留原来的渐变底和角色，文字用“标题”（空着就是 COMING SOON）；传了图就整块显示图片（按比例裁切铺满）。
  - 链接：空（点击提示“敬请期待”）、`http(s)://` 网址，或以 `/` 开头的游戏站内路径（如 `/editor.html`）；都在新标签页打开。最长 500 字符，不能有空格、引号、尖括号和反斜杠。标题最多 40 字。
  - 建议尺寸：轮播图 1040×600（约 1.73:1），宣传板 1050×234（约 4.5:1）；图片按显示区域等比裁切铺满。
- 图片：`POST /api/admin/lobby-promos/images`，请求体就是图片文件本身（PNG、JPEG、GIF 或 WebP，不收 SVG；最大 4 MiB、每边最多 4096 px）→ `{image, url, contentType, width, height, size}`。`image` 是内容 SHA-256 的前 32 位十六进制，同一张图重复上传得到同一个 ID。坏图 400 `INVALID_PROMO_IMAGE`，过大 413 `PROMO_IMAGE_TOO_LARGE`；库里已有 100 张且清理后仍满时 409 `PROMO_IMAGE_LIMIT`。上传后没被任何位置用到、超过一天的图片在下次保存（或上传满额）时删除。
- 设置：`GET /api/admin/lobby-promos`；`PUT /api/admin/lobby-promos {interval, carousel:[{image, link, title}], boards:[{image, link, title}, {…}]}`（`boards` 依次是蓝、紫）。格式不对 400 `INVALID_LOBBY_PROMOS`，引用的图片不存在 400 `PROMO_IMAGE_NOT_FOUND`。两个接口都返回 `{interval, carousel[], boards[2], updatedAt, updatedBy}`，每项 `{image, url, width, height, link, title}`（没有图片时 `image`、`url` 为空串）。保存写数据服务日志（`admin lobby promos`）。
- 游戏读取（不需要登录）：`GET /api/lobby/promos`，字段同上但没有 `updatedBy`；图片已删除的轮播项不返回。图片 `GET /api/lobby/promo-images/{id}` 公开、`Cache-Control: public, max-age=31536000, immutable`、带 `ETag`、`X-Content-Type-Options: nosniff` 与 `Cross-Origin-Resource-Policy: cross-origin`。玩家下次打开大厅首页时看到新设置（客户端缓存 1 分钟）。

### GM 玩家标识

用户管理 → 编辑账号 → GM 玩家可设置或撤销开发者身份。`gm` 是独立于 `admin` 的布尔字段，默认 `false`，不会授予后台权限。数据库迁移 v24 添加 `accounts.gm`；账号列表与详情返回该字段，修改操作写入审计日志。

玩家重新进入大厅后，身份通过服务端签名票据传递，在房间玩家卡片底部显示独立的紫金开发者徽标，与房主及准备标识共存。普通房间、组队、挡人和 50 人乱斗共用此规则；跨节点比赛交接保留身份。文案随客户端语言显示为“开发者” / “Developer” / “개발자”。已连接的玩家需重新进入大厅以刷新身份。

## 12. 内置地图主题与显示开关

“地图管理”列出游戏资源中去重后的内置赛道，支持主题分类、名称/ID/主题搜索、开启/关闭状态筛选、单图开关和整个主题批量开关。“自制地图”继续管理玩家工坊作品。

- 目录来自 `internal/data/economy/track-directory.json`，由客户端 `node --import tsx tools/export-track-catalog.mjs --directory` 生成。地图的主题以资源元数据为准；反向及明显不同场景保留独立条目。同图别名由同一开关控制。
- `GET /api/admin/tracks`（管理员）返回 `{tracks, themes, version, updatedAt}`。`tracks` 每行包含 `id, title, theme, themeTitle, gameType, reverse, difficulty, aliases, enabled`；`themes` 每行包含 `id, title, total, enabledCount`。列表在浏览器内筛选分页。
- `PATCH /api/admin/tracks/{id}`（管理员）接收 `{enabled: boolean}`，按标准地图及其别名组设置显示开关。
- `PATCH /api/admin/track-themes/{theme}`（管理员）接收相同请求，批量设置主题下每张地图的独立开关。操作覆盖该主题的全部地图，不受后台当前搜索/状态筛选影响。两个 PATCH 都返回完整新目录。
- `GET /api/track-settings`（公开，只读）返回 `{disabledTrackIds, version, updatedAt}`。关闭 ID 同时包含标准 ID 与全部别名。默认全部开启；设置存入 `app_settings`，发布新版与重启后保留。接口不缓存。
- 关闭影响玩家的选图、收藏选图与随机池；资源文件、旧 ID、正在进行的比赛和历史回放仍保留。打开选图时刷新设置；游戏节点通过既有心跳同步关闭列表，避免多人随机抽中已关闭地图。
- 无效地图为 `TRACK_NOT_FOUND`，无效主题为 `TRACK_THEME_NOT_FOUND`，无效开关值为 `INVALID_TRACK_SETTINGS` / `INVALID_REQUEST`。管理员修改写入数据服务日志。


## 13. 内置车辆分类、预览与显示开关

“车辆管理”按竞速车、道具车、系统车辆分类，支持引擎世代、名称/ID/型号、开启/关闭筛选，单车开关及整个分类的批量开关。每辆车使用自身模型和贴图生成的预览，可点击或通过键盘放大。

- 目录来自 `internal/data/economy/vehicle-directory.json`，在客户端执行 `node --import tsx tools/export-admin-vehicle-directory.mjs` 生成。稳定 ID 为 `catalog:3:<itemId>` 或 `system:<systemKey>`，不依赖中文名。
- `GET /api/admin/vehicles`（管理员）返回 `{vehicles, categories, version, updatedAt, updatedBy}`。车辆字段为 `id, title, itemId, systemKey?, internalId, category, categoryTitle, engineGrade?, engineTitle, enabled`；分类字段为 `id, title, total, enabledCount`。
- `PATCH /api/admin/vehicles/{id}` 与 `PATCH /api/admin/vehicle-categories/{category}`（管理员）接收 `{enabled: boolean}`，返回完整新目录。分类操作覆盖该分类全部车辆，不受当前搜索、引擎和状态筛选影响。
- `GET /api/vehicle-settings`（公开只读）返回 `{disabledVehicleIds, version, updatedAt}`，`Cache-Control: no-store`。默认全部开启；设置存入 `app_settings` 的 `builtinVehicles`，重启和发布后保留。
- 打开车库、选车、商城和小屋选车界面时刷新设置；关闭车辆从新的选择、收藏、搜索和购买入口隐藏。已拥有的库存、当前装备、已开始的比赛、远征及历史记录保留；全部关闭时保留当前车辆展示并提示暂无可选车辆。重新开启恢复显示。
- 服务端拒绝新购买和切换到已关闭车辆，返回 409 `VEHICLE_DISABLED`；已成功购买的幂等重试仍返回原凭据，保留当前已装备车辆时可修改其他装备。
- 无效车辆为 `VEHICLE_NOT_FOUND`，无效分类为 `VEHICLE_CATEGORY_NOT_FOUND`，无效开关值为 `INVALID_VEHICLE_SETTINGS` / `INVALID_REQUEST`。批量修改使用事务和行锁，修改记录管理员及时间并写入日志。
