// Routes local KartSim archive downloads through a Service Worker. The game
// already stores large containers in OPFS, so this worker only caches the
// small, content-hashed WASM decoder.
const WASM_CACHE = "kartsim-wasm-v1";
const WASM_PATH = "/assets/motor-vorbis-B0OpSz3w.wasm";
const ARCHIVE_PATH = /^\/p3553\/(?:[^/]+\.rho5?|aaa\.pk)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("kartsim-wasm-") && name !== WASM_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (ARCHIVE_PATH.test(url.pathname)) {
    // Preserve the 200 response and body stream expected by the OPFS downloader.
    event.respondWith(fetch(request).then((response) => tagged(response, "archive")));
  } else if (url.pathname === WASM_PATH) {
    event.respondWith(loadWasm(request));
  }
});

async function loadWasm(request) {
  // A partial request cannot be answered with a cached full-file 200 response.
  if (request.headers.has("range")) {
    return tagged(await fetch(request), "wasm-network");
  }

  let cache;
  try {
    cache = await caches.open(WASM_CACHE);
    const hit = await cache.match(request);
    if (hit) return tagged(hit, "wasm-cache");
  } catch (error) {
    console.warn("KartSim WASM cache unavailable", error);
  }

  const response = await fetch(request);
  if (cache && response.status === 200) {
    try {
      await cache.put(request, response.clone());
    } catch (error) {
      console.warn("KartSim WASM cache write failed", error);
    }
  }
  return tagged(response, "wasm-network");
}

function tagged(response, route) {
  if (response.status !== 200 && response.status !== 206) return response;
  const headers = new Headers(response.headers);
  headers.set("X-KartSim-SW", route);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
