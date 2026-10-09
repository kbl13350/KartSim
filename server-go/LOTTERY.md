# 抽奖：寻宝活动与精品道具场（通用扭蛋）

本文是抽奖功能的约定，补充 `ECONOMY.md`。抽奖结果、材料数量、保底进度都以**数据服务**为准；浏览器只显示。

## 1. 已确认的产品决定（2026-10-09）

| 项 | 决定 |
| --- | --- |
| 范围 | 寻宝活动（原版 `RouletteStage`，`stage_/treasureHunt`）和精品道具场（原版 `GachaUseStage`，`stage_/gachaUse`），服务端与前端一起实现 |
| 活动期限 | 默认一直开放，不按原版日期（寻宝原版 2026-07-16 ~ 08-13）；管理员可在管理页面关闭任一活动或设置开放时段 |
| 材料来源 | 原版礼包按原版价格出售（界面“兑换”按钮），另有每日免费材料（管理员可改） |
| 寻宝概率 | 原版在服务端，客户端没有：按保底次数推算（第 3 节） |
| 抽到已永久拥有的道具 | 照原版“您已持有该道具，请重新尝试”：本次不消耗任何材料，请求停止（第 3、4 节） |

## 2. 数据（`internal/data/lottery/lottery.json`）

由 `rewrite/tools/export-lottery-data.mjs` 从 mirror/p3553 导出（`--check` 校验是否过期；`go test ./internal/data/lottery` 校验版本号，**不要手改**）：

- `lotteries`：`zeta_/cn/lottery/lottery.xml` 中每个以 24 类道具为 id 的抽奖（210 个）。`sets` 为 rewardList 引用的奖池，**每次使用从每个奖池各抽一件**（原版“可获得共6种道具”的礼盒即 6 个奖池）。`key` 为 `needOther`：每次使用另外消耗 1 个的钥匙道具（幸运车胎、变形齿轮）；`clientNeedOther` 只是客户端显示用的道具，不消耗。`start`/`end` 是原版期限，只作参考。
- `rewardSets`：奖池，`weight` 为原版 `prob`（0 永不抽中），`notice` 为原版 `needToNotice`（精品道具），`summary` 为“可获得道具”列表的顺序。
- `mileage`：`lotteryMileage.xml` 中类型为 lottery 的保底（目前只有启程加速箱 24:1233：500 次必得）。`eventItemId` 是不累计保底的 [活动] 版本。
- `treasureHunts`：`treasureHunt.xml` 的寻宝表（夏日主题，174 项）。`summary` 1–9 为九个格子，`acquireCount` 为保底次数（750/450/150/50）。材料：`material` 海洋寻宝放大镜（34:883）、`eventMaterial` [活动]海洋寻宝放大镜（34:884）、`otherMaterial` 幸运藏宝图（34:834）。
- `packs`：stock.kml 中正在出售、含抽奖道具或寻宝材料、或只含钥匙道具的原版礼包（465 个；规则同商店报价，但允许多物品礼包；含 `setEventTemp` 钩子、一天一次、特殊限制的除外）。
- `stocks`：上面引用的全部 stock 及其物品（数量、天数，0 为永久）。
- `items`：商店目录以外的道具名称（item.kml 中非商店分类的全部道具与被引用的道具），`count` 为可叠加（isAdditional），抽奖道具与材料带 `effect`（原版说明）。56:1 酷币记入 K币，62:1 电池记入点券，其余进库存。

## 3. 寻宝

- 每次抽：优先用 [活动]放大镜，没有再用普通放大镜，同时消耗 1 张藏宝图。用 [活动]放大镜的抽奖**不计入也不重置保底**（原版“活动放大镜不参与保底次数变更”）。
- 概率（百万分比，`lottery/draw.go`）：保底道具 1/(2×保底次数)（天蝎 迅 0.0666%、黑鲨 迅 0.1111%、蓝色威龙 迅 0.3333%、超负荷高级部件 迅 1%）；其余 5 个格子道具各 0.5%；剩下 165 件平分剩余概率（各约 0.58%，合计约 96%，即“神秘魔方”格）。
- 保底：每个保底道具一个计数（`lottery_counters`：`hunt:<表id>:<stockId>` = 上次获得后的计数抽数）。计数抽时，若某保底道具的计数 + 1 ≥ 保底次数则直接给它（多个同时到期先给次数短的）；获得后只把该道具的计数清零（原版“只重置已获得道具的保底获得计数”）。已永久拥有的保底道具到期时不再强制，计数清零后正常抽。
- 稀有度（格子与结果的原版图）：保底道具按次数从长到短为 ultimate、legend、unique、epic，其他格子 rare，其余 normal。
- 10 个使用为一次请求（最多 10 次，材料不足即停）；10 个使用（连续）是浏览器连续发 10 抽请求，直到玩家停止、材料不足或抽到已拥有道具。

## 4. 精品道具场

- 列出账号持有的全部抽奖道具（任何来源，包括探险队补给箱等宝箱），再加上有原版礼包出售、且正在开放的抽奖（新到旧）。
- 每次使用消耗 1 个抽奖道具和 1 个钥匙道具（若有），从每个奖池各抽一件；一次请求最多 10 次。有保底的抽奖每次使用 +1 积分，积分到达某个奖励即发放，到达最后一个后从 0 重新开始。
- 道具发放：可叠加道具累加数量（上限 1,000,000）；租用道具从 max(现在, 到期) 起续期；永久道具让租用变为永久。抽到的任一非叠加道具已永久拥有时，本次使用不消耗任何东西，请求停止（`stopped.code = ALREADY_OWNED`）。礼包购买时已永久拥有的道具跳过（`owned:true`），不退款。
- 每日免费（每个北京日、每个活动一次，打开界面时自动领取）：寻宝默认 [活动]海洋寻宝放大镜 ×5 + 幸运藏宝图 ×5；精品道具场默认 [活动]光明骑士幸运宝石 ×5 + 幸运车胎 ×5。

## 5. 活动开关（`lottery_activities`）

活动 id：`treasureHunt`（寻宝）、`gacha`（精品道具场整体）、`lottery:<道具id>`（单个扭蛋；需要 `gacha` 与它自己都开放）。没有设置行时一直开放、用默认每日道具。管理员可设 `enabled`、`start`/`end`（Unix 毫秒，[start, end)）以及 `treasureHunt`/`gacha` 的每日道具（最多 8 种，数量 1–1000，天数 0–365）。礼包只在它出售的东西所属活动开放时可买。

## 6. 接口（都需要 Bearer 会话；POST 套账号写入限流）

| 路径 | 说明 |
| --- | --- |
| `GET /api/lottery/items` | `{version, items:[{category,itemId,name,count?,effect?}]}`（ETag = 版本，gzip） |
| `GET /api/lottery/treasure-hunt` | `{activity{open,enabled,start,end}, huntId, theme, slots:[{slot,rarity,stockId,items,chance,acquireCount?,counter?,remaining?}], others{rewards,chance}, materials{material,eventMaterial?,other:{category,itemId,name,owned}}, packs, daily{available,claimed,items}, rewards}`；`chance` 为百万分比 |
| `POST /api/lottery/treasure-hunt/draw` | `{requestId, count: 1\|10}` → `{draws:[{stocks,items,slot?,rarity,pity?,event?}], stopped?{code,item?}, wallet, holdings{"34:883":n…}, counters, slots}`；关闭时 403 `LOTTERY_CLOSED`，`count` 其他值 400 `INVALID_COUNT` |
| `GET /api/lottery/gacha` | `{activity, daily, lotteries:[{itemId,name,owned,featured,open,key?}]}` |
| `GET /api/lottery/gacha/{itemId}` | `{lottery{itemId,name,caption,desc,effect,dialog,sets,rewards}, activity, owned, key?, summary:[{stockId,notice,items}], mileage?{points,event,prizes:[{points,items}]}, packs, daily}`；未知 404 `LOTTERY_NOT_FOUND` |
| `POST /api/lottery/gacha/draw` | `{requestId, itemId, count: 1..10}` → 同寻宝结果（另有 `prizes` 为保底奖励，`draws[].notice`） |
| `POST /api/lottery/packs/buy` | `{requestId, stockId, expectedPrice?, expectedCurrency?}` → `{wallet, items, purchaseId}`；错误同商店购买（`PRICE_CHANGED`、`EXP_REQUIRED`、`INSUFFICIENT_FUNDS`、`REQUEST_ID_CONFLICT`），另有 404 `PACK_NOT_FOUND`、403 `LOTTERY_CLOSED`。写入 `purchases`（`offer_id` = `p<stockId>`）与 `wallet_ledger`（原因 `purchase`，计入商城累计消费） |
| `POST /api/lottery/daily` | `{activity: "treasureHunt"\|"gacha"}` → `{items, wallet}`；当天已领 409 `ALREADY_CLAIMED`，没有道具 409 `NOTHING_TO_CLAIM` |
| `GET /api/admin/lottery` | 管理员：`{activities:[…], lotteries:[{itemId,name}], serverTime}` |
| `PUT /api/admin/lottery` | 管理员：`{activity, enabled, start?, end?, daily?}` 保存，或 `{activity, reset:true}` 恢复默认 |

抽奖请求以 `requestId` 幂等（`lottery_draws` 保存结果，同一 id 重放返回原结果；类型、对象或次数不同 409 `REQUEST_ID_CONFLICT`）；一次也没抽成的请求不保存，可用同一 id 重试。货币道具的流水原因为 `lottery`（每日免费为 `lotterydaily`）。

## 7. 存储（schema v8）

```
lottery_draws(account_id, request_id, kind 'treasure'|'gacha', ref, count, result_json, created_at, PK(account_id, request_id))
lottery_counters(account_id, counter, value, updated_at, PK(account_id, counter))   -- hunt:<id>:<stockId> / mileage:<itemId>
lottery_daily(account_id, activity, day, created_at, PK(account_id, activity, day))
lottery_activities(activity PK, enabled, start_at NULL, end_at NULL, daily_json NULL, updated_by, updated_at)
```

材料用完后库存行保留在数量 0（道具图鉴仍算收藏过），`GET /api/inventory` 不再列出数量为 0 的行。

## 8. 与“我的物品”开箱的关系

“我的物品”的开箱（`POST /api/inventory/open`，与赛车探险队一起实现）与这里共用 `lottery.json`，但保留它自己的规则：按原版 rewardList 期限（过期 `LOTTERY_NOT_IN_PERIOD`）、把列出的奖池合并后只抽一件、`rpLimit` 需要经验、抽到已永久拥有的单件道具时按原版 `retryCount` 重抽。精品道具场打开同一个箱子时按本文规则（每个奖池各一件、管理员开关、已拥有则停止不消耗）。两边的规则以后如需统一再定。

## 9. 前端

- 大厅右侧“活动”面板（原版 mq 大厅 `eventmenu_pop`，按钮图 `stage_/mainMenu` 的 `event_thg_0x`、`limitedGacha_0x`）：寻宝活动、精品道具。
- 两个界面按原版 BML（运行时从资源库读取 `stage_window@zz`）用商店的 BML 组件渲染在 1080 高的虚拟屏幕上，全屏覆盖（含任务栏），Esc 或右上角关闭。原版 3D 场景（格子特效、扭蛋机背景、道具模型）用原版 2D 贴图代替：结果光效 `아이템출현광원_<稀有度>`、扭蛋背景 `통합가챠BG_<尺寸>`，道具图片用商店的车库快照。
- 代码：`rewrite/src/lottery/`（`lottery-api.ts` 接口与校验，`treasure-hunt-view.ts`，`gacha-view.ts`，`lottery-shell.ts` 共用的全屏舞台、对话框与“兑换”窗口），入口 `rewrite/src/timeattack/ready-lottery.ts`。
