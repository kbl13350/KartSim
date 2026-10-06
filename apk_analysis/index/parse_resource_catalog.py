#!/usr/bin/env python3
"""Parse the APK's resource catalog without executing or extracting APK code."""

import csv
import json
import struct
import sys
import zipfile
from collections import Counter
from pathlib import Path


CATALOG_ENTRY = (
    "assets/PlatformAssets/Android/"
    "9a781dc14db3b7695eb4d87f3752002b.bytes"
)
ASSET_ROOT = "assets/PlatformAssets/Android/"


def read_7bit_int(data: bytes, offset: int):
    value = 0
    for shift in range(0, 35, 7):
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            return value, offset
    raise ValueError("Invalid 7-bit integer in catalog")


def read_string(data: bytes, offset: int):
    length, offset = read_7bit_int(data, offset)
    end = offset + length
    if end > len(data):
        raise ValueError("String runs past catalog end")
    return data[offset:end].decode("utf-8"), end


def parse_catalog(data: bytes):
    if len(data) < 36:
        raise ValueError("Catalog is too short")
    format_version, count = struct.unpack_from("<II", data, 0)
    offset = 8
    app_version, offset = read_string(data, offset)
    resource_version, offset = read_string(data, offset)
    records_offset, reserved = struct.unpack_from("<II", data, offset)
    if reserved != 0 or records_offset != offset + 8:
        raise ValueError("Unexpected catalog header")
    offset = records_offset

    records = []
    for index in range(count):
        if offset + 8 > len(data):
            raise ValueError(f"Truncated record header at {index}")
        marker, record_length = struct.unpack_from("<II", data, offset)
        if marker != 1 or record_length < 11:
            raise ValueError(f"Unexpected record header at {index}")
        next_offset = offset + record_length
        if next_offset > len(data):
            raise ValueError(f"Record {index} runs past catalog end")
        pos = offset + 8
        bundle_path, pos = read_string(data, pos)
        catalog_flag = data[pos]
        pos += 1
        asset_path, pos = read_string(data, pos)
        if pos != next_offset or catalog_flag not in (1, 2):
            raise ValueError(f"Unexpected record body at {index}")
        records.append((asset_path, bundle_path, catalog_flag))
        offset = next_offset

    if offset != len(data):
        raise ValueError("Trailing unparsed catalog data")
    return {
        "format_version": format_version,
        "app_version": app_version,
        "resource_version": resource_version,
        "declared_records": count,
    }, records


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: parse_resource_catalog.py APK OUTPUT_DIRECTORY")
    apk_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(apk_path) as apk:
        header, raw_records = parse_catalog(apk.read(CATALOG_ENTRY))
        zip_entries = {info.filename: info for info in apk.infolist()}

    records = []
    flag_counts = Counter()
    prefix_counts = Counter()
    for asset_path, bundle_path, catalog_flag in raw_records:
        apk_entry = ASSET_ROOT + bundle_path
        info = zip_entries.get(apk_entry)
        in_apk = info is not None
        flag_counts[catalog_flag] += 1
        prefix_counts[asset_path.split("/", 1)[0]] += 1
        records.append({
            "asset_path": asset_path,
            "bundle_path": bundle_path,
            "apk_entry": apk_entry,
            "in_apk": in_apk,
            "catalog_flag": catalog_flag,
            "bundle_size_bytes": info.file_size if info else None,
        })

    # The catalog's two flags correlate exactly with presence in this APK.
    flag_presence_matches = all(
        row["in_apk"] == (row["catalog_flag"] == 1) for row in records
    )
    summary = {
        "source_apk": apk_path.name,
        "source_catalog_entry": CATALOG_ENTRY,
        **header,
        "parsed_records": len(records),
        "parsed_entire_catalog": True,
        "unique_asset_paths": len({r["asset_path"] for r in records}),
        "unique_bundle_paths": len({r["bundle_path"] for r in records}),
        "records_with_bundle_in_apk": sum(r["in_apk"] for r in records),
        "records_with_bundle_absent_from_apk": sum(not r["in_apk"] for r in records),
        "unique_bundles_in_apk": len({r["bundle_path"] for r in records if r["in_apk"]}),
        "unique_bundles_absent_from_apk": len({r["bundle_path"] for r in records if not r["in_apk"]}),
        "catalog_flag_counts": dict(sorted(flag_counts.items())),
        "flag_1_matches_in_apk": flag_presence_matches,
        "asset_path_first_component_counts": dict(prefix_counts.most_common()),
        "note": (
            "The catalog maps logical Unity asset names to bundle paths. "
            "Records whose bundles are absent from this APK may be downloaded by the app; "
            "their contents were not checked. Bundle payloads were not decoded here."
        ),
    }

    csv_path = output_dir / "resource_catalog.csv"
    json_path = output_dir / "resource_catalog.json"
    summary_path = output_dir / "resource_catalog_summary.json"
    for path in (csv_path, json_path, summary_path):
        if path.exists():
            raise FileExistsError(f"Refusing to overwrite existing file: {path}")

    with csv_path.open("x", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    with json_path.open("x", encoding="utf-8") as out:
        json.dump({"header": header, "records": records}, out, ensure_ascii=False, separators=(",", ":"))
    with summary_path.open("x", encoding="utf-8") as out:
        json.dump(summary, out, ensure_ascii=False, indent=2)
        out.write("\n")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
