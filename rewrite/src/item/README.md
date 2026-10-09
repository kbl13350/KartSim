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
| `item-race-controller.ts` | 本机道具控制器（每局道具赛一个）：镜像服务器道具槽、Ctrl/Alt/Z 请求、导弹/磁铁瞄准、受害时间线与护盾/天使/电磁波/蓝盾判定、区域道具检测、命中与落点上报、喂 HUD 与表现层 |
| `item-race-rules.ts` | 控制器的纯规则：坐标换算（协议 `point` 用原版 z 向上坐标）、生效时刻、防御判定、瞄准候选、1600×900 舞台投影、`ITEM_RACE_TUNING`（[还原] 常量） |
| `item-race-slots.ts` | 道具槽镜像：已确认的服务器道具槽 + 未回包的使用/换位（先进先出），被拒绝时退回 |
| `item-race-presenter-contract.ts` | 表现层契约 `ItemRacePresenter`（投射物、放置物、车身特效、音效；实现见表现层） |
| `item-race-test-support.ts` | 测试用假对象：按附录 B 生命周期构造的道具目录（与原版目录逐项一致，见 `item-race-rules.test.ts`）、假物理/连接/表现层 |

道具箱编号：静态箱用 `instanceOrdinal`（每个 `track*.1s` 内 1..N 唯一），移动箱用 `2048 + 可动物件 instanceOrdinal`，都落在 `cube` 请求允许的 1..4096。少数原版移动箱（`fengshen_I03`–`I05` 的 `mo_ic042`、`mo_ic044`）变换与 PRS 均为 NaN，无法到达，载入时跳过。

载图准入在 `src/vehicle/track-object-admission.ts` 的 `admitItemGameTrackObject`：道具赛沿用 speed-individual 账本（模式名与协调器 token 不变），只额外准入道具箱、移动道具箱、`onlyItemGame` 物件（按其类型继续判定）与四类危险物；`ltejump` 仍省略。竞速与计时赛的准入逐条不变。

## 道具控制器（第二波）

`ItemRaceController` 由比赛协调器在比赛连接、本机 owner 与远端车队都就绪后创建（`src/multiplayer/item-race-wiring.ts`），赋给 `local.items`（接收 Ctrl 按下/松开/取消、Alt、Z）与 `local.itemRace`（道具箱、危险物回调）。每帧顺序：

1. 物理前 `update(nowMs)`（`race-frame-coordination.ts`）：瞄准阶段、到点的受害效果、定时水炸弹落点、区域检测、本机特效事件转给表现层。
2. 赛道渲染后 `present(...)`（`race-presenter-items.ts`，比赛帧与结算帧）：准星投影、`presenter.update`。
3. HUD 前 `hudState(nowMs)` → `hud.setItemState`。

时间：所有道具时间线以服务器 `startAt` 为起点，用比赛时钟映射（`toLocalTick`：服务器毫秒 − `offsetMs`）换成本地表现层时钟。

请求：`sendItem` 串行发送、序号严格 +1（`race-session.ts`）；被拒绝的请求只拒绝自身 Promise，控制器退回最后确认的道具槽，比赛继续。

判定顺序：重置/传送中 → 未命中；被困或蓝盾 → `escape`；电磁波挡飞碟 → `emp`；护盾挡有 Shield 状态的道具（挡一次即消失）→ `shield`；天使挡大魔王、乌云、道具锁以外的攻击 → `angel`；道具锁由服务器执行，总是命中。

[还原] 常量见 `ITEM_RACE_TUNING`：瞄准范围 150 m、半角 25°、锁定 600 ms；香蕉对使用者 1 s 保护；道具说明卡 3 s；刷箱提示 2 s；放置事件晚到 500 ms 内仍检测一次；飞碟的预警用导弹红色警告。换位卡（Alt）在第三阶段前不限次数（HUD 显示 ∞），变更卡（Z）不发请求，只在比赛聊天区显示一行“道具变更卡暂未开放。”。
