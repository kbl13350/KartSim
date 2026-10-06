# 赛道世界层

生成器从 `_L` 赛道类移除了全部 36 个原方法，模块加载时调用 `installWorldOverrides()` 安装 `install.ts` 中的可读 TypeScript 实现。`_L` 保留字段与委托给 `initializeTrackWorld()` 的构造函数；运行方法覆盖路线状态、门穿越、warp/rail 落点、事件和障碍物快照、碰撞表面选择、场景控制器调度与资源释放。

| 文件 | 职责 |
| --- | --- |
| `route.ts` | 客户端坐标、float32 路线几何、RouteSection 投影和前瞻采样。 |
| `gates.ts` | 检查门的三角形线段交叉及正反方向判定。 |
| `route-state.ts` | 路线状态、重置、离轨重新关联、门穿越、warp/rail 落点、rail 配置和 surface tag。 |
| `route-tag.ts` | 原版路线表面标签分类，以及进入/退出方向后缀的解析。 |
| `event-queue.ts` | 事件动画、最多八个碰撞候选、过期效果与帧快照提交。 |
| `collision-routing.ts` | 静态路、移动路和障碍物射线命中优先级，OBB 查询合并。 |
| `static-track-surface.ts` | 原版 4 单位栅格索引、静态路射线及 p3553/旧版 OBB 查询。 |
| `moving-track-surface.ts` | 随场景矩阵更新的路面顶点、法线和表面速度。 |
| `render-lifecycle.ts` | 场景、天空和镜头光晕的逐帧更新与重置顺序。 |
| `obstacle-lifecycle.ts`、`obstacle-surface.ts` | 障碍物配对、逐帧三角形快照、射线和 OBB 查询。 |
| `dispose.ts` | 场景控制器、网格、共享材质与纹理的释放顺序。 |
| `create-track-world.ts` | 可注入原版碰撞表面与 renderer 的可读赛道构造工厂；生成的 `_L` 构造函数调用 `initializeTrackWorld()`。 |

`world.test.mjs` 从本地 p3553 镜像中的两条 `track.1s` 读取真实 RouteSection 图，比较原 `_L` 与手写实现的投影、采样、正反门穿越和离轨重新关联；用真实 frame 模拟 warp/rail 落点与障碍物三角形。另比较事件快照、碰撞优先级、渲染调度和释放顺序。`static-track-surface.test.mjs`、`moving-track-surface.test.mjs` 和 `obstacle-surface.test.mjs` 从发行版源码抽取原表面类，以真实 p3553 三角形比较网格索引、射线、OBB 和移动矩阵行为。直接运行：

```sh
cd rewrite
./node_modules/.bin/tsx --test src/world/*.test.mjs
```

仍由生成代码提供 `.1s` 解析与路线图构建、场景对象/纹理导入。生成器已将 `_L` 构造函数替换为 `initializeTrackWorld()`，单人和多人创建赛道时都通过可读构造流程。构造器现在使用手写的静态路、移动路和障碍物表面；障碍物逐帧快照也使用同一手写表面。现有导入器只接纳可识别的原版 road/runtime descriptor，未闭合的赛道会按原规则拒绝加载。
