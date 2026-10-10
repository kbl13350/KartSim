# 驾照考试（车手学校）

本文是驾照考试的约定，补充 `ECONOMY.md`。通关记录、奖励、驾照等级都以**数据服务**为准；浏览器只显示，并把跑完的成绩报给数据服务判定。

## 1. 范围与取舍（2026-10-09）

| 项 | 做法 |
| --- | --- |
| 版本 | 原版 2015 年后的“新驾照”（`zeta_/cn/content/config.xml` `reformedRiderSchool`）：新手、初级、L3、L2、L1 各 6 关，PRO 共 6 组（每组一场计时赛加一场对决），共 42 关 |
| 赛车 | 每一关都用练习用卡丁车（`practiceKart`，练习用卡丁车 V1；原版 2022-10-20 起按它设定时间），人物用玩家自己的；PRO 资格审核用玩家自己的车 |
| 速度 | 标准（gameSpeed 7） |
| 行驶练习（任务 id 0，第 1 关） | 按原版 RiderSchoolSpeedStage 的按键练习：依次出现“向前 / 向后 / 右转 / 左转”提示（`stage_common` action `앞으로1`、`뒤로1`、`오른쪽1`、`왼쪽1`），每完成一项播放“成功”（`ok`），四项都完成即通过（规则 `drill`，不限时）。数据里没有写怎样算完成一项，[还原] 为按住对应按键、且卡丁车朝该方向行驶累计 0.8 秒。先开到赛道尽头而没做完练习算失败 |
| 驾驶类任务（任务 id 20、22） | 按原版：在限时内到达终点；限时用原版的“任务计时器”倒数，时间到即失败 |
| 对决（任务 id 21） | 按原版：与对手幽灵（`outRun<关>@zz.xml` 指定的 .ksv）比赛，先于对手完成即成功 |
| 道具类任务（任务 id 1–3、5–9、11：第 2、4、5、8、9、11、13、14、19、20、25 关） | 规则 `item`：按原版在限时内完成，并完成本关自己的目标。比赛里跑道具赛（道具赛的道具控制器，裁决由浏览器本地完成，见下一行），道具栏、准星、道具说明、换位卡/变更卡与道具赛相同。开局道具 `itemslot0/1`、道具箱一律给 `cubeItem`、单格道具栏 `itemSlotCnt=1`、`nonLimitItem` 用掉后补回、`oneTime` 只给一张换位卡/变更卡（一格道具栏时 Z 把 slot 0 变成 `itemslot1`）。`target<N>` 处放 `targetName` 的模型（`target2` 海盗船长木板、`iron` 铁块，未写时用 `target`），`iron` 处放铁块；`targetArrow`/`goalArrow` 在未击中的木板/铁块上方显示箭头 |
| 道具任务的目标与脚本 | 按各关简报（`stage_riderSchoolReady` `stepN_1/2`）：导弹练习（第 4 关）用导弹击中木板即成功 [还原]；水炸弹练习（第 11 关）困住目标物后到终点；连续导弹（第 20 关）击中全部 5 个海盗船长后到终点，全部击中后道具箱改给磁铁 [还原]；其余关在限时内到终点即可。赛道 `event:*` 点触发脚本攻击，每场一次：`waterfly` 水苍蝇（按道具 Use 时长飞来，同时播 `sheild` 提示）、`waterbomb` 向车将到的位置扔水炸弹（玩家自己带水炸弹的第 11 关里它是投掷标记，不攻击）、`devil*` 大魔王（左右反转 3 秒）；被困时播 `shakeHit`（左右连打）提示。攻击者显示为“海盗船长”，不出现在赛道上 [还原] |
| 驾照专用的道具数值 [还原] | 原版限时推出的数值与道具赛的估计值（锁定 150、磁铁牵引最高 60）不符：C107 从起点到终点 269，第 19 关只给 4.5 秒（含按 Z），所以驾照里锁定距离 300、磁铁牵引加速度 60、最高 100（实测第 5/8/19 关 3.9/4.1/4.0 秒）；第 11 关在红色标记（x 590）处扔水炸弹而目标在 200 外，所以驾照里水炸弹落在前方 250 内、25° 内最近的木板上 |
| 有 AI 车手的道具任务（任务 id 4、12、13：第 15、22、26 关） | 网页版没有 AI 车手，**仍为到达终点即算通过**（规则 `finish`），不限时；准备界面会说明 |
| 失败表现 | 剧情与驾照比赛失败（超时、目标未完成）时显示原版 `retire@zz`“未完成”，角色播放哭泣动作（13），不再显示“完成”与欢呼动作 |
| 驾照考试专用赛道 | `village_L0x_xx`、`village_C0xx/C1xx`、`ice_C001`（共 20 条）在 `track@zz.bml` 里没有记录，由前端按任务登记元数据（1 圈）后载入。终点：17 条用 `<road final="end">`；开放赛道 `village_C005` 没有 final，取进入最后一段的门（即 `end`）为终点 [还原]；C005 是反向赛道（`reverse="1"`），第一段唯一的路线帧沿用了翻转后的门法线，起点因此朝后，这里把与本段走向相反的帧和起点转过来 [还原]；环形的 `village_C110/C116` 跑完一圈回到起点即终点。赛道里的 `event:*` 路段只在驾照比赛中放行：赛道 `<eventList>` 写了提示动画的（`turnLeft`→`좌회전`、`driftLeft`→`좌드립`、`booster`→`아이템` 等）进入时播放；没写的是脚本攻击（见道具任务一行；第 15、26 关的 `ufo`、`trap1`、`boostAI1` 等需要 AI，目前不执行） |
| 频道 | 原版 `channel.xml` 中无限加速频道 `licenseLevel=2`，国服只提示“建议初级驾照以上玩家进入该频道。”，这里同样只提示，不拦截 |

## 2. 数据（`internal/data/license/license.json`）

由 `rewrite/tools/export-license-data.mjs` 从 mirror/p3553 导出（`--check` 校验是否过期；`go test ./internal/data/license` 校验版本号，**不要手改**）：

- `licenses`：6 个驾照，每关 `step`（原版编号 1–42）、`mission`（原版任务 id）、`rule`（`drill` / `time` / `rival` / `item` / `finish`，见第 1 节）、`name`、`icon`、`track`、`laps`（0 为赛道默认）、`speed`、`timeMs`（`time` 与 `item` 规则的限时，`time` 为 0 时不限时）、`stockId`（原版首通奖励）。对决另有 `rival`（对手车辆、人物、录像）与 `rivalMs`（录像成绩，要跑得比它快）。
- 每关的 `setup`：`riderSchool@cn.xml` 里的其余原版设定，数据服务原样转给浏览器：`limitMs`（原版 `time`，含尚未按限时判定的 AI 道具任务）、`slotCount`（`itemSlotCnt`）、`slots`（`itemslot0/1`）、`cubeItem`、`targetName`、`targetArrow`、`goalArrow`、`nonLimitItem`、`oneTime`、`startTutoScene`、`wrongWayOff`、`showTimeUI`（`FALSE` 时隐藏计时信息，任务计时器照常显示）、`hideMiniMap`（隐藏小地图）。
- `pro`：PRO 资格审核的徽章（8524 跑跑大师徽章）与三项条件（矿山 曲折滑坡 1:12.00、森林 发夹 2:12.00、城镇 公路 1:10.00，标准速度）。
- `rewardStocks`：首通奖励的 stock 及其物品（`stock.kml`）。

## 3. 规则

- **能挑战哪个驾照**：必须先拿到前一个驾照；新手到 L1 还受等级手套限制（`leveltable@cn.xml` 的 tryLevel：黄色手套只能考新手，绿色手套可考初级，蓝色 L3，红色 L2，黑色及以上 L1）。PRO 需要 L1 驾照和资格徽章。
- **关卡顺序**：同一驾照内前一关通过后才能挑战下一关；PRO 本期的两关可任意顺序。已通过的关可以重跑，只刷新最佳成绩。
- **首通奖励**：每关第一次通过时发放原版奖励（酷币记入 K币，其余进库存；可叠加道具累加，租用道具续期，已永久拥有的跳过）。PRO 每期重新计算，每期首通都发奖励。
- **领取驾照**：本驾照所有关卡都通过后，点“获得驾照”领取（新手到 L1 必须按顺序）。PRO 驾照有效期 90 天，原版“单数月的每月1号任务会进行重置”：PRO 任务按北京时间每两个月一期（1、3、5、7、9、11 月 1 日开始），6 组轮流出现，每期可重新领取一次（续期 90 天）。
- **PRO 资格审核**：在 PRO 页点击条件即可在标准速度下用自己的车跑一场计时赛，数据服务记录每条赛道的最佳成绩；三项都达到后点“获得徽章”领取 8524 徽章（同时进入小屋徽章）。
- **成绩判定**：浏览器只在本地判定成功后提交成绩，数据服务再按规则判一次（失败为 `MISSION_FAILED`；`item` 规则服务端只能判限时，本关目标由浏览器判定）；成绩须在 1 秒到 10 分钟之间；两次提交的间隔不得少于本次成绩减 3 秒（`TOO_MANY_ATTEMPTS`）。每次提交带请求 ID，重试返回同一结果。
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
