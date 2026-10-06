// Start the game only after the Service Worker can intercept its first assets.
(async () => {
  if ("serviceWorker" in navigator && window.isSecureContext) {
    try {
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          const timeout = setTimeout(() => finish(false), 10000);
          const onChange = () => {
            if (navigator.serviceWorker.controller) finish(true);
          };
          function finish(controlled) {
            clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener("controllerchange", onChange);
            if (!controlled) console.warn("KartSim Service Worker did not take control in time");
            resolve();
          }
          navigator.serviceWorker.addEventListener("controllerchange", onChange);
          onChange();
        });
      }
    } catch (error) {
      console.warn("KartSim Service Worker registration failed", error);
    }
  }

  const game = document.createElement("script");
  game.type = "module";
  game.crossOrigin = "anonymous";
  game.src = "/assets/index-DoW2rQpI.js";
  document.head.appendChild(game);
})();
