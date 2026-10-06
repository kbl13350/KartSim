import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { updateTimeAttackStage } from "../src/timeattack/stage-update.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
const method = declaration?.body.body.find(node =>
  node.type === "ClassMethod" && node.key.name === "update");
assert.ok(method);
const context = {};
runInNewContext(`class ReleasedStage { ${source.slice(method.start, method.end)} }
globalThis.ReleasedStage = ReleasedStage;`, context);

function run(kind, options = {}) {
  const trace = [];
  let clock = 1000;
  let physics;
  let track;
  const camera = { id: "camera" };
  const axis = "world-axis";
  const depth = "depth-axis";
  const repr = value => {
    if (value === physics) return "<physics>";
    if (value === track) return "<track>";
    if (value === camera) return "<camera>";
    if (typeof value === "function") return "<function>";
    if (value === undefined) return "<undefined>";
    if (value && typeof value === "object") return JSON.parse(JSON.stringify(value));
    return value;
  };
  const log = (name, ...args) => trace.push(`${name}:${JSON.stringify(args.map(repr))}`);
  const owner = (name, extra = {}) => new Proxy(extra, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => log(`${name}.${String(key)}`, ...args);
    },
  });
  const cameraState = {
    stateCode: 5, visualScaleMode: 2, motionMode: options.motionMode ?? 1,
    action8: 7, tireTransient: "tire", motorcycleType: 0,
    landingMotionTrigger: true, collisionMotionHit: false,
    collisionMotionStrength: 0.4, landingShockAudioStrength: 0.5,
  };
  const lifecycle = {
    startAtMs: options.noStart ? 0 : 100,
    phase: 3,
    effectiveTime: at => { log("lifecycle.effectiveTime", at); return at - 20; },
  };
  physics = {
    state: { vx: 1, vy: 2, vz: 3, forwardSpeed: 4, drifting: true },
    body: { linearVelocity: "velocity", position: "position" },
    wheels: { roadDescriptor: options.noRoad ? undefined : "road-descriptor" },
    tuning: { dualBoosterEnabled: options.dualBoosterEnabled ?? false },
    synchronizeClock: at => log("physics.synchronizeClock", at),
    consumeKartAnimationInput: () => { log("physics.consumeKartAnimationInput"); return "animation-input"; },
    setAnimationSlot: slot => log("physics.setAnimationSlot", slot),
    driveCameraRuntime: () => { log("physics.driveCameraRuntime"); return cameraState; },
    consumeTrackEventEffectRequests: () => {
      log("physics.consumeTrackEventEffectRequests");
      return options.effectRequests === false ? [] : [{ effect: "spark", atMs: 222 }];
    },
    displaySpeedKmh: () => { log("physics.displaySpeedKmh"); return 123; },
    consumeShockWaveRequest: () => { log("physics.consumeShockWaveRequest"); return "shock"; },
    audioState: () => { log("physics.audioState"); return "audio-state"; },
    dualBoosterState: () => { log("physics.dualBoosterState"); return "booster-state"; },
    dualBoosterMode: () => { log("physics.dualBoosterMode"); return "booster-mode"; },
    consumeCrashEffectRequest: () => { log("physics.consumeCrashEffectRequest"); return "crash"; },
    timeAttackTachometerCharger: () => {
      log("physics.timeAttackTachometerCharger"); return { active: true, durationMs: 150 };
    },
    driftVisualRuntime: () => { log("physics.driftVisualRuntime"); return "drift-runtime"; },
    consumeCollisionAudioStrength: () => { log("physics.consumeCollisionAudioStrength"); return 0.5; },
    consumeSteeringCollisionAudioGain: () => { log("physics.consumeSteeringCollisionAudioGain"); return 0.2; },
  };
  track = {
    expireEventEffects: at => log("track.expireEventEffects", at),
    updateMovingRoads: at => log("track.updateMovingRoads", at),
    consumeExpiredEventEffects: () => {
      log("track.consumeExpiredEventEffects"); return ["expired"];
    },
    updateRender: (...args) => log("track.updateRender", ...args),
  };
  const ghosts = options.noGhosts ? [] : [{
    playback: { sample: at => {
      log("ghost.playback.sample", at);
      return options.plainSample ? { x: 1 } : { sample: { x: 1 } };
    } },
    view: { update: (...args) => log("ghost.view.update", ...args) },
  }];
  const session = {
    lifecycle,
    ghosts,
    rankColors: ["red", "blue"],
    warpCameraFrozen: options.warpCameraFrozen ?? false,
    warpNextCamera: value => log("session.warpNextCamera", value),
    balloonDecoration: options.minimal ? undefined : { scene: owner("balloon.scene") },
    characterDecorations: options.minimal ? [] : [
      { kind: "headBand", render: owner("headBand", { scene: owner("headBand.scene") }) },
      { kind: "other", render: owner("otherDecoration", { scene: owner("otherDecoration.scene") }) },
    ],
    toonEnvironment: options.minimal ? undefined : {},
    vehicleRender: options.minimal ? undefined : owner("vehicleRender"),
    trackEventEffects: options.missingEventOwner || options.minimal
      ? undefined : owner("trackEventEffects"),
    linkedCharacterPresentation: options.minimal ? undefined : owner("linkedCharacterPresentation", {
      updateSpeedRace: (...args) => { log("linkedCharacterPresentation.updateSpeedRace", ...args); return "speed-motion"; },
      update: (...args) => { log("linkedCharacterPresentation.update", ...args); return "linked-motion"; },
      simpleShadowEnabled: () => { log("linkedCharacterPresentation.simpleShadowEnabled"); return true; },
    }),
    kartMotionBlur: options.minimal ? undefined : owner("kartMotionBlur"),
    zetAirEffect: options.minimal ? undefined : owner("zetAirEffect"),
    shockWaveEffect: options.minimal ? undefined : owner("shockWaveEffect"),
    exhaustEffect: options.minimal ? undefined : owner("exhaustEffect"),
    crashEffect: options.minimal ? undefined : owner("crashEffect"),
    chargerEffect: options.minimal ? undefined : owner("chargerEffect"),
    particleModification: options.minimal ? undefined : owner("particleModification"),
    particleModificationBanner: options.minimal ? undefined : owner("particleModificationBanner"),
    particleModificationBannerRequest: "banner-request",
    simpleShadow: options.minimal ? undefined : owner("simpleShadow"),
    kartDriftEffects: options.minimal ? undefined : owner("kartDriftEffects"),
    pendingCharacterFinishMotion: 8,
    characterRender: options.minimal ? undefined : owner("characterRender"),
    flyingPet: options.minimal ? undefined : owner("flyingPet"),
    linkedCharacterRender: options.minimal ? undefined : owner("linkedCharacterRender"),
    kartEffects: options.minimal ? undefined : owner("kartEffects"),
    kartTrails: options.minimal ? undefined : owner("kartTrails"),
    lampFlares: options.minimal ? undefined : owner("lampFlares"),
    trackEventAudio: options.minimal ? undefined : owner("trackEventAudio"),
    trackDummyAudio: options.minimal ? undefined : owner("trackDummyAudio"),
    rain: options.minimal ? undefined : owner("rain"),
    snow: options.minimal ? undefined : owner("snow"),
  };
  const kartRoot = {
    visible: true,
    matrixWorld: "matrix-world",
    updateMatrixWorld: value => log("kartRoot.updateMatrixWorld", value),
  };
  const host = {
    session,
    paused: options.paused ?? false,
    resourceVersion: options.version ?? "p3553",
    frameTimeSeconds: 0.016,
    presentationClockMs: 500,
    camera,
    shell: { started: options.started ?? true },
    workProfiler: options.noProfiler ? undefined : { mark: (name, at) => log("profiler.mark", name, at) },
    getPhysics: () => { log("host.getPhysics"); return physics; },
    getTrack: () => { log("host.getTrack"); return track; },
    drainDrivingInput: (...args) => log("host.drainDrivingInput", ...args),
    clientFramerate: owner("clientFramerate"),
    nitroSeamless: owner("nitroSeamless"),
    touchControls: owner("touchControls"),
    autoForward: { isActive: value => { log("autoForward.isActive", value); return true; } },
    drivingInput: { snapshot: () => { log("drivingInput.snapshot"); return { rawSteer: 0.4 }; } },
    lightFactor: owner("lightFactor"),
    kartView: {
      root: kartRoot,
      update: (...args) => {
        log("kartView.update", ...args);
        return options.noAnimationState ? undefined : "animation-state";
      },
    },
    toonStageBinding: owner("toonStageBinding"),
    gameOptions: { boostBlur: true, inGameFlyingPetVisible: false },
    audio: { kartAudio: options.minimal ? undefined : owner("kartAudio") },
    updateKartBoosterState: (...args) => {
      log("host.updateKartBoosterState", ...args);
      return "booster-animation";
    },
    updateDevToolsTrackObjects: (...args) => log("host.updateDevToolsTrackObjects", ...args),
    updateHud: () => log("host.updateHud"),
  };
  const dependencies = {
    nowMs: () => { log("performance.now"); return clock++; },
    relativeGhostTime: (at, start) => { log("relativeGhostTime", at, start); return at - start; },
    newGhostPoseBuffer: () => { log("newGhostPoseBuffer"); return { position: "ghost-position" }; },
    decodeGhostPose: (sample, buffer) => {
      log("decodeGhostPose", sample, buffer);
      return buffer;
    },
    setVisualScaleMode: mode => log("setVisualScaleMode", mode),
    isExhaustActive: (...args) => { log("isExhaustActive", ...args); return true; },
    particleRatio: (...args) => { log("particleRatio", ...args); return 0.75; },
    roadDescriptorName: road => { log("roadDescriptorName", road); return "road-name"; },
    countdownPhase: 3,
    worldAxis: axis,
    depthAxis: depth,
  };
  Object.assign(context, {
    performance: { now: dependencies.nowMs },
    nG: dependencies.relativeGhostTime,
    kL: dependencies.newGhostPoseBuffer,
    LL: dependencies.decodeGhostPose,
    MK: dependencies.setVisualScaleMode,
    Tk: dependencies.isExhaustActive,
    Pt0: dependencies.particleRatio,
    TW: dependencies.roadDescriptorName,
    Ne: { Countdown: dependencies.countdownPhase },
    H2: axis,
    $2: depth,
  });
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  stage.host = host;
  stage.milliseconds = 0;
  stage.effectiveNowMs = 0;
  stage.released = false;
  stage.ghostPoseBuffer = [];
  stage.ghostPoses = [];
  stage.ghostRouteProgress = { update: (...args) => log("ghostRouteProgress.update", ...args) };
  stage.ui = { trackInfoCard: { update: at => log("trackInfoCard.update", at) } };
  stage.updateDriving = at => log("stage.updateDriving", at);
  if (kind === "rewrite") stage.update = frame => updateTimeAttackStage(stage, frame, dependencies);
  let error;
  try { stage.update({ nowMs: 600 }); } catch (caught) { error = caught.message; }
  return {
    trace,
    error,
    milliseconds: stage.milliseconds,
    effectiveNowMs: stage.effectiveNowMs,
    released: stage.released,
    presentationClockMs: host.presentationClockMs,
    ghostPoses: JSON.parse(JSON.stringify(stage.ghostPoses)),
    pendingCharacterFinishMotion: session.pendingCharacterFinishMotion,
    rootVisible: kartRoot.visible,
  };
}

test("full driving presentation with Ghosts and effects matches release", () => {
  for (const options of [
    {}, { version: "legacy", dualBoosterEnabled: true, plainSample: true },
    { noGhosts: true, noStart: true, noRoad: true, noAnimationState: true },
  ]) {
    assert.deepEqual(run("rewrite", options), run("release", options));
  }
});

test("pause, release and missing event owner paths match release", () => {
  for (const options of [
    { paused: true }, { started: false },
    { minimal: true, effectRequests: false, noProfiler: true },
    { missingEventOwner: true },
  ]) {
    assert.deepEqual(run("rewrite", options), run("release", options));
  }
});
