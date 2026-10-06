#!/usr/bin/env python3
"""Export representative Unity meshes as OBJ, plus their bundle textures.

These are individual meshes and textures; Unity scene hierarchy, animation,
materials, and rigging are not reconstructed in the OBJ files.
"""

import argparse
import csv
import json
import re
import zipfile
from pathlib import Path

import UnityPy

from decode_fbau import decode_fbau
from apk_source import apk_from_summary


BASE = Path(__file__).resolve().parent
DEFAULT_ASSETS = (
    "prefabs/kart_race/r_0045",
    "assets/res/common/guide/flagman/flagman.fbx",
    "assets/res/cabinres/house_fairy/fbx/house_fairy_ch3x1.fbx",
)


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._")[:80] or "unnamed"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("asset", nargs="*", help="exact catalog asset paths")
    args = parser.parse_args()
    assets = tuple(args.asset or DEFAULT_ASSETS)
    with (BASE / "index" / "resource_catalog.csv").open(newline="", encoding="utf-8") as stream:
        catalog = {row["asset_path"]: row for row in csv.DictReader(stream)}
    apk = apk_from_summary(BASE / "index" / "summary.json")
    root = BASE / "model_samples"
    root.mkdir(exist_ok=True)
    records = []
    with zipfile.ZipFile(apk) as archive:
        for asset in assets:
            row = catalog.get(asset)
            if row is None or row["in_apk"] != "True":
                raise ValueError(f"Asset not present in APK catalog: {asset}")
            destination = root / safe_name(asset.replace("/", "__"))
            destination.mkdir(exist_ok=True)
            blob = archive.read(row["apk_entry"])
            if blob.startswith(b"FBAU"):
                blob = decode_fbau(blob)
            env = UnityPy.load(blob)
            mesh_count = 0
            for obj in env.objects:
                if obj.type.name not in ("Mesh", "Texture2D"):
                    continue
                if obj.type.name == "Mesh":
                    if mesh_count >= 3:
                        continue
                    mesh_count += 1
                record = {"asset_path": asset, "bundle_path": row["bundle_path"],
                          "object_type": obj.type.name, "object_name": "",
                          "path_id": obj.path_id, "exported_file": "", "error": ""}
                try:
                    item = obj.read()
                    record["object_name"] = getattr(item, "m_Name", "")
                    name = safe_name(record["object_name"])
                    basename = f"{obj.path_id}_{name}"
                    if obj.type.name == "Mesh":
                        output = destination / f"{basename}.obj"
                        content = item.export("obj")
                        if not content:
                            raise ValueError("UnityPy could not export this mesh")
                        output.write_text(content, encoding="utf-8")
                    else:
                        output = destination / f"{basename}.png"
                        item.image.save(output)
                    record["exported_file"] = str(output.relative_to(root))
                except Exception as exc:
                    record["error"] = type(exc).__name__
                records.append(record)
    with (root / "export_index.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["asset_path", "bundle_path", "object_type", "object_name", "path_id", "exported_file", "error"])
        writer.writeheader()
        writer.writerows(records)
    report = {"assets": assets,
              "meshes": sum(bool(r["object_type"] == "Mesh" and r["exported_file"]) for r in records),
              "textures": sum(bool(r["object_type"] == "Texture2D" and r["exported_file"]) for r in records),
              "failed_objects": sum(bool(r["error"]) for r in records)}
    (root / "summary.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
