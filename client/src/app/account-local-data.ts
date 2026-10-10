/**
 * Browser storage that belongs to one account (server-go/ECONOMY.md 7: the
 * data service is authoritative; the browser only caches).
 *
 * Cleared on logout:
 * - the cached account profile and its owner mark (favorites, locks, the
 *   plate text, garage builds, My Room settings including its passwords),
 * - the rider nickname copy.
 * The session token is forgotten by BrowserAccountSession.logout(); the
 * account summary and inventory are never stored (memory only).
 *
 * Time attack records (best times, the record index the ghosts hang off) are
 * read before sign-in, when the application is built, so they cannot be keyed
 * by account without reordering startup. They stay with the account that last
 * signed in on this browser: the first account adopts what is there, and when
 * a different account signs in the record index is cleared and the anonymous
 * record mirror (ui/profile-sync.ts) starts under a new browser identity.
 *
 * Still shared by every account on this browser (device settings or data
 * owned elsewhere): game options and key map, touch layout and driving
 * toggles, ghost sampling mode, the last chosen game server, lobby quick
 * entries, the local resource folder, story progress (src/story) and ghost
 * replay frames in IndexedDB (no longer listed after a switch; a new record
 * for the same track replaces them).
 */
import { LOCAL_PROFILE_OWNER_KEY } from "../account/account-profile";
import { CURRENT_SUMMARY_KEY, LEGACY_SUMMARY_KEY } from "../game/ghost-records";
import { clearLocalRiderNickname, type BrowserStorage } from "../multiplayer/account-local-state";
import { LOCAL_PROFILE_KEY } from "../ui/local-profile";
import { LOCAL_OWNER_KEY, LOCAL_PROFILE_SECRET_KEY, resetBrowserProfileSync } from "../ui/profile-sync";

/** The account whose time attack records this browser holds. */
export const TIME_ATTACK_RECORDS_OWNER_KEY = "kartsim.time-attack-records-owner";

function remove(storage: BrowserStorage, key: string): void {
  try { storage.removeItem(key); } catch { /* Storage may be disabled. */ }
}

/** Logout: forget the signed-out account's cached profile and nickname. */
export function clearAccountLocalData(storage: BrowserStorage): void {
  remove(storage, LOCAL_PROFILE_KEY);
  remove(storage, LOCAL_PROFILE_OWNER_KEY);
  clearLocalRiderNickname(() => storage);
}

/**
 * Sign-in: keep this browser's time attack records with `username`. Returns
 * true when they belonged to another account and were cleared.
 */
export function claimTimeAttackRecords(storage: BrowserStorage, username: string): boolean {
  let owner: string | null;
  try {
    owner = storage.getItem(TIME_ATTACK_RECORDS_OWNER_KEY);
  } catch {
    return false;
  }
  if (owner === username) return false;
  try {
    storage.setItem(TIME_ATTACK_RECORDS_OWNER_KEY, username);
  } catch {
    return false;
  }
  if (owner === null) return false;
  remove(storage, CURRENT_SUMMARY_KEY);
  remove(storage, LEGACY_SUMMARY_KEY);
  // The anonymous record mirror is keyed by browser identity: start a new one.
  remove(storage, LOCAL_OWNER_KEY);
  remove(storage, LOCAL_PROFILE_SECRET_KEY);
  resetBrowserProfileSync();
  return true;
}

/** The browser's localStorage, or undefined where it is unavailable. */
export function browserLocalStorage(): BrowserStorage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
