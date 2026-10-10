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
| `swap` | — | 持有道具换位卡（扣 1 张）或换位卡使用券、槽 0 与槽 1 都有道具时交换（附录 C.6） | `{action:"slots", slots, changers}` | 无 |
| `change` | — | 持有道具变更卡（扣 1 张）或变更卡使用券，且槽 0 的道具是新获得后还没变更过：按当前名次组从变更表随机重抽槽 0（附录 C.6） | `{action:"slots", slots, changers}` | 无 |

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
3. **第三波**：见附录 C。

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
| 3 | ufo 飞碟 | 立即 | 第 1 名对手 | +eta(≤1500)，减速 3000 | 驱动力×0.4、阻力×2 | 不挡 | 不挡；只有电磁波能解除（tip.xml:28、bonusStageProperty@tw:53）；头饰按概率缩短为 1500 |
| 12 | emp 电磁波 | 立即 | 本队（含自己） | +500（Use）时生效 | 只解除**正处于飞碟减速中**的本队车手的飞碟效果（在他们车上播 `fired01`、Affect 1500）；没人中飞碟就没有任何效果，道具照样用掉 | — | — |
| 111 | thunderbolt 闪电 | 立即 | 所有领先的对手 | +500 预警 1000 +600，之后 1500 | 缩小到 60% + 驱动力×0.5 | 不挡 | 挡 |
| 113 | barricade 路障 | 立即 | 第 1 名对手 | +1000 落在其前方 70 m，升起 266，存在 5000，半径 4.3 | 撞上挡停 500 | 挡（穿过） | 挡 |
| 114 | cloud2 乌云 | 立即 | 所有落后的对手 | +666 遮挡 10000 | 屏幕遮挡（`cloud2Effect.bml`） | 不挡 | 不挡 |
| 109 | scanning 透视镜 | 立即 | 本队 | 8000 | 本队看到对手道具槽 | — | — |
| 110 | slotLock 道具锁 | 立即 | 所有对手 | +2000 锁 3000 | 不能用道具（天使除外） | 不挡 | 不挡 |
| 13 | timeBomb 定时水炸弹 | 立即（挂在自己车上） | 区域 | +3000 在使用者当前位置爆开，半径 15，持续 1000 | 困住 2000 + 蓝盾 2000（含自己和队友） | 不挡 | 挡 |

赛道预置：banana 打转 2000；mine / mineHidden 炸飞 1500（`size` 3.0 时用其值）；waterMine 半径 10 困住 2000。

缺失音效回退：devil、waterFly 的 `trapped` → `waterBomb/trapped.ogg`；barricade 的 `shield` → `shield/shield.ogg`。

## 附录 C：第三阶段（车辆、宠物、配件特性；特殊道具；换位/变更卡；赛中金币；结算称号）

调研原文：会话草稿 `phase3-out/research-6.md`（特性）、`research-13.md`（按车辆的道具表与特殊道具）、`research-5.md`（换位/变更卡、称号与遗漏）；整理过的数据：`phase3/slot/merged_rowkey.json`、`special-item-registry.json`、`kartparams.json`。导出工具必须从原版文件重新生成这些数据，不能抄草稿。

### C.1 原则
- 克制类道具只有对方真的处于对应状态时才起作用，否则什么都不发生（道具照样消耗）。目前就是电磁波（只解除正在生效的飞碟）。保护类道具（护盾、天使、黄金盾牌、保护盾）是事先开启的保护，不属于这一类。
- 装备特性按冻结的参赛装备算：卡丁车 `itemIds["3"]`、角色 `"1"`、宠物 `"21"`、护目镜 `"8"`、气球 `"9"`、头饰 `"11"`、飞行宠物 `"52"`。服务器从 `race.roster` 冻结装备取；客户端从房间快照 `race.roster[i].equipment.itemIds` 取（不要用匿名/竞赛房间改写过的展示外观）。
- 属性值格式 `"p"` 或 `"p道具赛,p对AI"`：道具赛只用第一个数，`-1` 当 0（EC:101-106）。有效值 = 基础 `etc_/itemTable.kml` 叠加 `@cn`（按 tag+id 覆盖）。
- 概率判定必须客户端与服务器一致，用确定性掷骰：`roll(kind) = fnv1a32(\`${raceId}|${useId}|${hazardId}|${victimId}|${kind}\`) % 100`，`roll < p` 即成功（useId/hazardId 没有时写 0）。TS 与 Go 各实现一份并用同一组向量测试。

### C.2 装备特性（受害者客户端判定，服务器按冻结装备校验 `by`/`variant`）
判定顺序：暂停/复位 → 逃脱蓝盾 → 装备完全防御（下表“挡”）→ 护盾道具 → 天使 → 部分减免（气球、头饰、奇奇）→ 命中。

| 属性（持有者） | 作用道具 | 结果 | `by` / `variant` |
|---|---|---|---|
| `rocket`（车、宠物） | rocket 7、cokeRocket 30、goldRocket 32 及其换皮 102/107/126 | p% 挡（SpecialShield） | `by:"kart"`/`"pet"` |
| `waterfly`（车、宠物） | waterFly 4 及水苍蝇类 118/119/120 | p% 挡 | 同上 |
| `waterBomb`（宠物） | 水炸弹类：9、13、20、21、27、28、34、35、44、47 | p% 挡 | `by:"pet"` |
| `onlyWaterBomb`（车） | 只有 waterBomb 9 | p% 挡 | `by:"kart"` |
| `waterflyToWaterBomb` / `allflyToAllBomb`（车） | 水苍蝇类按水炸弹算，走 `onlyWaterBomb` 的掷骰 | — | `by:"kart"` |
| `devil`（车、宠物） | devil 2、drrMine 23、newDevil 38 | p% 挡，播 `대마왕_방어효과` | `by:"kart"`/`"pet"` |
| `snowBomb`（宠物） | snowBomb 34、timeSnowBomb 35 | p% 挡 | `by:"pet"` |
| `banana`（车）、`iceBanana`（车，仅 `ice_` 赛道 100%） | 香蕉 8、巨型香蕉 85（含赛道预置） | p% 吃掉：自己不受影响，香蕉被消耗，播 `바나나먹기` | `by:"eat"` |
| `mine`（+`mineWithEggMine`/`mineWithKindOfEgg` 扩到蛋蛋弹类 45/82/83）（车） | 地雷类 17/45/82/83/129/130（含赛道预置） | p% 不受影响；车有 `eatMine` 时地雷被吃掉移除 | `by:"kart"` 或 `"eat"` |
| `waterMine`（车） | 水雷 37 | p% 挡 | `by:"kart"` |
| `siren`（车） | 警灯 24 的撞开 | 100% 免疫 | `by:"kart"` |
| `waterAngel`（车） | 被水炸弹类/水苍蝇类/水雷困住 | p% 快速逃脱：困住只持续 500 ms | 命中照报，`variant:"quick"` |
| 气球 `prob`（`"9"`） | 导弹 7、追踪导弹 33、随机导弹 127、可乐导弹 30（**黄金导弹类 32/102/107/126 不行**） | p% 气球爆掉，导弹改为 `AffectSmall`（1000 ms 小幅炸飞），并得 10 金币 | `variant:"balloon"` |
| 头饰 `probability`（`"11"`） | ufo 3 | p% 改为 `HeadBandAffect`：减速 1500 ms（不再有 PostAffect） | `variant:"headband"` |
| 角色 `lucciUfo` | ufo 3 | p% 改为 `BonusAffect`：减速照常，得 10 金币 | `variant:"bonus"` |
| 角色 `lucciMine` + 车 `eatMine` | 吃掉地雷 | `EatBonus`：得 10 金币 | `by:"eat"`, `variant:"bonus"` |
| 护目镜 `trans` / `cloudTime`，车 `trans` | 乌云类 114/115/1 | 遮挡不透明度 ×(1−trans)，时长 ×cloudTime；不是防御，不上报 | — |
| 车 `useTwoRocket` / `useTwoGoldRocket` | 发射 rocket / goldRocket 类 | 一次发两枚，打同一目标，第二枚晚 200 ms，各自判定 | `used.count:2`，命中带 `shot:0|1` |
| 车 `lucciItemCube` | 吃道具箱 | 服务器 p% 加 10 金币 | — |
| 飞行宠物 `tuneGroupId=204` | 道具加速器 | `itemBoosterTime` +250 | — |

### C.3 按车辆的道具表（服务器）
- 表 = 基础文件叠加 `@cn` 行（`transformByKart` 按 (kartId, srcIdx, gitType)、`fired2Gain` 按 (kartId, firedItemIdx)、`firing2Gain` 按 (kartId, firingItemIdx, gameType)、`animalBooster` 按 kartId 覆盖；概率 0/-1 表示取消）。`gitType` 缺省或 `no_flag` 生效，`bossOnly` 忽略；`firing2Gain` 带 `gameType` 的行忽略。
- 吃道具箱得到道具时依次：限制（`itemGameRestrictionItemCount`，只对抽箱）→ `transform@zz`（赛道 `level` 0/1 时定时水炸弹→水炸弹；反向赛道且 level 0/2/3/4 时大魔王→R博士 23）→ `transformByKart`（p% 替换）→ `animalBooster`（得到加速器且该车有行时按 prob%，缺省 100，变成特殊加速器 31，图标 `item/slot/animal<iconId>.png`）。
- 使用道具（`use` 成功、槽 0 取出后）：`firing2Gain` 按实际使用的道具掷骰，得到的道具放进第一个空槽。
- 确认命中（受害者报 `result:"hit"`）后：`fired2Gain` 按受害者的车掷骰，得到的道具放进受害者第一个空槽，并以 `{action:"slots", slots, changers}` 推给受害者。
- 得到的道具不再经过变换表；满槽就丢弃。
- 迅引擎道具车（46 辆，导出表：引擎 12、道具车参数、`defaultExceedType` 对应的 `chargerSystemboosterUseCount=0`）：开赛时从 `itemProb_indi@zz` 的 14 种道具里等概率抽一个放进槽 0，再过 `transformByKart`；客户端在槽上播 `item/slot/12thEngineEffect_Big.bml`（`차져슬롯이펙트_big.1s`）。服务器在开赛快照之后第一次 `slots` 推送时给出（新增事件动作见 C.7）。

### C.4 特殊道具（变换、获得表带出的 49 种）
登记：idx、名称、`item.rho` 文件夹与变体 base 按 `special-item-registry.json`（导出时从原版重新核对）。客户端目录、服务器规则、表现层都按 base 取状态时长（不再固定 base 0）。行为（时长都取该 base 的 `life`）：

| 族 | 道具（idx） | 用法 / 目标 | 效果 | 护盾 | 天使 |
|---|---|---|---|---|---|
| 导弹换皮 | 32、102、107、126、30 | 同导弹（瞄准） | 炸飞 | 挡 | 挡 |
| 致盲减速导弹 | 99 老虎、136 黑豹、131 特快、108 恐龙爪 | 同导弹 | 减速（飞碟系数）+ 该道具的屏幕遮挡，`Affect.life` | 挡 | 挡 |
| 舞狮导弹 | 134 | 同导弹，受害者**没有**来袭警告 | 打转 + 遮挡 2000 | 挡 | 挡 |
| 电磁导弹 / 像素导弹 | 104、117 | 同导弹 | 目标被定住 `AffectMain` 2000；+500 在目标处展开半径 15 的磁场 1000，范围内其他对手减速 `AffectSub` 3000 | 挡 | 挡 |
| 水炸弹变体 | 34（困 3000）、20（2500）、47（2000）、27/44（2000 后道具锁 `PostAffect` 5000） | 同水炸弹（投掷） | 困住 + 蓝盾 | 不挡 | 挡 |
| 定时水炸弹变体 | 21（2500）、35（3000）、28（2000 + 锁 5000） | 同定时水炸弹 | 同上（含自己与队友） | 不挡 | 挡 |
| 水苍蝇变体 | 118（困 1500）、119（1000 + 锁 2000） | 同水苍蝇 | 困住（+锁） | 挡 | 挡 |
| 定时水炸弹苍蝇 | 120 | 前一名对手 | 到达后挂在目标车上倒计时 2000，在目标处爆开半径 15，目标与附近对手困住 2000 + 蓝盾 1000 | 挡 | 挡 |
| 蜜蜂 | 132 | 前一名对手 | 减速 + 蜂蜜遮挡 4000 | 挡 | 挡 |
| 地雷类 | 17、45、82、83、129、130 | 丢在身后（同香蕉），半径 2，存在 30000 | 炸飞 1500 | 挡 | 挡 |
| 水雷 | 37 | 丢在身后，触发半径 2，+1000 爆开半径 10 | 困住 2000 + 蓝盾 | 挡 | 挡 |
| 巨型香蕉 | 85 | 丢在身后，半径 7.5 | 打转 2000 | 挡 | 挡 |
| 弹性陷阱 | 25 | 丢在身后，半径 3 | 被弹回（knockback 500） | 挡 | 挡 |
| 废油弹 | 46 | 丢在身后，半径 2 | 油污遮挡 2000 | 挡 | 挡 |
| 黄金盾牌 / 保护盾 | 36（2500）、81（4000） | 自己 | 无敌：挡所有攻击（含大魔王类），不挡乌云遮挡 | — | — |
| 超级盾牌 | 18 | 自己 | 护盾 3000 + 加速 `SuperBoosterTime`（3500） | — | — |
| 警灯 / 防护警灯 | 24（3000）、106（200 + 2000 + 护盾） | 自己 | 加速，期间撞到的对手打转 2000（对手自报，像危险物） | — | — |
| 黄金磁铁 | 103 | 同磁铁 | 牵引 3000，期间带一次护盾 | — | — |
| 隐身 | 101 | 自己 | 7000：其他队伍看不见该车（队友半透明），不能被瞄准 | — | — |
| 特殊加速器 | 31 | 自己 | 加速 `AnimalBoosterTime`（4000） | — | — |
| 雪精灵 | 112 | 同导弹（瞄准） | 缩小 2000 | 不挡 | 挡 |
| 黑云 | 1、115 | 所有落后的对手 | 黑云遮挡（`cloud2Effect_1`）| 不挡 | 不挡 |
| 恶魔阿哥 / R博士 | 38 / 23 | 所有对手 | 前后键颠倒（38）/ 所有方向键颠倒（23），5000 | 不挡 | 不挡 |
| 龙卷风 | 135 | 同路障 | 撞上停住 2000 | 挡 | 挡 |
| 符咒 | 137 | 第 1 名对手 | 4000：不能动、不能用道具；方向键 QTE 可提前脱出（`talisman` 贴图与音效） | 挡 | 挡 |

缺失音效回退：雪/毒水苍蝇、定时水炸弹苍蝇、R博士、恶魔阿哥的 `trapped` → `waterBomb/trapped.ogg`；废油弹的 `eat`/`firing` → 香蕉；龙卷风、符咒的 `shield` → `shield/shield.ogg`。

### C.5 其他规则修正
- 天使、电磁波、透视镜：从 `startAt + Use.life`（500）起生效。
- 道具加速器的加速系数：车辆 XML 的 `BoosterAccelFactorItem`（1.6–1.8）覆盖到物理数据表的 `boostAccelFactorOnlyItem`（目前都是 1.5）。
- 脱出瞬间加速：车有 `UseExtendedAfterBooster` 或 `useExtendedAfterBoosterMore` 时，被水炸弹类/水苍蝇类困住结束（挣脱或到时）后 1000 ms 内按 ↑，触发漂移瞬间加速（物理状态 2，`driftBoostTick`）。

### C.6 道具换位卡 / 道具变更卡（消耗品，按原版）
- 物品：类别 7。`7:1` 道具换位卡（计数）、`7:2` 道具变更卡（计数）、`7:3` 道具变更卡使用券（限时，期间无限变更）、`7:4` 道具换位卡使用券（限时，期间无限换位）。商城按原版 `stockCard.xml` 上架使用券 1/7/30 天（10/45/140 点券）；道具卡包等已有来源照旧；“我的物品”的精品道具里显示数量。
- 开赛时数据服务给每位车手 `changers {slot: 张数|-1(使用券), item: 张数|-1}`（随装备校验一起拿），游戏节点冻结。
- Alt 换位：有卡或券、槽 0 与槽 1 都有道具才执行，扣 1 张（券不扣）；道具锁期间也可以。
- Z 变更：有卡或券、槽 0 有道具、该道具是“新获得后还没变更过”（吃箱、获得表、开局道具都会重新允许）、没被道具锁：从变更表（`itemProb_indiChanger@zz` / `itemProb_teamChanger2@cn`）按当前名次组重抽槽 0（同样套限制），扣 1 张（券不扣）；之后直到下一个新道具前不能再变更。
- 回包都带 `changers {slot, item, itemArmed}`。HUD：有卡显示 `x张数`（最多三位），有券显示 ∞，不能用时用 `disableUv`，没有卡也没有券时不显示该行。
- 结算：`RaceSettlement` 带每人消耗的卡数，数据服务在同一事务里扣库存（不低于 0，按 raceId 幂等）。

### C.7 协议增补
- `grant`、`used`、`slots` 回包加 `changers`；新的推送 `{action:"slots", slots, changers, reason:"gain"|"start", itemId}`（获得表、开局道具）。
- `used` 加 `count`（双发导弹为 2，其他省略）；`hit` 请求与广播加可选 `shot`（0/1）与 `variant`（`"small"|"headband"|"bonus"|"quick"|"balloon"`），`by` 增加 `"kart"|"pet"|"eat"`；服务器按冻结装备与道具校验（不满足就拒绝该 `by`/`variant`）。
- 新事件 `{action:"lucci", amount, reason}` 只发给得到金币的人（HUD 提示）。

### C.8 赛中金币
金额统一 10（原版只给出飞碟奖励 `lucci='10'`，其余沿用 **[还原]**）：金币道具箱（`lucciItemCube`）、奇奇被飞碟击中（`lucciUfo`）、气球爆掉、吃掉地雷（`lucciMine`）。服务器累计到该车手本局奖励的金币里（结算时单独列 `bonusLucci`），数据服务的单局金币上限加上本局可能的赛中金币上限（每人每局最多 200）。

### C.9 结算称号
`stage_mqGameFinal.rho/title_icons/namemap@zz`：百发百中（`fail=0`，且至少命中一次）、铁壁防御（天使 5 次）、炮台模式（导弹类 10 次）、苍蝇之王（水苍蝇 10）、地毯式轰炸（水炸弹 10）、阴云密布（乌云类 10）、莫名吸引（磁铁 10）、入侵地球（飞碟 10）、速度战（加速器 10）、完美起步（起步加速成功）、唯我独尊（每圈过线都是第 1 且第 1 名完赛）、安全第一（全程没被道具命中）。中文名为 **[还原]**。服务器按本局使用/命中记录计算，结果行带 `titles`；结算界面的 `titleCont` 显示图标 `title_icons/<名>_1.png` 并每 1600 ms 轮换名称。

### C.10 界面补充
道具说明卡：本局第一次显示 `first`/`first_desc`（扳手图标），之后显示名称 + 图标 + Ctrl 动画 + 说明；倒计时期间左下角显示教程板（持有换位/变更卡时 `changerTuto`，组队赛 `avoidTeamkill`）。
