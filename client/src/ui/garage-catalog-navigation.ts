export type GaragePage = "parts" | "level" | "factory";

export interface GarageCatalogVehicle {
  itemId: number;
  engineGrade?: number;
  identityClass?: string;
  kartType?: number;
  title: string;
  internalId?: string;
  [key: string]: unknown;
}

export interface GarageCatalogNavigationHost {
  pageMode: GaragePage;
  page: number;
  selected: GarageCatalogVehicle;
  options: { catalog: { karts: GarageCatalogVehicle[] } };
  panels?: {
    setParticleModificationPageVisible?(visible: boolean): void;
    resetPreviewForPageTransition?(): void;
    setTransformPreview?(enabled: boolean): void;
    resetPreviewRotation(enabled: boolean): void;
  };
  transformPreviewStartPending: boolean;
  cosmeticPreview: unknown;
  previewPart: unknown;
  coatingPreview: unknown;
  upgradeCatalogEmpty: boolean;
  factoryScoreRevision: number;
  inventory: { scrollTop: number };
  info: { replaceChildren(): void };
  vehicleFunctions: { replaceChildren(): void };
  comparisons: unknown[];
  slotControls: Map<string, { replaceChildren(): void }>;
  search: { value: string };
  filter: number;
  status: { textContent: string };
  syncTransformPreviewUi(): void;
  canonicalFactoryVehicle(vehicle: GarageCatalogVehicle): GarageCatalogVehicle;
  selectKart(vehicle: GarageCatalogVehicle): void;
  updateControls(): void;
  publishCurrentState(): void;
  nativeFactoryAllowed(vehicle: GarageCatalogVehicle): boolean;
  requireCustomization(): boolean;
}

export interface GarageCatalogNavigationDependencies {
  canCustomize(itemId: number): boolean;
  progressionLayout(engineGrade: number | undefined): string | undefined;
  blockedKart(itemId: number): boolean;
  validateKart(itemId: number): void;
  factoryAllowed(engineGrade: number | undefined, title: string): boolean;
  progressionKind(engineGrade: number | undefined): string | undefined;
  progressionMismatchMessage: string;
}

/** Navigate among parts, upgrading, and factory views while retaining a valid selected vehicle. */
export function selectGaragePage(
  host: GarageCatalogNavigationHost,
  page: GaragePage,
  dependencies: Pick<GarageCatalogNavigationDependencies,
    "canCustomize" | "progressionLayout" | "blockedKart">,
): void {
  host.panels?.setParticleModificationPageVisible?.(page === "factory");
  if (page !== host.pageMode) {
    host.transformPreviewStartPending = false;
    if (host.panels?.resetPreviewForPageTransition)
      host.panels.resetPreviewForPageTransition();
    else host.panels?.setTransformPreview?.(false);
    host.syncTransformPreviewUi();
  }
  host.page = 0;
  host.cosmeticPreview = undefined;
  host.previewPart = undefined;
  host.upgradeCatalogEmpty = false;
  if (page === "level" &&
      (!dependencies.canCustomize(host.selected.itemId) ||
       !dependencies.progressionLayout(host.selected.engineGrade))) {
    const firstUpgradable = host.options.catalog.karts.find(vehicle =>
      !dependencies.blockedKart(vehicle.itemId) &&
      dependencies.canCustomize(vehicle.itemId) &&
      vehicle.identityClass !== "legacy-system-family" &&
      dependencies.progressionLayout(vehicle.engineGrade) !== undefined);
    if (firstUpgradable) {
      host.pageMode = page;
      host.selectKart(firstUpgradable);
      return;
    }
    host.upgradeCatalogEmpty = true;
  }
  if (page === "factory") {
    const canonical = host.canonicalFactoryVehicle(host.selected);
    if (canonical !== host.selected) {
      host.selected = canonical;
      host.factoryScoreRevision++;
    }
  }
  host.pageMode = page;
  host.updateControls();
}

/** Select a catalog vehicle and clear all transient part, cosmetic, and model state. */
export function selectGarageKart(
  host: GarageCatalogNavigationHost,
  vehicle: GarageCatalogVehicle,
  validateKart: GarageCatalogNavigationDependencies["validateKart"],
): void {
  validateKart(vehicle.itemId);
  host.transformPreviewStartPending = false;
  host.previewPart = undefined;
  host.cosmeticPreview = undefined;
  host.coatingPreview = undefined;
  host.inventory.scrollTop = 0;
  host.info.replaceChildren();
  host.vehicleFunctions.replaceChildren();
  host.comparisons.length = 0;
  for (const control of host.slotControls.values()) control.replaceChildren();
  host.selected = vehicle;
  host.factoryScoreRevision++;
  host.panels?.setTransformPreview?.(false);
  host.panels?.resetPreviewRotation(false);
  host.publishCurrentState();
  host.updateControls();
}

/** Apply page-specific availability, type, and search filters to the kart catalog. */
export function filteredGarageKarts(
  host: GarageCatalogNavigationHost,
  dependencies: Pick<GarageCatalogNavigationDependencies,
    "blockedKart" | "canCustomize" | "progressionLayout">,
): GarageCatalogVehicle[] {
  const factory = host.pageMode === "factory";
  const query = factory ? "" : host.search.value.trim().toLocaleLowerCase();
  return host.options.catalog.karts.filter(vehicle =>
    !dependencies.blockedKart(vehicle.itemId) &&
    vehicle.identityClass !== "legacy-system-family" &&
    (host.pageMode !== "level" ||
      dependencies.canCustomize(vehicle.itemId) &&
      dependencies.progressionLayout(vehicle.engineGrade) !== undefined) &&
    (!factory || host.nativeFactoryAllowed(vehicle)) &&
    (factory || !host.filter || vehicle.kartType === host.filter) &&
    `${vehicle.title} ${vehicle.internalId} ${vehicle.itemId}`
      .toLocaleLowerCase().includes(query));
}

/** Whether the selected vehicle supports the original factory modification system. */
export function garageFactoryAllowed(
  host: GarageCatalogNavigationHost,
  vehicle: GarageCatalogVehicle,
  dependencies: Pick<GarageCatalogNavigationDependencies,
    "canCustomize" | "factoryAllowed">,
): boolean {
  return dependencies.canCustomize(vehicle.itemId) &&
    dependencies.factoryAllowed(vehicle.engineGrade, vehicle.title);
}

/** Guard progression changes and retain the released mismatch message. */
export function canSetGarageProgression(
  host: GarageCatalogNavigationHost,
  progression: { kind: string },
  dependencies: Pick<GarageCatalogNavigationDependencies,
    "progressionKind" | "progressionMismatchMessage">,
): boolean {
  if (!host.requireCustomization()) return false;
  if (dependencies.progressionKind(host.selected.engineGrade) === progression.kind) return true;
  host.status.textContent = dependencies.progressionMismatchMessage;
  return false;
}
