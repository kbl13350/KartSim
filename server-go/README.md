# KartSim Go 服务端

这是 KartSim 的服务端，用 Go 重写自 [`../server`](../server) 中的 Java 版（Java 版保留为行为参考，不再修改）。它拆成两种进程：

- **数据服务 `kart-data`**：只有一个。唯一访问 MySQL 与 Redis 的进程，提供账号、账号经济（等级、钱包、库存、商店、奖励入账、管理页面）、好友与私聊、档案、影子记录、历史、游戏服列表与入场票据等 HTTP API（好友私聊另有一个 WebSocket），并另开一个只供游戏节点使用的内部端口。
- **游戏服务 `kart-game`**：可以部署任意多个。没有数据库，房间状态在各自内存中；同一房间的玩家都连在同一个节点上，比赛时钟、广播与运动帧中继都在单进程内完成。

玩家必须登录：默认开放注册、没有游客模式；新账号领取新手礼包后才能进入联机。账号经济见下文[“账号经济”](#账号经济)。权威设计约定见 [`DESIGN.md`](DESIGN.md) 与 [`ECONOMY.md`](ECONOMY.md)；浏览器协议见仓库根的 [`SERVER_PROTOCOL.md`](../SERVER_PROTOCOL.md)。

## 架构

```
                      公网 / 局域网                                  私有网络
 ┌─────────┐  HTTP(S)  ┌──────────────────────────┐           ┌────────────────┐
 │ 浏览器   │─────────►│ kart-data  公网口 :8787    │──────────►│ MySQL 8.4      │ 账号、钱包、库存、流水、
 │ (前端)   │           │  账号/经济/档案/历史/游戏服 │           │ (唯一持久化)   │ 档案、记录、赛果、统计
 │         │           │  入场票据（HMAC 签名）      │           └────────────────┘
 │         │           │ 内部口 :8790（只给游戏节点） │──────────►┌────────────────┐
 │         │           └──────────▲───────────────┘           │ Redis 7        │ 缓存、在线昵称、
 │         │                      │ X-Kart-Cluster-Key          │ (可重建)       │ 游戏节点注册
 │         │                      │ 心跳 / 昵称占用 / 规则 / 结算  └────────────────┘
 │         │  WebSocket ┌─────────┴──────────┐
 │         │──────────►│ kart-game  :8788     │  房间在内存；结算先写本地发件箱（outbox）
 │         │  (ws/wss)  ├────────────────────┤
 │         │──────────►│ kart-game  :8789 …   │
 └─────────┘           └────────────────────┘
```

- 浏览器只把会话 token 发给数据服务；游戏节点永远看不到 token，只验证数据服务签发的票据。
- 好友与私聊（见下文[“好友与私聊”](#好友与私聊)）也在数据服务：HTTP 接口加一个 WebSocket `/api/messenger/ws`（在线状态、消息与同步提示的推送），消息存在 MySQL。
- 游戏节点每 5 秒向数据服务发心跳（在线玩家及其所在房间与账号、房间数、容量、公布的 origin，以及内存、协程、连接数等负载数字），数据服务据此生成游戏服列表与管理后台的节点、在线玩家页；节点 15 秒没有心跳就从游戏服列表消失，管理后台再把它作为“离线”列出 24 小时。
- 比赛结束和房间规则变化后，游戏节点把记录写入本地发件箱，再按顺序投递到数据服务；数据服务暂时不可用时记录不会丢，恢复后自动补发。
- 比赛奖励：游戏节点在结束快照里给出 `race.rewards`（经验、金币），结算经发件箱送达后由数据服务在同一事务内入账（按 `raceId` + 账号幂等）。余额、库存与等级只以数据服务为准，浏览器和游戏节点都不可信。

## 入场流程（游戏服列表与票据）

1. 浏览器 `GET <数据服务>/multiplayer/game-servers`，得到在线游戏服列表（按名称排序）。只有一个可用服时自动进入，否则让玩家选择；想一起玩的人要选同一个服。
2. 浏览器 `POST <数据服务>/multiplayer/game-servers/ticket`，请求体 `{"nodeId":"game-1"}`，带 `Authorization: Bearer <会话 token>`。默认没有游客（`KART_ALLOW_GUESTS=false`）：不带 Bearer 401 `LOGIN_REQUIRED`；账号还没领取新手礼包 403 `ONBOARDING_REQUIRED`。数据服务签发一次性票据：
   `kt1.` + base64url(JSON 声明) + `.` + base64url(HMAC-SHA256(KART_CLUSTER_SECRET, "kt1." + 载荷))。
   声明含目标节点 `node`、数据节点 `data`、随机 `nonce`、签发/过期时间（有效期 2 分钟）、游客标记 `guest`，账号票据另含账号 ID、用户名、昵称与管理员标记。
3. 浏览器先用 WebRTC 连接：`POST <游戏服 origin>/multiplayer/offer` 交换 SDP，打开两个数据通道（`control` 有序可靠，承载 JSON 命令与事件；`motion` 无序、不重传，承载二进制运动帧）；8 秒内打不开（UDP 不通、节点关闭了 WebRTC 返回 501 `USE_WEBSOCKET`、经数据服务同源代理）就改连 `<游戏服 origin>/multiplayer/ws`（origin 为 `null` 时用数据服务的 origin，即同源代理）。两种连接的协议相同，见下文“WebRTC 传输”。`hello` 中带上 `ticket` 与当前装备（WebRTC 失败时票据还没用过，WebSocket 用同一张）。游戏节点本地验签，依次检查过期、节点、数据节点与 nonce 未用过；游客票据在 `KART_ALLOW_GUESTS=false` 时被拒绝（`LOGIN_REQUIRED`）；账号使用票据中的昵称。随后在本节点内去重昵称与账号（一个账号同时只能有一个会话），在锁外向数据服务核对装备归属（不拥有时 403 `ITEM_NOT_OWNED`，浏览器重读库存、换回新手装备后用新票据重试），再请求数据服务在全集群占用该昵称与账号。
4. **每次连接尝试都要重新申请票据**（包括昵称冲突后的重试），票据用过一次即作废。

`hello` 失败时回复 `{"type":"error","requestId":…,"code":…}`，与票据和入场相关的错误码（按检查顺序）：

| 错误码 | 含义 |
| --- | --- |
| `TICKET_REQUIRED` | 没有 `ticket` 字段 |
| `TICKET_INVALID` | 格式或签名错误 |
| `TICKET_EXPIRED` | 已过期（签发 2 分钟后） |
| `TICKET_WRONG_NODE` | 票据是签给另一个游戏节点的 |
| `DATA_NODE_MISMATCH` | 票据来自另一个数据服务（`KART_DATA_NODE_ID` 不一致） |
| `TICKET_REUSED` | 票据已经用过 |
| `LOGIN_REQUIRED` | 游客票据，而游戏节点未开启 `KART_ALLOW_GUESTS` |
| `NICKNAME_TAKEN` | 昵称已在本节点或其他游戏服在线，或游客想用账号昵称。同一账号在**同一节点**重复进入时通常先得到它（昵称检查在账号检查之前） |
| `ACCOUNT_ONLINE` | 该账号已有在线会话：本节点发现（例如改名后再次进入），或数据服务占用账号键时发现它在其他节点在线（同一账号**跨节点**重复进入得到的是它） |
| `ITEM_NOT_OWNED` | `hello` 携带的装备含账号不拥有或已过期的物品（403），不占用昵称；浏览器换回新手装备后用新票据重试 |
| `DATA_SERVICE_UNAVAILABLE` | 游戏节点联系不上数据服务，无法核对装备或占用昵称与账号；或本节点同时进行的装备核对已达 32 个 |
| `SERVER_FULL` | 本节点已达 `KART_MAX_PLAYERS` |
| `SERVER_BUSY` | 本节点内存接近 `KART_MEMORY_LIMIT_MB`，暂不接收新玩家 |

`SERVER_FULL`、`SERVER_BUSY` 在校验票据之前返回，不会消耗票据。房间内命令另有 `ROOM_LIMIT_REACHED`（503，本节点房间数已达 `KART_MAX_ROOMS`，`create` 被拒绝）、`ITEM_NOT_OWNED`（`create`/`join`/`equipment` 携带的装备含账号不拥有或已过期的物品，命令不生效；`ready` 与 `start` 重新核对时同样返回，见“新账号进入联机的流程”）、`ACCOUNT_ONLINE`（`start` 时房间里有同一账号的两个座位）与 429 `RATE_LIMITED`（本连接命令过于频繁，见“限流与反向代理”）。

## 账号经济

完整约定见 [`ECONOMY.md`](ECONOMY.md)；这里是运维与接入需要知道的部分。

| 项 | 行为 |
| --- | --- |
| 注册 | `KART_REGISTRATION=open`（默认，填用户名、昵称、密码即可，成功直接返回会话 token）、`invite`（需要管理员生成的邀请码，与 Java 版相同）、`closed`（只能登录已有账号，注册 403 `REGISTRATION_CLOSED`）。密码 8–128 位。按客户端 IP 限流（见下文“限流与反向代理”） |
| 游客 | 默认取消（`KART_ALLOW_GUESTS=false`，数据服务与游戏节点都读取）：不带 Bearer 的票据请求 401 `LOGIN_REQUIRED`，游客票据的 `hello` 也被拒绝 |
| 新手礼包 | 注册后 `onboarded=false`，必须先 `POST /api/account/starter` 领取：练习车（category 3、itemId 0、`systemKey` `practiceKart`）+ 角色皮蛋(2)/黑妞(3) 二选一 + 喷漆、染色各从 6/4/5/7 中选一，全部永久；领取前票据 403 `ONBOARDING_REQUIRED`。重复领取不再发放（幂等） |
| 等级 | 原版 `leveltable@cn.xml` 127 级，经验叫 `exp`；升级逐级发放金币 `100×等级`、原版 K币表、每 10 级 50 点券 |
| 货币 | 点券 `coupon`、金币 `lucci`、K币 `koin`；新账号送 `KART_STARTING_LUCCI`（默认 10000）金币；余额永不为负，每笔变动写 `wallet_ledger` 流水 |
| 库存 | 车库能装备的物品按（分类、itemId、systemKey）记录；限时物品带 `expiresAt`，过期后不再返回，已装备的过期物品自动换回练习车/新手角色/新手颜色/卸下 |
| 商店 | 6,032 件可装备物品，加上道具赛的道具变更卡使用券、道具换位卡使用券（原版卡片价 1/7/30 天 10/45/140 点券，ECONOMY.md 3.2），按原版货币与期限标价（原版没有价格的按分类估价）；`requestId` 保证购买幂等；请求可带商店显示的 `expectedPrice`/`expectedCurrency`，与当前报价不符时 409 `PRICE_CHANGED`、不扣款；已拥有永久物品 409 `ALREADY_OWNED`；限时物品续期从原到期时间顺延 |
| 奖励 | 联机比赛：游戏节点按 ECONOMY.md 2.1 计算基础值发给数据服务，数据服务入账时乘 `KART_EXP_RATE`/`KART_LUCCI_RATE`（快照 `race.rewards` 显示的是同样乘过倍率的值，倍率由心跳响应告诉游戏节点，结算也带上显示时用的倍率），并按**数据服务收到结算时**的北京时间自然日套每日上限（经验 20,000、金币 30,000）；完成时间早于 24 小时前的结算只保存赛果、不发奖励。只有服务器观察到的比赛时长 ≥ 10 秒且客户端成绩不比它短 3 秒以上的完赛才按完赛计奖。计时赛：`POST /api/timeattack/settle`，每次经验 10/金币 20，刷新个人最佳再加 20/50，成绩小于 10 秒无效，赛道须在导出的赛道表中，两次结算至少间隔 10 秒且不短于本次成绩 − 3 秒，每日 50 次有奖励 |
| 管理员 | `KART_ADMIN_USERNAMES` 中的账号（不写入数据库，移出名单即失去权限），以及数据库中原有 `admin=1` 的账号。开放注册下首个注册者**不再**自动成为管理员（`invite` 模式仍按 Java 版：首个账号是管理员）。名单中尚未注册的用户名在任何模式下都必须带有效邀请码注册（否则 400 `INVALID_INVITE`），以免被他人抢注成管理员；数据服务启动时为每个这样的用户名记录错误日志，并确保有一个引导邀请码可用、打印到日志（`KART_BOOTSTRAP_INVITE`，未设置或已被使用时随机生成） |

### 新账号进入联机的流程

1. `POST /multiplayer/auth/register {username, nickname, password}` → `{account, token}`（`invite` 模式另带 `invite`）。
2. `GET /api/account` → `onboarded:false`；前端显示新车手对话框。
3. `POST /api/account/starter {character, paint, dye}` → 账号摘要（`onboarded:true`），同时把新手装备写进账号档案。
4. `GET /api/inventory`、`GET/PUT /api/account/profile`：装备只能使用库存中未过期的物品（`PUT` 不拥有时 409 `ITEM_NOT_OWNED`）。
5. 选服 → `POST /multiplayer/game-servers/ticket`（Bearer）→ `hello {ticket, equipment}`。游戏节点在 `hello`、`create`、`join`、`equipment` 携带装备时调用内部接口 `/internal/v1/equipment/verify` 核对归属（在连接协程内、不持有大厅锁；命令本身必然失败时不核对）：不拥有时 `hello`、`create`、`join`、`equipment` 都返回 403 `ITEM_NOT_OWNED`（`hello` 被拒后浏览器重读库存、把过期或不拥有的装备换回新手装备，再用新票据重试一次）；数据服务不可达时返回 `DATA_SERVICE_UNAVAILABLE`。每个会话缓存核对结果：肯定结果用到 min(`validUntil`（租用物品最早到期时间）, 核对后 10 分钟)，否定结果 10 秒。`ready` 核对发送者自己的装备，`start` 重新核对缓存已过期的所有成员：不拥有者被取消准备，命令返回 403 `ITEM_NOT_OWNED`。需要核对的命令每个连接每秒 2 次（突发 10，超出 429 `RATE_LIMITED`），全节点同时最多 32 个核对（超出 503 `DATA_SERVICE_UNAVAILABLE`）。只核对商店出售的分类与系统车（槽位 3 为 0 时按 `systemKart` 核对，如 `practiceKart`），其他槽位（改装部件、涂装、43–46、68/69、76–78 等车库免费物品）不核对。

### 奖励入账流程

1. 比赛结束（`finalizeRace`）时游戏节点计算每位已载入车手的经验与金币，快照 `race.rewards = {playerId: {exp, lucci}}`（所有玩法都有，挡人模式按 ECONOMY.md 2.1 的规则折算名次），客户端立即显示。显示值已乘数据服务的倍率：数据服务在每次心跳响应中返回 `expRate`/`lucciRate`，游戏节点用与入账相同的 `rewards.ApplyRate` 换算，所以显示值就是入账值（每日上限截断的部分除外）。防刷规则只影响奖励（`race.results` 与 Java 一致）：只有服务器观察到的比赛时长（`finish` 到达时间 − `startAt`）≥ 10 秒、且客户端上报的 `elapsedMs` 不比它短 3 秒以上的完赛才按完赛计奖，否则按未完赛；一个账号一局只计一份；挡人模式在开跑 10 秒内结束时所有人按未完赛，中途离开的车手没有奖励（名次赛中完赛后才离开的照常发放）；组队平局时双方都没有胜方加成。
2. 结算 `RaceSettlement.Rewards`（`[{playerId, accountId, exp, lucci}]`，倍率前的基础值）与显示时用的倍率 `expRate`/`lucciRate` 随赛果写入发件箱，按序投递到 `/internal/v1/races`。
3. 数据服务在保存赛果的同一事务内为有 `accountId` 的车手入账：乘倍率（采用结算携带的倍率，须在 [0, max(10, 当前配置)] 内，否则用当前配置）、按数据服务收到结算时的北京时间自然日套每日上限、逐级发放升级奖励，写 `exp_ledger`/`wallet_ledger`（原因 `race`，引用 `raceId`）。超过公式最大值（经验 145、金币 216，倍率前）的条目丢弃并记录警告；完成时间早于 24 小时前的结算只保存赛果、不发奖励。同一 `raceId` 重复投递返回 `{"stored":true,"duplicate":true}`，不会重复入账；数据服务短时停机期间的比赛在恢复后补记。
4. `GET /api/account` 反映入账后的经验、等级、余额与战绩。

### 管理页面与发放货币

管理后台是数据服务提供的单页应用 `<数据服务 origin>/multiplayer/admin`（本机默认 <http://127.0.0.1:8787/multiplayer/admin>，`run-lan.sh` 下也可经前端代理访问 `https://<IP>:8780/multiplayer/admin`；启动脚本会打印地址）。它用 Vue 3 + Element Plus 写在 [`admin-ui/`](admin-ui)，`npm run build` 的产物提交在 `internal/data/api/adminui/` 并嵌入 kart-data（`go build` 不需要 Node，但产物必须存在才能编译；改了 `admin-ui/` 后重新构建并提交产物）。用 `KART_ADMIN_USERNAMES` 中的账号登录（token 只保存在页面内存中），可以查看概览统计、搜索与编辑账号（昵称、管理员、封禁、重置密码）、踢下线、查看账号的游戏数据（战绩、驾照、计时赛、任务、好友、俱乐部）、登录记录、在线玩家、游戏节点（含 24 小时内离线的节点）与数据服务状态、货币流水、发放记录、比赛、购买、抽奖与开箱记录、俱乐部及其成员、邀请码与奖励箱记录，给账号增加或扣除点券、金币、K币或经验并填写备注。`KART_ADMIN_USERNAMES` 中的账号只能由自己修改，其他管理员编辑或踢它们得到 409 `PROTECTED_ADMIN`。所有发放都写流水（原因 `admin`），余额与经验不会被扣成负数。管理页面还可以设置抽奖活动、向玩家的奖励箱赠送道具或货币、发布迷你提示窗公告（见 [`MENUS.md`](MENUS.md)）。接口与返回字段见 [`ADMIN.md`](ADMIN.md)。

注册与每次成功登录都记录时间、客户端 IP（按“限流与反向代理”的可信代理规则取得）与浏览器 UA（`login_records`，保留 180 天）；游戏会记住令牌 30 天，所以每个账号每个北京日第一次用记住的令牌活动（当天没有注册或登录）时另记一条“自动登录”（`resume`），概览的“今日登录人数”包括它们。带令牌的成功请求还会更新账号的最后活跃时间与 IP（每个账号最多每 5 分钟写一次）。封禁的账号（封禁到期前）登录时，在密码正确之后返回 403 `ACCOUNT_BANNED`（另带 `until`、`reason`）；封禁、重置密码与踢下线都会作废该账号的所有会话（旧 token 得到 401 `LOGIN_REQUIRED`）、关闭好友聊天与小屋连接，并让游戏服在下一次心跳时断开它。

1. 指定管理员（顺序很重要）：先设置名单再启动，`KART_ADMIN_USERNAMES=alice ./run-full-local.sh`（compose 写在 `.env`）。`alice` 已有账号时直接生效；尚未注册时，kart-data 日志会报错并打印引导邀请码（`grep -i invitation`，也可预先设置 `KART_BOOTSTRAP_INVITE`），名单中的用户名只能用邀请码注册（任何模式下都是，否则 400 `INVALID_INVITE`，防止抢注）。在游戏登录界面注册时，开放注册下点“有邀请码？”展开可选的邀请码栏填入（`invite` 模式下邀请码栏直接显示）；也可以用接口注册：
   ```sh
   read -rs -p '管理员密码：' KART_ADMIN_PASSWORD; echo
   curl -fsS http://127.0.0.1:8787/multiplayer/auth/register -H 'Content-Type: application/json' \
     -d "{\"username\":\"alice\",\"nickname\":\"Alice\",\"password\":\"$KART_ADMIN_PASSWORD\",\"invite\":\"<日志中的邀请码>\"}"
   ```
2. 打开管理页面登录 → 用户管理里搜索玩家 → 赠送：选择货币、填写数量（负数为扣除）和备注 → 发放。
3. 也可以直接调用接口（`requestId` 可选，UUID；它与“管理员、账号、货币、数额”绑定：相同参数重复提交只生效一次并返回 `duplicate:true`，换了账号、货币或数额 409 `REQUEST_ID_CONFLICT`）：
   ```sh
   read -rs -p '管理员密码：' KART_ADMIN_PASSWORD; echo
   TOKEN=$(curl -fsS http://127.0.0.1:8787/multiplayer/auth/login -H 'Content-Type: application/json' \
     -d "{\"username\":\"alice\",\"password\":\"$KART_ADMIN_PASSWORD\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')
   curl -fsS http://127.0.0.1:8787/api/admin/grant -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"username":"bob","currency":"coupon","amount":500,"note":"活动奖励"}'
   curl -fsS "http://127.0.0.1:8787/api/admin/accounts?q=bob" -H "Authorization: Bearer $TOKEN"
   ```
   `currency` 为 `coupon`、`lucci`、`koin` 或 `exp`；`amount` 为非 0 整数（绝对值不超过 10 亿）；`note` 必填（≤ 200 字）。响应含实际变动 `applied`、升级奖励 `levelUps`、`duplicate`、`requestId` 与账号概况（ADMIN.md 的 `AccountRow` 加上 `wallet`）。错误：403 `ADMIN_REQUIRED`、404 `ACCOUNT_NOT_FOUND`、400 `INVALID_GRANT`/`INVALID_NOTE`/`INVALID_REQUEST_ID`、409 `INSUFFICIENT_FUNDS`/`INSUFFICIENT_EXP`/`BALANCE_LIMIT`（余额将超过 10^12）/`REQUEST_ID_CONFLICT`。

### 经济数据（商店目录与等级表）

`internal/data/economy/catalog.json`、`levels.json` 与计时赛赛道表 `tracks.json`（368 条，`POST /api/timeattack/settle` 只接受其中的 `trackId`）由导出工具从 `mirror/p3553` 的原版资源生成，并以 `go:embed` 编入 kart-data，**不要手改**：

```sh
cd rewrite
node --import tsx tools/export-economy-data.mjs            # 重新生成三个 JSON
node --import tsx tools/export-economy-data.mjs --check    # 提交的 JSON 过期时退出码 1（适合 CI）
node --import tsx tools/export-economy-data.mjs --out DIR  # 写到其他目录比较
```

工具直接运行浏览器的资源库与 `loadTimeAttackGarageCatalog`，保证商店与车库目录一致（赛道表取自 `timeAttackTrackCatalog()`）。三个文件都带内容 SHA-256 版本号；目录版本就是 `GET /api/shop/catalog` 的 `ETag`。重新生成后要重新构建并重启 kart-data（`go test ./internal/data/economy` 会校验版本号与内容一致）。

### 道具赛数据（概率表与道具赛道）

游戏节点运行道具赛（道具个人赛 / 组队道具赛，规则见 [`../rewrite/ITEM_MODE.md`](../rewrite/ITEM_MODE.md)，协议见 [`../SERVER_PROTOCOL.md`](../SERVER_PROTOCOL.md)“本地新增：道具赛”）所需的数据 `internal/game/itemmode/itemmode.json` 同样由导出工具从 `mirror/p3553` 生成并 `go:embed` 编入 kart-game，**不要手改**：个人 `item/slot/itemProb_indi@zz.bml`（14 种）与组队 `itemProb_team2@cn.bml`（19 种）的 top/high/mid/low 权重、`zeta_/cn/content/itemGameRestrictionItemCount.xml` 的获得上限（道具锁、天使、闪电每局 2 次，加速器不限）、这 19 种道具 `item.bml` 第一组状态的时长（毫秒）、道具房间可选的 187 条赛道（158 条道具图含 5 条道具专用图，加 29 条反向；与浏览器道具房间的选图目录完全一致，每条都有道具箱）、随机码 3–7/0/8/30 对应的道具随机池，以及默认赛道（道具 hot1 第一条）。

第 3 阶段（`ITEM_MODE.md` 附录 C）的数据也在同一个文件里，同样从原版读取：变更卡重抽表 `itemProb_indiChanger@zz` / `itemProb_teamChanger2@cn`；按车辆的获得表 `item/slot/transformByKart`、`fired2Gain`、`firing2Gain`、`animalBooster`（基础文件加 `@cn` 按行覆盖，去掉 bossOnly、夺旗赛与取消为 0/-1 的行；577/179/63/138 行）；全局变换 `transform@zz` 与每条道具赛道的 `track@zz` 等级（没写的按 0）；49 种特殊道具（idx、`item.rho` 文件夹与变体 base，以及该变体各状态的时长，导出时逐个核对 `item.bml`、`item/slot/item<idx>.png` 与 `itemDescList`）；`etc_/itemTable.kml` 叠加 `itemTable@cn.xml` 后的道具赛特性（车、宠物、角色、气球、头饰；取第一个数，-1 当 0）；`enchantCatalog.xml` 各特性键防御的道具（供测试核对）；46 辆开局自带道具的迅引擎道具车（引擎 12、有 `ItemSlotCapacity`、默认 exceed 类型的 `chargerSystemboosterUseCount` 为 0）；`title_icons/namemap@zz` 的 12 个结算称号。规则单测与原版交叉核对在 `tools/item-mode-export/item-phase3.test.mjs`。

```sh
cd rewrite
node --import tsx tools/export-item-mode-data.mjs            # 重新生成 itemmode.json
node --import tsx tools/export-item-mode-data.mjs --check    # 提交的 JSON 过期时退出码 1
node --test tools/item-mode-export/item-mode.test.mjs        # 导出规则单测，并与 recovered/data-full 的原版表交叉核对
```

赛道表与随机池直接取浏览器道具房间的选图目录（`rewrite/src/resources/track-catalog.ts` 的 `itemTrackCatalog`、`itemRandomTrackGroups`：`trackLocale@cn` 规则、反向赛道需要 `track_rvs` 行），并用前端的 `.1s` 解码器统计每个模型的 `ToItemCube` 与移动道具箱（目录里每条赛道都必须有，否则导出失败）。`rewrite/tools/item-mode-export/item-mode.test.mjs` 在有 `mirror/p3553` 时比对已提交的 JSON 与浏览器目录，二者不一致即失败。kart-game 启动时解析它（失败则不启动）；`go test ./internal/game/itemmode` 校验版本号与内容一致。

### 限流与反向代理

数据服务（数值写在 `internal/data/api/limits.go`，没有对应的环境变量）：

- 注册：每个客户端 IP（IPv4 单个地址，IPv6 按 /64）每小时 5 次，IPv6 另按 /56 每小时 10 次；全服每分钟 60 次，只计通过字段、邀请码与重名预检的注册，注定失败的请求用不掉全服额度。Redis 不可用时注册返回 503。
- 登录：每个客户端 IP（同上）每 5 分钟 20 次；失败次数按（用户名、客户端网段：IPv4 /24、IPv6 /64）计数，每 15 分钟 10 次。别的网段的失败不会锁住这个用户名，攻击者无法把别人锁在账号外。
- 领取礼包、购买、计时赛结算、保存档案、好友私聊的写接口：每个账号每分钟 300 次；计时赛另有节奏限制（ECONOMY.md 2.2）。
- 好友请求：每个账号每小时 20 次（Redis 不可用时放行）。私聊刷屏：每个账号每秒 1 条、突发 5 条，用完后禁言 10 秒（429 `CHAT_FLOOD`，带 `mutedUntil`；计数在数据服务内存中，HTTP 与 WebSocket 共用）。

超出返回 429 `TOO_MANY_ATTEMPTS`。计数在 Redis 的 `rl:` 键下，误封时可删除对应键，例如 `redis-cli DEL 'kart:rl:register-ip:203.0.113.7'`（IPv6 为 `register-ip:2001:db8::/64`、`register-site:2001:db8::/56`；登录失败为 `login-fail:<小写用户名>|203.0.113.0/24`；好友请求为 `friend-request:<accountId>`）。

游戏节点按连接限流（固定值）：文本命令每秒 30 次（突发 60），其中 `create`/`track`/`random-track`/`room-settings` 另限每秒 5 次（突发 20），需要核对装备的命令每秒 2 次（突发 10），运动帧每秒 200 帧（突发 400）。超出的命令回复 429 `RATE_LIMITED`（运动帧直接丢弃），持续超出的连接以 1008 断开。

客户端 IP 取 TCP 对端地址；只有对端属于 `KART_TRUSTED_PROXIES`（默认回环地址 `127.0.0.0/8,::1`）时才从右向左读取 `X-Forwarded-For`，取第一个不属于可信代理的地址。因此：

- `run-full-local.sh`/`run-lan.sh`：Vite 代理在本机，默认值即可（`run-lan.sh` 显式传入 `127.0.0.1/32,::1/128`）。
- 生产环境的 Nginx 必须设置 `X-Forwarded-For`（下文示例已设置）。Nginx 与 kart-data 在同一台机器、经 127.0.0.1 连接时默认已经信任；否则把 Nginx 到 kart-data 的来源地址写进 `KART_TRUSTED_PROXIES`，不然所有玩家共用 Nginx 的一个限流额度。docker compose 下宿主机 Nginx 经发布端口访问时，容器看到的是 `cluster` 网络的网关地址（见 `.env.example`）。只信任确实是你自己代理的地址，否则客户端可以伪造来源。
- 端到端脚本为每个测试账号发送不同的 `X-Forwarded-For`，所以测试集群要信任运行脚本的地址（见“测试”）。

## 快速开始

需要 Go 1.26+、Node.js 22+（前端与测试脚本）、MySQL 8.0.19+（推荐 8.4）、Redis 6+（推荐 7）。

### 本机开发：`run-full-local.sh`

1. 准备 MySQL 与 Redis，二选一：
   - Homebrew：
     ```sh
     brew install mysql@8.4 redis
     brew services start mysql@8.4
     brew services start redis
     mysql -h127.0.0.1 -P3306 -uroot -p < server-go/scripts/init-mysql.sql   # root 默认无密码，直接回车
     ```
   - Docker：`docker compose -f server-go/scripts/dev-deps.compose.yml up -d`（MySQL 发布在 127.0.0.1:3306，库与账号已建好；Redis 在 127.0.0.1:6379）。

   [`scripts/init-mysql.sql`](scripts/init-mysql.sql) 创建库 `kartsim`、`kartsim_test`（Go 单元测试用）和账号 `kart`/`kart`，与 kart-data 的默认 DSN 一致；表结构由 kart-data 启动时自动创建与迁移。
2. 在仓库根目录运行：
   ```sh
   ./run-full-local.sh
   ```
   脚本会：检查端口未被占用；检查 MySQL 与 Redis 可达（失败时给出启动与建库的具体命令）；缺少前端依赖时执行 `npm ci`；`go build -o bin/ ./cmd/kart-data ./cmd/kart-game`；未设置 `KART_CLUSTER_SECRET` 时生成一次并保存在 `server-go/data/cluster-secret`（权限 0600）以后复用；依次启动数据服务和 `KART_GAME_NODES`（默认 1）个游戏节点，等待各自的 `healthz` 就绪并确认节点出现在游戏服列表中；最后启动 Vite。前端默认 <http://127.0.0.1:8780/>，数据服务 <http://127.0.0.1:8787/>，游戏节点 8788、8789……（跳过 8790 等已用端口）。各服务日志带 `[data]`、`[game-1]` 前缀。按 Ctrl-C 或任一进程退出时停止全部进程。

   常用变量：

   ```sh
   KART_GAME_NODES=2 ./run-full-local.sh                       # 两个游戏节点，测试选服
   KART_ADMIN_USERNAMES=alice ./run-full-local.sh               # alice 是管理员（可用管理页面发放货币）
   KART_REGISTRATION=invite ./run-full-local.sh                 # 邀请码注册（open 默认 / invite / closed）
   KART_MYSQL_DSN='kart:kartpass@tcp(127.0.0.1:3307)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci' \
   KART_REDIS_ADDR=127.0.0.1:6380 ./run-full-local.sh           # 非默认的 MySQL / Redis
   ```

   默认开放注册：打开游戏后在登录界面注册账号（用户名、昵称、密码），领取新手礼包后进入主界面与联机大厅；没有游客模式（`KART_ALLOW_GUESTS=true` 可临时恢复）。开放注册下首位注册者不会自动成为管理员，管理员由 `KART_ADMIN_USERNAMES` 指定，名单中尚未注册的用户名要用数据服务日志里打印的引导邀请码注册（登录界面点“有邀请码？”填入，见“管理页面与发放货币”）；脚本最后打印管理页面地址 `<数据服务>/multiplayer/admin`。`KART_REGISTRATION=invite` 时数据服务在日志中打印首个注册邀请码（也可预先设置 `KART_BOOTSTRAP_INVITE`），首位注册用户成为管理员（与 Java 版相同）。脚本会拒绝非法的 `KART_REGISTRATION` 与 `KART_ADMIN_USERNAMES`。

### 局域网：`run-lan.sh`

```sh
./run-lan.sh
```

数据服务与游戏节点监听 `0.0.0.0` 并信任任意主机名（`KART_LAN_HOSTS='*'`）；前端以自签名证书提供 HTTPS（其他设备需要安全上下文），并把 `/multiplayer/ws` 与 WebRTC 信令 `/multiplayer/offer` 代理到唯一的游戏节点（`KART_LAN_GAME_BACKEND`；WebRTC 的 UDP 由各设备直连该节点的局域网地址），其余 `/multiplayer/`、`/api/` 代理到数据服务（`KART_LAN_BACKEND`，好友私聊的 WebSocket `/api/messenger/ws` 也转发升级）。该节点以 `KART_PUBLIC_ORIGIN=same-origin` 运行，列表中的 origin 为 `null`，浏览器因此连接页面同源的 `wss://`。内部 API 仍只监听 127.0.0.1。终端会打印各网卡的 `https://<IP>:8780/` 地址，每台设备首次访问时需要信任证书；管理页面同样经代理提供（`https://<IP>:8780/multiplayer/admin`）。数据服务信任本机代理转发的 `X-Forwarded-For`（`KART_TRUSTED_PROXIES=127.0.0.1/32,::1/128`），注册限流因此按各设备的地址计算。

### Docker Compose

```sh
cd server-go
install -m 600 .env.example .env   # 只有自己可读；填写 KART_CLUSTER_SECRET、MYSQL_ROOT_PASSWORD、KART_MYSQL_PASSWORD、KART_REDIS_PASSWORD、KART_ADMIN_USERNAMES
docker compose up -d --build
docker compose ps         # 等待全部 healthy
docker compose logs kart-data | grep -i "account economy"   # 注册方式、游客、倍率等经济配置
# KART_REGISTRATION=invite 时，或 KART_ADMIN_USERNAMES 中有尚未注册的用户名时：
# docker compose logs kart-data | grep -i invitation 查看邀请码
```

[`docker-compose.yml`](docker-compose.yml) 包含 `mysql:8.4`（默认排序规则 `utf8mb4_0900_as_ci`，首次初始化执行 [`scripts/docker-mysql-init.sql`](scripts/docker-mysql-init.sql)）、`redis:7`（带密码、不持久化）、`kart-data`（发布 8787）以及 `kart-game-1`、`kart-game-2`（发布 8788、8789，各自的 `KART_PUBLIC_ORIGIN` 与发件箱卷）。默认只绑定宿主机 127.0.0.1（`KART_BIND_ADDR`）；MySQL、Redis 和内部 API 8790 不发布。所有容器有健康检查与 `restart: unless-stopped`，镜像以非 root 用户（UID 10001）运行。数据卷：`mysql-data`、`game-1-outbox`、`game-2-outbox`。

网络分两层：`backend`（`internal: true`，没有出网路由）只有 `mysql`、`redis` 与 `kart-data`；`cluster` 有 `kart-data` 与两个游戏节点，发布的端口经它对宿主机可达。游戏节点因此只能访问 `kart-data` 的 8787/8790，连不到 MySQL 与 Redis——Redis 里的会话缓存与账号缓存等同登录凭据，能写 Redis 就能冒充任何账号（包括管理员）。

`.env` 含集群密钥与全部密码：用上面的 `install -m 600`（或 `(umask 077 && cp .env.example .env)`）创建，已有的文件执行 `chmod 600 .env`；密码与密钥用 `openssl rand -hex 24` 这类足够长的随机值。kart-game 的 `KART_MAX_CONNECTIONS`、`KART_SEND_BUFFER_BYTES`、`KART_HELLO_TIMEOUT` 与 kart-data 的 `KART_REDIS_PREFIX`、`KART_MESSENGER_MAX_CONNECTIONS`、`KART_MESSENGER_SEND_BUFFER_BYTES` 也可以写在 `.env` 中，留空时用程序默认值；其他未出现在 `docker-compose.yml` 里的变量不会传进容器。

账号经济的变量也在 `.env` 中：`KART_REGISTRATION`（默认 `open`）、`KART_ADMIN_USERNAMES`（管理员用户名；部署后用 `docker compose logs kart-data | grep -i invitation` 打印的引导邀请码注册它们）、`KART_ALLOW_GUESTS`、`KART_EXP_RATE`/`KART_LUCCI_RATE`（只传给数据服务，游戏节点经心跳响应得到）、`KART_STARTING_LUCCI` 与 `KART_TRUSTED_PROXIES`。前面放宿主机 Nginx 时务必按 `.env.example` 设置 `KART_TRUSTED_PROXIES`，否则所有玩家共用一个注册限流额度。管理页面经发布的 8787 端口（或 Nginx 的 `/multiplayer/`）访问：`/multiplayer/admin`。

Compose 只运行服务端。开发前端时在 `rewrite/` 运行 `npm run dev`，它默认连接 `http://127.0.0.1:8787`；对外提供服务时请按下文“分布式部署”在前面放反向代理。

### 手动构建与运行

```sh
cd server-go
go build -o bin/ ./cmd/kart-data ./cmd/kart-game ./cmd/kart-migrate-sqlite
export KART_CLUSTER_SECRET=$(openssl rand -base64 48)
KART_MYSQL_DSN='kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci' ./bin/kart-data &
KART_NODE_ID=game-1 KART_NODE_NAME='游戏服 1' ./bin/kart-game &
```

两个程序都只从环境变量读取配置，配置非法时拒绝启动并说明原因；日志是 `log/slog` 文本格式，写到 stderr。SIGINT/SIGTERM 触发优雅关闭。

## 测试

```sh
cd server-go
go vet ./... && go test -race ./...
KART_TEST_MYSQL_DSN='kart:kart@tcp(127.0.0.1:3306)/kartsim_test?charset=utf8mb4&collation=utf8mb4_0900_as_ci' go test -race ./...
```

未设置 `KART_TEST_MYSQL_DSN` 时跳过 MySQL 相关单测；Redis 相关单测使用 miniredis。不需要运行服务的 Node 单测：`node --test test/lib/kart-client.test.mjs test/lib/economy.test.mjs test/launcher.test.mjs test/lib/item-race.test.mjs test/lib/item-bot-lib.test.mjs`（测试客户端与新手装备、端到端脚本用来预测奖励与等级的规则移植、`run-full-local.sh` 对非法配置的拒绝与 DSN 脱敏，以及道具赛脚本与测试机器人的共用部分：名次组、目标规则、道具请求序号、运动帧、路线行驶；有 `rewrite/node_modules` 时还与浏览器自己的起跑位、车身朝向与运动编解码逐项比对）。

端到端脚本（Node.js 22+，无 npm 依赖；共用 [`test/lib/kart-client.mjs`](test/lib/kart-client.mjs)，自带集群的脚本另用 [`test/lib/local-cluster.mjs`](test/lib/local-cluster.mjs)，奖励与等级规则在 [`test/lib/economy.mjs`](test/lib/economy.mjs)）：

| 脚本 | 前提 | 内容 |
| --- | --- | --- |
| `node test/smoke.mjs` | 集群已运行 | 档案/记录读写与密钥；注册三个账号并领取新手礼包；票据规则（拒绝游客、同一账号只能有一个在线会话：同节点 `NICKNAME_TAKEN`、另一节点 `ACCOUNT_ONLINE`）；两个账号完成一局并检查 `race.rewards`（开跑 10 秒内完成，双方都只得未完赛奖励）；赛果、完整赛程、房间规则到达数据服务，奖励入账 |
| `node test/auth-smoke.mjs` | `KART_SMOKE_MYSQL_ADMIN`，Redis | 自行构建并启动 kart-data（`KART_REGISTRATION=invite`，管理员用户名用 `KART_BOOTSTRAP_INVITE` 注册）与两个 kart-game（临时 MySQL 库和账号、唯一 Redis 前缀），验证邀请、注册、登录、改名、token、档案密钥、内部 API 鉴权、拒绝游客与未领取礼包的票据、票据（含伪造的过期/错数据节点/游客票据）、跨节点昵称与账号占用（`presence-account` 键，另一节点 `ACCOUNT_ONLINE`）、数据服务停机期间的结算经发件箱补发并入账（立即完赛按未完赛奖励）、玩家统计、结算幂等以及数据服务重启后的持久化；结束时全部清理 |
| `node test/economy-smoke.mjs` | `KART_SMOKE_MYSQL_ADMIN`，Redis | 自行启动开放注册的 kart-data（测试管理员与 `KART_BOOTSTRAP_INVITE`、倍率 1、初始金币 10000）与两个 kart-game，验证：注册返回 token、密码 8–128、首位注册者不是管理员、按 IP 限流 429；管理员用户名不带邀请码（或大小写不同、邀请码错误）400 `INVALID_INVITE`，日志打印引导邀请码，用它注册后成为管理员、邀请码不能再用；`auth/config` 字段；游客票据与游客 `hello` 被拒；领取礼包前 403；礼包白名单（400）、幂等与库存；`/api/account` 钱包与 Lv.1；目录 ETag/304/gzip；`INSUFFICIENT_FUNDS` → 管理员发放 → 过期的 `expectedPrice`/`expectedCurrency` 409 `PRICE_CHANGED`（不扣款）→ 购买 → `ALREADY_OWNED`、`EXP_REQUIRED`、`OFFER_NOT_FOUND`、限时购买与续期、`requestId` 重放、换商品 409 `REQUEST_ID_CONFLICT`；账号档案 409 `ITEM_NOT_OWNED`；`hello`/`create`/`join`/`equipment` 的不拥有装备；一个账号一个会话（同节点 `NICKNAME_TAKEN`，另一节点及改名后 `ACCOUNT_ONLINE`）；两局比赛：立即完赛双方只得未完赛奖励，等满 10 秒服务器时间后完赛者得名次奖励、上报时间比服务器观察短 3 秒以上者按未完赛（`race.results` 名次不变），入账、升级奖励、战绩，重复投递不重复入账；结算携带的倍率（`expRate`/`lucciRate`）、超过 24 小时与超过单条上限的结算只记赛果不发奖励；MySQL 流水与余额一致；计时赛奖励、个人最佳、400 `INVALID_ELAPSED_MS`/`INVALID_TRACK`、节奏限制 429 `TOO_MANY_ATTEMPTS`、`requestId` 重放与 409 `REQUEST_ID_CONFLICT`；管理页面、账号搜索、发放与扣除、非管理员被拒、发放 `requestId` 重放 `duplicate:true`、换参数 409 `REQUEST_ID_CONFLICT`；`KART_REGISTRATION=closed` 重启后注册 403 而余额与库存保留；任何退出路径（含 Ctrl-C）都清理。比赛与计时赛要等真实时间，约 1 分钟 |
| `node ../server-smoke.mjs` | 集群已运行 | 在上述规则基础上用真实前端校验器检查大厅、房间、个人赛与组队赛快照及 `race.rewards`（个人赛开跑 10 秒内完成，双方奖励相同，即未完赛奖励）（需要 `rewrite/node_modules`，没有时跳过校验器；已安装但校验器加载失败时直接失败，设置 `KART_SMOKE_ALLOW_NO_VALIDATORS=1` 才降级为警告） |
| `node ../server-special-smoke.mjs` | 集群已运行、`rewrite/node_modules` | 注册五个账号，检查挡人、巨人、RP、LTE 四种模式的房间、赛程、广播、`race.rewards`（都在开跑 10 秒内结束，所有人得相同的未完赛奖励）与结算；再用四个账号跑个人道具赛与组队道具赛：道具频道与玩法、道具赛道与随机码规则（有 `mirror/p3553` 时还核对浏览器的道具赛道目录）、用浏览器编码器发送带名次进度的运动帧、按名次组抽取（刷箱、满槽、三槽）、开赛时的道具槽推送（带换位/变更卡数）、换位与变更（集群给了使用券时成功、没有卡时 `ITEM_CHANGER_UNAVAILABLE`）、`transform@zz` 变换后的道具（组队赛固定在等级 2 的反向赛道）、各类道具的目标、放置、命中/格挡、香蕉移除、赛道危险物、透视镜（`Use` 之后生效）、道具锁、完赛（`perfectStart`，组队按最先冲线者的队伍获胜）、结算称号、结算与道具赛成就；所有道具请求都过浏览器的请求校验、所有事件都过浏览器的事件校验（会变成 `INVALID_ITEM_EVENT` 的道具事件算失败）。道具来自真实抽取，脚本会刷箱直到拿到需要的道具（`KART_SMOKE_ITEM_BUDGET_MS`，默认每种 90 秒）；`KART_SMOKE_ITEM_ONLY=1` 只跑道具赛；约 1 分钟 |
| `node test/item-bot-check.mjs` | `KART_SMOKE_MYSQL_ADMIN`，Redis，`rewrite/node_modules`，`mirror/p3553` | 自行启动打开 `KART_ITEM_TEST_GRANTS`（道具换位卡按库存：机器人没有卡时先用掉槽 0 的道具）的临时集群，由脚本扮演玩家建道具房间，启动测试机器人 `test/item-bot.mjs`：它登录、找到房间、准备、载入，沿赛道路线行驶（运动帧用浏览器编解码器核对）、按时使用导弹和香蕉、上报玩家的导弹与大魔王命中（被导弹炸飞时停下）、跑完 3 圈完赛、`--once` 后离开且不打印密码；约 1 分钟 |
| `node test/run-cluster-smokes.mjs [smoke] [server-smoke] [special]` | `KART_SMOKE_MYSQL_ADMIN`，Redis | 自行启动临时集群（开放注册、两个游戏节点），依次对它运行上面三个“集群已运行”的脚本，结束后清理；不想把测试数据写进开发集群时用它 |
| `node test/frontend-economy-check.mjs` | `KART_SMOKE_MYSQL_ADMIN`，Redis，`rewrite/node_modules` | 自行启动临时集群（倍率经验 1.5、金币 2，两个游戏节点），用 tsx 直接运行浏览器的真实模块（`rewrite/src/account/*`、`shop-api.ts`/`shop-model.ts`、`game-servers.ts`、`client-websocket.ts` 与严格的事件/房间校验器、`timeattack-settle.ts`）：登录门注册（开放注册折叠的“有邀请码？”；管理员用户名不带邀请码 `INVALID_INVITE`，用引导邀请码注册）→ 首次登录迁移偏好与 404 `PROFILE_NOT_FOUND` → 新手礼包（`source:"starter"`、重复领取）→ 车库拥有过滤 → 档案保存与 409 `ITEM_NOT_OWNED` 修复 → 商店目录 ETag/304 → `ShopPurchaser` 余额不足 → 管理员发放 → 旧价格 `PRICE_CHANGED`（中文提示、不扣款）→ 购买与租用 → 票据与进入游戏服（练习车、买来的车、免费槽位）→ 同一账号在另一节点 `ACCOUNT_ONLINE` → 两个账号比赛（等满 10 秒服务器时间再完赛）→ 解析 `race.rewards`（显示值 = 倍率后的入账值）→ 刷新账号与升级提示 → 计时赛结算（间隔 10 秒以上；过于频繁的 `TOO_MANY_ATTEMPTS` 与无效赛道 `INVALID_TRACK` 静默无奖励）与升级 → 过期租用在档案读取与 `hello`（`ITEM_NOT_OWNED` 后修复重进）时回退；约 1 分钟 |

自带集群的脚本都以 `KART_ANTICHEAT=log` 启动游戏节点（它们的比赛不开车就完赛，会被反作弊踢出；`item-bot-check` 里只有沿路线行驶的测试机器人，不应产生任何反作弊记录）。worktree 没有 `mirror/p3553` 时，`server-special-smoke.mjs` 与 `test/item-bot.mjs` 可用 `KART_MIRROR_ROOT=<带 mirror 的检出>` 读另一个检出的资源（`rewrite/tools/export-*.mjs` 的同类参数是 `--mirror`）。

```sh
# 自带集群（会构建 server-go/bin；已构建可加 KART_SMOKE_SKIP_BUILD=1 或 KART_BIN_DIR=…）
KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 node test/auth-smoke.mjs
KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 node test/economy-smoke.mjs
# 对已运行的集群（例如 ./run-full-local.sh，默认地址）
node test/smoke.mjs && node ../server-smoke.mjs && node ../server-special-smoke.mjs
# 或者对一个临时集群运行这三个脚本
KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 node test/run-cluster-smokes.mjs
# 浏览器真实模块对临时集群的账号经济全流程（需要 rewrite/ 下 npm ci）
KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 node test/frontend-economy-check.mjs
# 只跑道具赛冒烟（临时集群）与道具赛测试机器人的端到端检查
KART_SMOKE_ITEM_ONLY=1 KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 node test/run-cluster-smokes.mjs special
KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 node test/item-bot-check.mjs
```

**道具赛测试机器人**（[`test/item-bot.mjs`](test/item-bot.mjs)，用法见文件头注释或 `--help`）：在浏览器里手动测试道具赛时充当另一名车手。用 JSON 文件里的已有账号登录（`--accounts`，默认 `server-go/data/dev-test-accounts.json`，`--account` 选用户名或昵称；不打印密码），加入唯一的道具房间（或 `--room ID`）、准备、载入；比赛中沿赛道路线（浏览器的路线图，需要 `mirror/p3553`）以 `--speed` 米/秒在自己的起跑位车道行驶并按圈完赛，或用 `--replay` 重放在浏览器里录下的运动（`--print-recorder` 打印 DevTools 录制片段）；`--use rocket@20s,devil@25s` 在比赛时间使用指定道具（导弹/磁铁瞄准 `--target`，默认第一名对手；需要游戏节点 `KART_ITEM_TEST_GRANTS=true`）；瞄准它的道具到达时上报命中（`--defend shield|angel` 可改为格挡），开过香蕉、水炸弹、定时水炸弹、路障时上报命中，被瞄准的路障由它放置；命中后按效果停下或减速。第 3 阶段：有道具换位卡或使用券时才换位（没有就先用掉槽 0 的道具），双发导弹两枚各报一次（`shot` 0/1），打印服务器的道具槽推送（开赛、获得表）、赛中金币与结算称号，`--perfect-start` 完赛时声明起步加速成功。赛后回到房间再次准备（`--once` 则离开）。

```sh
KART_ITEM_TEST_GRANTS=true ./run-full-local.sh          # 在仓库根目录；浏览器里建一个道具房间
node server-go/test/item-bot.mjs --account bob --use rocket@20s,banana@30s,devil@45s
```

**账号与注册限流。** 默认没有游客，所以每个脚本玩家都是新注册的账号（随机的唯一用户名与 ≤ 16 字的昵称），领取新手礼包后用 Bearer 票据进入，`hello`/`create`/`join` 只带新手装备（练习车）。注册按客户端 IP 每小时限 5 次，而一次 `smoke.mjs` 就要注册 3 个账号、`server-special-smoke.mjs` 5 个：脚本因此给每个账号发送不同的 `X-Forwarded-For`（`198.18.0.0/15` 测试网段），被测数据服务必须信任运行脚本的地址——`KART_TRUSTED_PROXIES` 的默认值（回环地址）已覆盖 `run-full-local.sh`/`run-lan.sh` 启动并在本机测试的情况，自带集群的脚本固定使用 `KART_TRUSTED_PROXIES=127.0.0.1/32`。不能这样配置的部署（远程、compose 发布端口、邀请码或关闭注册）改用已有账号：`KART_SMOKE_ACCOUNTS=user1:密码1,user2:密码2,…`（按顺序使用，不够时再注册；没领取礼包的会自动领取），并可用 `KART_SMOKE_FORWARDED_FOR=0` 不发送该头。注册被限流时脚本会给出上述提示；需要立即解除时删除 Redis 键 `<前缀>rl:register-ip:<IP>`。

脚本变量：`KART_DATA_ORIGIN`（默认 `http://127.0.0.1:8787`，兼容旧名 `KART_SERVER_BASE`）、`KART_GAME_ORIGINS`（逗号分隔的游戏节点 origin，用来替代列表中的地址，例如在同源代理或容器网络外测试）、`KART_GAME_NODE`（单节点流程使用的节点）、`KART_SMOKE_TIMEOUT_MS`、`KART_SMOKE_SETTLE_TIMEOUT_MS`（等待结算到达的时间）、`KART_SMOKE_ACCOUNTS`、`KART_SMOKE_FORWARDED_FOR`。跨节点检查（另一节点拒绝票据、同一账号全集群只能在线一次）需要至少两个游戏节点，只有一个时会跳过并提示。每个连接在输出 PASS 前都会发一次 `clock` 往返（`ControlSocket.drain()`），确认此前收到的全部事件（包括没有人等待的广播）都是合法 JSON 并通过前端校验器。

自带集群的 auth-smoke、economy-smoke、frontend-economy-check 与 run-cluster-smokes 另有：`KART_SMOKE_MYSQL_ADMIN`（必填，mysql 命令行管理员参数，未设置时跳过）、`KART_SMOKE_MYSQL_ADDR`（服务连接 MySQL 的地址，默认取 `-h`/`-P`）、`KART_SMOKE_REDIS_ADDR`（默认 `127.0.0.1:6380`）、`KART_SMOKE_REDIS_PASSWORD`/`_DB`、`KART_SMOKE_SKIP_BUILD=1`、`KART_BIN_DIR`（使用其他目录的二进制，不构建）、`KART_SMOKE_PORTS`（服务端口范围，例如 `18800-18849`；默认任取空闲端口）、`KART_SMOKE_KEEP=1`（保留现场）与 `KART_SMOKE_VERBOSE=1`（输出服务日志）。它们收到 SIGINT、SIGTERM 或 SIGHUP 时同样会停止服务并删除临时库、MySQL 账号、Redis 键与工作目录。economy-smoke 直接查询临时库的 `wallet_ledger`、`exp_ledger`、`wallets`、`account_progress` 核对流水。

smoke 类脚本会在所连集群的 MySQL 中留下测试账号、档案、赛果与房间规则，请对测试部署运行。

## 环境变量

### kart-data

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `KART_DATA_ADDR` | `127.0.0.1`（兼容 `SERVER_ADDRESS`） | 公网 HTTP 监听地址 |
| `KART_DATA_PORT` | `8787`（兼容 `KART_SERVER_PORT`） | 公网端口，与旧 Java 版相同 |
| `KART_INTERNAL_LISTEN` | `127.0.0.1:8790` | 内部 API 监听地址，只给游戏节点，**不要暴露到公网** |
| `KART_MYSQL_DSN` | `kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci` | go-sql-driver DSN；程序会补上必要参数 |
| `KART_REDIS_ADDR` | `127.0.0.1:6379` | |
| `KART_REDIS_PASSWORD` / `KART_REDIS_DB` | 空 / `0` | |
| `KART_REDIS_PREFIX` | `kart:` | 所有 Redis 键的前缀；多套部署共用一个 Redis 时区分开 |
| `KART_CLUSTER_SECRET` | 必填，≥ 32 字符 | 票据签名与内部 API 认证，所有节点相同 |
| `KART_DATA_NODE_ID` | `data-1` | 写入票据，游戏节点校验；`[A-Za-z0-9_-]{1,64}` |
| `KART_LAN_HOSTS` | 空（兼容 `KART_LANHOSTS`） | 额外可信主机，逗号分隔；`*` 表示任意。用于 Host 校验与 CORS，回环地址总是可信 |
| `KART_PUBLIC_ORIGIN` | 空 | 设置后 `auth/config` 直接返回它作为 `backendOrigin`（反向代理后使用） |
| `KART_BOOTSTRAP_INVITE` | 空 | 引导邀请码：`KART_REGISTRATION=invite` 时作为首个邀请码（仅当没有任何邀请和账号时创建）；任何模式下，只要 `KART_ADMIN_USERNAMES` 中有尚未注册的用户名，每次启动都会为每个这样的用户名记录错误日志，并确保有一个可用的引导邀请码供注册它们：本次刚创建的首个邀请码，否则这个值（未被使用时；不存在则创建），已被使用或未设置时每次启动另生成一个随机邀请码。用到的邀请码都会打印到日志（`grep -i invitation`） |
| `KART_REGISTRATION` | `open` | `open` 开放注册（不需要邀请码，注册即登录）、`invite` 需要邀请码、`closed` 关闭注册（403 `REGISTRATION_CLOSED`） |
| `KART_ALLOW_GUESTS` | `false` | 为 `true` 时不带 Bearer 也签发游客票据（游戏节点也要设置同样的值）；`auth/config.guests` 反映它 |
| `KART_ADMIN_USERNAMES` | 空 | 管理员用户名，逗号分隔（`[A-Za-z0-9_]{3,24}`，不区分大小写）；不写入数据库，移出名单即失去权限。尚未注册的名单用户名在任何注册模式下都只能带有效邀请码注册（否则 400 `INVALID_INVITE`；启动日志报错并打印引导邀请码，见 `KART_BOOTSTRAP_INVITE`）。数据库中原有 `admin=1` 的账号保持管理员 |
| `KART_EXP_RATE` / `KART_LUCCI_RATE` | `1` / `1` | 经验与金币奖励倍率（0–100），在入账时作用于联机比赛与计时赛奖励（ECONOMY.md 2）；心跳响应把它们告诉游戏节点，快照 `race.rewards` 因此显示乘过倍率的值。比赛结算携带游戏节点显示时用的倍率，数据服务在 [0, max(10, 当前配置)] 内采用它，所以改倍率前后结束的比赛显示值与入账值仍一致。只需在数据服务设置 |
| `KART_STARTING_LUCCI` | `10000` | 新账号的初始金币（0–1,000,000,000，写入流水） |
| `KART_TRUSTED_PROXIES` | 回环地址（`127.0.0.0/8`、`::1`） | 信任其 `X-Forwarded-For` 的反向代理，IP 或 CIDR，逗号分隔；`none` 表示不信任任何代理。用于按真实客户端 IP 限流（见“限流与反向代理”） |
| `KART_MESSENGER_MAX_CONNECTIONS` | `5000` | 好友私聊 WebSocket 上限（含尚未 `hello` 的连接，1–1,000,000）；超出时升级前返回 HTTP 503 `SERVER_BUSY` |
| `KART_MESSENGER_SEND_BUFFER_BYTES` | `262144` | 每个好友私聊连接待发送的字节上限（65536–67108864）；积压超过它的连接以 1008 断开 |

启动时连接 MySQL（最多重试 30 秒），在 `GET_LOCK('kartsim_schema')` 下建表与迁移，再连接 Redis。Redis 不可用时缓存降级为直连 MySQL 并告警，但游戏服列表、票据与在线昵称依赖 Redis，这些接口会返回 503 `DATA_SERVICE_UNAVAILABLE`。

### kart-game

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `KART_GAME_ADDR` | `127.0.0.1`（兼容 `SERVER_ADDRESS`） | 监听地址 |
| `KART_GAME_PORT` | `8788` | 监听端口 |
| `KART_NODE_ID` | `game-<端口>` | 节点 ID，`[A-Za-z0-9_-]{1,64}`，集群内唯一且应保持稳定（发件箱默认目录与它有关） |
| `KART_NODE_NAME` | 同 `KART_NODE_ID` | 列表中显示的名称，最多 32 个字符 |
| `KART_PUBLIC_ORIGIN` | `http://127.0.0.1:<端口>` | 浏览器访问本节点的 HTTP(S) origin；`same-origin` 表示经数据服务所在 origin 同源代理（列表中为 `null`） |
| `KART_DATA_INTERNAL_URL` | `http://127.0.0.1:8790` | 数据服务内部 API 地址（可为 https） |
| `KART_DATA_NODE_ID` | `data-1` | 票据中的数据节点必须与它相同 |
| `KART_CLUSTER_SECRET` | 必填 | 与数据服务相同 |
| `KART_MAX_PLAYERS` | `400` | 满员后 `hello` 返回 503 `SERVER_FULL`，列表中标记为满；最大 10000（数据服务心跳接受的上限） |
| `KART_OUTBOX_DIR` | `./data/outbox-<NODE_ID>` | 结算发件箱目录（目录 0700，文件 0600）；容器镜像中为 `/var/lib/kart/outbox` |
| `KART_LAN_HOSTS` | 空（兼容 `KART_LANHOSTS`） | WebSocket Origin 校验与 CORS 的可信主机；前端页面域名与本节点域名不同时必须列入页面域名 |
| `KART_MAX_CONNECTIONS` | `KART_MAX_PLAYERS + 50` | WebSocket 连接上限（含尚未 `hello` 的连接），超出时升级前直接返回 HTTP 503；不能小于 `KART_MAX_PLAYERS` |
| `KART_MAX_ROOMS` | `200` | 本节点房间上限，超出时 `create` 返回 503 `ROOM_LIMIT_REACHED` |
| `KART_SEND_BUFFER_BYTES` | `1048576` | 每个连接待发送的字节上限（≥ 65536）；网络太慢积压超过它的玩家会被以 1008 断开，不影响同房间其他人 |
| `KART_MEMORY_LIMIT_MB` | `0`（不限） | 设置后等同 `GOMEMLIMIT`；存活堆超过它的 90% 时拒绝新连接（HTTP 503）和新 `hello`（503 `SERVER_BUSY`），已在房间的玩家不受影响。为 0 或 ≥ 64 |
| `KART_HELLO_TIMEOUT` | `15s` | 连接后在这段时间内没有完成 `hello` 就以 1008 关闭（Go 时长格式，1s–5m） |
| `KART_ALLOW_GUESTS` | `false` | 为 `false` 时游客票据的 `hello` 返回 401 `LOGIN_REQUIRED`；应与数据服务相同 |
| `KART_ITEM_TEST_GRANTS` | `false` | **仅限开发测试。**为 `true` 时道具赛的 `cube` 请求可以带 `testItemId` 指定拿到的道具（任何道具赛道具，含第 3 阶段的特殊道具；测试机器人 `test/item-bot.mjs --use` 需要它），启动时打印警告；为 `false` 时这种请求返回 403 `ITEM_TEST_GRANTS_DISABLED`。公开部署切勿打开 |
| `KART_ITEM_CHANGERS` | `inventory` | 道具换位卡 / 道具变更卡：`inventory` 按每位车手开赛时库存里的卡和使用券（`ITEM_MODE.md` C.6）；`infinite` 让所有车手（含游客）本局无限换位与变更、不扣卡，用于试玩（相当于原版关掉的网吧无限卡），启动时打印警告。`test/run-cluster-smokes.mjs` 用 `infinite` |
| `KART_ANTICHEAT` | `kick` | 服务端反作弊（[`ANTICHEAT.md`](ANTICHEAT.md)）：`kick` 发现异常（坐标瞬移、移动过快、时钟加速、路线进度或圈数异常、完赛时间/速度/进度不对、道具箱拾取过快、畸形运动帧）即记录并踢出该车手；`log` 只记录（上线调参用）；`off` 不检查。记录在管理后台“反作弊记录”。临时集群脚本（`run-cluster-smokes.mjs` 等，比赛不开车就完赛）用 `log` |
| `KART_WEBRTC` | `true` | 是否提供 WebRTC 数据通道（`POST /multiplayer/offer`）；关闭后浏览器都用 WebSocket |
| `KART_WEBRTC_UDP_PORT` | `0` | 所有 WebRTC 连接共用的 UDP 端口（防火墙与容器发布它）；0 表示每个连接随机端口。端口被占用时节点照常启动，只提供 WebSocket（日志报错） |
| `KART_WEBRTC_PUBLIC_IPS` | 空 | 逗号分隔的 IP，替换 ICE 候选中的网卡地址（1:1 NAT、云主机、容器发布端口时填浏览器访问本机所用的地址） |
| `KART_WEBRTC_LOOPBACK` | `true` | 是否也提供 127.0.0.1 候选（浏览器与节点在同一台机器时可用）；容器内应设 `false` |

### 启动脚本（`run-full-local.sh` / `run-lan.sh`）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `KART_GAME_NODES` | `1` | 游戏节点数量（1–20）；`run-lan.sh` 固定为 1 |
| `KART_GAME_BASE_PORT` | `8788` | 第一个游戏节点端口，后续递增并跳过数据服务、内部 API 与 Vite 的端口 |
| `KART_GAME_PUBLIC_ORIGIN` | `http://127.0.0.1:<端口>` | 游戏节点公布的 origin，可用含 `{port}` 占位的模板。`same-origin`（仅限一个节点）需要同源代理：`run-lan.sh` 自动设置；单独使用 `run-full-local.sh` 时必须同时把 `VITE_MULTIPLAYER_BACKEND_ORIGIN` 设为把 `/multiplayer/ws` 转给游戏节点的反向代理 origin，否则脚本拒绝启动 |
| `KART_SKIP_DEPENDENCY_CHECK` | 空 | 设为 `1` 跳过启动前的 MySQL/Redis 检查 |
| `KART_VITE_PORT` | `8780` | 前端（Vite）端口 |
| `VITE_MULTIPLAYER_BACKEND_ORIGIN` | 数据服务地址 | 前端连接的数据服务；脚本按 `KART_DATA_ADDR`/`KART_DATA_PORT` 自动设置（`run-lan.sh` 的同源代理模式除外） |
| `KART_LAN_BACKEND` / `KART_LAN_GAME_BACKEND` | 数据服务 / 第一个游戏节点 | Vite 局域网代理的目标 |
| `KART_REGISTRATION` | `open` | 传给数据服务；脚本先检查它是 `open`/`invite`/`closed` |
| `KART_ADMIN_USERNAMES` | 空 | 管理员用户名（脚本先检查格式）；启动后打印管理页面 `<数据服务>/multiplayer/admin` |
| `KART_TRUSTED_PROXIES` | 数据服务默认（回环） | `run-lan.sh` 显式设为 `127.0.0.1/32,::1/128`，让经 Vite 代理的设备按各自 IP 限流 |

脚本 `KART_NODE_ID`（`game-1`、`game-2`……）、`KART_NODE_NAME`、`KART_PUBLIC_ORIGIN` 与 `KART_OUTBOX_DIR`（`server-go/data/outbox-<ID>`）按节点分别设置，其余 `KART_*` 变量原样传给服务。`KART_CLUSTER_SECRET` 只传给 kart-data 与 kart-game，不进入 `npm`/Vite 的环境；错误信息中的 `KART_MYSQL_DSN` 会隐去密码。

## HTTP API

### 数据服务公网 API（`:8787`）

所有路由使用同一 CORS 策略（可信 origin 的任意端口；方法 GET/PUT/POST/OPTIONS；头 Content-Type、Authorization、X-Profile-Key）。错误体为 `{"error":"CODE"}`；未知错误 500 `INTERNAL_ERROR`；JSON 解析失败 400 `INVALID_REQUEST`；请求体上限 8 MiB。

| 路径 | 用途 |
| --- | --- |
| `GET /multiplayer/healthz` | `{"protocolVersion":39,"ruleset":"launcher-room-v1","transport":"websocket","service":"data","dataNode":"data-1"}` |
| `GET /multiplayer/auth/config` | `{"loginRequired":true,"backendOrigin":…,"registration":"open","guests":false}`；经可信反向代理（`X-Forwarded-Host`）时 `backendOrigin` 为 `null`；设置了 `KART_PUBLIC_ORIGIN` 时返回它；不可信主机 400 `INVALID_HOST` |
| `POST /multiplayer/auth/guest-name` | `{"name"}` → `{"available"}`：名字合法、不是账号昵称且不在任何游戏服在线；非法 400 `INVALID_GUEST_NAME`（只在开启游客时有用） |
| `POST /multiplayer/auth/register` | `{"username","nickname","password","invite"?}` → `{"account","token"}`（注册即登录）。用户名 `[A-Za-z0-9_]{3,24}`、昵称 ≤ 16 字、密码 8–128 位，否则 400 `INVALID_ACCOUNT_FIELDS`；`invite` 模式缺少或无效邀请码、`KART_ADMIN_USERNAMES` 中的用户名（任何模式）没有有效邀请码、或开放模式填写了无效邀请码（填写的会被消耗）时 400 `INVALID_INVITE`；`closed` 403 `REGISTRATION_CLOSED`；重名 409 `USERNAME_TAKEN`/`NICKNAME_TAKEN`；限流 429 `TOO_MANY_ATTEMPTS`（见“限流与反向代理”） |
| `POST /multiplayer/auth/login` | 登录，返回 43 字符会话 token（有效 30 天）；限流 429 `TOO_MANY_ATTEMPTS`（按客户端 IP，失败按用户名与客户端网段）。密码正确但账号被封禁时 403 `ACCOUNT_BANNED`，响应体 `{"error":"ACCOUNT_BANNED","until":毫秒,"reason":"…"}`。**单点登录**：登录成功会结束该账号的其他所有会话——旧 token 之后的请求得到 401 `SESSION_REPLACED`（7 天内，之后为 `LOGIN_REQUIRED`），旧会话的好友聊天与小屋 WebSocket 立即以 4001 关闭，在游戏服上的旧会话在下一次心跳（≤ 5 秒）时被断开（`conflicts`），新登录可以立刻进入游戏服。浏览器收到 `SESSION_REPLACED` 时提示“您的账号已在其他地方登录”并回到登录页。管理员在管理页面登录（请求体带 `"console": true`）不结束游戏中的会话；普通账号带它没有效果 |
| `GET /multiplayer/auth/me` | Bearer token 查询账号 |
| `POST /multiplayer/auth/nickname`、`/multiplayer/auth/logout` | 改名、退出 |
| `POST /multiplayer/admin/invites` | 管理员创建邀请码 |
| `GET /multiplayer/admin` | **新增**。管理后台单页应用（嵌入的 `adminui/index.html`，脚本与样式在 `/multiplayer/admin/assets/`，按内容哈希命名、长期缓存），登录后调用下面的 `/api/admin/*`（见 ADMIN.md） |
| `GET /multiplayer/game-servers` | **新增**。`{"dataNode","servers":[{"nodeId","name","origin","players","rooms","capacity","full"}]}`，只含存活节点，按名称排序 |
| `POST /multiplayer/game-servers/ticket` | **新增**。`{"nodeId"}` + Bearer → `{"ticket","nodeId","origin","dataNode","expiresAt"}`；不带 Bearer（游客未开启）或 Bearer 无效 401 `LOGIN_REQUIRED`；未领取新手礼包 403 `ONBOARDING_REQUIRED`；节点不存在或已下线 404 `GAME_SERVER_NOT_FOUND`；节点已满 503 `GAME_SERVER_FULL` |
| `GET /multiplayer/ice` | `{"iceServers":[]}` |
| `POST /multiplayer/offer` | 501 `{"error":"USE_LOCAL_WEBSOCKET"}` |
| `GET/PUT /api/profile/{ownerId}` | 读取/保存完整浏览器档案 JSON（≤ 1,000,000 字符），需 `X-Profile-Key`。前端登录后改用账号档案 `/api/account/profile`；这个按浏览器密钥（owner key）的旧档案只在没有登录会话时读写，保留给旧数据与迁移 |
| `GET /api/records/{ownerId}`、`GET/PUT /api/records/{ownerId}/{recordId}` | 列出/读写影子记录（≤ 4,000,000 字符）。前端的计时赛影子摘要（`ghost-summary-sync.ts`）登录后也继续用浏览器的 owner key 同步，不绑定账号 |
| `GET /api/race-results?name=` | 最近 100 条多人比赛名次 |
| `GET /api/race-outcomes?gameplay=` | 最近 100 局完整赛程快照（含没有名次的挡人胜负） |
| `GET /api/room-rules` | 最近 100 份房间规则 |
| `GET /api/player-stats?name=` | **新增**。注册账号的累计统计 `{"nickname","races","wins","podiums","points","updatedAt"}`；没有时 404 `PLAYER_NOT_FOUND` |

账号经济接口（ECONOMY.md 6；除商店目录外都需要 Bearer，未登录 401 `LOGIN_REQUIRED`；写接口按账号限流 429 `TOO_MANY_ATTEMPTS`）：

| 路径 | 用途与错误 |
| --- | --- |
| `GET /api/account` | `{"account":{"username","nickname","admin","createdAt"},"progress":{"level","exp","levelExp","nextLevelExp","glove","gloveName","maxLevel"},"wallet":{"coupon","lucci","koin"},"stats":{"races","wins","podiums","points"},"onboarded"}`；`nextLevelExp` 在满级时为 `null` |
| `POST /api/account/starter` | `{"character":2\|3,"paint":6\|4\|5\|7,"dye":6\|4\|5\|7}` → 账号摘要；不在白名单 400 `INVALID_STARTER`；已领取过不再发放，照常返回摘要 |
| `GET /api/inventory` | `{"items":[{"category","itemId","systemKey"?,"quantity","expiresAt"(null=永久),"source"}],"serverTime"}`，不含已过期的物品 |
| `GET /api/account/profile` | 账号绑定的档案（收藏、小屋、车库改装、装备）；不再拥有的装备在返回时换成新手装备；还没有时 404 `PROFILE_NOT_FOUND`（领取礼包时会写入新手装备） |
| `PUT /api/account/profile` | 保存档案（JSON 对象，≤ 1,000,000 字符）；`equipment` 中每个需要核对的槽位都必须拥有且未过期，否则 409 `{"error":"ITEM_NOT_OWNED","missing":[{"slot","itemId"}]}`；装备格式错误 400 `INVALID_EQUIPMENT` |
| `GET /api/shop/catalog` | 商店目录（`catalog.json` 原文，不需要登录）；`ETag` 为目录版本，`If-None-Match` 命中返回 304；支持 gzip |
| `POST /api/shop/purchase` | `{"offerId","requestId"(UUID),"expectedPrice"?,"expectedCurrency"?}` → `{"wallet","item","purchaseId"}`；同一 `requestId` 重放返回原结果、不重复扣款，换了 `offerId` 409 `REQUEST_ID_CONFLICT`；`expectedPrice`/`expectedCurrency`（商店显示的价格与货币）与当前报价不符 409 `PRICE_CHANGED`（不扣款）；404 `OFFER_NOT_FOUND`、409 `INSUFFICIENT_FUNDS`、409 `ALREADY_OWNED`（已有永久物品）、403 `EXP_REQUIRED`（经验低于 `minExp`）、409 `QUANTITY_LIMIT`、400 `INVALID_REQUEST_ID`。浏览器每个购买对话框生成一个 `requestId`，对话框内重试复用它 |
| `POST /api/timeattack/settle` | `{"trackId","elapsedMs","requestId"}` → `{"exp","lucci","newRecord","capped","bestMs","levelUps","summary"}`；成绩小于 10 秒或超过 1 小时 400 `INVALID_ELAPSED_MS`，`trackId` 不在 `tracks.json` 中 400 `INVALID_TRACK`；距该账号上一次结算不足 10 秒或不足 `elapsedMs` − 3 秒 429 `TOO_MANY_ATTEMPTS`；同一 `requestId` 重放返回原结果，`trackId` 或 `elapsedMs` 不同 409 `REQUEST_ID_CONFLICT`。超过每日 50 次的跑次只更新最佳成绩（`capped:true`）。浏览器把 `TOO_MANY_ATTEMPTS`、`INVALID_TRACK` 静默当作“本局无奖励” |
| `GET /api/admin/*` 列表与 `PATCH /api/admin/accounts/{id}` 等 | 管理后台接口（概览、用户、账号游戏数据、登录记录、在线玩家、节点、流水、发放、比赛、购买、抽奖、开箱、俱乐部与成员、邀请码、奖励箱）：分页 `{"items","total","page","pageSize"}`，参数与返回字段见 [`ADMIN.md`](ADMIN.md)；非管理员 403 `ADMIN_REQUIRED` |
| `POST /api/admin/grant` | 管理员发放或扣除：`{"username","currency":"coupon"\|"lucci"\|"koin"\|"exp","amount","note","requestId"?}` → `{"applied","levelUps","duplicate","requestId","account"}`；同一 `requestId` 以相同参数重放返回 `duplicate:true`，参数不同 409 `REQUEST_ID_CONFLICT`；见“管理页面与发放货币” |

### 好友与私聊

完整契约（JSON 结构、错误码、推送与表结构）见 [`DESIGN.md`](DESIGN.md) 第 9 节。全部需要 Bearer（未登录 401 `LOGIN_REQUIRED`），写接口计入账号写限流。任何改变好友、请求、屏蔽、设置或会话列表的操作之后，数据服务向相关账号的每个连接推送 `{"type":"sync"}`，浏览器随后重新读取 `GET /api/messenger/state`；消息与在线状态单独推送。

| 路径 | 用途与错误 |
| --- | --- |
| `GET /api/messenger/state` | `{"me","settings","friends","incoming","outgoing","blocks","conversations","limits","serverTime"}`；好友带 `presence`（`online`/`inGame`/`offline`，隐身者总是 `offline`），会话最多 10 个 |
| `POST /api/messenger/friends/request` | `{"nickname"}` → `{"request"}`；对方已先发过请求时直接成为好友 → `{"friend","accepted":true}`。404 `PLAYER_NOT_FOUND`、400 `CANNOT_ADD_SELF`、409 `ALREADY_FRIENDS`/`REQUEST_PENDING`/`REQUEST_COOLDOWN`（被拒后到下一个北京时间 06:00）/`FRIEND_LIMIT`/`TARGET_FRIEND_LIMIT`/`REQUEST_LIMIT`/`BLOCKED_TARGET`、403 `FRIEND_REQUESTS_BLOCKED`、429 `TOO_MANY_ATTEMPTS`（每账号每小时 20 次） |
| `POST /api/messenger/friends/respond` | `{"accountId","accept"}` → `{"friend"}`（同意）或 `{"ok":true}`（拒绝）；404 `REQUEST_NOT_FOUND`、409 `FRIEND_LIMIT`/`TARGET_FRIEND_LIMIT` |
| `POST /api/messenger/friends/cancel`、`/friends/remove` | `{"accountId"}` → `{"ok":true}`：撤回我的请求（404 `REQUEST_NOT_FOUND`）、删除好友（双方，404 `FRIEND_NOT_FOUND`） |
| `POST /api/messenger/friends/favorite` | `{"accountId","favorite"}` → `{"friend"}`；404 `FRIEND_NOT_FOUND` |
| `POST /api/messenger/outbox/clear` | → `{"deleted"}`：隐藏已被同意或拒绝的请求卡片 |
| `POST /api/messenger/blocks/add`、`/blocks/remove` | `{"accountId"}` → `{"block"}` / `{"ok":true}`；屏蔽同时删除好友关系与双方的请求。404 `PLAYER_NOT_FOUND`、400 `CANNOT_BLOCK_SELF`、409 `BLOCK_LIMIT`（100）、404 `BLOCK_NOT_FOUND` |
| `PUT /api/messenger/settings` | `{"blockFriendRequests","blockGameInvites","invisible"}`（都必填，否则 400 `INVALID_REQUEST`）→ 同样的对象 |
| `GET /api/messenger/messages?with=&before=&limit=` | 与某人的消息（旧 → 新，默认 30 条、最多 100）→ `{"messages","hasMore"}`；`with` 非法 400 `INVALID_ACCOUNT_ID` |
| `POST /api/messenger/messages` | `{"to","text","clientId"}` → `{"message","duplicate"}`（`clientId` 为 UUID，重复提交返回原消息）；文本去掉首尾空白后 1–30 字。403 `NOT_FRIENDS`、400 `INVALID_MESSAGE`/`INVALID_REQUEST_ID`、429 `{"error":"CHAT_FLOOD","mutedUntil"}` |
| `POST /api/messenger/read`、`/conversations/hide` | `{"with","upTo"}` / `{"with"}` → `{"ok":true}`：已读到某条消息；隐藏会话并清除我这一侧的记录（新消息会让它重新出现） |
| `GET /api/messenger/ws` | WebSocket。第一帧（10 秒内）`{"type":"hello","token"}` → `{"type":"welcome","accountId","serverTime","state"}`；之后 `ping`→`pong`、`send`→`sent`（另推 `message`）、`read`。推送 `presence`、`message`、`sync`、`notice`。关闭码 1001 服务关闭、1008 刷屏或发送缓冲溢出、4001 会话结束（token 无效、退出登录、每 5 分钟复查）、4002 同一账号超过 4 个连接时最早的一个被替换。反向代理必须转发升级头（见“分布式部署”的 Nginx 示例） |

私聊消息保存 30 天；未处理的好友请求 7 天后自动拒绝，被同意或拒绝的请求卡片 7 天后删除（都由每小时的清理完成）。

### 小屋：成就、徽章与拜访

成就（原版 Career，`dialog2_newCareer`）与徽章由数据服务判定和保存；判定数据 `internal/data/career/careers.json` 由 `rewrite/tools/export-career-data.mjs` 从原版 `etc_/career/newCareer@cn.xml`、`etc_/emblem/emblem@cn.xml` 与计时赛赛道主题导出（`go test ./internal/data/career` 校验版本号，**不要手改**）。全部 1198 条成就都会列出；能统计的类型（经验、注册天数、节日登录、好友数、金币使用与持有、道具图鉴收集、徽章、小屋代表车/代表徽章、计时赛完赛、多人赛按主题与模式的胜利/完赛/未完赛（竞速、无限加速与道具赛：道具赛按 gameType 2 个人 / 4 组队计，6 为道具赛全部，0 包含所有比赛；道具俱乐部赛 8 不会出现）、连续未完赛、按主题累计行驶距离、带回放摄像机的累计行驶距离、复合成就）实时计算进度，其余（会员、情侣、俱乐部、驾照、部件分解等）返回 `untracked:true`，永远停在未完成。行驶距离由游戏节点从运动帧的赛道进度（米）取每名车手本局的最远值（不超过“开赛后秒数×140 m/s + 100 m”，冲线后不再增加），随结算的 `distanceMeters` 上报，数据服务按赛道主题累加（单局最多 200 km；成就的 `clearValue` 单位是 0.1 km）；阵容装备里有回放摄像机（类别 12）时另记一份摄像机距离。前置成就（`preClearCareerId`）未完成时 `locked:true`。完成成就（点击完成）只发成就积分与原版 `rewardEmblemId` 徽章，原版道具奖励不发放。比赛与计时赛结算时在 `account_counters` 累加对应计数；获取 `GET /api/account` 时记录北京日期（节日登录成就）。

| 路径 | 用途与错误 |
| --- | --- |
| `GET /api/careers` | 自己的成就：`{"nickname","owner":true,"points","progress","careers":[{"id","value","state","locked?","untracked?","completedAt?"}],"recent"}`；`state` 为 `playing`/`complete`（可完成）/`rewarded`（完成），`recent` 是最近 5 条完成记录 |
| `POST /api/careers/complete` | `{"careerId"}` → `{"career","point","points","emblem?"}`；400 `INVALID_CAREER`、404 `UNKNOWN_CAREER`、409 `CAREER_NOT_COMPLETE`/`CAREER_ALREADY_COMPLETED` |
| `GET /api/emblems` | 自己的徽章：`{"nickname","owner":true,"emblems":[{"id","acquiredAt"}],"main":[槽0,槽1]}`（0 为空槽） |
| `POST /api/emblems/main` | `{"main":[a,b]}` → 同上；两个都必须已拥有、不重复，第一个槽不能空着而第二个有（原版“前面徽章槽不能为空”）。400 `INVALID_MAIN_EMBLEMS`、409 `EMBLEM_NOT_OWNED` |
| `POST /api/myroom/careers`、`/api/myroom/emblems` | 访客查看：`{"nickname","password?"}` → 与上面相同的结构（`owner:false`）。屋主设置了“车库/徽章/图鉴/成就是否公开”密码时需要密码：403 `PASSWORD_REQUIRED`/`WRONG_PASSWORD`；404 `UNKNOWN_RIDER`；密码尝试每账号每分钟 10 次 |
| `GET /api/dictionary` | 自己的道具图鉴：`{"nickname","owner":true,"version","categories":[{"category","name","items","collected"}],"kartGrades":{"车辆id":引擎等级},"reward":{"category":56,"item":1,"count":1},"total","collected","rewarded","claimable"}`；`items` 为现在显示的道具（原版顺序，未到解禁时间的不列出），`collected` 为其中已收藏的 |
| `POST /api/dictionary/reward` | 领取图鉴奖励：每件新收藏的道具 1 K币，每件只发一次 → `{"items","koin","wallet","dictionary"}`；没有可领的 409 `NOTHING_TO_CLAIM` |
| `POST /api/myroom/dictionary` | 访客浏览图鉴：`{"nickname","password?"}` → 同 `GET /api/dictionary`（`owner:false`，不含 `rewarded`/`claimable`）；密码规则同上 |
| `GET /api/myroom/ws` | 小屋实时拜访的 WebSocket。第一帧 `{"type":"hello","token"}` → `{"type":"welcome","accountId","serverTime"}`。`enter`（不带参数进自己的小屋，`nickname` 进某车手的小屋，`random:true` 随机进入在线车手中未设密码、未满的小屋；`password` 为小屋密码）→ `{"type":"room","room","members","self"}`，错误码 `UNKNOWN_RIDER`/`ALREADY_HERE`/`PASSWORD_REQUIRED`/`WRONG_PASSWORD`/`ROOM_FULL`/`KICKED`（被踢后 5 分钟内）/`CANNOT_ENTER`（被屋主屏蔽）/`RANDOM_FAILED`。`move`（`x,y,z,yaw,moving`，每秒最多 15 次）、`chat`（1–60 字；屋主关闭聊天时访客 `CHAT_DISABLED`，刷屏 `CHAT_FLOOD`）、`kick`（屋主）、`leave`、`ping`。推送 `joined`、`left`、`moved`、`chat`、`settings`（屋主保存档案或代表徽章后）、`member`、`kicked`、`left-room`（同一账号在别的标签页进了小屋）。每个小屋最多 8 人（屋主固定 riderCard0），一个账号同时只在一个小屋；关闭码 4001 会话结束、1008 刷屏或缓冲溢出 |

道具图鉴的道具表 `internal/data/career/dictionary.json` 与成就数据一起由 `export-career-data.mjs` 从原版 `zeta_/cn/content/itemDictionary.xml` 导出（10 类 3684 件，**不要手改**）。账号曾经拥有过的道具都算收藏（库存里过期的租用道具也算，与原版“期限制道具也可以激活道具图鉴”一致）；图鉴类成就（类型 12–23）也只数图鉴里列出的道具。`account_dictionary.rewarded` 记录已发过奖励的件数，领取时在钱包行锁内补发差额并写 `wallet_ledger`（原因 `dictionary`，ref 为领取后的累计件数）。

### 小屋：赛车探险队与开箱

赛车探险队（原版 `racingExpedition`，小屋菜单“探险队”）由数据服务运行；任务表 `internal/data/expedition/expedition.json` 由 `rewrite/tools/export-expedition-data.mjs` 从原版 `zeta_/cn/content/racingExpedition/racingExpeditionMission.xml`（规则、加成表、94 个任务）和 `stock.kml`（奖励道具）导出，**不要手改**。规则：每周四 06:00（北京时间）换一批 10 个任务，优先从账号凑得出的属性里抽（账号同时有该属性的角色和卡丁车），同时发 10 个探险币（34:879，原版在商城卖，本项目改为每周赠送）；进行中和待领奖的任务跨周保留。一个任务派 1–3 组“角色＋卡丁车”和可选的一位好友出发，需至少有一个属性匹配的角色和一辆属性匹配的卡丁车（原版 `expeditionStartCondition`）；同一角色/卡丁车不能同时出两个任务，同一好友每天（06:00 刷新）只能助力一次。任务耗时为原版小时数（难度 1–5：8/16/24/32/40 小时），出发后按服务器时间计时。

角色与卡丁车的属性（都市、世界、大地、森林、海洋、传说、神秘、特殊）原版由服务器决定、客户端数据里没有，本项目按道具类别和 ID 的 FNV 哈希固定分配（`expedition.Specific`）。加成也是本项目对原版常量表的解读：属性匹配的角色奖励 +5%（`bonusConstChar`×`bonusConstCharSpecific1`），卡丁车按车库升级等级查 `kartBodyTuning` 缩短时间（0 级 4.5% … 5 级 27%，随难度递减，合计最多 50%），带四个强化部件的经典升级按部件等级合计查 `reinforcePart` 给基础奖励加点（约为基础奖励的 22%），好友属性匹配奖励 +5%、不匹配 +2.5%。奖励：难度的 `basicReward`（120–500）加部件点数，按任务的 `bonusType` 发经验（×1）、金币（×8）或各一半，再乘奖励加成；另发任务的原版奖励箱（探险队补给箱 ×1–3、红宝石盒、蛋白石盒）。经验与金币写流水（原因 `expedition`，ref 为“周起始:任务号”），不受每日上限限制。

开箱：类别 24 的道具是箱子，开箱表与寻宝/精品道具场共用 `internal/data/lottery/lottery.json`（见下文“抽奖”，由 `rewrite/tools/export-lottery-data.mjs` 导出，**不要手改**；210 种箱子，`lottery.xml` 里另有 4 个不是 24 类道具的不导出）。开一个箱子消耗 1 个，按当时生效的 `rewardList` 引用的奖励集按 `prob` 权重抽一个 stock 发放（`needOther` 需要钥匙、`rpLimit` 需要经验、`retryCount` 抽到已永久拥有的道具时重抽，均按原版）；`box_openings` 以请求 ID 保存结果，重试返回同一结果。可叠加道具（箱子 24、材料 34、56、62、部件碎片 67，以及商城里的计数道具如气球）发放时数量累加；用掉后数量降到 0 但保留记录（图鉴与成就仍记得曾经拥有）。

| 路径 | 用途与错误 |
| --- | --- |
| `GET /api/expedition` | 本周探险队：`{"missions":[{"slot","mission","specific","trackId","theme","bonusType","difficulty","hours","added","state","started","ends","crew","friend","bonus":{"time","reward","points"},"exp","lucci","reward":{"stockId","name","items"},"completeCost"}],"started","limit","added","canAdd","tokens","weekStart","weekEnds","dayEnds","serverTime","rules"}`；`state` 为 `ready`（未开始）、`blocked`（无法进行：凑不出匹配的角色和卡丁车）、`running`、`done`（待领奖）；`rules` 含加成表，供客户端预览 |
| `GET /api/expedition/crew` | 可派出的 `characters`、`karts`（含 `level`、`parts`）与 `friends`（含 `specific`、`usedToday`） |
| `POST /api/expedition/start` | `{"slot","crew":[{"character","kart","kartKey?"}],"friend?"}` → 同 `GET`；400 `INVALID_CREW`，409 `MISSION_STARTED`/`NO_MATCHING_CREW`/`CREW_BUSY`/`FRIEND_USED`/`NOT_FRIEND`，404 `UNKNOWN_MISSION` |
| `POST /api/expedition/tokens` | 探险币：`{"action":"reduce","slot","count"}`（每个缩短 30 分钟）、`complete`（按剩余时间每 30 分钟 1 个，立即完成）、`change`（2 个，换掉未开始的任务）、`add`（3 个，所有任务都已开始后加一个，每周最多 10 个）→ 同 `GET`；409 `ITEM_NOT_ENOUGH`/`MISSION_NOT_IN_PROGRESS`/`MISSION_STARTED`/`CANNOT_ADD_MISSION` |
| `POST /api/expedition/claim` | `{"slot"}` → `{"expedition","exp","lucci","items","inventory","levelUps"}`；409 `MISSION_NOT_COMPLETE` |
| `POST /api/inventory/open` | 开一个箱子：`{"itemId","requestId"}` → `{"box","stockId","rewards":[{"category","itemId","count","days","name"}],"left","items"}`（`items` 为变动后的库存行）；404 `NOT_A_BOX`，409 `ITEM_NOT_ENOUGH`/`LOTTERY_NOT_IN_PERIOD`/`NEED_OTHER_ITEM`/`REQUEST_ID_CONFLICT`，403 `LOTTERY_UNDER_RP_LIMIT` |

小屋设置（环境、名称、代表车、聊天开关、两组密码）仍保存在账号档案 `myRoom` 中；数据服务读取它来判断访客能否进入，响应里只带 `locked`/`etcLocked`，不返回密码。

账号、档案与历史接口的校验规则、错误码与 Java 版一致；密码哈希格式（PBKDF2-SHA256，120000 次）与会话摘要格式也相同，因此旧数据可以直接迁移。

### 抽奖：寻宝活动与精品道具场

寻宝活动（原版 RouletteStage）与精品道具场（原版 GachaUseStage，通用扭蛋）由数据服务抽奖、扣材料、发道具，规则、概率与接口见 [`LOTTERY.md`](LOTTERY.md)。抽奖表 `internal/data/lottery/lottery.json` 由 `rewrite/tools/export-lottery-data.mjs` 从原版 `lottery.xml`、`treasureHunt.xml`、`lotteryMileage.xml`、`stock.kml`、`item.kml` 导出（**不要手改**）。

| 路径 | 说明 |
| --- | --- |
| `GET /api/lottery/treasure-hunt`、`POST /api/lottery/treasure-hunt/draw` | 寻宝面板（格子、保底进度、材料、礼包、每日免费）与抽奖（`count` 1 或 10） |
| `GET /api/lottery/gacha`、`GET /api/lottery/gacha/{itemId}`、`POST /api/lottery/gacha/draw` | 精品道具场的扭蛋列表、单个扭蛋详情与使用（`count` 1–10） |
| `POST /api/lottery/packs/buy` | 按原版价格购买材料礼包（计入商城累计消费） |
| `POST /api/lottery/daily` | 领取当天的免费材料（`treasureHunt` / `gacha`） |
| `GET /api/lottery/items` | 商店目录以外的道具名称 |
| `GET`/`PUT /api/admin/lottery` | 管理员查看与设置活动开关、开放时段、每日免费道具（管理页面“抽奖活动”） |

### 驾照考试（车手学校）

单人游戏的驾照考试（新手、初级、L3、L2、L1、PRO）由数据服务记录通关、发首通奖励、颁发驾照，规则与接口见 [`RIDER_SCHOOL.md`](RIDER_SCHOOL.md)。驾照表 `internal/data/license/license.json` 由 `rewrite/tools/export-license-data.mjs` 从原版 `etc_/riderSchool`（任务表、驾照与奖励、对决对手录像）和 `stock.kml` 导出（**不要手改**）。

| 路径 | 说明 |
| --- | --- |
| `GET /api/license` | 驾照表与账号的驾照状态（已通过的关、当前驾照、PRO 资格与本期任务） |
| `POST /api/license/run` | 提交通过的一关（首通发原版奖励） |
| `POST /api/license/take` | 全部关卡通过后领取驾照（PRO 有效 90 天，每两个月一期可续） |
| `POST /api/license/qualify`、`POST /api/license/emblem` | PRO 资格审核成绩与领取资格徽章 |

### 俱乐部

俱乐部的创建、目录与申请、职位管理、解散、俱乐部基地（总部、赛事中心、车手中心、银行的升级，捐助，每日福利）与会员活跃度由数据服务处理，原版规则与自定数值见 [`CLUB.md`](CLUB.md)。徽章与标志框表 `internal/data/club/club.json` 由 `rewrite/tools/export-club-data.mjs` 从 `etc_/clubMark` 导出（**不要手改**）。

| 路径 | 说明 |
| --- | --- |
| `GET /api/club`、`GET /api/club/list`、`GET /api/club/info/{id}` | 自己的俱乐部与会员、俱乐部目录、单个俱乐部 |
| `POST /api/club/create`、`/apply`、`/apply/cancel`、`/leave`、`/break`、`/break/cancel` | 创建（100,000 金币）、申请、取消申请、退出、解散、取消解散 |
| `GET /api/club/applicants`、`POST /api/club/applicants/decide`、`POST /api/club/members`、`PUT /api/club` | 申请审核、职位变更与踢除、简介与自动加入 |
| `GET /api/club/house`、`POST /api/club/donate`、`/upgrade`、`/name`、`/mark`、`/welfare` | 俱乐部基地、捐助、设施升级、改名、改徽章、领取福利 |

### 任务栏菜单：奖励箱、任务、迷你提示窗、聊天、查找车手

奖励箱（任务奖励、俱乐部福利、管理员赠送，保管 30 天）、每日/每周任务、迷你提示窗（系统提醒与管理员公告）、全服/俱乐部聊天和车手信息由数据服务处理，规则与接口见 [`MENUS.md`](MENUS.md)。管理页面可以发布迷你提示窗公告、向玩家奖励箱赠送道具或货币。

| 路径 | 说明 |
| --- | --- |
| `GET /api/reward-box`、`POST /api/reward-box/claim` | 奖励箱、领取（每次最多 8 条） |
| `GET /api/quests` | 任务与本周期进度 |
| `GET /api/notices` | 迷你提示窗（奖励箱、任务提醒与管理员公告） |
| `GET /api/riders/{nickname}` | 车手信息 |
| `POST /api/admin/reward-box`、`GET`/`PUT /api/admin/notices`、`DELETE /api/admin/notices/{id}` | 管理员赠送、公告管理 |
| WebSocket `chat-join` / `chat` / `chat-leave` | 全部聊天与俱乐部聊天（走 `/api/messenger/ws`） |

### 游戏节点（`:8788` 等）

| 路径 | 用途 |
| --- | --- |
| `GET /multiplayer/healthz` | `{"protocolVersion":39,"ruleset":"launcher-room-v1","transport":"websocket","service":"game","nodeId":"game-1","connections":3,"players":2,"rooms":1,"heapMB":4}`：后四项是当前连接数、已 `hello` 的玩家数、房间数与存活堆（MiB），便于监控 |
| `GET /multiplayer/ws` | WebSocket 控制通道（JSON）与二进制运动帧，协议见 `SERVER_PROTOCOL.md`；无 `Origin` 头或同源/可信 Origin 才接受 |
| `POST /multiplayer/offer` | WebRTC 信令：`{"type":"offer","sdp"}` → `{"type":"answer","sdp"}`（服务端一次给出全部 ICE 候选，不用 trickle）。`KART_WEBRTC=false` 或 UDP 端口不可用时 501 `USE_WEBSOCKET`；连接数、内存与关停的限制同 WebSocket（503）；SDP 不合法 400 `INVALID_OFFER` |

其他路径 404。健康检查另有 `webrtc` 字段，表示本节点是否提供 WebRTC。

#### WebRTC 传输

游戏节点用 [pion/webrtc](https://github.com/pion/webrtc) 实现与浏览器原版客户端相同的两个协商好的数据通道：`control`（id 0，有序可靠）与 `motion`（id 1，无序、`maxRetransmits: 0`）。命令、回复与房间推送走 `control`，与 WebSocket 文本帧完全相同；运动帧走 `motion`：丢包或迟到的帧不会像 TCP 那样挡住后面更新的帧，网络抖动时其他车手的位置更新更及时。限流、`hello`、发送缓冲、空闲超时（90 秒没有消息）与 WebSocket 相同；ICE 断开超过 10 秒或失败即视为掉线。

- 端口：默认每个连接随机一个 UDP 端口；生产环境设 `KART_WEBRTC_UDP_PORT`，所有连接共用这一个 UDP 端口，防火墙放行它即可（TCP 的 HTTP 端口照常经反向代理）。
- 地址：节点在网卡地址上收发 UDP；在 NAT、云主机或容器后面时用 `KART_WEBRTC_PUBLIC_IPS` 写浏览器能访问到的地址（它替换候选地址）。UDP 不经过 Nginx，浏览器直连节点。
- 浏览器在 8 秒内打不开数据通道时自动改用 WebSocket，所以 UDP 被挡的网络照常能玩，只是运动帧回到 TCP。前端可用 `VITE_MULTIPLAYER_TRANSPORT=websocket` 强制只用 WebSocket（`webrtc` 只用 WebRTC，默认 `auto`）。

### 内部 API（`KART_INTERNAL_LISTEN`，只给游戏节点）

全部为 `POST` + JSON，必须带 `X-Kart-Cluster-Key: <KART_CLUSTER_SECRET>`，否则 401 `CLUSTER_KEY_INVALID`。路径与结构定义在 [`internal/shared/contract`](internal/shared/contract/contract.go)。

| 路径 | 调用时机 | 作用 |
| --- | --- | --- |
| `/internal/v1/nodes/heartbeat` | 启动时与每 5 秒 | 注册/刷新节点（TTL 15 秒），续期在线玩家的昵称与账号占用；可选的 `stats`（`heapMB` 保留一位小数、`goroutines`、`connections`、`races`、`version`）与玩家的 `room`（所在房间名）供管理后台显示，玩家的 `accountId` 让数据服务在 Redis 丢失账号映射后补回，旧节点不带也可以（新节点的小数 `heapMB` 旧数据服务无法解析，先升级数据服务）；响应带 `conflicts`（昵称或账号已被其他会话占用、须断开的玩家）与奖励倍率 `expRate`/`lucciRate`（游戏节点据此显示 `race.rewards`） |
| `/internal/v1/nodes/leave` | 优雅关闭 | 删除节点及其全部昵称与账号占用 |
| `/internal/v1/presence/claim` | `hello` | 原子占用昵称与账号（`presence:{昵称}`、`presence-account:{accountId}`，30 秒 TTL，靠心跳续期；两者都能占用才写入）；占用者节点已消失时可抢占；账号已在其他会话在线 409 `ACCOUNT_ONLINE`（先检查账号），昵称冲突 409 `NICKNAME_TAKEN`，游客名非法 400 `INVALID_GUEST_NAME`，账号被封禁 403 `ACCOUNT_BANNED`（游戏节点原样转给 `hello`） |
| `/internal/v1/presence/release` | 连接断开 | 值匹配时释放昵称与账号 |
| `/internal/v1/room-rules` | 建房、改规则（经发件箱） | upsert `room_rules`，旧的更新不覆盖新的 |
| `/internal/v1/races` | 比赛结束（经发件箱） | 一个事务内写 `race_outcomes`、`race_results`，累计 `player_stats`，并为 `rewards` 中有 `accountId` 的车手入账经验与金币（乘倍率：采用结算的 `expRate`/`lucciRate`，须在 [0, max(10, 当前配置)] 内；按收到时的北京时间自然日套每日上限；升级奖励、流水）；超过公式最大值（经验 145/金币 216）的条目丢弃并告警，`finishedAt` 早于 24 小时前的结算只保存不入账；按 `raceId` 幂等，重复提交返回 `{"stored":true,"duplicate":true}` 且不重复累计、不重复入账 |
| `/internal/v1/equipment/verify` | `hello`、`create`、`join`、`equipment` 携带装备时，`ready` 与 `start` 重新核对时（锁外；会话缓存肯定结果到 min(`validUntil`, 10 分钟)，否定结果 10 秒） | `{"accountId","equipment"}` → 200 `{"ok":true,"validUntil"?}`（`validUntil` 为所查租用物品最早到期时间，Unix 毫秒），或 409 `{"error":"ITEM_NOT_OWNED","missing":[{"slot","itemId"}]}`；只核对商店出售的分类与系统车（练习车 `systemKart`） |

## 存储

### MySQL

表由 kart-data 在启动时自动创建与迁移（`schema_migrations` 记录版本），需要 MySQL ≥ 8.0.19。用户名、昵称与比赛名字列使用 `utf8mb4_0900_as_ci`（大小写不敏感、重音敏感，对应 Java 版的 `COLLATE NOCASE`/`equalsIgnoreCase`），ID 列 `ascii_bin`。

| 表 | 内容 |
| --- | --- |
| `accounts`、`sessions`、`invites` | 账号、会话摘要（30 天）、邀请码摘要 |
| `owner_keys`、`profiles`、`records` | 档案密钥摘要、浏览器档案、影子记录 |
| `race_results`、`race_outcomes` | 名次行（含 `account_id`）、每局完整赛程快照 |
| `room_rules` | 房间规则 |
| `player_stats` | 注册账号的累计场次、冠军、领奖台、积分 |
| `account_progress`、`exp_ledger` | 经验与等级、经验流水（原因 `race`/`timeattack`/`admin`） |
| `wallets`、`wallet_ledger` | 三种货币余额（不为负）与流水（原因 `starter`/`race`/`levelup`/`timeattack`/`purchase`/`admin`，`(账号, 原因, 引用, 货币)` 唯一保证幂等） |
| `inventory_items`、`purchases` | 库存（限时物品带到期时间）、购买记录（`(账号, requestId)` 唯一） |
| `account_onboarding`、`account_profiles` | 新手礼包领取记录、账号绑定档案 |
| `timeattack_bests`、`timeattack_runs`、`timeattack_state`、`daily_rewards` | 计时赛个人最佳、已发奖励的计时赛跑次（按 `requestId`；超过每日上限的跑次不写入）、每账号最近一次结算（节奏限制与重试）、每日奖励计数 |
| `admin_grants` | 管理员发放记录（管理员 + `requestId` → 账号、货币、数额），保证 `requestId` 只代表一次发放 |
| `messenger_settings`、`friendships`、`friend_requests`、`account_blocks` | 好友私聊设置（拒绝好友请求、拒绝游戏邀请、隐身）、好友关系（每一方一行，含收藏）、好友请求及其结果、屏蔽 |
| `private_messages`、`private_conversations` | 私聊消息（30 天，按发送者 + `clientId` 去重）、每个账号的会话列表（最后一条、已读位置、未读数、清除标记、隐藏） |
| `account_counters`、`account_login_days` | 成就计数（多人赛按模式与赛道主题的胜利/完赛/未完赛、连续未完赛、计时赛完赛）、登录过的北京日期 |
| `account_careers`、`account_emblems` | 已完成的成就（完成时间）、拥有的徽章（来源、代表徽章槽 `main_slot`） |

`timeattack_runs` 与 `daily_rewards` 只保留 30 天：kart-data 每小时清理一次（与过期会话一起），同时把过期的好友请求改为拒绝、删除过期的请求结果与 30 天前的私聊消息。账号经济表在 schema v2 引入，`admin_grants`、`timeattack_state` 在 v3，好友私聊的表在 v4，小屋成就与徽章的表在 v5，道具图鉴奖励的表在 v6，开箱记录与赛车探险队的表在 v7，抽奖（`lottery_draws`、`lottery_counters`、`lottery_daily`、`lottery_activities`）在 v8，驾照考试（`license_state`、`license_clears`、`license_records`、`license_runs`）在 v9，俱乐部（`clubs`、`club_members`、`club_applications`、`club_leaves`、`club_donations`、`club_welfare`）在 v10，奖励箱、任务与迷你提示窗公告（`reward_box`、`quest_progress`、`notices`）在 v11。kart-data 每小时还会清理 30 天前已领取或过期的奖励箱记录与 14 天前的任务周期。

### Redis 键（前缀 `KART_REDIS_PREFIX`，默认 `kart:`）

| 键 | 内容 | TTL |
| --- | --- | --- |
| `session:{tokenHash}` | 账号 ID | 5 分钟与剩余有效期的较小者；退出时删除 |
| `account:{id}` | 账号 JSON | 10 分钟；改名时删除 |
| `ownerkey:{ownerId}` | 档案密钥摘要 | 1 小时 |
| `profile:{ownerId}` | 档案 JSON | 10 分钟；写入后回填 |
| `record:{ownerId}:{recordId}` | 记录 JSON（≤ 256 KiB 才缓存） | 10 分钟；写入后回填 |
| `history:gen` | 历史缓存代数（写入时 INCR） | 永久 |
| `history:{gen}:…` | 三个历史列表的响应 | 30 秒 |
| `node:{id}`、`nodes`、`node-players:{id}`、`node-accounts:{id}`、`node-epoch:{id}` | 游戏节点注册、节点集合、节点上的在线名、节点上玩家到账号的映射、节点进程的启动时间（节点重启后释放旧进程的占用） | 15 秒 / — / 60 秒 / 60 秒 / 60 秒 |
| `presence:{小写昵称}` | `nodeId\|playerId` | 30 秒 |
| `presence-account:{accountId}` | `nodeId\|playerId`（一个账号同时只有一个在线会话） | 30 秒 |
| `rl:{键}` | 限流计数（`register-ip:{IP 或 IPv6 /64}`、`register-site:{IPv6 /56}`、`register-all`、`login-ip:{IP 或 IPv6 /64}`、`login-fail:{小写用户名}\|{IPv4 /24 或 IPv6 /64}`、`write:{账号}`、`friend-request:{账号}`） | 窗口长度 |

缓存是旁路缓存：先提交 MySQL，再删除或回填 Redis；Redis 出错只记录日志并回退到 MySQL。Redis 的内容都可以重建，清空它最多让在线昵称、在线账号与节点列表在下一次心跳（≤ 5 秒）前缺失。

### 发件箱（outbox）

游戏节点不直接写数据库。房间规则与比赛结算先写进 `KART_OUTBOX_DIR`，每条记录一个文件 `<20 位序号>-<种类>.json`（内容 `{"path":…,"body":…}`，先写临时文件再改名），由单个协程按序号投递到数据服务内部 API：

- 2xx 或 409：投递成功，删除文件；
- 其他 4xx（408、429 除外）：请求本身有问题，移到 `dead/` 子目录并记录错误日志，不阻塞后续记录；
- 网络错误、408、429、5xx：保持顺序，指数退避重试（1 秒起，最长 30 秒）。

写入磁盘后记录内容不再留在内存，轮到发送时才从文件读回，所以数据服务长时间不可用只会占用磁盘。节点启动时扫描目录继续发送；关闭时最多冲刷 5 秒，没发出的留在磁盘，下次启动补发。数据服务按 `raceId` 幂等写入，所以重发不会重复计分。因此：历史接口中的赛果会比比赛结束晚一点出现；**发件箱目录必须放在持久存储上**（compose 中为每个节点一个卷），且每个节点用自己的目录。

## 从旧 SQLite 数据迁移（`kart-migrate-sqlite`）

旧 Java 服务的数据在 `server/data/kart.db`（`KART_DATA_DIR`）。账号密码哈希、会话与档案密钥摘要的格式与 Go 版一致，迁移后玩家可以直接登录，浏览器档案也能继续同步。迁移工具以只读方式打开 SQLite，必要时自行在 MySQL 中建表，并用 `INSERT IGNORE` 逐行写入，因此可以安全地重复运行。

1. 正常停止 Java 服务（正常关闭会把 `kart.db-wal` 合并回 `kart.db`），然后把整个数据目录复制一份作为迁移源与备份（包括可能存在的 `kart.db-wal`、`kart.db-shm`）。
2. 准备目标 MySQL 库（`scripts/init-mysql.sql` 或 compose 中的 `mysql`），迁移期间不要运行 kart-data。
3. 先试运行（读取并校验全部行、检查 MySQL 可达，不写入），再正式迁移：
   ```sh
   cd server-go
   go build -o bin/ ./cmd/kart-migrate-sqlite
   ./bin/kart-migrate-sqlite -sqlite /path/to/copy/kart.db \
     -mysql 'kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci' -dry-run
   ./bin/kart-migrate-sqlite -sqlite /path/to/copy/kart.db \
     -mysql 'kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci'
   ```
   使用 compose 时镜像里也带有该工具，可在 `mysql` 健康后用一次性容器运行（`KART_MYSQL_DSN` 取自 kart-data 的环境）：
   ```sh
   docker compose up -d mysql
   docker compose run --rm --no-deps --user "$(id -u):$(id -g)" -v /path/to/copy:/import kart-data \
     sh -c 'kart-migrate-sqlite -sqlite /import/kart.db -mysql "$KART_MYSQL_DSN"'
   ```
   **迁移源所在目录必须可写**（试运行也一样）：Java 版的 kart.db 是 WAL 模式，SQLite 即使以只读方式打开也要在同一目录创建 `kart.db-shm`，目录只读时报 `attempt to write a readonly database (1544)`。上例用 `--user` 以当前宿主机用户运行这个一次性容器，因此只要你自己能写 `/path/to/copy` 即可；不用 `--user` 时该目录需要对容器内的 UID 10001 可写。直接在宿主机运行时同样需要对目录有写权限。
   `-mysql` 参数中的密码在迁移运行期间会出现在本机的进程列表（`ps`）里。在有其他本地用户的主机上，可以为迁移单独建一个临时 MySQL 账号（对目标库有 `ALL PRIVILEGES`），迁移完成后 `DROP USER`。
4. 启动 kart-data 与游戏节点，用旧账号登录并检查 `/api/race-results` 确认数据已迁移。

## 分布式部署

一个数据服务（连同 MySQL 与 Redis）加任意多个游戏节点，游戏节点可以放在不同机器、不同地区。

**游戏节点**

- 每个节点有自己面向浏览器的地址：`KART_PUBLIC_ORIGIN=https://game1.example.com`（或 `https://example.com:8443` 这样的端口区分）。HTTPS 页面只能连 `wss://`，因此生产环境每个节点都应在 TLS 反向代理之后。
- `KART_NODE_ID` 集群内唯一且保持稳定；`KART_CLUSTER_SECRET`、`KART_DATA_NODE_ID` 与数据服务一致；`KART_DATA_INTERNAL_URL` 指向数据服务内部端口的私网地址。
- 前端页面域名与节点域名不同，属于跨源 WebSocket：节点的 `KART_LAN_HOSTS` 必须包含**页面所在域名**（例如 `kart.example.com`），否则握手被 Origin 校验拒绝。
- 只有一个节点时也可以不单独开域名：`KART_PUBLIC_ORIGIN=same-origin`，由数据服务所在域名的反向代理把 `/multiplayer/ws` 转给该节点（同一域名只能这样代理一个节点）。
- 增加节点：启动新的 kart-game，它在首次心跳后立即出现在列表中。下线节点：发送 SIGTERM，它会关闭连接（1001）、通知数据服务并从列表消失；异常退出的节点 15 秒后消失。节点上的房间在内存中，重启会断开该节点上的玩家，请在低峰期逐个重启。

**数据服务**

- 公网端口放在反向代理之后，并设置 `KART_PUBLIC_ORIGIN=https://kart.example.com` 与 `KART_LAN_HOSTS=kart.example.com`（页面 origin 也要可信才能通过 CORS）。
- **内部端口绝不能暴露到公网。** 让 `KART_INTERNAL_LISTEN` 只监听私网地址（例如 `10.0.0.10:8790`），并用防火墙只放行游戏节点；跨越不可信网络时走 VPN/WireGuard，或在内部端口前加 TLS 代理并让 `KART_DATA_INTERNAL_URL` 使用 `https://`。集群密钥在内部 API 请求头中明文传输。
- MySQL 与 Redis 只需、也只应对数据服务可达：游戏节点不访问它们，而 Redis 中的会话与账号缓存等同登录凭据（能写 Redis 就能冒充任何账号，包括管理员）。用防火墙或网络隔离挡住游戏节点所在的机器，Redis 使用足够长的随机密码。

**时间同步**：房间与比赛时钟都在单个节点内部（单调时钟），节点之间不需要 NTP 级别的同步。只有票据的 2 分钟有效期依赖墙上时钟：保持操作系统默认的自动校时即可，数据服务与游戏节点之间的偏差应远小于 2 分钟，否则会出现 `TICKET_EXPIRED`。

**Nginx 示例**（页面与数据服务在 `kart.example.com`，两个游戏节点各用一个子域名）：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# 前端静态文件 + 数据服务
server {
    listen 443 ssl;
    http2 on;
    server_name kart.example.com;
    ssl_certificate     /etc/ssl/kart/fullchain.pem;
    ssl_certificate_key /etc/ssl/kart/privkey.pem;

    root /srv/kartsim/dist;            # rewrite/ 的 npm run build 产物与游戏资源
    client_max_body_size 8m;

    location ^~ /multiplayer/ {
        proxy_pass http://10.0.0.10:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # 好友私聊的 WebSocket（数据服务）；精确匹配优先于下面的 /api/。
    location = /api/messenger/ws {
        proxy_pass http://10.0.0.10:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # 服务端每 30 秒 ping，超时要大于这个间隔。
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
    location ^~ /api/ {
        proxy_pass http://10.0.0.10:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 游戏节点 1（game2.example.com 同理，指向另一台机器或端口）
server {
    listen 443 ssl;
    http2 on;
    server_name game1.example.com;
    ssl_certificate     /etc/ssl/kart/fullchain.pem;
    ssl_certificate_key /etc/ssl/kart/privkey.pem;

    location = /multiplayer/ws {
        proxy_pass http://10.0.0.21:8788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # 客户端每 10 秒发 clock、服务端每 30 秒 ping，超时要大于这两个间隔。
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
    location = /multiplayer/offer {
        # WebRTC 信令；之后的 UDP 由浏览器直连节点（KART_WEBRTC_UDP_PORT，防火墙放行）。
        proxy_pass http://10.0.0.21:8788;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location = /multiplayer/healthz {
        proxy_pass http://10.0.0.21:8788;
    }
}
```

对应设置：数据服务 `KART_PUBLIC_ORIGIN=https://kart.example.com`、`KART_LAN_HOSTS=kart.example.com`、`KART_TRUSTED_PROXIES=<Nginx 到 kart-data 的来源地址>`（同机时默认的回环地址即可；否则注册与登录限流会把所有玩家算作 Nginx 一个 IP）；游戏节点 1 `KART_PUBLIC_ORIGIN=https://game1.example.com`、`KART_LAN_HOSTS=kart.example.com,game1.example.com`，WebRTC 设 `KART_WEBRTC_UDP_PORT=<固定 UDP 端口>`（防火墙放行该 UDP 端口），节点在 NAT 后面时再设 `KART_WEBRTC_PUBLIC_IPS=<公网 IP>`。数据服务的 location 不要传 `X-Forwarded-Host`，否则 `auth/config` 会按“同源开发代理”返回 `backendOrigin: null`（设置了 `KART_PUBLIC_ORIGIN` 时以它为准）。

## 备份与运维

- **`.env` 权限**：它含集群密钥与全部密码，应为 `600`（`chmod 600 server-go/.env`），只有运维账号可读。
- **MySQL 是唯一需要备份的数据**：
  ```sh
  mysqldump --single-transaction -h127.0.0.1 -uroot -p kartsim > kartsim-$(date +%F).sql
  docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction kartsim' > kartsim.sql
  ```
  在线备份不需要停服。恢复后启动 kart-data 会自动补齐缺少的迁移。
- **Redis** 不需要备份；compose 中的 Redis 不持久化，重启后由心跳与缓存自动重建。
- **发件箱**：正常情况下目录几乎为空。文件长时间堆积说明游戏节点连不上数据服务（检查 `KART_DATA_INTERNAL_URL`、集群密钥与网络）。`dead/` 中的文件是数据服务拒绝的请求，日志里有原因；修复后可把文件移回发件箱目录并重启该节点重新投递。不要删除仍在主目录中的文件，也不要让两个节点共用一个目录。
- **健康检查**：两个服务都有 `GET /multiplayer/healthz`；`GET /multiplayer/game-servers` 可以看到各节点在线人数、房间数与是否满员。
- **更换 MySQL 密码**：`MYSQL_ROOT_PASSWORD` 与 `KART_MYSQL_PASSWORD` 只在 `mysql-data` 数据卷首次初始化时写入 MySQL，之后只改 `.env` 会让 kart-data 因 `Access denied` 反复重启。先在 MySQL 中修改，再改 `.env`：
  ```sh
  docker compose exec mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
  #   mysql> ALTER USER 'kart'@'%' IDENTIFIED BY '<新密码>';
  # 把 .env 中的 KART_MYSQL_PASSWORD 改成新密码，然后：
  docker compose up -d kart-data
  ```
  root 密码同理（`ALTER USER 'root'@'%'` 与 `'root'@'localhost'`，再改 `MYSQL_ROOT_PASSWORD` 并 `docker compose up -d mysql`）。Redis 密码在每次启动时生效，改 `.env` 后 `docker compose up -d` 即可。
- **更换集群密钥**：所有节点需同时换成新值并重启；切换期间心跳和结算投递会失败，结算留在发件箱，恢复后补发；已签发的票据失效，玩家重新进入即可。
- **升级**：先升级数据服务（数据库迁移在启动时于 `GET_LOCK('kartsim_schema')` 下自动执行；它停机的这段时间里结算留在各节点发件箱，昵称占用与票据接口不可用），再逐个重启游戏节点。
- **日志**：slog 文本格式写到 stderr；compose 中每个容器保留 5 × 10 MB。

## 与 Java 版的差异

| 方面 | Java 版（`../server`） | Go 版 |
| --- | --- | --- |
| 进程 | 单进程：HTTP API + WebSocket + SQLite | kart-data（唯一） + kart-game（多个） |
| 存储 | SQLite `server/data/kart.db`（`KART_DATA_DIR`） | MySQL + Redis 缓存；`KART_DATA_DIR` 不再使用，用 `kart-migrate-sqlite` 迁移旧数据 |
| WebSocket | `ws://<数据服务>/multiplayer/ws` | 房间协议在 `<游戏服 origin>/multiplayer/ws`；数据服务上的 WebSocket 只有好友私聊的 `/api/messenger/ws`（新增） |
| 进入大厅 | `hello` 可带会话 `token` | 先取游戏服列表与一次性票据，`hello` 必须带 `ticket`；`token` 被忽略，游戏节点看不到会话 token |
| 昵称唯一 | 单进程内 | 全集群（Redis 在线昵称，心跳续期）；一个账号全集群同时只能有一个会话（`ACCOUNT_ONLINE`） |
| 赛果写入 | 比赛结束时同步写 SQLite | 经发件箱异步投递，按 `raceId` 幂等；历史接口稍后可见 |
| 新增接口 | — | `/multiplayer/game-servers`、`/multiplayer/game-servers/ticket`、`/api/player-stats`，账号经济的 `/api/account*`、`/api/inventory`、`/api/shop/*`、`/api/timeattack/settle`、`/api/admin/*`、`/multiplayer/admin`，以及好友私聊的 `/api/messenger/*` |
| 新增数据 | — | `race_results.account_id`、`player_stats`、等级/钱包/流水/库存/购买等经济表 |
| 注册与游客 | 邀请码注册，首个账号为管理员；可游客进入 | 默认开放注册（注册即登录，按 IP 限流），没有游客；管理员由 `KART_ADMIN_USERNAMES` 指定（`invite` 模式保留 Java 行为） |
| 装备 | 只校验格式 | 账号只能使用库存中未过期的物品（`ITEM_NOT_OWNED`） |
| healthz | `protocolVersion/ruleset/transport` | 另含 `service` 与 `dataNode`/`nodeId` |
| 配置名 | `KART_SERVER_PORT`、`SERVER_ADDRESS`、`KART_LANHOSTS` | `KART_DATA_PORT`、`KART_DATA_ADDR`/`KART_GAME_ADDR`、`KART_LAN_HOSTS`（旧名仍兼容） |

房间命令、校验顺序、错误码、快照字段、计时器与广播对象都逐行移植自 Java 版，前端无需为房间协议做改动。

## 代码导航

| 位置 | 职责 |
| --- | --- |
| `cmd/kart-data`、`cmd/kart-game`、`cmd/kart-migrate-sqlite` | 程序入口 |
| `internal/shared/contract` | 内部 API 路径与 JSON 结构、游戏服列表与票据响应 |
| `internal/shared/ticket` | 票据签名与验签 |
| `internal/shared/netcfg` | 可信主机、CORS、WebSocket Origin 校验 |
| `internal/shared/apierr` | 错误码与 JSON 错误响应 |
| `internal/data/config`、`internal/data/server` | 数据服务配置与组装（MySQL、Redis、两个监听口） |
| `internal/data/store` | MySQL 表结构、迁移与事务 |
| `internal/data/cache` | Redis 旁路缓存、节点注册与在线昵称 |
| `internal/data/api` | 公网 API（含账号经济、好友私聊与嵌入的管理后台 `adminui/`）与内部 API（含装备核对） |
| `internal/data/messenger` | 好友私聊的 WebSocket 连接、在线状态 hub、消息与同步推送、刷屏限制 |
| `internal/data/economy` | 商店目录与等级表（`catalog.json`、`levels.json`，由 `rewrite/tools/export-economy-data.mjs` 生成并 `go:embed`） |
| `internal/shared/rewards` | 联机比赛与计时赛奖励公式、每日上限（游戏节点与数据服务共用） |
| `internal/data/sqlitemigrate` | 旧 SQLite 数据迁移 |
| `internal/game/config`、`internal/game/app` | 游戏节点配置与组装 |
| `internal/game/lobby` | 房间、赛程与特殊模式（移植自 `LobbyService`/`Room`/`GameModes`）；道具赛的房间、赛道与 `item` 请求在 `item_mode.go` |
| `internal/game/itemmode` | 道具赛规则（纯函数，可注入随机源）：名次组、按权重抽取与获得上限、道具槽、目标选择与 `etaMs`、道具锁、透视、刷箱检查、`useId` 与命中记录；第 3 阶段：冻结装备的特性与共享确定性掷骰（`roll.go`）、按车辆的变换与获得表、迅引擎开局道具、49 种特殊道具规则、双发导弹、黄金盾牌、命中后的道具锁、只解除飞碟减速的电磁波、换位/变更卡、赛中金币与结算称号；`itemmode.json` 由 `rewrite/tools/export-item-mode-data.mjs` 生成 |
| `internal/game/ws` | WebSocket 读写协程、请求 ID 回复、运动帧中继 |
| `internal/game/admission` | `hello` 票据校验与 nonce 记忆 |
| `internal/game/cluster` | 心跳、昵称占用与释放 |
| `internal/game/outbox` | 结算发件箱 |
| `scripts/` | MySQL 初始化脚本、开发依赖 compose |
| `test/` | Node 端到端脚本：`smoke.mjs`、`auth-smoke.mjs`、`economy-smoke.mjs`、`frontend-economy-check.mjs`、`run-cluster-smokes.mjs`、道具赛测试机器人 `item-bot.mjs` 与它的检查 `item-bot-check.mjs`，以及 `launcher.test.mjs`（`run-full-local.sh` 的配置检查）；`test/lib/` 为共用客户端（`kart-client.mjs`）、自带集群（`local-cluster.mjs`）、奖励与等级规则（`economy.mjs`）、道具赛脚本共用部分（`item-race.mjs`、`item-bot-lib.mjs`）和 Redis 小客户端 |
