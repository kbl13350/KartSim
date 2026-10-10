/** The authored garage confirmation window, including canvas art and focus behavior. */

export interface ConfirmationRectangle {
  x: number; y: number; width: number; height: number;
}

export interface GarageConfirmationRequest {
  title: string;
  message: string;
  affirmative: string;
  negative: string;
  warning: boolean;
  singleAction?: boolean;
}

export interface GarageConfirmationBlueprint {
  nodes: { dialog: unknown; divider: unknown };
  frames: Map<string, Map<string, any>>;
  config: unknown;
  strings: Map<string, string>;
  warningPath: string;
}

export interface GarageConfirmationDependencies {
  loadFont(library: unknown): Promise<unknown>;
  loadAssets(library: unknown): Promise<{
    blueprint: GarageConfirmationBlueprint;
    images: Map<string, any>;
  }>;
  releaseFont(font: unknown): void;
  partEquipRequest(strings: Map<string, string>, partName: string): GarageConfirmationRequest;
  layout(blueprint: GarageConfirmationBlueprint, lineCount: number,
    size: { width: number; height: number },
    request: GarageConfirmationRequest): {
      window: ConfirmationRectangle; icon: ConfirmationRectangle;
      message: ConfirmationRectangle; divider: ConfirmationRectangle;
      affirmative: ConfirmationRectangle; negative: ConfirmationRectangle;
    };
  attribute(node: unknown, name: string): string | undefined;
  resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    width: number, height: number, ratio: number,
    logicalWidth: number, logicalHeight: number): void;
  pixelRatio(): number;
  paintFrame(context: CanvasRenderingContext2D, frame: any,
    image: unknown, rectangle: ConfirmationRectangle): void;
  drawText(context: CanvasRenderingContext2D, value: string,
    rectangle: ConfirmationRectangle, style: Record<string, unknown>): void;
  captionOffset(node: unknown, config: unknown): unknown;
  captionRectangle(frame: any, rectangle: ConfirmationRectangle,
    offset: unknown): ConfirmationRectangle;
  innerRectangle(frame: any, rectangle: ConfirmationRectangle): ConfirmationRectangle;
  fontFamily: string;
}

/** One outstanding action can be accepted or cancelled exactly once. */
export class GarageConfirmationAction {
  action?: () => void;

  get pending(): boolean { return Boolean(this.action); }
  open(action: () => void): boolean {
    if (this.action) return false;
    this.action = action;
    return true;
  }
  settle(accepted: boolean): void {
    const action = this.action;
    this.action = undefined;
    if (accepted) action?.();
  }
}

function bindCancelClick(button: HTMLButtonElement, cancel: () => void): void {
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    cancel();
  });
}

function bindPointerState(button: HTMLButtonElement, events: {
  enter(): void; leave(): void; down(): void; up(): void;
}): void {
  button.addEventListener("pointerenter", events.enter);
  button.addEventListener("pointerleave", events.leave);
  button.addEventListener("pointerdown", events.down);
  button.addEventListener("pointerup", events.up);
}

export class GarageConfirmationDialog {
  readonly element = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  readonly yes = document.createElement("button");
  readonly no = document.createElement("button");
  readonly state = new GarageConfirmationAction();
  readonly onResize = () => this.paint();
  readonly context: CanvasRenderingContext2D;
  request?: GarageConfirmationRequest;
  previousFocus?: HTMLElement;
  hovered?: HTMLButtonElement;
  pressed?: HTMLButtonElement;
  disposed = false;

  constructor(root: HTMLElement, readonly onVisibility: (visible: boolean) => void,
    readonly blueprint: GarageConfirmationBlueprint,
    readonly images: Map<string, any>, readonly font: unknown,
    readonly dependencies: GarageConfirmationDependencies) {
    this.element.className = "garage-confirmation";
    this.element.hidden = true;
    this.element.setAttribute("role", "alertdialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", "确认车库操作");
    this.canvas.className = "garage-confirmation-canvas";
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.width = 1600;
    this.canvas.height = 900;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("确认窗口画布不可用。");
    this.context = context;
    context.imageSmoothingEnabled = true;
    this.yes.type = this.no.type = "button";
    this.yes.className = this.no.className = "garage-confirmation-hit";
    this.yes.onclick = () => this.settle(true);
    bindCancelClick(this.no, () => this.settle(false));
    this.no.hidden = true;
    for (const button of [this.yes, this.no]) {
      bindPointerState(button, {
        enter: () => { this.hovered = button; this.paint(); },
        leave: () => {
          if (this.hovered === button) this.hovered = undefined;
          if (this.pressed === button) this.pressed = undefined;
          this.paint();
        },
        down: () => { this.pressed = button; this.paint(); },
        up: () => {
          if (this.pressed === button) this.pressed = undefined;
          this.paint();
        },
      });
      button.onfocus = () => this.paint();
      button.onblur = () => this.paint();
    }
    this.element.append(this.canvas, this.yes, this.no);
    root.append(this.element);
    window.addEventListener("resize", this.onResize);
    this.element.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.settle(false);
      }
      if (event.key === "Tab") {
        event.preventDefault();
        (this.request?.singleAction ? this.yes :
          document.activeElement === this.no ? this.yes : this.no).focus();
      }
    });
  }

  static async load<Dialog extends GarageConfirmationDialog>(library: unknown,
    root: HTMLElement, onVisibility: (visible: boolean) => void,
    dependencies: GarageConfirmationDependencies,
    create: (root: HTMLElement, onVisibility: (visible: boolean) => void,
      blueprint: GarageConfirmationBlueprint, images: Map<string, any>,
      font: unknown) => Dialog): Promise<Dialog> {
    const font = await dependencies.loadFont(library);
    try {
      const { blueprint, images } = await dependencies.loadAssets(library);
      return create(root, onVisibility, blueprint, images, font);
    } catch (error) {
      dependencies.releaseFont(font);
      throw error;
    }
  }

  get pending(): boolean { return this.state.pending; }
  resizeCanvases(): void { this.paint(); }

  open(message: string | GarageConfirmationRequest,
    action: () => void, options: { singleAction?: boolean } = {}): void {
    if (this.disposed || !this.state.open(action)) return;
    this.previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : undefined;
    const request = typeof message === "string" ? {
      title: options.singleAction ? "提示" : "确认",
      message,
      affirmative: options.singleAction ? "确认" : "确定",
      negative: options.singleAction ? "" : "取消",
      warning: !options.singleAction,
    } : message;
    this.request = options.singleAction && !request.singleAction
      ? { ...request, singleAction: true } : request;
    this.yes.textContent = this.request.affirmative;
    this.no.textContent = this.request.negative;
    this.no.hidden = !this.request.singleAction;
    this.element.setAttribute("aria-label", this.request.title);
    this.element.hidden = false;
    this.onVisibility(true);
    this.yes.focus();
    this.paint();
  }

  openNotice(message: string | GarageConfirmationRequest): void {
    this.open(message, () => {}, { singleAction: true });
  }

  openPartEquip(partName: string, action: () => void): void {
    this.open(this.dependencies.partEquipRequest(this.blueprint.strings, partName), action);
  }

  paint(): void {
    const request = this.request;
    if (!request || this.element.hidden) return;
    const lines = request.message.split("\n");
    const layout = this.dependencies.layout(this.blueprint, lines.length,
      { width: 1600, height: 900 }, request);
    const frame = (name: string, state: string) => this.blueprint.frames.get(name)!.get(state)!;
    const image = (entry: { texture: string }) =>
      this.images.get(`gui_/monocoque/${entry.texture}.png`);
    const bounds = this.canvas.getBoundingClientRect();
    this.dependencies.resizeCanvas(this.canvas, this.context, bounds.width,
      bounds.height, this.dependencies.pixelRatio(), 1600, 900);
    this.context.imageSmoothingEnabled = true;
    this.context.clearRect(0, 0, 1600, 900);
    const dialogFrame = frame(this.dependencies.attribute(this.blueprint.nodes.dialog,
      "frame")!, "Activated");
    this.dependencies.paintFrame(this.context, dialogFrame, image(dialogFrame), layout.window);
    const caption = this.dependencies.captionOffset(this.blueprint.nodes.dialog,
      this.blueprint.config);
    this.dependencies.drawText(this.context, request.title,
      this.dependencies.captionRectangle(dialogFrame, layout.window, caption), {
        family: this.dependencies.fontFamily, size: 20, color: "white",
        kind: "button", align: "center", verticalAlign: "center",
      });
    if (request.warning) this.context.drawImage(
      this.images.get(this.blueprint.warningPath), layout.icon.x, layout.icon.y,
      layout.icon.width, layout.icon.height);
    lines.forEach((line, index) => this.dependencies.drawText(this.context, line,
      { ...layout.message, y: layout.message.y + index * 23 }, {
        family: this.dependencies.fontFamily, size: 16,
        color: "rgb(42, 55, 80)", kind: "label",
        align: "center", verticalAlign: "top",
      }));
    const dividerFrame = frame(this.dependencies.attribute(this.blueprint.nodes.divider,
      "frame")!, "Normal");
    this.dependencies.paintFrame(this.context, dividerFrame,
      image(dividerFrame), layout.divider);
    this.paintButton(this.yes, request.affirmative, layout.affirmative,
      Boolean(request.singleAction));
    if (!request.singleAction) this.paintButton(this.no, request.negative, layout.negative);
    this.positionButton(this.yes, layout.affirmative);
    if (!request.singleAction) this.positionButton(this.no, layout.negative);
  }

  paintButton(button: HTMLButtonElement, label: string,
    rectangle: ConfirmationRectangle, defaultFocused = false): void {
    const focused = document.activeElement === button;
    const frameName = focused || defaultFocused ? "DefaultFocusedButton" : "TextButton";
    const hovered = this.hovered === button || button.matches(":hover");
    const state = this.pressed === button ? "Clicked" : hovered ? "MouseOn" : "Normal";
    const frame = this.blueprint.frames.get(frameName)!.get(state)!;
    const image = this.images.get(`gui_/monocoque/${frame.texture}.png`);
    this.dependencies.paintFrame(this.context, frame, image, rectangle);
    this.dependencies.drawText(this.context, label,
      this.dependencies.innerRectangle(frame, rectangle), {
        family: this.dependencies.fontFamily, size: 16,
        color: focused || defaultFocused ? "white" : state === "Clicked"
          ? "rgb(35, 41, 52)" : state === "MouseOn"
            ? "rgb(106, 120, 147)" : "rgb(64, 75, 95)",
        kind: "button", align: "center", verticalAlign: "center",
      });
  }

  positionButton(button: HTMLButtonElement, rect: ConfirmationRectangle): void {
    Object.assign(button.style, {
      left: `${rect.x}px`, top: `${rect.y}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
    });
  }

  settle(accepted: boolean): void {
    if (!this.pending) return;
    this.element.hidden = true;
    this.onVisibility(false);
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = undefined;
    this.request = undefined;
    this.hovered = undefined;
    this.pressed = undefined;
    this.no.hidden = true;
    this.state.settle(accepted);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("resize", this.onResize);
    this.state.settle(false);
    this.onVisibility(false);
    this.element.remove();
    this.dependencies.releaseFont(this.font);
  }
}
