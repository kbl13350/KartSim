import { measureGameServerLatency } from "../multiplayer/server-latency";
import { formatDiagnosticsLines } from "./engine-diagnostics";
import { PerformanceCounter } from "./performance-counter";

const PANEL_REFRESH_MS = 250;
const LATENCY_PROBE_MS = 2_000;

interface HudCallbacks {
  returnToReady(): void;
  collectEngineDiagnostics?(): Parameters<typeof formatDiagnosticsLines>[0];
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`HUD element not found: ${selector}`);
  return element as T;
}

function setProgress(element: HTMLElement, percent: number): void {
  element.classList.add("is-determinate");
  element.style.setProperty("--loading-progress", `${percent}%`);
  element.setAttribute("aria-valuemin", "0");
  element.setAttribute("aria-valuemax", "100");
  element.setAttribute("aria-valuenow", String(percent));
}

function clearProgress(element: HTMLElement): void {
  element.classList.remove("is-determinate");
  element.style.removeProperty("--loading-progress");
  element.removeAttribute("aria-valuemin");
  element.removeAttribute("aria-valuemax");
  element.removeAttribute("aria-valuenow");
}

function sumProgress(entries: Iterable<{ loaded: number; total: number }>) {
  let loaded = 0;
  let total = 0;
  for (const entry of entries) {
    loaded += entry.loaded;
    total += entry.total;
  }
  return { loaded, total };
}

/**
 * F10 overlay text: the game-server round trip, then the frame rate. Only the
 * frame rate without a game server; `null` (no clock reply) shows `--`.
 */
export function formatNetStats(latencyMs: number | null | undefined, fps: number): string {
  const frames = `FPS ${Math.round(fps)}`;
  if (latencyMs === undefined) return frames;
  return `延迟 ${latencyMs === null ? "--" : `${Math.round(latencyMs)} ms`}  ${frames}`;
}

/** Writes text to the clipboard, with a fallback for older browsers. */
export async function copyHudText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {}
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("浏览器拒绝了剪贴板写入");
}

/**
 * Overlays the current UI layers with a temporary screenshot during a page
 * transition. The returned function removes the overlay.
 */
export function captureUiTransition(root: HTMLElement): () => void {
  const rootRect = root.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rootRect.width * pixelRatio));
  canvas.height = Math.max(1, Math.round(rootRect.height * pixelRatio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法保存页面切换画面。");
  context.scale(pixelRatio, pixelRatio);
  const layers = [...root.querySelectorAll<HTMLCanvasElement>("canvas[data-ui-layer]")]
    .map(source => ({
      source, style: getComputedStyle(source), rect: source.getBoundingClientRect(),
    }))
    .filter(({ source, style, rect }) =>
      !source.hidden && style.display !== "none" &&
      style.visibility !== "hidden" && rect.width > 0 && rect.height > 0)
    .sort((left, right) =>
      (Number.parseInt(left.style.zIndex) || 0) -
      (Number.parseInt(right.style.zIndex) || 0));
  for (const { source, style, rect } of layers) {
    context.globalAlpha = Number(style.opacity);
    context.drawImage(source, rect.left - rootRect.left,
      rect.top - rootRect.top, rect.width, rect.height);
  }
  Object.assign(canvas.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
    zIndex: "8", pointerEvents: "auto",
  });
  canvas.setAttribute("aria-hidden", "true");
  root.append(canvas);
  return () => canvas.remove();
}

/**
 * Owns startup progress, pause controls, the F2/F3 performance panels and
 * the F10 game-server latency/FPS readout.
 */
export class HudOverlay {
  element: HTMLElement;
  systemElement = document.createElement("section");
  debugTextList: HTMLElement;
  debugPanel: HTMLElement;
  debugOutput: HTMLElement;
  copyPerformanceButton?: HTMLButtonElement;
  debugEnginePanel: HTMLElement;
  debugEngineOutput: HTMLElement;
  copyEngineButton: HTMLButtonElement;
  netStats: HTMLElement;
  callbacks: HudCallbacks;
  pauseOverlay: HTMLElement;
  loadingView: HTMLElement;
  loadingLabel: HTMLElement;
  loadingError: HTMLElement;
  loadingFab: HTMLElement;
  loadingFabCopy: HTMLElement;
  loadingFabRing: HTMLElement;
  loadingProgress = new Map<unknown, { loaded: number; total: number }>();
  startupLoading = false;
  performanceCounter: PerformanceCounter;
  debugVisible = false;
  nextDebugRefreshMs = 0;
  engineVisible = false;
  nextEngineRefreshMs = 0;
  netStatsVisible = false;
  nextNetStatsRefreshMs = 0;
  /** Bumped on every F10 toggle so a probe from an earlier showing is dropped. */
  netStatsShowing = 0;
  latencyTimer = 0;
  latencyProbing = false;
  /** Undefined without a game server; null when its clock reply failed. */
  latencyMs?: number | null;
  copyLabelTimer = 0;
  latestState: unknown;
  latestFps = 0;
  latestWorkSegments: unknown;

  constructor(root: HTMLElement, callbacks: HudCallbacks, frontendVersion: string) {
    this.element = document.createElement("section");
    this.element.className = "hud";
    this.element.dataset.uiLayer = "diagnostics";
    this.element.innerHTML = `
      <div class="debug-text-list" data-hud="debug-text-list" role="log" aria-live="polite"></div>
      <aside class="debug-panel" data-hud="debug">
        <div class="debug-panel-actions">
          <strong>F2 FPS</strong>
        </div>
        <pre data-hud="debug-output"></pre>
      </aside>
    `;
    this.element.insertAdjacentHTML("beforeend", `
      <aside class="debug-panel" data-hud="debug-engine" style="left:25px;right:auto;">
        <div class="debug-panel-actions">
          <strong>F3 ENGINE / GRAPHICS / MEMORY · v${frontendVersion}</strong>
          <button type="button" data-action="copy-engine">复制</button>
        </div>
        <pre data-hud="debug-engine-output"></pre>
      </aside>
    `);
    this.systemElement.className = "system-overlay";
    this.systemElement.dataset.uiLayer = "system";
    this.systemElement.innerHTML = `
      <div class="pause-overlay">
        <strong>运行已停止</strong>
        <div class="pause-actions">
          <button type="button" data-action="return-ready">返回 READY</button>
        </div>
      </div>
      <div class="startup-loading" data-hud="startup-loading" role="status" aria-live="polite">
        <div class="startup-loading-copy">
          <strong class="startup-loading-label" role="progressbar" aria-label="加载进度">LOADING</strong>
          <small class="startup-frontend-version">前端 v${frontendVersion}</small>
          <p data-hud="startup-loading-error" role="alert" hidden></p>
          <div class="startup-resource-choice" data-hud="resource-choice" hidden>
            <span>资源来源</span>
            <button type="button" data-action="local-rho">选择本地 Data 文件夹</button>
            <button type="button" data-action="online-rho">使用在线资源</button>
          </div>
        </div>
      </div>
      <div class="loading-fab" data-hud="loading-fab" role="status" aria-live="polite" hidden>
        <span class="loading-fab-copy" data-hud="loading-fab-copy">正在加载资源</span>
        <span class="loading-fab-ring" role="progressbar" aria-label="后台加载进度"></span>
      </div>
    `;
    root.append(this.element);
    root.ownerDocument.body.append(this.systemElement);
    this.debugTextList = requiredElement(this.element, "[data-hud='debug-text-list']");
    this.debugPanel = requiredElement(this.element, "[data-hud='debug']");
    this.debugOutput = requiredElement(this.debugPanel, "[data-hud='debug-output']");
    this.debugEnginePanel = requiredElement(this.element, "[data-hud='debug-engine']");
    this.debugEngineOutput = requiredElement(this.debugEnginePanel,
      "[data-hud='debug-engine-output']");
    this.copyEngineButton = requiredElement(this.debugEnginePanel,
      "[data-action='copy-engine']");
    this.netStats = document.createElement("div");
    this.netStats.dataset.hud = "net-stats";
    this.netStats.hidden = true;
    // One line at the very top edge, above the race lap counter.
    Object.assign(this.netStats.style, {
      position: "absolute",
      top: "max(2px, env(safe-area-inset-top))",
      right: "max(4px, env(safe-area-inset-right))",
      padding: "1px 6px",
      borderRadius: "3px",
      color: "#ffe14d",
      background: "rgba(0, 0, 0, 0.45)",
      font: "700 12px/16px Consolas, 'Courier New', monospace",
      whiteSpace: "pre",
      textShadow: "0 1px 2px #000",
      pointerEvents: "none",
    });
    this.element.append(this.netStats);
    this.performanceCounter = new PerformanceCounter();
    this.callbacks = callbacks;
    this.pauseOverlay = requiredElement(this.systemElement, ".pause-overlay");
    this.loadingView = requiredElement(this.systemElement,
      "[data-hud='startup-loading']");
    this.loadingLabel = requiredElement(this.systemElement, ".startup-loading-label");

    this.loadingError = requiredElement(this.systemElement,
      "[data-hud='startup-loading-error']");
    this.loadingFab = requiredElement(this.systemElement, "[data-hud='loading-fab']");
    this.loadingFabCopy = requiredElement(this.systemElement,
      "[data-hud='loading-fab-copy']");
    this.loadingFabRing = requiredElement(this.systemElement, ".loading-fab-ring");
    this.pauseOverlay.querySelector("[data-action='return-ready']")
      ?.addEventListener("click", callbacks.returnToReady);
    this.copyPerformanceButton?.addEventListener("click", this.onCopyPerformance);
    this.copyEngineButton?.addEventListener("click", this.onCopyEngine);
    window.addEventListener("keydown", this.onDebugKeyDown);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onDebugKeyDown);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.copyPerformanceButton?.removeEventListener("click", this.onCopyPerformance);
    this.copyEngineButton?.removeEventListener("click", this.onCopyEngine);
    window.clearTimeout(this.copyLabelTimer);
    if (this.netStatsVisible) this.setNetStatsVisible(false);
    this.performanceCounter?.dispose();
    this.element.remove();
    this.systemElement.remove();
  }

  update(state: unknown, fps: number): void {
    this.latestState = state;
    this.updateEngine(fps);
  }

  updateEngine(fps: number): void {
    this.latestFps = fps;
    const now = performance.now();
    this.refreshDebugPanel(now);
    this.refreshEnginePanel(now);
    this.refreshNetStats(now);
  }

  probeSnapshot(): void {}

  beginPerformanceRace(now = performance.now()): void {
    const counter = this.performanceCounter;
    if (counter !== undefined) {
      counter.beginRace(now);
      this.nextDebugRefreshMs = 0;
      this.refreshDebugPanel(now, true);
    }
  }

  finishPerformanceRace(now = performance.now()): void {
    const counter = this.performanceCounter;
    if (counter !== undefined) {
      counter.finishRace(now);
      this.nextDebugRefreshMs = 0;
      this.refreshDebugPanel(now, true);
    }
  }

  recordPerformanceFrame(frameMs: number, workMs: number,
    now: number, workSegments: unknown): void {
    this.latestWorkSegments = workSegments;
    const counter = this.performanceCounter;
    if (counter === undefined) return;
    if (counter.recordFrame(frameMs, workMs, now) && !counter.isRaceActive()) {
      this.refreshDebugPanel(performance.now(), true);
    }
  }

  setPaused(paused: boolean): void {
    if (paused === false && this.performanceCounter?.isRaceActive()) {
      this.performanceCounter.skipNextFrame();
    }
    this.pauseOverlay.classList.toggle("is-visible", paused);
  }

  showDebugText(message: string, kind = "info"): void {
    const line = document.createElement("p");
    line.textContent = message;
    line.dataset.kind = kind;
    this.debugTextList.append(line);
    window.setTimeout(() => line.remove(), kind === "error" ? 6_000 : 3_500);
  }

  beginLoading(): void {
    this.startupLoading = false;
    this.loadingProgress.clear();
    clearProgress(this.loadingLabel);
    this.loadingLabel.removeAttribute("aria-valuetext");
    clearProgress(this.loadingFabRing);
    this.setLoadingFabVisible(false);
    this.loadingView.classList.remove("is-complete", "has-error");
    this.loadingView.removeAttribute("aria-hidden");
    this.loadingError.textContent = "";
    this.loadingError.hidden = true;
  }

  beginStartupLoading(): void {
    this.beginLoading();
    this.startupLoading = true;
    delete this.loadingView.dataset.downloadItem;
    delete this.loadingView.dataset.downloadPercent;
    delete this.loadingView.dataset.downloadLoaded;
    delete this.loadingView.dataset.downloadTotal;
    this.setStartupProgress(0, "正在读取资源清单");
  }

  setStartupProgress(percent: number, message: string): void {
    if (!this.startupLoading) return;
    setProgress(this.loadingLabel, Math.max(0, Math.min(99, percent)));
    this.loadingLabel.setAttribute("aria-valuetext", message);
  }

  /** Resources always load from the online (mirrored) containers; no local Data prompt. */
  chooseResourceSource(_selectLocal?: () => Promise<unknown>): Promise<unknown> {
    return Promise.resolve(undefined);
  }

  finishLoading(): void {
    if (this.startupLoading) {
      setProgress(this.loadingLabel, 100);
      this.loadingLabel.setAttribute("aria-valuetext", "加载完成");
      this.startupLoading = false;
    }
    delete this.loadingView.dataset.downloadItem;
    delete this.loadingView.dataset.downloadPercent;
    delete this.loadingView.dataset.downloadLoaded;
    delete this.loadingView.dataset.downloadTotal;
    this.loadingView.classList.add("is-complete");
    this.loadingView.setAttribute("aria-hidden", "true");
    this.setLoadingFabVisible(false);
    this.loadingProgress.clear();
  }

  setLoadingProgress(key: unknown, loaded: number, total: number,
    label = "正在加载资源"): void {
    // Downloads are discovered on demand. Their byte totals describe the
    // background badge, not completion of parsing, login or scene setup.
    if (this.startupLoading) {
      const safeTotal = Math.max(0, total);
      const safeLoaded = Math.min(safeTotal, Math.max(0, loaded));
      const percent = safeTotal <= 0 ? 0 : Math.round((safeLoaded / safeTotal) * 10_000) / 100;
      this.loadingView.dataset.downloadItem = label;
      this.loadingView.dataset.downloadPercent = String(percent);
      this.loadingView.dataset.downloadLoaded = String(safeLoaded);
      this.loadingView.dataset.downloadTotal = String(safeTotal);
      return;
    }
    const safeTotal = Math.max(0, total);
    this.loadingProgress.set(key, {
      loaded: Math.min(safeTotal, Math.max(0, loaded)),
      total: safeTotal,
    });
    const sum = sumProgress(this.loadingProgress.values());
    const fraction = sum.total <= 0 ? 1 : sum.loaded / sum.total;
    const percent = Math.round(fraction * 10_000) / 100;
    setProgress(this.loadingLabel, percent);
    setProgress(this.loadingFabRing, percent);
    this.loadingFabCopy.textContent = label;
    const startupVisible = !this.loadingView.classList.contains("is-complete");
    const complete = sum.total <= 0 || sum.loaded >= sum.total;
    this.setLoadingFabVisible(!startupVisible && !complete);
    if (!startupVisible && complete) this.loadingProgress.clear();
  }

  showLoadingError(message: string): void {
    this.loadingError.textContent = message;
    this.loadingError.hidden = false;
    this.loadingView.classList.add("has-error");
    this.showDebugText(message, "error");
  }

  setLoadingFabVisible(visible: boolean): void {
    this.loadingFab.hidden = !visible;
    this.systemElement.classList.toggle("has-loading-fab", visible);
  }

  onVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      this.performanceCounter?.skipNextFrame();
    }
  };

  onDebugKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === "F2") {
      event.preventDefault();
      this.debugVisible = !this.debugVisible;
      this.debugPanel.classList.toggle("is-visible", this.debugVisible);
      this.nextDebugRefreshMs = 0;
      this.refreshDebugPanel(performance.now(), true);
    } else if (event.code === "F3") {
      event.preventDefault();
      this.engineVisible = !this.engineVisible;
      this.debugEnginePanel?.classList.toggle("is-visible", this.engineVisible);
      this.nextEngineRefreshMs = 0;
      this.refreshEnginePanel(performance.now(), true);
    } else if (event.code === "F10") {
      event.preventDefault();
      this.setNetStatsVisible(!this.netStatsVisible);
    }
  };

  setNetStatsVisible(visible: boolean): void {
    this.netStatsVisible = visible;
    this.netStats.hidden = !visible;
    this.netStatsShowing++;
    this.latencyMs = undefined;
    window.clearInterval(this.latencyTimer);
    this.latencyTimer = 0;
    if (!visible) return;
    this.refreshNetStats(performance.now(), true);
    this.probeLatency();
    this.latencyTimer = window.setInterval(this.probeLatency, LATENCY_PROBE_MS);
  }

  probeLatency = (): void => {
    if (this.latencyProbing || document.visibilityState === "hidden") return;
    this.latencyProbing = true;
    const showing = this.netStatsShowing;
    measureGameServerLatency().catch(() => null).then(latencyMs => {
      this.latencyProbing = false;
      if (showing !== this.netStatsShowing) return;
      this.latencyMs = latencyMs;
      this.refreshNetStats(performance.now(), true);
    });
  };

  refreshNetStats(now: number, force = false): void {
    if (!this.netStatsVisible || (!force && now < this.nextNetStatsRefreshMs)) return;
    this.nextNetStatsRefreshMs = now + PANEL_REFRESH_MS;
    this.netStats.textContent = formatNetStats(this.latencyMs, this.latestFps);
  }

  onCopyPerformance = (): void => {};

  onCopyEngine = (): void => {
    const button = this.copyEngineButton;
    if (button === undefined || this.debugEngineOutput === undefined) return;
    const value = this.debugEngineOutput.textContent ?? "";
    copyHudText(value).then(() => {
      window.clearTimeout(this.copyLabelTimer);
      button.textContent = "已复制";
      this.copyLabelTimer = window.setTimeout(() => {
        button.textContent = "复制";
      }, 1_500);
    }).catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      this.showDebugText(`复制 F3 数据失败：${message}`, "error");
    });
  };

  refreshEnginePanel(now: number, force = false): void {
    if (!this.engineVisible || this.performanceCounter === undefined ||
      this.debugEngineOutput === undefined ||
      (!force && now < this.nextEngineRefreshMs)) return;
    this.nextEngineRefreshMs = now + PANEL_REFRESH_MS;
    const engine = this.callbacks.collectEngineDiagnostics?.() ?? null;
    const lines = formatDiagnosticsLines(engine,
      this.performanceCounter.summary(), this.latestFps);
    this.debugEngineOutput.textContent = lines.join("\n");
  }

  refreshDebugPanel(now: number, force = false): void {
    if (this.debugVisible && !(!force && now < this.nextDebugRefreshMs)) {
      this.nextDebugRefreshMs = now + PANEL_REFRESH_MS;
      this.debugOutput.textContent = `FPS  ${this.latestFps.toFixed(1)}`;
    }
  }
}
