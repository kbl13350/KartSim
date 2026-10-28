/** Public display policy. Resource lookup and replay identities never depend on it. */
export interface TrackDisplaySettings {
  readonly disabledTrackIds: ReadonlySet<string>;
  readonly version: string;
  readonly updatedAt: number;
}

export interface TrackSettingsResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type TrackSettingsFetch = (url: string, init: RequestInit) => Promise<TrackSettingsResponse>;
const DEFAULT_TTL_MS = 30_000;
const EMPTY: TrackDisplaySettings = { disabledTrackIds: new Set(), version: "", updatedAt: 0 };
const key = (id: string) => id.toLowerCase();

export function parseTrackDisplaySettings(value: unknown): TrackDisplaySettings {
  if (!value || typeof value !== "object") throw new Error("Invalid track display settings");
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.disabledTrackIds) ||
      row.disabledTrackIds.some(id => typeof id !== "string" || !/^[\w.:-]{1,160}$/.test(id)) ||
      typeof row.version !== "string" || typeof row.updatedAt !== "number" ||
      !Number.isFinite(row.updatedAt) || row.updatedAt < 0)
    throw new Error("Invalid track display settings");
  return { disabledTrackIds: new Set(row.disabledTrackIds.map(id => key(id as string))),
    version: row.version, updatedAt: row.updatedAt };
}

/** A failed/old endpoint never replaces the last successful policy with an empty one. */
export class TrackDisplaySettingsClient {
  private value: TrackDisplaySettings = EMPTY;
  private lastAttempt = -Infinity;
  private pending?: Promise<TrackDisplaySettings>;
  lastError: unknown;

  constructor(readonly endpoint: string, readonly fetcher: TrackSettingsFetch,
    readonly now: () => number = Date.now, readonly ttlMs = DEFAULT_TTL_MS,
    readonly timeoutMs = 2_500) {}

  current(): TrackDisplaySettings { return this.value; }

  refresh(force = false): Promise<TrackDisplaySettings> {
    if (this.pending) return this.pending;
    if (!force && this.now() - this.lastAttempt < this.ttlMs) return Promise.resolve(this.value);
    this.lastAttempt = this.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Track display settings request timed out"));
      }, this.timeoutMs);
    });
    this.pending = Promise.race([
      (async () => {
        const response = await this.fetcher(this.endpoint, {
          method: "GET", cache: "no-store", credentials: "omit", signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Track display settings HTTP ${response.status}`);
        return parseTrackDisplaySettings(await response.json());
      })(), timeout,
    ]).then(value => {
      this.value = value;
      this.lastError = undefined;
      return value;
    }).catch(error => {
      this.lastError = error;
      return this.value;
    }).finally(() => {
      clearTimeout(timer);
      this.pending = undefined;
    });
    return this.pending;
  }
}

const clients = new Map<string, TrackDisplaySettingsClient>();
function browserClient(): TrackDisplaySettingsClient | undefined {
  // Node exporters and historical catalog tests stay independent of a live service.
  if (typeof window === "undefined" || !window.location?.origin) return undefined;
  const environment = (import.meta as ImportMeta & { env?: { VITE_MULTIPLAYER_BACKEND_ORIGIN?: string } }).env;
  // Match multiplayer's runtime-config precedence, including builds with an embedded service origin.
  const origin = window.__KART_MULTIPLAYER_CONFIG__?.backendOrigin?.trim() ||
    environment?.VITE_MULTIPLAYER_BACKEND_ORIGIN?.trim() || window.location.origin;
  const endpoint = `${origin.replace(/\/$/, "")}/api/track-settings`;
  let client = clients.get(endpoint);
  if (!client) {
    client = new TrackDisplaySettingsClient(endpoint, (url, init) => fetch(url, init));
    clients.set(endpoint, client);
  }
  return client;
}

export function refreshTrackDisplaySettings(force = false): Promise<TrackDisplaySettings> {
  return browserClient()?.refresh(force) ?? Promise.resolve(EMPTY);
}

export function currentTrackDisplaySettings(): TrackDisplaySettings {
  return browserClient()?.current() ?? EMPTY;
}

export function trackDisplayEnabled(id: string,
  settings: TrackDisplaySettings = currentTrackDisplaySettings()): boolean {
  return !settings.disabledTrackIds.has(key(id));
}
