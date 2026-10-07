/** Browser-local multiplayer session and nickname persistence. */

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const sessionPrefix = "kartsim.multiplayer.session:";
const nicknameKey = "kartsim.local-nickname";

export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SessionTokenStore {
  cache: Map<string, string>;
  storage(): BrowserStorage;
}

export function loadMultiplayerSessionToken(origin: string,
  store: SessionTokenStore): string | undefined {
  try {
    const token = store.storage().getItem(sessionPrefix + origin);
    return token && tokenPattern.test(token) ? token : store.cache.get(origin);
  } catch {
    return store.cache.get(origin);
  }
}

export function saveMultiplayerSessionToken(origin: string, token: string,
  store: SessionTokenStore): void {
  if (!tokenPattern.test(token)) throw new Error("INVALID_SESSION_TOKEN");
  store.cache.set(origin, token);
  try { store.storage().setItem(sessionPrefix + origin, token); }
  catch { /* Session memory still retains the token. */ }
}

export function clearMultiplayerSessionToken(origin: string,
  store: SessionTokenStore): void {
  store.cache.delete(origin);
  try { store.storage().removeItem(sessionPrefix + origin); }
  catch { /* Clearing memory is sufficient when storage is unavailable. */ }
}

export function loadLocalRiderNickname(storage: () => BrowserStorage): string {
  try {
    const value: unknown = JSON.parse(storage().getItem(nicknameKey) ?? "");
    return typeof value === "string" ? value : "";
  } catch { return ""; }
}

export function saveLocalRiderNickname(nickname: string,
  storage: () => BrowserStorage): void {
  try { storage().setItem(nicknameKey, JSON.stringify(nickname)); }
  catch { /* Local storage may be disabled. */ }
}

export function clearLocalRiderNickname(storage: () => BrowserStorage): void {
  try { storage().removeItem(nicknameKey); }
  catch { /* Local storage may be disabled. */ }
}
