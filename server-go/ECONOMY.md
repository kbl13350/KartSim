# 账号经济系统设计（等级 / 三种货币 / 库存 / 商店）

本文是账号经济功能的权威约定，补充 `DESIGN.md`（数据服务 + 多节点游戏服务）。所有余额、库存、等级都以**数据服务**为准；浏览器和游戏节点都不可信。

## 0. 已确认的产品决定（2026-10-07）

| 项 | 决定 |
| --- | --- |
| 注册 | 开放注册（填用户名、昵称、密码），按 IP 限流；邀请码模式保留为配置 `KART_REGISTRATION=open\|invite\|closed`（默认 `open`） |
| 游客 | 取消。打开游戏必须先登录/注册；数据服务默认不再签发游客票据（`KART_ALLOW_GUESTS=false`） |
| 货币 | 点券（coupon，原版 priceType 0“电池/cash”）、金币（lucci，priceType 1）、K币（koin，原版“酷币”，priceType 3）。幸运币（priceType 2，仅 3 条）不支持 |
| 货币来源 | 比赛奖励金币+经验；升级奖励（金币、按原版表给 K币、每 10 级少量点券）；道具图鉴奖励（按原版每件新收藏道具 1 K币，见 README“小屋”）；赛车探险队任务奖励（经验或金币，另发原版奖励箱）；开箱所得道具；点券/K币主要由管理员发放；新账号送初始金币 |
| 商品期限 | 照原版多期限（如 7/10/15/30/365 天、永久），过期自动失效并换回默认装备 |
| 标价 | 严格按原版货币：原版用什么货币卖就用什么货币；原版没有单品价格的物品按“该分类原版主要货币 + 分类/等级中位价”估价 |
| 抽奖 | 寻宝活动与精品道具场（通用扭蛋）见 `LOTTERY.md`：材料按原版礼包价格出售，另有每日免费材料；管理员可开关活动 |
| 新手礼包 | 系统练习车（practiceKart，itemId 0）+ 注册时二选一角色（皮蛋 2 / 黑妞 3）+ 选的喷漆和染色（原版新手颜色 6/4/5/7），全部永久 |
| 商店范围 | 车库能装备的全部物品（卡丁车、角色、宠物、飞行宠物、气球/头饰/眼镜/手套/喷漆/染色/光环/轨迹/车牌等，6,032 件）。改装部件、升级材料、涂装、工厂保持现有免费逻辑，不进商店 |

## 1. 等级

- 使用原版 `etc_/level/leveltable@cn.xml`（127 级，`nextRp` 为离开该级所需累计经验，`rpLimit` 75,000,000）。等级 = 满足 `exp >= nextRp[L-1]` 的最大 L（`nextRp[-1]` 视为 0），显示 `max(1, L)`。
- 每级的手套/徽章：`glove`（韩文键，对应 `DataPack1:etc_/level/<glove>.png`，32×32）与 `name`（中文名）。
- 经验在协议与接口中统一叫 `exp`（`rp` 已被“RP竞速”占用）。
- 升级奖励（每升一级逐级发放，写流水）：金币 `100 × 新等级`；K币严格按原版 `levelupreward@cn.xml` 的酷币表（`levels.json` 的 `koinRewards`：3、9、15 … 105 级和 109 级各 20，115 级 30，121 级 50，共 21 个等级）；每到 10 的倍数级给 50 点券。

## 2. 奖励

所有数值可通过数据服务配置倍率 `KART_EXP_RATE`、`KART_LUCCI_RATE`（默认 1.0）调整。只在数据服务配置：游戏节点从心跳响应（`contract.HeartbeatResponse.expRate/lucciRate`）得到当前倍率。

### 2.1 联机比赛（游戏节点 `finalizeRace` 计算，数据服务入账）

设 N = 本局载入完成的车手数，r = 名次，p = (N−r)/(N−1)：

| | 完赛 | 未完赛 |
| --- | --- | --- |
| 经验 | 30 + 50p + 5(N−2) | 10 |
| 金币 | 40 + 80p + 10(N−2) | 10 |

- 频道倍率：`*Combine` 频道经验 ×1.1（原版 `channel.xml` rpBonus，仅经验），`*Infinit` ×1.0；组队模式胜方经验与金币都 ×1.2；倍率同样作用于未完赛的 10/10。只有 1 人时 p=1，N−2 项最小取 0。以上倍率相乘后四舍五入（half-up）一次，得到基础奖励；配置倍率 `KART_EXP_RATE`/`KART_LUCCI_RATE` 再乘在取整后的基础值上并再次四舍五入（`rewards.ApplyRate`）。数据服务入账与游戏节点显示的 `race.rewards` 用同一函数，所以显示值 = 入账值（每日上限截断的部分除外）。实现见 `internal/shared/rewards`。
- 挡人模式（无名次结果）：跑者获胜跑者按第 1 名、挡人方按 N/2 名；挡人方获胜挡人方按第 1 名、跑者按最后一名（均视为完赛）。比赛中途离开房间的车手不发奖励（N 仍按载入人数计）；比赛在开跑 10 秒内结束（任何原因）则所有人按未完赛发放。
- 防刷（只影响奖励，`race.results` 仍与 Java 一致）：游戏节点记录每个 `finish` 到达的服务器时间；只有服务器观察到的比赛时长（到达时间 − `startAt`）≥ 10 秒且客户端上报的 `elapsedMs` 不比它短 3 秒以上，才按“完赛”计奖，否则按未完赛；按此判定的完赛者在奖励名次上排在其他人之前。
- 一个账号一场比赛只计一份奖励（取最好的座位），N 按不同账号数（加上游客）计；全集群一个账号同一时间只能有一个在线会话（`ACCOUNT_ONLINE`）。
- 组队平局（双方积分相同）时双方都不享受 ×1.2 胜方加成（快照中的 `winningTeam` 仍保持 Java 的取值）。
- 奖励放在比赛快照新字段 `race.rewards`（`{playerId: {exp, lucci}}`，所有玩法都有，含没有名次结果的挡人模式）（乘配置倍率后的值，与入账一致）和结算 `contract.RaceSettlement.Rewards`（`[{playerId, accountId, exp, lucci}]`，倍率前的基础值）；`race.results[]` 保持 Java 原样。客户端立即显示；数据服务在结算事务中入账（幂等键 = raceId + accountId）。
- 每日上限（按**数据服务收到结算时**的北京时间自然日，不采用游戏节点上报的完成时间）：比赛经验 20,000、比赛金币 30,000；超出部分不入账（`/api/account` 反映真实值）。完成时间早于 24 小时前的结算只保存比赛记录、不发奖励。
- 单条奖励上限 = 公式最大值（8 人、Combine 频道、组队胜方的第 1 名：经验 145 / 金币 216，倍率前），超出的条目丢弃并记录警告。
- 结算携带游戏节点显示奖励时用的倍率（`RaceSettlement.expRate/lucciRate`）；数据服务在 [0, max(10, 当前配置)] 范围内采用它，保证显示值与入账值一致。

### 2.2 计时赛

- 原版 `zeta_/cn/content/config.xml`：每次完成 经验 10 / 金币 20；刷新个人最佳再加 经验 20 / 金币 50。
- 由数据服务新接口结算，服务端按账号记录每条赛道最佳成绩判断“新纪录”；每日最多 50 次有奖励；成绩小于 10 秒或大于 1 小时视为无效（400 `INVALID_ELAPSED_MS`）。
- `trackId` 必须在导出的赛道表中（`internal/data/economy/tracks.json`，368 条，来自浏览器 `timeAttackTrackCatalog()`，含 `_rvs` 反向赛道），否则 400 `INVALID_TRACK`。
- 节奏限制：距离上一次结算不足 10 秒、或不足本次 `elapsedMs` − 3 秒时拒绝（429 `TOO_MANY_ATTEMPTS`，浏览器按“本局无奖励”静默处理）；同一 `requestId` 的重试返回原结果（`trackId` 或 `elapsedMs` 不同则 409 `REQUEST_ID_CONFLICT`）。
- 超过每日上限的跑次不再写入 `timeattack_runs`（只更新最佳成绩）；`timeattack_runs`、`daily_rewards` 保留 30 天，由每小时清理任务删除。

### 2.3 新账号

- 注册即送 10,000 金币，0 点券，0 K币；领取新手礼包（第 4 节）后才可进入游戏。

## 3. 商店数据

### 3.1 导出

构建期工具 `rewrite/tools/export-economy-data.mjs`（在 `rewrite/` 下运行 `node --import tsx tools/export-economy-data.mjs`；`--check` 在提交的 JSON 过期时退出码 1）。它直接执行浏览器的资源库与 `loadTimeAttackGarageCatalog`，保证与车库目录完全一致，从 `mirror/p3553` 读取：

- `etc_/itemTable.kml`、`zeta_/cn/shop/data/item.kml`（名称、描述、`isAdditional`）
- `zeta_/cn/shop/data/stock.kml`（价格、货币、期限 `expireDay`、数量 `itemCount`、`rpLimit`、`restriction`、`isOnceADay`）
- `zeta_/cn/shop/data/stockCard.xml`、`shopCat.xml`（当前上架卡片、原版商城页签/子页签、`shopMark` 角标、`originalPrice`、`eventBuyCount` 限购）
- `stage_/mqShop/stage_stringBag.bml`、`etc_/baseStringBag.xml`（页签/子页签的中文名，先查商城自己的字符串包，再查基础包）
- `zeta_/cn/content/tcCashEvent.xml`（商城累计消费活动，见 3.4）
- `etc_/level/leveltable@cn.xml`、`levelupreward@cn.xml`（等级表、K币奖励表）

输出 `server-go/internal/data/economy/catalog.json`、`levels.json`、计时赛赛道表 `tracks.json` 与商城活动 `events.json`（`go:embed`，数据服务以此为准），各带版本号（内容 SHA-256）。规则实现在 `rewrite/tools/economy-export/`（`offers.mjs` 报价、`shop-layout.mjs` 原版商城布局、`events.mjs` 活动），单元测试 `node --test tools/economy-export/economy-export.test.mjs`。

### 3.2 商品与报价规则

- 可售物品 = rewrite 车库目录（`loadTimeAttackGarageCatalog`，即资源齐全、能显示能装备的物品）中 category ∈ 车库可装备分类的全部物品；系统车（itemId 0）不卖。
- 报价（offer）只取**单品** stock（stock 内只有这一件物品）且 `isOnSale=true`、有价格；剔除占位价（金币 ≥ 1,000,000 或 0、点券 ≥ 100,000）、活动象征价（金币 ≤ 9，如 1 金币的活动兑换）、幸运币（priceType 2）、`isOnceADay`、`restriction` 中含 `notLucconBuy`/`notrefundable` 以外限制（情侣 `couple*`、`1`、`5`、`8`）的 stock；礼包（多物品 stock）不卖。
- 新手颜色以 `newRiderItem@cn` 为准（6/4/5/7）；前端新车手对话框也必须读取 `@cn` 版本（不是 `@zz` 的 1/4/5/7）。
- 约 27% 的可售物品（含 355 辆卡丁车）在 `item.kml` 里没有中文名，商店与车库一样显示 `内部名 (itemId)`。
- 同一物品同一（货币、期限、数量）有多个价格时：优先当前 `shopCat.xml` 卡片引用的 stock，其次 stockId 最大的。
- 活动兑换价：带 `onBuyOk='setEventTemp…'` 且低于同分类、同货币、同期限、同数量正常价中位数 25% 的 stock 剔除。
- 被支配的报价剔除：同物品同货币下，若另一报价价格不高于它、期限不短于它（永久最长）、数量不少于它且经验门槛不高于它，则剔除该报价。
- 原版从未有永久价的分类（12 耳机、32 经验金币加成卡、58、61 转速表）：估价只给一个限时报价（取该分类最常见的原版期限及其中位价），不估永久价。
- 气球：估价只给一个最常见规格的永久包（100 个 35 点券），不给限时。
- 估价回退顺序：发动机等级 → 分类 → 子页签 → 页签 → 全部，或 30 天中位价 ÷ 0.3311。
- 原版高价照原样保留（如 黄金骑士 9 英雄 49,900 点券）。
- `rpLimit` 保留为“需要经验 ≥ rpLimit”购买条件。
- 原版没有任何可用单品报价的物品：按“该分类原版报价中出现最多的货币”给估价；永久价 = 同分类（卡丁车再按发动机等级）原版永久价中位数；同时提供 30 天价 = 永久价 × 原版数据中 30 天/永久价格比的中位数（取整）。估价报价标记 `source:"estimated"`。
- `isAdditional`（按个数卖，如“气球 50 个”）的物品：记录数量，当前游戏不消耗，按“拥有”处理；同物品再次购买累加数量。
- 旧页签 `tabs`/`tab`/`subTab`（重写版自己的分法：卡丁车 道具车/竞速车、角色 角色/宠物/飞行宠物、装备 气球…其他）保留不变，供现有前端使用；原版商城布局用下面的新字段。
- 当前卡片：`shopCat.xml` 中“最新推荐页”与其他 ShopCat（`hide` 除外）引用的、`stockCard.xml` 中存在、`isOnSale=1` 且 `saleFlag≠1` 的卡片。最新推荐页 = `salePeriod` 为开放式（`…~*`）的 `recommand<N>`（多个时取开始最晚的；没有开放式时取开始最晚的），即 `recommand233`；更早的周页已结束。导出不看当前时间、也不看卡片自己的 `salePeriod`，结果确定。“同一（货币、期限、数量）优先当前卡片的 stock”用的也是这组卡片（与改之前的全部推荐页相比，报价没有任何变化）。一张卡片“列出”某物品 = 卡片的某个 stock 是该物品的单品 stock（不论该 stock 是否成为报价）。

#### 3.2.1 原版商城布局（`shopTabs`、`shopCategory`、`shopSubCategory`）

- 页签 = `shopCat.xml` 的 ShopCat（文件顺序）：推荐 `recommand`（最新推荐页）、卡丁车 `kartBody`、角色 `character`、礼包 `package`、装备 `equip`、使用 `useful`；`hide` 和 `kartPass`（卡片全部不在 `stockCard.xml`）不显示，与 `stage_mqShop/stage_window@cn` 的 `itemCatTab` 六个按钮一致。子页签 = ShopCat 下的 SubCat（文件顺序）：推荐 new/hotItem/event；卡丁车 engineXun/engineV1/engineEtc/strengthen/tunningXun；装备 balloon/headband/goggle/color/dye/couple/etc；使用 specialKit/card/etc；角色、礼包没有 SubCat。
- 中文名按原版 `#sb(key)`：先查 `stage_mqShop/stage_stringBag`，再查 `baseStringBag`（推荐、新商品、热门商品、活动、卡丁车、迅 引擎、V1 引擎、其他引擎、改装部件、强化材料、角色、礼包、装备、气球、电磁波头带、防尘眼镜、喷漆、染色剂、情侣、其它、使用、必杀技、卡片类）。有 SubCat 的页签（推荐除外）最前面有“全部”（`allSubTab`，窗口第一个子页签按钮 `#sb(whole)`）；推荐没有“全部”，打开时选中第一个 SubCat 新商品（`defaultSubTab: "new"`）。
- 卡丁车按引擎族分：itemTable.kml `<kart engineGrade>`（车库 `garage-catalog.ts` 的同一字段；GarageX 也用它区分 XUN/V1 部件）9 = 迅（XUN）→ `engineXun`，8 = V1 → `engineV1`，其余（0–7，经典…X）→ `engineEtc` 其他引擎（原版 engineEtc 只上架引擎卡片，旧引擎车放在这里）。校验：原版 engineXun 卡片列出的 10 辆车全是 9，engineV1 卡片的 16 辆全是 8（第 17 张是车辆收藏胶囊，不是车）；名字也吻合（9 级 125 辆中 124 辆名带“迅”，另一辆内部名 cottonXUN_20year；8 级的猎影敞篷跑车名无 V1，但原版就把它列在 engineV1）。结果：迅 125、V1 157、其他 1,263。
- 其他种类：角色、宠物、飞行宠物 → `character`（无 SubCat；宠物按 `itemCat2ShopCat.bml` 8001 归角色）；气球/头饰/眼镜/喷漆/染色 → `equip` 的 balloon/headband/goggle/color/dye；手杖 handGearL（原版 equip/etc 卡片就是手杖）以及光环、轨迹、车牌、服饰、贴花、名字喷漆、车手栏背景 → `equip/etc`（原版没有装饰页）；双倍经验/金币卡 rpLucciBonus（原版 useful/card 卡片）、道具皮肤卡、转速表卡 → `useful/card`；回放摄像机 headPhone（原版 useful/etc 卡片）→ `useful/etc`。礼包卡片都是多物品 stock，不卖，礼包页签没有商品。
- 情侣装备：在 `stock.kml` 中有 `restriction` 为 `couple`/`couple2`…`couple5` 的单品 stock 的装备（43 件：气球、头饰、眼镜、手杖、光环），原版同时列在种类 SubCat 和情侣：`shopSubCategory: "couple"`，`shopSubCategories` 按原版 SubCat 顺序列出两者（如 `["balloon","couple"]`、`["couple","etc"]`）；只有一个 SubCat 时不出现 `shopSubCategories`。有情侣 stock 的卡丁车、宠物仍在自己的页签。
- 每张当前卡片（推荐页除外）列出的物品都必须落在推导出的 ShopCat/SubCat，否则导出失败。
- `cardItems`：原版卡片按卡片顺序列出的物品（`"category:itemId"`，去重）；子页签各有一份，无 SubCat 的页签放在页签上。前端在一个（子）页签里先按此顺序显示，再按目录顺序显示其余物品；推荐页只显示 `cardItems`。

#### 3.2.2 推荐、角标、折扣、限购、卡片价格

- `recommend`：最新推荐页中列出该物品的 SubCat（按 new、hotItem、event 顺序），例如 `["new","hotItem","event"]`；不在推荐页则不出现。当前 6 件可售物品在推荐页（其余推荐卡片是礼包、宝箱等不卖的东西）。
- `marks`：原版卡片角标（`stage_mqShop` eventTag 图），顺序 new、hot、discount、limited：`new`（new@cn 新品）、`hot`（hot@cn 人气黄星）取自推荐页卡片的 `shopMark`；`discount`（discount10/30/60@cn 加“折”字）= 有报价带 `originalPrice`；`limited`（eventbuycount@cn 限购）= 有报价 `limited`。未知 `shopMark` 导出报错。
- 折扣：推荐页 `shopMark="discount<NN>"` 且带 `originalPrice` 的卡片，把原价记到卡片显示的 stock（卡片中第一个成为报价的 stock）的报价上：`originalPrice`（划线原价）、`discountPercent: NN`（减价百分比）、`discountLabel` = (100 − NN) / 10 接字符串包的 `discount`（“折”），只在需要时保留一位小数：discount10 → `9折`、discount40 → `6折`、discount44 → `5.6折`。`price / originalPrice` 必须与 NN 相差不超过 2 个百分点（原版卡片 4365：499 / 558 = 减 10.6%，标 discount10），且 `originalPrice > price`，否则导出报错。当前唯一可售的折扣：SVIP通行证手杖（16:364）14 天 400 → 360 点券，9折。
- 限购：卡片有 `eventBuyCount`（或 `shopMark="eventBuyCount"`）时，它的 stock 报价标 `limited: true`，`buyLimit` = eventBuyCount（多张卡片时取最小）。当前 6 个报价：概念车 迅 四辆各 5 次、雯雯永久 1 次、SVIP通行证手杖 1 次。
- 折扣与限购都只用于显示：购买仍按报价 `price` 扣款、照常校验 `expectedPrice`，不限制购买次数。
- 卡片价格 `displayOfferId`（原版卡片只显示一个价格）：物品第一张当前卡片（`shopCat.xml` 文件顺序，推荐页在前）里第一个成为报价的 stock；物品没有这样的卡片时取最便宜的永久报价；没有永久报价时取最便宜的报价（“最便宜” = 按 点券、金币、K币 顺序第一个有报价的货币里价格最低）。当前：75 件为卡片第一个 stock；1 件为卡片中下一个 stock（宝宝 1:1：卡片第一个 stock 7 天 29 点券被旧 stock 10 天 24 点券支配而剔除，显示 30 天 121）；5,452 件取永久报价；504 件取最便宜报价。

### 3.3 catalog.json 结构

```json
{
  "version": "<sha256>",
  "shopTabs": [
    {"id": "recommand", "name": "推荐", "defaultSubTab": "new", "subTabs": [
      {"id": "new", "name": "新商品", "cardItems": ["16:364", "1:25"]},
      {"id": "hotItem", "name": "热门商品", "cardItems": ["16:364", "1:25", "1:7", "1:8", "1:2", "32:2"]},
      {"id": "event", "name": "活动", "cardItems": ["16:364", "1:25"]}]},
    {"id": "kartBody", "name": "卡丁车", "allSubTab": "全部", "subTabs": [
      {"id": "engineXun", "name": "迅 引擎", "cardItems": ["3:1513", "…"]},
      {"id": "engineV1", "name": "V1 引擎", "cardItems": ["3:1412", "…"]},
      {"id": "engineEtc", "name": "其他引擎", "cardItems": []},
      {"id": "strengthen", "name": "改装部件", "cardItems": []},
      {"id": "tunningXun", "name": "强化材料", "cardItems": []}]},
    {"id": "character", "name": "角色", "subTabs": [], "cardItems": ["1:25", "1:1", "…"]},
    {"id": "package", "name": "礼包", "subTabs": [], "cardItems": []},
    {"id": "equip", "name": "装备", "allSubTab": "全部", "subTabs": [
      {"id": "balloon", "name": "气球", "cardItems": ["9:1322", "…"]},
      "… headband 电磁波头带、goggle 防尘眼镜、color 喷漆、dye 染色剂、couple 情侣、etc 其它"]},
    {"id": "useful", "name": "使用", "allSubTab": "全部", "subTabs": [
      {"id": "specialKit", "name": "必杀技", "cardItems": []},
      {"id": "card", "name": "卡片类", "cardItems": ["32:2", "32:1"]},
      {"id": "etc", "name": "其它", "cardItems": ["12:1"]}]}
  ],
  "items": [
    {"category": 3, "itemId": 387, "kind": "kart", "name": "尖锋6.5", "desc": "…",
     "internalId": "saber10", "tab": "kartBody", "subTab": "speedKart", "engineGrade": 2, "kartType": 2,
     "shopCategory": "kartBody", "shopSubCategory": "engineEtc", "displayOfferId": "s5075",
     "offers": [
       {"offerId": "s5177", "currency": "coupon", "price": 95, "days": 10, "count": 1, "source": "original"},
       {"offerId": "s5178", "currency": "coupon", "price": 120, "days": 30, "count": 1, "source": "original"},
       {"offerId": "s5179", "currency": "coupon", "price": 200, "days": 365, "count": 1, "source": "original"},
       {"offerId": "s5075", "currency": "coupon", "price": 216, "days": 0, "count": 1, "source": "original"}
     ]},
    {"category": 16, "itemId": 364, "kind": "handGearL", "name": "SVIP通行证手杖", "tab": "equip", "subTab": "handGear",
     "shopCategory": "equip", "shopSubCategory": "etc", "recommend": ["new", "hotItem", "event"],
     "marks": ["discount", "limited"], "displayOfferId": "s26914",
     "offers": [
       {"offerId": "s26595", "currency": "coupon", "price": 200, "days": 7, "count": 1, "source": "original"},
       {"offerId": "s26914", "currency": "coupon", "price": 360, "days": 14, "count": 1, "source": "original",
        "originalPrice": 400, "discountPercent": 10, "discountLabel": "9折", "limited": true, "buyLimit": 1}
     ]},
    {"category": 9, "itemId": 1483, "kind": "balloon", "name": "钻戒气球", "isAdditional": true,
     "tab": "equip", "subTab": "balloon", "shopCategory": "equip", "shopSubCategory": "couple",
     "shopSubCategories": ["balloon", "couple"], "displayOfferId": "e9-1483-0", "offers": ["…"]}
  ]
}
```

顶层还有 `currencies`、`tabs`（旧布局）、`starter`（练习车 systemKey、角色 2/3、颜色 6/4/5/7、`defaultCharacter`/`defaultPaint`/`defaultDye`）、`generatedFrom`。

- `shopTabs[]`：`{id, name, allSubTab?, defaultSubTab?, subTabs: [{id, name, cardItems}], cardItems?}`，含义见 3.2.1。
- 物品：`shopCategory`（必有，kartBody/character/equip/useful）、`shopSubCategory`（有 SubCat 的页签必有）、`shopSubCategories`（仅情侣装备，两项）、`recommend`（推荐 SubCat 列表，原来的布尔值已改为数组）、`marks`（new/hot/discount/limited）、`displayOfferId`（必有，是该物品的某个报价），以及 `kartType`、`engineGrade`、`isAdditional`。
- 报价：`minExp`；仅显示用的 `originalPrice`、`discountPercent`、`discountLabel`（三者同时出现）、`limited`、`buyLimit`。`days = 0` 表示永久。`offerId` 为 `s<stockId>`（原版）或 `e<category>-<itemId>-<days>`（估价），全局唯一。
- 数据服务严格解析（未知字段拒绝）并校验：页签与 SubCat、物品位置、`recommend` 与推荐 `cardItems` 互相一致、`cardItems` 中的物品确实在该位置、角标与报价一致、`displayOfferId` 存在、折扣字段完整且 `originalPrice > price`、`buyLimit` 只出现在 `limited` 报价上。

### 3.4 商城累计消费活动（events.json）

- 来源 `zeta_/cn/content/tcCashEvent.xml`（`stage_mqShop` 的 tcCash 窗口，“累计消费活动”）：

```json
{"tcCashEvents": [{"eventType": "use",
  "eventPeriod":  {"start": "2026-09-17T06:00:00+08:00", "end": "2026-10-15T05:59:59+08:00"},
  "rewardPeriod": {"start": "2026-09-17T06:00:00+08:00", "end": "2026-10-22T05:59:59+08:00"},
  "steps": [
    {"step": 1, "value": 1000, "stockId": 32336, "reward": {"name": "[活动]光明骑士幸运宝石", "category": 24, "itemId": 1242, "count": 10, "days": 0, "iconHint": "etc"}},
    {"step": 2, "value": 2000, "stockId": 29631, "reward": {"name": "迅 部件碎片", "category": 67, "itemId": 3, "count": 200, "days": 0, "iconHint": "etc"}},
    {"step": 3, "value": 5000, "stockId": 32396, "reward": {"name": "[活动]光明骑士幸运宝石", "category": 24, "itemId": 1242, "count": 40, "days": 0, "iconHint": "etc"}},
    {"step": 4, "value": 8000, "stockId": 32344, "reward": {"name": "孔明灯车手栏背景", "category": 71, "itemId": 16, "count": 1, "days": 0, "iconHint": "slotBg"}}]}],
 "generatedFrom": "…", "version": "<sha256>"}
```

- 时间：原版写的是北京时间、不带时区，导出为带 `+08:00` 的 ISO 8601；结束时间精确到秒且包含该秒（`05:59:59` 即到 06:00:00 为止）。只接受 `eventType="use"`（累计消费；累计充值没有对应功能，出现即导出报错）。
- 奖励：按 `stockId` 在 `stock.kml` 中解析（必须是单物品 stock）：`name` 取 `item.kml` 名称（没有时用 stock 名），`count`/`days` 取 stock 的数量与期限（0 = 永久）。奖励多是商城不卖的材料、宝箱，仍照列。`iconHint`：奖励是商城目录物品时为其 `kind`（如 `slotBg`），否则为 `etc`。
- `value` 是活动期间累计消费的点券数（原版“电池”= 点券）。活动显示期 = 活动开始到奖励领取期结束；活动期结束后消费不再累计（原版 `tcCashEventRewardHelp1`）。
- **奖励不发放**：数据服务只报告进度（`GET /api/shop/spend-event`，第 6 节），不发任何奖励，也不记录领取。

## 4. 新手礼包与引导

1. 注册/登录成功后 `GET /api/account`：`onboarded=false` 时显示原版新车手对话框（`FirstRiderDialog`），昵称取账号昵称（可修改，走 `auth/nickname`），角色只能选皮蛋(2)/黑妞(3)，喷漆与染色只能选 6/4/5/7。
2. `POST /api/account/starter {character, paint, dye}`：服务端校验白名单，一次性（幂等）发放：练习车（category 3、itemId 0、systemKey `practiceKart`）、所选角色、所选喷漆（category 2）、所选染色（category 70），全部永久，并写入初始装备。
3. 过期或不再拥有的已装备物品回退：卡丁车 → 练习车；角色 → 新手角色；喷漆/染色 → 新手颜色；其他槽位 → 0（卸下）。

## 5. 数据库（schema v2/v3，均 `CREATE TABLE IF NOT EXISTS`）

```
account_progress(account_id PK FK, exp BIGINT, level INT, updated_at)
wallets(account_id PK FK, coupon BIGINT, lucci BIGINT, koin BIGINT, updated_at)      -- 余额不得为负
wallet_ledger(id PK AI, account_id, currency VARCHAR(8), delta BIGINT, balance_after BIGINT,
              reason VARCHAR(24), ref_id VARCHAR(80), created_at,
              UNIQUE(account_id, reason, ref_id, currency), INDEX(account_id, created_at))
exp_ledger(id PK AI, account_id, delta, exp_after, reason, ref_id, created_at, UNIQUE(account_id, reason, ref_id))
inventory_items(id PK AI, account_id, category INT, item_id INT, system_key VARCHAR(64) DEFAULT '',
                quantity INT, expires_at BIGINT NULL /*NULL=永久*/, source VARCHAR(24),
                created_at, updated_at, UNIQUE(account_id, category, item_id, system_key), INDEX(account_id))
purchases(id PK AI, account_id, request_id VARCHAR(64), offer_id VARCHAR(40), category, item_id,
          currency, price, days, count, catalog_version, created_at, UNIQUE(account_id, request_id))
account_onboarding(account_id PK, character_id, paint_id, dye_id, claimed_at)
account_profiles(account_id PK, json LONGTEXT, updated_at)    -- 账号绑定的客户端档案
timeattack_bests(account_id, track_id, best_ms, updated_at, PK(account_id, track_id))
daily_rewards(account_id, day CHAR(10), kind VARCHAR(16), count INT, exp BIGINT, lucci BIGINT, PK(account_id, day, kind))
-- v2 另有：timeattack_runs（已奖励跑次的幂等记录）、purchases.result_json（重放原响应）、两本流水的 note 列
-- v3：admin_grants(admin, request_id → account, currency, amount)、timeattack_state（每账号最近一次跑次，用于节奏限制与重试）
```

- 所有余额/库存变更在单个事务内 `SELECT … FOR UPDATE` 钱包行后进行；流水唯一键保证幂等。
- 购买：`request_id`（客户端生成 UUID）幂等；已拥有永久 → 409 `ALREADY_OWNED`；已有限时再买限时 → 从 `max(now, expires_at)` 续期；买永久 → 变永久；数量物品累加。
- 管理员：`KART_ADMIN_USERNAMES`（逗号分隔）中的账号为管理员；已有 `admin=1` 的账号保持。开放注册下第一个注册者**不再**自动成为管理员。名单中的用户名**在任何注册模式下都必须凭有效邀请码注册**（防止被抢注）；名单中有尚未注册的名字时，数据服务每次启动都会确保存在可用邀请码并写入日志（`KART_BOOTSTRAP_INVITE` 或随机生成）。
- 管理员发放货币：`requestId` 与（管理员、账号、货币、数额）绑定；相同参数重放返回 `duplicate:true` 不重复发放，不同参数 409 `REQUEST_ID_CONFLICT`。
- 登录失败限制按（用户名、客户端网段 IPv4 /24 或 IPv6 /64）计数，攻击者无法锁住其他人的账号；注册限流另有 IPv6 /56 维度，全站注册额度只在字段预检通过后计数。

## 6. 接口

公网（Bearer 会话 token；全部套 CORS；写接口限流）：

| 路径 | 说明 |
| --- | --- |
| `POST /multiplayer/auth/register` | 开放模式不需邀请码（`KART_ADMIN_USERNAMES` 中的用户名除外，见第 5 节）；成功返回 `{account, token}`（直接登录）；密码 8–128 位；限流 429 `TOO_MANY_ATTEMPTS`；关闭模式 403 `REGISTRATION_CLOSED` |
| `GET /multiplayer/auth/config` | 增加 `registration`（open/invite/closed）、`loginRequired: true`、`guests: false` |
| `GET /api/account` | `{account{username,nickname,admin,createdAt}, progress{level,exp,levelExp,nextLevelExp,glove,gloveName,maxLevel}, wallet{coupon,lucci,koin}, stats{races,wins,podiums,points}, onboarded}` |
| `POST /api/account/starter` | 领取新手礼包（第 4 节） |
| `GET /api/inventory` | `{items:[{category,itemId,systemKey?,quantity,expiresAt\|null,source}], serverTime}`（已过期的不返回；`source` 为 `starter`（新手礼包，浏览器据此找回退用的角色/喷漆/染色；领取时已拥有的同一物品也改记为 `starter`）或 `shop`） |
| `GET/PUT /api/account/profile` | 账号绑定档案（收藏、小屋、车库改装、装备）。PUT 时服务端校验装备：商店出售分类（`economy.Kinds`）的每个非 0 槽位与槽位 3 的系统车（`systemKart`）必须拥有且未过期，否则 409 `ITEM_NOT_OWNED`；其他槽位（43–46、68/69、76–78 等车库免费物品）不核对；GET 时自动修正过期装备；没有档案时 404 `PROFILE_NOT_FOUND` |
| `GET /api/shop/catalog` | 商店目录（`ETag` = 版本，支持 304，gzip） |
| `POST /api/shop/purchase` | `{offerId, requestId, expectedPrice?, expectedCurrency?}` → `{wallet, item, purchaseId}`；错误 `OFFER_NOT_FOUND`、`INSUFFICIENT_FUNDS`、`ALREADY_OWNED`、`EXP_REQUIRED`、`PRICE_CHANGED`（与当前报价不符，409）、`REQUEST_ID_CONFLICT`；浏览器每个购买对话框一个 `requestId`，对话框内“重试”复用。扣款永远是报价的 `price`（`originalPrice` 只用于显示，限购不限制次数） |
| `GET /api/shop/spend-event` | 需登录（Bearer）。商城累计消费活动（3.4）：`{event, spent, active, serverTime}`。`event` 为当前显示的活动（`{eventType, eventPeriod{start,end}, rewardPeriod{start,end}, steps[{step, value, stockId, reward{name, category, itemId, count, days, iconHint}}]}`，显示期 = 活动开始至奖励领取期结束），`spent` = 该账号在活动期 `[start, end+1s)` 内商店购买花费的点券（`wallet_ledger` 中 `reason='purchase'`、`currency='coupon'` 的扣款合计；管理员扣款、金币/K币不算），`active` = 现在是否仍在活动期内（活动期后、领奖期内为 `false`，`spent` 不再增长）。没有显示中的活动时 `{"event": null, "spent": 0, "active": false, "serverTime"}`。只读，奖励不发放 |
| `POST /api/timeattack/settle` | `{trackId, elapsedMs, requestId}` → `{exp, lucci, newRecord, capped, bestMs, levelUps, summary}`；错误见 2.2 |
| `GET /multiplayer/admin` | 管理员网页（静态 HTML，登录后调用以下接口） |
| `POST /api/admin/grant` | 管理员给账号加/减货币或经验 `{username, currency, amount, note, requestId?}`（currency 为 coupon/lucci/koin/exp），写流水；余额不能为负（409 `INSUFFICIENT_FUNDS`/`INSUFFICIENT_EXP`），也不能超过 10^12（409 `BALANCE_LIMIT`） |
| `GET /api/admin/accounts?q=` | 查询账号（等级、余额、库存数量） |
| `POST /multiplayer/admin/invites` | 保留 |

内部（游戏节点）：

| 路径 | 说明 |
| --- | --- |
| `POST /internal/v1/equipment/verify` | `{accountId, equipment}` → 200 `{ok, validUntil?}`（`validUntil` = 所查租用物品最早到期时间）或 409 `ITEM_NOT_OWNED`（列出不拥有的槽位）。游戏节点先在大厅锁内执行命令本身的校验，必然失败的命令（未 hello、不在房间、房间不存在等）不会触发核对；需要核对时在锁外调用，再重新执行命令。肯定结果缓存到 min(validUntil, 核对后 10 分钟)，否定结果缓存 10 秒；每连接限 2 次/秒（突发 10，超出 429 `RATE_LIMITED`），全节点最多 32 个并发核对（超出 503 `DATA_SERVICE_UNAVAILABLE`）。hello/create/join/equipment 携带不拥有的装备返回 403 `ITEM_NOT_OWNED`；`ready` 核对发送者自己的装备，`start` 重新核对缓存已过期的所有成员，不拥有者被取消准备且开赛失败（403 `ITEM_NOT_OWNED`） |
| 在线占用（`PresenceClaim`/`Release` 带 `accountId`） | 账号键 `presence-account:{accountId}`（与昵称键同 TTL 与接管规则）；被其他在线会话占用时 409 `ACCOUNT_ONLINE`；心跳续期账号键，被他人占用的列入 `Conflicts` |
| `PathRaces`（已有） | `RaceSettlement.Rewards` 列出每位车手倍率前的基础经验与金币；数据服务按账号入账、处理升级、写流水、应用每日上限 |
| 心跳响应 `Conflicts` | 昵称占用已被其他节点接管的玩家 ID，游戏节点须断开这些连接 |
| 心跳响应 `expRate`/`lucciRate` | 数据服务的 `KART_EXP_RATE`/`KART_LUCCI_RATE`；游戏节点保存最新值，把快照 `race.rewards` 显示为 `rewards.ApplyRate(基础值, 倍率)`，结算仍发送基础值 |

## 7. 前端

1. 启动登录门：资源加载后、主界面前，若无有效 token 则显示登录/注册界面（原版风格对话框；注册字段：用户名、昵称、密码、确认密码；邀请码在 invite 模式必填，开放模式下折叠为可选的“有邀请码？”，管理员用户名注册时使用）。token 存 localStorage（记住登录 30 天）。退出登录回到登录界面。
2. 新账号引导：第 4 节的新车手对话框，领取礼包后进入主界面。
3. 档案：登录后档案改为账号绑定（`/api/account/profile`，服务端为准）；旧的浏览器档案首次登录时只迁移收藏、小屋设置等偏好，装备按库存修正。
4. 拥有过滤：车库（Ready 选道具、GarageX、小屋“我的物品”、联机选车）只显示库存中未过期的物品，并显示剩余期限；当前选择必须在列表中。
5. 大厅顶栏：手套图标、等级、经验条、三种余额实时刷新（购买、比赛、升级后）；“+”按钮打开商店。
6. 商店：任务栏“商店”按钮启用；界面按原版 PC 客户端 `stage_mqShop.rho`：在高 1080 的虚拟屏幕上按 BML 锚点（align/adjust）布局，再按视口高度整体缩放（与 PC 客户端一致，以用户提供的 1920×1080 原版截图逐项核对）。在大厅上打开时背景就是大厅实时 3D 场景、顶栏用大厅自己的顶栏（`LobbyHomeView.enterShop()` 让出快捷入口与车手）；在 Ready/车库打开时用不带车手的大厅静帧并由商城绘制同一条共用顶栏（`src/ui/lobby-top-bar.ts`）；没有关闭按钮，Esc 或任务栏离开。左侧为玩家 3D 车手与赛车（共享 `GarageLivePanels`，正面偏左视角），点卡片试穿、“初始状态”撤销；左上“充值/输入兑奖券”（暂未开放）及其下的“累计消费活动”面板（原版 `tcCashWindow`，数据来自 `GET /api/shop/spend-event`，只展示不发奖）；右侧 `shopItems` 窗口按目录 `shopTabs` 显示原版页签与子页签（推荐：新商品/热门商品/活动，无“全部”；卡丁车：全部/迅 引擎/V1 引擎/其他引擎/改装部件/强化材料；装备：全部/气球/电磁波头带/防尘眼镜/喷漆/染色剂/情侣/其它；使用：全部/必杀技/卡片类/其它；空的变灰），子页签内先按原版卡片顺序；卡片 230×194，标题栏颜色按货币（黄=点券、蓝=金币、绿=K币），只显示 `displayOfferId` 的价格，折扣显示原价划线→现价与“N折”角标，另有新品/人气/限购角标；卡面不显示拥有状态（悬停提示与兑换框中显示）。卡片“兑换”打开原版 `mqBuyItem@cn` 兑换框。商品网格裁剪在窗口内，不遮挡底部任务栏。
7. 结算展示：联机结果行显示获得的经验/金币；计时赛结果面板（原版已有 RP/Lucci 位）显示服务端返回的奖励；升级时弹出升级提示。
8. 账号面板：点击大厅头像显示账号信息（用户名、昵称、等级经验、三种余额、战绩、注册时间）、改昵称、退出登录。

## 8. 前端模块约定（并行开发用）

账号核心（`rewrite/src/account/`，由账号/车库工作负责）对外导出，商店模块只依赖这些接口：

```ts
// rewrite/src/account/account-session.ts
export type Currency = "coupon" | "lucci" | "koin";
export interface AccountSummary {
  account: { username: string; nickname: string; admin: boolean; createdAt: number };
  progress: { level: number; exp: number; levelExp: number; nextLevelExp: number | null;
              glove: string; gloveName: string; maxLevel: number };
  wallet: Record<Currency, number>;
  stats: { races: number; wins: number; podiums: number; points: number };
  onboarded: boolean;
}
export interface InventoryItem {
  category: number; itemId: number; systemKey?: string;
  quantity: number; expiresAt: number | null; source: string;
}
export interface AccountSession {
  readonly backendOrigin: string;          // 数据服务 origin
  summary(): AccountSummary | undefined;
  inventory(): readonly InventoryItem[];
  owns(category: number, itemId: number, systemKey?: string, now?: number): boolean;
  refresh(): Promise<void>;                // 重新拉取 /api/account 与 /api/inventory
  subscribe(listener: () => void): () => void;
  /** 带 Bearer 的数据服务请求；path 以 "/api/" 或 "/multiplayer/" 开头 */
  authorizedFetch(path: string, init?: RequestInit): Promise<Response>;
}
export function currentAccountSession(): AccountSession | undefined;
```

商店（`rewrite/src/shop/`，由商店界面工作负责）对外导出：

```ts
// rewrite/src/shop/shop-view.ts
export interface ShopOpenOptions {
  root: HTMLElement;                  // 挂载容器（全屏覆盖）
  library: unknown;                   // 资源库（读取 stage_mqShop / dialog2_buyItem 素材与 3D 预览）
  session: AccountSession;
  initialTab?: "recommand" | "kartBody" | "character" | "equip";
  onPurchased?(item: InventoryItem): void;
  onClose(): void;
}
export function openShop(options: ShopOpenOptions): Promise<{ close(): void }>;
```

`rewrite/package.json` 的 `npm test` 需包含 `src/account/*.test.ts` 与 `src/shop/*.test.ts`。
