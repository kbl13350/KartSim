import { actionBindings, DEFAULT_KEY_MAP, keyboardActionsForCode } from "./action-bindings";
import type { KeyMap } from "./action-bindings";
import { DrivingAction } from "./driving-input";
import type { NitroSeamlessMode } from "./nitro-seamless";
import { TouchLayoutEditor } from "./touch-layout-editor";

const AUTO_FORWARD_KEY = "kartsim.auto-forward";
const NITRO_SEAMLESS_KEY = "kartsim.nitro-seamless";
const nitroModeNames: Record<NitroSeamlessMode, string> = {
  auto: "自动", manual: "手动", off: "关",
};
const nitroModes: NitroSeamlessMode[] = ["auto", "manual", "off"];

function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

const icons = {
  arrow: icon('<path d="M12 20V4m-7 7 7-7 7 7"/>'),
  drift: icon('<g transform="rotate(-18 12 10)"><path d="m6 10 2-6h8l2 6M5 10h14v6H5Zm2 6v2m10-2v2M8 13h1m6 0h1"/></g><path d="M6 20c-3 1 2 1 0 3m7-4c-3 1 2 2 0 3"/>'),
  booster: icon('<path d="M13 2c1 6-5 7-3 12 2-1 3-3 3-5 4 3 6 6 5 9a7 7 0 0 1-13-1c-1-5 3-7 3-10 1 1 1 2 1 3 3-2 4-5 4-8Z"/>'),
  overload: icon('<path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/>'),
  pause: icon('<path d="M8 5v14M16 5v14"/>'),
  reset: icon('<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>'),
};

const markup = `
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
          <button type="button" data-drive="pause" data-action-name="暂停">${icons.pause}</button>
          <button type="button" data-drive="${DrivingAction.Reset}" data-action-name="复位">${icons.reset}</button>
        </div>
        <div class="touch-modifiers" role="group" aria-label="漂移、氮气和超负荷">
          <button type="button" data-drive="${DrivingAction.Drift}" data-action-name="漂移">${icons.drift}</button>
          <button type="button" data-drive="${DrivingAction.UseItemOrBooster}" data-action-name="氮气">${icons.booster}</button>
          <button type="button" data-drive="${DrivingAction.GaugeState}" data-action-name="释放超负荷" class="touch-overload">${icons.overload}</button>
        </div>
        <div class="touch-arrows" role="group" aria-label="方向键">
          <button type="button" data-drive="${DrivingAction.Forward}" data-action-name="前进" class="touch-up">${icons.arrow}<span class="touch-auto-forward" aria-hidden="true">AUTO</span></button>
          <button type="button" data-drive="${DrivingAction.SteerLeft}" data-action-name="左转" class="touch-left">${icons.arrow}<span class="touch-dodge-key" aria-hidden="true" hidden>Z</span></button>
          <button type="button" data-drive="${DrivingAction.Reverse}" data-action-name="后退" class="touch-down">${icons.arrow}</button>
          <button type="button" data-drive="${DrivingAction.SteerRight}" data-action-name="右转" class="touch-right">${icons.arrow}<span class="touch-dodge-key" aria-hidden="true" hidden>X</span></button>
        </div>
      </div>`;

export interface TouchDrivingControlsOptions {
  keyLabel(scanCode: number | undefined): string;
}

export function savedAutoForward(): boolean {
  try { return localStorage.getItem(AUTO_FORWARD_KEY) === "true"; }
  catch { return false; }
}

export function savedNitroSeamlessMode(): NitroSeamlessMode {
  try {
    const value = localStorage.getItem(NITRO_SEAMLESS_KEY);
    return value === "auto" || value === "manual" || value === "off" ? value : "off";
  } catch { return "off"; }
}

type ButtonAction = number | "pause";

/** Touch gamepad, menu, accessibility labels, and auto forward arbitration. */
export class TouchDrivingControls {
  readonly element = document.createElement("section");
  readonly buttons = new Map<ButtonAction, HTMLButtonElement>();
  readonly pointers = new Map<number, ButtonAction>();
  readonly touchPointers = new Set<number>();
  readonly listeners = new AbortController();
  readonly coarsePointer = window.matchMedia("(pointer: coarse)");
  readonly menuButton: HTMLButtonElement;
  readonly menu: HTMLDialogElement;
  readonly toggle: HTMLButtonElement;
  readonly autoForwardToggle: HTMLButtonElement;
  readonly autoForwardMessage: HTMLElement;
  readonly nitroSeamlessToggle: HTMLButtonElement;
  readonly nitroSeamlessMessage: HTMLElement;
  readonly pause: HTMLButtonElement;
  readonly screen: HTMLButtonElement;
  readonly screenHelp: HTMLElement;
  readonly screenMessage: HTMLElement;
  readonly pad: HTMLElement;
  readonly layout: TouchLayoutEditor;
  readonly ghostMenuSlot: HTMLElement;
  touchCapable = navigator.maxTouchPoints > 0;
  usingTouch = this.touchCapable && this.coarsePointer.matches;
  usingGamepad = false;
  manualVisible: boolean | undefined;
  available = false;
  paused = false;
  lteDodge = false;
  autoForward = savedAutoForward();
  nitroSeamless = savedNitroSeamlessMode();
  autoForwardAllowed = false;
  autoForwardSuspended = document.hidden;
  keyMap: KeyMap = DEFAULT_KEY_MAP;

  constructor(
    readonly root: HTMLElement,
    readonly onAction: (action: number, down: boolean) => void,
    readonly onPause: () => void,
    readonly onAutoForwardChange: (allowed: boolean) => void = () => {},
    readonly onNitroSeamlessChange: (mode: NitroSeamlessMode) => void = () => {},
    readonly options: TouchDrivingControlsOptions = { keyLabel: () => "" },
  ) {
    this.element.className = "touch-controls";
    this.element.dataset.uiLayer = "controls";
    this.element.setAttribute("aria-label", "触屏驾驶");
    this.element.innerHTML = markup;
    this.menuButton = this.element.querySelector("[data-touch='menu']")!;
    this.menu = this.element.querySelector(".touch-menu")!;
    this.toggle = this.element.querySelector("[data-touch='toggle']")!;
    this.autoForwardToggle = this.element.querySelector("[data-touch='auto-forward']")!;
    this.autoForwardMessage = this.element.querySelector(".touch-auto-forward-status")!;
    this.nitroSeamlessToggle = this.element.querySelector("[data-touch='nitro-seamless']")!;
    this.nitroSeamlessMessage = this.element.querySelector("[data-touch='nitro-seamless-status']")!;
    this.pause = this.element.querySelector("[data-touch='pause']")!;
    this.screen = this.element.querySelector("[data-touch='screen']")!;
    this.screenHelp = this.element.querySelector(".touch-screen-help")!;
    this.screenMessage = this.screenHelp.querySelector("p")!;
    this.pad = this.element.querySelector(".touch-pad")!;
    this.ghostMenuSlot = this.element.querySelector("[data-touch='ghost-slot']")!;
    this.element.querySelectorAll<HTMLButtonElement>("[data-drive]")
      .forEach(button => this.bindButton(button));
    this.setKeyMap(this.keyMap);
    this.menuButton.dataset.actionName = "SIM 菜单";
    const layoutButtons = new Map<ButtonAction | "menu", HTMLButtonElement>(this.buttons);
    layoutButtons.set("menu", this.menuButton);
    this.layout = new TouchLayoutEditor(this.menu, this.pad, layoutButtons,
      () => this.refresh());
    const events = { signal: this.listeners.signal };
    this.menuButton.addEventListener("click", () => {
      if (!this.layout.isEditing) {
        this.menu.showModal();
        this.refresh();
      }
    }, events);
    this.menu.addEventListener("close", () => {
      this.layout.cancel();
      this.screenHelp.hidden = true;
      this.refresh();
    }, events);
    this.menu.addEventListener("keydown", event => event.stopPropagation(), events);
    this.element.querySelector<HTMLButtonElement>("[data-touch='close-menu']")!
      .addEventListener("click", () => this.menu.close(), events);
    this.toggle.addEventListener("click", this.onToggle, events);
    this.autoForwardToggle.addEventListener("click", this.onAutoForwardToggle, events);
    this.nitroSeamlessToggle.addEventListener("click", this.onNitroSeamlessToggle, events);
    this.pause.addEventListener("click", () => {
      this.menu.close();
      this.onPause();
    }, events);
    this.screen.addEventListener("click", this.onScreen, events);
    this.element.querySelector<HTMLButtonElement>("[data-touch='layout']")!
      .addEventListener("click", () => this.layout.start(), events);
    this.element.querySelector<HTMLButtonElement>("[data-touch='close-help']")!
      .addEventListener("click", () => { this.screenHelp.hidden = true; }, events);
    this.element.addEventListener("contextmenu", event => event.preventDefault(), events);
    this.element.addEventListener("selectstart", event => event.preventDefault(), events);
    this.pad.addEventListener("touchstart", event => event.preventDefault(),
      { ...events, passive: false });
    document.addEventListener("touchend", this.onTouchEnd, events);
    document.addEventListener("touchcancel", this.onTouchEnd, events);
    root.addEventListener("pointerdown", this.onTouch, events);
    window.addEventListener("keydown", this.onKeyDown, events);
    window.addEventListener("blur", this.releaseAll, events);
    document.addEventListener("visibilitychange", this.onVisibilityChange, events);
    document.addEventListener("fullscreenchange", this.onFullscreenChange, events);
    this.coarsePointer.addEventListener("change", this.onPointerChange, events);
    root.ownerDocument.body.append(this.element);
    this.refresh();
  }

  setRaceState(available: boolean, paused: boolean, lteDodge = false): void {
    if (this.available === available && this.paused === paused &&
        this.lteDodge === lteDodge) return;
    if (this.lteDodge !== lteDodge) {
      for (const [pointer, action] of [...this.pointers]) {
        if (action === DrivingAction.SteerLeft || action === DrivingAction.SteerRight)
          this.releasePointer(pointer);
      }
      this.lteDodge = lteDodge;
      this.setKeyMap(this.keyMap);
    }
    this.available = available;
    this.paused = paused;
    this.refresh();
  }

  setKeyMap(keyMap: KeyMap): void {
    this.keyMap = keyMap;
    for (const [action, button] of this.buttons) {
      const labels = actionBindings
        .filter(binding => binding.action === action)
        .filter(({ index }) => !this.lteDodge ||
          (keyMap[index] !== 44 && keyMap[index] !== 45))
        .map(({ index }) => this.options.keyLabel(keyMap[index]))
        .filter(Boolean);
      const steering = action === DrivingAction.SteerLeft ||
        action === DrivingAction.SteerRight;
      if (steering) {
        button.dataset.actionName = this.lteDodge
          ? action === DrivingAction.SteerLeft ? "左躲闪" : "右躲闪"
          : action === DrivingAction.SteerLeft ? "左转" : "右转";
        button.querySelector<HTMLElement>(".touch-dodge-key")!.hidden = !this.lteDodge;
      }
      const label = this.lteDodge && steering
        ? action === DrivingAction.SteerLeft ? "Z" : "X"
        : action === "pause" ? "Esc" : [...new Set(labels)].join(" / ");
      const name = button.dataset.actionName;
      button.title = label ? `${name}（${label}）` : name ?? "";
      button.setAttribute("aria-label", button.title);
    }
  }

  getNitroSeamlessMode(): NitroSeamlessMode { return this.nitroSeamless; }

  setAutoForwardActive(active: boolean): void {
    const forward = this.buttons.get(DrivingAction.Forward)!;
    if (forward.classList.contains("is-auto-forward") === active) return;
    forward.classList.toggle("is-auto-forward", active);
    if (active) forward.setAttribute("aria-description", "自动前进中");
    else forward.removeAttribute("aria-description");
  }

  resumeAutoForwardForGamepad(): void {
    if (!this.autoForward || !this.available || this.paused || this.menu.open ||
        this.layout.isEditing) return;
    this.usingGamepad = true;
    this.autoForwardSuspended = false;
    this.refreshAutoForward(this.manualVisible ?? this.usingTouch);
  }

  releaseAll = (): void => {
    this.suspendAutoForward();
    for (const pointer of [...this.pointers.keys()]) this.releasePointer(pointer);
  };

  dispose(): void {
    this.releaseAll();
    this.listeners.abort();
    this.layout.dispose();
    this.menu.close();
    this.element.remove();
  }

  bindButton(button: HTMLButtonElement): void {
    const action: ButtonAction = button.dataset.drive === "pause"
      ? "pause" : Number(button.dataset.drive);
    this.buttons.set(action, button);
    button.setAttribute("aria-pressed", "false");
    const events = { signal: this.listeners.signal };
    button.addEventListener("pointerdown", event => {
      if (event.button !== 0 || this.pad.hidden || this.layout.isEditing) return;
      event.preventDefault();
      this.useVirtualInput();
      button.setPointerCapture(event.pointerId);
      const alreadyPressed = [...this.pointers.values()].includes(action);
      this.pointers.set(event.pointerId, action);
      if (event.pointerType === "touch") this.touchPointers.add(event.pointerId);
      if (!alreadyPressed) {
        button.setAttribute("aria-pressed", "true");
        this.dispatchAction(action, true);
      }
    }, events);
    const release = (event: PointerEvent): void => this.releasePointer(event.pointerId);
    button.addEventListener("pointerup", release, events);
    button.addEventListener("pointercancel", release, events);
    button.addEventListener("lostpointercapture", release, events);
  }

  releasePointer(pointer: number): void {
    const action = this.pointers.get(pointer);
    if (action === undefined) return;
    this.pointers.delete(pointer);
    this.touchPointers.delete(pointer);
    const button = this.buttons.get(action)!;
    if (button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
    if (![...this.pointers.values()].includes(action)) {
      button.setAttribute("aria-pressed", "false");
      this.dispatchAction(action, false);
    }
  }

  dispatchAction(action: ButtonAction, down: boolean): void {
    if (action === "pause") {
      if (down) this.onPause();
      return;
    }
    const dispatched = this.lteDodge
      ? action === DrivingAction.SteerLeft ? DrivingAction.ModeImpulsePositive
      : action === DrivingAction.SteerRight ? DrivingAction.ModeImpulseNegative
      : action
      : action;
    this.onAction(dispatched, down);
  }

  onTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length === 0)
      for (const pointer of this.touchPointers) this.releasePointer(pointer);
  };

  refresh(): void {
    this.element.hidden = !this.touchCapable;
    const visible = this.manualVisible ?? this.usingTouch;
    this.refreshPad(visible);
    this.refreshAutoForward(visible);
    this.menuButton.setAttribute("aria-expanded", String(this.menu.open));
    this.toggle.hidden = !this.available;
    this.pause.hidden = !this.available;
    this.toggle.textContent = visible ? "隐藏按键" : "显示按键";
    this.toggle.setAttribute("aria-pressed", String(visible));
    this.autoForwardToggle.innerHTML =
      `自动前进<span>：${this.autoForward ? "开" : "关"}</span>`;
    this.autoForwardToggle.setAttribute("aria-pressed", String(this.autoForward));
    this.nitroSeamlessToggle.innerHTML =
      `氮气无缝<span>：${nitroModeNames[this.nitroSeamless]}</span>`;
    this.nitroSeamlessToggle.setAttribute("aria-pressed",
      String(this.nitroSeamless !== "off"));
    this.pause.textContent = this.paused ? "继续" : "暂停";
    this.onFullscreenChange();
  }

  refreshPad(visible: boolean): void {
    this.pad.hidden = !(this.layout.isEditing || this.drivingPadVisible(visible));
    if (this.pad.hidden) this.releaseAll();
  }

  drivingPadVisible(visible: boolean): boolean {
    return this.touchCapable && this.available && !this.paused &&
      visible && !this.menu.open;
  }

  refreshAutoForward(visible: boolean): void {
    const touchDriving = this.usingTouch && this.drivingPadVisible(visible);
    const gamepadDriving = this.usingGamepad && this.available &&
      !this.paused && !this.menu.open;
    this.setAutoForwardAllowed(this.autoForward &&
      !this.autoForwardSuspended && !this.layout.isEditing &&
      (touchDriving || gamepadDriving));
  }

  setAutoForwardAllowed(allowed: boolean): void {
    if (this.autoForwardAllowed === allowed) return;
    this.autoForwardAllowed = allowed;
    if (!allowed) this.setAutoForwardActive(false);
    this.onAutoForwardChange(allowed);
  }

  suspendAutoForward(): void {
    this.autoForwardSuspended = true;
    this.setAutoForwardAllowed(false);
  }

  useVirtualInput(): void {
    this.usingGamepad = false;
    this.usingTouch = true;
    this.autoForwardSuspended = false;
    this.refresh();
  }

  onAutoForwardToggle = (): void => {
    this.autoForward = !this.autoForward;
    this.autoForwardMessage.textContent = "";
    try { localStorage.setItem(AUTO_FORWARD_KEY, String(this.autoForward)); }
    catch { this.autoForwardMessage.textContent = "自动前进设置未保存，仅本次有效。"; }
    this.refresh();
  };

  onNitroSeamlessToggle = (): void => {
    const index = nitroModes.indexOf(this.nitroSeamless);
    this.nitroSeamless = nitroModes[(index + 1) % nitroModes.length]!;
    this.nitroSeamlessMessage.textContent = "";
    try { localStorage.setItem(NITRO_SEAMLESS_KEY, this.nitroSeamless); }
    catch { this.nitroSeamlessMessage.textContent = "氮气无缝设置未保存，仅本次有效。"; }
    this.onNitroSeamlessChange(this.nitroSeamless);
    this.refresh();
  };

  onScreen = async (): Promise<void> => {
    this.screenHelp.hidden = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled)
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      else this.showScreenHelp("当前浏览器不支持页面全屏。");
    } catch {
      this.showScreenHelp("浏览器未允许切换全屏。");
    }
  };

  showScreenHelp(message: string): void {
    this.screenMessage.textContent =
      `${message}可通过浏览器的分享或菜单选择“添加到主屏幕”或“安装应用”，再从图标打开。若有“作为网页 App 打开”选项，请开启。`;
    this.screenHelp.hidden = false;
  }

  onFullscreenChange = (): void => {
    const fullscreen = !!document.fullscreenElement;
    this.screen.textContent = fullscreen ? "退出全屏" : "全屏";
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
    this.screen.hidden = !fullscreen && !!(standalone ||
      window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches);
  };

  onToggle = (): void => {
    this.manualVisible = !(this.manualVisible ?? this.usingTouch);
    this.menu.close();
    this.refresh();
  };

  onTouch = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || this.element.contains(event.target as Node)) return;
    this.touchCapable = true;
    this.useVirtualInput();
  };

  onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || keyboardActionsForCode(event.code, this.keyMap).length === 0 ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input, textarea, select, [contenteditable]"))) return;
    this.usingGamepad = false;
    this.usingTouch = false;
    this.suspendAutoForward();
    this.refresh();
  };

  onPointerChange = (): void => {
    this.usingTouch = this.touchCapable && this.coarsePointer.matches;
    this.refresh();
  };

  onVisibilityChange = (): void => {
    if (document.hidden) this.releaseAll();
  };
}
