# 资源层

这里是新工程的物理容器入口，按源码中的三层边界拆开：

1. `manifest.ts` 读取 `/__p3553/resources` 并校验版本、修订号、文件名、大小、时间戳、SHA-256 字段及大小写重复。
2. `archive-index.ts` 解压 `/__p3553/archive-index`，检查索引修订号与清单相同，并确认索引中的 `.rho`、`.rho5` 分包与清单逐个对应。
3. `container-store.ts` 在首次读取时下载容器，写入按 `version-revision` 隔离的 OPFS 目录；复用已有长度正确的文件，流式校验新下载文件长度，报告进度，支持指定并发数的预加载和有边界检查的范围读取。用户选择的本地 Data 目录优先在下载前尝试，按大小和流式 SHA-256 校验，通过后直接读取，不复制到 OPFS。

`ArchiveCatalog.codecInputs()` 返回 `aaa.pk`、Rho 索引及来源、Rho5 索引及有序分包来源。二进制格式的挂载、解密、解压与校验应由独立 codec 实现；业务代码不要解析容器字节。`ArchiveSource` 的 `arrayBuffer`/`slice` 与原客户端 codec 的输入形状兼容。来源只在调用读取方法时触发下载。

`loadLegacyResourceBundle(version, onProgress, localDirectory)` 提供原发行版 `uo0` 的返回形状：`{ version, sources, archiveIndexes, preloadContainers }`，可用于把新加载实现接到尚未重写的二进制 codec。`localDirectory` 应由界面选择 Data 文件夹并持有对应授权；该适配器不会弹出文件选择器。

`track-catalog.ts` 接管资源库的 8 个赛道目录方法：档案中的赛道模型、区域标题与元数据、计时赛可选赛道、反向赛道和随机赛道组。它已接入 `Sw`，精确方法列表见 `src/generated/manifest.json`。真实 p3553 的 `track_common.rho` BML 和档案索引与发行版逐项差分一致：391 条元数据、262 条可选赛道，标题和随机组也一致。

`resource-lookup.ts` 接管 `Sw` 的索引构造与核心查询：精确路径候选、前缀条目、同目录文件、物理容器名和挂载判断。真实 p3553 的 137,609 条虚拟资源记录与发行版查询结果逐项一致；它同样由生成器接入运行路径。

`vehicle-identity.ts` 接管 `Sw` 的 9 个车辆身份方法，解析可驾驶模型、车型目录、纹理键、引擎等级、物品 ID 和关联角色。真实 p3553 索引中的 1,096 个可驾驶模型，以及真实 `itemTable.kml` 中的身份映射，均与发行版差分一致。

`garage-catalog.ts`、`timeattack-items.ts`、`item-table.ts`、`vehicle-titles.ts` 和 `track-config.ts` 接管车库物品、车辆标题与赛道配置业务。真实 p3553 的 ItemTable、国服覆盖数据和赛道配置与发行版差分一致。生成器已将 `Sw` 的全部 38 个方法接入本目录和 `src/codecs/sw-compat.ts`；类外的发行版辅助函数仍留在兼容模块。

本层沿用发行版的缓存策略：已存在的 OPFS 文件按长度复用；新下载文件做长度校验。清单包含 SHA-256，但浏览器未提供流式 SHA-256 API，因此这里没有对每次本地缓存命中重新散列数 GiB 数据。需要强校验时，可增加流式哈希适配器。

浏览器应提供 OPFS `createWritable()`。若目标浏览器只支持 Worker 内的同步写入，可通过 `fallbackWriter` 注入该实现。流式写入失败时会 abort 并删除残留文件。

资源层测试（Node 24，也包含在根目录 `npm test` 中）：

```sh
node --experimental-strip-types --loader ./src/resources/node-test-loader.mjs --test ./src/resources/resources.test.mjs
```
