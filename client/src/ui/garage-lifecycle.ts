/** Construction and teardown for the garage view. The factories keep release assets outside this module. */
export interface GarageLoadOptions {
  library: unknown;
  environment: unknown;
  stageBinding: unknown;
  stageWidth?: number;
}

export interface GarageFactoryPanel {
  element: { hidden: boolean; inert?: boolean };
  showsCatalog?: boolean;
  resizeCanvases(): void;
}

export interface GarageLoadHost {
  surface: { append(child: unknown): void };
  controls: { inert: boolean };
  progressionPanel: { element: { inert: boolean } };
  previewRect: { width: number; height: number };
  pageMode: string;
  factoryPanel?: GarageFactoryPanel;
  confirmation?: unknown;
  panels?: { setParticleModificationPageVisible(visible: boolean): void };
  setFactory(value: unknown): unknown;
  updateControls(): void;
  showFactoryTutorial(): void;
  dispose(): void;
}

export interface GarageLoadDependencies<Host extends GarageLoadHost = GarageLoadHost> {
  defaultStageWidth: number;
  normalizeStage(width: number): { width: number };
  loadAssets(library: unknown, width: number): Promise<unknown>;
  loadPreviews(options: GarageLoadOptions): Promise<unknown>;
  loadLayout(library: unknown, name: string, width: number): Promise<unknown>;
  createView(options: GarageLoadOptions, assets: unknown, tuning: unknown, previews: unknown): Host;
  createFactoryPanel(
    layout: unknown,
    setFactory: (value: unknown) => unknown,
    confirm: (message: unknown, accept: unknown, cancel: unknown) => unknown,
    update: () => void,
    tutorial: () => void,
  ): GarageFactoryPanel;
  loadConfirmation(
    library: unknown,
    surface: Host["surface"],
    setInert: (inert: boolean) => void,
  ): Promise<Host["confirmation"]>;
  loadPanels(
    library: unknown,
    environment: unknown,
    stageBinding: unknown,
    onEvent: () => void,
    vehicleRect: { x: number; y: number; width: number; height: number },
    previewRect: Host["previewRect"],
    previewSize: unknown,
    mode: "kart-only",
  ): Promise<NonNullable<Host["panels"]>>;
  previewSize(width: number, height: number): unknown;
}

/** Load in release order: assets and previews in parallel, then garage, factory, dialogs, and panels. */
export async function loadGarageView<Host extends GarageLoadHost>(
  options: GarageLoadOptions,
  dependencies: GarageLoadDependencies<Host>,
): Promise<Host> {
  const stage = dependencies.normalizeStage(options.stageWidth ?? dependencies.defaultStageWidth);
  const [assets, previews] = await Promise.all([
    dependencies.loadAssets(options.library, stage.width),
    dependencies.loadPreviews(options),
  ]);
  const tuning = await dependencies.loadLayout(options.library, "kartune", stage.width);
  const view = dependencies.createView(options, assets, tuning, previews);
  try {
    const factoryLayout = await dependencies.loadLayout(options.library, "tuning", stage.width);
    view.factoryPanel = dependencies.createFactoryPanel(
      factoryLayout,
      value => view.setFactory(value),
      (message, accept, cancel) => (view.confirmation as {
        open?: (message: unknown, accept: unknown, cancel: unknown) => unknown;
      } | undefined)?.open?.(message, accept, cancel),
      () => view.updateControls(),
      () => view.showFactoryTutorial(),
    );
    view.factoryPanel.element.hidden = true;
    view.surface.append(view.factoryPanel.element);
    view.confirmation = await dependencies.loadConfirmation(options.library, view.surface, inert => {
      view.controls.inert = inert;
      view.progressionPanel.element.inert = inert;
      if (view.factoryPanel) view.factoryPanel.element.inert = inert;
    });
    view.panels = await dependencies.loadPanels(
      options.library,
      options.environment,
      options.stageBinding,
      () => {},
      { x: 0, y: 0, width: 137, height: 94 },
      view.previewRect,
      dependencies.previewSize(view.previewRect.width, view.previewRect.height),
      "kart-only",
    );
    view.panels.setParticleModificationPageVisible(view.pageMode === "factory");
    return view;
  } catch (error) {
    view.dispose();
    throw error;
  }
}

export interface GarageLifecycleHost {
  disposed: boolean;
  shown: boolean;
  frozen: boolean;
  frozenSnapshot?: unknown;
  strengtheningSnapshot?: unknown;
  element: { hidden: boolean; inert: boolean; style: { pointerEvents: string }; remove(): void };
  search: { focus(): void };
  options: {
    taskbar?: { composite(view: GarageLifecycleHost, paint: () => void): () => void };
  };
  releaseTaskbar?: () => void;
  raf: number;
  inventoryHitTestFrame: number;
  onKey: EventListener;
  onWindowResize: EventListener;
  interactionAudioCleanup?: () => void;
  tutorialClose?: () => void;
  preparation?: { dispose(): void };
  exceedTypeChange?: { dispose(): void };
  resize?: { disconnect(): void };
  panels?: { dispose(): void };
  confirmation?: { dispose(): void };
  upgrade?: { dispose(): void };
  skillSelection?: { dispose(): void };
  pointEffects?: { dispose(): void };
  progressionPanel: { dispose(): void };
  modelCache: { dispose(): void };
  controlCanvas?: { dispose(): void };
  drawing: { dispose(): void };
  resizeSurface(): void;
  paintTaskbar(): void;
  frame(): void;
}

export interface GarageLifecycleDependencies {
  cancelAnimationFrame(frame: number): void;
  window: Pick<Window, "addEventListener" | "removeEventListener">;
}

export function showGarageView(view: GarageLifecycleHost, dependencies: GarageLifecycleDependencies): void {
  if (view.disposed) return;
  view.frozen = false;
  view.frozenSnapshot = undefined;
  view.shown = true;
  view.element.hidden = false;
  view.resizeSurface();
  view.releaseTaskbar ??= view.options.taskbar?.composite(view, () => {
    if (view.shown && !view.disposed) view.paintTaskbar();
  });
  dependencies.window.addEventListener("keydown", view.onKey);
  view.search.focus();
  view.frame();
}

export function freezeGarageView(view: GarageLifecycleHost, dependencies: GarageLifecycleDependencies): void {
  if (view.disposed) return;
  view.frozen = true;
  dependencies.cancelAnimationFrame(view.raf);
  view.element.inert = true;
  view.element.style.pointerEvents = "none";
}

export function unfreezeGarageView(view: GarageLifecycleHost): void {
  if (view.disposed) return;
  view.frozen = false;
  view.frozenSnapshot = undefined;
  view.element.inert = false;
  view.element.style.pointerEvents = "auto";
  view.frame();
}

/** Preserve release cleanup order, including the early preparation cleanup before the disposed flag. */
export function disposeGarageView(view: GarageLifecycleHost, dependencies: GarageLifecycleDependencies): void {
  if (view.disposed) return;
  view.interactionAudioCleanup?.();
  view.tutorialClose?.();
  view.preparation?.dispose();
  view.preparation = undefined;
  view.disposed = true;
  view.exceedTypeChange?.dispose();
  view.exceedTypeChange = undefined;
  dependencies.cancelAnimationFrame(view.raf);
  dependencies.cancelAnimationFrame(view.inventoryHitTestFrame);
  view.resize?.disconnect();
  dependencies.window.removeEventListener("resize", view.onWindowResize);
  dependencies.window.removeEventListener("keydown", view.onKey);
  view.panels?.dispose();
  view.confirmation?.dispose();
  view.upgrade?.dispose();
  view.skillSelection?.dispose();
  view.pointEffects?.dispose();
  view.progressionPanel.dispose();
  view.modelCache.dispose();
  view.controlCanvas?.dispose();
  view.releaseTaskbar?.();
  view.releaseTaskbar = undefined;
  view.strengtheningSnapshot = undefined;
  view.frozenSnapshot = undefined;
  view.drawing.dispose();
  view.element.remove();
}

export interface GarageViewportHost {
  shown: boolean;
  frozen: boolean;
  frozenSnapshot?: unknown;
  upgrade?: unknown;
  preparation?: { resizeCanvases(): void };
  confirmation?: { resizeCanvases(): void };
  factoryPanel?: { resizeCanvases(): void };
  options: { root: { getBoundingClientRect(): { width: number; height: number } } };
  assets: { stage: { width: number; height: number } };
  surface: { style: { transform: string; left: string; top: string } };
  canvas: unknown;
  context: { setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void };
  inputSurface?: { style: Record<string, string> };
  renderPixelRatio: number;
  drawing: {
    beginFrame(): void;
    drawCanvasLayer(canvas: unknown, rectangle: { x: number; y: number; width: number; height: number }, layer: number): void;
    endFrame(): void;
  };
  captureStrengtheningStage(): unknown;
  captureStage(): unknown;
  paintTaskbar(): void;
}

export interface GarageViewportDependencies {
  pixelRatio(): number;
  sizeCanvas(
    canvas: unknown,
    context: GarageViewportHost["context"],
    width: number,
    height: number,
    ratio: number,
    logicalWidth: number,
    logicalHeight: number,
  ): { scaleX: number; scaleY: number };
}

/** Keep the stage centered and use the canvas's actual backing scale for preview rendering. */
export function resizeGarageSurface(view: GarageViewportHost, dependencies: GarageViewportDependencies): void {
  if (view.shown && (view.upgrade || view.preparation)) view.captureStrengtheningStage();
  if (view.frozen && !view.frozenSnapshot) view.frozenSnapshot = view.captureStage();
  const bounds = view.options.root.getBoundingClientRect();
  const { width, height } = view.assets.stage;
  const scale = Math.min(bounds.width / width, bounds.height / height);
  view.surface.style.transform = `scale(${scale})`;
  view.surface.style.left = `${(bounds.width - width * scale) / 2}px`;
  view.surface.style.top = `${(bounds.height - height * scale) / 2}px`;
  const canvasScale = dependencies.sizeCanvas(
    view.canvas, view.context, bounds.width, bounds.height,
    dependencies.pixelRatio(), bounds.width, bounds.height,
  );
  const left = (bounds.width - width * scale) / 2;
  const top = (bounds.height - height * scale) / 2;
  view.context.setTransform(
    canvasScale.scaleX * scale, 0, 0, canvasScale.scaleY * scale,
    canvasScale.scaleX * left, canvasScale.scaleY * top,
  );
  view.renderPixelRatio = canvasScale.scaleX * scale;
  if (view.inputSurface) Object.assign(view.inputSurface.style, {
    transform: view.surface.style.transform,
    left: view.surface.style.left,
    top: view.surface.style.top,
  });
  view.factoryPanel?.resizeCanvases();
  view.preparation?.resizeCanvases();
  view.confirmation?.resizeCanvases();
  if (view.frozen && view.frozenSnapshot) {
    view.drawing.beginFrame();
    view.drawing.drawCanvasLayer(view.frozenSnapshot, { x: 0, y: 0, width, height }, 0);
    view.paintTaskbar();
    view.drawing.endFrame();
  }
}
