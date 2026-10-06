# KartSim 本地 Java 服务端

这是依据本地浏览器发行文件可观察到的协议编写的新服务端。发行包没有服务端源码，因此这里的实现不是原站点后端的反编译结果。代码用 Java 21、Spring Boot 和 SQLite，所有服务只监听本机 `127.0.0.1`。

## 启动

```sh
cd server
./mvnw package
java -jar target/kartsim-server-1.0.0.jar
```

默认端口是 `8787`，健康检查为 `http://127.0.0.1:8787/multiplayer/healthz`。首次启动会在控制台打印一个注册邀请码；首位注册用户自动成为管理员。没有注册也能以游客身份进入联机大厅。

`./mvnw` 优先使用系统 Maven；若没有，它会下载 Maven 3.9.11 并核对固定 SHA-512。数据库文件默认为 `server/data/kart.db`，可用 `KART_DATA_DIR=/绝对目录` 改变；端口可用 `KART_SERVER_PORT=8787` 改变。备份时先停止服务，再复制整个数据目录，包括 `kart.db` 与可能存在的 `-wal` 文件。

启动后运行端到端检查：

```sh
node test/smoke.mjs
node test/auth-smoke.mjs
```

第一个检查会建立两个游客连接，执行建房、入房、准备、聊天、开赛、载入、完赛及返回房间，并验证档案密钥和记录读写。它会留下测试档案、比赛结果及房间规则；建议在临时 `KART_DATA_DIR` 中运行。第二个检查自动启动独立端口和临时数据库，验证邀请、注册、登录、改名、token、存档鉴权和重启后持久化，结束时清理临时数据。

## 代码导航

| 文件 | 职责 |
| --- | --- |
| `KartServer.java` | Spring Boot 入口 |
| `Database.java` | SQLite 表结构与事务边界 |
| `Accounts.java`、`HttpApi.java` | 邀请、账号、会话与联机握手前的 HTTP API |
| `LocalWebSocket.java` | WebSocket 帧解析、请求 ID 回复、运动帧传输 |
| `LobbyService.java`、`Room.java` | 房间状态、命令、赛程及广播 |
| `GameModes.java` | 特殊玩法的赛道池、建房约束和比赛附加数据 |
| `StorageApi.java` | 本地档案和影子记录的可选同步 |
| `HistoryApi.java` | 已保存的房间规则和比赛结果查询 |

## HTTP API

| 路径 | 用途 |
| --- | --- |
| `GET /multiplayer/healthz` | 协议版本 39 与传输方式 |
| `GET /multiplayer/auth/config` | 本地后端地址，游客可用 |
| `POST /multiplayer/auth/guest-name` | 检查游客昵称；请求体 `{"name":"Alice"}` |
| `POST /multiplayer/auth/register` | 用户名、昵称、密码、邀请码注册 |
| `POST /multiplayer/auth/login` | 登录，返回 43 字符会话 token |
| `GET /multiplayer/auth/me` | Bearer token 查询账号 |
| `POST /multiplayer/auth/nickname`、`auth/logout` | 改名、退出 |
| `POST /multiplayer/admin/invites` | 管理员 Bearer token 创建邀请码 |
| `GET/PUT /api/profile/{ownerId}` | 读取/保存完整浏览器档案 JSON |
| `GET/PUT /api/records/{ownerId}/{recordId}` | 读取/保存一项影子记录 JSON |
| `GET /api/records/{ownerId}` | 列出该浏览器所有记录 |
| `GET /api/race-results?name=Alice` | 最近 100 条多人比赛结果 |
| `GET /api/race-outcomes?gameplay=roadblock` | 最近 100 局完整赛果，包括没有排名的挡人胜负 |
| `GET /api/room-rules` | 最近 100 份创建过的房间规则 |

档案和记录请求必须带 `X-Profile-Key`，值为浏览器首次随机生成的 32 字节 base64url 密钥。首次 PUT 将它的 SHA-256 摘要与 ownerId 绑定；之后使用同一密钥读写。ownerId 为 UUID。GET 未创建的档案返回 404，密钥不符返回 403。浏览器保留密钥原文，服务端只保存摘要。数据目录仍应当作私人文件保护。

若要换浏览器恢复档案，需要同时迁移浏览器保存的 ownerId 和 `X-Profile-Key`；当前本地版没有账号绑定的跨浏览器迁移界面。只复制 SQLite 文件而丢失这两个值，服务端无法判定新浏览器是同一档案的拥有者。

## WebSocket 协议

连接 `ws://127.0.0.1:8787/multiplayer/ws`。每个 JSON 请求带字符串 `requestId`；回复原样带回该 ID。失败回复为 `{"type":"error","requestId":"…","code":"…"}`。已登录用户可在 `hello` 消息中带 `token`，游客不带。成功 `hello` 返回 `welcome` 和玩家 UUID；`clock` 使用相对本进程启动时间的单调毫秒，与赛程时间同基准。

大厅/房间支持 `list-ordinary`、`list-gameplay`、`create`、`join`、`leave`、`ready`、`team`、`track`、`random-track`、`slot`、`kick`、`transfer-host`、`equipment`、`changing`、`get-room-settings`、`room-settings`、`chat`。比赛支持 `start`、`loaded`、`load-failed`、`finish`、`return-room`、`race-chat`、`award-motion`，以及巨人模式的 `giant-state` 和标准速度组队模式的 `team-charge`/`team-gauge`。房间更新使用完整 `room` 快照和递增 `revision`；开赛时 `race.startSlots` 冻结每位车手的 0–7 起跑位置；比赛中的二进制运动帧按客户端 56 字节头的房间、比赛、玩家 ID 与接收槽位校验后中继。

赛程支持普通、抓地、幽灵、挡人、巨人、RP 和 LTE。挡人模式至少五人，房主是跑者；跑者到达终点获胜，三分钟到期或跑者退出则挡人方获胜。巨人模式验证连续的状态序号并广播给其他车手。RP 从本地 P3553 目录与模型资源已核对的四辆赛车（387、390、378、361）中随机抽取，飞行宠物固定为 0；奖池尚未扩展到原站完整列表。LTE 是 Web 试玩：使用三张专用赛道和客户端的 Z/X 躲闪，自动补氮气及香蕉事件尚未完整实现。比赛结果和完整赛程快照写入 SQLite，其中挡人胜负保存在 `race_outcomes`；实时房间在进程内，重启后房间不恢复。直连 WebRTC 和原站专有后台运营功能不在这份本地协议内。

## 扩展

新增一条联机命令时，在 `LobbyService.handle` 分派，在对应方法中校验房间成员、阶段和字段，然后更新 `Room` 并递增 `revision`。新快照应先用 `rewrite/src/multiplayer/room-validation.ts` 验证，因为客户端会丢弃不合格式的事件。HTTP 存取逻辑集中于 `StorageApi` 和 `HistoryApi`；表结构及事务只在 `Database` 中管理。
