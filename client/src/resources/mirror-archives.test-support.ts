/**
 * Test support: read original files from the local p3553 mirror through its
 * archive index, slicing archive parts on demand instead of loading them whole.
 */

import { closeSync, fstatSync, openSync, readFileSync, readSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { RhoReader } from "../codecs/rho";
import { Rho5Reader } from "../codecs/rho5";
import type { ArchiveIndex } from "./archive-index";
import type { ArchiveSource } from "./container-store";

const mirror = new URL("../../../mirror/", import.meta.url);

function fileSource(name: string): ArchiveSource {
  const read = (start: number, end: number): ArrayBuffer => {
    const descriptor = openSync(new URL(`p3553/${name}`, mirror), "r");
    try {
      const bytes = new Uint8Array(end - start);
      readSync(descriptor, bytes, 0, bytes.length, start);
      return bytes.buffer;
    } finally {
      closeSync(descriptor);
    }
  };
  const descriptor = openSync(new URL(`p3553/${name}`, mirror), "r");
  const size = fstatSync(descriptor).size;
  closeSync(descriptor);
  return {
    name, size,
    arrayBuffer: async () => read(0, size),
    slice: (start = 0, end = size) => ({ arrayBuffer: async () => read(start, end) }),
  } as ArchiveSource;
}

export interface MirrorArchives {
  readonly index: ArchiveIndex;
  /** A file of a Rho archive (`track_village_C01.rho`) or a Rho5 group (`DataPack4`). */
  read(archive: string, path: string): Promise<Uint8Array>;
}

let shared: MirrorArchives | undefined;

export function mirrorArchives(): MirrorArchives {
  if (shared) return shared;
  const index = JSON.parse(inflateSync(readFileSync(new URL("__p3553/archive-index", mirror)))
    .toString("utf8"), (_key, value: unknown) =>
    value && typeof value === "object" && "$u8" in value && typeof value.$u8 === "string"
      ? Uint8Array.from(Buffer.from(value.$u8, "base64")) : value) as ArchiveIndex;
  const readers = new Map<string, RhoReader | Rho5Reader>();
  const reader = (name: string): RhoReader | Rho5Reader => {
    let found = readers.get(name);
    if (found) return found;
    const rho = index.rho.find(archive => archive.name === name);
    const rho5 = index.rho5.find(group => group.name === name);
    if (rho) found = new RhoReader(fileSource(rho.name), rho);
    else if (rho5) found = new Rho5Reader(rho5, rho5.parts.map(part => fileSource(part.name)));
    else throw new Error(`镜像中没有 ${name}。`);
    readers.set(name, found);
    return found;
  };
  shared = { index, read: (archive, path) => reader(archive).read(path) };
  return shared;
}

/** Decode a UTF-16LE resource with its byte order mark. */
export function utf16Text(bytes: Uint8Array): string {
  if (bytes[0] !== 0xff || bytes[1] !== 0xfe) throw new Error("资源缺少 UTF-16LE BOM。");
  return new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
}
