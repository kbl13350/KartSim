#!/usr/bin/env python3
"""Recover a standard UnityFS bundle from a KartRider FBAU bundle.

The FBAU header and block table are obfuscated, but the payload of the
bundles handled here consists of plain LZ4 blocks. This script finds their
boundaries, reads the serialized-file header, and builds a fresh UnityFS
header and block table around the original compressed bytes. It does not
decrypt the original FBAU header or execute anything from the APK.

Example:
  python decode_fbau.py --apk game.apk \
    --member assets/PlatformAssets/Android/ab/00/0000ad3700ee70137004b4f2b9d22f4c.unity3d \
    --output recovered.unity3d --verify

Requires lz4; --verify additionally requires UnityPy.
"""

import argparse
import hashlib
import re
import struct
import zipfile
from pathlib import Path

import lz4.block


ENGINE_VERSION = b"2018.4.4f1"
UNITYFS_PREFIX = b"UnityFS\0" + struct.pack(">I", 6) + b"5.x.x\0" + ENGINE_VERSION + b"\0"
LZ4_START = b"\xf0\x01\x00\x00"
BLOCK_SIZE = 131072


def _plausible_serialized_header(data: bytes) -> bool:
    if len(data) < 40:
        return False
    metadata_size, file_size, version, data_offset = struct.unpack(">IIII", data[:16])
    return (
        16 <= version <= 30
        and 20 <= metadata_size <= file_size
        and 20 <= data_offset <= file_size
        and ENGINE_VERSION in data[:80]
    )


def _plausible_serialized_file(data: bytes) -> bool:
    return _plausible_serialized_header(data) and int.from_bytes(data[4:8], "big") <= len(data)


def _try_decompress(data: bytes, limit: int):
    try:
        return lz4.block.decompress(data, uncompressed_size=limit)
    except (ValueError, RuntimeError, lz4.block.LZ4BlockError):
        return None


def _expected_stream_total(data: bytes, max_uncompressed: int = 100 * 1024 * 1024):
    """Read an in-file CAB .resS reference when its byte length is explicit."""
    if len(data) < 16:
        return None
    serialized_size = int.from_bytes(data[4:8], "big")
    if serialized_size > len(data):
        return None
    ends = []
    for match in re.finditer(
        rb"archive:/([^/\x00]+)/([^/\x00]+\.resS)", data[:serialized_size], re.I
    ):
        directory = match.group(1)
        basename = match.group(2)
        start = match.start()
        if start < 12 or not directory.startswith(b"CAB-"):
            continue
        if basename.lower() != (directory + b".resS").lower():
            continue
        path_size = int.from_bytes(data[start - 4 : start], "little")
        if path_size != len(match.group()):
            continue
        stream_size = int.from_bytes(data[start - 8 : start - 4], "little")
        # Unity 2018 stores StreamData.offset as a 32-bit little-endian value.
        stream_offset = int.from_bytes(data[start - 12 : start - 8], "little")
        if stream_size == 0 or stream_offset + stream_size > max_uncompressed:
            continue
        ends.append(stream_offset + stream_size)
    return serialized_size + max(ends) if ends else None


def _valid_complete_data(data: bytes) -> bool:
    if not _plausible_serialized_file(data):
        return False
    expected = _expected_stream_total(data)
    if expected is None:
        return True
    # Some bundles pad the resource node to a four-byte boundary.
    padding = len(data) - expected
    return 0 <= padding <= 15 and not any(data[expected:])


def _full_block_end(bundle: bytes, start: int):
    """Locate a 128 KiB raw LZ4 block's final literal sequence."""
    pos = start
    produced = 0
    while pos < len(bundle) and produced < BLOCK_SIZE:
        token = bundle[pos]
        pos += 1
        literal_size = token >> 4
        if literal_size == 15:
            while pos < len(bundle):
                extension = bundle[pos]
                pos += 1
                literal_size += extension
                if extension < 255:
                    break
            else:
                return None
        if pos + literal_size > len(bundle):
            return None
        pos += literal_size
        produced += literal_size
        if produced == BLOCK_SIZE and token & 0x0F == 0:
            decoded = _try_decompress(bundle[start:pos], BLOCK_SIZE)
            if decoded is not None and len(decoded) == BLOCK_SIZE:
                return pos, decoded
        if produced >= BLOCK_SIZE or pos + 2 > len(bundle):
            return None
        distance = int.from_bytes(bundle[pos : pos + 2], "little")
        pos += 2
        if distance == 0 or distance > produced:
            return None
        match_size = (token & 0x0F) + 4
        if token & 0x0F == 15:
            while pos < len(bundle):
                extension = bundle[pos]
                pos += 1
                match_size += extension
                if extension < 255:
                    break
            else:
                return None
        produced += match_size
    return None


def _canonical_blocks(bundle: bytes, offset: int, max_uncompressed: int):
    """Parse the common stream: full 128 KiB blocks then one short block."""
    blocks = []
    cursor = offset
    total = 0
    while cursor < len(bundle) and total <= max_uncompressed:
        tail = _try_decompress(bundle[cursor:], BLOCK_SIZE)
        if tail is not None and 0 < len(tail) <= BLOCK_SIZE:
            blocks.append((bundle[cursor:], tail))
            data = b"".join(part for _, part in blocks)
            if _valid_complete_data(data):
                return blocks
            return None
        boundary = _full_block_end(bundle, cursor)
        if boundary is None:
            return None
        end, decoded = boundary
        if not blocks and not _plausible_serialized_header(decoded):
            return None
        blocks.append((bundle[cursor:end], decoded))
        total += len(decoded)
        cursor = end
    return None


def _find_lz4_payload(bundle: bytes, max_uncompressed: int):
    search_end = min(len(bundle), 65536)
    signature_offsets = []
    cursor = 0
    while True:
        offset = bundle.find(LZ4_START, cursor, search_end)
        if offset < 0:
            break
        signature_offsets.append(offset)
        cursor = offset + 1
    for offset in range(80, min(len(bundle) - 3, 2048)):
        if bundle[offset] == 0xF0 and bundle[offset + 2 : offset + 4] == b"\0\0":
            signature_offsets.append(offset)
    signature_offsets = sorted(set(signature_offsets))

    # First parse the common 128 KiB block stream. Decoding the whole tail as
    # one block can appear to succeed even when it silently drops later blocks.
    for offset in signature_offsets:
        if offset > 2048:
            break
        blocks = _canonical_blocks(bundle, offset, max_uncompressed)
        if blocks is not None:
            return offset, blocks

    # Most bundles start with this literal sequence. Some use another LZ4
    # token (for example E0), so inspect other plausible offsets as fallback.
    fallback_offsets = (
        offset for offset in range(80, min(len(bundle), 2048))
        if offset not in signature_offsets and bundle[offset] >= 0x80
    )
    for offset in (*signature_offsets, *fallback_offsets):
        payload = bundle[offset:]
        data = _try_decompress(payload, max_uncompressed)
        if data is not None and _valid_complete_data(data):
            return offset, [(payload, data)]

    # Some bundles contain two consecutive LZ4 blocks. The block table is
    # obfuscated, so identify the boundary by requiring both halves to decode
    # independently and the first half to begin with a serialized file. A
    # truncated first block can sometimes decode successfully, so favor a
    # complete 128 KiB block when more than one split passes those checks.
    best_split = None
    for offset in signature_offsets:
        if offset > 2048:
            break
        for middle in range(offset + 1, len(bundle)):
            second = _try_decompress(bundle[middle:], max_uncompressed)
            if second is None:
                continue
            first = _try_decompress(bundle[offset:middle], max_uncompressed)
            if first is None:
                continue
            if _valid_complete_data(first + second):
                score = (len(first) % 131072 == 0, len(first))
                if best_split is None or score > best_split[0]:
                    best_split = (
                        score, offset,
                        [(bundle[offset:middle], first), (bundle[middle:], second)],
                    )
    if best_split is not None:
        return best_split[1], best_split[2]
    raise ValueError(
        "No supported LZ4 payload containing a Unity "
        "serialized file was found. This FBAU bundle may use a different "
        "layout or exceed --max-uncompressed."
    )


def _node(offset: int, size: int, flags: int, name: str) -> bytes:
    return struct.pack(">QQI", offset, size, flags) + name.encode("utf-8") + b"\0"


def _resource_name(data: bytes):
    # The serialized file stores streamed texture references in plain text.
    for match in re.finditer(rb"archive:/([^/\x00]+)/([^\x00]+)", data, re.I):
        directory = match.group(1).decode("ascii", "replace")
        basename = match.group(2).decode("ascii", "replace")
        if basename.lower() == (directory + ".ress").lower():
            return directory, basename
    return None


def recover(bundle: bytes, max_uncompressed: int = 100 * 1024 * 1024):
    """Return (UnityFS bytes, source payload offset, object stream size)."""
    if bundle.startswith(b"UnityFS\0"):
        return bundle, 0, 0
    if not bundle.startswith(b"FBAU"):
        raise ValueError("Expected FBAU or UnityFS magic")

    offset, blocks = _find_lz4_payload(bundle, max_uncompressed)
    payload = b"".join(compressed for compressed, _ in blocks)
    data = b"".join(uncompressed for _, uncompressed in blocks)
    serialized_size = int.from_bytes(data[4:8], "big")
    name = "CAB-" + hashlib.md5(data[:serialized_size]).hexdigest()
    resource = _resource_name(data) if serialized_size < len(data) else None
    if resource is not None:
        name, resource_basename = resource
    else:
        resource_basename = name + ".resS"

    nodes = [_node(0, serialized_size, 4, name)]
    if serialized_size < len(data):
        nodes.append(
            _node(serialized_size, len(data) - serialized_size, 0, resource_basename)
        )

    # Compressed bytes are copied directly from the APK; only the container
    # header and block table are rebuilt.
    info = (
        b"\0" * 16
        + struct.pack(">I", len(blocks))
        + b"".join(
            struct.pack(">IIH", len(uncompressed), len(compressed), 3)
            for compressed, uncompressed in blocks
        )
        + struct.pack(">I", len(nodes))
        + b"".join(nodes)
    )
    compressed_info = lz4.block.compress(info, store_size=False)
    total_size = len(UNITYFS_PREFIX) + 20 + len(compressed_info) + len(payload)
    header = UNITYFS_PREFIX + struct.pack(
        ">QIII", total_size, len(compressed_info), len(info), 0x43
    )
    return header + compressed_info + payload, offset, len(data)


def decode_fbau(data: bytes) -> bytes:
    """Decode one supported FBAU bundle into standard UnityFS bytes."""
    return recover(data)[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--input", type=Path, help="Extracted .unity3d file")
    input_group.add_argument("--apk", type=Path, help="APK containing the bundle")
    parser.add_argument("--member", help="Exact .unity3d path inside --apk")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--verify", action="store_true", help="Read the output with UnityPy")
    parser.add_argument(
        "--max-uncompressed", type=int, default=100 * 1024 * 1024,
        help="Maximum LZ4 output size in bytes (default: 104857600)",
    )
    args = parser.parse_args()
    if args.apk:
        if not args.member:
            parser.error("--member is required with --apk")
        with zipfile.ZipFile(args.apk) as archive:
            source = archive.read(args.member)
    else:
        if args.member:
            parser.error("--member requires --apk")
        source = args.input.read_bytes()

    recovered, offset, data_size = recover(source, args.max_uncompressed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(recovered)
    print(f"Recovered {args.output}: {len(recovered)} bytes; data offset {offset}; uncompressed data {data_size}")

    if args.verify:
        import UnityPy

        env = UnityPy.load(recovered)
        print(f"UnityPy parsed {len(env.objects)} objects")
        for obj in env.objects[:10]:
            print(f"  {obj.type.name}: {obj.container or obj.path_id}")


if __name__ == "__main__":
    main()
