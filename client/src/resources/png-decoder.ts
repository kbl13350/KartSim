import { unzlibSync } from "fflate";

export interface DecodedPng {
  width: number;
  height: number;
  pixels: Uint8Array;
}

const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const adam7: Array<[number, number, number, number]> = [
  [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
  [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
];

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function joinBytes(parts: Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { joined.set(part, offset); offset += part.length; }
  return joined;
}

function paeth(left: number, above: number, upperLeft: number): number {
  const prediction = left + above - upperLeft;
  const leftError = Math.abs(prediction - left);
  const aboveError = Math.abs(prediction - above);
  const upperLeftError = Math.abs(prediction - upperLeft);
  return leftError <= aboveError && leftError <= upperLeftError ? left
    : aboveError <= upperLeftError ? above : upperLeft;
}

function unfilterPass(inflated: Uint8Array, offset: number, width: number,
  height: number, channels: number): { pixels: Uint8Array; offset: number } {
  const rowBytes = width * channels;
  const length = (rowBytes + 1) * height;
  if (offset + length > inflated.length)
    throw new Error("PNG pass 超出 inflated payload。 ");
  const pixels = new Uint8Array(rowBytes * height);
  for (let row = 0; row < height; row++) {
    const start = offset + row * (rowBytes + 1);
    const filter = inflated[start]!;
    if (filter > 4) throw new Error(`PNG filter ${filter} 不受支持。`);
    for (let column = 0; column < rowBytes; column++) {
      const raw = inflated[start + 1 + column]!;
      const left = column >= channels ? pixels[row * rowBytes + column - channels]! : 0;
      const above = row > 0 ? pixels[(row - 1) * rowBytes + column]! : 0;
      const upperLeft = row > 0 && column >= channels
        ? pixels[(row - 1) * rowBytes + column - channels]! : 0;
      const decoded = filter === 0 ? raw
        : filter === 1 ? raw + left
          : filter === 2 ? raw + above
            : filter === 3 ? raw + Math.floor((left + above) / 2)
              : raw + paeth(left, above, upperLeft);
      pixels[row * rowBytes + column] = decoded & 255;
    }
  }
  return { pixels, offset: offset + length };
}

/** Decodes the RGB8/RGBA8 PNG subset used by the original toon textures. */
export async function decodePngRgba(bytes: Uint8Array): Promise<DecodedPng> {
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value))
    throw new Error("Toon environment resource 不是 PNG。 ");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, colorType = 0, interlace = 0;
  let hasHeader = false, hasEnd = false;
  const compressedChunks: Uint8Array[] = [];
  let position = 8;
  while (position + 12 <= bytes.length) {
    const length = view.getUint32(position);
    const typeStart = position + 4;
    const dataStart = position + 8;
    const dataEnd = dataStart + length;
    const next = dataEnd + 4;
    if (next > bytes.length) throw new Error("PNG chunk 超出 payload。 ");
    const type = String.fromCharCode(...bytes.subarray(typeStart, typeStart + 4));
    if (type === "IHDR" || type === "IDAT" || type === "IEND") {
      if (crc32(bytes.subarray(typeStart, dataEnd)) !== view.getUint32(dataEnd))
        throw new Error(`PNG ${type} CRC 不匹配。`);
    }
    if (type === "IHDR") {
      if (hasHeader || length !== 13) throw new Error("PNG IHDR 布局无效。 ");
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      if (width === 0 || height === 0) throw new Error("PNG dimensions 无效。 ");
      colorType = bytes[dataStart + 9]!;
      interlace = bytes[dataStart + 12]!;
      if (bytes[dataStart + 8] !== 8 || (colorType !== 2 && colorType !== 6) ||
          bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 ||
          (interlace !== 0 && interlace !== 1))
        throw new Error("目标 PNG 必须是 RGB8/RGBA8 且 interlace 为 none/Adam7。 ");
      hasHeader = true;
    } else if (type === "IDAT") {
      if (!hasHeader) throw new Error("PNG IDAT 位于 IHDR 前。 ");
      compressedChunks.push(bytes.slice(dataStart, dataEnd));
    } else if (type === "IEND") {
      hasEnd = true;
      position = next;
      break;
    }
    position = next;
  }
  if (!hasHeader || !hasEnd || compressedChunks.length === 0)
    throw new Error("PNG 缺少完整 IHDR/IDAT/IEND。 ");

  const compressed = joinBytes(compressedChunks);
  if (compressed.length < 6) throw new Error("PNG zlib 数据不完整。");
  const inflated = unzlibSync(compressed);
  let adlerA = 1, adlerB = 0;
  for (let offset = 0; offset < inflated.length; offset += 5552) {
    const end = Math.min(offset + 5552, inflated.length);
    for (let index = offset; index < end; index++) {
      adlerA += inflated[index]!;
      adlerB += adlerA;
    }
    adlerA %= 65521;
    adlerB %= 65521;
  }
  const storedAdler = new DataView(compressed.buffer, compressed.byteOffset,
    compressed.byteLength).getUint32(compressed.length - 4);
  if (((adlerB << 16) | adlerA) >>> 0 !== storedAdler)
    throw new Error("PNG zlib Adler-32 校验不匹配。");

  const channels = colorType === 6 ? 4 : 3;
  const pixels = new Uint8Array(width * height * channels);
  if (interlace === 0) {
    const pass = unfilterPass(inflated, 0, width, height, channels);
    if (pass.offset !== inflated.length)
      throw new Error("PNG inflated payload 大小不匹配。 ");
    pixels.set(pass.pixels);
  } else {
    let offset = 0;
    for (const [startX, startY, stepX, stepY] of adam7) {
      const passWidth = startX >= width ? 0 : Math.ceil((width - startX) / stepX);
      const passHeight = startY >= height ? 0 : Math.ceil((height - startY) / stepY);
      if (passWidth === 0 || passHeight === 0) continue;
      const pass = unfilterPass(inflated, offset, passWidth, passHeight, channels);
      offset = pass.offset;
      for (let row = 0; row < passHeight; row++) {
        for (let column = 0; column < passWidth; column++) {
          const source = (row * passWidth + column) * channels;
          const target = ((startY + row * stepY) * width +
            startX + column * stepX) * channels;
          pixels.set(pass.pixels.subarray(source, source + channels), target);
        }
      }
    }
    if (offset !== inflated.length)
      throw new Error("PNG Adam7 inflated payload 大小不匹配。 ");
  }
  if (colorType === 6) return { width, height, pixels };
  const rgba = new Uint8Array(width * height * 4);
  for (let source = 0, target = 0; source < pixels.length; source += 3, target += 4) {
    rgba[target] = pixels[source]!;
    rgba[target + 1] = pixels[source + 1]!;
    rgba[target + 2] = pixels[source + 2]!;
    rgba[target + 3] = 255;
  }
  return { width, height, pixels: rgba };
}
