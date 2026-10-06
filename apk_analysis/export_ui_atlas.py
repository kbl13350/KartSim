#!/usr/bin/env python3
"""Crop named NGUI UIAtlas sprites from the APK's Unity bundles.

Default: export identifiable race-control artwork to ``race_controls/``.
To dump a complete atlas, pass ``--atlas ASSET_PATH --all --output DIR``.
Requires the local .venv with UnityPy and the sibling decode_fbau.py script.
No APK code is executed.
"""

import argparse
import csv
import json
import re
import struct
import zipfile
from pathlib import Path

import UnityPy
from PIL import Image, ImageDraw, ImageFont

from decode_fbau import decode_fbau
from apk_source import apk_from_summary


BASE = Path(__file__).resolve().parent
CATALOG = BASE / "index" / "resource_catalog.csv"
APK_SUMMARY = BASE / "index" / "summary.json"
ATLAS_MAIN2 = "assets/uires/uiatlas/maingame/maingame_2.prefab"
ATLAS_MAIN = "assets/uires/uiatlas/maingame/maingameatlas.prefab"
ATLAS_SETTINGS = "assets/uires/uiatlas/setting/newsettingatlas.prefab"
ATLAS_MODES = "assets/uires/uiatlas/controlmodes_01/controlmodes_01.prefab"

# Source, sprite name, exported name, Chinese description, confidence, note.
RACE_SELECTION = [
    (ATLAS_MAIN2, "MainGame_shache", "brake.png", "刹车踏板", "高", "比赛图集；名称与图像一致"),
    (ATLAS_MAIN2, "MainGame_BtnFire_Icon", "n2o.png", "红色 N2O 氮气图标", "高", "比赛图集；图像带 N2O 字样"),
    (ATLAS_MAIN2, "MainGame_BtnFire_Icon02", "n2o_flame.png", "红色 N2O 火焰图标", "高", "比赛图集；图像带 N2O 字样；不将 02 推断为按下态"),
    (ATLAS_MAIN2, "MainGame_TeamFire_Icon", "team_n2o.png", "蓝色团队 N2O 图标", "高", "比赛图集；图像带 N2O 字样"),
    (ATLAS_MAIN2, "MainGame_TeamFire_Icon02", "team_n2o_flame.png", "蓝色团队 N2O 火焰图标", "高", "比赛图集；不将 02 推断为按下态"),
    (ATLAS_MAIN, "MainGame_button_xiaopen2", "small_boost_icon.png", "小喷图标", "高", "比赛图集；资源名含 xiaopen"),
    (ATLAS_MAIN2, "MainGame_xiaopenbg2", "small_boost_background.png", "小喷按钮圆形底图", "高", "比赛图集；底图需与图标叠加"),
    (ATLAS_MAIN, "MainGame_BtnFire_D", "action_button_pressed.png", "主动作键按下态底图", "中", "比赛图集；D 按资源命名推断为按下态"),
    (ATLAS_MAIN, "MainGame_BtnFire_Light", "action_button_highlight.png", "主动作键高亮层", "中", "比赛图集；名称与透明图层相符"),
    (ATLAS_MAIN2, "MainGame_Btn_Setting", "settings_button.png", "比赛设置按钮", "高", "比赛图集；齿轮图标"),
    (ATLAS_MAIN2, "MainGame_tishi_penX", "boost_prompt.png", "“喷”字提示", "高", "比赛图集；提示字样，并非操作按钮"),
    (ATLAS_SETTINGS, "Set_Icon_fangxiangi", "direction.png", "方向操作示意图", "高", "来自设置图集；未证实为赛中实际按钮"),
    (ATLAS_SETTINGS, "Set_Icon_piaoyi", "drift.png", "漂移操作示意图", "高", "来自设置图集；未证实为赛中实际按钮"),
    (ATLAS_SETTINGS, "SZ_kjxz_fangxiang", "direction_arrow.png", "方向箭头示意图", "高", "来自设置图集；未证实为赛中实际按钮"),
    (ATLAS_MODES, "jn_font_n2o", "n2o_label.png", "N2O 字样", "高", "来自控制模式图集；状态文字，并非操作按钮"),
]


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._") or "sprite"


def parse_atlas_data(raw: bytes, width: int, height: int) -> dict:
    # NGUI UIAtlas MonoBehaviour: 44-byte prefix, sprite count, then
    # string + 12 int32 fields (rectangle, borders and padding) per sprite.
    if len(raw) < 48:
        raise ValueError("UIAtlas MonoBehaviour is too short")
    count = struct.unpack_from("<i", raw, 44)[0]
    if not 0 < count < 10000:
        raise ValueError(f"Invalid sprite count: {count}")
    offset = 48
    sprites = {}
    for index in range(count):
        if offset + 4 > len(raw):
            raise ValueError(f"Truncated sprite name length at {index}")
        length = struct.unpack_from("<i", raw, offset)[0]
        offset += 4
        if not 0 < length < 200 or offset + length > len(raw):
            raise ValueError(f"Invalid sprite name length at {index}: {length}")
        name = raw[offset : offset + length].decode("utf-8")
        offset = (offset + length + 3) & ~3
        if offset + 48 > len(raw):
            raise ValueError(f"Truncated sprite geometry at {index}")
        values = struct.unpack_from("<12i", raw, offset)
        offset += 48
        x, y, w, h = values[:4]
        if not (0 <= x < width and 0 <= y < height and 0 < w <= width - x and 0 < h <= height - y):
            raise ValueError(f"Sprite {name!r} rectangle lies outside atlas")
        if name in sprites:
            raise ValueError(f"Duplicate sprite name: {name}")
        sprites[name] = values
    return sprites


def load_atlas(archive: zipfile.ZipFile, catalog: dict, asset_path: str):
    row = catalog[asset_path]
    if row["in_apk"] != "True":
        raise FileNotFoundError(f"Atlas bundle is absent from this APK: {asset_path}")
    env = UnityPy.load(decode_fbau(archive.read(row["apk_entry"])))
    textures = [obj.read() for obj in env.objects if obj.type.name == "Texture2D"]
    behaviours = [obj.get_raw_data() for obj in env.objects if obj.type.name == "MonoBehaviour"]
    if len(textures) != 1 or not behaviours:
        raise ValueError(f"Expected one atlas texture and a UIAtlas component; found {len(textures)} textures and {len(behaviours)} behaviours")
    texture = textures[0]
    image = texture.image
    if image.size != (texture.m_Width, texture.m_Height):
        raise ValueError("Decoded image dimensions do not match Unity metadata")
    sprites = parse_atlas_data(behaviours[0], image.width, image.height)
    return row["apk_entry"], texture.m_Name, image, sprites


def create_preview(export_rows: list, output: Path):
    font_path = Path("/System/Library/Fonts/Hiragino Sans GB.ttc")
    font = ImageFont.truetype(str(font_path), 17) if font_path.exists() else ImageFont.load_default()
    columns, cell_w, cell_h = 4, 230, 180
    height = ((len(export_rows) + columns - 1) // columns) * cell_h
    sheet = Image.new("RGB", (columns * cell_w, height), "#f0f0f0")
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(export_rows):
        left, top = (index % columns) * cell_w, (index // columns) * cell_h
        icon = Image.open(output / row["file"]).convert("RGBA")
        icon.thumbnail((cell_w - 24, 118), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", (cell_w - 16, 128), "#dedede")
        tile.alpha_composite(icon, ((tile.width - icon.width) // 2, (tile.height - icon.height) // 2))
        sheet.paste(tile.convert("RGB"), (left + 8, top + 8))
        draw.text((left + 8, top + 144), row["label_zh"][:10], font=font, fill="#202020")
    sheet.save(output / "preview.png")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", action="append", help="Logical UIAtlas path from resource_catalog.csv")
    parser.add_argument("--all", action="store_true", help="Export every named sprite from each --atlas")
    parser.add_argument("--output", type=Path, help="Destination (default: race_controls)")
    args = parser.parse_args()
    if args.all and not args.atlas:
        parser.error("--all requires at least one --atlas")
    output = args.output or (BASE / ("ui_atlas_export" if args.all else "race_controls"))
    output.mkdir(parents=True, exist_ok=True)
    with CATALOG.open(newline="", encoding="utf-8") as stream:
        catalog = {row["asset_path"]: row for row in csv.DictReader(stream)}
    apk = apk_from_summary(APK_SUMMARY)

    selected = [(path, name, filename, label, confidence, note) for path, name, filename, label, confidence, note in RACE_SELECTION]
    if args.all:
        selected = []
    elif args.atlas:
        requested = set(args.atlas)
        selected = [item for item in selected if item[0] in requested]

    rows = []
    paths = args.atlas if args.all else list(dict.fromkeys(item[0] for item in selected))
    with zipfile.ZipFile(apk) as archive:
        for path in paths:
            entry, texture_name, image, sprites = load_atlas(archive, catalog, path)
            if args.all:
                items = [(name, f"{safe_name(Path(path).stem)}/{safe_name(name)}.png", name, "", "完整图集自动裁切") for name in sprites]
            else:
                items = [(name, filename, label, confidence, note) for p, name, filename, label, confidence, note in selected if p == path]
            for name, filename, label, confidence, note in items:
                if name not in sprites:
                    raise KeyError(f"Sprite {name!r} was not found in {path}")
                x, y, w, h = sprites[name][:4]
                destination = output / filename
                destination.parent.mkdir(parents=True, exist_ok=True)
                # UnityPy returns a top-left-origin PIL image; NGUI rectangles
                # in these atlases use the same origin (verified on brake/N2O).
                image.crop((x, y, x + w, y + h)).save(destination)
                rows.append({"file": filename, "label_zh": label, "confidence": confidence,
                             "sprite_name": name, "atlas_asset_path": path, "apk_entry": entry,
                             "texture_name": texture_name, "x": x, "y": y,
                             "width": w, "height": h, "note": note})

    fields = ["file", "label_zh", "confidence", "sprite_name", "atlas_asset_path", "apk_entry",
              "texture_name", "x", "y", "width", "height", "note"]
    with (output / "index.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    if not args.all:
        create_preview(rows, output)
    (output / "summary.json").write_text(json.dumps({"exported_sprites": len(rows),
        "source_atlases": paths, "note": "Direction and drift examples come from the settings atlas; the exact race button variants have not been identified."},
        ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(rows)} sprites to {output}")


if __name__ == "__main__":
    main()
