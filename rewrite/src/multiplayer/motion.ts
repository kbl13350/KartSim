/** Wire framing only. The kart physics payload codec belongs to the race simulation. */
export const MOTION_HEADER_BYTES = 56;
export const MOTION_MAGIC = 19_277;
export const MAX_MOTION_BYTES = MOTION_HEADER_BYTES + 178;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 1 is a driving sample; 2–10 are increasingly detailed kinematic samples. */
export type MotionPayloadKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface MotionFrame {
  roomId: string;
  raceId: string;
  playerId: string;
  sequence: number;
  kind: MotionPayloadKind;
  /** Zero on direct peer traffic; server relay uses slot bits. */
  recipientMask: number;
  /** Opaque until the race physics codec supplies a parser. */
  payload: Uint8Array;
}

function uuidBytes(uuid: string): Uint8Array {
  if (!UUID.test(uuid)) throw new Error(`Invalid motion UUID: ${uuid}`);
  const hex = uuid.replaceAll("-", "");
  return Uint8Array.from({ length: 16 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
}

function readUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function encodeMotionFrame(frame: MotionFrame): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(frame.sequence) || frame.sequence < 0 || frame.sequence > 0xffff_ffff ||
      !Number.isInteger(frame.recipientMask) || frame.recipientMask < 0 || frame.recipientMask > 255 ||
      !Number.isInteger(frame.kind) || frame.kind < 1 || frame.kind > 10 ||
      frame.payload.length < 80 || frame.payload.length > 178) {
    throw new Error("Invalid motion frame fields");
  }
  const bytes = new Uint8Array(MOTION_HEADER_BYTES + frame.payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, MOTION_MAGIC, true);
  view.setUint8(2, frame.kind);
  view.setUint8(3, frame.recipientMask);
  [frame.roomId, frame.raceId, frame.playerId].forEach((uuid, index) => {
    bytes.set(uuidBytes(uuid), 4 + index * 16);
  });
  view.setUint32(52, frame.sequence, true);
  bytes.set(frame.payload, MOTION_HEADER_BYTES);
  return bytes;
}

export function decodeMotionFrame(input: ArrayBuffer | ArrayBufferView): MotionFrame {
  const bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.length < MOTION_HEADER_BYTES + 80 || bytes.length > MAX_MOTION_BYTES) {
    throw new Error("Invalid motion frame length");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0, true) !== MOTION_MAGIC) throw new Error("Invalid motion frame magic");
  const kind = view.getUint8(2);
  if (kind < 1 || kind > 10) throw new Error("Invalid motion payload kind");
  return {
    roomId: readUuid(bytes.subarray(4, 20)),
    raceId: readUuid(bytes.subarray(20, 36)),
    playerId: readUuid(bytes.subarray(36, 52)),
    sequence: view.getUint32(52, true),
    kind: kind as MotionPayloadKind,
    recipientMask: view.getUint8(3),
    payload: bytes.slice(MOTION_HEADER_BYTES),
  };
}

/** Treat uint32 sequence numbers as a ring, matching the downloaded client. */
export function isNewerSequence(candidate: number, previous: number): boolean {
  const delta = (candidate - previous) >>> 0;
  return delta > 0 && delta < 0x8000_0000;
}
