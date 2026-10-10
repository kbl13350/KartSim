import type { DrivingInput, Vector3 } from "./continuous-motion";

/** The collaborators read or called by one AL physics substep. */
export interface VehicleStepContext {
  runtime: {
    motionMode: number; mrContact: boolean; hwContact: boolean;
    specialNormal: Vector3; liveForwardAccel: number; driveScale: number;
    driveSteeringSuppressed: boolean; delayedDriftRequest: boolean;
    driftDecay: number; activeDrift: boolean; triggerPhase: boolean;
    driftTailLatch: boolean; localForwardSpeed: number;
    oneSubstepDrift: boolean; steeringEnvelope: number;
    raceMotionLocked: boolean; fullPhysicsBypass: boolean;
    pressProtected1C0: boolean; integrationExtraForce: Vector3;
    currentUpdateMs: number; physicsState: number;
  };
  scratch: { force: Vector3; torque: Vector3 };
  wheels: {
    grounded: boolean; railContactDescriptor?: unknown; surfaceVelocity: Vector3;
  };
  body: { linearVelocity: Vector3; right: Vector3 };
  state: { drifting: boolean; driftTime: number; driftDirection: number };
  nitroSeamlessRequest: boolean;
  speedRaceMode?: { kind: string };
  lteMotion?: {
    interrupt(): void;
    step(seconds: number, right: Vector3, acceleration: number,
      driveScale: number, drifting: boolean, force: Vector3): void;
  };
  giant?: {
    processWallCollision(nowMs: number, physicsState: number, protectedPress: boolean): void;
  };
  giantObstacleLowHit: boolean;
  /** Item races: victim effects advanced once per slice; a spin removes drive and grip. */
  itemEffects?: { readonly suppressesDrive: boolean; beginSubstep(seconds: number): void };
  updateStateTimer(seconds: number): void;
  updateDriftLifecycleTimers(seconds: number): void;
  tryConsumeNormalBooster(input: DrivingInput): boolean;
  scanSpecialRoad(track: unknown): void;
  rebuildBodyState(force: Vector3, torque: Vector3): void;
  probeWheels(track: unknown, onRail: boolean): void;
  enterRailMode(): void;
  applyResetSurfaceRequest(): void;
  applyFull3DRail(seconds: number, input: DrivingInput, track: unknown,
    force: Vector3, torque: Vector3): void;
  applySuspension(seconds: number, force: Vector3, torque: Vector3): void;
  applyLongitudinal(seconds: number, input: DrivingInput, force: Vector3): void;
  applySteeringAndTires(seconds: number, input: DrivingInput,
    force: Vector3, torque: Vector3): void;
  applyRoadConsumers(seconds: number, force: Vector3): void;
  applyBoosterChargeSurface(): void;
  applyAirState(force: Vector3, torque: Vector3): void;
  updateTachometerIncGauge(onRail: boolean): void;
  applyDrag(force: Vector3, torque: Vector3, onRail: boolean): void;
  captureRail(seconds: number, track: unknown): void;
  returnToStandard(seconds: number, track: unknown): void;
  integrateVelocity(seconds: number, force: Vector3, torque: Vector3,
    extraForce: Vector3): void;
  updateInstantAccelerationGauge(seconds: number): void;
  accumulateDriftGauge(seconds: number, onRail: boolean): void;
  accumulateSpeedGauge(seconds: number, onRail: boolean): void;
  updateResetGaugeRefill(seconds: number, nowMs: number): void;
  integrateFull3D(seconds: number): void;
  resolvePrimaryCollision(track: unknown, input: DrivingInput): { lowHit: boolean };
  updatePrimaryAutomaticResetTimers(collision: { lowHit: boolean }, seconds: number): void;
  resolveStaticObstacles(track: unknown): unknown;
  updateObstacleAutomaticResetTimer(collision: unknown, seconds: number): void;
  resolveTrackEvents(track: unknown): void;
  applySupplementalWheelRecovery(track: unknown): void;
  applySlipAlignment(): void;
  integrateStandardOrientation(seconds: number): void;
  updateCollisionGaugeOwners(collision: unknown): void;
}

const float = Math.fround;
const MAX_SUBSTEP_SECONDS = float(0.0020000000949949026);

function addVector(target: Vector3, value: Vector3): void {
  target.x = float(target.x + value.x);
  target.y = float(target.y + value.y);
  target.z = float(target.z + value.z);
}

function subtractVector(target: Vector3, value: Vector3): void {
  target.x = float(target.x - value.x);
  target.y = float(target.y - value.y);
  target.z = float(target.z - value.z);
}

/** Advance one continuous physics slice; collision and wheel policies remain collaborators. */
export function advancePhysicsSubstep(
  vehicle: VehicleStepContext,
  seconds: number,
  input: DrivingInput,
  track: unknown,
): void {
  seconds = float(seconds);
  if (!(seconds > 0) || seconds > MAX_SUBSTEP_SECONDS)
    throw new Error("车辆物理子步必须位于 (0, f32(0.002)] 秒。");

  // The release chooses the full-3D path from the mode at substep entry.
  // Entering rail mode below takes effect from the next slice.
  const full3DRail = vehicle.runtime.motionMode === 2 || vehicle.runtime.motionMode === 3;
  const force = vehicle.scratch.force;
  const torque = vehicle.scratch.torque;

  vehicle.updateStateTimer(seconds);
  vehicle.updateDriftLifecycleTimers(seconds);
  vehicle.itemEffects?.beginSubstep(seconds);
  const itemSpin = vehicle.itemEffects?.suppressesDrive === true;
  if (vehicle.nitroSeamlessRequest && vehicle.tryConsumeNormalBooster(input))
    vehicle.nitroSeamlessRequest = false;
  vehicle.scanSpecialRoad(track);
  vehicle.rebuildBodyState(force, torque);
  vehicle.probeWheels(track, full3DRail);
  if (vehicle.runtime.motionMode === 0 && vehicle.wheels.railContactDescriptor)
    vehicle.enterRailMode();
  vehicle.applyResetSurfaceRequest();
  if (full3DRail) vehicle.applyFull3DRail(seconds, input, track, force, torque);

  if (vehicle.wheels.grounded || vehicle.runtime.mrContact || vehicle.runtime.hwContact) {
    if (!full3DRail) {
      if (vehicle.runtime.hwContact && !vehicle.wheels.grounded) {
        const normal = vehicle.runtime.specialNormal;
        const hoverForce = {
          x: float(normal.x * float(-10)),
          y: float(normal.y * float(-10)),
          z: float(normal.z * float(-10)),
        };
        for (const factor of [vehicle.runtime.liveForwardAccel, vehicle.runtime.driveScale, float(1.5)]) {
          hoverForce.x = float(hoverForce.x * factor);
          hoverForce.y = float(hoverForce.y * factor);
          hoverForce.z = float(hoverForce.z * factor);
        }
        addVector(force, hoverForce);
      }
      vehicle.applySuspension(seconds, force, torque);
      if (!vehicle.runtime.driveSteeringSuppressed && !itemSpin)
        vehicle.applyLongitudinal(seconds, input, force);
      if (vehicle.runtime.delayedDriftRequest && vehicle.speedRaceMode?.kind !== "grip") {
        vehicle.runtime.delayedDriftRequest = false;
        if (vehicle.runtime.driftDecay <= 0) {
          vehicle.runtime.activeDrift = true;
          vehicle.runtime.triggerPhase = true;
          vehicle.runtime.driftTailLatch = vehicle.runtime.localForwardSpeed > 0;
        }
      }
      if (!vehicle.runtime.driveSteeringSuppressed && !itemSpin)
        vehicle.applySteeringAndTires(seconds, input, force, torque);
    }
    vehicle.applyRoadConsumers(seconds, force);
    vehicle.applyBoosterChargeSurface();
  } else if (!full3DRail) {
    vehicle.applyAirState(force, torque);
    vehicle.runtime.activeDrift = false;
    vehicle.runtime.oneSubstepDrift = false;
    vehicle.runtime.triggerPhase = false;
    vehicle.runtime.steeringEnvelope = 0;
  }

  vehicle.updateTachometerIncGauge(full3DRail);
  vehicle.applyDrag(force, torque, full3DRail);
  if (!full3DRail) {
    vehicle.captureRail(seconds, track);
    vehicle.returnToStandard(seconds, track);
  }
  if (vehicle.lteMotion) {
    if (full3DRail || vehicle.runtime.motionMode !== 0 || vehicle.runtime.raceMotionLocked ||
        vehicle.runtime.fullPhysicsBypass || vehicle.runtime.pressProtected1C0)
      vehicle.lteMotion.interrupt();
    else
      vehicle.lteMotion.step(seconds, vehicle.body.right, vehicle.runtime.liveForwardAccel,
        vehicle.runtime.driveScale, vehicle.state.drifting, force);
  }
  vehicle.integrateVelocity(seconds, force, torque, vehicle.runtime.integrationExtraForce);
  vehicle.updateInstantAccelerationGauge(seconds);
  vehicle.accumulateDriftGauge(seconds, full3DRail);
  vehicle.accumulateSpeedGauge(seconds, full3DRail);
  vehicle.updateResetGaugeRefill(seconds, vehicle.runtime.currentUpdateMs);

  if (full3DRail) {
    vehicle.integrateFull3D(seconds);
  } else {
    addVector(vehicle.body.linearVelocity, vehicle.wheels.surfaceVelocity);
    const primaryCollision = vehicle.resolvePrimaryCollision(track, input);
    vehicle.updatePrimaryAutomaticResetTimers(primaryCollision, seconds);
    const obstacleCollision = vehicle.resolveStaticObstacles(track);
    vehicle.updateObstacleAutomaticResetTimer(obstacleCollision, seconds);
    if (vehicle.giant && (primaryCollision.lowHit || vehicle.giantObstacleLowHit))
      vehicle.giant.processWallCollision(vehicle.runtime.currentUpdateMs,
        vehicle.runtime.physicsState, vehicle.runtime.pressProtected1C0);
    vehicle.resolveTrackEvents(track);
    vehicle.applySupplementalWheelRecovery(track);
    vehicle.applySlipAlignment();
    vehicle.integrateStandardOrientation(seconds);
    vehicle.updateCollisionGaugeOwners(obstacleCollision);
    subtractVector(vehicle.body.linearVelocity, vehicle.wheels.surfaceVelocity);
  }

  const drifting = vehicle.runtime.activeDrift || vehicle.runtime.driftDecay > 0 ||
    vehicle.runtime.oneSubstepDrift;
  vehicle.state.drifting = drifting;
  vehicle.state.driftTime = drifting ? float(vehicle.state.driftTime + seconds) : 0;
  if (!drifting) vehicle.state.driftDirection = 0;
}
