#!/usr/bin/env python3
"""Inventory an APK and safely extract directly usable media and analysis inputs.

This script only reads the APK as a ZIP. It never loads Android/Unity code.
"""

import argparse
import csv
import hashlib
import json
import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath


DEFAULT_APK = Path.home() / "Downloads" / "10040714_com.tencent.tmgp.WePop_a2827207_1.27.2_ausg4b.apk"
BASE = Path(__file__).resolve().parent


def category(name: str) -> str:
    lower = name.lower()
    ext = Path(lower).suffix
    if ext in {".png", ".jpg", ".jpeg", ".webp"}:
        return "image"
    if ext in {".mp4", ".webm"}:
        return "video"
    if ext in {".ttf", ".otf"}:
        return "font"
    if ext in {".bnk", ".wem", ".ogg", ".mp3", ".wav"}:
        return "audio"
    if ext == ".unity3d":
        return "unity_bundle"
    if name.startswith("assets/PlatformAssets/Android/ppcbin/"):
        return "track_bin"
    if name.startswith("assets/bin/Data/"):
        return "unity_data"
    if name.endswith(".dex"):
        return "dex"
    if name.startswith("lib/"):
        return "native_library"
    return "other"


def safe_name(info: zipfile.ZipInfo) -> PurePosixPath:
    name = PurePosixPath(info.filename)
    if (
        name.is_absolute()
        or ".." in name.parts
        or not name.parts
        or any(not part for part in name.parts)
        or stat.S_ISLNK(info.external_attr >> 16)
    ):
        raise ValueError(f"Unsafe ZIP member: {info.filename!r}")
    return name


def should_extract(name: str, kind: str) -> bool:
    if kind in {"image", "video", "font", "audio", "track_bin", "dex", "unity_data"}:
        return True
    if name in {"AndroidManifest.xml", "resources.arsc"}:
        return True
    if name == "lib/arm64-v8a/libil2cpp.so":
        return True
    if name.startswith("assets/PlatformAssets/Android/") and name.endswith(".bytes"):
        return True
    if name == "assets/PlatformAssets/Android/ab/ma/e84e30b9390cdb64db6db2c9ab87846d.unity3d":
        return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", type=Path, default=DEFAULT_APK)
    args = parser.parse_args()
    apk = args.apk.resolve(strict=True)
    output = BASE / "extracted"
    index = BASE / "index"
    output.mkdir(parents=True, exist_ok=True)
    index.mkdir(parents=True, exist_ok=True)
    counts = {}
    extracted = []
    with zipfile.ZipFile(apk) as archive, (index / "apk_inventory.csv").open(
        "w", newline="", encoding="utf-8"
    ) as file:
        writer = csv.writer(file)
        writer.writerow(["apk_path", "category", "size_bytes", "compressed_bytes", "extracted"])
        for info in archive.infolist():
            name = safe_name(info)
            if info.is_dir():
                continue
            path = str(name)
            kind = category(path)
            counts[kind] = counts.get(kind, 0) + 1
            selected = should_extract(path, kind)
            writer.writerow([path, kind, info.file_size, info.compress_size, int(selected)])
            if selected:
                target = output.joinpath(*name.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as source, target.open("wb") as destination:
                    shutil.copyfileobj(source, destination, length=1024 * 1024)
                extracted.append(path)
    digest = hashlib.sha256()
    with apk.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    (index / "summary.json").write_text(
        json.dumps(
            {"apk": apk.name, "apk_sha256": digest.hexdigest(),
             "entries_by_category": counts, "extracted_count": len(extracted)},
            ensure_ascii=False, indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"entries_by_category": counts, "extracted_count": len(extracted)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
