import type { ArchiveCatalog } from "../resources/archive-index";
import { exportXml } from "./binary-xml";
import { checkVirtualPath, joinPath, requireValue } from "./common";
import { readMountManifest, type ArchiveMount } from "./mount-manifest";
import { RhoReader } from "./rho";
import { Rho5Reader } from "./rho5";

export interface VirtualFile {
  readonly virtualPath: string;
  readonly canonicalPath: string;
  readonly sourceKind: "rho" | "rho5";
  readonly sourceName: string;
  readonly size: number;
  readBytes(): Promise<Uint8Array>;
  readXml(): Promise<string>;
}

export class VirtualFileLibrary {
  readonly files: readonly VirtualFile[];
  private readonly byPath: Map<string, VirtualFile>;
  private readonly byCanonicalPath: Map<string, readonly VirtualFile[]>;

  constructor(files: readonly VirtualFile[]) {
    this.files = files;
    this.byPath = new Map(files.map(file => [file.virtualPath.toLowerCase(), file]));
    const canonical = new Map<string, VirtualFile[]>();
    for (const file of files) {
      const key = file.canonicalPath.toLowerCase();
      canonical.set(key, [...(canonical.get(key) ?? []), file]);
    }
    this.byCanonicalPath = canonical;
  }

  get(path: string): VirtualFile | undefined {
    return this.byPath.get(path.toLowerCase());
  }

  canonicalCandidates(path: string): readonly VirtualFile[] {
    return this.byCanonicalPath.get(path.toLowerCase()) ?? [];
  }

  async read(path: string): Promise<Uint8Array> {
    const file = this.get(path);
    requireValue(file, `资源库内找不到 ${path}。`);
    return file.readBytes();
  }
}

function makeFile(
  canonicalPath: string,
  sourceKind: VirtualFile["sourceKind"],
  sourceName: string,
  size: number,
  read: () => Promise<Uint8Array>,
): VirtualFile {
  checkVirtualPath(canonicalPath);
  return {
    virtualPath: canonicalPath,
    canonicalPath,
    sourceKind,
    sourceName,
    size,
    readBytes: read,
    readXml: async () => exportXml(await read(), canonicalPath),
  };
}

/** Builds the virtual file tree from aaa.pk, Rho indexes, and Rho5 indexes. */
export async function openVirtualFileLibrary(catalog: ArchiveCatalog): Promise<VirtualFileLibrary> {
  const mounts = await readMountManifest(catalog.mountManifest);
  const mountsByArchive = new Map<string, ArchiveMount>();
  for (const mount of mounts) {
    const key = mount.fileName.toLowerCase();
    if (!mountsByArchive.has(key)) mountsByArchive.set(key, mount);
  }

  const files: VirtualFile[] = [];
  for (const archive of catalog.index.rho) {
    const { index, source } = catalog.rho(archive.name);
    const mount = mountsByArchive.get(index.name.toLowerCase());
    if (mount?.mediaSize !== undefined) {
      requireValue(mount.mediaSize === index.mediaSize,
        `${index.name} 的 aaa.pk mediaSize 与档案索引不一致。`);
    }
    if (mount?.dataHash !== undefined) {
      requireValue(mount.dataHash === index.dataHash,
        `${index.name} 的 aaa.pk dataHash 与档案索引不一致。`);
    }
    const mountPath = mount?.mountPath ?? index.name.replace(/\.rho$/i, "");
    if (mountPath) checkVirtualPath(mountPath);
    const reader = new RhoReader(source, index);
    for (const record of reader.files) {
      files.push(makeFile(joinPath(mountPath, record.path), "rho", source.name,
        record.size, () => reader.readRecord(record)));
    }
  }
  for (const group of catalog.index.rho5) {
    const { index, parts } = catalog.rho5(group.name);
    const reader = new Rho5Reader(index, parts);
    for (const record of reader.files) {
      const part = index.parts.find(item => item.id === record.partId);
      requireValue(part, `${record.path} 的 Rho5 分包不存在。`);
      files.push(makeFile(record.path, "rho5", part.name,
        record.decompressedSize, () => reader.readRecord(record)));
    }
  }

  // Preserve every entry even when multiple archives mount the same path.
  const used = new Set<string>();
  const unique = files.map(file => {
    const base = file.virtualPath;
    let virtualPath = base;
    let suffix = 2;
    while (used.has(virtualPath.toLowerCase())) {
      virtualPath = `${base} [${file.sourceName} ${suffix++}]`;
    }
    used.add(virtualPath.toLowerCase());
    return virtualPath === base ? file : { ...file, virtualPath };
  });
  unique.sort((a, b) => a.virtualPath.localeCompare(b.virtualPath));
  return new VirtualFileLibrary(unique);
}
