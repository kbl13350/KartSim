# 管理后台前端（admin-ui）

跑跑卡丁车管理后台的单页应用：Vite + Vue 3 + Element Plus + TypeScript。与后端的约定见 `server-go/ADMIN.md`。

构建产物输出到 `server-go/internal/data/api/adminui/`（`index.html` 与 `assets/`），**提交进仓库**，由数据服务用 Go `embed` 打包并在 `/multiplayer/admin/` 提供。`go build` 不需要 Node；但改了前端必须重新构建并提交产物。

## 环境

- Node.js 20.19+ 或 22.12+（Vite 8 的要求）
- 依赖版本在 `package.json` 中写死，`package-lock.json` 已提交；`node_modules/` 不提交。

```sh
cd server-go/admin-ui
npm ci
```

## 开发

```sh
npm run dev          # http://localhost:5173/multiplayer/admin/
```

开发服务器把 `/api/*` 和 `/multiplayer/*`（`/multiplayer/admin/` 页面本身除外，`/multiplayer/admin/invites` 仍转发）代理到本机数据服务 `http://127.0.0.1:8797`，用真实的管理员账号登录。

没有后端时可以用假数据看页面（`dev/mock.ts`，只在 mock 模式下加载，不会进入构建产物）：

```sh
npm run dev:mock     # 任意用户名/密码可登录；用户名 player 模拟“不是管理员”
MOCK_REDIS_DOWN=1 npm run dev:mock   # 模拟集群注册表（Redis）不可用：概览在线/节点/房间为“—”
```

假数据里 `rider7` 模拟 `KART_ADMIN_USERNAMES` 中的超级管理员（其他管理员编辑或踢下线得到 409 `PROTECTED_ADMIN`），`admin` 是当前登录的管理员（不能踢自己下线；重置自己的密码会作废后台会话并回到登录页）。被踢下线或封禁的在线账号先显示“断开中”，5 秒后离线；节点列表里有一个离线节点（`四区`）和一个内存不足 1 MB 的空闲节点。

## 构建

```sh
npm run build        # vue-tsc 类型检查 + vite build，输出到 ../internal/data/api/adminui/
npm run typecheck    # 只做类型检查
```

构建后可用生产安全策略（CSP）加假数据预览产物：

```sh
npm run preview:mock # http://localhost:5174/multiplayer/admin/
```

## 安全策略（CSP）

数据服务以 `script-src 'self'`（不允许 `unsafe-eval`、不允许内联脚本）、`style-src 'self' 'unsafe-inline'`、`font-src 'self'`、`img-src 'self' data:`、`connect-src 'self'` 提供页面，所以：

- 只写 `.vue` 单文件组件模板（构建时预编译），不要用运行时模板字符串或带编译器的 Vue 完整版；
- `index.html` 里不要写内联 `<script>`，不要引用任何 CDN、外部字体或图片；
- `assetsInlineLimit: 0`：资源不内联成 `data:` 地址（字体、脚本都以文件形式输出）。

改动依赖或配置后，检查产物中没有 `new Function`、`eval(` 和内联脚本：

```sh
grep -l "new Function\|[^.a-zA-Z_]eval(" ../internal/data/api/adminui/assets/*.js
grep -c "<script>" ../internal/data/api/adminui/index.html
```

（Element Plus 依赖的 lodash 里有 `Function('return this')` 的全局对象兜底写法，浏览器里不会执行到。）

## 目录

| 路径 | 说明 |
|---|---|
| `src/api/client.ts` | 请求封装：令牌只保存在内存（`Authorization: Bearer`），错误码转中文提示，401 或 403 `ADMIN_REQUIRED`（中途被撤销管理员）退回登录页 |
| `src/api/types.ts` | 接口返回字段（ADMIN.md 第 4 节） |
| `src/session.ts` | 登录（`/multiplayer/auth/login`，`console: true`）、`/api/admin/me` 校验、退出 |
| `src/composables/usePagedTable.ts` | 服务器端分页表格：分页、关键字、排序、时间范围、筛选 |
| `src/composables/useTabs.ts` | 标签页列表、URL hash 同步、顶栏“刷新”的分发 |
| `src/components/` | 通用表格与工具栏、账号详情抽屉、编辑/赠送对话框等 |
| `src/views/` | 每个标签页一个组件 |
| `src/utils/` | 北京时间、数字与中文标签格式化、确认框等 |
| `dev/mock.ts` | 仅开发用的假接口 |

“地图管理”提供内置地图的主题分类、搜索、开启/关闭筛选及单图、整主题开关；“自制地图”仍用于地图工坊作品。开发假接口使用同一份生成的内置目录，所有开关仅保存在 mock 进程内，不会写入正式数据库。游戏客户端消费公开 `/api/track-settings`，接口约定见 `../ADMIN.md` 第 12 节。


地图列表同时展示从每张地图自身资源容器提取的预览图，可点击或通过键盘放大。普通预览卡缺失时依次使用该地图的缩略图、路线图；没有原始图片的地图使用真实场景渲染截图，界面会标明“路线图”或“场景预览”。正反向地图可以共用同一张原始预览，地图条目与开关仍各自保留。

图片以无损 WebP 随后台构建打包，不需要浏览器下载、解包整个游戏资源库。更新地图资源后，在仓库的 `client/` 目录执行（需已下载的游戏资源与 `cwebp`、`dwebp`）：

```sh
node --import tsx tools/export-admin-track-previews.mjs
node --import tsx tools/export-admin-track-previews.mjs --check
```

随后重新运行本目录的 `npm run build`，一并提交图片索引、来源记录和后台构建产物。


“车辆管理”支持竞速、道具、系统车辆分类，引擎世代筛选，名称/ID/型号搜索、状态筛选和单车/整类开关。每辆车展示自身模型、贴图和原始配色的透明预览图，可点击或通过键盘放大。关闭只限制新的选择和购买，已拥有的车辆、当前装备和已开始的比赛保留；接口约定见 `../ADMIN.md` 第 13 节。

车辆图使用原生车库渲染后无损转为 WebP，按像素内容共用文件，车辆身份与开关独立。更新资源时，在 `client/` 中执行（需要本地游戏资源、Playwright/Chrome、`cwebp` 和 `dwebp`）：

```sh
node --import tsx tools/export-admin-vehicle-directory.mjs
npm run dev -- --host 127.0.0.1 --port 8780
# 保持上面的开发服务运行，在另一个终端执行：
node tools/export-admin-vehicle-capture.mjs --origin=http://127.0.0.1:8780
node --import tsx tools/export-admin-vehicle-previews.mjs
node --import tsx tools/export-admin-vehicle-directory.mjs --check
node --import tsx tools/export-admin-vehicle-previews.mjs --check
```

捕获脚本可用 `PLAYWRIGHT_MODULE` 指定 Playwright 模块路径，`CHROME_PATH` 指定浏览器程序。原始 PNG 保存在未提交的 `output/vehicle-admin/scenes/`；WebP、索引及模型/渲染来源哈希提交到 `src/assets/vehicle-previews/`，最后重新构建后台并提交构建产物。捕获检查完整目录、非空像素与画面边界，导出检查源模型哈希和无损解码像素；少数原始驾驶参数损坏的车型直接读取同车模型与贴图，来源记录标注该加载方式。
