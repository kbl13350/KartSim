import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageViewConstructionOptions {
  selectedKartItemId: number;
  catalog: { karts: Array<{ itemId: number; systemKey?: string }> };
  profile: { equipment: { systemKart?: string }; garage: unknown };
  library: unknown;
  environment: unknown;
  stageBinding: unknown;
  root: HTMLElement;
  onHover?: () => void;
  onActivate?: () => void;
}

export interface GarageViewConstructionAssets {
  rects: Map<string, GaragePreviewRect>;
  stage: { width: number; height: number };
  fontFamily?: string;
}

export interface GarageViewConstructionHost {
  options: GarageViewConstructionOptions;
  assets: GarageViewConstructionAssets;
  tuning: unknown;
  previews: unknown;
  selected: GarageViewConstructionOptions["catalog"]["karts"][number];
  configuration: unknown;
  previewRect: GaragePreviewRect;
  element: HTMLElement;
  surface: HTMLElement;
  canvas: HTMLCanvasElement;
  controls: HTMLElement;
  transformPreviewPartsRoot: HTMLElement;
  inputSurface: HTMLElement;
  search: HTMLInputElement;
  status: HTMLElement;
  drawing: { context: CanvasRenderingContext2D };
  context: CanvasRenderingContext2D;
  modelCache: unknown;
  interactionAudioCleanup: unknown;
  progressionPanel: { element: HTMLElement };
  pointEffects: unknown;
  controlCanvas: unknown;
  resize: { observe(root: HTMLElement): void };
  onWindowResize: () => void;
  onDragStart: (event: PointerEvent) => void;
  onDragMove: (event: PointerEvent) => void;
  onDragEnd: (event: PointerEvent) => void;
  buildControls(): void;
  updateControls(): void;
  resizeSurface(): void;
  requestProgression(progression: unknown): void;
  requestSkillSelection(index: number): void;
  requestExceedTypeChange(): void;
}

export interface GarageViewConstructionDependencies {
  validateKart(itemId: number): void;
  createDrawing(canvas: HTMLCanvasElement): { context: CanvasRenderingContext2D };
  createModelCache(load: (path: string) => unknown,
    onError: (path: string, error: unknown) => void): unknown;
  loadModel(library: unknown, path: string, environment: unknown,
    stageBinding: unknown): unknown;
  bindInteractionAudio(element: HTMLElement,
    audio: { playHover: () => void; playClick: () => void } | undefined,
    filters: { isHoverAudible: unknown; isClickAudible: unknown }): unknown;
  isHoverAudible: unknown;
  isClickAudible: unknown;
  createProgressionPanel(tuning: unknown, onChange: (progression: unknown) => void,
    onSelectSkill: (index: number) => void,
    onExceedTypeChange: () => void): { element: HTMLElement };
  createPointEffects(surface: HTMLElement, tuning: unknown,
    load: (path: string) => unknown, onError: (message: string) => void): unknown;
  createControlCanvas(surface: HTMLElement, width: number, height: number): unknown;
  createResizeObserver(callback: () => void): { observe(root: HTMLElement): void };
  window: Pick<Window, "addEventListener">;
}

/** Connect a Garage view's pre-created DOM fields to the selected kart and runtime services. */
export function initializeGarageView(
  host: GarageViewConstructionHost,
  options: GarageViewConstructionOptions,
  assets: GarageViewConstructionAssets,
  tuning: unknown,
  previews: unknown,
  dependencies: GarageViewConstructionDependencies,
): void {
  host.options = options;
  host.assets = assets;
  host.tuning = tuning;
  host.previews = previews;
  dependencies.validateKart(options.selectedKartItemId);

  const selected = options.catalog.karts.find(kart =>
    kart.itemId === options.selectedKartItemId &&
    (kart.itemId !== 0 || kart.systemKey === options.profile.equipment.systemKart));
  if (!selected) throw new Error("车库当前车辆不在资源目录内。");
  host.selected = selected;
  host.configuration = options.profile.garage;
  const previewRect = assets.rects.get("kartPreview");
  if (!previewRect) throw new Error("P3543 车库缺少 kartPreview 布局。");
  host.previewRect = previewRect;

  host.canvas.width = assets.stage.width;
  host.canvas.height = assets.stage.height;
  host.drawing = dependencies.createDrawing(host.canvas);
  host.context = host.drawing.context;
  const loadModel = (path: string) => dependencies.loadModel(options.library, path,
    options.environment, options.stageBinding);
  host.modelCache = dependencies.createModelCache(loadModel, (path, error) => {
    host.status.textContent =
      `部件模型加载失败：${path}（${error instanceof Error ? error.message : String(error)}）`;
  });

  host.element.className = "garage-x";
  host.element.dataset.uiLayer = "stage";
  host.element.setAttribute("role", "dialog");
  host.element.setAttribute("aria-label", "车库");
  host.element.hidden = true;
  host.surface.className = "garage-x-surface";
  if (assets.fontFamily)
    host.surface.style.fontFamily = `"${assets.fontFamily}", sans-serif`;
  host.surface.style.width = `${assets.stage.width}px`;
  host.surface.style.height = `${assets.stage.height}px`;
  host.canvas.style.width = `${assets.stage.width}px`;
  host.canvas.style.height = `${assets.stage.height}px`;
  host.controls.className = "garage-x-controls";
  host.transformPreviewPartsRoot.className = "garage-x-transform-parts-root";
  host.transformPreviewPartsRoot.dataset.transformCustomParts = "true";
  host.controls.append(host.transformPreviewPartsRoot);
  host.surface.append(host.controls);
  Object.assign(host.canvas.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
  });
  host.canvas.dataset.garageFinalCanvas = "true";
  host.canvas.setAttribute("aria-hidden", "true");
  host.surface.style.filter = "opacity(0)";
  host.surface.style.pointerEvents = "none";
  host.canvas.style.touchAction = "none";
  host.element.append(host.canvas, host.surface, host.inputSurface);

  const interactionAudio = options.onHover || options.onActivate ? {
    playHover: options.onHover ?? (() => {}),
    playClick: options.onActivate ?? (() => {}),
  } : undefined;
  host.interactionAudioCleanup = dependencies.bindInteractionAudio(host.element,
    interactionAudio, {
      isHoverAudible: dependencies.isHoverAudible,
      isClickAudible: dependencies.isClickAudible,
    });
  host.progressionPanel = dependencies.createProgressionPanel(tuning,
    progression => host.requestProgression(progression),
    index => host.requestSkillSelection(index),
    () => host.requestExceedTypeChange());
  host.progressionPanel.element.hidden = true;
  host.surface.append(host.progressionPanel.element);
  host.pointEffects = dependencies.createPointEffects(host.surface, tuning, loadModel,
    message => { host.status.textContent = message; });
  host.buildControls();

  host.inputSurface.className = "garage-x-surface garage-x-input-surface";
  Object.assign(host.inputSurface.style, {
    position: "absolute", width: `${assets.stage.width}px`,
    height: `${assets.stage.height}px`, transformOrigin: "0 0",
    pointerEvents: "none",
  });
  host.inputSurface.style.fontFamily = host.surface.style.fontFamily;
  host.search.style.pointerEvents = "auto";
  host.inputSurface.append(host.search);
  host.controlCanvas = dependencies.createControlCanvas(host.surface,
    assets.stage.width, assets.stage.height);
  host.resize = dependencies.createResizeObserver(() => host.resizeSurface());
  host.resize.observe(options.root);
  dependencies.window.addEventListener("resize", host.onWindowResize);
  host.canvas.addEventListener("pointerdown", host.onDragStart);
  host.canvas.addEventListener("pointermove", host.onDragMove);
  host.canvas.addEventListener("pointerup", host.onDragEnd);
  host.canvas.addEventListener("pointercancel", host.onDragEnd);
  host.updateControls();
  options.root.append(host.element);
}
