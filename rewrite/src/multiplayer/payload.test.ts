import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import {
  GameMotionDecoder, GameMotionEncoder,
  decodeDrivingSample, decodeKinematicSample,
  encodeDrivingSample, encodeKinematicSample,
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
const routing = {
  motionMode: 5, observedPlayerId: "99999999-8888-7777-6666-555555555555",
} as const;

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

test("kinematic kinds 2 through 10 match released frame bytes and parser", () => {
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
  const actualEncoder = new GameMotionEncoder(identity);
  const referenceEncoder = new release.S40(identity);
  const actualDecoder = new GameMotionDecoder();
  const referenceDecoder = new release.d6();
  for (const [index, sample] of samples.entries()) {
    const actualPayload = encodeKinematicSample(sample);
    assert.deepEqual(bytes(actualPayload), bytes(release.T40(sample)), `payload ${index}`);
    const actualFrame = actualEncoder.encode(sample, index + 1, 3);
    const referenceFrame = referenceEncoder.encode(sample, index + 1, 3);
    assert.deepEqual(bytes(actualFrame), bytes(referenceFrame), `frame ${index}`);
    assert.deepEqual(plain(actualDecoder.decode(actualFrame)),
      plain(referenceDecoder.decode(referenceFrame)), `decode ${index}`);
    assert.deepEqual(plain(decodeKinematicSample(actualPayload, (index + 2) as 2)),
      plain((referenceDecoder.decode(referenceFrame) as { payload: unknown }).payload),
      `payload decode ${index}`);
  }
});

test("invalid network payloads are rejected like the released decoder", () => {
  const valid = new GameMotionEncoder(identity).encode(kinematic, 1);
  const bad = [valid.subarray(0, 40), valid.subarray(0, valid.length - 1), valid.slice()];
  bad[2]![2] = 255;
  for (const packet of bad) {
    assert.equal(new GameMotionDecoder().decode(packet), undefined);
    assert.equal(new release.d6().decode(packet), undefined);
  }
});

test("encoder validation and malformed floats keep released behavior", () => {
  const current = new GameMotionEncoder(identity);
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
  new DataView(packet.buffer).setFloat32(56 + 4, Infinity, true);
  assert.equal(new GameMotionDecoder().decode(packet), undefined);
  assert.equal(new release.d6().decode(packet), undefined);
});
