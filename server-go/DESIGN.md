# KartSim Go 服务端设计（数据服务 + 多节点游戏服务）

本文是 Go 重写的权威约定。旧 Java 服务（`../server`）仅作行为参考，不再修改。账号经济（开放注册、取消游客、等级、三种货币、库存、商店、奖励、管理页面）的权威约定见 [`ECONOMY.md`](ECONOMY.md)，本文第 8 节是它与本架构的衔接。

## 1. 总体架构

```
浏览器 ──HTTP──► kart-data（单实例，公网口 :8787）──► MySQL（持久化）
   │                 ▲  内部口 :8790（仅内网）        └► Redis（缓存、在线名、节点注册）
   │                 │  X-Kart-Cluster-Key
   └──WebSocket──► kart-game ×N（:8788, :8789 …，房间状态在内存）
```

- **数据服务 kart-data**：只有一个。唯一访问 MySQL 与 Redis 的进程。提供原 Java 的全部 HTTP API（账号、档案、影子记录、历史），新增“游戏服列表”“入场票据”、账号经济与好友私聊接口（好友私聊另有一个 WebSocket `/api/messenger/ws`，见第 9 节），另开内部端口供游戏节点调用（心跳注册、在线昵称占用、装备归属核对、房间规则保存、赛后结算与奖励入账）。
- **游戏服务 kart-game**：可部署多个，无数据库。每个节点各自持有内存房间；同一房间的所有玩家连在同一个节点上，因此比赛时钟、广播、运动帧中继都在单进程内完成，与 Java 版一致。
- **入场流程**（“带上数据节点和个人信息进入游戏服”）：
  1. 浏览器向数据服务 `GET /multiplayer/game-servers` 取在线游戏服列表，玩家选择一个（只有一个时自动进入）；想一起玩的人选同一个服。
  2. 浏览器 `POST /multiplayer/game-servers/ticket {nodeId}`，带 `Authorization: Bearer <会话token>`，数据服务签发一次性票据：HMAC 签名，含目标节点、数据节点 ID、账号信息、过期时间（2 分钟）、随机 nonce。默认没有游客（`KART_ALLOW_GUESTS=false`）：不带 Bearer 401 `LOGIN_REQUIRED`；账号未领取新手礼包 403 `ONBOARDING_REQUIRED`。只有开启游客时，不带 Bearer 才签发游客票据。
  3. 浏览器连接该游戏服 `ws(s)://<origin>/multiplayer/ws`，`hello` 携带 `ticket` 与装备。游戏服本地验签（共享密钥 `KART_CLUSTER_SECRET`），校验节点、数据节点、过期与 nonce 未用过，拒绝游客票据（未开启游客时），向数据服务核对装备归属，再调用数据服务内部接口占用在线昵称。游戏服永远看不到会话 token。
  4. 比赛结算（以及房间规则变化）后，游戏服把结果（含每位车手的奖励）写入本地发件箱（outbox 目录），后台按序 `POST` 到数据服务内部接口；数据服务幂等写入 MySQL、为账号入账并刷新缓存。数据服务暂时不可用时结果不会丢失，节点重启后会继续补发。

## 2. 目录与归属

```
server-go/
  go.mod                         module kartsim（go 1.26，依赖已固定：go-redis v9、go-sql-driver/mysql、gorilla/websocket、miniredis v2、modernc sqlite）
  deps.go                        依赖固定（build tag tools）
  internal/shared/apierr         错误码类型、JSON 输出（已完成）
  internal/shared/ticket         票据签名/验签（已完成，含测试）
  internal/shared/contract       内部 API 路径与 JSON 结构（已完成）
  internal/shared/netcfg         可信主机、CORS、WebSocket Origin 校验（已完成，含测试）
  cmd/kart-data/                 数据服务入口
  internal/data/...              数据服务实现（internal/data/messenger：好友私聊的 WebSocket 与在线状态 hub）
  cmd/kart-migrate-sqlite/       旧 SQLite kart.db → MySQL 迁移工具
  cmd/kart-game/                 游戏服务入口
  internal/game/...              游戏服务实现
  test/                          Node 端到端脚本（smoke、auth-smoke、economy-smoke、frontend-economy-check、run-cluster-smokes）
  Dockerfile, docker-compose.yml, .env.example, README.md
```

共享包由协调者维护；如需修改共享包，请在汇报中说明而不是直接改。**不要修改 go.mod / go.sum**（所需依赖已全部加入）。

## 3. 数据服务 kart-data

### 3.1 配置（环境变量）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `KART_DATA_ADDR` | `127.0.0.1`（兼容 `SERVER_ADDRESS`） | 公网 HTTP 监听地址 |
| `KART_DATA_PORT` | `8787`（兼容 `KART_SERVER_PORT`） | 公网端口，与旧 Java 相同，前端配置无需改 |
| `KART_INTERNAL_LISTEN` | `127.0.0.1:8790` | 内部 API 监听（只给游戏节点，不要暴露公网） |
| `KART_MYSQL_DSN` | `kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci` | go-sql-driver DSN；程序会补上 `parseTime=false`、`charset`、`collation` 等必要参数 |
| `KART_REDIS_ADDR` | `127.0.0.1:6379` | |
| `KART_REDIS_PASSWORD` / `KART_REDIS_DB` | 空 / 0 | |
| `KART_REDIS_PREFIX` | `kart:` | 所有 Redis 键前缀 |
| `KART_CLUSTER_SECRET` | 必填，≥32 字符 | 票据签名与内部 API 认证 |
| `KART_DATA_NODE_ID` | `data-1` | 写入票据，游戏服校验 |
| `KART_LAN_HOSTS`（兼容 `KART_LANHOSTS`） | 空 | 见 netcfg |
| `KART_PUBLIC_ORIGIN` | 空 | 若设置，`auth/config` 直接返回它作为 backendOrigin（反向代理/负载均衡后使用） |
| `KART_BOOTSTRAP_INVITE` | 空 | `KART_REGISTRATION=invite` 时作为首个邀请码（仅当没有任何邀请和账号时创建，为空则随机生成）；任何模式下 `KART_ADMIN_USERNAMES` 中有尚未注册的用户名时，每次启动都记录错误日志并确保有可用的引导邀请码（刚创建的首个邀请码，否则未被使用的该值，再否则新生成的随机码）。都打印到日志 |
| `KART_REGISTRATION` | `open` | `open`/`invite`/`closed`（ECONOMY.md 0） |
| `KART_ALLOW_GUESTS` | `false` | 是否签发游客票据 |
| `KART_ADMIN_USERNAMES` | 空 | 管理员用户名（逗号分隔，不写入数据库；原有 `admin=1` 保持）。名单中的用户名在任何注册模式下都必须凭有效邀请码注册（400 `INVALID_INVITE`） |
| `KART_EXP_RATE` / `KART_LUCCI_RATE` | `1` | 奖励倍率，入账时应用；心跳响应把它们告诉游戏节点（显示用），比赛结算带回显示时用的倍率，数据服务在 [0, max(10, 当前配置)] 内采用 |
| `KART_STARTING_LUCCI` | `10000` | 新账号初始金币 |
| `KART_TRUSTED_PROXIES` | 回环地址 | 信任其 `X-Forwarded-For` 的代理（IP/CIDR，`none` 为不信任），用于按客户端 IP 限流 |
| `KART_MESSENGER_MAX_CONNECTIONS` | `5000` | 好友私聊 WebSocket 上限（含未 hello 的连接），超出时升级前返回 HTTP 503 `SERVER_BUSY`（1–1,000,000） |
| `KART_MESSENGER_SEND_BUFFER_BYTES` | `262144` | 每个好友私聊连接待发送的字节上限（65536–67108864），超出以 1008 关闭 |
| `KART_WS_COMPRESSION` | `true` | 好友私聊与小屋 WebSocket 协商 permessage-deflate，规则同游戏节点（4.3 WebSocket 层） |

启动时：连接 MySQL（重试 30 秒）、在 `GET_LOCK('kartsim_schema')` 下执行建表/迁移、连接 Redis（重试）。Redis 不可用时**缓存降级**为直连 MySQL 并告警，但在线昵称与节点注册依赖 Redis，此时 ticket/presence 接口返回 503 `DATA_SERVICE_UNAVAILABLE`。

### 3.2 公网 HTTP API（与 Java 行为一致）

逐条对齐 `../server/src/main/java/local/kartsim/server/{HttpApi,Accounts,StorageApi,HistoryApi}.java` 及 `../server/README.md`：

| 路径 | 说明 |
| --- | --- |
| `GET /multiplayer/healthz` | `{"protocolVersion":40,"ruleset":"launcher-room-v1","transport":"websocket","service":"data","dataNode":…}` |
| `GET /multiplayer/auth/config` | 同 Java：`X-Forwarded-Host` 存在且可信 → `{"loginRequired":false,"backendOrigin":null}`；否则 Host 可信 → `http://<host>:<本地端口>`；`KART_PUBLIC_ORIGIN` 优先；不可信 400 `INVALID_HOST` |
| `POST /multiplayer/auth/guest-name` | `{"available": 名字合法 && 非账号昵称 && 不在任何游戏服在线}`；非法 400 `INVALID_GUEST_NAME` |
| `POST /multiplayer/auth/register` / `login` / `nickname` / `logout`，`GET /multiplayer/auth/me` | 同 Java（校验规则、错误码、PBKDF2-SHA256 120000 次 256 位、格式 `120000:base64盐:base64哈希`、43 字符 token、会话 30 天、sha256 base64url 存储），保证可直接迁移旧数据。账号经济带来的差异（ECONOMY.md 6）：`register` 按 `KART_REGISTRATION` 决定是否需要邀请码（`KART_ADMIN_USERNAMES` 中的用户名任何模式下都需要，否则 400 `INVALID_INVITE`），成功返回 `{account, token}`，密码 8–128 位，按 IP（IPv6 /64，另有 /56 维度）与全站限流 429 `TOO_MANY_ATTEMPTS`（全站额度只在字段、邀请码与重名预检通过后计数）；`login` 失败次数按（用户名、客户端网段 IPv4 /24 或 IPv6 /64）计数；`auth/config` 返回 `loginRequired:true`、`registration`、`guests`。管理后台（ADMIN.md 2）带来的差异：注册与每次成功登录在同一事务内写 `login_records`（客户端 IP 按可信代理规则取得，UA 截到 255 字节）并更新账号的注册 IP、最后登录时间与 IP；被封禁（`banned_until > now`）的账号在密码验证通过之后才被拒绝，403 `ACCOUNT_BANNED`（响应体另带 `until`、`reason`），检查在会话事务内持有账号行锁进行，与封禁互斥。第二轮（ADMIN.md 5）：注册、登录与之后带令牌的成功请求都更新账号的 `last_seen_at`/`last_seen_ip`（请求的写入按账号与北京日节流，最多每 5 分钟一次），一个北京日里第一次用记住的令牌活动且当天没有其他记录时写一条 `resume` 记录 |
| `POST /multiplayer/admin/invites` | 同 Java |
| `GET /multiplayer/ice` | `{"iceServers":[]}` |
| `POST /multiplayer/offer` | 501 `{"error":"USE_LOCAL_WEBSOCKET"}` |
| `GET/PUT /api/profile/{ownerId}`，`GET /api/records/{ownerId}`，`GET/PUT /api/records/{ownerId}/{recordId}` | 同 Java（X-Profile-Key、403/404 语义、大小上限 1,000,000 / 4,000,000 字符、记录允许数组） |
| `GET /api/race-results?name=`、`GET /api/race-outcomes?gameplay=`、`GET /api/room-rules` | 同 Java（最近 100 条） |
| **新增** `GET /multiplayer/game-servers` | `contract.GameServerList`：存活节点，按 name 排序；`full = players >= capacity` |
| **新增** `POST /multiplayer/game-servers/ticket` | 请求 `contract.TicketRequest`；带 Bearer 则必须有效（否则 401 `LOGIN_REQUIRED`）且已领取新手礼包（否则 403 `ONBOARDING_REQUIRED`），签发账号票据（`Guest=false, AccountID, Username, Nickname, Admin`）；不带 Bearer 时只有 `KART_ALLOW_GUESTS=true` 才签发游客票据（`Guest=true`），否则 401 `LOGIN_REQUIRED`。节点不存在/已下线 404 `GAME_SERVER_NOT_FOUND`，已满 503 `GAME_SERVER_FULL`。响应 `contract.TicketResponse` |
| **新增** `GET /api/player-stats?name=<昵称>` | `{"nickname","races","wins","podiums","points","updatedAt"}`，不存在 404 `PLAYER_NOT_FOUND`（仅统计注册账号） |
| **新增** `/api/messenger/*` | 好友与私聊（HTTP 与 WebSocket `GET /api/messenger/ws`），见第 9 节 |

错误体 `{"error":"CODE"}`；未知异常 500 `INTERNAL_ERROR`（记录日志）；JSON 解析失败 400 `INVALID_REQUEST`；请求体上限 8 MiB。所有公网路由套 `netcfg.CORS`。

### 3.3 内部 API（`contract` 包，监听 `KART_INTERNAL_LISTEN`）

全部 `POST`，必须带 `X-Kart-Cluster-Key`（`subtle.ConstantTimeCompare`），否则 401 `CLUSTER_KEY_INVALID`。

- `PathHeartbeat`：保存节点信息（Redis `node:{id}` JSON，TTL 15 秒；集合 `nodes`），并为 `Players` 中每个玩家续期在线昵称与账号键（值匹配才续期；键已过期则用 NX 重新占用；被其他会话占用的玩家列入 `Conflicts`，游戏节点断开它们）。更新 `node-players:{id}`（小写名集合）与 `node-accounts:{id}`（玩家 → 账号）；`node-epoch:{id}` 记录节点进程的启动时间，节点重启后先释放旧进程的占用。返回 `HeartbeatResponse`，其中 `expRate`/`lucciRate` 是数据服务的 `KART_EXP_RATE`/`KART_LUCCI_RATE`，游戏节点用它们换算显示的 `race.rewards`。可选的 `stats`（`heapMB` 是保留一位小数的浮点数，旧节点的整数照样解析；`goroutines`、`connections`、`races`、`version`）原样存进 `node:{id}`；`Players` 里的可选 `room`（所在房间名）连同玩家列表（去掉冲突的玩家）存进 `node-online:{id}`，供管理后台的在线玩家页使用；节点信息另存 `node-seen:{id}`（24 小时，集合 `nodes-seen`），管理后台据此列出离线节点。这两份在刷新在线状态的脚本之后写入，写失败只记日志，心跳照常返回冲突。`Players` 里的可选 `accountId`（玩家 hello 时占用的账号）让数据服务补回 Redis 丢失的 `node-accounts:{id}` 项：账号键空着或就是该玩家时补上并重新占用，被其他会话占用时该玩家列入 `Conflicts`。
- `PathNodeLeave`：删除节点及其全部在线昵称与账号占用。
- `PathPresenceClaim`：Lua 原子操作。键 `presence:{lower(name)}`，值 `nodeId|playerId`，TTL 30 秒。键不存在 → 占用；值相同 → 续期成功；占用者节点已不存在（`node:{id}` 缺失）→ 抢占；否则 409 `NICKNAME_TAKEN`。带 `AccountID` 时同一脚本还占用账号键 `presence-account:{accountId}`（同样的值、TTL 与接管规则，先于昵称检查，两者都能占用才写入）：被其他在线会话占用时 409 `ACCOUNT_ONLINE`，因此一个账号全集群同时只有一个会话。`Guest=true` 时先验证名字（同 Java validName，最多 18 码点）→ 400 `INVALID_GUEST_NAME`，并且不得与账号昵称（不区分大小写）相同 → 409 `NICKNAME_TAKEN`。账号占用在脚本前后各查一次封禁（403 `ACCOUNT_BANNED`，带 `until`、`reason`）：封禁先提交、再标记在线占用，所以与封禁同时到达的占用要么被那次标记踢掉，要么被第二次检查拒绝并释放；游戏节点把错误体里的 `until`、`reason` 放进给浏览器的错误帧。
- `PathPresenceRelease`：比较值后删除昵称键与账号键。
- `PathRoomRules`：upsert `room_rules`，仅当 `updatedAt >=` 现值才覆盖；失效历史缓存。
- `PathRaces`：一个事务内 `INSERT IGNORE race_outcomes`（json = Snapshot 原文），若为新比赛再插入 `race_results`（含 `account_id`）并累计 `player_stats`（仅有 accountId 的行：races+1；`elapsedMs!=null` 时 points 累加、rank==1 计 wins、rank<=3 计 podiums），并为 `Rewards` 中有 `AccountID` 的车手入账（乘倍率：结算的 `ExpRate`/`LucciRate` 在 [0, max(10, 当前配置)] 内时采用它，否则用 `KART_EXP_RATE`/`KART_LUCCI_RATE`；按数据服务收到结算时的北京时间自然日套每日上限；逐级升级奖励；流水原因 `race`、引用 raceId）。超过公式最大值（经验 145/金币 216，倍率前）的条目丢弃并告警；`FinishedAt` 早于 24 小时前的结算只保存赛果、不入账；重复提交返回 `{"stored":true,"duplicate":true}` 且不重复累计、不重复入账；失效历史缓存。
- `PathEquipmentVerify`：`{accountId, equipment}` → 200 `{"ok":true,"validUntil"?}`（`validUntil` 为所查租用物品最早到期时间）或 409 `ITEM_NOT_OWNED`（`missing` 列出槽位与物品）。只核对商店出售的分类与系统车（槽位 3 为 0 时由 `systemKart` 指明），其他槽位不核对；未知账号什么都不拥有。

### 3.4 MySQL 表（utf8mb4，InnoDB，需要 MySQL ≥ 8.0.19）

用户名/昵称/比赛名字列使用 `utf8mb4_0900_as_ci`（大小写不敏感、重音敏感，对应 Java `COLLATE NOCASE`/`equalsIgnoreCase`）；ID 列 `ascii_bin`。`schema_migrations(version)` 记录版本。

```
accounts(id CHAR(36) PK, username VARCHAR(24) UNIQUE, nickname VARCHAR(64) UNIQUE,
         password_hash VARCHAR(255), admin TINYINT, created_at BIGINT)
sessions(token_hash VARCHAR(64) PK, account_id FK→accounts ON DELETE CASCADE, expires_at BIGINT, INDEX(account_id))
invites(code_hash VARCHAR(64) PK, created_at BIGINT, used_by CHAR(36) NULL FK→accounts)
owner_keys(owner_id VARCHAR(64) PK, secret_hash VARCHAR(64), created_at BIGINT)
profiles(owner_id VARCHAR(64) PK, json LONGTEXT, updated_at BIGINT)
records(owner_id VARCHAR(64), record_id VARCHAR(100), json LONGTEXT, updated_at BIGINT,
        PK(owner_id, record_id), INDEX(owner_id, updated_at))
race_results(id BIGINT AUTO_INCREMENT PK, room_id, race_id, player_id, account_id NULL,
             name VARCHAR(64), `rank` INT, elapsed_ms INT NULL, points INT, created_at BIGINT,
             UNIQUE(race_id, player_id), INDEX(created_at), INDEX(name, created_at))
race_outcomes(race_id PK, room_id, gameplay VARCHAR(20), track_id VARCHAR(64), json LONGTEXT,
              created_at BIGINT, INDEX(created_at), INDEX(gameplay, created_at))
room_rules(room_id PK, json TEXT, updated_at BIGINT, INDEX(updated_at))
player_stats(account_id PK FK→accounts ON DELETE CASCADE, races, wins, podiums, points INT, updated_at BIGINT)
```

schema v2 另有账号经济表 `account_progress`、`wallets`、`wallet_ledger`、`exp_ledger`、`inventory_items`、`purchases`、`account_onboarding`、`account_profiles`、`timeattack_bests`、`timeattack_runs`、`daily_rewards`；schema v3 加 `admin_grants`（管理员发放的 `requestId` 绑定账号、货币与数额）与 `timeattack_state`（每账号最近一次计时赛结算，用于节奏限制与重试），结构与约束见 ECONOMY.md 5。`timeattack_runs` 与 `daily_rewards` 保留 30 天，由每小时的清理任务（与过期会话清理一起）删除。schema v4 加好友与私聊的 `messenger_settings`、`friendships`、`friend_requests`、`account_blocks`、`private_messages`、`private_conversations`（第 9.5 节）。schema v12（管理后台）加 `login_records`（注册、登录与自动登录记录，保留 180 天，由每小时的清理任务删除）、`accounts` 的 `register_ip`/`last_login_at`/`last_login_ip`/`banned_until`/`ban_reason` 列，以及管理列表按时间分页、按账号筛选用的索引（ADMIN.md 2）；schema v13（管理后台第二轮）加 `last_seen_at`/`last_seen_ip` 与其索引，以及 `reward_box(created_at)` 索引。给已有表加列与加索引一样，先查 `information_schema`，所以迁移中断后可以重跑。

`invite` 模式的注册在 `GET_LOCK('kartsim_register')` 下进行（邀请单次使用、首个账号为管理员不出现竞态）；开放模式不取命名锁，并发注册同名由唯一键决定，可选邀请码由加锁读取保证只用一次；唯一键冲突（1062）映射为 `USERNAME_TAKEN` / `NICKNAME_TAKEN`。启动引导邀请在 `GET_LOCK('kartsim_bootstrap')` 下进行。

### 3.5 Redis 用法（前缀 `KART_REDIS_PREFIX`）

| 键 | 内容 | TTL |
| --- | --- | --- |
| `session:{tokenHash}` | accountId | min(5 分钟, 剩余有效期)；logout 删除 |
| `account:{id}` | 账号 JSON | 10 分钟；改名删除 |
| `ownerkey:{ownerId}` | 密钥摘要 | 1 小时 |
| `profile:{ownerId}` | 档案 JSON | 10 分钟；写入后回填 |
| `record:{ownerId}:{recordId}` | 记录 JSON（≤256 KiB 才缓存） | 10 分钟；写入后回填 |
| `history:gen` | 历史缓存代数（写入时 INCR） | 永久 |
| `history:{gen}:…` | 三个历史列表的响应 | 30 秒 |
| `node:{id}` / `nodes` / `node-players:{id}` / `node-accounts:{id}` / `node-epoch:{id}` / `node-online:{id}` | 游戏节点注册（`node-online` 是最近一次心跳的玩家列表） | 15 秒 / — / 60 秒 / 60 秒 / 60 秒 / 15 秒 |
| `presence:{lower(name)}` | `nodeId\|playerId` | 30 秒 |
| `presence-account:{accountId}` | `nodeId\|playerId`（一个账号一个在线会话） | 30 秒 |
| `rl:{key}` | 限流计数（`register-ip:{IP，IPv6 为 /64}` 每小时 5 次、`register-site:{IPv6 /56}` 每小时 10 次、`register-all` 每分钟 60 次（预检通过后才计数）、`login-ip:{IP，IPv6 为 /64}` 每 5 分钟 20 次、`login-fail:{用户名}\|{IPv4 /24 或 IPv6 /64}` 每 15 分钟 10 次失败、`write:{accountId}` 每分钟 300 次、`friend-request:{accountId}` 每小时 20 次）；注册在 Redis 不可用时拒绝（503），其余放行 | 窗口长度 |

缓存为旁路缓存：先写 MySQL 提交，再删除/回填；Redis 出错只记日志，回退 MySQL。

## 4. 游戏服务 kart-game

### 4.1 配置

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `KART_GAME_ADDR` | `127.0.0.1`（兼容 `SERVER_ADDRESS`） | |
| `KART_GAME_PORT` | `8788` | |
| `KART_NODE_ID` | `game-<端口>` | 只允许 `[A-Za-z0-9_-]{1,64}` |
| `KART_NODE_NAME` | 同 NODE_ID | 显示名（最多 32 码点） |
| `KART_PUBLIC_ORIGIN` | `http://127.0.0.1:<端口>` | 浏览器访问本节点的 HTTP(S) origin；设为 `same-origin` 表示经数据服务同源代理（列表中 origin 为 null） |
| `KART_DATA_INTERNAL_URL` | `http://127.0.0.1:8790` | 数据服务内部 API |
| `KART_DATA_NODE_ID` | `data-1` | 票据中的数据节点必须相同 |
| `KART_CLUSTER_SECRET` | 必填 | |
| `KART_MAX_PLAYERS` | `400` | 满员时 hello 返回 503 `SERVER_FULL` |
| `KART_OUTBOX_DIR` | `./data/outbox-<NODE_ID>` | 结算发件箱（目录权限 0700，文件 0600） |
| `KART_LAN_HOSTS` | 空 | WebSocket Origin 校验与 CORS |
| `KART_ALLOW_GUESTS` | `false` | 为 false 时游客票据的 `hello` 返回 401 `LOGIN_REQUIRED` |
| `KART_WS_COMPRESSION` | `true` | `/multiplayer/ws` 协商 permessage-deflate，见 4.3 WebSocket 层 |

### 4.2 HTTP

- `GET /multiplayer/healthz` → Java 同款字段 + `"service":"game","nodeId":…`。
- `GET /multiplayer/ws` → WebSocket（`netcfg.CheckWebSocketOrigin`；无 Origin 头接受）。
- 其余 404。CORS 同数据服务。

### 4.3 WebSocket 协议：逐行移植 Java

**必须**逐行对照 `../server/src/main/java/local/kartsim/server/{LobbyService,Room,GameModes,LocalWebSocket}.java` 移植，保持所有命令、校验顺序、错误码、快照字段（含字段“存在/省略/为 null”的区别）、计时器、广播对象（谁收到、谁被排除）一致。要点：

- 一个全局互斥锁对应 Java 的 `synchronized`；计时器（`time.AfterFunc`）回调同样先加锁并校验 room/race ID 与阶段。
- `now()` 为本进程启动以来的单调毫秒（`time.Since(start).Milliseconds()`），与 Java 一致。同一房间的玩家都在本节点，无需跨节点时钟。
- JSON 输入：保持 Jackson 语义。`text()` 按码点计数、拒绝 ISO 控制字符（U+0000–001F、U+007F–009F）；`integer()` 只接受 JSON 整数字面量（`5.0`、`1e2` 不算）且在 int32 范围；`booleanField()` 必须是 JSON 布尔；`optionalText()` 缺失或 null 返回空；`input.has("revision")`（含 null）即校验。错误码 `"INVALID_" + 大写键名`。
- 输出：`Map.of`/`LinkedHashMap` 对应的字段集合必须一致；空列表输出 `[]` 不是 `null`（如 `loadedIds`、roadblock 的 `results: []`）；`team` 在个人模式输出 `null`；`randomTrackCode` 为 0 时也输出；`teamScores` 键为 `"1"`、`"2"`；装备 JSON 原样保留（`json.RawMessage`）；rp 的 `poolRevision` 为字符串 `"[387, 390, 378, 361]"` 的 SHA-256 十六进制。
- WebSocket 层：每连接一个读协程（顺序处理请求，等同 Spring 的逐条回调）和一个写协程（有界队列；队列满或写超时 5 秒则关闭连接，对应 `ConcurrentWebSocketSessionDecorator`）。文本消息上限 64 KiB（压缩消息按解压后的大小计）；二进制运动帧按 Java `relayMotion` 的规则中继，但帧头是协议 40 的 8 字节格式（类型、接收者掩码、座位号、比赛标记、序号，`../SERVER_PROTOCOL.md`“运动数据”）：节点校验比赛标记，并把座位号改写为发送者真实的座位号后再转发。浏览器提供 permessage-deflate 时协商它（不保留上下文，所以不占每连接内存），只压缩 512 字节及以上的文本消息，运动帧不压（`internal/shared/wsdeflate`，`KART_WS_COMPRESSION=false` 关闭）；好友私聊与小屋 WebSocket 用同一规则。请求带合法 `requestId`（字符串、非空白、≤64）时回复原样带回；无 `requestId` 的成功请求不回复；错误总是回复 `{"type":"error","code":…,"requestId"?}`。JSON 解析失败回复 `INVALID_REQUEST`。读超时 90 秒（客户端每 10 秒 `clock`），服务端每 30 秒发 ping。
- `hello` 改动（票据；账号经济另加的 `LOGIN_REQUIRED`、`ITEM_NOT_OWNED` 与 `race.rewards` 见下文与第 8 节）：版本/规则/资源版本/名字校验顺序同 Java，然后必须有 `ticket`（字符串）：缺失 401 `TICKET_REQUIRED`；签名/格式错 401 `TICKET_INVALID`；过期 401 `TICKET_EXPIRED`；`NodeID` 不是本节点 403 `TICKET_WRONG_NODE`；`DataNode` 不符 403 `DATA_NODE_MISMATCH`；nonce 已用 401 `TICKET_REUSED`（本节点在过期前记住 nonce）。游客用请求中的 `name`；账号用票据中的 `Nickname`（忽略请求 name）。随后本节点内名字不区分大小写去重（同 Java，409 `NICKNAME_TAKEN`），再检查本节点没有该账号的其他会话（409 `ACCOUNT_ONLINE`；同一账号在同一节点重复进入时昵称相同，通常先得到 `NICKNAME_TAKEN`），核对装备后调用数据服务 `PresenceClaim` 占用昵称与账号（网络调用期间**不得**持有全局锁；跨节点的重复进入由它返回 409 `ACCOUNT_ONLINE`）；数据服务不可达 503 `DATA_SERVICE_UNAVAILABLE`。成功后 `welcome` 与 Java 相同。旧字段 `token` 忽略。
- 断开：释放房间（同 Java `disconnect`），异步 `PresenceRelease`。
- 比赛中离开房间（`leave` 或断开；**不同于 Java**，Java 在 `loading`/`countdown`/`racing` 阶段有人离开即取消整局并返回 `MEMBER_LEFT`）：只有离开者退出本局，其他车手照常比赛、必须跑完。离开者记入 `race.outIDs`（退出本局的车手），仍在冻结的 `roster` 中；已载入的离开者在 `race.results` 中按未完赛排在最后（排在其他未完赛者之后）。服务端不再等待离开者：`loading` 阶段其余车手都已载入即开始倒计时；`racing` 阶段其余车手都已 `finish` 即立即结算（不等 10 秒完赛窗口）。离开者重新加入房间后按迟到者处理（比赛命令返回 403 `NOT_RACE_PARTICIPANT`，不中继其运动帧，返房也不等它）。仍会取消（`MEMBER_LEFT`）的情况只有：挡人模式 `loading` 阶段跑者离开或已不可能凑齐 5 名载入车手；`loading`/`countdown` 阶段所有车手都已离开。`racing` 阶段所有车手都已离开时，已有人完赛则先结算再开放房间，否则直接开放房间（不带 `raceError`），房间里的迟到者不必等待。挡人模式跑者在 `countdown`/`racing` 阶段离开仍按 `runner-left` 结束。团队积分按开赛时冻结的队伍计算，完赛后离开的车手照常计分。迟到者（不在 `roster` 中）离开从不影响比赛。
- 载入失败与载入超时（**不同于 Java**，Java 取消整局并返回 `LOAD_FAILED`/`LOAD_TIMEOUT`）：`load-failed`（仍只在 `loading` 阶段接受，否则 `RACE_NOT_LOADING`）只把发送者移出本局——从 `loadedIds` 删除（即使它已报告 `loaded`，因而不出现在 `results` 中）并记入 `race.outIDs`；载入截止时（普通 30 秒、特殊玩法 90 秒）还没 `loaded` 的车手同样记入 `race.outIDs`。被移出的车手留在房间里，按迟到者处理（之后的 `loaded` 等比赛命令返回 403 `NOT_RACE_PARTICIPANT`），本局结束、其他人返房后房间照常开放。其余车手都已载入即开始倒计时。只有本局无法开始时才取消（`raceError` 为 `LOAD_FAILED`/`LOAD_TIMEOUT`）：没有剩下的车手，或挡人模式跑者被移出、已凑不齐 5 名载入车手。浏览器在 `loading` 之后看到自己不在 `loadedIds` 中即知道已被移出，回到房间等待；其他车手的浏览器把不在 `loadedIds` 中的车手标为退出并隐藏其赛车。
- 成员记录 `accountId`（游客为空），结算时随结果上报。
- 账号经济（ECONOMY.md 2.1、6，见第 8 节）：未开启游客时游客票据的 `hello` 返回 401 `LOGIN_REQUIRED`（在票据校验之后）；`hello`/`create`/`join`/`equipment` 携带的装备由连接协程在不持有大厅锁时调用 `PathEquipmentVerify`（命令先在锁内跑到 Java 应用装备处，必然失败的命令不核对；核对后重新执行命令）：不拥有时 `hello` 返回 403 `ITEM_NOT_OWNED`（不占用昵称、不消耗房间状态；浏览器重读库存、换回新手装备后用新票据重试），`create`/`join`/`equipment` 在 Java 应用装备处返回 403 `ITEM_NOT_OWNED`，数据服务不可达 503 `DATA_SERVICE_UNAVAILABLE`。`ready`（准备时）核对发送者自己的装备，`start` 重新核对缓存已过期的所有成员，不拥有者被取消准备、开赛失败（403 `ITEM_NOT_OWNED`）；`start` 时房间里同一账号有两个座位则 409 `ACCOUNT_ONLINE`。会话缓存：肯定结果到 min(`validUntil`, 核对后 10 分钟)，否定结果 10 秒；每连接需要核对的命令 2 次/秒（突发 10，超出 429 `RATE_LIMITED`），全节点最多 32 个并发核对（超出 503 `DATA_SERVICE_UNAVAILABLE`，不排队）。`finalizeRace` 用 `internal/shared/rewards` 计算每位载入车手的基础奖励写进 `RaceSettlement.Rewards`，并带上显示用的倍率 `ExpRate`/`LucciRate`；快照 `race.rewards`（Java 字段之后）显示乘以数据服务倍率后的数值（`rewards.ApplyRate`，倍率取自最近一次心跳响应的 `expRate`/`lucciRate`，与入账算法相同）。只影响奖励的防刷规则（ECONOMY.md 2.1）：游戏节点记录每个 `finish` 到达的服务器时间，服务器观察到的比赛时长 ≥ 10 秒且客户端 `elapsedMs` 不比它短 3 秒以上才按完赛计奖；挡人模式开跑 10 秒内结束时所有人按未完赛，中途离开者无奖励（名次赛中完赛后才离开的照常发放）；组队平局双方都无胜方加成。
- 持久化：Java 中 `saveRules` / `saveResults` 改为生成 `contract.RoomRulesRequest` / `contract.RaceSettlement`（在锁内序列化快照）并写入发件箱，**不在锁内做网络或磁盘慢操作以外的阻塞**（发件箱写文件可在锁内完成，或交给有序队列，但必须保证顺序）。
- 心跳：每 5 秒 `PathHeartbeat`（在线玩家及其所在房间名、房间数、容量、origin，以及 `stats`：堆占用（含尚未回收的对象）、协程数、连接数、正在载入/倒计时/比赛中的房间数、构建版本）。启动时立即注册一次。
- 关闭（SIGINT/SIGTERM）：停止接收新连接，向所有连接发送关闭帧 1001，`PathNodeLeave`，发件箱最多冲刷 5 秒；未发出的保留在磁盘，下次启动补发。

- 道具赛（本地新增，规则见 `../rewrite/ITEM_MODE.md`，协议见 `../SERVER_PROTOCOL.md`“本地新增：道具赛”）：频道 `itemIndiCombine`/`itemTeamCombine`（速度 7）只接受 `gameplay:"item"`，反之亦然（`INVALID_CHANNEL`），需要 p3553。赛道、随机池与默认赛道取自 `internal/game/itemmode/itemmode.json`（`TRACK_NOT_ITEM`；随机码 40 `INVALID_TRACK`），载入窗口 90 秒，快照 `race.item` 在 `race` 最后。运动帧除最远进度外还记录每名车手的**当前**路线距离与圈数（负载偏移 108/116），道具抽取与目标按它排名（已完赛者按完赛顺序在前）。`item` 请求全部在大厅锁内同步处理、没有计时器：每名车手一个严格 +1 的序号（接受即消耗，之后被拒绝也不回退），规则在纯包 `internal/game/itemmode`（每局一个 `itemmode.Race`，随机源每局一个 crypto 种子的 PCG，测试可经 `Options.ItemRandom` 注入）；道具锁、透视、`useId` 60 秒有效期与道具箱 10 秒刷箱检查都用时间戳在下一次请求时判断。广播用 `broadcastPeerEvent`（排除发送者），透视结果直接发给透视方队伍。服务器只决定给什么道具、打谁和何时到达；命中由受害者自报（同一 `useId` 每名受害者只记一次，香蕉首次命中即移除），道具效果在各客户端按 `startAt` 表现。组队道具赛不接受 `team-charge`，`winningTeam` 为最先冲线者的队伍（`teamScores` 照常输出），胜方加成跟随它（平分也给）。数据服务把 `gameplay:"item"`（或道具频道）的结算计入成就 gameType 2/4。

### 4.4 发件箱（outbox）

目录中每条一个文件 `<20位序号>-<kind>.json`（内容 `{"path":…, "body":…}`），先写临时文件再 rename。单个工作协程按序号发送：2xx 删除；409 视为成功；其他 4xx（408、429 除外）移入 `dead/` 并记录错误；网络错误/5xx 指数退避重试（1 秒起，最长 30 秒），保持顺序。启动时扫描已有文件继续发送。

### 4.5 内存防护（房间状态保留在进程内存）

房间状态很小（满员房间约 20 KB），内存风险主要来自连接与发送缓冲，因此：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `KART_MAX_PLAYERS` | `400` | 已完成 hello 的连接上限，超出 hello 返回 503 `SERVER_FULL` |
| `KART_MAX_CONNECTIONS` | `MAX_PLAYERS + 50` | 含未 hello 连接的 WebSocket 上限，超出时升级前返回 HTTP 503 |
| `KART_MAX_ROOMS` | `200` | 本节点房间上限，`create` 超出返回 503 `ROOM_LIMIT_REACHED` |
| `KART_SEND_BUFFER_BYTES` | `1048576` | 每连接待发送字节上限（按消息字节累计，不按条数）；超出即关闭该连接（1008/1011），不影响其他玩家 |
| `KART_MEMORY_LIMIT_MB` | `0`（不限） | 设置后调用 `debug.SetMemoryLimit`（等同 GOMEMLIMIT），并在堆使用超过其 90% 时拒绝新连接（HTTP 503）和新 hello（503 `SERVER_BUSY`），已在房间的玩家不受影响 |
| `KART_HELLO_TIMEOUT` | `15s` | 连接后未完成 hello 的超时关闭，防止空连接占用 |

另外：每连接文本消息读上限 64 KiB（按解压后的大小）；未 hello 连接不得创建房间；聊天保持最近 32 条；票据 nonce 记录随过期清理；发件箱只在磁盘，内存中不积压。心跳上报 `players`/`rooms` 让数据服务列表显示负载，满员节点 `full=true`。`/multiplayer/healthz` 增加 `connections`、`players`、`rooms`、`heapMB` 字段便于监控。

## 5. 前端（rewrite/）

- `backendOrigin` 的含义变为**数据服务**（账号、档案、历史、游戏服列表、票据都走它），配置格式不变。
- 新模块 `src/multiplayer/game-servers.ts`：解析/校验 `GameServerList` 与 `TicketResponse`；`origin` 为 null → 使用 backendOrigin（同源代理）；HTTPS 页面要求 HTTPS 游戏服；记住上次选择（localStorage `kartsim.multiplayer.game-server`，读写需 try/catch）。
- 选服对话框：存在多个可用服时显示（名称、在线人数/容量、满员不可选，默认选中上次的服）；只有一个可用服时自动进入；没有可用服时报错“暂无可用的游戏服务器”。
- 进入大厅：昵称确定后先选服；每次连接尝试（包括昵称冲突重试）都重新申请票据，然后连接 `<游戏服 origin>/multiplayer/offer`（`websocketUrlForOffer` 会改成 `/multiplayer/ws`），`hello` 发送 `ticket`，不再把会话 token 发给游戏服。
- 先确认 `src/generated/*.js` 是否由 `tools/generate-modules.mjs` 从其他源文件生成：如是，修改真正的源并重新生成，而不是只改生成物。
- `vite.config.ts` 开发代理：`^/multiplayer/ws` → 游戏服（`KART_LAN_GAME_BACKEND`，默认 `http://127.0.0.1:8788`，`ws: true`），`^/api/messenger/ws` → 数据服务（`ws: true`，必须排在 `^/api/` 之前），其他 `^/multiplayer/` 与 `^/api/` → 数据服务（`KART_LAN_BACKEND`）。
- 更新/新增单元测试，`npm run typecheck` 与相关 `npm test` 必须通过。

## 6. 运维

- `run-full-local.sh`：构建 `server-go/bin/{kart-data,kart-game}`；检查 MySQL/Redis 可达并给出清晰报错；开发用 `KART_CLUSTER_SECRET` 缺省时生成并保存在 `server-go/data/cluster-secret`（0600）；启动数据服务与 `KART_GAME_NODES`（默认 1）个游戏节点（端口 8788 起），最后启动 Vite；Ctrl-C 停止全部。
- `run-lan.sh`：数据服务与游戏节点监听 0.0.0.0；单游戏节点经 Vite 同源代理（`KART_PUBLIC_ORIGIN=same-origin`）。`run-full-local.sh` 单独使用时，`same-origin` 必须配合指向同源反向代理的 `VITE_MULTIPLAYER_BACKEND_ORIGIN`，否则拒绝启动。集群密钥只传给服务进程，不进入 npm/Vite 环境。
- `docker-compose.yml`：mysql:8.4、redis:7、kart-data、两个 kart-game；`Dockerfile` 多阶段构建两个二进制。网络分 `backend`（internal：mysql、redis、kart-data）与 `cluster`（kart-data、游戏节点），游戏节点访问不到 MySQL/Redis。`.env` 以 `install -m 600` 创建。
- `test/smoke.mjs`、`test/auth-smoke.mjs`、`test/economy-smoke.mjs`，以及仓库根的 `server-smoke.mjs`、`server-special-smoke.mjs`：先从数据服务取列表与票据，再连接游戏服。没有游客后，每个脚本玩家都注册账号（开放注册）、领取新手礼包、用 Bearer 票据和新手装备进入；为避开每 IP 每小时 5 次的注册限流，每个玩家发送不同的 `X-Forwarded-For`，被测数据服务须用 `KART_TRUSTED_PROXIES` 信任脚本所在地址（默认回环即可；自带集群的脚本固定 `127.0.0.1/32`），否则用 `KART_SMOKE_ACCOUNTS` 提供已有账号。`auth-smoke`/`economy-smoke` 自行启动集群并在任何退出路径清理临时库、账号、Redis 键；`test/run-cluster-smokes.mjs` 用同样的临时集群运行三个“集群已运行”的脚本。
- 启动脚本把 `KART_REGISTRATION`（默认 `open`，先校验）传给数据服务，校验 `KART_ADMIN_USERNAMES` 并在启动后打印管理页面 `<数据服务>/multiplayer/admin`；`run-lan.sh` 显式设置 `KART_TRUSTED_PROXIES=127.0.0.1/32,::1/128`（Vite 代理在本机）。compose 把经济变量传给数据服务，游客开关也传给游戏节点（倍率由心跳响应告诉游戏节点，不需要传）。
- `README.md`（中文）：架构、启动、环境变量、API、迁移、分布式部署（每个游戏节点独立域名/端口的 wss，Nginx 示例）、备份。

## 7. 本机测试环境（开发期）

- MySQL 8.4：`127.0.0.1:3307`，root 无密码；应用账号 `kart` / `kartpass`，已有库 `kartsim`、`kartsim_test`。测试 DSN：
  `kart:kartpass@tcp(127.0.0.1:3307)/kartsim_test?charset=utf8mb4&collation=utf8mb4_0900_as_ci`
- Redis：`127.0.0.1:6380`（测试专用；**不要使用 6379**，那是用户自己的实例）。
- Go 测试中 MySQL 相关测试读取 `KART_TEST_MYSQL_DSN`，未设置时 `t.Skip`；Redis 相关单测可用 miniredis。

## 8. 账号经济（衔接，详见 ECONOMY.md）

- **取消游客（默认）**：数据服务 `KART_ALLOW_GUESTS=false` 时不签发游客票据（401 `LOGIN_REQUIRED`），游戏节点 `KART_ALLOW_GUESTS=false` 时拒绝游客票据的 `hello`（401 `LOGIN_REQUIRED`）。两个开关应一致；开启时恢复第 1 节的游客流程。账号必须先领取新手礼包（`POST /api/account/starter`），否则票据 403 `ONBOARDING_REQUIRED`。
- **注册**：`KART_REGISTRATION=open` 默认，注册即登录；`invite` 保留 Java 行为（含首个账号为管理员）；`closed` 拒绝注册。管理员另由 `KART_ADMIN_USERNAMES` 指定（运行时判断，不写库），名单中的用户名在任何模式下都要凭有效邀请码注册，启动时为尚未注册的名字打印引导邀请码。注册、登录与经济写接口按客户端 IP、客户端网段或账号限流（登录失败按用户名 + 网段计数，别人无法锁住你的账号），客户端 IP 只从 `KART_TRUSTED_PROXIES` 中的代理读取 `X-Forwarded-For`。
- **装备核对**：所有余额、库存以数据服务为准。游戏节点在 `hello`/`create`/`join`/`equipment` 携带装备时、`ready` 与 `start` 重新核对时，于连接协程内调用内部接口 `PathEquipmentVerify`，不在锁内做网络调用；结果按会话与装备缓存（“拥有”到 min(`validUntil`, 10 分钟)，“不拥有”10 秒），核对次数按连接与全节点限制。拒绝时房间状态不变（`start` 失败时不拥有者被取消准备）。一个账号全集群同时只能有一个会话、一个座位（`ACCOUNT_ONLINE`）。账号档案 `PUT /api/account/profile` 同样核对（409 `ITEM_NOT_OWNED`），`GET` 把过期装备换回新手装备。
- **奖励流程**：游戏节点 `finalizeRace` 计算基础奖励（`internal/shared/rewards`，所有玩法，挡人按规则折算名次）→ 快照 `race.rewards` 立即显示乘倍率后的数值（倍率来自心跳响应，`rewards.ApplyRate`）→ `RaceSettlement.Rewards`（基础值）经发件箱按序投递 → 数据服务在结算事务内用同一个 `rewards.ApplyRate` 乘倍率（结算携带的倍率在允许范围内时采用它）、按收到结算时的北京时间自然日套每日上限、逐级发放升级奖励并写 `exp_ledger`/`wallet_ledger`，幂等键为 raceId + 账号，重复投递或数据服务停机后的补发都只入账一次（完成时间早于 24 小时前的不再发奖励）。计时赛由浏览器调用 `POST /api/timeattack/settle`（`requestId` 幂等），服务端校验赛道（`tracks.json`）、节奏（429 `TOO_MANY_ATTEMPTS`），判断个人最佳与无效成绩。
- **商店与管理**：商店目录、等级表与计时赛赛道表来自 `internal/data/economy`（`rewrite/tools/export-economy-data.mjs` 生成，`--check` 校验），购买以 `requestId` 幂等，并可带 `expectedPrice`/`expectedCurrency`（与当前报价不符 409 `PRICE_CHANGED`）；管理后台 `GET /multiplayer/admin` 是 Vue 3 + Element Plus 单页应用（`admin-ui/` 构建到 `internal/data/api/adminui/` 并嵌入数据服务），接口与返回字段见 [`ADMIN.md`](ADMIN.md)：账号列表与详情、编辑、封禁、踢下线、登录记录、在线玩家、节点状态、各类流水与记录；发放仍是 `/api/admin/grant`（写流水，余额不为负；`requestId` 绑定账号、货币与数额，参数不同 409 `REQUEST_ID_CONFLICT`）。
- **测试**：`test/economy-smoke.mjs` 覆盖以上流程并直接核对 MySQL 流水与余额一致（运行方式见 README“测试”）。

## 9. 好友与私聊（messenger）

本节是浏览器与 kart-data 之间的契约（路径、JSON 字段、错误码、WebSocket 帧与关闭码），前端 `rewrite/` 按它实现，两边必须一致。

### 9.1 原则

- 全部在 kart-data（单实例）中，以服务端为准：MySQL 保存好友、请求、屏蔽、设置与私聊消息，进程内的 hub（`internal/data/messenger`）只保存可以重建的东西（连接、在线状态、刷屏计数）。必须登录（Bearer 会话 token）。
- 账号一律用 `accountId`（`accounts.id`，UUID）表示，不暴露用户名。好友请求按**昵称**（车手名，唯一、不区分大小写）发起。
- 1:1 私聊消息**持久化**（MySQL，保留 30 天），对方回来后照常收到；对方离线时界面仍显示原版的“%s处于离线状态”系统行。
- 变更走 HTTP POST/PUT（CORS 只允许 GET/PUT/POST）；实时推送走每个标签页一个 WebSocket。
- 任何改变账号 X 的好友、请求、屏蔽、设置或会话列表的操作之后，服务端向 X 的每个连接推送 `{"type":"sync"}`（发起操作的标签页也收到），客户端（去抖后）重新 `GET /api/messenger/state`。消息与在线状态单独推送，不发 `sync`。
- 错误：HTTP `{"error":"CODE"}`（apierr，状态码见下表）；WebSocket `{"type":"error","code":"CODE","requestId"?}`。

### 9.2 JSON 结构

```
Me           = { accountId, nickname, level, glove }            // level/glove 由 account_progress.exp 换算（同 /api/account）
Settings     = { blockFriendRequests: bool, blockGameInvites: bool, invisible: bool }
Presence     = "online" | "inGame" | "offline"
Friend       = { accountId, nickname, level, glove, favorite: bool, since: ms, presence: Presence }
Incoming     = { accountId, nickname, level, glove, createdAt: ms, expiresAt: ms }   // 发给我的待处理请求
Outgoing     = { accountId, nickname, level, glove, state: "pending"|"accepted"|"refused",
                 createdAt: ms, resolvedAt: ms|null, expiresAt: ms }
                 // pending：expiresAt = 自动拒绝时间；accepted/refused：expiresAt = 卡片自动删除时间
Block        = { accountId, nickname, level, glove, since: ms }
Conversation = { accountId, nickname, lastMessageId: number, lastMessageAt: ms, unread: number, lastReadId: number }
Message      = { id: number, from: accountId, to: accountId, text, sentAt: ms, clientId }
Limits       = { friends: 100, pendingOutgoing: 30, blocks: 100, messageLength: 30, requestDays: 7, resultDays: 7 }
State        = { me: Me, settings: Settings, friends: Friend[], incoming: Incoming[], outgoing: Outgoing[],
                 blocks: Block[], conversations: Conversation[], limits: Limits, serverTime: ms }
```

- 在线状态：账号持有游戏节点的在线占用（Redis `presence-account:{id}`，且其节点 `node:{nodeId}` 仍在注册）为 `inGame`；否则至少有一个已 hello 的好友私聊连接（最后一个连接断开后还有 5 秒宽限）且 `settings.invisible` 为 false 为 `online`；否则 `offline`。隐身账号对别人永远是 `offline`，在游戏中也一样。Redis 不可用时游戏部分视为不在游戏，`online`/`offline` 照常。
- `friends` 收藏在前、按昵称排序；`incoming`、`outgoing`、`blocks` 新的在前；`outgoing` 不含发送者清理掉的卡片。
- `conversations`：不含隐藏的，按 `lastMessageAt` 倒序，最多 10 个（原版左栏 10 格）。
- 消息文本：去掉首尾空白后 1–30 个码点（原版 chatInput maxChar=30），不得含控制字符（`validText`）。
- 每小时清理尚未处理到的行按清理后的样子显示：过了 `expiresAt` 的待处理请求视为在 `expiresAt` 被拒绝（`resultDays` 后删除），不再出现在对方的 `incoming` 中。

### 9.3 HTTP API（全部需要 Bearer，未登录 401 `LOGIN_REQUIRED`）

| 方法与路径 | 请求 → 200 响应 | 错误 |
| --- | --- | --- |
| `GET /api/messenger/state` | → `State` | |
| `POST /api/messenger/friends/request` | `{nickname}` → `{request: Outgoing}`；对方已先向我发过请求时直接成为好友 → `{friend: Friend, accepted: true}` | 404 `PLAYER_NOT_FOUND`，400 `CANNOT_ADD_SELF`，409 `ALREADY_FRIENDS`，409 `REQUEST_PENDING`，409 `REQUEST_COOLDOWN`（被拒后到下一个北京时间 06:00 前），409 `FRIEND_LIMIT`（我的），409 `TARGET_FRIEND_LIMIT`，409 `REQUEST_LIMIT`，403 `FRIEND_REQUESTS_BLOCKED`（对方的设置，或对方屏蔽了我），409 `BLOCKED_TARGET`（我屏蔽了对方），429 `TOO_MANY_ATTEMPTS` |
| `POST /api/messenger/friends/respond` | `{accountId, accept: bool}` → 同意 `{friend: Friend}`，拒绝 `{ok: true}` | 404 `REQUEST_NOT_FOUND`，409 `FRIEND_LIMIT`，409 `TARGET_FRIEND_LIMIT` |
| `POST /api/messenger/friends/cancel` | `{accountId}` → `{ok: true}`（撤回我的待处理请求） | 404 `REQUEST_NOT_FOUND` |
| `POST /api/messenger/friends/remove` | `{accountId}` → `{ok: true}`（双方都失去好友关系） | 404 `FRIEND_NOT_FOUND` |
| `POST /api/messenger/friends/favorite` | `{accountId, favorite: bool}` → `{friend: Friend}` | 404 `FRIEND_NOT_FOUND` |
| `POST /api/messenger/outbox/clear` | `{}` → `{deleted: n}`（隐藏我已被同意/拒绝的请求卡片，待处理的保留） | |
| `POST /api/messenger/blocks/add` | `{accountId}` → `{block: Block}`（同时删除双方的好友关系与两个方向的请求，只保留我被拒绝（含过期自动拒绝）的那条请求：它从我的发件箱隐藏，到过期才删除，所以先屏蔽再解除不能绕过拒绝冷却；重复屏蔽返回原来的记录） | 404 `PLAYER_NOT_FOUND`，400 `CANNOT_BLOCK_SELF`，409 `BLOCK_LIMIT` |
| `POST /api/messenger/blocks/remove` | `{accountId}` → `{ok: true}` | 404 `BLOCK_NOT_FOUND` |
| `PUT /api/messenger/settings` | `Settings`（三个字段都必填）→ `Settings` | 400 `INVALID_REQUEST` |
| `GET /api/messenger/messages?with=<accountId>&before=<messageId?>&limit=<1..100，默认 30>` | → `{messages: Message[]（旧 → 新）, hasMore: bool}`，只含我的清除标记之后的消息 | 400 `INVALID_ACCOUNT_ID`（`with` 不是 UUID 或是自己），400 `INVALID_REQUEST`（`before`/`limit` 非法） |
| `POST /api/messenger/messages` | `{to, text, clientId(uuid)}` → `{message: Message, duplicate: bool}` | 403 `NOT_FRIENDS`，400 `INVALID_MESSAGE`，400 `INVALID_REQUEST_ID`，429 `CHAT_FLOOD`（响应体另含 `"mutedUntil": ms`） |
| `POST /api/messenger/read` | `{with, upTo: messageId}` → `{ok: true}`（设置 `lastReadId`，不后退、不超过最后一条，重新计算 `unread`） | |
| `POST /api/messenger/conversations/hide` | `{with}` → `{ok: true}`（原版“退出”：隐藏会话并为我清除到最后一条消息为止的记录；新消息会让它重新出现） | |

- 校验顺序：先会话（401），再 JSON（400 `INVALID_REQUEST`），再账号写限流。`accountId` 不是 UUID 时直接按“找不到”回答（`PLAYER_NOT_FOUND`/`REQUEST_NOT_FOUND`/`FRIEND_NOT_FOUND`/`BLOCK_NOT_FOUND`/`NOT_FRIENDS`），`read`/`hide` 则什么都不做。
- 好友请求的检查顺序：`PLAYER_NOT_FOUND`、`CANNOT_ADD_SELF`、`ALREADY_FRIENDS`、`BLOCKED_TARGET`、`FRIEND_REQUESTS_BLOCKED`（对方屏蔽了我，与对方的设置用同一个码，屏蔽因此不可见）；对方已有待处理请求时直接成为好友（只检查双方的好友上限，不看对方的“拒绝好友请求”设置）；否则依次 `REQUEST_PENDING`、`REQUEST_COOLDOWN`、`FRIEND_REQUESTS_BLOCKED`（对方设置）、`FRIEND_LIMIT`、`TARGET_FRIEND_LIMIT`、`REQUEST_LIMIT`（我未过期的待处理请求已有 30 个），然后保存（替换同一对账号旧的结果行）。自动拒绝（过期）与手动拒绝一样有冷却。
- 发送消息的检查顺序（HTTP 与 WebSocket 相同）：`clientId`（UUID，按小写保存；400 `INVALID_REQUEST_ID`）、文本（`INVALID_MESSAGE`）、刷屏限制（`CHAT_FLOOD`）、好友关系（`NOT_FRIENDS`）。同一账号重复使用 `clientId` 返回原消息与 `duplicate: true`，不再推送。写消息的一方视为已读到这条消息。
- 限流：好友请求每账号每小时 20 次（`rl:friend-request:{accountId}`，Redis 不可用时放行，找不到车手的尝试也计数）；所有写接口另计入账号写限流 `write:{accountId}`。刷屏：每账号 1 条/秒、突发 5 条，用完后禁言 10 秒（`CHAT_FLOOD` + `mutedUntil`，原版 chat_warn10secBlock“为防止刷屏，聊天禁止10秒”），HTTP 与 WebSocket 共用一个计数（在 hub 内存中）。
- 推送：请求 → 双方 `sync`，对方另收 `notice friend-request`；同意（含互相请求时的直接成为好友）→ 双方 `sync`，请求方另收 `notice friend-accepted`；拒绝 → 双方 `sync`，请求方另收 `notice friend-refused`；撤回、删除好友、屏蔽 → 双方 `sync`；收藏、清理卡片、取消屏蔽、设置、已读、隐藏会话 → 自己 `sync`；改名（`POST /multiplayer/auth/nickname`）→ 所有能看到该昵称的账号（好友、请求的另一方、屏蔽了他的人、会话对象）与自己 `sync`；设置隐身 → 好友收到 `presence`。

### 9.4 WebSocket `GET /api/messenger/ws`

- 不经过 `a.serve`（直接 `mux.Handle`，仍有 CORS、panic 恢复与 JSON 404/405），Origin 用 `netcfg.CheckWebSocketOrigin` 校验。不是升级请求 400 `INVALID_REQUEST`；连接数达到 `KART_MESSENGER_MAX_CONNECTIONS` 或正在关闭时升级前 503 `SERVER_BUSY`。只接受文本帧（二进制帧以 1003 关闭，非法 UTF-8 以 1007 关闭），单条上限 8 KiB（按解压后的大小）。
- 第一帧必须在 10 秒内到达：`{"type":"hello","token":"<会话 token>"}` → `{"type":"welcome","accountId","serverTime","state":State}`。token 缺失或无效、第一帧不是 hello、超时：`{"type":"error","code":"LOGIN_REQUIRED"}` 后以 4001 关闭。hello 时 MySQL/Redis 出错：`{"type":"error","code":"DATA_SERVICE_UNAVAILABLE"}` 后以 1011 关闭（客户端稍后重连）。`welcome` 一定是 hello 之后的第一帧（期间的推送排在它后面）。
- 关闭码：1001 服务关闭；1008 刷屏（每账号所有连接合计每秒 10 条命令、突发 30）或发送缓冲溢出（`KART_MESSENGER_SEND_BUFFER_BYTES`）；4001 会话结束（退出登录立即关闭该会话的所有连接；每 5 分钟用 `findAccount` 复查一次会话，过期或被删除时关闭）；4002 被替换（同一账号超过 4 个连接时关闭最早的一个）。服务端每 30 秒发协议 ping，读超时 90 秒，每帧写超时 5 秒。
- 客户端 → 服务端（`requestId` 为非空白且不超过 64 字符的字符串时原样带回）：
  - `{"type":"ping"}` → `{"type":"pong"}`。
  - `{"type":"send","to","text","clientId","requestId"?}` → `{"type":"sent","requestId"?,"message":Message,"duplicate":bool}`；收件人的所有连接与发件人的其他连接收到 `{"type":"message","message":Message}`。错误 `{"type":"error","code":"NOT_FRIENDS"|"INVALID_MESSAGE"|"INVALID_REQUEST_ID"|"CHAT_FLOOD","requestId"?,"mutedUntil"?}`。
  - `{"type":"read","with","upTo"}` → 不回复（已保存；读者的其他连接收到 `sync`）；`upTo` 不是整数时 `INVALID_REQUEST`。
  - 其他类型或无法解析：`{"type":"error","code":"INVALID_REQUEST"}`。
- 服务端推送：
  - `{"type":"presence","accountId","presence":Presence}`：发给该账号所有在线的好友，在值变化时：第一个连接 hello、最后一个连接断开 5 秒后、切换隐身、游戏节点占用或释放在线（内部接口 `PathPresenceClaim`/`PathPresenceRelease` 带 `AccountID` 时）、以及每 10 秒对游戏在线的核对（节点崩溃、`nodeLeave`、心跳冲突都不报告账号）。
  - `{"type":"message","message":Message}`。
  - `{"type":"sync"}`（见 9.1、9.3）。
  - `{"type":"notice","kind":"friend-request"|"friend-accepted"|"friend-refused","accountId","nickname"}`：发给受影响的账号（`accountId`/`nickname` 是另一方），另有 `sync`；用于托盘提醒与提示。

### 9.5 MySQL 表（schema v4）

```
messenger_settings(account_id PK FK, block_friend_requests, block_game_invites, invisible TINYINT, updated_at)
friendships(account_id FK, friend_id FK, favorite TINYINT, created_at, PK(account_id, friend_id), INDEX(friend_id))  -- 每一方一行
friend_requests(from_id FK, to_id FK, state 'pending'|'accepted'|'refused', created_at, resolved_at NULL,
                expires_at, sender_hidden TINYINT, PK(from_id, to_id), INDEX(to_id, state), INDEX(state, expires_at))
account_blocks(account_id FK, blocked_id FK, created_at, PK(account_id, blocked_id), INDEX(blocked_id))
private_messages(id BIGINT AUTO_INCREMENT PK, low_id FK, high_id FK, sender_id, client_id, body VARCHAR(120) utf8mb4_bin,
                 created_at, UNIQUE(sender_id, client_id), INDEX(low_id, high_id, id), INDEX(high_id), INDEX(created_at))
private_conversations(account_id FK, peer_id FK, last_message_id, last_message_at, last_read_id, unread INT,
                      cleared_up_to, hidden TINYINT, updated_at, PK(account_id, peer_id),
                      INDEX(account_id, hidden, last_message_at), INDEX(peer_id), INDEX(last_message_at))
```

- 所有账号列都是 `ON DELETE CASCADE` 外键（测试清理靠删除账号）。MySQL 不允许在带级联动作的外键列上加 CHECK（错误 3823），所以“不能是自己”和 `low_id < high_id` 由代码保证；`state IN (…)` 与 `unread >= 0` 有 CHECK。`private_messages.sender_id` 总是 `low_id` 或 `high_id` 之一，不另设外键；`body` 比接口允许的 30 码点宽，以后放宽限制不用迁移。
- `friend_requests`：`pending` 的 `expires_at` = 创建 + 7 天，到期自动拒绝（原版 autoRefuseStr）；`accepted`/`refused` 的 `resolved_at` 为处理时间，`expires_at` = 处理 + 7 天，到期删除（原版 autoDeleteStr）。`sender_hidden` 是发送者清理掉的卡片，行保留到 `expires_at`，因此拒绝的冷却（到下一个北京时间 06:00，原版 refuseConfirm）仍然有效。再次请求同一个人时替换旧的结果行。
- `private_conversations`：发消息时发件人的行 `last_read_id` 推进到这条消息、`unread` 清零，收件人的行 `unread + 1`，双方 `hidden` 清零；`read` 在行锁下按 `id > max(last_read_id, cleared_up_to)` 重新数未读；`hide` 把 `cleared_up_to` 与 `last_read_id` 设为最后一条消息。
- 事务：好友关系、请求与屏蔽的变更都在 READ COMMITTED + 死锁重试（`inEconomyTx`）中，先按账号 ID 升序用 `INSERT … ON DUPLICATE KEY UPDATE` 锁住双方的 `messenger_settings` 行（不存在时创建默认行），所以每个账号的这些变更串行执行，上限计数没有竞态；账号已被删除（外键失败）映射为 `PLAYER_NOT_FOUND`（或相应的“找不到”）。发消息先查 `clientId` 去重（在刷屏检查之前：断线后用 HTTP 重发同一条消息不消耗刷屏额度，也不会被 `CHAT_FLOOD` 拒绝），再用 `FOR SHARE` 读发件人一侧的好友行（并发的删除好友或屏蔽要等它提交，之后不会再有消息写入），插入消息后按账号 ID 升序更新两个会话行，双向同时发消息不会死锁。

### 9.6 hub（`internal/data/messenger`）

- 连接的读写模型照搬游戏节点 `internal/game/ws`（每连接一个读协程、一个写协程与按字节计的有界队列、令牌桶），但不导入 `internal/game`。hub 方法从不阻塞在连接上；调用 MySQL/Redis 时使用 hub 自己的 5 秒超时上下文，不使用升级请求的上下文。
- 状态：已连接账号（连接列表、好友集合、命令限流）与“对等方”（已连接账号本身及其好友：观察者集合、隐身、是否在游戏、最近推送的在线状态）。账号的第一个连接 hello 时加载好友列表（含好友的隐身设置）并向 Redis 查询本人和好友是否在游戏；好友关系变化（同意、删除、屏蔽）后重新加载双方的列表。每次加载与每个隐身/游戏在线读数都带序号，旧的读数不会覆盖新的。只有最新一次请求的加载能生效；每 10 秒的核对重试最新一次没有生效（失败）的好友列表加载，并清理闲置的刷屏计数。
- `presence-account` 的游戏在线用 `cache.Cluster.AccountsInGame`：`MGET presence-account:{id}`，再 `MGET node:{nodeId}` 确认节点仍在注册（与 `NameOnline` 相同的规则）。Redis 不可用时保留上次已知的游戏在线；新加载的视为不在游戏。
- 关闭：`server.go` 在关闭 HTTP 监听之前调用 `ShutdownMessenger`（`http.Server.Shutdown` 不跟踪已升级的连接），所有连接以 1001 关闭。

### 9.7 每小时清理

与过期会话一起，每步最多 10,000 行：过了 `expires_at` 的待处理请求改为 `refused`（`resolved_at = expires_at`，`expires_at` 再加 7 天）；过了 `expires_at` 的 `accepted`/`refused` 行删除；30 天前的私聊消息删除，最后一条消息在 30 天前的会话行也删除（它的消息已经全部过期）。清理不推送 `sync`：客户端按 `expiresAt` 自己隐藏过期的卡片，`state` 也按 9.2 的规则显示。
