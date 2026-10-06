export interface GarageViewActionKart {
  itemId: number;
  systemKey?: string;
}

export interface GarageViewActionHost {
  selected: GarageViewActionKart;
  options: {
    profile: { equipment: { itemIds: number[]; kartSerial: number } };
    speed: unknown;
    version?: unknown;
    library: unknown;
  };
  previews: Map<string, { spec: unknown }>;
  assets: { strings?: Map<string, string>; parts?: unknown[] };
  inventory: HTMLElement;
  inventoryHitTestFrame: number;
  inventoryPointer?: { x: number; y: number };
  previewParts: Map<Element, unknown>;
  transformPreviewUiHidden: boolean;
  coatingPreview?: unknown;
  cosmeticPreview?: unknown;
  previewPart?: unknown;
  tutorialClose?: () => void;
  tutorialLoading: boolean;
  disposed: boolean;
  pageMode: string;
  surface: HTMLElement;
  status: HTMLElement;
  frozen: boolean;
  confirmation?: { pending?: boolean };
  upgrade?: unknown;
  preparation?: unknown;
  skillSelection?: unknown;
  exceedTypeChange?: unknown;
  setPartPreview(part: unknown): void;
  updatePerformance(): void;
  baseFor(kart: GarageViewActionKart): unknown;
}

export interface GarageViewActionDependencies {
  defaultVersion: unknown;
  previewKey(kart: GarageViewActionKart): string;
  createPreview(kart: GarageViewActionKart, speed: unknown,
    parameter: undefined, version: unknown): { spec: unknown };
  partLabel(part: unknown, strings: Map<string, string>, parts: unknown[]): string;
  hitTest(inventory: HTMLElement, x: number, y: number,
    elementAt: (x: number, y: number) => Element | null,
    parts: Map<Element, unknown>): unknown;
  loadFactoryTutorial(library: unknown, surface: HTMLElement): Promise<() => void>;
  cancelFrame(id: number): void;
  requestFrame(callback: () => void): number;
  elementFromPoint(x: number, y: number): Element | null;
}

/** Serial numbers only belong to the kart currently equipped in the profile. */
export function garageSelectedKartSerial(host: GarageViewActionHost): number {
  return host.selected.itemId === host.options.profile.equipment.itemIds[3]
    ? host.options.profile.equipment.kartSerial : 0;
}

export function garageSpeedVersion(host: GarageViewActionHost,
  dependencies: GarageViewActionDependencies): unknown {
  return host.options.version ?? dependencies.defaultVersion;
}

export function garageBaseSpecification(host: GarageViewActionHost): unknown {
  return host.baseFor(host.selected);
}

/** Reuse the preview specification for a kart, creating its defaults on demand. */
export function garageBaseForKart(host: GarageViewActionHost, kart: GarageViewActionKart,
  dependencies: GarageViewActionDependencies): unknown {
  const identity = { itemId: kart.itemId, systemKey: kart.systemKey };
  const key = dependencies.previewKey(identity);
  let preview = host.previews.get(key);
  if (!preview) {
    preview = dependencies.createPreview(identity, host.options.speed, undefined,
      garageSpeedVersion(host, dependencies));
    host.previews.set(key, preview);
  }
  return preview.spec;
}

export function garagePartLabel(host: GarageViewActionHost, part: unknown,
  dependencies: GarageViewActionDependencies): string {
  return dependencies.partLabel(part, host.assets?.strings ?? new Map(),
    host.assets?.parts ?? []);
}

/** Coalesce pointer hit tests to one animation frame after inventory layout settles. */
export function rehitGarageInventoryPreview(host: GarageViewActionHost,
  dependencies: GarageViewActionDependencies): void {
  dependencies.cancelFrame(host.inventoryHitTestFrame);
  host.inventoryHitTestFrame = dependencies.requestFrame(() => {
    host.inventoryHitTestFrame = 0;
    if (host.transformPreviewUiHidden) return;
    const pointer = host.inventoryPointer;
    const part = pointer
      ? dependencies.hitTest(host.inventory, pointer.x, pointer.y,
          (x, y) => dependencies.elementFromPoint(x, y), host.previewParts)
      : undefined;
    host.coatingPreview = undefined;
    host.cosmeticPreview = undefined;
    host.setPartPreview(part);
  });
}

/** Retire an old tutorial before loading a new overlay for the Factory page. */
export async function showGarageFactoryTutorial(host: GarageViewActionHost,
  dependencies: GarageViewActionDependencies): Promise<void> {
  if (host.tutorialLoading) return;
  host.tutorialClose?.();
  host.tutorialLoading = true;
  try {
    const close = await dependencies.loadFactoryTutorial(host.options.library, host.surface);
    if (host.disposed || host.pageMode !== "factory") close();
    else host.tutorialClose = close;
  } catch (error) {
    if (!host.disposed) host.status.textContent = `教程加载失败：${String(error)}`;
  } finally {
    host.tutorialLoading = false;
  }
}

/** Escape dismisses the most recent preview when no modal UI owns the key. */
export function handleGarageEscapeKey(host: GarageViewActionHost, event: KeyboardEvent): void {
  if (host.frozen || host.confirmation?.pending || host.upgrade || host.preparation ||
      host.skillSelection || host.exceedTypeChange || event.key !== "Escape") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (host.coatingPreview) {
    host.coatingPreview = undefined;
    host.updatePerformance();
  } else if (host.cosmeticPreview) {
    host.cosmeticPreview = undefined;
    host.updatePerformance();
  } else if (host.previewPart) host.setPartPreview(undefined);
}
