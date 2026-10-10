// The verified release modules and handwritten systems share one startup path.
import { installLocalMultiplayerConfig } from "./multiplayer/local-config";
import { installStartupLoadingSkin } from "./ui/startup-loading-skin";

installLocalMultiplayerConfig();
installStartupLoadingSkin();

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
// The TrackWorld module installs all handwritten instance methods when loaded.
await import("./generated/world.js");
await import("./generated/app.js");

export {};
