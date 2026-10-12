import { browserFetch, type ContainerSpec, type ResourceFetch, type ResourceManifest } from "./manifest";
import { sha256Blob } from "./sha256";

/**
 * "partial" reports range requests for reads from containers that are not
 * cached (they stay uncached): `file` is the container of the latest
 * bytes, the byte counts cover all range requests in flight together (they
 * start from zero again once none is).
 */
export type DownloadPhase = "checking" | "downloading" | "ready" | "partial";

export interface ContainerProgress {
  readonly phase: DownloadPhase;
  readonly file: string;
  readonly loadedBytes: number;
  readonly totalBytes: number;
  /** A whole-container download nobody waits for (the resource manager's low-priority jobs). */
  readonly background?: boolean;
}

// Small structural interfaces let tests substitute in-memory OPFS handles.
export interface WritableHandle {
  write(chunk: Uint8Array): Promise<void>;
  /** Moves the write position (OPFS); without it paused downloads start over. */
  seek?(position: number): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface FileHandle {
  getFile(): Promise<Blob>;
  createWritable?(options?: { keepExistingData?: boolean }): Promise<WritableHandle>;
}

/**
 * A background download stopped by pauseBackground(). The bytes it wrote
 * stay in OPFS (shorter than the container, so it does not count as
 * cached), and the next download of the container resumes after them.
 */
export class DownloadPausedError extends Error {
  override readonly name = "DownloadPausedError";
}

export interface DirectoryHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
  removeEntry?(name: string): Promise<void>;
  /** OPFS lists its entries; stores without it check each container instead. */
  keys?(): AsyncIterable<string>;
}

export interface OpfsStorage {
  getDirectory(): Promise<DirectoryHandle>;
  estimate?(): Promise<{ quota?: number; usage?: number }>;
  persist?(): Promise<boolean>;
}

/**
 * Containers packaged next to the game (the Switch build reads them from the
 * SD card, src/platform/bundled-archives.ts): every container counts as
 * cached, reads go to the reader, and nothing is downloaded or kept in OPFS.
 */
export interface BundledArchiveReader {
  /** Bytes start..end (end exclusive) of a container. */
  read(name: string, start: number, end: number): Promise<ArrayBuffer>;
}

export interface ArchiveSource {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  slice(start?: number, end?: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

export interface ContainerStoreOptions {
  readonly manifest: ResourceManifest;
  readonly dataBaseUrl?: string;
  readonly fetcher?: ResourceFetch;
  readonly storage?: OpfsStorage;
  /** Optional user-selected Data directory; files must match size and SHA-256. */
  readonly localDirectory?: DirectoryHandle;
  readonly onProgress?: (progress: ContainerProgress) => void;
  /** A browser-specific writer can handle OPFS implementations without createWritable(). */
  readonly fallbackWriter?: (file: ContainerSpec, url: string, progress: (bytes: number) => void) => Promise<void>;
  /**
   * Read containers that are not cached with HTTP Range requests (only the
   * bytes a read needs) instead of downloading them whole first. Default
   * true; a server that answers a Range request with the whole file turns it
   * off for the session.
   */
  readonly rangeReads?: boolean;
  /** Read packaged containers instead of downloading them (see BundledArchiveReader). */
  readonly bundled?: BundledArchiveReader;
}

/**
 * Range reads fetch aligned blocks of this size; the reads of one moment on
 * one container are planned together, and their missing blocks closer than
 * RANGE_MERGE_GAP blocks share a request. 32 KiB blocks bring the startup
 * reads (about 33 MiB of the 870 MiB of containers they touch) to about 40
 * MiB in 260 requests.
 */
const RANGE_BLOCK = 32 * 1024;
const RANGE_MERGE_GAP = 4;
/** Memory kept for fetched blocks (the startup prefetch is about 40 MiB); the least recently used go first. */
const RANGE_CACHE_BYTES = 96 * 1024 * 1024;
/** Containers this small download whole on the first read (one request, kept in OPFS). */
const WHOLE_CONTAINER_BYTES = 1024 * 1024;
/**
 * Bundled reads this large go straight to the reader; smaller ones share the
 * block planner and cache, which turns a decoder's many small reads of one
 * moment into a few reads of the card.
 */
const BUNDLED_DIRECT_BYTES = 512 * 1024;

/** The server sent the whole container for a Range request. */
class RangeUnsupportedError extends Error {}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  // A batch whose other block failed first has nobody left to see this one fail.
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}

/** Bundled containers never touch OPFS (Brewser has none). */
const BUNDLED_STORAGE: OpfsStorage = {
  getDirectory: () => Promise.reject(new Error("内置资源不使用 OPFS。")),
};

function defaultStorage(): OpfsStorage {
  const storage = globalThis.navigator?.storage;
  if (!storage || typeof storage.getDirectory !== "function") {
    throw new Error("当前浏览器不支持 OPFS，无法保存游戏资源容器。");
  }
  return storage as OpfsStorage;
}

function safeRange(start: number, end: number, size: number): void {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || end < start || end > size) {
    throw new RangeError(`资源读取范围无效：${start}–${end}，容器大小 ${size}。`);
  }
}

/** Revision-isolated, lazy OPFS cache for the physical archive containers. */
export class ContainerStore {
  readonly manifest: ResourceManifest;
  private readonly baseUrl: string;
  private readonly fetcher: ResourceFetch;
  private readonly storage: OpfsStorage;
  private readonly localDirectory?: DirectoryHandle;
  private readonly bundled?: BundledArchiveReader;
  private readonly onProgress?: (progress: ContainerProgress) => void;
  private readonly fallbackWriter?: ContainerStoreOptions["fallbackWriter"];
  private readonly byName: Map<string, ContainerSpec>;
  private readonly inFlight = new Map<string, Promise<Blob>>();
  /** In-flight whole downloads that nobody waits for (their progress says background). */
  private readonly backgroundLoads = new Set<string>();
  /** Stops an in-flight whole download (pauseBackground). */
  private readonly loadControllers = new Map<string, AbortController>();
  private readonly listeners = new Set<(progress: ContainerProgress) => void>();
  private directoryPromise?: Promise<DirectoryHandle>;
  private rangeReads: boolean;
  /** Containers known to be whole in OPFS, and the first OPFS look of the others. */
  private readonly complete = new Set<string>();
  private readonly presence = new Map<string, Promise<boolean>>();
  /** Fetched and in-flight blocks by "container#index"; the sizes of fetched ones in LRU order. */
  private readonly blocks = new Map<string, Promise<Uint8Array>>();
  private readonly blockBytes = new Map<string, number>();
  private cachedBlockBytes = 0;
  private readonly planned = new Map<string, { file: ContainerSpec; blocks: Map<number, Deferred<Uint8Array>> }>();
  private flushTimer?: ReturnType<typeof setTimeout>;
  /** Range requests in flight and their bytes requested and received (the "partial" progress). */
  private rangeRequests = 0;
  private rangeRequested = 0;
  private rangeReceived = 0;

  constructor(options: ContainerStoreOptions) {
    this.manifest = options.manifest;
    this.baseUrl = (options.dataBaseUrl ?? `/${options.manifest.version}`).replace(/\/$/, "");
    this.fetcher = options.fetcher ?? browserFetch;
    this.bundled = options.bundled;
    this.storage = options.storage ?? (options.bundled ? BUNDLED_STORAGE : defaultStorage());
    this.localDirectory = options.localDirectory;
    this.onProgress = options.onProgress;
    this.fallbackWriter = options.fallbackWriter;
    this.rangeReads = options.rangeReads ?? true;
    this.byName = new Map(options.manifest.files.map(file => [file.name.toLowerCase(), file]));
  }

  list(): readonly ContainerSpec[] { return this.manifest.files; }

  /** Whether the containers are packaged with the game (nothing to download). */
  get isBundled(): boolean { return this.bundled !== undefined; }

  spec(name: string): ContainerSpec {
    const file = this.byName.get(name.toLowerCase());
    if (!file) throw new Error(`资源清单内找不到容器 ${name}。`);
    return file;
  }

  /** Exposes the Blob-like API expected by the archive codecs. */
  source(name: string): ArchiveSource {
    const file = this.spec(name);
    return {
      name: file.name,
      size: file.size,
      arrayBuffer: () => this.readRange(file.name, 0, file.size),
      slice: (start = 0, end = file.size) => ({
        arrayBuffer: () => this.readRange(file.name, start, end),
      }),
    };
  }

  /**
   * A cached container is read from OPFS. Of one that is not, a large one
   * fetches only the blocks the read needs (HTTP Range) and stays uncached
   * (the resource manager downloads containers whole); a small one, or a
   * read of half a container or more, downloads the container whole first.
   */
  async readRange(name: string, start: number, end: number): Promise<ArrayBuffer> {
    const file = this.spec(name);
    safeRange(start, end, file.size);
    const log = (globalThis as { __KART_READ_LOG__?: unknown }).__KART_READ_LOG__;
    if (Array.isArray(log)) log.push([file.name, start, end, performance.now()]);
    if (this.bundled) {
      return this.readsByRange(file, start, end)
        ? this.readBlocks(file, start, end)
        : this.readBundled(file, start, end).then(bytes => bytes.buffer as ArrayBuffer);
    }
    if (this.readsByRange(file, start, end) && !(await this.isComplete(file))) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.readBlocks(file, start, end);
        } catch (error) {
          if (error instanceof RangeUnsupportedError) break;
          if (attempt > 0) throw error;
        }
      }
    }
    let blob = await this.ensure(file.name);
    try {
      return await blob.slice(start, end).arrayBuffer();
    } catch (error) {
      // A browser may evict or clear an OPFS file after getFile() (NotReadableError,
      // or NotFoundError once the entry is gone): download it again, once.
      if (!(error instanceof DOMException) || (error.name !== "NotReadableError" && error.name !== "NotFoundError"))
        throw error;
      this.forget(file.name.toLowerCase());
      try { await (await this.directory()).removeEntry?.(file.name); } catch { /* Already gone. */ }
      blob = await this.ensure(file.name);
      return blob.slice(start, end).arrayBuffer();
    }
  }

  /**
   * Fetches byte ranges ahead of their reads, all at once (the startup read
   * list, resources/startup-reads.ts): the blocks of containers read by
   * range go to the block cache; a small or mostly-read container downloads
   * whole. Cached containers are skipped; failures are left to the reads.
   */
  async prefetch(ranges: Readonly<Record<string, ReadonlyArray<readonly [number, number]>>>): Promise<void> {
    if (!this.rangeReads) return;
    const pending: Promise<unknown>[] = [];
    await Promise.all(Object.entries(ranges).map(async ([name, list]) => {
      const file = this.byName.get(name.toLowerCase());
      if (!file || !list.length || await this.isComplete(file)) return;
      const bytes = list.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
      // Bundled containers have nothing to download; their large reads go direct.
      if (this.bundled && !this.readsByRange(file, 0, bytes)) return;
      if (!this.readsByRange(file, 0, bytes)) {
        pending.push(this.ensure(file.name));
        return;
      }
      const key = file.name.toLowerCase();
      for (const [start, end] of list) {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > file.size ||
            start >= end) continue;
        for (let index = Math.floor(start / RANGE_BLOCK); index <= Math.floor((end - 1) / RANGE_BLOCK); index++)
          pending.push(this.block(file, key, index));
      }
    }));
    await Promise.allSettled(pending);
  }

  async preload(names: Iterable<string>, concurrency = 3): Promise<void> {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new RangeError("预加载并发数必须是正整数。");
    }
    if (this.bundled) {
      for (const name of names) this.spec(name);
      return;
    }
    const files = [...new Map([...names].map(name => {
      const file = this.spec(name);
      return [file.name.toLowerCase(), file] as const;
    })).values()];
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const file = files[next++];
        if (file) await this.ensure(file.name);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  }

  /** Also report progress to listener (the resource download panel); returns the removal. */
  addProgressListener(listener: (progress: ContainerProgress) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * The containers whose OPFS copy is complete (length as in the manifest).
   * Containers read from the local Data directory are not in OPFS and are
   * not listed.
   */
  async cachedNames(): Promise<Set<string>> {
    if (this.bundled) return new Set(this.manifest.files.map(file => file.name));
    const directory = await this.directory();
    const cached = new Set<string>();
    const check = async (file: ContainerSpec) => {
      const blob = await this.existing(directory, file.name);
      if (blob?.size === file.size) cached.add(file.name);
    };
    if (directory.keys) {
      const present = new Set<string>();
      for await (const key of directory.keys()) present.add(key.toLowerCase());
      await Promise.all(this.manifest.files.filter(file => present.has(file.name.toLowerCase())).map(check));
    } else {
      await Promise.all(this.manifest.files.map(check));
    }
    return cached;
  }

  /**
   * Deletes the OPFS copy of a container (to free space); the next read
   * downloads it again. Returns whether a copy was removed.
   */
  async remove(name: string): Promise<boolean> {
    const file = this.spec(name);
    if (this.bundled) return false;
    const directory = await this.directory();
    this.forget(file.name.toLowerCase());
    if (!(await this.existing(directory, file.name))) return false;
    await directory.removeEntry?.(file.name);
    return true;
  }

  /**
   * Downloads a container whole into OPFS (or finds it there). A background
   * download reports its progress with `background` until a foreground
   * caller wants the same container.
   */
  async ensure(name: string, options: { background?: boolean } = {}): Promise<Blob> {
    const file = this.spec(name);
    if (this.bundled) return this.bundledBlob(file);
    const key = file.name.toLowerCase();
    let pending = this.inFlight.get(key);
    if (!pending) {
      if (options.background) this.backgroundLoads.add(key);
      this.progress("checking", file, 0);
      const controller = new AbortController();
      this.loadControllers.set(key, controller);
      pending = this.load(file, controller.signal).finally(() => {
        if (this.loadControllers.get(key) === controller) this.loadControllers.delete(key);
      });
      this.inFlight.set(key, pending);
    } else if (!options.background) {
      this.backgroundLoads.delete(key);
    }
    try {
      const blob = await pending;
      // A background load stays marked (its "ready" too) until a foreground caller asks.
      if (!this.complete.has(key)) {
        this.complete.add(key);
        this.dropBlocks(key);
      }
      this.progress("ready", file, file.size);
      return blob;
    } catch (error) {
      this.backgroundLoads.delete(key);
      this.inFlight.delete(key);
      throw error;
    }
  }

  /**
   * Stops the whole downloads only background callers wait for: they reject
   * with DownloadPausedError and keep what they wrote, for a later resume.
   */
  pauseBackground(): void {
    for (const key of this.backgroundLoads) this.loadControllers.get(key)?.abort();
  }

  /** Whether reads of this part of the container go by HTTP Range. */
  private readsByRange(file: ContainerSpec, start: number, end: number): boolean {
    if (this.bundled) return end - start < BUNDLED_DIRECT_BYTES;
    return this.rangeReads && !this.localDirectory && file.size > WHOLE_CONTAINER_BYTES &&
      (end - start) * 2 < file.size;
  }

  /** Whether OPFS holds the whole container (looked up once, then known from downloads). */
  private isComplete(file: ContainerSpec): Promise<boolean> {
    const key = file.name.toLowerCase();
    if (this.complete.has(key)) return Promise.resolve(true);
    let check = this.presence.get(key);
    if (!check) {
      check = this.directory()
        .then(directory => this.existing(directory, file.name))
        .then(blob => blob?.size === file.size, () => false);
      this.presence.set(key, check);
    }
    return check;
  }

  /** The container is gone from OPFS (removed or cleared by the browser). */
  private forget(key: string): void {
    this.inFlight.delete(key);
    this.complete.delete(key);
    this.presence.delete(key);
  }

  private async readBlocks(file: ContainerSpec, start: number, end: number): Promise<ArrayBuffer> {
    const out = new Uint8Array(end - start);
    if (end === start) return out.buffer;
    const key = file.name.toLowerCase();
    const first = Math.floor(start / RANGE_BLOCK);
    const last = Math.floor((end - 1) / RANGE_BLOCK);
    const pending: Promise<Uint8Array>[] = [];
    for (let index = first; index <= last; index++) pending.push(this.block(file, key, index));
    const blocks = await Promise.all(pending);
    blocks.forEach((block, offset) => {
      const blockStart = (first + offset) * RANGE_BLOCK;
      const from = Math.max(start, blockStart);
      const to = Math.min(end, blockStart + block.length);
      out.set(block.subarray(from - blockStart, to - blockStart), from - start);
    });
    return out.buffer;
  }

  /** A block of a container: cached, in flight, or planned for the next request batch. */
  private block(file: ContainerSpec, key: string, index: number): Promise<Uint8Array> {
    const id = `${key}#${index}`;
    const known = this.blocks.get(id);
    if (known) {
      const bytes = this.blockBytes.get(id);
      if (bytes !== undefined) {
        this.blockBytes.delete(id);
        this.blockBytes.set(id, bytes);
      }
      return known;
    }
    let plan = this.planned.get(key);
    if (!plan) this.planned.set(key, plan = { file, blocks: new Map() });
    const wanted = deferred<Uint8Array>();
    plan.blocks.set(index, wanted);
    this.blocks.set(id, wanted.promise);
    // A macrotask gathers the reads a decoder starts together (a stage's panels and textures).
    this.flushTimer ??= setTimeout(() => this.requestPlanned(), 0);
    return wanted.promise;
  }

  private requestPlanned(): void {
    this.flushTimer = undefined;
    const plans = [...this.planned.values()];
    this.planned.clear();
    for (const { file, blocks } of plans) {
      const indexes = [...blocks.keys()].sort((a, b) => a - b);
      let runStart = 0;
      for (let next = 1; next <= indexes.length; next++) {
        if (next < indexes.length && indexes[next]! - indexes[next - 1]! <= RANGE_MERGE_GAP + 1) continue;
        void this.fetchBlocks(file, indexes[runStart]!, indexes[next - 1]!, blocks);
        runStart = next;
      }
    }
  }

  /** One Range request for blocks first..last; blocks between wanted ones are kept too. */
  private async fetchBlocks(file: ContainerSpec, first: number, last: number,
    wanted: Map<number, Deferred<Uint8Array>>): Promise<void> {
    const key = file.name.toLowerCase();
    const start = first * RANGE_BLOCK;
    try {
      const bytes = await this.fetchRange(file, start, Math.min(file.size, (last + 1) * RANGE_BLOCK));
      for (let index = first; index <= last; index++) {
        const id = `${key}#${index}`;
        const offset = (index - first) * RANGE_BLOCK;
        const block = bytes.subarray(offset, Math.min(bytes.length, offset + RANGE_BLOCK));
        const request = wanted.get(index);
        if (request) request.resolve(block);
        else if (!this.blocks.has(id)) this.blocks.set(id, Promise.resolve(block));
        else continue;
        // A container that finished downloading meanwhile keeps no blocks.
        if (this.blocks.has(id) && !this.complete.has(key)) {
          this.blockBytes.set(id, block.length);
          this.cachedBlockBytes += block.length;
        } else {
          this.blocks.delete(id);
        }
      }
      for (const [id, size] of this.blockBytes) {
        if (this.cachedBlockBytes <= RANGE_CACHE_BYTES) break;
        this.blockBytes.delete(id);
        this.blocks.delete(id);
        this.cachedBlockBytes -= size;
      }
    } catch (error) {
      for (let index = first; index <= last; index++) {
        const request = wanted.get(index);
        if (!request) continue;
        this.blocks.delete(`${key}#${index}`);
        request.reject(error);
      }
    }
  }

  private dropBlocks(key: string): void {
    const prefix = `${key}#`;
    for (const [id, size] of this.blockBytes) {
      if (!id.startsWith(prefix)) continue;
      this.blockBytes.delete(id);
      this.blocks.delete(id);
      this.cachedBlockBytes -= size;
    }
  }

  private async fetchRange(file: ContainerSpec, start: number, end: number): Promise<Uint8Array> {
    if (this.bundled) return this.readBundled(file, start, end);
    const response = await this.fetcher(this.url(file), {
      cache: "no-store",
      headers: { Range: `bytes=${start}-${end - 1}` },
    });
    if (response.status === 200) {
      // The server ignores Range: read containers whole from now on.
      this.rangeReads = false;
      await response.body?.cancel().catch(() => undefined);
      throw new RangeUnsupportedError(`${file.name} 不支持分段读取。`);
    }
    if (response.status !== 206 || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`${file.name} 分段读取失败：HTTP ${response.status}。`);
    }
    // Cross-origin servers may not expose Content-Range; the length check below still holds.
    const range = response.headers.get("content-range");
    const parts = range === null ? undefined : /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(range.trim());
    if (range !== null && (!parts || Number(parts[1]) !== start || Number(parts[2]) !== end - 1 ||
        (parts[3] !== "*" && Number(parts[3]) !== file.size))) {
      await response.body.cancel().catch(() => undefined);
      throw new Error(`${file.name} 分段读取范围不符：请求 ${start}-${end - 1}/${file.size}，响应 ${range}。`);
    }
    const bytes = new Uint8Array(end - start);
    const reader = response.body.getReader();
    let loaded = 0;
    this.rangeRequests++;
    this.rangeRequested += bytes.length;
    this.partial(file);
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (loaded + value.byteLength > bytes.length) {
          await reader.cancel().catch(() => undefined);
          throw new Error(`${file.name} 分段响应长度超过请求范围。`);
        }
        bytes.set(value, loaded);
        loaded += value.byteLength;
        this.rangeReceived += value.byteLength;
        this.partial(file);
      }
    } finally {
      reader.releaseLock();
      // A failed request leaves the totals; the last one to finish starts them over.
      this.rangeRequested -= bytes.length - loaded;
      if (--this.rangeRequests === 0) {
        this.partial(file);
        this.rangeRequested = 0;
        this.rangeReceived = 0;
      }
    }
    if (loaded !== bytes.length) {
      throw new Error(`${file.name} 分段读取长度不匹配：请求 ${bytes.length}，收到 ${loaded}。`);
    }
    return bytes;
  }

  /** A packaged container's bytes, checked against the requested length. */
  private async readBundled(file: ContainerSpec, start: number, end: number): Promise<Uint8Array> {
    if (end === start) return new Uint8Array(0);
    const bytes = new Uint8Array(await this.bundled!.read(file.name, start, end));
    if (bytes.length !== end - start) {
      throw new Error(`内置资源 ${file.name} 读取长度不符：请求 ${start}-${end}，得到 ${bytes.length} 字节。` +
        "请确认 SD 卡上的资源文件完整。");
    }
    return bytes;
  }

  /** The Blob shape ensure() returns, reading the packaged container lazily. */
  private bundledBlob(file: ContainerSpec): Blob {
    const slice = (start = 0, end = file.size) => ({
      size: end - start,
      arrayBuffer: () => this.readRange(file.name, start, end),
    });
    return { size: file.size, slice, arrayBuffer: () => this.readRange(file.name, 0, file.size) } as unknown as Blob;
  }

  private url(file: ContainerSpec): string {
    return `${this.baseUrl}/${encodeURIComponent(file.name)}`;
  }

  private async directory(): Promise<DirectoryHandle> {
    if (!this.directoryPromise) {
      this.directoryPromise = (async () => {
        try { await this.storage.persist?.(); } catch { /* Best effort. */ }
        const root = await this.storage.getDirectory();
        return root.getDirectoryHandle(`${this.manifest.version}-${this.manifest.revision}`, { create: true });
      })();
    }
    return this.directoryPromise;
  }

  private async load(file: ContainerSpec, signal?: AbortSignal): Promise<Blob> {
    const directory = await this.directory();
    const cached = await this.existing(directory, file.name);
    if (cached?.size === file.size) return cached;
    const local = await this.validLocalFile(file);
    if (local) return local;

    await this.checkSpace(file.size);
    const url = this.url(file);
    if (this.fallbackWriter) {
      const handle = await directory.getFileHandle(file.name, { create: true });
      if (!handle.createWritable) {
        await this.fallbackWriter(file, url, bytes => this.progress("downloading", file, bytes));
      } else {
        await this.download(directory, file, url, signal);
      }
    } else {
      await this.download(directory, file, url, signal);
    }
    const written = await this.existing(directory, file.name);
    if (written?.size !== file.size) {
      throw new Error(`${file.name} OPFS 长度不匹配。`);
    }
    return written;
  }

  private async existing(directory: DirectoryHandle, name: string): Promise<Blob | undefined> {
    try { return await (await directory.getFileHandle(name)).getFile(); }
    catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") return undefined;
      throw error;
    }
  }

  private async validLocalFile(file: ContainerSpec): Promise<Blob | undefined> {
    if (!this.localDirectory) return undefined;
    try {
      const blob = await (await this.localDirectory.getFileHandle(file.name)).getFile();
      if (blob.size !== file.size) return undefined;
      return (await sha256Blob(blob)) === file.sha256 ? blob : undefined;
    } catch {
      // Missing files and lost directory permissions both fall back to OPFS.
      return undefined;
    }
  }

  private async checkSpace(requiredBytes: number): Promise<void> {
    if (!this.storage.estimate) return;
    const { quota, usage } = await this.storage.estimate();
    if (typeof quota !== "number" || typeof usage !== "number" ||
        !Number.isFinite(quota) || !Number.isFinite(usage)) {
      throw new Error("浏览器未提供有效存储配额，无法确认容器可写入 OPFS。");
    }
    if (Math.max(0, quota - usage) < requiredBytes) {
      throw new Error(`OPFS 空间不足：需要 ${requiredBytes} 字节，可用 ${Math.max(0, quota - usage)} 字节。`);
    }
  }

  private async download(directory: DirectoryHandle, file: ContainerSpec, url: string,
    signal?: AbortSignal): Promise<void> {
    const handle = await directory.getFileHandle(file.name, { create: true });
    if (!handle.createWritable) throw new Error("当前 OPFS 不支持异步写入，请提供 fallbackWriter。");
    // A paused download (a shorter copy) resumes after the bytes it kept.
    const kept = this.rangeReads ? (await handle.getFile()).size : 0;
    const resume = kept > 0 && kept < file.size;
    let response: Response;
    try {
      response = await this.fetcher(url, {
        cache: "no-store", signal,
        ...(resume ? { headers: { Range: `bytes=${kept}-` } } : {}),
        // A background download yields the connection to the reads pages wait for.
        ...(this.backgroundLoads.has(file.name.toLowerCase()) ? { priority: "low" as const } : {}),
      });
    } catch (error) {
      if (signal?.aborted) throw new DownloadPausedError(`${file.name} 后台下载已暂停。`);
      throw error;
    }
    const range = response.headers.get("content-range");
    const appending = resume && response.status === 206 &&
      (range === null || range.trim() === `bytes ${kept}-${file.size - 1}/${file.size}`);
    if ((response.status !== 200 && !appending) || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`${file.name} 完整读取失败：HTTP ${response.status}。`);
    }
    const writable = await handle.createWritable(appending ? { keepExistingData: true } : undefined);
    if (appending && !writable.seek) {
      // This OPFS cannot append: drop the partial copy and download it whole.
      await writable.abort().catch(() => {});
      await response.body.cancel().catch(() => undefined);
      await directory.removeEntry?.(file.name).catch(() => {});
      return this.download(directory, file, url, signal);
    }
    if (appending) await writable.seek!(kept);
    const reader = response.body.getReader();
    let bytes = appending ? kept : 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (bytes + value.byteLength > file.size) {
          throw new Error(`${file.name} 响应长度超过资源清单。`);
        }
        await writable.write(value);
        bytes += value.byteLength;
        this.progress("downloading", file, bytes);
      }
      if (bytes !== file.size) {
        throw new Error(`${file.name} 完整读取长度不匹配：manifest=${file.size}，response=${bytes}。`);
      }
      await writable.close();
    } catch (error) {
      if (signal?.aborted) {
        // Paused: keep what arrived for the resume.
        await writable.close().catch(() => {});
        throw new DownloadPausedError(`${file.name} 后台下载已暂停。`);
      }
      await writable.abort().catch(() => {});
      await directory.removeEntry?.(file.name).catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  private progress(phase: DownloadPhase, file: ContainerSpec, loadedBytes: number): void {
    const background = this.backgroundLoads.has(file.name.toLowerCase());
    this.emit({ phase, file: file.name, loadedBytes, totalBytes: file.size, ...(background ? { background } : {}) });
  }

  private partial(file: ContainerSpec): void {
    this.emit({ phase: "partial", file: file.name, loadedBytes: this.rangeReceived, totalBytes: this.rangeRequested });
  }

  private emit(progress: ContainerProgress): void {
    this.onProgress?.(progress);
    for (const listener of this.listeners) {
      try { listener(progress); } catch (error) { console.warn(error); }
    }
  }
}
