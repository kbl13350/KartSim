// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { installWorldOverrides } from "../world/install.ts";
import { FlyingPetPresentation } from "../world/flying-pet-presentation.ts";
import { TrackEventEffectPool } from "../world/track-event-effect-pool.ts";
import { GiantRaceEffects } from "../world/giant-race-effects.ts";
import { RoadblockResultPresentation, loadRoadblockResultParts } from "../world/roadblock-result-presentation.ts";
import { createMultiplayerRaceLoader } from "../multiplayer/race-loader.ts";
import { CanvasContextDiagnostics } from "../ui/canvas-context-diagnostics.ts";
import { supportsLocalResourceDirectory as io0, recoverLocalResourceDirectory as ro0, chooseLocalResourceDirectory as so0 } from "../resources/local-directory-source.ts";
import { initializeLocalRace } from "../multiplayer/local-race-construction.ts";
import { KartPresentationView } from "../world/kart-presentation-view.ts";
import { HudOverlay, captureUiTransition as eT } from "../ui/hud-overlay.ts";
import { PerformanceCounter as ko0 } from "../ui/performance-counter.ts";
import { collectEngineDiagnostics as jo0, formatDiagnosticsLines as qo0 } from "../ui/engine-diagnostics.ts";
import { RaceChatOverlay } from "../multiplayer/race-chat-overlay.ts";
import { initializeTrackInfoCard, loadTrackInfoCard } from "../multiplayer/track-info-card-loading.ts";
import { disposeTrackCard, drawTrackCardClippedText, drawTrackCardLabel, renderTrackCard, setTrackCardBgm, setTrackCardVisible, slideTrackCardOut, updateTrackCard } from "../multiplayer/track-info-card-runtime.ts";
import { initializeRacePresenter } from "../multiplayer/race-presenter-initialize.ts";
import { updateRacePresenterFrame } from "../multiplayer/race-presenter-frame.ts";
import { updateRaceSession } from "../multiplayer/race-session-update.ts";
import { bindRaceSessionClock, disposeRaceSession, exitRaceSession, failRaceSession, initializeRaceSession, raceSessionDiagnosticsView, raceSessionPresentingResults, raceSessionTouchDodgeEnabled, raceSessionTouchDrivingAvailable, renderRaceSession, requestRaceSessionLeave, scheduleRaceSessionStart, showRaceSessionWaiting, updateRaceSessionRoom } from "../multiplayer/race-session-lifecycle.ts";
import { clearRacePresenterGiant, prepareRacePresenterFlyingPet, prepareRacePresenterGiant, prepareRacePresenterRoadblockFlag, prepareRacePresenterRoadblockResult } from "../multiplayer/race-presenter-setup.ts";
import { prepareRacePresenterTrackEvents } from "../multiplayer/race-presenter-track-events.ts";
import { showRacePresenterResults } from "../multiplayer/race-presenter-results.ts";
import { disposeRacePresenter, warmRacePresenter } from "../multiplayer/race-presenter-lifecycle.ts";
import { applyPresenterWarpActions, applyPresenterWarpCamera, capturePresenterRankProgress, forwardPresenterAwardInput, handlePresenterRouteTag, playPresenterGo, playPresenterReset, releasePresenterShadowPresentations, startPresenterAudio, startPresenterBoostGaugeFull, updatePresenterRoom } from "../multiplayer/race-presenter-actions.ts";
import { renderRacePresenterFrame } from "../multiplayer/race-presenter-render.ts";
import { browserScanCode } from "../input/action-bindings.ts";
import { gamepadAxisControl, pressedGamepadControls } from "../input/gamepad-controls.ts";
import { MotionClockMapping as BL, RemoteMotionPredictor as Gi0 } from "../multiplayer/remote-motion.ts";
import { RemoteFleet } from "../multiplayer/remote-fleet.ts";
import { computeCatchupScales as Oi0, chargerDurationScale as zi0, SlipstreamBoost as fE } from "../multiplayer/race-driving-scales.ts";
import { RacePeerCadence, CollisionFramerateHistory as Ni0 } from "../multiplayer/race-peer-cadence.ts";
import { OutgoingRaceMotionSender, captureOutgoingMotion, isKnownNetworkMotionMode } from "../multiplayer/outgoing-race-motion.ts";
import { bindActiveRaceClock, disposeActiveRace, roadblockRemaining, scheduleActiveRaceStart, updateActiveRaceRoom } from "../multiplayer/race-room-coordination.ts";
import { updateActiveRaceFrame, updateRaceRemoteViews } from "../multiplayer/race-frame-coordination.ts";
import { acceptLocalRaceEndTiming, advanceLocalRaceReset, applyLocalRaceWarpActions, checkLocalRaceAutomaticReset, handleLocalRaceRouteTag, localRaceElapsedMs, localRaceProgress, localRaceScheduledStartAtMs, localRaceStartBoosterWindow, requestLocalRaceReset, scheduleLocalRaceStart, updateLocalRace } from "../multiplayer/local-race-runtime.ts";
import { loadLegacyResourceBundle as uo0 } from "../resources/legacy-adapter.ts";
import { parseServerEvent } from "../multiplayer/server-events.ts";
import { isValidRoomSnapshot } from "../multiplayer/room-validation.ts";
import { initializeTrackWorld } from "../world/create-track-world.ts";
import { StaticTrackSurface } from "../world/static-track-surface.ts";
import { MovingTrackSurface } from "../world/moving-track-surface.ts";
import { ObstacleSurface } from "../world/obstacle-surface.ts";
import { commitObstacleSnapshot } from "../world/track-obstacle-snapshot.ts";
import { $1, Ar, B2, D1, D2, D9, Fm, H, J9, Lm, Pm, R9, S1, T2, Vt, X5, Z9, _0, d3, e9, h9, l1, l2, nn, o5, r9, rG, s1, sG, t9, u1, v1, v2, v9, y1, z2 } from "./vendor.js";
import { $2, AR, Ab, Ao, Dt, Fl, G1, G2, H2, Hn, J5, JH, K6, Mo, N6, Ol, QG, Ri, T, To, V0, Vm, W1, W6, We, _X, _o, bo, c3, cn, e4, f5, ha, ie, j0, jm, m9, oR, on, p2, p3, qm, s2, sR, sn, t3, tt, tw, vR, we, x1, xe, xo, y9, yR, yo, z6, zB } from "./formats.js";
import { Bo, DI, Dw, Er, Gw, II, Io, Ma, N90, Nw, OQ, Q6, Q9, Ro, S9, Tw, U1, Vw, WR, X2, X6, Yi, Zl, aI, bI, ba, c7, dI, f20, hI, i3, ko, mI, n20, o20, p5, t20, t7, u5, w90, x4, xI, yI } from "./library.js";
import { I1, N1, On, Rg, Tt, dl, t0 } from "./math.js";
import { A40, B40, D40, Fk, Gr, I40, In0, No, Qk, R40, Ta, Tk, Uk, Vo, Y3, ev, f30, fL, fv, gL, gv, iL, k40, m7, mL, p7, pL, pr, rL, v7, vL, wL, yL } from "./vehicle.js";
import { AL, Bg, Oo, di0, fi0, pi0, rc, vv, xd } from "./driving.js";

const flyingPetPresentationDependencies = {
  loadPetAsset: (library, id) => x4.load(library, id),
  createSkinResources: (asset, primary, high) => new mE(asset, primary, high),
  createAnimation: sequence => new cc(sequence),
  loadModel: (...args) => Ks.load(...args),
  createIdleMotion: (clips, animation, random) => new cr0(clips, animation, random),
  loadEffect: (...args) => $d(...args), loadAudio: (...args) => Tv.load(...args),
  createRaceState: () => new hr0(), isVisible: dr0,
  createRotationMatrix: () => new v2(), renderNested: qm,
};
const trackEventEffectDependencies = {
  parseScene: y9, buildScene: W1,
  resolveTextureSource: (library, path, reference) => sn(library, path, void 0, reference),
  decodeSound: Q9, connectSound: (context, source) => S9(context, source),
};
const giantRaceDependencies = {
  parseBml: s2, attribute: T,
  exactEntry: (library, path) => Yi(library, path),
  createGroup: () => new T2(), decodeSound: Q9, connectSound: S9,
  decodeImage: p2, createTexture: (pixels, width, height) => new J9(pixels, width, height),
  createWarning: texture => new qr0(texture), build: aI,
};
const roadblockResultPresentationDependencies = {
  parseScene: y9, attribute: T, buildScene: W1,
  resolveSource: (library, path, reference) => sn(library, path, void 0, reference),
  validateStand: mr0, createGroup: () => new T2(),
  createCameraPublisher: () => new Ol(), createDistance: wr0,
  startBasis: fr0, nativePoint: point => It(point),
  createVector: (x, y, z) => new H(x, y, z),
  runnerPose: pr0, cameraPose: gr0,
};
const multiplayerRaceLoaderDependencies = {
  createToonStageBinding: () => new ha(),
  loadRaceAssets: (...args) => A40(...args),
  loadCharacterAnimations: (...args) => hI(...args),
  createNetworkDriver: (...args) => new Ui0(...args),
  loadTimeGap: (...args) => Dw.load(...args),
  loadCountdownAudio: (...args) => Q6.load(...args),
  loadRoadblockFlag: (...args) => tw.load(...args),
  loadTrackCard: options => M7.load(options),
  loadRoadblockHud: (...args) => Bo.loadHud(...args),
  loadRoadblockResult: (...args) => Bo.loadResult(...args),
  loadRoadblockOverlay: (...args) => Gw.load(...args),
  loadRaceResult: (...args) => Tw.load(...args),
  findKart: p5, bannerKind: uP,
  loadBanner: (...args) => x7.load(...args),
  createPresenter: (...args) => new jr0(...args),
  loadRaceChat: (...args) => Dv.load(...args),
  createSession: (...args) => new Yr0(...args),
  now: () => performance.now(),
};
const kartPresentationDependencies = { makeWheelPresentation: (resource, nodes, visual) => new N90(resource, nodes, visual), makeBalloon: c7, disposeObject: u5 };
const localRaceConstructionDependencies = { validateStartSlots: iL, hasLteMode: ko, validRpDraws: ba, sameRp: t7, hasGiantMode: Io, makeLte: () => new D40(), makeGiant: callback => new pL(true, callback), makePhysics: (...args) => new AL(...args), makeTrack: (...args) => new _L(...args), placeAtStart: rL, makeCoordinator: (...args) => new yL(...args), racingState: X2.Racing };
const localRaceDependencies = { states: X2, beginResetState: mL, advanceResetState: wL, routeTagFamily: Vo, isStartBoosterWindow: fL };
const raceRoomDependencies = { modeOf: G2, sameRp: t7, sameRoadblock: oR, sameLte: Nw, sameGiant: yI, toLocalTick: Y3, racingState: X2.Racing };
const racePresenterInitializationDependencies = { createCameraShake: (random, anchor) => new nP(random, anchor), createRankRoster: (roster, playerId) => new Tr0(roster, playerId), createLightFactor: random => new sP(random), createAction2d: assets => new dI(assets), applyTrackFog: (scene, track) => kv(scene, track), createRacerView: scene => new Vg(scene), vehicleParts: vehicle => lc(vehicle), serializedRoot: model => J5(model), get accessorySockets() { return oP; }, createLinkedPresentation: (...args) => new _a(...args), attachAura: (...args) => ev(...args), createGiantAppearance: (...args) => new Kr0(...args), startPosition: (...args) => rL(...args), createShadowPresentation: object => new $i0(object) };
const racePresenterFrameDependencies = { result: { get countdownState() { return X2.Countdown; }, render: (...args) => e4(...args) }, events: { get racingState() { return X2.Racing; } }, participants: { updateRemoteVehicleEffects: (...args) => xr0(...args), updateLocalVehicleEffects: (...args) => Mr0(...args) }, hud: { rankByProgress: (...args) => _r0(...args), rankFallback: (...args) => Gr0(...args), rankWithResults: (...args) => Br0(...args), updateTachometer: (...args) => QL(...args), prepareScene: (...args) => e4(...args), get racingState() { return X2.Racing; } } };
const racePresenterSetupDependencies = { flyingPetItem: (library, itemId) => Ma(library, itemId), serializedRoot: model => J5(model), loadFlyingPet: options => S4.race(options), paintColors: (library, itemId) => We(library, itemId), loadRoadblockFlag: (...args) => _v.load(...args), loadGiant: (...args) => Fv.load(...args), loadRoadblockResult: (...args) => Bv.load(...args), nowMs: () => performance.now() };
const racePresenterTrackEventDependencies = { loadEffects: (...args) => b7.load(...args), loadAudio: (...args) => v7.load(...args), loadDummyAudio: (...args) => m7.load(...args) };
const racePresenterResultsDependencies = { vehicleParts: vehicle => lc(vehicle), winningPlayers: (...args) => rG(...args), createVehicleView: scene => new Vg(scene) };
const racePresenterLifecycleDependencies = { warmScene: (...args) => Hn(...args), createRenderTarget: (width, height) => new nn(width, height), vehicleParts: vehicle => lc(vehicle) };
const racePresenterActionsDependencies = { routeTagFamily: tag => Vo(tag), resetTachometer: tachometer => eP(tachometer) };
const racePresenterRenderDependencies = { get transparentSort() { return jm; }, withColorPipeline: (...args) => yo(...args), renderTachometer: (...args) => JL(...args), get blackBarFraction() { return Rv; }, get worldAxis() { return H2; }, get depthAxis() { return $2; }, get postFinishState() { return X2.PostFinish; } };
const raceSessionUpdateDependencies = { nowMs: () => performance.now(), get lteKeyMap() { return Xr0; }, get states() { return X2; } };
const raceChatDependencies = { loadFrame: library => U1(library, ['stage_/common'], 'ingame_chat_Bg').bytes().then(p2), loadEmotions: library => cP(library), loadFontBytes: library => U1(library, ['gui_/font'], 'SourceHanSansCN-Medium', '.otf').bytes(), registerFont: (family, bytes) => f5(family, bytes), releaseFont: font => G1(font), parseChat: (text, emotions) => Ng(text, emotions), nowMs: () => performance.now(), setTimer: (callback, delay) => window.setTimeout(callback, delay), clearTimer: timer => window.clearTimeout(timer) };
const trackInfoCardLoadingDependencies = { configEnabled: library => xs0(library), cardPath: directory => ds0(directory), parseXml: (text, path) => DE(text, path), gameLabels: (game, labels) => ws0(game, labels), uniqueResource: (library, path) => Gn(library, path), parseNode: bytes => s2(bytes), layout: node => Ss0(node), stripIndex: (value, team) => ps0(value, team), decodeImage: entry => yi(entry), difficultyLayout: (...args) => bs0(...args), registerFont: (family, bytes) => f5(family, bytes), releaseFont: font => G1(font), title: (title, trackId) => fs0(title, trackId) };
const trackInfoCardRuntimeDependencies = { configureCanvas: (...args) => p3(...args), pixelRatio: () => xe(), drawTrack: (...args) => ys0(...args), drawReverse: (...args) => As0(...args), drawDifficulty: (...args) => Ms0(...args), drawLabel: (...args) => m9(...args), releaseFont: font => G1(font), removeResizeListener: listener => window.removeEventListener('resize', listener) };

class _L {
    constructor(data, scene, renderScene, skydomeScene, lensFlare) {
    initializeTrackWorld(this, data, scene, renderScene, skydomeScene, lensFlare, {
      p3553ObbQuery: Oo,
      legacyObbQuery: Ai0,
      isRailDescriptor: Ri,
      movingDescriptorIssue: Fl,
      makeStaticSurface: (triangles, query) => new StaticTrackSurface(triangles, query, {
        p3553ObbQuery: Oo,
        p3553ObbBounds: di0,
        roadDescriptorIssue: Vm,
      }),
      makeMovingSurface: (triangles, elements, query) =>
        new MovingTrackSurface(triangles, elements, query, { p3553ObbQuery: Oo }),
      makeObstacleSurface: (triangles, query) =>
        new ObstacleSurface(triangles, query, Oo),
    });
  }
  renderScene;
  skydomeScene;
  lensFlare;
  group = new T2();
  skydome;
  data;
  cameraFar;
  fog;
  sections;
  surface;
  movingSurface;
  obstacleClientWorldElements;
  obstacleClientWorldBounds;
  obstacleSurface;
  pendingObstacleTriangles;
  obstacleKartPaired = !1;
  obstacleKartPairs = new WeakSet();
  eventClientWorldElements;
  pendingEventRuntimes;
  activeEventRuntimes = [];
  expiredEventEffects = [];
  routeStates = new WeakMap();
  triangleObbQuery;




































}
installWorldOverrides(_L);

























function Ai0(n, e) {
  const t = e.axes,
    i = e.center,
    r = e.halfExtents[0],
    s = e.halfExtents[1],
    o = e.halfExtents[2],
    a = t[0],
    c = t[1],
    l = t[2],
    u = n.a.x - i.x,
    h = n.a.y - i.y,
    d = n.a.z - i.z,
    f = n.b.x - i.x,
    p = n.b.y - i.y,
    v = n.b.z - i.z,
    w = n.c.x - i.x,
    g = n.c.y - i.y,
    y = n.c.z - i.z,
    b = u * a.x + h * a.y + d * a.z,
    A = u * c.x + h * c.y + d * c.z,
    x = u * l.x + h * l.y + d * l.z,
    M = f * a.x + p * a.y + v * a.z,
    E = f * c.x + p * c.y + v * c.z,
    _ = f * l.x + p * l.y + v * l.z,
    C = w * a.x + g * a.y + y * a.z,
    S = w * c.x + g * c.y + y * c.z,
    G = w * l.x + g * l.y + y * l.z,
    I = M - b,
    L = E - A,
    k = _ - x,
    D = C - M,
    V = S - E,
    K = G - _,
    P = b - C,
    q = A - S,
    e0 = x - G;
  if (
    C5(b, A, x, M, E, _, C, S, G, 0, k, -L, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, -k, 0, I, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, L, -I, 0, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, 0, K, -V, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, -K, 0, D, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, V, -D, 0, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, 0, e0, -q, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, -e0, 0, P, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, q, -P, 0, r, s, o) ||
    Math.min(b, M, C) > r ||
    -r > Math.max(b, M, C) ||
    Math.min(A, E, S) > s ||
    -s > Math.max(A, E, S) ||
    Math.min(x, _, G) > o ||
    -o > Math.max(x, _, G)
  )
    return !1;
  const Q = C - b,
    U = S - A,
    O = G - x,
    F = L * O - k * U,
    z = k * Q - I * O,
    Y = I * U - L * Q,
    X = -(F * b + z * A + Y * x),
    l0 = F >= 0 ? -r : r,
    r0 = z >= 0 ? -s : s,
    j = Y >= 0 ? -o : o,
    F0 = F * l0 + z * r0 + Y * j + X,
    O0 = F * -l0 + z * -r0 + Y * -j + X;
  return F0 <= 0 && O0 >= 0;
}

function C5(n, e, t, i, r, s, o, a, c, l, u, h, d, f, p) {
  const v = n * l + e * u + t * h,
    w = i * l + r * u + s * h,
    g = o * l + a * u + c * h,
    y = d * Math.abs(l) + f * Math.abs(u) + p * Math.abs(h);
  return Math.min(v, w, g) > y || -y > Math.max(v, w, g);
}







































class Ci0 {
    constructor(assets, room, playerId) { initializeLocalRace(this, assets, room, playerId, localRaceConstructionDependencies); }
  assets;
  lapTiming = new vL();
  boostGaugeFull = !1;
  physics;
  track;
  lifecycle = new OQ();
  startPose;
  coordinator;
  scheduled = !1;
  clockOriginMs = 0;
  disposed = !1;
  lte;
  giant;
  isRoadBlockRunner;
  roadblock;
  naturallyFinished = !1;
  forcedElapsedMs;
  pendingActions = [];
  finishDeadline;
  raceOverAt;
  resultsReady = !1;
  resetState = pr();
  lowSpeedResetStartedAtMs = 0;
  resetSoundPending = !1;
  roadBlockResetNoticePending = !1;
  pendingRouteTags = [];
  warpNext = new Qk();
  pendingWarpActions = [];
  routeClockMs = 0;
  consumeLocalRouteTags() {
    return this.pendingRouteTags.splice(0);
  }
  consumeWarpActions() {
    return this.pendingWarpActions.splice(0);
  }
  lteAvailable() {
    return (
      !this.disposed &&
      this.lifecycle.state === X2.Racing &&
      this.resetState.phase === 0 &&
      !this.warpNext.blocksDriving() &&
      this.physics.lteDodgeAvailable()
    );
  }
  handleModeDrivingCommand(e, t) {
    return this.lte?.dispatch(e, t, this.lteAvailable()) ?? !1;
  }
  cancelModeDrivingInput() {
    this.lte?.cancel();
  }
    requestReset(playerRequested = true) { return requestLocalRaceReset(this, localRaceDependencies, playerRequested); }
  consumeResetSound() {
    const e = this.resetSoundPending;
    return ((this.resetSoundPending = !1), e);
  }
  consumeRoadBlockResetNotice() {
    const e = this.roadBlockResetNoticePending;
    return ((this.roadBlockResetNoticePending = !1), !!e);
  }
  get resetStartedAt() {
    return this.resetState.phase !== 0 && this.resetState.startMs !== 0
      ? this.resetState.startMs
      : void 0;
  }
    checkAutomaticReset(nowMs, stepSeconds) { return checkLocalRaceAutomaticReset(this, localRaceDependencies, nowMs, stepSeconds); }
  resetVisible(e) {
    return gL(this.resetState, e);
  }
  get resetSuspended() {
    return this.resetState.phase === 1 || this.resetState.phase === 2;
  }
    advanceReset(nowMs) { return advanceLocalRaceReset(this, localRaceDependencies, nowMs); }
    acceptEndTiming(finishDeadline, raceOverAt, resultsReady) { return acceptLocalRaceEndTiming(this, localRaceDependencies, finishDeadline, raceOverAt, resultsReady); }
    handleLocalRouteTag(tag) { return handleLocalRaceRouteTag(this, localRaceDependencies, tag); }
    applyWarpActions(actions) { return applyLocalRaceWarpActions(this, actions); }
    scheduleStart(startAtMs) { return scheduleLocalRaceStart(this, startAtMs); }
    get scheduledStartAtMs() { return localRaceScheduledStartAtMs(this); }
    isStartBoosterWindow(nowMs) { return localRaceStartBoosterWindow(this, localRaceDependencies, nowMs); }
    raceProgress() { return localRaceProgress(this); }
    elapsedMs(nowMs) { return localRaceElapsedMs(this, localRaceDependencies, nowMs); }
    update(nowMs, stepSeconds) { return updateLocalRace(this, localRaceDependencies, nowMs, stepSeconds); }
  queueRemoteKart(e, t) {
    this.coordinator.queueRemoteKart(e, t);
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      (this.roadBlockResetNoticePending = !1),
      this.lte?.dispose(),
      this.giant?.dispose(),
      this.giant && this.physics.clearGiantRaceEffects(),
      this.warpNext.reset(),
      this.physics.hardCancelControls(),
      this.physics.setRaceMotionLocked(!0),
      this.coordinator.dispose(),
      this.track.group.removeFromParent(),
      this.track.group.clear());
  }
}



const Y0 = Math.fround;

function RL(n, e, t) {
  return [
    { x: n.x, y: Y0(-e.x), z: t.x },
    { x: Y0(-n.z), y: e.z, z: Y0(-t.z) },
    { x: n.y, y: Y0(-e.y), z: t.y },
  ];
}

function xv(n, e) {
  return (
    (e.right.x = n[0].x),
    (e.right.y = n[2].x),
    (e.right.z = Y0(-n[1].x)),
    (e.forward.x = Y0(-n[0].y)),
    (e.forward.y = Y0(-n[2].y)),
    (e.forward.z = n[1].y),
    (e.up.x = n[0].z),
    (e.up.y = n[2].z),
    (e.up.z = Y0(-n[1].z)),
    e
  );
}



function Ig(n, e) {
  const t = Y0(n.x * n.x),
    i = Y0(n.y * n.y),
    r = Y0(n.z * n.z),
    s = Y0(n.x * n.y),
    o = Y0(n.x * n.z),
    a = Y0(n.y * n.z),
    c = Y0(n.w * n.x),
    l = Y0(n.w * n.y),
    u = Y0(n.w * n.z),
    h = Y0(2);
  return (
    (e[0].x = Y0(Y0(1) - Y0(h * Y0(i + r)))),
    (e[0].y = Y0(h * Y0(s - u))),
    (e[0].z = Y0(h * Y0(o + l))),
    (e[1].x = Y0(h * Y0(s + u))),
    (e[1].y = Y0(Y0(1) - Y0(h * Y0(t + r)))),
    (e[1].z = Y0(h * Y0(a - c))),
    (e[2].x = Y0(h * Y0(o - l))),
    (e[2].y = Y0(h * Y0(a + c))),
    (e[2].z = Y0(Y0(1) - Y0(h * Y0(t + i)))),
    e
  );
}

function IL(n) {
  const e = n[0].x,
    t = n[0].y,
    i = n[0].z,
    r = n[1].x,
    s = n[1].y,
    o = n[1].z,
    a = n[2].x,
    c = n[2].y,
    l = n[2].z,
    u = Y0(Y0(e + s) + l);
  if (u > 0) {
    const b = Y0(Math.sqrt(Y0(u + Y0(1)))),
      A = Y0(Y0(0.5) / b);
    return {
      w: Y0(b * Y0(0.5)),
      x: Y0(Y0(c - o) * A),
      y: Y0(Y0(i - a) * A),
      z: Y0(Y0(r - t) * A),
    };
  }
  const h = [e, s, l];
  let d = 0;
  (h[1] > h[d] && (d = 1), h[2] > h[d] && (d = 2));
  const f = (d + 1) % 3,
    p = (f + 1) % 3,
    v = [
      [e, t, i],
      [r, s, o],
      [a, c, l],
    ],
    w = Y0(Math.sqrt(Y0(Y0(Y0(h[d] - h[f]) - h[p]) + Y0(1)))),
    g = Y0(Y0(0.5) / w),
    y = [0, 0, 0];
  return (
    (y[d] = Y0(w * Y0(0.5))),
    (y[f] = Y0(Y0(v[f][d] + v[d][f]) * g)),
    (y[p] = Y0(Y0(v[p][d] + v[d][p]) * g)),
    { w: Y0(Y0(v[p][f] - v[f][p]) * g), x: y[0], y: y[1], z: y[2] }
  );
}

const oE = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
];

function kL() {
  return {
    position: { x: 0, y: 0, z: 0 },
    right: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 0 },
  };
}

function LL(n, e) {
  return (
    Ig(n.quaternion, oE),
    xv(oE, e),
    (e.position.x = n.x),
    (e.position.y = n.z),
    (e.position.z = Math.fround(-n.y)),
    e
  );
}

function PL(n) {
  return IL(RL(n.right, n.forward, n.up));
}

const i2 = Math.fround,
  Pd = (n, e) => n.map((t, i) => i2(t + e[i])),
  Fd = (n, e) => n.map((t) => i2(t * e)),
  Ti0 = (n, e) => [
    i2(i2(n[1] * e[2]) - i2(n[2] * e[1])),
    i2(i2(n[2] * e[0]) - i2(n[0] * e[2])),
    i2(i2(n[0] * e[1]) - i2(n[1] * e[0])),
  ],
  aE = (n, e) =>
    n.map((t) => i2(i2(i2(t.x * e[0]) + i2(t.y * e[1])) + i2(t.z * e[2]))),
  _i0 = () => [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];

class Bi0 extends RemoteFleet {
  constructor(assets, connection, now, onError, cadence) {
    super(assets, connection, now, onError, cadence, {
      createPresentation: () => new k40(),
      createGiant: () => new pL(false),
      validateGiantState: n20,
      newerSequence: No,
      resetVisible: gv,
    });
  }
}





class ki0 extends OutgoingRaceMotionSender { constructor(source, clock, connection, routing) { super(source, clock, connection, routing, PL); } }

const b9 = Math.fround,
  Dd = (n, e) => b9(b9(b9(n.x * e.x) + b9(n.y * e.y)) + b9(n.z * e.z)),
  cE = (n, e, t) => b9(b9(n + e) + t);

function Li0(n, e) {
  const t = {
      x: b9(e.position.x - n.position.x),
      y: b9(e.position.y - n.position.y),
      z: b9(e.position.z - n.position.z),
    },
    i = n.axes.map((a) => e.axes.map((c) => Dd(a, c))),
    r = i.map((a) => a.map(Math.abs)),
    s = n.axes.map((a) => Dd(a, t));
  let o = !1;
  for (let a = 0; a < 3; a++) {
    o ||= r[a].some((l) => l > b9(0.99999899));
    const c = cE(
      b9(e.halfSize[0] * r[a][0]),
      b9(e.halfSize[1] * r[a][1]),
      b9(e.halfSize[2] * r[a][2]),
    );
    if (Math.abs(s[a]) > b9(n.halfSize[a] + c)) return !1;
  }
  for (let a = 0; a < 3; a++) {
    const c = cE(
      b9(n.halfSize[0] * r[0][a]),
      b9(n.halfSize[1] * r[1][a]),
      b9(n.halfSize[2] * r[2][a]),
    );
    if (Math.abs(Dd(e.axes[a], t)) > b9(c + e.halfSize[a])) return !1;
  }
  if (o) return !0;
  for (let a = 0; a < 3; a++)
    for (let c = 0; c < 3; c++) {
      const l = (a + 1) % 3,
        u = (a + 2) % 3,
        h = (c + 1) % 3,
        d = (c + 2) % 3,
        f = Math.abs(b9(b9(s[u] * i[l][c]) - b9(s[l] * i[u][c]))),
        p = b9(b9(n.halfSize[l] * r[u][c]) + b9(n.halfSize[u] * r[l][c])),
        v = b9(b9(e.halfSize[h] * r[a][d]) + b9(e.halfSize[d] * r[a][h]));
      if (f > b9(p + v)) return !1;
    }
  return !0;
}

const m2 = Math.fround,
  pl = (n, e) => ({ x: m2(n.x + e.x), y: m2(n.y + e.y), z: m2(n.z + e.z) }),
  ac = (n, e) => ({ x: m2(n.x - e.x), y: m2(n.y - e.y), z: m2(n.z - e.z) }),
  Qe = (n, e) => ({ x: m2(n.x * e), y: m2(n.y * e), z: m2(n.z * e) }),
  kg = (n, e) => ({ x: m2(n.x / e), y: m2(n.y / e), z: m2(n.z / e) }),
  ot = (n, e) => m2(m2(m2(n.x * e.x) + m2(n.y * e.y)) + m2(n.z * e.z)),
  T3 = (n, e) => ({
    x: m2(m2(n.y * e.z) - m2(n.z * e.y)),
    y: m2(m2(n.z * e.x) - m2(n.x * e.z)),
    z: m2(m2(n.x * e.y) - m2(n.y * e.x)),
  }),
  DL = (n) => m2(Math.sqrt(ot(n, n))),
  Vd = (n) => {
    const e = DL(n);
    return e === 0 ? { x: 1, y: 1, z: 1 } : kg(n, e);
  },
  VL = (n) => [
    { x: n[0].x, y: n[1].x, z: n[2].x },
    { x: n[0].y, y: n[1].y, z: n[2].y },
    { x: n[0].z, y: n[1].z, z: n[2].z },
  ],
  hs = (n, e) => ({ x: ot(n[0], e), y: ot(n[1], e), z: ot(n[2], e) }),
  lE = (n, e) => {
    const t = VL(e);
    return n.map((i) => ({ x: ot(i, t[0]), y: ot(i, t[1]), z: ot(i, t[2]) }));
  };

function uE(n) {
  const e = m2(12 / m2(n.mass));
  return lE(
    lE(n.rotation, [
      { x: e, y: 0, z: 0 },
      { x: 0, y: e, z: 0 },
      { x: 0, y: 0, z: e },
    ]),
    n.rotation,
  );
}

function hE(n) {
  const e = VL(n.rotation);
  return {
    axes: e,
    position: pl(n.position, e[2]),
    halfSize: [m2(n.halfWidth * n.scaleX), m2(n.halfLength * n.scaleY), 1],
  };
}

function Pi0(n, e, t, i = 1, r = 1) {
  if (!Li0(hE(n), hE(e))) return;
  const s = (E) =>
      m2(
        Math.sqrt(
          m2(m2(E.halfWidth * E.halfWidth) + m2(E.halfLength * E.halfLength)),
        ),
      ),
    o = s(n),
    a = s(e),
    c = kg(pl(Qe(e.position, o), Qe(n.position, a)), m2(o + a)),
    l = ac(c, n.position),
    u = ac(c, e.position),
    h = Vd(ac(l, u)),
    d = ac(
      pl(n.velocity, T3(hs(n.rotation, n.angularVelocity), l)),
      pl(e.velocity, T3(hs(e.rotation, e.angularVelocity), u)),
    ),
    f = ot(d, h);
  if (f <= 0) return;
  const p = ot(d, d) >= 6.25 ? Vd(d) : h,
    v = uE(n),
    w = uE(e),
    g = Math.abs(
      m2(ot(p, T3(hs(v, T3(l, p)), l)) + ot(p, T3(hs(w, T3(u, p)), u))),
    ),
    y = m2(m2(1 / m2(n.mass)) + m2(1 / m2(e.mass))),
    b = -m2(m2(f * m2(1.4)) / y),
    A = -m2(m2(ot(d, p) * m2(1.4)) / m2(y + g));
  let x = Qe(hs(v, T3(l, Qe(p, A))), m2(0.05));
  const M = m2(1.570796);
  return (
    DL(x) > M && (x = Qe(Vd(x), M)),
    {
      linear: Qe(Qe(Qe(kg(Qe(h, b), m2(n.mass)), i), m2(t)), r),
      angular: Qe(Qe(Qe(x, i), m2(t)), r),
      strength: Math.abs(m2(b / m2(n.mass))),
    }
  );
}

const Nd = (n) => ({
    x: Math.fround(n.x),
    y: Math.fround(-n.z),
    z: Math.fround(n.y),
  }),
  dE = (n) => ({ x: n.x, y: n.z, z: Math.fround(-n.y) }),
  Fi0 = (n) => {
    const e = Math.fround;
    return e(
      e(Math.sqrt(e(e(e(n.x * n.x) + e(n.y * n.y)) + e(n.z * n.z)))) * e(3.6),
    );
  };

function Di0(n, e, t, i, r) {
  if (n.speedRaceMode?.kind === "shadow") return;
  const s = n.networkCollisionState();
  if (!s.active) return;
  const o =
    n.timeAttackTachometerCharger().active && t.charger !== 1
      ? t.charger
      : t.ordinary;
  e.forEachCollisionBody(i, (a, c, l) => {
    if (r && l === void 0) throw new Error("碰撞帧率历史缺少对手身份。");
    const u = r && l !== void 0 ? r.factor(l, n.networkCollisionScheduled) : 1,
      h = n.body,
      d = n.collisionShape,
      f = Pi0(
        {
          position: Nd(h.position),
          rotation: RL(h.right, h.forward, h.up),
          velocity: Nd(h.linearVelocity),
          angularVelocity: Nd(h.angularVelocity),
          mass: n.tuning.mass,
          halfWidth: d.rawHalfWidth,
          halfLength: d.rawHalfLength,
          scaleX: s.scaleX,
          scaleY: s.scaleY,
        },
        a,
        o,
        c,
        u,
      );
    if ((r && l !== void 0 && r.record(l, f !== void 0), f)) {
      const p = n.giant,
        v = l === void 0 ? void 0 : e.giant(l);
      if (p) {
        if (!v) throw new Error("巨人碰撞缺少对手规则 owner。");
        if (
          (p.processKartContact(
            v,
            n.displaySpeedKmh(),
            Fi0(a.velocity),
            i,
            n.giantSourceProtected(),
          ),
          v.flattened)
        )
          return;
      }
      n.applyKartPairResponse(dE(f.linear), dE(f.angular), f.strength);
    }
  });
}

class Vi0 extends RacePeerCadence { constructor(race, localId) { super(race, localId, G2(race) !== "ordinary"); } }

class Ui0 {
  constructor(e, t, i, r, s, o) {
    ((this.assets = e),
      (this.connection = i),
      (this.onError = s),
      (this.rpIdentity = t.rp ? mI(t.rp) : void 0),
      (this.roadblockIdentity = t.roadblock
        ? Object.freeze({ ...t.roadblock })
        : void 0),
      (this.lteIdentity = t.lte ? Object.freeze({ ...t.lte }) : void 0),
      (this.giantIdentity = t.giant ? Object.freeze({ ...t.giant }) : void 0),
      (this.collisionFramerate = new Ni0(
        e.checkClientFramerate && e.channel.adjustCollision,
        e.participants
          .filter((c) => c.playerId !== i.playerId)
          .map((c) => c.playerId),
        o,
      )));
    let a;
    try {
      if (e.channel.name !== t.channelName)
        throw new Error("比赛频道与已加载资源不一致。");
      if (
        ((a = new Ci0(e, t, i.playerId)),
        (this.local = a),
        a.giant && !i.sendGiantState)
      )
        throw new Error("缺少巨人可靠状态发送通道。");
      if (
        ((this.cadence = new Vi0(t, i.playerId)),
        e.mode === "team" && e.speed !== 4)
      ) {
        if (!i.sendTeamCharge || !i.subscribeTeamGauge)
          throw Error("缺少组队集气通道。");
        const l = t.roster.find((u) => u.playerId === i.playerId).team;
        this.offTeam = i.subscribeTeamGauge((u) => {
          this.disposed ||
            u.team !== l ||
            u.sequence <= this.teamSequence ||
            this.room?.phase !== "racing" ||
            ((this.teamSequence = u.sequence),
            this.local.physics.enqueueMultiplayerTeamTarget(u.target));
        });
      }
      this.remotes = new Bi0(
        e,
        i,
        r,
        (l) => {
          try {
            s(l);
          } finally {
            this.dispose();
          }
        },
        this.cadence,
      );
      const c = e.participants.find(
        (l) => l.playerId === i.playerId,
      ).collisionBalance;
      this.local.queueRemoteKart(
        {
          name: "GoNetKart[]",
          category: 0,
          active: !0,
          removeRequested: !1,
          slot12: (l) => {
            (this.remoteFrameUpdated || this.updateRemotes(l),
              this.local.giant?.updateEffects(l),
              this.remotes.updateGiantEffects(l));
          },
          slot13: () => {},
          commit: () => {},
          destroy: () => {},
        },
        (l) =>
          Di0(this.local.physics, this.remotes, c, l, this.collisionFramerate),
      );
    } catch (c) {
      throw (
        this.collisionFramerate.dispose(),
        this.offTeam?.(),
        this.cadence?.dispose(),
        a?.dispose(),
        e.dispose(),
        c
      );
    }
  }
  assets;
  connection;
  onError;
  local;
  remotes;
  localPresentation;
  presentation = new I40();
  slipstream = new fE();
  remoteSlipstreams = new Map();
  disposed = !1;
  clockBound = !1;
  mapping;
  room;
  finishReported = !1;
  offTeam;
  teamSequence = 0;
  teamSentSequence = 0;
  teamCharge = 0;
  teamSentAt = -1 / 0;
  finishDeadline;
  sender;
  cadence;
  collisionFramerate;
  remotePhysicsBypass = !1;
  remoteFrameUpdated = !1;
  rpIdentity;
  roadblockIdentity;
  lteIdentity;
  giantIdentity;
  giantSequence = 0;
  giantSend = Promise.resolve();
  giantCleared = !1;
  get giantEffectsEnded() {
    return this.giantCleared;
  }
    bindClock(mapping) { return bindActiveRaceClock(this, mapping, { makeClock: value => new BL(value), makeSender: (physics, clock, connection, routing) => new ki0(physics, clock, connection, routing) }); }
    scheduleStart(startAt) { return scheduleActiveRaceStart(this, startAt); }
    updateRoom(room) { return updateActiveRaceRoom(this, room, raceRoomDependencies); }
    update(nowMs, frame, bypass) { return updateActiveRaceFrame(this, nowMs, frame, bypass, { racingState: X2.Racing, resultState: X2.Result, captureMotion: B40, captureAnimation: R40 }); }
  raceSnapshot() {
    return this.room?.race;
  }
  latencyMs(e) {
    return this.connection.latencyMs?.(e);
  }
  draftPresentationVisible(e) {
    return e === this.connection.playerId
      ? this.slipstream.presentationVisible
      : (this.remoteSlipstreams.get(e)?.presentationVisible ?? !1);
  }
  draftBurstActive(e) {
    return e === this.connection.playerId
      ? this.slipstream.hudActive
      : (this.remoteSlipstreams.get(e)?.hudActive ?? !1);
  }
  localDraftHudActive() {
    return this.slipstream.hudActive;
  }
    updateRemotes(nowMs) { return updateRaceRemoteViews(this, nowMs, { racingState: X2.Racing, resultState: X2.Result }); }
  resultSnapshot() {
    return this.room?.race?.results;
  }
  roadBlockRunnerProgress() {
    const e = this.roadblockIdentity?.runnerId;
    if (e)
      return e === this.connection.playerId
        ? this.local.raceProgress()
        : this.remotes.raceProgress(e);
  }
    roadBlockRemaining(nowMs) { return roadblockRemaining(this, nowMs, Y3); }
  finishSnapshot() {
    return this.room?.race?.finishes ?? [];
  }
    dispose() { return disposeActiveRace(this); }
}

const NL = 0.6796875;

function zn(n) {
  return n.uniforms?.normalUvOffset !== void 0;
}

function OL(n) {
  (n.uniforms.normalUvOffset.value.set(n.uniforms.normalUvOffset.value.x, NL),
    (n.uniforms.alphaTestEnabled.value = 1),
    (n.uniforms.alphaFunction.value = 5),
    (n.uniforms.alphaReference.value = 0),
    (n.transparent = !0),
    (n.blending = u1),
    (n.blendSrc = l1),
    (n.blendDst = v1),
    (n.blendEquation = R9));
}

function f6(n, e) {
  ((e.uniforms.toonEnv.value = n.uniforms.toonEnv.value),
    e.uniforms.clientWorld.value.copy(n.uniforms.clientWorld.value),
    e.uniforms.clientWorldInverse.value.copy(
      n.uniforms.clientWorldInverse.value,
    ),
    e.uniforms.viewOriginClient.value.copy(n.uniforms.viewOriginClient.value));
}

class $i0 {
  bindings = [];
  constructor(e) {
    try {
      (e.traverse((t) => {
        if (!(t instanceof D2)) return;
        const i = t.material,
          r = [],
          s = (Array.isArray(i) ? i : [i]).map((c) => {
            if (!zn(c)) return c;
            const l = c.clone();
            return (
              (l.uniforms.baseMap.value = c.uniforms.baseMap.value),
              (l.uniforms.toonEnv.value = c.uniforms.toonEnv.value),
              OL(l),
              r.push({ source: c, clone: l }),
              l
            );
          });
        if (r.length === 0) return;
        let o;
        try {
          o = QG(t);
        } catch (c) {
          for (const l of r) l.clone.dispose();
          throw c;
        }
        const a = t.onBeforeRender;
        (this.bindings.push({
          mesh: t,
          original: i,
          callback: a,
          restoreRecord: o,
          pairs: r,
        }),
          (t.material = Array.isArray(i) ? s : s[0]),
          (t.onBeforeRender = function (...c) {
            a.apply(this, c);
            for (const l of r) f6(l.source, l.clone);
          }));
      }),
        this.update());
    } catch (t) {
      throw (this.dispose(), t);
    }
  }
  update() {
    for (const e of this.bindings)
      for (const t of e.pairs) f6(t.source, t.clone);
  }
  dispose() {
    for (const e of this.bindings.splice(0).reverse()) {
      ((e.mesh.material = e.original),
        (e.mesh.onBeforeRender = e.callback),
        e.restoreRecord());
      for (const t of e.pairs) t.clone.dispose();
    }
  }
}

function pE(n, e, t, i) {
  if (n.kind !== "fixed" || n.category !== "vec3" || n.keyType !== 1)
    throw new Error("CharSequence position 仅支持 Vec3 keyType1。 ");
  const r = n.records.map((h) => {
      const d = p6(h);
      return {
        time: d.getUint32(0, !0),
        value: [d.getFloat32(4, !0), d.getFloat32(8, !0), d.getFloat32(12, !0)],
      };
    }),
    [s, o] = Sv(r),
    a = Cv(e.base, t, i, s, o),
    c = Ev(r, a);
  if (c.left === c.right) return c.left.value;
  const l = zL(c.left.time, c.right.time, a),
    u = u2(1 - l);
  return [0, 1, 2].map((h) =>
    u2(u2(c.left.value[h] * u) + u2(c.right.value[h] * l)),
  );
}

function Wi0(n, e, t, i, r = Ki0) {
  if (n.kind !== "fixed" || n.category !== "rotation" || n.keyType !== 1)
    throw new Error("CharSequence rotation 仅支持 quaternion keyType1。 ");
  const s = n.records.map((u) => {
      const h = p6(u);
      return {
        time: h.getUint32(0, !0),
        value: [
          h.getFloat32(8, !0),
          h.getFloat32(12, !0),
          h.getFloat32(16, !0),
          h.getFloat32(4, !0),
        ],
      };
    }),
    [o, a] = Sv(s),
    c = Cv(e.base, t, i, o, a),
    l = Ev(s, c);
  return l.left === l.right
    ? l.left.value
    : r(l.left.value, l.right.value, zL(l.left.time, l.right.time, c));
}

function Hi0(n, e, t) {
  const i = n.keys.value;
  if (i.kind !== "fixed" || i.category !== "integer" || i.keyType !== 3)
    throw new Error("CharSequence root 仅支持 Int keyType3。 ");
  const r = i.records.map((c) => ({
      time: p6(c).getUint32(0, !0),
      value: p6(c).getInt32(4, !0),
    })),
    [s, o] = Sv(r),
    a = Cv(n.base, e, t, s, o);
  return Ev(r, a).left.value;
}

function Sv(n) {
  return n.length > 1 ? [n[0].time, n[n.length - 1].time] : [0, 0];
}

function Cv(n, e, t, i, r) {
  e.anchor === 0 && t !== 0 && (e.anchor = t);
  const s = (e.anchor + n.phase) >>> 0;
  let o = t < s ? 0 : (t + n.phase - e.anchor) >>> 0;
  Yi0(n.frequency) !== 1065353216 &&
    (o = Math.trunc(u2(u2(o) * n.frequency)) >>> 0);
  const a = Math.trunc(u2(u2((r - i) >>> 0) * n.frequency)) >>> 0;
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

function Ev(n, e) {
  if (n.length === 0) throw new Error("CharSequence track 不含 key。 ");
  let t = 0;
  for (; t + 1 < n.length && e > n[t + 1].time;) t += 1;
  return { left: n[t], right: n[Math.min(t + 1, n.length - 1)] };
}

function zL(n, e, t) {
  const i = (e - n) >>> 0;
  return i === 0 ? 0 : u2(u2((t - n) >>> 0) / u2(i));
}

function qi0(n) {
  return { translation: [...n.translation], rotation: [...n.rotation] };
}

function Ki0(n, e, t) {
  const i = u2(ji0(n, e));
  let r = u2(1 - u2(i * u2(0.82279688)));
  r = u2(u2(r * r) * u2(0.58549219));
  let s;
  if (t > 0.5) {
    const l = u2(1 - t);
    s = u2(1 - u2(u2(u2(u2(u2(l + l) - 3) * u2(r * l)) + 1 + r) * l));
  } else s = u2(u2(u2(u2(u2(t + t) - 3) * u2(r * t)) + 1 + r) * t);
  const o = [0, 1, 2, 3].map((l) => u2(u2(e[l] - n[l]) * s + n[l])),
    a = u2(u2(u2(o[0] * o[0] + o[1] * o[1]) + o[2] * o[2]) + o[3] * o[3]);
  let c = u2(u2(a - u2(0.95906597)) * u2(-0.53251559) + u2(1.0214351));
  return (
    a <= u2(0.91521198) &&
      ((c = gE(a, c)), a <= u2(0.6521197) && (c = gE(a, c))),
    o.map((l) => u2(l * c))
  );
}

function gE(n, e) {
  return u2(
    e *
      u2(
        u2(u2(u2(e * e) * n) - u2(0.95906597)) * u2(-0.53251559) +
          u2(1.0214351),
      ),
  );
}

function ji0(n, e) {
  return u2(
    u2(u2(u2(n[0] * e[0]) + u2(n[1] * e[1])) + u2(n[2] * e[2])) +
      u2(n[3] * e[3]),
  );
}

function Xi0() {
  return { anchor: 0, previousCycle: 0, reverseHalf: !1 };
}

function p6(n) {
  return new DataView(n.buffer, n.byteOffset, n.byteLength);
}

function Yi0(n) {
  const e = new ArrayBuffer(4),
    t = new DataView(e);
  return (t.setFloat32(0, n, !0), t.getUint32(0, !0));
}

function u2(n) {
  return Math.fround(n);
}

const jt = Math.fround,
  z5 = (n, e) => jt(n + e),
  U3 = (n, e) => jt(n - e),
  p1 = (n, e) => jt(n * e),
  Lg = (n, e) =>
    z5(z5(z5(p1(n[3], e[3]), p1(n[0], e[0])), p1(n[1], e[1])), p1(n[2], e[2]));

function UL(n, e, t) {
  let i = U3(1, p1(Lg(n, e), jt(0.82279688)));
  i = p1(p1(i, i), jt(0.58549219));
  const r = (u) => p1(z5(z5(p1(U3(z5(u, u), 3), p1(i, u)), 1), i), u),
    s = t > 0.5 ? U3(1, r(U3(1, t))) : r(t),
    o = n.map((u, h) => z5(p1(U3(e[h], u), s), u)),
    a = Lg(o, o),
    c = (u) => z5(p1(U3(u, jt(0.95906597)), jt(-0.53251559)), jt(1.0214351));
  let l = c(a);
  return (
    a <= jt(0.91521198) &&
      ((l = p1(l, c(p1(p1(l, l), a)))),
      a <= jt(0.6521197) && (l = p1(l, c(p1(p1(l, l), a))))),
    o.map((u) => p1(u, l))
  );
}

function Zi0(n, e, t) {
  const i =
    Lg(n.rotation, e.rotation) < 0 ? e.rotation.map((r) => -r) : e.rotation;
  return {
    translation: [0, 1, 2].map((r) =>
      z5(p1(n.translation[r], U3(1, t)), p1(e.translation[r], t)),
    ),
    rotation: UL(n.rotation, i, t),
  };
}

const o9 = Math.fround,
  Qi0 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  zd = () => ({ translation: [0, 0, 0], rotation: [0, 0, 0, 0] });

class cc {
  target;
  clocks = new Map();
  elapsed = 0;
  previous = 0;
  blend = 0;
  samples = [];
  from = [];
  to = [];
  matrices = [];
  selector = 0;
  pending;
  constructor(e) {
    this.bind(e, 0);
  }
  get sequence() {
    return this.target;
  }
  get faceSlot() {
    return this.selector;
  }
  get pose() {
    return this.matrices;
  }
  reset(e) {
    (this.clocks.clear(),
      (this.elapsed = this.previous = this.blend = 0),
      (this.pending = void 0),
      (this.samples = []),
      (this.matrices.length = 0),
      this.bind(e));
  }
  bind(e, t = 0, i = !1, r = 300, s = 0) {
    const o = e.channels.length;
    if (
      !o ||
      o > 256 ||
      e.rootChannel.value.className !== "IntTontroller" ||
      e.map.length > 8 ||
      e.channels.some((c) => c.value.className !== "PRSTontroller")
    )
      throw new Error("飞宠动作通道或纹理槽格式不受支持。");
    i && this.target
      ? (this.pending = {
          sequence: this.pending?.sequence ?? this.target,
          blend: this.pending?.blend ?? r,
          threshold: ((s || e.header[2]) + t) >>> 0,
        })
      : (this.pending = void 0);
    const a = this.target?.channels.length ?? 0;
    ((this.from = Array.from({ length: o }, (c, l) =>
      l < a ? qi0(this.samples[l] ?? zd()) : zd(),
    )),
      (this.to = e.channels.map((c, l) => (l < a ? Ji0(c.value) : zd()))));
    for (let c = a; c < o; c++) this.matrices[c] = Qi0;
    ((this.blend = this.elapsed !== 0 ? t >>> 0 : 0),
      (this.elapsed = 0),
      (this.target = e),
      this.blend && (this.selector = er0(e.rootChannel.value)));
  }
  update(e) {
    if (((e >>>= 0), this.pending)) {
      const t = this.pending;
      (t.anchor || (t.anchor = e),
        (e - t.anchor) >>> 0 >= t.threshold && this.bind(t.sequence, t.blend));
    }
    if (
      ((this.elapsed =
        this.elapsed === 0 ? 1 : (this.elapsed - this.previous + e) >>> 0),
      (this.previous = e),
      this.blend && this.elapsed <= this.blend)
    ) {
      const t = o9(o9(this.elapsed) * o9(1 / o9(this.blend)));
      this.samples = this.from.map((i, r) => Zi0(i, this.to[r], t));
    } else {
      if (this.blend) {
        ((this.elapsed = (this.elapsed - this.blend) >>> 0), (this.blend = 0));
        for (const t of this.target.channels) this.clock(t.value).anchor = 0;
        this.clock(this.target.rootChannel.value).anchor = 0;
      }
      ((this.samples = this.target.channels.map((t) => {
        const i = t.value,
          r = this.clock(i),
          s = i.position ? pE(i.position.value, i, r, this.elapsed) : [0, 0, 0],
          o = i.rotation
            ? Wi0(i.rotation.value, i, r, this.elapsed, UL)
            : [0, 0, 0, 1];
        return (
          i.scale && pE(i.scale.value, i, r, this.elapsed),
          { translation: s, rotation: o }
        );
      })),
        (this.selector = Hi0(
          this.target.rootChannel.value,
          this.clock(this.target.rootChannel.value),
          this.elapsed,
        )));
    }
    if (
      (this.samples.forEach((t, i) => {
        this.matrices[i] = tr0(t);
      }),
      !Number.isInteger(this.selector) ||
        this.selector < 0 ||
        this.selector >= this.target.map.length)
    )
      throw new Error("飞宠动作选择了无效纹理槽。");
    return this.matrices;
  }
  clock(e) {
    let t = this.clocks.get(e);
    return (t || ((t = Xi0()), this.clocks.set(e, t)), t);
  }
}

function Ji0(n) {
  const e = n.position?.value,
    t = n.rotation?.value;
  if (
    !e ||
    e.kind !== "fixed" ||
    e.records.length === 0 ||
    !t ||
    t.kind !== "fixed" ||
    t.records.length === 0
  )
    throw new Error("飞宠混合动作缺少位置/旋转首关键帧。");
  const i = Pg(e.records[0]),
    r = Pg(t.records[0]);
  return {
    translation: [
      i.getFloat32(4, !0),
      i.getFloat32(8, !0),
      i.getFloat32(12, !0),
    ],
    rotation: [
      r.getFloat32(8, !0),
      r.getFloat32(12, !0),
      r.getFloat32(16, !0),
      r.getFloat32(4, !0),
    ],
  };
}

function er0(n) {
  const e = n.keys.value;
  if (e.kind !== "fixed" || !e.records.length)
    throw new Error("飞宠贴图控制器缺少首帧。");
  return Pg(e.records[0]).getInt32(4, !0);
}

function Pg(n) {
  return new DataView(n.buffer, n.byteOffset, n.byteLength);
}

function tr0({ translation: [n, e, t], rotation: [i, r, s, o] }) {
  const a = o9(o9(i + i) * i),
    c = o9(o9(r + r) * r),
    l = o9(o9(s + s) * s),
    u = o9(o9(r + r) * i),
    h = o9(o9(s + s) * i),
    d = o9(o9(s + s) * r),
    f = o9(o9(i + i) * o),
    p = o9(o9(r + r) * o),
    v = o9(o9(s + s) * o);
  return [
    o9(1 - o9(c + l)),
    o9(u - v),
    o9(h + p),
    n,
    o9(u + v),
    o9(1 - o9(a + l)),
    o9(d - f),
    e,
    o9(h - p),
    o9(d + f),
    o9(1 - o9(a + c)),
    t,
  ];
}

class mE {
  constructor(e, t, i) {
    ((this.assets = e), (this.primary = t), (this.high = i));
  }
  assets;
  primary;
  high;
  textures = new Map();
  disposed = !1;
  body() {
    return this.load("body").then((e) => {
      if (!e) throw new Error("飞宠缺少主体贴图。");
      return e;
    });
  }
  face(e) {
    return this.load(`f${String(e).padStart(2, "0")}`);
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (const e of this.textures.values())
        e.then(
          (t) => t?.dispose(),
          () => {},
        );
      this.textures.clear();
    }
  }
  load(e) {
    if (this.disposed) throw new Error("飞宠贴图owner已释放。");
    let t = this.textures.get(e);
    return (t || ((t = this.create(e)), this.textures.set(e, t)), t);
  }
  async create(e) {
    const t = e === "body" || !!this.assets.find("f00_0.png"),
      i = t ? this.assets.find(e === "body" ? "0.png" : `${e}_0.png`) : void 0,
      r = this.assets.find(
        e === "body" ? "1.png" : t ? `${e}_1.png` : `${e}.png`,
      );
    if (!r) return;
    const s = await r.bytes(),
      o = await p2(s);
    let a = o.pixels;
    if (i) {
      const l = await i.bytes();
      if (l[24] === 8 && l[25] === 6 && s[24] === 8 && s[25] === 6) {
        const u = await p2(l);
        if (u.width === o.width && u.height === o.height)
          a = K6(u.pixels, a, this.primary, this.high);
        else if (e !== "body") return;
      } else if (e !== "body") return;
    } else if (t && e !== "body") return;
    const c = new J9(a, o.width, o.height, e9);
    return (
      (c.name = `${this.assets.name}:${e}`),
      (c.colorSpace = v9),
      (c.flipY = !1),
      (c.wrapS = c.wrapT = S1),
      (c.minFilter = c.magFilter = h9),
      (c.generateMipmaps = !1),
      (c.needsUpdate = !0),
      c
    );
  }
}

function nr0(n) {
  return new _o().set(
    n[0],
    n[1],
    n[2],
    n[3],
    n[4],
    n[5],
    n[6],
    n[7],
    n[8],
    n[9],
    n[10],
    n[11],
    0,
    0,
    0,
    1,
  );
}

function wE(n, e) {
  const t = {
      className: "AlphaProperty",
      blendEnable: 0,
      srcBlend: 2,
      dstBlend: 1,
      alphaTestEnable: 0,
      alphaFunc: 8,
      alphaRef: 0,
    },
    i = { className: "ZBufProperty", mode: 4, enabled: 1 },
    r = n?.slots[3]?.value,
    s = n?.slots[10]?.value;
  return {
    alpha: r?.className === "AlphaProperty" ? r : (e?.alpha ?? t),
    zbuf: s?.className === "ZBufProperty" ? s : (e?.zbuf ?? i),
  };
}

function ir0(n, e) {
  const t = (i, r) => ({ source: "property-bank", value: i, bankIndex: r });
  return {
    alpha: t(
      {
        kind: "alpha",
        blendEnable: n.blendEnable,
        srcBlend: n.srcBlend,
        dstBlend: n.dstBlend,
        alphaTestEnable: n.alphaTestEnable,
        compare: n.alphaFunc,
        alphaRef: n.alphaRef,
      },
      0,
    ),
    backface: t({ kind: "backface", cull: 2 }, 7),
    fog: t(
      {
        kind: "fog-property",
        selector: 0,
        mode: 1,
        color: 0,
        start: 0,
        end: 1,
        density: 1,
      },
      11,
    ),
    material: t(
      {
        kind: "material",
        mode: 0,
        ambient: 4294967295,
        diffuse: 4294967295,
        specular: 4294967295,
        power: 1,
        reserved: 0,
        emissive: 4294967295,
        controllers: [],
        controllerOccurrences: [],
      },
      12,
    ),
    texture: t(
      {
        kind: "texture",
        textureOp: 1,
        addressU: 1,
        addressV: 1,
        minFilter: 1,
        magFilter: 1,
        mipFilter: 0,
        maxAnisotropy: 1,
        uvControllers: [],
        uvControllerOccurrences: [],
        scalar: 1,
      },
      13,
    ),
    toon: t(
      {
        kind: "toon",
        flags: [1, 1],
        words: [1, 4, 4294967295, 1065353216, 0, 2, 0, 4278190080, 2130706432],
      },
      15,
    ),
    wire: t({ kind: "wire", enabled: 0 }, 16),
    zbuffer: t({ kind: "zbuffer", zFunc: e.mode, zWrite: e.enabled }, 19),
  };
}

function rr0(n) {
  const e = new Float32Array(n.faces.length * 9),
    t = new Float32Array(n.faces.length * 9),
    i = new Float32Array(n.faces.length * 6);
  n.faces.forEach((s, o) => {
    for (let a = 0; a < 3; a += 1) {
      const c = n.texcoords[s.texcoordIndices[a]];
      (e.set(n.positions[s.positionIndices[a]], o * 9 + a * 3),
        t.set(n.normals[c.normalIndex], o * 9 + a * 3),
        i.set([c.u, c.v], o * 6 + a * 2));
    }
  });
  const r = new t9();
  return (
    r.setAttribute("position", new _0(e, 3)),
    r.setAttribute("normal", new _0(t, 3)),
    r.setAttribute("uv", new _0(i, 2)),
    r
  );
}

function Ud(n, e) {
  (cn(n), c3(n, e));
}

function vE(n) {
  return [
    "ReKart",
    "Relement",
    "ReCharacter",
    "ReToonRigid",
    "ReTriList",
    "ReToonSkinned",
  ].includes(n.value.className);
}

function sr0(n) {
  const e = (t) => {
    const i = n.bones[t];
    if (!i) throw new Error("飞宠骨骼索引越界。");
    if (t !== 0 && i.enabled) {
      if (i.parentIndex >= t) throw new Error("飞宠骨骼父索引无效。");
      e(i.parentIndex);
    }
  };
  e(5);
  for (const t of n.vertices)
    for (const [i, r] of [
      [t.bone0, t.bone1 === 65535 || t.weight0 !== 0],
      [t.bone1, t.bone1 !== 65535 && t.weight1 !== 0],
    ])
      if (r && (e(i), !n.bones[i].reserved))
        throw new Error("此飞宠依赖原生保留蒙皮矩阵，暂不支持显示。");
}

class Ks {
  object = new T2();
  headSocket;
  skin;
  skinSource;
  frame;
  draws = [];
  materials = [];
  rigid = [];
  attachments = [];
  faceMaterials = [];
  faces = new Map();
  head;
  disposed = !1;
  static async load(e, t, i, r, s) {
    const o = await i.body(),
      a = new Map();
    for (const c of new Set(t.flatMap((l) => l.map))) {
      const l = await i.face(c);
      l && a.set(c, l);
    }
    return new Ks(e, o, a, r, s);
  }
  constructor(e, t, i, r, s) {
    const o = e.root.value;
    if (o.className !== "RePet2") throw new Error("飞宠模型不是 RePet2。");
    const a = o.children[0]?.value;
    if (a?.className !== "ReToonSkinned") throw new Error("飞宠主蒙皮缺失。");
    (sr0(a.geometry.value),
      (this.skinSource = a.geometry.value),
      (this.skin = new vR(this.skinSource)),
      qm(this.object, () => this.collect()));
    try {
      ((this.faces = i),
        (this.object.name = "FlyingPet:RePet2"),
        Ud(this.object, o.transform));
      const c = wE(o),
        l = (d, f, p, v, w, g = !0) => {
          const y = bo(v, { kind: "normal-projection" }),
            b = wE(p, c);
          (Mo(y, ir0(b.alpha, b.zbuf)),
            this.materials.push(y),
            w && this.faceMaterials.push(y));
          const A = new D2(d, y);
          ((A.frustumCulled = !1),
            ie(
              A,
              o.sortDepthBias,
              y.transparent,
              y.transparent ? -0.01 : 0,
              this.object,
            ));
          const x = new N6(f, 4278190080, 2130706432, g);
          ((x.object.visible = g),
            ie(x.object, o.sortDepthBias, !0, 0, this.object));
          const M = new T2();
          (M.add(A, x.object),
            Ud(M, p.transform),
            (M.visible = p.nodeEnabled !== 0),
            this.draws.push({ mesh: A, outline: x }));
          const E = new v2(),
            _ = new v2(),
            C = new v2().makeRotationX(Math.PI / 2),
            S = new H();
          return (
            (A.onBeforeRender = (G, I, L) => {
              (E.copy(C).multiply(A.matrixWorld),
                L.getWorldPosition(S),
                S.set(S.x, -S.z, S.y),
                _.copy(E).invert(),
                xo(y, r, s, E, _, S));
            }),
            M
          );
        },
        u = l(this.skin.geometry, this.skin.outlineSource, a, t, !1);
      (u.matrix.identity(), this.object.add(u));
      for (const d of [1, 2]) {
        const f = o.children[d]?.value;
        if (!f || !("children" in f)) continue;
        const p = f.children[0]?.value;
        if (!p && d === 2) continue;
        if (!p || p.className !== "ReToonRigid")
          throw new Error("飞宠刚性附件结构不支持。");
        const v = rr0(p.geometry.value);
        this.rigid.push(v);
        const w = l(
          v,
          p.geometry.value,
          p,
          d === 1 ? (i.values().next().value ?? t) : t,
          d === 1,
          d !== 2,
        );
        (this.attachments.push({ object: w, local: w.matrix.clone() }),
          this.object.add(w));
      }
      const h = o.children[3];
      if (h) {
        if (!vE(h) || h.value.name !== "head")
          throw new Error("飞宠头部挂点结构不支持。");
        const d = (f) => {
          if (f.className !== "Relement")
            throw new Error("飞宠头部包含未支持的几何。");
          const p = new T2();
          Ud(p, f.transform);
          for (const v of f.children) {
            if (!vE(v)) throw new Error("飞宠头部子节点不是 Relement。");
            p.add(d(v.value));
          }
          return p;
        };
        ((this.head = d(h.value)),
          (this.headSocket = this.head.children[0]),
          this.object.add(this.head));
      }
    } catch (c) {
      throw (this.dispose(), c);
    }
  }
  update(e, t, i, r, s) {
    this.frame = { animation: e, camera: t, width: i, height: r, now: s };
  }
  collect() {
    if (this.disposed || !this.frame) return;
    const { animation: e, camera: t, width: i, height: r, now: s } = this.frame;
    e.update(s);
    const o = AR.collect(this.skinSource, e.pose);
    this.skin.applyPalette(
      this.skinSource.bones.map((l, u) => yR(o[u], l.inverseBind)),
    );
    const a = this.faces.get(e.sequence.map[e.faceSlot]);
    for (const l of this.faceMaterials)
      (JH(l, !a),
        a &&
          ((l.uniforms.baseMap.value = a),
          (l.uniforms.uvControllerEnabled.value = 0)));
    const c = nr0(o[5]);
    for (const l of this.attachments) l.object.matrix.copy(c).multiply(l.local);
    (this.head?.matrix.copy(c), this.object.updateWorldMatrix(!0, !0));
    for (const { mesh: l, outline: u } of this.draws) u.update(l, t, i, r);
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.object.removeFromParent(),
      this.skin.geometry.dispose(),
      this.rigid.forEach((e) => e.dispose()),
      this.materials.forEach((e) => e.dispose()),
      this.draws.forEach((e) => e.outline.dispose()));
  }
}

const $L = [
    { motion: 0, min: 2, max: 5, restore: !1, carry: !1 },
    { motion: 1, min: 2, max: 5, restore: !0, carry: !1 },
    { motion: 21, min: 2, max: 5, restore: !0, carry: !1 },
    { motion: 20, min: 10, max: 60, restore: !0, carry: !0 },
    { motion: 8, min: 1, max: 4, restore: !1, carry: !1 },
    { motion: 6, min: 2, max: 5, restore: !0, carry: !1 },
    { motion: 5, min: 2, max: 5, restore: !0, carry: !1 },
    { motion: 7, min: 2, max: 5, restore: !0, carry: !1 },
  ],
  or0 = $L.map((n) => n.motion);

function ar0(n) {
  return Math.max(0, Math.ceil((n % 80) / 10) - 1);
}

class cr0 {
  constructor(e, t, i) {
    ((this.clips = e), (this.animation = t), (this.random = i));
  }
  clips;
  animation;
  random;
  next = 0;
  remaining = 0;
  reset() {
    this.next = this.remaining = 0;
  }
  update(e) {
    if (e < this.remaining) {
      this.remaining -= e;
      return;
    }
    const t = $L[this.next];
    this.next = ar0(this.random.next());
    const i = this.clips.get(t.motion);
    if (!i) throw new Error("飞宠闲置动作未预载。");
    (this.animation.bind(i, 300, t.restore, 300, t.carry ? this.remaining : 0),
      (this.remaining =
        Math.imul(
          (this.random.next() % (t.max - t.min)) + t.min,
          i.header[2],
        ) >>> 0));
  }
}

const n9 = Math.fround,
  lr0 = () => [n9(0.59), -0.75, 0.5],
  WL = (n, e) => n.map((t, i) => n9(t - e[i])),
  Fg = (n, e) => n9(n9(n9(n[0] * e[0]) + n9(n[1] * e[1])) + n9(n[2] * e[2]));

function ur0(n, e, t, i) {
  const r = Math.min(n9(0.05), n9(n9(i >>> 0) * n9(0.001))),
    s = WL(n, t),
    o = n9(Math.sqrt(Fg(s, s)));
  if (o === 0) return !1;
  const a = n9(350 * o),
    c = n9(n9(Fg(e, s) * 2) / o);
  for (let l = 0; l < 3; l++) {
    const u = n9(n9(-n9(a + c) * s[l]) / o),
      h = n9(u - n9(e[l] * 11));
    ((e[l] = n9(e[l] + n9(h * r))), (n[l] = n9(n[l] + n9(e[l] * r))));
  }
  return !0;
}

class hr0 {
  local = lr0();
  secondLocal = [0.75, 0.75, 0.5];
  position = [0, 0, 0];
  velocity = [0, 0, 0];
  previous = 0;
  remaining = 0;
  following = !1;
  launched = !1;
  firstVisible = !0;
  secondVisible = !1;
  firedVisible = !1;
  aliveVisible = !1;
  firedStart = 0;
  aliveStart = 0;
  counter = 0;
  aliveDue = 0;
  showDue = 0;
  clearDue = 0;
  launch() {
    this.launched ||
      ((this.launched = !0),
      (this.remaining = 400),
      (this.firstVisible = !1),
      (this.secondLocal = [...this.local]),
      this.disable());
  }
  disable() {
    this.launched &&
      (this.counter++,
      (this.secondVisible = this.aliveVisible = !1),
      (this.firedVisible = !0),
      (this.firedStart = this.previous));
  }
  enable() {
    this.launched &&
      (this.counter > 0 && this.counter--,
      (this.aliveDue = (Math.imul(this.counter, 700) + this.previous) >>> 0));
  }
  update(e, t, i, r) {
    ((e >>>= 0), this.previous || (this.previous = e));
    const s = (e - this.previous) >>> 0;
    if (
      (this.remaining
        ? s < this.remaining
          ? (this.remaining -= s)
          : ((this.remaining = 0),
            (this.local[1] = n9(this.local[1] + 1.5)),
            (this.position = [n9(t[12]), n9(t[13] + 1.5), n9(t[14])]),
            this.enable(),
            (this.following = !0))
        : r(s),
      this.following)
    ) {
      if (!(this.previous < e)) return !1;
      const a = [n9(t[12]), n9(t[13] + 1.5), n9(t[14])];
      if (!ur0(this.position, this.velocity, a, s)) return !1;
      const c = WL(this.position, a);
      this.secondLocal = [0, 1, 2].map((l) => {
        const u = i[l];
        if (!Number.isFinite(u) || u === 0)
          throw new Error("飞宠祖父缩放无效。");
        const h = [0, 1, 2].map((d) => n9(n9(t[l * 4 + d]) * n9(1 / u)));
        return n9(Fg(h, c) + this.local[l]);
      });
    }
    let o = !1;
    return (
      this.aliveDue &&
        (e - this.aliveDue) >>> 0 > 500 &&
        ((this.aliveDue = 0),
        (this.firedVisible = !1),
        (this.aliveVisible = !0),
        (this.aliveStart = e),
        (this.showDue = this.clearDue = e),
        (o = !0)),
      this.showDue &&
        (e - this.showDue) >>> 0 > 166 &&
        ((this.secondVisible = !0), (this.showDue = 0)),
      this.clearDue &&
        (e - this.clearDue) >>> 0 > 766 &&
        ((this.clearDue = this.counter = 0),
        (this.aliveVisible = this.firedVisible = !1)),
      (this.previous = e),
      o
    );
  }
}

function dr0(n, e) {
  return n === "local" && e;
}

async function $d(n, e, t, i) {
  const r = (s) => {
    const o = n.get(`${DI}/${s}`);
    if (!o) throw new Error(`飞宠公共效果缺少 ${s}。`);
    return o;
  };
  return W1(
    y9(await r(`${e}.1s`).bytes()),
    n,
    `flyingPet:${e}`,
    (s) => ({ status: "found", entry: r(`${s.name}.png`) }),
    {
      environment: t,
      stageBinding: i,
      advanceEnvironment: !1,
      convertClientCoordinates: !1,
    },
  );
}

class Tv {
  constructor(e, t) {
    ((this.context = e), (this.alive = t));
  }
  context;
  alive;
  active = new Set();
  disposed = !1;
  static async load(e, t) {
    const i = t && e.sound("펫머리얹기"),
      r = i && (await i.bytes()),
      s = r && (await Q9(t, r));
    return new Tv(t, s || void 0);
  }
  playAlive() {
    if (this.disposed || !this.context || !this.alive) return;
    const e = this.context.createBufferSource();
    ((e.buffer = this.alive),
      S9(this.context, e, "fx"),
      this.active.add(e),
      e.addEventListener(
        "ended",
        () => {
          (e.disconnect(), this.active.delete(e));
        },
        { once: !0 },
      ),
      e.start());
  }
  dispose() {
    ((this.disposed = !0),
      this.active.forEach((e) => {
        (e.stop(), e.disconnect());
      }),
      this.active.clear());
  }
}



class S4 extends FlyingPetPresentation {
  constructor(race) { super(race, flyingPetPresentationDependencies); }
  static async preview(options, atOrigin = false) {
    return new S4().loadPreview(options, atOrigin);
  }
  static async race(options) {
    if (options.role !== "local") return;
    return new S4(options).loadRace(options);
  }
}

class _v {
  constructor(e, t, i) {
    if (((this.scene = e), (this.textures = t), i)) {
      const r = new Set();
      e.object.traverse((s) => {
        if (s instanceof D2) {
          for (const a of Array.isArray(s.material) ? s.material : [s.material])
            r.add(a);
          const o = s.onBeforeRender;
          s.onBeforeRender = (...a) => {
            (o.call(s, ...a), this.applyLocalFade());
          };
        }
      });
      for (const s of r) {
        if (s instanceof $1) {
          if (!s.fragmentShader.includes("#include <fog_fragment>"))
            throw new Error("跑者旗帜 shader 缺少透明度应用位置。");
          ((s.fragmentShader = s.fragmentShader.replace(
            "#include <fog_fragment>",
            `gl_FragColor.a *= 0.3;
#include <fog_fragment>`,
          )),
            (s.needsUpdate = !0));
        } else s.opacity *= 0.3;
        this.fadedMaterials.push(s);
      }
      this.applyLocalFade();
    }
  }
  scene;
  textures;
  disposed = !1;
  fadedMaterials = [];
  applyLocalFade() {
    for (const e of this.fadedMaterials)
      ((e.transparent = !0), (e.blending = X5), (e.depthWrite = !1));
  }
  static async load(e, t, i, r = !1) {
    const s = "item/roadBlockFlag/runner_flag.1s",
      o = e.canonicalCandidates(s);
    if (o.length !== 1) throw new Error("挡人跑者旗帜资源未唯一命中。");
    const a = new Map();
    let c;
    try {
      const l = await W1(
        y9(await o[0].bytes()),
        e,
        "WebRoadBlockRunnerFlag",
        (u) => {
          const h = sn(e, s, void 0, u);
          return h.status === "found" ? { status: "found", entry: h.entry } : h;
        },
        { ...i, advanceEnvironment: !1, textureCache: a },
      );
      return (
        (c = l),
        t.add(l.object),
        l.reset(performance.now()),
        new _v(l, a, r)
      );
    } catch (l) {
      (c?.object.removeFromParent(), c?.dispose());
      for (const u of a.values()) u.dispose();
      throw l;
    }
  }
  update(e, t, i, r) {
    this.disposed || (this.scene.update(e, t, i, r), this.applyLocalFade());
  }
  dispose() {
    if (!this.disposed) {
      ((this.disposed = !0),
        this.scene.object.removeFromParent(),
        this.scene.dispose());
      for (const e of this.textures.values()) e.dispose();
      this.textures.clear();
    }
  }
}

const J0 = Math.fround,
  Dg = (n) => ({ x: J0(n.x), y: J0(-n.z), z: J0(n.y) }),
  It = (n) => ({ x: n.x, y: n.z, z: J0(-n.y) }),
  Gv = (n) => ({ x: J0(-n.x), y: J0(-n.y), z: J0(-n.z) });

function yE(n, e) {
  return {
    x: J0(J0(n.y * e.z) - J0(n.z * e.y)),
    y: J0(J0(n.z * e.x) - J0(n.x * e.z)),
    z: J0(J0(n.x * e.y) - J0(n.y * e.x)),
  };
}

function AE(n) {
  const e = J0(
    Math.sqrt(J0(J0(J0(n.x * n.x) + J0(n.y * n.y)) + J0(n.z * n.z))),
  );
  if (!Number.isFinite(e) || e === 0) throw new Error("挡人结算基准无效。");
  return { x: J0(n.x / e), y: J0(n.y / e), z: J0(n.z / e) };
}

function er(n, e) {
  return { x: n[0][e], y: n[1][e], z: n[2][e] };
}

function HL(n, e) {
  const t = (i) => J0(J0(J0(i.x * e.x) + J0(i.y * e.y)) + J0(i.z * e.z));
  return { x: t(n[0]), y: t(n[1]), z: t(n[2]) };
}

function qL(n, e) {
  const t = J0(Math.cos(e)),
    i = J0(Math.sin(e));
  return n.map((r) => ({
    x: J0(J0(J0(r.x * t) + J0(r.y * i)) + J0(r.z * 0)),
    y: J0(J0(J0(r.x * -i) + J0(r.y * t)) + J0(r.z * 0)),
    z: J0(J0(J0(r.x * 0) + J0(r.y * 0)) + J0(r.z * 1)),
  }));
}

function fr0(n, e) {
  const t = e ? Dg(n.forward) : Gv(Dg(n.forward)),
    i = AE(yE(t, { x: 0, y: 0, z: 1 })),
    r = AE(yE(i, t));
  return [
    { x: i.x, y: t.x, z: r.x },
    { x: i.y, y: t.y, z: r.y },
    { x: i.z, y: t.z, z: r.z },
  ];
}

function pr0(n, e) {
  const t = It(HL(n, { x: 3, y: -6, z: 0 })),
    i = qL(n, J0(-0.9));
  return {
    x: J0(e.x + t.x),
    y: J0(e.y + t.y),
    z: J0(-J0(J0(-e.z) + J0(-t.z))),
    right: It(er(i, "x")),
    up: It(er(i, "z")),
    forward: It(Gv(er(i, "y"))),
    visualScale: { x: 1, y: 1, z: 1 },
  };
}

function gr0(n, e, t) {
  const i = HL(n, { x: 0, y: -5, z: J0(1.7) }),
    r = Dg(e),
    s = { x: J0(r.x + i.x), y: J0(r.y + i.y), z: J0(J0(r.z + i.z) + 1) },
    o = qL(n, Math.fround(3.141592025756836)),
    a = er(o, "y"),
    c = Gv(a),
    l = {
      x: J0(s.x - J0(c.x * t)),
      y: J0(s.y - J0(c.y * t)),
      z: J0(s.z - J0(c.z * t)),
    };
  return {
    position: It(l),
    basis: [It(er(o, "x")), It(a), It(er(o, "z"))],
    horizontalFovDegrees: J0(z6(0).base + J0(-17.046377182006836)),
    near: 1.5,
    far: 500,
  };
}

function mr0(n) {
  const e = new Set(),
    t = (i) => {
      ((i.name === "개인시상대" || i.name === "그림자") &&
        ((i.nodeEnabled = 0), e.add(i.name)),
        i.children.forEach(t));
    };
  if ((t(n), e.size !== 2)) throw new Error("挡人结算缺少原生奖台隐藏节点。");
}

function wr0() {
  const n = [
    [0, 21],
    [500, 14],
    [2e3, 11],
  ].map(([e, t]) => {
    const i = new Uint8Array(8),
      r = new DataView(i.buffer);
    return (r.setUint32(0, e, !0), r.setFloat32(4, t, !0), i);
  });
  return on.fromParsed({
    kind: "float-controller",
    base: {
      cycleMode: 2,
      frequency: 1,
      phaseWord: 0,
      startTimeWord: 0,
      stopTimeWord: 2e3,
    },
    keys: { type: 1, records: n },
  });
}

class Bv extends RoadblockResultPresentation {
  constructor(stand, confetti, reversePodium) {
    super(stand, confetti, reversePodium, roadblockResultPresentationDependencies);
  }
  static async load(library, raceAssets) {
    const parts = await loadRoadblockResultParts(
      library, raceAssets, roadblockResultPresentationDependencies);
    return new Bv(parts.stand, parts.confetti, parts.reversePodium);
  }
}

class vr0 {
  deadline;
  count = 0;
  update(e, t) {
    return t === void 0 ||
      (this.deadline === void 0 && (this.deadline = t),
      e >= this.deadline ||
        this.count >= 10 ||
        e < this.deadline - 1e4 + this.count * 1e3)
      ? !1
      : (this.count++, !0);
  }
}

const Rv = 0.09375;

class yr0 {
  element = document.createElement("div");
  topBar = document.createElement("div");
  bottomBar = document.createElement("div");
  ratio = 0;
  viewportHeight = 0;
  disposed = !1;
  constructor(e) {
    (Object.assign(this.element.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      overflow: "hidden",
    }),
      (this.element.dataset.uiLayer = "stage"),
      (this.element.dataset.warpBlackBar = "container"),
      this.element.setAttribute("aria-hidden", "true"));
    for (const t of [this.topBar, this.bottomBar])
      (Object.assign(t.style, {
        position: "absolute",
        left: "0",
        width: "100%",
        height: "0px",
        background: "#000000",
      }),
        (t.textContent = ""),
        this.element.append(t));
    ((this.topBar.style.top = "0"),
      (this.bottomBar.style.bottom = "0"),
      (this.topBar.dataset.warpBlackBar = "top"),
      (this.bottomBar.dataset.warpBlackBar = "bottom"),
      e.root.append(this.element));
  }
  isAttached() {
    return this.element.isConnected;
  }
  setViewportHeight(e) {
    if (this.disposed) return;
    const t = Number.isFinite(e) ? Math.max(0, Math.trunc(e)) : 0;
    t !== this.viewportHeight &&
      ((this.viewportHeight = t), this.applyBarHeights());
  }
  setRatio(e) {
    if (this.disposed) return;
    const t = Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0;
    t !== this.ratio && ((this.ratio = t), this.applyBarHeights());
  }
  applyBarHeights() {
    const e = Math.floor(this.viewportHeight * Rv + 0.5),
      i = `${Math.floor(e * this.ratio + 0.5)}px`;
    (this.topBar.style.height !== i && (this.topBar.style.height = i),
      this.bottomBar.style.height !== i && (this.bottomBar.style.height = i));
  }
  dispose() {
    this.disposed || ((this.disposed = !0), this.element.remove());
  }
}

function Ar0() {
  return { hidden: !1 };
}

function br0(n, e) {
  const t = Math.floor(n * Rv + 0.5);
  return Math.floor(t * Math.min(1, Math.max(0, e / 375)) + 0.5);
}

class bE {
  scene = new D1();
  camera = new Fm(0, 1, 1, 0, -1, 1);
  geometry = new Ar(1, 1);
  material = new d3({ color: 0, depthTest: !1, depthWrite: !1 });
  bars = [
    new D2(this.geometry, this.material),
    new D2(this.geometry, this.material),
  ];
  startedAt;
  constructor() {
    this.scene.add(...this.bars);
  }
  start(e) {
    this.startedAt ??= e;
  }
  render(e, t, i) {
    if (this.startedAt === void 0 || i <= 0) return;
    const r = br0(i, t - this.startedAt) / i;
    this.renderRatio(e, r);
  }
  renderRatio(e, t) {
    t &&
      (this.bars.forEach((i, r) => {
        (i.scale.set(1, t, 1),
          i.position.set(0.5, r === 0 ? t / 2 : 1 - t / 2, 0));
      }),
      e.render(this.scene, this.camera));
  }
  dispose() {
    ((this.startedAt = void 0),
      this.scene.clear(),
      this.geometry.dispose(),
      this.material.dispose());
  }
}

function Mr0(n, e, t, i, r, s, o = !0) {
  const a = e.physics,
    c = a.driveCameraRuntime(),
    l = a.displaySpeedKmh();
  (n.zetAirEffect.update(r, l, a.body.linearVelocity, i, t.root.visible),
    n.exhaustEffect.update(
      r,
      l,
      a.body.linearVelocity,
      i,
      t.root.visible &&
        Tk(
          a.audioState(),
          a.dualBoosterState(),
          a.dualBoosterMode(),
          c.action8,
        ),
    ),
    n.shockWaveEffect.update(
      r,
      a.consumeShockWaveRequest(),
      t.root.matrixWorld,
      i,
      H2,
      $2,
    ),
    n.crashEffect.update(
      r,
      a.consumeCrashEffectRequest(),
      t.root.matrixWorld,
      i,
      H2,
      $2,
    ));
  const u = a.timeAttackTachometerCharger();
  (n.chargerEffect.update(r, u.active, u.durationMs, i, H2, $2),
    n.simpleShadow.update(
      e.track,
      t.root.visible && o && c.motionMode !== 2 && c.motionMode !== 3,
    ),
    n.driftEffects.update(r, a.driftVisualRuntime(), e.track, t.root.visible),
    n.effects.setState(
      a.audioState(),
      a.dualBoosterMode(),
      a.dualBoosterTeam(),
      c.action8,
      r,
    ) && ((s = t.enterDualUse()), s !== void 0 && a.setAnimationSlot(s)),
    n.effects.update(r, i, H2, $2),
    n.trails.setState(a.audioState(), r),
    n.trails.update(r, i, n.imported.renderScene !== void 0));
  const h = n.audio;
  (h.update(r, Math.hypot(a.state.vx, a.state.vy, a.state.vz)),
    h.playCollision(a.consumeCollisionAudioStrength(), r),
    h.playSteeringCollision(a.consumeSteeringCollisionAudioGain()),
    h.playLandingShock(c.landingMotionTrigger, c.landingShockAudioStrength),
    h.setState(a.audioState(), a.dualBoosterState()),
    h.setChargerActive(u.active),
    h.setExceedActive(c.action8),
    h.setTransformingState(s),
    h.setDriftActive(a.state.drifting));
}

function xr0(n, e, t, i, r, s, o, a) {
  (n.effects.setState(r.physicsState, r.dualMode, r.dualTeam, s, i) &&
    e.enterDualUse(),
    n.effects.update(i, t, o, a),
    n.chargerEffect.update(
      i,
      r.chargerActive,
      Math.max(
        1,
        Math.trunc(Math.fround(n.physicsParams.chargerSystemUseTime)),
      ),
      t,
      o,
      a,
    ));
}

function lc(n) {
  return [
    n.trails.object,
    n.driftEffects.object,
    n.zetAirEffect.object,
    n.shockWaveEffect.object,
    n.exhaustEffect.object,
    n.crashEffect.object,
    n.simpleShadow.object,
  ];
}

const ME = Iv(1072245229),
  xE = Iv(1082846802),
  SE = Iv(1114594461),
  Sr0 = { x: 0, y: 1, z: 0 };

class KL {
  phase = 0;
  anchorMs = 0;
  raceFov = SE;
  fov = SE;
  configureP3528ResolutionMode(e = 0) {
    this.raceFov = z6(e).base;
  }
  reset() {
    ((this.phase = 0), (this.anchorMs = 0), (this.fov = this.raceFov));
  }
  update(e, t, i = 1) {
    const r = Math.trunc(e) >>> 0,
      s = this.phase === 0;
    (s && (this.anchorMs = r), this.anchorMs === 0 && (this.anchorMs = r));
    const o = r >= this.anchorMs ? (r - this.anchorMs) >>> 0 : 0,
      a = o % 6e3,
      c = o % 5e3,
      l = a <= 3e3 ? uc(ME, xE, hc(a, 3e3)) : uc(xE, ME, hc(a - 3e3, 3e3)),
      u =
        c <= 2500
          ? uc(l9(0.5), l9(0.25), hc(c, 2500))
          : uc(l9(0.25), l9(0.5), hc(c - 2500, 2500)),
      h = [TE(t.right), F5(t.forward, l9(-1)), TE(t.up)],
      d = CE(CE(h, Cr0(l)), Er0(u)),
      f = F5(d[1], l9(-1));
    let p = l9(i);
    p >= 1 && (p = js(jL(Xs(p, 1), 10), 1));
    let v = F5(f, 2);
    ((v = F5(v, 8)), (v = F5(v, p)));
    let w = g6(t.position, Sr0);
    return (
      (w = EE(w, v)),
      s ? ((this.fov = this.raceFov), (this.phase = 1)) : (w = g6(w, F5(f, 8))),
      {
        position: w,
        basis: d,
        horizontalFovDegrees: this.fov,
        near: 1.5,
        far: 500,
      }
    );
  }
  apply(e, t) {
    ((e.matrixAutoUpdate = !0),
      e.position.set(t.position.x, t.position.y, t.position.z),
      e.up.set(t.basis[2].x, t.basis[2].y, t.basis[2].z));
    const i = EE(t.position, t.basis[1]);
    (e.lookAt(i.x, i.y, i.z),
      (e.fov = we(t.horizontalFovDegrees, e.aspect)),
      (e.near = t.near),
      (e.far = t.far),
      e.updateProjectionMatrix());
  }
}

function Cr0(n) {
  const e = l9(Math.cos(l9(n))),
    t = l9(Math.sin(l9(n)));
  return [
    { x: e, y: t, z: 0 },
    { x: l9(-t), y: e, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];
}

function Er0(n) {
  const e = l9(Math.cos(l9(n))),
    t = l9(Math.sin(l9(n)));
  return [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: e, z: t },
    { x: 0, y: l9(-t), z: e },
  ];
}

function CE(n, e) {
  const t = (i) => g6(g6(F5(n[0], i.x), F5(n[1], i.y)), F5(n[2], i.z));
  return [t(e[0]), t(e[1]), t(e[2])];
}

function uc(n, e, t) {
  return js(l9(Xs(1, t) * n), l9(e * t));
}

function hc(n, e) {
  return jL(l9(n >>> 0), l9(e >>> 0));
}

function g6(n, e) {
  return { x: js(n.x, e.x), y: js(n.y, e.y), z: js(n.z, e.z) };
}

function EE(n, e) {
  return { x: Xs(n.x, e.x), y: Xs(n.y, e.y), z: Xs(n.z, e.z) };
}

function F5(n, e) {
  return { x: l9(n.x * e), y: l9(n.y * e), z: l9(n.z * e) };
}

function js(n, e) {
  return l9(l9(n) + l9(e));
}

function Xs(n, e) {
  return l9(l9(n) - l9(e));
}

function jL(n, e) {
  return l9(l9(n) / l9(e));
}

function TE(n) {
  return { x: n.x, y: n.y, z: n.z };
}

function l9(n) {
  return Math.fround(n);
}

function Iv(n) {
  const e = new ArrayBuffer(4),
    t = new DataView(e);
  return (t.setUint32(0, n, !0), t.getFloat32(0, !0));
}

function XL(n) {
  return n
    .map((e, t) => ({ participant: e, index: t }))
    .sort((e, t) => {
      const i = t.participant.lap - e.participant.lap;
      if (i !== 0) return i;
      const r = t.participant.progress - e.participant.progress;
      return r !== 0 ? r : e.index - t.index;
    })
    .map(({ participant: e }, t) => ({ ...e, rank: t + 1 }));
}

function YL(n, e) {
  return e === void 0 ? n : `${n}（${Math.trunc(e)}ms）`;
}

function ZL(n, e, t) {
  if (t === e) return 0;
  const i = n
    .filter((r) => r.playerId !== e)
    .findIndex((r) => r.playerId === t);
  if (i < 0)
    throw new Error("Rank participant is absent from the frozen race roster.");
  return i + 1;
}

class Tr0 {
  constructor(e, t) {
    ((this.roster = e), (this.localId = t));
  }
  roster;
  localId;
  samples = new Map();
  departed = new Set();
  capture(e) {
    for (const t of this.roster) {
      if (this.departed.has(t.playerId)) continue;
      const i = e(t.playerId);
      i && this.samples.set(t.playerId, { ...i });
    }
  }
  updatePresent(e) {
    for (const t of this.roster)
      t.playerId !== this.localId &&
        !e.has(t.playerId) &&
        this.departed.add(t.playerId);
  }
  progress(e) {
    return this.samples.get(e);
  }
  out(e) {
    return this.departed.has(e);
  }
  dispose() {
    (this.samples.clear(), this.departed.clear());
  }
}

function _r0(n, e, t, i, r = [], s) {
  const o = n.map((h) => {
    const d = t(h.playerId),
      f = r.find((p) => p.playerId === h.playerId);
    return {
      member: h,
      progress: f
        ? {
            distance: d?.distance ?? 0,
            lap: d?.lap ?? 0,
            finishElapsedMs: f.elapsedMs,
          }
        : d,
    };
  });
  if (!o.length || o.some((h) => !h.progress)) return;
  const a = o
      .filter((h) => h.progress.finishElapsedMs !== void 0)
      .sort((h, d) => h.progress.finishElapsedMs - d.progress.finishElapsedMs),
    c = XL(
      o
        .filter((h) => h.progress.finishElapsedMs === void 0)
        .map((h) => ({
          id: h.member.playerId,
          name: h.member.name,
          lap: 0,
          progress: h.progress.distance,
        })),
    ),
    l = [...a.map((h) => h.member.playerId), ...c.map((h) => h.id)],
    u = l.indexOf(e) + 1;
  if (u)
    return {
      rank: u,
      riderCount: l.length,
      rows: l.map((h, d) => ({
        participantId: h,
        slot: ZL(n, e, h),
        rank: d + 1,
        local: h === e,
        name: YL(n.find((f) => f.playerId === h).name, s?.(h)),
        color: i.get(h),
        finished: a.some((f) => f.member.playerId === h),
      })),
    };
}

function Gr0(n, e, t, i) {
  return {
    rank: n.findIndex((r) => r.playerId === e) + 1,
    riderCount: n.length,
    rows: n.map((r, s) => ({
      participantId: r.playerId,
      slot: ZL(n, e, r.playerId),
      rank: s + 1,
      local: r.playerId === e,
      name: YL(r.name, i?.(r.playerId)),
      color: t.get(r.playerId),
    })),
  };
}

function Br0(n, e) {
  const t = n.rows.map((i) => {
    const r = e.find((s) => s.playerId === i.participantId);
    return r ? { ...i, rank: r.rank, finished: r.elapsedMs !== null } : i;
  });
  return { ...n, rank: t.find((i) => i.local).rank, rows: t };
}

class Rr0 {
  localPending = !1;
  played = new Set();
  acceptLocalFinish(e) {
    this.localPending = !0;
  }
  consume(e, t, i, r) {
    if (r || this.played.has(e)) return 0;
    if (e === t) {
      if (!this.localPending) return 0;
      this.localPending = !1;
    } else if (!i.some((s) => s.playerId === e)) return 0;
    return (this.played.add(e), 12);
  }
}

function QL(n, e, t, i, r, s, o, a, c = !1) {
  n instanceof fv
    ? n.update(
        e.displaySpeedKmh(),
        e.timeAttackTachometerAnimationState(),
        t,
        r,
        H2,
        $2,
        o,
        a,
      )
    : n instanceof p7
      ? n.update(e, i, r, H2, $2, o, c)
      : n instanceof Ta || n instanceof Gr
        ? n.update(e, i, r, s, H2, $2, o, c)
        : n.update(e.displaySpeedKmh(), H2, $2, o);
}

function JL(n, e) {
  n instanceof Fk ? n.render(e) : n.render(e, H2, $2);
}

function eP(n) {
  (n instanceof Gr || n instanceof Ta) && n.startMainGaugeDrain();
}

class tP {
  enabled = !1;
  anchorMs = 0;
  visible = !1;
  configure(e) {
    ((this.enabled = e === "ht" || e === "디셉티콘" || e === "오토봇"),
      this.reset());
  }
  reset() {
    ((this.anchorMs = 0), (this.visible = !1));
  }
  update(e, t) {
    if (!this.enabled) return;
    const i = Math.trunc(e) >>> 0;
    return (this.trigger(i, t), this.expire(i), this.visible);
  }
  expire(e) {
    this.anchorMs === 0 ||
      (e - this.anchorMs) >>> 0 <= 500 ||
      ((this.anchorMs = 0), (this.visible = !1));
  }
  trigger(e, t) {
    !t || this.anchorMs !== 0 || ((this.anchorMs = e), (this.visible = !0));
  }
}

class nP {
  constructor(e, t = { value: 0 }) {
    ((this.random = e), (this.effectAnchor = t));
  }
  random;
  effectAnchor;
  activeCount = 0;
  durationAnchorMs = 0;
  x = 0;
  y = 0;
  z = 0;
  giantDenominator;
  enter() {
    (this.activeCount++, (this.effectAnchor.value = 0));
  }
  leave(e = !1) {
    (this.activeCount > 0 && this.activeCount--,
      (e || this.activeCount === 0) &&
        ((this.activeCount = 0), (this.effectAnchor.value = 0)));
  }
  setGiantGate(e) {
    const t = typeof e == "number",
      i = typeof this.giantDenominator == "number";
    (t !== i && (this.effectAnchor.value = 0), (this.giantDenominator = e));
  }
  update(e, t = "") {
    if (
      this.giantDenominator === !1 ||
      (this.giantDenominator === void 0 && this.activeCount === 0)
    )
      return { x: 0, y: 0, z: 0 };
    const i = Math.trunc(e) >>> 0,
      r = /^shake(\d+),(\d+)$/.exec(t),
      s = Math.fround(
        r
          ? Math.fround(Number(r[1]) * Math.fround(-90)) + Math.fround(1e4)
          : typeof this.giantDenominator == "number"
            ? this.giantDenominator
            : 800,
      ),
      o = Math.fround(r ? Number(r[2]) : 2100);
    (this.effectAnchor.value === 0 && (this.effectAnchor.value = i),
      (i - this.effectAnchor.value) >>> 0 > 10 &&
        this.effectAnchor.value !== 0 &&
        ((this.effectAnchor.value = 0),
        (this.x = (this.random.next() % 1e3) - 500),
        (this.y = (this.random.next() % 1e3) - 500),
        (this.z = (this.random.next() % 1e3) - 500)));
    let a = (i - this.durationAnchorMs) >>> 0;
    if (
      (o > 0 &&
        (this.durationAnchorMs === 0 || Math.fround(a) > o) &&
        ((this.durationAnchorMs = i), (a = 0)),
      typeof this.giantDenominator == "number")
    ) {
      const d = o > 0 ? (o - a) / o : 1,
        f = Math.fround((this.x / s) * d),
        p = Math.fround((this.y / s) * d),
        v = Math.fround((this.z / s) * d);
      return { x: f, y: v, z: p === 0 ? 0 : Math.fround(-p) };
    }
    const c =
        o > 0
          ? Math.fround(Math.fround(o - Math.fround(a)) / o)
          : Math.fround(1),
      l = Math.fround(Math.fround(Math.fround(this.x) / s) * c),
      u = Math.fround(Math.fround(Math.fround(this.y) / s) * c),
      h = Math.fround(Math.fround(Math.fround(this.z) / s) * c);
    return { x: l, y: h, z: u === 0 ? 0 : Math.fround(-u) };
  }
}

const Y9 = Math.fround;

class iP {
  constructor(e = { value: 0 }) {
    this.effectAnchor = e;
  }
  effectAnchor;
  enabled = !1;
  enter() {
    ((this.enabled = !0), (this.effectAnchor.value = 0));
  }
  leave() {
    ((this.enabled = !1), (this.effectAnchor.value = 0));
  }
  update(e, t, i, r = { x: 0, y: 0, z: 0 }) {
    if (!this.enabled) return r;
    const s = /^wave(\d+),(\d+),(\d+),(\d+)\s*$/.exec(t),
      o = s ? Number(s[1]) >>> 0 : 0,
      a = Y9(s ? Y9(Number(s[2]) / Y9(1e3)) * Y9(3) : 0.13),
      c = Y9(s ? Number(s[3]) : 8),
      l = s ? Y9(Number(s[4])) : 0,
      u = Math.trunc(e) >>> 0;
    this.effectAnchor.value === 0 && (this.effectAnchor.value = u);
    const h = (u - this.effectAnchor.value) >>> 0;
    if (l !== 0 && l <= Y9(h)) return ((this.effectAnchor.value = 0), r);
    const d = Y9(Y9(Y9(Y9(6.2831802) * Y9(h)) / Y9(1e3)) * c),
      f = Y9(Ro(d)),
      p = l === 0 ? void 0 : Y9(l - Y9(h));
    return (
      o <= 1 && Wd(r, i.right, f, a, p, l),
      (o === 0 || o === 2) && Wd(r, i.up, f, a, p, l),
      o === 0 && Wd(r, i.forward, Y9(-f), a, p, l),
      r
    );
  }
}

function Wd(n, e, t, i, r, s) {
  for (const o of ["x", "y", "z"]) {
    let a = Y9(Y9(e[o] * t) * i);
    (r !== void 0 && (a = Y9(Y9(a * r) / s)), (n[o] = Y9(n[o] + a)));
  }
}

class rP {
  constructor(e = Math.trunc(Date.now() / 1e3) >>> 0) {
    this.state = e;
  }
  state;
  next() {
    return (
      (this.state = (Math.imul(214013, this.state) + 2531011) >>> 0),
      (this.state >>> 16) & 32767
    );
  }
}

class sP {
  constructor(e = new rP()) {
    this.random = e;
  }
  random;
  active = !1;
  mode = 0;
  transitioning = !1;
  pulseCount = 0;
  completedPulses = 0;
  rate = 0;
  current = 0;
  target = 0;
  trigger() {
    this.active = !0;
  }
  update() {
    if (!this.active) return 1;
    if (this.transitioning)
      ((this.current = Math.fround(
        Math.fround(Math.fround(this.target - this.current) * this.rate) +
          this.current,
      )),
        this.current < 0.5 && (this.mode = 1),
        (this.current <= 0.2 || this.current >= 1) &&
          ((this.transitioning = !1),
          this.pulseCount >= this.completedPulses
            ? (this.completedPulses += 1)
            : ((this.active = !1),
              (this.pulseCount = 0),
              (this.completedPulses = 0))));
    else if (this.random.next() % 100 >= 5) this.mode = 0;
    else {
      ((this.mode = 1),
        (this.transitioning = !0),
        (this.target = this.current <= 0 ? 0 : 1),
        (this.current = 1),
        this.pulseCount === 0 &&
          ((this.pulseCount = (this.random.next() % 4) + 2),
          (this.completedPulses = 0)));
      const e = this.random.next() % 100;
      ((this.rate =
        this.target > 0
          ? Math.fround(0.01)
          : Math.fround(
              Math.fround(Math.fround(0.01) * e) + Math.fround(0.003),
            )),
        e === 0 && (this.rate = Math.fround(0.01)));
    }
    return this.active ? (this.mode === 0 ? 1 : this.mode === 1 ? 2 : 4) : 1;
  }
}

class Vg extends KartPresentationView { constructor(scene) { super(scene, kartPresentationDependencies); } }

const _E = 1,
  Ir0 = 2,
  kr0 = 3,
  Lr0 = 0.5,
  Pr0 = 1,
  Fr0 = 1,
  Dr0 = 300;

let GE = !1;

function Vr0() {
  GE ||
    ((GE = !0),
    (z2.fog_pars_vertex = `
#ifdef USE_FOG

	varying float vFogDepth;
	varying float vFogRadialDistance;

#endif
`),
    (z2.fog_vertex = `
#ifdef USE_FOG

	vFogDepth = - mvPosition.z;
	vFogRadialDistance = length( mvPosition.xyz );

#endif
`),
    (z2.fog_pars_fragment = `
#ifdef USE_FOG

	uniform vec3 fogColor;
	varying float vFogDepth;
	varying float vFogRadialDistance;

	#ifdef FOG_EXP2

		uniform float fogDensity;

	#else

		uniform float fogNear;
		uniform float fogFar;

	#endif

#endif
`),
    (z2.fog_fragment = `
#ifdef USE_FOG

	#ifdef FOG_EXP2

		bool expFog = fogDensity < 0.0;
		float density = abs( fogDensity );
		float fogDist = expFog ? vFogDepth : vFogRadialDistance;
		float fogFactor = expFog
			? 1.0 - exp( - density * fogDist )
			: 1.0 - exp( - density * density * fogDist * fogDist );

	#else

		float fogFactor = clamp( ( vFogDepth - fogNear ) / ( fogFar - fogNear ), 0.0, 1.0 );

	#endif

	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );

#endif
`));
}

function kv(n, e) {
  Vr0();
  const t = e.fog,
    i = e.cameraFar ?? Dr0;
  if (t?.mode === kr0) {
    n.fog = new Pm(
      new r9(t.r / 255, t.g / 255, t.b / 255),
      (t.start ?? Lr0) * i,
      (t.end ?? Pr0) * i,
    );
    return;
  }
  if (t?.mode === Ir0 || t?.mode === _E) {
    const r = (t.density ?? Fr0) / i;
    n.fog = new Lm(
      new r9(t.r / 255, t.g / 255, t.b / 255),
      t.mode === _E ? -r : r,
    );
    return;
  }
  n.fog = null;
}

const oP = { goggle: [3, 0], headBand: [3, 3], handGearL: [4, 0] },
  Lv = "item/eventObject",
  Nr0 = [Lv, "sound_/fx/surround"];

class b7 extends TrackEventEffectPool {
  constructor(library, mount, environment, binding, audioContext) {
    super(library, mount, environment, binding, audioContext, trackEventEffectDependencies);
  }
  static async load(library, projections, mount, environment, binding, audioContext) {
    return new b7(library, mount, environment, binding, audioContext)
      .loadEvents(projections);
  }
}

















function Pv(n) {
  return (
    Number.isInteger(n.linkCharacterId) &&
    n.linkCharacterId > 0 &&
    n.alwaysLinkCharacter === !1 &&
    n.hideChar === !1 &&
    n.characterAniType === 0
  );
}

class _a {
  constructor(e, t, i, r) {
    ((this.linkedMount = t),
      (this.linkedCharacter = i),
      (this.alwaysLinked = r));
    const s = e.children.findIndex((o) => o.name === "balloon");
    if (s < 0)
      throw new Error("linked ReKart root 缺少 exact balloon stop marker。");
    if (((e.children[s].visible = !1), r))
      this.normalPrefix = e.children.slice(0, s);
    else {
      const o = e.children.slice(0, s).filter((c) => c !== t),
        a = new T2();
      ((a.name = "conditional-kart-vehicle"),
        (a.matrixAutoUpdate = !1),
        e.add(a));
      for (const c of o) a.add(c);
      this.normalPrefix = [a];
    }
    this.setMode(1);
  }
  linkedMount;
  linkedCharacter;
  alwaysLinked;
  normalPrefix;
  mode = -1;
  shadowEnabled = !0;
  previousState = 0;
  deadline = 0;
  setMode(e) {
    if (this.alwaysLinked || e === 2 || (this.mode === 2 && e < 2)) return !1;
    const t = e === 4 ? 0 : e;
    if (t === this.mode) return !1;
    this.mode = t;
    const i = this.mode === 1 || this.mode === 3;
    return (
      this.normalPrefix.forEach((r) => {
        r.visible = !i;
      }),
      (this.linkedMount.visible = !0),
      (this.linkedCharacter.visible = i),
      (this.shadowEnabled = !i),
      !0
    );
  }
  update(e, t) {
    const i = Math.trunc(t) >>> 0,
      r = this.updateState(e, i);
    return this.updateDeadline(i) ?? r;
  }
  updateSpeedRace(e, t) {
    const i = Math.trunc(t) >>> 0,
      r = this.updateState(e, i, !0);
    return this.updateDeadline(i) ?? r;
  }
  updateState(e, t, i = !1) {
    const r = i && e === 11 && this.previousState !== 0;
    if (e === this.previousState && !r) return;
    let s;
    return (
      this.previousState !== 0 &&
        ((this.deadline = 0), this.setMode(0) && (s = 18)),
      (this.previousState = e),
      (i
        ? e !== 0 && !r && ![1, 2, 13, 14, 15, 16, 18, 19].includes(e)
        : e === 3) && (this.deadline = (t + 100) >>> 0),
      s
    );
  }
  updateDeadline(e) {
    if (!(this.deadline === 0 || this.deadline >= e))
      return ((this.deadline = 0), this.setMode(1) ? 14 : void 0);
  }
  resetForRacePresentation() {
    ((this.previousState = 0), (this.deadline = 0), this.setMode(3));
  }
  simpleShadowEnabled() {
    return this.shadowEnabled;
  }
}

const M2 = Math.fround,
  dc = (n) => {
    const e = M2(
      Math.sqrt(M2(M2(M2(n.x * n.x) + M2(n.y * n.y)) + M2(n.z * n.z))),
    );
    return e === 0
      ? { x: 0, y: 0, z: 0 }
      : { x: M2(n.x / e), y: M2(n.y / e), z: M2(n.z / e) };
  },
  Hd = (n, e) => ({ x: M2(n.x - e.x), y: M2(n.y - e.y), z: M2(n.z - e.z) }),
  IE = (n, e) => M2(M2(M2(n.x * e.x) + M2(n.y * e.y)) + M2(n.z * e.z));

class qr0 {
  constructor(e) {
    ((this.texture = e),
      (e.wrapS = e.wrapT = S1),
      (e.minFilter = e.magFilter = h9),
      (e.generateMipmaps = !1),
      this.geometry.setAttribute("position", new _0(this.positions, 3)),
      this.geometry.setAttribute("uv", new _0(this.uvs, 2)),
      this.geometry.setIndex([0, 1, 2, 2, 1, 3]),
      (this.material = new Vt({
        uniforms: { image: { value: e } },
        transparent: !0,
        blending: u1,
        blendSrc: l1,
        blendDst: v1,
        blendEquation: R9,
        side: s1,
        forceSinglePass: !0,
        depthFunc: y1,
        depthWrite: !1,
        vertexShader:
          "precision highp float; uniform mat4 projectionMatrix,modelViewMatrix; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "precision highp float; uniform sampler2D image; varying vec2 vUv; void main(){gl_FragColor=texture2D(image,vUv)*vec4(1.0,1.0,1.0,128.0/255.0);}",
      })),
      (this.mesh = new D2(this.geometry, this.material)),
      (this.mesh.frustumCulled = !1),
      (this.mesh.visible = !1),
      (this.mesh.matrixAutoUpdate = !1),
      Ao(this.mesh));
  }
  texture;
  geometry = new t9();
  material;
  mesh;
  selected;
  coefficient = 0;
  angle = 0;
  positions = new Float32Array(12);
  uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
  update(e, t, i, r) {
    if (((this.mesh.visible = !1), i)) return;
    let s,
      o = 1 / 0;
    if (e.main !== 4) {
      for (const y of t)
        if (y.main === 4) {
          const b = Hd(y.position, e.position),
            A = M2(
              Math.sqrt(M2(M2(M2(b.x * b.x) + M2(b.y * b.y)) + M2(b.z * b.z))),
            );
          A >= 5 &&
            A <= 70 &&
            A < o &&
            IE({ x: -e.forward.x, y: -e.forward.y, z: -e.forward.z }, dc(b)) >
              0 &&
            ((s = y), (o = A));
        }
    }
    if (!s && !this.selected) return;
    if (
      (s &&
        s.id !== this.selected &&
        ((this.coefficient = 0), (this.angle = 0), (this.selected = s.id)),
      !s && this.coefficient <= M2(0.05))
    ) {
      this.reset();
      return;
    }
    const a = M2((o - 5) / 65),
      c = M2(392 - a * 392),
      l = s ? M2((120 + c) / 512) : 0;
    this.coefficient = M2((1 - M2(0.1)) * this.coefficient + l * M2(0.1));
    const u = r.matrixWorld.elements,
      h = { x: u[12], y: u[13], z: u[14] };
    if (s) {
      const y = dc(Hd(s.position, e.position)),
        b = dc({ x: u[8], y: u[9], z: u[10] });
      ((this.angle = M2((1 - Math.max(0, IE(b, y))) * M2(0.85))),
        M2(b.z * y.x - b.x * y.z) > 0 && (this.angle = M2(-this.angle)));
    }
    const d = dc(Hd(e.position, h)),
      f = M2(h.x + M2(d.x * M2(2.5))),
      p = M2(h.y + M2(d.y * M2(2.5))),
      v = M2(h.z + M2(d.z * M2(2.5))),
      w = { x: M2(-u[0] * 2.5), y: M2(-u[1] * 2.5), z: M2(-u[2] * 2.5) },
      g = { x: M2(u[4] * 2.5), y: M2(u[5] * 2.5), z: M2(u[6] * 2.5) };
    for (let y = 0; y < 4; y++) {
      const b = M2((y % 2 === 0 ? 1 : -1) + this.angle),
        A = y < 2 ? 1 : -1;
      ((this.positions[y * 3] = M2(w.x * b + g.x * A + f)),
        (this.positions[y * 3 + 1] = M2(w.y * b + g.y * A + p)),
        (this.positions[y * 3 + 2] = M2(w.z * b + g.z * A + v)));
    }
    ((this.uvs[5] = this.uvs[7] = this.coefficient),
      (this.geometry.attributes.position.needsUpdate = !0),
      (this.geometry.attributes.uv.needsUpdate = !0),
      (this.mesh.visible = !0));
  }
  reset() {
    ((this.selected = void 0),
      (this.coefficient = 0),
      (this.angle = 0),
      (this.mesh.visible = !1));
  }
  dispose() {
    (this.reset(),
      this.mesh.removeFromParent(),
      this.geometry.dispose(),
      this.material.dispose(),
      this.texture.dispose());
  }
}

class Fv extends GiantRaceEffects {
  constructor(library, world, options, audio, stage) {
    super(library, world, options, audio, stage, giantRaceDependencies);
  }
  static async load(library, world, actors, options, audio, stage) {
    return new Fv(library, world, options, audio, stage).loadActors(actors);
  }
}

class Kr0 {
  constructor(e, t, i) {
    ((this.local = e), (this.kart = t), (this.character = i));
  }
  local;
  kart;
  character;
  clones = [];
  transparent = !1;
  purple = !1;
  update(e, t) {
    e === 0 ? (this.purple = !1) : t === 2 && (this.purple = !0);
    for (const [s, o] of [
      [this.kart, 4284887961],
      [this.character, 2858824601],
    ])
      for (const { mesh: a } of s)
        Ab(a, {
          selector: this.purple ? 1 : 0,
          centerArgb: this.purple ? o : 4278190080,
          outerArgb: this.purple ? 6697881 : 2130706432,
        });
    const r = this.local && e === 4;
    if (
      this.transparent !== r &&
      (this.restoreMaterials(), (this.transparent = r), !!r)
    )
      try {
        for (const s of [...this.kart, ...this.character]) {
          const o = s.mesh.material;
          if (Array.isArray(o) || !(o instanceof $1))
            throw new Error("巨人模型缺少已闭合的单材质 root consumer。");
          if (!zn(o) && !s.inheritsRootAlpha) continue;
          const a = o.clone(),
            c = s.mesh.onBeforeRender,
            l = s.inheritsRootAlpha ? QG(s.mesh) : () => {},
            u = () => {
              for (const [h, d] of Object.entries(o.uniforms)) {
                const f = d.value,
                  p = a.uniforms[h];
                p &&
                  (f?.isTexture
                    ? (p.value = f)
                    : p.value?.copy && f?.clone
                      ? p.value.copy(f)
                      : (p.value = f));
              }
              (zn(a) && (a.uniforms.normalUvOffset.value.y = NL),
                s.inheritsRootAlpha &&
                  ((a.uniforms.alphaTestEnabled.value = 1),
                  (a.uniforms.alphaFunction.value = 5),
                  (a.uniforms.alphaReference.value = 0),
                  (a.transparent = !0),
                  (a.blending = u1),
                  (a.blendSrc = l1),
                  (a.blendDst = v1),
                  (a.blendEquation = R9)));
            };
          (this.clones.push({
            binding: s,
            source: o,
            clone: a,
            callback: c,
            restore: l,
          }),
            (s.mesh.material = a),
            (s.mesh.onBeforeRender = function (...h) {
              (c.apply(this, h), u());
            }),
            u());
        }
      } catch (s) {
        throw (this.restoreMaterials(), s);
      }
  }
  restoreMaterials() {
    for (const e of this.clones.splice(0).reverse())
      ((e.binding.mesh.material = e.source),
        (e.binding.mesh.onBeforeRender = e.callback),
        e.restore(),
        e.clone.dispose());
  }
  dispose() {
    (this.restoreMaterials(), (this.transparent = !1), (this.purple = !1));
    for (const { mesh: e } of [...this.kart, ...this.character]) Ab(e, void 0);
  }
}

class jr0 {
    constructor(assets, runtime, race, playerId, actionAssets, hud, random, countdown, award, resultView, bgm, banner, bannerRequest, petVisible = () => false, trackInfoCard, roadblockHud) { initializeRacePresenter(this, { assets, runtime, race, playerId, actionAssets, hud, random, countdown, award, resultView, bgm, banner, bannerRequest, petVisible, trackInfoCard, roadblockHud }, racePresenterInitializationDependencies); }
  assets;
  runtime;
  race;
  playerId;
  hud;
  random;
  countdown;
  award;
  resultView;
  bgm;
  banner;
  bannerRequest;
  petVisible;
  trackInfoCard;
  roadblockHud;
  roadblockFlag;
  giantPresentation;
  giantAppearances = new Map();
  roadblockResult;
  scene = Object.assign(new D1(), {
    matrixWorldAutoUpdate: !1,
    matrixAutoUpdate: !1,
    matrixWorldNeedsUpdate: !1,
  });
  camera = new Z9();
  drive = new Ol(zB);
  surround = new KL();
  cameraShake;
  cameraEffectAnchor = { value: 0 };
  cameraWave = new iP(this.cameraEffectAnchor);
  lightFactor;
  initialPoses = new Map();
  views = new Map();
  shadowPresentations = new Map();
  linkedPresentations = new Map();
  rankRoster;
  action2d;
  finishBlackBar = new bE();
  warpBlackBar = new bE();
  finishCountdown = new vr0();
  audioStarted = !1;
  size = new B2();
  retiredCharacterIds = new Set();
  winnerMotion = new Rr0();
  localRetirePending = !1;
  cameraMode = "ready";
  warpCameraFrozen = !1;
  warpHudHidden = !1;
  disposed = !1;
  flyingPet;
  resultVisible = !1;
  resultComplete = !1;
  gaugePreserve = new tP();
  tachometer;
  trackEventEffects;
  trackEventAudio;
  trackDummyAudio;
    async prepareFlyingPet(library, audioContext) { return prepareRacePresenterFlyingPet(this, library, audioContext, racePresenterSetupDependencies); }
    async prepareRoadBlockFlag(library) { return prepareRacePresenterRoadblockFlag(this, library, racePresenterSetupDependencies); }
    async prepareGiant(library, audioContext) { return prepareRacePresenterGiant(this, library, audioContext, racePresenterSetupDependencies); }
    clearGiant() { return clearRacePresenterGiant(this); }
    async prepareTrackEvents(library, audioContext) { return prepareRacePresenterTrackEvents(this, library, audioContext, racePresenterTrackEventDependencies); }
    async prepareRoadBlockResult(library) { return prepareRacePresenterRoadblockResult(this, library, racePresenterSetupDependencies); }
    warm(renderer, nowMs) { return warmRacePresenter(this, renderer, nowMs, racePresenterLifecycleDependencies); }
    update(renderer, nowMs, actions) { return updateRacePresenterFrame(this, renderer, nowMs, actions, racePresenterFrameDependencies); }
    awardInput(input, nowMs) { return forwardPresenterAwardInput(this, input, nowMs); }
    applyWarpCamera() { return applyPresenterWarpCamera(this); }
    applyLocalWarpActions() { return applyPresenterWarpActions(this); }
    handleRouteTag(tag) { return handlePresenterRouteTag(this, tag, racePresenterActionsDependencies); }
    showResult(nowMs) { return showRacePresenterResults(this, nowMs, racePresenterResultsDependencies); }
    startAudio() { return startPresenterAudio(this); }
    playGoAndHideTrackInfo() { return playPresenterGo(this); }
    playReset() { return playPresenterReset(this); }
    startBoostGaugeFull() { return startPresenterBoostGaugeFull(this, racePresenterActionsDependencies); }
    captureRankProgress() { return capturePresenterRankProgress(this); }
    updateRoom(room) { return updatePresenterRoom(this, room); }
    render(renderer, nowMs) { return renderRacePresenterFrame(this, renderer, nowMs, racePresenterRenderDependencies); }
    dispose() { return disposeRacePresenter(this, racePresenterLifecycleDependencies); }
    releaseShadowPresentations() { return releasePresenterShadowPresentations(this); }
}

class aP {
  enter() {}
  update(e) {}
  render() {}
  onPacket(e) {}
  exit() {}
}

const Xr0 = { KeyZ: [l2.ModeImpulsePositive], KeyX: [l2.ModeImpulseNegative] };

class Yr0 extends aP {
    constructor(runtime, scene, host, chat, notice) { super(); initializeRaceSession(this, runtime, scene, host, chat, notice); }
  runtime;
  scene;
  host;
  chat;
  notice;
  controls = new sG();
  active = !1;
  disposed = !1;
  leaving = !1;
  resultVisible = !1;
  roomPhase;
  now = 0;
    get diagnosticsView() { return raceSessionDiagnosticsView(this); }
    get touchDrivingAvailable() { return raceSessionTouchDrivingAvailable(this); }
    get touchDodgeEnabled() { return raceSessionTouchDodgeEnabled(this); }
    bindClock(clock) { return bindRaceSessionClock(this, clock); }
    updateRoom(room) { return updateRaceSessionRoom(this, room); }
    presentingResults() { return raceSessionPresentingResults(this); }
    showWaiting() { return showRaceSessionWaiting(this, () => performance.now()); }
    scheduleStart(start) { return scheduleRaceSessionStart(this, start); }
    update(frame) { return updateRaceSession(this, raceSessionUpdateDependencies); }
    render() { return renderRaceSession(this); }
    requestLeave() { return requestRaceSessionLeave(this); }
    fail(error) { return failRaceSession(this, error); }
    exit() { return exitRaceSession(this); }
    dispose() { return disposeRaceSession(this); }
}

function fc(n) {
  return n
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

function Zr0(n) {
  const e = [];
  for (const t of n.matchAll(
    /<Emotion\s+animationIndex='(\d+)'\s+soundName='([^']+)'[^>]*>([\s\S]*?)<\/Emotion>/g,
  )) {
    const i = Number(t[1]);
    if (![1, 2, 3, 4, 5, 6, 7, 20].includes(i)) continue;
    const r = [
        ...t[3].matchAll(
          /<Word\s+text='([^']+)'\s+hidden='(true|false)'\s*\/>/g,
        ),
      ],
      s = r.find((o) => o[2] === "true")?.[1];
    s &&
      e.push({
        index: i,
        marker: fc(s),
        label: fc(s).replace(/[()（）]/g, ""),
        soundName: fc(t[2]),
        words: r.map((o) => ({ text: fc(o[1]), hidden: o[2] === "true" })),
      });
  }
  return e;
}

async function cP(n) {
  const e = n.get("etc_/emotionPatterns@cn.xml");
  if (!e) throw new Error("P3553 房间表情资源缺失");
  const t = new Map(Zr0(await e.text()).map((r) => [r.index, r])),
    i = [1, 2, 3, 4, 5, 6, 7, 20].map((r) => t.get(r));
  if (i.some((r) => !r)) throw new Error("P3553 房间表情映射不完整");
  return i;
}

function Ng(n, e) {
  for (const t of e) {
    const i = t.words.find((s) => n.includes(s.text));
    if (!i) continue;
    return {
      text: (i.hidden ? n.replace(i.text, "") : n).trim(),
      action: t.index,
    };
  }
  return { text: n, action: 21 };
}









class Dv extends RaceChatOverlay {
  constructor(root, connection, status, frame, font, emotions) {
    super(root, connection, status, frame, font, emotions, raceChatDependencies);
  }
  static async load(library, root, connection, status) {
    return super.load(library, root, connection, status, raceChatDependencies);
  }
}

const es0 = "zeta_/cn/content/config.xml",
  ts0 = "inGameDispTrackInfo",
  pc = { width: 350, height: 205 },
  us0 = "speedS",
  Og = "P3553 Source Han Sans CN TrackInfoCard",
  FE = "_rvs";

function ds0(n) {
  return `track_/${n.toLowerCase().endsWith(FE) ? n.slice(0, -FE.length) : n}/xt_trackCard.png`;
}

function fs0(n, e) {
  return /_rvs$/i.test(e) ? `[反]${n}` : n;
}

function ps0(n, e) {
  return e ?? n;
}

const gs0 = `16px "${Og}"`;

function ms0(n, e, t = "") {
  return e !== ""
    ? { gameSpeed: e, gameInfo: n, teamName: t }
    : { gameSpeed: n, gameInfo: "", teamName: t };
}

function ws0(n, e) {
  const t = e.get(n.modeKey) ?? "",
    i = n.modeSuffixKey === void 0 ? void 0 : (e.get(n.modeSuffixKey) ?? ""),
    r = i === void 0 ? t : `${t} / ${i}`,
    s = e.get(`${us0}${Math.trunc(n.speed)}`) ?? "",
    o = n.team === 1 ? "redTeam" : n.team === 2 ? "blueTeam" : void 0;
  return ms0(r, s, o ? (e.get(o) ?? "") : "");
}



class M7 {
    constructor(root, title, difficulty, bgmTitles, gameLabels, assets) { initializeTrackInfoCard(this, root, title, difficulty, bgmTitles, gameLabels, assets); }
  root;
  trackTitle;
  trackDifficulty;
  bgmTitles;
  gameLabels;
  assets;
  canvas = document.createElement("canvas");
  context;
  resizeObserver;
  onWindowResize = () => this.render();
  bgmName = "";
  visible = !0;
  slidingOut = !1;
  adjustX;
  lastUpdateMs;
  disposed = !1;
    static async load(options) { return loadTrackInfoCard(options, { ...trackInfoCardLoadingDependencies, create: (...args) => new M7(...args) }); }
    setBgmName(trackId) { return setTrackCardBgm(this, trackId); }
    setVisible(visible) { return setTrackCardVisible(this, visible); }
    slideOut() { return slideTrackCardOut(this); }
    update(nowMs) { return updateTrackCard(this, nowMs); }
    dispose() { return disposeTrackCard(this, trackInfoCardRuntimeDependencies); }
    render() { return renderTrackCard(this, trackInfoCardRuntimeDependencies); }
    drawLabel(text, layout, x, y) { return drawTrackCardLabel(this, text, layout, x, y, trackInfoCardRuntimeDependencies); }
    drawClippedText(text, rect, x, y, color) { return drawTrackCardClippedText(this, text, rect, x, y, color); }
}

function ys0(n, e, t, i, r) {
  n.drawImage(e.image, 0, 0, e.width, e.height, i, r, t.width, t.height);
}

function As0(n, e, t, i, r, s) {
  n.drawImage(
    e.image,
    t + Math.floor((r - pc.width) / 2),
    i + Math.floor((s - pc.height) / 2),
    pc.width,
    pc.height,
  );
}

function bs0(n, e, t, i) {
  if (n.name !== "Window")
    throw new Error("trackDifficulty 模板根节点应为 Window。");
  (le(n, "leftTopWH", 4, "trackDifficulty"),
    le(n, "adjust", 2, "trackDifficulty"),
    Ys(n, "trackDifficulty", ["left", "top"]));
  const r = Z3(n, "text"),
    s = Z3(n, "chars");
  if (r.name !== "Panel" || y4(r, "texture", "text") !== "난이도text@zz")
    throw new Error("trackDifficulty 的文字贴图配置无效。");
  if (
    (le(r, "leftTopTex", 2, "text"),
    s.name !== "CharPanel" || y4(s, "texture", "chars") !== "난이도원")
  )
    throw new Error("trackDifficulty 的六格图集配置无效。");
  Ys(s, "chars", ["right", "vcenter"]);
  const [o, a] = le(s, "fontSize", 2, "chars"),
    c = y4(s, "fontStr", "chars"),
    l = o + le(s, "spaceOffset", 1, "chars")[0];
  if (
    o <= 0 ||
    a <= 0 ||
    l <= 0 ||
    c.length !== 2 ||
    !c.includes("0") ||
    !c.includes("1") ||
    i.width !== o * c.length ||
    i.height !== a
  )
    throw new Error("trackDifficulty 的 0/1 图集尺寸或字距无效。");
  const u = V0(n, { x: 0, y: 0, width: e.width, height: e.height }),
    h = V0(r, u, void 0, t),
    d = V0(s, u);
  if (
    h.width !== t.width ||
    h.height !== t.height ||
    d.width < o + 5 * l ||
    d.height !== a
  )
    throw new Error("trackDifficulty 的文字或六格窗口尺寸与贴图不符。");
  return {
    labelRect: h,
    glyphRect: d,
    glyphWidth: o,
    glyphHeight: a,
    advance: l,
    emptySourceX: c.indexOf("0") * o,
    filledSourceX: c.indexOf("1") * o,
  };
}

function Ms0(n, e, t, i, r) {
  if (e === void 0) return;
  const { layout: s, text: o, glyphs: a } = t;
  n.drawImage(
    o.image,
    i + s.labelRect.x,
    r + s.labelRect.y,
    s.labelRect.width,
    s.labelRect.height,
  );
  for (let c = 0; c < 6; c += 1)
    n.drawImage(
      a.image,
      c < e ? s.filledSourceX : s.emptySourceX,
      0,
      s.glyphWidth,
      s.glyphHeight,
      i + s.glyphRect.x + c * s.advance,
      r + s.glyphRect.y,
      s.glyphWidth,
      s.glyphHeight,
    );
}

function DE(n, e) {
  const t = new DOMParser().parseFromString(n, "application/xml");
  if (t.querySelector("parsererror")) throw new Error(`${e} 不是有效 XML。`);
  const i = new Map();
  return (
    Array.from(t.documentElement.children).forEach((r) => {
      const s = r.getAttribute("n"),
        a = Array.from(r.children)
          .find((c) => c.getAttribute("c") === "cn")
          ?.getAttribute("v");
      s !== null && a !== null && a !== void 0 && i.set(s, a);
    }),
    i
  );
}

async function xs0(n) {
  const e = n.exactCanonicalCandidates(es0);
  if (e.length === 0) return !1;
  if (e.length !== 1)
    throw new Error(
      `content/config.xml source 数量必须为 1，实际 ${e.length}。`,
    );
  const i = x1(await e[0].bytes()).root.children.find(
    (r) => r.name === "content" && j0(r, "name") === ts0,
  );
  return i !== void 0 && j0(i, "enable") === "true";
}

function Gn(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} 候选数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

async function yi(n) {
  const e = await p2(await n.bytes()),
    t = document.createElement("canvas");
  ((t.width = e.width), (t.height = e.height));
  const i = t.getContext("2d");
  if (!i) throw new Error(`浏览器无法创建 ${n.virtualPath} 的 Canvas。`);
  const r = new Uint8ClampedArray(e.pixels.length);
  return (
    r.set(e.pixels),
    i.putImageData(new ImageData(r, e.width, e.height), 0, 0),
    { image: t, width: e.width, height: e.height }
  );
}

function Ss0(n) {
  const e = Z3(n, "trackInfoCard");
  Ys(e, "trackInfoCard", ["right", "bottom"]);
  const [t, i] = le(e, "windowSize", 2, "trackInfoCard"),
    [r, s] = le(e, "adjust", 2, "trackInfoCard"),
    o = Z3(n, "game");
  Ys(o, "game", ["top"]);
  const [a, c] = le(o, "fontSize", 2, "game");
  if (a !== t) throw new Error(`game fontSize 宽度应为 ${t}，实际 ${a}。`);
  const l = y4(o, "fontStr", "game"),
    u = y4(o, "text", "game"),
    h = l.indexOf(u);
  if (u.length !== 1 || h < 0)
    throw new Error(`game 默认样式条 ${u} 不在 fontStr ${l} 内。`);
  const d = { x: 0, y: 0, width: t, height: c },
    f = Yd(o, "gameSpeed", d),
    p = Yd(o, "gameInfo", d),
    v = Yd(o, "teamName", d),
    w = Z3(n, "trackCardCont");
  Ys(w, "trackCardCont", ["bottom"]);
  const [g, y] = le(w, "windowSize", 2, "trackCardCont");
  if (g !== t) throw new Error(`trackCardCont 宽度应为 ${t}，实际 ${g}。`);
  const b = Z3(n, "trackCard"),
    A = VE(le(b, "trackRect", 4, "trackCard")),
    x = VE(le(b, "trackNameRect", 4, "trackCard")),
    M = zg(le(b, "trackNameTextColor", 4, "trackCard")),
    E = Z3(n, "bgmInfo"),
    [_, C] = le(E, "windowSize", 2, "bgmInfo"),
    [S, G] = le(E, "adjust", 2, "bgmInfo"),
    I = zg(le(E, "textColor", 4, "bgmInfo"));
  return {
    width: t,
    height: i,
    adjustX: r,
    adjustY: s,
    stripHeight: c,
    stripCount: l.length,
    stripIndex: h,
    gameSpeed: f,
    gameInfo: p,
    teamName: v,
    cardTop: i - y,
    cardHeight: y,
    trackRect: A,
    trackNameRect: x,
    trackNameColor: M,
    bgmRect: { x: S, y: G, width: _, height: C },
    bgmColor: I,
  };
}

function Yd(n, e, t) {
  const i = n.children.find((c) => c.name === "Label" && T(c, "name") === e);
  if (!i) throw new Error(`trackInfoCard 模板 game 缺少 Label ${e}。`);
  const r = new Set(
      (T(i, "textAlign") ?? T(i, "align") ?? "left")
        .toLowerCase()
        .split(/[\s,;|]+/)
        .filter(Boolean),
    ),
    s = T(i, "textColor") ?? "white",
    o = s.trim().split(/\s+/).map(Number),
    a = o.length === 4 && o.every(Number.isFinite) ? zg(o) : s;
  return {
    rect: V0(i, t),
    align: r.has("right")
      ? "right"
      : r.has("center") || r.has("hcenter")
        ? "center"
        : "left",
    verticalAlign: r.has("bottom")
      ? "bottom"
      : r.has("vcenter") || r.has("center")
        ? "center"
        : "top",
    color: a,
  };
}

function Z3(n, e) {
  const t = [],
    i = (r) => {
      T(r, "name") === e && t.push(r);
      for (const s of r.children) i(s);
    };
  if ((i(n), t.length !== 1))
    throw new Error(
      `trackInfoCard 模板应有 1 个 ${e} 节点，实际 ${t.length}。`,
    );
  return t[0];
}

function y4(n, e, t) {
  const i = T(n, e);
  if (i === void 0) throw new Error(`${t} 缺少 ${e}。`);
  return i;
}

function le(n, e, t, i) {
  const r = y4(n, e, i).trim().split(/\s+/);
  if (r.length !== t)
    throw new Error(`${i} 的 ${e} 应有 ${t} 个数值，实际 ${r.length}。`);
  return r.map((s) => {
    const o = Number.parseInt(s, 10);
    if (!Number.isFinite(o)) throw new Error(`${i} 的 ${e} 含非数值 ${s}。`);
    return o;
  });
}

function Ys(n, e, t) {
  const i = y4(n, "align", e).toLowerCase();
  for (const r of t)
    if (!i.includes(r))
      throw new Error(`${e} 的 align 应包含 ${r}，实际 ${i}。`);
}

function VE(n) {
  const [e, t, i, r] = n;
  if (i <= e || r <= t) throw new Error(`矩形 ${n.join(" ")} 边序非法。`);
  return { x: e, y: t, width: i - e, height: r - t };
}

function zg(n) {
  const [e, t, i, r] = n;
  return `rgba(${t}, ${i}, ${r}, ${e / 255})`;
}

const lP = 3;

function Cs0(n, e, t) {
  if (!n?.active || n.abilities.length !== lP) return;
  const r = n.abilities
    .map((o) => {
      const a = f20(o),
        c = a && o20(a.group);
      return a && c ? { textKey: c.key, level: a.level } : void 0;
    })
    .filter((o) => o !== void 0);
  if (r.length === 0) return;
  const s = { attributes: r, mode: e, speed: t };
  return (Vv(s), s);
}

function uP(n, e, t, i) {
  if (e === 9) {
    const r = n?.progression;
    if (!r || r.kind !== "xun") return;
    const s = r.skills
      .filter((a) => Number.isInteger(a.points) && a.points > 0)
      .map((a) => {
        const c = xI(a.id);
        return c
          ? {
              textKey: c.key,
              label: c.xunLabel,
              level: a.points,
              levelStyle: "xun",
            }
          : void 0;
      })
      .filter((a) => a !== void 0);
    if (s.length === 0) return;
    const o = { attributes: s, mode: t, speed: i };
    return (Vv(o), o);
  }
  if (e !== void 0 && e >= 0 && e <= 8) return Cs0(n?.factory, t, i);
}

function Vv(n) {
  if (
    !n ||
    !Array.isArray(n.attributes) ||
    n.attributes.length < 1 ||
    n.attributes.length > lP
  )
    throw new Error("属性横幅必须包含一至三项。 ");
  n.attributes.forEach((e) => {
    if (
      !e ||
      typeof e.textKey != "string" ||
      !e.textKey.trim() ||
      !Number.isInteger(e.level) ||
      e.level < 1 ||
      e.level > 5
    )
      throw new Error("粒子改属性横幅的属性键或等级无效。 ");
  });
}

const NE = 240,
  OE = 40,
  Es0 = 0,
  Ts0 = 445,
  _s0 = 38,
  tr = 3,
  Gs0 = 1024,
  Bs0 = 768,
  hP = 1600,
  dP = 900,
  Rs0 = -6,
  gc = "gui_/windowTemplate/ingame_tuningTextBg.png",
  zE = "gui_windowTemplate.rho",
  Is0 = 6e3,
  mc = 3e3,
  Zd = 1,
  ks0 = -1,
  Ls0 = 5,
  Ps0 = 1;

function fP(n, e) {
  const t = (n - Gs0) / 2,
    i = (e - Bs0) / 2;
  return [2, 1, 0].map((r) => {
    const s = Es0 + t + 20 * r,
      o = Ts0 + i - _s0 * r;
    return { x: s, y: o, targetX: s };
  });
}

class Fs0 {
  sessionStartAtMs = Number.NaN;
  finished = !1;
  rows = new Map();
  isFinishedFor(e) {
    return this.finished && this.sessionStartAtMs === e;
  }
  update(e, t, i, r, s) {
    if (!i || t === 0) return (this.reset(), this.hiddenFrame());
    if (
      (this.sessionStartAtMs !== t &&
        (this.rows.clear(), (this.sessionStartAtMs = t), (this.finished = !1)),
      this.finished)
    )
      return this.hiddenFrame();
    const o = t - Is0,
      a = e - o;
    if (a < 0) return this.hiddenFrame();
    const c = new Set(s.filter((d) => Number.isInteger(d) && d >= 0 && d < tr));
    for (const d of this.rows.keys()) c.has(d) || this.rows.delete(d);
    for (const d of c) {
      const f = r[d];
      if (!f) continue;
      const p = this.rows.get(d);
      p
        ? (p.targetX = f.targetX)
        : this.rows.set(d, { x: 0, targetX: f.targetX, active: !0 });
    }
    for (const d of this.rows.values())
      if (d.active)
        if (a < mc) {
          const f = d.targetX - d.x;
          f * Zd > 0 &&
            ((d.x += Zd * (d.targetX / 1e3) * a),
            Math.abs(f) < Ls0 && (d.x = d.targetX));
        } else
          ((d.x += ks0 * (d.targetX / 1e3) * (a - mc)),
            d.x <= Ps0 && (d.active = !1));
    const l = Array(tr).fill(void 0);
    let u = !1,
      h = !1;
    for (const [d, f] of this.rows)
      f.active &&
        ((l[d] = f.x),
        (u = !0),
        a < mc && (f.targetX - f.x) * Zd > 0 && (h = !0));
    return u
      ? a >= mc
        ? { state: "exiting", rowXPositions: l }
        : { state: h ? "entering" : "holding", rowXPositions: l }
      : (this.rows.size > 0 && (this.finished = !0),
        { state: "hidden", rowXPositions: l });
  }
  reset() {
    ((this.sessionStartAtMs = Number.NaN),
      (this.finished = !1),
      this.rows.clear());
  }
  hiddenFrame() {
    return { state: "hidden", rowXPositions: Array(tr).fill(void 0) };
  }
}

const Ds0 = {
    normalBoosterTime: "加速时间",
    gaugeCharge: "集气速度",
    startBoosterTime: "启动加速时间",
  },
  Vs0 = ["", "一级", "二级", "三级", "四级", "五级"];

function Ns0(n) {
  const e = Ds0[n];
  return e !== void 0 ? e : (Er.find((t) => t.key === n)?.factoryLabel ?? n);
}

function Os0(n, e) {
  return e === "xun" ? `+${n}` : (Vs0[n] ?? `${n}级`);
}

function zs0(n) {
  return `${n.label ?? Ns0(n.textKey)} ${Os0(n.level, n.levelStyle)}`;
}

function Us0(n, e, t, i = {}) {
  Vv(t);
  const r = i.viewportWidth ?? hP,
    s = i.viewportHeight ?? dP,
    o = fP(r, s),
    a = tr - t.attributes.length;
  t.attributes.forEach((c, l) => {
    const u = a + l,
      h = o[u],
      d = Math.round(i.rowXPositions?.[u] ?? h.x),
      f = h.y;
    (n.save(),
      n.drawImage(e.image, d, f, NE, OE),
      m9(
        n,
        zs0(c),
        { x: d, y: f + Rs0, width: NE, height: OE },
        {
          kind: "label",
          family: "P3528 Source Han Sans CN Ready",
          size: 16,
          color: "rgba(255, 255, 255, 1)",
          align: "center",
          verticalAlign: "center",
          stroke: 1,
          strokeColor: "rgba(0, 101, 225, 1)",
        },
      ),
      n.restore());
  });
}

const wc = new WeakMap();

function $s0(n) {
  const e = wc.get(n);
  if (e) return e;
  const t = Ws0(n);
  return (
    wc.set(n, t),
    t.catch(() => {
      wc.get(n) === t && wc.delete(n);
    }),
    t
  );
}

async function Ws0(n) {
  const e = zE.toLowerCase(),
    t = gc.slice(gc.lastIndexOf("/") + 1).toLowerCase(),
    i = n
      .canonicalCandidates(gc)
      .filter(
        (h) => h.sourceKind === "rho" && h.sourceName.toLowerCase() === e,
      ),
    r = n.files.filter((h) => {
      const d = (h.canonicalPath ?? h.virtualPath).replaceAll("\\", "/");
      return (
        h.sourceKind === "rho" &&
        h.sourceName.toLowerCase() === e &&
        d.slice(d.lastIndexOf("/") + 1).toLowerCase() === t
      );
    }),
    s = [
      ...new Map(
        [...i, ...r].map((h) => [
          `${h.sourceName.toLowerCase()}:${h.virtualPath.toLowerCase()}`,
          h,
        ]),
      ).values(),
    ];
  if (s.length > 1) throw new Error(`${gc} 在 ${zE} 内不唯一。`);
  const o = s[0];
  if (!o) return;
  const a = await p2(await o.bytes()),
    c = document.createElement("canvas");
  ((c.width = a.width), (c.height = a.height));
  const l = c.getContext("2d");
  if (!l) throw new Error("无法创建粒子改属性横幅纹理 Canvas。 ");
  const u = new Uint8ClampedArray(a.pixels.length);
  return (
    u.set(a.pixels),
    l.putImageData(new ImageData(u, a.width, a.height), 0, 0),
    { width: a.width, height: a.height, image: c }
  );
}

class x7 {
  constructor(e) {
    this.options = e;
    const t = this.canvas.getContext("2d", { alpha: !0 });
    if (!t) throw new Error("无法创建粒子改属性横幅 Canvas。 ");
    ((this.context = t),
      Object.assign(this.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "1",
        display: "none",
      }),
      (this.canvas.dataset.uiLayer = "stage"),
      (this.canvas.dataset.particleBanner = "created"),
      (this.canvas.hidden = !0),
      this.canvas.setAttribute("aria-hidden", "true"),
      e.root.append(this.canvas));
  }
  options;
  canvas = document.createElement("canvas");
  context;
  motion = new Fs0();
  disposed = !1;
  static async load(e, t) {
    const i = await $s0(e);
    return i ? new x7({ root: t, texture: i }) : void 0;
  }
  isAttached() {
    return this.canvas.isConnected;
  }
  update(e, t, i, r) {
    if (this.disposed || this.motion.isFinishedFor(t)) return;
    const s = r !== void 0 && r.attributes.length > 0,
      o = s ? tr - r.attributes.length : tr,
      a = s ? r.attributes.map((f, p) => o + p) : [],
      c = hP,
      l = dP,
      u = fP(c, l),
      h = this.motion.update(e, t, i, u, a);
    if (
      ((this.canvas.dataset.particleBannerRequest = s ? "ready" : "empty"),
      (this.canvas.dataset.particleBannerStartAtMs = String(t)),
      (this.canvas.dataset.particleBannerCountdown = String(i)),
      (this.canvas.dataset.particleBannerState = h.state),
      !s || h.state === "hidden")
    ) {
      this.hideCanvas();
      return;
    }
    ((this.canvas.hidden = !1),
      (this.canvas.style.display = "block"),
      this.canvas.setAttribute("aria-hidden", "false"));
    const d = this.options.root.getBoundingClientRect();
    (p3(
      this.canvas,
      this.context,
      d.width,
      d.height,
      xe(),
      1600,
      900,
      1600,
      900,
    ),
      this.context.clearRect(0, 0, 1600, 900),
      Us0(this.context, this.options.texture, r, {
        viewportWidth: c,
        viewportHeight: l,
        rowXPositions: h.rowXPositions,
      }));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0), this.motion.reset(), this.canvas.remove());
  }
  hideCanvas() {
    (this.canvas.hidden || this.context.clearRect(0, 0, 1600, 900),
      (this.canvas.hidden = !0),
      (this.canvas.style.display = "none"),
      this.canvas.setAttribute("aria-hidden", "true"));
  }
}

function Hs0(host) { return createMultiplayerRaceLoader(host, multiplayerRaceLoaderDependencies); }

class qs0 extends CanvasContextDiagnostics {}



































































const Nv = 0.5,
  Ov = 2e3,
  Ug = Ov / Nv + 1,
  wP = 1024 * 1024;































const Uo = 39,
  yP = "launcher-room-v1",
  ke = (n) => !!n && typeof n == "object" && !Array.isArray(n),
  _2 = (n, e, t) =>
    typeof n == "string" &&
    [...n].length >= e &&
    [...n].length <= t &&
    !/[\u0000-\u001f\u007f]/u.test(n),
  P1 = (n, e, t) => Number.isSafeInteger(n) && Number(n) >= e && Number(n) <= t,
  AP = (n) => n === "p3528" || n === "p3543" || n === "p3553",
  Wg = (n) => typeof n == "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n),
  w6 = (n) =>
    ke(n) &&
    P1(n.sequence, 1, Number.MAX_SAFE_INTEGER) &&
    _2(n.playerId, 1, 64) &&
    _2(n.name, 1, 18) &&
    _2(n.text, 1, 120) &&
    !!n.text.trim(),
  Oo0 = (n) =>
    typeof n == "string" &&
    n.length > 0 &&
    n.length <= 16384 &&
    /^v=0\r?\n/.test(n) &&
    /(?:^|\n)m=application /m.test(n) &&
    !/(?:^|\n)m=(?:audio|video) /m.test(n);

function bP(value) { return isValidRoomSnapshot(value); }

function zo0(value) { return parseServerEvent(value, { validRoom: bP, validChannel: W6, validGameplay: To, validRandomTrackCode: code => !!X6(code) }); }

class $o0 extends HudOverlay { constructor(root, callbacks) { super(root, callbacks, `${Uo}.11`); } }

const Yo0 = {
    "track-select": "ReadyTrackSelect",
    garage: "ReadyGarage",
    house: "ReadyHouse",
    settings: "ReadySettings",
  },
  Zo0 = {
    ReadyTrackSelect: "track-select",
    ReadyGarage: "garage",
    ReadyHouse: "house",
    ReadySettings: "settings",
  };

class Qo0 {
  state = "Booting";
  haltLock = !1;
  raceStarting = !1;
  readyStageOpening = !1;
  get current() {
    return this.state;
  }
  get modal() {
    return Zo0[this.state];
  }
  get started() {
    return this.state === "Racing";
  }
  get halted() {
    return this.haltLock;
  }
  get readyModalBusy() {
    return (
      this.state === "MultiplayerLobby" ||
      this.state === "MultiplayerRacing" ||
      this.raceStarting ||
      this.readyStageOpening ||
      this.state === "ReadyTrackSelect" ||
      this.state === "ReadyGarage" ||
      this.state === "ReadyHouse" ||
      this.state === "ReadySettings"
    );
  }
  get isRaceStarting() {
    return this.raceStarting;
  }
  get isReadyStageOpening() {
    return this.readyStageOpening;
  }
  enterMultiplayerLobby(e = "ready") {
    return this.raceStarting ||
      this.readyStageOpening ||
      this.state !== (e === "garage" ? "ReadyGarage" : "Ready")
      ? !1
      : ((this.state = "MultiplayerLobby"), !0);
  }
  restoreGarageFromMultiplayerLobby() {
    if (this.state !== "MultiplayerLobby")
      throw new Error("Multiplayer lobby is not active");
    this.state = "ReadyGarage";
  }
  leaveMultiplayerLobby() {
    if (this.state !== "MultiplayerLobby")
      throw new Error("Multiplayer lobby is not active");
    this.state = "Ready";
  }
  enterMultiplayerRace() {
    if (this.state !== "MultiplayerLobby")
      throw new Error("Multiplayer room is not active");
    this.state = "MultiplayerRacing";
  }
  leaveMultiplayerRace() {
    if (this.state !== "MultiplayerRacing")
      throw new Error("Multiplayer race is not active");
    this.state = "MultiplayerLobby";
  }
  enterReady() {
    const e = this.state;
    if (e !== "Booting" && e !== "Ready" && e !== "Racing")
      throw new Error(`ShellStateMachine.enterReady 非法转移：${e} -> Ready。`);
    this.state = "Ready";
  }
  halt() {
    if (this.state === "Disposed")
      throw new Error("ShellStateMachine.halt 非法转移：Disposed。");
    this.haltLock = !0;
  }
  clearHalt() {
    if (this.state === "Disposed")
      throw new Error("ShellStateMachine.clearHalt 非法转移：Disposed。");
    this.haltLock = !1;
  }
  openModal(e) {
    return this.state !== "Ready" || this.readyModalBusy
      ? !1
      : ((this.state = Yo0[e]), !0);
  }
  closeModal(e) {
    if (this.modal !== e)
      throw new Error(
        `ShellStateMachine.closeModal 非法转移：${this.state} 关闭 ${e}。`,
      );
    this.state = "Ready";
  }
  beginRaceStart() {
    return this.state !== "Ready" || this.readyModalBusy
      ? !1
      : ((this.raceStarting = !0), !0);
  }
  enterRace() {
    if (this.state !== "Ready" && this.state !== "Racing")
      throw new Error(
        `ShellStateMachine.enterRace 非法转移：${this.state} -> Racing。`,
      );
    this.state = "Racing";
  }
  endRaceStart() {
    if (!this.raceStarting)
      throw new Error(
        "ShellStateMachine.endRaceStart 调用时未持有 race start 锁。",
      );
    this.raceStarting = !1;
  }
  beginReadyStage() {
    if (this.state === "Disposed")
      throw new Error("ShellStateMachine.beginReadyStage 非法转移：Disposed。");
    this.readyStageOpening = !0;
  }
  endReadyStage() {
    if (!this.readyStageOpening)
      throw new Error(
        "ShellStateMachine.endReadyStage 调用时未持有 ready stage 锁。",
      );
    this.readyStageOpening = !1;
  }
  dispose() {
    ((this.state = "Disposed"),
      (this.haltLock = !1),
      (this.raceStarting = !1),
      (this.readyStageOpening = !1));
  }
}

class Jo0 {
  constructor(e) {
    this.debug = e;
  }
  debug;
  library;
  resources;
  generation = 0;
  get current() {
    return this.library;
  }
  get opfs() {
    return this.resources;
  }
  get generationValue() {
    return this.generation;
  }
  beginGeneration() {
    return ++this.generation;
  }
  invalidate() {
    this.generation += 1;
  }
  isCurrent(e) {
    return e === this.generation;
  }
  install(e, t) {
    ((this.library = e), (this.resources = t));
  }
  require(e) {
    const t = this.library?.get(e);
    if (!t) throw new Error(`资源库内找不到 ${e}。`);
    return t;
  }
  async preloadContainers(e, t, i, r) {
    if (!this.library || !this.resources)
      throw new Error("P3528 资源库尚未建立。");
    const s = await t3(this.library, t, r),
      o = s.find(["model.1s"]);
    if (!o) throw new Error(`${t} 的车辆资源目录内找不到 model.1s。`);
    const a = this.library.physicalContainerNames([
      e,
      s.parameter.entry.virtualPath,
      o.virtualPath,
      i,
    ]);
    (await this.resources.preloadContainers(a),
      this.debug.showDebugText(`已预加载本局 ${a.length} 个物理资源容器`));
  }
}

const ut = [
    { index: 0, action: l2.SteerLeft, defaultKeyCode: 203 },
    { index: 1, action: l2.SteerRight, defaultKeyCode: 205 },
    { index: 2, action: l2.Forward, defaultKeyCode: 200 },
    { index: 3, action: l2.Reverse, defaultKeyCode: 208 },
    { index: 4, action: l2.Drift, defaultKeyCode: 42 },
    { index: 5, action: l2.UseItemOrBooster, defaultKeyCode: 29 },
    { index: 6, action: l2.ReorderItems, defaultKeyCode: 56 },
    { index: 7, action: l2.SecondaryItem, defaultKeyCode: 44 },
    { index: 8, action: l2.GaugeState, defaultKeyCode: 57 },
    { index: 9, action: l2.Reset, defaultKeyCode: 19 },
    { index: 10, action: l2.SteerLeft, defaultKeyCode: 75 },
    { index: 11, action: l2.SteerRight, defaultKeyCode: 77 },
    { index: 12, action: l2.Forward, defaultKeyCode: 72 },
    { index: 13, action: l2.Reverse, defaultKeyCode: 80 },
    { index: 14, action: l2.Drift, defaultKeyCode: 54 },
    { index: 15, action: l2.UseItemOrBooster, defaultKeyCode: 157 },
    { index: 16, action: l2.ReorderItems, defaultKeyCode: 184 },
    { index: 18, action: l2.ModeImpulsePositive, defaultKeyCode: 44 },
    { index: 19, action: l2.ModeImpulseNegative, defaultKeyCode: 45 },
    { index: 20, action: l2.GaugeState, defaultKeyCode: 45 },
    { index: 21, action: l2.DisplayMode, defaultKeyCode: 23 },
    { index: 22, action: l2.Help, defaultKeyCode: 59 },
  ],
  Br = Object.fromEntries(ut.map(({ index: n, defaultKeyCode: e }) => [n, e])),
  MP = {
    0: ["", !0],
    1: ["Esc", !1],
    2: ["1", !1],
    3: ["2", !1],
    4: ["3", !1],
    5: ["4", !1],
    6: ["5", !1],
    7: ["6", !1],
    8: ["7", !1],
    9: ["8", !1],
    10: ["9", !1],
    11: ["0", !1],
    12: ["-", !0],
    13: ["=", !0],
    14: ["Back Space", !0],
    15: ["Tab", !1],
    16: ["Q", !0],
    17: ["W", !0],
    18: ["E", !0],
    19: ["R", !0],
    20: ["T", !0],
    21: ["Y", !0],
    22: ["U", !0],
    23: ["I", !0],
    24: ["O", !0],
    25: ["P", !0],
    26: ["[", !0],
    27: ["]", !0],
    28: ["Enter", !0],
    29: ["Ctrl (Left)", !0],
    30: ["A", !0],
    31: ["S", !0],
    32: ["D", !0],
    33: ["F", !0],
    34: ["G", !0],
    35: ["H", !0],
    36: ["J", !0],
    37: ["K", !0],
    38: ["L", !0],
    39: [";", !0],
    40: ["'", !0],
    41: ["`", !0],
    42: ["Shift (Left)", !0],
    43: ["\\", !0],
    44: ["Z", !0],
    45: ["X", !0],
    46: ["C", !0],
    47: ["V", !0],
    48: ["B", !0],
    49: ["N", !0],
    50: ["M", !1],
    51: [",", !0],
    52: [".", !0],
    53: ["/", !0],
    54: ["Shift (Right)", !0],
    55: ["* (Numpad)", !0],
    56: ["Alt (Left)", !0],
    57: ["Space", !0],
    58: ["Caps Lock", !0],
    59: ["F1", !0],
    60: ["F2", !1],
    61: ["F3", !1],
    62: ["F4", !1],
    63: ["F5", !1],
    64: ["F6", !1],
    65: ["F7", !1],
    66: ["F8", !1],
    67: ["F9", !1],
    68: ["F10", !1],
    69: ["Num Lock", !1],
    70: ["Scroll Lock", !1],
    71: ["7 (Numpad)", !0],
    72: ["8 (Numpad)", !0],
    73: ["9 (Numpad)", !0],
    74: ["- (Numpad)", !0],
    75: ["4 (Numpad)", !0],
    76: ["5 (Numpad)", !0],
    77: ["6 (Numpad)", !0],
    78: ["+ (Numpad)", !0],
    79: ["1 (Numpad)", !0],
    80: ["2 (Numpad)", !0],
    81: ["3 (Numpad)", !0],
    82: ["0 (Numpad)", !0],
    83: [". (Numpad)", !0],
    87: ["F11", !1],
    88: ["F12", !1],
    100: ["F13", !1],
    101: ["F14", !1],
    102: ["F15", !1],
    112: ["Kana", !0],
    121: ["Convert", !0],
    123: ["No Convert", !0],
    125: ["Yen", !0],
    141: ["=(Numpad)", !0],
    144: ["Circumflex", !0],
    145: ["@", !0],
    146: [":", !0],
    147: ["_", !0],
    148: ["Kanji", !0],
    149: ["Stop", !0],
    150: ["Japan AX", !0],
    151: ["J3100", !0],
    156: ["Enter (Numpad)", !0],
    157: ["Ctrl (Right)", !0],
    179: [", (Numpad)", !0],
    181: ["/ (Numpad)", !0],
    183: ["Sys Rq", !0],
    184: ["Alt (Right)", !0],
    197: ["Pause", !0],
    199: ["Home", !0],
    200: ["Up Arrow", !0],
    201: ["Page Up", !0],
    203: ["Left Arrow", !0],
    205: ["Right Arrow", !0],
    207: ["End", !0],
    208: ["Down Arrow", !0],
    209: ["Page Down", !0],
    210: ["Insert", !0],
    211: ["Delete", !0],
    219: ["Windows (Left)", !1],
    220: ["Windows (Right)", !1],
    221: ["Menu", !1],
    222: ["Power", !1],
    223: ["Sleep", !1],
  };

function xP(code) { return browserScanCode(code); }

function SP(n) {
  return MP[n]?.[0] ?? "";
}

function CP(n) {
  return typeof n == "number" && MP[n]?.[1] === !0;
}

function ta0(n) {
  if (typeof n != "object" || n === null || Array.isArray(n))
    throw new Error("客户端键位配置必须是绑定编号到键码的记录。");
  const e = n;
  if (Object.keys(e).length !== ut.length)
    throw new Error("客户端键位配置必须保留原版 22 个绑定。");
  if (!ut.every(({ index: t }) => CP(e[t])))
    throw new Error("客户端键位配置包含缺失绑定或原版不允许的键码。");
  return e;
}

const Ga = -1,
  na0 = 64,
  Zs = na0;

function v6(axis, value) { return gamepadAxisControl(axis, value); }

const ra0 = {
    0: "A",
    1: "B",
    2: "X",
    3: "Y",
    4: "LB",
    5: "RB",
    6: "LT",
    7: "RT",
    8: "Back",
    9: "Start",
    10: "LS",
    11: "RS",
    12: "十字上",
    13: "十字下",
    14: "十字左",
    15: "十字右",
  };

function sa0(n) {
  if (n === Ga) return "";
  if (n < Zs) return ra0[n] ?? `按钮${n}`;
  const e = Math.floor((n - Zs) / 2),
    t = (n - Zs) % 2 === 0;
  return `摇杆${e + 1}${t ? "←/↑" : "→/↓"}`;
}

function EP(n) {
  return (
    typeof n == "number" &&
    Number.isInteger(n) &&
    (n === Ga || (n >= 0 && n < Zs + 16))
  );
}

const TP = Object.fromEntries(ut.map((n) => [n.index, oa0(n)]));

function oa0(n) {
  switch (n.index) {
    case 0:
      return v6(0, -1);
    case 1:
      return v6(0, 1);
    case 2:
      return 0;
    case 3:
      return 1;
    case 4:
      return 2;
    case 5:
      return 5;
    case 6:
      return 3;
    case 7:
      return 4;
    case 8:
      return 7;
    case 9:
      return 8;
    case 21:
      return 9;
    default:
      return Ga;
  }
}

function Hg(gamepads) { return pressedGamepadControls(gamepads); }

function aa0(n) {
  if (typeof n != "object" || n === null || Array.isArray(n))
    throw new Error("客户端手柄键位配置必须是绑定编号到手柄控件的记录。");
  const e = n;
  if (Object.keys(e).length !== ut.length)
    throw new Error("客户端手柄键位配置必须保留原版 22 个绑定。");
  if (!ut.every(({ index: t }) => EP(e[t])))
    throw new Error("客户端手柄键位配置包含缺失绑定或非法手柄控件。");
  return e;
}

function ca0(n, e, t) {
  return t === Ga ? !1 : ut.some((i) => i.index !== e && n[i.index] === t);
}

const _P = {
    bgmEnabled: !0,
    bgmVolume: 1,
    fxEnabled: !0,
    fxVolume: 1,
    enableRoadSound: !1,
    verticalSync: false,
    boostBlur: !1,
    dualBoostAuto: !0,
    toonLine: !0,
    shadow: !0,
    mainMenuBgmPath: "",
    inGameFlyingPetVisible: !1,
    raceAnonymous: !1,
    raceTimeGap: !1,
    classicHud: !1,
    autoReady: !1,
    keyMap: Br,
    gamepadMap: TP,
  },
  GP = "kartrider-web:p3528:game-options-v1",
  BP = { F6: "enableRoadSound", F7: "fxEnabled", F8: "bgmEnabled" };

function la0() {
  const n = localStorage.getItem(GP),
    e =
      n === null
        ? { ..._P }
        : {
            verticalSync: false,
            dualBoostAuto: !0,
            toonLine: !0,
            shadow: !0,
            inGameFlyingPetVisible: !1,
            raceAnonymous: !1,
            raceTimeGap: !1,
            classicHud: !1,
            autoReady: !1,
            mainMenuBgmPath: "",
            keyMap: Br,
            gamepadMap: TP,
            ...JSON.parse(n),
          };
  return (RP(e), e);
}

function ua0(n) {
  (RP(n), localStorage.setItem(GP, JSON.stringify(n)));
}

function RP(n) {
  for (const e of [
    "bgmEnabled",
    "fxEnabled",
    "enableRoadSound",
    "verticalSync",
    "boostBlur",
    "dualBoostAuto",
    "toonLine",
    "shadow",
    "inGameFlyingPetVisible",
    "raceAnonymous",
    "raceTimeGap",
    "classicHud",
    "autoReady",
  ])
    if (typeof n?.[e] != "boolean")
      throw new Error(`本地游戏设置 ${e} 必须是布尔值。`);
  if (
    (["bgmVolume", "fxVolume"].forEach((e) => {
      const t = n[e];
      if (!Number.isFinite(t) || t < 0 || t > 1)
        throw new Error(`本地游戏设置 ${e} 必须在 0 到 1 之间。`);
    }),
    typeof n.mainMenuBgmPath != "string" ||
      (n.mainMenuBgmPath !== "" &&
        !/^sound_\/bgm\/[-\w]+\/[-\w]+\.ogg$/.test(n.mainMenuBgmPath)))
  )
    throw new Error("本地游戏设置 mainMenuBgmPath 无效。");
  (ta0(n.keyMap), aa0(n.gamepadMap));
}

const ha0 = {
    steam: 22,
    forest: 1,
    desert: 2,
    village: 3,
    ice: 4,
    tomb: 5,
    mine: 6,
    northeu: 7,
    factory: 8,
    pirate: 9,
    fairy: 10,
    moonhill: 11,
    gold: 12,
    china: 13,
    castle: 14,
    nymph: 15,
    mechanic: 16,
    xyy: 17,
    wkc: 18,
    brodi: 19,
    park: 20,
    beach: 21,
    transFormer: 23,
    jurassic: 24,
    world: 25,
    nemo: 26,
    sword: 27,
    god: 28,
    abyss: 29,
    camelot: 30,
    olympos: 31,
    korea: 32,
    mabi: 33,
    maple: 34,
    fengshen: 35,
  },
  da0 = new Map([
    ["gold_S02", 457835184],
    ["gold_S01", 461767354],
    ["", 65536],
  ]);

function IP(n) {
  const e = ha0[n.theme];
  if (e === void 0) throw new Error(`P3528 收藏赛道主题无法解析：${n.theme}`);
  return { themeId: e, trackId: fa0(n.id) };
}

function fa0(n) {
  const e = da0.get(n);
  if (e !== void 0) return e;
  const t = new Uint8Array(n.length * 2),
    i = new DataView(t.buffer);
  for (let o = 0; o < n.length; o++) i.setUint16(o * 2, n.charCodeAt(o), !0);
  const r = Dt(t),
    s = r === 0 ? 1 : r === 4294967295 ? 2 : r;
  return s < 65536 ? s + 65536 : s;
}

function nT(n, e) {
  return new Set(
    e
      .filter((t) => {
        const i = IP(t);
        return n.some(
          (r) => r.themeId === i.themeId && r.trackId === i.trackId,
        );
      })
      .map((t) => t.id),
  );
}

const C4 = "国服",
  Qd = ["国服", "国服复古", "韩服复古"],
  pa0 = [4, 7],
  ga0 = 7,
  ze = "国服",
  E4 = 7;

function Ue(n) {
  const e = n.version ?? ze,
    t = n.settingSpeed ?? E4;
  return e === ze && t === E4 ? n.speed : t;
}

function kP(n) {
  return (n.version ?? ze) === ze && (n.settingSpeed ?? E4) === E4;
}

function y6(n) {
  return $v(n.version ?? ze, Ue(n));
}

const LP = "缺少该版本的速度参数。",
  PP = {
    国服: [7, 6, 3, 0, 1, 2],
    国服复古: [0, 1, 2, 3, 4, 5],
    韩服复古: [0, 1, 2, 3, 4, 5],
  },
  FP = Uv(C4),
  ma0 = pa0.filter((n) => !PP[C4].includes(n)).map((n) => DP(C4, n));

function Di(n) {
  return n === C4 ? FP : Uv(n);
}

function zv(n, e) {
  return (n === C4 ? [...FP, ...ma0] : Uv(n)).find((i) => i.speed === e);
}

function Ac(n) {
  const e = Di(n);
  return e.some((t) => t.available)
    ? { version: n, available: !0 }
    : {
        version: n,
        available: !1,
        unavailableReason: e[0]?.unavailableReason ?? LP,
      };
}

function Uv(n) {
  const e = PP[n];
  if (!e) throw new Error(`速度版本 ${n} 没有档位顺序表。`);
  return e.map((t) => DP(n, t));
}

function DP(n, e) {
  const i = II(n, e) !== void 0;
  return {
    speed: e,
    label: va0(n, e),
    available: i,
    ...(i ? {} : { unavailableReason: LP }),
  };
}

function wa0(n) {
  return Di(n).find((e) => e.available);
}

function $v(n, e) {
  const t = zv(n, e);
  if (!t) throw new Error(`${n} 的速度频道未收录速度 ${e}。`);
  if (!t.available)
    throw new Error(`${n} 的速度 ${e} 不可选：${t.unavailableReason ?? ""}`);
  return t.speed;
}

function VP(n, e) {
  return n.label.kind === "literal" ? n.label.text : e(`#sb(${n.label.key})`);
}

function va0(n, e) {
  return n !== C4
    ? { kind: "literal", text: iT(n, e) }
    : [4, 6, 7].includes(e)
      ? { kind: "string", key: `speedS${e}` }
      : { kind: "literal", text: iT(n, e) };
}

function iT(n, e) {
  const t = i3[n],
    i = Object.keys(t).find((r) => t[r] === e);
  if (i === void 0)
    throw new Error(`速度 ${e} 在 ${n} 的速度频道表里没有名字。`);
  return i;
}

function ya0(n, e) {
  return {
    x: Math.trunc(n.x * e.a + e.e),
    y: Math.trunc(n.y * e.d + e.f),
    width: Math.max(1, Math.trunc(n.width * e.a)),
    height: Math.max(1, Math.trunc(n.height * e.d)),
  };
}

function NP(n, e, t, i) {
  const r = ya0(t, e.getTransform());
  ((n.domElement.width !== r.width || n.domElement.height !== r.height) &&
    n.setDrawingBufferSize(r.width, r.height, 1),
    i(),
    e.save());
  try {
    (e.setTransform(1, 0, 0, 1, 0, 0), e.drawImage(n.domElement, r.x, r.y));
  } finally {
    e.restore();
  }
}

const Aa0 = new Set([
    "drawImage",
    "fillRect",
    "fillText",
    "strokeText",
    "fill",
    "stroke",
  ]),
  ba0 = [
    "fillStyle",
    "strokeStyle",
    "font",
    "fontKerning",
    "letterSpacing",
    "textAlign",
    "textBaseline",
    "direction",
    "lineWidth",
    "lineJoin",
    "miterLimit",
    "globalAlpha",
    "globalCompositeOperation",
    "imageSmoothingEnabled",
    "imageSmoothingQuality",
    "shadowBlur",
    "shadowColor",
    "shadowOffsetX",
    "shadowOffsetY",
  ];

export { $o0, $v, Aa0, Ac, Ar0, BP, Br, C4, CP, Di, E4, EP, Ga, Hg, Hs0, IP, JL, Jo0, KL, LL, M7, NP, Ng, OL, PL, Pv, QL, Qd, Qo0, S4, SP, Ue, Uo, VP, Vg, XL, _L, _P, _a, aP, b7, ba0, cP, ca0, eP, eT, f6, ga0, iP, io0, jo0, jr0, kL, kP, kv, la0, nP, nT, oP, qs0, rP, ro0, sP, sa0, so0, tP, uP, ua0, uo0, ut, wa0, x7, xP, xv, y6, yP, yr0, ze, zn, zo0, zv };
