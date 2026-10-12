import { SWITCH_BUILD } from "./platform";

/**
 * The page the multiplayer code checks its services against. A web build is
 * served by (or next to) the data service, so that is the browser's page. The
 * Switch package is a local page (brewser://apps/<id>/index.html) with the
 * data service address in its configuration, so the network code treats that
 * service as the page: same origin, no frontend allowlist, https only when the
 * service is https.
 */
export function networkPageUrl(): string {
  return SWITCH_BUILD && configuredServer ? `${configuredServer}/` : window.location.href;
}

export function networkPageOrigin(): string {
  return SWITCH_BUILD && configuredServer ? configuredServer : window.location.origin;
}

/** The Switch package's settings file next to index.html (tools/switch/package-brewser.mjs). */
export const SWITCH_CONFIG_FILE = "kartsim-switch.json";
/** A data service address entered on the console replaces the packaged one. */
export const SWITCH_SERVER_KEY = "kartsim.switch.server";

let configuredServer: string | undefined;

/** The data service origin the Switch package connects to, once loaded. */
export function switchServerOrigin(): string | undefined {
  return configuredServer;
}

/** An http(s) origin without path, or undefined (a trailing slash is dropped). */
export function normalizeServerOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function savedServer(): string | undefined {
  try { return normalizeServerOrigin(localStorage.getItem(SWITCH_SERVER_KEY)); }
  catch { return undefined; }
}

function installConfig(origin: string): void {
  configuredServer = origin;
  window.__KART_MULTIPLAYER_CONFIG__ = { backendOrigin: origin, frontendOrigins: [origin], transport: "websocket" };
}

/** Use and remember an address entered on the console (it replaces the packaged one). */
export function saveSwitchServer(origin: string): void {
  try { localStorage.setItem(SWITCH_SERVER_KEY, origin); }
  catch { /* Without storage the address lasts until the game closes. */ }
  installConfig(origin);
}

/**
 * Reads the server address (saved one first, then kartsim-switch.json) and
 * installs the multiplayer configuration the network code reads. Brewser has
 * no WebRTC, so the game nodes are reached over WebSocket.
 */
export async function loadSwitchNetworkConfig(fetcher: typeof fetch = (url, init) => fetch(url, init)): Promise<string | undefined> {
  let packaged: string | undefined;
  try {
    const response = await fetcher(`./${SWITCH_CONFIG_FILE}`, { cache: "no-store" });
    if (response.ok) packaged = normalizeServerOrigin((await response.json() as { server?: unknown }).server);
  } catch { /* No settings file: the console must enter an address. */ }
  const origin = savedServer() ?? packaged;
  if (origin) installConfig(origin);
  return origin;
}
