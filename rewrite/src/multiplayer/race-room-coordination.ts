import { sameItemRaceRules } from "./lobby-item-mode";
import type { RacePoint } from "./race-driving-scales";

/** Authoritative room changes and resource lifetime for an active multiplayer race. */

export interface ActiveRaceRoom {
  roomId: string;
  channelName: string;
  phase: string;
  members: readonly { playerId: string }[];
  race?: {
    raceId: string;
    channelName: string;
    rp?: unknown;
    roadblock?: unknown;
    lte?: unknown;
    giant?: unknown;
    item?: unknown;
    finishDeadline?: number;
    roadblockOutcome?: { endAt?: number };
    raceOverAt?: number;
    startAt?: number;
    results?: unknown;
    finishes?: unknown[];
  };
}

export interface RaceRoomDependencies {
  modeOf(room: ActiveRaceRoom | ActiveRaceRoom["race"]): string;
  sameRp(first: unknown, second: unknown): boolean;
  sameRoadblock(first: unknown, second: unknown): boolean;
  sameLte(first: unknown, second: unknown): boolean;
  sameGiant(first: unknown, second: unknown): boolean;
  toLocalTick(serverTick: number, mapping: unknown): number;
  racingState: number;
}

export interface RaceRoomRuntimeHost {
  disposed: boolean;
  assets: {
    channel: { name: string };
    drivingMode?: { kind: string };
    roomId: string;
    raceId: string;
    dispose(): void;
  };
  connection: { playerId: string; resetMotionRtt?(): void };
  onError(error: Error): void;
  rpIdentity?: unknown;
  roadblockIdentity?: { runnerId?: string; limitMs: number };
  lteIdentity?: unknown;
  giantIdentity?: unknown;
  itemIdentity?: unknown;
  room?: ActiveRaceRoom;
  mapping?: unknown;
  finishDeadline?: number;
  cadence?: { updateRoom(room: ActiveRaceRoom): void; dispose(): void };
  remotes: {
    updateRoom(room: ActiveRaceRoom): void;
    raceProgress?(id: string): unknown;
    dispose(): void;
  };
  local: {
    lifecycle: { state: number };
    acceptEndTiming(finishDeadline: number | undefined, raceOverAt: number | undefined,
      resultsReady: boolean): void;
    raceProgress?(): unknown;
    physics: {
      setMultiplayerDrivingScales(scales: { catchupDrag: number; catchupSteering: number;
        draftAcceleration: number; chargerDuration: number }): void;
    };
    dispose(): void;
  };
  sender?: { dispose(): void };
  offTeam?: () => void;
  teamCharge: number;
  slipstream: { reset(): void };
  remoteSlipstreams: Map<string, unknown>;
  collisionFramerate: { dispose(): void };
  dispose(): void;
}

export interface RaceClockHost {
  disposed: boolean;
  clockBound: boolean;
  remotes: {
    bindClock(mapping: unknown): void;
    copyWebPose(id: string): { position: RacePoint } | undefined;
  };
  cadence?: unknown;
  local: { physics: unknown; scheduleStart(startAtMs: number): void };
  connection: { playerId: string };
  sender?: { dispose(): void };
  mapping?: unknown;
}

export interface RaceClockDependencies {
  makeClock(mapping: unknown): unknown;
  makeSender(physics: unknown, clock: unknown,
    connection: RaceClockHost["connection"], routing: {
      cadence: unknown;
      playerId: string;
      position(id: string): RacePoint | undefined;
    }): { dispose(): void };
}

/** Bind the remote clock before preparing the local sender. */
export function bindActiveRaceClock(
  host: RaceClockHost,
  mapping: unknown,
  dependencies: RaceClockDependencies,
): void {
  if (host.disposed || host.clockBound) {
    throw new Error("Race clock already bound or released");
  }
  host.remotes.bindClock(mapping);
  if (!host.cadence) throw new Error("Race cadence is not prepared");
  host.sender = dependencies.makeSender(
    host.local.physics, dependencies.makeClock(mapping), host.connection,
    {
      cadence: host.cadence,
      playerId: host.connection.playerId,
      position: id => host.remotes.copyWebPose(id)?.position,
    },
  );
  host.clockBound = true;
  host.mapping = mapping;
}

/** Hand the server's start time to the local countdown once the clock is bound. */
export function scheduleActiveRaceStart(host: RaceClockHost, startAtMs: number): void {
  if (host.disposed || !host.clockBound) {
    throw new Error("Race clock is not ready");
  }
  host.local.scheduleStart(startAtMs);
}

/** Reject identity drift and propagate the server's race end clocks. */
export function updateActiveRaceRoom(
  host: RaceRoomRuntimeHost,
  room: ActiveRaceRoom,
  dependencies: RaceRoomDependencies,
): void {
  if (host.disposed) return;

  if (room.channelName !== host.assets.channel.name ||
    dependencies.modeOf(room) !== (host.assets.drivingMode?.kind ?? "ordinary") ||
    (room.race && (
      room.race.channelName !== host.assets.channel.name ||
      dependencies.modeOf(room.race) !== dependencies.modeOf(room) ||
      !dependencies.sameRp(room.race.rp, host.rpIdentity) ||
      !dependencies.sameRoadblock(room.race.roadblock, host.roadblockIdentity) ||
      !dependencies.sameLte(room.race.lte, host.lteIdentity) ||
      !dependencies.sameGiant(room.race.giant, host.giantIdentity) ||
      !sameItemRaceRules(room.race.item, host.itemIdentity)
    ))) {
    try {
      host.onError(new Error("比赛期间频道身份发生变化。"));
    } finally {
      host.dispose();
    }
    return;
  }

  if (room.phase === "open") {
    if (host.room?.race?.results) return;
    host.dispose();
    return;
  }
  if (room.roomId !== host.assets.roomId || room.race?.raceId !== host.assets.raceId ||
    !room.members.some(member => member.playerId === host.connection.playerId)) {
    host.dispose();
    return;
  }

  const deadlineChanged = room.race?.finishDeadline !== undefined &&
    room.race.finishDeadline !== host.room?.race?.finishDeadline;
  host.room = structuredClone(room);
  host.cadence?.updateRoom(room);
  if (deadlineChanged && host.local.lifecycle.state === dependencies.racingState) {
    host.connection.resetMotionRtt?.();
  }
  host.remotes.updateRoom(room);
  if (host.mapping) {
    host.finishDeadline = room.race?.finishDeadline === undefined ? undefined
      : dependencies.toLocalTick(room.race.finishDeadline, host.mapping);
    const roadblockEndAt = room.race?.roadblockOutcome?.endAt;
    host.local.acceptEndTiming(
      roadblockEndAt === undefined ? host.finishDeadline
        : dependencies.toLocalTick(roadblockEndAt, host.mapping),
      room.race?.raceOverAt === undefined ? undefined
        : dependencies.toLocalTick(room.race.raceOverAt, host.mapping),
      !!room.race?.results,
    );
  }
}

/** Remaining roadblock time in the local race clock, clamped to the limit. */
export function roadblockRemaining(
  host: Pick<RaceRoomRuntimeHost, "roadblockIdentity" | "room" | "mapping">,
  nowMs: number,
  toLocalTick: RaceRoomDependencies["toLocalTick"],
): number | undefined {
  if (!host.roadblockIdentity) return undefined;
  const startAt = host.room?.race?.startAt;
  if (startAt === undefined || !host.mapping) return host.roadblockIdentity.limitMs;
  const endAt = host.room?.race?.roadblockOutcome?.endAt;
  return Math.max(0, Math.min(host.roadblockIdentity.limitMs,
    host.roadblockIdentity.limitMs -
      ((endAt === undefined ? nowMs : toLocalTick(endAt, host.mapping)) -
        toLocalTick(startAt, host.mapping))));
}

/** Release the active race in the original order, including driving scales. */
export function disposeActiveRace(host: RaceRoomRuntimeHost): void {
  if (host.disposed) return;
  host.disposed = true;
  host.sender?.dispose();
  host.sender = undefined;
  host.offTeam?.();
  host.offTeam = undefined;
  host.teamCharge = 0;
  host.slipstream.reset();
  host.remoteSlipstreams.clear();
  host.collisionFramerate.dispose();
  host.local.physics.setMultiplayerDrivingScales({
    catchupDrag: 1,
    catchupSteering: 1,
    draftAcceleration: 1,
    chargerDuration: 1,
  });
  host.remotes.dispose();
  host.cadence?.dispose();
  host.local.dispose();
  host.assets.dispose();
}
