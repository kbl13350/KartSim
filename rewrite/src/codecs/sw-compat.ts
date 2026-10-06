import type { ArchiveIndex, Rho5ArchiveIndex, RhoArchiveIndex } from "../resources/archive-index";
import type { ArchiveSource } from "../resources/container-store";
import { joinPath, requireValue } from "./common";
import { readMountManifestDetails, type ArchiveMount } from "./mount-manifest";
import { RhoReader } from "./rho";
import { Rho5Reader } from "./rho5";
import { scanRhoArchiveIndex } from "./rho-index-scan";
import { scanRho5ArchiveIndex } from "./rho5-index-scan";

export interface SwCompatibleEntry {
  readonly name: string;
  readonly extension: string;
  readonly size: number;
  readonly sourceName: string;
  readonly sourceKind: "rho" | "rho5" | "loose";
  readonly containerId: string;
  readonly absenceAuthoritative: boolean;
  readonly sourceOrdinal?: number;
  readonly canonicalPath: string;
  readonly virtualPath: string;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface SwCompatibleArchive {
  readonly name: string;
  readonly type: "Rho" | "Rho5";
  readonly version: string;
  readonly fileCount: number;
  readonly mountPath: string;
  readonly partCount: number;
}

export interface SwCompatibleState {
  readonly files: SwCompatibleEntry[];
  readonly archives: SwCompatibleArchive[];
  readonly errors: string[];
  readonly warnings: string[];
  region: string;
  manifestAvailable: boolean;
  readonly manifestMountPaths: Set<string>;
  readonly archiveIndexes: ArchiveIndex;
}

export type SwConstructor<T> = new (state: SwCompatibleState) => T;

export interface SwSource extends ArchiveSource {
  readonly webkitRelativePath?: string;
}

export function normalizeCanonicalPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "");
}

function entryText(bytes: Uint8Array, inferUtf16 = false): string {
  if (bytes[0] === 255 && bytes[1] === 254) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes[0] === 254 && bytes[1] === 255) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  if (inferUtf16) {
    let zeroHighBytes = 0;
    const sampleLength = Math.min(bytes.length - bytes.length % 2, 128);
    for (let index = 1; index < sampleLength; index += 2)
      if (bytes[index] === 0) zeroHighBytes++;
    if (sampleLength >= 8 && zeroHighBytes > sampleLength / 8)
      return new TextDecoder("utf-16le").decode(bytes);
  }
  return new TextDecoder().decode(bytes);
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function authoritativeRho5(group: string, partIds: readonly number[]): boolean {
  const expected: Readonly<Record<string, number>> = {
    datapack1: 2, datapack2: 22, datapack3: 32, datapack4: 7,
  };
  const count = expected[group.toLowerCase()];
  return count !== undefined && partIds.length === count &&
    partIds.every((id, ordinal) => id === ordinal);
}

function commonLooseRoot(sources: readonly SwSource[]): string {
  const roots = sources.map(source => (source.webkitRelativePath ?? "")
    .replaceAll("\\", "/").split("/")[0]!).filter(Boolean);
  return roots.length > 0 && roots.every(root => root === roots[0]) ? roots[0]! : "";
}

function loosePath(source: SwSource, commonRoot: string): string {
  const path = (source.webkitRelativePath || source.name).replaceAll("\\", "/");
  return commonRoot && path.startsWith(`${commonRoot}/`)
    ? path.slice(commonRoot.length + 1) : path;
}

/** Pure, hand-written copy of the release library's path lookup rules. */
export class SwQueryIndex {
  readonly files: readonly SwCompatibleEntry[];
  readonly manifestMountPaths: ReadonlySet<string>;
  private readonly byPath: Map<string, SwCompatibleEntry>;
  private readonly byCanonicalPath = new Map<string, SwCompatibleEntry[]>();
  private readonly byExactCanonicalPath = new Map<string, SwCompatibleEntry[]>();
  private readonly canonicalPrefixCache = new Map<string, readonly SwCompatibleEntry[]>();

  constructor(files: readonly SwCompatibleEntry[],
              manifestMountPaths: ReadonlySet<string>) {
    this.files = files;
    this.manifestMountPaths = manifestMountPaths;
    this.byPath = new Map(files.map(file => [file.virtualPath.toLowerCase(), file]));
    for (const file of files) {
      const canonical = file.canonicalPath ?? file.virtualPath;
      this.byCanonicalPath.set(canonical.toLowerCase(), [
        ...(this.byCanonicalPath.get(canonical.toLowerCase()) ?? []), file,
      ]);
      this.byExactCanonicalPath.set(canonical, [
        ...(this.byExactCanonicalPath.get(canonical) ?? []), file,
      ]);
    }
  }

  get(path: string): SwCompatibleEntry | undefined {
    return this.byPath.get(path.toLowerCase());
  }

  canonicalCandidates(path: string): readonly SwCompatibleEntry[] {
    return this.byCanonicalPath.get(normalizeCanonicalPath(path).toLowerCase()) ?? [];
  }

  exactCanonicalCandidates(path: string): readonly SwCompatibleEntry[] {
    return this.byExactCanonicalPath.get(normalizeCanonicalPath(path)) ?? [];
  }

  entriesUnderCanonicalPrefix(path: string): readonly SwCompatibleEntry[] {
    const prefix = normalizeCanonicalPath(path);
    const cached = this.canonicalPrefixCache.get(prefix);
    if (cached) return cached;
    const entries = this.files.filter(file => {
      const canonical = normalizeCanonicalPath(file.canonicalPath ?? file.virtualPath);
      return canonical === prefix || canonical.startsWith(`${prefix}/`);
    });
    this.canonicalPrefixCache.set(prefix, entries);
    return entries;
  }

  hasManifestMount(path: string): boolean {
    return this.manifestMountPaths.has(normalizeCanonicalPath(path));
  }

  physicalContainerNames(paths: readonly string[]): string[] {
    return [...new Set(paths.map(path => {
      const file = this.get(path);
      requireValue(file, `资源库内找不到 ${path}。`);
      return file.sourceName;
    }))];
  }

  resolveContainerPath(referencePath: string, targetPath: string):
    | { status: "found"; entry: SwCompatibleEntry }
    | { status: "ambiguous"; entries: readonly SwCompatibleEntry[] }
    | { status: "missing"; authoritative: boolean } {
    const reference = this.get(referencePath);
    requireValue(reference, `资源库内找不到 ${referencePath}。`);
    const matching = (this.byCanonicalPath.get(targetPath.toLowerCase()) ?? [])
      .filter(file => file.containerId === reference.containerId);
    if (matching.length === 1) return { status: "found", entry: matching[0]! };
    if (matching.length > 1) return { status: "ambiguous", entries: matching };
    return { status: "missing", authoritative: reference.absenceAuthoritative };
  }

  findSibling(path: string, names: readonly string[]): SwCompatibleEntry | undefined {
    const reference = this.get(path);
    const canonical = reference?.canonicalPath ?? reference?.virtualPath ?? path;
    const slash = canonical.lastIndexOf("/");
    const prefix = slash < 0 ? "" : canonical.slice(0, slash + 1);
    for (const name of names) {
      const candidates = this.byCanonicalPath.get(`${prefix}${name}`.toLowerCase()) ?? [];
      if (!reference) { if (candidates[0]) return candidates[0]; continue; }
      const sameSource = candidates.find(candidate =>
        candidate.sourceKind === reference.sourceKind &&
        candidate.sourceName === reference.sourceName);
      if (sameSource) return sameSource;
      const sameKind = candidates.filter(candidate =>
        candidate.sourceKind === reference.sourceKind);
      if (sameKind.length === 1) return sameKind[0];
    }
    return undefined;
  }

  bodyParams(): SwCompatibleEntry[] {
    return this.files.filter(file =>
      /(^|\/)param(?:@cn)?\.(bml|eml|kml|xml)$/i.test(file.virtualPath));
  }

  mapAssets(): SwCompatibleEntry[] {
    return this.uniqueDirectoryEntries(this.files.filter(file =>
      file.extension === "1s" && file.name.toLowerCase() === "track.1s"));
  }

  vehicleAssets(): SwCompatibleEntry[] {
    return this.uniqueDirectoryEntries(this.files.filter(file =>
      file.extension === "1s" && file.name.toLowerCase() === "model.1s" &&
      (/(^|\/)kart[^/]*\//i.test(file.virtualPath) || !file.virtualPath.includes("/")) &&
      [0, 1, 2, 3].every(index => !!this.findSibling(file.virtualPath, [`f0${index}.1s`])) &&
      !!this.findSibling(file.virtualPath, ["param@cn.bml", "param@cn.eml",
        "param@cn.kml", "param@cn.xml", "param.bml", "param.eml",
        "param.kml", "param.xml"])));
  }

  private uniqueDirectoryEntries(entries: readonly SwCompatibleEntry[]): SwCompatibleEntry[] {
    const byDirectory = new Map<string, SwCompatibleEntry[]>();
    for (const entry of entries) {
      const path = entry.canonicalPath ?? entry.virtualPath;
      const slash = path.lastIndexOf("/");
      const directory = path.slice(0, Math.max(0, slash)).toLowerCase();
      byDirectory.set(directory, [...(byDirectory.get(directory) ?? []), entry]);
    }
    return [...byDirectory.values()].filter(group => group.length === 1).map(group => group[0]!);
  }
}

function progress(
  callback: ((event: { current: number; total: number; filename: string }) => void) | undefined,
  current: number,
  total: number,
  filename: string,
  count = 1,
): number {
  const next = Math.min(current + count, total);
  callback?.({ current: next, total, filename });
  return next;
}

/** Build the release-facing library with readable Rho/Rho5 byte readers. */
export async function loadSwWithReadableCodec<T>(
  Sw: SwConstructor<T>,
  sources: readonly SwSource[],
  onProgress?: (event: { current: number; total: number; filename: string }) => void,
  indexes?: ArchiveIndex,
): Promise<T> {
  requireValue(sources.length > 0, "请选择文件或客户端 Data 目录。");
  const rhoSources = sources.filter(source => source.name.toLowerCase().endsWith(".rho"));
  const rho5Sources = sources.filter(source => /_\d{5}\.rho5$/i.test(source.name));
  const manifestSources = sources.filter(source => source.name.toLowerCase() === "aaa.pk");
  const archiveSources = new Set([...rhoSources, ...rho5Sources, ...manifestSources]);
  const looseSources = sources.filter(source => !archiveSources.has(source));
  const mountSource = manifestSources[0];
  const total = rhoSources.length + rho5Sources.length + manifestSources.length + looseSources.length;
  let current = 0;
  const state: SwCompatibleState = {
    files: [], archives: [], errors: [], warnings: [], region: "unknown",
    manifestAvailable: false, manifestMountPaths: new Set(),
    archiveIndexes: { rho: [], rho5: [] },
  };
  const rhoIndex = new Map(indexes?.rho.map(index => [index.name.toLowerCase(), index]) ?? []);
  const rho5Index = new Map(indexes?.rho5.map(index => [index.name.toLowerCase(), index]) ?? []);
  const rhoByName = new Map<string, ArchiveSource[]>();
  for (const source of rhoSources) {
    const key = source.name.toLowerCase();
    rhoByName.set(key, [...(rhoByName.get(key) ?? []), source]);
  }

  let mounts: readonly ArchiveMount[] = [];
  if (mountSource) {
    if (manifestSources.length > 1) state.warnings.push("选择了多个 aaa.pk，仅使用第一个。");
    try {
      const details = await readMountManifestDetails(mountSource);
      mounts = details.mounts;
      state.region = details.region;
      state.manifestAvailable = true;
      for (const mount of mounts) state.manifestMountPaths.add(normalizeCanonicalPath(mount.mountPath));
    } catch (error) {
      state.warnings.push(`aaa.pk 解析失败，将按独立档案加载：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      current = progress(onProgress, current, total, mountSource.name);
    }
  }

  const mounted = new Set<string>();
  const jobs: { source: SwSource; mount?: ArchiveMount }[] = [];
  let missingMounts = 0;
  for (const mount of mounts) {
    const key = mount.fileName.toLowerCase();
    if (mounted.has(key)) continue;
    const matching = rhoByName.get(key) ?? [];
    if (matching.length === 0) { missingMounts++; continue; }
    if (matching.length > 1) {
      state.errors.push(`${mount.fileName}: 选择中存在同名文件，无法确定挂载对象。`);
      continue;
    }
    mounted.add(key);
    jobs.push({ source: matching[0]!, mount });
  }
  if (missingMounts > 0) {
    state.warnings.push(`aaa.pk 中有 ${missingMounts} 个档案未选择，已按子集模式忽略。`);
  }
  for (const source of rhoSources) {
    if (!mounted.has(source.name.toLowerCase())) jobs.push({ source });
  }

  const usedPaths = new Set<string>();
  const addEntry = (entry: Omit<SwCompatibleEntry, "canonicalPath" | "virtualPath">,
                    canonicalPath: string): void => {
    let virtualPath = canonicalPath;
    let suffix = 2;
    while (usedPaths.has(virtualPath.toLowerCase())) {
      virtualPath = `${canonicalPath} [${entry.sourceName} ${suffix++}]`;
    }
    if (virtualPath !== canonicalPath) state.warnings.push(`虚拟路径冲突：${canonicalPath}`);
    usedPaths.add(virtualPath.toLowerCase());
    state.files.push({ ...entry, canonicalPath, virtualPath });
  };

  let rhoContainerId = 0;
  for (const { source, mount } of jobs) {
    try {
      const index = rhoIndex.get(source.name.toLowerCase()) ??
        await scanRhoArchiveIndex(source, mount?.key === 0 ? undefined : mount?.key);
      if (mount?.mediaSize !== undefined) {
        requireValue(mount.mediaSize === index.mediaSize,
          `${source.name} mediaSize 与 aaa.pk 不匹配。`);
      }
      if (mount?.dataHash !== undefined) {
        requireValue(mount.dataHash === index.dataHash,
          `${source.name} dataHash 与 aaa.pk 不匹配。`);
      }
      const reader = new RhoReader(source, index);
      const mountPath = mount?.mountPath ?? source.name.replace(/\.rho$/i, "");
      const containerId = `rho:${rhoContainerId++}`;
      (state.archiveIndexes.rho as RhoArchiveIndex[]).push(index);
      state.archives.push({ name: index.name, type: "Rho",
        version: typeof index.version === "string" ? index.version : "unknown",
        fileCount: reader.files.length, mountPath, partCount: 1 });
      reader.files.forEach((file, sourceOrdinal) => {
        const name = typeof (index.files[sourceOrdinal] as { name?: unknown }).name === "string" ?
          (index.files[sourceOrdinal] as { name: string }).name : fileName(file.path);
        const bytes = () => reader.readRecord(file);
        addEntry({ name, extension: extension(name), size: file.size,
          sourceName: source.name, sourceKind: "rho", containerId,
          absenceAuthoritative: true, sourceOrdinal, bytes,
          text: async () => entryText(await bytes()) }, joinPath(mountPath, file.path));
      });
    } catch (error) {
      state.errors.push(`${source.name}: ${String(error)}`);
    } finally {
      current = progress(onProgress, current, total, source.name);
    }
  }

  const groups = new Map<string, SwSource[]>();
  for (const source of rho5Sources) {
    const match = /^(DataPack\d+)_\d{5}\.rho5$/i.exec(source.name);
    if (!match) continue;
    const group = match[1]!;
    groups.set(group, [...(groups.get(group) ?? []), source]);
  }
  for (const [group, parts] of groups) {
    try {
      const index = rho5Index.get(group.toLowerCase()) ??
        await scanRho5ArchiveIndex(parts, state.region === "unknown" ? undefined : state.region.toUpperCase());
      const reader = new Rho5Reader(index, parts);
      if (state.region === "unknown") state.region = index.region.toLowerCase();
      (state.archiveIndexes.rho5 as Rho5ArchiveIndex[]).push(index);
      state.archives.push({ name: index.name, type: "Rho5", version: "5",
        fileCount: reader.files.length, mountPath: "", partCount: parts.length });
      const partIds = [...index.parts].map(part => part.id).sort((a, b) => a - b);
      reader.files.forEach((file, sourceOrdinal) => {
        const part = index.parts.find(item => item.id === file.partId);
        requireValue(part, `${file.path} 指向缺失的分包。`);
        const name = fileName(file.path);
        const bytes = () => reader.readRecord(file);
        addEntry({ name, extension: extension(name), size: file.decompressedSize,
          sourceName: part.name, sourceKind: "rho5",
          containerId: `rho5:${group.toLowerCase()}`,
          absenceAuthoritative: authoritativeRho5(group, partIds),
          sourceOrdinal, bytes, text: async () => entryText(await bytes(), true) }, file.path);
      });
    } catch (error) {
      state.errors.push(`${group}: ${String(error)}`);
    } finally {
      current = progress(onProgress, current, total, group, parts.length);
    }
  }

  const looseRoot = commonLooseRoot(looseSources);
  for (const source of looseSources) {
    let pending: Promise<Uint8Array> | undefined;
    const bytes = () => pending ??= source.arrayBuffer().then(buffer => new Uint8Array(buffer));
    addEntry({
      name: source.name,
      extension: extension(source.name),
      size: source.size,
      sourceName: source.webkitRelativePath || source.name,
      sourceKind: "loose",
      containerId: `loose:${looseRoot.toLowerCase()}`,
      absenceAuthoritative: false,
      bytes,
      text: async () => entryText(await bytes(), true),
    }, loosePath(source, looseRoot));
    current = progress(onProgress, current, total, source.name);
  }

  state.files.sort((a, b) => a.virtualPath.localeCompare(b.virtualPath));
  return new Sw(state);
}
