# 道具数据、道具箱与赛道危险物

道具赛（道具个人赛 / 组队道具赛）的数据层与赛道对象层，约定见 [`ITEM_MODE.md`](../../ITEM_MODE.md) 第 2、3、7 节与附录 B。全部测试读取真实 p3553 镜像（`item.rho`、`sound_fx_item.rho`、`track_common.rho`、DataPack1 与赛道容器），运行 `npm test` 或单独执行本目录的 `*.test.ts`。

| 模块 | 内容 |
| --- | --- |
| `item-bml.ts` | 通用 `item/<文件夹>/item.bml` 解析：保留每行全部属性；同名状态再次出现即开始下一个变体（base），与全部 103 份原版定义一致 |
| `item-catalog.ts` | `ItemIdx`、`ITEM_REGISTRY`（经典 22 项 + 附录 C.4 的特殊道具，idx ↔ 名称 ↔ 文件夹/变体 base）、模型/音效/图标路径（含 C.4 缺失音效回退、`animal<iconId>.png`）、`etc_/itemDescList.xml` 中文名与说明（CN 为空的 119/126/137 用 [还原] 名）、按族（`behaviour.family`）的行为（时长取该道具自己 base 的状态）、`ITEM_RULES`（无原版数据的还原常量）、`loadItemCatalog(library)`（同时载入装备特性表与特殊加速器表） |
| `item-passives.ts` | 装备特性（附录 C.1/C.2）：`etc_/itemTable.kml` 按 (标签, id) 逐属性叠加 `@cn`，`"p"`/`"p道具赛,p对AI"` 只取第一个数（-1 当 0）；按冻结的 `equipment.itemIds`（车 3、角色 1、宠物 21、护目镜 8、气球 9、头饰 11、飞行宠物 52）得到每位车手的特性；完全防御（车/宠物挡、吃香蕉/地雷）、部分减免（气球、头饰、奇奇）、快速逃脱、乌云系数；`item/slot/animalBooster.bml` + `@cn` 特殊加速器图标 |
| `item-roll.ts` | 与游戏节点一致的确定性掷骰（C.1）：raceId、useId、hazardId、victimId、kind 以竖线连成字符串（缺的编号写 0），取 UTF-8 的 32 位 FNV-1a 再模 100，小于概率即成功；共享向量 `item-roll-vectors.json` |
| `item-cube-source.ts` | 从载入的 `track*.1s` 取静态 `ToItemCube` 与移动 `itemCube`；`trackLocale@cn` 的 `customItemCube` → 赛道 ID 主题 → `village`，`cn` 优先于 `zz` |
| `item-cubes.ts` | `ItemCubeField`：所有道具箱共用一个装配场景（每箱一个包装节点 + 旋转节点 + 模型副本，几何同池、材质与贴图共享），类别 2 配对对象 `GoItemCube[]`，每位车手各自的 stay → eaten（`Eaten.life` 隐藏、`fired01` 特效跟随本机车、`eaten.ogg`）→ stay |
| `item-hazards.ts` | 赛道预置香蕉/地雷/隐形地雷/水雷：位置跟随嵌套场景世界矩阵，进入半径触发，同一物件 3 秒冷却；画面由赛道场景自身渲染 |
| `item-race-map.ts` | 道具房间判定、载图时的道具来源（目录按资源库缓存）、比赛装配时的道具箱与危险物 owner |
| `item-race-controller.ts` | 本机道具控制器（每局道具赛一个）：镜像服务器道具槽、Ctrl/Alt/Z 请求、导弹/磁铁瞄准、受害时间线与护盾/天使/电磁波/蓝盾判定、区域道具检测、命中与落点上报、喂 HUD 与表现层 |
| `item-race-rules.ts` | 控制器的纯规则：坐标换算（协议 `point` 用原版 z 向上坐标）、生效时刻、防御判定、瞄准候选、1600×900 舞台投影、`ITEM_RACE_TUNING`（[还原] 常量） |
| `item-race-slots.ts` | 道具槽镜像：已确认的服务器道具槽 + 未回包的使用/换位（先进先出），被拒绝时退回 |
| `item-race-changers.ts` | 道具换位卡/变更卡（C.6）：服务器回包的 `changers {slot, item, itemArmed}`（-1 为使用券）减去在途请求，决定 Alt/Z 能否发送与 HUD 行（张数/∞/可用） |
| `item-race-p3-contract.ts` | 第三阶段表现层与 HUD 契约增补在控制器一侧的视图（kartEffect 新种类与选项、`used.count`、命中 `variant`/`shot`、`ItemHudFeed`）；与表现层分支合并后应与其定义一致 |
| `item-race-presenter-contract.ts` | 重新导出表现层契约（定义在 `item-race-presenter.ts`） |
| `item-race-test-support.ts` | 测试用假对象：按附录 B 生命周期构造的道具目录（与原版目录逐项一致，见 `item-race-rules.test.ts`）、假物理/连接/表现层 |
| `item-fx-plan.ts` | 表现层的模型/音效表：按 base 0 状态解析每个道具的 `firing`（使用者车上）、`fired`（受害者车上）、`item`（道具物体本身）模型与对应音效、状态时长；`ITEM_FX_TUNING`（[还原] 常量） |
| `item-fx-assets.ts` | 表现层资源：模型解码一次、每个模型一个副本池（载入时预装配，需要时后台补装，单模型上限 8；留在赛道上的放置物（香蕉等）上限 64，且不会被新表现抢走副本）、共享贴图缓存；UFO 的 1 型颜色关键帧转成装配器支持的 0 型；定时水炸弹车上水球（取自水炸弹模型）；音效解码与播放（比赛音频路由，限 24 个同时播放） |
| `item-race-presenter.ts` | 道具赛表现层（契约 `ItemRacePresenter`）：投射物（追踪、弧线、哑弹）、投掷与放置物、车身效果（水泡、蓝盾、飞碟、闪电、恶魔、护盾、天使、电磁波、磁铁、车上水球）、命中/格挡表现与音效（按镜头距离衰减与左右声像）；`loadItemRacePresenter` 在 A40 中创建为 `assets.itemPresenter` |

表现层约定：所有坐标为 three.js 世界坐标（与 `body.position`、道具箱相同），时间为比赛表现时钟毫秒。原版模型都以车为原点（客户端 z 向上、车头朝 −y），所以每个模型挂在一个与车相同基底（right、up、forward）的节点下。事件迟到时动画按服务器时间线从中途开始；音效迟到超过 300 ms 则丢弃。同一 `useId` 的重复 `used`/`hit`、`used` 与 `kartEffect` 对同一车同一效果的重复开始都只保留一个表现。本机自己的效果（护盾、天使、电磁波、定时水炸弹、磁铁）在按键时就开始；若回包前已被控制器结束（护盾挡下攻击、比赛结束等），迟到的 `used` 回包不会再显示它。

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

判定顺序（附录 C.2）：重置/传送中 → 未命中；被困或蓝盾 → `escape`；装备完全防御（车/宠物挡 → `kart`/`pet`，吃掉香蕉/地雷 → `eat`，有神秘工头时加 `variant:"bonus"`）；黄金盾牌/保护盾（`Use` 之后无敌，挡乌云以外的一切，不写 `by`）；护盾挡有 Shield 状态的道具（飞碟除外，挡一次即消失）→ `shield`；天使挡大魔王类、乌云类、道具锁、飞碟以外的攻击 → `angel`；部分减免：气球（导弹 7/33/127/30，每次使用只爆一次）→ `AffectSmall`，头饰 → 飞碟 `HeadBandAffect`，奇奇 → `BonusAffect`；水天使车被水炸弹类/水苍蝇类/水雷困住时 `variant:"quick"`（物理 `quick`，500 ms）。概率都用共享掷骰，车先于宠物、同一种类共用一次掷骰。道具锁由服务器执行，总是命中。判定命中后本机物理不接受该效果时（`itemEffects.apply` 返回 false：被导弹/地雷弹起或被路障挡住时不能再打滑或被路障挡，或效果已过时），不上报本机没有出现的效果：区域道具（香蕉、地雷、水炸弹、定时水炸弹、路障、磁场、警灯）不上报也不消耗，下一帧继续检测，挡住解除时车仍在范围内就命中，与此时才开到那里的车一样；赛道危险物不上报（离开再进入才会再次触发）；定向攻击与定时水炸弹苍蝇的爆炸按未命中上报 `blocked`（不带 `by`）。

电磁波（C.1）：在 `startAt + Use.life` 时，只解除它覆盖的本队车手**正在生效**的飞碟减速（本机用物理 `end("slow", 3)`，远端按收到的飞碟命中记录），并在这些车上显示电磁波；没有人中飞碟就什么都不发生。天使也从 `Use.life` 之后生效。

特殊道具（C.4）：瞄准类（导弹换皮、致盲导弹、舞狮、电磁/像素导弹、雪精灵、黄金磁铁）、投掷/放置类（水炸弹变体、地雷类、水雷（触发半径取 Set 2）、巨型香蕉、弹性陷阱、废油弹）、自身类（特殊加速器、超级盾牌、黄金盾牌/保护盾、警灯/防护警灯、隐身）、目标类（定时水炸弹苍蝇、蜜蜂、符咒、龙卷风、黑云、恶魔阿哥/R博士）各按其族安排。电磁导弹命中后 `CountDown` 在目标处展开磁场，范围内使用者的其他对手减速并报 `variant:"small"`；定时水炸弹苍蝇到达后挂在目标上倒计时，爆炸时目标与附近的对手被困；对手的警灯在其 `Use` 期间碰到本机就打转（本机自报）；隐身车其他队伍看不见、不能被瞄准（表现层 `visibleToMe`）；符咒定住并锁道具，五个方向键按顺序按对（物理 `consumeDirectionPresses`）提前脱出（`escapeHold(EscapeAffect)`）。`used.count` 为 2 时两枚导弹各自判定，第二枚晚 200 ms，命中带 `shot`。

换位卡/变更卡（C.6）：Alt、Z 只在服务器回包的 `changers` 允许时发送（没有卡也没有券时 HUD 不显示该行，不再无限换位）；Z 发 `change`，回包前不改道具槽，之后直到下一个新道具前不能再变更；道具锁期间 Alt 可用、Z 不可用。服务器推送的 `slots`（`reason:"gain"` 获得表、`"start"` 迅引擎开局道具，后者在 HUD 与表现层闪一下）与 `lucci`（HUD 金币提示）直接更新。倒计时期间 HUD 显示组队赛 `avoidTeamkill` 或持有卡时的 `changerTuto`。起步加速成功（物理状态 1）时完赛请求带 `perfectStart:true`。

区域、危险物与道具箱每帧检测一次，按上一帧到这一帧的车辆路径检测（起点已在范围内的不算，起点在上一帧已检测过），快车或长帧（最长 500 ms）也不会越过 4 m 宽的香蕉；两帧之间的位移超过 120 m/s（加 1 m 余量）视为重置或传送跳跃，只检测终点。

水泡：本机连按左右提前脱出时（物理结束原因 `escaped`）发 `escape`（`useId`，赛道水雷为 0 加 `hazardId`），服务器转发 `escaped`；其他客户端收到后立即结束该车的水泡并开始蓝盾，没有提前脱出的在水泡结束时开始蓝盾。完赛时还没落到本机的乌云告诉表现层未命中（`blocked`），表现层据此丢弃为本机排好的遮挡与消失音效。

[还原] 常量见 `ITEM_RACE_TUNING`：瞄准范围 150 m、半角 25°、锁定 600 ms；香蕉（与所有放置物）对使用者 1 s 保护；道具说明卡 3 s；刷箱提示 2 s；放置事件晚到 500 ms 内仍检测一次；飞碟、符咒与瞄准类特殊道具的预警用导弹红色警告，苍蝇类与蜜蜂用水苍蝇警告，舞狮导弹没有预警；开局道具闪光与金币提示在 HUD 状态里保留 3 s；符咒 5 个方向键，按错从头开始；警灯碰撞半径 3 m（`ITEM_RULES.sirenTouchRadiusM`）。
