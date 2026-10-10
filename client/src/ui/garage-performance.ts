export interface GaragePerformanceVehicle {
  itemId: number;
  path: string;
  engineGrade?: number;
}

export interface GaragePerformancePart {
  slot: string;
}

export interface GaragePerformanceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GarageScoreRow {
  label: string;
  node: string;
  before: number;
  after: number;
  baseline?: number;
}

interface GarageScoreSource {
  grid?: unknown;
}

interface PhysicalParameters {
  transAccelFactor: number;
  steerConstraint: number;
  driftEscapeForce: number;
  normalBoosterTime: number;
  driftMaxGauge: number;
}

export interface GaragePerformanceHost {
  selected: GaragePerformanceVehicle;
  configuration: unknown;
  options: { speed: number; library: unknown };
  speedVersion: unknown;
  previewPart?: GaragePerformancePart;
  cosmeticPreview?: unknown;
  coatingPreview?: unknown;
  assets: {
    parts: unknown;
    nodes: Map<string, unknown>;
    imageUrls: Map<string, string>;
  };
  scoreSources: Map<string, Promise<GarageScoreSource>>;
  scoreRevision: number;
  pageMode: string;
  disposed: boolean;
  defaultPartGrades?: Record<string, number>;
  info: HTMLElement;
  comparisons: Array<{ token: unknown; rect: GaragePerformanceRect }>;
  cancelPreview: { hidden: boolean };
  base(): unknown;
  serial(): number;
  rect(path: string): GaragePerformanceRect;
  place(element: HTMLElement, rect: GaragePerformanceRect): void;
  renderScoreRows(rows: GarageScoreRow[] | undefined, title: string): void;
  updateVehicleInformation(vehicle: unknown, configuration: unknown,
    layout: unknown, preview: boolean): void;
}

export interface GaragePerformanceDependencies {
  currentConfiguration(configuration: unknown, itemId: number, serial: number): Record<string, unknown>;
  applyConfiguration(vehicle: unknown, engineGrade: number, configuration: unknown, speed: number): PhysicalParameters;
  applySpeedVersion(parameters: PhysicalParameters, speedVersion: unknown, speed: number): PhysicalParameters;
  previewPartConfiguration(vehicle: unknown, engineGrade: number, configuration: unknown,
    part: GaragePerformancePart | undefined, speed: number): PhysicalParameters;
  vehicleFamily(vehicle: unknown, engineGrade: number): string | undefined;
  scoreFamily(vehicle: unknown, engineGrade: number): string | undefined;
  loadScoreSource(library: unknown, path: string, kind: "xun-body" | "x-v1"): Promise<GarageScoreSource>;
  calculateScores(source: GarageScoreSource, vehicle: unknown, engineGrade: number | undefined,
    configuration: unknown, parts: unknown, ignoredSlot?: string): Record<string, number>;
  fallbackScoreGrade(engineGrade: number | undefined): number;
  scoreGradeForValue(grid: unknown, grade: number, field: string, value: number): number | undefined;
  performanceLayout(engineGrade: number | undefined): { performanceRoot?: string } | undefined;
  textureToken(node: unknown, property: "texture"): unknown;
}

const SCORE_METRICS = [
  { label: "加速度", field: "TransAccelFactor", node: "transAccelFactor" },
  { label: "弯道", field: "SteerConstraint", node: "cornerDrawFactor" },
  { label: "漂移", field: "DriftEscapeForce", node: "driftEscapeForce" },
  { label: "加速时间", field: "NormalBoosterTime", node: "normalBoosterTime" },
  { label: "集气速度", field: "DriftMaxGauge", node: "boosterGauge" },
] as const;

const PHYSICAL_METRICS = [
  { label: "加速系数", field: "transAccelFactor", node: "transAccelFactor", precision: 5 },
  { label: "转向约束", field: "steerConstraint", node: "cornerDrawFactor", precision: 3 },
  { label: "漂移逃脱力", field: "driftEscapeForce", node: "driftEscapeForce", precision: 0 },
  { label: "个人氮气 / ms", field: "normalBoosterTime", node: "normalBoosterTime", precision: 0 },
  { label: "集气阈值", field: "driftMaxGauge", node: "boosterGauge", precision: 0 },
] as const;

const DEFAULT_PART_METRICS = [
  { slot: "engine", field: "TransAccelFactor" },
  { slot: "handle", field: "SteerConstraint" },
  { slot: "wheel", field: "DriftEscapeForce" },
  { slot: "booster", field: "NormalBoosterTime" },
] as const;

function scoreSourceFor(
  host: GaragePerformanceHost,
  dependencies: GaragePerformanceDependencies,
  selected: GaragePerformanceVehicle,
  kind: "xun-body" | "x-v1",
): Promise<GarageScoreSource> {
  const cacheKey = `${kind}:${selected.path}`;
  let source = host.scoreSources.get(cacheKey);
  if (!source) {
    source = dependencies.loadScoreSource(host.options.library, selected.path, kind);
    host.scoreSources.set(cacheKey, source);
    source.catch(() => host.scoreSources.delete(cacheKey));
  }
  return source;
}

/** Refresh either native P3543 scores or the physical parameters of older karts. */
export function updateGaragePerformance(
  host: GaragePerformanceHost,
  dependencies: GaragePerformanceDependencies,
): void {
  const revision = ++host.scoreRevision;
  const pageMode = host.pageMode;
  const vehicle = host.base();
  const selected = host.selected;
  const engineGrade = selected.engineGrade ?? 0;
  const configuration = dependencies.currentConfiguration(
    host.configuration, selected.itemId, host.serial());
  const currentPhysical = dependencies.applySpeedVersion(
    dependencies.applyConfiguration(vehicle, engineGrade, configuration, host.options.speed),
    host.speedVersion, host.options.speed);
  const previewPhysical = dependencies.applySpeedVersion(
    dependencies.previewPartConfiguration(vehicle, engineGrade, configuration,
      host.previewPart, host.options.speed),
    host.speedVersion, host.options.speed);
  const family = dependencies.vehicleFamily(vehicle, engineGrade);
  const scoreFamily = dependencies.scoreFamily(vehicle, engineGrade);
  host.defaultPartGrades = undefined;

  if (scoreFamily) {
    const previewConfiguration = host.previewPart
      ? { ...configuration, [host.previewPart.slot]: host.previewPart }
      : configuration;
    host.renderScoreRows(undefined, "正在读取原版评分数据。");
    const sourceKind = scoreFamily === "xun" ? "xun-body" : "x-v1";
    const source = scoreSourceFor(host, dependencies, selected, sourceKind);
    const stillCurrent = () => !host.disposed && host.scoreRevision === revision &&
      host.selected === selected && host.pageMode === pageMode;

    source.then(scores => {
      if (!stillCurrent()) return;
      const currentScores = dependencies.calculateScores(
        scores, vehicle, selected.engineGrade, configuration, host.assets.parts);
      const previewScores = dependencies.calculateScores(
        scores, vehicle, selected.engineGrade, previewConfiguration, host.assets.parts);

      if (family === "x" || family === "v1") {
        const defaultGrades: Record<string, number> = {};
        const baseScores = dependencies.calculateScores(
          scores, vehicle, selected.engineGrade, {}, host.assets.parts);
        if (scores.grid) {
          const gridGrade = dependencies.fallbackScoreGrade(selected.engineGrade);
          for (const metric of DEFAULT_PART_METRICS) {
            const grade = dependencies.scoreGradeForValue(
              scores.grid, gridGrade, metric.field, baseScores[metric.field]!);
            if (grade !== undefined) defaultGrades[metric.slot] = grade;
          }
        }
        host.defaultPartGrades = Object.keys(defaultGrades).length ? defaultGrades : undefined;
      }

      const baseline = family === "xun" && host.previewPart
        ? dependencies.calculateScores(scores, vehicle, selected.engineGrade,
          configuration, host.assets.parts, host.previewPart.slot)
        : undefined;
      host.renderScoreRows(SCORE_METRICS.map(metric => ({
        label: metric.label,
        node: metric.node,
        before: currentScores[metric.field]!,
        after: previewScores[metric.field]!,
        baseline: baseline?.[metric.field],
      })), "P3543 原版评分规则 · 当前车辆状态");

      const latestConfiguration = dependencies.currentConfiguration(
        host.configuration, selected.itemId, host.serial());
      const layout = dependencies.performanceLayout(selected.engineGrade);
      if (layout && host.pageMode !== "factory") {
        host.updateVehicleInformation(vehicle, latestConfiguration, layout, false);
      }
    }).catch(error => {
      if (stillCurrent()) {
        const message = error instanceof Error ? error.message : String(error);
        host.renderScoreRows(undefined, `评分暂不可用：${message}`);
      }
    });
    return;
  }

  host.info.replaceChildren();
  host.comparisons.length = 0;
  host.info.title = "当前车代显示物理参数，不是官服面板评分。";
  host.info.dataset.performanceMode = "physical";
  host.cancelPreview.hidden = !host.previewPart && !host.cosmeticPreview && !host.coatingPreview;
  const root = dependencies.performanceLayout(selected.engineGrade)?.performanceRoot ?? "textPerformList";
  for (const metric of PHYSICAL_METRICS) {
    const row = document.createElement("div");
    const value = document.createElement("span");
    value.textContent = currentPhysical[metric.field].toFixed(metric.precision);
    row.append(value);
    if (currentPhysical[metric.field] !== previewPhysical[metric.field]) {
      const changedValue = document.createElement("strong");
      changedValue.textContent = `→ ${previewPhysical[metric.field].toFixed(metric.precision)}`;
      row.append(changedValue);
      row.className = "changed";
      const previewPath = `/${root}/kartParam/${metric.node}_PrewiewBg`;
      const node = host.assets.nodes.get(previewPath);
      if (node) host.comparisons.push({
        token: dependencies.textureToken(node, "texture"), rect: host.rect(previewPath),
      });
    }
    row.title = `${metric.label}（物理参数，非官服面板分值）`;
    row.setAttribute("aria-label", `${metric.label} ${row.textContent}`);
    host.info.append(row);
  }
}

function xunComparison(before: number, after: number, baseline: number) {
  const delta = (value: number) => `(${value - baseline >= 0 ? "+" : ""}${value - baseline})`;
  return {
    beforeValue: String(before), beforeDelta: delta(before),
    afterValue: String(after), afterDelta: delta(after),
    trend: after > before ? "increase" : "decrease",
  };
}

/** Render five aligned native score values, including preview comparisons. */
export function renderGarageScoreRows(
  host: GaragePerformanceHost,
  rows: GarageScoreRow[] | undefined,
  title: string,
  dependencies: Pick<GaragePerformanceDependencies, "performanceLayout" | "textureToken">,
): void {
  host.info.replaceChildren();
  host.comparisons.length = 0;
  host.info.title = title;
  host.info.setAttribute("aria-label", title);
  host.info.dataset.performanceMode = rows ? "scores" : "unavailable";
  host.cancelPreview.hidden = !host.previewPart && !host.cosmeticPreview && !host.coatingPreview;
  const root = dependencies.performanceLayout(host.selected.engineGrade)?.performanceRoot ?? "textPerformList";
  const xunLayout = root === "textPerformList_12";
  host.info.classList.toggle("garage-xun-score-layout", xunLayout);
  const frame = host.rect(`/${root}/kartParam/transAccelFactor_PrewiewBg`);
  host.place(host.info, { x: frame.x, y: frame.y, width: frame.width, height: 160 });

  for (const [index, metric] of SCORE_METRICS.entries()) {
    const score = rows?.[index];
    const row = document.createElement("div");
    const value = document.createElement("span");
    value.textContent = score ? String(score.before) : "—";
    row.append(value);
    const rect = host.rect(`/${root}/kartParam/${metric.node}`);

    if (xunLayout) {
      value.className = "garage-xun-score-value";
      value.style.setProperty("--xun-value-x", `${rect.x - frame.x}px`);
      value.style.setProperty("--xun-value-y", `${rect.y - frame.y}px`);
      value.style.setProperty("--xun-value-width", `${rect.width}px`);
      value.style.setProperty("--xun-value-height", `${rect.height}px`);
    } else {
      row.className = "garage-score-row";
      row.style.setProperty("--garage-score-row-y", `${rect.y - frame.y}px`);
      row.style.setProperty("--garage-score-row-height", `${rect.height}px`);
      value.className = "garage-score-value";
      value.style.setProperty("--garage-score-value-x", `${rect.x - frame.x}px`);
      value.style.setProperty("--garage-score-value-width", `${rect.width}px`);
      value.style.setProperty("--garage-score-value-height", `${rect.height}px`);
    }

    if (score && score.before !== score.after) {
      const changedValue = document.createElement("strong");
      if (xunLayout && score.baseline !== undefined) {
        const comparison = xunComparison(score.before, score.after, score.baseline);
        const arrowRect = host.rect(`/${root}/kartParam/compareArrowBg`);
        const before = document.createElement("span");
        row.replaceChildren(before);
        row.style.setProperty("--xun-comparison-row-x", `${rect.x - frame.x}px`);
        row.style.setProperty("--xun-comparison-row-y", `${rect.y - frame.y}px`);
        row.style.setProperty("--xun-arrow-width", `${arrowRect.width}px`);
        row.style.setProperty("--xun-arrow-height", `${arrowRect.height}px`);
        before.textContent = `${comparison.beforeValue} ${comparison.beforeDelta}`;
        before.className = "garage-xun-comparison-before";
        const arrow = document.createElement("i");
        arrow.className = "garage-xun-comparison-arrow";
        const arrowImage = host.assets.imageUrls.get("garage_img_compareBG2_arrow");
        if (arrowImage) arrow.style.backgroundImage = `url(${JSON.stringify(arrowImage)})`;
        changedValue.textContent = `${comparison.afterValue} ${comparison.afterDelta}`;
        changedValue.className = `garage-xun-comparison-after ${comparison.trend}`;
        row.append(arrow, changedValue);
        row.className = "changed garage-xun-comparison";
      } else if (!xunLayout) {
        const previewRect = host.rect(`/${root}/kartParam/${metric.node}Preview`);
        row.style.setProperty("--garage-score-comparison-x", `${rect.x - frame.x}px`);
        row.style.setProperty("--garage-score-comparison-y", `${rect.y - frame.y}px`);
        row.style.setProperty("--garage-score-comparison-width", `${previewRect.x + previewRect.width - rect.x}px`);
        row.style.setProperty("--garage-score-comparison-height", `${rect.height}px`);
        row.style.setProperty("--garage-score-comparison-value-width", `${rect.width}px`);
        row.style.setProperty("--garage-score-comparison-after-width", `${previewRect.width}px`);
        value.className = "garage-score-comparison-before";
        changedValue.textContent = String(score.after);
        changedValue.className = "garage-score-comparison-after";
        row.append(changedValue);
        row.className = "changed garage-score-comparison";
      } else {
        changedValue.textContent = `→ ${score.after}`;
        row.append(changedValue);
        row.className = "changed";
      }
      const previewPath = `/${root}/kartParam/${metric.node}_PrewiewBg`;
      const node = host.assets.nodes.get(previewPath);
      if (node) host.comparisons.push({
        token: dependencies.textureToken(node, "texture"), rect: host.rect(previewPath),
      });
    }
    row.title = `${metric.label} · ${title}`;
    row.setAttribute("aria-label", `${metric.label} ${row.textContent ?? ""} · ${title}`);
    host.info.append(row);
  }
}
