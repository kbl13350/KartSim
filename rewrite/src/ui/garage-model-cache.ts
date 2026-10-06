export interface GarageCachedModel {
  dispose(): void;
}

export interface GarageModelSource {
  path: string;
}

/** Owns model previews while the Garage view and its selected kart remain current. */
export class GarageModelCache<Model extends GarageCachedModel = GarageCachedModel> {
  readonly panels = new Map<string, Model>();
  readonly loading = new Map<string, number>();
  readonly failed = new Set<string>();
  disposed = false;
  generation = 0;

  constructor(
    readonly load: (source: GarageModelSource) => Promise<Model>,
    readonly onError: (path: string, error: unknown) => void,
  ) {}

  /** Return a ready model now, or start one load for this path and generation. */
  get(source: GarageModelSource): Model | undefined {
    if (this.disposed) return undefined;
    const path = source.path;
    const ready = this.panels.get(path);
    const generation = this.generation;
    if (ready || this.loading.get(path) === generation || this.failed.has(path))
      return ready;
    this.loading.set(path, generation);
    this.load(source)
      .then(model => {
        if (this.disposed || generation !== this.generation) model.dispose();
        else this.panels.set(path, model);
      })
      .catch(error => {
        if (!this.disposed && generation === this.generation) {
          this.failed.add(path);
          this.onError(path, error);
        }
      })
      .finally(() => {
        if (this.loading.get(path) === generation) this.loading.delete(path);
      });
    return undefined;
  }

  /** Reset outstanding work and allow previously failed paths to be retried. */
  clear(): void {
    if (this.disposed) return;
    this.generation += 1;
    for (const model of this.panels.values()) model.dispose();
    this.panels.clear();
    this.loading.clear();
    this.failed.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    for (const model of this.panels.values()) model.dispose();
    this.panels.clear();
  }
}
