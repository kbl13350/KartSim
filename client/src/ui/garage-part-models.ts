import type { GaragePart } from "./garage-parts-business";

export interface GaragePartModelTarget {
  source: { path: string };
  context: CanvasRenderingContext2D;
  row?: number;
  fallback?: HTMLImageElement;
}

export interface GaragePartModelHost {
  assets: {
    parts?: Array<GaragePart & { legacyImagePath?: string }>;
    partModels: Map<string, string>;
  };
  modelTargets: GaragePartModelTarget[];
  modelCache: { get(source: { path: string }): unknown };
  inventory: HTMLElement;
  panels?: {
    drawAuxiliaryPanel(model: unknown, contexts: CanvasRenderingContext2D[]): void;
  };
  transformPreviewUiHidden: boolean;
  icon(key: string, className: string): HTMLImageElement | undefined;
  addModelTarget(container: HTMLElement, source: { path: string }, className: string,
    row?: number, fallback?: HTMLImageElement,
    dimensions?: [number, number]): void;
}

export interface GaragePartModelDependencies {
  iconKey(part: GaragePart & { legacyImagePath?: string }): string;
  cardLayout(assets: GaragePartModelHost["assets"], family: GaragePart["family"]): {
    iconWidth: number; iconHeight: number;
  };
}

/** Mount a part's static icon and optional XUN 3D model preview. */
export function renderGaragePartVisual(
  host: GaragePartModelHost,
  container: HTMLElement,
  part: GaragePart,
  className: string,
  row: number | undefined,
  dependencies: GaragePartModelDependencies,
): void {
  const visualPart = part.family === "legacy"
    ? host.assets.parts?.find(candidate => candidate.family === "legacy" &&
      candidate.slot === part.slot && candidate.itemId === part.itemId &&
      candidate.legacyImagePath) ?? part
    : part;
  const icon = host.icon(dependencies.iconKey(visualPart), className);
  if (icon) container.append(icon);

  const modelPath = part.family === "xun"
    ? host.assets.partModels.get(`${part.slot}:${part.itemId}`)
    : undefined;
  if (!modelPath) return;
  const layout = dependencies.cardLayout(host.assets, part.family);
  host.addModelTarget(container, { path: modelPath }, className, row, icon,
    className === "garage-inventory-icon"
      ? [layout.iconWidth, layout.iconHeight] : undefined);
}

/** Add a canvas target with the size appropriate for its garage use. */
export function addGaragePartModelTarget(
  host: GaragePartModelHost,
  container: HTMLElement,
  source: { path: string },
  className: string,
  row?: number,
  fallback?: HTMLImageElement,
  dimensions?: [number, number],
): void {
  const canvas = document.createElement("canvas");
  const size = dimensions ?? (className === "garage-inventory-icon" ? [136, 100] :
    className === "garage-part-max-effect" ? [78, 76] : [50, 50]);
  canvas.width = size[0]!;
  canvas.height = size[1]!;
  canvas.className = `garage-part-model ${className}`;
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (!context) return;
  container.append(canvas);
  host.modelTargets.push({ source, context, row, fallback });
}

/** Draw only visible inventory rows, sharing each loaded model across its canvases. */
export function renderGaragePartModels(host: GaragePartModelHost): void {
  if (!host.panels || host.transformPreviewUiHidden) return;
  let kept = 0;
  for (const target of host.modelTargets) {
    if (target.context.canvas.isConnected === false) continue;
    host.modelTargets[kept++] = target;
  }
  host.modelTargets.length = kept;

  const style = host.inventory.style;
  const rowStep = Number.parseFloat(style.getPropertyValue("--garage-part-row-step")) || 149;
  const cardHeight = Number.parseFloat(style.getPropertyValue("--garage-part-card-height")) || 152;
  const visibleHeight = host.inventory.clientHeight || rowStep * 3;
  const grouped = new Map<string, { source: { path: string }; targets: GaragePartModelTarget[] }>();
  for (const target of host.modelTargets) {
    if (target.row !== undefined &&
        (target.row * rowStep + cardHeight <= host.inventory.scrollTop ||
         target.row * rowStep >= host.inventory.scrollTop + visibleHeight)) continue;
    let group = grouped.get(target.source.path);
    if (!group) {
      group = { source: target.source, targets: [] };
      grouped.set(target.source.path, group);
    }
    group.targets.push(target);
  }
  for (const group of grouped.values()) {
    const model = host.modelCache.get(group.source);
    if (!model) continue;
    host.panels.drawAuxiliaryPanel(model, group.targets.map(target => target.context));
    for (const target of group.targets)
      if (target.fallback) target.fallback.hidden = true;
  }
}
