/**
 * The My Room visit socket (GET /api/myroom/ws on the data service). The
 * first frame says hello with the session token; then `enter` puts the
 * rider into a room (its own, a rider's by nickname, or a random one), and
 * the service pushes who joins, leaves, walks and chats there. It reconnects
 * with backoff while the room screen is open and re-enters the last room.
 */
import type { FavoriteItem } from "../ui/local-profile";

export interface RoomSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface RoomPose { x: number; y: number; z: number; yaw: number; moving: boolean }

/** A rider's look: the LocalProfile subset the room scene renders. */
export interface RoomAppearance {
  equipment: { itemIds: Record<string, number>; kartSerial?: number; [key: string]: unknown };
  initial: string;
  garage: unknown;
}

export interface RoomMember {
  accountId: string;
  nickname: string;
  exp: number;
  level: number;
  glove: string;
  appearance?: RoomAppearance;
  owner: boolean;
  /** riderCard0..7: 0 the owner, 1..7 visitors. */
  slot: number;
  pose?: RoomPose;
}

export interface RoomSettings {
  environmentId: number;
  displayName: string;
  message: string;
  displayKarts: FavoriteItem[];
  chatAllowed: boolean;
  locked: boolean;
  etcLocked: boolean;
}

export interface RoomView {
  ownerId: string;
  ownerNickname: string;
  ownerExp: number;
  ownerAppearance?: RoomAppearance;
  settings: RoomSettings;
  mainEmblems: [number, number];
}

export interface RoomSnapshot {
  room: RoomView;
  members: RoomMember[];
  self: string;
}

export type RoomEvent =
  | { type: "joined"; member: RoomMember }
  | { type: "left"; accountId: string; nickname: string; reason?: string }
  | { type: "moved"; accountId: string; pose: RoomPose }
  | { type: "chat"; accountId: string; nickname: string; text: string; at: number }
  | { type: "chat-error"; code: string; mutedUntil?: number }
  | { type: "settings"; room: RoomView }
  | { type: "member"; member: RoomMember }
  | { type: "kicked"; ownerNickname: string }
  /** Another tab of this account entered a room. */
  | { type: "replaced" }
  | { type: "connection"; open: boolean }
  /** Reconnected and back in the same room. */
  | { type: "rejoined"; snapshot: RoomSnapshot };

/** An enter, leave or kick the service refused; `code` names the reason. */
export class MyRoomError extends Error {
  constructor(readonly code: string, readonly nickname?: string) {
    super(code);
    this.name = "MyRoomError";
  }
}

export type EnterTarget = { own: true } | { nickname: string } | { random: true };

export interface MyRoomConnectionOptions {
  url: string;
  token(): string | undefined;
  openSocket?(url: string): RoomSocket;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}

const OPEN = 1;
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000];
const PING_MS = 25_000;
const REQUEST_TIMEOUT_MS = 10_000;
export const CLOSE_SESSION_ENDED = 4001;

/** ws(s)://<data service>/api/myroom/ws */
export function myRoomSocketUrl(backendOrigin: string): string {
  const url = new URL("/api/myroom/ws", backendOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export function parsePose(value: unknown): RoomPose | undefined {
  if (!record(value)) return undefined;
  const [x, y, z, yaw] = [finite(value.x), finite(value.y), finite(value.z), finite(value.yaw)];
  if (x === undefined || y === undefined || z === undefined || yaw === undefined) return undefined;
  return { x, y, z, yaw, moving: value.moving === true };
}

export function parseAppearance(value: unknown): RoomAppearance | undefined {
  if (!record(value) || !record(value.equipment) || !record(value.equipment.itemIds)) return undefined;
  return { equipment: value.equipment as RoomAppearance["equipment"],
    initial: typeof value.initial === "string" ? value.initial : "", garage: value.garage };
}

export function parseMember(value: unknown): RoomMember | undefined {
  if (!record(value) || typeof value.accountId !== "string" || typeof value.nickname !== "string")
    return undefined;
  const slot = finite(value.slot);
  if (slot === undefined || slot < 0 || slot > 7) return undefined;
  return {
    accountId: value.accountId, nickname: value.nickname,
    exp: finite(value.exp) ?? 0, level: finite(value.level) ?? 1,
    glove: typeof value.glove === "string" ? value.glove : "",
    appearance: parseAppearance(value.appearance), owner: value.owner === true, slot,
    pose: parsePose(value.pose),
  };
}

export function parseRoomView(value: unknown): RoomView | undefined {
  if (!record(value) || typeof value.ownerId !== "string" || typeof value.ownerNickname !== "string" ||
      !record(value.settings)) return undefined;
  const settings = value.settings;
  const main = Array.isArray(value.mainEmblems) ? value.mainEmblems : [];
  return {
    ownerId: value.ownerId, ownerNickname: value.ownerNickname,
    ownerExp: finite(value.ownerExp) ?? 0,
    ownerAppearance: parseAppearance(value.ownerAppearance),
    settings: {
      environmentId: finite(settings.environmentId) ?? 16,
      displayName: typeof settings.displayName === "string" ? settings.displayName : "",
      message: typeof settings.message === "string" ? settings.message : "",
      displayKarts: (Array.isArray(settings.displayKarts) ? settings.displayKarts : [])
        .filter(record) as unknown as FavoriteItem[],
      chatAllowed: settings.chatAllowed !== false,
      locked: settings.locked === true,
      etcLocked: settings.etcLocked === true,
    },
    mainEmblems: [finite(main[0]) ?? 0, finite(main[1]) ?? 0],
  };
}

export function parseSnapshot(frame: Record<string, unknown>): RoomSnapshot | undefined {
  const room = parseRoomView(frame.room);
  if (!room || typeof frame.self !== "string" || !Array.isArray(frame.members)) return undefined;
  const members = frame.members.map(parseMember).filter((member): member is RoomMember => !!member);
  return { room, members, self: frame.self };
}

interface Pending {
  resolve(value: unknown): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
}

export class MyRoomConnection {
  private socket?: RoomSocket;
  private welcomed = false;
  private stopped = true;
  private attempt = 0;
  private requestIds = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setTimeout>;
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Set<(event: RoomEvent) => void>();
  private readonly waiters: Array<{ resolve(): void; reject(error: unknown): void }> = [];
  /** The room to re-enter after a reconnect. */
  private lastTarget?: { target: EnterTarget; password?: string; ownerNickname: string };
  private readonly setTimer: typeof setTimeout;
  private readonly clearTimer: typeof clearTimeout;

  constructor(readonly options: MyRoomConnectionOptions) {
    this.setTimer = options.setTimeout ?? setTimeout.bind(globalThis);
    this.clearTimer = options.clearTimeout ?? clearTimeout.bind(globalThis);
  }

  get open(): boolean { return this.welcomed && this.socket?.readyState === OPEN; }

  onEvent(listener: (event: RoomEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connectNow();
  }

  stop(): void {
    this.stopped = true;
    this.lastTarget = undefined;
    this.clearTimer(this.reconnectTimer);
    this.clearTimer(this.pingTimer);
    const socket = this.socket;
    this.socket = undefined;
    this.welcomed = false;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      try { socket.close(1000); } catch { /* Already closed. */ }
    }
    this.failAll(new MyRoomError("CONNECTION_CLOSED"));
  }

  /** Enter a room; resolves with what is in it. */
  async enter(target: EnterTarget, password?: string): Promise<RoomSnapshot> {
    await this.ready();
    const fields: Record<string, unknown> = { type: "enter" };
    if ("nickname" in target) fields.nickname = target.nickname;
    if ("random" in target) fields.random = true;
    if (password) fields.password = password;
    const frame = await this.request(fields) as Record<string, unknown>;
    const snapshot = parseSnapshot(frame);
    if (!snapshot) throw new MyRoomError("INVALID_RESPONSE");
    this.lastTarget = { target: { nickname: snapshot.room.ownerNickname }, password,
      ownerNickname: snapshot.room.ownerNickname };
    return snapshot;
  }

  async leave(): Promise<void> {
    this.lastTarget = undefined;
    if (!this.open) return;
    await this.request({ type: "leave" }).catch(() => undefined);
  }

  async kick(accountId: string): Promise<void> {
    await this.request({ type: "kick", accountId });
  }

  /** Walking updates; dropped while disconnected. */
  move(pose: RoomPose): void {
    this.sendFrame({ type: "move", ...pose });
  }

  /** A chat line; refusals arrive as chat-error events. */
  chat(text: string): boolean {
    return this.sendFrame({ type: "chat", requestId: `chat-${++this.requestIds}`, text });
  }

  private sendFrame(frame: Record<string, unknown>): boolean {
    if (!this.open) return false;
    try {
      this.socket!.send(JSON.stringify(frame));
      return true;
    } catch {
      return false;
    }
  }

  private ready(): Promise<void> {
    if (this.open) return Promise.resolve();
    if (this.stopped) return Promise.reject(new MyRoomError("CONNECTION_CLOSED"));
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      this.waiters.push(waiter);
      const timer = this.setTimer(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new MyRoomError("DATA_SERVICE_UNAVAILABLE"));
      }, REQUEST_TIMEOUT_MS);
      waiter.resolve = () => { this.clearTimer(timer); resolve(); };
      waiter.reject = error => { this.clearTimer(timer); reject(error); };
    });
  }

  private request(fields: Record<string, unknown>): Promise<unknown> {
    const requestId = `r${++this.requestIds}`;
    return new Promise((resolve, reject) => {
      const timer = this.setTimer(() => {
        this.pending.delete(requestId);
        reject(new MyRoomError("TIMEOUT"));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timer });
      if (!this.sendFrame({ ...fields, requestId })) {
        this.clearTimer(timer);
        this.pending.delete(requestId);
        reject(new MyRoomError("DATA_SERVICE_UNAVAILABLE"));
      }
    });
  }

  private emit(event: RoomEvent): void {
    for (const listener of [...this.listeners]) {
      try { listener(event); } catch (error) { console.warn("小屋事件处理失败", error); }
    }
  }

  private failAll(error: unknown): void {
    for (const [id, pending] of this.pending) {
      this.clearTimer(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  private connectNow(): void {
    if (this.stopped || this.socket) return;
    const token = this.options.token();
    if (!token) {
      this.failAll(new MyRoomError("LOGIN_REQUIRED"));
      return;
    }
    let socket: RoomSocket;
    try {
      socket = this.options.openSocket?.(this.options.url) ??
        new WebSocket(this.options.url) as unknown as RoomSocket;
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      try { socket.send(JSON.stringify({ type: "hello", token })); } catch { /* onclose follows. */ }
    };
    socket.onmessage = event => this.receive(socket, event.data);
    socket.onerror = () => { /* onclose follows. */ };
    socket.onclose = event => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      const wasOpen = this.welcomed;
      this.welcomed = false;
      this.clearTimer(this.pingTimer);
      this.failAll(new MyRoomError("CONNECTION_CLOSED"));
      if (wasOpen) this.emit({ type: "connection", open: false });
      if (event.code === CLOSE_SESSION_ENDED) {
        this.stopped = true;
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
    this.attempt++;
    this.clearTimer(this.reconnectTimer);
    this.reconnectTimer = this.setTimer(() => this.connectNow(), delay);
  }

  private schedulePing(): void {
    this.clearTimer(this.pingTimer);
    this.pingTimer = this.setTimer(() => {
      this.sendFrame({ type: "ping" });
      this.schedulePing();
    }, PING_MS);
  }

  private receive(socket: RoomSocket, data: unknown): void {
    if (this.socket !== socket || typeof data !== "string") return;
    let frame: unknown;
    try { frame = JSON.parse(data); } catch { return; }
    if (!record(frame) || typeof frame.type !== "string") return;
    const requestId = typeof frame.requestId === "string" ? frame.requestId : undefined;
    const pending = requestId ? this.pending.get(requestId) : undefined;
    if (pending && requestId) {
      this.pending.delete(requestId);
      this.clearTimer(pending.timer);
      if (frame.type === "error") {
        pending.reject(new MyRoomError(String(frame.code ?? "INTERNAL_ERROR"),
          typeof frame.nickname === "string" ? frame.nickname : undefined));
      } else pending.resolve(frame);
      return;
    }
    switch (frame.type) {
      case "welcome":
        this.welcomed = true;
        this.attempt = 0;
        this.schedulePing();
        this.emit({ type: "connection", open: true });
        for (const waiter of this.waiters.splice(0)) waiter.resolve();
        this.rejoin();
        return;
      case "error":
        if (requestId?.startsWith("chat-")) {
          this.emit({ type: "chat-error", code: String(frame.code ?? ""),
            mutedUntil: finite(frame.mutedUntil) });
        } else if (frame.code === "LOGIN_REQUIRED") {
          this.stopped = true;
        }
        return;
      case "joined": {
        const member = parseMember(frame.member);
        if (member) this.emit({ type: "joined", member });
        return;
      }
      case "member": {
        const member = parseMember(frame.member);
        if (member) this.emit({ type: "member", member });
        return;
      }
      case "left":
        if (typeof frame.accountId === "string") this.emit({ type: "left", accountId: frame.accountId,
          nickname: typeof frame.nickname === "string" ? frame.nickname : "",
          reason: typeof frame.reason === "string" ? frame.reason : undefined });
        return;
      case "moved": {
        const pose = parsePose(frame);
        if (pose && typeof frame.accountId === "string")
          this.emit({ type: "moved", accountId: frame.accountId, pose });
        return;
      }
      case "chat":
        if (typeof frame.accountId === "string" && typeof frame.text === "string")
          this.emit({ type: "chat", accountId: frame.accountId,
            nickname: typeof frame.nickname === "string" ? frame.nickname : "",
            text: frame.text, at: finite(frame.at) ?? Date.now() });
        return;
      case "settings": {
        const room = parseRoomView(frame.room);
        if (room) this.emit({ type: "settings", room });
        return;
      }
      case "kicked":
        this.lastTarget = undefined;
        this.emit({ type: "kicked",
          ownerNickname: typeof frame.ownerNickname === "string" ? frame.ownerNickname : "" });
        return;
      case "left-room":
        if (frame.reason === "replaced") {
          this.lastTarget = undefined;
          this.emit({ type: "replaced" });
        }
        return;
    }
  }

  /** After a reconnect, go back into the room the rider was in. */
  private rejoin(): void {
    const last = this.lastTarget;
    if (!last) return;
    this.enter(last.target, last.password).then(snapshot => {
      this.emit({ type: "rejoined", snapshot });
    }, () => {
      this.emit({ type: "kicked", ownerNickname: last.ownerNickname });
    });
  }
}
