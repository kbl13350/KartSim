#!/usr/bin/env python3
"""Export PNGs from selected Unity asset bundles using the recovered catalog.

Run with ``apk_analysis/.venv/bin/python``. The default selection contains all
in-APK kart icons, character portraits, track thumbnails and theme backgrounds.
Use ``--prefix`` to select a different catalog path prefix.
"""

import argparse
import csv
import json
import re
import zipfile
from collections import Counter
from pathlib import Path

import UnityPy

from decode_fbau import decode_fbau
from apk_source import apk_from_summary


BASE = Path(__file__).resolve().parent
DEFAULT_PREFIXES = (
    "image/karticon/",
    "image/charheadicon/",
    "image/trackthumbnail/",
    "image/theme/bg/",
)


def safe_part(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._") or "unnamed"


def output_stem(asset_path: str) -> Path:
    return Path(*(safe_part(part) for part in asset_path.split("/")))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prefix", action="append", help="logical asset path prefix; repeatable")
    parser.add_argument("--ui-icons", action="store_true", help="export in-APK image categories named *icon plus item and achievement")
    parser.add_argument("--output-dir", type=Path, default=BASE / "catalog_image_export")
    parser.add_argument("--limit", type=int, default=0, help="maximum matching assets per prefix; 0 means all")
    args = parser.parse_args()
    if args.limit < 0:
        parser.error("--limit cannot be negative")
    if args.ui_icons and args.prefix:
        parser.error("use --ui-icons or --prefix, not both")
    prefixes = tuple(args.prefix or DEFAULT_PREFIXES)
    with (BASE / "index" / "resource_catalog.csv").open(newline="", encoding="utf-8") as source:
        catalog = list(csv.DictReader(source))
    selected = []
    seen = set()
    if args.ui_icons:
        matches = [row for row in catalog if row["in_apk"] == "True"
                   and row["asset_path"].startswith("image/")
                   and ("icon" in row["asset_path"].split("/")[1]
                        or row["asset_path"].split("/")[1] in ("item", "achievement"))]
        selected = matches[: args.limit or None]
    else:
        for prefix in prefixes:
            matches = [row for row in catalog if row["in_apk"] == "True" and row["asset_path"].startswith(prefix)]
            for row in matches[: args.limit or None]:
                if row["asset_path"] not in seen:
                    selected.append(row)
                    seen.add(row["asset_path"])

    apk = apk_from_summary(BASE / "index" / "summary.json")
    root = args.output_dir.resolve()
    root.mkdir(parents=True, exist_ok=True)
    results = []
    type_counts = Counter()
    with zipfile.ZipFile(apk) as archive:
        for number, row in enumerate(selected, 1):
            record = {"asset_path": row["asset_path"], "bundle_path": row["bundle_path"],
                      "object_type": "", "object_name": "", "path_id": "", "png": "",
                      "width": "", "height": "", "error": ""}
            try:
                blob = archive.read(row["apk_entry"])
                if blob.startswith(b"FBAU"):
                    blob = decode_fbau(blob)
                env = UnityPy.load(blob)
                objects = [obj for obj in env.objects if obj.type.name in ("Texture2D", "Sprite")]
                type_counts.update(obj.type.name for obj in env.objects)
                if not objects:
                    raise ValueError("No Texture2D or Sprite in bundle")
                # The primary logical image is a Texture2D in this APK. Fall back
                # to a Sprite when a bundle has no Texture2D.
                textures = [obj for obj in objects if obj.type.name == "Texture2D"]
                chosen = textures or [obj for obj in objects if obj.type.name == "Sprite"]
                for i, obj in enumerate(chosen):
                    item = obj.read()
                    stem = output_stem(row["asset_path"])
                    if len(chosen) > 1:
                        stem = stem.with_name(stem.name + "__" + safe_part(getattr(item, "m_Name", "")) + f"_{obj.path_id}")
                    destination = root / Path(str(stem) + ".png")
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    image = item.image
                    image.save(destination)
                    result = dict(record)
                    result.update({"object_type": obj.type.name, "object_name": getattr(item, "m_Name", ""),
                                   "path_id": obj.path_id, "png": str(destination.relative_to(root)),
                                   "width": image.width, "height": image.height})
                    results.append(result)
            except Exception as exc:
                record["error"] = type(exc).__name__
                results.append(record)
            if number % 100 == 0:
                print(f"Processed {number}/{len(selected)} bundles", flush=True)

    fields = ["asset_path", "bundle_path", "object_type", "object_name", "path_id",
              "png", "width", "height", "error"]
    with (root / "export_index.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(results)
    report = {"selection": "ui_icons" if args.ui_icons else {"prefixes": prefixes},
              "selected_assets": len(selected),
              "exported_pngs": sum(bool(row["png"]) for row in results),
              "failed_assets": sum(bool(row["error"]) for row in results),
              "object_types_seen": dict(type_counts)}
    (root / "summary.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
