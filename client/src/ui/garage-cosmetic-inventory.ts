export interface GarageInventoryCosmetic {
  id: string | number;
  family: string;
  title: string;
  slot?: string;
  icon?: string;
  previewModel?: string;
  unavailableReason?: string;
  [key: string]: unknown;
}

export interface GarageCosmeticInventoryHost {
  selected: { itemId: number; engineGrade?: number };
  configuration: unknown;
  cosmeticSlot?: string;
  cosmeticBusy: boolean;
  cosmeticPreview?: GarageInventoryCosmetic;
  coatingPreview?: GarageInventoryCosmetic;
  assets: {
    coatings: GarageInventoryCosmetic[];
    cosmetics: GarageInventoryCosmetic[];
    imageUrls: Map<string, string>;
  };
  inventory: HTMLElement;
  cancelPreview: HTMLElement;
  status: { textContent: string };
  panels?: { setTransformPreview?(enabled: boolean): void };
  serial(): number;
  base(): { partsLocks: number[]; [key: string]: unknown };
  button(label: string, onClick: () => void): HTMLButtonElement;
  icon(name: string, className: string): HTMLElement | undefined;
  cosmeticIcon(choice: GarageInventoryCosmetic, className: string): HTMLElement | undefined;
  skin(button: HTMLButtonElement, name: string): void;
  requestCoating(choice: GarageInventoryCosmetic): void;
  requestCosmetic(choice: GarageInventoryCosmetic): void;
  addModelTarget(button: HTMLButtonElement, model: { path: string }, className: string,
    row: number, placeholder: HTMLElement, dimensions: [number, number]): void;
  startTransformPreview(): void;
  transformPreviewSessionActive(): boolean;
  controls?: { querySelectorAll(selector: string): NodeListOf<HTMLElement> };
}

export interface GarageCosmeticInventoryDependencies {
  currentConfiguration(configuration: unknown, itemId: number, serial: number):
    { cosmetics?: Record<string, unknown> };
  vehicleFamily(base: unknown, engineGrade: number | undefined): string | undefined;
  choicesForSlot(choices: GarageInventoryCosmetic[], slot: string | undefined): GarageInventoryCosmetic[];
  slotLocked(base: unknown, slot: string | undefined): boolean;
  canEquip(locked: boolean, unavailable?: boolean): boolean;
  cardBackgroundKey: string;
}

/** Resolve an archive icon for a coating or cosmetic choice. */
export function garageCosmeticIcon(
  host: GarageCosmeticInventoryHost,
  choice: GarageInventoryCosmetic,
  className: string,
): HTMLElement | undefined {
  return choice.icon ? host.icon(`parts:${choice.icon.slice(14, -4)}`, className) : undefined;
}

/** Render coatings with a separate preview action and an immediate equipment action. */
export function updateGarageCoatingInventory(
  host: GarageCosmeticInventoryHost,
  dependencies: Pick<GarageCosmeticInventoryDependencies,
    "currentConfiguration" | "vehicleFamily" | "canEquip" | "cardBackgroundKey">,
): void {
  const base = host.base();
  const family = dependencies.vehicleFamily(base, host.selected.engineGrade) === "xun"
    ? "xun" : "classic";
  const locked = base.partsLocks[4] !== 0 ||
    (host.selected.engineGrade !== 8 && host.selected.engineGrade !== 9);
  const equipped = dependencies.currentConfiguration(host.configuration,
    host.selected.itemId, host.serial()).cosmetics?.coating;
  host.status.textContent = "点击预览；确认装备后立即应用。取消预览恢复当前装备。";
  for (const coating of host.assets.coatings.filter(choice => choice.family === family)) {
    const card = document.createElement("div");
    card.className = "garage-part-card garage-cosmetic-card";
    card.classList.toggle("selected", equipped === coating.id);
    const background = host.assets.imageUrls.get(dependencies.cardBackgroundKey);
    if (background) card.style.backgroundImage = `url("${background}")`;
    const preview = host.button("", () => {
      host.coatingPreview = coating;
      host.cancelPreview.hidden = false;
      host.status.textContent = `试穿：${coating.title}。可拖动车辆或开启变形预览，不会写入装备。`;
    });
    preview.className = "garage-part-preview";
    preview.setAttribute("aria-label", `试穿 ${coating.title}`);
    preview.disabled = locked || host.cosmeticBusy || !!coating.unavailableReason;
    preview.title = locked ? "车型禁止安装车膜" : (coating.unavailableReason ?? coating.title);
    const label = document.createElement("span");
    label.className = "garage-cosmetic-name";
    label.textContent = coating.title;
    preview.append(label);
    const icon = host.cosmeticIcon(coating, "garage-inventory-icon");
    if (icon) preview.append(icon);
    card.append(preview);
    if (dependencies.canEquip(locked, !!coating.unavailableReason)) {
      const equip = host.button(equipped === coating.id ? "已装备" : "装备",
        () => host.requestCoating(coating));
      equip.className = "garage-equip-label";
      host.skin(equip, "garage_btn_equip_");
      equip.setAttribute("aria-label", `装备 ${coating.title}`);
      equip.disabled = equipped === coating.id || host.cosmeticBusy;
      card.append(equip);
    }
    host.inventory.append(card);
  }
}

/** Render the active cosmetic slot, including 3D model hints and preview reset. */
export function updateGarageCosmeticInventory(
  host: GarageCosmeticInventoryHost,
  dependencies: Pick<GarageCosmeticInventoryDependencies,
    "currentConfiguration" | "vehicleFamily" | "choicesForSlot" |
    "slotLocked" | "canEquip" | "cardBackgroundKey">,
): void {
  const slot = host.cosmeticSlot;
  const base = host.base();
  const family = dependencies.vehicleFamily(base, host.selected.engineGrade) === "xun"
    ? "xun" : "classic";
  const equipped = dependencies.currentConfiguration(host.configuration,
    host.selected.itemId, host.serial()).cosmetics?.[slot as string];
  const choices = dependencies.choicesForSlot(
    host.assets.cosmetics.filter(choice => choice.family === family), slot);
  for (const [index, choice] of choices.entries()) {
    const card = document.createElement("div");
    card.className = `garage-part-card garage-cosmetic-card${slot === "boosterEffect"
      ? " garage-booster-effect-card" : ""}`;
    card.classList.toggle("selected", equipped === choice.id);
    const background = host.assets.imageUrls.get(dependencies.cardBackgroundKey);
    if (background) card.style.backgroundImage = `url("${background}")`;
    const preview = host.button("", () => {
      const previous = host.cosmeticPreview;
      if (previous && (previous.id !== choice.id || previous.slot !== choice.slot ||
          previous.family !== choice.family)) host.panels?.setTransformPreview?.(false);
      host.cosmeticPreview = choice;
      host.cancelPreview.hidden = false;
      host.status.textContent = `预览：${choice.title}，尚未装备。`;
      host.startTransformPreview();
    });
    preview.className = "garage-part-preview";
    preview.setAttribute("aria-label", `预览 ${choice.title}`);
    preview.title = choice.title;
    const label = document.createElement("span");
    label.className = "garage-cosmetic-name";
    label.textContent = choice.title;
    preview.append(label);
    const icon = host.cosmeticIcon(choice, "garage-inventory-icon");
    if (icon) preview.append(icon);
    else {
      const hint = document.createElement("span");
      hint.className = "garage-cosmetic-preview-hint";
      hint.textContent = "点击预览";
      preview.append(hint);
      if (choice.previewModel) host.addModelTarget(preview, { path: choice.previewModel },
        "garage-inventory-icon garage-booster-effect-model",
        Math.floor(index / 3), hint, [136, 100]);
    }
    const locked = dependencies.slotLocked(base, slot);
    preview.disabled = locked || host.cosmeticBusy;
    card.append(preview);
    if (dependencies.canEquip(locked)) {
      const equippedHere = equipped === choice.id;
      const equip = host.button(equippedHere ? "已装备" : "装备",
        () => host.requestCosmetic(choice));
      equip.className = "garage-equip-label";
      equip.setAttribute("aria-label", `${equippedHere ? "已装备" : "装备"} ${choice.title}`);
      host.skin(equip, "garage_btn_equip_");
      equip.disabled = equippedHere || host.cosmeticBusy;
      card.append(equip);
    }
    host.inventory.append(card);
  }
}

/** Keep mounted preview buttons in sync with the transform preview session. */
export function syncGarageCosmeticPreviewActions(host: GarageCosmeticInventoryHost): void {
  const active = host.transformPreviewSessionActive();
  host.controls?.querySelectorAll("[data-cosmetic-preview='true']").forEach(button => {
    const label = active ? "取消" : "预览";
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "取消预览" : "预览车灯");
  });
}
