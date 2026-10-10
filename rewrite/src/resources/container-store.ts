import { browserFetch, type ContainerSpec, type ResourceFetch, type ResourceManifest } from "./manifest";
import { sha256Blob } from "./sha256";

export type DownloadPhase = "checking" | "downloading" | "ready";

export interface ContainerProgress {
  readonly phase: DownloadPhase;
  readonly file: string;
  readonly loadedBytes: number;
  readonly totalBytes: number;
}

// Small structural interfaces let tests substitute in-memory OPFS handles.
export interface WritableHandle {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface FileHandle {
  getFile(): Promise<Blob>;
  createWritable?(): Promise<WritableHandle>;
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
}

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
  private readonly onProgress?: (progress: ContainerProgress) => void;
  private readonly fallbackWriter?: ContainerStoreOptions["fallbackWriter"];
  private readonly byName: Map<string, ContainerSpec>;
  private readonly inFlight = new Map<string, Promise<Blob>>();
  private readonly listeners = new Set<(progress: ContainerProgress) => void>();
  private directoryPromise?: Promise<DirectoryHandle>;

  constructor(options: ContainerStoreOptions) {
    this.manifest = options.manifest;
    this.baseUrl = (options.dataBaseUrl ?? `/${options.manifest.version}`).replace(/\/$/, "");
    this.fetcher = options.fetcher ?? browserFetch;
    this.storage = options.storage ?? defaultStorage();
    this.localDirectory = options.localDirectory;
    this.onProgress = options.onProgress;
    this.fallbackWriter = options.fallbackWriter;
    this.byName = new Map(options.manifest.files.map(file => [file.name.toLowerCase(), file]));
  }

  list(): readonly ContainerSpec[] { return this.manifest.files; }

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

  async readRange(name: string, start: number, end: number): Promise<ArrayBuffer> {
    const file = this.spec(name);
    safeRange(start, end, file.size);
    let blob = await this.ensure(file.name);
    try {
      return await blob.slice(start, end).arrayBuffer();
    } catch (error) {
      // A browser may evict an OPFS file after getFile(). Retry once.
      if (!(error instanceof DOMException) || error.name !== "NotReadableError") throw error;
      this.inFlight.delete(file.name.toLowerCase());
      blob = await this.ensure(file.name);
      return blob.slice(start, end).arrayBuffer();
    }
  }

  async preload(names: Iterable<string>, concurrency = 3): Promise<void> {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new RangeError("预加载并发数必须是正整数。");
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
    const directory = await this.directory();
    if (!(await this.existing(directory, file.name))) return false;
    this.inFlight.delete(file.name.toLowerCase());
    await directory.removeEntry?.(file.name);
    return true;
  }

  async ensure(name: string): Promise<Blob> {
    const file = this.spec(name);
    const key = file.name.toLowerCase();
    let pending = this.inFlight.get(key);
    if (!pending) {
      this.progress("checking", file, 0);
      pending = this.load(file);
      this.inFlight.set(key, pending);
    }
    try {
      const blob = await pending;
      this.progress("ready", file, file.size);
      return blob;
    } catch (error) {
      this.inFlight.delete(key);
      throw error;
    }
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

  private async load(file: ContainerSpec): Promise<Blob> {
    const directory = await this.directory();
    const cached = await this.existing(directory, file.name);
    if (cached?.size === file.size) return cached;
    const local = await this.validLocalFile(file);
    if (local) return local;

    await this.checkSpace(file.size);
    const url = `${this.baseUrl}/${encodeURIComponent(file.name)}`;
    if (this.fallbackWriter) {
      const handle = await directory.getFileHandle(file.name, { create: true });
      if (!handle.createWritable) {
        await this.fallbackWriter(file, url, bytes => this.progress("downloading", file, bytes));
      } else {
        await this.download(directory, file, url);
      }
    } else {
      await this.download(directory, file, url);
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

  private async download(directory: DirectoryHandle, file: ContainerSpec, url: string): Promise<void> {
    const handle = await directory.getFileHandle(file.name, { create: true });
    if (!handle.createWritable) throw new Error("当前 OPFS 不支持异步写入，请提供 fallbackWriter。");
    const response = await this.fetcher(url, { cache: "no-store" });
    if (response.status !== 200 || !response.body) {
      throw new Error(`${file.name} 完整读取失败：HTTP ${response.status}。`);
    }
    const writable = await handle.createWritable();
    const reader = response.body.getReader();
    let bytes = 0;
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
      await writable.abort().catch(() => {});
      await directory.removeEntry?.(file.name).catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  private progress(phase: DownloadPhase, file: ContainerSpec, loadedBytes: number): void {
    const progress = { phase, file: file.name, loadedBytes, totalBytes: file.size };
    this.onProgress?.(progress);
    for (const listener of this.listeners) {
      try { listener(progress); } catch (error) { console.warn(error); }
    }
  }
}
