import type { GarageAssetRect } from "./garage-asset-bundle";

export interface GarageCardGridAssets {
  rects: Map<string, GarageAssetRect>;
  kartCardLayout: {
    contentAdjustX: number; contentAdjustY: number;
    pageSize: number; width: number; gapX: number; height: number;
  };
  partGridLayout: { columns: number; rows: number };
}

export interface GaragePartGridLayout { width: number; stepY: number }

/** Native bounds of the visible kart card strip. */
export function garageKartCardsRect(assets: GarageCardGridAssets): GarageAssetRect {
  const selector = assets.rects.get("kartSelector");
  if (!selector) throw new Error("P3543 车库布局缺少 kartSelector。");
  const card = assets.kartCardLayout;
  return {
    x: selector.x + card.contentAdjustX,
    y: selector.y + card.contentAdjustY,
    width: card.pageSize * card.width + (card.pageSize - 1) * card.gapX,
    height: card.height,
  };
}

/** Native bounds of the parts list for classic or Xun cards. */
export function garagePartsGridRect(assets: GarageCardGridAssets,
  kind: string,
  cardLayout: (assets: GarageCardGridAssets,
    kind: string) => GaragePartGridLayout): GarageAssetRect {
  const selector = assets.rects.get("partsSelect");
  if (!selector) throw new Error("车库部件列表布局节点缺失。");
  const card = cardLayout(assets, kind);
  return { x: selector.x, y: selector.y,
    width: card.width * assets.partGridLayout.columns,
    height: card.stepY * assets.partGridLayout.rows };
}

export interface GarageUiPart {
  family: string;
  slot: string;
  itemId: number;
  grade: number;
  value: number;
  legacyImagePath?: string;
  legacyCategory?: string;
}

/** The exact icon token used to resolve native part art. */
export function garagePartIconKey(part: GarageUiPart,
  legacyCategory: (slot: string) => string): string {
  if (part.family === "legacy")
    return `legacy:${part.legacyImagePath ??
      `missing/${part.legacyCategory ?? legacyCategory(part.slot)}/${part.itemId}`}`;
  return `parts:parts${part.slot[0]!.toUpperCase() + part.slot.slice(1)}` +
    `${part.family === "xun" ? "12_" : `_${part.itemId}`}${part.grade}`;
}

/** Whether this Xun part is the last unlocked value in its quality group. */
export function isGarageMaxXunPart(part: GarageUiPart,
  available: GarageUiPart[]): boolean {
  if (part.family !== "xun") return false;
  const matching = available.filter(candidate => candidate.family === "xun" &&
    candidate.slot === part.slot && candidate.grade === part.grade)
    .sort((left, right) => left.value - right.value ||
      left.itemId - right.itemId);
  return matching.length > 0 &&
    matching[matching.length - 1]!.itemId === part.itemId &&
    matching[matching.length - 1]!.value === part.value;
}

/** Native overlay nodes that appear around the kart preview for each page. */
export function garagePageOverlayNames(page: string, xun: boolean): string[] {
  if (page === "factory") return [];
  if (page === "level") return xun ?
    ["backGround_12", "textPerformList_12", "selectedKartType"] :
    ["selectedKartType"];
  return ["partsListBoard",
    xun ? "textPerformList_12" : "textPerformList", "selectedKartType"];
}

export interface GarageActionButton {
  classList: { add(...classes: string[]): void };
  style: { fontSize: string; setProperty(name: string, value: string): void };
}

/** Apply the authored action button font and state colors. */
export function styleGarageActionButton(button: GarageActionButton,
  style: { fontSize: number; colors: string[] } | undefined,
  kind: string): void {
  button.classList.add("garage-skill-action", `garage-skill-action-${kind}`);
  if (!style) return;
  button.style.fontSize = `${style.fontSize}px`;
  style.colors.forEach((color, index) =>
    button.style.setProperty(`--action-text-${index}`, color));
}

export interface GaragePointerButton {
  disabled: boolean;
  addEventListener(type: string, callback: () => void): void;
}

/** Track whether the pointer currently rests on an enabled action. */
export function garagePointerPresence(button: GaragePointerButton): () => boolean {
  let hovering = false;
  button.addEventListener("pointerenter", () => {
    hovering = !button.disabled;
  });
  button.addEventListener("pointerleave", () => { hovering = false; });
  button.addEventListener("pointercancel", () => { hovering = false; });
  return () => hovering && !button.disabled;
}

/** The two stat rows shown in the Xun level result. */
export function garageXunUpgradeRows(summary: {
  beforeLevel: number; afterLevel: number;
  beforePoints: number; afterPoints: number;
}) {
  return [
    { label: "性能槽数量", before: String(Math.min(summary.beforeLevel, 3)),
      after: String(Math.min(summary.afterLevel, 3)) },
    { label: "强化点数", before: String(summary.beforePoints),
      after: String(summary.afterPoints) },
  ];
}
