# 驾照考试（车手学校）

本文是驾照考试的约定，补充 `ECONOMY.md`。通关记录、奖励、驾照等级都以**数据服务**为准；浏览器只显示，并把跑完的成绩报给数据服务判定。

## 1. 范围与取舍（2026-10-09）

| 项 | 做法 |
| --- | --- |
| 版本 | 原版 2015 年后的“新驾照”（`zeta_/cn/content/config.xml` `reformedRiderSchool`）：新手、初级、L3、L2、L1 各 6 关，PRO 共 6 组（每组一场计时赛加一场对决），共 42 关 |
| 赛车 | 每一关都用练习用卡丁车（`practiceKart`，练习用卡丁车 V1；原版 2022-10-20 起按它设定时间），人物用玩家自己的；PRO 资格审核用玩家自己的车 |
| 速度 | 标准（gameSpeed 7） |
| 驾驶类任务（任务 id 0、20、22） | 按原版：在限时内到达终点；限时用原版的“任务计时器”倒数，时间到即失败 |
| 对决（任务 id 21） | 按原版：与对手幽灵（`outRun<关>@zz.xml` 指定的 .ksv）比赛，先于对手完成即成功 |
| 道具类任务（任务 id 1–9、11–13：获得道具、导弹、磁铁、护盾、水炸弹、大魔王、海盗船长等） | 网页版还没有道具玩法和 AI，**改为到达终点即算通过**，不限时；准备界面会说明 |
| 驾照考试专用赛道 | `village_L0x_xx`、`village_C0xx/C1xx`、`ice_C001` 在 `track@zz.bml` 里没有记录，由前端按任务登记元数据（1 圈）后载入；赛道里的教学事件（`event:turnLeft`、`event:waterbomb` 等）只在驾照比赛中放行，不执行 |
| 频道 | 原版 `channel.xml` 中无限加速频道 `licenseLevel=2`，国服只提示“建议初级驾照以上玩家进入该频道。”，这里同样只提示，不拦截 |

## 2. 数据（`internal/data/license/license.json`）

由 `rewrite/tools/export-license-data.mjs` 从 mirror/p3553 导出（`--check` 校验是否过期；`go test ./internal/data/license` 校验版本号，**不要手改**）：

- `licenses`：6 个驾照，每关 `step`（原版编号 1–42）、`mission`（原版任务 id）、`rule`（`time` / `rival` / `finish`，见第 1 节）、`name`、`icon`、`track`、`laps`（0 为赛道默认）、`speed`、`timeMs`（`time` 规则的限时，0 为不限时）、`stockId`（原版首通奖励）。对决另有 `rival`（对手车辆、人物、录像）与 `rivalMs`（录像成绩，要跑得比它快）。
- `pro`：PRO 资格审核的徽章（8524 跑跑大师徽章）与三项条件（矿山 曲折滑坡 1:12.00、森林 发夹 2:12.00、城镇 公路 1:10.00，标准速度）。
- `rewardStocks`：首通奖励的 stock 及其物品（`stock.kml`）。

## 3. 规则

- **能挑战哪个驾照**：必须先拿到前一个驾照；新手到 L1 还受等级手套限制（`leveltable@cn.xml` 的 tryLevel：黄色手套只能考新手，绿色手套可考初级，蓝色 L3，红色 L2，黑色及以上 L1）。PRO 需要 L1 驾照和资格徽章。
- **关卡顺序**：同一驾照内前一关通过后才能挑战下一关；PRO 本期的两关可任意顺序。已通过的关可以重跑，只刷新最佳成绩。
- **首通奖励**：每关第一次通过时发放原版奖励（酷币记入 K币，其余进库存；可叠加道具累加，租用道具续期，已永久拥有的跳过）。PRO 每期重新计算，每期首通都发奖励。
- **领取驾照**：本驾照所有关卡都通过后，点“获得驾照”领取（新手到 L1 必须按顺序）。PRO 驾照有效期 90 天，原版“单数月的每月1号任务会进行重置”：PRO 任务按北京时间每两个月一期（1、3、5、7、9、11 月 1 日开始），6 组轮流出现，每期可重新领取一次（续期 90 天）。
- **PRO 资格审核**：在 PRO 页点击条件即可在标准速度下用自己的车跑一场计时赛，数据服务记录每条赛道的最佳成绩；三项都达到后点“获得徽章”领取 8524 徽章（同时进入小屋徽章）。
- **成绩判定**：浏览器只在本地判定成功后提交成绩，数据服务再按规则判一次（失败为 `MISSION_FAILED`）；成绩须在 1 秒到 10 分钟之间；两次提交的间隔不得少于本次成绩减 3 秒（`TOO_MANY_ATTEMPTS`）。每次提交带请求 ID，重试返回同一结果。
- **成就**：领取驾照会更新 `account_counters` 的 `license.level`（获得过的最高驾照，PRO 为 6）和 `license.pro`（领取 PRO 的次数），对应成就类型 30（萌新车手…职业车手）与 31（获得Pro驾照3回）。

## 4. 接口

| 接口 | 说明 |
| --- | --- |
| `GET /api/license` | `{table, state}`：驾照表（第 2 节，奖励只给名称）与账号状态：`level`（当前驾照，PRO 有效时为 6）、`baseLevel`（新手到 L1 中最高的）、`tryLevel`、`proUntil`、`proPeriod`（最近一次领取 PRO 的一期）、`proCount`、`qualified`（是否有资格徽章）、`period`/`periodEnd`/`proSteps`（本期 PRO 两关）、`cleared`（已通过的关：新手到 L1 全部，PRO 只列本期）、`records`（资格审核最佳成绩） |
| `POST /api/license/run` | `{requestId, step, elapsedMs}` 提交通过的一关；返回 `run`（`first`、`newBest`、`bestMs`、首通的 `reward`）、新的 `state` 与账号摘要 `account` |
| `POST /api/license/take` | `{level}` 领取驾照；返回 `license`（`level`、PRO 的 `proUntil`）、`state`、`account` |
| `POST /api/license/qualify` | `{requestId, track, elapsedMs}` 记录 PRO 资格审核成绩（需 L1） |
| `POST /api/license/emblem` | 领取资格徽章（三项条件都达到）；返回 `granted`、`emblemId`、`state`、`account` |

错误码：`LICENSE_LOCKED`（前一关/前一个驾照未完成，或等级手套不够）、`PRO_NOT_QUALIFIED`、`MISSION_FAILED`、`LICENSE_INCOMPLETE`、`LICENSE_HELD`（已领取，PRO 为本期已领取）、`INVALID_STEP`、`INVALID_LEVEL`、`INVALID_TRACK`、`INVALID_ELAPSED_MS`、`TOO_MANY_ATTEMPTS`、`REQUEST_ID_CONFLICT`。

`GET /api/account` 的 `progress` 多了 `tryLevel`、`license`（当前驾照，0 为无）与 `proUntil`。

## 5. 表（schema v9）

- `license_state`：每个账号一行，`level`（新手到 L1 中最高的）、`pro_until`、`pro_period`、`pro_count`、`last_run_at`（提交间隔检查）。
- `license_clears`：通过的关，主键 (账号, 关, 期)；新手到 L1 的期为空字符串，PRO 为该期起始月（如 `2026-09`）。
- `license_records`：PRO 资格审核每条赛道的最佳成绩。
- `license_runs`：每个请求 ID 的结果（重试返回原结果）。
