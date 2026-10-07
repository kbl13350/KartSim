/** Validated origin and endpoint construction for the multiplayer service. */

export interface MultiplayerOriginConfig {
  frontendOrigins?: unknown;
  frontendOrigin?: string;
  backendOrigin?: string;
}

export function multiplayerBackendOrigin(pageUrl: string,
  config?: MultiplayerOriginConfig,
  bundledBackendOrigin?: string): string {
  const pageOrigin = new URL(pageUrl).origin;
  const allowedOrigins = config?.frontendOrigins !== undefined
    ? config.frontendOrigins
    : config?.frontendOrigin ? [config.frontendOrigin] : undefined;
  if (allowedOrigins !== undefined &&
    (!Array.isArray(allowedOrigins) || !allowedOrigins.length ||
      allowedOrigins.some(origin => {
        if (typeof origin !== "string" || origin.includes("*")) return true;
        try {
          const url = new URL(origin);
          return !["http:", "https:"].includes(url.protocol) ||
            url.origin !== origin;
        } catch {
          return true;
        }
      }))) {
    throw new Error("联机前端域名列表必须包含完整的 HTTP(S) 来源，不含路径或末尾斜杠。");
  }
  if (allowedOrigins && !(allowedOrigins as string[]).includes(pageOrigin)) {
    throw new Error("当前网页域名与联机前端配置不匹配。");
  }

  const configured = config?.backendOrigin?.trim() ||
    bundledBackendOrigin?.trim();
  if (!configured) {
    throw new Error("生产版尚未配置联机后端地址，或网站门禁拦截了 /multiplayer-config.js。请通过门禁后刷新网页。");
  }
  const backend = new URL(configured || pageUrl);
  if (!["http:", "https:"].includes(backend.protocol) ||
    backend.username || backend.password || backend.pathname !== "/" ||
    backend.search || backend.hash) {
    throw new Error("联机后端地址必须是完整的 HTTP(S) 域名，不含路径。");
  }
  if (new URL(pageUrl).protocol === "https:" &&
    backend.protocol !== "https:") {
    throw new Error("HTTPS 网页必须连接 HTTPS 联机后端。");
  }
  return backend.origin;
}

export function multiplayerEndpoint(endpoint: string, pageUrl: string,
  config?: MultiplayerOriginConfig, bundledBackendOrigin?: string): string {
  if (!/^[a-z][a-z0-9/-]*$/i.test(endpoint) || endpoint.includes("..") ||
    endpoint.startsWith("/")) {
    throw new Error("Invalid multiplayer endpoint");
  }
  return `${multiplayerBackendOrigin(pageUrl, config,
    bundledBackendOrigin)}/multiplayer/${endpoint}`;
}
