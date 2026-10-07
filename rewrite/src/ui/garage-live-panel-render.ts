/** Rendering and canvas copy orchestration for the live garage previews. */

import type { GarageCardItem, GaragePreviewSelection } from "./garage-live-panel-assets";

export interface GaragePanelRectangle {
  x: number; y: number; width: number; height: number;
}

export interface GaragePanelRenderer {
  domElement: HTMLCanvasElement;
  outputColorSpace: unknown;
  autoClear: boolean;
  setClearColor(color: number, alpha: number): void;
  setPixelRatio(ratio: number): void;
  getPixelRatio(): number;
  setSize(width: number, height: number, updateStyle: boolean): void;
  setScissorTest(enabled: boolean): void;
  setViewport(x: number, y: number, width: number, height: number): void;
  setScissor(x: number, y: number, width: number, height: number): void;
  clear(color: boolean, depth: boolean, stencil: boolean): void;
  dispose(): void;
}

export interface GaragePanelCamera {
  clone(): GaragePanelCamera;
}

export interface GaragePanelDirectTarget {
  context: CanvasRenderingContext2D;
  drawModel(rectangle: GaragePanelRectangle,
    draw: (renderer: GaragePanelRenderer) => void): void;
}

export interface GaragePanelCard {
  item: GarageCardItem;
  rect: GaragePanelRectangle;
  kartZoom?: number;
  kartShadow?: boolean;
}

export interface GarageLivePanelRenderHost {
  disposed: boolean;
  renderer: GaragePanelRenderer;
  stageBinding: { beginFrame(time: number): void };
  pixelRatio: number;
  directFrame?: { target: GaragePanelDirectTarget;
    scenes: Map<string, { scene: unknown; camera: GaragePanelCamera }> };
  preparingDirectFrame: boolean;
  panelRect?: GaragePanelRectangle;
  characterCamera: GaragePanelCamera;
  kartCamera: GaragePanelCamera;
  previewCamera: GaragePanelCamera;
  previewMode: string;
  transformPreviewTimelineActive: boolean;
  transformPreviewCompleted: boolean;
  transformPreviewCancelled: boolean;
  transformPreviewEnabled: boolean;
  particleModificationPageVisible: boolean;
  preview?: any;
  previewKey?: string;
  previewGeneration: number;
  coatingRequest?: unknown;
  characters: Map<number, any>;
  karts: Map<string, any>;
  equipment: Map<string, any>;
  onReady(): void;
  syncCards(items: GarageCardItem[]): void;
  syncPreview(kart: GarageCardItem, rider: GarageCardItem,
    selection: GaragePreviewSelection): void;
  syncCoatingPreview(request: unknown): void;
  advancePreviewRotation(time: number): void;
  disposePreview(): void;
  renderPreview(time: number, height: number, rectangle: GaragePanelRectangle,
    animate?: boolean): void;
  renderCharacterCard(time: number, height: number, item: GarageCardItem,
    rectangle: GaragePanelRectangle): void;
  renderKartCard(time: number, height: number, item: GarageCardItem,
    rectangle: GaragePanelRectangle, zoom?: number, shadow?: boolean): void;
  renderEquipmentCard(height: number, item: GarageCardItem,
    rectangle: GaragePanelRectangle): void;
  setViewport(height: number, rectangle: GaragePanelRectangle): void;
  submitScene(scene: unknown, camera: GaragePanelCamera): void;
  copyTo(context: CanvasRenderingContext2D, rectangle: GaragePanelRectangle): void;
}

export interface GarageLivePanelRenderDependencies {
  kartKey(item: GarageCardItem): string;
  equipmentKey(item: GarageCardItem): string;
  frameKartCamera(camera: GaragePanelCamera, width: number, height: number,
    zoom?: number): void;
  updateKartCard(card: unknown, time: number, camera: GaragePanelCamera,
    width: number, height: number, shadow: boolean): void;
  updatePreview(preview: any, time: number, camera: GaragePanelCamera,
    width: number, height: number, animate?: boolean): void;
  advanceKartTransform(preview: any, time: number, timelineActive: boolean): boolean;
  updateOrdinaryPreview(preview: any, time: number): void;
  visualState(animationState: number, transformBoost: boolean):
    { state: number; dualMode: number };
  renderScene(renderer: GaragePanelRenderer, scene: unknown,
    camera: GaragePanelCamera): void;
  pixelRatio(): number;
  disposeCharacter(card: unknown): void;
  disposeKart(card: unknown): void;
}

function rectangleKey(rectangle: GaragePanelRectangle): string {
  return `${rectangle.x},${rectangle.y},${rectangle.width},${rectangle.height}`;
}

function renderSurface(host: GarageLivePanelRenderHost, time: number,
  width: number, height: number, pixelRatio: number): void {
  host.directFrame = undefined;
  host.pixelRatio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  host.renderer.setPixelRatio(host.pixelRatio);
  host.renderer.setSize(width, height, false);
  host.renderer.setScissorTest(false);
  host.renderer.clear(true, true, true);
  host.stageBinding.beginFrame(time);
  host.renderer.setScissorTest(true);
}

export function renderGarageLivePanels(host: GarageLivePanelRenderHost,
  time: number, width: number, height: number, cards: GaragePanelCard[],
  previewRectangle: GaragePanelRectangle, kart?: GarageCardItem,
  rider?: GarageCardItem, selection?: GaragePreviewSelection,
  coatingRequest?: unknown, animate = true, pixelRatio = 1,
  target?: GaragePanelDirectTarget): void {
  if (host.disposed) return;
  host.syncCards(cards.map(card => card.item));
  if (kart) host.syncPreview(kart, rider!, selection!);
  else {
    host.previewKey = undefined;
    host.previewGeneration += 1;
    host.disposePreview();
  }
  host.syncCoatingPreview(coatingRequest);
  if (animate) host.advancePreviewRotation(time);
  host.pixelRatio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  host.directFrame = target ? { target, scenes: new Map() } : undefined;
  host.preparingDirectFrame = target !== undefined;
  if (!target) {
    host.renderer.setPixelRatio(host.pixelRatio);
    host.renderer.setSize(width, height, false);
    host.renderer.setScissorTest(false);
    host.renderer.clear(true, true, true);
  }
  host.stageBinding.beginFrame(time);
  if (!target) host.renderer.setScissorTest(true);
  try {
    if (kart) host.renderPreview(time, height, previewRectangle, animate);
    cards.forEach(({ item, rect, kartZoom, kartShadow }) => {
      if (item.kind === "character") host.renderCharacterCard(time, height, item, rect);
      else if (item.kind === "kart") host.renderKartCard(time, height, item, rect,
        kartZoom, kartShadow);
      else if ("category" in item) host.renderEquipmentCard(height, item, rect);
    });
  } finally {
    host.preparingDirectFrame = false;
    if (!target) host.renderer.setScissorTest(false);
  }
}

export function drawGarageCard(host: GarageLivePanelRenderHost,
  context: CanvasRenderingContext2D, item: GarageCardItem,
  rectangle: GaragePanelRectangle, deps: GarageLivePanelRenderDependencies): void {
  const loaded = item.kind === "character" ? host.characters.has(item.itemId)
    : item.kind === "kart" ? host.karts.has(deps.kartKey(item))
      : host.equipment.has(deps.equipmentKey(item));
  if (loaded) host.copyTo(context, rectangle);
}

export function drawGaragePreview(host: GarageLivePanelRenderHost,
  context: CanvasRenderingContext2D, rectangle: GaragePanelRectangle): void {
  if (host.preview) host.copyTo(context, rectangle);
}

export function renderGaragePreviewSnapshot(host: GarageLivePanelRenderHost,
  time: number, width: number, height: number, rectangle: GaragePanelRectangle,
  pixelRatio = 1): boolean {
  if (host.disposed || !host.preview) return false;
  renderSurface(host, time, width, height, pixelRatio);
  host.renderPreview(time, height, rectangle, false);
  host.renderer.setScissorTest(false);
  return true;
}

export function renderGarageKartSnapshot(host: GarageLivePanelRenderHost,
  time: number, width: number, height: number, item: GarageCardItem,
  rectangle: GaragePanelRectangle, pixelRatio: number,
  deps: GarageLivePanelRenderDependencies): boolean {
  if (host.disposed || !host.karts.get(deps.kartKey(item))) return false;
  renderSurface(host, time, width, height, pixelRatio);
  host.renderKartCard(time, height, item, rectangle);
  host.renderer.setScissorTest(false);
  return true;
}

export function drawGarageAuxiliaryPanel(host: GarageLivePanelRenderHost,
  panel: { scene: unknown; camera: GaragePanelCamera; update(width: number, height: number): void },
  contexts: CanvasRenderingContext2D[], deps: GarageLivePanelRenderDependencies): void {
  if (host.disposed || contexts.length === 0) return;
  const currentPixelRatio = host.pixelRatio > 0 ? host.pixelRatio : 1;
  const groups = new Map<string, { targets: CanvasRenderingContext2D[];
    logicalWidth: number; logicalHeight: number }>();
  for (const context of contexts) {
    const canvas = context.canvas;
    const bounds = canvas.getBoundingClientRect();
    let logicalWidth = canvas.width / currentPixelRatio;
    let logicalHeight = canvas.height / currentPixelRatio;
    if (bounds.width > 0 && bounds.height > 0) {
      const ratio = deps.pixelRatio();
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      logicalWidth = bounds.width * ratio / currentPixelRatio;
      logicalHeight = bounds.height * ratio / currentPixelRatio;
    }
    const key = `${canvas.width}:${canvas.height}`;
    const group = groups.get(key);
    if (group) group.targets.push(context);
    else groups.set(key, { targets: [context], logicalWidth, logicalHeight });
  }
  const maximumWidth = Math.max(...[...groups.values()].map(group => group.targets[0]!.canvas.width));
  const maximumHeight = Math.max(...[...groups.values()].map(group => group.targets[0]!.canvas.height));
  if (host.renderer.getPixelRatio() !== 1) host.renderer.setPixelRatio(1);
  if (host.renderer.domElement.width !== maximumWidth ||
      host.renderer.domElement.height !== maximumHeight)
    host.renderer.setSize(maximumWidth, maximumHeight, false);
  for (const group of groups.values()) {
    const { width, height } = group.targets[0]!.canvas;
    host.renderer.setScissorTest(true);
    host.setViewport(maximumHeight, { x: 0, y: 0, width, height });
    host.renderer.clear(true, true, true);
    panel.update(group.logicalWidth, group.logicalHeight);
    deps.renderScene(host.renderer, panel.scene, panel.camera);
    host.renderer.setScissorTest(false);
    for (const context of group.targets) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      context.drawImage(host.renderer.domElement, 0, 0, width, height,
        0, 0, width, height);
      context.restore();
    }
  }
}

export function copyGaragePanel(host: GarageLivePanelRenderHost,
  context: CanvasRenderingContext2D, rectangle: GaragePanelRectangle,
  deps: GarageLivePanelRenderDependencies): void {
  const frame = host.directFrame;
  if (frame && context === frame.target.context) {
    const scene = frame.scenes.get(rectangleKey(rectangle));
    if (scene) frame.target.drawModel(rectangle,
      renderer => deps.renderScene(renderer, scene.scene, scene.camera));
    return;
  }
  context.drawImage(host.renderer.domElement,
    rectangle.x * host.pixelRatio, rectangle.y * host.pixelRatio,
    rectangle.width * host.pixelRatio, rectangle.height * host.pixelRatio,
    rectangle.x, rectangle.y, rectangle.width, rectangle.height);
}

export function renderGarageCharacterCard(host: GarageLivePanelRenderHost,
  time: number, height: number, item: GarageCardItem,
  rectangle: GaragePanelRectangle): void {
  const card = host.characters.get(item.itemId);
  if (!card) return;
  host.setViewport(height, rectangle);
  card.character.update(time, host.characterCamera, rectangle.width, rectangle.height, undefined);
  host.submitScene(card.scene, host.characterCamera);
}

export function renderGarageKartCard(host: GarageLivePanelRenderHost,
  time: number, height: number, item: GarageCardItem,
  rectangle: GaragePanelRectangle, zoom: number | undefined, shadow: boolean,
  deps: GarageLivePanelRenderDependencies): void {
  const card = host.karts.get(deps.kartKey(item));
  if (!card) return;
  deps.frameKartCamera(host.kartCamera, rectangle.width, rectangle.height, zoom);
  const camera = card.cardCamera?.(rectangle.width, rectangle.height) ?? host.kartCamera;
  host.setViewport(height, rectangle);
  deps.updateKartCard(card, time, camera, rectangle.width, rectangle.height, shadow);
  host.submitScene(card.scene, camera);
}

export function renderGaragePreview(host: GarageLivePanelRenderHost,
  time: number, height: number, rectangle: GaragePanelRectangle,
  animate: boolean, deps: GarageLivePanelRenderDependencies): void {
  const preview = host.preview;
  if (!preview) return;
  host.setViewport(height, rectangle);
  const kartOnly = host.previewMode === "kart-only";
  if (!animate) {
    deps.updatePreview(preview, time, host.previewCamera, rectangle.width, rectangle.height, false);
    host.submitScene(preview.scene, host.previewCamera);
    return;
  }
  if (kartOnly) {
    preview.kart.animation.updateCurrentState(time);
    if (deps.advanceKartTransform(preview, time, host.transformPreviewTimelineActive)) {
      host.transformPreviewCompleted = !host.transformPreviewCancelled;
      host.transformPreviewTimelineActive = false;
      host.transformPreviewCancelled = false;
      preview.transformEnabled = false;
      preview.origin = undefined;
    }
  } else {
    deps.updateOrdinaryPreview(preview, time);
    preview.kart.animation.updateCurrentState(time);
  }
  deps.updatePreview(preview, time, host.previewCamera, rectangle.width, rectangle.height);
  const animationState = preview.kart.animation.state;
  const elapsed = ((Math.trunc(time) >>> 0) - (preview.origin ?? 0)) >>> 0;
  const transformBoost = kartOnly && host.transformPreviewEnabled && elapsed <= 6000;
  const visual = deps.visualState(animationState, transformBoost);
  const boostActive = visual.state !== 0;
  preview.cosmeticEffects?.setState(visual.state, visual.dualMode, false, false, time);
  preview.cosmeticEffects?.update(time, host.previewCamera, rectangle.width, rectangle.height);
  preview.cosmeticTrails?.setState(boostActive ? 3 : 0, time);
  preview.cosmeticTrails?.update(time, host.previewCamera);
  preview.particleModification?.update(time, true, host.previewCamera,
    rectangle.width, rectangle.height);
  preview.flyingPet?.update(time, host.previewCamera, rectangle.width, rectangle.height);
  preview.decorations.forEach((decoration: { scene: { update(time: number, camera: GaragePanelCamera,
    width: number, height: number): void } }) =>
    decoration.scene.update(time, host.previewCamera, rectangle.width, rectangle.height));
  host.submitScene(preview.scene, host.previewCamera);
}

export function renderGarageEquipmentCard(host: GarageLivePanelRenderHost,
  height: number, item: GarageCardItem, rectangle: GaragePanelRectangle,
  deps: GarageLivePanelRenderDependencies): void {
  const card = host.equipment.get(deps.equipmentKey(item));
  if (!card) return;
  host.setViewport(height, rectangle);
  card.update(rectangle.width, rectangle.height);
  host.submitScene(card.scene, card.camera);
}

export function setGaragePanelViewport(host: GarageLivePanelRenderHost,
  height: number, rectangle: GaragePanelRectangle): void {
  host.panelRect = rectangle;
  if (host.preparingDirectFrame) return;
  const bottom = height - rectangle.y - rectangle.height;
  host.renderer.setViewport(rectangle.x, bottom, rectangle.width, rectangle.height);
  host.renderer.setScissor(rectangle.x, bottom, rectangle.width, rectangle.height);
  host.renderer.clear(true, true, true);
}

export function submitGaragePanelScene(host: GarageLivePanelRenderHost,
  scene: unknown, camera: GaragePanelCamera,
  deps: GarageLivePanelRenderDependencies): void {
  if (host.preparingDirectFrame && host.directFrame && host.panelRect)
    host.directFrame.scenes.set(rectangleKey(host.panelRect), { scene, camera: camera.clone() });
  else deps.renderScene(host.renderer, scene, camera);
}

export function disposeGarageLivePanels(host: GarageLivePanelRenderHost,
  deps: GarageLivePanelRenderDependencies): void {
  if (host.disposed) return;
  host.disposed = true;
  host.directFrame = undefined;
  host.characters.forEach(deps.disposeCharacter);
  host.karts.forEach(deps.disposeKart);
  host.characters.clear();
  host.karts.clear();
  host.equipment.forEach(card => card.dispose());
  host.equipment.clear();
  host.disposePreview();
  host.renderer.dispose();
}
