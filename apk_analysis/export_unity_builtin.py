#!/usr/bin/env python3
"""Inventory and export a small sample from the APK's unprotected Unity files.

Run with apk_analysis/.venv/bin/python. This reads serialized files as data;
it does not load Android code or modify the extracted source files.
"""

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

import UnityPy


BASE = Path(__file__).resolve().parent
SOURCE = BASE / "extracted" / "assets" / "bin" / "Data"
OUTPUT = BASE / "unity_builtin_export"

SAMPLE_IMAGES = {
    ("cf989fbbbebaef544a07850b3f97d866", "Texture2D", "CommonUI_New_Atlas"): "CommonUI_New_Atlas.png",
    ("892d3764b3682624382fa888b177b4ce", "Texture2D", "headicon_default"): "headicon_default.png",
    ("6dd2acdb4d020d1439a493250ebc0c5e", "Texture2D", "headicon_pidan"): "headicon_pidan.png",
    ("b46146a008d89a044baa7423824aa937", "Texture2D", "tc_gonggao_bg"): "tc_gonggao_bg.png",
    ("083c20b23110caf4cb8f605a4999f671", "Texture2D", "season_27"): "season_27.png",
    ("4615e6c753541b842a38709d84a6ba66", "Texture2D", "VersionUpdateAtlas"): "VersionUpdateAtlas.png",
    ("sharedassets2.assets.split0", "Texture2D", "npc02"): "npc02.png",
    ("0000000000000000f000000000000000", "Sprite", "UISprite"): "UISprite_sprite.png",
}
SAMPLE_TEXT = {
    ("sharedassets2.assets.split0", "TextAsset", "driver_loop"): "driver_loop.xml",
    ("sharedassets2.assets.split0", "TextAsset", "idle"): "idle.xml",
    ("4815b473925be7c4398acdf3a86b7d4a", "TextAsset", "ResVersion_Android"): "ResVersion_Android.txt",
}
LIST_TYPES = {"Texture2D", "Sprite", "TextAsset", "AudioClip", "Font", "Cubemap"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--all-textures", action="store_true", help="also export every decodable Texture2D")
    args = parser.parse_args()
    (OUTPUT / "images").mkdir(parents=True, exist_ok=True)
    (OUTPUT / "text").mkdir(parents=True, exist_ok=True)
    if args.all_textures:
        (OUTPUT / "all_textures").mkdir(parents=True, exist_ok=True)
    counts = Counter()
    rows = []
    exports = []
    texture_exports = 0
    texture_errors = []
    parsed = 0

    for path in sorted(SOURCE.rglob("*")):
        if not path.is_file():
            continue
        with path.open("rb") as stream:
            if b"2018.4.4f1" not in stream.read(64):
                continue
        env = UnityPy.load(str(path))
        parsed += 1
        for obj in env.objects:
            kind = obj.type.name
            counts[kind] += 1
            if kind not in LIST_TYPES:
                continue
            item = obj.read()
            name = getattr(item, "m_Name", "")
            key = (path.name, kind, name)
            row = {
                "unity_file": str(path.relative_to(SOURCE)),
                "path_id": obj.path_id,
                "type": kind,
                "name": name,
                "width": getattr(item, "m_Width", ""),
                "height": getattr(item, "m_Height", ""),
                "texture_format": getattr(item, "m_TextureFormat", ""),
                "payload_size": "",
                "exported_file": "",
                "all_texture_file": "",
                "decode_error": "",
            }
            if kind == "Texture2D":
                row["payload_size"] = len(item.image_data)
                if args.all_textures:
                    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", name).strip("._")[:60] or "unnamed"
                    destination = OUTPUT / "all_textures" / f"{path.stem}_{obj.path_id}_{safe_name}.png"
                    try:
                        item.image.save(destination)
                        row["all_texture_file"] = str(destination.relative_to(OUTPUT))
                        texture_exports += 1
                    except Exception as exc:
                        row["decode_error"] = type(exc).__name__
                        texture_errors.append({"unity_file": path.name, "path_id": obj.path_id, "name": name, "error": row["decode_error"]})
            elif kind == "TextAsset":
                row["payload_size"] = len(item.m_Script)

            if key in SAMPLE_IMAGES:
                destination = OUTPUT / "images" / SAMPLE_IMAGES[key]
                image = item.image
                image.save(destination)
                row["exported_file"] = str(destination.relative_to(OUTPUT))
                exports.append({"file": row["exported_file"], "pixels": list(image.size)})
            elif key in SAMPLE_TEXT:
                destination = OUTPUT / "text" / SAMPLE_TEXT[key]
                content = item.m_Script
                destination.write_bytes(content.encode("utf-8") if isinstance(content, str) else content)
                row["exported_file"] = str(destination.relative_to(OUTPUT))
                exports.append({"file": row["exported_file"], "bytes": destination.stat().st_size})
            rows.append(row)

    fields = ["unity_file", "path_id", "type", "name", "width", "height", "texture_format", "payload_size", "exported_file", "all_texture_file", "decode_error"]
    with (OUTPUT / "object_inventory.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    summary = {
        "unity_version": "2018.4.4f1",
        "parsed_serialized_files": parsed,
        "total_objects": sum(counts.values()),
        "object_types": dict(counts.most_common()),
        "inventory_rows": len(rows),
        "exports": exports,
        "all_texture_exports": texture_exports,
        "all_texture_errors": texture_errors,
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": parsed, "objects": sum(counts.values()), "inventory_rows": len(rows), "exports": len(exports), "all_texture_exports": texture_exports, "all_texture_errors": len(texture_errors)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
