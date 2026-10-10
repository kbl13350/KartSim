# 任务栏菜单：奖励箱、任务、迷你提示窗、聊天、查找车手

本文是任务栏其余五个按钮的约定，补充 `ECONOMY.md`。数据（奖励、任务进度、公告、聊天记录、车手资料）都以**数据服务**为准；浏览器只显示。前端在 `rewrite/src/menus/`，由 `rewrite/src/timeattack/ready-menus.ts` 接到任务栏。

| 按钮（`tray@cn`） | 窗口（原版资源） | 说明 |
| --- | --- | --- |
| `goRewardBox` 奖励箱 | `stage_rewardBox` `mq_window@zz` + `rewardBoxCard@zz` | 第 1 节 |
| `questDialog` 任务（“!”） | `dialog2_questInfo2` `questInfo2@cn` | 第 2 节 |
| `noticer` 迷你提示窗 | `dialog2_noticer` `noticer@zz` | 第 3 节 |
| `toggle_gchat` 聊天 | `stage_globalChatSystem` `GCFrameInnerClient@zz`（国服的俱乐部聊天窗，标题栏放两个标签） | 第 4 节 |
| `findRiderButton` 查找车手 | `dialog2_findRider` → `dialog2_userInfo` `userInfo@zz` | 第 5 节 |

奖励箱、任务和车手信息是模态窗口（同一时间一个）；迷你提示窗和聊天窗停在页面旁边，不挡住下面的页面（窗口按自己的区域裁剪），比赛时随任务栏隐藏。

## 1. 奖励箱

“临时保管通过活动、任务等获得的奖励道具空间”：

- **进入奖励箱的**：任务奖励（emblem 除外，直接发放）、俱乐部基地赛事中心的每日福利、管理员赠送。驾照首通奖励、探险队、升级奖励仍然直接发放。
- 一条记录是一种道具（分类、编号、数量、天数，天数 0 为永久）或一笔货币（金币、酷币、点券）。保管 **30 天**，到期自动删除；领取后货币进钱包（流水原因 `rewardbox`，引用 `box:<id>`），道具进库存（来源 `rewardbox`，与抽奖奖励的规则相同：叠加数量、续期限时道具、已永久拥有的保持不变）。
- 窗口每页 8 张卡片，可单张“领取”或“领取本页道具”；悬停卡片显示获得时间、来源和说明。

| 路径 | 说明 |
| --- | --- |
| `GET /api/reward-box` | `{"entries":[{id,source,message,name,category,itemId,count,days,currency?,createdAt,expiresAt}],"days":30,"page":8}`，新的在前 |
| `POST /api/reward-box/claim` | `{"ids":[…]}`（1–8 个）→ `{"claim":{"claimed","items","wallet"},"entries","account"}`。已领或过期的 id 跳过；一个都没有 404 `REWARD_BOX_EMPTY`；id 数量不对 400 `INVALID_CLAIM` |
| `POST /api/admin/reward-box` | 管理员赠送：`{"username","currency"}` 或 `{"username","category","itemId","days"}`，加 `count`（1–1,000,000）与 `message`（≤ 60 字，默认“管理员赠送”）→ `{"ok":true,"entry"}`。400 `INVALID_GIFT`（未知道具、数量或天数超出范围）、404 `ACCOUNT_NOT_FOUND`、403 `ADMIN_REQUIRED` |

管理页面有“奖励箱赠送”一栏。

## 2. 任务

原版任务（`QuestAutomation`）的条件和奖励都在服务端，客户端只有界面和日期写死的活动任务。这里按原版界面（QuestUX2nd：进行中/完成两个列表、任务详情、进度条、奖励格）和原版任务类型自定了一组任务，只用服务端能统计的比赛：多人竞速（个人/组队）、无限加速（个人/组队）和单人练习计时赛。列表在 `internal/data/quest/quest.go`（可调整）。

| 类型（原版 type） | 统计 |
| --- | --- |
| 行驶 1 | 每场比赛 +1（完成与否都算） |
| 完成 2 | 完成比赛 +1 |
| 累计距离 3 | 完成比赛的赛道距离，单位 0.1 km |
| 名次 4 | 第 N 名以内完成 +1 |
| 胜利 8 | 第一名；组队赛中所在队伍获胜也算 |

| 编号 | 种类 | 任务 | 奖励 |
| --- | --- | --- | --- |
| 9001 | 每日 | 多人游戏行驶 3 回 | 1,000 金币 |
| 9002 | 每日 | 多人游戏完成 5 回 | 2,000 金币、[活动]光明骑士幸运宝石、幸运车胎 |
| 9003 | 每日 | 多人游戏胜利 1 回 | 5 酷币 |
| 9004 | 每日 | 竞速个人赛第 3 名以内完成 3 回 | 3,000 金币、[活动]海洋寻宝放大镜、幸运藏宝图 |
| 9005 | 每日 | 无限加速赛行驶 5 回 | 2,000 金币 |
| 9006 | 每日 | 多人游戏累计完成 10 KM | 3 酷币 |
| 9007 | 每日 | 练习计时赛完成 3 回 | 1,000 金币 |
| 9101 | 每周 | 多人游戏完成 30 回 | 20 酷币、宝石 ×3、车胎 ×3 |
| 9102 | 每周 | 多人游戏胜利 10 回 | 30 酷币、放大镜 ×3、藏宝图 ×3 |
| 9103 | 每周 | 组队赛胜利 5 回 | 10,000 金币 |
| 9201 | 一般 | 多人游戏累计完成 30 KM | 10,000 金币 |
| 9202 | 一般（需先完成 9201） | 多人游戏累计完成 300 KM | 50 酷币、徽章 8872 |

- 每日任务北京时间 06:00 重置，每周任务周四 06:00 重置（`questInfo2` detailDailyQuest / detailWeeklyQuest）；一般任务只能完成一次。
- 比赛结算时（多人：`SaveSettlement`，与成就、俱乐部活跃度同一事务；计时赛：发奖时）累加进度，达到目标即完成，奖励放进奖励箱（消息“任务：<任务详情>”），徽章直接发放。
- 表 `quest_progress(account_id, quest_id, period, value, completed_at)`；`period` 是周期第一天（一般任务为空串）。kart-data 每小时清理 14 天前的周期。

| 路径 | 说明 |
| --- | --- |
| `GET /api/quests` | `{"quests":[{id,reset,kind,target,rank?,channels,pre?,title,desc,mission,rewards,value,completedAt?,locked?,periodStart?,periodEnd?}],"resetHour":6}` |

## 3. 迷你提示窗

任务栏 noticer 按钮上方的气泡，一页一条，左右翻页：

- **系统提醒**：奖励箱里有道具（“奖励箱中有 N 个道具。”）、24 小时内完成的任务（“任务已完成。请在奖励箱中确认奖励~！”），没有已完成任务时提示还有几个可以进行的任务。点提醒的正文打开奖励箱或任务窗口。
- **管理员公告**：管理页面“迷你提示窗公告”一栏发布，标题 ≤ 40 字，内容 ≤ 400 字（“|”换行），可设开始、结束时间。

登录后提示内容有变化时气泡自动弹出（每分钟检查一次），也可以点按钮打开或关闭。

| 路径 | 说明 |
| --- | --- |
| `GET /api/notices` | `{"notices":[{title,message,kind}],"rewardBox":N}`；`kind` 为 `rewardBox`、`quest` 或 `notice` |
| `GET /api/admin/notices` | 全部公告（含未开始、已结束的） |
| `PUT /api/admin/notices` | `{"id"?,"title","message","startAt"?,"endAt"?}` → `{"id"}`（`id` 为 0 时新建）；400 `INVALID_NOTICE` |
| `DELETE /api/admin/notices/{id}` | → `{"ok":true}`；400 `INVALID_NOTICE_ID`、404 `NOTICE_NOT_FOUND` |

表 `notices(id, title, message, start_at, end_at, updated_by, updated_at)`。

## 4. 聊天

原版的全服聊天按服务器分频道并有喇叭、悄悄话；这里只有两个频道。窗口用国服客户端的聊天窗（`GCFrameInnerClient@zz`，450×277，标题栏、消息区、底部输入条），标题栏里放原版标签页布局的两个标签（全部聊天 / 俱乐部聊天）：

- **全部聊天**：所有打开聊天窗的车手；**俱乐部聊天**：同一俱乐部的会员（未加入俱乐部时不能发送）。
- 每条 1–30 字（原版输入框 maxChar 30），与私聊共用刷屏限制（`CHAT_FLOOD`，禁言 10 秒）。
- 每个频道在内存中保留最近 50 条，加入时发给新来的人；聊天记录不写数据库，数据服务重启后清空（多数据节点部署时各节点的频道互不相通）。
- 窗口里 Enter 发送，Tab 切换标签，Esc 隐藏；按键不会触发游戏的快捷键。

走好友系统的 WebSocket（`/api/messenger/ws`）：

| 客户端发送 | 回复 / 推送 |
| --- | --- |
| `{"type":"chat-join","requestId"}` | `{"type":"chat-joined","requestId","all":[…],"club":[…],"clubName","hasClub"}`；之后推送本账号能听到的 `{"type":"chat","line":{id,channel,from,text,at}}`（包括自己发的） |
| `{"type":"chat","channel":"all"\|"club","text","requestId"}` | `{"type":"chat-sent","requestId","line"}`；错误 `{"type":"error","code","requestId"}`：`INVALID_CHAT`、`NOT_IN_CLUB`、`CHAT_FLOOD`（带 `mutedUntil`） |
| `{"type":"chat-leave"}` | 不再推送聊天 |

重新连接后浏览器自动再次加入。

## 5. 查找车手

任务栏“查找车手”沿用小屋的查找对话框（输入车手名或从好友中选择），然后显示原版车手信息窗：等级手套、昵称、俱乐部徽章与两个代表徽章；原版显示 3D 车手的位置显示目前状态、驾照、俱乐部、注册时间和比赛统计；原版 VIP 等级的位置显示俱乐部。按钮：申请好友（好友系统接口）、访问小屋（打开对方的小屋，自己则回自己的小屋）、驾照（显示驾照与 PRO 有效期）。隐身的车手总是显示“不在线”。

| 路径 | 说明 |
| --- | --- |
| `GET /api/riders/{nickname}` | `{"nickname","progress","createdAt","stats":{races,wins,podiums,points},"mainEmblems":[…],"presence","self","club"?:{id,name,mark,frame,level,grade}}`；400 `INVALID_NICKNAME`、404 `UNKNOWN_RIDER` |

## 6. 存储

`reward_box`、`quest_progress`、`notices` 在 schema v11 引入。kart-data 每小时清理 30 天前已领取或过期的奖励箱记录、14 天前的任务周期。
