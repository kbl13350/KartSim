/**
 * Web startup loading screen: the release race loading illustration
 * (DataPack4 zeta_/cn/loading/백기사_신_로딩페이지_1600.png, copied to
 * mirror/ui/loading) with the overall progress bar and a current download
 * progress bar beneath it showing the downloading asset name and progress.
 */
const STYLE = `
.startup-loading{background:#000 url("/ui/loading/race-loading-1600.png") center/cover no-repeat}
.startup-loading::after{content:"";position:absolute;inset:auto 0 0;height:42%;background:linear-gradient(to top,rgba(6,16,34,.92),rgba(6,16,34,0));pointer-events:none}
.startup-loading .startup-loading-copy{z-index:1;left:50%;right:auto;bottom:max(7vh,28px);transform:translateX(-50%);width:min(720px,calc(100vw - 48px));max-width:none;align-items:stretch;gap:10px}
.startup-loading .startup-loading-label,.startup-loading .startup-frontend-version{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);animation:none}
.ks-loading-head{display:flex;justify-content:space-between;align-items:baseline;color:#fff;font:600 clamp(14px,1.6vw,18px)/1.2 "Microsoft YaHei","PingFang SC",sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.ks-loading-percent{font:700 clamp(16px,2vw,22px)/1 "Arial",sans-serif;font-variant-numeric:tabular-nums;color:#ffd84a}
.ks-loading-track{position:relative;height:10px;border-radius:999px;background:rgba(255,255,255,.18);box-shadow:inset 0 1px 2px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.12);overflow:hidden}
.ks-loading-fill{position:absolute;inset:0 auto 0 0;width:0;border-radius:inherit;background:linear-gradient(90deg,#2f9bff,#5fd0ff 55%,#ffd84a);transition:width .35s ease}
.ks-loading-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-100%);animation:ks-loading-shine 1.6s ease-in-out infinite}
.ks-download-head{display:flex;justify-content:space-between;align-items:baseline;color:rgba(255,255,255,.9);font:500 clamp(12px,1.4vw,14px)/1.2 "Microsoft YaHei","PingFang SC",sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.6);margin-top:4px}
.ks-download-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%}
.ks-download-percent{font:700 clamp(12px,1.5vw,15px)/1 "Arial",sans-serif;font-variant-numeric:tabular-nums;color:#5fd0ff}
.ks-download-track{position:relative;height:6px;border-radius:999px;background:rgba(255,255,255,.14);box-shadow:inset 0 1px 2px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.08);overflow:hidden}
.ks-download-fill{position:absolute;inset:0 auto 0 0;width:0;border-radius:inherit;background:linear-gradient(90deg,#00c6ff,#0072ff);transition:width .2s ease}
.ks-download-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-100%);animation:ks-loading-shine 1.6s ease-in-out infinite}
@keyframes ks-loading-shine{to{transform:translateX(100%)}}
.ks-loading-tip{margin:0;color:rgba(255,255,255,.72);font:13px/1.4 "Microsoft YaHei","PingFang SC",sans-serif;text-align:center}
.startup-loading .startup-loading-copy>p[data-hud="startup-loading-error"]{text-align:center}
.startup-loading.has-error .ks-loading-fill,.startup-loading.has-error .ks-download-fill{background:#ff6b63}
.startup-loading.has-error .ks-loading-fill::after,.startup-loading.has-error .ks-download-fill::after{animation:none}
@media (prefers-reduced-motion:reduce){.ks-loading-fill,.ks-loading-fill::after,.ks-download-fill,.ks-download-fill::after{transition:none;animation:none}}
`;

export function startupLoadingPercent(value: string | null): number {
  const percent = value === null ? 0 : Number(value);
  return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
}

export function formatDownloadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDownloadTitle(rawItem?: string, loaded?: number, total?: number): string {
  if (!rawItem) return "当前下载：暂无";
  const name = rawItem.replace(/^正在加载\s*/, "");
  let sizeText = "";
  if (typeof loaded === "number" && typeof total === "number" &&
      Number.isFinite(loaded) && Number.isFinite(total) && total > 0) {
    sizeText = ` (${formatDownloadBytes(loaded)} / ${formatDownloadBytes(total)})`;
  }
  return `当前下载：${name}${sizeText}`;
}

function element(doc: Document, tag: string, className: string, text = ""): HTMLElement {
  const node = doc.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** Overall progress and current download progress bars for startup. */
export function installStartupLoadingSkin(doc: Document = document): void {
  const style = doc.createElement("style");
  style.textContent = STYLE;
  doc.head.append(style);
  const attach = (): boolean => {
    const view = doc.querySelector(".startup-loading") as HTMLElement | null;
    const label = view?.querySelector(".startup-loading-label");
    const copy = view?.querySelector(".startup-loading-copy");
    if (!view || !label || !copy) return false;
    if (view.querySelector(".ks-loading-track")) return true;
    const head = element(doc, "div", "ks-loading-head");
    const title = element(doc, "span", "ks-loading-title", "正在加载游戏资源");
    head.append(title);
    const percent = element(doc, "span", "ks-loading-percent", "0%");
    head.append(percent);
    const track = element(doc, "div", "ks-loading-track");
    const fill = element(doc, "div", "ks-loading-fill");
    track.append(fill);

    const downloadHead = element(doc, "div", "ks-download-head");
    const downloadTitle = element(doc, "span", "ks-download-title", "当前下载：暂无");
    downloadHead.append(downloadTitle);
    const downloadPercent = element(doc, "span", "ks-download-percent", "0%");
    downloadHead.append(downloadPercent);
    const downloadTrack = element(doc, "div", "ks-download-track");
    const downloadFill = element(doc, "div", "ks-download-fill");
    downloadTrack.append(downloadFill);

    const tip = element(doc, "div", "ks-loading-tip", "首次进入需要下载游戏资源，请耐心等待");
    for (const node of [head, track, downloadHead, downloadTrack, tip]) node.setAttribute("aria-hidden", "true");
    copy.prepend(head, track, downloadHead, downloadTrack, tip);

    const update = (): void => {
      const value = startupLoadingPercent(label.getAttribute("aria-valuenow"));
      percent.textContent = `${Math.floor(value)}%`;
      fill.style.width = `${value}%`;
      title.textContent = label.getAttribute("aria-valuetext") ?? "正在加载游戏资源";
    };
    update();
    new MutationObserver(update).observe(label,
      { attributes: true, attributeFilter: ["aria-valuenow", "aria-valuetext"] });

    const updateDownload = (): void => {
      const item = view.getAttribute("data-download-item");
      const pct = startupLoadingPercent(view.getAttribute("data-download-percent"));
      const loaded = Number(view.getAttribute("data-download-loaded"));
      const total = Number(view.getAttribute("data-download-total"));
      downloadTitle.textContent = formatDownloadTitle(item ?? undefined, loaded, total);
      downloadPercent.textContent = `${Math.floor(pct)}%`;
      downloadFill.style.width = `${pct}%`;
    };
    updateDownload();
    new MutationObserver(updateDownload).observe(view, {
      attributes: true,
      attributeFilter: [
        "data-download-item",
        "data-download-percent",
        "data-download-loaded",
        "data-download-total",
      ],
    });

    // The badge shown after startup names the file being fetched; show the total instead.
    const ring = doc.querySelector(".loading-fab-ring");
    const badge = doc.querySelector(".loading-fab-copy");
    if (ring && badge) new MutationObserver(() => {
      const total = Math.floor(startupLoadingPercent(ring.getAttribute("aria-valuenow")));
      const text = `正在加载资源 ${total}%`;
      if (badge.textContent !== text) badge.textContent = text;
    }).observe(ring, { attributes: true, attributeFilter: ["aria-valuenow"] });
    return true;
  };
  if (attach()) return;
  const observer = new MutationObserver(() => { if (attach()) observer.disconnect(); });
  observer.observe(doc.body, { childList: true, subtree: true });
}
