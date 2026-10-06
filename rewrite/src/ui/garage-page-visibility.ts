export interface GarageCatalogLayout {
  columns: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  gapX: number;
  gapY: number;
  rect: unknown;
}

export interface GaragePageVisibilityHost {
  pageMode: string;
  selected: { itemId: number; engineGrade?: number };
  controls: HTMLElement;
  progressionPanel: { element: HTMLElement };
  inventory: HTMLElement;
  inventoryScrollHit: HTMLElement;
  factoryPanel?: {
    element: HTMLElement;
    showsCatalog: boolean;
    assets?: { rects: Map<string, unknown> };
    catalogLayout?: GarageCatalogLayout;
  };
  kartName: HTMLElement;
  search: HTMLElement;
  cards: HTMLElement;
  pageLabel: HTMLElement;
  cancelPreview: HTMLElement;
  previewPart: unknown;
  cosmeticPreview: unknown;
  status: HTMLElement;
  assets: unknown;
  rect(name: string): unknown;
  place(element: HTMLElement, rect: unknown): void;
  syncTransformPreviewUi(): void;
}

export interface GaragePageVisibilityDependencies {
  canCustomize(itemId: number): boolean;
  showVehicleInformation(pageMode: string, engineGrade: number | undefined): boolean;
  defaultCardRect(assets: unknown): unknown;
}

/** Apply Parts, Strengthening and Factory page visibility to mounted controls. */
export function updateGaragePageVisibility(
  host: GaragePageVisibilityHost,
  dependencies: GaragePageVisibilityDependencies,
): void {
  for (const child of host.controls.children) {
    if (!(child instanceof HTMLElement)) continue;
    const control = child as HTMLElement & { disabled: boolean };
    if (control.dataset.garageRestore === "true")
      control.disabled = !dependencies.canCustomize(host.selected.itemId);
    if (!control.dataset.garageCommon) {
      const vehicleInfo = control.dataset.vehicleInfo === "true" &&
        dependencies.showVehicleInformation(host.pageMode, host.selected?.engineGrade);
      control.hidden = !vehicleInfo &&
        (host.pageMode !== "parts" ||
         (control.dataset.transformPreview === "true" &&
          control.dataset.transformAvailable !== "true") ||
         (control === host.cancelPreview && !host.previewPart && !host.cosmeticPreview));
    }
    if (["parts", "level", "factory"].includes(control.dataset.garageCommon ?? ""))
      control.classList.toggle("selected", control.dataset.garageCommon === host.pageMode);
  }
  host.progressionPanel.element.hidden = host.pageMode !== "level" ||
    !dependencies.canCustomize(host.selected.itemId);
  host.inventory.hidden = host.pageMode !== "parts";
  host.inventoryScrollHit.hidden = host.pageMode !== "parts";
  if (host.factoryPanel) host.factoryPanel.element.hidden = host.pageMode !== "factory";

  const factoryPage = host.pageMode === "factory";
  host.kartName.hidden = factoryPage;
  const showCatalog = !factoryPage || !!host.factoryPanel?.showsCatalog;
  host.search.hidden = factoryPage;
  host.controls.querySelectorAll<HTMLElement>("[data-filter], [data-garage-catalog='search']")
    .forEach(control => { control.hidden = factoryPage; });
  host.cards.hidden = host.pageLabel.hidden = !showCatalog;
  host.cards.classList.toggle("garage-factory-cards", factoryPage);
  const factoryAssets = host.factoryPanel?.assets;
  const factoryLayout = factoryPage ? host.factoryPanel?.catalogLayout : undefined;
  if (factoryLayout && factoryAssets) {
    host.cards.style.setProperty("--factory-columns", String(factoryLayout.columns));
    host.cards.style.setProperty("--factory-rows", String(factoryLayout.rows));
    host.cards.style.setProperty("--factory-card-width", `${factoryLayout.cardWidth}px`);
    host.cards.style.setProperty("--factory-card-height", `${factoryLayout.cardHeight}px`);
    host.cards.style.setProperty("--factory-gap-x", `${factoryLayout.gapX}px`);
    host.cards.style.setProperty("--factory-gap-y", `${factoryLayout.gapY}px`);
  }
  host.place(host.cards, factoryLayout?.rect ?? dependencies.defaultCardRect(host.assets));
  host.place(host.pageLabel,
    factoryPage && factoryAssets ? factoryAssets.rects.get("pageInfo") : host.rect("pageInfo"));
  host.controls.querySelectorAll<HTMLElement>(
    "[data-garage-catalog='leftKartPage'], [data-garage-catalog='rightKartPage']",
  ).forEach(control => {
    const name = control.dataset.garageCatalog;
    control.hidden = !showCatalog;
    host.place(control, factoryPage && factoryAssets
      ? factoryAssets.rects.get(name === "leftKartPage" ? "preItemList" : "nextItemList")
      : host.rect(name!));
  });
  host.status.style.top = factoryPage ? "804px" : "630px";
  host.syncTransformPreviewUi();
}
