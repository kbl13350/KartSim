import type { GaragePreviewRect } from "./garage-transform-preview";
import type {
  GarageProgressionCandidate, GaragePreparationResult,
  GarageUpgradePreparationState,
} from "./garage-progression-session";

export type GaragePreparationItem = GarageProgressionCandidate["item"] & { title: string };

export interface GaragePreparationCard {
  item: GaragePreparationItem;
  rect: GaragePreviewRect;
}

export interface GaragePreparationLayout {
  rects: Map<string, GaragePreviewRect>;
  cardLayout: {
    width: number;
    height: number;
    columns: number;
    horizontalMargin: number;
    verticalMargin: number;
    clientLeft: number;
    clientTop: number;
  };
}

export interface GaragePreparationHost {
  state: GarageUpgradePreparationState;
  assets?: GaragePreparationLayout;
  disposed: boolean;
  pageFrameObservers: Array<{ disconnect(): void }>;
  pageFrameRedraws?: Array<() => void>;
  element: Pick<HTMLElement, "remove">;
  previousFocus?: Pick<HTMLElement, "isConnected" | "focus">;
  onClose(value?: GaragePreparationResult): void;
}

/** The selected vehicle is the single source of truth for the preview and cards. */
export function selectedPreparationVehicle(host: GaragePreparationHost): GaragePreparationItem {
  return host.state.selected.item as GaragePreparationItem;
}

export function preparationPreviewRect(host: GaragePreparationHost): GaragePreviewRect | undefined {
  return host.assets?.rects.get("itemView");
}

export function preparationPreviewCard(host: GaragePreparationHost):
  GaragePreparationCard | undefined {
  const rect = preparationPreviewRect(host);
  return rect ? { item: selectedPreparationVehicle(host), rect } : undefined;
}

/** Original BML grid coordinates for the current 16-vehicle page. */
export function preparationCards(host: GaragePreparationHost): GaragePreparationCard[] {
  const selector = host.assets?.rects.get("kartSelector");
  if (!selector) return [];
  const layout = host.assets!.cardLayout;
  return host.state.visible.map((candidate, index) => ({
    item: candidate.item as GaragePreparationItem,
    rect: {
      x: selector.x + layout.clientLeft +
        (index % layout.columns) * (layout.width + layout.horizontalMargin),
      y: selector.y + layout.clientTop +
        Math.floor(index / layout.columns) * (layout.height + layout.verticalMargin),
      width: layout.width,
      height: layout.height,
    },
  }));
}

/** Canvas page arrows must be redrawn after their CSS boxes resize. */
export function resizePreparationCanvases(host: GaragePreparationHost): void {
  host.pageFrameRedraws?.forEach(redraw => redraw());
}

export function clearPreparationPageFrames(host: GaragePreparationHost): void {
  host.pageFrameObservers.forEach(observer => observer.disconnect());
  host.pageFrameObservers.length = 0;
  host.pageFrameRedraws?.splice(0);
}

export function disposeGaragePreparation(host: GaragePreparationHost): void {
  if (host.disposed) return;
  host.disposed = true;
  host.state.settle(false);
  clearPreparationPageFrames(host);
  host.assets = undefined;
  host.element.remove();
}

/** Commit only an available prepared upgrade; cancellation restores keyboard focus. */
export function closeGaragePreparation(host: GaragePreparationHost, accept: boolean): void {
  if (host.disposed || (accept && (!host.assets || !host.state.canStart))) return;
  const result = host.state.settle(accept);
  disposeGaragePreparation(host);
  host.onClose(result);
  if (!result && host.previousFocus?.isConnected) host.previousFocus.focus();
}
