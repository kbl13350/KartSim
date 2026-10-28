# 资源层

这里是新工程的物理容器入口，按源码中的三层边界拆开：

1. `manifest.ts` 读取 `/__p3553/resources` 并校验版本、修订号、文件名、大小、时间戳、SHA-256 字段及大小写重复。
2. `archive-index.ts` 解压 `/__p3553/archive-index`，检查索引修订号与清单相同，并确认索引中的 `.rho`、`.rho5` 分包与清单逐个对应。
3. `container-store.ts` 管理按 `version-revision` 隔离的 OPFS 容器缓存：已缓存的容器从 OPFS 读；未缓存的大容器（> 1 MiB）用 HTTP Range 只取读取用到的 32 KiB 块（见下面“分段读取”），小容器或一次读取过半的容器先整包下载再读。整包下载复用已有长度正确的文件，流式校验新下载文件长度，报告进度，支持指定并发数的预加载和有边界检查的范围读取。用户选择的本地 Data 目录优先在下载前尝试，按大小和流式 SHA-256 校验，通过后直接读取，不复制到 OPFS。

`ArchiveCatalog.codecInputs()` 返回 `aaa.pk`、Rho 索引及来源、Rho5 索引及有序分包来源。二进制格式的挂载、解密、解压与校验应由独立 codec 实现；业务代码不要解析容器字节。`ArchiveSource` 的 `arrayBuffer`/`slice` 与原客户端 codec 的输入形状兼容。来源只在调用读取方法时触发下载。

`loadLegacyResourceBundle(version, onProgress, localDirectory)` 提供原发行版 `uo0` 的返回形状：`{ version, sources, archiveIndexes, preloadContainers }`（另附 `store`，供下面的资源分类与下载管理使用），可用于把新加载实现接到尚未重写的二进制 codec。`localDirectory` 应由界面选择 Data 文件夹并持有对应授权；该适配器不会弹出文件选择器。

`track-catalog.ts` 接管资源库的 8 个赛道目录方法：档案中的赛道模型、区域标题与元数据、计时赛可选赛道、反向赛道和随机赛道组。它已接入 `Sw`，精确方法列表见 `src/generated/manifest.json`。真实 p3553 的 `track_common.rho` BML 和档案索引与发行版逐项差分一致：391 条元数据、262 条可选赛道，标题和随机组也一致。

`resource-lookup.ts` 接管 `Sw` 的索引构造与核心查询：精确路径候选、前缀条目、同目录文件、物理容器名和挂载判断。真实 p3553 的 137,609 条虚拟资源记录与发行版查询结果逐项一致；它同样由生成器接入运行路径。

`vehicle-identity.ts` 接管 `Sw` 的 9 个车辆身份方法，解析可驾驶模型、车型目录、纹理键、引擎等级、物品 ID 和关联角色。真实 p3553 索引中的 1,096 个可驾驶模型，以及真实 `itemTable.kml` 中的身份映射，均与发行版差分一致；唯一的差别是 `item-table.ts` 按国服客户端把 `itemTable@cn.xml` 逐属性叠加上去（发行版只取了 `uniqueLevel`），所以 23 辆国服车（如 579/580 飓风 Z7+/暴走飓风Z7+ → `zeno4`/`zeno5`）和几个国服角色、装备用的是国服目录。

`garage-catalog.ts`、`timeattack-items.ts`、`item-table.ts`、`vehicle-titles.ts` 和 `track-config.ts` 接管车库物品、车辆标题与赛道配置业务。真实 p3553 的 ItemTable、国服覆盖数据和赛道配置与发行版差分一致。生成器已将 `Sw` 的全部 38 个方法接入本目录和 `src/codecs/sw-compat.ts`；类外的发行版辅助函数仍留在兼容模块。

## 资源分类与按需下载

`resource-groups.ts` 只根据清单文件名和 rho5 分包的文件路径把 1695 个容器分成 14 类，每个容器至少属于一类（共用的容器可同时属于几类）：首页（必需，约 368 MiB：界面、字体、首页场景与背景、国服界面、主菜单音乐、道具与赛道目录 DataPack1/4；启动不等它，进入首页后在后台下载）、比赛通用、赛道（按 `trackLocale@cn` 的主题名分成 33 个主题，每个主题含 `track_<主题>_*`、`theme_<主题>`、`sound_bgm_<主题>*` 及装着该主题赛道的 DataPack3 分包）、车辆、角色、宠物、小屋、商城与饰品、车库、多人游戏、剧情与驾照、活动与抽奖、俱乐部、其他。

`resource-manager.ts` 在容器仓库之上维护一个共享下载队列：同时下载 3 个容器，高优先级先下载，同一容器只下载一次；低优先级（后台）容器最多同时占 1 个名额，页面和比赛要下载时总有空位；比赛载入时（`holdBackground`）后台下载暂停：在途的容器中止，已下载的字节留在 OPFS（比清单短，不算已缓存），回到队列，载入完后用 `Range: bytes=<已有>-` 续传（服务器不支持 Range 时从头下载）；任务可暂停（未开始的容器离开队列），失败不影响页面——页面读取时仓库仍会按需读取。`ContainerStore` 为此新增 `cachedNames()`（OPFS 中长度正确的容器）、`remove(name)`、`addProgressListener()`、`ensure(name, { background })`（后台下载的进度带 `background`，启动页与加载徽标不显示，请求带 `priority: "low"`）和 `pauseBackground()`（中止只有后台在等的下载，抛 `DownloadPausedError`）。

### 分段读取与首次启动

首次启动不再等整包下载：到首页为止读到的容器合计约 870 MiB（stuff.rho 344 MiB 只读 0.01 MiB，车辆目录为几百字节把 18 个 DataPack2 分包整包下载），实际读取只有约 33 MiB。

- **分段读取**：未缓存的大容器按 32 KiB 块用 `Range` 请求读取；同一时刻（一个宏任务内）对同一容器的读取一起规划，相距不超过 4 块的缺块合并成一个请求；取到的块放在内存 LRU（96 MiB）里，容器整包下载完成后丢弃。响应必须是 206，`Content-Range`（跨域时可能读不到）与请求和清单大小一致，长度必须相符；服务器对 Range 回 200（例如 `python3 -m http.server`）时本会话改回整包下载。容器地址带清单里 SHA-256 的前 16 位（`/p3553/<名字>?v=<哈希>`），CDN 或代理缓存不会拿旧版本应答新清单。服务器上的容器和清单不是同一版本（`Content-Range` 的总长度，或整包下载的 `Content-Length` 与清单不同）时抛 `ContainerMismatchError`，不重试也不写入 OPFS：重新下载无济于事，只能刷新页面（页面比服务器旧）或由管理员更新服务器资源；`containerMismatch(error)` 沿 `cause` 链找到它。分段读取的字节在启动页“当前下载”上汇总显示（`partial` 进度：所有在途分段请求的已收/请求字节，全部完成后归零）。部署时静态服务器要支持 Range（Nginx 静态文件默认支持；`.rho/.rho5` 不要放进 `gzip_types`）。
- **启动读取列表**：`startup-reads.json` 记录首次启动（新账号）到首页、再进第一局计时赛读取的字节范围（`early`：车辆与赛道目录、登录窗口，约 11 MiB，其中思源黑体 7 MiB；`late`：登录后的 Ready 首页、任务栏、创建车手窗口，约 19 MiB；`race`：每局比赛都读的特效、道具、引擎与路面音效、仪表盘与比赛界面，约 5 MiB，不含因局而异的赛道、主题贴图、音乐、车辆、角色与宠物），`startup-reads.ts` 在资源清单载入后并行预取 `early`，到登录关口时再预取 `late`（玩家输入账号时就下载好），首页出现后预取 `race`（多数玩家接着就开赛），解码器读到时直接命中内存，不再一个文件一个往返。列表属于一个清单修订号，其他修订号跳过。启动流程或首页读取有较大变化时用 `tools/startup-reads.mjs` 重新生成（文件头有录制方法：`globalThis.__KART_READ_LOG__ = []` 让容器仓库记录每次读取）。
- **首页资源后台下载**：首页出现 3 秒后，“首页”类缺少的容器以低优先级整包下载（只占 1 个名额，进度在“资源下载”按钮上），下次启动从 OPFS 读。下载失败只提示，使用时按需读取。
- **比赛音乐延后解码**：启动时 `loadRaceBgm` 只等 Ready、车库与结算音乐，所选赛道主题的比赛音乐（城镇主题约 7 MiB ogg）在首页出现后才下载解码（`holdRacePlaylists`）；比赛载入时等它（`racePlaylistReady`，失败则重新载入）。
- **被动下载**：打开小屋、商城、车库、多人游戏、剧情、驾照、俱乐部、活动页面时（`ensureFeatureResources`），先下载该页面最先用到的几个容器（发行版 CaptionDialog 小窗“正在下载…资源”，带进度条，可点“后台下载”直接进入），页面打开后再以低优先级在后台下载该页面所属分类。
- **比赛载入不等整包下载**：原来进第一局要先整包下载本局赛道、主题贴图与音乐、“比赛通用”（133 MiB）和车辆/角色容器，30 Mbps 下约 54 秒，实际只读约 4 MiB。现在计时赛（`race-asset-builder.ts`）和多人比赛（`multiplayer/race-loader.ts`）载入时调用 `beginRaceLoad()`：再预取一次 `race`（首页时没取完的部分），暂停后台下载，其余（赛道、主题贴图、车辆、角色）按需分段读取；赛道场景装配（`track-scene-assembly.js`）在逐个节点建网格之前先并行读取全部贴图的字节，不再一张一张等往返。赛道不再随比赛整包下载（需要时在“资源下载”里按主题下载）。卡丁城仍整包下载城市自己的容器（`downloadTrack`，城市大部分都会读、常回来），比赛通用部分同样按需读取。
- **主动下载**：首页顶栏的“资源下载”按钮（以及启动后角落的下载徽标）打开资源下载窗口；下载中按钮显示“下载中 N%”，全部资源都已下载且没有任务时按钮隐藏，之后若有资源缺失（被删除或被浏览器清理）会自动重新出现。按钮隐藏后（资源都“在”但可能已损坏）仍可从 设置 → 变更设置 → 自定义设置 下方的“资源下载”按钮打开同一个窗口（`settingsResourceEntry`，叠在设置之上，关闭后焦点回到该按钮；没有资源管理器时这一行不显示）。进入卡丁城失败时弹出同样由发行版渲染器绘制的“进入卡丁城失败”窗口（`showResourceFailureNotice`）写明原因；失败发生在装配城市资源时，窗口带“资源下载”按钮，打开资源下载窗口并选中“卡丁城”分类，可删除后重新下载。原因是服务器资源版本不一致（`ContainerMismatchError`）时改写成说明文字并带“刷新页面”按钮；窗口高度随文字增长（`failureTextHeight`），长原因不再盖住标题栏。部署侧：Vite 开发服务器启动时、Docker 客户端容器启动时（`client/docker/check-resources.sh`，`docker-start` 启动后也会列出）会对照资源清单检查 `mirror/p3553`，不一致时给出警告。窗口由发行版窗口渲染器绘制（`ui/resource-window.ts`），沿用任务窗口 `dialog2_questInfo2` 的框体与贴图：左侧“资源分类”列表（行按钮显示完成/百分比/未下载与大小），右侧为所选分类的大小、说明、“下载状态”进度条和 下载/继续下载/暂停、删除 按钮；“赛道”下方按主题分页（每页 10 个），其他分类在同一位置列出最大的 6 个文件及其状态；底部显示已下载总量、浏览器可用空间、全部下载/暂停全部和当前任务。删除先弹出同样风格的“删除资源”确认窗口（写明释放多少空间，默认焦点在“取消”），首页资源始终保留。灰色详情底框按 `frame01` 的 TitleCapBottomGrey 切片自行绘制：发行版框体绘制会跳过宽度为 0 的底边中段，直接用该框体会在底部留下一条白边。`dialog2_questInfo2.rho`（226 KB）因此归入首页资源。

整包下载失败（或后台下载被暂停）时，`ensure()` 为该次下载发出一次 `failed` 进度（仍带 `background` 标记），启动页之后的加载徽标据此去掉该文件（`dropLoadingProgress`）；以前失败的下载会让徽标一直停在“正在加载资源 N%”。

本层沿用发行版的缓存策略：已存在的 OPFS 文件按长度复用；新下载文件做长度校验。清单包含 SHA-256，但浏览器未提供流式 SHA-256 API，因此这里没有对每次本地缓存命中重新散列数 GiB 数据。需要强校验时，可增加流式哈希适配器。

浏览器应提供 OPFS `createWritable()`。若目标浏览器只支持 Worker 内的同步写入，可通过 `fallbackWriter` 注入该实现。流式写入失败时会 abort 并删除残留文件。

资源层测试（Node 24，也包含在根目录 `npm test` 中）：

```sh
node --experimental-strip-types --loader ./src/resources/node-test-loader.mjs --test ./src/resources/resources.test.mjs
```

### 全资源手动选图

`extra-tracks.ts` 在原有 `timeAttackTrackCatalog` 后补齐赛道容器中的所有
`track*.1s` 地图：任务、驾照、特殊模式、扩展赛道和地图变体通过
`resourceCategory` 分类；`theme` 仍保留真实主题供纹理、音乐及主题筛选使用。
p3553 共 559 个选项（449 个正向地图及 110 个反向/其他变体），其中新增 188 个。
`myRoom` 下的同名文件属于小屋场景，不作为赛道。

新增条目保留原圈数，缺失时使用 1 圈；没有中文名时展示资源编号；没有预览图时
使用编号占位卡。变体 ID 使用 `__` 分隔，反向变体统一以 `_rvs` 结尾，兼容回放和结算。
原始 BML 不改写；加载时按模型提供手动选图 metadata，不将这些条目加入原来的
随机赛道池或道具赛房间目录。任务地图可独立选择不代表任务专属玩法已实现。

只更新服务端赛道结算目录可运行 `node --import tsx tools/export-track-catalog.mjs`，
校验用 `--check`；该命令只读取档案索引和赛道表，不要求下载无关的 LFS 档案。
完整资源环境仍可使用原有 economy 导出命令。目录覆盖、默认 metadata、分类检索、
随机池隔离和缺图预览由 `extra-tracks.test.ts` 验证。

新增地图实跑检查：启动 `npm run dev` 后执行
`PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/test-extra-tracks-browser.mjs`。
测试会读取真实 p3553 容器，在 Chrome/WebGL 中逐张装配地图、小地图与音乐，
执行 300 帧原版驾驶物理并检查各路线段的采样，结果写入
`../output/extra-tracks/browser.json`。可附加地图 ID 单独复测。
运行前必须将 Git LFS 资源下载完整，资源索引存在不代表容器内容已到本地。
这属于自动加载与驾驶冒烟检查，不替代所有赛道的完整人工跑圈验收。

独立资源地图的任务金币与脚本事件不启用任务计分；常规赛道和 LTE 专属准入仍保持原规则。
海外训练变体沿用其基础地图的训练路线规则。卡丁城从普通选图进入时也注册城市碰撞范围。
`pirate_P01`、`maple_P01`、`fengshen_P01`、`mabi_P01` 缺少可用竞赛路线或带有占位路线，
标为“自由探索”，使用原场景地面及无终点的复位段，不作为完整计圈赛道。
海盗与封神场景补的是原有地形网格的碰撞标记，没有添加隐藏平面。
