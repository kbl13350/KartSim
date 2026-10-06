/** A single pose in the game's compact KSV ghost-record format. */
export interface GhostFrame {
  time: number;
  x: number;
  y: number;
  z: number;
  w: number;
  qx: number;
  qy: number;
  qz: number;
  status: number;
}

export interface GhostFrameRecord {
  stamps: GhostFrame[];
}

/** Tracks with a 3000-unit ceiling store z as i32; other tracks use i16. */
const WIDE_Z_CEILING = 1500;

function frameBytes(zCeiling: number): number {
  return zCeiling > WIDE_Z_CEILING ? 20 : 18;
}

/** Encode the frame payload stored in IndexedDB, without the KSV file header. */
export function encodeGhostFrames(record: GhostFrameRecord, zCeiling: number): Uint8Array {
  const bytes = new Uint8Array(4 + record.stamps.length * frameBytes(zCeiling));
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const i16 = (value: number) => {
    view.setUint16(offset, value & 0xffff, true);
    offset += 2;
  };
  const i32 = (value: number) => {
    view.setInt32(offset, value | 0, true);
    offset += 4;
  };
  i32(record.stamps.length);
  for (const frame of record.stamps) {
    i16(frame.time);
    i16(frame.x);
    i16(frame.y);
    if (zCeiling > WIDE_Z_CEILING) i32(frame.z);
    else i16(frame.z);
    i16(frame.w);
    i16(frame.qx);
    i16(frame.qy);
    i16(frame.qz);
    i16(frame.status);
  }
  return bytes;
}

/** Decode the frame payload, rejecting truncated or trailing bytes. */
export function decodeGhostFrames(bytes: Uint8Array, zCeiling: number): GhostFrameRecord {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const requireBytes = (count: number) => {
    if (offset + count > bytes.length) throw new Error("KSV 读取越界。");
  };
  const i16 = () => {
    requireBytes(2);
    const value = view.getInt16(offset, true);
    offset += 2;
    return value;
  };
  const u16 = () => {
    requireBytes(2);
    const value = view.getUint16(offset, true);
    offset += 2;
    return value;
  };
  const i32 = () => {
    requireBytes(4);
    const value = view.getInt32(offset, true);
    offset += 4;
    return value;
  };
  const count = i32();
  if (count < 0) throw new Error("KSV record 帧数无效。");
  const stamps: GhostFrame[] = [];
  for (let index = 0; index < count; index += 1) {
    stamps.push({
      time: i16(),
      x: i16(),
      y: i16(),
      z: zCeiling > WIDE_Z_CEILING ? i32() : i16(),
      w: i16(),
      qx: i16(),
      qy: i16(),
      qz: i16(),
      status: u16(),
    });
  }
  if (offset !== bytes.length) throw new Error("KSV record 解析后有剩余字节。");
  return { stamps };
}

// Release aliases used by generated compatibility code.
export { encodeGhostFrames as Ah0, decodeGhostFrames as bh0 };
