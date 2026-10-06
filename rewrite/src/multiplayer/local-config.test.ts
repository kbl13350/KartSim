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
