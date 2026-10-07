/** Sequential little-endian reader for the game's track.1s records. */
export class TrackBinaryCursor {
  readonly view: DataView;
  position = 0;

  constructor(readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  get remaining(): number { return this.data.length - this.position; }

  skip(length: number): void {
    this.require(length);
    this.position += length;
  }

  bytes(length: number): Uint8Array {
    this.require(length);
    const result = this.data.slice(this.position, this.position + length);
    this.position += length;
    return result;
  }

  uint8(): number {
    this.require(1);
    return this.data[this.position++]!;
  }

  int16(): number {
    this.require(2);
    const value = this.view.getInt16(this.position, true);
    this.position += 2;
    return value;
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

  string(): string {
    const length = this.count("字符串", 1e5);
    try {
      return new TextDecoder("utf-16le", { fatal: true })
        .decode(this.bytes(length * 2));
    } catch {
      throw new Error("track.1s 包含无效 UTF-16LE 字符串。");
    }
  }

  count(label: string, limit: number): number {
    const value = this.uint32();
    if (value > limit) throw new Error(`${label}数量 ${value} 无效。`);
    return value;
  }

  uint16Count(label: string, limit: number): number {
    const value = this.uint16();
    if (value > limit) throw new Error(`${label}数量 ${value} 无效。`);
    return value;
  }

  isNewObject(): boolean {
    return this.position + 8 <= this.data.length &&
      this.data[this.position] === 170 && this.data[this.position + 1] === 71;
  }

  peekUint32(offset: number): number {
    this.require(offset + 4);
    return this.view.getUint32(this.position + offset, true);
  }

  require(length: number): void {
    if (!Number.isSafeInteger(length) || length < 0 ||
        this.position + length > this.data.length)
      throw new Error(`track.1s 在 0x${this.position.toString(16)} 意外结束。`);
  }
}

const NEW_OBJECT = 18346;
const OBJECT_REFERENCE = 18363;
const NEW_FIELD = 10154;
const FIELD_REFERENCE = 10171;

export type ObjectOccurrence<T> = {
  encoding: "new" | "reference"; id: number; value: T;
};

/** Resolves indexed object and field occurrences in a track.1s stream. */
export class TrackObjectRegistry {
  objects = new Map<number, unknown>();
  fields = new Map<number, unknown>();
  objectIds = new Set<number>();
  fieldIds = new Set<number>();
  decoders = new Map<number,
    (cursor: TrackBinaryCursor, registry: TrackObjectRegistry) => unknown>();

  register(classStamp: number,
    decode: (cursor: TrackBinaryCursor, registry: TrackObjectRegistry) => unknown): void {
    this.decoders.set(classStamp >>> 0, decode);
  }

  // The class stamp selects a runtime decoder, so callers know the concrete
  // shape only after checking the decoded object's kind.
  readObject<T = any>(cursor: TrackBinaryCursor): T {
    return this.readObjectOccurrence<T>(cursor).value;
  }

  readObjectOccurrence<T = any>(cursor: TrackBinaryCursor): ObjectOccurrence<T> {
    const offset = cursor.position;
    const marker = cursor.uint16();
    if (marker === OBJECT_REFERENCE) {
      const id = cursor.uint16();
      if (!this.objects.has(id)) throw new Error(`未知对象引用 ${id}。`);
      return { encoding: "reference", id, value: this.objects.get(id) as T };
    }
    if (marker !== NEW_OBJECT)
      throw new Error(`0x${offset.toString(16)} 不是 KartObject（标记 0x${marker.toString(16)}）。`);
    const classStamp = cursor.uint32();
    const id = cursor.uint16();
    if (this.objectIds.has(id)) throw new Error(`重复对象索引 ${id}。`);
    this.objectIds.add(id);
    const decode = this.decoders.get(classStamp);
    if (!decode) throw new Error(`不支持 ClassStamp 0x${classStamp.toString(16)}。`);
    const value = decode(cursor, this) as T;
    this.objects.set(id, value);
    return { encoding: "new", id, value };
  }

  readField<T = unknown>(cursor: TrackBinaryCursor,
    decode: (cursor: TrackBinaryCursor, registry: TrackObjectRegistry) => T): T {
    return this.readFieldOccurrence(cursor, decode).value;
  }

  readFieldOccurrence<T = unknown>(cursor: TrackBinaryCursor,
    decode: (cursor: TrackBinaryCursor, registry: TrackObjectRegistry) => T):
    ObjectOccurrence<T> {
    const offset = cursor.position;
    const marker = cursor.uint16();
    if (marker === FIELD_REFERENCE) {
      const id = cursor.uint16();
      if (!this.fields.has(id))
        throw new Error(`0x${offset.toString(16)} 存在未知字段引用 ${id}。`);
      return { encoding: "reference", id, value: this.fields.get(id) as T };
    }
    if (marker !== NEW_FIELD)
      throw new Error(`0x${offset.toString(16)} 不是索引字段。`);
    const id = cursor.uint16();
    if (this.fieldIds.has(id)) throw new Error(`重复字段索引 ${id}。`);
    this.fieldIds.add(id);
    const value = decode(cursor, this);
    this.fields.set(id, value);
    return { encoding: "new", id, value };
  }
}
