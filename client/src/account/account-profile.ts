/**
 * The account-bound client profile (ECONOMY.md 6-7: `GET/PUT /api/account/profile`).
 * The data service is authoritative; the browser keeps a cached copy under the
 * old profile key, marked with the account it belongs to. On an account's first
 * login (no server profile yet) only preferences move over from an anonymous
 * browser profile: favorites, locks, My Room, the plate text and garage builds.
 * Equipment always comes from the server or the inventory fallback.
 */
import { AccountServiceError, errorCode } from "./account-api";
import type { AccountSummary } from "./account-session";

export const LOCAL_PROFILE_OWNER_KEY = "kartsim.local-profile-owner";
const PROFILE_PATH = "/api/account/profile";

export interface ProfileRequestSession {
  summary(): AccountSummary | undefined;
  requestJson(path: string, init?: RequestInit): Promise<unknown>;
}

export interface ProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProfileShape {
  equipment: unknown;
  favoriteTracks?: unknown;
  favoriteItems?: unknown;
  lockedItems?: unknown;
  myRoom?: unknown;
  initial?: unknown;
  garage?: unknown;
  [key: string]: unknown;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** The stored profile document, or undefined when the account has none yet. */
export async function fetchAccountProfile(session: ProfileRequestSession):
  Promise<Record<string, unknown> | undefined> {
  let body: unknown;
  try {
    body = await session.requestJson(PROFILE_PATH);
  } catch (error) {
    const code = errorCode(error);
    if (code === "NOT_FOUND" || code === "PROFILE_NOT_FOUND") return undefined;
    throw error;
  }
  if (!record(body)) return undefined;
  // Accept both the raw document and a {profile} envelope.
  if ("profile" in body && !("equipment" in body))
    return record(body.profile) ? body.profile : undefined;
  return record(body.equipment) ? body : undefined;
}

/**
 * Profile sections that are preferences rather than equipment. Every client
 * save writes all but `garage`; a server document without them was never
 * written by a full client (the starter claim stores `{equipment}` only), so
 * this account's cached copy fills them.
 */
export const PREFERENCE_KEYS = [
  "favoriteTracks", "favoriteItems", "lockedItems", "myRoom", "initial", "garage",
] as const;
const ALWAYS_SAVED_PREFERENCE_KEYS = PREFERENCE_KEYS.filter(key => key !== "garage");

/** Preferences a first login keeps from an anonymous browser profile. */
export function migratedPreferences<Profile extends ProfileShape>(local: Profile,
  base: Profile): Profile {
  return {
    ...base,
    favoriteTracks: local.favoriteTracks ?? base.favoriteTracks,
    favoriteItems: local.favoriteItems ?? base.favoriteItems,
    lockedItems: local.lockedItems ?? base.lockedItems,
    myRoom: local.myRoom ?? base.myRoom,
    initial: local.initial ?? base.initial,
    ...(local.garage !== undefined ? { garage: local.garage } : {}),
  };
}

export interface AccountProfileLoadOptions<Profile extends ProfileShape> {
  storage: ProfileStorage;
  profileKey: string;
  loadLocal(): Profile | undefined;
  parse(serialized: string): Profile;
  defaultProfile(): Profile;
}

export interface AccountProfileLoad<Profile> {
  profile: Profile;
  /** Read from the data service (otherwise built locally and not yet stored there). */
  fromServer: boolean;
  /** Preferences came from an anonymous browser profile. */
  migrated: boolean;
  /** Preferences missing on the server came from this account's cached copy (save them). */
  mergedLocal?: boolean;
  /**
   * The server document had invalid sections, replaced by defaults here; the
   * startup must not write those defaults back over the server copy.
   */
  salvaged?: boolean;
}

/**
 * Keep every section of an invalid profile document that is valid on its own;
 * invalid sections fall back to the default profile's.
 */
export function salvageProfile<Profile extends ProfileShape>(document: Record<string, unknown>,
  options: Pick<AccountProfileLoadOptions<Profile>, "parse" | "defaultProfile">): Profile {
  let accepted: Record<string, unknown> = { ...options.defaultProfile() };
  // Equipment first: other sections (garage builds) are read against it.
  const keys = ["equipment", ...Object.keys(document).filter(key => key !== "equipment")];
  for (const key of keys) {
    if (!(key in document)) continue;
    const candidate = { ...accepted, [key]: document[key] };
    try {
      options.parse(JSON.stringify(candidate));
      accepted = candidate;
    } catch (error) {
      console.warn(`账号档案的 ${key} 部分无效，已改用默认值。`, error);
    }
  }
  try {
    return options.parse(JSON.stringify(accepted));
  } catch {
    return options.defaultProfile();
  }
}

/** Server profile first; otherwise migrate preferences once from this browser. */
export async function loadAccountProfile<Profile extends ProfileShape>(
  session: ProfileRequestSession, options: AccountProfileLoadOptions<Profile>):
  Promise<AccountProfileLoad<Profile>> {
  const username = session.summary()?.account.username;
  if (!username) throw new AccountServiceError("LOGIN_REQUIRED", 401);
  const remember = (profile: Profile) => {
    try {
      options.storage.setItem(options.profileKey, JSON.stringify(profile));
      options.storage.setItem(LOCAL_PROFILE_OWNER_KEY, username);
    } catch {
      // The cache is optional; the data service keeps the profile.
    }
  };
  let owner: string | null = null;
  try { owner = options.storage.getItem(LOCAL_PROFILE_OWNER_KEY); } catch { owner = null; }
  let local: Profile | undefined;
  try { local = options.loadLocal(); } catch { local = undefined; }
  let remote: Record<string, unknown> | undefined;
  try {
    remote = await fetchAccountProfile(session);
  } catch (error) {
    // A brief outage after login: this account's cached copy is still its own.
    if (local && owner === username && errorCode(error) === "DATA_SERVICE_UNAVAILABLE")
      return { profile: local, fromServer: true, migrated: false };
    throw error;
  }
  if (remote) {
    let document = remote;
    let mergedLocal = false;
    // A first save that never landed (the server kept only the starter
    // claim's equipment): this account's own cached preferences fill the gaps.
    if (local && owner === username &&
        ALWAYS_SAVED_PREFERENCE_KEYS.some(key => !(key in remote))) {
      for (const key of PREFERENCE_KEYS) {
        if (key in remote || local[key] === undefined) continue;
        if (document === remote) document = { ...remote };
        document[key] = local[key];
        mergedLocal = true;
      }
    }
    let profile: Profile;
    let salvaged = false;
    try {
      profile = options.parse(JSON.stringify(document));
    } catch (error) {
      console.warn("账号档案部分无效，已保留有效部分。", error);
      profile = salvageProfile(document, options);
      salvaged = true;
    }
    remember(profile);
    return { profile, fromServer: true, migrated: false,
      ...(mergedLocal ? { mergedLocal } : {}), ...(salvaged ? { salvaged } : {}) };
  }
  // Another account's cached profile is never carried over.
  const migrate = !!local && (owner === null || owner === username);
  const profile = migrate
    ? migratedPreferences(local!, options.defaultProfile())
    : options.defaultProfile();
  remember(profile);
  return { profile, fromServer: false, migrated: migrate };
}

export interface AccountProfileSyncOptions {
  /** False while the account has not claimed its starter kit. */
  canWrite(): boolean;
  /** 409 ITEM_NOT_OWNED: refresh the inventory and replace unowned equipment. */
  onItemNotOwned?(profile: unknown): void | Promise<void>;
  onError?(error: unknown): void;
  /** Waits before each retry of a write the service could not take now. */
  retryDelaysMs?: readonly number[];
  sleep?(ms: number): Promise<void>;
}

/** Failures that may pass: the service was unreachable or asked to slow down. */
const RETRYABLE_WRITE_CODES: ReadonlySet<string> = new Set([
  "DATA_SERVICE_UNAVAILABLE", "RATE_LIMITED", "TOO_MANY_ATTEMPTS",
]);
const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000, 10_000];

function backgroundSleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    (timer as { unref?(): void }).unref?.();
  });
}

/**
 * Ordered `PUT /api/account/profile` writes; a slow earlier write never wins.
 * A write the service could not take is retried with backoff until a newer
 * write (which carries the whole profile) replaces it.
 */
export class AccountProfileSync {
  private writes: Promise<void> = Promise.resolve();
  private generation = 0;
  /** The failure of the newest write, undefined once it landed. */
  private lastError: unknown;

  constructor(private readonly session: ProfileRequestSession,
    private readonly options: AccountProfileSyncOptions) {}

  enqueue(profile: unknown): void {
    if (!this.options.canWrite()) return;
    const serialized = JSON.stringify(profile);
    const generation = ++this.generation;
    const delays = this.options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    const sleep = this.options.sleep ?? backgroundSleep;
    this.writes = this.writes.catch(() => {}).then(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          await this.session.requestJson(PROFILE_PATH, { method: "PUT", body: serialized });
          if (generation === this.generation) this.lastError = undefined;
          return;
        } catch (error) {
          if (errorCode(error) === "ITEM_NOT_OWNED") {
            await this.options.onItemNotOwned?.(profile);
            return;
          }
          const delay = delays[attempt];
          if (delay !== undefined && RETRYABLE_WRITE_CODES.has(errorCode(error) ?? "") &&
              generation === this.generation && this.options.canWrite()) {
            await sleep(delay);
            // A newer write is queued behind this one and carries the whole profile.
            if (generation === this.generation && this.options.canWrite()) continue;
            return;
          }
          if (generation === this.generation) this.lastError = error;
          this.options.onError?.(error);
          throw error;
        }
      }
    });
    void this.writes.catch(() => {});
  }

  flush(): Promise<void> { return this.writes.catch(() => {}); }

  /**
   * Wait for every queued write, including writes queued meanwhile (an
   * ITEM_NOT_OWNED repair saves again); false when the newest one failed.
   */
  async settled(): Promise<boolean> {
    for (;;) {
      const current = this.writes;
      await current.catch(() => {});
      if (current === this.writes) break;
    }
    return this.lastError === undefined;
  }
}
