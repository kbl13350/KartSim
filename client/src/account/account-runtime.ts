/**
 * Process-wide state of the signed-in account: the installed session, its
 * ordered profile writes and the handler that repairs equipment the service
 * reports as not owned.
 */
import { AccountProfileSync, type AccountProfileLoad } from "./account-profile";
import { currentAccountSession, setCurrentAccountSession } from "./account-session";
import { BrowserAccountSession } from "./browser-session";

let profileSync: AccountProfileSync | undefined;
let repairHandler: ((profile: unknown) => void | Promise<void>) | undefined;
let lastLoad: Omit<AccountProfileLoad<unknown>, "profile"> | undefined;

/** The installed browser session while it is still usable. */
export function activeBrowserSession(): BrowserAccountSession | undefined {
  const session = currentAccountSession();
  return session instanceof BrowserAccountSession && !session.isClosed && !session.expired
    ? session : undefined;
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return left.replace(/\/+$/, "") === right.replace(/\/+$/, "");
  }
}

/**
 * The Bearer token multiplayer sends to the data service at `origin` for
 * game-server tickets: the signed-in session's own token, so tickets always
 * name the account the lobby shows. The token stored for `origin` (shared
 * localStorage, possibly saved by another login) is a fallback only for a
 * differently spelled origin, and only when it is this session's token.
 */
export function multiplayerSessionToken(origin: string,
  stored: (origin: string) => string | undefined): string | undefined {
  const session = activeBrowserSession();
  if (!session) return undefined;
  if (sameOrigin(session.backendOrigin, origin)) return session.sessionToken;
  const token = stored(origin);
  return token !== undefined && token === session.sessionToken ? token : undefined;
}

/** Make `session` the current account (setCurrentAccountSession) and start its profile writes. */
export function installAccountSession(session: BrowserAccountSession): void {
  setCurrentAccountSession(session);
  lastLoad = undefined;
  profileSync = new AccountProfileSync(session, {
    canWrite: () => !session.isClosed && !session.expired &&
      session.summary()?.onboarded === true,
    onItemNotOwned: async profile => {
      try { await session.refresh(); } catch { /* Repair with what is known. */ }
      await repairHandler?.(profile);
    },
    onError: error => console.warn("账号档案保存失败", error),
  });
}

/** Forget the session (logout or expiry). */
export function clearAccountSession(): void {
  setCurrentAccountSession(undefined);
  profileSync = undefined;
  lastLoad = undefined;
}

export function accountProfileSync(): AccountProfileSync | undefined {
  return activeBrowserSession() ? profileSync : undefined;
}

/** The application installs how unowned equipment is replaced in its live state. */
export function setEquipmentRepairHandler(
  handler: ((profile: unknown) => void | Promise<void>) | undefined): void {
  repairHandler = handler;
}

export function recordProfileLoad(load: Omit<AccountProfileLoad<unknown>, "profile">): void {
  lastLoad = { fromServer: load.fromServer, migrated: load.migrated,
    ...(load.mergedLocal ? { mergedLocal: true } : {}),
    ...(load.salvaged ? { salvaged: true } : {}) };
}

/** How the startup profile was obtained (undefined before the first account load). */
export function lastProfileLoad(): Omit<AccountProfileLoad<unknown>, "profile"> | undefined {
  return lastLoad;
}

/** Background timers never keep a Node test process alive. */
export function backgroundTimer<Timer>(timer: Timer): Timer {
  (timer as { unref?(): void }).unref?.();
  return timer;
}

let raceRefreshTimers: ReturnType<typeof setTimeout>[] = [];

/**
 * After a multiplayer race the game node's outbox credits the account
 * asynchronously; read the account twice so the top bar, wallet and a level-up
 * notice catch up.
 */
export function refreshAccountAfterRace(delaysMs: readonly number[] = [2_000, 10_000]): void {
  const session = activeBrowserSession();
  if (!session) return;
  for (const timer of raceRefreshTimers) clearTimeout(timer);
  raceRefreshTimers = delaysMs.map(delay => backgroundTimer(setTimeout(() => {
    if (activeBrowserSession() === session) void session.refresh().catch(() => undefined);
  }, delay)));
}
