/** The reusable BML window shell for multiplayer dialogs and stage panels. */

import type { WindowNode } from "./multiplayer-window-assets";

export interface MultiplayerWindowViewOptions {
  root: HTMLElement;
  definition: WindowNode;
  label: string;
  modal?: boolean;
  preserveDisplayPixels?: boolean;
  onCancel?(): void;
  onConfirm?(): void;
  state(node: WindowNode): {
    select?: { values: string[]; value: string; change?(value: string): void };
    [field: string]: unknown;
  };
  [field: string]: unknown;
}

export interface WindowHitLayer {
  reset(): void;
  dispose(): void;
}

export interface MultiplayerWindowViewDependencies {
  newHitLayer(canvas: HTMLCanvasElement, element: HTMLElement,
    size: () => { width: number; height: number },
    changed: (hovered: unknown, pressed: unknown) => void): WindowHitLayer;
  decoratePopup(popup: HTMLElement): void;
  attribute(node: WindowNode, name: string): string | undefined;
  measureText(context: CanvasRenderingContext2D, text: string,
    style: { family: string; size: number }): { width: number; height: number };
  drawText(context: CanvasRenderingContext2D, text: string,
    rectangle: unknown, style: Record<string, unknown>): void;
  color(value: string): string;
  releaseFont(font: unknown): void;
  fontFamily: string;
  renderWindow(view: MultiplayerWindowView): void;
  drawNode(view: MultiplayerWindowView, node: WindowNode, parent: unknown,
    visibleControls: Set<WindowNode>): void;
  canvasButton(view: MultiplayerWindowView, node: WindowNode, rectangle: unknown,
    text: string, state: unknown): unknown;
  updateHoverRegion(view: MultiplayerWindowView, event: PointerEvent): void;
  closeCombo(view: MultiplayerWindowView): void;
  chooseCombo(view: MultiplayerWindowView, index: number): void;
  drawComboPopup(view: MultiplayerWindowView): void;
  loadAssets(view: MultiplayerWindowView): Promise<void>;
}

let nextComboId = 0;

export class MultiplayerWindowView {
  readonly element = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  readonly popup = document.createElement("div");
  readonly controls = new Map<WindowNode, HTMLElement>();
  readonly comboRects = new Map<WindowNode, unknown>();
  readonly images = new Map<string, unknown>();
  readonly textures = new Map<WindowNode, unknown>();
  readonly frames = new Map<string, unknown>();
  readonly styles = new Map<WindowNode, unknown>();
  readonly strings = new Map<string, string>();
  context: CanvasRenderingContext2D;
  buttonLayer: WindowHitLayer;
  buttons: unknown[] = [];
  hoverRegions: unknown[] = [];
  openCombo?: WindowNode;
  comboIndex = 0;
  hovered?: WindowNode;
  hoveredRegion?: string;
  pressed?: WindowNode;
  disposed = false;
  paintingOnly = false;
  font?: unknown;
  config?: WindowNode;
  observer: ResizeObserver;

  constructor(readonly options: MultiplayerWindowViewOptions,
    readonly dependencies: MultiplayerWindowViewDependencies) {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建多人窗口");
    this.context = context;
    this.element.dataset.uiLayer = options.modal ? "dialog" : "stage";
    this.element.setAttribute("role", options.modal ? "dialog" : "region");
    this.element.setAttribute("aria-label", options.label);
    if (options.modal) this.element.setAttribute("aria-modal", "true");
    Object.assign(this.element.style, { position: "absolute", inset: "0", userSelect: "none" });
    Object.assign(this.canvas.style,
      { position: "absolute", inset: "0", width: "100%", height: "100%" });
    if (options.preserveDisplayPixels) this.canvas.style.imageRendering = "pixelated";
    this.element.append(this.canvas);

    this.buttonLayer = dependencies.newHitLayer(this.canvas, this.element,
      () => ({ width: 1600, height: 900 }), (hovered, pressed) => {
        this.hovered = typeof hovered === "object" ? hovered as WindowNode : undefined;
        this.pressed = typeof pressed === "object" ? pressed as WindowNode : undefined;
        if (typeof hovered === "number") this.comboIndex = hovered;
        this.canvas.style.cursor = hovered === undefined || hovered === "comboBackdrop"
          ? "default" : "pointer";
        this.render();
      });
    this.popup.setAttribute("role", "listbox");
    this.popup.setAttribute("aria-label", "房间选项");
    this.popup.id = `multiplayer-combo-${++nextComboId}`;
    this.popup.hidden = true;
    dependencies.decoratePopup(this.popup);
    this.element.append(this.popup);
    this.element.addEventListener("pointermove", event => this.updateHoverRegion(event));
    this.element.addEventListener("pointerleave", () => {
      if (this.hoveredRegion) { this.hoveredRegion = undefined; this.render(); }
    });
    this.element.addEventListener("keydown", event => this.handleKeyDown(event));
    this.observer = new ResizeObserver(() => this.render());
    this.observer.observe(options.root);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.openCombo && ["Escape", "ArrowUp", "ArrowDown", "Home", "End",
      "Enter", " ", "Tab"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const select = this.options.state(this.openCombo).select;
      if (!select) return;
      if (event.key === "Escape" || event.key === "Tab") {
        this.closeCombo();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        this.chooseCombo(this.comboIndex);
        return;
      }
      this.comboIndex = event.key === "Home" ? 0 : event.key === "End"
        ? select.values.length - 1
        : Math.max(0, Math.min(select.values.length - 1,
          this.comboIndex + (event.key === "ArrowUp" ? -1 : 1)));
      this.render();
      return;
    }
    if (event.key === "Escape" && this.options.onCancel) {
      event.preventDefault(); event.stopPropagation(); this.options.onCancel();
    }
    if (event.key === "Enter" && !event.isComposing && this.options.onConfirm) {
      event.preventDefault(); event.stopPropagation(); this.options.onConfirm();
    }
    if (this.options.modal) event.stopPropagation();
    if (this.options.modal && event.key === "Tab") {
      const controls = [...this.controls.values()].filter(control =>
        !control.hidden && !(control as HTMLButtonElement).disabled);
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (controls.length) {
        event.preventDefault();
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]!.focus();
      }
    }
  }

  static async load<View extends MultiplayerWindowView>(this: new (
    options: MultiplayerWindowViewOptions) => View,
  options: MultiplayerWindowViewOptions): Promise<View> {
    const view = new this(options);
    try { await view.loadAssets(); return view; }
    catch (error) { view.dispose(); throw error; }
  }

  show(): void {
    this.element.hidden = false;
    this.options.root.append(this.element);
    this.render();
  }

  hide(): void {
    this.element.hidden = true;
    this.openCombo = undefined;
    this.buttonLayer.reset();
    this.hoveredRegion = undefined;
  }

  get comboOpen(): boolean { return this.openCombo !== undefined; }
  get hoveredRegionId(): string | undefined { return this.hoveredRegion; }

  wrapLabel(text: string, width: number, size: number): { lines: string[]; lineHeight: number } {
    const style = { family: this.dependencies.fontFamily, size };
    const lines: string[] = [];
    let current = "";
    for (const character of text.replaceAll("|", "\n")) {
      if (character === "\n") { lines.push(current); current = ""; continue; }
      if (current && this.dependencies.measureText(this.context, current + character, style).width > width) {
        lines.push(current); current = "";
      }
      current += character;
    }
    lines.push(current);
    return { lines, lineHeight: this.dependencies.measureText(this.context, "", style).height };
  }

  paintLabelLines(context: CanvasRenderingContext2D, lines: string[],
    rectangle: { y: number; [field: string]: unknown }, size: number,
    color: string, lineHeight: number): void {
    lines.forEach((line, index) => this.dependencies.drawText(context, line,
      { ...rectangle, y: rectangle.y + index * lineHeight }, {
        family: this.dependencies.fontFamily, size, color,
        kind: "label", align: "center", verticalAlign: "top",
      }));
  }

  focus(name?: string): void {
    [...this.controls].find(([node, control]) =>
      !control.hidden && !(control as HTMLButtonElement).disabled &&
      (!name || this.dependencies.attribute(node, "name") === name))?.[1].focus();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.buttonLayer.dispose();
    this.observer.disconnect();
    this.element.remove();
    if (this.font) this.dependencies.releaseFont(this.font);
    this.controls.clear();
  }

  repaint(): void {
    this.paintingOnly = true;
    try { this.render(); }
    finally { this.paintingOnly = false; }
  }

  text(value: string): string {
    return value.replace(/#sb\(([^)]+)\)/g, (_whole, key: string) => this.strings.get(key) ?? "");
  }

  drawComboText(node: WindowNode, rectangle: unknown, disabled = false): void {
    const text = this.dependencies.attribute(node, "text") ?? "";
    const render = this.dependencies.attribute(node, "textRender") ?? "";
    this.dependencies.drawText(this.context, this.text(text), rectangle, {
      family: this.dependencies.fontFamily,
      size: Number(/\d+/.exec(render)?.[0] ?? 16),
      kind: "button",
      color: this.dependencies.color(this.dependencies.attribute(node,
        disabled ? "disabledTextColor" : "textColor") ?? "255 84 100 129"),
      align: "center", verticalAlign: "center",
    });
  }

  render(): void { this.dependencies.renderWindow(this); }
  draw(node: WindowNode, parent: unknown, visibleControls: Set<WindowNode>): void {
    this.dependencies.drawNode(this, node, parent, visibleControls);
  }
  canvasButton(node: WindowNode, rectangle: unknown, text: string, state: unknown): unknown {
    return this.dependencies.canvasButton(this, node, rectangle, text, state);
  }
  updateHoverRegion(event: PointerEvent): void {
    this.dependencies.updateHoverRegion(this, event);
  }
  closeCombo(): void { this.dependencies.closeCombo(this); }
  chooseCombo(index: number): void { this.dependencies.chooseCombo(this, index); }
  drawComboPopup(): void { this.dependencies.drawComboPopup(this); }
  loadAssets(): Promise<void> { return this.dependencies.loadAssets(this); }
}
