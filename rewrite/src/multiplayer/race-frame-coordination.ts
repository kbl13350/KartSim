import { teamGaugeEnabled } from "./lobby-item-mode";
import { chargerDurationScale, computeCatchupScales, SlipstreamBoost,
  type RacePoint, type SlipstreamPeer } from "./race-driving-scales";

export interface RaceFrameDependencies {
  racingState: number;
  resultState: number;
  captureMotion(physics: RaceFrameHost["local"]["physics"], frame: unknown): unknown;
  captureAnimation(physics: RaceFrameHost["local"]["physics"]): unknown;
}

interface RaceFramePresentation {
  frontLamp: boolean;
  rearLamp: boolean;
  animation?: unknown;
  [field: string]: unknown;
}

interface FreshRacePeer extends SlipstreamPeer {
  progress?: { distance: number };
}

export interface RaceFrameHost {
  disposed: boolean;
  remotePhysicsBypass: boolean;
  remoteFrameUpdated: boolean;
  finishReported: boolean;
  giantCleared: boolean;
  giantSequence: number;
  giantSend: Promise<unknown>;
  teamCharge: number;
  teamSentAt: number;
  teamSentSequence: number;
  assets: {
    mode: string;
    speed: number;
    drivingMode?: { kind: string };
    participants: readonly {
      playerId: string;
      vehicle: { physicsParams: { draftTick?: number; draftMulAccelFactor?: number } };
    }[];
  };
  connection: {
    playerId: string;
    resetMotionRtt?(): void;
    reportFinish?(elapsedMs: number): Promise<unknown>;
    sendTeamCharge(value: number, sequence: number): Promise<unknown>;
    sendGiantState?(packet: unknown, sequence: number): Promise<unknown>;
  };
  local: {
    lifecycle: { state: number; raceoverShown?: boolean; finishedElapsedMs?: number };
    physics: {
      body: { position: RacePoint; forward: RacePoint; linearVelocity: RacePoint };
      setMultiplayerDrivingScales(scales: {
        catchupDrag: number; catchupSteering: number; draftAcceleration: number;
        chargerDuration: number | undefined;
      }): void;
      clearGiantRaceEffects(): void;
      consumeMultiplayerTeamCharge(): number;
    };
    giant?: { consumePackets(): unknown[] };
    resetSuspended: boolean;
    resetStartedAt?: number;
    raceProgress(): { distance: number };
    update(nowMs: number, frame: unknown): { kind: string }[];
  };
  remotes: {
    updateAndForEachFreshRacePeer(nowMs: number, options: { bypass: boolean; locked: boolean },
      callback: (playerId: string, progress: { distance: number } | undefined,
        pose: { position: RacePoint; forward: RacePoint } | undefined,
        speedKmh: number) => void): void;
    update(nowMs: number, options: { bypass: boolean; locked: boolean }): void;
    resetGiants(): void;
  };
  /** 道具赛: timelines, area checks and aiming run before the local physics step. */
  itemRace?: { update(nowMs: number): void };
  slipstream: SlipstreamBoost;
  remoteSlipstreams: Map<string, SlipstreamBoost>;
  room?: { phase: string; race?: { loadedIds: readonly string[] } };
  presentation: { capture(motion: unknown, frame: unknown,
    animation: unknown): RaceFramePresentation };
  localPresentation?: {
    motion: unknown; frontLamp: boolean; rearLamp: boolean; animation: unknown;
  };
  sender?: { update(nowMs: number, presentation: RaceFramePresentation,
    progress: { distance: number }, suspended: boolean,
    resetStartedAt?: number): unknown };
  onError(error: unknown): void;
  updateRemotes(nowMs: number): void;
  dispose(): void;
}

/** Refresh peers once per frame, locking them outside the active race. */
export function updateRaceRemoteViews(host: RaceFrameHost, nowMs: number,
  states: Pick<RaceFrameDependencies, "racingState" | "resultState">): void {
  host.remoteFrameUpdated = true;
  const state = host.local.lifecycle.state;
  host.remotes.update(nowMs, {
    bypass: host.remotePhysicsBypass,
    locked: state < states.racingState || state === states.resultState ||
      host.local.lifecycle.raceoverShown === true,
  });
}

/** Coordinate race physics, remote views, team and giant effects, and outbound motion. */
export function updateActiveRaceFrame(host: RaceFrameHost, nowMs: number,
  frame: unknown, bypassRemotePhysics: boolean,
  dependencies: RaceFrameDependencies): { kind: string }[] {
  if (host.disposed) return [];
  try {
    host.remotePhysicsBypass = bypassRemotePhysics;
    host.remoteFrameUpdated = false;
    const physics = host.local.physics;

    if (host.local.lifecycle.state === dependencies.racingState) {
      const peers: FreshRacePeer[] = [];
      const remoteSpeeds = new Map<string, number>();
      host.remoteFrameUpdated = true;
      host.remotes.updateAndForEachFreshRacePeer(nowMs,
        { bypass: bypassRemotePhysics, locked: false },
        (playerId, progress, pose, speedKmh) => {
          if (!pose) return;
          peers.push({ playerId, position: pose.position,
            forward: pose.forward, progress });
          remoteSpeeds.set(playerId, speedKmh);
        });

      const catchup = computeCatchupScales(host.local.raceProgress().distance, peers);
      const localParams = host.assets.participants.find(
        participant => participant.playerId === host.connection.playerId,
      )!.vehicle.physicsParams;
      const speedKmh = Math.hypot(
        physics.body.linearVelocity.x,
        physics.body.linearVelocity.y,
        physics.body.linearVelocity.z,
      ) * 3.6;
      const draftAcceleration = host.slipstream.update(
        nowMs, physics.body.position, speedKmh, peers,
        localParams.draftTick ?? 0, localParams.draftMulAccelFactor ?? 1,
        host.local.resetSuspended,
      );
      physics.setMultiplayerDrivingScales({
        catchupDrag: catchup.drag,
        catchupSteering: catchup.steering,
        draftAcceleration,
        chargerDuration: chargerDurationScale(host.local.raceProgress().distance, peers),
      });

      const localPeer = {
        playerId: host.connection.playerId,
        position: physics.body.position,
        forward: physics.body.forward,
        progress: host.local.raceProgress(),
      };
      const currentIds = new Set(peers.map(peer => peer.playerId));
      for (const id of host.remoteSlipstreams.keys()) {
        if (!currentIds.has(id)) host.remoteSlipstreams.delete(id);
      }
      for (const peer of peers) {
        let slipstream = host.remoteSlipstreams.get(peer.playerId);
        if (!slipstream) {
          slipstream = new SlipstreamBoost();
          host.remoteSlipstreams.set(peer.playerId, slipstream);
        }
        const parameters = host.assets.participants.find(
          participant => participant.playerId === peer.playerId,
        )!.vehicle.physicsParams;
        slipstream.update(
          nowMs, peer.position, remoteSpeeds.get(peer.playerId)!,
          [localPeer, ...peers.filter(other => other.playerId !== peer.playerId)],
          parameters.draftTick ?? 0, parameters.draftMulAccelFactor ?? 1,
        );
      }
    } else {
      host.slipstream.reset();
      host.remoteSlipstreams.clear();
      physics.setMultiplayerDrivingScales({
        catchupDrag: 1, catchupSteering: 1,
        draftAcceleration: 1, chargerDuration: 1,
      });
    }

    host.itemRace?.update(nowMs);
    const actions = host.local.update(nowMs, frame);
    if (host.local.giant) {
      if (!host.giantCleared &&
        (host.local.lifecycle.state === dependencies.resultState ||
          host.room?.phase === "finished")) {
        host.giantCleared = true;
        host.local.physics.clearGiantRaceEffects();
        host.remotes.resetGiants();
      }
      for (const packet of host.local.giant.consumePackets()) {
        const sequence = ++host.giantSequence;
        host.giantSend = host.giantSend
          .then(() => {
            if (!(host.disposed || host.giantCleared)) {
              return host.connection.sendGiantState!(packet, sequence);
            }
          })
          .catch(error => {
            if (!host.disposed && host.room?.phase === "racing") host.onError(error);
          });
      }
    }

    if (actions.some(action => action.kind === "natural-finish") && !host.finishReported) {
      host.finishReported = true;
      host.connection.resetMotionRtt?.();
      if (!host.connection.reportFinish) {
        throw new Error("本局连接缺少完赛上报能力。");
      }
      const elapsedMs = host.local.lifecycle.finishedElapsedMs!;
      const report = () => host.disposed ? Promise.resolve()
        : host.connection.reportFinish!(elapsedMs);
      (host.local.giant ? host.giantSend.then(report) : report()).catch(error => {
        if (!host.disposed && host.room?.phase !== "finished") host.onError(error);
      });
    }

    if (teamGaugeEnabled(host.assets) &&
      host.assets.drivingMode?.kind !== "grip" &&
      ((host.teamCharge = Math.fround(
        host.teamCharge + physics.consumeMultiplayerTeamCharge(),
      )), host.local.lifecycle.state === dependencies.racingState &&
        host.teamCharge > 0 && nowMs - host.teamSentAt >= 100)) {
      const charge = host.teamCharge;
      host.teamCharge = 0;
      host.teamSentAt = nowMs;
      host.connection.sendTeamCharge(charge, ++host.teamSentSequence)
        .catch(error => {
          if (!host.disposed && host.room?.phase === "racing" &&
            !host.finishReported) host.onError(error);
        });
    }

    const motion = dependencies.captureMotion(physics, frame);
    const animation = dependencies.captureAnimation(physics);
    const presentation = host.presentation.capture(motion, frame, animation);
    host.localPresentation = {
      motion,
      frontLamp: presentation.frontLamp,
      rearLamp: presentation.rearLamp,
      animation,
    };
    if (!host.remoteFrameUpdated) host.updateRemotes(nowMs);
    if (!host.disposed && host.room?.phase !== "finished" &&
      host.room?.race?.loadedIds.includes(host.connection.playerId) &&
      host.local.lifecycle.state !== dependencies.resultState) {
      host.sender?.update(
        nowMs, presentation, host.local.raceProgress(),
        host.local.resetSuspended || host.local.lifecycle.state < dependencies.racingState,
        host.local.resetStartedAt,
      );
    }
    return actions;
  } catch (error) {
    if (host.disposed) throw error;
    try {
      host.onError(error);
    } finally {
      host.dispose();
    }
    return [];
  }
}
