/**
 * The 好友聊天系统 socket (GET /api/messenger/ws on the data service): the
 * first frame says hello with the session token, the welcome carries the
 * whole state, then the service pushes presence, messages and `sync` (re-read
 * the state). It reconnects with backoff until the session ends (close 4001)
 * or more tabs of the account took over (4002). Chat goes over the socket
 * when it is open and over HTTP otherwise; both are idempotent by clientId.
 */
import { AccountServiceError, errorCode } from "../account/account-api";
import {
  parseMessage, parseMessengerState, parsePresence, type ChatMessage, type MessengerApi,
} from "./messenger-api";
import type { ChatRoom, MessengerStore } from "./messenger-store";

export interface MessengerSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface MessengerConnectionOptions {
  api: MessengerApi;
  store: MessengerStore;
  url: string;
  token(): string | undefined;
  openSocket?(url: string): MessengerSocket;
  /** True while the player looks at the room (its messages are read at once). */
  viewing(room: ChatRoom): boolean;
  /** A friend request arrived or one of mine was answered. */
  onNotice?(kind: string, nickname: string): void;
  /** The service ended this login (close 4001 / LOGIN_REQUIRED). */
  onSessionEnded?(): void;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}

const OPEN = 1;
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const PING_MS = 25_000;
const SEND_TIMEOUT_MS = 10_000;
const SYNC_DELAY_MS = 120;

export const CLOSE_SESSION_ENDED = 4001;
export const CLOSE_REPLACED = 4002;

/** crypto.randomUUID where available (secure contexts), else a random v4 UUID. */
export function newClientId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < 16; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** ws(s)://<data service>/api/messenger/ws */
export function messengerSocketUrl(backendOrigin: string): string {
  const url = new URL("/api/messenger/ws", backendOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

interface PendingSend {
  resolve(message: ChatMessage): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
}

export class MessengerConnection {
  private socket?: MessengerSocket;
  private welcomed = false;
  private stopped = false;
  private attempt = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setTimeout>;
  private syncTimer?: ReturnType<typeof setTimeout>;
  private syncing?: Promise<void>;
  private syncAgain = false;
  private requestIds = 0;
  private readonly sends = new Map<string, PendingSend>();
  private readonly setTimer: typeof setTimeout;
  private readonly clearTimer: typeof clearTimeout;
  private readonly onOnline = () => {
    if (!this.stopped && !this.socket) this.connectNow();
  };

  constructor(readonly options: MessengerConnectionOptions) {
    this.setTimer = options.setTimeout ?? setTimeout.bind(globalThis);
    this.clearTimer = options.clearTimeout ?? clearTimeout.bind(globalThis);
  }

  get open(): boolean {
    return this.welcomed && this.socket?.readyState === OPEN;
  }

  start(): void {
    this.stopped = false;
    globalThis.addEventListener?.("online", this.onOnline);
    this.connectNow();
  }

  stop(state: "stopped" | "replaced" = "stopped"): void {
    this.stopped = true;
    globalThis.removeEventListener?.("online", this.onOnline);
    this.clearTimers();
    const socket = this.socket;
    this.socket = undefined;
    this.welcomed = false;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      try { socket.close(1000); } catch { /* Already closed. */ }
    }
    for (const [id, pending] of this.sends) {
      this.clearTimer(pending.timer);
      pending.reject(new AccountServiceError("MESSENGER_STOPPED"));
      this.sends.delete(id);
    }
    this.options.store.setConnection(state);
  }

  private clearTimers(): void {
    for (const timer of [this.reconnectTimer, this.pingTimer, this.syncTimer])
      if (timer !== undefined) this.clearTimer(timer);
    this.reconnectTimer = this.pingTimer = this.syncTimer = undefined;
  }

  private connectNow(): void {
    if (this.reconnectTimer !== undefined) this.clearTimer(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const token = this.options.token();
    if (!token) {
      this.stop();
      return;
    }
    this.options.store.setConnection("connecting");
    let socket: MessengerSocket;
    try {
      socket = this.options.openSocket?.(this.options.url) ??
        new WebSocket(this.options.url) as unknown as MessengerSocket;
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.welcomed = false;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      socket.send(JSON.stringify({ type: "hello", token }));
    };
    socket.onmessage = event => {
      if (this.socket !== socket || typeof event.data !== "string") return;
      let frame: unknown;
      try { frame = JSON.parse(event.data); } catch { return; }
      if (frame && typeof frame === "object") this.handle(frame as Record<string, unknown>);
    };
    socket.onerror = () => undefined;
    socket.onclose = event => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.welcomed = false;
      if (this.pingTimer !== undefined) this.clearTimer(this.pingTimer);
      this.pingTimer = undefined;
      for (const [id, pending] of this.sends) {
        this.clearTimer(pending.timer);
        pending.reject(new AccountServiceError("MESSENGER_OFFLINE"));
        this.sends.delete(id);
      }
      if (this.stopped) return;
      if (event.code === CLOSE_SESSION_ENDED) {
        this.stop();
        this.options.onSessionEnded?.();
      } else if (event.code === CLOSE_REPLACED) {
        this.stop("replaced");
      } else {
        this.options.store.setConnection("offline");
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== undefined) return;
    const base = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
    this.attempt++;
    const delay = base * (0.8 + Math.random() * 0.4);
    this.reconnectTimer = this.setTimer(() => {
      this.reconnectTimer = undefined;
      this.connectNow();
    }, delay);
  }

  private schedulePing(): void {
    if (this.pingTimer !== undefined) this.clearTimer(this.pingTimer);
    this.pingTimer = this.setTimer(() => {
      this.pingTimer = undefined;
      if (this.socket?.readyState !== OPEN) return;
      this.socket.send(JSON.stringify({ type: "ping" }));
      this.schedulePing();
    }, PING_MS);
  }

  private handle(frame: Record<string, unknown>): void {
    const { store } = this.options;
    switch (frame.type) {
      case "welcome": {
        let state;
        try { state = parseMessengerState(frame.state); } catch { return; }
        this.welcomed = true;
        this.attempt = 0;
        store.applyState(state);
        store.setConnection("online");
        this.schedulePing();
        // Rooms with a log may have missed messages while disconnected.
        for (const room of store.rooms) if (room.loaded) void this.loadLatest(room.peerId);
        return;
      }
      case "sync":
        this.scheduleSync();
        return;
      case "presence":
        if (typeof frame.accountId === "string")
          store.setPresence(frame.accountId, parsePresence(frame.presence));
        return;
      case "message": {
        const message = parseMessage(frame.message);
        if (message) this.deliver(message);
        return;
      }
      case "sent": {
        const message = parseMessage(frame.message);
        const pending = typeof frame.requestId === "string" ? this.sends.get(frame.requestId) : undefined;
        if (!message || !pending) return;
        this.sends.delete(frame.requestId as string);
        this.clearTimer(pending.timer);
        pending.resolve(message);
        return;
      }
      case "notice":
        if (typeof frame.kind === "string")
          this.options.onNotice?.(frame.kind, typeof frame.nickname === "string" ? frame.nickname : "");
        return;
      case "error": {
        const code = typeof frame.code === "string" ? frame.code : "MESSENGER_ERROR";
        const pending = typeof frame.requestId === "string" ? this.sends.get(frame.requestId) : undefined;
        if (pending) {
          this.sends.delete(frame.requestId as string);
          this.clearTimer(pending.timer);
          pending.reject(new AccountServiceError(code, 0, frame));
        }
        return;
      }
    }
  }

  private deliver(message: ChatMessage): void {
    const { store } = this.options;
    const room = store.receive(message, room => this.options.viewing(room));
    if (!room) this.scheduleSync();
  }

  /** Re-read the state soon (pushes come in bursts). */
  scheduleSync(): void {
    if (this.stopped) return;
    if (this.syncTimer !== undefined) return;
    this.syncTimer = this.setTimer(() => {
      this.syncTimer = undefined;
      void this.sync();
    }, SYNC_DELAY_MS);
  }

  /** Re-read the state now; concurrent calls share one read and one follow-up. */
  sync(): Promise<void> {
    if (this.syncing) {
      this.syncAgain = true;
      return this.syncing;
    }
    const run = async () => {
      try {
        do {
          this.syncAgain = false;
          const state = await this.options.api.state();
          if (this.stopped) return;
          this.options.store.applyState(state);
        } while (this.syncAgain && !this.stopped);
      } catch (error) {
        if (errorCode(error) !== "LOGIN_REQUIRED") console.warn("好友系统状态读取失败", error);
      } finally {
        this.syncing = undefined;
      }
    };
    this.syncing = run();
    return this.syncing;
  }

  /** The newest page of a room, merged after its loaded lines. */
  async loadLatest(peerId: string): Promise<void> {
    const page = await this.options.api.messages(peerId).catch(() => undefined);
    if (page && !this.stopped) this.options.store.addHistory(peerId, page.messages, page.hasMore, false);
  }

  /** An older page before the room's first loaded message. */
  async loadOlder(peerId: string): Promise<void> {
    const { store } = this.options;
    const room = store.room(peerId);
    if (!room || room.loading || (room.loaded && !room.hasMore)) return;
    const first = room.lines.find(line => line.kind === "message");
    room.loading = true;
    try {
      const page = await this.options.api.messages(peerId,
        room.loaded && first?.kind === "message" ? first.message.id : undefined);
      if (!this.stopped) store.addHistory(peerId, page.messages, page.hasMore, room.loaded);
    } finally {
      room.loading = false;
    }
  }

  /** Sends one chat line; resolves with the stored message. */
  send(to: string, text: string, clientId = newClientId()): Promise<ChatMessage> {
    const socket = this.socket;
    if (!this.open || !socket) return this.options.api.send(to, text, clientId);
    const requestId = `m${++this.requestIds}`;
    return new Promise<ChatMessage>((resolve, reject) => {
      const timer = this.setTimer(() => {
        this.sends.delete(requestId);
        // The socket may be stuck: the same clientId over HTTP cannot duplicate it.
        this.options.api.send(to, text, clientId).then(resolve, reject);
      }, SEND_TIMEOUT_MS);
      this.sends.set(requestId, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ type: "send", to, text, clientId, requestId }));
      } catch (error) {
        this.sends.delete(requestId);
        this.clearTimer(timer);
        this.options.api.send(to, text, clientId).then(resolve, reject);
      }
    });
  }

  /** The room was read up to its newest message. */
  markRead(peerId: string): void {
    const room = this.options.store.room(peerId);
    const upTo = room?.lastMessageId ?? 0;
    if (!room || upTo <= 0) return;
    if (this.open && this.socket) {
      try {
        this.socket.send(JSON.stringify({ type: "read", with: peerId, upTo }));
        return;
      } catch { /* Fall back to HTTP. */ }
    }
    void this.options.api.read(peerId, upTo).catch(() => undefined);
  }
}
