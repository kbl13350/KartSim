import { LOCAL_PROFILE_KEY } from "./local-profile";
import type { LocalProfile } from "./local-profile";

export const LOCAL_OWNER_KEY = "kartsim.local-owner-id";
export const LOCAL_PROFILE_SECRET_KEY = "kartsim.local-profile-key";

interface ProfileSyncOptions {
  backendOrigin: string;
  storage: Pick<Storage, "getItem" | "setItem">;
  fetchImpl: typeof fetch;
  ownerId: () => string;
  profileSecret: () => string;
  timeoutMs?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_SECRET = /^[A-Za-z0-9_-]{43}$/;

/** Stable local identity, separate from a transient multiplayer player ID. */
export function profileCredentials(storage: ProfileSyncOptions["storage"],
  randomUuid: () => string = () => crypto.randomUUID(),
  randomBytes: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> =
    bytes => crypto.getRandomValues(bytes)):
  { ownerId: string; secret: string } {
  let ownerId = storage.getItem(LOCAL_OWNER_KEY);
  if (!ownerId || !UUID.test(ownerId)) {
    ownerId = randomUuid();
    if (!UUID.test(ownerId)) throw new Error("Failed to create local profile ID");
    storage.setItem(LOCAL_OWNER_KEY, ownerId);
  }
  let secret = storage.getItem(LOCAL_PROFILE_SECRET_KEY);
  if (!secret || !PROFILE_SECRET.test(secret)) {
    const bytes = randomBytes(new Uint8Array(32));
    secret = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    if (!PROFILE_SECRET.test(secret)) throw new Error("Failed to create local profile key");
    storage.setItem(LOCAL_PROFILE_SECRET_KEY, secret);
  }
  return { ownerId, secret };
}

/** Local storage remains authoritative; the Java service keeps a durable copy. */
export class ProfileSync {
  private readonly options: ProfileSyncOptions;
  private writes: Promise<void> = Promise.resolve();

  constructor(options: ProfileSyncOptions) { this.options = options; }

  private endpoint(): string {
    return `${this.options.backendOrigin}/api/profile/${this.options.ownerId()}`;
  }

  private headers(json = false): HeadersInit {
    return { "X-Profile-Key": this.options.profileSecret(),
      ...(json ? { "Content-Type": "application/json" } : {}) };
  }

  /** Use an existing browser profile first, and only import a server copy on a new browser. */
  async load<T extends LocalProfile>(loadLocal: () => T | undefined,
    parse: (serialized: string) => T): Promise<T | undefined> {
    const local = loadLocal();
    if (local) {
      this.enqueue(local);
      return local;
    }
    try {
      const response = await this.options.fetchImpl(this.endpoint(), {
        headers: this.headers(), cache: "no-store",
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 2_000),
      });
      if (response.status === 404 || !response.ok) return undefined;
      const remote = parse(await response.text());
      this.options.storage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(remote));
      return remote;
    } catch {
      return undefined;
    }
  }

  /** Save in order so a slower earlier request cannot overwrite a newer choice. */
  enqueue(profile: LocalProfile): void {
    const serialized = JSON.stringify(profile);
    this.writes = this.writes.catch(() => {}).then(async () => {
      const response = await this.options.fetchImpl(this.endpoint(), {
        method: "PUT", headers: this.headers(true), body: serialized,
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 2_000),
      });
      if (!response.ok) throw new Error(`Profile upload failed (${response.status})`);
    });
    // The local save is already complete; an unavailable server must not stop play.
    void this.writes.catch(() => {});
  }

  /** A named JSON document shares the profile owner's key and write ordering. */
  async loadRecord(recordId: string): Promise<Record<string, unknown> | undefined> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(recordId)) throw new Error("Invalid record ID");
    try {
      const response = await this.options.fetchImpl(
        `${this.options.backendOrigin}/api/records/${this.options.ownerId()}/${recordId}`, {
          headers: this.headers(), cache: "no-store",
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 2_000),
        });
      if (response.status === 404 || !response.ok) return undefined;
      const value: unknown = await response.json();
      return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown> : undefined;
    } catch {
      return undefined;
    }
  }

  enqueueRecord(recordId: string, document: Record<string, unknown>): void {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(recordId)) throw new Error("Invalid record ID");
    const serialized = JSON.stringify(document);
    this.writes = this.writes.catch(() => {}).then(async () => {
      const response = await this.options.fetchImpl(
        `${this.options.backendOrigin}/api/records/${this.options.ownerId()}/${recordId}`, {
          method: "PUT", headers: this.headers(true), body: serialized,
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 2_000),
        });
      if (!response.ok) throw new Error(`Record upload failed (${response.status})`);
    });
    void this.writes.catch(() => {});
  }

  /** Wait for pending writes in integration tests and shutdown tooling. */
  flush(): Promise<void> { return this.writes; }
}

let browserSync: ProfileSync | undefined;

/** Installed settings are read lazily after main.ts configures the local backend. */
export function browserProfileSync(): ProfileSync | undefined {
  if (typeof window === "undefined" || typeof localStorage === "undefined" ||
      window.__KART_MULTIPLAYER_CONFIG__?.transport !== "websocket") return undefined;
  if (browserSync) return browserSync;
  const backendOrigin = window.__KART_MULTIPLAYER_CONFIG__.backendOrigin;
  const credentials = profileCredentials(localStorage);
  browserSync = new ProfileSync({ backendOrigin, storage: localStorage,
    fetchImpl: fetch.bind(globalThis), ownerId: () => credentials.ownerId,
    profileSecret: () => credentials.secret });
  return browserSync;
}

export function loadBrowserProfile<T extends LocalProfile>(loadLocal: () => T | undefined,
  parse: (serialized: string) => T): Promise<T | undefined> {
  return browserProfileSync()?.load(loadLocal, parse) ?? Promise.resolve(loadLocal());
}

export function syncBrowserProfile(profile: LocalProfile): void {
  browserProfileSync()?.enqueue(profile);
}
