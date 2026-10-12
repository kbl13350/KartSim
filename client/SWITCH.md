# Nintendo Switch 移植（Brewser）

Switch 版运行在 [Brewser](https://github.com/natureglass/Brewser) 里。Brewser 是 Atmosphère 自制系统上的网页运行时，底层是 nx.js 分支：V8（带 JIT）、Skia、Mesa 上的 WebGL 1/2，还有自己的 DOM。现有网页客户端基本原样运行；平台差异集中在 `src/platform/`，加上几处由 `SWITCH_BUILD` 控制的分支。网页版行为不变，`SWITCH_BUILD` 为假时这些分支在打包时被裁掉。

不走官方路线有两个原因：官方 SDK 要签保密协议，美术资源是原版跑跑卡丁车的。所以这个包只能**私有侧载**，不要提交到 Brewser 的公开应用目录。

## 准备

- 装有 Atmosphère 的 Switch，`sdmc:/switch/brewser.nro` 来自 Brewser 发布页。本移植按 v0.1.1.31（2026-09-15）的源码适配。
- SD 卡上约 3.6 GB 空间：资源 3.5 GB，程序约 25 MB。最大的单个容器 344 MiB，FAT32 没问题。
- 一个 Switch 能访问到的 KartSim 服务器（见下文“服务器”）。

## 打包

```bash
cd client
npm run build:switch -- --server http://192.168.1.10:8780
```

- 输出目录是 `client/build/switch/com.kartsim.client/`（已在 `.gitignore` 中）。
  - 程序：`index.html`、`assets/`（单文件 bundle，约 6.7 MB）。
  - 界面图片：`ui/`、`classic-hud/`。
  - 资源清单与档案索引：`__p3553/`。
  - 全部资源容器：`p3553/`。macOS 上用 APFS 克隆，几秒完成，不占额外空间。
  - `manifest.json`、`kartsim-switch.json`（服务器地址），以及上一级的 `README.txt`。
- 把整个 `com.kartsim.client` 文件夹复制到 `sdmc:/switch/brewser/apps/com.kartsim.client/`。
- 以后只更新程序时，复制 `index.html` 和 `assets/` 即可，资源不用重复复制。
- 可选参数：
  - `--id com.xxx.yyy`：应用 id。
  - `--out`：输出目录。
  - `--mirror`：资源所在的镜像目录，默认找 `../mirror`，再找主检出目录。
  - `--no-archives`：不复制 `p3553/`。

`vite build --mode switch` 与网页构建有三点不同：

- 使用相对路径（`base: "./"`）。
- 不拆包，因为 Brewser 只能解析它预取过的动态 `import()`。
- 入口换成 `src/main-switch.ts`：先装平台层，再按顺序加载发行版模块。

## 服务器

- **地址**：Switch 连的是 `kartsim-switch.json` 里的 `server`。连不上时，游戏里会弹出游戏风格的“服务器地址”窗口：可以改地址，点“连接”后记住新地址（保存在 localStorage，下次启动优先使用）。
- **同源转发的部署（推荐）**：Docker 一键启动的客户端容器同源转发页面、账号、大厅和比赛，地址填 `http://<电脑IP>:8780`。`run-lan.sh` 用 Vite 同源转发，但只提供 HTTPS 自签名证书，Brewser 是否接受自签名证书还没验证，所以优先用 HTTP 的 8780。
- **直接用 `run-full-local.sh`**：
  - 两个服务要监听局域网：`KART_DATA_ADDR=0.0.0.0`、`KART_GAME_ADDR=0.0.0.0`。
  - 游戏节点向客户端公布的地址必须是 Switch 能访问的：`KART_GAME_PUBLIC_ORIGIN=http://<电脑IP>:{port}`。默认的 `127.0.0.1` 在 Switch 上无效。
- **Origin**：Brewser 的 WebSocket 握手带 `Origin: https://switch.brewser.io`，服务端的 `KART_LAN_HOSTS` 要信任它：写 `*`（Docker 与 `run-lan.sh` 的默认值），或在列表里加上 `switch.brewser.io`。
- **传输**：Brewser 没有 WebRTC，Switch 版固定用 WebSocket 连游戏节点。它也不协商 permessage-deflate，服务端照常工作，只是不压缩。

## 启动

1. 按住 R 启动任意游戏，进入完整内存的 hbmenu。小程序（applet）模式只有约 400 MB 内存，而且没有 JIT 和 WebGL 2，游戏跑不起来。
2. 打开 Brewser，在 Downloads（下载）页启动 KartSim。
3. 想要直达入口有两种办法：
   - 在应用详情里点 “Create shortcut”，生成 `sdmc:/switch/KartSim.nro`。
   - 把 `sdmc:/switch/brewser/configs/config.json` 的 `autorunApp` 设为 `apps/com.kartsim.client/index.html`，再用 Brewser 发布页的 forwarder NSP 放一个主页图标（需要 sigpatches）。
4. 退出：HOME → 关闭软件。`manifest.json` 把 Brewser 的所有外壳按键（返回、地址栏、主页、+ 退出等）都移到了无效的 HOME 标签上，游戏自己读取全部按键。

## 操作

| 场合 | 按键 |
| --- | --- |
| 菜单 | 左摇杆或十字键移动光标，A 点击（文本框会弹出 Brewser 键盘），B 返回（Esc），右摇杆滚动，触屏直接点 |
| 比赛 | ZR 或 A 油门，ZL 或十字键下倒车，B 漂移，Y 道具/加速，X 换道具，R 第二道具，L 能量键，左摇杆或十字键左右转向，左摇杆按下复位，右摇杆按下切换视角 |
| 任何时候 | + 等于 Esc：比赛中暂停，卡丁城里连按两次离开 |

比赛按键可以在游戏“设置”里修改，那里改的就是手柄映射。默认值见 `src/platform/switch-gamepad.ts`（索引按 Brewser 手柄垫片的顺序：0 A、1 B、2 X、3 Y、4 L、5 R、6 ZL、7 ZR、8 −、9 +）。光标只在菜单里出现：计时赛和多人比赛从倒计时开始到冲线前，以及卡丁城里，光标自动隐藏，手柄完全交给驾驶。

多人比赛原来只读键盘和触屏，现在和计时赛一样读手柄（`src/multiplayer/race-session-update.ts`），网页版也受益。

## 实现

| 文件 | 作用 |
| --- | --- |
| `src/main-switch.ts` | Switch 入口：平台层 → 载入画面 → `world.js` → `app.js` |
| `src/platform/platform.ts` | `SWITCH_BUILD`、Brewser 的 `Switch` 文件接口、打包文件的相对路径 `appAssetUrl` |
| `src/platform/switch-runtime.ts` | 启动顺序：补接口、诊断日志、`fetch` 路径改写、字体、共享 GL 上下文修正、服务器地址、手柄层 |
| `src/platform/brewser-polyfills.ts` | Brewser 缺的接口：`HTMLInputElement` 等元素接口（`instanceof`）、`MouseEvent`/`PointerEvent`/`WheelEvent`、`structuredClone`、`matchMedia`、`sessionStorage`、`elementFromPoint`，以及没有 ICU 时的数字和日期格式 |
| `src/platform/bundled-archives.ts` | 资源容器的读取：`Switch.readFile(path, {start, end})`（end 不含，见 Brewser `fs.cc`），浏览器里改用 HTTP Range |
| `src/resources/container-store.ts` | 内置资源模式（`bundled`）：所有容器都算已缓存；小读取合并成 32 KiB 块并进内存 LRU，512 KiB 以上直读；不用 OPFS，也不下载 |
| `src/platform/switch-input.ts` | 菜单光标（Brewser 软件鼠标无法在比赛中隐藏，所以关掉了）、B/+ 键、记录 `focus()` 的按键目标（Brewser 只对输入框实现 focus）；Brewser 内接管触屏 |
| `src/platform/hit-test.ts` | 自己的命中测试：z-index 层级、`pointer-events`，以及 `clip-path` 的 `inset()`/`polygon()`（窗口用它让点击穿透到任务栏，Brewser 没有实现 clip-path） |
| `src/platform/font-matching.ts` | Brewser 画布要求字体的字重和样式完全匹配，否则退回系统字体（缺简体字）；改写成已注册的字重，通用字体映射到“KartSim CJK”别名（思源黑体） |
| `src/platform/network-page.ts` | 服务器地址；网络代码把数据服务当作“页面来源”，因为本地页面的 `brewser://` 不是 http(s) |
| `src/platform/switch-gamepad.ts` | Joy-Con 默认映射（生成器的 `platform(switch)` 补丁替换发行版默认值） |
| `src/platform/unicode-regexp.ts` | `\p{L}` 正则改为运行时构造；没有 ICU 时用字符区间代替（否则整个模块语法错误） |
| `tools/switch/package-brewser.mjs` | 打包：程序、资源、manifest、横幅、服务器配置 |

其他 Switch 分支：

- 解压：没有流，直接用 fflate 同步解压，因为 Brewser 每帧只跑一次定时器。
- 前端版本检查：关闭。
- 载入提示：改为读取 SD 卡的文字。
- 连接失败：打开服务器地址窗口。

Brewser 里每个画布共用一个 GL 上下文，所以每次 `WebGLRenderer.render` 之前先 `resetState()`。

## 验证

在 Mac 上用无头 Chrome（1280×720、DPR 1）跑 Switch 包，并用脚本模拟 Brewser：

- 删掉它缺的接口：元素接口、鼠标/指针/滚轮事件、`structuredClone`、`matchMedia`、`sessionStorage`、`Intl`、WebRTC、IndexedDB、OPFS、Service Worker 等。
- 提供 `Switch.readFile`/`writeFile`。
- 用一个假手柄驱动。

以下流程全部用手柄或模拟触屏走通：

- 资源全部经 `Switch.readFile` 从“SD 卡”读取。
- 登录：光标点输入框、输入、点登录。
- 创建车手：画布按钮。
- 首页任务栏：`clip-path` 穿透。
- 单人游戏 → 计时赛 → 开始：
  - 比赛中光标隐藏，ZR 加速、摇杆转向。
  - + 暂停，暂停时光标可用，B 继续。
- 服务器地址窗口：连不上时弹出，改地址后连接。
- 多人：大厅 → 道具赛建房 → 陪练机器人加入 → 开赛（WebSocket）。比赛中光标隐藏，手柄驾驶。

比赛中 GC 后的 JS 堆约 200 MB（ArrayBuffer 另计约 140 MB），Brewser 的上限是 512 MB。单元测试见 `src/platform/platform.test.ts` 和 `src/multiplayer/race-session-update.test.ts`。

**需要真机确认**（读 Brewser 源码得到的风险，模拟不出来）：

- **WebGL 驱动（Mesa Nouveau）**：
  - 变形动画用到的 `sampler2DArray`/3D 纹理在 Brewser 文档里有“返回 0”的记录。
  - 顶点着色器里的 `texelFetch`（three.js 骨骼）被标为受阻。
  - S3TC 纹理是否可用取决于驱动。
  - 关闭了抗锯齿。
- **Web Audio**：Brewser 有一个把效果节点替换成静音桩的补丁，可能影响音效。
- **性能**：
  - Brewser 上每帧改动 DOM 要多花 7–10 ms，菜单里光标移动也属于 DOM 改动。
  - Tegra X1 的帧率还不知道。卡顿时先在“设置”里关掉阴影和描边。
- **字体**：DOM 文字是否用上了“KartSim CJK”别名。
- **触屏**：在根元素上拦截 Brewser 自己分发的触屏事件，这种做法在模拟里验证过，但还要真机确认。
- **中文输入**：Brewser 的屏幕键盘只有英文（没有输入法），中文昵称和中文聊天输入不了；用英文、数字账号和昵称。

## 排错

- 屏幕顶部的红条是未捕获的错误。最近 400 条警告和错误写在 `sdmc:/switch/brewser/apps/com.kartsim.client/kartsim-log.txt`，反馈问题时附上这个文件和截图。
- 卡在“正在连接数据服务”或弹出服务器地址窗口：
  - 检查地址、电脑防火墙。
  - 检查 `KART_LAN_HOSTS`。
  - 不是同源转发部署时，检查游戏节点公布的地址。
- 资源报错“找不到内置资源文件”：`p3553/` 没有完整复制到 SD 卡。
