import type { ArchiveSource } from "../resources/container-store";
import type { RhoArchiveIndex } from "../resources/archive-index";
import { checkVirtualPath, concatBytes, inflateZlib, readExact, requireValue, rhoAdler32 } from "./common";
import { rhoXor } from "./mount-manifest";

export interface RhoBlock {
  readonly index: number;
  readonly offset: number;
  readonly storedSize: number;
  readonly logicalSize: number;
  readonly processingFlags: number;
  readonly checksum: number;
}

export interface RhoFileRecord {
  readonly path: string;
  readonly size: number;
  readonly dataIndex: number;
  readonly dataKey: number;
}

function uint32(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function blockRecord(input: unknown, size: number): RhoBlock {
  requireValue(object(input) && uint32(input.index) && uint32(input.processingFlags) &&
    uint32(input.checksum) && Number.isSafeInteger(input.offset) &&
    Number.isSafeInteger(input.storedSize) && Number.isSafeInteger(input.logicalSize),
  "Rho 数据块索引无效。");
  const block = input as unknown as RhoBlock;
  requireValue((block.processingFlags & ~15) === 0 &&
    block.offset >= 256 && block.offset % 256 === 0 &&
    block.storedSize >= 0 && block.logicalSize >= 0 &&
    block.logicalSize <= 256 * 1024 * 1024 &&
    block.offset + block.storedSize <= size,
  "Rho 数据块范围或属性无效。");
  return block;
}

function fileRecord(input: unknown): RhoFileRecord {
  requireValue(object(input) && typeof input.path === "string" &&
    Number.isSafeInteger(input.size) && uint32(input.dataIndex) && uint32(input.dataKey),
  "Rho 文件索引无效。");
  const record = input as unknown as RhoFileRecord;
  checkVirtualPath(record.path);
  requireValue(record.size >= 0 && record.size <= 256 * 1024 * 1024,
    `${record.path} 的长度无效。`);
  return record;
}

/** Reads indexed Rho 1.0/1.1 entries without scanning the container again. */
export class RhoReader {
  readonly source: ArchiveSource;
  readonly files: readonly RhoFileRecord[];
  private readonly blocks: Map<number, RhoBlock>;
  private readonly filesByPath: Map<string, RhoFileRecord>;
  private readonly decoded = new Map<string, Promise<Uint8Array>>();

  constructor(source: ArchiveSource, index: RhoArchiveIndex) {
    this.source = source;
    requireValue(source.name.toLowerCase() === index.name.toLowerCase() &&
      source.size === index.mediaSize,
    `${source.name} 与 Rho 索引不匹配。`);
    this.blocks = new Map();
    for (const raw of index.blocks) {
      const block = blockRecord(raw, source.size);
      requireValue(!this.blocks.has(block.index), `Rho 数据块 ${block.index} 重复。`);
      this.blocks.set(block.index, block);
    }
    this.filesByPath = new Map();
    const files: RhoFileRecord[] = [];
    for (const raw of index.files) {
      const file = fileRecord(raw);
      requireValue(!this.filesByPath.has(file.path.toLowerCase()),
        `Rho 文件路径重复：${file.path}。`);
      this.filesByPath.set(file.path.toLowerCase(), file);
      files.push(file);
    }
    this.files = files;
  }

  read(path: string): Promise<Uint8Array> {
    const record = this.filesByPath.get(path.toLowerCase());
    if (!record) return Promise.reject(new Error(`${this.source.name} 内找不到 ${path}。`));
    return this.readRecord(record);
  }

  readRecord(record: RhoFileRecord): Promise<Uint8Array> {
    const key = record.path.toLowerCase();
    let pending = this.decoded.get(key);
    if (!pending) {
      pending = this.decodeRecord(record).catch(error => {
        this.decoded.delete(key);
        throw error;
      });
      this.decoded.set(key, pending);
    }
    return pending;
  }

  private async decodeRecord(record: RhoFileRecord): Promise<Uint8Array> {
    const block = this.blocks.get(record.dataIndex);
    requireValue(block, `${record.path} 缺少 Rho 数据块。`);
    let bytes: Uint8Array;
    if (block.processingFlags === 4) {
      bytes = rhoXor(await readExact(this.source, block.offset, block.storedSize), record.dataKey);
      if (record.size > bytes.length) {
        const next = this.blocks.get((record.dataIndex + 1) >>> 0);
        requireValue(next && next.processingFlags === 0,
          `${record.path} 缺少明文续块。`);
        bytes = concatBytes(bytes, await readExact(this.source, next.offset, next.storedSize));
      }
    } else {
      bytes = await this.decodeBlock(block, record.dataKey);
    }
    requireValue(bytes.length === record.size, `${record.path} 的 Rho 文件长度不匹配。`);
    return bytes;
  }

  private async decodeBlock(block: RhoBlock, key: number): Promise<Uint8Array> {
    let bytes = await readExact(this.source, block.offset, block.storedSize);
    if (block.processingFlags & 2) {
      bytes = await inflateZlib(bytes, block.logicalSize);
    }
    if (block.processingFlags & 4) bytes = rhoXor(bytes, key);
    requireValue((block.processingFlags & 8) === 0,
      `${this.source.name} 使用未支持的 Rho 二级加密。`);
    requireValue(bytes.length === block.logicalSize,
      `${this.source.name} 的 Rho 数据块长度不匹配。`);
    if (block.processingFlags & 1) {
      requireValue(rhoAdler32(bytes) === block.checksum,
        `${this.source.name} 的 Rho Adler32 校验失败。`);
    }
    return bytes;
  }
}
