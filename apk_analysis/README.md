# 跑跑卡丁车官方竞速版 APK 素材提取

来源：`10040714_com.tencent.tmgp.WePop_a2827207_1.27.2_ausg4b.apk`（版本 1.27.2）。APK 的 SHA-256 为 `47407c2489bc3b2e4e2a584cd55e2968311907c5bf97cf250f300f4464f6cc61`。

Git 仓库保留分析脚本、索引、提取的游戏素材和导出结果；大型文件由 Git LFS 管理。JADX 自动生成的 Java 反编译输出含本机路径页眉，因此未收录；Mono 运行库配置中含第三方个人路径和邮箱，也未收录。要重新提取，请自行准备上述 APK，通过 `python3 apk_analysis/extract_resources.py --apk /path/to/file.apk` 指定路径。后续使用 APK 的导出脚本可设置 `KARTSIM_APK=/path/to/file.apk`；路径不会写入仓库报告。

## 先看界面素材

- `race_controls/`：比赛操作按钮与示意图；具体来源和用途见该目录的清单。
- `race_controls.zip`：15 张按钮相关 PNG、预览图和来源清单。
- `race_controls_hd_redrawn/`、`race_controls_hd_redrawn.zip`：7 张参考原图制作的高清透明重绘图，以及原图对比页。此版本不是 APK 原生素材。
- `ui_atlas_export/`、`ui_atlas_export.zip`：两个主比赛图集的 241 张独立 Sprite。
- `ui_icon_export/gallery.html`：本地可搜索的图标浏览页，含 4,468 张 PNG。打开本地服务 `http://127.0.0.1:8773/gallery.html` 也可浏览。
- `ui_icons.zip`：上述图标的压缩包。
- `catalog_image_export/`：458 张车辆头像、角色头像、赛道缩略图和主题背景。
- `unity_builtin_export/`：Unity 内置数据中导出的 PNG。

## 反编译与索引

- `index/resource_catalog.csv`：52,919 条逻辑资源路径与 AssetBundle 路径的对应关系；其中 19,125 条指向 APK 中存在的包，33,794 条指向 APK 中没有的包。
- `extracted/`：直接可提取的图片、视频、音频、字体、轨道数据及必要的分析文件。
- `jadx/`：Android Java 包装层的反编译结果。JADX 有 31 处反编译错误；游戏逻辑主要为 IL2CPP，不能将这些 Java 源文件视为完整游戏源码。
- `decompiled/`：Manifest、包信息、IL2CPP 元数据索引。元数据提供类、字段和方法名称，并不包含完整 C# 方法体。
- `decode_fbau.py`：将游戏自定义的 FBAU 包还原为 UnityFS；`index/fbau_validation.json` 记录随机抽样 100 包的读取结果（99 成功，1 个 Unity 序列化读取错误）。
- `index/resolution_audit.json`：核对比赛按钮提取尺寸与源图集像素一致，未发生导出缩小。

使用 `apk_analysis/.venv/bin/python apk_analysis/export_catalog_images.py --ui-icons --output-dir apk_analysis/ui_icon_export` 可以重新导出界面图标；再运行 `python3 apk_analysis/build_icon_gallery.py` 生成浏览页。

本目录只包含此 APK 内已有的资源。索引指向但 APK 未内置的资源可能由游戏后续下载，未在这里获取。
