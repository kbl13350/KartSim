/**
 * A minimal DOM for node:test UI tests (no jsdom in this project): elements
 * with children, attributes, classes, simple selectors and event listeners.
 */

type Listener = (event: FakeEvent) => void;

export interface FakeEvent {
  type: string;
  target: FakeElement;
  key?: string;
  defaultPrevented: boolean;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}

export class FakeElement {
  readonly tagName: string;
  className = "";
  textContent: string | null = "";
  children: FakeElement[] = [];
  parentElement?: FakeElement;
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> & { setProperty(name: string, value: string): void;
    getPropertyValue(name: string): string };
  hidden = false;
  disabled = false;
  value = "";
  type = "";
  title = "";
  placeholder = "";
  autocomplete = "";
  maxLength = -1;
  src = "";
  alt = "";
  draggable = true;
  width = 0;
  height = 0;
  clientWidth = 0;
  clientHeight = 0;
  removed = false;
  focused = false;
  onclick: ((event?: FakeEvent) => unknown) | null = null;
  oninput: ((event?: FakeEvent) => unknown) | null = null;
  onsubmit: ((event: FakeEvent) => unknown) | null = null;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(tag: string, readonly ownerDocument: FakeDocument) {
    this.tagName = tag.toUpperCase();
    const properties = new Map<string, string>();
    this.style = Object.assign(Object.create(null) as Record<string, string>, {
      cssText: "",
      setProperty: (name: string, value: string) => { properties.set(name, value); },
      getPropertyValue: (name: string) => properties.get(name) ?? "",
    }) as FakeElement["style"];
  }

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

  get firstElementChild(): FakeElement | null { return this.children[0] ?? null; }

  set innerHTML(markup: string) {
    this.children = [];
    const tag = /^\s*<([a-zA-Z0-9]+)/.exec(markup)?.[1];
    if (tag) this.append(new FakeElement(tag, this.ownerDocument));
  }

  append(...nodes: Array<FakeElement | string>): void {
    for (const node of nodes) {
      if (typeof node === "string") {
        this.textContent = (this.textContent ?? "") + node;
        continue;
      }
      node.parentElement?.children.splice(node.parentElement.children.indexOf(node), 1);
      node.parentElement = this;
      node.removed = false;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes: FakeElement[]): void {
    for (const child of this.children) child.parentElement = undefined;
    this.children = [];
    this.append(...nodes);
  }

  remove(): void {
    this.removed = true;
    const parent = this.parentElement;
    if (parent) parent.children.splice(parent.children.indexOf(this), 1);
    this.parentElement = undefined;
  }

  contains(node: FakeElement | null): boolean {
    for (let current: FakeElement | undefined = node ?? undefined; current;
      current = current.parentElement) if (current === this) return true;
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

  focus(): void { this.focused = true; this.ownerDocument.activeElement = this; }
  blur(): void { this.focused = false; }
  getContext(): null { return null; }
  getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 }; }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(entry => entry !== listener));
  }

  private event(type: string, extra: Partial<FakeEvent>): FakeEvent {
    const event: FakeEvent = {
      type, target: this, defaultPrevented: false,
      preventDefault() { event.defaultPrevented = true; },
      stopPropagation() {}, stopImmediatePropagation() {}, ...extra,
    };
    return event;
  }

  private handler(type: string) {
    return type === "click" ? this.onclick : type === "input" ? this.oninput :
      type === "submit" ? this.onsubmit : null;
  }

  dispatch(type: string, extra: Partial<FakeEvent> = {}): FakeEvent {
    const event = this.event(type, extra);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    void this.handler(type)?.(event);
    return event;
  }

  click(): FakeEvent { return this.dispatch("click"); }

  /** Dispatch and wait for an async on<type> handler (form submit, button click). */
  async fire(type: string, extra: Partial<FakeEvent> = {}): Promise<void> {
    const event = this.event(type, extra);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    await this.handler(type)?.(event);
  }

  /** Simple selectors: "tag", ".class", "tag.class" and "[attribute]". */
  querySelectorAll(selector: string): FakeElement[] {
    const match = /^([a-zA-Z0-9]*)((?:\.[\w-]+)*)(?:\[([\w-]+)\])?$/.exec(selector.trim());
    if (!match) throw new Error(`Unsupported selector ${selector}`);
    const [, tag, classes, attribute] = match;
    const wanted = (classes ?? "").split(".").filter(Boolean);
    const found: FakeElement[] = [];
    const visit = (node: FakeElement) => {
      for (const child of node.children) {
        if ((!tag || child.tagName === tag.toUpperCase()) &&
            wanted.every(name => child.classList.contains(name)) &&
            (!attribute || child.attributes.has(attribute))) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  /** All text in this subtree, in document order. */
  text(): string {
    return [this.textContent ?? "", ...this.children.map(child => child.text())].join("");
  }
}

export class FakeDocument {
  readonly body: FakeElement;
  readonly head: FakeElement;
  activeElement: FakeElement | null = null;

  constructor() {
    this.body = new FakeElement("body", this);
    this.head = new FakeElement("head", this);
  }

  createElement(tag: string): FakeElement { return new FakeElement(tag, this); }
}

/** Install document/window globals for code that uses them directly. */
export function installFakeDom(): { document: FakeDocument; restore(): void } {
  const document = new FakeDocument();
  const saved = {
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    cancelAnimationFrame: Object.getOwnPropertyDescriptor(globalThis, "cancelAnimationFrame"),
    requestAnimationFrame: Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame"),
  };
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  const fakeWindow = {
    devicePixelRatio: 1,
    setTimeout: (callback: () => void, delay?: number) => {
      const timer = setTimeout(callback, delay);
      (timer as { unref?(): void }).unref?.();
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
    setInterval: () => 0,
    clearInterval: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(globalThis, "document", { value: document, configurable: true, writable: true });
  Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true, writable: true });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { value: () => {}, configurable: true, writable: true });
  Object.defineProperty(globalThis, "requestAnimationFrame", { value: () => 0, configurable: true, writable: true });
  return {
    document,
    restore() {
      for (const timer of timers) clearTimeout(timer);
      for (const [name, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
      }
    },
  };
}
