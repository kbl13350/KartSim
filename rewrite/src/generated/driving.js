// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { initializeVehicle } from "../driving/construct-vehicle.ts";
import * as VehicleCommands from "../driving/vehicle-commands.ts";
import * as VehicleTachometer from "../driving/tachometer.ts";
import * as VehicleInitialization from "../driving/initial-state.ts";
import * as VehiclePresentation from "../driving/presentation-view.ts";
import * as VehicleReset from "../driving/reset-runtime.ts";
import * as VehicleDebug from "../driving/debug-state.ts";
import { applyLongitudinalForce, applyVelocityDrag, integrateVehicleVelocity } from "../driving/continuous-motion.ts";
import { advanceVehicleFrame } from "../driving/frame-update.ts";
import { advancePhysicsSubstep } from "../driving/frame-pipeline.ts";
import { applySuspensionForce, applyAirborneForces } from "../driving/surface-forces.ts";
import { accumulateDriftCharge, commitDriftCharge, updateDriftWindows, preserveDriftChargeAfterCollision } from "../driving/drift-gauge.ts";
import { resolveVehicleTrackCollision, resolveVehicleObstacleCollisions, applyHighContactAngularResponse, applyWallContactAngularResponse } from "../driving/track-collision.ts";
import { applySteeringTireForces } from "../driving/steering-tires.ts";
import { applyRoadSurfaceConsumers } from "../driving/road-consumers.ts";
import { probeVehicleWheels } from "../driving/wheel-probe.ts";
import { recoverUnconfirmedWheelContacts } from "../driving/wheel-recovery.ts";
import { applySlipSurfaceAlignment } from "../driving/slip-alignment.ts";
import { beginRoadAction, advanceStateTimerSeconds, advanceStateTimerMilliseconds, accumulateSpeedCharge } from "../driving/motion-state.ts";
import { rebuildVehicleBodyState, applyBoosterChargeRoad, updateSpeedChargeEligibility, applyJumpRoadTuning, requestResetRoad } from "../driving/contact-preparation.ts";
import { updatePrimaryCollisionResetTimers, updateObstacleCollisionResetTimer, advanceCollisionResetTimer, activateDirectionalCollisionPress, activateHardCollisionPress } from "../driving/automatic-reset.ts";
import { scanSpecialRoadSurfaces, scanSpecialRoadStrip } from "../driving/special-road.ts";
import { enterVehicleRailMode, requestVehicleMotionMode, returnVehicleToRoad } from "../driving/rail-transitions.ts";
import { captureVehicleRail } from "../driving/rail-capture.ts";
import { produceVehicleRailFrame } from "../driving/rail-frame.ts";
import { applyVehicleRailDynamics } from "../driving/rail-dynamics.ts";
import { integrateVehicleRailOrientation, integrateVehicleRoadOrientation } from "../driving/orientation-integration.ts";
import { countVehicleResultCrash, resolveVehicleTrackEvents, makeSecondaryCollisionBox, updateVehicleCollisionGaugeOwners } from "../driving/collision-events.ts";
import { publishVehicleGauge, mainVehicleGaugeRatio, updateInstantAccelerationCharge, settleInstantWallCharge, beginInstantWallChargeWindow, advanceResetGaugeRefill, beginWallGaugeWindow, settleWallGaugeWindow, setWallGaugeRefund, clearWallGaugeRefund, cacheDisplaySpeed, syncVehiclePresentation } from "../driving/collision-gauges.ts";
import { startVehicleNormalBooster, activateVehicleCharger, vehicleChargerDurationMs, expireVehicleCharger, updateVehicleDualBooster, armVehicleDualBooster, refreshVehicleDualBoosterReady, classifyVehicleDualBoosterReady, clearVehicleDualBoosterReady } from "../driving/booster-state.ts";
import { advanceObstacleSuppression, vehicleVisualScaleMode, setVehicleVisualScaleMode, updateVehicleVisualScale, updateVehicleScaleMode, updateVehicleEventScale, updateVehicleEventGravity } from "../driving/visual-scale.ts";
import { accumulateVehicleTeamGauge, consumeVehicleTeamGaugeCharge, enqueueVehicleTeamGaugeTarget, updateVehicleTeamGauge, consumeVehicleTeamGaugeFullAnimation, teamGaugeSettledAtMs, convertVehicleTeamBoosterSlots, expireVehicleTeamSlotWindow, vehicleSpeedSlotDisabled, teamSlotWindowStartMs } from "../driving/team-gauge.ts";
import { Ri, VG } from "./formats.js";
import { Q00 } from "./library.js";
import { F2, I1, N1, Rg, Tt, m, t0 } from "./math.js";
import { $40, $C, Cs, Eg, H40, HC, J40, K40, NC, OC, Q40, UC, VC, Vo, W40, WC, X40, Y40, Z40, _g, ad, cd, cs, ec, j40, ld, mi, nc, od, q40, qC, tc, ud, x5, zC } from "./vehicle.js";

const vehicleSurfaces = { parseRouteTag: Vo, surfaceKind: Eg, railId: Ri, roadSurface: Mt };

class AL {
    constructor(e, t, i = false, r = false, s = false, o, a, c, l = false) { initializeVehicle(this, e, t, i, r, s, o, a, c, l, Q00); }
  externalTeamGauge;
  speedRaceMode;
  lteMotion;
  giant;
  checkClientFramerate;
  state;
  body;
  tuning;
  collisionShape;
  teamBooster;
  teamBoosterDirect;
  wheels;
  clock = new $40();
  flyingPetListeners = new Set();
  trackEventEffectRequests = [];
  dualBoostAuto = !0;
  dualBoostAutoArm = !0;
  nitroSeamlessRequest = !1;
  runtime;
  scratch = ni0();
  cameraRuntimeView = {
    wheelContact: !1,
    averageWheelHitNormal: F2(),
    eventScaleSecondary: F2(),
    stateCode: 0,
    motionMode: 0,
    action8: !1,
    mrContact: !1,
    hwContact: !1,
    motorcycleType: !1,
    tireTransient: 0,
    effectiveReverseScalar: 0,
    landingMotionTrigger: !1,
    landingShockAudioStrength: 0,
    collisionMotionHit: !1,
    collisionMotionStrength: 0,
    visualScaleMode: 0,
  };
  driftVisualView = {
    active: !1,
    contact: !1,
    speedKmh: 0,
    forwardSpeed: 0,
    motionMode: 0,
    roadSurface: void 0,
    rearWheelCompression: [0, 0],
    wheelCompressionBaseline: 0,
    obstacleWheelHit: !1,
    fullPhysicsBypass: !1,
    position: F2(),
    right: F2(),
    forward: F2(),
    up: F2(),
    presentationRight: F2(),
    presentationForward: F2(),
    presentationUp: F2(),
  };
  driftVisualScratch = F2();
    update(milliseconds, input, track) { return advanceVehicleFrame(this, milliseconds, input, track); }
  synchronizeClock(e) { return VehicleCommands.synchronizeVehicleClock(this, e); }
  updateLockedIngameClock(e) { return VehicleCommands.updateVehicleLockedClock(this, e); }
  setDualBoostAuto(e, t) { return VehicleCommands.setVehicleDualBoostAuto(this, e, t); }
  driveCameraRuntime() { return VehiclePresentation.updateCameraRuntimeView(this); }
  driftVisualRuntime() { return VehiclePresentation.updateDriftVisualView(this); }
  reset(e, t, i, r) { return VehicleReset.resetVehicle(this, e, t, i, r); }
  resetFromRouteFrame(e) { return VehicleReset.resetVehicleFromRoute(this, e); }
  handleDrivingCommand(e, t) { return VehicleCommands.handleVehicleDrivingCommand(this, e, t); }
  tryConsumeNormalBooster(e) { return VehicleCommands.tryConsumeVehicleNormalBooster(this, e); }
  queueNitroSeamless() { return VehicleCommands.queueVehicleNitroSeamless(this); }
  cancelNitroSeamless() { return VehicleCommands.cancelVehicleNitroSeamless(this); }
  canHandleRouteSurfaceTag(e) { return VehicleCommands.canHandleVehicleRouteSurfaceTag(e, vehicleSurfaces); }
  handleRouteSurfaceTag(e) { return VehicleCommands.handleVehicleRouteSurfaceTag(this, e, vehicleSurfaces); }
  prepareRailCheckpointReentry() { return VehicleCommands.prepareVehicleRailCheckpointReentry(this); }
  contactRailId() { return VehicleCommands.vehicleContactRailId(this, vehicleSurfaces); }
  consumeRailResetRequest() { return VehicleCommands.consumeVehicleRailResetRequest(this); }
  consumeCollisionAudioStrength() { return VehicleCommands.consumeVehicleCollisionAudioStrength(this); }
  consumeCrashEffectRequest() { return VehicleCommands.consumeVehicleCrashEffectRequest(this); }
  consumeShockWaveRequest() { return VehicleCommands.consumeVehicleShockWaveRequest(this); }
  consumeTrackEventEffectRequests() { return VehicleCommands.consumeVehicleTrackEventEffectRequests(this); }
  consumeSteeringCollisionAudioGain() { return VehicleCommands.consumeVehicleSteeringCollisionAudioGain(this); }
  consumeAutomaticResetRequest() { return VehicleCommands.consumeVehicleAutomaticResetRequest(this); }
  audioState() { return VehicleCommands.vehicleAudioState(this); }
  dualBoosterMode() { return VehicleCommands.vehicleDualBoosterMode(this); }
  dualBoosterState() { return VehicleCommands.vehicleDualBoosterState(this); }
  dualBoosterReadyRemainingMs() { return VehicleCommands.vehicleDualBoosterReadyRemainingMs(this); }
  dualBoosterTeam() { return VehicleCommands.vehicleDualBoosterTeam(this); }
  displaySpeedKmh() { return VehicleCommands.vehicleDisplaySpeedKmh(this); }
  copyNetworkWrench(e) { return VehicleCommands.copyVehicleNetworkWrench(this, e); }
  get networkMotionMode() { return VehicleCommands.vehicleNetworkMotionMode(this); }
  networkCollisionState() { return VehicleCommands.vehicleNetworkCollisionState(this); }
  applyKartPairResponse(e, t, i) { return VehicleCommands.applyVehicleKartPairResponse(this, e, t, i); }
  timeAttackTachometerSpeed() { return VehicleTachometer.vehicleTachometerSpeed(this); }
  timeAttackTachometerGauges() { return VehicleTachometer.vehicleTachometerGauges(this); }
  timeAttackSpeedSlots() { return VehicleTachometer.vehicleSpeedSlots(this); }
  canReorderSpeedSlots() { return VehicleTachometer.canReorderVehicleSpeedSlots(this); }
  timeAttackSlotChangerActive() { return VehicleTachometer.vehicleSlotChangerActive(this); }
  reorderSpeedSlots() { return VehicleTachometer.reorderVehicleSpeedSlots(this); }
  consumeSpeedSlotReordered() { return VehicleTachometer.consumeVehicleSpeedSlotReordered(this); }
  timeAttackTachometerExceed() { return VehicleTachometer.vehicleTachometerExceed(this); }
  timeAttackBoosterUnlimited() { return VehicleTachometer.vehicleBoosterUnlimited(this); }
  timeAttackTachometerDriftMaxGauge() { return VehicleTachometer.vehicleDriftMaxGauge(this); }
  timeAttackTachometerIncGauge() { return VehicleTachometer.vehicleTachometerIncGauge(this); }
  timeAttackTachometerCharger() { return VehicleTachometer.vehicleTachometerCharger(this); }
  timeAttackTachometerCollision() { return VehicleTachometer.vehicleTachometerCollision(this); }
  consumeTimeAttackTachometerNormalBooster() { return VehicleTachometer.consumeVehicleNormalBoosterDuration(this); }
  consumeTimeAttackTachometerGaugePreserve() { return VehicleTachometer.consumeVehicleGaugePreserveMarker(this); }
  timeAttackResultCounts() { return VehicleTachometer.vehicleTimeAttackResultCounts(this); }
  timeAttackTachometerAnimationState() { return VehicleTachometer.vehicleTachometerAnimationState(this); }
  startRaceBooster() { return VehicleCommands.startVehicleRaceBooster(this); }
  setRaceMotionLocked(e) { return VehicleCommands.setVehicleRaceMotionLocked(this, e); }
  startPlayBooster(e) { return VehicleCommands.startVehiclePlayBooster(this, e); }
  lowSpeedAutomaticResetActive(e) { return VehicleCommands.isVehicleLowSpeedAutomaticResetActive(this, e); }
  beginResetInitiation(e) { return VehicleReset.beginVehicleReset(this, e); }
  prepareLowHeightResetPose() { return VehicleReset.prepareVehicleLowHeightReset(this); }
  completeCheckpointPose(e, t) { return VehicleReset.placeVehicleAtCheckpoint(this, e, t); }
  warpPosition(e) { return VehicleReset.warpVehiclePosition(this, e); }
  restoreResetInteraction() { return VehicleCommands.restoreVehicleResetInteraction(this); }
  updateModeInventory() { return VehicleCommands.updateVehicleModeInventory(this); }
  cancelControls() { return VehicleCommands.cancelVehicleControls(this); }
  stopDrift() { return VehicleCommands.stopVehicleDrift(this, vehicleSurfaces); }
  hardCancelControls() { return VehicleCommands.hardCancelVehicleControls(this); }
  setDriveSteeringSuppressed(e) { return VehicleCommands.setVehicleDriveSteeringSuppressed(this, e); }
  isDriveSteeringSuppressed() { return VehicleCommands.isVehicleDriveSteeringSuppressed(this); }
  setFullPhysicsBypass(e) { return VehicleCommands.setVehicleFullPhysicsBypass(this, e); }
  setWarpPresentationActive(e) { return VehicleCommands.setVehicleWarpPresentationActive(this, e); }
  isWarpPresentationActive() { return VehicleCommands.isVehicleWarpPresentationActive(this); }
  setWarpPressProtected(e) { return VehicleCommands.setVehicleWarpPressProtected(this, e); }
  setRuntimeScales(e) { return VehicleCommands.setVehicleRuntimeScales(this, e); }
  setMultiplayerDrivingScales(e) { return VehicleCommands.setVehicleMultiplayerDrivingScales(this, e); }
  triggerEventScale(e) { return VehicleCommands.triggerVehicleEventScale(this, e); }
  triggerEventGravity(e) { return VehicleCommands.triggerVehicleEventGravity(this, e); }
  setAnimationSlot(e) { return VehicleCommands.setVehicleAnimationSlot(this, e); }
  consumeKartAnimationInput() { return VehicleCommands.consumeVehicleKartAnimationInput(this); }
  addFlyingPetListener(e) { return VehicleCommands.addVehicleFlyingPetListener(this, e); }
  getDebugState() { return VehicleDebug.snapshotVehicleDebugState(this); }
  settle(e, t) { return VehicleReset.settleVehicle(this, e, t, W40); }
  lteDodgeAvailable() { return VehicleCommands.vehicleLteDodgeAvailable(this); }
  get networkCollisionScheduled() { return VehicleCommands.vehicleNetworkCollisionScheduled(this); }
  giantSourceProtected() { return VehicleCommands.vehicleGiantSourceProtected(this); }
  compensateGiantBooster() { return VehicleCommands.compensateVehicleGiantBooster(this); }
  clearGiantRaceEffects() { return VehicleCommands.clearVehicleGiantRaceEffects(this); }
    stepSubstep(seconds, input, track) { return advancePhysicsSubstep(this, seconds, input, track); }
    applyBoosterChargeSurface() { return applyBoosterChargeRoad(this); }
    updateTachometerIncGauge(full3DRail) { return updateSpeedChargeEligibility(this, full3DRail); }
    applyJumpSurfaceTuning() { return applyJumpRoadTuning(this); }
    applyResetSurfaceRequest() { return requestResetRoad(this); }
    rebuildBodyState(force, torque) { return rebuildVehicleBodyState(this, force, torque); }
    scanSpecialRoad(track) { return scanSpecialRoadSurfaces(this, track); }
    scanSpecialRoadPrefix(track, prefix, rayLength) { return scanSpecialRoadStrip(this, track, prefix, rayLength); }
    probeWheels(track, roadOnly) { return probeVehicleWheels(this, track, roadOnly); }
    applySupplementalWheelRecovery(track) { return recoverUnconfirmedWheelContacts(this, track); }
    enterRailMode() { return enterVehicleRailMode(this); }
    requestMotionMode(lift, nextMode) { return requestVehicleMotionMode(this, lift, nextMode); }
    captureRail(seconds, track) { return captureVehicleRail(this, seconds, track); }
    produceRailFrame(seconds, track) { return produceVehicleRailFrame(this, seconds, track); }
    applyFull3DRail(seconds, input, track, force, torque) { return applyVehicleRailDynamics(this, seconds, input, track, force, torque); }
    returnToStandard(seconds, track) { return returnVehicleToRoad(this, seconds, track); }
    integrateFull3D(seconds) { return integrateVehicleRailOrientation(this, seconds); }
    applySuspension(seconds, force, torque) { return applySuspensionForce(this, seconds, force, torque); }
    applyAirState(force, torque) { return applyAirborneForces(this, force, torque); }
    applyLongitudinal(seconds, input, force) { return applyLongitudinalForce(this, seconds, input, force); }
    applySteeringAndTires(seconds, input, force, torque) { return applySteeringTireForces(this, seconds, input, force, torque); }
    applyRoadConsumers(seconds, force) { return applyRoadSurfaceConsumers(this, seconds, force); }
    applySlipAlignment() { return applySlipSurfaceAlignment(this); }
    integrateStandardOrientation(seconds) { return integrateVehicleRoadOrientation(this, seconds); }
    setRoadActionState(state, milliseconds) { return beginRoadAction(this, state, milliseconds); }
    applyDrag(force, torque, full3DRail) { return applyVelocityDrag(this, force, torque, full3DRail); }
    integrateVelocity(seconds, force, torque, extraForce) { return integrateVehicleVelocity(this, seconds, force, torque, extraForce); }
    accumulateDriftGauge(seconds, full3DRail) { return accumulateDriftCharge(this, seconds, full3DRail); }
    accumulateTeamGauge(amount) { return accumulateVehicleTeamGauge(this, amount); }
    accumulateSpeedGauge(seconds, full3DRail) { return accumulateSpeedCharge(this, seconds, full3DRail); }
    commitDriftGauge() { return commitDriftCharge(this); }
    consumeMultiplayerTeamCharge() { return consumeVehicleTeamGaugeCharge(this); }
    enqueueMultiplayerTeamTarget(fraction) { return enqueueVehicleTeamGaugeTarget(this, fraction); }
    updateTeamGauge(nowMs) { return updateVehicleTeamGauge(this, nowMs); }
    consumeTeamGaugeFullAnimation() { return consumeVehicleTeamGaugeFullAnimation(this); }
    timeAttackTeamGaugeSettledAtMs() { return teamGaugeSettledAtMs(this); }
    convertTeamBoosterSlots(nowMs, temporary) { return convertVehicleTeamBoosterSlots(this, nowMs, temporary); }
    updateTeamSlotWindow(nowMs) { return expireVehicleTeamSlotWindow(this, nowMs); }
    timeAttackSpeedSlotDisabled() { return vehicleSpeedSlotDisabled(this); }
    timeAttackSpeedSlotWindowStartMs() { return teamSlotWindowStartMs(this); }
    startNormalBooster(input) { return startVehicleNormalBooster(this, input); }
    activateChargerIfReady() { return activateVehicleCharger(this); }
    chargerDurationMs() { return vehicleChargerDurationMs(this); }
    updateChargerExpiry(nowMs) { return expireVehicleCharger(this, nowMs); }
    updateStateTimer(seconds) { return advanceStateTimerSeconds(this, seconds); }
    updateDriftLifecycleTimers(seconds) { return updateDriftWindows(this, seconds); }
    updateStateTimerMilliseconds(milliseconds) { return advanceStateTimerMilliseconds(this, milliseconds); }
    updateDualBooster() { return updateVehicleDualBooster(this); }
    armDualBooster() { return armVehicleDualBooster(this); }
    refreshDualBoosterReady() { return refreshVehicleDualBoosterReady(this); }
    classifyDualBoosterReady(mode, state, elapsed) { return classifyVehicleDualBoosterReady(this, mode, state, elapsed); }
    clearDualBoosterReady(state) { return clearVehicleDualBoosterReady(this, state); }
    updateObstacleSuppressionTimer(elapsedMs) { return advanceObstacleSuppression(this, elapsedMs); }
    visualScaleMode() { return vehicleVisualScaleMode(this); }
    setVisualScaleMode(mode) { return setVehicleVisualScaleMode(this, mode); }
    updateVisualScale(nowMs) { return updateVehicleVisualScale(this, nowMs); }
    updateModeScale(nowMs) { return updateVehicleScaleMode(this, nowMs); }
    updateEventScale(nowMs) { return updateVehicleEventScale(this, nowMs); }
    updateEventGravity(nowMs) { return updateVehicleEventGravity(this, nowMs); }
    resolvePrimaryCollision(track, input) { return resolveVehicleTrackCollision(this, track, input); }
    countOrdinaryResultCrash() { return countVehicleResultCrash(this); }
  giantObstacleLowHit = !1;
    resolveStaticObstacles(track) { return resolveVehicleObstacleCollisions(this, track); }
    resolveTrackEvents(track) { return resolveVehicleTrackEvents(this, track); }
    secondaryCollisionBox() { return makeSecondaryCollisionBox(this); }
    updateCollisionGaugeOwners(contactHit) { return updateVehicleCollisionGaugeOwners(this, contactHit); }
    updatePrimaryAutomaticResetTimers(collision, seconds) { return updatePrimaryCollisionResetTimers(this, collision, seconds); }
    updateObstacleAutomaticResetTimer(collided, seconds) { return updateObstacleCollisionResetTimer(this, collided, seconds); }
    advanceAutomaticResetTimer(elapsed, interrupted, seconds, threshold) { return advanceCollisionResetTimer(this, elapsed, interrupted, seconds, threshold); }
    activateDirectionalPress(mode) { return activateDirectionalCollisionPress(this, mode); }
    activateHardPress() { return activateHardCollisionPress(this); }
    applyHighObstacleAngularResponse(normal) { return applyHighContactAngularResponse(this, normal); }
    applyWallObstacleAngularResponse(normal) { return applyWallContactAngularResponse(this, normal); }
    applyCollisionDriftGaugePreserve(chargerCollision) { return preserveDriftChargeAfterCollision(this, chargerCollision); }
    updatePublicGauge() { return publishVehicleGauge(this); }
    mainGaugeRatio() { return mainVehicleGaugeRatio(this); }
    updateInstantAccelerationGauge(seconds) { return updateInstantAccelerationCharge(this, seconds); }
    updateInstantWallCharge(nowMs) { return settleInstantWallCharge(this, nowMs); }
    beginInstantWallCharge(nowMs) { return beginInstantWallChargeWindow(this, nowMs); }
    updateResetGaugeRefill(seconds, nowMs) { return advanceResetGaugeRefill(this, seconds, nowMs); }
    beginWallCollision() { return beginWallGaugeWindow(this); }
    settleWallCollision(nowMs) { return settleWallGaugeWindow(this, nowMs); }
    setWallGaugeRefill(fraction) { return setWallGaugeRefund(this, fraction); }
    clearResetGaugeRefill() { return clearWallGaugeRefund(this); }
    updateCachedDisplaySpeed() { return cacheDisplaySpeed(this); }
    syncPresentationFields() { return syncVehiclePresentation(this); }
  createBody() { return VehicleInitialization.createVehicleBody(); }
  createWheelRuntime() { return VehicleInitialization.createVehicleWheelRuntime(); }
  createRuntime() { return VehicleInitialization.createVehicleRuntime(this); }
  createState() { return VehicleInitialization.createVehicleState(); }
}





function ni0() {
  return {
    force: F2(),
    torque: F2(),
    v0: F2(),
    v1: F2(),
    v2: F2(),
    v3: F2(),
    v4: F2(),
    v5: F2(),
    v6: F2(),
    v7: F2(),
    v8: F2(),
    v9: F2(),
    v10: F2(),
    v11: F2(),
    oldCompression: [0, 0, 0, 0],
    zeroNormals: [F2(), F2(), F2(), F2()],
    obb: { center: F2(), axes: [F2(), F2(), F2()], halfExtents: [0, 0, 0] },
    primaryResult: { responseHit: !1, lowHit: !1 },
  };
}

















































































function Mt(n) {
  return n ? VG(n) : void 0;
}

















const w0 = Math.fround;

function vv(n) {
  const e = w0(0.3333300054073334);
  return {
    x: w0(w0(w0(w0(n.a.x) + w0(n.b.x)) + w0(n.c.x)) * e),
    y: w0(w0(w0(w0(n.a.y) + w0(n.b.y)) + w0(n.c.y)) * e),
    z: w0(-w0(w0(w0(w0(-n.a.z) + w0(-n.b.z)) + w0(-n.c.z)) * e)),
  };
}

function Oo(n, e) {
  const [t, i, r] = e.axes,
    s = e.center,
    o = w0(w0(n.a.x) - w0(s.x)),
    a = w0(w0(-n.a.z) - w0(-s.z)),
    c = w0(w0(n.a.y) - w0(s.y)),
    l = w0(w0(n.b.x) - w0(s.x)),
    u = w0(w0(-n.b.z) - w0(-s.z)),
    h = w0(w0(n.b.y) - w0(s.y)),
    d = w0(w0(n.c.x) - w0(s.x)),
    f = w0(w0(-n.c.z) - w0(-s.z)),
    p = w0(w0(n.c.y) - w0(s.y));
  return hi0(
    S5(o, a, c, t, !1),
    S5(o, a, c, i, !0),
    S5(o, a, c, r, !1),
    S5(l, u, h, t, !1),
    S5(l, u, h, i, !0),
    S5(l, u, h, r, !1),
    S5(d, f, p, t, !1),
    S5(d, f, p, i, !0),
    S5(d, f, p, r, !1),
    w0(e.halfExtents[0]),
    w0(e.halfExtents[1]),
    w0(e.halfExtents[2]),
  );
}

function S5(n, e, t, i, r) {
  const s = w0(r ? -i.x : i.x),
    o = w0(r ? i.z : -i.z),
    a = w0(r ? -i.y : i.y);
  return w0(w0(w0(s * n) + w0(o * e)) + w0(a * t));
}

function hi0(n, e, t, i, r, s, o, a, c, l, u, h) {
  const d = w0(i - n),
    f = w0(r - e),
    p = w0(s - t),
    v = w0(o - i),
    w = w0(a - r),
    g = w0(c - s),
    y = w0(n - o),
    b = w0(e - a),
    A = w0(t - c);
  if (
    vd(f, p, e, t, a, c, u, h) ||
    yd(d, p, n, t, o, c, l, h) ||
    Ad(d, f, i, r, o, a, l, u) ||
    vd(w, g, e, t, a, c, u, h) ||
    yd(v, g, n, t, o, c, l, h) ||
    Ad(v, w, n, e, i, r, l, u) ||
    vd(b, A, e, t, r, s, u, h) ||
    yd(y, A, n, t, i, s, l, h) ||
    Ad(y, b, i, r, o, a, l, u) ||
    Math.min(n, i, o) > l ||
    -l > Math.max(n, i, o) ||
    Math.min(e, r, a) > u ||
    -u > Math.max(e, r, a) ||
    Math.min(t, s, c) > h ||
    -h > Math.max(t, s, c)
  )
    return !1;
  const x = w0(w0(f * g) - w0(p * w)),
    M = w0(w0(p * v) - w0(d * g)),
    E = w0(w0(d * w) - w0(f * v)),
    _ = -bd(x, M, E, n, e, t),
    C = x > 0 ? -l : l,
    S = M > 0 ? -u : u,
    G = E > 0 ? -h : h;
  return w0(bd(x, M, E, C, S, G) + _) > 0
    ? !1
    : w0(bd(x, M, E, -C, -S, -G) + _) >= 0;
}

function vd(n, e, t, i, r, s, o, a) {
  return yv(
    w0(w0(e * t) - w0(n * i)),
    w0(w0(e * r) - w0(n * s)),
    w0(w0(Math.abs(e) * o) + w0(Math.abs(n) * a)),
  );
}

function yd(n, e, t, i, r, s, o, a) {
  return yv(
    w0(w0(-e * t) + w0(n * i)),
    w0(w0(-e * r) + w0(n * s)),
    w0(w0(Math.abs(e) * o) + w0(Math.abs(n) * a)),
  );
}

function Ad(n, e, t, i, r, s, o, a) {
  return yv(
    w0(w0(e * t) - w0(n * i)),
    w0(w0(e * r) - w0(n * s)),
    w0(w0(Math.abs(e) * o) + w0(Math.abs(n) * a)),
  );
}

function yv(n, e, t) {
  const i = e > n ? n : e,
    r = e > n ? e : n;
  return i > t || -t > r;
}

function bd(n, e, t, i, r, s) {
  return w0(w0(w0(n * i) + w0(e * r)) + w0(t * s));
}

const f1 = Math.fround;

function di0(n, e) {
  const [t, i, r] = n.axes,
    s = f1(n.halfExtents[0]),
    o = f1(n.halfExtents[1]),
    a = f1(n.halfExtents[2]),
    c = f1(n.center.x),
    l = f1(-n.center.z),
    u = f1(n.center.y),
    h = f1(t.x),
    d = f1(-i.x),
    f = f1(r.x),
    p = f1(-t.z),
    v = f1(i.z),
    w = f1(-r.z),
    g = f1(t.y),
    y = f1(-i.y),
    b = f1(r.y);
  for (let A = 0; A < 8; A += 1) {
    const x = A & 4 ? s : -s,
      M = A & 2 ? o : -o,
      E = A & 1 ? a : -a,
      _ = Md(h, d, f, x, M, E, c),
      C = Md(p, v, w, x, M, E, l),
      S = Md(g, y, b, x, M, E, u);
    A === 0
      ? ((e[0] = e[3] = _), (e[1] = e[4] = C), (e[2] = e[5] = S))
      : (e[0] > _ && (e[0] = _),
        e[1] > C && (e[1] = C),
        e[2] > S && (e[2] = S),
        _ > e[3] && (e[3] = _),
        C > e[4] && (e[4] = C),
        S > e[5] && (e[5] = S));
  }
}

function Md(n, e, t, i, r, s, o) {
  return f1(f1(f1(f1(n * i) + f1(e * r)) + f1(t * s)) + o);
}

const Bg = t0(1e-4),
  fi0 = 1e-4,
  xd = t0(0.10000000149011612),
  rc = t0(0.20000000298023224);

function pi0(n, e, t, i) {
  if (!Number.isSafeInteger(t) || t < 0 || !Number.isSafeInteger(i) || i < 0)
    throw new Error("tracked triangle timestamp 必须是非负整数毫秒。");
  const r = t >>> 0,
    s = i >>> 0,
    a = (r - (s === 0 ? r : s)) >>> 0,
    c = t0(a);
  for (const l of n) {
    const u = e(l),
      h = [I1(u[0]), I1(u[1]), I1(u[2])];
    if (a !== 0) {
      const d = Rg(h),
        f = Rg(l.previousVertices),
        p = N1(d, f),
        v = Tt(p, t0(1e3));
      l.surfaceVelocity = { x: t0(v.x / c), y: t0(v.y / c), z: t0(v.z / c) };
    }
    l.previousVertices = h;
  }
  return r;
}

export { AL, Bg, Oo, di0, fi0, pi0, rc, vv, xd };
