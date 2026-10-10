# 本地服务端协议与数据边界

本文件根据本地恢复的浏览器代码整理。标记 **原协议** 的字段来自已下载的前端，并不代表我们拥有原服务端源码；标记 **本地新增** 的接口是为了让本地服务端和本地前端协作而定义。本地服务端是 [`server-go/`](server-go/README.md) 中的 Go 实现：一个数据服务 `kart-data` 加若干游戏节点 `kart-game`；`server/` 中的 Java 版只作为行为参考保留。

## 连接方式

| 类别 | 地址与用途 | 来源 |
| --- | --- | --- |
| 原协议 | `<backendOrigin>/multiplayer/healthz` 等 HTTP 端点 | `client/src/multiplayer/http.ts:82-84` |
| 原协议 | `POST /multiplayer/offer` 交换 WebRTC SDP；`control` DataChannel 是有序 JSON，协商 ID 0；`motion` 是无序二进制，协商 ID 1 | `client/src/multiplayer/client-connect.ts:50-59,147-171` |
| 本地新增 | `GET <backendOrigin>/multiplayer/game-servers` 取在线游戏服列表，`POST <backendOrigin>/multiplayer/game-servers/ticket` 为选中的游戏服申请一次性入场票据 | `server-go/DESIGN.md` §1、§3.2；`server-go/internal/shared/contract` |
| 本地新增 | `<游戏服 origin>/multiplayer/ws`（如 `ws://127.0.0.1:8788/multiplayer/ws`）以 WebSocket 承载相同的 `control` JSON 消息与二进制运动帧；`hello` 必须带账号票据 | 本地实现与前端适配器的约定；原版前端没有这个 WebSocket 入口 |
| 本地新增 | `<backendOrigin>/api/account`、`/api/inventory`、`/api/shop/*`、`/api/timeattack/settle`、`/api/admin/*` 与管理页面 `/multiplayer/admin`：账号经济（等级、三种货币、库存、商店、奖励） | `server-go/ECONOMY.md`；见下文“本地新增：账号经济” |

**本地新增：WebSocket 压缩。**游戏节点的 `/multiplayer/ws` 与数据服务的 `/api/messenger/ws`、`/api/myroom/ws` 在浏览器提供时协商 `permessage-deflate`（RFC 7692，双方都不保留上下文）。服务端只压缩 512 字节及以上的 JSON 文本（房间快照约压到 1/5），二进制运动帧与短消息照常发送；浏览器自行决定是否压缩上行消息，服务端按解压后的大小检查单条上限。压缩由浏览器透明处理，消息内容与前端代码都不变；WebRTC 数据通道不压缩。部署可用 `KART_WS_COMPRESSION=false` 关闭。

`backendOrigin` 指**数据服务**（默认 `http://127.0.0.1:8787`）：账号、档案、历史、游戏服列表与票据都走它。实时连接则走玩家选中的游戏节点（默认第一个在 `127.0.0.1:8788`），游戏服列表中 `origin` 为 `null` 的节点经 `backendOrigin` 同源代理（局域网模式与单节点反向代理部署）。前端从 `/multiplayer-config.js` 读取 `backendOrigin`；原配置位于 `mirror/multiplayer-config.js`，本地页面来源须列入 `frontendOrigins`。配置校验见 `client/src/multiplayer/config.ts:16-53`。原版多人入口先校验服务端协议版本，随后处理账号或游客昵称，最后建立实时连接，见 `client/src/multiplayer/lobby-open.ts:76-171`；本地版在昵称确定后、建立连接前插入“选服 + 申请票据”。

## HTTP 接口

以下路径均以 `/multiplayer/` 开头。请求和响应为 JSON，错误响应使用 `{ "error": "错误代码" }`；前端会把非成功响应中的 `error` 作为错误码，见 `client/src/multiplayer/http.ts:110-124`。表中的方法、字段均为**原协议**。

| 方法 | 路径 | 请求 | 成功响应 | 前端证据 |
| --- | --- | --- | --- | --- |
| GET | `healthz` | 无 | `{ "protocolVersion": 40 }`；必须与前端的版本相同（原版为 39；**本地版为 40**，运动帧格式不同，见“运动数据”） | `client/src/multiplayer/http.ts:126-136` |
| GET | `auth/config` | 可带 Bearer token | `{ "loginRequired": false, "backendOrigin": "http://127.0.0.1:8787" }`（前端在 8780）；只有前后端同源时才可用 `null` | `client/src/multiplayer/http.ts:138-149` |
| POST | `auth/guest-name` | `{ "name": "游客昵称" }` | `{ "available": true }` | `client/src/multiplayer/http.ts:151-160` |
| POST | `auth/register` | `{ "username", "nickname", "password", "invite" }` | `{ "account": { "nickname", "admin"?: boolean } }` | `client/src/multiplayer/http.ts:162-176`；`client/src/generated/multiplayer.js:390-401` |
| POST | `auth/login` | `{ "username", "password" }` | `{ "account": { "nickname" }, "token": "43 字符会话令牌" }` | `client/src/multiplayer/http.ts:167-180` |
| GET | `auth/me` | Bearer token | `{ "account": { "nickname" } }` | `client/src/multiplayer/http.ts:182-184` |
| POST | `auth/nickname` | `{ "nickname" }`，Bearer token | `{ "account": { "nickname" } }` | `client/src/multiplayer/http.ts:186-188` |
| POST | `auth/logout` | `{}`，Bearer token | 成功状态即可 | `client/src/multiplayer/http.ts:190-196` |
| POST | `offer` | `{ "type": "offer", "sdp": "..." }` | `{ "type": "answer", "sdp": "..." }` | `client/src/multiplayer/http.ts:198-207` |
| GET | `ice` | 无 | `{ "iceServers": [...] }`；前端只接受固定 STUN 和 Cloudflare TURN 地址 | `client/src/multiplayer/http.ts:23-65,209-217` |

`/multiplayer/admin` 是管理员界面的链接，不是已观察到的 JSON 调用（`client/src/generated/multiplayer.js:569-572`）；本地数据服务在这个地址提供管理页面（见“本地新增：账号经济”）。原版 `auth/register` 返回账号但前端仍会再调用 `auth/login` 获取令牌；**本地版** `auth/register` 直接返回 `{ "account": {…}, "token": "…" }`（注册即登录），请求体的 `invite` 只在邀请码模式、或注册 `KART_ADMIN_USERNAMES` 中的管理员用户名时需要（任何注册模式下都是，否则 400 `INVALID_INVITE`；开放注册的登录界面把它折叠为可选的“有邀请码？”），密码 8–128 位，按客户端 IP 限流（429 `TOO_MANY_ATTEMPTS`），关闭注册时 403 `REGISTRATION_CLOSED`。`auth/login` 的失败次数按（用户名、客户端网段 IPv4 /24 或 IPv6 /64）计数，其他网段的失败不会锁住该用户名；密码正确但账号被管理员封禁时返回 403 `{"error":"ACCOUNT_BANNED","until":到期毫秒,"reason":"原因"}`（密码错误仍是 401 `INVALID_CREDENTIALS`，不暴露封禁），前端显示“账号已被封禁，解封时间：…（原因：…）”。令牌格式是 43 个 URL 安全字符，存入 `sessionStorage`，键为 `kartsim.multiplayer.session:<backendOrigin>`；账号/信令请求通过 `Authorization: Bearer <token>` 传递（`client/src/multiplayer/http.ts:23,86-107`）。游客模式下 `auth/me` 可返回 `401 {"error":"LOGIN_REQUIRED"}`，前端会转而询问游客昵称（`client/src/generated/multiplayer.js:432-459`）。**本地版不再提供游客模式**（`KART_ALLOW_GUESTS=false` 为默认）：`auth/config` 返回 `{"loginRequired":true,"backendOrigin":…,"registration":"open"|"invite"|"closed","guests":false}`，前端在进入主界面前显示登录/注册界面。

**本地实现差异：**数据服务的 `POST /multiplayer/offer` 返回 `501 USE_LOCAL_WEBSOCKET`，由本地前端适配器改连游戏服的 `/multiplayer/ws`；`GET /multiplayer/ice` 返回空列表（与 Java 版 `server/src/main/java/local/kartsim/server/HttpApi.java:74-80` 相同）。前端适配器见 `client/src/multiplayer/client-websocket.ts:6-17,46-54`。`healthz` 另返回 `"service":"data"` 与 `dataNode`；游戏节点自己的 `healthz` 返回 `"service":"game"` 与 `nodeId`。

### 本地新增：游戏服列表与入场票据

| 方法 | 路径 | 请求 | 成功响应 | 错误 |
| --- | --- | --- | --- | --- |
| GET | `game-servers` | 无 | `{"dataNode":"data-1","servers":[{"nodeId":"game-1","name":"游戏服 1","origin":"http://127.0.0.1:8788","players":3,"rooms":1,"capacity":400,"full":false}]}`；只含存活节点，按 `name` 排序；`origin` 为 `null` 表示经 `backendOrigin` 同源连接 | — |
| POST | `game-servers/ticket` | `{"nodeId":"game-1"}`，带 `Authorization: Bearer <token>` | `{"ticket":"kt1.…","nodeId":"game-1","origin":"http://127.0.0.1:8788","dataNode":"data-1","expiresAt":1760000000000}` | `401 LOGIN_REQUIRED`（没带 Bearer 且未开启游客，或 Bearer 无效）、`403 ONBOARDING_REQUIRED`（账号还没领取新手礼包）、`404 GAME_SERVER_NOT_FOUND`、`503 GAME_SERVER_FULL`、`503 DATA_SERVICE_UNAVAILABLE` |

票据是 `kt1.<base64url(JSON 声明)>.<base64url(HMAC-SHA256)>`，2 分钟内有效、只能使用一次，绑定目标游戏节点与数据节点；带 Bearer 时是账号票据（含账号 ID、用户名、昵称、管理员标记）。只有部署开启 `KART_ALLOW_GUESTS=true` 时，不带 Bearer 才会得到游客票据。浏览器不需要解析票据内容，原样放进 `hello` 即可。**每次连接尝试都要重新申请**（包括 `NICKNAME_TAKEN` 后换名重试）。会话 token 只发给数据服务，不再发给游戏服。

`auth/guest-name` 的 `available` 在本地版中还要求该名字当前不在任何游戏服在线。另有只读统计 `GET /api/player-stats?name=<昵称>`，见文末存储接口。

## 实时 JSON 消息

以下消息名称和字段均为**原协议**，只把传输换成了本地新增的 WebSocket。每个客户端请求带字符串 `requestId`；服务端的对应答复必须回显同一 ID。前端等待响应最多 10 秒，且最多保留 32 个未完成请求（`client/src/multiplayer/client-control.ts:54-83`）。服务端还可发送无 `requestId` 的房间广播。

### 握手与时钟

```json
{"type":"hello","requestId":"1","protocolVersion":40,"ruleset":"launcher-room-v1","resourceVersion":"p3553","name":"Alice","equipment":{"itemIds":{"1":2,"2":6,"3":0,"70":4,"4":0,"…":0},"kartSerial":0,"valueAt3E":0,"exceedType":0,"systemKart":"practiceKart"},"initial":"","raceRuntime":true,"ticket":"kt1.…"}
```

回复须为 `{ "type":"welcome", "requestId":"1", "playerId":"...", "protocolVersion":40, "ruleset":"launcher-room-v1", "capabilities":[] }`（原版为 39）。`playerId` 长度 1–64；若没有 P2P 运动转发能力，请返回空 `capabilities`，前端才不会额外启动 P2P ICE/信令流程。字段来源：`client/src/multiplayer/client-connect.ts:168-199` 和 `client/src/multiplayer/server-events.ts:54-58`。

**本地新增 `ticket`：**游戏节点先按原顺序校验协议版本、规则集、资源版本与 `name`，然后要求字符串 `ticket`，依次检查：缺失 `TICKET_REQUIRED`；格式或签名错误 `TICKET_INVALID`；过期 `TICKET_EXPIRED`；签给其他节点 `TICKET_WRONG_NODE`；来自其他数据服务 `DATA_NODE_MISMATCH`；已用过 `TICKET_REUSED`；游客票据而节点未开启 `KART_ALLOW_GUESTS` 时 `LOGIN_REQUIRED`（默认如此，`hello` 实际上要求账号票据）。账号票据使用其中的昵称并忽略 `name`（开启游客时游客使用请求中的 `name`）。`hello` 携带的 `equipment` 会向数据服务核对归属：账号不拥有或已过期时返回 403 `ITEM_NOT_OWNED`（不占用昵称；浏览器重读库存、换回新手装备后用新票据重试），数据服务不可达时 `DATA_SERVICE_UNAVAILABLE`。昵称在本节点内不区分大小写去重（`NICKNAME_TAKEN`），本节点上同一账号已有会话时 `ACCOUNT_ONLINE`（同一账号在同一节点重复进入时昵称相同，通常先得到 `NICKNAME_TAKEN`）；这两项在核对装备之前。核对通过后由数据服务在全集群占用昵称与账号：账号被管理员封禁 `ACCOUNT_BANNED`（封禁前领到、还没过期的票据也进不来；错误帧另带数据服务给出的 `until`、`reason`，即 `{"type":"error","code":"ACCOUNT_BANNED","reason":…,"until":…}`），账号已在其他节点在线 `ACCOUNT_ONLINE`（先于昵称检查，所以跨节点重复进入得到它），昵称冲突 `NICKNAME_TAKEN`，数据服务不可达 `DATA_SERVICE_UNAVAILABLE`。一个账号全集群同时只能有一个会话。本节点满员 `SERVER_FULL`、内存紧张 `SERVER_BUSY`（这两项在校验票据之前返回，不消耗票据），节点正在关闭 `SERVER_SHUTTING_DOWN`。Java 版的 `token` 字段不再使用（出现也被忽略）。断开连接时释放昵称与账号占用。连接后 15 秒内（`KART_HELLO_TIMEOUT`）未完成 `hello` 的连接以 1008 关闭；待发送数据积压超过 `KART_SEND_BUFFER_BYTES` 的连接同样以 1008 关闭。节点房间数达到 `KART_MAX_ROOMS` 时 `create` 返回 `ROOM_LIMIT_REACHED`。

`clock` 请求携带非负有限数 `clientTick`，回复携带原值和非负有限数 `serverTick`：

```json
{"type":"clock","requestId":"2","clientTick":123.5}
{"type":"clock","requestId":"2","clientTick":123.5,"serverTick":456.7}
```

连接时会连续校时三次，以后每 10 秒发一次；比赛的 `startAt` 等时刻必须使用与 `serverTick` 相同的服务端单调时钟基准（`client/src/multiplayer/client-connect.ts:206-214`；`client/src/multiplayer/race-start-coordinator.ts:129-157`）。本地服务端的 `serverTick` 是所连游戏节点进程启动以来的单调毫秒；同一房间的玩家都在同一节点上，所以不需要跨节点对时。

### 大厅与房间

| 客户端请求类型 | 必要/常见字段 | 对应结果与说明 | 来源 |
| --- | --- | --- | --- |
| `list-ordinary` / `list-gameplay` | `page`；后者另有 `gameplay` | `rooms`：`page,total,rooms`，每页最多 10 项 | `client/src/multiplayer/lobby-actions.ts:83-125` |
| `create` | `name,capacity,password,channelName,mode,speed,speedVersion`，普通模式含 `gameplay:"ordinary"` | `room`；建房表单本身不发送赛道，服务端须设定有效默认赛道 | `client/src/multiplayer/lobby-settings.ts:101-123`；`client/src/generated/multiplayer.js:3264-3278` |
| `join` | `roomId,password` | `room`；已锁房间先让用户填密码 | `client/src/multiplayer/lobby-actions.ts:208-220` |
| `leave` | `roomId,revision` | `left` 或新房间状态 | `client/src/multiplayer/lobby-actions.ts:128-155` |
| `ready` / `start` | `roomId,revision,ready?` | 更新后的 `room`；开始时进入 `loading` | `client/src/multiplayer/lobby-room-view.ts:77-89` |
| `team` / `slot` / `kick` / `kick-vote` / `transfer-host` | `roomId,revision` 与各自目标字段 | 更新后的 `room` | `client/src/multiplayer/lobby-actions.ts:229-237`；`client/src/multiplayer/lobby-room-view.ts:99-116`；`client/src/multiplayer/lobby-dialogs.ts:149-154` |
| `track` / `random-track` | `roomId,revision,trackId` 或 `randomTrackCode` | 更新后的 `room` | `client/src/multiplayer/lobby-track.ts:164-170` |
| `equipment` / `changing` | `roomId,equipment` 或 `roomId,changing` | 更新后的 `room`；**本地新增**：装备含账号不拥有的物品时 `ITEM_NOT_OWNED` | `client/src/multiplayer/lobby-garage.ts:79,115-117` |
| `get-room-settings` / `room-settings` | `roomId`；更新另带 `revision,name,password` | `room-settings` 或 `room` | `client/src/multiplayer/lobby-settings.ts:45-65`；`client/src/multiplayer/lobby-actions.ts:240-253` |
| `chat` | `roomId,text` | `chat` 事件，内容带 `sequence,playerId,name,text` | `client/src/multiplayer/lobby-actions.ts:195-205`；`client/src/multiplayer/server-events.ts:22-25,94-95` |

客户端还发送 `loaded`、`load-failed`、`finish`、`return-room`、`race-chat`、`team-charge`、`giant-state`、`award-motion`、`item`（本地新增，道具赛，见下文“本地新增：道具赛”）、`latency-reply`，高级 P2P 模式还会发送 `p2p-signal` / `p2p-relay`（`client/src/multiplayer/race-start-coordinator.ts:157-172`；`client/src/multiplayer/race-session.ts:134-200`；`client/src/multiplayer/peer-mesh.ts:205,427`）。服务端可发出的已观察事件类型集合见 `client/src/multiplayer/protocol.ts:76-81`，字段校验见 `client/src/multiplayer/server-events.ts:36-127`。不认识的请求要回 `{"type":"error","requestId":"原请求 ID","code":"错误码"}`，避免客户端一直等待。

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

`revision` 从 1 开始，每次状态更新递增；客户端会丢弃旧版本和自己已离开的房间（`client/src/multiplayer/room-state.ts:20-45`）。频道决定模式和速度：`speedIndiCombine` / `speedTeamCombine` 是速度 7，`speedIndiInfinit` / `speedTeamInfinit` 是速度 4（`client/src/multiplayer/room-validation.ts:111-116`）；本地新增的道具频道 `itemIndiCombine`（个人）/ `itemTeamCombine`（组队）是速度 7，只用于 `gameplay:"item"`。房间必须有 `trackId` 或 p3553 的 `randomTrackCode`；人数 2–8，成员 ID 与槽位唯一、房主必须在成员中。装备若出现必须满足完整 34 个分类和数值范围；比赛的 `roster` 每人必须有有效装备（`client/src/multiplayer/room-validation.ts:193-225,344-408`）。房间阶段为 `open → loading → countdown/racing → finished`，非 `open` 阶段必须附有效 `race`。**与 Java 不同：**比赛中（`loading`/`countdown`/`racing`）有车手离开房间时不再取消整局，其他车手继续比赛、跑完为止；离开者从 `members` 消失但仍在 `roster` 中，已载入的在 `results` 中按未完赛排在最后，服务端不再等它载入或完赛；浏览器把它标为退出、隐藏它的赛车并取消碰撞。只有挡人模式载入阶段跑者离开（或已凑不齐 5 名载入车手）、或所有车手都离开时才取消（`raceError: "MEMBER_LEFT"`）。同样，`load-failed` 与载入超时只把该车手移出本局（从 `loadedIds` 删除，留在房间等下一局，之后的比赛命令返回 `NOT_RACE_PARTICIPANT`），其他人载入完即开赛；只有本局无法开始时才取消（`LOAD_FAILED`/`LOAD_TIMEOUT`）。`loading` 之后不在 `loadedIds` 中的 `roster` 车手即已被移出。详见 `server-go/DESIGN.md` 4.3。具体赛果字段、结束时限与团队得分约束见 `client/src/multiplayer/room-validation.ts:305-341`。

真实比赛装载器还要求 `race.startSlots`：键必须恰好覆盖 `race.roster` 中的每个 `playerId`，值是互不重复的 0–7 整数起跑位。这个条件目前没有包含在 `room-validation.ts` 的静态校验里，但缺失会使浏览器在载入赛道时返回“本局缺少完整起跑位表”（`recovered/formatted/index.js:77081-77100`）。本地端到端脚本会单独检查它。

`rooms` 列表中的每个摘要必须含 `roomId,name,mode,capacity,speedVersion,channelName,speed,gameplay,resourceVersion,count,locked`，以及 `trackId` 或 `randomTrackCode`；额外的 `gaming` 可帮助前端判断是否可快速加入（`client/src/multiplayer/server-events.ts:107-124`）。

### 本地特殊玩法

模式规则、房间与赛程在 `server-go/internal/game/lobby`，逐行移植自 Java 版 `server/src/main/java/local/kartsim/server/GameModes.java` 与 `LobbyService.java`。每个服务端快照都必须通过 `client/src/multiplayer/room-validation.ts`：

所有模式的结束快照都带 `race.rewards`，奖励随结算入账。

| 模式 | 房间与比赛约束 | 赛后数据 |
| --- | --- | --- |
| 挡人 `roadblock` | 至少五人、个人标准速度、固定随机赛道；房主为跑者，三分钟限时，跑者完赛或退出会产生专属结果 | `roadblockOutcome` 和完整赛程写入 `race_outcomes`；无普通名次列表 |
| 巨人 `giant` | 个人标准速度、限定赛道；`giant-state` 按玩家序号和增长状态校验后广播 | 名次与完整赛程分别写入 `race_results`、`race_outcomes` |
| RP `rp` | 每人收到冻结的赛车抽选；目前奖池为已确认可加载的赛车 387、390、378、361，飞宠为 0 | 同上 |
| LTE `lte` | p3553、标准速度、三张专用赛道；本地前端启用 Web 试玩入口和 Z/X 躲闪 | 同上；自动补氮气、香蕉事件尚未完整实现 |
| 道具赛 `item` | p3553、道具频道 `itemIndiCombine`/`itemTeamCombine`（速度 7）；只能选道具赛道（`TRACK_NOT_ITEM`），默认道具 hot1 首图；载入窗口 90 秒；道具由服务器按名次抽取，`item` 请求按玩家序号校验后广播（见下文） | 同上；`race.item` 记录规则与概率表；组队道具赛最先冲线者的队伍获胜 |

### 本地新增：道具赛

规则约定见 [`client/ITEM_MODE.md`](client/ITEM_MODE.md)（第 3 阶段：附录 C）；服务器数据 `server-go/internal/game/itemmode/itemmode.json` 由 `client/tools/export-item-mode-data.mjs` 从原版资源导出（**不要手改**）：个人 `item/slot/itemProb_indi@zz.bml`、组队 `itemProb_team2@cn.bml` 的名次组权重，`zeta_/cn/content/itemGameRestrictionItemCount.xml` 的获得上限，19 种道具 `item.bml` 第一组状态的时长，道具赛道表（含 `track@zz` 等级）、随机池与默认赛道；第 3 阶段另有变更卡重抽表、49 种特殊道具（变体 base 及其状态时长）、按车辆的 `transformByKart`/`fired2Gain`/`firing2Gain`/`animalBooster`（基础文件加 `@cn` 按行覆盖）、`transform@zz`、`itemTable.kml` 加 `@cn` 的道具赛特性、46 辆迅引擎道具车与 12 个结算称号（见 `server-go/README.md`“道具赛数据”）。

**房间。** `create` 用 `channelName:"itemIndiCombine"`（`mode:"individual"`）或 `"itemTeamCombine"`（`mode:"team"`，人数为偶数）、`speed:7`、`gameplay:"item"`，需要 p3553（`RESOURCE_VERSION_UNSUPPORTED`）；道具频道只接受 `item`，`item` 只能在道具频道（都返回 `INVALID_CHANNEL`）。`list-gameplay {"gameplay":"item"}` 列出道具房间，`list-ordinary` 不含它们。新房间默认赛道是道具 hot1 组第一条有道具箱的赛道（`desert_I03`）。`track` 只接受导出的道具赛道，即浏览器道具房间选图目录 `itemTrackCatalog`（`client/src/resources/track-catalog.ts`）的全部赛道：`track@zz` 中 `gameType="item"`、含 5 条 `isOnlyItemTrack`，去掉 `trackLocale@cn` 中 `blocked="true"`/`choosable="false"`/练习场的，反向赛道须有未封禁的 `trackLocale@cn` `track_rvs` 行；每条的 `track.1s`/`track_rvs.1s` 里都有道具箱；共 187 条，其中 29 条反向（服务器多出一条客户端没有的赛道，开赛时浏览器会报“本局赛道不在当前资源目录中。”，导出测试会拦住这种差异），其他返回 `TRACK_NOT_ITEM`；`random-track` 接受 3–7（hot1–hot5）、0（全部）、8（新图）、30（反向），开赛时从对应的道具池抽取，40（竞速随机）返回 `INVALID_TRACK`。开赛后载入窗口 90 秒。比赛快照在 `race` 最后追加 `"item":{"ruleset":"web-item-v1","table":"indi"|"team"}`。组队道具赛没有集气，`team-charge` 返回 `TEAM_GAUGE_UNAVAILABLE`。

**结果。** 个人道具赛与竞速相同（按完赛时间排名，第一名冲线后 10 秒结束）。组队道具赛 `winningTeam` 是**最先冲线者**（`results` 第一名）的队伍；`teamScores` 仍按完赛积分给出（0–39，供前端校验），胜方 ×1.2 奖励跟随 `winningTeam`，积分持平也照给。数据服务把道具赛计入成就的 gameType 2（个人）/ 4（组队）、6（道具全部）和 0（全部比赛）。道具赛的 `finish` 可带 `perfectStart:true|false`（起步加速是否成功，其他玩法忽略）；`race.results[]` 每行加 `titles`（字符串数组，按 `title_icons/namemap@zz` 顺序）：`perfectAim` 百发百中（有攻击命中且没有被挡下的攻击）、`ironWall` 铁壁防御（天使 5 次）、`turret` 炮台模式（各类导弹 10 次）、`flyKing` 苍蝇之王（水苍蝇类 10 次）、`carpetBomb` 地毯式轰炸（投掷水炸弹类 10 次）、`cloudyDay` 阴云密布（乌云类 10 次）、`magnetic` 莫名吸引（磁铁类 10 次）、`invasion` 入侵地球（飞碟 10 次）、`speedWar` 速度战（加速器与特殊加速器 10 次）、`perfectStart` 完美起步、`onlyOne` 唯我独尊（第 1 名完赛，且每次过线——运动帧圈数增加——时都领先）、`safetyFirst` 安全第一（完赛且全程没有报过 `result:"hit"`）。结算的 `results[].titles` 相同。`race.rewards` 的金币含赛中金币（不乘倍率），结算条目另列 `bonusLucci`；用掉的道具换位卡/变更卡随结算 `consumed` 扣除（见“本地新增：账号经济”与 `server-go/ECONOMY.md`）。

**名次与抽取。** 服务器按运动帧里的**当前**路线距离排名（已完赛者按完赛顺序在前，离开者不计）：第 1 名 top；其余 `p=(名次-2)/(人数-1)`，`p<1/3` high、`p<2/3` mid，否则 low；只有 1 人时 top。按名次组权重抽取；`slotLock`、`angel`、`thunderbolt` 每位车手每局最多获得 2 次，达到后从表里剔除重抽，`booster` 不受限制。抽到的道具再依次经过（ITEM_MODE.md C.3）：`transform@zz`（赛道等级 0/1 时定时水炸弹 13→水炸弹 9；等级 0/2/3/4 的反向赛道上大魔王 2→R博士 23）→ 车辆的 `transformByKart`（按概率替换）→ `animalBooster`（得到加速器且该车有此行时按概率变成特殊加速器 31，图标 `item/slot/animal<iconId>.png`）。车辆按开赛时冻结的装备（`race.roster[i].equipment.itemIds["3"]`）算；练习车（itemId 0）没有这些表。

**请求** `{"type":"item","roomId","raceId","sequence","action",…}`。先检查：非道具赛 `ITEM_UNAVAILABLE`，未载入 `RACE_NOT_RUNNING`；`sequence` 必须是该车手上一个序号 +1，否则 409 `INVALID_SEQUENCE`。序号一经接受即被用掉，之后无论请求成功与否都不再重用（客户端可以连续发送，不必等回复）；随后比赛未在进行（服务器时间早于 `startAt`，或已结束）时返回 `RACE_NOT_RUNNING`。被拒绝的道具请求只回普通错误 `{"type":"error","code"}`，不改变任何状态，**不会让比赛失败**；道具槽以最近一次带 `slots` 的回复或推送为准（槽只因本人的请求或下文的服务器推送变化）。已完赛的车手 `cube`/`use`/`place`/`swap`/`change` 返回 `INVALID_USE`（`hit`、`escape`、`slots` 仍可发送）。

带 `slots` 的回复与推送都同时带 `changers:{"slot","item","itemArmed"}`：道具换位卡（7:1）、道具变更卡（7:2）剩余张数，有未过期的使用券（7:4 / 7:3）时为 -1（无限，不扣卡）；`itemArmed` = 槽 0 的道具获得后还没变更过（吃箱、获得表、开局道具都会重新允许）。卡数在开赛时从数据服务读取（装备核对的回答），本局内由服务器记账、赛后结算扣除（游客为 0；游戏节点 `KART_ITEM_CHANGERS=infinite` 时所有人 -1）。槽里有特殊加速器且该车有图标时另带 `slotIcons`（与 `slots` 等长，0 为道具自己的图标）。

| `action` | 字段 | 服务器处理 | 回复（只给发送者） | 广播（房间其他成员） |
| --- | --- | --- | --- | --- |
| `cube` | `cubeId` 1–4096（赛道道具箱 `instanceOrdinal`）、`capacity`（道具槽数，夹到 2–3，本局第一次报告后固定）；仅开发测试：`testItemId` | 同一道具箱 10 秒内再次吃到且中间没吃别的箱子：不给（`abusing`）；槽满：不给（`full`）；否则按名次组抽取并经过上述变换，放进第一个空槽。车有 `lucciItemCube` 时（非刷箱）按其概率得 10 金币（推送 `lucci`）。带 `testItemId`（任一道具赛道具，含特殊道具）时不抽取、不变换、直接给该道具（不受每局上限限制，但计入次数），只有游戏节点开了 `KART_ITEM_TEST_GRANTS=true` 才接受，否则 403 `ITEM_TEST_GRANTS_DISABLED`；不是道具赛道具 `INVALID_TESTITEMID`。浏览器从不发送它 | `{"action":"grant","sequence","cubeId","itemId":整数或 null,"iconId"?（特殊加速器图标）,"reason"?:"abusing"\|"full","slots","slotIcons"?,"changers"}` | 无（透视期间给透视方发 `scan`） |
| `use` | `itemId`（必须等于槽 0）、瞄准类可带 `targetId`、投掷/放置类（香蕉、水炸弹及其变体、地雷类、水雷、废油弹、弹性陷阱）必须带 `point:{x,y,z}`（原版客户端 z 向上坐标，即 three.js 的 `(x, -z, y)`） | 槽 0 不是该道具 `ITEM_NOT_HELD`；被道具锁 `ITEM_LOCKED`（天使除外）；缺 `point` `INVALID_POINT`；瞄准的不是在赛对手 `INVALID_TARGET`。按下表决定 `targets`，分配 `useId`（本局从 1 递增），`startAt` 为服务器当前毫秒，追踪类按名次距离差算 `etaMs`；车有 `useTwoRocket`（导弹 7）或 `useTwoGoldRocket`（黄金导弹类 32/102/107/126）时 `count:2`（两枚，同一目标，第二枚晚 200 ms）；取走槽 0、其余前移，然后按使用者的车掷 `firing2Gain`（得到的道具放进第一个空槽，推送 `slots`，`reason:"gain"`）；磁铁/黄金磁铁的目标按其车掷 `fired2Gain`（被吸也算被击中） | 广播内容加 `sequence`、`slots`、`slotIcons`?、`changers` | `{"action":"used","playerId","useId","itemId","targets":[…],"startAt","etaMs","point"?,"count"?:2}` |
| `place` | `useId`、`point` | 路障只接受其目标（被锁定的第一名）上报落点，定时水炸弹只接受使用者上报爆点；每个 `useId` 一次，否则 `INVALID_USE` | 广播内容加 `sequence` | `{"action":"placed","useId","itemId","playerId":使用者,"point"}` |
| `hit` | `useId`（赛道预置危险物为 0，另带 `hazardId` 1–4096）、`itemId`、`result:"hit"\|"blocked"`、可选 `by:"shield"\|"angel"\|"escape"\|"kart"\|"pet"\|"eat"`、可选 `variant:"small"\|"headband"\|"bonus"\|"quick"\|"balloon"`、可选 `shot` 0/1（双发导弹的第几枚；赛道危险物不带） | 受害者自报：`useId` 须在 60 秒内且道具相符（`INVALID_USE`）；受害者须是该道具能打到的人（`INVALID_TARGET`，见下）；`shot` 须是这次使用发出的（`INVALID_SHOT`）；`by` 须能挡住该道具（`INVALID_BY`；`hit` 不能带 `by`；`emp` 不再是防御，一律 `INVALID_BY`）；`variant` 须成立（`INVALID_VARIANT`）——装备类的 `by`/`variant` 按受害者冻结的装备与共享掷骰校验（见下文“装备特性”）。同一受害者对同一 `useId`（双发导弹：同一 `shot`）只记一次，重复上报原样返回第一次的结果、不再广播；赛道危险物同一受害者 3 秒内只记一次。放置类陷阱（香蕉、巨型香蕉、地雷类、弹性陷阱、废油弹）在第一次上报时（命中、被挡下或被吃掉 `by:"eat"`）即移除（`removed:true`），之后再报 `INVALID_USE`。新的命中（`result:"hit"`，或被吃掉）按受害者的车掷 `fired2Gain`（推送 `slots`，`reason:"gain"`）；`variant` 是 `bonus`/`balloon` 时受害者得 10 金币（推送 `lucci`）；毒性水炸弹类、毒性水苍蝇、符咒命中后服务器给受害者加道具锁（见下表） | 广播内容加 `sequence` | `{"action":"hit","playerId":受害者,"useId","itemId","userId"?:使用者（赛道危险物没有使用者，省略该字段；前端校验不接受 null）,"result","by"?,"variant"?,"shot"?（只在 1 时出现）,"hazardId"?,"removed"?}` |
| `escape` | `useId`（赛道预置水雷为 0，另带 `hazardId` 1–4096） | 被困车手连按左右提前脱出水泡时自报：须是本人报过 `result:"hit"` 的困住类命中——水炸弹类、水苍蝇类、定时水炸弹类、水雷（`useId` 60 秒内），或赛道水雷（该 `hazardId` 最近一次命中）；符咒的方向键 QTE 提前脱出也用它（同时结束符咒的道具锁）；否则 `INVALID_USE`。每次命中只记一次，重复发送原样回复、不再广播 | 广播内容加 `sequence` | `{"action":"escaped","playerId":被困者,"useId","itemId","hazardId"?}`：其他客户端此时结束该车的水泡并开始蓝盾 |
| `swap` | — | 道具换位卡（Alt，ITEM_MODE.md C.6）：没有卡也没有使用券 `ITEM_CHANGER_UNAVAILABLE`；槽 0、1 都有道具才交换（道具锁期间也可以），否则 `INVALID_USE`；扣 1 张卡（使用券不扣） | `{"action":"slots","sequence","slots","slotIcons"?,"changers"}` | 无 |
| `slots` | — | 不改变任何状态；被拒绝的请求不带 `slots`，客户端可用它重新取得权威道具槽（浏览器在 `use`/`swap` 被拒绝、可能与服务器不一致时发送） | `{"action":"slots","sequence","slots","slotIcons"?,"changers"}` | 无 |
| `change` | — | 道具变更卡（Z，ITEM_MODE.md C.6）：没有卡也没有使用券 `ITEM_CHANGER_UNAVAILABLE`；槽 0 为空 `INVALID_USE`；槽 0 的道具获得后已经变更过 `ITEM_CHANGER_USED`；被道具锁 `ITEM_LOCKED`。从变更表（个人 `itemProb_indiChanger@zz`、组队 `itemProb_teamChanger2@cn`）按当前名次组重抽槽 0（套每局上限，再经过同样的变换——`changerTuto01@cn`“一定几率出现特殊道具”），扣 1 张卡（使用券不扣），直到下一个新道具前不能再变更 | `{"action":"slots","sequence","slots","slotIcons"?,"changers"}` | 无 |

所有回复与事件都是 `{"type":"item","roomId","raceId","action",…}`；`slots` 每槽一个值，空槽为 -1。服务器另发（无请求，不带 `sequence`）：

- `{"action":"scan","playerId":被透视者,"slots","until"}`，只发给透视方队伍的在赛车手——使用透视镜时立即发一份每名在赛对手的道具槽，之后在 `until`（`startAt`+`Use` 500+`Affect` 8000）之前对手道具槽每次变化（含获得表推送）都再发。
- `{"action":"slots","slots","slotIcons"?,"changers"}`：倒计时开始时（房间快照 `phase:"countdown"` 之后，发起命令的玩家也先收到这份快照）发给每名已载入车手，告诉它开局的道具槽与卡数；迅引擎道具车（导出的 46 辆）另带 `"reason":"start","itemId"`——开局从 `itemProb_indi@zz` 的 14 种道具里等概率抽一个放进槽 0（经过同样的变换，组队赛也用这张表）。
- `{"action":"slots","slots","slotIcons"?,"changers","reason":"gain","itemId"}`：`fired2Gain`/`firing2Gain` 得到的道具（不再经过变换；满槽丢弃）。`reason` 一定与 `itemId` 同时出现。
- `{"action":"lucci","amount","reason"}`，只发给得到赛中金币的车手：`reason` 为 `itemCube`（金币道具箱）、`ufo`（奇奇被飞碟击中）、`balloon`（气球爆掉）、`mine`（吃掉地雷）；每次 10，每局最多 200（`amount` 是这次实得的数）。

所有时刻都是服务器时钟毫秒（与 `serverTick`、`startAt` 同一基准）。

| 道具（idx） | `targets` | 谁可以报 `hit` | 可挡的 `by`（另可 `escape`） | 服务器时间线 |
| --- | --- | --- | --- | --- |
| booster 6、shield 10 | 自己 | 无 | — | — |
| emp 12 | 本队（含自己）**此刻正处于飞碟减速**的在赛车手：生效时刻 `startAt`+`Use`（500）落在其已上报的飞碟命中窗口内（落地 `startAt`+`etaMs` 起 `Affect` 3000，头饰 `HeadBandAffect` 1500，奇奇 `BonusAffect` 3000；允许上报晚到 1 秒），这些命中随即视为解除；没有人中飞碟时 `targets:[]`，道具照样用掉、没有任何效果 | 无 | — | — |
| angel 11、scanning 109 | 本队在赛车手（自己在前） | 无 | — | 从 `startAt`+`Use`（500）起生效；透视：`until`=`startAt`+500+8000 |
| magnet 5 | `targetId`（无锁定则空） | 无 | — | — |
| rocket 7 | `targetId`（无锁定则空=哑弹） | 目标 | shield、angel | `etaMs`=距离差/100 m/s，夹到 [300, 1500] |
| guideRocket 33 | 第一名对手 | 目标 | shield、angel | 同导弹 |
| randomRocket 127 | 随机一名领先的对手 | 目标 | shield、angel | 同导弹 |
| waterFly 4 | 正前方最近的对手（跳过队友） | 目标 | shield、angel | 距离差/60 m/s，夹到 [300, 2000] |
| ufo 3 | 第一名对手 | 目标 | —（护盾、天使都不挡，`bonusStageProperty@tw.xml:53`；只有电磁波能解除） | 距离差/60 m/s，夹到 [300, 1500] |
| barricade 113 | 第一名对手（由其 `place` 落点） | 使用者的对手 | shield、angel | — |
| devil 2、slotLock 110 | 所有对手 | 目标 | —（都不挡） | 道具锁：`startAt`+2000 起锁 3000 ms，期间除天使外 `use` 返回 `ITEM_LOCKED` |
| thunderbolt 111 | 所有领先的对手 | 目标 | angel | — |
| cloud2 114 | 所有落后的对手 | 目标 | — | — |
| banana 8 | 无（`point` 放置） | 任何人（含自己和队友） | shield、angel | 首次命中后移除 |
| waterBomb 9 | 无（`point` 落点） | 使用者的对手 | angel | — |
| timeBomb 13 | 无（使用者 `place` 爆点） | 任何人（含自己和队友） | angel | — |
| 赛道预置 banana 8、mine 17、waterMine 37 | — | 任何人（`useId:0` + `hazardId`） | shield、angel | 同一受害者 3 秒内只记一次 |
| 导弹换皮 30、32、102、107、126，致盲减速导弹 99、131、108、136，舞狮导弹 134 | `targetId`（同导弹） | 目标 | shield、angel | 同导弹，`etaMs` 取各自变体的 `Use` |
| 电磁导弹 104、像素导弹 117 | `targetId` | 使用者的对手（目标与磁场范围内的对手） | shield、angel | 同导弹 |
| 雪精灵 112 | `targetId` | 目标 | angel | 同导弹 |
| 水炸弹变体 20、34、47、27、44 | 无（`point` 落点） | 使用者的对手 | angel | 27/44 命中后道具锁 `Affect`+`PostAffect`（2000+5000；`variant:"quick"` 时 500+5000） |
| 定时水炸弹变体 21、35、28 | 无（使用者 `place`） | 任何人 | angel | 28 同上加锁 |
| 水苍蝇变体 118、119，蜜蜂 132 | 正前方最近的对手 | 目标 | shield、angel | 119 命中后道具锁 `Affect`+`AfterBoost`（1000+2000） |
| 定时水炸弹苍蝇 120 | 正前方最近的对手 | 使用者的对手（目标与爆炸范围内的对手） | shield、angel | — |
| 地雷类 17、45、82、83、129、130，巨型香蕉 85，弹性陷阱 25，废油弹 46 | 无（`point` 放置） | 任何人 | shield、angel | 第一次上报后移除 |
| 水雷 37 | 无（`point` 放置） | 任何人（爆炸范围内都可报） | shield、angel | 可 `escape` |
| 黄金盾牌 36、保护盾 81 | 自己 | 无 | — | 无敌窗口 `startAt` 起 `Use`+`Affect`（500+2500 / 500+4000，再加 1 秒上报余量）：期间该车对乌云类（114、115、1）以外的任何道具都可报 `by:"shield"`（含大魔王类、飞碟）；道具锁开始时在此窗口内的目标不被锁 |
| 超级盾牌 18、黄金磁铁 103（同磁铁瞄准）、隐身 101、特殊加速器 31 | 自己（黄金磁铁：`targetId`） | 无 | — | — |
| 警灯 24、防护警灯 106 | 自己 | 使用者的对手（被撞开的车自报） | angel | — |
| 黑云 1、115 | 所有落后的对手 | 目标 | — | — |
| R博士 23、恶魔阿哥 38 | 所有对手 | 目标 | — | — |
| 龙卷风 135 | 第一名对手（由其 `place` 落点） | 使用者的对手 | shield、angel | — |
| 符咒 137 | 第一名对手 | 目标 | shield、angel | 距离差/60 m/s，夹到 [300, 1500]；命中后道具锁 `Affect` 4000，`escape` 提前结束 |

“对手”是另一队的车手（个人赛为其他所有人），且只算仍在比赛（未完赛、未退出）的车手；距离差用使用者与目标的当前路线距离。客户端在 `startAt` 之后按 `client/ITEM_MODE.md` 附录 B、C.4 的时间线表现效果。护盾能挡的道具 = 该变体 `item.bml` 有 `Shield`/`StateShield`/`RocketShield` 状态的道具（飞碟除外），`go test ./internal/game/itemmode` 按导出数据核对。

**装备特性（ITEM_MODE.md C.2）。** 受害者按开赛时冻结的装备（`race.roster[i].equipment.itemIds`：车 `"3"`、角色 `"1"`、宠物 `"21"`、气球 `"9"`、头饰 `"11"`）自己判定，服务器用同一个确定性掷骰复核：`roll = fnv1a32("raceId|useId|hazardId|victimId|kind") % 100`（UTF-8 字节、32 位 FNV-1a，没有的 id 写 0），`roll < 概率` 即成立；概率取 `itemTable.kml` 叠加 `@cn` 的道具赛值（`"p"` 或 `"p道具赛,p对AI"` 取第一个数，-1 当 0）。同一个 `kind` 车和宠物共用一次掷骰（较大的概率决定），双发导弹的两枚也共用。向量见 `client/src/item/item-roll-vectors.json` 与 `itemmode/phase3_test.go`。

| `by` / `variant` | 道具 | 需要（`kind`） |
| --- | --- | --- |
| `by:"kart"` / `"pet"` | 导弹 7、可乐导弹 30、黄金导弹类 32/102/107/126 | 车/宠物 `rocket`（`rocket`） |
| `by:"kart"` / `"pet"` | 水苍蝇类 4/118/119/120 | 车/宠物 `waterfly`（`waterfly`）；车另可用 `onlyWaterBomb`（`waterBomb`），须有 `allflyToAllBomb`（全部苍蝇）或 `waterflyToWaterBomb`（只 4） |
| `by:"kart"` | 水炸弹 9 | 车 `onlyWaterBomb`（`waterBomb`） |
| `by:"pet"` | 水炸弹类 9/13/20/21/27/28/34/35/44/47；冰冻 34/35 | 宠物 `waterBomb`（`waterBomb`）；宠物 `snowBomb`（`snowBomb`） |
| `by:"kart"` / `"pet"` | 大魔王 2、R博士 23、恶魔阿哥 38 | 车/宠物 `devil`（`devil`） |
| `by:"eat"` | 香蕉 8、巨型香蕉 85（含赛道预置） | 车 `banana`；`ice_` 开头的赛道再看 `iceBanana`（`banana`） |
| `by:"kart"` / `"eat"` | 地雷 17、129、130；蛋蛋弹类 45/82/83 须车有 `mineWithEggMine` 或 `mineWithKindOfEgg`（含赛道预置） | 车 `mine`（`mine`）；`eat` 还须车有 `eatMine` |
| `by:"kart"` / `"eat"` | 弹性陷阱 25 | 车 `forceZone`（`forceZone`）；`eat` 还须 `eatForceZone` |
| `by:"kart"` | 水雷 37（含赛道预置） | 车 `waterMine`（`waterMine`） |
| `by:"kart"` | 警灯 24、防护警灯 106 | 车 `siren`（`siren`） |
| `variant:"quick"` | 水炸弹类、水苍蝇类、水雷（`result:"hit"`） | 车 `waterAngel`（`waterAngel`） |
| `variant:"headband"` | 飞碟 3 | 头饰 `probability`（`headband`） |
| `variant:"bonus"` | 飞碟 3（`result:"hit"`，得 10 金币） | 角色 `lucciUfo`（`lucciUfo`） |
| `variant:"bonus"` + `by:"eat"` | 被吃掉的地雷类 / 弹性陷阱（`result:"blocked"`，得 10 金币） | 上面的 `eat` 成立，且角色 `lucciMine`（`lucciMine`）/ `lucciForceZone`（`lucciForceZone`） |
| `variant:"balloon"` | 导弹 7、追踪导弹 33、随机导弹 127、可乐导弹 30（黄金导弹类不行；`result:"hit"`，得 10 金币） | 气球 `prob`（`balloon`） |
| `variant:"small"` | 有 `AffectSmall` 状态的道具，或电磁导弹/像素导弹磁场里被减速（`AffectSub`）的车（`result:"hit"`） | 无（较轻的命中） |

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
| GET | `/multiplayer/admin`（或 `/multiplayer/admin/`） | — | 管理页面（HTML），资源在 `/multiplayer/admin/assets/` | — |
| GET | `/api/admin/accounts` | 查询参数 `q`（账号、昵称、注册/最后登录/最后活跃 IP）、`online`/`banned`/`admin`（`1` 或 `true` 筛选）、`sort`（`createdAt`、`lastLoginAt`、`lastSeenAt`、`level`、`coupon`、`lucci`、`koin`）、`order`、`page`、`pageSize`（最大 100）、`from`/`to`（注册时间） | 分页 `{"items":[AccountRow],"total","page","pageSize"}`；`AccountRow` 的货币是扁平的 `coupon`/`lucci`/`koin`（没有 `wallet`），字段见 [`server-go/ADMIN.md`](server-go/ADMIN.md) 第 4、5 节 | `401 LOGIN_REQUIRED`、`403 ADMIN_REQUIRED`、`400 INVALID_QUERY`（参数不合法） |
| POST | `/api/admin/grant` | `{"username","currency":"coupon"/"lucci"/"koin"/"exp","amount"(负数为扣除),"note","requestId"?}` | `{"applied","levelUps","duplicate","requestId","account"}`（`account` 是 `AccountRow` 加 `wallet`）；同一 `requestId` 以相同账号、货币、数额重放返回 `duplicate:true`，不重复发放 | `403 ADMIN_REQUIRED`、`404 ACCOUNT_NOT_FOUND`、`400 INVALID_GRANT`、`400 INVALID_NOTE`、`400 INVALID_REQUEST_ID`、`409 INSUFFICIENT_FUNDS`、`409 INSUFFICIENT_EXP`、`409 BALANCE_LIMIT`、`409 REQUEST_ID_CONFLICT`（同一 `requestId` 换了账号、货币或数额） |

管理后台的其他接口（概览、登录记录、在线玩家、服务器节点、各类流水与记录、俱乐部、邀请码、奖励箱等）都在 `/api/admin/*`，约定见 [`server-go/ADMIN.md`](server-go/ADMIN.md)。

联机比赛的奖励不需要客户端调用接口：游戏节点在结束快照中给出 `race.rewards`（见“房间状态边界”），结算经发件箱送达数据服务后入账；客户端随后 `GET /api/account` 刷新余额与等级。

## 运动数据

**原协议** 的比赛运动数据不是 JSON。原版 `motion` 通道帧为 56 字节头加 80–178 字节载荷；小端魔数为 `19277`，头中有载荷类型、接收者掩码、房间/比赛/玩家 UUID 和 32 位序号。

**本地版（协议 40）改了帧头，与原版不兼容。** 三个 UUID 每帧重复 48 字节，而游戏节点从连接本身就知道发送者在哪个房间、哪场比赛，所以帧头只剩 8 字节（`client/src/multiplayer/motion.ts`、`server-go/internal/game/lobby/motion.go`）：

| 偏移 | 长度 | 字段 |
| --- | --- | --- |
| 0 | 1 | 载荷类型 1–10 |
| 1 | 1 | 接收者掩码（按房间座位号的位；直连 P2P 帧为 0） |
| 2 | 1 | 发送者的房间座位号 0–7；游戏节点转发前改写为发送者真实的座位号，不信任客户端填的值 |
| 3 | 1 | 比赛标记：比赛 UUID 的第一个字节；与发送者当前比赛不符的帧（上一场遗留的）被丢弃 |
| 4 | 4 | 32 位序号，小端 |
| 8 | 80–163 | 载荷 |

接收端用房间快照把座位号对应到玩家。载荷与原版相同，只有带路由段的类型 8 和 10 例外：原版在载荷偏移 150 放 16 字节的被观察玩家 UUID，本地版只放 1 字节的座位号（类型 8 载荷 166 → 151 字节，类型 10 载荷 178 → 163 字节）。比赛中最常见的类型 8/10 帧因此从 222/234 字节降到 159/171 字节（少 27–28%）；算上 UDP/DTLS/SCTP 或 TCP 的包头，网络上约少 20%。原版帧的第一个字节是 `0x4d`，按本地格式会被当作非法类型丢弃；前端与游戏节点必须一起升级（旧节点对新前端的 `hello` 返回 `PROTOCOL_MISMATCH`，前端会提示换服务器）。

本地游戏节点在同一条 WebSocket（或 WebRTC `motion` 通道）上接收二进制帧，校验长度、类型、比赛标记、发送者已载入且未离开后，按接收者掩码只转发给同一房间、已载入的其他车手（与 Java 版 `relayMotion` 的转发规则一致）；运动帧从不经过数据服务。

**本地新增：服务端反作弊**（`server-go/ANTICHEAT.md`）。游戏节点先按浏览器解码器（`payload.ts`）校验载荷，浏览器解不开的帧一律不转发（否则接收方会断开整条连接）；比赛中还检查时钟、坐标跳变与速度、路线进度与圈数，`finish` 检查完赛时间、速度与路线进度，道具赛检查吃箱频率。默认（`KART_ANTICHEAT=kick`）检查失败的车手先收到不带 `requestId` 的 `{"type":"error","code":"CHEAT_DETECTED","check":"TELEPORT"}`（`check` 为检测项），随即按离开处理移出房间与本局，连接在这条消息之后以 1008 `anti-cheat` 关闭；关闭前它的请求都回复 `CHEAT_DETECTED`，运动帧丢弃。浏览器据此提示“已被移出比赛”并回到大厅。

## 数据存储事实与本地新增方案

原版下载物没有服务端实现。当前单人档案写在浏览器 `localStorage` 的 `kartrider-web:p3528:user-profile-v2`，结构含 `equipment,initial,favoriteTracks,favoriteItems,garage`（`client/src/ui/local-profile.ts:1-39,172-212`）；本地昵称另存 `kartsim.local-nickname`（`client/src/generated/multiplayer.js:621-635`）。计时赛摘要在 `kartrider-web:p3553:time-attack-records-v1`，旧版键是 p3528；Ghost 完整帧保存在 IndexedDB（`client/src/game/ghost-records.ts:22-23,71-99`；`client/src/game/ghost/record-store.ts:156-211`）。约 3.49 GiB 的游戏资源容器由静态服务提供并在浏览器 OPFS 缓存，不属于账号数据库（`client/src/resources/container-store.ts:71-123`）。

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

`ownerId` 必须是 UUID，`recordId` 只接受 1–100 位字母、数字、下划线和短横线。所有资料/记录请求带 `X-Profile-Key`：首次 PUT 绑定该所有者的 43 字符密钥，之后读写需要同一密钥。前端将稳定 `ownerId` 和密钥保存在本机（`client/src/ui/profile-sync.ts:4-38,52-55`）。游客每次联机握手可能分配新的 `playerId`，不能把它当持久资料 ID。原 Ghost 记录键含 NUL 分隔符（`client/src/game/ghost-records.ts:25-33`），写入新接口前应使用稳定的 URL 安全编码或摘要。当前前端只同步 Ghost **摘要**，完整回放帧仍在浏览器 IndexedDB，见 `client/src/game/ghost-summary-sync.ts:15-36`。数据服务把这些数据保存在 MySQL，热点读取经 Redis 缓存；表结构、Redis 键与旧 SQLite（`server/data/kart.db`）迁移方法见 [`server-go/README.md`](server-go/README.md)。
