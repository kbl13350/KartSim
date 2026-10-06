# 本地 Java 服务端协议与数据边界

本文件根据本地恢复的浏览器代码整理。标记 **原协议** 的字段来自已下载的前端，并不代表我们拥有原服务端源码；标记 **本地新增** 的接口是为了让 Java 服务端和本地前端协作而定义。

## 连接方式

| 类别 | 地址与用途 | 来源 |
| --- | --- | --- |
| 原协议 | `<backendOrigin>/multiplayer/healthz` 等 HTTP 端点 | `rewrite/src/multiplayer/http.ts:82-84` |
| 原协议 | `POST /multiplayer/offer` 交换 WebRTC SDP；`control` DataChannel 是有序 JSON，协商 ID 0；`motion` 是无序二进制，协商 ID 1 | `rewrite/src/multiplayer/client-connect.ts:50-59,147-171` |
| 本地新增 | `ws://127.0.0.1:8787/multiplayer/ws` 以 WebSocket 承载相同的 `control` JSON 消息 | 本地 Java 实现与前端适配器的约定；原版前端没有这个 WebSocket 入口 |

本地 Java 服务默认监听 `127.0.0.1:8787`。前端从 `/multiplayer-config.js` 读取 `backendOrigin`；原配置位于 `mirror/multiplayer-config.js`，本地页面来源须列入 `frontendOrigins`。配置校验见 `rewrite/src/multiplayer/config.ts:16-53`。原版多人入口先校验服务端协议版本，随后处理账号或游客昵称，最后建立实时连接，见 `rewrite/src/multiplayer/lobby-open.ts:76-171`。

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

`/multiplayer/admin` 是管理员界面的链接，不是已观察到的 JSON 调用（`rewrite/src/generated/multiplayer.js:569-572`）。`auth/register` 返回账号但前端仍会再调用 `auth/login` 获取令牌。令牌格式是 43 个 URL 安全字符，存入 `sessionStorage`，键为 `kartsim.multiplayer.session:<backendOrigin>`；账号/信令请求通过 `Authorization: Bearer <token>` 传递（`rewrite/src/multiplayer/http.ts:23,86-107`）。游客模式下 `auth/me` 可返回 `401 {"error":"LOGIN_REQUIRED"}`，前端会转而询问游客昵称（`rewrite/src/generated/multiplayer.js:432-459`）。本地初版配置采用 `loginRequired:false`。

**本地实现差异：**Java 的 `POST /multiplayer/offer` 返回 `501 USE_LOCAL_WEBSOCKET`，由本地前端适配器改连 `/multiplayer/ws`；`GET /multiplayer/ice` 返回空列表。见 `server/src/main/java/local/kartsim/server/HttpApi.java:74-80` 和 `rewrite/src/multiplayer/client-websocket.ts:6-17,46-54`。

## 实时 JSON 消息

以下消息名称和字段均为**原协议**，只把传输换成了本地新增的 WebSocket。每个客户端请求带字符串 `requestId`；服务端的对应答复必须回显同一 ID。前端等待响应最多 10 秒，且最多保留 32 个未完成请求（`rewrite/src/multiplayer/client-control.ts:54-83`）。服务端还可发送无 `requestId` 的房间广播。

### 握手与时钟

```json
{"type":"hello","requestId":"1","protocolVersion":39,"ruleset":"launcher-room-v1","resourceVersion":"p3553","name":"Alice","equipment":{},"initial":"","raceRuntime":true}
```

回复须为 `{ "type":"welcome", "requestId":"1", "playerId":"...", "protocolVersion":39, "ruleset":"launcher-room-v1", "capabilities":[] }`。`playerId` 长度 1–64；若没有 P2P 运动转发能力，请返回空 `capabilities`，前端才不会额外启动 P2P ICE/信令流程。字段来源：`rewrite/src/multiplayer/client-connect.ts:168-199` 和 `rewrite/src/multiplayer/server-events.ts:54-58`。

`clock` 请求携带非负有限数 `clientTick`，回复携带原值和非负有限数 `serverTick`：

```json
{"type":"clock","requestId":"2","clientTick":123.5}
{"type":"clock","requestId":"2","clientTick":123.5,"serverTick":456.7}
```

连接时会连续校时三次，以后每 10 秒发一次；比赛的 `startAt` 等时刻必须使用与 `serverTick` 相同的服务端单调时钟基准（`rewrite/src/multiplayer/client-connect.ts:206-214`；`rewrite/src/multiplayer/race-start-coordinator.ts:129-157`）。

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
| `equipment` / `changing` | `roomId,equipment` 或 `roomId,changing` | 更新后的 `room` | `rewrite/src/multiplayer/lobby-garage.ts:79,115-117` |
| `get-room-settings` / `room-settings` | `roomId`；更新另带 `revision,name,password` | `room-settings` 或 `room` | `rewrite/src/multiplayer/lobby-settings.ts:45-65`；`rewrite/src/multiplayer/lobby-actions.ts:240-253` |
| `chat` | `roomId,text` | `chat` 事件，内容带 `sequence,playerId,name,text` | `rewrite/src/multiplayer/lobby-actions.ts:195-205`；`rewrite/src/multiplayer/server-events.ts:22-25,94-95` |

客户端还发送 `loaded`、`load-failed`、`finish`、`return-room`、`race-chat`、`team-charge`、`giant-state`、`award-motion`、`latency-reply`，高级 P2P 模式还会发送 `p2p-signal` / `p2p-relay`（`rewrite/src/multiplayer/race-start-coordinator.ts:157-172`；`rewrite/src/multiplayer/race-session.ts:134-200`；`rewrite/src/multiplayer/peer-mesh.ts:205,427`）。服务端可发出的已观察事件类型集合见 `rewrite/src/multiplayer/protocol.ts:76-81`，字段校验见 `rewrite/src/multiplayer/server-events.ts:36-127`。不认识的请求要回 `{"type":"error","requestId":"原请求 ID","code":"错误码"}`，避免客户端一直等待。

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

`revision` 从 1 开始，每次状态更新递增；客户端会丢弃旧版本和自己已离开的房间（`rewrite/src/multiplayer/room-state.ts:20-45`）。频道决定模式和速度：`speedIndiCombine` / `speedTeamCombine` 是速度 7，`speedIndiInfinit` / `speedTeamInfinit` 是速度 4（`rewrite/src/multiplayer/room-validation.ts:111-116`）。房间必须有 `trackId` 或 p3553 的 `randomTrackCode`；人数 2–8，成员 ID 与槽位唯一、房主必须在成员中。装备若出现必须满足完整 34 个分类和数值范围；比赛的 `roster` 每人必须有有效装备（`rewrite/src/multiplayer/room-validation.ts:193-225,344-408`）。房间阶段为 `open → loading → countdown/racing → finished`，非 `open` 阶段必须附有效 `race`。具体赛果字段、结束时限与团队得分约束见 `rewrite/src/multiplayer/room-validation.ts:305-341`。

真实比赛装载器还要求 `race.startSlots`：键必须恰好覆盖 `race.roster` 中的每个 `playerId`，值是互不重复的 0–7 整数起跑位。这个条件目前没有包含在 `room-validation.ts` 的静态校验里，但缺失会使浏览器在载入赛道时返回“本局缺少完整起跑位表”（`recovered/formatted/index.js:77081-77100`）。本地端到端脚本会单独检查它。

`rooms` 列表中的每个摘要必须含 `roomId,name,mode,capacity,speedVersion,channelName,speed,gameplay,resourceVersion,count,locked`，以及 `trackId` 或 `randomTrackCode`；额外的 `gaming` 可帮助前端判断是否可快速加入（`rewrite/src/multiplayer/server-events.ts:107-124`）。

### 本地特殊玩法

Java 服务的模式规则集中在 `server/src/main/java/local/kartsim/server/GameModes.java`，房间与赛程在 `LobbyService.java`。每个服务端快照都必须通过 `rewrite/src/multiplayer/room-validation.ts`：

| 模式 | 房间与比赛约束 | 赛后数据 |
| --- | --- | --- |
| 挡人 `roadblock` | 至少五人、个人标准速度、固定随机赛道；房主为跑者，三分钟限时，跑者完赛或退出会产生专属结果 | `roadblockOutcome` 和完整赛程写入 `race_outcomes`；无普通名次列表 |
| 巨人 `giant` | 个人标准速度、限定赛道；`giant-state` 按玩家序号和增长状态校验后广播 | 名次与完整赛程分别写入 `race_results`、`race_outcomes` |
| RP `rp` | 每人收到冻结的赛车抽选；目前奖池为已确认可加载的赛车 387、390、378、361，飞宠为 0 | 同上 |
| LTE `lte` | p3553、标准速度、三张专用赛道；本地前端启用 Web 试玩入口和 Z/X 躲闪 | 同上；自动补氮气、香蕉事件尚未完整实现 |

可运行 `node server-special-smoke.mjs` 让真实前端校验器检查四种模式的双端协议、赛程、巨人广播和回房。测试会写入所连接服务的 SQLite；建议为测试服务设置临时 `KART_DATA_DIR`。

## 运动数据

**原协议** 的比赛运动数据不是 JSON。服务端 `motion` 通道帧为 56 字节头加 80–178 字节载荷；小端魔数为 `19277`，头中有载荷类型、接收者掩码、房间/比赛/玩家 UUID 和 32 位序号（`rewrite/src/multiplayer/motion.ts:1-74`）。本地 WebSocket 若要支持多人车体同步，需定义二进制帧映射或单独的运动通道；仅完成 JSON 房间协议只能进入大厅和房间，不能保证多人比赛画面同步。这一边界与单人计时赛无关。

## 数据存储事实与本地新增方案

原版下载物没有服务端实现。当前单人档案写在浏览器 `localStorage` 的 `kartrider-web:p3528:user-profile-v2`，结构含 `equipment,initial,favoriteTracks,favoriteItems,garage`（`rewrite/src/ui/local-profile.ts:1-39,172-212`）；本地昵称另存 `kartsim.local-nickname`（`rewrite/src/generated/multiplayer.js:621-635`）。计时赛摘要在 `kartrider-web:p3553:time-attack-records-v1`，旧版键是 p3528；Ghost 完整帧保存在 IndexedDB（`rewrite/src/game/ghost-records.ts:22-23,71-99`；`rewrite/src/game/ghost/record-store.ts:156-211`）。约 3.49 GiB 的游戏资源容器由静态服务提供并在浏览器 OPFS 缓存，不属于账号数据库（`rewrite/src/resources/container-store.ts:71-123`）。

**本地新增** 的 Java 持久化应明确记录账号、会话、个人资料、房间配置/成员、聊天和比赛摘要。原前端不会自动访问新的资料或记录接口；前端适配器必须显式读取、写入并处理版本冲突。房间的实时内存状态和持久化历史应分开：重启可恢复账号/资料/成绩，在线连接与正在进行的比赛按断线清理。具体新增 REST 路径以 Java 实现为准；不要把它们误认为原站已有接口。

当前 Java 工程已定义这些**本地新增**存储路径（`server/src/main/java/local/kartsim/server/StorageApi.java:23-139`）：

| 方法 | 路径 | 内容 |
| --- | --- | --- |
| GET / PUT | `/api/profile/{ownerId}` | 读取或保存完整资料 JSON；读取不存在时返回 404 |
| GET | `/api/records/{ownerId}` | 列出该所有者的记录摘要，含 `recordId,record,updatedAt` |
| GET / PUT | `/api/records/{ownerId}/{recordId}` | 读取或保存单条记录 JSON；读取不存在时返回 404 |

`ownerId` 必须是 UUID，`recordId` 只接受 1–100 位字母、数字、下划线和短横线。所有资料/记录请求带 `X-Profile-Key`：首次 PUT 绑定该所有者的 43 字符密钥，之后读写需要同一密钥。前端将稳定 `ownerId` 和密钥保存在本机（`rewrite/src/ui/profile-sync.ts:4-38,52-55`）。游客每次联机握手可能分配新的 `playerId`，不能把它当持久资料 ID。原 Ghost 记录键含 NUL 分隔符（`rewrite/src/game/ghost-records.ts:25-33`），写入新接口前应使用稳定的 URL 安全编码或摘要。当前前端只同步 Ghost **摘要**，完整回放帧仍在浏览器 IndexedDB，见 `rewrite/src/game/ghost-summary-sync.ts:15-36`。Java 数据文件默认为服务进程工作目录下的 `./data/kart.db`，可用 `KART_DATA_DIR` 改目录；建表见 `server/src/main/java/local/kartsim/server/Database.java:20-75`。
