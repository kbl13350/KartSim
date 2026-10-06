import type { RacePoint } from "./race-driving-scales";
import type { KinematicMotionSample, MotionCollision, MotionPresentation,
  MotionRaceProgress, Quaternion } from "./payload";

export interface OutgoingMotionBody {
  position: RacePoint;
  linearVelocity: RacePoint;
  angularVelocity: RacePoint;
}

export interface OutgoingMotionSource {
  networkMotionMode: number;
  body: OutgoingMotionBody;
  copyNetworkWrench(wrench: { force: RacePoint; torque: RacePoint }): void;
  networkCollisionState?(): MotionCollision | undefined;
  state?: { visualScale: { x: number; y: number; z: number } };
}

export interface OutgoingMotionClock {
  encode(timeMs: number): number;
}

export interface OutgoingMotionConnection {
  hasMotionRecipients?: boolean;
  directMotionAvailable?(slot: number): boolean;
  sendMotion(sample: KinematicMotionSample, recipientMask?: number): boolean;
}

export interface OutgoingMotionRouting {
  cadence: {
    select(timeMs: number, motionMode: number, suspended: boolean,
      position: RacePoint, remotePosition: (id: string) => RacePoint | undefined,
      directMotionAvailable: (slot: number) => boolean): number;
  };
  playerId: string;
  position(id: string): RacePoint | undefined;
}

export type BodyQuaternion = (body: OutgoingMotionBody) =>
  { w: number; x: number; y: number; z: number };

/** Convert one client-space vector to the wire-space float32 coordinates. */
function wireVector(vector: RacePoint): [number, number, number] {
  return [Math.fround(vector.x), Math.fround(-vector.z), Math.fround(vector.y)];
}

export function isKnownNetworkMotionMode(mode: number): boolean {
  return mode === 0 || mode === 1 || mode === 2 || mode === 3 ||
    mode === 5 || mode === 6;
}

/** Capture a physics body as the network's kinematic sample. */
export function captureOutgoingMotion(
  source: OutgoingMotionSource,
  tick: number,
  suspended: boolean,
  bodyQuaternion: BodyQuaternion,
): KinematicMotionSample {
  if (!isKnownNetworkMotionMode(source.networkMotionMode)) {
    throw new Error(`多人联机遇到未知运动状态 ${source.networkMotionMode}。`);
  }
  const body = source.body;
  const wrench = {
    force: { x: 0, y: 0, z: 0 },
    torque: { x: 0, y: 0, z: 0 },
  };
  source.copyNetworkWrench(wrench);
  const quaternion = bodyQuaternion(body);
  const specialMotion = source.networkMotionMode !== 0;
  return {
    kind: "kinematic",
    tick,
    position: wireVector(body.position),
    quaternion: [quaternion.w, quaternion.x, quaternion.y, quaternion.z] as Quaternion,
    linearVelocity: suspended ? [0, 0, 0] : wireVector(body.linearVelocity),
    angularVelocity: suspended ? [0, 0, 0] : wireVector(body.angularVelocity),
    vector5C: suspended || specialMotion ? [0, 0, 0] : wireVector(wrench.force),
    vector68: suspended || specialMotion ? [0, 0, 0] : wireVector(wrench.torque),
  };
}

/** Owns the 64 ms send gate and composes full multiplayer motion samples. */
export class OutgoingRaceMotionSender {
  source: OutgoingMotionSource;
  clock: OutgoingMotionClock;
  connection: OutgoingMotionConnection;
  routing: OutgoingMotionRouting | undefined;
  bodyQuaternion: BodyQuaternion;
  lastBucket: number | undefined;
  disposed = false;

  constructor(source: OutgoingMotionSource, clock: OutgoingMotionClock,
    connection: OutgoingMotionConnection, routing: OutgoingMotionRouting | undefined,
    bodyQuaternion: BodyQuaternion) {
    this.source = source;
    this.clock = clock;
    this.connection = connection;
    this.routing = routing;
    this.bodyQuaternion = bodyQuaternion;
  }

  update(nowMs: number, presentation?: MotionPresentation,
    progress?: MotionRaceProgress, suspended = false,
    resetStartedAt?: number): boolean {
    if (this.disposed) return false;
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      throw new Error("Invalid outgoing motion clock");
    }
    const bucket = Math.floor(nowMs / 64);
    if (this.lastBucket !== undefined && bucket < this.lastBucket) {
      throw new Error("Outgoing motion clock moved backwards");
    }
    if (bucket === this.lastBucket ||
      ((this.lastBucket = bucket), this.connection.hasMotionRecipients === false)) {
      return false;
    }
    if (!isKnownNetworkMotionMode(this.source.networkMotionMode)) {
      throw new Error(`多人联机遇到未知运动状态 ${this.source.networkMotionMode}。`);
    }

    const recipients = this.routing?.cadence.select(
      Math.trunc(nowMs), this.source.networkMotionMode,
      suspended || resetStartedAt !== undefined,
      this.source.body.position, this.routing.position,
      slot => this.connection.directMotionAvailable?.(slot) ?? false,
    );
    if (recipients === 0) return false;

    const base = captureOutgoingMotion(this.source, this.clock.encode(nowMs),
      suspended, this.bodyQuaternion);
    const collision = this.source.networkCollisionState?.();
    const sample: KinematicMotionSample = {
      ...base,
      ...(progress && presentation && collision ? { collision } : {}),
      ...(resetStartedAt === undefined ? {} :
        { resetStartedAt: this.clock.encode(resetStartedAt) }),
      ...(presentation ? { presentation } : {}),
      ...(progress ? { raceProgress: progress } : {}),
    };
    if (presentation?.animation && progress && collision) {
      if (!this.source.state) {
        throw new Error("Race motion requires final visual scale");
      }
      sample.visualScale = { ...this.source.state.visualScale };
    }
    if (this.routing) {
      if (!presentation?.animation || !progress || !collision) {
        throw new Error("Distance cadence requires full race motion");
      }
      sample.routing = {
        motionMode: this.source.networkMotionMode,
        observedPlayerId: this.routing.playerId,
      };
      return this.connection.sendMotion(sample, recipients);
    }
    return this.connection.sendMotion(sample);
  }

  dispose(): void {
    this.disposed = true;
  }
}
