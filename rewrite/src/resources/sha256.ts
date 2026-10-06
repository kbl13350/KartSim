// Incremental SHA-256 for checking a user-selected Data directory without
// loading large Rho containers (some exceed 300 MiB) into one ArrayBuffer.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const rotate = (value: number, count: number): number =>
  (value >>> count) | (value << (32 - count));

export class Sha256 {
  private readonly state = new Uint32Array(INITIAL);
  private readonly block = new Uint8Array(64);
  private readonly words = new Uint32Array(64);
  private blockLength = 0;
  private byteLength = 0;
  private finished = false;

  update(bytes: Uint8Array): this {
    if (this.finished) throw new Error("SHA-256 已完成，不能继续写入。");
    this.byteLength += bytes.byteLength;
    if (!Number.isSafeInteger(this.byteLength)) throw new RangeError("SHA-256 输入过大。");
    for (let offset = 0; offset < bytes.length;) {
      const length = Math.min(64 - this.blockLength, bytes.length - offset);
      this.block.set(bytes.subarray(offset, offset + length), this.blockLength);
      this.blockLength += length;
      offset += length;
      if (this.blockLength === 64) {
        this.compress();
        this.blockLength = 0;
      }
    }
    return this;
  }

  hex(): string {
    if (this.finished) throw new Error("SHA-256 已完成。");
    const originalLength = this.byteLength;
    const padLength = this.blockLength < 56 ? 56 - this.blockLength : 120 - this.blockLength;
    const padding = new Uint8Array(padLength + 8);
    padding[0] = 0x80;
    const view = new DataView(padding.buffer);
    view.setUint32(padLength, Math.floor(originalLength / 0x20000000) >>> 0);
    view.setUint32(padLength + 4, (originalLength * 8) >>> 0);
    this.update(padding);
    this.finished = true;
    return [...this.state].map(word => word.toString(16).padStart(8, "0")).join("");
  }

  private compress(): void {
    const w = this.words;
    for (let i = 0; i < 16; i++) {
      const j = i * 4;
      w[i] = ((this.block[j]! << 24) | (this.block[j + 1]! << 16) |
        (this.block[j + 2]! << 8) | this.block[j + 3]!) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3);
      const s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a: number = this.state[0]!;
    let b: number = this.state[1]!;
    let c: number = this.state[2]!;
    let d: number = this.state[3]!;
    let e: number = this.state[4]!;
    let f: number = this.state[5]!;
    let g: number = this.state[6]!;
    let h: number = this.state[7]!;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choose + K[i]! + w[i]!) >>> 0;
      const sigma0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    this.state[0] = (this.state[0]! + a) >>> 0;
    this.state[1] = (this.state[1]! + b) >>> 0;
    this.state[2] = (this.state[2]! + c) >>> 0;
    this.state[3] = (this.state[3]! + d) >>> 0;
    this.state[4] = (this.state[4]! + e) >>> 0;
    this.state[5] = (this.state[5]! + f) >>> 0;
    this.state[6] = (this.state[6]! + g) >>> 0;
    this.state[7] = (this.state[7]! + h) >>> 0;
  }
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const hash = new Sha256();
  const reader = blob.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return hash.hex();
      hash.update(value);
    }
  } finally {
    reader.releaseLock();
  }
}
