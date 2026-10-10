export interface GarageInfoPart {
  family?: string;
  [key: string]: unknown;
}

export interface GarageInfoLayout {
  kind: string;
  slotSize: number;
  equippedRoot: string;
}

export interface GarageVehicleInformationHost {
  selected: {
    title: string;
    engineGrade?: number;
    uniqueLevel?: number;
    vehicleRarityLevel?: number;
  };
  pageMode: string;
  coatingMode: boolean;
  cosmeticSlot?: string;
  slot: string;
  slotControls: Map<string, HTMLButtonElement>;
  assets: {
    parts: unknown;
    nodes: Map<string, unknown>;
    strings: Map<string, string>;
  };
  tuning: {
    qualityColors?: Map<number, string>;
    urls: Map<string, string>;
  };
  defaultPartGrades: unknown;
  kartName: HTMLElement;
  vehicleFunctions: HTMLElement;
  updatePerformance(): void;
  updateVehicleFunctions(vehicle: unknown, layout: GarageInfoLayout): void;
  partLabel(part: GarageInfoPart): string;
  partVisual(button: HTMLButtonElement, part: GarageInfoPart, className: string): void;
  icon(name: string, className: string): HTMLElement | undefined;
  addModelTarget(button: HTMLButtonElement, model: { path: string; panel: unknown },
    className: string): void;
  rect(path: string): unknown;
  place(button: HTMLButtonElement, rect: unknown): void;
}

export interface GarageVehicleFunction {
  icon: string;
  focusedIcon: string;
  nameKey: string;
  descriptionKey: string;
}

export interface GarageVehicleInformationDependencies {
  vehicleFamily(vehicle: unknown, engineGrade: number | undefined): string | undefined;
  resolvePart(vehicle: unknown, equipment: unknown, slot: string, available: unknown,
    engineGrade: number | undefined, uniqueLevel: number | undefined,
    defaultGrades: unknown): GarageInfoPart | undefined;
  slotLocked(vehicle: unknown, slot: string): boolean;
  xunPartLevel(part: GarageInfoPart, available: unknown): number | undefined;
  partPresentation(label: string | undefined, locked: boolean,
    emptyLabel?: string): { value: string; state?: string };
  slotLabel(slot: string, family: string | undefined): string;
  uniqueLevel(part: GarageInfoPart): number | undefined;
  isMaxLevel(part: GarageInfoPart, available: unknown, equipped: boolean): boolean;
  sceneAttribute(node: unknown, name: "scene"): string | undefined;
  slotNodeNames: Record<string, string>;
  vehicleFunctions(vehicle: unknown): GarageVehicleFunction[];
}

/** Fill equipped part slots with current labels, lock state and visual effects. */
export function updateGarageVehicleInformation(
  host: GarageVehicleInformationHost,
  vehicle: unknown,
  equipment: unknown,
  layout: GarageInfoLayout,
  refreshPerformance: boolean,
  dependencies: Pick<GarageVehicleInformationDependencies,
    "vehicleFamily" | "resolvePart" | "slotLocked" | "xunPartLevel" |
    "partPresentation" | "slotLabel" | "uniqueLevel" | "isMaxLevel" |
    "sceneAttribute" | "slotNodeNames">,
): void {
  if (refreshPerformance) host.updatePerformance();
  host.updateVehicleFunctions(vehicle, layout);
  const family = dependencies.vehicleFamily(vehicle, host.selected.engineGrade);
  for (const [slot, button] of host.slotControls) {
    const part = dependencies.resolvePart(vehicle, equipment, slot, host.assets.parts,
      host.selected.engineGrade, host.selected.uniqueLevel, host.defaultPartGrades);
    const locked = dependencies.slotLocked(vehicle, slot);
    const partName = part?.family === "xun"
      ? (() => {
          const level = dependencies.xunPartLevel(part, host.assets.parts);
          return level === undefined ? host.partLabel(part) : `Lv.${level}`;
        })()
      : part ? host.partLabel(part) : undefined;
    const classic = host.selected.engineGrade !== undefined &&
      host.selected.engineGrade >= 0 && host.selected.engineGrade <= 6;
    const presentation = dependencies.partPresentation(
      partName, locked, classic ? "未装备" : undefined);
    const label = dependencies.slotLabel(slot, family);
    const title = `${label} · ${presentation.value}${presentation.state ? ` · ${presentation.state}` : ""}`;
    button.replaceChildren();
    button.title = title;
    button.setAttribute("aria-label", title);
    const level = part ? dependencies.uniqueLevel(part) : 0;
    const frame = level === undefined ? undefined : host.icon(
      `uniqueLevel_${level}${layout.slotSize === 50 ? "_50x50" : ""}`,
      "garage-part-frame");
    if (frame) button.append(frame);
    if (part) host.partVisual(button, part, "garage-equipped-icon");
    if (part?.family === "xun" && dependencies.isMaxLevel(part, host.assets.parts, true)) {
      const node = host.assets.nodes.get(
        `/${layout.equippedRoot}/${dependencies.slotNodeNames[slot]}/item/partsLvMaxEffect1s`);
      if (node) host.addModelTarget(button,
        { path: `stage_/common/${dependencies.sceneAttribute(node, "scene")}.1s`, panel: node },
        "garage-part-max-effect");
    }
    if (locked) {
      const lock = host.icon(layout.kind === "xun"
        ? "garage_img_partsBG1_lock2" : "garage_img_partsBG1_lock",
      "garage-part-frame garage-part-lock");
      if (lock) button.append(lock);
    }
    const name = document.createElement("span");
    name.textContent = label;
    const value = document.createElement("strong");
    value.textContent = presentation.value;
    button.append(name, value);
    button.classList.toggle("compact", layout.slotSize === 50);
    host.place(button, host.rect(`/${layout.equippedRoot}/${dependencies.slotNodeNames[slot]}`));
    const partsPage = host.pageMode === "parts";
    const selected = partsPage && !host.coatingMode && !host.cosmeticSlot && slot === host.slot;
    button.disabled = !partsPage;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

/** Show the vehicle title, rarity color and optional tuning level badge. */
export function updateGarageVehicleHeading(
  host: GarageVehicleInformationHost,
  level?: number,
): void {
  host.kartName.replaceChildren();
  const title = document.createElement("span");
  title.textContent = host.selected.title;
  const rarity = host.selected.vehicleRarityLevel;
  title.style.color = rarity === undefined ? "white"
    : (host.tuning.qualityColors?.get(rarity) ?? "white");
  host.kartName.append(title);
  if (level !== undefined && level > 0) {
    const url = host.tuning.urls.get(`tuning_mark_${level}`);
    if (url) {
      const badge = document.createElement("img");
      badge.src = url;
      badge.alt = `+${level}`;
      badge.className = "garage-x-kart-level-badge";
      host.kartName.append(badge);
    }
  }
}

/** Render ability descriptions only for XUN vehicles. */
export function updateGarageVehicleFunctions(
  host: GarageVehicleInformationHost,
  vehicle: unknown,
  layout: GarageInfoLayout,
  dependencies: Pick<GarageVehicleInformationDependencies, "vehicleFunctions">,
): void {
  host.vehicleFunctions.replaceChildren();
  if (layout.kind !== "xun") return;
  const row = document.createElement("div");
  row.className = "garage-vehicle-function-row";
  for (const ability of dependencies.vehicleFunctions(vehicle)) {
    const item = document.createElement("div");
    item.className = "garage-vehicle-function";
    item.tabIndex = 0;
    const background = host.icon("garage_kartFuncSlotBg", "garage-vehicle-function-background");
    const icon = host.icon(ability.icon, "garage-vehicle-function-icon normal");
    const focused = host.icon(ability.focusedIcon, "garage-vehicle-function-icon focused");
    const name = host.assets.strings.get(ability.nameKey) ?? ability.nameKey;
    const description = host.assets.strings.get(ability.descriptionKey) ?? ability.descriptionKey;
    item.title = `${name}\n${description}`;
    item.setAttribute("aria-label", `${name}：${description}`);
    if (background) item.append(background);
    if (icon) item.append(icon);
    if (focused) item.append(focused);
    row.append(item);
  }
  host.vehicleFunctions.append(row);
}
