# 车辆表现与道具业务类

本目录从发行版 `recovered/formatted/index.js` 的车辆模块迁移类状态机。运行 `npx tsx --test src/vehicle/*.test.ts` 可直接比较发行版原类与手写实现；测试覆盖方法结果、状态、依赖调用顺序和对象字段顺序。

| 原类 | 可读实现 | 差分与接入状态 |
| --- | --- | --- |
| `y10` 赛道金币接触对象 | `TrackCoinContact`，`track-coin.ts` | 碰撞半径、待收集/已吃/移除、时间环绕和释放；已接入 |
| `v10`、`A10` 金币资源链 | `parseTrackCoinResources`、`loadTrackCoinSource`，`track-coin-source.ts` | XML 校验、赛道实例坐标和错误分支；已接入 |
| `nl` 金币资源原件选择 | `uniqueOriginalCoinAsset`，`track-coin-source.ts` | 原件唯一性；已接入 |
| `jw` 金币场景 owner | `TrackCoinOwner`，`track-coin-owner.ts` | 模型并发加载、接触对象绑定、动画/音效、重复绑定与部分失败清理；已接入 |
| `_r` 人物动作序列器 | `CharacterMotionSequencer`，`motion-sequencer.ts` | 24 通道混合、播放、回归动画、二次请求和重置；已接入 |
| `ag`、`sk`、`ok` 状态决策 | `StandardMotionController`、`LinkedMotionController`、`MappedMotionController`，`animation-selectors.ts` | 落地、碰撞、冷却、联动状态和状态映射；已接入 |
| `b10`、`bS`、`rk` 动作包装 | `ResultMotionController`、`SingleActionMotionController`、`ActionSetMotionController`，`animation-actions.ts` | 结果态、动作白名单、等待回归与重置；已接入 |
| `H10` 悬挂饰品运动 | `TetherMotion`，`tether-motion.ts` | 帧时钟、跳帧过滤、绳长约束、阻尼和坐标回投；已接入 |
| `tv` 充能动画 | `ChargerEffect`，`charger-effect.ts` | 特效原件唯一性、启停切换、时间戳转换与资源释放；已接入 |
| `d7` 车膜 owner | `CoatingOwner`，`coating-owner.ts` | 装配选项、共用/独占纹理管理器、时间推进和失败清理；已接入 |
| `sL` 雨天屏幕粒子 | `RainScreenEffect`，`rain-screen-effect.ts` | 200 个雨滴的生成、投影、淡入、画布顶点与清理；发行版差分通过，已接入 |
| `A7` 雪天屏幕粒子 | `SnowScreenEffect`，`snow-screen-effect.ts` | 雪花运动、纹理 SHA-256 与尺寸校验、绘制和清理；发行版差分及真实 `theme_ice.rho` 资源加载通过，已接入 |
| `y7` 雨声过渡 | `RainAudioCue`，`rain-audio-cue.ts` | 唯一音效资源、重播、过期回调和释放；发行版差分通过，已接入 |
| `Qk` warpnext 状态机 | `WarpNextController`，`warp-next-controller.ts` | 普通/精灵传送、镜头冻结、黑边淡入淡出与驾驶锁定；发行版差分通过，已接入 |
| `EC`、`Kn0` 赛道事件状态与 owner | `EventCollisionLatch`、`TrackEventOwner`，`event-collision-latch.ts`、`track-event-owner.ts` | 首次碰撞、重臂计时、效果冷却、动画节流与复位；发行版差分通过，已接入 |
| `qn0` 移动赛道事件几何 | `MovingTrackEvent`，`moving-track-event.ts`、`event-geometry.ts` | 模型顶点、三角形变换、float32 法线和速度、定向碰撞盒相交；发行版差分与 300 组姿态通过，已接入 |
| `c30`、`w7` 镜头光斑 | `lensFlareAnchor`、`LensFlareEffect`，`lens-flare.ts` | 锚点唯一性、DataPack1 资源、屏幕投影、10 个画布四边形与释放；发行版差分通过，已接入 |
| `ul` 全部资源装配方法 | `loadRaceCharacters`、`loadCharacterAsset`、`loadVehicleRuntime`、`loadVehicleAsset`、`loadTrackMap`，见对应 `load-*.ts` | 角色身份、车辆与赛道总装配、仪表/音效/特效、天气/事件/轨道、失败清理；发行版差分通过，已接入 |
| `pv` 车辆音效 | `KartAudioRuntime`、`loadKartAudio`，`kart-audio-runtime.ts` | 引擎转速、碰撞/增压/漂移/路面音、资源回退和释放；发行版差分通过，已接入 |
| `mv`、`wv` 滑流视听 | `SlipstreamVisual`、`SlipstreamAudio`，`slipstream-effects.ts` | 模型来源、启停、爆发动画、音频循环/结束回调和释放；发行版差分通过，已接入 |
| `iL`、`rL` 多人起跑位 | `validateRaceStartGrid`、`raceStartPosition`，`race-start-slots.ts` | 0 至 7 号位唯一性、双列间距、路面投影及 float32 坐标；发行版差分通过，已接入 |
| `vL`、`U40`、`yL` 比赛正常对象调度 | `LapTiming`、`NormalObjectCoordinator`、`NormalRaceCoordinator`，`normal-coordinator.ts`、`normal-race-coordinator.ts` | 圈速、赛道/车辆/障碍/事件/远端对象更新顺序、配对、路线标签与复位；发行版差分通过，已接入 |
| `$40`、`DC` 车辆帧时钟 | `VehicleFrameClock`、`normalizeVehicleTime`，`frame-clock.ts` | 最大 500 ms 帧、2 ms 子步、节奏检查、时间同步和 uint32 回绕；发行版差分通过，已接入 |

生成器已接入表中标为“已接入”的类和函数，精确符号见 `src/generated/manifest.json`。`y10` 和 `H10` 无额外运行时依赖，由导入别名替代原类。`v10` 注入 XML 解析 `s2` 和属性读取 `T`；`A10` 调用 `loadTrackCoinSource(archive, track, bytes => v10(bytes))`。`jw` 使用 `CoinOwnerOps` 注入原模块的场景对象、`nl` 唯一资源、模型与音效解码、模型加载、`y10` 接触对象和音频路由。

`_r` 通过 `CharacterMotionOps` 注入原模块的动作与模型函数；`ag`、`sk`、`ok` 注入对应的映射和选择函数；`b10`、`bS`、`rk` 注入 `_r` 构造器与动作映射。`tv` 使用 `ChargerEffectOps` 注入特效资源和模型操作，`d7` 使用 `CoatingOwnerOps` 注入纹理管理器与车膜投影加载。底层采样、模型和特效函数仍在生成模块。

差分测试使用覆盖代表分支的虚拟动作、场景和资源数据；真实角色模型的长时间动画、金币场景效果与悬挂饰品视觉效果尚待浏览器确认。
