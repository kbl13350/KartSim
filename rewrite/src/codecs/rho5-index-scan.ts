import type { ArchiveSource } from "../resources/container-store";
import type { Rho5ArchiveIndex } from "../resources/archive-index";
import { readExact } from "./common";
import { decipher, REGION_SECRET } from "./rho5";

const PART_NAME = /^(DataPack\d+)_(\d{5})\.rho5$/i;
const MAX_PARTS = 512;
const MAX_PART_SIZE = 0x7fffffff;
const MAX_FILES_PER_PART = 100_000;
const MAX_FILES_PER_GROUP = 500_000;
const MAX_TABLE_BYTES = 64 * 1024 * 1024;

export class Rho5IndexScanError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "Rho5ParseError";
    this.code = code;
  }
}

interface ScannedFile {
  path: string;
  recordChecksum: number;
  pipelineFlags: number;
  payloadStart: number;
  compressedSize: number;
  decompressedSize: number;
  payloadMd5: Uint8Array;
}

interface ScannedPart {
  source: ArchiveSource;
  id: number;
  group: string;
}

function fail(code: string, message: string): never {
  throw new Rho5IndexScanError(code, message);
}

/** The release stores each encrypted header and table at a filename-derived offset. */
function locations(name: string): { header: number; table: number } {
  let sum = 0;
  for (const char of name.toLowerCase()) sum += char.charCodeAt(0);
  const header = sum % 312 + 30;
  return { header, table: header + (sum * 3) % 212 + 42 };
}

function headerSeed(name: string, secret: string): Uint8Array {
  const seed = `${name.toLowerCase()}${secret}`;
  return Uint8Array.from({ length: 128 }, (_, index) =>
    ((seed.charCodeAt(index % seed.length) & 255) + index) & 255);
}

function tableSeed(name: string, secret: string): Uint8Array {
  const seed = `${name.toLowerCase()}${secret}`;
  return Uint8Array.from({ length: 128 }, (_, index) => {
    const position = index % seed.length;
    return ((seed.charCodeAt(seed.length - position - 1) & 255) *
      (2 + index % 3) + index) & 255;
  });
}

function safePath(path: string, sourceName: string): string {
  if (!path || path.startsWith("/") || path.includes("\\") ||
      /[\0-\x1f]/.test(path) || path.split("/").some(part =>
        !part || part === "." || part === ".."))
    fail("RHO5_UNSAFE_PATH", `${sourceName} 包含不安全路径。`);
  return path;
}

class FileTableReader {
  private readonly view: DataView;
  position = 0;

  constructor(private readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  bytes(length: number): Uint8Array {
    if (this.position + length > this.data.length)
      fail("RHO5_TABLE_TRUNCATED", "Rho5 文件表读取长度不足。");
    const bytes = this.data.slice(this.position, this.position + length);
    this.position += length;
    return bytes;
  }

  uint32(): number {
    if (this.position + 4 > this.data.length)
      fail("RHO5_TABLE_TRUNCATED", "Rho5 文件表读取长度不足。");
    const result = this.view.getUint32(this.position, true);
    this.position += 4;
    return result;
  }

  utf16(characters: number): string {
    return new TextDecoder("utf-16le", { fatal: true })
      .decode(this.bytes(characters * 2));
  }
}

async function partHeader(source: ArchiveSource, secret: string): Promise<{
  fileCount: number; tableOffset: number;
}> {
  const { header, table } = locations(source.name);
  if (header + 9 > source.size || table >= source.size)
    fail("RHO5_HEADER_RANGE", `${source.name} 的档案头位置无效。`);
  const decoded = decipher(await readExact(source, header, 9),
    headerSeed(source.name, secret));
  const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
  const checksum = view.getUint32(0, true);
  const version = decoded[4]!;
  const fileCount = view.getUint32(5, true);
  if (version !== 2 || fileCount > MAX_FILES_PER_PART)
    fail("RHO5_HEADER", `${source.name} 的版本或文件数无效。`);
  if (checksum !== (version + fileCount) >>> 0)
    fail("RHO5_HEADER_CHECKSUM", `${source.name} 的档案头校验失败。`);
  return { fileCount, tableOffset: table };
}

function parseFileTable(
  decoded: Uint8Array, source: ArchiveSource, fileCount: number, tableOffset: number,
): ScannedFile[] {
  const reader = new FileTableReader(decoded);
  const records: (Omit<ScannedFile, "payloadStart"> & { offsetBlocks: number })[] = [];
  for (let index = 0; index < fileCount; index++) {
    const pathLength = reader.uint32();
    if (pathLength < 1 || pathLength > 4096)
      fail("RHO5_PATH_LENGTH", `${source.name} 的路径长度无效。`);
    const path = safePath(reader.utf16(pathLength), source.name);
    const recordChecksum = reader.uint32();
    const pipelineFlags = reader.uint32();
    const offsetBlocks = reader.uint32();
    const decompressedSize = reader.uint32();
    const compressedSize = reader.uint32();
    const payloadMd5 = reader.bytes(16);
    if ((pipelineFlags & ~7) !== 0)
      fail("RHO5_PIPELINE_FLAGS",
        `${path} 使用未知 pipeline flags 0x${pipelineFlags.toString(16)}。`);
    if (compressedSize > 256 * 1024 * 1024 || decompressedSize > 512 * 1024 * 1024)
      fail("RHO5_FILE_SIZE", `${path} 超过浏览器安全上限。`);
    let expected = (pipelineFlags + offsetBlocks + decompressedSize + compressedSize) >>> 0;
    for (const byte of payloadMd5) expected = (expected + byte) >>> 0;
    if (recordChecksum !== expected)
      fail("RHO5_FILE_CHECKSUM", `${path} 的文件索引校验失败。`);
    records.push({ path, recordChecksum, pipelineFlags, offsetBlocks,
      compressedSize, decompressedSize, payloadMd5 });
  }
  const dataBegin = Math.ceil((tableOffset + reader.position) / 1024) * 1024;
  if (!Number.isSafeInteger(dataBegin) || dataBegin > source.size)
    fail("RHO5_DATA_BEGIN", `${source.name} 的载荷起点无效。`);
  const files = records.map(record => {
    const payloadStart = dataBegin + record.offsetBlocks * 1024;
    if (!Number.isSafeInteger(payloadStart) || payloadStart < dataBegin ||
        payloadStart + record.compressedSize > source.size)
      fail("RHO5_PAYLOAD_RANGE", `${record.path} 的载荷范围无效。`);
    const { offsetBlocks: _unused, ...stored } = record;
    return { ...stored, payloadStart };
  });
  const byOffset = [...files].sort((left, right) => left.payloadStart - right.payloadStart);
  for (let index = 1; index < byOffset.length; index++)
    if (byOffset[index - 1]!.payloadStart + byOffset[index - 1]!.compressedSize >
        byOffset[index]!.payloadStart)
      fail("RHO5_PAYLOAD_OVERLAP", `${source.name} 的 payload 范围重叠。`);
  return files;
}

async function partFiles(source: ArchiveSource, region: string): Promise<ScannedFile[]> {
  const secret = REGION_SECRET[region];
  if (!secret) throw new Error(`未知的 Rho5 地区：${region}。`);
  const { fileCount, tableOffset } = await partHeader(source, secret);
  const remaining = source.size - tableOffset;
  let length = Math.min(remaining, Math.max(64 * 1024, fileCount * 192 + 1024));
  while (length <= Math.min(MAX_TABLE_BYTES, remaining)) {
    const decoded = decipher(await readExact(source, tableOffset, length),
      tableSeed(source.name, secret));
    try {
      return parseFileTable(decoded, source, fileCount, tableOffset);
    } catch (error) {
      if (!(error instanceof Rho5IndexScanError) ||
          error.code !== "RHO5_TABLE_TRUNCATED" ||
          length >= MAX_TABLE_BYTES || length >= remaining) throw error;
      length = Math.min(length * 2, MAX_TABLE_BYTES, remaining);
    }
  }
  return fail("RHO5_TABLE_SIZE", `${source.name} 的文件表超过安全上限。`);
}

async function detectRegion(source: ArchiveSource): Promise<string> {
  const candidates: string[] = [];
  for (const region of ["CN", "KR", "TW"]) {
    try { await partFiles(source, region); candidates.push(region); }
    catch { /* A wrong region cannot decrypt the header and table. */ }
  }
  if (candidates.length !== 1)
    fail("RHO5_REGION", `${source.name} 的区域无法唯一识别。`);
  return candidates[0]!;
}

/** Build an index from physical Rho5 parts when no manifest index is available. */
export async function scanRho5ArchiveIndex(
  sources: readonly ArchiveSource[], region?: string,
): Promise<Rho5ArchiveIndex> {
  if (sources.length === 0 || sources.length > MAX_PARTS)
    fail("RHO5_PART_COUNT", "Rho5 分包数量无效。");
  const parts: ScannedPart[] = sources.map(source => {
    const match = PART_NAME.exec(source.name);
    if (!match) fail("RHO5_FILENAME", `${source.name} 不符合 Rho5 分包命名。`);
    if (source.size <= 0 || source.size > MAX_PART_SIZE)
      fail("RHO5_PART_SIZE", `${source.name} 的大小无效。`);
    return { source, group: match[1]!, id: Number(match[2]) };
  });
  const name = parts[0]!.group;
  if (parts.some(part => part.group.toLowerCase() !== name.toLowerCase()))
    fail("RHO5_MIXED_GROUPS", "一次解析只能包含同一 DataPack 组。");
  const ids = new Set<number>();
  for (const part of parts) {
    if (ids.has(part.id)) fail("RHO5_DUPLICATE_PART", `${name} 包含重复分包 ${part.id}。`);
    ids.add(part.id);
  }
  parts.sort((left, right) => left.id - right.id);
  const selectedRegion = region ?? await detectRegion(parts[0]!.source);
  const files: (ScannedFile & { partId: number })[] = [];
  const paths = new Set<string>();
  for (const part of parts) {
    for (const file of await partFiles(part.source, selectedRegion)) {
      if (paths.has(file.path))
        fail("RHO5_DUPLICATE_PATH", `${file.path} 在多个分包中重复。`);
      paths.add(file.path);
      files.push({ ...file, partId: part.id });
      if (files.length > MAX_FILES_PER_GROUP)
        fail("RHO5_FILE_COUNT", "Rho5 文件总数超过上限。");
    }
  }
  return {
    name,
    region: selectedRegion,
    parts: parts.map(part => ({ name: part.source.name, size: part.source.size, id: part.id })),
    files,
  };
}
