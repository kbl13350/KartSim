# 服务端反作弊（游戏节点）

游戏节点只转发运动帧、不跑物理：车的位置、路线进度、圈数、完赛时间和吃到的道具箱都由各自的浏览器上报。反作弊在服务端检查这些上报，发现诚实客户端不可能发出的上报时，记录并及时把该车手踢出比赛。

检测规则放在一个**可选插件** `anticheat.wasm` 里，节点在启动时加载。插件源码**不公开**：公开的规则等于告诉外挂作者怎样刚好不越线。仓库只提交编译好的插件（`plugins/anticheat.wasm`）。本文只说明宿主侧：怎样安装插件、踢出流程、记录格式和插件接口。

## 1. 宿主与插件的分工

| 部分 | 位置 | 公开 |
| --- | --- | --- |
| 运动帧格式校验：浏览器解码器解不开的帧一律不转发（否则接收方会断开整条游戏连接） | `internal/game/lobby/motion_payload.go` | 是，没有插件也生效 |
| 把比赛事件交给插件（开赛、运动帧、完赛、道具使用、吃箱、团队集气、结束），执行插件的处理结果 | `internal/game/lobby/anticheat.go`、`internal/game/cheat` | 是 |
| 插件加载器（WebAssembly，由 [wazero](https://wazero.io) 在进程内运行，纯 Go，节点仍是静态二进制） | `internal/game/cheat/plugin` | 是 |
| 具体检测项与阈值 | `plugins/anticheat.wasm` | 只提供编译产物 |

没有插件时，节点照常运行，只做格式校验，不做其他检查。启动日志会打印 `no anti-cheat plugin`。

## 2. 安装与配置

kart-game 启动时按顺序查找插件，用找到的第一个：

1. `KART_ANTICHEAT_PLUGIN` 指定的路径。设为 `off`（或 `none`）则不加载插件；指定的文件不存在时节点启动失败。
2. 可执行文件旁边的 `plugins/anticheat.wasm`。
3. 可执行文件上一级目录的 `plugins/anticheat.wasm`，即仓库里 `server-go/bin/kart-game` 对应的 `server-go/plugins/`。
4. `<可执行文件目录>/../lib/kart/plugins/anticheat.wasm`，即 Docker 镜像里的 `/usr/local/lib/kart/plugins/`。
5. 工作目录下的 `plugins/anticheat.wasm`。

加载成功时，日志打印 `anti-cheat plugin loaded`，带路径、插件名、版本和处理方式。

- **本机**：`run-full-local.sh` 会把 `server-go/plugins/*.wasm` 复制到运行目录，`test/lib/local-cluster.mjs` 启动的临时集群直接使用 `server-go/plugins/`。
- **Docker**：镜像把 `plugins/` 复制到 `/usr/local/lib/kart/plugins/`。要换成更新的插件、又不想重建镜像，可以挂载文件，再用 `KART_ANTICHEAT_PLUGIN` 指定它：

```yaml
services:
  game:
    volumes:
      - ./anticheat.wasm:/opt/kart/anticheat.wasm:ro
    environment:
      KART_ANTICHEAT_PLUGIN: /opt/kart/anticheat.wasm
```

所有以 `KART_ANTICHEAT` 开头的环境变量（`KART_ANTICHEAT_PLUGIN` 除外）都会原样交给插件，由插件解释。随仓库提供的插件支持：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `KART_ANTICHEAT` | `kick` | `kick`：记录并踢出；`log`：只记录、不踢，供线上观察；`off`：不检查 |

自带集群的测试脚本（`test/run-cluster-smokes.mjs`、`auth-smoke.mjs`、`economy-smoke.mjs`、`frontend-economy-check.mjs`、`item-bot-check.mjs`）用 `KART_ANTICHEAT=log` 启动游戏节点，因为它们的比赛不开车、开赛即报完赛。

插件出错时（陷入 trap、回复格式不对），节点会关闭这个插件，打印一次 `anti-cheat plugin failed`，之后不再做检查，比赛照常进行。

## 3. 踢出

插件要求踢出时（`lobby.cheated`），节点依次：

1. 给该连接发一条不带 `requestId` 的错误事件 `{"type":"error","code":"CHEAT_DETECTED","check":"<检测项>"}`；
2. 立即把它移出房间和本局，按断线处理：本局记为退出，未完赛者排在最后，没有奖励；
3. 这条事件写出后，以 1008 `anti-cheat` 关闭连接。`conn.Close` 会先冲刷队列，最多等 2 秒；WebRTC 等控制通道确认后再关；
4. 关闭前，它的命令都回复 403 `CHEAT_DETECTED`，运动帧一律丢弃；触发踢出的 `finish`、`cube` 请求本身也回复 `CHEAT_DETECTED`。

浏览器收到这条事件后，在连接关闭时弹出“已被移出比赛”的提示，然后回到大厅（`client/src/multiplayer/cheat-kick.ts`）。被踢后可以重新进入多人游戏；要禁止某个账号，由管理员在后台封禁（在记录页点账号，再点编辑）。

## 4. 记录

- 游戏节点把每次处理写成 `contract.AntiCheatReport`，经**发件箱**投递到 `POST /internal/v1/anti-cheat`。字段：节点、事件 UUID、车手、账号、当时的昵称、房间、比赛、赛道、玩法、检测项、详情、`kick`/`log`、时间。踢出会结束会话，所以一个连接最多产生一条记录。
- 检测项代码由插件定义，是大写标识符，最长 32 个字符；详情以检测项的中文名开头。
- 数据服务把记录存入 `anti_cheat_events`（**schema v14**），按事件 UUID 幂等。详情超过 255 字会截断，控制字符换成空格。与登录记录一样保留 180 天，每天清理。
- 后台“反作弊记录”页的接口是 `GET /api/admin/anti-cheat`。
  - 参数：通用列表参数；`code`；`action=kick|log`；`account`（ID 或用户名）；`node`（精确匹配）；`q` 匹配当时昵称、用户名、昵称、详情，以及车手、房间、比赛 ID。
  - 返回 `AntiCheatRow`：`id, at, code, detail, action, accountId, username, nickname, name, playerId, nodeId, roomId, raceId, trackId, trackName, gameplay`。游客的账号字段为空串。
- **部署顺序**：先部署数据服务，再部署游戏节点。旧数据服务对新路径会回 404，发件箱会无限重试，并按序阻塞后面的结算。

## 5. 插件接口（ABI 1）

插件是一个 WASI reactor 模块（例如 Go 的 `GOOS=wasip1 GOARCH=wasm -buildmode=c-shared`），导出两个函数：

- `ac_buffer(size u32) -> u32`：返回一块 `size` 字节缓冲区的地址，宿主把请求写进去；
- `ac_call(op u32, length u32) -> u64`：处理请求，返回 `回复地址 << 32 | 回复长度`（0 表示空回复）。

调用一次只有一个。各操作的编码见 `internal/game/cheat/plugin/plugin.go` 的 `op*` 常量：JSON 请求和回复使用 `internal/game/cheat` 的字段名，二进制部分是小端序。

| op | 名称 | 时机 |
| --- | --- | --- |
| 1 | init | 加载时：交给插件 ABI 版本与 `KART_ANTICHEAT*` 设置，插件回报名称、版本和处理方式 |
| 2 | race | 比赛进入倒计时 |
| 3 | racer | 某名车手第一次需要检查 |
| 4 | motion | 每个运动帧（附带宿主格式校验的结果） |
| 5 | finish | 车手上报完赛（可以附带统计，节点会打成 INFO 日志 `anti-cheat stats`） |
| 6 | itemUse | 道具赛：服务器接受了一次道具使用 |
| 7 | cube | 道具赛：吃到道具箱 |
| 8 | teamCharge | 组队竞速：团队集气上报 |
| 9 | progressCap | 计入结算的路线进度上限（插件不回答时用宿主的默认公式） |
| 10 | endRace | 比赛结束，或房间被移除 |

回复里的 `Violation` 是 `{"code","detail","action"}`，其中 `action` 为 `kick` 或 `log`。测试用的最小插件见 `internal/game/cheat/plugin/testdata/testplugin`。

## 6. 局限

- 服务器只能拒绝不可能出现的上报；在物理允许范围内的作弊检查不出来。
- 前提是运动帧都经过服务器：Go 节点不开启 P2P 运动（`welcome.capabilities` 为空）。
- 编译后的插件并非无法分析：WebAssembly 与 Go 二进制都能被反汇编，函数名和常量可以读出来。不公开源码只能提高分析门槛，不能保证规则保密。
