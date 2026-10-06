/**
 * Vite's release preload helper, kept here so recovered lazy imports retain
 * their original CSS preload and error event behavior.
 */
const loadedPaths = new Set<string>();

// The downloaded Vite runtime fetched modulepreload links itself on browsers
// that do not support them. Keep that small compatibility behavior here.
if (typeof document !== "undefined" &&
    !document.createElement("link").relList?.supports?.("modulepreload")) {
  const fetchLink = (link: HTMLLinkElement & { ep?: boolean }) => {
    if (link.ep) return;
    link.ep = true;
    const options: RequestInit = {};
    if (link.integrity) options.integrity = link.integrity;
    if (link.referrerPolicy) options.referrerPolicy = link.referrerPolicy as ReferrerPolicy;
    options.credentials = link.crossOrigin === "use-credentials" ? "include" :
      link.crossOrigin === "anonymous" ? "omit" : "same-origin";
    void fetch(link.href, options);
  };
  document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]').forEach(fetchLink);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLLinkElement && node.rel === "modulepreload") fetchLink(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
}

function announcePreloadError(reason: unknown): undefined {
  const event = new Event("vite:preloadError", { cancelable: true }) as Event & {
    payload: unknown;
  };
  event.payload = reason;
  window.dispatchEvent(event);
  if (!event.defaultPrevented) throw reason;
  return undefined;
}

function preloadDependency(relativePath: string, nonce: string | null): Promise<void> | undefined {
  const path = `/${relativePath}`;
  if (loadedPaths.has(path)) return;
  loadedPaths.add(path);
  const isCss = path.endsWith(".css");
  const suffix = isCss ? '[rel="stylesheet"]' : "";
  if (document.querySelector(`link[href="${path}"]${suffix}`)) return;
  const link = document.createElement("link");
  link.rel = isCss ? "stylesheet" : "modulepreload";
  if (!isCss) link.as = "script";
  link.crossOrigin = "";
  link.href = path;
  if (nonce) link.setAttribute("nonce", nonce);
  document.head.appendChild(link);
  if (!isCss) return;
  return new Promise<void>((resolve, reject) => {
    link.addEventListener("load", () => resolve());
    link.addEventListener("error", () => reject(new Error(`Unable to preload CSS for ${path}`)));
  });
}

export async function importWithPreload<T>(
  load: () => Promise<T>,
  dependencies?: readonly string[],
  _unused?: unknown,
): Promise<T | undefined> {
  if (dependencies?.length) {
    const element = document.querySelector('meta[property=csp-nonce]') as HTMLMetaElement | null;
    const nonce = element?.nonce || element?.getAttribute("nonce") || null;
    const settled = await Promise.allSettled(
      dependencies.map((path) => preloadDependency(path, nonce)),
    );
    for (const outcome of settled) {
      if (outcome.status === "rejected") announcePreloadError(outcome.reason);
    }
  }
  try {
    return await load();
  } catch (error) {
    return announcePreloadError(error);
  }
}
