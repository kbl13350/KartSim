/** Settings for the multiplayer services that run beside the local game. */
export interface LocalMultiplayerConfig {
  /**
   * The data service: accounts, profiles, history, the game server list and
   * entry tickets. Game servers are reached at the origins that list names.
   */
  backendOrigin: string;
  frontendOrigins: string[];
  /** "auto" (WebRTC, else WebSocket), "webrtc" or "websocket". */
  transport: "auto" | "websocket" | "webrtc";
}

declare global {
  interface Window {
    __KART_MULTIPLAYER_CONFIG__?: LocalMultiplayerConfig;
  }
}

export interface LocalConfigEnvironment {
  VITE_MULTIPLAYER_BACKEND_ORIGIN?: string;
  /** LAN play: the dev server proxies the data and game services on the page's own origin. */
  VITE_MULTIPLAYER_SAME_ORIGIN?: string;
  VITE_MULTIPLAYER_TRANSPORT?: string;
}

/** Pure builder so local settings can be tested without a browser. */
export function createLocalMultiplayerConfig(pageOrigin: string,
  environment: LocalConfigEnvironment = {}): LocalMultiplayerConfig {
  const sameOrigin = environment.VITE_MULTIPLAYER_SAME_ORIGIN?.trim() === "1";
  const backendOrigin = environment.VITE_MULTIPLAYER_BACKEND_ORIGIN?.trim() ||
    (sameOrigin ? pageOrigin : "http://127.0.0.1:8787");
  const backend = new URL(backendOrigin);
  if (!["http:", "https:"].includes(backend.protocol) || backend.origin !== backendOrigin ||
      backend.username || backend.password || backend.pathname !== "/" ||
      backend.search || backend.hash) {
    throw new Error("VITE_MULTIPLAYER_BACKEND_ORIGIN must be an HTTP(S) origin");
  }
  const page = new URL(pageOrigin);
  if (!["http:", "https:"].includes(page.protocol) || page.origin !== pageOrigin) {
    throw new Error("The game page must have an HTTP(S) origin");
  }
  if (page.protocol === "https:" && backend.protocol !== "https:") {
    throw new Error("An HTTPS game page requires an HTTPS backend");
  }
  const chosen = environment.VITE_MULTIPLAYER_TRANSPORT?.trim();
  if (chosen && chosen !== "websocket" && chosen !== "webrtc" && chosen !== "auto") {
    throw new Error("VITE_MULTIPLAYER_TRANSPORT must be auto, websocket or webrtc");
  }
  // Game nodes answer WebRTC offers: the motion channel drops a late frame
  // instead of holding newer ones behind it. A node or network without it
  // falls back to the WebSocket.
  return { backendOrigin, frontendOrigins: [pageOrigin],
    transport: (chosen || "auto") as LocalMultiplayerConfig["transport"] };
}

export function installLocalMultiplayerConfig(): LocalMultiplayerConfig {
  const environment = (import.meta as ImportMeta & { env?: LocalConfigEnvironment }).env;
  const config = createLocalMultiplayerConfig(window.location.origin, environment);
  window.__KART_MULTIPLAYER_CONFIG__ = config;
  return config;
}

export function configuredTransport(): LocalMultiplayerConfig["transport"] {
  return typeof window === "undefined" ? "webrtc" :
    window.__KART_MULTIPLAYER_CONFIG__?.transport ?? "webrtc";
}
