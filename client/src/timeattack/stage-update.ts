import { updateStoryChase, type ChaseStage } from "../story/story-chase";
import { updateLicenseMission, type LicenseMissionStage } from "../license/license-mission";
import { updateLicenseTimer, type LicenseTimerStage } from "../license/license-race";
import { licenseItemsOf } from "../license/license-item-race";

// Presentation owners still come from the generated client. Their renderer,
// physics and asset types will be narrowed as those systems are migrated.
interface LegacyFrameHost {
  [name: string]: any;
  paused: boolean;
  resourceVersion: string;
  frameTimeSeconds: number;
  presentationClockMs: number;
  session: {
    [name: string]: any;
    lifecycle: {
      effectiveTime(nowMs: number): number;
      startAtMs: number;
      phase: number;
    };
    ghosts: any[];
    rankColors: unknown[];
    characterDecorations: Array<{ kind: string; render: any }>;
    pendingCharacterFinishMotion: number;
  };
  getPhysics(): any;
  getTrack(): any;
}

export interface TimeAttackUpdateStage {
  host: LegacyFrameHost;
  milliseconds: number;
  effectiveNowMs: number;
  released: boolean;
  ghostPoseBuffer: any[];
  ghostPoses: any[];
  ghostRouteProgress: {
    update(ghost: any, playback: any, timeMs: number, position: any): void;
    distance(ghost: any): number;
  };
  ui?: {
    trackInfoCard?: { update(nowMs: number): void };
    action2D?: { setChaseDistance?(metres: number | undefined): void };
  };
  updateDriving(rawNowMs: number): void;
}

export interface TimeAttackUpdateDependencies {
  nowMs(): number;
  relativeGhostTime(nowMs: number, startAtMs: number): number;
  newGhostPoseBuffer(): any;
  decodeGhostPose(sample: any, buffer: any): { position: any; markerTint?: unknown };
  setVisualScaleMode(mode: number): void;
  isExhaustActive(audioState: any, boosterState: any, boosterMode: any,
    action8: any): boolean;
  particleRatio(nowMs: number, startAtMs: number, inCountdown: boolean): number;
  roadDescriptorName(descriptor: any): unknown;
  countdownPhase: number;
  worldAxis: unknown;
  depthAxis: unknown;
}

/** Update time attack presentation after the driving state has advanced. */
export function updateTimeAttackStage(
  stage: TimeAttackUpdateStage,
  frame: { nowMs: number },
  dependencies: TimeAttackUpdateDependencies,
): void {
  const { host } = stage;
  const rawNowMs = frame.nowMs;
  stage.milliseconds = rawNowMs;
  const effectiveNowMs = host.session.lifecycle.effectiveTime(rawNowMs);
  stage.effectiveNowMs = effectiveNowMs;
  stage.ui?.trackInfoCard?.update(effectiveNowMs);
  const mark = host.workProfiler
    ? (name: string) => host.workProfiler.mark(name, dependencies.nowMs())
    : undefined;

  if (host.paused) {
    host.drainDrivingInput(effectiveNowMs, rawNowMs);
    host.getPhysics().synchronizeClock(effectiveNowMs);
    host.getTrack().expireEventEffects(effectiveNowMs);
    if (host.resourceVersion === "p3553") host.clientFramerate.sample(effectiveNowMs);
  } else {
    host.presentationClockMs += host.frameTimeSeconds * 1000;
    host.getTrack().updateMovingRoads(effectiveNowMs);
    host.workProfiler?.mark("moving-roads", dependencies.nowMs());
    host.nitroSeamless.update(host.getPhysics(), effectiveNowMs);
    stage.updateDriving(rawNowMs);
    if (host.resourceVersion === "p3553") host.clientFramerate.sample(effectiveNowMs);
    host.workProfiler?.mark("driving", dependencies.nowMs());
    if (!host.shell.started) {
      stage.released = true;
      return;
    }
    if (host.session.warpCameraFrozen) host.session.warpNextCamera(host.camera);
  }

  host.touchControls.setAutoForwardActive(
    host.autoForward.isActive(host.drivingInput.snapshot()),
  );
  host.lightFactor.update();
  host.workProfiler?.mark("light", dependencies.nowMs());
  let animationState = host.kartView.update(
    host.getPhysics().state,
    Math.trunc(host.presentationClockMs) >>> 0,
    host.getPhysics().consumeKartAnimationInput(),
  );
  if (animationState !== undefined) host.getPhysics().setAnimationSlot(animationState);
  mark?.("kt-player-anim");

  let ghostPoses: any[] = [];
  if (host.session.ghosts.length > 0 && host.session.lifecycle.startAtMs !== 0) {
    const ghostTimeMs = dependencies.relativeGhostTime(
      effectiveNowMs, host.session.lifecycle.startAtMs,
    );
    const ghosts = host.session.ghosts;
    if (stage.ghostPoseBuffer.length !== ghosts.length) {
      stage.ghostPoseBuffer = ghosts.map(() => dependencies.newGhostPoseBuffer());
    }
    const poseBuffer = stage.ghostPoseBuffer;
    for (let index = 0; index < ghosts.length; index += 1) {
      const ghost = ghosts[index];
      // Story chase rivals run ahead (+) or behind (−) the race clock; never
      // before stamp 0, which is a sentinel at the world origin.
      const timeMs = Math.max(0, ghostTimeMs + (ghost.timeOffsetMs ?? 0));
      const sample = ghost.playback.sample(timeMs);
      mark?.("kt-ghost-sample");
      ghost.view.update(sample, effectiveNowMs, host.camera,
        dependencies.worldAxis, dependencies.depthAxis, mark);
      const pose = dependencies.decodeGhostPose(
        "sample" in sample ? sample.sample : sample,
        poseBuffer[index],
      );
      stage.ghostRouteProgress.update(ghost, ghost.playback, timeMs, pose.position);
      pose.markerTint = host.session.rankColors[index + 1];
    }
    ghostPoses = poseBuffer;
  }
  // Story Tracing / Escape: the gap panel and the per-frame verdict.
  updateStoryChase(stage as unknown as ChaseStage, rawNowMs);
  // 驾照考试: the step's own mission, then the mission timer and its time limit.
  updateLicenseMission(stage as unknown as LicenseMissionStage, rawNowMs);
  updateLicenseTimer(stage as unknown as LicenseTimerStage, rawNowMs);
  mark?.("kt-ghost");

  const cameraState = host.getPhysics().driveCameraRuntime();
  host.session.balloonDecoration?.scene.update(effectiveNowMs, host.camera,
    dependencies.worldAxis, dependencies.depthAxis);
  host.session.characterDecorations.forEach(({ kind, render }) => {
    if (kind === "headBand") render.setOwnerState?.(cameraState.stateCode, effectiveNowMs);
    render.scene.update(effectiveNowMs, host.camera,
      dependencies.worldAxis, dependencies.depthAxis);
  });
  stage.ghostPoses = ghostPoses;
  mark?.("kt-decor");
  dependencies.setVisualScaleMode(cameraState.visualScaleMode);
  host.kartView.root.updateMatrixWorld(true);
  if (host.session.toonEnvironment) host.toonStageBinding.beginFrame(rawNowMs);
  mark?.("kt-matrix");
  host.session.vehicleRender?.update(host.camera,
    dependencies.worldAxis, dependencies.depthAxis);
  mark?.("kt-player-render");
  host.workProfiler?.mark("kart", dependencies.nowMs());

  const effectRequests = host.getPhysics().consumeTrackEventEffectRequests();
  if (effectRequests.length > 0 && !host.session.trackEventEffects) {
    throw new Error("event effect request 缺少 kart presentation owner。");
  }
  for (const request of effectRequests) {
    host.session.trackEventEffects.trigger(request.effect, request.atMs);
  }
  for (const expired of host.getTrack().consumeExpiredEventEffects()) {
    host.session.trackEventEffects?.remove(expired);
  }
  host.session.trackEventEffects?.update(effectiveNowMs, host.camera,
    dependencies.worldAxis, dependencies.depthAxis);
  host.workProfiler?.mark("track-events", dependencies.nowMs());

  let linkedMotion: unknown;
  if (!host.paused) {
    if (host.resourceVersion === "p3553" &&
        !host.getPhysics().tuning.dualBoosterEnabled) {
      linkedMotion = host.session.linkedCharacterPresentation?.updateSpeedRace(
        cameraState.stateCode, effectiveNowMs,
      );
    } else {
      linkedMotion = host.session.linkedCharacterPresentation?.update(
        cameraState.stateCode, effectiveNowMs,
      );
    }
  }
  const motionMode = cameraState.motionMode;
  host.session.kartMotionBlur?.setState(cameraState.stateCode,
    host.getPhysics().displaySpeedKmh(), effectiveNowMs, host.gameOptions.boostBlur);
  host.session.zetAirEffect?.update(effectiveNowMs,
    host.getPhysics().displaySpeedKmh(), host.getPhysics().body.linearVelocity,
    host.camera, host.kartView.root.visible);
  host.session.shockWaveEffect?.update(effectiveNowMs,
    host.getPhysics().consumeShockWaveRequest(), host.kartView.root.matrixWorld,
    host.camera, dependencies.worldAxis, dependencies.depthAxis);
  host.session.exhaustEffect?.update(effectiveNowMs,
    host.getPhysics().displaySpeedKmh(), host.getPhysics().body.linearVelocity,
    host.camera,
    host.kartView.root.visible && dependencies.isExhaustActive(
      host.getPhysics().audioState(), host.getPhysics().dualBoosterState(),
      host.getPhysics().dualBoosterMode(), cameraState.action8,
    ));
  host.session.crashEffect?.update(effectiveNowMs,
    host.getPhysics().consumeCrashEffectRequest(), host.kartView.root.matrixWorld,
    host.camera, dependencies.worldAxis, dependencies.depthAxis);

  const charger = host.getPhysics().timeAttackTachometerCharger();
  host.session.chargerEffect?.update(effectiveNowMs, charger.active,
    charger.durationMs, host.camera, dependencies.worldAxis, dependencies.depthAxis);
  host.session.particleModification?.update(effectiveNowMs,
    dependencies.particleRatio(effectiveNowMs, host.session.lifecycle.startAtMs,
      host.session.lifecycle.phase === dependencies.countdownPhase),
    host.camera, dependencies.worldAxis, dependencies.depthAxis);
  host.session.particleModificationBanner?.update(effectiveNowMs,
    host.session.lifecycle.startAtMs,
    host.session.lifecycle.phase === dependencies.countdownPhase,
    host.session.particleModificationBannerRequest);
  host.session.simpleShadow?.update(host.getTrack(),
    (host.session.linkedCharacterPresentation?.simpleShadowEnabled() ?? true) &&
      host.kartView.root.visible && motionMode !== 2 && motionMode !== 3);
  host.session.kartDriftEffects?.update(effectiveNowMs,
    host.getPhysics().driftVisualRuntime(), host.getTrack(),
    host.kartView.root.visible);

  const finishMotion = host.session.pendingCharacterFinishMotion;
  if (!host.paused) host.session.pendingCharacterFinishMotion = 0;
  const characterMotion = () => ({
    forwardSpeed: host.getPhysics().state.forwardSpeed,
    rawSteer: host.drivingInput.snapshot().rawSteer,
    tireTransient: cameraState.tireTransient,
    boosterState: cameraState.stateCode,
    instantAccelerationActive: cameraState.action8,
    motorcycle: cameraState.motorcycleType,
    landingTrigger: cameraState.landingMotionTrigger,
    collisionHit: cameraState.collisionMotionHit,
    collisionStrength: cameraState.collisionMotionStrength,
    visualScaleMode: cameraState.visualScaleMode,
    finishMotion,
  });
  host.session.characterRender?.update(host.session.lifecycle.effectiveTime(rawNowMs),
    host.camera, dependencies.worldAxis, dependencies.depthAxis,
    host.paused ? undefined : characterMotion());
  host.session.flyingPet?.update(effectiveNowMs, host.camera,
    dependencies.worldAxis, dependencies.depthAxis,
    host.gameOptions.inGameFlyingPetVisible);
  host.session.linkedCharacterRender?.update(
    host.session.lifecycle.effectiveTime(rawNowMs),
    host.camera, dependencies.worldAxis, dependencies.depthAxis,
    host.paused ? undefined : { ...characterMotion(), linkedPresentationMotion: linkedMotion },
  );
  host.workProfiler?.mark("character", dependencies.nowMs());

  animationState = host.updateKartBoosterState(
    effectiveNowMs, cameraState.action8, animationState,
  );
  host.session.kartEffects?.update(host.session.lifecycle.effectiveTime(rawNowMs),
    host.camera, dependencies.worldAxis, dependencies.depthAxis);
  host.session.kartTrails?.setState(host.getPhysics().audioState(),
    host.session.lifecycle.effectiveTime(rawNowMs));
  host.session.kartTrails?.update(host.session.lifecycle.effectiveTime(rawNowMs),
    host.camera, host.session.vehicleRender !== undefined);
  host.session.lampFlares?.update(host.session.lifecycle.effectiveTime(rawNowMs),
    host.camera, host.session.vehicleRender !== undefined);
  host.workProfiler?.mark("kart-effects", dependencies.nowMs());

  if (!host.paused) {
    host.audio.kartAudio?.update(host.session.lifecycle.effectiveTime(rawNowMs),
      Math.hypot(host.getPhysics().state.vx, host.getPhysics().state.vy,
        host.getPhysics().state.vz));
    host.audio.kartAudio?.playCollision(
      host.getPhysics().consumeCollisionAudioStrength(),
      host.session.lifecycle.effectiveTime(rawNowMs));
    host.audio.kartAudio?.playSteeringCollision(
      host.getPhysics().consumeSteeringCollisionAudioGain());
    host.audio.kartAudio?.playLandingShock(cameraState.landingMotionTrigger,
      cameraState.landingShockAudioStrength);
    host.audio.kartAudio?.setState(host.getPhysics().audioState(),
      host.getPhysics().dualBoosterState());
    host.audio.kartAudio?.setChargerActive(charger.active);
    host.audio.kartAudio?.setExceedActive(cameraState.action8);
    host.audio.kartAudio?.setTransformingState(animationState);
    host.audio.kartAudio?.setDriftActive(host.getPhysics().state.drifting);
    host.audio.kartAudio?.updateRoad(
      host.getPhysics().wheels.roadDescriptor
        ? dependencies.roadDescriptorName(host.getPhysics().wheels.roadDescriptor)
        : undefined,
      Math.hypot(host.getPhysics().state.vx, host.getPhysics().state.vy,
        host.getPhysics().state.vz),
      host.frameTimeSeconds,
    );
  }
  host.workProfiler?.mark("kart-audio", dependencies.nowMs());
  host.getTrack().updateRender(host.session.lifecycle.effectiveTime(rawNowMs),
    host.camera, dependencies.worldAxis, dependencies.depthAxis);
  // 驾照考试 item steps: the boxes, targets and item effects follow the track scene.
  licenseItemsOf(host.session)?.present(host.camera, Number(dependencies.worldAxis),
    Number(dependencies.depthAxis));
  host.updateDevToolsTrackObjects(host.session.lifecycle.effectiveTime(rawNowMs),
    dependencies.worldAxis, dependencies.depthAxis);
  host.workProfiler?.mark("track-render", dependencies.nowMs());
  host.session.trackEventAudio?.update(effectiveNowMs, host.getPhysics().body.position);
  host.session.trackDummyAudio?.update(host.camera);
  host.session.rain?.update(host.presentationClockMs, host.camera,
    dependencies.worldAxis, dependencies.depthAxis);
  host.session.snow?.update(host.presentationClockMs, host.camera,
    dependencies.worldAxis, dependencies.depthAxis);
  host.workProfiler?.mark("weather", dependencies.nowMs());
  host.updateHud();
  host.workProfiler?.mark("hud", dependencies.nowMs());
}
