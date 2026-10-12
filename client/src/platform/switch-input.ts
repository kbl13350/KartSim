/**
 * Controller play outside races on the Switch: a cursor for the menus and
 * the system buttons. Brewser's own software cursor is turned off by the
 * package manifest (hideMouseDocked/Undocked) because it cannot be hidden
 * during a race, where the left stick steers and A drives.
 *
 * - Menus: left stick or D-pad moves the cursor, A clicks (and opens the
 *   keyboard on text fields), B is Escape (close or back), the right stick
 *   scrolls. The touch screen keeps working and hides the cursor.
 * - Races: the game reads the controller itself (gamepad map in 设置);
 *   only + is handled here, as Escape (pause).
 *
 * Brewser delivers key events to window only, and focus() does nothing on
 * elements other than inputs, while the game's windows listen for Escape on
 * the element they focus. This layer remembers focus() calls and sends its
 * keys to that element first.
 */
import { elementAtPoint, HIT_TEST_IGNORE } from "./hit-test";
import { SwitchButton } from "./switch-gamepad";

const STICK_DEADZONE = 0.2;
/** Cursor speed at full stick, in CSS pixels per second (the screen is 1280×720). */
const STICK_SPEED = 1100;
const DPAD_SPEED = 420;
const WHEEL_REPEAT_MS = 110;
/** Hover hit tests while the cursor moves: Brewser has no native one, so not every frame. */
const HOVER_INTERVAL_MS = 50;
/** Race frames refresh this; the cursor waits this long after the last one. */
const DRIVING_GRACE_MS = 300;

let drivingUntil = 0;

/** Called by the driving input bridge every race frame (time attack and multiplayer). */
export function noteDrivingFrame(active: boolean): void {
  if (active) drivingUntil = performance.now() + DRIVING_GRACE_MS;
}

export function isDriving(now = performance.now()): boolean {
  return now < drivingUntil;
}

let focusedElement: Element | null = null;

/** Records focus() so keys reach the window that asked for them (see above). */
function trackFocus(): void {
  if (typeof document === "undefined") return;
  let proto: object | null = Object.getPrototypeOf(document.createElement("div"));
  while (proto && !Object.prototype.hasOwnProperty.call(proto, "focus")) proto = Object.getPrototypeOf(proto);
  if (!proto) return;
  const original = (proto as { focus: (this: Element, options?: unknown) => void }).focus;
  Object.defineProperty(proto, "focus", {
    configurable: true, writable: true,
    value(this: Element, options?: unknown) {
      focusedElement = this;
      return original.call(this, options);
    },
  });
}

function keyTarget(): EventTarget {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (active && active !== document.body && active !== document.documentElement && active.isConnected !== false) return active;
  if (focusedElement && focusedElement.isConnected !== false && document.contains?.(focusedElement) !== false) return focusedElement;
  return window;
}

/**
 * Dispatches on target; when the event did not bubble up to window (Brewser's
 * element events stop at the document) and nobody stopped it, window gets it.
 */
function deliver(target: EventTarget, event: Event): void {
  let reached = target === window;
  const mark = () => { reached = true; };
  if (!reached) window.addEventListener(event.type, mark);
  try { target.dispatchEvent(event); }
  finally { if (target !== window) window.removeEventListener(event.type, mark); }
  const stopped = event.cancelBubble === true || (event as unknown as { _bubbleCancelled?: boolean })._bubbleCancelled === true;
  if (!reached && !stopped && event.bubbles) window.dispatchEvent(event);
}

const KEY_CODES: Record<string, number> = { Escape: 27, Enter: 13 };

export function sendKey(key: string, code = key): void {
  const target = keyTarget();
  for (const type of ["keydown", "keyup"] as const) {
    const event = mark(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }));
    for (const name of ["keyCode", "which"]) {
      try { Object.defineProperty(event, name, { value: KEY_CODES[key] ?? 0 }); } catch { /* Read-only in some engines. */ }
    }
    deliver(target, event);
  }
}

function pointerInit(target: Element, x: number, y: number, buttons: number): Record<string, unknown> {
  const rect = target.getBoundingClientRect?.();
  return {
    bubbles: true, cancelable: true, composed: true,
    clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y,
    offsetX: rect ? x - rect.left : x, offsetY: rect ? y - rect.top : y,
    button: 0, buttons, pointerId: 1, pointerType: "mouse", isPrimary: true,
    pressure: buttons ? 0.5 : 0, view: window,
  };
}

/** Marks the events this layer dispatches (the Brewser touch guard lets them pass). */
const SYNTHETIC = "__kartsimSynthetic";

function mark<T extends Event>(event: T): T {
  try { Object.defineProperty(event, SYNTHETIC, { value: true }); } catch { /* Frozen event: unmarked. */ }
  return event;
}

function firePointer(target: Element, kind: "down" | "move" | "up", x: number, y: number, buttons: number): void {
  const init = pointerInit(target, x, y, buttons);
  deliver(target, mark(new PointerEvent(`pointer${kind}`, init)));
  deliver(target, mark(new MouseEvent(`mouse${kind}`, init)));
}

function isTextField(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
  if (!element) return false;
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName !== "INPUT") return false;
  const type = (element.getAttribute("type") ?? "text").toLowerCase();
  return !["button", "submit", "checkbox", "radio", "range", "reset", "image", "file", "hidden", "color"].includes(type);
}

function commonAncestor(a: Element, b: Element | null): Element {
  if (!b) return a;
  for (let node: Element | null = a; node; node = node.parentElement) {
    if (node === b || node.contains?.(b)) return node;
  }
  return a;
}

/** The pointer the game sees: an arrow drawn on a small canvas above everything. */
function createCursor(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  canvas.setAttribute(HIT_TEST_IGNORE, "");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed", left: "0px", top: "0px", width: "32px", height: "32px",
    zIndex: "2147483647", pointerEvents: "none", display: "none",
  });
  const context = canvas.getContext("2d");
  if (context) {
    context.beginPath();
    context.moveTo(3, 2);
    context.lineTo(3, 25);
    context.lineTo(9, 19);
    context.lineTo(13.5, 29);
    context.lineTo(18, 27);
    context.lineTo(13.5, 17.5);
    context.lineTo(21.5, 17.5);
    context.closePath();
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#10213a";
    context.stroke();
    const fill = context.createLinearGradient(0, 2, 0, 29);
    fill.addColorStop(0, "#ffffff");
    fill.addColorStop(1, "#ffd02f");
    context.fillStyle = fill;
    context.fill();
  }
  document.body.appendChild(canvas);
  return canvas;
}

interface PadState { buttons: boolean[]; axes: number[] }

function readPad(): PadState | undefined {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) {
    if (!pad?.connected) continue;
    return { buttons: Array.from(pad.buttons, button => button.pressed || button.value >= 0.5), axes: Array.from(pad.axes) };
  }
  return undefined;
}

function stick(value: number | undefined): number {
  const raw = value ?? 0;
  const size = Math.abs(raw);
  if (size < STICK_DEADZONE) return 0;
  const scaled = (size - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  return Math.sign(raw) * scaled * scaled;
}

interface TouchPress {
  pressAt(x: number, y: number): void;
  dragTo(x: number, y: number): void;
  releaseAt(x: number, y: number): void;
  hideCursor(): void;
}

/**
 * Brewser hit-tests a touch itself (runtime/input/page-touch-forwarder.js):
 * without clip-path, so a window clipped to its bubble swallows taps meant
 * for the taskbar, and with pointer and touch events only, no click. In
 * Brewser the element-bound touch and touch-pointer events stop at the root
 * (its dispatch runs root capture listeners first), and the window's touch
 * events, which Brewser sends separately, drive the same press as A.
 */
function routeBrewserTouches(press: TouchPress): void {
  const root = document.documentElement;
  const guard = (event: Event) => {
    if ((event as unknown as Record<string, unknown>)[SYNTHETIC]) return;
    if (event.type.startsWith("touch") || (event as PointerEvent).pointerType === "touch") event.stopPropagation();
  };
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel",
    "pointerdown", "pointermove", "pointerup", "pointercancel"]) root.addEventListener(type, guard, true);
  let finger: number | undefined;
  const changed = (event: TouchEvent) => Array.from(event.changedTouches ?? [])
    .find(touch => finger === undefined || touch.identifier === finger);
  window.addEventListener("touchstart", event => {
    const touch = changed(event as TouchEvent);
    if (!touch || finger !== undefined) return;
    finger = touch.identifier;
    press.hideCursor();
    press.pressAt(touch.clientX, touch.clientY);
  });
  window.addEventListener("touchmove", event => {
    const touch = changed(event as TouchEvent);
    if (touch && finger !== undefined) press.dragTo(touch.clientX, touch.clientY);
  });
  const end = (event: Event) => {
    const touch = changed(event as TouchEvent);
    if (!touch || finger === undefined) return;
    finger = undefined;
    press.releaseAt(touch.clientX, touch.clientY);
  };
  window.addEventListener("touchend", end);
  window.addEventListener("touchcancel", end);
}

let brewserTouchRouting = false;

/** Inside Brewser (switch-runtime.ts): route touches through the cursor's press. */
export function enableBrewserTouchRouting(): void {
  brewserTouchRouting = true;
}

export function installSwitchInput(): void {
  trackFocus();
  const cursor = createCursor();
  let x = (window.innerWidth || 1280) / 2;
  let y = (window.innerHeight || 720) / 2;
  let shown = false;
  let previous: boolean[] = [];
  let lastFrame = performance.now();
  let lastHover = 0;
  let lastWheel = 0;
  let pressed: Element | null = null;

  const show = (visible: boolean) => {
    if (visible === shown) return;
    shown = visible;
    cursor.style.display = visible ? "block" : "none";
  };
  const place = () => {
    cursor.style.left = `${Math.round(x) - 2}px`;
    cursor.style.top = `${Math.round(y) - 1}px`;
  };
  /** A press at (x, y): the controller's A button, or a finger (Brewser). */
  const pressAt = (px: number, py: number) => {
    const target = elementAtPoint(px, py) ?? document.body;
    pressed = target;
    firePointer(target, "down", px, py, 1);
    if (isTextField(target)) target.focus();
    else if ((target as HTMLElement).tabIndex >= 0) focusedElement = target;
  };
  const dragTo = (px: number, py: number) => {
    if (pressed) firePointer(pressed, "move", px, py, 1);
  };
  const releaseAt = (px: number, py: number) => {
    const start = pressed;
    if (!start) return;
    pressed = null;
    firePointer(start, "up", px, py, 0);
    const release = elementAtPoint(px, py);
    const clicked = release && (release === start || start.contains?.(release) || release.contains?.(start))
      ? start : commonAncestor(start, release);
    deliver(clicked, mark(new MouseEvent("click", pointerInit(clicked, px, py, 0))));
  };
  if (brewserTouchRouting) routeBrewserTouches({ pressAt, dragTo, releaseAt, hideCursor: () => show(false) });
  // A finger on the screen takes over from the cursor until the stick moves again.
  else window.addEventListener("touchstart", () => show(false), { passive: true, capture: true });

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const seconds = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const pad = readPad();
    if (!pad) { previous = []; return; }
    const down = (index: number) => pad.buttons[index] === true;
    const rising = (index: number) => down(index) && previous[index] !== true;
    const falling = (index: number) => !down(index) && previous[index] === true;

    if (rising(SwitchButton.Plus)) sendKey("Escape");
    if (isDriving(now)) {
      show(false);
      if (pressed) { firePointer(pressed, "up", x, y, 0); pressed = null; }
      previous = pad.buttons;
      return;
    }

    let dx = stick(pad.axes[0]) * STICK_SPEED;
    let dy = stick(pad.axes[1]) * STICK_SPEED;
    if (down(SwitchButton.Left)) dx -= DPAD_SPEED;
    if (down(SwitchButton.Right)) dx += DPAD_SPEED;
    if (down(SwitchButton.Up)) dy -= DPAD_SPEED;
    if (down(SwitchButton.Down)) dy += DPAD_SPEED;
    const moved = dx !== 0 || dy !== 0;
    if (moved) {
      x = Math.max(0, Math.min((window.innerWidth || 1280) - 1, x + dx * seconds));
      y = Math.max(0, Math.min((window.innerHeight || 720) - 1, y + dy * seconds));
      show(true);
      place();
      if (pressed) dragTo(x, y);
      else if (now - lastHover >= HOVER_INTERVAL_MS) {
        lastHover = now;
        const hovered = elementAtPoint(x, y);
        if (hovered) firePointer(hovered, "move", x, y, 0);
      }
    }

    if (rising(SwitchButton.A)) {
      show(true);
      place();
      pressAt(x, y);
    } else if (falling(SwitchButton.A)) releaseAt(x, y);

    if (rising(SwitchButton.B)) sendKey("Escape");

    const wheel = stick(pad.axes[3]);
    if (wheel !== 0 && now - lastWheel >= WHEEL_REPEAT_MS) {
      lastWheel = now;
      const target = elementAtPoint(x, y);
      if (target) {
        deliver(target, mark(new WheelEvent("wheel", {
          ...pointerInit(target, x, y, 0), deltaX: 0, deltaY: Math.sign(wheel) * 100, deltaMode: 0,
        })));
      }
    }
    previous = pad.buttons;
  };
  requestAnimationFrame(frame);
}
