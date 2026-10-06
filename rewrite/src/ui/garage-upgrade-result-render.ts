import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageUpgradeAnimationPanel {
  durationMs: number;
  seek(time: number): void;
  dispose(): void;
}

export interface GarageUpgradeClassicAssets {
  drawResult(context: CanvasRenderingContext2D,
    title: string, summary: GarageUpgradeSummary): void;
  dispose(): void;
}

export interface GarageUpgradeSummary {
  beforeLevel: number;
  afterLevel: number;
}

export interface GarageUpgradeRenderHost {
  disposed: boolean;
  context: CanvasRenderingContext2D;
  kartContext: CanvasRenderingContext2D;
  canvasLogicalWidth: number;
  canvasLogicalHeight: number;
  kartLogicalWidth: number;
  kartLogicalHeight: number;
  title: string;
  summary: GarageUpgradeSummary;
  resultOnly: boolean;
  result: HTMLElement;
  label: HTMLElement;
  accept: HTMLButtonElement;
  classic?: GarageUpgradeClassicAssets;
  panels?: GarageUpgradeAnimationPanel[];
  epoch?: number;
  complete: boolean;
  previousFocus?: HTMLElement;
  element: HTMLElement;
  onClose(confirmed: boolean): void;
  dispose(): void;
}

export interface GarageUpgradeRenderDependencies {
  sizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    displayedWidth: number, displayedHeight: number, pixelRatio: number,
    logicalWidth: number, logicalHeight: number): void;
  pixelRatio(): number;
  phase(durations: number[], elapsed: number): {
    index: number; time: number; complete: boolean;
  };
  phaseLabels: string[];
}

/** Copy the live Garage kart preview into the upgrade result's own canvas. */
export function captureGarageUpgradePreview(host: GarageUpgradeRenderHost,
  panels: { drawPreview(context: CanvasRenderingContext2D,
    rect: GaragePreviewRect): void }, rect: GaragePreviewRect,
  dependencies: GarageUpgradeRenderDependencies): void {
  if (host.disposed) return;
  const context = host.kartContext;
  const bounds = context.canvas.getBoundingClientRect();
  dependencies.sizeCanvas(context.canvas, context, bounds.width, bounds.height,
    dependencies.pixelRatio(), host.kartLogicalWidth, host.kartLogicalHeight);
  const width = host.kartLogicalWidth;
  const height = host.kartLogicalHeight;
  context.clearRect(0, 0, width, height);
  context.save();
  const scale = Math.min(width / rect.width, height / rect.height);
  context.translate((width - rect.width * scale) / 2,
    (height - rect.height * scale) / 2);
  context.scale(scale, scale);
  context.translate(-rect.x, -rect.y);
  panels.drawPreview(context, rect);
  context.restore();
}

/** Advance original animation panels, then expose the result and confirmation. */
export function renderGarageUpgradeResult(host: GarageUpgradeRenderHost, time: number,
  panels: { drawAuxiliaryPanel(panel: GarageUpgradeAnimationPanel,
    contexts: CanvasRenderingContext2D[]): void },
  dependencies: GarageUpgradeRenderDependencies): void {
  if (host.disposed || !host.panels) return;
  const bounds = host.context.canvas.getBoundingClientRect();
  dependencies.sizeCanvas(host.context.canvas, host.context, bounds.width, bounds.height,
    dependencies.pixelRatio(), host.canvasLogicalWidth, host.canvasLogicalHeight);
  if (host.resultOnly) {
    if (host.classic) host.classic.drawResult(host.context, host.title, host.summary);
    else {
      const panel = host.panels[0]!;
      panel.seek(panel.durationMs);
      panels.drawAuxiliaryPanel(panel, [host.context]);
    }
    host.result.hidden = false;
    host.complete = true;
    host.accept.disabled = false;
    return;
  }
  host.epoch ??= time;
  const phase = dependencies.phase(host.panels.map(panel => panel.durationMs),
    time - host.epoch);
  if (host.complete && phase.complete) return;
  const panel = host.panels[phase.index]!;
  panel.seek(phase.time);
  panels.drawAuxiliaryPanel(panel, [host.context]);
  if (host.classic && phase.complete)
    host.classic.drawResult(host.context, host.title, host.summary);
  host.result.hidden = host.classic ? !phase.complete : phase.index !== 2;
  host.complete = phase.complete;
  host.accept.disabled = !phase.complete;
  if (host.classic) host.accept.hidden = !phase.complete;
  const phaseName = host.classic
    ? phase.complete ? "升级结果" : "升级成功动画"
    : dependencies.phaseLabels[phase.index];
  const label = `${host.title} · ${phaseName}\n本地确定性 Lv.${host.summary.beforeLevel} → Lv.${host.summary.afterLevel} 测试，不消耗材料；确认后仅写入车库草稿。`;
  if (host.label.textContent !== label) host.label.textContent = label;
}

export function closeGarageUpgradeResult(host: GarageUpgradeRenderHost,
  confirmed: boolean): void {
  if (host.disposed) return;
  const previousFocus = host.previousFocus;
  host.dispose();
  host.onClose(confirmed);
  if (previousFocus?.isConnected) previousFocus.focus();
}

export function disposeGarageUpgradeResult(host: GarageUpgradeRenderHost): void {
  if (host.disposed) return;
  host.disposed = true;
  if (host.classic) host.classic.dispose();
  else host.panels?.forEach(panel => panel.dispose());
  host.classic = undefined;
  host.panels = undefined;
  host.element.remove();
  host.previousFocus = undefined;
}
