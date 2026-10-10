# 原版小屋与小屋仓库：资源依据和 Web 实现

## 核对的原版文件

用户提供的 `/Users/winde/Downloads/kart/kart` 是 Windows 游戏目录。其 `Data/myRoom.rho` 和 `Data/stage_myRoom.rho` 与仓库的 `mirror/p3553` 对应文件 SHA-256 完全一致，因此下列 `recovered/data-full/` 解码结果可直接追溯到该游戏目录。`KartRider.exe` 是 PE32 文件，入口所在节和导入表呈加壳特征；当前无法从它可靠恢复小屋的 C++ 控制流、服务端协议或账号持有物品规则。实现依据是解码后的 BML 配置、`.1s` 场景资源和 Web 工程现有的资源解析与装备路径。

| 原版资源 | 可确认的行为 |
| --- | --- |
| `myRoom.rho/common/myRoom.bml`、`myRoomLocale@cn.bml` | 小屋 ID、场景目录和中文标题；ID 16 `tomb_M01` 是默认环境，部分环境带 BGM 或车辆显示比例配置。 |
| `myRoom.rho/<环境>/track.1s`、`skydome.1s` | 各环境的三维场景及天空；默认场景含车手与停车位的 `ToDummy` 站位点。 |
| `character_*.rho/model.1s`、`f10.1s`、`f11.1s` 与 `character_common.rho` | 普通角色模型采用同序 24 骨；同角色资源优先、通用资源回退后，`f10` 是直立待机，`f11` 是交替步行。默认 Dao 的本地 `f10` 为 2 秒，通用 `f11` 为 666 毫秒；两者与驾驶坐姿的 `f00/f01` 不同。`character_run_*` 更符合 OutRun 角色车辆用途，按实测反馈不用于小屋人物。 |
| `stage_myRoom.rho/stage.bml`、`mq_window@zz.bml` | 原版独立 MyRoom 场景；屋主菜单的 `garageOpen` 是“我的物品”入口，访客菜单还有查看屋主物品入口。 |
| `dialog.rho/garageDialog/myGarageDialog@zz.bml` | 真正的小屋“我的物品”窗口：左侧 `GaragePreview`，右侧四列网格、滚动条与最多 14 字的搜索框。 |
| `dialog.rho/garageDialog/atMyRoom@cn.bml` | 星标、锁定、网吧、赛车、抽奖、角色与宠物、装备、实用、装饰九个主分类及其细类/类别 ID。 |
| `gui_windowTemplate.rho/garageCard@cn.bml` | 道具卡片的期限、使用中、星标、锁定、网吧等显示状态。 |
| `dialog.rho/roomAdmin/mq_dialog@zz.bml` | 屋主管理界面还有访问权限、密码、聊天、BGM、环境与两辆展示车设置；这些需要独立的房间/社交状态。 |

`stage_garageX.rho` 的部件升级页面与 `stage_cashInventory.rho` 的收取/退款箱均不是小屋“我的物品”仓库。

`stage_myRoom.rho/stage.bml` 只声明 `MyRoomStage`，没有列出人物动作编号。普通角色 `f10/f11` 的姿态用途是从原版动作的骨骼轨迹核对出来的，不能据此声称已恢复可执行文件中的完整动作状态机。

## 当前 Web 路径

- `src/ui/my-room-catalog.ts` 读取原版小屋清单，只显示本地存在场景模型的环境。
- `src/ui/my-room-scene.ts` 解析和渲染同一环境的 `track.1s`、`skydome.1s`，使用原版 `rider00` 和 `parking00` 站位放置当前人物与赛车。当前人物采用普通角色模型，待机和移动分别使用本角色容器的 `f10`、`f11`，缺失时回退到 `character_common.rho`；赛车单独展示在停车位。场景占首页上方的游戏区域、保留底部菜单，支持键盘移动、固定方向的跟随视角、滚轮缩放和主题切换。行走边界依据原版站位点范围；由于可执行文件加壳，原生碰撞和输入状态机尚不能逐分支还原。
- `src/ui/my-room-hud.ts` 读取 `stage_myRoom.rho/mq_window@zz.bml`、`stage_stringBag.bml` 及其贴图，按 1600×900 舞台在场景上绘制原版 monocoque 界面：屋主菜单（`menuGroupOwner`）或访客菜单（`menuGroupVisiter`）、骑手列表 `riderCard0..7`（等级手套、名字，屋主可踢访客；按座位顺序紧凑排列、屋主在前，空座位不留空行）和聊天框（过长的发言按聊天框宽度折行，只显示放得下的最新几行，裁在框内）。屋主菜单的我的物品、成就、道具图鉴、我的徽章、探险队、管理、寻找小屋、随机进入可用（随机进入在原版 BML 里是禁用态，这里开启）；访客菜单的我的物品、查看成就、浏览图鉴、查看徽章、寻找小屋、随机进入可用；道具组合、查看道具、查看信息仍按原版禁用态绘制。
- 小屋是多人实时的：`src/myroom/myroom-connection.ts` 连接数据服务的 `/api/myroom/ws`，打开小屋时进入自己的小屋，寻找小屋（`dialog2_findRider`，可从好友列表选）或随机进入时换到别人的小屋，上锁的小屋弹出 `dialog2_passwordBox`。同屋的车手在场景里互相看到（`rider00-07` 站位出生、平滑走动），访客的车停在 `parking01-07` 后排；聊天、进出提示（`notifyEnter`/`notifyLeave`）走服务器。拜访时任务栏的“小屋”回到自己的小屋。
- 场景里每位车手头顶有名字牌，发言时名字牌上方出现聊天气泡（`src/ui/my-room-labels.ts`，场景上的透明画布，按车手身体包围盒顶部投影定位）：气泡用 `stage_myRoom` 的 `mq_window@zz` `talkBalloon0..7` 所用的 `gui_/monocoque` `YellowTalkBalloon` 边框（尖角在左下）与 bold14 黑字，按 Ready 房间的规则最多三行、5 秒后消失；名字牌取 `stage_mqReady` `talkBalloon@zz` 的 `nametag`（bold16、颜色 52 95 128、白色描边）。
- 走动的人物与 Ready 一样穿戴档案中的护目镜（8）、头饰（11）、手持物品（16）、光环（26）和飞行宠物（52），饰品挂在角色对应骨骼插槽上随人物移动；访客按其公开外观同样穿戴。普通宠物（类别 21）目前整个工程都还没有加载器，小屋里暂不显示。
- 成就窗口 `src/ui/my-room-career.ts` 按 `dialog2_newCareer/newCareer@zz` 原版布局自绘：成就概要、各分类标签、`careerTemplate` 成就行、全部/未完成/可完成/完成筛选与点击完成；成就文字与图标读自 `etc_/career/newCareer@cn.xml` 和 `dialog2_newCareer/icon/`，进度与完成由数据服务判定。徽章窗口 `src/ui/my-room-emblems.ts` 用 `dialog/roomEmblem` 的 `mq_dialog@zz`（屋主，可设两个代表徽章）和 `otherEmblemDialog@zz`（访客），名称与图标来自 `etc_/emblem/`。访客查看成就与徽章受屋主“车库/徽章/图鉴/成就是否公开”密码保护。按主题累计行驶距离（类型 46）与带回放摄像机的累计距离（类型 50）按原版 `careerInfoFormat_Distance` 显示为公里（一位小数）。
- 道具图鉴窗口 `src/ui/my-room-dictionary.ts` 按 `dialog/itemDictionary/itemDictionary@zz` 自绘：主页四张分组卡（车辆/角色/装备道具/装饰道具）各三个收藏环形进度（`Graduation` 按收藏比例顺时针填充、`CharPanel` 百分比数字、满 100% 显示 `MaskOver`）和环内第一件已收藏道具；点卡片或页签进入列表页（`itemTabGroup`）：一级页签、二级页签（`collect_btn_2depthMenu<组><序>_`）、车辆的引擎等级栏（左右箭头与下拉，`engineGrade0..13`）、名称搜索框和 9 列 `itemDictionaryCard` 网格（每屏 4 行，可滚动，未收藏的盖 `collect_img_slotCover`，悬停显示名称）。道具图片复用商城的车库快照渲染器（`createItemPictures`，125×125），宠物等没有车库卡片的道具显示名称；名称与竞速/道具车辆分类取自商城目录。屋主的“领取奖励”打开 `dialog/itemDictionaryReward/itemDictionaryReward@zz`（`dialog/koin/img_koinBox` 图标），领取后提示 `getRewardSuccess` 并刷新钱包；访客“浏览图鉴”同样受“车库/徽章/图鉴/成就是否公开”密码保护，不显示领取按钮。图鉴列表、解禁时间与奖励由数据服务给出。
- 赛车探险队窗口 `src/ui/my-room-expedition.ts` 按 `dialog/racingExpeditionDialog/mq_dialog@zz` 自绘（通用的 `src/ui/bml-canvas.ts` 负责布局、monocoque 边框、贴图、字符串与按钮状态）：左侧本周任务列表（`missionButton@zz` 卡片：赛道缩略图 `xt_trackCard` 与名称、属性标签 `tag_theme_N`、状态 未开始/进行中/无法进行/探险完成、时长或剩余时间、进度条、更换任务、经验/金币/奖励箱，最后一张为“添加任务”卡片）；右侧所选任务的编队（三组角色＋卡丁车与探险队好友，`racingExpeditionSelectCrewDialog` 的选择窗口，显示各自属性与加成，属性不匹配用 `slotItem_noReward_` 底图）、合计“时间-x% 奖励+y%”、自动填充/全部解除与出发；进行中显示进度、剩余时间、缩短时间/立即完成；完成后显示奖励并领取；`mqUseRacingTokendialog@zz` 用于缩短时间、立即完成、更换与添加任务。加成预览与服务器规则一致（`src/myroom/expedition-api.ts`），以服务器结果为准。
- 我的物品（GarageDialog）增加原版 `atMyRoom@cn` 的“精品道具”页签，列出箱子、探险币等可叠加道具（`stuff.rho` 图标与数量，`src/account/stuff-items.ts`）；点箱子用 `dialog/gachaDialog/mqHukubukuro@zz` 弹出“确定开启吗？”，开启后显示“恭喜你！获得了 …道具”（`src/ui/box-dialogs.ts`、`src/timeattack/garage-stuff.ts`），新道具立刻出现在对应页签。
- 小屋“我的物品”打开与 Ready 相同的原版 GarageDialog（`generated/ui.js` 的 `C7`）；确认后经 `selectReadyGarage` 重载 Ready，再重新打开小屋以更新停车位赛车和人物。
- `src/ui/item-inventory.ts`、`item-inventory-view.ts` 是早先的网页版仓库界面，小屋已不再使用；其分类映射与加成卡等装备路径保留供后续迁移。它们把原版仓库分类和卡片状态映射到当前资源目录。目录合并 ItemTable 物品身份、商城中文名与实际模型/贴图；缺中文名但资源有效的物品使用内部名。按照本工程的玩法要求，有档案装备槽的有效资源物品全部开放装备，无需账号持有清单。锁定赛车仍可装备。加成卡（类别 32）、道具皮肤卡（58）和仪表盘卡（61）可装备并保存原版类别与编号；当前 Web 版尚未计算加成或呈现后两类比赛效果。部分其他装备类别也只保存到档案，比赛场景尚无对应外观。
- `src/timeattack/ready-inventory.ts` 沿用 Ready 的装备与档案保存路径；本地小屋环境、星标和锁定状态随同档案保存。

原版抽奖、消耗品及服务器账号权限没有可直接复用的本地运行逻辑；访客、聊天、成就、徽章、道具图鉴、赛车探险队与开箱由本项目的数据服务实现（见 `server-go/README.md`“小屋”各节）。小屋名称和留言是 Web 版的本地设置，不声称来自原版管理协议。
