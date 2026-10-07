import {
  RIDER_CONFIRM_TEXT, RIDER_FONT, RIDER_GRID_COLUMNS,
  RIDER_GRID_PAGE_SIZE, RIDER_VIEW_HEIGHT, RIDER_VIEW_WIDTH,
  loadRiderImages, normalizeRiderName, riderFrame, riderImagePaths,
  riderLayout,
  type RiderAssetDependencies, type RiderBlueprint,
  type RiderRect, type RiderResourceLibrary,
} from "./first-rider-assets";

export interface RiderChoice {
  itemId: number;
  title: string;
}

export interface RiderChoiceCatalog {
  characters: RiderChoice[];
  paints: RiderChoice[];
  dyes: RiderChoice[];
  defaults: { character: number; dye: number; paint: number };
}

export interface RiderPreviewContext {
  library: unknown;
  environment: unknown;
  stageBinding: unknown;
  kartItem: unknown;
  characterItems: RiderChoice[];
  profile: {
    equipment: { itemIds: Record<number, number>; [key: string]: unknown };
    [key: string]: unknown;
  };
}

export interface RiderPreviewPanel {
  setPixelRatio(ratio: number): void;
  setSubject(options: {
    library: unknown;
    environment: unknown;
    stageBinding: unknown;
    subject: unknown;
  }): Promise<void>;
  render(context: CanvasRenderingContext2D, rect: RiderRect,
    timeMs: number): void;
  dispose(): void;
}

export interface FirstRiderDialogDependencies extends RiderAssetDependencies {
  pixelRatio(): number;
  resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    width: number, height: number, pixelRatio: number,
    virtualWidth: number, virtualHeight: number): void;
  drawFrame(context: CanvasRenderingContext2D, frame: unknown,
    image: CanvasImageSource | undefined, rect: RiderRect): void;
  drawText(context: CanvasRenderingContext2D, text: string,
    rect: RiderRect, options: Record<string, unknown>): void;
  positionInput(input: HTMLInputElement, rect: RiderRect,
    scaleX: number, scaleY: number): void;
  contains(x: number, y: number, rect: RiderRect): boolean;
  createPreview(width: number, height: number): RiderPreviewPanel;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
  now(): number;
}

type GridCell = { rect: RiderRect; section: number; choice: RiderChoice };
type PageControl = { rect: RiderRect; section: number; forward: boolean };
type RiderHit = GridCell | PageControl;

export interface RiderRegistration {
  name: string;
  characterItemId: number;
  paintItemId: number;
  dyeItemId: number;
}

/** Two-step rider registration dialog driven by the original BML layout. */
export class FirstRiderDialog {
  readonly element = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  readonly context: CanvasRenderingContext2D;
  readonly input = document.createElement("input");
  readonly step1Button = document.createElement("button");
  readonly step2Button = document.createElement("button");
  readonly choices: RiderChoiceCatalog;
  readonly picked: number[];
  pages = [0, 0, 0];
  cellHits: RiderHit[] = [];
  step = 1;
  name = "";
  isOpen_ = false;
  pending?: Promise<RiderRegistration>;
  resolvePending?: (registration: RiderRegistration) => void;
  disposed = false;
  hovered?: HTMLButtonElement;
  pressed?: HTMLButtonElement;
  hoveredCell?: { section: number; itemId: number };
  previewPanel?: RiderPreviewPanel;
  raf = 0;

  constructor(
    readonly root: HTMLElement,
    readonly blueprint: RiderBlueprint,
    readonly images: Map<string, CanvasImageSource & { close(): void }>,
    catalog: RiderChoiceCatalog,
    readonly previewContext: RiderPreviewContext | undefined,
    readonly dependencies: FirstRiderDialogDependencies,
  ) {
    const filterChoices = (items: RiderChoice[], ids: number[]) =>
      ids.map(id => items.find(item => item.itemId === id))
        .filter((item): item is RiderChoice => item !== undefined);
    this.choices = {
      characters: filterChoices(catalog.characters,
        blueprint.itemWhitelist.characters),
      paints: filterChoices(catalog.paints, blueprint.itemWhitelist.paints),
      dyes: filterChoices(catalog.dyes, blueprint.itemWhitelist.dyes),
      defaults: catalog.defaults,
    };
    const availableChoice = (section: number, id: number) =>
      this.choicesOf(section).some(item => item.itemId === id)
        ? id : (this.choicesOf(section)[0]?.itemId ?? id);
    this.picked = [
      availableChoice(0, catalog.defaults.character),
      availableChoice(1, catalog.defaults.dye),
      availableChoice(2, catalog.defaults.paint),
    ];
    this.element.className = "new-rider-dialog";
    this.element.hidden = true;
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", blueprint.texts.caption);
    this.canvas.className = "new-rider-dialog-canvas";
    this.canvas.width = RIDER_VIEW_WIDTH;
    this.canvas.height = RIDER_VIEW_HEIGHT;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("车手注册画布不可用。");
    this.context = context;
    context.imageSmoothingEnabled = true;
    this.input.type = "text";
    this.input.className = "window-edit";
    this.input.maxLength = blueprint.maxChar;
    this.input.spellcheck = false;
    this.input.autocomplete = "off";
    Object.assign(this.input.style, {
      color: "rgb(42, 55, 80)",
      font: `14px "${RIDER_FONT}"`,
      textAlign: "center",
    });
    this.input.setAttribute("aria-label", blueprint.texts.inputPrompt);
    for (const button of [this.step1Button, this.step2Button]) {
      button.type = "button";
      button.className = "new-rider-hit";
      button.addEventListener("pointerenter", () => {
        this.hovered = button;
        this.paint();
      });
      button.addEventListener("pointerleave", () => {
        if (this.hovered === button) this.hovered = undefined;
        if (this.pressed === button) this.pressed = undefined;
        this.paint();
      });
      button.addEventListener("pointerdown", () => {
        this.pressed = button;
        this.paint();
      });
      button.addEventListener("pointerup", () => {
        if (this.pressed === button) this.pressed = undefined;
        this.paint();
      });
    }
    this.step1Button.addEventListener("click", () => this.submitStep1());
    this.step2Button.addEventListener("click", () => this.settle());
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerDown);
    this.canvas.addEventListener("pointermove", this.onCanvasPointerMove);
    this.canvas.addEventListener("pointerleave", this.onCanvasPointerLeave);
    this.element.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        if (this.step === 1) this.submitStep1();
        else this.settle();
      }
    });
    this.element.append(this.canvas, this.input,
      this.step1Button, this.step2Button);
    root.append(this.element);
    window.addEventListener("resize", this.onResize);
  }

  static async load(
    library: RiderResourceLibrary,
    root: HTMLElement, catalog: RiderChoiceCatalog,
    previewContext: RiderPreviewContext | undefined,
    dependencies: FirstRiderDialogDependencies,
  ): Promise<FirstRiderDialog> {
    const { blueprint, images } = await loadRiderImages(library, dependencies);
    return new FirstRiderDialog(root, blueprint, images, catalog,
      previewContext, dependencies);
  }

  get isOpen(): boolean { return this.isOpen_; }

  onResize = (): void => { this.paint(); };
  onFrame = (): void => {
    if (!this.isOpen_) {
      this.raf = 0;
      return;
    }
    this.paint();
    if (this.raf) this.raf = this.dependencies.requestFrame(this.onFrame);
  };

  open(): Promise<RiderRegistration> {
    if (this.disposed)
      return Promise.reject(new Error("车手注册窗口已释放。"));
    if (this.isOpen_)
      return this.pending ?? Promise.reject(new Error("车手注册窗口未就绪。"));
    this.step = 1;
    this.name = "";
    this.input.value = "";
    this.isOpen_ = true;
    this.element.hidden = false;
    this.ensurePreview();
    this.startAnimation();
    this.paint();
    this.input.focus();
    this.pending = new Promise(resolve => { this.resolvePending = resolve; });
    return this.pending;
  }

  submitStep1(): void {
    const name = normalizeRiderName(this.input.value, this.blueprint.maxChar);
    if (!name) return;
    this.name = name;
    this.step = 2;
    this.input.blur();
    this.paint();
    this.step2Button.focus();
  }

  ensurePreview(): void {
    const previewContext = this.previewContext;
    if (!previewContext || this.previewPanel) return;
    const subject = this.previewSubject();
    if (!subject) return;
    const { preview } = riderLayout(this.blueprint, this.dependencies);
    const panel = this.dependencies.createPreview(preview.width, preview.height);
    this.previewPanel = panel;
    panel.setPixelRatio(this.dependencies.pixelRatio());
    void panel.setSubject({
      library: previewContext.library,
      environment: previewContext.environment,
      stageBinding: previewContext.stageBinding,
      subject,
    });
  }

  previewSubject(): unknown | undefined {
    const context = this.previewContext;
    if (!context) return;
    const character = context.characterItems.find(item =>
      item.itemId === this.picked[0]);
    if (!character) return;
    const profile = context.profile;
    return {
      kartItem: context.kartItem,
      characterItem: character,
      profile: {
        ...profile,
        equipment: {
          ...profile.equipment,
          itemIds: {
            ...profile.equipment.itemIds,
            1: this.picked[0],
            2: this.picked[2],
            70: this.picked[1],
          },
        },
      },
    };
  }

  updatePreviewSubject(): void {
    const panel = this.previewPanel;
    const context = this.previewContext;
    if (!panel || !context) return;
    const subject = this.previewSubject();
    if (subject) void panel.setSubject({
      library: context.library,
      environment: context.environment,
      stageBinding: context.stageBinding,
      subject,
    });
  }

  startAnimation(): void {
    if (!this.raf)
      this.raf = this.dependencies.requestFrame(this.onFrame);
  }

  settle(): void {
    if (!this.isOpen_ || !this.name) return;
    this.isOpen_ = false;
    this.element.hidden = true;
    const registration = {
      name: this.name,
      characterItemId: this.picked[0]!,
      paintItemId: this.picked[2]!,
      dyeItemId: this.picked[1]!,
    };
    const resolve = this.resolvePending;
    this.resolvePending = undefined;
    this.pending = undefined;
    resolve?.(registration);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.isOpen_ = false;
    if (this.raf) this.dependencies.cancelFrame(this.raf);
    this.raf = 0;
    this.previewPanel?.dispose();
    this.previewPanel = undefined;
    window.removeEventListener("resize", this.onResize);
    this.element.remove();
  }

  onCanvasPointerDown = (event: PointerEvent): void => {
    if (this.step !== 1) return;
    const [x, y] = this.canvasPoint(event);
    for (const hit of this.cellHits) {
      if (!this.dependencies.contains(x, y, hit.rect)) continue;
      if ("choice" in hit) {
        this.picked[hit.section] = hit.choice.itemId;
      } else {
        const count = this.choicesOf(hit.section).length;
        const pages = Math.max(1, Math.ceil(count / RIDER_GRID_PAGE_SIZE));
        this.pages[hit.section] =
          ((this.pages[hit.section] ?? 0) + (hit.forward ? 1 : pages - 1)) % pages;
      }
      this.updatePreviewSubject();
      this.paint();
      return;
    }
  };

  onCanvasPointerMove = (event: PointerEvent): void => {
    if (this.step !== 1) return;
    const [x, y] = this.canvasPoint(event);
    const hit = this.cellAt(x, y);
    const hovered = hit
      ? { section: hit.section, itemId: hit.choice.itemId } : undefined;
    if (hovered?.section === this.hoveredCell?.section &&
        hovered?.itemId === this.hoveredCell?.itemId) return;
    this.hoveredCell = hovered;
    this.paint();
  };

  onCanvasPointerLeave = (): void => {
    if (!this.hoveredCell) return;
    this.hoveredCell = undefined;
    this.paint();
  };

  canvasPoint(event: PointerEvent): [number, number] {
    const bounds = this.canvas.getBoundingClientRect();
    return [
      ((event.clientX - bounds.left) * RIDER_VIEW_WIDTH) / bounds.width,
      ((event.clientY - bounds.top) * RIDER_VIEW_HEIGHT) / bounds.height,
    ];
  }

  cellAt(x: number, y: number): GridCell | undefined {
    for (const hit of this.cellHits) {
      if ("choice" in hit && this.dependencies.contains(x, y, hit.rect))
        return hit;
    }
  }

  choicesOf(section: number): RiderChoice[] {
    return section === 0 ? this.choices.characters
      : section === 1 ? this.choices.dyes : this.choices.paints;
  }

  paint(timeMs = this.dependencies.now()): void {
    if (!this.isOpen_) return;
    const ops = this.dependencies;
    const layout = riderLayout(this.blueprint, ops);
    const bounds = this.canvas.getBoundingClientRect();
    const scaleX = bounds.width / RIDER_VIEW_WIDTH;
    const scaleY = bounds.height / RIDER_VIEW_HEIGHT;
    ops.resizeCanvas(this.canvas, this.context, bounds.width, bounds.height,
      ops.pixelRatio(), RIDER_VIEW_WIDTH, RIDER_VIEW_HEIGHT);
    this.context.imageSmoothingEnabled = true;
    this.context.clearRect(0, 0, RIDER_VIEW_WIDTH, RIDER_VIEW_HEIGHT);
    const frameName = ops.attribute(this.blueprint.dialog, "frame")!;
    const captionFrame = riderFrame(this.blueprint, frameName, "Activated");
    const frameImage = (frame: { texture: string }) =>
      this.images.get(`gui_/monocoque/${frame.texture}.png`);
    ops.drawFrame(this.context, captionFrame,
      frameImage(captionFrame), layout.window);
    this.context.drawImage(this.images.get(riderImagePaths.background)!,
      layout.bg.x, layout.bg.y, layout.bg.width, layout.bg.height);
    this.previewPanel?.setPixelRatio(ops.pixelRatio());
    this.previewPanel?.render(this.context, layout.preview, timeMs);
    ops.drawText(this.context, this.blueprint.texts.caption, layout.captionText, {
      family: RIDER_FONT, size: 20, color: "white", kind: "button",
      align: "center", verticalAlign: "center",
    });
    if (this.step === 1) {
      this.context.drawImage(this.images.get(riderImagePaths.info)!,
        layout.infoIcon.x, layout.infoIcon.y,
        layout.infoIcon.width, layout.infoIcon.height);
      ops.drawText(this.context, this.blueprint.texts.warningTitle,
        layout.warningTitle, {
          family: RIDER_FONT, size: 16, color: "white", kind: "label",
          align: "left", verticalAlign: "top",
        });
      this.blueprint.texts.warningDetails.forEach((text, index) => {
        ops.drawText(this.context, text,
          layout.warningDetails[index] ?? layout.warningTitle, {
            family: RIDER_FONT, size: 14, color: "rgb(255, 69, 69)",
            kind: "label", align: "left", verticalAlign: "top",
          });
      });
      layout.sectionLabels.forEach((rect, index) => {
        if (this.choicesOf(index).length === 0) return;
        const iconRect = layout.sectionIcons[index]!;
        this.context.drawImage(this.images.get(
          riderImagePaths.sectionIcons[index]!)!,
          iconRect.x, iconRect.y, iconRect.width, iconRect.height);
        ops.drawText(this.context, this.blueprint.texts.sectionLabels[index]!,
          rect, {
            family: RIDER_FONT, size: 16, color: "rgb(187, 198, 215)",
            kind: "label", align: "left", verticalAlign: "top",
          });
      });
      const hits: RiderHit[] = [];
      [0, 1, 2].forEach(section => {
        this.paintGrid(section, layout.grids[section]!, hits);
      });
      this.cellHits = hits;
      ops.drawText(this.context, this.blueprint.texts.inputPrompt,
        layout.inputPrompt, {
          family: RIDER_FONT, size: 16, color: "white", stroke: 1,
          strokeColor: "rgb(42, 55, 80)", kind: "label",
          align: "center", verticalAlign: "center",
        });
      const editFrame = riderFrame(this.blueprint,
        ops.attribute(this.blueprint.edit, "frame") ?? "DefaultEdit",
        "Activated");
      ops.drawFrame(this.context, editFrame,
        frameImage(editFrame), layout.edit);
      ops.positionInput(this.input, layout.edit, scaleX, scaleY);
      this.input.hidden = false;
      this.paintButton(this.step1Button, this.blueprint.texts.nextStep,
        layout.step1Button);
      this.positionHit(this.step2Button);
    } else {
      this.input.hidden = true;
      ops.drawText(this.context, this.blueprint.texts.trainee,
        layout.trainee, {
          family: RIDER_FONT, size: 14, color: "rgb(221, 232, 255)",
          kind: "label", align: "center", verticalAlign: "top",
        });
      ops.drawText(this.context, this.name, layout.riderId, {
        family: RIDER_FONT, size: 20, color: "white", kind: "label",
        align: "center", verticalAlign: "top",
      });
      this.paintButton(this.step2Button, RIDER_CONFIRM_TEXT,
        layout.step2Button);
      this.positionHit(this.step1Button);
    }
  }

  paintGrid(section: number, rect: RiderRect, hits: RiderHit[]): void {
    const assetPrefix = section === 0 ? "1" : "2";
    const choices = this.choicesOf(section);
    const pageCount = Math.max(1,
      Math.ceil(choices.length / RIDER_GRID_PAGE_SIZE));
    const page = Math.min(this.pages[section] ?? 0, pageCount - 1);
    this.pages[section] = page;
    const gap = 10;
    const x = rect.x + 6;
    const y = rect.y + 4;
    const cellSize = section === 0 ? 52 : 38;
    choices.slice(page * RIDER_GRID_PAGE_SIZE,
      page * RIDER_GRID_PAGE_SIZE + RIDER_GRID_PAGE_SIZE)
      .forEach((choice, index) => {
        const cell = {
          x: x + (index % RIDER_GRID_COLUMNS) * (cellSize + gap),
          y: y + Math.floor(index / RIDER_GRID_COLUMNS) * (cellSize + gap),
          width: cellSize, height: cellSize,
        };
        const picked = this.picked[section] === choice.itemId;
        const hovered = this.hoveredCell?.section === section &&
          this.hoveredCell?.itemId === choice.itemId;
        const state = picked && hovered ? 4 : picked ? 3 : hovered ? 2 : 1;
        const image = this.images.get(
          `stage_/newRider/${assetPrefix}_${choice.itemId}_${state}.png`)
          ?? this.images.get(
            `stage_/newRider/${assetPrefix}_${choice.itemId}_1.png`);
        if (image) this.context.drawImage(image, cell.x, cell.y);
        else this.dependencies.drawText(this.context, choice.title, {
          x: cell.x + 4, y: cell.y + 4,
          width: cell.width - 8, height: cell.height - 8,
        }, {
          family: RIDER_FONT, size: 12,
          color: picked ? "white" : "rgb(146, 158, 178)",
          kind: "label", align: "center", verticalAlign: "center",
        });
        hits.push({ rect: cell, section, choice });
      });
    if (pageCount <= 1) return;
    const up = riderFrame(this.blueprint, "DefaultScrollUpButton", "Normal");
    const down = riderFrame(this.blueprint,
      "DefaultScrollDownButton", "Normal");
    const pageControls = [
      { x: rect.x + rect.width - 44, y: rect.y + rect.height - 20,
        width: 20, height: 20 },
      { x: rect.x + rect.width - 22, y: rect.y + rect.height - 20,
        width: 20, height: 20 },
    ];
    this.dependencies.drawFrame(this.context, up,
      this.images.get(`gui_/monocoque/${up.texture}.png`), pageControls[0]!);
    this.dependencies.drawFrame(this.context, down,
      this.images.get(`gui_/monocoque/${down.texture}.png`), pageControls[1]!);
    hits.push({ rect: pageControls[0]!, section, forward: false });
    hits.push({ rect: pageControls[1]!, section, forward: true });
  }

  paintButton(button: HTMLButtonElement, text: string, rect: RiderRect): void {
    const hovered = this.hovered === button || button.matches(":hover");
    const state = this.pressed === button ? "Clicked"
      : hovered ? "MouseOn" : "Normal";
    const frame = riderFrame(this.blueprint, "DefaultFocusedButton", state);
    this.dependencies.drawFrame(this.context, frame,
      this.images.get(`gui_/monocoque/${frame.texture}.png`), rect);
    this.dependencies.drawText(this.context, text,
      this.dependencies.frameInset(frame, rect), {
        family: RIDER_FONT, size: 16, color: "white", kind: "button",
        align: "center", verticalAlign: "center",
      });
    this.positionHit(button, rect);
  }

  positionHit(button: HTMLButtonElement, rect?: RiderRect): void {
    if (!rect) {
      button.style.display = "none";
      return;
    }
    button.style.display = "block";
    const bounds = this.canvas.getBoundingClientRect();
    const scaleX = bounds.width / RIDER_VIEW_WIDTH;
    const scaleY = bounds.height / RIDER_VIEW_HEIGHT;
    Object.assign(button.style, {
      left: `${rect.x * scaleX}px`,
      top: `${rect.y * scaleY}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      transformOrigin: "top left",
      transform: `scale(${scaleX}, ${scaleY})`,
    });
  }
}
