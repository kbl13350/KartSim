import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageFrameKart {
  kind: string;
  itemId: number;
  engineGrade: number;
}

export interface GarageFrameCanvasHost {
  assets: {
    stage: { width: number; height: number };
    textures: Map<string, HTMLImageElement | HTMLCanvasElement | ImageBitmap>;
    kartCardLayout: {
      width: number; height: number; selectedTexture: string; texture: string;
    };
  };
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  drawing: {
    drawCanvasLayer(canvas: HTMLCanvasElement, rect: GaragePreviewRect,
      revision: number): void;
    endFrame(): void;
  };
  controlCanvas: { draw(drawing: GarageFrameCanvasHost["drawing"],
    ratio: number, frozen: boolean): void };
  controls: HTMLElement;
  search: HTMLInputElement;
  surface: HTMLElement;
  renderPixelRatio: number;
  strengtheningSnapshot?: HTMLCanvasElement;
  options: { taskbar?: { compositeFrame?: {
    canvas: HTMLCanvasElement;
    rect: { left: number; top: number; width: number; height: number };
    revision: number;
  } } };
  selected: GarageFrameKart;
  configuration: unknown;
  serial(): number;
  captureStage(): HTMLCanvasElement;
  paintTaskbar(): void;
}

export interface GarageFrameCanvasDependencies {
  currentConfiguration(configuration: unknown, itemId: number,
    serial: number): { progression?: { level?: number; kind?: string } };
  progressionKind(grade: number): "xun" | "classic" | undefined;
  badgeTexture(grade: number, level: number | undefined): string | undefined;
  levelLabel(level: number | undefined): string | undefined;
  drawLabel(context: CanvasRenderingContext2D, label: string,
    rect: GaragePreviewRect, style: Record<string, unknown>): void;
}

/** Keep the last fully composed stage while a strengthening dialog takes over. */
export function captureGarageStrengtheningStage(host: GarageFrameCanvasHost): void {
  if (!host.strengtheningSnapshot) host.strengtheningSnapshot = host.captureStage();
}

/** Copy the visible stage pixels, honoring the current canvas transform and pixel ratio. */
export function captureGarageStage(host: GarageFrameCanvasHost): HTMLCanvasElement {
  const transform = host.context.getTransform();
  const { width, height } = host.assets.stage;
  const snapshot = document.createElement("canvas");
  snapshot.width = Math.max(1, Math.round(width * transform.a));
  snapshot.height = Math.max(1, Math.round(height * transform.d));
  const context = snapshot.getContext("2d");
  if (!context) throw new Error("车库冻结画布不可用。");
  context.drawImage(host.canvas, transform.e, transform.f,
    width * transform.a, height * transform.d,
    0, 0, snapshot.width, snapshot.height);
  return snapshot;
}

/** Overlay controls, hide disabled search input, composite taskbar and commit a frame. */
export function finishGarageCanvasFrame(host: GarageFrameCanvasHost, frozen = false): void {
  host.controlCanvas.draw(host.drawing, host.renderPixelRatio, frozen);
  host.search.inert = host.controls.inert || frozen;
  host.search.style.visibility = host.search.inert ? "hidden" : "visible";
  host.paintTaskbar();
  host.drawing.endFrame();
}

/** Place the caller's taskbar frame into stage coordinates. */
export function paintGarageTaskbar(host: GarageFrameCanvasHost): void {
  const frame = host.options.taskbar?.compositeFrame;
  if (!frame) return;
  const canvasBounds = host.canvas.getBoundingClientRect();
  if (!canvasBounds.width || !canvasBounds.height) return;
  host.context.save();
  host.context.setTransform(host.canvas.width / canvasBounds.width, 0, 0,
    host.canvas.height / canvasBounds.height, 0, 0);
  host.drawing.drawCanvasLayer(frame.canvas, {
    x: frame.rect.left - canvasBounds.left,
    y: frame.rect.top - canvasBounds.top,
    width: frame.rect.width,
    height: frame.rect.height,
  }, frame.revision);
  host.context.restore();
}

export function garageAuthoredPointerY(host: GarageFrameCanvasHost, event: PointerEvent): number {
  const bounds = host.surface.getBoundingClientRect();
  return (event.clientY - bounds.top) * host.assets.stage.height / bounds.height;
}

/** Select the corresponding atlas half for a hovered or selected kart card. */
export function drawGarageKartCatalogFrame(host: GarageFrameCanvasHost,
  context: CanvasRenderingContext2D, rect: GaragePreviewRect,
  selected: boolean, hovered = false): void {
  if (!selected && !hovered) return;
  const layout = host.assets.kartCardLayout;
  const texture = host.assets.textures.get(selected ? layout.selectedTexture : layout.texture);
  if (!texture) return;
  const sourceX = selected && texture.width >= layout.width * 2 ? layout.width : 0;
  context.drawImage(texture, sourceX, 0, layout.width, layout.height,
    rect.x, rect.y, rect.width, rect.height);
}

/** Paint the earned XUN or classic level emblem over a kart catalog card. */
export function drawGarageKartLevelBadge(host: GarageFrameCanvasHost,
  context: CanvasRenderingContext2D, kart: GarageFrameKart,
  rect: GaragePreviewRect, dependencies: GarageFrameCanvasDependencies): void {
  if (kart.kind !== "kart") return;
  const progression = dependencies.currentConfiguration(host.configuration,
    kart.itemId, host.serial()).progression;
  const level = progression?.level;
  const kind = dependencies.progressionKind(kart.engineGrade);
  const textureKey = dependencies.badgeTexture(kart.engineGrade, level);
  if (!kind || !textureKey || !progression || progression.kind !== kind) return;
  const texture = host.assets.textures.get(textureKey);
  if (!texture) return;
  const width = kind === "xun" ? 30 : 26;
  const height = kind === "xun" ? 28 : 18;
  const x = rect.x + rect.width - (kind === "xun" ? 8 : 10) - width;
  const y = rect.y + (kind === "xun" ? 8 : 10);
  context.drawImage(texture, x, y, width, height);
  if (kind !== "classic") return;
  const label = dependencies.levelLabel(level);
  if (!label) return;
  dependencies.drawLabel(context, label, { x, y, width, height }, {
    family: "P3528 Source Han Sans CN Garage", size: 12, stroke: 1,
    kind: "label", color: "white", strokeColor: "rgba(113, 0, 0, 0.95)",
    align: "center", verticalAlign: "center",
  });
}
