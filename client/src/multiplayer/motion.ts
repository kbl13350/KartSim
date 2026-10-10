/**
 * Wire framing only. The kart physics payload codec belongs to the race simulation.
 *
 * Protocol 40 (not the release's): an 8-byte header names the sender by its
 * room slot and the race by a one-byte tag, where the release's 56-byte
 * header carried a magic and the room, race and player UUIDs. The receiver
 * maps the slot to a player through its room snapshot.
 *
 *   0  kind           payload kind 1–10
 *   1  recipientMask  slot bits for the server relay; 0 on direct peer traffic
 *   2  slot           sender's room slot 0–7 (the server stamps it on relay)
 *   3  raceTag        motionRaceTag(raceId); frames of another race are dropped
 *   4  sequence       uint32, little-endian
 */
export const MOTION_HEADER_BYTES = 8;
export const MIN_MOTION_PAYLOAD_BYTES = 80;
/** The largest payload: kind 10 (payload.ts encodeKinematicSample). */
export const MAX_MOTION_PAYLOAD_BYTES = 163;
export const MAX_MOTION_BYTES = MOTION_HEADER_BYTES + MAX_MOTION_PAYLOAD_BYTES;
/** Offset of the recipient mask, which the sender rewrites per route. */
export const MOTION_MASK_OFFSET = 1;
/** Room slots are 0–7, one recipient mask bit each. */
export const MAX_MOTION_SLOT = 7;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 1 is a driving sample; 2–10 are increasingly detailed kinematic samples. */
export type MotionPayloadKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface MotionFrame {
  /** Sender's room slot. */
  slot: number;
  /** motionRaceTag of the sender's race. */
  raceTag: number;
  sequence: number;
  kind: MotionPayloadKind;
  /** Zero on direct peer traffic; server relay uses slot bits. */
  recipientMask: number;
  /** Opaque until the race physics codec supplies a parser. */
  payload: Uint8Array;
}

/** The race tag: the first byte of the race UUID. */
export function motionRaceTag(raceId: string): number {
  if (!UUID.test(raceId)) throw new Error(`Invalid motion race: ${raceId}`);
  return Number.parseInt(raceId.slice(0, 2), 16);
}

const byte = (value: number, max: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= max;

export function encodeMotionFrame(frame: MotionFrame): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(frame.sequence) || frame.sequence < 0 || frame.sequence > 0xffff_ffff ||
      !byte(frame.recipientMask, 255) || !byte(frame.kind, 10) || frame.kind < 1 ||
      !byte(frame.slot, MAX_MOTION_SLOT) || !byte(frame.raceTag, 255) ||
      frame.payload.length < MIN_MOTION_PAYLOAD_BYTES || frame.payload.length > MAX_MOTION_PAYLOAD_BYTES) {
    throw new Error("Invalid motion frame fields");
  }
  const bytes = new Uint8Array(MOTION_HEADER_BYTES + frame.payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, frame.kind);
  view.setUint8(MOTION_MASK_OFFSET, frame.recipientMask);
  view.setUint8(2, frame.slot);
  view.setUint8(3, frame.raceTag);
  view.setUint32(4, frame.sequence, true);
  bytes.set(frame.payload, MOTION_HEADER_BYTES);
  return bytes;
}

export function decodeMotionFrame(input: ArrayBuffer | ArrayBufferView): MotionFrame {
  const bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.length < MOTION_HEADER_BYTES + MIN_MOTION_PAYLOAD_BYTES || bytes.length > MAX_MOTION_BYTES) {
    throw new Error("Invalid motion frame length");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kind = view.getUint8(0);
  if (kind < 1 || kind > 10) throw new Error("Invalid motion payload kind");
  const slot = view.getUint8(2);
  if (slot > MAX_MOTION_SLOT) throw new Error("Invalid motion slot");
  return {
    slot,
    raceTag: view.getUint8(3),
    sequence: view.getUint32(4, true),
    kind: kind as MotionPayloadKind,
    recipientMask: view.getUint8(MOTION_MASK_OFFSET),
    payload: bytes.slice(MOTION_HEADER_BYTES),
  };
}

/** Treat uint32 sequence numbers as a ring, matching the downloaded client. */
export function isNewerSequence(candidate: number, previous: number): boolean {
  const delta = (candidate - previous) >>> 0;
  return delta > 0 && delta < 0x8000_0000;
}
