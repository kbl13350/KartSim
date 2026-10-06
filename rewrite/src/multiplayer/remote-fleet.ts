import { MotionClockMapping, RemoteMotionPredictor,
  type RemoteMotionFrameOptions, type RemoteMotionSnapshot } from "./remote-motion";
import type { RailMatrix } from "../driving/rail-frame";

type Vector = [number, number, number];

export interface RemoteFleetAssets {
  roomId: string;
  raceId: string;
  drivingMode?: { kind: string };
  participants: Array<{
    playerId: string;
    slot: number;
    remoteParameters: { mass: number; [key: string]: unknown };
  }>;
}

export interface MotionPacket {
  roomId: string;
  raceId: string;
  playerId: string;
  sequence: number;
  payload: RemoteMotionSnapshot & { tick: number };
}

export interface GiantStatePacket {
  roomId: string;
  raceId: string;
  playerId: string;
  sequence: number;
  [key: string]: unknown;
}

interface GiantPresentation {
  mainScale: { x: number; y: number };
  receive(packet: GiantStatePacket, now: number): void;
  updateEffects(now: number): void;
  updateVehicle(now: number, callback: () => void): void;
  nativeFlattenMode(mode: unknown): void;
  visualScale(): { x: number; y: number; z: number };
  reset(): void;
  dispose(): void;
}

interface PresentationBuffer {
  receive(value: unknown): void;
  consume(): unknown;
}

export interface RemoteFleetConnection {
  roomId: string;
  raceId: string;
  playerId: string;
  motionRoundTripMs?: number;
  subscribeMotion(listener: (packet: MotionPacket) => void): () => void;
  subscribeGiantState?(listener: (packet: GiantStatePacket) => void): () => void;
}

export interface RemoteFleetCadence {
  recordReceipt(playerId: string, receivedAt: number): void;
  observe(playerId: string, payload: RemoteMotionSnapshot): void;
  collisionScale(playerId: string, roundTripMs: number | undefined): unknown;
}

export interface RemoteFleetDependencies {
  createPresentation(): PresentationBuffer;
  createGiant(): GiantPresentation;
  validateGiantState(giant: GiantPresentation, packet: GiantStatePacket): boolean;
  newerSequence(sequence: number, previous: number): boolean;
  resetVisible(elapsedMs: number): boolean;
}

interface RemotePeer {
  parameters: RemoteFleetAssets["participants"][number]["remoteParameters"];
  motion: RemoteMotionPredictor;
  presentation: PresentationBuffer;
  sequence?: number;
  receivedAt?: number;
  resetStartedAt?: number;
  progress?: { finishElapsedMs?: number; [key: string]: unknown };
  visualScale?: { x: number; y: number; z: number };
}

function webBasis(matrix: RailMatrix) {
  return {
    right: { x: matrix[0].x, y: matrix[2].x,
      z: Math.fround(-matrix[1].x) },
    forward: { x: Math.fround(-matrix[0].y),
      y: Math.fround(-matrix[2].y), z: matrix[1].y },
    up: { x: matrix[0].z, y: matrix[2].z,
      z: Math.fround(-matrix[1].z) },
  };
}

const vector = (value: Vector) => ({ x: value[0], y: value[1], z: value[2] });

/** Peer roster, packet admission, prediction and collision projection for a race. */
export class RemoteFleet {
  readonly connection: RemoteFleetConnection;
  readonly now: () => number;
  readonly onError: (error: unknown) => void;
  readonly cadence?: RemoteFleetCadence;
  readonly remotes = new Map<string, RemotePeer>();
  readonly collisionOrder: string[];
  readonly departed = new Set<string>();
  clock?: MotionClockMapping;
  unsubscribe?: () => void;
  disposed = false;
  readonly giants = new Map<string, GiantPresentation>();
  readonly giantSequences = new Map<string, number>();
  offGiant?: () => void;
  giantFinished = false;

  constructor(assets: RemoteFleetAssets, connection: RemoteFleetConnection,
    now: () => number, onError: (error: unknown) => void,
    cadence: RemoteFleetCadence | undefined,
    private readonly deps: RemoteFleetDependencies) {
    this.connection = connection;
    this.now = now;
    this.onError = onError;
    this.cadence = cadence;
    if (assets.roomId !== connection.roomId || assets.raceId !== connection.raceId ||
        !assets.participants.some(player => player.playerId === connection.playerId)) {
      throw new Error("Remote fleet identity mismatch");
    }
    const slots = new Set<number>();
    for (const player of assets.participants) {
      if (!Number.isInteger(player.slot) || player.slot < 0 || player.slot > 7 ||
          slots.has(player.slot)) {
        throw new Error("Remote fleet requires unique frozen race slots");
      }
      slots.add(player.slot);
    }
    this.collisionOrder = assets.participants
      .filter(player => player.playerId !== connection.playerId)
      .slice().sort((a, b) => a.slot - b.slot)
      .map(player => player.playerId);
    for (const player of assets.participants) {
      if (player.playerId === connection.playerId) continue;
      if (this.remotes.has(player.playerId))
        throw new Error("Duplicate remote identity");
      const mass = Math.fround(player.remoteParameters.mass);
      const diagonal = Math.fround(12 / mass);
      const inertia: RailMatrix = [
        { x: diagonal, y: 0, z: 0 },
        { x: 0, y: diagonal, z: 0 },
        { x: 0, y: 0, z: diagonal },
      ];
      this.remotes.set(player.playerId, {
        parameters: player.remoteParameters,
        motion: new RemoteMotionPredictor(mass, inertia),
        presentation: deps.createPresentation(),
      });
      if (assets.drivingMode?.kind === "giant")
        this.giants.set(player.playerId, deps.createGiant());
    }
    this.unsubscribe = connection.subscribeMotion(packet => {
      try { this.receive(packet); }
      catch (error) { this.dispose(); this.onError(error); }
    });
    if (assets.drivingMode?.kind === "giant") {
      if (!connection.subscribeGiantState) {
        this.dispose();
        throw new Error("缺少巨人状态接收通道。");
      }
      this.offGiant = connection.subscribeGiantState(packet => this.receiveGiant(packet));
    }
  }

  receiveGiant(packet: GiantStatePacket): void {
    if (this.disposed || this.giantFinished || !this.clock ||
        packet.roomId !== this.connection.roomId ||
        packet.raceId !== this.connection.raceId ||
        this.departed.has(packet.playerId) ||
        packet.sequence <= (this.giantSequences.get(packet.playerId) ?? 0)) return;
    const giant = this.giants.get(packet.playerId);
    if (!giant) return;
    if (packet.sequence !== (this.giantSequences.get(packet.playerId) ?? 0) + 1 ||
        !this.deps.validateGiantState(giant, packet)) {
      try { this.onError(new Error("巨人有序状态链缺失或非法。")); }
      finally { this.dispose(); }
      return;
    }
    this.giantSequences.set(packet.playerId, packet.sequence);
    giant.receive(packet, this.now());
  }

  giant(playerId: string): GiantPresentation | undefined {
    return this.disposed ? undefined : this.giants.get(playerId);
  }

  updateGiantEffects(now: number): void {
    for (const giant of this.giants.values()) giant.updateEffects(now);
  }

  resetGiants(): void {
    this.giantFinished = true;
    for (const giant of this.giants.values()) giant.reset();
  }

  bindClock(mapping: { offsetMs: number }): void {
    if (this.disposed || this.clock)
      throw new Error("Remote fleet clock already bound or released");
    this.clock = new MotionClockMapping(mapping);
  }

  receive(packet: MotionPacket): void {
    if (this.disposed || !this.clock ||
        packet.roomId !== this.connection.roomId ||
        packet.raceId !== this.connection.raceId) return;
    const peer = this.remotes.get(packet.playerId);
    if (!peer || this.departed.has(packet.playerId) ||
        (peer.sequence !== undefined &&
          !this.deps.newerSequence(packet.sequence, peer.sequence))) return;
    const now = Math.trunc(this.now());
    const packetTick = this.clock.decode(packet.payload.tick, now);
    if (packetTick <= 0 || now <= 0) return;
    this.cadence?.recordReceipt(packet.playerId, now);
    const accepted = peer.motion.receive(packet.payload, packetTick, now);
    this.cadence?.observe(packet.playerId, packet.payload);
    peer.sequence = packet.sequence;
    if (packet.payload.kind === "kinematic" && packet.payload.presentation) {
      peer.presentation.receive(packet.payload.presentation);
      if (!this.giantFinished) this.giants.get(packet.playerId)?.nativeFlattenMode(
        (packet.payload.presentation as { visualScaleMode?: unknown }).visualScaleMode);
    }
    if (packet.payload.kind === "kinematic" && packet.payload.visualScale)
      peer.visualScale = { ...packet.payload.visualScale };
    if (accepted) {
      peer.receivedAt = now;
      peer.resetStartedAt = packet.payload.kind === "kinematic" &&
        packet.payload.resetStartedAt !== undefined
        ? this.clock.decode(packet.payload.resetStartedAt, now) : undefined;
      if (packet.payload.kind === "kinematic" && packet.payload.raceProgress)
        peer.progress = { ...packet.payload.raceProgress };
    }
  }

  updateRoom(room: { roomId: string; race?: { raceId: string };
    members: Array<{ playerId: string }> }): void {
    if (this.disposed) return;
    if (room.roomId !== this.connection.roomId ||
        room.race?.raceId !== this.connection.raceId ||
        !room.members.some(member => member.playerId === this.connection.playerId)) {
      this.dispose();
      return;
    }
    const members = new Set(room.members.map(member => member.playerId));
    for (const playerId of this.remotes.keys())
      if (!members.has(playerId)) this.departed.add(playerId);
  }

  update(now: number, options: RemoteMotionFrameOptions): void {
    if (this.disposed || !this.clock) return;
    try {
      for (const [playerId, peer] of this.remotes) {
        peer.motion.update(Math.trunc(now), options);
        this.giants.get(playerId)?.updateVehicle(now, () => {});
      }
    } catch (error) {
      this.dispose();
      this.onError(error);
    }
  }

  raceProgress(playerId: string): RemotePeer["progress"] | undefined {
    return this.disposed ? undefined : this.remotes.get(playerId)?.progress;
  }

  updateAndForEachFreshRacePeer(now: number, options: RemoteMotionFrameOptions,
    callback: (playerId: string, progress: RemotePeer["progress"],
      pose: ReturnType<RemoteFleet["copyWebPose"]>, speedKmh: number) => void): void {
    this.update(now, options);
    this.forEachFreshRacePeer(now, callback);
  }

  forEachFreshRacePeer(now: number,
    callback: (playerId: string, progress: RemotePeer["progress"],
      pose: ReturnType<RemoteFleet["copyWebPose"]>, speedKmh: number) => void): void {
    if (this.disposed) return;
    for (const [playerId, peer] of this.remotes) {
      if (this.departed.has(playerId) || peer.receivedAt === undefined ||
          now - peer.receivedAt > 1_000 || now < peer.receivedAt ||
          peer.progress?.finishElapsedMs !== undefined ||
          peer.resetStartedAt !== undefined) continue;
      const velocity = peer.motion.copyPose()?.velocity;
      callback(playerId, peer.progress, this.copyWebPose(playerId),
        velocity ? Math.hypot(...velocity) * 3.6 : NaN);
    }
  }

  forEachCollisionBody(_frame: unknown, callback: (body: Record<string, unknown>,
    scale: unknown, playerId: string) => void): void {
    if (this.disposed) return;
    for (const playerId of this.collisionOrder) {
      const peer = this.remotes.get(playerId)!;
      const collision = peer.motion.collisionState();
      const pose = peer.motion.copyPose();
      if (!collision || !pose) continue;
      const giant = this.giants.get(playerId);
      callback({
        ...peer.parameters,
        position: vector(pose.position),
        rotation: pose.rotation,
        velocity: vector(pose.velocity),
        angularVelocity: vector(pose.angularVelocity),
        scaleX: giant?.mainScale.x ?? collision.scaleX,
        scaleY: giant?.mainScale.y ?? collision.scaleY,
      }, this.cadence?.collisionScale(playerId,
        this.connection.motionRoundTripMs), playerId);
    }
  }

  rankDisconnected(playerId: string): boolean {
    const peer = this.remotes.get(playerId);
    return !this.disposed && peer !== undefined &&
      peer.motion.rankSnapshotAge === 0;
  }

  presentationVisible(playerId: string, now: number): boolean {
    const peer = this.remotes.get(playerId);
    return !this.disposed && !!peer &&
      (peer.motion.active || (Math.trunc(now) >>> 0) % 200 >= 100) &&
      this.resetVisible(playerId, now);
  }

  resetVisible(playerId: string, now: number): boolean {
    const startedAt = this.remotes.get(playerId)?.resetStartedAt;
    return this.disposed || startedAt === undefined || now - startedAt > 2_000
      ? true : this.deps.resetVisible(Math.max(0, now - startedAt));
  }

  consumePresentation(playerId: string): unknown {
    return this.disposed ? undefined : this.remotes.get(playerId)?.presentation.consume();
  }

  copyWebPose(playerId: string) {
    const peer = this.remotes.get(playerId);
    const pose = peer?.motion.copyPose();
    if (!pose || this.disposed) return undefined;
    return {
      position: { x: pose.position[0], y: pose.position[2],
        z: Math.fround(-pose.position[1]) },
      ...webBasis(pose.rotation),
      visualScale: this.giants.get(playerId)?.visualScale() ??
        { ...(peer?.visualScale ?? { x: 1, y: 1, z: 1 }) },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.offGiant?.();
    this.offGiant = undefined;
    for (const giant of this.giants.values()) giant.dispose();
    this.giants.clear();
    this.giantSequences.clear();
    for (const peer of this.remotes.values()) peer.motion.clear();
    this.remotes.clear();
    this.collisionOrder.length = 0;
    this.departed.clear();
    this.clock = undefined;
  }
}
