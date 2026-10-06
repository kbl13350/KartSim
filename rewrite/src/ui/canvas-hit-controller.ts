export interface CanvasHitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasHitRegion<Key = unknown> {
  key: Key;
  rect: CanvasHitRect;
  label?: string;
  disabled?: boolean;
  tabIndex?: number;
  hover?(): void;
  activate(): void;
  keydown?(event: KeyboardEvent): void;
}

function hideSemanticButton(button: HTMLButtonElement): void {
  Object.assign(button.style, {
    position: "absolute", width: "1px", height: "1px", padding: "0",
    border: "0", overflow: "hidden", clipPath: "inset(50%)",
    pointerEvents: "none",
  });
}

function contains(rect: CanvasHitRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width &&
    y >= rect.y && y <= rect.y + rect.height;
}

/** Synchronizes canvas pointer hit regions with invisible keyboard controls. */
export class CanvasHitController<Key = unknown> {
  readonly canvas: HTMLCanvasElement;
  readonly semanticHost: HTMLElement;
  readonly size: () => { width: number; height: number };
  readonly changed: (hovered: Key | undefined, pressed: Key | undefined) => void;
  regions: Array<CanvasHitRegion<Key>> = [];
  semantics = new Map<Key, HTMLButtonElement>();
  pointer?: number;
  hovered?: Key;
  pressed?: Key;
  disposed = false;

  constructor(canvas: HTMLCanvasElement, semanticHost: HTMLElement,
    size: () => { width: number; height: number },
    changed: (hovered: Key | undefined, pressed: Key | undefined) => void) {
    this.canvas = canvas;
    this.semanticHost = semanticHost;
    this.size = size;
    this.changed = changed;
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointerleave", this.leave);
    canvas.addEventListener("pointercancel", this.cancelPointer);
    canvas.addEventListener("lostpointercapture", this.cancelPointer);
  }

  update(regions: Array<CanvasHitRegion<Key>>): void {
    if (this.disposed) return;
    this.regions = regions;
    const visibleKeys = new Set<Key>();
    for (const region of regions) {
      if (region.label === undefined) continue;
      visibleKeys.add(region.key);
      const button = this.ensure(region);
      button.hidden = false;
      button.disabled = !!region.disabled;
      button.tabIndex = region.tabIndex ?? 0;
      button.setAttribute("aria-label", region.label);
    }
    for (const [key, button] of this.semantics)
      if (!visibleKeys.has(key)) button.hidden = true;
    if (this.pressed !== undefined &&
        (!this.region(this.pressed) || this.region(this.pressed)?.disabled)) {
      this.reset();
    } else if (this.hovered !== undefined &&
               (!this.region(this.hovered) || this.region(this.hovered)?.disabled)) {
      this.setState(undefined, this.pressed);
    }
  }

  ensure(region: CanvasHitRegion<Key>): HTMLButtonElement {
    let button = this.semantics.get(region.key);
    if (button) return button;
    button = this.canvas.ownerDocument.createElement("button");
    button.type = "button";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const current = this.region(region.key);
      if (this.available() && current && !current.disabled) current.activate();
    });
    button.addEventListener("keydown", event => {
      const current = this.region(region.key);
      if (this.available() && current && !current.disabled) current.keydown?.(event);
    });
    button.addEventListener("focus", () => this.setState(region.key, undefined));
    button.addEventListener("blur", () => {
      if (this.hovered === region.key && this.pointer === undefined)
        this.setState(undefined, undefined);
    });
    this.semantics.set(region.key, button);
    hideSemanticButton(button);
    this.semanticHost.append(button);
    return button;
  }

  control(key: Key): HTMLButtonElement | undefined { return this.semantics.get(key); }

  focus(key: Key): void {
    const button = this.semantics.get(key);
    if (button && !button.hidden && !button.disabled)
      button.focus({ preventScroll: true });
  }

  reset(): void {
    const pointer = this.pointer;
    this.pointer = undefined;
    this.setState(undefined, undefined);
    if (pointer !== undefined && this.canvas.hasPointerCapture(pointer))
      this.canvas.releasePointerCapture(pointer);
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointerleave", this.leave);
    this.canvas.removeEventListener("pointercancel", this.cancelPointer);
    this.canvas.removeEventListener("lostpointercapture", this.cancelPointer);
    this.semantics.forEach(button => button.remove());
    this.semantics.clear();
    this.regions = [];
  }

  available(): boolean {
    return !this.disposed && !this.canvas.closest("[hidden], [inert]");
  }

  region(key: Key): CanvasHitRegion<Key> | undefined {
    return this.regions.find(region => region.key === key);
  }

  hit(event: PointerEvent): CanvasHitRegion<Key> | undefined {
    if (!this.available()) return;
    const bounds = this.canvas.getBoundingClientRect();
    const size = this.size();
    if (!bounds.width || !bounds.height) return;
    const x = ((event.clientX - bounds.left) * size.width) / bounds.width;
    const y = ((event.clientY - bounds.top) * size.height) / bounds.height;
    return [...this.regions].reverse().find(region => contains(region.rect, x, y));
  }

  setState(hovered: Key | undefined, pressed: Key | undefined): void {
    if (this.hovered === hovered && this.pressed === pressed) return;
    this.hovered = hovered;
    this.pressed = pressed;
    this.changed(hovered, pressed);
  }

  move = (event: PointerEvent): void => {
    if (this.pointer !== undefined && this.pointer !== event.pointerId) return;
    const region = this.hit(event);
    const hovered = region && !region.disabled ? region.key : undefined;
    if (hovered !== undefined && hovered !== this.hovered) region?.hover?.();
    this.setState(hovered, this.pressed);
  };

  down = (event: PointerEvent): void => {
    if (event.button !== 0 || this.pointer !== undefined) return;
    const region = this.hit(event);
    if (!region || region.disabled) return;
    event.preventDefault();
    this.pointer = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.focus(region.key);
    this.setState(region.key, region.key);
  };

  up = (event: PointerEvent): void => {
    if (this.pointer !== event.pointerId || event.button !== 0) return;
    const region = this.hit(event);
    const pressed = this.pressed;
    this.pointer = undefined;
    this.setState(region && !region.disabled ? region.key : undefined, undefined);
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    const selected = pressed === undefined ? undefined : this.region(pressed);
    if (region?.key === pressed && selected && !selected.disabled && this.available())
      selected.activate();
  };

  leave = (): void => { this.setState(undefined, this.pressed); };

  cancelPointer = (event: PointerEvent): void => {
    if (this.pointer === event.pointerId) this.reset();
  };
}
