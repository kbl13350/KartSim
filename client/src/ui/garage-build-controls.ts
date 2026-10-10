import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageBuildControlsHost {
  assets: {
    partScrollbar: unknown;
    kartCardLayout: { width: number; height: number; gapX: number };
  };
  tuning: { rects: Map<string, GaragePreviewRect> };
  controls: HTMLElement;
  kartName: HTMLElement;
  info: HTMLElement;
  vehicleFunctions: HTMLElement;
  partTitle: HTMLElement;
  inventory: HTMLElement;
  inventoryScrollHit: HTMLElement;
  inventoryScroll: {
    down(event: PointerEvent, scrollbar: unknown, rect: GaragePreviewRect, authoredY: number): void;
    move(scrollbar: unknown, rect: GaragePreviewRect, authoredY: number): void;
    up(pointerId: number): void;
    page(direction: number): boolean;
  };
  inventoryPointer?: { x: number; y: number };
  removePart: HTMLButtonElement;
  cancelPreview: HTMLButtonElement;
  search: HTMLInputElement;
  cards: HTMLElement;
  pageLabel: HTMLElement;
  status: HTMLElement;
  slotControls: Map<string, HTMLButtonElement>;
  vehicleInfoNodes: HTMLElement[];
  partsOnlyNodes: HTMLElement[];
  filter: number;
  page: number;
  nativeButton(name: string, label: string, action: () => void): HTMLButtonElement;
  button(label: string, action: () => void): HTMLButtonElement;
  skin(button: HTMLButtonElement, imageBase: string): void;
  place(element: HTMLElement, rect: GaragePreviewRect): void;
  placeInTransformPreviewRoot(element: HTMLElement, rect: GaragePreviewRect): void;
  rect(name: string): GaragePreviewRect;
  createTransformPreviewButton(): HTMLButtonElement;
  authoredPointerY(event: PointerEvent): number;
  rehitTestInventoryPreview(): void;
  updateCards(): void;
  requestRestoreDefaults(): void;
  selectPage(page: string): void;
  selectSlot(slot: string): void;
}

export interface GarageBuildControlsDependencies {
  slots: readonly string[];
  slotLabels: Record<string, string>;
  inventoryRect(assets: GarageBuildControlsHost["assets"], family: string): GaragePreviewRect;
  removeButtonRect: GaragePreviewRect;
  cardsRect(assets: GarageBuildControlsHost["assets"]): GaragePreviewRect;
}

function buildGaragePageMenu(host: GarageBuildControlsHost): void {
  const parts = host.nativeButton("partsInstall", "部件", () => host.selectPage("parts"));
  parts.dataset.garageCommon = "parts";
  parts.classList.add("selected", "garage-menu-button");
  for (const [name, label] of [["kartLevelUp", "升级"], ["partsFactory", "改装"]]) {
    const button = host.nativeButton(name!, label!, () =>
      host.selectPage(name === "partsFactory" ? "factory" : "level"));
    button.dataset.garageCommon = name === "kartLevelUp" ? "level" : "factory";
    button.title = name === "partsFactory" ? "车辆改装（本地测试）" : "车辆升级";
    button.classList.add("garage-menu-button");
  }
}

function buildGarageVehicleInformation(
  host: GarageBuildControlsHost,
  dependencies: GarageBuildControlsDependencies,
): void {
  host.kartName.className = "garage-x-kart-name";
  host.kartName.dataset.garageCommon = "true";
  host.place(host.kartName, { ...host.rect("selectedKartName"), width: 700 });
  host.place(host.info, { x: 20, y: 218, width: 386, height: 175 });
  host.info.className = "garage-x-info";
  host.info.dataset.vehicleInfo = "true";
  host.vehicleInfoNodes.push(host.info);
  for (const slot of dependencies.slots) {
    const button = host.button(dependencies.slotLabels[slot]!, () => host.selectSlot(slot));
    button.className = "garage-equipped-slot";
    button.dataset.slot = slot;
    button.dataset.vehicleInfo = "true";
    host.slotControls.set(slot, button);
    host.vehicleInfoNodes.push(button);
  }
  host.vehicleFunctions.className = "garage-vehicle-functions";
  host.vehicleFunctions.dataset.vehicleInfo = "true";
  host.place(host.vehicleFunctions, host.tuning.rects.get("kartBodyEffect12") ??
    { x: 20, y: 478, width: 386, height: 92 });
  host.vehicleInfoNodes.push(host.vehicleFunctions);
  host.createTransformPreviewButton();
}

function buildGaragePartInventory(
  host: GarageBuildControlsHost,
  dependencies: GarageBuildControlsDependencies,
): void {
  host.partTitle.className = "garage-x-parts-title";
  host.placeInTransformPreviewRoot(host.partTitle, host.rect("engineGrade"));
  host.partsOnlyNodes.push(host.partTitle);
  host.inventory.className = "garage-x-inventory";
  host.placeInTransformPreviewRoot(host.inventory, dependencies.inventoryRect(host.assets, "v1"));
  host.inventoryScrollHit.className = "garage-x-scrollbar-slot";
  host.placeInTransformPreviewRoot(host.inventoryScrollHit, host.rect("partListBar"));
  host.inventoryScrollHit.addEventListener("pointerdown", event =>
    host.inventoryScroll.down(event, host.assets.partScrollbar,
      host.rect("partListBar"), host.authoredPointerY(event)));
  host.inventoryScrollHit.addEventListener("pointermove", event =>
    host.inventoryScroll.move(host.assets.partScrollbar,
      host.rect("partListBar"), host.authoredPointerY(event)));
  for (const name of ["pointerup", "pointercancel"])
    host.inventoryScrollHit.addEventListener(name, event =>
      host.inventoryScroll.up((event as PointerEvent).pointerId));
  host.controls.append(host.inventoryScrollHit);
  host.inventory.setAttribute("role", "region");
  host.inventory.setAttribute("aria-label", "部件列表");
  host.inventory.addEventListener("wheel", event => {
    host.inventoryPointer = { x: event.clientX, y: event.clientY };
    if (host.inventoryScroll.page(event.deltaY < 0 ? -1 : 1)) event.preventDefault();
  }, { passive: false });
  host.inventory.addEventListener("pointermove", event => {
    host.inventoryPointer = { x: event.clientX, y: event.clientY };
  });
  host.inventory.addEventListener("pointerleave", () => { host.inventoryPointer = undefined; });
  host.inventory.addEventListener("scroll", () => host.rehitTestInventoryPreview());
}

function buildGaragePartActions(
  host: GarageBuildControlsHost,
  dependencies: GarageBuildControlsDependencies,
): void {
  host.skin(host.removePart, "buttonRed_");
  host.removePart.classList.add("garage-danger-button");
  host.removePart.textContent = "拆除";
  host.removePart.setAttribute("aria-label", "拆除部件");
  host.place(host.removePart, dependencies.removeButtonRect);
  host.skin(host.cancelPreview, "garage_btn_equip_");
  host.place(host.cancelPreview, { x: 300, y: 590, width: 110, height: 32 });
  host.cancelPreview.hidden = true;
  const restore = host.button("恢复原装", () => host.requestRestoreDefaults());
  host.skin(restore, "garage_btn_equip_");
  restore.dataset.garageRestore = "true";
  host.place(restore, { x: 185, y: 590, width: 100, height: 32 });
}

function buildGarageCatalog(
  host: GarageBuildControlsHost,
  dependencies: GarageBuildControlsDependencies,
): void {
  for (const [name, label, filter] of [
    ["allKart", "全部", 0], ["speedKart", "竞速车", 2], ["itemKart", "道具车", 1],
  ] as const) {
    const button = host.nativeButton(name, label, () => {
      host.filter = filter;
      host.page = 0;
      host.updateCards();
    });
    button.dataset.filter = String(filter);
    button.dataset.garageCommon = "true";
    button.dataset.garageSelector = "true";
  }

  host.search.placeholder = "搜索车辆";
  host.search.maxLength = 14;
  host.search.setAttribute("aria-label", "搜索车辆");
  host.search.dataset.garageCommon = "true";
  host.search.dataset.garageSelector = "true";
  host.search.oninput = () => { host.page = 0; host.updateCards(); };
  host.place(host.search, host.rect("kartKeyword"));
  const clearSearch = host.nativeButton("resetKeyword", "清除搜索", () => {
    host.search.value = "";
    host.page = 0;
    host.updateCards();
  });
  clearSearch.textContent = "";
  clearSearch.dataset.garageCommon = "true";
  clearSearch.dataset.garageCatalog = "search";
  clearSearch.dataset.garageSelector = "true";

  host.cards.className = "garage-x-cards";
  host.cards.dataset.garageCommon = "true";
  host.cards.dataset.garageSelector = "true";
  host.cards.style.setProperty("--garage-kart-card-width", `${host.assets.kartCardLayout.width}px`);
  host.cards.style.setProperty("--garage-kart-card-height", `${host.assets.kartCardLayout.height}px`);
  host.cards.style.setProperty("--garage-kart-card-gap", `${host.assets.kartCardLayout.gapX}px`);
  host.place(host.cards, dependencies.cardsRect(host.assets));

  const previous = host.nativeButton("leftKartPage", "上一页", () => {
    host.page = Math.max(0, host.page - 1);
    host.updateCards();
  });
  previous.textContent = "";
  previous.dataset.garageCommon = "true";
  previous.dataset.garageCatalog = "leftKartPage";
  previous.dataset.garageSelector = "true";
  const next = host.nativeButton("rightKartPage", "下一页", () => {
    host.page++;
    host.updateCards();
  });
  next.textContent = "";
  next.dataset.garageCommon = "true";
  next.dataset.garageCatalog = "rightKartPage";
  next.dataset.garageSelector = "true";
  host.pageLabel.className = "garage-page-label";
  host.pageLabel.dataset.garageCommon = "true";
  host.pageLabel.dataset.garageSelector = "true";
  host.place(host.pageLabel, host.rect("pageInfo"));
  host.status.className = "garage-x-status";
  host.status.setAttribute("role", "status");
  host.status.dataset.garageCommon = "true";
  host.status.textContent = "";
  host.place(host.status, { x: 20, y: 630, width: 980, height: 24 });
}

/** Construct the Garage controls and bind catalog, inventory and page interactions. */
export function buildGarageControls(
  host: GarageBuildControlsHost,
  dependencies: GarageBuildControlsDependencies,
): void {
  buildGaragePageMenu(host);
  buildGarageVehicleInformation(host, dependencies);
  buildGaragePartInventory(host, dependencies);
  buildGaragePartActions(host, dependencies);
  buildGarageCatalog(host, dependencies);
}
