/**
 * The data-service session token, remembered in localStorage for 30 days and
 * shared with the multiplayer account code (generated `multiplayerTokenStore`)
 * so tickets for game servers use the same login.
 */
import {
  clearMultiplayerSessionToken, loadMultiplayerSessionToken, saveMultiplayerSessionToken,
  type BrowserStorage, type SessionTokenStore,
} from "../multiplayer/account-local-state";

/** The data service keeps a session for 30 days; the browser forgets it at the same age. */
export const ACCOUNT_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_PREFIX = "kartsim.multiplayer.session:";
const SAVED_PREFIX = "kartsim.multiplayer.session-saved:";

/**
 * A storage view that stamps each saved session token and drops tokens older
 * than the remember window. Other keys pass through untouched.
 */
export function rememberedTokenStorage(storage: () => BrowserStorage,
  now: () => number = () => Date.now(),
  rememberMs = ACCOUNT_REMEMBER_MS): BrowserStorage {
  const savedKey = (key: string) => SAVED_PREFIX + key.slice(SESSION_PREFIX.length);
  return {
    getItem(key) {
      const target = storage();
      const value = target.getItem(key);
      if (value === null || !key.startsWith(SESSION_PREFIX)) return value;
      const saved = Number(target.getItem(savedKey(key)));
      // Tokens saved before the stamp existed count as fresh once.
      if (!Number.isFinite(saved) || saved <= 0) {
        target.setItem(savedKey(key), String(now()));
        return value;
      }
      if (now() - saved > rememberMs) {
        target.removeItem(key);
        target.removeItem(savedKey(key));
        return null;
      }
      return value;
    },
    setItem(key, value) {
      const target = storage();
      target.setItem(key, value);
      if (key.startsWith(SESSION_PREFIX)) target.setItem(savedKey(key), String(now()));
    },
    removeItem(key) {
      const target = storage();
      target.removeItem(key);
      if (key.startsWith(SESSION_PREFIX)) target.removeItem(savedKey(key));
    },
  };
}

function browserLocalStorage(): BrowserStorage {
  if (typeof localStorage === "undefined") throw new Error("localStorage unavailable");
  return localStorage;
}

/** Shared with generated multiplayer code; the in-memory cache covers disabled storage. */
export const accountTokenStore: SessionTokenStore = {
  cache: new Map<string, string>(),
  storage: () => rememberedTokenStorage(browserLocalStorage),
};

export interface AccountTokenAccess {
  load(origin: string): string | undefined;
  save(origin: string, token: string): void;
  /**
   * Forget the stored token. With `token`, only while that token is still
   * the stored one: a newer login's token is kept.
   */
  clear(origin: string, token?: string): void;
}

export function tokenAccess(store: SessionTokenStore = accountTokenStore): AccountTokenAccess {
  return {
    load: origin => loadMultiplayerSessionToken(origin, store),
    save: (origin, token) => saveMultiplayerSessionToken(origin, token, store),
    clear: (origin, token) => {
      if (token !== undefined) {
        const stored = loadMultiplayerSessionToken(origin, store);
        if (stored !== undefined && stored !== token) return;
      }
      clearMultiplayerSessionToken(origin, store);
    },
  };
}
