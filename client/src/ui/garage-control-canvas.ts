import type { GaragePreviewRect } from "./garage-transform-preview";
import {
  disposeGarageControlCanvas, drawGarageControlCanvas,
  garageControlImage, initializeGarageControlCanvas,
  type GarageControlCanvasHost, type GarageControlCanvasLayer,
} from "./garage-control-canvas-lifecycle";
import {
  rebuildGarageControlCanvas,
  type GarageControlCanvasPaintDependencies,
} from "./garage-control-canvas-rebuild";

export interface GarageControlCanvasPainter {
  drawCanvasLayer(canvas: HTMLCanvasElement, rect: GaragePreviewRect,
    frame?: number, clip?: GaragePreviewRect, alpha?: number): void;
}

/** A DOM-backed Garage overlay rasterizer with cached static and live layers. */
export class GarageControlCanvas implements GarageControlCanvasHost {
  surface!: HTMLElement;
  width!: number;
  height!: number;
  observer!: MutationObserver;
  images = new Map<string, HTMLImageElement>();
  layers: GarageControlCanvasLayer[] = [];
  dirty = true;
  ratio = 1;
  overlayOnly = false;
  disposed = false;
  invalidate = () => { this.dirty = true; };
  readonly events = [
    "pointerover", "pointerout", "pointerdown", "pointerup", "pointercancel",
    "focus", "blur", "scroll", "load", "change", "input",
  ];

  constructor(surface: HTMLElement, width: number, height: number,
    readonly dependencies: GarageControlCanvasPaintDependencies) {
    initializeGarageControlCanvas(this, surface, width, height);
  }

  draw(painter: GarageControlCanvasPainter, ratio: number,
    overlayOnly = false): void {
    drawGarageControlCanvas(this, painter, ratio, overlayOnly);
  }

  dispose(): void {
    disposeGarageControlCanvas(this);
  }

  image(url: string): HTMLImageElement | undefined {
    return garageControlImage(this, url);
  }

  rebuild(): void {
    rebuildGarageControlCanvas(this, this.dependencies);
  }
}
