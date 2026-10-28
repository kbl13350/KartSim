import assert from "node:assert/strict";
import test from "node:test";
import { parseVehicleDisplaySettings, VehicleDisplaySettingsClient, vehicleDisplayEnabled,
  refreshVehicleDisplaySettings, currentVehicleDisplaySettings, type VehicleSettingsResponse } from "./vehicle-display-settings";

const payload = (disabledVehicleIds: string[], version = "v1") => ({ disabledVehicleIds, version, updatedAt: 123 });
const response = (value: unknown, status = 200): VehicleSettingsResponse => ({
  ok: status === 200, status, json: async () => value,
});

test("settings normalize IDs and reject incomplete/malformed snapshots atomically", () => {
  const parsed = parseVehicleDisplaySettings(payload(["system:practiceKart", "system:practicekart", "catalog:3:10"]));
  assert.deepEqual([...parsed.disabledVehicleIds], ["system:practicekart", "catalog:3:10"]);
  assert.equal(vehicleDisplayEnabled("SYSTEM:PRACTICEKART", parsed), false);
  assert.equal(vehicleDisplayEnabled("catalog:3:20", parsed), true);
  for (const bad of [null, {}, { disabledVehicleIds: [] },
    { ...payload([]), updatedAt: NaN }, payload(["path/escape"]), payload([""])])
    assert.throws(() => parseVehicleDisplaySettings(bad), /Invalid/);
});

test("refresh shares one GET, observes TTL, and forces re-open updates", async () => {
  let now = 0, calls = 0, complete!: (value: VehicleSettingsResponse) => void;
  const requests: RequestInit[] = [];
  const client = new VehicleDisplaySettingsClient("https://data.example/api/vehicle-settings", async (url, init) => {
    assert.equal(url, "https://data.example/api/vehicle-settings");
    requests.push(init); calls++;
    return new Promise(resolve => { complete = resolve; });
  }, () => now);
  const first = client.refresh(), concurrent = client.refresh(true);
  assert.equal(first, concurrent);
  assert.equal(calls, 1);
  complete(response(payload(["catalog:3:10"])));
  assert.equal(vehicleDisplayEnabled("catalog:3:10", await first), false);
  now = 29_999;
  await client.refresh();
  assert.equal(calls, 1);
  const forced = client.refresh(true);
  complete(response(payload([], "v2")));
  assert.equal(vehicleDisplayEnabled("catalog:3:10", await forced), true);
  assert.equal(calls, 2);
  now = 60_000;
  const expired = client.refresh();
  complete(response(payload(["catalog:3:20"], "v3")));
  assert.equal((await expired).version, "v3");
  assert.equal(calls, 3);
  assert.ok(requests.every(init => init.method === "GET" && init.cache === "no-store" &&
    init.credentials === "omit" && init.signal instanceof AbortSignal));
});

test("old endpoint defaults open; later HTTP, network or invalid data retain last success", async () => {
  let next: VehicleSettingsResponse | Error = response(undefined, 404);
  const client = new VehicleDisplaySettingsClient("/api/vehicle-settings", async () => {
    if (next instanceof Error) throw next;
    return next;
  });
  assert.equal(vehicleDisplayEnabled("catalog:3:10", await client.refresh()), true);
  next = response(payload(["catalog:3:10"]));
  const saved = await client.refresh(true);
  for (const failed of [response(undefined, 404), response(undefined, 503),
    new Error("offline"), response({ disabledVehicleIds: [] })]) {
    next = failed;
    assert.equal(await client.refresh(true), saved);
    assert.equal(vehicleDisplayEnabled("catalog:3:10", client.current()), false);
    assert.ok(client.lastError);
  }
});

test("timeout aborts the request without losing a successful policy", async () => {
  let stall = false, signal: AbortSignal | undefined;
  const client = new VehicleDisplaySettingsClient("/api/vehicle-settings", async (_url, init) => {
    signal = init.signal as AbortSignal;
    if (stall) return new Promise(() => {});
    return response(payload(["catalog:3:10"]));
  }, Date.now, 30_000, 10);
  const saved = await client.refresh();
  stall = true;
  assert.equal(await client.refresh(true), saved);
  assert.equal(signal?.aborted, true);
  assert.match(String(client.lastError), /timed out/);
});

test("all browser entry points use the configured data origin and keep backend caches separate", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldFetch = globalThis.fetch;
  const config = { backendOrigin: "  https://data-a.example/  " };
  const urls: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { origin: "https://frontend.example" }, __KART_MULTIPLAYER_CONFIG__: config,
  } });
  globalThis.fetch = async input => {
    const url = String(input); urls.push(url);
    return new Response(JSON.stringify(payload(url.includes("data-a") ? ["catalog:3:10"] : [])));
  };
  try {
    assert.equal(vehicleDisplayEnabled("catalog:3:10", await refreshVehicleDisplaySettings(true)), false);
    config.backendOrigin = "https://data-b.example";
    assert.equal(vehicleDisplayEnabled("catalog:3:10", await refreshVehicleDisplaySettings(true)), true);
    config.backendOrigin = "https://data-a.example/";
    assert.equal(vehicleDisplayEnabled("catalog:3:10", currentVehicleDisplaySettings()), false);
    assert.deepEqual(urls, ["https://data-a.example/api/vehicle-settings", "https://data-b.example/api/vehicle-settings"]);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
