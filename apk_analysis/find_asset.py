#!/usr/bin/env python3
"""Search the recovered Unity asset catalog and optionally extract matching raw bundles."""

import argparse
import csv
import shutil
import zipfile
from pathlib import Path, PurePosixPath

from apk_source import apk_from_summary


BASE = Path(__file__).resolve().parent
CATALOG = BASE / "index" / "resource_catalog.csv"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("query", help="case-insensitive substring of the logical asset path")
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--extract", action="store_true", help="extract matching bundles found in the APK")
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be positive")

    with CATALOG.open(newline="", encoding="utf-8") as file:
        rows = [row for row in csv.DictReader(file) if args.query.casefold() in row["asset_path"].casefold()]
    available = [row for row in rows if row["in_apk"] == "True"]
    print(f"Found {len(rows)} logical assets; {len(available)} have a bundle in this APK.")
    for row in rows[: args.limit]:
        status = "IN APK" if row["in_apk"] == "True" else "NOT IN APK"
        print(f"[{status}] {row['asset_path']} -> {row['bundle_path']}")
    if len(rows) > args.limit:
        print(f"... showing first {args.limit}")

    if not args.extract:
        return
    apk = apk_from_summary(BASE / "index" / "summary.json")
    target_root = BASE / "raw_bundles"
    written = 0
    with zipfile.ZipFile(apk) as archive:
        for entry in sorted({row["apk_entry"] for row in available}):
            path = PurePosixPath(entry)
            if path.is_absolute() or ".." in path.parts or not entry.startswith("assets/PlatformAssets/Android/"):
                raise ValueError(f"Unsafe catalog path: {entry!r}")
            target = target_root.joinpath(*path.parts)
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, target.open("wb") as destination:
                shutil.copyfileobj(source, destination, length=1024 * 1024)
            written += 1
    print(f"Extracted {written} raw bundles to {target_root}")


if __name__ == "__main__":
    main()
