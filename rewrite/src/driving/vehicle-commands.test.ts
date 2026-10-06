import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addVehicleFlyingPetListener,
  applyVehicleKartPairResponse,
  cancelVehicleControls,
  cancelVehicleNitroSeamless,
  canHandleVehicleRouteSurfaceTag,
  clearVehicleGiantRaceEffects,
  compensateVehicleGiantBooster,
  copyVehicleNetworkWrench,
  consumeVehicleAutomaticResetRequest,
  consumeVehicleCollisionAudioStrength,
  consumeVehicleCrashEffectRequest,
  consumeVehicleKartAnimationInput,
  consumeVehicleRailResetRequest,
  consumeVehicleShockWaveRequest,
  consumeVehicleSteeringCollisionAudioGain,
  consumeVehicleTrackEventEffectRequests,
  handleVehicleDrivingCommand,
  hardCancelVehicleControls,
  handleVehicleRouteSurfaceTag,
  isVehicleDriveSteeringSuppressed,
  isVehicleLowSpeedAutomaticResetActive,
  isVehicleWarpPresentationActive,
  prepareVehicleRailCheckpointReentry,
  stopVehicleDrift,
  queueVehicleNitroSeamless,
  restoreVehicleResetInteraction,
  setVehicleAnimationSlot,
  setVehicleDriveSteeringSuppressed,
  setVehicleDualBoostAuto,
  setVehicleFullPhysicsBypass,
  setVehicleMultiplayerDrivingScales,
  setVehicleRaceMotionLocked,
  setVehicleRuntimeScales,
  setVehicleWarpPresentationActive,
  setVehicleWarpPressProtected,
  startVehiclePlayBooster,
  startVehicleRaceBooster,
  synchronizeVehicleClock,
  triggerVehicleEventGravity,
  triggerVehicleEventScale,
  tryConsumeVehicleNormalBooster,
  updateVehicleModeInventory,
  updateVehicleLockedClock,
  vehicleAudioState,
  vehicleDisplaySpeedKmh,
  vehicleContactRailId,
  vehicleDualBoosterMode,
  vehicleDualBoosterReadyRemainingMs,
  vehicleDualBoosterState,
  vehicleDualBoosterTeam,
  vehicleGiantSourceProtected,
  vehicleLteDodgeAvailable,
  vehicleNetworkCollisionScheduled,
  vehicleNetworkCollisionState,
  vehicleNetworkMotionMode,
  type DrivingCommand,
  type DrivingCommandContext,
  type MultiplayerDrivingScales,
  type Vector3,
  type VehicleAudioDisplayContext,
  type VehicleCancelControlsContext,
  type VehicleClockContext,
  type VehicleControlSettings,
  type VehicleDualBoostOptions,
  type VehicleEventPhysicsContext,
  type VehicleFlyingPetContext,
  type VehicleGiantContext,
  type VehicleLowSpeedResetContext,
  type VehicleModeInventoryContext,
  type VehicleNetworkPhysicsContext,
  type VehicleOneShotEvents,
  type VehicleRailContactContext,
  type VehicleRouteSurfaceContext,
  type VehicleSurfaceResolvers,
  type VehicleDriftStopContext,
  type RailCheckpointContext,
} from "./vehicle-commands";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const methodPairs = [
  ["synchronizeClock", "updateLockedIngameClock"],
  ["updateLockedIngameClock", "setDualBoostAuto"],
  ["setDualBoostAuto", "driveCameraRuntime"],
  ["handleDrivingCommand", "tryConsumeNormalBooster"],
  ["tryConsumeNormalBooster", "queueNitroSeamless"],
  ["queueNitroSeamless", "cancelNitroSeamless"],
  ["cancelNitroSeamless", "canHandleRouteSurfaceTag"],
  ["canHandleRouteSurfaceTag", "handleRouteSurfaceTag"],
  ["handleRouteSurfaceTag", "prepareRailCheckpointReentry"],
  ["prepareRailCheckpointReentry", "contactRailId"],
  ["contactRailId", "consumeRailResetRequest"],
  ["consumeRailResetRequest", "consumeCollisionAudioStrength"],
  ["consumeCollisionAudioStrength", "consumeCrashEffectRequest"],
  ["consumeCrashEffectRequest", "consumeShockWaveRequest"],
  ["consumeShockWaveRequest", "consumeTrackEventEffectRequests"],
  ["consumeTrackEventEffectRequests", "consumeSteeringCollisionAudioGain"],
  ["consumeSteeringCollisionAudioGain", "consumeAutomaticResetRequest"],
  ["consumeAutomaticResetRequest", "audioState"],
  ["audioState", "dualBoosterMode"],
  ["dualBoosterMode", "dualBoosterState"],
  ["dualBoosterState", "dualBoosterReadyRemainingMs"],
  ["dualBoosterReadyRemainingMs", "dualBoosterTeam"],
  ["dualBoosterTeam", "displaySpeedKmh"],
  ["displaySpeedKmh", "copyNetworkWrench"],
  ["copyNetworkWrench", "networkCollisionState"],
  ["networkCollisionState", "applyKartPairResponse"],
  ["applyKartPairResponse", "timeAttackTachometerSpeed"],
  ["startRaceBooster", "setRaceMotionLocked"],
  ["setRaceMotionLocked", "startPlayBooster"],
  ["startPlayBooster", "lowSpeedAutomaticResetActive"],
  ["lowSpeedAutomaticResetActive", "beginResetInitiation"],
  ["restoreResetInteraction", "updateModeInventory"],
  ["updateModeInventory", "cancelControls"],
  ["cancelControls", "stopDrift"],
  ["stopDrift", "hardCancelControls"],
  ["hardCancelControls", "setDriveSteeringSuppressed"],
  ["setDriveSteeringSuppressed", "isDriveSteeringSuppressed"],
  ["isDriveSteeringSuppressed", "setFullPhysicsBypass"],
  ["setFullPhysicsBypass", "setWarpPresentationActive"],
  ["setWarpPresentationActive", "isWarpPresentationActive"],
  ["isWarpPresentationActive", "setWarpPressProtected"],
  ["setWarpPressProtected", "setRuntimeScales"],
  ["setRuntimeScales", "setMultiplayerDrivingScales"],
  ["setMultiplayerDrivingScales", "triggerEventScale"],
  ["triggerEventScale", "triggerEventGravity"],
  ["triggerEventGravity", "setAnimationSlot"],
  ["setAnimationSlot", "consumeKartAnimationInput"],
  ["consumeKartAnimationInput", "addFlyingPetListener"],
  ["addFlyingPetListener", "getDebugState"],
  ["giantSourceProtected", "compensateGiantBooster"],
  ["compensateGiantBooster", "clearGiantRaceEffects"],
  ["clearGiantRaceEffects", "stepSubstep"],
] as const;

function sourceMethod(name: string, next: string): string {
  const start = release.indexOf(`  ${name}(`, classStart);
  const end = release.indexOf(`  ${next}(`, start);
  assert.ok(classStart >= 0 && start > classStart && end > start, `missing release method ${name}`);
  return release.slice(start, end);
}

function sourceUntil(name: string, next: string): string {
  const start = release.indexOf(`  ${name}(`, classStart);
  const end = release.indexOf(`  get ${next}()`, start);
  assert.ok(start > classStart && end > start, `missing release method ${name}`);
  return release.slice(start, end);
}
function sourceGetter(name: string, next: string): string {
  const start = release.indexOf(`  get ${name}()`, classStart);
  const end = release.indexOf(`  ${next}(`, start);
  assert.ok(start > classStart && end > start, `missing release getter ${name}`);
  return release.slice(start, end);
}

const methodSource = methodPairs.map(([name, next]) => sourceMethod(name, next)).join("\n")
  + "\n" + sourceUntil("lteDodgeAvailable", "networkCollisionScheduled")
  + "\n" + sourceGetter("networkCollisionScheduled", "giantSourceProtected");
let activeDependencyCalls: string[] = [];
function routeKind(descriptor: unknown): string {
  const tag = (descriptor as { tag: string }).tag;
  if (tag.includes("unclosed")) return "unclosed";
  if (tag.includes("rail-rain")) return "rail-rain";
  if (tag.includes("rail")) return "rail";
  return "road";
}
const originalGlobals = {
  Vo: (tag: string) => { activeDependencyCalls.push(`Vo:${tag}`); return { tag }; },
  Eg: (descriptor: unknown) => {
    const kind = routeKind(descriptor);
    activeDependencyCalls.push(`Eg:${kind}`);
    return kind;
  },
  Ri: (descriptor: unknown) => {
    const id = (descriptor as { id: string }).id;
    activeDependencyCalls.push(`Ri:${id}`);
    return id;
  },
  Mt: (descriptor: unknown) => {
    if (!descriptor) return undefined;
    const kind = (descriptor as { surface: string }).surface;
    activeDependencyCalls.push(`Mt:${kind}`);
    return kind;
  },
};
const Original = new Function("m", "Eg", "Vo", "Ri", "Mt", "Cs", "ec",
  `return class Original { ${methodSource} };`)(
    Math.fround, originalGlobals.Eg, originalGlobals.Vo, originalGlobals.Ri, originalGlobals.Mt,
    6, (slot: number) => slot === 6 || slot === 14,
  ) as {
  new (): Record<string, Function>;
};
const original = new Original();

type Scenario = DrivingCommandContext & VehicleClockContext & VehicleControlSettings &
  VehicleDualBoostOptions & VehicleOneShotEvents & VehicleAudioDisplayContext &
  VehicleNetworkPhysicsContext & VehicleEventPhysicsContext & VehicleLowSpeedResetContext &
  VehicleCancelControlsContext & RailCheckpointContext & VehicleRouteSurfaceContext &
  VehicleRailContactContext & VehicleDriftStopContext & VehicleModeInventoryContext &
  VehicleFlyingPetContext & VehicleGiantContext & {
    calls: string[];
    clock: VehicleClockContext["clock"] & { getRhythmState(): { tick: number } };
    nitroSeamlessRequest: boolean;
    boosterSucceeds: boolean;
    surfaces: VehicleSurfaceResolvers;
  };

function scenario(released: boolean): Scenario {
  const calls: string[] = [];
  const surfaces: VehicleSurfaceResolvers = {
    parseRouteTag(tag) { calls.push(`Vo:${tag}`); return { tag }; },
    surfaceKind(descriptor) {
      const kind = routeKind(descriptor);
      calls.push(`Eg:${kind}`);
      return kind;
    },
    railId(descriptor) {
      const id = (descriptor as { id: string }).id;
      calls.push(`Ri:${id}`);
      return id;
    },
    roadSurface(descriptor) {
      const kind = (descriptor as { surface: string }).surface;
      calls.push(`Mt:${kind}`);
      return kind;
    },
  };
  const flyingPetListeners = new Set<(reset: boolean) => void>();
  flyingPetListeners.add(reset => calls.push(`pet:${reset}`));
  return {
    calls,
    surfaces,
    checkClientFramerate: false,
    clock: {
      synchronize(nowMs, flag) { calls.push(`synchronize:${nowMs}:${String(flag)}`); },
      advance(nowMs) { calls.push(`advance:${nowMs}`); },
      getRhythmState() { calls.push("rhythm"); return { tick: 42 }; },
    },
    dualBoostAuto: false,
    dualBoostAutoArm: false,
    nitroSeamlessRequest: false,
    boosterSucceeds: true,
    flyingPetListeners,
    giant: { reset() { calls.push("giant.reset"); } },
    lteMotion: {},
    trackEventEffectRequests: ["spark", "smoke"],
    runtime: {
      driftDecay: 0,
      activeDrift: false,
      triggerPhase: false,
      driftTailLatch: false,
      localForwardSpeed: 8,
      contactWorking: true,
      delayedDriftRequest: false,
      instantGauge: 5,
      instantAccelerationActive: false,
      forwardOneShot: false,
      driftLifecycleB50: 1,
      driftLifecycleB44: 0,
      physicsState: 0,
      stateRemainingMs: 250,
      railResetRequest: true,
      collisionAudioStrength: 0.7,
      strongLateralCollision: true,
      shockWaveRequest: true,
      steeringCollisionAudioGain: 0.3,
      automaticResetRequest: true,
      motionMode: 2,
      railFrame: { position: { x: 1, y: 2, z: 3 } },
      dualBoosterMode: 1,
      dualBoosterState: 6,
      dualReadyRemainingMs: 123.8,
      dualBoosterTeam: true,
      cachedDisplaySpeedKmh: 80,
      collisionMotionHit: false,
      collisionMotionStrength: 0.4,
      oneSubstepDrift: true,
      eventScaleTarget: { x: 1, y: 1, z: 1 },
      eventScaleAnchorMs: 100,
      eventScaleMode: 0,
      gravityDivisor: 1,
      committedGauge: 100,
      speedSlots: [-1, 14, -1],
      speedSlotDisabled: [false, false, true],
      eventScalePrimary: { x: 2, y: 2, z: 2 },
      eventScaleSecondary: { x: 3, y: 3, z: 3 },
      visualScaleA: { x: 1.5, y: 1.5, z: 1.5 },
      visualScaleRestorePending: true,
      visualScaleTransitionAnchorMs: 100,
      obstacleSuppressionRemainingMs: 500,
      obstacleSuppressionLatch: true,
      pressState: 1,
      roadTransient: 0,
      bodySpeed: 80,
      raceMotionLocked: false,
      driveSteeringSuppressed: false,
      fullPhysicsBypass: false,
      automaticResetInteractionActive: false,
      interactionActive: false,
      pressProtected1C0: false,
      driveScale: 1,
      steeringExponentialScale: 1,
      dragScale: 1,
      chargerDurationScale: 1,
      catchupDragScale: 1,
      catchupSteeringScale: 1,
      draftAccelerationScale: 1,
      animationSlot: 0,
      animationInput: { physicsState: 3 },
    },
    tuning: {
      instAccelGaugeLength: 10,
      instAccelGaugeMinUsable: 4,
      driftBoostTick: 321,
      startBoosterTimeSpeed: 2500,
      driftMaxGauge: 100,
    },
    state: { driftDirection: 0, boostTime: 4, drifting: true, nitro: 1 },
    body: {
      linearVelocity: { x: 0.7, y: 0.1, z: 0.2 },
      angularVelocity: { x: 1.2, y: -0.2, z: 0.6 },
    },
    scratch: { force: { x: 2, y: 3, z: 4 }, torque: { x: 5, y: 6, z: 7 } },
    wheels: { roadDescriptor: { surface: "dirt" }, railContactDescriptor: { id: "rail-7" } },
    collisionShape: { scaleX: 0.8, scaleY: 0.9 },
    stopDrift() {
      calls.push("stopDrift");
      if (released) releaseCall("stopDrift", this);
      else stopVehicleDrift(this, surfaces);
    },
    cancelControls() {
      calls.push("cancelControls");
      if (released) releaseCall("cancelControls", this);
      else cancelVehicleControls(this);
    },
    startNormalBooster(input) { calls.push(`startNormalBooster:${input.forward}`); return this.boosterSucceeds; },
    armDualBooster() { calls.push("armDualBooster"); },
    reorderSpeedSlots() { calls.push("reorderSpeedSlots"); return true; },
    canHandleRouteSurfaceTag(tag) {
      calls.push("canHandleRouteSurfaceTag");
      if (released) return releaseCall("canHandleRouteSurfaceTag", this, tag) as boolean;
      return canHandleVehicleRouteSurfaceTag(tag, surfaces);
    },
    requestMotionMode(enabled, mode) { calls.push(`requestMotionMode:${enabled}/${mode}`); },
    enterRailMode() { calls.push("enterRailMode"); },
    clearResetGaugeRefill() { calls.push("clearResetGaugeRefill"); },
    updatePublicGauge() { calls.push("updatePublicGauge"); },
    syncPresentationFields() { calls.push("syncPresentationFields"); },
  };
}

function releaseCall(name: string, state: Scenario, ...args: unknown[]): unknown {
  const method = original[name];
  assert.ok(method, `missing release method ${name}`);
  activeDependencyCalls = state.calls;
  return method.apply(state, args);
}

function releaseGetter(name: string, state: Scenario): unknown {
  const getter = Object.getOwnPropertyDescriptor(Original.prototype, name)?.get;
  assert.ok(getter, `missing release getter ${name}`);
  activeDependencyCalls = state.calls;
  return getter.call(state);
}

function snapshot(state: Scenario): unknown {
  return {
    calls: state.calls,
    checkClientFramerate: state.checkClientFramerate,
    dualBoostAuto: state.dualBoostAuto,
    dualBoostAutoArm: state.dualBoostAutoArm,
    nitroSeamlessRequest: state.nitroSeamlessRequest,
    trackEventEffectRequests: state.trackEventEffectRequests,
    runtime: state.runtime,
    tuning: state.tuning,
    state: state.state,
    body: state.body,
    scratch: state.scratch,
    wheels: state.wheels,
    collisionShape: state.collisionShape,
    flyingPetListenerCount: state.flyingPetListeners.size,
    hasGiant: !!state.giant,
  };
}

function compare(
  label: string,
  name: string,
  migrated: (state: Scenario) => unknown,
  args: unknown[] = [],
  edit: (state: Scenario) => void = () => {},
): void {
  const expected = scenario(true), actual = scenario(false);
  edit(expected); edit(actual);
  let expectedError: unknown, actualError: unknown;
  let expectedReturn: unknown, actualReturn: unknown;
  try { expectedReturn = releaseCall(name, expected, ...args); } catch (error) { expectedError = error; }
  try { actualReturn = migrated(actual); } catch (error) { actualError = error; }
  assert.deepEqual(actualError, expectedError, `${label}: error`);
  assert.deepEqual(actualReturn, expectedReturn, `${label}: result`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state and calls`);
}

test("clock synchronization and kart specific dual booster policy match release", () => {
  compare("synchronize check off", "synchronizeClock", state => synchronizeVehicleClock(state, 120), [120]);
  compare("synchronize check on", "synchronizeClock", state => synchronizeVehicleClock(state, 120), [120],
    state => { state.checkClientFramerate = true; });
  compare("locked synchronize", "updateLockedIngameClock", state => updateVehicleLockedClock(state, 500), [500]);
  compare("locked advance", "updateLockedIngameClock", state => updateVehicleLockedClock(state, 500), [500],
    state => { state.checkClientFramerate = true; });
  for (const kartId of [1096, 1106, 1097, 1]) for (const enabled of [false, true])
    compare(`dual policy ${kartId}/${enabled}`, "setDualBoostAuto",
      state => setVehicleDualBoostAuto(state, enabled, kartId), [enabled, kartId]);
});

test("discrete driving commands match release branches and call order", () => {
  const input = { forward: 1 };
  function check(label: string, command: DrivingCommand, edit: (state: Scenario) => void = () => {}) {
    compare(label, "handleDrivingCommand", state => handleVehicleDrivingCommand(state, command, input),
      [command, input], edit);
  }
  check("drift start", { kind: "drift-start", direction: -1 });
  check("drift delayed", { kind: "drift-start", direction: 1 }, state => { state.runtime.contactWorking = false; });
  check("drift decay", { kind: "drift-start", direction: 1 }, state => { state.runtime.driftDecay = 1; });
  check("drift grip", { kind: "drift-start", direction: 1 }, state => { state.speedRaceMode = { kind: "grip" }; });
  check("drift stop", { kind: "drift-stop", active: true }, state => { state.runtime.activeDrift = true; });
  check("drift stop grip", { kind: "drift-stop" }, state => { state.speedRaceMode = { kind: "grip" }; });
  check("use booster", { kind: "use-item-or-booster" });
  check("reorder", { kind: "reorder-items" });
  check("instant gauge", { kind: "instant-acceleration" });
  check("instant too low", { kind: "instant-acceleration" }, state => { state.runtime.instantGauge = 2; });
  check("forward down", { kind: "forward-down" });
  check("forward down fallback", { kind: "forward-down" }, state => { state.tuning.driftBoostTick = 0; });
  check("forward down grip", { kind: "forward-down" }, state => { state.speedRaceMode = { kind: "grip" }; });
  check("forward up", { kind: "forward-up" }, state => { state.runtime.physicsState = 3; });
  check("forward up protected", { kind: "forward-up" }, state => { state.runtime.physicsState = 14; });
  for (const kind of ["reverse-down", "reverse-up", "reset", "unsupported-action"] as const)
    check(`no-op ${kind}`, { kind });
});

test("booster request and seamless nitro latches match release", () => {
  compare("consume succeeds", "tryConsumeNormalBooster",
    state => tryConsumeVehicleNormalBooster(state, { forward: 1 }), [{ forward: 1 }]);
  compare("consume fails", "tryConsumeNormalBooster",
    state => tryConsumeVehicleNormalBooster(state, { forward: 1 }), [{ forward: 1 }],
    state => { state.boosterSucceeds = false; });
  compare("queue", "queueNitroSeamless", queueVehicleNitroSeamless);
  compare("cancel", "cancelNitroSeamless", cancelVehicleNitroSeamless,
    [], state => { state.nitroSeamlessRequest = true; });
});

test("route tag handling delegates parsing and rail transitions exactly as release", () => {
  for (const tag of ["road", "unclosed", "rail", "rail-rain", "rail out:next", "rail in:next", "rail in:next out:next"])
    compare(`can handle ${tag}`, "canHandleRouteSurfaceTag",
      state => canHandleVehicleRouteSurfaceTag(tag, state.surfaces), [tag]);
  for (const tag of ["road", "unclosed", "rail", "rail-rain", "rail out:next", "rail in:next", "rail in:next out:next"])
    compare(`handle ${tag}`, "handleRouteSurfaceTag",
      state => handleVehicleRouteSurfaceTag(state, tag, state.surfaces), [tag]);
  compare("rail contact", "contactRailId", state => vehicleContactRailId(state, state.surfaces));
  compare("no rail contact", "contactRailId", state => vehicleContactRailId(state, state.surfaces), [],
    state => { state.wheels.railContactDescriptor = undefined; });
});

test("rail checkpoint preparation and audio/display accessors match release", () => {
  compare("rail mode", "prepareRailCheckpointReentry", prepareVehicleRailCheckpointReentry);
  compare("non rail mode", "prepareRailCheckpointReentry", prepareVehicleRailCheckpointReentry, [],
    state => { state.runtime.motionMode = 5; });
  const accessors = [
    ["audioState", vehicleAudioState],
    ["dualBoosterMode", vehicleDualBoosterMode],
    ["dualBoosterState", vehicleDualBoosterState],
    ["dualBoosterReadyRemainingMs", vehicleDualBoosterReadyRemainingMs],
    ["dualBoosterTeam", vehicleDualBoosterTeam],
    ["displaySpeedKmh", vehicleDisplaySpeedKmh],
  ] as const;
  for (const [name, migrated] of accessors) compare(name, name, migrated);
  for (const physicsState of [0, 4, 10])
    compare(`dual team physics ${physicsState}`, "dualBoosterTeam", vehicleDualBoosterTeam, [],
      state => { state.runtime.physicsState = physicsState; });
  compare("ready negative", "dualBoosterReadyRemainingMs", vehicleDualBoosterReadyRemainingMs, [],
    state => { state.runtime.dualReadyRemainingMs = -10.5; });
});

test("network getters and LTE availability match release", () => {
  for (const [name, migrated] of [
    ["networkMotionMode", vehicleNetworkMotionMode],
    ["networkCollisionScheduled", vehicleNetworkCollisionScheduled],
  ] as const) {
    const expected = scenario(true), actual = scenario(false);
    assert.deepEqual(migrated(actual), releaseGetter(name, expected), `${name}: result`);
    assert.deepEqual(snapshot(actual), snapshot(expected), `${name}: state`);
  }
  compare("LTE available", "lteDodgeAvailable", vehicleLteDodgeAvailable,
    [], state => { state.runtime.motionMode = 0; });
  compare("LTE missing", "lteDodgeAvailable", vehicleLteDodgeAvailable,
    [], state => { state.runtime.motionMode = 0; state.lteMotion = undefined; });
  compare("LTE locked", "lteDodgeAvailable", vehicleLteDodgeAvailable,
    [], state => { state.runtime.motionMode = 0; state.runtime.raceMotionLocked = true; });
  compare("LTE protected", "lteDodgeAvailable", vehicleLteDodgeAvailable,
    [], state => { state.runtime.motionMode = 0; state.runtime.pressProtected1C0 = true; });
  compare("LTE bypass", "lteDodgeAvailable", vehicleLteDodgeAvailable,
    [], state => { state.runtime.motionMode = 0; state.runtime.fullPhysicsBypass = true; });
  compare("LTE rail", "lteDodgeAvailable", vehicleLteDodgeAvailable);
});

test("network wrench, collision summary and pair response match release", () => {
  const output = () => ({ force: { x: 0, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 } });
  const expected = scenario(true), actual = scenario(false);
  const expectedOutput = output(), actualOutput = output();
  releaseCall("copyNetworkWrench", expected, expectedOutput);
  copyVehicleNetworkWrench(actual, actualOutput);
  assert.deepEqual(actualOutput, expectedOutput);
  assert.deepEqual(snapshot(actual), snapshot(expected));
  compare("collision state", "networkCollisionState", vehicleNetworkCollisionState);
  const linear: Vector3 = { x: 0.8, y: -0.4, z: 1.1 };
  const angular: Vector3 = { x: -0.2, y: 0.7, z: 0.4 };
  compare("pair response", "applyKartPairResponse",
    state => applyVehicleKartPairResponse(state, linear, angular, 0.8), [linear, angular, 0.8]);
  compare("pair weaker than existing", "applyKartPairResponse",
    state => applyVehicleKartPairResponse(state, linear, angular, 0.2), [linear, angular, 0.2]);
});

test("one shot event consumers return and clear the same values as release", () => {
  const consumers = [
    ["consumeRailResetRequest", consumeVehicleRailResetRequest],
    ["consumeCollisionAudioStrength", consumeVehicleCollisionAudioStrength],
    ["consumeCrashEffectRequest", consumeVehicleCrashEffectRequest],
    ["consumeShockWaveRequest", consumeVehicleShockWaveRequest],
    ["consumeTrackEventEffectRequests", consumeVehicleTrackEventEffectRequests],
    ["consumeSteeringCollisionAudioGain", consumeVehicleSteeringCollisionAudioGain],
    ["consumeAutomaticResetRequest", consumeVehicleAutomaticResetRequest],
  ] as const;
  for (const [name, migrated] of consumers) {
    compare(`${name} pending`, name, migrated);
    compare(`${name} cleared`, name, state => { migrated(state); return migrated(state); }, [],
      state => { releaseCall(name, state); });
  }
});

test("race start, lock, play boost and reset interaction match release", () => {
  compare("race boost", "startRaceBooster", startVehicleRaceBooster);
  compare("race boost clamp", "startRaceBooster", startVehicleRaceBooster, [],
    state => { state.tuning.startBoosterTimeSpeed = -10; });
  compare("race boost already active", "startRaceBooster", startVehicleRaceBooster, [],
    state => { state.runtime.physicsState = 3; });
  compare("lock", "setRaceMotionLocked", state => setVehicleRaceMotionLocked(state, true), [true]);
  compare("play boost locked", "startPlayBooster",
    state => startVehiclePlayBooster(state, { rawDriftHeld: true }), [{ rawDriftHeld: true }],
    state => { state.runtime.raceMotionLocked = true; });
  compare("play boost unlocked", "startPlayBooster",
    state => startVehiclePlayBooster(state, { rawDriftHeld: true }), [{ rawDriftHeld: true }]);
  compare("restore interaction", "restoreResetInteraction", restoreVehicleResetInteraction);
});

test("low speed automatic reset and control cancellation match release", () => {
  const input = { forward: 1, reverse: 0 };
  function check(label: string, edit: (state: Scenario) => void = () => {}) {
    compare(label, "lowSpeedAutomaticResetActive",
      state => isVehicleLowSpeedAutomaticResetActive(state, input), [input], edit);
  }
  check("low speed", state => { state.runtime.automaticResetInteractionActive = true; });
  check("high speed", state => {
    state.runtime.automaticResetInteractionActive = true;
    state.body.linearVelocity.x = 2;
  });
  check("interaction off");
  check("bypass on", state => {
    state.runtime.automaticResetInteractionActive = true;
    state.runtime.fullPhysicsBypass = true;
  });
  compare("no direction", "lowSpeedAutomaticResetActive",
    state => isVehicleLowSpeedAutomaticResetActive(state, { forward: 0, reverse: 0 }),
    [{ forward: 0, reverse: 0 }], state => { state.runtime.automaticResetInteractionActive = true; });
  compare("cancel", "cancelControls", cancelVehicleControls, [],
    state => { state.nitroSeamlessRequest = true; state.runtime.activeDrift = true; });
  compare("hard cancel", "hardCancelControls", hardCancelVehicleControls, [],
    state => { state.nitroSeamlessRequest = true; state.runtime.activeDrift = true; });
});

test("drift stopping and full gauge inventory conversion match release", () => {
  compare("dirt drift stop", "stopDrift", state => stopVehicleDrift(state, state.surfaces), [],
    state => { state.runtime.activeDrift = true; state.runtime.delayedDriftRequest = true; });
  compare("asphalt drift stop", "stopDrift", state => stopVehicleDrift(state, state.surfaces), [],
    state => {
      state.runtime.activeDrift = true;
      state.wheels.roadDescriptor = { surface: "asphalt" };
    });
  compare("already transient", "stopDrift", state => stopVehicleDrift(state, state.surfaces), [],
    state => { state.runtime.activeDrift = true; state.runtime.roadTransient = 1; });
  compare("inactive drift", "stopDrift", state => stopVehicleDrift(state, state.surfaces));
  compare("missing road descriptor", "stopDrift", state => stopVehicleDrift(state, state.surfaces), [],
    state => { state.wheels.roadDescriptor = undefined; });
  compare("inventory full", "updateModeInventory", updateVehicleModeInventory);
  compare("inventory no empty slot", "updateModeInventory", updateVehicleModeInventory, [],
    state => { state.runtime.speedSlots = [6, 14]; });
  compare("inventory not full", "updateModeInventory", updateVehicleModeInventory, [],
    state => { state.runtime.committedGauge = 80; });
  compare("inventory max clamped", "updateModeInventory", updateVehicleModeInventory, [],
    state => { state.tuning.driftMaxGauge = 0.5; state.runtime.committedGauge = 1; });
});

test("steering, warp, physics and animation accessors match release", () => {
  compare("suppress steering", "setDriveSteeringSuppressed",
    state => setVehicleDriveSteeringSuppressed(state, true), [true]);
  compare("read steering", "isDriveSteeringSuppressed", isVehicleDriveSteeringSuppressed);
  compare("physics bypass", "setFullPhysicsBypass", state => setVehicleFullPhysicsBypass(state, true), [true]);
  compare("warp active", "setWarpPresentationActive", state => setVehicleWarpPresentationActive(state, true), [true]);
  compare("warp inactive", "setWarpPresentationActive", state => setVehicleWarpPresentationActive(state, false), [false]);
  compare("read warp", "isWarpPresentationActive", isVehicleWarpPresentationActive);
  compare("protect press", "setWarpPressProtected", state => setVehicleWarpPressProtected(state, true), [true]);
  compare("animation slot", "setAnimationSlot", state => setVehicleAnimationSlot(state, 6), [6]);
  for (const slot of [-1, 7, 1.5, NaN])
    compare(`invalid animation slot ${slot}`, "setAnimationSlot", state => setVehicleAnimationSlot(state, slot), [slot]);
  compare("consume animation input", "consumeKartAnimationInput", consumeVehicleKartAnimationInput);
});

test("runtime and multiplayer scale setters preserve release validation and float rounding", () => {
  compare("all runtime scales", "setRuntimeScales",
    state => setVehicleRuntimeScales(state, { drive: 0.93, steering: 0.97, drag: 1.01 }),
    [{ drive: 0.93, steering: 0.97, drag: 1.01 }]);
  compare("partial runtime scales", "setRuntimeScales", state => setVehicleRuntimeScales(state, { drive: 2 }),
    [{ drive: 2 }]);
  const good: MultiplayerDrivingScales = {
    catchupDrag: 0.9, catchupSteering: 0.96, draftAcceleration: 3, chargerDuration: Math.fround(1.2),
  };
  compare("multiplayer valid", "setMultiplayerDrivingScales",
    state => setVehicleMultiplayerDrivingScales(state, good), [good]);
  compare("multiplayer omitted charger", "setMultiplayerDrivingScales",
    state => setVehicleMultiplayerDrivingScales(state, { ...good, chargerDuration: undefined }),
    [{ ...good, chargerDuration: undefined }]);
  for (const bad of [
    { ...good, catchupDrag: 0.8 },
    { ...good, catchupSteering: Infinity },
    { ...good, draftAcceleration: 5 },
    { ...good, chargerDuration: 1.2 },
  ]) compare(`multiplayer rejects ${JSON.stringify(bad)}`, "setMultiplayerDrivingScales",
    state => setVehicleMultiplayerDrivingScales(state, bad), [bad]);
});

test("event scale and gravity commands match release allowed values and vector rounding", () => {
  for (const percentage of [60, 100, 180, 320, 150])
    compare(`scale ${percentage}`, "triggerEventScale",
      state => triggerVehicleEventScale(state, percentage), [percentage]);
  for (const divisor of [1, 1.5, 2, 3, 3.2, 5, 9, 4])
    compare(`gravity ${divisor}`, "triggerEventGravity",
      state => triggerVehicleEventGravity(state, divisor), [divisor]);
});

test("flying pet listener registration and giant race effects match release", () => {
  const expected = scenario(true), actual = scenario(false);
  const expectedListener = (reset: boolean) => expected.calls.push(`new-pet:${reset}`);
  const actualListener = (reset: boolean) => actual.calls.push(`new-pet:${reset}`);
  const expectedUnsubscribe = releaseCall("addFlyingPetListener", expected, expectedListener) as () => boolean;
  const actualUnsubscribe = addVehicleFlyingPetListener(actual, actualListener);
  assert.deepEqual(snapshot(actual), snapshot(expected), "listener registered");
  for (const listener of expected.flyingPetListeners) listener(true);
  for (const listener of actual.flyingPetListeners) listener(true);
  assert.deepEqual(snapshot(actual), snapshot(expected), "listener invoked");
  assert.equal(actualUnsubscribe(), expectedUnsubscribe(), "listener removed");
  assert.deepEqual(snapshot(actual), snapshot(expected), "listener set after unsubscribe");

  compare("giant protection", "giantSourceProtected", vehicleGiantSourceProtected);
  compare("giant protection on", "giantSourceProtected", vehicleGiantSourceProtected, [],
    state => { state.runtime.pressProtected1C0 = true; });
  compare("giant compensate", "compensateGiantBooster", compensateVehicleGiantBooster);
  compare("giant compensate disabled first slot", "compensateGiantBooster", compensateVehicleGiantBooster, [],
    state => { state.runtime.speedSlotDisabled[0] = true; });
  compare("giant compensate absent", "compensateGiantBooster", compensateVehicleGiantBooster, [],
    state => { state.giant = undefined; });
  compare("giant clear", "clearGiantRaceEffects", clearVehicleGiantRaceEffects);
  compare("giant clear absent", "clearGiantRaceEffects", clearVehicleGiantRaceEffects, [],
    state => { state.giant = undefined; });
});
