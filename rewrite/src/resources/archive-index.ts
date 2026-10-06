import type { ArchiveSource } from "./container-store";
import { ContainerStore } from "./container-store";
import { browserFetch, type ResourceFetch, type ResourceManifest } from "./manifest";

/** Only fields needed by this layer are typed; the binary codec owns record details. */
export interface RhoArchiveIndex {
  readonly name: string;
  readonly mediaSize: number;
  readonly files: readonly unknown[];
  readonly blocks: readonly unknown[];
  readonly [field: string]: unknown;
}

export interface Rho5PartIndex {
  readonly id: number;
  readonly name: string;
  readonly size: number;
}

export interface Rho5ArchiveIndex {
  readonly name: string;
  readonly region: string;
  readonly parts: readonly Rho5PartIndex[];
  readonly files: readonly unknown[];
  readonly [field: string]: unknown;
}

export interface ArchiveIndex {
  readonly rho: readonly RhoArchiveIndex[];
  readonly rho5: readonly Rho5ArchiveIndex[];
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function partName(name: string): RegExpMatchArray | null {
  return name.match(/^(DataPack\d+)_(\d{5})\.rho5$/i);
}

/** Bind a decoded index to one manifest revision, before a codec can access it. */
export function validateArchiveIndex(input: unknown, manifest: ResourceManifest): ArchiveIndex {
  if (!object(input) || input.version !== manifest.version ||
      input.revision !== manifest.revision ||
      !Array.isArray(input.rho) || !Array.isArray(input.rho5)) {
    throw new Error("档案索引与资源清单版本或修订号不匹配。");
  }
  const expected = new Map(manifest.files.map(file => [file.name.toLowerCase(), file]));
  const covered = new Set<string>();
  if (!expected.has("aaa.pk")) throw new Error("资源清单缺少 aaa.pk。");
  covered.add("aaa.pk");

  const rho: RhoArchiveIndex[] = [];
  for (const item of input.rho) {
    if (!object(item) || typeof item.name !== "string" ||
        !item.name.toLowerCase().endsWith(".rho") ||
        !Number.isSafeInteger(item.mediaSize) ||
        !Array.isArray(item.files) || !Array.isArray(item.blocks)) {
      throw new Error("Rho 档案索引格式无效。");
    }
    const key = item.name.toLowerCase();
    const spec = expected.get(key);
    if (!spec || spec.size !== item.mediaSize || covered.has(key)) {
      throw new Error(`Rho 档案 ${item.name} 与资源清单不匹配。`);
    }
    covered.add(key);
    rho.push(item as unknown as RhoArchiveIndex);
  }

  const rho5: Rho5ArchiveIndex[] = [];
  const groups = new Set<string>();
  for (const item of input.rho5) {
    if (!object(item) || typeof item.name !== "string" ||
        !/^DataPack\d+$/i.test(item.name) ||
        typeof item.region !== "string" ||
        !Array.isArray(item.parts) || item.parts.length === 0 ||
        !Array.isArray(item.files)) {
      throw new Error("Rho5 档案索引格式无效。");
    }
    const group = item.name.toLowerCase();
    if (groups.has(group)) throw new Error(`Rho5 分包组重复：${item.name}。`);
    groups.add(group);
    const partIds = new Set<number>();
    for (const part of item.parts) {
      if (!object(part) || typeof part.name !== "string" ||
          !Number.isSafeInteger(part.id) || (part.id as number) < 0 ||
          !Number.isSafeInteger(part.size) || (part.size as number) <= 0) {
        throw new Error(`Rho5 ${item.name} 分包格式无效。`);
      }
      const match = partName(part.name);
      const key = part.name.toLowerCase();
      const spec = expected.get(key);
      if (!match || match[1]?.toLowerCase() !== group ||
          Number(match[2]) !== part.id || !spec || spec.size !== part.size ||
          covered.has(key) || partIds.has(part.id as number)) {
        throw new Error(`Rho5 分包 ${part.name} 与资源清单不匹配。`);
      }
      covered.add(key);
      partIds.add(part.id as number);
    }
    rho5.push(item as unknown as Rho5ArchiveIndex);
  }

  if (covered.size !== expected.size) {
    const missing = [...expected.keys()].find(name => !covered.has(name));
    throw new Error(`档案索引缺少资源清单容器：${missing}。`);
  }
  return { rho, rho5 };
}

/**
 * The archive-index endpoint is a zlib/deflate JSON stream. `$u8` objects in
 * that JSON stand for byte arrays (Rho headers and Rho5 payload MD5 values).
 */
export async function decodeArchiveIndex(
  compressed: ReadableStream<Uint8Array>,
  manifest: ResourceManifest,
): Promise<ArchiveIndex> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("当前浏览器不支持 DecompressionStream，无法读取档案索引。");
  }
  // lib.dom types the stream input as BufferSource; Uint8Array is valid at runtime.
  const inflater = new DecompressionStream("deflate") as unknown as
    ReadableWritablePair<Uint8Array, Uint8Array>;
  const json = await new Response(compressed.pipeThrough(inflater)).text();
  const raw = JSON.parse(json, (_key, value: unknown) => {
    if (!object(value) || typeof value.$u8 !== "string" ||
        Object.keys(value).length !== 1) return value;
    const binary = atob(value.$u8);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }) as unknown;
  return validateArchiveIndex(raw, manifest);
}

export async function loadArchiveIndex(
  manifest: ResourceManifest,
  fetcher: ResourceFetch = browserFetch,
  url = `/__${manifest.version}/archive-index`,
): Promise<ArchiveIndex> {
  const response = await fetcher(url, { cache: "no-store" });
  if (response.status !== 200 || !response.body) {
    throw new Error(`档案索引读取失败：HTTP ${response.status}。`);
  }
  return decodeArchiveIndex(response.body, manifest);
}

/** Physical sources and exact index records supplied to the Rho/Rho5 codec. */
export class ArchiveCatalog {
  readonly store: ContainerStore;
  readonly index: ArchiveIndex;
  private readonly rhoByName: Map<string, RhoArchiveIndex>;
  private readonly rho5ByName: Map<string, Rho5ArchiveIndex>;

  constructor(store: ContainerStore, index: ArchiveIndex) {
    this.store = store;
    this.index = index;
    this.rhoByName = new Map(index.rho.map(item => [item.name.toLowerCase(), item]));
    this.rho5ByName = new Map(index.rho5.map(item => [item.name.toLowerCase(), item]));
  }

  get mountManifest(): ArchiveSource { return this.store.source("aaa.pk"); }

  rho(name: string): { index: RhoArchiveIndex; source: ArchiveSource } {
    const index = this.rhoByName.get(name.toLowerCase());
    if (!index) throw new Error(`档案索引内找不到 Rho 容器 ${name}。`);
    return { index, source: this.store.source(index.name) };
  }

  rho5(groupName: string): { index: Rho5ArchiveIndex; parts: readonly ArchiveSource[] } {
    const index = this.rho5ByName.get(groupName.toLowerCase());
    if (!index) throw new Error(`档案索引内找不到 Rho5 分包组 ${groupName}。`);
    const parts = [...index.parts].sort((a, b) => a.id - b.id)
      .map(part => this.store.source(part.name));
    return { index, parts };
  }

  /** The codec owns virtual path mounting, decompression and payload checks. */
  codecInputs(): {
    mountManifest: ArchiveSource;
    rho: readonly { index: RhoArchiveIndex; source: ArchiveSource }[];
    rho5: readonly { index: Rho5ArchiveIndex; parts: readonly ArchiveSource[] }[];
  } {
    return {
      mountManifest: this.mountManifest,
      rho: this.index.rho.map(index => this.rho(index.name)),
      rho5: this.index.rho5.map(index => this.rho5(index.name)),
    };
  }
}
