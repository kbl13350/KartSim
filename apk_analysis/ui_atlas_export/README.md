# 比赛图集完整拆图

此目录包含 `maingame_2` 的 166 个 Sprite 和 `maingameatlas` 的 75 个 Sprite，共 241 张透明 PNG。`index.csv` 记录原始名称、图集及裁剪坐标。两张图集位于 APK 中，可运行以下命令重新导出：

```sh
apk_analysis/.venv/bin/python apk_analysis/export_ui_atlas.py --all \
  --atlas assets/uires/uiatlas/maingame/maingame_2.prefab \
  --atlas assets/uires/uiatlas/maingame/maingameatlas.prefab \
  --output apk_analysis/ui_atlas_export
```

`race_controls/` 另外筛选并标注了与比赛操作相关的 15 张素材。
