import assert from "node:assert/strict";
import test from "node:test";
import { parseTrackDisplaySettings, TrackDisplaySettingsClient, trackDisplayEnabled,
  refreshTrackDisplaySettings, currentTrackDisplaySettings, type TrackSettingsResponse } from "./track-display-settings";

const payload = (disabledTrackIds: string[], version = "v1") => ({ disabledTrackIds, version, updatedAt: 123 });
const response = (value: unknown, status = 200): TrackSettingsResponse => ({
  ok: status === 200, status, json: async () => value,
});

test("settings normalize IDs and reject incomplete/malformed snapshots atomically", () => {
  const parsed = parseTrackDisplaySettings(payload(["Korea_R01", "korea_r01", "korea_R01_rvs"]));
  assert.deepEqual([...parsed.disabledTrackIds], ["korea_r01", "korea_r01_rvs"]);
  assert.equal(trackDisplayEnabled("KOREA_R01", parsed), false);
  assert.equal(trackDisplayEnabled("korea_R02", parsed), true);
  for (const bad of [null, {}, { disabledTrackIds: [] },
    { ...payload([]), updatedAt: NaN }, payload(["path/escape"]), payload([""])])
    assert.throws(() => parseTrackDisplaySettings(bad), /Invalid/);
});

test("refresh shares one GET, observes TTL, and forces re-open updates", async () => {
  let now = 0, calls = 0, complete!: (value: TrackSettingsResponse) => void;
  const requests: RequestInit[] = [];
  const client = new TrackDisplaySettingsClient("https://data.example/api/track-settings", async (url, init) => {
    assert.equal(url, "https://data.example/api/track-settings");
    requests.push(init); calls++;
    return new Promise(resolve => { complete = resolve; });
  }, () => now);
  const first = client.refresh(), concurrent = client.refresh(true);
  assert.equal(first, concurrent);
  assert.equal(calls, 1);
  complete(response(payload(["closed"])));
  assert.equal(trackDisplayEnabled("closed", await first), false);
  now = 29_999;
  await client.refresh();
  assert.equal(calls, 1);
  const forced = client.refresh(true);
  complete(response(payload([], "v2")));
  assert.equal(trackDisplayEnabled("closed", await forced), true);
  assert.equal(calls, 2);
  now = 60_000;
  const expired = client.refresh();
  complete(response(payload(["other"], "v3")));
  assert.equal((await expired).version, "v3");
  assert.equal(calls, 3);
  assert.ok(requests.every(init => init.method === "GET" && init.cache === "no-store" &&
    init.credentials === "omit" && init.signal instanceof AbortSignal));
});

test("old endpoint defaults open; later HTTP, network or invalid data retain last success", async () => {
  let next: TrackSettingsResponse | Error = response(undefined, 404);
  const client = new TrackDisplaySettingsClient("/api/track-settings", async () => {
    if (next instanceof Error) throw next;
    return next;
  });
  assert.equal(trackDisplayEnabled("closed", await client.refresh()), true);
  next = response(payload(["closed"]));
  const saved = await client.refresh(true);
  for (const failed of [response(undefined, 404), response(undefined, 503),
    new Error("offline"), response({ disabledTrackIds: [] })]) {
    next = failed;
    assert.equal(await client.refresh(true), saved);
    assert.equal(trackDisplayEnabled("closed", client.current()), false);
    assert.ok(client.lastError);
  }
});

test("timeout aborts the request without losing a successful policy", async () => {
  let stall = false, signal: AbortSignal | undefined;
  const client = new TrackDisplaySettingsClient("/api/track-settings", async (_url, init) => {
    signal = init.signal as AbortSignal;
    if (stall) return new Promise(() => {});
    return response(payload(["closed"]));
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
    return new Response(JSON.stringify(payload(url.includes("data-a") ? ["closed"] : [])));
  };
  try {
    assert.equal(trackDisplayEnabled("closed", await refreshTrackDisplaySettings(true)), false);
    config.backendOrigin = "https://data-b.example";
    assert.equal(trackDisplayEnabled("closed", await refreshTrackDisplaySettings(true)), true);
    config.backendOrigin = "https://data-a.example/";
    assert.equal(trackDisplayEnabled("closed", currentTrackDisplaySettings()), false);
    assert.deepEqual(urls, ["https://data-a.example/api/track-settings", "https://data-b.example/api/track-settings"]);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
