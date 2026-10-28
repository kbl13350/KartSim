# 后台车辆目录和预览图

后台目录来自游戏实际挂载的完整车库目录，包括台服导入车辆、已有资源补录车辆和系统练习车。车辆身份使用游戏的 `kartCatalogIdentity`：普通车辆 `catalog:3:<itemId>`，系统车辆 `system:<systemKey>`。分类读取原生 `kartType`（1 道具、2 竞速）；系统练习车单列。引擎名称复用商店已有的 `engineLabel`。

资源包中的车辆 PNG 通常是模型贴图，不能当作车辆照片。预览使用原生 `GarageLivePanels` 和 `Qv`，读取每辆车自己的模型、贴图、原始配色和卡通着色，捕获 440×300 透明图片。保留原生商品车相机；模型超出画面时只缩小视野，直到四边有至少 12 像素余量。不会用其他车型、通用图标或 UV 贴图代替。

`catalog:3:323`（rudolf8）缺少 BodyParam，`catalog:3:330`（firecracker1）的 BodyParam XML 损坏。这两辆图像使用原生 legacy 直接模型解析路径，仍只读取本车型目录中的模型和贴图，并使用原 ItemTable 配色。预览不需要它们的行驶参数；此处理不修复、改变或验证游戏中的行驶能力。provenance 的 `renderMethod` 单独标明这两辆。

## 重新导出

需有完整 `mirror/` 资源、客户端依赖、Chrome、Playwright，以及 libwebp 的 `cwebp` / `dwebp`（macOS 可 `brew install webp`）。在源码与捕获记录相符的干净 checkout 中启动 Vite；不要混入其他尚未完成的改动。

在 `client/` 执行：

```sh
node --import tsx tools/export-admin-vehicle-directory.mjs
npm run dev -- --port 8780
```

保持 Vite 运行，在另一个终端的 `client/` 执行：

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node tools/export-admin-vehicle-capture.mjs --origin=http://127.0.0.1:8780
node --import tsx tools/export-admin-vehicle-previews.mjs
node --import tsx tools/export-admin-vehicle-directory.mjs --check
node --import tsx tools/export-admin-vehicle-previews.mjs --check
```

若 Playwright 可直接从 Node 包解析，不需要设置 `PLAYWRIGHT_MODULE`。`CHROME_PATH` 可指定其他 Chrome 路径；`CWEBP` / `DWEBP` 可指定 libwebp 命令。捕获器支持 `--source-root=/absolute/clean/checkout`、`--output=/absolute/audit/directory` 和 `--workers=3`；对应的干净 checkout 必须也包含 renderer HTML 和同一资源清单。导出器支持 `--scenes /absolute/audit/directory` 和 `--out /absolute/export/directory`。

捕获可在同样输入下恢复未完成工作。输入变更时使用新的输出目录，避免混合不同版本。原始 PNG 和捕获记录写入 `output/vehicle-admin/scenes/`，保留为本地审计资料，不提交第二份图像。提交内容为后台无损 WebP、index、metadata、完整 provenance、目录和本套工具。

`--check` 会校验完整车库 ID、目录版本、资源清单、renderer HTML、6 个相关渲染/目录源文件、每辆原模型 SHA、全部输出 WebP SHA、解码 RGBA 和尺寸，以及非空和无裁切记录。原 PNG 仍在本地时还会验证其 SHA/RGBA；在没有本地 PNG 的新 checkout 中也可完整验证已提交的输出与捕获记录。像素完全相同的图像共用一个 WebP 文件；各车辆身份和开关仍然独立。

当前导出：1651 辆车辆（竞速 1017、道具 630、系统练习 4），1349 张唯一 WebP，共 51,028,814 字节；没有缺图。
