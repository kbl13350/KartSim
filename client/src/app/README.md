# 应用入口与生命周期

`src/generated/app.js` 仍保留发行版的 `Bf0` 应用类。生成器将下列已验证的业务方法接到本目录的手写 TypeScript；精确方法列表以 `src/generated/manifest.json` 为准。

| 文件 | 职责 |
| --- | --- |
| `application-controls.ts` | 全局按键、暂停、重开、运行失败处理和画布尺寸 |
| `application-disposal.ts` | 应用退出时按所有权顺序释放赛道、音频、渲染器与 DOM 监听 |
| `ghost-menu.ts` | Ghost 菜单的赛道/速度选择、记录键、采样模式和昵称重置 |
| `startup-resources.ts` | 资源来源选择、版本加载与代际取消、首次车手注册、音频和 Ready 阶段准备 |
| `runtime-hosts.ts` | 比赛构建器和驾驶输入流水线的运行依赖接口与懒加载实例 |
| `host-bridges.ts` | Ready 控制器和逐帧呈现器的状态接口与懒加载实例 |
| `race-services.ts` | Ghost 记录服务的懒加载、Boost 状态与动画槽同步 |
| `track-diagnostics.ts` | 开发诊断中的赛道所有者、对象和资源来源适配 |
| `shell-state.ts` | 应用会话、音频、记录、资源库和当前赛道状态的懒 getter |
| `shell-routing.ts` | 应用到 Ready、呈现器、驾驶输入、记录、HUD 和相机的显式转发 |
| `race-navigation.ts` | 从 Ready 开赛与返回 Ready |
| `frame-loop.ts`、`stage-manager.ts` | 帧调度和阶段切换 |
| `race-cleanup.ts`、`race-configuration.ts` | 比赛资源清理和配置 |

相邻测试从固定哈希的发行版提取对应方法，比较状态、调用顺序和异常路径。启动流程的差分测试覆盖在线/本地来源、代际取消、错误回滚和注册结果。`Bf0` 的方法与访问器均已接到本目录；构造器及 56 个类字段初始化声明仍位于生成模块，其中包括可变状态默认值和引擎对象工厂。修改这些范围前应先定位原调用方，并在生成器中添加替代接线。
