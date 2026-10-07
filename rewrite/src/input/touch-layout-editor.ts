export const TOUCH_LAYOUT_STORAGE_KEY = "kartsim.touch-layout";

export interface TouchButtonPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TouchButtonId = string | number;
export type TouchLayout = Record<string, TouchButtonPlacement>;

const arrowStep: Record<string, readonly [number, number]> = {
  ArrowLeft: [-4, 0],
  ArrowRight: [4, 0],
  ArrowUp: [0, -4],
  ArrowDown: [0, 4],
};

const editorMarkup = `
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
      </button>`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteWithin(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= min && value <= max;
}

/** Accepts current width/height and the older single-size saved format. */
export function normalizeTouchPlacement(value: unknown): TouchButtonPlacement | undefined {
  if (!isRecord(value)) return;
  const placement = {
    x: value.x,
    y: value.y,
    width: value.width === undefined ? value.size : value.width,
    height: value.height === undefined ? value.size : value.height,
  };
  if (finiteWithin(placement.x, 0, 1) && finiteWithin(placement.y, 0, 1) &&
      finiteWithin(placement.width, 44, 144) &&
      finiteWithin(placement.height, 44, 144)) {
    return {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    };
  }
}

/** Ignores unknown keys and malformed placements without discarding valid buttons. */
export function parseTouchLayout(raw: string, buttonIds: Iterable<TouchButtonId>): TouchLayout {
  try {
    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored)) return {};
    const layout: TouchLayout = {};
    for (const id of buttonIds) {
      const placement = normalizeTouchPlacement(stored[id]);
      if (placement) layout[id] = placement;
    }
    return layout;
  } catch {
    return {};
  }
}

export function resizeTouchButton(
  width: number, height: number, deltaX: number, deltaY: number,
): { width: number; height: number } {
  return {
    width: Math.min(144, Math.max(44, width + deltaX)),
    height: Math.min(144, Math.max(44, height + deltaY)),
  };
}

export function touchButtonPosition(fraction: number, size: number): string {
  return `clamp(0px, calc(${fraction * 100}% - ${fraction * size}px), max(0px, calc(100% - ${size}px)))`;
}

export function applyTouchPlacement(
  button: HTMLButtonElement, placement: TouchButtonPlacement | undefined,
): void {
  button.classList.toggle("touch-positioned", !!placement);
  if (!placement) {
    for (const property of ["position", "left", "top", "transform",
      "--touch-key-width", "--touch-key-height"]) {
      button.style.removeProperty(property);
    }
    return;
  }
  button.style.position = "fixed";
  button.style.left = touchButtonPosition(placement.x, placement.width);
  button.style.top = touchButtonPosition(placement.y, placement.height);
  button.style.transform = "none";
  button.style.setProperty("--touch-key-width", `${placement.width}px`);
  button.style.setProperty("--touch-key-height", `${placement.height}px`);
}

interface DragState {
  pointer: number;
  action: TouchButtonId;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  pointer: number;
  action: TouchButtonId;
  left: number;
  top: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
}

/** Lets players move and resize each touch control; saves only after confirmation. */
export class TouchLayoutEditor {
  readonly editor = document.createElement("div");
  readonly listeners = new AbortController();
  readonly resizeHandle: HTMLButtonElement;
  readonly message: HTMLElement;
  readonly parent: HTMLElement;
  readonly nextSibling: Node | null;
  readonly externalButtons: Array<{
    button: HTMLButtonElement;
    parent: HTMLElement;
    nextSibling: Node | null;
  }>;
  saved: TouchLayout;
  draft: TouchLayout = {};
  selected: TouchButtonId;
  editing = false;
  previousFocus: HTMLElement | null = null;
  drag: DragState | undefined;
  resize: ResizeState | undefined;

  constructor(
    readonly menu: HTMLDialogElement,
    readonly pad: HTMLElement,
    readonly buttons: Map<TouchButtonId, HTMLButtonElement>,
    readonly onEditingChange: () => void,
  ) {
    this.parent = pad.parentElement!;
    this.nextSibling = pad.nextSibling;
    this.externalButtons = [...buttons.values()]
      .filter(button => !pad.contains(button))
      .map(button => ({
        button,
        parent: button.parentElement!,
        nextSibling: button.nextSibling,
      }));
    this.selected = buttons.keys().next().value!;
    this.editor.className = "touch-layout-editor";
    this.editor.hidden = true;
    this.editor.innerHTML = editorMarkup;
    this.resizeHandle = this.editor.querySelector(".touch-layout-resize-handle")!;
    this.message = this.editor.querySelector("[role='status']")!;
    menu.append(this.editor);
    for (const [id, button] of buttons) {
      button.addEventListener("pointerdown", event => this.startDrag(event, id),
        { signal: this.listeners.signal });
      button.addEventListener("focus", () => {
        if (this.editing) this.selectButton(id);
      }, { signal: this.listeners.signal });
    }
    this.bindEditor();
    this.saved = this.readSaved();
    this.apply(this.saved);
  }

  get isEditing(): boolean { return this.editing; }

  start(): void {
    if (this.editing) return;
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.draft = { ...this.saved };
    this.editing = true;
    this.message.textContent = "";
    this.menu.classList.add("is-editing");
    this.editor.hidden = false;
    this.editor.append(this.pad);
    this.externalButtons.forEach(({ button }) => this.editor.append(button));
    this.pad.hidden = false;
    this.onEditingChange();
    this.selectButton(this.selected);
    this.buttons.get(this.selected)!.focus({ preventScroll: true });
  }

  cancel(): void {
    if (this.editing) {
      this.apply(this.saved);
      this.finish();
    }
  }

  dispose(): void {
    this.cancel();
    this.listeners.abort();
    this.editor.remove();
  }

  private bindEditor(): void {
    const options = { signal: this.listeners.signal };
    this.resizeHandle.addEventListener("pointerdown", event => this.startResize(event), options);
    this.editor.querySelector<HTMLButtonElement>("[data-layout='save']")!
      .addEventListener("click", () => this.save(), options);
    this.editor.querySelector<HTMLButtonElement>("[data-layout='cancel']")!
      .addEventListener("click", () => this.cancel(), options);
    this.editor.querySelector<HTMLButtonElement>("[data-layout='reset']")!
      .addEventListener("click", () => this.reset(), options);
    this.editor.addEventListener("pointermove", event => {
      this.moveDrag(event);
      this.moveResize(event);
    }, options);
    const stop = (event: PointerEvent): void => {
      if (event.pointerId === this.drag?.pointer) this.stopDrag();
      if (event.pointerId === this.resize?.pointer) this.stopResize();
    };
    this.editor.addEventListener("pointerup", stop, options);
    this.editor.addEventListener("pointercancel", stop, options);
    this.editor.addEventListener("lostpointercapture", stop, options);
    this.editor.addEventListener("keydown", event => {
      this.moveWithKeyboard(event);
      this.resizeWithKeyboard(event);
    }, options);
  }

  readSaved(): TouchLayout {
    try {
      return parseTouchLayout(localStorage.getItem(TOUCH_LAYOUT_STORAGE_KEY) ?? "{}",
        this.buttons.keys());
    } catch {
      return {};
    }
  }

  save(): void {
    this.stopInteraction();
    try {
      localStorage.setItem(TOUCH_LAYOUT_STORAGE_KEY, JSON.stringify(this.draft));
    } catch {
      this.message.textContent = "无法保存按键布局，请检查浏览器的本地存储设置后重试。";
      return;
    }
    this.saved = { ...this.draft };
    this.finish();
  }

  reset(): void {
    this.stopInteraction();
    this.draft = {};
    this.apply(this.draft);
    this.selectButton(this.selected);
    this.message.textContent = "已恢复默认，保存后生效。";
  }

  finish(): void {
    this.stopInteraction();
    this.editing = false;
    for (const button of this.buttons.values())
      button.classList.remove("is-layout-selected");
    this.parent.insertBefore(this.pad, this.nextSibling);
    this.externalButtons.forEach(({ button, parent, nextSibling }) =>
      parent.insertBefore(button, nextSibling));
    this.editor.hidden = true;
    this.menu.classList.remove("is-editing");
    this.onEditingChange();
    this.previousFocus?.focus();
  }

  selectButton(id: TouchButtonId): void {
    this.selected = id;
    for (const [candidate, button] of this.buttons)
      button.classList.toggle("is-layout-selected", candidate === id);
    const button = this.buttons.get(id)!;
    this.resizeHandle.setAttribute("aria-label",
      `调整${button.dataset.actionName ?? "按键"}大小`);
    this.positionResizeHandle();
  }

  startDrag(event: PointerEvent, id: TouchButtonId): void {
    if (!this.editing || this.drag || this.resize || event.button !== 0) return;
    event.preventDefault();
    this.selectButton(id);
    const button = this.buttons.get(id)!;
    button.focus({ preventScroll: true });
    const rect = button.getBoundingClientRect();
    this.drag = {
      pointer: event.pointerId,
      action: id,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    button.setPointerCapture(event.pointerId);
  }

  moveDrag(event: PointerEvent): void {
    if (this.drag?.pointer !== event.pointerId) return;
    event.preventDefault();
    const { action, offsetX, offsetY } = this.drag;
    const { width, height } = this.buttons.get(action)!.getBoundingClientRect();
    this.place(action, event.clientX - offsetX, event.clientY - offsetY, width, height);
  }

  stopDrag(): void {
    if (!this.drag) return;
    const { pointer, action } = this.drag;
    this.drag = undefined;
    const button = this.buttons.get(action)!;
    if (button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
  }

  startResize(event: PointerEvent): void {
    if (!this.editing || this.drag || this.resize || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const { left, top, width, height } =
      this.buttons.get(this.selected)!.getBoundingClientRect();
    this.resize = {
      pointer: event.pointerId,
      action: this.selected,
      left, top, width, height,
      startX: event.clientX,
      startY: event.clientY,
    };
    this.resizeHandle.setPointerCapture(event.pointerId);
  }

  moveResize(event: PointerEvent): void {
    if (this.resize?.pointer !== event.pointerId) return;
    event.preventDefault();
    const { action, left, top, width, height, startX, startY } = this.resize;
    const size = resizeTouchButton(width, height,
      event.clientX - startX, event.clientY - startY);
    this.place(action, left, top, size.width, size.height);
  }

  stopResize(): void {
    if (!this.resize) return;
    const { pointer } = this.resize;
    this.resize = undefined;
    if (this.resizeHandle.hasPointerCapture(pointer))
      this.resizeHandle.releasePointerCapture(pointer);
  }

  stopInteraction(): void {
    this.stopDrag();
    this.stopResize();
  }

  moveWithKeyboard(event: KeyboardEvent): void {
    const step = arrowStep[event.key];
    const button = this.buttons.get(this.selected)!;
    if (!this.editing || !step || event.target !== button) return;
    event.preventDefault();
    const rect = button.getBoundingClientRect();
    this.place(this.selected, rect.left + step[0], rect.top + step[1],
      rect.width, rect.height);
  }

  resizeWithKeyboard(event: KeyboardEvent): void {
    const step = arrowStep[event.key];
    if (!this.editing || !step || event.target !== this.resizeHandle) return;
    event.preventDefault();
    const rect = this.buttons.get(this.selected)!.getBoundingClientRect();
    const size = resizeTouchButton(rect.width, rect.height, step[0], step[1]);
    this.place(this.selected, rect.left, rect.top, size.width, size.height);
  }

  place(id: TouchButtonId, left: number, top: number,
    width: number, height: number): void {
    const placement = {
      x: Math.min(1, Math.max(0, left / Math.max(1, window.innerWidth - width))),
      y: Math.min(1, Math.max(0, top / Math.max(1, window.innerHeight - height))),
      width,
      height,
    };
    this.draft[id] = placement;
    applyTouchPlacement(this.buttons.get(id)!, placement);
    if (this.editing && id === this.selected) this.positionResizeHandle();
  }

  positionResizeHandle(): void {
    const rect = this.buttons.get(this.selected)!.getBoundingClientRect();
    this.resizeHandle.style.left = `${rect.right}px`;
    this.resizeHandle.style.top = `${rect.bottom}px`;
  }

  apply(layout: TouchLayout): void {
    for (const [id, button] of this.buttons)
      applyTouchPlacement(button, layout[id]);
  }
}
