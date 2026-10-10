import {
  decodeMotionFrame,
  encodeMotionFrame,
  MAX_MOTION_SLOT,
  motionRaceTag,
  type MotionPayloadKind,
} from "./motion";

export type Vector3 = readonly [number, number, number];
export type Quaternion = readonly [number, number, number, number];

/** Older driving sample carried in wire kind 1. Names retain documented offsets. */
export interface DrivingMotionSample {
  tick: number;
  flags: readonly [number, number, number];
  position: Vector3;
  quaternion: Quaternion;
  secondaryQuaternion?: Quaternion;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
  vector5C: Vector3;
  vector68: Vector3;
  scalar74?: number;
  scalar78?: number;
  word7C: number;
  byte7E: number;
  word80: number;
  word84: number;
  scalar88: number;
  scalar8C: number;
  byte90: number;
  word94: number;
  byte98: number;
  word9C: number;
  byteA0: number;
  kind?: string;
}

export interface MotionAnimation {
  physicsState: number;
  dualMode: number;
  dualBoosterState: number;
  dualTeam: boolean;
  chargerActive: boolean;
  displaySpeedKmh: number;
  dualReadyRemainingMs: number;
}

export interface MotionPresentation {
  forwardSpeed: number;
  rawSteer: number;
  tireTransient: number;
  collisionStrength: number;
  boosterState: number;
  visualScaleMode: number;
  frontLamp: boolean;
  rearLamp: boolean;
  motorcycle: boolean;
  instantAccelerationActive: boolean;
  landingSequence: number;
  collisionSequence: number;
  animation?: MotionAnimation;
}

export interface MotionRaceProgress {
  distance: number;
  lap: number;
  finishElapsedMs?: number;
}

export interface MotionCollision {
  active: boolean;
  scaleX: number;
  scaleY: number;
}

export interface MotionRouting {
  motionMode: number;
  /** Room slot of the racer the distance cadence measures (protocol 40; the release sent its UUID). */
  observedSlot: number;
}

export interface KinematicMotionSample {
  kind: "kinematic";
  tick: number;
  position: Vector3;
  quaternion: Quaternion;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
  vector5C: Vector3;
  vector68: Vector3;
  presentation?: MotionPresentation;
  raceProgress?: MotionRaceProgress;
  resetStartedAt?: number;
  collision?: MotionCollision;
  routing?: MotionRouting;
  visualScale?: { x: number; y: number; z: number };
}

export type GameMotionSample = DrivingMotionSample | KinematicMotionSample;

/** A motion frame as the wire names its sender: a room slot and a race tag. */
export interface WireGameMotion {
  slot: number;
  raceTag: number;
  sequence: number;
  recipientMask?: number;
  payload: GameMotionSample;
}

/** A motion frame resolved against the receiver's race: who sent it, in which race. */
export interface DecodedGameMotion {
  roomId: string;
  raceId: string;
  playerId: string;
  sequence: number;
  recipientMask?: number;
  payload: GameMotionSample;
}

/** The receiver's view of one race: its members by room slot. */
export interface MotionRaceView {
  roomId: string;
  raceId: string;
  players: ReadonlyMap<number, string>;
}

/**
 * Name the sender of a wire frame through the receiver's race, or undefined
 * for a frame of another race or of a slot nobody holds (not malformed: a
 * frame may cross a room change).
 */
export function resolveGameMotion(motion: WireGameMotion, race: MotionRaceView): DecodedGameMotion | undefined {
  const playerId = race.players.get(motion.slot);
  if (playerId === undefined || motion.raceTag !== motionRaceTag(race.raceId)) return undefined;
  return {
    roomId: race.roomId, raceId: race.raceId, playerId, sequence: motion.sequence,
    ...(motion.recipientMask ? { recipientMask: motion.recipientMask } : {}),
    payload: motion.payload,
  };
}

const integer = (value: number, max: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= max;
const finiteF32 = (value: number): boolean => Number.isFinite(Math.fround(value));

function drivingByteLength(flags: readonly number[]): number {
  return 113 + (flags[1]! & 7 ? 16 : 0) +
    (flags[0]! & 4 ? 4 : 0) + (flags[0]! & 8 ? 4 : 0);
}

/** Encode the kind-1 driving payload with the release's field layout. */
export function encodeDrivingSample(sample: DrivingMotionSample): Uint8Array {
  const bytes = new Uint8Array(drivingByteLength(sample.flags));
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const byte = (value: number) => {
    if (!integer(value, 255)) throw new Error("Invalid motion byte");
    view.setUint8(offset++, value);
  };
  const word = (value: number) => {
    if (!integer(value, 65_535)) throw new Error("Invalid motion word");
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const dword = (value: number) => {
    if (!integer(value, 0xffff_ffff)) throw new Error("Invalid motion dword");
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const float = (value: number) => {
    if (!finiteF32(value)) throw new Error("Invalid motion float");
    view.setFloat32(offset, value, true);
    offset += 4;
  };
  const vector = (values: readonly number[] | undefined, length: number) => {
    if (!values || values.length !== length) throw new Error("Missing motion vector");
    values.forEach(float);
  };
  if (sample.flags.length !== 3) throw new Error("Invalid motion flags");
  dword(sample.tick);
  sample.flags.forEach(byte);
  vector(sample.position, 3);
  vector(sample.quaternion, 4);
  if (sample.flags[1] & 7) vector(sample.secondaryQuaternion, 4);
  vector(sample.linearVelocity, 3);
  vector(sample.angularVelocity, 3);
  vector(sample.vector5C, 3);
  vector(sample.vector68, 3);
  if (sample.flags[0] & 4) float(sample.scalar74!);
  if (sample.flags[0] & 8) float(sample.scalar78!);
  word(sample.word7C);
  byte(sample.byte7E);
  dword(sample.word80);
  dword(sample.word84);
  float(sample.scalar88);
  float(sample.scalar8C);
  byte(sample.byte90);
  dword(sample.word94);
  byte(sample.byte98);
  dword(sample.word9C);
  byte(sample.byteA0);
  return bytes;
}

/** Decode kind 1, preserving the optional fields implied by its flag bytes. */
export function decodeDrivingSample(bytes: Uint8Array): DrivingMotionSample | undefined {
  if (bytes.byteLength < 113 || bytes.byteLength > 137) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let valid = true;
  const byte = () => view.getUint8(offset++);
  const word = () => { const value = view.getUint16(offset, true); offset += 2; return value; };
  const dword = () => { const value = view.getUint32(offset, true); offset += 4; return value; };
  const float = () => {
    const value = view.getFloat32(offset, true);
    offset += 4;
    if (!Number.isFinite(value)) valid = false;
    return value;
  };
  const vector3 = (): Vector3 => [float(), float(), float()];
  const quaternion = (): Quaternion => [float(), float(), float(), float()];
  const tick = dword();
  const flags: [number, number, number] = [byte(), byte(), byte()];
  if (bytes.byteLength !== drivingByteLength(flags)) return undefined;
  const position = vector3();
  const orientation = quaternion();
  const secondaryQuaternion = flags[1] & 7 ? quaternion() : undefined;
  const linearVelocity = vector3();
  const angularVelocity = vector3();
  const vector5C = vector3();
  const vector68 = vector3();
  const scalar74 = flags[0] & 4 ? float() : undefined;
  const scalar78 = flags[0] & 8 ? float() : undefined;
  const word7C = word();
  const byte7E = byte();
  const word80 = dword();
  const word84 = dword();
  const scalar88 = float();
  const scalar8C = float();
  const byte90 = byte();
  const word94 = dword();
  const byte98 = byte();
  const word9C = dword();
  const byteA0 = byte();
  return valid ? { tick, flags, position, quaternion: orientation, secondaryQuaternion,
    linearVelocity, angularVelocity, vector5C, vector68, scalar74, scalar78,
    word7C, byte7E, word80, word84, scalar88, scalar8C, byte90, word94,
    byte98, word9C, byteA0 } : undefined;
}

function validProgress(progress: MotionRaceProgress): boolean {
  return Number.isFinite(progress.distance) && integer(progress.lap, 65_535) &&
    (progress.finishElapsedMs === undefined || integer(progress.finishElapsedMs, 0xffff_fffe));
}
function validReset(tick: number, startedAt: number): boolean {
  return integer(startedAt, 0xffff_ffff) && ((tick - startedAt) >>> 0) <= 2_000;
}
function validAnimation(animation: MotionAnimation): boolean {
  return integer(animation.physicsState, 255) && integer(animation.dualBoosterState, 255) &&
    [0, 1, 3].includes(animation.dualMode) &&
    typeof animation.dualTeam === "boolean" && typeof animation.chargerActive === "boolean" &&
    finiteF32(animation.displaySpeedKmh) && animation.displaySpeedKmh >= 0 &&
    finiteF32(animation.dualReadyRemainingMs) && animation.dualReadyRemainingMs >= 0;
}
function validPresentation(presentation: MotionPresentation): boolean {
  return [presentation.forwardSpeed, presentation.rawSteer,
    presentation.tireTransient, presentation.collisionStrength].every(finiteF32) &&
    integer(presentation.boosterState, 255) && integer(presentation.visualScaleMode, 3) &&
    integer(presentation.landingSequence, 0xffff_ffff) &&
    integer(presentation.collisionSequence, 0xffff_ffff) &&
    [presentation.frontLamp, presentation.rearLamp, presentation.motorcycle,
      presentation.instantAccelerationActive].every(value => typeof value === "boolean") &&
    (!presentation.animation || validAnimation(presentation.animation));
}
function validCollision(collision: MotionCollision): boolean {
  return typeof collision.active === "boolean" &&
    [collision.scaleX, collision.scaleY].every(value => finiteF32(value) && Math.fround(value) > 0);
}
function validRouting(routing: MotionRouting): boolean {
  return [0, 1, 2, 3, 5, 6].includes(routing.motionMode) && integer(routing.observedSlot, MAX_MOTION_SLOT);
}
function validScale(scale: { x: number; y: number; z: number }): boolean {
  return [scale.x, scale.y, scale.z].every(finiteF32);
}

/** Compact kind-2..10 payload shared by local and peer race traffic. */
export function encodeKinematicSample(sample: KinematicMotionSample): Uint8Array {
  if (!integer(sample.tick, 0xffff_ffff)) throw new Error("Invalid motion tick");
  const vectors: readonly (readonly number[])[] = [sample.position, sample.quaternion,
    sample.linearVelocity, sample.angularVelocity, sample.vector5C, sample.vector68];
  if (vectors.some((vector, index) => vector.length !== (index === 1 ? 4 : 3))) {
    throw new Error("Invalid kinematic vector");
  }
  if (sample.raceProgress && (!sample.presentation || !validProgress(sample.raceProgress))) {
    throw new Error("Invalid race progress");
  }
  if (sample.resetStartedAt !== undefined &&
      (!sample.raceProgress || !validReset(sample.tick, sample.resetStartedAt))) {
    throw new Error("Invalid reset start");
  }
  if (sample.collision && (!sample.raceProgress || !validCollision(sample.collision))) {
    throw new Error("Invalid motion collision state");
  }
  if (sample.presentation?.animation && !sample.collision) {
    throw new Error("Kart animation requires collision format");
  }
  if (sample.routing && (!sample.presentation?.animation || !validRouting(sample.routing))) {
    throw new Error("Invalid motion routing");
  }
  if (sample.visualScale && (!sample.presentation?.animation || !validScale(sample.visualScale))) {
    throw new Error("Invalid motion visual scale");
  }
  const baseLength = sample.routing ? 151 : sample.presentation?.animation ? 149
    : sample.collision ? 137 : sample.resetStartedAt !== undefined ? 128
      : sample.raceProgress ? 124 : sample.presentation ? 108 : 80;
  const bytes = new Uint8Array(baseLength + (sample.visualScale ? 12 : 0));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, sample.tick, true);
  vectors.flat().forEach((value, index) => {
    if (!finiteF32(value)) throw new Error("Invalid motion float");
    view.setFloat32(4 + index * 4, value, true);
  });
  const presentation = sample.presentation;
  if (presentation) {
    if (!validPresentation(presentation)) throw new Error("Invalid motion presentation");
    [presentation.forwardSpeed, presentation.rawSteer, presentation.tireTransient,
      presentation.collisionStrength].forEach((value, index) =>
      view.setFloat32(80 + index * 4, value, true));
    view.setUint8(96, presentation.boosterState);
    view.setUint8(97, presentation.visualScaleMode);
    view.setUint8(98, Number(presentation.frontLamp) |
      (Number(presentation.rearLamp) << 1) | (Number(presentation.motorcycle) << 2) |
      (Number(presentation.instantAccelerationActive) << 3));
    view.setUint32(100, presentation.landingSequence, true);
    view.setUint32(104, presentation.collisionSequence, true);
  }
  if (sample.raceProgress) {
    view.setFloat64(108, sample.raceProgress.distance, true);
    view.setUint32(116, sample.raceProgress.lap, true);
    view.setUint32(120, sample.raceProgress.finishElapsedMs ?? 0xffff_ffff, true);
  }
  if (sample.resetStartedAt !== undefined) view.setUint32(124, sample.resetStartedAt, true);
  if (sample.collision) {
    view.setFloat32(128, sample.collision.scaleX, true);
    view.setFloat32(132, sample.collision.scaleY, true);
    view.setUint8(136, Number(sample.collision.active) |
      (Number(sample.resetStartedAt !== undefined) << 1));
  }
  if (presentation?.animation) {
    const animation = presentation.animation;
    view.setUint8(137, animation.physicsState);
    view.setUint8(138, animation.dualMode);
    view.setUint8(139, animation.dualBoosterState);
    view.setUint8(140, Number(animation.dualTeam) | (Number(animation.chargerActive) << 1));
    view.setFloat32(141, animation.displaySpeedKmh, true);
    view.setFloat32(145, animation.dualReadyRemainingMs, true);
  }
  if (sample.routing) {
    view.setUint8(149, sample.routing.motionMode);
    view.setUint8(150, sample.routing.observedSlot);
  }
  if (sample.visualScale) {
    const offset = sample.routing ? 151 : 149;
    [sample.visualScale.x, sample.visualScale.y, sample.visualScale.z].forEach((value, index) =>
      view.setFloat32(offset + index * 4, value, true));
  }
  return bytes;
}

/** Parse and validate all optional kinematic sections implied by wire kind. */
export function decodeKinematicSample(bytes: Uint8Array, kind: MotionPayloadKind): KinematicMotionSample | undefined {
  const hasPresentation = kind >= 3;
  const hasProgress = kind >= 4;
  const hasReset = kind === 5;
  const hasCollision = kind >= 6;
  const hasAnimation = kind >= 7;
  const hasRouting = kind === 8 || kind === 10;
  const hasScale = kind >= 9;
  const baseLength = hasRouting ? 151 : hasAnimation ? 149 : hasCollision ? 137
    : hasReset ? 128 : hasProgress ? 124 : hasPresentation ? 108 : 80;
  if (bytes.byteLength !== baseLength + (hasScale ? 12 : 0)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const floats = Array.from({ length: 19 }, (_, index) => view.getFloat32(4 + index * 4, true));
  if (floats.some(value => !Number.isFinite(value))) return undefined;
  const vector3 = (index: number): Vector3 => [floats[index]!, floats[index + 1]!, floats[index + 2]!];
  let presentation: MotionPresentation | undefined;
  if (hasPresentation) {
    const flags = view.getUint8(98);
    if (flags > 15 || view.getUint8(99) !== 0) return undefined;
    presentation = {
      forwardSpeed: view.getFloat32(80, true), rawSteer: view.getFloat32(84, true),
      tireTransient: view.getFloat32(88, true), collisionStrength: view.getFloat32(92, true),
      boosterState: view.getUint8(96), visualScaleMode: view.getUint8(97),
      frontLamp: !!(flags & 1), rearLamp: !!(flags & 2),
      motorcycle: !!(flags & 4), instantAccelerationActive: !!(flags & 8),
      landingSequence: view.getUint32(100, true), collisionSequence: view.getUint32(104, true),
    };
    if (!validPresentation(presentation)) return undefined;
  }
  let raceProgress: MotionRaceProgress | undefined;
  if (hasProgress) {
    const elapsed = view.getUint32(120, true);
    raceProgress = { distance: view.getFloat64(108, true), lap: view.getUint32(116, true),
      ...(elapsed === 0xffff_ffff ? {} : { finishElapsedMs: elapsed }) };
    if (!validProgress(raceProgress)) return undefined;
  }
  let resetStartedAt: number | undefined = hasReset ? view.getUint32(124, true) : undefined;
  let collision: MotionCollision | undefined;
  if (hasCollision) {
    const collisionFlags = view.getUint8(136);
    if (collisionFlags > 3) return undefined;
    resetStartedAt = collisionFlags & 2 ? view.getUint32(124, true) : undefined;
    if (resetStartedAt === undefined && view.getUint32(124, true) !== 0) return undefined;
    collision = {
      active: !!(collisionFlags & 1), scaleX: view.getFloat32(128, true),
      scaleY: view.getFloat32(132, true),
    };
    if (!validCollision(collision)) return undefined;
  }
  if (hasAnimation) {
    if (!presentation) return undefined;
    const animationFlags = view.getUint8(140);
    if (animationFlags > 3) return undefined;
    presentation.animation = {
      physicsState: view.getUint8(137), dualMode: view.getUint8(138),
      dualBoosterState: view.getUint8(139), dualTeam: !!(animationFlags & 1),
      chargerActive: !!(animationFlags & 2),
      displaySpeedKmh: view.getFloat32(141, true),
      dualReadyRemainingMs: view.getFloat32(145, true),
    };
    if (!validPresentation(presentation)) return undefined;
  }
  const tick = view.getUint32(0, true);
  if (resetStartedAt !== undefined && !validReset(tick, resetStartedAt)) return undefined;
  let routing: MotionRouting | undefined;
  if (hasRouting) {
    routing = { motionMode: view.getUint8(149), observedSlot: view.getUint8(150) };
    if (!validRouting(routing)) return undefined;
  }
  let visualScale: KinematicMotionSample["visualScale"];
  if (hasScale) {
    const offset = hasRouting ? 151 : 149;
    visualScale = { x: view.getFloat32(offset, true),
      y: view.getFloat32(offset + 4, true), z: view.getFloat32(offset + 8, true) };
    if (!validScale(visualScale)) return undefined;
  }
  return {
    ...(visualScale ? { visualScale } : {}), ...(routing ? { routing } : {}),
    ...(collision ? { collision } : {}),
    ...(resetStartedAt === undefined ? {} : { resetStartedAt }),
    ...(raceProgress ? { raceProgress } : {}),
    ...(presentation ? { presentation } : {}),
    kind: "kinematic", tick, position: vector3(0),
    quaternion: [floats[3]!, floats[4]!, floats[5]!, floats[6]!],
    linearVelocity: vector3(7), angularVelocity: vector3(10),
    vector5C: vector3(13), vector68: vector3(16),
  };
}

function wireKind(sample: GameMotionSample): MotionPayloadKind {
  if (sample.kind !== "kinematic") return 1;
  const kinematic = sample as KinematicMotionSample;
  return kinematic.visualScale ? (kinematic.routing ? 10 : 9)
    : kinematic.routing ? 8 : kinematic.presentation?.animation ? 7
      : kinematic.collision ? 6 : kinematic.resetStartedAt !== undefined ? 5
        : kinematic.raceProgress ? 4 : kinematic.presentation ? 3 : 2;
}

/** Full frame encoder for one racer (its room slot) in one race. */
export class GameMotionEncoder {
  readonly slot: number;
  readonly raceTag: number;

  constructor(identity: { raceId: string; slot: number }) {
    if (!integer(identity.slot, MAX_MOTION_SLOT)) throw new Error("Invalid motion slot");
    this.slot = identity.slot;
    this.raceTag = motionRaceTag(identity.raceId);
  }

  encode(sample: GameMotionSample, sequence: number, recipientMask = 0): Uint8Array {
    if (!integer(sequence, 0xffff_ffff)) throw new Error("Invalid motion sequence");
    const kind = wireKind(sample);
    const payload = kind === 1 ? encodeDrivingSample(sample as DrivingMotionSample)
      : encodeKinematicSample(sample as KinematicMotionSample);
    if (!integer(recipientMask, 255)) throw new Error("Invalid recipient mask");
    return encodeMotionFrame({ slot: this.slot, raceTag: this.raceTag, sequence, recipientMask, kind, payload });
  }
}

/** Full frame decoder. Invalid network packets yield undefined; resolveGameMotion names the sender. */
export class GameMotionDecoder {
  decode(input: Uint8Array | ArrayBuffer | ArrayBufferView): WireGameMotion | undefined {
    let frame;
    try {
      frame = decodeMotionFrame(input);
    } catch { return undefined; }
    const sample = frame.kind === 1 ? decodeDrivingSample(frame.payload)
      : decodeKinematicSample(frame.payload, frame.kind);
    if (!sample) return undefined;
    return {
      slot: frame.slot, raceTag: frame.raceTag, sequence: frame.sequence,
      ...(frame.recipientMask ? { recipientMask: frame.recipientMask } : {}),
      payload: sample,
    };
  }
}
