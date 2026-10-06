/** One rendered frame of a replay Ghost kart and its attached effects. */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Pose {
  position: Vec3;
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}

interface GhostFrame {
  status: number;
  timeMs: number;
}

type GhostInput = GhostFrame | {
  sample: GhostFrame;
  renderBasisClient?: unknown;
  velocity?: Vec3;
  speedKmh?: number;
};

export interface GhostVisualUpdateHost {
  poseScratch: unknown;
  basisScratch: unknown;
  root: {
    position: { set(x: number, y: number, z: number): void };
    quaternion: { setFromRotationMatrix(matrix: unknown): void };
  };
  basisRight: { set(x: number, y: number, z: number): void };
  basisUp: { set(x: number, y: number, z: number): void };
  basisForward: { set(x: number, y: number, z: number): void };
  orientationMatrix: { makeBasis(right: unknown, up: unknown,
    forward: unknown): void };
  lastBoosterState: number;
  burstTeam: boolean;
  usesP3553NonDualLinkedState: boolean;
  linkedPresentation?: {
    updateSpeedRace(booster: number, timeMs: number): unknown;
    update(booster: number, timeMs: number): unknown;
  };
  character?: { update(timeMs: number, renderTime: number,
    frameSeconds: number, clock: number, state: Record<string, unknown>): void };
  imported?: { renderScene?: {
    update(renderTime: number, frameSeconds: number, clock: number): void;
  } };
  toonPairs: Array<{ source: unknown; clone: unknown }>;
  effects?: {
    setState(booster: number, secondary: number, dualTeam: boolean,
      instant: boolean, timeMs: number): boolean;
    update(timeMs: number, renderTime: number, frameSeconds: number,
      clock: number): void;
  };
  animation?: { enterDualUse(): void };
  trails?: {
    setState(state: number, timeMs: number): void;
    update(timeMs: number, renderTime: number, hasRenderScene: boolean): void;
  };
  trailVehicle?: unknown;
  trailState: number;
  balloon?: { scene: { update(timeMs: number, renderTime: number,
    frameSeconds: number, clock: number): void } };
  accessories: Array<{
    kind: string;
    render: {
      setOwnerState?(booster: number, timeMs: number): void;
      scene: { update(timeMs: number, renderTime: number,
        frameSeconds: number, clock: number): void };
    };
  }>;
  motorcycle?: unknown;
  deriveMotion(pose: Pose, forward: Vec3, timeMs: number,
    telemetry?: unknown): {
      forwardSpeed: number;
      rawSteer: number;
      displaySpeedKmh: number;
    };
  updateAnimation(timeMs: number, booster: number, secondary: number,
    displaySpeedKmh: number): void;
  ghostDualTeam(booster: number): boolean;
}

export interface GhostVisualUpdateDependencies {
  decodePose(frame: GhostFrame, scratch: unknown): Pose;
  decodeBasis(basis: unknown, scratch: unknown): {
    right: Vec3; forward: Vec3; up: Vec3;
  };
  boosterState(status: number): number;
  secondaryState(status: number): number;
  instantAcceleration(status: number): boolean;
  copyToon(source: unknown, clone: unknown): void;
  nextTrailState(status: number, previous: number, vehicle: unknown): number;
}

export function updateGhostVisualFrame(host: GhostVisualUpdateHost,
  input: GhostInput, timeMs: number, renderTime: number,
  frameSeconds: number, clock: number,
  mark: ((stage: string) => void) | undefined,
  dependencies: GhostVisualUpdateDependencies): void {
  const frame = "sample" in input ? input.sample : input;
  const pose = dependencies.decodePose(frame, host.poseScratch);
  host.root.position.set(pose.position.x, pose.position.y, pose.position.z);
  const basis = "renderBasisClient" in input
    ? dependencies.decodeBasis(input.renderBasisClient, host.basisScratch)
    : { right: pose.right, forward: pose.forward, up: pose.up };
  host.basisRight.set(basis.right.x, basis.right.y, basis.right.z);
  host.basisUp.set(basis.up.x, basis.up.y, basis.up.z);
  host.basisForward.set(basis.forward.x, basis.forward.y, basis.forward.z);
  host.orientationMatrix.makeBasis(
    host.basisRight, host.basisUp, host.basisForward);
  host.root.quaternion.setFromRotationMatrix(host.orientationMatrix);

  const booster = dependencies.boosterState(frame.status);
  const secondary = dependencies.secondaryState(frame.status);
  if (booster === 10) {
    if (host.lastBoosterState !== 10) {
      host.burstTeam = host.lastBoosterState === 4;
    }
  } else {
    host.lastBoosterState = booster;
  }
  const motion = host.deriveMotion(pose, basis.forward, frame.timeMs,
    "velocity" in input ? input : undefined);
  host.updateAnimation(timeMs, booster, secondary, motion.displaySpeedKmh);
  const linkedMotion = host.usesP3553NonDualLinkedState
    ? host.linkedPresentation?.updateSpeedRace(booster, timeMs)
    : host.linkedPresentation?.update(booster, timeMs);
  mark?.("kt-ghost-anim");
  host.character?.update(timeMs, renderTime, frameSeconds, clock, {
    forwardSpeed: motion.forwardSpeed,
    rawSteer: motion.rawSteer,
    tireTransient: 0,
    boosterState: booster,
    instantAccelerationActive: dependencies.instantAcceleration(frame.status),
    motorcycle: host.motorcycle,
    landingTrigger: false,
    collisionHit: false,
    collisionStrength: 0,
    visualScaleMode: 0,
    linkedPresentationMotion: linkedMotion,
  });
  mark?.("kt-ghost-char");
  host.imported?.renderScene?.update(renderTime, frameSeconds, clock);
  mark?.("kt-ghost-render");
  for (const { source, clone } of host.toonPairs) {
    dependencies.copyToon(source, clone);
  }

  if (host.effects) {
    if (host.effects.setState(booster, secondary,
      host.ghostDualTeam(booster),
      dependencies.instantAcceleration(frame.status), timeMs)) {
      host.animation?.enterDualUse();
    }
    host.effects.update(timeMs, renderTime, frameSeconds, clock);
  }
  if (host.trails && host.trailVehicle) {
    host.trailState = dependencies.nextTrailState(
      frame.status, host.trailState, host.trailVehicle);
    host.trails.setState(host.trailState, timeMs);
  }
  host.trails?.update(timeMs, renderTime,
    host.imported?.renderScene !== undefined);
  mark?.("kt-ghost-fx");
  host.balloon?.scene.update(timeMs, renderTime, frameSeconds, clock);
  for (const { kind, render } of host.accessories) {
    if (kind === "headBand") render.setOwnerState?.(booster, timeMs);
    render.scene.update(timeMs, renderTime, frameSeconds, clock);
  }
  mark?.("kt-ghost-decor");
}
