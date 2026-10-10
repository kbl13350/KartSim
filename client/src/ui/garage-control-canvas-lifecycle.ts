import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageControlCanvasLayer {
  canvas: HTMLCanvasElement;
  rect: GaragePreviewRect;
  live: boolean;
  clip?: GaragePreviewRect;
  alpha?: number;
}

export interface GarageControlCanvasHost {
  surface: HTMLElement;
  width: number;
  height: number;
  observer: MutationObserver;
  images: Map<string, HTMLImageElement>;
  layers: GarageControlCanvasLayer[];
  dirty: boolean;
  ratio: number;
  overlayOnly: boolean;
  disposed: boolean;
  events: string[];
  invalidate: () => void;
  rebuild(): void;
}

const changed = (record: MutationRecord) =>
  record.type !== "attributes" ||
  (record.target as Element).getAttribute(record.attributeName!) !== record.oldValue;

/** Observe DOM changes and interaction states that affect the raster overlay. */
export function initializeGarageControlCanvas(host: GarageControlCanvasHost,
  surface: HTMLElement, width: number, height: number): void {
  host.surface = surface;
  host.width = width;
  host.height = height;
  host.observer = new MutationObserver(records => {
    if (records.some(changed)) host.dirty = true;
  });
  host.observer.observe(surface, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeOldValue: true,
  });
  host.events.forEach(event => surface.addEventListener(event, host.invalidate, true));
  document.fonts.addEventListener("loadingdone", host.invalidate);
}

/** Rebuild only when DOM, scale or overlay selection changed. */
export function drawGarageControlCanvas(host: GarageControlCanvasHost,
  painter: { drawCanvasLayer(canvas: HTMLCanvasElement, rect: GaragePreviewRect,
    frame?: number, clip?: GaragePreviewRect, alpha?: number): void },
  ratio: number, overlayOnly = false): void {
  if (host.disposed) return;
  if (host.observer.takeRecords().some(changed)) host.dirty = true;
  if (ratio !== host.ratio || overlayOnly !== host.overlayOnly) host.dirty = true;
  host.ratio = ratio;
  host.overlayOnly = overlayOnly;
  if (host.dirty) {
    host.rebuild();
    host.dirty = false;
  }
  for (const layer of host.layers) {
    painter.drawCanvasLayer(layer.canvas, layer.rect,
      layer.live ? undefined : 0, layer.clip, layer.alpha);
  }
}

export function disposeGarageControlCanvas(host: GarageControlCanvasHost): void {
  host.disposed = true;
  host.observer.disconnect();
  host.events.forEach(event =>
    host.surface.removeEventListener(event, host.invalidate, true));
  document.fonts.removeEventListener("loadingdone", host.invalidate);
  host.images.forEach(image => { image.onload = null; });
  host.images.clear();
  host.layers = [];
}

/** Cache background images; return only fully decoded images to the painter. */
export function garageControlImage(host: GarageControlCanvasHost,
  url: string): HTMLImageElement | undefined {
  let image = host.images.get(url);
  if (!image) {
    image = new Image();
    image.onload = host.invalidate;
    image.src = url;
    host.images.set(url, image);
  }
  return image.complete && image.naturalWidth ? image : undefined;
}

export function garageControlZIndex(element: Element): number {
  return Number.parseInt(getComputedStyle(element).zIndex, 10) || 0;
}

/** CSS object-fit rectangle in authored canvas coordinates. */
export function garageObjectFitRect(rect: GaragePreviewRect,
  imageWidth: number, imageHeight: number, fit: string): GaragePreviewRect {
  if (fit !== "contain" && fit !== "cover" && fit !== "scale-down" && fit !== "none")
    return rect;
  const scale = fit === "none" ? 1
    : fit === "cover"
      ? Math.max(rect.width / imageWidth, rect.height / imageHeight)
      : Math.min(fit === "scale-down" ? 1 : Infinity,
        rect.width / imageWidth, rect.height / imageHeight);
  return {
    x: rect.x + (rect.width - imageWidth * scale) / 2,
    y: rect.y + (rect.height - imageHeight * scale) / 2,
    width: imageWidth * scale,
    height: imageHeight * scale,
  };
}
