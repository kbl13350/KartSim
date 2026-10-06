import { integrateOrientation, matrixFromQuaternion } from "../driving/orientation-math";
import type { RailMatrix } from "../driving/rail-frame";

type Vector = [number, number, number];
type Quaternion = [number, number, number, number];

export interface RemoteMotionSnapshot {
  kind: string;
  tick?: number;
  flags: [number, number, ...number[]];
  position: Vector;
  quaternion: Quaternion;
  linearVelocity: Vector;
  angularVelocity: Vector;
  vector5C: Vector;
  vector68: Vector;
  collision?: { active?: boolean; [key: string]: unknown };
  presentation?: unknown;
  visualScale?: { x: number; y: number; z: number };
  resetStartedAt?: number;
  raceProgress?: { finishElapsedMs?: number; [key: string]: unknown };
  [key: string]: unknown;
}

export interface RemoteMotionFrameOptions {
  bypass: boolean;
  locked: boolean;
}

const float = Math.fround;
const identity = (): RailMatrix => [
  { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 },
];
const add = (left: Vector, right: Vector): Vector => [
  float(left[0] + right[0]), float(left[1] + right[1]),
  float(left[2] + right[2]),
];
const scale = (value: Vector, factor: number): Vector => [
  float(value[0] * factor), float(value[1] * factor),
  float(value[2] * factor),
];
const cross = (left: Vector, right: Vector): Vector => [
  float(float(left[1] * right[2]) - float(left[2] * right[1])),
  float(float(left[2] * right[0]) - float(left[0] * right[2])),
  float(float(left[0] * right[1]) - float(left[1] * right[0])),
];

/** Released float32 row-vector multiplication for the remote inertia tensor. */
function inertiaProduct(matrix: RailMatrix, vector: Vector): Vector {
  const product = (row: RailMatrix[number]): number => float(
    float(float(row.x * vector[0]) + float(row.y * vector[1])) +
      float(row.z * vector[2]));
  return [product(matrix[0]), product(matrix[1]), product(matrix[2])];
}

function overwriteMatrix(target: RailMatrix, source: RailMatrix): void {
  for (let index = 0; index < 3; index += 1) {
    target[index]!.x = source[index]!.x;
    target[index]!.y = source[index]!.y;
    target[index]!.z = source[index]!.z;
  }
}

/** Receives and predicts the pose of one peer's vehicle between packets. */
export class RemoteMotionPredictor {
  readonly mass: number;
  readonly inertia: RailMatrix;
  snapshot?: RemoteMotionSnapshot;
  snapshotTick = 0;
  eligible = true;
  futureTickInvalid = false;
  snapshotAgeDisplay = 0;
  previousTick?: number;
  position: Vector = [0, 0, 0];
  velocity: Vector = [0, 0, 0];
  angular: Vector = [0, 0, 0];
  rotation: RailMatrix = identity();

  constructor(mass: number, inertia: RailMatrix) {
    this.mass = mass;
    if (!Number.isFinite(float(mass)) || float(mass) <= 0 ||
        !Number.isFinite(float(1 / mass)) ||
        inertia.some(row => Object.values(row).some(value =>
          !Number.isFinite(float(value))))) {
      throw new Error("Invalid remote motion parameters");
    }
    this.inertia = structuredClone(inertia);
  }

  receive(snapshot: RemoteMotionSnapshot, sampleTick: number,
    currentTick: number): boolean {
    if (![sampleTick, currentTick].every(value =>
      Number.isSafeInteger(value) && value > 0)) {
      throw new Error("Invalid remote clock");
    }
    if (snapshot.kind !== "kinematic" && (snapshot.flags[1] & 7) !== 0)
      throw new Error("Special remote motion is not supported");
    const values = [
      ...snapshot.position, ...snapshot.quaternion, ...snapshot.linearVelocity,
      ...snapshot.angularVelocity, ...snapshot.vector5C, ...snapshot.vector68,
    ];
    const quaternionNorm = snapshot.quaternion.reduce(
      (sum, value) => float(sum + float(value * value)), 0);
    if (values.some(value => !Number.isFinite(float(value))) ||
        !Number.isFinite(quaternionNorm) || quaternionNorm <= 0) {
      throw new Error("Invalid remote motion snapshot");
    }
    this.futureTickInvalid = ((currentTick - sampleTick) | 0) < -2_000;
    this.eligible = snapshot.kind === "kinematic"
      ? snapshot.collision?.active === true : (snapshot.flags[0] & 1) !== 0;
    const acceptedTick = Math.min(sampleTick, currentTick);
    if (this.snapshot && acceptedTick <= this.snapshotTick) return false;
    this.snapshot = structuredClone(snapshot);
    this.snapshotTick = acceptedTick;
    this.snapshotAgeDisplay = 0;
    this.previousTick = undefined;
    return true;
  }

  collisionState(): RemoteMotionSnapshot["collision"] | undefined {
    const snapshot = this.snapshot;
    if (!this.eligible || !snapshot || snapshot.kind !== "kinematic" ||
        !snapshot.collision) return undefined;
    return snapshot.collision;
  }

  get active(): boolean { return this.eligible; }
  get rankSnapshotAge(): number { return this.snapshotAgeDisplay; }

  updateEligibility(nowTick: number, options: RemoteMotionFrameOptions): void {
    if (!this.snapshot) {
      this.snapshotAgeDisplay = 0;
      if (!options.locked) this.eligible = false;
      return;
    }
    const age = (nowTick - this.snapshotTick) >>> 0;
    if (this.snapshotAgeDisplay !== 0) {
      if (age > 5_000) this.snapshotAgeDisplay = 0;
    } else if (nowTick <= this.snapshotTick) {
      this.snapshotAgeDisplay = 1;
    } else if (age <= 5_000) {
      this.snapshotAgeDisplay = age;
    }
    if (!options.bypass) this.eligible =
      (age <= 5_000 && !this.futureTickInvalid && this.eligible) ||
      options.locked;
  }

  update(nowTick: number, options: RemoteMotionFrameOptions): void {
    if (!Number.isSafeInteger(nowTick) || nowTick < 0)
      throw new Error("Invalid remote frame clock");
    this.updateEligibility(nowTick, options);
    const snapshot = this.snapshot;
    if (!snapshot) return;
    if (nowTick < (this.previousTick ?? this.snapshotTick))
      throw new Error("Remote frame clock moved backwards");
    if (options.bypass) {
      this.previousTick = nowTick;
      return;
    }
    if (this.previousTick === undefined) {
      this.position = [...snapshot.position];
      this.velocity = [...snapshot.linearVelocity];
      this.angular = [...snapshot.angularVelocity];
      this.restoreRotation();
      this.previousTick = this.snapshotTick;
    }
    if (options.locked) {
      this.position = [...snapshot.position];
      this.restoreRotation();
    } else {
      let remainingMs = Math.min(nowTick - this.previousTick, 200);
      while (remainingMs > 0) {
        const sliceMs = Math.min(remainingMs, 10);
        remainingMs -= sliceMs;
        const seconds = float(float(sliceMs) * float(0.001));
        const acceleration: Vector = [
          float(snapshot.vector5C[0] / this.mass),
          float(snapshot.vector5C[1] / this.mass),
          float(snapshot.vector5C[2] / this.mass),
        ];
        this.velocity = add(this.velocity, scale(acceleration, seconds));
        const gyroscopic = cross(this.angular,
          inertiaProduct(this.inertia, this.angular));
        const torque: Vector = [
          float(snapshot.vector68[0] - gyroscopic[0]),
          float(snapshot.vector68[1] - gyroscopic[1]),
          float(snapshot.vector68[2] - gyroscopic[2]),
        ];
        this.angular = add(this.angular,
          scale(inertiaProduct(this.inertia, torque), seconds));
        this.position = add(this.position, scale(this.velocity, seconds));
        overwriteMatrix(this.rotation, integrateOrientation(this.rotation,
          { x: this.angular[0], y: this.angular[1], z: this.angular[2] }, seconds));
        if ([...this.position, ...this.velocity, ...this.angular,
          ...this.rotation.flatMap(row => [row.x, row.y, row.z])]
          .some(value => !Number.isFinite(value))) {
          this.clear();
          throw new Error("Remote motion overflow");
        }
      }
    }
    this.previousTick = nowTick;
  }

  restoreRotation(): void {
    const [w, x, y, z] = this.snapshot!.quaternion;
    overwriteMatrix(this.rotation, matrixFromQuaternion({ w, x, y, z }));
  }

  copyPose(): { position: Vector; rotation: RailMatrix; velocity: Vector;
    angularVelocity: Vector } | undefined {
    if (this.previousTick === undefined) return undefined;
    return { position: [...this.position], rotation: structuredClone(this.rotation),
      velocity: [...this.velocity], angularVelocity: [...this.angular] };
  }

  clear(): void {
    this.snapshot = undefined;
    this.snapshotTick = 0;
    this.previousTick = undefined;
    this.eligible = true;
    this.futureTickInvalid = false;
    this.snapshotAgeDisplay = 0;
  }
}

/** Convert between wall-clock milliseconds and unsigned motion packet ticks. */
export class MotionClockMapping {
  readonly offset: number;

  constructor(mapping: { offsetMs: number }) {
    if (!Number.isFinite(mapping.offsetMs))
      throw new Error("Invalid motion clock mapping");
    this.offset = mapping.offsetMs;
  }

  encode(localMilliseconds: number): number {
    const mapped = Math.trunc(localMilliseconds + this.offset);
    if (!Number.isFinite(localMilliseconds) || localMilliseconds < 0 ||
        !Number.isSafeInteger(mapped) || mapped < 0)
      throw new Error("Invalid motion clock");
    return mapped >>> 0;
  }

  decode(packetTick: number, localMilliseconds: number): number {
    if (!Number.isInteger(packetTick) || packetTick < 0 || packetTick > 0xffff_ffff ||
        !Number.isFinite(localMilliseconds) || localMilliseconds < 0)
      throw new Error("Invalid motion clock");
    const mapped = localMilliseconds + this.offset;
    const expanded = packetTick + Math.round((mapped - packetTick) / 0x1_0000_0000) *
      0x1_0000_0000;
    const local = Math.trunc(expanded - this.offset);
    if (!Number.isSafeInteger(local))
      throw new Error("Invalid expanded motion clock");
    return local;
  }
}
