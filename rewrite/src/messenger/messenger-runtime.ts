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
let keyTarget: { element: HTMLElement; handle(event: KeyboardEvent): void } | undefined;
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
      if (!keyTarget || !target || !keyTarget.element.contains(target)) return;
      event.stopImmediatePropagation();
      keyTarget.handle(event);
    }, true);
  }
}

/** The window's element and key handler (undefined when it is disposed). */
export function setMessengerKeyTarget(target: typeof keyTarget): void {
  keyTarget = target;
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
