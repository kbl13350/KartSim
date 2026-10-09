# KartSim Go 服务端设计（数据服务 + 多节点游戏服务）

本文是 Go 重写的权威约定。旧 Java 服务（`../server`）仅作行为参考，不再修改。账号经济（开放注册、取消游客、等级、三种货币、库存、商店、奖励、管理页面）的权威约定见 [`ECONOMY.md`](ECONOMY.md)，本文第 8 节是它与本架构的衔接。

## 1. 总体架构

```
浏览器 ──HTTP──► kart-data（单实例，公网口 :8787）──► MySQL（持久化）
   │                 ▲  内部口 :8790（仅内网）        └► Redis（缓存、在线名、节点注册）
   │                 │  X-Kart-Cluster-Key
   └──WebSocket──► kart-game ×N（:8788, :8789 …，房间状态在内存）
```

- **数据服务 kart-data**：只有一个。唯一访问 MySQL 与 Redis 的进程。提供原 Java 的全部 HTTP API（账号、档案、影子记录、历史），新增“游戏服列表”“入场票据”与账号经济接口，另开内部端口供游戏节点调用（心跳注册、在线昵称占用、装备归属核对、房间规则保存、赛后结算与奖励入账）。
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
  internal/data/...              数据服务实现
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

启动时：连接 MySQL（重试 30 秒）、在 `GET_LOCK('kartsim_schema')` 下执行建表/迁移、连接 Redis（重试）。Redis 不可用时**缓存降级**为直连 MySQL 并告警，但在线昵称与节点注册依赖 Redis，此时 ticket/presence 接口返回 503 `DATA_SERVICE_UNAVAILABLE`。

### 3.2 公网 HTTP API（与 Java 行为一致）

逐条对齐 `../server/src/main/java/local/kartsim/server/{HttpApi,Accounts,StorageApi,HistoryApi}.java` 及 `../server/README.md`：

| 路径 | 说明 |
| --- | --- |
| `GET /multiplayer/healthz` | `{"protocolVersion":39,"ruleset":"launcher-room-v1","transport":"websocket","service":"data","dataNode":…}` |
| `GET /multiplayer/auth/config` | 同 Java：`X-Forwarded-Host` 存在且可信 → `{"loginRequired":false,"backendOrigin":null}`；否则 Host 可信 → `http://<host>:<本地端口>`；`KART_PUBLIC_ORIGIN` 优先；不可信 400 `INVALID_HOST` |
| `POST /multiplayer/auth/guest-name` | `{"available": 名字合法 && 非账号昵称 && 不在任何游戏服在线}`；非法 400 `INVALID_GUEST_NAME` |
| `POST /multiplayer/auth/register` / `login` / `nickname` / `logout`，`GET /multiplayer/auth/me` | 同 Java（校验规则、错误码、PBKDF2-SHA256 120000 次 256 位、格式 `120000:base64盐:base64哈希`、43 字符 token、会话 30 天、sha256 base64url 存储），保证可直接迁移旧数据。账号经济带来的差异（ECONOMY.md 6）：`register` 按 `KART_REGISTRATION` 决定是否需要邀请码（`KART_ADMIN_USERNAMES` 中的用户名任何模式下都需要，否则 400 `INVALID_INVITE`），成功返回 `{account, token}`，密码 8–128 位，按 IP（IPv6 /64，另有 /56 维度）与全站限流 429 `TOO_MANY_ATTEMPTS`（全站额度只在字段、邀请码与重名预检通过后计数）；`login` 失败次数按（用户名、客户端网段 IPv4 /24 或 IPv6 /64）计数；`auth/config` 返回 `loginRequired:true`、`registration`、`guests` |
| `POST /multiplayer/admin/invites` | 同 Java |
| `GET /multiplayer/ice` | `{"iceServers":[]}` |
| `POST /multiplayer/offer` | 501 `{"error":"USE_LOCAL_WEBSOCKET"}` |
| `GET/PUT /api/profile/{ownerId}`，`GET /api/records/{ownerId}`，`GET/PUT /api/records/{ownerId}/{recordId}` | 同 Java（X-Profile-Key、403/404 语义、大小上限 1,000,000 / 4,000,000 字符、记录允许数组） |
| `GET /api/race-results?name=`、`GET /api/race-outcomes?gameplay=`、`GET /api/room-rules` | 同 Java（最近 100 条） |
| **新增** `GET /multiplayer/game-servers` | `contract.GameServerList`：存活节点，按 name 排序；`full = players >= capacity` |
| **新增** `POST /multiplayer/game-servers/ticket` | 请求 `contract.TicketRequest`；带 Bearer 则必须有效（否则 401 `LOGIN_REQUIRED`）且已领取新手礼包（否则 403 `ONBOARDING_REQUIRED`），签发账号票据（`Guest=false, AccountID, Username, Nickname, Admin`）；不带 Bearer 时只有 `KART_ALLOW_GUESTS=true` 才签发游客票据（`Guest=true`），否则 401 `LOGIN_REQUIRED`。节点不存在/已下线 404 `GAME_SERVER_NOT_FOUND`，已满 503 `GAME_SERVER_FULL`。响应 `contract.TicketResponse` |
| **新增** `GET /api/player-stats?name=<昵称>` | `{"nickname","races","wins","podiums","points","updatedAt"}`，不存在 404 `PLAYER_NOT_FOUND`（仅统计注册账号） |

错误体 `{"error":"CODE"}`；未知异常 500 `INTERNAL_ERROR`（记录日志）；JSON 解析失败 400 `INVALID_REQUEST`；请求体上限 8 MiB。所有公网路由套 `netcfg.CORS`。

### 3.3 内部 API（`contract` 包，监听 `KART_INTERNAL_LISTEN`）

全部 `POST`，必须带 `X-Kart-Cluster-Key`（`subtle.ConstantTimeCompare`），否则 401 `CLUSTER_KEY_INVALID`。

- `PathHeartbeat`：保存节点信息（Redis `node:{id}` JSON，TTL 15 秒；集合 `nodes`），并为 `Players` 中每个玩家续期在线昵称与账号键（值匹配才续期；键已过期则用 NX 重新占用；被其他会话占用的玩家列入 `Conflicts`，游戏节点断开它们）。更新 `node-players:{id}`（小写名集合）与 `node-accounts:{id}`（玩家 → 账号）；`node-epoch:{id}` 记录节点进程的启动时间，节点重启后先释放旧进程的占用。返回 `HeartbeatResponse`，其中 `expRate`/`lucciRate` 是数据服务的 `KART_EXP_RATE`/`KART_LUCCI_RATE`，游戏节点用它们换算显示的 `race.rewards`。
- `PathNodeLeave`：删除节点及其全部在线昵称与账号占用。
- `PathPresenceClaim`：Lua 原子操作。键 `presence:{lower(name)}`，值 `nodeId|playerId`，TTL 30 秒。键不存在 → 占用；值相同 → 续期成功；占用者节点已不存在（`node:{id}` 缺失）→ 抢占；否则 409 `NICKNAME_TAKEN`。带 `AccountID` 时同一脚本还占用账号键 `presence-account:{accountId}`（同样的值、TTL 与接管规则，先于昵称检查，两者都能占用才写入）：被其他在线会话占用时 409 `ACCOUNT_ONLINE`，因此一个账号全集群同时只有一个会话。`Guest=true` 时先验证名字（同 Java validName，最多 18 码点）→ 400 `INVALID_GUEST_NAME`，并且不得与账号昵称（不区分大小写）相同 → 409 `NICKNAME_TAKEN`。
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

schema v2 另有账号经济表 `account_progress`、`wallets`、`wallet_ledger`、`exp_ledger`、`inventory_items`、`purchases`、`account_onboarding`、`account_profiles`、`timeattack_bests`、`timeattack_runs`、`daily_rewards`；schema v3 加 `admin_grants`（管理员发放的 `requestId` 绑定账号、货币与数额）与 `timeattack_state`（每账号最近一次计时赛结算，用于节奏限制与重试），结构与约束见 ECONOMY.md 5。`timeattack_runs` 与 `daily_rewards` 保留 30 天，由每小时的清理任务（与过期会话清理一起）删除。

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
| `node:{id}` / `nodes` / `node-players:{id}` / `node-accounts:{id}` / `node-epoch:{id}` | 游戏节点注册 | 15 秒 / — / 60 秒 / 60 秒 / 60 秒 |
| `presence:{lower(name)}` | `nodeId\|playerId` | 30 秒 |
| `presence-account:{accountId}` | `nodeId\|playerId`（一个账号一个在线会话） | 30 秒 |
| `rl:{key}` | 限流计数（`register-ip:{IP，IPv6 为 /64}` 每小时 5 次、`register-site:{IPv6 /56}` 每小时 10 次、`register-all` 每分钟 60 次（预检通过后才计数）、`login-ip:{IP，IPv6 为 /64}` 每 5 分钟 20 次、`login-fail:{用户名}\|{IPv4 /24 或 IPv6 /64}` 每 15 分钟 10 次失败、`write:{accountId}` 每分钟 300 次）；注册在 Redis 不可用时拒绝（503），其余放行 | 窗口长度 |

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
- WebSocket 层：每连接一个读协程（顺序处理请求，等同 Spring 的逐条回调）和一个写协程（有界队列；队列满或写超时 5 秒则关闭连接，对应 `ConcurrentWebSocketSessionDecorator`）。文本消息上限 64 KiB；二进制运动帧按 Java `relayMotion` 校验后中继。请求带合法 `requestId`（字符串、非空白、≤64）时回复原样带回；无 `requestId` 的成功请求不回复；错误总是回复 `{"type":"error","code":…,"requestId"?}`。JSON 解析失败回复 `INVALID_REQUEST`。读超时 90 秒（客户端每 10 秒 `clock`），服务端每 30 秒发 ping。
- `hello` 改动（票据；账号经济另加的 `LOGIN_REQUIRED`、`ITEM_NOT_OWNED` 与 `race.rewards` 见下文与第 8 节）：版本/规则/资源版本/名字校验顺序同 Java，然后必须有 `ticket`（字符串）：缺失 401 `TICKET_REQUIRED`；签名/格式错 401 `TICKET_INVALID`；过期 401 `TICKET_EXPIRED`；`NodeID` 不是本节点 403 `TICKET_WRONG_NODE`；`DataNode` 不符 403 `DATA_NODE_MISMATCH`；nonce 已用 401 `TICKET_REUSED`（本节点在过期前记住 nonce）。游客用请求中的 `name`；账号用票据中的 `Nickname`（忽略请求 name）。随后本节点内名字不区分大小写去重（同 Java，409 `NICKNAME_TAKEN`），再检查本节点没有该账号的其他会话（409 `ACCOUNT_ONLINE`；同一账号在同一节点重复进入时昵称相同，通常先得到 `NICKNAME_TAKEN`），核对装备后调用数据服务 `PresenceClaim` 占用昵称与账号（网络调用期间**不得**持有全局锁；跨节点的重复进入由它返回 409 `ACCOUNT_ONLINE`）；数据服务不可达 503 `DATA_SERVICE_UNAVAILABLE`。成功后 `welcome` 与 Java 相同。旧字段 `token` 忽略。
- 断开：释放房间（同 Java `disconnect`），异步 `PresenceRelease`。
- 成员记录 `accountId`（游客为空），结算时随结果上报。
- 账号经济（ECONOMY.md 2.1、6，见第 8 节）：未开启游客时游客票据的 `hello` 返回 401 `LOGIN_REQUIRED`（在票据校验之后）；`hello`/`create`/`join`/`equipment` 携带的装备由连接协程在不持有大厅锁时调用 `PathEquipmentVerify`（命令先在锁内跑到 Java 应用装备处，必然失败的命令不核对；核对后重新执行命令）：不拥有时 `hello` 返回 403 `ITEM_NOT_OWNED`（不占用昵称、不消耗房间状态；浏览器重读库存、换回新手装备后用新票据重试），`create`/`join`/`equipment` 在 Java 应用装备处返回 403 `ITEM_NOT_OWNED`，数据服务不可达 503 `DATA_SERVICE_UNAVAILABLE`。`ready`（准备时）核对发送者自己的装备，`start` 重新核对缓存已过期的所有成员，不拥有者被取消准备、开赛失败（403 `ITEM_NOT_OWNED`）；`start` 时房间里同一账号有两个座位则 409 `ACCOUNT_ONLINE`。会话缓存：肯定结果到 min(`validUntil`, 核对后 10 分钟)，否定结果 10 秒；每连接需要核对的命令 2 次/秒（突发 10，超出 429 `RATE_LIMITED`），全节点最多 32 个并发核对（超出 503 `DATA_SERVICE_UNAVAILABLE`，不排队）。`finalizeRace` 用 `internal/shared/rewards` 计算每位载入车手的基础奖励写进 `RaceSettlement.Rewards`，并带上显示用的倍率 `ExpRate`/`LucciRate`；快照 `race.rewards`（Java 字段之后）显示乘以数据服务倍率后的数值（`rewards.ApplyRate`，倍率取自最近一次心跳响应的 `expRate`/`lucciRate`，与入账算法相同）。只影响奖励的防刷规则（ECONOMY.md 2.1）：游戏节点记录每个 `finish` 到达的服务器时间，服务器观察到的比赛时长 ≥ 10 秒且客户端 `elapsedMs` 不比它短 3 秒以上才按完赛计奖；挡人模式开跑 10 秒内结束时所有人按未完赛，中途离开者无奖励；组队平局双方都无胜方加成。
- 持久化：Java 中 `saveRules` / `saveResults` 改为生成 `contract.RoomRulesRequest` / `contract.RaceSettlement`（在锁内序列化快照）并写入发件箱，**不在锁内做网络或磁盘慢操作以外的阻塞**（发件箱写文件可在锁内完成，或交给有序队列，但必须保证顺序）。
- 心跳：每 5 秒 `PathHeartbeat`（在线玩家、房间数、容量、origin）。启动时立即注册一次。
- 关闭（SIGINT/SIGTERM）：停止接收新连接，向所有连接发送关闭帧 1001，`PathNodeLeave`，发件箱最多冲刷 5 秒；未发出的保留在磁盘，下次启动补发。

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

另外：每连接文本消息读上限 64 KiB；未 hello 连接不得创建房间；聊天保持最近 32 条；票据 nonce 记录随过期清理；发件箱只在磁盘，内存中不积压。心跳上报 `players`/`rooms` 让数据服务列表显示负载，满员节点 `full=true`。`/multiplayer/healthz` 增加 `connections`、`players`、`rooms`、`heapMB` 字段便于监控。

## 5. 前端（rewrite/）

- `backendOrigin` 的含义变为**数据服务**（账号、档案、历史、游戏服列表、票据都走它），配置格式不变。
- 新模块 `src/multiplayer/game-servers.ts`：解析/校验 `GameServerList` 与 `TicketResponse`；`origin` 为 null → 使用 backendOrigin（同源代理）；HTTPS 页面要求 HTTPS 游戏服；记住上次选择（localStorage `kartsim.multiplayer.game-server`，读写需 try/catch）。
- 选服对话框：存在多个可用服时显示（名称、在线人数/容量、满员不可选，默认选中上次的服）；只有一个可用服时自动进入；没有可用服时报错“暂无可用的游戏服务器”。
- 进入大厅：昵称确定后先选服；每次连接尝试（包括昵称冲突重试）都重新申请票据，然后连接 `<游戏服 origin>/multiplayer/offer`（`websocketUrlForOffer` 会改成 `/multiplayer/ws`），`hello` 发送 `ticket`，不再把会话 token 发给游戏服。
- 先确认 `src/generated/*.js` 是否由 `tools/generate-modules.mjs` 从其他源文件生成：如是，修改真正的源并重新生成，而不是只改生成物。
- `vite.config.ts` 开发代理：`^/multiplayer/ws` → 游戏服（`KART_LAN_GAME_BACKEND`，默认 `http://127.0.0.1:8788`，`ws: true`），其他 `^/multiplayer/` 与 `^/api/` → 数据服务（`KART_LAN_BACKEND`）。
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
- **商店与管理**：商店目录、等级表与计时赛赛道表来自 `internal/data/economy`（`rewrite/tools/export-economy-data.mjs` 生成，`--check` 校验），购买以 `requestId` 幂等，并可带 `expectedPrice`/`expectedCurrency`（与当前报价不符 409 `PRICE_CHANGED`）；管理页面 `GET /multiplayer/admin` 调用 `/api/admin/accounts` 与 `/api/admin/grant`（写流水，余额不为负；`requestId` 绑定账号、货币与数额，参数不同 409 `REQUEST_ID_CONFLICT`）。
- **测试**：`test/economy-smoke.mjs` 覆盖以上流程并直接核对 MySQL 流水与余额一致（运行方式见 README“测试”）。
