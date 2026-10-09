/**
 * Test-only access to original p3553 resources for the item HUD tests: a
 * small library over chosen mirror archives with the canonical paths and
 * source identities the release lookups check (`item/slot/x.png` from
 * item.rho, `stage_/common/x.png` from stage_common.rho, `etc_/x` from
 * DataPack1). Not imported by the game.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { RhoReader } from "../codecs/rho";
import { Rho5Reader } from "../codecs/rho5";
import type { Rho5ArchiveIndex, RhoArchiveIndex } from "../resources/archive-index";
import type { ArchiveSource } from "../resources/container-store";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const releaseSourcePath = path.join(repository, "recovered/formatted/index.js");

export interface MirrorResource {
  virtualPath: string;
  canonicalPath: string;
  sourceKind: "rho" | "rho5";
  sourceName: string;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface MirrorLibrary {
  files: MirrorResource[];
  canonicalCandidates(path: string): MirrorResource[];
  exactCanonicalCandidates(path: string): MirrorResource[];
}

let index: { rho: RhoArchiveIndex[]; rho5: Rho5ArchiveIndex[] } | undefined;

function archiveIndex() {
  index ??= JSON.parse(inflateSync(readFileSync(path.join(repository,
    "mirror/__p3553/archive-index"))).toString("utf8"), (_key, value: unknown) =>
    value && typeof value === "object" && "$u8" in value && typeof value.$u8 === "string"
      ? Uint8Array.from(Buffer.from(value.$u8, "base64")) : value);
  return index!;
}

function source(name: string): ArchiveSource {
  const bytes = readFileSync(path.join(repository, "mirror/p3553", name));
  const copy = (chunk: Uint8Array): ArrayBuffer => Uint8Array.from(chunk).buffer as ArrayBuffer;
  return {
    name, size: bytes.length,
    arrayBuffer: async () => copy(bytes),
    slice: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => copy(bytes.subarray(start, end)),
    }),
  };
}

/** `stage_speedIndiGame.rho` → `stage_/speedIndiGame/`, `item.rho` → `item/`. */
export function canonicalFolder(container: string): string {
  const stem = container.replace(/\.rho$/i, "");
  const split = stem.indexOf("_");
  return split < 0 ? `${stem}/` : `${stem.slice(0, split + 1)}/${stem.slice(split + 1)}/`;
}

function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  return new TextDecoder().decode(bytes);
}

/** Opens Rho containers (by file name) and Rho5 groups (by group name, e.g. DataPack1). */
export function openMirrorLibrary(containers: readonly string[],
  groups: readonly string[] = []): MirrorLibrary {
  const files: MirrorResource[] = [];
  for (const name of containers) {
    const entry = archiveIndex().rho.find(archive => archive.name.toLowerCase() === name.toLowerCase());
    if (!entry) throw new Error(`镜像缺少 ${name}`);
    const reader = new RhoReader(source(entry.name), entry);
    const folder = canonicalFolder(entry.name);
    for (const file of reader.files) {
      const bytes = () => reader.read(file.path);
      files.push({ virtualPath: `${folder}${file.path}`, canonicalPath: `${folder}${file.path}`,
        sourceKind: "rho", sourceName: entry.name, bytes,
        text: async () => decodeText(await bytes()) });
    }
  }
  for (const name of groups) {
    const group = archiveIndex().rho5.find(entry => entry.name.toLowerCase() === name.toLowerCase());
    if (!group) throw new Error(`镜像缺少 ${name}`);
    const reader = new Rho5Reader(group, group.parts.map(part => source(part.name)));
    for (const file of reader.files) {
      const bytes = () => reader.read(file.path);
      files.push({ virtualPath: file.path, canonicalPath: file.path, sourceKind: "rho5",
        sourceName: group.name, bytes, text: async () => decodeText(await bytes()) });
    }
  }
  const byPath = new Map<string, MirrorResource[]>();
  for (const file of files) {
    const key = file.canonicalPath.toLowerCase();
    byPath.set(key, [...byPath.get(key) ?? [], file]);
  }
  const candidates = (canonical: string) => byPath.get(canonical.toLowerCase()) ?? [];
  return { files, canonicalCandidates: candidates, exactCanonicalCandidates: candidates };
}
