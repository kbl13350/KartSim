import { currentResourceManager, FEATURES, onResourceManager,
  type ResourceManager } from "../resources/resource-manager";
import type { BmlLibrary } from "./bml-kit";
import { isResourceWindowOpen, ResourceWindow, waitForResources } from "./resource-window";

export { formatBytes, rowStatus, statusText } from "./resource-window";

/**
 * 资源下载 entry points: the top-bar button and the corner badge that open
 * the release-style window (resource-window.ts), and the passive download
 * when a page opens (ensureFeatureResources).
 */

const STYLES = `
.ks-res-open{display:inline-flex;align-items:center;gap:5px;height:3cqh;padding:0 1cqh;margin-left:1.4cqw;
  border:.12cqh solid rgba(255,255,255,.55)!important;border-radius:.5cqh!important;font-size:1.6cqh!important;
  white-space:nowrap}
.ks-res-open[hidden]{display:none!important}
.ks-res-open:hover{background:rgba(255,255,255,.18)!important}
.ks-res-open svg{width:1.9cqh;height:1.9cqh}
`;

let stylesInstalled = false;

function installStyles(doc: Document): void {
  if (stylesInstalled) return;
  stylesInstalled = true;
  const style = doc.createElement("style");
  style.dataset.kartsim = "resource-panel";
  style.textContent = STYLES;
  doc.head.append(style);
}

const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>`;

export interface ResourcePanelOptions {
  onActivate?(): void;
  onClose?(): void;
}

/** The resource library the release windows read (the one the manager was installed with). */
function windowLibrary(manager: ResourceManager): BmlLibrary | undefined {
  const library = manager.library as Partial<BmlLibrary> | undefined;
  return typeof library?.canonicalCandidates === "function" ? library as BmlLibrary : undefined;
}

/** Opens the 资源下载 window over root (one at a time). */
export async function openResourcePanel(root: HTMLElement, manager: ResourceManager,
  options: ResourcePanelOptions = {}): Promise<void> {
  const library = windowLibrary(manager);
  if (!library) return;
  try {
    await ResourceWindow.open(manager, library, root, options);
  } catch (error) {
    console.error("资源下载窗口打开失败", error);
  }
}

/**
 * Passive download when a page opens: the page's first containers download
 * with a small progress window (the player may continue at once and let
 * them finish in the background), then the rest of its groups download in
 * the background. Resolves when the page may open.
 */
export async function ensureFeatureResources(root: HTMLElement, feature: string): Promise<void> {
  const manager = currentResourceManager();
  const need = FEATURES[feature];
  if (!manager || !need) return;
  const { required, background } = manager.featureContainers(feature);
  const startBackground = () => {
    if (manager.missing(background).length)
      manager.download(background, { label: `${need.title}资源`, priority: "low" });
  };
  if (!manager.missing(required).length) {
    startBackground();
    return;
  }
  const job = manager.download(required, { label: `${need.title}资源`, priority: "high" });
  const library = windowLibrary(manager);
  if (library) await waitForResources(library, root, manager, job, need.title);
  else await job.done.catch(() => undefined);
  startBackground();
}

/**
 * What the top-bar button shows: hidden once every container is cached
 * and nothing downloads (it comes back when one goes missing), "下载中 N%"
 * while jobs run.
 */
export function resourceButtonState(manager: Pick<ResourceManager, "activeJobs" | "totals">):
  { hidden: boolean; text: string } {
  const jobs = manager.activeJobs();
  if (jobs.length) {
    const total = jobs.reduce((sum, job) => sum + job.totalBytes, 0);
    const done = jobs.reduce((sum, job) => sum + job.doneBytes(), 0);
    return { hidden: false, text: `下载中 ${total ? Math.floor(done / total * 100) : 0}%` };
  }
  const totals = manager.totals();
  return { hidden: totals.totalBytes > 0 && totals.cachedBytes >= totals.totalBytes, text: "资源下载" };
}

/**
 * The 资源下载 button of the lobby top bar: opens the window and shows the
 * download progress while jobs run; gone when everything is downloaded.
 */
export function createResourceButton(root: HTMLElement, options: ResourcePanelOptions = {}): HTMLButtonElement {
  const doc = root.ownerDocument;
  installStyles(doc);
  const node = doc.createElement("button");
  node.className = "ks-res-open";
  node.type = "button";
  node.innerHTML = DOWNLOAD_ICON;
  const label = doc.createElement("span");
  label.textContent = "资源下载";
  node.append(label);
  node.setAttribute("aria-label", "资源下载");
  let release: (() => void) | undefined;
  const watch = (manager: ResourceManager | undefined) => {
    release?.();
    release = undefined;
    if (!manager) return;
    const update = () => {
      const state = resourceButtonState(manager);
      node.hidden = state.hidden;
      label.textContent = state.text;
    };
    release = manager.subscribe(update);
    update();
  };
  watch(currentResourceManager());
  const releaseInstall = onResourceManager(watch);
  node.addEventListener("click", () => {
    const manager = currentResourceManager();
    if (!manager) return;
    options.onActivate?.();
    void openResourcePanel(root, manager, options);
  });
  const observer = new MutationObserver(() => {
    if (!node.isConnected) {
      release?.();
      releaseInstall();
      observer.disconnect();
    }
  });
  queueMicrotask(() => { if (node.isConnected) observer.observe(doc.body, { childList: true, subtree: true }); });
  return node;
}

/** The corner "正在加载资源" badge opens the window too. */
export function bindLoadingBadge(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const badge = doc.querySelector<HTMLElement>(".loading-fab");
  if (!badge || badge.dataset.resourcePanel) return;
  badge.dataset.resourcePanel = "1";
  badge.style.cursor = "pointer";
  badge.style.pointerEvents = "auto";
  badge.title = "查看资源下载";
  badge.addEventListener("click", () => {
    const manager = currentResourceManager();
    if (manager && !isResourceWindowOpen()) void openResourcePanel(root, manager);
  });
}
