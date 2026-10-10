/** Little-endian reader for vehicle and flying-pet model.1s resources. */
export class ModelBinaryCursor {
  readonly data: Uint8Array;
  readonly view: DataView;
  position = 0;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  get remaining(): number { return this.data.length - this.position; }

  bytes(length: number): Uint8Array {
    this.require(length);
    const value = this.data.slice(this.position, this.position + length);
    this.position += length;
    return value;
  }

  ensure(length: number): void { this.require(length); }

  uint8(): number {
    this.require(1);
    return this.data[this.position++]!;
  }

  uint16(): number {
    this.require(2);
    const value = this.view.getUint16(this.position, true);
    this.position += 2;
    return value;
  }

  uint32(): number {
    this.require(4);
    const value = this.view.getUint32(this.position, true);
    this.position += 4;
    return value;
  }

  float32(): number {
    this.require(4);
    const value = this.view.getFloat32(this.position, true);
    this.position += 4;
    return value;
  }

  vec2(): [number, number] { return [this.float32(), this.float32()]; }
  vec3(): [number, number, number] {
    return [this.float32(), this.float32(), this.float32()];
  }
  vec3Array(count: number): Array<[number, number, number]> {
    return Array.from({ length: count }, () => this.vec3());
  }
  bounds(): { min: [number, number, number]; max: [number, number, number] } {
    return { min: this.vec3(), max: this.vec3() };
  }
  uint16Triple(): [number, number, number] {
    return [this.uint16(), this.uint16(), this.uint16()];
  }

  count16(label: string, maximum: number): number {
    const count = this.uint16();
    if (count > maximum) throw new Error(`model.1s 的${label}数量无效。`);
    return count;
  }

  count32(label: string, maximum: number): number {
    const count = this.uint32();
    if (count > maximum) throw new Error(`model.1s 的${label}数量无效。`);
    return count;
  }

  string(): string {
    const codeUnits = this.count32("字符串 code unit", 1_000_000);
    const bytes = this.bytes(codeUnits * 2);
    try {
      return new TextDecoder("utf-16le", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("model.1s 包含无效 UTF-16LE 字符串。");
    }
  }

  require(length: number): void {
    if (!Number.isSafeInteger(length) || length < 0 ||
      this.position + length > this.data.length)
      throw new Error(`model.1s 在 0x${this.position.toString(16)} 意外结束。`);
  }
}
