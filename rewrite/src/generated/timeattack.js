// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { TouchLayoutEditor } from "../input/touch-layout-editor.ts";
import { TouchDrivingControls } from "../input/touch-driving-controls.ts";
import { VehiclePreviewRenderer } from "../timeattack/vehicle-preview-renderer.ts";
import { FirstRiderDialog } from "../timeattack/first-rider-dialog.ts";
import { loadRiderImages } from "../timeattack/first-rider-assets.ts";
import { buildSoloRaceAssets } from "../timeattack/race-asset-builder.ts";
import { RaceCameraCoordinator } from "../timeattack/race-camera-coordinator.ts";
import { InterfaceAudio } from "../timeattack/interface-audio.ts";
import { FrameRateCounter, TimeAttackInterfaceOwners } from "../timeattack/race-auxiliary-owners.ts";
import { handleRouteSurfaceTag, warpNextEventFrame, applyWarpNextActions, applyWarpNextAction, freezeWarpCamera } from "../timeattack/route-surface-listener.ts";
import { selectRaceBgmTheme, raceBgmArchiveTracks, loadRaceBgmPlaylist, decodeBgmResource, requiredBgmResource, garageBgmResource, canonicalBgmPath } from "../timeattack/race-bgm-resources.ts";
import { ghostEquipmentFromKsv, ghostEquipmentProfile, ghostItemId } from "../timeattack/ghost-equipment.ts";
import { PauseMenuView } from "../timeattack/pause-menu-view.ts";
import { PAUSE_VIEW_WIDTH, PAUSE_VIEW_HEIGHT, PAUSE_FONT_FAMILY, loadPauseMenuAssets, pauseButtonHits, pauseString, requiredPauseChild } from "../timeattack/pause-menu-assets.ts";
import { GhostMenuPanel } from "../timeattack/ghost-menu-panel.ts";
import { TimeAttackRaceState, TimeAttackResultOverlay } from "../timeattack/race-display-state.ts";
import { cloneGhostToonMaterials, ghostEffectNames, ghostTrailState } from "../timeattack/ghost-visual-helpers.ts";
import { ksvCompression as fD } from "../codecs/ksv-compression.ts";
import { StageManager as wf0 } from "../app/stage-manager.ts";
import { advancePresentationFrame, renderPresentationFrame } from "../app/frame-loop.ts";
import { startPresentationLoop, disposePresentationLoop } from "../app/presentation-scheduler.ts";
import { releaseRaceForReady } from "../app/race-cleanup.ts";
import { applyRaceOptions, replaceRaceTrack } from "../app/race-configuration.ts";
import { checkAutomaticReset, checkLowHeightReset, initiateSpeedReset } from "../timeattack/automatic-reset.ts";
import { advanceCheckpointReset, warpToCheckpoint, warpToPoint } from "../timeattack/checkpoint-reset.ts";
import { updateTimeAttackDriving } from "../timeattack/driving-loop.ts";
import { captureGhostRuntime } from "../timeattack/ghost-capture.ts";
import { GhostParticipantStream, GhostPlayback, GhostPoseRecorder, GhostRecorder, GhostRouteProgress } from "../timeattack/ghost-runtime.ts";
import { hydrateGhostSummaryIndex, syncGhostSummaryIndex } from "../game/ghost-summary-sync.ts";
import { loadGhostDecorations, loadGhostKartAssets, rankGhostColors } from "../timeattack/ghost-asset-loading.ts";
import { deleteGhostRecord, exportGhostKsv, exportGhostSource, ghostRecord, ghostRecordKey, ghostTrackIdFromKey, persistGhostSummaries, promoteGhostRecord, putGhostRecord, restoreGhostRecordLibrary, saveGhostRecord, saveImportedGhostRecord, saveRawGhostRecord } from "../timeattack/ghost-record-library.ts";
import { deleteGhostFromMenu, exportGhostFromMenu, importSelectedGhostFile, isCurrentGhostImport, switchToImportedGhostTrack } from "../timeattack/ghost-menu-import.ts";
import { deleteGhostMenuRecord, exportGhostMenuRecord, importGhostMenuRecord, mountGhostMenuBridge, resolveGhostMenuKartTitle, resolveGhostMenuTrack } from "../timeattack/ghost-menu-host.ts";
import { deriveGhostVisualMotion, isGhostDualTeam, updateGhostVisualAnimation } from "../timeattack/ghost-visual-motion.ts";
import { attachGhostVisualToScene, disposeGhostVisual, seedGhostVisualStart, setGhostVisualEffects, setGhostVisualTrails } from "../timeattack/ghost-visual-lifecycle.ts";
import { setGhostVisualAssets, setGhostVisualDecorations } from "../timeattack/ghost-visual-assets.ts";
import { updateGhostVisualFrame } from "../timeattack/ghost-visual-update.ts";
import { advanceRaceBgmTransition, clearRaceBgmTransition, currentRaceBgmName, disposeRaceBgm, playGarageBgm, playMultiplayerBgm, playMultiplayerFinishBgm, playMultiplayerPodiumBgm, playMyItemsBgm, playReadyBgm, playResultBgm, restartRaceBgm, silenceRaceBgm, startRaceBgm, stopRaceBgmOwner } from "../timeattack/race-bgm-playback.ts";
import { loadRaceBgm, prepareMultiplayerBgm, selectRaceBgm } from "../timeattack/race-bgm-loading.ts";
import { drainTimeAttackDrivingInput, resetTimeAttackTachometerInput, routeBaseDrivingCommand, routeTimeAttackDrivingCommand, routeTimeAttackRaceCommand, setTimeAttackAutoForward, setTimeAttackNitroSeamlessMode, timeAttackDrivingSnapshot } from "../timeattack/driving-input-bridge.ts";
import { GhostSmoothSampler } from "../timeattack/ghost-smooth-sampler.ts";
import { rankBoardValues, renderGameplayUi } from "../timeattack/race-hud.ts";
import { placeAtStart, seedGhostStart, snapStartToGround } from "../timeattack/start-grid.ts";
import { updateTimeAttackStage } from "../timeattack/stage-update.ts";
import { renderTimeAttackStage } from "../timeattack/stage-render.ts";
import { TimeAttackLifecycle as GF } from "../timeattack/lifecycle.ts";
import { dispatchTimeAttackActions, handleTimeAttackFinishAction, playTimeAttackActionAudio, showTimeAttackResult } from "../timeattack/action-dispatch.ts";
import { restartTimeAttackRace } from "../timeattack/race-reset.ts";
import { publishSoloRace } from "../timeattack/race-publication.ts";
import { buildRawRaceRecording, captureRaceReplay, currentRaceEquipment, promoteRaceRecord, restoreRaceRecords } from "../timeattack/record-service.ts";
import { disposeTimeAttackInterface, enterTimeAttackStage, exitTimeAttackStage, updateTimeAttackRoute } from "../timeattack/stage-lifecycle.ts";
import { LD, V_, N_, Dh0, Vh0, O_ } from "../game/ghost-records.ts";
import { Ah0, bh0 } from "../game/ghost/frame-codec.ts";
import { Th0 } from "../game/ghost/record-store.ts";
import { decodeKsvFile, encodeKsvFile } from "../game/ghost/ksv-codec.ts";
import { buildGhostKsvHeader, encodeGhostKsvRecording, ghostKsvEquipment, nativeFrameToKsvStamp } from "../timeattack/ghost-ksv-export.ts";
import { D2, El, H, I4, T2, l2, qe, v2 } from "./vendor.js";
import { $2, $p, C9, Co, Dt, E9, Ft, G1, H2, Hn, J5, MK, O6, Oe, Ol, Pp, T, TW, V0, We, ZG, an, aw, b4, ct, da, e4, f3, f4, f5, gX, j6, jm, m9, ma, p2, p3, pX, s2, st, t3, wK, xe, yo, zB } from "./formats.js";
import { $w, Ca, KI, LI, Ma, NR, Q6, Q9, Qc, S9, Tr, Ww, c7, dI, e6, eI, fn, hI, he, i3, oI, p5, qM, tI, u5, x4 } from "./library.js";
import { A7, AS, Bt, Ea, Gr, Jw, Pt0, Tk, Vo, ev, fL, fv, gL, h6, hr, m7, mL, pr, sL, ul, v7, vL, w4, w7, wL, y7, yL } from "./vehicle.js";
import { AL } from "./driving.js";
import { $v, Br, JL, KL, LL, M7, OL, PL, QL, S4, SP, Ue, XL, _L, _a, aP, b7, eP, f6, kL, kv, oP, uP, ut, x7, xv, y6, ze, zn } from "./world.js";
import { Fc0, Lt, Qs, T4, T7, gr } from "./ui.js";
import { Jl0, Ne, Un, e60, t60, xl } from "./multiplayer.js";

const vehiclePreviewDependencies = { createRenderer: () => new I4({ alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }), outputColorSpace: qe, createCamera: (width, height) => Qs("preview", width, height), createImportToken: () => new Tr(), loadSubject: T7, disposeSubject: Lt, updateSubject: T4, renderScene: f4 };
const firstRiderDialogDependencies = { parseBml: s2, attribute: T, frameState: Ft, windowRect: V0, frameInset: E9, captionOffset: an, captionRect: f3, loadImage: async bytes => $p(await createImageBitmap(new Blob([bytes], { type: "image/png" }))), pixelRatio: xe, resizeCanvas: p3, drawFrame: C9, drawText: m9, positionInput: aw, contains: Oe, createPreview: (width, height) => Py.create(width, height), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id), now: () => performance.now() };
const raceCameraDependencies = { versionTag: tag => Bt(tag), get processState() { return zB; }, createDrive: state => new Ol(state), createSurround: () => new KL() };
const interfaceAudioDependencies = { decode: (context, bytes) => Q9(context, bytes), route: (context, source) => S9(context, source) };
const routeSurfaceListenerDependencies = { routeEffect: tag => Vo(tag) };
const soloRaceBuildDependencies = {
  validateItemId: value => j6(value), findKart: (...args) => b4(...args),
  loadParameterFactory: () => ghostAssetDependencies.loadParameterFactory(),
  speed: options => y6(options), get defaultVersion() { return ze; },
  loadBodyParameter: (...args) => t3(...args),
  garageState: (...args) => p5(...args), tuneSpec: (...args) => e6(...args),
  flyingPetItem: (...args) => Ma(...args),
  applyFlyingPetSpec: (...args) => LI(...args),
  loadFlyingPetAbility: (library, id) => x4.load(library, id),
  finalizeSpec: (...args) => h6(...args),
  particleModification: (...args) => uP(...args),
  loadParticleBanner: (library, root) => x7.load(library, root),
  createAudioContext: () => new AudioContext(),
  configureAudio: (context, options) => Qc(context, options),
  loadRaceBgm: (...args) => P7.load(...args),
  createBoosterVisuals: () => new KI(),
  createOutlineBatch: () => new wK(),
  createPhysics: (...args) => new AL(...args),
  loadLensFlare: (...args) => w7.load(...args),
  createTrack: (...args) => new _L(...args),
  applyTrackFog: (...args) => kv(...args),
  prepareScene: (...args) => Hn(...args),
  createRain: (...args) => new sL(...args),
  loadRainAudio: (...args) => y7.load(...args),
  loadSnow: (...args) => A7.load(...args),
  loadTachometer: (...args) => eI(...args),
  loadMinimap: (...args) => oI(...args),
  createGameplayUi: (...args) => new tI(...args),
  loadAction2D: (...args) => hI(...args),
  createAction2D: asset => new dI(asset),
  loadResult: (...args) => pX(...args),
  createResult: asset => new Rd0(asset),
  versionTag: tag => Bt(tag),
  loadTrackInfoCard: options => M7.load(options),
  loadPause: options => Dy.load(options),
  loadCountdown: (...args) => Q6.load(...args),
  loadEventEffects: (...args) => b7.load(...args),
  loadEventAudio: (...args) => v7.load(...args),
  loadDummyAudio: (...args) => m7.load(...args),
  serializedRoot: model => J5(model),
  createLinkedPresentation: (...args) => new _a(...args),
  loadFlyingPet: options => S4.race(options),
  loadPaintColor: (...args) => We(...args),
  now: () => performance.now(), get accessorySockets() { return oP; },
  attachAura: (...args) => ev(...args),
  createGhostView: () => new Xd0(),
  createGhostPlayback: (record, mode) => new nf0(record, mode),
  loadGhostEffects: (...args) => Ca.load(...args),
  loadGhostTrails: (...args) => Ea.load(...args),
  ghostEffectNames: record => tf0(record),
  ghostItemIds: equipment => U_(equipment),
  disposeImportedObject: object => u5(object),
};
const pauseAssetDependencies = { parseBml: s2, decodePng: p2, attribute: T, frameState: Ft, captionOffset: an, loadAutoImage: ma, registerFont: f5, frameInset: E9, windowRect: V0 };
const pauseMenuViewDependencies = { width: PAUSE_VIEW_WIDTH, height: PAUSE_VIEW_HEIGHT, fontFamily: PAUSE_FONT_FAMILY, loadAssets: library => zd0(library), releaseFont: G1, string: pauseString, smoothImages: Co, drawFrame: C9, captionRect: f3, drawText: m9, buttonHits: (assets, dialog) => pauseButtonHits(assets, dialog, pauseAssetDependencies), buttonState: st, drawButton: ct, resizeCanvas: p3, pixelRatio: xe, dialogRect: assets => V0(requiredPauseChild(assets.definition, "CaptionWindow"), { x: 0, y: 0, width: PAUSE_VIEW_WIDTH, height: PAUSE_VIEW_HEIGHT }, assets.captionFrame), contains: Oe };
const raceStateDependencies = { createLifecycle: () => new GF(), createSpeedResetState: pr };
const resultOverlayDependencies = { createRenderer: () => new fn(new Map()), buildItems: gX };
const ghostToonDependencies = { isMesh: value => value instanceof D2, isToon: zn, prepareClone: OL, refreshMesh: ZG, copyToon: f6 };
const ghostEffectDependencies = { boosterState: RD, boosterEffect: $w, secondaryEffect: Ww, secondaryState: ID };
const presentationFrameDependencies = { nowMs: () => performance.now(), isRaceFinished: Un, requestFrame: callback => requestAnimationFrame(callback) };
const presenterRaceDependencies = { setToonLinesEnabled: Pp, newSpeedResetState: pr, nowMs: () => performance.now(), applyTrackFog: kv, isManualBoostTachometer: value => value instanceof Gr };
const timeAttackStageDependencies = { nowMs: () => performance.now(), bodyQuaternion: PL, statusFlags: GD, racingPhase: Ne.Racing, isRaceFinished: Un, beginResetState: mL, advanceState: wL, kartVisible: gL, isDrivingPhase: Jl0, countdownPhase: Ne.Countdown, finishAcceptedPhase: Ne.FinishAccepted, refreshTachometer: eP, rankParticipants: XL, elapsedRaceMs: ff0, relativeGhostTime: nG, newGhostPoseBuffer: () => kL(), decodeGhostPose: LL, setVisualScaleMode: MK, isExhaustActive: Tk, particleRatio: Pt0, roadDescriptorName: TW, slotOffset: iG, createGhostRouteProgress: track => new hf0(track), compose: gf0, updateTachometer: QL, renderTachometer: JL, prepareWorldScene: e4, renderWithColorPipeline: yo, worldAxis: H2, depthAxis: $2 };
const recordServiceDependencies = { recordKey: (selection, options) => Pt.recordKey(selection, options), resolveSpeed: Ue, validateSpeed: y6 };
const ghostPoseRecorderDependencies = { interpolatePose: Ih0, encodeStamp: xD };
const ghostPlaybackDependencies = { decodeRouteStamp: By, sampleC1: Jh0, sampleC2: ed0, sampleNative: FD, createSmoothSampler: record => new Yh0(record) };
const ghostAssetDependencies = { findKart: b4, loadParameterFactory: async () => { const { createVehicleTimeAttackParameters } = await El(async () => { const { createVehicleTimeAttackParameters } = await Promise.resolve().then(() => AS); return { createVehicleTimeAttackParameters }; }, void 0); return createVehicleTimeAttackParameters; }, loadBodyParameter: t3, ghostItemIds: U_, loadPaintColor: We, createBalloon: Jw, createAccessory: hr };
const ghostRecordLibraryDependencies = { restoreSummaries: Vh0, trackIdFromKey: key => Pt.trackIdFromKey(key), errorMessage: z_, zCeiling: B6, commonTimeBase: Dh0, debug: Nf, get storage() { return localStorage; }, get summaryStorageKey() { return PD; }, hydrateSummaries: hydrateGhostSummaryIndex, syncSummaries: syncGhostSummaryIndex };
const ghostExportDependencies = { filename: V_, zCeiling: B6, encodeKsvFile: ph0 };
const ghostMenuImportDependencies = { decodeKsv: pd0, toGhostRecord: gd0, toSelection: zD, selectionLabel: X_, mergeTrackSelection: md0 };
const ghostMenuPanelDependencies = { get samplingLabels() { return qh0; }, nextSamplingMode: Xh0, saveSamplingMode: jh0, import: ghostMenuImportDependencies };
const ghostVisualAssetDependencies = { serializedRoot: J5, createLinkedPresentation: (root, mount, driver, always) => new _a(root, mount, driver, always), collectToonPairs: qf, createBalloonMount: c7, get decorationSockets() { return jd0; }, nowMs: () => performance.now() };
const ghostVisualUpdateDependencies = { decodePose: (frame, scratch) => LL(frame, scratch), decodeBasis: (basis, scratch) => xv(basis, scratch), boosterState: status => RD(status), secondaryState: status => ID(status), instantAcceleration: status => P_(status), copyToon: (source, clone) => f6(source, clone), nextTrailState: (status, prior, vehicle) => Kd0(status, prior, vehicle) };
const raceBgmPlaybackDependencies = { setLoop: (source, loop) => w4(source, loop), setGain: (gain, value, time) => he(gain, value, time), connect: (context, source, channel, gain) => S9(context, source, channel, gain), setDucking: (context, fading) => qM(context, fading), fadeCurve: step => Qd0(step), schedule: (callback, delay) => setInterval(callback, delay), cancel: timer => clearInterval(timer) };
const raceBgmLoadingDependencies = { resource: (library, path) => G5(library, path), garageMusic: (library, single) => ef0(library, single), parseMultiplayerList: (xml, path) => Fc0(xml, path), decodeBuffer: (resource, context) => Kt(resource, context), racePlaylist: (library, track, context) => eG(library, track, context), create: (context, playlist, ready, garage, win, lose, random) => new P7(context, playlist, ready, garage, win, lose, random) };
const timeAttackInputBridgeDependencies = { get racingPhase() { return Ne.Racing; }, get forwardAction() { return l2.Forward; }, acceptsTimeAttackInput: lifecycle => e60(lifecycle), activeRace: lifecycle => t60(lifecycle), isTachometer: value => value instanceof fv };
const ghostSmoothSamplerDependencies = { sampleNative: (record, timeMs) => FD(record, timeMs), smoothVelocity: (tail, head, prior, elapsed) => Zh0(tail, head, prior, elapsed), magnitude: velocity => fd0(velocity), float32: value => L9(value), renderBasis: (velocity, speed, quaternion) => Qh0(velocity, speed, quaternion) };
const ghostKsvExportDependencies = { encodeStatus: (...args) => GD(...args), encodeRuntimeStamp: (stamp, zCeiling) => xD(stamp, zCeiling), createRecorder: zCeiling => new kD(zCeiling) };

class n60 {
  constructor(e) {
    this.host = e;
  }
  host;
    drainDrivingInput(nowMs, inputTime) { return drainTimeAttackDrivingInput(this, nowMs, inputTime, timeAttackInputBridgeDependencies); }
    handleDrivingCommand(command, nowMs, inputTime) { return routeTimeAttackDrivingCommand(this, command, nowMs, inputTime, timeAttackInputBridgeDependencies); }
    setAutoForwardEnabled(enabled) { return setTimeAttackAutoForward(this, enabled); }
    setNitroSeamlessMode(mode) { return setTimeAttackNitroSeamlessMode(this, mode); }
    getDrivingSnapshot() { return timeAttackDrivingSnapshot(this); }
    handleBaseDrivingCommand(command) { return routeBaseDrivingCommand(this, command); }
    handleTimeAttackDrivingCommand(command, nowMs, inputTime) { return routeTimeAttackRaceCommand(this, command, nowMs, inputTime, timeAttackInputBridgeDependencies); }
    resetTacho1InputMode(inputTime) { return resetTimeAttackTachometerInput(this, inputTime, timeAttackInputBridgeDependencies); }
}

class r60 extends TouchLayoutEditor {}

class l60 extends TouchDrivingControls { constructor(root, onAction, onPause, onAutoForwardChange, onNitroSeamlessChange) { super(root, onAction, onPause, onAutoForwardChange, onNitroSeamlessChange, { keyLabel: SP }); } }

const fm = 1500,
  pm = 3e3,
  wD = 590,
  vD = 50,
  G6 = 10,
  Qn = 1e4,
  Lc = 3e3,
  lh0 = -10;

function B6(n) {
  return n.toLowerCase() === "transformer_r02" ? pm : fm;
}

function fh0(n) {
  return n.time * 100;
}

function By(n) {
  return {
    timeMs: fh0(n),
    x: Math.fround(n.x / G6),
    y: Math.fround(n.y / G6),
    z: Math.fround(Math.fround(n.z / vD) + wD),
    w: Math.fround(n.w / Qn),
    qx: Math.fround(n.qx / Qn),
    qy: Math.fround(n.qy / Qn),
    qz: Math.fround(n.qz / Qn),
    status: n.status,
  };
}

function xD(n, e) {
  const t = Pf(n.z, lh0, e);
  return {
    time: Math.trunc((n.timeMs >>> 0) / 100),
    x: L3(Pf(n.x, -Lc, Lc) * G6),
    y: L3(Pf(n.y, -Lc, Lc) * G6),
    z: L3(Math.fround(t - wD) * vD),
    w: L3(Math.fround(n.w) * Qn),
    qx: L3(Math.fround(n.qx) * Qn),
    qy: L3(Math.fround(n.qy) * Qn),
    qz: L3(Math.fround(n.qz) * Qn),
    status: n.status & 65535,
  };
}

function Pf(n, e, t) {
  const i = Math.fround(n);
  return i > t ? Math.fround(t) : i < e ? Math.fround(e) : i;
}

function L3(n) {
  return Math.trunc(Math.fround(n));
}

function Ff(bytes, zCeiling) { return decodeKsvFile(bytes, zCeiling, fD); }

function ph0(recording, zCeiling) { return encodeKsvFile(recording, zCeiling, fD); }



function Gh0(n) {
  switch (n) {
    case 1:
      return 7;
    case 2:
      return 3;
    case 3:
      return 1;
    case 4:
      return 2;
    case 5:
      return 1;
    case 6:
      return 1;
    case 7:
      return 1;
    case 8:
      return 1;
    case 13:
      return 5;
    case 14:
      return 6;
    case 18:
      return 4;
    default:
      return 0;
  }
}

function GD(n, e, t, i) {
  let r = Gh0(n) & 7;
  if (i !== void 0 && Number.isFinite(i)) {
    const s = Math.trunc(i);
    s >= 3 && (r |= ((s - 3) & 15) << 3);
  }
  return (
    e && (r |= 128),
    n === 10 && (r |= 8192),
    t && (r |= 32768),
    r & 65535
  );
}

function BD(n) {
  switch (n & 7) {
    case 1:
      return 3;
    case 2:
      return 4;
    case 3:
      return 2;
    case 4:
      return 18;
    case 5:
      return 13;
    case 6:
      return 14;
    case 7:
      return 1;
    default:
      return 0;
  }
}

function RD(n) {
  const e = (n & 4096) !== 0;
  return (n & 8192) !== 0 && !e ? 10 : BD(n & 7);
}

function ID(n) {
  const e = (n & 4096) !== 0,
    t = (n & 8192) !== 0;
  return e === t ? 0 : e ? 1 : 3;
}

function P_(n) {
  return (n & 32768) !== 0;
}



class kD extends GhostPoseRecorder { constructor(zCeiling) { super(zCeiling, ghostPoseRecorderDependencies); } }

class Rh0 {
    encode(recording, zCeiling) { return encodeGhostKsvRecording(recording, zCeiling, ghostKsvExportDependencies); }
}

function Ih0(n, e, t) {
  const r =
      da(
        { w: e.w, x: e.qx, y: e.qy, z: e.qz },
        { w: n.w, x: n.qx, y: n.qy, z: n.qz },
      ) < 0,
    s = O6(
      {
        w: r ? -n.w : n.w,
        x: r ? -n.qx : n.qx,
        y: r ? -n.qy : n.qy,
        z: r ? -n.qz : n.qz,
      },
      { w: e.w, x: e.qx, y: e.qy, z: e.qz },
      t,
    ),
    o = (a, c) => Math.fround(Math.fround(Math.fround(c - a) * t) + a);
  return {
    timeMs: e.timeMs,
    x: o(n.x, e.x),
    y: o(n.y, e.y),
    z: o(n.z, e.z),
    w: s.w,
    qx: s.x,
    qy: s.y,
    qz: s.z,
    status: e.status,
  };
}



const kh0 = Uint8Array.of(0, 0, 0, 0);

class Lh0 {
    build(recording, encoded) { return buildGhostKsvHeader(recording, encoded); }
}



const PD = "kartrider-web:p3553:time-attack-records-v1";

class Pt {
  ghostStore = new Th0();
  summaries = new Map();
  ksvEncoder = new Rh0();
  ksvHeaderBuilder = new Lh0();
  get records() {
    return this.summaries;
  }
  get store() {
    return this.ghostStore;
  }
    record(key) { return ghostRecord(this, key); }
    static recordKey(selection, options) { return ghostRecordKey(selection, options, LD, Ue); }
    static trackIdFromKey(key) { return ghostTrackIdFromKey(key); }
    async restore(reportError) { return restoreGhostRecordLibrary(this, reportError, ghostRecordLibraryDependencies); }
    async promote(key, sources, trackId, summary) { return promoteGhostRecord(this, key, sources, trackId, summary); }
    async save(key, sources, summary) { return saveGhostRecord(this, key, sources, summary, ghostRecordLibraryDependencies); }
    async saveRaw(key, raw) { return saveRawGhostRecord(this, key, raw, ghostRecordLibraryDependencies); }
    async saveImported(key, sources, summary, bytes) { return saveImportedGhostRecord(this, key, sources, summary, bytes, ghostRecordLibraryDependencies); }
    async exportSource(key) { return exportGhostSource(this, key); }
    async exportKsv(key) { return exportGhostKsv(this, key, ghostExportDependencies); }
    async delete(key) { return deleteGhostRecord(this, key); }
    async put(key, sources, trackId, bytes) { return putGhostRecord(this, key, sources, trackId, bytes, ghostRecordLibraryDependencies); }
    persist() { return persistGhostSummaries(this, ghostRecordLibraryDependencies); }
}

function Nf(n, e) {
  new URLSearchParams(globalThis.location?.search ?? "").get("ghost-debug") ===
    "1" && console.debug("[ghost-recording]", n, e ?? {});
}

function z_(n) {
  return n instanceof Error ? n.message : String(n);
}

class Nh0 {
  constructor(e) {
    this.host = e;
  }
  host;
    restore() { return restoreRaceRecords(this); }
    async promote(elapsedMs, counts) { return promoteRaceRecord(this, elapsedMs, counts, recordServiceDependencies); }
    captureReplay(elapsedMs, counts, kartName) { return captureRaceReplay(this, elapsedMs, counts, kartName); }
    rawRecording(recorded, equipment, elapsedMs, counts, kartName) { return buildRawRaceRecording(this, recorded, equipment, elapsedMs, counts, kartName, recordServiceDependencies); }
    currentEquipment() { return currentRaceEquipment(this); }
}

function Oh0(n) {
  if (n.players.length === 0) throw new Error("KSV 缺少录影车手装备。");
  if (n.records.length !== n.players.length)
    throw new Error(
      `KSV 玩家数 ${n.players.length} 与帧记录数 ${n.records.length} 不一致，无法建立影子参与者。`,
    );
  return n.players.map((e, t) => ({
    equipment: zh0(e.equipment, e.playerName),
    record: n.records[t],
    timeBase: "countdown",
  }));
}

function zh0(equipment, playerName = '') { return ghostEquipmentFromKsv(equipment, playerName); }

function U_(equipment) { return ghostEquipmentProfile(equipment, gr); }



const Uh0 = 100;

function FD(n, e) {
  const t = n.stamps;
  if (t.length === 0) throw new Error("KSV 记录没有任何帧。");
  let i = 0,
    r = t.length;
  for (; i < r;) {
    const l = (i + r) >>> 1;
    t[l].time * 100 <= e ? (i = l + 1) : (r = l);
  }
  const s = i,
    o = s - 1;
  if (o < 0) return Dc(t[0]);
  if (s >= t.length) return Dc(t[t.length - 1]);
  const a = Dc(t[o]),
    c = Dc(t[s]);
  return $h0(a, c) >= Uh0 ? c : Wh0(a, c, e);
}

function Dc(n) {
  const e = By(n);
  return {
    timeMs: e.timeMs,
    x: e.x,
    y: e.y,
    z: e.z,
    quaternion: { w: e.w, x: e.qx, y: e.qy, z: e.qz },
    status: e.status,
  };
}

function $h0(n, e) {
  const t = Math.fround(e.x - n.x),
    i = Math.fround(e.y - n.y),
    r = Math.fround(e.z - n.z),
    s = Math.fround(
      Math.fround(Math.fround(t * t) + Math.fround(i * i)) + Math.fround(r * r),
    );
  return Math.fround(Math.sqrt(s));
}

function Wh0(n, e, t) {
  const i = e.timeMs - n.timeMs;
  if (i <= 0) return e;
  const r = Math.fround((t - n.timeMs) / i),
    s =
      da(e.quaternion, n.quaternion) < 0
        ? {
            w: -n.quaternion.w,
            x: -n.quaternion.x,
            y: -n.quaternion.y,
            z: -n.quaternion.z,
          }
        : n.quaternion;
  return {
    timeMs: t,
    x: Math.fround(Math.fround(e.x - n.x) * r + n.x),
    y: Math.fround(Math.fround(e.y - n.y) * r + n.y),
    z: Math.fround(Math.fround(e.z - n.z) * r + n.z),
    quaternion: O6(s, e.quaternion, r),
    status: n.status,
  };
}

const Hh0 = 0.01,
  Of = 1e3,
  Cl = ["native", "native-smooth", "c1", "c2"],
  qh0 = {
    native: "原生",
    "native-smooth": "原生平滑",
    c1: "C1 曲线",
    c2: "C2 曲线",
  },
  DD = "kartsim.ghost-sampling";

function Kh0() {
  try {
    const n = localStorage.getItem(DD);
    return Cl.includes(n) ? n : "native";
  } catch {
    return "native";
  }
}

function jh0(n) {
  try {
    localStorage.setItem(DD, n);
  } catch {}
}

function Xh0(n) {
  const e = Cl.indexOf(n);
  return Cl[(e + 1) % Cl.length];
}

class Yh0 extends GhostSmoothSampler { constructor(record) { super(record, ghostSmoothSamplerDependencies); } }

function Zh0(n, e, t, i) {
  const r = Math.min(1, L9(L9(i) * Hh0)),
    s = L9(L9(L9(e.x - n.x) / L9(i)) * Of),
    o = L9(L9(L9(e.y - n.y) / L9(i)) * Of),
    a = L9(L9(L9(e.z - n.z) / L9(i)) * Of);
  return {
    x: L9(L9(s * r) + L9(t.x * L9(1 - r))),
    y: L9(L9(o * r) + L9(t.y * L9(1 - r))),
    z: L9(L9(a * r) + L9(t.z * L9(1 - r))),
  };
}

function Qh0(n, e, t) {
  if (e === 0) return hd0(t);
  const i = K_(n, -1 / e),
    r = ud0(t),
    s = K_(dd0(r, i), -1);
  return [
    { x: s.x, y: i.x, z: r.x },
    { x: s.y, y: i.y, z: r.y },
    { x: s.z, y: i.z, z: r.z },
  ];
}

function Jh0(n, e) {
  if (n.stamps.length === 0) throw new Error("KSV C1 采样记录没有任何帧。");
  return VD(n, e, (t) => ({ position: nd0(t), quaternion: ND(t) }));
}

function ed0(n, e) {
  if (n.stamps.length === 0) throw new Error("KSV C2 采样记录没有任何帧。");
  return VD(n, e, (t) => ({ position: id0(t), quaternion: ND(t) }));
}

const $_ = new WeakMap();

function VD(n, e, t) {
  const i = n.stamps;
  let r = 0,
    s = i.length;
  for (; r < s;) {
    const a = (r + s) >>> 1;
    i[a].time * 100 <= e ? (r = a + 1) : (s = a);
  }
  let o = $_.get(n);
  if ((o || ((o = i.map(td0)), $_.set(n, o)), r === 0))
    return zf(o, 0, t, e, o[0].timeMs);
  if (r >= i.length) {
    const a = o.length - 1;
    return zf(o, a, t, e, o[a].timeMs);
  }
  return zf(o, r - 1, t, e, e);
}

function zf(n, e, t, i, r) {
  const s = n[e],
    a = n[Math.min(e + 1, n.length - 1)].timeMs - s.timeMs,
    c = a <= 0 ? 0 : (r - s.timeMs) / a,
    { position: l, quaternion: u } = t({ frames: n, index: e, amount: c });
  return { timeMs: i, x: l.x, y: l.y, z: l.z, quaternion: u, status: s.status };
}

function td0(n) {
  const e = By(n),
    t = ky({ w: e.w, x: e.qx, y: e.qy, z: e.qz });
  return {
    timeMs: e.timeMs,
    x: e.x,
    y: e.y,
    z: e.z,
    qx: t.x,
    qy: t.y,
    qz: t.z,
    qw: t.w,
    status: e.status,
  };
}

function nd0(n) {
  const { frames: e, index: t, amount: i } = n,
    r = Math.min(t + 1, e.length - 1),
    s = en(e[t]),
    o = en(e[r]),
    a = e[r].timeMs - e[t].timeMs,
    c = R6(e, t),
    l = R6(e, r),
    u = i,
    h = 2 * u * u * u - 3 * u * u + 1,
    d = u * u * u - 2 * u * u + u,
    f = -2 * u * u * u + 3 * u * u,
    p = u * u * u - u * u;
  return {
    x: h * s.x + d * a * c.x + f * o.x + p * a * l.x,
    y: h * s.y + d * a * c.y + f * o.y + p * a * l.y,
    z: h * s.z + d * a * c.z + f * o.z + p * a * l.z,
  };
}

function R6(n, e) {
  const t = Ry(n, e),
    i = Iy(n, e),
    r = n[i].timeMs - n[t].timeMs;
  if (r <= 0) return { x: 0, y: 0, z: 0 };
  const s = en(n[t]),
    o = en(n[i]);
  return { x: (o.x - s.x) / r, y: (o.y - s.y) / r, z: (o.z - s.z) / r };
}

function Ry(n, e) {
  let t = e - 1;
  for (; t >= 0 && n[t].timeMs >= n[e].timeMs;) t -= 1;
  return t >= 0 ? t : e;
}

function Iy(n, e) {
  let t = e + 1;
  for (; t < n.length && n[t].timeMs <= n[e].timeMs;) t += 1;
  return t < n.length ? t : e;
}

function id0(n) {
  const { frames: e, index: t, amount: i } = n,
    r = Math.min(t + 1, e.length - 1),
    s = en(e[t]),
    o = en(e[r]),
    a = e[r].timeMs - e[t].timeMs,
    c = R6(e, t),
    l = R6(e, r),
    u = W_(e, t),
    h = W_(e, r),
    d = i,
    f = 1 - 10 * d ** 3 + 15 * d ** 4 - 6 * d ** 5,
    p = d - 6 * d ** 3 + 8 * d ** 4 - 3 * d ** 5,
    v = 0.5 * d ** 2 - 1.5 * d ** 3 + 1.5 * d ** 4 - 0.5 * d ** 5,
    w = 10 * d ** 3 - 15 * d ** 4 + 6 * d ** 5,
    g = -4 * d ** 3 + 7 * d ** 4 - 3 * d ** 5,
    y = 0.5 * d ** 3 - d ** 4 + 0.5 * d ** 5;
  return [
    { h: f, p: s },
    { h: p * a, p: c },
    { h: v * a * a, p: u },
    { h: w, p: o },
    { h: g * a, p: l },
    { h: y * a * a, p: h },
  ].reduce(
    (A, x) => ({
      x: A.x + x.h * x.p.x,
      y: A.y + x.h * x.p.y,
      z: A.z + x.h * x.p.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
}

function W_(n, e) {
  const t = Ry(n, e),
    i = Iy(n, e);
  if (t === e || i === e) return { x: 0, y: 0, z: 0 };
  const r = en(n[t]),
    s = en(n[e]),
    o = en(n[i]),
    a = n[e].timeMs - n[t].timeMs,
    c = n[i].timeMs - n[e].timeMs;
  if (a <= 0 || c <= 0) return { x: 0, y: 0, z: 0 };
  const l = n[i].timeMs - n[t].timeMs,
    u = { x: (s.x - r.x) / a, y: (s.y - r.y) / a, z: (s.z - r.z) / a },
    h = { x: (o.x - s.x) / c, y: (o.y - s.y) / c, z: (o.z - s.z) / c };
  return {
    x: (2 * (h.x - u.x)) / l,
    y: (2 * (h.y - u.y)) / l,
    z: (2 * (h.z - u.z)) / l,
  };
}

function ND(n) {
  const { frames: e, index: t, amount: i } = n,
    r = Math.min(t + 1, e.length - 1),
    s = io(e[t]),
    o = io(e[r]),
    a = H_(e, t),
    c = H_(e, r),
    l = Math.min(Math.max(i, 0), 1);
  return rd0(s, o, a, c, l);
}

function H_(n, e) {
  const t = io(n[e]),
    i = Ry(n, e),
    r = Iy(n, e),
    s = i === e ? t : gm(io(n[i]), t),
    o = r === e ? t : gm(io(n[r]), t),
    a = od0(t),
    c = q_($f(a, s)),
    l = q_($f(a, o)),
    u = cd0({ w: c.w + l.w, x: c.x + l.x, y: c.y + l.y, z: c.z + l.z }, -0.25);
  return $f(t, ld0(u));
}

function rd0(n, e, t, i, r) {
  const s = Uf(n, e, r),
    o = Uf(t, i, r);
  return Uf(s, o, 2 * r * (1 - r));
}

function Uf(n, e, t) {
  const i = gm(e, n),
    r = Math.min(1, Math.max(-1, OD(n, i))),
    s = Math.acos(r);
  if (s < 1e-6) return ky(sd0(n, i, t));
  const o = Math.sin(s),
    a = Math.sin((1 - t) * s) / o,
    c = Math.sin(t * s) / o;
  return {
    w: a * n.w + c * i.w,
    x: a * n.x + c * i.x,
    y: a * n.y + c * i.y,
    z: a * n.z + c * i.z,
  };
}

function sd0(n, e, t) {
  return {
    w: n.w + (e.w - n.w) * t,
    x: n.x + (e.x - n.x) * t,
    y: n.y + (e.y - n.y) * t,
    z: n.z + (e.z - n.z) * t,
  };
}

function gm(n, e) {
  return OD(e, n) < 0 ? ad0(n) : n;
}

function OD(n, e) {
  return n.w * e.w + n.x * e.x + n.y * e.y + n.z * e.z;
}

function ky(n) {
  const e = Math.hypot(n.w, n.x, n.y, n.z);
  return e === 0
    ? { w: 1, x: 0, y: 0, z: 0 }
    : { w: n.w / e, x: n.x / e, y: n.y / e, z: n.z / e };
}

function od0(n) {
  return { w: n.w, x: -n.x, y: -n.y, z: -n.z };
}

function ad0(n) {
  return { w: -n.w, x: -n.x, y: -n.y, z: -n.z };
}

function cd0(n, e) {
  return { w: n.w * e, x: n.x * e, y: n.y * e, z: n.z * e };
}

function $f(n, e) {
  return {
    w: n.w * e.w - n.x * e.x - n.y * e.y - n.z * e.z,
    x: n.w * e.x + n.x * e.w + n.y * e.z - n.z * e.y,
    y: n.w * e.y - n.x * e.z + n.y * e.w + n.z * e.x,
    z: n.w * e.z + n.x * e.y - n.y * e.x + n.z * e.w,
  };
}

function q_(n) {
  const e = ky(n),
    t = Math.hypot(e.x, e.y, e.z);
  if (t < 1e-9) return { w: 0, x: 0, y: 0, z: 0 };
  const r = Math.acos(Math.min(1, Math.max(-1, e.w))) / t;
  return { w: 0, x: e.x * r, y: e.y * r, z: e.z * r };
}

function ld0(n) {
  const e = Math.hypot(n.x, n.y, n.z);
  if (e < 1e-9) return { w: 1, x: 0, y: 0, z: 0 };
  const t = Math.sin(e) / e;
  return { w: Math.cos(e), x: n.x * t, y: n.y * t, z: n.z * t };
}

function io(n) {
  return { w: n.qw, x: n.qx, y: n.qy, z: n.qz };
}

function en(n) {
  return { x: n.x, y: n.y, z: n.z };
}

function ud0(n) {
  return {
    x: 2 * (n.x * n.z + n.w * n.y),
    y: 2 * (n.y * n.z - n.w * n.x),
    z: 1 - 2 * (n.x * n.x + n.y * n.y),
  };
}

function hd0(n) {
  const e = n.x * n.x,
    t = n.y * n.y,
    i = n.z * n.z,
    r = n.x * n.y,
    s = n.x * n.z,
    o = n.y * n.z,
    a = n.w * n.x,
    c = n.w * n.y,
    l = n.w * n.z;
  return [
    { x: 1 - 2 * (t + i), y: 2 * (r - l), z: 2 * (s + c) },
    { x: 2 * (r + l), y: 1 - 2 * (e + i), z: 2 * (o - a) },
    { x: 2 * (s - c), y: 2 * (o + a), z: 1 - 2 * (e + t) },
  ];
}

function dd0(n, e) {
  return {
    x: n.y * e.z - n.z * e.y,
    y: n.z * e.x - n.x * e.z,
    z: n.x * e.y - n.y * e.x,
  };
}

function K_(n, e) {
  return { x: n.x * e, y: n.y * e, z: n.z * e };
}

function fd0(n) {
  return Math.hypot(n.x, n.y, n.z);
}

function L9(n) {
  return Math.fround(n);
}

const j_ = 8;

function zD(n, e = "国服") {
  const t = n.speed ?? 7,
    i = t === 6 || t === 7 ? "国服" : t === 5 && e === "国服" ? "国服复古" : e;
  $v(i, t);
  const r = n.trackName.toLowerCase();
  return { trackId: r, version: i, speed: t, booster: 0, key: LD(r, t, 0, i) };
}

function pd0(n) {
  let e,
    t = fm;
  try {
    e = Ff(n, fm);
  } catch {
    ((e = Ff(n, pm)), (t = pm));
  }
  const i = B6(e.trackName);
  return (i !== t && (e = Ff(n, i)), { info: e, zCeiling: i });
}

function gd0(n, e = "国服") {
  const t = zD(n, e),
    i = Oh0(n);
  if (i.length > j_)
    throw new Error(
      `KSV 有 ${i.length} 名参与者，超过计时赛 9 起跑位可容纳的 ${j_} 个影子。`,
    );
  return {
    key: t.key,
    sources: i,
    summary: { bestTimeMs: n.bestTimeMs, speed: t.speed, booster: t.booster },
  };
}

function md0(n, e) {
  return { ...n, mapPath: e.path, trackId: e.id };
}

class Ly extends GhostMenuPanel { constructor(options) { super(options, ghostMenuPanelDependencies); } static attach(options) { return new Ly(options); } }

function X_(n) {
  const e =
    n.version === "国服"
      ? `S${n.speed}`
      : Object.keys(i3[n.version]).find((t) => i3[n.version][t] === n.speed);
  return `${n.version === "国服" ? "" : "复古 "}${e} ${n.booster === 0 ? "个人" : "组队"}`;
}

function wd0(n, e) {
  const t = new Uint8Array(n.byteLength);
  t.set(n);
  const i = new Blob([t.buffer], { type: "application/octet-stream" }),
    r = URL.createObjectURL(i),
    s = document.createElement("a");
  ((s.href = r), (s.download = e));
  try {
    (document.body?.append(s), s.click());
  } finally {
    (s.remove(), URL.revokeObjectURL(r));
  }
}

class vd0 {
  constructor(e) {
    this.host = e;
  }
  host;
    mount(root) { return mountGhostMenuBridge(this, root, options => Ly.attach(options)); }
    async importRecord(key, sources, summary, bytes) { return importGhostMenuRecord(this, key, sources, summary, bytes); }
    async resolveTrack(trackId) { return resolveGhostMenuTrack(this, trackId); }
    async resolveKartTitle(itemId) { return resolveGhostMenuKartTitle(this, itemId); }
    async deleteRecord(key) { return deleteGhostMenuRecord(this, key); }
    async exportRecord(key) { return exportGhostMenuRecord(this, key, wd0); }
}



class Py extends VehiclePreviewRenderer { constructor(width, height) { super(width, height, vehiclePreviewDependencies); } static create(width, height) { return new Py(width, height); } }

class Fy extends FirstRiderDialog {
  constructor(root, blueprint, images, catalog, previewContext) {
    super(root, blueprint, images, catalog, previewContext, firstRiderDialogDependencies);
  }
  static async load(library, root, catalog, previewContext) {
    const { blueprint, images } = await loadRiderImages(library, firstRiderDialogDependencies);
    return new Fy(root, blueprint, images, catalog, previewContext);
  }
}

class Bd0 extends TimeAttackRaceState { constructor() { super(raceStateDependencies); } }

class Rd0 extends TimeAttackResultOverlay { constructor(definition) { super(definition, resultOverlayDependencies); } }



class Dy extends PauseMenuView { constructor(options, assets) { super(options, assets, pauseMenuViewDependencies); } static async load(options) { return PauseMenuView.load(options, pauseMenuViewDependencies, (input, assets) => new Dy(input, assets)); } }

async function zd0(library) { return loadPauseMenuAssets(library, pauseAssetDependencies); }

































function Kd0(status, previous, vehicle) { return ghostTrailState(status, previous, vehicle, BD); }

function qf(root, pairs) { return cloneGhostToonMaterials(root, pairs, ghostToonDependencies); }

const jd0 = { goggle: [3, 0], headBand: [3, 3], handGearL: [4, 0] };

class Xd0 {
  root = new T2();
  modelMount = new T2();
  imported;
  character;
  linkedPresentation;
  usesP3553NonDualLinkedState = !1;
  animation;
  visual;
  motorcycle = !1;
  effects;
  trails;
  trailVehicle;
  trailState = 0;
  attachmentNodes = [];
  balloon;
  accessories = [];
  toonPairs = [];
  orientationMatrix = new v2();
  basisRight = new H();
  basisUp = new H();
  basisForward = new H();
  poseScratch = kL();
  basisScratch = {
    right: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 0 },
  };
  hasLastPose = !1;
  lastPosePosition = { x: 0, y: 0, z: 0 };
  lastPoseHeading = 0;
  lastPoseTimeMs = 0;
  lastBoosterState = 0;
  burstTeam = !1;
  constructor() {
    ((this.root.name = "ghost-kart"),
      (this.modelMount.name = "imported-ghost-mount"),
      this.root.add(this.modelMount));
  }
    seedStart(position, right, forward, up) { return seedGhostVisualStart(this, position, right, forward, up); }
    setAssets(imported, character, scale, linkedMode, visual, motorcycle, format, level) { return setGhostVisualAssets(this, imported, character, scale, linkedMode, visual, motorcycle, format, level, ghostVisualAssetDependencies); }
    setEffects(effects) { return setGhostVisualEffects(this, effects); }
    setTrails(trails, vehicle) { return setGhostVisualTrails(this, trails, vehicle); }
    attachToScene(scene) { return attachGhostVisualToScene(this, scene); }
    setDecorations(balloon, accessories) { return setGhostVisualDecorations(this, balloon, accessories, ghostVisualAssetDependencies); }
    update(input, timeMs, renderTime, frameSeconds, clock, mark) { return updateGhostVisualFrame(this, input, timeMs, renderTime, frameSeconds, clock, mark, ghostVisualUpdateDependencies); }
    updateAnimation(timeMs, booster, secondary, speed) { return updateGhostVisualAnimation(this, timeMs, booster, secondary, speed); }
    ghostDualTeam(booster) { return isGhostDualTeam(this, booster); }
    deriveMotion(pose, forward, timeMs, telemetry) { return deriveGhostVisualMotion(this, pose, forward, timeMs, telemetry); }
    dispose() { return disposeGhostVisual(this, u5); }
}

class P7 {
  constructor(e, t, i, r, s, o, a) {
    ((this.context = e),
      (this.readyBuffer = i),
      (this.garageBuffer = r),
      (this.winBuffer = s),
      (this.loseBuffer = o),
      (this.random = a),
      (this.raceBuffers = t.buffers),
      (this.raceNames = t.names));
  }
  context;
  readyBuffer;
  garageBuffer;
  winBuffer;
  loseBuffer;
  random;
  current;
  retiring;
  transitionTimer;
  transitionStep = 0;
  raceBuffers;
  raceNames;
  currentRaceNameValue;
  multiplayerBuffers;
  multiplayerLobbyPath;
    async prepareMultiplayer(library, lobbyPath = '') { return prepareMultiplayerBgm(this, library, lobbyPath, raceBgmLoadingDependencies); }
    playMultiplayer(kind) { return playMultiplayerBgm(this, kind); }
    playMultiplayerPodium() { return playMultiplayerPodiumBgm(this); }
    playMultiplayerFinish(won) { return playMultiplayerFinishBgm(this, won); }
    static async load(library, track, random, context) { return loadRaceBgm(library, track, random, context, raceBgmLoadingDependencies); }
    async selectRace(library, track) { return selectRaceBgm(this, library, track, raceBgmLoadingDependencies); }
    restart() { return restartRaceBgm(this); }
    get currentRaceName() { return currentRaceBgmName(this); }
    playReady() { return playReadyBgm(this); }
    playGarage() { return playGarageBgm(this); }
    playMyItems() { return playMyItemsBgm(this); }
    playResult(won) { return playResultBgm(this, won); }
    dispose() { return disposeRaceBgm(this); }
    silence() { return silenceRaceBgm(this); }
    start(buffer, loop, fade) { return startRaceBgm(this, buffer, loop, fade, raceBgmPlaybackDependencies); }
    advanceTransition() { return advanceRaceBgmTransition(this, raceBgmPlaybackDependencies); }
    clearTransition() { return clearRaceBgmTransition(this, raceBgmPlaybackDependencies); }
    stop(owner) { return stopRaceBgmOwner(owner); }
}



function Qd0(n) {
  if (!Number.isInteger(n) || n < 0 || n > 15)
    throw new Error(`BGM transition step ${n} 越界。`);
  return {
    incoming: Math.fround(n * Math.fround(0.0625)),
    outgoing: Math.fround((15 - n) * Math.fround(0.0625)),
  };
}



async function eG(library, track, context) { return loadRaceBgmPlaylist(library, track, context, Q9); }

async function Kt(resource, context) { return decodeBgmResource(resource, context, Q9); }

function G5(library, path) { return requiredBgmResource(library, path); }

function ef0(library, fallback) { return garageBgmResource(library, fallback); }



function tf0(record) { return ghostEffectNames(record, ghostEffectDependencies); }

class nf0 extends GhostPlayback { constructor(record, mode = () => "native") { super(record, mode, ghostPlaybackDependencies); } }

class if0 extends ul {
  constructor(e) {
    (super(e), (this.host = e));
  }
  host;
    async build(selection, options, coatingStage) { return buildSoloRaceAssets(this, selection, options, coatingStage, soloRaceBuildDependencies); }
    async loadGhostKartAssets(ghost, scene, importer, speed, version, signal) { return loadGhostKartAssets(this, ghost, scene, importer, speed, version, signal, ghostAssetDependencies); }
    async loadGhostDecorations(ghost, library, scene, importer) { return loadGhostDecorations(ghost, library, scene, importer, ghostAssetDependencies); }
    async rankColors(ghosts) { return rankGhostColors(this, ghosts, ghostAssetDependencies); }
}

class rf0 extends FrameRateCounter {}

class YD extends aP {}

class sf0 extends YD {
  constructor(e) {
    (super(), (this.host = e));
  }
  host;
  interfaceSeat;
  setInterface(e) {
    this.interfaceSeat = e;
  }
  get interface() {
    return this.interfaceSeat;
  }
    handleRouteSurfaceTag(tag, frame) { return handleRouteSurfaceTag(this, tag, frame, routeSurfaceListenerDependencies); }
    warpNextEventFrame(tag, frame) { return warpNextEventFrame(this, tag, frame); }
    applyWarpNextActions(actions) { return applyWarpNextActions(this, actions); }
    applyWarpNextAction(action) { return applyWarpNextAction(this, action); }
    freezeWarpCamera() { return freezeWarpCamera(this); }
}

class of0 extends sf0 {}

class af0 extends GhostParticipantStream { constructor(zCeiling) { super(new kD(zCeiling)); } }

class cf0 extends GhostRecorder { constructor(zCeiling) { super(zCeiling, value => new af0(value)); } }

const lf0 = 7e3;

function nG(n, e) {
  return (Math.trunc(n) - Math.trunc(e) + lf0) >>> 0;
}

class uf0 extends TimeAttackInterfaceOwners {}

class hf0 extends GhostRouteProgress {}

class df0 extends of0 {
  lowSpeedResetStartedAtMs = 0;
  milliseconds = 0;
  effectiveNowMs = 0;
  ghostPoses = [];
  ghostPoseBuffer = [];
  ghostRouteProgress;
  timeAttackParam;
  released = !1;
  lastTeamGaugeSettledAtMs = 0;
  constructor(e) {
    super(e);
  }
  get param() {
    return this.timeAttackParam;
  }
  get ui() {
    return this.interface;
  }
    captureGhostRuntime(nowMs) { return captureGhostRuntime(this, nowMs, timeAttackStageDependencies); }
    checkLowHeightReset(nowMs) { return checkLowHeightReset(this, nowMs, timeAttackStageDependencies); }
    checkAutomaticReset(nowMs) { return checkAutomaticReset(this, nowMs, timeAttackStageDependencies); }
    initiateSpeedReset(allowCurrentSpeed) { return initiateSpeedReset(this, allowCurrentSpeed, timeAttackStageDependencies); }
  handleRouteSurfaceTag(e, t) {
    (e === "warpnext:in:next" && Un(this.host.session.lifecycle)) ||
      super.handleRouteSurfaceTag(e, t);
  }
    advanceResetCompletion(nowMs) { return advanceCheckpointReset(this, nowMs, timeAttackStageDependencies); }
    warpToCheckpoint(section) { return warpToCheckpoint(this, section); }
    warpToPoint(position) { return warpToPoint(this, position); }
  get action2D() {
    const e = this.ui?.action2D;
    if (!e) throw new Error("TimeAttack Action2D renderer 尚未建立。");
    return e;
  }
  get countdownAudio() {
    const e = this.host.audio.countdownAudio;
    if (!e) throw new Error("TimeAttack countdown audio 尚未建立。");
    return e;
  }
    updateDriving(nowMs) { return updateTimeAttackDriving(this, nowMs, timeAttackStageDependencies); }
    updateTimeAttackRoute(nowMs, previousLap, currentLap) { return updateTimeAttackRoute(this, nowMs, previousLap, currentLap); }
    handleTimeAttackActions(actions, nowMs) { return dispatchTimeAttackActions(this, actions, nowMs); }
    handleTimeAttackActionAudio(action, nowMs) { return playTimeAttackActionAudio(this, action, nowMs); }
    handleTimeAttackFinishAction(action, nowMs) { return handleTimeAttackFinishAction(this, action, nowMs); }
    showTimeAttackResult(action, nowMs) { return showTimeAttackResult(this, action, nowMs); }
    enter(transition) { return enterTimeAttackStage(this, transition, owners => new uf0(owners)); }
    disposeInterface() { return disposeTimeAttackInterface(this); }
    exit() { return exitTimeAttackStage(this); }
  createCoordinator(e, t, i) {
    return new yL(e, t, i, (r, s) => this.handleRouteSurfaceTag(r, s));
  }
  traceGround(e, t) {
    const i = this.host.getTrack().rayQuery(e, t, !1);
    return i ? { ...i.point } : void 0;
  }
    restartRace() { return restartTimeAttackRace(this, { newSpeedResetState: pr, worldAxis: H2, depthAxis: $2, selectPlayerSlot: pf0, recordingKey: B6, createRecorder: key => new cf0(key), ghostRelativeTime: nG, nowMs: () => performance.now() }); }
    placeAtStart() { return placeAtStart(this, timeAttackStageDependencies); }
    snapStartToGround(position) { return snapStartToGround(this, position); }
    seedGhostStart(frame) { return seedGhostStart(this, frame, timeAttackStageDependencies); }
    update(frame) { return updateTimeAttackStage(this, frame, timeAttackStageDependencies); }
    render() { return renderTimeAttackStage(this, timeAttackStageDependencies); }
    renderGameplayUi(nowMs, ghostPoses) { return renderGameplayUi(this, nowMs, ghostPoses, timeAttackStageDependencies); }
    rankBoardValues() { return rankBoardValues(this, timeAttackStageDependencies); }
}

function ff0(n, e) {
  return Un(n)
    ? n.finishElapsedMs
    : n.startAtMs === 0 || n.phase < Ne.Racing
      ? 0
      : (Math.trunc(e) - n.startAtMs) >>> 0;
}

function pf0(n) {
  const e = new Set(n);
  for (let t = 0; t < 9; t += 1) if (!e.has(t)) return t;
  throw new Error("TimeAttack 起跑槽位 0..8 已满，无法为本地玩家分配槽位。");
}

function iG(n) {
  const e = (n & 1) !== 0 ? -((n >> 1) + 1) : n >> 1;
  return Math.fround(Math.fround(e) * Math.fround(2));
}

function gf0(n, e, t, i, r) {
  n.clear(!1, !0, !1);
  const s = n.autoClear;
  ((n.autoClear = !1), n.setTransparentSort(jm));
  try {
    (i?.(), t(), n.setTransparentSort(null), r?.(), n.clearDepth(), e());
  } finally {
    ((n.autoClear = s), n.setTransparentSort(null));
  }
}

class mf0 extends YD {
  constructor(e) {
    (super(), (this.host = e));
  }
  host;
  update(e) {
    (this.host.session.physics?.synchronizeClock(e.nowMs),
      this.host.scene.updateMatrixWorld(!0),
      this.host.renderer.render(this.host.scene, this.host.camera),
      this.host.ready.renderReady(e.nowMs));
  }
}

class vf0 {
  constructor(e, t) {
    ((this.host = e),
      (this.previousRenderTime = t ?? 0),
      (this.frame = this.frame.bind(this)),
      this.stages.register(
        "TimeAttackReadyStage",
        () => ((this.currentRaceStage = void 0), new mf0(this.host)),
      ),
      this.stages.register("MultiplayerDrivingStage", () => {
        if (((this.currentRaceStage = void 0), !this.multiplayerStage))
          throw new Error("多人比赛尚未准备。");
        return this.multiplayerStage;
      }),
      this.stages.register("TimeAttackStage", () => {
        const i = new df0(this.host);
        return ((this.currentRaceStage = i), i);
      }));
  }
  host;
  clientFramerate = new rf0();
  animationFrame = 0;
  lastUpdateMs = 0;
  maxRafDelayMs = 0;
  previousRenderTime;
  presentationClockMs = 0;
  fps = 60;
  frameTimeSeconds = 0;
  stages = new wf0();
  currentRaceStage;
  multiplayerStage;
  get multiplayerDiagnosticsView() {
    return this.multiplayerStage?.diagnosticsView;
  }
  nextFrameCallbacks = [];
  publishMultiplayer(e) {
    if (this.multiplayerStage) throw new Error("已有多人比赛。");
    (this.host.shell.enterMultiplayerRace(),
      (this.multiplayerStage = e),
      this.stages.changeStage("MultiplayerDrivingStage"));
  }
  releaseMultiplayer(e) {
    this.multiplayerStage === e &&
      ((this.multiplayerStage = void 0),
      this.host.shell.current === "MultiplayerRacing" &&
        this.host.shell.leaveMultiplayerRace(),
      this.stages.changeStage("TimeAttackReadyStage"));
  }
    start() { return startPresentationLoop(this, presentationFrameDependencies); }
    dispose() { return disposePresentationLoop(this); }
  afterNextFrame(e) {
    return new Promise((t, i) => {
      this.nextFrameCallbacks.push({
        run: () => {
          try {
            t(e());
          } catch (r) {
            i(r);
          }
        },
        reject: i,
      });
    });
  }
  changeStage(e, t) {
    return this.stages.changeStage(e, t);
  }
  get stageName() {
    return this.stages.currentName;
  }
  handleRouteSurfaceTag(e, t) {
    this.currentRaceStage?.handleRouteSurfaceTag(e, t);
  }
  applyWarpNextActions(e) {
    this.currentRaceStage?.applyWarpNextActions(e);
  }
  warpToCheckpoint(e) {
    this.currentRaceStage?.warpToCheckpoint(e);
  }
  warpToPoint(e) {
    this.currentRaceStage?.warpToPoint(e);
  }
    frame(scheduledAtMs) { return advancePresentationFrame(this, scheduledAtMs, presentationFrameDependencies); }
    updateAndRender(startedAtMs) { return renderPresentationFrame(this, startedAtMs, presentationFrameDependencies); }
  renderGameplayUi(e, t) {
    this.currentRaceStage?.renderGameplayUi(e, t);
  }
  disposeRaceInterface() {
    this.currentRaceStage?.disposeInterface();
  }
  get raceInterface() {
    return this.currentRaceStage?.interface;
  }
  initiateSpeedReset(e) {
    this.currentRaceStage?.initiateSpeedReset(e);
  }
  advanceResetCompletion(e) {
    this.currentRaceStage?.advanceResetCompletion(e);
  }
  updateDriving(e) {
    this.currentRaceStage?.updateDriving(e);
  }
  updateTimeAttackRoute(e, t, i) {
    this.currentRaceStage?.updateTimeAttackRoute(e, t, i);
  }
  handleTimeAttackActions(e, t) {
    this.currentRaceStage?.handleTimeAttackActions(e, t);
  }
  handleTimeAttackActionAudio(e, t) {
    return this.currentRaceStage?.handleTimeAttackActionAudio(e, t) ?? !1;
  }
  handleTimeAttackFinishAction(e, t) {
    return this.currentRaceStage?.handleTimeAttackFinishAction(e, t) ?? !1;
  }
  showTimeAttackResult(e, t) {
    this.currentRaceStage?.showTimeAttackResult(e, t);
  }
    releaseRaceForReady() { return releaseRaceForReady(this, presenterRaceDependencies); }
    replaceTrack(nextTrack) { return replaceRaceTrack(this, nextTrack, presenterRaceDependencies); }
    applyRaceOptions(kartItemId) { return applyRaceOptions(this, kartItemId, presenterRaceDependencies); }
}

function yf0(n) {
  const e = Ue(n);
  return {
    modeId: 9,
    speedClass: e,
    speed: e,
    booster: n.booster,
    showGhost: n.showGhost,
  };
}

async function Af0(host, selection, coatingStage) { return publishSoloRace(host, selection, coatingStage, { createLifecycle: elapsedMs => new GF(elapsedMs), recordKey: (entry, options) => Pt.recordKey(entry, options), raceParam: yf0 }); }

class bf0 {
  kartAudio;
  bgm;
  bgmTrackId;
  context;
  interfaceAudio;
  countdownAudio;
}

class Mf0 extends RaceCameraCoordinator { constructor(shake, wave, warpNext, options = {}) { super(shake, wave, warpNext, options, raceCameraDependencies); } }

class Ny extends InterfaceAudio { constructor(context, click, hover, slotChanger, start) { super(context, click, hover, slotChanger, start, interfaceAudioDependencies); } static async load(library, context) { return InterfaceAudio.load(library, context, interfaceAudioDependencies, (click, hover, slotChanger, start) => new Ny(context, click, hover, slotChanger, start)); } }





const jf = { mapPath: "track_/village_R01/track.1s", trackId: "village_R01" },
  _f0 = 0,
  Gf0 = new Set();

export { Af0, Ah0, Bd0, Ff, Fy, Gf0, Kh0, Mf0, Nh0, Ny, P7, Pt, Th0, _f0, bf0, bh0, df0, if0, jf, l60, n60, ph0, vd0, vf0 };
