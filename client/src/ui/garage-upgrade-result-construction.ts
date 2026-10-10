import type { GaragePreviewRect } from "./garage-transform-preview";
import type { GarageUpgradeAnimationPanel, GarageUpgradeClassicAssets,
  GarageUpgradeSummary } from "./garage-upgrade-result-render";

export interface GarageUpgradeClassicLoad extends GarageUpgradeClassicAssets {
  rect: GaragePreviewRect;
  preview: GaragePreviewRect;
  accept: GaragePreviewRect;
  panel: GarageUpgradeAnimationPanel;
}

export interface GarageUpgradeConstructionSummary extends GarageUpgradeSummary {
  beforePoints: number;
  afterPoints: number;
}

export interface GarageUpgradeConstructionHost {
  title: string;
  onClose(confirmed: boolean): void;
  summary: GarageUpgradeConstructionSummary;
  resultOnly: boolean;
  element: HTMLElement;
  context: CanvasRenderingContext2D;
  kartContext: CanvasRenderingContext2D;
  result: HTMLElement;
  label: HTMLElement;
  accept: HTMLButtonElement;
  cancel: HTMLButtonElement;
  previousFocus?: HTMLElement;
  disposed: boolean;
  complete: boolean;
  classic?: GarageUpgradeClassicLoad;
  panels?: GarageUpgradeAnimationPanel[];
  canvasLogicalWidth: number;
  canvasLogicalHeight: number;
  kartLogicalWidth: number;
  kartLogicalHeight: number;
  close(confirmed: boolean): void;
}

export interface GarageUpgradeConstructionDependencies {
  stylePrimary(button: HTMLButtonElement): void;
  loadXun(library: unknown, environment: unknown, stage: unknown,
    resultOnly: boolean): Promise<GarageUpgradeAnimationPanel[]>;
  loadClassic(library: unknown, environment: unknown,
    stage: unknown): Promise<GarageUpgradeClassicLoad>;
}

/** Assemble the upgrade dialog, then load its animation panels without blocking display. */
export function initializeGarageUpgradeResult(
  host: GarageUpgradeConstructionHost,
  surface: HTMLElement,
  library: unknown,
  environment: unknown,
  stage: unknown,
  title: string,
  onClose: (confirmed: boolean) => void,
  kind: "xun" | "classic",
  summary: GarageUpgradeConstructionSummary,
  resultOnly: boolean,
  badgeUrl: string | undefined,
  dependencies: GarageUpgradeConstructionDependencies,
): void {
  host.title = title;
  host.onClose = onClose;
  host.summary = summary;
  host.resultOnly = resultOnly;
  host.element.className = `garage-upgrade${kind === "classic" ? " garage-upgrade-classic" : ""}`;
  if (resultOnly) host.element.classList.add("garage-upgrade-result-only");
  host.element.setAttribute("role", "dialog");
  host.element.setAttribute("aria-modal", "true");
  host.element.setAttribute("aria-label", kind === "xun"
    ? "迅车辆强化动画" : "经典车辆升级动画");

  const animationCanvas = document.createElement("canvas");
  animationCanvas.width = 1600;
  animationCanvas.height = 900;
  const animationContext = animationCanvas.getContext("2d");
  if (!animationContext) throw new Error("升级动画画布不可用。");
  host.context = animationContext;
  const kartCanvas = document.createElement("canvas");
  kartCanvas.width = 250;
  kartCanvas.height = 250;
  kartCanvas.className = "garage-upgrade-kart";
  const kartContext = kartCanvas.getContext("2d");
  if (!kartContext) throw new Error("升级车辆画布不可用。");
  host.kartContext = kartContext;
  host.result.className = "garage-upgrade-result";
  host.result.hidden = true;

  const heading = document.createElement("strong");
  heading.className = "garage-upgrade-result-heading";
  const headingText = document.createElement("span");
  headingText.textContent = title;
  heading.append(headingText);
  if (kind === "xun" && badgeUrl) {
    const badge = document.createElement("img");
    badge.src = badgeUrl;
    badge.alt = `+${summary.afterLevel}`;
    badge.className = "garage-upgrade-result-level";
    heading.append(badge);
  }
  const stats = document.createElement("div");
  stats.className = "garage-upgrade-stats";
  const rows = kind === "xun" ? [
    { label: "性能槽数量", before: String(Math.min(summary.beforeLevel, 3)),
      after: String(Math.min(summary.afterLevel, 3)) },
    { label: "强化点数", before: String(summary.beforePoints),
      after: String(summary.afterPoints) },
  ] : [
    { label: "等级", before: `Lv.${summary.beforeLevel}`,
      after: `Lv.${summary.afterLevel}` },
    { label: "强化点", before: String(summary.beforePoints),
      after: String(summary.afterPoints) },
  ];
  for (const row of rows) {
    const line = document.createElement("span");
    line.className = "garage-upgrade-stat-row";
    line.setAttribute("aria-label", `${row.label}：${row.before} 升至 ${row.after}`);
    for (const [name, value] of [
      ["label", row.label], ["before", row.before], ["after", row.after],
    ] as Array<[string, string]>) {
      const text = document.createElement("span");
      text.className = `garage-upgrade-stat-${name}`;
      text.textContent = value;
      line.append(text);
    }
    stats.append(line);
  }
  host.result.append(kartCanvas);
  if (kind === "xun") host.result.append(heading, stats);
  host.label.className = "garage-upgrade-label";
  host.label.setAttribute("role", "status");
  host.label.textContent = `${title} · 正在加载原版强化动画…`;
  host.accept.type = host.cancel.type = "button";
  dependencies.stylePrimary(host.accept);
  host.accept.textContent = resultOnly ? "确认" : `确认本地 Lv.${summary.afterLevel} 升级`;
  host.accept.disabled = true;
  host.cancel.textContent = resultOnly ? "关闭" : "取消升级";
  host.accept.onclick = () => { if (host.complete) host.close(true); };
  host.cancel.onclick = () => host.close(resultOnly);
  if (resultOnly) { host.accept.hidden = true; host.cancel.hidden = true; }
  const contents = [animationCanvas, host.result];
  if (!resultOnly) contents.push(host.label);
  contents.push(host.accept, host.cancel);
  host.element.append(...contents);
  surface.append(host.element);
  host.previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : undefined;
  host.cancel.focus();
  host.element.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      host.close(false);
    }
    if (event.key === "Tab") {
      event.preventDefault();
      (host.complete && document.activeElement === host.cancel
        ? host.accept : host.cancel).focus();
    }
  });

  const loadPanels = async (): Promise<GarageUpgradeAnimationPanel[]> => {
    if (kind === "xun") return dependencies.loadXun(library, environment, stage, resultOnly);
    const classic = await dependencies.loadClassic(library, environment, stage);
    if (host.disposed) { classic.dispose(); return []; }
    host.classic = classic;
    const animationRect = classic.rect;
    const previewRect = classic.preview;
    animationCanvas.width = animationRect.width;
    animationCanvas.height = animationRect.height;
    host.canvasLogicalWidth = animationRect.width;
    host.canvasLogicalHeight = animationRect.height;
    Object.assign(animationCanvas.style, {
      left: `${animationRect.x}px`, top: `${animationRect.y}px`,
      width: `${animationRect.width}px`, height: `${animationRect.height}px`,
    });
    kartCanvas.width = previewRect.width;
    kartCanvas.height = previewRect.height;
    host.kartLogicalWidth = previewRect.width;
    host.kartLogicalHeight = previewRect.height;
    Object.assign(kartCanvas.style, {
      left: `${previewRect.x}px`, top: `${previewRect.y}px`,
      width: `${previewRect.width}px`, height: `${previewRect.height}px`,
    });
    host.accept.textContent = resultOnly ? "确认" : "确认本地升级";
    host.accept.hidden = true;
    Object.assign(host.accept.style, {
      left: `${classic.accept.x}px`, top: `${classic.accept.y}px`,
      width: `${classic.accept.width}px`, height: `${classic.accept.height}px`,
    });
    return [classic.panel];
  };
  void loadPanels()
    .then(panels => {
      if (host.disposed) { panels.forEach(panel => panel.dispose()); return; }
      host.panels = panels;
      if (host.resultOnly) {
        host.complete = true;
        host.result.hidden = false;
        host.accept.disabled = false;
        host.accept.hidden = false;
        host.cancel.hidden = true;
      }
    })
    .catch(error => {
      if (!host.disposed && !host.resultOnly)
        host.label.textContent = `动画加载失败，未修改升级草稿：${error instanceof Error ? error.message : error}`;
    });
}
