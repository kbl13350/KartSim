/**
 * Item pictures and the 3D rider for the shop (src/shop/shop-view.ts
 * ShopPreviewRenderer).
 *
 * One shared offscreen garage renderer (shop-preview-garage.ts, loaded on the
 * first visible kart/character/equipment card or when the stage mounts)
 * draws a still snapshot per (category, itemId, size); each card gets a plain
 * 2D <canvas> copy. The same renderer draws the MqShopStage rider (the
 * garage's live preview of the player's kart and character with the items
 * tried on) into the stage's 2D canvas every frame, so the shop never holds
 * more than one WebGL context. Snapshots stay in a small LRU cache while the
 * shop is open; dispose() (shop closed) releases everything. Anything that
 * fails keeps the shop's kind icon (and an empty stage).
 */
import type { ShopPreviewRenderer, ShopPreviewRequest, ShopStage } from "../shop/shop-view";

/** The player's current rider for the stage: the Ready selection and profile equipment. */
export interface ShopRiderSelection {
  readonly vehicleItemId?: number;
  readonly vehiclePath?: string;
  readonly vehicleSystemKey?: string;
  readonly characterItemId?: number;
  readonly characterPath?: string;
  /** LocalProfile.equipment: itemIds per category, kartSerial, systemKart… */
  readonly equipment?: unknown;
  /** LocalProfile.garage (kart parts) and initial (plate letters). */
  readonly garage?: unknown;
  readonly initial?: unknown;
}

/**
 * Categories the stage can wear: character (1), kart (3) and the equipment
 * the garage preview draws (garage-live-panel-assets syncGaragePreview:
 * paint 2, plate 4, goggle 8, balloon 9, headband 11, gloves 16, aura 26,
 * skid mark 27, flying pet 52, dye 70).
 */
export const SHOP_STAGE_CATEGORIES: ReadonlySet<number> =
  new Set([1, 3, 2, 4, 8, 9, 11, 16, 26, 27, 52, 70]);

/** A running stage on the backend: draws the rider into its canvas until disposed. */
export interface ShopStageSession {
  /** The items worn instead of the current equipment, at most one per category. */
  setTryOns(items: readonly ShopPreviewRequest[]): void;
  rotate(pixels: number): void;
  dispose(): void;
}

/** Draws snapshots for preview requests; created lazily, at most once. */
export interface ShopSnapshotBackend<Snapshot> {
  /**
   * Draws one item. Resolves undefined when the item has no picture and
   * rejects on failure; it stops early (without drawing) once signal aborts.
   */
  snapshot(request: ShopPreviewRequest, signal: AbortSignal): Promise<Snapshot | undefined>;
  /**
   * Starts drawing the rider into canvas (onFirstFrame once it is first
   * drawn); undefined when the rider cannot be shown.
   */
  attachStage?(canvas: HTMLCanvasElement, rider: ShopRiderSelection,
    onFirstFrame?: () => void): ShopStageSession | undefined;
  dispose(): void;
}

export interface ShopSnapshotPreviewOptions<Snapshot> {
  loadBackend(): Promise<ShopSnapshotBackend<Snapshot>>;
  /** Shows a snapshot inside host; returns the cleanup that removes it. */
  present(snapshot: Snapshot, host: HTMLElement, request: ShopPreviewRequest): () => void;
  /** Requests that are worth a backend at all (the rest keep the kind icon). */
  supports?(request: ShopPreviewRequest): boolean;
  /** A snapshot left the cache (eviction or dispose). */
  release?(snapshot: Snapshot): void;
  /** Snapshots (and remembered misses) kept at most; default 40. */
  cacheSize?: number;
  /** The rider for stage(); without it the shop shows no 3D rider. */
  rider?: ShopRiderSelection;
}

interface Job<Snapshot> {
  readonly abort: AbortController;
  readonly promise: Promise<Snapshot | null>;
  waiters: number;
}

export function shopPreviewKey(request: Pick<ShopPreviewRequest, "category" | "itemId" | "size">): string {
  return `${request.category}:${request.itemId}:${request.size}`;
}

/**
 * Shares one snapshot job per key between the cards that ask for it; a job
 * nobody waits for any more is aborted. Results (and misses, so a broken item
 * is not retried every page turn) are cached by key.
 */
export class ShopSnapshotPreview<Snapshot> implements ShopPreviewRenderer {
  private backend?: Promise<ShopSnapshotBackend<Snapshot>>;
  private readonly cache = new Map<string, Snapshot | null>();
  private readonly jobs = new Map<string, Job<Snapshot>>();
  private readonly cacheSize: number;
  private readonly stages = new Set<ShopStageHandle>();
  disposed = false;

  constructor(private readonly options: ShopSnapshotPreviewOptions<Snapshot>) {
    this.cacheSize = Math.max(1, Math.floor(options.cacheSize ?? 40));
  }

  /** Cached snapshots and misses, oldest first (for tests and diagnostics). */
  get cachedKeys(): string[] { return [...this.cache.keys()]; }
  get pendingKeys(): string[] { return [...this.jobs.keys()]; }

  async render(request: ShopPreviewRequest, host: HTMLElement,
    signal: AbortSignal): Promise<(() => void) | void> {
    if (this.disposed || signal.aborted) return;
    if (this.options.supports && !this.options.supports(request)) return;
    const key = shopPreviewKey(request);
    let snapshot: Snapshot | null | undefined;
    if (this.cache.has(key)) {
      snapshot = this.cache.get(key);
      // Most recently used last.
      this.cache.delete(key);
      this.cache.set(key, snapshot ?? null);
    } else {
      snapshot = await this.wait(key, request, signal);
    }
    if (snapshot === null || snapshot === undefined || this.disposed || signal.aborted) return;
    return this.options.present(snapshot, host, request);
  }

  /** The shop's 3D rider: a canvas in host drawn by the shared backend. */
  stage(host: HTMLElement): ShopStage | undefined {
    const rider = this.options.rider;
    if (this.disposed || !rider) return undefined;
    const canvas = host.ownerDocument.createElement("canvas");
    canvas.className = "ks-shop-stage-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);
    const stage = new ShopStageHandle(canvas, rider, this.loadBackend());
    this.stages.add(stage);
    return stage;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const stage of [...this.stages]) stage.dispose();
    this.stages.clear();
    const jobs = [...this.jobs.values()];
    this.jobs.clear();
    for (const job of jobs) job.abort.abort();
    for (const snapshot of this.cache.values()) if (snapshot !== null) this.release(snapshot);
    this.cache.clear();
    void this.backend?.then(backend => backend.dispose(), () => undefined);
  }

  private loadBackend(): Promise<ShopSnapshotBackend<Snapshot>> {
    this.backend ??= Promise.resolve().then(() => this.options.loadBackend());
    return this.backend;
  }

  /** Resolves the job's result, or undefined as soon as signal aborts. */
  private wait(key: string, request: ShopPreviewRequest,
    signal: AbortSignal): Promise<Snapshot | null | undefined> {
    const job = this.jobs.get(key) ?? this.start(key, request);
    job.waiters++;
    return new Promise(resolve => {
      let done = false;
      const leave = (value: Snapshot | null | undefined) => {
        if (done) return;
        done = true;
        signal.removeEventListener("abort", onAbort);
        job.waiters--;
        if (job.waiters === 0 && this.jobs.get(key) === job) {
          this.jobs.delete(key);
          job.abort.abort();
        }
        resolve(value);
      };
      const onAbort = () => leave(undefined);
      signal.addEventListener("abort", onAbort, { once: true });
      void job.promise.then(leave);
    });
  }

  private start(key: string, request: ShopPreviewRequest): Job<Snapshot> {
    const abort = new AbortController();
    let settle!: (value: Snapshot | null) => void;
    const promise = new Promise<Snapshot | null>(resolve => { settle = resolve; });
    const job: Job<Snapshot> = { abort, promise, waiters: 0 };
    const finish = (value: Snapshot | null) => {
      if (this.jobs.get(key) === job) this.jobs.delete(key);
      settle(value);
    };
    // Waiters never hang on a backend that ignores the abort.
    abort.signal.addEventListener("abort", () => finish(null), { once: true });
    this.jobs.set(key, job);
    this.loadBackend()
      .then(backend => abort.signal.aborted || this.disposed ? undefined
        : backend.snapshot(request, abort.signal))
      .then(snapshot => {
        if (this.disposed) {
          if (snapshot !== undefined) this.release(snapshot);
          return finish(null);
        }
        // Finished work is kept even if its cards left the page meanwhile.
        if (snapshot !== undefined) this.store(key, snapshot);
        else if (!abort.signal.aborted) this.store(key, null);
        finish(snapshot ?? null);
      }, () => {
        if (!this.disposed && !abort.signal.aborted) this.store(key, null);
        finish(null);
      });
    return job;
  }

  private store(key: string, snapshot: Snapshot | null): void {
    const previous = this.cache.get(key);
    this.cache.delete(key);
    if (previous !== undefined && previous !== null && previous !== snapshot) this.release(previous);
    this.cache.set(key, snapshot);
    while (this.cache.size > this.cacheSize) {
      const [oldest, value] = this.cache.entries().next().value as [string, Snapshot | null];
      this.cache.delete(oldest);
      if (value !== null) this.release(value);
    }
  }

  private release(snapshot: Snapshot): void {
    try { this.options.release?.(snapshot); } catch { /* Best effort. */ }
  }
}

/**
 * The stage the shop holds: try-ons are kept here (one per category) and
 * handed to the backend's session once it has loaded.
 */
export class ShopStageHandle implements ShopStage {
  private readonly tried = new Map<number, ShopPreviewRequest>();
  private session?: ShopStageSession;
  private disposed = false;
  /** Resolves when the backend first draws the rider (never, if it cannot). */
  readonly ready: Promise<void>;

  constructor(readonly canvas: HTMLCanvasElement, rider: ShopRiderSelection,
    backend: Promise<ShopSnapshotBackend<unknown>>) {
    let drawn!: () => void;
    this.ready = new Promise(resolve => { drawn = resolve; });
    void backend.then(loaded => {
      if (this.disposed) return;
      this.session = loaded.attachStage?.(canvas, rider, () => { if (!this.disposed) drawn(); });
      this.session?.setTryOns([...this.tried.values()]);
    }, () => undefined);
  }

  /** The items tried on, by category (for tests and diagnostics). */
  get tryOns(): ShopPreviewRequest[] { return [...this.tried.values()]; }

  tryOn(item: ShopPreviewRequest): boolean {
    if (this.disposed || !SHOP_STAGE_CATEGORIES.has(item.category) || !(item.itemId > 0)) return false;
    this.tried.set(item.category, item);
    this.push();
    return true;
  }

  takeOff(item: ShopPreviewRequest): void {
    const current = this.tried.get(item.category);
    if (!current || current.itemId !== item.itemId) return;
    this.tried.delete(item.category);
    this.push();
  }

  reset(): void {
    this.tried.clear();
    this.push();
  }

  rotate(pixels: number): void {
    if (Number.isFinite(pixels)) this.session?.rotate(pixels);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try { this.session?.dispose(); } catch { /* Best effort. */ }
    this.session = undefined;
    this.canvas.remove();
  }

  private push(): void {
    try { this.session?.setTryOns([...this.tried.values()]); } catch { /* The rider keeps its look. */ }
  }
}

/** A drawn garage card: device-pixel canvas plus its CSS size. */
export interface ShopPreviewSnapshot {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
}

/**
 * Item categories the garage draws as cards (garage-live-panel-assets.ts):
 * 1 character, 3 kart, and the equipment kinds with an equipment card loader
 * (flyingPet, balloon, goggle, headBand, handGearL, aura, skidMark, color,
 * dye, plate). Others (pets, uniforms, …) keep the kind icon.
 */
export const SHOP_PREVIEW_CATEGORIES: ReadonlySet<number> =
  new Set([1, 3, 52, 9, 8, 11, 16, 26, 27, 2, 70, 4]);

/** Copies a cached snapshot into its own 2D canvas inside host. */
export function presentShopSnapshot(snapshot: ShopPreviewSnapshot, host: HTMLElement): () => void {
  const canvas = host.ownerDocument.createElement("canvas");
  canvas.width = snapshot.canvas.width;
  canvas.height = snapshot.canvas.height;
  canvas.className = "ks-shop-preview";
  canvas.dataset.shopPreview = "garage";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.width = `${snapshot.width}px`;
  canvas.style.height = `${snapshot.height}px`;
  canvas.style.pointerEvents = "none";
  const context = canvas.getContext("2d");
  if (!context) throw new Error("商店预览缺少 2D 画布。");
  context.drawImage(snapshot.canvas, 0, 0);
  host.append(canvas);
  return () => {
    canvas.remove();
    canvas.width = 0;
    canvas.height = 0;
  };
}

/**
 * The shop's previews over the resource library: nothing loads until a
 * supported card is visible; the garage renderer module and three.js scene
 * code stay in a lazily loaded chunk. Dispose it when the shop closes.
 */
export function createShopPreview(library: unknown,
  rider?: ShopRiderSelection): ShopSnapshotPreview<ShopPreviewSnapshot> {
  return new ShopSnapshotPreview<ShopPreviewSnapshot>({
    ...(rider ? { rider } : {}),
    loadBackend: async () => (await import("./shop-preview-garage")).loadGarageShopPreview(library),
    present: presentShopSnapshot,
    supports: request => SHOP_PREVIEW_CATEGORIES.has(request.category) && request.itemId > 0,
    release: snapshot => {
      snapshot.canvas.width = 0;
      snapshot.canvas.height = 0;
    },
    cacheSize: 40,
  });
}
