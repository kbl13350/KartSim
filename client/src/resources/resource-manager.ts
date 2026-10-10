import type { ContainerProgress } from "./container-store";
import { buildResourceGroups, findResourceGroup, trackThemeOf, type ResourceFileSpec, type ResourceGroup,
  type Rho5PackSpec } from "./resource-groups";

/**
 * Downloads of resource groups (resource-groups.ts) into the container
 * store's OPFS cache: a queue shared by
 *
 *  - priority loading (首页 before the home screen opens),
 *  - passive downloads when a page opens (小屋, 商城, a race's track…:
 *    `ensureFeature`), and
 *  - active downloads from the 资源下载 panel.
 *
 * Containers download three at a time, the highest priority first; a
 * container wanted by several jobs downloads once. Pages still read any
 * container on demand (the store downloads it then), so a cancelled or
 * failed job never breaks a page.
 */

/** What the manager needs of the container store. */
export interface ResourceStoreApi {
  list(): readonly ResourceFileSpec[];
  ensure(name: string): Promise<unknown>;
  cachedNames(): Promise<Set<string>>;
  remove(name: string): Promise<boolean>;
  addProgressListener(listener: (progress: ContainerProgress) => void): () => void;
}

/** The resource library's directory lookup (which containers hold a track). */
export interface ResourceLibraryApi {
  entriesUnderCanonicalPrefix(prefix: string): ReadonlyArray<{ readonly sourceName: string }>;
}

export type DownloadPriority = "high" | "normal" | "low";
const PRIORITY: Record<DownloadPriority, number> = { high: 2, normal: 1, low: 0 };

export type JobState = "queued" | "running" | "done" | "failed" | "cancelled";

export interface DownloadJob {
  readonly id: number;
  readonly label: string;
  readonly groupId?: string;
  readonly totalBytes: number;
  readonly priority: DownloadPriority;
  state: JobState;
  error?: string;
  /** Bytes of the job's containers already in the cache or downloaded. */
  doneBytes(): number;
  /** Resolves when every container is in the cache; rejects on a failure or cancel. */
  readonly done: Promise<void>;
  cancel(): void;
}

export type GroupState = "complete" | "partial" | "none";

export interface GroupStatus {
  readonly totalBytes: number;
  readonly cachedBytes: number;
  /** Cached plus the downloaded part of containers in flight. */
  readonly progressBytes: number;
  readonly state: GroupState;
  readonly downloading: boolean;
  readonly queued: boolean;
}

/** The pages that start passive downloads, and what they need first. */
export interface FeatureNeed {
  readonly title: string;
  /** Downloaded before the page opens (with a progress window). */
  readonly required: readonly string[];
  /** Groups downloaded in the background once the page is open. */
  readonly background: readonly string[];
}

export const FEATURES: Readonly<Record<string, FeatureNeed>> = {
  myroom: { title: "小屋", required: ["myRoom.rho", "stage_myRoom.rho", "theme_village.rho"],
    background: ["myroom"] },
  shop: { title: "商城", required: ["stage_mqShop.rho", "dialog2_buyItem.rho", "stuff2_slotBG.rho"],
    background: ["shop", "karts"] },
  garage: { title: "车库", required: ["stage_garageX.rho", "stage_tuning.rho", "stage_kartune.rho"],
    background: ["garage"] },
  multiplayer: { title: "多人游戏", required: ["stage_mqReady.rho", "stage_globalChatSystem.rho",
    "dialog2_createRoom.rho", "dialog2_createRoomEx.rho"], background: ["multiplayer", "race"] },
  story: { title: "剧情", required: ["stage_scenarioSelect.rho", "stage_scenarioReady.rho"],
    background: ["story"] },
  license: { title: "驾照考试", required: ["stage_riderSchoolSelect.rho", "stage_riderSchoolReady.rho"],
    background: ["race"] },
  club: { title: "俱乐部", required: ["stage_clubMain.rho", "stage_clubList.rho"], background: ["club"] },
  lottery: { title: "活动", required: ["stage_treasureHunt.rho", "stage_gachaUse.rho"],
    background: ["activities"] },
};

let nextJobId = 0;

interface QueueItem {
  name: string;
  size: number;
  priority: number;
  jobs: Set<Job>;
  running: boolean;
}

class Job implements DownloadJob {
  readonly id = ++nextJobId;
  state: JobState = "queued";
  error?: string;
  readonly done: Promise<void>;
  resolve!: () => void;
  reject!: (error: Error) => void;
  readonly pending = new Set<string>();

  constructor(readonly manager: ResourceManager, readonly label: string, readonly containers: readonly string[],
    readonly totalBytes: number, readonly priority: DownloadPriority, readonly groupId?: string) {
    this.done = new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    // A caller that ignores the result must not see an unhandled rejection.
    this.done.catch(() => undefined);
  }

  doneBytes(): number {
    return this.manager.bytesDone(this.containers);
  }

  cancel(): void {
    this.manager.cancelJob(this);
  }
}

export class ResourceManager {
  readonly groups: readonly ResourceGroup[];
  private readonly sizes: Map<string, number>;
  private readonly cached = new Set<string>();
  private readonly loading = new Map<string, number>();
  private readonly queue: QueueItem[] = [];
  private readonly jobs = new Set<Job>();
  private readonly listeners = new Set<() => void>();
  private readonly failures = new Map<string, string>();
  private running = 0;
  private notifyQueued = false;
  readonly ready: Promise<void>;

  constructor(readonly store: ResourceStoreApi, packs: readonly Rho5PackSpec[],
    readonly library?: ResourceLibraryApi, readonly concurrency = 3) {
    const files = store.list();
    this.sizes = new Map(files.map(file => [file.name, file.size]));
    this.groups = buildResourceGroups(files, packs);
    store.addProgressListener(progress => this.onProgress(progress));
    this.ready = store.cachedNames().then(names => {
      for (const name of names) this.cached.add(name);
      this.changed();
    }).catch(error => console.warn("资源缓存状态读取失败", error));
  }

  /** Re-read which containers the cache holds (after the browser may have evicted some). */
  async refresh(): Promise<void> {
    const names = await this.store.cachedNames();
    this.cached.clear();
    for (const name of names) this.cached.add(name);
    this.changed();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  group(id: string): ResourceGroup | undefined {
    return findResourceGroup(this.groups, id);
  }

  isCached(name: string): boolean {
    return this.cached.has(name);
  }

  bytesDone(containers: readonly string[]): number {
    let bytes = 0;
    for (const name of containers) {
      bytes += this.cached.has(name) ? this.sizes.get(name) ?? 0 : this.loading.get(name) ?? 0;
    }
    return bytes;
  }

  status(id: string): GroupStatus {
    const group = this.group(id);
    if (!group) return { totalBytes: 0, cachedBytes: 0, progressBytes: 0, state: "none", downloading: false,
      queued: false };
    let cachedBytes = 0;
    let downloading = false;
    let queued = false;
    for (const name of group.containers) {
      if (this.cached.has(name)) cachedBytes += this.sizes.get(name) ?? 0;
      else if (this.loading.has(name)) downloading = true;
    }
    const names = new Set(group.containers);
    for (const item of this.queue) if (names.has(item.name)) queued = true;
    const state: GroupState = cachedBytes >= group.bytes ? "complete" : cachedBytes > 0 ? "partial" : "none";
    return { totalBytes: group.bytes, cachedBytes, progressBytes: this.bytesDone(group.containers), state,
      downloading, queued: queued || downloading };
  }

  /** Bytes the cache holds of all containers, and the total. */
  totals(): { cachedBytes: number; totalBytes: number } {
    let cachedBytes = 0;
    let totalBytes = 0;
    for (const [name, size] of this.sizes) {
      totalBytes += size;
      if (this.cached.has(name)) cachedBytes += size;
    }
    return { cachedBytes, totalBytes };
  }

  activeJobs(): DownloadJob[] {
    return [...this.jobs].filter(job => job.state === "queued" || job.state === "running");
  }

  /** The containers being downloaded now, with their progress. */
  inFlight(): Array<{ name: string; loadedBytes: number; totalBytes: number }> {
    return [...this.loading].map(([name, loadedBytes]) => ({ name, loadedBytes,
      totalBytes: this.sizes.get(name) ?? 0 }));
  }

  /** Download a group (or its missing containers). */
  downloadGroup(id: string, priority: DownloadPriority = "normal", label?: string): DownloadJob {
    const group = this.group(id);
    if (!group) throw new Error(`没有资源分类 ${id}。`);
    return this.download(group.containers, { label: label ?? group.title, priority, groupId: id });
  }

  download(containers: Iterable<string>, options: { label: string; priority?: DownloadPriority;
    groupId?: string }): DownloadJob {
    const names = [...new Set(containers)].filter(name => this.sizes.has(name));
    const priority = options.priority ?? "normal";
    const job = new Job(this, options.label, names, names.reduce((sum, name) => sum + (this.sizes.get(name) ?? 0), 0),
      priority, options.groupId);
    this.jobs.add(job);
    for (const name of names) {
      if (this.cached.has(name)) continue;
      job.pending.add(name);
      let item = this.queue.find(entry => entry.name === name);
      if (!item) {
        item = { name, size: this.sizes.get(name) ?? 0, priority: PRIORITY[priority], jobs: new Set(), running: false };
        this.queue.push(item);
      }
      item.priority = Math.max(item.priority, PRIORITY[priority]);
      item.jobs.add(job);
    }
    if (!job.pending.size) this.finishJob(job);
    else this.pump();
    this.changed();
    return job;
  }

  /** Stop a job: its containers not yet started leave the queue. */
  cancelJob(job: Job): void {
    if (job.state !== "queued" && job.state !== "running") return;
    job.state = "cancelled";
    for (let index = this.queue.length - 1; index >= 0; index--) {
      const item = this.queue[index]!;
      item.jobs.delete(job);
      if (!item.jobs.size && !item.running) this.queue.splice(index, 1);
      else if (item.jobs.size) item.priority = Math.max(...[...item.jobs].map(entry => PRIORITY[entry.priority]));
    }
    job.reject(new Error("CANCELLED"));
    this.jobs.delete(job);
    this.changed();
  }

  /** Cancel every job of a group. */
  cancelGroup(id: string): void {
    for (const job of [...this.jobs]) if (job.groupId === id) job.cancel();
  }

  /**
   * Delete a group's cached containers to free space, except the 首页
   * ones and those another wanted group still needs in this session.
   * Returns the bytes freed.
   */
  async removeGroup(id: string): Promise<number> {
    const group = this.group(id);
    if (!group || group.required) return 0;
    this.cancelGroup(id);
    let freed = 0;
    for (const name of this.removable(group)) {
      if (await this.store.remove(name)) freed += this.sizes.get(name) ?? 0;
      this.cached.delete(name);
    }
    this.changed();
    return freed;
  }

  /** The bytes removeGroup would free now. */
  removableBytes(id: string): number {
    const group = this.group(id);
    return group && !group.required ? this.bytesOf(this.removable(group)) : 0;
  }

  /** A group's cached containers that 首页 does not need and no download holds. */
  private removable(group: ResourceGroup): string[] {
    const keep = new Set(this.groups.filter(entry => entry.required).flatMap(entry => entry.containers));
    return group.containers.filter(name => !keep.has(name) && this.cached.has(name) && !this.loading.has(name));
  }

  /** The containers a page needs first and in the background (FEATURES). */
  featureContainers(feature: string): { required: string[]; background: string[] } {
    const need = FEATURES[feature];
    if (!need) return { required: [], background: [] };
    const required = need.required.filter(name => this.sizes.has(name));
    const background = need.background.flatMap(id => this.group(id)?.containers ?? []);
    return { required, background };
  }

  /**
   * What a race on one track needs, downloaded when the race loads (not
   * ahead): the track's own containers, its theme's textures and music, and
   * the race basics (比赛通用).
   */
  raceContainers(track: string): string[] {
    const id = (track.replace(/^.*?track_\//, "").split("/")[0] ?? "").replace(/_rvs$/i, "");
    const theme = trackThemeOf(id);
    let own: string[] = [];
    try {
      own = this.library?.entriesUnderCanonicalPrefix(`track_/${id}`).map(entry => entry.sourceName) ?? [];
    } catch { /* Unknown track: its theme and the basics still help. */ }
    const extras = (theme ? this.group(`track:${theme}`)?.containers ?? [] : [])
      .filter(name => /^(theme_|sound_bgm_)/i.test(name));
    return [...new Set([...own, ...extras, ...(this.group("race")?.containers ?? [])])]
      .filter(name => this.sizes.has(name));
  }

  missing(containers: Iterable<string>): string[] {
    return [...new Set(containers)].filter(name => this.sizes.has(name) && !this.cached.has(name));
  }

  bytesOf(containers: Iterable<string>): number {
    let bytes = 0;
    for (const name of new Set(containers)) bytes += this.sizes.get(name) ?? 0;
    return bytes;
  }

  lastFailure(): string | undefined {
    return [...this.failures.values()].at(-1);
  }

  private onProgress(progress: ContainerProgress): void {
    const name = this.canonical(progress.file);
    if (!name) return;
    if (progress.phase === "downloading") {
      this.loading.set(name, progress.loadedBytes);
      this.changedSoon();
    } else if (progress.phase === "ready") {
      const changed = !this.cached.has(name) || this.loading.has(name);
      this.loading.delete(name);
      this.cached.add(name);
      if (changed) this.changedSoon();
    }
  }

  private canonical(file: string): string | undefined {
    if (this.sizes.has(file)) return file;
    const lower = file.toLowerCase();
    for (const name of this.sizes.keys()) if (name.toLowerCase() === lower) return name;
    return undefined;
  }

  private pump(): void {
    while (this.running < this.concurrency) {
      const waiting = this.queue.filter(item => !item.running);
      if (!waiting.length) return;
      waiting.sort((a, b) => b.priority - a.priority);
      const item = waiting[0]!;
      item.running = true;
      for (const job of item.jobs) if (job.state === "queued") job.state = "running";
      this.running++;
      void this.store.ensure(item.name).then(() => {
        this.cached.add(item.name);
        this.loading.delete(item.name);
        this.failures.delete(item.name);
        this.settle(item, undefined);
      }, error => {
        this.loading.delete(item.name);
        const message = error instanceof Error ? error.message : String(error);
        this.failures.set(item.name, message);
        this.settle(item, message);
      });
    }
  }

  private settle(item: QueueItem, error: string | undefined): void {
    this.running--;
    const index = this.queue.indexOf(item);
    if (index >= 0) this.queue.splice(index, 1);
    for (const job of item.jobs) {
      job.pending.delete(item.name);
      if (error && job.state !== "failed") {
        job.state = "failed";
        job.error = error;
        job.reject(new Error(error));
        this.jobs.delete(job);
        // Its other containers leave the queue unless another job wants them.
        for (let other = this.queue.length - 1; other >= 0; other--) {
          const entry = this.queue[other]!;
          entry.jobs.delete(job);
          if (!entry.jobs.size && !entry.running) this.queue.splice(other, 1);
        }
      } else if (!job.pending.size && job.state !== "failed" && job.state !== "cancelled") {
        this.finishJob(job);
      }
    }
    this.changed();
    this.pump();
  }

  private finishJob(job: Job): void {
    job.state = "done";
    job.resolve();
    // Finished jobs stay listed a moment for the panel, then go.
    setTimeout(() => {
      this.jobs.delete(job);
      this.changed();
    }, 1_500);
  }

  private changedSoon(): void {
    if (this.notifyQueued) return;
    this.notifyQueued = true;
    setTimeout(() => {
      this.notifyQueued = false;
      this.changed();
    }, 200);
  }

  private changed(): void {
    for (const listener of [...this.listeners]) {
      try { listener(); } catch (error) { console.error(error); }
    }
  }
}

let current: ResourceManager | undefined;
const installListeners = new Set<(manager: ResourceManager | undefined) => void>();

/** The manager of the loaded resources (set at startup). */
export function currentResourceManager(): ResourceManager | undefined {
  return current;
}

export function installResourceManager(store: ResourceStoreApi, packs: readonly Rho5PackSpec[],
  library?: ResourceLibraryApi): ResourceManager {
  current = new ResourceManager(store, packs, library);
  for (const listener of installListeners) listener(current);
  return current;
}

/**
 * Downloads what a race on this track needs while the race loads
 * (raceContainers); a failure leaves the race to read on demand.
 */
export async function downloadRaceTrack(track: string | undefined): Promise<void> {
  const manager = current;
  if (!manager || !track) return;
  const containers = manager.raceContainers(track);
  if (!manager.missing(containers).length) return;
  await manager.download(containers, { label: "本局赛道资源", priority: "high" }).done.catch(() => undefined);
}

/** Called when a manager is installed (the panel button appears then). */
export function onResourceManager(listener: (manager: ResourceManager | undefined) => void): () => void {
  installListeners.add(listener);
  return () => { installListeners.delete(listener); };
}
