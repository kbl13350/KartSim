/** One axis of the garage's before/after vehicle performance radar. */
export interface GarageRadarValue {
  label: string;
  base: number;
  enhanced: number;
}

export interface GarageProgressionRadarHost {
  radarRevision: number;
  radar?: GarageRadarValue[];
  element: HTMLElement;
  classicContainer: HTMLElement;
  engine12Container: HTMLElement;
  activeContainer: HTMLElement;
  framedControls: Map<string, HTMLElement>;
  rect(name: string): { x: number; y: number; width: number; height: number };
  place(element: HTMLElement, rect: { x: number; y: number; width: number; height: number }): void;
}

export interface GarageProgressionRadarDependencies {
  createStatus(): HTMLElement;
  loadParameters(library: unknown, kart: unknown): Promise<{ input: unknown; weights: unknown }>;
  applyChanges(input: unknown, engineGrade: unknown, progression: unknown, configuration: unknown): unknown;
  makeRadar(input: unknown, enhanced: unknown, weights: unknown): GarageRadarValue[];
}

/** Clear the active upgrade page and invalidate any in-flight performance calculation. */
export function resetGarageProgressionPanel(
  host: GarageProgressionRadarHost,
  layout?: "classic" | "xun",
): void {
  host.radarRevision++;
  host.radar = undefined;
  if (layout === "classic") host.classicContainer.replaceChildren();
  else if (layout === "xun") host.engine12Container.replaceChildren();
  else {
    host.classicContainer.replaceChildren();
    host.engine12Container.replaceChildren();
  }
  host.framedControls.clear();
  if (!layout || layout === "classic") {
    host.classicContainer.hidden = false;
    host.engine12Container.hidden = true;
    host.activeContainer = host.classicContainer;
    if (!layout) delete host.element.dataset.engineGradeLayout;
  } else {
    host.classicContainer.hidden = true;
    host.engine12Container.hidden = false;
    host.activeContainer = host.engine12Container;
  }
}

/** Load base vehicle stats, apply the local draft, and publish a fresh radar only if it is current. */
export async function updateGarageProgressionRadar(
  host: GarageProgressionRadarHost,
  library: unknown,
  kart: unknown,
  engineGrade: unknown,
  progression: { kind: string },
  configuration: unknown,
  dependencies: GarageProgressionRadarDependencies,
): Promise<void> {
  const revision = ++host.radarRevision;
  host.radar = undefined;
  if (progression.kind !== "classic") return;

  const status = dependencies.createStatus();
  status.setAttribute("role", "img");
  status.setAttribute("aria-label", "车辆性能雷达加载中");
  const previousContainer = host.activeContainer;
  host.activeContainer = host.classicContainer;
  host.place(status, host.rect("resultGraph"));
  host.activeContainer = previousContainer;

  try {
    const data = await dependencies.loadParameters(library, kart);
    if (revision !== host.radarRevision) return;
    const enhanced = dependencies.applyChanges(data.input, engineGrade, progression, configuration);
    host.radar = dependencies.makeRadar(data.input, enhanced, data.weights);
    const summary = host.radar.map(value =>
      `${value.label}：${value.base.toFixed(1)} → ${value.enhanced.toFixed(1)}`).join("；");
    status.setAttribute("aria-label", `车辆性能雷达，基础值与本地强化/改装值。${summary}`);
    status.title = `原始车辆参数 / 本地强化及改装草稿（非比赛速度档位）\n${summary}`;
  } catch (error) {
    if (revision !== host.radarRevision) return;
    status.setAttribute("role", "status");
    status.removeAttribute("aria-label");
    status.textContent = `性能雷达暂不可用：${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Make already-started radar loads harmless after the panel closes. */
export function disposeGarageProgressionPanel(host: GarageProgressionRadarHost): void {
  host.radarRevision++;
  host.radar = undefined;
}
