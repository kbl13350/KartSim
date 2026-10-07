import assert from "node:assert/strict";
import test from "node:test";
import { createLocalMultiplayerConfig } from "./local-config";

test("local Java backend is configured without the downloaded remote config", () => {
  assert.deepEqual(createLocalMultiplayerConfig("http://127.0.0.1:8780"), {
    backendOrigin: "http://127.0.0.1:8787",
    frontendOrigins: ["http://127.0.0.1:8780"], transport: "websocket",
  });
  assert.deepEqual(createLocalMultiplayerConfig("http://localhost:8780", {
    VITE_MULTIPLAYER_BACKEND_ORIGIN: "http://localhost:9000",
    VITE_MULTIPLAYER_TRANSPORT: "webrtc",
  }).backendOrigin, "http://localhost:9000");
  assert.throws(() => createLocalMultiplayerConfig("https://example.test"));
});

test("LAN play reaches the backend through the page's own origin", () => {
  const lan = { VITE_MULTIPLAYER_SAME_ORIGIN: "1" };
  assert.equal(createLocalMultiplayerConfig("https://192.168.1.8:8780", lan).backendOrigin,
    "https://192.168.1.8:8780");
  assert.equal(createLocalMultiplayerConfig("https://kart-mac.local:8780", lan).backendOrigin,
    "https://kart-mac.local:8780");
});
