/** Public vehicle commands and the small state transitions they trigger. */

const float = Math.fround;

export interface VehicleClockContext {
  checkClientFramerate: boolean;
  clock: {
    synchronize(nowMs: number, checkClientFramerate?: boolean): unknown;
    advance(nowMs: number): unknown;
  };
}

export function synchronizeVehicleClock(vehicle: VehicleClockContext, nowMs: number): void {
  vehicle.clock.synchronize(nowMs, vehicle.checkClientFramerate);
}

export function updateVehicleLockedClock(vehicle: VehicleClockContext, nowMs: number): void {
  if (vehicle.checkClientFramerate) vehicle.clock.advance(nowMs);
  else vehicle.clock.synchronize(nowMs);
}

export interface VehicleDualBoostOptions {
  dualBoostAuto: boolean;
  dualBoostAutoArm: boolean;
}

export function setVehicleDualBoostAuto(vehicle: VehicleDualBoostOptions, enabled: boolean, kartId: number): void {
  vehicle.dualBoostAuto = enabled;
  vehicle.dualBoostAutoArm = kartId === 1096 || kartId === 1106 || (kartId !== 1097 && enabled);
}

export type DrivingCommand =
  | { kind: "drift-start"; direction: number }
  | { kind: "drift-stop"; active?: boolean }
  | { kind: "use-item-or-booster" }
  | { kind: "reorder-items" }
  | { kind: "instant-acceleration" }
  | { kind: "forward-down" }
  | { kind: "forward-up" }
  | { kind: "reverse-down" | "reverse-up" | "reset" | "unsupported-action" };

export interface DrivingCommandContext {
  speedRaceMode?: { kind: string };
  /** Item races route Ctrl/Alt to the item controller instead of the nitro slots. */
  itemMode?: boolean;
  runtime: {
    driftDecay: number;
    activeDrift: boolean;
    triggerPhase: boolean;
    driftTailLatch: boolean;
    localForwardSpeed: number;
    contactWorking: boolean;
    delayedDriftRequest: boolean;
    instantGauge: number;
    instantAccelerationActive: boolean;
    forwardOneShot: boolean;
    driftLifecycleB50: number;
    driftLifecycleB44: number;
    physicsState: number;
    stateRemainingMs: number;
  };
  tuning: {
    instAccelGaugeLength: number;
    instAccelGaugeMinUsable: number;
    driftBoostTick: number;
  };
  state: { driftDirection: number; boostTime: number };
  stopDrift(): void;
  startNormalBooster(input: { forward: number }): boolean;
  armDualBooster(): void;
  reorderSpeedSlots(): boolean;
}

/** Apply a discrete input event to the live driving state. */
export function handleVehicleDrivingCommand(
  vehicle: DrivingCommandContext,
  command: DrivingCommand,
  input: { forward: number },
): void {
  const { runtime, tuning, state } = vehicle;
  switch (command.kind) {
    case "drift-start":
      if (vehicle.speedRaceMode?.kind === "grip") return;
      if (runtime.driftDecay <= 0) {
        runtime.activeDrift = true;
        runtime.triggerPhase = true;
        runtime.driftTailLatch = runtime.localForwardSpeed > 0;
        if (!runtime.contactWorking) runtime.delayedDriftRequest = true;
      }
      state.driftDirection = command.direction;
      return;
    case "drift-stop":
      if (vehicle.speedRaceMode?.kind === "grip") return;
      void command.active;
      vehicle.stopDrift();
      return;
    case "use-item-or-booster":
      if (vehicle.itemMode) return;
      vehicle.startNormalBooster(input);
      vehicle.armDualBooster();
      return;
    case "reorder-items":
      if (vehicle.itemMode) return;
      vehicle.reorderSpeedSlots();
      return;
    case "instant-acceleration":
      if (tuning.instAccelGaugeLength > 0 && runtime.instantGauge >= tuning.instAccelGaugeMinUsable)
        runtime.instantAccelerationActive = true;
      return;
    case "forward-down":
      runtime.forwardOneShot = true;
      if (runtime.driftLifecycleB50 > 0 && vehicle.speedRaceMode?.kind !== "grip") {
        runtime.driftLifecycleB50 = 0;
        runtime.driftLifecycleB44 = tuning.driftBoostTick
          ? float(float(tuning.driftBoostTick) / float(1000)) : float(0.5);
        runtime.physicsState = 2;
        runtime.stateRemainingMs = 0;
        state.boostTime = 0;
      }
      return;
    case "forward-up":
      if (runtime.physicsState < 13 || runtime.physicsState > 16) {
        runtime.physicsState = 0;
        runtime.stateRemainingMs = 0;
        state.boostTime = 0;
      }
      return;
    case "reverse-down":
    case "reverse-up":
    case "reset":
    case "unsupported-action":
      return;
  }
}

export interface BoosterCommandContext {
  startNormalBooster(input: { forward: number }): boolean;
  armDualBooster(): void;
}

export function tryConsumeVehicleNormalBooster(vehicle: BoosterCommandContext, input: { forward: number }): boolean {
  const used = vehicle.startNormalBooster(input);
  if (used) vehicle.armDualBooster();
  return used;
}

export interface NitroSeamlessContext { nitroSeamlessRequest: boolean }

export function queueVehicleNitroSeamless(vehicle: NitroSeamlessContext): void {
  vehicle.nitroSeamlessRequest = true;
}

export function cancelVehicleNitroSeamless(vehicle: NitroSeamlessContext): void {
  vehicle.nitroSeamlessRequest = false;
}

/** Descriptors remain opaque here; the original route and road decoders are supplied by the caller. */
export interface VehicleSurfaceResolvers {
  parseRouteTag(tag: string): unknown;
  surfaceKind(descriptor: unknown): string;
  railId(descriptor: unknown): unknown;
  roadSurface(descriptor: unknown): string | undefined;
}

export interface VehicleRouteSurfaceContext {
  canHandleRouteSurfaceTag(tag: string): boolean;
  requestMotionMode(enabled: boolean, mode: number): unknown;
  enterRailMode(): unknown;
}

export function canHandleVehicleRouteSurfaceTag(
  tag: string,
  surfaces: VehicleSurfaceResolvers,
): boolean {
  return surfaces.surfaceKind(surfaces.parseRouteTag(tag)) !== "unclosed";
}

export function handleVehicleRouteSurfaceTag(
  vehicle: VehicleRouteSurfaceContext,
  tag: string,
  surfaces: VehicleSurfaceResolvers,
): boolean {
  if (!vehicle.canHandleRouteSurfaceTag(tag)) return false;
  const kind = surfaces.surfaceKind(surfaces.parseRouteTag(tag));
  if (kind === "rail" || kind === "rail-rain") {
    if (tag.includes("out:next")) vehicle.requestMotionMode(true, 6);
    if (tag.includes("in:next")) vehicle.enterRailMode();
  }
  return true;
}

export interface RailCheckpointContext {
  runtime: { motionMode: number; railFrame?: unknown };
}

export function prepareVehicleRailCheckpointReentry(vehicle: RailCheckpointContext): void {
  if (vehicle.runtime.motionMode === 2 || vehicle.runtime.motionMode === 3) vehicle.runtime.motionMode = 0;
  vehicle.runtime.railFrame = undefined;
}

export interface VehicleRailContactContext { wheels: { railContactDescriptor?: unknown } }

export function vehicleContactRailId(
  vehicle: VehicleRailContactContext,
  surfaces: VehicleSurfaceResolvers,
): unknown {
  const descriptor = vehicle.wheels.railContactDescriptor;
  return descriptor ? surfaces.railId(descriptor) : undefined;
}

export interface VehicleOneShotEvents {
  runtime: {
    railResetRequest: boolean;
    collisionAudioStrength: number;
    strongLateralCollision: boolean;
    shockWaveRequest: boolean;
    steeringCollisionAudioGain: number;
    automaticResetRequest: boolean;
  };
  trackEventEffectRequests: unknown[];
}

/** Each consume method returns the pending event and clears its latch. */
export function consumeVehicleRailResetRequest(vehicle: VehicleOneShotEvents): boolean {
  const requested = vehicle.runtime.railResetRequest;
  vehicle.runtime.railResetRequest = false;
  return requested;
}

export function consumeVehicleCollisionAudioStrength(vehicle: VehicleOneShotEvents): number {
  const strength = vehicle.runtime.collisionAudioStrength;
  vehicle.runtime.collisionAudioStrength = 0;
  return strength;
}

export function consumeVehicleCrashEffectRequest(vehicle: VehicleOneShotEvents): boolean {
  const requested = vehicle.runtime.strongLateralCollision;
  vehicle.runtime.strongLateralCollision = false;
  return requested;
}

export function consumeVehicleShockWaveRequest(vehicle: VehicleOneShotEvents): boolean {
  const requested = vehicle.runtime.shockWaveRequest;
  vehicle.runtime.shockWaveRequest = false;
  return requested;
}

export function consumeVehicleTrackEventEffectRequests(vehicle: VehicleOneShotEvents): unknown[] {
  const requests = vehicle.trackEventEffectRequests;
  vehicle.trackEventEffectRequests = [];
  return requests;
}

export function consumeVehicleSteeringCollisionAudioGain(vehicle: VehicleOneShotEvents): number {
  const gain = vehicle.runtime.steeringCollisionAudioGain;
  vehicle.runtime.steeringCollisionAudioGain = 0;
  return gain;
}

export function consumeVehicleAutomaticResetRequest(vehicle: VehicleOneShotEvents): boolean {
  const requested = vehicle.runtime.automaticResetRequest;
  vehicle.runtime.automaticResetRequest = false;
  return requested;
}

export interface VehicleAudioDisplayContext {
  runtime: {
    physicsState: number;
    dualBoosterMode: number;
    dualBoosterState: number;
    dualReadyRemainingMs: number;
    dualBoosterTeam: boolean;
    cachedDisplaySpeedKmh: number;
  };
}

export function vehicleAudioState(vehicle: VehicleAudioDisplayContext): number {
  return vehicle.runtime.physicsState;
}

export function vehicleDualBoosterMode(vehicle: VehicleAudioDisplayContext): number {
  return vehicle.runtime.dualBoosterMode;
}

export function vehicleDualBoosterState(vehicle: VehicleAudioDisplayContext): number {
  return vehicle.runtime.dualBoosterState;
}

export function vehicleDualBoosterReadyRemainingMs(vehicle: VehicleAudioDisplayContext): number {
  return Math.max(0, Math.trunc(vehicle.runtime.dualReadyRemainingMs));
}

export function vehicleDualBoosterTeam(vehicle: VehicleAudioDisplayContext): boolean {
  const { runtime } = vehicle;
  return runtime.physicsState === 4 || (runtime.physicsState === 10 && runtime.dualBoosterTeam);
}

export function vehicleDisplaySpeedKmh(vehicle: VehicleAudioDisplayContext): number {
  return vehicle.runtime.cachedDisplaySpeedKmh;
}

export function vehicleNetworkMotionMode(vehicle: { runtime: { motionMode: number } }): number {
  return vehicle.runtime.motionMode;
}

export interface Vector3 { x: number; y: number; z: number }

export interface VehicleNetworkPhysicsContext {
  scratch: { force: Vector3; torque: Vector3 };
  body: { linearVelocity: Vector3; angularVelocity: Vector3 };
  runtime: {
    automaticResetInteractionActive: boolean;
    collisionMotionHit: boolean;
    collisionMotionStrength: number;
  };
  collisionShape: { scaleX: number; scaleY: number };
}

export function copyVehicleNetworkWrench(
  vehicle: VehicleNetworkPhysicsContext,
  output: { force: Vector3; torque: Vector3 },
): void {
  Object.assign(output.force, vehicle.scratch.force);
  Object.assign(output.torque, vehicle.scratch.torque);
}

export function vehicleNetworkCollisionState(vehicle: VehicleNetworkPhysicsContext): {
  active: boolean; scaleX: number; scaleY: number;
} {
  return {
    active: vehicle.runtime.automaticResetInteractionActive,
    scaleX: vehicle.collisionShape.scaleX,
    scaleY: vehicle.collisionShape.scaleY,
  };
}

export function vehicleNetworkCollisionScheduled(vehicle: {
  clock: { getRhythmState(): { tick: number } };
}): number {
  return vehicle.clock.getRhythmState().tick;
}

export function applyVehicleKartPairResponse(
  vehicle: VehicleNetworkPhysicsContext,
  linearImpulse: Vector3,
  angularImpulse: Vector3,
  strength: number,
): void {
  for (const axis of ["x", "y", "z"] as const) {
    vehicle.body.linearVelocity[axis] = float(vehicle.body.linearVelocity[axis] + linearImpulse[axis]);
    vehicle.body.angularVelocity[axis] = float(vehicle.body.angularVelocity[axis] + angularImpulse[axis]);
  }
  vehicle.runtime.collisionMotionHit = true;
  vehicle.runtime.collisionMotionStrength = Math.max(vehicle.runtime.collisionMotionStrength, strength);
}

export interface VehicleControlSettings {
  itemMode?: boolean;
  runtime: {
    raceMotionLocked: boolean;
    physicsState: number;
    stateRemainingMs: number;
    driveSteeringSuppressed: boolean;
    fullPhysicsBypass: boolean;
    automaticResetInteractionActive: boolean;
    interactionActive: boolean;
    pressProtected1C0: boolean;
    driveScale: number;
    steeringExponentialScale: number;
    dragScale: number;
    chargerDurationScale: number;
    catchupDragScale: number;
    catchupSteeringScale: number;
    draftAccelerationScale: number;
    animationSlot: number;
    animationInput?: unknown;
  };
  tuning: { startBoosterTimeSpeed: number; startBoosterTimeItem?: number };
  state: { boostTime: number };
}

export function startVehicleRaceBooster(vehicle: VehicleControlSettings): void {
  const { runtime, tuning } = vehicle;
  if (runtime.physicsState !== 0) return;
  // Item races use StartBoosterTimeItem; the release only knew the speed variant.
  const duration = Math.max(0, Math.trunc(vehicle.itemMode
    ? tuning.startBoosterTimeItem ?? tuning.startBoosterTimeSpeed : tuning.startBoosterTimeSpeed));
  runtime.physicsState = 1;
  runtime.stateRemainingMs = duration;
  vehicle.state.boostTime = duration * 0.001;
}

export function setVehicleRaceMotionLocked(vehicle: VehicleControlSettings, locked: boolean): void {
  vehicle.runtime.raceMotionLocked = locked;
}

export function startVehiclePlayBooster(vehicle: VehicleControlSettings, input: { rawDriftHeld: boolean }): void {
  const { runtime } = vehicle;
  if (!runtime.raceMotionLocked || !input.rawDriftHeld) return;
  runtime.physicsState = 18;
  runtime.stateRemainingMs = 1000;
  vehicle.state.boostTime = 0;
}

export function restoreVehicleResetInteraction(vehicle: VehicleControlSettings): void {
  vehicle.runtime.automaticResetInteractionActive = true;
  vehicle.runtime.interactionActive = true;
}

export interface VehicleModeInventoryContext {
  itemMode?: boolean;
  runtime: { committedGauge: number; speedSlots: number[] };
  tuning: { driftMaxGauge: number };
  state: { nitro: number };
  clearResetGaugeRefill(): void;
  updatePublicGauge(): void;
}

const isNitroSlot = (slot: number) => slot === 6 || slot === 14;

export function updateVehicleModeInventory(vehicle: VehicleModeInventoryContext): boolean {
  // Item races have no drift gauge booster; boosters come only from item boxes.
  if (vehicle.itemMode) return false;
  const gaugeMax = float(Math.max(vehicle.tuning.driftMaxGauge, 1));
  if (vehicle.runtime.committedGauge !== gaugeMax) return false;
  vehicle.clearResetGaugeRefill();
  vehicle.runtime.committedGauge = float(vehicle.runtime.committedGauge - gaugeMax);
  const emptySlot = vehicle.runtime.speedSlots.findIndex(slot => slot === -1);
  if (emptySlot >= 0) vehicle.runtime.speedSlots[emptySlot] = 6;
  vehicle.state.nitro = vehicle.runtime.speedSlots.filter(isNitroSlot).length;
  vehicle.updatePublicGauge();
  return true;
}

export interface VehicleLowSpeedResetContext {
  runtime: { automaticResetInteractionActive: boolean; fullPhysicsBypass: boolean };
  body: { linearVelocity: Vector3 };
}

export function isVehicleLowSpeedAutomaticResetActive(
  vehicle: VehicleLowSpeedResetContext,
  input: { forward: number; reverse: number },
): boolean {
  if (!(float(input.forward) > 0 || float(input.reverse) > 0)
    || !vehicle.runtime.automaticResetInteractionActive || vehicle.runtime.fullPhysicsBypass) return false;
  const velocity = vehicle.body.linearVelocity;
  const speedSquared = float(float(float(velocity.x * velocity.x) + float(velocity.z * velocity.z))
    + float(velocity.y * velocity.y));
  return !(speedSquared > float(1));
}

export interface VehicleCancelControlsContext extends NitroSeamlessContext {
  runtime: { triggerPhase: boolean; oneSubstepDrift: boolean };
  state: { drifting: boolean; driftDirection: number };
  stopDrift(): void;
  cancelControls(): void;
}

export function cancelVehicleControls(vehicle: VehicleCancelControlsContext): void {
  vehicle.stopDrift();
  vehicle.nitroSeamlessRequest = false;
}

export function hardCancelVehicleControls(vehicle: VehicleCancelControlsContext): void {
  vehicle.cancelControls();
  vehicle.runtime.triggerPhase = false;
  vehicle.runtime.oneSubstepDrift = false;
  vehicle.state.drifting = false;
  vehicle.state.driftDirection = 0;
}

export interface VehicleDriftStopContext {
  wheels: { roadDescriptor: unknown };
  runtime: {
    activeDrift: boolean;
    delayedDriftRequest: boolean;
    roadTransient: number;
    bodySpeed: number;
  };
}

export function stopVehicleDrift(vehicle: VehicleDriftStopContext, surfaces: VehicleSurfaceResolvers): void {
  const { runtime } = vehicle;
  // The released Mt helper skips VG when a road descriptor is absent.
  if (vehicle.wheels.roadDescriptor && surfaces.roadSurface(vehicle.wheels.roadDescriptor) === "dirt"
    && runtime.activeDrift && runtime.roadTransient <= 0) {
    const speedFraction = float(runtime.bodySpeed / float(120));
    runtime.roadTransient = float(float(10) * float(speedFraction * speedFraction));
  }
  runtime.activeDrift = false;
  runtime.delayedDriftRequest = false;
}

export function setVehicleDriveSteeringSuppressed(vehicle: VehicleControlSettings, suppressed: boolean): void {
  vehicle.runtime.driveSteeringSuppressed = suppressed;
}

export function isVehicleDriveSteeringSuppressed(vehicle: VehicleControlSettings): boolean {
  return vehicle.runtime.driveSteeringSuppressed;
}

export function setVehicleFullPhysicsBypass(vehicle: VehicleControlSettings, bypass: boolean): void {
  vehicle.runtime.fullPhysicsBypass = bypass;
}

export function setVehicleWarpPresentationActive(vehicle: VehicleControlSettings, active: boolean): void {
  vehicle.runtime.automaticResetInteractionActive = !active;
  vehicle.runtime.interactionActive = !active;
}

export function isVehicleWarpPresentationActive(vehicle: VehicleControlSettings): boolean {
  return !vehicle.runtime.interactionActive;
}

export function setVehicleWarpPressProtected(vehicle: VehicleControlSettings, protectedPress: boolean): void {
  vehicle.runtime.pressProtected1C0 = protectedPress;
}

export interface VehicleRuntimeScales { drive?: number; steering?: number; drag?: number }

export function setVehicleRuntimeScales(vehicle: VehicleControlSettings, scales: VehicleRuntimeScales): void {
  if (scales.drive !== undefined) vehicle.runtime.driveScale = float(scales.drive);
  if (scales.steering !== undefined) vehicle.runtime.steeringExponentialScale = float(scales.steering);
  if (scales.drag !== undefined) vehicle.runtime.dragScale = float(scales.drag);
}

export interface MultiplayerDrivingScales {
  catchupDrag: number;
  catchupSteering: number;
  draftAcceleration: number;
  chargerDuration?: number;
}

/** Validate server-supplied handicap values before installing them in the physics runtime. */
export function setVehicleMultiplayerDrivingScales(
  vehicle: VehicleControlSettings,
  scales: MultiplayerDrivingScales,
): void {
  if (!Number.isFinite(scales.catchupDrag) || scales.catchupDrag < float(0.85) || scales.catchupDrag > 1
    || !Number.isFinite(scales.catchupSteering) || scales.catchupSteering < float(0.95)
    || scales.catchupSteering > 1 || !Number.isFinite(scales.draftAcceleration)
    || scales.draftAcceleration < 1 || scales.draftAcceleration > 4
    || (scales.chargerDuration !== undefined
      && ![1, float(1.2), float(1.4), float(1.8)].includes(scales.chargerDuration)))
    throw new Error("Invalid multiplayer driving scales");
  if (scales.chargerDuration !== undefined) vehicle.runtime.chargerDurationScale = float(scales.chargerDuration);
  vehicle.runtime.catchupDragScale = float(scales.catchupDrag);
  vehicle.runtime.catchupSteeringScale = float(scales.catchupSteering);
  vehicle.runtime.draftAccelerationScale = float(scales.draftAcceleration);
}

export interface VehicleEventPhysicsContext {
  runtime: {
    eventScaleTarget: Vector3;
    eventScaleAnchorMs: number;
    eventScaleMode: number;
    gravityDivisor: number;
  };
  body: { linearVelocity: Vector3; angularVelocity: Vector3 };
}

export function triggerVehicleEventScale(vehicle: VehicleEventPhysicsContext, percentage: number): boolean {
  if (![60, 100, 180, 320].includes(percentage)) return false;
  const scale = float(float(percentage) / float(100));
  vehicle.runtime.eventScaleTarget = { x: scale, y: scale, z: scale };
  vehicle.runtime.eventScaleAnchorMs = 0;
  vehicle.runtime.eventScaleMode = 1;
  return true;
}

export function triggerVehicleEventGravity(vehicle: VehicleEventPhysicsContext, divisor: number): boolean {
  if (![1, 1.5, 2, 3, 3.2, 5, 9].includes(divisor)) return false;
  for (const axis of ["x", "y", "z"] as const) {
    vehicle.body.linearVelocity[axis] = float(float(vehicle.body.linearVelocity[axis]) / float(4));
    vehicle.body.angularVelocity[axis] = float(float(vehicle.body.angularVelocity[axis]) / float(5));
  }
  vehicle.runtime.gravityDivisor = float(divisor);
  return true;
}

export function setVehicleAnimationSlot(vehicle: VehicleControlSettings, slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot > 6) throw new Error("ReKart 动画槽必须位于 0..6。");
  vehicle.runtime.animationSlot = slot;
}

export function consumeVehicleKartAnimationInput(vehicle: VehicleControlSettings): unknown {
  const input = vehicle.runtime.animationInput;
  vehicle.runtime.animationInput = undefined;
  return input;
}

export interface VehicleFlyingPetContext {
  flyingPetListeners: Set<(reset: boolean) => void>;
}

export function addVehicleFlyingPetListener(
  vehicle: VehicleFlyingPetContext,
  listener: (reset: boolean) => void,
): () => boolean {
  vehicle.flyingPetListeners.add(listener);
  return () => vehicle.flyingPetListeners.delete(listener);
}

export interface VehicleGiantContext extends VehicleFlyingPetContext {
  giant?: { reset(): void };
  runtime: {
    raceMotionLocked: boolean;
    fullPhysicsBypass: boolean;
    pressProtected1C0: boolean;
    motionMode: number;
    speedSlots: number[];
    speedSlotDisabled: boolean[];
    eventScalePrimary: Vector3;
    eventScaleSecondary: Vector3;
    visualScaleA: Vector3;
    visualScaleRestorePending: boolean;
    visualScaleTransitionAnchorMs?: number;
    obstacleSuppressionRemainingMs: number;
    obstacleSuppressionLatch: boolean;
    pressState: number;
  };
  state: { nitro: number };
  lteMotion?: unknown;
  syncPresentationFields(): void;
}

export function vehicleLteDodgeAvailable(vehicle: VehicleGiantContext): boolean {
  const { runtime } = vehicle;
  return !!vehicle.lteMotion && !runtime.raceMotionLocked && !runtime.fullPhysicsBypass
    && !runtime.pressProtected1C0 && runtime.motionMode === 0;
}

export function vehicleGiantSourceProtected(vehicle: VehicleGiantContext): boolean {
  return vehicle.runtime.pressProtected1C0;
}

export function compensateVehicleGiantBooster(vehicle: VehicleGiantContext): void {
  if (!vehicle.giant) return;
  const { runtime } = vehicle;
  const emptySlot = runtime.speedSlots.findIndex((slot, index) => slot === -1 && !runtime.speedSlotDisabled[index]);
  if (emptySlot >= 0) runtime.speedSlots[emptySlot] = 6;
  vehicle.state.nitro = runtime.speedSlots.filter(isNitroSlot).length;
}

export function clearVehicleGiantRaceEffects(vehicle: VehicleGiantContext): void {
  if (!vehicle.giant) return;
  vehicle.giant.reset();
  const { runtime } = vehicle;
  runtime.eventScalePrimary = { x: 1, y: 1, z: 1 };
  runtime.eventScaleSecondary = { x: 1, y: 1, z: 1 };
  runtime.visualScaleA = { x: 1, y: 1, z: 1 };
  runtime.visualScaleRestorePending = false;
  runtime.visualScaleTransitionAnchorMs = undefined;
  runtime.obstacleSuppressionRemainingMs = 0;
  runtime.obstacleSuppressionLatch = false;
  runtime.pressState = 0;
  runtime.pressProtected1C0 = false;
  vehicle.flyingPetListeners.forEach(listener => listener(true));
  vehicle.syncPresentationFields();
}
