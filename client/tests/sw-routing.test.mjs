import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const workerSource = readFileSync(new URL("../../mirror/sw.js", import.meta.url), "utf8");

function workerHarness() {
  const listeners = new Map();
  const cached = new Map();
  const fetched = [];
  const cache = {
    match: async request => cached.get(request.url)?.clone(),
    put: async (request, response) => { cached.set(request.url, response); },
  };
  const context = {
    URL, Headers, Response, Request, console,
    self: {
      location: { origin: "http://localhost" },
      addEventListener: (name, listener) => listeners.set(name, listener),
    },
    caches: { open: async () => cache },
    fetch: async request => {
      fetched.push(request.url);
      return new Response("asset-bytes", { status: 200 });
    },
  };
  vm.runInNewContext(workerSource, context, { filename: "mirror/sw.js" });
  async function request(path, options) {
    let response;
    listeners.get("fetch")({
      request: new Request(path.startsWith("http") ? path : `http://localhost${path}`, options),
      respondWith: promise => { response = promise; },
    });
    return response && await response;
  }
  return { request, fetched, cached };
}

test("archive Rho/Rho5 and aaa.pk requests stream through the Service Worker", async () => {
  const worker = workerHarness();
  for (const path of ["/p3553/track_village_C106.rho",
    "/p3553/DataPack2_00000.rho5", "/p3553/aaa.pk"]) {
    const response = await worker.request(path);
    assert.equal(response.headers.get("X-KartSim-SW"), "archive");
    assert.equal(await response.text(), "asset-bytes");
  }
  assert.equal(worker.fetched.length, 3);
  assert.equal(worker.cached.size, 0);
});

test("WASM is cached once and range requests still use the network", async () => {
  const worker = workerHarness();
  const path = "/assets/motor-vorbis-B0OpSz3w.wasm";
  assert.equal((await worker.request(path)).headers.get("X-KartSim-SW"), "wasm-network");
  assert.equal((await worker.request(path)).headers.get("X-KartSim-SW"), "wasm-cache");
  assert.equal((await worker.request(path)).headers.get("X-KartSim-SW"), "wasm-cache");
  assert.equal(worker.fetched.length, 1);
  const ranged = await worker.request(path, { headers: { Range: "bytes=0-3" } });
  assert.equal(ranged.headers.get("X-KartSim-SW"), "wasm-network");
  assert.equal(worker.fetched.length, 2);
});

test("unrelated and cross-origin requests are not intercepted", async () => {
  const worker = workerHarness();
  assert.equal(await worker.request("/p3553/track_village_C106.png"), undefined);
  assert.equal(await worker.request("/assets/other.wasm"), undefined);
  assert.equal(await worker.request("https://example.com/p3553/track_village_C106.rho"), undefined);
  assert.equal(worker.fetched.length, 0);
});
