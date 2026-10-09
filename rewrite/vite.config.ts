import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Reuse the downloaded assets during development without copying 3.49 GiB
// into the build output. The source project contains the application code.
const projectDir = fileURLToPath(new URL(".", import.meta.url));
const mirrorDir = fileURLToPath(new URL("../mirror", import.meta.url));

// run-lan.sh serves other devices over HTTPS: the game needs a secure context
// (crypto.subtle, crypto.randomUUID, OPFS), and the services are proxied on
// the page origin so those pages can reach them without mixed content. The
// game server WebSocket goes to one game node (listed with a null origin,
// KART_PUBLIC_ORIGIN=same-origin); every other request goes to the data service.
const lanCert = process.env.KART_LAN_CERT;
const lanKey = process.env.KART_LAN_KEY;
const backend = process.env.KART_LAN_BACKEND ?? "http://127.0.0.1:8787";
const gameBackend = process.env.KART_LAN_GAME_BACKEND ?? "http://127.0.0.1:8788";
const lan = lanCert && lanKey ? {
  https: { cert: readFileSync(lanCert), key: readFileSync(lanKey) },
  // Vite tries these in order, so the WebSocket route must come first. All are
  // anchored so /multiplayer-config.js stays a static file.
  proxy: {
    "^/multiplayer/ws(?:[?#]|$)": { target: gameBackend, ws: true, xfwd: true },
    "^/multiplayer/": { target: backend, xfwd: true },
    "^/api/": { target: backend, xfwd: true },
  },
} : {};

export default defineConfig({
  publicDir: mirrorDir,
  build: { copyPublicDir: false, target: "es2022" },
  server: {
    host: "127.0.0.1",
    port: 8780,
    strictPort: true,
    fs: { allow: [projectDir, mirrorDir] },
    ...lan,
  },
});
