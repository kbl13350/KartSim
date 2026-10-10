export type PauseAction = "retry" | "menu" | "resume";

export interface PauseHit {
  action: PauseAction;
  rect: { x: number; y: number; width: number; height: number };
}

export interface PauseMenuOptions {
  root: HTMLElement;
  library: unknown;
  onInteraction?(): void;
  onHover?(): void;
  onActivate?(): void;
  onResume(): void;
  onRetry(): void;
  onMenu(): void;
}

export interface PauseMenuAssets {
  strings: Map<string, string>;
  font: unknown;
  overlayAlpha: number;
  captionFrame: unknown;
  captionOffset: unknown;
  frame: { image: CanvasImageSource };
  retry: unknown[];
  menu: unknown[];
  close: unknown[];
  definition: unknown;
  closeDefinition: unknown;
}

export interface PauseMenuViewDependencies {
  width: number;
  height: number;
  fontFamily: string;
  loadAssets(library: unknown): Promise<PauseMenuAssets>;
  releaseFont(font: unknown): void;
  string(strings: Map<string, string>, key: string): string;
  smoothImages(): boolean;
  drawFrame(context: CanvasRenderingContext2D, frame: unknown,
    image: CanvasImageSource, rect: PauseHit["rect"]): void;
  captionRect(frame: unknown, dialog: PauseHit["rect"], offset: unknown): PauseHit["rect"];
  drawText(context: CanvasRenderingContext2D, text: string, rect: PauseHit["rect"],
    options: Record<string, unknown>): void;
  buttonHits(assets: PauseMenuAssets, dialog: PauseHit["rect"]): PauseHit[];
  buttonState(action: PauseAction, hovered?: PauseAction,
    pressed?: PauseAction): number;
  drawButton(context: CanvasRenderingContext2D,
    image: unknown, rect: PauseHit["rect"]): void;
  resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    width: number, height: number, pixelRatio: number,
    virtualWidth: number, virtualHeight: number,
    targetWidth: number, targetHeight: number): void;
  pixelRatio(): number;
  dialogRect(assets: PauseMenuAssets): PauseHit["rect"];
  contains(x: number, y: number, rect: PauseHit["rect"]): boolean;
}

/** Canvas pause dialog for a solo time attack, including pointer hit testing. */
export class PauseMenuView {
  readonly canvas = document.createElement("canvas");
  readonly context: CanvasRenderingContext2D;
  readonly resizeObserver: ResizeObserver;
  hits: PauseHit[] = [];
  hovered: PauseAction | undefined;
  pressed: PauseAction | undefined;
  visible = false;
  disposed = false;

  constructor(
    readonly options: PauseMenuOptions,
    readonly assets: PauseMenuAssets,
    readonly dependencies: PauseMenuViewDependencies,
  ) {
    const context = this.canvas.getContext("2d", { alpha: true });
    if (!context)
      throw new Error("浏览器无法创建 P3528 TimeAttack 暂停菜单 Canvas。");
    this.context = context;
    Object.assign(this.canvas.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%",
      imageRendering: "auto", pointerEvents: "auto",
    });
    this.canvas.dataset.uiLayer = "dialog";
    this.canvas.hidden = true;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "dialog");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.setAttribute("aria-label",
      dependencies.string(assets.strings, "menu"));
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    options.root.append(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(options.root);
    window.addEventListener("resize", this.onWindowResize);
  }

  static async load<T extends PauseMenuView>(
    options: PauseMenuOptions,
    dependencies: PauseMenuViewDependencies,
    create: (options: PauseMenuOptions, assets: PauseMenuAssets) => T,
  ): Promise<T> {
    const assets = await dependencies.loadAssets(options.library);
    try {
      return create(options, assets);
    } catch (error) {
      dependencies.releaseFont(assets.font);
      throw error;
    }
  }

  onWindowResize = (): void => { this.render(); };

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return;
    this.visible = visible;
    this.hovered = undefined;
    this.pressed = undefined;
    this.canvas.hidden = !visible;
    this.canvas.setAttribute("aria-hidden", String(!visible));
    if (visible) {
      this.render();
      this.canvas.focus();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.onWindowResize);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.remove();
    this.dependencies.releaseFont(this.assets.font);
  }

  render(): void {
    if (!this.visible || this.disposed) return;
    const ops = this.dependencies;
    this.resizeCanvas();
    this.context.clearRect(0, 0, ops.width, ops.height);
    this.context.imageSmoothingEnabled = ops.smoothImages();
    this.context.fillStyle = `rgba(0, 0, 0, ${this.assets.overlayAlpha})`;
    this.context.fillRect(0, 0, ops.width, ops.height);
    const dialog = this.dialogRect();
    ops.drawFrame(this.context, this.assets.captionFrame, this.assets.frame.image, dialog);
    const caption = ops.captionRect(this.assets.captionFrame, dialog,
      this.assets.captionOffset);
    ops.drawText(this.context, ops.string(this.assets.strings, "menu"), caption, {
      family: ops.fontFamily, size: 20, kind: "button", color: "white",
      align: "center", verticalAlign: "center",
    });
    this.hits = ops.buttonHits(this.assets, dialog);
    this.drawButton("retry", this.assets.retry);
    this.drawButton("menu", this.assets.menu);
    this.drawButton("resume", this.assets.close);
    this.canvas.style.cursor = this.hovered === undefined ? "default" : "pointer";
  }

  drawButton(action: PauseAction, images: unknown[]): void {
    const hit = this.hits.find(candidate => candidate.action === action);
    if (!hit) throw new Error(`P3528 pause button ${action} 缺少布局。`);
    const state = this.dependencies.buttonState(action, this.hovered, this.pressed);
    this.dependencies.drawButton(this.context, images[state]!, hit.rect);
  }

  resizeCanvas(): void {
    const rect = this.options.root.getBoundingClientRect();
    const ops = this.dependencies;
    ops.resizeCanvas(this.canvas, this.context, rect.width, rect.height,
      ops.pixelRatio(), ops.width, ops.height, 1600, 900);
  }

  dialogRect(): PauseHit["rect"] {
    return this.dependencies.dialogRect(this.assets);
  }

  hitAt(event: PointerEvent): PauseHit | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * this.dependencies.width) / rect.width;
    const y = ((event.clientY - rect.top) * this.dependencies.height) / rect.height;
    return this.hits.find(hit => this.dependencies.contains(x, y, hit.rect));
  }

  onPointerMove = (event: PointerEvent): void => {
    const action = this.hitAt(event)?.action;
    if (action === this.hovered) return;
    this.hovered = action;
    if (action !== undefined) this.options.onHover?.();
    this.render();
  };

  onPointerDown = (event: PointerEvent): void => {
    const hit = this.hitAt(event);
    if (!hit || event.button !== 0) return;
    this.options.onInteraction?.();
    this.hovered = hit.action;
    this.pressed = hit.action;
    this.canvas.setPointerCapture(event.pointerId);
    this.render();
  };

  onPointerUp = (event: PointerEvent): void => {
    const hit = this.hitAt(event);
    const action = hit && hit.action === this.pressed ? hit.action : undefined;
    this.pressed = undefined;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (action !== undefined) this.options.onActivate?.();
    if (action === "resume") this.options.onResume();
    else if (action === "retry") this.options.onRetry();
    else if (action === "menu") this.options.onMenu();
    else this.render();
  };

  onPointerCancel = (event: PointerEvent): void => {
    this.pressed = undefined;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    this.render();
  };

  onPointerLeave = (): void => {
    this.hovered = undefined;
    this.render();
  };
}
