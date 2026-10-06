# 比赛界面控制相关素材

此目录包含从 APK 内 4 个 Unity UI 图集拆出的 15 张透明 PNG。`preview.png` 是预览图，`index.csv` 记录每张图的原始 Sprite 名称、所属图集、裁剪坐标与判断依据。可用 `apk_analysis/.venv/bin/python apk_analysis/export_ui_atlas.py` 重导。

| 文件 | 判断 | 来源 |
|---|---|---|
| `brake.png` | 刹车踏板图标 | 比赛图集 `maingame_2` |
| `n2o.png`、`n2o_flame.png` | 红色 N2O 道具图标及火焰变体 | 比赛图集 `maingame_2` |
| `team_n2o.png`、`team_n2o_flame.png` | 蓝色团队 N2O 图标及火焰变体 | 比赛图集 `maingame_2` |
| `small_boost_icon.png`、`small_boost_background.png` | 小喷图标与圆形底图，可作为两层素材使用 | 比赛图集 `maingameatlas`、`maingame_2` |
| `action_button_pressed.png` | 主动作键按下态底图；`D` 按名称推断为按下态 | 比赛图集 `maingameatlas` |
| `action_button_highlight.png` | 主动作键高亮层 | 比赛图集 `maingameatlas` |
| `settings_button.png` | 比赛设置按钮 | 比赛图集 `maingame_2` |
| `boost_prompt.png` | “喷”字提示，属于提示素材 | 比赛图集 `maingame_2` |
| `direction.png`、`drift.png`、`direction_arrow.png` | 方向、漂移的操作示意图；**未证实是赛中实际按钮** | 设置图集 `newsettingatlas` |
| `n2o_label.png` | N2O 字样；属于状态文字 | 控制模式图集 `controlmodes_01` |

裁剪方向已核对：UIAtlas 中的坐标与 UnityPy 输出 PNG 均以左上角为原点；刹车、N2O 图标和方向示意图与原始图集对应。

APK 资源索引将 `controlmodes_02`、`ui/maingame/maingamesubui/controlmodes_01` 和 `btnn2oroot` 标记为包内缺失。道具子界面 `ui/maingame/maingamesubui/item` 的包在 APK 内，但当前 FBAU 解码器无法解析。因此这里没有确认道具使用键的完整外观，也无法仅凭这些 PNG 复原赛中按钮布局。
