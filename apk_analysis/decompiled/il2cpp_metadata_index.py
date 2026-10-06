#!/usr/bin/env python3
"""Index static IL2CPP metadata v24.1 without loading the game library.

The data layout follows the public Il2CppDumper metadata definitions:
https://github.com/Perfare/Il2CppDumper/blob/master/Il2CppDumper/Il2Cpp/MetadataClass.cs
"""

import csv
import json
import struct
import sys
from functools import lru_cache
from pathlib import Path


MAGIC = 0xFAB11BAF
IMAGE_STRIDE = 40
ASSEMBLY_STRIDE = 68
TYPE_STRIDE = 100
METHOD_STRIDE = 52
NESTED_TYPE_STRIDE = 4


def pair(data, number):
    return struct.unpack_from("<II", data, 8 + number * 8)


def checked_section(data, number, stride):
    offset, size = pair(data, number)
    if offset + size > len(data) or size % stride:
        raise ValueError(f"Invalid metadata section {number}")
    return offset, size // stride


def write_csv(path, rows, fields):
    with path.open("x", encoding="utf-8", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main():
    if len(sys.argv) != 4:
        raise SystemExit("Usage: il2cpp_metadata_index.py global-metadata.dat libil2cpp.so OUTPUT_DIRECTORY")
    metadata_path = Path(sys.argv[1])
    library_path = Path(sys.argv[2])
    output_dir = Path(sys.argv[3])
    output_dir.mkdir(parents=True, exist_ok=True)
    data = metadata_path.read_bytes()
    with library_path.open("rb") as lib:
        elf_header = lib.read(20)
    if not (elf_header.startswith(b"\x7fELF\x02\x01") and struct.unpack_from("<H", elf_header, 18)[0] == 183):
        raise ValueError("Expected a little-endian ARM64 ELF library")
    magic, version = struct.unpack_from("<II", data)
    if magic != MAGIC or version != 24 or pair(data, 0)[0] != 272:
        raise ValueError("Expected standard IL2CPP metadata v24 with a 272-byte header")

    string_offset, string_size = pair(data, 2)
    image_offset, image_count = checked_section(data, 21, IMAGE_STRIDE)
    assembly_offset, assembly_count = checked_section(data, 22, ASSEMBLY_STRIDE)
    type_offset, type_count = checked_section(data, 19, TYPE_STRIDE)
    method_offset, method_count = checked_section(data, 5, METHOD_STRIDE)
    nested_offset, nested_count = checked_section(data, 15, NESTED_TYPE_STRIDE)
    if image_count != assembly_count or string_offset + string_size > len(data):
        raise ValueError("Inconsistent image, assembly, or string section")

    @lru_cache(maxsize=None)
    def string_at(index):
        if not 0 <= index < string_size:
            raise ValueError(f"String index out of bounds: {index}")
        start = string_offset + index
        end = data.find(b"\0", start, string_offset + string_size)
        if end < 0:
            raise ValueError(f"Unterminated string index: {index}")
        return data[start:end].decode("utf-8")

    images = []
    for index in range(image_count):
        values = struct.unpack_from("<10I", data, image_offset + index * IMAGE_STRIDE)
        name = string_at(values[0])
        assembly_index, type_start, count = values[1:4]
        if assembly_index != index or type_start + count > type_count:
            raise ValueError(f"Invalid image range at {index}")
        images.append({
            "image_index": index,
            "image_name": name,
            "assembly_name": "",
            "type_start": type_start,
            "type_count": count,
            "method_count": 0,
        })
    if images[0]["type_start"] != 0 or any(
        images[i]["type_start"] + images[i]["type_count"] != images[i + 1]["type_start"]
        for i in range(image_count - 1)
    ) or images[-1]["type_start"] + images[-1]["type_count"] != type_count:
        raise ValueError("Image ranges do not cover all type definitions exactly")

    for index in range(assembly_count):
        base = assembly_offset + index * ASSEMBLY_STRIDE
        image_index = struct.unpack_from("<i", data, base)[0]
        assembly_name_index = struct.unpack_from("<I", data, base + 16)[0]
        if image_index != index:
            raise ValueError(f"Assembly/image mismatch at {index}")
        images[index]["assembly_name"] = string_at(assembly_name_index)

    nested_parents = {}
    type_rows = []
    method_spans = []
    for index in range(type_count):
        base = type_offset + index * TYPE_STRIDE
        name_index, namespace_index = struct.unpack_from("<II", data, base)
        method_start, nested_start = struct.unpack_from("<ii", data, base + 48)[0], struct.unpack_from("<i", data, base + 60)[0]
        method_n, property_n, field_n, event_n, nested_n = struct.unpack_from("<5H", data, base + 76)
        bitfield, token = struct.unpack_from("<II", data, base + 92)
        if method_n:
            if method_start < 0 or method_start + method_n > method_count:
                raise ValueError(f"Invalid method range for type {index}")
            method_spans.append((method_start, method_start + method_n, index))
        if nested_n:
            if nested_start < 0 or nested_start + nested_n > nested_count:
                raise ValueError(f"Invalid nested-type range for type {index}")
            for nested_index in range(nested_start, nested_start + nested_n):
                child = struct.unpack_from("<i", data, nested_offset + nested_index * 4)[0]
                if not 0 <= child < type_count or child in nested_parents:
                    raise ValueError(f"Invalid nested type {child}")
                nested_parents[child] = index
        type_rows.append({
            "type_index": index,
            "image_index": None,
            "image_name": "",
            "assembly_name": "",
            "namespace": string_at(namespace_index),
            "name": string_at(name_index),
            "full_name": "",
            "declaring_type_index": "",
            "token": f"0x{token:08x}",
            "is_value_type": bool(bitfield & 1),
            "is_enum": bool(bitfield & 2),
            "method_count": method_n,
            "field_count": field_n,
            "property_count": property_n,
            "event_count": event_n,
        })

    @lru_cache(maxsize=None)
    def full_name(index):
        row = type_rows[index]
        parent = nested_parents.get(index)
        if parent is not None:
            return full_name(parent) + "+" + row["name"]
        return (row["namespace"] + "." if row["namespace"] else "") + row["name"]

    for image in images:
        for index in range(image["type_start"], image["type_start"] + image["type_count"]):
            row = type_rows[index]
            row["image_index"] = image["image_index"]
            row["image_name"] = image["image_name"]
            row["assembly_name"] = image["assembly_name"]
            row["declaring_type_index"] = nested_parents.get(index, "")
            row["full_name"] = full_name(index)
            image["method_count"] += row["method_count"]

    method_spans.sort()
    next_method = 0
    for start, end, _ in method_spans:
        if start != next_method:
            raise ValueError("Method spans overlap or have gaps")
        next_method = end
    if next_method != method_count:
        raise ValueError("Method spans do not cover all method definitions")

    method_rows = []
    for start, end, type_index in method_spans:
        type_row = type_rows[type_index]
        for index in range(start, end):
            base = method_offset + index * METHOD_STRIDE
            name_index, declaring_type_index = struct.unpack_from("<Ii", data, base)
            if declaring_type_index != type_index:
                raise ValueError(f"Method {index} has unexpected declaring type")
            token = struct.unpack_from("<I", data, base + 40)[0]
            param_count = struct.unpack_from("<H", data, base + 50)[0]
            method_rows.append({
                "method_index": index,
                "assembly_name": type_row["assembly_name"],
                "type_index": type_index,
                "type_full_name": type_row["full_name"],
                "method_name": string_at(name_index),
                "parameter_count": param_count,
                "token": f"0x{token:08x}",
            })
    method_rows.sort(key=lambda row: row["method_index"])

    summary = {
        "metadata_path": metadata_path.name,
        "library_path": library_path.name,
        "library_format": "ELF64 little-endian AArch64 shared object",
        "metadata_magic": f"0x{magic:08x}",
        "metadata_version": version,
        "structure_layout": "v24.1-compatible (40-byte image, 68-byte assembly, 100-byte type, 52-byte method)",
        "assembly_count": assembly_count,
        "type_count": type_count,
        "method_count": method_count,
        "nested_type_count": len(nested_parents),
        "validation": {
            "images_cover_all_types_without_gaps": True,
            "method_ranges_cover_all_methods_without_gaps": True,
            "assembly_image_pairs_match": True,
            "all_indexed_names_are_valid_utf8": True,
        },
        "scope": (
            "Indexes assembly, type, and method names from static IL2CPP metadata. "
            "It does not reconstruct C# method bodies, native control flow, field types, "
            "or source files. The ELF library was identified but never loaded or executed."
        ),
        "format_reference": "https://github.com/Perfare/Il2CppDumper/blob/master/Il2CppDumper/Il2Cpp/MetadataClass.cs",
    }

    paths = {
        "assemblies_csv": output_dir / "il2cpp_assemblies.csv",
        "assemblies_json": output_dir / "il2cpp_assemblies.json",
        "types_csv": output_dir / "il2cpp_types.csv",
        "types_json": output_dir / "il2cpp_types.json",
        "methods_csv": output_dir / "il2cpp_methods.csv",
        "summary_json": output_dir / "il2cpp_summary.json",
    }
    for path in paths.values():
        if path.exists():
            raise FileExistsError(f"Refusing to overwrite existing file: {path}")
    write_csv(paths["assemblies_csv"], images, list(images[0]))
    write_csv(paths["types_csv"], type_rows, list(type_rows[0]))
    write_csv(paths["methods_csv"], method_rows, list(method_rows[0]))
    for path, obj in [
        (paths["assemblies_json"], images),
        (paths["types_json"], type_rows),
        (paths["summary_json"], summary),
    ]:
        with path.open("x", encoding="utf-8") as out:
            json.dump(obj, out, ensure_ascii=False, indent=2 if path == paths["summary_json"] else None)
            out.write("\n")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
