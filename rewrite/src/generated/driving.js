// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import * as VehicleItemMode from "../driving/item-mode.ts";
import { createVehicleCollisionScratch, optionalRoadSurface, triangleCentroid as vv, triangleIntersectsOrientedBox as Oo, orientedBoxBounds as di0, updateTrackedTriangleVelocity } from "../driving/collision-geometry.ts";
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

const trackedTriangleMath = { cloneVector: I1, centroid: Rg, subtract: N1, scale: Tt, f32: t0 };
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
  itemMode = !1;
  itemEffects;
  get itemSlotCapacity() { return VehicleItemMode.vehicleItemSlotCapacity(this); }
  setItemSlots(slots) { return VehicleItemMode.setVehicleItemSlots(this, slots); }
  itemSlots() { return VehicleItemMode.vehicleItemSlots(this); }
  startItemBooster() { return VehicleItemMode.startVehicleItemBooster(this); }
  cancelItemBooster() { return VehicleItemMode.cancelVehicleItemBooster(this); }
}





function ni0() { return createVehicleCollisionScratch(F2); }

















































































function Mt(road) { return optionalRoadSurface(road, VG); }

















const Bg = t0(1e-4),
  fi0 = 1e-4,
  xd = t0(0.10000000149011612),
  rc = t0(0.20000000298023224);

function pi0(triangles, verticesOf, timeMs, previousMs) { return updateTrackedTriangleVelocity(triangles, verticesOf, timeMs, previousMs, trackedTriangleMath); }

export { AL, Bg, Oo, di0, fi0, pi0, rc, vv, xd };
