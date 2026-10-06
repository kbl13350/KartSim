/** Browser-compatible MD5 for validating decoded Rho5 payloads. */
const SHIFTS = new Uint8Array([
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]);

const TABLE = Uint32Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

export function md5(bytes: Uint8Array): Uint8Array {
  const state = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]);
  const words = new Uint32Array(16);
  const process = (block: Uint8Array): void => {
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(i * 4, true);
    let a = state[0]!, b = state[1]!, c = state[2]!, d = state[3]!;
    for (let i = 0; i < 64; i++) {
      let f: number, index: number;
      if (i < 16) { f = (b & c) | (~b & d); index = i; }
      else if (i < 32) { f = (d & b) | (~d & c); index = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; index = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); index = (7 * i) % 16; }
      const sum = (a + f + TABLE[i]! + words[index]!) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotateLeft(sum, SHIFTS[i]!)) >>> 0;
    }
    state[0] = (state[0]! + a) >>> 0;
    state[1] = (state[1]! + b) >>> 0;
    state[2] = (state[2]! + c) >>> 0;
    state[3] = (state[3]! + d) >>> 0;
  };

  let offset = 0;
  while (offset + 64 <= bytes.length) {
    process(bytes.subarray(offset, offset + 64));
    offset += 64;
  }
  const remaining = bytes.length - offset;
  const tail = new Uint8Array(remaining < 56 ? 64 : 128);
  tail.set(bytes.subarray(offset));
  tail[remaining] = 0x80;
  const view = new DataView(tail.buffer);
  const bits = bytes.length * 8;
  view.setUint32(tail.length - 8, bits >>> 0, true);
  view.setUint32(tail.length - 4, Math.floor(bits / 0x100000000) >>> 0, true);
  process(tail.subarray(0, 64));
  if (tail.length === 128) process(tail.subarray(64));

  const result = new Uint8Array(16);
  const resultView = new DataView(result.buffer);
  for (let i = 0; i < 4; i++) resultView.setUint32(i * 4, state[i]!, true);
  return result;
}
