import type { GaragePreviewRect } from "./garage-transform-preview";
import { drawOwnershipBadge } from "./ownership-badge";

export interface GarageFrameVehicle {
  itemId: number;
  engineGrade: number;
  kartType: number;
}

export interface GarageFrameCard {
  item: GarageFrameVehicle;
  rect: GaragePreviewRect;
  isHovered?: () => boolean;
}

export interface GarageFramePanels {
  coatingPreviewError?: string;
  setPreviewSize(width: number, height: number, owner: string): void;
  render(time: number, width: number, height: number, cards: GarageFrameCard[],
    rect: GaragePreviewRect, kart: GarageFrameVehicle | undefined,
    character: { itemId: number }, equipment: Record<string, unknown>,
    coating: unknown, live: boolean, ratio: number, drawing: unknown): void;
  drawPreview(context: CanvasRenderingContext2D, rect: GaragePreviewRect): void;
  drawCard(context: CanvasRenderingContext2D, kart: GarageFrameVehicle,
    rect: GaragePreviewRect): void;
  drawAuxiliaryPanel(model: unknown, contexts: CanvasRenderingContext2D[]): void;
}

export interface GarageFrameRenderHost {
  shown: boolean;
  disposed: boolean;
  frozen: boolean;
  raf: number;
  frame: () => void;
  upgrade?: {
    capturePreview(panels: GarageFramePanels, rect: GaragePreviewRect): void;
    render(time: number, panels: GarageFramePanels): void;
  };
  preparation?: {
    previewRect?: GaragePreviewRect;
    selected?: GarageFrameVehicle;
    cards: GarageFrameCard[];
    previewCard?: GarageFrameCard;
    draw(panels: GarageFramePanels): void;
  };
  strengtheningSnapshot?: HTMLCanvasElement;
  renderPixelRatio: number;
  drawing: {
    beginFrame(): void;
    drawCanvasLayer(canvas: HTMLCanvasElement, rect: GaragePreviewRect,
      revision: number): void;
  };
  context: CanvasRenderingContext2D;
  assets: {
    stage: { width: number; height: number };
    nodes: Map<string, unknown>;
    textures: Map<string, CanvasImageSource>;
    rects: Map<string, GaragePreviewRect>;
    definition: unknown;
    partScrollbar: { areaFrame: { texture: string } };
  };
  pageMode: string;
  selected: GarageFrameVehicle;
  progressionPanel: { draw(context: CanvasRenderingContext2D, grade: number): void };
  factoryPanel?: {
    draw(context: CanvasRenderingContext2D): void;
    drawCatalogFrame(context: CanvasRenderingContext2D, index: number,
      selected: boolean, hovered?: boolean): void;
    model?: { source: { path: string }; context: CanvasRenderingContext2D };
    modelReady: boolean;
  };
  transformPreviewUiHidden: boolean;
  comparisons: Array<{ token: string; rect: GaragePreviewRect }>;
  upgradeCatalogEmpty: boolean;
  options: {
    catalog: { characters: Array<{ itemId: number }> };
    selectedCharacterItemId: number;
    profile: unknown;
  };
  panels?: GarageFramePanels;
  visibleCards: GarageFrameCard[];
  configuration: unknown;
  cosmeticPreview?: { family: string; slot: string; id: number };
  coatingPreview?: unknown;
  coatingMode: boolean;
  inventoryScroll: { geometry(scrollbar: unknown,
    rect: GaragePreviewRect): unknown };
  status: HTMLElement;
  controls: HTMLElement;
  modelCache: { get(source: { path: string }): unknown };
  pointEffects?: { render(time: number, panels: GarageFramePanels): void };
  serial(): number;
  rect(name: string): GaragePreviewRect;
  nativeFactoryAllowed(): boolean;
  activePreviewRect(): GaragePreviewRect;
  drawKartCatalogFrame(context: CanvasRenderingContext2D, rect: GaragePreviewRect,
    selected: boolean, hovered?: boolean): void;
  drawKartLevelBadge(context: CanvasRenderingContext2D, kart: GarageFrameVehicle,
    rect: GaragePreviewRect): void;
  captureStrengtheningStage(): void;
  renderStrengtheningOverlay(time: number): void;
  finishCanvasFrame(frozen?: boolean): void;
  flushTransformPreviewStart(): void;
  transformPreviewSessionActive(): boolean;
  syncTransformPreviewUi(): void;
  syncCosmeticPreviewActions(): void;
  renderPartModels(): void;
}

export interface GarageFrameRenderDependencies {
  requestFrame(callback: () => void): number;
  now(): number;
  layoutForGrade(grade: number): { kind: string } | undefined;
  backgroundForPage(page: string, layout: { kind: string }): string | undefined;
  nativePageName(page: string, xun: boolean): string;
  nativeFramePlan(definition: unknown, name: string): {
    beforePreview: string[]; afterPreview: string[];
  };
  attribute(node: unknown, name: string): string | undefined;
  kartTypeTexture(kartType: number): string;
  drawScrollbar(context: CanvasRenderingContext2D, scrollbar: unknown,
    image: CanvasImageSource, geometry: unknown): void;
  composeEquipment(profile: unknown, kartId: number,
    characterId: number): Record<string, unknown>;
  currentConfiguration(configuration: unknown, itemId: number,
    serial: number): { cosmetics?: Record<string, unknown> };
  writeConfiguration(configuration: unknown, itemId: number, serial: number,
    value: { cosmetics: Record<string, unknown> }): unknown;
}

/** Draw one Garage frame, from authored background through live preview and controls. */
export function renderGarageFrame(host: GarageFrameRenderHost,
  dependencies: GarageFrameRenderDependencies): void {
  if (!host.shown || host.disposed || host.frozen) return;
  host.raf = dependencies.requestFrame(host.frame);
  const { width, height } = host.assets.stage;
  // Callbacks during the frame may open a dialog, so read these live.
  const currentUpgrade = () => host.upgrade;
  const currentPreparation = () => host.preparation;

  if (currentUpgrade() !== undefined || currentPreparation() !== undefined) {
    host.captureStrengtheningStage();
    host.renderStrengtheningOverlay(dependencies.now());
    host.drawing.beginFrame();
    if (host.strengtheningSnapshot)
      host.drawing.drawCanvasLayer(host.strengtheningSnapshot,
        { x: 0, y: 0, width, height }, 0);
    host.finishCanvasFrame(true);
    return;
  }
  host.strengtheningSnapshot = undefined;
  const context = host.context;
  host.drawing.beginFrame();
  context.fillStyle = "#151e28";
  context.fillRect(0, 0, width, height);
  const backgroundNode = host.assets.nodes.get("backGround_1920");
  const background = backgroundNode ? host.assets.textures.get(
    dependencies.attribute(backgroundNode, "image") ?? "") : undefined;
  const backgroundRect = host.assets.rects.get("backGround_1920");
  if (background && backgroundRect)
    context.drawImage(background, backgroundRect.x, backgroundRect.y,
      backgroundRect.width, backgroundRect.height);

  const layout = dependencies.layoutForGrade(host.selected.engineGrade) ??
    dependencies.layoutForGrade(0)!;
  const xun = layout.kind === "xun";
  const pageBackground = dependencies.backgroundForPage(host.pageMode, layout);
  if (pageBackground) {
    const texture = host.assets.textures.get(pageBackground.replace("_1600", `_${width}`));
    if (texture) context.drawImage(texture, 0, 0, width, height);
  }
  if (host.pageMode === "level")
    host.progressionPanel.draw(context, host.selected.engineGrade);
  if (host.pageMode === "factory") host.factoryPanel?.draw(context);

  const plan = dependencies.nativeFramePlan(host.assets.definition,
    dependencies.nativePageName(host.pageMode, xun));
  const drawNative = (name: string) => {
    if (host.transformPreviewUiHidden && name === "partsListBoard") return;
    const node = host.assets.nodes.get(name);
    let token = dependencies.attribute(node, "image") ??
      dependencies.attribute(node, "texture");
    if (name === "selectedKartType")
      token = dependencies.kartTypeTexture(host.selected.kartType);
    const texture = host.assets.textures.get(token ?? "");
    const rect = host.rect(name);
    if (texture) context.drawImage(texture, rect.x, rect.y);
  };
  const drawAfterPreview = () => {
    plan.afterPreview.forEach(drawNative);
    if (host.pageMode !== "factory" && !host.transformPreviewUiHidden) {
      const rect = host.rect("partListBar");
      const scrollbar = host.inventoryScroll.geometry(host.assets.partScrollbar, rect);
      const texture = host.assets.textures.get(host.assets.partScrollbar.areaFrame.texture);
      if (scrollbar && texture)
        dependencies.drawScrollbar(context, host.assets.partScrollbar, texture, scrollbar);
    }
  };
  if (host.pageMode !== "factory") {
    plan.beforePreview.forEach(drawNative);
    for (const comparison of host.comparisons) {
      const texture = host.assets.textures.get(comparison.token);
      if (texture) context.drawImage(texture, comparison.rect.x, comparison.rect.y);
    }
  }
  if (host.pageMode === "level" && host.upgradeCatalogEmpty) {
    drawAfterPreview();
    host.finishCanvasFrame();
    return;
  }

  const character = host.options.catalog.characters.find(candidate =>
    candidate.itemId === host.options.selectedCharacterItemId);
  if (!character || !host.panels) {
    drawAfterPreview();
    host.finishCanvasFrame();
    return;
  }

  const preparation = host.preparation?.previewRect ? host.preparation : undefined;
  const previewKart = host.pageMode !== "factory" || host.nativeFactoryAllowed()
    ? preparation?.selected ?? host.selected : undefined;
  const cards = preparation?.previewCard
    ? [...preparation.cards, preparation.previewCard] : host.visibleCards;
  const equipmentKart = previewKart ?? host.selected;
  let equipment = dependencies.composeEquipment(host.options.profile,
    equipmentKart.itemId, character.itemId);
  let configuration = host.configuration;
  if (host.cosmeticPreview) {
    const current = dependencies.currentConfiguration(configuration,
      host.selected.itemId, host.serial());
    configuration = dependencies.writeConfiguration(host.configuration,
      host.selected.itemId, host.serial(), {
        ...current,
        cosmetics: { ...current.cosmetics, family: host.cosmeticPreview.family,
          [host.cosmeticPreview.slot]: host.cosmeticPreview.id },
      });
  }
  equipment = { ...equipment, garage: configuration };
  const previewRect = preparation?.previewRect ?? host.activePreviewRect();
  host.panels.setPreviewSize(previewRect.width, previewRect.height, "garage-x");
  host.panels.render(dependencies.now(), width, height, cards, previewRect,
    previewKart, character, equipment,
    host.pageMode === "parts" && host.coatingMode && !preparation
      ? host.coatingPreview : undefined,
    true, host.renderPixelRatio, host.drawing);
  if (previewKart) {
    host.panels.drawPreview(context, previewRect);
    host.upgrade?.capturePreview(host.panels, previewRect);
  }
  drawAfterPreview();
  host.visibleCards.forEach(({ item, rect, isHovered }, index) => {
    if (host.pageMode === "factory")
      host.factoryPanel?.drawCatalogFrame(context, index, false, isHovered?.());
    const selected = item.itemId === host.selected.itemId;
    if (host.pageMode !== "factory")
      host.drawKartCatalogFrame(context, rect, selected, isHovered?.());
    host.panels!.drawCard(context, item, rect);
    host.drawKartLevelBadge(context, item, rect);
    if (host.pageMode !== "factory") drawOwnershipBadge(context, item, rect);
    if (host.pageMode === "factory" && selected)
      host.factoryPanel?.drawCatalogFrame(context, index, true);
  });
  host.flushTransformPreviewStart();
  if (host.coatingPreview && host.panels.coatingPreviewError &&
      host.status.textContent !== host.panels.coatingPreviewError)
    host.status.textContent = host.panels.coatingPreviewError;
  host.controls.querySelector("[data-transform-preview]")?.setAttribute(
    "aria-pressed", String(host.transformPreviewSessionActive()));
  host.syncTransformPreviewUi();
  host.syncCosmeticPreviewActions();
  if (host.pageMode !== "factory") host.renderPartModels();
  if (host.pageMode === "factory" && host.factoryPanel?.model) {
    const target = host.factoryPanel.model;
    const model = host.modelCache.get(target.source);
    if (model) {
      host.panels.drawAuxiliaryPanel(model, [target.context]);
      host.factoryPanel.modelReady = true;
    }
  }
  host.upgrade?.render(dependencies.now(), host.panels);
  host.preparation?.draw(host.panels);
  host.pointEffects?.render(dependencies.now(), host.panels);
  host.finishCanvasFrame();
}
