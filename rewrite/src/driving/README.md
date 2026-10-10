# 车辆连续物理重写范围

`AL` 是发行版的车辆物理状态机，原始声明位于 `recovered/formatted/index.js:80518–83677`，包含 173 个方法和 24 个字段声明。173 个方法体已逐段迁移为可读 TypeScript，保留发行版方法的调用顺序与 `Math.fround` 边界。

## 已迁移

| AL 方法 | 手写实现 | 运行时状态 | 差分证据 |
| --- | --- | --- | --- |
| `update` | `frame-update.ts` → `advanceVehicleFrame` | 已覆盖生成类 | 活跃、完全绕过、巨型冻结三种帧路径 |
| `stepSubstep` | `frame-pipeline.ts` → `advancePhysicsSubstep` | 已覆盖生成类 | 10 个接触、悬空、轨道、漂移、LTE、碰撞分支及非法时间片 |
| `applyLongitudinal` | `continuous-motion.ts` → `applyLongitudinalForce` | 已覆盖生成类 | 11 个驱动、增压、漂移、倒车及制动分支 |
| `applyDrag` | `continuous-motion.ts` → `applyVelocityDrag` | 已覆盖生成类 | 地面、空中、轨道及 DF 路面 |
| `integrateVelocity` | `continuous-motion.ts` → `integrateVehicleVelocity` | 已覆盖生成类 | 线速度和角速度，含非数值输入 |
| `applySuspension` | `surface-forces.ts` → `applySuspensionForce` | 已覆盖生成类 | 四轮弹簧、阻尼、倾斜法线及缺失系数 |
| `applyAirState` | `surface-forces.ts` → `applyAirborneForces` | 已覆盖生成类 | 重力、角阻尼与翻转恢复 |
| `accumulateDriftGauge` | `drift-gauge.ts` → `accumulateDriftCharge` | 已覆盖生成类 | 前、中、后漂移窗口及充能、轨道、禁用分支 |
| `commitDriftGauge` | `drift-gauge.ts` → `commitDriftCharge` | 已覆盖生成类 | 累积上限与队伍充能调用 |
| `updateDriftLifecycleTimers` | `drift-gauge.ts` → `updateDriftWindows` | 已覆盖生成类 | 两个漂移计时器及物理状态到期 |
| `applyCollisionDriftGaugePreserve` | `drift-gauge.ts` → `preserveDriftChargeAfterCollision` | 已覆盖生成类 | 撞击保留率与充能覆盖 |
| `resolvePrimaryCollision` | `track-collision.ts` → `resolveVehicleTrackCollision` | 已覆盖生成类 | 高位、侧墙、转向反冲与多接触 |
| `resolveStaticObstacles` | `track-collision.ts` → `resolveVehicleObstacleCollisions` | 已覆盖生成类 | 移动障碍、硬停及双向挤压 |
| `applyHighObstacleAngularResponse` | `track-collision.ts` → `applyHighContactAngularResponse` | 已覆盖生成类 | 高位碰撞倾斜角速度 |
| `applyWallObstacleAngularResponse` | `track-collision.ts` → `applyWallContactAngularResponse` | 已覆盖生成类 | 侧墙偏航冲量与上限 |
| `applySteeringAndTires` | `steering-tires.ts` → `applySteeringTireForces` | 已覆盖生成类 | 19 个低速、泥地、滑地、漂移触发与摩托车分支 |
| `applyRoadConsumers` | `road-consumers.ts` → `applyRoadSurfaceConsumers` | 已覆盖生成类 | BH/MZ/BS/JM/DJ 路面命令 |
| `probeWheels` | `wheel-probe.ts` → `probeVehicleWheels` | 已覆盖生成类 | 四轮射线、悬挂压缩、轨道、障碍及首次接地 |
| `applySupplementalWheelRecovery` | `wheel-recovery.ts` → `recoverUnconfirmedWheelContacts` | 已覆盖生成类 | 缺失接地角射线与垂直速度恢复 |
| `applySlipAlignment` | `slip-alignment.ts` → `applySlipSurfaceAlignment` | 已覆盖生成类 | 倾斜路面、零速度、非滑移与一次性标记 |
| `setRoadActionState`、`updateStateTimer`、`updateStateTimerMilliseconds`、`accumulateSpeedGauge` | `motion-state.ts` | 已覆盖生成类 | 路面状态保护、毫秒计时和轨道速度充能 |
| `rebuildBodyState`、`applyBoosterChargeSurface`、`updateTachometerIncGauge`、`applyJumpSurfaceTuning`、`applyResetSurfaceRequest` | `contact-preparation.ts` | 已覆盖生成类 | 速度投影、特殊路面及充能资格 |
| `updatePrimaryAutomaticResetTimers`、`updateObstacleAutomaticResetTimer`、`advanceAutomaticResetTimer`、`activateDirectionalPress`、`activateHardPress` | `automatic-reset.ts` | 已覆盖生成类 | 连续碰撞复位阈值和压扁状态副作用 |
| `scanSpecialRoad`、`scanSpecialRoadPrefix` | `special-road.ts` | 已覆盖生成类 | MR/HW 射线、四档采样密度、路面朝向和重力 |
| `enterRailMode`、`requestMotionMode`、`returnToStandard` | `rail-transitions.ts` | 已覆盖生成类 | 入轨超时、离轨上抬、路面回归与路线重关联 |
| `captureRail` | `rail-capture.ts` | 已覆盖生成类 | rail ID、route 采样、距离、延时和配置完整门控 |
| `produceRailFrame`、`applyFull3DRail` | `rail-frame.ts`、`rail-dynamics.ts` | 已覆盖生成类 | 路由投影、轨道推进、增压、入轨侧滑及失效 frame |
| `integrateFull3D`、`integrateStandardOrientation` | `orientation-integration.ts`、`orientation-math.ts` | 已覆盖生成类 | 四元数/矩阵等价、轨道与地面姿态积分、翻车阻尼 |
| `countOrdinaryResultCrash`、`resolveTrackEvents`、`secondaryCollisionBox`、`updateCollisionGaugeOwners` | `collision-events.ts` | 已覆盖生成类 | 结果碰撞节流、赛道事件、碰撞箱及充能门控 |
| `updatePublicGauge`、`mainGaugeRatio`、`updateInstantAccelerationGauge`、`updateInstantWallCharge`、`beginInstantWallCharge`、`updateResetGaugeRefill`、`beginWallCollision`、`settleWallCollision`、`setWallGaugeRefill`、`clearResetGaugeRefill`、`updateCachedDisplaySpeed`、`syncPresentationFields` | `collision-gauges.ts` | 已覆盖生成类 | 速度、撞墙窗口、复位返还、UI 状态副本及浮点精度 |
| `startNormalBooster`、`activateChargerIfReady`、`chargerDurationMs`、`updateChargerExpiry`、`updateDualBooster`、`armDualBooster`、`refreshDualBoosterReady`、`classifyDualBoosterReady`、`clearDualBoosterReady` | `booster-state.ts` | 已覆盖生成类 | 槽位消耗、充能器计数及到期、双重增压窗口与自动准备 |
| `updateObstacleSuppressionTimer`、`visualScaleMode`、`setVisualScaleMode`、`updateVisualScale`、`updateModeScale`、`updateEventScale`、`updateEventGravity` | `visual-scale.ts` | 已覆盖生成类 | 压扁冷却、巨型模式委托、视觉恢复、赛道事件比例和重力过期 |
| `accumulateTeamGauge`、`consumeMultiplayerTeamCharge`、`enqueueMultiplayerTeamTarget`、`updateTeamGauge`、`consumeTeamGaugeFullAnimation`、`timeAttackTeamGaugeSettledAtMs`、`convertTeamBoosterSlots`、`updateTeamSlotWindow`、`timeAttackSpeedSlotDisabled`、`timeAttackSpeedSlotWindowStartMs` | `team-gauge.ts` | 已覆盖生成类 | 队伍充能、队列刷新、满槽转换及赛道槽位窗口 |
| 构造器、`createBody`、`createWheelRuntime`、`createRuntime`、`createState` | `construct-vehicle.ts`、`initial-state.ts` | 已覆盖生成类 | 玩法参数校验、动态碰撞形状、四套初始状态与 TypedArray 属性槽 |
| 55 个驾驶命令、音效/动画消费、网络状态接口与巨型模式方法 | `vehicle-commands.ts` | 已覆盖生成类 | 驾驶输入、路面标签、槽位更新、单次事件、比例设置及外部接口 |
| 17 个计时赛仪表和速度槽接口 | `tachometer.ts` | 已覆盖生成类 | 浮点阈值、槽位交换冷却、UI 快照与单次事件清零 |
| `driveCameraRuntime`、`driftVisualRuntime` | `presentation-view.ts` | 已覆盖生成类 | 可变视图复用、速度方向、路面属性和运动坐标 |
| `reset`、`resetFromRouteFrame`、`beginResetInitiation`、`prepareLowHeightResetPose`、`completeCheckpointPose`、`warpPosition`、`settle` | `reset-runtime.ts` | 已覆盖生成类 | 复位、赛道路点朝向、位置传送、充能返还和中立物理步 |
| `getDebugState` | `debug-state.ts` | 已覆盖生成类 | 运行时字段、赛道帧与比例向量的独立快照 |

所有 173 个方法（含构造器和两个 getter）均由 `tools/generate-modules.mjs` 映射到手写模块，并注入 `src/generated/driving.js`。生成类仍保留 24 个字段声明以及尚未迁移的底层几何、碰撞、时钟和资源辅助函数，因此整类的生成代码尚不能删除。

## 验证

- `npx tsx --test src/driving/*.test.ts`：车辆目录发行版差分测试 97/97 通过。测试提取固定哈希发行版的方法体，比较结果、状态、副作用及关键引用语义。
- `npm run generate`、`npm run typecheck`、`npm test`（298/298）、`npm run build`：173 个方法全部接入后通过。
- 已在早期 60 个覆盖点的构建中浏览器实测进入城镇高速公路计时赛，车辆受加速/左转输入移动，页面来源控制台无错误。173 个方法版本的浏览器赛道回归由主任务继续执行。

## 剩余边界

可读方法实现不代表整套车辆物理依赖已移出生成模块。原类的 24 个字段初始化仍由生成代码完成；`$40` 帧时钟、`ni0` 物理临时缓存及部分几何/碰撞辅助仍是发行版声明。构造器方法体调用手写初始化函数，但字段初始化按 JavaScript 原类顺序保留。对这些依赖做类级整体替换前，需要逐项迁移并验证。

## 道具赛（item）扩展

`drivingMode.kind === "item"` 时构造器把 `AL` 标记为道具赛车辆（`itemMode`），并挂上受害效果 owner（`itemEffects`）。这些成员由 `tools/generate-modules.mjs` 中标记 `item-mode(driving)` 的补丁追加到生成类，行为全部在手写模块里：

| 模块 | 内容 |
| --- | --- |
| `item-mode.ts` | 道具槽沿用 `runtime.speedSlots`，容量取 `itemSlotCapacity`（2 或 3），保存任意道具编号（-1 为空）；`setItemSlots`/`itemSlots`/`itemSlotCapacity`；`startItemBooster(kind = "item", { durationMs }?)` 以物理状态 3 持续 `itemBoosterTime`（加速器）/`animalBoosterTime`（特殊加速器 31）/`superBoosterTime`（超级盾牌 18），或 `durationMs`（警灯）；服务器拒绝该次使用时 `cancelItemBooster` 结束物理状态 3 并撤回加速计数 |
| `item-effects.ts` | 打转、困住、炸飞、反向、减速、缩小、挡停、磁铁牵引、弹回（knockback）、定住（hold）十种效果；每个物理切片推进一次，困住/炸飞/挡停/定住时以运动学路径代替物理子步，位姿变化随运动帧同步给远端 |
| `physics-parameters.ts` | 发行版 `jt0` 的调参记录，末尾追加道具赛字段（道具槽容量、道具/特殊/超级加速时间、道具起步与加速系数、脱出瞬间加速开关） |

道具赛中漂移照常、漂移结束后的瞬间加速（状态 2）照常，但漂移和速度不再充能加速器（`accumulateDriftCharge`、`accumulateSpeedCharge`、`updateModeInventory`、组队集气均关闭）；起步加速使用 `startBoosterTimeItem` 与 `startForwardAccelItem`；加速状态的加速系数使用 `boostAccelFactorOnlyItem`，地面（`applyLongitudinalForce`）与全 3D 轨道（`applyVehicleRailDynamics`）相同。道具赛没有双重加速：`refreshDualBoosterReady` 在道具赛中与未开启双重加速的引擎一样直接返回，加速道具不会自动进入状态 10。`use-item-or-booster`/`reorder-items` 在道具赛不再消耗或交换槽位，按键由 `src/input/item-input.ts` 转为道具指令。

道具效果压制自动复位期间（打转或困住/炸飞/挡停），撞墙与障碍计时器的复位请求被丢弃（卡住时每个切片都会重新请求），低速计时器清零；定向挤压（`activateDirectionalPress`）只请求一次复位，因此同时记入 `itemEffects.requestCrushReset()`，由多人本机 owner 在压制结束后执行，`clear`/`resetState` 时清除。

第三阶段（ITEM_MODE.md 附录 C）：

- 反向分三种：`apply("reverse", ms, { mode })`，`"steering"`（大魔王，默认）、`"forwardBack"`（恶魔阿哥 38）、`"all"`（R博士 23）。`steeringInverted`/`forwardBackSwapped`/`reverseMode` 由多人会话每帧写进 `DrivingInputAccumulator`（`setSteeringInverted`/`setForwardReverseSwap`，累加器保持与发行版一致）；会话再用 `itemReverseDrivingEffect`（`src/input/item-input.ts`）改写上报的指令：前后颠倒时后退键是 `forward-down/up`，左右颠倒时漂移方向跟随实际转向。
- 反向、减速、缩小可带 `source`（例如道具编号）：每个来源有自己的结束时间，`end(kind, source)` 只去掉该来源（电磁波只解除飞碟的减速，没有飞碟减速时返回 false、什么都不发生）；`hasSource(kind, source)` 查询。
- `knockback`（弹性陷阱 25，`Affect` 500）：水平速度改为车头反方向（入口前向速度的一半，8–25 m/s，或 `speed`），期间关闭驱动与轮胎、保留碰撞，速度按指数衰减。
- `hold`（符咒 137 `Affect` 4000、电磁导弹 `AffectMain` 2000、龙卷风 `StateAffect` 2000）：像挡停一样停在原地但按时长，不能用道具；两次 hold 取较晚的结束；不会把空中的炸飞拉回地面；水泡可以替换它。`directionPress`/`consumeDirectionPresses` 记录定住期间的方向键（符咒 QTE），`escapeHold(delayMs)` 提前结束（`EscapeAffect` 500 期间仍定住）并报告 `escaped`；`escapeImmunityMs` 可在结束后给蓝盾式免疫（默认 0）。
- `trap` 选项 `quick`（waterAngel 快速逃脱）：水泡只持续 500 ms；`afterBoost`（默认 true）：车辆 `useExtendedAfterBooster` 或 `useExtendedAfterBoosterMore` 时水泡结束（到时或挣脱）后 1000 ms 内按 ↑（`forward-down`）进入物理状态 2，时长 `driftBoostTick`（缺省 0.5 s），系数 `boostAccelFactorOnlyItem × driftBoostMulAccelFactor`，与漂移后瞬间加速同一路径；新的命中、清除或复位关闭窗口。
- `boostAccelFactorOnlyItem` 在道具赛装配时由车辆自己的 `param@cn.xml`（或 `param.xml`）的 `BoosterAccelFactorItem` 覆盖（`src/physics/item-race-tuning.ts`，生成的 A40 中标记 `item-mode(p3p)`），飞行宠物调校组 204 给 `itemBoosterTime` +250；竞速与计时赛的参数对象不变。

`item-effects.test.ts`、`item-mode.test.ts` 用真实 `AL` 在平面测试路面（`item-test-fixtures.ts`）上验证每种效果的时间线；`physics-parameters.test.ts` 对全部可查询车辆逐字段比较发行版 `jt0`。原有发行版差分测试保持不变，非道具赛路径没有行为变化。
