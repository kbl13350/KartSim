import type { GaragePart, GaragePartSlot } from "./garage-parts-business";

export interface GarageControlsVehicle {
  itemId: number;
  title: string;
  path: string;
  engineGrade?: number;
  uniqueLevel?: number;
  kartType?: number;
  identityClass?: string;
}

export interface GarageControlsLayout {
  kind: string;
  partsTab: string;
  cosmeticTabs: Array<{ node: string; label: string }>;
}

export interface GaragePartCardLayout {
  width: number;
  height: number;
  stepX: number;
  stepY: number;
  iconWidth: number;
  iconHeight: number;
  iconAdjustY: number;
  texture: string;
  titleRect: { x: number; y: number; width: number; height: number };
}

export interface GarageControlsEquipment {
  progression?: { kind: string; level?: number };
  factory?: unknown;
  exceedType?: number;
  cosmetics?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GarageControlsHost {
  selected: GarageControlsVehicle;
  pageMode: string;
  slot: GaragePartSlot;
  coatingMode: boolean;
  cosmeticSlot?: string;
  coatingPreview: unknown;
  cosmeticPreview: unknown;
  previewPart?: GaragePart;
  cosmeticBusy: boolean;
  transformPreviewStartPending: boolean;
  transformPreviewUiHidden: boolean;
  upgradeCatalogEmpty: boolean;
  scoreRevision: number;
  configuration: unknown;
  options: {
    catalog: { karts: GarageControlsVehicle[] };
    profile: { equipment: { itemIds: number[]; kartSerial: number; exceedType: number } };
    library: unknown;
  };
  assets: {
    parts: unknown;
    strings: Map<string, string>;
    imageUrls: Map<string, string>;
  };
  defaultPartGrades: unknown;
  element: HTMLElement;
  controls: HTMLElement;
  inventory: HTMLElement;
  info: HTMLElement;
  vehicleFunctions: HTMLElement;
  kartName: HTMLElement;
  partTitle: HTMLElement;
  cancelPreview: HTMLElement;
  removePart: HTMLButtonElement;
  progressionPanel: {
    element: HTMLElement;
    update(progression: unknown, supported: boolean, engineGrade: number | undefined,
      factory: unknown, exceedType: number | undefined,
      selected: { itemId: number; kartType: number | undefined }, empty: boolean): void;
    updateRadar(library: unknown, path: string, base: unknown,
      progression: unknown, factory: unknown): void;
  };
  factoryPanel?: {
    update(factory: unknown, available: boolean, pending: boolean,
      title?: string, vehicle?: GarageControlsVehicle, key?: unknown): void;
    updateScores(scores: unknown, message: string): void;
  };
  pointEffects?: { setContext(context?: string): void };
  factorySessionVehicleKey: unknown;
  factorySession?: { pending: boolean };
  modelCache: { clear(): void };
  modelTargets: unknown[];
  comparisons: unknown[];
  slotControls: Map<GaragePartSlot, HTMLElement>;
  previewParts: Map<HTMLButtonElement, GaragePart>;
  panels?: { setTransformPreview?(enabled: boolean): void };
  serial(): number;
  base(): { defaultExceedType?: number; [key: string]: unknown };
  setVehicleInfoNodesMounted(mounted: boolean): void;
  setPartsOnlyNodesMounted(mounted: boolean): void;
  setUpgradeStatusMounted(mounted: boolean): void;
  selectKart(vehicle: GarageControlsVehicle): void;
  nativeFactoryAllowed(vehicle?: GarageControlsVehicle): boolean;
  factoryVehicleKey(vehicle: GarageControlsVehicle): unknown;
  updateVehicleHeading(level?: number): void;
  updateVehicleInformation(base: unknown, equipment: GarageControlsEquipment,
    layout: GarageControlsLayout): void;
  updateCosmeticEquippedSlots(equipment: GarageControlsEquipment,
    layout: GarageControlsLayout, interactive: boolean): void;
  updateFactoryScores(): void;
  updateControls(): void;
  updatePageVisibility(): void;
  updateCards(): void;
  nativeButton(path: string, label: string, onClick: () => void, alternate?: string): HTMLButtonElement;
  moveToTransformPreviewRoot(button: HTMLButtonElement): void;
  selectSlot(slot: GaragePartSlot): void;
  updateCoatingInventory(): void;
  updateCosmeticInventory(): void;
  button(label: string, onClick: () => void): HTMLButtonElement;
  setPartPreview(part?: GaragePart): void;
  partLabel(part: GaragePart): string;
  icon(name: string, className: string): HTMLElement | undefined;
  partVisual(button: HTMLButtonElement, part: GaragePart, className: string, row?: number): void;
  requestEquip(part?: GaragePart): void;
  equip(part: GaragePart): void;
  skin(button: HTMLButtonElement, name: string): void;
  rect(name: string): unknown;
  place(element: HTMLElement, rect: unknown): void;
}

export interface GarageControlsDependencies {
  showVehicleInformation(pageMode: string, engineGrade: number | undefined): boolean;
  progressionFamily(engineGrade: number | undefined): string | undefined;
  canCustomize(itemId: number): boolean;
  blockedKart(itemId: number): boolean;
  progressionSupport(engineGrade: number | undefined): string | undefined;
  expectedProgressionKind(family: string | undefined): string | undefined;
  currentEquipment(configuration: unknown, itemId: number, serial: number): GarageControlsEquipment;
  vehicleFamily(base: unknown, engineGrade: number): string | undefined;
  layoutForGrade(engineGrade: number | undefined): GarageControlsLayout | undefined;
  initialProgression(xun: boolean): { kind: string; level?: number };
  slots: GaragePartSlot[];
  slotNodes: Record<GaragePartSlot, string>;
  slotLabel(slot: GaragePartSlot, family: string | undefined): string;
  partsForSlot(assets: GarageControlsHost["assets"], family: string | undefined,
    slot: GaragePartSlot): GaragePart[];
  cardLayout(assets: GarageControlsHost["assets"], family: string): GaragePartCardLayout;
  inventoryRect(assets: GarageControlsHost["assets"], family: string): unknown;
  quality(part: GaragePart): number | undefined;
  cardTexture(part: GaragePart, texture: string): string;
  samePart(left: GaragePart | undefined, right: GaragePart): boolean;
  equippedPart(base: unknown, equipment: GarageControlsEquipment, slot: GaragePartSlot,
    available: unknown, engineGrade: number | undefined,
    uniqueLevel: number | undefined, defaultGrades: unknown): GaragePart | undefined;
  slotLocked(base: unknown, slot: GaragePartSlot): boolean;
  canEquip(locked: boolean): boolean;
  bindPreview(button: HTMLButtonElement, part: GaragePart,
    selected: () => GaragePart | undefined, update: (part?: GaragePart) => void): void;
}

function clearTransientInventory(host: GarageControlsHost): number {
  const scrollTop = host.inventory.scrollTop;
  host.coatingPreview = undefined;
  host.modelCache.clear();
  host.inventory.replaceChildren();
  host.modelTargets.length = 0;
  if (host.pageMode !== "factory" || host.nativeFactoryAllowed()) host.updateVehicleHeading();
  else {
    host.kartName.replaceChildren();
    host.info.replaceChildren();
    host.vehicleFunctions.replaceChildren();
  }
  host.controls.querySelectorAll<HTMLElement>(
    "[data-part-tab], [data-upgrade], [data-cosmetic-slot], [data-cosmetic-preview]",
  ).forEach(button => button.remove());
  return scrollTop;
}

function showFactoryPage(host: GarageControlsHost, equipment: GarageControlsEquipment): void {
  const vehicle = host.selected;
  const available = host.nativeFactoryAllowed(vehicle);
  const vehicleKey = host.factoryVehicleKey(vehicle);
  const pending = host.factorySessionVehicleKey === vehicleKey && !!host.factorySession?.pending;
  host.factoryPanel?.update(equipment.factory, available, pending,
    available ? vehicle.title : undefined, available ? vehicle : undefined, vehicleKey);
  if (available) host.updateFactoryScores();
  else host.factoryPanel?.updateScores(undefined, "当前车辆不支持车辆改装。");
  host.updatePageVisibility();
  host.updateCards();
}

export const GARAGE_PRACTICE_NOTICE = "练习车不支持部件、强化、改装或外观修改。";

/**
 * The part list is a three-column grid, so bare text sat in its first card
 * cell. The notice covers the whole list instead and stands in its middle,
 * over the board's empty card frames, in the garage's white outlined text.
 */
function practiceNotice(): HTMLElement {
  const notice = document.createElement("div");
  notice.className = "garage-parts-notice garage-practice-notice";
  notice.setAttribute("role", "status");
  notice.textContent = GARAGE_PRACTICE_NOTICE;
  const style: Record<string, string> = {
    position: "absolute", inset: "0", display: "flex",
    "align-items": "center", "justify-content": "center",
    "box-sizing": "border-box", padding: "0 24px", "pointer-events": "none",
    "text-shadow": "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
  };
  for (const [name, value] of Object.entries(style)) notice.style.setProperty(name, value);
  return notice;
}

function showPracticeVehicle(host: GarageControlsHost): void {
  for (const button of host.slotControls.values()) button.replaceChildren();
  host.info.replaceChildren();
  host.vehicleFunctions.replaceChildren();
  host.removePart.disabled = true;
  // clearTransientInventory emptied the list.
  host.inventory.append(practiceNotice());
  host.updatePageVisibility();
  host.updateCards();
}

function compatibleCosmeticTabs(host: GarageControlsHost, layout: GarageControlsLayout): void {
  const tabs = new Set(layout.cosmeticTabs.map(tab => tab.node));
  if (host.coatingMode && ![...tabs].some(tab => tab.includes("Coating"))) host.coatingMode = false;
  if (host.cosmeticSlot === "tailLamp" && ![...tabs].some(tab => tab.includes("Lamp")))
    host.cosmeticSlot = undefined;
  if (host.cosmeticSlot === "boosterEffect" && ![...tabs].some(tab => tab.includes("Booster")))
    host.cosmeticSlot = undefined;
}

function showLevelPage(
  host: GarageControlsHost,
  equipment: GarageControlsEquipment,
  base: ReturnType<GarageControlsHost["base"]>,
  layout: GarageControlsLayout,
  family: string | undefined,
  kind: string | undefined,
  supported: string | undefined,
  dependencies: GarageControlsDependencies,
): void {
  host.comparisons.length = 0;
  if (family === "classic") {
    host.info.replaceChildren();
    host.info.removeAttribute("aria-label");
    host.info.title = "";
    delete host.info.dataset.performanceMode;
    for (const button of host.slotControls.values()) button.replaceChildren();
    host.vehicleFunctions.replaceChildren();
  } else if (family === "xun") {
    host.updateVehicleInformation(base, equipment, layout);
    host.updateCosmeticEquippedSlots(equipment, layout, false);
  }
  const progression = equipment.progression && equipment.progression.kind === kind
    ? equipment.progression : dependencies.initialProgression(kind === "xun");
  const selectedEquipment = host.selected.itemId === host.options.profile.equipment.itemIds[3] &&
    host.serial() === host.options.profile.equipment.kartSerial;
  const exceedType = equipment.exceedType ??
    (selectedEquipment && host.options.profile.equipment.exceedType > 0
      ? host.options.profile.equipment.exceedType : base.defaultExceedType);
  host.updateVehicleHeading(progression.kind === "xun" ? progression.level : undefined);
  host.progressionPanel.update(progression, !!supported, host.selected.engineGrade,
    equipment.factory, exceedType,
    { itemId: host.selected.itemId, kartType: host.selected.kartType },
    host.upgradeCatalogEmpty);
  if (kind === "classic" && progression.kind === "classic")
    host.progressionPanel.updateRadar(host.options.library, host.selected.path,
      base, progression, equipment.factory);
  host.updatePageVisibility();
  host.updateCards();
}

function mountPartTabs(host: GarageControlsHost, family: string | undefined,
  layout: GarageControlsLayout, dependencies: GarageControlsDependencies): void {
  for (const slot of dependencies.slots) {
    const alternate = family === "legacy" && slot === "booster" ? "部件" : undefined;
    const button = host.nativeButton(
      `/partsListBoard/${layout.partsTab}/${dependencies.slotNodes[slot]}`,
      dependencies.slotLabel(slot, family), () => host.selectSlot(slot), alternate);
    host.moveToTransformPreviewRoot(button);
    button.dataset.partTab = slot;
    button.classList.toggle("selected", !host.coatingMode && !host.cosmeticSlot && slot === host.slot);
  }
  for (const { node, label } of layout.cosmeticTabs) {
    const slot = node.includes("Lamp") ? "tailLamp"
      : node.includes("Booster") ? "boosterEffect" : undefined;
    const button = host.nativeButton(`/partsListBoard/${layout.partsTab}/${node}`, label, () => {
      host.coatingMode = !slot;
      host.cosmeticSlot = slot;
      host.cosmeticPreview = undefined;
      host.previewPart = undefined;
      host.transformPreviewStartPending = false;
      host.panels?.setTransformPreview?.(false);
      host.inventory.scrollTop = 0;
      host.updateControls();
    });
    host.moveToTransformPreviewRoot(button);
    button.dataset.partTab = node;
    button.title = label;
    button.classList.toggle("selected", slot ? host.cosmeticSlot === slot : host.coatingMode);
  }
}

function applyPartCardLayout(host: GarageControlsHost, layout: GaragePartCardLayout,
  family: string, dependencies: GarageControlsDependencies): void {
  const style = host.inventory.style;
  style.setProperty("--garage-part-card-width", `${layout.width}px`);
  style.setProperty("--garage-part-card-height", `${layout.height}px`);
  style.setProperty("--garage-part-column-step", `${layout.stepX}px`);
  style.setProperty("--garage-part-row-step", `${layout.stepY}px`);
  style.setProperty("--garage-part-icon-width", `${layout.iconWidth}px`);
  style.setProperty("--garage-part-icon-height", `${layout.iconHeight}px`);
  style.setProperty("--garage-part-icon-y", `${layout.iconAdjustY}px`);
  style.setProperty("--garage-part-title-x", `${layout.titleRect.x}px`);
  style.setProperty("--garage-part-title-y", `${layout.titleRect.y}px`);
  style.setProperty("--garage-part-title-width", `${layout.titleRect.width}px`);
  style.setProperty("--garage-part-title-height", `${layout.titleRect.height}px`);
  host.place(host.inventory, dependencies.inventoryRect(host.assets, family));
}

function renderPartCard(
  host: GarageControlsHost, base: unknown, equipment: GarageControlsEquipment,
  part: GaragePart, index: number, layout: GaragePartCardLayout,
  dependencies: GarageControlsDependencies,
): void {
  const quality = dependencies.quality(part);
  const card = document.createElement("div");
  card.className = `garage-part-card garage-native-part-card quality-${quality ?? 0}`;
  const texture = host.assets.imageUrls.get(dependencies.cardTexture(part, layout.texture));
  if (texture) card.style.backgroundImage = `url(${JSON.stringify(texture)})`;
  const equipped = dependencies.samePart(
    dependencies.equippedPart(base, equipment, host.slot, host.assets.parts,
      host.selected.engineGrade, host.selected.uniqueLevel, host.defaultPartGrades), part);
  card.classList.toggle("selected", equipped);
  const preview = host.button("", () => host.setPartPreview(part));
  preview.className = "garage-part-preview";
  preview.setAttribute("aria-label", `预览 ${host.partLabel(part)} ${dependencies.slotLabel(host.slot, part.family)}`);
  if (part.family === "legacy" && part.legacyEffect) preview.title = part.legacyEffect;
  dependencies.bindPreview(preview, part, () => host.previewPart, next => {
    if (!host.transformPreviewUiHidden) host.setPartPreview(next);
  });
  host.previewParts.set(preview, part);
  const frame = part.family === "legacy" ? undefined
    : host.icon(`uniqueLevel_${part.grade}`, "garage-inventory-frame");
  if (frame) preview.append(frame);
  host.partVisual(preview, part, "garage-inventory-icon", Math.floor(index / 3));
  const locked = dependencies.slotLocked(base, host.slot);
  const title = document.createElement("span");
  title.textContent = host.partLabel(part);
  title.className = `quality-${quality ?? 0}`;
  preview.append(title);
  preview.disabled = locked;
  preview.setAttribute("aria-disabled", String(locked));
  card.classList.toggle("locked", locked);
  card.append(preview);
  if (dependencies.canEquip(locked)) {
    const equip = host.button(equipped ? "已装备" : "装备", () => host.requestEquip(part));
    equip.setAttribute("aria-label",
      `${equipped ? "已装备" : "装备"} ${host.partLabel(part)} ${dependencies.slotLabel(host.slot, part.family)}`);
    equip.className = "garage-equip-label";
    host.skin(equip, "garage_btn_equip_");
    equip.disabled = equipped;
    card.append(equip);
  }
  host.inventory.append(card);
}

function mountXunUpgradeActions(
  host: GarageControlsHost, base: unknown, equipment: GarageControlsEquipment,
  parts: GaragePart[], dependencies: GarageControlsDependencies,
): void {
  const equippedId = dependencies.equippedPart(base, equipment, host.slot,
    host.assets.parts, host.selected.engineGrade, host.selected.uniqueLevel,
    host.defaultPartGrades)?.itemId;
  const next = equippedId === undefined ? undefined
    : parts.find(part => part.itemId === equippedId + 1);
  const upgrade = host.button("强化一级", () => { if (next) host.equip(next); });
  upgrade.disabled = !next || dependencies.slotLocked(base, host.slot);
  upgrade.dataset.upgrade = "true";
  host.skin(upgrade, "garage_btn_reinforce_0@zz");
  upgrade.textContent = "";
  upgrade.setAttribute("aria-label", "强化一级（本地测试）");
  host.place(upgrade, host.rect("partsReinforceButton"));
  const reset = host.nativeButton("partsResetButton", "重置当前部件（本地测试）",
    () => host.requestEquip(undefined));
  reset.textContent = "";
  reset.dataset.upgrade = "true";
  reset.disabled = !equipment[host.slot] || dependencies.slotLocked(base, host.slot);
}

function showPartsPage(host: GarageControlsHost, equipment: GarageControlsEquipment,
  base: ReturnType<GarageControlsHost["base"]>, family: string | undefined,
  layout: GarageControlsLayout, dependencies: GarageControlsDependencies): void {
  const transform = host.controls.querySelector<HTMLElement>("[data-transform-preview]");
  if (transform) transform.dataset.transformAvailable = String(layout.kind === "xun");
  const gradeLabel = `engineGrade${family === "xun" ? 13 : family === "v1" ? 12 : family === "x" ? 11 : 0}`;
  host.partTitle.textContent = host.assets.strings.get(gradeLabel) ?? "车辆部件";
  host.removePart.disabled = host.coatingMode
    ? !equipment.cosmetics?.coating || host.cosmeticBusy
    : host.cosmeticSlot ? !equipment.cosmetics?.[host.cosmeticSlot]
      : !equipment[host.slot];
  mountPartTabs(host, family, layout, dependencies);
  host.updateCosmeticEquippedSlots(equipment, layout, true);
  const parts = host.coatingMode || host.cosmeticSlot ? []
    : dependencies.partsForSlot(host.assets, family, host.slot);
  const cardFamily = layout.kind === "xun" ? "xun" : "v1";
  const cardLayout = dependencies.cardLayout(host.assets, cardFamily);
  if (family && !host.coatingMode && !host.cosmeticSlot)
    host.inventory.dataset.partFamily = layout.kind === "xun" ? "xun" : "classic";
  else delete host.inventory.dataset.partFamily;
  applyPartCardLayout(host, cardLayout, cardFamily, dependencies);
  if (host.coatingMode && family) host.updateCoatingInventory();
  else if (host.cosmeticSlot && family) host.updateCosmeticInventory();
  if (!family) {
    const notice = document.createElement("div");
    notice.className = "garage-parts-notice";
    notice.textContent = "该代暂无可用的四槽部件目录。";
    host.inventory.append(notice);
  }
  for (const [index, part] of parts.entries())
    renderPartCard(host, base, equipment, part, index, cardLayout, dependencies);
  if (layout.kind === "xun" && parts.length > 0)
    mountXunUpgradeActions(host, base, equipment, parts, dependencies);
}

/** Refresh every visible garage control from the selected kart and its current configuration. */
export function updateGarageControls(
  host: GarageControlsHost,
  dependencies: GarageControlsDependencies,
): void {
  host.setVehicleInfoNodesMounted(
    dependencies.showVehicleInformation(host.pageMode, host.selected.engineGrade));
  host.setPartsOnlyNodesMounted(host.pageMode === "parts");
  host.setUpgradeStatusMounted(host.pageMode !== "level");
  host.scoreRevision++;
  let family = dependencies.progressionFamily(host.selected.engineGrade);
  if (host.pageMode === "level" &&
      (!family || !dependencies.canCustomize(host.selected.itemId)) &&
      !host.upgradeCatalogEmpty) {
    const fallback = host.options.catalog.karts.find(vehicle =>
      !dependencies.blockedKart(vehicle.itemId) &&
      dependencies.canCustomize(vehicle.itemId) &&
      vehicle.identityClass !== "legacy-system-family" &&
      dependencies.progressionFamily(vehicle.engineGrade) !== undefined);
    if (fallback && fallback !== host.selected) {
      host.selectKart(fallback);
      return;
    }
    host.upgradeCatalogEmpty = true;
  }
  const supported = dependencies.progressionSupport(host.selected.engineGrade);
  family = dependencies.progressionFamily(host.selected.engineGrade);
  const kind = dependencies.expectedProgressionKind(family);
  if (family) host.progressionPanel.element.dataset.upgradePresentation = family;
  host.pointEffects?.setContext(host.pageMode === "level" && family === "xun"
    ? `${host.selected.itemId}:${host.serial()}` : undefined);
  const scrollTop = clearTransientInventory(host);
  try {
    const equipment = dependencies.currentEquipment(
      host.configuration, host.selected.itemId, host.serial());
    if (host.pageMode === "factory") {
      showFactoryPage(host, equipment);
      return;
    }
    if (!dependencies.canCustomize(host.selected.itemId)) {
      showPracticeVehicle(host);
      return;
    }
    const base = host.base();
    const vehicleFamily = dependencies.vehicleFamily(base, host.selected.engineGrade ?? 0);
    const layout = dependencies.layoutForGrade(host.selected.engineGrade);
    if (!layout)
      throw new Error(`车库不支持 engineGrade=${String(host.selected.engineGrade)} 的界面预置。`);
    host.element.dataset.engineLayout = layout.kind;
    compatibleCosmeticTabs(host, layout);
    if (host.pageMode === "level") {
      showLevelPage(host, equipment, base, layout, family, kind, supported, dependencies);
      return;
    }
    host.updateVehicleInformation(base, equipment, layout);
    showPartsPage(host, equipment, base, vehicleFamily, layout, dependencies);
  } catch (error) {
    host.info.replaceChildren();
    host.comparisons.length = 0;
    host.cancelPreview.hidden = true;
    host.removePart.disabled = true;
    host.inventory.textContent = `当前车辆参数不可用：${error instanceof Error ? error.message : error}`;
  }
  host.inventory.scrollTop = scrollTop;
  host.updatePageVisibility();
  host.updateCards();
}
