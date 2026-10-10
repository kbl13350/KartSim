/** Cache a Garage asset promise by its library and native width. */
export function garageAssetsForWidth<Library extends object, Assets>(
  library: Library,
  width: number,
  cache: WeakMap<Library, Map<number, Promise<Assets>>>,
  load: (library: Library, width: number) => Promise<Assets>,
): Promise<Assets> {
  let widths = cache.get(library);
  if (!widths) { widths = new Map(); cache.set(library, widths); }
  let promise = widths.get(width);
  if (!promise) {
    promise = load(library, width);
    widths.set(width, promise);
    promise.catch(() => {
      if (widths!.get(width) === promise) widths!.delete(width);
    });
  }
  return promise;
}

/** Cache mode and width specific tuning assets, retrying after a failed load. */
export function garageUpgradeAssetsForMode<Library extends object, Assets>(
  library: Library,
  mode: string,
  width: number,
  cache: WeakMap<Library, Map<string, Promise<Assets>>>,
  load: (library: Library, mode: string, width: number) => Promise<Assets>,
): Promise<Assets> {
  let modes = cache.get(library);
  if (!modes) { modes = new Map(); cache.set(library, modes); }
  const key = `${mode}:${width}`;
  let promise = modes.get(key);
  if (!promise) {
    promise = load(library, mode, width);
    modes.set(key, promise);
    promise.catch(() => {
      if (modes!.get(key) === promise) modes!.delete(key);
    });
  }
  return promise;
}

/** Cache a single skill or preparation dialog bundle per library. */
export function garageDialogAssets<Library extends object, Assets>(
  library: Library,
  cache: WeakMap<Library, Promise<Assets>>,
  load: (library: Library) => Promise<Assets>,
): Promise<Assets> {
  let promise = cache.get(library);
  if (!promise) {
    promise = load(library);
    cache.set(library, promise);
    promise.catch(() => {
      if (cache.get(library) === promise) cache.delete(library);
    });
  }
  return promise;
}
