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
| `item-race-presenter-contract.ts` | 重新导出表现层契约（定义在 `item-race-presenter.ts`） |
| `item-race-test-support.ts` | 测试用假对象：按附录 B 生命周期构造的道具目录（与原版目录逐项一致，见 `item-race-rules.test.ts`）、假物理/连接/表现层 |
| `item-fx-plan.ts` | 表现层的模型/音效表：按 base 0 状态解析每个道具的 `firing`（使用者车上）、`fired`（受害者车上）、`item`（道具物体本身）模型与对应音效、状态时长；`ITEM_FX_TUNING`（[还原] 常量） |
| `item-fx-assets.ts` | 表现层资源：模型解码一次、每个模型一个副本池（载入时预装配，需要时后台补装，单模型上限 8）、共享贴图缓存；UFO 的 1 型颜色关键帧转成装配器支持的 0 型；定时水炸弹车上水球（取自水炸弹模型）；音效解码与播放（比赛音频路由，限 24 个同时播放） |
| `item-race-presenter.ts` | 道具赛表现层（契约 `ItemRacePresenter`）：投射物（追踪、弧线、哑弹）、投掷与放置物、车身效果（水泡、蓝盾、飞碟、闪电、恶魔、护盾、天使、电磁波、磁铁、车上水球）、命中/格挡表现与音效（按镜头距离衰减与左右声像）；`loadItemRacePresenter` 在 A40 中创建为 `assets.itemPresenter` |

表现层约定：所有坐标为 three.js 世界坐标（与 `body.position`、道具箱相同），时间为比赛表现时钟毫秒。原版模型都以车为原点（客户端 z 向上、车头朝 −y），所以每个模型挂在一个与车相同基底（right、up、forward）的节点下。事件迟到时动画按服务器时间线从中途开始；音效迟到超过 300 ms 则丢弃。同一 `useId` 的重复 `used`/`hit`、`used` 与 `kartEffect` 对同一车同一效果的重复开始都只保留一个表现。

开发预览（不进构建）：`npm run dev` 后打开 `http://127.0.0.1:8780/tools/item-fx-preview.html`，三辆假车 A（蓝，本机）、B（绿）、C（红）之间逐个播放全部道具；`?item=rocket` 直接播放一个场景，`?move=1` 让车行驶。

道具箱编号：静态箱用 `instanceOrdinal`（每个 `track*.1s` 内 1..N 唯一），移动箱用 `2048 + 可动物件 instanceOrdinal`，都落在 `cube` 请求允许的 1..4096。少数原版移动箱（`fengshen_I03`–`I05` 的 `mo_ic042`、`mo_ic044`）变换与 PRS 均为 NaN，无法到达，载入时跳过。

载图准入在 `src/vehicle/track-object-admission.ts` 的 `admitItemGameTrackObject`：道具赛沿用 speed-individual 账本（模式名与协调器 token 不变），只额外准入道具箱、移动道具箱、`onlyItemGame` 物件（按其类型继续判定）与四类危险物；`ltejump` 仍省略。竞速与计时赛的准入逐条不变。

## 道具控制器（第二波）

`ItemRaceController` 由比赛协调器在比赛连接、本机 owner 与远端车队都就绪后创建（`src/multiplayer/item-race-wiring.ts`），赋给 `local.items`（接收 Ctrl 按下/松开/取消、Alt、Z）与 `local.itemRace`（道具箱、危险物回调）。每帧顺序：

1. 物理前 `update(nowMs)`（`race-frame-coordination.ts`）：瞄准阶段、到点的受害效果、定时水炸弹落点、区域检测、本机特效事件转给表现层。
2. 赛道渲染后 `present(...)`（`race-presenter-items.ts`，比赛帧与结算帧）：准星投影、`presenter.update`。
3. HUD 前 `hudState(nowMs)` → `hud.setItemState`。

时间：所有道具时间线以服务器 `startAt` 为起点，用比赛时钟映射（`toLocalTick`：服务器毫秒 − `offsetMs`）换成本地表现层时钟。

请求：`sendItem` 串行发送、序号严格 +1（`race-session.ts`）；被拒绝的请求只拒绝自身 Promise，控制器退回最后确认的道具槽，比赛继续。自己的道具在按键时就生效（加速、护盾/天使/电磁波窗口与其车身效果、磁铁牵引、定时水炸弹），使用被拒绝（`ITEM_LOCKED`、`INVALID_TARGET` 等）时一并撤回：加速 `cancelItemBooster`、牵引结束、窗口退回之前的值（已经挡过一次的护盾不再退回；队友的天使窗口保留），电磁波已结束的飞碟减速不恢复。错误回复不带 `slots`，所以 `ITEM_NOT_HELD`、`INVALID_USE`、读不懂的回复、序号失配或超时之后再发一次 `slots` 取回服务器的道具槽。每个定时水炸弹按自己的使用各自倒计时、各自上报爆点（HUD 显示最早的一个）。

判定顺序：重置/传送中 → 未命中；被困或蓝盾 → `escape`；电磁波挡飞碟 → `emp`；护盾挡有 Shield 状态的道具（挡一次即消失）→ `shield`；天使挡大魔王、乌云、道具锁以外的攻击 → `angel`；道具锁由服务器执行，总是命中。

[还原] 常量见 `ITEM_RACE_TUNING`：瞄准范围 150 m、半角 25°、锁定 600 ms；香蕉对使用者 1 s 保护；道具说明卡 3 s；刷箱提示 2 s；放置事件晚到 500 ms 内仍检测一次；飞碟的预警用导弹红色警告。换位卡（Alt）在第三阶段前不限次数（HUD 显示 ∞），变更卡（Z）不发请求，只在比赛聊天区显示一行“道具变更卡暂未开放。”。
