/**
 * The signed-in account's 好友聊天系统 service: one store and one socket per
 * session, started at login (app/account-startup.ts) and stopped at logout
 * or expiry. The window (ui/messenger-window.ts) and the taskbar alert read
 * it through currentMessenger().
 */
import type { BrowserAccountSession } from "../account/browser-session";
import { MessengerApi } from "./messenger-api";
import { MessengerConnection, messengerSocketUrl } from "./messenger-connection";
import { MessengerStore, type ChatRoom } from "./messenger-store";

export interface MessengerService {
  readonly session: BrowserAccountSession;
  readonly store: MessengerStore;
  readonly api: MessengerApi;
  readonly connection: MessengerConnection;
  /** Data-service clock in Unix milliseconds. */
  serverNow(): number;
}

let current: MessengerService | undefined;
let viewer: ((room: ChatRoom) => boolean) | undefined;
let noticeListener: ((kind: string, nickname: string) => void) | undefined;
const changeListeners = new Set<() => void>();
interface KeyTarget { element: HTMLElement; handle(event: KeyboardEvent): void }
let keyTarget: KeyTarget | undefined;
/** The window's own modal dialogs (加为好友, confirmations), appended to the game root. */
const dialogTargets = new Set<KeyTarget>();
let keyGuard = false;

/**
 * Keys typed in the window must not reach the game's hotkeys or the pages
 * under it (the shop, My Room and the inventory listen in the capture
 * phase). Installed at login, before those pages add their own listeners,
 * so it runs first.
 */
function installKeyGuard(): void {
  if (keyGuard || typeof window === "undefined") return;
  keyGuard = true;
  for (const type of ["keydown", "keyup", "keypress"] as const) {
    window.addEventListener(type, event => {
      const target = event.target as Node | null;
      if (!target) return;
      const owner = keyTarget?.element.contains(target) ? keyTarget
        : [...dialogTargets].find(dialog => dialog.element.contains(target));
      if (!owner) return;
      event.stopImmediatePropagation();
      owner.handle(event);
    }, true);
  }
}

/** The window's element and key handler (undefined when it is disposed). */
export function setMessengerKeyTarget(target: KeyTarget | undefined): void {
  keyTarget = target;
}

/**
 * Keys in one of the window's dialogs: the guard keeps them from the pages
 * under it and hands them to `handle` (the dialog's own listeners never see
 * them). Returns the release.
 */
export function guardMessengerDialog(target: KeyTarget): () => void {
  installKeyGuard();
  dialogTargets.add(target);
  return () => { dialogTargets.delete(target); };
}

function announce(): void {
  for (const listener of [...changeListeners]) {
    try { listener(); } catch (error) { console.warn("好友系统监听失败", error); }
  }
}

/** Start (or keep) the service of `session`. */
export function startMessenger(session: BrowserAccountSession): MessengerService {
  if (current?.session === session) return current;
  stopMessenger();
  installKeyGuard();
  const store = new MessengerStore();
  const api = new MessengerApi(session);
  const connection = new MessengerConnection({
    api, store,
    url: messengerSocketUrl(session.backendOrigin),
    token: () => session.isClosed || session.expired ? undefined : session.sessionToken,
    viewing: room => viewer?.(room) ?? false,
    onNotice: (kind, nickname) => noticeListener?.(kind, nickname),
    // Logged out elsewhere or expired: the account read gets the 401 that signs this page out.
    onSessionEnded: () => { void session.refresh().catch(() => undefined); },
  });
  current = { session, store, api, connection, serverNow: () => session.serverNow() };
  connection.start();
  announce();
  return current;
}

export function stopMessenger(): void {
  if (!current) return;
  const stopping = current;
  current = undefined;
  stopping.connection.stop();
  announce();
}

export function currentMessenger(): MessengerService | undefined {
  return current;
}

/** Called when the service starts or stops (the taskbar re-subscribes its alert). */
export function onMessengerChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}

/** The window says which room the player is reading (its messages are read at once). */
export function setMessengerViewer(view: ((room: ChatRoom) => boolean) | undefined): void {
  viewer = view;
}

export function setMessengerNoticeListener(listener: ((kind: string, nickname: string) => void) | undefined): void {
  noticeListener = listener;
}
