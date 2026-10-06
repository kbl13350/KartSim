# KartSim 本地镜像

项目包含前端 v39.11、前端图片/Worker/WASM、p3553 清单中的 1695 个游戏容器文件（约 3.49 GiB）、APK 素材与分析文件、可开发的 TypeScript 工程及本地 Java 服务。大型游戏资源通过 Git LFS 上传；依赖、构建产物和带本机路径的 JADX 反编译输出不进入仓库。

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

## 可开发版与 Java 服务端一起运行

已下载资源后，执行：

```sh
./run-full-local.sh
```

它会构建并启动 `server/` 中的 Java 21 服务，再启动 `rewrite/` 中的前端。前端地址由终端打印（默认 <http://127.0.0.1:8780/>），Java 服务默认监听 <http://127.0.0.1:8787/>。首次构建会下载 Maven 和前端依赖。按 Ctrl-C 结束两个进程。服务端数据保存在 `server/data/kart.db`；详细 API、存储与代码导航见 [`server/README.md`](server/README.md)，原客户端协议与本地扩展的区别见 [`SERVER_PROTOCOL.md`](SERVER_PROTOCOL.md)。

本地可开发版用 WebSocket 连接 Java 服务，支持游客大厅、普通/抓地/幽灵竞速的房间流程，并把本地档案与计时赛摘要同步到 SQLite。完整 Ghost 回放帧仍由浏览器 IndexedDB 保存。原始镜像运行方式保持发行版的远端多人配置。

## 重新下载或校验资源

```sh
python3 download_resources.py
```

脚本会提示输入网站访问密码，不会把密码写入项目。需要 Python `requests` 包。已存在且校验通过的文件会跳过；中断下载的 `.part` 文件可续传。

## 范围

源站当前实际运行并公开提供完整清单的是 p3553。前端还提及 p3528、p3543，但这两个版本的清单及容器在已检查的源站地址不可用，因此镜像只包含可取得的 p3553 完整资源。`run-local.sh` 启动的发行版镜像仍指向源站远程多人后端；本地 Java 服务请使用上面的可开发版启动方式。

## Service Worker 资源路由

页面先注册根路径的 [`mirror/sw.js`](mirror/sw.js)，取得控制权后才加载游戏。SW 接管 `/p3553/` 下的 `.rho`、`.rho5`、`aaa.pk` 和 WASM 解码器请求。大容器保持流式从本地静态服务读取，仍由游戏按需存入 OPFS；SW 只在浏览器 Cache Storage 中保存约 90 KB 的 WASM，避免重复存储全部约 3.49 GiB 容器。响应头 `X-KartSim-SW` 可用于检查请求是否经过 SW（`archive`、`wasm-network` 或 `wasm-cache`）。

SW 需要本机 `127.0.0.1` 或 HTTPS 页面。首次打开会等待注册和接管；如果浏览器不支持或注册失败，游戏仍会从静态服务读取资源。已在浏览器 OPFS 中的容器不会重新发起网络请求，因此也不会再次经过 SW。当前实现不缓存页面、主程序和资源清单，启动游戏仍需运行本地服务。

## 源码恢复

前端发行包的可读化代码、功能索引、车辆参数及资源包内的 XML/BML 配置见 [`recovered/README.md`](recovered/README.md)。

## 可开发工程

按业务边界拆出的 Vite/TypeScript 工程见 [`rewrite/README.md`](rewrite/README.md)。在本目录运行 `cd rewrite && npm ci && npm run dev`，然后打开 <http://127.0.0.1:8780/>。它可在本地运行并进入计时赛；`rewrite/src/generated/` 仍保留尚未手写迁移的兼容实现。
