import type { GarageAssetNode } from "./garage-asset-bundle";

export interface GarageCardLayoutDependencies {
  attribute(node: GarageAssetNode | undefined,
    name: string): string | undefined;
  pair(value: string | undefined): [number, number];
  numbers(value: string | undefined, count: number,
    label: string): number[];
}

/** Read part card icon, title, and grid spacing from authored BML. */
export function garagePartCardLayout(card: GarageAssetNode,
  horizontalGap: number,
  verticalGap: number,
  dependencies: GarageCardLayoutDependencies) {
  const field = dependencies.attribute;
  const [, , width, height] = (field(card, "leftTopWH") ??
    field(card, "windowRect") ?? "0 0 0 0")
    .split(/\s+/).map(Number);
  const icon = card.children.find(node =>
    field(node, "name") === "shopItemContainer");
  const title = card.children.find(node =>
    field(node, "name") === "itemNameLabel");
  const [iconWidth, iconHeight] = dependencies.pair(field(icon, "windowSize"));
  const [iconAdjustX, iconAdjustY] = dependencies.pair(field(icon, "adjust"));
  const [titleX, titleY, titleWidth, titleHeight] = (
    field(title, "leftTopWH") ?? "0 0 0 0").split(/\s+/).map(Number);
  return {
    width, height, iconWidth, iconHeight, iconAdjustX, iconAdjustY,
    stepX: width! + horizontalGap,
    stepY: height! + verticalGap,
    titleRect: { x: titleX, y: titleY,
      width: titleWidth, height: titleHeight },
    texture: field(card, "texture") ?? "",
  };
}

/** Read the Xun preparation dialog's vehicle card and selector grid. */
export function garagePreparationCardLayout(selector: GarageAssetNode,
  card: GarageAssetNode,
  dependencies: GarageCardLayoutDependencies) {
  const field = dependencies.attribute;
  const [, , width, height] = dependencies.numbers(
    field(card, "windowRect"), 4, "车辆卡片 windowRect");
  const [horizontalMargin, verticalMargin] = dependencies.numbers(
    field(selector, "alignMargin"), 2, "kartSelector alignMargin");
  const [clientLeft, clientTop] = dependencies.numbers(
    field(selector, "clientMargin"), 4, "kartSelector clientMargin");
  const columns = Number(field(selector, "alignSize"));
  const rows = Number(field(selector, "maxLine"));
  if (![width, height, columns, rows].every(value =>
    Number.isInteger(value) && value! > 0))
    throw new Error("强化车辆卡片或网格尺寸无效。");
  return {
    width, height, columns, rows, horizontalMargin, verticalMargin,
    clientLeft, clientTop,
  };
}
