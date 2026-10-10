import type { ArchiveSource } from "../resources/container-store";
import type { Rho5ArchiveIndex, Rho5PartIndex } from "../resources/archive-index";
import { checkVirtualPath, inflateZlib, readExact, requireValue } from "./common";
import { md5 } from "./md5";

export const REGION_SECRET: Readonly<Record<string, string>> = {
  KR: "y&errfV6GRS!e8JL", CN: "d$Bjgfc8@dH4TQ?k", TW: "t5rHKg-g9BA7%=qD",
};

const add32 = (a: number, b: number): number => (a + b) >>> 0;
const rotateRight = (value: number, bits: number): number =>
  ((value >>> bits) | (value << (32 - bits))) >>> 0;
const rotateByte = (value: number, bits: number): number =>
  ((value << bits) | (value >>> (8 - bits))) & 255;
const doubleField = (value: number, reduction: number): number =>
  (((value << 1) & 255) ^ (value & 128 ? reduction : 0)) & 255;

function multiplyField(a: number, b: number): number {
  let result = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) result ^= a;
    a = doubleField(a, 27);
    b >>>= 1;
  }
  return result & 255;
}

function powerField(value: number, exponent: number): number {
  let result = 1;
  for (; exponent > 0; exponent >>>= 1) {
    if (exponent & 1) result = multiplyField(result, value);
    value = multiplyField(value, value);
  }
  return result;
}

function substitute(value: number): number {
  const inverse = value === 0 ? 0 : powerField(value, 254);
  return (inverse ^ rotateByte(inverse, 1) ^ rotateByte(inverse, 2) ^
    rotateByte(inverse, 3) ^ rotateByte(inverse, 4) ^ 99) & 255;
}

function iterateField(value: number, times: number): number {
  for (let i = 0; i < times; i++) value = doubleField(value, 169);
  return value;
}

let tables: readonly Uint32Array[] | undefined;
function cipherTables(): readonly Uint32Array[] {
  if (tables) return tables;
  const result = Array.from({ length: 6 }, () => new Uint32Array(256));
  for (let value = 0; value < 256; value++) {
    const substituteValue = substitute(value);
    const doubled = doubleField(substituteValue, 27);
    const word = ((doubled << 24) | ((doubled ^ substituteValue) << 16) |
      (substituteValue << 8) | substituteValue) >>> 0;
    result[0]![value] = word;
    result[1]![value] = rotateRight(word, 8);
    result[2]![value] = rotateRight(word, 16);
    result[3]![value] = rotateRight(word, 24);
    result[4]![value] = ((iterateField(value, 16) << 24) |
      (iterateField(value, 39) << 16) | (iterateField(value, 6) << 8) |
      iterateField(value, 64)) >>> 0;
    result[5]![value] = ((iterateField(value, 23) << 24) |
      (iterateField(value, 245) << 16) | (iterateField(value, 48) << 8) |
      iterateField(value, 239)) >>> 0;
  }
  tables = result;
  return result;
}

function cipherC(value: number): number {
  const t = cipherTables();
  return (t[0]![value >>> 24]! ^ t[1]![(value >>> 16) & 255]! ^
    t[2]![(value >>> 8) & 255]! ^ t[3]![value & 255]!) >>> 0;
}
function cipherL(value: number): number {
  return ((value << 8) ^ cipherTables()[5]![value >>> 24]!) >>> 0;
}
function cipherU(value: number): number {
  return ((value >>> 8) ^ cipherTables()[4]![value & 255]!) >>> 0;
}

// Each source byte is interpreted as signed before it is OR-ed into the word.
function signedBigEndianWord(key: Uint8Array, offset: number): number {
  let word = 0;
  for (let i = 0; i < 4; i++) {
    const signed = (key[offset + i]! << 24) >> 24;
    word = ((word << 8) | signed) >>> 0;
  }
  return word;
}

class Rho5Stream {
  private readonly state = new Uint32Array(16);
  private r1 = 0;
  private r2 = 0;

  constructor(key: Uint8Array) {
    requireValue(key.length >= 16, "Rho5 密钥不足 16 字节。");
    for (let i = 0; i < 4; i++) {
      const word = signedBigEndianWord(key, i * 4);
      this.state[15 - i] = word;
      this.state[11 - i] = ~word >>> 0;
      this.state[7 - i] = word;
      this.state[3 - i] = ~word >>> 0;
    }
    for (let i = 0; i < 32; i++) this.clock(true);
  }

  nextWord(): number { return this.clock(false); }

  private clock(warming: boolean): number {
    const feedback = warming ? (add32(this.r1, this.state[15]!) ^ this.r2) >>> 0 : 0;
    const next = (cipherL(this.state[0]!) ^ this.state[2]! ^
      cipherU(this.state[11]!) ^ feedback) >>> 0;
    const r1 = add32(this.r2, this.state[5]!);
    const r2 = cipherC(this.r1);
    this.state.copyWithin(0, 1);
    this.state[15] = next;
    this.r1 = r1;
    this.r2 = r2;
    return (add32(r1, next) ^ r2 ^ this.state[0]!) >>> 0;
  }
}

export function decipher(bytes: Uint8Array, key: Uint8Array): Uint8Array {
  const cipher = new Rho5Stream(key);
  const result = new Uint8Array(bytes.length);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const count = Math.min(4, bytes.length - offset);
    let word = 0;
    for (let i = 0; i < count; i++) word = (word | (bytes[offset + i]! << (8 * i))) >>> 0;
    word = (word - cipher.nextWord()) >>> 0;
    for (let i = 0; i < count; i++) result[offset + i] = (word >>> (8 * i)) & 255;
  }
  return result;
}

function fnv1a(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul((hash ^ text.charCodeAt(i)) >>> 0, 16777619) >>> 0;
  }
  return hash;
}

export function payloadKey(md5Bytes: Uint8Array, secret: string, path: string): Uint8Array {
  requireValue(md5Bytes.length === 16 && path.length > 0, "Rho5 载荷密钥参数无效。");
  const digits = [...String(fnv1a(secret))].map(char => char.charCodeAt(0) - 48);
  return Uint8Array.from({ length: 128 }, (_, index) => {
    const first = digits[index % digits.length]! & 1;
    const second = digits[(index + 1) % digits.length]!;
    const md5Index = (digits[(index + 2) % digits.length]! + index) & 15;
    const value = (((second + index) % 5) + md5Bytes[md5Index]! + first) & 255;
    const pathByte = path.charCodeAt(index % path.length) & 255;
    return (Math.imul(value, pathByte) + index) & 255;
  });
}

export interface Rho5FileRecord {
  readonly path: string;
  readonly partId: number;
  readonly pipelineFlags: number;
  readonly payloadStart: number;
  readonly compressedSize: number;
  readonly decompressedSize: number;
  readonly payloadMd5: Uint8Array;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(input: unknown): Rho5FileRecord {
  requireValue(object(input) && typeof input.path === "string" &&
    Number.isSafeInteger(input.partId) && Number.isSafeInteger(input.pipelineFlags) &&
    Number.isSafeInteger(input.payloadStart) && Number.isSafeInteger(input.compressedSize) &&
    Number.isSafeInteger(input.decompressedSize), "Rho5 文件索引无效。");
  checkVirtualPath(input.path);
  const md5Bytes = input.payloadMd5 instanceof Uint8Array ? input.payloadMd5 :
    object(input.payloadMd5) && typeof input.payloadMd5.$u8 === "string" ?
      Uint8Array.from(atob(input.payloadMd5.$u8), char => char.charCodeAt(0)) : undefined;
  requireValue(md5Bytes?.length === 16, `${input.path} 的 Rho5 MD5 无效。`);
  const result = { ...input, payloadMd5: md5Bytes } as unknown as Rho5FileRecord;
  requireValue(result.partId >= 0 && result.pipelineFlags >= 0 &&
    (result.pipelineFlags & ~7) === 0 && result.payloadStart >= 0 &&
    result.compressedSize >= 0 && result.decompressedSize >= 0 &&
    result.decompressedSize <= 512 * 1024 * 1024,
  `${result.path} 的 Rho5 载荷范围或属性无效。`);
  return result;
}

/** Reads payloads from an indexed Rho5 split archive, with final MD5 check. */
export class Rho5Reader {
  readonly index: Rho5ArchiveIndex;
  readonly files: readonly Rho5FileRecord[];
  private readonly sourcesById = new Map<number, ArchiveSource>();
  private readonly filesByPath = new Map<string, Rho5FileRecord>();
  private readonly decoded = new Map<string, Promise<Uint8Array>>();
  private readonly secret: string;

  constructor(index: Rho5ArchiveIndex, sources: readonly ArchiveSource[]) {
    this.index = index;
    const secret = REGION_SECRET[index.region.toUpperCase()];
    requireValue(secret, `未知的 Rho5 地区：${index.region}。`);
    this.secret = secret;
    requireValue(sources.length === index.parts.length, `${index.name} 分包数量不匹配。`);
    const sourceByName = new Map(sources.map(source => [source.name.toLowerCase(), source]));
    for (const part of index.parts) {
      this.registerPart(part, sourceByName);
    }
    const files: Rho5FileRecord[] = [];
    for (const raw of index.files) {
      const file = record(raw);
      const source = this.sourcesById.get(file.partId);
      requireValue(source && file.payloadStart + file.compressedSize <= source.size,
        `${file.path} 的 Rho5 载荷越界。`);
      requireValue(!this.filesByPath.has(file.path.toLowerCase()),
        `Rho5 文件路径重复：${file.path}。`);
      this.filesByPath.set(file.path.toLowerCase(), file);
      files.push(file);
    }
    this.files = files;
  }

  private registerPart(part: Rho5PartIndex, sources: Map<string, ArchiveSource>): void {
    const source = sources.get(part.name.toLowerCase());
    requireValue(source && source.size === part.size && !this.sourcesById.has(part.id),
      `${part.name} 与 Rho5 索引不匹配。`);
    this.sourcesById.set(part.id, source);
  }

  read(path: string): Promise<Uint8Array> {
    const file = this.filesByPath.get(path.toLowerCase());
    if (!file) return Promise.reject(new Error(`${this.index.name} 内找不到 ${path}。`));
    return this.readRecord(file);
  }

  readRecord(file: Rho5FileRecord): Promise<Uint8Array> {
    const key = file.path.toLowerCase();
    let pending = this.decoded.get(key);
    if (!pending) {
      pending = this.decodeRecord(file).catch(error => {
        this.decoded.delete(key);
        throw error;
      });
      this.decoded.set(key, pending);
    }
    return pending;
  }

  private async decodeRecord(file: Rho5FileRecord): Promise<Uint8Array> {
    const source = this.sourcesById.get(file.partId);
    requireValue(source, `${file.path} 指向缺失的 Rho5 分包。`);
    let bytes = await readExact(source, file.payloadStart, file.compressedSize);
    const key = payloadKey(file.payloadMd5, this.secret, file.path);
    if (file.pipelineFlags & 4) {
      const headSize = Math.min(1024, bytes.length);
      const head = decipher(bytes.subarray(0, headSize), key);
      const copy = bytes.slice();
      copy.set(head, 0);
      bytes = copy;
    }
    if (file.pipelineFlags & 2) bytes = decipher(bytes, key);
    if (file.pipelineFlags & 1) bytes = await inflateZlib(bytes, file.decompressedSize);
    requireValue(bytes.length === file.decompressedSize,
      `${file.path} 的 Rho5 解压长度不匹配。`);
    const digest = md5(bytes);
    requireValue(digest.every((value, index) => value === file.payloadMd5[index]),
      `${file.path} 的 Rho5 MD5 校验失败。`);
    return bytes;
  }
}
