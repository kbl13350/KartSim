# KartSim 本地镜像

项目包含前端 v39.11、前端图片/Worker/WASM、p3553 清单中的 1695 个游戏容器文件（约 3.49 GiB）、APK 素材与分析文件、可开发的 TypeScript 工程及本地 Go 服务端（`server-go/`；早期的 Java 版保留在 `server/` 仅作参考）。大型游戏资源通过 Git LFS 上传；依赖、构建产物和带本机路径的 JADX 反编译输出不进入仓库。

克隆仓库前请安装 Git LFS，并在仓库目录中确认资源已拉取：

```sh
git lfs install
git lfs pull
```

`git lfs pull` 会取得大型游戏资源。若要重新从源站下载或校验资源，可安装 Python `requests` 并运行 `download_resources.py`；该脚本交互式读取源站访问密码，不会把密码写入项目。

## 启动

资源准备完成后，在本目录运行：

```sh
./run-local.sh
```

浏览器打开 <http://127.0.0.1:8765/>，首次进入时选“使用在线资源”。这里的“在线资源”会从本机 `mirror/p3553` 读取；浏览器会把当前游戏需要的容器缓存在自身存储中。默认只绑定本机地址。要换端口可运行 `./run-local.sh 9000`。

## 可开发版与 Go 服务端一起运行

服务端在 [`server-go/`](server-go/README.md)：一个数据服务 `kart-data`（账号、账号经济、档案、历史、游戏服列表与入场票据，唯一访问 MySQL 与 Redis 的进程）加若干游戏节点 `kart-game`（房间与比赛在内存中，玩家经 WebSocket 连接）。需要 Go 1.26+、Node.js 22+、MySQL 8.4 和 Redis 7。首次使用先准备数据库：

```sh
brew install mysql@8.4 redis && brew services start mysql@8.4 && brew services start redis
mysql -h127.0.0.1 -P3306 -uroot -p < server-go/scripts/init-mysql.sql
# 或者用 Docker：docker compose -f server-go/scripts/dev-deps.compose.yml up -d
```

已下载资源后，执行：

```sh
./run-full-local.sh                 # KART_GAME_NODES=2 ./run-full-local.sh 可同时启动两个游戏节点
```

它先检查端口、MySQL 与 Redis（不可用时打印启动和建库命令），构建 `server-go/bin/kart-data` 与 `kart-game`，依次启动数据服务（<http://127.0.0.1:8787/>）和游戏节点（8788 起），再启动 `rewrite/` 中的前端。前端地址与管理页面地址（<http://127.0.0.1:8787/multiplayer/admin>）由终端打印（前端默认 <http://127.0.0.1:8780/>）。按 Ctrl-C 结束全部进程。MySQL 与 Redis 不在默认地址时设置 `KART_MYSQL_DSN`、`KART_REDIS_ADDR`。开发用集群密钥自动生成在 `server-go/data/cluster-secret`。`./run-lan.sh` 让局域网设备通过 HTTPS 访问（单个游戏节点经前端同源代理）。生产部署用 `server-go/docker-compose.yml`。环境变量、API、Redis 键、发件箱、旧 SQLite 数据迁移与分布式部署见 [`server-go/README.md`](server-go/README.md)；原客户端协议与本地扩展的区别见 [`SERVER_PROTOCOL.md`](SERVER_PROTOCOL.md)。

打开游戏必须先登录：默认开放注册（用户名、昵称、密码），没有游客模式；新账号在新车手对话框中领取新手礼包（练习车 + 皮蛋/黑妞二选一 + 喷漆与染色）后进入主界面。账号有等级与经验、点券/金币/K币三种货币和库存，商店按原版货币与期限出售车库能装备的物品，联机比赛与计时赛按原版规则奖励经验和金币，车库只能装备自己拥有的物品。管理员由 `KART_ADMIN_USERNAMES` 指定（例如 `KART_ADMIN_USERNAMES=alice ./run-full-local.sh`），在管理页面查询账号并发放点券、金币、K币或经验；`KART_REGISTRATION=invite|closed` 可改为邀请码注册或关闭注册。详见 [`server-go/README.md`](server-go/README.md)“账号经济”与 [`server-go/ECONOMY.md`](server-go/ECONOMY.md)。

进入联机大厅时，前端先向数据服务取游戏服列表（只有一个时自动进入），为选中的服申请一次性入场票据（需要登录），再用 WebSocket 连接该游戏节点；会话 token 不会发给游戏节点。支持普通、抓地、幽灵、挡人、巨人、RP 和 LTE Web 试玩的房间与赛程流程。挡人模式需要至少五人；LTE 目前包含专用赛道与 Z/X 躲闪，自动补氮气和香蕉事件尚未实现。档案、计时赛摘要、多人赛果及挡人胜负写入 MySQL（赛果经游戏节点的发件箱异步提交，稍后出现在历史接口中）；完整 Ghost 回放帧仍由浏览器 IndexedDB 保存。原始镜像运行方式保持发行版的远端多人配置。

服务运行后可执行端到端检查：`node server-smoke.mjs` 覆盖游戏服列表、票据规则、大厅、房间与个人/组队比赛、比赛奖励及结算；`node server-special-smoke.mjs` 覆盖四种新增模式的建房、开赛、模式数据、奖励、结算和回房，巨人模式还检查状态广播。两者都使用真实前端房间与事件校验器；没有游客后它们会注册测试账号并领取新手礼包（注册按 IP 每小时限 5 次，脚本为每个账号发送不同的 `X-Forwarded-For`，本机 `run-full-local.sh` 启动的服务默认信任它；其他部署可用 `KART_SMOKE_ACCOUNTS=用户名:密码,…` 提供已有账号），并会在所连集群的 MySQL 中留下测试账号与赛果，请对测试部署运行。`server-go/test/auth-smoke.mjs`（账号、邀请、票据、发件箱）与 `server-go/test/economy-smoke.mjs`（注册、新手礼包、商店、库存、奖励、流水、管理接口）会自行启动服务并使用临时数据库，例如 `KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3306 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6379 node server-go/test/economy-smoke.mjs`；`node server-go/test/run-cluster-smokes.mjs`（同样的变量）会启动临时集群并对它运行上面两个脚本和 `server-go/test/smoke.mjs`。见 `server-go/README.md`“测试”。

## 重新下载或校验资源

```sh
python3 download_resources.py
```

脚本会提示输入网站访问密码，不会把密码写入项目。需要 Python `requests` 包。已存在且校验通过的文件会跳过；中断下载的 `.part` 文件可续传。

## 范围

源站当前实际运行并公开提供完整清单的是 p3553。前端还提及 p3528、p3543，但这两个版本的清单及容器在已检查的源站地址不可用，因此镜像只包含可取得的 p3553 完整资源。`run-local.sh` 启动的发行版镜像仍指向源站远程多人后端；本地服务端请使用上面的可开发版启动方式。

## Service Worker 资源路由

页面先注册根路径的 [`mirror/sw.js`](mirror/sw.js)，取得控制权后才加载游戏。SW 接管 `/p3553/` 下的 `.rho`、`.rho5`、`aaa.pk` 和 WASM 解码器请求。大容器保持流式从本地静态服务读取，仍由游戏按需存入 OPFS；SW 只在浏览器 Cache Storage 中保存约 90 KB 的 WASM，避免重复存储全部约 3.49 GiB 容器。响应头 `X-KartSim-SW` 可用于检查请求是否经过 SW（`archive`、`wasm-network` 或 `wasm-cache`）。

SW 需要本机 `127.0.0.1` 或 HTTPS 页面。首次打开会等待注册和接管；如果浏览器不支持或注册失败，游戏仍会从静态服务读取资源。已在浏览器 OPFS 中的容器不会重新发起网络请求，因此也不会再次经过 SW。当前实现不缓存页面、主程序和资源清单，启动游戏仍需运行本地服务。

## 源码恢复

前端发行包的可读化代码、功能索引、车辆参数及资源包内的 XML/BML 配置见 [`recovered/README.md`](recovered/README.md)。

## 可开发工程

按业务边界拆出的 Vite/TypeScript 工程见 [`rewrite/README.md`](rewrite/README.md)。在本目录运行 `cd rewrite && npm ci && npm run dev`，然后打开 <http://127.0.0.1:8780/>。它可在本地运行并进入计时赛；`rewrite/src/generated/` 仍保留尚未手写迁移的兼容实现。
