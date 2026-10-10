export interface StartupCatalog {
  karts: { itemId: number; systemKey?: string; path: string; title?: string }[];
  characters: { itemId: number; path: string }[];
}

export interface StartupProfile {
  equipment: {
    itemIds: Record<number, number>;
    systemKartVariant?: string;
    systemKart?: string;
  };
}

export interface StartupSelectionOps {
  defaultProfile(): StartupProfile;
  resolveSystemKart(karts: StartupCatalog["karts"], itemId: number,
    path: string, systemKey: string | undefined): StartupCatalog["karts"][number] | undefined;
  isSpecialKartId(itemId: number): boolean;
  displayKartName(itemId: number): string;
  startTrack: { mapPath: string; trackId: string };
}

/** Resolves the saved rider to catalog entries with a valid starter fallback. */
export function resolveStartupSelection(
  garage: StartupCatalog,
  tracks: { path: string }[],
  profile: StartupProfile | undefined,
  ops: StartupSelectionOps,
): { selection: {
  vehiclePath: string; vehicleItemId: number; vehicleSystemKey?: string;
  characterPath: string; characterItemId: number;
  mapPath: string; trackId: string;
}; vehicleTitle?: string } {
  const equipment = (profile ?? ops.defaultProfile()).equipment;
  const kartId = equipment.itemIds[3]!;
  const characterId = equipment.itemIds[1]!;
  const variantPath = kartId === 0 && equipment.systemKartVariant
    ? `kart_/${equipment.systemKartVariant}/model.1s` : undefined;
  const selectedKart = variantPath
    ? ops.resolveSystemKart(garage.karts, kartId, variantPath,
      equipment.systemKart)
    : garage.karts.find(kart => kartId === 0
      ? kart.itemId === 0 && kart.systemKey === equipment.systemKart
      : kart.itemId === kartId);
  const special = ops.isSpecialKartId(kartId);
  const kart = special
    ? garage.karts.find(candidate =>
      candidate.itemId === ops.defaultProfile().equipment.itemIds[3] &&
      !ops.isSpecialKartId(candidate.itemId))
    : selectedKart;
  if (special && !kart)
    throw new Error(`${ops.displayKartName(kartId)} 当前目录中没有可用的启动替代车辆。`);
  if (!kart)
    throw new Error(`启动车辆不在当前车库目录：ItemKart ${kartId}。`);
  const character = garage.characters.find(item => item.itemId === characterId);
  if (!character)
    throw new Error(`启动角色不在当前车库目录：ItemCharacter ${characterId}。`);
  const track = tracks.find(item =>
    item.path.toLowerCase() === ops.startTrack.mapPath.toLowerCase());
  if (!track)
    throw new Error(`已验证启动赛道不在准入 catalog：${ops.startTrack.mapPath}。`);
  return {
    selection: {
      vehiclePath: kart.path,
      vehicleItemId: kart.itemId,
      vehicleSystemKey: kart.systemKey,
      characterPath: character.path,
      characterItemId: character.itemId,
      mapPath: track.path,
      trackId: ops.startTrack.trackId,
    },
    vehicleTitle: kart.title,
  };
}

export interface ViewportRect {
  width: number; height: number; left: number; top: number;
  physicalWidth: number; physicalHeight: number;
}

/** Fits an exact 16:9 physical canvas inside a viewport. */
export function fitGameViewport(width: number, height: number,
  pixelRatio: number): ViewportRect {
  if (![width, height, pixelRatio].every(value =>
    Number.isFinite(value) && value > 0))
    throw new Error("Viewport dimensions and pixel ratio must be positive and finite.");
  const unit = Math.max(1, Math.floor(Math.min(
    (width * pixelRatio) / 16, (height * pixelRatio) / 9)));
  const physicalWidth = unit * 16;
  const physicalHeight = unit * 9;
  const offsetX = Math.floor((width * pixelRatio - physicalWidth) / 2);
  const offsetY = Math.floor((height * pixelRatio - physicalHeight) / 2);
  return {
    width: physicalWidth / pixelRatio,
    height: physicalHeight / pixelRatio,
    left: offsetX / pixelRatio,
    top: offsetY / pixelRatio,
    physicalWidth,
    physicalHeight,
  };
}

/** Positions the root element and tracks viewport/device-pixel changes. */
export function mountGameViewport(root: HTMLElement,
  pixelRatio: () => number): () => void {
  const previous = {
    width: root.style.width,
    height: root.style.height,
    left: root.style.left,
    top: root.style.top,
  };
  let media: MediaQueryList | undefined;
  const resize = () => {
    const rect = fitGameViewport(window.innerWidth, window.innerHeight,
      pixelRatio());
    root.style.width = `${rect.width}px`;
    root.style.height = `${rect.height}px`;
    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
  };
  const watchResolution = () => {
    media?.removeEventListener("change", onResolutionChange);
    media = window.matchMedia(`(resolution: ${pixelRatio()}dppx)`);
    media.addEventListener("change", onResolutionChange);
  };
  const onResolutionChange = () => { resize(); watchResolution(); };
  resize();
  watchResolution();
  window.addEventListener("resize", resize);
  return () => {
    window.removeEventListener("resize", resize);
    media?.removeEventListener("change", onResolutionChange);
    Object.assign(root.style, previous);
  };
}

/** Reloads only when a new versioned entry script is detected. */
export function watchFrontendVersion(canReload: () => boolean): () => void {
  const currentScript = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src]')?.src;
  if (!currentScript) return () => {};
  let checking = false;
  let stopped = false;
  const check = async () => {
    if (checking || stopped || !canReload()) return;
    checking = true;
    try {
      const url = new URL("/", window.location.href);
      url.searchParams.set("kart-update-check", String(Date.now()));
      const response = await fetch(url, {
        cache: "no-store", credentials: "same-origin",
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html"))
        return;
      const nextScriptPath = new DOMParser()
        .parseFromString(await response.text(), "text/html")
        .querySelector('script[type="module"][src]')?.getAttribute("src");
      const nextScript = nextScriptPath
        ? new URL(nextScriptPath, response.url).href : undefined;
      if (!nextScript || nextScript === currentScript || !canReload() || stopped)
        return;
      const marker = `kart-frontend-reload:${nextScript}`;
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, "1");
      window.location.reload();
    } catch {
      // Keep the running game when an update probe is unavailable.
    } finally {
      checking = false;
    }
  };
  const onPageShow = () => { void check(); };
  const onVisibility = () => {
    if (document.visibilityState === "visible") void check();
  };
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("visibilitychange", onVisibility);
  void check();
  return () => {
    stopped = true;
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
