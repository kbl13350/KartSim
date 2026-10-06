# 联机客户端协议索引（从前端推断）

本页只记录下载到的前端包和配置**实际构造、发送或校验**的内容。它不是服务端源码、完整协议规范，也不能证明服务端当前仍支持这些请求。行号针对本次恢复的文件；`recovered/modules/` 是从主包切出的阅读片段，不是原始源码模块。

## 地址与连接入口

- 页面先加载 [`multiplayer-config.js`](../../mirror/index.html#L25)。配置列出允许的前端来源 `https://kart.10002221.xyz`、`https://cdnkart.10002221.xyz`，以及后端来源 `https://140.210.12.188:8443`：见[配置](../../mirror/multiplayer-config.js#L1)。客户端要求当前页面来源位于 `frontendOrigins`，校验后端为无路径的 HTTP(S) origin；HTTPS 页面要求 HTTPS 后端，然后把端点拼为 `<backendOrigin>/multiplayer/<path>`：[来源校验与 `Ko`](../modules/07-multiplayer.js#L1371)。因此直接从未加入配置的本地页面进入多人模式会被客户端拒绝。
- 大厅入口 [`Wl0.open()`](../modules/07-multiplayer.js#L5067) 先取 `GET /multiplayer/healthz`，要求返回整数 `protocolVersion` 等于客户端常量 **39**（规则集字符串为 `launcher-room-v1`：[常量](../formatted/index.js#L94319)），再处理账号或游客昵称，最后调用 [`LT.connect()`](../modules/07-multiplayer.js#L5136)。
- 客户端在 [`LT.connect()`](../modules/07-multiplayer.js#L1064) 建立 `RTCPeerConnection`，开有序 `control`（id 0）和无序、零重传的二进制 `motion`（id 1）数据通道。它向 `POST /multiplayer/offer` 发送 JSON `{type:"offer",sdp}`，期望 `{type:"answer",sdp}`；若已有会话 token，附 `Authorization: Bearer …`：[HTTP 信令](../modules/07-multiplayer.js#L1185)。通道打开后发送 `hello`，期望 `welcome`，再校时并每 10 秒发一次 `clock`：[握手与心跳](../modules/07-multiplayer.js#L1212)。下载到的主包没有发现 WebSocket 构造入口；可见的联机传输是 HTTP 信令加 WebRTC 数据通道。
- 若 `welcome.capabilities` 包含 `p2p-motion`，客户端还取 `GET /multiplayer/ice` 获取 ICE 服务器配置，每 30 分钟刷新；它允许固定的 Cloudflare STUN/TURN 地址集合：[ICE 获取](../modules/07-multiplayer.js#L1221)、[白名单](../modules/07-multiplayer.js#L138)。比赛内玩家之间另建 `peer-motion`（id 1）和 `peer-control`（id 0），用 `p2p-signal` 传 offer/answer；直连不可用时可经服务器 motion 通道中继：[对等连接](../modules/07-multiplayer.js#L182)、[中继选择](../modules/07-multiplayer.js#L442)。

## HTTP 端点（客户端可见）

| 相对 `/multiplayer/` 的路径 | 客户端行为与证据 |
| --- | --- |
| `healthz` | GET，检查 `protocolVersion`：[入口](../modules/07-multiplayer.js#L5069)。 |
| `auth/config` | GET，读取 `loginRequired`、`backendOrigin` 并核对配置：[账号入口](../modules/07-multiplayer.js#L1628)。 |
| `auth/guest-name` | POST `{name}`，检查 `available`：[游客昵称](../modules/07-multiplayer.js#L1665)。 |
| `auth/register`、`auth/login`、`auth/me`、`auth/nickname` | 通用 [`Xo()`](../modules/07-multiplayer.js#L1514) 发请求；注册用 `username,nickname,password,invite`，登录用 `username,password`，成功登录保存返回的 token 于 `sessionStorage`：[调用](../modules/07-multiplayer.js#L1588)、[token 存储](../modules/07-multiplayer.js#L1427)。 |
| `auth/logout` | POST `{}`，随后清除本地 token：[退出](../modules/07-multiplayer.js#L1794)。 |
| `admin` | 管理员账号界面生成的链接；前端未把它当 JSON API 调用：[链接](../modules/07-multiplayer.js#L1763)。 |
| `offer`、`ice` | WebRTC 信令 POST 和 ICE 配置 GET：[信令](../modules/07-multiplayer.js#L1185)、[ICE](../modules/07-multiplayer.js#L1227)。 |

HTTP 请求使用 `credentials: "same-origin"`；有会话 token 时，账号请求和联机信令/ICE 请求带 Bearer 头：[账号请求](../modules/07-multiplayer.js#L1514)、[信令](../modules/07-multiplayer.js#L1185)。这只是客户端的发送方式，服务端鉴权规则未知。

## `control` 数据通道消息

请求通过 [`LT.request()`](../modules/07-multiplayer.js#L1287) 以 JSON 发送，自动添加递增字符串 `requestId`，按同一 id 匹配响应；请求超时为 10 秒。接收端先用 [`zo0()`](../formatted/index.js#L94632) 校验消息形状，`error.code` 会被转成请求异常：[接收处理](../modules/07-multiplayer.js#L1093)。

| 方向 | 客户端可见的 `type`、主要字段和入口 |
| --- | --- |
| 客户端 → 服务端：连接/时钟 | `hello` (`protocolVersion`, `ruleset`, `resourceVersion`, `name`, `equipment`, `initial`, `raceRuntime`)；`clock` (`clientTick`)：[握手](../modules/07-multiplayer.js#L1212)。 |
| 客户端 → 服务端：大厅/房间 | `list-ordinary`、`list-gameplay` (`page`, `gameplay`)；`create`、`join` (`roomId`, `password`)；`leave`、`ready`、`start`、`team`、`track`、`random-track`、`slot`、`kick`、`kick-vote`、`transfer-host`、`equipment`、`changing`、`get-room-settings`、`room-settings`、`chat`：[列表](../modules/07-multiplayer.js#L5554)、[房间操作](../modules/07-multiplayer.js#L5424)、[设置与创建](../modules/07-multiplayer.js#L6127)。多数状态变更带 `roomId` 和当前 `revision`；各字段以对应调用点为准。 |
| 客户端 → 服务端：比赛 | `loaded`、`load-failed`；`finish` (`elapsedMs`)、`return-room`、`race-chat`、`team-charge`、`giant-state`、`award-motion`、`latency-reply`：[加载](../modules/07-multiplayer.js#L100)、[比赛连接](../modules/07-multiplayer.js#L751)、[延迟回复](../modules/07-multiplayer.js#L1100)。 |
| 客户端 → 服务端：对等连接 | `p2p-signal` (`roomId`, `raceId`, `targetId`, `kind`, `sdp`, `generation`)；`p2p-relay` (`targetId`)：[信令](../modules/07-multiplayer.js#L300)、[请求中继](../modules/07-multiplayer.js#L552)。 |
| 服务端 → 客户端：已校验类型 | `welcome`、`clock`、`rooms`、`room`、`room-settings`、`chat`、`race-chat`、`left`、`error`、`team-gauge`、`giant-state`、`award-motion`、`latency-probe`、`latency`、`latency-ack`、`p2p-signal`、`p2p-relay`、`p2p-accepted`：[完整校验分支](../formatted/index.js#L94632)。`room` 包含 `roomId`、递增 `revision`、成员、阶段与可选 race；阶段为 `open/loading/countdown/racing/finished`：[房间校验](../formatted/index.js#L94344)。 |

## 动作数据与边界

`motion` 数据通道发送二进制包，不是 JSON。编码器 [`S40`](../formatted/index.js#L78311) 使用 56 字节头：魔数 `19277`、载荷类别、接收者掩码、三个 UUID（房间、比赛、玩家）及序号；解码器 [`E40`](../formatted/index.js#L78394) 校验包长、魔数和载荷类别。`LT.sendMotion()` 优先向玩家 `peer-motion` 发包，必要时向服务端 `motion` 通道发送带中继掩码的包：[发送](../modules/07-multiplayer.js#L1003)。对等 `peer-control` 另使用 JSON `ping`、`pong`、`motion-ack` 做探测：[控制消息](../modules/07-multiplayer.js#L513)。

以上消息类型是**客户端可见集合**，不等于服务端所有端点或全部消息。房间校验器描述的是客户端接受的状态形状，不代表服务端内部数据模型。当前镜像没有后端实现，因此仅凭这些代码不能把多人模式完整搬到本地运行。
