# 浏览器容器解码器

`openVirtualFileLibrary(catalog)` 读取 `aaa.pk` 的 Rho 挂载路径，结合资源层已校验的档案索引建立虚拟文件库。随后调用 `library.get(path)`、`library.read(path)` 或 `file.readBytes()` 时，才从相应 `.rho` / `.rho5` 容器按字节范围读取。`file.readXml()` 把 BML 转为可读 XML；其他 XML 按 BOM 解码并把声明改成 UTF-8，便于与恢复出的文本资源比较。

- `rho.ts`：Rho 数据块边界、zlib、异或、解码长度、Adler32；支持索引中记录的明文续块。
- `rho5.ts`：分包定位、两级流密码、zlib、解码长度、MD5；密码和 MD5 均用浏览器可运行的 TypeScript 实现。
- `rho-index-scan.ts`：无预建索引时扫描 Rho 1.0/1.1 的档案头、数据块和目录；Rho 1.1 所需的固定格式表放在 `rho11-table.ts`。
- `rho5-index-scan.ts`：无预建索引时扫描 Rho5 分包、自动识别地区、解密文件表并校验路径和载荷范围。
- `mount-manifest.ts`：解析 `aaa.pk` 的 KRData/BML 树，取得 Rho 的真实虚拟挂载路径和可选的大小/hash 校验信息。
- `virtual-files.ts`：大小写不敏感查询、冲突路径保留和按需读取接口。
- `sw-compat.ts`：复现原 `Sw.load` 的挂载顺序、冲突命名、容器归属和查询索引；文件读取委托给上述手写解码器。

生成器将 `Sw.load` 静态方法接到 `loadSwWithReadableCodec`，游戏由此建立虚拟资源库并按需读取 `.rho` / `.rho5` 文件。`Sw` 的全部 38 个原类方法均已接入手写代码；`src/generated/library.js` 仍保留其他辅助实现。当前正常运行路径读取已有档案索引。Rho 属性 `0x08` 的二级加密仍不支持；当前 p3553 索引没有使用该属性。Rho5 文件表原始校验码在现有索引中缺少重新计算所需的偏移字段，解码后的文件由 MD5 核验。zlib 输入允许最多 3 个末尾零填充字节，匹配已验证的镜像分包。

`SwQueryIndex` 提供纯 TypeScript 的路径查询、同目录邻接文件、物理容器追踪和车辆/赛道候选过滤。完整 p3553 镜像的 137609 条文件元数据已与原 `Sw.load` 逐条差分。无预建索引、散文件和重复 `aaa.pk` 的可选输入也已通过原版差分；无索引扫描和扫描后的文件读取均使用手写 TypeScript。真实 p3553 Rho 1.1、Rho5 双分包和自动地区识别的索引与发行版逐字段一致；Rho 1.0 使用合成有效档案做了差分。

差分测试会从本地镜像读取少量真实文件，并与 `recovered/data-full/` 中的 XML 逐字比对；不需要启动服务器：

```sh
npx tsx --test src/codecs/*.test.mjs
```
