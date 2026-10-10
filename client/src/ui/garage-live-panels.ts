/** Stateful owner of the garage's character, kart, equipment and preview panels. */

import {
  disposeGaragePreview, loadGarageEquipmentCard, loadGarageKartCard,
  setParticleModificationPageVisible, syncGarageCards, syncGarageCharacters,
  syncGarageCoatingPreview, syncGarageEquipment, syncGarageKarts,
  syncGaragePreview, validateCoatingEquipment,
  type GarageCardItem, type GarageCoatingFitting,
  type GarageLivePanelAssetDependencies, type GarageLivePreview,
  type GaragePreviewSelection,
} from "./garage-live-panel-assets";
import {
  copyGaragePanel, disposeGarageLivePanels, drawGarageAuxiliaryPanel,
  drawGarageCard, drawGaragePreview, renderGarageCharacterCard,
  renderGarageEquipmentCard, renderGarageKartCard, renderGarageKartSnapshot,
  renderGarageLivePanels, renderGaragePreview, renderGaragePreviewSnapshot,
  setGaragePanelViewport, submitGaragePanelScene,
  type GarageLivePanelRenderDependencies, type GaragePanelCamera,
  type GaragePanelCard, type GaragePanelDirectTarget,
  type GaragePanelRectangle, type GaragePanelRenderer,
} from "./garage-live-panel-render";
import {
  advancePreviewRotation, beginPreviewRotation, beginTransformPreviewSession,
  closeCompletedTransformPreview, resetPreviewForPageTransition,
  resetPreviewRotation, restartTransformPreview, rotatePreview,
  setTransformPreview, toggleTransformPreview,
  type GaragePreviewMotionDependencies,
} from "./garage-live-preview-motion";

export interface GarageLivePanelDependencies {
  createRenderer(): GaragePanelRenderer;
  createCamera(kind: "character" | "kart" | "preview",
    width: number, height: number): GaragePanelCamera;
  createImporter(): unknown;
  sizePreviewCamera(camera: GaragePanelCamera, width: number,
    height: number, preset: string): void;
  cameraYaw(camera: GaragePanelCamera, yaw: number): void;
  outputColorSpace: unknown;
  motion: GaragePreviewMotionDependencies;
  assets: GarageLivePanelAssetDependencies;
  render: GarageLivePanelRenderDependencies;
}

export class GarageLivePanels {
  readonly library: unknown;
  readonly environment: unknown;
  readonly stageBinding: {
    coatingTextures(library: unknown): unknown;
    beginFrame(time: number): void;
  };
  readonly onReady: () => void;
  readonly previewMode: string;
  readonly coatingTextures: unknown;
  readonly renderer: GaragePanelRenderer;
  readonly importer: unknown;
  readonly characterCamera: GaragePanelCamera;
  readonly kartCamera: GaragePanelCamera;
  readonly previewCamera: GaragePanelCamera;
  readonly dependencies: GarageLivePanelDependencies;

  particleModificationPageVisible = true;
  coatingFitting?: GarageCoatingFitting;
  coatingRequest?: unknown;
  coatingFailure?: string;
  pixelRatio = 1;
  directFrame?: { target: GaragePanelDirectTarget;
    scenes: Map<string, { scene: unknown; camera: GaragePanelCamera }> };
  preparingDirectFrame = false;
  panelRect?: GaragePanelRectangle;
  characters = new Map<number, any>();
  karts = new Map<string, any>();
  characterLoading = new Set<number>();
  kartLoading = new Set<string>();
  characterFailed = new Set<number>();
  kartFailed = new Set<string>();
  equipment = new Map<string, any>();
  equipmentLoading = new Set<string>();
  equipmentFailed = new Set<string>();
  desiredEquipment = new Set<string>();
  desiredCharacters = new Set<number>();
  desiredKarts = new Set<string>();
  preview?: GarageLivePreview & any;
  previewKey?: string;
  previewGeneration = 0;
  previewYaw = 0;
  previewReverse = false;
  previewRearView = false;
  transformPreviewEnabled = false;
  transformPreviewTimelineActive = false;
  transformPreviewCancelled = false;
  transformPreviewCompleted = false;
  transformPreviewClosing = false;
  previewTargetYaw?: number;
  previewYawTime?: number;
  disposed = false;

  constructor(library: unknown, environment: unknown,
    binding: GarageLivePanels["stageBinding"], onReady: () => void,
    characterSize: { width: number; height: number },
    previewSize: { width: number; height: number },
    previewCamera: GaragePanelCamera | undefined, previewMode: string,
    dependencies: GarageLivePanelDependencies) {
    this.dependencies = dependencies;
    // The release creates these objects before using the resource binding.
    this.renderer = dependencies.createRenderer();
    this.importer = dependencies.createImporter();
    this.library = library;
    this.environment = environment;
    this.stageBinding = binding;
    this.onReady = onReady;
    this.previewMode = previewMode;
    this.coatingTextures = binding.coatingTextures(library);
    this.renderer.outputColorSpace = dependencies.outputColorSpace;
    this.renderer.setClearColor(0, 0);
    this.renderer.autoClear = false;
    this.characterCamera = dependencies.createCamera("character",
      characterSize.width, characterSize.height);
    this.kartCamera = dependencies.createCamera("kart",
      characterSize.width, characterSize.height);
    this.previewCamera = previewCamera ?? dependencies.createCamera("preview",
      previewSize.width, previewSize.height);
  }

  get coatingPreviewError(): string | undefined { return this.coatingFailure; }
  setParticleModificationPageVisible(visible: boolean): void {
    setParticleModificationPageVisible(this, visible);
  }
  validateCoatingEquipment(itemId: number,
    coating: { family: string; id: string }): Promise<void> {
    return validateCoatingEquipment(this, itemId, coating, this.dependencies.assets);
  }
  setPreviewSize(width: number, height: number, preset = "default"): void {
    this.dependencies.sizePreviewCamera(this.previewCamera, width, height, preset);
    this.dependencies.cameraYaw(this.previewCamera, this.previewYaw);
  }

  render(time: number, width: number, height: number, cards: GaragePanelCard[],
    previewRectangle: GaragePanelRectangle, kart?: GarageCardItem,
    rider?: GarageCardItem, selection?: GaragePreviewSelection,
    coatingRequest?: unknown, animate = true, pixelRatio = 1,
    target?: GaragePanelDirectTarget): void {
    renderGarageLivePanels(this, time, width, height, cards, previewRectangle,
      kart, rider, selection, coatingRequest, animate, pixelRatio, target);
  }
  drawCard(context: CanvasRenderingContext2D, item: GarageCardItem,
    rectangle: GaragePanelRectangle): void {
    drawGarageCard(this, context, item, rectangle, this.dependencies.render);
  }
  drawPreview(context: CanvasRenderingContext2D, rectangle: GaragePanelRectangle): void {
    drawGaragePreview(this, context, rectangle);
  }
  renderPreviewSnapshot(time: number, width: number, height: number,
    rectangle: GaragePanelRectangle, pixelRatio = 1): boolean {
    return renderGaragePreviewSnapshot(this, time, width, height, rectangle, pixelRatio);
  }
  renderKartSnapshot(time: number, width: number, height: number,
    item: GarageCardItem, rectangle: GaragePanelRectangle, pixelRatio = 1): boolean {
    return renderGarageKartSnapshot(this, time, width, height, item, rectangle,
      pixelRatio, this.dependencies.render);
  }
  drawAuxiliaryPanel(panel: { scene: unknown; camera: GaragePanelCamera;
    update(width: number, height: number): void }, contexts: CanvasRenderingContext2D[]): void {
    drawGarageAuxiliaryPanel(this, panel, contexts, this.dependencies.render);
  }

  beginPreviewRotation(): void { beginPreviewRotation(this); }
  rotatePreview(delta: number): void { rotatePreview(this, delta, this.dependencies.motion); }
  beginTransformPreviewSession(): void { beginTransformPreviewSession(this); }
  restartTransformPreview(): void { restartTransformPreview(this, this.dependencies.motion); }
  get isTransformPreviewSessionActive(): boolean { return this.transformPreviewEnabled; }
  get isTransformPreviewEnabled(): boolean { return this.transformPreviewEnabled; }
  get isPreviewReady(): boolean { return this.preview !== undefined; }
  toggleTransformPreview(): void { toggleTransformPreview(this); }
  setTransformPreview(enabled: boolean): void {
    setTransformPreview(this, enabled, this.dependencies.motion);
  }
  resetPreviewForPageTransition(): void {
    resetPreviewForPageTransition(this, this.dependencies.motion);
  }
  closeCompletedTransformPreview(): void {
    closeCompletedTransformPreview(this, this.dependencies.motion);
  }
  resetPreviewRotation(rearView = this.previewRearView): void {
    resetPreviewRotation(this, rearView);
  }
  advancePreviewRotation(time: number): void {
    advancePreviewRotation(this, time, this.dependencies.motion);
  }

  dispose(): void { disposeGarageLivePanels(this, this.dependencies.render); }
  copyTo(context: CanvasRenderingContext2D, rectangle: GaragePanelRectangle): void {
    copyGaragePanel(this, context, rectangle, this.dependencies.render);
  }
  renderCharacterCard(time: number, height: number, item: GarageCardItem,
    rectangle: GaragePanelRectangle): void {
    renderGarageCharacterCard(this, time, height, item, rectangle);
  }
  renderKartCard(time: number, height: number, item: GarageCardItem,
    rectangle: GaragePanelRectangle, zoom?: number, shadow = false): void {
    renderGarageKartCard(this, time, height, item, rectangle,
      zoom, shadow, this.dependencies.render);
  }
  renderPreview(time: number, height: number, rectangle: GaragePanelRectangle,
    animate = true): void {
    renderGaragePreview(this, time, height, rectangle, animate, this.dependencies.render);
  }
  renderEquipmentCard(height: number, item: GarageCardItem,
    rectangle: GaragePanelRectangle): void {
    renderGarageEquipmentCard(this, height, item, rectangle, this.dependencies.render);
  }
  setViewport(height: number, rectangle: GaragePanelRectangle): void {
    setGaragePanelViewport(this, height, rectangle);
  }
  submitScene(scene: unknown, camera: GaragePanelCamera): void {
    submitGaragePanelScene(this, scene, camera, this.dependencies.render);
  }

  syncCards(items: GarageCardItem[]): void { syncGarageCards(this, items); }
  syncEquipment(items: GarageCardItem[]): void {
    syncGarageEquipment(this, items, this.dependencies.assets);
  }
  loadEquipmentCard(item: GarageCardItem): void {
    loadGarageEquipmentCard(this, item, this.dependencies.assets);
  }
  syncCharacters(items: GarageCardItem[]): void {
    syncGarageCharacters(this, items, this.dependencies.assets);
  }
  syncKarts(items: GarageCardItem[]): void {
    syncGarageKarts(this, items, this.dependencies.assets);
  }
  loadKartCard(item: GarageCardItem): void {
    loadGarageKartCard(this, item, this.dependencies.assets);
  }
  syncPreview(kart: GarageCardItem, rider: GarageCardItem,
    selection: GaragePreviewSelection): void {
    syncGaragePreview(this, kart, rider, selection, this.dependencies.assets);
  }
  disposePreview(): void { disposeGaragePreview(this, this.dependencies.assets); }
  syncCoatingPreview(request: unknown): void {
    syncGarageCoatingPreview(this, request, this.dependencies.assets);
  }
}
