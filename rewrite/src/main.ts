// The generated compatibility runtime is kept separate from the handwritten
// modules. It retains all currently observed game behavior while each system
// is migrated to the maintainable implementations in this source tree.
import { installWorldOverrides } from "./world/install";
import { installLocalMultiplayerConfig } from "./multiplayer/local-config";

installLocalMultiplayerConfig();

async function waitForServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(finish, 10_000);
      function finish() {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve();
      }
      function onChange() {
        if (navigator.serviceWorker.controller) finish();
      }
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      onChange();
    });
  } catch (error) {
    console.warn("Service Worker registration failed", error);
  }
}

await waitForServiceWorker();
const { _L: TrackWorld } = await import("./generated/world.js");
installWorldOverrides(TrackWorld);
await import("./generated/app.js");

export {};
