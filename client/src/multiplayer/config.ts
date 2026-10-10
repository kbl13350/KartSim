/** Configuration supplied by the hosting page, corresponding to multiplayer-config.js. */
export interface MultiplayerConfig {
  backendOrigin: string;
  frontendOrigins?: readonly string[];
  /** Legacy singular setting accepted by the downloaded client. */
  frontendOrigin?: string;
}

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const ENDPOINT_PATH = /^[a-z][a-z0-9/-]*$/i;

/**
 * Resolve and validate the multiplayer backend independently of window globals.
 * A local development page needs its own explicitly allowed origin.
 */
export function resolveBackendOrigin(config: MultiplayerConfig, pageUrl: string): string {
  const page = new URL(pageUrl);
  if (!HTTP_PROTOCOLS.has(page.protocol)) throw new Error("Multiplayer requires an HTTP(S) page");

  const allowed = config.frontendOrigins ??
    (config.frontendOrigin === undefined ? undefined : [config.frontendOrigin]);
  if (allowed !== undefined) {
    if (!Array.isArray(allowed) || allowed.length === 0 || allowed.some((value) => {
      if (typeof value !== "string" || value.includes("*")) return true;
      try {
        const url = new URL(value);
        return !HTTP_PROTOCOLS.has(url.protocol) || url.origin !== value;
      } catch {
        return true;
      }
    })) throw new Error("frontendOrigins must contain full HTTP(S) origins without paths or trailing slashes");
    if (!allowed.includes(page.origin)) throw new Error("The current page origin is not allowed for multiplayer");
  }

  const value = config.backendOrigin?.trim();
  if (!value) throw new Error("Multiplayer backend origin is not configured");
  const backend = new URL(value);
  if (!HTTP_PROTOCOLS.has(backend.protocol) || backend.username || backend.password ||
      backend.pathname !== "/" || backend.search || backend.hash) {
    throw new Error("Backend must be an HTTP(S) origin without a path, query or fragment");
  }
  if (page.protocol === "https:" && backend.protocol !== "https:") {
    throw new Error("An HTTPS page requires an HTTPS multiplayer backend");
  }
  return backend.origin;
}

/** Construct only known-safe paths below /multiplayer/. */
export function multiplayerEndpoint(backendOrigin: string, path: string): string {
  if (!ENDPOINT_PATH.test(path) || path.includes("..") || path.startsWith("/")) {
    throw new Error("Invalid multiplayer endpoint path");
  }
  return `${backendOrigin}/multiplayer/${path}`;
}
