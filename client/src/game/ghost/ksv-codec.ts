import type { GhostFrame, GhostFrameRecord } from "./frame-codec";

/** The outer KSV file is a length prefix, a KRData envelope, and a record body. */
export interface KsvCompression {
  deflate(bytes: Uint8Array, options: { level: number }): Uint8Array;
  inflate(bytes: Uint8Array): Uint8Array;
}

export interface KsvEquipment {
  character: number;
  paint?: number;
  kartPaint?: number;
  characterColor?: number;
  kart: number;
  plate: number;
  goggle: number;
  balloon: number;
  equ2: number;
  headband: number;
  replay: number;
  cane: number;
  equ3: number;
  apparel: number;
  equ4: number;
  plateText: string;
  startSlot: number;
  unknownPlayerFlag: number;
  equ5: number;
  equ6: number;
  equ7: number;
  equ8: number;
  equ9: number;
  equ10: number;
  equ11?: number;
  equ12?: number;
}

export interface KsvPlayer {
  playerName: string;
  clubName: string;
  equipment: KsvEquipment;
}

export interface KsvRecording {
  headerVersion: number;
  recordTitle: string;
  regionCode: number;
  unknown1_1: number;
  contestType: number;
  playerNameHash: number;
  unknown1_2: number;
  recorderAccount: string;
  recorderName: string;
  recordingDateDays: number;
  recordingDateTime: number;
  recordChecksum: number;
  isOfficial: boolean;
  description: string;
  trackName: string;
  unknown3: number;
  bestTimeMs: number;
  contestImg: string;
  opaqueBlob: Uint8Array;
  unknown6: number;
  speed?: number;
  unknown7: number;
  players: KsvPlayer[];
  recordVersion: number;
  records: GhostFrameRecord[];
}

const SUPPORTED_VERSIONS = [8, 9, 11, 12];
const KRDATA_MARKER = 83;
const ENCRYPTION_SEED = 912888630;

/** The release client's Adler variant starts at zero, including both sums. */
export function ksvAdler32(bytes: Uint8Array): number {
  let low = 0;
  let high = 0;
  for (const byte of bytes) {
    low = (low + byte) % 65521;
    high = (high + low) % 65521;
  }
  return ((high << 16) | low) >>> 0;
}

export function ksvVersionHash(version: number, kind: "header" | "record"): number {
  const suffix = kind === "header" ? "Header" : "";
  return ksvAdler32(new TextEncoder().encode(`KartRecord${version}${suffix}`));
}

function versionFromHash(hash: number, kind: "header" | "record"): number | undefined {
  return SUPPORTED_VERSIONS.find(version => ksvVersionHash(version, kind) === hash);
}

function recognizedVersion(hash: number, kind: "header" | "record"): number | undefined {
  for (let version = 0; version <= 20; version += 1) {
    if (ksvVersionHash(version, kind) === hash) return version;
  }
}

/** Release KRData XOR stream: a repeating 64-byte key derived from its seed. */
export function xorKrData(bytes: Uint8Array, seed: number): Uint8Array {
  const key = new Uint8Array(64);
  const keyView = new DataView(key.buffer);
  let word = (seed ^ 2222193601) >>> 0;
  for (let index = 0; index < 16; index += 1) {
    keyView.setUint32(index * 4, word, true);
    word = (word - 2072773695) >>> 0;
  }
  const output = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    output[index] = bytes[index]! ^ key[index & 63]!;
  }
  return output;
}

/** Decode all four KRData flag combinations (raw/compressed, clear/XOR). */
export function decodeKrData(bytes: Uint8Array, compression: KsvCompression): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 6) throw new Error("KSV KRData 不足头部。");
  if (bytes[0] !== KRDATA_MARKER) throw new Error("KSV 不是 KRData 格式。");
  const flags = bytes[1]!;
  const checksum = view.getUint32(2, true);
  let offset = 6;
  const encrypted = (flags & 2) === 2;
  const compressed = (flags & 1) === 1;
  const seed = encrypted ? view.getUint32(offset, true) : 0;
  if (encrypted) offset += 4;
  const expectedLength = compressed ? view.getInt32(offset, true) : 0;
  if (compressed) offset += 4;
  const payload = encrypted ? xorKrData(bytes.subarray(offset), seed) : bytes.subarray(offset);
  const decoded = compressed ? compression.inflate(payload) : Uint8Array.from(payload);
  if (compressed && decoded.length !== expectedLength) {
    throw new Error(`KSV 解压长度 ${decoded.length} 与头部 ${expectedLength} 不匹配。`);
  }
  if (ksvAdler32(decoded) !== checksum) throw new Error("KSV KRData 校验失败。");
  return decoded;
}

/** Write the release v12 KRData form: level-9 zlib, XOR, length and checksum. */
export function encodeKrData(bytes: Uint8Array, compression: KsvCompression): Uint8Array {
  const compressed = compression.deflate(bytes, { level: 9 });
  const payload = xorKrData(compressed, ENCRYPTION_SEED);
  const result = new Uint8Array(14 + payload.length);
  const view = new DataView(result.buffer);
  result[0] = KRDATA_MARKER;
  result[1] = 3;
  view.setUint32(2, ksvAdler32(bytes), true);
  view.setUint32(6, ENCRYPTION_SEED, true);
  view.setInt32(10, bytes.length, true);
  result.set(payload, 14);
  return result;
}

class KsvReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number { return this.bytes.length - this.offset; }
  private requireBytes(count: number): void {
    if (this.offset + count > this.bytes.length) throw new Error("KSV 读取越界。");
  }
  u8(): number { this.requireBytes(1); return this.bytes[this.offset++]!; }
  i16(): number { this.requireBytes(2); const value = this.view.getInt16(this.offset, true); this.offset += 2; return value; }
  u16(): number { this.requireBytes(2); const value = this.view.getUint16(this.offset, true); this.offset += 2; return value; }
  i32(): number { this.requireBytes(4); const value = this.view.getInt32(this.offset, true); this.offset += 4; return value; }
  u32(): number { this.requireBytes(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  bytesOfLength(count: number): Uint8Array {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("KSV 字节字段长度无效。");
    this.requireBytes(count);
    const result = this.bytes.slice(this.offset, this.offset + count);
    this.offset += count;
    return result;
  }
  blob(): Uint8Array { return this.bytesOfLength(this.u32()); }
  string(): string {
    const length = this.i32();
    if (length < 0) throw new Error("KSV 字符串长度无效。");
    this.requireBytes(length * 2);
    let result = "";
    for (let index = 0; index < length; index += 1) {
      result += String.fromCharCode(this.view.getUint16(this.offset, true));
      this.offset += 2;
    }
    return result;
  }
}

class KsvWriter {
  private readonly chunks: Uint8Array[] = [];
  u8(value: number): void { this.chunks.push(Uint8Array.of(value & 255)); }
  i16(value: number): void {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value & 65535, true);
    this.chunks.push(bytes);
  }
  u16(value: number): void { this.i16(value); }
  i32(value: number): void {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setInt32(0, value | 0, true);
    this.chunks.push(bytes);
  }
  u32(value: number): void {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    this.chunks.push(bytes);
  }
  bytes(bytes: Uint8Array): void { this.chunks.push(Uint8Array.from(bytes)); }
  blob(bytes: Uint8Array): void { this.u32(bytes.byteLength); this.bytes(bytes); }
  string(value: string): void {
    this.i32(value.length);
    const bytes = new Uint8Array(value.length * 2);
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < value.length; index += 1) {
      view.setUint16(index * 2, value.charCodeAt(index), true);
    }
    this.chunks.push(bytes);
  }
  finish(): Uint8Array {
    let length = 0;
    for (const chunk of this.chunks) length += chunk.length;
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of this.chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  }
}

const OLD_EQUIPMENT = [
  "character", "paint", "kart", "plate", "goggle", "balloon", "equ2",
  "headband", "replay", "cane", "equ3", "apparel", "equ4",
] as const;
const NEW_EQUIPMENT = [
  "character", "kartPaint", "characterColor", "kart", "plate", "goggle",
  "balloon", "equ2", "headband", "replay", "cane", "equ3", "apparel", "equ4",
] as const;
const OLD_EXTRA = ["equ5", "equ6", "equ7", "equ8", "equ9", "equ10"] as const;
const NEW_EXTRA = [...OLD_EXTRA, "equ11", "equ12"] as const;

function readEquipment(reader: KsvReader, version: number): KsvEquipment {
  const fields = version <= 9 ? OLD_EQUIPMENT : NEW_EQUIPMENT;
  const equipment: Record<string, number | string> = {};
  for (const field of fields) equipment[field] = reader.i16();
  equipment.plateText = reader.string();
  equipment.startSlot = reader.u8();
  equipment.unknownPlayerFlag = reader.u8();
  for (const field of version <= 9 ? OLD_EXTRA : NEW_EXTRA) equipment[field] = reader.i16();
  return equipment as unknown as KsvEquipment;
}

function writeEquipment(writer: KsvWriter, equipment: KsvEquipment, version: number): void {
  if (version <= 9 && "kartPaint" in equipment) {
    throw new Error("KSV v8/v9 装备不能携带 v10 的 kartPaint 槽位。");
  }
  if (version > 9 && !("kartPaint" in equipment)) {
    throw new Error("KSV v11/v12 装备缺少 v10 引入的 kartPaint 槽位。");
  }
  for (const field of version <= 9 ? OLD_EQUIPMENT : NEW_EQUIPMENT) {
    writer.i16(equipment[field] as number);
  }
  writer.string(equipment.plateText);
  writer.u8(equipment.startSlot);
  writer.u8(equipment.unknownPlayerFlag);
  for (const field of version <= 9 ? OLD_EXTRA : NEW_EXTRA) {
    writer.i16(equipment[field] as number);
  }
}

function readFrame(reader: KsvReader, zCeiling: number): GhostFrame {
  return {
    time: reader.i16(), x: reader.i16(), y: reader.i16(),
    z: zCeiling > 1500 ? reader.i32() : reader.i16(),
    w: reader.i16(), qx: reader.i16(), qy: reader.i16(), qz: reader.i16(),
    status: reader.u16(),
  };
}

function writeFrame(writer: KsvWriter, frame: GhostFrame, zCeiling: number): void {
  writer.i16(frame.time); writer.i16(frame.x); writer.i16(frame.y);
  if (zCeiling > 1500) writer.i32(frame.z);
  else writer.i16(frame.z);
  writer.i16(frame.w); writer.i16(frame.qx); writer.i16(frame.qy); writer.i16(frame.qz);
  writer.u16(frame.status);
}

function utf16le(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < value.length; index += 1) {
    view.setUint16(index * 2, value.charCodeAt(index), true);
  }
  return bytes;
}

function playerNameHash(players: readonly KsvPlayer[]): number {
  let hash = 0;
  for (const player of players) hash = (hash + ksvAdler32(utf16le(player.playerName))) >>> 0;
  return hash;
}

function recordChecksum(records: readonly GhostFrameRecord[]): number {
  let odd = 0;
  let even = 0;
  for (const record of records) {
    for (let index = 0; index < record.stamps.length; index += 1) {
      if ((index & 1) === 1) odd = (odd + record.stamps[index]!.status) >>> 0;
      else even = (even + record.stamps[index]!.status) >>> 0;
    }
  }
  return (((odd << 16) >>> 0) + even) >>> 0;
}

/** Parse the uncompressed KartRecord body, including equipment and all frames. */
export function decodeKsvBody(bytes: Uint8Array, zCeiling: number): KsvRecording {
  const reader = new KsvReader(bytes);
  const headerHash = reader.u32();
  const headerVersion = versionFromHash(headerHash, "header");
  if (headerVersion === undefined) {
    const recognized = recognizedVersion(headerHash, "header");
    throw new Error(`KSV header 版本不受支持（${headerHash.toString(16)}${recognized === undefined ? "" : ` = KartRecord${recognized}Header`}）。`);
  }
  const recordTitle = reader.string();
  const regionCode = reader.i16();
  const unknown1_1 = reader.u8();
  const contestType = reader.u8();
  const hash = reader.u32();
  const unknown1_2 = reader.u32();
  const recorderAccount = reader.string();
  const recorderName = reader.string();
  const recordingDateDays = reader.u16();
  const recordingDateTime = reader.u16();
  const checksum = reader.u32();
  const isOfficial = reader.u8() === 1;
  const description = reader.string();
  const trackName = reader.string();
  const unknown3 = reader.i32();
  const bestTimeMs = reader.i32();
  const contestImg = reader.string();
  const opaqueBlob = headerVersion >= 12 ? reader.blob() : reader.bytesOfLength(8);
  const unknown6 = reader.u8();
  const speed = headerVersion >= 9 ? reader.u8() : undefined;
  const unknown7 = headerVersion >= 12 ? reader.u8() : 0;
  const playerCount = reader.u32();
  const players: KsvPlayer[] = [];
  for (let index = 0; index < playerCount; index += 1) {
    players.push({
      playerName: reader.string(),
      clubName: reader.string(),
      equipment: readEquipment(reader, headerVersion),
    });
  }
  const recordHash = reader.u32();
  const recordVersion = versionFromHash(recordHash, "record");
  if (recordVersion === undefined) {
    const recognized = recognizedVersion(recordHash, "record");
    throw new Error(`KSV record 版本不受支持（${recordHash.toString(16)}${recognized === undefined ? "" : ` = KartRecord${recognized}`}）。`);
  }
  if (recordVersion !== headerVersion) {
    throw new Error(`KSV header v${headerVersion} 与 record v${recordVersion} 版本不匹配。`);
  }
  const recordCount = reader.i32();
  if (recordCount < 0) throw new Error("KSV 记录条数无效。");
  const records: GhostFrameRecord[] = [];
  for (let index = 0; index < recordCount; index += 1) {
    const frameCount = reader.i32();
    if (frameCount < 0) throw new Error("KSV 帧数无效。");
    const stamps: GhostFrame[] = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      stamps.push(readFrame(reader, zCeiling));
    }
    records.push({ stamps });
  }
  if (reader.remaining !== 0) throw new Error("KSV 头部解析后有剩余字节。");
  return {
    headerVersion, recordTitle, regionCode, unknown1_1, contestType,
    playerNameHash: hash, unknown1_2, recorderAccount, recorderName,
    recordingDateDays, recordingDateTime, recordChecksum: checksum, isOfficial,
    description, trackName, unknown3, bestTimeMs, contestImg, opaqueBlob,
    unknown6, speed, unknown7, players, recordVersion, records,
  };
}

/** Write a KartRecord body; two checksum fields are recalculated on export. */
export function encodeKsvBody(recording: KsvRecording, zCeiling: number): Uint8Array {
  const writer = new KsvWriter();
  writer.u32(ksvVersionHash(recording.headerVersion, "header"));
  writer.string(recording.recordTitle);
  writer.i16(recording.regionCode);
  writer.u8(recording.unknown1_1);
  writer.u8(recording.contestType);
  writer.u32(playerNameHash(recording.players));
  writer.u32(recording.unknown1_2);
  writer.string(recording.recorderAccount);
  writer.string(recording.recorderName);
  writer.u16(recording.recordingDateDays);
  writer.u16(recording.recordingDateTime);
  writer.u32(recordChecksum(recording.records));
  writer.u8(recording.isOfficial ? 1 : 0);
  writer.string(recording.description);
  writer.string(recording.trackName);
  writer.i32(recording.unknown3);
  writer.i32(recording.bestTimeMs);
  writer.string(recording.contestImg);
  if (recording.headerVersion >= 12) writer.blob(recording.opaqueBlob);
  else {
    if (recording.opaqueBlob.byteLength !== 8) {
      throw new Error("旧版 KSV 头部要求 8 字节 opaqueBlob。");
    }
    writer.bytes(recording.opaqueBlob);
  }
  writer.u8(recording.unknown6);
  if (recording.headerVersion >= 9) {
    if (recording.speed === undefined) {
      throw new Error(`KSV v${recording.headerVersion} 头部必须携带 speed 字节。`);
    }
    writer.u8(recording.speed);
  } else if (recording.speed !== undefined) {
    throw new Error("KSV v8 头部没有 speed 字节，不能写入。");
  }
  if (recording.headerVersion >= 12) writer.u8(recording.unknown7);
  writer.u32(recording.players.length);
  for (const player of recording.players) {
    writer.string(player.playerName);
    writer.string(player.clubName);
    writeEquipment(writer, player.equipment, recording.headerVersion);
  }
  writer.u32(ksvVersionHash(recording.recordVersion, "record"));
  writer.i32(recording.records.length);
  for (const record of recording.records) {
    writer.i32(record.stamps.length);
    for (const frame of record.stamps) writeFrame(writer, frame, zCeiling);
  }
  return writer.finish();
}

/** Read a complete .ksv file using the caller's zlib implementation. */
export function decodeKsvFile(bytes: Uint8Array, zCeiling: number, compression: KsvCompression): KsvRecording {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4) throw new Error("KSV 文件不足 4 字节。");
  const expectedLength = view.getUint32(0, true);
  if (expectedLength !== bytes.length - 4) {
    throw new Error(`KSV 头部长度 ${expectedLength} 与文件长度 ${bytes.length - 4} 不匹配。`);
  }
  return decodeKsvBody(decodeKrData(bytes.subarray(4), compression), zCeiling);
}

/** Write a complete .ksv file in the release client's compressed v12 envelope. */
export function encodeKsvFile(recording: KsvRecording, zCeiling: number, compression: KsvCompression): Uint8Array {
  const wrapped = encodeKrData(encodeKsvBody(recording, zCeiling), compression);
  const output = new Uint8Array(wrapped.length + 4);
  new DataView(output.buffer).setUint32(0, wrapped.length, true);
  output.set(wrapped, 4);
  return output;
}
