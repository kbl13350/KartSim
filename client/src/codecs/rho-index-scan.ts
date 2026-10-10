import type { ArchiveSource } from "../resources/container-store";
import type { RhoArchiveIndex } from "../resources/archive-index";
import { inflateZlib, readExact, rhoAdler32 } from "./common";
import { rhoXor } from "./mount-manifest";
import { rho11Table } from "./rho11-table";

const HEADER_BYTES = 256;
const BLOCK_RECORD_BYTES = 32;
const MAX_ARCHIVE_SIZE = 512 * 1024 * 1024;
const MAX_BLOCKS = 100_000;
const MAX_FILES = 200_000;
const MAX_FILE_SIZE = 256 * 1024 * 1024;
const ROOT_FOLDER_INDEX = 0xffffffff;

export class RhoIndexScanError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RhoParseError";
    this.code = code;
  }
}

interface Block {
  index: number;
  offset: number;
  storedSize: number;
  logicalSize: number;
  processingFlags: number;
  checksum: number;
  rawWords: [number, number];
}

interface FileRecord {
  path: string;
  name: string;
  extension: string;
  size: number;
  fileProperty: number;
  dataIndex: number;
  dataKey: number;
}

function fail(code: string, message: string): never {
  throw new RhoIndexScanError(code, message);
}

function utf16Bytes(text: string): Uint8Array {
  const result = new Uint8Array(text.length * 2);
  const view = new DataView(result.buffer);
  for (let index = 0; index < text.length; index++)
    view.setUint16(index * 2, text.charCodeAt(index), true);
  return result;
}

function sourceKey(name: string): number {
  return (rhoAdler32(utf16Bytes(name.replaceAll(".rho", ""))) - 2800645477) >>> 0;
}

function xorBytes(bytes: Uint8Array, mask: Uint8Array): Uint8Array {
  return bytes.map((byte, index) => byte ^ mask[index % mask.length]!);
}

/** Rho 1.1 decodes 32-bit words with the fixed format table and a running sum. */
function decryptRho11(bytes: Uint8Array, key: number): Uint8Array {
  if (bytes.length % 4 !== 0)
    fail("RHO_WORD_ALIGNMENT", "加密数据未按 4 字节对齐。");
  const table = rho11Table();
  const decoded = new Uint8Array(bytes.length);
  const input = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const output = new DataView(decoded.buffer);
  let wordKey = key >>> 0;
  let sum = 0;
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const mask = (table[wordKey & 255]! ^
      table[256 + ((wordKey >>> 8) & 255)]! ^
      table[512 + ((wordKey >>> 16) & 255)]! ^
      table[768 + (wordKey >>> 24)]!) >>> 0;
    const value = (input.getUint32(offset, true) ^ mask ^ sum) >>> 0;
    output.setUint32(offset, value, true);
    sum = (sum + value) >>> 0;
    wordKey = (wordKey + 1) >>> 0;
  }
  return decoded;
}

function validateBlock(block: Block, archive: ArchiveSource): void {
  if ((block.processingFlags & ~15) !== 0)
    fail("RHO_BLOCK_PROPERTY",
      `${archive.name} 使用未知数据块属性 ${block.processingFlags}。`);
  if (block.offset % 256 !== 0 || block.logicalSize > MAX_FILE_SIZE ||
      block.offset < HEADER_BYTES || block.offset + block.storedSize > archive.size)
    fail("RHO_BLOCK_RANGE", `${archive.name} 的数据块范围无效。`);
}

async function decodeBlock(
  archive: ArchiveSource, blocks: Map<number, Block>, index: number, key: number,
): Promise<Uint8Array> {
  const block = blocks.get(index);
  if (!block) fail("RHO_MISSING_BLOCK", `${archive.name} 缺少数据块 ${index}。`);
  let bytes = await readExact(archive, block.offset, block.storedSize);
  if (block.processingFlags & 2) {
    try { bytes = await inflateZlib(bytes, MAX_FILE_SIZE); }
    catch { fail("RHO_ZLIB", `${archive.name} 的数据块 ${index} 解压失败。`); }
  }
  if (block.processingFlags & 4) bytes = rhoXor(bytes, key);
  if (block.processingFlags & 8)
    fail("RHO_SECONDARY_CIPHER",
      `${archive.name} 的数据块 ${index} 使用分析记录未给出算法的 flag 0x08。`);
  if (bytes.length !== block.logicalSize)
    fail("RHO_DECODED_SIZE", `${archive.name} 的数据块 ${index} 长度不匹配。`);
  if ((block.processingFlags & 1) !== 0 && rhoAdler32(bytes) !== block.checksum)
    fail("RHO_CHECKSUM", `${archive.name} 的数据块 ${index} 校验失败。`);
  return bytes;
}

function safeComponent(name: string, archive: ArchiveSource): string {
  if (!name || name === "." || name === ".." || /[\\/\0-\x1f]/.test(name))
    fail("RHO_UNSAFE_PATH", `${archive.name} 包含不安全路径。`);
  return name;
}

function extension(code: number): string {
  const bytes: number[] = [];
  for (let shift = 0; shift < 32; shift += 8) {
    const byte = (code >>> shift) & 255;
    if (byte === 0) break;
    if (byte < 32 || byte > 126)
      fail("RHO_EXTENSION", "Rho 文件扩展名无效。");
    bytes.push(byte);
  }
  return String.fromCharCode(...bytes);
}

class FolderReader {
  private readonly view: DataView;
  position = 0;

  constructor(private readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  uint32(): number {
    if (this.position + 4 > this.data.length)
      fail("RHO_TRUNCATED", "Rho 目录数据不完整。\n");
    const result = this.view.getUint32(this.position, true);
    this.position += 4;
    return result;
  }

  count(label: string): number {
    const count = this.uint32();
    if (count > MAX_FILES) fail("RHO_DIRECTORY_COUNT", `${label}数量无效。`);
    return count;
  }

  utf16Null(): string {
    const start = this.position;
    while (this.position + 2 <= this.data.length) {
      if (this.view.getUint16(this.position, true) === 0) {
        const result = new TextDecoder("utf-16le")
          .decode(this.data.subarray(start, this.position));
        this.position += 2;
        return result;
      }
      this.position += 2;
    }
    return fail("RHO_STRING", "Rho 目录字符串未终止。\n");
  }

  assertFinished(): void {
    if (this.position !== this.data.length)
      fail("RHO_DIRECTORY_RANGE", "Rho 目录数据块含未解析字节。\n");
  }
}

/** Scan a physical Rho 1.0/1.1 archive into the index consumed by RhoReader. */
export async function scanRhoArchiveIndex(
  archive: ArchiveSource, explicitKey?: number,
): Promise<RhoArchiveIndex> {
  if (archive.size < HEADER_BYTES || archive.size > MAX_ARCHIVE_SIZE)
    fail("RHO_SIZE", `${archive.name} 的文件大小无效。`);
  const header = await readExact(archive, 0, HEADER_BYTES);
  const signature = new TextDecoder("utf-16le").decode(header.subarray(0, 34));
  const versionNumber = signature === "Rh layer spec 1.0" ? 0 :
    signature === "Rh layer spec 1.1" ? 1 : -1;
  if (versionNumber < 0)
    fail("RHO_UNSUPPORTED", `${archive.name} 不是受支持的 Rho 1.0/1.1 档案。`);
  const key = explicitKey === undefined ? sourceKey(archive.name) : explicitKey >>> 0;
  const encrypted = header.slice(128, 256);
  const decodedHeader = versionNumber === 0 ? rhoXor(encrypted, key) :
    decryptRho11(encrypted, key);
  const view = new DataView(decodedHeader.buffer, decodedHeader.byteOffset, decodedHeader.byteLength);
  if (rhoAdler32(decodedHeader.subarray(4)) !== view.getUint32(0, true))
    fail("RHO_KEY_OR_MODIFICATION",
      `${archive.name} 的密钥不匹配；请选择对应 aaa.pk 或保留原始文件名。`);
  if (view.getUint32(4, true) !== 65536 + versionNumber)
    fail("RHO_VERSION", `${archive.name} 的内部版本码无效。`);
  const blockCount = view.getUint32(8, true);
  if (blockCount < 1 || blockCount > MAX_BLOCKS)
    fail("RHO_BLOCK_COUNT", `${archive.name} 的数据块数量无效。`);
  const blockTableEnd = HEADER_BYTES + blockCount * BLOCK_RECORD_BYTES;
  if (blockTableEnd > archive.size)
    fail("RHO_TRUNCATED", `${archive.name} 的数据块索引不完整。`);
  const blockSeed = view.getUint32(12, true);
  const legacyBlockMask = versionNumber === 0 ? decodedHeader.slice(16, 48) : undefined;
  const magicOffset = versionNumber === 0 ? 48 : 28;
  if (view.getUint32(magicOffset, true) !== 4229928824)
    fail("RHO_HEADER_MAGIC", `${archive.name} 的档案头结束标识无效。`);

  const encodedBlocks = await readExact(archive, HEADER_BYTES,
    blockCount * BLOCK_RECORD_BYTES);
  const blocks = new Map<number, Block>();
  let blockKey = (blockSeed ^ key) >>> 0;
  for (let index = 0; index < blockCount; index++) {
    const encoded = encodedBlocks.slice(index * BLOCK_RECORD_BYTES,
      (index + 1) * BLOCK_RECORD_BYTES);
    const decoded = versionNumber === 0 ? xorBytes(encoded, legacyBlockMask!) :
      decryptRho11(encoded, blockKey);
    blockKey = (blockKey + 1) >>> 0;
    const record = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
    const block: Block = {
      index: record.getUint32(0, true),
      offset: record.getUint32(4, true) * 256,
      storedSize: record.getUint32(8, true),
      logicalSize: record.getUint32(12, true),
      processingFlags: record.getUint32(16, true),
      checksum: record.getUint32(20, true),
      rawWords: [record.getUint32(24, true), record.getUint32(28, true)],
    };
    validateBlock(block, archive);
    if (blocks.has(block.index))
      fail("RHO_DUPLICATE_BLOCK", `${archive.name} 含有重复数据块。`);
    blocks.set(block.index, block);
  }
  const byOffset = [...blocks.values()].sort((left, right) => left.offset - right.offset);
  for (let index = 1; index < byOffset.length; index++)
    if (byOffset[index - 1]!.offset + byOffset[index - 1]!.storedSize >
        byOffset[index]!.offset)
      fail("RHO_BLOCK_OVERLAP", `${archive.name} 的数据块范围重叠。`);

  const files: FileRecord[] = [];
  const paths = new Set<string>();
  const folders = [{ index: ROOT_FOLDER_INDEX, path: "" }];
  const visited = new Set<number>();
  const directoryKey = (key + 630434289) >>> 0;
  for (let cursor = 0; cursor < folders.length; cursor++) {
    const folder = folders[cursor]!;
    if (visited.has(folder.index))
      fail("RHO_FOLDER_CYCLE", `${archive.name} 的目录索引存在循环。`);
    visited.add(folder.index);
    const reader = new FolderReader(await decodeBlock(archive, blocks,
      folder.index, directoryKey));
    const subfolders = reader.count("子目录");
    for (let index = 0; index < subfolders; index++) {
      const name = safeComponent(reader.utf16Null(), archive);
      const childIndex = reader.uint32();
      folders.push({ index: childIndex, path: folder.path ? `${folder.path}/${name}` : name });
    }
    const fileCount = reader.count("文件");
    if (files.length + fileCount > MAX_FILES)
      fail("RHO_FILE_COUNT", `${archive.name} 的文件数量超过上限。`);
    for (let index = 0; index < fileCount; index++) {
      const baseName = safeComponent(reader.utf16Null(), archive);
      const extensionCode = reader.uint32();
      const fileProperty = reader.uint32();
      const dataIndex = reader.uint32();
      const size = reader.uint32();
      if (size > MAX_FILE_SIZE)
        fail("RHO_FILE_SIZE", `${archive.name} 内 ${baseName} 的长度无效。`);
      const suffix = extension(extensionCode);
      const name = suffix ? `${baseName}.${suffix}` : baseName;
      const path = folder.path ? `${folder.path}/${name}` : name;
      if (paths.has(path))
        fail("RHO_DUPLICATE_PATH", `${archive.name} 内路径 ${path} 重复。`);
      paths.add(path);
      files.push({ path, name, extension: suffix, size, fileProperty, dataIndex,
        dataKey: (rhoAdler32(utf16Bytes(baseName)) + extensionCode + key - 1970136660) >>> 0 });
    }
    reader.assertFinished();
  }
  return {
    name: archive.name,
    version: versionNumber === 0 ? "1.0" : "1.1",
    key,
    mediaSize: archive.size,
    dataHash: versionNumber === 1 ? view.getUint32(24, true) : undefined,
    decodedHeader: decodedHeader.slice(),
    blocks: [...blocks.values()],
    files,
  };
}
