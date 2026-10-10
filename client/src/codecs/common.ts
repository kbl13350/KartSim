import type { ArchiveSource } from "../resources/container-store";

export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function checkVirtualPath(path: string): void {
  requireValue(path.length > 0 && !path.startsWith("/") && !path.includes("\\") &&
    !/[\0-\x1f]/.test(path) &&
    path.split("/").every(part => part !== "" && part !== "." && part !== ".."),
  `不安全的虚拟路径：${path}。`);
}

export function joinPath(prefix: string, path: string): string {
  return prefix ? (path ? `${prefix}/${path}` : prefix) : path;
}

export async function readExact(source: ArchiveSource, offset: number, length: number): Promise<Uint8Array> {
  requireValue(Number.isSafeInteger(offset) && Number.isSafeInteger(length) &&
    offset >= 0 && length >= 0 && offset + length <= source.size,
  `${source.name} 读取范围越界：${offset}+${length}/${source.size}。`);
  const bytes = new Uint8Array(await source.slice(offset, offset + length).arrayBuffer());
  requireValue(bytes.length === length, `${source.name} 响应长度不足。`);
  return bytes;
}

/** The client's Rho checksum starts with a=0, unlike ordinary zlib Adler-32. */
export function rhoAdler32(bytes: Uint8Array, seed = 0): number {
  let a = seed & 0xffff, b = seed >>> 16;
  for (const value of bytes) {
    a = (a + value) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(first.length + second.length);
  bytes.set(first);
  bytes.set(second, first.length);
  return bytes;
}

/** Zlib-wrapped deflate, with a decoded-size cap before allocation grows. */
export async function inflateZlib(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  requireValue(typeof DecompressionStream !== "undefined", "浏览器不支持 DecompressionStream。");
  const attempt = async (inputBytes: Uint8Array): Promise<Uint8Array> => {
    const copy = new Uint8Array(inputBytes);
    const input = new Blob([copy.buffer as ArrayBuffer]).stream();
    const inflater = new DecompressionStream("deflate") as unknown as
      ReadableWritablePair<Uint8Array, Uint8Array>;
    const reader = input.pipeThrough(inflater).getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        requireValue(length <= maxBytes, `解压结果超过上限 ${maxBytes} 字节。`);
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  };

  try { return await attempt(bytes); }
  catch (originalError) {
    // Rho5 payloads may include up to three zero alignment bytes after the
    // zlib trailer. Native DecompressionStream rejects this trailing padding.
    for (let padding = 1; padding <= 3 && bytes[bytes.length - padding] === 0; padding++) {
      try { return await attempt(bytes.subarray(0, bytes.length - padding)); }
      catch { /* Try the next alignment length. */ }
    }
    throw originalError;
  }
}

export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2));
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
