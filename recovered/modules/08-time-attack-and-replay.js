class GF {
  constructor(e = null) {
    this.previousBestMs = e;
  }
  previousBestMs;
  phase = 0;
  countdownSubstate = 0;
  startAtMs = 0;
  finishAtMs = 0;
  finishElapsedMs = 0;
  lapTiming = new vL();
  get bestLapMs() {
    return this.lapTiming.bestLapMs;
  }
  pausedTotalMs = 0;
  pauseAnchorRawMs = 0;
  finalLapShown = !1;
  returnedToReady = !1;
  resultBeatTarget() {
    return (
      this.previousBestMs === null || this.finishElapsedMs < this.previousBestMs
    );
  }
  reset() {
    return (
      (this.phase = 0),
      (this.countdownSubstate = 0),
      (this.startAtMs = 0),
      (this.finishAtMs = 0),
      (this.finishElapsedMs = 0),
      this.lapTiming.reset(),
      (this.pausedTotalMs = 0),
      (this.pauseAnchorRawMs = 0),
      (this.finalLapShown = !1),
      (this.returnedToReady = !1),
      [{ kind: "ready-camera" }]
    );
  }
  tick(e) {
    const t = Z1(e.rawNowMs);
    if (this.phase === 5)
      return (
        this.pauseAnchorRawMs === 0
          ? (this.pauseAnchorRawMs = t)
          : ((this.pausedTotalMs = Z1(
              this.pausedTotalMs + Z1(t - this.pauseAnchorRawMs),
            )),
            (this.pauseAnchorRawMs = t)),
        []
      );
    const i = Z1(t - this.pausedTotalMs);
    return this.phase === 0
      ? ((this.phase = 1),
        (this.startAtMs = Z1(i + 7e3)),
        [{ kind: "schedule-start-effect", atMs: Z1(this.startAtMs - 3e3) }])
      : this.phase === 1
        ? this.updateCountdown(i)
        : this.phase === 2
          ? this.updateRacing(i, e)
          : this.phase === 3
            ? this.updateFinishAccepted(i)
            : this.phase === 4
              ? this.updateResult(i)
              : [];
  }
  togglePause(e) {
    const t = Z1(e);
    return this.phase === 2
      ? ((this.phase = 5),
        (this.pauseAnchorRawMs = t),
        [{ kind: "pause-race" }])
      : this.phase === 5
        ? ((this.pausedTotalMs = Z1(
            this.pausedTotalMs + Z1(t - this.pauseAnchorRawMs),
          )),
          (this.pauseAnchorRawMs = 0),
          (this.phase = 2),
          [{ kind: "resume-race" }])
        : [];
  }
  effectiveTime(e) {
    const t = Z1(e),
      i =
        this.phase === 5 && this.pauseAnchorRawMs !== 0
          ? Z1(t - this.pauseAnchorRawMs)
          : 0;
    return Z1(t - Z1(this.pausedTotalMs + i));
  }
  isStartBoosterWindow(e) {
    return fL(this.startAtMs, e);
  }
  acceptLocalCompletion() {
    this.phase !== 2 || this.finishAtMs === 0 || (this.phase = 3);
  }
  updateCountdown(e) {
    const { next: t, fired: i } = NR(
      { step: this.countdownSubstate },
      e,
      this.startAtMs,
    );
    if (((this.countdownSubstate = t.step), i.length === 0)) return [];
    switch (i[0]) {
      case "prepare":
        return [{ kind: "countdown-prepare" }];
      case "three":
        return [
          { kind: "countdown-number", value: 3 },
          { kind: "switch-drive-camera" },
        ];
      case "two":
        return [{ kind: "countdown-number", value: 2 }];
      case "one":
        return [{ kind: "countdown-number", value: 1 }];
      case "go":
        return (
          (this.phase = 2),
          [
            { kind: "release-race", startAtMs: this.startAtMs },
            { kind: "countdown-go" },
          ]
        );
    }
  }
  updateRacing(e, t) {
    const i = this.updateLapTiming(e, t.currentLap);
    if (
      this.countdownSubstate === 4 &&
      t.routeProgress > t.finishThreshold &&
      this.finishAtMs === 0
    )
      return (
        (this.finishAtMs = e),
        (this.finishElapsedMs = Z1(e - this.startAtMs)),
        [
          { kind: "finish", elapsedMs: this.finishElapsedMs },
          { kind: "switch-surround-camera" },
          { kind: "play-result-bgm", beatTarget: this.resultBeatTarget() },
        ]
      );
    if (i) {
      if (t.currentLap === t.totalLaps) {
        if (!this.finalLapShown)
          return ((this.finalLapShown = !0), [{ kind: "final-lap" }]);
      } else if (t.currentLap > 1)
        return [{ kind: "lap", value: t.currentLap }];
    }
    return [];
  }
  updateLapTiming(e, t) {
    return this.lapTiming.update(e, t);
  }
  updateFinishAccepted(e) {
    if (!OT(e, this.finishAtMs + 3e3)) return [];
    this.phase = 4;
    const t =
      this.previousBestMs === null
        ? this.finishElapsedMs
        : Math.min(this.previousBestMs, this.finishElapsedMs);
    return [
      {
        kind: "show-result",
        elapsedMs: this.finishElapsedMs,
        previousBestMs: this.previousBestMs,
        bestMs: t,
        isNewRecord:
          this.previousBestMs === null ||
          this.finishElapsedMs <= this.previousBestMs,
      },
    ];
  }
  updateResult(e) {
    return this.returnedToReady || !OT(e, this.finishAtMs + 8e3)
      ? []
      : ((this.returnedToReady = !0), [{ kind: "return-to-ready" }]);
  }
}
function OT(n, e) {
  return Z1(n) > Z1(e);
}
function Z1(n) {
  return Math.trunc(n) >>> 0;
}
class n60 {
  constructor(e) {
    this.host = e;
  }
  host;
  drainDrivingInput(e, t) {
    const i = this.host.input.drain();
    i.cancelled &&
      (this.host.drivingInput.cancel(),
      this.host.autoForward.cancel(),
      this.host.nitroSeamless.cancel(),
      this.host.getPhysics().cancelControls(),
      this.host.getLampFlares()?.resetInputVisibility(),
      this.host.gamepad.reset());
    const r = this.host.getLifecycle().phase,
      s = t60(this.host.getLifecycle());
    this.host.autoForward.setRaceState(
      s,
      r === Ne.Racing && !this.host.getLifecycle().isStartBoosterWindow(e),
    );
    const o = this.host.gamepad.poll(
        this.host.getGamepadPads(),
        this.host.getGamepadMap(),
      ),
      a = o.length === 0 ? i.transitions : [...i.transitions, ...o];
    (a.some(
      (c) => c.sourceKind === "gamepad" && c.down && c.action === l2.Forward,
    ) && this.host.resumeGamepadAutoForward(),
      this.host.drivingInput.dispatch(a, (c, l) =>
        this.host.autoForward.dispatch(
          c,
          l,
          this.host.drivingInput.snapshot(),
          (u) => this.handleDrivingCommand(u, e, t),
        ),
      ));
  }
  handleDrivingCommand(e, t, i) {
    (this.handleBaseDrivingCommand(e),
      e60(this.host.getLifecycle()) &&
        this.handleTimeAttackDrivingCommand(e, t, i));
  }
  setAutoForwardEnabled(e) {
    const t = this.host.autoForward.isActive(this.host.drivingInput.snapshot());
    (this.host.autoForward.setEnabled(e),
      !e && t && this.handleBaseDrivingCommand({ kind: "forward-up" }));
  }
  setNitroSeamlessMode(e) {
    this.host.nitroSeamless.setMode(e);
  }
  getDrivingSnapshot() {
    return this.host.autoForward.apply(this.host.drivingInput.snapshot());
  }
  handleBaseDrivingCommand(e) {
    switch (e.kind) {
      case "drift-start":
      case "drift-stop":
        this.host
          .getPhysics()
          .handleDrivingCommand(e, this.getDrivingSnapshot());
        return;
      case "forward-down":
      case "forward-up":
        (this.host
          .getPhysics()
          .handleDrivingCommand(e, this.getDrivingSnapshot()),
          this.host
            .getLampFlares()
            ?.setInputPair("front", e.kind === "forward-down"));
        return;
      case "reverse-down":
      case "reverse-up":
        (this.host
          .getPhysics()
          .handleDrivingCommand(e, this.getDrivingSnapshot()),
          this.host
            .getLampFlares()
            ?.setInputPair("rear", e.kind === "reverse-down"));
        return;
      default:
        return;
    }
  }
  handleTimeAttackDrivingCommand(e, t, i) {
    switch (e.kind) {
      case "forward-up":
        (this.host.getLifecycle().isStartBoosterWindow(t) &&
          this.host.getPhysics().startRaceBooster(),
          this.resetTacho1InputMode(i));
        return;
      case "reverse-down":
        this.resetTacho1InputMode(i);
        return;
      case "reset":
        this.host.getLifecycle().phase === Ne.Racing &&
          this.host.handleSpeedReset(!0);
        return;
      case "instant-acceleration":
        this.host.getLifecycle().phase === Ne.Racing &&
          this.host
            .getPhysics()
            .handleDrivingCommand(e, this.getDrivingSnapshot());
        return;
      case "forward-down":
        (this.host.getLifecycle().isStartBoosterWindow(t) &&
          this.host.getPhysics().startRaceBooster(),
          this.host.getPhysics().startPlayBooster(this.getDrivingSnapshot()));
        return;
      case "use-item-or-booster":
        {
          const r = this.host.getPhysics(),
            s = this.getDrivingSnapshot();
          this.host.nitroSeamless.press(r, s, t) ||
            r.handleDrivingCommand(e, s);
        }
        return;
      case "reorder-items":
        this.host.getLifecycle().phase === Ne.Racing &&
          this.host
            .getPhysics()
            .handleDrivingCommand(e, this.getDrivingSnapshot());
        return;
      default:
        return;
    }
  }
  resetTacho1InputMode(e) {
    const t = this.host.getTachometer();
    t instanceof fv && t.resetMode(Math.trunc(e) >>> 0);
  }
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
const ah0 = 12,
  ch0 = 12,
  pD = [8, 9, 11, 12],
  gD = 83,
  I_ = 912888630,
  fm = 1500,
  pm = 3e3,
  mD = 1500,
  wD = 590,
  vD = 50,
  G6 = 10,
  Qn = 1e4,
  Lc = 3e3,
  lh0 = -10;
function B6(n) {
  return n.toLowerCase() === "transformer_r02" ? pm : fm;
}
function _y(n = ah0) {
  return Dt(new TextEncoder().encode(`KartRecord${n}Header`));
}
function Gy(n = ch0) {
  return Dt(new TextEncoder().encode(`KartRecord${n}`));
}
function uh0(n) {
  return pD.find((e) => _y(e) === n);
}
function hh0(n) {
  return pD.find((e) => Gy(e) === n);
}
function yD(n) {
  return n >= 12;
}
function AD(n) {
  return n >= 9;
}
function bD(n) {
  return n <= 9;
}
function k_(n, e) {
  for (let t = 0; t <= 20; t += 1)
    if ((e === "header" ? _y(t) : Gy(t)) === n) return t;
}
function dh0(n) {
  const e = new Uint8Array(64),
    t = new DataView(e.buffer);
  let i = (n ^ 2222193601) >>> 0;
  for (let r = 0; r < 16; r += 1)
    (t.setUint32(r * 4, i, !0), (i = (i - 2072773695) >>> 0));
  return e;
}
function MD(n, e) {
  const t = dh0(e),
    i = new Uint8Array(n.length);
  for (let r = 0; r < n.length; r += 1) i[r] = n[r] ^ t[r & 63];
  return i;
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
function Ff(n, e) {
  const t = new DataView(n.buffer, n.byteOffset, n.byteLength);
  if (n.length < 4) throw new Error("KSV 文件不足 4 字节。");
  const i = t.getUint32(0, !0);
  if (i !== n.length - 4)
    throw new Error(`KSV 头部长度 ${i} 与文件长度 ${n.length - 4} 不匹配。`);
  const r = n.subarray(4);
  return wh0(gh0(r), e);
}
function ph0(n, e) {
  const t = Mh0(n, e),
    i = mh0(t),
    r = new Uint8Array(i.length + 4);
  return (new DataView(r.buffer).setUint32(0, i.length, !0), r.set(i, 4), r);
}
function gh0(n) {
  const e = new DataView(n.buffer, n.byteOffset, n.byteLength);
  if (n.length < 6) throw new Error("KSV KRData 不足头部。");
  if (n[0] !== gD) throw new Error("KSV 不是 KRData 格式。");
  const t = n[1],
    i = e.getUint32(2, !0);
  let r = 6;
  const s = (t & 2) === 2,
    o = (t & 1) === 1,
    a = s ? e.getUint32(r, !0) : 0;
  s && (r += 4);
  const c = o ? e.getInt32(r, !0) : 0;
  o && (r += 4);
  const l = s ? MD(n.subarray(r), a) : n.subarray(r);
  let u;
  if (o) {
    if (((u = fD.inflate(l)), u.length !== c))
      throw new Error(`KSV 解压长度 ${u.length} 与头部 ${c} 不匹配。`);
  } else u = Uint8Array.from(l);
  if (Dt(u) !== i) throw new Error("KSV KRData 校验失败。");
  return u;
}
function mh0(n) {
  const e = Dt(n),
    t = MD(fD.deflate(n, { level: 9 }), I_),
    i = new Uint8Array(14 + t.length),
    r = new DataView(i.buffer);
  return (
    (i[0] = gD),
    (i[1] = 3),
    r.setUint32(2, e, !0),
    r.setUint32(6, I_, !0),
    r.setInt32(10, n.length, !0),
    i.set(t, 14),
    i
  );
}
class SD {
  constructor(e) {
    ((this.data = e),
      (this.view = new DataView(e.buffer, e.byteOffset, e.byteLength)));
  }
  data;
  offset = 0;
  view;
  get remaining() {
    return this.data.length - this.offset;
  }
  require(e) {
    if (this.offset + e > this.data.length) throw new Error("KSV 读取越界。");
  }
  u8() {
    return (this.require(1), this.data[this.offset++]);
  }
  i16() {
    this.require(2);
    const e = this.view.getInt16(this.offset, !0);
    return ((this.offset += 2), e);
  }
  u16() {
    this.require(2);
    const e = this.view.getUint16(this.offset, !0);
    return ((this.offset += 2), e);
  }
  i32() {
    this.require(4);
    const e = this.view.getInt32(this.offset, !0);
    return ((this.offset += 4), e);
  }
  u32() {
    this.require(4);
    const e = this.view.getUint32(this.offset, !0);
    return ((this.offset += 4), e);
  }
  bytes(e) {
    if (!Number.isSafeInteger(e) || e < 0)
      throw new Error("KSV 字节字段长度无效。");
    this.require(e);
    const t = this.data.slice(this.offset, this.offset + e);
    return ((this.offset += e), t);
  }
  blob() {
    return this.bytes(this.u32());
  }
  string() {
    const e = this.i32();
    if (e < 0) throw new Error("KSV 字符串长度无效。");
    this.require(e * 2);
    let t = "";
    for (let i = 0; i < e; i += 1)
      ((t += String.fromCharCode(this.view.getUint16(this.offset, !0))),
        (this.offset += 2));
    return t;
  }
}
function CD(n) {
  const e = new Uint8Array(n.length * 2),
    t = new DataView(e.buffer);
  for (let i = 0; i < n.length; i += 1) t.setUint16(i * 2, n.charCodeAt(i), !0);
  return e;
}
class ED {
  chunks = [];
  u8(e) {
    this.chunks.push(Uint8Array.of(e & 255));
  }
  i16(e) {
    const t = new Uint8Array(2);
    (new DataView(t.buffer).setUint16(0, e & 65535, !0), this.chunks.push(t));
  }
  u16(e) {
    const t = new Uint8Array(2);
    (new DataView(t.buffer).setUint16(0, e & 65535, !0), this.chunks.push(t));
  }
  i32(e) {
    const t = new Uint8Array(4);
    (new DataView(t.buffer).setInt32(0, e | 0, !0), this.chunks.push(t));
  }
  u32(e) {
    const t = new Uint8Array(4);
    (new DataView(t.buffer).setUint32(0, e >>> 0, !0), this.chunks.push(t));
  }
  bytes(e) {
    this.chunks.push(Uint8Array.from(e));
  }
  blob(e) {
    (this.u32(e.byteLength), this.bytes(e));
  }
  string(e) {
    (this.i32(e.length), this.chunks.push(CD(e)));
  }
  finish() {
    let e = 0;
    for (const r of this.chunks) e += r.length;
    const t = new Uint8Array(e);
    let i = 0;
    for (const r of this.chunks) (t.set(r, i), (i += r.length));
    return t;
  }
}
function wh0(n, e) {
  const t = new SD(n),
    i = t.u32(),
    r = uh0(i);
  if (r === void 0) {
    const V = k_(i, "header");
    throw new Error(
      `KSV header 版本不受支持（${i.toString(16)}${V === void 0 ? "" : ` = KartRecord${V}Header`}）。`,
    );
  }
  const s = t.string(),
    o = t.i16(),
    a = t.u8(),
    c = t.u8(),
    l = t.u32(),
    u = t.u32(),
    h = t.string(),
    d = t.string(),
    f = t.u16(),
    p = t.u16(),
    v = t.u32(),
    w = t.u8() === 1,
    g = t.string(),
    y = t.string(),
    b = t.i32(),
    A = t.i32(),
    x = t.string(),
    M = r >= 12 ? t.blob() : t.bytes(8),
    E = t.u8(),
    _ = AD(r) ? t.u8() : void 0,
    C = yD(r) ? t.u8() : 0,
    S = t.u32(),
    G = [];
  for (let V = 0; V < S; V += 1)
    G.push({
      playerName: t.string(),
      clubName: t.string(),
      equipment: vh0(t, r),
    });
  const I = t.u32(),
    L = hh0(I);
  if (L === void 0) {
    const V = k_(I, "record");
    throw new Error(
      `KSV record 版本不受支持（${I.toString(16)}${V === void 0 ? "" : ` = KartRecord${V}`}）。`,
    );
  }
  if (L !== r) throw new Error(`KSV header v${r} 与 record v${L} 版本不匹配。`);
  const k = t.i32();
  if (k < 0) throw new Error("KSV 记录条数无效。");
  const D = [];
  for (let V = 0; V < k; V += 1) {
    const K = t.i32();
    if (K < 0) throw new Error("KSV 帧数无效。");
    const P = [];
    for (let q = 0; q < K; q += 1) P.push(TD(t, e));
    D.push({ stamps: P });
  }
  if (t.remaining !== 0) throw new Error("KSV 头部解析后有剩余字节。");
  return {
    headerVersion: r,
    recordTitle: s,
    regionCode: o,
    unknown1_1: a,
    contestType: c,
    playerNameHash: l,
    unknown1_2: u,
    recorderAccount: h,
    recorderName: d,
    recordingDateDays: f,
    recordingDateTime: p,
    recordChecksum: v,
    isOfficial: w,
    description: g,
    trackName: y,
    unknown3: b,
    bestTimeMs: A,
    contestImg: x,
    opaqueBlob: M,
    unknown6: E,
    speed: _,
    unknown7: C,
    players: G,
    recordVersion: L,
    records: D,
  };
}
function vh0(n, e) {
  if (bD(e))
    return {
      character: n.i16(),
      paint: n.i16(),
      kart: n.i16(),
      plate: n.i16(),
      goggle: n.i16(),
      balloon: n.i16(),
      equ2: n.i16(),
      headband: n.i16(),
      replay: n.i16(),
      cane: n.i16(),
      equ3: n.i16(),
      apparel: n.i16(),
      equ4: n.i16(),
      plateText: n.string(),
      startSlot: n.u8(),
      unknownPlayerFlag: n.u8(),
      equ5: n.i16(),
      equ6: n.i16(),
      equ7: n.i16(),
      equ8: n.i16(),
      equ9: n.i16(),
      equ10: n.i16(),
    };
  const t = n.i16(),
    i = n.i16(),
    r = n.i16(),
    s = n.i16(),
    o = n.i16(),
    a = n.i16(),
    c = n.i16(),
    l = n.i16(),
    u = n.i16(),
    h = n.i16(),
    d = n.i16(),
    f = n.i16(),
    p = n.i16(),
    v = n.i16(),
    w = n.string(),
    g = n.u8(),
    y = n.u8(),
    b = n.i16(),
    A = n.i16(),
    x = n.i16(),
    M = n.i16(),
    E = n.i16(),
    _ = n.i16(),
    C = n.i16(),
    S = n.i16();
  return {
    character: t,
    kartPaint: i,
    characterColor: r,
    kart: s,
    plate: o,
    goggle: a,
    balloon: c,
    equ2: l,
    headband: u,
    replay: h,
    cane: d,
    equ3: f,
    apparel: p,
    equ4: v,
    plateText: w,
    startSlot: g,
    unknownPlayerFlag: y,
    equ5: b,
    equ6: A,
    equ7: x,
    equ8: M,
    equ9: E,
    equ10: _,
    equ11: C,
    equ12: S,
  };
}
function yh0(n, e, t) {
  if (bD(t)) {
    if ("kartPaint" in e)
      throw new Error("KSV v8/v9 装备不能携带 v10 的 kartPaint 槽位。");
    (n.i16(e.character),
      n.i16(e.paint),
      n.i16(e.kart),
      n.i16(e.plate),
      n.i16(e.goggle),
      n.i16(e.balloon),
      n.i16(e.equ2),
      n.i16(e.headband),
      n.i16(e.replay),
      n.i16(e.cane),
      n.i16(e.equ3),
      n.i16(e.apparel),
      n.i16(e.equ4),
      n.string(e.plateText),
      n.u8(e.startSlot),
      n.u8(e.unknownPlayerFlag),
      n.i16(e.equ5),
      n.i16(e.equ6),
      n.i16(e.equ7),
      n.i16(e.equ8),
      n.i16(e.equ9),
      n.i16(e.equ10));
    return;
  }
  if (!("kartPaint" in e))
    throw new Error("KSV v11/v12 装备缺少 v10 引入的 kartPaint 槽位。");
  (n.i16(e.character),
    n.i16(e.kartPaint),
    n.i16(e.characterColor),
    n.i16(e.kart),
    n.i16(e.plate),
    n.i16(e.goggle),
    n.i16(e.balloon),
    n.i16(e.equ2),
    n.i16(e.headband),
    n.i16(e.replay),
    n.i16(e.cane),
    n.i16(e.equ3),
    n.i16(e.apparel),
    n.i16(e.equ4),
    n.string(e.plateText),
    n.u8(e.startSlot),
    n.u8(e.unknownPlayerFlag),
    n.i16(e.equ5),
    n.i16(e.equ6),
    n.i16(e.equ7),
    n.i16(e.equ8),
    n.i16(e.equ9),
    n.i16(e.equ10),
    n.i16(e.equ11),
    n.i16(e.equ12));
}
function TD(n, e) {
  const t = n.i16(),
    i = n.i16(),
    r = n.i16(),
    s = mD < e ? n.i32() : n.i16();
  return {
    time: t,
    x: i,
    y: r,
    z: s,
    w: n.i16(),
    qx: n.i16(),
    qy: n.i16(),
    qz: n.i16(),
    status: n.u16(),
  };
}
function _D(n, e, t) {
  (n.i16(e.time),
    n.i16(e.x),
    n.i16(e.y),
    mD < t ? n.i32(e.z) : n.i16(e.z),
    n.i16(e.w),
    n.i16(e.qx),
    n.i16(e.qy),
    n.i16(e.qz),
    n.u16(e.status));
}
function Ah0(n, e) {
  const t = new ED();
  t.i32(n.stamps.length);
  for (const i of n.stamps) _D(t, i, e);
  return t.finish();
}
function bh0(n, e) {
  const t = new SD(n),
    i = t.i32();
  if (i < 0) throw new Error("KSV record 帧数无效。");
  const r = [];
  for (let s = 0; s < i; s += 1) r.push(TD(t, e));
  if (t.remaining !== 0) throw new Error("KSV record 解析后有剩余字节。");
  return { stamps: r };
}
function Mh0(n, e) {
  const t = new ED();
  if (
    (t.u32(_y(n.headerVersion)),
    t.string(n.recordTitle),
    t.i16(n.regionCode),
    t.u8(n.unknown1_1),
    t.u8(n.contestType),
    t.u32(xh0(n.players)),
    t.u32(n.unknown1_2),
    t.string(n.recorderAccount),
    t.string(n.recorderName),
    t.u16(n.recordingDateDays),
    t.u16(n.recordingDateTime),
    t.u32(Sh0(n.records)),
    t.u8(n.isOfficial ? 1 : 0),
    t.string(n.description),
    t.string(n.trackName),
    t.i32(n.unknown3),
    t.i32(n.bestTimeMs),
    t.string(n.contestImg),
    n.headerVersion >= 12)
  )
    t.blob(n.opaqueBlob);
  else {
    if (n.opaqueBlob.byteLength !== 8)
      throw new Error("旧版 KSV 头部要求 8 字节 opaqueBlob。");
    t.bytes(n.opaqueBlob);
  }
  if ((t.u8(n.unknown6), AD(n.headerVersion))) {
    if (n.speed === void 0)
      throw new Error(`KSV v${n.headerVersion} 头部必须携带 speed 字节。`);
    t.u8(n.speed);
  } else if (n.speed !== void 0)
    throw new Error("KSV v8 头部没有 speed 字节，不能写入。");
  (yD(n.headerVersion) && t.u8(n.unknown7), t.u32(n.players.length));
  for (const i of n.players)
    (t.string(i.playerName),
      t.string(i.clubName),
      yh0(t, i.equipment, n.headerVersion));
  (t.u32(Gy(n.recordVersion)), t.i32(n.records.length));
  for (const i of n.records) {
    t.i32(i.stamps.length);
    for (const r of i.stamps) _D(t, r, e);
  }
  return t.finish();
}
function xh0(n) {
  let e = 0;
  for (const t of n) e = (e + Dt(CD(t.playerName))) >>> 0;
  return e;
}
function Sh0(n) {
  let e = 0,
    t = 0;
  for (const i of n)
    for (let r = 0; r < i.stamps.length; r += 1)
      (r & 1) === 1
        ? (e = (e + i.stamps[r].status) >>> 0)
        : (t = (t + i.stamps[r].status) >>> 0);
  return (((e << 16) >>> 0) + t) >>> 0;
}
const Ch0 = "kartrider-web:p3528",
  _e = "ghosts",
  Eh0 = 3;
class Th0 {
  database;
  async get(e) {
    const t = await this.open(),
      i = await _h0(t.transaction(_e, "readonly").objectStore(_e).get(e));
    if (i !== void 0) return L_(i);
  }
  async list() {
    try {
      const t = (await this.open())
        .transaction(_e, "readonly")
        .objectStore(_e)
        .openCursor();
      return await new Promise((i, r) => {
        const s = [];
        ((t.onerror = () => r(t.error)),
          (t.onsuccess = () => {
            const o = t.result;
            if (!o) return i(s);
            (s.push({ key: String(o.key), record: L_(o.value) }), o.continue());
          }));
      });
    } catch {
      return [];
    }
  }
  async put(e, t) {
    const i = await this.open(),
      r = {
        schemaVersion:
          t.originalKsvBytes || t.participants.some((o) => o.rawRecording)
            ? 3
            : 2,
        zCeiling: t.zCeiling,
        timeBase: t.timeBase,
        originalKsvBytes: t.originalKsvBytes && Pc(t.originalKsvBytes),
        participants: t.participants.map((o) => ({
          equipment: o.equipment,
          frames: Pc(Ah0(o.record, t.zCeiling)),
          ...(o.rawRecording ? { rawRecording: o.rawRecording } : {}),
        })),
      },
      s = i.transaction(_e, "readwrite");
    (s.objectStore(_e).put(r, e), await Df(s));
  }
  async putRaw(e, t, i) {
    const r = await this.open(),
      s = {
        schemaVersion: 3,
        zCeiling: 0,
        timeBase: t.metadata.timeBase,
        originalKsvBytes: i && Pc(i),
        participants: [
          {
            equipment: t.metadata.equipment,
            rawRecording: t,
            frames: Pc(new Uint8Array()),
          },
        ],
      },
      o = r.transaction(_e, "readwrite");
    (o.objectStore(_e).put(s, e), await Df(o));
  }
  async delete(e) {
    const i = (await this.open()).transaction(_e, "readwrite");
    (i.objectStore(_e).delete(e), await Df(i));
  }
  open() {
    if (!this.database) {
      const e = globalThis.indexedDB;
      if (!e) throw new Error("IndexedDB 不可用，幽灵轨迹无法持久化。");
      this.database = new Promise((t, i) => {
        const r = e.open(Ch0, Eh0);
        ((r.onupgradeneeded = (s) => {
          const o = r.result.objectStoreNames.contains(_e)
            ? r.transaction.objectStore(_e)
            : r.result.createObjectStore(_e);
          if (s.oldVersion === 1) {
            const a = o.openCursor();
            a.onsuccess = () => {
              const c = a.result;
              if (!c) return;
              const l = c.value;
              (l &&
                "frames" in l &&
                c.update({
                  schemaVersion: 2,
                  zCeiling: l.zCeiling,
                  participants: [{ equipment: l.equipment, frames: l.frames }],
                }),
                c.continue());
            };
          }
        }),
          (r.onsuccess = () => t(r.result)),
          (r.onerror = () => i(r.error ?? new Error("IndexedDB 打开失败。"))),
          (r.onblocked = () => i(new Error("IndexedDB 打开被阻止。"))));
      });
    }
    return this.database;
  }
}
function L_(n) {
  const e = n.participants.map((t) => ({
    equipment: t.equipment,
    record:
      t.frames && t.frames.byteLength > 0
        ? bh0(new Uint8Array(t.frames), n.zCeiling)
        : { stamps: [] },
    ...(t.rawRecording ? { rawRecording: t.rawRecording } : {}),
  }));
  return {
    ...(n.schemaVersion === 3 ? { schemaVersion: 3 } : {}),
    zCeiling: n.zCeiling,
    ...(n.timeBase ? { timeBase: n.timeBase } : {}),
    ...(n.originalKsvBytes
      ? { originalKsvBytes: new Uint8Array(n.originalKsvBytes) }
      : {}),
    participants: e,
  };
}
function _h0(n) {
  return new Promise((e, t) => {
    ((n.onsuccess = () => e(n.result)),
      (n.onerror = () => t(n.error ?? new Error("IndexedDB 请求失败。"))));
  });
}
function Df(n) {
  return new Promise((e, t) => {
    ((n.oncomplete = () => e()),
      (n.onabort = () => t(n.error ?? new Error("IndexedDB 事务已中止。"))),
      (n.onerror = () => t(n.error ?? new Error("IndexedDB 事务失败。"))));
  });
}
function Pc(n) {
  const e = new ArrayBuffer(n.byteLength);
  return (new Uint8Array(e).set(n), e);
}
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
const Vf = 100,
  Bh0 = 6e5;
class kD {
  constructor(e) {
    this.zCeiling = e;
  }
  zCeiling;
  runtimeStamps = [];
  started = !1;
  stopped = !1;
  baseTime = 0;
  nextGrid = 0;
  previousTime = 0;
  previous;
  begin(e) {
    this.runtimeStamps.push({ ...e, timeMs: 0, status: 0 });
  }
  update(e) {
    if (this.stopped) return !1;
    if (!this.started)
      return (
        (this.started = !0),
        (this.baseTime = e.timeMs),
        (this.nextGrid = e.timeMs),
        (this.previousTime = e.timeMs),
        (this.previous = e),
        this.runtimeStamps.push({ ...e, timeMs: 0 }),
        !0
      );
    if (e.timeMs - this.baseTime >= Bh0) return ((this.stopped = !0), !1);
    if (e.timeMs - this.nextGrid < Vf)
      return ((this.previousTime = e.timeMs), (this.previous = e), !1);
    const t = Math.floor((e.timeMs - this.nextGrid) / Vf) * Vf;
    this.nextGrid += t;
    const i = this.previous;
    if (!i) throw new Error("KSV recorder missing previous pose");
    const r = e.timeMs - this.previousTime,
      s =
        r <= 0
          ? 1
          : Math.fround(
              Math.fround(this.nextGrid - this.previousTime) / Math.fround(r),
            ),
      o = Ih0(i, e, s);
    return (
      this.runtimeStamps.push({ ...o, timeMs: this.nextGrid - this.baseTime }),
      (this.previousTime = this.nextGrid),
      !0
    );
  }
  finish() {
    return { stamps: this.runtimeStamps.map((e) => xD(e, this.zCeiling)) };
  }
  finishRuntime() {
    return this.runtimeStamps.slice();
  }
}
class Rh0 {
  encode(e, t) {
    if (e.ksvRuntimeStamps)
      return { stamps: e.ksvRuntimeStamps.map((o) => xD(o, t)) };
    const i = e.frames,
      r = i[0];
    if (!r) return { stamps: [] };
    const s = new kD(t);
    s.begin(F_(r));
    for (const o of i) s.update(F_(o));
    return s.finish();
  }
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
function F_(n) {
  const e = n.rotation;
  return {
    timeMs: Math.max(0, n.stageTimeMs),
    x: n.position.x,
    y: -n.position.z,
    z: n.position.y,
    w: e.w,
    qx: e.x,
    qy: e.y,
    qz: e.z,
    status: GD(
      n.state.stateCode,
      n.state.driftActive,
      n.state.instantAccelerationActive,
      n.state.motionRequest,
    ),
  };
}
const D_ = { unknown1_1: 255, unknown6: 0 },
  Fc = { regionCode: 0, unknown1_2: 0, unknown3: 0, unknown7: 0 },
  kh0 = Uint8Array.of(0, 0, 0, 0);
class Lh0 {
  build(e, t) {
    const i = Ph0(e.metadata.equipment),
      r = e.metadata.equipment.playerName ?? "";
    return {
      headerVersion: 12,
      recordTitle: "",
      regionCode: Fc.regionCode,
      unknown1_1: D_.unknown1_1,
      contestType: 9,
      playerNameHash: 0,
      unknown1_2: Fc.unknown1_2,
      recorderAccount: "",
      recorderName: r,
      recordingDateDays: 0,
      recordingDateTime: 0,
      recordChecksum: 0,
      isOfficial: !1,
      description: "",
      trackName: e.metadata.trackId,
      unknown3: Fc.unknown3,
      bestTimeMs: e.metadata.summary.elapsedMs,
      contestImg: "",
      opaqueBlob: Uint8Array.from(kh0),
      unknown6: D_.unknown6,
      speed: e.metadata.speed,
      unknown7: Fc.unknown7,
      players: [{ playerName: r, clubName: "", equipment: i }],
      recordVersion: 12,
      records: [t],
    };
  }
}
function Ph0(n) {
  return {
    character: n.character,
    kartPaint: n.kartPaint ?? 0,
    characterColor: n.characterColor ?? 0,
    kart: n.kart,
    plate: n.plate,
    goggle: n.goggle,
    balloon: n.balloon,
    equ2: n.superBoss ?? 0,
    headband: n.headBand,
    replay: n.headphone ?? 0,
    cane: n.handGearL,
    equ3: n.handGearR ?? 0,
    apparel: n.uniform ?? 0,
    equ4: n.decal ?? 0,
    plateText: n.plateText,
    startSlot: n.startSlot,
    unknownPlayerFlag: 0,
    equ5: 0,
    equ6: 0,
    equ7: 0,
    equ8: 0,
    equ9: 0,
    equ10: 0,
    equ11: 0,
    equ12: 0,
  };
}
function LD(n, e, t, i = "国服") {
  const r = `${n.toLowerCase()}\0${e}\0${t}`;
  return i === "国服" ? r : `${r}\0retro`;
}
const PD = "kartrider-web:p3553:time-attack-records-v1",
  Fh0 = "kartrider-web:p3528:time-attack-records-v1";
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
  record(e) {
    return this.summaries.get(e);
  }
  static recordKey(e, t) {
    if (!e.trackId) throw new Error("TimeAttack record key 缺少赛道。 ");
    return LD(e.trackId, Ue(t), t.booster, t.version);
  }
  static trackIdFromKey(e) {
    return e.split("\0")[0] ?? "";
  }
  async restore(e) {
    try {
      const { records: t, migrations: i, usedLegacy: r } = Vh0();
      for (const [s, o] of t) this.summaries.set(s, o);
      for (const [s, o] of i)
        try {
          (await this.ghostStore.get(s)) ||
            (await this.put(s, [o], Pt.trackIdFromKey(s)));
        } catch (a) {
          e(`幽灵轨迹迁移失败：${z_(a)}`);
          const c = this.summaries.get(s);
          c && this.summaries.set(s, { ...c, hasGhost: !1 });
        }
      (r || i.length > 0) && this.persist();
    } catch (t) {
      e(`TimeAttack record 读取失败：${z_(t)}`);
    }
  }
  async promote(e, t, i, r) {
    (t && t.length > 0 && (await this.put(e, t, i)),
      this.summaries.set(e, t && t.length > 0 ? { ...r, hasGhost: !0 } : r),
      this.persist());
  }
  async save(e, t, i) {
    (Nf("save", { key: e, sourceCount: t.length }),
      await this.put(e, t, Pt.trackIdFromKey(e)),
      this.summaries.set(e, { ...i, hasGhost: !0 }),
      this.persist());
  }
  async saveRaw(e, t) {
    (Nf("save-raw", { key: e, frames: t.frames.length }),
      await this.ghostStore.putRaw(e, t),
      this.summaries.set(e, { ...t.metadata.summary, hasGhost: !0 }),
      this.persist());
  }
  async saveImported(e, t, i, r) {
    const s = t.map((o) => ({ ...o, timeBase: "countdown" }));
    (await this.put(e, s, Pt.trackIdFromKey(e), r),
      this.summaries.set(e, { ...i, hasGhost: !0 }),
      this.persist());
  }
  async exportSource(e) {
    const t = await this.ghostStore.get(e);
    if (!t) return;
    if (t.originalKsvBytes)
      return { kind: "original-ksv", bytes: t.originalKsvBytes };
    const i = t.participants[0]?.rawRecording;
    return i ? { kind: "raw", recording: i } : void 0;
  }
  async exportKsv(e) {
    const t = await this.ghostStore.get(e);
    if (!t) throw new Error(`Replay not found: ${e}`);
    if (t.originalKsvBytes) {
      const a = this.summaries.get(e);
      return {
        bytes: Uint8Array.from(t.originalKsvBytes),
        filename: V_(
          e,
          t.participants[0]?.equipment.playerName ?? a?.kartName,
          t.participants[0]?.rawRecording?.metadata.summary.elapsedMs ??
            a?.elapsedMs,
        ),
        source: "original",
        metadataParity: "preserved-original",
      };
    }
    const i = t.participants[0]?.rawRecording;
    if (!i)
      throw new Error(
        "Replay exists but has neither rawRecording nor originalKsvBytes",
      );
    const r = B6(i.metadata.trackId),
      s = this.ksvEncoder.encode(i, r),
      o = this.ksvHeaderBuilder.build(i, s);
    return {
      bytes: ph0(o, r),
      filename: V_(
        e,
        i.metadata.equipment.playerName,
        i.metadata.summary.elapsedMs,
      ),
      source: "generated-v12",
      metadataParity: "native-partial",
    };
  }
  async delete(e) {
    return (
      await this.ghostStore.delete(e),
      this.summaries.get(e)?.hasGhost
        ? (this.summaries.delete(e), this.persist(), !0)
        : !1
    );
  }
  async put(e, t, i, r) {
    await this.ghostStore.put(e, {
      zCeiling: B6(i),
      timeBase: Dh0(t),
      participants: t.map((s) => ({
        equipment: s.equipment,
        record: s.record,
        ...(s.rawRecording ? { rawRecording: s.rawRecording } : {}),
      })),
      originalKsvBytes: r,
    });
  }
  persist() {
    (localStorage.setItem(PD, JSON.stringify([...this.summaries])),
      Nf("summary-persist", { count: this.summaries.size }));
  }
}
function V_(n, e, t) {
  const i = Pt.trackIdFromKey(n),
    r = e || "replay",
    s =
      typeof t == "number" && Number.isFinite(t)
        ? String(Math.max(0, Math.trunc(t)))
        : "unknown-time";
  return `${N_(i)}_${N_(r)}_${s}.ksv`;
}
function N_(n) {
  return (
    n
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/[. ]+$/g, "")
      .trim() || "replay"
  );
}
function Dh0(n) {
  const e = n.filter((i) => i.timeBase !== void 0);
  if (e.length !== n.length) return;
  const t = e[0]?.timeBase;
  return e.every((i) => i.timeBase === t) ? t : void 0;
}
function Nf(n, e) {
  new URLSearchParams(globalThis.location?.search ?? "").get("ghost-debug") ===
    "1" && console.debug("[ghost-recording]", n, e ?? {});
}
function Vh0() {
  const n = O_(PD),
    e = O_(Fh0),
    t = new Set(),
    i = [],
    r = [];
  for (const [s, o] of [...n, ...e]) {
    if (t.has(s)) continue;
    t.add(s);
    const { replay: a, ...c } = o;
    (a && r.push([s, a]), i.push([s, a ? { ...c, hasGhost: !0 } : c]));
  }
  return { records: i, migrations: r, usedLegacy: e.length > 0 };
}
function O_(n) {
  const e = localStorage.getItem(n);
  if (e === null) return [];
  const t = JSON.parse(e);
  if (!Array.isArray(t)) throw new Error(`TimeAttack record ${n} 格式无效。`);
  return t;
}
function z_(n) {
  return n instanceof Error ? n.message : String(n);
}
class Nh0 {
  constructor(e) {
    this.host = e;
  }
  host;
  restore() {
    return this.host.library.restore((e) => this.host.reportError(e));
  }
  async promote(e, t) {
    const i = this.host.getSelection(),
      r = this.host.getVehicleTitle();
    if (!i || !r)
      throw new Error("TimeAttack record promotion 缺少当前资源身份。 ");
    const s = Pt.recordKey(i, this.host.getReadyOptions()),
      o = this.captureReplay(e, t, r),
      a = this.host.getTrackId() ?? i.trackId ?? "";
    await this.host.library.promote(s, o, a, {
      elapsedMs: e,
      kartName: r,
      crashCount: t.crashCount,
      boosterCount: t.boosterCount,
      speed: Ue(this.host.getReadyOptions()),
      booster: this.host.getReadyOptions().booster,
      ...(o ? { hasGhost: !0 } : {}),
    });
  }
  captureReplay(e, t, i) {
    const r = this.currentEquipment(),
      s = this.host.getRecorder();
    if (!s || !r) return;
    const o = s.finish()[0];
    if (!o || o.record.stamps.length === 0) return;
    const a = this.rawRecording(o, r, e, t, i);
    return [
      {
        equipment: r,
        record: o.record,
        timeBase: "countdown",
        ...(a ? { rawRecording: a } : {}),
      },
    ];
  }
  rawRecording(e, t, i, r, s) {
    const o = this.host.getSelection();
    if (!o?.trackId) return;
    const a = this.host.getReadyOptions();
    let c;
    try {
      c = y6(a);
    } catch {
      return;
    }
    return {
      metadata: {
        trackId: o.trackId,
        speed: c,
        version: a.version ?? "国服",
        booster: a.booster,
        timeBase: "countdown",
        equipment: t,
        summary: {
          elapsedMs: i,
          kartName: s,
          crashCount: r.crashCount,
          boosterCount: r.boosterCount,
          speed: c,
          booster: a.booster,
        },
      },
      frames: [],
      ksvRuntimeStamps: e.runtimeStamps,
    };
  }
  currentEquipment() {
    const e = this.host.getSelection();
    if (e?.vehicleItemId === void 0 || !e.characterItemId) return;
    const t = this.host.getProfile().equipment;
    return {
      character: e.characterItemId,
      kartPaint: t.itemIds[2],
      characterColor: t.itemIds[70],
      kart: e.vehicleItemId,
      ...(e.vehicleSystemKey !== void 0
        ? { systemKey: e.vehicleSystemKey }
        : {}),
      ...(e.vehiclePath !== void 0 ? { kartPath: e.vehiclePath } : {}),
      plate: t.itemIds[4],
      goggle: t.itemIds[8],
      balloon: t.itemIds[9],
      headBand: t.itemIds[11],
      handGearL: t.itemIds[16],
      plateText: this.host.getProfile().initial,
      ...(this.host.getLocalNickname()
        ? { playerName: this.host.getLocalNickname() }
        : {}),
      startSlot: this.host.getPlayerSlot(),
    };
  }
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
class Yh0 {
  record;
  lastTimeMs;
  head;
  tail;
  velocity = { x: 0, y: 0, z: 0 };
  constructor(e) {
    if (e.stamps.length === 0) throw new Error("KSV 平滑采样记录没有任何帧。");
    this.record = e;
  }
  sample(e) {
    const t = FD(this.record, e),
      i = { x: t.x, y: t.y, z: t.z };
    ((this.tail = this.head), (this.head = i));
    const r = this.lastTimeMs === void 0 ? 0 : e - this.lastTimeMs;
    ((this.lastTimeMs = e),
      r > 0 &&
        this.tail &&
        (this.velocity = Zh0(this.tail, this.head, this.velocity, r)));
    const s = fd0(this.velocity),
      o = L9(s * 3.6);
    return {
      sample: t,
      velocity: this.velocity,
      speedKmh: o,
      renderBasisClient: Qh0(this.velocity, s, t.quaternion),
    };
  }
}
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
  async deleteGhost() {
    const e = this.options.currentGhostKey();
    if (!e) {
      this.options.reportError("当前地图没有记录，无法删除影子。");
      return;
    }
    try {
      await this.options.deleteGhost(e);
    } catch (t) {
      this.options.reportError(
        `删除失败：${t instanceof Error ? t.message : String(t)}`,
      );
    }
  }
  async exportGhost() {
    const e = this.options.currentGhostKey();
    if (!e) {
      this.options.reportError("当前地图没有记录，无法导出 KSV。 ");
      return;
    }
    try {
      if (!this.options.exportGhost) throw new Error("导出功能尚未就绪。 ");
      await this.options.exportGhost(e);
    } catch (t) {
      this.options.reportError(
        `导出失败：${t instanceof Error ? t.message : String(t)}`,
      );
    }
  }
  async importSelectedFile() {
    const e = this.input.files?.[0];
    if (!e || this.disposed) return;
    const t = ++this.importRevision,
      i = this.options.speedVersion();
    try {
      const r = new Uint8Array(await e.arrayBuffer());
      if (!this.isCurrentImport(t)) return;
      const { info: s, zCeiling: o } = pd0(r),
        a = gd0(s, i),
        c = zD(s, i),
        l = s.players[0]?.equipment.kart,
        u =
          l === void 0
            ? ""
            : ((await this.options.resolveGhostKartTitle(l)) ?? "");
      if (
        !this.isCurrentImport(t) ||
        (await this.options.importGhost(
          a.key,
          a.sources,
          { ...a.summary, kartName: u },
          r,
        ),
        !this.isCurrentImport(t))
      )
        return;
      const h = Math.max(...a.sources.map((d) => d.record.stamps.length));
      await this.switchToImportedTrack(c, o, h, t);
    } catch (r) {
      this.isCurrentImport(t) &&
        this.options.reportError(
          `导入失败：${r instanceof Error ? r.message : String(r)}`,
        );
    } finally {
      this.isCurrentImport(t) && (this.input.value = "");
    }
  }
  isCurrentImport(e) {
    return !this.disposed && this.importRevision === e;
  }
  async switchToImportedTrack(e, t, i, r) {
    const s = await this.options.resolveGhostTrack(e.trackId);
    if (!this.isCurrentImport(r)) return;
    if (!s) {
      this.options.reportError(
        `已导入影子：地图 ${e.trackId} 不在当前目录，无法自动切换 ${X_(e)}（zCeiling ${t}，${i} 帧）`,
      );
      return;
    }
    if (!s.selection) {
      this.options.reportError(
        `已导入影子：${s.track.title} (${s.track.id})；READY 未就绪，未能自动切换 ${X_(e)}（zCeiling ${t}，${i} 帧）`,
      );
      return;
    }
    if (
      (this.pendingTrackSwitch &&
        (await this.pendingTrackSwitch.catch(() => {})),
      !this.isCurrentImport(r))
    )
      return;
    const o = this.options.selectGhostTrack(
      md0(s.selection, s.track),
      e.speed,
      e.booster,
      e.version,
    );
    this.pendingTrackSwitch = o;
    try {
      await o;
    } finally {
      this.pendingTrackSwitch === o && (this.pendingTrackSwitch = void 0);
    }
  }
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
  mount(e) {
    return Ly.attach({
      root: e,
      importGhost: (t, i, r, s) => this.importRecord(t, i, r, s),
      resolveGhostTrack: (t) => this.resolveTrack(t),
      resolveGhostKartTitle: (t) => this.resolveKartTitle(t),
      selectGhostTrack: (t, i, r, s) => this.host.selectTrack(t, i, r, s),
      deleteGhost: (t) => this.deleteRecord(t),
      exportGhost: (t) => this.exportRecord(t),
      currentGhostKey: () => this.host.currentKey(),
      speedVersion: () => this.host.speedVersion(),
      reportError: (t) => this.host.reportError(t),
      samplingMode: () => this.host.samplingMode(),
      onSamplingModeChange: (t) => this.host.changeSamplingMode(t),
      resetNickname: () => this.host.resetNickname(),
    });
  }
  async importRecord(e, t, i, r) {
    const s = this.host.library.record(e),
      o = {
        elapsedMs: i.bestTimeMs,
        kartName: i.kartName ?? s?.kartName ?? "",
        speed: i.speed,
        booster: i.booster,
        hasGhost: !0,
      };
    try {
      r
        ? await this.host.library.saveImported(e, t, o, r)
        : await this.host.library.save(e, t, o);
    } catch (a) {
      throw (this.host.reportError(`影子导入失败：${yd0(a)}`), a);
    }
  }
  async resolveTrack(e) {
    const t = this.host.getLibrary();
    if (!t) return;
    const i = (await t.timeAttackTrackCatalog()).find(
      (r) => r.id.toLowerCase() === e.toLowerCase(),
    );
    return i ? { track: i, selection: this.host.getSelection() } : void 0;
  }
  async resolveKartTitle(e) {
    return (
      await this.host.getLibrary()?.timeAttackGarageCatalog()
    )?.karts.find((i) => i.itemId === e)?.title;
  }
  async deleteRecord(e) {
    (await this.host.library.delete(e)) &&
      e === this.host.currentKey() &&
      this.host.refreshRecord();
  }
  async exportRecord(e) {
    const t = await this.host.library.exportKsv(e);
    if (!t) throw new Error("录像不存在或缺少可导出的 replay 数据。 ");
    wd0(t.bytes, t.filename);
  }
}
function yd0(n) {
  return n instanceof Error ? n.message : String(n);
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
  seedStart(e, t, i, r) {
    (this.root.position.set(e.x, e.y, e.z),
      this.basisRight.set(t.x, t.y, t.z),
      this.basisUp.set(r.x, r.y, r.z),
      this.basisForward.set(i.x, i.y, i.z),
      this.orientationMatrix.makeBasis(
        this.basisRight,
        this.basisUp,
        this.basisForward,
      ),
      this.root.quaternion.setFromRotationMatrix(this.orientationMatrix));
  }
  setAssets(e, t, i, r, s, o, a, c) {
    this.usesP3553NonDualLinkedState = a === "p3553" && c <= 6;
    const l = J5(e.model),
      u = e.renderScene?.bySource.get(l);
    if (!u) throw new Error("影子 ReKart serialized root presentation 缺失。");
    if (t) {
      const d = l.children[6]?.value,
        f = d && "children" in d ? e.renderScene?.bySource.get(d) : void 0;
      if (!f) throw new Error("影子 ReKart root child 6 mount 缺失。");
      (f.clear(),
        f.add(t.object),
        r
          ? ((this.linkedPresentation = new _a(u, f, t.object, r === "always")),
            this.linkedPresentation.setMode(0))
          : t.object.scale.setScalar(i));
    }
    ((this.imported = e),
      (this.character = t),
      (this.animation = e.animation),
      (this.visual = s),
      (this.motorcycle = o),
      this.modelMount.add(e.object),
      (this.toonPairs.length = 0),
      qf(this.modelMount, this.toonPairs));
    const h = s.attachments.map((d) => e.scene.nodes.get(d)?.object);
    (!h[16] &&
      s.attachments[16] === "balloon" &&
      (h[16] = c7(e.model, e.scene)),
      (this.attachmentNodes = h));
  }
  setEffects(e) {
    this.effects = e;
  }
  setTrails(e, t) {
    ((this.trails = e), (this.trailVehicle = t), (this.trailState = 0));
  }
  attachToScene(e) {
    (e.add(this.root), this.trails && e.add(this.trails.object));
  }
  setDecorations(e, t) {
    const i = this.attachmentNodes[16];
    e &&
      i &&
      (e.scene.reset(performance.now()),
      i.add(e.scene.object),
      qf(e.scene.object),
      (this.balloon = e));
    for (const r of t) {
      const s = jd0[r.kind],
        o = this.character?.getDecorationSocket(s[0], s[1]);
      o &&
        (r.render.scene.reset(performance.now()),
        o.add(r.render.scene.object),
        qf(r.render.scene.object),
        (this.accessories = [...this.accessories, r]));
    }
  }
  update(e, t, i, r, s, o) {
    const a = "sample" in e ? e.sample : e,
      c = LL(a, this.poseScratch);
    this.root.position.set(c.position.x, c.position.y, c.position.z);
    const l =
      "renderBasisClient" in e
        ? xv(e.renderBasisClient, this.basisScratch)
        : { right: c.right, forward: c.forward, up: c.up };
    (this.basisRight.set(l.right.x, l.right.y, l.right.z),
      this.basisUp.set(l.up.x, l.up.y, l.up.z),
      this.basisForward.set(l.forward.x, l.forward.y, l.forward.z),
      this.orientationMatrix.makeBasis(
        this.basisRight,
        this.basisUp,
        this.basisForward,
      ),
      this.root.quaternion.setFromRotationMatrix(this.orientationMatrix));
    const u = RD(a.status),
      h = ID(a.status);
    u === 10
      ? this.lastBoosterState !== 10 &&
        (this.burstTeam = this.lastBoosterState === 4)
      : (this.lastBoosterState = u);
    const d = this.deriveMotion(
      c,
      l.forward,
      a.timeMs,
      "velocity" in e ? e : void 0,
    );
    this.updateAnimation(t, u, h, d.displaySpeedKmh);
    const f = this.usesP3553NonDualLinkedState
      ? this.linkedPresentation?.updateSpeedRace(u, t)
      : this.linkedPresentation?.update(u, t);
    (o?.("kt-ghost-anim"),
      this.character?.update(t, i, r, s, {
        forwardSpeed: d.forwardSpeed,
        rawSteer: d.rawSteer,
        tireTransient: 0,
        boosterState: u,
        instantAccelerationActive: P_(a.status),
        motorcycle: this.motorcycle,
        landingTrigger: !1,
        collisionHit: !1,
        collisionStrength: 0,
        visualScaleMode: 0,
        linkedPresentationMotion: f,
      }),
      o?.("kt-ghost-char"),
      this.imported?.renderScene?.update(i, r, s),
      o?.("kt-ghost-render"));
    for (const { source: p, clone: v } of this.toonPairs) f6(p, v);
    (this.effects &&
      (this.effects.setState(u, h, this.ghostDualTeam(u), P_(a.status), t) &&
        this.animation?.enterDualUse(),
      this.effects.update(t, i, r, s)),
      this.trails &&
        this.trailVehicle &&
        ((this.trailState = Kd0(a.status, this.trailState, this.trailVehicle)),
        this.trails.setState(this.trailState, t)),
      this.trails?.update(t, i, this.imported?.renderScene !== void 0),
      o?.("kt-ghost-fx"),
      this.balloon?.scene.update(t, i, r, s),
      this.accessories.forEach(({ kind: p, render: v }) => {
        (p === "headBand" && v.setOwnerState?.(u, t),
          v.scene.update(t, i, r, s));
      }),
      o?.("kt-ghost-decor"));
  }
  updateAnimation(e, t, i, r) {
    if (!this.animation || !this.visual) return;
    const s =
      (this.visual.isTransformAutoCharge &&
        r > this.visual.autoChargeLowSpeed) ||
      (t > 2 && t < 12);
    this.animation.update(e >>> 0, s, this.visual.transformTime, i, t);
  }
  ghostDualTeam(e) {
    return e === 4 ? !0 : e === 10 && this.burstTeam;
  }
  deriveMotion(e, t, i, r) {
    const s = Math.atan2(t.x, t.z);
    let o = 0,
      a = 0,
      c = 0;
    if (this.hasLastPose) {
      const l = (i - this.lastPoseTimeMs) / 1e3;
      if (l > 0) {
        const u = e.position.x - this.lastPosePosition.x,
          h = e.position.y - this.lastPosePosition.y,
          d = e.position.z - this.lastPosePosition.z;
        ((c = (Math.sqrt(u * u + h * h + d * d) / l) * 3.6),
          (o = (u * t.x + h * t.y + d * t.z) / l));
        let p = s - this.lastPoseHeading;
        for (; p > Math.PI;) p -= Math.PI * 2;
        for (; p < -Math.PI;) p += Math.PI * 2;
        a = p;
      }
    }
    if (r) {
      const l = { x: r.velocity.x, y: r.velocity.z, z: -r.velocity.y };
      ((o = l.x * t.x + l.y * t.y + l.z * t.z), (c = r.speedKmh));
    }
    return (
      (this.hasLastPose = !0),
      (this.lastPosePosition.x = e.position.x),
      (this.lastPosePosition.y = e.position.y),
      (this.lastPosePosition.z = e.position.z),
      (this.lastPoseHeading = s),
      (this.lastPoseTimeMs = i),
      { forwardSpeed: o, rawSteer: a, displaySpeedKmh: c }
    );
  }
  dispose() {
    (this.balloon?.dispose(),
      (this.balloon = void 0),
      this.accessories.forEach(({ render: e }) => e.dispose()),
      (this.accessories = []),
      (this.attachmentNodes = []),
      this.effects?.dispose(),
      (this.effects = void 0),
      this.trails?.dispose(),
      (this.trails = void 0),
      this.imported &&
        (this.imported.renderScene?.dispose(),
        u5(this.imported.object),
        (this.imported = void 0)),
      this.character?.dispose(),
      (this.character = void 0),
      (this.linkedPresentation = void 0),
      (this.animation = void 0),
      (this.visual = void 0),
      this.modelMount.clear(),
      this.root.removeFromParent());
  }
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
  async prepareMultiplayer(e, t = "") {
    if (this.multiplayerBuffers && this.multiplayerLobbyPath === t) return;
    const i = await G5(e, "zeta_/cn/content/bgmList.xml").bytes(),
      r = Fc0(
        new TextDecoder(i[0] === 255 ? "utf-16le" : "utf-8").decode(i),
        t,
      );
    if (this.multiplayerBuffers) {
      ((this.multiplayerBuffers = {
        ...this.multiplayerBuffers,
        lobby: await Kt(G5(e, r.lobby), this.context),
      }),
        (this.multiplayerLobbyPath = t));
      return;
    }
    const [s, o, a, c] = await Promise.all([
      Kt(G5(e, r.lobby), this.context),
      Kt(G5(e, r.room), this.context),
      Kt(G5(e, "sound_/bgm/main/game_end.ogg"), this.context),
      Kt(G5(e, "sound_/bgm/main/game_result.ogg"), this.context),
    ]);
    ((this.multiplayerBuffers = { lobby: s, room: o, finish: a, podium: c }),
      (this.multiplayerLobbyPath = t));
  }
  playMultiplayer(e) {
    const t = this.multiplayerBuffers?.[e];
    if (!t) throw Error("多人 BGM 尚未加载。");
    this.current?.source.buffer !== t && this.start(t, !0, !0);
  }
  playMultiplayerPodium() {
    const e = this.multiplayerBuffers?.podium;
    if (!e) throw Error("颁奖台音乐尚未加载。");
    this.current?.source.buffer !== e && this.start(e, !1, !1);
  }
  playMultiplayerFinish(e) {
    if (e) {
      this.playResult(!0);
      return;
    }
    const t = this.multiplayerBuffers?.finish;
    if (!t) throw Error("多人完赛音乐尚未加载。");
    this.start(t, !1, !1);
  }
  static async load(e, t, i, r) {
    const s = G5(e, "sound_/bgm/main/single.ogg"),
      o = ef0(e, s),
      a = G5(e, "sound_/bgm/main/game_win.ogg"),
      c = G5(e, "sound_/bgm/main/game_lose.ogg"),
      [l, u, h, d, f] = await Promise.all([
        eG(e, t, r),
        Kt(s, r),
        o === s ? Promise.resolve(void 0) : Kt(o, r),
        Kt(a, r),
        Kt(c, r),
      ]);
    return new P7(r, l, u, h ?? u, d, f, i);
  }
  async selectRace(e, t) {
    const i = await eG(e, t, this.context);
    ((this.raceBuffers = i.buffers),
      (this.raceNames = i.names),
      (this.currentRaceNameValue = void 0));
  }
  restart() {
    const e = this.random.next() % this.raceBuffers.length;
    ((this.currentRaceNameValue = this.raceNames[e]),
      this.start(this.raceBuffers[e], !0, !0));
  }
  get currentRaceName() {
    return this.currentRaceNameValue;
  }
  playReady() {
    this.current?.source.buffer !== this.readyBuffer &&
      this.start(this.readyBuffer, !0, !0);
  }
  playGarage() {
    this.current?.source.buffer !== this.garageBuffer &&
      this.start(this.garageBuffer, !0, !0);
  }
  playMyItems() {
    this.playReady();
  }
  playResult(e) {
    this.start(e ? this.winBuffer : this.loseBuffer, !1, !1);
  }
  dispose() {
    (this.clearTransition(),
      this.stop(this.retiring),
      this.stop(this.current),
      (this.retiring = void 0),
      (this.current = void 0));
  }
  silence() {
    this.dispose();
  }
  start(e, t, i) {
    (this.clearTransition(),
      this.stop(this.retiring),
      (this.retiring = i ? this.current : void 0),
      i || this.stop(this.current));
    const r = this.context.createBufferSource(),
      s = this.context.createGain();
    ((r.buffer = e),
      w4(r, t),
      he(s.gain, i ? 0 : 1, this.context.currentTime),
      S9(this.context, r, "bgm", s),
      r.start(),
      (this.current = { source: r, gain: s }),
      i &&
        ((this.transitionStep = 0),
        qM(this.context, !0),
        (this.transitionTimer = setInterval(
          () => this.advanceTransition(),
          100,
        ))));
  }
  advanceTransition() {
    if (!this.current) return this.clearTransition();
    if (this.transitionStep >= 16) {
      (this.stop(this.retiring),
        (this.retiring = void 0),
        this.clearTransition());
      return;
    }
    const e = Qd0(this.transitionStep++);
    (he(this.current.gain.gain, e.incoming, this.context.currentTime),
      he(this.retiring?.gain.gain, e.outgoing, this.context.currentTime));
  }
  clearTransition() {
    (this.transitionTimer !== void 0 && clearInterval(this.transitionTimer),
      (this.transitionTimer = void 0),
      qM(this.context, !1));
  }
  stop(e) {
    if (e) {
      try {
        e.source.stop();
      } catch {}
      (e.source.disconnect(), e.gain.disconnect());
    }
  }
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
class nf0 {
  record;
  lastTimeMs;
  mode;
  smooth;
  constructor(e, t = () => "native") {
    if (e.stamps.length === 0) throw new Error("KSV playback 记录没有任何帧。");
    ((this.record = e),
      (this.lastTimeMs = e.stamps[e.stamps.length - 1].time * 100),
      (this.mode = t));
  }
  get durationMs() {
    return this.lastTimeMs;
  }
  visitRouteStamps(e, t, i) {
    const r = this.record.stamps;
    let s = 0,
      o = r.length;
    for (; s < o;) {
      const a = (s + o) >>> 1;
      r[a].time * 100 <= e ? (s = a + 1) : (o = a);
    }
    for (let a = s; a < r.length && r[a].time * 100 <= t; a += 1) i(By(r[a]));
  }
  sample(e) {
    switch (this.mode()) {
      case "c1":
        return Jh0(this.record, e);
      case "c2":
        return ed0(this.record, e);
      case "native-smooth":
        return ((this.smooth ??= new Yh0(this.record)), this.smooth.sample(e));
      default:
        return FD(this.record, e);
    }
  }
}
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
  async loadGhostKartAssets(e, t, i, r, s, o) {
    const a = this.host.getLibrary();
    if (!a) throw new Error("影子资源库尚未建立。");
    const c = await a.timeAttackGarageCatalog(),
      l = c.karts.find((x) => x.itemId === e.equipment.kart),
      u = b4(
        c.karts,
        e.equipment.kart,
        e.equipment.kartPath ?? l?.path ?? "",
        e.equipment.systemKey,
      );
    if (!u)
      throw new Error(
        `影子录制的 ItemKart ${e.equipment.kart} 不在当前车库目录。`,
      );
    if (
      u.textureKey === void 0 ||
      u.engineGrade === void 0 ||
      u.fixedPlateId === void 0 ||
      u.hideChar === void 0 ||
      u.characterAniType === void 0
    )
      throw new Error(`影子 ItemKart ${u.itemId} metadata 不完整。`);
    const h = u.engineGrade,
      { createVehicleTimeAttackParameters: d } = await El(
        async () => {
          const { createVehicleTimeAttackParameters: x } =
            await Promise.resolve().then(() => AS);
          return { createVehicleTimeAttackParameters: x };
        },
        void 0,
      ),
      f =
        u.itemId === 0
          ? (await t3(a, u.path, u.systemKey)).parameter.value
          : void 0,
      { spec: p } = d({ itemId: u.itemId, systemKey: u.systemKey }, r, f, s),
      v = p.motorcycleType !== 0,
      w = U_(e.equipment),
      g = await this.loadVehicleRuntime(
        u.path,
        u.textureKey,
        u.fixedPlateId,
        a,
        t,
        i,
        w,
        void 0,
        void 0,
        void 0,
        u.systemKey,
        o,
        !u.linkCharacterId,
      );
    if (u.linkCharacterId) {
      if (
        u.hideChar ||
        u.characterAniType !== 0 ||
        u.alwaysLinkCharacter === void 0
      )
        throw new Error(
          `影子 ItemKart ${u.itemId} 出现未分析的 linked character flag 组合。`,
        );
      const x = await a.timeAttackLinkedCharacterItem(u.linkCharacterId),
        M = await this.loadCharacterAsset(
          x.path,
          x,
          g.visual.reverse,
          0,
          v,
          t,
          i,
          u.alwaysLinkCharacter ? "always" : "conditional",
          w,
          o,
        );
      return {
        imported: g.imported,
        visual: g.visual,
        character: M.scene,
        onCharacterSize: g.visual.onCharacterSize,
        linkedCharacter: u.alwaysLinkCharacter ? "always" : "conditional",
        engineGrade: h,
        motorcycle: v,
      };
    }
    const y = c.characters.find((x) => x.itemId === e.equipment.character);
    if (!y)
      throw new Error(
        `影子录制的 ItemCharacter ${e.equipment.character} 不在当前车库目录。`,
      );
    const b = await a.timeAttackCharacterItem(e.equipment.character, y.path),
      A = await this.loadCharacterAsset(
        y.path,
        b,
        g.visual.reverse,
        u.characterAniType,
        v,
        t,
        i,
        void 0,
        w,
        o,
      );
    return {
      imported: g.imported,
      visual: g.visual,
      character: A.scene,
      onCharacterSize: g.visual.onCharacterSize,
      linkedCharacter: !1,
      engineGrade: h,
      motorcycle: v,
    };
  }
  async loadGhostDecorations(e, t, i, r) {
    let s;
    const o = [];
    try {
      const a = e.equipment.itemIds[9];
      if (a !== 0) {
        const c = await t.timeAttackDecorationItem(9, a),
          l = e.equipment.itemIds[2],
          u = l === 0 ? void 0 : (await We(t, l)).primary;
        s = await Jw(t, c.internalId, i, r, { ...c, wireColor: u });
      }
      for (const [c, l] of [
        ["goggle", 8],
        ["headBand", 11],
        ["handGearL", 16],
      ]) {
        const u = e.equipment.itemIds[l];
        if (u === 0) continue;
        const h = await t.timeAttackDecorationItem(l, u);
        o.push({
          kind: c,
          render: await hr(t, c, h.internalId, i, r, {
            convertClientCoordinates: !1,
          }),
        });
      }
      return { balloon: s, accessories: o };
    } catch (a) {
      throw (s?.dispose(), o.forEach(({ render: c }) => c.dispose()), a);
    }
  }
  async rankColors(e) {
    const t = this.host.getLibrary();
    if (!t) throw new Error("比赛资源库尚未建立。");
    const i = [
      this.host.userProfile.equipment.itemIds[70],
      ...e.map((r) => r.equipment.characterColor ?? 0),
    ];
    return Promise.all(
      i.map(async (r) =>
        r === 0 ? void 0 : (await We(t, r, 70)).primary & 16777215,
      ),
    );
  }
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
class af0 {
  sampler;
  constructor(e) {
    this.sampler = new kD(e);
  }
  begin(e) {
    this.sampler.begin(e);
  }
  update(e) {
    return this.sampler.update(e);
  }
  finishRuntime() {
    return this.sampler.finishRuntime();
  }
  finish() {
    return this.sampler.finish();
  }
}
class cf0 {
  constructor(e) {
    this.zCeiling = e;
  }
  zCeiling;
  participants = [];
  get count() {
    return this.participants.length;
  }
  addParticipant(e) {
    const t = new af0(this.zCeiling);
    (t.begin(e.sample(0)), this.participants.push({ ...e, stream: t }));
  }
  update(e) {
    for (const t of this.participants) t.stream.update(t.sample(e));
  }
  finish() {
    return this.participants.map((e) => ({
      equipment: e.equipment,
      startSlot: e.startSlot,
      record: e.stream.finish(),
      runtimeStamps: e.stream.finishRuntime(),
    }));
  }
  reset() {
    this.participants.length = 0;
  }
}
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
class hf0 {
  constructor(e) {
    this.track = e;
  }
  track;
  owners = new WeakMap();
  seed(e, t) {
    (this.track.resetRouteState(e, t),
      this.owners.set(e, {
        start: { ...t },
        previous: { ...t },
        elapsedMs: -1 / 0,
      }));
  }
  update(e, t, i, r) {
    let s = this.owners.get(e);
    if (!s) throw new Error("Ghost route owner must be seeded at race start.");
    if (
      (i < s.elapsedMs && (this.seed(e, s.start), (s = this.owners.get(e))),
      i === s.elapsedMs)
    )
      return;
    const o = (a) => {
      (a.x === s.previous.x && a.y === s.previous.y && a.z === s.previous.z) ||
        (this.track.updateRoute(e, s.previous, a), (s.previous = { ...a }));
    };
    (t.visitRouteStamps(s.elapsedMs, i, (a) => {
      o({ x: a.x, y: a.z, z: Math.fround(-a.y) });
    }),
      o(r),
      (s.elapsedMs = i));
  }
  distance(e) {
    if (!this.owners.has(e))
      throw new Error("Ghost route owner has no race history.");
    return this.track.getRouteState(e).distance;
  }
}
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
  captureGhostRuntime(e) {
    const t = this.host,
      i = t.getPhysics().body,
      r = PL({
        position: i.position,
        right: i.right,
        forward: i.forward,
        up: i.up,
      }),
      s = t.getPhysics().driveCameraRuntime();
    return {
      timeMs: e,
      x: i.position.x,
      y: Math.fround(-i.position.z),
      z: i.position.y,
      w: r.w,
      qx: r.x,
      qy: r.y,
      qz: r.z,
      status: GD(
        s.stateCode,
        t.getPhysics().driftVisualRuntime().active,
        s.action8,
      ),
    };
  }
  checkLowHeightReset(e) {
    const t = this.host,
      i = t.session.lifecycle;
    t.resourceVersion !== "p3553" ||
      i.phase !== Ne.Racing ||
      i.countdownSubstate !== 4 ||
      e >>> 0 < i.startAtMs >>> 0 ||
      !(t.getPhysics().body.position.y < -5) ||
      (t.getPhysics().prepareLowHeightResetPose(),
      t.session.coordinator?.synchronizePositionAnchor(),
      this.initiateSpeedReset(!1));
  }
  checkAutomaticReset(e) {
    const t = this.host,
      i = t.session.lifecycle;
    if (
      i.phase !== Ne.Racing ||
      i.countdownSubstate !== 4 ||
      e >>> 0 < i.startAtMs >>> 0
    )
      return;
    const r = t.getPhysics();
    if (r.consumeAutomaticResetRequest()) {
      this.initiateSpeedReset(!1);
      return;
    }
    if (!r.lowSpeedAutomaticResetActive(t.getDrivingSnapshot())) {
      this.lowSpeedResetStartedAtMs = 0;
      return;
    }
    const s = e >>> 0;
    (this.lowSpeedResetStartedAtMs === 0 && (this.lowSpeedResetStartedAtMs = s),
      this.lowSpeedResetStartedAtMs !== 0 &&
        (this.lowSpeedResetStartedAtMs + 2e3) >>> 0 < s &&
        ((this.lowSpeedResetStartedAtMs = 0), this.initiateSpeedReset(!1)));
  }
  initiateSpeedReset(e) {
    const t = this.host;
    if (Un(t.session.lifecycle)) return;
    const i = mL(t.session.speedResetState);
    i !== t.session.speedResetState &&
      t.getPhysics().beginResetInitiation(e) &&
      ((t.session.speedResetState = i), t.audio.kartAudio?.playReset());
  }
  handleRouteSurfaceTag(e, t) {
    (e === "warpnext:in:next" && Un(this.host.session.lifecycle)) ||
      super.handleRouteSurfaceTag(e, t);
  }
  advanceResetCompletion(e) {
    const t = this.host,
      i = wL(t.session.speedResetState, e);
    ((t.session.speedResetState = i.state),
      (t.kartView.root.visible = gL(t.session.speedResetState, e)));
    for (const r of i.actions)
      if (r === "complete-checkpoint-pose") {
        const s = t.getTrack().prepareCurrentSectionReset(t.getPhysics()),
          o = `${s.surface}:in:next`;
        if (s.surface && !t.getPhysics().canHandleRouteSurfaceTag(o))
          throw new Error(
            `reset surface event ${s.surface} 的 listener lifecycle 尚未闭合。`,
          );
        (t.getTrack().commitCurrentSectionReset(t.getPhysics()),
          t.getPhysics().completeCheckpointPose(s, !0),
          t.session.coordinator?.synchronizePositionAnchor(),
          s.surface.includes("rail") &&
            t.getPhysics().prepareRailCheckpointReentry(),
          s.surface && this.handleRouteSurfaceTag(o, s));
      } else
        r === "suspend-physics"
          ? t.getPhysics().setFullPhysicsBypass(!0)
          : r === "resume-physics"
            ? t.getPhysics().setFullPhysicsBypass(!1)
            : t.getPhysics().restoreResetInteraction();
  }
  warpToCheckpoint(e) {
    const t = this.host,
      i = t.getTrack(),
      r = t.getPhysics();
    i.warpRouteToSection(r, e);
    const s = i.prepareCurrentSectionReset(r),
      o = `${s.surface}:in:next`;
    if (s.surface && !r.canHandleRouteSurfaceTag(o))
      throw new Error(
        `reset surface event ${s.surface} 的 listener lifecycle 尚未闭合。`,
      );
    (i.commitCurrentSectionReset(r),
      r.completeCheckpointPose(s, !0),
      t.session.coordinator?.synchronizePositionAnchor(),
      this.handleRouteSurfaceTag(o, s));
  }
  warpToPoint(e) {
    const t = this.host;
    (t.getPhysics().warpPosition(e),
      t.session.coordinator?.synchronizePositionAnchor());
  }
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
  updateDriving(e) {
    const t = this.host,
      i = t.session.lifecycle.effectiveTime(e);
    (t.advanceResetCompletion(i),
      this.checkLowHeightReset(i),
      this.checkAutomaticReset(i));
    const r = t.getTrack().getRouteState(t.getPhysics()),
      s = t.session.lifecycle.tick({
        rawNowMs: e,
        routeProgress: r.lap,
        finishThreshold: t.getTrack().data.lapTarget ?? Number.MAX_SAFE_INTEGER,
        currentLap: r.lap,
        totalLaps: t.getTrack().data.lapTarget ?? Number.MAX_SAFE_INTEGER,
      });
    if ((t.handleTimeAttackActions(s, e), !t.shell.started)) return;
    if ((t.drainDrivingInput(i, e), !Jl0(t.session.lifecycle.phase))) {
      (t.getPhysics().synchronizeClock(i),
        t.getTrack().updateObstacles(i, t.getPhysics().body.position),
        t.getTrack().registerObstaclePair(t.getPhysics().body.position),
        t.getTrack().commitObstacleSnapshot(),
        t.updateActiveRaceCamera(i));
      return;
    }
    if (
      (t.getPhysics().consumeRailResetRequest() && this.initiateSpeedReset(!1),
      t.shell.halted)
    ) {
      t.getPhysics().synchronizeClock(i);
      return;
    }
    const o = t.getDrivingSnapshot();
    if (!t.session.coordinator)
      throw new Error("TimeAttack normal coordinator 尚未建立。");
    const { schedule: a, route: c } = t.session.coordinator.run(i, o);
    (t.updateTimeAttackRoute(e, r.lap, c.lap),
      t.session.lifecycle.phase >= Ne.Countdown &&
        t.session.lifecycle.phase <= Ne.FinishAccepted &&
        t.ghostRecorder?.update(i),
      t.getPhysics().consumeRailResetRequest() && this.initiateSpeedReset(!1),
      t.getPhysics().consumeSpeedSlotReordered() &&
        (this.ui?.gameplayUi?.startSlotReorder(),
        t.audio.interfaceAudio?.playSlotChanger()),
      t.getPhysics().updateModeInventory() &&
        (t.session.tachometer && eP(t.session.tachometer),
        this.ui?.gameplayUi?.startBoostGaugeFull()));
    const l = t.getPhysics().timeAttackTeamGaugeSettledAtMs();
    (l !== this.lastTeamGaugeSettledAtMs &&
      ((this.lastTeamGaugeSettledAtMs = l),
      l !== 0 && this.ui?.gameplayUi?.startTeamBoostGaugeFull()),
      Un(t.session.lifecycle) ||
        t.applyWarpNextActions(t.warpNext.tick(t.presentationClockMs)),
      t.warpNext.presentationVisible(t.presentationClockMs) ||
        (t.kartView.root.visible = !1),
      t.session.warpBlackBar?.setRatio(
        t.warpNext.blackBarRatio(t.presentationClockMs),
      ),
      t.session.warpCameraFrozen || t.updateActiveRaceCamera(a.nowMs));
  }
  updateTimeAttackRoute(e, t, i) {
    const r = this.host;
    if (i === t) return;
    const s = r.getTrack().data.lapTarget ?? Number.MAX_SAFE_INTEGER,
      o = r.session.lifecycle.tick({
        rawNowMs: e,
        routeProgress: i,
        finishThreshold: s,
        currentLap: i,
        totalLaps: s,
      });
    r.handleTimeAttackActions(o, e);
  }
  handleTimeAttackActions(e, t) {
    const i = this.host;
    for (const r of e) {
      if (r.kind === "schedule-start-effect") {
        this.action2D.scheduleStart(r.atMs);
        continue;
      }
      (r.kind === "countdown-number" &&
        r.value === 2 &&
        (i.session.flyingPet?.launch(),
        i.session.linkedCharacterPresentation?.setMode(4)),
        r.kind === "countdown-number" &&
          r.value === 1 &&
          i.session.raceAura?.requestDespawn?.(),
        !this.handleTimeAttackFinishAction(r, t) &&
          (i.handleTimeAttackActionAudio(r, t) ||
            (r.kind === "ready-camera"
              ? ((i.session.cameraMode = "ready"),
                (i.scene.visible = !0),
                i.session.readyCamera?.start(),
                i.input.setEnabled(!0))
              : r.kind === "switch-drive-camera"
                ? ((i.session.cameraMode = "drive"),
                  (i.scene.visible = !0),
                  i.driveCameraman.reset())
                : r.kind === "release-race" &&
                  (i.input.setEnabled(!0),
                  i.getPhysics().setRaceMotionLocked(!1)))));
    }
  }
  handleTimeAttackActionAudio(e, t) {
    const i = this.host;
    return e.kind === "countdown-number"
      ? (this.countdownAudio.playNumber(), !0)
      : e.kind === "countdown-go"
        ? (this.countdownAudio.playGo(), this.ui?.trackInfoCard?.slideOut(), !0)
        : e.kind === "lap"
          ? (this.countdownAudio.playLap(),
            this.action2D.showLap(
              e.value,
              i.session.lifecycle.effectiveTime(t),
            ),
            !0)
          : e.kind !== "final-lap"
            ? !1
            : (this.countdownAudio.playFinalLap(),
              this.action2D.showFinalLap(i.session.lifecycle.effectiveTime(t)),
              !0);
  }
  handleTimeAttackFinishAction(e, t) {
    const i = this.host;
    return e.kind === "finish"
      ? ((i.session.pendingCharacterFinishMotion =
          i.session.lifecycle.resultBeatTarget() ? 12 : 13),
        i.getPhysics().setRaceMotionLocked(!0),
        i.hud.finishPerformanceRace(),
        this.action2D.showFinish(i.session.lifecycle.effectiveTime(t)),
        i.session.lifecycle.acceptLocalCompletion(),
        !0)
      : e.kind === "switch-surround-camera"
        ? ((i.session.cameraMode = "surround"), i.surroundCameraman.reset(), !0)
        : e.kind === "play-result-bgm"
          ? (i.audio.bgm?.playResult(e.beatTarget), !0)
          : e.kind === "show-result"
            ? (this.showTimeAttackResult(e, t), !0)
            : e.kind !== "return-to-ready"
              ? !1
              : (i.returnToReady().catch((r) => {
                  i.hud.showDebugText(
                    `Ready stage fail-closed：${r instanceof Error ? r.message : String(r)}`,
                    "error",
                  );
                }),
                !0);
  }
  showTimeAttackResult(e, t) {
    const i = this.host,
      r = this.ui?.result;
    if (!r) throw new Error("TimeAttack result renderer 尚未建立。");
    const s = i.getPhysics().timeAttackResultCounts();
    (r.show({ elapsedMs: e.elapsedMs, bestMs: e.bestMs, ...s }),
      e.bestMs === e.elapsedMs &&
        this.action2D.showNewRecord(i.session.lifecycle.effectiveTime(t)),
      e.isNewRecord &&
        i.promoteTimeAttackRecord(e.elapsedMs, s).catch((o) => {
          i.hud.showDebugText(
            `TimeAttack record 保存失败：${o instanceof Error ? o.message : String(o)}`,
            "error",
          );
        }));
  }
  enter(e) {
    const t = e;
    ((this.timeAttackParam = t?.param),
      this.setInterface(t ? new uf0(t.owners) : void 0),
      this.restartRace());
  }
  disposeInterface() {
    this.ui?.dispose();
  }
  exit() {
    ((this.ghostRouteProgress = void 0),
      (this.ghostPoses = []),
      (this.ghostPoseBuffer = []),
      this.disposeInterface(),
      (this.timeAttackParam = void 0),
      this.setInterface(void 0));
  }
  createCoordinator(e, t, i) {
    return new yL(e, t, i, (r, s) => this.handleRouteSurfaceTag(r, s));
  }
  traceGround(e, t) {
    const i = this.host.getTrack().rayQuery(e, t, !1);
    return i ? { ...i.point } : void 0;
  }
  restartRace() {
    ((this.lowSpeedResetStartedAtMs = 0),
      (this.host.session.pendingCharacterFinishMotion = 0),
      this.host.touchControls.releaseAll(),
      (this.host.presentationClockMs = 0),
      this.host.shell.clearHalt(),
      (this.host.session.speedResetState = pr()),
      this.host.setPaused(!1),
      this.host.session.pause?.setVisible(!1),
      this.host.input.cancelAll(),
      this.host.drivingInput.cancel(),
      this.host.autoForward.cancel(),
      this.host.session.physics?.hardCancelControls(),
      this.host.session.coordinator?.dispose(),
      (this.host.session.coordinator = void 0),
      this.ui?.result?.hide(),
      this.ui?.gameplayUi?.reset(),
      this.ui?.action2D?.reset(),
      this.host.tachometerGaugePreserve.reset(),
      this.host.audio.kartAudio?.resetRace(),
      this.host.audio.countdownAudio?.reset(),
      this.host.session.kartDriftEffects?.reset(),
      this.host.session.kartMotionBlur?.reset(),
      this.host.session.zetAirEffect?.reset(),
      this.host.session.shockWaveEffect?.reset(),
      this.host.session.exhaustEffect?.reset(),
      this.host.session.crashEffect?.reset(),
      this.host.session.chargerEffect?.reset(),
      this.host.kartView.resetAnimation(),
      this.host.session.flyingPet?.reset(),
      this.host.session.characterRender?.reset(),
      this.host.session.linkedCharacterRender?.reset(),
      this.host.session.linkedCharacterPresentation?.resetForRacePresentation(),
      this.host.driveCameraman.reset(),
      this.host.surroundCameraman.reset(),
      (this.host.session.driveCameraState = void 0),
      (this.host.session.surroundCameraState = void 0),
      (this.host.session.cameraMode = "ready"),
      (this.host.session.warpCameraFrozen = !1),
      this.host.warpNext.reset());
    const e = this.host.session.track?.data.weather;
    if (
      (e?.rainEnabled && this.host.session.rain?.reset(e.rainOnStart),
      e?.snowEnabled && this.host.session.snow?.reset(),
      this.host.cameraShake.leave(!0),
      this.host.cameraWave.leave(),
      this.host.toonStageBinding.setLightFactor(1),
      (this.host.kartView.root.visible = !0),
      this.host.session.track?.resetRender(0, this.host.camera, H2, $2),
      (this.host.currentPlayerSlot = pf0(
        this.host.session.ghosts.map((s) => s.startSlot),
      )),
      this.placeAtStart(),
      !this.host.session.admission ||
        !this.host.session.track ||
        !this.host.session.physics ||
        !this.host.audio.kartAudio)
    )
      throw new Error("TimeAttack restart 缺少 P3528 runtime owners。 ");
    const t = new cf0(B6(this.host.session.track.data.trackId)),
      i = this.host.currentGhostEquipment();
    (i &&
      t.addParticipant({
        sample: (s) =>
          this.captureGhostRuntime(
            nG(s, this.host.session.lifecycle.startAtMs),
          ),
        equipment: i,
        startSlot: this.host.currentPlayerSlot,
      }),
      (this.host.ghostRecorder = t),
      (this.host.session.coordinator = this.createCoordinator(
        this.host.session.admission,
        this.host.session.track,
        this.host.session.physics,
      )),
      this.host.getPhysics().setRaceMotionLocked(!0),
      this.host.audio.bgm?.restart(),
      this.ui?.trackInfoCard?.setBgmName(
        this.host.audio.bgm?.currentRaceName ?? "",
      ),
      this.ui?.trackInfoCard?.setVisible(!0));
    const r = performance.now();
    ((this.host.previousRenderTime = r / 1e3),
      this.host.handleTimeAttackActions(this.host.session.lifecycle.reset(), r),
      this.host.hud.setPaused(!1));
  }
  placeAtStart() {
    const e = this.host.getTrack().getStart();
    this.host.getPhysics().resetFromRouteFrame(e);
    const t = this.host.getPhysics().body,
      i = iG(this.host.currentPlayerSlot);
    ((t.position = {
      x: Math.fround(Math.fround(t.right.x * i) + t.position.x),
      y: Math.fround(Math.fround(t.right.y * i) + t.position.y),
      z: Math.fround(Math.fround(t.right.z * i) + t.position.z),
    }),
      (t.position = this.snapStartToGround(t.position) ?? t.position),
      this.host.getTrack().resetRouteState(this.host.getPhysics(), t.position),
      this.host.session.coordinator?.synchronizePositionAnchor(),
      (this.host.getPhysics().state.trackProgress = this.host
        .getTrack()
        .getRouteState(this.host.getPhysics()).distance),
      this.seedGhostStart(e));
  }
  snapStartToGround(e) {
    const t = { x: e.x, y: Math.fround(e.y + 10), z: e.z };
    return this.traceGround(t, { x: 0, y: -100, z: 0 });
  }
  seedGhostStart(e) {
    if (
      ((this.ghostRouteProgress = new hf0(this.host.getTrack())),
      (this.ghostPoses = []),
      this.host.session.ghosts.length === 0)
    )
      return;
    const t = this.host.getPhysics().body;
    for (const i of this.host.session.ghosts) {
      const r = iG(i.startSlot);
      let s = {
        x: Math.fround(Math.fround(t.right.x * r) + e.position.x),
        y: Math.fround(Math.fround(t.right.y * r) + e.position.y),
        z: Math.fround(Math.fround(t.right.z * r) + e.position.z),
      };
      ((s = this.snapStartToGround(s) ?? s),
        i.view.seedStart(s, t.right, t.forward, t.up),
        this.ghostRouteProgress.seed(i, s));
    }
  }
  update(e) {
    const t = this.host,
      i = e.nowMs;
    this.milliseconds = i;
    const r = t.session.lifecycle.effectiveTime(i);
    ((this.effectiveNowMs = r), this.ui?.trackInfoCard?.update(r));
    const s = t.workProfiler
      ? (p) => t.workProfiler.mark(p, performance.now())
      : void 0;
    if (t.paused)
      (t.drainDrivingInput(r, i),
        t.getPhysics().synchronizeClock(r),
        t.getTrack().expireEventEffects(r),
        t.resourceVersion === "p3553" && t.clientFramerate.sample(r));
    else {
      if (
        ((t.presentationClockMs += t.frameTimeSeconds * 1e3),
        t.getTrack().updateMovingRoads(r),
        t.workProfiler?.mark("moving-roads", performance.now()),
        t.nitroSeamless.update(t.getPhysics(), r),
        this.updateDriving(i),
        t.resourceVersion === "p3553" && t.clientFramerate.sample(r),
        t.workProfiler?.mark("driving", performance.now()),
        !t.shell.started)
      ) {
        this.released = !0;
        return;
      }
      t.session.warpCameraFrozen && t.session.warpNextCamera(t.camera);
    }
    (t.touchControls.setAutoForwardActive(
      t.autoForward.isActive(t.drivingInput.snapshot()),
    ),
      t.lightFactor.update(),
      t.workProfiler?.mark("light", performance.now()));
    let o = t.kartView.update(
      t.getPhysics().state,
      Math.trunc(t.presentationClockMs) >>> 0,
      t.getPhysics().consumeKartAnimationInput(),
    );
    (o !== void 0 && t.getPhysics().setAnimationSlot(o), s?.("kt-player-anim"));
    let a = [];
    if (t.session.ghosts.length > 0 && t.session.lifecycle.startAtMs !== 0) {
      const p = nG(r, t.session.lifecycle.startAtMs),
        v = t.session.ghosts;
      this.ghostPoseBuffer.length !== v.length &&
        (this.ghostPoseBuffer = v.map(() => kL()));
      const w = this.ghostPoseBuffer;
      for (let g = 0; g < v.length; g += 1) {
        const y = v[g],
          b = y.playback.sample(p);
        (s?.("kt-ghost-sample"), y.view.update(b, r, t.camera, H2, $2, s));
        const A = LL("sample" in b ? b.sample : b, w[g]);
        (this.ghostRouteProgress.update(y, y.playback, p, A.position),
          (A.markerTint = t.session.rankColors[g + 1]));
      }
      a = w;
    }
    s?.("kt-ghost");
    const c = t.getPhysics().driveCameraRuntime();
    (t.session.balloonDecoration?.scene.update(r, t.camera, H2, $2),
      t.session.characterDecorations.forEach(({ kind: p, render: v }) => {
        (p === "headBand" && v.setOwnerState?.(c.stateCode, r),
          v.scene.update(r, t.camera, H2, $2));
      }),
      (this.ghostPoses = a),
      s?.("kt-decor"),
      MK(c.visualScaleMode),
      t.kartView.root.updateMatrixWorld(!0),
      t.session.toonEnvironment && t.toonStageBinding.beginFrame(i),
      s?.("kt-matrix"),
      t.session.vehicleRender?.update(t.camera, H2, $2),
      s?.("kt-player-render"),
      t.workProfiler?.mark("kart", performance.now()));
    const l = t.getPhysics().consumeTrackEventEffectRequests();
    if (l.length > 0 && !t.session.trackEventEffects)
      throw new Error("event effect request 缺少 kart presentation owner。");
    for (const p of l) t.session.trackEventEffects.trigger(p.effect, p.atMs);
    for (const p of t.getTrack().consumeExpiredEventEffects())
      t.session.trackEventEffects?.remove(p);
    (t.session.trackEventEffects?.update(r, t.camera, H2, $2),
      t.workProfiler?.mark("track-events", performance.now()));
    const u = t.paused
        ? void 0
        : t.resourceVersion === "p3553" &&
            !t.getPhysics().tuning.dualBoosterEnabled
          ? t.session.linkedCharacterPresentation?.updateSpeedRace(
              c.stateCode,
              r,
            )
          : t.session.linkedCharacterPresentation?.update(c.stateCode, r),
      h = c.motionMode;
    (t.session.kartMotionBlur?.setState(
      c.stateCode,
      t.getPhysics().displaySpeedKmh(),
      r,
      t.gameOptions.boostBlur,
    ),
      t.session.zetAirEffect?.update(
        r,
        t.getPhysics().displaySpeedKmh(),
        t.getPhysics().body.linearVelocity,
        t.camera,
        t.kartView.root.visible,
      ),
      t.session.shockWaveEffect?.update(
        r,
        t.getPhysics().consumeShockWaveRequest(),
        t.kartView.root.matrixWorld,
        t.camera,
        H2,
        $2,
      ),
      t.session.exhaustEffect?.update(
        r,
        t.getPhysics().displaySpeedKmh(),
        t.getPhysics().body.linearVelocity,
        t.camera,
        t.kartView.root.visible &&
          Tk(
            t.getPhysics().audioState(),
            t.getPhysics().dualBoosterState(),
            t.getPhysics().dualBoosterMode(),
            c.action8,
          ),
      ),
      t.session.crashEffect?.update(
        r,
        t.getPhysics().consumeCrashEffectRequest(),
        t.kartView.root.matrixWorld,
        t.camera,
        H2,
        $2,
      ));
    const d = t.getPhysics().timeAttackTachometerCharger();
    (t.session.chargerEffect?.update(
      r,
      d.active,
      d.durationMs,
      t.camera,
      H2,
      $2,
    ),
      t.session.particleModification?.update(
        r,
        Pt0(
          r,
          t.session.lifecycle.startAtMs,
          t.session.lifecycle.phase === Ne.Countdown,
        ),
        t.camera,
        H2,
        $2,
      ),
      t.session.particleModificationBanner?.update(
        r,
        t.session.lifecycle.startAtMs,
        t.session.lifecycle.phase === Ne.Countdown,
        t.session.particleModificationBannerRequest,
      ),
      t.session.simpleShadow?.update(
        t.getTrack(),
        (t.session.linkedCharacterPresentation?.simpleShadowEnabled() ?? !0) &&
          t.kartView.root.visible &&
          h !== 2 &&
          h !== 3,
      ),
      t.session.kartDriftEffects?.update(
        r,
        t.getPhysics().driftVisualRuntime(),
        t.getTrack(),
        t.kartView.root.visible,
      ));
    const f = t.session.pendingCharacterFinishMotion;
    (t.paused || (t.session.pendingCharacterFinishMotion = 0),
      t.session.characterRender?.update(
        t.session.lifecycle.effectiveTime(i),
        t.camera,
        H2,
        $2,
        t.paused
          ? void 0
          : {
              forwardSpeed: t.getPhysics().state.forwardSpeed,
              rawSteer: t.drivingInput.snapshot().rawSteer,
              tireTransient: c.tireTransient,
              boosterState: c.stateCode,
              instantAccelerationActive: c.action8,
              motorcycle: c.motorcycleType,
              landingTrigger: c.landingMotionTrigger,
              collisionHit: c.collisionMotionHit,
              collisionStrength: c.collisionMotionStrength,
              visualScaleMode: c.visualScaleMode,
              finishMotion: f,
            },
      ),
      t.session.flyingPet?.update(
        r,
        t.camera,
        H2,
        $2,
        t.gameOptions.inGameFlyingPetVisible,
      ),
      t.session.linkedCharacterRender?.update(
        t.session.lifecycle.effectiveTime(i),
        t.camera,
        H2,
        $2,
        t.paused
          ? void 0
          : {
              forwardSpeed: t.getPhysics().state.forwardSpeed,
              rawSteer: t.drivingInput.snapshot().rawSteer,
              tireTransient: c.tireTransient,
              boosterState: c.stateCode,
              instantAccelerationActive: c.action8,
              motorcycle: c.motorcycleType,
              landingTrigger: c.landingMotionTrigger,
              collisionHit: c.collisionMotionHit,
              collisionStrength: c.collisionMotionStrength,
              visualScaleMode: c.visualScaleMode,
              finishMotion: f,
              linkedPresentationMotion: u,
            },
      ),
      t.workProfiler?.mark("character", performance.now()),
      (o = t.updateKartBoosterState(r, c.action8, o)),
      t.session.kartEffects?.update(
        t.session.lifecycle.effectiveTime(i),
        t.camera,
        H2,
        $2,
      ),
      t.session.kartTrails?.setState(
        t.getPhysics().audioState(),
        t.session.lifecycle.effectiveTime(i),
      ),
      t.session.kartTrails?.update(
        t.session.lifecycle.effectiveTime(i),
        t.camera,
        t.session.vehicleRender !== void 0,
      ),
      t.session.lampFlares?.update(
        t.session.lifecycle.effectiveTime(i),
        t.camera,
        t.session.vehicleRender !== void 0,
      ),
      t.workProfiler?.mark("kart-effects", performance.now()),
      t.paused ||
        (t.audio.kartAudio?.update(
          t.session.lifecycle.effectiveTime(i),
          Math.hypot(
            t.getPhysics().state.vx,
            t.getPhysics().state.vy,
            t.getPhysics().state.vz,
          ),
        ),
        t.audio.kartAudio?.playCollision(
          t.getPhysics().consumeCollisionAudioStrength(),
          t.session.lifecycle.effectiveTime(i),
        ),
        t.audio.kartAudio?.playSteeringCollision(
          t.getPhysics().consumeSteeringCollisionAudioGain(),
        ),
        t.audio.kartAudio?.playLandingShock(
          c.landingMotionTrigger,
          c.landingShockAudioStrength,
        ),
        t.audio.kartAudio?.setState(
          t.getPhysics().audioState(),
          t.getPhysics().dualBoosterState(),
        ),
        t.audio.kartAudio?.setChargerActive(d.active),
        t.audio.kartAudio?.setExceedActive(c.action8),
        t.audio.kartAudio?.setTransformingState(o),
        t.audio.kartAudio?.setDriftActive(t.getPhysics().state.drifting),
        t.audio.kartAudio?.updateRoad(
          t.getPhysics().wheels.roadDescriptor
            ? TW(t.getPhysics().wheels.roadDescriptor)
            : void 0,
          Math.hypot(
            t.getPhysics().state.vx,
            t.getPhysics().state.vy,
            t.getPhysics().state.vz,
          ),
          t.frameTimeSeconds,
        )),
      t.workProfiler?.mark("kart-audio", performance.now()),
      t
        .getTrack()
        .updateRender(t.session.lifecycle.effectiveTime(i), t.camera, H2, $2),
      t.updateDevToolsTrackObjects(
        t.session.lifecycle.effectiveTime(i),
        H2,
        $2,
      ),
      t.workProfiler?.mark("track-render", performance.now()),
      t.session.trackEventAudio?.update(r, t.getPhysics().body.position),
      t.session.trackDummyAudio?.update(t.camera),
      t.session.rain?.update(t.presentationClockMs, t.camera, H2, $2),
      t.session.snow?.update(t.presentationClockMs, t.camera, H2, $2),
      t.workProfiler?.mark("weather", performance.now()),
      t.updateHud(),
      t.workProfiler?.mark("hud", performance.now()));
  }
  render() {
    if (this.released) return;
    const e = this.host,
      t = this.milliseconds,
      i = this.effectiveNowMs,
      r = this.ghostPoses,
      s = e.workProfiler
        ? (o) => e.workProfiler.mark(o, performance.now())
        : void 0;
    gf0(
      e.renderer,
      () => {
        e.renderer.getDrawingBufferSize(e.drawingBufferSize);
        const o = !Un(e.session.lifecycle) && !e.session.warpHud?.hidden;
        (this.renderGameplayUi(i, r),
          e.workProfiler?.mark("ui", performance.now()));
        const a = e.getPhysics().consumeTimeAttackTachometerGaugePreserve(),
          c = Math.trunc(t) >>> 0,
          l = e.tachometerGaugePreserve.update(i, a);
        if (e.session.tachometer) {
          const u = e.getPhysics().consumeTimeAttackTachometerNormalBooster();
          (QL(
            e.session.tachometer,
            e.getPhysics(),
            e.session.lifecycle.effectiveTime(t),
            e.session.lifecycle.effectiveTime(c),
            c,
            e.session.lifecycle.pausedTotalMs,
            l,
            u,
          ),
            e.workProfiler?.mark("tacho-update", performance.now()),
            o && JL(e.session.tachometer, e.renderer),
            e.workProfiler?.mark("tacho-render", performance.now()));
        }
        (this.ui?.result?.render(e.renderer, H2, $2),
          this.ui?.action2D?.render(e.renderer, i, H2, $2),
          e.workProfiler?.mark("ui-action2d", performance.now()));
      },
      () => {
        (e.session.outlineBatch?.flush(),
          e4(e.scene, e.camera, !1, s),
          e.workProfiler?.mark("rw-keys", performance.now()),
          yo(e.renderer, () => e.renderer.render(e.scene, e.camera)),
          e.workProfiler?.mark("rw-render", performance.now()),
          e.workProfiler?.mark("render-world", performance.now()));
      },
      e.getTrack().skydome
        ? () => {
            (e4(e.getTrack().skydome, e.camera),
              yo(e.renderer, () =>
                e.renderer.render(e.getTrack().skydome, e.camera),
              ),
              e.workProfiler?.mark("render-skydome", performance.now()));
          }
        : void 0,
      () => {
        (e.session.kartMotionBlur?.render(e.renderer, i),
          e.workProfiler?.mark("render-post", performance.now()));
      },
    );
  }
  renderGameplayUi(e, t) {
    const i = this.host,
      r = this.interface?.gameplayUi;
    if (!r) return;
    const s = i.getTrack().data.lapTarget;
    if (s === void 0)
      throw new Error("TimeAttack gameplay UI 缺少 lapTarget。 ");
    const o = i.getPhysics().timeAttackTachometerGauges();
    (r.update(
      {
        body: i.getPhysics().body,
        currentLap: i.getTrack().getRouteState(i.getPhysics()).lap,
        totalLaps: s,
        elapsedMs: ff0(i.session.lifecycle, e),
        bestMs: i.session.lifecycle.bestLapMs,
        speedSlots: i.getPhysics().timeAttackSpeedSlots(),
        speedSlotDisabled: i.getPhysics().timeAttackSpeedSlotDisabled(),
        speedSlotWindowStartMs: i
          .getPhysics()
          .timeAttackSpeedSlotWindowStartMs(),
        boostRatio: o.mainRatio,
        teamBoostRatio: o.teamRatio,
        teamBooster: o.teamBooster,
        rank: this.rankBoardValues(),
        ghosts: t,
      },
      e,
      H2,
      $2,
    ),
      !Un(i.session.lifecycle) &&
        !i.session.warpHud?.hidden &&
        r.render(i.renderer, H2, $2));
  }
  rankBoardValues() {
    const e = this.host,
      t = [
        {
          id: "player",
          name: "",
          lap: 0,
          progress: e.getTrack().getRouteState(e.getPhysics()).distance,
        },
        ...e.session.ghosts.map((o, a) => ({
          id: `ghost${a}`,
          name: "",
          lap: 0,
          progress: this.ghostRouteProgress.distance(o),
        })),
      ],
      i = XL(t),
      r = i.find((o) => o.id === "player");
    if (!r) throw new Error("TimeAttack rank board 缺少本地玩家。");
    const s = e.session.rankColors ?? [];
    return {
      rank: r.rank,
      riderCount: t.length,
      rows: i.map((o) => ({
        participantId: o.id,
        slot: o.id === "player" ? 0 : Number(o.id.slice(5)) + 1,
        rank: o.rank,
        local: o.id === "player",
        name:
          o.id === "player"
            ? e.session.localName || "自己"
            : (e.session.ghosts[Number(o.id.slice(5))]?.name ?? ""),
        color: s[o.id === "player" ? 0 : Number(o.id.slice(5)) + 1],
      })),
    };
  }
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
class wf0 {
  factories = new Map();
  current;
  pending;
  register(e, t) {
    if (this.factories.has(e))
      throw new Error(`StageManager 重复注册 stage：${e}。`);
    this.factories.set(e, t);
  }
  isRegistered(e) {
    return this.factories.has(e);
  }
  changeStage(e, t) {
    return this.factories.has(e)
      ? ((this.pending = { name: e, param: t }), !0)
      : !1;
  }
  enter() {
    const e = this.pending;
    if (!e) return;
    ((this.pending = void 0), this.current?.stage.exit());
    const t = this.factories.get(e.name)();
    ((this.current = { name: e.name, stage: t }), t.enter(e.param));
  }
  update(e) {
    this.current?.stage.update(e);
  }
  render() {
    this.current?.stage.render();
  }
  onPacket(e) {
    this.current?.stage.onPacket(e);
  }
  get currentName() {
    return this.current?.name;
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
  frame(e) {
    const t = performance.now();
    if (
      (typeof e == "number" &&
        (this.maxRafDelayMs = Math.max(this.maxRafDelayMs, Math.max(0, t - e))),
      Math.trunc(t) >>> 0 === this.lastUpdateMs)
    ) {
      this.animationFrame = requestAnimationFrame(this.frame);
      return;
    }
    ((this.lastUpdateMs = Math.trunc(performance.now()) >>> 0),
      this.updateAndRender(t));
  }
  updateAndRender(e) {
    this.host.workProfiler?.begin(e);
    const t = Math.trunc(performance.now()) >>> 0;
    this.host.renderer.info.reset();
    let i = 0;
    try {
      const r = t / 1e3,
        s = Math.max(0, r - this.previousRenderTime);
      ((i = s * 1e3),
        (this.previousRenderTime = r),
        (this.frameTimeSeconds = s),
        this.host.touchControls.setRaceState(
          this.multiplayerStage
            ? this.host.input.isEnabled &&
                this.multiplayerStage.touchDrivingAvailable
            : this.host.shell.started &&
                this.host.input.isEnabled &&
                !Un(this.host.session.lifecycle),
          !this.multiplayerStage && this.host.paused,
          this.multiplayerStage?.touchDodgeEnabled ?? !1,
        ),
        this.host.ready.updateWindowNotice(t),
        (this.fps +=
          (1 / Math.max(s, 0.001) - this.fps) * (1 - Math.exp(-3 * s))),
        this.host.workProfiler?.mark("prep", performance.now()),
        this.stages.enter());
      const o = { nowMs: t, rawMs: t };
      if (
        (this.stages.update(o),
        this.stages.render(),
        this.host.hud.updateEngine(this.fps),
        this.nextFrameCallbacks.length)
      )
        for (const a of this.nextFrameCallbacks.splice(0)) a.run();
    } catch (r) {
      for (const s of this.nextFrameCallbacks.splice(0)) s.reject(r);
      this.host.haltRuntime(r, t);
    } finally {
      (this.host.workProfiler?.mark("tail", performance.now()),
        this.host.workProfiler?.end(performance.now()));
      const r = this.host.renderer.info;
      ((this.host.engineRenderStats.calls = r.render.calls),
        (this.host.engineRenderStats.triangles = r.render.triangles),
        (this.host.engineRenderStats.lines = r.render.lines),
        (this.host.engineRenderStats.points = r.render.points),
        (this.host.engineRenderStats.frame = r.render.frame),
        this.host.hud.recordPerformanceFrame(
          i,
          performance.now() - e,
          e,
          this.host.workProfiler?.summary(),
        ),
        (this.animationFrame = requestAnimationFrame(this.frame)));
    }
  }
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
  releaseRaceForReady() {
    const e = !!this.host.session.track;
    (Pp(!0),
      this.host.hud.finishPerformanceRace(),
      this.host.shell.enterReady(),
      this.host.shell.clearHalt(),
      this.host.setPaused(!1),
      (this.host.session.speedResetState = pr()),
      this.host.input.setEnabled(!1),
      this.host.drivingInput.cancel(),
      this.host.autoForward.cancel(),
      this.host.session.physics?.hardCancelControls(),
      this.host.session.coordinator?.dispose(),
      (this.host.session.coordinator = void 0));
    for (const t of this.host.session.ghosts) t.view.dispose();
    ((this.host.session.ghosts = []),
      this.host.session.outlineBatch?.dispose(),
      (this.host.session.outlineBatch = void 0),
      (this.host.ghostRecorder = void 0),
      (this.host.currentPlayerSlot = 0),
      this.host.session.vehicleRender?.dispose(),
      (this.host.session.vehicleRender = void 0),
      this.host.session.flyingPet?.dispose(),
      (this.host.session.flyingPet = void 0),
      this.host.session.characterRender?.dispose(),
      (this.host.session.characterRender = void 0),
      (this.host.session.pendingCharacterFinishMotion = 0),
      this.host.session.linkedCharacterRender?.dispose(),
      (this.host.session.linkedCharacterRender = void 0),
      (this.host.session.linkedCharacterPresentation = void 0),
      this.host.session.kartEffects?.dispose(),
      (this.host.session.kartEffects = void 0),
      this.host.session.balloonDecoration?.dispose(),
      (this.host.session.balloonDecoration = void 0),
      this.host.session.characterDecorations.forEach(({ render: t }) =>
        t.dispose(),
      ),
      (this.host.session.characterDecorations = []),
      (this.host.session.raceAura = void 0),
      this.host.session.kartTrails?.dispose(),
      (this.host.session.kartTrails = void 0),
      this.host.session.kartDriftEffects?.dispose(),
      (this.host.session.kartDriftEffects = void 0),
      this.host.session.kartMotionBlur?.dispose(),
      (this.host.session.kartMotionBlur = void 0),
      this.host.session.zetAirEffect?.dispose(),
      (this.host.session.zetAirEffect = void 0),
      this.host.session.shockWaveEffect?.dispose(),
      (this.host.session.shockWaveEffect = void 0),
      this.host.session.exhaustEffect?.dispose(),
      (this.host.session.exhaustEffect = void 0),
      this.host.session.crashEffect?.dispose(),
      (this.host.session.crashEffect = void 0),
      this.host.session.chargerEffect?.dispose(),
      (this.host.session.chargerEffect = void 0),
      this.host.session.particleModification?.dispose(),
      (this.host.session.particleModification = void 0),
      this.host.session.particleModificationBanner?.dispose(),
      (this.host.session.particleModificationBanner = void 0),
      (this.host.session.particleModificationBannerRequest = void 0),
      this.host.session.trackEventEffects?.dispose(),
      (this.host.session.trackEventEffects = void 0),
      this.host.session.trackEventAudio?.dispose(),
      (this.host.session.trackEventAudio = void 0),
      this.host.session.trackDummyAudio?.dispose(),
      (this.host.session.trackDummyAudio = void 0),
      this.host.session.lampFlares?.dispose(),
      (this.host.session.lampFlares = void 0),
      this.host.session.simpleShadow?.dispose(),
      (this.host.session.simpleShadow = void 0),
      this.host.session.tachometer?.dispose(),
      (this.host.session.tachometer = void 0),
      this.disposeRaceInterface(),
      this.host.session.pause?.dispose(),
      (this.host.session.pause = void 0),
      this.host.session.rain?.dispose(),
      (this.host.session.rain = void 0),
      this.host.session.rainAudio?.dispose(),
      (this.host.session.rainAudio = void 0),
      this.host.session.snow?.dispose(),
      (this.host.session.snow = void 0),
      this.host.audio.countdownAudio?.dispose(),
      (this.host.audio.countdownAudio = void 0),
      this.host.audio.kartAudio?.dispose(!1),
      (this.host.audio.kartAudio = void 0),
      this.host.session.toonEnvironment &&
        this.host.toonStageBinding.retain(this.host.session.toonEnvironment),
      this.host.session.toonEnvironment?.dispose(),
      (this.host.session.toonEnvironment = void 0),
      this.host.session.track?.group.removeFromParent(),
      this.host.session.track?.dispose(),
      (this.host.session.track = void 0),
      (this.host.session.trackMetadata = void 0),
      this.host.kartView.clearModel(),
      (this.host.session.physics = void 0),
      (this.host.session.admission = void 0),
      e && this.host.toonStageBinding.prepareCoatingStage().commit(),
      this.host.toonStageBinding.setLightFactor(1),
      (this.host.session.readyCamera = void 0),
      (this.host.session.warpNextCamera = void 0),
      (this.host.scene.visible = !1),
      this.host.hud.setPaused(!1),
      (this.previousRenderTime = performance.now() / 1e3),
      this.changeStage("TimeAttackReadyStage"));
  }
  replaceTrack(e) {
    (this.host.session.track?.group.removeFromParent(),
      this.host.session.track?.dispose(),
      (this.host.session.track = e),
      this.host.scene.add(this.host.session.track.group),
      kv(this.host.scene, e));
  }
  applyRaceOptions(e) {
    if (
      (Pp(this.host.gameOptions.toonLine),
      this.host
        .getPhysics()
        .setDualBoostAuto(this.host.gameOptions.dualBoostAuto, e),
      this.host.session.tachometer instanceof Gr)
    ) {
      let t = !this.host.gameOptions.dualBoostAuto;
      ((e === 1096 || e === 1106) && (t = !1),
        e === 1097 && (t = !0),
        this.host.session.tachometer.setManualBoostAlarm(t));
    }
  }
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
async function Af0(n, e, t) {
  const {
      audioContext: i,
      loadedBgm: r,
      loadedMap: s,
      loadedVehicle: o,
      loadedCharacters: a,
      nextPhysics: c,
      nextTrack: l,
      nextRain: u,
      nextRainAudio: h,
      nextSnow: d,
      nextGameplayUi: f,
      nextAction2D: p,
      nextResult: v,
      nextTrackInfoCard: w,
      nextPause: g,
      nextCountdownAudio: y,
      nextTrackEventEffects: b,
      nextTrackEventAudio: A,
      nextTrackDummyAudio: x,
      nextLinkedCharacterPresentation: M,
      nextFlyingPet: E,
      nextGhosts: _,
      rankColors: C,
      selectedVehicle: S,
      particleModificationBanner: G,
      particleModificationBannerRequest: I,
      outlineBatch: L,
    } = await n.getRaceBuilder().build(e, n.getReadyOptions(), t),
    k = n.session,
    D = n.audio;
  (k.coordinator?.dispose(),
    k.flyingPet?.dispose(),
    (k.flyingPet = void 0),
    k.vehicleRender?.dispose(),
    k.characterRender?.dispose(),
    k.linkedCharacterRender?.dispose(),
    k.outlineBatch?.dispose(),
    (k.outlineBatch = void 0),
    k.kartEffects?.dispose());
  for (const K of k.ghosts) K.view.dispose();
  ((k.ghosts = []),
    k.balloonDecoration?.dispose(),
    k.characterDecorations.forEach(({ render: K }) => K.dispose()),
    (k.characterDecorations = []),
    (k.raceAura = void 0),
    k.kartTrails?.dispose(),
    k.kartDriftEffects?.dispose(),
    k.kartMotionBlur?.dispose(),
    k.zetAirEffect?.dispose(),
    k.shockWaveEffect?.dispose(),
    k.exhaustEffect?.dispose(),
    k.crashEffect?.dispose(),
    k.chargerEffect?.dispose(),
    k.particleModification?.dispose(),
    k.particleModificationBanner?.dispose(),
    (k.particleModificationBanner = void 0),
    (k.particleModificationBannerRequest = void 0),
    k.trackEventEffects?.dispose(),
    k.trackEventAudio?.dispose(),
    k.trackDummyAudio?.dispose(),
    k.lampFlares?.dispose(),
    k.simpleShadow?.dispose(),
    k.tachometer?.dispose(),
    n.presenter.disposeRaceInterface(),
    k.pause?.dispose(),
    k.rain?.dispose(),
    k.rainAudio?.dispose(),
    k.snow?.dispose(),
    D.bgm !== r && D.bgm?.dispose(),
    D.countdownAudio?.dispose(),
    D.kartAudio?.dispose(!1),
    k.toonEnvironment && n.toonStageBinding.retain(k.toonEnvironment),
    k.toonEnvironment?.dispose());
  const V = D.context;
  (V && V !== i && V.state !== "closed" && V.close(),
    n.cameras.beginNewStage(),
    n.replaceTrack(l),
    (k.toonEnvironment = s.environment),
    (k.trackMetadata = s.metadata),
    (k.vehicleRender = o.imported.renderScene),
    (k.flyingPet = E),
    (k.characterRender = a.ordinary?.scene),
    (k.linkedCharacterRender = a.linked?.scene),
    (k.linkedCharacterPresentation = M),
    (k.readyCamera = s.readyCamera),
    (k.warpNextCamera = s.warpNextCamera),
    (k.kartEffects = o.effects),
    (k.balloonDecoration = o.decoration),
    (k.characterDecorations = o.accessories),
    (k.raceAura = o.accessories.find(({ kind: K }) => K === "aura")?.render),
    (k.kartTrails = o.trails),
    (k.kartDriftEffects = o.driftEffects),
    (k.kartMotionBlur = o.motionBlur),
    (k.zetAirEffect = o.zetAirEffect),
    (k.shockWaveEffect = o.shockWaveEffect),
    (k.exhaustEffect = o.exhaustEffect),
    (k.crashEffect = o.crashEffect),
    (k.chargerEffect = o.chargerEffect),
    (k.particleModification = o.particleModification),
    (k.particleModificationBanner = G),
    (k.particleModificationBannerRequest = I),
    (k.trackEventEffects = b),
    (k.trackEventAudio = A),
    (k.trackDummyAudio = x),
    (k.lampFlares = o.lampFlares),
    (k.simpleShadow = o.simpleShadow),
    (k.tachometer = o.tachometerRenderer),
    n.tachometerGaugePreserve.configure(o.tachometerSelection.folder),
    (k.pause = g),
    (k.rain = u),
    (k.rainAudio = h),
    (k.snow = d),
    (D.bgm = r),
    (D.bgmTrackId = s.metadata.id),
    (D.context = i),
    (D.countdownAudio = y),
    (k.admission = s.admission),
    k.rain && n.scene.add(k.rain.object),
    k.snow && n.scene.add(k.snow.object),
    n.scene.add(k.kartTrails.object),
    n.scene.add(k.kartDriftEffects.object),
    n.scene.add(k.zetAirEffect.object),
    n.scene.add(k.shockWaveEffect.object),
    n.scene.add(k.exhaustEffect.object),
    n.scene.add(k.crashEffect.object),
    n.scene.add(k.simpleShadow.object),
    (k.ghosts = [..._]),
    (k.rankColors = C),
    (k.localName = n.getLocalNickname()),
    (k.outlineBatch = L));
  for (const K of k.ghosts) K.view.attachToScene(n.scene);
  ((D.kartAudio = o.audio),
    (k.physics = c),
    (k.selection = { ...e }),
    (k.vehicleTitle = S.title),
    (k.lifecycle = new GF(
      n.library.record(Pt.recordKey(e, n.getReadyOptions()))?.elapsedMs ?? null,
    )),
    t?.validate(),
    n.ready.releaseForRace(),
    t?.commit(),
    n.shell.enterRace(),
    n.applyRaceOptions(o.kartItem.itemId),
    n.setPaused(!1),
    n.input.setEnabled(!1),
    n.hud.setPaused(!1),
    D.kartAudio.start(),
    n.presenter.changeStage("TimeAttackStage", {
      param: yf0(n.getReadyOptions()),
      owners: { gameplayUi: f, action2D: p, result: v, trackInfoCard: w },
    }));
}
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
