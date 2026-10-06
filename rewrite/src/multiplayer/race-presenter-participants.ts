/** Updates each racer presentation after the multiplayer camera is positioned. */

interface Vec3 { x: number; y: number; z: number }
interface RacePose { position: Vec3; visualScale?: unknown; [key: string]: unknown }
interface RaceMotion {
  boosterState: number;
  instantAccelerationActive: boolean;
  [key: string]: unknown;
}
interface RacerPresentation {
  motion: RaceMotion;
  animation?: unknown;
  frontLamp: unknown;
  rearLamp: unknown;
}
interface SceneUpdater {
  update(...args: unknown[]): void;
}
interface VehicleAsset {
  imported: { renderScene?: SceneUpdater };
  lampFlares: {
    setInputPair(pair: string, input: unknown): void;
    update(nowMs: number, camera: unknown, imported: boolean): void;
  };
  trails: {
    setState(boost: number, nowMs: number): void;
    update(nowMs: number, camera: unknown, imported: boolean): void;
  };
  accessories: Array<{
    kind: string;
    render: {
      setOwnerState?(boost: number, nowMs: number): void;
      scene: SceneUpdater;
    };
  }>;
  decoration?: { scene: SceneUpdater };
}
interface RacerAsset {
  playerId: unknown;
  vehicle: VehicleAsset;
  draftEffect?: {
    update(nowMs: number, visible: boolean, burst: boolean,
      camera: unknown, width: number, height: number): void;
  };
  characters: {
    linked?: { scene: SceneUpdater };
    ordinary?: { scene: SceneUpdater };
  };
}
interface RacerView {
  root: { visible: boolean; updateMatrixWorld(force: boolean): void };
  update(state: Record<string, unknown>, nowMs: number,
    animationInput: unknown): unknown;
  updateRemote(pose: Record<string, unknown>, nowMs: number,
    animation: unknown): void;
  updatePose(pose: Record<string, unknown>): void;
}
interface LocalPhysics {
  body: {
    position: Vec3;
    right: unknown;
    forward: unknown;
    up: unknown;
  };
  state: Record<string, unknown>;
  giant?: { main: number; extra: unknown };
  consumeKartAnimationInput(): unknown;
  setAnimationSlot(slot: unknown): void;
}
interface RacerRemoteRuntime {
  consumePresentation(playerId: unknown): RacerPresentation | undefined;
  copyWebPose(playerId: unknown): RacePose | undefined;
  presentationVisible(playerId: unknown, nowMs: number): boolean;
  giant(playerId: unknown): { main: number; extra: unknown } | undefined;
}

export interface RacePresenterParticipantsHost {
  playerId: unknown;
  camera: unknown;
  assets: {
    map: { stageBinding: { beginFrame(nowMs: number): void } };
    lteCoins?: SceneUpdater;
    rain?: SceneUpdater;
    snow?: SceneUpdater;
    participants: RacerAsset[];
  };
  runtime: {
    local: {
      physics: LocalPhysics;
      track: { updateRender(nowMs: number, camera: unknown,
        width: number, height: number): void };
      resetVisible(nowMs: number): boolean;
      warpNext: { presentationVisible(nowMs: number): boolean };
    };
    localPresentation: RacerPresentation | undefined;
    remotes: RacerRemoteRuntime;
    finishSnapshot(): unknown;
    resultSnapshot(): Array<{ playerId: unknown; elapsedMs: number | null }> | undefined;
    draftPresentationVisible(playerId: unknown): boolean;
    draftBurstActive(playerId: unknown): boolean;
  };
  views: Map<unknown, RacerView>;
  initialPoses: Map<unknown, RacePose>;
  linkedPresentations: Map<unknown, {
    updateSpeedRace(boost: number, nowMs: number): unknown;
    simpleShadowEnabled(): boolean;
  }>;
  giantAppearances: Map<unknown, { update(main: number, extra: unknown): void }>;
  retiredCharacterIds: Set<unknown>;
  localRetirePending: boolean;
  winnerMotion: {
    consume(playerId: unknown, localId: unknown, finishSnapshot: unknown,
      retired: boolean): unknown;
  };
}

export interface RacePresenterParticipantDependencies {
  updateRemoteVehicleEffects(vehicle: VehicleAsset, view: RacerView,
    camera: unknown, nowMs: number, animation: unknown,
    instantAccelerationActive: boolean, width: number, height: number): void;
  updateLocalVehicleEffects(vehicle: VehicleAsset,
    local: RacePresenterParticipantsHost["runtime"]["local"],
    view: RacerView, camera: unknown, nowMs: number, animationSlot: unknown,
    simpleShadowEnabled: boolean): void;
}

const stoppedMotion = {
  forwardSpeed: 0,
  rawSteer: 0,
  tireTransient: 0,
  boosterState: 0,
  instantAccelerationActive: false,
  motorcycle: false,
  landingTrigger: false,
  collisionHit: false,
  collisionStrength: 0,
  visualScaleMode: 0,
};

export function updateRacePresenterParticipants(host: RacePresenterParticipantsHost,
  nowMs: number, width: number, height: number,
  dependencies: RacePresenterParticipantDependencies):
  Array<{ playerId: unknown; pose: RacePose }> {
  const { assets, camera, runtime } = host;
  const { physics, track } = runtime.local;
  assets.map.stageBinding.beginFrame(nowMs);
  track.updateRender(nowMs, camera, width, height);
  assets.lteCoins?.update(nowMs, camera, width, height);
  assets.rain?.update(nowMs, camera, width, height);
  assets.snow?.update(nowMs, camera, width, height);

  const finishes = runtime.finishSnapshot();
  const remotePoses: Array<{ playerId: unknown; pose: RacePose }> = [];
  for (const racer of assets.participants) {
    const view = host.views.get(racer.playerId);
    if (!view) continue;
    const isLocal = racer.playerId === host.playerId;
    const presentation = isLocal
      ? runtime.localPresentation
      : runtime.remotes.consumePresentation(racer.playerId);
    let animationSlot: unknown;
    if (isLocal) {
      const body = physics.body;
      animationSlot = view.update({
        ...physics.state,
        x: body.position.x,
        y: body.position.y,
        z: body.position.z,
        right: body.right,
        forward: body.forward,
        up: body.up,
      }, nowMs, physics.consumeKartAnimationInput());
      if (animationSlot !== undefined) physics.setAnimationSlot(animationSlot);
    } else {
      const pose = runtime.remotes.copyWebPose(racer.playerId) ??
        host.initialPoses.get(racer.playerId);
      if (pose) {
        remotePoses.push({ playerId: racer.playerId, pose });
        const projectedPose = {
          x: pose.position.x,
          y: pose.position.y,
          z: pose.position.z,
          ...pose,
          visualScale: "visualScale" in pose
            ? pose.visualScale : { x: 1, y: 1, z: 1 },
        };
        if (presentation?.animation) {
          view.updateRemote(projectedPose, nowMs, presentation.animation);
        } else {
          view.updatePose(projectedPose);
        }
      }
    }

    view.root.visible = isLocal
      ? runtime.local.resetVisible(nowMs) &&
        runtime.local.warpNext.presentationVisible(nowMs)
      : runtime.remotes.presentationVisible(racer.playerId, nowMs);
    const motion = presentation?.motion;
    const linked = host.linkedPresentations.get(racer.playerId);
    const linkedMotion = motion
      ? linked?.updateSpeedRace(motion.boosterState, nowMs) : undefined;
    view.root.updateMatrixWorld(true);
    const giant = isLocal ? physics.giant : runtime.remotes.giant(racer.playerId);
    if (giant) host.giantAppearances.get(racer.playerId)?.update(giant.main, giant.extra);
    racer.vehicle.imported.renderScene?.update(camera, width, height);
    racer.draftEffect?.update(nowMs,
      view.root.visible && runtime.draftPresentationVisible(racer.playerId),
      view.root.visible && runtime.draftBurstActive(racer.playerId),
      camera, width, height);

    const retired = isLocal ? host.localRetirePending
      : runtime.resultSnapshot()?.some(result =>
        result.playerId === racer.playerId && result.elapsedMs === null);
    const firstRetirement = retired && !host.retiredCharacterIds.has(racer.playerId);
    if (firstRetirement) host.retiredCharacterIds.add(racer.playerId);
    const finishMotion = host.winnerMotion.consume(racer.playerId,
      host.playerId, finishes, !!retired);
    const characterMotion = firstRetirement || finishMotion
      ? {
          ...stoppedMotion,
          ...motion,
          linkedPresentationMotion: linkedMotion,
          finishMotion: firstRetirement ? 13 : finishMotion,
        }
      : motion ? { ...motion, linkedPresentationMotion: linkedMotion } : undefined;
    (racer.characters.linked ?? racer.characters.ordinary)?.scene.update(
      nowMs, camera, width, height, characterMotion);

    if (presentation) {
      racer.vehicle.lampFlares.setInputPair("front", presentation.frontLamp);
      racer.vehicle.lampFlares.setInputPair("rear", presentation.rearLamp);
    }
    const imported = racer.vehicle.imported.renderScene !== undefined;
    racer.vehicle.lampFlares.update(nowMs, camera, imported);
    if (!isLocal && presentation) {
      if (presentation.animation) {
        dependencies.updateRemoteVehicleEffects(racer.vehicle, view, camera,
          nowMs, presentation.animation,
          presentation.motion.instantAccelerationActive, width, height);
      }
      racer.vehicle.trails.setState(presentation.motion.boosterState, nowMs);
      racer.vehicle.trails.update(nowMs, camera, imported);
    }
    for (const accessory of racer.vehicle.accessories) {
      if (accessory.kind === "headBand" && presentation) {
        accessory.render.setOwnerState?.(presentation.motion.boosterState, nowMs);
      }
      accessory.render.scene.update(nowMs, camera, width, height);
    }
    if (isLocal) {
      dependencies.updateLocalVehicleEffects(racer.vehicle, runtime.local,
        view, camera, nowMs, animationSlot,
        linked?.simpleShadowEnabled() ?? true);
    }
    racer.vehicle.decoration?.scene.update(nowMs, camera, width, height);
  }
  return remotePoses;
}
