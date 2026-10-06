import type { Vector3 } from "./continuous-motion";
import type { VehicleRuntime } from "./initial-state";

type Matrix3 = [Vector3, Vector3, Vector3];
type DebugRuntime = Omit<VehicleRuntime, "railConfig" | "railFrame" | "railRelativeOrientation"> & {
  railConfig?: Record<string, unknown>;
  railFrame?: Matrix3;
  railRelativeOrientation: Matrix3;
};

export interface VehicleDebugContext {
  runtime: DebugRuntime;
}

const cloneVector = (value: Vector3): Vector3 => ({ x: value.x, y: value.y, z: value.z });
const cloneMatrix = (value: Matrix3): Matrix3 => [
  cloneVector(value[0]), cloneVector(value[1]), cloneVector(value[2]),
];

/** Immutable-at-capture diagnostic projection from the live vehicle runtime. */
export function snapshotVehicleDebugState(vehicle: VehicleDebugContext) {
  const state = vehicle.runtime;
  return {
    reverseAccumulator: state.reverseAccumulator,
    steeringAngle: state.steeringAngle,
    steeringEnvelope: state.steeringEnvelope,
    activeDrift: state.activeDrift,
    triggerPhase: state.triggerPhase,
    oneSubstepDrift: state.oneSubstepDrift,
    driftGaugeWindow: state.driftGaugeWindow,
    pendingGauge: state.pendingGauge,
    committedGauge: state.committedGauge,
    instantGauge: state.instantGauge,
    instantAccelerationActive: state.instantAccelerationActive,
    instantWallCollisionAnchorMs: state.instantWallCollisionAnchorMs,
    instantWallCooldownAnchorMs: state.instantWallCooldownAnchorMs,
    chargerEnabled: state.chargerEnabled,
    chargerActive: state.chargerActive,
    chargerBoosterUses: state.chargerBoosterUses,
    chargerActivations: state.chargerActivations,
    chargerPendingUses: state.chargerPendingUses,
    chargerExpiryMs: state.chargerExpiryMs,
    physicsState: state.physicsState,
    stateRemainingMs: state.stateRemainingMs,
    animationSlot: state.animationSlot,
    cachedDisplaySpeedKmh: state.cachedDisplaySpeedKmh,
    mrContact: state.mrContact,
    hwContact: state.hwContact,
    contactRisingEdge: state.contactRisingEdge,
    landingMotionTrigger: state.landingMotionTrigger,
    collisionMotionHit: state.collisionMotionHit,
    collisionMotionStrength: state.collisionMotionStrength,
    roadCooldown: state.roadCooldown,
    motionMode: state.motionMode,
    railCaptureTimeout: state.railCaptureTimeout,
    railCaptureDelay: state.railCaptureDelay,
    railEntryTimerA: state.railEntryTimerA,
    railEntryTimerB: state.railEntryTimerB,
    railReturnTimer: state.railReturnTimer,
    railBadGeometryTimer: state.railBadGeometryTimer,
    railConfig: state.railConfig ? { ...state.railConfig } : undefined,
    railFrame: state.railFrame ? cloneMatrix(state.railFrame) : undefined,
    railRelativeOrientation: cloneMatrix(state.railRelativeOrientation),
    railResetRequest: state.railResetRequest,
    fullPhysicsBypass: state.fullPhysicsBypass,
    interactionActive: state.interactionActive,
    resetRefillInitial: state.resetRefillInitial,
    resetRefillRemaining: state.resetRefillRemaining,
    resetRefillAnchorMs: state.resetRefillAnchorMs,
    wallCollisionPreSpeedKmh: state.wallCollisionPreSpeedKmh,
    wallCollisionAnchorMs: state.wallCollisionAnchorMs,
    obstacleSuppressionRemainingMs: state.obstacleSuppressionRemainingMs,
    obstacleSuppressionLatch: state.obstacleSuppressionLatch,
    pressState: state.pressState,
    pressProtected1C0: state.pressProtected1C0,
    automaticResetLowCollisionTime: state.automaticResetLowCollisionTime,
    automaticResetHighCollisionTime: state.automaticResetHighCollisionTime,
    automaticResetObstacleTime: state.automaticResetObstacleTime,
    automaticResetRequest: state.automaticResetRequest,
    collisionResponseMagnitudeB6C: state.collisionResponseMagnitudeB6C,
    visualScaleA: cloneVector(state.visualScaleA),
    visualScaleRestorePending: state.visualScaleRestorePending,
    eventScalePrimary: cloneVector(state.eventScalePrimary),
    eventScaleSecondary: cloneVector(state.eventScaleSecondary),
    eventScaleTarget: cloneVector(state.eventScaleTarget),
    eventScaleStart: cloneVector(state.eventScaleStart),
    eventScaleAnchorMs: state.eventScaleAnchorMs,
    eventScaleDurationMs: state.eventScaleDurationMs,
    eventScaleMode: state.eventScaleMode,
    gravityDivisor: state.gravityDivisor,
    gravityAnchorMs: state.gravityAnchorMs,
    liveForwardAccel: state.liveForwardAccel,
    liveDragFactor: state.liveDragFactor,
    motorcycleDriftTimestampMs: state.motorcycleDriftTimestampMs,
    motorcycleTransientTorque: state.motorcycleTransientTorque,
  };
}
