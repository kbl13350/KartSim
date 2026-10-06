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

生成器已接入表中标为“已接入”的类和函数，精确符号见 `src/generated/manifest.json`。`y10` 和 `H10` 无额外运行时依赖，由导入别名替代原类。`v10` 注入 XML 解析 `s2` 和属性读取 `T`；`A10` 调用 `loadTrackCoinSource(archive, track, bytes => v10(bytes))`。`jw` 使用 `CoinOwnerOps` 注入原模块的场景对象、`nl` 唯一资源、模型与音效解码、模型加载、`y10` 接触对象和音频路由。

`_r` 通过 `CharacterMotionOps` 注入原模块的动作与模型函数；`ag`、`sk`、`ok` 注入对应的映射和选择函数；`b10`、`bS`、`rk` 注入 `_r` 构造器与动作映射。`tv` 使用 `ChargerEffectOps` 注入特效资源和模型操作，`d7` 使用 `CoatingOwnerOps` 注入纹理管理器与车膜投影加载。底层采样、模型和特效函数仍在生成模块。

差分测试使用覆盖代表分支的虚拟动作、场景和资源数据；真实角色模型的长时间动画、金币场景效果与悬挂饰品视觉效果尚待浏览器确认。
