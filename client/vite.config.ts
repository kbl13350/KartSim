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
  // Vite tries these in order, so the game node's routes must come first. All are
  // anchored so /multiplayer-config.js stays a static file.
  proxy: {
    "^/multiplayer/ws(?:[?#]|$)": { target: gameBackend, ws: true, xfwd: true },
    // WebRTC signaling goes to the game node too; its media path is UDP, direct.
    "^/multiplayer/offer(?:[?#]|$)": { target: gameBackend, xfwd: true },
    // The global lobby's socket is the data service's (GLOBAL_LOBBY.md).
    "^/multiplayer/lobby/ws(?:[?#]|$)": { target: backend, ws: true, xfwd: true },
    "^/multiplayer/": { target: backend, xfwd: true },
    "^/api/(?:messenger|myroom)/ws(?:[?#]|$)": { target: backend, ws: true, xfwd: true },
    "^/api/": { target: backend, xfwd: true },
  },
} : {};

// `vite build --mode switch` builds the Nintendo Switch package (SWITCH.md):
// Brewser loads it from the SD card as brewser://apps/<id>/index.html, so
// paths are relative, and one bundle avoids dynamic import(), which Brewser
// resolves only for modules it has prefetched. tools/switch/package-brewser.mjs
// adds the resources and the app manifest.
// The release stylesheet is copied next to the bundle by the packager, so it
// leaves the page during the build and comes back as a relative link.
const releaseStylesheet = '<link rel="stylesheet" href="/assets/index-mDCnV9Uo.css" />';
const switchEntry = {
  name: "kartsim-switch-entry",
  transformIndexHtml: {
    order: "pre" as const,
    handler: (html: string) => html.replace('src="/src/main.ts"', 'src="/src/main-switch.ts"')
      .replace(releaseStylesheet, "<!--release-stylesheet-->")
      .replace("<title>KartSim 开发版</title>", "<title>KartSim</title>"),
  },
};
const switchStylesheet = {
  name: "kartsim-switch-stylesheet",
  transformIndexHtml: {
    order: "post" as const,
    handler: (html: string) => html.replace("<!--release-stylesheet-->",
      releaseStylesheet.replace('href="/assets/', 'href="./assets/')),
  },
};

export default defineConfig(({ mode }) => mode === "switch" ? (() => {
  process.env.VITE_KART_PLATFORM = "switch";
  return {
    base: "./",
    // The release worker (Vorbis fallback) is bundled from the mirror like the web build.
    publicDir: mirrorDir,
    plugins: [switchEntry, switchStylesheet],
    build: {
      copyPublicDir: false,
      outDir: "build/switch-web",
      emptyOutDir: true,
      target: "es2022",
      assetsInlineLimit: 0,
      modulePreload: false,
      chunkSizeWarningLimit: 20_000,
      rollupOptions: { output: { codeSplitting: false } },
    },
  };
})() : {
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
