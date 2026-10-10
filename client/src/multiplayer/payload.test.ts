import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { MOTION_HEADER_BYTES } from "./motion";
import {
  GameMotionDecoder, GameMotionEncoder,
  decodeDrivingSample, decodeKinematicSample,
  encodeDrivingSample, encodeKinematicSample, resolveGameMotion,
  type DrivingMotionSample, type KinematicMotionSample,
} from "./payload";

const source = readFileSync(fileURLToPath(new URL(
  "../../../recovered/formatted/index.js", import.meta.url)), "utf8");
const start = source.indexOf("const v4 = 56,");
const end = source.indexOf("function B40(", start);
assert.ok(start >= 0 && end > start, "released motion codec block was found");
const context: Record<string, unknown> = {};
runInNewContext(`${source.slice(start, end)}\nglobalThis.release = { S40, d6, M40, x40, T40, G40 };`, context);
const release = context.release as {
  S40: new (identity: { roomId: string; raceId: string; playerId: string }) => {
    encode(sample: unknown, sequence: number, mask?: number): Uint8Array;
  };
  d6: new () => { decode(bytes: Uint8Array): unknown };
  M40(sample: DrivingMotionSample): Uint8Array;
  x40(bytes: Uint8Array): unknown;
  T40(sample: KinematicMotionSample): Uint8Array;
  G40(bytes: Uint8Array, ...flags: boolean[]): unknown;
};
const identity = {
  roomId: "11111111-2222-3333-4444-555555555555",
  raceId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  playerId: "01234567-89ab-cdef-0123-456789abcdef",
};
// Protocol 40 names the sender by slot (and the race by its first byte).
const wire = { raceId: identity.raceId, slot: 3 };
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const bytes = (value: Uint8Array): number[] => Array.from(value);

const driving: DrivingMotionSample = {
  kind: "driving", tick: 123_456, flags: [0, 0, 0],
  position: [1, 2, 3], quaternion: [0, 0, 0, 1],
  linearVelocity: [4, 5, 6], angularVelocity: [7, 8, 9],
  vector5C: [10, 11, 12], vector68: [13, 14, 15],
  word7C: 7, byte7E: 8, word80: 9, word84: 10,
  scalar88: 11.25, scalar8C: 12.5, byte90: 13,
  word94: 14, byte98: 15, word9C: 16, byteA0: 17,
};

const kinematic: KinematicMotionSample = {
  kind: "kinematic", tick: 432_100,
  position: [1, 2, 3], quaternion: [0, 0, 0, 1],
  linearVelocity: [4, 5, 6], angularVelocity: [7, 8, 9],
  vector5C: [10, 11, 12], vector68: [13, 14, 15],
};
const presentation = {
  forwardSpeed: 17.5, rawSteer: -1, tireTransient: 0.5, collisionStrength: 0.75,
  boosterState: 2, visualScaleMode: 1,
  frontLamp: true, rearLamp: false, motorcycle: false, instantAccelerationActive: true,
  landingSequence: 2, collisionSequence: 4,
} as const;
const raceProgress = { distance: 4321.125, lap: 2, finishElapsedMs: 23_456 } as const;
const collision = { active: true, scaleX: 1.25, scaleY: 0.75 } as const;
const animation = {
  physicsState: 2, dualMode: 1, dualBoosterState: 3, dualTeam: true,
  chargerActive: false, displaySpeedKmh: 144.4, dualReadyRemainingMs: 500,
} as const;
// The release routes by player UUID (16 bytes at payload offset 150), protocol 40 by slot (1 byte).
const observedPlayerId = "99999999-8888-7777-6666-555555555555";
const routing = { motionMode: 5, observedSlot: 6 } as const;
const releaseSample = (sample: KinematicMotionSample): unknown => sample.routing
  ? { ...sample, routing: { motionMode: sample.routing.motionMode, observedPlayerId } } : sample;
/** The release payload with its routing UUID replaced by the slot byte. */
const slotRouted = (release: Uint8Array, sample: KinematicMotionSample): number[] => sample.routing
  ? [...release.subarray(0, 150), sample.routing.observedSlot, ...release.subarray(166)] : bytes(release);
const releasePayload = (decoded: unknown): unknown => {
  const payload = (decoded as { payload: { routing?: { motionMode: number } } }).payload;
  return payload.routing ? { ...payload, routing: { ...routing, motionMode: payload.routing.motionMode } } : payload;
};

test("kind-1 driving payload matches released bytes and parser", () => {
  const samples: DrivingMotionSample[] = [driving, {
    ...driving, flags: [12, 1, 0], secondaryQuaternion: [0.1, 0.2, 0.3, 0.4],
    scalar74: 99.5, scalar78: -12.25,
  }];
  for (const sample of samples) {
    const actual = encodeDrivingSample(sample);
    assert.deepEqual(bytes(actual), bytes(release.M40(sample)));
    assert.deepEqual(plain(decodeDrivingSample(actual)), plain(release.x40(actual)));
  }
});

test("kinematic kinds 2 through 10 match released payloads, routing by slot", () => {
  const samples: KinematicMotionSample[] = [
    kinematic,
    { ...kinematic, presentation },
    { ...kinematic, presentation, raceProgress },
    { ...kinematic, presentation, raceProgress, resetStartedAt: 431_000 },
    { ...kinematic, presentation, raceProgress, collision },
    { ...kinematic, presentation: { ...presentation, animation }, raceProgress, collision },
    { ...kinematic, presentation: { ...presentation, animation }, raceProgress, collision, routing },
    { ...kinematic, presentation: { ...presentation, animation }, raceProgress, collision,
      visualScale: { x: 1.1, y: 1.2, z: 1.3 } },
    { ...kinematic, presentation: { ...presentation, animation }, raceProgress, collision, routing,
      visualScale: { x: 1.1, y: 1.2, z: 1.3 } },
  ];
  const actualEncoder = new GameMotionEncoder(wire);
  const referenceEncoder = new release.S40(identity);
  const actualDecoder = new GameMotionDecoder();
  const referenceDecoder = new release.d6();
  const players = new Map([[3, identity.playerId]]);
  for (const [index, sample] of samples.entries()) {
    const actualPayload = encodeKinematicSample(sample);
    const referencePayload = release.T40(releaseSample(sample) as KinematicMotionSample);
    assert.deepEqual(bytes(actualPayload), slotRouted(referencePayload, sample), `payload ${index}`);
    const actualFrame = actualEncoder.encode(sample, index + 1, 3);
    const referenceFrame = referenceEncoder.encode(releaseSample(sample), index + 1, 3);
    assert.deepEqual(bytes(actualFrame.subarray(MOTION_HEADER_BYTES)), bytes(actualPayload), `frame ${index}`);
    assert.equal(referenceFrame.length - actualFrame.length, sample.routing ? 63 : 48, `saved ${index}`);
    const decoded = actualDecoder.decode(actualFrame)!;
    const reference = referenceDecoder.decode(referenceFrame);
    assert.deepEqual(plain(resolveGameMotion(decoded, { ...identity, players })),
      plain({ ...(reference as object), payload: releasePayload(reference) }), `decode ${index}`);
    assert.deepEqual(plain(decodeKinematicSample(actualPayload, (index + 2) as 2)),
      plain(releasePayload(reference)), `payload decode ${index}`);
  }
});

test("invalid network payloads are rejected", () => {
  const valid = new GameMotionEncoder(wire).encode(kinematic, 1);
  assert.ok(new GameMotionDecoder().decode(valid));
  const bad = [valid.subarray(0, 40), valid.subarray(0, valid.length - 1), valid.slice(), valid.slice(),
    valid.slice()];
  bad[2]![0] = 255; // kind
  bad[3]![2] = 8; // slot
  bad[4]![0] = 3; // kind 3 needs a longer payload
  for (const packet of bad) assert.equal(new GameMotionDecoder().decode(packet), undefined);
  // The release's own frames do not parse as protocol 40.
  assert.equal(new GameMotionDecoder().decode(new release.S40(identity).encode(kinematic, 1)), undefined);
});

test("encoder validation and malformed floats keep released behavior", () => {
  const current = new GameMotionEncoder(wire);
  const reference = new release.S40(identity);
  for (const [sample, sequence, mask] of [
    [kinematic, -1, 0], [kinematic, 0x1_0000_0000, 0],
    [kinematic, 1, -1], [kinematic, 1, 256],
    [{ ...kinematic, position: [NaN, 2, 3] }, 1, 0],
  ] as const) {
    let actualError: unknown;
    let referenceError: unknown;
    try { current.encode(sample as KinematicMotionSample, sequence, mask); }
    catch (error) { actualError = error; }
    try { reference.encode(sample, sequence, mask); }
    catch (error) { referenceError = error; }
    assert.equal((actualError as Error)?.message, (referenceError as Error)?.message);
  }
  const packet = current.encode(kinematic, 3);
  new DataView(packet.buffer).setFloat32(MOTION_HEADER_BYTES + 4, Infinity, true);
  assert.equal(new GameMotionDecoder().decode(packet), undefined);
  assert.throws(() => new GameMotionEncoder({ ...wire, slot: 8 }));
  assert.throws(() => new GameMotionEncoder({ ...wire, raceId: "race-1" }));
});

test("resolution names the sender through the race and drops other races and empty slots", () => {
  const decoded = new GameMotionDecoder().decode(new GameMotionEncoder(wire).encode(kinematic, 5, 9))!;
  const race = { roomId: identity.roomId, raceId: identity.raceId, players: new Map([[3, identity.playerId]]) };
  assert.deepEqual(plain(resolveGameMotion(decoded, race)), plain({ roomId: identity.roomId,
    raceId: identity.raceId, playerId: identity.playerId, sequence: 5, recipientMask: 9, payload: kinematic }));
  assert.equal(resolveGameMotion(decoded, { ...race, players: new Map([[2, identity.playerId]]) }), undefined);
  assert.equal(resolveGameMotion(decoded, { ...race, raceId: "abaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }), undefined);
});
