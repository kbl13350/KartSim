export interface GarageProgressionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClassicGarageProgression {
  kind: "classic";
  level: number;
  points: number[];
}

export interface XunGarageProgression {
  kind: "xun";
  level: number;
  skills: Array<{ id: number; points: number }>;
}

export type GarageProgressionState = ClassicGarageProgression | XunGarageProgression;

export interface GarageProgressionPanelHost {
  assets: {
    strings: Map<string, string>;
    enchantDescriptions?: Map<number, { title: string; description: string }>;
    urls: Map<string, string>;
    exceedTypes?: Map<number, {
      id: number; textureType: number; accelLevel: number; timeLevel: number;
    }>;
    exceedTypeChange?: { unableTargets: Set<number> };
    stage: { width: number };
  };
  element: HTMLElement;
  classicContainer: HTMLElement;
  engine12Container: HTMLElement;
  activeContainer: HTMLElement;
  framedControls: Map<string, HTMLElement>;
  onChange(progression: GarageProgressionState): void;
  onSelectSkill(index: number): void;
  onExceedTypeChange(): void;
  reset(layout: "classic" | "xun"): void;
  rect(name: string): GarageProgressionRect;
  label(text: string | undefined, rect: GarageProgressionRect, node?: string): void;
  button(node: string, title: string, action: () => void,
    disabled?: boolean, xOffset?: number): HTMLButtonElement;
  nativeLabel(node: string, fallback: string): HTMLElement;
  texture(name: string, rect: GarageProgressionRect): void;
  place(element: HTMLElement, rect: GarageProgressionRect): void;
  styleFromNode(element: HTMLElement, node: string): void;
}

export interface GarageProgressionPanelDependencies {
  nextLevel(progression: GarageProgressionState, engineGrade: number): GarageProgressionState;
  remainingPoints(progression: GarageProgressionState): number;
  changePoint(progression: GarageProgressionState, index: number, delta: number): GarageProgressionState;
  initialProgression(xun: boolean): ClassicGarageProgression;
  skills: readonly { id: number; label: string }[];
}

export type ExceedChangeState = "hidden" | "item-kart" | "unable" | "enabled" | "level";

/** The Factory's local Exceed Type control is available only to eligible max-level XUN karts. */
export function garageExceedChangeAvailability(
  vehicle: { engineGrade: number; itemId: number; kartType?: number; level: number },
  restrictions?: { unableTargets: Set<number> },
): ExceedChangeState {
  if (vehicle.engineGrade !== 9 || !restrictions) return "hidden";
  if (vehicle.kartType === 1) return "item-kart";
  if (restrictions.unableTargets.has(vehicle.itemId)) return "unable";
  return vehicle.level === 5 ? "enabled" : "level";
}

/** Render authored color tags inside the XUN Exceed Type description. */
export function appendGarageNativeColorText(container: HTMLElement, text: string): void {
  const tag = /\[color:(\d+) (\d+) (\d+) (\d+)\]([\s\S]*?)\[\/color\]/g;
  let consumed = 0;
  for (const match of text.matchAll(tag)) {
    const start = match.index ?? 0;
    container.append(document.createTextNode(text.slice(consumed, start)));
    const span = document.createElement("span");
    span.textContent = match[5]!;
    const [alpha, red, green, blue] = match.slice(1, 5).map(Number);
    span.style.color = `rgba(${red}, ${green}, ${blue}, ${alpha! / 255})`;
    container.append(span);
    consumed = start + match[0].length;
  }
  container.append(document.createTextNode(text.slice(consumed)));
}

const skillButtonInset = 15;
const plusButtonInset = skillButtonInset - 2;
const skillPanelPath = "/backGround/engine12Data/tuningPanel/skillTuning";
const exceedPanelPath = "/backGround/engine12Data/tuningPanel/exceedType";

function moveRight(rect: GarageProgressionRect, offset: number): GarageProgressionRect {
  return { ...rect, x: rect.x + offset };
}

function skillNameRect(name: GarageProgressionRect, gauge: GarageProgressionRect): GarageProgressionRect {
  const start = name.x + 8;
  const gaugeStart = gauge.x + skillButtonInset;
  return {
    x: start, y: name.y,
    width: Math.max(0, Math.min(name.width - 8, gaugeStart - 8 - start)),
    height: name.height,
  };
}

function exceedDescriptionRect(rect: GarageProgressionRect, stageWidth: number): GarageProgressionRect {
  return { ...rect, width: Math.max(rect.width, stageWidth - rect.x - 20) };
}

function renderClassicProgression(
  host: GarageProgressionPanelHost,
  progression: ClassicGarageProgression,
  factory: { active: boolean; abilities: number[] } | undefined,
  dependencies: GarageProgressionPanelDependencies,
): void {
  const select = document.createElement("select");
  select.setAttribute("aria-label", host.assets.strings.get("specialSlotSelect") ?? "特殊属性");
  select.className = "garage-native-combo";
  const empty = document.createElement("option");
  empty.textContent = host.assets.strings.get("specialSlotSelect") ??
    host.assets.strings.get("emptySlot") ?? "属性为空";
  empty.value = "";
  select.append(empty);
  const available = factory?.active
    ? factory.abilities.filter(ability => host.assets.enchantDescriptions?.has(ability))
    : [];
  for (const ability of available) {
    const description = host.assets.enchantDescriptions!.get(ability)!;
    const option = document.createElement("option");
    option.value = String(ability);
    option.textContent = description.title;
    select.append(option);
  }
  select.disabled = available.length === 0;
  if (available.length) select.value = String(available[0]);
  host.place(select, host.rect("specialSlotSelect"));
  host.framedControls.set("specialSlotSelect", select);

  const title = document.createElement("div");
  const description = document.createElement("div");
  title.className = description.className = "garage-native-label";
  host.styleFromNode(title, "enchantTitle");
  host.styleFromNode(description, "enchantDesc");
  host.place(title, host.rect("enchantTitle"));
  host.place(description, host.rect("enchantDesc"));
  const refreshDescription = () => {
    const selected = host.assets.enchantDescriptions?.get(Number(select.value));
    title.textContent = selected?.title ?? "";
    description.textContent = selected?.description ?? "";
  };
  select.onchange = refreshDescription;
  refreshDescription();

  host.nativeLabel("/backGround/back_img/@text:#sb(pointLeft)", "可使用强化点");
  host.label(String(dependencies.remainingPoints(progression)), host.rect("pointLeft"), "pointLeft");
  const attributes = [
    ["Speed", "速度"], ["Cornering", "弯道"], ["Drift", "漂移"], ["Booster", "加速器"],
  ] as const;
  attributes.forEach(([node, label], index) => {
    host.label(label, host.rect(`point${node}Cat`), `point${node}Cat`);
    host.label(String(progression.points[index]), host.rect(`point${node}`), `point${node}`);
    host.button(`point${node}Plus`, `增加${label}强化点`,
      () => host.onChange(dependencies.changePoint(progression, index, 1)),
      progression.points[index] === 10 || dependencies.remainingPoints(progression) === 0);
    host.button(`point${node}Minus`, `减少${label}强化点`,
      () => host.onChange(dependencies.changePoint(progression, index, -1)),
      progression.points[index] === 0);
  });
  host.button("pointClear", "重置强化点",
    () => host.onChange({ ...dependencies.initialProgression(false), level: progression.level }),
    progression.points.every(point => point === 0));
  host.button("pointApply", host.assets.strings.get("apply") ?? "适用", () => {}, true);
}

function renderXunSkills(
  host: GarageProgressionPanelHost,
  progression: XunGarageProgression,
  dependencies: GarageProgressionPanelDependencies,
): void {
  host.nativeLabel(`${skillPanelPath}/@text:#sb(tuningSkill)`, "性能强化");
  host.nativeLabel(`${skillPanelPath}/@text:#sb(helpTuningSkillStr)`, "");
  const remaining = dependencies.remainingPoints(progression);
  host.nativeLabel(`${skillPanelPath}/@text:#sb(haveTuningPoint)`, "持有强化点数");
  host.texture(remaining ? "tuning_pointTextBg" : "tuning_pointTextBg_none",
    host.rect(`${skillPanelPath}/haveTuningPoint`));
  const pointCount = document.createElement("div");
  pointCount.textContent = String(remaining);
  pointCount.className = "garage-tuning-number";
  pointCount.setAttribute("aria-label", `可用强化点：${remaining}`);
  host.place(pointCount, host.rect(`${skillPanelPath}/curTuningPoint`));

  progression.skills.forEach((skill, index) => {
    const path = `${skillPanelPath}/tuningSkill${index + 1}`;
    host.texture("tuning_performslot_speed", host.rect(`${path}/skillSlot${index + 1}`));
    host.texture(`tuningBoard_icon_${skill.id}`, host.rect(`${path}/curSkill`));
    const name = document.createElement("div");
    name.textContent = dependencies.skills.find(candidate => candidate.id === skill.id)?.label ?? "";
    name.title = name.textContent;
    name.className = "garage-tuning-skill-name";
    host.styleFromNode(name, `${path}/skillName`);
    host.place(name, skillNameRect(host.rect(`${path}/skillName`), host.rect(`${path}/skillGauge`)));

    const gauge = document.createElement("div");
    gauge.className = "garage-tuning-gauge";
    gauge.setAttribute("role", "meter");
    gauge.setAttribute("aria-label", `第${index + 1}栏强化进度`);
    gauge.setAttribute("aria-valuemin", "0");
    gauge.setAttribute("aria-valuemax", "5");
    gauge.setAttribute("aria-valuenow", String(skill.points));
    const gaugeUrl = host.assets.urls.get(`tuning_progressbar_0${skill.points}`);
    if (gaugeUrl) gauge.style.backgroundImage = `url("${gaugeUrl}")`;
    host.place(gauge, moveRight(host.rect(`${path}/skillGauge`), skillButtonInset));
    host.button(`${path}/skillChange`, `更换第${index + 1}栏技能`, () => host.onSelectSkill(index));
    host.label(`${skill.points} / 5`,
      moveRight(host.rect(`${path}/skillTuningPoint`), skillButtonInset + 3),
      `${path}/skillTuningPoint`);
    host.button(`${path}/plusTuningPoint`, `增加第${index + 1}栏强化点`,
      () => host.onChange(dependencies.changePoint(progression, index, 1)),
      skill.points === 5 || dependencies.remainingPoints(progression) === 0,
      plusButtonInset);
    host.button(`${path}/minusTuningPoint`, `减少第${index + 1}栏强化点`,
      () => host.onChange(dependencies.changePoint(progression, index, -1)),
      skill.points === 0, skillButtonInset);
  });
}

function renderXunExceedType(
  host: GarageProgressionPanelHost,
  progression: XunGarageProgression,
  engineGrade: number,
  exceedType: number | undefined,
  vehicle: { itemId: number; kartType?: number } | undefined,
): void {
  for (const [node, fallback] of [
    ["exceedType", "超负荷类型"], ["curExceedType", "现在类型"],
    ["exceedAccel", "超负荷加速度"], ["exceedTime", "超负荷时间"],
  ]) host.nativeLabel(`${exceedPanelPath}/@text:#sb(${node})`, fallback);
  host.texture("tuning_Exceedslot", host.rect(`${exceedPanelPath}/exceedSlot`));

  const selected = exceedType === undefined ? undefined : host.assets.exceedTypes?.get(exceedType);
  if (selected) {
    host.texture(`icon_exceedM_${selected.textureType}`, host.rect(`${exceedPanelPath}/exceedIcon`));
    host.texture(`tuning_exceedProgressbar_0${selected.accelLevel}`,
      host.rect(`${exceedPanelPath}/exceedAccelGauge`));
    host.texture(`tuning_exceedProgressbar_0${selected.timeLevel}`,
      host.rect(`${exceedPanelPath}/exceedTimeGauge`));
    const description = host.assets.strings.get(`exceedDesc${selected.id}`);
    if (description) {
      const element = document.createElement("div");
      element.className = "garage-native-label garage-exceed-description";
      appendGarageNativeColorText(element, description);
      host.styleFromNode(element, `${exceedPanelPath}/exceedDesc`);
      host.place(element, exceedDescriptionRect(host.rect(`${exceedPanelPath}/exceedDesc`),
        host.assets.stage.width));
    }
  }

  const availability = garageExceedChangeAvailability({
    engineGrade, itemId: vehicle?.itemId ?? 0, kartType: vehicle?.kartType,
    level: progression.level,
  }, host.assets.exceedTypeChange);
  if (availability !== "hidden") {
    const change = host.button(`${exceedPanelPath}/exceedTypeChangeBtn`,
      "变更超负荷类型", host.onExceedTypeChange,
      availability !== "enabled");
    change.className += " garage-exceed-type-change-button";
  }
  if (availability !== "enabled" && availability !== "hidden") {
    const lockNode = availability === "item-kart" ? "immutableItemKart" :
      availability === "unable" ? "unableExceedTypeChangeKart" : "higherTuningLevel5";
    host.texture("tuning_icon_lock", host.rect(`${exceedPanelPath}/${lockNode}`));
    host.nativeLabel(`${exceedPanelPath}/${lockNode}/@text:#sb(${lockNode})`, lockNode)
      .className += " garage-exceed-lock-label";
  }
}

/** Rebuild the classic or XUN strengthening panel from the current draft. */
export function updateGarageProgressionPanel(
  host: GarageProgressionPanelHost,
  progression: GarageProgressionState,
  hasVehicle: boolean,
  engineGrade: number,
  factory: { active: boolean; abilities: number[] } | undefined,
  exceedType: number | undefined,
  vehicle: { itemId: number; kartType?: number } | undefined,
  noAvailableVehicles: boolean,
  dependencies: GarageProgressionPanelDependencies,
): void {
  const xun = engineGrade === 9;
  host.reset(xun ? "xun" : "classic");
  if (xun !== (progression.kind === "xun"))
    throw new Error("升级数据类型与 engineGrade 布局不一致。");

  host.element.dataset.engineGradeLayout = xun ? "xun" : engineGrade === 8 ? "v1" : "classic";
  host.classicContainer.hidden = xun;
  host.engine12Container.hidden = !xun;
  host.activeContainer = xun ? host.engine12Container : host.classicContainer;
  if (!hasVehicle) {
    host.label(noAvailableVehicles ? "暂无可升级车辆" :
      "请从下方列表选择可升级车辆（9 代及以下或 XUN）。",
    { x: 22, y: 210, width: 700, height: 40 });
    return;
  }

  const next = progression.level === 5 ? progression : dependencies.nextLevel(progression, engineGrade);
  host.button(xun ? "tuningLevelUp" : "카트레벨업",
    progression.level === 5 ? "车辆已满级" : `车辆升至 Lv.${next.level}（本地测试）`,
    () => host.onChange(next), progression.level === 5);
  if (progression.kind === "classic")
    renderClassicProgression(host, progression, factory, dependencies);
  else {
    renderXunSkills(host, progression, dependencies);
    renderXunExceedType(host, progression, engineGrade, exceedType, vehicle);
  }
}
