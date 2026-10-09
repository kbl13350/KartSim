# 道具赛（道具个人赛 / 道具组队赛）设计规格

本文是实现道具赛的约定。原版客户端可执行文件加壳，道具逻辑无法逐分支还原；下面的规则按“原版数据优先，其次是发行版逆向笔记，再其次是公认的跑跑卡丁车规则”还原。每条规则标注来源：**[数据]** 原版资源文件，**[发行版]** KartSim v39.11 还原代码，**[还原]** 本项目在没有数据时做的决定（数值可调，集中在常量里）。

调研原文（含行号）见会话草稿；关键来源：
- 道具定义：`recovered/data-full/item.rho/<folder>/item.bml.xml`（运行时路径 `item/<folder>/item.bml`）
- 道具概率：`item.rho/slot/itemProb_indi@zz.bml.xml`（个人）、`itemProb_team2@cn.bml.xml`（组队）
- 道具说明：`DataPack1/etc_/itemDescList.xml`（`<name>` / `<name>_desc`）
- 频道：`DataPack4/zeta_/cn/content/channel.xml:72-73`，限制 `itemGameRestrictionItemCount.xml`，`config.xml`
- 道具槽 HUD：`item.rho/slot/slot_template.bml`、`slot_frameResource.bml`、`item<idx>.png`
- 赛道：`track_common.rho/track@zz.bml`（`gameType="item"`、`isOnlyItemTrack`）、`randomTrack@cn.bml`（item 随机组）、`trackLocale@cn.bml`（`blocked`、`choosable`、`customItemCube`）

---

## 1. 模式身份

- 频道：新增原版频道 `itemIndiCombine`（individual，速度 7，gameType 2）和 `itemTeamCombine`（team，速度 7，gameType 4）。**[数据]** `channel.xml:72-73`。
- 玩法：新增 gameplay `"item"`。道具房间 = `gameplay:"item"` + 道具频道；道具频道只允许 `item`，`item` 只允许道具频道；需要资源版本 p3553（与其他特殊玩法一致）。
- 原版 gameType：`item` + `itemIndiCombine` → 2，`item` + `itemTeamCombine` → 4（生成代码 `SX`）。`vI(2|4)` 返回冻结的 `{modeId, kind:"item", team: modeId===4}`。
- 显示名：道具个人赛 / 组队道具赛（baseStringBag `itemIndiCombine` / `itemTeamCombine`、赛道卡 `modeKey` 用 `ItemIndi` / `ItemTeam`）。房间标题后缀“个人道具赛”/“组队道具赛”。
- 大厅：“道具赛”标签开放，两个分类“个人道具赛”“组队道具赛”（原版主菜单 `아이템카테고리` 的 `cn_아개_통합_0` / `cn_아팀_통합_0`），列表请求 `list-gameplay {gameplay:"item"}`，客户端按 individual/team 过滤。
- 奖励：频道名以 `Combine` 结尾，经验 ×1.1 规则不变 **[数据]** `rpBonus='1.1'`。
- 组队道具赛没有组队集气（不发 `team-charge`，HUD 不显示集气条）**[数据]** `stage_itemTeamGame` 不引用 `stage/speedTeamGame`。
- 竞速 N2O 计量条在道具赛隐藏，漂移不再产生加速器 **[还原]**（原版道具赛加速器只来自道具箱）。

## 2. 赛道

- 道具房间只能选 `gameType="item"` 的赛道（含 5 条 `isOnlyItemTrack`），且 `track.1s` 里有道具箱；去掉 `trackLocale@cn` 里 `blocked="true"` 或 `choosable="false"` 的赛道。竞速房间仍排除 `isOnlyItemTrack`。
- 选图窗口在道具房间默认只勾“道具”；随机组用 item 的 hot1–hot5、全部、新图、反向。随机码沿用现有编号（3–7 hot、0 全部、8 新图、30 反向），由房间玩法决定从 item 还是 speed 组抽。服务器从导出的 item 赛道池抽取。
- 道具房间默认赛道：item hot1 组第一条有道具箱的赛道（导出时确定，写进服务器数据）。
- 载图：道具赛的赛道对象准入与 speed-individual 相同，额外准入：`ToItemCube`、`ToMovableObject type=itemCube`（移动道具箱）、`onlyItemGame="true"` 对象、预置的 `banana` / `mine` / `mineHidden` / `waterMine`（`ltejump` 仍按原样忽略）。**不能**直接把 `"item"` 传给现有准入账本（会把路面标签、障碍等全挡掉）。

## 3. 道具箱

- 位置：`ToItemCube` 的 transform position（客户端 z 向上坐标，转换 `(x, z, -y)` 同 LTE 金币）；移动道具箱跟随其嵌套节点的世界矩阵。`instanceOrdinal` 在每个 `track*.1s` 内唯一且连续，作为道具箱 ID。
- 模型：`item/itemCube/<主题>/zz/itemCube.1s`（`cn/` 优先）。主题：`trackLocale@cn` 的 `customItemCube` → 赛道 ID 前缀主题。吃到特效 `item/itemCube/fired01.1s`（贴图在 `item/common/`，需作为额外贴图源），音效 `sound_/fx/item/itemCube/eaten.ogg`。**[数据]**
- 拾取：本机车与道具箱中心三维距离 ≤ `Stay.size`（2.0）。**[发行版]** GoLucci 规则。
- 每位车手各自一份：别人吃掉不影响你看到的箱子 **[还原]**（发行版逆向：赛道物件只与本机车配对）。吃到后隐藏 `Eaten.life`（2000 ms）再出现。
- 吃到即向服务器发 `cube`；服务器决定给什么、是否给（满槽、刷箱都照样碎箱但不给道具）。
- 刷箱检查：同一车手 10 秒内再次吃同一个箱子（中间没吃别的箱子）不给道具，提示原版 `multiplay_itemCubeAbusing`“无法获取更多道具。|请移动至下个道具箱。”（背景 `stage_/common/itemCubeAbusingMsgBg.png`）。**[数据]** 文案与开关 `config.xml:586-605`；10 秒 **[还原]**。

## 4. 道具分配（服务器）

- 名次：服务器按运动帧里的**当前**路线距离排序（已完赛者按完赛顺序排在最前）。现在只记最远距离，需要同时记当前距离。
- 名次组 **[还原]**：第 1 名 → top；其余按 `p=(rank-2)/(N-1)`（N=参赛人数），`p<1/3` high、`p<2/3` mid、否则 low。只有 1 人时按 top。
- 抽取：按名次组权重从表里抽（个人 `itemProb_indi@zz`，组队 `itemProb_team2@cn`）。**[数据]** 权重见附录 A。
- 限制 **[数据]** `itemGameRestrictionItemCount.xml`：`slotLock`、`angel`、`thunderbolt` 每位车手每局最多获得 2 次，达到后从表里剔除重抽；`booster` 在 `disableItemList` 中，解释为“不受限制” **[还原]**。
- 道具槽：容量 2，或该车 `ItemSlotCapacity=3` 时 3（客户端在 `cube` 请求里报容量，服务器夹到 2..3，第一次报告后本局固定）。新道具放进第一个空槽；满槽不给。
- 服务器保存每位车手的道具槽，是道具使用的权威。

## 5. 协议

沿用 giant-state 的模式：一个请求类型 `item`，一个服务器事件类型 `item`，用 `action` 区分。每位车手的 `sequence` 严格 +1；被拒绝的道具请求**不**让比赛失败（客户端用回包里的 `slots` 纠正本地道具槽）。

客户端 → 服务器（都带 `roomId`、`raceId`、`sequence`）：

| action | 字段 | 服务器处理 | 回包（只给发送者） | 广播（其他人） |
|---|---|---|---|---|
| `cube` | `cubeId`(1..4096)、`capacity`(2/3) | 刷箱检查、满槽检查、按名次抽取 | `{action:"grant", cubeId, itemId:int\|null, reason?:"full"\|"abusing", slots}` | 无（扫描期间给扫描方发 `scan`） |
| `use` | `itemId`、可选 `targetId`（瞄准类）、可选 `point:{x,y,z}`（投掷/放置点，客户端坐标） | 校验 slot0==itemId、未被锁（天使除外）；按附录 B 决定 `targets`；分配 `useId`；`startAt`=服务器当前毫秒；对追踪类按名次距离差算 `etaMs` | `{action:"used", …, slots}` | `{action:"used", playerId, useId, itemId, targets, startAt, etaMs, point?}` |
| `place` | `useId`、`point` | 路障（被锁定的第 1 名客户端计算落点）、定时水炸弹（使用者计算爆点）；只接受该 useId 规定的上报者 | 同广播 | `{action:"placed", useId, itemId, playerId, point}` |
| `hit` | `useId`（预置赛道危险物为 0）、`itemId`、`result:"hit"\|"blocked"`、可选 `by:"shield"\|"angel"\|"emp"\|"escape"`、可选 `hazardId` | 受害者自报；校验 useId 存活（60 秒内）、该受害者未报过、受害者是目标或区域/放置类；香蕉被首次命中即移除 | 同广播 | `{action:"hit", playerId:受害者, useId, itemId, userId, result, by?, removed?}` |
| `swap` | — | 有换位能力且槽 0、1 都有道具时交换 | `{action:"slots", slots}` | 无 |
| `change` | — | 有变更能力时按 `transform@zz` 变换槽 0（第 3 阶段） | `{action:"slots", slots}` | 无 |

服务器另发（无请求）：`{action:"scan", playerId:被扫描者, slots, until}` 发给扫描方队伍（扫描生效 8 秒内，对手道具槽每次变化都发）。

快照：`race.item = {"ruleset":"web-item-v1","table":"indi"|"team"}` 追加在现有字段之后；道具房间的身份比较（频道、玩法、item）和其他特殊模式一样冻结。

错误码：`ITEM_UNAVAILABLE`（非道具赛）、`ITEM_NOT_HELD`、`ITEM_LOCKED`、`INVALID_SEQUENCE`、`INVALID_USE`、`INVALID_TARGET`。

时间：`startAt` 是服务器时钟毫秒，客户端用比赛开始时同样的时钟映射换成本地时间。所有道具时间线从 `startAt` 起算，各客户端一致。

## 6. 道具行为（附录 B 是完整表）

通用：
- 时长取各道具 `item.bml` 第一组（base 0）状态的 `life`。
- **护盾**只挡 `item.bml` 里有 `Shield` / `StateShield` / `RocketShield` 状态的道具（香蕉、导弹类、水苍蝇、飞碟、路障、地雷、水雷）；护盾持续 `shield.Use.life`（2000 ms），挡一次后消失。**[数据推断]**（与 tip.xml“护盾、天使等道具无法防御大魔王”一致）
- **天使**保护全队 `angel.Affect.life`（4000 ms），挡大魔王、乌云以外的所有攻击；被道具锁时仍可使用天使。**[数据]** 道具说明 + **[还原]**
- **队友不受攻击**（`avoidItemTeamKill`）：导弹类、水苍蝇、飞碟、大魔王、闪电、乌云、路障、水炸弹都不打队友；**定时水炸弹例外**（会困住自己和周围所有人，用天使保护队友）。**[数据]** `config.xml:476`、`avoidTeamkill.bml`、骑手学校第 15 课。
- 受害者自己判定是否命中（发行版：赛道物件只与本机车配对；物理不是锁步）。
- 困住（水炸弹/水苍蝇/定时水炸弹/水雷）：车停在水泡里 `Affect.life`；期间每按一次左/右减少 120 ms，最短 500 ms **[还原]**；脱出后 `EscapeAffect.life` 内带蓝盾（`파란방패`）不受任何道具影响；车有 `UseExtendedAfterBooster` 时脱出 1 秒内按 ↑ 得到瞬间加速（第 3 阶段）。
- 被困、被导弹炸飞、被路障挡停时不能使用道具；打转、反向、减速、乌云时可以。**[还原]**
- 正在被困或带蓝盾时免疫新的命中。

## 7. 客户端结构

新目录 `rewrite/src/item/`：

| 模块 | 内容 | 负责 |
|---|---|---|
| `item-catalog.ts` | idx↔名称↔文件夹/变体、`item.bml` 解析（全部状态属性）、模型路径（`item/<folder>/<m>.1s`，回退 `item/common/<m>.1s`）、音效路径（`.ogg`/`.flac`，缺失时按附录 B 回退）、图标路径（`item/slot/item<idx>.png`、`item_s<idx>.png`、`item/itemStateNotice/item<idx>.png`）、中文名与说明（`etc_/itemDescList.xml`）、行为常量（附录 B） | W |
| `item-cubes.ts` | 道具箱来源（从载入的 `track*.1s`）、模型选择、类别 2 碰撞对象、每人状态机（stay→eaten→stay）、吃到回调 | W |
| `item-hazards.ts` | 预置香蕉/地雷/隐形地雷/水雷的来源与接触检测（进入半径触发，同一物件对同一车 3 秒冷却） | W |
| `driving/item-effects.ts` 等 | 物理侧：道具槽（容量取 `itemSlotCapacity`，任意 idx）、道具加速器、道具起步加速、关闭漂移产生加速器、受害效果（打转、困住、炸飞、反向、减速、缩小、挡停、磁铁牵引）、重置/冲线时清除、被困时暂停自动复位 | D |
| HUD | 道具槽（任意 idx 图标，2/3 槽，原版几何）、准星、被瞄准警告、乌云遮挡、道具锁、倒计时、提示与记录（2D 画布）、刷箱提示、道具说明卡；道具赛隐藏 N2O 与集气 | H |
| `item-race-controller.ts` | 本机道具状态机：与服务器同步道具槽、按键（Ctrl 按下/松开瞄准、Alt 换位）、瞄准锁定、请求串行发送、处理事件、按 `startAt` 安排受害效果、护盾/天使/EMP 判定、把状态喂给 HUD 与表现层 | 第二波 |
| `item-race-presenter.ts` | 投射物、放置物、车身特效（水泡、飞碟、护盾、天使、恶魔、星星、闪电）、音效；远端车同样显示 | 第二波 |

接口约定（第一波各模块的导出，名称可以按代码风格调整，但能力要齐全，并在报告里写清楚实际 API）：

```ts
// W: src/item/item-catalog.ts
export interface ItemState { name: string; lifeMs: number; size?: number; item?: string; firing?: string;
  fired?: string; itemFx?: string; firingFx?: string; firedFx?: string; auxFx?: string[] }
export interface ItemDefinition { idx: number; name: string; folder: string; base: number;
  title: string; description: string; states: ReadonlyMap<string, ItemState> }
export interface ItemCatalog {
  get(idx: number): ItemDefinition | undefined;
  byName(name: string): ItemDefinition | undefined;
  modelCandidates(def: ItemDefinition, stem: string): string[];   // 规范路径，按优先级
  soundCandidates(def: ItemDefinition, stem: string): string[];
  slotIcon(idx: number): string; smallIcon(idx: number): string; noticeIcon(idx: number): string;
}
export function loadItemCatalog(library): Promise<ItemCatalog>;

// W: src/item/item-cubes.ts（加载赛道时生成，挂在 map 结果上，类似 lteCoins）
export interface ItemCubeField {
  readonly object: Object3D;                 // 加到赛道 group
  readonly count: number;
  attach(coordinator, kartPosition: () => Vec3, canCollect: () => boolean,
    onPickup: (cubeId: number) => void): void;   // 类别 2 对象，queueKartPairObject
  update(nowMs: number): void;
  dispose(): void;
}
// W: src/item/item-hazards.ts
export interface ItemHazardField { attach(coordinator, kartPosition, canTrigger,
  onTrigger: (hazard: { id: number; itemIdx: number; kind: string; position: Vec3 }) => void): void;
  update(nowMs: number): void; dispose(): void }

// D: AL（physics）在 drivingMode.kind==="item" 时
physics.itemMode: boolean;
physics.setItemSlots(slots: readonly number[]): void;   // -1 为空，容量 = tuning.itemSlotCapacity
physics.itemSlotCapacity: number;
physics.startItemBooster(): boolean;                    // itemBoosterTime
physics.itemEffects: {
  apply(kind: "spin"|"trap"|"launch"|"reverse"|"slow"|"shrink"|"barrier"|"pull",
    durationMs: number, options?: object): void;
  escapePress(): void;                                   // 被困时左右键
  readonly active: ReadonlySet<string>; readonly immune: boolean; readonly canUseItem: boolean;
  clear(): void;
};
// 输入：道具赛里 Ctrl 的按下与松开、Alt、Z 交给道具控制器，不再走 startNormalBooster/reorderSpeedSlots

// H: 道具 HUD 的输入
interface ItemHudState { slots: number[]; capacity: 2|3; reorderProgress?: number;
  lock?: { remainingMs: number }; timeBomb?: { remainingMs: number };
  slotChanger: number|"infinite"; itemChanger: number|"infinite";
  aim?: { phase: "aiming"|"inrange"|"ontarget"; x: number; y: number };   // 1600×900 舞台坐标
  warning?: "rocket"|"waterfly"; cloud?: { opacity: number }; abuseUntil?: number;
  notices: Array<{ kind: "bad"|"good"; itemIdx: number; text: string; at: number }>;
  log: Array<{ attacker: string; victim: string; itemIdx: number; failed: boolean;
    team?: "solo"|"red"|"blue"; at: number }>;
  infoCard?: { itemIdx: number } }
```

## 8. 结果与成就

- 个人道具赛：与竞速相同，按完赛时间排名，第一名冲线后 10 秒结束。
- 组队道具赛：**最先冲线者的队伍获胜**，不计积分 **[还原]**（公认规则；原版观战道具结果行没有 TP 列 `item_line_template@zz`）。快照仍给 `teamScores`（为兼容校验），但 `winningTeam` = 第一名的队伍；结算界面道具组队不显示 TP 列和 TP 板。
- 成就：数据服务把道具赛归为 gameType 2（个人）/ 4（组队），`raceGameTypes` 让 0 包含 2、4，6 = {2,4}；激活原版 30 条道具赛成就（682–705、718–723）。

## 9. 分阶段

1. **第一波（并行）**：S 服务器（游戏节点+数据服务+导出工具）；L 模式身份与大厅/房间/选图/结算；W 道具数据、道具箱、赛道危险物、载图准入；D 物理与输入；H HUD。
2. **第二波**：道具控制器、表现层、联机收发、比赛装配接线；端到端可玩。
3. **第三波**：车辆/角色道具特性（`transformByKart`、`fired2Gain`、`firing2Gain`、`animalBooster`、`itemTable@cn` 属性）、配件效果（护目镜缩短乌云、电磁波头饰减半飞碟、气球概率挡导弹）、换位卡头饰/变更卡气球（Alt/Z）、迅引擎道具车开局带一个道具、脱出瞬间加速、结算称号；审查与修复；文档。

---

## 附录 A：概率表（权重，top/high/mid/low）

个人 `itemProb_indi@zz`：banana(8) 25/0/0/0 · cloud2(114) 20/0/0/0 · shield(10) 40/25/0/0 · emp(12) 15/0/0/0 · devil(2) 0/2/2/2 · guideRocket(33) 0/0/5/3 · ufo(3) 0/0/5/6 · barricade(113) 0/0/5/5 · rocket(7) 0/23/20/0 · waterBomb(9) 0/20/11/0 · waterFly(4) 0/25/10/0 · thunderbolt(111) 0/0/3/1 · booster(6) 0/0/24/51 · magnet(5) 0/5/15/32

组队 `itemProb_team2@cn`：banana 25/2/0/0 · cloud2 20/0/0/0 · shield 35/20/0/0 · emp 10/0/5/0 · devil 0/2/2/2 · guideRocket 0/0/3/4 · ufo 0/0/4/5 · barricade 0/0/5/5 · randomRocket(127) 0/15/5/0 · rocket 0/10/10/0 · waterBomb 0/15/10/0 · waterFly 0/25/15/0 · thunderbolt 0/0/3/1 · booster 0/0/20/60 · magnet 0/5/8/20 · scanning(109) 10/1/0/0 · slotLock(110) 0/1/2/2 · angel(11) 0/1/3/1 · timeBomb(13) 0/3/5/0

导出工具从原版文件读取，不手抄。

## 附录 B：道具行为

时间线都从 `startAt` 起算；“目标”由服务器在 `use` 时决定；`eta` = 夹在 [300, Use.life] 的 名次距离差 / 速度（导弹类 100 m/s，水苍蝇/飞碟 60 m/s）**[还原]**。

| idx | 道具 | 用法 | 目标 | 时间线 | 受害效果 | 护盾 | 天使 |
|---|---|---|---|---|---|---|---|
| 6 | booster 加速器 | 立即 | 自己 | — | 自己：道具加速 `itemBoosterTime`（3000） | — | — |
| 8 | banana 香蕉皮 | 丢在身后（`point`=车后 4 m） | 放置物 | +500 出现，存在 30000，半径 2.0 | 打转 2000（`당함`、`trapped` 音） | 挡 | 挡 |
| 9 | waterBomb 水炸弹 | 向前投（`point`=位置+速度×1 s+前向×20 m） | 区域 | +1000 落地爆开，半径 10，持续 1000 | 困住 2000 + 蓝盾 2000（`물방울갇힘_일반`） | — | 挡 |
| 4 | waterFly 水苍蝇 | 立即 | 前一名对手 | +eta(≤2000) | 困住 1000 + 蓝盾 2000 | 挡 | 挡 |
| 7 | rocket 导弹 | 按住瞄准、松开发射 | 锁定对手（无锁定=哑弹） | +eta(≤1500) | 炸飞 1500（`미사일폭발`） | 挡 | 挡 |
| 33 | guideRocket 追踪导弹 | 立即 | 第 1 名对手 | +eta(≤1500) | 同导弹 | 挡 | 挡 |
| 127 | randomRocket 随机导弹 | 立即 | 随机一名领先的对手 | +eta(≤1500) | 同导弹 | 挡 | 挡 |
| 5 | magnet 磁铁 | 按住瞄准、松开 | 锁定对手 | 立即，牵引 3000 | 自己被拉向目标（物理状态 16 + `using` 音） | — | — |
| 10 | shield 护盾 | 立即 | 自己 | 持续 2000 | 挡一次有 Shield 状态的道具 | — | — |
| 11 | angel 天使 | 立即 | 全队（含自己） | 持续 4000 | 挡大魔王、乌云以外的攻击 | — | — |
| 2 | devil 大魔王 | 立即 | 所有对手 | +500 预警 1000，之后反向 3000 | 左右键颠倒 | 不挡 | 不挡 |
| 3 | ufo 飞碟 | 立即 | 第 1 名对手 | +eta(≤1500)，减速 3000 | 驱动力×0.4、阻力×2 | 挡 | 挡；EMP 解除 |
| 12 | emp 电磁波 | 立即 | 自己 | 1500 | 解除飞碟，期间飞碟无效 | — | — |
| 111 | thunderbolt 闪电 | 立即 | 所有领先的对手 | +500 预警 1000 +600，之后 1500 | 缩小到 60% + 驱动力×0.5 | 不挡 | 挡 |
| 113 | barricade 路障 | 立即 | 第 1 名对手 | +1000 落在其前方 70 m，升起 266，存在 5000，半径 4.3 | 撞上挡停 500 | 挡（穿过） | 挡 |
| 114 | cloud2 乌云 | 立即 | 所有落后的对手 | +666 遮挡 10000 | 屏幕遮挡（`cloud2Effect.bml`） | 不挡 | 不挡 |
| 109 | scanning 透视镜 | 立即 | 本队 | 8000 | 本队看到对手道具槽 | — | — |
| 110 | slotLock 道具锁 | 立即 | 所有对手 | +2000 锁 3000 | 不能用道具（天使除外） | 不挡 | 不挡 |
| 13 | timeBomb 定时水炸弹 | 立即（挂在自己车上） | 区域 | +3000 在使用者当前位置爆开，半径 15，持续 1000 | 困住 2000 + 蓝盾 2000（含自己和队友） | 不挡 | 挡 |

赛道预置：banana 打转 2000；mine / mineHidden 炸飞 1500（`size` 3.0 时用其值）；waterMine 半径 10 困住 2000。

缺失音效回退：devil、waterFly 的 `trapped` → `waterBomb/trapped.ogg`；barricade 的 `shield` → `shield/shield.ogg`。
