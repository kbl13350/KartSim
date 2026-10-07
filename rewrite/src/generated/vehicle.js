// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { collectDummySounds, TrackDummySurroundAudio, StandaloneEventSurroundAudio, unsupportedEventSound } from "../vehicle/track-surround-audio.ts";
import { ReadyCameraController, warpNextCamera } from "../vehicle/ready-camera.ts";
import { V1TachometerPresentation } from "../vehicle/v1-tachometer-presentation.ts";
import { XGenTachometerPresentation } from "../vehicle/xgen-tachometer-presentation.ts";
import { buildTrackAdmissionLedger } from "../vehicle/track-admission-ledger.ts";
import { admitTrackObject } from "../vehicle/track-object-admission.ts";
import { isNewMotionSequence, VehicleMotionSender, VehicleMotionReceiver } from "../vehicle/remote-vehicle-motion.ts";
import { LteDodgeMotion, LteDodgeInput } from "../vehicle/lte-dodge.ts";
import { createTailLampEffectClass } from "../vehicle/tail-lamp-effect.ts";
import { createDriftEffectClass, createDriftMarkSetup } from "../vehicle/drift-effect.ts";
import { KartRuntimeState as J40 } from "../vehicle/kart-runtime-state.ts";
import { GiantKartEffect as pL } from "../vehicle/giant-kart-effect.ts";
import { WarpNextController as Qk, warpPresentationBlinkVisible as gv } from "../vehicle/warp-next-controller.ts";
import { EventCollisionLatch as EC } from "../vehicle/event-collision-latch.ts";
import { TrackEventOwner } from "../vehicle/track-event-owner.ts";
import { MovingTrackEvent } from "../vehicle/moving-track-event.ts";
import { copyEventPoint } from "../vehicle/event-geometry.ts";
import { LensFlareEffect, lensFlareAnchor as c30, loadLensFlareEffect } from "../vehicle/lens-flare.ts";
import { loadRaceCharacters } from "../vehicle/race-character-loading.ts";
import { loadVehicleRuntime } from "../vehicle/load-vehicle-runtime.ts";
import { loadVehicleAsset } from "../vehicle/load-vehicle-asset.ts";
import { loadTrackMap, loadTimeAttackMap, loadMultiplayerMap } from "../vehicle/load-track-map.ts";
import { KartAudioRuntime, loadKartAudio, decodeMotorAudio, parseRoadSoundConfig } from "../vehicle/kart-audio-runtime.ts";
import { loadCharacterAsset } from "../vehicle/load-character-asset.ts";
import { SlipstreamVisual, loadSlipstreamVisual, SlipstreamAudio, loadSlipstreamAudio } from "../vehicle/slipstream-effects.ts";
import { validateRaceStartGrid as iL, raceStartPosition as rL } from "../vehicle/race-start-slots.ts";
import { LapTiming as vL, NormalObjectCoordinator as U40 } from "../vehicle/normal-coordinator.ts";
import { NormalRaceCoordinator } from "../vehicle/normal-race-coordinator.ts";
import { VehicleFrameClock as $40, normalizeVehicleTime as DC } from "../vehicle/frame-clock.ts";
import { routeSurfaceKind as Eg, routeTagFamily as Vo } from "../world/route-tag.ts";
import { RainScreenEffect } from "../vehicle/rain-screen-effect.ts";
import { SnowScreenEffect, loadSnowScreenEffect } from "../vehicle/snow-screen-effect.ts";
import { RainAudioCue, loadRainAudioCue } from "../vehicle/rain-audio-cue.ts";
import { parseKartSpecCsv as qw } from "../physics/csv.ts";
import { createBodyParamSpec as pS } from "../physics/body-param.ts";
import { VehicleSpecCatalog } from "../physics/catalog.ts";
import { GameMotionEncoder as S40, GameMotionDecoder as d6 } from "../multiplayer/payload.ts";
import { ClockSynchronizer as L40 } from "../multiplayer/network-timing.ts";
import { TrackCoinContact as y10 } from "../vehicle/track-coin.ts";
import { CharacterMotionSequencer } from "../vehicle/motion-sequencer.ts";
import { StandardMotionController, LinkedMotionController, MappedMotionController } from "../vehicle/animation-selectors.ts";
import { ResultMotionController, SingleActionMotionController, ActionSetMotionController } from "../vehicle/animation-actions.ts";
import { TetherMotion as H10 } from "../vehicle/tether-motion.ts";
import { loadTrackCoinSource, parseTrackCoinResources, uniqueOriginalCoinAsset } from "../vehicle/track-coin-source.ts";
import { TrackCoinOwner } from "../vehicle/track-coin-owner.ts";
import { ChargerEffect } from "../vehicle/charger-effect.ts";
import { CoatingOwner } from "../vehicle/coating-owner.ts";
import { $1, B2, D1, D2, F1, GG, H, IN, J9, M1, R9, S1, T2, TG, Vt, W2, X5, Y2, _0, _9, a5, d3, e9, h3, h9, ir, kl, l1, l2, nn, r1, ra, s1, s5, t9, u1, u9, v1, v2, v9, y1, yr } from "./vendor.js";
import { Ao, CR, Co, Fl, G2, HG, HY, He, J5, MZ, NG, Nm, O5, P6, PW, Qj, Ri, SR, SX, T, TR, To, UB, Um, W1, W6, WB, WY, We, YW, b4, c5, ca, d5, dn, dt, e3, fa, gw, hB, hX, ie, j0, j2, j6, lt, mo, ow, p2, qG, qp, rn, s2, sX, sn, sw, t3, tt, vw, we, x1, xR, y9, yB, yw, zG } from "./formats.js";
import { $w, BJ, BQ, Ca, Cw, EI, FI, G20, GJ, HI, Io, Iw, Jp, KI, Kl, LI, Lo, MI, Ma, Nw, OR, Os, Q9, Ql, RI, Rw, S9, TJ, Vw, WQ, Ww, XR, Z00, Zl, _J, bI, ba, e6, el, fn, he, jM, jR, k20, ko, mI, n7, oS, p5, qn, r20, r7, s20, sh, t6, t7, u10, u5, v90, vI, vJ, wa, x4, xa, xs, yI, z20, zQ, zw } from "./library.js";
import { d10, h10, hn } from "./data.js";
import { F2, F4, m } from "./math.js";

const trackSurroundAudioOps = { decode: Q9, route: S9, setGain: he, setLoop: w4 };
const readyCameraOps = { isPrsController: P6, unsupportedPrs: Nm, createPrsRuntime: zG, animatePrs: PW, fieldOfView: we };
const v1TachometerOps = { attribute: T, makeCharger: TJ, makeGaugePulse: Jp, updateCharger: _J, chargerVisibility: GJ, updateGaugePulse: jR, updateResettingBlink: F50, frameAlpha: vg };
const xgenTachometerOps = { attribute: T, initialGauge: jh, setGaugeTarget: Ei, beginGaugeDrain: oC, advanceGauge: aC, pulseAlpha: XR };
const trackAdmissionOps = { routeSurfaceKind: Eg, descriptorUses: qG, isDeferredRoad: mo, unsupportedRoad: NG, isItemOnlyMovable: HG, admitObstacle: Um, parseEvent: $k, unsupportedEventSound: eL };
const lteDodgeInputOps = { positiveAction: l2.ModeImpulsePositive, negativeAction: l2.ModeImpulseNegative, lockMs: Ql.lockMs };
const animationActionDependencies = { createSequence: (source, motions, initial) => new _r(source, motions, initial), oneWay: m1, returnable: h5 };
const coinOwnerOps = { createObject: () => new T2(), originalAsset: nl, decodeModel: y9, decodeAudio: Q9, loadModel: c5, createContact: (...args) => new y10(...args), routeAudio: S9 };
const chargerEffectOps = { decodeModel: y9, loadModel: c5, prepareTexture: ye0, configureMesh: ie, configureMaterials: ve0 };
const coatingOwnerOps = { createTextures: library => new yB(library), loadProjection: Ak };
const movingEventOps = { transformPoint: e3 };
const trackEventOwnerOps = { createAnimator: (root, projection) => new qn0(root, projection), copyPosition: copyEventPoint };
const vehicleRuntimeOps = { resolveResources: t3, wheelAssets: yw, palette: We, prepareAppearance: vw, garageKart: p5, parseParameters: cv, makeVisual: wk, shortAssetName: a40, loadCoating: (...args) => d7.load(...args), needsParticleModification: Bk, loadXunModification: (...args) => Do.loadXun(...args), loadParticleModification: (...args) => c6.load(...args), disposeObject: u5 };
const kartAudioOps = { route: S9, setGain: he, setLoop: w4, roadSoundEnabled: BQ };
const kartAudioLoadOps = { decodeMotor: (context, bytes) => decodeMotorAudio(context, bytes, S30), decodeAudio: Q9, parseRoadConfig: bytes => parseRoadSoundConfig(bytes, s2, T), createContext: () => new AudioContext() };
const vehicleAssetOps = { resolveKartIdentity: b4, tachometerSelection: O50, useClassicHud: E50, resourceVersion: Bt, loadClassicTachometer: () => uv.load(), loadTachometerConfig: $50, makeTacho1: config => new fv(config), makeMqTacho: config => new Fk(config), loadNineTacho: (...args) => p7.load(...args), loadV1Tacho: (...args) => Ta.load(...args), loadXGenTacho: (...args) => Gr.load(...args), loadAudio: (...args) => pv.load(...args), loadEffects: (...args) => Ca.load(...args), loadTrails: (...args) => Ea.load(...args), makeDriftSetup: Ze0, loadDriftEffects: (...args) => iv.load(...args), loadMotionBlur: (...args) => sv.load(...args), loadZetAir: (...args) => lv.load(...args), loadShockWave: (...args) => av.load(...args), loadExhaust: (...args) => rv.load(...args), loadCrash: (...args) => nv.load(...args), loadCharger: (...args) => tv.load(...args), loadLampFlares: (...args) => s6.load(...args), kartModelRoot: J5, loadShadow: (...args) => fr.load(...args), paintColor: We, loadDecoration: Jw, loadAccessory: hr, physicsParams: jt0, rootExtent: el, collisionShape: v90, disposeObject: u5 };
const trackMapOps = { decodeModel: y9, assetProvenance: X30, loadLteCoins: A10, loadWeather: A30, loadWarp: b30, validateCourse: Y30, lensFlareAnchor: c30, dummySounds: Vn0, extractRoad: YW, mapMovingObjects: K30, additionalMatrixRoots: j30, admitMovingObject: Um, parseEventProjection: $k, makeEventRuntime: projection => new Kn0(projection), hasDeferredRoad: mo, isDeferredRoadMaterial: Fl, unsupportedRoad: NG, hasRail: Ri, loadRailConfig: w30, loadRailCapture: y30, resourceVersion: Bt, isLteTrack: Vw, loadAdmission: J30, loadMultiplayerAdmission: Z30, makeReadyCamera: model => new I30(model), loadAdvertisements: Ln0, textureCandidates: hB, textureStatus: sn, loadEnvironment: library => rn.load(library), loadScene: c5, warpNextCamera: O30, configureSkydome: i40 };
const characterAssetOps = { resolveIdentity: pk, chooseCostume: CR, decodeMotion: FI, linkedMotionNames: qp, specialMotionNames: HY, standardMotionNames: WY, linkedController: s40, specialController: o40, standardController: r40, awardController: (...args) => new b10(...args), faceTextureSources: SR, collectFaceMotionAssets: xR, palette: We, parseModel: xa, createScene: TR };
const slipstreamVisualOps = { decodeModel: y9, loadModel: c5 };
const slipstreamAudioOps = { loop: w4, connect: S9 };
const normalRaceModes = { isSoloMode: Q30, isMultiplayerMode: e40 };













const QI = {
    draftMulAccelFactor: g2,
    draftTick: yt,
    driftBoostMulAccelFactor: g2,
    driftBoostTick: yt,
    chargeBoostBySpeed: g2,
    speedSlotCapacity: K1,
    itemSlotCapacity: K1,
    specialSlotCapacity: K1,
    useTransformBooster: K1,
    motorcycleType: K1,
    effectSetupSelectorByte: K1,
    mass: g2,
    airFriction: g2,
    dragFactor: g2,
    forwardAccel: g2,
    backwardAccel: g2,
    gripBrake: g2,
    slipBrake: g2,
    maxSteerDeg: g2,
    steerConstraint: g2,
    frontGripFactor: g2,
    rearGripFactor: g2,
    driftTrigFactor: g2,
    driftTrigTime: g2,
    driftSlipFactor: g2,
    driftEscapeForce: g2,
    cornerDrawFactor: g2,
    driftLeanFactor: g2,
    steerLeanFactor: g2,
    driftMaxGauge: g2,
    normalBoosterTime: g2,
    itemBoosterTime: g2,
    teamBoosterTime: g2,
    animalBoosterTime: g2,
    superBoosterTime: g2,
    transAccelFactor: g2,
    boostAccelFactor: g2,
    startBoosterTimeItem: g2,
    startBoosterTimeSpeed: g2,
    startForwardAccelItem: g2,
    startForwardAccelSpeed: g2,
    driftGaguePreservePercent: g2,
    useExtendedAfterBooster: K1,
    boostAccelFactorOnlyItem: g2,
    antiCollideBalance: g2,
    dualBoosterSetAuto: K1,
    dualBoosterTickMin: yt,
    dualBoosterTickMax: yt,
    dualMulAccelFactor: g2,
    dualTransLowSpeed: g2,
    partsEngineLock: K1,
    partsWheelLock: K1,
    partsSteeringLock: K1,
    partsBoosterLock: K1,
    partsCoatingLock: K1,
    partsTailLampLock: K1,
    chargeInstAccelGaugeByBoost: g2,
    chargeInstAccelGaugeByGrip: g2,
    chargeInstAccelGaugeByWall: g2,
    instAccelFactor: g2,
    instAccelGaugeCooldownTime: yt,
    instAccelGaugeLength: g2,
    instAccelGaugeMinUsable: g2,
    instAccelGaugeMinVelBound: g2,
    instAccelGaugeMinVelLoss: g2,
    useExtendedAfterBoosterMore: K1,
    wallCollGaugeCooldownTime: yt,
    wallCollGaugeMaxVelLoss: g2,
    wallCollGaugeMinVelBound: g2,
    wallCollGaugeMinVelLoss: g2,
    footprintExtent0: g2,
    footprintExtent1: g2,
    defaultExceedType: yt,
    defaultEngineType: F8,
    defaultHandleType: F8,
    defaultWheelType: F8,
    defaultBoosterType: F8,
    chargeInstAccelGaugeByWallAdded: g2,
    chargeInstAccelGaugeByBoostAdded: g2,
    chargerSystemBoosterUseCount: yt,
    chargerSystemUseTime: g2,
    chargeBoostBySpeedAdded: g2,
    driftGaugeFactor: g2,
    chargeAntiCollideBalance: g2,
    startItemTableId: yt,
    startItemId: yt,
    startItemUid: yt,
    partsBoosterEffectLock: K1,
  },
  Hw = Object.keys(QI),
  Gh = ["id", "speedType", "source", ...Hw],
  mS = qw(h10),
  wS = qw(d10);

function JI(vehicle, speed, body, version = "国服") { return physicsCatalog.createVehicleParameters(vehicle, speed, body, version); }

const ur = 7,
  i6 = "国服";



const physicsCatalog = new VehicleSpecCatalog(mS, wS, hn);
function ek(itemId, speed, version = "国服") { return physicsCatalog.lookup(itemId, speed, version); }













function Kw(n, e) {
  const t = Number(n);
  if (n.trim() === "" || !Number.isFinite(t))
    throw new Error(`kartspec.csv ${e}=${n} 必须填写有限数值。`);
  return t;
}

function g2(n, e) {
  const t = Math.fround(Kw(n, e));
  if (!Number.isFinite(t))
    throw new Error(`kartspec.csv ${e}=${n} 超出 f32 范围。`);
  return t;
}

function l7(n, e, t, i) {
  const r = Kw(n, e);
  if (!Number.isInteger(r) || r < t || r > i)
    throw new Error(`kartspec.csv ${e}=${n} 必须是 ${t}..${i} 范围内的整数。`);
  return r;
}

function K1(n, e) {
  return l7(n, e, 0, 255);
}

function F8(n, e) {
  return l7(n, e, 0, 65535);
}

function yt(n, e) {
  return l7(n, e, -2147483648, 2147483647);
}



const AS = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      KART_SNAPSHOT_VERSION: i6,
      STANDARD_KART_SNAPSHOT_SPEED: ur,
      createLocalTimeAttackParameters: ek,
      createVehicleTimeAttackParameters: JI,
      parseTimeAttackKartSpecCsv: qw,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);

function v10(bytes) { return parseTrackCoinResources(bytes, { parse: s2, attribute: T }); }

async function A10(library, track) { return loadTrackCoinSource(library, track, bytes => v10(bytes)); }

class jw extends TrackCoinOwner { static load(library, source, environment, stageBinding, context) { return super.load(library, source, environment, stageBinding, context, coinOwnerOps); } }

function nl(library, path) { return uniqueOriginalCoinAsset(library, path); }

const Ji = Math.fround(0.3);

class _r extends CharacterMotionSequencer {
  constructor(source, motions, initialState) {
    super(source, motions, initialState, {
      prepare: G10, sample: ts, cloneSample: Rh, faceAt: D8,
      advanceSamples: uk, writePose: il, resetClip: V8,
      sampleRoot: hk, float: f0, blendSample: P10,
    });
  }
}

class ag extends StandardMotionController {
  constructor(source, motions, reverse = false) {
    super(source, motions, reverse, {
      createSequence: (clip, mapping, initial) => new _r(clip, mapping, initial),
      buildMotions: M10, selectDrivingMotion: ck,
    });
  }
}

class b10 extends ResultMotionController { constructor(gameplay, base, motions, optional) { super(gameplay, base, motions, optional, animationActionDependencies); } }

class bS extends SingleActionMotionController { constructor(base, motion, action) { super(base, motion, action, animationActionDependencies); } }

class rk extends ActionSetMotionController { constructor(base, special, extras) { super(base, special, extras, animationActionDependencies); } }

class sk extends LinkedMotionController {
  constructor(source, motions, reverse, alwaysLinked) {
    super(source, motions, reverse, alwaysLinked, {
      createSequence: (clip, mapping, initial) => new _r(clip, mapping, initial),
      buildMotions: x10, selectDrivingMotion: T10,
    });
  }
}

class ok extends MappedMotionController {
  constructor(source, motions, reverse = false) {
    super(source, motions, reverse, {
      createSequence: (clip, mapping, initial) => new _r(clip, mapping, initial),
      buildMotions: S10, selectDrivingMotion: ck, mapState: E10,
    });
  }
}

function M10(n) {
  const e = new Map([
    [3, m1(n[3], 250)],
    [4, m1(n[4], 400)],
    [5, m1(n[5], 400)],
    [8, m1(n[8], 250)],
    [9, m1(n[9], 250)],
    [10, h5(n[10], 50, 150)],
    [11, h5(n[11], 50, 150)],
    [14, m1(n[14], 100)],
  ]);
  return (n[19] && e.set(19, m1(n[19], 100)), ak(e, n[12], n[13]), e);
}

function x10(n) {
  const e = new Map([
    [0, m1(n[0], 250)],
    [8, m1(n[8], 250)],
    [9, m1(n[9], 250)],
    [10, h5(n[10], 50, 150)],
    [11, h5(n[11], 50, 150)],
    [14, m1(n[14], 100)],
    [18, m1(n[18], 250)],
  ]);
  return (n[19] && e.set(19, m1(n[19], 100)), ak(e, n[12], n[13]), e);
}

function ak(n, e, t) {
  (e && n.set(12, h5(e, 250, 250, 5e3)), t && n.set(13, h5(t, 250, 250, 5e3)));
}

function S10(n) {
  const e = new Map();
  return (
    [25, 26, 27, 30, 31, 32, 33, 36].forEach((t) => {
      e.set(t, m1(n.f10, 250));
    }),
    n.f22 && e.set(34, h5(n.f22, 300, 300, 6e3)),
    n.f23 && e.set(35, h5(n.f23, 300, 300, 6e3)),
    n.f54 && e.set(19, m1(n.f54, 100)),
    e
  );
}

function m1(n, e) {
  return { animation: n, enterBlendMs: e };
}

function h5(n, e, t, i) {
  return { animation: n, enterBlendMs: e, returnBlendMs: t, spanOverrideMs: i };
}

const C10 = new Map([
  [3, 25],
  [4, 26],
  [5, 27],
  [8, 30],
  [9, 31],
  [10, 32],
  [11, 33],
  [12, 34],
  [13, 35],
  [14, 36],
  [19, 19],
]);

function E10(n) {
  const e = C10.get(n);
  if (e === void 0) throw new Error(`characterAniType=1 缺少状态 ${n} 映射。`);
  return e;
}

function T10(n, e, t, i) {
  let r = _10(n, e, t, i);
  return (e.visualScaleMode !== 0 && (r = e.motorcycle ? 19 : 14), r);
}

function _10(n, e, t, i) {
  return lk(e) || e.boosterState === 18
    ? i
      ? 14
      : 18
    : e.forwardSpeed > -Ji && e.forwardSpeed < Ji
      ? 0
      : e.forwardSpeed > Ji
        ? 18
        : t
          ? n
          : e.rawSteer < 0
            ? 9
            : 8;
}

function D8(n, e) {
  const t = n.sequence.map[e];
  if (t === void 0)
    throw new Error(`CharSequence face map 缺少 root slot ${e}。`);
  return t;
}

function ck(n, e, t) {
  return lk(e) || e.visualScaleMode !== 0
    ? e.motorcycle
      ? 19
      : 14
    : e.forwardSpeed > -Ji && e.forwardSpeed < Ji
      ? MS(e.rawSteer, e.tireTransient, t)
      : e.forwardSpeed <= Ji
        ? t
          ? n
          : e.rawSteer < 0
            ? 9
            : 8
        : MS(e.rawSteer, e.tireTransient, t);
}

function lk(n) {
  const e = n.boosterState;
  return (
    n.instantAccelerationActive || (e >= 1 && e < 12) || (e >= 13 && e < 17)
  );
}

function MS(n, e, t) {
  return e !== 0 ? 3 : n > 0 ? (t ? 5 : 4) : n < 0 ? (t ? 4 : 5) : 3;
}

function G10(n) {
  if (
    n.channels.length !== 24 ||
    n.channels.some((e) => e.value.className !== "PRSTontroller")
  )
    throw new Error("CharSequence 必须包含 24 个 PRSTontroller。 ");
  if (n.rootChannel.value.className !== "IntTontroller")
    throw new Error("CharSequence root channel 不是 IntTontroller。 ");
  return {
    sequence: n,
    channels: n.channels.map(() => ({ position: Ih(), rotation: Ih() })),
    root: Ih(),
  };
}

function V8(n) {
  (n.channels.forEach((e) => {
    (Bh(e.position), Bh(e.rotation));
  }),
    Bh(n.root));
}

function Bh(n) {
  ((n.anchor = 0), (n.previousCycle = 0), (n.reverseHalf = !1));
}

function ts(n, e) {
  const t = n.sequence.channels,
    i = new Array(t.length);
  for (let s = 0; s < t.length; s += 1)
    i[s] = { translation: [0, 0, 0], rotation: [0, 0, 0, 1] };
  uk(n, e, i);
  const r = new Array(i.length);
  for (let s = 0; s < i.length; s += 1) {
    const o = new Array(12);
    (il(o, i[s].rotation, i[s].translation), (r[s] = o));
  }
  return {
    pose: r,
    samples: i,
    root: hk(n.sequence.rootChannel.value, n.root, e),
  };
}

function uk(n, e, t) {
  const i = n.sequence.channels;
  for (let r = 0; r < i.length; r += 1) {
    const s = i[r].value,
      o = n.channels[r],
      a = t[r];
    (s.position
      ? k10(a.translation, s.position.value, s, o.position, e)
      : ((a.translation[0] = 0),
        (a.translation[1] = 0),
        (a.translation[2] = 0)),
      s.rotation
        ? L10(a.rotation, s.rotation.value, s, o.rotation, e)
        : ((a.rotation[0] = 0),
          (a.rotation[1] = 0),
          (a.rotation[2] = 0),
          (a.rotation[3] = 1)));
  }
}

const xS = new WeakMap();

function Xw(n) {
  let e = xS.get(n);
  return (e || ((e = {}), xS.set(n, e)), e);
}

function B10(n) {
  const e = Xw(n);
  if (!e.vec3) {
    const t = n.records.map((s) => {
        const o = r6(s);
        return {
          time: o.getUint32(0, !0),
          value: [
            o.getFloat32(4, !0),
            o.getFloat32(8, !0),
            o.getFloat32(12, !0),
          ],
        };
      }),
      [i, r] = Yw(t);
    e.vec3 = { keys: t, start: i, stop: r };
  }
  return e.vec3;
}

function R10(n) {
  const e = Xw(n);
  if (!e.quat) {
    const t = n.records.map((s) => {
        const o = r6(s);
        return {
          time: o.getUint32(0, !0),
          value: [
            o.getFloat32(8, !0),
            o.getFloat32(12, !0),
            o.getFloat32(16, !0),
            o.getFloat32(4, !0),
          ],
        };
      }),
      [i, r] = Yw(t);
    e.quat = { keys: t, start: i, stop: r };
  }
  return e.quat;
}

function I10(n) {
  const e = Xw(n);
  if (!e.integer) {
    const t = n.records.map((s) => ({
        time: r6(s).getUint32(0, !0),
        value: r6(s).getInt32(4, !0),
      })),
      [i, r] = Yw(t);
    e.integer = { keys: t, start: i, stop: r };
  }
  return e.integer;
}

function k10(n, e, t, i, r) {
  if (e.kind !== "fixed" || e.category !== "vec3" || e.keyType !== 1)
    throw new Error("CharSequence position 仅支持 Vec3 keyType1。 ");
  const { keys: s, start: o, stop: a } = B10(e),
    c = Zw(t.base, i, r, o, a),
    l = Qw(s, c),
    u = Math.min(l + 1, s.length - 1),
    h = s[l];
  if (l === u) {
    ((n[0] = h.value[0]), (n[1] = h.value[1]), (n[2] = h.value[2]));
    return;
  }
  const d = s[u],
    f = dk(h.time, d.time, c),
    p = f0(1 - f);
  ((n[0] = f0(f0(h.value[0] * p) + f0(d.value[0] * f))),
    (n[1] = f0(f0(h.value[1] * p) + f0(d.value[1] * f))),
    (n[2] = f0(f0(h.value[2] * p) + f0(d.value[2] * f))));
}

function L10(n, e, t, i, r) {
  if (e.kind !== "fixed" || e.category !== "rotation" || e.keyType !== 1)
    throw new Error("CharSequence rotation 仅支持 quaternion keyType1。 ");
  const { keys: s, start: o, stop: a } = R10(e),
    c = Zw(t.base, i, r, o, a),
    l = Qw(s, c),
    u = Math.min(l + 1, s.length - 1),
    h = s[l];
  if (l === u) {
    ((n[0] = h.value[0]),
      (n[1] = h.value[1]),
      (n[2] = h.value[2]),
      (n[3] = h.value[3]));
    return;
  }
  const d = s[u];
  fk(n, h.value, d.value, dk(h.time, d.time, c));
}

function hk(n, e, t) {
  const i = n.keys.value;
  if (i.kind !== "fixed" || i.category !== "integer" || i.keyType !== 3)
    throw new Error("CharSequence root 仅支持 Int keyType3。 ");
  const { keys: r, start: s, stop: o } = I10(i),
    a = Zw(n.base, e, t, s, o);
  return r[Qw(r, a)].value;
}

function Yw(n) {
  return n.length > 1 ? [n[0].time, n[n.length - 1].time] : [0, 0];
}

function Zw(n, e, t, i, r) {
  e.anchor === 0 && t !== 0 && (e.anchor = t);
  const s = (e.anchor + n.phase) >>> 0;
  let o = t < s ? 0 : (t + n.phase - e.anchor) >>> 0;
  F10(n.frequency) !== 1065353216 &&
    (o = Math.trunc(f0(f0(o) * n.frequency)) >>> 0);
  const a = Math.trunc(f0(f0((r - i) >>> 0) * n.frequency)) >>> 0;
  if (a === 0) return o;
  if (n.cycleMode === 0) return ((o % a) + i) >>> 0;
  if (n.cycleMode === 1) {
    const c = Math.floor(o / a) >>> 0;
    (c !== e.previousCycle && (e.reverseHalf = !e.reverseHalf),
      (e.previousCycle = c));
    const l = o % a;
    return e.reverseHalf ? (a - l) >>> 0 : l;
  }
  return n.cycleMode === 2 ? (o < i ? i : o > r ? r : o) : t;
}

function Qw(n, e) {
  if (n.length === 0) throw new Error("CharSequence track 不含 key。 ");
  let t = 0;
  for (; t + 1 < n.length && e > n[t + 1].time;) t += 1;
  return t;
}

const ns = [0, 0, 0, 0];

function dk(n, e, t) {
  const i = (e - n) >>> 0;
  return i === 0 ? 0 : f0(f0((t - n) >>> 0) / f0(i));
}

function P10(n, e, t, i) {
  const r = f0(1 - i);
  ((n.translation[0] = f0(f0(e.translation[0] * r) + f0(t.translation[0] * i))),
    (n.translation[1] = f0(
      f0(e.translation[1] * r) + f0(t.translation[1] * i),
    )),
    (n.translation[2] = f0(
      f0(e.translation[2] * r) + f0(t.translation[2] * i),
    )));
  let s = t.rotation;
  (cg(e.rotation, s) < 0 &&
    ((ns[0] = -t.rotation[0]),
    (ns[1] = -t.rotation[1]),
    (ns[2] = -t.rotation[2]),
    (ns[3] = -t.rotation[3]),
    (s = ns)),
    fk(n.rotation, e.rotation, s, i));
}

function Rh(n) {
  return {
    translation: [n.translation[0], n.translation[1], n.translation[2]],
    rotation: [n.rotation[0], n.rotation[1], n.rotation[2], n.rotation[3]],
  };
}

function fk(n, e, t, i) {
  const r = f0(cg(e, t));
  let s = f0(1 - f0(r * f0(0.82279688)));
  s = f0(f0(s * s) * f0(0.58549219));
  let o;
  if (i > 0.5) {
    const l = f0(1 - i);
    o = f0(1 - f0(f0(f0(f0(f0(f0(l + l) - 3) * f0(s * l)) + 1) + s) * l));
  } else o = f0(f0(f0(f0(f0(f0(i + i) - 3) * f0(s * i)) + 1) + s) * i);
  ((n[0] = f0(f0(f0(t[0] - e[0]) * o) + e[0])),
    (n[1] = f0(f0(f0(t[1] - e[1]) * o) + e[1])),
    (n[2] = f0(f0(f0(t[2] - e[2]) * o) + e[2])),
    (n[3] = f0(f0(f0(t[3] - e[3]) * o) + e[3])));
  const a = cg(n, n);
  let c = f0(f0(f0(a - f0(0.95906597)) * f0(-0.53251559)) + f0(1.0214351));
  (a <= f0(0.91521198) &&
    ((c = SS(a, c)), a <= f0(0.6521197) && (c = SS(a, c))),
    (n[0] = f0(n[0] * c)),
    (n[1] = f0(n[1] * c)),
    (n[2] = f0(n[2] * c)),
    (n[3] = f0(n[3] * c)));
}

function SS(n, e) {
  return f0(
    e *
      f0(
        f0(f0(f0(f0(e * e) * n) - f0(0.95906597)) * f0(-0.53251559)) +
          f0(1.0214351),
      ),
  );
}

function il(n, [e, t, i, r], [s, o, a]) {
  ((n[0] = f0(1 - f0(2 * f0(f0(t * t) + f0(i * i))))),
    (n[1] = f0(2 * f0(f0(e * t) - f0(i * r)))),
    (n[2] = f0(2 * f0(f0(e * i) + f0(t * r)))),
    (n[3] = s),
    (n[4] = f0(2 * f0(f0(e * t) + f0(i * r)))),
    (n[5] = f0(1 - f0(2 * f0(f0(e * e) + f0(i * i))))),
    (n[6] = f0(2 * f0(f0(t * i) - f0(e * r)))),
    (n[7] = o),
    (n[8] = f0(2 * f0(f0(e * i) - f0(t * r)))),
    (n[9] = f0(2 * f0(f0(t * i) + f0(e * r)))),
    (n[10] = f0(1 - f0(2 * f0(f0(e * e) + f0(t * t))))),
    (n[11] = a));
}

function cg(n, e) {
  return f0(
    f0(f0(f0(n[3] * e[3]) + f0(n[0] * e[0])) + f0(n[1] * e[1])) +
      f0(n[2] * e[2]),
  );
}

function Ih() {
  return { anchor: 0, previousCycle: 0, reverseHalf: !1 };
}

function r6(n) {
  return new DataView(n.buffer, n.byteOffset, n.byteLength);
}

const CS = new DataView(new ArrayBuffer(4));

function F10(n) {
  return (CS.setFloat32(0, n, !0), CS.getUint32(0, !0));
}

function f0(n) {
  return Math.fround(n);
}

const ES = new WeakMap();

async function pk(n, e, t, i) {
  const r = n.get(i);
  if (!r?.containerId || Kl(r) !== "model.1s")
    throw new Error(`${i} 不是可验证的 base character model。`);
  if (r.sourceName.replace(/^character_/i, "").replace(/\.rho$/i, "") !== e)
    throw new Error(`ItemCharacter ${e} 不能绑定 ${r.sourceName}。`);
  const o = n.files.filter((a) => a.containerId === r.containerId).map(Kl);
  return (await D10(n)).resolve(e, t, o);
}

function D10(n) {
  let e = ES.get(n);
  return (
    e ||
      ((e = (async () => {
        const t = n.files.filter(
            (r) =>
              r.sourceName === "character_.rho" && r.name === "costume.bml",
          ),
          i = n.files.filter(
            (r) =>
              r.sourceName === "character_.rho" && r.name === "costumeSet.bml",
          );
        if (t.length !== 1 || i.length !== 1)
          throw new Error(
            `character_ descriptor source 数量无效：costume=${t.length}, costumeSet=${i.length}。`,
          );
        return gw.parse(s2(await t[0].bytes()), s2(await i[0].bytes()));
      })()),
      ES.set(n, e)),
    e
  );
}

const V10 = [0, 0.7, 1],
  N10 = 1.3,
  O10 = 80,
  z10 = 3,
  W10 = k0(0.001);



function k0(n) {
  return Math.fround(n);
}

const q10 = 0.02,
  u7 = 10,
  TS = 30,
  K10 = 54,
  j10 = K10 * 3,
  Lh = 0.5,
  Ph = 0.85,
  lg = 3,
  X10 = 3,
  h7 = u7 - 1,
  Y10 = Z10();

function Z10() {
  const n = new Uint16Array(j10);
  let e = 0;
  for (let t = 0; t < h7; t += 1) {
    const i = t * lg,
      r = i + lg,
      s = [
        [i + 0, i + 1, r + 0],
        [i + 1, r + 1, r + 0],
        [i + 1, i + 2, r + 1],
        [i + 2, r + 2, r + 1],
        [i + 2, i + 0, r + 2],
        [i + 0, r + 0, r + 2],
      ];
    for (const o of s)
      ((n[e] = o[0]), (n[e + 1] = o[1]), (n[e + 2] = o[2]), (e += 3));
  }
  return n;
}

function Q10() {
  return {
    positions: new Float32Array(TS * 3),
    normals: new Float32Array(TS * 3),
    orientation: new Float32Array(9),
    points: new Float32Array(u7 * 3),
  };
}

function J10(n, e, t) {
  (ee0(n.points, e, t), te0(n, e));
}

function ee0(n, e, t) {
  const i = R0(e[0] + e[0]),
    r = R0(e[1] + e[1]);
  for (let s = 0; s < u7; s += 1) {
    const o = s * 3;
    if (s === 0) {
      ((n[o] = 0), (n[o + 1] = 0), (n[o + 2] = 0));
      continue;
    }
    if (s === h7) {
      ((n[o] = t[0]), (n[o + 1] = t[1]), (n[o + 2] = t[2]));
      continue;
    }
    const a = R0(s / 9),
      c = R0(1 - a);
    ((n[o] = R0(R0(R0(i * c) * a) + R0(R0(t[0] * a) * a))),
      (n[o + 1] = R0(R0(R0(r * c) * a) + R0(R0(t[1] * a) * a))),
      (n[o + 2] = R0(R0(R0(t[2] * c) * a) + R0(R0(t[2] * a) * a))));
  }
}

function te0(n, e) {
  const t = n.points;
  let i = 0,
    r = 0,
    s = R0(e[0] + e[0]);
  const o = q10;
  for (let a = 0; a < u7; a += 1) {
    const c = a * 3,
      l = a * lg * X10,
      u = ne0(t, a),
      h = R0(R0(u.tz * u.tz) + R0(u.ty * u.ty)),
      d = R0(Math.sqrt(h));
    d !== 0 && ((i = 0), (r = R0(u.tz / d)), (s = R0(-u.ty / d)));
    const f = R0(R0(u.tz * r) - R0(u.ty * s)),
      p = R0(u.tx * s),
      v = R0(-R0(u.tx * r)),
      w = t[c],
      g = t[c + 1],
      y = t[c + 2];
    if (
      (Fh(n, l, 0, w, g, y, o, i, r, s, f, p, v),
      Fh(n, l, 1, w, g, y, o, i, r, s, f, p, v),
      Fh(n, l, 2, w, g, y, o, i, r, s, f, p, v),
      a === h7)
    ) {
      const b = n.orientation;
      ((b[0] = f),
        (b[1] = i),
        (b[2] = u.tx),
        (b[3] = p),
        (b[4] = r),
        (b[5] = u.ty),
        (b[6] = v),
        (b[7] = s),
        (b[8] = u.tz));
    }
  }
}

function Fh(n, e, t, i, r, s, o, a, c, l, u, h, d) {
  const f = n.positions,
    p = n.normals,
    v = e + t * 3;
  let w, g, y;
  if (t === 0)
    ((w = R0(R0(o * a) + i)), (g = R0(R0(o * c) + r)), (y = R0(R0(o * l) + s)));
  else {
    const E = t === 1 ? -1 : 1,
      _ = R0(R0(R0(o * a) * Lh)),
      C = R0(R0(R0(o * c) * Lh)),
      S = R0(R0(R0(o * l) * Lh)),
      G = R0(R0(R0(o * u) * Ph) * E),
      I = R0(R0(R0(o * h) * Ph) * E),
      L = R0(R0(R0(o * d) * Ph) * E);
    ((w = R0(R0(i - _) + G)), (g = R0(R0(r - C) + I)), (y = R0(R0(s - S) + L)));
  }
  ((f[v] = w), (f[v + 1] = g), (f[v + 2] = y));
  const b = R0(w - i),
    A = R0(g - r),
    x = R0(y - s),
    M = R0(Math.sqrt(R0(R0(R0(A * A) + R0(b * b)) + R0(x * x))));
  if (M === 0) {
    ((p[v] = 1), (p[v + 1] = 0), (p[v + 2] = 0));
    return;
  }
  ((p[v] = R0(b / M)), (p[v + 1] = R0(A / M)), (p[v + 2] = R0(x / M)));
}

function ne0(n, e) {
  const t = e * 3;
  let i, r;
  e === 0
    ? ((i = t), (r = t + 3))
    : e === h7
      ? ((i = t - 3), (r = t))
      : ((i = t - 3), (r = t + 3));
  const s = R0(n[r] - n[i]),
    o = R0(n[r + 1] - n[i + 1]),
    a = R0(n[r + 2] - n[i + 2]),
    c = R0(Math.sqrt(R0(R0(R0(o * o) + R0(s * s)) + R0(a * a))));
  return c === 0
    ? { tx: 0, ty: 1, tz: 0 }
    : { tx: R0(s / c), ty: R0(o / c), tz: R0(a / c) };
}

function R0(n) {
  return Math.fround(n);
}

const gk = ["stuff2_", "stuff"],
  mk = ["png", "tga", "kng"];

function ie0(n, e, t, i) {
  switch (e) {
    case "balloon":
      return [C3(`balloon/${t}/balloon.1s`, n)];
    case "goggle":
      if (i?.goggleType) {
        const r = ug(`goggle/${t}_${i.goggleType}.1s`, n);
        if (r) return [r];
      }
      return [C3(`goggle/${t}.1s`, n)];
    case "headBand":
      return ["0", "1", "2", "3"].map((r) => C3(`headBand/${t}_${r}.1s`, n));
    case "handGearL":
      return [C3(`handGearL/${t}.1s`, n)];
    case "aura": {
      const r = [C3(`aura/${t}_1.1s`, n), C3(`aura/${t}_2.1s`, n)],
        s = ug(`aura/${t}_3.1s`, n);
      return (s && r.push(s), r);
    }
    case "skidMark":
      return [C3(`skidMark/model/${t}.1s`, n)];
  }
}

function C3(n, e) {
  const t = ug(n, e);
  if (!t)
    throw new Error(`P3528 装饰模型 ${n} 在 stuff2/stuff 下需恰好命中 1 个。`);
  return t;
}

function ug(n, e) {
  const t = [];
  for (const i of gk) {
    const r = e.exactCanonicalCandidates(`${i}/${n}`);
    if (r.length > 1) throw new Error(`P3528 装饰模型 ${i}/${n} 有多个候选。`);
    if (r.length === 1) {
      const s = r[0].canonicalPath ?? r[0].virtualPath;
      t.push({ entry: r[0], folder: s.slice(0, s.lastIndexOf("/")) });
    }
  }
  return t.length === 1 ? t[0] : void 0;
}

async function hr(n, e, t, i, r, s) {
  const o = ie0(n, e, t, s),
    a = await Promise.all(o.map((u) => u.entry.bytes().then(y9)));
  for (const u of a)
    if (u.root.kind !== "node")
      throw new Error(`P3528 装饰 ${t} 的 .1s 根节点不是 Relement。`);
  const c = await Promise.all(
    a.map((u, h) =>
      W1(u, n, `${e}/${t}`, de0(n, o[h].folder), {
        environment: i,
        stageBinding: r,
        advanceEnvironment: !1,
        convertClientCoordinates: s?.convertClientCoordinates,
      }),
    ),
  );
  e === "aura" && c.forEach((u) => le0(u.object));
  const l = s?.trans;
  if (
    (l !== void 0 && l < 1 && c.forEach((u) => se0(u.object, l)),
    c.length === 1)
  )
    return { scene: c[0], dispose: () => c[0].dispose() };
  if (e === "aura") return oe0(a, c);
  if (e === "headBand") return ce0(c);
  throw new Error(`P3528 装饰 ${e}/${t} 意外有多槽模型。`);
}

function se0(n, e) {
  const t = Math.min(Math.max(e, 0), 1),
    i = new Set();
  n.traverse((r) => {
    if (!(r instanceof D2)) return;
    const s = Array.isArray(r.material) ? r.material : [r.material];
    for (const o of s) {
      if (i.has(o)) continue;
      i.add(o);
      const a = o.uniforms?.materialColor?.value;
      a instanceof Y2 && ((a.w = a.w * t), a.w < 1 && (o.transparent = !0));
    }
  });
}

function oe0(n, e) {
  const t = e[0],
    i = e[1],
    r = e.length > 2 ? e[2] : void 0,
    s = _S(n[0]),
    o = r ? _S(n[2]) : 0,
    a = r ? [t, i, r] : [t, i],
    c = new T2();
  ((c.name = "P3528ReAura"), a.forEach((v) => c.add(v.object)));
  let l = 1,
    u = 0,
    h = !1,
    d = 0;
  const f = (v) => {
      ((d = v),
        a.forEach((w, g) => {
          w.object.visible = g === v;
        }));
    },
    p = () => {
      ((d = -1),
        a.forEach((v) => {
          v.object.visible = !1;
        }));
    };
  return (
    f(0),
    {
      scene: {
        object: c,
        update: (v, w, g, y) => {
          if (h) return;
          const b = Math.trunc(v) >>> 0;
          switch (l) {
            case 1:
              (t.reset(b), (l = 2), (u = b), f(0));
              break;
            case 2:
              b - u > s && (i.reset(b), (l = 3), f(1));
              break;
            case 3:
              break;
            case 4:
              l = 5;
              break;
            case 5:
              ((l = 6), (u = b), r ? (r.reset(b), f(2)) : (p(), (l = 0)));
              break;
            case 6:
              (o === 0 || b - u >= o) && (p(), (l = 0));
              break;
            case 0:
              return;
          }
          d >= 0 && a[d]?.update(v, w, g, y);
        },
        reset: (v) => {
          h || ((u = 0), (l = 1), f(0), t.reset(v));
        },
        dispose: () => {
          ((h = !0), a.forEach((v) => v.dispose()));
        },
      },
      requestDespawn: () => {
        h || ((l === 1 || l === 2 || l === 3) && (l = 4));
      },
      auraPhase: () => l,
      dispose: () => {
        ((h = !0), a.forEach((v) => v.dispose()));
      },
    }
  );
}

function ae0(n) {
  const e = Math.trunc(n);
  if (e === 0) return 1;
  if (e === 1 || e === 2) return 2;
  if (e === 3) return 3;
}

function ce0(n) {
  let e = 0;
  const t = new T2();
  ((t.name = "P3528ReHeadBand"),
    n.forEach((s, o) => {
      ((s.object.visible = o === e), t.add(s.object));
    }));
  const i = (s, o) => {
    (n.forEach((a, c) => {
      a.object.visible = c === s;
    }),
      n[s]?.reset(o),
      (e = s));
  };
  let r = !1;
  return {
    scene: {
      object: t,
      update: (s, o, a, c) => {
        r || n.forEach((l) => l.update(s, o, a, c));
      },
      reset: (s) => {
        r ||
          (n.forEach((o) => o.reset(s)),
          (e = 0),
          n.forEach((o, a) => {
            o.object.visible = a === 0;
          }));
      },
      dispose: () => {
        ((r = !0), n.forEach((s) => s.dispose()));
      },
    },
    setOwnerState: (s, o) => {
      const a = ae0(s);
      r || a === void 0 || a === e || i(a, o);
    },
    dispose: () => {
      ((r = !0), n.forEach((s) => s.dispose()));
    },
  };
}

function le0(n) {
  const e = new Set();
  n.traverse((t) => {
    if (!(t instanceof D2)) return;
    const i = Array.isArray(t.material) ? t.material : [t.material];
    for (const r of i) {
      if (e.has(r)) continue;
      e.add(r);
      const s = r.uniforms?.baseMap?.value;
      !(s instanceof J9) ||
        !ue0(s) ||
        ((r.transparent = !0),
        (r.blending = u1),
        (r.blendSrc = l1),
        (r.blendDst = h3),
        (r.blendEquation = R9),
        (r.needsUpdate = !0));
    }
  });
}

function ue0(n) {
  const e = n.image?.data;
  if (!e || e.length === 0 || e.length % 4 !== 0) return !1;
  for (let t = 3; t < e.length; t += 4) if (e[t] !== 255) return !1;
  return !0;
}

function _S(n) {
  let e = 0;
  const t = n.root.kind === "track" ? n.root.scene : n.root,
    i = (r) => {
      const s = r.slotOccurrences[1]?.value;
      if (P6(s))
        for (const o of s.firstLastCache) e = Math.max(e, Math.trunc(o) >>> 0);
      r.children.forEach(i);
    };
  return (i(t), e);
}

async function Jw(n, e, t, i, r) {
  const s = await hr(n, "balloon", e, t, i, {
      convertClientCoordinates: !1,
      trans: r.trans,
    }),
    o = new T2();
  o.name = "balloon-wire-root";
  const a = new T2();
  ((a.name = "balloon-swing"), a.add(s.scene.object), o.add(a));
  const c = Q10(),
    l = new t9();
  (l.setAttribute("position", new _0(c.positions, 3)),
    l.setAttribute("normal", new _0(c.normals, 3)),
    l.setIndex(new _0(Y10, 1)));
  const u = new d3({ color: (r.wireColor ?? 4279466459) & 16777215, side: s1 }),
    h = new D2(l, u);
  ((h.name = "balloon-wire"), (h.frustumCulled = !1), ie(h, 0, !1), o.add(h));
  const d = r.balloonPos ?? V10,
    f = new H10({
      pos: d,
      wireLengthLimit: r.balloonWireLengthLimit ?? N10,
      floatingForce: r.balloonFloatingForce ?? O10,
      viscousDrag: r.balloonViscousDrag ?? z10,
    }),
    p = new v2(),
    v = (y) => {
      (a.position.set(y[0], y[1], y[2]),
        J10(c, d, y),
        (l.attributes.position.needsUpdate = !0),
        (l.attributes.normal.needsUpdate = !0));
      const b = c.orientation;
      (p.set(
        b[0],
        b[1],
        b[2],
        0,
        b[3],
        b[4],
        b[5],
        0,
        b[6],
        b[7],
        b[8],
        0,
        0,
        0,
        0,
        1,
      ),
        a.quaternion.setFromRotationMatrix(p));
    };
  v(f.reset());
  const w = new Array(12).fill(0),
    g = [0, 0, 0];
  return {
    scene: {
      object: o,
      update: (y, b, A, x) => {
        s.scene.update(y, b, A, x);
        const M = o.parent;
        M &&
          (M.updateWorldMatrix(!0, !1),
          he0(M.matrixWorld, w),
          (g[0] = a.position.x),
          (g[1] = a.position.y),
          (g[2] = a.position.z),
          v(f.update(w, g, y)));
      },
      reset: (y) => {
        (s.scene.reset(y), v(f.reset()));
      },
      dispose: () => {
        (s.scene.dispose(), l.dispose(), u.dispose());
      },
    },
    dispose: () => s.dispose(),
  };
}

function he0(n, e) {
  const t = n.elements;
  ((e[0] = t[0]),
    (e[1] = t[4]),
    (e[2] = t[8]),
    (e[3] = t[12]),
    (e[4] = t[1]),
    (e[5] = t[5]),
    (e[6] = t[9]),
    (e[7] = t[13]),
    (e[8] = t[2]),
    (e[9] = t[6]),
    (e[10] = t[10]),
    (e[11] = t[14]));
}

function ev(n, e, t) {
  (n.updateWorldMatrix(!0, !1), e.updateWorldMatrix(!0, !1));
  const i = e.getWorldPosition(new H());
  t.position.copy(n.worldToLocal(i));
}

function de0(n, e) {
  return (t) => {
    if (t.kind !== "texture") return { status: "missing" };
    const i = t.name;
    if (!i) return { status: "missing" };
    for (const r of mk) {
      const s = n.exactCanonicalCandidates(`${e}/${i}.${r}`);
      if (s.length === 1) return { status: "found", entry: s[0] };
      if (s.length > 1)
        return { status: "unresolved", reason: `${e}/${i}.${r} 有多个候选。` };
    }
    return { status: "missing" };
  };
}

function Yf0(n) {
  return n === "xun" ? "parts:partsTailLamp12_0" : "parts:partsTailLamp_0";
}

function Zf0(n, e) {
  const t = n.filter((i) => i.slot === e);
  return e === "boosterEffect" ? t.sort((i, r) => r.id - i.id) : t;
}

function fe0(n, e) {
  if (!e || /[\\/]/.test(e) || e === "." || e === "..")
    throw new Error("喷焰预览名称无效。");
  const i = `${n.entriesUnderCanonicalPrefix("stuff2_/boosterEffect").length ? "stuff2_/boosterEffect" : "stuff/boosterEffect"}/${e}/boosterShop.1s`,
    r = n.exactCanonicalCandidates(i);
  if (r.length > 1) throw new Error(`喷焰预览模型不唯一：${i}`);
  return r.length === 1 ? i : void 0;
}

const GS = new WeakMap();

function pe0(n) {
  let e = GS.get(n);
  return (e || ((e = ge0(n)), GS.set(n, e)), e);
}

async function ge0(n) {
  const e = n.exactCanonicalCandidates("etc_/itemTable.kml");
  if (e.length !== 1) throw new Error("外观部件 itemTable 缺失或不唯一。");
  return x1(await e[0].bytes()).root.children.flatMap((i) => {
    const r = i.name.endsWith("12") ? "xun" : "classic",
      s =
        i.name === "partsTailLamp" || i.name === "partsTailLamp12"
          ? "tailLamp"
          : i.name === "partsBoosterEffect12"
            ? "boosterEffect"
            : void 0;
    if (!s) return [];
    const o = Number(j0(i, "id"));
    if (!Number.isInteger(o) || o < 1) throw new Error("无效的外观资源 ID。");
    const a = j0(i, "color"),
      c = j0(i, "name");
    if (
      s === "tailLamp" &&
      (!a ||
        !/^\d+ \d+ \d+ \d+$/.test(a) ||
        a.split(" ").some((u) => Number(u) > 255))
    )
      throw new Error("车灯颜色不是 ARGB 字节。");
    if (s === "boosterEffect" && (!c || /[\\/]/.test(c)))
      throw new Error("喷焰名称无效。");
    const l = `stuff2_/parts/${i.name}_${o}.png`;
    return [
      {
        family: r,
        slot: s,
        id: o,
        title: s === "tailLamp" ? `车灯 ${o}` : `喷焰 ${o} · ${c}`,
        color: a,
        effect: c,
        ...(s === "boosterEffect" ? { previewModel: fe0(n, c) } : {}),
        icon: n.exactCanonicalCandidates(l).length === 1 ? l : void 0,
      },
    ];
  });
}

async function wk(n, e, t) {
  if (!t) return e;
  if ((n7(t), e.defaultExceedType > 0 != (t.family === "xun")))
    throw new Error("外观资源与车辆不兼容。");
  const i = await pe0(n),
    r = (a) => {
      const c = t[a];
      if (c === void 0) return;
      const l = i.find(
        (u) => u.family === t.family && u.slot === a && u.id === c,
      );
      if (!l) throw new Error(`外观部件不在 P3543 目录中：${a} ${c}`);
      return l;
    },
    s = r("tailLamp"),
    o = r("boosterEffect");
  if (
    o &&
    !n.exactCanonicalCandidates(`effect/booster/${o.effect}/booster.1s`).length
  )
    throw new Error(`喷焰资源缺失：${o.effect}`);
  if (o && !e.boosterTypes.some((a) => a.startsWith("12main2")))
    throw new Error("该车没有已支持的迅 main2 喷焰挂点。");
  return {
    ...e,
    ...(s
      ? { tailLampColorSource: s.color, teamTailLampColorSource: s.color }
      : {}),
    ...(o
      ? {
          boosterTypes: e.boosterTypes.map((a) =>
            a.startsWith("12main2") ? o.effect : a,
          ),
        }
      : {}),
  };
}



class tv extends ChargerEffect {
  static load(library, parent, environment, stageBinding) {
    return super.load(library, parent, environment, stageBinding, chargerEffectOps);
  }
}

function ve0(n) {
  n.traverse((e) => {
    if (e.isMesh !== !0) return;
    const t = e.material;
    for (const i of Array.isArray(t) ? t : [t])
      i.transparent && (i.depthWrite = !1);
  });
}

function ye0(n) {
  const e = new Set();
  n.traverse((t) => {
    if (!t.isMesh) return;
    const i = t.material;
    for (const r of Array.isArray(i) ? i : [i]) {
      const o = r.uniforms?.baseMap?.value;
      !o || e.has(o) || (e.add(o), Ae0(o));
    }
  });
}

function Ae0(n) {
  const e = n,
    t = e?.image?.data,
    i = e?.image?.width,
    r = e?.image?.height;
  if (!(t instanceof Uint8Array) || !i || !r) return;
  const s = 4;
  for (let o = 0; o < r; o += 1) {
    const a = o * i * s;
    for (let c = 0; c < i >> 1; c += 1) {
      const l = i - 1 - c,
        u = a + c * s,
        h = a + l * s;
      for (let d = 0; d < s; d += 1) {
        const f = t[u + d];
        ((t[u + d] = t[h + d]), (t[h + d] = f));
      }
    }
  }
  e.needsUpdate = !0;
}

function vk(n) {
  const e = new Map(),
    t = (i) => {
      const r = j0(i, "itemCatId"),
        s = j0(i, "itemId"),
        o = j0(i, "itemName")?.trim();
      if (
        i.name === "item" &&
        ["68", "69", "76", "77", "78"].includes(r ?? "") &&
        s &&
        /^\d+$/.test(s) &&
        o
      ) {
        const a = `${r}:${Number(s)}`,
          c = e.get(a);
        e.set(a, c === void 0 || c === o ? o : null);
      }
      i.children.forEach(t);
    };
  return (t(n), e);
}

async function Qf0(n, e) {
  const t = n.exactCanonicalCandidates("zeta_/cn/shop/data/item.kml");
  if (!t.length) return e;
  if (t.length !== 1) throw new Error("车库中文名称表不唯一。");
  const i = vk(x1(await t[0].bytes()).root);
  return e.map((r) => {
    const s = r.slot === "boosterEffect" ? 78 : r.family === "xun" ? 77 : 69,
      o = i.get(`${s}:${r.id}`);
    return o ? { ...r, title: o } : r;
  });
}

function be0(n) {
  const e = new Set();
  return n.children.flatMap((t) => {
    if (t.name !== "partsCoating" && t.name !== "partsCoating12") return [];
    const i = t.name === "partsCoating12" ? "xun" : "classic",
      r = (l, u) => {
        const h = j0(t, l) ?? u;
        if (h === void 0 || !/^\d+$/.test(h) || Number(h) > 65535)
          throw new Error(`无效的车膜 ${l}。`);
        return Number(h);
      },
      s = r("id"),
      o = r("resIdx", "0"),
      a = o & 255,
      c = `${i}:${s}`;
    if (s === 0 || e.has(c)) throw new Error("车膜商品 ID 为零或重复。");
    return (
      e.add(c),
      [
        {
          family: i,
          id: s,
          resourceIndex: o,
          textureIndex: a,
          title: `${i === "xun" ? "迅 " : ""}车膜 ${s}`,
          ...(a === 0
            ? { unavailableReason: "车型默认车膜索引尚待核实" }
            : a === 255
              ? { unavailableReason: "特殊车膜状态尚待核实" }
              : { texturePath: `effect/envMap/env${a}.png` }),
        },
      ]
    );
  });
}

const N8 = new WeakMap();

function Me0(n) {
  let e = N8.get(n);
  return (
    e ||
      ((e = xe0(n)),
      N8.set(n, e),
      e.catch(() => {
        N8.get(n) === e && N8.delete(n);
      })),
    e
  );
}

async function xe0(n) {
  const e = n.exactCanonicalCandidates("etc_/itemTable.kml");
  if (e.length !== 1) throw new Error("车膜 itemTable 缺失或不唯一。");
  const t = n.exactCanonicalCandidates("zeta_/cn/shop/data/item.kml");
  if (t.length > 1) throw new Error("车膜中文名称表不唯一。");
  const i = t.length ? vk(x1(await t[0].bytes()).root) : new Map();
  return be0(x1(await e[0].bytes()).root).map((r) => {
    const s = r.family === "xun" ? 76 : 68,
      o = i.get(`${s}:${r.id}`) ?? r.title,
      a = `stuff2_/parts/partsCoating${r.family === "xun" ? "12" : ""}_${r.id}.png`,
      c = n.exactCanonicalCandidates(a);
    if (c.length > 1) throw new Error(`车膜图标不唯一：${a}`);
    const l = r.texturePath ? n.exactCanonicalCandidates(r.texturePath) : [];
    return {
      ...r,
      title: o,
      icon: c.length ? a : void 0,
      unavailableReason:
        r.unavailableReason ??
        (l.length !== 1 ? "车膜纹理缺失或不唯一" : void 0),
    };
  });
}

function yk(n) {
  if (n.partsCoatingLock) throw new Error("此车的车膜部件已锁定。");
  if (n.envMap === -1) throw new Error("prism 特殊车膜路径尚未开放装备。");
  if (
    n.envMapSource !== void 0 &&
    n.envMapSource !== "false" &&
    n.envMapSource !== "true" &&
    n.envMapSource !== "1"
  )
    throw new Error("此车的默认 EnvMap 分支尚未核实，暂不覆盖车膜。");
}

async function Ak(n, e, t, i, r, s) {
  if (r?.coating === void 0) return;
  if ((n7(r), (i !== 8 && i !== 9) || (i === 9) != (r.family === "xun")))
    throw new Error("车膜与车代不兼容。");
  yk(t);
  const o = (await Me0(n)).find(
    (c) => c.family === r.family && c.id === r.coating,
  );
  if (!o || o.unavailableReason || !o.texturePath)
    throw new Error(o?.unavailableReason ?? "车膜商品不在已验证目录中。");
  const a = HI(e, t.attachments);
  if (a.unclassified.length) throw new Error("此车包含未核实的车膜绘制部件。");
  return { draws: a.draws, texture: await s.request(o.textureIndex) };
}

class d7 extends CoatingOwner {
  static load(library, scene, visual, body, generation, selection, textures) {
    return super.load(library, scene, visual, body, generation, selection, textures, coatingOwnerOps);
  }
}

const RS = "effect/crash/crash.1s",
  Se0 = "effect/crash/crash1.png",
  Ce0 = "effect/crash/crash2.png",
  Ee0 = 300,
  f7 = 50,
  hg = 4,
  Fo = 6,
  Te0 = f7 * Fo,
  _e0 = I2(0.001),
  Ge0 = I2(0.6),
  Be0 = {
    particleLifetimeMs: 250,
    emissionIntervalMs: 60,
    emitterLifetimeMs: 180,
    initialCount: 2,
    speed: I2(12),
    scaleMultiplier: I2(0.9),
    size: I2(0.7),
  },
  Re0 = {
    particleLifetimeMs: 300,
    emissionIntervalMs: 50,
    emitterLifetimeMs: 180,
    initialCount: 3,
    speed: I2(31),
    scaleMultiplier: I2(0.98),
    size: I2(0.1),
  },
  bk = [
    [-1, -1, 0, 0],
    [1, -1, 0, 1],
    [-1, 1, 1, 0],
    [1, 1, 1, 1],
  ];

class nv {
  constructor(e, t, i, r) {
    ((this.scene = t),
      (this.crash1Texture = i),
      (this.crash2Texture = r),
      (this.object.name = "KartRider ReCrashEffect"),
      (this.object.matrixAutoUpdate = !1),
      (this.object.visible = !1),
      (this.crash1 = new IS(e, Be0)),
      (this.crash2 = new IS(e, Re0)),
      (this.sprayMesh = Le0(r, i)),
      ie(this.sprayMesh, 0, !0),
      this.object.add(this.sprayMesh, t.object));
  }
  scene;
  crash1Texture;
  crash2Texture;
  object = new T2();
  sprayMesh;
  crash1;
  crash2;
  inverseOwnerWorld = new v2();
  cameraRight = new H();
  cameraUp = new H();
  startedAtMs;
  static async load(e, t, i, r) {
    const [s, o, a] = await Promise.all([
      Fe0(e, i, r),
      PS(e, Se0, 64, 64),
      PS(e, Ce0, 32, 32),
    ]);
    return new nv(t, s, o, a);
  }
  update(e, t, i, r, s, o) {
    const a = Math.trunc(e) >>> 0;
    (this.object.matrix.copy(i),
      this.object.updateMatrixWorld(!0),
      t && this.start(a),
      (this.object.visible =
        this.startedAtMs !== void 0 && (a - this.startedAtMs) >>> 0 <= Ee0),
      this.object.visible &&
        (this.updateCameraBasis(r),
        Ie0(
          this.sprayMesh.geometry,
          this.crash2,
          this.crash1,
          this.cameraRight,
          this.cameraUp,
        ),
        this.scene.update(a, r, s, o)),
      this.crash1.update(a),
      this.crash2.update(a));
  }
  reset() {
    ((this.startedAtMs = void 0),
      (this.object.visible = !1),
      this.crash1.reset(),
      this.crash2.reset(),
      Mk(this.sprayMesh.geometry, 0, 0));
  }
  dispose() {
    (this.object.removeFromParent(),
      this.scene.dispose(),
      this.sprayMesh.geometry.dispose(),
      this.sprayMesh.material.forEach((e) => e.dispose()),
      this.crash1Texture.dispose(),
      this.crash2Texture.dispose());
  }
  start(e) {
    ((this.startedAtMs = e),
      (this.object.visible = !0),
      this.crash1.start(e),
      this.crash2.start(e),
      this.scene.reset(e));
  }
  updateCameraBasis(e) {
    (e.updateMatrixWorld(!0),
      this.inverseOwnerWorld.copy(this.object.matrixWorld).invert());
    const t = e.matrixWorld.elements;
    (this.cameraRight
      .set(t[0], t[1], t[2])
      .transformDirection(this.inverseOwnerWorld),
      this.cameraUp
        .set(t[4], t[5], t[6])
        .transformDirection(this.inverseOwnerWorld),
      dg(this.cameraRight),
      dg(this.cameraUp));
  }
}

class IS {
  constructor(e, t) {
    ((this.random = e), (this.config = t));
  }
  random;
  config;
  particles = [];
  active = !1;
  emitterStartedAtMs = 0;
  previousUpdateMs = 0;
  lastEmissionMs = 0;
  start(e) {
    ((this.active = !0),
      (this.emitterStartedAtMs = e),
      (this.previousUpdateMs = e));
    for (let t = 0; t < this.config.initialCount; t += 1) this.spawn(e);
  }
  update(e) {
    if (!this.active) return;
    ((e - this.emitterStartedAtMs) >>> 0 > this.config.emitterLifetimeMs &&
      (this.active = !1),
      (e - this.lastEmissionMs) >>> 0 > this.config.emissionIntervalMs &&
        (this.spawn(e), (this.lastEmissionMs = e)));
    const t = (e - this.previousUpdateMs) >>> 0,
      i = I2(I2(I2(t) * _e0) * this.config.speed);
    (this.updateParticles(e, i), (this.previousUpdateMs = e));
  }
  reset() {
    ((this.particles.length = 0),
      (this.active = !1),
      (this.emitterStartedAtMs = 0),
      (this.previousUpdateMs = 0),
      (this.lastEmissionMs = 0));
  }
  spawn(e) {
    const t = I2(
        I2(I2(this.random.next() / 32767) * I2(Math.PI)) - I2(Math.PI / 2),
      ),
      i = new H(I2(Math.sin(t)), I2(Math.cos(t)), 0),
      r = I2(I2(this.random.next() / 32767) * Ge0),
      s = i.clone().multiplyScalar(r);
    (dg(s),
      this.particles.length === f7 && this.particles.shift(),
      this.particles.push({
        direction: i,
        position: s,
        bornAtMs: e,
        scale: 1,
      }));
  }
  updateParticles(e, t) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const r = this.particles[i];
      if ((e - r.bornAtMs) >>> 0 > this.config.particleLifetimeMs) {
        this.particles.splice(i, 1);
        continue;
      }
      (r.position.set(
        I2(r.position.x + I2(r.direction.x * t)),
        I2(r.position.y + I2(r.direction.y * t)),
        I2(r.position.z + I2(r.direction.z * t)),
      ),
        (r.scale = I2(r.scale * this.config.scaleMultiplier)));
    }
  }
}

function Ie0(n, e, t, i, r) {
  const s = n.getAttribute("position"),
    o = s.array;
  (kS(o, 0, e, i, r),
    kS(o, f7, t, i, r),
    (s.needsUpdate = !0),
    Mk(n, e.particles.length, t.particles.length));
}

function kS(n, e, t, i, r) {
  t.particles.forEach((s, o) => {
    const a = I2(I2(t.config.size * s.scale) * I2(0.5));
    bk.forEach(([c, l], u) => {
      const h = (e + o) * hg + u;
      ke0(n, h, s.position, i, r, I2(c * a), I2(l * a));
    });
  });
}

function ke0(n, e, t, i, r, s, o) {
  ((n[e * 3] = I2(I2(t.x + I2(i.x * s)) + I2(r.x * o))),
    (n[e * 3 + 1] = I2(I2(t.y + I2(i.y * s)) + I2(r.y * o))),
    (n[e * 3 + 2] = I2(I2(t.z + I2(i.z * s)) + I2(r.z * o))));
}

function Le0(n, e) {
  const t = Pe0(),
    i = new D2(t, [LS(n, "crash2"), LS(e, "crash1")]);
  return (
    (i.name = "KartRider ReCrashEffect ReSuperSpray"),
    (i.frustumCulled = !1),
    i
  );
}

function Pe0() {
  const n = new t9(),
    e = f7 * 2,
    t = e * hg;
  n.setAttribute("position", new _0(new Float32Array(t * 3), 3).setUsage(r1));
  const i = new Float32Array(t * 2),
    r = new Float32Array(t * 4),
    s = new Uint16Array(e * Fo);
  for (let o = 0; o < e; o += 1) {
    const a = o * hg;
    (bk.forEach(([, , c, l], u) => {
      (i.set([c, l], (a + u) * 2), r.set([1, 1, 1, 1], (a + u) * 4));
    }),
      s.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], o * Fo));
  }
  return (
    n.setAttribute("uv", new _0(i, 2)),
    n.setAttribute("color", new _0(r, 4)),
    n.setIndex(new _0(s, 1)),
    n.addGroup(0, 0, 0),
    n.addGroup(Te0, 0, 1),
    n
  );
}

function Mk(n, e, t) {
  ((n.groups[0].count = e * Fo), (n.groups[1].count = t * Fo));
}

function LS(n, e) {
  const t = new Vt({
    name: `KartRider ReSuperSpray ${e}`,
    uniforms: { map: { value: n } },
    vertexShader: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      attribute vec4 color;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vUv = uv;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D map;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() { gl_FragColor = texture2D(map, vUv) * vColor; }
    `,
    vertexColors: !0,
    transparent: !0,
    depthTest: !0,
    depthWrite: !1,
    depthFunc: y1,
    side: s1,
    blending: u1,
    blendSrc: l1,
    blendDst: v1,
    blendEquation: R9,
    fog: !1,
    toneMapped: !1,
  });
  return ((t.forceSinglePass = !0), t);
}

async function Fe0(n, e, t) {
  const i = n.exactCanonicalCandidates(RS);
  if (i.length !== 1)
    throw new Error(`${RS} source 数量应为 1，实际为 ${i.length}。`);
  const r = i[0];
  return c5(
    y9(await r.bytes()),
    n,
    r.virtualPath,
    { id: "effect:crash" },
    { environment: e, stageBinding: t, advanceEnvironment: !1 },
  );
}

async function PS(n, e, t, i) {
  const r = n.exactCanonicalCandidates(e);
  if (r.length !== 1)
    throw new Error(`${e} source 数量应为 1，实际为 ${r.length}。`);
  const s = await p2(await r[0].bytes());
  if (s.width !== t || s.height !== i)
    throw new Error(`${e} 应为 ${t}x${i}，实际为 ${s.width}x${s.height}。`);
  const o = new J9(s.pixels, s.width, s.height, e9, _9);
  return (
    (o.name = e),
    (o.colorSpace = v9),
    (o.flipY = !1),
    (o.wrapS = o.wrapT = S1),
    (o.minFilter = o.magFilter = h9),
    (o.generateMipmaps = !1),
    (o.needsUpdate = !0),
    o
  );
}

function dg(n) {
  n.set(I2(n.x), I2(n.y), I2(n.z));
}

function I2(n) {
  return Math.fround(n);
}

const driftEffectDependencies = {
  Object3D: T2, DataTexture: J9, MeshBasicMaterial: d3,
  BufferGeometry: t9, BufferAttribute: _0, Mesh: D2,
  decodePng: p2, configureSkidMesh: ie, configureDriftMesh: Ao,
  textureFormat: e9, textureType: _9, colorSpace: v9,
  wrapping: S1, nearestFilter: h9, dynamicUsage: r1,
  doubleSide: s1, customBlending: u1, additiveEquation: R9,
  sourceAlpha: l1, oneMinusSourceAlpha: v1, oneBlend: h3,
};
function Ze0(definition, scene, singleRearWheel, kartType) {
  return createDriftMarkSetup(definition, scene, singleRearWheel, kartType, oS);
}
const iv = createDriftEffectClass(driftEffectDependencies);

const U8 = "effect/exhaust/exhaust.png",
  rl = 10,
  mg = 4,
  wg = 6,
  qS = W0(0.13),
  it0 = 125,
  rt0 = W0(5),
  st0 = W0(0.01),
  ot0 = W0(0.9),
  at0 = W0(750),
  ct0 = W0(7),
  lt0 = W0(0.001),
  ut0 = W0(0.3),
  Ek = [
    [-1, -1, 0, 0],
    [1, -1, 0, 1],
    [-1, 1, 1, 0],
    [1, 1, 1, 1],
  ];

function Tk(n, e, t, i) {
  const r = n === 2,
    s = !r && ($w(n) !== void 0 || Ww(n) !== void 0 || n === 10);
  return !r && !s && !(n === 10 && e === 5 && t === 3) && !i;
}

class rv {
  constructor(e, t, i, r) {
    ((this.random = e),
      (this.texture = t),
      (this.kartObject = i),
      (this.portOffsets = r),
      (this.object = gt0(t)),
      ie(this.object, 0, !0));
  }
  random;
  texture;
  kartObject;
  portOffsets;
  object;
  particles = [];
  kartQuaternion = new s5();
  exhaustDirection = new H();
  vehicleDirection = new H();
  portWorld = new H();
  cameraRight = new H();
  cameraUp = new H();
  previousTick = 0;
  lastEmissionTick = 0;
  static async load(e, t, i, r) {
    const s = await wt0(e);
    return new rv(t, s, i.object, ht0(i, r));
  }
  update(e, t, i, r, s) {
    const o = Math.trunc(e) >>> 0,
      a = (o - this.previousTick) >>> 0;
    ((this.previousTick = o), this.updateParticles(W0(W0(a) * lt0)));
    const c = (120 - Math.trunc(W0(W0(t) * ut0))) | 0;
    ((o - this.lastEmissionTick) >>> 0 > c >>> 0 &&
      (this.emit(i), (this.lastEmissionTick = o)),
      this.writeGeometry(r),
      (this.object.visible = s));
  }
  reset() {
    ((this.particles.length = 0),
      (this.previousTick = 0),
      (this.lastEmissionTick = 0),
      this.object.geometry.setDrawRange(0, 0));
  }
  dispose() {
    (this.object.removeFromParent(),
      this.object.geometry.dispose(),
      this.object.material.dispose(),
      this.texture.dispose());
  }
  updateParticles(e) {
    const t = W0(at0 * e),
      i = W0(ct0 * e);
    for (const r of this.particles)
      (ft0(r, e),
        (r.exhaustSpeed = Math.max(0, W0(r.exhaustSpeed - st0))),
        (r.vehicleSpeed = W0(r.vehicleSpeed * ot0)),
        (r.alpha = Math.max(0, Math.trunc(W0(r.alpha - t)))),
        (r.renderScale = r.scale),
        (r.scale = W0(r.scale + i)));
  }
  emit(e) {
    (this.kartObject.updateMatrixWorld(!0),
      this.kartObject.getWorldQuaternion(this.kartQuaternion));
    const t = this.vehicleDirection.set(W0(e.x), W0(e.y), W0(e.z)),
      i = W0(t.length());
    Uh(t.normalize());
    for (const r of this.portOffsets) this.spawn(r, t, i);
  }
  spawn(e, t, i) {
    const r = W0(W0(this.random.next() / 32767) * W0(0.2) - W0(0.1));
    (this.exhaustDirection
      .set(r, 1, r)
      .applyQuaternion(this.kartQuaternion)
      .normalize(),
      Uh(this.exhaustDirection));
    const s = this.reserveParticle(),
      o = W0(W0(this.random.next() / 32767) * W0(0.1));
    (this.portWorld.copy(e).applyMatrix4(this.kartObject.matrixWorld),
      Uh(this.portWorld),
      s.position.set(
        W0(this.portWorld.x + W0(this.exhaustDirection.x * o)),
        W0(this.portWorld.y + W0(this.exhaustDirection.y * o)),
        W0(this.portWorld.z + W0(this.exhaustDirection.z * o)),
      ),
      s.exhaustDirection.copy(this.exhaustDirection),
      s.vehicleDirection.copy(t),
      (s.exhaustSpeed = rt0),
      (s.vehicleSpeed = i),
      (s.scale = 1),
      (s.renderScale = 1),
      (s.alpha = it0));
  }
  reserveParticle() {
    this.particles.length === rl && this.particles.shift();
    const e = {
      position: new H(),
      exhaustDirection: new H(),
      vehicleDirection: new H(),
      exhaustSpeed: 0,
      vehicleSpeed: 0,
      scale: 1,
      renderScale: 1,
      alpha: 0,
    };
    return (this.particles.push(e), e);
  }
  writeGeometry(e) {
    e.updateMatrixWorld(!0);
    const t = e.matrixWorld.elements;
    (this.cameraRight.set(t[0], t[1], t[2]).normalize(),
      this.cameraUp.set(t[4], t[5], t[6]).normalize());
    const i = this.object.geometry,
      r = i.getAttribute("position"),
      s = i.getAttribute("color"),
      o = r.array,
      a = s.array,
      c = Ek;
    for (let l = 0; l < this.particles.length; l += 1) {
      const u = this.particles[l];
      for (let h = 0; h < c.length; h += 1) {
        const d = c[h][0],
          f = c[h][1],
          p = l * mg + h,
          v = W0(d * W0(qS * u.renderScale)),
          w = W0(f * W0(qS * u.renderScale));
        pt0(o, p, u.position, this.cameraRight, this.cameraUp, v, w);
        const g = p * 4;
        ((a[g] = 1),
          (a[g + 1] = 1),
          (a[g + 2] = 1),
          (a[g + 3] = W0(u.alpha / 255)));
      }
    }
    ((r.needsUpdate = !0),
      (s.needsUpdate = !0),
      i.setDrawRange(0, this.particles.length * wg));
  }
}

function ht0(n, e) {
  const t = [];
  for (const i of e.slice(0, 2)) {
    const r = n.nodes.get(i);
    if (!r) continue;
    const [s, o, a] = r.source.transform.translation;
    (s === 0 && o === 0 && a === 0) || t.push(dt0(r.object, n.object));
  }
  return t;
}

function dt0(n, e) {
  const t = new H();
  let i = n;
  for (; i && i !== e;) {
    const r = i.matrix.elements;
    (t.set(W0(t.x + W0(r[12])), W0(t.y + W0(r[13])), W0(t.z + W0(r[14]))),
      (i = i.parent));
  }
  if (i !== e) throw new Error(`${n.name} 不属于 KartRenderScene。`);
  return t;
}

function ft0(n, e) {
  const t = n.exhaustDirection,
    i = n.vehicleDirection,
    r = W0(W0(t.x * n.exhaustSpeed) + W0(i.x * n.vehicleSpeed)),
    s = W0(W0(t.y * n.exhaustSpeed) + W0(i.y * n.vehicleSpeed)),
    o = W0(W0(t.z * n.exhaustSpeed) + W0(i.z * n.vehicleSpeed));
  n.position.set(
    W0(n.position.x + W0(r * e)),
    W0(n.position.y + W0(s * e)),
    W0(n.position.z + W0(o * e)),
  );
}

function pt0(n, e, t, i, r, s, o) {
  ((n[e * 3] = W0(W0(t.x + W0(i.x * s)) + W0(r.x * o))),
    (n[e * 3 + 1] = W0(W0(t.y + W0(i.y * s)) + W0(r.y * o))),
    (n[e * 3 + 2] = W0(W0(t.z + W0(i.z * s)) + W0(r.z * o))));
}

function gt0(n) {
  const e = mt0(),
    t = new Vt({
      name: "KartRider ReExhaustEffect preset3",
      uniforms: { map: { value: n } },
      vertexShader: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      attribute vec4 color;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vUv = uv;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
      fragmentShader: `
      precision highp float;
      uniform sampler2D map;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() { gl_FragColor = texture2D(map, vUv) * vColor; }
    `,
      vertexColors: !0,
      transparent: !0,
      depthTest: !0,
      depthWrite: !1,
      depthFunc: y1,
      side: s1,
      blending: u1,
      blendSrc: l1,
      blendDst: v1,
      blendEquation: R9,
      fog: !1,
      toneMapped: !1,
    });
  t.forceSinglePass = !0;
  const i = new D2(e, t);
  return ((i.name = "KartRider ReExhaustEffect"), (i.frustumCulled = !1), i);
}

function mt0() {
  const n = new t9(),
    e = rl * mg,
    t = new _0(new Float32Array(e * 3), 3),
    i = new _0(new Float32Array(e * 4), 4);
  (t.setUsage(r1),
    i.setUsage(r1),
    n.setAttribute("position", t),
    n.setAttribute("color", i));
  const r = new Float32Array(e * 2),
    s = new Uint16Array(rl * wg);
  for (let o = 0; o < rl; o += 1) {
    const a = o * mg;
    (Ek.forEach(([, , c, l], u) => r.set([c, l], (a + u) * 2)),
      s.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], o * wg));
  }
  return (
    n.setAttribute("uv", new _0(r, 2)),
    n.setIndex(new _0(s, 1)),
    n.setDrawRange(0, 0),
    n
  );
}

async function wt0(n) {
  const e = n.exactCanonicalCandidates(U8);
  if (e.length !== 1)
    throw new Error(`${U8} source 数量应为 1，实际为 ${e.length}。`);
  const t = await p2(await e[0].bytes());
  if (t.width !== 64 || t.height !== 64)
    throw new Error(`${U8} 应为 64x64，实际为 ${t.width}x${t.height}。`);
  const i = new J9(t.pixels, t.width, t.height, e9, _9);
  return (
    (i.name = U8),
    (i.colorSpace = v9),
    (i.flipY = !1),
    (i.wrapS = i.wrapT = S1),
    (i.minFilter = i.magFilter = h9),
    (i.generateMipmaps = !1),
    (i.needsUpdate = !0),
    i
  );
}

function Uh(n) {
  n.set(W0(n.x), W0(n.y), W0(n.z));
}

function W0(n) {
  return Math.fround(n);
}

function vt0(n) {
  const e = s2(n);
  if (e.name !== "LampFlare")
    throw new Error(`lampFlare root 应为 LampFlare，实际为 ${e.name}。`);
  const t = T(e, "name");
  if (!t) throw new Error("LampFlare 缺少 name。");
  const i = Array.from({ length: 4 }, (r, s) => {
    const o = e.children.find((p) => p.name === `lampFlare${s}`);
    if (!o) throw new Error(`LampFlare 缺少 lampFlare${s}。`);
    const a = T(o, "texture");
    if (!a) throw new Error(`lampFlare${s} 缺少 texture。`);
    const c = T(o, "isBlink"),
      l = T(o, "isLitUp"),
      u = KS(c, `lampFlare${s}.isBlink`),
      h = KS(l, `lampFlare${s}.isLitUp`),
      d = u ? jS(T(o, "onTick"), `lampFlare${s}.onTick`) : 0,
      f = u ? jS(T(o, "offTick"), `lampFlare${s}.offTick`) : 0;
    return { texture: a, blink: u, onTickMs: d, offTickMs: f, litUp: h };
  });
  return { name: t, slots: i };
}

function yt0(n, e, t) {
  const i = Math.trunc(t) >>> 0;
  if (n.blink) {
    e.anchorMs === 0 && (e.anchorMs = i);
    const r = e.visible ? n.onTickMs : n.offTickMs;
    (i - e.anchorMs) >>> 0 > r && ((e.anchorMs = i), (e.visible = !e.visible));
  } else n.litUp && (e.visible = !0);
  return e.visible;
}

function KS(n, e) {
  if (n === void 0 || n === "off") return !1;
  if (n === "on") return !0;
  throw new Error(`${e} 应为 on/off，实际为 ${n}。`);
}

function jS(n, e) {
  if (n === void 0 || !/^\d+$/.test(n)) throw new Error(`${e} 不是正整数。`);
  const t = Number(n);
  if (!Number.isSafeInteger(t) || t <= 0) throw new Error(`${e} 不是正整数。`);
  return t;
}

const XS = 1.9837;

class s6 {
  constructor(e, t, i, r) {
    ((this.kartObject = e),
      (this.bindings = t),
      (this.materials = i),
      (this.textures = r));
  }
  kartObject;
  bindings;
  materials;
  textures;
  facing = At0();
  static async load(e, t, i, r = !1) {
    const s = t.lampFlareType || "default";
    if (s === "none") return new s6(i.object, [], [], []);
    const o = `effect/lampFlare/${s}`,
      a = e.exactCanonicalCandidates(`${o}/lampFlare.bml`);
    if (a.length !== 1)
      throw new Error(
        `${o}/lampFlare.bml source 数量应为 1，实际为 ${a.length}。`,
      );
    const c = vt0(await a[0].bytes()),
      l = [],
      u = [],
      h = [];
    try {
      for (let d = 0; d < 4; d += 1) {
        const f = c.slots[d],
          p = e.exactCanonicalCandidates(`${o}/${f.texture}.png`);
        if (p.length !== 1)
          throw new Error(
            `${o}/${f.texture}.png source 数量应为 1，实际为 ${p.length}。`,
          );
        const v = i.nodes.get(t.attachments[12 + d]);
        if (!v) continue;
        const w = v.object,
          g = _k(v.source),
          y = await p2(await p[0].bytes()),
          b = new J9(y.pixels, y.width, y.height, e9, _9);
        ((b.colorSpace = v9),
          (b.flipY = !1),
          (b.magFilter = b.minFilter = u9),
          (b.generateMipmaps = !1),
          (b.needsUpdate = !0));
        const A = new TG({
          map: b,
          color: 16777215,
          transparent: !0,
          depthWrite: !1,
          depthTest: r,
        });
        ((A.blending = u1),
          (A.blendSrc = ra),
          (A.blendDst = h3),
          (A.blendEquation = R9),
          (A.toneMapped = !1));
        const x = new GG(A);
        (ca(x, -1e3),
          (x.name = `ReLampFlare:${d}`),
          x.scale.set(XS, XS, 1),
          w.add(x),
          u.push(b),
          l.push(A),
          h.push({
            slot: d,
            config: f,
            attachment: w,
            sprite: x,
            back: f.texture.toLowerCase() === "back",
            sampledNormals: g,
            anchorMs: 0,
            visible: !1,
          }));
      }
      return new s6(i.object, h, l, u);
    } catch (d) {
      throw (
        h.forEach(({ sprite: f }) => f.removeFromParent()),
        l.forEach((f) => f.dispose()),
        u.forEach((f) => f.dispose()),
        d
      );
    }
  }
  update(e, t, i = !1) {
    this.bindings.length !== 0 &&
      (i || this.kartObject.updateMatrixWorld(!0),
      this.bindings.forEach((r) => {
        const {
          config: s,
          attachment: o,
          sprite: a,
          back: c,
          sampledNormals: l,
        } = r;
        a.visible = yt0(s, r, e) && bt0(o, t.position, c, l, this.facing, i);
      }));
  }
  setInputPair(e, t) {
    const i = e === "front" ? 0 : 2;
    this.bindings.forEach((r) => {
      r.slot < i || r.slot > i + 1 || r.config.blink || (r.visible = t);
    });
  }
  resetInputVisibility() {
    (this.setInputPair("front", !1), this.setInputPair("rear", !1));
  }
  dispose() {
    (this.bindings.forEach(({ sprite: e }) => e.removeFromParent()),
      this.materials.forEach((e) => e.dispose()),
      this.textures.forEach((e) => e.dispose()));
  }
}

function At0() {
  return {
    position: new H(),
    view: new H(),
    normal: new H(),
    matrix: new W2(),
  };
}

function bt0(n, e, t, i, r, s) {
  s
    ? r.position.setFromMatrixPosition(n.matrixWorld)
    : n.getWorldPosition(r.position);
  const o = r.view.copy(e).sub(r.position);
  if (o.lengthSq() === 0) return !0;
  o.normalize();
  const a = r.matrix.getNormalMatrix(n.matrixWorld);
  if (t)
    return (
      r.normal.set(0, 1, 0).applyMatrix3(a).normalize().dot(o) >
      0.20000000298023224
    );
  if (i.length === 0)
    return (
      r.normal.set(0, -1, 0).applyMatrix3(a).normalize().dot(o) >
      0.20000000298023224
    );
  for (let c = 0; c < 3; c += 1) {
    const l = c === 0 ? 0 : c === 1 ? i.length - 1 : i.length >> 1,
      u = i[l];
    if (
      r.normal.set(u[0], u[1], u[2]).applyMatrix3(a).normalize().dot(o) >
      0.20000000298023224
    )
      return !0;
  }
  return !1;
}

function _k(n) {
  for (const e of n.children) {
    if (e.value.className === "ReToonRigid")
      return e.value.geometry.value.normals;
    if (Mt0(e.value)) {
      const t = _k(e.value);
      if (t.length > 0) return t;
    }
  }
  return [];
}

function Mt0(n) {
  return [
    "ReKart",
    "Relement",
    "ReCharacter",
    "ReToonRigid",
    "ReTriList",
    "ReToonSkinned",
  ].includes(n.className);
}

const o6 = 256,
  a6 = 500,
  xt0 = Math.fround(0.8999999761581421),
  St0 = new Set([3, 4, 5, 6, 7, 9]);

class sv {
  constructor(e, t, i) {
    ((this.feedbackDurationMs = e),
      (this.quad.frustumCulled = !1),
      this.scene.add(this.quad),
      (this.layers = t.map((r, s) => ({
        mask: r,
        history: ZS(`boostBlur${s + 1} history`),
        color: s === 0 ? 4294967295 : i,
      }))));
  }
  feedbackDurationMs;
  scene = new D1();
  camera = new a5();
  geometry = Rt0();
  copyMaterial = It0();
  feedbackMaterial = kt0();
  overlayMaterial = Lt0();
  quad = new D2(this.geometry, this.copyMaterial);
  capture = ZS("boostBlur capture");
  layers;
  drawingBufferSize = new B2();
  screenTexture;
  screenWidth = 0;
  screenHeight = 0;
  enabled = !1;
  drawable = !1;
  transitionStartMs = 0;
  previousPhysicsState = 0;
  static async load(e, t, i) {
    if (!t.boosterBlur) return;
    const r = Math.max(0, Math.trunc(i));
    if (r > 0 && r < 100)
      throw new Error(
        `MotionBlur duration ${r}ms 会进入 P3528 的零 capture interval。`,
      );
    const s = [],
      o = Bt0(t.boostBlurColorSource);
    try {
      return (
        s.push(await QS(e, "effect/boosterBlur/blurMask.png")),
        o !== 4294967295 &&
          s.push(await QS(e, "effect/boosterBlur/blurMask2.png")),
        new sv(r, s, o)
      );
    } catch (a) {
      throw (s.forEach((c) => c.dispose()), a);
    }
  }
  setState(e, t, i, r) {
    const s = Ct0(this.enabled, e, this.previousPhysicsState, t, r);
    ((this.previousPhysicsState = e),
      s !== this.enabled &&
        ((this.enabled = s),
        (this.drawable = !0),
        (this.transitionStartMs = Et0(this.transitionStartMs, YS(i)))));
  }
  render(e, t) {
    if (!this.drawable) return;
    const i = YS(t),
      r = Tt0(this.enabled, this.transitionStartMs, i);
    if (!this.enabled && r === 0) {
      this.drawable = !1;
      return;
    }
    this.layers.forEach((s) => this.renderLayer(e, s, r, i));
  }
  reset() {
    ((this.enabled = !1),
      (this.drawable = !1),
      (this.transitionStartMs = 0),
      (this.previousPhysicsState = 0),
      this.layers.forEach((e) => {
        e.lastCaptureMs = void 0;
      }));
  }
  dispose() {
    (this.screenTexture?.dispose(),
      this.capture.dispose(),
      this.layers.forEach((e) => {
        (e.mask.dispose(), e.history.dispose());
      }),
      this.geometry.dispose(),
      this.copyMaterial.dispose(),
      this.feedbackMaterial.dispose(),
      this.overlayMaterial.dispose());
  }
  renderLayer(e, t, i, r) {
    const s = Gt0(t.lastCaptureMs, r, this.feedbackDurationMs);
    (s !== void 0 && (this.captureFrame(e, t, s), (t.lastCaptureMs = r)),
      this.overlayFrame(e, t, i));
  }
  captureFrame(e, t, i) {
    const r = this.currentScreenTexture(e);
    (e.setRenderTarget(null),
      e.copyFramebufferToTexture(r),
      (this.copyMaterial.uniforms.map.value = r),
      (this.quad.material = this.copyMaterial),
      e.setRenderTarget(this.capture),
      e.render(this.scene, this.camera),
      (this.feedbackMaterial.uniforms.map.value = this.capture.texture),
      (this.feedbackMaterial.uniforms.opacity.value = i),
      this.feedbackMaterial.uniforms.color.value.set(
        ((t.color >>> 16) & 255) / 255,
        ((t.color >>> 8) & 255) / 255,
        (t.color & 255) / 255,
      ),
      (this.quad.material = this.feedbackMaterial),
      e.setRenderTarget(t.history),
      e.render(this.scene, this.camera));
  }
  overlayFrame(e, t, i) {
    (e.getDrawingBufferSize(this.drawingBufferSize),
      (this.overlayMaterial.uniforms.history.value = t.history.texture),
      (this.overlayMaterial.uniforms.mask.value = t.mask),
      (this.overlayMaterial.uniforms.opacity.value = _t0(t.color, i)),
      this.overlayMaterial.uniforms.uvOffset.value.set(
        -0.5 / this.drawingBufferSize.x,
        0.5 / this.drawingBufferSize.y,
      ),
      (this.quad.material = this.overlayMaterial),
      e.setRenderTarget(null),
      e.render(this.scene, this.camera));
  }
  currentScreenTexture(e) {
    e.getDrawingBufferSize(this.drawingBufferSize);
    const t = this.drawingBufferSize.x,
      i = this.drawingBufferSize.y;
    return this.screenTexture &&
      t === this.screenWidth &&
      i === this.screenHeight
      ? this.screenTexture
      : (this.screenTexture?.dispose(),
        (this.screenTexture = new IN(t, i)),
        (this.screenTexture.name = "boostBlur framebuffer"),
        (this.screenTexture.colorSpace = v9),
        (this.screenTexture.wrapS = this.screenTexture.wrapT = F1),
        (this.screenTexture.minFilter = this.screenTexture.magFilter = u9),
        (this.screenWidth = t),
        (this.screenHeight = i),
        this.screenTexture);
  }
}

function Ct0(n, e, t, i, r) {
  return !r || t === 0 ? !1 : n ? i >= 150 : St0.has(e) && i > 150;
}

function Et0(n, e) {
  const t = (e - n) >>> 0,
    i = t < a6 ? a6 - t : 0;
  return (e - i) >>> 0;
}

function Tt0(n, e, t) {
  const i = (t - e) >>> 0;
  if (i >= a6) return n ? 1 : 0;
  const r = Math.fround(i / a6);
  return n ? r : Math.fround(1 - r);
}

function _t0(n, e) {
  return Math.trunc(Math.fround((n >>> 24) * e)) / 255;
}

function Gt0(n, e, t) {
  if (n === void 0) return 1;
  const i = (e - n) >>> 0;
  if (i >= t) return 1;
  const r = Math.floor(t / 100);
  if (i < r) return;
  const s = Math.floor(i / r);
  let o = Math.fround(1);
  for (let c = 0; c < s; c += 1) o = Math.fround(o * xt0);
  return Math.trunc(Math.fround(Math.fround(1 - o) * 255)) / 255;
}

function YS(n) {
  return Math.trunc(n) >>> 0;
}

function ZS(n) {
  const e = new nn(o6, o6, {
    depthBuffer: !1,
    stencilBuffer: !1,
    minFilter: u9,
    magFilter: u9,
    wrapS: F1,
    wrapT: F1,
  });
  return (
    (e.texture.name = n),
    (e.texture.colorSpace = v9),
    (e.texture.generateMipmaps = !1),
    e
  );
}

async function QS(n, e) {
  const t = n.exactCanonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} source 数量应为 1，实际为 ${t.length}。`);
  const i = await p2(await t[0].bytes());
  if (i.width !== 128 || i.height !== 128)
    throw new Error(`${e} 应为 128x128，实际为 ${i.width}x${i.height}。`);
  const r = new J9(i.pixels, i.width, i.height, e9, _9);
  return (
    (r.name = e),
    (r.colorSpace = v9),
    (r.flipY = !1),
    (r.wrapS = r.wrapT = F1),
    (r.minFilter = r.magFilter = u9),
    (r.generateMipmaps = !1),
    (r.needsUpdate = !0),
    r
  );
}

function Bt0(n) {
  if (n === void 0) return 4294967295;
  const e = n.trim().split(/\s+/).map(Number);
  if (e.length !== 4 || e.some((t) => !Number.isInteger(t) || t < 0 || t > 255))
    throw new Error(`BoostBlurColor ${n} 不是 A R G B bytes。`);
  return ((e[0] << 24) | (e[1] << 16) | (e[2] << 8) | e[3]) >>> 0;
}

function Rt0() {
  const n = new t9();
  return (
    n.setAttribute(
      "position",
      new M1([-1, -1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0], 3),
    ),
    n.setAttribute("uv", new M1([0, 0, 0, 1, 1, 0, 1, 1], 2)),
    n.setIndex([0, 2, 1, 2, 3, 1]),
    n
  );
}

function ov(n) {
  return new Vt({
    uniforms: { uvOffset: { value: new B2() } },
    vertexShader: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform vec2 uvOffset;
      varying vec2 vUv;
      void main() {
        vUv = uv + uvOffset;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: n,
    depthTest: !1,
    depthWrite: !1,
    toneMapped: !1,
  });
}

function It0() {
  const n = ov(`
    precision highp float;
    uniform sampler2D map;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(map, vUv); }
  `);
  return (
    (n.name = "KartRider MotionBlur capture"),
    (n.uniforms.map = { value: null }),
    n
  );
}

function kt0() {
  const n = ov(`
    precision highp float;
    uniform sampler2D map;
    uniform float opacity;
    uniform vec3 color;
    varying vec2 vUv;
    void main() {
      // 10B0A50: RGB = TEXTURE * TFACTOR; alpha selects TFACTOR directly.
      gl_FragColor = vec4(texture2D(map, vUv).rgb * color, opacity);
    }
  `);
  return (
    (n.name = "KartRider MotionBlur feedback"),
    (n.uniforms.map = { value: null }),
    (n.uniforms.opacity = { value: 1 }),
    (n.uniforms.color = { value: new H(1, 1, 1) }),
    n.uniforms.uvOffset.value.set(-0.5 / o6, 0.5 / o6),
    Gk(n),
    n
  );
}

function Lt0() {
  const n = ov(`
    precision highp float;
    uniform sampler2D history;
    uniform sampler2D mask;
    uniform float opacity;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(
        texture2D(history, vUv).rgb,
        texture2D(mask, vec2(vUv.x, 1.0 - vUv.y)).a * opacity
      );
    }
  `);
  return (
    (n.name = "KartRider MotionBlur mask composite"),
    (n.uniforms.history = { value: null }),
    (n.uniforms.mask = { value: null }),
    (n.uniforms.opacity = { value: 1 }),
    Gk(n),
    n
  );
}

function Gk(n) {
  ((n.transparent = !0),
    (n.blending = u1),
    (n.blendEquation = R9),
    (n.blendSrc = l1),
    (n.blendDst = v1));
}

function Pt0(n, e, t) {
  return e === 0 ? t : t && n < e - 1e3;
}

function Ft0(n, e) {
  return n === 9 && e !== void 0 && Number.isInteger(e) && e >= 1 && e <= 5;
}

function Bk(n, e, t) {
  return n === 9
    ? Ft0(n, t)
    : e && n !== void 0 && Number.isInteger(n) && n >= 0 && n <= 8;
}

const Dt0 = Math.fround(0.05),
  Vt0 = Math.fround(0.002);

function Nt0(n, e, t = Dt0, i = Vt0) {
  const r = Math.fround(e[0] - n[0]),
    s = Math.fround(e[1] - n[1]),
    o = Math.fround(e[2] - n[2]),
    a = Math.fround(
      Math.fround(Math.fround(r * r) + Math.fround(s * s)) + Math.fround(o * o),
    );
  if (a < i)
    return { current: [e[0], e[1], e[2]], residualSq: a, converged: !0 };
  const c = Math.fround(t);
  return {
    current: [
      Math.fround(n[0] + Math.fround(r * c)),
      Math.fround(n[1] + Math.fround(s * c)),
      Math.fround(n[2] + Math.fround(o * c)),
    ],
    residualSq: a,
    converged: !1,
  };
}

const Ot0 = "effect/enchant/enchant.1s",
  $8 = "effect/enchant/강화5단계.1s",
  zt0 = [
    [-0.85, 1.25, 1.1],
    [0.85, 1.25, 1.1],
  ],
  Ut0 = [
    [-0.85, 1.25, 1.1],
    [0.85, 1.25, 1.1],
  ],
  JS = new Set([
    "Box001",
    "Object009",
    "Object008",
    "Cylinder001",
    "Cylinder002",
    "Cylinder003",
    "Object010",
    "Object011",
    "Object013",
    "Object012",
  ]),
  eC = new Set([
    "에띠의칩셋",
    "에띠의칩셋_강화5단계_ef_00",
    "에띠의칩셋_강화5단계_ef_01",
    "에띠의칩셋_강화5단계_ef_02",
  ]),
  $t0 = "unverified";

class dr {
  constructor(e, t, i = "garage") {
    ((this.kartScene = e),
      (this.reEnchant = t),
      (this.object = new T2()),
      (this.object.name = `KartRider ${i} ReEnchant/ReAura owner`),
      (this.object.matrixAutoUpdate = !1),
      (this.object.visible = !1),
      (this.reEnchantRoots = t?.rootObjects ?? []),
      (this.reEnchantRootBaseMatrices = this.reEnchantRoots.map((o) =>
        o.matrix.clone(),
      )));
    const r = new T2();
    ((r.name = "ReAura (empty slots)"), (r.matrixAutoUpdate = !1));
    const s = new T2();
    ((s.name = "ReEnchant (verified V1 children)"),
      (s.matrixAutoUpdate = !1),
      this.object.add(r, s),
      this.reEnchant && s.add(this.reEnchant.object),
      (this.kartScene?.modelRoot ?? this.kartScene?.object)?.add(this.object),
      (this.bindingStatus = this.reEnchant ? "child-list" : $t0));
  }
  kartScene;
  reEnchant;
  object;
  active = !1;
  presentationAllowed = !0;
  lifecycleVisible = !1;
  reEnchantConverging = !1;
  reEnchantCurrent = [1, 1, 1];
  reEnchantTarget = [0, 0, 0];
  reEnchantRoots;
  reEnchantRootBaseMatrices;
  reEnchantRootPosition = new H();
  reEnchantRootRotation = new s5();
  reEnchantRootAuthoredScale = new H();
  reEnchantRootScale = new H();
  bindingStatus;
  static async load(e, t, i, r, s) {
    if (!e || !t || typeof e.exactCanonicalCandidates != "function")
      return new dr(t, void 0, "garage");
    const o = await Rk(e, i, r, s);
    return new dr(t, o, "garage");
  }
  update(e, t, i, r, s) {
    const o = Math.trunc(e) >>> 0;
    if (
      (t !== this.active &&
        ((this.active = t),
        t
          ? ((this.reEnchantConverging = !1),
            (this.reEnchantCurrent = [1, 1, 1]),
            (this.lifecycleVisible = !!this.reEnchant),
            this.syncVisibility(),
            this.setReEnchantRootScale(1),
            this.reEnchant?.reset(o),
            this.reEnchant?.playControllers?.(o, 0))
          : ((this.reEnchantConverging = !!(
              this.reEnchant && this.lifecycleVisible
            )),
            (this.reEnchantCurrent = [1, 1, 1]))),
      (t || this.reEnchantConverging) &&
        this.reEnchant &&
        this.lifecycleVisible &&
        (this.reEnchant.update(o, i, r, s), this.reEnchantConverging))
    ) {
      const a = Nt0(this.reEnchantCurrent, this.reEnchantTarget);
      ((this.reEnchantCurrent = a.current),
        this.setReEnchantRootScale(this.reEnchantCurrent),
        a.converged && this.finishReEnchantConvergence(o));
    }
  }
  setPresentationAllowed(e) {
    ((this.presentationAllowed = e), this.syncVisibility());
  }
  reset(e = 0) {
    ((this.active = !1),
      (this.lifecycleVisible = !1),
      (this.reEnchantConverging = !1),
      (this.reEnchantCurrent = [1, 1, 1]));
    const t = Math.trunc(e) >>> 0;
    (this.reEnchant?.stopControllers?.(t),
      this.reEnchant?.reset(t),
      this.setReEnchantRootScale(0),
      this.syncVisibility());
  }
  dispose() {
    (this.object.removeFromParent(), this.reEnchant?.dispose());
  }
  setReEnchantRootScale(e) {
    if (this.reEnchantRoots.length === 0) return;
    const t =
      typeof e == "number"
        ? this.reEnchantRootScale.set(e, e, e)
        : this.reEnchantRootScale.set(e[0], e[1], e[2]);
    for (let i = 0; i < this.reEnchantRoots.length; i += 1) {
      const r = this.reEnchantRoots[i];
      (this.reEnchantRootBaseMatrices[i].decompose(
        this.reEnchantRootPosition,
        this.reEnchantRootRotation,
        this.reEnchantRootAuthoredScale,
      ),
        this.reEnchantRootScale.multiplyVectors(
          this.reEnchantRootAuthoredScale,
          t,
        ),
        r.matrix.compose(
          this.reEnchantRootPosition,
          this.reEnchantRootRotation,
          this.reEnchantRootScale,
        ),
        (r.matrixWorldNeedsUpdate = !0));
    }
    this.reEnchant?.refreshRootWorldMatrices?.();
  }
  syncVisibility() {
    this.object.visible = this.presentationAllowed && this.lifecycleVisible;
  }
  finishReEnchantConvergence(e) {
    ((this.reEnchantConverging = !1),
      this.reEnchant?.stopControllers?.(e),
      this.reEnchant?.reset(e),
      this.setReEnchantRootScale(0),
      (this.lifecycleVisible = !1),
      this.syncVisibility());
  }
}

class c6 extends dr {
  constructor(e, t) {
    super(e, t, "gameplay");
  }
  static async load(e, t, i, r) {
    if (!e || !t || typeof e.exactCanonicalCandidates != "function")
      return new c6(t);
    const s = await Rk(e, i, r);
    return new c6(t, s);
  }
}

class Do extends dr {
  constructor(e, t, i = "gameplay") {
    super(e, t, i);
  }
  static async loadXun(e, t, i, r, s = "gameplay") {
    if (!e || !t || typeof e.exactCanonicalCandidates != "function")
      return new Do(t, void 0, s);
    const o = await Wt0(e, i, r);
    return new Do(t, o, s);
  }
}

async function Rk(n, e, t, i) {
  const r = i?.resourcePath ?? Ot0,
    s = n.exactCanonicalCandidates(r);
  if (s.length === 1)
    try {
      const o = y9(await s[0].bytes()),
        a = o.root.kind === "track" ? o.root.scene : o.root;
      if (i !== void 0 || !qt0(a)) return;
      const c = zt0.map((u) => Lk(a, u)),
        l = r.slice(0, r.lastIndexOf("/") + 1);
      return await W1({ root: c[0] }, n, r, (u) => Ik(n, l, u.name), {
        environment: e,
        stageBinding: t,
        additionalRoots: [c[1]],
        advanceEnvironment: !1,
        convertClientCoordinates: !1,
      });
    } catch {
      return;
    }
}

async function Wt0(n, e, t) {
  const i = n.exactCanonicalCandidates($8);
  if (i.length === 1)
    try {
      const r = y9(await i[0].bytes()),
        s = r.root.kind === "track" ? r.root.scene : r.root;
      if (!Ht0(s)) return;
      const o = Ut0.map((c) => Lk(s, c)),
        a = $8.slice(0, $8.lastIndexOf("/") + 1);
      return await W1({ root: o[0] }, n, $8, (c) => Ik(n, a, c.name), {
        environment: e,
        stageBinding: t,
        additionalRoots: [o[1]],
        advanceEnvironment: !1,
        convertClientCoordinates: !1,
      });
    } catch {
      return;
    }
}

function Ht0(n) {
  const e = [],
    t = new Set(),
    i = (s) => {
      s.name === "Point03" && e.push(s);
      const o = kk(s);
      (o && t.add(o), s.children.forEach(i));
    };
  if ((i(n), e.length !== 1)) return !1;
  const r = e[0];
  return r.children.length !== JS.size ||
    !r.children.every((s) => JS.has(s.name))
    ? !1
    : t.size === eC.size && [...eC].every((s) => t.has(s));
}

function Ik(n, e, t) {
  if (!t)
    return {
      status: "unresolved",
      reason: "ReEnchant 子节点缺少 authored texture 名称",
    };
  const i = t.replaceAll("\\", "/"),
    r = /\.[a-z0-9]+$/i.test(i) ? `${e}${i}` : `${e}${i}.png`,
    s = n.exactCanonicalCandidates(r);
  return s.length === 1
    ? { status: "found", entry: s[0] }
    : { status: "unresolved", reason: `未找到唯一粒子贴图 ${r}` };
}

function qt0(n) {
  let e = 0,
    t = 0,
    i = 0,
    r = 0;
  const s = (o) => {
    (o.className === "ReBillboard" && o.name === "Plane01" && (e += 1),
      o.name && /^Object(?:0[1-7]|47)$/.test(o.name) && (t += 1));
    const a = kk(o);
    (a === "front" && (i += 1),
      a === "플로터@zz" && (r += 1),
      o.children.forEach(s));
  };
  return (s(n), e === 1 && t === 8 && i === 1 && r === 8);
}

function kk(n) {
  for (const e of n.slots)
    if (!(!e || typeof e != "object" || e.kind !== "texture")) return e.name;
}

function Lk(n, e) {
  const t = (r) => ({
      ...r,
      children: r.children.map(t),
      childOccurrences: void 0,
      position: [...r.position],
      scale: [...r.scale],
      transform: r.transform.map((s) => [...s]),
    }),
    i = t(n);
  return ((i.position = [...e]), (i.scale = [1, 1, 1]), i);
}

const tC = "effect/shockWave/effect.1s",
  Kt0 = 1e3;

class av {
  constructor(e) {
    ((this.scene = e),
      (this.object = new T2()),
      (this.object.name = "KartRider shockWave/effect.1s"),
      (this.object.matrixAutoUpdate = !1),
      this.object.add(e.object),
      (this.object.visible = !1));
  }
  scene;
  object;
  startedAtMs;
  static async load(e, t, i) {
    const r = e.exactCanonicalCandidates(tC);
    if (r.length !== 1)
      throw new Error(`${tC} source 数量应为 1，实际为 ${r.length}。`);
    const s = r[0],
      o = await c5(
        y9(await s.bytes()),
        e,
        s.virtualPath,
        { id: "effect:shockWave" },
        { environment: t, stageBinding: i, advanceEnvironment: !1 },
      );
    return new av(o);
  }
  update(e, t, i, r, s, o) {
    const a = Math.trunc(e) >>> 0;
    (this.startedAtMs !== void 0 &&
      (a - this.startedAtMs) >>> 0 > Kt0 &&
      this.reset(),
      t &&
        this.startedAtMs === void 0 &&
        ((this.startedAtMs = a),
        this.object.matrix.copy(i),
        this.object.updateMatrixWorld(!0),
        (this.object.visible = !0),
        this.scene.reset(a)),
      this.startedAtMs !== void 0 && this.scene.update(a, r, s, o));
  }
  reset() {
    ((this.startedAtMs = void 0), (this.object.visible = !1));
  }
  dispose() {
    (this.object.removeFromParent(), this.scene.dispose());
  }
}

function cv(n) {
  const e = n.body,
    t = (y, b = "") => j0(e, y) ?? b,
    i = (y, b) => $h(e, y, b),
    r = (y, b) => Math.fround(i(y, b)),
    s = (y, b) => Xt0(e, y, b),
    o = (y, b) => {
      const A = j0(e, y);
      return A || b;
    },
    a = t("BoosterType", "default"),
    c = [
      o("Port0", "port0"),
      o("Port1", "port1"),
      o("FirePort0", "fire0"),
      o("FirePort1", "fire1"),
      o("FirePort2", "fire2"),
      o("FirePort3", "fire3"),
      o("FirePort4", "fire4"),
      o("FirePort5", "fire5"),
      o("ExtWheel0", "extwheel0"),
      o("ExtWheel1", "extwheel1"),
      o("ExtSteer0", "extsteer0"),
      o("ExtSteer1", "extsteer1"),
      o("Lamp0", "lamp0"),
      o("Lamp1", "lamp1"),
      o("Lamp2", "lamp2"),
      o("Lamp3", "lamp3"),
      o("BalloonPort", "balloon"),
    ],
    l = n.shortTrail,
    u = n.tailLampTeam,
    h = (y) => (l ? j0(l, y) : void 0),
    d = (y, b) => Math.fround(l ? $h(l, y, b) : b),
    f = r("TailLampSize", 0),
    p = j0(e, "TailLampColor"),
    v = t("EnvMap", "false"),
    w = v === "prism" ? -1 : v === "true" || v === "1" ? 1 : 0,
    g = Array.from({ length: 17 }, (y, b) => h(`trailPort${b}`)).flatMap((y) =>
      y === void 0 ? [] : c.flatMap((b, A) => (b === y ? [A] : [])),
    );
  return {
    engineSound: t("EngineSound"),
    boosterBlur: s("BoosterBlur", !1),
    boosterTypes: Array.from({ length: 8 }, (y, b) => t(`BoosterType${b}`, a)),
    boosterWaveType: t("BoosterWaveType"),
    driftBoostEffectType: t("driftBoostEffectType"),
    boostBlurColorSource: j0(e, "BoostBlurColor"),
    waveEffect: s("WaveEffect", !1),
    dualBoosterWaveType: t("dualBoosterWaveType"),
    exceedWaveType: t("ExceedWaveType"),
    defaultExceedType: Wh(i("defaultExceedType", 0), "defaultExceedType"),
    attachments: c,
    envMap: w,
    envMapSource: v,
    partsCoatingLock: s("PartsCoatingLock", !1),
    lampFlareType: t("LampFlareType", "default"),
    extWheelType: Wh(i("ExtWheelType", 0), "ExtWheelType"),
    extWheelSpeed: r("ExtWheelSpeed", 0),
    wheelFixed: s("WheelFixed", !1),
    wheelPosition: r("WheelPosition", 0.8),
    ignoreWheelSteer: s("ignoreWheelSteer", !1),
    reverse: s("Reverse", !1),
    tachometerType: t("TachometerType"),
    tachometerName: t("TachometerName"),
    tailLampSize: f,
    tailLampColorSource: p,
    teamTailLampSize: u ? Math.fround($h(u, "TailLampSize", f)) : f,
    teamTailLampColorSource: u ? (j0(u, "TailLampColor") ?? p) : p,
    shortTrailAttachmentSlots: g,
    shortTrailTailLampSize: d("TailLampSize", 0),
    shortTrailTailLampColorSource: h("TailLampColor"),
    secondColorSource: j0(e, "secondColor"),
    secondHighColorSource: j0(e, "secondHighColor"),
    onCharacterSize: r("OnCharacterSize", 1),
    driftGaugeReset: s("DriftGaugeReset", !0),
    transformTime: Wh(i("TransformTime", 0), "TransformTime"),
    itemSlotName: t("itemSlotName"),
    autoChargeLowSpeed: r("autoChargeLowSpeed", 999999),
    isTransformAutoCharge: s("isTransformAutoCharge", !0),
    isWheelOutline: s("isWheelOutline", !1),
  };
}

function jt0(n, e, t) {
  const i = Math.fround(n.mass),
    r = Math.fround(Math.fround(i * 58.80000305175781) * 0.5);
  return {
    draftMulAccelFactor: n.draftMulAccelFactor,
    draftTick: n.draftTick,
    chargerEnabled: t === 9,
    chargerSystemBoosterUseCount: n.chargerSystemBoosterUseCount,
    chargerSystemUseTime: n.chargerSystemUseTime,
    dualBoosterEnabled: t > 6,
    dualBoosterTickMin: n.dualBoosterTickMin,
    dualBoosterTickMax: n.dualBoosterTickMax,
    dualMulAccelFactor: n.dualMulAccelFactor,
    dualTransLowSpeed: n.dualTransLowSpeed,
    mass: n.mass,
    suspensionSpring: r,
    suspensionPositiveDamping: 0,
    suspensionNegativeDamping: Math.fround(r * 0.20000000298023224),
    airFriction: n.airFriction,
    dragFactor: n.dragFactor,
    forwardAccel: n.forwardAccel,
    backwardAccel: n.backwardAccel,
    gripBrake: n.gripBrake,
    slipBrake: n.slipBrake,
    maxSteerDeg: n.maxSteerDeg,
    steerConstraint: n.steerConstraint,
    frontGripFactor: n.frontGripFactor,
    rearGripFactor: n.rearGripFactor,
    driftTrigFactor: n.driftTrigFactor,
    driftTrigTime: n.driftTrigTime,
    driftSlipFactor: n.driftSlipFactor,
    driftEscapeForce: n.driftEscapeForce,
    cornerDrawFactor: n.cornerDrawFactor,
    driftLeanFactor: n.driftLeanFactor,
    steerLeanFactor: n.steerLeanFactor,
    driftMaxGauge: n.driftMaxGauge,
    driftGaguePreservePercent: n.driftGaguePreservePercent,
    wallCollGaugeCooldownTime: n.wallCollGaugeCooldownTime,
    wallCollGaugeMaxVelLoss: n.wallCollGaugeMaxVelLoss,
    chargeInstAccelGaugeByBoost: n.chargeInstAccelGaugeByBoost,
    chargeInstAccelGaugeByGrip: n.chargeInstAccelGaugeByGrip,
    chargeInstAccelGaugeByWall: n.chargeInstAccelGaugeByWall,
    chargeInstAccelGaugeByBoostAdded: n.chargeInstAccelGaugeByBoostAdded,
    chargeInstAccelGaugeByWallAdded: n.chargeInstAccelGaugeByWallAdded,
    instAccelFactor: n.instAccelFactor,
    instAccelGaugeCooldownTime: n.instAccelGaugeCooldownTime,
    instAccelGaugeLength: n.instAccelGaugeLength,
    instAccelGaugeMinUsable: n.instAccelGaugeMinUsable,
    instAccelGaugeMinVelBound: n.instAccelGaugeMinVelBound,
    instAccelGaugeMinVelLoss: n.instAccelGaugeMinVelLoss,
    wallCollGaugeMinVelBound: n.wallCollGaugeMinVelBound,
    wallCollGaugeMinVelLoss: n.wallCollGaugeMinVelLoss,
    normalBoosterTime: n.normalBoosterTime,
    teamBoosterTime: n.teamBoosterTime,
    startBoosterTimeSpeed: n.startBoosterTimeSpeed,
    startForwardAccelSpeed: n.startForwardAccelSpeed,
    transAccelFactor: n.transAccelFactor,
    boostAccelFactor: n.boostAccelFactor,
    driftBoostMulAccelFactor: n.driftBoostMulAccelFactor,
    driftBoostTick: n.driftBoostTick,
    useTransformBooster: n.useTransformBooster !== 0,
    chargeBoostBySpeed: n.chargeBoostBySpeed,
    chargeBoostBySpeedAdded: n.chargeBoostBySpeedAdded,
    driftGaugeFactor: n.driftGaugeFactor,
    motorcycleType: n.motorcycleType !== 0,
    speedSlotCapacity: n.speedSlotCapacity,
    autoChargeLowSpeed: e.autoChargeLowSpeed,
    driftGaugeReset: e.driftGaugeReset,
    wheelPosition: e.wheelPosition,
  };
}

function $h(n, e, t) {
  const i = j0(n, e);
  if (
    i === void 0 ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(i.trim())
  )
    return t;
  const r = Number(i);
  return Number.isFinite(r) ? r : t;
}

function Xt0(n, e, t) {
  const i = j0(n, e);
  return i === "true" || i === "1" ? !0 : i === "false" || i === "0" ? !1 : t;
}

function Wh(n, e) {
  if (!Number.isInteger(n))
    throw new Error(`${e}=${n} 的非整数转换尚未由 KARTDATA 闭合，已停止合成。`);
  return n;
}



const Zt0 = Math.fround(0.6000000238418579),
  Qt0 = Math.fround(1.3);











const Ea = createTailLampEffectClass({
  Object3D: T2, Vector3: H, DataTexture: J9, ShaderMaterial: Vt,
  BufferGeometry: t9, BufferAttribute: _0, Mesh: D2,
  decodePng: p2, configureMesh: Ao,
  rgbaFormat: e9, unsignedByteType: _9, srgbColorSpace: v9,
  clampToEdgeWrapping: S1, linearFilter: u9, dynamicDrawUsage: r1,
  lessEqualDepth: y1, doubleSide: s1, customBlending: u1,
  sourceAlpha: l1, oneBlend: h3, additiveEquation: R9,
});











const H8 = "effect/zetAir/zetAir.png",
  Hh = A2(170),
  sC = A2(400),
  a50 = A2(5),
  Pk = 50,
  c50 = 6,
  l50 = 42,
  u50 = 128,
  h50 = A2((5 * Math.PI) / 180),
  d50 = A2((10 * Math.PI) / 180),
  qh = A2(Math.PI / 2),
  f50 = A2((3 * Math.PI) / 2),
  p50 = new H(1, 0, 0),
  g50 = new H(0, 0, -1),
  m50 = [0, 1, 2, 2, 1, 3],
  w50 = [
    [0, 0.2, -70],
    [0, -0.2, -70],
    [0.3, 0.2, -24.5],
    [0.3, -0.2, -24.5],
  ],
  v50 = new H(A2(-Math.tan(A2((75 * Math.PI) / 180))), 0, A2(50)).normalize(),
  y50 = [
    [120, 38, 2],
    [110, 37.5, 3],
    [100, 37, 4],
    [80, 36.5, 4],
    [70, 36, 5],
    [70, 36, 5],
  ];

function A50(n) {
  const e = A2(n);
  if (!(e > Hh)) return;
  const t = e > sC ? 5 : Math.trunc(A2(A2(A2(e - Hh) / A2(sC - Hh)) * a50)),
    [i, r, s] = y50[t];
  return {
    index: t,
    intervalMs: i,
    radius: A2(r),
    particlesPerHalf: s,
    moveSpeed: A2(e * A2(0.25)),
  };
}

class lv {
  constructor(e, t) {
    ((this.random = e),
      (this.texture = t),
      (this.object = b50(t)),
      Ao(this.object));
  }
  random;
  texture;
  object;
  particles = [];
  cameraQuaternion = new s5();
  direction = new H();
  spawnPosition = new H();
  previousUpdateTick;
  lastEmissionTick = 0;
  static async load(e, t) {
    return new lv(t, await M50(e));
  }
  update(e, t, i, r, s) {
    this.copyCameraPose(r);
    const o = Math.trunc(e) >>> 0;
    if (o === this.previousUpdateTick) return;
    this.previousUpdateTick = o;
    const a = s ? A50(t) : void 0;
    if (!a) {
      this.object.geometry.setDrawRange(0, 0);
      return;
    }
    this.lastEmissionTick === 0 && (this.lastEmissionTick = o);
    const c = (o - this.lastEmissionTick) >>> 0;
    (this.moveParticles(c, a.moveSpeed, i),
      c > a.intervalMs &&
        (this.spawnHalf(-qh, qh, a),
        this.spawnHalf(qh, f50, a),
        (this.lastEmissionTick = o)),
      this.writeGeometry());
  }
  reset() {
    this.object.geometry.setDrawRange(0, 0);
  }
  dispose() {
    (this.object.removeFromParent(),
      this.object.geometry.dispose(),
      this.object.material.dispose(),
      this.texture.dispose());
  }
  copyCameraPose(e) {
    (e.getWorldPosition(this.object.position),
      e.getWorldQuaternion(this.object.quaternion),
      this.cameraQuaternion.copy(this.object.quaternion).invert());
  }
  moveParticles(e, t, i) {
    this.direction
      .set(-i.x, -i.y, -i.z)
      .applyQuaternion(this.cameraQuaternion)
      .applyAxisAngle(p50, d50)
      .normalize();
    const r = A2(A2(A2(e) * t) * A2(0.05));
    for (const s of this.particles)
      s.position.set(
        A2(s.position.x + A2(this.direction.x * r)),
        A2(s.position.y + A2(this.direction.y * r)),
        A2(s.position.z + A2(this.direction.z * r)),
      );
  }
  spawnHalf(e, t, i) {
    const r = A2(A2(t - e) / A2(i.particlesPerHalf));
    for (let s = 0; s < i.particlesPerHalf; s += 1) {
      const o = A2(A2(this.random.next() / 32767) * h50),
        a = A2(A2(e + A2(r * s)) + o);
      this.spawnPosition
        .copy(v50)
        .applyAxisAngle(g50, a)
        .multiplyScalar(i.radius);
      const c = i.index < 2 ? this.random.next() & 2 : this.random.next() & 3;
      (this.particles.length === Pk && this.particles.shift(),
        this.particles.push({
          angle: a,
          frame: c,
          position: new H(
            A2(this.spawnPosition.x),
            A2(this.spawnPosition.y),
            A2(this.spawnPosition.z),
          ),
        }));
    }
  }
  writeGeometry() {
    const e = this.object.geometry.getAttribute("position"),
      t = this.object.geometry.getAttribute("uv"),
      i = e.array,
      r = t.array;
    let s = 0;
    for (const o of this.particles) {
      const a = A2(Math.cos(o.angle)),
        c = A2(Math.sin(o.angle)),
        l = A2(A2(o.frame * l50) / u50);
      for (const u of m50) {
        const [h, d, f] = w50[u];
        ((i[s * 3] = A2(A2(A2(h) * a + A2(A2(d) * c)) + o.position.x)),
          (i[s * 3 + 1] = A2(A2(A2(-h) * c + A2(A2(d) * a)) + o.position.y)),
          (i[s * 3 + 2] = A2(A2(f) + o.position.z)),
          (r[s * 2] = u < 2 ? 1 : 0),
          (r[s * 2 + 1] = u === 1 || u === 3 ? l : 0),
          (s += 1));
      }
    }
    ((e.needsUpdate = !0),
      (t.needsUpdate = !0),
      this.object.geometry.setDrawRange(0, s));
  }
}

function b50(n) {
  const e = new d3({
    map: n,
    color: 16777215,
    opacity: 0.6862745098039216,
    transparent: !0,
    depthTest: !0,
    depthWrite: !1,
    side: s1,
    fog: !1,
  });
  ((e.blending = u1),
    (e.blendEquation = R9),
    (e.blendSrc = l1),
    (e.blendDst = v1),
    (e.toneMapped = !1),
    (e.forceSinglePass = !0));
  const t = new t9(),
    i = Pk * c50;
  (t.setAttribute("position", new _0(new Float32Array(i * 3), 3).setUsage(r1)),
    t.setAttribute("uv", new _0(new Float32Array(i * 2), 2).setUsage(r1)),
    t.setDrawRange(0, 0));
  const r = new D2(t, e);
  return ((r.name = "KartRider ReZetAirEffect"), (r.frustumCulled = !1), r);
}

async function M50(n) {
  const e = n.exactCanonicalCandidates(H8);
  if (e.length !== 1)
    throw new Error(`${H8} source 数量应为 1，实际为 ${e.length}。`);
  const t = await p2(await e[0].bytes());
  if (t.width !== 128 || t.height !== 128)
    throw new Error(`${H8} 应为 128x128，实际为 ${t.width}x${t.height}。`);
  const i = new J9(t.pixels, t.width, t.height, e9, _9);
  return (
    (i.name = H8),
    (i.colorSpace = v9),
    (i.flipY = !1),
    (i.wrapS = i.wrapT = S1),
    (i.minFilter = i.magFilter = h9),
    (i.generateMipmaps = !1),
    (i.needsUpdate = !0),
    i
  );
}

function A2(n) {
  return Math.fround(n);
}

const Kh = 4096;

class Fk {
  constructor(e) {
    if (((this.definition = e), e.type !== "MqTacho"))
      throw new Error(`${e.type} 的 P3528 Tachometer Web backend 尚未闭合。`);
  }
  definition;
  scene = new D1();
  camera = new a5();
  textures = new Map();
  smoothTextures = !1;
  materials = new Map();
  pool = [];
  speed = -1;
  gaugeCount = -1;
  width = -1;
  height = -1;
  preserve;
  enableUiSmoothing() {
    this.smoothTextures = !0;
  }
  update(e, t, i, r) {
    const s = Math.trunc(e),
      o = Math.trunc(Math.fround(Math.fround(e) * Math.fround(19 / 350))) >>> 0;
    if (
      s === this.speed &&
      o === this.gaugeCount &&
      t === this.width &&
      i === this.height &&
      r === this.preserve
    )
      return;
    ((this.speed = s),
      (this.gaugeCount = o),
      (this.width = t),
      (this.height = i),
      (this.preserve = r));
    const a = WQ(this.definition, e, t, i, r);
    for (let c = 0; c < a.length; c += 1) {
      const l = a[c],
        u = this.poolEntry(c);
      (this.fillGeometry(u, l),
        (u.mesh.material = this.material(l.texture, t, i)),
        (u.mesh.renderOrder = c),
        (u.mesh.visible = !0));
    }
    for (let c = a.length; c < this.pool.length; c += 1)
      this.pool[c].mesh.visible = !1;
  }
  render(e) {
    const t = e.autoClear;
    e.autoClear = !1;
    try {
      e.render(this.scene, this.camera);
    } finally {
      e.autoClear = t;
    }
  }
  dispose() {
    for (const e of this.pool)
      (e.geometry.dispose(), e.mesh.removeFromParent());
    ((this.pool.length = 0),
      this.materials.forEach((e) => e.dispose()),
      this.textures.forEach((e) => e.dispose()));
  }
  poolEntry(e) {
    let t = this.pool[e];
    if (t) return t;
    const i = new t9(),
      r = new _0(new Float32Array(Kh * 4 * 3), 3),
      s = new _0(new Float32Array(Kh * 4 * 2), 2),
      o = new _0(new Uint16Array(Kh * 6), 1);
    (i.setAttribute("position", r),
      i.setAttribute("uv", s),
      i.setIndex(o),
      (i.boundingSphere = new yr(new H(), 1 / 0)));
    const a = new D2(i);
    return (
      (a.frustumCulled = !1),
      this.scene.add(a),
      (t = { mesh: a, geometry: i, positions: r, uvs: s, indices: o }),
      this.pool.push(t),
      t
    );
  }
  fillGeometry(e, t) {
    const i = e.positions.array,
      r = e.uvs.array,
      s = e.indices.array,
      o = t.kind === "panel" ? 1 : t.framebufferQuads.length;
    for (let a = 0; a < o; a += 1) {
      const c =
          t.kind === "panel"
            ? {
                left: t.framebufferRect.left,
                top: t.framebufferRect.top,
                right: t.framebufferRect.right,
                bottom: t.framebufferRect.bottom,
                u0: t.uv.left,
                v0: t.uv.top,
                u1: t.uv.right,
                v1: t.uv.bottom,
              }
            : t.framebufferQuads[a],
        l = a * 4;
      let u = l * 3;
      ((i[u] = c.left),
        (i[u + 1] = c.top),
        (i[u + 2] = xs),
        (u += 3),
        (i[u] = c.left),
        (i[u + 1] = c.bottom),
        (i[u + 2] = xs),
        (u += 3),
        (i[u] = c.right),
        (i[u + 1] = c.top),
        (i[u + 2] = xs),
        (u += 3),
        (i[u] = c.right),
        (i[u + 1] = c.bottom),
        (i[u + 2] = xs));
      let h = l * 2;
      ((r[h] = c.u0),
        (r[h + 1] = c.v0),
        (h += 2),
        (r[h] = c.u0),
        (r[h + 1] = c.v1),
        (h += 2),
        (r[h] = c.u1),
        (r[h + 1] = c.v0),
        (h += 2),
        (r[h] = c.u1),
        (r[h + 1] = c.v1));
      const d = l;
      let f = a * 6;
      ((s[f] = d),
        (s[f + 1] = d + 1),
        (s[f + 2] = d + 2),
        (s[f + 3] = d + 2),
        (s[f + 4] = d + 1),
        (s[f + 5] = d + 3));
    }
    (e.geometry.setDrawRange(0, o * 6),
      (e.positions.needsUpdate = !0),
      (e.uvs.needsUpdate = !0),
      (e.indices.needsUpdate = !0));
  }
  material(e, t, i) {
    let r = this.materials.get(e);
    if (r) r.uniforms.viewport.value.set(t, i);
    else {
      const s = this.smoothTextures || Co(),
        o = s
          ? OR(UB(new Uint8ClampedArray(e.pixels), e.width, e.height))
          : e.pixels,
        a = new J9(o, e.width, e.height, e9, _9);
      ((a.colorSpace = v9),
        (a.flipY = !1),
        (a.wrapS = a.wrapT = S1),
        (a.magFilter = a.minFilter = s ? u9 : h9),
        (a.generateMipmaps = !1),
        (a.unpackAlignment = 1),
        (a.needsUpdate = !0),
        this.textures.set(e, a),
        (r = x50(a, t, i)),
        this.materials.set(e, r));
    }
    return r;
  }
}

function x50(n, e, t) {
  return new Vt({
    name: "KartRider MqTacho",
    defines: n.magFilter === u9 ? { HUD_ALPHA_WEIGHTED: 1 } : {},
    uniforms: { map: { value: n }, viewport: { value: new B2(e, t) } },
    vertexShader: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform vec2 viewport;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.x * 2.0 / viewport.x - 1.0, 1.0 - position.y * 2.0 / viewport.y, position.z * 2.0 - 1.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(map, vUv);
        #ifdef HUD_ALPHA_WEIGHTED
        gl_FragColor.rgb = gl_FragColor.a > 0.0 ? gl_FragColor.rgb / gl_FragColor.a : vec3(0.0);
        #endif
      }
    `,
    transparent: !0,
    depthTest: !0,
    depthWrite: !0,
    depthFunc: y1,
    blending: u1,
    blendSrc: l1,
    blendDst: v1,
    blendEquation: R9,
    toneMapped: !1,
  });
}

function S50(n) {
  const e = n.stage.children.filter((a) => T(a, "name") === "ScreenUI"),
    t =
      e.length === 1
        ? e[0].children.filter((a) => T(a, "name") === "dashboard")
        : [];
  if (t.length !== 1) throw new Error("经典码表缺少唯一的原 dashboard。");
  const i = (a) => {
      if (
        !["Panel", "CharPanel", "Graduation"].includes(a.name) ||
        T(a, "frame") !== void 0 ||
        T(a, "alphaBlend") !== "true" ||
        T(a, "alphaTest") !== "true"
      )
        throw new Error("经典码表包含未核准的节点、frame 或 alpha 状态。");
      const c = j2(T(a, "clientRect") ?? "", 4, "classic clientRect");
      if (c[2] <= c[0] || c[3] <= c[1])
        throw new Error("经典码表窗口尺寸无效。");
      return {
        ...a,
        attributes: a.attributes
          .filter((l) => l.name !== "alphaTest")
          .map((l) =>
            l.name === "clientRect"
              ? { ...l, name: "windowRect" }
              : l.name === "defaultValue"
                ? { ...l, name: "defaultVal" }
                : l,
          ),
        children: a.children.map(i),
      };
    },
    r = t[0],
    s = i({
      ...r,
      children: r.children.filter((a) => T(a, "name") !== "LucciNum"),
    });
  if (
    s.children.length !== 4 ||
    s.children.filter((a) => T(a, "name") === "kmh").length !== 1 ||
    s.children.filter((a) => T(a, "name") === "hand").length !== 1
  )
    throw new Error("经典码表不符合已核准的普通表节点身份。");
  const o = s.children
    .filter((a) => a.name === "Graduation")
    .map((a) => {
      const c = n.textures.get(T(a, "texture") ?? "");
      if (!c) throw new Error("经典码表指针贴图缺失。");
      return { node: a, layout: WB(a, c) };
    });
  return {
    root: s,
    tree: d5(s, n.textures),
    textures: n.textures,
    graduations: o,
  };
}

function C50(n, e, t, i, r = new O5()) {
  if (!Number.isFinite(e) || t <= 0 || i <= 0 || !Number.isFinite(t + i))
    throw new Error("经典码表速度或视口无效。");
  const s = sw(
      dt(
        r.drawOrder(n.tree, 800, 600, {
          text: (u) =>
            T(u, "name") === "kmh"
              ? Math.trunc(e).toString().padStart(3, "0")
              : void 0,
        }),
        n.textures,
        r,
      ),
      n.textures,
      n.graduations,
      (u) => (T(u, "name") === "hand" ? Math.fround(e) : void 0),
      Qj,
    ),
    o = Math.min(t / 800, i / 600),
    a = t - 800 * o,
    c = i - 600 * o,
    l = (u) => ({
      left: a + u.left * o,
      top: c + u.top * o,
      right: a + u.right * o,
      bottom: c + u.bottom * o,
    });
  return s.map((u) => {
    if (u.kind === "panel" && "framebufferRect" in u)
      return {
        ...u,
        worldRect: l(u.worldRect),
        framebufferRect: l(u.framebufferRect),
      };
    if (u.kind === "char-panel" && "framebufferQuads" in u)
      return {
        ...u,
        worldRect: l(u.worldRect),
        worldQuads: u.worldQuads.map((h) => ({ ...h, ...l(h) })),
        framebufferQuads: u.framebufferQuads.map((h) => ({ ...h, ...l(h) })),
      };
    if (u.kind === "graduation" && "framebufferPositions" in u) {
      const h = (d) => d.map((f, p) => f * o + (p % 2 === 0 ? a : c));
      return {
        ...u,
        worldRect: l(u.worldRect),
        worldPositions: h(u.worldPositions),
        framebufferPositions: h(u.framebufferPositions),
      };
    }
    throw new Error("经典码表含未闭合的绘制 payload。");
  });
}

class uv {
  constructor(e) {
    ((this.definition = e), this.enableUiSmoothing());
  }
  definition;
  renderer = new fn(new Map(), 0);
  cache = new O5();
  disposed = !1;
  speed = NaN;
  width = 0;
  height = 0;
  static async load() {
    return new uv(S50(await vJ()));
  }
  enableUiSmoothing() {
    this.renderer.enableUiSmoothing();
  }
  update(e, t, i, r) {
    if (
      this.disposed ||
      ((e = Math.fround(e)),
      e === this.speed && t === this.width && i === this.height)
    )
      return;
    const s = C50(this.definition, e, t, i, this.cache);
    ((this.speed = e),
      (this.width = t),
      (this.height = i),
      this.renderer.update(s, 0));
  }
  render(e, t, i) {
    this.disposed || this.renderer.render(e, t, i);
  }
  dispose() {
    this.disposed || ((this.disposed = !0), this.renderer.dispose());
  }
}

function E50(n, e, t, i) {
  return (
    n &&
    i === "p3553" &&
    Number.isInteger(e) &&
    e >= 1 &&
    e <= 5 &&
    t.type === "MqTacho" &&
    (t.folder === "" || t.folder === "ht")
  );
}

class T50 {
  anchorMs = 0;
  sideEffectVisible = !1;
  update(e) {
    if (!Number.isInteger(e.tickMs) || e.tickMs < 0 || e.tickMs > 4294967295)
      throw new Error(`P3528 Nine tick=${e.tickMs} 无效。`);
    if (
      !Number.isFinite(e.displaySpeed) ||
      e.displaySpeed < 0 ||
      !Number.isFinite(e.autoChargeLowSpeed) ||
      e.autoChargeLowSpeed < 0
    )
      throw new Error("P3528 Nine speed/autoChargeLowSpeed 无效。");
    const t = e.tickMs >>> 0,
      i = e.displaySpeed >= e.autoChargeLowSpeed;
    i && this.anchorMs === 0 && (this.anchorMs = t);
    const r = {
      draftOn: e.draftOn === !0,
      incGaugeOn: e.incGauge,
      kmh: !i,
      kmh2: i,
    };
    let s = [];
    if (!i)
      ((this.anchorMs = 0),
        Object.assign(r, {
          bg2: !1,
          transformerFace: !1,
          sideBar: !1,
          sideEffect: !1,
          side1: !1,
          side2: !1,
          side3: !1,
          side4: !1,
          side5: !1,
        }),
        (this.sideEffectVisible = !1));
    else if (this.anchorMs !== 0) {
      const o =
        t < (this.anchorMs + 100) >>> 0
          ? 1
          : t < (this.anchorMs + 200) >>> 0
            ? 2
            : t < (this.anchorMs + 300) >>> 0
              ? 3
              : t < (this.anchorMs + 400) >>> 0
                ? 4
                : 5;
      for (let a = 1; a <= 5; a += 1) r[`side${a}`] = a === o;
      o === 5 &&
        ((r.bg2 = r.transformerFace = r.sideEffect = !0),
        this.sideEffectVisible ||
          (s = [{ name: "sideEffect", durationMs: 0, sourceTickMs: 0 }]),
        (this.sideEffectVisible = !0));
    }
    return {
      visibility: r,
      text: {
        [i ? "kmh2" : "kmh"]: Math.trunc(e.displaySpeed)
          .toString()
          .padStart(3, "0"),
      },
      play: s,
    };
  }
}

function _50(n, e, t) {
  const i = new Map();
  for (const r of e) {
    const s = T(r.node, "name");
    if (s) {
      if (i.has(s)) throw new Error(`XGen Graduation ${s} 重复。`);
      i.set(s, r);
    }
  }
  return {
    individual: cC(n, i, t, "indi", 500),
    team: cC(n, i, t, "team", 1e3),
    alarmBlinkTimeMs: G50(n),
  };
}

function G50(n) {
  const e = hv(n, "alarmBlinkTime", 100);
  if (!Number.isFinite(e) || e < 0)
    throw new Error(`XGen alarmBlinkTime=${e} 无效。`);
  return e;
}

function jh(n) {
  return {
    active: !1,
    startedAtMs: 0,
    previousValue: 0,
    barValue: n.bar.defaultValue,
    gaugeValue: n.gauge.defaultValue,
    gaugeVisible: n.gaugeInitiallyVisible,
    fullFrameVisible: n.fullFrame.initiallyVisible,
    fullFrameAlpha: void 0,
    masks: n.masks.map((e) => ({ value: e.defaultValue, visible: !0 })),
  };
}

function Ei(n, e, t) {
  if (e.active) return e;
  const i = U9(U9(t) * U9(n.degree)),
    r = U9(U9(n.degree) / U9(n.masks.length));
  return {
    ...e,
    previousValue: i,
    barValue: i,
    masks: e.masks.map((s, o) => ({
      value: i,
      visible:
        i >= U9(U9(U9(n.masks.length - o) * r) + U9(10)) && o !== 0
          ? !1
          : e.previousValue > i
            ? !0
            : s.visible,
    })),
  };
}

function B50(n, e, t, i) {
  if (t === "indiBoostBar") return { value: n.barValue, visible: !0 };
  const r = /^(indi|team)BoostMask([1-9][0-9]*)$/.exec(t);
  if (t === "teamBoostBar") return { value: e.barValue, visible: i };
  if (!r) return;
  const s = r[1] === "team",
    o = (s ? e : n).masks[Number(r[2]) - 1];
  if (o !== void 0)
    return { value: o.value, visible: s ? i && o.visible : o.visible };
}

function oC(n, e) {
  return {
    ...e,
    active: !0,
    startedAtMs: 0,
    masks: e.masks.map((t, i) => ({
      ...t,
      visible:
        t.value > U9(U9(n.masks.length - i) * U9(n.maskMaximum))
          ? !1
          : t.visible,
    })),
  };
}

function aC(n, e, t) {
  if (!e.active) return e;
  const i = t >>> 0,
    r = e.startedAtMs || i,
    s = (i - r) >>> 0;
  if (s >= n.fullLengthMs)
    return {
      ...Ei(n, { ...e, active: !1 }, 0),
      startedAtMs: 0,
      fullFrameVisible: !1,
      barValue: n.maskMinimum,
      masks: n.masks.map(() => ({ value: n.maskMinimum, visible: !0 })),
    };
  const o = U9(U9(1) - U9(U9(s) / U9(n.fullLengthMs))),
    a = Math.max(0, o),
    c = U9(U9(a) * U9(n.degree)),
    l = U9(U9(n.degree) / U9(n.masks.length));
  return {
    ...e,
    startedAtMs: r,
    previousValue: c,
    barValue: c,
    fullFrameVisible: !0,
    fullFrameAlpha: vg(s),
    masks: e.masks.map((u, h) => ({
      value: c,
      visible:
        U9(U9(n.masks.length - h) * l) >= c && a !== 1 && h !== 0
          ? !0
          : u.visible,
    })),
  };
}

function vg(n) {
  if (!Number.isInteger(n) || n < 0 || n >= uC.length)
    throw new Error(
      "XGen FullFrame alpha elapsed 必须在 P3528 drain 域 0..999。",
    );
  return uC[n];
}

function cC(n, e, t, i, r) {
  const s = hv(n, `${i}GaugeDegree`, 360),
    o = lC(n, `${i}GaugeFullLenth`, r),
    a = lC(n, `${i}BoostMaskCount`, 3);
  if (a === 0) throw new Error(`${i}BoostMaskCount 必须大于 0。`);
  const c = (d) => {
      const f = e.get(d);
      if (!f) throw new Error(`XGen gauge 缺少 ${d} Graduation。`);
      return f;
    },
    l = c(`${i}BoostBar`),
    u = c(`${i}BoostGauge`),
    h = Array.from({ length: a }, (d, f) => c(`${i}BoostMask${f + 1}`).layout);
  return {
    degree: s,
    fullLengthMs: o,
    bar: l.layout,
    gauge: u.layout,
    fullFrame: R50(n, t, `${i}BoostFullFrame`),
    gaugeInitiallyVisible: Dk(u.node, "visible", !0),
    masks: h,
    maskMinimum: h[0].minValue,
    maskMaximum: h[0].maxValue,
  };
}

function R50(n, e, t) {
  const i = [],
    r = (c) => {
      (T(c, "name") === t && i.push(c), c.children.forEach(r));
    };
  if ((r(n), i.length !== 1 || i[0].name !== "Panel"))
    throw new Error(`XGen gauge ${t} Panel 数量必须为 1。`);
  const s = i[0],
    o = T(s, "texture"),
    a = o === void 0 ? void 0 : e.get(o);
  if (!a || o === void 0)
    throw new Error(`XGen gauge ${t} 缺少已解析 texture。`);
  return {
    node: s,
    geometry: lt(s, e),
    textureName: o,
    texture: a,
    initiallyVisible: Dk(s, "visible", !0),
  };
}

function hv(n, e, t) {
  const i = T(n, e);
  return i === void 0 ? t : j2(i, 1, e)[0];
}

function lC(n, e, t) {
  const i = hv(n, e, t);
  if (!Number.isInteger(i) || i < 0 || i > 4294967295)
    throw new Error(`${e} 不是 P3528 u32。`);
  return i;
}

function Dk(n, e, t) {
  const i = T(n, e);
  if (i === void 0) return t;
  if (i === "true") return !0;
  if (i === "false") return !1;
  throw new Error(`${e} 不是 P3528 boolean。`);
}

const U9 = Math.fround,
  uC = Uint8Array.from(
    atob(
      "AAECAwUGBwgKCwwODxARExQVFhgZGhsdHh8hIiMkJicoKSssLS4wMTIzNTY3ODo7PD0/QEFCREVGR0hKS0xNT1BRUlNVVldYWVtcXV5fYGJjZGVmZ2lqa2xtbnBxcnN0dXZ4eXp7fH1+f4CCg4SFhoeIiYqLjI2Oj5GSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqqqusra6vsLGys7S1tra3uLm6u7y9vb6/wMHCwsPExcbGx8jJysrLzM3Nzs/Q0NHS09PU1dXW19fY2dna29vc3d3e39/g4OHi4uPj5OTl5ubn5+jo6enq6uvr7Ozt7e7u7+/v8PDx8fHy8vPz8/T09fX19vb29/f39/j4+Pn5+fn6+vr6+/v7+/v8/Pz8/Pz9/f39/f39/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v79/f39/f39/fz8/Pz8+/v7+/v6+vr6+fn5+fj4+Pj39/f29vb19fX09PTz8/Ly8vHx8PDw7+/u7u3t7Ozr6+rq6eno6Ofn5ubl5eTk4+Li4eHg39/e3t3c3Nva2tnY2NfW1tXU1NPS0dHQz87OzczLy8rJyMjHxsXEw8PCwcC/v769vLu6ubi4t7a1tLOysbCvr66trKuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPjo2Mi4mIh4aFhIOCgYB/fXx7enl4d3Z0c3JxcG9ubGtqaWhnZmRjYmFgXl1cW1pZV1ZVVFNRUE9OTEtKSUhGRURDQUA/Pj07Ojk4NjU0MzEwLy4sKyopJyYlIyIhIB4dHBsZGBcWFBMSEA8ODQsKCQgGBQQCAQAAAgMEBQcICQsMDQ4QERITFRYXGRobHB4fICEjJCUmKCkqKy0uLzEyMzQ2Nzg5Ojw9Pj9BQkNERkdISUpMTU5PUVJTVFVXWFlaW11eX2BhYmRlZmdoaWtsbW5vcHFzdHV2d3h5e3x9fn+AgYKDhIaHiImKi4yNjo+QkZKTlJWWl5iZm5ydnp+goaKio6SlpqeoqaqrrK2ur7CxsrOztLW2t7i5uru7vL2+v8DAwcLDxMXFxsfIycnKy8zMzc7Pz9DR0tLT1NTV1tfX2NnZ2tvb3Nzd3t7f4ODh4eLj4+Tk5eXm5ufo6Onp6urr6+zs7e3t7u7v7/Dw8fHx8vLz8/P09PT19fX29vb39/f4+Pj4+fn5+vr6+vr7+/v7/Pz8/Pz8/f39/f39/f7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v39/f39/f38/Pz8/Pz7+/v7+vr6+vr5+fn4+Pj49/f39vb29fX19A==",
    ),
    (n) => n.charCodeAt(0),
  );

async function I50(n, e) {
  const t = [],
    i = (r) => {
      (r.name === "BlinkButton" && t.push(r), r.children.forEach(i));
    };
  return (
    i(n),
    Promise.all(
      t.map(async (r) => {
        const s = T(r, "autoLoadImage");
        if (s === void 0)
          throw new Error("BlinkButton 缺少已闭合的 P3528 autoLoadImage。");
        const o = yg(r, "hasDisable", !1),
          a = [`${s}1`, `${s}2`, `${s}3`, `${s}4`, `${s}5`],
          c = await Promise.all(
            a.map((l, u) => (u === 3 && !o ? void 0 : D50(l, e))),
          );
        return {
          node: r,
          name: T(r, "name") ?? "",
          blinkGapMs: V50(r, "blinkGap", 500),
          autoStart: yg(r, "autoStart", !1),
          states: [c[0], c[1], c[2], c[3]],
          blink: c[4],
        };
      }),
    )
  );
}

function k50(n) {
  return {
    buttonState: 0,
    blinking: n.autoStart,
    blinkFrame: !1,
    lastBlinkAtMs: 0,
    needsRebuild: !0,
    image: n.states[0],
  };
}

function L50(n, e) {
  return { ...n, blinking: e, blinkFrame: !1, needsRebuild: !0 };
}

function P50(n, e, t) {
  const i = t >>> 0,
    s =
      e.blinking &&
      e.buttonState === 0 &&
      (i - e.lastBlinkAtMs) >>> 0 > n.blinkGapMs
        ? {
            ...e,
            blinkFrame: !e.blinkFrame,
            lastBlinkAtMs: i,
            needsRebuild: !0,
          }
        : e;
  if (!s.needsRebuild) return s;
  const o = n.states[s.buttonState];
  return {
    ...s,
    needsRebuild: !1,
    image:
      o === void 0 ? s.image : s.blinkFrame && n.blink !== void 0 ? n.blink : o,
  };
}

function F50(n, e, t, i) {
  if (n.name !== "resetting")
    throw new Error(`P3528 collision BlinkButton ${n.name} 未闭合。`);
  const r = e ?? { visible: yg(n.node, "visible", !0), button: k50(n) },
    s = i,
    o = P50(n, s === r.visible ? r.button : L50(r.button, s), t);
  return { visible: s, button: o };
}

async function D50(n, e) {
  const t = await e(n);
  return t === void 0 ? void 0 : { name: n, texture: t };
}

function yg(n, e, t) {
  const i = T(n, e);
  if (i === void 0) return t;
  if (i === "true") return !0;
  if (i === "false") return !1;
  throw new Error(`${n.name}.${e} 不是 P3528 boolean。`);
}

function V50(n, e, t) {
  const i = T(n, e);
  if (i === void 0) return t;
  if (!/^\d+$/.test(i)) throw new Error(`${n.name}.${e} 不是 P3528 u32。`);
  const r = Number(i);
  if (!Number.isSafeInteger(r) || r > 4294967295)
    throw new Error(`${n.name}.${e} 不是 P3528 u32。`);
  return r;
}

const N50 = new Set([
  "MqTacho",
  "NineTacho",
  "Tacho1",
  "V1GenTacho",
  "XGenTacho",
  "XunGenTacho",
]);

function O50(n, e, t) {
  if (!Number.isInteger(t) || t < 0 || t > 65535)
    throw new Error(`engineGrade=${t} 不能作为 P3528 u16 kart generation。`);
  let i = n;
  if (
    ((!i || e === "ht") &&
      (i =
        t === 7
          ? "XGenTacho"
          : t === 8
            ? "V1GenTacho"
            : t === 9
              ? "XunGenTacho"
              : "MqTacho"),
    !N50.has(i))
  )
    throw new Error(`P3528 Tachometer registry 不包含 ${i || "<empty>"}。`);
  return {
    type: i,
    folder:
      e ||
      (i === "XGenTacho"
        ? "dual"
        : i === "V1GenTacho"
          ? "v1"
          : i === "XunGenTacho"
            ? "xun"
            : ""),
  };
}

function dv(n) {
  if (n.includes("디셉티콘"))
    return { background: "decepticonFace_1", face: "decepticonFace_2" };
  if (n.includes("오토봇") || n.includes("nine_lodi"))
    return { background: "autobotFace_1", face: "autobotFace_2" };
}

function z50(n) {
  return n.type === "MqTacho"
    ? `stage_/speedIndiGame/tachometer${n.folder === "디셉티콘" || n.folder === "오토봇" ? n.folder : ""}.bml`
    : `gui_/tachometer/${U50(n)}/tacho.bml`;
}

function U50(n) {
  return n.type !== "NineTacho"
    ? n.folder
    : n.folder === "nine디셉티콘" || n.folder === "nine오토봇"
      ? "nine"
      : n.folder;
}

async function $50(n, e) {
  const t = z50(e),
    i = n.canonicalCandidates(t);
  if (i.length !== 1)
    throw new Error(`${t} source 数量必须为 1，实际 ${i.length}。`);
  const r = s2(await i[0].bytes()),
    s = new Set(),
    o = {},
    a = (p) => {
      const v = T(p, "texture");
      v && s.add(v);
      const w = T(p, "name");
      ((w === "boostFeatures" ||
        w === "collisionFeatures" ||
        w === "exceedFeatures") &&
        (o[w] = !0),
        w === "incCharger_none" &&
          v?.endsWith("_none") &&
          s.add(v.slice(0, -5)),
        p.children.forEach(a));
    };
  a(r);
  const c = e.type === "NineTacho" ? dv(e.folder) : void 0;
  c && (s.add(c.background), s.add(c.face));
  const l = new Map(
      await Promise.all(
        [...s].map(async (p) => [p, await p2(await W50(n, t, p).bytes())]),
      ),
    ),
    u = [],
    h = (p) => {
      if (p.name === "Graduation") {
        const v = T(p, "texture"),
          w = v === void 0 ? void 0 : l.get(v);
        if (!w) throw new Error("Graduation 缺少已解析的 P3528 texture。");
        u.push({ node: p, layout: WB(p, w) });
      }
      p.children.forEach(h);
    };
  h(r);
  const d = await I50(r, async (p) => {
      const v = t.lastIndexOf("/"),
        w = `${t.slice(0, v + 1)}${p}.png`,
        g = n.canonicalCandidates(w);
      if (g.length > 1)
        throw new Error(`${w} source 数量最多为 1，实际 ${g.length}。`);
      return g[0] === void 0 ? void 0 : p2(await g[0].bytes());
    }),
    f = await sX(r, async (p) => {
      const v = t.lastIndexOf("/"),
        w = `${t.slice(0, v + 1)}${p}.1s`,
        g = n.canonicalCandidates(w);
      if (g.length !== 1)
        throw new Error(`${w} source 数量必须为 1，实际 ${g.length}。`);
      return {
        scene: y9(await g[0].bytes()),
        canonicalPath: g[0].canonicalPath ?? g[0].virtualPath,
      };
    });
  return {
    ...e,
    canonicalPath: t,
    root: r,
    textures: l,
    windowTree: d5(r, l),
    graduations: u,
    xGenGauges: e.type === "XGenTacho" ? _50(r, u, l) : void 0,
    blinkButtons: d,
    play1SPanels:
      e.type === "XGenTacho"
        ? f.map((p) =>
            ["xgen_bg1", "xgen_bg2", "xgen_bg3"].includes(p.name)
              ? { ...p, clearZBefore: !0, clearZAfter: !0 }
              : p,
          )
        : f,
    featureBindings: o,
  };
}

function W50(n, e, t) {
  const i = e.lastIndexOf("/"),
    r = i < 0 ? "" : e.slice(0, i + 1);
  let s = n.canonicalCandidates(`${r}${t}.png`);
  if (
    (s.length === 0 &&
      t === "aw_02@zz" &&
      (s = n.canonicalCandidates("stage_/common/aw_02@zz.png")),
    s.length !== 1)
  )
    throw new Error(
      `${e} texture ${t} source 数量必须为 1，实际 ${s.length}。`,
    );
  return s[0];
}

class p7 {
  constructor(e, t, i) {
    ((this.definition = e),
      (this.nodes = t),
      (this.runtimes = i),
      (this.renderer = new fn(i)));
  }
  definition;
  nodes;
  runtimes;
  presentation = new T50();
  renderer;
  enableUiSmoothing() {
    this.renderer.enableUiSmoothing();
  }
  static async load(e, t, i, r) {
    if (e.type !== "NineTacho")
      throw new Error(`${e.type} 不能使用 P3528 Nine renderer。`);
    if (!["nine", "nine_lodi", "nine디셉티콘", "nine오토봇"].includes(e.folder))
      throw new Error(`P3528 Nine folder ${e.folder} 尚未闭合。`);
    const s = K50(e),
      o = new Map();
    try {
      for (const a of e.play1SPanels) {
        const c = await Rw(a, t, r);
        o.set(a.node, new Iw(a, c, i));
      }
      return new p7(e, s, o);
    } catch (a) {
      throw (o.forEach((c) => c.dispose()), a);
    }
  }
  update(e, t, i, r, s, o, a = !1) {
    const c = e.timeAttackTachometerSpeed(),
      l = this.presentation.update({
        tickMs: t,
        displaySpeed: c.displaySpeed,
        autoChargeLowSpeed: c.layerThreshold,
        incGauge: e.timeAttackTachometerIncGauge(),
        draftOn: a,
      });
    (l.play.forEach((u) =>
      this.runtime(u.name).play(u.durationMs, u.sourceTickMs, i),
    ),
      this.renderer.update(H50(this.definition, this.nodes, l, r, s, o), i));
  }
  render(e, t, i) {
    this.renderer.render(e, t, i);
  }
  dispose() {
    this.renderer.dispose();
  }
  runtime(e) {
    const t = this.definition.play1SPanels.find((r) => r.name === e),
      i = t === void 0 ? void 0 : this.runtimes.get(t.node);
    if (!i) throw new Error(`P3528 ${e} Play1S runtime 缺失。`);
    return i;
  }
}

function H50(n, e, t, i, r, s) {
  const o = (u) => T(u, "name"),
    a = dv(n.folder),
    c = dn(n.windowTree, i, r, {
      visibility: (u) => {
        const h = o(u);
        return h === "bgpOn" && s !== void 0
          ? s
          : u === e.draftOn
            ? t.visibility.draftOn
            : u === e.incGaugeOn
              ? t.visibility.incGaugeOn
              : u === e.faceBackground && a === void 0
                ? !1
                : h === void 0
                  ? void 0
                  : t.visibility[h];
      },
      text: (u) => {
        const h = o(u);
        return h === void 0 ? void 0 : t.text[h];
      },
    }),
    l = q50(dt(c, n.textures), n, e);
  return ow(l, n.play1SPanels);
}

function q50(n, e, t) {
  const i = dv(e.folder);
  return i
    ? n.map((r) => {
        if (r.kind !== "panel") return r;
        const s =
          r.node === t.faceBackground
            ? i.background
            : r.node === t.face
              ? i.face
              : void 0;
        if (!s) return r;
        const o = e.textures.get(s);
        if (!o) throw new Error(`P3528 Nine face texture ${s} 缺失。`);
        return { ...r, textureName: s, texture: o };
      })
    : n;
}

function K50(n) {
  const e = hC(n.root, "dashboard"),
    t = rs(e, "draft"),
    i = rs(e, "incGauge"),
    r = hC(n.root, "transformerFaceBg");
  return {
    draftOn: rs(t, "on"),
    incGaugeOn: rs(i, "on"),
    faceBackground: r,
    face: rs(r, "transformerFace"),
  };
}

function hC(n, e) {
  const t = [],
    i = (r) => {
      (T(r, "name") === e && t.push(r), r.children.forEach(i));
    };
  if ((i(n), t.length !== 1))
    throw new Error(`P3528 Nine ${e} node 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

function rs(n, e) {
  const t = n.children.filter((i) => T(i, "name") === e);
  if (t.length !== 1)
    throw new Error(`P3528 Nine ${e} child 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

const dC = E2(0.8240000009536743),
  fC = E2(0.20000000298023224),
  Xh = E2(0.02500000037252903),
  j50 = E2(1),
  pC = E2(j50 * E2(25)),
  Yh = E2(1.25);

class fr {
  constructor(e, t, i, r) {
    ((this.rectangle = e), (this.rootAnchor = t), (this.configuredEnabled = r));
    const s = new t9();
    (s.setAttribute("position", new _0(this.positions, 3).setUsage(r1)),
      s.setAttribute("uv", new M1([0, 0, 1, 0, 0, 1, 1, 1], 2)),
      s.setIndex([0, 1, 2, 2, 1, 3]));
    const o = new d3({
      map: i ?? null,
      color: 16777215,
      transparent: !0,
      alphaTest: 1 / 255,
      depthTest: !0,
      depthWrite: !1,
      depthFunc: y1,
      side: s1,
      fog: !1,
    });
    ((o.blending = u1),
      (o.blendEquation = R9),
      (o.blendSrc = l1),
      (o.blendDst = v1),
      (o.toneMapped = !1),
      (o.forceSinglePass = !0),
      (this.object = new D2(s, o)),
      (this.object.name = "__kartSimpleShadow__"),
      (this.object.visible = !1),
      (this.object.frustumCulled = !1),
      ca(this.object, 2e3));
  }
  rectangle;
  rootAnchor;
  configuredEnabled;
  object;
  positions = new Float32Array(12);
  static async load(e, t, i, r) {
    if (!r) return new fr(t, i, void 0, !1);
    if (!e) throw new Error("车辆缺少 shadow.png。");
    const s = e.canonicalPath ?? e.virtualPath,
      o = await p2(await e.bytes());
    if (o.width !== 64 || o.height !== 64)
      throw new Error(`${s} 应为 64x64，实际为 ${o.width}x${o.height}。`);
    const a = new J9(X50(o.pixels), o.width, o.height, e9, _9);
    return (
      (a.name = s),
      (a.colorSpace = v9),
      (a.flipY = !1),
      (a.wrapS = F1),
      (a.wrapT = F1),
      (a.minFilter = h9),
      (a.magFilter = u9),
      (a.generateMipmaps = !1),
      (a.needsUpdate = !0),
      new fr(t, i, a, r)
    );
  }
  update(e, t) {
    if (!this.configuredEnabled || !t) {
      this.hide();
      return;
    }
    if (
      (this.rootAnchor.updateWorldMatrix(!0, !1),
      !Y50(this.positions, this.rectangle, this.rootAnchor.matrixWorld, e))
    ) {
      this.hide();
      return;
    }
    ((this.object.geometry.getAttribute("position").needsUpdate = !0),
      (this.object.visible = !0));
  }
  hide() {
    this.object.visible = !1;
  }
  dispose() {
    (this.object.removeFromParent(),
      this.object.geometry.dispose(),
      this.object.material.map?.dispose(),
      this.object.material.dispose());
  }
}

function X50(n) {
  const e = new Uint8Array(n.length);
  for (let t = 0; t < n.length; t += 4) {
    const i = ((255 - n[t + 1]) >> 4) * 17;
    e.set([34, 34, 34, i], t);
  }
  return e;
}

function Y50(n, e, t, i) {
  const [r, s, o, a] = e,
    c = [
      [r, s],
      [o, s],
      [r, a],
      [o, a],
    ],
    l = [];
  for (const [h, d] of c) {
    const f = gC(E2(h * dC), E2(d * dC), E2(0.5), t),
      p = gC(E2(h * fC), E2(d * fC), E2(-20), t),
      v = i.rayQuery(f, Z50(p, f), !1);
    if (!v) return !1;
    l.push(Q50(v.point, v.normal));
  }
  if (mC(l[0], l[2]) > pC || mC(l[1], l[3]) > pC) return !1;
  const u = J50(l);
  for (let h = 0; h < 4; h += 1) {
    const d = l[h],
      f = h * 3;
    ((n[f] = E2(u.x + E2(E2(d.x - u.x) * Yh))),
      (n[f + 1] = E2(u.y + E2(E2(d.y - u.y) * Yh))),
      (n[f + 2] = E2(u.z + E2(E2(d.z - u.z) * Yh))));
  }
  return !0;
}

function gC(n, e, t, i) {
  const r = i.elements,
    s = (o) =>
      E2(
        E2(E2(E2(r[o] * n) + E2(r[o + 4] * e)) + E2(r[o + 8] * t)) + r[o + 12],
      );
  return { x: s(0), y: s(1), z: s(2) };
}

function Z50(n, e) {
  return { x: E2(n.x - e.x), y: E2(n.y - e.y), z: E2(n.z - e.z) };
}

function Q50(n, e) {
  return {
    x: E2(n.x + E2(e.x * Xh)),
    y: E2(n.y + E2(e.y * Xh)),
    z: E2(n.z + E2(e.z * Xh)),
  };
}

function mC(n, e) {
  const t = E2(n.x - e.x),
    i = E2(n.y - e.y),
    r = E2(n.z - e.z);
  return E2(E2(t * t) + E2(E2(i * i) + E2(r * r)));
}

function J50(n) {
  const e = (t) =>
    E2(E2(E2(E2(n[0][t] + n[1][t]) + n[2][t]) + n[3][t]) * E2(0.25));
  return { x: e("x"), y: e("y"), z: e("z") };
}

function E2(n) {
  return Math.fround(n);
}

const g7 = [2, 0, 4, 2],
  en0 = [0, 0, 2, 2],
  tn0 = [0, 3, 2, 5],
  Vk = [0, 1, 2, 3];

function nn0() {
  return {
    mode: 0,
    value: 0,
    rect: g7,
    boostOn: !1,
    durationMs: 0,
    enteredAtMs: 0,
    pulseAtMs: 0,
  };
}

function in0(n, e) {
  const t = n.value < 10;
  return {
    ...n,
    mode: 0,
    value: t ? 0 : n.value,
    rect: t ? g7 : n.rect,
    boostOn: !1,
    durationMs: 0,
    enteredAtMs: e >>> 0,
  };
}

function rn0(n, e, t, i, r) {
  const s = e >>> 0,
    o = t >>> 0;
  let a =
    r === void 0
      ? n
      : {
          mode: 1,
          value: O1(300),
          rect: Vk,
          boostOn: n.boostOn,
          durationMs: r >>> 0,
          enteredAtMs: o,
          pulseAtMs: o,
        };
  if (a.mode === 1) {
    (s - a.pulseAtMs) >>> 0 > 60 &&
      (a = { ...a, boostOn: !a.boostOn, pulseAtMs: s });
    const c = vC(a.value, 0);
    ((a = { ...a, value: c < 10 ? 0 : c, rect: yC(c, !1) }),
      i === 2 && (a = { ...a, mode: 2, boostOn: !0, enteredAtMs: o }));
  } else if (a.mode === 2)
    (s - a.enteredAtMs) >>> 0 > a.durationMs &&
      ((a = { ...a, mode: 0, boostOn: !1, enteredAtMs: s }),
      a.value < 10 && (a = { ...a, value: 0, rect: g7 }));
  else if (a.value < 300) {
    const c = vC(a.value, 300),
      l = c >= 280 ? 300 : c;
    a = { ...a, value: l, rect: yC(l, !0) };
  }
  return a;
}

class fv {
  constructor(e) {
    if (((this.definition = e), e.type !== "Tacho1"))
      throw new Error(`${e.type} 不能使用 P3528 Tacho1 renderer。`);
  }
  definition;
  renderer = new fn(new Map());
  enableUiSmoothing() {
    this.renderer.enableUiSmoothing();
  }
  drawCache = new O5();
  state = nn0();
  update(e, t, i, r, s, o, a, c) {
    ((this.state = rn0(this.state, i, r, t, c)),
      this.renderer.update(
        sn0(this.definition, this.state, e, s, o, a, this.drawCache),
        i,
      ));
  }
  resetMode(e) {
    this.state = in0(this.state, e);
  }
  render(e, t, i) {
    this.renderer.render(e, t, i);
  }
  dispose() {
    this.renderer.dispose();
  }
}

function sn0(n, e, t, i, r, s, o) {
  const a = (u) => T(u, "name"),
    c = {
      visibility: (u) => {
        const h = a(u);
        return h === "bgpOn" && s !== void 0
          ? s
          : h === "boost_Off"
            ? !e.boostOn
            : h === "boost_On"
              ? e.boostOn
              : void 0;
      },
      text: (u) =>
        a(u) === "kmh"
          ? Math.trunc(t).toString().padStart(3, "0")
          : T(u, "text"),
    };
  let l = dt(
    o === void 0
      ? dn(n.windowTree, i, r, c)
      : o.drawOrder(n.windowTree, i, r, c),
    n.textures,
    o,
  );
  return (
    (l = sw(l, n.textures, on0(n, e, a), (u) =>
      a(u) === "boostHand" ? e.value : a(u) === "hand" ? t : void 0,
    )),
    l
  );
}

const wC = new WeakMap();

function on0(n, e, t) {
  const i = wC.get(n);
  if (i !== void 0 && i.rect === e.rect) return i.bindings;
  const r = n.graduations.map((s) => ({
    ...s,
    layout:
      t(s.node) === "boostHand"
        ? an0(s.layout, e.rect, n.textures.get(T(s.node, "texture")))
        : s.layout,
  }));
  return (wC.set(n, { rect: e.rect, bindings: r }), r);
}

function an0(n, e, t) {
  return {
    ...n,
    uv: {
      left: O1(O1(e[0]) / O1(t.width)),
      top: O1(O1(e[1]) / O1(t.height)),
      right: O1(O1(e[2]) / O1(t.width)),
      bottom: O1(O1(e[3]) / O1(t.height)),
    },
  };
}

function vC(n, e) {
  return O1(O1(O1(e - n) * O1(0.25)) + n);
}

function yC(n, e) {
  return n > 300 || (e && n === 300) ? Vk : n > 180 ? tn0 : n > 90 ? en0 : g7;
}

const O1 = Math.fround;





















class gn0 extends V1TachometerPresentation { constructor(definition, seed) { super(definition, seed, v1TachometerOps); } }



function Ok(n, e, t) {
  const i = T(n, "name");
  (i && (e.add(i), t.set(i, T(n, "visible") !== "false")),
    n.children.forEach((r) => Ok(r, e, t)));
}

const mn0 = ["instAccelGauge", "instAccelGaugeUsable", "instAccelGaugeOn"];

class Ta {
  constructor(e, t, i) {
    ((this.definition = e),
      (this.runtimes = t),
      (this.presentation = new gn0(e, i)),
      (this.renderer = new fn(t)));
  }
  definition;
  runtimes;
  presentation;
  renderer;
  enableUiSmoothing() {
    this.renderer.enableUiSmoothing();
  }
  drawCache = new O5();
  static async load(e, t, i, r) {
    if (e.type !== "V1GenTacho" && e.type !== "XunGenTacho")
      throw new Error(`${e.type} 不能使用 P3528 V1/Xun renderer。`);
    const s = new Map();
    try {
      for (const o of e.play1SPanels) {
        const a = await Rw(o, t, r);
        s.set(o.node, new Iw(o, a, i));
      }
      return new Ta(e, s, i);
    } catch (o) {
      throw (s.forEach((a) => a.dispose()), o);
    }
  }
  update(e, t, i, r, s, o, a, c = !1) {
    const l = this.presentation.update({
      frameTickMs: t,
      wallClockMs: i,
      sourceTickMs: r,
      stateCode: e.driveCameraRuntime().stateCode,
      speed: e.timeAttackTachometerSpeed(),
      gauges: e.timeAttackTachometerGauges(),
      collision: e.timeAttackTachometerCollision(),
      exceed: e.timeAttackTachometerExceed(),
      incGauge: e.timeAttackTachometerIncGauge(),
      draftOn: c,
      boosterUnlimited: Mn0(e.timeAttackTachometerDriftMaxGauge()),
      charger: e.timeAttackTachometerCharger(),
      teamSettledAtMs: e.timeAttackTeamGaugeSettledAtMs(),
    });
    (l.play.forEach((u) =>
      this.runtime(u.name).play(u.durationMs, u.sourceTickMs, i),
    ),
      this.renderer.update(
        wn0(this.definition, l, s, o, a, this.drawCache),
        i,
      ));
  }
  render(e, t, i) {
    this.renderer.render(e, t, i);
  }
  dispose() {
    this.renderer.dispose();
  }
  startMainGaugeDrain() {
    this.presentation.startMainGaugeDrain();
  }
  runtime(e) {
    const t = this.definition.play1SPanels.find((r) => r.name === e),
      i = t === void 0 ? void 0 : this.runtimes.get(t.node);
    if (!i) throw new Error(`P3528 ${e} Play1S runtime 缺失。`);
    return i;
  }
}

function wn0(n, e, t, i, r, s) {
  const o = (h) => T(h, "name"),
    a = {
      visibility: (h, d) => {
        const f = o(h);
        if (f === "bgpOn" && r !== void 0) return r;
        if (f === "infinite" && e.infiniteMode) return !0;
        if (f === "on" && d !== void 0) {
          const p = e.visibility[`${o(d)}/on`];
          if (p !== void 0) return p;
        }
        return f === void 0 ? void 0 : e.visibility[f];
      },
      text: (h) => {
        const d = o(h);
        return d === void 0 ? void 0 : e.text[d];
      },
    };
  let c = dt(
    An0(
      s === void 0
        ? dn(n.windowTree, t, i, a)
        : s.drawOrder(n.windowTree, t, i, a),
      n.root,
      e.infiniteMode,
    ),
    n.textures,
    s,
  );
  ((c = hX(c, n.blinkButtons, (h) => e.blinkButtons.get(h.node)?.button)),
    (c = ow(c, n.play1SPanels)));
  const l = new Map();
  for (let h = 0; h < c.length; h += 1) {
    const d = c[h];
    bC(d) && l.set(o(d.node), d);
  }
  const u = n.type;
  return c.map((h) => {
    if (
      h.kind === "play-1s-panel" &&
      "binding" in h &&
      u === "V1GenTacho" &&
      (h.binding.name === "playWarnBg" || h.binding.name === "playCrashBg")
    )
      return { ...h, useV1CollisionDepthRange: !0 };
    if (!bC(h)) return h;
    const d = o(h.node);
    return d === "indiBoostGauge"
      ? Os(h, e.mainRatio, u)
      : d === "instAccelGauge" ||
          d === "instAccelGaugeUsable" ||
          d === "instAccelGaugeOn"
        ? Os(h, e.instantRatio, u)
        : d === "indiBoostBar"
          ? j8(sh(MC(l, "indiBoostGauge"), h, e.mainRatio, u), e.barAlpha)
          : d === "teamBoostGauge"
            ? Os(h, e.teamRatio, u)
            : d === "teamBoostBar"
              ? sh(MC(l, "teamBoostGauge"), h, e.teamRatio, u)
              : d === "teamBoostFullFrame"
                ? j8(h, e.teamFullAlpha)
                : d === "indiBoostFullFrame"
                  ? j8(h, e.mainFullAlpha)
                  : d === "instAccelBar"
                    ? j8(sh(xn0(l, mn0), h, e.instantRatio, u), e.barAlpha)
                    : d === "instChargerGauge" && e.chargerRatio !== void 0
                      ? BJ(h, e.chargerRatio)
                      : h;
  });
}

const vn0 = new Set([
    "n2o",
    "n2o_always",
    "itemIcon",
    "draft",
    "auto",
    "AUTO",
    "warnBg",
    "crashBg",
    "crash",
    "stop",
    "resetting",
    "playWarnBg",
    "playCrashBg",
    "playCrashBg_Inside",
    "incGauge",
    "chargeable",
    "charging",
    "icnExceed",
    "idling",
    "usable",
  ]),
  yn0 = new Set([
    "incCharger_none",
    "charger_bg",
    "charger",
    "charger2",
    "chargerDetail",
  ]);

function An0(n, e, t) {
  if (!t) return n;
  const i = n.find(
    (o) => o.kind === "panel" && T(o.node, "name") === "infinite",
  );
  if (!i) return n;
  const r = new Set(),
    s = (o, a) => {
      const c = T(o, "name"),
        u =
          !(c !== void 0 && yn0.has(c)) && (a || (c !== void 0 && vn0.has(c)));
      (u && r.add(o), o.children.forEach((h) => s(h, u)));
    };
  return (
    s(e, !1),
    n.filter((o) =>
      o.node === i.node ||
      (o.kind !== "panel" &&
        o.kind !== "blink-button" &&
        o.kind !== "play-1s-panel")
        ? !0
        : !r.has(o.node) || o.node === i.node || !bn0(o.worldRect, i.worldRect),
    )
  );
}

function bn0(n, e) {
  return (
    n.left < e.right && n.right > e.left && n.top < e.bottom && n.bottom > e.top
  );
}

function Mn0(n) {
  return Math.fround(n) === Math.fround(1);
}

function bC(n) {
  return n.kind === "panel" && "uv" in n;
}

function MC(n, e) {
  const t = n.get(e);
  if (!t) throw new Error(`P3528 flat gauge ${e} binding 缺失。`);
  return t;
}

function xn0(n, e) {
  for (let t = 0; t < e.length; t += 1) {
    const i = n.get(e[t]);
    if (i !== void 0) return i;
  }
  throw new Error(`P3528 flat gauge ${e.join("/")} binding 缺失。`);
}

function j8(n, e) {
  return { ...n, alpha: e };
}



class Cn0 extends XGenTachometerPresentation { constructor(definition) { super(definition, xgenTachometerOps); } }

function zk(n, e, t) {
  const i = T(n, "name");
  (i && (e.add(i), t.set(i, T(n, "visible") !== "false")),
    n.children.forEach((r) => zk(r, e, t)));
}

class Gr {
  constructor(e, t, i) {
    ((this.definition = e),
      (this.nodes = t),
      (this.runtimes = i),
      (this.presentation = new Cn0(e)),
      (this.renderer = new fn(i)));
  }
  definition;
  nodes;
  runtimes;
  presentation;
  renderer;
  enableUiSmoothing() {
    this.renderer.enableUiSmoothing();
  }
  static async load(e, t, i, r) {
    if (e.type !== "XGenTacho" || !e.xGenGauges)
      throw new Error(`${e.type} 不能使用 P3528 XGen renderer。`);
    const s = Tn0(e),
      o = new Map();
    try {
      for (const a of e.play1SPanels) {
        const c = await Rw(a, t, r);
        o.set(a.node, new Iw(a, c, i));
      }
      return new Gr(e, s, o);
    } catch (a) {
      throw (o.forEach((c) => c.dispose()), a);
    }
  }
  startMainGaugeDrain() {
    this.presentation.startMainGaugeDrain();
  }
  setManualBoostAlarm(e) {
    this.presentation.setManualBoostAlarm(e);
  }
  update(e, t, i, r, s, o, a, c = !1) {
    const l = this.presentation.update({
      frameTickMs: t,
      sourceTickMs: r,
      stateCode: e.driveCameraRuntime().stateCode,
      dualBoosterMode: e.dualBoosterMode(),
      dualBoosterState: e.dualBoosterState(),
      speed: e.timeAttackTachometerSpeed(),
      gauges: e.timeAttackTachometerGauges(),
      teamSettledAtMs: e.timeAttackTeamGaugeSettledAtMs(),
      draftOn: c,
    });
    (l.play.forEach((u) =>
      this.runtime(u.name).play(u.durationMs, u.sourceTickMs, i),
    ),
      this.renderer.update(En0(this.definition, this.nodes, l, s, o, a), i));
  }
  render(e, t, i) {
    this.renderer.render(e, t, i);
  }
  dispose() {
    this.renderer.dispose();
  }
  runtime(e) {
    const t = this.definition.play1SPanels.find((r) => r.name === e),
      i = t === void 0 ? void 0 : this.runtimes.get(t.node);
    if (!i) throw new Error(`P3528 ${e} Play1S runtime 缺失。`);
    return i;
  }
}

function En0(n, e, t, i, r, s) {
  if (!n.xGenGauges) throw new Error("P3528 XGen gauge bindings 缺失。");
  const a = (h) => T(h, "name"),
    c = (h) => {
      const d = a(h);
      return d === void 0
        ? void 0
        : B50(t.individual, t.team, d, t.teamBooster);
    },
    l = dn(n.windowTree, i, r, {
      visibility: (h) => {
        if (h === e.n2oOn) return t.n2oOn;
        if (h === e.draftOn) return t.draftOn;
        const d = a(h);
        return d === "bgpOn" && s !== void 0
          ? s
          : d === "teamBoostGauge" || d === "teamBoostFullFrame"
            ? t.teamBooster
              ? t.visibility[d]
              : !1
            : (c(h)?.visible ?? (d === void 0 ? void 0 : t.visibility[d]));
      },
      text: (h) => {
        const d = a(h);
        return d === void 0 ? void 0 : t.text[d];
      },
    });
  let u = dt(l, n.textures);
  return (
    (u = sw(
      u,
      n.textures,
      n.graduations,
      (h) =>
        c(h)?.value ??
        n.graduations.find((d) => d.node === h)?.layout.defaultValue,
    )),
    (u = ow(u, n.play1SPanels)),
    u.map((h) => {
      const d = a(h.node);
      return h.kind === "panel" && d === "indiBoostFullFrame"
        ? { ...h, alpha: t.individual.fullFrameAlpha }
        : h.kind === "panel" && d === "teamBoostFullFrame"
          ? { ...h, alpha: t.team.fullFrameAlpha }
          : h.kind === "graduation" &&
              (d === "indiBoostBar" || d === "teamBoostBar")
            ? { ...h, alpha: t.barAlpha }
            : h;
    })
  );
}

function Tn0(n) {
  const e = _n0(n.root, "dashboard");
  return { draftOn: X8(X8(e, "draft"), "on"), n2oOn: X8(X8(e, "n2o"), "on") };
}

function _n0(n, e) {
  const t = [],
    i = (r) => {
      (T(r, "name") === e && t.push(r), r.children.forEach(i));
    };
  if ((i(n), t.length !== 1))
    throw new Error(`P3528 XGen ${e} node 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

function X8(n, e) {
  const t = n.children.filter((i) => T(i, "name") === e);
  if (t.length !== 1)
    throw new Error(`P3528 XGen ${e} child 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

const Gn0 = ["p3528", "p3543", "p3553"],
  Bn0 = "p3528";

function Rn0(n) {
  return typeof n == "string" && Gn0.includes(n);
}

function Bt(n) {
  const e = n.split("-", 1)[0];
  return Rn0(e) ? e : Bn0;
}

function Uk(n, e) {
  return `${n}-${e}`;
}

function In0(n, e) {
  return `${Uk(n, e)}-archive-index`;
}

const kn0 = "etc_/ppl.xml",
  xC = "zeta_/cn/ppl/ppl.bml";

async function Ln0(n, e) {
  const [t, i] = await Promise.all([SC(n, kn0), SC(n, xC)]),
    r = x1(t).root,
    s = s2(i),
    o = s.children.find((u) => T(u, "groupName") === "ingame");
  if (
    r.name !== "pplCommon" ||
    s.name !== "pplGeneral" ||
    o?.children.length !== 1
  )
    throw new Error(
      "P3528 赛道广告需要当前单条 ingame 配置；多活动选择尚未接入。",
    );
  const a = T(o.children[0], "folderName");
  if (!a) throw new Error(`${xC} ingame 缺少 folderName。`);
  const c = wa(e);
  return [c, Pn0(r, c)]
    .filter((u) => !!u)
    .map((u) => {
      const h = `zeta_/cn/ppl/ingame/${a}/${u}`;
      return {
        kind: "advertisement",
        id: `advertisement:${a}/${u}`,
        canonicalPrefix: h,
        mountPath: "zeta_/cn/ppl",
      };
    })
    .filter((u) => n.entriesUnderCanonicalPrefix(u.canonicalPrefix).length > 0);
}

function Pn0(n, e) {
  const t = n.children.find((i) => i.name === "altTheme");
  if (t)
    for (const i of t.children) {
      const r = j0(i, "orgTheme"),
        s = j0(i, "altTheme");
      if (r === e) return s;
      if (s === e && j0(i, "mirror") === "true") return r;
    }
}

async function SC(n, e) {
  const t = n.exactCanonicalCandidates(e);
  if (t.length !== 1 || t[0].absenceAuthoritative !== !0)
    throw new Error(`${e} 需要唯一且完整的原始资源来源。`);
  return t[0].bytes();
}

function w4(n, e) {
  n.loop = e;
  const t = n.buffer;
  e &&
    t.duration * t.sampleRate > t.length &&
    (n.loopEnd = t.duration * (1 - Number.EPSILON));
}

function Vn0(model) { return collectDummySounds(model); }



class m7 extends TrackDummySurroundAudio {
  constructor(context, sounds, ops = trackSurroundAudioOps) { super(context, sounds, ops); }
  static load(library, sounds, context) { return super.load(library, sounds, context, trackSurroundAudioOps); }
}

function $k(n) {
  if ($n0(n.property) !== "event")
    return { status: "block", reason: "not-event" };
  if (!Hn0(n.object))
    return { status: "block", reason: "event nested object 不是 Relement" };
  const e = [],
    t = [];
  let i = 0,
    r = 0,
    s = 0,
    o = 0,
    a;
  const c = (b, A, x, M) => {
    if (a) return;
    b.slotOccurrences[1] && (i += 1);
    const E = On0(b);
    if (typeof E == "string") {
      a = E;
      return;
    }
    if (A && (b.className === "ReTriList" || b.className === "ReTriStrip")) {
      const S = b.vertexData;
      if (
        !S ||
        !Array.isArray(S.positions) ||
        S.vertexCount !== S.positions.length ||
        !S.positions.every(zn0) ||
        !Array.isArray(S.indices) ||
        !S.indices.every((I) => Number.isInteger(I) && I >= 0 && I <= 65535)
      ) {
        a = `${b.name || b.className} event geometry malformed vertex/index data`;
        return;
      }
      if (b.className === "ReTriList" && S.indices.length % 3 !== 0) {
        a = `${b.name || b.className} event ReTriList index count malformed`;
        return;
      }
      const G =
        b.className === "ReTriList"
          ? S.indices.length / 3
          : Math.max(0, S.indices.length - 2);
      r += G;
      for (let I = 0; I < G; I += 1) {
        const L = S.indices[b.className === "ReTriList" ? I * 3 : I + (I % 2)];
        let k =
            S.indices[
              b.className === "ReTriList" ? I * 3 + 1 : I + 1 - (I % 2)
            ],
          D = S.indices[b.className === "ReTriList" ? I * 3 + 2 : I + 2];
        if (
          (E === 3 && ([k, D] = [D, k]),
          b.className === "ReTriStrip" && (L === k || L === D || k === D))
        ) {
          s += 1;
          continue;
        }
        const V = [S.positions[L], S.positions[k], S.positions[D]];
        if (V.some((P) => P === void 0)) {
          a = `${b.name || b.className} event index out of range`;
          return;
        }
        const K = V;
        (Un0(L, k, D, K) && (o += 1),
          t.push({
            nodePreorderPath: M,
            meshClass: b.className,
            sourceOrdinal: I,
            indices: [L, k, D],
            cull: E,
            inheritedInv: x,
            localVertexBits: [Qh(K[0]), Qh(K[1]), Qh(K[2])],
          }));
      }
    }
    const _ = b.additionalProperty;
    if (_ !== void 0 && !Wk(_)) {
      a = `${b.name || b.className} event additional property malformed`;
      return;
    }
    _?.children.forEach((S) => {
      const G = Object.fromEntries(
        S.attributes.map((I) => [t4(I.name), t4(I.value)]),
      );
      e.push({ name: t4(S.name), attributes: G });
    });
    const C = !!_?.children.some((S) => t4(S.name) === "inv");
    b.children.forEach((S, G) => c(S, _ !== void 0, C, [...M, G]));
  };
  c(n.object, !1, !1, [0]);
  const l = (b) => [...e].reverse().find((A) => A.name === b),
    u = l("effect"),
    h = l("scale"),
    d = l("gravity"),
    f = l("sound"),
    p = u
      ? (() => {
          const b = Ws(u, "model"),
            A = Ws(u, "soundName"),
            x = bg(u, "soundType"),
            M = bg(u, "tick"),
            E = sl(u, "distance");
          if (
            b === void 0 ||
            A === void 0 ||
            x === void 0 ||
            M === void 0 ||
            E === void 0
          ) {
            a ??= "effect marker 字段无效";
            return;
          }
          return {
            model: b,
            soundName: A,
            soundType: x,
            tickMs: M,
            distance: E,
          };
        })()
      : void 0,
    v = h ? sl(h, "value") : void 0;
  h && v === void 0 && (a ??= "scale marker value 无效");
  const w = d ? sl(d, "value") : void 0;
  d && w === void 0 && (a ??= "gravity marker value 无效");
  const g = f
    ? (() => {
        const b = Ws(f, "filename"),
          A = Y8(f, "maxVolume", 1),
          x = Y8(f, "maxRadius", 0),
          M = Y8(f, "minVolume", 0),
          E = Y8(f, "minRadius", 1),
          _ = CC(f, "spacing", 0),
          C = CC(f, "timeLineOffset", -1),
          S = f.attributes.panning,
          G = S === void 0 || S === "true" ? !0 : S === "false" ? !1 : void 0,
          I = Object.entries(f.attributes)
            .filter(
              ([k]) => k !== "timeLineOffset" && k.slice(0, 8) === "timeLine",
            )
            .map(([, k]) =>
              /^-?\d+$/.test(k) && Number.isSafeInteger(Number(k))
                ? Number(k)
                : void 0,
            );
        if (
          b === void 0 ||
          A === void 0 ||
          x === void 0 ||
          M === void 0 ||
          E === void 0 ||
          _ === void 0 ||
          C === void 0 ||
          G === void 0 ||
          I.some((k) => k === void 0)
        ) {
          a ??= "sound marker 字段无效";
          return;
        }
        const L = I.filter((k) => k !== void 0);
        return {
          filename: b,
          maxVolume: A,
          maxRadius: x,
          minVolume: M,
          minRadius: E,
          panning: G,
          spacing: _,
          timeLineOffset: C,
          timeLine: L,
        };
      })()
    : void 0;
  if (a) return { status: "block", reason: a };
  const y = t.length;
  return {
    status: "parsed",
    renderRoot: n.object,
    rawMarkers: e,
    effect: p,
    scalePercent: v,
    gravity: w,
    sound: g,
    prsNodes: i,
    triangleCount: y,
    sourceTriangleCount: r,
    selectedTriangleCount: y,
    skippedTriangleCount: s,
    degenerateTriangleCount: o,
    triangleBindings: t,
    armedInitial: 1,
    rearmAnchorInitial: "uninitialized-target-heap",
  };
}

function On0(n) {
  const e = n.slotOccurrences[4];
  if (!e)
    return n.slots[4] === void 0
      ? 2
      : `${n.name || n.className} BackFace property missing occurrence`;
  const t = e.value;
  return t?.kind === "backface" &&
    Number.isInteger(t.cull) &&
    t.cull >= 0 &&
    t.cull <= 4294967295
    ? t.cull
    : `${n.name || n.className} BackFace property malformed`;
}

function Wk(n) {
  if (!n || typeof n != "object") return !1;
  const e = n;
  return (
    typeof e.name == "string" &&
    typeof e.text == "string" &&
    Array.isArray(e.attributes) &&
    e.attributes.every(
      (t) => t && typeof t.name == "string" && typeof t.value == "string",
    ) &&
    Array.isArray(e.children) &&
    e.children.every(Wk)
  );
}

function zn0(n) {
  return (
    Array.isArray(n) && n.length === 3 && n.every((e) => Number.isFinite(e))
  );
}

function Un0(n, e, t, i) {
  if (n === e || n === t || e === t) return !0;
  const r = i[1].map((a, c) => a - i[0][c]),
    s = i[2].map((a, c) => a - i[0][c]);
  return [
    r[1] * s[2] - r[2] * s[1],
    r[2] * s[0] - r[0] * s[2],
    r[0] * s[1] - r[1] * s[0],
  ].every((a) => a === 0);
}

function Qh(n) {
  return n.map((e) => {
    const t = new DataView(new ArrayBuffer(4));
    return (
      t.setFloat32(0, e, !0),
      t.getUint32(0, !0).toString(16).padStart(8, "0")
    );
  });
}

function $n0(n) {
  const e = n?.children.find((t) => t4(t.name) === "object");
  return e ? t4(Wn0(e.attributes, "type") ?? "") : void 0;
}

function Ws(n, e) {
  const t = n.attributes[e];
  return t === void 0 || t.length === 0 ? void 0 : t;
}

function bg(n, e) {
  const t = Ws(n, e);
  if (t === void 0 || !/^-?\d+$/.test(t)) return;
  const i = Number(t);
  return Number.isSafeInteger(i) ? i : void 0;
}

function sl(n, e) {
  const t = Ws(n, e);
  if (t === void 0) return;
  const i = Number(t);
  return Number.isFinite(i) ? i : void 0;
}

function Y8(n, e, t) {
  return n.attributes[e] === void 0 ? t : sl(n, e);
}

function CC(n, e, t) {
  return n.attributes[e] === void 0 ? t : bg(n, e);
}

function Wn0(n, e) {
  return n.find((t) => t4(t.name) === e)?.value;
}

function t4(n) {
  const e = n.indexOf("\0");
  return n.slice(0, e < 0 ? n.length : e);
}

function Hn0(n) {
  return !!(n && typeof n == "object" && n.kind === "node");
}

class qn0 extends MovingTrackEvent { constructor(root, projection) { super(root, projection, movingEventOps); } }

class Kn0 extends TrackEventOwner { constructor(projection) { super(projection, trackEventOwnerOps); } }















































const n4 = [
    1, 1.5, 0, 0, 0, 0.5, 0.5, 0.8, 0.125, 0, 0.5, 0.25, 0.75, 0.5, 0.7, 0.2, 0,
    0.5, 0.25, 0.75, 0.5, 0.5, 0.3, 0, 0.5, 0, 0.75, 0.25, 0.333, 0.25, 0, 0,
    0.5, 0.5, 1, 0.125, 0.125, 0, 0.5, 0, 0.75, 0.25, -0.181, 0.25, 0, 0.75, 0,
    1, 0.25, -0.25, 0.4, 0, 0.5, 0.25, 0.75, 0.5, -0.4, 0.5, 0, 0, 0.5, 0.5, 1,
    -0.8, 1, 0, 0, 0.5, 0.5, 1,
  ].map(Math.fround),
  a30 = [0, 0, 0, 0, 0, 0, 0, 0.1, 0.125, 0.25].map(Math.fround);

class w7 extends LensFlareEffect { constructor(point, texture) { super(point, texture, ca); } static load(library, position) { return loadLensFlareEffect(library, position, p2, (point, texture) => new w7(point, texture)); } }









const Sg = Math.fround(3.5999999046325684),
  Jh = {
    minVelocity: Math.fround(Math.fround(50) / Sg),
    maxVelocity: Math.fround(Math.fround(300) / Sg),
    accelFactor: Math.fround(1),
    resistFactor: Math.fround(1),
    gravityFactor: Math.fround(0.5),
  };

function d30(n) {
  const e = s2(n);
  if (!BC(e.name, "railList"))
    throw new Error("rail.bml 根节点不是目标 railList 布局。");
  const t = [];
  for (const i of e.children) {
    if (!BC(i.name, "rail")) continue;
    const r = T(i, "id") ?? "";
    t.push({
      id: r,
      minVelocity: GC(i, "minVelocity", Jh.minVelocity),
      maxVelocity: GC(i, "maxVelocity", Jh.maxVelocity),
      accelFactor: cl(i, "accelFactor", 1),
      resistFactor: cl(i, "resistFactor", 1),
      gravityFactor: cl(i, "gravityFactor", 0.5),
    });
  }
  return { records: t, defaultConfig: { ...Jh } };
}

function f30(n, e) {
  return n.records.find((t) => t.id === e) ?? n.defaultConfig;
}

function GC(n, e, t) {
  return Math.fround(cl(n, e, t) / Sg);
}

function cl(n, e, t) {
  const i = T(n, e);
  if (i === void 0 || i.trim() === "") return Math.fround(t);
  const r = Number(i);
  return Number.isFinite(r) ? Math.fround(r) : Math.fround(t);
}

function BC(n, e) {
  const t = n.indexOf("\0");
  return n.slice(0, t < 0 ? n.length : t) === e;
}

function p30(n, e) {
  return Xn(Yk(n, e), "inType") === "fairy" ? Math.fround(10) : Math.fround(4);
}

function g30(n, e) {
  const t = Yk(n, e);
  if (!t) return;
  const i = Number(Xn(t, "outTime") ?? "0"),
    r = Number(Xn(t, "outFovBase") ?? "0");
  if (!Number.isInteger(i) || i < 0 || i > 4294967295)
    throw new Error(`warp 的 outTime=${i} 不是 u32。`);
  if (!Number.isFinite(r))
    throw new Error(`warp 的 outFovBase=${r} 不是 finite float。`);
  return {
    inType: Xn(t, "inType"),
    outType: Xn(t, "outType"),
    outTime: i >>> 0,
    outFovAdjust: Cg(t, "outFovAdjust"),
    outFovBase: Math.fround(r),
  };
}

function m30(n, e) {
  const t = jk(e),
    i = Xk(n, e);
  if (!i) return { rainEnabled: !1, rainOnStart: !1, snowEnabled: t };
  const r = i.children.filter((u) => u.name === "rainEffect");
  if (r.length > 1)
    throw new Error(`track config filename=${e} 含重复 rainEffect。`);
  const s = i.children.filter((u) => u.name === "LightningEffect");
  if (s.length > 1)
    throw new Error(`track config filename=${e} 含重复 LightningEffect。`);
  const o = r.length > 0 && Cg(r[0], "enable"),
    a = r.length > 0 && Cg(r[0], "onStart");
  if (s.length === 0)
    return { rainEnabled: o, rainOnStart: o && a, snowEnabled: t };
  const c = Xn(s[0], "rainVolume"),
    l = Math.fround(c === void 0 ? 0.2 : Number(c));
  if (!Number.isFinite(l))
    throw new Error(`LightningEffect 的 rainVolume=${c} 不是 finite float。`);
  return {
    rainEnabled: o,
    rainOnStart: o && a,
    snowEnabled: t,
    lightningSound: s[0].text,
    rainVolume: l,
  };
}

function jk(n) {
  return n === "track_xmas" || n === "track_xmas_rvs";
}

function Xk(n, e) {
  if (n.name !== "trackInfo")
    throw new Error(`track config 根节点应为 trackInfo，实际为 ${n.name}。`);
  const t = n.children.filter((i) => Xn(i, "filename") === e);
  if (t.length > 1) throw new Error(`track config filename=${e} 匹配不唯一。`);
  if (t[0] && t[0].name !== "track")
    throw new Error(`filename=${e} 的匹配节点不是 track。`);
  return t[0];
}

function Yk(n, e) {
  const i = Xk(n, e)?.children.filter((r) => r.name === "warp") ?? [];
  if (i.length > 1) throw new Error(`track config filename=${e} 含重复 warp。`);
  return i[0];
}

function Cg(n, e) {
  const t = Xn(n, e);
  if (t === void 0 || t === "false") return !1;
  if (t === "true") return !0;
  throw new Error(`${n.name} 的 ${e}=${t} 不是 exact boolean。`);
}

function Xn(n, e) {
  if (!n) return;
  const t = n.attributes.filter((i) => i.name === e);
  if (t.length > 1) throw new Error(`${n.name} 含重复 ${e} 属性。`);
  return t[0]?.value;
}

const RC = new WeakMap();

function w30(n) {
  let e = RC.get(n);
  return (e || ((e = v30(n)), RC.set(n, e)), e);
}

async function v30(n) {
  const e = n.files.filter((t) => {
    if (t.name.toLowerCase() !== "rail.bml") return !1;
    const i = (t.canonicalPath ?? t.virtualPath)
      .replaceAll("\\", "/")
      .toLowerCase();
    return (
      /(^|\/)track_\/common\/rail\.bml$/.test(i) ||
      /(^|\/)track_common\/rail\.bml$/.test(i) ||
      t.sourceName.toLowerCase() === "track_common.rho"
    );
  });
  if (e.length !== 0) {
    if (e.length > 1)
      throw new Error(
        `rail.bml 来源不唯一：${e.map((t) => t.virtualPath).join(", ")}。`,
      );
    return d30(await e[0].bytes());
  }
}

async function y30(n, e) {
  const { model: t, root: i } = await n.loadTrackConfig(e);
  if (!i) {
    if (t.absenceAuthoritative) return Math.fround(4);
    throw new Error(
      `${e} 缺少权威 track config；当前容器选择不完整，不能推导默认 4 m。`,
    );
  }
  return p30(i, u6(t.name));
}

async function A30(n, e) {
  const { model: t, root: i } = await n.loadTrackConfig(e);
  if (!i) {
    if (t.absenceAuthoritative)
      return { rainEnabled: !1, rainOnStart: !1, snowEnabled: jk(u6(t.name)) };
    throw new Error(`${e} 缺少权威 track config；不能推导 weather owner。`);
  }
  return m30(i, u6(t.name));
}

async function b30(n, e) {
  const { model: t, root: i } = await n.loadTrackConfig(e);
  if (!i) {
    if (t.absenceAuthoritative) return;
    throw new Error(`${e} 缺少权威 track config；不能确定 warp 类型。`);
  }
  return g30(i, u6(t.name));
}

function u6(n) {
  const e = n.replace(/\.1s$/i, "");
  return e.endsWith("_rvs") ? e.slice(0, -4) : e;
}

const M30 = "/assets/motor-vorbis-B0OpSz3w.wasm";

let ed;

function x30() {
  return (
    (ed ??= (async () => {
      const n = await fetch(M30);
      if (!n.ok) throw new Error(`Motor Vorbis decoder HTTP ${n.status}`);
      return WebAssembly.compile(await n.arrayBuffer());
    })().catch((n) => {
      throw ((ed = void 0), n);
    })),
    ed
  );
}

async function S30(n, e) {
  const t = await x30();
  let i;
  ((i = new WebAssembly.Instance(t, {
    wasi_snapshot_preview1: {
      fd_prestat_get: () => 8,
      fd_prestat_dir_name: () => 8,
      proc_exit: (a) => {
        throw new Error(`Motor Vorbis decoder exited: ${a}`);
      },
      random_get: (a, c) => (
        crypto.getRandomValues(new Uint8Array(i.memory.buffer, a, c)),
        0
      ),
    },
  }).exports),
    i._initialize());
  const s = i.malloc(n.byteLength);
  if (!s) throw new Error("Motor Vorbis input allocation failed");
  let o = 0;
  try {
    if (
      (new Uint8Array(i.memory.buffer, s, n.byteLength).set(n),
      (o = i.decode(s, n.byteLength)),
      !o)
    )
      throw new Error("Motor Vorbis resource is invalid or incomplete");
    const a = new DataView(i.memory.buffer, o, 16),
      c = a.getUint32(0, !0),
      l = a.getUint32(4, !0),
      u = a.getUint32(8, !0),
      h = a.getUint32(12, !0),
      d = new DataView(i.memory.buffer, c, l * u * 2);
    return e(d, u, l, h);
  } finally {
    (o && i.release(o), i.free(s));
  }
}

class pv extends KartAudioRuntime { constructor(...args) { super(...args, kartAudioOps); } static load(library, engineName, generation, chargeBoostBySpeed, context, kartName) { return loadKartAudio(library, engineName, generation, chargeBoostBySpeed, context, kartName, kartAudioLoadOps, (...args) => new pv(...args)); } }

class I30 extends ReadyCameraController { constructor(model) { super(model, readyCameraOps); } }





















function O30(model, context) { return warpNextCamera(model, { clientWorldElements: context.clientWorldElements, fieldOfView: we }); }



function Jk(n, e) {
  if (n.name === e) return n;
  for (const t of n.children) {
    const i = Jk(t, e);
    if (i) return i;
  }
}



class v7 extends StandaloneEventSurroundAudio {
  constructor(context, sounds, ops = trackSurroundAudioOps) { super(context, sounds, ops); }
  static load(library, events, worldMatrix, context) {
    return super.load(library, events, context, {
      ...trackSurroundAudioOps, worldMatrix, transformPoint: e3,
    });
  }
}

function eL(config) { return unsupportedEventSound(config); }













function K30(n, e) {
  if (n.root.kind !== "track") return [];
  const t = new Set(
    e.records
      .filter(
        (i) => i.occurrence.kind === "track-object" && i.decision === "admit",
      )
      .map((i) => i.occurrence.index),
  );
  return n.root.trackObjects.filter(
    (i, r) => i.kind === "ToMovableObject" && t.has(r),
  );
}

function j30(n, e) {
  const t = n.root;
  return t.kind !== "track"
    ? []
    : e.records.flatMap((i) => {
        if (
          i.occurrence.kind !== "track-object" ||
          i.reason !== "movable-dummy-visual-admitted"
        )
          return [];
        const r = t.trackObjects[i.occurrence.index];
        if (
          r?.kind !== "ToMovableObject" ||
          !r.object ||
          typeof r.object != "object" ||
          !("kind" in r.object) ||
          r.object.kind !== "node"
        )
          throw new Error(
            `ToMovableObject ${i.occurrence.name} 缺少 GoItemDummy 嵌套场景。`,
          );
        return [r.object];
      });
}

const tL = Symbol("admitted-speed-individual-track"),
  nL = Symbol("admitted-time-attack-track");

function X30(n) {
  if (!n.containerId)
    throw new Error(`${n.virtualPath} 缺少逻辑容器 provenance。`);
  return {
    sourceKind: n.sourceKind,
    sourceName: n.sourceName,
    containerId: n.containerId,
    logicalPath: n.canonicalPath ?? n.virtualPath,
  };
}

function Y30(model, source, mode, options = {}) { return buildTrackAdmissionLedger(model, source, mode, options, trackAdmissionOps); }

function Z30(n, e) {
  if (e.mode !== "speed-individual")
    throw new Error("normal coordinator 只接受 speed-individual 准入账本。");
  const t = e.records.find((i) => i.decision === "block");
  if (t)
    throw new Error(
      `${t.occurrence.className} ${t.occurrence.name || "<unnamed>"} 因 ${t.reason} 阻断 Speed individual。`,
    );
  return { [tL]: !0, parsed: n, ledger: e };
}

function Q30(n) {
  return !!(n && typeof n == "object" && n[tL]);
}

function J30(n, e) {
  if (e.mode !== "time-attack")
    throw new Error("TimeAttack coordinator 只接受 time-attack 准入账本。");
  const t = e.records.find((i) => i.decision === "block");
  if (t)
    throw new Error(
      `${t.occurrence.className} ${t.occurrence.name || "<unnamed>"} 因 ${t.reason} 阻断 TimeAttack。`,
    );
  return { [nL]: !0, parsed: n, ledger: e };
}

function e40(n) {
  return !!(n && typeof n == "object" && n[nL]);
}















class ul {
  constructor(e) {
    this.assetHost = e;
  }
  assetHost;
    async loadVehicleAsset(path, itemId, hint, body, kartName, environment, stageBinding, audioContext, coatingTexture, decorationOption, convertClientCoordinates, suppressClassic = false, forceNew = false) { return loadVehicleAsset(this, path, itemId, hint, body, kartName, environment, stageBinding, audioContext, coatingTexture, decorationOption, convertClientCoordinates, suppressClassic, forceNew, vehicleAssetOps); }
    async loadCharacterAsset(path, item, motionSource, animationType, includeF54, environment, stageBinding, linkMode, profile = this.assetHost.userProfile, outlineBatch, award = false) { return loadCharacterAsset(this, path, item, motionSource, animationType, includeF54, environment, stageBinding, linkMode, profile, outlineBatch, award, characterAssetOps); }
    async loadRaceCharacters(characterPath, characterItem, kartItem, motionBasis, includeSpecialMotion, environment, stageBinding, award = false) { return loadRaceCharacters(this, characterPath, characterItem, kartItem, motionBasis, includeSpecialMotion, environment, stageBinding, award); }
    async loadVehicleRuntime(path, textureKey, plateId, library, environment, stageBinding, profile = this.assetHost.userProfile, kartItemId, engineGrade, coatingTextureOverride, scope, convertClientCoordinates, deferEnvironment = false) { return loadVehicleRuntime(this, path, textureKey, plateId, library, environment, stageBinding, profile, kartItemId, engineGrade, coatingTextureOverride, scope, convertClientCoordinates, deferEnvironment, vehicleRuntimeOps); }
    loadAssetMap(path, trackId) { return loadTimeAttackMap(this, path, trackId, J30); }
    loadMultiplayerMap(path, trackId, mode) { return loadMultiplayerMap(this, path, trackId, mode, Bt, Vw, Z30); }
    async loadMap(path, trackId, mode, admit, lte = false) { return loadTrackMap(this, path, trackId, mode, admit, lte, trackMapOps); }
}

function i40(n) {
  n.traverse((e) => {
    if (!(e instanceof D2)) return;
    (Array.isArray(e.material) ? e.material : [e.material]).forEach((i) => {
      ((i.depthFunc = ir), (i.depthWrite = !1));
    });
  });
}

function r40(n, e) {
  return new ag(
    g9(n, "f00"),
    {
      3: g9(n, "f40"),
      4: g9(n, "f41"),
      5: g9(n, "f42"),
      8: g9(n, "f45"),
      9: g9(n, "f46"),
      10: g9(n, "f47"),
      11: g9(n, "f48"),
      12: g9(n, "f49"),
      13: g9(n, "f50"),
      14: g9(n, "f51"),
      19: n.get("f54"),
    },
    e,
  );
}

function s40(n, e, t) {
  return new sk(
    g9(n, "f00"),
    {
      0: g9(n, "f08"),
      8: g9(n, "f45"),
      9: g9(n, "f46"),
      10: g9(n, "f47"),
      11: g9(n, "f48"),
      12: g9(n, "f49"),
      13: g9(n, "f50"),
      14: g9(n, "f51"),
      18: g9(n, "f11"),
      19: n.get("f54"),
    },
    e,
    t,
  );
}

function o40(n, e) {
  return new ok(
    g9(n, "f00"),
    {
      f10: g9(n, "f10"),
      f22: g9(n, "f22"),
      f23: g9(n, "f23"),
      f54: n.get("f54"),
    },
    e,
  );
}

function g9(n, e) {
  const t = n.get(e);
  if (!t) throw new Error(`人物动作集合缺少 ${e}。`);
  return t;
}

function a40(n) {
  const e = n.split("/");
  return e.length > 1 ? e[e.length - 2] : n.replace(/\.1s$/i, "");
}

function h6(n, e, t) {
  const i = r7(e, t),
    r = i.fields,
    s = k20,
    o = { ...n };
  for (const a of c40) {
    if (a === "driftMaxGauge" && i.driftMaxGaugeFromSpeedTypeOnly) {
      o.driftMaxGauge = Lo;
      continue;
    }
    if ((a === "normalBoosterTime" || a === "teamBoosterTime") && r[a] === qn) {
      o[a] = qn;
      continue;
    }
    const c = r[a] - s[a];
    c !== 0 && (o[a] = Math.fround(o[a] + c));
  }
  return o;
}

const c40 = [...z20, "steerLeanFactor", "normalBoosterTime", "teamBoosterTime"];



class mv extends SlipstreamVisual { static load(library, kart, environment, stageBinding) { return loadSlipstreamVisual(library, kart, environment, stageBinding, slipstreamVisualOps, (scene, burst) => new mv(scene, burst)); } }

class wv extends SlipstreamAudio { constructor(context, charging, draft) { super(context, charging, draft, slipstreamAudioOps); } static load(library, context) { return loadSlipstreamAudio(library, context, Q9, (audioContext, charging, draft) => new wv(audioContext, charging, draft)); } }



class sL extends RainScreenEffect { constructor(random, rainOnStart) { super(random, rainOnStart, ca); } }

class y7 extends RainAudioCue { constructor(context, cue) { super(context, cue, S9); } static load(library, context) { return loadRainAudioCue(library, context, Q9, (audioContext, buffer) => new y7(audioContext, buffer)); } }





class A7 extends SnowScreenEffect { constructor(random, texture) { super(random, texture, ca); } static load(library, random) { return loadSnowScreenEffect(library, random, p2, (source, texture) => new A7(source, texture)); } }



function d40(n, e) {
  if (e.resourceVersion !== "p3553" || !W6(e.channelName, e.mode, e.speed))
    throw new Error("本局频道身份、玩法或速度不匹配。");
  const t = x1(n).root,
    i = t.children.filter((l) => l.name === "Multiplay");
  if (t.name !== "Class" || i.length !== 1)
    throw new Error("频道资源结构不完整。");
  const r = i[0].children.filter(
    (l) => l.name === "Channel" && j0(l, "name") === e.channelName,
  );
  if (r.length !== 1) throw new Error("原版资源缺少唯一的比赛频道。");
  const s = r[0],
    o = He[e.channelName],
    a = j0(s, "adjustCollision");
  if (a !== void 0 && a !== "true" && a !== "false")
    throw new Error("频道碰撞修正开关无效。");
  const c = j0(s, "leagueGame");
  if (
    j0(s, "gameType") !== String(o.gameType) ||
    j0(s, "createSpeed") !== String(o.speed) ||
    e.channelName.includes("Newbie") ||
    (c !== void 0 && c !== "false")
  )
    throw new Error("该频道的赛事规则尚未准入普通多人比赛。");
  return Object.freeze({
    name: e.channelName,
    gameType: o.gameType,
    grandprixId: 0,
    tierSeasonId: 0,
    progressInvalidation: !1,
    adjustCollision: a !== "false",
  });
}

function f40(n) {
  const e = x1(n).root;
  if (e.name !== "contentList") throw new Error("P3553 功能配置结构不完整。");
  const t = e.children.filter(
    (r) => r.name === "content" && j0(r, "name") === "checkClientFramerate",
  );
  if (t.length > 1) throw new Error("P3553 碰撞帧率功能配置重复。");
  if (t.length === 0) return !1;
  const i = j0(t[0], "enable");
  if (i !== void 0 && i !== "true" && i !== "false")
    throw new Error("P3553 碰撞帧率功能配置无效。");
  return i === "true";
}

async function p40(n) {
  const e = n.exactCanonicalCandidates("zeta_/cn/content/config.xml");
  if (e.length !== 1) throw new Error("缺少唯一的 P3553 原版功能配置。");
  return f40(await e[0].bytes());
}

async function g40(n, e) {
  const t = n.canonicalCandidates("zeta_/cn/content/channel.xml");
  if (t.length !== 1) throw new Error("缺少唯一的P3553原版频道资源。");
  return d40(await t[0].bytes(), e);
}

function m40(n, e) {
  if (!n.linkCharacterId) return;
  if (
    { 837: 116, 838: 117, 843: 124, 845: 128 }[n.itemId ?? 0] !==
      n.linkCharacterId ||
    n.engineGrade !== 5 ||
    n.alwaysLinkCharacter !== !1 ||
    n.hideChar !== !1 ||
    n.characterAniType !== 0
  )
    throw new Error("该联动角色车型尚未完成多人比赛与领奖验证。");
  if (
    [8, 9, 11, 12, 16, 17, 21, 26, 52].some((i) => e.equipment.itemIds[i] !== 0)
  )
    throw new Error(
      "Transformer 多人基础装配需先卸下眼镜、气球、头饰、耳机、左右手饰、宠物、炫光和飞宠。",
    );
}

function w40(n, e) {
  if (
    (MI(G2(n)),
    G2(n) === "rp"
      ? !ba(
          e.rp,
          e.roster.map((r) => r.playerId),
        ) || !t7(e.rp, n.race?.rp)
      : e.rp !== void 0)
  )
    throw new Error("RP 比赛冻结抽取结果无效。");
  if (
    G2(n) === "giant"
      ? !Io(e.giant) ||
        !yI(e.giant, n.race?.giant) ||
        !Zl(e.trackId) ||
        (n.randomTrackCode !== void 0 && n.randomTrackCode !== 0)
      : e.giant !== void 0
  )
    throw new Error("巨人比赛冻结身份或地图无效。");
  if (
    (iL(e),
    G2(n) === "lte" &&
      (n.trackId !== void 0 ||
        n.randomTrackCode !== bI ||
        !Vw(e.trackId) ||
        n.race?.trackId !== e.trackId))
  )
    throw new Error("LTE仅支持三张专属赛道全部随机。");
  if (
    G2(n) === "lte" ? !ko(e.lte) || !Nw(e.lte, n.race?.lte) : e.lte !== void 0
  )
    throw new Error("LTE Web试玩冻结参数无效。");
  if (
    G2(n) === "roadblock" &&
    (!e.roadblock ||
      e.roadblock.ruleset !== tt.ruleset ||
      e.roadblock.limitMs !== tt.limitMs ||
      e.roadblock.noRunnerManualReset !== !0 ||
      e.roster.length < tt.minPlayers ||
      !e.roster.some((r) => r.playerId === e.roadblock.runnerId))
  )
    throw new Error("挡人比赛冻结参数无效。");
  if (
    (n.mode === "team" &&
      ![1, 2].every((r) => e.roster.some((s) => s.team === r))) ||
    n.resourceVersion !== "p3553" ||
    !W6(n.channelName, n.mode, n.speed) ||
    e.channelName !== n.channelName ||
    !To(n.gameplay, n.channelName, n.resourceVersion) ||
    G2(n) !== G2(e) ||
    n.speedVersion !== "国服" ||
    ![4, 7].includes(n.speed) ||
    n.race?.raceId !== e.raceId ||
    (n.randomTrackCode === void 0 && n.trackId !== e.trackId) ||
    e.roster.length < 2 ||
    e.roster.length > 8
  )
    throw new Error("多人实跑开放P3553国服标准或无限速度的个人与组队竞速。");
  const t = new Set(),
    i = new Set();
  return e.roster.map((r) => {
    if (
      !r.equipment ||
      (n.mode === "individual"
        ? r.team !== null
        : r.team !== 1 && r.team !== 2) ||
      t.has(r.playerId) ||
      i.has(r.slot) ||
      !Number.isInteger(r.slot) ||
      r.slot < 0 ||
      r.slot > 7
    )
      throw new Error("本局参赛名单或装备不完整。");
    return (
      t.add(r.playerId),
      i.add(r.slot),
      {
        equipment: structuredClone(r.equipment),
        initial: r.initial ?? "",
        favoriteTracks: [],
        favoriteItems: [],
      }
    );
  });
}

function v40(n, e, t, i, r) {
  return e === t ? p5(n.garage, i, r) : {};
}

function y40(n) {
  n.audio?.dispose(!1);
  for (const e of [
    n.effects,
    n.trails,
    n.driftEffects,
    n.motionBlur,
    n.zetAirEffect,
    n.shockWaveEffect,
    n.exhaustEffect,
    n.crashEffect,
    n.chargerEffect,
    n.lampFlares,
    n.simpleShadow,
    n.decoration,
    n.coating,
    n.particleModification,
    n.tachometerRenderer,
  ])
    e?.dispose();
  (n.accessories.forEach(({ render: e }) => e.dispose()),
    n.imported.renderScene?.dispose(),
    u5(n.imported.object));
}

function rd(n, e) {
  return {
    importer: n.importer,
    targetRandom: n.targetRandom,
    toonStageBinding: n.toonStageBinding,
    shadow: n.shadow,
    userProfile: e,
    getLibrary: () => n.getLibrary(),
    generationValue: () => n.generationValue(),
    isGenerationCurrent: (t) => n.isGenerationCurrent(t),
    requireAsset: (t) => n.requireAsset(t),
  };
}

async function A40(n, e, t, i, r, s) {
  ((e = structuredClone(e)), (t = structuredClone(t)));
  const o = structuredClone(r.profile),
    a = { ...o, equipment: zw(o) },
    c = r.anonymous ?? !1,
    l = r.classicHud ?? !1,
    u = RI(e),
    h = w40(e, t),
    f = t.roster.find((D) => D.playerId === r.playerId)?.equipment,
    p = a.equipment;
  if (
    !f ||
    f.kartSerial !== p.kartSerial ||
    f.exceedType !== p.exceedType ||
    f.valueAt3E !== p.valueAt3E ||
    f.systemKart !== p.systemKart ||
    f.systemKartVariant !== p.systemKartVariant ||
    !t6.every((D) => f.itemIds[D] === p.itemIds[D])
  )
    throw new Error("本机装备已与本局冻结名单不一致，请返回房间重新准备。");
  const v = h[t.roster.findIndex((D) => D.playerId === r.playerId)],
    w = () => {
      s.throwIfAborted();
    };
  w();
  const g = n.getLibrary();
  if (!g) throw new Error("多人比赛资源库尚未建立。");
  const y = await g40(g, e),
    b = await p40(g);
  w();
  const A = n.generationValue(),
    [x, M] = await Promise.all([
      G2(e) === "roadblock"
        ? Cw(g)
        : G2(e) === "lte"
          ? r20(g)
          : g.timeAttackTrackCatalog(),
      g.timeAttackGarageCatalog(),
    ]);
  w();
  const E = x.find((D) => D.id === t.trackId);
  if (!E) throw new Error("本局赛道不在当前资源目录中。");
  const _ = new ul(rd(n, h[0])),
    C = await (
      G2(e) === "lte"
        ? _.loadMultiplayerMap(E.path, E.id, "lte")
        : _.loadMultiplayerMap(E.path, E.id)
    ).catch((D) => {
      const V = D instanceof Error ? D.message : String(D);
      throw new Error(`赛道 ${E.id}（${E.path}）加载失败：${V}`, { cause: D });
    }),
    S = [
      () => C.environment.dispose(),
      () => C.skydome?.dispose(),
      () => C.renderScene?.dispose(),
    ];
  let G = !1;
  const I = () => {
      if (!G) {
        G = !0;
        for (const D of S.reverse()) D();
      }
    },
    L = [],
    k = new KI();
  try {
    w();
    const D = C.lteCoinSource
      ? await jw.load(g, C.lteCoinSource, C.environment, C.stageBinding, i)
      : void 0;
    (D && S.push(() => D.dispose()), w());
    const V = C.lensFlarePoint ? await w7.load(g, C.lensFlarePoint) : void 0;
    (V && S.push(() => V.dispose()), w());
    const K = C.data.weather?.rainEnabled
      ? new sL(n.targetRandom, C.data.weather.rainOnStart)
      : void 0;
    K && S.push(() => K.dispose());
    const P = K ? await y7.load(g, i) : void 0;
    (P && S.push(() => P.dispose()), w());
    const q = C.data.weather?.snowEnabled
      ? await A7.load(g, n.targetRandom)
      : void 0;
    (q && S.push(() => q.dispose()), w());
    const e0 = await wv.load(g, i);
    (S.push(() => e0.dispose()), w());
    const Q = e.mode === "team" || t.roadblock ? await fa(g) : void 0,
      U = await MZ(g, e.speed);
    for (let O = 0; O < h.length; ++O) {
      const F = t.roster[O],
        z = F.playerId === r.playerId,
        Y = u.competition && !z ? zQ(h[O], v) : h[O],
        X = F.playerId === t.roadblock?.runnerId,
        l0 = t.rp
          ? Z00(h[O], t.rp.draws[F.playerId])
          : t.roadblock
            ? s20(Y, X, M.karts, Q)
            : Y,
        r0 = l0.equipment;
      let j = M.karts.find(
        (x0) =>
          x0.itemId === r0.itemIds[3] &&
          (x0.itemId !== 0 || x0.systemKey === r0.systemKart),
      );
      j &&
        r0.systemKartVariant &&
        (j = b4(
          M.karts,
          0,
          `kart_/${r0.systemKartVariant}/model.1s`,
          r0.systemKart,
        ));
      const F0 = t.roadblock
          ? l0.equipment.itemIds[70]
          : Q && F.team
            ? Q[F.team - 1].dyeId
            : void 0,
        O0 = c ? jM(l0, z, F0) : l0,
        z0 = M.characters.find((x0) => x0.itemId === O0.equipment.itemIds[1]);
      if (!j || !z0 || j.engineGrade === void 0)
        throw new Error(`${F.name} 的赛车/人物身份缺失。`);
      j6(j.itemId);
      const W = await g.timeAttackCharacterItem(z0.itemId, z0.path);
      if (!W) throw new Error(`${F.name} 的人物参数缺失。`);
      const R2 = (await t3(g, j.path, j.systemKey)).parameter.value,
        I0 = j.itemId === 0 ? R2 : void 0;
      w();
      const { spec: o2 } = JI(
          { itemId: j.itemId, systemKey: j.systemKey },
          u.speed,
          I0,
          u.version,
        ),
        G0 =
          X || t.rp
            ? {}
            : v40(a, F.playerId, r.playerId, j.itemId, r0.kartSerial),
        D0 = z || t.rp ? await Ma(g, r0.itemIds[52]) : void 0;
      let E0 = D0
        ? LI(
            o2,
            j.engineGrade,
            G0,
            e.speed,
            R2,
            await x4.load(g, D0.internalId),
            (x0) => h6(x0, u.version, u.speed),
          )
        : h6(e6(o2, j.engineGrade, G0, e.speed), u.version, u.speed);
      e.speed === 4 && (E0 = { ...E0, driftMaxGauge: Lo });
      const f2 = G20(l0, j.engineGrade, z && !X && !t.rp ? a : void 0),
        O2 = c ? jM(f2, z, F0) : f2;
      m40(j, O2);
      const B = new ul(rd(n, O2)),
        R = await B.loadVehicleAsset(
          j.path,
          j.itemId,
          j.systemKey,
          E0,
          E.id,
          C.environment,
          C.stageBinding,
          i,
          void 0,
          k,
          void 0,
          !z,
          z && l,
        );
      (S.push(() => y40(R)), w());
      const $ = await mv.load(
        g,
        R.imported.renderScene,
        C.environment,
        C.stageBinding,
      );
      ($ && S.push(() => $.dispose()), w());
      const o0 = F0 ?? O2.equipment.itemIds[70],
        c0 = await (
          Q
            ? new ul(
                rd(n, {
                  ...O2,
                  equipment: {
                    ...O2.equipment,
                    itemIds: { ...O2.equipment.itemIds, 70: o0 },
                  },
                }),
              )
            : B
        ).loadRaceCharacters(
          z0.path,
          W,
          R.kartItem,
          R.visual.reverse,
          R.physicsParams.motorcycleType,
          C.environment,
          C.stageBinding,
          !0,
        );
      (S.push(() => {
        (c0.ordinary?.scene.dispose(), c0.linked?.scene.dispose());
      }),
        w(),
        L.push({
          characterDyeId: o0,
          playerId: F.playerId,
          slot: F.slot,
          profile: f2,
          vehicle: R,
          draftEffect: $,
          characters: c0,
          remoteParameters: u10(U.value, R2, J5(R.imported.model).rootBounds),
          collisionBalance: {
            ordinary: E0.antiCollideBalance,
            charger: E0.chargeAntiCollideBalance,
          },
        }));
    }
    if (!n.isGenerationCurrent(A))
      throw new Error("多人比赛装配期间资源库已变化。");
    return {
      rp: t.rp ? mI(t.rp) : void 0,
      lteCoins: D,
      roadblockRunnerId: t.roadblock?.runnerId,
      channel: y,
      checkClientFramerate: b,
      anonymous: c,
      competition: u.competition,
      mode: e.mode,
      drivingMode: vI(SX(e)),
      speed: e.speed,
      roomId: e.roomId,
      raceId: t.raceId,
      map: C,
      lensFlare: V,
      rain: K,
      rainAudio: P,
      snow: q,
      participants: L,
      draftAudio: e0,
      dispose: I,
    };
  } catch (D) {
    throw (I(), D);
  }
}

const v4 = 56,
  b40 = v4 + 178,
  pe = (n, e) => Number.isInteger(n) && n >= 0 && n <= e;





























function No(incoming, current) { return isNewMotionSequence(incoming, current); }

function B40(n, e) {
  const t = n.driveCameraRuntime();
  return {
    forwardSpeed: n.state.forwardSpeed,
    rawSteer: e.rawSteer,
    tireTransient: t.tireTransient,
    boosterState: t.stateCode,
    instantAccelerationActive: t.action8,
    motorcycle: t.motorcycleType,
    landingTrigger: t.landingMotionTrigger,
    collisionHit: t.collisionMotionHit,
    collisionStrength: t.collisionMotionStrength,
    visualScaleMode: t.visualScaleMode,
  };
}

function R40(n) {
  return {
    physicsState: n.audioState(),
    displaySpeedKmh: n.displaySpeedKmh(),
    dualMode: n.dualBoosterMode(),
    dualBoosterState: n.dualBoosterState(),
    dualReadyRemainingMs: n.dualBoosterReadyRemainingMs(),
    dualTeam: n.dualBoosterTeam(),
    chargerActive: n.timeAttackTachometerCharger().active,
  };
}

class I40 extends VehicleMotionSender {}

class k40 extends VehicleMotionReceiver {}

const Y3 = (n, e) => n - e.offsetMs;

function fL(n, e) {
  const t = Math.trunc(e) >>> 0;
  return n !== 0 && (n + 100) >>> 0 >= t && (n - 100) >>> 0 <= t;
}

const H9 = Math.fround;

class F40 extends LteDodgeMotion {}

class D40 extends LteDodgeInput { constructor() { super(lteDodgeInputOps); } }

function gL(n, e) {
  if (n.phase === 0 || n.startMs === 0) return !0;
  const t = Math.max(0, (e >>> 0) - (n.startMs >>> 0));
  return gv(t);
}

function pr() {
  return { phase: 0, startMs: 0 };
}

function mL(n) {
  return n.phase === 0 ? { phase: 1, startMs: 0 } : n;
}

function wL(n, e, t) {
  const i = e >>> 0;
  if (n.phase === 0) return { state: n, actions: [] };
  const r = n.startMs >>> 0;
  if (r === 0) return { state: { phase: n.phase, startMs: i }, actions: [] };
  if (i < r || n.phase < 1 || n.phase > 3)
    return { state: pr(), actions: ["restore-interaction", "suspend-physics"] };
  let s = n.phase;
  const o = [];
  for (;;)
    if (s === 1) {
      if (!(i > (r + 500) >>> 0))
        return { state: { phase: s, startMs: r }, actions: o };
      (o.push("complete-checkpoint-pose", "suspend-physics"), (s = 2));
    } else if (s === 2) {
      if (!(i > (r + 1e3) >>> 0))
        return { state: { phase: s, startMs: r }, actions: o };
      (o.push("resume-physics"), (s = 3));
    } else
      return i > (r + 2e3) >>> 0
        ? (o.push("restore-interaction"), { state: pr(), actions: o })
        : { state: { phase: s, startMs: r }, actions: o };
}

class yL extends NormalRaceCoordinator { constructor(mode, track, kart, sink) { super(mode, track, kart, sink, normalRaceModes); } }

const W40 = {
    forward: 0,
    reverse: 0,
    steer: 0,
    rawSteer: 0,
    steeringInverted: !1,
    rawDriftHeld: !1,
    derivedDriftHeld: !1,
    actionMarkerWord: 0,
  },
  od = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ],
  Cs = 6,
  _g = 14,
  H40 = m(8e3),
  q40 = m(0.1),
  K40 = 350;

function ec(n) {
  return n === Cs || n === _g;
}

const x5 = m(0.5), VC = { x: 0, y: m(-58.80000305175781), z: 0 }, ad = { x: 0, y: 1, z: 0 }, mi = m(0.5), NC = m(3.141592025756836), OC = [m(2), m(0.5)], tc = [
    [120, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1],
    [120, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1],
    [340, -1, -1, 1, 0, 0, 1, 0.6, 1, 1, 1],
    [120, 0, 0, 1, 0, 0, 1, 0.85, 1, 1, 1],
    [180, 0, 0, 0.5, 0, 0, 1, 0.6, 1, 1, 1],
    [120, -2, -2, 1, 0, 0, 1, 1, 1, 1, 1],
  ], cd = m(0.800000011920929), zC = m(0.800000011920929), j40 = m(0.18000000715255737), ld = m(-9.800000190734863), UC = m(0.30000001192092896), ud = m(0.0020000000949949026), X40 = F4(1062380241), Y40 = F4(1058398929), $C = F4(1064666457), WC = F4(3204993777), HC = F4(1065533027), Z40 = F4(1063930709), Q40 = F4(1059516753), cs = [
    [0, 0.8999999761581421, 0.8999999761581421, 1.399999976158142],
    [100, 1.399999976158142, 1, 0.6000000238418579],
    [200, 0.699999988079071, 1, 1.2999999523162842],
    [300, 1.100000023841858, 1, 0.8999999761581421],
    [400, 0.800000011920929, 1, 1.2000000476837158],
    [500, 1.2000000476837158, 1, 0.800000011920929],
    [600, 1.2000000476837158, 1.2000000476837158, 1.2000000476837158],
  ], nc = [
    [0, 1, 1, 1],
    [400, 7, 7, 7],
    [500, 9, 7, 5],
    [600, 5, 7, 9],
    [700, 8, 7, 6],
    [800, 6, 7, 8],
    [850, 7.5, 7, 6.5],
    [900, 7, 7, 7],
  ], qC = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];

export { $40, $C, A40, A7, AS, Ak, B40, Bk, Bt, Cs, D40, Do, Ea, Eg, Fk, Gr, H40, HC, I40, In0, J40, JI, Jw, K40, L40, Me0, NC, No, OC, Pt0, Q40, Qf0, Qk, R40, S40, Ta, Tk, UC, Uk, VC, Vo, W40, WC, X40, Y3, Y40, Yf0, Z40, Zf0, _g, ad, ag, bS, cd, cs, cv, d6, d7, dr, ec, ev, f30, fL, fr, fv, gL, gv, h6, hr, iL, j40, k40, ld, m7, mL, mi, nc, od, ok, p7, pL, pe0, pk, pr, q40, qC, rL, rk, sL, sk, tc, ud, ul, v7, vL, w4, w7, wL, wk, x5, y7, yL, yk, zC };
