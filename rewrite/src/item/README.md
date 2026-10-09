# 道具数据、道具箱与赛道危险物

道具赛（道具个人赛 / 组队道具赛）的数据层与赛道对象层，约定见 [`ITEM_MODE.md`](../../ITEM_MODE.md) 第 2、3、7 节与附录 B。全部测试读取真实 p3553 镜像（`item.rho`、`sound_fx_item.rho`、`track_common.rho`、DataPack1 与赛道容器），运行 `npm test` 或单独执行本目录的 `*.test.ts`。

| 模块 | 内容 |
| --- | --- |
| `item-bml.ts` | 通用 `item/<文件夹>/item.bml` 解析：保留每行全部属性；同名状态再次出现即开始下一个变体（base），与全部 103 份原版定义一致 |
| `item-catalog.ts` | `ItemIdx`、`ITEM_REGISTRY`（idx ↔ 名称 ↔ 文件夹/变体）、模型/音效/图标路径、`etc_/itemDescList.xml` 中文名与说明、附录 B 行为常量（时长取 base 0 状态）、`ITEM_RULES`（无原版数据的还原常量）、`loadItemCatalog(library)` |
| `item-cube-source.ts` | 从载入的 `track*.1s` 取静态 `ToItemCube` 与移动 `itemCube`；`trackLocale@cn` 的 `customItemCube` → 赛道 ID 主题 → `village`，`cn` 优先于 `zz` |
| `item-cubes.ts` | `ItemCubeField`：所有道具箱共用一个装配场景（每箱一个包装节点 + 旋转节点 + 模型副本，几何同池、材质与贴图共享），类别 2 配对对象 `GoItemCube[]`，每位车手各自的 stay → eaten（`Eaten.life` 隐藏、`fired01` 特效跟随本机车、`eaten.ogg`）→ stay |
| `item-hazards.ts` | 赛道预置香蕉/地雷/隐形地雷/水雷：位置跟随嵌套场景世界矩阵，进入半径触发，同一物件 3 秒冷却；画面由赛道场景自身渲染 |
| `item-race-map.ts` | 道具房间判定、载图时的道具来源（目录按资源库缓存）、比赛装配时的道具箱与危险物 owner |

道具箱编号：静态箱用 `instanceOrdinal`（每个 `track*.1s` 内 1..N 唯一），移动箱用 `2048 + 可动物件 instanceOrdinal`，都落在 `cube` 请求允许的 1..4096。少数原版移动箱（`fengshen_I03`–`I05` 的 `mo_ic042`、`mo_ic044`）变换与 PRS 均为 NaN，无法到达，载入时跳过。

载图准入在 `src/vehicle/track-object-admission.ts` 的 `admitItemGameTrackObject`：道具赛沿用 speed-individual 账本（模式名与协调器 token 不变），只额外准入道具箱、移动道具箱、`onlyItemGame` 物件（按其类型继续判定）与四类危险物；`ltejump` 仍省略。竞速与计时赛的准入逐条不变。
