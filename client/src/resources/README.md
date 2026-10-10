# 资源层

这里是新工程的物理容器入口，按源码中的三层边界拆开：

1. `manifest.ts` 读取 `/__p3553/resources` 并校验版本、修订号、文件名、大小、时间戳、SHA-256 字段及大小写重复。
2. `archive-index.ts` 解压 `/__p3553/archive-index`，检查索引修订号与清单相同，并确认索引中的 `.rho`、`.rho5` 分包与清单逐个对应。
3. `container-store.ts` 在首次读取时下载容器，写入按 `version-revision` 隔离的 OPFS 目录；复用已有长度正确的文件，流式校验新下载文件长度，报告进度，支持指定并发数的预加载和有边界检查的范围读取。用户选择的本地 Data 目录优先在下载前尝试，按大小和流式 SHA-256 校验，通过后直接读取，不复制到 OPFS。

`ArchiveCatalog.codecInputs()` 返回 `aaa.pk`、Rho 索引及来源、Rho5 索引及有序分包来源。二进制格式的挂载、解密、解压与校验应由独立 codec 实现；业务代码不要解析容器字节。`ArchiveSource` 的 `arrayBuffer`/`slice` 与原客户端 codec 的输入形状兼容。来源只在调用读取方法时触发下载。

`loadLegacyResourceBundle(version, onProgress, localDirectory)` 提供原发行版 `uo0` 的返回形状：`{ version, sources, archiveIndexes, preloadContainers }`（另附 `store`，供下面的资源分类与下载管理使用），可用于把新加载实现接到尚未重写的二进制 codec。`localDirectory` 应由界面选择 Data 文件夹并持有对应授权；该适配器不会弹出文件选择器。

`track-catalog.ts` 接管资源库的 8 个赛道目录方法：档案中的赛道模型、区域标题与元数据、计时赛可选赛道、反向赛道和随机赛道组。它已接入 `Sw`，精确方法列表见 `src/generated/manifest.json`。真实 p3553 的 `track_common.rho` BML 和档案索引与发行版逐项差分一致：391 条元数据、262 条可选赛道，标题和随机组也一致。

`resource-lookup.ts` 接管 `Sw` 的索引构造与核心查询：精确路径候选、前缀条目、同目录文件、物理容器名和挂载判断。真实 p3553 的 137,609 条虚拟资源记录与发行版查询结果逐项一致；它同样由生成器接入运行路径。

`vehicle-identity.ts` 接管 `Sw` 的 9 个车辆身份方法，解析可驾驶模型、车型目录、纹理键、引擎等级、物品 ID 和关联角色。真实 p3553 索引中的 1,096 个可驾驶模型，以及真实 `itemTable.kml` 中的身份映射，均与发行版差分一致。

`garage-catalog.ts`、`timeattack-items.ts`、`item-table.ts`、`vehicle-titles.ts` 和 `track-config.ts` 接管车库物品、车辆标题与赛道配置业务。真实 p3553 的 ItemTable、国服覆盖数据和赛道配置与发行版差分一致。生成器已将 `Sw` 的全部 38 个方法接入本目录和 `src/codecs/sw-compat.ts`；类外的发行版辅助函数仍留在兼容模块。

## 资源分类与按需下载

`resource-groups.ts` 只根据清单文件名和 rho5 分包的文件路径把 1695 个容器分成 14 类，每个容器至少属于一类（共用的容器可同时属于几类）：首页（必需，约 341 MiB：界面、字体、首页场景、主菜单音乐、道具与赛道目录 DataPack1/4）、比赛通用、赛道（按 `trackLocale@cn` 的主题名分成 33 个主题，每个主题含 `track_<主题>_*`、`theme_<主题>`、`sound_bgm_<主题>*` 及装着该主题赛道的 DataPack3 分包）、车辆、角色、宠物、小屋、商城与饰品、车库、多人游戏、剧情与驾照、活动与抽奖、俱乐部、其他。

`resource-manager.ts` 在容器仓库之上维护一个共享下载队列：同时下载 3 个容器，高优先级先下载，同一容器只下载一次；任务可暂停（未开始的容器离开队列），失败不影响页面——页面读取时仓库仍会按需下载。`ContainerStore` 为此新增 `cachedNames()`（OPFS 中长度正确的容器）、`remove(name)` 和 `addProgressListener()`。

- **首页优先**：启动解析完资源索引后，先并行下载“首页”类缺少的容器，字节进度显示在启动页的“当前下载：首页资源”进度条上；总进度百分比保持与发行版一致。下载失败只提示，进入后按需读取。
- **被动下载**：打开小屋、商城、车库、多人游戏、剧情、驾照、俱乐部、活动页面时（`ensureFeatureResources`），先下载该页面最先用到的几个容器（发行版 CaptionDialog 小窗“正在下载…资源”，带进度条，可点“后台下载”直接进入），页面打开后再以低优先级在后台下载该页面所属分类。
- **赛道在进比赛时下载**：不提前下载地图。计时赛和多人比赛加载时（`downloadRaceTrack`）才下载本局赛道自身的容器、所属主题的贴图与音乐和“比赛通用”。
- **主动下载**：首页顶栏的“资源下载”按钮（以及启动后角落的下载徽标）打开资源下载窗口；下载中按钮显示“下载中 N%”，全部资源都已下载且没有任务时按钮隐藏，之后若有资源缺失（被删除或被浏览器清理）会自动重新出现。窗口由发行版窗口渲染器绘制（`ui/resource-window.ts`），沿用任务窗口 `dialog2_questInfo2` 的框体与贴图：左侧“资源分类”列表（行按钮显示完成/百分比/未下载与大小），右侧为所选分类的大小、说明、“下载状态”进度条和 下载/继续下载/暂停、删除 按钮；“赛道”下方按主题分页（每页 10 个），其他分类在同一位置列出最大的 6 个文件及其状态；底部显示已下载总量、浏览器可用空间、全部下载/暂停全部和当前任务。删除先弹出同样风格的“删除资源”确认窗口（写明释放多少空间，默认焦点在“取消”），首页资源始终保留。灰色详情底框按 `frame01` 的 TitleCapBottomGrey 切片自行绘制：发行版框体绘制会跳过宽度为 0 的底边中段，直接用该框体会在底部留下一条白边。`dialog2_questInfo2.rho`（226 KB）因此归入首页资源。

本层沿用发行版的缓存策略：已存在的 OPFS 文件按长度复用；新下载文件做长度校验。清单包含 SHA-256，但浏览器未提供流式 SHA-256 API，因此这里没有对每次本地缓存命中重新散列数 GiB 数据。需要强校验时，可增加流式哈希适配器。

浏览器应提供 OPFS `createWritable()`。若目标浏览器只支持 Worker 内的同步写入，可通过 `fallbackWriter` 注入该实现。流式写入失败时会 abort 并删除残留文件。

资源层测试（Node 24，也包含在根目录 `npm test` 中）：

```sh
node --experimental-strip-types --loader ./src/resources/node-test-loader.mjs --test ./src/resources/resources.test.mjs
```
