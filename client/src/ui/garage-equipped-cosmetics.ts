import type { GarageInventoryCosmetic } from "./garage-cosmetic-inventory";

export interface GarageEquippedCosmeticLayout {
  kind: string;
  equippedRoot: string;
  slotSize: number;
  cosmeticTabs: Array<{ node: string; label: string }>;
}

export interface GarageEquippedCosmeticEquipment {
  cosmetics?: Record<string, unknown>;
}

export interface GarageEquippedCosmeticsHost {
  assets: {
    coatings: GarageInventoryCosmetic[];
    cosmetics: GarageInventoryCosmetic[];
    strings: Map<string, string>;
    nodes: Map<string, unknown>;
  };
  coatingMode: boolean;
  cosmeticSlot?: string;
  cosmeticPreview?: GarageInventoryCosmetic;
  coatingPreview?: GarageInventoryCosmetic;
  previewPart: unknown;
  transformPreviewStartPending: boolean;
  inventory: { scrollTop: number };
  cancelPreview: { hidden: boolean };
  status: { textContent: string };
  panels?: {
    setTransformPreview?(enabled: boolean): void;
    toggleTransformPreview(): void;
  };
  button(label: string, onClick: () => void): HTMLButtonElement;
  icon(name: string, className: string): HTMLElement | undefined;
  cosmeticIcon(choice: GarageInventoryCosmetic, className: string): HTMLElement | undefined;
  place(button: HTMLButtonElement, rect: unknown): void;
  rect(path: string): unknown;
  nativeButton(path: string, label: string, onClick: () => void): HTMLButtonElement;
  transformPreviewSessionActive(): boolean;
  startTransformPreview(force?: boolean): void;
  syncTransformPreviewUi(): void;
  updatePerformance(): void;
  updateControls(): void;
}

export interface GarageEquippedCosmeticsDependencies {
  defaultLampIcon(family: string): string;
}

/** Render equipped coating, tail lamp and booster slots for the selected kart layout. */
export function updateGarageCosmeticEquippedSlots(
  host: GarageEquippedCosmeticsHost,
  equipment: GarageEquippedCosmeticEquipment,
  layout: GarageEquippedCosmeticLayout,
  interactive: boolean,
  dependencies: GarageEquippedCosmeticsDependencies,
): void {
  const root = layout.kind === "xun"
    ? `${layout.equippedRoot}/selectedKartEquipped12`
    : `${layout.equippedRoot}/selectedKartEquippedV1`;
  for (const { node, label } of layout.cosmeticTabs) {
    const slot = node.includes("Lamp") ? "tailLamp"
      : node.includes("Booster") ? "boosterEffect" : undefined;
    const onSelect = interactive ? () => {
      host.coatingMode = !slot;
      host.cosmeticSlot = slot;
      host.cosmeticPreview = undefined;
      host.previewPart = undefined;
      host.transformPreviewStartPending = false;
      host.panels?.setTransformPreview?.(false);
      host.inventory.scrollTop = 0;
      host.updateControls();
    } : () => {};
    const button = host.button("", onSelect);
    button.className = `garage-equipped-slot${layout.slotSize === 50 ? " compact" : ""}`;
    button.dataset.cosmeticSlot = node;
    if (!interactive) button.dataset.vehicleInfo = "true";
    button.title = label;
    button.disabled = !interactive;
    button.setAttribute("aria-disabled", String(!interactive));
    const name = document.createElement("span");
    name.textContent = label;
    const equippedId = slot ? equipment.cosmetics?.[slot] : equipment.cosmetics?.coating;
    const family = layout.kind === "xun" ? "xun" : "classic";
    const choice = slot
      ? host.assets.cosmetics.find(item => item.slot === slot && item.family === family && item.id === equippedId)
      : host.assets.coatings.find(item => item.family === family && item.id === equippedId);
    const defaultLamp = slot === "tailLamp" && equippedId === undefined;
    const frameName = layout.kind === "v1" && defaultLamp ? "uniqueLevel_4"
      : `uniqueLevel_0${layout.slotSize === 50 ? "_50x50" : ""}`;
    const frame = host.icon(frameName, "garage-part-frame");
    if (frame) button.append(frame);
    button.title = choice ? `${label} · ${choice.title}` : label;
    button.setAttribute("aria-label", button.title);
    if (choice) {
      const stateFrame = host.icon(`uniqueLevel_5${layout.slotSize === 50 ? "_50x50" : ""}`,
        "garage-equipped-state-frame");
      if (stateFrame) {
        stateFrame.setAttribute("aria-hidden", "true");
        button.append(stateFrame);
      }
    }
    if (choice?.icon) {
      const icon = host.cosmeticIcon(choice, "garage-equipped-icon");
      if (icon) button.append(icon);
    } else if (defaultLamp) {
      const icon = host.icon(dependencies.defaultLampIcon(family), "garage-equipped-icon");
      if (icon) button.append(icon);
    }
    const value = document.createElement("strong");
    const empty = node.includes("Lamp")
      ? (host.assets.strings.get("emptyLamp") ?? "基础车灯")
      : (host.assets.strings.get("emptyParts") ?? "未装备");
    value.textContent = choice?.title ?? empty;
    button.append(name, value);
    host.place(button, host.rect(`/${root}/${node}`));

    if (layout.kind === "v1" && node === "partsTailLamp" && (choice || defaultLamp)) {
      const previewPath = `/${root}/${node}/previewEquippedTailLamp`;
      if (host.assets.nodes.has(previewPath)) {
        const lamp = slot === "tailLamp" ? choice : undefined;
        const preview = host.nativeButton(previewPath,
          host.transformPreviewSessionActive() ? "取消" : "预览", () => {
            const wasActive = host.transformPreviewSessionActive();
            host.cosmeticPreview = wasActive ? undefined : lamp;
            if (wasActive) {
              host.transformPreviewStartPending = false;
              host.panels?.toggleTransformPreview();
            } else host.startTransformPreview(true);
            host.syncTransformPreviewUi();
            const active = host.transformPreviewSessionActive();
            preview.textContent = active ? "取消" : "预览";
            preview.setAttribute("aria-pressed", String(active));
            preview.setAttribute("aria-label", active ? "取消预览" : `预览 ${label}`);
            host.cancelPreview.hidden = !host.previewPart &&
              !host.cosmeticPreview && !host.coatingPreview;
            const lampTitle = lamp?.title ?? host.assets.strings.get("emptyLamp") ?? "基础车灯";
            host.status.textContent = active
              ? `预览：${lampTitle}，尚未装备。` : "已取消车灯预览。";
            host.updatePerformance();
          });
        preview.classList.add("garage-equipped-preview-action");
        preview.dataset.cosmeticPreview = "true";
        preview.dataset.vehicleInfo = "true";
        const active = host.transformPreviewSessionActive();
        preview.textContent = active ? "取消" : "预览";
        preview.setAttribute("aria-pressed", String(active));
        preview.setAttribute("aria-label", active ? "取消预览" : `预览 ${label}`);
      }
    }
  }
}
