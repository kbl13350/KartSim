import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageScrollbarGeometry {
  button: { y: number; height: number };
}

export type GarageScrollbarLayout = (
  scrollbar: unknown,
  rect: GaragePreviewRect,
  ratio: number,
  offset: number,
  scrollTop: number,
  totalHeight: number,
) => GarageScrollbarGeometry | undefined;

/** Owns the Garage inventory's snapped paging and pointer-driven scrollbar. */
export class GarageInventoryScroll {
  grab?: number;

  constructor(
    readonly viewport: HTMLElement,
    readonly hitTarget: HTMLElement,
    readonly snapStep: (() => number) | undefined,
    readonly layout: GarageScrollbarLayout,
  ) {}

  maximum(): number {
    const range = Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight);
    const step = this.snapStep?.();
    return step && Number.isFinite(step) && step > 0
      ? Math.floor(range / step) * step : range;
  }

  geometry(scrollbar: unknown, rect: GaragePreviewRect): GarageScrollbarGeometry | undefined {
    const height = this.viewport.clientHeight;
    const totalHeight = height + this.maximum();
    if (totalHeight <= height || height <= 0) return undefined;
    return this.layout(scrollbar, rect, totalHeight / height,
      0, this.viewport.scrollTop, totalHeight);
  }

  page(direction: number): boolean {
    const maximum = this.maximum();
    if (maximum <= 0) return false;
    const next = Math.max(0, Math.min(maximum,
      this.viewport.scrollTop + direction * this.viewport.clientHeight));
    if (next !== this.viewport.scrollTop) this.viewport.scrollTop = next;
    return true;
  }

  down(event: PointerEvent, scrollbar: unknown, rect: GaragePreviewRect,
    authoredY: number): void {
    const geometry = this.geometry(scrollbar, rect);
    if (!geometry) return;
    event.preventDefault();
    this.hitTarget.setPointerCapture(event.pointerId);
    if (authoredY >= geometry.button.y &&
        authoredY <= geometry.button.y + geometry.button.height) {
      this.grab = authoredY - geometry.button.y;
      return;
    }
    this.viewport.scrollTop += authoredY < geometry.button.y
      ? -this.viewport.clientHeight : this.viewport.clientHeight;
    this.grab = geometry.button.height / 2;
    this.move(scrollbar, rect, authoredY);
  }

  move(scrollbar: unknown, rect: GaragePreviewRect, authoredY: number): void {
    if (this.grab === undefined) return;
    const geometry = this.geometry(scrollbar, rect);
    if (!geometry) return;
    const travel = rect.height - geometry.button.height;
    const maximum = this.maximum();
    this.viewport.scrollTop = travel <= 0 ? 0 :
      Math.max(0, Math.min(maximum,
        (authoredY - rect.y - this.grab) * maximum / travel));
  }

  up(pointerId: number): void {
    this.grab = undefined;
    if (this.hitTarget.hasPointerCapture(pointerId))
      this.hitTarget.releasePointerCapture(pointerId);
  }
}
