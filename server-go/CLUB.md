# 俱乐部

本文是俱乐部功能的约定，补充 `ECONOMY.md`。俱乐部、成员、申请、预算、设施等级都以**数据服务**为准；浏览器只显示。

## 1. 范围（2026-10-09）

做了原版新俱乐部系统的四个页面（`ClubMainStage` 我的俱乐部、`ClubListStage` 俱乐部目录、`ClubCreateStage` 创建俱乐部、`ClubHouseStage` 俱乐部基地）和 dialog.rho 的申请列表、会员等级变更对话框，从任务栏“俱乐部”打开。

**暂未实现**：俱乐部赛（`clubRace_speed/item`，4v4、20:00–22:00 的专用频道与赛季）、俱乐部排名前 3 的标志框、在房间上显示俱乐部名。俱乐部聊天在任务栏的聊天窗（`MENUS.md` 第 4 节），车手信息窗显示俱乐部（第 5 节）。页面上的“俱乐部比赛记录”显示 0 场。

## 2. 原版规则（客户端资源里有的）

| 项 | 规则 | 来源 |
| --- | --- | --- |
| 创建条件 | 七彩色星星手套（56 级）以上，100,000 金币 | `stage_clubList` NotEnoughRp / NotEnoughLucci |
| 名称 | 2–10 字（只允许文字和数字），不能重名 | `stage_clubCreate` clubNameGuide |
| 简介 | 1–150 字 | clubIntroEdit maxChar |
| 徽章 | 新俱乐部从 9 个基本徽章、3 个基本标志框中选；俱乐部等级（总部等级）越高可用的越多 | `etc_/clubMark/clubMark@cn.xml`、`clubFrame@cn.xml`（导出为 `internal/data/club/club.json`） |
| 职位 | 会长、管理层（同意加入、修改简介）、优秀会员（同意加入）、会员 | `clubCrewModify` |
| 踢除 | 只有会长可以踢除管理层；管理层可以踢除优秀会员和会员 | cantKickoutSameGrade |
| 申请 | 一个账号同时只能申请一个俱乐部；开启“自动加入”的俱乐部直接加入 | `stage_clubList`、autoJoin |
| 退出 | 退出（或被踢除）后 24 小时内不能加入或创建俱乐部；会长不能退出，只能解散 | clubLeaveWarning、LeaveDateNotOver |
| 解散 | 只有会长；单人俱乐部立即解散，否则 7 天后解散，期间可取消，不能再加入 | clubBreakWarning、isGracePeriodClub |
| 设施 | 总部（俱乐部等级、徽章）、赛事中心（每日福利，2 级开放）、车手中心（人数上限 100/150/200/300/500）、银行（预算） | `stage_clubHouse` |
| 捐助 | 银行四档“%d万”，每天限 1 次，不能超过预算上限 | supportPopupError1/2 |
| 周活跃度 | 每周四 00:00（北京时间）重新开始 | clubHelpGuide_clubCSWeekly |

## 3. 原版放在服务端、这里自定的数值（`internal/data/club/club.go`，可调整）

| 项 | 数值 |
| --- | --- |
| 活跃度来源 | 会员每完成一场多人比赛 +1，第一名再 +1（俱乐部与个人的周活跃度、累计活跃度同时增加） |
| 捐助档位 | 1万 / 3万 / 5万 / 10万 金币 |
| 银行预算上限（按银行等级） | 100万 / 300万 / 500万 / 1000万 / 2000万 |
| 升级费用（升到 2/3/4/5 级） | 活跃度 500 / 2000 / 5000 / 10000，预算 20万 / 50万 / 100万 / 200万；总部另需会员 5 / 10 / 20 / 30 人；其他设施不能超过总部等级 |
| 改名 / 改徽章 | 消耗预算 50万 / 20万 |
| 申请人数上限 | 每个俱乐部 50 人 |
| 赛事中心福利（每格每天 1 次） | 2 级 2,000 金币，3 级 5,000 金币，4 级 5 酷币，5 级 10 酷币；领取后放进奖励箱（原版“获得的道具请在奖励箱内确认”，见 `MENUS.md` 第 1 节） |
| 周活跃度满格 | 页面上的周活跃度条以 1000 为满 |

升级会**扣除**俱乐部活跃度与预算（原版“LV%d 升级费用”）。俱乐部目录按当前活跃度排序。

## 4. 接口

| 接口 | 说明 |
| --- | --- |
| `GET /api/club` | `{me, club?, members, rules}`：自己的俱乐部与职位、申请中的俱乐部、冷却结束时间；会员列表（等级、手套、在线状态由数据服务填入）；`rules` 为第 2、3 节的数值与徽章表 |
| `GET /api/club/list?name=&master=&page=` | 俱乐部目录（每页 15 个，按活跃度） |
| `GET /api/club/info/{id}` | 单个俱乐部 |
| `POST /api/club/create` | `{name, intro, mark, frame}`；扣 100,000 金币，返回新的状态与账号摘要 |
| `POST /api/club/apply`、`POST /api/club/apply/cancel` | 申请（`joined` 表示自动加入）与取消申请 |
| `GET /api/club/applicants`、`POST /api/club/applicants/decide` | 申请列表与 `{accountId, accept}` |
| `POST /api/club/members` | `{accountId, grade}` 变更职位（会长）或 `{accountId, kick: true}` 踢除 |
| `PUT /api/club` | `{intro?, autoJoin?}`（会长、管理层） |
| `POST /api/club/leave`、`/break`、`/break/cancel` | 退出、解散、取消解散 |
| `GET /api/club/house` | 俱乐部基地：设施等级、预算、最近 8 次捐助、最高捐助人、我的捐助、今天已领的福利 |
| `POST /api/club/donate`、`/upgrade`、`/name`、`/mark`、`/welfare` | 捐助、升级 `{facility}`（0 总部 1 赛事中心 2 车手中心 3 银行）、改名、改徽章 `{mark, frame}`、领福利 `{slot}` |

错误码：`CLUB_LEVEL_REQUIRED`、`INSUFFICIENT_FUNDS`、`ALREADY_IN_CLUB`、`NOT_IN_CLUB`、`CLUB_NOT_FOUND`、`CLUB_NAME_TAKEN`、`INVALID_CLUB_NAME`、`INVALID_CLUB_INTRO`、`INVALID_CLUB_MARK`、`CLUB_COOLDOWN`、`CLUB_FULL`、`CLUB_APPLICANTS_FULL`、`CLUB_BREAKING`、`CLUB_NOT_BREAKING`、`NO_CLUB_APPLICATION`、`CLUB_PERMISSION`、`CLUB_MASTER_CANNOT_LEAVE`、`CLUB_MEMBER_NOT_FOUND`、`INVALID_GRADE`、`CLUB_BUDGET_LOW`、`CLUB_BUDGET_FULL`、`CLUB_DONATED_TODAY`、`INVALID_DONATION`、`CLUB_MAX_LEVEL`、`CLUB_HQ_LEVEL`、`CLUB_CS_LOW`、`CLUB_MEMBERS_LOW`、`INVALID_FACILITY`、`CLUB_WELFARE_LOCKED`、`CLUB_WELFARE_CLAIMED`、`CLUB_SAME_NAME`、`CLUB_SAME_MARK`。

## 5. 表（schema v10）

- `clubs`：名称（唯一，不分大小写）、简介、徽章、标志框、会长、四个设施等级、预算、活跃度 `cs`、周活跃度 `cs_week` 与其所属周 `week`、自动加入、解散时间 `break_at`。
- `club_members`：每个账号最多一行；职位、加入时间、个人周/累计活跃度、累计捐助与最近捐助日。
- `club_applications`：每个账号最多一个申请。
- `club_leaves`：最近一次退出时间（24 小时冷却）。
- `club_donations`：捐助记录；`club_welfare`：每天每格的福利领取。

解散期结束的俱乐部在下一次任何俱乐部操作时删除（成员、申请、捐助记录随之删除）。账号删除时其成员、申请等记录一并删除。
