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
- `src/ui/item-inventory.ts`、`item-inventory-view.ts` 把原版仓库分类和卡片状态映射到当前资源目录。目录合并 ItemTable 物品身份、商城中文名与实际模型/贴图；缺中文名但资源有效的物品使用内部名。按照本工程的玩法要求，有档案装备槽的有效资源物品全部开放装备，无需账号持有清单。锁定赛车仍可装备。加成卡（类别 32）、道具皮肤卡（58）和仪表盘卡（61）可装备并保存原版类别与编号；当前 Web 版尚未计算加成或呈现后两类比赛效果。部分其他装备类别也只保存到档案，比赛场景尚无对应外观。
- `src/timeattack/ready-inventory.ts` 沿用 Ready 的装备与档案保存路径；本地小屋环境、星标和锁定状态随同档案保存。

原版访客、聊天、抽奖、消耗品、展示车及服务器账号权限没有可直接复用的本地运行逻辑；当前 Web 版只实现可由这些资源和既有 Ready 装备系统验证的路径。小屋名称和留言是 Web 版的本地设置，不声称来自原版管理协议。
