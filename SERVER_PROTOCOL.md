# 本地服务端协议与数据边界

本文件根据本地恢复的浏览器代码整理。标记 **原协议** 的字段来自已下载的前端，并不代表我们拥有原服务端源码；标记 **本地新增** 的接口是为了让本地服务端和本地前端协作而定义。本地服务端是 [`server-go/`](server-go/README.md) 中的 Go 实现：一个数据服务 `kart-data` 加若干游戏节点 `kart-game`；`server/` 中的 Java 版只作为行为参考保留。

## 连接方式

| 类别 | 地址与用途 | 来源 |
| --- | --- | --- |
| 原协议 | `<backendOrigin>/multiplayer/healthz` 等 HTTP 端点 | `rewrite/src/multiplayer/http.ts:82-84` |
| 原协议 | `POST /multiplayer/offer` 交换 WebRTC SDP；`control` DataChannel 是有序 JSON，协商 ID 0；`motion` 是无序二进制，协商 ID 1 | `rewrite/src/multiplayer/client-connect.ts:50-59,147-171` |
| 本地新增 | `GET <backendOrigin>/multiplayer/game-servers` 取在线游戏服列表，`POST <backendOrigin>/multiplayer/game-servers/ticket` 为选中的游戏服申请一次性入场票据 | `server-go/DESIGN.md` §1、§3.2；`server-go/internal/shared/contract` |
| 本地新增 | `<游戏服 origin>/multiplayer/ws`（如 `ws://127.0.0.1:8788/multiplayer/ws`）以 WebSocket 承载相同的 `control` JSON 消息与二进制运动帧；`hello` 必须带账号票据 | 本地实现与前端适配器的约定；原版前端没有这个 WebSocket 入口 |
| 本地新增 | `<backendOrigin>/api/account`、`/api/inventory`、`/api/shop/*`、`/api/timeattack/settle`、`/api/admin/*` 与管理页面 `/multiplayer/admin`：账号经济（等级、三种货币、库存、商店、奖励） | `server-go/ECONOMY.md`；见下文“本地新增：账号经济” |

`backendOrigin` 指**数据服务**（默认 `http://127.0.0.1:8787`）：账号、档案、历史、游戏服列表与票据都走它。实时连接则走玩家选中的游戏节点（默认第一个在 `127.0.0.1:8788`），游戏服列表中 `origin` 为 `null` 的节点经 `backendOrigin` 同源代理（局域网模式与单节点反向代理部署）。前端从 `/multiplayer-config.js` 读取 `backendOrigin`；原配置位于 `mirror/multiplayer-config.js`，本地页面来源须列入 `frontendOrigins`。配置校验见 `rewrite/src/multiplayer/config.ts:16-53`。原版多人入口先校验服务端协议版本，随后处理账号或游客昵称，最后建立实时连接，见 `rewrite/src/multiplayer/lobby-open.ts:76-171`；本地版在昵称确定后、建立连接前插入“选服 + 申请票据”。

## HTTP 接口

以下路径均以 `/multiplayer/` 开头。请求和响应为 JSON，错误响应使用 `{ "error": "错误代码" }`；前端会把非成功响应中的 `error` 作为错误码，见 `rewrite/src/multiplayer/http.ts:110-124`。表中的方法、字段均为**原协议**。

| 方法 | 路径 | 请求 | 成功响应 | 前端证据 |
| --- | --- | --- | --- | --- |
| GET | `healthz` | 无 | `{ "protocolVersion": 39 }`；必须是整数 39 | `rewrite/src/multiplayer/http.ts:126-136` |
| GET | `auth/config` | 可带 Bearer token | `{ "loginRequired": false, "backendOrigin": "http://127.0.0.1:8787" }`（前端在 8780）；只有前后端同源时才可用 `null` | `rewrite/src/multiplayer/http.ts:138-149` |
| POST | `auth/guest-name` | `{ "name": "游客昵称" }` | `{ "available": true }` | `rewrite/src/multiplayer/http.ts:151-160` |
| POST | `auth/register` | `{ "username", "nickname", "password", "invite" }` | `{ "account": { "nickname", "admin"?: boolean } }` | `rewrite/src/multiplayer/http.ts:162-176`；`rewrite/src/generated/multiplayer.js:390-401` |
| POST | `auth/login` | `{ "username", "password" }` | `{ "account": { "nickname" }, "token": "43 字符会话令牌" }` | `rewrite/src/multiplayer/http.ts:167-180` |
| GET | `auth/me` | Bearer token | `{ "account": { "nickname" } }` | `rewrite/src/multiplayer/http.ts:182-184` |
| POST | `auth/nickname` | `{ "nickname" }`，Bearer token | `{ "account": { "nickname" } }` | `rewrite/src/multiplayer/http.ts:186-188` |
| POST | `auth/logout` | `{}`，Bearer token | 成功状态即可 | `rewrite/src/multiplayer/http.ts:190-196` |
| POST | `offer` | `{ "type": "offer", "sdp": "..." }` | `{ "type": "answer", "sdp": "..." }` | `rewrite/src/multiplayer/http.ts:198-207` |
| GET | `ice` | 无 | `{ "iceServers": [...] }`；前端只接受固定 STUN 和 Cloudflare TURN 地址 | `rewrite/src/multiplayer/http.ts:23-65,209-217` |

`/multiplayer/admin` 是管理员界面的链接，不是已观察到的 JSON 调用（`rewrite/src/generated/multiplayer.js:569-572`）；本地数据服务在这个地址提供管理页面（见“本地新增：账号经济”）。原版 `auth/register` 返回账号但前端仍会再调用 `auth/login` 获取令牌；**本地版** `auth/register` 直接返回 `{ "account": {…}, "token": "…" }`（注册即登录），请求体的 `invite` 只在邀请码模式、或注册 `KART_ADMIN_USERNAMES` 中的管理员用户名时需要（任何注册模式下都是，否则 400 `INVALID_INVITE`；开放注册的登录界面把它折叠为可选的“有邀请码？”），密码 8–128 位，按客户端 IP 限流（429 `TOO_MANY_ATTEMPTS`），关闭注册时 403 `REGISTRATION_CLOSED`。`auth/login` 的失败次数按（用户名、客户端网段 IPv4 /24 或 IPv6 /64）计数，其他网段的失败不会锁住该用户名。令牌格式是 43 个 URL 安全字符，存入 `sessionStorage`，键为 `kartsim.multiplayer.session:<backendOrigin>`；账号/信令请求通过 `Authorization: Bearer <token>` 传递（`rewrite/src/multiplayer/http.ts:23,86-107`）。游客模式下 `auth/me` 可返回 `401 {"error":"LOGIN_REQUIRED"}`，前端会转而询问游客昵称（`rewrite/src/generated/multiplayer.js:432-459`）。**本地版不再提供游客模式**（`KART_ALLOW_GUESTS=false` 为默认）：`auth/config` 返回 `{"loginRequired":true,"backendOrigin":…,"registration":"open"|"invite"|"closed","guests":false}`，前端在进入主界面前显示登录/注册界面。

**本地实现差异：**数据服务的 `POST /multiplayer/offer` 返回 `501 USE_LOCAL_WEBSOCKET`，由本地前端适配器改连游戏服的 `/multiplayer/ws`；`GET /multiplayer/ice` 返回空列表（与 Java 版 `server/src/main/java/local/kartsim/server/HttpApi.java:74-80` 相同）。前端适配器见 `rewrite/src/multiplayer/client-websocket.ts:6-17,46-54`。`healthz` 另返回 `"service":"data"` 与 `dataNode`；游戏节点自己的 `healthz` 返回 `"service":"game"` 与 `nodeId`。

### 本地新增：游戏服列表与入场票据

| 方法 | 路径 | 请求 | 成功响应 | 错误 |
| --- | --- | --- | --- | --- |
| GET | `game-servers` | 无 | `{"dataNode":"data-1","servers":[{"nodeId":"game-1","name":"游戏服 1","origin":"http://127.0.0.1:8788","players":3,"rooms":1,"capacity":400,"full":false}]}`；只含存活节点，按 `name` 排序；`origin` 为 `null` 表示经 `backendOrigin` 同源连接 | — |
| POST | `game-servers/ticket` | `{"nodeId":"game-1"}`，带 `Authorization: Bearer <token>` | `{"ticket":"kt1.…","nodeId":"game-1","origin":"http://127.0.0.1:8788","dataNode":"data-1","expiresAt":1760000000000}` | `401 LOGIN_REQUIRED`（没带 Bearer 且未开启游客，或 Bearer 无效）、`403 ONBOARDING_REQUIRED`（账号还没领取新手礼包）、`404 GAME_SERVER_NOT_FOUND`、`503 GAME_SERVER_FULL`、`503 DATA_SERVICE_UNAVAILABLE` |

票据是 `kt1.<base64url(JSON 声明)>.<base64url(HMAC-SHA256)>`，2 分钟内有效、只能使用一次，绑定目标游戏节点与数据节点；带 Bearer 时是账号票据（含账号 ID、用户名、昵称、管理员标记）。只有部署开启 `KART_ALLOW_GUESTS=true` 时，不带 Bearer 才会得到游客票据。浏览器不需要解析票据内容，原样放进 `hello` 即可。**每次连接尝试都要重新申请**（包括 `NICKNAME_TAKEN` 后换名重试）。会话 token 只发给数据服务，不再发给游戏服。

`auth/guest-name` 的 `available` 在本地版中还要求该名字当前不在任何游戏服在线。另有只读统计 `GET /api/player-stats?name=<昵称>`，见文末存储接口。

## 实时 JSON 消息

以下消息名称和字段均为**原协议**，只把传输换成了本地新增的 WebSocket。每个客户端请求带字符串 `requestId`；服务端的对应答复必须回显同一 ID。前端等待响应最多 10 秒，且最多保留 32 个未完成请求（`rewrite/src/multiplayer/client-control.ts:54-83`）。服务端还可发送无 `requestId` 的房间广播。

### 握手与时钟

```json
{"type":"hello","requestId":"1","protocolVersion":39,"ruleset":"launcher-room-v1","resourceVersion":"p3553","name":"Alice","equipment":{"itemIds":{"1":2,"2":6,"3":0,"70":4,"4":0,"…":0},"kartSerial":0,"valueAt3E":0,"exceedType":0,"systemKart":"practiceKart"},"initial":"","raceRuntime":true,"ticket":"kt1.…"}
```

回复须为 `{ "type":"welcome", "requestId":"1", "playerId":"...", "protocolVersion":39, "ruleset":"launcher-room-v1", "capabilities":[] }`。`playerId` 长度 1–64；若没有 P2P 运动转发能力，请返回空 `capabilities`，前端才不会额外启动 P2P ICE/信令流程。字段来源：`rewrite/src/multiplayer/client-connect.ts:168-199` 和 `rewrite/src/multiplayer/server-events.ts:54-58`。

**本地新增 `ticket`：**游戏节点先按原顺序校验协议版本、规则集、资源版本与 `name`，然后要求字符串 `ticket`，依次检查：缺失 `TICKET_REQUIRED`；格式或签名错误 `TICKET_INVALID`；过期 `TICKET_EXPIRED`；签给其他节点 `TICKET_WRONG_NODE`；来自其他数据服务 `DATA_NODE_MISMATCH`；已用过 `TICKET_REUSED`；游客票据而节点未开启 `KART_ALLOW_GUESTS` 时 `LOGIN_REQUIRED`（默认如此，`hello` 实际上要求账号票据）。账号票据使用其中的昵称并忽略 `name`（开启游客时游客使用请求中的 `name`）。`hello` 携带的 `equipment` 会向数据服务核对归属：账号不拥有或已过期时返回 403 `ITEM_NOT_OWNED`（不占用昵称；浏览器重读库存、换回新手装备后用新票据重试），数据服务不可达时 `DATA_SERVICE_UNAVAILABLE`。昵称在本节点内不区分大小写去重（`NICKNAME_TAKEN`），本节点上同一账号已有会话时 `ACCOUNT_ONLINE`（同一账号在同一节点重复进入时昵称相同，通常先得到 `NICKNAME_TAKEN`）；这两项在核对装备之前。核对通过后由数据服务在全集群占用昵称与账号：账号已在其他节点在线 `ACCOUNT_ONLINE`（先于昵称检查，所以跨节点重复进入得到它），昵称冲突 `NICKNAME_TAKEN`，数据服务不可达 `DATA_SERVICE_UNAVAILABLE`。一个账号全集群同时只能有一个会话。本节点满员 `SERVER_FULL`、内存紧张 `SERVER_BUSY`（这两项在校验票据之前返回，不消耗票据），节点正在关闭 `SERVER_SHUTTING_DOWN`。Java 版的 `token` 字段不再使用（出现也被忽略）。断开连接时释放昵称与账号占用。连接后 15 秒内（`KART_HELLO_TIMEOUT`）未完成 `hello` 的连接以 1008 关闭；待发送数据积压超过 `KART_SEND_BUFFER_BYTES` 的连接同样以 1008 关闭。节点房间数达到 `KART_MAX_ROOMS` 时 `create` 返回 `ROOM_LIMIT_REACHED`。

`clock` 请求携带非负有限数 `clientTick`，回复携带原值和非负有限数 `serverTick`：

```json
{"type":"clock","requestId":"2","clientTick":123.5}
{"type":"clock","requestId":"2","clientTick":123.5,"serverTick":456.7}
```

连接时会连续校时三次，以后每 10 秒发一次；比赛的 `startAt` 等时刻必须使用与 `serverTick` 相同的服务端单调时钟基准（`rewrite/src/multiplayer/client-connect.ts:206-214`；`rewrite/src/multiplayer/race-start-coordinator.ts:129-157`）。本地服务端的 `serverTick` 是所连游戏节点进程启动以来的单调毫秒；同一房间的玩家都在同一节点上，所以不需要跨节点对时。

### 大厅与房间

| 客户端请求类型 | 必要/常见字段 | 对应结果与说明 | 来源 |
| --- | --- | --- | --- |
| `list-ordinary` / `list-gameplay` | `page`；后者另有 `gameplay` | `rooms`：`page,total,rooms`，每页最多 10 项 | `rewrite/src/multiplayer/lobby-actions.ts:83-125` |
| `create` | `name,capacity,password,channelName,mode,speed,speedVersion`，普通模式含 `gameplay:"ordinary"` | `room`；建房表单本身不发送赛道，服务端须设定有效默认赛道 | `rewrite/src/multiplayer/lobby-settings.ts:101-123`；`rewrite/src/generated/multiplayer.js:3264-3278` |
| `join` | `roomId,password` | `room`；已锁房间先让用户填密码 | `rewrite/src/multiplayer/lobby-actions.ts:208-220` |
| `leave` | `roomId,revision` | `left` 或新房间状态 | `rewrite/src/multiplayer/lobby-actions.ts:128-155` |
| `ready` / `start` | `roomId,revision,ready?` | 更新后的 `room`；开始时进入 `loading` | `rewrite/src/multiplayer/lobby-room-view.ts:77-89` |
| `team` / `slot` / `kick` / `kick-vote` / `transfer-host` | `roomId,revision` 与各自目标字段 | 更新后的 `room` | `rewrite/src/multiplayer/lobby-actions.ts:229-237`；`rewrite/src/multiplayer/lobby-room-view.ts:99-116`；`rewrite/src/multiplayer/lobby-dialogs.ts:149-154` |
| `track` / `random-track` | `roomId,revision,trackId` 或 `randomTrackCode` | 更新后的 `room` | `rewrite/src/multiplayer/lobby-track.ts:164-170` |
| `equipment` / `changing` | `roomId,equipment` 或 `roomId,changing` | 更新后的 `room`；**本地新增**：装备含账号不拥有的物品时 `ITEM_NOT_OWNED` | `rewrite/src/multiplayer/lobby-garage.ts:79,115-117` |
| `get-room-settings` / `room-settings` | `roomId`；更新另带 `revision,name,password` | `room-settings` 或 `room` | `rewrite/src/multiplayer/lobby-settings.ts:45-65`；`rewrite/src/multiplayer/lobby-actions.ts:240-253` |
| `chat` | `roomId,text` | `chat` 事件，内容带 `sequence,playerId,name,text` | `rewrite/src/multiplayer/lobby-actions.ts:195-205`；`rewrite/src/multiplayer/server-events.ts:22-25,94-95` |

客户端还发送 `loaded`、`load-failed`、`finish`、`return-room`、`race-chat`、`team-charge`、`giant-state`、`award-motion`、`latency-reply`，高级 P2P 模式还会发送 `p2p-signal` / `p2p-relay`（`rewrite/src/multiplayer/race-start-coordinator.ts:157-172`；`rewrite/src/multiplayer/race-session.ts:134-200`；`rewrite/src/multiplayer/peer-mesh.ts:205,427`）。服务端可发出的已观察事件类型集合见 `rewrite/src/multiplayer/protocol.ts:76-81`，字段校验见 `rewrite/src/multiplayer/server-events.ts:36-127`。不认识的请求要回 `{"type":"error","requestId":"原请求 ID","code":"错误码"}`，避免客户端一直等待。

**本地新增：装备归属。**账号只能使用库存中未过期的物品。`create`、`join`、`equipment` 携带的 `equipment` 由游戏节点在不持有大厅锁时向数据服务核对（`/internal/v1/equipment/verify`）：含不拥有的物品时回复 `{"type":"error","code":"ITEM_NOT_OWNED"}`，命令不生效（按 Java 校验顺序在应用装备处返回）；数据服务不可达时 `DATA_SERVICE_UNAVAILABLE`。`ready`（`ready:true`）核对发送者自己的装备；`start` 重新核对缓存已过期的所有成员，不拥有者被取消准备（房间广播新的 `revision`）且 `start` 返回 `ITEM_NOT_OWNED`；`start` 时同一账号占两个座位返回 `ACCOUNT_ONLINE`。每个会话缓存核对结果：肯定结果用到 min(`validUntil`, 核对后 10 分钟)，否定结果 10 秒。需要核对的命令每个连接每秒 2 次（突发 10），超出回复 429 `RATE_LIMITED`；全节点同时最多 32 个核对，超出 `DATA_SERVICE_UNAVAILABLE`。此外每个连接的文本命令有通用限流（每秒 30 次、突发 60；`create`/`track`/`random-track`/`room-settings` 另限每秒 5 次、突发 20），超出同样回复 `RATE_LIMITED`，持续超出的连接以 1008 关闭。只核对商店出售的分类（角色、喷漆、卡丁车、宠物、气球、头饰……）与系统车：`itemIds[3]` 为 0 时由 `systemKart` 指明系统车，新手礼包的练习车是 `systemKart:"practiceKart"`；改装部件、涂装等其他槽位不核对。新账号的装备就是新手礼包：角色 `itemIds[1]` 为 2 或 3，喷漆 `itemIds[2]` 与染色 `itemIds[70]` 为 6/4/5/7 之一，`itemIds[3]=0` 加 `systemKart:"practiceKart"`。

### 房间状态边界

原前端会严格校验 `room`。一个可接受的普通房间至少包含：

```json
{
  "roomId":"UUID 或非空 ID",
  "revision":1,
  "name":"房间名",
  "mode":"individual",
  "capacity":2,
  "speedVersion":"国服",
  "channelName":"speedIndiCombine",
  "speed":7,
  "gameplay":"ordinary",
  "resourceVersion":"p3553",
  "hostId":"玩家 ID",
  "phase":"open",
  "trackId":"village_R01",
  "members":[{"playerId":"玩家 ID","name":"Alice","slot":0,"ready":false,"team":null}]
}
```

**本地新增 `race.rewards`：**比赛有结果后（`finished` 阶段），快照的 `race` 末尾多一个字段 `rewards`，即 `{ "<playerId>": { "exp": 88, "lucci": 120 } }`，每位载入完成的车手一项，所有玩法都有（挡人模式没有名次结果，也按 `server-go/ECONOMY.md` 2.1 的规则折算）；`race.results` 保持原样。数值已乘数据服务的奖励倍率 `KART_EXP_RATE`/`KART_LUCCI_RATE`（游戏节点从心跳响应得到，用与入账相同的 `rewards.ApplyRate` 换算），结算发给数据服务的是倍率前的基础值（另带显示时用的倍率）；数据服务乘倍率、按收到结算时的北京时间自然日套每日上限后入账（按 `raceId` 与账号幂等；完成时间早于 24 小时前的结算不发奖励），实际入账以 `GET /api/account` 为准。防刷规则只影响 `rewards`：服务器观察到的比赛时长（`finish` 到达时间 − `startAt`）不足 10 秒，或客户端 `elapsedMs` 比它短 3 秒以上的完赛按未完赛计奖；挡人模式开跑 10 秒内结束时所有人按未完赛，中途离开房间的车手没有奖励项（名次赛中完赛后才离开的照常有）；组队平局时双方都没有胜方加成（`winningTeam` 仍按原样输出）。例如倍率为 1 时两人 `speedIndiCombine` 个人赛：第 1 名经验 88、金币 120，第 2 名经验 33、金币 40；经验倍率 1.5、金币倍率 2 时第 1 名显示经验 132、金币 240。

`revision` 从 1 开始，每次状态更新递增；客户端会丢弃旧版本和自己已离开的房间（`rewrite/src/multiplayer/room-state.ts:20-45`）。频道决定模式和速度：`speedIndiCombine` / `speedTeamCombine` 是速度 7，`speedIndiInfinit` / `speedTeamInfinit` 是速度 4（`rewrite/src/multiplayer/room-validation.ts:111-116`）。房间必须有 `trackId` 或 p3553 的 `randomTrackCode`；人数 2–8，成员 ID 与槽位唯一、房主必须在成员中。装备若出现必须满足完整 34 个分类和数值范围；比赛的 `roster` 每人必须有有效装备（`rewrite/src/multiplayer/room-validation.ts:193-225,344-408`）。房间阶段为 `open → loading → countdown/racing → finished`，非 `open` 阶段必须附有效 `race`。**与 Java 不同：**比赛中（`loading`/`countdown`/`racing`）有车手离开房间时不再取消整局，其他车手继续比赛、跑完为止；离开者从 `members` 消失但仍在 `roster` 中，已载入的在 `results` 中按未完赛排在最后，服务端不再等它载入或完赛；浏览器把它标为退出、隐藏它的赛车并取消碰撞。只有挡人模式载入阶段跑者离开（或已凑不齐 5 名载入车手）、或所有车手都离开时才取消（`raceError: "MEMBER_LEFT"`）。同样，`load-failed` 与载入超时只把该车手移出本局（从 `loadedIds` 删除，留在房间等下一局，之后的比赛命令返回 `NOT_RACE_PARTICIPANT`），其他人载入完即开赛；只有本局无法开始时才取消（`LOAD_FAILED`/`LOAD_TIMEOUT`）。`loading` 之后不在 `loadedIds` 中的 `roster` 车手即已被移出。详见 `server-go/DESIGN.md` 4.3。具体赛果字段、结束时限与团队得分约束见 `rewrite/src/multiplayer/room-validation.ts:305-341`。

真实比赛装载器还要求 `race.startSlots`：键必须恰好覆盖 `race.roster` 中的每个 `playerId`，值是互不重复的 0–7 整数起跑位。这个条件目前没有包含在 `room-validation.ts` 的静态校验里，但缺失会使浏览器在载入赛道时返回“本局缺少完整起跑位表”（`recovered/formatted/index.js:77081-77100`）。本地端到端脚本会单独检查它。

`rooms` 列表中的每个摘要必须含 `roomId,name,mode,capacity,speedVersion,channelName,speed,gameplay,resourceVersion,count,locked`，以及 `trackId` 或 `randomTrackCode`；额外的 `gaming` 可帮助前端判断是否可快速加入（`rewrite/src/multiplayer/server-events.ts:107-124`）。

### 本地特殊玩法

模式规则、房间与赛程在 `server-go/internal/game/lobby`，逐行移植自 Java 版 `server/src/main/java/local/kartsim/server/GameModes.java` 与 `LobbyService.java`。每个服务端快照都必须通过 `rewrite/src/multiplayer/room-validation.ts`：

所有模式的结束快照都带 `race.rewards`，奖励随结算入账。

| 模式 | 房间与比赛约束 | 赛后数据 |
| --- | --- | --- |
| 挡人 `roadblock` | 至少五人、个人标准速度、固定随机赛道；房主为跑者，三分钟限时，跑者完赛或退出会产生专属结果 | `roadblockOutcome` 和完整赛程写入 `race_outcomes`；无普通名次列表 |
| 巨人 `giant` | 个人标准速度、限定赛道；`giant-state` 按玩家序号和增长状态校验后广播 | 名次与完整赛程分别写入 `race_results`、`race_outcomes` |
| RP `rp` | 每人收到冻结的赛车抽选；目前奖池为已确认可加载的赛车 387、390、378、361，飞宠为 0 | 同上 |
| LTE `lte` | p3553、标准速度、三张专用赛道；本地前端启用 Web 试玩入口和 Z/X 躲闪 | 同上；自动补氮气、香蕉事件尚未完整实现 |

赛后数据由游戏节点经本地发件箱异步提交给数据服务，按 `raceId` 幂等写入 MySQL，因此历史接口会在比赛结束后稍晚一点出现该局。可运行 `node server-special-smoke.mjs` 让真实前端校验器检查四种模式的双端协议、赛程、巨人广播、`race.rewards`、回房以及结算是否到达数据服务。脚本会注册五个测试账号（每个账号带自己的 `X-Forwarded-For`，数据服务须信任运行脚本的地址，见 `server-go/README.md`“测试”），并写入所连集群的 MySQL；请对测试部署运行。

## 本地新增：账号经济

原版下载物没有服务端经济实现；以下接口全部是**本地新增**，权威约定见 [`server-go/ECONOMY.md`](server-go/ECONOMY.md) 第 6、8 节，部署与管理见 [`server-go/README.md`](server-go/README.md)“账号经济”。都在数据服务（`backendOrigin`）上，JSON 请求与响应，错误体 `{"error":"代码"}`；除商店目录外都要 `Authorization: Bearer <token>`，未登录 `401 LOGIN_REQUIRED`；写接口按账号限流 `429 TOO_MANY_ATTEMPTS`。余额、库存与等级只以数据服务为准。

| 方法 | 路径 | 请求 | 成功响应 | 错误 |
| --- | --- | --- | --- | --- |
| GET | `/api/account` | — | `{"account":{"username","nickname","admin","createdAt"},"progress":{"level","exp","levelExp","nextLevelExp"(满级为 null),"glove","gloveName","maxLevel"},"wallet":{"coupon","lucci","koin"},"stats":{"races","wins","podiums","points"},"onboarded"}` | — |
| POST | `/api/account/starter` | `{"character":2或3,"paint":6/4/5/7,"dye":6/4/5/7}` | 账号摘要（同 `/api/account`）；发放练习车、角色、喷漆、染色（永久）并写入新手装备，只发一次，重复调用照常返回摘要 | `400 INVALID_STARTER` |
| GET | `/api/inventory` | — | `{"items":[{"category","itemId","systemKey"?,"quantity","expiresAt"(null 为永久),"source"}],"serverTime"}`，不含已过期物品 | — |
| GET / PUT | `/api/account/profile` | PUT：档案 JSON 对象（收藏、小屋、车库改装、`equipment`） | 档案原文；GET 时不再拥有的装备换成新手装备 | GET `404 PROFILE_NOT_FOUND`；PUT `409 {"error":"ITEM_NOT_OWNED","missing":[{"slot","itemId"}]}`、`400 INVALID_EQUIPMENT` |
| GET | `/api/shop/catalog` | 可带 `If-None-Match`（不需要登录） | 商店目录（`version`、`currencies`、`tabs`、`starter`、`items[].offers[]`），`ETag` 为版本，命中 `304`，支持 gzip | — |
| POST | `/api/shop/purchase` | `{"offerId":"s5177","requestId":"<UUID>","expectedPrice":95,"expectedCurrency":"coupon"}`（后两项可选，为商店显示的价格与货币；浏览器每个购买对话框一个 `requestId`，对话框内重试复用） | `{"wallet":{…},"item":{库存项},"purchaseId"}`；同一 `requestId` 重放返回原结果 | `404 OFFER_NOT_FOUND`、`409 PRICE_CHANGED`（与当前报价不符，不扣款）、`409 INSUFFICIENT_FUNDS`、`409 ALREADY_OWNED`、`403 EXP_REQUIRED`、`409 REQUEST_ID_CONFLICT`（同一 `requestId` 换了 `offerId`）、`409 QUANTITY_LIMIT`、`400 INVALID_REQUEST_ID` |
| POST | `/api/timeattack/settle` | `{"trackId":"village_R01","elapsedMs":60000,"requestId":"<UUID>"}` | `{"exp","lucci","newRecord","capped","bestMs","levelUps","summary"}`；每次 经验 10/金币 20，刷新个人最佳再加 20/50，每日 50 次有奖励；同一 `requestId` 重放返回原结果 | `400 INVALID_ELAPSED_MS`（小于 10 秒等）、`400 INVALID_TRACK`（不在 `server-go/internal/data/economy/tracks.json` 的 368 条赛道中）、`429 TOO_MANY_ATTEMPTS`（距上一次结算不足 10 秒或不足 `elapsedMs` − 3 秒）、`409 REQUEST_ID_CONFLICT`（同一 `requestId` 换了 `trackId` 或 `elapsedMs`）、`400 INVALID_REQUEST_ID`；浏览器把 `TOO_MANY_ATTEMPTS`、`INVALID_TRACK` 静默当作本局无奖励 |
| GET | `/multiplayer/admin` | — | 管理页面（HTML） | — |
| GET | `/api/admin/accounts?q=` | — | `{"accounts":[{"id","username","nickname","admin","createdAt","level","exp","wallet","inventoryCount","onboarded"}]}` | `403 ADMIN_REQUIRED` |
| POST | `/api/admin/grant` | `{"username","currency":"coupon"/"lucci"/"koin"/"exp","amount"(负数为扣除),"note","requestId"?}` | `{"applied","levelUps","duplicate","requestId","account"}`；同一 `requestId` 以相同账号、货币、数额重放返回 `duplicate:true`，不重复发放 | `403 ADMIN_REQUIRED`、`404 ACCOUNT_NOT_FOUND`、`400 INVALID_GRANT`、`400 INVALID_NOTE`、`400 INVALID_REQUEST_ID`、`409 INSUFFICIENT_FUNDS`、`409 INSUFFICIENT_EXP`、`409 BALANCE_LIMIT`、`409 REQUEST_ID_CONFLICT`（同一 `requestId` 换了账号、货币或数额） |

联机比赛的奖励不需要客户端调用接口：游戏节点在结束快照中给出 `race.rewards`（见“房间状态边界”），结算经发件箱送达数据服务后入账；客户端随后 `GET /api/account` 刷新余额与等级。

## 运动数据

**原协议** 的比赛运动数据不是 JSON。服务端 `motion` 通道帧为 56 字节头加 80–178 字节载荷；小端魔数为 `19277`，头中有载荷类型、接收者掩码、房间/比赛/玩家 UUID 和 32 位序号（`rewrite/src/multiplayer/motion.ts:1-74`）。本地 WebSocket 若要支持多人车体同步，需定义二进制帧映射或单独的运动通道；仅完成 JSON 房间协议只能进入大厅和房间，不能保证多人比赛画面同步。这一边界与单人计时赛无关。本地游戏节点在同一条 WebSocket 上接收二进制帧，按 56 字节头中的房间、比赛、玩家 ID 与接收者掩码校验后，只转发给同一节点上同一房间、已载入的其他车手（与 Java 版 `relayMotion` 一致）；运动帧从不经过数据服务。

## 数据存储事实与本地新增方案

原版下载物没有服务端实现。当前单人档案写在浏览器 `localStorage` 的 `kartrider-web:p3528:user-profile-v2`，结构含 `equipment,initial,favoriteTracks,favoriteItems,garage`（`rewrite/src/ui/local-profile.ts:1-39,172-212`）；本地昵称另存 `kartsim.local-nickname`（`rewrite/src/generated/multiplayer.js:621-635`）。计时赛摘要在 `kartrider-web:p3553:time-attack-records-v1`，旧版键是 p3528；Ghost 完整帧保存在 IndexedDB（`rewrite/src/game/ghost-records.ts:22-23,71-99`；`rewrite/src/game/ghost/record-store.ts:156-211`）。约 3.49 GiB 的游戏资源容器由静态服务提供并在浏览器 OPFS 缓存，不属于账号数据库（`rewrite/src/resources/container-store.ts:71-123`）。

**本地新增** 的服务端持久化记录账号、会话、个人资料、房间规则和比赛结果。原前端不会自动访问新的资料或记录接口；前端适配器必须显式读取、写入并处理版本冲突。房间的实时内存状态和持久化历史是分开的：房间只存在于所在游戏节点的内存中，节点重启后房间不恢复；账号、资料与成绩由数据服务写入 MySQL，任一进程重启都可恢复。具体新增 REST 路径以本地实现为准；不要把它们误认为原站已有接口。

数据服务定义了这些**本地新增**存储路径（与 Java 版 `server/src/main/java/local/kartsim/server/StorageApi.java:23-139`、`HistoryApi.java` 行为一致，`player-stats` 为 Go 版新增）：

| 方法 | 路径 | 内容 |
| --- | --- | --- |
| GET / PUT | `/api/profile/{ownerId}` | 读取或保存完整资料 JSON；读取不存在时返回 404 |
| GET | `/api/records/{ownerId}` | 列出该所有者的记录摘要，含 `recordId,record,updatedAt` |
| GET / PUT | `/api/records/{ownerId}/{recordId}` | 读取或保存单条记录 JSON；读取不存在时返回 404 |
| GET | `/api/race-results?name=` | 最近 100 条多人比赛名次 `roomId,raceId,playerId,name,rank,elapsedMs,points,createdAt` |
| GET | `/api/race-outcomes?gameplay=` | 最近 100 局完整赛程 `raceId,roomId,gameplay,trackId,snapshot,createdAt` |
| GET | `/api/room-rules` | 最近 100 份房间规则 `roomId,settings,updatedAt` |
| GET | `/api/player-stats?name=` | 注册账号累计统计 `nickname,races,wins,podiums,points,updatedAt`；没有时 404 `PLAYER_NOT_FOUND` |

`ownerId` 必须是 UUID，`recordId` 只接受 1–100 位字母、数字、下划线和短横线。所有资料/记录请求带 `X-Profile-Key`：首次 PUT 绑定该所有者的 43 字符密钥，之后读写需要同一密钥。前端将稳定 `ownerId` 和密钥保存在本机（`rewrite/src/ui/profile-sync.ts:4-38,52-55`）。游客每次联机握手可能分配新的 `playerId`，不能把它当持久资料 ID。原 Ghost 记录键含 NUL 分隔符（`rewrite/src/game/ghost-records.ts:25-33`），写入新接口前应使用稳定的 URL 安全编码或摘要。当前前端只同步 Ghost **摘要**，完整回放帧仍在浏览器 IndexedDB，见 `rewrite/src/game/ghost-summary-sync.ts:15-36`。数据服务把这些数据保存在 MySQL，热点读取经 Redis 缓存；表结构、Redis 键与旧 SQLite（`server/data/kart.db`）迁移方法见 [`server-go/README.md`](server-go/README.md)。
