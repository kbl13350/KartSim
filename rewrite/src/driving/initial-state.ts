/** Fresh physical and presentation state for one vehicle. */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface VehicleTuningForInitialization {
  forwardAccel: number;
  dragFactor: number;
  suspensionSpring?: number;
  suspensionPositiveDamping?: number;
  suspensionNegativeDamping?: number;
  chargerEnabled: boolean;
  speedSlotCapacity: number;
  mass: number;
}

export interface VehicleInitializationContext {
  tuning: VehicleTuningForInitialization;
}

const vector = (x = 0, y = 0, z = 0): Vector3 => ({ x, y, z });
const unitScale = (): Vector3 => ({ x: 1, y: 1, z: 1 });

export function createVehicleBody() {
  return {
    position: vector(),
    linearVelocity: vector(),
    angularVelocity: vector(),
    right: vector(1, 0, 0),
    forward: vector(0, 0, 1),
    up: vector(0, 1, 0),
  };
}

export function createVehicleWheelRuntime() {
  return {
    hit: [false, false, false, false],
    normals: [vector(), vector(), vector(), vector()],
    compression: [0.5, 0.5, 0.5, 0.5],
    compressionDelta: [0, 0, 0, 0],
    averageNormal: vector(),
    surfaceVelocity: vector(),
    roadDescriptor: undefined,
    auxiliaryDirection: vector(0, 1, 0),
    grounded: false,
    obstacleRayHit: false,
  };
}

/** Indices in the runtime's 90 double precision values. */
const numberIndex = {
  triggerTimer: 0,
  driftGaugeElapsed: 1,
  pendingGauge: 2,
  committedGauge: 3,
  teamGaugeValue: 4,
  teamGaugeTickMs: 5,
  teamGaugeCharge: 6,
  instantGauge: 7,
  instantWallPreSpeedKmh: 8,
  instantWallCollisionAnchorMs: 9,
  instantWallCooldownAnchorMs: 10,
  resetRefillInitial: 11,
  resetRefillRemaining: 12,
  resetRefillAnchorMs: 13,
  wallCollisionPreSpeedKmh: 14,
  wallCollisionAnchorMs: 15,
  resultCrashAnchorMs: 16,
  resultCrashCount: 17,
  resultBoosterCount: 18,
  currentUpdateMs: 19,
  currentReverseSnapshot: 20,
  lastCommittedPending: 21,
  reverseAccumulator: 22,
  steeringEnvelope: 23,
  steeringAngle: 24,
  tireTransient: 25,
  motorcycleDriftTimestampMs: 26,
  motorcycleTransientTorque: 27,
  triggerRawSteer: 28,
  roadTransient: 29,
  driftDecay: 30,
  tireEnvelope: 31,
  tireEnvelopeRate: 32,
  driftLifecycleB44: 33,
  driftLifecycleB50: 34,
  physicsState: 35,
  stateRemainingMs: 36,
  dualBoosterMode: 37,
  dualBoosterState: 38,
  driveScale: 39,
  liveForwardAccel: 40,
  liveDragFactor: 41,
  steeringExponentialScale: 42,
  dragScale: 43,
  catchupDragScale: 86,
  catchupSteeringScale: 87,
  chargerDurationScale: 89,
  draftAccelerationScale: 88,
  gravityDivisor: 44,
  gravityAnchorMs: 45,
  chargerBoosterUses: 46,
  chargerActivations: 47,
  chargerPendingUses: 48,
  chargerExpiryMs: 49,
  animationSlot: 50,
  teamSlotWindowEndMs: 51,
  localForwardSpeed: 52,
  localRightSpeed: 53,
  localUpSpeed: 54,
  bodySpeed: 55,
  massGravityForce: 56,
  cachedDisplaySpeedKmh: 57,
  landingShockAudioStrength: 58,
  collisionMotionStrength: 59,
  collisionAudioStrength: 60,
  steeringCollisionAudioGain: 61,
  roadCooldown: 62,
  motionMode: 63,
  railCaptureTimeout: 64,
  railCaptureDelay: 65,
  railEntryTimerA: 66,
  railEntryTimerB: 67,
  railReturnTimer: 68,
  railBadGeometryTimer: 69,
  railScalar0: 70,
  railScalar1: 71,
  railScalar2: 72,
  railEntryMarker: 73,
  obstacleSuppressionRemainingMs: 74,
  pressState: 75,
  automaticResetLowCollisionTime: 76,
  automaticResetHighCollisionTime: 77,
  automaticResetObstacleTime: 78,
  collisionResponseMagnitudeB6C: 79,
  eventScaleAnchorMs: 80,
  eventScaleDurationMs: 81,
  eventScaleMode: 82,
  teamGaugeSettledAtMs: 83,
  dualReadyRemainingMs: 84,
  speedSlotReorderedAtMs: 85,
} as const;

/** Indices in the runtime's 34 one byte flags. */
const flagIndex = {
  activeDrift: 0,
  triggerPhase: 1,
  oneSubstepDrift: 2,
  delayedDriftRequest: 3,
  driftGaugeWindow: 4,
  teamGaugeFullPending: 5,
  instantAccelerationActive: 6,
  tachometerIncGauge: 7,
  tachometerGaugePreserveMarker: 8,
  driftTailLatch: 9,
  forwardOneShot: 10,
  dualBoosterTeam: 11,
  dualActiveSpeedLocked: 33,
  raceMotionLocked: 12,
  driveSteeringSuppressed: 13,
  fullPhysicsBypass: 14,
  interactionActive: 15,
  chargerEnabled: 16,
  chargerActive: 17,
  mrContact: 18,
  hwContact: 19,
  contactWorking: 20,
  contactRisingEdge: 21,
  landingMotionTrigger: 22,
  shockWaveRequest: 23,
  freeOrientationLatch: 24,
  collisionMotionHit: 25,
  strongLateralCollision: 26,
  railResetRequest: 27,
  obstacleSuppressionLatch: 28,
  pressProtected1C0: 29,
  automaticResetRequest: 30,
  visualScaleRestorePending: 31,
  speedSlotReorderedEdge: 32,
} as const;

class RuntimeStorage {
  numbers = new Float64Array(90);
  flags = new Uint8Array(34);
  teamGaugeQueue: number[] = [];
  tachometerNormalBoosterDuration: number | undefined = undefined;
  suspensionSpring: number | undefined = undefined;
  suspensionPositiveDamping: number | undefined = undefined;
  suspensionNegativeDamping: number | undefined = undefined;
  animationInput: unknown = undefined;
  speedSlots: number[] = [];
  speedSlotDisabled: boolean[] = [];
  railConfig: unknown = undefined;
  gravity = vector();
  specialNormal = vector(0, 0, -0);
  railPoint = vector();
  railFrame: unknown = undefined;
  railRelativeOrientation = [vector(), vector(), vector()];
  stagedExternalForce = vector();
  stagedExternalTorque = vector();
  integrationExtraForce = vector();
  visualScaleA = vector();
  visualScaleTransitionAnchorMs: number | undefined = undefined;
  eventScalePrimary = vector();
  eventScaleSecondary = vector();
  eventScaleTarget = vector();
  eventScaleStart = vector();
  automaticResetInteractionActive = true;
}

export type VehicleRuntime = RuntimeStorage &
  { -readonly [K in keyof typeof numberIndex]: number } &
  { -readonly [K in keyof typeof flagIndex]: boolean };

for (const [name, index] of Object.entries(numberIndex)) {
  Object.defineProperty(RuntimeStorage.prototype, name, {
    get(this: RuntimeStorage) { return this.numbers[index]; },
    set(this: RuntimeStorage, value: number) { this.numbers[index] = value; },
    configurable: true,
  });
}

for (const [name, index] of Object.entries(flagIndex)) {
  Object.defineProperty(RuntimeStorage.prototype, name, {
    get(this: RuntimeStorage) { return this.flags[index] !== 0; },
    set(this: RuntimeStorage, value: boolean) { this.flags[index] = value ? 1 : 0; },
    configurable: true,
  });
}

export function createVehicleRuntime(vehicle: VehicleInitializationContext): VehicleRuntime {
  const runtime = new RuntimeStorage() as VehicleRuntime;
  const { tuning } = vehicle;
  runtime.teamGaugeTickMs = -1;
  runtime.speedSlotReorderedAtMs = -1;
  runtime.resultCrashAnchorMs = 4294967295;
  runtime.interactionActive = true;
  runtime.driveScale = 1;
  runtime.liveForwardAccel = tuning.forwardAccel;
  runtime.liveDragFactor = tuning.dragFactor;
  runtime.suspensionSpring = tuning.suspensionSpring === undefined ? undefined : Math.fround(tuning.suspensionSpring);
  runtime.suspensionPositiveDamping = tuning.suspensionPositiveDamping === undefined
    ? undefined : Math.fround(tuning.suspensionPositiveDamping);
  runtime.suspensionNegativeDamping = tuning.suspensionNegativeDamping === undefined
    ? undefined : Math.fround(tuning.suspensionNegativeDamping);
  runtime.steeringExponentialScale = 1;
  runtime.dragScale = 1;
  runtime.catchupDragScale = 1;
  runtime.catchupSteeringScale = 1;
  runtime.draftAccelerationScale = 1;
  runtime.chargerDurationScale = 1;
  runtime.gravityDivisor = 1;
  runtime.chargerEnabled = tuning.chargerEnabled;
  runtime.speedSlots = Array.from({ length: tuning.speedSlotCapacity }, () => -1);
  runtime.speedSlotDisabled = Array.from({ length: tuning.speedSlotCapacity }, () => false);
  runtime.massGravityForce = Math.fround(Math.fround(tuning.mass) * Math.fround(9.8));
  runtime.gravity = vector(0, Math.fround(-58.80000305175781), 0);
  runtime.contactWorking = true;
  runtime.automaticResetHighCollisionTime = 0;
  runtime.visualScaleA = unitScale();
  runtime.eventScalePrimary = unitScale();
  runtime.eventScaleSecondary = unitScale();
  runtime.eventScaleTarget = unitScale();
  runtime.eventScaleStart = unitScale();
  runtime.railRelativeOrientation = [vector(1, 0, 0), vector(0, 1, 0), vector(0, 0, 1)];
  return runtime;
}

export function createVehicleState() {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    yawRate: 0,
    right: vector(1, 0, 0),
    forward: vector(0, 0, 1),
    up: vector(0, 1, 0),
    visualScale: unitScale(),
    motorcyclePresentation: 0,
    wheelCompression: [0.5, 0.5, 0.5, 0.5],
    steering: 0,
    drifting: false,
    driftDirection: 0,
    driftTime: 0,
    driftEnergy: 0,
    boostGauge: 0,
    nitro: 0,
    boostTime: 0,
    trackProgress: 0,
    slipAngle: 0,
    forwardSpeed: 0,
    lateralSpeed: 0,
  };
}
