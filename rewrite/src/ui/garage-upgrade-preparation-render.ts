import type { GaragePreviewRect } from "./garage-transform-preview";
import {
  preparationCards, preparationPreviewCard, selectedPreparationVehicle,
  type GaragePreparationCard, type GaragePreparationHost,
  type GaragePreparationItem, type GaragePreparationLayout,
} from "./garage-upgrade-preparation-state";

export interface GarageUpgradeComparison {
  labels: { slotCount: string; tuningPoints: string };
  level: { current: number; next: number };
  slots: { current: number; next: number; increment: number };
  tuningPoints: { current: number; next: number; increment: number };
}

export function compareGarageUpgradeLevels(current: number, next: number):
  GarageUpgradeComparison {
  if (![current, next].every(level =>
    Number.isInteger(level) && level >= 0 && level <= 5) || next < current)
    throw new Error("无效的迅强化等级比较。");
  const slots = (level: number) => Math.min(level, 3);
  const points = (level: number) => level * (level + 1) / 2;
  return {
    labels: { slotCount: "性能槽数量", tuningPoints: "强化点数" },
    level: { current, next },
    slots: { current: slots(current), next: slots(next),
      increment: slots(next) - slots(current) },
    tuningPoints: { current: points(current), next: points(next),
      increment: points(next) - points(current) },
  };
}

export function preparationMethodPanelRect(): GaragePreviewRect {
  return { x: 186, y: 526, width: 519, height: 210 };
}

export function fillPreparationMethodPanel(
  context: CanvasRenderingContext2D, rect: GaragePreviewRect,
): void {
  context.save();
  context.fillStyle = "#e9edf2";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

export interface GaragePreparationCardPresenter {
  drawCard(context: CanvasRenderingContext2D, item: GaragePreparationItem,
    rect: GaragePreviewRect): void;
}

export function drawPreparationCards(context: CanvasRenderingContext2D,
  presenter: GaragePreparationCardPresenter, cards: GaragePreparationCard[],
  selectedId: number, normal: CanvasImageSource, selected: CanvasImageSource): void {
  for (const card of cards) {
    context.drawImage(normal, card.rect.x, card.rect.y, card.rect.width, card.rect.height);
    presenter.drawCard(context, card.item, card.rect);
    if (card.item.itemId === selectedId)
      context.drawImage(selected, card.rect.x, card.rect.y, card.rect.width, card.rect.height);
  }
}

type SizedImage = CanvasImageSource & { width: number; height: number };
export interface GaragePreparationRenderAssets extends GaragePreparationLayout {
  frame: unknown;
  rect: GaragePreviewRect;
  images: Map<string, SizedImage>;
}
export interface GaragePreparationRenderHost extends GaragePreparationHost {
  context: CanvasRenderingContext2D;
  assets?: GaragePreparationRenderAssets;
}
export interface GaragePreparationRenderDependencies {
  fitCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    displayWidth: number, displayHeight: number, pixelRatio: number,
    logicalWidth: number, logicalHeight: number): void;
  pixelRatio(): number;
  drawFrame(context: CanvasRenderingContext2D, frame: unknown,
    image: CanvasImageSource, rect: GaragePreviewRect): void;
}

/** Paint the native BML frame, upgrade panel, vehicle preview and current catalog page. */
export function drawGaragePreparation(host: GaragePreparationRenderHost,
  presenter: GaragePreparationCardPresenter,
  dependencies: GaragePreparationRenderDependencies): void {
  if (!host.assets || host.disposed) return;
  const context = host.context;
  const assets = host.assets;
  const bounds = context.canvas.getBoundingClientRect();
  dependencies.fitCanvas(context.canvas, context, bounds.width, bounds.height,
    dependencies.pixelRatio(), 1600, 900);
  context.imageSmoothingEnabled = true;
  context.clearRect(0, 0, 1600, 900);
  dependencies.drawFrame(context, assets.frame, assets.images.get("frame")!, assets.rect);
  const board = assets.rects.get("ImageBoard")!;
  context.drawImage(assets.images.get("tuning_upgradePopupBg")!,
    board.x, board.y, board.width, board.height);
  fillPreparationMethodPanel(context, preparationMethodPanelRect());
  for (const name of ["arrow0", "arrow1", "arrow2"]) {
    const rect = assets.rects.get(name)!;
    const image = assets.images.get(name === "arrow0"
      ? "tuning_arrow_g" : "tuning_arrow_g_s")!;
    context.drawImage(image, 0, 0, image.width / 3, image.height,
      rect.x, rect.y, rect.width, rect.height);
  }
  const preview = preparationPreviewCard(host);
  if (preview) presenter.drawCard(context, preview.item, preview.rect);
  drawPreparationCards(context, presenter, preparationCards(host),
    selectedPreparationVehicle(host).itemId,
    assets.images.get("cardNormal")!, assets.images.get("cardSelected")!);
}
