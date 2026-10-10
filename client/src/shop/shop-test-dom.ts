/**
 * A small DOM for the shop view tests (no jsdom in this project): an element
 * tree with attributes, dataset and focus, the selectors the shop uses, and
 * event dispatch with capture, target and bubble phases from window down to
 * the target. A fake clock drives performance.now for the dialog's guards.
 */

type Listener = (event: TestEvent) => void;
interface Registration { listener: Listener; capture: boolean }

export class TestEvent {
  readonly type: string;
  target: TestEventTarget | null = null;
  currentTarget: TestEventTarget | null = null;
  defaultPrevented = false;
  propagationStopped = false;
  immediateStopped = false;
  readonly bubbles: boolean;
  [key: string]: unknown;

  constructor(type: string, init: Record<string, unknown> = {}) {
    this.type = type;
    this.bubbles = init.bubbles !== false;
    for (const [key, value] of Object.entries(init)) if (key !== "bubbles") this[key] = value;
  }

  preventDefault(): void { this.defaultPrevented = true; }
  stopPropagation(): void { this.propagationStopped = true; }
  stopImmediatePropagation(): void { this.propagationStopped = this.immediateStopped = true; }
}

export class TestEventTarget {
  private readonly registrations = new Map<string, Registration[]>();

  get parentTarget(): TestEventTarget | null { return null; }

  addEventListener(type: string, listener: Listener,
    options?: boolean | { capture?: boolean; passive?: boolean; once?: boolean }): void {
    const capture = typeof options === "boolean" ? options : !!options?.capture;
    const list = this.registrations.get(type) ?? [];
    if (!list.some(entry => entry.listener === listener && entry.capture === capture))
      list.push({ listener, capture });
    this.registrations.set(type, list);
  }

  removeEventListener(type: string, listener: Listener, options?: boolean | { capture?: boolean }): void {
    const capture = typeof options === "boolean" ? options : !!options?.capture;
    this.registrations.set(type, (this.registrations.get(type) ?? [])
      .filter(entry => entry.listener !== listener || entry.capture !== capture));
  }

  /** Listener count, for leak checks. */
  listenerCount(type: string): number { return this.registrations.get(type)?.length ?? 0; }

  invoke(event: TestEvent, phase: "capture" | "target" | "bubble"): void {
    for (const entry of [...this.registrations.get(event.type) ?? []]) {
      if (phase === "capture" && !entry.capture) continue;
      if (phase === "bubble" && entry.capture) continue;
      event.currentTarget = this;
      entry.listener(event);
      if (event.immediateStopped) return;
    }
  }

  dispatchEvent(event: TestEvent): boolean {
    event.target = this;
    const path: TestEventTarget[] = [];
    for (let node = this.parentTarget; node; node = node.parentTarget) path.unshift(node);
    for (const node of path) {
      if (event.propagationStopped) break;
      node.invoke(event, "capture");
    }
    if (!event.propagationStopped) this.invoke(event, "target");
    if (event.bubbles) {
      for (const node of [...path].reverse()) {
        if (event.propagationStopped) break;
        node.invoke(event, "bubble");
      }
    }
    return !event.defaultPrevented;
  }
}

class TestText {
  parentNode: TestElement | null = null;
  constructor(public textContent: string) {}
}

type Child = TestElement | TestText;

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

export class TestElement extends TestEventTarget {
  readonly tagName: string;
  readonly childNodes: Child[] = [];
  parentNode: TestElement | TestDocument | null = null;
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string>;
  readonly style: Record<string, string> & {
    setProperty(name: string, value: string): void;
    getPropertyValue(name: string): string;
    removeProperty(name: string): string;
  };
  value = "";
  type = "";
  name = "";
  checked = false;
  placeholder = "";
  autocomplete = "";
  spellcheck = true;
  enterKeyHint = "";
  maxLength = -1;
  scrollTop = 0;
  readonly offsetTop = 0;
  readonly offsetHeight = 0;
  readonly scrollHeight = 0;
  readonly clientWidth = 0;
  readonly clientHeight = 0;

  constructor(tag: string, readonly ownerDocument: TestDocument) {
    super();
    this.tagName = tag.toUpperCase();
    this.dataset = new Proxy({} as Record<string, string>, {
      get: (_target, key) => typeof key === "string" ? this.attributes.get(`data-${kebab(key)}`) : undefined,
      set: (_target, key, value) => {
        if (typeof key === "string") this.attributes.set(`data-${kebab(key)}`, String(value));
        return true;
      },
      deleteProperty: (_target, key) => {
        if (typeof key === "string") this.attributes.delete(`data-${kebab(key)}`);
        return true;
      },
    });
    const properties = new Map<string, string>();
    this.style = Object.assign(Object.create(null) as Record<string, string>, {
      setProperty: (name: string, value: string) => { properties.set(name, value); },
      getPropertyValue: (name: string) => properties.get(name) ?? "",
      removeProperty: (name: string) => {
        const value = properties.get(name) ?? "";
        properties.delete(name);
        return value;
      },
    }) as TestElement["style"];
  }

  override get parentTarget(): TestEventTarget | null { return this.parentNode; }
  get parentElement(): TestElement | null {
    return this.parentNode instanceof TestElement ? this.parentNode : null;
  }

  get children(): TestElement[] {
    return this.childNodes.filter((node): node is TestElement => node instanceof TestElement);
  }
  get childElementCount(): number { return this.children.length; }
  get firstElementChild(): TestElement | null { return this.children[0] ?? null; }

  get className(): string { return this.attributes.get("class") ?? ""; }
  set className(value: string) { this.attributes.set("class", value); }
  get id(): string { return this.attributes.get("id") ?? ""; }
  set id(value: string) { this.attributes.set("id", value); }
  get title(): string { return this.attributes.get("title") ?? ""; }
  set title(value: string) { this.attributes.set("title", value); }
  get hidden(): boolean { return this.attributes.has("hidden"); }
  set hidden(value: boolean) { this.toggleAttribute("hidden", value); }
  get disabled(): boolean { return this.attributes.has("disabled"); }
  set disabled(value: boolean) { this.toggleAttribute("disabled", value); }
  get tabIndex(): number {
    const value = this.attributes.get("tabindex");
    return value === undefined ? (["BUTTON", "INPUT", "SELECT"].includes(this.tagName) ? 0 : -1) : Number(value);
  }
  set tabIndex(value: number) { this.attributes.set("tabindex", String(value)); }

  get classList() {
    const names = () => this.className.split(/\s+/).filter(Boolean);
    const set = (list: string[]) => { this.className = list.join(" "); };
    return {
      add: (...values: string[]) => set([...new Set([...names(), ...values])]),
      remove: (...values: string[]) => set(names().filter(name => !values.includes(name))),
      contains: (value: string) => names().includes(value),
      toggle: (value: string, force?: boolean) => {
        const on = force ?? !names().includes(value);
        set(on ? [...new Set([...names(), value])] : names().filter(name => name !== value));
        return on;
      },
    };
  }

  get textContent(): string {
    return this.childNodes.map(node => node.textContent).join("");
  }
  set textContent(value: string | null) {
    this.replaceChildren(...(value ? [new TestText(value)] : []));
  }

  get isConnected(): boolean {
    let node: TestElement | TestDocument | null = this;
    while (node instanceof TestElement) node = node.parentNode;
    return node instanceof TestDocument;
  }

  /** Rendered: connected with no hidden ancestor (enough for trapFocus). */
  get offsetParent(): TestElement | null {
    if (!this.isConnected) return null;
    for (let node: TestElement | null = this; node; node = node.parentElement) if (node.hidden) return null;
    return this.parentElement;
  }

  private adopt(node: Child | string): Child {
    const child = typeof node === "string" ? new TestText(node) : node;
    if (child instanceof TestElement || child instanceof TestText) {
      const parent = child.parentNode;
      if (parent instanceof TestElement) parent.childNodes.splice(parent.childNodes.indexOf(child), 1);
    }
    child.parentNode = this;
    return child;
  }

  append(...nodes: Array<Child | string>): void {
    for (const node of nodes) this.childNodes.push(this.adopt(node));
  }

  prepend(...nodes: Array<Child | string>): void {
    const adopted = nodes.map(node => this.adopt(node));
    this.childNodes.unshift(...adopted);
  }

  /** No layout: everything is an empty box at the origin. */
  getBoundingClientRect(): { x: number; y: number; width: number; height: number;
    left: number; top: number; right: number; bottom: number } {
    return { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
  }

  replaceChildren(...nodes: Array<Child | string>): void {
    for (const child of this.childNodes.splice(0)) child.parentNode = null;
    this.append(...nodes);
  }

  remove(): void {
    const parent = this.parentNode;
    if (parent instanceof TestElement) parent.childNodes.splice(parent.childNodes.indexOf(this), 1);
    this.parentNode = null;
    if (this.ownerDocument.activeElement && this.contains(this.ownerDocument.activeElement))
      this.ownerDocument.activeElement = this.ownerDocument.body;
  }

  /** Markup is not parsed: one empty element of the first tag stands for it. */
  insertAdjacentHTML(_position: string, markup: string): void {
    const tag = /^\s*<([a-zA-Z0-9]+)/.exec(markup)?.[1];
    if (tag) this.append(this.ownerDocument.createElement(tag));
  }

  contains(node: unknown): boolean {
    for (let current = node; current instanceof TestElement; current = current.parentNode)
      if (current === this) return true;
    return false;
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, String(value)); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  hasAttribute(name: string): boolean { return this.attributes.has(name); }
  toggleAttribute(name: string, force?: boolean): boolean {
    const on = force ?? !this.attributes.has(name);
    if (on) this.attributes.set(name, ""); else this.attributes.delete(name);
    return on;
  }

  focus(): void {
    if (this.disabled || !this.isConnected) return;
    this.ownerDocument.activeElement = this;
  }
  blur(): void {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body;
  }

  /** Dispatch a click (detail 1 unless given), like a pointer click. */
  click(init: Record<string, unknown> = {}): TestEvent {
    const event = new TestEvent("click", { detail: 1, ...init });
    this.dispatchEvent(event);
    return event;
  }

  /** Dispatch an event of this type with these fields. */
  fire(type: string, init: Record<string, unknown> = {}): TestEvent {
    const event = new TestEvent(type, init);
    this.dispatchEvent(event);
    return event;
  }

  querySelectorAll<T = TestElement>(selector: string): T[] {
    const alternatives = splitList(selector).map(parseSelector);
    const found: TestElement[] = [];
    const visit = (node: TestElement) => {
      for (const child of node.children) {
        if (alternatives.some(alternative => matches(child, alternative, this))) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found as T[];
  }

  querySelector<T = TestElement>(selector: string): T | null {
    return (this.querySelectorAll<T>(selector)[0] ?? null);
  }

  /** All text in this subtree. */
  text(): string { return this.textContent; }
}

// --- Selectors ----------------------------------------------------------

interface Compound {
  tag?: string;
  ids: string[];
  classes: string[];
  attributes: { name: string; value?: string }[];
  pseudos: string[];
  not: Compound[];
}

interface Selector { scopeChild: boolean; compound: Compound }

function splitList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0, current = "";
  for (const char of selector) {
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth--;
    if (char === "," && depth === 0) { parts.push(current.trim()); current = ""; continue; }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseCompound(text: string): Compound {
  const compound: Compound = { ids: [], classes: [], attributes: [], pseudos: [], not: [] };
  let rest = text.trim();
  const tag = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(rest);
  if (tag) { compound.tag = tag[0].toUpperCase(); rest = rest.slice(tag[0].length); }
  while (rest) {
    let match: RegExpExecArray | null;
    if ((match = /^\.([\w-]+)/.exec(rest))) compound.classes.push(match[1]!);
    else if ((match = /^#([\w-]+)/.exec(rest))) compound.ids.push(match[1]!);
    else if ((match = /^\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/.exec(rest)))
      compound.attributes.push({ name: match[1]!, value: match[2] ?? match[3] ?? match[4] });
    else if ((match = /^:not\(([^()]*)\)/.exec(rest))) compound.not.push(parseCompound(match[1]!));
    else if ((match = /^:([\w-]+)/.exec(rest))) compound.pseudos.push(match[1]!);
    else throw new Error(`Unsupported selector ${text}`);
    rest = rest.slice(match[0].length);
  }
  return compound;
}

function parseSelector(text: string): Selector {
  const scope = /^:scope\s*>\s*/.exec(text);
  if (scope) return { scopeChild: true, compound: parseCompound(text.slice(scope[0].length)) };
  if (/[\s>+~]/.test(text.replace(/\[[^\]]*\]|\([^)]*\)/g, "")))
    throw new Error(`Unsupported combinator in ${text}`);
  return { scopeChild: false, compound: parseCompound(text) };
}

function matchesCompound(node: TestElement, compound: Compound): boolean {
  if (compound.tag && node.tagName !== compound.tag) return false;
  if (compound.ids.some(id => node.id !== id)) return false;
  if (compound.classes.some(name => !node.classList.contains(name))) return false;
  if (compound.attributes.some(({ name, value }) =>
    !node.attributes.has(name) || (value !== undefined && node.attributes.get(name) !== value))) return false;
  for (const pseudo of compound.pseudos) {
    if (pseudo === "checked" && !node.checked) return false;
    if (pseudo === "disabled" && !node.disabled) return false;
    if (pseudo !== "checked" && pseudo !== "disabled") throw new Error(`Unsupported pseudo-class :${pseudo}`);
  }
  return !compound.not.some(inner => matchesCompound(node, inner));
}

function matches(node: TestElement, selector: Selector, scope: TestElement): boolean {
  if (selector.scopeChild && node.parentNode !== scope) return false;
  return matchesCompound(node, selector.compound);
}

// --- Document and window ------------------------------------------------

export class TestWindow extends TestEventTarget {
  innerWidth = 1600;
  innerHeight = 900;
  devicePixelRatio = 1;
}

export class TestDocument extends TestEventTarget {
  readonly documentElement: TestElement;
  readonly body: TestElement;
  activeElement: TestElement | null;

  constructor(readonly defaultView: TestWindow) {
    super();
    this.documentElement = new TestElement("html", this);
    this.documentElement.parentNode = this;
    this.body = new TestElement("body", this);
    this.documentElement.append(this.body);
    this.activeElement = this.body;
  }

  override get parentTarget(): TestEventTarget | null { return this.defaultView; }

  createElement(tag: string): TestElement { return new TestElement(tag, this); }
  createTextNode(text: string): TestText { return new TestText(text); }
}

export interface TestDom {
  document: TestDocument;
  window: TestWindow;
  /** The fake performance.now() value. */
  now(): number;
  /** Move the fake clock forward. */
  advance(ms: number): void;
  /** Dispatch a key event at the focused element (or body), like a keyboard. */
  key(type: "keydown" | "keyup", key: string, init?: Record<string, unknown>): TestEvent;
  restore(): void;
}

const GLOBALS = ["document", "window", "HTMLElement", "HTMLButtonElement", "HTMLInputElement",
  "HTMLSelectElement", "Option", "CSS", "Node", "Element"] as const;

/** Install document, window, element classes, Option, CSS and a fake performance.now. */
export function installShopTestDom(): TestDom {
  const window = new TestWindow();
  const document = new TestDocument(window);
  const saved = new Map(GLOBALS.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const realNow = performance.now;
  // Whole milliseconds from the real time: test durations stay sensible and
  // boundaries such as "500 ms after opening" are exact.
  let clock = Math.ceil(realNow.call(performance));
  performance.now = () => clock;
  class TestOption extends TestElement {
    constructor(text = "", value = "") {
      super("option", document);
      this.textContent = text;
      this.value = value;
    }
  }
  const values: Record<(typeof GLOBALS)[number], unknown> = {
    document, window, HTMLElement: TestElement, HTMLButtonElement: TestElement,
    HTMLInputElement: TestElement, HTMLSelectElement: TestElement, Option: TestOption,
    CSS: { escape: (value: string) => value.replace(/["\\]/g, "\\$&") },
    Node: TestElement, Element: TestElement,
  };
  for (const name of GLOBALS)
    Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
  // Input and select checks in the shop are instanceof checks; narrow them by tag.
  for (const [name, tag] of [["HTMLInputElement", "INPUT"], ["HTMLSelectElement", "SELECT"],
    ["HTMLButtonElement", "BUTTON"]] as const) {
    Object.defineProperty(globalThis, name, {
      configurable: true, writable: true,
      value: { [Symbol.hasInstance]: (node: unknown) => node instanceof TestElement && node.tagName === tag },
    });
  }
  return {
    document, window,
    now: () => clock,
    advance: ms => { clock += ms; },
    key(type, key, init = {}) {
      const target = document.activeElement ?? document.body;
      const event = new TestEvent(type, { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
        repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false,
        shiftKey: false, ...init });
      target.dispatchEvent(event);
      return event;
    },
    restore() {
      performance.now = realNow;
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
      }
    },
  };
}
