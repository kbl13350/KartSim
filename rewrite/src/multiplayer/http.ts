import { multiplayerEndpoint } from "./config";
import { PROTOCOL_VERSION } from "./protocol";

export interface Account {
  nickname: string;
  admin?: boolean;
  [key: string]: unknown;
}

export interface AuthConfig {
  loginRequired: boolean;
  backendOrigin: string | null;
}

export interface MultiplayerHttpOptions {
  backendOrigin: string;
  /** Used to verify the backend's own auth/config response. */
  pageOrigin?: string;
  fetchImpl?: typeof fetch;
  sessionStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const STUN = "stun:stun.cloudflare.com:3478";
const ALLOWED_TURN = new Set([
  "turn:turn.cloudflare.com:3478?transport=udp",
  "turn:turn.cloudflare.com:3478?transport=tcp",
  "turn:turn.cloudflare.com:443?transport=udp",
  "turn:turn.cloudflare.com:80?transport=tcp",
  "turns:turn.cloudflare.com:5349?transport=tcp",
  "turns:turn.cloudflare.com:443?transport=tcp",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid multiplayer JSON response");
  }
  return value as Record<string, unknown>;
}

function accountFrom(value: unknown): Account {
  const account = asRecord(value);
  if (typeof account.nickname !== "string" || account.nickname.length < 1 || account.nickname.length > 64) {
    throw new Error("Invalid multiplayer account response");
  }
  return account as Account;
}

/** Keep only the fixed STUN service and explicitly allowed TURN addresses. */
export function sanitizeIceServers(value: unknown): RTCIceServer[] {
  const result: RTCIceServer[] = [{ urls: STUN }];
  if (!Array.isArray(value)) return result;
  const seen = new Set<string>();
  for (const entry of value.slice(0, 8)) {
    if (!entry || typeof entry !== "object") continue;
    const server = entry as Record<string, unknown>;
    if (typeof server.username !== "string" || !server.username || server.username.length > 512 ||
        typeof server.credential !== "string" || !server.credential || server.credential.length > 512) continue;
    const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).slice(0, 12)
      .filter((url): url is string => typeof url === "string" && ALLOWED_TURN.has(url) && !seen.has(url));
    if (!urls.length) continue;
    urls.forEach((url) => seen.add(url));
    result.push({ urls, username: server.username, credential: server.credential });
  }
  return result;
}

export class MultiplayerHttpClient {
  readonly backendOrigin: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage?: MultiplayerHttpOptions["sessionStorage"];
  private readonly pageOrigin?: string;
  private memoryToken?: string;

  constructor(options: MultiplayerHttpOptions) {
    this.backendOrigin = options.backendOrigin;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.storage = options.sessionStorage ?? (typeof sessionStorage === "undefined" ? undefined : sessionStorage);
    this.pageOrigin = options.pageOrigin;
  }

  endpoint(path: string): string {
    return multiplayerEndpoint(this.backendOrigin, path);
  }

  get token(): string | undefined {
    try {
      const stored = this.storage?.getItem(`kartsim.multiplayer.session:${this.backendOrigin}`);
      if (stored && TOKEN_PATTERN.test(stored)) return stored;
    } catch { /* Private browsing may disable storage. */ }
    return this.memoryToken;
  }

  private setToken(value: string): void {
    if (!TOKEN_PATTERN.test(value)) throw new Error("Invalid session token from backend");
    this.memoryToken = value;
    try { this.storage?.setItem(`kartsim.multiplayer.session:${this.backendOrigin}`, value); } catch { /* Keep memory token. */ }
  }

  clearToken(): void {
    this.memoryToken = undefined;
    try { this.storage?.removeItem(`kartsim.multiplayer.session:${this.backendOrigin}`); } catch { /* Storage unavailable. */ }
  }

  private headers(json: boolean): HeadersInit {
    return { ...(json ? { "Content-Type": "application/json" } : {}),
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) };
  }

  private async json(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(this.endpoint(path), {
      credentials: "same-origin",
      ...init,
    });
    let body: Record<string, unknown>;
    try { body = asRecord(await response.json()); }
    catch { throw new Error(`Invalid JSON from ${path} (${response.status})`); }
    if (!response.ok) {
      const code = typeof body.error === "string" ? body.error : `HTTP_${response.status}`;
      if (code === "LOGIN_REQUIRED") this.clearToken();
      // The body stays with the error (ACCOUNT_BANNED carries until and reason).
      throw Object.assign(new Error(code), { body });
    }
    return body;
  }

  async checkHealth(signal?: AbortSignal): Promise<void> {
    const response = await this.fetchImpl(this.endpoint("healthz"), {
      cache: "no-store", signal, credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`Multiplayer health check failed (${response.status})`);
    const body = asRecord(await response.json());
    if (!Number.isInteger(body.protocolVersion)) throw new Error("Invalid multiplayer protocol version");
    if (body.protocolVersion !== PROTOCOL_VERSION) {
      throw new Error(`Multiplayer protocol mismatch: client ${PROTOCOL_VERSION}, server ${body.protocolVersion}`);
    }
  }

  async getAuthConfig(signal?: AbortSignal): Promise<AuthConfig> {
    const body = await this.json("auth/config", { headers: this.headers(false), signal });
    if (typeof body.loginRequired !== "boolean" ||
        !(body.backendOrigin === null || typeof body.backendOrigin === "string")) {
      throw new Error("Invalid multiplayer auth configuration");
    }
    if (body.backendOrigin !== this.backendOrigin &&
        !(this.pageOrigin === this.backendOrigin && body.backendOrigin === null)) {
      throw new Error("Multiplayer backend origin differs from auth configuration");
    }
    return { loginRequired: body.loginRequired, backendOrigin: body.backendOrigin };
  }

  async checkGuestName(name: string, signal?: AbortSignal): Promise<boolean> {
    if ([...name].length < 1 || [...name].length > 18 || name.trim() !== name ||
        /[\u0000-\u001f\u007f<>]/u.test(name)) throw new Error("Invalid guest name");
    const body = await this.json("auth/guest-name", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }), signal,
    });
    if (typeof body.available !== "boolean") throw new Error("Invalid guest-name response");
    return body.available;
  }

  private async account(path: string, fields?: Record<string, string>, signal?: AbortSignal): Promise<Account> {
    const body = await this.json(`auth/${path}`, fields ? {
      method: "POST", headers: this.headers(true), body: JSON.stringify(fields), signal,
    } : { headers: this.headers(false), signal });
    const account = accountFrom(body.account);
    if (path === "login") {
      if (typeof body.token !== "string") throw new Error("Login response has no session token");
      this.setToken(body.token);
    }
    return account;
  }

  register(fields: { username: string; nickname: string; password: string; invite: string }, signal?: AbortSignal): Promise<Account> {
    return this.account("register", fields, signal);
  }

  login(fields: { username: string; password: string }, signal?: AbortSignal): Promise<Account> {
    return this.account("login", fields, signal);
  }

  me(signal?: AbortSignal): Promise<Account> {
    return this.account("me", undefined, signal);
  }

  updateNickname(nickname: string, signal?: AbortSignal): Promise<Account> {
    return this.account("nickname", { nickname }, signal);
  }

  async logout(signal?: AbortSignal): Promise<void> {
    try {
      await this.fetchImpl(this.endpoint("auth/logout"), {
        method: "POST", credentials: "same-origin", headers: this.headers(true), body: "{}", signal,
      });
    } finally { this.clearToken(); }
  }

  async exchangeOffer(sdp: string, signal?: AbortSignal): Promise<string> {
    const body = await this.json("offer", {
      method: "POST", headers: this.headers(true),
      body: JSON.stringify({ type: "offer", sdp }), signal,
    });
    if (body.type !== "answer" || typeof body.sdp !== "string" || body.sdp.length > 32_768) {
      throw new Error("Invalid WebRTC answer from backend");
    }
    return body.sdp;
  }

  async getIceServers(signal?: AbortSignal): Promise<RTCIceServer[]> {
    try {
      const body = await this.json("ice", {
        cache: "no-store", headers: this.headers(false), signal,
      });
      return sanitizeIceServers(body.iceServers);
    } catch {
      return sanitizeIceServers(undefined);
    }
  }
}
