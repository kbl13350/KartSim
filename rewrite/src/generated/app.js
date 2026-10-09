// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { initializeApplication } from "../app/application-construction.ts";
import { fitGameViewport, mountGameViewport, resolveStartupSelection, watchFrontendVersion } from "../app/boot-support.ts";
import { canReloadForUpdate, configureApplicationBackbuffer, haltApplicationRuntime, handleApplicationShortcut, onApplicationKeyDown, restartRaceFromPause, toggleRacePause } from "../app/application-controls.ts";
import { disposeApplicationRuntime } from "../app/application-disposal.ts";
import { createPresenterHost, createReadyHost, getOrCreatePresenter, getOrCreateReadyCoordinator } from "../app/host-bridges.ts";
import { createGhostRecordMenu, currentGhostRecordKey, mountGhostRecordMenu, selectGhostTrack } from "../app/ghost-menu.ts";
import { loadStartupResources, prepareStartupReady, registerNewRider } from "../app/startup-resources.ts";
import { accountNeedsRiderRegistration, ensureStartupAccount, registerAccountRider, retryStartupProfile, sanitizeStartupProfile, setAccountProfileWriter } from "../app/account-startup.ts";
import { activeBrowserSession } from "../account/account-runtime.ts";
import { createDrivingPipelineHost, createRaceBuilderHost, getOrCreateDrivingPipeline, getOrCreateRaceBuilder } from "../app/runtime-hosts.ts";
import { getOrCreateRecordService, updateKartBoosterState } from "../app/race-services.ts";
import { devToolsTrackObjects, devToolsTrackObjectsSource, devToolsTrackOwner } from "../app/track-diagnostics.ts";
import { currentRhoLibrary, getOrCreateAudioDirector, getOrCreateRaceSession, getOrCreateReplayLibrary, requireRacePhysics, requireRaceTrack } from "../app/shell-state.ts";
import { getActiveWindowNotice, mountDevTools, mountDevToolsTrackObjectsOverlay, mountDevToolsTrackOverlay, onApplicationViewportResize, readPresenterClock, setActiveWindowNotice, setDevToolsTrackObjectKind, writePresenterClock } from "../app/shell-accessors.ts";
import { shellRouting } from "../app/shell-routing.ts";
import { startSinglePlayerRace, returnToReady } from "../app/race-navigation.ts";
import { B2, D1, I4, Z9, qe, sG } from "./vendor.js";
import { $2, $p, C9, E9, EX, Ft, G1, H2, IR, Mw, N3, Pp, T, V0, W1, b4, f5, ha, j0, j6, jc, m9, n3, p3, pZ, rn, s2, t3, we, x1, xe, y9 } from "./formats.js";
import { $f0, C20, CI, FR, Hf0, Jl, Kf0, Nf0, Of0, Ow, Ox, PR, Qc, S20, SI, Sw, T20, TI, Tr, Uf0, Vf0, Wf0, Xf0, _I, a20, e6, f20, g20, h20, i7, jf0, p20, p5, pQ, qf0, sg, u20, un, x20, y20, zf0, zw, zx } from "./library.js";
import "./data.js";
import "./math.js";
import { Bt, JI, Me0, Qf0, Qk, Yf0, Zf0, cv, h6, pe0, wk } from "./vehicle.js";
import "./driving.js";
import { $o0, Ar0, BP, E4, Hs0, Jo0, Qo0, Vg, eT, ga0, iP, io0, jo0, la0, nP, qs0, rP, ro0, sP, so0, tP, uo0, yr0, ze } from "./world.js";
import { E7, Hv, Jf0, KP, Ka0, Kv, Ma0, Ta0, aT, cT, ep0, gr, ja0, np0, tp0, uT } from "./ui.js";
import { EF, Ne, Ql0, Xl0, Zl0, bl0, im, jl0, ql0 } from "./multiplayer.js";
import { Af0, Bd0, Fy, Gf0, Kh0, Mf0, Nh0, Ny, P7, Pt, _f0, bf0, if0, jf, l60, n60, vd0, vf0 } from "./timeattack.js";

const startupSelectionDependencies = { defaultProfile: gr, resolveSystemKart: b4, isSpecialKartId: n3, displayKartName: Mw, startTrack: jf };
setAccountProfileWriter(cT);
const applicationConstructionDependencies = { outputColorSpace: qe, makeKartView: scene => new Vg(scene), makeHud: (root, actions) => new $o0(root, actions), collectEngineDiagnostics: jo0, makeAssets: hud => new Jo0(hud), makeInput: () => new jl0(), makeCanvasDiagnostics: (...args) => new qs0(...args), makeTouchControls: (...args) => new l60(...args), makeBlackBar: root => new yr0({ root }), makeResizeObserver: callback => new ResizeObserver(callback) };

class Bf0 {
    constructor(root) { initializeApplication(this, root, applicationConstructionDependencies); }
  root;
  scene = new D1();
  camera = new Z9(62, 1, 0.1, 700);
  renderer = new I4({ powerPreference: "high-performance" });
  importer = new Tr();
  hud;
  canvasDiagnostics;
  input;
  touchControls;
  shell = new Qo0();
  assets;
  drivingInput = new sG();
  autoForward = new Xl0();
  nitroSeamless = new Zl0();
  gamepad = new Ql0();
  kartView;
  warpNext = new Qk();
  warpHudGate = Ar0();
  activeBlackBar;
  targetRandom = new rP();
  lightFactor = new sP(this.targetRandom);
  cameraEffectAnchor = { value: 0 };
  cameraShake = new nP(this.targetRandom, this.cameraEffectAnchor);
  cameraWave = new iP(this.cameraEffectAnchor);
  cameras = new Mf0(this.cameraShake, this.cameraWave, this.warpNext);
  toonStageBinding = new ha();
  readyCoordinator;
  raceSession;
    get session() { return getOrCreateRaceSession(this, () => new Bd0()); }
  ghostRecorder;
  currentPlayerSlot = 0;
  tachometerGaugePreserve = new tP();
  gameOptions = la0();
  audioDirector;
    get audio() { return getOrCreateAudioDirector(this, () => new bf0()); }
  userProfile = gr();
  replayLibraryInstance;
    get replayLibrary() { return getOrCreateReplayLibrary(this, () => new Pt()); }
  recordsInstance;
  newRiderDialog;
  timeAttackReadyOptions = {
    speed: ga0,
    booster: 0,
    showGhost: !0,
    version: ze,
    settingSpeed: E4,
  };
  ghostSamplingMode = Kh0();
  localNickname = im();
  presenterInitialPreviousRenderTime = performance.now() / 1e3;
  viewportResizeObserver;
    onViewportResize = () => onApplicationViewportResize(this);
  paused = !1;
  racePageTransition = !1;
  drawingBufferSize = new B2();
  engineRenderStats = { calls: 0, triangles: 0, lines: 0, points: 0, frame: 0 };
  raceStartProgramCount = 0;
  workProfiler = void 0;
  racePresenter;
  raceBuilderInstance;
  devToolsHandle;
  devToolsOverlayHandle;
  devToolsObjectsOverlayHandle;
  devToolsCollectorInstance;
  devToolsTrackObjectSelection;
  drivingPipelineInstance;
    get previousRenderTime() { return readPresenterClock(this, "previousRenderTime"); }
    set previousRenderTime(value) { writePresenterClock(this, "previousRenderTime", value); }
    get lastUpdateMs() { return readPresenterClock(this, "lastUpdateMs"); }
    set lastUpdateMs(value) { writePresenterClock(this, "lastUpdateMs", value); }
    get presentationClockMs() { return readPresenterClock(this, "presentationClockMs"); }
    set presentationClockMs(value) { writePresenterClock(this, "presentationClockMs", value); }
    get fps() { return readPresenterClock(this, "fps"); }
    set fps(value) { writePresenterClock(this, "fps", value); }
    get maxRafDelayMs() { return readPresenterClock(this, "maxRafDelayMs"); }
    set maxRafDelayMs(value) { writePresenterClock(this, "maxRafDelayMs", value); }
    get presenter() { return getOrCreatePresenter(this, (host, previousTime) => new vf0(host, previousTime)); }
    get raceBuilder() { return getOrCreateRaceBuilder(this, host => new if0(host)); }
    createRaceBuilderHost() { return createRaceBuilderHost(this, _f0, (selection, options) => Pt.recordKey(selection, options)); }
    get drivingPipeline() { return getOrCreateDrivingPipeline(this, host => new n60(host)); }
    createDrivingPipelineHost() { return createDrivingPipelineHost(this, () => navigator.getGamepads?.()); }
    get rhoLibrary() { return currentRhoLibrary(this); }
    get ready() { return getOrCreateReadyCoordinator(this, host => new ql0(host)); }
    get activeWindowNotice() { return getActiveWindowNotice(this); }
    set activeWindowNotice(value) { setActiveWindowNotice(this, value); }
    createReadyHost() { return createReadyHost(this, { makeMultiplayerRaceLoader: Hs0, applyAudioOptions: Qc, recordKey: Pt.recordKey, saveProfile: cT }); }
    createPresenterHost() { return createPresenterHost(this); }
    canReloadForUpdate() { return canReloadForUpdate(this); }
    dispose() { return disposeApplicationRuntime(this, { setToonLinesEnabled: Pp, removeWindowListener: (name, listener) => window.removeEventListener(name, listener) }); }
    mountDevTools() { return mountDevTools(); }
    devToolsTrackOwner() { return devToolsTrackOwner(this, Gf0); }
    devToolsTrackObjects() { return devToolsTrackObjects(this); }
    setDevToolsTrackObjectKind(kind, visible) { return setDevToolsTrackObjectKind(kind, visible); }
    devToolsTrackObjectsSource() { return devToolsTrackObjectsSource(this); }
    mountDevToolsTrackOverlay() { return mountDevToolsTrackOverlay(); }
    mountDevToolsTrackObjectsOverlay() { return mountDevToolsTrackObjectsOverlay(); }
    get physics() { return requireRacePhysics(this); }
    get track() { return requireRaceTrack(this); }
    frame(nowMs) { return shellRouting.frame(this, nowMs); }
    updateAndRender(nowMs) { return shellRouting.updateAndRender(this, nowMs); }
    renderGameplayUi(nowMs, frame) { return shellRouting.renderGameplayUi(this, nowMs, frame); }
    updateKartBoosterState(nowMs, visualState, previousSlot) { return updateKartBoosterState(this, nowMs, visualState, previousSlot); }
    haltRuntime(error, nowMs) { return haltApplicationRuntime(this, error, nowMs); }
    updateDriving(nowMs) { return shellRouting.updateDriving(this, nowMs); }
    updateTimeAttackRoute(nowMs, physics, track) { return shellRouting.updateTimeAttackRoute(this, nowMs, physics, track); }
    handleTimeAttackActions(actions, nowMs) { return shellRouting.handleTimeAttackActions(this, actions, nowMs); }
    handleTimeAttackActionAudio(action, nowMs) { return shellRouting.handleTimeAttackActionAudio(this, action, nowMs); }
    get records() { return getOrCreateRecordService(this, configuration => new Nh0(configuration)); }
    promoteTimeAttackRecord(record, time) { return shellRouting.promoteTimeAttackRecord(this, record, time); }
    restoreTimeAttackRecords() { return shellRouting.restoreTimeAttackRecords(this); }
    mountGhostMenu() { return mountGhostRecordMenu(this); }
    ghostRecordMenu() { return createGhostRecordMenu(this, configuration => new vd0(configuration), bl0); }
    async selectGhostTrack(selection, speed, booster, version) { return selectGhostTrack(this, selection, speed, booster, version); }
    currentGhostRecordKey() { return currentGhostRecordKey(this, Pt.recordKey); }
    enterTimeAttackReady(options) { return shellRouting.enterTimeAttackReady(this, options); }
    openTrackSelect(selection, options) { return shellRouting.openTrackSelect(this, selection, options); }
    selectReadyTrack(selection, options, track) { return shellRouting.selectReadyTrack(this, selection, options, track); }
    openGarage(selection, options) { return shellRouting.openGarage(this, selection, options); }
    selectReadyGarage(selection, options, choice) { return shellRouting.selectReadyGarage(this, selection, options, choice); }
    readyModalBusy() { return shellRouting.readyModalBusy(this); }
    previewSettings(options) { return shellRouting.previewSettings(this, options); }
    confirmSettings(options, speed, version) { return shellRouting.confirmSettings(this, options, speed, version); }
    saveGameOptions() { return shellRouting.saveGameOptions(this); }
    closeSettings() { return shellRouting.closeSettings(this); }
    releaseRaceForReady() { return shellRouting.releaseRaceForReady(this); }
    releaseReadyToonEnvironment() { return shellRouting.releaseReadyToonEnvironment(this); }
    drainDrivingInput(nowMs, state) { return shellRouting.drainDrivingInput(this, nowMs, state); }
    setAutoForwardEnabled(enabled) { return shellRouting.setAutoForwardEnabled(this, enabled); }
    setNitroSeamlessMode(enabled) { return shellRouting.setNitroSeamlessMode(this, enabled); }
    getDrivingSnapshot() { return shellRouting.getDrivingSnapshot(this); }
    applyWarpNextActions(actions) { return shellRouting.applyWarpNextActions(this, actions); }
    initiateSpeedReset(allowCurrentSpeed) { return shellRouting.initiateSpeedReset(this, allowCurrentSpeed); }
    advanceResetCompletion(nowMs) { return shellRouting.advanceResetCompletion(this, nowMs); }
    updateHud() { return shellRouting.updateHud(this); }
    updateActiveRaceCamera(nowMs) { return shellRouting.updateActiveRaceCamera(this, nowMs); }
    async loadVersionedResources() { return loadStartupResources(this, { localResourcesSupported: io0, recoverLocalSource: ro0, defaultSourceName: so0, versionId: Bt, loadVersionedSources: uo0, loadLibrary: (sources, indexes) => Sw.load(sources, void 0, indexes), loadProfile: Ta0, defaultProfile: gr, resolveSelection: Rf0, isSpecialKartId: n3, displayKartName: Mw, localNickname: im, ensureAccount: () => ensureStartupAccount(this), sanitizeProfile: (profile, catalog) => sanitizeStartupProfile(profile, catalog, cT), needsRiderRegistration: () => accountNeedsRiderRegistration(), retryProfile: error => retryStartupProfile(this, error) }); }
    async applyNewRiderRegistration() { const dependencies = { loadEnvironment: library => rn.load(library), loadDialog: (library, root, options, context) => Fy.load(library, root, options, context), saveProfile: cT, saveNickname: EF }; return activeBrowserSession() ? registerAccountRider(this, dependencies) : registerNewRider(this, dependencies); }
    async prepareStartupReady(library, selection, vehicleTitle) { return prepareStartupReady(this, library, selection, vehicleTitle, { createAudioContext: () => new AudioContext(), applyAudioOptions: Qc, loadBgm: (source, metadata, random, context) => P7.load(source, metadata, random, context), loadInterfaceAudio: (source, context) => Ny.load(source, context) }); }
    startRace(selection) { return startSinglePlayerRace(this, selection, Af0); }
    replaceTrack(track) { return shellRouting.replaceTrack(this, track); }
    togglePause() { return toggleRacePause(this, () => performance.now(), Ne.Paused); }
    async restartRaceFromPause() { return restartRaceFromPause(this, root => eT(root), () => performance.now()); }
    async returnToReady() { return returnToReady(this, eT); }
    onGlobalKeyDown = event => onApplicationKeyDown(this, event);
    handleGlobalShortcut(event) { return handleApplicationShortcut(this, event, BP); }
    applyRaceOptions(options) { return shellRouting.applyRaceOptions(this, options); }
    applySavedAudioOptions() { return shellRouting.applySavedAudioOptions(this, Qc); }
    handleReadyShortcut(event) { return shellRouting.handleReadyShortcut(this, event); }
    configureBackbuffer() { return configureApplicationBackbuffer(this, { width: H2, height: $2 }, EX, window.devicePixelRatio); }
}

function Rf0(garage, tracks, profile) { return resolveStartupSelection(garage, tracks, profile, startupSelectionDependencies); }

function If0(canReload) { return watchFrontendVersion(canReload); }



function Lf0(root) { return mountGameViewport(root, xe); }

const Oy = document.querySelector("#app");

if (!Oy) throw new Error("Application root #app was not found.");

Lf0(Oy);

const ZD = new Bf0(Oy);

ZD.mountGhostMenu();

If0(() => ZD.canReloadForUpdate());

export {
  Ox as $,
  $f0 as A,
  Of0 as B,
  Nf0 as C,
  C9 as D,
  i7 as E,
  Kf0 as F,
  Ow as G,
  Hf0 as H,
  qf0 as I,
  CI as J,
  p3 as K,
  xe as L,
  f20 as M,
  pQ as N,
  jc as O,
  Z9 as P,
  PR as Q,
  un as R,
  D1 as S,
  Wf0 as T,
  E9 as U,
  n3 as V,
  SI as W,
  jf0 as X,
  _I as Y,
  Xf0 as Z,
  uT as _,
  x1 as a,
  j6 as a0,
  Ma0 as a1,
  ep0 as a2,
  FR as a3,
  E7 as a4,
  Jf0 as a5,
  y20 as a6,
  C20 as a7,
  Yf0 as a8,
  ze as a9,
  N3 as aa,
  JI as ab,
  p5 as ac,
  S20 as ad,
  a20 as ae,
  Uf0 as af,
  Vf0 as ag,
  TI as ah,
  Zf0 as ai,
  h20 as aj,
  IR as ak,
  wk as al,
  cv as am,
  h6 as an,
  p20 as ao,
  aT as ap,
  zw as aq,
  KP as ar,
  Ka0 as as,
  m9 as at,
  Kv as au,
  ja0 as av,
  t3 as aw,
  tp0 as ax,
  np0 as ay,
  T as b,
  Hv as c,
  pe0 as d,
  Me0 as e,
  f5 as f,
  V0 as g,
  G1 as h,
  Jl as i,
  x20 as j,
  e6 as k,
  Qf0 as l,
  zx as m,
  T20 as n,
  y9 as o,
  s2 as p,
  W1 as q,
  we as r,
  $p as s,
  Ft as t,
  pZ as u,
  u20 as v,
  g20 as w,
  j0 as x,
  zf0 as y,
  sg as z,
};

export { Bf0 };
