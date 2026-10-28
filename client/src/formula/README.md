# 极速方程单人模式

入口位于「单人游戏」顶部的「极速方程」。选择极易、容易、普通或困难后，与 19 名 NPC 连续比赛三回合。每回合结束显示本轮及累计积分，最后显示三回合总排名。前两轮使用传奇车手名单，第 3 轮按原剧情切换为黑暗车手，积分仍按原 NPC ID 延续。

方向键驾驶，Shift 漂移，Ctrl 使用普通氮气；激进能量充满后，按 Space 或点击屏幕按钮释放。Esc 打开暂停菜单。紧跟前车可充能，驶入原赛道维修区会更快充能。激进加速期间撞到 NPC，会使其打滑并记入撞晕次数。

## 赛程与计分

本次恢复采用 WKC 的 `wkc_R01`、`wkc_R03`、`wkc_R04` 三条原版闭环赛道，圈数使用各赛道元数据。三个回合的固定顺序是本项目选择，并非已证明的原版抽图规则。

每回合已完赛的第 1～20 名分别获得 20～1 分，未完赛获得 0 分。三轮累加后依次按总分、单轮冠军次数、最后一轮名次排序。该完整积分表和平分规则属于重建规则：已恢复的 XML 没有包含原始每名积分表，不能将它们当作原版数值。首车完赛后启动 30 秒终局倒计时，单轮最长 8 分钟；这两个时间也是恢复版设置。

## 已核实的原版数据

`formula-original-data.json` 由 `tools/export-formula-data.mjs` 从 p3553 原始档案解码产生，包含每个来源文件的 SHA-256。游戏直接打包使用这个快照，不依赖 `build/formula-research`。

| 内容 | 原始来源 | 恢复方式 |
| --- | --- | --- |
| 两组各 19 个 NPC，姓名、车辆、颜色 | `DataPack1/etc_/F1Game/F1Game@cn.xml` | 保留原始 ID 与参数；缺省角色的专用 NPC 车辆模型包含驾驶员 |
| 四档难度、三回合速度权重 | 同上 `F1LevelWeight` | 采用原始 speed/accel 和 step1/2/3Spd |
| 10 档玩家名次参数、9 档 NPC 加速间隔 | 同上 `F1RankWeight`、`BoostInterval` | 保留所有表格；原名次范围为 0～19，对外 API 使用 1～20 |
| 激进加速 2400 ms、打滑 2000 ms | `item.rho/crushBooster/item.bml` | 分别取 `Use.life`、`Affect.life` |
| 维修区 | 三个 `track_wkc_*.rho/track.1s` 的 `surface="pit"` | 使用原版碰撞三角形及客户端世界坐标，不用估计的矩形区域 |
| 中文难度名、对话及回合剧情 | `F1Game_StringBag.xml`、`aiF1modeChatScript@cn.xml` | 保留原始中文文本和条件；当前 NPC 名优先使用 `F1Game@cn.xml` |
| 奖励条件与奖励权重 | `F1GameReward@cn.xml` | 完整保留数据，不在单人客户端发放持久账户奖励 |
| 教程、能量槽、回合标识 | `gui_windowTemplate.rho`、`stage_f1Game.rho`、`stage_f1GameFinal.rho` | 通过现有资源库读取中文素材；窗口复用原有控件 |

WKC 三条赛道分别有 6、57、75 个原始 PIT 三角形。位置检测使用三角形内部判断和插值高度，因此不会把维修区旁边的主路或其他高度的路面当作维修区。

原 `F1Game_StringBag.xml` 仍保留较早的 NPC 名单，与 `F1Game@cn.xml` 中的二代名单不同；本实现使用后者，避免混合两个时期的名单。原奖励表 `rare` 的权重之和为 95；导出器保留这个事实，没有擅自改写为 100。

原剧情把第 3 回合称为黑化后的最终轮，并提供第 2 组 NPC。第 2 组保留尼欧与载伦，其他车手使用原黑暗赛车配置；两组数据都已恢复。

## 重建部分与边界

原资源保存了 NPC 参数和视觉素材，没有保存完整可执行的比赛逻辑。因此 NPC 沿路线的行驶、弯道减速、车道选择、原 speed/accel 权重到本地运动的换算，以及跟车距离、充能速率、碰撞半径和命中冷却由本项目实现。NPC 加速间隔取原表；动态追赶/让行策略尚不能证明与原服务端完全一致。

当前跟车充满约 8 秒，PIT 充满约 2 秒；激进加速和打滑时长使用上表的原值。原版采用三回合及多车对抗可由资源结构、剧情和历史说明交叉核对，不能据此推定所有执行细节已逐项复原。

本模式为本地单人玩法。它不创建联机房间、不提交计时赛排行榜，也不代替服务端发放原模式奖励。

## 开发验证

在 `client` 目录执行：

```sh
node --import ./src/physics/node-raw-test-hook.mjs --import tsx tools/export-formula-data.mjs --check
node --import ./src/physics/node-raw-test-hook.mjs --import tsx --test src/formula/*.test.ts src/timeattack/ready-formula.test.ts
```

第一条重新读取原始档案，校验导出快照；需要对应 Git LFS 资源已下载。第二条覆盖原参数组合、真实 PIT 几何、激进加速与打滑、赛程和积分结算，以及三回合入口、取消和重试流程。

原资源读取需要 `DataPack1_*.rho5`、`item.rho`、三个 `track_wkc_R01/R03/R04.rho`。运行还会使用 `theme_wkc.rho`、`sound_bgm_f1.rho`、其共用依赖 `sound_bgm_main.rho`、`character_neo.rho`、`DataPack2_00009/00010/00012.rho5` 中的原车模，以及原教程、能量槽和窗口档案；共享 UI 依赖还包括 `gui_monocoque.rho`、`gui_font.rho`、`stage_common.rho`。资源是否完整应以 `mirror/__p3553/resources` 的文件大小和 SHA-256 为准，Git LFS 指针文件本身不能运行。
