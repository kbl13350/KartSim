/**
 * Web APIs the game uses that Brewser (the Switch web runtime) lacks or only
 * stubs. Each is installed only when missing, so a browser running the Switch
 * build keeps its own. Found by reading Brewser's runtime (runtime/dist/*,
 * engine/packages/runtime): it defines HTMLElement, HTMLDivElement,
 * HTMLCanvasElement and HTMLImageElement, KeyboardEvent and TouchEvent, but
 * not the other element interfaces, MouseEvent/PointerEvent/WheelEvent,
 * structuredClone, elementFromPoint, matchMedia or sessionStorage.
 */
import { elementAtPoint } from "./hit-test";

type AnyGlobal = Record<string, unknown>;
const g = globalThis as unknown as AnyGlobal;

function define(name: string, value: unknown): void {
  if (g[name] !== undefined) return;
  try {
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  } catch {
    g[name] = value;
  }
}

/** `instanceof` checks against an element interface Brewser does not define. */
function tagInterface(name: string, tags: readonly string[]): unknown {
  const upper = new Set(tags.map(tag => tag.toUpperCase()));
  const ctor = function () { throw new TypeError("Illegal constructor"); } as unknown as AnyGlobal;
  Object.defineProperty(ctor, Symbol.hasInstance, {
    value: (value: unknown) => typeof (value as { tagName?: unknown })?.tagName === "string" &&
      upper.has(((value as { tagName: string }).tagName).toUpperCase()),
  });
  Object.defineProperty(ctor, "name", { value: name });
  return ctor;
}

function installElementInterfaces(): void {
  const interfaces: Record<string, readonly string[]> = {
    HTMLInputElement: ["input"], HTMLButtonElement: ["button"], HTMLSelectElement: ["select"],
    HTMLTextAreaElement: ["textarea"], HTMLAnchorElement: ["a"], HTMLSpanElement: ["span"],
    HTMLLabelElement: ["label"], HTMLImageElement: ["img"], HTMLCanvasElement: ["canvas"],
    HTMLVideoElement: ["video"], HTMLAudioElement: ["audio"], HTMLParagraphElement: ["p"],
    HTMLStyleElement: ["style"], HTMLFormElement: ["form"],
    SVGElement: ["svg", "path", "g", "rect", "circle", "line", "polyline", "polygon", "text", "use", "defs"],
  };
  for (const [name, tags] of Object.entries(interfaces)) define(name, tagInterface(name, tags));
}

/** Mouse, pointer, wheel, focus and input events built on Brewser's UIEvent. */
function installEventClasses(): void {
  const Base = (g.UIEvent ?? g.Event) as (new (type: string, init?: object) => object) | undefined;
  if (typeof Base !== "function") return;
  const fields = (target: object, init: AnyGlobal, defaults: AnyGlobal) => {
    for (const [key, fallback] of Object.entries(defaults)) {
      const value = init[key] ?? fallback;
      try { Object.defineProperty(target, key, { value, writable: true, configurable: true, enumerable: true }); }
      catch { (target as AnyGlobal)[key] = value; }
    }
  };
  const mouseDefaults = {
    clientX: 0, clientY: 0, screenX: 0, screenY: 0, pageX: undefined, pageY: undefined,
    offsetX: 0, offsetY: 0, movementX: 0, movementY: 0, button: 0, buttons: 0,
    ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, relatedTarget: null,
  };
  class MouseEventPolyfill extends (Base as new (type: string, init?: object) => object) {
    constructor(type: string, init: AnyGlobal = {}) {
      super(type, init);
      fields(this, init, mouseDefaults);
      const self = this as AnyGlobal;
      self.pageX ??= self.clientX;
      self.pageY ??= self.clientY;
      self.x = self.clientX;
      self.y = self.clientY;
    }
    getModifierState(): boolean { return false; }
  }
  class PointerEventPolyfill extends MouseEventPolyfill {
    constructor(type: string, init: AnyGlobal = {}) {
      super(type, init);
      fields(this, init, {
        pointerId: 1, pointerType: "mouse", isPrimary: true, width: 1, height: 1,
        pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0,
      });
    }
    getCoalescedEvents(): object[] { return [this]; }
    getPredictedEvents(): object[] { return []; }
  }
  class WheelEventPolyfill extends MouseEventPolyfill {
    static readonly DOM_DELTA_PIXEL = 0;
    static readonly DOM_DELTA_LINE = 1;
    static readonly DOM_DELTA_PAGE = 2;
    constructor(type: string, init: AnyGlobal = {}) {
      super(type, init);
      fields(this, init, { deltaX: 0, deltaY: 0, deltaZ: 0, deltaMode: 0 });
    }
  }
  class FocusEventPolyfill extends (Base as new (type: string, init?: object) => object) {
    constructor(type: string, init: AnyGlobal = {}) {
      super(type, init);
      fields(this, init, { relatedTarget: null });
    }
  }
  class InputEventPolyfill extends (Base as new (type: string, init?: object) => object) {
    constructor(type: string, init: AnyGlobal = {}) {
      super(type, init);
      fields(this, init, { data: null, inputType: "", isComposing: false });
    }
  }
  define("MouseEvent", MouseEventPolyfill);
  define("PointerEvent", PointerEventPolyfill);
  define("WheelEvent", WheelEventPolyfill);
  define("FocusEvent", FocusEventPolyfill);
  define("InputEvent", InputEventPolyfill);
}

/** structuredClone for the data the game clones (plain data, typed arrays, Map, Set, Date). */
export function cloneValue(value: unknown, seen: Map<object, unknown> = new Map()): unknown {
  if (value === null || typeof value !== "object") {
    if (typeof value === "function" || typeof value === "symbol") {
      throw new DOMException("The object could not be cloned.", "DataCloneError");
    }
    return value;
  }
  const known = seen.get(value);
  if (known !== undefined) return known;
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof ArrayBuffer) {
    const copy = value.slice(0);
    seen.set(value, copy);
    return copy;
  }
  if (ArrayBuffer.isView(value)) {
    const buffer = cloneValue(value.buffer, seen) as ArrayBuffer;
    const View = value.constructor as new (buffer: ArrayBuffer, offset: number, length: number) => ArrayBufferView;
    const length = value instanceof DataView ? value.byteLength
      : (value as unknown as { length: number }).length;
    return new View(buffer, value.byteOffset, length);
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) return value;
  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);
    for (const [key, item] of value) copy.set(cloneValue(key, seen), cloneValue(item, seen));
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    for (const item of value) copy.add(cloneValue(item, seen));
    return copy;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    value.forEach((item, index) => { copy[index] = cloneValue(item, seen); });
    return copy;
  }
  const copy: AnyGlobal = {};
  seen.set(value, copy);
  for (const key of Object.keys(value)) copy[key] = cloneValue((value as AnyGlobal)[key], seen);
  return copy;
}

/**
 * A media query list for the queries the game asks. The console is played
 * with controllers (the menu cursor is a fine pointer), so the phone touch
 * driving buttons stay hidden.
 */
function matchMediaPolyfill(query: string): unknown {
  const width = Number(g.innerWidth) || 1280;
  const evaluate = (part: string): boolean => {
    const text = part.trim().toLowerCase();
    let match = /\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(text);
    if (match) return match[1] === "min" ? width >= Number(match[2]) : width <= Number(match[2]);
    if (/\(\s*pointer\s*:\s*fine\s*\)/.test(text) || /\(\s*hover\s*:\s*hover\s*\)/.test(text)) return true;
    if (/display-mode\s*:\s*(fullscreen|standalone)/.test(text)) return true;
    match = /\(\s*resolution\s*:\s*(\d+(?:\.\d+)?)dppx\s*\)/.exec(text);
    if (match) return Number(match[1]) === (Number(g.devicePixelRatio) || 1);
    return false;
  };
  const matches = query.split(",").some(evaluate);
  return {
    matches, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  };
}

/** An in-memory Storage (sessionStorage: one launch). */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(String(key)) ?? null,
    setItem: (key: string, value: string) => { data.set(String(key), String(value)); },
    removeItem: (key: string) => { data.delete(String(key)); },
    clear: () => data.clear(),
  } as Storage;
}

/** Number grouping and zh-CN dates for toLocaleString when V8 has no ICU (no Intl). */
function installLocaleFallbacks(): void {
  if (typeof (g.Intl as { NumberFormat?: unknown } | undefined)?.NumberFormat === "function") return;
  const pad = (value: number) => String(value).padStart(2, "0");
  const group = (value: number, fractionDigits?: number): string => {
    if (!Number.isFinite(value)) return String(value);
    const fixed = fractionDigits === undefined ? String(Math.abs(value)) : Math.abs(value).toFixed(fractionDigits);
    const [whole = "0", fraction] = fixed.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${value < 0 ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
  };
  Number.prototype.toLocaleString = function (this: number, _locales?: unknown, options?: { maximumFractionDigits?: number }) {
    const value = Number(this);
    const digits = options?.maximumFractionDigits;
    return group(digits === undefined ? value : Number(value.toFixed(digits)));
  };
  Date.prototype.toLocaleDateString = function (this: Date) {
    return `${this.getFullYear()}/${this.getMonth() + 1}/${this.getDate()}`;
  };
  Date.prototype.toLocaleTimeString = function (this: Date) {
    return `${pad(this.getHours())}:${pad(this.getMinutes())}:${pad(this.getSeconds())}`;
  };
  Date.prototype.toLocaleString = function (this: Date) {
    return `${this.toLocaleDateString()} ${this.toLocaleTimeString()}`;
  };
}

export function installBrewserPolyfills(): void {
  installElementInterfaces();
  installEventClasses();
  define("structuredClone", (value: unknown) => cloneValue(value, new Map()));
  define("queueMicrotask", (callback: () => void) => { void Promise.resolve().then(callback); });
  define("requestIdleCallback", (callback: (deadline: object) => void) =>
    setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 8 }), 1));
  define("cancelIdleCallback", (handle: number) => clearTimeout(handle));
  define("matchMedia", matchMediaPolyfill);
  try {
    if (g.sessionStorage === undefined) define("sessionStorage", memoryStorage());
  } catch { define("sessionStorage", memoryStorage()); }
  installLocaleFallbacks();
  const doc = globalThis.document as Document & AnyGlobal | undefined;
  if (doc && typeof doc.elementFromPoint !== "function") {
    doc.elementFromPoint = (x: number, y: number) => elementAtPoint(x, y);
    doc.elementsFromPoint = (x: number, y: number) => {
      const hit = elementAtPoint(x, y);
      const list: Element[] = [];
      for (let node = hit as Element | null; node; node = node.parentElement) list.push(node);
      return list;
    };
  }
}
