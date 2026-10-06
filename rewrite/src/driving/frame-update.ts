import type { DrivingInput, Vector3 } from "./continuous-motion";
import type { VehicleStepContext } from "./frame-pipeline";

export interface ClockSlices {
  nowMs: number;
  elapsedMs: number;
  slicesMs: number[];
}

/** The AL collaborators used to advance one browser or network frame. */
export interface VehicleFrameContext extends VehicleStepContext {
  clock: { advance(milliseconds: number): ClockSlices };
  runtime: VehicleStepContext["runtime"] & {
    currentReverseSnapshot: number;
    collisionMotionHit: boolean;
    collisionMotionStrength: number;
    landingMotionTrigger: boolean;
    landingShockAudioStrength: number;
    collisionResponseMagnitudeB6C: number;
    liveDragFactor: number;
    stagedExternalForce: Vector3;
    stagedExternalTorque: Vector3;
  };
  body: VehicleStepContext["body"] & { angularVelocity: Vector3 };
  scratch: VehicleStepContext["scratch"] & { force: Vector3; torque: Vector3 };
  giant?: NonNullable<VehicleStepContext["giant"]> & { frozen?: boolean };
  applyJumpSurfaceTuning(): void;
  updateEventGravity(nowMs: number): void;
  updateInstantWallCharge(nowMs: number): void;
  updateStateTimerMilliseconds(elapsedMs: number): void;
  stepSubstep(seconds: number, input: DrivingInput, track: unknown): void;
  updateObstacleSuppressionTimer(elapsedMs: number): void;
  updateModeScale(nowMs: number): void;
  updatePublicGauge(): void;
  updateChargerExpiry(nowMs: number): void;
  updateCachedDisplaySpeed(): void;
  updateDualBooster(): void;
  updateTeamGauge(nowMs: number): void;
  updateTeamSlotWindow(nowMs: number): void;
  settleWallCollision(nowMs: number): void;
  syncPresentationFields(): void;
}

function clear(vector: Vector3): void {
  vector.x = 0;
  vector.y = 0;
  vector.z = 0;
}

/** Advance the game frame and distribute elapsed time into fixed physics slices. */
export function advanceVehicleFrame(
  vehicle: VehicleFrameContext,
  elapsedMilliseconds: number,
  input: DrivingInput,
  track: unknown,
): ClockSlices {
  const clock = vehicle.clock.advance(elapsedMilliseconds);
  const runtime = vehicle.runtime;
  runtime.currentUpdateMs = clock.nowMs;
  runtime.currentReverseSnapshot = Math.fround(input.reverse);
  const forwardAcceleration = runtime.liveForwardAccel;
  const dragFactor = runtime.liveDragFactor;

  vehicle.applyJumpSurfaceTuning();
  runtime.collisionMotionHit = false;
  runtime.collisionMotionStrength = 0;
  runtime.landingMotionTrigger = false;
  runtime.landingShockAudioStrength = 0;
  vehicle.updateEventGravity(clock.nowMs);
  vehicle.updateInstantWallCharge(clock.nowMs);

  if (runtime.fullPhysicsBypass || vehicle.giant?.frozen) {
    clear(vehicle.body.linearVelocity);
    clear(vehicle.body.angularVelocity);
    clear(vehicle.scratch.force);
    clear(vehicle.scratch.torque);
    clear(runtime.stagedExternalForce);
    clear(runtime.stagedExternalTorque);
    vehicle.updateStateTimerMilliseconds(clock.elapsedMs);
    if (runtime.fullPhysicsBypass) {
      for (const sliceMs of clock.slicesMs)
        vehicle.updateResetGaugeRefill(Math.fround(Math.fround(sliceMs) * Math.fround(0.001)), clock.nowMs);
    }
    runtime.liveForwardAccel = forwardAcceleration;
    runtime.liveDragFactor = dragFactor;
    vehicle.updateModeScale(clock.nowMs);
    vehicle.updatePublicGauge();
  } else {
    vehicle.updateObstacleSuppressionTimer(clock.elapsedMs);
    for (const sliceMs of clock.slicesMs) {
      vehicle.stepSubstep(Math.fround(Math.fround(sliceMs) * Math.fround(0.001)), input, track);
      runtime.landingShockAudioStrength = Math.max(
        runtime.landingShockAudioStrength, runtime.collisionResponseMagnitudeB6C,
      );
    }
    runtime.liveForwardAccel = forwardAcceleration;
    runtime.liveDragFactor = dragFactor;
    vehicle.updateModeScale(clock.nowMs);
  }

  vehicle.updateChargerExpiry(clock.nowMs);
  vehicle.updateCachedDisplaySpeed();
  vehicle.updateDualBooster();
  vehicle.updateTeamGauge(clock.nowMs);
  vehicle.updateTeamSlotWindow(clock.nowMs);
  vehicle.settleWallCollision(clock.nowMs);
  vehicle.syncPresentationFields();
  return clock;
}
