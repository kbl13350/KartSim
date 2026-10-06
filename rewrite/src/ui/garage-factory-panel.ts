import type { GarageFactoryConfiguration } from "./garage-factory-commit";
import type { FactoryDraftSlot, FactoryPickerRect } from "./garage-factory-picker";

export interface GarageFactoryPanelVehicle {
  engineGrade?: number;
  kartType?: number;
  vehicleRarityLevel?: number;
}

export interface GarageFactoryPanelAssets {
  nodes: Map<string, unknown>;
  rects: Map<string, FactoryPickerRect>;
  strings: Map<string, string>;
  urls: Map<string, string>;
  qualityColors?: Map<number, string>;
  fontFamily?: string;
}

export interface GarageFactoryPanelHost {
  assets: GarageFactoryPanelAssets;
  element: HTMLElement;
  catalog: boolean;
  installed: boolean;
  scoreLabel?: HTMLElement;
  emptyVehicleInfo: boolean;
  pickerVehicleKey?: unknown;
  draft?: FactoryDraftSlot[];
  draftDirty: boolean;
  appliedSignature?: string;
  actionFrameRedraws: Set<() => void>;
  model?: { context: CanvasRenderingContext2D; source: { path: string; panel: unknown } };
  modelReady: boolean;
  onTutorial?: () => void;
  onTabChange(): void;
  onConfirm(message: string, action: () => void, options?: { singleAction: boolean }): void;
  label(text: string | undefined, rect: FactoryPickerRect | undefined, node?: string): HTMLElement;
  place(element: HTMLElement, rect: FactoryPickerRect | undefined): void;
  updateScores(): void;
  styleActionFrame(button: HTMLButtonElement): void;
  renderAbilityPicker(configuration: GarageFactoryConfiguration,
    editable: boolean, rect: FactoryPickerRect | undefined): void;
  commit(configuration: GarageFactoryConfiguration): void;
}

export interface GarageFactoryPanelDependencies {
  defaultConfiguration(): GarageFactoryConfiguration;
  signature(configuration: GarageFactoryConfiguration): string;
  draftFrom(configuration: GarageFactoryConfiguration): FactoryDraftSlot[];
  abilityDescriptions: readonly { id: number; label: string; level: number }[];
  attribute(node: unknown, name: string): string | undefined;
  nativeStatePath(base: string, state: number): string;
  childRect(node: unknown, parent: FactoryPickerRect | undefined): FactoryPickerRect;
}

function renderTutorialButton(host: GarageFactoryPanelHost,
  dependencies: GarageFactoryPanelDependencies): void {
  const node = host.assets.nodes.get("tutorial");
  const rect = host.assets.rects.get("tutorial");
  if (!node || !rect || !host.onTutorial) return;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "改装车间教程");
  button.onclick = host.onTutorial;
  const imageBase = dependencies.attribute(node, "autoLoadImage")!;
  const setState = (state: number) => {
    button.style.backgroundImage =
      `url("${host.assets.urls.get(dependencies.nativeStatePath(imageBase, state)) ?? ""}")`;
  };
  Object.assign(button.style, {
    border: "0", padding: "0", backgroundColor: "transparent", backgroundSize: "100% 100%",
  });
  button.onpointerenter = () => setState(2);
  button.onpointerdown = () => setState(3);
  button.onpointerup = () => setState(2);
  button.onpointerleave = () => setState(1);
  setState(1);
  host.place(button, rect);
}

function renderFactoryVehicleInfo(
  host: GarageFactoryPanelHost,
  supported: boolean,
  vehicleName: string | undefined,
  vehicle: GarageFactoryPanelVehicle | undefined,
  dependencies: GarageFactoryPanelDependencies,
): void {
  const labelRect = host.assets.rects.get("clblSpecName");
  const valueRect = host.assets.rects.get("clblSpecValue");
  if (labelRect && valueRect) {
    const scoreNames = [
      "partsCatNameAccel", "partsCatNameCorner", "partsCatNameDrift",
      "partsCatNameBoosterTime", "partsCatNameDriftGauge",
    ].map(key => (host.assets.strings.get(key) ?? "")
      .replace(/\[\/?color[^\]]*\]/g, "")).join("\n");
    host.label(scoreNames, labelRect, "clblSpecName");
    host.scoreLabel = host.label("", valueRect, "clblSpecValue");
    if (supported) host.updateScores();
  }

  const classRect = host.assets.rects.get("subInfoKartClassStr");
  if (supported && vehicle && classRect) {
    const kartClass = vehicle.kartType === 1 ? "itemKart" :
      vehicle.kartType === 2 ? "speedkart" : undefined;
    const className = kartClass && host.assets.strings.get(kartClass);
    const rarityKeys: Record<number, string> = {
      0: "loGradeAverage", 1: "loGradeUnique", 2: "loGradeLegend",
      3: "loGradeRare", 4: "loGradeAverage",
    };
    const rarityKey = vehicle.vehicleRarityLevel === undefined ? undefined :
      rarityKeys[vehicle.vehicleRarityLevel];
    const rarityName = rarityKey && host.assets.strings.get(rarityKey);
    const label = host.label([className, rarityName].filter(Boolean).join(" / "),
      classRect, "subInfoKartClassStr");
    label.style.color = vehicle.vehicleRarityLevel === undefined ? "white" :
      host.assets.qualityColors?.get(vehicle.vehicleRarityLevel) ?? "white";
  }

  for (const name of ["selectedKart", "subjectName"]) {
    const node = host.assets.nodes.get(name);
    const rect = host.assets.rects.get(name);
    if (!node || !rect) continue;
    const stringKey = dependencies.attribute(node, "text")?.match(/^#sb\((.+)\)$/)?.[1];
    const text = supported && name === "subjectName" ? vehicleName :
      stringKey && host.assets.strings.get(stringKey);
    if (text) host.label(text, rect, name);
  }

  const tuneStateNode = host.assets.nodes.get("tuneState") as
    { children?: unknown[] } | undefined;
  const caption = tuneStateNode?.children?.find(child =>
    dependencies.attribute(child, "text") === "#sb(tuneState)");
  if (caption) {
    host.label(host.assets.strings.get("tuneState"),
      dependencies.childRect(caption, host.assets.rects.get("tuneState")),
      host.assets.nodes.get("tuneStateCaption") ? "tuneStateCaption" : undefined);
  }
}

function renderFactoryModel(
  host: GarageFactoryPanelHost,
  configuration: GarageFactoryConfiguration | undefined,
  supported: boolean,
  dependencies: GarageFactoryPanelDependencies,
): void {
  host.model = undefined;
  host.modelReady = false;
  if (!supported || !configuration) return;
  const name = configuration.active ? "enableReset" : "enableTune";
  const node = host.assets.nodes.get(name);
  const rect = host.assets.rects.get(name)!;
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext("2d");
  if (!context) return;
  host.place(canvas, rect);
  host.model = {
    context,
    source: { path: `stage_/tuning/${dependencies.attribute(node, "scene")}.1s`, panel: node },
  };
}

function renderFactoryTabs(
  host: GarageFactoryPanelHost,
  installed: boolean,
  dependencies: GarageFactoryPanelDependencies,
): void {
  for (const [name, label, catalogTab] of [
    ["tab_kart", host.assets.strings.get("mqKarts"), true],
    ["tab_parts", "自定义粒子效果", false],
  ] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label as string;
    button.setAttribute("aria-pressed", String(host.catalog === catalogTab));
    button.classList.add("garage-factory-tab");
    if (host.assets.fontFamily)
      button.style.fontFamily = `"${host.assets.fontFamily}", sans-serif`;
    const imageBase = dependencies.attribute(host.assets.nodes.get(name), "autoLoadImage")!;
    for (let state = 1; state <= 4; state++) {
      const url = host.assets.urls.get(dependencies.nativeStatePath(imageBase, state));
      if (url) button.style.setProperty(`--native-state-${state}`, `url("${url}")`);
    }
    button.onclick = () => {
      if (!catalogTab && !installed) {
        host.onConfirm("请先装备粒子魔方/车辆后再进行自定义", () => {},
          { singleAction: true });
        return;
      }
      host.catalog = catalogTab;
      host.onTabChange();
    };
    host.place(button, host.assets.rects.get(name));
  }
}

function renderFactoryAction(
  host: GarageFactoryPanelHost,
  original: GarageFactoryConfiguration | undefined,
  configuration: GarageFactoryConfiguration,
  supported: boolean,
  busy: boolean,
  dependencies: GarageFactoryPanelDependencies,
): void {
  const abilityNames = configuration.abilities.map(id => {
    const ability = dependencies.abilityDescriptions.find(candidate => candidate.id === id);
    return ability ? `${ability.label} · ${ability.level}级` : "属性为空";
  });
  host.label(original ? host.assets.strings.get("equipPlotter") :
    host.assets.strings.get("emptyPlotter")!.replaceAll("|", "\n"),
  host.assets.rects.get("abilityTitle"), "abilityTitle");
  host.label(original ? `${configuration.active ? "已激活" : "未激活"}\n${abilityNames.join("\n")}` : "",
    host.assets.rects.get("abilityDesc"), "abilityDesc");

  const action = original ? (configuration.active ? "reset" : "tunning") : "equip";
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.factoryAction = action;
  button.textContent = busy ? "正在提交……" :
    host.assets.strings.get(action) ?? { equip: "装备", tunning: "激活", reset: "重置" }[action];
  button.disabled = !supported;
  if (!supported && !busy)
    button.title = "当前车辆未满足本地改装适配条件；不代表官服无法装备魔方。";
  Object.assign(button.style, {
    color: "white",
    font: `16px "${host.assets.fontFamily ?? "P3528 Source Han Sans CN Ready"}", sans-serif`,
  });
  button.onclick = () => {
    if (original) {
      if (configuration.active) {
        host.onConfirm("立即重置当前车辆的粒子改记录？",
          () => host.commit(dependencies.defaultConfiguration()));
      } else if (configuration.abilities.some(ability => ability === 0)) {
        host.catalog = false;
        host.onTabChange();
      } else {
        host.onConfirm("激活所选三项改装功能并立即应用到当前车辆？不消耗道具。",
          () => host.commit({ ...configuration, active: true }));
      }
    } else {
      host.onConfirm("装备改装魔方并立即记录到当前车辆？不消耗官服道具。",
        () => host.commit(dependencies.defaultConfiguration()));
    }
  };
  host.place(button, host.assets.rects.get(action));
  host.styleActionFrame(button);
  if (!host.catalog) host.renderAbilityPicker(configuration, supported && !!original,
    host.assets.rects.get("ContentTab"));
}

/** Refresh the Factory page while keeping a dirty picker draft for the same vehicle. */
export function updateGarageFactoryPanel(
  host: GarageFactoryPanelHost,
  original: GarageFactoryConfiguration | undefined,
  supported: boolean,
  busy = false,
  vehicleName?: string,
  vehicle?: GarageFactoryPanelVehicle,
  vehicleKey: unknown = vehicleName,
  dependencies?: GarageFactoryPanelDependencies,
): void {
  const data = dependencies!;
  if (!original && !host.catalog) host.catalog = true;
  const configuration = original ?? data.defaultConfiguration();
  const signature = data.signature(configuration);
  host.actionFrameRedraws.clear();
  if (host.pickerVehicleKey !== vehicleKey || !host.draft ||
      !host.draftDirty && host.appliedSignature !== signature) {
    host.pickerVehicleKey = vehicleKey;
    host.draft = data.draftFrom(configuration);
    host.draftDirty = false;
  }
  host.appliedSignature = signature;
  host.element.replaceChildren();
  host.element.dataset.factoryPresentation = vehicle?.engineGrade === 9 ? "xun" :
    vehicle?.engineGrade === 8 ? "v1" : "classic";
  host.installed = !!original;
  host.scoreLabel = undefined;
  host.element.setAttribute("aria-busy", String(busy));
  const canInteract = supported && !busy;
  host.emptyVehicleInfo = !canInteract;

  renderTutorialButton(host, data);
  renderFactoryVehicleInfo(host, canInteract, vehicleName, vehicle, data);
  renderFactoryModel(host, original, canInteract, data);
  renderFactoryTabs(host, !!original, data);
  renderFactoryAction(host, original, configuration, canInteract, busy, data);
}
