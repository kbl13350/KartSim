# KartSim v39.11 源码恢复

这里保存的是从已下载的发行版重建的**可读代码与数据**，不是作者的原始项目。主前端是 Vite/Rollup 合并后的单个 ES module；源站未提供原始 source map，因此原文件名、模块边界、局部变量名、注释和 TypeScript 类型无法可靠找回。

## 从哪里开始

| 路径 | 用途 | 可信度 |
| --- | --- | --- |
| [`formatted/index.js`](formatted/index.js) | 对原始主包仅做排版；12 万余行，可搜索、可运行 | 最高；已进入本地计时赛 |
| [`formatted/assets/`](formatted/assets/) | 车库模块、3 个 Worker、CSS 等的排版版本 | 已通过语法检查 |
| [`wakaru-fixed/index-DoW2rQpI.js`](wakaru-fixed/index-DoW2rQpI.js) | 启发式展开控制流及部分变量名，并修复一处经原包核实的误改写 | 适合阅读；已进入计时赛，其他路径未全面验证 |
| [`wakaru/`](wakaru/) | 未手工修改的 Wakaru 输出及映射回**压缩发行包**的 map | 用于追溯；原样输出有一处启动错误 |
| [`analysis/architecture.md`](analysis/architecture.md) | 按功能推断的主包区域、关键类和入口 | 区域为推断，不代表原文件划分 |
| [`analysis/network-protocol.md`](analysis/network-protocol.md) | 从前端推断的联机地址、HTTP/WebRTC 入口与消息格式 | 仅覆盖客户端可见行为，不是服务端源码 |
| [`analysis/symbols.tsv`](analysis/symbols.tsv) | 约 3,278 个顶层声明的可读文件行号索引 | 只索引容易可靠识别的声明 |
| [`embedded-data/`](embedded-data/) | 原包中的两份车辆物理 CSV 与 436 项覆盖参数 | 逐字节提取，附来源哈希和范围 |
| [`data/`](data/) | 从 `.rho/.rho5` 选取的 XML/BML 配置样本 | 提取时检查长度及适用的校验值 |
| [`data-full/`](data-full/) | p3553 资源包中全部 11,219 个 XML/BML 文本配置 | 全部解码成功并通过 XML 解析 |

`tools/extract-resource.mjs` 可按内部路径继续提取资源配置；[`modules/`](modules/) 是 10 个便于阅读的推断功能切片，不能单独运行。

## 运行可读版本

在项目根目录执行：

```sh
./recovered/run-readable.sh
```

打开 <http://127.0.0.1:8772/>。此站点通过相对符号链接复用 `mirror/` 的 3.49 GiB 资源，不再复制一份。启发式修补版可运行 `./recovered/run-heuristic.sh`，默认地址为 <http://127.0.0.1:8771/>；其变更及限制见 [`wakaru-fixed/PATCHES.md`](wakaru-fixed/PATCHES.md)。

这两个可读站点也通过符号链接使用 [`mirror/sw.js`](../mirror/sw.js) 路由 `.rho/.rho5`、`aaa.pk` 和 WASM；路由和存储说明见[根目录 README](../README.md#service-worker-资源路由)。不同端口属于不同浏览器来源，OPFS 和 WASM 缓存不会跨端口共用。

## 生成方式与边界

排版使用 Prettier 3.9.9；启发式恢复使用 Wakaru 1.13.0 的标准级别。Wakaru 对这个 scope-hoisted 的 Vite/Rollup 包只生成一个主文件，无法自动还原原始模块。其生成的 `.map` 只追溯到下载的压缩 JS，不是作者构建前的源码映射。关键数据由 `embedded-data/extract.mjs` 从固定 SHA-256 的主包中提取，可重复验证。

前端约 489 KB 的起始区域包含 Three.js r178；一个 90 KB 的 WASM 是音频解码器。远程多人后端未包含在网页发行文件中，无法从这个前端包恢复其服务端源码。
