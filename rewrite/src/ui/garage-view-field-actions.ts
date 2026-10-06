export interface GarageInventoryScrollHost {
  inventory: HTMLElement;
  inventoryScrollHit: HTMLElement;
}

/** CSS-authored part row height is resolved when scrolling, after layout. */
export function garageInventoryRowStep(host: GarageInventoryScrollHost): number | undefined {
  const value = Number.parseFloat(
    host.inventory.style.getPropertyValue("--garage-part-row-step"));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function createGarageInventoryScroll<T>(
  host: GarageInventoryScrollHost,
  create: (inventory: HTMLElement, hitTarget: HTMLElement,
    step: () => number | undefined) => T,
): T {
  return create(host.inventory, host.inventoryScrollHit,
    () => garageInventoryRowStep(host));
}

export interface GaragePreviewActionHost {
  coatingPreview?: unknown;
  cosmeticPreview?: unknown;
  transformPreviewStartPending: boolean;
  transformPreviewUiHidden: boolean;
  panels?: { setTransformPreview?(active: boolean): void };
  coatingMode: boolean;
  cosmeticSlot?: unknown;
  button<T>(label: string, action: () => void): T;
  setPartPreview(value: undefined): void;
  syncTransformPreviewUi(): void;
  syncCosmeticPreviewActions(): void;
  updatePerformance(): void;
  requestCoating(value: undefined): void;
  requestCosmetic(value: undefined): void;
  requestEquip(value: undefined): void;
}

/** Cancel every pending visual preview before recomputing vehicle performance. */
export function createGarageCancelPreviewButton<T>(host: GaragePreviewActionHost): T {
  return host.button("取消预览", () => {
    const hadCosmeticPreview = host.cosmeticPreview !== undefined;
    host.transformPreviewStartPending = false;
    host.coatingPreview = undefined;
    host.cosmeticPreview = undefined;
    if (!host.transformPreviewUiHidden) host.setPartPreview(undefined);
    if (hadCosmeticPreview) host.panels?.setTransformPreview?.(false);
    host.syncTransformPreviewUi();
    host.syncCosmeticPreviewActions();
    host.updatePerformance();
  });
}

/** Remove from the active coating, cosmetic or mechanical part lane. */
export function createGarageRemovePartButton<T>(host: GaragePreviewActionHost): T {
  return host.button("拆除部件", () => {
    if (host.coatingMode) host.requestCoating(undefined);
    else if (host.cosmeticSlot) host.requestCosmetic(undefined);
    else host.requestEquip(undefined);
  });
}
