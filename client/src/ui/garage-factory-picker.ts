import type { GarageFactoryConfiguration } from "./garage-factory-commit";

export interface FactoryDraftSlot {
  group?: number;
  level?: number;
}

export interface FactoryPickerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FactoryAbilityDefinition {
  id: number;
  label: string;
}

export interface GarageFactoryPickerHost {
  assets: {
    nodes: Map<string, unknown>;
    urls: Map<string, string>;
    fontFamily?: string;
  };
  draft?: FactoryDraftSlot[];
  draftDirty: boolean;
  appliedSignature?: string;
  selectedAbilityIndex: number;
  onTabChange(): void;
  onChange(configuration: GarageFactoryConfiguration): void;
  label(text: string, rect: FactoryPickerRect): HTMLElement;
  place(element: HTMLElement, rect: FactoryPickerRect): void;
  factoryChoiceButton(text: string, pressed: boolean, disabled: boolean,
    action: () => void): HTMLButtonElement;
  updateDraftSlot(index: number, slot: FactoryDraftSlot): void;
  commit(configuration: GarageFactoryConfiguration): void;
}

export interface GarageFactoryPickerDependencies {
  abilities: readonly FactoryAbilityDefinition[];
  draftFrom(configuration: GarageFactoryConfiguration): FactoryDraftSlot[];
  signature(configuration: GarageFactoryConfiguration): string;
  validate(configuration: GarageFactoryConfiguration): void;
  abilityId(group: number, level: number): number;
  stylePrimary(button: HTMLButtonElement): void;
  nodeAttribute(node: unknown, name: string): string;
  nativeStatePath(base: string, state: number): string;
}

const pickerWidth = 550;
const columnGap = 8;
const columnWidth = (pickerWidth - columnGap * 2) / 3;

/** Build the three-slot Factory editor with independent attribute and level choices. */
export function renderGarageFactoryAbilityPicker(
  host: GarageFactoryPickerHost,
  configuration: GarageFactoryConfiguration,
  editable: boolean,
  bounds: FactoryPickerRect,
  dependencies: GarageFactoryPickerDependencies,
): void {
  const left = bounds.x + 20;
  const draft = host.draft ?? dependencies.draftFrom(configuration);
  const instruction = host.label("选择栏位后依次选择属性和等级", {
    x: left, y: bounds.y + 65, width: pickerWidth, height: 28,
  });
  instruction.className = "garage-factory-picker-instruction";

  draft.forEach((slot, index) => {
    const definition = slot.group === undefined ? undefined :
      dependencies.abilities.find(ability => Math.floor(ability.id / 100) === slot.group);
    const description = definition
      ? `第${index + 1}栏 ${definition.label} ${slot.level === undefined ? "等级未选择" : `Lv.${slot.level}`}`
      : `第${index + 1}栏 属性为空`;
    const button = host.factoryChoiceButton(description, host.selectedAbilityIndex === index,
      false, () => {
        host.selectedAbilityIndex = index;
        host.onTabChange();
      });
    button.classList.add("garage-factory-slot-choice");
    button.textContent = "";
    const name = document.createElement("span");
    name.className = "garage-factory-slot-name";
    name.textContent = definition?.label ?? "属性为空";
    const level = document.createElement("span");
    level.className = "garage-factory-slot-level";
    level.textContent = slot.level === undefined ? "—" : `Lv.${slot.level}`;
    button.append(name, level);
    host.place(button, {
      x: left + index * (columnWidth + columnGap), y: bounds.y + 98,
      width: columnWidth, height: 48,
    });
  });

  const selected = draft[host.selectedAbilityIndex]!;
  dependencies.abilities.forEach((ability, index) => {
    const group = Math.floor(ability.id / 100);
    const usedElsewhere = draft.some((slot, slotIndex) =>
      slotIndex !== host.selectedAbilityIndex && slot.group === group);
    const button = host.factoryChoiceButton(
      ability.label, selected.group === group, !editable || usedElsewhere,
      () => host.updateDraftSlot(host.selectedAbilityIndex, {
        group, level: selected.group === group ? selected.level : undefined,
      }),
    );
    button.classList.add("garage-factory-attribute-choice");
    host.place(button, {
      x: left + index % 3 * (columnWidth + columnGap),
      y: bounds.y + 158 + Math.floor(index / 3) * 52,
      width: columnWidth, height: 44,
    });
  });

  for (const [index, level] of [1, 2, 3].entries()) {
    const button = host.factoryChoiceButton(
      `Lv.${level}`, selected.level === level, !editable || selected.group === undefined,
      () => host.updateDraftSlot(host.selectedAbilityIndex, { group: selected.group, level }),
    );
    button.classList.add("garage-factory-level-choice");
    host.place(button, {
      x: left + index * (columnWidth + columnGap), y: bounds.y + 326,
      width: columnWidth, height: 48,
    });
  }

  const clear = host.factoryChoiceButton("清空当前栏", false,
    !editable || selected.group === undefined,
    () => host.updateDraftSlot(host.selectedAbilityIndex, {}));
  clear.classList.add("garage-factory-clear-choice");
  host.place(clear, { x: left, y: bounds.y + 382, width: 150, height: 40 });

  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.textContent = "确定";
  confirm.dataset.factoryPickerAction = "confirm";
  const complete = draft.every(slot => slot.group !== undefined && slot.level !== undefined);
  confirm.disabled = !editable || !host.draftDirty || !complete;
  confirm.setAttribute("aria-label", "确定应用当前三栏粒子改配置");
  confirm.onclick = () => {
    const abilityIds = draft.map(slot => slot.group === undefined || slot.level === undefined
      ? undefined : dependencies.abilityId(slot.group, slot.level));
    const [first, second, third] = abilityIds;
    if (first !== undefined && second !== undefined && third !== undefined)
      host.commit({ active: true, abilities: [first, second, third] });
  };
  dependencies.stylePrimary(confirm);
  host.place(confirm, {
    x: left + pickerWidth - 150, y: bounds.y + 382, width: 150, height: 40,
  });
}

/** Change one draft slot while preserving the other two selections. */
export function updateGarageFactoryDraftSlot(
  host: GarageFactoryPickerHost,
  index: number,
  selection: FactoryDraftSlot,
): void {
  if (!host.draft) return;
  host.draft = host.draft.map((slot, position) => position === index ? selection : slot);
  host.draftDirty = true;
  host.onTabChange();
}

/** Validate and publish the committed Factory configuration. */
export function commitGarageFactoryChoice(
  host: GarageFactoryPickerHost,
  configuration: GarageFactoryConfiguration,
  dependencies: GarageFactoryPickerDependencies,
): void {
  dependencies.validate(configuration);
  host.draft = dependencies.draftFrom(configuration);
  host.draftDirty = false;
  host.appliedSignature = dependencies.signature(configuration);
  host.onChange(configuration);
}

/** Create a native-textured choice button with the release's four visual states. */
export function createGarageFactoryChoiceButton(
  host: GarageFactoryPickerHost,
  text: string,
  pressed: boolean,
  disabled: boolean,
  action: () => void,
  dependencies: GarageFactoryPickerDependencies,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.className = "garage-factory-choice";
  button.disabled = disabled;
  button.setAttribute("aria-pressed", String(pressed));
  button.setAttribute("aria-label", text);
  button.title = text;
  button.onclick = action;
  if (host.assets.fontFamily)
    button.style.fontFamily = `"${host.assets.fontFamily}", sans-serif`;

  const imageBase = dependencies.nodeAttribute(host.assets.nodes.get("tab_parts"), "autoLoadImage");
  for (let state = 1; state <= 4; state++) {
    const url = host.assets.urls.get(dependencies.nativeStatePath(imageBase, state));
    if (url) button.style.setProperty(`--native-state-${state}`, `url("${url}")`);
  }
  return button;
}
