import { updateStoryChase, type ChaseStage } from "../story/story-chase";
import { updateLicenseMission, type LicenseMissionStage } from "../license/license-mission";
import { updateLicenseTimer, type LicenseTimerStage } from "../license/license-race";
import { licenseItemsOf } from "../license/license-item-race";
import { hazardTrapsOf, presentRaceHazardTraps, trapDrawnState } from "./race-hazard-traps";
import { observeOf, updateObserveRanking, type ObservePose, type ObserveState } from "./replay-observe";
import { vehicleRoadDust } from "../vehicle/road-dust-effect";
import { sampleWrongWay, wrongWayOf } from "../ui/wrong-way-warning";
import { autopilotOf } from "../ui/autopilot-prank";
import { formulaOf } from "../formula/formula-runtime";

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
  racingPhase: number;
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
    // 逆向提示 while racing; not during a warp or an OB replay's hidden kart.
    const wrongWay = wrongWayOf(host.session);
    if (wrongWay) {
      const racing = host.session.lifecycle.phase === dependencies.racingPhase &&
        !host.session.warpHud?.hidden && !observeOf(host.session);
      wrongWay.update(effectiveNowMs, sampleWrongWay(host.getPhysics(), host.getTrack(), racing));
    }
    if (host.session.warpCameraFrozen) host.session.warpNextCamera(host.camera);
  }

  const formula = formulaOf(host.session);
  formula?.update(rawNowMs, host);
  host.touchControls.setAutoForwardActive(
    host.autoForward.isActive(host.drivingInput.snapshot()),
  );
  host.lightFactor.update();
  host.workProfiler?.mark("light", dependencies.nowMs());
  // 创世 9 自动版: from GO the kart stays at the start and its rider drives on.
  const autopilot = autopilotOf(host.session);
  if (autopilot?.seat) {
    autopilot.park(host.kartView, autopilot.seat,
      host.session.lifecycle.phase >= dependencies.racingPhase);
    autopilot.setGo(host.session.lifecycle.startAtMs || undefined);
  }
  // A water mine's bubble lifts the drawn kart (the item race's firedkart motion); physics stays put.
  const hazardTraps = hazardTrapsOf(host.session);
  const liftedState = hazardTraps ? trapDrawnState(hazardTraps, host.getPhysics(), effectiveNowMs) : undefined;
  let animationState = host.kartView.update(
    liftedState ?? host.getPhysics().state,
    Math.trunc(host.presentationClockMs) >>> 0,
    host.getPhysics().consumeKartAnimationInput(),
  );
  if (animationState !== undefined) host.getPhysics().setAnimationSlot(animationState);
  mark?.("kt-player-anim");

  let ghostPoses: any[] = [];
  // OB 观看: the local kart stays hidden and the ghost runs off the replay clock.
  const observe = observeOf(host.session);
  if (observe) host.kartView.root.visible = false;
  if (host.session.ghosts.length > 0 && host.session.lifecycle.startAtMs !== 0) {
    let ghostTimeMs = dependencies.relativeGhostTime(
      effectiveNowMs, host.session.lifecycle.startAtMs,
    );
    if (observe) {
      observe.naturalMs = ghostTimeMs;
      ghostTimeMs = observe.clock.advance(ghostTimeMs);
    }
    const speeds: number[] = [];
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
      speeds[index] = typeof sample.speedKmh === "number" ? sample.speedKmh : 0;
      mark?.("kt-ghost-sample");
      ghost.view.update(sample, effectiveNowMs, host.camera,
        dependencies.worldAxis, dependencies.depthAxis, mark);
      const pose = sample.formulaPose ? Object.assign(poseBuffer[index], sample.formulaPose) : dependencies.decodeGhostPose(
        "sample" in sample ? sample.sample : sample,
        poseBuffer[index],
      );
      stage.ghostRouteProgress.update(ghost, ghost.playback, timeMs, pose.position);
      pose.markerTint = host.session.rankColors[index + 1];
    }
    ghostPoses = poseBuffer;
    if (observe) observeFrame(observe, stage, poseBuffer, speeds, host.session.rankColors);
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
  host.session.kartRoadDust?.update(effectiveNowMs,
    vehicleRoadDust(host.getPhysics(), host.kartView.root.visible),
    host.camera, dependencies.worldAxis, dependencies.depthAxis);
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

  // 驾照考试 item steps: the magnet item's field (item presenter) replaces the kart's own magnet state look.
  const licenseItems = licenseItemsOf(host.session);
  if (licenseItems) host.session.kartEffects?.setMagnetSuppressed?.(licenseItems.pulling(), effectiveNowMs);
  animationState = host.updateKartBoosterState(
    effectiveNowMs, cameraState.action8, animationState,
  );
  if (formula?.state.boosting)
    host.session.kartEffects?.setState(3, 0, false, false, effectiveNowMs);
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
  // The carriers' water mines (their trap field follows the track scene) and the bubble's looks.
  if (hazardTraps) presentRaceHazardTraps(hazardTraps, effectiveNowMs, host.camera,
    Number(dependencies.worldAxis), Number(dependencies.depthAxis), host.getPhysics().body);
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

/**
 * OB 观看, once a frame after the ghosts moved: their ranking by route
 * progress, the watched one's pose and speed for the camera and the replay
 * stage, then the stage itself.
 */
function observeFrame(observe: ObserveState, stage: TimeAttackUpdateStage, poses: ObservePose[],
  speeds: number[], colors: unknown[] | undefined): void {
  const ghosts = stage.host.session.ghosts;
  const progress = ghosts.map((ghost: unknown) => stage.ghostRouteProgress.distance(ghost));
  updateObserveRanking(observe, ghosts.map((_: unknown, index: number) => index)
    .sort((a: number, b: number) => (progress[b] ?? 0) - (progress[a] ?? 0) || a - b));
  observe.colors = (colors ?? []).slice(1);
  const pose = poses[observe.watched];
  if (pose) {
    const copy = (vector: { x: number; y: number; z: number }) => ({ x: vector.x, y: vector.y, z: vector.z });
    observe.pose = { position: copy(pose.position), right: copy(pose.right), forward: copy(pose.forward),
      up: copy(pose.up) };
    observeMotion(observe, pose.position, speeds[observe.watched]);
  }
  observe.console?.update();
}

/**
 * The watched rider's velocity (chase camera) and speed (the replay stage's
 * tachometer) over replay time: frozen while paused, started over after a
 * seek or a change of rider. A smoothed playback's own speed wins.
 */
function observeMotion(observe: ObserveState, position: { x: number; y: number; z: number },
  sampledKmh: number | undefined): void {
  const time = observe.clock.current;
  const previous = observe.previous?.rider === observe.watched ? observe.previous : undefined;
  const elapsed = previous ? time - previous.atMs : 0;
  if (previous && elapsed === 0) return;
  if (previous && elapsed > 0 && elapsed <= 500) {
    const seconds = elapsed / 1000;
    observe.velocity = { x: (position.x - previous.x) / seconds, y: (position.y - previous.y) / seconds,
      z: (position.z - previous.z) / seconds };
    const kmh = sampledKmh || Math.hypot(observe.velocity.x, observe.velocity.y, observe.velocity.z) * 3.6;
    observe.speedKmh += (kmh - observe.speedKmh) * Math.min(1, elapsed / 200);
  } else {
    observe.velocity = { x: 0, y: 0, z: 0 };
    if (previous) observe.speedKmh = sampledKmh ?? 0;
  }
  observe.previous = { ...position, atMs: time, rider: observe.watched };
}
