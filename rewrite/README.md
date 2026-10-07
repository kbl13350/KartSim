# KartSim 可开发工程

这里是依据本地镜像的 KartSim v39.11 前端发行文件重建的开发工程。应用已按资源、驾驶、车辆、世界、界面、计时赛和联机等边界拆为 ES 模块，并能使用同目录外的 `mirror/` 资源运行。它不是游戏作者的原始仓库：发行文件没有提供原始 source map，原文件名、注释和大部分变量名无法可靠还原。

## 运行

需要 Node.js 24、npm、Python 3，以及仓库根目录已通过 Git LFS 拉取的 `mirror/p3553`。新克隆的仓库需先按[根目录说明](../README.md#启动)运行 `git lfs pull`，再在本目录执行：

```sh
npm ci
npm run dev
```

开发地址为 <http://127.0.0.1:8780/>。首次进入时选择“使用在线资源”；在这个地址下，它会读取本机 `../mirror/p3553`，按需缓存容器。开发服务器只监听本机。

比赛默认关闭游戏侧垂直同步，可在“设置 → 显示/音量”中切换“垂直同步（比赛）”。关闭时，比赛更新和渲染提交不再等待浏览器的 `requestAnimationFrame`；菜单、暂停、结算及后台页面仍使用浏览器帧调度。网页无法强制关闭浏览器合成器或显卡驱动的同步，FPS 表示游戏提交帧率，实际显示还受屏幕刷新率限制。主 3D 画布最多渲染 1920×1080 像素，小视口保持原分辨率，独立界面画布仍按设备分辨率绘制。地图和天空的几何数据会在加载阶段预热，以减轻开局首帧上传负担。

如需本地多人服务和档案持久化，请在仓库根目录运行 `./run-full-local.sh`。它启动前端 `127.0.0.1:8780` 和 Java 服务 `127.0.0.1:8787`。前端默认用 WebSocket 连接 `/multiplayer/ws`；不再加载镜像里指向远程站点的 `multiplayer-config.js`。单独启动前端时，单人游戏仍可运行，进入多人大厅需要 Java 服务。可通过 `VITE_MULTIPLAYER_BACKEND_ORIGIN` 改后端地址，通过 `VITE_MULTIPLAYER_TRANSPORT=webrtc` 切回原协议；跨域地址需由服务端允许。

单人车库资料先写浏览器 `localStorage`，随后用固定本地 UUID 和随机密钥同步到 Java 的 `/api/profile/{ownerId}`。启动时已有浏览器资料优先；只有本地资料缺失才从服务端导入。计时赛成绩摘要同步到 `/api/records/{ownerId}/ghost-summary-index`；影子回放帧仍保存在浏览器 IndexedDB，因此从服务端导入的摘要不会错误地显示为可播放回放。浏览器密钥存于本地 `localStorage`，清除站点数据会失去访问该服务端档案的密钥，请在迁移浏览器前备份站点数据。

进入 Ready 后可从底部任务栏打开“小屋”，在首页上方的游戏区域显示场景，并保留底部任务栏。场景读取原版 `myRoom.rho` 的环境清单，加载对应的 `track.1s` 与 `skydome.1s`，在原版车手与停车位站位显示当前人物和已装备赛车；人物使用普通角色模型，并分别播放原版直立待机与步行动作。WASD 或方向键移动人物、滚轮缩放视角，并可切换主题。小屋名称与留言是当前 Web 版的本地设置。小屋内的“我的物品”参照原版 `dialog.rho` 的仓库分类、四列布局、搜索和卡片状态；资源目录中经车库目录识别且有有效装备身份的物品按本工程玩法全部开放装备，无需原站账号持有记录。已有档案装备槽但尚无比赛场景外观或效果的类别会在仓库中标明。星标、赛车锁定、小屋设置及装备变化保存在同一份本地档案，并按上述方式同步到 Java 服务。原版的访客、聊天、抽奖和消耗品操作尚未接入。逆向依据与实现边界见 [小屋与仓库资源分析](MY_ROOM_REVERSE_ENGINEERING.md)。

一键检查并打包：

```sh
npm run verify
./run-built.sh
```

打包版默认地址为 <http://127.0.0.1:8781/>。`dist/` 中的资源目录是指向 `../mirror` 的相对符号链接，因此应连同本工程和镜像一起使用；它并不是独立的 3.49 GiB 离线安装包。可以给 `run-built.sh` 传入端口号。

## 代码地图

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `src/main.ts` | Service Worker 注册与应用启动 | 手写 TypeScript |
| `src/game/api.ts` | 各系统的稳定、可读导出名 | 手写 TypeScript 门面；实现来自手写或兼容模块 |
| `src/game/ghost-records.ts`、`src/game/ghost/` | 影子记录摘要、帧编解码、KSV 文件格式及 IndexedDB 存取 | 手写 TypeScript，已替换对应发行版业务逻辑；zlib 由固定版本的 `pako` 包提供 |
| `src/input/` | 驾驶按键、触屏与游戏手柄状态、漂移和控制位 | 手写 TypeScript，已替换对应发行版实现 |
| `src/driving/` | 车辆构造、状态、控制、帧循环、碰撞、增压、仪表与视觉 | `AL` 的 173 个方法均由手写 TypeScript 接入；字段声明和外部辅助仍在兼容层 |
| `src/world/` | 赛道路线、门、事件、碰撞与场景生命周期 | 手写 TypeScript；启动时安装到兼容世界类 |
| `src/app/`、`src/timeattack/` | 资源启动、首次车手注册、运行依赖接口、应用快捷键、暂停/重开、画布尺寸、Ghost 菜单、退出清理、Ready 流程、开赛/返回导航及计时赛生命周期 | 手写 TypeScript；`Bf0` 的全部方法与访问器、`vf0` 演示控制器整类、Ready 控制器、计时赛阶段和记录服务方法已接入 |
| `src/ui/` | Ready 视图与车辆预览、随机选图、设置、车库选择、装备及 Factory 提交、任务栏、滚动条、车库画布、本地档案与收藏 | 手写 TypeScript；`C7` 车库选择、`oy` 设置窗口、`_7` 选图窗口与 `tI` 比赛 HUD 整类、`ty`、`ny`、`Tc0` 和懒加载车库的对应业务方法已接入，其余视图仍需兼容层 |
| `src/vehicle/` | 赛道金币、人物动作、车辆动画、音效、资源总装配、赛道加载、充能特效、车膜和悬挂饰品运动 | 手写 TypeScript；`ul` 全部方法、`pv` 音效、`sv` 加速模糊与 `Fk` MQ 转速表整类已接入，底层模型与其他特效辅助仍在兼容层 |
| `src/resources/` | 资源清单、档案索引、容器缓存、赛道与车库目录、车辆身份、配置及原接口适配器 | 手写 TypeScript；`Sw` 的全部 38 个方法已接入游戏 |
| `src/codecs/` | Rho/Rho5 索引扫描、挂载、解码及二进制 XML/BML 解码 | 手写 TypeScript；`Sw.load` 静态方法已接入游戏 |
| `src/physics/` | 车辆物理参数、可编辑 CSV/JSON 和查找规则 | 手写 TypeScript；`data.js` 现转发可编辑数据，表解析与车型查询已接入游戏，其他范围见模块文档 |
| `src/multiplayer/` | HTTP、WebRTC、WebSocket、协议、房间、大厅与本地/远端赛况 | 手写 TypeScript；本地比赛 `Ci0` 整类已接入；游戏客户端默认接仓库中的 Java 服务；其余视图仍需兼容层 |
| `src/ui/profile-sync.ts`、`src/game/ghost-summary-sync.ts` | 本地资料与成绩摘要的 Java 存储同步 | 手写 TypeScript；本地数据优先，离线可继续游玩 |
| `src/generated/` | 从 v39.11 发行包按语法边界拆出的兼容模块 | 自动生成，仍有压缩名称；不要直接编辑 |
| `tools/generate-modules.mjs` | 检验源包哈希、拆模块、计算跨模块依赖、注入手写替代模块 | 可维护的迁移工具 |
| `tools/link-build-assets.mjs` | 为打包版链接镜像资源、复制小型运行文件 | 构建工具 |

启动后，`src/main.ts` 注册 Service Worker，安装赛道世界方法，再加载 `src/generated/app.js`。`Sw.load` 与 `Sw` 的资源业务方法由生成器接到新代码。兼容模块维持尚未迁移的菜单、渲染及业务方法。生成器把已验证的驾驶、资源、车辆表现、界面交互、应用控制、影子记录、计时赛和联机实现接入运行路径。新逻辑优先在对应 TypeScript 目录实现，再通过生成器的 override 接入；请勿直接修改 `src/generated/`。生成细节见 `tools/README.md`。

## 继续开发的方法

1. 从 `src/game/api.ts` 的可读导出名和 `recovered/analysis/architecture.md` 找到系统入口。
2. 对照 `recovered/formatted/index.js` 与 `recovered/data-full/` 的配置，先确定当前行为、数据格式和调用点。`recovered/` 是供追溯的发行版还原稿，不是新工程的编辑入口。
3. 在 `src/` 写带类型的新模块，并用真实镜像数据或原实现的差分结果验证。
4. 需要让游戏实际使用新模块时，在 `tools/generate-modules.mjs` 中加入稳定的声明替换与导入，再运行 `npm run generate`、`npm test`、`npm run typecheck`、`npm run build`。浏览器中至少复测菜单、车库及进入计时赛。

`npm run generate` 以固定哈希的发行版文件为输入；如果下载版本改变，它会拒绝继续，避免悄悄生成不匹配的应用。资源清单和容器同样按版本与修订号校验。Service Worker 路由 `.rho`、`.rho5`、`aaa.pk` 和音频 WASM；大文件按需从本机静态服务流式读取，不会在 SW 缓存里复制整份镜像。详细缓存行为见根目录 `README.md`。

模块依赖、各生成模块职责及迁移检查点见 `ARCHITECTURE.md`。

## 已验证的范围与剩余工作

目前已在浏览器里跑通：本地资源加载、创建本地车手、计时赛菜单、车库懒加载及车型/部件列表、进入真实赛道并显示赛车和计时界面；连续加速输入使车速变化，暂停后可以返回 Ready。最新构建走过这条路径时，浏览器控制台没有警告或错误。接入的新解码器建立的 137,609 个虚拟条目与原资源库的路径/元数据逐项一致；输入与影子记录替换有发行实现差分测试。资源清单、档案索引和 Rho/Rho5 解码测试使用真实 p3553 数据，车辆参数表与查询结果也已逐项核对。

影子记录的帧编解码与存储还经过真实浏览器 IndexedDB 写入、读取、列举和删除验证；可在开发服务器打开 `/tests/browser/ghost-store.html` 重测。KSV 外层格式也已手写，可用 `/tests/browser/ksv-codec.html` 检查浏览器读写闭环；底层 zlib 使用 `pako@2.1.0`，字节输出已与发行版逐项比对。

`src/generated/` 当前仍有约 1.0 MB 的场景格式、渲染、界面、车辆和车库兼容代码保留发行版压缩名称。完整手写重构尚未完成；每个已替换范围都由 `src/generated/manifest.json` 和相应的差分测试标明。暂停菜单资源、画布交互和赛前车辆预览已迁到 `src/timeattack/`，并在真实浏览器中验证进入赛道和 Esc 暂停。原网页只交付浏览器客户端，仓库内 `server/` 是依照可观察协议新写的 Java 实现。联机协议边界见 `src/multiplayer/README.md`。
