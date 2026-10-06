// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { StageManager as wf0 } from "../app/stage-manager.ts";
import { advancePresentationFrame, renderPresentationFrame } from "../app/frame-loop.ts";
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

function i60(n) {
  return n === "pause" ? n : Number(n);
}

const zT = "kartsim.touch-layout",
  UT = {
    ArrowLeft: [-4, 0],
    ArrowRight: [4, 0],
    ArrowUp: [0, -4],
    ArrowDown: [0, 4],
  };

class r60 {
  constructor(e, t, i, r) {
    ((this.menu = e),
      (this.pad = t),
      (this.buttons = i),
      (this.onEditingChange = r),
      (this.parent = t.parentElement),
      (this.nextSibling = t.nextSibling),
      (this.externalButtons = [...i.values()]
        .filter((s) => !t.contains(s))
        .map((s) => ({
          button: s,
          parent: s.parentElement,
          nextSibling: s.nextSibling,
        }))),
      (this.selected = i.keys().next().value),
      (this.editor.className = "touch-layout-editor"),
      (this.editor.hidden = !0),
      (this.editor.innerHTML = `
      <div class="touch-layout-panel">
        <div class="touch-layout-actions">
          <button type="button" data-layout="save">保存</button>
          <button type="button" data-layout="cancel">取消</button>
          <button type="button" data-layout="reset">恢复默认</button>
        </div>
        <p role="status"></p>
      </div>
      <button type="button" class="touch-layout-resize-handle" aria-label="调整按键大小">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="M4 9V4h5M15 20h5v-5M4 4l6 6M20 20l-6-6"/>
        </svg>
      </button>`),
      (this.resizeHandle = this.editor.querySelector(
        ".touch-layout-resize-handle",
      )),
      (this.message = this.editor.querySelector("[role='status']")),
      this.menu.append(this.editor));
    for (const [s, o] of i)
      (o.addEventListener("pointerdown", (a) => this.startDrag(a, s), {
        signal: this.listeners.signal,
      }),
        o.addEventListener(
          "focus",
          () => {
            this.editing && this.selectButton(s);
          },
          { signal: this.listeners.signal },
        ));
    (this.bindEditor(),
      (this.saved = this.readSaved()),
      this.apply(this.saved));
  }
  menu;
  pad;
  buttons;
  onEditingChange;
  editor = document.createElement("div");
  listeners = new AbortController();
  resizeHandle;
  message;
  parent;
  nextSibling;
  externalButtons;
  saved;
  draft = {};
  selected;
  editing = !1;
  previousFocus = null;
  drag;
  resize;
  get isEditing() {
    return this.editing;
  }
  start() {
    this.editing ||
      ((this.previousFocus = document.activeElement),
      (this.draft = { ...this.saved }),
      (this.editing = !0),
      (this.message.textContent = ""),
      this.menu.classList.add("is-editing"),
      (this.editor.hidden = !1),
      this.editor.append(this.pad),
      this.externalButtons.forEach(({ button: e }) => this.editor.append(e)),
      (this.pad.hidden = !1),
      this.onEditingChange(),
      this.selectButton(this.selected),
      this.buttons.get(this.selected).focus({ preventScroll: !0 }));
  }
  cancel() {
    this.editing && (this.apply(this.saved), this.finish());
  }
  dispose() {
    (this.cancel(), this.listeners.abort(), this.editor.remove());
  }
  bindEditor() {
    const e = { signal: this.listeners.signal };
    (this.resizeHandle.addEventListener(
      "pointerdown",
      (i) => this.startResize(i),
      e,
    ),
      this.editor
        .querySelector("[data-layout='save']")
        .addEventListener("click", () => this.save(), e),
      this.editor
        .querySelector("[data-layout='cancel']")
        .addEventListener("click", () => this.cancel(), e),
      this.editor
        .querySelector("[data-layout='reset']")
        .addEventListener("click", () => this.reset(), e),
      this.editor.addEventListener(
        "pointermove",
        (i) => {
          (this.moveDrag(i), this.moveResize(i));
        },
        e,
      ));
    const t = (i) => {
      (i.pointerId === this.drag?.pointer && this.stopDrag(),
        i.pointerId === this.resize?.pointer && this.stopResize());
    };
    (this.editor.addEventListener("pointerup", t, e),
      this.editor.addEventListener("pointercancel", t, e),
      this.editor.addEventListener("lostpointercapture", t, e),
      this.editor.addEventListener(
        "keydown",
        (i) => {
          (this.moveWithKeyboard(i), this.resizeWithKeyboard(i));
        },
        e,
      ));
  }
  readSaved() {
    try {
      return s60(localStorage.getItem(zT) ?? "{}", this.buttons.keys());
    } catch {
      return {};
    }
  }
  save() {
    this.stopInteraction();
    try {
      localStorage.setItem(zT, JSON.stringify(this.draft));
    } catch {
      this.message.textContent =
        "无法保存按键布局，请检查浏览器的本地存储设置后重试。";
      return;
    }
    ((this.saved = { ...this.draft }), this.finish());
  }
  reset() {
    (this.stopInteraction(),
      (this.draft = {}),
      this.apply(this.draft),
      this.selectButton(this.selected),
      (this.message.textContent = "已恢复默认，保存后生效。"));
  }
  finish() {
    (this.stopInteraction(), (this.editing = !1));
    for (const e of this.buttons.values())
      e.classList.remove("is-layout-selected");
    (this.parent.insertBefore(this.pad, this.nextSibling),
      this.externalButtons.forEach(({ button: e, parent: t, nextSibling: i }) =>
        t.insertBefore(e, i),
      ),
      (this.editor.hidden = !0),
      this.menu.classList.remove("is-editing"),
      this.onEditingChange(),
      this.previousFocus?.focus());
  }
  selectButton(e) {
    this.selected = e;
    for (const [i, r] of this.buttons)
      r.classList.toggle("is-layout-selected", i === e);
    const t = this.buttons.get(e);
    (this.resizeHandle.setAttribute(
      "aria-label",
      `调整${t.dataset.actionName ?? "按键"}大小`,
    ),
      this.positionResizeHandle());
  }
  startDrag(e, t) {
    if (!this.editing || this.drag || this.resize || e.button !== 0) return;
    (e.preventDefault(), this.selectButton(t));
    const i = this.buttons.get(t);
    i.focus({ preventScroll: !0 });
    const r = i.getBoundingClientRect();
    ((this.drag = {
      pointer: e.pointerId,
      action: t,
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
    }),
      i.setPointerCapture(e.pointerId));
  }
  moveDrag(e) {
    if (this.drag?.pointer !== e.pointerId) return;
    e.preventDefault();
    const { action: t, offsetX: i, offsetY: r } = this.drag,
      { width: s, height: o } = this.buttons.get(t).getBoundingClientRect();
    this.place(t, e.clientX - i, e.clientY - r, s, o);
  }
  stopDrag() {
    if (!this.drag) return;
    const { pointer: e, action: t } = this.drag;
    this.drag = void 0;
    const i = this.buttons.get(t);
    i.hasPointerCapture(e) && i.releasePointerCapture(e);
  }
  startResize(e) {
    if (!this.editing || this.drag || this.resize || e.button !== 0) return;
    (e.preventDefault(), e.stopPropagation());
    const {
      left: t,
      top: i,
      width: r,
      height: s,
    } = this.buttons.get(this.selected).getBoundingClientRect();
    ((this.resize = {
      pointer: e.pointerId,
      action: this.selected,
      left: t,
      top: i,
      width: r,
      height: s,
      startX: e.clientX,
      startY: e.clientY,
    }),
      this.resizeHandle.setPointerCapture(e.pointerId));
  }
  moveResize(e) {
    if (this.resize?.pointer !== e.pointerId) return;
    e.preventDefault();
    const {
        action: t,
        left: i,
        top: r,
        width: s,
        height: o,
        startX: a,
        startY: c,
      } = this.resize,
      l = $T(s, o, e.clientX - a, e.clientY - c);
    this.place(t, i, r, l.width, l.height);
  }
  stopResize() {
    if (!this.resize) return;
    const { pointer: e } = this.resize;
    ((this.resize = void 0),
      this.resizeHandle.hasPointerCapture(e) &&
        this.resizeHandle.releasePointerCapture(e));
  }
  stopInteraction() {
    (this.stopDrag(), this.stopResize());
  }
  moveWithKeyboard(e) {
    const t = UT[e.key],
      i = this.buttons.get(this.selected);
    if (!this.editing || !t || e.target !== i) return;
    e.preventDefault();
    const r = i.getBoundingClientRect();
    this.place(this.selected, r.left + t[0], r.top + t[1], r.width, r.height);
  }
  resizeWithKeyboard(e) {
    const t = UT[e.key];
    if (!this.editing || !t || e.target !== this.resizeHandle) return;
    e.preventDefault();
    const i = this.buttons.get(this.selected).getBoundingClientRect(),
      r = $T(i.width, i.height, t[0], t[1]);
    this.place(this.selected, i.left, i.top, r.width, r.height);
  }
  place(e, t, i, r, s) {
    const o = {
      x: Math.min(1, Math.max(0, t / Math.max(1, window.innerWidth - r))),
      y: Math.min(1, Math.max(0, i / Math.max(1, window.innerHeight - s))),
      width: r,
      height: s,
    };
    ((this.draft[e] = o),
      WT(this.buttons.get(e), o),
      this.editing && e === this.selected && this.positionResizeHandle());
  }
  positionResizeHandle() {
    const e = this.buttons.get(this.selected).getBoundingClientRect();
    ((this.resizeHandle.style.left = `${e.right}px`),
      (this.resizeHandle.style.top = `${e.bottom}px`));
  }
  apply(e) {
    for (const [t, i] of this.buttons) WT(i, e[t]);
  }
}

function $T(n, e, t, i) {
  return {
    width: Math.min(144, Math.max(44, n + t)),
    height: Math.min(144, Math.max(44, e + i)),
  };
}

function WT(n, e) {
  if ((n.classList.toggle("touch-positioned", !!e), !e)) {
    for (const o of [
      "position",
      "left",
      "top",
      "transform",
      "--touch-key-width",
      "--touch-key-height",
    ])
      n.style.removeProperty(o);
    return;
  }
  const { x: t, y: i, width: r, height: s } = e;
  ((n.style.position = "fixed"),
    (n.style.left = HT(t, r)),
    (n.style.top = HT(i, s)),
    (n.style.transform = "none"),
    n.style.setProperty("--touch-key-width", `${r}px`),
    n.style.setProperty("--touch-key-height", `${s}px`));
}

function HT(n, e) {
  return `clamp(0px, calc(${n * 100}% - ${n * e}px), max(0px, calc(100% - ${e}px)))`;
}

function s60(n, e) {
  try {
    const t = JSON.parse(n);
    if (!Ay(t)) return {};
    const i = {};
    for (const r of e) {
      const s = a60(t[r]);
      s && (i[r] = s);
    }
    return i;
  } catch {
    return {};
  }
}

function Ay(n) {
  return typeof n == "object" && n !== null && !Array.isArray(n);
}

function o60(n) {
  return (
    Ay(n) &&
    _c(n.x, 0, 1) &&
    _c(n.y, 0, 1) &&
    _c(n.width, 44, 144) &&
    _c(n.height, 44, 144)
  );
}

function a60(n) {
  if (!Ay(n)) return;
  const e = {
    x: n.x,
    y: n.y,
    width: n.width === void 0 ? n.size : n.width,
    height: n.height === void 0 ? n.size : n.height,
  };
  return o60(e) ? e : void 0;
}

function _c(n, e, t) {
  return typeof n == "number" && Number.isFinite(n) && n >= e && n <= t;
}

const BF = "kartsim.auto-forward",
  RF = "kartsim.nitro-seamless",
  c60 = { auto: "自动", manual: "手动", off: "关" },
  Af = ["auto", "manual", "off"],
  T5 = {
    arrow: Mi('<path d="M12 20V4m-7 7 7-7 7 7"/>'),
    drift: Mi(
      '<g transform="rotate(-18 12 10)"><path d="m6 10 2-6h8l2 6M5 10h14v6H5Zm2 6v2m10-2v2M8 13h1m6 0h1"/></g><path d="M6 20c-3 1 2 1 0 3m7-4c-3 1 2 2 0 3"/>',
    ),
    booster: Mi(
      '<path d="M13 2c1 6-5 7-3 12 2-1 3-3 3-5 4 3 6 6 5 9a7 7 0 0 1-13-1c-1-5 3-7 3-10 1 1 1 2 1 3 3-2 4-5 4-8Z"/>',
    ),
    overload: Mi('<path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/>'),
    pause: Mi('<path d="M8 5v14M16 5v14"/>'),
    reset: Mi('<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>'),
  };

class l60 {
  constructor(e, t, i, r = () => {}, s = () => {}) {
    ((this.root = e),
      (this.onAction = t),
      (this.onPause = i),
      (this.onAutoForwardChange = r),
      (this.onNitroSeamlessChange = s),
      (this.element.className = "touch-controls"),
      (this.element.dataset.uiLayer = "controls"),
      this.element.setAttribute("aria-label", "触屏驾驶"),
      (this.element.innerHTML = `
      <button type="button" class="touch-sim" data-touch="menu" aria-label="打开模拟器菜单"
        aria-haspopup="dialog" aria-controls="touch-menu" aria-expanded="false">SIM</button>
      <dialog class="touch-menu" id="touch-menu" aria-label="模拟器菜单">
        <div class="touch-menu-actions">
          <button type="button" data-touch="toggle" aria-pressed="false"></button>
          <button type="button" data-touch="auto-forward" aria-pressed="false"></button>
          <p class="touch-auto-forward-status" role="status"></p>
          <button type="button" data-touch="nitro-seamless" aria-pressed="false"></button>
          <p class="touch-auto-forward-status" data-touch="nitro-seamless-status" role="status"></p>
          <button type="button" data-touch="pause"></button>
          <button type="button" data-touch="screen"></button>
          <button type="button" data-touch="layout">调整按键</button>
          <div class="touch-ghost-menu" data-touch="ghost-slot"></div>
          <button type="button" data-touch="close-menu" autofocus>返回</button>
        </div>
        <aside class="touch-screen-help" hidden aria-label="全屏打开说明">
          <p role="status"></p>
          <button type="button" data-touch="close-help">关闭说明</button>
        </aside>
      </dialog>
      <div class="touch-pad">
        <div class="touch-race-actions" role="group" aria-label="暂停和复位">
          <button type="button" data-drive="pause" data-action-name="暂停">${T5.pause}</button>
          <button type="button" data-drive="${l2.Reset}" data-action-name="复位">${T5.reset}</button>
        </div>
        <div class="touch-modifiers" role="group" aria-label="漂移、氮气和超负荷">
          <button type="button" data-drive="${l2.Drift}" data-action-name="漂移">${T5.drift}</button>
          <button type="button" data-drive="${l2.UseItemOrBooster}" data-action-name="氮气">${T5.booster}</button>
          <button type="button" data-drive="${l2.GaugeState}" data-action-name="释放超负荷" class="touch-overload">${T5.overload}</button>
        </div>
        <div class="touch-arrows" role="group" aria-label="方向键">
          <button type="button" data-drive="${l2.Forward}" data-action-name="前进" class="touch-up">${T5.arrow}<span class="touch-auto-forward" aria-hidden="true">AUTO</span></button>
          <button type="button" data-drive="${l2.SteerLeft}" data-action-name="左转" class="touch-left">${T5.arrow}<span class="touch-dodge-key" aria-hidden="true" hidden>Z</span></button>
          <button type="button" data-drive="${l2.Reverse}" data-action-name="后退" class="touch-down">${T5.arrow}</button>
          <button type="button" data-drive="${l2.SteerRight}" data-action-name="右转" class="touch-right">${T5.arrow}<span class="touch-dodge-key" aria-hidden="true" hidden>X</span></button>
        </div>
      </div>`),
      (this.menuButton = this.element.querySelector("[data-touch='menu']")),
      (this.menu = this.element.querySelector(".touch-menu")),
      (this.toggle = this.element.querySelector("[data-touch='toggle']")),
      (this.autoForwardToggle = this.element.querySelector(
        "[data-touch='auto-forward']",
      )),
      (this.autoForwardMessage = this.element.querySelector(
        ".touch-auto-forward-status",
      )),
      (this.nitroSeamlessToggle = this.element.querySelector(
        "[data-touch='nitro-seamless']",
      )),
      (this.nitroSeamlessMessage = this.element.querySelector(
        "[data-touch='nitro-seamless-status']",
      )),
      (this.pause = this.element.querySelector("[data-touch='pause']")),
      (this.screen = this.element.querySelector("[data-touch='screen']")),
      (this.screenHelp = this.element.querySelector(".touch-screen-help")),
      (this.screenMessage = this.screenHelp.querySelector("p")),
      (this.pad = this.element.querySelector(".touch-pad")),
      (this.ghostMenuSlot = this.element.querySelector(
        "[data-touch='ghost-slot']",
      )),
      this.element
        .querySelectorAll("[data-drive]")
        .forEach((c) => this.bindButton(c)),
      this.setKeyMap(this.keyMap),
      (this.menuButton.dataset.actionName = "SIM 菜单"));
    const o = new Map(this.buttons);
    (o.set("menu", this.menuButton),
      (this.layout = new r60(this.menu, this.pad, o, () => this.refresh())));
    const a = { signal: this.listeners.signal };
    (this.menuButton.addEventListener(
      "click",
      () => {
        this.layout.isEditing || (this.menu.showModal(), this.refresh());
      },
      a,
    ),
      this.menu.addEventListener(
        "close",
        () => {
          (this.layout.cancel(), (this.screenHelp.hidden = !0), this.refresh());
        },
        a,
      ),
      this.menu.addEventListener("keydown", (c) => c.stopPropagation(), a),
      this.element
        .querySelector("[data-touch='close-menu']")
        .addEventListener("click", () => this.menu.close(), a),
      this.toggle.addEventListener("click", this.onToggle, a),
      this.autoForwardToggle.addEventListener(
        "click",
        this.onAutoForwardToggle,
        a,
      ),
      this.nitroSeamlessToggle.addEventListener(
        "click",
        this.onNitroSeamlessToggle,
        a,
      ),
      this.pause.addEventListener(
        "click",
        () => {
          (this.menu.close(), this.onPause());
        },
        a,
      ),
      this.screen.addEventListener("click", this.onScreen, a),
      this.element
        .querySelector("[data-touch='layout']")
        .addEventListener("click", () => this.layout.start(), a),
      this.element.querySelector("[data-touch='close-help']").addEventListener(
        "click",
        () => {
          this.screenHelp.hidden = !0;
        },
        a,
      ),
      this.element.addEventListener(
        "contextmenu",
        (c) => c.preventDefault(),
        a,
      ),
      this.element.addEventListener(
        "selectstart",
        (c) => c.preventDefault(),
        a,
      ),
      this.pad.addEventListener("touchstart", (c) => c.preventDefault(), {
        ...a,
        passive: !1,
      }),
      document.addEventListener("touchend", this.onTouchEnd, a),
      document.addEventListener("touchcancel", this.onTouchEnd, a),
      this.root.addEventListener("pointerdown", this.onTouch, a),
      window.addEventListener("keydown", this.onKeyDown, a),
      window.addEventListener("blur", this.releaseAll, a),
      document.addEventListener("visibilitychange", this.onVisibilityChange, a),
      document.addEventListener("fullscreenchange", this.onFullscreenChange, a),
      this.coarsePointer.addEventListener("change", this.onPointerChange, a),
      this.root.ownerDocument.body.append(this.element),
      this.refresh());
  }
  root;
  onAction;
  onPause;
  onAutoForwardChange;
  onNitroSeamlessChange;
  element = document.createElement("section");
  buttons = new Map();
  pointers = new Map();
  touchPointers = new Set();
  listeners = new AbortController();
  coarsePointer = window.matchMedia("(pointer: coarse)");
  menuButton;
  menu;
  toggle;
  autoForwardToggle;
  autoForwardMessage;
  nitroSeamlessToggle;
  nitroSeamlessMessage;
  pause;
  screen;
  screenHelp;
  screenMessage;
  pad;
  layout;
  ghostMenuSlot;
  touchCapable = navigator.maxTouchPoints > 0;
  usingTouch = this.touchCapable && this.coarsePointer.matches;
  usingGamepad = !1;
  manualVisible;
  available = !1;
  paused = !1;
  lteDodge = !1;
  autoForward = u60();
  nitroSeamless = h60();
  autoForwardAllowed = !1;
  autoForwardSuspended = document.hidden;
  keyMap = Br;
  setRaceState(e, t, i = !1) {
    if (!(this.available === e && this.paused === t && this.lteDodge === i)) {
      if (this.lteDodge !== i) {
        for (const [r, s] of [...this.pointers])
          (s === l2.SteerLeft || s === l2.SteerRight) && this.releasePointer(r);
        ((this.lteDodge = i), this.setKeyMap(this.keyMap));
      }
      ((this.available = e), (this.paused = t), this.refresh());
    }
  }
  setKeyMap(e) {
    this.keyMap = e;
    for (const [t, i] of this.buttons) {
      const r = ut
          .filter((c) => c.action === t)
          .filter(
            ({ index: c }) => !this.lteDodge || (e[c] !== 44 && e[c] !== 45),
          )
          .map(({ index: c }) => SP(e[c]))
          .filter(Boolean),
        s = t === l2.SteerLeft || t === l2.SteerRight;
      s &&
        ((i.dataset.actionName = this.lteDodge
          ? t === l2.SteerLeft
            ? "左躲闪"
            : "右躲闪"
          : t === l2.SteerLeft
            ? "左转"
            : "右转"),
        (i.querySelector(".touch-dodge-key").hidden = !this.lteDodge));
      const o =
          this.lteDodge && s
            ? t === l2.SteerLeft
              ? "Z"
              : "X"
            : t === "pause"
              ? "Esc"
              : [...new Set(r)].join(" / "),
        a = i.dataset.actionName;
      ((i.title = o ? `${a}（${o}）` : a),
        i.setAttribute("aria-label", i.title));
    }
  }
  getNitroSeamlessMode() {
    return this.nitroSeamless;
  }
  setAutoForwardActive(e) {
    const t = this.buttons.get(l2.Forward);
    t.classList.contains("is-auto-forward") !== e &&
      (t.classList.toggle("is-auto-forward", e),
      e
        ? t.setAttribute("aria-description", "自动前进中")
        : t.removeAttribute("aria-description"));
  }
  resumeAutoForwardForGamepad() {
    !this.autoForward ||
      !this.available ||
      this.paused ||
      this.menu.open ||
      this.layout.isEditing ||
      ((this.usingGamepad = !0),
      (this.autoForwardSuspended = !1),
      this.refreshAutoForward(this.manualVisible ?? this.usingTouch));
  }
  releaseAll = () => {
    this.suspendAutoForward();
    for (const e of [...this.pointers.keys()]) this.releasePointer(e);
  };
  dispose() {
    (this.releaseAll(),
      this.listeners.abort(),
      this.layout.dispose(),
      this.menu.close(),
      this.element.remove());
  }
  bindButton(e) {
    const t = i60(e.dataset.drive);
    (this.buttons.set(t, e), e.setAttribute("aria-pressed", "false"));
    const i = { signal: this.listeners.signal };
    e.addEventListener(
      "pointerdown",
      (s) => {
        if (s.button !== 0 || this.pad.hidden || this.layout.isEditing) return;
        (s.preventDefault(),
          this.useVirtualInput(),
          e.setPointerCapture(s.pointerId));
        const o = [...this.pointers.values()].includes(t);
        (this.pointers.set(s.pointerId, t),
          s.pointerType === "touch" && this.touchPointers.add(s.pointerId),
          !o &&
            (e.setAttribute("aria-pressed", "true"),
            this.dispatchAction(t, !0)));
      },
      i,
    );
    const r = (s) => this.releasePointer(s.pointerId);
    (e.addEventListener("pointerup", r, i),
      e.addEventListener("pointercancel", r, i),
      e.addEventListener("lostpointercapture", r, i));
  }
  releasePointer(e) {
    const t = this.pointers.get(e);
    if (t === void 0) return;
    (this.pointers.delete(e), this.touchPointers.delete(e));
    const i = this.buttons.get(t);
    (i.hasPointerCapture(e) && i.releasePointerCapture(e),
      ![...this.pointers.values()].includes(t) &&
        (i.setAttribute("aria-pressed", "false"), this.dispatchAction(t, !1)));
  }
  dispatchAction(e, t) {
    if (e === "pause") t && this.onPause();
    else {
      const i = this.lteDodge
        ? e === l2.SteerLeft
          ? l2.ModeImpulsePositive
          : e === l2.SteerRight
            ? l2.ModeImpulseNegative
            : e
        : e;
      this.onAction(i, t);
    }
  }
  onTouchEnd = (e) => {
    if (e.touches.length === 0)
      for (const t of this.touchPointers) this.releasePointer(t);
  };
  refresh() {
    this.element.hidden = !this.touchCapable;
    const e = this.manualVisible ?? this.usingTouch;
    (this.refreshPad(e),
      this.refreshAutoForward(e),
      this.menuButton.setAttribute("aria-expanded", String(this.menu.open)),
      (this.toggle.hidden = !this.available),
      (this.pause.hidden = !this.available),
      (this.toggle.textContent = e ? "隐藏按键" : "显示按键"),
      this.toggle.setAttribute("aria-pressed", String(e)),
      (this.autoForwardToggle.innerHTML = `自动前进<span>：${this.autoForward ? "开" : "关"}</span>`),
      this.autoForwardToggle.setAttribute(
        "aria-pressed",
        String(this.autoForward),
      ),
      (this.nitroSeamlessToggle.innerHTML = `氮气无缝<span>：${c60[this.nitroSeamless]}</span>`),
      this.nitroSeamlessToggle.setAttribute(
        "aria-pressed",
        String(this.nitroSeamless !== "off"),
      ),
      (this.pause.textContent = this.paused ? "继续" : "暂停"),
      this.onFullscreenChange());
  }
  refreshPad(e) {
    ((this.pad.hidden = !(this.layout.isEditing || this.drivingPadVisible(e))),
      this.pad.hidden && this.releaseAll());
  }
  drivingPadVisible(e) {
    return (
      this.touchCapable &&
      this.available &&
      !this.paused &&
      e &&
      !this.menu.open
    );
  }
  refreshAutoForward(e) {
    const t = this.usingTouch && this.drivingPadVisible(e),
      i =
        this.usingGamepad && this.available && !this.paused && !this.menu.open;
    this.setAutoForwardAllowed(
      this.autoForward &&
        !this.autoForwardSuspended &&
        !this.layout.isEditing &&
        (t || i),
    );
  }
  setAutoForwardAllowed(e) {
    this.autoForwardAllowed !== e &&
      ((this.autoForwardAllowed = e),
      e || this.setAutoForwardActive(!1),
      this.onAutoForwardChange(e));
  }
  suspendAutoForward() {
    ((this.autoForwardSuspended = !0), this.setAutoForwardAllowed(!1));
  }
  useVirtualInput() {
    ((this.usingGamepad = !1),
      (this.usingTouch = !0),
      (this.autoForwardSuspended = !1),
      this.refresh());
  }
  onAutoForwardToggle = () => {
    ((this.autoForward = !this.autoForward),
      (this.autoForwardMessage.textContent = ""));
    try {
      localStorage.setItem(BF, String(this.autoForward));
    } catch {
      this.autoForwardMessage.textContent = "自动前进设置未保存，仅本次有效。";
    }
    this.refresh();
  };
  onNitroSeamlessToggle = () => {
    const e = Af.indexOf(this.nitroSeamless);
    ((this.nitroSeamless = Af[(e + 1) % Af.length]),
      (this.nitroSeamlessMessage.textContent = ""));
    try {
      localStorage.setItem(RF, this.nitroSeamless);
    } catch {
      this.nitroSeamlessMessage.textContent =
        "氮气无缝设置未保存，仅本次有效。";
    }
    (this.onNitroSeamlessChange(this.nitroSeamless), this.refresh());
  };
  onScreen = async () => {
    this.screenHelp.hidden = !0;
    try {
      document.fullscreenElement
        ? await document.exitFullscreen()
        : document.fullscreenEnabled
          ? await document.documentElement.requestFullscreen({
              navigationUI: "hide",
            })
          : this.showScreenHelp("当前浏览器不支持页面全屏。");
    } catch {
      this.showScreenHelp("浏览器未允许切换全屏。");
    }
  };
  showScreenHelp(e) {
    ((this.screenMessage.textContent = `${e}可通过浏览器的分享或菜单选择“添加到主屏幕”或“安装应用”，再从图标打开。若有“作为网页 App 打开”选项，请开启。`),
      (this.screenHelp.hidden = !1));
  }
  onFullscreenChange = () => {
    const e = !!document.fullscreenElement;
    this.screen.textContent = e ? "退出全屏" : "全屏";
    const t = navigator.standalone;
    this.screen.hidden =
      !e &&
      !!(
        t ||
        window.matchMedia(
          "(display-mode: standalone), (display-mode: fullscreen)",
        ).matches
      );
  };
  onToggle = () => {
    ((this.manualVisible = !(this.manualVisible ?? this.usingTouch)),
      this.menu.close(),
      this.refresh());
  };
  onTouch = (e) => {
    e.pointerType !== "touch" ||
      this.element.contains(e.target) ||
      ((this.touchCapable = !0), this.useVirtualInput());
  };
  onKeyDown = (e) => {
    e.repeat ||
      xl(e.code, this.keyMap).length === 0 ||
      (e.target instanceof HTMLElement &&
        e.target.closest("input, textarea, select, [contenteditable]")) ||
      ((this.usingGamepad = !1),
      (this.usingTouch = !1),
      this.suspendAutoForward(),
      this.refresh());
  };
  onPointerChange = () => {
    ((this.usingTouch = this.touchCapable && this.coarsePointer.matches),
      this.refresh());
  };
  onVisibilityChange = () => {
    document.hidden && this.releaseAll();
  };
}

function Mi(n) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${n}</svg>`;
}

function u60() {
  try {
    return localStorage.getItem(BF) === "true";
  } catch {
    return !1;
  }
}

function h60() {
  try {
    const n = localStorage.getItem(RF);
    return n === "auto" || n === "manual" || n === "off" ? n : "off";
  } catch {
    return "off";
  }
}

const d60 = 4,
  qT = 0,
  KT = 1,
  f60 = 2;

function Rr(n) {
  let e = n.length;
  for (; --e >= 0;) n[e] = 0;
}

const p60 = 0,
  IF = 1,
  g60 = 2,
  m60 = 3,
  w60 = 258,
  by = 29,
  Ba = 256,
  Yo = Ba + 1 + by,
  nr = 30,
  My = 19,
  kF = 2 * Yo + 1,
  a4 = 15,
  bf = 16,
  v60 = 7,
  xy = 256,
  LF = 16,
  PF = 17,
  FF = 18,
  rm = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5,
    5, 5, 5, 0,
  ]),
  Sl = new Uint8Array([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
    11, 11, 12, 12, 13, 13,
  ]),
  y60 = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7,
  ]),
  DF = new Uint8Array([
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
  ]),
  A60 = 512,
  D5 = new Array((Yo + 2) * 2);

Rr(D5);

const eo = new Array(nr * 2);

Rr(eo);

const Zo = new Array(A60);

Rr(Zo);

const Qo = new Array(w60 - m60 + 1);

Rr(Qo);

const Sy = new Array(by);

Rr(Sy);

const E6 = new Array(nr);

Rr(E6);

function Mf(n, e, t, i, r) {
  ((this.static_tree = n),
    (this.extra_bits = e),
    (this.extra_base = t),
    (this.elems = i),
    (this.max_length = r),
    (this.has_stree = n && n.length));
}

let VF, NF, OF;

function xf(n, e) {
  ((this.dyn_tree = n), (this.max_code = 0), (this.stat_desc = e));
}

const zF = (n) => (n < 256 ? Zo[n] : Zo[256 + (n >>> 7)]),
  Jo = (n, e) => {
    ((n.pending_buf[n.pending++] = e & 255),
      (n.pending_buf[n.pending++] = (e >>> 8) & 255));
  },
  be = (n, e, t) => {
    n.bi_valid > bf - t
      ? ((n.bi_buf |= (e << n.bi_valid) & 65535),
        Jo(n, n.bi_buf),
        (n.bi_buf = e >> (bf - n.bi_valid)),
        (n.bi_valid += t - bf))
      : ((n.bi_buf |= (e << n.bi_valid) & 65535), (n.bi_valid += t));
  },
  Jt = (n, e, t) => {
    be(n, t[e * 2], t[e * 2 + 1]);
  },
  UF = (n, e) => {
    let t = 0;
    do ((t |= n & 1), (n >>>= 1), (t <<= 1));
    while (--e > 0);
    return t >>> 1;
  },
  b60 = (n) => {
    n.bi_valid === 16
      ? (Jo(n, n.bi_buf), (n.bi_buf = 0), (n.bi_valid = 0))
      : n.bi_valid >= 8 &&
        ((n.pending_buf[n.pending++] = n.bi_buf & 255),
        (n.bi_buf >>= 8),
        (n.bi_valid -= 8));
  },
  M60 = (n, e) => {
    const t = e.dyn_tree,
      i = e.max_code,
      r = e.stat_desc.static_tree,
      s = e.stat_desc.has_stree,
      o = e.stat_desc.extra_bits,
      a = e.stat_desc.extra_base,
      c = e.stat_desc.max_length;
    let l,
      u,
      h,
      d,
      f,
      p,
      v = 0;
    for (d = 0; d <= a4; d++) n.bl_count[d] = 0;
    for (t[n.heap[n.heap_max] * 2 + 1] = 0, l = n.heap_max + 1; l < kF; l++)
      ((u = n.heap[l]),
        (d = t[t[u * 2 + 1] * 2 + 1] + 1),
        d > c && ((d = c), v++),
        (t[u * 2 + 1] = d),
        !(u > i) &&
          (n.bl_count[d]++,
          (f = 0),
          u >= a && (f = o[u - a]),
          (p = t[u * 2]),
          (n.opt_len += p * (d + f)),
          s && (n.static_len += p * (r[u * 2 + 1] + f))));
    if (v !== 0) {
      do {
        for (d = c - 1; n.bl_count[d] === 0;) d--;
        (n.bl_count[d]--, (n.bl_count[d + 1] += 2), n.bl_count[c]--, (v -= 2));
      } while (v > 0);
      for (d = c; d !== 0; d--)
        for (u = n.bl_count[d]; u !== 0;)
          ((h = n.heap[--l]),
            !(h > i) &&
              (t[h * 2 + 1] !== d &&
                ((n.opt_len += (d - t[h * 2 + 1]) * t[h * 2]),
                (t[h * 2 + 1] = d)),
              u--));
    }
  },
  $F = (n, e, t) => {
    const i = new Array(a4 + 1);
    let r = 0,
      s,
      o;
    for (s = 1; s <= a4; s++) ((r = (r + t[s - 1]) << 1), (i[s] = r));
    for (o = 0; o <= e; o++) {
      let a = n[o * 2 + 1];
      a !== 0 && (n[o * 2] = UF(i[a]++, a));
    }
  },
  x60 = () => {
    let n, e, t, i, r;
    const s = new Array(a4 + 1);
    for (t = 0, i = 0; i < by - 1; i++)
      for (Sy[i] = t, n = 0; n < 1 << rm[i]; n++) Qo[t++] = i;
    for (Qo[t - 1] = i, r = 0, i = 0; i < 16; i++)
      for (E6[i] = r, n = 0; n < 1 << Sl[i]; n++) Zo[r++] = i;
    for (r >>= 7; i < nr; i++)
      for (E6[i] = r << 7, n = 0; n < 1 << (Sl[i] - 7); n++) Zo[256 + r++] = i;
    for (e = 0; e <= a4; e++) s[e] = 0;
    for (n = 0; n <= 143;) ((D5[n * 2 + 1] = 8), n++, s[8]++);
    for (; n <= 255;) ((D5[n * 2 + 1] = 9), n++, s[9]++);
    for (; n <= 279;) ((D5[n * 2 + 1] = 7), n++, s[7]++);
    for (; n <= 287;) ((D5[n * 2 + 1] = 8), n++, s[8]++);
    for ($F(D5, Yo + 1, s), n = 0; n < nr; n++)
      ((eo[n * 2 + 1] = 5), (eo[n * 2] = UF(n, 5)));
    ((VF = new Mf(D5, rm, Ba + 1, Yo, a4)),
      (NF = new Mf(eo, Sl, 0, nr, a4)),
      (OF = new Mf(new Array(0), y60, 0, My, v60)));
  },
  WF = (n) => {
    let e;
    for (e = 0; e < Yo; e++) n.dyn_ltree[e * 2] = 0;
    for (e = 0; e < nr; e++) n.dyn_dtree[e * 2] = 0;
    for (e = 0; e < My; e++) n.bl_tree[e * 2] = 0;
    ((n.dyn_ltree[xy * 2] = 1),
      (n.opt_len = n.static_len = 0),
      (n.sym_next = n.matches = 0));
  },
  HF = (n) => {
    (n.bi_valid > 8
      ? Jo(n, n.bi_buf)
      : n.bi_valid > 0 && (n.pending_buf[n.pending++] = n.bi_buf),
      (n.bi_buf = 0),
      (n.bi_valid = 0));
  },
  jT = (n, e, t, i) => {
    const r = e * 2,
      s = t * 2;
    return n[r] < n[s] || (n[r] === n[s] && i[e] <= i[t]);
  },
  Sf = (n, e, t) => {
    const i = n.heap[t];
    let r = t << 1;
    for (
      ;
      r <= n.heap_len &&
      (r < n.heap_len && jT(e, n.heap[r + 1], n.heap[r], n.depth) && r++,
      !jT(e, i, n.heap[r], n.depth));
    )
      ((n.heap[t] = n.heap[r]), (t = r), (r <<= 1));
    n.heap[t] = i;
  },
  XT = (n, e, t) => {
    let i,
      r,
      s = 0,
      o,
      a;
    if (n.sym_next !== 0)
      do
        ((i = n.pending_buf[n.sym_buf + s++] & 255),
          (i += (n.pending_buf[n.sym_buf + s++] & 255) << 8),
          (r = n.pending_buf[n.sym_buf + s++]),
          i === 0
            ? Jt(n, r, e)
            : ((o = Qo[r]),
              Jt(n, o + Ba + 1, e),
              (a = rm[o]),
              a !== 0 && ((r -= Sy[o]), be(n, r, a)),
              i--,
              (o = zF(i)),
              Jt(n, o, t),
              (a = Sl[o]),
              a !== 0 && ((i -= E6[o]), be(n, i, a))));
      while (s < n.sym_next);
    Jt(n, xy, e);
  },
  sm = (n, e) => {
    const t = e.dyn_tree,
      i = e.stat_desc.static_tree,
      r = e.stat_desc.has_stree,
      s = e.stat_desc.elems;
    let o,
      a,
      c = -1,
      l;
    for (n.heap_len = 0, n.heap_max = kF, o = 0; o < s; o++)
      t[o * 2] !== 0
        ? ((n.heap[++n.heap_len] = c = o), (n.depth[o] = 0))
        : (t[o * 2 + 1] = 0);
    for (; n.heap_len < 2;)
      ((l = n.heap[++n.heap_len] = c < 2 ? ++c : 0),
        (t[l * 2] = 1),
        (n.depth[l] = 0),
        n.opt_len--,
        r && (n.static_len -= i[l * 2 + 1]));
    for (e.max_code = c, o = n.heap_len >> 1; o >= 1; o--) Sf(n, t, o);
    l = s;
    do
      ((o = n.heap[1]),
        (n.heap[1] = n.heap[n.heap_len--]),
        Sf(n, t, 1),
        (a = n.heap[1]),
        (n.heap[--n.heap_max] = o),
        (n.heap[--n.heap_max] = a),
        (t[l * 2] = t[o * 2] + t[a * 2]),
        (n.depth[l] = (n.depth[o] >= n.depth[a] ? n.depth[o] : n.depth[a]) + 1),
        (t[o * 2 + 1] = t[a * 2 + 1] = l),
        (n.heap[1] = l++),
        Sf(n, t, 1));
    while (n.heap_len >= 2);
    ((n.heap[--n.heap_max] = n.heap[1]), M60(n, e), $F(t, c, n.bl_count));
  },
  YT = (n, e, t) => {
    let i,
      r = -1,
      s,
      o = e[1],
      a = 0,
      c = 7,
      l = 4;
    for (
      o === 0 && ((c = 138), (l = 3)), e[(t + 1) * 2 + 1] = 65535, i = 0;
      i <= t;
      i++
    )
      ((s = o),
        (o = e[(i + 1) * 2 + 1]),
        !(++a < c && s === o) &&
          (a < l
            ? (n.bl_tree[s * 2] += a)
            : s !== 0
              ? (s !== r && n.bl_tree[s * 2]++, n.bl_tree[LF * 2]++)
              : a <= 10
                ? n.bl_tree[PF * 2]++
                : n.bl_tree[FF * 2]++,
          (a = 0),
          (r = s),
          o === 0
            ? ((c = 138), (l = 3))
            : s === o
              ? ((c = 6), (l = 3))
              : ((c = 7), (l = 4))));
  },
  ZT = (n, e, t) => {
    let i,
      r = -1,
      s,
      o = e[1],
      a = 0,
      c = 7,
      l = 4;
    for (o === 0 && ((c = 138), (l = 3)), i = 0; i <= t; i++)
      if (((s = o), (o = e[(i + 1) * 2 + 1]), !(++a < c && s === o))) {
        if (a < l)
          do Jt(n, s, n.bl_tree);
          while (--a !== 0);
        else
          s !== 0
            ? (s !== r && (Jt(n, s, n.bl_tree), a--),
              Jt(n, LF, n.bl_tree),
              be(n, a - 3, 2))
            : a <= 10
              ? (Jt(n, PF, n.bl_tree), be(n, a - 3, 3))
              : (Jt(n, FF, n.bl_tree), be(n, a - 11, 7));
        ((a = 0),
          (r = s),
          o === 0
            ? ((c = 138), (l = 3))
            : s === o
              ? ((c = 6), (l = 3))
              : ((c = 7), (l = 4)));
      }
  },
  S60 = (n) => {
    let e;
    for (
      YT(n, n.dyn_ltree, n.l_desc.max_code),
        YT(n, n.dyn_dtree, n.d_desc.max_code),
        sm(n, n.bl_desc),
        e = My - 1;
      e >= 3 && n.bl_tree[DF[e] * 2 + 1] === 0;
      e--
    );
    return ((n.opt_len += 3 * (e + 1) + 5 + 5 + 4), e);
  },
  C60 = (n, e, t, i) => {
    let r;
    for (be(n, e - 257, 5), be(n, t - 1, 5), be(n, i - 4, 4), r = 0; r < i; r++)
      be(n, n.bl_tree[DF[r] * 2 + 1], 3);
    (ZT(n, n.dyn_ltree, e - 1), ZT(n, n.dyn_dtree, t - 1));
  },
  E60 = (n) => {
    let e = 4093624447,
      t;
    for (t = 0; t <= 31; t++, e >>>= 1)
      if (e & 1 && n.dyn_ltree[t * 2] !== 0) return qT;
    if (n.dyn_ltree[18] !== 0 || n.dyn_ltree[20] !== 0 || n.dyn_ltree[26] !== 0)
      return KT;
    for (t = 32; t < Ba; t++) if (n.dyn_ltree[t * 2] !== 0) return KT;
    return qT;
  };

let QT = !1;

const T60 = (n) => {
    (QT || (x60(), (QT = !0)),
      (n.l_desc = new xf(n.dyn_ltree, VF)),
      (n.d_desc = new xf(n.dyn_dtree, NF)),
      (n.bl_desc = new xf(n.bl_tree, OF)),
      (n.bi_buf = 0),
      (n.bi_valid = 0),
      WF(n));
  },
  qF = (n, e, t, i) => {
    (be(n, (p60 << 1) + (i ? 1 : 0), 3),
      HF(n),
      Jo(n, t),
      Jo(n, ~t),
      t && n.pending_buf.set(n.window.subarray(e, e + t), n.pending),
      (n.pending += t));
  },
  _60 = (n) => {
    (be(n, IF << 1, 3), Jt(n, xy, D5), b60(n));
  },
  G60 = (n, e, t, i) => {
    let r,
      s,
      o = 0;
    (n.level > 0
      ? (n.strm.data_type === f60 && (n.strm.data_type = E60(n)),
        sm(n, n.l_desc),
        sm(n, n.d_desc),
        (o = S60(n)),
        (r = (n.opt_len + 3 + 7) >>> 3),
        (s = (n.static_len + 3 + 7) >>> 3),
        s <= r && (r = s))
      : (r = s = t + 5),
      t + 4 <= r && e !== -1
        ? qF(n, e, t, i)
        : n.strategy === d60 || s === r
          ? (be(n, (IF << 1) + (i ? 1 : 0), 3), XT(n, D5, eo))
          : (be(n, (g60 << 1) + (i ? 1 : 0), 3),
            C60(n, n.l_desc.max_code + 1, n.d_desc.max_code + 1, o + 1),
            XT(n, n.dyn_ltree, n.dyn_dtree)),
      WF(n),
      i && HF(n));
  },
  B60 = (n, e, t) => (
    (n.pending_buf[n.sym_buf + n.sym_next++] = e),
    (n.pending_buf[n.sym_buf + n.sym_next++] = e >> 8),
    (n.pending_buf[n.sym_buf + n.sym_next++] = t),
    e === 0
      ? n.dyn_ltree[t * 2]++
      : (n.matches++,
        e--,
        n.dyn_ltree[(Qo[t] + Ba + 1) * 2]++,
        n.dyn_dtree[zF(e) * 2]++),
    n.sym_next === n.sym_end
  );

var R60 = T60,
  I60 = qF,
  k60 = G60,
  L60 = B60,
  P60 = _60,
  F60 = {
    _tr_init: R60,
    _tr_stored_block: I60,
    _tr_flush_block: k60,
    _tr_tally: L60,
    _tr_align: P60,
  };

const D60 = (n, e, t, i) => {
  let r = (n & 65535) | 0,
    s = ((n >>> 16) & 65535) | 0,
    o = 0;
  for (; t !== 0;) {
    ((o = t > 2e3 ? 2e3 : t), (t -= o));
    do ((r = (r + e[i++]) | 0), (s = (s + r) | 0));
    while (--o);
    ((r %= 65521), (s %= 65521));
  }
  return r | (s << 16) | 0;
};

var ea = D60;

const V60 = () => {
    let n,
      e = [];
    for (var t = 0; t < 256; t++) {
      n = t;
      for (var i = 0; i < 8; i++) n = n & 1 ? 3988292384 ^ (n >>> 1) : n >>> 1;
      e[t] = n;
    }
    return e;
  },
  N60 = new Uint32Array(V60()),
  O60 = (n, e, t, i) => {
    const r = N60,
      s = i + t;
    n ^= -1;
    for (let o = i; o < s; o++) n = (n >>> 8) ^ r[(n ^ e[o]) & 255];
    return n ^ -1;
  };

var k1 = O60,
  _4 = {
    2: "need dictionary",
    1: "stream end",
    0: "",
    "-1": "file error",
    "-2": "stream error",
    "-3": "data error",
    "-4": "insufficient memory",
    "-5": "buffer error",
    "-6": "incompatible version",
  },
  Ra = {
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    Z_BINARY: 0,
    Z_TEXT: 1,
    Z_UNKNOWN: 2,
    Z_DEFLATED: 8,
  };

const {
    _tr_init: z60,
    _tr_stored_block: om,
    _tr_flush_block: U60,
    _tr_tally: r3,
    _tr_align: $60,
  } = F60,
  {
    Z_NO_FLUSH: s3,
    Z_PARTIAL_FLUSH: W60,
    Z_FULL_FLUSH: H60,
    Z_FINISH: at,
    Z_BLOCK: JT,
    Z_OK: z1,
    Z_STREAM_END: e_,
    Z_STREAM_ERROR: i5,
    Z_DATA_ERROR: q60,
    Z_BUF_ERROR: Cf,
    Z_DEFAULT_COMPRESSION: K60,
    Z_FILTERED: j60,
    Z_HUFFMAN_ONLY: Gc,
    Z_RLE: X60,
    Z_FIXED: Y60,
    Z_DEFAULT_STRATEGY: Z60,
    Z_UNKNOWN: Q60,
    Z_DEFLATED: I7,
  } = Ra,
  J60 = 9,
  e70 = 15,
  t70 = 8,
  n70 = 29,
  i70 = 256,
  am = i70 + 1 + n70,
  r70 = 30,
  s70 = 19,
  o70 = 2 * am + 1,
  a70 = 15,
  i9 = 3,
  Zn = 258,
  r5 = Zn + i9 + 1,
  c70 = 32,
  mr = 42,
  Cy = 57,
  cm = 69,
  lm = 73,
  um = 91,
  hm = 103,
  c4 = 113,
  Gs = 666,
  ge = 1,
  Ir = 2,
  G4 = 3,
  kr = 4,
  l70 = 3,
  l4 = (n, e) => ((n.msg = _4[e]), e),
  t_ = (n) => n * 2 - (n > 4 ? 9 : 0),
  $n = (n) => {
    let e = n.length;
    for (; --e >= 0;) n[e] = 0;
  },
  u70 = (n) => {
    let e,
      t,
      i,
      r = n.w_size;
    ((e = n.hash_size), (i = e));
    do ((t = n.head[--i]), (n.head[i] = t >= r ? t - r : 0));
    while (--e);
    ((e = r), (i = e));
    do ((t = n.prev[--i]), (n.prev[i] = t >= r ? t - r : 0));
    while (--e);
  };

let h70 = (n, e, t) => ((e << n.hash_shift) ^ t) & n.hash_mask,
  o3 = h70;

const Pe = (n) => {
    const e = n.state;
    let t = e.pending;
    (t > n.avail_out && (t = n.avail_out),
      t !== 0 &&
        (n.output.set(
          e.pending_buf.subarray(e.pending_out, e.pending_out + t),
          n.next_out,
        ),
        (n.next_out += t),
        (e.pending_out += t),
        (n.total_out += t),
        (n.avail_out -= t),
        (e.pending -= t),
        e.pending === 0 && (e.pending_out = 0)));
  },
  $e = (n, e) => {
    (U60(
      n,
      n.block_start >= 0 ? n.block_start : -1,
      n.strstart - n.block_start,
      e,
    ),
      (n.block_start = n.strstart),
      Pe(n.strm));
  },
  p9 = (n, e) => {
    n.pending_buf[n.pending++] = e;
  },
  ps = (n, e) => {
    ((n.pending_buf[n.pending++] = (e >>> 8) & 255),
      (n.pending_buf[n.pending++] = e & 255));
  },
  dm = (n, e, t, i) => {
    let r = n.avail_in;
    return (
      r > i && (r = i),
      r === 0
        ? 0
        : ((n.avail_in -= r),
          e.set(n.input.subarray(n.next_in, n.next_in + r), t),
          n.state.wrap === 1
            ? (n.adler = ea(n.adler, e, r, t))
            : n.state.wrap === 2 && (n.adler = k1(n.adler, e, r, t)),
          (n.next_in += r),
          (n.total_in += r),
          r)
    );
  },
  KF = (n, e) => {
    let t = n.max_chain_length,
      i = n.strstart,
      r,
      s,
      o = n.prev_length,
      a = n.nice_match;
    const c = n.strstart > n.w_size - r5 ? n.strstart - (n.w_size - r5) : 0,
      l = n.window,
      u = n.w_mask,
      h = n.prev,
      d = n.strstart + Zn;
    let f = l[i + o - 1],
      p = l[i + o];
    (n.prev_length >= n.good_match && (t >>= 2),
      a > n.lookahead && (a = n.lookahead));
    do
      if (
        ((r = e),
        !(
          l[r + o] !== p ||
          l[r + o - 1] !== f ||
          l[r] !== l[i] ||
          l[++r] !== l[i + 1]
        ))
      ) {
        ((i += 2), r++);
        do;
        while (
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          i < d
        );
        if (((s = Zn - (d - i)), (i = d - Zn), s > o)) {
          if (((n.match_start = e), (o = s), s >= a)) break;
          ((f = l[i + o - 1]), (p = l[i + o]));
        }
      }
    while ((e = h[e & u]) > c && --t !== 0);
    return o <= n.lookahead ? o : n.lookahead;
  },
  wr = (n) => {
    const e = n.w_size;
    let t, i, r;
    do {
      if (
        ((i = n.window_size - n.lookahead - n.strstart),
        n.strstart >= e + (e - r5) &&
          (n.window.set(n.window.subarray(e, e + e - i), 0),
          (n.match_start -= e),
          (n.strstart -= e),
          (n.block_start -= e),
          n.insert > n.strstart && (n.insert = n.strstart),
          u70(n),
          (i += e)),
        n.strm.avail_in === 0)
      )
        break;
      if (
        ((t = dm(n.strm, n.window, n.strstart + n.lookahead, i)),
        (n.lookahead += t),
        n.lookahead + n.insert >= i9)
      )
        for (
          r = n.strstart - n.insert,
            n.ins_h = n.window[r],
            n.ins_h = o3(n, n.ins_h, n.window[r + 1]);
          n.insert &&
          ((n.ins_h = o3(n, n.ins_h, n.window[r + i9 - 1])),
          (n.prev[r & n.w_mask] = n.head[n.ins_h]),
          (n.head[n.ins_h] = r),
          r++,
          n.insert--,
          !(n.lookahead + n.insert < i9));
        );
    } while (n.lookahead < r5 && n.strm.avail_in !== 0);
  },
  jF = (n, e) => {
    let t =
        n.pending_buf_size - 5 > n.w_size ? n.w_size : n.pending_buf_size - 5,
      i,
      r,
      s,
      o = 0,
      a = n.strm.avail_in;
    do {
      if (
        ((i = 65535),
        (s = (n.bi_valid + 42) >> 3),
        n.strm.avail_out < s ||
          ((s = n.strm.avail_out - s),
          (r = n.strstart - n.block_start),
          i > r + n.strm.avail_in && (i = r + n.strm.avail_in),
          i > s && (i = s),
          i < t &&
            ((i === 0 && e !== at) || e === s3 || i !== r + n.strm.avail_in)))
      )
        break;
      ((o = e === at && i === r + n.strm.avail_in ? 1 : 0),
        om(n, 0, 0, o),
        (n.pending_buf[n.pending - 4] = i),
        (n.pending_buf[n.pending - 3] = i >> 8),
        (n.pending_buf[n.pending - 2] = ~i),
        (n.pending_buf[n.pending - 1] = ~i >> 8),
        Pe(n.strm),
        r &&
          (r > i && (r = i),
          n.strm.output.set(
            n.window.subarray(n.block_start, n.block_start + r),
            n.strm.next_out,
          ),
          (n.strm.next_out += r),
          (n.strm.avail_out -= r),
          (n.strm.total_out += r),
          (n.block_start += r),
          (i -= r)),
        i &&
          (dm(n.strm, n.strm.output, n.strm.next_out, i),
          (n.strm.next_out += i),
          (n.strm.avail_out -= i),
          (n.strm.total_out += i)));
    } while (o === 0);
    return (
      (a -= n.strm.avail_in),
      a &&
        (a >= n.w_size
          ? ((n.matches = 2),
            n.window.set(
              n.strm.input.subarray(n.strm.next_in - n.w_size, n.strm.next_in),
              0,
            ),
            (n.strstart = n.w_size),
            (n.insert = n.strstart))
          : (n.window_size - n.strstart <= a &&
              ((n.strstart -= n.w_size),
              n.window.set(
                n.window.subarray(n.w_size, n.w_size + n.strstart),
                0,
              ),
              n.matches < 2 && n.matches++,
              n.insert > n.strstart && (n.insert = n.strstart)),
            n.window.set(
              n.strm.input.subarray(n.strm.next_in - a, n.strm.next_in),
              n.strstart,
            ),
            (n.strstart += a),
            (n.insert += a > n.w_size - n.insert ? n.w_size - n.insert : a)),
        (n.block_start = n.strstart)),
      n.high_water < n.strstart && (n.high_water = n.strstart),
      o
        ? kr
        : e !== s3 &&
            e !== at &&
            n.strm.avail_in === 0 &&
            n.strstart === n.block_start
          ? Ir
          : ((s = n.window_size - n.strstart),
            n.strm.avail_in > s &&
              n.block_start >= n.w_size &&
              ((n.block_start -= n.w_size),
              (n.strstart -= n.w_size),
              n.window.set(
                n.window.subarray(n.w_size, n.w_size + n.strstart),
                0,
              ),
              n.matches < 2 && n.matches++,
              (s += n.w_size),
              n.insert > n.strstart && (n.insert = n.strstart)),
            s > n.strm.avail_in && (s = n.strm.avail_in),
            s &&
              (dm(n.strm, n.window, n.strstart, s),
              (n.strstart += s),
              (n.insert += s > n.w_size - n.insert ? n.w_size - n.insert : s)),
            n.high_water < n.strstart && (n.high_water = n.strstart),
            (s = (n.bi_valid + 42) >> 3),
            (s =
              n.pending_buf_size - s > 65535 ? 65535 : n.pending_buf_size - s),
            (t = s > n.w_size ? n.w_size : s),
            (r = n.strstart - n.block_start),
            (r >= t ||
              ((r || e === at) &&
                e !== s3 &&
                n.strm.avail_in === 0 &&
                r <= s)) &&
              ((i = r > s ? s : r),
              (o = e === at && n.strm.avail_in === 0 && i === r ? 1 : 0),
              om(n, n.block_start, i, o),
              (n.block_start += i),
              Pe(n.strm)),
            o ? G4 : ge)
    );
  },
  Ef = (n, e) => {
    let t, i;
    for (;;) {
      if (n.lookahead < r5) {
        if ((wr(n), n.lookahead < r5 && e === s3)) return ge;
        if (n.lookahead === 0) break;
      }
      if (
        ((t = 0),
        n.lookahead >= i9 &&
          ((n.ins_h = o3(n, n.ins_h, n.window[n.strstart + i9 - 1])),
          (t = n.prev[n.strstart & n.w_mask] = n.head[n.ins_h]),
          (n.head[n.ins_h] = n.strstart)),
        t !== 0 &&
          n.strstart - t <= n.w_size - r5 &&
          (n.match_length = KF(n, t)),
        n.match_length >= i9)
      )
        if (
          ((i = r3(n, n.strstart - n.match_start, n.match_length - i9)),
          (n.lookahead -= n.match_length),
          n.match_length <= n.max_lazy_match && n.lookahead >= i9)
        ) {
          n.match_length--;
          do
            (n.strstart++,
              (n.ins_h = o3(n, n.ins_h, n.window[n.strstart + i9 - 1])),
              (t = n.prev[n.strstart & n.w_mask] = n.head[n.ins_h]),
              (n.head[n.ins_h] = n.strstart));
          while (--n.match_length !== 0);
          n.strstart++;
        } else
          ((n.strstart += n.match_length),
            (n.match_length = 0),
            (n.ins_h = n.window[n.strstart]),
            (n.ins_h = o3(n, n.ins_h, n.window[n.strstart + 1])));
      else ((i = r3(n, 0, n.window[n.strstart])), n.lookahead--, n.strstart++);
      if (i && ($e(n, !1), n.strm.avail_out === 0)) return ge;
    }
    return (
      (n.insert = n.strstart < i9 - 1 ? n.strstart : i9 - 1),
      e === at
        ? ($e(n, !0), n.strm.avail_out === 0 ? G4 : kr)
        : n.sym_next && ($e(n, !1), n.strm.avail_out === 0)
          ? ge
          : Ir
    );
  },
  xi = (n, e) => {
    let t, i, r;
    for (;;) {
      if (n.lookahead < r5) {
        if ((wr(n), n.lookahead < r5 && e === s3)) return ge;
        if (n.lookahead === 0) break;
      }
      if (
        ((t = 0),
        n.lookahead >= i9 &&
          ((n.ins_h = o3(n, n.ins_h, n.window[n.strstart + i9 - 1])),
          (t = n.prev[n.strstart & n.w_mask] = n.head[n.ins_h]),
          (n.head[n.ins_h] = n.strstart)),
        (n.prev_length = n.match_length),
        (n.prev_match = n.match_start),
        (n.match_length = i9 - 1),
        t !== 0 &&
          n.prev_length < n.max_lazy_match &&
          n.strstart - t <= n.w_size - r5 &&
          ((n.match_length = KF(n, t)),
          n.match_length <= 5 &&
            (n.strategy === j60 ||
              (n.match_length === i9 && n.strstart - n.match_start > 4096)) &&
            (n.match_length = i9 - 1)),
        n.prev_length >= i9 && n.match_length <= n.prev_length)
      ) {
        ((r = n.strstart + n.lookahead - i9),
          (i = r3(n, n.strstart - 1 - n.prev_match, n.prev_length - i9)),
          (n.lookahead -= n.prev_length - 1),
          (n.prev_length -= 2));
        do
          ++n.strstart <= r &&
            ((n.ins_h = o3(n, n.ins_h, n.window[n.strstart + i9 - 1])),
            (t = n.prev[n.strstart & n.w_mask] = n.head[n.ins_h]),
            (n.head[n.ins_h] = n.strstart));
        while (--n.prev_length !== 0);
        if (
          ((n.match_available = 0),
          (n.match_length = i9 - 1),
          n.strstart++,
          i && ($e(n, !1), n.strm.avail_out === 0))
        )
          return ge;
      } else if (n.match_available) {
        if (
          ((i = r3(n, 0, n.window[n.strstart - 1])),
          i && $e(n, !1),
          n.strstart++,
          n.lookahead--,
          n.strm.avail_out === 0)
        )
          return ge;
      } else ((n.match_available = 1), n.strstart++, n.lookahead--);
    }
    return (
      n.match_available &&
        ((i = r3(n, 0, n.window[n.strstart - 1])), (n.match_available = 0)),
      (n.insert = n.strstart < i9 - 1 ? n.strstart : i9 - 1),
      e === at
        ? ($e(n, !0), n.strm.avail_out === 0 ? G4 : kr)
        : n.sym_next && ($e(n, !1), n.strm.avail_out === 0)
          ? ge
          : Ir
    );
  },
  d70 = (n, e) => {
    let t, i, r, s;
    const o = n.window;
    for (;;) {
      if (n.lookahead <= Zn) {
        if ((wr(n), n.lookahead <= Zn && e === s3)) return ge;
        if (n.lookahead === 0) break;
      }
      if (
        ((n.match_length = 0),
        n.lookahead >= i9 &&
          n.strstart > 0 &&
          ((r = n.strstart - 1),
          (i = o[r]),
          i === o[++r] && i === o[++r] && i === o[++r]))
      ) {
        s = n.strstart + Zn;
        do;
        while (
          i === o[++r] &&
          i === o[++r] &&
          i === o[++r] &&
          i === o[++r] &&
          i === o[++r] &&
          i === o[++r] &&
          i === o[++r] &&
          i === o[++r] &&
          r < s
        );
        ((n.match_length = Zn - (s - r)),
          n.match_length > n.lookahead && (n.match_length = n.lookahead));
      }
      if (
        (n.match_length >= i9
          ? ((t = r3(n, 1, n.match_length - i9)),
            (n.lookahead -= n.match_length),
            (n.strstart += n.match_length),
            (n.match_length = 0))
          : ((t = r3(n, 0, n.window[n.strstart])), n.lookahead--, n.strstart++),
        t && ($e(n, !1), n.strm.avail_out === 0))
      )
        return ge;
    }
    return (
      (n.insert = 0),
      e === at
        ? ($e(n, !0), n.strm.avail_out === 0 ? G4 : kr)
        : n.sym_next && ($e(n, !1), n.strm.avail_out === 0)
          ? ge
          : Ir
    );
  },
  f70 = (n, e) => {
    let t;
    for (;;) {
      if (n.lookahead === 0 && (wr(n), n.lookahead === 0)) {
        if (e === s3) return ge;
        break;
      }
      if (
        ((n.match_length = 0),
        (t = r3(n, 0, n.window[n.strstart])),
        n.lookahead--,
        n.strstart++,
        t && ($e(n, !1), n.strm.avail_out === 0))
      )
        return ge;
    }
    return (
      (n.insert = 0),
      e === at
        ? ($e(n, !0), n.strm.avail_out === 0 ? G4 : kr)
        : n.sym_next && ($e(n, !1), n.strm.avail_out === 0)
          ? ge
          : Ir
    );
  };

function Ut(n, e, t, i, r) {
  ((this.good_length = n),
    (this.max_lazy = e),
    (this.nice_length = t),
    (this.max_chain = i),
    (this.func = r));
}

const Bs = [
    new Ut(0, 0, 0, 0, jF),
    new Ut(4, 4, 8, 4, Ef),
    new Ut(4, 5, 16, 8, Ef),
    new Ut(4, 6, 32, 32, Ef),
    new Ut(4, 4, 16, 16, xi),
    new Ut(8, 16, 32, 32, xi),
    new Ut(8, 16, 128, 128, xi),
    new Ut(8, 32, 128, 256, xi),
    new Ut(32, 128, 258, 1024, xi),
    new Ut(32, 258, 258, 4096, xi),
  ],
  p70 = (n) => {
    ((n.window_size = 2 * n.w_size),
      $n(n.head),
      (n.max_lazy_match = Bs[n.level].max_lazy),
      (n.good_match = Bs[n.level].good_length),
      (n.nice_match = Bs[n.level].nice_length),
      (n.max_chain_length = Bs[n.level].max_chain),
      (n.strstart = 0),
      (n.block_start = 0),
      (n.lookahead = 0),
      (n.insert = 0),
      (n.match_length = n.prev_length = i9 - 1),
      (n.match_available = 0),
      (n.ins_h = 0));
  };

function g70() {
  ((this.strm = null),
    (this.status = 0),
    (this.pending_buf = null),
    (this.pending_buf_size = 0),
    (this.pending_out = 0),
    (this.pending = 0),
    (this.wrap = 0),
    (this.gzhead = null),
    (this.gzindex = 0),
    (this.method = I7),
    (this.last_flush = -1),
    (this.w_size = 0),
    (this.w_bits = 0),
    (this.w_mask = 0),
    (this.window = null),
    (this.window_size = 0),
    (this.prev = null),
    (this.head = null),
    (this.ins_h = 0),
    (this.hash_size = 0),
    (this.hash_bits = 0),
    (this.hash_mask = 0),
    (this.hash_shift = 0),
    (this.block_start = 0),
    (this.match_length = 0),
    (this.prev_match = 0),
    (this.match_available = 0),
    (this.strstart = 0),
    (this.match_start = 0),
    (this.lookahead = 0),
    (this.prev_length = 0),
    (this.max_chain_length = 0),
    (this.max_lazy_match = 0),
    (this.level = 0),
    (this.strategy = 0),
    (this.good_match = 0),
    (this.nice_match = 0),
    (this.dyn_ltree = new Uint16Array(o70 * 2)),
    (this.dyn_dtree = new Uint16Array((2 * r70 + 1) * 2)),
    (this.bl_tree = new Uint16Array((2 * s70 + 1) * 2)),
    $n(this.dyn_ltree),
    $n(this.dyn_dtree),
    $n(this.bl_tree),
    (this.l_desc = null),
    (this.d_desc = null),
    (this.bl_desc = null),
    (this.bl_count = new Uint16Array(a70 + 1)),
    (this.heap = new Uint16Array(2 * am + 1)),
    $n(this.heap),
    (this.heap_len = 0),
    (this.heap_max = 0),
    (this.depth = new Uint16Array(2 * am + 1)),
    $n(this.depth),
    (this.sym_buf = 0),
    (this.lit_bufsize = 0),
    (this.sym_next = 0),
    (this.sym_end = 0),
    (this.opt_len = 0),
    (this.static_len = 0),
    (this.matches = 0),
    (this.insert = 0),
    (this.bi_buf = 0),
    (this.bi_valid = 0));
}

const Ia = (n) => {
    if (!n) return 1;
    const e = n.state;
    return !e ||
      e.strm !== n ||
      (e.status !== mr &&
        e.status !== Cy &&
        e.status !== cm &&
        e.status !== lm &&
        e.status !== um &&
        e.status !== hm &&
        e.status !== c4 &&
        e.status !== Gs)
      ? 1
      : 0;
  },
  XF = (n) => {
    if (Ia(n)) return l4(n, i5);
    ((n.total_in = n.total_out = 0), (n.data_type = Q60));
    const e = n.state;
    return (
      (e.pending = 0),
      (e.pending_out = 0),
      e.wrap < 0 && (e.wrap = -e.wrap),
      (e.status = e.wrap === 2 ? Cy : e.wrap ? mr : c4),
      (n.adler = e.wrap === 2 ? 0 : 1),
      (e.last_flush = -2),
      z60(e),
      z1
    );
  },
  YF = (n) => {
    const e = XF(n);
    return (e === z1 && p70(n.state), e);
  },
  m70 = (n, e) =>
    Ia(n) || n.state.wrap !== 2 ? i5 : ((n.state.gzhead = e), z1),
  ZF = (n, e, t, i, r, s) => {
    if (!n) return i5;
    let o = 1;
    if (
      (e === K60 && (e = 6),
      i < 0 ? ((o = 0), (i = -i)) : i > 15 && ((o = 2), (i -= 16)),
      r < 1 ||
        r > J60 ||
        t !== I7 ||
        i < 8 ||
        i > 15 ||
        e < 0 ||
        e > 9 ||
        s < 0 ||
        s > Y60 ||
        (i === 8 && o !== 1))
    )
      return l4(n, i5);
    i === 8 && (i = 9);
    const a = new g70();
    return (
      (n.state = a),
      (a.strm = n),
      (a.status = mr),
      (a.wrap = o),
      (a.gzhead = null),
      (a.w_bits = i),
      (a.w_size = 1 << a.w_bits),
      (a.w_mask = a.w_size - 1),
      (a.hash_bits = r + 7),
      (a.hash_size = 1 << a.hash_bits),
      (a.hash_mask = a.hash_size - 1),
      (a.hash_shift = ~~((a.hash_bits + i9 - 1) / i9)),
      (a.window = new Uint8Array(a.w_size * 2)),
      (a.head = new Uint16Array(a.hash_size)),
      (a.prev = new Uint16Array(a.w_size)),
      (a.lit_bufsize = 1 << (r + 6)),
      (a.pending_buf_size = a.lit_bufsize * 4),
      (a.pending_buf = new Uint8Array(a.pending_buf_size)),
      (a.sym_buf = a.lit_bufsize),
      (a.sym_end = (a.lit_bufsize - 1) * 3),
      (a.level = e),
      (a.strategy = s),
      (a.method = t),
      YF(n)
    );
  },
  w70 = (n, e) => ZF(n, e, I7, e70, t70, Z60),
  v70 = (n, e) => {
    if (Ia(n) || e > JT || e < 0) return n ? l4(n, i5) : i5;
    const t = n.state;
    if (
      !n.output ||
      (n.avail_in !== 0 && !n.input) ||
      (t.status === Gs && e !== at)
    )
      return l4(n, n.avail_out === 0 ? Cf : i5);
    const i = t.last_flush;
    if (((t.last_flush = e), t.pending !== 0)) {
      if ((Pe(n), n.avail_out === 0)) return ((t.last_flush = -1), z1);
    } else if (n.avail_in === 0 && t_(e) <= t_(i) && e !== at) return l4(n, Cf);
    if (t.status === Gs && n.avail_in !== 0) return l4(n, Cf);
    if ((t.status === mr && t.wrap === 0 && (t.status = c4), t.status === mr)) {
      let r = (I7 + ((t.w_bits - 8) << 4)) << 8,
        s = -1;
      if (
        (t.strategy >= Gc || t.level < 2
          ? (s = 0)
          : t.level < 6
            ? (s = 1)
            : t.level === 6
              ? (s = 2)
              : (s = 3),
        (r |= s << 6),
        t.strstart !== 0 && (r |= c70),
        (r += 31 - (r % 31)),
        ps(t, r),
        t.strstart !== 0 && (ps(t, n.adler >>> 16), ps(t, n.adler & 65535)),
        (n.adler = 1),
        (t.status = c4),
        Pe(n),
        t.pending !== 0)
      )
        return ((t.last_flush = -1), z1);
    }
    if (t.status === Cy) {
      if (((n.adler = 0), p9(t, 31), p9(t, 139), p9(t, 8), t.gzhead))
        (p9(
          t,
          (t.gzhead.text ? 1 : 0) +
            (t.gzhead.hcrc ? 2 : 0) +
            (t.gzhead.extra ? 4 : 0) +
            (t.gzhead.name ? 8 : 0) +
            (t.gzhead.comment ? 16 : 0),
        ),
          p9(t, t.gzhead.time & 255),
          p9(t, (t.gzhead.time >> 8) & 255),
          p9(t, (t.gzhead.time >> 16) & 255),
          p9(t, (t.gzhead.time >> 24) & 255),
          p9(t, t.level === 9 ? 2 : t.strategy >= Gc || t.level < 2 ? 4 : 0),
          p9(t, t.gzhead.os & 255),
          t.gzhead.extra &&
            t.gzhead.extra.length &&
            (p9(t, t.gzhead.extra.length & 255),
            p9(t, (t.gzhead.extra.length >> 8) & 255)),
          t.gzhead.hcrc && (n.adler = k1(n.adler, t.pending_buf, t.pending, 0)),
          (t.gzindex = 0),
          (t.status = cm));
      else if (
        (p9(t, 0),
        p9(t, 0),
        p9(t, 0),
        p9(t, 0),
        p9(t, 0),
        p9(t, t.level === 9 ? 2 : t.strategy >= Gc || t.level < 2 ? 4 : 0),
        p9(t, l70),
        (t.status = c4),
        Pe(n),
        t.pending !== 0)
      )
        return ((t.last_flush = -1), z1);
    }
    if (t.status === cm) {
      if (t.gzhead.extra) {
        let r = t.pending,
          s = (t.gzhead.extra.length & 65535) - t.gzindex;
        for (; t.pending + s > t.pending_buf_size;) {
          let a = t.pending_buf_size - t.pending;
          if (
            (t.pending_buf.set(
              t.gzhead.extra.subarray(t.gzindex, t.gzindex + a),
              t.pending,
            ),
            (t.pending = t.pending_buf_size),
            t.gzhead.hcrc &&
              t.pending > r &&
              (n.adler = k1(n.adler, t.pending_buf, t.pending - r, r)),
            (t.gzindex += a),
            Pe(n),
            t.pending !== 0)
          )
            return ((t.last_flush = -1), z1);
          ((r = 0), (s -= a));
        }
        let o = new Uint8Array(t.gzhead.extra);
        (t.pending_buf.set(o.subarray(t.gzindex, t.gzindex + s), t.pending),
          (t.pending += s),
          t.gzhead.hcrc &&
            t.pending > r &&
            (n.adler = k1(n.adler, t.pending_buf, t.pending - r, r)),
          (t.gzindex = 0));
      }
      t.status = lm;
    }
    if (t.status === lm) {
      if (t.gzhead.name) {
        let r = t.pending,
          s;
        do {
          if (t.pending === t.pending_buf_size) {
            if (
              (t.gzhead.hcrc &&
                t.pending > r &&
                (n.adler = k1(n.adler, t.pending_buf, t.pending - r, r)),
              Pe(n),
              t.pending !== 0)
            )
              return ((t.last_flush = -1), z1);
            r = 0;
          }
          (t.gzindex < t.gzhead.name.length
            ? (s = t.gzhead.name.charCodeAt(t.gzindex++) & 255)
            : (s = 0),
            p9(t, s));
        } while (s !== 0);
        (t.gzhead.hcrc &&
          t.pending > r &&
          (n.adler = k1(n.adler, t.pending_buf, t.pending - r, r)),
          (t.gzindex = 0));
      }
      t.status = um;
    }
    if (t.status === um) {
      if (t.gzhead.comment) {
        let r = t.pending,
          s;
        do {
          if (t.pending === t.pending_buf_size) {
            if (
              (t.gzhead.hcrc &&
                t.pending > r &&
                (n.adler = k1(n.adler, t.pending_buf, t.pending - r, r)),
              Pe(n),
              t.pending !== 0)
            )
              return ((t.last_flush = -1), z1);
            r = 0;
          }
          (t.gzindex < t.gzhead.comment.length
            ? (s = t.gzhead.comment.charCodeAt(t.gzindex++) & 255)
            : (s = 0),
            p9(t, s));
        } while (s !== 0);
        t.gzhead.hcrc &&
          t.pending > r &&
          (n.adler = k1(n.adler, t.pending_buf, t.pending - r, r));
      }
      t.status = hm;
    }
    if (t.status === hm) {
      if (t.gzhead.hcrc) {
        if (t.pending + 2 > t.pending_buf_size && (Pe(n), t.pending !== 0))
          return ((t.last_flush = -1), z1);
        (p9(t, n.adler & 255), p9(t, (n.adler >> 8) & 255), (n.adler = 0));
      }
      if (((t.status = c4), Pe(n), t.pending !== 0))
        return ((t.last_flush = -1), z1);
    }
    if (
      n.avail_in !== 0 ||
      t.lookahead !== 0 ||
      (e !== s3 && t.status !== Gs)
    ) {
      let r =
        t.level === 0
          ? jF(t, e)
          : t.strategy === Gc
            ? f70(t, e)
            : t.strategy === X60
              ? d70(t, e)
              : Bs[t.level].func(t, e);
      if (((r === G4 || r === kr) && (t.status = Gs), r === ge || r === G4))
        return (n.avail_out === 0 && (t.last_flush = -1), z1);
      if (
        r === Ir &&
        (e === W60
          ? $60(t)
          : e !== JT &&
            (om(t, 0, 0, !1),
            e === H60 &&
              ($n(t.head),
              t.lookahead === 0 &&
                ((t.strstart = 0), (t.block_start = 0), (t.insert = 0)))),
        Pe(n),
        n.avail_out === 0)
      )
        return ((t.last_flush = -1), z1);
    }
    return e !== at
      ? z1
      : t.wrap <= 0
        ? e_
        : (t.wrap === 2
            ? (p9(t, n.adler & 255),
              p9(t, (n.adler >> 8) & 255),
              p9(t, (n.adler >> 16) & 255),
              p9(t, (n.adler >> 24) & 255),
              p9(t, n.total_in & 255),
              p9(t, (n.total_in >> 8) & 255),
              p9(t, (n.total_in >> 16) & 255),
              p9(t, (n.total_in >> 24) & 255))
            : (ps(t, n.adler >>> 16), ps(t, n.adler & 65535)),
          Pe(n),
          t.wrap > 0 && (t.wrap = -t.wrap),
          t.pending !== 0 ? z1 : e_);
  },
  y70 = (n) => {
    if (Ia(n)) return i5;
    const e = n.state.status;
    return ((n.state = null), e === c4 ? l4(n, q60) : z1);
  },
  A70 = (n, e) => {
    let t = e.length;
    if (Ia(n)) return i5;
    const i = n.state,
      r = i.wrap;
    if (r === 2 || (r === 1 && i.status !== mr) || i.lookahead) return i5;
    if (
      (r === 1 && (n.adler = ea(n.adler, e, t, 0)), (i.wrap = 0), t >= i.w_size)
    ) {
      r === 0 &&
        ($n(i.head), (i.strstart = 0), (i.block_start = 0), (i.insert = 0));
      let c = new Uint8Array(i.w_size);
      (c.set(e.subarray(t - i.w_size, t), 0), (e = c), (t = i.w_size));
    }
    const s = n.avail_in,
      o = n.next_in,
      a = n.input;
    for (
      n.avail_in = t, n.next_in = 0, n.input = e, wr(i);
      i.lookahead >= i9;
    ) {
      let c = i.strstart,
        l = i.lookahead - (i9 - 1);
      do
        ((i.ins_h = o3(i, i.ins_h, i.window[c + i9 - 1])),
          (i.prev[c & i.w_mask] = i.head[i.ins_h]),
          (i.head[i.ins_h] = c),
          c++);
      while (--l);
      ((i.strstart = c), (i.lookahead = i9 - 1), wr(i));
    }
    return (
      (i.strstart += i.lookahead),
      (i.block_start = i.strstart),
      (i.insert = i.lookahead),
      (i.lookahead = 0),
      (i.match_length = i.prev_length = i9 - 1),
      (i.match_available = 0),
      (n.next_in = o),
      (n.input = a),
      (n.avail_in = s),
      (i.wrap = r),
      z1
    );
  };

var b70 = w70,
  M70 = ZF,
  x70 = YF,
  S70 = XF,
  C70 = m70,
  E70 = v70,
  T70 = y70,
  _70 = A70,
  G70 = "pako deflate (from Nodeca project)",
  to = {
    deflateInit: b70,
    deflateInit2: M70,
    deflateReset: x70,
    deflateResetKeep: S70,
    deflateSetHeader: C70,
    deflate: E70,
    deflateEnd: T70,
    deflateSetDictionary: _70,
    deflateInfo: G70,
  };

const B70 = (n, e) => Object.prototype.hasOwnProperty.call(n, e);

var R70 = function (n) {
    const e = Array.prototype.slice.call(arguments, 1);
    for (; e.length;) {
      const t = e.shift();
      if (t) {
        if (typeof t != "object") throw new TypeError(t + "must be non-object");
        for (const i in t) B70(t, i) && (n[i] = t[i]);
      }
    }
    return n;
  },
  I70 = (n) => {
    let e = 0;
    for (let i = 0, r = n.length; i < r; i++) e += n[i].length;
    const t = new Uint8Array(e);
    for (let i = 0, r = 0, s = n.length; i < s; i++) {
      let o = n[i];
      (t.set(o, r), (r += o.length));
    }
    return t;
  },
  k7 = { assign: R70, flattenChunks: I70 };

let QF = !0;

try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
  QF = !1;
}

const ta = new Uint8Array(256);

for (let n = 0; n < 256; n++)
  ta[n] =
    n >= 252
      ? 6
      : n >= 248
        ? 5
        : n >= 240
          ? 4
          : n >= 224
            ? 3
            : n >= 192
              ? 2
              : 1;

ta[254] = ta[254] = 1;

var k70 = (n) => {
  if (typeof TextEncoder == "function" && TextEncoder.prototype.encode)
    return new TextEncoder().encode(n);
  let e,
    t,
    i,
    r,
    s,
    o = n.length,
    a = 0;
  for (r = 0; r < o; r++)
    ((t = n.charCodeAt(r)),
      (t & 64512) === 55296 &&
        r + 1 < o &&
        ((i = n.charCodeAt(r + 1)),
        (i & 64512) === 56320 &&
          ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), r++)),
      (a += t < 128 ? 1 : t < 2048 ? 2 : t < 65536 ? 3 : 4));
  for (e = new Uint8Array(a), s = 0, r = 0; s < a; r++)
    ((t = n.charCodeAt(r)),
      (t & 64512) === 55296 &&
        r + 1 < o &&
        ((i = n.charCodeAt(r + 1)),
        (i & 64512) === 56320 &&
          ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), r++)),
      t < 128
        ? (e[s++] = t)
        : t < 2048
          ? ((e[s++] = 192 | (t >>> 6)), (e[s++] = 128 | (t & 63)))
          : t < 65536
            ? ((e[s++] = 224 | (t >>> 12)),
              (e[s++] = 128 | ((t >>> 6) & 63)),
              (e[s++] = 128 | (t & 63)))
            : ((e[s++] = 240 | (t >>> 18)),
              (e[s++] = 128 | ((t >>> 12) & 63)),
              (e[s++] = 128 | ((t >>> 6) & 63)),
              (e[s++] = 128 | (t & 63))));
  return e;
};

const L70 = (n, e) => {
  if (e < 65534 && n.subarray && QF)
    return String.fromCharCode.apply(
      null,
      n.length === e ? n : n.subarray(0, e),
    );
  let t = "";
  for (let i = 0; i < e; i++) t += String.fromCharCode(n[i]);
  return t;
};

var P70 = (n, e) => {
    const t = e || n.length;
    if (typeof TextDecoder == "function" && TextDecoder.prototype.decode)
      return new TextDecoder().decode(n.subarray(0, e));
    let i, r;
    const s = new Array(t * 2);
    for (r = 0, i = 0; i < t;) {
      let o = n[i++];
      if (o < 128) {
        s[r++] = o;
        continue;
      }
      let a = ta[o];
      if (a > 4) {
        ((s[r++] = 65533), (i += a - 1));
        continue;
      }
      for (o &= a === 2 ? 31 : a === 3 ? 15 : 7; a > 1 && i < t;)
        ((o = (o << 6) | (n[i++] & 63)), a--);
      if (a > 1) {
        s[r++] = 65533;
        continue;
      }
      o < 65536
        ? (s[r++] = o)
        : ((o -= 65536),
          (s[r++] = 55296 | ((o >> 10) & 1023)),
          (s[r++] = 56320 | (o & 1023)));
    }
    return L70(s, r);
  },
  F70 = (n, e) => {
    ((e = e || n.length), e > n.length && (e = n.length));
    let t = e - 1;
    for (; t >= 0 && (n[t] & 192) === 128;) t--;
    return t < 0 || t === 0 ? e : t + ta[n[t]] > e ? t : e;
  },
  na = { string2buf: k70, buf2string: P70, utf8border: F70 };

function D70() {
  ((this.input = null),
    (this.next_in = 0),
    (this.avail_in = 0),
    (this.total_in = 0),
    (this.output = null),
    (this.next_out = 0),
    (this.avail_out = 0),
    (this.total_out = 0),
    (this.msg = ""),
    (this.state = null),
    (this.data_type = 2),
    (this.adler = 0));
}

var JF = D70;

const eD = Object.prototype.toString,
  {
    Z_NO_FLUSH: V70,
    Z_SYNC_FLUSH: N70,
    Z_FULL_FLUSH: O70,
    Z_FINISH: z70,
    Z_OK: T6,
    Z_STREAM_END: U70,
    Z_DEFAULT_COMPRESSION: $70,
    Z_DEFAULT_STRATEGY: W70,
    Z_DEFLATED: H70,
  } = Ra;

function ka(n) {
  this.options = k7.assign(
    {
      level: $70,
      method: H70,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: W70,
    },
    n || {},
  );
  let e = this.options;
  (e.raw && e.windowBits > 0
    ? (e.windowBits = -e.windowBits)
    : e.gzip && e.windowBits > 0 && e.windowBits < 16 && (e.windowBits += 16),
    (this.err = 0),
    (this.msg = ""),
    (this.ended = !1),
    (this.chunks = []),
    (this.strm = new JF()),
    (this.strm.avail_out = 0));
  let t = to.deflateInit2(
    this.strm,
    e.level,
    e.method,
    e.windowBits,
    e.memLevel,
    e.strategy,
  );
  if (t !== T6) throw new Error(_4[t]);
  if ((e.header && to.deflateSetHeader(this.strm, e.header), e.dictionary)) {
    let i;
    if (
      (typeof e.dictionary == "string"
        ? (i = na.string2buf(e.dictionary))
        : eD.call(e.dictionary) === "[object ArrayBuffer]"
          ? (i = new Uint8Array(e.dictionary))
          : (i = e.dictionary),
      (t = to.deflateSetDictionary(this.strm, i)),
      t !== T6)
    )
      throw new Error(_4[t]);
    this._dict_set = !0;
  }
}

ka.prototype.push = function (n, e) {
  const t = this.strm,
    i = this.options.chunkSize;
  let r, s;
  if (this.ended) return !1;
  for (
    e === ~~e ? (s = e) : (s = e === !0 ? z70 : V70),
      typeof n == "string"
        ? (t.input = na.string2buf(n))
        : eD.call(n) === "[object ArrayBuffer]"
          ? (t.input = new Uint8Array(n))
          : (t.input = n),
      t.next_in = 0,
      t.avail_in = t.input.length;
    ;
  ) {
    if (
      (t.avail_out === 0 &&
        ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
      (s === N70 || s === O70) && t.avail_out <= 6)
    ) {
      (this.onData(t.output.subarray(0, t.next_out)), (t.avail_out = 0));
      continue;
    }
    if (((r = to.deflate(t, s)), r === U70))
      return (
        t.next_out > 0 && this.onData(t.output.subarray(0, t.next_out)),
        (r = to.deflateEnd(this.strm)),
        this.onEnd(r),
        (this.ended = !0),
        r === T6
      );
    if (t.avail_out === 0) {
      this.onData(t.output);
      continue;
    }
    if (s > 0 && t.next_out > 0) {
      (this.onData(t.output.subarray(0, t.next_out)), (t.avail_out = 0));
      continue;
    }
    if (t.avail_in === 0) break;
  }
  return !0;
};

ka.prototype.onData = function (n) {
  this.chunks.push(n);
};

ka.prototype.onEnd = function (n) {
  (n === T6 && (this.result = k7.flattenChunks(this.chunks)),
    (this.chunks = []),
    (this.err = n),
    (this.msg = this.strm.msg));
};

function Ey(n, e) {
  const t = new ka(e);
  if ((t.push(n, !0), t.err)) throw t.msg || _4[t.err];
  return t.result;
}

function q70(n, e) {
  return ((e = e || {}), (e.raw = !0), Ey(n, e));
}

function K70(n, e) {
  return ((e = e || {}), (e.gzip = !0), Ey(n, e));
}

var j70 = ka,
  X70 = Ey,
  Y70 = q70,
  Z70 = K70,
  Q70 = { Deflate: j70, deflate: X70, deflateRaw: Y70, gzip: Z70 };

const Bc = 16209,
  J70 = 16191;

var eu0 = function (e, t) {
  let i, r, s, o, a, c, l, u, h, d, f, p, v, w, g, y, b, A, x, M, E, _, C, S;
  const G = e.state;
  ((i = e.next_in),
    (C = e.input),
    (r = i + (e.avail_in - 5)),
    (s = e.next_out),
    (S = e.output),
    (o = s - (t - e.avail_out)),
    (a = s + (e.avail_out - 257)),
    (c = G.dmax),
    (l = G.wsize),
    (u = G.whave),
    (h = G.wnext),
    (d = G.window),
    (f = G.hold),
    (p = G.bits),
    (v = G.lencode),
    (w = G.distcode),
    (g = (1 << G.lenbits) - 1),
    (y = (1 << G.distbits) - 1));
  e: do {
    (p < 15 && ((f += C[i++] << p), (p += 8), (f += C[i++] << p), (p += 8)),
      (b = v[f & g]));
    t: for (;;) {
      if (
        ((A = b >>> 24), (f >>>= A), (p -= A), (A = (b >>> 16) & 255), A === 0)
      )
        S[s++] = b & 65535;
      else if (A & 16) {
        ((x = b & 65535),
          (A &= 15),
          A &&
            (p < A && ((f += C[i++] << p), (p += 8)),
            (x += f & ((1 << A) - 1)),
            (f >>>= A),
            (p -= A)),
          p < 15 &&
            ((f += C[i++] << p), (p += 8), (f += C[i++] << p), (p += 8)),
          (b = w[f & y]));
        n: for (;;) {
          if (
            ((A = b >>> 24),
            (f >>>= A),
            (p -= A),
            (A = (b >>> 16) & 255),
            A & 16)
          ) {
            if (
              ((M = b & 65535),
              (A &= 15),
              p < A &&
                ((f += C[i++] << p),
                (p += 8),
                p < A && ((f += C[i++] << p), (p += 8))),
              (M += f & ((1 << A) - 1)),
              M > c)
            ) {
              ((e.msg = "invalid distance too far back"), (G.mode = Bc));
              break e;
            }
            if (((f >>>= A), (p -= A), (A = s - o), M > A)) {
              if (((A = M - A), A > u && G.sane)) {
                ((e.msg = "invalid distance too far back"), (G.mode = Bc));
                break e;
              }
              if (((E = 0), (_ = d), h === 0)) {
                if (((E += l - A), A < x)) {
                  x -= A;
                  do S[s++] = d[E++];
                  while (--A);
                  ((E = s - M), (_ = S));
                }
              } else if (h < A) {
                if (((E += l + h - A), (A -= h), A < x)) {
                  x -= A;
                  do S[s++] = d[E++];
                  while (--A);
                  if (((E = 0), h < x)) {
                    ((A = h), (x -= A));
                    do S[s++] = d[E++];
                    while (--A);
                    ((E = s - M), (_ = S));
                  }
                }
              } else if (((E += h - A), A < x)) {
                x -= A;
                do S[s++] = d[E++];
                while (--A);
                ((E = s - M), (_ = S));
              }
              for (; x > 2;)
                ((S[s++] = _[E++]),
                  (S[s++] = _[E++]),
                  (S[s++] = _[E++]),
                  (x -= 3));
              x && ((S[s++] = _[E++]), x > 1 && (S[s++] = _[E++]));
            } else {
              E = s - M;
              do
                ((S[s++] = S[E++]),
                  (S[s++] = S[E++]),
                  (S[s++] = S[E++]),
                  (x -= 3));
              while (x > 2);
              x && ((S[s++] = S[E++]), x > 1 && (S[s++] = S[E++]));
            }
          } else if ((A & 64) === 0) {
            b = w[(b & 65535) + (f & ((1 << A) - 1))];
            continue n;
          } else {
            ((e.msg = "invalid distance code"), (G.mode = Bc));
            break e;
          }
          break;
        }
      } else if ((A & 64) === 0) {
        b = v[(b & 65535) + (f & ((1 << A) - 1))];
        continue t;
      } else if (A & 32) {
        G.mode = J70;
        break e;
      } else {
        ((e.msg = "invalid literal/length code"), (G.mode = Bc));
        break e;
      }
      break;
    }
  } while (i < r && s < a);
  ((x = p >> 3),
    (i -= x),
    (p -= x << 3),
    (f &= (1 << p) - 1),
    (e.next_in = i),
    (e.next_out = s),
    (e.avail_in = i < r ? 5 + (r - i) : 5 - (i - r)),
    (e.avail_out = s < a ? 257 + (a - s) : 257 - (s - a)),
    (G.hold = f),
    (G.bits = p));
};

const Si = 15,
  n_ = 852,
  i_ = 592,
  r_ = 0,
  Tf = 1,
  s_ = 2,
  tu0 = new Uint16Array([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
    83, 99, 115, 131, 163, 195, 227, 258, 0, 0,
  ]),
  nu0 = new Uint8Array([
    16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19,
    19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78,
  ]),
  iu0 = new Uint16Array([
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513,
    769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0,
  ]),
  ru0 = new Uint8Array([
    16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24,
    24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64,
  ]),
  su0 = (n, e, t, i, r, s, o, a) => {
    const c = a.bits;
    let l = 0,
      u = 0,
      h = 0,
      d = 0,
      f = 0,
      p = 0,
      v = 0,
      w = 0,
      g = 0,
      y = 0,
      b,
      A,
      x,
      M,
      E,
      _ = null,
      C;
    const S = new Uint16Array(Si + 1),
      G = new Uint16Array(Si + 1);
    let I = null,
      L,
      k,
      D;
    for (l = 0; l <= Si; l++) S[l] = 0;
    for (u = 0; u < i; u++) S[e[t + u]]++;
    for (f = c, d = Si; d >= 1 && S[d] === 0; d--);
    if ((f > d && (f = d), d === 0))
      return (
        (r[s++] = (1 << 24) | (64 << 16) | 0),
        (r[s++] = (1 << 24) | (64 << 16) | 0),
        (a.bits = 1),
        0
      );
    for (h = 1; h < d && S[h] === 0; h++);
    for (f < h && (f = h), w = 1, l = 1; l <= Si; l++)
      if (((w <<= 1), (w -= S[l]), w < 0)) return -1;
    if (w > 0 && (n === r_ || d !== 1)) return -1;
    for (G[1] = 0, l = 1; l < Si; l++) G[l + 1] = G[l] + S[l];
    for (u = 0; u < i; u++) e[t + u] !== 0 && (o[G[e[t + u]]++] = u);
    if (
      (n === r_
        ? ((_ = I = o), (C = 20))
        : n === Tf
          ? ((_ = tu0), (I = nu0), (C = 257))
          : ((_ = iu0), (I = ru0), (C = 0)),
      (y = 0),
      (u = 0),
      (l = h),
      (E = s),
      (p = f),
      (v = 0),
      (x = -1),
      (g = 1 << f),
      (M = g - 1),
      (n === Tf && g > n_) || (n === s_ && g > i_))
    )
      return 1;
    for (;;) {
      ((L = l - v),
        o[u] + 1 < C
          ? ((k = 0), (D = o[u]))
          : o[u] >= C
            ? ((k = I[o[u] - C]), (D = _[o[u] - C]))
            : ((k = 96), (D = 0)),
        (b = 1 << (l - v)),
        (A = 1 << p),
        (h = A));
      do ((A -= b), (r[E + (y >> v) + A] = (L << 24) | (k << 16) | D | 0));
      while (A !== 0);
      for (b = 1 << (l - 1); y & b;) b >>= 1;
      if ((b !== 0 ? ((y &= b - 1), (y += b)) : (y = 0), u++, --S[l] === 0)) {
        if (l === d) break;
        l = e[t + o[u]];
      }
      if (l > f && (y & M) !== x) {
        for (
          v === 0 && (v = f), E += h, p = l - v, w = 1 << p;
          p + v < d && ((w -= S[p + v]), !(w <= 0));
        )
          (p++, (w <<= 1));
        if (((g += 1 << p), (n === Tf && g > n_) || (n === s_ && g > i_)))
          return 1;
        ((x = y & M), (r[x] = (f << 24) | (p << 16) | (E - s) | 0));
      }
    }
    return (
      y !== 0 && (r[E + y] = ((l - v) << 24) | (64 << 16) | 0),
      (a.bits = f),
      0
    );
  };

var no = su0;

const ou0 = 0,
  tD = 1,
  nD = 2,
  {
    Z_FINISH: o_,
    Z_BLOCK: au0,
    Z_TREES: Rc,
    Z_OK: B4,
    Z_STREAM_END: cu0,
    Z_NEED_DICT: lu0,
    Z_STREAM_ERROR: ht,
    Z_DATA_ERROR: iD,
    Z_MEM_ERROR: rD,
    Z_BUF_ERROR: uu0,
    Z_DEFLATED: a_,
  } = Ra,
  L7 = 16180,
  c_ = 16181,
  l_ = 16182,
  u_ = 16183,
  h_ = 16184,
  d_ = 16185,
  f_ = 16186,
  p_ = 16187,
  g_ = 16188,
  m_ = 16189,
  _6 = 16190,
  _5 = 16191,
  _f = 16192,
  w_ = 16193,
  Gf = 16194,
  v_ = 16195,
  y_ = 16196,
  A_ = 16197,
  b_ = 16198,
  Ic = 16199,
  kc = 16200,
  M_ = 16201,
  x_ = 16202,
  S_ = 16203,
  C_ = 16204,
  E_ = 16205,
  Bf = 16206,
  T_ = 16207,
  __ = 16208,
  X9 = 16209,
  sD = 16210,
  oD = 16211,
  hu0 = 852,
  du0 = 592,
  fu0 = 15,
  pu0 = fu0,
  G_ = (n) =>
    ((n >>> 24) & 255) +
    ((n >>> 8) & 65280) +
    ((n & 65280) << 8) +
    ((n & 255) << 24);

function gu0() {
  ((this.strm = null),
    (this.mode = 0),
    (this.last = !1),
    (this.wrap = 0),
    (this.havedict = !1),
    (this.flags = 0),
    (this.dmax = 0),
    (this.check = 0),
    (this.total = 0),
    (this.head = null),
    (this.wbits = 0),
    (this.wsize = 0),
    (this.whave = 0),
    (this.wnext = 0),
    (this.window = null),
    (this.hold = 0),
    (this.bits = 0),
    (this.length = 0),
    (this.offset = 0),
    (this.extra = 0),
    (this.lencode = null),
    (this.distcode = null),
    (this.lenbits = 0),
    (this.distbits = 0),
    (this.ncode = 0),
    (this.nlen = 0),
    (this.ndist = 0),
    (this.have = 0),
    (this.next = null),
    (this.lens = new Uint16Array(320)),
    (this.work = new Uint16Array(288)),
    (this.lendyn = null),
    (this.distdyn = null),
    (this.sane = 0),
    (this.back = 0),
    (this.was = 0));
}

const D4 = (n) => {
    if (!n) return 1;
    const e = n.state;
    return !e || e.strm !== n || e.mode < L7 || e.mode > oD ? 1 : 0;
  },
  aD = (n) => {
    if (D4(n)) return ht;
    const e = n.state;
    return (
      (n.total_in = n.total_out = e.total = 0),
      (n.msg = ""),
      e.wrap && (n.adler = e.wrap & 1),
      (e.mode = L7),
      (e.last = 0),
      (e.havedict = 0),
      (e.flags = -1),
      (e.dmax = 32768),
      (e.head = null),
      (e.hold = 0),
      (e.bits = 0),
      (e.lencode = e.lendyn = new Int32Array(hu0)),
      (e.distcode = e.distdyn = new Int32Array(du0)),
      (e.sane = 1),
      (e.back = -1),
      B4
    );
  },
  cD = (n) => {
    if (D4(n)) return ht;
    const e = n.state;
    return ((e.wsize = 0), (e.whave = 0), (e.wnext = 0), aD(n));
  },
  lD = (n, e) => {
    let t;
    if (D4(n)) return ht;
    const i = n.state;
    return (
      e < 0 ? ((t = 0), (e = -e)) : ((t = (e >> 4) + 5), e < 48 && (e &= 15)),
      e && (e < 8 || e > 15)
        ? ht
        : (i.window !== null && i.wbits !== e && (i.window = null),
          (i.wrap = t),
          (i.wbits = e),
          cD(n))
    );
  },
  uD = (n, e) => {
    if (!n) return ht;
    const t = new gu0();
    ((n.state = t), (t.strm = n), (t.window = null), (t.mode = L7));
    const i = lD(n, e);
    return (i !== B4 && (n.state = null), i);
  },
  mu0 = (n) => uD(n, pu0);

let B_ = !0,
  Rf,
  If;

const wu0 = (n) => {
    if (B_) {
      ((Rf = new Int32Array(512)), (If = new Int32Array(32)));
      let e = 0;
      for (; e < 144;) n.lens[e++] = 8;
      for (; e < 256;) n.lens[e++] = 9;
      for (; e < 280;) n.lens[e++] = 7;
      for (; e < 288;) n.lens[e++] = 8;
      for (no(tD, n.lens, 0, 288, Rf, 0, n.work, { bits: 9 }), e = 0; e < 32;)
        n.lens[e++] = 5;
      (no(nD, n.lens, 0, 32, If, 0, n.work, { bits: 5 }), (B_ = !1));
    }
    ((n.lencode = Rf), (n.lenbits = 9), (n.distcode = If), (n.distbits = 5));
  },
  hD = (n, e, t, i) => {
    let r;
    const s = n.state;
    return (
      s.window === null &&
        ((s.wsize = 1 << s.wbits),
        (s.wnext = 0),
        (s.whave = 0),
        (s.window = new Uint8Array(s.wsize))),
      i >= s.wsize
        ? (s.window.set(e.subarray(t - s.wsize, t), 0),
          (s.wnext = 0),
          (s.whave = s.wsize))
        : ((r = s.wsize - s.wnext),
          r > i && (r = i),
          s.window.set(e.subarray(t - i, t - i + r), s.wnext),
          (i -= r),
          i
            ? (s.window.set(e.subarray(t - i, t), 0),
              (s.wnext = i),
              (s.whave = s.wsize))
            : ((s.wnext += r),
              s.wnext === s.wsize && (s.wnext = 0),
              s.whave < s.wsize && (s.whave += r))),
      0
    );
  },
  vu0 = (n, e) => {
    let t,
      i,
      r,
      s,
      o,
      a,
      c,
      l,
      u,
      h,
      d,
      f,
      p,
      v,
      w = 0,
      g,
      y,
      b,
      A,
      x,
      M,
      E,
      _;
    const C = new Uint8Array(4);
    let S, G;
    const I = new Uint8Array([
      16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
    ]);
    if (D4(n) || !n.output || (!n.input && n.avail_in !== 0)) return ht;
    ((t = n.state),
      t.mode === _5 && (t.mode = _f),
      (o = n.next_out),
      (r = n.output),
      (c = n.avail_out),
      (s = n.next_in),
      (i = n.input),
      (a = n.avail_in),
      (l = t.hold),
      (u = t.bits),
      (h = a),
      (d = c),
      (_ = B4));
    e: for (;;)
      switch (t.mode) {
        case L7:
          if (t.wrap === 0) {
            t.mode = _f;
            break;
          }
          for (; u < 16;) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          if (t.wrap & 2 && l === 35615) {
            (t.wbits === 0 && (t.wbits = 15),
              (t.check = 0),
              (C[0] = l & 255),
              (C[1] = (l >>> 8) & 255),
              (t.check = k1(t.check, C, 2, 0)),
              (l = 0),
              (u = 0),
              (t.mode = c_));
            break;
          }
          if (
            (t.head && (t.head.done = !1),
            !(t.wrap & 1) || (((l & 255) << 8) + (l >> 8)) % 31)
          ) {
            ((n.msg = "incorrect header check"), (t.mode = X9));
            break;
          }
          if ((l & 15) !== a_) {
            ((n.msg = "unknown compression method"), (t.mode = X9));
            break;
          }
          if (
            ((l >>>= 4),
            (u -= 4),
            (E = (l & 15) + 8),
            t.wbits === 0 && (t.wbits = E),
            E > 15 || E > t.wbits)
          ) {
            ((n.msg = "invalid window size"), (t.mode = X9));
            break;
          }
          ((t.dmax = 1 << t.wbits),
            (t.flags = 0),
            (n.adler = t.check = 1),
            (t.mode = l & 512 ? m_ : _5),
            (l = 0),
            (u = 0));
          break;
        case c_:
          for (; u < 16;) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          if (((t.flags = l), (t.flags & 255) !== a_)) {
            ((n.msg = "unknown compression method"), (t.mode = X9));
            break;
          }
          if (t.flags & 57344) {
            ((n.msg = "unknown header flags set"), (t.mode = X9));
            break;
          }
          (t.head && (t.head.text = (l >> 8) & 1),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((C[0] = l & 255),
              (C[1] = (l >>> 8) & 255),
              (t.check = k1(t.check, C, 2, 0))),
            (l = 0),
            (u = 0),
            (t.mode = l_));
        case l_:
          for (; u < 32;) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          (t.head && (t.head.time = l),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((C[0] = l & 255),
              (C[1] = (l >>> 8) & 255),
              (C[2] = (l >>> 16) & 255),
              (C[3] = (l >>> 24) & 255),
              (t.check = k1(t.check, C, 4, 0))),
            (l = 0),
            (u = 0),
            (t.mode = u_));
        case u_:
          for (; u < 16;) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          (t.head && ((t.head.xflags = l & 255), (t.head.os = l >> 8)),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((C[0] = l & 255),
              (C[1] = (l >>> 8) & 255),
              (t.check = k1(t.check, C, 2, 0))),
            (l = 0),
            (u = 0),
            (t.mode = h_));
        case h_:
          if (t.flags & 1024) {
            for (; u < 16;) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            ((t.length = l),
              t.head && (t.head.extra_len = l),
              t.flags & 512 &&
                t.wrap & 4 &&
                ((C[0] = l & 255),
                (C[1] = (l >>> 8) & 255),
                (t.check = k1(t.check, C, 2, 0))),
              (l = 0),
              (u = 0));
          } else t.head && (t.head.extra = null);
          t.mode = d_;
        case d_:
          if (
            t.flags & 1024 &&
            ((f = t.length),
            f > a && (f = a),
            f &&
              (t.head &&
                ((E = t.head.extra_len - t.length),
                t.head.extra ||
                  (t.head.extra = new Uint8Array(t.head.extra_len)),
                t.head.extra.set(i.subarray(s, s + f), E)),
              t.flags & 512 && t.wrap & 4 && (t.check = k1(t.check, i, f, s)),
              (a -= f),
              (s += f),
              (t.length -= f)),
            t.length)
          )
            break e;
          ((t.length = 0), (t.mode = f_));
        case f_:
          if (t.flags & 2048) {
            if (a === 0) break e;
            f = 0;
            do
              ((E = i[s + f++]),
                t.head &&
                  E &&
                  t.length < 65536 &&
                  (t.head.name += String.fromCharCode(E)));
            while (E && f < a);
            if (
              (t.flags & 512 && t.wrap & 4 && (t.check = k1(t.check, i, f, s)),
              (a -= f),
              (s += f),
              E)
            )
              break e;
          } else t.head && (t.head.name = null);
          ((t.length = 0), (t.mode = p_));
        case p_:
          if (t.flags & 4096) {
            if (a === 0) break e;
            f = 0;
            do
              ((E = i[s + f++]),
                t.head &&
                  E &&
                  t.length < 65536 &&
                  (t.head.comment += String.fromCharCode(E)));
            while (E && f < a);
            if (
              (t.flags & 512 && t.wrap & 4 && (t.check = k1(t.check, i, f, s)),
              (a -= f),
              (s += f),
              E)
            )
              break e;
          } else t.head && (t.head.comment = null);
          t.mode = g_;
        case g_:
          if (t.flags & 512) {
            for (; u < 16;) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            if (t.wrap & 4 && l !== (t.check & 65535)) {
              ((n.msg = "header crc mismatch"), (t.mode = X9));
              break;
            }
            ((l = 0), (u = 0));
          }
          (t.head && ((t.head.hcrc = (t.flags >> 9) & 1), (t.head.done = !0)),
            (n.adler = t.check = 0),
            (t.mode = _5));
          break;
        case m_:
          for (; u < 32;) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          ((n.adler = t.check = G_(l)), (l = 0), (u = 0), (t.mode = _6));
        case _6:
          if (t.havedict === 0)
            return (
              (n.next_out = o),
              (n.avail_out = c),
              (n.next_in = s),
              (n.avail_in = a),
              (t.hold = l),
              (t.bits = u),
              lu0
            );
          ((n.adler = t.check = 1), (t.mode = _5));
        case _5:
          if (e === au0 || e === Rc) break e;
        case _f:
          if (t.last) {
            ((l >>>= u & 7), (u -= u & 7), (t.mode = Bf));
            break;
          }
          for (; u < 3;) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          switch (((t.last = l & 1), (l >>>= 1), (u -= 1), l & 3)) {
            case 0:
              t.mode = w_;
              break;
            case 1:
              if ((wu0(t), (t.mode = Ic), e === Rc)) {
                ((l >>>= 2), (u -= 2));
                break e;
              }
              break;
            case 2:
              t.mode = y_;
              break;
            case 3:
              ((n.msg = "invalid block type"), (t.mode = X9));
          }
          ((l >>>= 2), (u -= 2));
          break;
        case w_:
          for (l >>>= u & 7, u -= u & 7; u < 32;) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          if ((l & 65535) !== ((l >>> 16) ^ 65535)) {
            ((n.msg = "invalid stored block lengths"), (t.mode = X9));
            break;
          }
          if (
            ((t.length = l & 65535), (l = 0), (u = 0), (t.mode = Gf), e === Rc)
          )
            break e;
        case Gf:
          t.mode = v_;
        case v_:
          if (((f = t.length), f)) {
            if ((f > a && (f = a), f > c && (f = c), f === 0)) break e;
            (r.set(i.subarray(s, s + f), o),
              (a -= f),
              (s += f),
              (c -= f),
              (o += f),
              (t.length -= f));
            break;
          }
          t.mode = _5;
          break;
        case y_:
          for (; u < 14;) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          if (
            ((t.nlen = (l & 31) + 257),
            (l >>>= 5),
            (u -= 5),
            (t.ndist = (l & 31) + 1),
            (l >>>= 5),
            (u -= 5),
            (t.ncode = (l & 15) + 4),
            (l >>>= 4),
            (u -= 4),
            t.nlen > 286 || t.ndist > 30)
          ) {
            ((n.msg = "too many length or distance symbols"), (t.mode = X9));
            break;
          }
          ((t.have = 0), (t.mode = A_));
        case A_:
          for (; t.have < t.ncode;) {
            for (; u < 3;) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            ((t.lens[I[t.have++]] = l & 7), (l >>>= 3), (u -= 3));
          }
          for (; t.have < 19;) t.lens[I[t.have++]] = 0;
          if (
            ((t.lencode = t.lendyn),
            (t.lenbits = 7),
            (S = { bits: t.lenbits }),
            (_ = no(ou0, t.lens, 0, 19, t.lencode, 0, t.work, S)),
            (t.lenbits = S.bits),
            _)
          ) {
            ((n.msg = "invalid code lengths set"), (t.mode = X9));
            break;
          }
          ((t.have = 0), (t.mode = b_));
        case b_:
          for (; t.have < t.nlen + t.ndist;) {
            for (
              ;
              (w = t.lencode[l & ((1 << t.lenbits) - 1)]),
                (g = w >>> 24),
                (y = (w >>> 16) & 255),
                (b = w & 65535),
                !(g <= u);
            ) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            if (b < 16) ((l >>>= g), (u -= g), (t.lens[t.have++] = b));
            else {
              if (b === 16) {
                for (G = g + 2; u < G;) {
                  if (a === 0) break e;
                  (a--, (l += i[s++] << u), (u += 8));
                }
                if (((l >>>= g), (u -= g), t.have === 0)) {
                  ((n.msg = "invalid bit length repeat"), (t.mode = X9));
                  break;
                }
                ((E = t.lens[t.have - 1]),
                  (f = 3 + (l & 3)),
                  (l >>>= 2),
                  (u -= 2));
              } else if (b === 17) {
                for (G = g + 3; u < G;) {
                  if (a === 0) break e;
                  (a--, (l += i[s++] << u), (u += 8));
                }
                ((l >>>= g),
                  (u -= g),
                  (E = 0),
                  (f = 3 + (l & 7)),
                  (l >>>= 3),
                  (u -= 3));
              } else {
                for (G = g + 7; u < G;) {
                  if (a === 0) break e;
                  (a--, (l += i[s++] << u), (u += 8));
                }
                ((l >>>= g),
                  (u -= g),
                  (E = 0),
                  (f = 11 + (l & 127)),
                  (l >>>= 7),
                  (u -= 7));
              }
              if (t.have + f > t.nlen + t.ndist) {
                ((n.msg = "invalid bit length repeat"), (t.mode = X9));
                break;
              }
              for (; f--;) t.lens[t.have++] = E;
            }
          }
          if (t.mode === X9) break;
          if (t.lens[256] === 0) {
            ((n.msg = "invalid code -- missing end-of-block"), (t.mode = X9));
            break;
          }
          if (
            ((t.lenbits = 9),
            (S = { bits: t.lenbits }),
            (_ = no(tD, t.lens, 0, t.nlen, t.lencode, 0, t.work, S)),
            (t.lenbits = S.bits),
            _)
          ) {
            ((n.msg = "invalid literal/lengths set"), (t.mode = X9));
            break;
          }
          if (
            ((t.distbits = 6),
            (t.distcode = t.distdyn),
            (S = { bits: t.distbits }),
            (_ = no(nD, t.lens, t.nlen, t.ndist, t.distcode, 0, t.work, S)),
            (t.distbits = S.bits),
            _)
          ) {
            ((n.msg = "invalid distances set"), (t.mode = X9));
            break;
          }
          if (((t.mode = Ic), e === Rc)) break e;
        case Ic:
          t.mode = kc;
        case kc:
          if (a >= 6 && c >= 258) {
            ((n.next_out = o),
              (n.avail_out = c),
              (n.next_in = s),
              (n.avail_in = a),
              (t.hold = l),
              (t.bits = u),
              eu0(n, d),
              (o = n.next_out),
              (r = n.output),
              (c = n.avail_out),
              (s = n.next_in),
              (i = n.input),
              (a = n.avail_in),
              (l = t.hold),
              (u = t.bits),
              t.mode === _5 && (t.back = -1));
            break;
          }
          for (
            t.back = 0;
            (w = t.lencode[l & ((1 << t.lenbits) - 1)]),
              (g = w >>> 24),
              (y = (w >>> 16) & 255),
              (b = w & 65535),
              !(g <= u);
          ) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          if (y && (y & 240) === 0) {
            for (
              A = g, x = y, M = b;
              (w = t.lencode[M + ((l & ((1 << (A + x)) - 1)) >> A)]),
                (g = w >>> 24),
                (y = (w >>> 16) & 255),
                (b = w & 65535),
                !(A + g <= u);
            ) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            ((l >>>= A), (u -= A), (t.back += A));
          }
          if (((l >>>= g), (u -= g), (t.back += g), (t.length = b), y === 0)) {
            t.mode = E_;
            break;
          }
          if (y & 32) {
            ((t.back = -1), (t.mode = _5));
            break;
          }
          if (y & 64) {
            ((n.msg = "invalid literal/length code"), (t.mode = X9));
            break;
          }
          ((t.extra = y & 15), (t.mode = M_));
        case M_:
          if (t.extra) {
            for (G = t.extra; u < G;) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            ((t.length += l & ((1 << t.extra) - 1)),
              (l >>>= t.extra),
              (u -= t.extra),
              (t.back += t.extra));
          }
          ((t.was = t.length), (t.mode = x_));
        case x_:
          for (
            ;
            (w = t.distcode[l & ((1 << t.distbits) - 1)]),
              (g = w >>> 24),
              (y = (w >>> 16) & 255),
              (b = w & 65535),
              !(g <= u);
          ) {
            if (a === 0) break e;
            (a--, (l += i[s++] << u), (u += 8));
          }
          if ((y & 240) === 0) {
            for (
              A = g, x = y, M = b;
              (w = t.distcode[M + ((l & ((1 << (A + x)) - 1)) >> A)]),
                (g = w >>> 24),
                (y = (w >>> 16) & 255),
                (b = w & 65535),
                !(A + g <= u);
            ) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            ((l >>>= A), (u -= A), (t.back += A));
          }
          if (((l >>>= g), (u -= g), (t.back += g), y & 64)) {
            ((n.msg = "invalid distance code"), (t.mode = X9));
            break;
          }
          ((t.offset = b), (t.extra = y & 15), (t.mode = S_));
        case S_:
          if (t.extra) {
            for (G = t.extra; u < G;) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            ((t.offset += l & ((1 << t.extra) - 1)),
              (l >>>= t.extra),
              (u -= t.extra),
              (t.back += t.extra));
          }
          if (t.offset > t.dmax) {
            ((n.msg = "invalid distance too far back"), (t.mode = X9));
            break;
          }
          t.mode = C_;
        case C_:
          if (c === 0) break e;
          if (((f = d - c), t.offset > f)) {
            if (((f = t.offset - f), f > t.whave && t.sane)) {
              ((n.msg = "invalid distance too far back"), (t.mode = X9));
              break;
            }
            (f > t.wnext
              ? ((f -= t.wnext), (p = t.wsize - f))
              : (p = t.wnext - f),
              f > t.length && (f = t.length),
              (v = t.window));
          } else ((v = r), (p = o - t.offset), (f = t.length));
          (f > c && (f = c), (c -= f), (t.length -= f));
          do r[o++] = v[p++];
          while (--f);
          t.length === 0 && (t.mode = kc);
          break;
        case E_:
          if (c === 0) break e;
          ((r[o++] = t.length), c--, (t.mode = kc));
          break;
        case Bf:
          if (t.wrap) {
            for (; u < 32;) {
              if (a === 0) break e;
              (a--, (l |= i[s++] << u), (u += 8));
            }
            if (
              ((d -= c),
              (n.total_out += d),
              (t.total += d),
              t.wrap & 4 &&
                d &&
                (n.adler = t.check =
                  t.flags
                    ? k1(t.check, r, d, o - d)
                    : ea(t.check, r, d, o - d)),
              (d = c),
              t.wrap & 4 && (t.flags ? l : G_(l)) !== t.check)
            ) {
              ((n.msg = "incorrect data check"), (t.mode = X9));
              break;
            }
            ((l = 0), (u = 0));
          }
          t.mode = T_;
        case T_:
          if (t.wrap && t.flags) {
            for (; u < 32;) {
              if (a === 0) break e;
              (a--, (l += i[s++] << u), (u += 8));
            }
            if (t.wrap & 4 && l !== (t.total & 4294967295)) {
              ((n.msg = "incorrect length check"), (t.mode = X9));
              break;
            }
            ((l = 0), (u = 0));
          }
          t.mode = __;
        case __:
          _ = cu0;
          break e;
        case X9:
          _ = iD;
          break e;
        case sD:
          return rD;
        case oD:
        default:
          return ht;
      }
    return (
      (n.next_out = o),
      (n.avail_out = c),
      (n.next_in = s),
      (n.avail_in = a),
      (t.hold = l),
      (t.bits = u),
      (t.wsize ||
        (d !== n.avail_out && t.mode < X9 && (t.mode < Bf || e !== o_))) &&
        hD(n, n.output, n.next_out, d - n.avail_out),
      (h -= n.avail_in),
      (d -= n.avail_out),
      (n.total_in += h),
      (n.total_out += d),
      (t.total += d),
      t.wrap & 4 &&
        d &&
        (n.adler = t.check =
          t.flags
            ? k1(t.check, r, d, n.next_out - d)
            : ea(t.check, r, d, n.next_out - d)),
      (n.data_type =
        t.bits +
        (t.last ? 64 : 0) +
        (t.mode === _5 ? 128 : 0) +
        (t.mode === Ic || t.mode === Gf ? 256 : 0)),
      ((h === 0 && d === 0) || e === o_) && _ === B4 && (_ = uu0),
      _
    );
  },
  yu0 = (n) => {
    if (D4(n)) return ht;
    let e = n.state;
    return (e.window && (e.window = null), (n.state = null), B4);
  },
  Au0 = (n, e) => {
    if (D4(n)) return ht;
    const t = n.state;
    return (t.wrap & 2) === 0 ? ht : ((t.head = e), (e.done = !1), B4);
  },
  bu0 = (n, e) => {
    const t = e.length;
    let i, r, s;
    return D4(n) || ((i = n.state), i.wrap !== 0 && i.mode !== _6)
      ? ht
      : i.mode === _6 && ((r = 1), (r = ea(r, e, t, 0)), r !== i.check)
        ? iD
        : ((s = hD(n, e, t, t)),
          s ? ((i.mode = sD), rD) : ((i.havedict = 1), B4));
  };

var Mu0 = cD,
  xu0 = lD,
  Su0 = aD,
  Cu0 = mu0,
  Eu0 = uD,
  Tu0 = vu0,
  _u0 = yu0,
  Gu0 = Au0,
  Bu0 = bu0,
  Ru0 = "pako inflate (from Nodeca project)",
  V5 = {
    inflateReset: Mu0,
    inflateReset2: xu0,
    inflateResetKeep: Su0,
    inflateInit: Cu0,
    inflateInit2: Eu0,
    inflate: Tu0,
    inflateEnd: _u0,
    inflateGetHeader: Gu0,
    inflateSetDictionary: Bu0,
    inflateInfo: Ru0,
  };

function Iu0() {
  ((this.text = 0),
    (this.time = 0),
    (this.xflags = 0),
    (this.os = 0),
    (this.extra = null),
    (this.extra_len = 0),
    (this.name = ""),
    (this.comment = ""),
    (this.hcrc = 0),
    (this.done = !1));
}

var ku0 = Iu0;

const dD = Object.prototype.toString,
  {
    Z_NO_FLUSH: Lu0,
    Z_FINISH: Pu0,
    Z_OK: ia,
    Z_STREAM_END: kf,
    Z_NEED_DICT: Lf,
    Z_STREAM_ERROR: Fu0,
    Z_DATA_ERROR: R_,
    Z_MEM_ERROR: Du0,
  } = Ra;

function La(n) {
  this.options = k7.assign(
    { chunkSize: 1024 * 64, windowBits: 15, to: "" },
    n || {},
  );
  const e = this.options;
  (e.raw &&
    e.windowBits >= 0 &&
    e.windowBits < 16 &&
    ((e.windowBits = -e.windowBits),
    e.windowBits === 0 && (e.windowBits = -15)),
    e.windowBits >= 0 &&
      e.windowBits < 16 &&
      !(n && n.windowBits) &&
      (e.windowBits += 32),
    e.windowBits > 15 &&
      e.windowBits < 48 &&
      (e.windowBits & 15) === 0 &&
      (e.windowBits |= 15),
    (this.err = 0),
    (this.msg = ""),
    (this.ended = !1),
    (this.chunks = []),
    (this.strm = new JF()),
    (this.strm.avail_out = 0));
  let t = V5.inflateInit2(this.strm, e.windowBits);
  if (t !== ia) throw new Error(_4[t]);
  if (
    ((this.header = new ku0()),
    V5.inflateGetHeader(this.strm, this.header),
    e.dictionary &&
      (typeof e.dictionary == "string"
        ? (e.dictionary = na.string2buf(e.dictionary))
        : dD.call(e.dictionary) === "[object ArrayBuffer]" &&
          (e.dictionary = new Uint8Array(e.dictionary)),
      e.raw &&
        ((t = V5.inflateSetDictionary(this.strm, e.dictionary)), t !== ia)))
  )
    throw new Error(_4[t]);
}

La.prototype.push = function (n, e) {
  const t = this.strm,
    i = this.options.chunkSize,
    r = this.options.dictionary;
  let s, o, a;
  if (this.ended) return !1;
  for (
    e === ~~e ? (o = e) : (o = e === !0 ? Pu0 : Lu0),
      dD.call(n) === "[object ArrayBuffer]"
        ? (t.input = new Uint8Array(n))
        : (t.input = n),
      t.next_in = 0,
      t.avail_in = t.input.length;
    ;
  ) {
    for (
      t.avail_out === 0 &&
        ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
        s = V5.inflate(t, o),
        s === Lf &&
          r &&
          ((s = V5.inflateSetDictionary(t, r)),
          s === ia ? (s = V5.inflate(t, o)) : s === R_ && (s = Lf));
      t.avail_in > 0 && s === kf && t.state.wrap > 0 && n[t.next_in] !== 0;
    )
      (V5.inflateReset(t), (s = V5.inflate(t, o)));
    switch (s) {
      case Fu0:
      case R_:
      case Lf:
      case Du0:
        return (this.onEnd(s), (this.ended = !0), !1);
    }
    if (((a = t.avail_out), t.next_out && (t.avail_out === 0 || s === kf)))
      if (this.options.to === "string") {
        let c = na.utf8border(t.output, t.next_out),
          l = t.next_out - c,
          u = na.buf2string(t.output, c);
        ((t.next_out = l),
          (t.avail_out = i - l),
          l && t.output.set(t.output.subarray(c, c + l), 0),
          this.onData(u));
      } else
        this.onData(
          t.output.length === t.next_out
            ? t.output
            : t.output.subarray(0, t.next_out),
        );
    if (!(s === ia && a === 0)) {
      if (s === kf)
        return (
          (s = V5.inflateEnd(this.strm)),
          this.onEnd(s),
          (this.ended = !0),
          !0
        );
      if (t.avail_in === 0) break;
    }
  }
  return !0;
};

La.prototype.onData = function (n) {
  this.chunks.push(n);
};

La.prototype.onEnd = function (n) {
  (n === ia &&
    (this.options.to === "string"
      ? (this.result = this.chunks.join(""))
      : (this.result = k7.flattenChunks(this.chunks))),
    (this.chunks = []),
    (this.err = n),
    (this.msg = this.strm.msg));
};

function Ty(n, e) {
  const t = new La(e);
  if ((t.push(n), t.err)) throw t.msg || _4[t.err];
  return t.result;
}

function Vu0(n, e) {
  return ((e = e || {}), (e.raw = !0), Ty(n, e));
}

var Nu0 = La,
  Ou0 = Ty,
  zu0 = Vu0,
  Uu0 = Ty,
  $u0 = { Inflate: Nu0, inflate: Ou0, inflateRaw: zu0, ungzip: Uu0 };

const { Deflate: Wu0, deflate: Hu0, deflateRaw: qu0, gzip: Ku0 } = Q70,
  { Inflate: ju0, inflate: Xu0, inflateRaw: Yu0, ungzip: Zu0 } = $u0;

var Qu0 = Wu0,
  Ju0 = Hu0,
  eh0 = qu0,
  th0 = Ku0,
  nh0 = ju0,
  ih0 = Xu0,
  rh0 = Yu0,
  sh0 = Zu0,
  oh0 = Ra,
  fD = {
    Deflate: Qu0,
    deflate: Ju0,
    deflateRaw: eh0,
    gzip: th0,
    Inflate: nh0,
    inflate: ih0,
    inflateRaw: rh0,
    ungzip: sh0,
    constants: oh0,
  };

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

function zh0(n, e = "") {
  return "kartPaint" in n
    ? {
        character: n.character,
        kartPaint: n.kartPaint,
        characterColor: n.characterColor,
        kart: n.kart,
        plate: n.plate,
        goggle: n.goggle,
        balloon: n.balloon,
        superBoss: n.equ2,
        headBand: n.headband,
        headphone: n.replay,
        handGearL: n.cane,
        handGearR: n.equ3,
        uniform: n.apparel,
        decal: n.equ4,
        plateText: n.plateText,
        playerName: e,
        startSlot: n.startSlot,
      }
    : {
        character: n.character,
        kartPaint: n.paint,
        characterColor: n.paint,
        kart: n.kart,
        plate: n.plate,
        goggle: n.goggle,
        balloon: n.balloon,
        superBoss: void 0,
        headBand: n.headband,
        headphone: void 0,
        handGearL: n.cane,
        handGearR: void 0,
        uniform: void 0,
        decal: void 0,
        plateText: n.plateText,
        playerName: e,
        startSlot: n.startSlot,
      };
}

function U_(n) {
  if (n.character === 0 || (n.kart === 0 && !n.systemKey))
    throw new Error("影子录制的装备缺少车辆或人物 item id。");
  const e = gr();
  return {
    ...e,
    equipment: {
      ...e.equipment,
      itemIds: {
        ...e.equipment.itemIds,
        1: n.character,
        2: P3(n.kartPaint),
        3: n.kart,
        4: P3(n.plate),
        8: P3(n.goggle),
        9: P3(n.balloon),
        11: P3(n.headBand),
        16: P3(n.handGearL),
        70: P3(n.characterColor),
      },
    },
    initial: n.plateText,
  };
}

function P3(n) {
  if (n === void 0) return 0;
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`影子录制的装备 item id ${n} 无效。`);
  return n;
}

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

class Ly {
  constructor(e) {
    ((this.options = e),
      (this.panel = document.createElement("div")),
      (this.panel.className = "touch-ghost-panel"),
      (this.importButton = document.createElement("button")),
      (this.importButton.type = "button"),
      (this.importButton.textContent = "导入影子(.ksv)"));
    const t = document.createElement("div");
    ((t.textContent =
      "S0 / L2 等同字节档位，按“速度频道设置”的现代／复古版本导入；请先选对应版本。"),
      (this.deleteButton = document.createElement("button")),
      (this.deleteButton.type = "button"),
      (this.deleteButton.textContent = "删除影子"),
      (this.exportButton = document.createElement("button")),
      (this.exportButton.type = "button"),
      (this.exportButton.textContent = "导出 KSV"),
      (this.samplingModeButton = document.createElement("button")),
      (this.samplingModeButton.type = "button"),
      this.refreshSamplingModeLabel(),
      (this.resetNicknameButton = document.createElement("button")),
      (this.resetNicknameButton.type = "button"),
      (this.resetNicknameButton.textContent = "重置车手名"),
      (this.input = document.createElement("input")),
      (this.input.type = "file"),
      (this.input.accept = ".ksv"),
      (this.input.hidden = !0),
      this.importButton.addEventListener("click", this.openPicker),
      this.deleteButton.addEventListener("click", this.onDeleteClick),
      this.exportButton.addEventListener("click", this.onExportClick),
      this.samplingModeButton.addEventListener(
        "click",
        this.onSamplingModeToggle,
      ),
      this.resetNicknameButton.addEventListener(
        "click",
        this.options.resetNickname,
      ),
      this.input.addEventListener("change", this.onFileSelected),
      this.panel.append(
        this.importButton,
        t,
        this.exportButton,
        this.deleteButton,
        this.samplingModeButton,
        this.resetNicknameButton,
        this.input,
      ),
      e.root.append(this.panel));
  }
  options;
  panel;
  importButton;
  deleteButton;
  exportButton;
  samplingModeButton;
  resetNicknameButton;
  input;
  disposed = !1;
  importRevision = 0;
  pendingTrackSwitch;
  static attach(e) {
    return new Ly(e);
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.importButton.removeEventListener("click", this.openPicker),
      this.deleteButton.removeEventListener("click", this.onDeleteClick),
      this.exportButton.removeEventListener("click", this.onExportClick),
      this.samplingModeButton.removeEventListener(
        "click",
        this.onSamplingModeToggle,
      ),
      this.resetNicknameButton.removeEventListener(
        "click",
        this.options.resetNickname,
      ),
      this.input.removeEventListener("change", this.onFileSelected),
      this.panel.remove());
  }
  refreshSamplingModeLabel() {
    const e = this.options.samplingMode();
    ((this.samplingModeButton.textContent = `幽灵插值：${qh0[e]}`),
      this.samplingModeButton.setAttribute(
        "aria-pressed",
        String(e !== "native"),
      ));
  }
  onSamplingModeToggle = () => {
    const e = Xh0(this.options.samplingMode());
    (jh0(e),
      this.refreshSamplingModeLabel(),
      this.options.onSamplingModeChange(e));
  };
  openPicker = () => {
    ((this.input.value = ""), this.input.click());
  };
  onFileSelected = () => {
    this.importSelectedFile();
  };
  onDeleteClick = () => {
    this.deleteGhost();
  };
  onExportClick = () => {
    this.exportGhost();
  };
    async deleteGhost() { return deleteGhostFromMenu(this); }
    async exportGhost() { return exportGhostFromMenu(this); }
    async importSelectedFile() { return importSelectedGhostFile(this, ghostMenuImportDependencies); }
    isCurrentImport(revision) { return isCurrentGhostImport(this, revision); }
    async switchToImportedTrack(selection, zCeiling, frameCount, revision) { return switchToImportedGhostTrack(this, selection, zCeiling, frameCount, revision, ghostMenuImportDependencies); }
}

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



class Py {
  constructor(e, t) {
    ((this.width = e),
      (this.height = t),
      (this.renderer.outputColorSpace = qe),
      this.renderer.setClearColor(0, 0),
      this.renderer.setSize(e, t, !1),
      (this.camera = Qs("preview", e, t)));
  }
  width;
  height;
  renderer = new I4({
    alpha: !0,
    preserveDrawingBuffer: !0,
    powerPreference: "high-performance",
  });
  camera;
  pixelRatio = 1;
  generation = 0;
  loaded;
  lastError;
  static create(e, t) {
    return new Py(e, t);
  }
  get ready() {
    return this.loaded !== void 0;
  }
  setPixelRatio(e) {
    Math.abs(this.pixelRatio - e) < 0.001 ||
      ((this.pixelRatio = e),
      this.renderer.setDrawingBufferSize(this.width, this.height, e));
  }
  async setSubject(e) {
    const t = ++this.generation,
      { library: i, environment: r, stageBinding: s, subject: o } = e;
    let a;
    try {
      if (
        ((a = await T7(
          i,
          o.kartItem,
          o.characterItem,
          r,
          s,
          new Tr(),
          "preview",
          o.profile,
        )),
        t !== this.generation)
      ) {
        Lt(a);
        return;
      }
      const c = this.loaded;
      ((this.loaded = { preview: a, stageBinding: s }),
        (this.lastError = void 0),
        c && Lt(c.preview));
    } catch (c) {
      (a && Lt(a),
        t === this.generation &&
          (this.lastError = c instanceof Error ? c.message : String(c)));
    }
  }
  render(e, t, i) {
    const r = this.loaded;
    if (!r) return;
    const { preview: s, stageBinding: o } = r;
    (o.beginFrame(i),
      s.kart.animation.updateCurrentState(i),
      T4(s, i, this.camera, this.width, this.height),
      s.flyingPet?.update(i, this.camera, this.width, this.height),
      s.decorations.forEach((a) =>
        a.scene.update(i, this.camera, this.width, this.height),
      ),
      f4(this.renderer, s.scene, this.camera),
      e.drawImage(this.renderer.domElement, t.x, t.y, t.width, t.height));
  }
  dispose() {
    ((this.generation += 1),
      this.loaded && Lt(this.loaded.preview),
      (this.loaded = void 0),
      this.renderer.dispose());
  }
}

const Ad0 = "stage_/newRider/stage_window@zz.bml",
  bd0 = "stage_/newRider/stage_stringBag.bml",
  Md0 = "gui_/monocoque/frame.bml",
  xd0 = "gui_/monocoque/config.bml",
  UD = "stage_/newRider/createCharacter_bg.png",
  $D = "stage_/newRider/createCha_infoIcon.png",
  WD = [
    "stage_/newRider/createCharacter_icon_1.png",
    "stage_/newRider/createCharacter_icon_2.png",
    "stage_/newRider/createCharacter_icon_3.png",
  ],
  $t = "P3528 Source Han Sans CN Ready",
  H3 = 1600,
  q3 = 900,
  mm = 4,
  Sd0 = 2,
  gs = mm * Sd0,
  Cd0 = [
    "stage_/newRider/newRiderItem@cn.bml",
    "stage_/newRider/newRiderItem@zz.bml",
  ],
  Ed0 = "确定",
  Vc = new WeakMap();

function n1(n, e) {
  const t = n.children.find((i) => T(i, "name") === e);
  if (!t) throw new Error(`原车手注册窗口缺少 ${e}。`);
  return t;
}

function F3(n, e) {
  const t = n.children.find((s) => T(s, "n") === e),
    i =
      t?.children.find((s) => T(s, "c") === "cn") ??
      t?.children.find((s) => T(s, "c") === "kr"),
    r = i ? T(i, "v") : void 0;
  if (!r) throw new Error(`原车手注册串袋缺少 ${e}。`);
  return r;
}

function ms(n) {
  return n.children.filter((e) => e.name === "Label");
}

async function Td0(n) {
  const e = (O) => {
      const F = n.exactCanonicalCandidates(O);
      if (F.length !== 1) throw new Error(`车手注册资源缺失或不唯一：${O}`);
      return F[0];
    },
    [t, i, r, s] = await Promise.all(
      [Ad0, bd0, Md0, xd0].map(async (O) => s2(await e(O).bytes())),
    );
  let o;
  const a = Cd0.map((O) => {
      const F = n.exactCanonicalCandidates(O);
      if (F.length !== 1)
        throw new Error(`车手注册白名单资源缺失或不唯一：${O}`);
      return F[0].bytes().then((z) => s2(z));
    }),
    [c, l] = await Promise.all(a);
  for (const O of [c, l])
    if (O.name !== "newRiderItem")
      throw new Error("newRiderItem 根节点不是 newRiderItem。");
  const u = (O, F) =>
    O.children
      .filter((z) => z.name === F)
      .map((z) => Number(T(z, "id")))
      .filter((z) => Number.isInteger(z) && z > 0);
  o = {
    characters: u(c, "character"),
    paints: u(l, "color"),
    dyes: u(l, "color"),
  };
  const h = t.children.find((O) => O.name === "CaptionWindow");
  if (!h) throw new Error("原车手注册窗口缺少 CaptionWindow。");
  const d = n1(h, "bg"),
    f = n1(d, "step1"),
    p = n1(d, "step2"),
    v = [],
    w = (O, F) => {
      (O.name === "RenderPanel" && v.push({ node: O, parent: F }),
        O.children.forEach((z) => w(z, O)));
    };
  if ((w(h, h), v.length !== 1))
    throw new Error(
      `原车手注册窗口的 RenderPanel 数量必须为 1，实际 ${v.length}。`,
    );
  if (v[0].parent !== f)
    throw new Error("原车手注册窗口的 RenderPanel 未按原生挂在 step1 下。");
  const g = v[0].node,
    y = n1(f, "descPlane"),
    b = f.children.find(
      (O) =>
        O.name === "Container" &&
        O.children.some((F) => T(F, "text") === "#sb(warningDetail0)"),
    ),
    A = f.children.find(
      (O) =>
        O.name === "Container" &&
        O.children.some((F) => T(F, "text") === "#sb(warningDetail4)"),
    ),
    x = n1(f, "라이더이름"),
    M = n1(x, "라이더이름입력"),
    E = f.children.find(
      (O) =>
        O.name === "Container" &&
        O.children.some((F) => T(F, "name") === "완료"),
    ),
    _ = p.children.find(
      (O) =>
        O.name === "Window" &&
        O.children.some((F) => T(F, "name") === "riderId"),
    ),
    C = p.children.find(
      (O) =>
        O.name === "Container" &&
        O.children.some((F) => T(F, "name") === "nextStep"),
    );
  if (!b || !A || !E || !_ || !C)
    throw new Error("原车手注册窗口缺少警告、按钮或确认区。");
  const S = n1(f, "itemSelect"),
    G = n1(S, "characterCont"),
    I = n1(S, "dyeCont"),
    L = n1(S, "colorCont"),
    k = [n1(G, "characterList"), n1(I, "dyeList"), n1(L, "colorList")],
    D = [
      G.children.find(
        (O) => O.name === "Label" && T(O, "text") === "#sb(selectCharacter)",
      ),
      I.children.find(
        (O) => O.name === "Label" && T(O, "text") === "#sb(selectDye)",
      ),
      L.children.find(
        (O) => O.name === "Label" && T(O, "text") === "#sb(selectPaint)",
      ),
    ],
    V = [n1(G, "iconPanel"), n1(I, "iconPanel"), n1(L, "iconPanel")];
  if (D.some((O) => O === void 0))
    throw new Error("原车手注册窗口缺少选择区标题。");
  const K = Number(T(M, "maxChar"));
  if (!Number.isInteger(K) || K <= 0)
    throw new Error("原车手注册输入框缺少有效 maxChar。");
  const P = new Map();
  for (const O of r.children)
    O.children.length &&
      P.set(O.name, new Map(O.children.map((F) => [F.name, Ft(F)])));
  const q = T(M, "frame") ?? "DefaultEdit";
  for (const O of [
    T(h, "frame"),
    q,
    "DefaultFocusedButton",
    "DefaultScrollUpButton",
    "DefaultScrollDownButton",
  ])
    if (!P.has(O)) throw new Error(`车手注册窗口缺少 ${O} 原版皮肤。`);
  const e0 = ms(x);
  if (e0.length === 0) throw new Error("原车手注册窗口缺少名称提示 Label。");
  const Q = ms(y);
  if (Q.length === 0) throw new Error("原车手注册窗口缺少警告标题 Label。");
  const U = ms(_);
  if (U.length === 0) throw new Error("原车手注册窗口缺少确认页 Label。");
  return {
    dialog: h,
    bg: d,
    previewPanel: g,
    step1: f,
    step2: p,
    itemWhitelist: o,
    descPlane: y,
    infoIcon: n1(y, "iconPanel"),
    warningTitle: Q[0],
    warningDetailBoxes: [b, A],
    warningDetails: [...ms(b), ...ms(A)],
    itemSelect: S,
    grids: k,
    sectionLabels: D,
    sectionIcons: V,
    nameBox: x,
    inputPrompt: e0[0],
    edit: M,
    step1ButtonBox: E,
    step1Button: n1(E, "완료"),
    step2Intro: _,
    traineeLabel: U[0],
    riderIdLabel: n1(_, "riderId"),
    step2ButtonBox: C,
    step2Button: n1(C, "nextStep"),
    frames: P,
    config: s,
    texts: {
      caption: F3(i, "newRiderCaption"),
      warningTitle: F3(i, "warningBold"),
      warningDetails: [
        "warningDetail0",
        "warningDetail1",
        "warningDetail2_3",
        "warningDetail4",
      ].map((O) => F3(i, O)),
      inputPrompt: F3(i, "inputRiderId"),
      nextStep: F3(i, "nextStep"),
      trainee: F3(i, "trainee"),
      sectionLabels: ["selectCharacter", "selectDye", "selectPaint"].map((O) =>
        F3(i, O),
      ),
    },
    maxChar: K,
  };
}

function U5(n, e, t) {
  return n.frames.get(e).get(t);
}

function Y_(n) {
  const e = T(n.dialog, "frame"),
    t = U5(n, e, "Activated"),
    i = { x: 0, y: 0, width: H3, height: q3 },
    r = V0(n.dialog, i, t),
    s = E9(t, r),
    o = V0(n.bg, s),
    a = V0(n.step1, o),
    c = V0(n.step2, o),
    l = V0(n.descPlane, a),
    u = V0(n.infoIcon, l),
    h = V0(n.warningTitle, l),
    d = n.warningDetailBoxes.flatMap((G) => {
      const I = V0(G, a);
      return G.children.filter((L) => L.name === "Label").map((L) => V0(L, I));
    }),
    f = V0(n.itemSelect, a),
    p = [
      V0(n1(n.itemSelect, "characterCont"), f),
      V0(n1(n.itemSelect, "dyeCont"), f),
      V0(n1(n.itemSelect, "colorCont"), f),
    ],
    v = n.sectionLabels.map((G, I) => V0(G, p[I])),
    w = n.sectionIcons.map((G, I) => V0(G, p[I])),
    g = n.grids.map((G, I) => V0(G, p[I])),
    y = V0(n.nameBox, a),
    b = V0(n.inputPrompt, y),
    A = V0(n.edit, y, U5(n, T(n.edit, "frame") ?? "DefaultEdit", "Activated")),
    x = V0(
      n.step1Button,
      V0(n.step1ButtonBox, a),
      U5(n, T(n.step1Button, "frame"), "Normal"),
    ),
    M = V0(n.step2Intro, c),
    E = V0(n.traineeLabel, M),
    _ = V0(n.riderIdLabel, M),
    C = V0(
      n.step2Button,
      V0(n.step2ButtonBox, c),
      U5(n, T(n.step2Button, "frame"), "Normal"),
    ),
    S = V0(n.previewPanel, a);
  return {
    window: r,
    bg: o,
    preview: S,
    captionText: f3(t, r, an(n.dialog, n.config)),
    infoIcon: u,
    warningTitle: h,
    warningDetails: d,
    sectionLabels: v,
    sectionIcons: w,
    grids: g,
    inputPrompt: b,
    edit: A,
    step1Button: x,
    trainee: E,
    riderId: _,
    step2Button: C,
  };
}

async function _d0(n) {
  let e = Vc.get(n);
  return (
    e ||
    ((e = (async () => {
      const t = await Td0(n),
        i = [
          T(t.dialog, "frame"),
          T(t.edit, "frame") ?? "DefaultEdit",
          "DefaultFocusedButton",
          "DefaultScrollUpButton",
          "DefaultScrollDownButton",
        ],
        r = [];
      for (const u of i)
        for (const h of t.frames.get(u).values())
          h.texture !== "" && r.push(`gui_/monocoque/${h.texture}.png`);
      const s = [...new Set(r)],
        o = [1, 2, 3, 4],
        a = [
          ...t.itemWhitelist.characters.flatMap((u) =>
            o.map((h) => `stage_/newRider/1_${u}_${h}.png`),
          ),
          ...t.itemWhitelist.paints.flatMap((u) =>
            o.map((h) => `stage_/newRider/2_${u}_${h}.png`),
          ),
          ...t.itemWhitelist.dyes.flatMap((u) =>
            o.map((h) => `stage_/newRider/2_${u}_${h}.png`),
          ),
        ],
        c = [...s, UD, $D, ...WD],
        l = new Map();
      try {
        return (
          await Promise.all(
            c.map(async (u) => {
              const h = n.exactCanonicalCandidates(u);
              if (h.length !== 1)
                throw new Error(`车手注册贴图缺失或不唯一：${u}`);
              l.set(
                u,
                await $p(
                  await createImageBitmap(
                    new Blob([await h[0].bytes()], { type: "image/png" }),
                  ),
                ),
              );
            }),
          ),
          await Promise.all(
            a.map(async (u) => {
              const h = n.exactCanonicalCandidates(u);
              h.length === 1 &&
                l.set(
                  u,
                  await $p(
                    await createImageBitmap(
                      new Blob([await h[0].bytes()], { type: "image/png" }),
                    ),
                  ),
                );
            }),
          ),
          { blueprint: t, images: l }
        );
      } catch (u) {
        throw (l.forEach((h) => h.close()), u);
      }
    })()),
    Vc.set(n, e),
    e.catch(() => {
      Vc.get(n) === e && Vc.delete(n);
    }),
    e)
  );
}

function Gd0(n, e) {
  return n.trim().slice(0, e).trim();
}

class Fy {
  constructor(e, t, i, r, s) {
    ((this.blueprint = t), (this.images = i), (this.previewContext = s));
    const o = (l, u) =>
      u.map((h) => l.find((d) => d.itemId === h)).filter((h) => h !== void 0);
    this.choices = {
      characters: o(r.characters, t.itemWhitelist.characters),
      paints: o(r.paints, t.itemWhitelist.paints),
      dyes: o(r.dyes, t.itemWhitelist.dyes),
      defaults: r.defaults,
    };
    const a = (l, u) =>
      this.choicesOf(l).some((h) => h.itemId === u)
        ? u
        : (this.choicesOf(l)[0]?.itemId ?? u);
    ((this.picked = [
      a(0, r.defaults.character),
      a(1, r.defaults.dye),
      a(2, r.defaults.paint),
    ]),
      (this.element.className = "new-rider-dialog"),
      (this.element.hidden = !0),
      this.element.setAttribute("role", "dialog"),
      this.element.setAttribute("aria-modal", "true"),
      this.element.setAttribute("aria-label", this.blueprint.texts.caption),
      (this.canvas.className = "new-rider-dialog-canvas"),
      (this.canvas.width = H3),
      (this.canvas.height = q3));
    const c = this.canvas.getContext("2d");
    if (!c) throw new Error("车手注册画布不可用。");
    ((this.context = c),
      (this.context.imageSmoothingEnabled = !0),
      (this.input.type = "text"),
      (this.input.className = "window-edit"),
      (this.input.maxLength = this.blueprint.maxChar),
      (this.input.spellcheck = !1),
      (this.input.autocomplete = "off"),
      Object.assign(this.input.style, {
        color: "rgb(42, 55, 80)",
        font: `14px "${$t}"`,
        textAlign: "center",
      }),
      this.input.setAttribute("aria-label", this.blueprint.texts.inputPrompt));
    for (const l of [this.step1Button, this.step2Button])
      ((l.type = "button"),
        (l.className = "new-rider-hit"),
        l.addEventListener("pointerenter", () => {
          ((this.hovered = l), this.paint());
        }),
        l.addEventListener("pointerleave", () => {
          (this.hovered === l && (this.hovered = void 0),
            this.pressed === l && (this.pressed = void 0),
            this.paint());
        }),
        l.addEventListener("pointerdown", () => {
          ((this.pressed = l), this.paint());
        }),
        l.addEventListener("pointerup", () => {
          (this.pressed === l && (this.pressed = void 0), this.paint());
        }));
    (this.step1Button.addEventListener("click", () => this.submitStep1()),
      this.step2Button.addEventListener("click", () => this.settle()),
      this.canvas.addEventListener("pointerdown", this.onCanvasPointerDown),
      this.canvas.addEventListener("pointermove", this.onCanvasPointerMove),
      this.canvas.addEventListener("pointerleave", this.onCanvasPointerLeave),
      this.element.addEventListener("keydown", (l) => {
        (l.stopPropagation(),
          l.key === "Enter" &&
            (l.preventDefault(),
            this.step === 1 ? this.submitStep1() : this.settle()));
      }),
      this.element.append(
        this.canvas,
        this.input,
        this.step1Button,
        this.step2Button,
      ),
      e.append(this.element),
      window.addEventListener("resize", this.onResize));
  }
  blueprint;
  images;
  element = document.createElement("div");
  canvas = document.createElement("canvas");
  context;
  input = document.createElement("input");
  step1Button = document.createElement("button");
  step2Button = document.createElement("button");
  choices;
  picked;
  pages = [0, 0, 0];
  cellHits = [];
  step = 1;
  name = "";
  isOpen_ = !1;
  pending;
  resolvePending;
  disposed = !1;
  hovered;
  pressed;
  hoveredCell;
  onResize = () => this.paint();
  previewContext;
  previewPanel;
  raf = 0;
  onFrame = () => {
    if (!this.isOpen_) {
      this.raf = 0;
      return;
    }
    (this.paint(),
      this.raf && (this.raf = requestAnimationFrame(this.onFrame)));
  };
  static async load(e, t, i, r) {
    const { blueprint: s, images: o } = await _d0(e);
    return new Fy(t, s, o, i, r);
  }
  get isOpen() {
    return this.isOpen_;
  }
  open() {
    return this.disposed
      ? Promise.reject(new Error("车手注册窗口已释放。"))
      : this.isOpen_
        ? (this.pending ?? Promise.reject(new Error("车手注册窗口未就绪。")))
        : ((this.step = 1),
          (this.name = ""),
          (this.input.value = ""),
          (this.isOpen_ = !0),
          (this.element.hidden = !1),
          this.ensurePreview(),
          this.startAnimation(),
          this.paint(),
          this.input.focus(),
          (this.pending = new Promise((e) => {
            this.resolvePending = e;
          })),
          this.pending);
  }
  submitStep1() {
    const e = Gd0(this.input.value, this.blueprint.maxChar);
    e &&
      ((this.name = e),
      (this.step = 2),
      this.input.blur(),
      this.paint(),
      this.step2Button.focus());
  }
  ensurePreview() {
    const e = this.previewContext;
    if (!e || this.previewPanel) return;
    const t = this.previewSubject();
    if (!t) return;
    const { preview: i } = Y_(this.blueprint),
      r = Py.create(i.width, i.height);
    ((this.previewPanel = r),
      r.setPixelRatio(xe()),
      r.setSubject({
        library: e.library,
        environment: e.environment,
        stageBinding: e.stageBinding,
        subject: t,
      }));
  }
  previewSubject() {
    const e = this.previewContext;
    if (!e) return;
    const t = e.characterItems.find((r) => r.itemId === this.picked[0]);
    if (!t) return;
    const i = e.profile;
    return {
      kartItem: e.kartItem,
      characterItem: t,
      profile: {
        ...i,
        equipment: {
          ...i.equipment,
          itemIds: {
            ...i.equipment.itemIds,
            1: this.picked[0],
            2: this.picked[2],
            70: this.picked[1],
          },
        },
      },
    };
  }
  updatePreviewSubject() {
    const e = this.previewPanel,
      t = this.previewContext;
    if (!e || !t) return;
    const i = this.previewSubject();
    i &&
      e.setSubject({
        library: t.library,
        environment: t.environment,
        stageBinding: t.stageBinding,
        subject: i,
      });
  }
  startAnimation() {
    this.raf || (this.raf = requestAnimationFrame(this.onFrame));
  }
  settle() {
    if (!this.isOpen_ || !this.name) return;
    ((this.isOpen_ = !1), (this.element.hidden = !0));
    const e = {
        name: this.name,
        characterItemId: this.picked[0],
        paintItemId: this.picked[2],
        dyeItemId: this.picked[1],
      },
      t = this.resolvePending;
    ((this.resolvePending = void 0), (this.pending = void 0), t?.(e));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      (this.isOpen_ = !1),
      this.raf && cancelAnimationFrame(this.raf),
      (this.raf = 0),
      this.previewPanel?.dispose(),
      (this.previewPanel = void 0),
      window.removeEventListener("resize", this.onResize),
      this.element.remove());
  }
  onCanvasPointerDown = (e) => {
    if (this.step !== 1) return;
    const [t, i] = this.canvasPoint(e);
    for (const r of this.cellHits)
      if (Oe(t, i, r.rect)) {
        if ("choice" in r) this.picked[r.section] = r.choice.itemId;
        else {
          const s = this.choicesOf(r.section).length,
            o = Math.max(1, Math.ceil(s / gs));
          this.pages[r.section] =
            (this.pages[r.section] + (r.forward ? 1 : o - 1)) % o;
        }
        (this.updatePreviewSubject(), this.paint());
        return;
      }
  };
  onCanvasPointerMove = (e) => {
    if (this.step !== 1) return;
    const [t, i] = this.canvasPoint(e),
      r = this.cellAt(t, i),
      s = r ? { section: r.section, itemId: r.choice.itemId } : void 0;
    (s?.section === this.hoveredCell?.section &&
      s?.itemId === this.hoveredCell?.itemId) ||
      ((this.hoveredCell = s), this.paint());
  };
  onCanvasPointerLeave = () => {
    this.hoveredCell && ((this.hoveredCell = void 0), this.paint());
  };
  canvasPoint(e) {
    const t = this.canvas.getBoundingClientRect();
    return [
      ((e.clientX - t.left) * H3) / t.width,
      ((e.clientY - t.top) * q3) / t.height,
    ];
  }
  cellAt(e, t) {
    for (const i of this.cellHits)
      if ("choice" in i && Oe(e, t, i.rect)) return i;
  }
  choicesOf(e) {
    return e === 0
      ? this.choices.characters
      : e === 1
        ? this.choices.dyes
        : this.choices.paints;
  }
  paint(e = performance.now()) {
    if (!this.isOpen_) return;
    const t = Y_(this.blueprint),
      i = this.canvas.getBoundingClientRect(),
      r = i.width / H3,
      s = i.height / q3;
    (p3(this.canvas, this.context, i.width, i.height, xe(), H3, q3),
      (this.context.imageSmoothingEnabled = !0),
      this.context.clearRect(0, 0, H3, q3));
    const o = T(this.blueprint.dialog, "frame"),
      a = U5(this.blueprint, o, "Activated"),
      c = (l) => this.images.get(`gui_/monocoque/${l.texture}.png`);
    if (
      (C9(this.context, a, c(a), t.window),
      this.context.drawImage(
        this.images.get(UD),
        t.bg.x,
        t.bg.y,
        t.bg.width,
        t.bg.height,
      ),
      this.previewPanel?.setPixelRatio(xe()),
      this.previewPanel?.render(this.context, t.preview, e),
      m9(this.context, this.blueprint.texts.caption, t.captionText, {
        family: $t,
        size: 20,
        color: "white",
        kind: "button",
        align: "center",
        verticalAlign: "center",
      }),
      this.step === 1)
    ) {
      (this.context.drawImage(
        this.images.get($D),
        t.infoIcon.x,
        t.infoIcon.y,
        t.infoIcon.width,
        t.infoIcon.height,
      ),
        m9(this.context, this.blueprint.texts.warningTitle, t.warningTitle, {
          family: $t,
          size: 16,
          color: "white",
          kind: "label",
          align: "left",
          verticalAlign: "top",
        }),
        this.blueprint.texts.warningDetails.forEach((h, d) => {
          m9(this.context, h, t.warningDetails[d] ?? t.warningTitle, {
            family: $t,
            size: 14,
            color: "rgb(255, 69, 69)",
            kind: "label",
            align: "left",
            verticalAlign: "top",
          });
        }),
        t.sectionLabels.forEach((h, d) => {
          const f = d;
          this.choicesOf(f).length !== 0 &&
            (this.context.drawImage(
              this.images.get(WD[d]),
              t.sectionIcons[d].x,
              t.sectionIcons[d].y,
              t.sectionIcons[d].width,
              t.sectionIcons[d].height,
            ),
            m9(this.context, this.blueprint.texts.sectionLabels[d], h, {
              family: $t,
              size: 16,
              color: "rgb(187, 198, 215)",
              kind: "label",
              align: "left",
              verticalAlign: "top",
            }));
        }));
      const l = [];
      ([0, 1, 2].forEach((h) => {
        this.paintGrid(h, t.grids[h], l);
      }),
        (this.cellHits = l),
        m9(this.context, this.blueprint.texts.inputPrompt, t.inputPrompt, {
          family: $t,
          size: 16,
          color: "white",
          stroke: 1,
          strokeColor: "rgb(42, 55, 80)",
          kind: "label",
          align: "center",
          verticalAlign: "center",
        }));
      const u = U5(
        this.blueprint,
        T(this.blueprint.edit, "frame") ?? "DefaultEdit",
        "Activated",
      );
      (C9(this.context, u, c(u), t.edit),
        aw(this.input, t.edit, r, s),
        (this.input.hidden = !1),
        this.paintButton(
          this.step1Button,
          this.blueprint.texts.nextStep,
          t.step1Button,
        ),
        this.positionHit(this.step2Button));
    } else
      ((this.input.hidden = !0),
        m9(this.context, this.blueprint.texts.trainee, t.trainee, {
          family: $t,
          size: 14,
          color: "rgb(221, 232, 255)",
          kind: "label",
          align: "center",
          verticalAlign: "top",
        }),
        m9(this.context, this.name, t.riderId, {
          family: $t,
          size: 20,
          color: "white",
          kind: "label",
          align: "center",
          verticalAlign: "top",
        }),
        this.paintButton(this.step2Button, Ed0, t.step2Button),
        this.positionHit(this.step1Button));
  }
  paintGrid(e, t, i) {
    const r = e === 0 ? "1" : "2",
      s = this.choicesOf(e),
      o = Math.max(1, Math.ceil(s.length / gs)),
      a = Math.min(this.pages[e], o - 1);
    this.pages[e] = a;
    const c = 10,
      l = 6,
      u = 4,
      h = t.x + l,
      d = t.y + u,
      f = e === 0 ? 52 : 38,
      p = f;
    if (
      (s.slice(a * gs, a * gs + gs).forEach((w, g) => {
        const y = {
            x: h + (g % mm) * (f + c),
            y: d + Math.floor(g / mm) * (p + c),
            width: f,
            height: p,
          },
          b = this.picked[e] === w.itemId,
          A =
            this.hoveredCell?.section === e &&
            this.hoveredCell?.itemId === w.itemId,
          x = b && A ? 4 : b ? 3 : A ? 2 : 1,
          M =
            this.images.get(`stage_/newRider/${r}_${w.itemId}_${x}.png`) ??
            this.images.get(`stage_/newRider/${r}_${w.itemId}_1.png`);
        (M
          ? this.context.drawImage(M, y.x, y.y)
          : m9(
              this.context,
              w.title,
              {
                x: y.x + 4,
                y: y.y + 4,
                width: y.width - 8,
                height: y.height - 8,
              },
              {
                family: $t,
                size: 12,
                color: b ? "white" : "rgb(146, 158, 178)",
                kind: "label",
                align: "center",
                verticalAlign: "center",
              },
            ),
          i.push({ rect: y, section: e, choice: w }));
      }),
      o > 1)
    ) {
      const w = U5(this.blueprint, "DefaultScrollUpButton", "Normal"),
        g = U5(this.blueprint, "DefaultScrollDownButton", "Normal"),
        y = [
          {
            x: t.x + t.width - 44,
            y: t.y + t.height - 20,
            width: 20,
            height: 20,
          },
          {
            x: t.x + t.width - 22,
            y: t.y + t.height - 20,
            width: 20,
            height: 20,
          },
        ];
      (C9(
        this.context,
        w,
        this.images.get(`gui_/monocoque/${w.texture}.png`),
        y[0],
      ),
        C9(
          this.context,
          g,
          this.images.get(`gui_/monocoque/${g.texture}.png`),
          y[1],
        ),
        i.push({ rect: y[0], section: e, forward: !1 }),
        i.push({ rect: y[1], section: e, forward: !0 }));
    }
  }
  paintButton(e, t, i) {
    const r = this.hovered === e || e.matches(":hover"),
      s = this.pressed === e ? "Clicked" : r ? "MouseOn" : "Normal",
      o = U5(this.blueprint, "DefaultFocusedButton", s),
      a = this.images.get(`gui_/monocoque/${o.texture}.png`);
    (C9(this.context, o, a, i),
      m9(this.context, t, E9(o, i), {
        family: $t,
        size: 16,
        color: "white",
        kind: "button",
        align: "center",
        verticalAlign: "center",
      }),
      this.positionHit(e, i));
  }
  positionHit(e, t) {
    if (!t) {
      e.style.display = "none";
      return;
    }
    e.style.display = "block";
    const i = this.canvas.getBoundingClientRect(),
      r = i.width / H3,
      s = i.height / q3;
    Object.assign(e.style, {
      left: `${t.x * r}px`,
      top: `${t.y * s}px`,
      width: `${t.width}px`,
      height: `${t.height}px`,
      transformOrigin: "top left",
      transform: `scale(${r}, ${s})`,
    });
  }
}

class Bd0 {
  flyingPet;
  vehicleRender;
  characterRender;
  pendingCharacterFinishMotion = 0;
  linkedCharacterRender;
  linkedCharacterPresentation;
  balloonDecoration;
  characterDecorations = [];
  raceAura;
  ghosts = [];
  rankColors = [];
  localName = "";
  outlineBatch;
  warpBlackBar;
  warpHud;
  kartEffects;
  kartTrails;
  kartDriftEffects;
  kartMotionBlur;
  zetAirEffect;
  shockWaveEffect;
  exhaustEffect;
  crashEffect;
  chargerEffect;
  particleModification;
  particleModificationBanner;
  particleModificationBannerRequest;
  lampFlares;
  simpleShadow;
  track;
  coordinator;
  trackEventEffects;
  trackEventAudio;
  trackDummyAudio;
  rain;
  rainAudio;
  snow;
  admission;
  physics;
  lifecycle = new GF();
  selection;
  vehicleTitle = "";
  speedResetState = pr();
  toonEnvironment;
  trackMetadata;
  tachometer;
  pause;
  readyCamera;
  warpNextCamera;
  driveCameraState;
  surroundCameraState;
  cameraMode = "ready";
  warpCameraFrozen = !1;
}

class Rd0 {
  constructor(e) {
    this.definition = e;
  }
  definition;
  renderer = new fn(new Map());
  values;
  width = -1;
  height = -1;
  show(e) {
    ((this.values = { ...e }), (this.width = -1), (this.height = -1));
  }
  hide() {
    ((this.values = void 0),
      (this.width = -1),
      (this.height = -1),
      this.renderer.update([], 0));
  }
  render(e, t, i) {
    this.values &&
      ((t !== this.width || i !== this.height) &&
        this.update(this.values, t, i),
      this.renderer.render(e, t, i));
  }
  dispose() {
    (this.hide(), this.renderer.dispose());
  }
  update(e, t, i) {
    (this.renderer.update(gX(this.definition, e, t, i), 0),
      (this.width = t),
      (this.height = i));
  }
}

const ws = 1600,
  vs = 900,
  Id0 = "stage_speedIndiGame.rho",
  kd0 = "stage_/speedIndiGame/retryPopup_2btn.bml",
  Ld0 = "stage_common.rho",
  Pd0 = "stage_/common",
  Wf = "gui_monocoque.rho",
  Fd0 = "gui_/monocoque/frame01.png",
  Dd0 = "gui_/monocoque/frame.bml",
  Vd0 = "gui_/monocoque/config.bml",
  Nd0 = "gui_font.rho",
  Od0 = "gui_/font/SourceHanSansCN-Bold.otf",
  HD = "etc_/baseStringBag.xml",
  qD = "P3528 Source Han Sans CN Pause";

class Dy {
  constructor(e, t) {
    ((this.options = e), (this.assets = t));
    const i = this.canvas.getContext("2d", { alpha: !0 });
    if (!i)
      throw new Error("浏览器无法创建 P3528 TimeAttack 暂停菜单 Canvas。");
    ((this.context = i),
      Object.assign(this.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        imageRendering: "auto",
        pointerEvents: "auto",
      }),
      (this.canvas.dataset.uiLayer = "dialog"),
      (this.canvas.hidden = !0),
      (this.canvas.tabIndex = 0),
      this.canvas.setAttribute("role", "dialog"),
      this.canvas.setAttribute("aria-hidden", "true"),
      this.canvas.setAttribute("aria-label", wm(t.strings, "menu")),
      this.canvas.addEventListener("pointermove", this.onPointerMove),
      this.canvas.addEventListener("pointerdown", this.onPointerDown),
      this.canvas.addEventListener("pointerup", this.onPointerUp),
      this.canvas.addEventListener("pointercancel", this.onPointerCancel),
      this.canvas.addEventListener("pointerleave", this.onPointerLeave),
      e.root.append(this.canvas),
      (this.resizeObserver = new ResizeObserver(() => this.render())),
      this.resizeObserver.observe(e.root),
      window.addEventListener("resize", this.onWindowResize));
  }
  options;
  assets;
  canvas = document.createElement("canvas");
  context;
  resizeObserver;
  hits = [];
  hovered;
  pressed;
  visible = !1;
  disposed = !1;
  onWindowResize = () => this.render();
  static async load(e) {
    const t = await zd0(e.library);
    try {
      return new Dy(e, t);
    } catch (i) {
      throw (G1(t.font), i);
    }
  }
  setVisible(e) {
    this.disposed ||
      this.visible === e ||
      ((this.visible = e),
      (this.hovered = void 0),
      (this.pressed = void 0),
      (this.canvas.hidden = !e),
      this.canvas.setAttribute("aria-hidden", String(!e)),
      e && (this.render(), this.canvas.focus()));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.resizeObserver.disconnect(),
      window.removeEventListener("resize", this.onWindowResize),
      this.canvas.removeEventListener("pointermove", this.onPointerMove),
      this.canvas.removeEventListener("pointerdown", this.onPointerDown),
      this.canvas.removeEventListener("pointerup", this.onPointerUp),
      this.canvas.removeEventListener("pointercancel", this.onPointerCancel),
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave),
      this.canvas.remove(),
      G1(this.assets.font));
  }
  render() {
    if (!this.visible || this.disposed) return;
    (this.resizeCanvas(),
      this.context.clearRect(0, 0, ws, vs),
      (this.context.imageSmoothingEnabled = Co()),
      (this.context.fillStyle = `rgba(0, 0, 0, ${this.assets.overlayAlpha})`),
      this.context.fillRect(0, 0, ws, vs));
    const e = this.dialogRect();
    C9(this.context, this.assets.captionFrame, this.assets.frame.image, e);
    const t = f3(this.assets.captionFrame, e, this.assets.captionOffset);
    (m9(this.context, wm(this.assets.strings, "menu"), t, {
      family: qD,
      size: 20,
      kind: "button",
      color: "white",
      align: "center",
      verticalAlign: "center",
    }),
      (this.hits = Wd0(this.assets, e)),
      this.drawButton("retry", this.assets.retry),
      this.drawButton("menu", this.assets.menu),
      this.drawButton("resume", this.assets.close),
      (this.canvas.style.cursor =
        this.hovered === void 0 ? "default" : "pointer"));
  }
  drawButton(e, t) {
    const i = this.hits.find((s) => s.action === e);
    if (!i) throw new Error(`P3528 pause button ${e} 缺少布局。`);
    const r = st(e, this.hovered, this.pressed);
    ct(this.context, t[r], i.rect);
  }
  resizeCanvas() {
    const e = this.options.root.getBoundingClientRect();
    p3(this.canvas, this.context, e.width, e.height, xe(), ws, vs, 1600, 900);
  }
  dialogRect() {
    return V0(
      j5(this.assets.definition, "CaptionWindow"),
      { x: 0, y: 0, width: ws, height: vs },
      this.assets.captionFrame,
    );
  }
  hitAt(e) {
    const t = this.canvas.getBoundingClientRect(),
      i = ((e.clientX - t.left) * ws) / t.width,
      r = ((e.clientY - t.top) * vs) / t.height;
    return this.hits.find((s) => Oe(i, r, s.rect));
  }
  onPointerMove = (e) => {
    const t = this.hitAt(e)?.action;
    t !== this.hovered &&
      ((this.hovered = t),
      t !== void 0 && this.options.onHover?.(),
      this.render());
  };
  onPointerDown = (e) => {
    const t = this.hitAt(e);
    !t ||
      e.button !== 0 ||
      (this.options.onInteraction?.(),
      (this.hovered = t.action),
      (this.pressed = t.action),
      this.canvas.setPointerCapture(e.pointerId),
      this.render());
  };
  onPointerUp = (e) => {
    const t = this.hitAt(e),
      i = t && t.action === this.pressed ? t.action : void 0;
    ((this.pressed = void 0),
      this.canvas.hasPointerCapture(e.pointerId) &&
        this.canvas.releasePointerCapture(e.pointerId),
      i !== void 0 && this.options.onActivate?.(),
      i === "resume"
        ? this.options.onResume()
        : i === "retry"
          ? this.options.onRetry()
          : i === "menu"
            ? this.options.onMenu()
            : this.render());
  };
  onPointerCancel = (e) => {
    ((this.pressed = void 0),
      this.canvas.hasPointerCapture(e.pointerId) &&
        this.canvas.releasePointerCapture(e.pointerId),
      this.render());
  };
  onPointerLeave = () => {
    ((this.hovered = void 0), this.render());
  };
}

async function zd0(n) {
  const e = Gi(n, kd0, Id0),
    t = XD(n, HD),
    i = Gi(n, Fd0, Wf),
    r = Gi(n, Dd0, Wf),
    s = Gi(n, Vd0, Wf),
    o = Gi(n, Od0, Nd0),
    [a, c, l, u, h, d, f] = await Promise.all([
      e.bytes().then(s2),
      t.text(),
      KD(i),
      Hf(n, "btn_singleAgain_", !0),
      Hf(n, "btn_menu_", !0),
      r.bytes().then(s2),
      s.bytes().then(s2),
    ]),
    p = d.children
      .find((E) => E.name === "CaptionDialog")
      ?.children.find((E) => E.name === "Activated");
  if (!p) throw new Error("P3528 pause 缺少 CaptionDialog.Activated。");
  const v = Ft(p),
    w = j5(j5(f, "CaptionWindow"), "CaptionDialog");
  E1(w, "textRender", "bold20");
  const g = an(j5(a, "CaptionWindow"), f);
  if (v.texture !== "frame01")
    throw new Error(`P3528 pause 未加载 frame ${v.texture}。`);
  const y = Ud0(a),
    b = await ma(n, j5(a, "CaptionWindow"), "stage_/speedIndiGame"),
    A = await Hf(n, Vy(b, "autoLoadImage"), !1);
  (u.forEach((E) => Q_(E, 104, 106, "btn_singleAgain")),
    h.forEach((E) => Q_(E, 104, 106, "btn_menu")));
  const x = Hd0(c);
  ["menu", "retry", "goToMenu", "close"].forEach((E) => wm(x, E));
  const M = await $d0(o);
  return {
    definition: a,
    closeDefinition: b,
    captionFrame: v,
    captionOffset: g,
    frame: l,
    retry: u,
    menu: h,
    close: A,
    strings: x,
    font: M,
    overlayAlpha: y,
  };
}

function Ud0(n) {
  (jD(n, "Panel", "메뉴"),
    E1(n, "windowRect", "fullscreen"),
    E1(n, "alphaBlend", "true"),
    E1(n, "visible", "false"));
  const e = j5(n, "CaptionWindow");
  (E1(e, "frame", "CaptionDialog"),
    E1(e, "caption", "#sb(menu)"),
    E1(e, "windowRect", "0 0 360 180"),
    E1(e, "align", "center"),
    E1(e, "setCloseButton", "cancelButton"));
  const t = j5(e, "Container");
  (E1(t, "windowRect", "0 15 330 120"), E1(t, "align", "hcenter"));
  const i = t.children.filter((r) => r.name === "StateButton");
  if (i.length !== 2)
    throw new Error(`P3528 retryPopup_2btn 应有 2 个按钮，实际 ${i.length}。`);
  return (
    Z_(i[0], "다시시도", "-57 0", "btn_singleAgain@zz", "#sb(retry)"),
    Z_(i[1], "싱글플레이", "57 0", "btn_menu@zz", "#sb(goToMenu)"),
    qd0(Vy(n, "color"))
  );
}

function Z_(n, e, t, i, r) {
  (jD(n, "StateButton", e),
    E1(n, "windowSize", "104 106"),
    E1(n, "align", "center"),
    E1(n, "adjust", t),
    E1(n, "iconSet", i),
    E1(n, "iconAlign", "hcenter"),
    E1(n, "text", r),
    E1(n, "textAlign", "hcenter"),
    E1(n, "stringPos", "0 55"));
}

async function Hf(n, e, t) {
  return Promise.all(
    [1, 2, 3, 4].map((i) => {
      const r = t ? `${i}@cn.png` : `${i}.png`;
      return KD(Gi(n, `${Pd0}/${e}${r}`, Ld0));
    }),
  );
}

async function KD(n) {
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

function Q_(n, e, t, i) {
  if (n.width !== e || n.height !== t)
    throw new Error(
      `P3528 pause ${i} 尺寸 ${n.width}x${n.height}，预期 ${e}x${t}。`,
    );
}

async function $d0(n) {
  return f5(qD, await n.bytes());
}

function Wd0(n, e) {
  const t = E9(n.captionFrame, e),
    i = j5(j5(n.definition, "CaptionWindow"), "Container"),
    r = V0(i, t),
    s = i.children.filter((o) => o.name === "StateButton");
  return [
    { action: "retry", rect: V0(s[0], r) },
    { action: "menu", rect: V0(s[1], r) },
    { action: "resume", rect: V0(n.closeDefinition, t) },
  ];
}

function Hd0(n) {
  const e = new DOMParser().parseFromString(n, "application/xml");
  if (e.querySelector("parsererror"))
    throw new Error(`P3528 ${HD} 不是有效 XML。`);
  const t = new Map();
  return (
    Array.from(e.documentElement.children).forEach((i) => {
      const r = i.getAttribute("n"),
        o = Array.from(i.children)
          .find((a) => a.getAttribute("c") === "cn")
          ?.getAttribute("v");
      r !== null && o !== null && o !== void 0 && t.set(r, o);
    }),
    t
  );
}

function j5(n, e) {
  const t = n.children.filter((i) => i.name === e);
  if (t.length !== 1)
    throw new Error(`P3528 pause ${n.name}/${e} 数量 ${t.length}。`);
  return t[0];
}

function jD(n, e, t) {
  if (n.name !== e || T(n, "name") !== t)
    throw new Error(`P3528 pause 需要 ${e} ${t}。`);
}

function E1(n, e, t) {
  const i = Vy(n, e);
  if (i !== t) throw new Error(`P3528 pause ${n.name}.${e}=${i}，预期 ${t}。`);
}

function Vy(n, e) {
  const t = T(n, e);
  if (t === void 0) throw new Error(`P3528 pause ${n.name}.${e} 缺失。`);
  return t;
}

function wm(n, e) {
  const t = n.get(e);
  if (t === void 0) throw new Error(`P3528 pause StringBag 缺少 ${e}。`);
  return t;
}

function qd0(n) {
  const e = n.trim().split(/\s+/).map(Number);
  if (e.length !== 4 || e.some((t) => !Number.isFinite(t)))
    throw new Error(`P3528 pause color=${n} 无效。`);
  return e[0] / 255;
}

function Gi(n, e, t) {
  const i = XD(n, e);
  if (i.sourceKind !== "rho" || i.sourceName.toLowerCase() !== t.toLowerCase())
    throw new Error(`${e} 必须来自 ${t}。`);
  return i;
}

function XD(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

function Kd0(n, e, t) {
  const i = n & 7;
  let r = i === 0 ? e : BD(i);
  if (!(t.kartId === 0 || t.engineGrade > 6)) return i === 0 ? 0 : r;
  const o = (n & 4096) !== 0,
    a = (n & 8192) !== 0;
  return (
    o !== a
      ? a && (r = 10)
      : i === 0 && !o && ((n >>> 3) & 15) + 3 !== 14 && (r = 0),
    r
  );
}

function qf(n, e) {
  let t = 0;
  return (
    n.traverse((i) => {
      if (!(i instanceof D2)) return;
      const r = i.material,
        s = Array.isArray(r) ? r : [r],
        o = s.map((a) => {
          if (!zn(a)) return a;
          const c = a.clone();
          return (
            (c.uniforms.baseMap.value = a.uniforms.baseMap.value),
            (c.uniforms.toonEnv.value = a.uniforms.toonEnv.value),
            OL(c),
            c
          );
        });
      if (o.some((a, c) => a !== s[c])) {
        if (((i.material = Array.isArray(r) ? o : o[0]), ZG(i), e))
          o.forEach((a, c) => {
            const l = s[c];
            a !== l && zn(l) && zn(a) && e.push({ source: l, clone: a });
          });
        else {
          const a = i.onBeforeRender;
          i.onBeforeRender = function (c, l, u, h, d, f) {
            (a.call(this, c, l, u, h, d, f),
              o.forEach((p, v) => {
                const w = s[v];
                p !== w && zn(w) && zn(p) && f6(w, p);
              }));
          };
        }
        t += 1;
      }
    }),
    t
  );
}

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

const J_ = [
    "steam",
    "forest",
    "desert",
    "village",
    "ice",
    "tomb",
    "mine",
    "northeu",
    "factory",
    "pirate",
    "fairy",
    "moonhill",
    "gold",
    "china",
    "castle",
    "nymph",
    "mechanic",
    "xyy",
    "wkc",
    "brodi",
    "park",
    "beach",
    "transFormer",
    "jurassic",
    "world",
    "nemo",
    "sword",
    "god",
    "abyss",
    "camelot",
    "olympos",
    "korea",
    "mabi",
    "maple",
    "fengshen",
  ],
  Yd0 = ["sound_/bgm/main/shop.ogg"];

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

function Zd0(n) {
  const e = n.folder || n.id,
    t = J_.find((s) => e.startsWith(s)),
    i = n.texTheme?.split("|").find((s) => J_.includes(s)),
    r = n.bgmTheme || n.theme || t || i;
  if (!r) throw new Error(`${n.id} 无法形成 P3528 TimeAttack BGM theme。`);
  return r;
}

function Qd0(n) {
  if (!Number.isInteger(n) || n < 0 || n > 15)
    throw new Error(`BGM transition step ${n} 越界。`);
  return {
    incoming: Math.fround(n * Math.fround(0.0625)),
    outgoing: Math.fround((15 - n) * Math.fround(0.0625)),
  };
}

function Jd0(n, e) {
  const t = `sound_/bgm/${e}`;
  if (!n.manifestAvailable)
    throw new Error("P3528 TimeAttack BGM 需要 aaa.pk canonical mounts。");
  if (!n.hasManifestMount(t)) return [];
  const i = n.archives.filter((o) => tG(o.mountPath) === tG(t));
  if (i.length !== 1)
    throw new Error(`${t} selected archive 数量 ${i.length}。`);
  const r = n.entriesUnderCanonicalPrefix(t),
    s = new Set(r.map((o) => o.containerId));
  if (
    r.length > 0 &&
    (s.size !== 1 || s.has(void 0) || !r.every((o) => o.absenceAuthoritative))
  )
    throw new Error(`${t} 的 P3528 archive provenance 不唯一。`);
  return r
    .filter((o) => o.extension === "ogg")
    .sort((o, a) => (o.sourceOrdinal ?? -1) - (a.sourceOrdinal ?? -1));
}

async function eG(n, e, t) {
  const i = Zd0(e),
    r = [i, `${i}2`].flatMap((o) => Jd0(n, o));
  if (r.length === 0)
    throw new Error(`${e.id} 的 P3528 TimeAttack BGM 候选为空。`);
  return {
    buffers: await Promise.all(r.map((o) => Kt(o, t))),
    names: r.map((o) => o.name.replace(/\.ogg$/i, "")),
  };
}

async function Kt(n, e) {
  const t = await n.bytes();
  return Q9(e, t);
}

function G5(n, e) {
  const t = n.exactCanonicalCandidates(e);
  if (t.length !== 1) throw new Error(`${e} source 数量 ${t.length}。`);
  return t[0];
}

function ef0(n, e) {
  for (const t of Yd0) {
    const i = n.exactCanonicalCandidates(t);
    if (i.length > 1) throw new Error(`${t} source 数量 ${i.length}。`);
    if (i.length === 1) return i[0];
  }
  return e;
}

function tG(n) {
  return n
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function tf0(n) {
  const e = new Set();
  for (const t of n.stamps) {
    const i = t.status,
      r = RD(i),
      s = $w(r);
    s && e.add(s);
    const o = Ww(r);
    (o && e.add(o), (i & 32768) !== 0 && e.add("exceedWave"));
    const a = ID(i);
    (a === 1 &&
      (r === 3 || r === 4 || r === 5) &&
      (e.add("boosterDualIdle"), e.add("boosterDualIdleTeam")),
      a === 3 &&
        r === 10 &&
        (e.add("boosterDual"),
        e.add("boosterDualTeam"),
        e.add("baseBoosterWave")));
  }
  return e;
}

class nf0 extends GhostPlayback { constructor(record, mode = () => "native") { super(record, mode, ghostPlaybackDependencies); } }

class if0 extends ul {
  constructor(e) {
    (super(e), (this.host = e));
  }
  host;
  async build(e, t, i) {
    if (
      !e.mapPath ||
      !e.trackId ||
      !e.vehiclePath ||
      e.vehicleItemId === void 0 ||
      !e.characterPath ||
      !e.characterItemId
    )
      throw new Error("请先选择一辆已解析车辆、一个人物和一张已解析赛道。");
    j6(e.vehicleItemId);
    const r = this.host.generationValue(),
      s = this.host.gameOptions.classicHud,
      o = t.booster === 1;
    await this.host.preloadContainers(
      e.mapPath,
      e.vehiclePath,
      e.characterPath,
      e.vehicleSystemKey,
    );
    const a = await this.host.getLibrary()?.timeAttackGarageCatalog(),
      c = a && b4(a.karts, e.vehicleItemId, e.vehiclePath, e.vehicleSystemKey);
    if (!c) throw new Error(`${e.vehiclePath} 缺少精确 Garage 展示身份。`);
    if (
      !a?.characters.find(
        (_) =>
          _.itemId === e.characterItemId &&
          _.path.toLowerCase() === e.characterPath.toLowerCase(),
      )
    )
      throw new Error(`${e.characterPath} 缺少精确 Garage 人物身份。`);
    const u = await this.host
      .getLibrary()
      ?.timeAttackCharacterItem(e.characterItemId, e.characterPath);
    if (!u) throw new Error("人物 ItemCharacter identity 尚未载入。");
    const { createVehicleTimeAttackParameters: h } = await El(
        async () => {
          const { createVehicleTimeAttackParameters: _ } =
            await Promise.resolve().then(() => AS);
          return { createVehicleTimeAttackParameters: _ };
        },
        void 0,
      ),
      d = y6(t),
      f = t.version ?? ze,
      p =
        c.itemId === 0
          ? (await t3(this.host.getLibrary(), c.path, c.systemKey)).parameter
              .value
          : void 0,
      { spec: v } = h({ itemId: c.itemId, systemKey: c.systemKey }, d, p, f),
      w =
        e.vehicleItemId === this.host.userProfile.equipment.itemIds[3]
          ? this.host.userProfile.equipment.kartSerial
          : 0,
      g = p5(this.host.userProfile.garage, e.vehicleItemId, w),
      y = e6(v, c.engineGrade ?? 0, g, d),
      b = this.host.getLibrary(),
      A = await Ma(b, this.host.userProfile.equipment.itemIds[52]),
      x = A
        ? LI(
            v,
            c.engineGrade ?? 0,
            g,
            d,
            (await t3(b, c.path, c.systemKey)).parameter.value,
            await x4.load(b, A.internalId),
            (_) => h6(_, f, d),
          )
        : h6(y, f, d),
      M = uP(g, c.engineGrade, t.booster === 1 ? "team" : "personal", d);
    let E;
    if (M) {
      const _ = this.host.getLibrary();
      if (_)
        try {
          E = await x7.load(_, this.host.root);
        } catch {
          E = void 0;
        }
    }
    try {
      this.host.setVehicleTitle(c.title);
      const _ = !!(
          this.host.audio.bgm &&
          this.host.audio.context &&
          this.host.audio.context.state !== "closed"
        ),
        C = _ ? this.host.audio.context : new AudioContext();
      (Qc(C, this.host.gameOptions), _ || (await C.resume()));
      let S;
      try {
        S = await this.loadAssetMap(e.mapPath, e.trackId);
      } catch (I0) {
        throw (
          !_ && C.state !== "closed" && C.close(),
          new Error(
            `赛道载入失败：${I0 instanceof Error ? I0.message : String(I0)}`,
          )
        );
      }
      let G,
        I = _ ? this.host.audio.bgm : void 0;
      try {
        I
          ? this.host.audio.bgmTrackId !== S.metadata.id &&
            (await I.selectRace(this.host.getLibrary(), S.metadata))
          : (I = await P7.load(
              this.host.getLibrary(),
              S.metadata,
              this.host.targetRandom,
              C,
            ));
      } catch (I0) {
        throw (
          S.renderScene?.dispose(),
          S.skydome?.dispose(),
          S.environment.dispose(),
          !_ && C.state !== "closed" && C.close(),
          new Error(
            `赛道 BGM 载入失败：${I0 instanceof Error ? I0.message : String(I0)}`,
          )
        );
      }
      const L = new KI(),
        k = new wK();
      this.host.scene.add(k.object);
      try {
        G = await this.loadVehicleAsset(
          e.vehiclePath,
          e.vehicleItemId,
          e.vehicleSystemKey,
          x,
          e.trackId,
          S.environment,
          S.stageBinding,
          C,
          i?.textures(this.host.getLibrary()),
          L,
          void 0,
          !1,
          s,
        );
      } catch (I0) {
        throw (
          _ || I.dispose(),
          k.dispose(),
          S.renderScene?.dispose(),
          S.skydome?.dispose(),
          S.environment.dispose(),
          !_ && C.state !== "closed" && C.close(),
          new Error(
            `车辆载入失败：${I0 instanceof Error ? I0.message : String(I0)}`,
          )
        );
      }
      let D;
      try {
        D = await this.loadRaceCharacters(
          e.characterPath,
          u,
          G.kartItem,
          G.visual.reverse,
          G.physicsParams.motorcycleType,
          S.environment,
          S.stageBinding,
        );
      } catch (I0) {
        throw (
          _ || I.dispose(),
          S.renderScene?.dispose(),
          S.skydome?.dispose(),
          S.environment.dispose(),
          G.particleModification?.dispose(),
          G.imported.renderScene?.dispose(),
          G.effects.dispose(),
          G.trails.dispose(),
          G.driftEffects.dispose(),
          G.motionBlur?.dispose(),
          G.zetAirEffect.dispose(),
          G.shockWaveEffect.dispose(),
          G.exhaustEffect.dispose(),
          G.crashEffect.dispose(),
          G.chargerEffect.dispose(),
          G.lampFlares.dispose(),
          G.simpleShadow.dispose(),
          G.tachometerRenderer.dispose(),
          k.dispose(),
          G.audio.dispose(!1),
          u5(G.imported.object),
          !_ && C.state !== "closed" && C.close(),
          new Error(
            `人物载入失败：${I0 instanceof Error ? I0.message : String(I0)}`,
          )
        );
      }
      const V = new AL(
        G.physicsParams,
        G.collisionShape,
        t.booster !== 0,
        t.speed === 4,
      );
      let K, P, q, e0, Q, U, O, F, z, Y, X, l0, r0, j, F0, O0;
      const z0 = [],
        W = [];
      let R2;
      try {
        const I0 = this.host.timeAttackRecordKey(e, t),
          o2 =
            t.showGhost && this.host.timeAttackRecords.get(I0)?.hasGhost === !0
              ? await this.host.ghostStore.get(I0)
              : void 0;
        if (o2)
          for (const B of o2.participants) {
            const R = B.equipment.startSlot;
            if (!Number.isInteger(R) || R < 0 || R > 8) {
              this.host.hud.showDebugText(
                `幽灵记录缺少有效起跑槽位（${String(R)}）；旧记录请重新导入 .ksv，本局跳过该影子。`,
                "error",
              );
              continue;
            }
            z0.push({ equipment: B.equipment, record: B.record });
          }
        (S.lensFlarePoint &&
          (O0 = await w7.load(this.host.getLibrary(), S.lensFlarePoint)),
          (K = new _L(S.data, S.scene, S.renderScene, S.skydome, O0)),
          (O0 = void 0),
          kv(this.host.scene, K),
          Hn(this.host.renderer, S.scene, this.host.scene),
          S.skydome &&
            Hn(this.host.renderer, S.skydome.object, this.host.scene),
          S.data.weather?.rainEnabled &&
            ((P = new sL(this.host.targetRandom, S.data.weather.rainOnStart)),
            (q = await y7.load(this.host.getLibrary(), C))),
          S.data.weather?.snowEnabled &&
            (e0 = await A7.load(
              this.host.getLibrary(),
              this.host.targetRandom,
            )));
        const G0 = await eI(
            this.host.getLibrary(),
            G.tachometerSelection,
            this.host.webTimeAttackAiDyeId,
            G.kartItem.engineGrade,
          ),
          D0 = await oI(
            this.host.getLibrary(),
            S.path,
            S.metadata,
            S.minimap,
            S.environment,
            S.stageBinding,
            z0.length,
          );
        if (
          ((Q = new tI(G0, D0)),
          G.classicHud && (await Q.loadClassicBoost(this.host.getLibrary(), o)),
          (U = new dI(await hI(this.host.getLibrary()))),
          (O = new Rd0(await pX(this.host.getLibrary()))),
          Bt("p3553") === "p3553")
        ) {
          const B = S.path.replaceAll("\\", "/").split("/").at(-2);
          if (!B) throw new Error("赛道信息卡缺少赛道目录。");
          ((F = await M7.load({
            library: this.host.getLibrary(),
            root: this.host.root,
            trackId: e.trackId,
            trackDirectory: B,
            trackTitle: S.metadata.cnTitle ?? "",
            difficulty: S.metadata.difficulty,
            game: {
              modeKey: "TimeAttack",
              modeSuffixKey: t.booster === 1 ? "teamGame" : "indiGame",
              speed: d,
            },
          })),
            F?.setVisible(!1));
        }
        if (
          ((z = await Dy.load({
            library: this.host.getLibrary(),
            root: this.host.root,
            onInteraction: () => {
              this.host.audio.context?.resume();
            },
            onHover: () => this.host.audio.interfaceAudio?.playHover(),
            onActivate: () => this.host.audio.interfaceAudio?.playClick(),
            onResume: () => this.host.togglePause(),
            onRetry: () => {
              this.host.restartRaceFromPause();
            },
            onMenu: () => {
              this.host.returnToReady();
            },
          })),
          (Y = await Q6.load(this.host.getLibrary(), C)),
          S.eventProjections.length > 0 &&
            (X = await b7.load(
              this.host.getLibrary(),
              S.eventProjections,
              this.host.kartView.presentationRoot(),
              S.environment,
              S.stageBinding,
              C,
            )),
          S.eventProjections.some((B) => B.sound !== void 0))
        ) {
          const B = S.renderScene?.clientWorldElements;
          if (!B)
            throw new Error(
              "standalone event sound 缺少 track scene matrix owner。",
            );
          l0 = await v7.load(this.host.getLibrary(), S.eventProjections, B, C);
        }
        Bt("p3553") === "p3553" &&
          S.dummySounds.length > 0 &&
          (r0 = await m7.load(this.host.getLibrary(), S.dummySounds, C));
        const E0 = J5(G.imported.model),
          f2 = G.imported.renderScene?.bySource.get(E0);
        if (!f2) throw new Error("ReKart serialized root presentation 缺失。");
        const O2 = D.linked ?? D.ordinary;
        if (O2) {
          const B = E0.children[6]?.value,
            R =
              B && "children" in B
                ? G.imported.renderScene?.bySource.get(B)
                : void 0;
          if (!R) throw new Error("ReKart root child 6 mount 缺失。");
          (R.clear(),
            R.add(O2.scene.object),
            D.linked &&
              ((j = new _a(
                f2,
                R,
                D.linked.scene.object,
                G.kartItem.alwaysLinkCharacter === !0,
              )),
              j.setMode(3)));
        }
        if (
          (O2 && O2.scene.object.scale.setScalar(G.visual.onCharacterSize),
          A && O2)
        ) {
          const B = E0.children[6]?.value;
          if (!B || !("transform" in B))
            throw new Error("Flying pet rider mount is missing.");
          ((F0 = await S4.race({
            library: b,
            item: A,
            environment: S.environment,
            binding: S.stageBinding,
            colors: await We(
              b,
              this.host.userProfile.equipment.itemIds[2] || 1,
            ),
            role: "local",
            random: this.host.targetRandom,
            grandparentScale: B.transform.scale,
            audioContext: C,
            listen: (R) => V.addFlyingPetListener(R),
          })),
            F0?.mount(O2.scene.getDecorationOwner()));
        }
        for (const B of G.accessories) {
          if (!O2) throw new Error(`ReCharacter 缺失，无法挂接 ${B.kind}。`);
          B.render.scene.reset(performance.now());
          const R = B.kind === "aura" ? void 0 : oP[B.kind],
            $ = R
              ? O2.scene.getDecorationSocket(R[0], R[1])
              : O2.scene.getDecorationOwner();
          if (!$) throw new Error(`ReCharacter ${B.kind} socket 缺失。`);
          ($.add(B.render.scene.object),
            B.kind === "aura" && ev($, f2, B.render.scene.object));
        }
        if (!this.host.isGenerationCurrent(r))
          throw new Error("比赛资源构造期间资源库已变化。");
        if (
          (this.host.kartView.setModel(
            G.imported.object,
            G.visual,
            G.imported.animation,
            G.imported.model,
            G.imported.scene,
          ),
          G.decoration)
        ) {
          G.decoration.scene.reset(performance.now());
          const B = this.host.kartView.getAttachment(16);
          if (!B) throw new Error("ReKart balloon marker 缺失。");
          B.add(G.decoration.scene.object);
        }
        (Hn(this.host.renderer, this.host.kartView.root, this.host.scene, !0),
          G.effects.warmDetachedScenes(this.host.renderer, this.host.scene));
        for (const B of z0) {
          const R = await this.loadGhostKartAssets(
              B,
              S.environment,
              S.stageBinding,
              y6(t),
              f,
              k,
            ),
            $ = new Xd0();
          (W.push({
            view: $,
            playback: new nf0(B.record, () => this.host.ghostSamplingMode),
            startSlot: B.equipment.startSlot,
            name: B.equipment.playerName?.trim() || "Ghost",
          }),
            $.setAssets(
              R.imported,
              R.character,
              R.onCharacterSize,
              R.linkedCharacter,
              R.visual,
              R.motorcycle,
              Bt("p3553"),
              R.engineGrade,
            ));
          const o0 = R.imported.renderScene;
          if (!o0)
            throw new Error(
              "影子车辆缺少 KartRenderScene effect attachment owner。",
            );
          const u0 = await Ca.load(
            this.host.getLibrary(),
            R.visual,
            R.engineGrade,
            o0,
            S.environment,
            S.stageBinding,
            void 0,
            tf0(B.record),
            L,
          );
          ($.setEffects(u0),
            $.setTrails(
              await Ea.load(
                this.host.getLibrary(),
                R.visual,
                o0,
                "shadow-driving",
              ),
              { kartId: B.equipment.kart, engineGrade: R.engineGrade },
            ));
          const c0 = await this.loadGhostDecorations(
            U_(B.equipment),
            this.host.getLibrary(),
            S.environment,
            S.stageBinding,
          );
          ($.setDecorations(c0.balloon, c0.accessories),
            Hn(this.host.renderer, $.root, this.host.scene, !0),
            u0.warmDetachedScenes(this.host.renderer, this.host.scene));
        }
        if (!K || !Q || !U || !O || !z || !Y)
          throw new Error("比赛资源构造未建立 normal runtime owners。");
        if (
          ((R2 = await this.rankColors(z0)), !this.host.isGenerationCurrent(r))
        )
          throw new Error("比赛资源构造期间资源库已变化。");
        Q.setLocalMarkerTint(R2[0]);
      } catch (I0) {
        (_ || I.dispose(), F0?.dispose());
        for (const o2 of W) o2.view.dispose();
        throw (
          K?.dispose(),
          P?.dispose(),
          q?.dispose(),
          e0?.dispose(),
          Q?.dispose(),
          U?.dispose(),
          O?.dispose(),
          F?.dispose(),
          z?.dispose(),
          Y?.dispose(),
          X?.dispose(),
          l0?.dispose(),
          r0?.dispose(),
          O0?.dispose(),
          K || (S.renderScene?.dispose(), S.skydome?.dispose()),
          S.scene.removeFromParent(),
          S.environment.dispose(),
          G.particleModification?.dispose(),
          G.imported.renderScene?.dispose(),
          G.effects.dispose(),
          G.trails.dispose(),
          G.driftEffects.dispose(),
          G.motionBlur?.dispose(),
          G.zetAirEffect.dispose(),
          G.shockWaveEffect.dispose(),
          G.exhaustEffect.dispose(),
          G.crashEffect.dispose(),
          G.chargerEffect.dispose(),
          G.lampFlares.dispose(),
          G.simpleShadow.dispose(),
          G.decoration?.dispose(),
          G.accessories.forEach(({ render: o2 }) => o2.dispose()),
          G.tachometerRenderer.dispose(),
          k.dispose(),
          D.ordinary?.scene.dispose(),
          D.linked?.scene.dispose(),
          G.audio.dispose(!1),
          u5(G.imported.object),
          !_ && C.state !== "closed" && C.close(),
          I0
        );
      }
      return {
        audioContext: C,
        reuseGlobalAudio: _,
        loadedBgm: I,
        loadedMap: S,
        loadedVehicle: G,
        loadedCharacters: D,
        nextPhysics: V,
        nextTrack: K,
        nextRain: P,
        nextRainAudio: q,
        nextSnow: e0,
        nextGameplayUi: Q,
        nextAction2D: U,
        nextResult: O,
        nextTrackInfoCard: F,
        nextPause: z,
        nextCountdownAudio: Y,
        nextTrackEventEffects: X,
        nextTrackEventAudio: l0,
        nextTrackDummyAudio: r0,
        nextLinkedCharacterPresentation: j,
        nextFlyingPet: F0,
        nextGhosts: W,
        rankColors: R2,
        selectedVehicle: c,
        generation: r,
        particleModificationBanner: E,
        particleModificationBannerRequest: M,
        outlineBatch: k,
      };
    } catch (_) {
      throw (E?.dispose(), _);
    }
  }
    async loadGhostKartAssets(ghost, scene, importer, speed, version, signal) { return loadGhostKartAssets(this, ghost, scene, importer, speed, version, signal, ghostAssetDependencies); }
    async loadGhostDecorations(ghost, library, scene, importer) { return loadGhostDecorations(ghost, library, scene, importer, ghostAssetDependencies); }
    async rankColors(ghosts) { return rankGhostColors(this, ghosts, ghostAssetDependencies); }
}

class rf0 {
  lastTick;
  count = 0;
  published = 0;
  get fps() {
    return this.published;
  }
  sample(e) {
    const t = Math.trunc(e) >>> 0;
    ((this.lastTick ??= t),
      (t - this.lastTick) >>> 0 > 1e3 &&
        ((this.published = this.count),
        (this.lastTick = (this.lastTick + 1e3) >>> 0),
        (this.count = 0)),
      (this.count = (this.count + 1) >>> 0));
  }
}

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
  handleRouteSurfaceTag(e, t) {
    if (!this.host.getPhysics().handleRouteSurfaceTag(e))
      throw new Error(`${e} 的 TimeAttack listener 尚未闭合。`);
    this.applyWarpNextActions(
      this.host.warpNext.enter(
        e,
        this.warpNextEventFrame(e, t),
        this.host.presentationClockMs,
        this.host.getTrack().data.warp,
      ),
    );
    const i = Vo(e);
    if (
      (i === "flash" && this.host.lightFactor.trigger(),
      i.startsWith("shake") &&
        (e.includes(":in:")
          ? this.host.cameraShake.enter()
          : e.includes(":out:") && this.host.cameraShake.leave(!0)),
      i.startsWith("wave") &&
        (e.includes(":in:")
          ? this.host.cameraWave.enter()
          : e.includes(":out:") && this.host.cameraWave.leave()),
      i === "norain" || i === "rail, norain")
    ) {
      if (!this.host.session.rain || !this.host.session.rainAudio) return;
      const r = e.includes(":out:");
      (this.host.session.rain.setEnabled(r),
        this.host.session.rainAudio.setRainEnabled(r));
    }
    (i === "nosnow" && this.host.session.snow?.setEnabled(e.includes(":out:")),
      i === "lensflare" &&
        this.host.getTrack().setLensFlareEnabled(e.includes(":in:")));
  }
  warpNextEventFrame(e, t) {
    return e !== "warpnext:in:next"
      ? t
      : this.host.getTrack().warpNextDestination(this.host.getPhysics());
  }
  applyWarpNextActions(e) {
    for (const t of e) this.applyWarpNextAction(t);
  }
  applyWarpNextAction(e) {
    if (e.kind === "start-warp-presentation") {
      (this.host.getPhysics().setWarpPresentationActive(!0),
        this.host.getPhysics().setWarpPressProtected(!0));
      const t = this.host.session.warpHud;
      t && (t.hidden = !0);
    } else if (e.kind === "reset-drive-camera")
      (this.host.driveCameraman.reset(0),
        (this.host.session.driveCameraState = void 0));
    else if (e.kind === "freeze-camera") this.freezeWarpCamera();
    else if (e.kind === "teleport")
      (this.host.getPhysics().completeCheckpointPose(e.frame, e.clearMotion),
        this.host.getPhysics().setWarpPressProtected(!1),
        e.clearMotion
          ? this.host.session.coordinator?.completeWarpNextRailLanding()
          : this.host.session.coordinator?.deferWarpNextRailLanding(),
        this.host.session.coordinator?.synchronizePositionAnchor(),
        (this.host.session.warpCameraFrozen = !1));
    else if (e.kind === "finish-warp-presentation")
      (this.host.getPhysics().setWarpPresentationActive(!1),
        this.host.getPhysics().setFullPhysicsBypass(!1),
        this.host.getPhysics().restoreResetInteraction());
    else if (e.kind === "finish-warp-letterbox") {
      const t = this.host.session.warpHud;
      t && (t.hidden = !1);
    }
  }
  freezeWarpCamera() {
    if (!this.host.session.warpNextCamera)
      throw new Error(
        "warpnextcamera_cam 缺失；P3528 同帧会进入空 ReCameraman，Web 禁止以旧镜头代替。",
      );
    this.host.session.warpCameraFrozen = !0;
  }
}

class of0 extends sf0 {}

class af0 extends GhostParticipantStream { constructor(zCeiling) { super(new kD(zCeiling)); } }

class cf0 extends GhostRecorder { constructor(zCeiling) { super(zCeiling, value => new af0(value)); } }

const lf0 = 7e3;

function nG(n, e) {
  return (Math.trunc(n) - Math.trunc(e) + lf0) >>> 0;
}

class uf0 {
  constructor(e) {
    this.owners = e;
  }
  owners;
  disposed = !1;
  get gameplayUi() {
    return this.owners.gameplayUi;
  }
  get action2D() {
    return this.owners.action2D;
  }
  get result() {
    return this.owners.result;
  }
  get trackInfoCard() {
    return this.owners.trackInfoCard;
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.owners.gameplayUi?.dispose(),
      this.owners.action2D?.dispose(),
      this.owners.result?.dispose(),
      this.owners.trackInfoCard?.dispose());
  }
}

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
  start() {
    this.animationFrame = requestAnimationFrame(this.frame);
  }
  dispose() {
    cancelAnimationFrame(this.animationFrame);
    for (const e of this.nextFrameCallbacks.splice(0))
      e.reject(new Error("页面已关闭。"));
  }
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

class Mf0 {
  constructor(e, t, i, r = {}) {
    ((this.cameraShake = e),
      (this.cameraWave = t),
      (this.warpNext = i),
      (this.p3553ProcessState =
        r.p3553ProcessState ?? (Bt("p3553") === "p3553" ? zB : void 0)),
      (this.driveCameraman = r.drive ?? new Ol(this.p3553ProcessState)),
      (this.surroundCameraman = r.surround ?? new KL()));
  }
  cameraShake;
  cameraWave;
  warpNext;
  driveCameraman;
  surroundCameraman;
  p3553ProcessState;
  get drive() {
    return this.driveCameraman;
  }
  get surround() {
    return this.surroundCameraman;
  }
  configureP3528ResolutionMode() {
    (this.driveCameraman.configureP3528ResolutionMode(),
      this.surroundCameraman.configureP3528ResolutionMode());
  }
  beginNewStage() {
    ((this.driveCameraman = new Ol(this.p3553ProcessState)),
      this.driveCameraman.configureP3528ResolutionMode());
  }
  reset() {
    (this.driveCameraman.reset(), this.surroundCameraman.reset());
  }
  update(e, t, i, r, s) {
    i.cameraMode === "ready"
      ? i.readyCamera?.apply(t, e, r.body)
      : i.cameraMode === "drive"
        ? this.updateDrive(e, t, i, r, s)
        : i.cameraMode === "surround" && this.updateSurround(e, t, i, r);
  }
  updateDrive(e, t, i, r, s) {
    const o = s.currentRouteSurface(r),
      a = r.body,
      c = this.cameraShake.update(e, o),
      l = {
        x: Math.fround(a.position.x + c.x),
        y: Math.fround(a.position.y + c.y),
        z: Math.fround(a.position.z + c.z),
      };
    this.cameraWave.update(e, o, a, l);
    const u = this.driveCameraman.update({
        timestampMs: e,
        body: { ...a, position: l },
        routeSurface: o,
        ...r.driveCameraRuntime(),
      }),
      h = this.warpNext.fairyFovFactor(),
      d =
        h === void 0
          ? u.horizontalFovDegrees
          : Math.max(Math.fround(Math.fround(u.horizontalFovDegrees) * h), 65);
    ((i.driveCameraState = {
      ...u,
      horizontalFovDegrees: d,
      far: s.cameraFar ?? u.far,
    }),
      this.driveCameraman.apply(t, i.driveCameraState));
  }
  updateSurround(e, t, i, r) {
    const s = r.driveCameraRuntime().eventScaleSecondary.z;
    ((i.surroundCameraState = this.surroundCameraman.update(e, r.body, s)),
      this.surroundCameraman.apply(t, i.surroundCameraState));
  }
}

const xf0 = "sound_/fx/interface/click.flac",
  Sf0 = "sound_/fx/interface/startButton.flac",
  Cf0 = "sound_/fx/interface/mouseOver.flac",
  Ef0 = "sound_/fx/etc/slot_changer.flac";

class Ny {
  constructor(e, t, i, r, s) {
    ((this.context = e),
      (this.clickBuffer = t),
      (this.hoverBuffer = i),
      (this.slotChangerBuffer = r),
      (this.startBuffer = s));
  }
  context;
  clickBuffer;
  hoverBuffer;
  slotChangerBuffer;
  startBuffer;
  activeStart;
  activeClick;
  activeHover;
  activeSlotChanger;
  static async load(e, t) {
    const [i, r, s, o] = await Promise.all([
      Kf(e, t, xf0),
      Tf0(e, t, Cf0),
      Kf(e, t, Ef0),
      Kf(e, t, Sf0),
    ]);
    return new Ny(t, i, r, s, o);
  }
  playStart() {
    if (this.activeStart) return;
    const e = this.context.createBufferSource();
    ((e.buffer = this.startBuffer),
      S9(this.context, e),
      (e.onended = () => {
        (e.disconnect(), this.activeStart === e && (this.activeStart = void 0));
      }),
      (this.activeStart = e),
      e.start());
  }
  playClick() {
    if (this.activeClick) return;
    const e = this.context.createBufferSource();
    ((e.buffer = this.clickBuffer),
      S9(this.context, e),
      (e.onended = () => {
        (e.disconnect(), this.activeClick === e && (this.activeClick = void 0));
      }),
      (this.activeClick = e),
      e.start());
  }
  playHover() {
    if (!this.hoverBuffer || this.activeHover) return;
    const e = this.context.createBufferSource();
    ((e.buffer = this.hoverBuffer),
      S9(this.context, e),
      (e.onended = () => {
        (e.disconnect(), this.activeHover === e && (this.activeHover = void 0));
      }),
      (this.activeHover = e),
      e.start());
  }
  playSlotChanger() {
    if (this.activeSlotChanger) return;
    const e = this.context.createBufferSource();
    ((e.buffer = this.slotChangerBuffer),
      S9(this.context, e),
      (e.onended = () => {
        (e.disconnect(),
          this.activeSlotChanger === e && (this.activeSlotChanger = void 0));
      }),
      (this.activeSlotChanger = e),
      e.start());
  }
  dispose() {
    for (const e of [
      this.activeClick,
      this.activeHover,
      this.activeSlotChanger,
      this.activeStart,
    ])
      e && ((e.onended = null), e.stop(), e.disconnect());
    ((this.activeStart = void 0),
      (this.activeClick = void 0),
      (this.activeHover = void 0),
      (this.activeSlotChanger = void 0));
  }
}

async function Kf(n, e, t) {
  const i = n.exactCanonicalCandidates(t);
  if (i.length !== 1) throw new Error(`${t} source 数量 ${i.length}。`);
  const r = await i[0].bytes();
  return Q9(e, r);
}

async function Tf0(n, e, t) {
  const i = n.exactCanonicalCandidates(t);
  if (i.length > 1) throw new Error(`${t} source 数量 ${i.length}。`);
  if (i.length === 0) return;
  const r = await i[0].bytes();
  return Q9(e, r);
}

const jf = { mapPath: "track_/village_R01/track.1s", trackId: "village_R01" },
  _f0 = 0,
  Gf0 = new Set();

export { Af0, Ah0, Bd0, Ff, Fy, Gf0, Kh0, Mf0, Nh0, Ny, P7, Pt, Th0, _f0, bf0, bh0, df0, if0, jf, l60, n60, ph0, vd0, vf0 };
