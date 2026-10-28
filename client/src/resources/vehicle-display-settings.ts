/** Public display policy. Resource lookup and replay identities never depend on it. */
export interface VehicleDisplaySettings {
  readonly disabledVehicleIds: ReadonlySet<string>;
  readonly version: string;
  readonly updatedAt: number;
}

export interface VehicleSettingsResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type VehicleSettingsFetch = (url: string, init: RequestInit) => Promise<VehicleSettingsResponse>;
const DEFAULT_TTL_MS = 30_000;
const EMPTY: VehicleDisplaySettings = { disabledVehicleIds: new Set(), version: "", updatedAt: 0 };
const key = (id: string) => id.toLowerCase();

export function parseVehicleDisplaySettings(value: unknown): VehicleDisplaySettings {
  if (!value || typeof value !== "object") throw new Error("Invalid vehicle display settings");
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.disabledVehicleIds) ||
      row.disabledVehicleIds.some(id => typeof id !== "string" || !/^(?:catalog:3:[1-9]\d*|system:[\w.:-]{1,140})$/.test(id)) ||
      typeof row.version !== "string" || typeof row.updatedAt !== "number" ||
      !Number.isFinite(row.updatedAt) || row.updatedAt < 0)
    throw new Error("Invalid vehicle display settings");
  return { disabledVehicleIds: new Set(row.disabledVehicleIds.map(id => key(id as string))),
    version: row.version, updatedAt: row.updatedAt };
}

/** A failed/old endpoint never replaces the last successful policy with an empty one. */
export class VehicleDisplaySettingsClient {
  private value: VehicleDisplaySettings = EMPTY;
  private lastAttempt = -Infinity;
  private pending?: Promise<VehicleDisplaySettings>;
  lastError: unknown;

  constructor(readonly endpoint: string, readonly fetcher: VehicleSettingsFetch,
    readonly now: () => number = Date.now, readonly ttlMs = DEFAULT_TTL_MS,
    readonly timeoutMs = 2_500) {}

  current(): VehicleDisplaySettings { return this.value; }

  refresh(force = false): Promise<VehicleDisplaySettings> {
    if (this.pending) return this.pending;
    if (!force && this.now() - this.lastAttempt < this.ttlMs) return Promise.resolve(this.value);
    this.lastAttempt = this.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Vehicle display settings request timed out"));
      }, this.timeoutMs);
    });
    this.pending = Promise.race([
      (async () => {
        const response = await this.fetcher(this.endpoint, {
          method: "GET", cache: "no-store", credentials: "omit", signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Vehicle display settings HTTP ${response.status}`);
        return parseVehicleDisplaySettings(await response.json());
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

const clients = new Map<string, VehicleDisplaySettingsClient>();
function browserClient(): VehicleDisplaySettingsClient | undefined {
  // Node exporters and historical catalog tests stay independent of a live service.
  if (typeof window === "undefined" || !window.location?.origin) return undefined;
  const environment = (import.meta as ImportMeta & { env?: { VITE_MULTIPLAYER_BACKEND_ORIGIN?: string } }).env;
  // Match multiplayer's runtime-config precedence, including builds with an embedded service origin.
  const origin = window.__KART_MULTIPLAYER_CONFIG__?.backendOrigin?.trim() ||
    environment?.VITE_MULTIPLAYER_BACKEND_ORIGIN?.trim() || window.location.origin;
  const endpoint = `${origin.replace(/\/$/, "")}/api/vehicle-settings`;
  let client = clients.get(endpoint);
  if (!client) {
    client = new VehicleDisplaySettingsClient(endpoint, (url, init) => fetch(url, init));
    clients.set(endpoint, client);
  }
  return client;
}

export function refreshVehicleDisplaySettings(force = false): Promise<VehicleDisplaySettings> {
  return browserClient()?.refresh(force) ?? Promise.resolve(EMPTY);
}

export function currentVehicleDisplaySettings(): VehicleDisplaySettings {
  return browserClient()?.current() ?? EMPTY;
}

export function vehicleDisplayEnabled(id: string,
  settings: VehicleDisplaySettings = currentVehicleDisplaySettings()): boolean {
  return !settings.disabledVehicleIds.has(key(id));
}

/** Stable catalog IDs are independent of model paths, variants and translated names. */
export function vehicleCatalogDisplayEnabled(vehicle: { itemId: number; systemKey?: string },
  settings: VehicleDisplaySettings = currentVehicleDisplaySettings()): boolean {
  const id = vehicle.itemId === 0 ? `system:${vehicle.systemKey ?? ""}`
    : `catalog:3:${vehicle.itemId}`;
  return vehicleDisplayEnabled(id, settings);
}

export function garageItemDisplayEnabled(item: { kind: string; itemId: number; systemKey?: string },
  settings: VehicleDisplaySettings = currentVehicleDisplaySettings()): boolean {
  return item.kind !== "kart" || vehicleCatalogDisplayEnabled(item, settings);
}
