# 单人计时赛

这些 TypeScript 模块承接了发行版计时赛的主要状态流程。生成器把相应方法接入 `src/generated/timeattack.js` 的类壳；类字段、部分资源加载和画面实现仍沿用兼容代码。准确替换清单见 `src/generated/manifest.json`。

| 阶段 | 入口文件 | 职责 |
| --- | --- | --- |
| Ready | `ready-flow.ts`、`ready-controller-state.ts`、`ready-garage.ts`、`ready-settings.ts`、`ready-multiplayer.ts` | 选图、选车、设置、联机入口及开赛请求 |
| 发布比赛 | `race-publication.ts`、`start-grid.ts` | 载入后的赛道与赛车资源移交、起跑排位 |
| 比赛循环 | `stage-lifecycle.ts`、`stage-update.ts`、`driving-loop.ts` | 倒计时、驾驶逐帧、圈数、完赛和返回 Ready |
| 重置与呈现 | `automatic-reset.ts`、`checkpoint-reset.ts`、`race-reset.ts`、`stage-render.ts`、`race-hud.ts`、`action-dispatch.ts` | 低速或离轨重置、检查点、HUD、场景和操作派发 |
| Ghost | `ghost-capture.ts`、`record-service.ts` | 帧采集、完赛记录提交、装备快照和重放载荷 |

`record-service.ts` 接管发行版 `Nh0` 的 `restore`、`promote`、`captureReplay`、`rawRecording` 与 `currentEquipment`。相邻差分测试覆盖记录发布、空录制、错误路径和装备数据。其他测试在 `tests/` 和相邻目录中；运行 `npm run verify` 会同时进行生成、类型检查、测试和构建。
