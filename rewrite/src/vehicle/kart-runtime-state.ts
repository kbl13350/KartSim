/** A kart's packed numeric and boolean physics state. */
export const NUMBER_SLOT_INDEX = {
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

export const FLAG_SLOT_INDEX = {
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

type NumericSlots = { [Name in keyof typeof NUMBER_SLOT_INDEX]: number };
type BooleanSlots = { [Name in keyof typeof FLAG_SLOT_INDEX]: boolean };

/**
 * Keeps the release's typed-array layout for physics code and network codecs.
 * Each named property is installed as a normal prototype accessor below.
 */
export class KartRuntimeState {
  numbers = new Float64Array(90);
  flags = new Uint8Array(34);
  teamGaugeQueue = [];
  tachometerNormalBoosterDuration: unknown = undefined;
  suspensionSpring: unknown = undefined;
  suspensionPositiveDamping: unknown = undefined;
  suspensionNegativeDamping: unknown = undefined;
  animationInput: unknown = undefined;
  speedSlots = [];
  speedSlotDisabled = [];
  railConfig: unknown = undefined;
  gravity = { x: 0, y: 0, z: 0 };
  specialNormal = { x: 0, y: 0, z: -0 };
  railPoint = { x: 0, y: 0, z: 0 };
  railFrame: unknown = undefined;
  railRelativeOrientation = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
  stagedExternalForce = { x: 0, y: 0, z: 0 };
  stagedExternalTorque = { x: 0, y: 0, z: 0 };
  integrationExtraForce = { x: 0, y: 0, z: 0 };
  visualScaleA = { x: 0, y: 0, z: 0 };
  visualScaleTransitionAnchorMs: unknown = undefined;
  eventScalePrimary = { x: 0, y: 0, z: 0 };
  eventScaleSecondary = { x: 0, y: 0, z: 0 };
  eventScaleTarget = { x: 0, y: 0, z: 0 };
  eventScaleStart = { x: 0, y: 0, z: 0 };
  automaticResetInteractionActive = true;
}

export interface KartRuntimeState extends NumericSlots, BooleanSlots {}

for (const [name, index] of Object.entries(NUMBER_SLOT_INDEX)) {
  Object.defineProperty(KartRuntimeState.prototype, name, {
    configurable: true,
    get(this: KartRuntimeState) { return this.numbers[index]; },
    set(this: KartRuntimeState, value: number) { this.numbers[index] = value; },
  });
}

for (const [name, index] of Object.entries(FLAG_SLOT_INDEX)) {
  Object.defineProperty(KartRuntimeState.prototype, name, {
    configurable: true,
    get(this: KartRuntimeState) { return this.flags[index] !== 0; },
    set(this: KartRuntimeState, value: boolean) { this.flags[index] = value ? 1 : 0; },
  });
}
