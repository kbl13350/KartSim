/**
 * Web startup loading screen: the release race loading illustration
 * (DataPack4 zeta_/cn/loading/백기사_신_로딩페이지_1600.png, copied to
 * mirror/ui/loading) behind one overall progress bar. Per-file progress is
 * never shown; the background loading badge also reports only the total.
 * The HUD markup stays as released; this restyles it and mirrors its value.
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
@keyframes ks-loading-shine{to{transform:translateX(100%)}}
.ks-loading-tip{margin:0;color:rgba(255,255,255,.72);font:13px/1.4 "Microsoft YaHei","PingFang SC",sans-serif;text-align:center}
.startup-loading .startup-loading-copy>p[data-hud="startup-loading-error"]{text-align:center}
.startup-loading.has-error .ks-loading-fill{background:#ff6b63}
.startup-loading.has-error .ks-loading-fill::after{animation:none}
@media (prefers-reduced-motion:reduce){.ks-loading-fill,.ks-loading-fill::after{transition:none;animation:none}}
`;

export function startupLoadingPercent(value: string | null): number {
  const percent = value === null ? 0 : Number(value);
  return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
}

function element(doc: Document, tag: string, className: string, text = ""): HTMLElement {
  const node = doc.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** Overall progress only: one bar for startup, a total for the background badge. */
export function installStartupLoadingSkin(doc: Document = document): void {
  const style = doc.createElement("style");
  style.textContent = STYLE;
  doc.head.append(style);
  const attach = (): boolean => {
    const view = doc.querySelector(".startup-loading");
    const label = view?.querySelector(".startup-loading-label");
    const copy = view?.querySelector(".startup-loading-copy");
    if (!view || !label || !copy) return false;
    if (view.querySelector(".ks-loading-track")) return true;
    const head = element(doc, "div", "ks-loading-head");
    head.append(element(doc, "span", "ks-loading-title", "正在加载游戏资源"));
    const percent = element(doc, "span", "ks-loading-percent", "0%");
    head.append(percent);
    const track = element(doc, "div", "ks-loading-track");
    const fill = element(doc, "div", "ks-loading-fill");
    track.append(fill);
    const tip = element(doc, "div", "ks-loading-tip", "首次进入需要下载游戏资源，请耐心等待");
    for (const node of [head, track, tip]) node.setAttribute("aria-hidden", "true");
    copy.prepend(head, track, tip);
    const update = (): void => {
      const value = startupLoadingPercent(label.getAttribute("aria-valuenow"));
      percent.textContent = `${Math.floor(value)}%`;
      fill.style.width = `${value}%`;
    };
    update();
    new MutationObserver(update).observe(label,
      { attributes: true, attributeFilter: ["aria-valuenow"] });

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
