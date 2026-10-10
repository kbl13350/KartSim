import type { FactoryPickerRect } from "./garage-factory-picker";

export interface GarageFactoryLayout {
  columns: number;
  rows: number;
  gapX: number;
  gapY: number;
  cardWidth: number;
  cardHeight: number;
  kartZoom: number;
  pageSize: number;
  rect: FactoryPickerRect;
  thumbnail(index: number): FactoryPickerRect;
}

export interface GarageFactoryViewAssets {
  nodes: Map<string, unknown>;
  rects: Map<string, FactoryPickerRect>;
  fontFamily?: string;
  fontLineScale?: number;
}

export interface GarageFactoryViewHost {
  assets: GarageFactoryViewAssets;
  onChange: (configuration: unknown) => void;
  onConfirm: (message: string, action: () => void) => void;
  onTabChange: () => void;
  onTutorial?: () => void;
  element: HTMLElement;
  catalog: boolean;
  scoreLabel?: HTMLElement;
  emptyVehicleInfo: boolean;
  place(element: HTMLElement, rect: FactoryPickerRect): void;
}

export interface GarageFactoryViewDependencies {
  attribute(node: unknown, name: string): string | undefined;
  childRect(node: unknown, parent: FactoryPickerRect): FactoryPickerRect;
}

/** Initialize the Factory panel's callbacks and root after its DOM field is created. */
export function initializeGarageFactoryView(
  host: GarageFactoryViewHost,
  assets: GarageFactoryViewAssets,
  onChange: GarageFactoryViewHost["onChange"],
  onConfirm: GarageFactoryViewHost["onConfirm"],
  onTabChange: GarageFactoryViewHost["onTabChange"],
  onTutorial?: GarageFactoryViewHost["onTutorial"],
): void {
  host.assets = assets;
  host.onChange = onChange;
  host.onConfirm = onConfirm;
  host.onTabChange = onTabChange;
  host.onTutorial = onTutorial;
  host.element.className = "garage-factory";
}

export function garageFactoryShowsCatalog(host: GarageFactoryViewHost): boolean {
  return host.catalog;
}

export function garageFactoryPreviewRect(host: GarageFactoryViewHost): FactoryPickerRect | undefined {
  return host.assets.rects.get("tuneCardAttach");
}

/** Calculate the native card grid and thumbnail bounds from the authored layout. */
export function garageFactoryCatalogLayout(
  assets: GarageFactoryViewAssets,
  dependencies: GarageFactoryViewDependencies,
): GarageFactoryLayout {
  const grid = assets.nodes.get("itemGrid");
  const gridRect = assets.rects.get("itemGrid")!;
  const cardRect = assets.rects.get("garageCardTemplate")!;
  const columns = Number(dependencies.attribute(grid, "alignSize"));
  const rows = Number(dependencies.attribute(grid, "maxLine"));
  const [gapX, gapY] = dependencies.attribute(grid, "alignMargin")!.split(/\s+/).map(Number);
  return {
    columns, rows, gapX: gapX!, gapY: gapY!,
    cardWidth: cardRect.width, cardHeight: cardRect.height,
    kartZoom: Number(dependencies.attribute(assets.nodes.get("factoryKartItemPanel"), "zoom")),
    pageSize: columns * rows,
    rect: {
      x: gridRect.x, y: gridRect.y,
      width: columns * cardRect.width + (columns - 1) * gapX!,
      height: rows * cardRect.height + (rows - 1) * gapY!,
    },
    thumbnail: index => dependencies.childRect(
      assets.nodes.get("/factoryCard/garageCardTemplate/shopItemContainer"), {
        x: gridRect.x + index % columns * (cardRect.width + gapX!),
        y: gridRect.y + Math.floor(index / columns) * (cardRect.height + gapY!),
        width: cardRect.width, height: cardRect.height,
      }),
  };
}

export function placeGarageFactoryElement(
  host: GarageFactoryViewHost,
  element: HTMLElement,
  rect: FactoryPickerRect,
): void {
  Object.assign(element.style, {
    position: "absolute",
    left: `${rect.x}px`, top: `${rect.y}px`,
    width: `${rect.width}px`, height: `${rect.height}px`,
  });
  host.element.append(element);
}

/** Render a Factory label using authored margin, font, alignment and line-height data. */
export function addGarageFactoryLabel(
  host: GarageFactoryViewHost,
  text: string | undefined,
  rect: FactoryPickerRect,
  nodeName: string | undefined,
  dependencies: GarageFactoryViewDependencies,
): HTMLElement {
  const label = document.createElement("div");
  label.textContent = text as string;
  if (nodeName) {
    const node = host.assets.nodes.get(nodeName);
    const [left, top, right, bottom] =
      (dependencies.attribute(node, "marginRect") ?? "0 0 0 0")
        .split(/\s+/).map(Number);
    const fontSize = Number(dependencies.attribute(node, "textRender")?.match(/\d+/)?.[0] ?? 14);
    const alignment = dependencies.attribute(node, "textAlign");
    Object.assign(label.style, {
      boxSizing: "border-box",
      padding: `${top}px ${right}px ${bottom}px ${left}px`,
      color: "white",
      font: `${fontSize}px "${host.assets.fontFamily ?? "P3528 Source Han Sans CN Ready"}", sans-serif`,
      overflowWrap: "anywhere",
      whiteSpace: "pre-wrap",
      textAlign: alignment?.includes("right") ? "right" : "left",
      lineHeight: alignment?.includes("vcenter") ? `${rect.height}px` :
        `${Math.round(fontSize * (host.assets.fontLineScale ?? 1)) +
          Number(dependencies.attribute(node, "lineGap") ?? 2)}px`,
    });
  }
  host.place(label, rect);
  return label;
}

const scoreFields = [
  "TransAccelFactor", "SteerConstraint", "DriftEscapeForce",
  "NormalBoosterTime", "DriftMaxGauge",
] as const;

/** Display the five signed native scores or the unavailable-state explanation. */
export function updateGarageFactoryScoreLabel(
  host: GarageFactoryViewHost,
  scores?: Partial<Record<(typeof scoreFields)[number], number>>,
  title?: string,
): void {
  if (!host.scoreLabel) return;
  if (host.emptyVehicleInfo) {
    host.scoreLabel.textContent = "";
    host.scoreLabel.title = "当前车辆改装信息不可用";
    return;
  }
  host.scoreLabel.textContent = scoreFields
    .map(field => scores ? String(((scores[field] as number) << 16) >> 16) : "—")
    .join("\n");
  host.scoreLabel.title = title ?? "客户端五项评分";
}
